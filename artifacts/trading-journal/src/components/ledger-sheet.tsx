import { format, parseISO } from "date-fns";
import {
  useListWeeks,
  useListTrades,
  useGetStatsSummary,
  useGetWeeklyStats,
} from "@workspace/api-client-react";
import type { Week } from "@workspace/api-client-react";

// ─── helpers ────────────────────────────────────────────────────────────────

function deriveMonthLabel(weeks: Week[]): string {
  if (weeks.length === 0) return "All Time";
  const dates = weeks
    .map((w) => {
      try { return parseISO(w.startDate); } catch { return null; }
    })
    .filter(Boolean) as Date[];
  if (dates.length === 0) return "All Time";
  const first = dates.reduce((a, b) => (a < b ? a : b));
  const last = dates.reduce((a, b) => (a > b ? a : b));
  const fm = format(first, "MMM");
  const lm = format(last, "MMM");
  const fy = format(first, "yyyy");
  const ly = format(last, "yyyy");
  if (fm === lm && fy === ly) return `${fm} ${fy}`;
  if (fy === ly) return `${fm} – ${lm} ${fy}`;
  return `${fm} ${fy} – ${lm} ${ly}`;
}

function ResultBadge({ result }: { result: string }) {
  if (result === "Win")
    return <span style={{ color: "#34d399" }}>✅ Win</span>;
  if (result === "Loss")
    return <span style={{ color: "#f87171" }}>❌ Loss</span>;
  return <span style={{ color: "#94a3b8" }}>— BE</span>;
}

// ─── per-week rows (fetches own trades) ─────────────────────────────────────

type WeeklyStat = {
  weekId: number;
  weekLabel: string;
  wins: number;
  losses: number;
  breakEvens: number;
  totalTrades: number;
  winRate: number;
  netRR: number;
  netPips: number;
};

function LedgerWeekSection({
  week,
  weeklyStat,
  idx,
}: {
  week: Week;
  weeklyStat: WeeklyStat | undefined;
  idx: number;
}) {
  const { data: trades = [] } = useListTrades({ weekId: week.id });

  const cellBase: React.CSSProperties = {
    padding: "6px 12px",
    border: "1px solid rgba(255,255,255,0.08)",
    fontSize: 13,
    color: "#e2e8f0",
  };

  const weekHeaderStyle: React.CSSProperties = {
    ...cellBase,
    background: "rgba(255,255,255,0.04)",
    color: "#94a3b8",
    fontSize: 12,
    padding: "5px 12px",
  };

  const finaleStyle: React.CSSProperties = {
    ...cellBase,
    textAlign: "center",
    fontStyle: "italic",
    fontWeight: 700,
    color: "#fbbf24",
    background: "rgba(251,191,36,0.05)",
    fontSize: 12,
    letterSpacing: "0.08em",
    padding: "4px 12px",
  };

  const totalStyle: React.CSSProperties = {
    ...cellBase,
    fontWeight: 600,
    color: "#cbd5e1",
    background: "rgba(255,255,255,0.02)",
  };

  const emptyRow = (
    <tr key="empty">
      {["—", "—", "—", "—"].map((v, i) => (
        <td key={i} style={{ ...cellBase, color: "rgba(148,163,184,0.3)", textAlign: i === 0 ? "center" : "left" }}>{v}</td>
      ))}
    </tr>
  );

  return (
    <>
      {/* Week section header */}
      <tr>
        <td colSpan={4} style={weekHeaderStyle}>
          📋 Weekly Stats Summary ({week.label}){" "}
          {week.startDate
            ? `— ${format(parseISO(week.startDate), "MMM d, yyyy")}`
            : ""}
        </td>
      </tr>

      {/* Trade rows */}
      {trades.length === 0
        ? emptyRow
        : trades.map((trade) => (
            <tr
              key={trade.id}
              style={{
                background:
                  idx % 2 === 0
                    ? "rgba(255,255,255,0.01)"
                    : "rgba(255,255,255,0.0)",
              }}
            >
              <td style={{ ...cellBase, textAlign: "center", fontWeight: 600 }}>
                {trade.tradeNumber}
              </td>
              <td style={cellBase}>
                <ResultBadge result={trade.result} />
              </td>
              <td style={{ ...cellBase, fontFamily: "monospace" }}>
                1/{trade.rrr.toFixed(2)}
              </td>
              <td
                style={{
                  ...cellBase,
                  fontFamily: "monospace",
                  color:
                    trade.pips > 0
                      ? "#34d399"
                      : trade.pips < 0
                      ? "#f87171"
                      : "#94a3b8",
                }}
              >
                {trade.pips > 0 ? "+" : ""}
                {trade.pips.toFixed(1)} pips
              </td>
            </tr>
          ))}

      {/* Weekly Finale divider */}
      <tr>
        <td colSpan={4} style={finaleStyle}>
          ✦ Weekly Finale ✦
        </td>
      </tr>

      {/* Weekly total row */}
      <tr>
        <td style={{ ...totalStyle, color: "#94a3b8", fontSize: 12 }}>
          Total →
        </td>
        <td style={{ ...totalStyle, fontFamily: "monospace" }}>
          {weeklyStat ? `${weeklyStat.winRate}%` : "0%"}
        </td>
        <td
          style={{
            ...totalStyle,
            fontFamily: "monospace",
            color: weeklyStat && weeklyStat.netRR > 0 ? "#34d399" : weeklyStat && weeklyStat.netRR < 0 ? "#f87171" : "#94a3b8",
          }}
        >
          {weeklyStat
            ? `${weeklyStat.netRR > 0 ? "+" : ""}${weeklyStat.netRR.toFixed(2)} RR`
            : "+0 RR"}
        </td>
        <td
          style={{
            ...totalStyle,
            fontFamily: "monospace",
            color: weeklyStat && weeklyStat.netPips > 0 ? "#34d399" : weeklyStat && weeklyStat.netPips < 0 ? "#f87171" : "#94a3b8",
          }}
        >
          {weeklyStat
            ? `${weeklyStat.netPips > 0 ? "+" : ""}${weeklyStat.netPips.toFixed(1)} pips`
            : "+0 pips"}
        </td>
      </tr>
    </>
  );
}

