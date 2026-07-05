import { format, parseISO } from "date-fns";
import {
  useListTrades,
  useGetStatsSummary,
  useGetWeeklyStats,
} from "@workspace/api-client-react";
import type { Week } from "@workspace/api-client-react";
import { useOrderedWeeks } from "@/hooks/use-ordered-weeks";
import { useIsMobile } from "@/hooks/use-mobile";

// ─── theme engine ─────────────────────────────────────────────────────────────

export type LedgerTheme = "obsidian" | "midnight" | "ember" | "matrix";

export type ThemeTokens = {
  name: string;
  dot: string;
  pageBg: string;
  bg: string;
  containerBorder: string;
  containerShadow: string;
  headerBg: string;
  weekBg: string;
  rowBg: string;
  finaleBg: string;
  totalBg: string;
  grandBg: string;
  grandHeadBg: string;
  divider: string;
  dividerStrong: string;
  textPrimary: string;
  textSecond: string;
  textMuted: string;
  win: string;
  winBg: string;
  loss: string;
  lossBg: string;
  be: string;
  beBg: string;
  accent: string;
  finaleColor: string;
  grandAccent: string;
};

export const THEMES: Record<LedgerTheme, ThemeTokens> = {
  obsidian: {
    name: "Obsidian",
    dot: "#94a3b8",
    pageBg: "#030305",
    bg: "#070709",
    containerBorder: "rgba(255,255,255,0.07)",
    containerShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 12px 40px rgba(0,0,0,0.6)",
    headerBg: "rgba(255,255,255,0.04)",
    weekBg: "rgba(255,255,255,0.025)",
    rowBg: "rgba(255,255,255,0.012)",
    finaleBg: "rgba(255,255,255,0.008)",
    totalBg: "rgba(255,255,255,0.03)",
    grandBg: "rgba(255,255,255,0.035)",
    grandHeadBg: "rgba(255,255,255,0.055)",
    divider: "rgba(255,255,255,0.05)",
    dividerStrong: "rgba(255,255,255,0.09)",
    textPrimary: "#f8fafc",
    textSecond: "#94a3b8",
    textMuted: "#334155",
    win: "#22c55e",
    winBg: "rgba(34,197,94,0.11)",
    loss: "#ef4444",
    lossBg: "rgba(239,68,68,0.11)",
    be: "#64748b",
    beBg: "rgba(100,116,139,0.11)",
    accent: "#cbd5e1",
    finaleColor: "#475569",
    grandAccent: "#e2e8f0",
  },
  midnight: {
    name: "Midnight",
    dot: "#3b82f6",
    pageBg: "#010610",
    bg: "#020c1a",
    containerBorder: "rgba(59,130,246,0.18)",
    containerShadow: "inset 0 1px 0 rgba(99,160,255,0.10), 0 12px 40px rgba(0,8,40,0.7)",
    headerBg: "rgba(59,130,246,0.09)",
    weekBg: "rgba(59,130,246,0.05)",
    rowBg: "rgba(59,130,246,0.025)",
    finaleBg: "rgba(59,130,246,0.018)",
    totalBg: "rgba(59,130,246,0.07)",
    grandBg: "rgba(59,130,246,0.08)",
    grandHeadBg: "rgba(59,130,246,0.14)",
    divider: "rgba(59,130,246,0.09)",
    dividerStrong: "rgba(59,130,246,0.20)",
    textPrimary: "#e0e7ff",
    textSecond: "#93c5fd",
    textMuted: "#1e40af",
    win: "#34d399",
    winBg: "rgba(52,211,153,0.11)",
    loss: "#f87171",
    lossBg: "rgba(248,113,113,0.11)",
    be: "#818cf8",
    beBg: "rgba(129,140,248,0.11)",
    accent: "#60a5fa",
    finaleColor: "#3b82f6",
    grandAccent: "#93c5fd",
  },
  ember: {
    name: "Ember",
    dot: "#ef4444",
    pageBg: "#090605",
    bg: "#0d0a08",
    containerBorder: "rgba(239,68,68,0.22)",
    containerShadow: "inset 0 1px 0 rgba(255,80,80,0.08), 0 12px 40px rgba(30,0,0,0.6)",
    headerBg: "rgba(239,68,68,0.08)",
    weekBg: "rgba(239,68,68,0.04)",
    rowBg: "rgba(239,68,68,0.018)",
    finaleBg: "rgba(239,68,68,0.013)",
    totalBg: "rgba(239,68,68,0.055)",
    grandBg: "rgba(239,68,68,0.065)",
    grandHeadBg: "rgba(239,68,68,0.13)",
    divider: "rgba(239,68,68,0.08)",
    dividerStrong: "rgba(239,68,68,0.20)",
    textPrimary: "#fef2f2",
    textSecond: "#fca5a5",
    textMuted: "#7f1d1d",
    win: "#4ade80",
    winBg: "rgba(74,222,128,0.11)",
    loss: "#ef4444",
    lossBg: "rgba(239,68,68,0.16)",
    be: "#9ca3af",
    beBg: "rgba(156,163,175,0.10)",
    accent: "#f87171",
    finaleColor: "#b91c1c",
    grandAccent: "#fca5a5",
  },
  matrix: {
    name: "Neon Matrix",
    dot: "#4ade80",
    pageBg: "#050805",
    bg: "#080b08",
    containerBorder: "rgba(74,222,128,0.20)",
    containerShadow: "inset 0 1px 0 rgba(74,222,128,0.09), 0 12px 40px rgba(0,18,0,0.7)",
    headerBg: "rgba(74,222,128,0.07)",
    weekBg: "rgba(74,222,128,0.035)",
    rowBg: "rgba(74,222,128,0.015)",
    finaleBg: "rgba(74,222,128,0.010)",
    totalBg: "rgba(74,222,128,0.05)",
    grandBg: "rgba(74,222,128,0.06)",
    grandHeadBg: "rgba(74,222,128,0.11)",
    divider: "rgba(74,222,128,0.08)",
    dividerStrong: "rgba(74,222,128,0.17)",
    textPrimary: "#f0fff4",
    textSecond: "#86efac",
    textMuted: "#14532d",
    win: "#4ade80",
    winBg: "rgba(74,222,128,0.12)",
    loss: "#f87171",
    lossBg: "rgba(248,113,113,0.12)",
    be: "#6b7280",
    beBg: "rgba(107,114,128,0.10)",
    accent: "#4ade80",
    finaleColor: "#16a34a",
    grandAccent: "#86efac",
  },
};

