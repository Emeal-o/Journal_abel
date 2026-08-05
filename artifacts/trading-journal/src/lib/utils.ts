import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 6-tier win-rate color scale shared across the Analysis page.
 * Used by the By Direction radial rings and the By Setup Type table.
 */
export function getWinRateColor(rate: number): string {
  if (rate < 20) return "#EF4444"; // Crimson Red
  if (rate < 40) return "#F97316"; // Orange
  if (rate < 60) return "#EAB308"; // Gold Yellow
  if (rate < 80) return "#10B981"; // Emerald Green
  if (rate < 90) return "#A855F7"; // Amethyst Violet
  return "#06B6D4";                // Cyan Diamond
}
