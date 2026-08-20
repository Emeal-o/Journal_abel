import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calculator,
  ChevronDown,
  DollarSign,
  Info,
} from "lucide-react";
import type { Trade, Week } from "@workspace/api-client-react";
import { listTrades } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { listArchivedWeeks, type ArchivedWeek } from "@/lib/weeks-api";
import { yearIndexFromMonthIndex, toRoman } from "@/lib/label-utils";

type PeriodKey = "this-week" | "last-week" | "this-month" | "last-month" | "last-6-months" | "year" | "all-time";

const PERIOD_OPTIONS: Array<{ value: PeriodKey; label: string }> = [
  { value: "this-week", label: "This Week" },
  { value: "last-week", label: "Last Week" },
  { value: "this-month", label: "This Month" },
  { value: "last-month", label: "Last Month" },
  { value: "last-6-months", label: "Last 6 Months" },
  { value: "year", label: "Year" },
  { value: "all-time", label: "All-Time" },
];

type WeekLike = Week | ArchivedWeek;
type TradeMap = Map<number, Trade[]>;

function weekDateValue(week: WeekLike): string {
  return week.startDate;
}

function sortWeeks(weeks: WeekLike[]): WeekLike[] {
  return [...weeks].sort((a, b) => weekDateValue(b).localeCompare(weekDateValue(a)) || b.id - a.id);
}

function tradeRR(trade: Trade): number {
  if (trade.result === "Win") return Number(trade.rrr) || 0;
  if (trade.result === "Loss") return -1;
  return 0;
}