// ─── constants ────────────────────────────────────────────────────────────────

const FONT = "'Inter','Segoe UI',system-ui,-apple-system,sans-serif";
const MONO = "'JetBrains Mono','Fira Code','Cascadia Code',ui-monospace,monospace";

// 4-column proportions — wider first two cols on mobile so labels aren't clipped
const COLS_DESKTOP = ["8%", "16%", "38%", "38%"];
const COLS_MOBILE  = ["14%", "22%", "32%", "32%"];

// ─── helpers ──────────────────────────────────────────────────────────────────

function deriveMonthLabel(weeks: Week[]): string {
  if (!weeks.length) return "All Time";
  const dates = weeks
    .map((w) => { try { return parseISO(w.startDate); } catch { return null; } })
    .filter(Boolean) as Date[];
  if (!dates.length) return "All Time";
  const first = dates.reduce((a, b) => (a < b ? a : b));
  const last  = dates.reduce((a, b) => (a > b ? a : b));
  const [fm, fy] = [format(first, "MMM"), format(first, "yyyy")];
  const [lm, ly] = [format(last,  "MMM"), format(last,  "yyyy")];
  if (fm === lm && fy === ly) return `${fm} ${fy}`;
  return fy === ly ? `${fm} – ${lm} ${fy}` : `${fm} ${fy} – ${lm} ${ly}`;
}

function sign(v: number) { return v > 0 ? "+" : ""; }

function ResultPill({ result, t }: { result: string; t: ThemeTokens }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    Win:  { label: "Win",  color: t.win,  bg: t.winBg  },
    Loss: { label: "Loss", color: t.loss, bg: t.lossBg },
    BE:   { label: "BE",   color: t.be,   bg: t.beBg   },
  };
  const s = map[result] ?? map.BE;
  return (
    <span style={{
      display: "inline-block",
      padding: "3px 11px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.05em",
      color: s.color,
      background: s.bg,
      fontFamily: FONT,
    }}>
      {s.label}
    </span>
  );
}

// ─── week section ─────────────────────────────────────────────────────────────

