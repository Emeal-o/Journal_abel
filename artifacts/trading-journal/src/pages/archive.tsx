import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Archive, Download } from "lucide-react";
import JSZip from "jszip";
import {
  useGetWeeklyStats,
  getListTradesQueryKey,
  listTrades,
} from "@workspace/api-client-react";
import type { Week, WeekStats } from "@workspace/api-client-react";

import { WeekCard } from "@/components/week-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { StatsCard } from "@/components/stats-card";
import { THEMES } from "@/components/ledger-sheet";
import type { LedgerTheme } from "@/components/ledger-sheet";
import { listArchivedWeeks, type ArchivedWeek } from "@/lib/weeks-api";
import { yearIndexFromMonthIndex, monthInYearFromMonthIndex, toRoman, computeCardLabels } from "@/lib/label-utils";
import { aggregateWeekStats } from "@/lib/stats-utils";
import { captureCardPng, dataUrlToBlob, triggerDownload } from "@/lib/card-export";

const THEME_ORDER: LedgerTheme[] = ["obsidian", "midnight", "ember", "matrix", "aurora", "goldrush", "sakura", "vapor", "autumn"];

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

/** Net RR formatted like the rest of the app: "+4.20R" / "-1.30R" / "0.00R". */
function formatNetRR(v: number): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}R`;
}

function netRRColorClass(v: number): string {
  if (v > 0) return "text-emerald-400";
  if (v < 0) return "text-rose-400";
  return "text-slate-400";
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

// ─── theme picker (reuses the same swatches as the Stats page) ────────────────

function ThemeSwatches({ theme, onChange }: { theme: LedgerTheme; onChange: (t: LedgerTheme) => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {THEME_ORDER.map((id) => {
        const th = THEMES[id];
        const active = theme === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
            style={{
              background: active ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${active ? th.containerBorder : "rgba(255,255,255,0.06)"}`,
              color: active ? th.textPrimary : "#64748b",
              boxShadow: active ? `0 0 14px ${th.dot}30` : "none",
            }}
          >
            <span style={{
              width: 7, height: 7,
              borderRadius: "50%",
              background: th.dot,
              flexShrink: 0,
              boxShadow: active ? `0 0 6px ${th.dot}` : "none",
            }} />
            {th.name}
          </button>
        );
      })}
    </div>
  );
}

// ─── download year button + export flow ───────────────────────────────────────

interface HiddenRenderJob {
  key: string;
  theme: LedgerTheme;
  month: string;
  tag: string;
  weeksOverride: Week[];
  summaryOverride: ReturnType<typeof aggregateWeekStats>;
  weeklyStatsOverride: WeekStats[];
}

