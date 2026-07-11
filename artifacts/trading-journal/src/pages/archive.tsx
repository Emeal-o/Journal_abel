import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Archive } from "lucide-react";
import type { Week } from "@workspace/api-client-react";

import { WeekCard } from "@/components/week-card";
import { Skeleton } from "@/components/ui/skeleton";
import { listArchivedWeeks, type ArchivedWeek } from "@/lib/weeks-api";
import { yearIndexFromMonthIndex, monthInYearFromMonthIndex, toRoman } from "@/lib/label-utils";

// ─── helpers ──────────────────────────────────────────────────────────────────

interface MonthGroupData {
  /** Absolute month_index for this group, or null for legacy/uncategorised weeks. */
  monthIndex: number | null;
  label: string;
  weeks: ArchivedWeek[];
}

interface YearGroupData {
  /** Roman-numeral-ready year index (1, 2, 3...), or null for uncategorised weeks. */
  yearIndex: number | null;
  months: MonthGroupData[];
}

/**
 * Groups archived weeks by month_index first (the single source of truth —
 * see label-utils.ts), then buckets those month groups by year via
 * yearIndexFromMonthIndex. Weeks with no month_index (legacy data archived
 * before this field existed) fall into an "Uncategorised" bucket so nothing
 * is silently dropped.
 *
 * Sort order: most recent Year on top; within a Year, most recent Month on
 * top. Uncategorised sorts last.
 */
function groupByYearAndMonth(weeks: ArchivedWeek[]): YearGroupData[] {
  const monthMap = new Map<number | "none", ArchivedWeek[]>();
  for (const w of weeks) {
    const key = w.monthIndex ?? "none";
    if (!monthMap.has(key)) monthMap.set(key, []);
    monthMap.get(key)!.push(w);
  }

  const monthGroups: MonthGroupData[] = Array.from(monthMap.entries()).map(([key, ws]) => ({
    monthIndex: key === "none" ? null : key,
    label: ws[0]!.monthLabel || (key === "none" ? "Uncategorised" : `Month ${monthInYearFromMonthIndex(key as number)}`),
    weeks: ws,
  }));

  const yearMap = new Map<number | "none", MonthGroupData[]>();
  for (const mg of monthGroups) {
    const yearKey = mg.monthIndex != null ? yearIndexFromMonthIndex(mg.monthIndex) : "none";
    if (!yearMap.has(yearKey)) yearMap.set(yearKey, []);
    yearMap.get(yearKey)!.push(mg);
  }

  const yearGroups: YearGroupData[] = Array.from(yearMap.entries()).map(([yearKey, months]) => ({
    yearIndex: yearKey === "none" ? null : yearKey,
    months: months.sort((a, b) => (b.monthIndex ?? 0) - (a.monthIndex ?? 0)),
  }));

  yearGroups.sort((a, b) => {
    if (a.yearIndex == null) return 1;
    if (b.yearIndex == null) return -1;
    return b.yearIndex - a.yearIndex;
  });

  return yearGroups;
}

// ─── month group ──────────────────────────────────────────────────────────────

function MonthGroup({ label, weeks }: { label: string; weeks: ArchivedWeek[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          {open
            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
            : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <span className="text-white font-semibold text-lg">{label}</span>
          <span className="text-xs text-muted-foreground/60 font-normal">
            {weeks.length} week{weeks.length !== 1 ? "s" : ""}
          </span>
        </div>
      </button>

      {open && (
        <div className="p-4 space-y-4 border-t border-white/5">
          {weeks.map((w) => (
            <WeekCard
              key={w.id}
              // ArchivedWeek is a superset of the Week shape — safe to cast
              week={w as unknown as Week}
              readOnly
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── year section ─────────────────────────────────────────────────────────────

function YearSection({ yearIndex, months }: { yearIndex: number | null; months: MonthGroupData[] }) {
  const [open, setOpen] = useState(true);
  const label = yearIndex == null ? "Uncategorised" : `Year ${toRoman(yearIndex)}`;
  const totalWeeks = months.reduce((sum, m) => sum + m.weeks.length, 0);

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden bg-white/[0.01]">
      <button
        className="w-full flex items-center justify-between px-5 py-4 bg-white/[0.04] hover:bg-white/[0.06] transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          {open
            ? <ChevronDown className="w-5 h-5 text-muted-foreground" />
            : <ChevronRight className="w-5 h-5 text-muted-foreground" />}
          <span className="text-white font-bold text-xl">{label}</span>
          <span className="text-xs text-muted-foreground/60 font-normal">
            {months.length} month{months.length !== 1 ? "s" : ""} · {totalWeeks} week{totalWeeks !== 1 ? "s" : ""}
          </span>
        </div>
      </button>

      {open && (
        <div className="p-4 space-y-4 border-t border-white/5">
          {months.map((m) => (
            <MonthGroup key={m.monthIndex ?? "none"} label={m.label} weeks={m.weeks} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export function ArchivePage() {
  const { data: archivedWeeks = [], isLoading, error } = useQuery({
    queryKey: ["archived-weeks"],
    queryFn: listArchivedWeeks,
  });

  const yearGroups = groupByYearAndMonth(archivedWeeks);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Archive</h1>
        <p className="text-muted-foreground mt-1">Past months, preserved for reference.</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-14 w-full rounded-xl bg-white/5" />
          <Skeleton className="h-14 w-full rounded-xl bg-white/5" />
        </div>
      ) : error ? (
        <div className="p-8 text-center border border-destructive/20 bg-destructive/10 rounded-xl">
          <p className="text-destructive">Failed to load archive. Please try again.</p>
        </div>
      ) : yearGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 border border-dashed border-white/10 rounded-xl bg-white/5 backdrop-blur-sm">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <Archive className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-medium text-white mb-2">No archived months yet</h3>
          <p className="text-muted-foreground text-center max-w-md">
            Use "Start New Month" on the Journal page to close out your active weeks and start fresh.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {yearGroups.map((y) => (
            <YearSection key={y.yearIndex ?? "none"} yearIndex={y.yearIndex} months={y.months} />
          ))}
        </div>
      )}
    </div>
  );
}