function formatMoney(value: number): string {
  const absolute = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${value < 0 ? "-" : "+"}$${absolute}`;
}

export function RRCalculator({ activeWeeks }: { activeWeeks: Week[] }) {
  const [open, setOpen] = useState(false);
  const [riskInput, setRiskInput] = useState("100");
  const [period, setPeriod] = useState<PeriodKey>("all-time");
  const [selectedYearIndex, setSelectedYearIndex] = useState<number | null>(null);

  const { data: archivedWeeks = [] } = useQuery({
    queryKey: ["rr-calculator-archived-weeks"],
    queryFn: listArchivedWeeks,
  });

  const allWeeks = useMemo(() => {
    const byId = new Map<number, WeekLike>();
    [...activeWeeks, ...archivedWeeks].forEach((week) => byId.set(week.id, week));
    return Array.from(byId.values());
  }, [activeWeeks, archivedWeeks]);

  const weekIds = useMemo(() => allWeeks.map((week) => week.id).sort((a, b) => a - b), [allWeeks]);
  const { data: tradeLists = [], isLoading: tradesLoading } = useQuery({
    queryKey: ["rr-calculator-trades", weekIds],
    queryFn: () => Promise.all(weekIds.map((weekId) => listTrades({ weekId }))),
    enabled: weekIds.length > 0,
  });

  const tradesByWeek = useMemo<TradeMap>(() => {
    const map = new Map<number, Trade[]>();
    weekIds.forEach((weekId, index) => map.set(weekId, tradeLists[index] ?? []));
    return map;
  }, [tradeLists, weekIds]);

  const sortedActiveWeeks = useMemo(() => sortWeeks(activeWeeks), [activeWeeks]);
  const sortedAllWeeks = useMemo(() => sortWeeks(allWeeks), [allWeeks]);
  const currentWeek = sortedActiveWeeks[0];
  const lastWeek = currentWeek
    ? sortedAllWeeks[sortedAllWeeks.findIndex((week) => week.id === currentWeek.id) + 1]
    : sortedAllWeeks[0];

  const archivedMonthIndexes = useMemo(
    () => Array.from(new Set(archivedWeeks.map((week) => week.monthIndex).filter((index): index is number => index != null))).sort((a, b) => b - a),
    [archivedWeeks],
  );
  const currentMonthIndex = archivedMonthIndexes.length > 0 ? archivedMonthIndexes[0]! + 1 : 1;
  const currentMonthWeeks = activeWeeks;
  const monthWeeks = useMemo(() => {
    const groups = new Map<number, WeekLike[]>();
    archivedWeeks.forEach((week) => {
      if (week.monthIndex != null) {
        const existing = groups.get(week.monthIndex) ?? [];
        existing.push(week);
        groups.set(week.monthIndex, existing);
      }
    });
    if (currentMonthWeeks.length > 0) groups.set(currentMonthIndex, currentMonthWeeks);
    return groups;
  }, [archivedWeeks, currentMonthIndex, currentMonthWeeks]);

  const currentMonthHasTrades = currentMonthWeeks.some((week) => (tradesByWeek.get(week.id)?.length ?? 0) > 0);
  const numericYearIndexes = useMemo(() => {
    const indexes = new Set<number>();
    monthWeeks.forEach((weeks, monthIndex) => {
      if (weeks.length > 0) indexes.add(yearIndexFromMonthIndex(monthIndex));
    });
    return Array.from(indexes).sort((a, b) => b - a);
  }, [monthWeeks]);
  const effectiveYearIndex = selectedYearIndex ?? numericYearIndexes[0] ?? null;

  const selectedWeeks = useMemo(() => {
    if (period === "this-week") return currentWeek ? [currentWeek] : [];
    if (period === "last-week") return lastWeek ? [lastWeek] : [];
    if (period === "this-month") return monthWeeks.get(currentMonthIndex) ?? [];
    if (period === "last-month") {
      const lastMonthIndex = archivedMonthIndexes[0];
      return lastMonthIndex == null ? [] : monthWeeks.get(lastMonthIndex) ?? [];
    }
    if (period === "last-6-months") {
      const indexes = currentMonthHasTrades
        ? [currentMonthIndex, ...archivedMonthIndexes].slice(0, 6)
        : archivedMonthIndexes.slice(0, 6);
      return indexes.flatMap((index) => monthWeeks.get(index) ?? []);
    }
    if (period === "year") {
      if (effectiveYearIndex == null) return [];
      return Array.from(monthWeeks.entries())
        .filter(([monthIndex]) => yearIndexFromMonthIndex(monthIndex) === effectiveYearIndex)
        .flatMap(([, weeks]) => weeks);
    }
    return allWeeks;
  }, [
    period,
    currentWeek,
    lastWeek,
    monthWeeks,
    currentMonthIndex,
    archivedMonthIndexes,
    currentMonthHasTrades,
    effectiveYearIndex,
    allWeeks,
  ]);

  const selectedTrades = selectedWeeks.flatMap((week) => tradesByWeek.get(week.id) ?? []);
  const rrTotal = selectedTrades.reduce((sum, trade) => sum + tradeRR(trade), 0);
  const riskAmount = Math.max(0, Number.parseFloat(riskInput) || 0);
  const result = rrTotal * riskAmount;
  const yearOptions = numericYearIndexes.length > 1
    ? numericYearIndexes.map((index) => ({ value: index, label: `Year ${toRoman(index)}` }))
    : [];

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        aria-label="Open What-If Risk Calculator"
        title="What-If Risk Calculator"
        onClick={() => setOpen(true)}
        className="w-9 px-0 border-white/10 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white"
      >
        <Calculator className="w-4 h-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[460px] bg-background border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-primary" />
              What-If Risk Calculator
            </DialogTitle>
          </DialogHeader>

          <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-100/80 flex gap-2">
            <Info className="w-4 h-4 flex-shrink-0 text-amber-300" />
            <span>Hypothetical — based on your actual RR history. Not a projection or guarantee.</span>
          </div>

          <div className="space-y-2">
            <label htmlFor="rr-risk-per-trade" className="text-sm font-medium text-white">Risk per trade</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="rr-risk-per-trade"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={riskInput}
                onChange={(event) => setRiskInput(event.target.value)}
                className="pl-9 bg-white/5 border-white/10"
              />
            </div>
            <div className="flex gap-2">
              {[25, 50, 100].map((preset) => (
                <Button key={preset} type="button" variant="outline" size="sm" onClick={() => setRiskInput(String(preset))} className="border-white/10 bg-white/5">
                  ${preset}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="rr-period" className="text-sm font-medium text-white">Period</label>
            <div className="relative">
              <select
                id="rr-period"
                value={period}
                onChange={(event) => setPeriod(event.target.value as PeriodKey)}
                className="h-9 w-full appearance-none rounded-md border border-white/10 bg-white/5 px-3 pr-9 text-sm text-white outline-none focus:ring-2 focus:ring-primary"
              >
                {PERIOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} className="bg-background">
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            </div>
            {period === "year" && yearOptions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {yearOptions.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={effectiveYearIndex === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedYearIndex(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-center">
            <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground/70">
              {PERIOD_OPTIONS.find((option) => option.value === period)?.label}
              {period === "year" && yearOptions.length === 1 ? " · Year" : ""}
            </div>
            {tradesLoading && allWeeks.length > 0 ? (
              <div className="mt-2 text-sm text-muted-foreground">Loading trade history…</div>
            ) : selectedTrades.length === 0 ? (
              <div className="mt-2 text-xl font-semibold text-muted-foreground">No trades yet — $0</div>
            ) : (
              <>
                <div className={`mt-2 text-4xl font-bold font-mono ${result > 0 ? "text-emerald-400" : result < 0 ? "text-rose-400" : "text-slate-400"}`}>
                  {formatMoney(result)}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {selectedTrades.length} trade{selectedTrades.length !== 1 ? "s" : ""} · {rrTotal >= 0 ? "+" : ""}{rrTotal.toFixed(2)}R × ${riskAmount.toFixed(2)}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}