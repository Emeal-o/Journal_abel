import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tradesTable, weeksTable } from "@workspace/db";

const router: IRouter = Router();

function computeStats(trades: Array<{ result: string; rrr: number; pips: number }>) {
  const totalTrades = trades.length;
  const wins = trades.filter(t => t.result === "Win").length;
  const losses = trades.filter(t => t.result === "Loss").length;
  const breakEvens = trades.filter(t => t.result === "BE").length;
  const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 10000) / 100 : 0;
  const netRR = Math.round(trades.reduce((sum, t) => {
    if (t.result === "Win") return sum + t.rrr;
    if (t.result === "Loss") return sum - 1;
    return sum;
  }, 0) * 100) / 100;
  const netPips = Math.round(trades.reduce((sum, t) => sum + t.pips, 0) * 10) / 10;
  return { totalTrades, wins, losses, breakEvens, winRate, netRR, netPips };
}

router.get("/stats/summary", async (_req, res) => {
  const trades = await db.select({ result: tradesTable.result, rrr: tradesTable.rrr, pips: tradesTable.pips }).from(tradesTable);
  res.json(computeStats(trades));
});

router.get("/stats/weekly", async (_req, res) => {
  const weeks = await db.select().from(weeksTable).orderBy(weeksTable.createdAt);
  const result = await Promise.all(weeks.map(async week => {
    const trades = await db
      .select({ result: tradesTable.result, rrr: tradesTable.rrr, pips: tradesTable.pips })
      .from(tradesTable)
      .where(eq(tradesTable.weekId, week.id));
    return {
      weekId: week.id,
      weekLabel: week.label,
      ...computeStats(trades),
    };
  }));
  res.json(result);
});

export default router;