function DownloadYearButton({
  yearIndex, months, weeklyStats,
}: {
  yearIndex: number;
  months: MonthGroupData[];
  weeklyStats: WeekStats[];
}) {
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [theme, setTheme]             = useState<LedgerTheme>("obsidian");
  const [progress, setProgress]       = useState<{ current: number; total: number } | null>(null);
  const [renderJob, setRenderJob]     = useState<HiddenRenderJob | null>(null);
  const hiddenCardRef                 = useRef<HTMLDivElement>(null);
  const readyCallbackRef              = useRef<(() => void) | null>(null);
  const queryClient                   = useQueryClient();
  const { toast }                     = useToast();

  /** Mounts a hidden StatsCard scoped to one month, waits for it to be ready + settled, captures a PNG. */
  async function renderMonthToPng(job: Omit<HiddenRenderJob, "key">): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      readyCallbackRef.current = () => {
        // One extra frame so the layout/fonts have settled before we measure/capture.
        requestAnimationFrame(() => {
          requestAnimationFrame(async () => {
            try {
              const node = hiddenCardRef.current;
              if (!node) throw new Error("Export card failed to mount.");
              const png = await captureCardPng(node, THEMES[job.theme].pageBg, 960, 6);
              resolve(png);
            } catch (err) {
              reject(err);
            }
          });
        });
      };
      setRenderJob({ ...job, key: `${job.month}-${Date.now()}-${Math.random()}` });
    });
  }

  const handleConfirm = async () => {
    setDialogOpen(false);
    const sortedMonths = [...months].sort((a, b) => (a.monthIndex ?? 0) - (b.monthIndex ?? 0));
    if (sortedMonths.length === 0) return;

    setProgress({ current: 0, total: sortedMonths.length });
    const zip = new JSZip();

    try {
      for (let i = 0; i < sortedMonths.length; i++) {
        const m = sortedMonths[i]!;
        setProgress({ current: i + 1, total: sortedMonths.length });

        const monthWeeks = [...m.weeks].sort(
          (a, b) => a.startDate.localeCompare(b.startDate) || a.id - b.id,
        );

        // Prefetch each week's trades so the ledger reads scoped data from
        // cache synchronously (no loading flash / partial-data capture).
        await Promise.all(monthWeeks.map((w) =>
          queryClient.prefetchQuery({
            queryKey: getListTradesQueryKey({ weekId: w.id }),
            queryFn: () => listTrades({ weekId: w.id }),
          }),
        ));

        const monthWeekIds = new Set(monthWeeks.map((w) => w.id));
        const scopedWeeklyStats = weeklyStats.filter((s) => monthWeekIds.has(s.weekId));
        const summaryOverride = aggregateWeekStats(scopedWeeklyStats);
        const { suggestedMonth, suggestedTag } = computeCardLabels(m.monthIndex ?? 1);

        const png = await renderMonthToPng({
          theme,
          month: suggestedMonth,
          tag: suggestedTag,
          weeksOverride: monthWeeks as unknown as Week[],
          summaryOverride,
          weeklyStatsOverride: scopedWeeklyStats,
        });

        zip.file(`${suggestedMonth}.png`, dataUrlToBlob(png));
      }

      const blob = await zip.generateAsync({ type: "blob" });
      triggerDownload(blob, `TradeOps - Year ${toRoman(yearIndex)}.zip`);
      toast({ title: `Year ${toRoman(yearIndex)} downloaded`, description: `${sortedMonths.length} month card${sortedMonths.length !== 1 ? "s" : ""} bundled into one ZIP.` });
    } catch (err) {
      console.error("[download-year] export failed:", err);
      toast({ title: "Failed to export year", variant: "destructive" });
    } finally {
      setProgress(null);
      setRenderJob(null);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        className="gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10"
        disabled={!!progress}
        onClick={(e) => { e.stopPropagation(); setDialogOpen(true); }}
      >
        <Download className="w-3.5 h-3.5" />
        {progress ? `Generating Month ${progress.current} of ${progress.total}…` : `Download Year ${toRoman(yearIndex)}`}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-background border-white/10">
          <DialogHeader>
            <DialogTitle>Download Year {toRoman(yearIndex)}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Pick a theme. We'll generate one stats card per month in this year (using each month's own trades) and bundle them into a ZIP.
          </p>
          <ThemeSwatches theme={theme} onChange={setTheme} />
          <DialogFooter>
            <Button variant="secondary" className="bg-white/5 hover:bg-white/10" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Generate ZIP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Off-screen render target used purely for PNG capture — never visible to the user. */}
      {renderJob && (
        <div style={{ position: "fixed", top: 0, left: -99999, pointerEvents: "none" }} aria-hidden="true">
          <StatsCard
            key={renderJob.key}
            ref={hiddenCardRef}
            theme={renderJob.theme}
            month={renderJob.month}
            tag={renderJob.tag}
            weeksOverride={renderJob.weeksOverride}
            summaryOverride={renderJob.summaryOverride}
            weeklyStatsOverride={renderJob.weeklyStatsOverride}
            onReady={() => readyCallbackRef.current?.()}
          />
        </div>
      )}
    </>
  );
}

// ─── year section ─────────────────────────────────────────────────────────────

function YearSection({
  yearIndex, months, weeklyStats,
}: {
  yearIndex: number | null;
  months: MonthGroupData[];
  weeklyStats: WeekStats[];
}) {
  const [open, setOpen] = useState(true);
  const label = yearIndex == null ? "Uncategorised" : `Year ${toRoman(yearIndex)}`;
  const allWeeks = months.flatMap((m) => m.weeks);
  const totalWeeks = allWeeks.length;

  // Net RR for the whole year — reuses the same per-week stats (weekId → netRR)
  // that power the Stats page and each WeekCard's own totals, just summed
  // across every week whose month_index falls in this year.
  const weekIds = new Set(allWeeks.map((w) => w.id));
  const yearNetRR = aggregateWeekStats(weeklyStats.filter((s) => weekIds.has(s.weekId))).netRR;

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden bg-white/[0.01]">
      <button
        className="w-full flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 bg-white/[0.04] hover:bg-white/[0.06] transition-colors gap-3"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap min-w-0 text-left">
          {open
            ? <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            : <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />}
          <span className="text-white font-bold text-xl flex-shrink-0">{label}</span>
          <span className="text-xs text-muted-foreground/60 font-normal break-words">
            {months.length} month{months.length !== 1 ? "s" : ""} · {totalWeeks} week{totalWeeks !== 1 ? "s" : ""}
            {totalWeeks > 0 && (
              <>
                {" · "}
                Net RR:{" "}
                <span className={`font-mono font-semibold ${netRRColorClass(yearNetRR)}`}>
                  {formatNetRR(yearNetRR)}
                </span>
              </>
            )}
          </span>
        </div>

        {yearIndex != null && (
          <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0 self-start sm:self-auto">
            <DownloadYearButton yearIndex={yearIndex} months={months} weeklyStats={weeklyStats} />
          </div>
        )}
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
  // Per-week Net RR / win-rate etc. for ALL weeks (active + archived) — the
  // same source used by the LedgerSheet's weekly finale rows. Reused here to
  // compute each Year section's Net RR and each month's scoped export stats,
  // so all three surfaces always agree.
  const { data: weeklyStats = [] } = useGetWeeklyStats();

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
            <YearSection key={y.yearIndex ?? "none"} yearIndex={y.yearIndex} months={y.months} weeklyStats={weeklyStats} />
          ))}
        </div>
      )}
    </div>
  );
}
