import { format, parseISO } from "date-fns";
import {
  useListWeeks,
  useListTrades,
  useGetStatsSummary,
  useGetWeeklyStats,
} from "@workspace/api-client-react";
import type { Week } from "@workspace/api-client-react";

// ─── design tokens ───────────────────────────────────────────────────────────

const C = {
  bg:          "#0b0f19",
  bgCard:      "rgba(255,255,255,0.025)",
  bgWeekHead:  "rgba(255,255,255,0.018)",
  bgFinale:    "rgba(255,255,255,0.012)",
  bgTotal:     "rgba(255,255,255,0.032)",
  bgGrandHead: "rgba(99,102,241,0.10)",
  bgGrand:     "rgba(99,102,241,0.055)",
  divider:     "rgba(30,41,59,0.70)",
  dividerAcc:  "rgba(51,65,85,0.90)",
  textPrimary: "#f1f5f9",
  textSecond:  "#94a3b8",
  textMuted:   "#475569",
  win:         "#10b981",
  winBg:       "rgba(16,185,129,0.12)",
  winBorder:   "rgba(16,185,129,0.25)",
  loss:        "#ef4444",
  lossBg:      "rgba(239,68,68,0.12)",
  lossBorder:  "rgba(239,68,68,0.25)",
  be:          "#64748b",
  beBg:        "rgba(100,116,139,0.10)",
  beBorder:    "rgba(100,116,139,0.22)",
  accent:      "#818cf8",
  finale:      "#78716c",
};

const FONT = "'Inter','Segoe UI',system-ui,-apple-system,sans-serif";
const MONO = "'JetBrains Mono','Fira Code','Cascadia Code',monospace";

// ─── helpers ─────────────────────────────────────────────────────────────────

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

function ResultPill({ result }: { result: string }) {
  const styles: Record<string, React.CSSProperties> = {
    Win:  { color: C.win,  background: C.winBg,  border: `1px solid ${C.winBorder}` },
    Loss: { color: C.loss, background: C.lossBg, border: `1px solid ${C.lossBorder}` },
    BE:   { color: C.be,   background: C.beBg,   border: `1px solid ${C.beBorder}` },
  };
  const label: Record<string, string> = { Win: "Win", Loss: "Loss", BE: "BE" };
  const s = styles[result] ?? styles.BE;
  return (
    <span style={{
      ...s,
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.04em",
      fontFamily: FONT,
    }}>
      {label[result] ?? result}
    </span>
  );
}

function pipColor(v: number) {
  return v > 0 ? C.win : v < 0 ? C.loss : C.textSecond;
}
function rrColor(v: number) {
  return v > 0 ? C.win : v < 0 ? C.loss : C.textSecond;
}
function sign(v: number) { return v > 0 ? "+" : ""; }

// ─── column widths ────────────────────────────────────────────────────────────

const COL = ["9%", "18%", "36%", "37%"];

// ─── per-week block ───────────────────────────────────────────────────────────

type WeeklyStat = {
  weekId: number; weekLabel: string;
  wins: number; losses: number; breakEvens: number;
  totalTrades: number; winRate: number; netRR: number; netPips: number;
};

