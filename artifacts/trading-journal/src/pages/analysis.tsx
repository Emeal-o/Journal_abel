import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, TrendingUp, TrendingDown, BarChart2, Activity, Target, Zap } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, BarChart, Bar, Cell,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalysis } from "@/lib/analysis-api";
import type { AnalysisCumulativePoint, AnalysisRRRPoint } from "@/lib/analysis-api";
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

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</h2>
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

// ─── page ─────────────────────────────────────────────────────────────────────

export function AnalysisPage() {
  const [, navigate] = useLocation();
  const { data, isLoading, error } = useAnalysis();
  const [chartGranularity, setChartGranularity] = useState<"weekly" | "monthly">("weekly");
  const [rrrGranularity, setRRRGranularity] = useState<"monthly" | "yearly">("monthly");

  // ── loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/archive")} className="text-muted-foreground hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-3xl font-bold tracking-tight text-white">All-Time Analysis</h1>
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
          <h1 className="text-3xl font-bold tracking-tight text-white">All-Time Analysis</h1>
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
          <h1 className="text-3xl font-bold tracking-tight text-white">All-Time Analysis</h1>
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
        <h1 className="text-3xl font-bold tracking-tight text-white">All-Time Analysis</h1>
        <p className="text-muted-foreground mt-1">Every trade across your entire journal history.</p>
      </div>

      {/* 1. All-time summary */}
      <Section title="All-Time Summary" icon={Activity}>
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

      {/* 6. Drawdown & Recovery */}
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
    </div>
  );
}
