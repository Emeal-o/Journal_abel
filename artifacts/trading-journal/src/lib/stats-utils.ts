import type { WeekStats, StatsSummary } from "@workspace/api-client-react";

/**
 * Aggregates a set of per-week stats into a single summary — mirrors the
 * backend's computeStats() rounding rules (see artifacts/api-server/src/routes/stats.ts),
 * so client-side aggregation over a subset of weeks (e.g. one archived
 * month or one Year) always matches what the server would compute for that
 * same subset.
 */
export function aggregateWeekStats(stats: WeekStats[]): StatsSummary {
  const totalTrades = stats.reduce((s, w) => s + w.totalTrades, 0);
  const wins        = stats.reduce((s, w) => s + w.wins, 0);
  const losses      = stats.reduce((s, w) => s + w.losses, 0);
  const breakEvens  = stats.reduce((s, w) => s + w.breakEvens, 0);
  const winRate     = totalTrades > 0 ? Math.round((wins / totalTrades) * 10000) / 100 : 0;
  const netRR       = Math.round(stats.reduce((s, w) => s + w.netRR, 0) * 100) / 100;
  const netPips     = Math.round(stats.reduce((s, w) => s + w.netPips, 0) * 10) / 10;
  return { totalTrades, wins, losses, breakEvens, winRate, netRR, netPips };
}
