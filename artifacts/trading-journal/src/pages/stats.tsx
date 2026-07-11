import { useRef, useState } from "react";
import { Download, Pencil } from "lucide-react";
import domtoimage from "dom-to-image-more";
import { format } from "date-fns";
import { useGetStatsSummary, useGetWeeklyStats, useListWeeks } from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LedgerSheet, THEMES } from "@/components/ledger-sheet";
import type { LedgerTheme } from "@/components/ledger-sheet";
import { useArchivedWeeks } from "@/lib/weeks-api";
import { computeCardLabels } from "@/lib/label-utils";

const THEME_ORDER: LedgerTheme[] = ["obsidian", "midnight", "ember", "matrix", "aurora", "goldrush", "sakura", "vapor", "autumn"];
const FONT = "'Inter','Segoe UI',system-ui,-apple-system,sans-serif";

export function StatsPage() {
  const { isLoading: summaryLoading } = useGetStatsSummary();
  const { isLoading: weeklyLoading }  = useGetWeeklyStats();
  const { isLoading: weeksLoading }   = useListWeeks();
  const cardRef   = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // ── auto-suggested labels from archived month count ──────────────────────────
  const { data: archivedWeeks = [] } = useArchivedWeeks();
  const totalMonths = new Set(
    archivedWeeks.map((w) => w.monthLabel).filter(Boolean),
  ).size;
  const { suggestedMonth, suggestedTag } = computeCardLabels(totalMonths);

  const [exporting, setExporting] = useState(false);
  const [theme, setTheme]         = useState<LedgerTheme>("obsidian");
  const [cardTitle, setCardTitle] = useState("");   // empty = auto from date range
  const [cardTag, setCardTag]     = useState("");   // empty = use suggestedTag
  const [cardMonth, setCardMonth] = useState("");   // empty = use suggestedMonth

  const isLoading = summaryLoading || weeklyLoading || weeksLoading;
  const t = THEMES[theme];

  // ── capture helpers ──────────────────────────────────────────────────────────

  /** Zero out every inline letter-spacing inside `root`; returns a restore fn. */
  function stripLetterSpacing(root: HTMLElement): () => void {
    const saved: Array<[HTMLElement, string]> = [];
    root.querySelectorAll<HTMLElement>("*").forEach((el) => {
      if (el.style.letterSpacing) {
        saved.push([el, el.style.letterSpacing]);
        el.style.letterSpacing = "normal";
      }
    });
    return () => saved.forEach(([el, v]) => { el.style.letterSpacing = v; });
  }

  /** Capture `node` as a PNG data-URL at the given logical width + scale. */
  async function captureCard(node: HTMLElement, logicalWidth: number, scale: number): Promise<string> {
    node.style.width    = `${logicalWidth}px`;
    node.style.maxWidth = "none";
    node.style.setProperty("-webkit-font-smoothing", "antialiased");
    node.style.setProperty("-moz-osx-font-smoothing", "grayscale");

    const restoreLetterSpacing = stripLetterSpacing(node);

    // Reflow happens when we read scroll dimensions
    const w = node.scrollWidth;
    const h = node.scrollHeight;

    try {
      return await domtoimage.toPng(node, {
        bgcolor: t.pageBg,
        width:   w,
        height:  h,
        scale,
        ignoreCSSRuleErrors: true,
        onImageError: (info: unknown) => console.warn("[dom-to-image-more] resource failed:", info),
      });
    } finally {
      restoreLetterSpacing();
    }
  }

  function triggerDownload(dataUrl: string, filename: string) {
    const link = document.createElement("a");
    link.href     = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ── main handler ─────────────────────────────────────────────────────────────

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setExporting(true);
    const node = cardRef.current;

    const origWidth    = node.style.width;
    const origMaxWidth = node.style.maxWidth;

    try {
      const dateStr = format(new Date(), "yyyy-MM-dd");

      // scale:6 × 960 px (5 760 px output) — extra resolution headroom so
      // small text stays legible after Discord's upload compression.
      // Letter-spacing is stripped to reduce SVG foreignObject hinting artefacts.
      const png = await captureCard(node, 960, 6);
      triggerDownload(png, `tradeops-${theme}-${dateStr}.png`);

      toast({ title: "Statistics card downloaded" });
    } catch (err) {
      console.error("[dom-to-image-more] render failed:", err);
      toast({ title: "Failed to download card", variant: "destructive" });
    } finally {
      node.style.width    = origWidth;
      node.style.maxWidth = origMaxWidth;
      node.style.removeProperty("-webkit-font-smoothing");
      node.style.removeProperty("-moz-osx-font-smoothing");
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

      {/* Card preview — exactly what downloads */}
      <div className="flex justify-center">
        <div
          id="ledger-card"
          ref={cardRef}
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
            titleOverride={cardTitle.trim() || undefined}
            tag={cardTag.trim() || suggestedTag}
            month={cardMonth.trim() || suggestedMonth}
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
      </div>
    </div>
  );
}
