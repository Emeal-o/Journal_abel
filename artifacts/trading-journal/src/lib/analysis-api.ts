/**
 * Fetch wrapper and React Query hook for the /api/stats/analysis endpoint.
 * Not generated from the OpenAPI spec — kept here alongside the other
 * hand-written archive API wrappers in weeks-api.ts.
 */
import { useQuery } from "@tanstack/react-query";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ?? "";

async function analysisFetch(path: string): Promise<Response> {
  return fetch(`${API_BASE}${path}`, { credentials: "include" });
}

// ─── types ────────────────────────────────────────────────────────────────────

export interface AnalysisSummary {
  totalTrades: number;
  wins: number;
  losses: number;
  breakEvens: number;
  winRate: number;
  netRR: number;
  netPips: number;
}

export interface AnalysisYearStats extends AnalysisSummary {
  yearIndex: number | null;
  label: string;
}

export interface AnalysisWeekRef {
  weekId: number;
  weekLabel: string;
  netRR: number;
  startDate: string;
}

export interface AnalysisMonthRef {
  monthIndex: number;
  label: string;
  netRR: number;
}

export interface AnalysisRRRPoint {
  label: string;
  avgRRR: number;
  tradeCount: number;
  monthIndex?: number;
  yearIndex?: number;
}

export interface AnalysisCumulativePoint {
  label: string;
  netRR: number;
  cumulativeRR: number;
  weekId?: number;
  weekLabel?: string;
  monthIndex?: number;
  startDate?: string;
}

export interface AnalysisStreak {
  length: number;
  startWeekLabel: string | null;
  endWeekLabel: string | null;
}

export interface AnalysisData {
  allTime: AnalysisSummary;
  byYear: AnalysisYearStats[];
  bestWeek: AnalysisWeekRef | null;
  worstWeek: AnalysisWeekRef | null;
  bestMonth: AnalysisMonthRef | null;
  worstMonth: AnalysisMonthRef | null;
  avgRRRByMonth: AnalysisRRRPoint[];
  avgRRRByYear: AnalysisRRRPoint[];
  longestTradeStreak: AnalysisStreak | null;
  longestWeekStreak: AnalysisStreak | null;
  maxDrawdown: number;
  maxDrawdownWeekLabel: string | null;
  recoveryWeeks: number | null;
  consistency: { weeksWithTrades: number; totalWeeks: number; rate: number };
  cumulativeWeekly: AnalysisCumulativePoint[];
  cumulativeMonthly: AnalysisCumulativePoint[];
}

// ─── fetch + hook ─────────────────────────────────────────────────────────────

export async function fetchAnalysis(): Promise<AnalysisData> {
  const res = await analysisFetch("/api/stats/analysis");
  if (!res.ok) throw new Error("Failed to load analysis data.");
  return res.json() as Promise<AnalysisData>;
}

export const ANALYSIS_QUERY_KEY = ["stats-analysis"] as const;

export function useAnalysis() {
  return useQuery({
    queryKey: ANALYSIS_QUERY_KEY,
    queryFn: fetchAnalysis,
  });
}
