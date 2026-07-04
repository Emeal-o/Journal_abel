import { format, parseISO } from "date-fns";
import {
  useListWeeks,
  useListTrades,
  useGetStatsSummary,
  useGetWeeklyStats,
} from "@workspace/api-client-react";
import type { Week } from "@workspace/api-client-react";

// ─── themes ──────────────────────────────────────────────────────────────────

export type LedgerTheme = "obsidian" | "midnight" | "ember";

type ThemeTokens = {
  bg: string;
  bgHeader: string;
  bgWeek: string;
  bgFinale: string;
  bgTotal: string;
  bgGrand: string;
  bgGrandHead: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecond: string;
  textMuted: string;
  win: string;
  loss: string;
  be: string;
  accent: string;
  finaleText: string;
  grandAccent: string;
};

const THEMES: Record<LedgerTheme, ThemeTokens> = {
  obsidian: {
    bg:           "#080808",
    bgHeader:     "rgba(255,255,255,0.07)",
    bgWeek:       "rgba(255,255,255,0.04)",
    bgFinale:     "rgba(255,255,255,0.02)",
    bgTotal:      "rgba(255,255,255,0.05)",
    bgGrand:      "rgba(255,255,255,0.06)",
    bgGrandHead:  "rgba(255,255,255,0.09)",
    border:       "rgba(255,255,255,0.12)",
    borderStrong: "rgba(255,255,255,0.20)",
    textPrimary:  "#ffffff",
    textSecond:   "#a0a0a0",
    textMuted:    "#555555",
    win:          "#22c55e",
    loss:         "#ef4444",
    be:           "#888888",
    accent:       "#ffffff",
    finaleText:   "#888888",
    grandAccent:  "#cccccc",
  },
  midnight: {
    bg:           "#05091a",
    bgHeader:     "rgba(99,102,241,0.14)",
    bgWeek:       "rgba(99,102,241,0.07)",
    bgFinale:     "rgba(99,102,241,0.04)",
    bgTotal:      "rgba(99,102,241,0.10)",
    bgGrand:      "rgba(99,102,241,0.10)",
    bgGrandHead:  "rgba(99,102,241,0.20)",
    border:       "rgba(99,102,241,0.20)",
    borderStrong: "rgba(99,102,241,0.38)",
    textPrimary:  "#e0e7ff",
    textSecond:   "#818cf8",
    textMuted:    "#3730a3",
    win:          "#34d399",
    loss:         "#f87171",
    be:           "#818cf8",
    accent:       "#a5b4fc",
    finaleText:   "#6366f1",
    grandAccent:  "#a5b4fc",
  },
  ember: {
    bg:           "#0c0900",
    bgHeader:     "rgba(251,191,36,0.10)",
    bgWeek:       "rgba(251,191,36,0.05)",
    bgFinale:     "rgba(251,191,36,0.03)",
    bgTotal:      "rgba(251,191,36,0.07)",
    bgGrand:      "rgba(251,191,36,0.09)",
    bgGrandHead:  "rgba(251,191,36,0.16)",
    border:       "rgba(251,191,36,0.14)",
    borderStrong: "rgba(251,191,36,0.28)",
    textPrimary:  "#fef9eb",
    textSecond:   "#d97706",
    textMuted:    "#78350f",
    win:          "#4ade80",
    loss:         "#f87171",
    be:           "#a78bfa",
    accent:       "#fbbf24",
    finaleText:   "#b45309",
    grandAccent:  "#fbbf24",
  },
};

// ─── helpers ──────────────────────────────────────────────────────────────────

const FONT = "'Inter','Segoe UI',system-ui,-apple-system,sans-serif";
const MONO = "'JetBrains Mono','Fira Code','Cascadia Code',ui-monospace,monospace";

function deriveMonthLabel(weeks: Week[]): string {
  if (weeks.length === 0) return "All Time";
  const dates = weeks
    .map((w) => { try { return parseISO(w.startDate); } catch { return null; } })
    .filter(Boolean) as Date[];
  if (dates.length === 0) return "All Time";
  const first = dates.reduce((a, b) => (a < b ? a : b));
  const last  = dates.reduce((a, b) => (a > b ? a : b));
  const fm = format(first, "MMM"), lm = format(last, "MMM");
  const fy = format(first, "yyyy"), ly = format(last, "yyyy");
  if (fm === lm && fy === ly) return `${fm} ${fy}`;
  if (fy === ly) return `${fm} – ${lm} ${fy}`;
  return `${fm} ${fy} – ${lm} ${ly}`;
}

function sign(v: number) { return v > 0 ? "+" : ""; }

// ─── per-week section (fetches own trades) ────────────────────────────────────

type WeeklyStat = {
  weekId: number; weekLabel: string;
  wins: number; losses: number; breakEvens: number;
  totalTrades: number; winRate: number; netRR: number; netPips: number;
};

