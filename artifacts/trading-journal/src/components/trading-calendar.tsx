import { useEffect, useMemo, useState } from "react";
import { addMonths, differenceInCalendarDays, format, isValid, parseISO, startOfMonth } from "date-fns";
import { ArrowLeft, ArrowRight, CalendarDays, Info } from "lucide-react";
import { useListTrades, useListWeeks } from "@workspace/api-client-react";
import type { Trade, Week } from "@workspace/api-client-react";
import { useArchivedWeeks, type ArchivedWeek } from "@/lib/weeks-api";
import { getWinRateColor } from "@/lib/utils";
import {
  CALENDAR_METRIC_LABELS,
  type CalendarMetricId,
  type CalendarPeriodMode,
  useCalendarPrefs,
} from "@/hooks/use-calendar-prefs";
import { Skeleton } from "@/components/ui/skeleton";

interface PeriodStats {
  key: string;
  label: string;
  start: Date;
  isEmptyBeforeHistory: boolean;
  tradeCount: number;
  rrSum: number;
  pipsSum: number;
  winRate: number;
}

interface CalendarTrade extends Trade {
  eventDate: Date;
}

const BLOCKS_PER_PAGE = 4;

function validDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

function signed(value: number, digits = 1): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function metricValue(metric: CalendarMetricId, period: PeriodStats): string {
  switch (metric) {
    case "rrSum":
      return `${signed(period.rrSum, 2)}R`;
    case "pipsSum":
      return signed(period.pipsSum);
    case "winRate":
      return period.tradeCount ? `${Math.round(period.winRate)}%` : "—";
    case "tradeCount":
      return `${period.tradeCount}`;
  }
}

function resultRR(trade: Trade): number {
  if (trade.result === "Win") return trade.rrr;
  if (trade.result === "Loss") return -1;
  return 0;
}

function periodStats(
  key: string,
  label: string,
  start: Date,
  trades: CalendarTrade[],
  isEmptyBeforeHistory = false,
): PeriodStats {
  const tradeCount = trades.length;
  const wins = trades.filter((trade) => trade.result === "Win").length;
  return {
    key,
    label,
    start,
    isEmptyBeforeHistory,
    tradeCount,
    rrSum: trades.reduce((sum, trade) => sum + resultRR(trade), 0),
    pipsSum: trades.reduce((sum, trade) => sum + trade.pips, 0),
    winRate: tradeCount ? (wins / tradeCount) * 100 : 0,
  };
}

function getFill(period: PeriodStats, metric: CalendarMetricId, best: number, worst: number): string {
  if (period.isEmptyBeforeHistory || period.tradeCount === 0) return "hsl(213 16% 19%)";
  if (metric === "winRate") {
    return getWinRateColor(period.winRate);
  }
  if (metric === "pipsSum" || metric === "rrSum") {
    const value = metric === "pipsSum" ? period.pipsSum : period.rrSum;
    if (value > 0 && best > 0) {
      const intensity = Math.min(1, value / best);
      return `hsl(${145 - intensity * 8} ${43 + intensity * 24}% ${34 - intensity * 9}%)`;
    }
    if (value < 0 && worst < 0) {
      const intensity = Math.min(1, Math.abs(value / worst));
      return `hsl(${4 + intensity * 3} ${48 + intensity * 22}% ${35 - intensity * 8}%)`;
    }
  }
  return "hsl(213 16% 19%)";
}

function primaryMetric(metrics: CalendarMetricId[]): CalendarMetricId | null {
  return metrics.find((metric) => metric === "rrSum")
    ?? metrics.find((metric) => metric === "pipsSum")
    ?? metrics.find((metric) => metric === "winRate")
    ?? null;
}

function buildCalendarPeriods(
  mode: CalendarPeriodMode,
  trades: CalendarTrade[],
  firstTradeDate: Date,
  lastTradeDate: Date,
): PeriodStats[] {
  if (mode === "4week") {
    const totalBlocks = Math.floor(differenceInCalendarDays(lastTradeDate, firstTradeDate) / 28) + 1;
    return Array.from({ length: totalBlocks }, (_, index) => {
      const start = new Date(firstTradeDate);
      start.setDate(start.getDate() + index * 28);
      const end = new Date(start);
      end.setDate(end.getDate() + 28);
      return periodStats(
        `4week-${index}`,
        `Block ${String(index + 1).padStart(2, "0")}`,
        start,
        trades.filter((trade) => trade.eventDate >= start && trade.eventDate < end),
      );
    });
  }

  const firstTradeMonth = startOfMonth(firstTradeDate);
  const firstMonth = new Date(firstTradeDate.getFullYear(), 0, 1);
  // Month pages are complete calendar years. Months after the final trade stay
  // neutral, while months before the first trade get the distinct pre-history
  // treatment on the first year page.
  const lastMonth = new Date(lastTradeDate.getFullYear(), 11, 1);
  const months = (lastMonth.getFullYear() - firstMonth.getFullYear()) * 12
    + lastMonth.getMonth() - firstMonth.getMonth() + 1;

  return Array.from({ length: months }, (_, index) => {
    const start = addMonths(firstMonth, index);
    const next = addMonths(start, 1);
    return periodStats(
      format(start, "yyyy-MM"),
      format(start, "MMM yyyy"),
      start,
      trades.filter((trade) => trade.eventDate >= start && trade.eventDate < next),
      start.getFullYear() === firstTradeMonth.getFullYear() && start < firstTradeMonth,
    );
  });
}