type WeeklyStat = {
  weekId: number; weekLabel: string;
  wins: number; losses: number; breakEvens: number;
  totalTrades: number; winRate: number; netRR: number; netPips: number;
};

function WeekSection({ week, weeklyStat, t, isMobile }: {
  week: Week;
  weeklyStat: WeeklyStat | undefined;
  t: ThemeTokens;
  isMobile: boolean;
}) {
  const { data: trades = [] } = useListTrades({ weekId: week.id });

  const COLS = isMobile ? COLS_MOBILE : COLS_DESKTOP;
  const hPad = isMobile ? 8 : 20;
  const vPad = isMobile ? 10 : 12;

  const row: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: COLS.join(" "),
    borderBottom: `1px solid ${t.divider}`,
    alignItems: "center",
  };

  const cell: React.CSSProperties = {
    padding: `${vPad}px ${hPad}px`,
    fontFamily: FONT,
    fontSize: isMobile ? 12 : 13,
    color: t.textPrimary,
  };

  const pipColor = (v: number) => v > 0 ? t.win : v < 0 ? t.loss : t.be;
  const rrColor  = (v: number) => v > 0 ? t.win : v < 0 ? t.loss : t.be;

  return (
    <>
      {/* Week label row */}
      <div style={{
        padding: `8px ${hPad}px`,
        background: t.weekBg,
        borderTop: `1px solid ${t.dividerStrong}`,
        borderBottom: `1px solid ${t.divider}`,
        display: "flex",
        alignItems: "baseline",
        gap: 10,
      }}>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.13em",
          color: t.textMuted,
          fontFamily: FONT,
        }}>
          Week
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: t.textSecond, fontFamily: FONT }}>
          {week.label}
        </span>
        {week.startDate && (
          <span style={{ fontSize: 11, color: t.textMuted, fontFamily: FONT }}>
            {format(parseISO(week.startDate), "MMM d, yyyy")}
          </span>
        )}
      </div>

      {/* Trade rows */}
      {trades.length === 0 ? (
        <div style={{ ...row, background: t.rowBg }}>
          {COLS.map((_, i) => (
            <div key={i} style={{ ...cell, color: t.textMuted, textAlign: i === 0 ? "center" : "left" }}>
              —
            </div>
          ))}
        </div>
      ) : trades.map((trade) => (
        <div key={trade.id} style={{ ...row, background: t.rowBg }}>
          <div style={{ ...cell, textAlign: "center", fontFamily: MONO, fontWeight: 600, fontSize: 12, color: t.textSecond }}>
            {trade.tradeNumber}
          </div>
          <div style={cell}>
            <ResultPill result={trade.result} t={t} />
          </div>
          <div style={{ ...cell, fontFamily: MONO, fontSize: 12, color: t.textSecond, whiteSpace: "nowrap", overflow: "hidden" }}>
            {isMobile ? `1/${trade.rrr.toFixed(2)}` : `1 / ${trade.rrr.toFixed(2)}`}
          </div>
          <div style={{
            ...cell,
            fontFamily: MONO,
            fontWeight: 600,
            color: pipColor(trade.pips),
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}>
            {sign(trade.pips)}{trade.pips.toFixed(1)}
            {!isMobile && <span style={{ fontSize: 11, fontWeight: 400, color: t.textMuted, marginLeft: 4 }}>pips</span>}
          </div>
        </div>
      ))}

      {/* Weekly Finale */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: `7px ${hPad}px`,
        background: t.finaleBg,
        borderBottom: `1px solid ${t.divider}`,
      }}>
        <div style={{ flex: 1, height: 1, background: t.divider }} />
        <span style={{
          fontFamily: FONT,
          fontSize: 10,
          fontStyle: "italic",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.15em",
          color: t.finaleColor,
          whiteSpace: "nowrap",
        }}>
          Weekly Finale
        </span>
        <div style={{ flex: 1, height: 1, background: t.divider }} />
      </div>

      {/* Total row */}
      <div style={{ ...row, background: t.totalBg, borderBottom: `1px solid ${t.dividerStrong}` }}>
        <div style={{ ...cell, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: t.textMuted, textAlign: "center" }}>
          Total
        </div>
        <div style={{ ...cell, fontFamily: MONO, fontWeight: 700, fontSize: isMobile ? 12 : 13, color: t.textPrimary }}>
          {weeklyStat ? `${weeklyStat.winRate}%` : "0%"}
        </div>
        <div style={{ ...cell, fontFamily: MONO, fontWeight: 700, fontSize: isMobile ? 12 : 13, color: weeklyStat ? rrColor(weeklyStat.netRR) : t.be, whiteSpace: "nowrap", overflow: "hidden" }}>
          {weeklyStat ? `${sign(weeklyStat.netRR)}${weeklyStat.netRR.toFixed(2)}${isMobile ? "" : " RR"}` : "—"}
        </div>
        <div style={{ ...cell, fontFamily: MONO, fontWeight: 700, fontSize: isMobile ? 12 : 13, color: weeklyStat ? pipColor(weeklyStat.netPips) : t.be, whiteSpace: "nowrap", overflow: "hidden" }}>
          {weeklyStat ? `${sign(weeklyStat.netPips)}${weeklyStat.netPips.toFixed(1)}${isMobile ? "" : " pips"}` : "—"}
        </div>
      </div>
    </>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

