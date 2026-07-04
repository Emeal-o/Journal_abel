import { Router, type IRouter } from "express";
import { eq, count, desc } from "drizzle-orm";
import { db, tradesTable, weeksTable } from "@workspace/db";
import {
  CreateTradeBody,
  GetTradeParams,
  UpdateTradeParams,
  UpdateTradeBody,
  DeleteTradeParams,
  ListTradesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/trades", async (req, res) => {
  const query = ListTradesQueryParams.parse({
    weekId: req.query.weekId !== undefined ? Number(req.query.weekId) : undefined,
  });
  const trades = query.weekId
    ? await db.select().from(tradesTable).where(eq(tradesTable.weekId, query.weekId)).orderBy(tradesTable.tradeNumber)
    : await db.select().from(tradesTable).orderBy(desc(tradesTable.createdAt));
  res.json(trades.map(t => ({ ...t, createdAt: t.createdAt.toISOString() })));
});

router.post("/trades", async (req, res) => {
  const body = CreateTradeBody.parse(req.body);

  // Auto-increment trade number within the week
  const existingTrades = await db
    .select({ id: tradesTable.id })
    .from(tradesTable)
    .where(eq(tradesTable.weekId, body.weekId));
  const tradeNumber = existingTrades.length + 1;

  const [trade] = await db.insert(tradesTable).values({
    weekId: body.weekId,
    tradeNumber,
    result: body.result,
    rrr: body.rrr,
    pips: body.pips,
    notes: body.notes ?? null,
  }).returning();
  res.status(201).json({ ...trade, createdAt: trade.createdAt.toISOString() });
});

router.get("/trades/:id", async (req, res) => {
  const { id } = GetTradeParams.parse({ id: Number(req.params.id) });
  const [trade] = await db.select().from(tradesTable).where(eq(tradesTable.id, id));
  if (!trade) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...trade, createdAt: trade.createdAt.toISOString() });
});

router.patch("/trades/:id", async (req, res) => {
  const { id } = UpdateTradeParams.parse({ id: Number(req.params.id) });
  const body = UpdateTradeBody.parse(req.body);
  const [trade] = await db.update(tradesTable).set({ ...body }).where(eq(tradesTable.id, id)).returning();
  if (!trade) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...trade, createdAt: trade.createdAt.toISOString() });
});

router.delete("/trades/:id", async (req, res) => {
  const { id } = DeleteTradeParams.parse({ id: Number(req.params.id) });
  await db.delete(tradesTable).where(eq(tradesTable.id, id));
  res.status(204).send();
});

export default router;