function pagePeriods(periods: PeriodStats[], mode: CalendarPeriodMode, page: number): PeriodStats[] {
  if (mode === "calendar_month") {
    const year = periods[0]?.start.getFullYear();
    const years = Array.from(new Set(periods.map((period) => period.start.getFullYear())));
    const selectedYear = years[page] ?? year;
    return periods.filter((period) => period.start.getFullYear() === selectedYear);
  }
  return periods.slice(page * BLOCKS_PER_PAGE, page * BLOCKS_PER_PAGE + BLOCKS_PER_PAGE);
}

function pageCount(periods: PeriodStats[], mode: CalendarPeriodMode): number {
  if (mode === "calendar_month") return new Set(periods.map((period) => period.start.getFullYear())).size;
  return Math.max(1, Math.ceil(periods.length / BLOCKS_PER_PAGE));
}

function pageLabel(periods: PeriodStats[], mode: CalendarPeriodMode, page: number): string {
  if (!periods.length) return "No trading history";
  if (mode === "calendar_month") {
    const years = Array.from(new Set(periods.map((period) => period.start.getFullYear())));
    return String(years[page] ?? years[0]);
  }
  const first = page * BLOCKS_PER_PAGE + 1;
  const last = Math.min((page + 1) * BLOCKS_PER_PAGE, periods.length);
  return `Blocks ${String(first).padStart(2, "0")}–${String(last).padStart(2, "0")}`;
}

