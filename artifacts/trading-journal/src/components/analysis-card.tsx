/**
 * AnalysisCard — the exportable PNG card for the Analysis page.
 * Uses the same theme system and dom-to-image-more capture approach
 * as StatsCard; all layout is done with inline styles (no Tailwind)
 * so the export environment renders it identically to the preview.
 */
import { forwardRef } from "react";
import { format } from "date-fns";
import { LineChart, Line, XAxis, YAxis, ReferenceLine } from "recharts";

import { THEMES } from "@/components/ledger-sheet";
import type { LedgerTheme } from "@/components/ledger-sheet";
import type { AnalysisData, AnalysisCumulativePoint } from "@/lib/analysis-api";

const FONT   = "'Inter','Segoe UI',system-ui,-apple-system,sans-serif";
const WIDTH  = 680;
const INNER  = WIDTH - 72; // 36px padding each side

export interface AnalysisCardProps {
  theme: LedgerTheme;
  data: AnalysisData;
  pageTitle: string;
  pageSubtitle: string;
  /** The already-resolved cumulative series (weekly or monthly per current toggle). */
  cumulativeData: AnalysisCumulativePoint[];
  /** Human label for the granularity, e.g. "Weekly" or "Monthly". */
  chartGranularityLabel: string;
  /** When true the Year-by-Year table is omitted. */
  isYearScoped: boolean;
}

