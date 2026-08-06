import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Trader-calibrated 6-tier win-rate color scale shared across the Analysis page.
 * Boundaries reflect trading reality: 40-50% is a profitable baseline for
 * high-R:R strategies, unlike academic grading where 50% is "failing".
 *
 * Used by: By Direction rings, By Setup Type table, All-Time Summary card,
 * Year by Year table, Post-Loss Performance table, BucketTradesModal mini-stats.
 */
export function getWinRateColor(rate: number): string {
  if (rate < 25) return "#EF4444"; // Crimson Red     — Edge breakdown / heavy drawdown
  if (rate < 40) return "#F97316"; // Amber Orange    — Requires high R:R to stay profitable
  if (rate < 50) return "#84CC16"; // Lime Green      — Profitable baseline (classic trend-following zone)
  if (rate < 65) return "#10B981"; // Emerald Green   — High efficiency
  if (rate < 80) return "#A855F7"; // Amethyst Violet — Elite consistency
  return "#06B6D4";                // Cyan Diamond    — Statistical outlier / S-tier
}
