import { Router, type IRouter } from "express";
import { eq, desc, and, isNull, isNotNull, sql } from "drizzle-orm";
import { db, weeksTable, tradesTable, type Week, type Trade } from "@workspace/db";
import {
  CreateWeekBody,
  GetWeekParams,
  UpdateWeekParams,
  UpdateWeekBody,
  DeleteWeekParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth.js";

const router: IRouter = Router();

/** Serialise a Week row to JSON — converts Date fields to ISO strings. */
function serializeWeek(w: Week) {
  return {
    ...w,
    createdAt: w.createdAt.toISOString(),
    archivedAt: w.archivedAt ? w.archivedAt.toISOString() : null,
  };
}

// GET /api/weeks
// Default: active weeks only (archived_at IS NULL).
// ?archived=true: archived weeks only (archived_at IS NOT NULL).
router.get("/weeks", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const wantArchived = req.query.archived === "true";
  const weeks = await db
    .select()
    .from(weeksTable)
    .where(and(
      eq(weeksTable.userId, userId),
      wantArchived ? isNotNull(weeksTable.archivedAt) : isNull(weeksTable.archivedAt),
    ))
    .orderBy(desc(weeksTable.createdAt));
  res.json(weeks.map(serializeWeek));
});

// POST /api/weeks — create a new active week
router.post("/weeks", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const body = CreateWeekBody.parse(req.body);
  const [week] = await db.insert(weeksTable).values({
    userId,
    label: body.label,
    startDate: body.startDate,
    notes: body.notes ?? null,
  }).returning();
  res.status(201).json(serializeWeek(week!));
});

// POST /api/weeks/archive-current-month
// Archives all of the user's active weeks under the given monthLabel.
// Returns { archivedCount } — the number of weeks that were archived.
// 400 if the user has no active weeks.
router.post("/weeks/archive-current-month", requireAuth, async (req, res) => {
  const userId = req.session.userId!;

  const { monthLabel } = req.body as { monthLabel?: unknown };
  if (typeof monthLabel !== "string" || monthLabel.trim().length === 0 || monthLabel.length > 100) {
    res.status(400).json({ error: "monthLabel is required and must be 1–100 characters." });
    return;
  }

  // Count active weeks first so we can guard the no-op case and return the count.
  const activeWeeks = await db
    .select({ id: weeksTable.id })
    .from(weeksTable)
    .where(and(eq(weeksTable.userId, userId), isNull(weeksTable.archivedAt)));

  if (activeWeeks.length === 0) {
    res.status(400).json({ error: "No active weeks to archive." });
    return;
  }

  // month_index is the single source of truth for ordering/grouping/rollover
  // (see label-utils.ts on the frontend) — assign the next absolute,
  // never-resetting sequence number for this user: max(month_index) + 1.
  const [{ maxMonthIndex }] = await db
    .select({ maxMonthIndex: sql<number | null>`max(${weeksTable.monthIndex})` })
    .from(weeksTable)
    .where(eq(weeksTable.userId, userId));
  const nextMonthIndex = (maxMonthIndex ?? 0) + 1;

  const now = new Date();
  await db
    .update(weeksTable)
    .set({ archivedAt: now, monthLabel, monthIndex: nextMonthIndex })
    .where(and(eq(weeksTable.userId, userId), isNull(weeksTable.archivedAt)));

  res.json({ archivedCount: activeWeeks.length, monthIndex: nextMonthIndex });
});

// GET /api/weeks/suggestion
// Suggested Week Label + Start Date for the "Add New Week" dialog, derived
// from the single most recent week (active OR archived) across the user's
// ENTIRE journal. Registered before /weeks/:id so "suggestion" isn't parsed
// as an :id.
router.get("/weeks/suggestion", requireAuth, async (req, res) => {
  const userId = req.session.userId!;

  const allWeeks = await db
    .select({ label: weeksTable.label, startDate: weeksTable.startDate })
    .from(weeksTable)
    .where(eq(weeksTable.userId, userId));

  if (allWeeks.length === 0) {
    res.json({
      label: "Week 1",
      startDate: new Date().toISOString().split("T")[0],
    });
    return;
  }

  // startDate is stored as "YYYY-MM-DD" text — lexicographic order matches
  // chronological order, so a plain string max is safe and avoids timezone
  // parsing pitfalls.
  const mostRecent = allWeeks.reduce((latest, w) =>
    w.startDate > latest.startDate ? w : latest
  );

  // Week Label: increment the trailing number, preserving the rest of the
  // label's prefix/format (e.g. "Week 8" -> "Week 9", "YIIWeek3" -> "YIIWeek4").
  // Falls back to (total week count) + 1 if no trailing number is found.
  const trailingNumberMatch = mostRecent.label.match(/^(.*?)(\d+)(\s*)$/);
  const suggestedLabel = trailingNumberMatch
    ? `${trailingNumberMatch[1]}${Number(trailingNumberMatch[2]) + 1}${trailingNumberMatch[3]}`
    : `Week ${allWeeks.length + 1}`;

  // Start Date: most recent week's start date + 7 days, computed on the
  // plain "YYYY-MM-DD" string via UTC so no local-timezone drift can shift
  // the date — even if the result lands in the past (backfilling is intentional).
  const [year, month, day] = mostRecent.startDate.split("-").map(Number);
  const nextDate = new Date(Date.UTC(year!, month! - 1, day!));
  nextDate.setUTCDate(nextDate.getUTCDate() + 7);
  const suggestedStartDate = nextDate.toISOString().split("T")[0];

  res.json({ label: suggestedLabel, startDate: suggestedStartDate });
});

// GET /api/weeks/:id — fetch a single week with its trades
router.get("/weeks/:id", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const { id } = GetWeekParams.parse({ id: Number(req.params.id) });
  const [week] = await db
    .select()
    .from(weeksTable)
    .where(and(eq(weeksTable.id, id), eq(weeksTable.userId, userId)));
  if (!week) { res.status(404).json({ error: "Not found" }); return; }
  const trades = await db
    .select()
    .from(tradesTable)
    .where(and(eq(tradesTable.weekId, id), eq(tradesTable.userId, userId)))
    .orderBy(tradesTable.tradeNumber);
  res.json({
    ...serializeWeek(week),
    trades: trades.map((t: Trade) => ({ ...t, createdAt: t.createdAt.toISOString() })),
  });
});

// PATCH /api/weeks/:id — edit week fields
router.patch("/weeks/:id", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const { id } = UpdateWeekParams.parse({ id: Number(req.params.id) });
  const body = UpdateWeekBody.parse(req.body);
  const [week] = await db
    .update(weeksTable)
    .set({ ...body })
    .where(and(eq(weeksTable.id, id), eq(weeksTable.userId, userId)))
    .returning();
  if (!week) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serializeWeek(week));
});

// DELETE /api/weeks/:id — delete a week (and its trades via cascade)
router.delete("/weeks/:id", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const { id } = DeleteWeekParams.parse({ id: Number(req.params.id) });
  const [week] = await db
    .select({ id: weeksTable.id })
    .from(weeksTable)
    .where(and(eq(weeksTable.id, id), eq(weeksTable.userId, userId)));
  if (!week) { res.status(404).json({ error: "Not found" }); return; }
  await db.delete(weeksTable).where(eq(weeksTable.id, id));
  res.status(204).send();
});

export default router;
