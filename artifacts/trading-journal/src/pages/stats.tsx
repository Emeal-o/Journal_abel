import { useEffect, useRef, useState } from "react";
import { Download, Pencil } from "lucide-react";
import { format } from "date-fns";
import { useGetStatsSummary, useGetWeeklyStats, useListWeeks } from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { THEMES } from "@/components/ledger-sheet";
import type { LedgerTheme } from "@/components/ledger-sheet";
import { StatsCard } from "@/components/stats-card";
import { useArchivedWeeks, maxMonthIndex } from "@/lib/weeks-api";
import { computeCardLabels } from "@/lib/label-utils";
import { captureCardPng, triggerDownload } from "@/lib/card-export";
import { aggregateWeekStats } from "@/lib/stats-utils";

const THEME_ORDER: LedgerTheme[] = ["obsidian", "midnight", "ember", "matrix", "aurora", "goldrush", "sakura", "vapor", "autumn"];
const FONT = "'Inter','Segoe UI',system-ui,-apple-system,sans-serif";
const CARD_WIDTH = 680;

/**
 * True below the `sm` breakpoint (640px). Used to switch the stats-card
 * preview from horizontal-scroll to a scaled-to-fit view. Purely a
 * display/UX concern — never touches the export path (see card-export.ts).
 */
function useIsNarrowViewport(breakpointPx = 640): boolean {
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== "undefined" && window.innerWidth < breakpointPx
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const handler = () => setIsNarrow(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpointPx]);

  return isNarrow;
}

