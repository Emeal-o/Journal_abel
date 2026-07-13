import { forwardRef } from "react";
import { format } from "date-fns";
import type { Week, StatsSummary, WeekStats } from "@workspace/api-client-react";

import { LedgerSheet, THEMES } from "@/components/ledger-sheet";
import type { LedgerTheme } from "@/components/ledger-sheet";

const FONT = "'Inter','Segoe UI',system-ui,-apple-system,sans-serif";

export interface StatsCardProps {
  theme: LedgerTheme;
  titleOverride?: string;
  tag?: string;
  month?: string;
  /** Scoped-data overrides — see LedgerSheetProps for details. */
  weeksOverride?: Week[];
  summaryOverride?: StatsSummary;
  weeklyStatsOverride?: WeekStats[];
  onReady?: () => void;
  /** See LedgerSheetProps.showFlagEmoji — defaults to false (unchanged export). */
  showFlagEmoji?: boolean;
}

/**
 * The branded "stats card" — TradeOps header, the LedgerSheet itself, and a
 * "Generated {date}" footer. This is the exact visual output of the
 * "Download Statistics Card" button (Stats page, all-time / current weeks)
 * and the "Download Year" bulk export (Archive page, one card per archived
 * month) — both render this same component so the two stay pixel-identical.
 */
export const StatsCard = forwardRef<HTMLDivElement, StatsCardProps>(function StatsCard(
  { theme, titleOverride, tag, month, weeksOverride, summaryOverride, weeklyStatsOverride, onReady, showFlagEmoji },
  ref,
) {
  const t = THEMES[theme];

  return (
    <div
      ref={ref}
      style={{
        width: 680,
        background: t.pageBg,
        padding: "40px 36px 36px",
        borderRadius: 24,
        fontFamily: FONT,
        position: "relative",
      }}
    >
      {/* ── hidden provenance mark ── */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: 11,
          left: 14,
          fontSize: 6.5,
          fontWeight: 600,
          letterSpacing: "0.22em",
          color: t.textPrimary,
          opacity: 0.008,
          fontFamily: FONT,
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        EMEAL
      </span>
      {/* Card header branding */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 24,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32,
            borderRadius: 8,
            background: `linear-gradient(135deg, ${t.accent} 0%, ${t.containerBorder} 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 16px ${t.accent}40`,
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <polyline points="1,12 5,7 9,10 15,3" stroke={t.pageBg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span style={{
            fontWeight: 800,
            fontSize: 17,
            letterSpacing: "-0.01em",
            color: t.textPrimary,
            fontFamily: FONT,
          }}>
            Trade<span style={{ color: t.accent }}>Ops</span>
          </span>
        </div>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: t.textMuted,
          padding: "4px 10px",
          borderRadius: 999,
          border: `1px solid ${t.divider}`,
          fontFamily: FONT,
        }}>
          {t.name}
        </div>
      </div>

      {/* Ledger */}
      <LedgerSheet
        theme={theme}
        titleOverride={titleOverride}
        tag={tag}
        month={month}
        weeksOverride={weeksOverride}
        summaryOverride={summaryOverride}
        weeklyStatsOverride={weeklyStatsOverride}
        onReady={onReady}
        showFlagEmoji={showFlagEmoji}
      />

      {/* Card footer */}
      <div style={{
        marginTop: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ flex: 1, height: 1, background: t.divider }} />
        <span style={{
          fontSize: 11,
          fontWeight: 500,
          color: t.textMuted,
          padding: "0 14px",
          whiteSpace: "nowrap",
          letterSpacing: "0.08em",
          fontFamily: FONT,
        }}>
          Generated {format(new Date(), "MMM d, yyyy")}
        </span>
        <div style={{ flex: 1, height: 1, background: t.divider }} />
      </div>
    </div>
  );
});
