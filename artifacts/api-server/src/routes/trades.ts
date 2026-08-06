import { Router, type IRouter } from "express";
import { eq, count, desc, and, sql } from "drizzle-orm";
import { db, tradesTable, weeksTable, setupTypesTable, type Trade } from "@workspace/db";
import {
  CreateTradeBody,
  GetTradeParams,
  UpdateTradeParams,
  UpdateTradeBody,
  DeleteTradeParams,
  ListTradesQueryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth.js";

const router: IRouter = Router();

// GET /api/trades — list trades belonging to the authenticated user.
// Optionally filter by ?weekId=<id> (ownership of the week is also verified).
router.get("/trades", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const query = ListTradesQueryParams.parse({
    weekId: req.query.weekId !== undefined ? Number(req.query.weekId) : undefined,
  });

  if (query.weekId) {
    // Verify the week belongs to this user before returning its trades
    const [week] = await db
      .select({ id: weeksTable.id })
      .from(weeksTable)
      .where(and(eq(weeksTable.id, query.weekId), eq(weeksTable.userId, userId)));
    if (!week) { res.status(404).json({ error: "Not found" }); return; }

    const trades = await db
      .select()
      .from(tradesTable)
      .where(and(eq(tradesTable.weekId, query.weekId), eq(tradesTable.userId, userId)))
      .orderBy(tradesTable.tradeNumber);
    res.json(trades.map((t: Trade) => ({ ...t, createdAt: t.createdAt.toISOString() })));
  } else {
    const trades = await db
      .select()
      .from(tradesTable)
      .where(eq(tradesTable.userId, userId))
      .orderBy(desc(tradesTable.createdAt));
    res.json(trades.map((t: Trade) => ({ ...t, createdAt: t.createdAt.toISOString() })));
  }
});

router.post("/trades", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const body = CreateTradeBody.parse(req.body);

  // ── Rate limiting (per-user, POST only) ─────────────────────────────────
  // Burst guard: max 5 trades in any rolling 60-second window.
  const [{ burstCount }] = await db
    .select({ burstCount: count() })
    .from(tradesTable)
    .where(and(
      eq(tradesTable.userId, userId),
      sql`${tradesTable.createdAt} >= NOW() - INTERVAL '60 seconds'`,
    ));
  if (burstCount >= 5) {
    res.status(429).json({ error: "You're creating entries too quickly — please wait a moment and try again." });
    return;
  }

  // Daily cap: max 150 trades in any rolling 24-hour window.
  const [{ dailyCount }] = await db
    .select({ dailyCount: count() })
    .from(tradesTable)
    .where(and(
      eq(tradesTable.userId, userId),
      sql`${tradesTable.createdAt} >= NOW() - INTERVAL '24 hours'`,
    ));
  if (dailyCount >= 150) {
    res.status(429).json({ error: "You've reached today's creation limit. This resets on a rolling 24-hour basis — try again later." });
    return;
  }
  // ────────────────────────────────────────────────────────────────────────

  // Verify the target week belongs to this user
  const [week] = await db
    .select({ id: weeksTable.id })
    .from(weeksTable)
    .where(and(eq(weeksTable.id, body.weekId), eq(weeksTable.userId, userId)));
  if (!week) { res.status(404).json({ error: "Week not found" }); return; }

  // Read setupTypeId defensively from raw body — not part of the generated schema.
  // Must be a positive integer or absent/null.
  let setupTypeId: number | null = null;
  const rawSetupTypeId = (req.body as Record<string, unknown>).setupTypeId;
  if (rawSetupTypeId !== undefined && rawSetupTypeId !== null) {
    const parsed = Number(rawSetupTypeId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      res.status(400).json({ error: "setupTypeId must be a positive integer." });
      return;
    }
    // Verify ownership — must belong to this user
    const [setupType] = await db
      .select({ id: setupTypesTable.id })
      .from(setupTypesTable)
      .where(and(eq(setupTypesTable.id, parsed), eq(setupTypesTable.userId, userId)));
    if (!setupType) {
      res.status(400).json({ error: "Invalid setupTypeId." });
      return;
    }
    setupTypeId = parsed;
  }

  // Read direction defensively from raw body — "Long" | "Short" | null.
  let direction: "Long" | "Short" | null = null;
  const rawDirection = (req.body as Record<string, unknown>).direction;
  if (rawDirection !== undefined && rawDirection !== null) {
    if (rawDirection !== "Long" && rawDirection !== "Short") {
      res.status(400).json({ error: "direction must be 'Long' or 'Short'." });
      return;
    }
    direction = rawDirection;
  }

  // Auto-increment trade number within the week for this user
  const existingTrades = await db
    .select({ id: tradesTable.id })
    .from(tradesTable)
    .where(and(eq(tradesTable.weekId, body.weekId), eq(tradesTable.userId, userId)));
  const tradeNumber = existingTrades.length + 1;

  const [trade] = await db.insert(tradesTable).values({
    userId,
    weekId: body.weekId,
    tradeNumber,
    result: body.result,
    rrr: body.rrr,
    pips: body.pips,
    notes: body.notes ?? null,
    flagEmoji: body.flagEmoji ?? null,
    setupTypeId,
    direction,
  }).returning();
  res.status(201).json({ ...trade!, createdAt: trade!.createdAt.toISOString() });
});