export function StatsPage() {
  const { isLoading: summaryLoading }        = useGetStatsSummary();
  const { data: weeklyStats = [], isLoading: weeklyLoading } = useGetWeeklyStats();
  const { data: activeWeeks = [], isLoading: weeksLoading }  = useListWeeks();
  const cardRef   = useRef<HTMLDivElement>(null);
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const isNarrow = useIsNarrowViewport();
  const [previewScale, setPreviewScale] = useState(1);
  const [previewHeight, setPreviewHeight] = useState<number | undefined>(undefined);

  // ── auto-suggested labels from the next month_index ───────────────────────────
  // Same source of truth (month_index) and formula as the Archive page and the
  // "Start New Month" dialog — keeps all three surfaces in sync.
  const { data: archivedWeeks = [] } = useArchivedWeeks();
  const { suggestedMonth, suggestedTag } = computeCardLabels(maxMonthIndex(archivedWeeks) + 1);

  // ── Grand Total scope — must mirror the card header's own logic ────────────────
  // deriveMonthLabel() (ledger-sheet.tsx) shows "All Time" when there are 0 active
  // weeks, or a specific date range when there ARE active weeks. The Grand Total
  // needs to match: sum only the active weeks' trades when any exist, otherwise
  // fall back to true all-time (every archived week too).
  const activeWeekIds  = new Set(activeWeeks.map((w) => w.id));
  const scopedWeekStats = activeWeeks.length > 0
    ? weeklyStats.filter((s) => activeWeekIds.has(s.weekId))
    : weeklyStats;
  const summaryOverride = aggregateWeekStats(scopedWeekStats);

  const [exporting, setExporting] = useState(false);
  const [theme, setTheme]         = useState<LedgerTheme>("obsidian");
  const [cardTitle, setCardTitle] = useState("");   // empty = auto from date range
  const [cardTag, setCardTag]     = useState("");   // empty = use suggestedTag
  const [cardMonth, setCardMonth] = useState("");   // empty = use suggestedMonth

  const isLoading = summaryLoading || weeklyLoading || weeksLoading;
  const t = THEMES[theme];

  // ── on-screen preview scaling (mobile only) ─────────────────────────────────
  // Purely visual: shrinks the fixed-680px card to fit narrow viewports so the
  // whole card is visible without side-scrolling. Never touches cardRef's own
  // inline styles — captureCardPng() (card-export.ts) sets/restores those
  // itself during export, independent of this transform.
  useEffect(() => {
    if (!isNarrow) {
      setPreviewScale(1);
      setPreviewHeight(undefined);
      return;
    }
    const wrap = previewWrapRef.current;
    const card = cardRef.current;
    if (!wrap || !card) return;

    const update = () => {
      const wrapWidth = wrap.clientWidth;
      const nextScale = wrapWidth > 0 ? Math.min(1, wrapWidth / CARD_WIDTH) : 1;
      setPreviewScale(nextScale);
      setPreviewHeight(card.scrollHeight * nextScale);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrap);
    ro.observe(card);
    return () => ro.disconnect();
    // Re-measure whenever content that can change the card's rendered size changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNarrow, theme, cardTitle, cardTag, cardMonth, summaryOverride, isLoading]);

  // ── main handler ─────────────────────────────────────────────────────────────

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setExporting(true);
    const node = cardRef.current;

    try {
      const dateStr = format(new Date(), "yyyy-MM-dd");

      // scale:8 × 680 px (5 440 px output) — extra resolution headroom so
      // small text stays legible after Discord's upload compression.
      // Letter-spacing is stripped to reduce SVG foreignObject hinting artefacts.
      const png = await captureCardPng(node, t.pageBg, 680, 8);
      triggerDownload(png, `tradeops-${theme}-${dateStr}.png`);

      toast({ title: "Statistics card downloaded" });
    } catch (err) {
      console.error("[dom-to-image-more] render failed:", err);
      toast({ title: "Failed to download card", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 8,
    padding: "7px 12px",
    color: "#f1f5f9",
    fontSize: 13,
    fontFamily: FONT,
    outline: "none",
    width: "100%",
    transition: "border-color 0.15s",
  };

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Performance Stats</h1>
          <p className="text-muted-foreground mt-1">Export your stats as a premium shareable card.</p>
        </div>
        <Button
          onClick={handleDownload}
          disabled={isLoading || exporting}
          className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(99,102,241,0.4)] border border-primary-foreground/10"
        >
          <Download className="w-4 h-4" />
          {exporting ? "Generating…" : "Download Statistics Card"}
        </Button>
      </div>

      {/* Theme selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/50 mr-1">
          Theme
        </span>
        {THEME_ORDER.map((id) => {
          const th = THEMES[id];
          const active = theme === id;
          return (
            <button
              key={id}
              onClick={() => setTheme(id)}
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

      {/* Card label editor */}
      <div
        style={{
          background: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 12,
          padding: "14px 18px",
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Pencil className="w-3 h-3 text-muted-foreground/60" />
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/50">
            Card Labels
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label
              className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40 mb-1.5"
              style={{ fontFamily: FONT }}
            >
              Header Title
            </label>
            <input
              type="text"
              placeholder="Auto (date range from weeks)"
              value={cardTitle}
              onChange={(e) => setCardTitle(e.target.value)}
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.20)")}
              onBlur={(e)  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)")}
            />
          </div>
          <div>
            <label
              className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40 mb-1.5"
              style={{ fontFamily: FONT }}
            >
              Month (e.g. Month 9)
            </label>
            <input
              type="text"
              placeholder={suggestedMonth}
              value={cardMonth}
              onChange={(e) => setCardMonth(e.target.value)}
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.20)")}
              onBlur={(e)  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)")}
            />
          </div>
          <div>
            <label
              className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40 mb-1.5"
              style={{ fontFamily: FONT }}
            >
              Period Tag (e.g. Y-II)
            </label>
            <input
              type="text"
              placeholder={suggestedTag}
              value={cardTag}
              onChange={(e) => setCardTag(e.target.value)}
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.20)")}
              onBlur={(e)  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)")}
            />
          </div>
        </div>
      </div>

      {/* Card preview — exactly what downloads. The card itself has a fixed
          680px width (see StatsCard). On narrow viewports it's scaled down
          (CSS transform, display-only) to fit the screen without side-
          scrolling; at sm+ it renders at full size, centered.

          The scaling wrapper below uses the standard "reserve the post-scale
          box, transform the pre-scale content inside it" pattern: the outer
          box's layout width/height are set to the ALREADY-SCALED dimensions,
          so `margin: 0 auto` centers it correctly using real layout math.
          The inner box keeps the card's true 680px size and is visually
          shrunk with `transform: scale()` anchored at its own top-left
          corner — which lines up exactly with the outer box's top-left
          corner, so the two boxes coincide on screen. */}
      <div
        ref={previewWrapRef}
        className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"
      >
        {isNarrow ? (
          <div
            style={{
              width: CARD_WIDTH * previewScale,
              height: previewHeight,
              margin: "0 auto",
              overflow: "hidden",
            }}
          >
            <div style={{ transform: `scale(${previewScale})`, transformOrigin: "top left", width: CARD_WIDTH }}>
              <StatsCard
                ref={cardRef}
                theme={theme}
                titleOverride={cardTitle.trim() || undefined}
                tag={cardTag.trim() || suggestedTag}
                month={cardMonth.trim() || suggestedMonth}
                summaryOverride={summaryOverride}
              />
            </div>
          </div>
        ) : (
          <div className="flex justify-center w-fit mx-auto">
            <StatsCard
              ref={cardRef}
              theme={theme}
              titleOverride={cardTitle.trim() || undefined}
              tag={cardTag.trim() || suggestedTag}
              month={cardMonth.trim() || suggestedMonth}
              summaryOverride={summaryOverride}
            />
          </div>
        )}
      </div>
    </div>
  );
}