function WeekSection({
  week, weeklyStat, t,
}: {
  week: Week;
  weeklyStat: WeeklyStat | undefined;
  t: ThemeTokens;
}) {
  const { data: trades = [] } = useListTrades({ weekId: week.id });

  const cell: React.CSSProperties = {
    padding: "7px 12px",
    border: `1px solid ${t.border}`,
    fontFamily: FONT,
    fontSize: 13,
    color: t.textPrimary,
    verticalAlign: "middle",
  };

  const resultLabel: Record<string, string> = { Win: "Win", Loss: "Loss", BE: "BE" };
  const resultColor: Record<string, string> = { Win: t.win, Loss: t.loss, BE: t.be };

  return (
    <>
      {/* Week header — spans all 4 cols */}
      <tr>
        <td
          colSpan={4}
          style={{
            ...cell,
            background: t.bgWeek,
            border: `1px solid ${t.border}`,
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.09em",
            color: t.textSecond,
            padding: "6px 12px",
          }}
        >
          Weekly Stats Summary — {week.label}
          {week.startDate && (
            <span style={{ fontWeight: 400, marginLeft: 8, color: t.textMuted }}>
              ({format(parseISO(week.startDate), "MMM d, yyyy")})
            </span>
          )}
        </td>
      </tr>

      {/* Trade rows */}
      {trades.length === 0 ? (
        <tr>
          {[0,1,2,3].map(i => (
            <td key={i} style={{ ...cell, color: t.textMuted, textAlign: "center" }}>—</td>
          ))}
        </tr>
      ) : trades.map((trade) => (
        <tr key={trade.id}>
          <td style={{ ...cell, textAlign: "center", fontFamily: MONO, fontWeight: 700, fontSize: 12 }}>
            {trade.tradeNumber}
          </td>
          <td style={cell}>
            <span style={{
              display: "inline-block",
              padding: "2px 9px",
              borderRadius: 3,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.05em",
              color: resultColor[trade.result] ?? t.be,
              border: `1px solid ${resultColor[trade.result] ?? t.be}`,
              background: `${resultColor[trade.result] ?? t.be}18`,
            }}>
              {resultLabel[trade.result] ?? trade.result}
            </span>
          </td>
          <td style={{ ...cell, fontFamily: MONO, fontSize: 12, color: t.textSecond }}>
            1&nbsp;/&nbsp;{trade.rrr.toFixed(2)}
          </td>
          <td style={{
            ...cell,
            fontFamily: MONO,
            fontWeight: 600,
            color: trade.pips > 0 ? t.win : trade.pips < 0 ? t.loss : t.be,
          }}>
            {sign(trade.pips)}{trade.pips.toFixed(1)}&thinsp;pips
          </td>
        </tr>
      ))}

      {/* Weekly Finale row */}
      <tr>
        <td
          colSpan={4}
          style={{
            ...cell,
            background: t.bgFinale,
            textAlign: "center",
            fontStyle: "italic",
            fontWeight: 600,
            fontSize: 12,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: t.finaleText,
            padding: "5px 12px",
          }}
        >
          Weekly Finale
        </td>
      </tr>

      {/* Weekly total row */}
      <tr>
        <td style={{ ...cell, background: t.bgTotal, fontWeight: 700, fontSize: 12, color: t.textSecond, fontFamily: MONO }}>
          Total
        </td>
        <td style={{ ...cell, background: t.bgTotal, fontFamily: MONO, fontWeight: 700, color: t.textPrimary }}>
          {weeklyStat ? `${weeklyStat.winRate}%` : "0%"}
        </td>
        <td style={{
          ...cell,
          background: t.bgTotal,
          fontFamily: MONO,
          fontWeight: 700,
          color: weeklyStat && weeklyStat.netRR > 0 ? t.win : weeklyStat && weeklyStat.netRR < 0 ? t.loss : t.be,
        }}>
          {weeklyStat ? `${sign(weeklyStat.netRR)}${weeklyStat.netRR.toFixed(2)} RR` : "—"}
        </td>
        <td style={{
          ...cell,
          background: t.bgTotal,
          fontFamily: MONO,
          fontWeight: 700,
          color: weeklyStat && weeklyStat.netPips > 0 ? t.win : weeklyStat && weeklyStat.netPips < 0 ? t.loss : t.be,
        }}>
          {weeklyStat ? `${sign(weeklyStat.netPips)}${weeklyStat.netPips.toFixed(1)} pips` : "—"}
        </td>
      </tr>
    </>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

interface LedgerSheetProps {
  theme?: LedgerTheme;
  className?: string;
}

export function LedgerSheet({ theme = "obsidian", className }: LedgerSheetProps) {
  const { data: weeks = [],      isLoading: wL  } = useListWeeks();
  const { data: summary,         isLoading: sL  } = useGetStatsSummary();
  const { data: weeklyStats = [], isLoading: wsL } = useGetWeeklyStats();

  const t = THEMES[theme];

  if (wL || sL || wsL) {
    return (
      <div style={{ background: t.bg, borderRadius: 10, padding: 48, textAlign: "center", color: t.textMuted, fontFamily: FONT }}>
        Loading ledger…
      </div>
    );
  }

  const monthLabel = deriveMonthLabel(weeks);

  const th: React.CSSProperties = {
    padding: "8px 12px",
    border: `1px solid ${t.borderStrong}`,
    background: t.bgHeader,
    color: t.textSecond,
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.09em",
    textAlign: "left",
    fontFamily: FONT,
  };

  return (
    <div
      className={className}
      style={{
        background: t.bg,
        borderRadius: 10,
        padding: "28px 28px 32px",
        fontFamily: FONT,
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "10%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "36%" }} />
          <col style={{ width: "36%" }} />
        </colgroup>

        <thead>
          {/* Month title */}
          <tr>
            <td
              colSpan={4}
              style={{
                padding: "14px 16px 12px",
                border: `1px solid ${t.borderStrong}`,
                background: t.bgHeader,
                textAlign: "center",
                fontWeight: 800,
                fontSize: 15,
                color: t.textPrimary,
                letterSpacing: "0.03em",
                fontFamily: FONT,
              }}
            >
              {monthLabel}&ensp;·&ensp;Stats Summary
            </td>
          </tr>

          {/* Column headers */}
          <tr>
            <th style={{ ...th, textAlign: "center" }}>Trade</th>
            <th style={th}>Result</th>
            <th style={th}>Risk-Reward (RRR)</th>
            <th style={th}>Pips Gained / Loss</th>
          </tr>
        </thead>

        <tbody>
          {/* Week blocks */}
          {weeks.map((week) => {
            const weeklyStat = weeklyStats.find((s) => s.weekId === week.id) as WeeklyStat | undefined;
            return (
              <WeekSection key={week.id} week={week} weeklyStat={weeklyStat} t={t} />
            );
          })}

          {/* Grand Total */}
          {summary && (
            <>
              <tr>
                <td
                  colSpan={4}
                  style={{
                    padding: "8px 16px",
                    border: `1px solid ${t.borderStrong}`,
                    background: t.bgGrandHead,
                    textAlign: "center",
                    fontWeight: 700,
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.16em",
                    color: t.grandAccent,
                    fontFamily: FONT,
                  }}
                >
                  Grand Total
                </td>
              </tr>
              <tr>
                <th style={{ ...th, textAlign: "center", background: t.bgGrand }}>Trades</th>
                <th style={{ ...th, background: t.bgGrand }}>Win Rate</th>
                <th style={{ ...th, background: t.bgGrand }}>Net RR</th>
                <th style={{ ...th, background: t.bgGrand }}>Net Pips</th>
              </tr>
              <tr>
                <td style={{
                  padding: "14px 12px",
                  border: `1px solid ${t.border}`,
                  background: t.bgGrand,
                  textAlign: "center",
                  fontFamily: MONO,
                  fontWeight: 800,
                  fontSize: 22,
                  color: t.textPrimary,
                }}>
                  {summary.totalTrades}
                </td>
                <td style={{
                  padding: "14px 12px",
                  border: `1px solid ${t.border}`,
                  background: t.bgGrand,
                  fontFamily: MONO,
                  verticalAlign: "middle",
                }}>
                  <span style={{ fontWeight: 800, fontSize: 16, color: t.textPrimary }}>
                    {summary.winRate}%
                  </span>
                  <span style={{ display: "block", marginTop: 4, fontSize: 11, color: t.textSecond, fontFamily: FONT }}>
                    {summary.wins}W · {summary.losses}L · {summary.breakEvens}BE
                  </span>
                </td>
                <td style={{
                  padding: "14px 12px",
                  border: `1px solid ${t.border}`,
                  background: t.bgGrand,
                  fontFamily: MONO,
                  fontWeight: 800,
                  fontSize: 18,
                  color: summary.netRR > 0 ? t.win : summary.netRR < 0 ? t.loss : t.be,
                }}>
                  {sign(summary.netRR)}{summary.netRR.toFixed(2)}&thinsp;R
                </td>
                <td style={{
                  padding: "14px 12px",
                  border: `1px solid ${t.border}`,
                  background: t.bgGrand,
                  fontFamily: MONO,
                  fontWeight: 800,
                  fontSize: 18,
                  color: summary.netPips > 0 ? t.win : summary.netPips < 0 ? t.loss : t.be,
                }}>
                  {sign(summary.netPips)}{summary.netPips.toFixed(1)}&thinsp;pips
                </td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
