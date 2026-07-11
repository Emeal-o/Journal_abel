/**
 * Utilities for computing auto-suggested Stats card labels from the
 * user's archived month count.
 *
 * System: 13 archived months = 1 Year. The stats card labels reflect
 * the most recently archived month, not the current active one.
 *
 * Edge case: 0 months archived → treated as month 1 of year 1.
 */

const ROMAN_TABLE: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100,  "C"], [90,  "XC"], [50,  "L"], [40,  "XL"],
  [10,   "X"], [9,   "IX"], [5,   "V"], [4,   "IV"],
  [1,    "I"],
];

/** Converts a positive integer to an uppercase Roman numeral string. */
export function toRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1) return "I";
  let result = "";
  let remaining = n;
  for (const [value, numeral] of ROMAN_TABLE) {
    while (remaining >= value) {
      result += numeral;
      remaining -= value;
    }
  }
  return result;
}

export interface CardLabelSuggestion {
  /** e.g. "Month 6" */
  suggestedMonth: string;
  /** e.g. "Y-I" */
  suggestedTag: string;
}

/**
 * Derives auto-suggested card labels from the count of months archived so far.
 *
 * @param totalMonths  Number of distinct months already archived (≥ 0).
 *
 * With 13-month years:
 *   totalMonths 0  → Month 1, Y-I   (nothing archived yet — user is in month 1)
 *   totalMonths 6  → Month 6, Y-I
 *   totalMonths 13 → Month 13, Y-I
 *   totalMonths 14 → Month 1,  Y-II
 */
export function computeCardLabels(totalMonths: number): CardLabelSuggestion {
  // Treat 0 archived months the same as 1 for label purposes.
  const n = Math.max(1, Math.floor(totalMonths));
  const yearIndex    = Math.ceil(n / 13);
  const monthInYear  = ((n - 1) % 13) + 1;
  return {
    suggestedMonth: `Month ${monthInYear}`,
    suggestedTag:   `Y-${toRoman(yearIndex)}`,
  };
}
