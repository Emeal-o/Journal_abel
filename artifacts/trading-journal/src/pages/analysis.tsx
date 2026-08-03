import { useState, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { ArrowLeft, TrendingUp, TrendingDown, BarChart2, Activity, Target, Zap, X, Download, Tag, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { THEMES } from "@/components/ledger-sheet";
import type { LedgerTheme } from "@/components/ledger-sheet";
import { AnalysisCard } from "@/components/analysis-card";
import { captureCardPng, triggerDownload } from "@/lib/card-export";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, BarChart, Bar, Cell,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAnalysis } from "@/lib/analysis-api";
import type { AnalysisCumulativePoint, AnalysisRRRPoint, AnalysisRRRBucket, AnalysisRRRBucketTrade, AnalysisSetupTypeRow, AnalysisPostLossRow } from "@/lib/analysis-api";
import { toRoman } from "@/lib/label-utils";

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtRR(v: number): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}R`;
}

function rrColor(v: number): string {
  if (v > 0) return "#34d399"; // emerald-400
  if (v < 0) return "#fb7185"; // rose-400
  return "#94a3b8";            // slate-400
}

// ─── stat tile ───────────────────────────────────────────────────────────────

function StatTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 flex flex-col gap-1">
      <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
      <span className="text-2xl font-bold text-white" style={accent ? { color: accent } : undefined}>{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

// ─── section wrapper ─────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children, action }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</h2>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </div>
  );
}

// ─── custom tooltip for recharts ─────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[#0f172a] px-3 py-2 text-xs shadow-xl">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: rrColor(p.value) }} className="font-mono font-semibold">
          {fmtRR(p.value)}
        </p>
      ))}
    </div>
  );
}

function RRRTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[#0f172a] px-3 py-2 text-xs shadow-xl">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className="font-mono font-semibold text-sky-400">{payload[0]!.value.toFixed(2)}R avg RRR</p>
    </div>
  );
}

function RRRHistogramTooltip({
  active,
  payload,
  onCountClick,
}: {
  active?: boolean;
  payload?: Array<{ payload: AnalysisRRRBucket }>;
  onCountClick?: (bucket: AnalysisRRRBucket) => void;
}) {
  if (!active || !payload?.length) return null;
  const b = payload[0]!.payload;
  const rangeLabel = b.max != null ? `${b.min}–${b.max}R` : `${b.min}R+`;
  const tradeWord = b.count === 1 ? "trade" : "trades";
  return (
    <div className="rounded-lg border border-white/10 bg-[#0f172a] px-3 py-2 text-xs shadow-xl">
      <p className="text-muted-foreground mb-1">{rangeLabel}</p>
      {b.count > 0 && onCountClick ? (
        <button
          className="font-mono font-semibold text-violet-400 underline underline-offset-2 decoration-dotted hover:text-violet-300 transition-colors cursor-pointer"
          onClick={(e) => { e.stopPropagation(); onCountClick(b); }}
        >
          {b.count} {tradeWord}
        </button>
      ) : (
        <p className="font-mono font-semibold text-violet-400">{b.count} {tradeWord}</p>
      )}
    </div>
  );
}

// ─── result badge ─────────────────────────────────────────────────────────────

function ResultBadge({ result }: { result: string }) {
  const styles: Record<string, string> = {
    Win:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    Loss: "bg-rose-500/15 text-rose-400 border-rose-500/25",
    BE:   "bg-amber-500/15 text-amber-400 border-amber-500/25",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-semibold ${styles[result] ?? "bg-white/10 text-white border-white/10"}`}>
      {result}
    </span>
  );
}

// ─── bucket trades modal ──────────────────────────────────────────────────────

