export const ANALYSIS_SECTION_ORDER = [
  "calendar",
  "cumulativeGrowth",
  "yearByYear",
  "bestWorstPerformance",
  "averageRRR",
  "rrrDistribution",
  "bySetupType",
  "postLossPerformance",
  "drawdownRecovery",
  "consistency",
  "byDirection",
] as const;

export type AnalysisSectionId = (typeof ANALYSIS_SECTION_ORDER)[number];

export const ANALYSIS_SECTION_LABELS: Record<AnalysisSectionId, string> = {
  calendar: "Trading Calendar",
  cumulativeGrowth: "Cumulative Growth",
  yearByYear: "Year by Year",
  bestWorstPerformance: "Best & Worst Performance",
  averageRRR: "Average RRR per Trade",
  rrrDistribution: "RRR Distribution",
  bySetupType: "By Setup Type",
  postLossPerformance: "Post-Loss Performance",
  drawdownRecovery: "Drawdown & Recovery",
  consistency: "Consistency",
  byDirection: "By Direction",
};