function TradingBlock({
  period,
  metrics,
  bestRR,
  worstRR,
  bestPips,
  worstPips,
}: {
  period: PeriodStats;
  metrics: CalendarMetricId[];
  bestRR: number;
  worstRR: number;
  bestPips: number;
  worstPips: number;
}) {
  const driver = primaryMetric(metrics) ?? "tradeCount";
  const background = getFill(
    period,
    driver,
    driver === "pipsSum" ? bestPips : bestRR,
    driver === "pipsSum" ? worstPips : worstRR,
  );
  const winRateColor = period.tradeCount ? getWinRateColor(period.winRate) : undefined;

  return (
    <div
      className={[
        "relative min-h-[150px] rounded-2xl border p-4 flex flex-col justify-between",
        "transition-transform duration-200 hover:-translate-y-0.5",
        period.isEmptyBeforeHistory
          ? "border-white/[0.06] bg-white/[0.025] opacity-45"
          : period.tradeCount === 0
            ? "border-dashed border-white/10 bg-white/[0.035]"
            : "border-white/10",
      ].join(" ")}
      style={{ backgroundColor: period.isEmptyBeforeHistory || period.tradeCount === 0 ? undefined : background }}
      title={period.isEmptyBeforeHistory ? "Before your first trade" : period.tradeCount === 0 ? "No trades in this period" : `${period.label}, ${period.tradeCount} trades`}
      aria-label={`${period.label}: ${period.isEmptyBeforeHistory ? "before first trade" : `${period.tradeCount} trades`}`}
      data-testid={`calendar-block-${period.key}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-mono font-semibold uppercase tracking-[0.14em] text-white/70">
          {period.label}
        </span>
        {period.tradeCount > 0 && driver !== "winRate" && (
          <span
            className="h-2 w-2 rounded-full shrink-0 border border-white/40"
            style={{ backgroundColor: winRateColor }}
            title={`Win rate ${Math.round(period.winRate)}%`}
          />
        )}
      </div>
      {!period.isEmptyBeforeHistory && (
        <div className="space-y-1.5">
          {metrics.map((metric) => (
            <div key={metric} className="flex items-center justify-between gap-3 text-[12px] font-mono font-medium leading-none text-white/90">
              <span className="text-white/55">{CALENDAR_METRIC_LABELS[metric]}</span>
              <span data-testid={`calendar-${metric}-${period.key}`}>{metricValue(metric, period)}</span>
            </div>
          ))}
        </div>
      )}
      {period.isEmptyBeforeHistory && <span className="text-[10px] font-mono text-white/35">not started</span>}
      {period.tradeCount === 0 && !period.isEmptyBeforeHistory && <span className="text-[10px] font-mono text-white/35">no trades</span>}
    </div>
  );
}

export function TradingCalendar() {
  const { data: weeks = [], isLoading: weeksLoading, error: weeksError } = useListWeeks();
  const { data: archivedWeeks = [], isLoading: archivedLoading } = useArchivedWeeks();
  const { data: trades = [], isLoading: tradesLoading, error: tradesError } = useListTrades();
  const {
    calendarPeriodMode,
    calendarMetricsOrder,
    hiddenCalendarMetrics,
  } = useCalendarPrefs();
  const [page, setPage] = useState(0);

  const allWeeks = useMemo(() => {
    const map = new Map<number, Week | ArchivedWeek>();
    [...weeks, ...archivedWeeks].forEach((week) => map.set(week.id, week));
    return map;
  }, [archivedWeeks, weeks]);

  const calendarTrades = useMemo<CalendarTrade[]>(() => {
    return trades
      .map((trade) => {
        const eventDate = validDate(trade.createdAt) ?? validDate(allWeeks.get(trade.weekId)?.startDate);
        return eventDate ? { ...trade, eventDate } : null;
      })
      .filter((trade): trade is CalendarTrade => trade !== null);
  }, [allWeeks, trades]);

  const metrics = useMemo(
    () => calendarMetricsOrder.filter((metric) => !hiddenCalendarMetrics.includes(metric)),
    [calendarMetricsOrder, hiddenCalendarMetrics],
  );

  const firstTradeDate = calendarTrades.length
    ? calendarTrades.reduce((min, trade) => trade.eventDate < min ? trade.eventDate : min, calendarTrades[0]!.eventDate)
    : null;
  const lastTradeDate = calendarTrades.length
    ? calendarTrades.reduce((max, trade) => trade.eventDate > max ? trade.eventDate : max, calendarTrades[0]!.eventDate)
    : null;

  const periods = useMemo(
    () => firstTradeDate && lastTradeDate
      ? buildCalendarPeriods(calendarPeriodMode, calendarTrades, firstTradeDate, lastTradeDate)
      : [],
    [calendarPeriodMode, calendarTrades, firstTradeDate, lastTradeDate],
  );
  const pages = pageCount(periods, calendarPeriodMode);
  const visiblePeriods = pagePeriods(periods, calendarPeriodMode, page);

  useEffect(() => {
    setPage((current) => Math.min(current, Math.max(0, pages - 1)));
  }, [pages, calendarPeriodMode]);

  useEffect(() => {
    setPage(0);
  }, [calendarPeriodMode]);

  const allTime = useMemo(() => ({
    bestRR: Math.max(0, ...periods.map((period) => period.rrSum)),
    worstRR: Math.min(0, ...periods.map((period) => period.rrSum)),
    bestPips: Math.max(0, ...periods.map((period) => period.pipsSum)),
    worstPips: Math.min(0, ...periods.map((period) => period.pipsSum)),
  }), [periods]);

  const isLoading = weeksLoading || archivedLoading || tradesLoading;
  const isError = Boolean(weeksError || tradesError);
  const configuredMetrics = metrics.length > 0 ? metrics : [];

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5" data-testid="calendar-loading">
        <div className="flex items-center justify-between mb-5">
          <Skeleton className="h-4 w-36 bg-white/10" />
          <Skeleton className="h-8 w-28 bg-white/10" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[150px] rounded-2xl bg-white/10" />)}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-5 py-8 text-center" data-testid="calendar-error">
        <p className="text-sm text-destructive">Calendar data could not be loaded.</p>
        <p className="mt-1 text-xs text-muted-foreground">Refresh the analysis when your journal connection is ready.</p>
      </div>
    );
  }

  if (!calendarTrades.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] px-6 py-12 text-center" data-testid="calendar-empty">
        <CalendarDays className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">Your calendar will take shape after the first trade.</p>
        <p className="mt-1 text-xs text-muted-foreground/60">This view is read-only and follows the journal record.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5" data-testid="trading-calendar">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-5">
        <div>
          <p className="text-sm text-foreground/85">A quiet read of the work behind the numbers.</p>
          <p className="mt-1 text-xs font-mono text-muted-foreground/60">
            {calendarPeriodMode === "calendar_month" ? "Calendar months" : "Continuous 4-week blocks"} · {trades.length} total trades
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={page === 0}
            aria-label="Previous calendar period"
            data-testid="button-calendar-previous"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-muted-foreground transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[112px] text-center text-xs font-mono font-semibold text-foreground/80" data-testid="text-calendar-page">
            {pageLabel(periods, calendarPeriodMode, page)}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(pages - 1, current + 1))}
            disabled={page >= pages - 1}
            aria-label="Next calendar period"
            data-testid="button-calendar-next"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-muted-foreground transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {configuredMetrics.length === 0 ? (
        <div className="flex items-start gap-3 rounded-xl border border-dashed border-white/10 bg-white/[0.025] px-4 py-4 text-sm text-muted-foreground" data-testid="calendar-no-metrics">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>All calendar metrics are hidden. Re-enable one in Settings to populate the blocks.</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {visiblePeriods.map((period) => (
            <TradingBlock
              key={period.key}
              period={period}
              metrics={configuredMetrics}
              bestRR={allTime.bestRR}
              worstRR={allTime.worstRR}
              bestPips={allTime.bestPips}
              worstPips={allTime.worstPips}
            />
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/[0.06] pt-4 text-[10px] font-mono text-muted-foreground/60">
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-[hsl(145_65%_30%)]" /> positive performance</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-[hsl(4_65%_32%)]" /> negative performance</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm border border-dashed border-white/20 bg-white/[0.035]" /> no trades</span>
        {calendarPeriodMode === "calendar_month" && <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-white/[0.025] opacity-50" /> before first trade</span>}
      </div>
    </div>
  );
}