// ─── main ledger sheet ───────────────────────────────────────────────────────

interface LedgerSheetProps {
  className?: string;
}

export function LedgerSheet({ className }: LedgerSheetProps) {
  const { data: weeks = [], isLoading: weeksLoading } = useListWeeks();
  const { data: summary, isLoading: summaryLoading } = useGetStatsSummary();
  const { data: weeklyStats = [], isLoading: weeklyLoading } = useGetWeeklyStats();

  const isLoading = weeksLoading || summaryLoading || weeklyLoading;
  const monthLabel = deriveMonthLabel(weeks);

  const thStyle: React.CSSProperties = {
    padding: "8px 12px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.04)",
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    textAlign: "left",
  };

  const grandTotalHeaderStyle: React.CSSProperties = {
    padding: "8px 12px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(99,102,241,0.12)",
    color: "#a5b4fc",
    fontWeight: 700,
    fontSize: 13,
    textAlign: "center",
    letterSpacing: "0.06em",
  };

  const grandTotalCellStyle: React.CSSProperties = {
    padding: "10px 12px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(99,102,241,0.06)",
    fontWeight: 700,
    fontSize: 14,
    fontFamily: "monospace",
    color: "#e2e8f0",
  };

  return (
    <div
      className={className}
      style={{
        background: "#0b0f1a",
        padding: "32px",
        borderRadius: 16,
        fontFamily:
          "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
      }}
    >
      {isLoading ? (
        <div style={{ color: "#64748b", textAlign: "center", padding: 48 }}>
          Loading ledger…
        </div>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            minWidth: 500,
          }}
        >
          {/* ── Month header ── */}
          <thead>
            <tr>
              <td
                colSpan={4}
                style={{
                  padding: "12px 16px",
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.05)",
                  textAlign: "center",
                  fontWeight: 800,
                  fontSize: 16,
                  color: "#f1f5f9",
                  letterSpacing: "0.04em",
                }}
              >
                📅 {monthLabel} &nbsp;·&nbsp; Stats Summary
              </td>
            </tr>
            <tr>
              <th style={{ ...thStyle, width: "10%" }}>Trade</th>
              <th style={{ ...thStyle, width: "22%" }}>Result</th>
              <th style={{ ...thStyle, width: "34%" }}>Risk-Reward (RRR)</th>
              <th style={{ ...thStyle, width: "34%" }}>Pips Gained / Loss</th>
            </tr>
          </thead>

          {/* ── Week sections ── */}
          <tbody>
            {weeks.map((week, idx) => {
              const weeklyStat = weeklyStats.find(
                (s) => s.weekId === week.id
              ) as WeeklyStat | undefined;
              return (
                <LedgerWeekSection
                  key={week.id}
                  week={week}
                  weeklyStat={weeklyStat}
                  idx={idx}
                />
              );
            })}

            {/* ── Grand Total ── */}
            {summary && (
              <>
                <tr>
                  <td colSpan={4} style={grandTotalHeaderStyle}>
                    ◆ GRAND TOTAL ◆
                  </td>
                </tr>
                <tr>
                  <th style={{ ...thStyle, background: "rgba(99,102,241,0.08)" }}>Trades</th>
                  <th style={{ ...thStyle, background: "rgba(99,102,241,0.08)" }}>Win Rate</th>
                  <th style={{ ...thStyle, background: "rgba(99,102,241,0.08)" }}>Net RR</th>
                  <th style={{ ...thStyle, background: "rgba(99,102,241,0.08)" }}>Net Pips</th>
                </tr>
                <tr>
                  <td
                    style={{
                      ...grandTotalCellStyle,
                      textAlign: "center",
                      fontSize: 20,
                      color: "#f1f5f9",
                    }}
                  >
                    {summary.totalTrades}
                  </td>
                  <td style={{ ...grandTotalCellStyle, color: "#f1f5f9" }}>
                    {summary.winRate}%{" "}
                    <span style={{ fontSize: 11, color: "#6366f1", fontFamily: "sans-serif" }}>
                      ({summary.wins}W · {summary.losses}L · {summary.breakEvens}BE)
                    </span>
                  </td>
                  <td
                    style={{
                      ...grandTotalCellStyle,
                      color:
                        summary.netRR > 0
                          ? "#34d399"
                          : summary.netRR < 0
                          ? "#f87171"
                          : "#94a3b8",
                    }}
                  >
                    {summary.netRR > 0 ? "+" : ""}
                    {summary.netRR.toFixed(2)} R
                  </td>
                  <td
                    style={{
                      ...grandTotalCellStyle,
                      color:
                        summary.netPips > 0
                          ? "#34d399"
                          : summary.netPips < 0
                          ? "#f87171"
                          : "#94a3b8",
                    }}
                  >
                    {summary.netPips > 0 ? "+" : ""}
                    {summary.netPips.toFixed(1)} pips
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
