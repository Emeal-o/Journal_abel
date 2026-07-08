import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
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

router.get("/weeks", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const weeks = await db
    .select()
    .from(weeksTable)
    .where(eq(weeksTable.userId, userId))
    .orderBy(desc(weeksTable.createdAt));
  res.json(weeks.map((w: Week) => ({ ...w, createdAt: w.createdAt.toISOString(), startDate: w.startDate })));
});

router.post("/weeks", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const body = CreateWeekBody.parse(req.body);
  const [week] = await db.insert(weeksTable).values({
    userId,
    label: body.label,
    startDate: body.startDate,
    notes: body.notes ?? null,
  }).returning();
  res.status(201).json({ ...week, createdAt: week!.createdAt.toISOString() });
});

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
    ...week,
    createdAt: week.createdAt.toISOString(),
    trades: trades.map((t: Trade) => ({ ...t, createdAt: t.createdAt.toISOString() })),
  });
});

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
  res.json({ ...week, createdAt: week.createdAt.toISOString() });
});

router.delete("/weeks/:id", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const { id } = DeleteWeekParams.parse({ id: Number(req.params.id) });
  // Verify ownership before deleting
  const [week] = await db
    .select({ id: weeksTable.id })
    .from(weeksTable)
    .where(and(eq(weeksTable.id, id), eq(weeksTable.userId, userId)));
  if (!week) { res.status(404).json({ error: "Not found" }); return; }
  await db.delete(weeksTable).where(eq(weeksTable.id, id));
  res.status(204).send();
});

export default router;