function computeBucketStats(trades: AnalysisRRRBucketTrade[]) {
  const total = trades.length;
  const wins  = trades.filter(t => t.result === "Win").length;
  const losses = trades.filter(t => t.result === "Loss").length;
  const breakEvens = trades.filter(t => t.result === "BE").length;
  const winRate = total > 0 ? Math.round((wins / total) * 10000) / 100 : 0;
  const netRR = Math.round(
    trades.reduce((sum, t) => {
      if (t.result === "Win")  return sum + t.rrr;
      if (t.result === "Loss") return sum - 1;
      return sum;
    }, 0) * 100,
  ) / 100;
  const netPips = Math.round(trades.reduce((sum, t) => sum + t.pips, 0) * 10) / 10;
  return { winRate, netRR, netPips, wins, losses, breakEvens };
}

function BucketTradesModal({
  bucket,
  subtitle,
  title,
  onClose,
}: {
  bucket: AnalysisRRRBucket | null;
  /** Optional subtitle shown below the modal title — used for setup type descriptions. */
  subtitle?: string | null;
  /** Optional title override — used to show the setup type's name instead of the RRR range label. */
  title?: string | null;
  onClose: () => void;
}) {
  const [statsOpen, setStatsOpen] = useState(false);

  // Reset summary panel whenever a different bucket is opened
  const bucketKey = bucket?.label ?? null;
  const prevKeyRef = useState<string | null>(null);
  if (prevKeyRef[0] !== bucketKey) {
    prevKeyRef[1](bucketKey);
    if (statsOpen) setStatsOpen(false);
  }

  const rangeLabel = bucket
    ? (title ?? (bucket.max != null ? `${bucket.min}–${bucket.max}R` : `${bucket.min}R+`))
    : "";
  const tradeWord = (bucket?.count ?? 0) === 1 ? "Trade" : "Trades";
  const stats = bucket && bucket.trades && bucket.trades.length > 0 ? computeBucketStats(bucket.trades) : null;

  return (
    <Dialog open={!!bucket} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg bg-background border-white/10 shadow-2xl max-h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-white">
            {rangeLabel} {tradeWord}
            {stats ? (
              <button
                onClick={() => setStatsOpen(v => !v)}
                className="ml-2 text-sm font-normal text-muted-foreground underline underline-offset-2 decoration-dotted hover:text-white transition-colors cursor-pointer"
                aria-expanded={statsOpen}
              >
                ({bucket?.count ?? 0})
              </button>
            ) : (
              <span className="ml-2 text-sm font-normal text-muted-foreground">({bucket?.count ?? 0})</span>
            )}
          </DialogTitle>
          {subtitle && (
            <DialogDescription className="text-muted-foreground text-sm leading-snug mt-1">
              {subtitle}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Always-visible Win/Loss/BE breakdown */}
        {stats && (
          <p className="flex-shrink-0 text-xs text-muted-foreground -mt-1 mb-1">
            {bucket?.count ?? 0} {(bucket?.count ?? 0) === 1 ? "trade" : "trades"} ·{" "}
            <span className="text-emerald-400 font-medium">{stats.wins} Win</span>
            {" · "}
            <span className="text-rose-400 font-medium">{stats.losses} Loss</span>
            {" · "}
            <span className="text-amber-400 font-medium">{stats.breakEvens} BE</span>
          </p>
        )}

        {/* Collapsible summary row */}
        {stats && (
          <div
            className="flex-shrink-0 overflow-hidden transition-all duration-200"
            style={{ maxHeight: statsOpen ? "120px" : "0px", opacity: statsOpen ? 1 : 0 }}
          >
            <div className="grid grid-cols-3 gap-2 pt-1 pb-3">
              {[
                { label: "Win Rate", value: `${stats.winRate}%`,  accent: stats.winRate >= 50 ? "#34d399" : "#fb7185" },
                { label: "Net RR",   value: fmtRR(stats.netRR),   accent: rrColor(stats.netRR) },
                { label: "Net Pips", value: `${stats.netPips > 0 ? "+" : ""}${stats.netPips}`, accent: rrColor(stats.netPips) },
              ].map(({ label, value, accent }) => (
                <div key={label} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
                  <span className="text-base font-bold font-mono" style={{ color: accent }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trade list */}
        <div className="overflow-y-auto flex-1 -mx-6 px-6 mt-2">
          {!bucket || !bucket.trades || bucket.trades.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">No trades in this bucket.</p>
          ) : (
            <div className="space-y-2 pb-2">
              {bucket.trades.map((trade: AnalysisRRRBucketTrade) => (
                <div
                  key={trade.id}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 flex items-center gap-4"
                >
                  {/* Result */}
                  <ResultBadge result={trade.result} />

                  {/* RRR + Pips */}
                  <div className="flex-1 flex gap-4">
                    <div className="min-w-[64px]">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">RRR</p>
                      <p className="font-mono text-sm font-semibold text-white">{trade.rrr.toFixed(2)}R</p>
                    </div>
                    <div className="min-w-[56px]">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Pips</p>
                      <p className="font-mono text-sm font-semibold text-white">
                        {trade.pips > 0 ? "+" : ""}{trade.pips}
                      </p>
                    </div>
                  </div>

                  {/* Week reference */}
                  {trade.weekLabel && (
                    <div className="text-right shrink-0 max-w-[140px]">
                      <p className="text-xs font-medium text-white truncate">{trade.weekLabel}</p>
                      {trade.weekStartDate && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{trade.weekStartDate}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── export constants ─────────────────────────────────────────────────────────

const THEME_ORDER: LedgerTheme[] = ["obsidian", "midnight", "ember", "matrix", "aurora", "goldrush", "sakura", "vapor", "autumn"];
const EXPORT_CARD_WIDTH = 680;

// ─── page ─────────────────────────────────────────────────────────────────────

export function AnalysisPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const yearParam = new URLSearchParams(search).get("year");
  const yearIndex = yearParam != null && yearParam !== "" ? parseInt(yearParam, 10) : undefined;
  const isYearScoped = yearIndex != null && !isNaN(yearIndex);

  const { data, isLoading, error } = useAnalysis(isYearScoped ? yearIndex : undefined);
  const [chartGranularity, setChartGranularity] = useState<"weekly" | "monthly">("weekly");
  const [rrrGranularity, setRRRGranularity] = useState<"monthly" | "yearly">("monthly");
  const [selectedBucket, setSelectedBucket] = useState<AnalysisRRRBucket | null>(null);
  const [selectedSetupRow, setSelectedSetupRow] = useState<AnalysisSetupTypeRow | null>(null);
  const [selectedTiltRow, setSelectedTiltRow] = useState<AnalysisPostLossRow | null>(null);
  const [exportTheme, setExportTheme] = useState<LedgerTheme>("obsidian");
  const [exporting, setExporting] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const t = THEMES[exportTheme];
      const dateStr = new Date().toISOString().slice(0, 10);
      const scopeStr = isYearScoped ? `year${yearIndex}` : "all-time";
      const png = await captureCardPng(cardRef.current, t.pageBg, EXPORT_CARD_WIDTH, 6);
      triggerDownload(png, `tradeops-analysis-${scopeStr}-${exportTheme}-${dateStr}.png`);
      toast({ title: "Analysis card downloaded" });
    } catch (err) {
      console.error("[dom-to-image-more] render failed:", err);
      toast({ title: "Failed to download card", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const pageTitle = isYearScoped ? `Year ${toRoman(yearIndex!)} Analysis` : "All-Time Analysis";
  const pageSubtitle = isYearScoped
    ? `Trades from Year ${toRoman(yearIndex!)} only.`
    : "Every trade across your entire journal history.";

  // ── loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/archive")} className="text-muted-foreground hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl font-bold tracking-tight text-white">{pageTitle}</h1>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl bg-white/5" />)}
        </div>
        <Skeleton className="h-64 rounded-xl bg-white/5" />
        <Skeleton className="h-48 rounded-xl bg-white/5" />
      </div>
    );
  }

  // ── error ──────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/archive")} className="text-muted-foreground hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl font-bold tracking-tight text-white">{pageTitle}</h1>
        </div>
        <div className="p-8 text-center border border-destructive/20 bg-destructive/10 rounded-xl">
          <p className="text-destructive">Failed to load analysis data. Please try again.</p>
        </div>
      </div>
    );
  }

  // ── no data ────────────────────────────────────────────────────────────────
  if (data.allTime.totalTrades === 0) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/archive")} className="text-muted-foreground hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl font-bold tracking-tight text-white">{pageTitle}</h1>
        </div>
        <div className="flex flex-col items-center justify-center p-16 border border-dashed border-white/10 rounded-xl bg-white/5">
          <Activity className="w-10 h-10 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">No trades logged yet. Start journaling to see your analysis.</p>
        </div>
      </div>
    );
  }

  // ── chart data ─────────────────────────────────────────────────────────────
  const cumulativeData: AnalysisCumulativePoint[] =
    chartGranularity === "weekly" ? data.cumulativeWeekly : data.cumulativeMonthly;

  const rrrData: AnalysisRRRPoint[] =
    rrrGranularity === "monthly" ? data.avgRRRByMonth : data.avgRRRByYear;

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate("/archive")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Archive
        </button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">{pageTitle}</h1>
          <p className="text-muted-foreground mt-1">{pageSubtitle}</p>
        </div>
      </div>

      {/* Export modal */}
      <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
        <DialogContent className="sm:max-w-sm bg-background border-white/10 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-white text-sm font-semibold uppercase tracking-wider">Export Analysis Card</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            {/* Theme selector */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/50">Theme</span>
              <div className="flex items-center gap-2 flex-wrap">
                {THEME_ORDER.map((id) => {
                  const th = THEMES[id];
                  const active = exportTheme === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setExportTheme(id)}
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
                        display: "inline-block",
                      }} />
                      {th.name}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Download button */}
            <Button
              onClick={handleDownload}
              disabled={exporting}
              className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(99,102,241,0.4)] border border-primary-foreground/10"
            >
              <Download className="w-4 h-4" />
              {exporting ? "Generating…" : "Download Analysis Card"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 1. All-time summary */}
      <Section
        title="All-Time Summary"
        icon={Activity}
        action={
          <button
            onClick={() => setExportModalOpen(true)}
            className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Export analysis card"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="Total Trades" value={String(data.allTime.totalTrades)} sub={`${data.allTime.wins}W · ${data.allTime.losses}L · ${data.allTime.breakEvens}BE`} />
          <StatTile label="Win Rate" value={`${data.allTime.winRate}%`} accent={data.allTime.winRate >= 50 ? "#34d399" : "#fb7185"} />
          <StatTile label="Net RR" value={fmtRR(data.allTime.netRR)} accent={rrColor(data.allTime.netRR)} />
          <StatTile label="Net Pips" value={`${data.allTime.netPips > 0 ? "+" : ""}${data.allTime.netPips}`} accent={rrColor(data.allTime.netPips)} />
        </div>
      </Section>

      {/* 2. Cumulative growth chart */}
      <Section title="Cumulative Growth" icon={TrendingUp}>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between mb-5">
            <span className="text-sm text-muted-foreground">Net RR over time</span>
            <div className="flex gap-1 rounded-lg bg-white/5 p-1">
              {(["weekly", "monthly"] as const).map(g => (
                <button
                  key={g}
                  onClick={() => setChartGranularity(g)}
                  className="px-3 py-1 rounded-md text-xs font-medium transition-colors"
                  style={{
                    background: chartGranularity === g ? "rgba(255,255,255,0.10)" : "transparent",
                    color: chartGranularity === g ? "#fff" : "#64748b",
                  }}
                >
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {cumulativeData.length < 2 ? (
            <p className="text-center text-muted-foreground text-sm py-8">Not enough data yet for a chart.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={cumulativeData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 11) + "…" : v}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}R`}
                  width={54}
                />
                <Tooltip content={<ChartTooltip />} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.08)" />
                <Line
                  type="monotone"
                  dataKey="cumulativeRR"
                  stroke="#60a5fa"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#60a5fa" }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Section>

      {/* 3. Year-over-year */}
      {data.byYear.length > 0 && (
        <Section title="Year by Year" icon={BarChart2}>
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.04]">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Period</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Trades</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Win Rate</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Net RR</th>
                </tr>
              </thead>
              <tbody>
                {data.byYear.map((y, i) => (
                  <tr key={y.yearIndex ?? "active"} className={i < data.byYear.length - 1 ? "border-b border-white/5" : ""}>
                    <td className="px-4 py-3 text-white font-semibold">{y.label}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{y.totalTrades}</td>
                    <td className="px-4 py-3 text-right" style={{ color: y.winRate >= 50 ? "#34d399" : "#fb7185" }}>{y.winRate}%</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: rrColor(y.netRR) }}>{fmtRR(y.netRR)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* 4. Best & worst */}
      {(data.bestWeek || data.bestMonth) && (
        <Section title="Best & Worst Performance" icon={Target}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.bestWeek && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">Best Week</span>
                </div>
                <p className="text-white font-semibold">{data.bestWeek.weekLabel}</p>
                <p className="text-emerald-400 font-mono font-bold text-xl mt-1">{fmtRR(data.bestWeek.netRR)}</p>
              </div>
            )}
            {data.worstWeek && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-5 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                  <span className="text-xs text-rose-400 font-semibold uppercase tracking-wider">Worst Week</span>
                </div>
                <p className="text-white font-semibold">{data.worstWeek.weekLabel}</p>
                <p className="text-rose-400 font-mono font-bold text-xl mt-1">{fmtRR(data.worstWeek.netRR)}</p>
              </div>
            )}
            {data.bestMonth && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">Best Month</span>
                </div>
                <p className="text-white font-semibold">{data.bestMonth.label}</p>
                <p className="text-emerald-400 font-mono font-bold text-xl mt-1">{fmtRR(data.bestMonth.netRR)}</p>
              </div>
            )}
            {data.worstMonth && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-5 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                  <span className="text-xs text-rose-400 font-semibold uppercase tracking-wider">Worst Month</span>
                </div>
                <p className="text-white font-semibold">{data.worstMonth.label}</p>
                <p className="text-rose-400 font-mono font-bold text-xl mt-1">{fmtRR(data.worstMonth.netRR)}</p>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* 5. Avg RRR trend */}
      {rrrData.length > 0 && (
        <Section title="Average RRR per Trade" icon={BarChart2}>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between mb-5">
              <span className="text-sm text-muted-foreground">Avg risk-reward ratio per period</span>
              <div className="flex gap-1 rounded-lg bg-white/5 p-1">
                {(["monthly", "yearly"] as const).map(g => (
                  <button
                    key={g}
                    onClick={() => setRRRGranularity(g)}
                    className="px-3 py-1 rounded-md text-xs font-medium transition-colors"
                    style={{
                      background: rrrGranularity === g ? "rgba(255,255,255,0.10)" : "transparent",
                      color: rrrGranularity === g ? "#fff" : "#64748b",
                    }}
                  >
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {rrrData.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">No archived data for this view.</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={rrrData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: string) => v.length > 10 ? v.slice(0, 9) + "…" : v}
                  />
                  <YAxis
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `${v.toFixed(1)}R`}
                    width={44}
                  />
                  <Tooltip content={<RRRTooltip />} />
                  <Bar dataKey="avgRRR" radius={[4, 4, 0, 0]}>
                    {rrrData.map((entry, index) => (
                      <Cell key={index} fill={entry.avgRRR >= 1 ? "#38bdf8" : "#94a3b8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Section>
      )}

      {/* 6. RRR Distribution histogram */}
      {data.rrrDistribution.some(b => b.count > 0) && (
        <Section title="RRR Distribution" icon={BarChart2}>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
            <span className="text-sm text-muted-foreground">Trade count per RRR bucket</span>
            <ResponsiveContainer width="100%" height={180} className="mt-5">
              <BarChart data={data.rrrDistribution} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => `${v}R`}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={32}
                />
                <Tooltip
                  content={<RRRHistogramTooltip onCountClick={setSelectedBucket} />}
                  wrapperStyle={{ pointerEvents: "auto" }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {data.rrrDistribution.map((bucket, i) => (
                    <Cell
                      key={i}
                      fill={bucket.count > 0 ? "#a78bfa" : "rgba(255,255,255,0.06)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

      {/* Bucket drill-down modal (RRR histogram) */}
      <BucketTradesModal bucket={selectedBucket} onClose={() => setSelectedBucket(null)} />

      {/* 7. By Setup Type */}
      {data.bySetupType.length > 0 && (
        <Section title="By Setup Type" icon={Tag}>
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col />
                <col style={{ width: "64px" }} />
                <col style={{ width: "74px" }} />
                <col style={{ width: "96px" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.04]">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Setup</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Trades</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Win Rate</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Net RR</th>
                </tr>
              </thead>
              <tbody>
                {data.bySetupType.map((row, i) => (
                  <tr
                    key={row.setupTypeId ?? "untagged"}
                    className={`hover:bg-white/[0.03] cursor-pointer transition-colors ${i < data.bySetupType.length - 1 ? "border-b border-white/5" : ""}`}
                    onClick={() => setSelectedSetupRow(row)}
                  >
                    <td className="px-4 py-3 overflow-hidden">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="flex-shrink-0 w-2.5 h-2.5 rounded-full ring-1 ring-white/20"
                          style={{ backgroundColor: row.color ?? "rgba(255,255,255,0.2)" }}
                        />
                        <span className="text-white font-semibold truncate block">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-1.5 py-3 text-right text-muted-foreground whitespace-nowrap">{row.totalTrades}</td>
                    <td className="px-1.5 py-3 text-right font-semibold whitespace-nowrap" style={{ color: row.winRate >= 50 ? "#34d399" : "#fb7185" }}>{row.winRate}%</td>
                    <td className="px-3 py-3 text-right font-mono font-semibold whitespace-nowrap" style={{ color: rrColor(row.netRR) }}>{fmtRR(row.netRR)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Setup type drill-down modal */}
      <BucketTradesModal
        bucket={
          selectedSetupRow
            ? {
                label: selectedSetupRow.name,
                min: 0,
                max: null,
                count: selectedSetupRow.totalTrades,
                trades: selectedSetupRow.trades,
              }
            : null
        }
        subtitle={selectedSetupRow?.description ?? null}
        title={selectedSetupRow?.name ?? null}
        onClose={() => setSelectedSetupRow(null)}
      />

      {/* Post-Loss Performance ("Tilt Report") */}
      {(data.postLossPerformance ?? []).some((r: AnalysisPostLossRow) => r.totalTrades > 0) && (
        <Section title="Post-Loss Performance" icon={Flame}>
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col />
                <col style={{ width: "64px" }} />
                <col style={{ width: "74px" }} />
                <col style={{ width: "96px" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.04]">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">After Streak</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Trades</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Win Rate</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Net RR</th>
                </tr>
              </thead>
              <tbody>
                {(data.postLossPerformance ?? []).map((row: AnalysisPostLossRow, i: number) => (
                  <tr
                    key={row.afterLosses}
                    className={`transition-colors ${row.totalTrades > 0 ? "hover:bg-white/[0.03] cursor-pointer" : ""} ${i < (data.postLossPerformance ?? []).length - 1 ? "border-b border-white/5" : ""}`}
                    onClick={row.totalTrades > 0 ? () => setSelectedTiltRow(row) : undefined}
                  >
                    <td className="px-4 py-3 text-white font-semibold">{row.label}</td>
                    <td className="px-1.5 py-3 text-right text-muted-foreground whitespace-nowrap">{row.totalTrades}</td>
                    <td className="px-1.5 py-3 text-right font-semibold whitespace-nowrap" style={{ color: row.totalTrades > 0 ? (row.winRate >= 50 ? "#34d399" : "#fb7185") : "#64748b" }}>
                      {row.totalTrades > 0 ? `${row.winRate}%` : "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold whitespace-nowrap" style={{ color: row.totalTrades > 0 ? rrColor(row.netRR) : "#64748b" }}>
                      {row.totalTrades > 0 ? fmtRR(row.netRR) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Post-Loss Performance drill-down modal */}
      <BucketTradesModal
        bucket={
          selectedTiltRow
            ? {
                label: selectedTiltRow.label,
                min: 0,
                max: null,
                count: selectedTiltRow.totalTrades,
                trades: selectedTiltRow.trades,
              }
            : null
        }
        title={selectedTiltRow?.label ?? null}
        onClose={() => setSelectedTiltRow(null)}
      />

      {/* 8. Drawdown & Recovery */}
      <Section title="Drawdown & Recovery" icon={TrendingDown}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 space-y-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Max Drawdown</span>
            <p className="text-2xl font-bold" style={{ color: data.maxDrawdown > 0 ? "#fb7185" : "#94a3b8" }}>
              {data.maxDrawdown > 0 ? `-${data.maxDrawdown.toFixed(2)}R` : "—"}
            </p>
            {data.maxDrawdownWeekLabel && (
              <p className="text-xs text-muted-foreground">trough at {data.maxDrawdownWeekLabel}</p>
            )}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 space-y-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Recovery Time</span>
            <p className="text-2xl font-bold text-white">
              {data.recoveryWeeks != null ? `${data.recoveryWeeks}w` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">
              {data.recoveryWeeks != null ? "weeks to recover from peak" : data.maxDrawdown > 0 ? "not yet recovered" : "no drawdown"}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 space-y-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Longest Loss Streak</span>
            <p className="text-2xl font-bold text-white">
              {data.longestTradeStreak ? `${data.longestTradeStreak.length} trades` : "—"}
            </p>
            {data.longestTradeStreak?.startWeekLabel && (
              <p className="text-xs text-muted-foreground">
                {data.longestTradeStreak.startWeekLabel === data.longestTradeStreak.endWeekLabel
                  ? data.longestTradeStreak.startWeekLabel
                  : `${data.longestTradeStreak.startWeekLabel} → ${data.longestTradeStreak.endWeekLabel}`}
              </p>
            )}
          </div>
        </div>
        {data.longestWeekStreak && (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Longest no-win week streak</span>
            <span className="text-white font-semibold">
              {data.longestWeekStreak.length} week{data.longestWeekStreak.length !== 1 ? "s" : ""}
              {data.longestWeekStreak.startWeekLabel && (
                <span className="text-muted-foreground font-normal text-xs ml-2">
                  ({data.longestWeekStreak.startWeekLabel === data.longestWeekStreak.endWeekLabel
                    ? data.longestWeekStreak.startWeekLabel
                    : `${data.longestWeekStreak.startWeekLabel} → ${data.longestWeekStreak.endWeekLabel}`})
                </span>
              )}
            </span>
          </div>
        )}
      </Section>

      {/* 7. Consistency */}
      <Section title="Consistency" icon={Zap}>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-2xl font-bold text-white">{data.consistency.rate}%</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {data.consistency.weeksWithTrades} of {data.consistency.totalWeeks} weeks had trades logged
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>{data.consistency.totalWeeks - data.consistency.weeksWithTrades} weeks empty</p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${data.consistency.rate}%`,
                background: data.consistency.rate >= 75 ? "#34d399" : data.consistency.rate >= 50 ? "#60a5fa" : "#fb7185",
              }}
            />
          </div>
        </div>
      </Section>

      {/* Hidden export card, rendered off-screen for dom-to-image-more capture */}
      <div style={{ position: "fixed", top: -9999, left: -9999, pointerEvents: "none" }}>
        <AnalysisCard
          ref={cardRef}
          theme={exportTheme}
          data={data}
          pageTitle={pageTitle}
          pageSubtitle={pageSubtitle}
          cumulativeData={cumulativeData}
          chartGranularityLabel={chartGranularity === "weekly" ? "Weekly" : "Monthly"}
          isYearScoped={isYearScoped}
        />
      </div>
    </div>
  );
}
