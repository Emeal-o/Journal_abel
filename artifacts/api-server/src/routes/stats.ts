import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, tradesTable, weeksTable, setupTypesTable, type Week } from "@workspace/db";
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
type AnalysisTrade = { id: number; weekId: number; result: string; rrr: number; pips: number; createdAt: Date; setupTypeId: number | null };
type WeekStatEntry = { week: Week; trades: AnalysisTrade[]; totalTrades: number; wins: number; losses: number; breakEvens: number; winRate: number; netRR: number; netPips: number };

// GET /api/stats/analysis — rich analytics for the authenticated user.
// Optional query param: ?year=<number> — scopes all calculations to that year only.
router.get("/stats/analysis", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const yearFilter = req.query.year != null ? parseInt(req.query.year as string, 10) : null;

  // All weeks (active + archived) in chronological order for this user
  const allWeeksRaw = await db
    .select()
    .from(weeksTable)
    .where(eq(weeksTable.userId, userId))
    .orderBy(weeksTable.createdAt);

  // Apply year filter: keep only weeks whose monthIndex falls in the requested year
  const weeks = yearFilter != null
    ? allWeeksRaw.filter((w: Week) => w.monthIndex != null && yearIndexFromMonthIndex(w.monthIndex) === yearFilter)
    : allWeeksRaw;

  const scopedWeekIds = new Set(weeks.map((w: Week) => w.id));

  // All trades in chronological order, scoped to the same user (+ year if filtered)
  const allTradesRaw: AnalysisTrade[] = await db
    .select({ id: tradesTable.id, weekId: tradesTable.weekId, result: tradesTable.result, rrr: tradesTable.rrr, pips: tradesTable.pips, createdAt: tradesTable.createdAt, setupTypeId: tradesTable.setupTypeId })
    .from(tradesTable)
    .where(eq(tradesTable.userId, userId))
    .orderBy(tradesTable.createdAt);

  const allTrades: AnalysisTrade[] = yearFilter != null
    ? allTradesRaw.filter((t: AnalysisTrade) => scopedWeekIds.has(t.weekId))
    : allTradesRaw;

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

  // 11. RRR distribution histogram — counts trades per RRR bucket.
  // Uses allTrades (already year-filtered when ?year= is set) so scoping
  // is inherited from the existing year filter above — no extra logic needed.
  const RRR_BUCKETS: Array<{ label: string; min: number; max: number | null }> = [
    { label: "0–5",   min: 0,  max: 5  },
    { label: "5–10",  min: 5,  max: 10 },
    { label: "10–15", min: 10, max: 15 },
    { label: "15–20", min: 15, max: 20 },
    { label: "20+",   min: 20, max: null },
  ];

  // Build a quick lookup so each bucket trade row can include week label + start date
  const weekById = new Map<number, { label: string; startDate: string }>();
  for (const w of weeks) weekById.set(w.id, { label: w.label, startDate: w.startDate });

  const rrrDistribution = RRR_BUCKETS.map(b => {
    const bucketTrades = allTrades
      .filter(t => t.rrr >= b.min && (b.max === null || t.rrr < b.max))
      .map(t => {
        const wk = weekById.get(t.weekId);
        return {
          id: t.id,
          result: t.result,
          rrr: t.rrr,
          pips: t.pips,
          weekId: t.weekId,
          weekLabel: wk?.label ?? null,
          weekStartDate: wk?.startDate ?? null,
        };
      });
    return { label: b.label, min: b.min, max: b.max, count: bucketTrades.length, trades: bucketTrades };
  });

  // 11. By Setup Type — group all scoped trades by setupTypeId, compute stats per group.
  //     Joins with setup_types (active + inactive) for name/color/description.
  //     Untagged trades (setupTypeId IS NULL) are grouped last.
  const allSetupTypesForUser = await db
    .select({
      id: setupTypesTable.id,
      name: setupTypesTable.name,
      color: setupTypesTable.color,
      description: setupTypesTable.description,
    })
    .from(setupTypesTable)
    .where(eq(setupTypesTable.userId, userId));
  const setupTypeById = new Map(allSetupTypesForUser.map(st => [st.id, st]));

  const setupGroupMap = new Map<number | null, AnalysisTrade[]>();
  for (const t of allTrades) {
    const key = t.setupTypeId ?? null;
    if (!setupGroupMap.has(key)) setupGroupMap.set(key, []);
    setupGroupMap.get(key)!.push(t);
  }

  const bySetupType = Array.from(setupGroupMap.entries())
    .filter(([, trades]) => trades.length > 0)
    .map(([setupTypeId, trades]) => {
      const st = setupTypeId != null ? setupTypeById.get(setupTypeId) : null;
      const stats = computeStats(trades);
      const tradeRows = trades.map(t => {
        const wk = weekById.get(t.weekId);
        return {
          id: t.id,
          result: t.result,
          rrr: t.rrr,
          pips: t.pips,
          weekId: t.weekId,
          weekLabel: wk?.label ?? null,
          weekStartDate: wk?.startDate ?? null,
        };
      });
      return {
        setupTypeId,
        name: st?.name ?? "Untagged",
        color: st?.color ?? null,
        description: st?.description ?? null,
        winRate: stats.winRate,
        netRR: stats.netRR,
        totalTrades: stats.totalTrades,
        trades: tradeRows,
      };
    })
    .sort((a, b) => {
      if (a.setupTypeId === null && b.setupTypeId !== null) return 1;
      if (a.setupTypeId !== null && b.setupTypeId === null) return -1;
      return b.totalTrades - a.totalTrades;
    });

  // 12. Post-Loss Performance ("Tilt Report") — buckets each trade by how many
  //     consecutive losses immediately preceded it, using trade ORDER (the
  //     same orderedTrades array used for the existing streak calc above) —
  //     not calendar dates — so backfilled trades never distort the bucket.
  const TILT_LABELS: Record<number, string> = {
    0: "After 0 losses (fresh)",
    1: "After 1 loss",
    2: "After 2 losses",
    3: "After 3+ losses",
  };
  const tiltGroups = new Map<number, AnalysisTrade[]>([[0, []], [1, []], [2, []], [3, []]]);
  let precedingLossStreak = 0;
  for (const t of orderedTrades) {
    const bucketKey = Math.min(precedingLossStreak, 3);
    tiltGroups.get(bucketKey)!.push(t);
    precedingLossStreak = t.result === "Loss" ? precedingLossStreak + 1 : 0;
  }
  const postLossPerformance = [0, 1, 2, 3].map(afterLosses => {
    const bucketTrades = tiltGroups.get(afterLosses)!;
    const stats = computeStats(bucketTrades);
    const tradeRows = bucketTrades.map(t => {
      const wk = weekById.get(t.weekId);
      return {
        id: t.id,
        result: t.result,
        rrr: t.rrr,
        pips: t.pips,
        weekId: t.weekId,
        weekLabel: wk?.label ?? null,
        weekStartDate: wk?.startDate ?? null,
      };
    });
    return { afterLosses, label: TILT_LABELS[afterLosses]!, ...stats, trades: tradeRows };
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
    rrrDistribution,
    bySetupType,
    postLossPerformance,
  });
});

// GET /api/stats/streak — current consecutive streak for the authenticated user.
// Looks at all trades in chronological order and counts how many of the most
// recent trades share the same result. Returns { result, length } or
// { result: null, length: 0 } when the user has no trades.
router.get("/stats/streak", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const trades = await db
    .select({ result: tradesTable.result })
    .from(tradesTable)
    .where(eq(tradesTable.userId, userId))
    .orderBy(tradesTable.createdAt);

  if (trades.length === 0) {
    res.json({ result: null, length: 0 });
    return;
  }

  const lastResult = trades[trades.length - 1]!.result;
  let length = 0;
  for (let i = trades.length - 1; i >= 0; i--) {
    if (trades[i]!.result === lastResult) length++;
    else break;
  }
  res.json({ result: lastResult, length });
});

export default router;
