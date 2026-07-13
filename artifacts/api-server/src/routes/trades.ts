import { Router, type IRouter } from "express";
import { eq, count, desc, and } from "drizzle-orm";
import { db, tradesTable, weeksTable, type Trade } from "@workspace/db";
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

  // Verify the target week belongs to this user
  const [week] = await db
    .select({ id: weeksTable.id })
    .from(weeksTable)
    .where(and(eq(weeksTable.id, body.weekId), eq(weeksTable.userId, userId)));
  if (!week) { res.status(404).json({ error: "Week not found" }); return; }

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

  const [trade] = await db
    .update(tradesTable)
    .set({ ...body })
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