interface LedgerSheetProps {
  theme?: LedgerTheme;
  className?: string;
  titleOverride?: string;
  tag?: string;
  month?: string;
}

export function LedgerSheet({ theme = "obsidian", className, titleOverride, tag, month }: LedgerSheetProps) {
  const { orderedWeeks: weeks,    isLoading: wL  } = useOrderedWeeks();
  const { data: summary,          isLoading: sL  } = useGetStatsSummary();
  const { data: weeklyStats = [], isLoading: wsL } = useGetWeeklyStats();
  const isMobile = useIsMobile();

  const t = THEMES[theme];

  if (wL || sL || wsL) {
    return (
      <div style={{
        background: t.bg,
        border: `1px solid ${t.containerBorder}`,
        borderRadius: 16,
        padding: 48,
        textAlign: "center",
        color: t.textMuted,
        fontFamily: FONT,
      }}>
        Loading ledger…
      </div>
    );
  }

  const COLS = isMobile ? COLS_MOBILE : COLS_DESKTOP;
  const hPad = isMobile ? 8 : 20;

  const colLabelCell: React.CSSProperties = {
    padding: `${isMobile ? 8 : 10}px ${hPad}px`,
    fontFamily: FONT,
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.10em",
    color: t.textMuted,
  };

  // Grand Total uses a different 4-column split
  const GT_COLS = isMobile ? "14% 26% 30% 30%" : "11% 27% 31% 31%";
  const gtPad   = isMobile ? `14px ${hPad}px` : "16px 18px";

  const pipColor = (v: number) => v > 0 ? t.win : v < 0 ? t.loss : t.be;
  const rrColor  = (v: number) => v > 0 ? t.win : v < 0 ? t.loss : t.be;

  return (
    <div
      className={className}
      style={{
        background: t.bg,
        border: `1px solid ${t.containerBorder}`,
        boxShadow: t.containerShadow,
        borderRadius: 16,
        overflow: "hidden",
        fontFamily: FONT,
      }}
    >
      {/* Stats header */}
      <div style={{
        padding: isMobile ? "36px 16px 16px" : "46px 24px 20px",
        textAlign: "center",
        background: t.headerBg,
        borderBottom: `1px solid ${t.dividerStrong}`,
        position: "relative",
      }}>
        {/* Month badge — top-left corner */}
        {month && (
          <div style={{
            position: "absolute",
            top: 12,
            left: 14,
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: t.textMuted,
            padding: "3px 8px",
            borderRadius: 999,
            border: `1px solid ${t.divider}`,
            background: "rgba(255,255,255,0.03)",
            fontFamily: MONO,
          }}>
            {month}
          </div>
        )}
        {/* Y-II tag — top-right corner */}
        {tag && (
          <div style={{
            position: "absolute",
            top: 12,
            right: 14,
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: t.accent,
            padding: "3px 8px",
            borderRadius: 999,
            border: `1px solid ${t.containerBorder}`,
            background: `${t.accent}14`,
            fontFamily: MONO,
          }}>
            {tag}
          </div>
        )}
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.20em",
          color: t.textMuted,
          marginBottom: 6,
        }}>
          Stats Summary
        </div>
        <div style={{
          fontSize: isMobile ? 17 : 20,
          fontWeight: 800,
          color: t.textPrimary,
          letterSpacing: "-0.01em",
        }}>
          {titleOverride || deriveMonthLabel(weeks)}
        </div>
      </div>

      {/* Column headers */}
      <div style={{
        display: "grid",
        gridTemplateColumns: COLS.join(" "),
        background: t.headerBg,
        borderBottom: `1px solid ${t.dividerStrong}`,
      }}>
        <div style={{ ...colLabelCell, textAlign: "center" }}>Trade</div>
        <div style={colLabelCell}>Result</div>
        <div style={colLabelCell}>{isMobile ? "RRR" : "Risk-Reward (RRR)"}</div>
        <div style={colLabelCell}>{isMobile ? "Pips" : "Pips Gained / Loss"}</div>
      </div>

      {/* Week blocks */}
      {weeks.map((week) => {
        const weeklyStat = weeklyStats.find((s) => s.weekId === week.id) as WeeklyStat | undefined;
        return <WeekSection key={week.id} week={week} weeklyStat={weeklyStat} t={t} isMobile={isMobile} />;
      })}

      {/* Grand Total */}
      {summary && (
        <>
          {/* Grand Total — banner */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: `14px ${isMobile ? 12 : 24}px`,
            background: t.grandHeadBg,
            borderTop: `1px solid ${t.dividerStrong}`,
            borderBottom: `1px solid ${t.dividerStrong}`,
          }}>
            <div style={{ flex: 1, height: 1, background: t.dividerStrong }} />
            <span style={{
              fontFamily: FONT,
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.22em",
              color: t.grandAccent,
              whiteSpace: "nowrap",
            }}>
              Grand Total
            </span>
            <div style={{ flex: 1, height: 1, background: t.dividerStrong }} />
          </div>

          {/* Grand Total — column labels */}
          <div style={{
            display: "grid",
            gridTemplateColumns: GT_COLS,
            background: t.grandBg,
            borderBottom: `1px solid ${t.divider}`,
          }}>
            {["Trades", "Win Rate", "Net RR", "Net Pips"].map((label) => (
              <div key={label} style={{
                ...colLabelCell,
                color: t.grandAccent,
                opacity: 0.55,
              }}>
                {label}
              </div>
            ))}
          </div>

          {/* Grand Total — values row */}
          <div style={{
            display: "grid",
            gridTemplateColumns: GT_COLS,
            background: t.grandBg,
            alignItems: "center",
          }}>
            {/* Trades */}
            <div style={{
              padding: gtPad,
              fontFamily: MONO, fontWeight: 800, fontSize: isMobile ? 18 : 22,
              color: t.textPrimary,
            }}>
              {summary.totalTrades}
            </div>

            {/* Win Rate */}
            <div style={{ padding: gtPad }}>
              <div style={{
                fontFamily: MONO, fontWeight: 800, fontSize: isMobile ? 14 : 16,
                color: t.textPrimary, marginBottom: 5,
              }}>
                {summary.winRate}%
              </div>
              <div style={{ fontSize: 10, color: t.textMuted, fontFamily: FONT }}>
                <span style={{ color: t.win }}>{summary.wins}W</span>
                {" "}
                <span style={{ color: t.loss }}>{summary.losses}L</span>
                {" "}
                <span style={{ color: t.be }}>{summary.breakEvens}BE</span>
              </div>
            </div>

            {/* Net RR */}
            <div style={{
              padding: gtPad,
              fontFamily: MONO, fontWeight: 800, fontSize: isMobile ? 14 : 18,
              color: rrColor(summary.netRR),
              whiteSpace: "nowrap", overflow: "hidden",
            }}>
              {sign(summary.netRR)}{summary.netRR.toFixed(2)}
              {!isMobile && <span style={{ fontSize: 11, fontWeight: 400, color: t.textMuted, marginLeft: 3 }}>R</span>}
            </div>

            {/* Net Pips */}
            <div style={{
              padding: gtPad,
              fontFamily: MONO, fontWeight: 800, fontSize: isMobile ? 14 : 18,
              color: pipColor(summary.netPips),
              whiteSpace: "nowrap", overflow: "hidden",
            }}>
              {sign(summary.netPips)}{summary.netPips.toFixed(1)}
              {!isMobile && <span style={{ fontSize: 11, fontWeight: 400, color: t.textMuted, marginLeft: 3 }}>pips</span>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