router.get("/trades/:id", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const { id } = GetTradeParams.parse({ id: Number(req.params.id) });
  const [trade] = await db
    .select()
    .from(tradesTable)
    .where(and(eq(tradesTable.id, id), eq(tradesTable.userId, userId)));
  if (!trade) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...trade, createdAt: trade.createdAt.toISOString() });
});

router.patch("/trades/:id", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const { id } = UpdateTradeParams.parse({ id: Number(req.params.id) });
  const body = UpdateTradeBody.parse(req.body);

  // Read setupTypeId defensively from raw body — not part of the generated schema.
  // undefined = not provided (leave unchanged); null = clear it; number = set it.
  let patchSetupTypeId: number | null | undefined = undefined;
  const rawSetupTypeId = (req.body as Record<string, unknown>).setupTypeId;
  if (rawSetupTypeId !== undefined) {
    if (rawSetupTypeId === null) {
      patchSetupTypeId = null;
    } else {
      const parsed = Number(rawSetupTypeId);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        res.status(400).json({ error: "setupTypeId must be a positive integer or null." });
        return;
      }
      // Verify ownership — must belong to this user
      const [setupType] = await db
        .select({ id: setupTypesTable.id })
        .from(setupTypesTable)
        .where(and(eq(setupTypesTable.id, parsed), eq(setupTypesTable.userId, userId)));
      if (!setupType) {
        res.status(400).json({ error: "Invalid setupTypeId." });
        return;
      }
      patchSetupTypeId = parsed;
    }
  }

  // Read direction defensively — undefined = leave unchanged; null = clear; "Long"/"Short" = set.
  let patchDirection: "Long" | "Short" | null | undefined = undefined;
  const rawDirection = (req.body as Record<string, unknown>).direction;
  if (rawDirection !== undefined) {
    if (rawDirection === null) {
      patchDirection = null;
    } else if (rawDirection === "Long" || rawDirection === "Short") {
      patchDirection = rawDirection;
    } else {
      res.status(400).json({ error: "direction must be 'Long', 'Short', or null." });
      return;
    }
  }

  // Verify ownership and that the parent week isn't archived before mutating
  const [existing] = await db
    .select({ id: tradesTable.id, weekId: tradesTable.weekId })
    .from(tradesTable)
    .where(and(eq(tradesTable.id, id), eq(tradesTable.userId, userId)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const [week] = await db
    .select({ archivedAt: weeksTable.archivedAt })
    .from(weeksTable)
    .where(eq(weeksTable.id, existing.weekId));
  if (week?.archivedAt) {
    res.status(403).json({ error: "Cannot modify trades in an archived week." });
    return;
  }

  const updateFields = {
    ...body,
    ...(patchSetupTypeId !== undefined ? { setupTypeId: patchSetupTypeId } : {}),
    ...(patchDirection !== undefined ? { direction: patchDirection } : {}),
  };

  const [trade] = await db
    .update(tradesTable)
    .set(updateFields)
    .where(and(eq(tradesTable.id, id), eq(tradesTable.userId, userId)))
    .returning();
  if (!trade) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...trade, createdAt: trade.createdAt.toISOString() });
});

router.delete("/trades/:id", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const { id } = DeleteTradeParams.parse({ id: Number(req.params.id) });
  // Verify ownership before deleting
  const [trade] = await db
    .select({ id: tradesTable.id, weekId: tradesTable.weekId })
    .from(tradesTable)
    .where(and(eq(tradesTable.id, id), eq(tradesTable.userId, userId)));
  if (!trade) { res.status(404).json({ error: "Not found" }); return; }

  const [week] = await db
    .select({ archivedAt: weeksTable.archivedAt })
    .from(weeksTable)
    .where(eq(weeksTable.id, trade.weekId));
  if (week?.archivedAt) {
    res.status(403).json({ error: "Cannot modify trades in an archived week." });
    return;
  }

  await db.delete(tradesTable).where(eq(tradesTable.id, id));
  res.status(204).send();
});

export default router;
