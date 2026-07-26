import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, tradesTable, weeksTable, type Week } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth.js";

// ─── label helpers (mirrors label-utils.ts on the client) ────────────────────
function yearIndexFromMonthIndex(mi: number): number {
  const n = Math.max(1, Math.floor(mi));
  return Math.ceil(n / 13);
}
function monthInYearFromMonthIndex(mi: number): number {
  const n = Math.max(1, Math.floor(mi));
  return ((n - 1) % 13) + 1;
}
const ROMAN_TABLE: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];
function toRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1) return "I";
  let result = "", remaining = n;
  for (const [value, numeral] of ROMAN_TABLE) {
    while (remaining >= value) { result += numeral; remaining -= value; }
  }
  return result;
}

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

// ─── types for the analysis endpoint ─────────────────────────────────────────
type AnalysisTrade = { id: number; weekId: number; result: string; rrr: number; pips: number; createdAt: Date };
type WeekStatEntry = { week: Week; trades: AnalysisTrade[]; totalTrades: number; wins: number; losses: number; breakEvens: number; winRate: number; netRR: number; netPips: number };

// GET /api/stats/analysis — rich all-time analytics for the authenticated user
router.get("/stats/analysis", requireAuth, async (req, res) => {
  const userId = req.session.userId!;

  // All weeks (active + archived) in chronological order
  const weeks = await db
    .select()
    .from(weeksTable)
    .where(eq(weeksTable.userId, userId))
    .orderBy(weeksTable.createdAt);

  // All trades in chronological order
  const allTrades: AnalysisTrade[] = await db
    .select({ id: tradesTable.id, weekId: tradesTable.weekId, result: tradesTable.result, rrr: tradesTable.rrr, pips: tradesTable.pips, createdAt: tradesTable.createdAt })
    .from(tradesTable)
    .where(eq(tradesTable.userId, userId))
    .orderBy(tradesTable.createdAt);

  // Group trades by weekId (preserving chronological order within each week)
  const tradesByWeek = new Map<number, AnalysisTrade[]>();
  for (const t of allTrades) {
    if (!tradesByWeek.has(t.weekId)) tradesByWeek.set(t.weekId, []);
    tradesByWeek.get(t.weekId)!.push(t);
  }

  // Per-week computed stats
  const weekStats: WeekStatEntry[] = weeks.map((w: Week) => {
    const trades = tradesByWeek.get(w.id) ?? [];
    return { week: w, trades, ...computeStats(trades) };
  });

  // 1. All-time summary
  const allTime = computeStats(allTrades);

  // 2. Year-over-year (archived weeks only; active weeks grouped as "Active")
  const yearMap = new Map<number | "active", typeof weekStats>();
  for (const ws of weekStats) {
    const key = ws.week.monthIndex != null ? yearIndexFromMonthIndex(ws.week.monthIndex) : "active";
    if (!yearMap.has(key)) yearMap.set(key, []);
    yearMap.get(key)!.push(ws);
  }
  const byYear = Array.from(yearMap.entries())
    .map(([key, wsList]) => {
      const trades = wsList.flatMap(ws => ws.trades);
      return { yearIndex: key === "active" ? null : key as number, label: key === "active" ? "Active" : `Year ${toRoman(key as number)}`, ...computeStats(trades) };
    })
    .sort((a, b) => {
      if (a.yearIndex == null) return 1;
      if (b.yearIndex == null) return -1;
      return a.yearIndex - b.yearIndex;
    });

  // 3. Best / worst week (by netRR, weeks with ≥1 trade)
  const weeksWithTrades = weekStats.filter(ws => ws.totalTrades > 0);
  const bestWeek = weeksWithTrades.length > 0
    ? (() => { const b = weeksWithTrades.reduce((a, c) => c.netRR >= a.netRR ? c : a); return { weekId: b.week.id, weekLabel: b.week.label, netRR: b.netRR, startDate: b.week.startDate }; })()
    : null;
  const worstWeek = weeksWithTrades.length > 0
    ? (() => { const w = weeksWithTrades.reduce((a, c) => c.netRR <= a.netRR ? c : a); return { weekId: w.week.id, weekLabel: w.week.label, netRR: w.netRR, startDate: w.week.startDate }; })()
    : null;

  // 4. Best / worst month
  const monthMap = new Map<number, typeof weekStats>();
  for (const ws of weekStats) {
    if (ws.week.monthIndex == null) continue;
    if (!monthMap.has(ws.week.monthIndex)) monthMap.set(ws.week.monthIndex, []);
    monthMap.get(ws.week.monthIndex)!.push(ws);
  }
  const monthStatsList = Array.from(monthMap.entries()).map(([mi, wsList]) => {
    const trades = wsList.flatMap(ws => ws.trades);
    const label = wsList[0]!.week.monthLabel || `Month ${monthInYearFromMonthIndex(mi)} (Y-${toRoman(yearIndexFromMonthIndex(mi))})`;
    return { monthIndex: mi, label, ...computeStats(trades) };
  });
  const bestMonth = monthStatsList.length > 0
    ? (() => { const b = monthStatsList.reduce((a, c) => c.netRR >= a.netRR ? c : a); return { monthIndex: b.monthIndex, label: b.label, netRR: b.netRR }; })()
    : null;
  const worstMonth = monthStatsList.length > 0
    ? (() => { const w = monthStatsList.reduce((a, c) => c.netRR <= a.netRR ? c : a); return { monthIndex: w.monthIndex, label: w.label, netRR: w.netRR }; })()
    : null;

  // 5. Average RRR per trade — by month and by year
  const avgRRRByMonth = Array.from(monthMap.entries())
    .map(([mi, wsList]) => {
      const trades = wsList.flatMap(ws => ws.trades);
      const label = wsList[0]!.week.monthLabel || `Month ${monthInYearFromMonthIndex(mi)} (Y-${toRoman(yearIndexFromMonthIndex(mi))})`;
      const avgRRR = trades.length > 0 ? Math.round((trades.reduce((s: number, t: { rrr: number }) => s + t.rrr, 0) / trades.length) * 100) / 100 : 0;
      return { monthIndex: mi, label, avgRRR, tradeCount: trades.length };
    })
    .sort((a, b) => a.monthIndex - b.monthIndex);

  const yearRRRMap = new Map<number, { trades: typeof allTrades; label: string }>();
  for (const ws of weekStats) {
    if (ws.week.monthIndex == null) continue;
    const yi = yearIndexFromMonthIndex(ws.week.monthIndex);
    if (!yearRRRMap.has(yi)) yearRRRMap.set(yi, { trades: [], label: `Year ${toRoman(yi)}` });
    yearRRRMap.get(yi)!.trades.push(...ws.trades);
  }
  const avgRRRByYear = Array.from(yearRRRMap.entries())
    .map(([yi, { trades, label }]) => {
      const avgRRR = trades.length > 0 ? Math.round((trades.reduce((s, t) => s + t.rrr, 0) / trades.length) * 100) / 100 : 0;
      return { yearIndex: yi, label, avgRRR, tradeCount: trades.length };
    })
    .sort((a, b) => a.yearIndex - b.yearIndex);

  // 6. Drawdown & Recovery (week-level cumulative net RR)
  const weekCumRR: number[] = [];
  let cumRR = 0, peak = 0, maxDD = 0, maxDDWeekLabel: string | null = null;
  let troughIdx = -1, peakCumRRAtMaxDD = 0;
  for (let i = 0; i < weekStats.length; i++) {
    cumRR = Math.round((cumRR + weekStats[i]!.netRR) * 100) / 100;
    weekCumRR.push(cumRR);
    if (cumRR > peak) peak = cumRR;
    const dd = Math.round((peak - cumRR) * 100) / 100;
    if (dd > maxDD) { maxDD = dd; maxDDWeekLabel = weekStats[i]!.week.label; troughIdx = i; peakCumRRAtMaxDD = peak; }
  }
  let recoveryWeeks: number | null = null;
  if (troughIdx >= 0) {
    for (let i = troughIdx + 1; i < weekCumRR.length; i++) {
      if (weekCumRR[i]! >= peakCumRRAtMaxDD) { recoveryWeeks = i - troughIdx; break; }
    }
  }

  // 7. Longest trade-level losing/BE streak (consecutive non-Win trades)
  const orderedTrades = weekStats.flatMap(ws => ws.trades.map(t => ({ ...t, weekLabel: ws.week.label })));
  let longestTradeStreak = 0, curTradeStreak = 0;
  let longestTradeStreakStart: string | null = null, longestTradeStreakEnd: string | null = null;
  let curTradeStreakStart: string | null = null;
  for (const t of orderedTrades) {
    if (t.result !== "Win") {
      curTradeStreak++;
      if (curTradeStreakStart == null) curTradeStreakStart = t.weekLabel;
      if (curTradeStreak > longestTradeStreak) { longestTradeStreak = curTradeStreak; longestTradeStreakStart = curTradeStreakStart; longestTradeStreakEnd = t.weekLabel; }
    } else { curTradeStreak = 0; curTradeStreakStart = null; }
  }

  // 8. Longest week-level no-win streak (weeks with trades but 0 wins)
  let longestWeekStreak = 0, curWeekStreak = 0;
  let longestWeekStreakStart: string | null = null, longestWeekStreakEnd: string | null = null;
  let curWeekStreakStart: string | null = null;
  for (const ws of weekStats) {
    if (ws.totalTrades > 0 && ws.wins === 0) {
      curWeekStreak++;
      if (curWeekStreakStart == null) curWeekStreakStart = ws.week.label;
      if (curWeekStreak > longestWeekStreak) { longestWeekStreak = curWeekStreak; longestWeekStreakStart = curWeekStreakStart; longestWeekStreakEnd = ws.week.label; }
    } else { curWeekStreak = 0; curWeekStreakStart = null; }
  }

  // 9. Consistency
  const weeksWithTradesCount = weekStats.filter(ws => ws.totalTrades > 0).length;
  const totalWeeks = weekStats.length;
  const consistency = {
    weeksWithTrades: weeksWithTradesCount,
    totalWeeks,
    rate: totalWeeks > 0 ? Math.round((weeksWithTradesCount / totalWeeks) * 10000) / 100 : 0,
  };

  // 10. Cumulative growth series
  cumRR = 0;
  const cumulativeWeekly = weekStats.map(ws => {
    cumRR = Math.round((cumRR + ws.netRR) * 100) / 100;
    return { weekId: ws.week.id, weekLabel: ws.week.label, startDate: ws.week.startDate, netRR: ws.netRR, cumulativeRR: cumRR };
  });

  cumRR = 0;
  const cumulativeMonthly = [...monthStatsList]
    .sort((a, b) => a.monthIndex - b.monthIndex)
    .map(ms => {
      cumRR = Math.round((cumRR + ms.netRR) * 100) / 100;
      return { monthIndex: ms.monthIndex, label: ms.label, netRR: ms.netRR, cumulativeRR: cumRR };
    });

  res.json({
    allTime,
    byYear,
    bestWeek,
    worstWeek,
    bestMonth,
    worstMonth,
    avgRRRByMonth,
    avgRRRByYear,
    longestTradeStreak: longestTradeStreak > 0 ? { length: longestTradeStreak, startWeekLabel: longestTradeStreakStart, endWeekLabel: longestTradeStreakEnd } : null,
    longestWeekStreak: longestWeekStreak > 0 ? { length: longestWeekStreak, startWeekLabel: longestWeekStreakStart, endWeekLabel: longestWeekStreakEnd } : null,
    maxDrawdown: maxDD,
    maxDrawdownWeekLabel: maxDDWeekLabel,
    recoveryWeeks,
    consistency,
    cumulativeWeekly,
    cumulativeMonthly,
  });
});

export default router;