function fmtRR(v: number): string {
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}R`;
}

function valColor(v: number, win: string, loss: string, neutral: string): string {
  if (v > 0) return win;
  if (v < 0) return loss;
  return neutral;
}

export const AnalysisCard = forwardRef<HTMLDivElement, AnalysisCardProps>(
  function AnalysisCard(
    { theme, data, pageTitle, pageSubtitle, cumulativeData, chartGranularityLabel, isYearScoped },
    ref,
  ) {
    const t = THEMES[theme];
    const { allTime, byYear, bestWeek, worstWeek, bestMonth, worstMonth } = data;

    // ── shared style objects ───────────────────────────────────────────────────

    const sectionLabel: React.CSSProperties = {
      fontSize: 10,
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.12em",
      color: t.textSecond,
      fontFamily: FONT,
      marginBottom: 10,
    };

    const divider: React.CSSProperties = {
      flex: 1,
      height: 1,
      background: t.divider,
    };

    // ── stat tile helper ───────────────────────────────────────────────────────

    function Tile({ label, value, accent, sub }: { label: string; value: string; accent?: string; sub?: string }) {
      return (
        <div style={{
          flex: 1,
          borderRadius: 12,
          border: `1px solid ${t.divider}`,
          background: t.rowBg,
          padding: "14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          fontFamily: FONT,
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: t.textSecond }}>{label}</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: accent ?? t.textPrimary, letterSpacing: "-0.01em" }}>{value}</span>
          {sub && <span style={{ fontSize: 10, color: t.textSecond }}>{sub}</span>}
        </div>
      );
    }

    // ── best/worst tile helper ─────────────────────────────────────────────────

    function BWTile({ label, name, rrr, isGood }: { label: string; name: string; rrr: number; isGood: boolean }) {
      const color = isGood ? t.win : t.loss;
      const border = isGood ? "rgba(34,197,94,0.20)" : "rgba(239,68,68,0.20)";
      const bg     = isGood ? "rgba(34,197,94,0.05)" : "rgba(239,68,68,0.05)";
      return (
        <div style={{ borderRadius: 12, border: `1px solid ${border}`, background: bg, padding: "14px 16px", fontFamily: FONT }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color, marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary }}>{name}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color, marginTop: 2 }}>{fmtRR(rrr)}</div>
        </div>
      );
    }

    const hasBestWorst = !!(bestWeek || bestMonth);

    // ── chart tick/line colours ────────────────────────────────────────────────
    const chartTickStyle = { fill: t.textSecond, fontSize: 9, fontFamily: FONT } as const;

    return (
      <div
        ref={ref}
        style={{
          width: WIDTH,
          background: t.pageBg,
          padding: "40px 36px 36px",
          borderRadius: 24,
          fontFamily: FONT,
          position: "relative",
        }}
      >
        {/* ── hidden provenance mark (mirrors StatsCard) ── */}
        <span
          aria-hidden="true"
          style={{ position: "absolute", bottom: 11, left: 14, fontSize: 6.5, fontWeight: 600, letterSpacing: "0.22em", color: t.textPrimary, opacity: 0.008, fontFamily: FONT, userSelect: "none", pointerEvents: "none" }}
        >
          EMEAL
        </span>

        {/* ── Header: TradeOps branding (identical to StatsCard) ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${t.accent} 0%, ${t.containerBorder} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 16px ${t.accent}40` }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <polyline points="1,12 5,7 9,10 15,3" stroke={t.pageBg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-0.01em", color: t.textPrimary, fontFamily: FONT }}>
              Trade<span style={{ color: t.accent }}>Ops</span>
            </span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: t.textMuted, padding: "4px 10px", borderRadius: 999, border: `1px solid ${t.divider}`, fontFamily: FONT }}>
            {t.name}
          </div>
        </div>

        {/* ── Title block ── */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: t.textPrimary, margin: 0, letterSpacing: "-0.02em", fontFamily: FONT }}>{pageTitle}</div>
          <div style={{ fontSize: 12, color: t.textSecond, marginTop: 4, fontFamily: FONT }}>{pageSubtitle}</div>
        </div>

        {/* ── 1. Summary tiles ── */}
        <div style={sectionLabel}>Summary</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <Tile
            label="Total Trades"
            value={String(allTime.totalTrades)}
            sub={`${allTime.wins}W · ${allTime.losses}L · ${allTime.breakEvens}BE`}
          />
          <Tile
            label="Win Rate"
            value={`${allTime.winRate}%`}
            accent={allTime.winRate >= 50 ? t.win : t.loss}
          />
          <Tile
            label="Net RR"
            value={fmtRR(allTime.netRR)}
            accent={valColor(allTime.netRR, t.win, t.loss, t.textSecond)}
          />
          <Tile
            label="Net Pips"
            value={`${allTime.netPips > 0 ? "+" : ""}${allTime.netPips}`}
            accent={valColor(allTime.netPips, t.win, t.loss, t.textSecond)}
          />
        </div>

        {/* ── 2. Cumulative growth chart ── */}
        {cumulativeData.length >= 2 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ ...sectionLabel, marginBottom: 10 }}>
              Cumulative Growth{" "}
              <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, opacity: 0.7 }}>
                · {chartGranularityLabel}
              </span>
            </div>
            <div style={{ borderRadius: 12, border: `1px solid ${t.divider}`, background: t.rowBg, padding: "16px 4px 8px" }}>
              <LineChart
                width={INNER - 8}
                height={180}
                data={cumulativeData}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
              >
                <XAxis
                  dataKey="label"
                  tick={chartTickStyle}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 11) + "…" : v}
                />
                <YAxis
                  tick={chartTickStyle}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}R`}
                  width={52}
                />
                <ReferenceLine y={0} stroke={t.dividerStrong} />
                <Line
                  type="monotone"
                  dataKey="cumulativeRR"
                  stroke={t.accent}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </div>
          </div>
        )}

        {/* ── 3. Year-by-Year table (all-time view only) ── */}
        {!isYearScoped && byYear.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={sectionLabel}>Year by Year</div>
            <div style={{ borderRadius: 12, border: `1px solid ${t.divider}`, overflow: "hidden", fontFamily: FONT }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: t.headerBg, borderBottom: `1px solid ${t.divider}` }}>
                    {(["Period", "Trades", "Win Rate", "Net RR"] as const).map((h, i) => (
                      <th
                        key={h}
                        style={{ padding: "10px 14px", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.10em", color: t.textSecond, textAlign: i === 0 ? "left" : "right", fontFamily: FONT }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byYear.map((y, i) => (
                    <tr
                      key={y.yearIndex ?? "active"}
                      style={{ borderBottom: i < byYear.length - 1 ? `1px solid ${t.divider}` : "none" }}
                    >
                      <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 700, color: t.textPrimary, fontFamily: FONT }}>{y.label}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: t.textSecond, textAlign: "right", fontFamily: FONT }}>{y.totalTrades}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: y.winRate >= 50 ? t.win : t.loss, textAlign: "right", fontFamily: FONT }}>{y.winRate}%</td>
                      <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 700, color: valColor(y.netRR, t.win, t.loss, t.textSecond), textAlign: "right", fontFamily: FONT }}>{fmtRR(y.netRR)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── 4. Best & Worst ── */}
        {hasBestWorst && (
          <div style={{ marginBottom: 24 }}>
            <div style={sectionLabel}>Best & Worst</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {bestWeek  && <BWTile label="Best Week"   name={bestWeek.weekLabel}   rrr={bestWeek.netRR}   isGood={true}  />}
              {worstWeek && <BWTile label="Worst Week"  name={worstWeek.weekLabel}  rrr={worstWeek.netRR}  isGood={false} />}
              {bestMonth  && <BWTile label="Best Month"  name={bestMonth.label}  rrr={bestMonth.netRR}  isGood={true}  />}
              {worstMonth && <BWTile label="Worst Month" name={worstMonth.label} rrr={worstMonth.netRR} isGood={false} />}
            </div>
          </div>
        )}

        {/* ── Footer (mirrors StatsCard) ── */}
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={divider} />
          <span style={{ fontSize: 11, fontWeight: 500, color: t.textMuted, padding: "0 14px", whiteSpace: "nowrap", letterSpacing: "0.08em", fontFamily: FONT }}>
            Generated {format(new Date(), "MMM d, yyyy")}
          </span>
          <div style={divider} />
        </div>
      </div>
    );
  },
);
