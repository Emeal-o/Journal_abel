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
