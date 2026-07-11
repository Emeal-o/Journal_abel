/**
 * Utilities for deriving Year / Month-in-Year labels from a week's absolute
 * `monthIndex` (1, 2, 3... forever, assigned once at archive time — see
 * lib/db/src/schema/weeks.ts). This is the single source of truth used by
 * the Archive page, the "Start New Month" dialog, and the Stats page, so
 * all three stay in sync.
 *
 * System: 13 months = 1 Year, then month-in-year rolls back to 1 and the
 * year increments (displayed as a Roman numeral).
 *
 * Edge case: monthIndex < 1 is clamped to 1.
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

/** Year number (1-based) for an absolute monthIndex, with 13 months per year. */
export function yearIndexFromMonthIndex(monthIndex: number): number {
  const n = Math.max(1, Math.floor(monthIndex));
  return Math.ceil(n / 13);
}

/** Month-in-year (1–13) for an absolute monthIndex, rolling over every 13. */
export function monthInYearFromMonthIndex(monthIndex: number): number {
  const n = Math.max(1, Math.floor(monthIndex));
  return ((n - 1) % 13) + 1;
}

/**
 * Derives auto-suggested card labels from an absolute monthIndex.
 *
 * @param monthIndex  The 1-based, never-resetting index of the
 *                     current/upcoming month (i.e. max archived monthIndex + 1
 *                     — once a month is archived, the user has moved on to
 *                     the next one).
 *
 * With 13-month years:
 *   monthIndex 1  → Month 1, Y-I   (nothing archived yet — user is in month 1)
 *   monthIndex 6  → Month 6, Y-I
 *   monthIndex 13 → Month 13, Y-I
 *   monthIndex 14 → Month 1,  Y-II
 */
export function computeCardLabels(monthIndex: number): CardLabelSuggestion {
  return {
    suggestedMonth: `Month ${monthInYearFromMonthIndex(monthIndex)}`,
    suggestedTag:   `Y-${toRoman(yearIndexFromMonthIndex(monthIndex))}`,
  };
}