function WeekBlock({ week, weeklyStat }: { week: Week; weeklyStat: WeeklyStat | undefined }) {
  const { data: trades = [] } = useListTrades({ weekId: week.id });

  const rowBase: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: COL.join(" "),
    borderBottom: `1px solid ${C.divider}`,
    alignItems: "center",
  };

  const cellBase: React.CSSProperties = {
    padding: "11px 16px",
    fontFamily: FONT,
    fontSize: 13,
    color: C.textPrimary,
  };

  return (
    <div>
      {/* Week label row */}
      <div style={{
        padding: "9px 16px",
        background: C.bgWeekHead,
        borderBottom: `1px solid ${C.divider}`,
        borderTop: `1px solid ${C.dividerAcc}`,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        <span style={{
          fontFamily: FONT,
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.10em",
          color: C.textMuted,
        }}>Week</span>
        <span style={{
          fontFamily: FONT,
          fontSize: 12,
          fontWeight: 500,
          color: C.textSecond,
        }}>
          {week.label}
          {week.startDate
            ? <span style={{ color: C.textMuted, marginLeft: 8, fontWeight: 400 }}>
                — {format(parseISO(week.startDate), "MMM d, yyyy")}
              </span>
            : null}
        </span>
      </div>

      {/* Trade rows */}
      {trades.length === 0 ? (
        <div style={{ ...rowBase, background: C.bgCard }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ ...cellBase, color: C.textMuted }}>—</div>
          ))}
        </div>
      ) : (
        trades.map((trade) => (
          <div key={trade.id} style={{ ...rowBase, background: C.bgCard }}>
            <div style={{ ...cellBase, textAlign: "center", fontWeight: 700, fontFamily: MONO, color: C.textSecond, fontSize: 12 }}>
              {trade.tradeNumber}
            </div>
            <div style={cellBase}>
              <ResultPill result={trade.result} />
            </div>
            <div style={{ ...cellBase, fontFamily: MONO, fontSize: 12, color: C.textSecond }}>
              1 / {trade.rrr.toFixed(2)}
            </div>
            <div style={{ ...cellBase, fontFamily: MONO, fontSize: 13, fontWeight: 600, color: pipColor(trade.pips) }}>
              {sign(trade.pips)}{trade.pips.toFixed(1)}{" "}
              <span style={{ fontSize: 11, fontWeight: 400, color: C.textMuted }}>pips</span>
            </div>
          </div>
        ))
      )}

      {/* Weekly Finale divider */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 20px",
        background: C.bgFinale,
        borderBottom: `1px solid ${C.divider}`,
      }}>
        <div style={{ flex: 1, height: 1, background: C.divider }} />
        <span style={{
          fontFamily: FONT,
          fontSize: 11,
          fontStyle: "italic",
          fontWeight: 500,
          letterSpacing: "0.12em",
          color: C.finale,
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}>
          Weekly Finale
        </span>
        <div style={{ flex: 1, height: 1, background: C.divider }} />
      </div>

      {/* Weekly total row */}
      <div style={{
        ...rowBase,
        background: C.bgTotal,
        borderBottom: `1px solid ${C.dividerAcc}`,
      }}>
        <div style={{ ...cellBase, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: C.textMuted }}>
          Total
        </div>
        <div style={{ ...cellBase, fontFamily: MONO, fontWeight: 700, fontSize: 13, color: C.textPrimary }}>
          {weeklyStat ? `${weeklyStat.winRate}%` : "0%"}
        </div>
        <div style={{ ...cellBase, fontFamily: MONO, fontWeight: 700, fontSize: 13, color: weeklyStat ? rrColor(weeklyStat.netRR) : C.textSecond }}>
          {weeklyStat ? `${sign(weeklyStat.netRR)}${weeklyStat.netRR.toFixed(2)} RR` : "—"}
        </div>
        <div style={{ ...cellBase, fontFamily: MONO, fontWeight: 700, fontSize: 13, color: weeklyStat ? pipColor(weeklyStat.netPips) : C.textSecond }}>
          {weeklyStat ? `${sign(weeklyStat.netPips)}${weeklyStat.netPips.toFixed(1)} pips` : "—"}
        </div>
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

interface LedgerSheetProps {
  className?: string;
}

export function LedgerSheet({ className }: LedgerSheetProps) {
  const { data: weeks = [],    isLoading: wL } = useListWeeks();
  const { data: summary,       isLoading: sL } = useGetStatsSummary();
  const { data: weeklyStats = [], isLoading: wsL } = useGetWeeklyStats();

  if (wL || sL || wsL) {
    return (
      <div style={{ background: C.bg, borderRadius: 14, padding: 48, textAlign: "center", color: C.textMuted, fontFamily: FONT }}>
        Loading ledger…
      </div>
    );
  }

  const monthLabel = deriveMonthLabel(weeks);

  const colLabelStyle: React.CSSProperties = {
    padding: "10px 16px",
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.10em",
    color: C.textMuted,
  };

  return (
    <div
      className={className}
      style={{
        background: C.bg,
        borderRadius: 14,
        overflow: "hidden",
        fontFamily: FONT,
      }}
    >
      {/* Month header */}
      <div style={{
        padding: "22px 24px 20px",
        textAlign: "center",
        borderBottom: `1px solid ${C.dividerAcc}`,
        background: "rgba(255,255,255,0.02)",
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.18em",
          color: C.textMuted,
          marginBottom: 6,
        }}>
          Stats Summary
        </div>
        <div style={{
          fontSize: 22,
          fontWeight: 800,
          color: C.textPrimary,
          letterSpacing: "-0.01em",
        }}>
          {monthLabel}
        </div>
      </div>

      {/* Column headers */}
      <div style={{
        display: "grid",
        gridTemplateColumns: COL.join(" "),
        borderBottom: `1px solid ${C.dividerAcc}`,
        background: "rgba(255,255,255,0.012)",
      }}>
        <div style={{ ...colLabelStyle, textAlign: "center" }}>Trade #</div>
        <div style={colLabelStyle}>Result</div>
        <div style={colLabelStyle}>Risk-Reward (RRR)</div>
        <div style={colLabelStyle}>Pips Gained / Loss</div>
      </div>

      {/* Week blocks */}
      {weeks.map((week) => {
        const weeklyStat = weeklyStats.find((s) => s.weekId === week.id) as WeeklyStat | undefined;
        return <WeekBlock key={week.id} week={week} weeklyStat={weeklyStat} />;
      })}

      {/* Grand Total */}
      {summary && (
        <div>
          {/* Section label */}
          <div style={{
            padding: "12px 20px",
            background: C.bgGrandHead,
            borderTop: `1px solid rgba(99,102,241,0.22)`,
            borderBottom: `1px solid rgba(99,102,241,0.15)`,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}>
            <div style={{ flex: 1, height: 1, background: "rgba(99,102,241,0.25)" }} />
            <span style={{
              fontFamily: FONT,
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: C.accent,
            }}>
              Grand Total
            </span>
            <div style={{ flex: 1, height: 1, background: "rgba(99,102,241,0.25)" }} />
          </div>

          {/* Grand Total column headers */}
          <div style={{
            display: "grid",
            gridTemplateColumns: COL.join(" "),
            borderBottom: `1px solid rgba(99,102,241,0.12)`,
            background: C.bgGrand,
          }}>
            {["Trades", "Win Rate", "Net RR", "Net Pips"].map((label, i) => (
              <div key={label} style={{
                ...colLabelStyle,
                color: "rgba(129,140,248,0.7)",
                textAlign: i === 0 ? "center" : "left",
              }}>
                {label}
              </div>
            ))}
          </div>

          {/* Grand Total values */}
          <div style={{
            display: "grid",
            gridTemplateColumns: COL.join(" "),
            background: C.bgGrand,
            alignItems: "center",
          }}>
            <div style={{
              padding: "18px 16px",
              textAlign: "center",
              fontFamily: MONO,
              fontWeight: 800,
              fontSize: 28,
              color: C.textPrimary,
            }}>
              {summary.totalTrades}
            </div>

            <div style={{ padding: "18px 16px" }}>
              <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 18, color: C.textPrimary }}>
                {summary.winRate}%
              </div>
              <div style={{ marginTop: 4, display: "flex", gap: 6 }}>
                <span style={{ fontFamily: FONT, fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 999, background: C.winBg, color: C.win, border: `1px solid ${C.winBorder}` }}>
                  {summary.wins}W
                </span>
                <span style={{ fontFamily: FONT, fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 999, background: C.lossBg, color: C.loss, border: `1px solid ${C.lossBorder}` }}>
                  {summary.losses}L
                </span>
                <span style={{ fontFamily: FONT, fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 999, background: C.beBg, color: C.be, border: `1px solid ${C.beBorder}` }}>
                  {summary.breakEvens}BE
                </span>
              </div>
            </div>

            <div style={{
              padding: "18px 16px",
              fontFamily: MONO,
              fontWeight: 700,
              fontSize: 20,
              color: rrColor(summary.netRR),
            }}>
              {sign(summary.netRR)}{summary.netRR.toFixed(2)}
              <span style={{ fontSize: 13, fontWeight: 400, color: C.textMuted, marginLeft: 4 }}>R</span>
            </div>

            <div style={{
              padding: "18px 16px",
              fontFamily: MONO,
              fontWeight: 700,
              fontSize: 20,
              color: pipColor(summary.netPips),
            }}>
              {sign(summary.netPips)}{summary.netPips.toFixed(1)}
              <span style={{ fontSize: 13, fontWeight: 400, color: C.textMuted, marginLeft: 4 }}>pips</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
