import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, tradesTable, weeksTable, type Week } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth.js";

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

// GET /api/stats/summary — overall stats for the authenticated user's trades only
router.get("/stats/summary", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const trades = await db
    .select({ result: tradesTable.result, rrr: tradesTable.rrr, pips: tradesTable.pips })
    .from(tradesTable)
    .where(eq(tradesTable.userId, userId));
  res.json(computeStats(trades));
});

// GET /api/stats/weekly — per-week stats for the authenticated user's weeks only
router.get("/stats/weekly", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const weeks = await db
    .select()
    .from(weeksTable)
    .where(eq(weeksTable.userId, userId))
    .orderBy(weeksTable.createdAt);
  const result = await Promise.all(weeks.map(async (week: Week) => {
    const trades = await db
      .select({ result: tradesTable.result, rrr: tradesTable.rrr, pips: tradesTable.pips })
      .from(tradesTable)
      .where(and(eq(tradesTable.weekId, week.id), eq(tradesTable.userId, userId)));
    return {
      weekId: week.id,
      weekLabel: week.label,
      ...computeStats(trades),
    };
  }));
  res.json(result);
});

export default router;
