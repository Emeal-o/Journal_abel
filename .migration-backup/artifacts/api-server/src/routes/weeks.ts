import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, weeksTable, tradesTable } from "@workspace/db";
import {
  CreateWeekBody,
  GetWeekParams,
  UpdateWeekParams,
  UpdateWeekBody,
  DeleteWeekParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/weeks", async (req, res) => {
  const weeks = await db
    .select()
    .from(weeksTable)
    .orderBy(desc(weeksTable.createdAt));
  res.json(weeks.map(w => ({ ...w, createdAt: w.createdAt.toISOString(), startDate: w.startDate })));
});

router.post("/weeks", async (req, res) => {
  const body = CreateWeekBody.parse(req.body);
  const [week] = await db.insert(weeksTable).values({
    label: body.label,
    startDate: body.startDate,
    notes: body.notes ?? null,
  }).returning();
  res.status(201).json({ ...week, createdAt: week.createdAt.toISOString() });
});

router.get("/weeks/:id", async (req, res) => {
  const { id } = GetWeekParams.parse({ id: Number(req.params.id) });
  const [week] = await db.select().from(weeksTable).where(eq(weeksTable.id, id));
  if (!week) { res.status(404).json({ error: "Not found" }); return; }
  const trades = await db.select().from(tradesTable).where(eq(tradesTable.weekId, id)).orderBy(tradesTable.tradeNumber);
  res.json({
    ...week,
    createdAt: week.createdAt.toISOString(),
    trades: trades.map(t => ({ ...t, createdAt: t.createdAt.toISOString() })),
  });
});

router.patch("/weeks/:id", async (req, res) => {
  const { id } = UpdateWeekParams.parse({ id: Number(req.params.id) });
  const body = UpdateWeekBody.parse(req.body);
  const [week] = await db
    .update(weeksTable)
    .set({ ...body })
    .where(eq(weeksTable.id, id))
    .returning();
  if (!week) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...week, createdAt: week.createdAt.toISOString() });
});

router.delete("/weeks/:id", async (req, res) => {
  const { id } = DeleteWeekParams.parse({ id: Number(req.params.id) });
  await db.delete(weeksTable).where(eq(weeksTable.id, id));
  res.status(204).send();
});

export default router;
