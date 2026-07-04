import { useRef, useState } from "react";
import { Download } from "lucide-react";
import domtoimage from "dom-to-image-more";
import { format } from "date-fns";
import { useGetStatsSummary, useGetWeeklyStats, useListWeeks } from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LedgerSheet, THEMES } from "@/components/ledger-sheet";
import type { LedgerTheme } from "@/components/ledger-sheet";

const THEME_ORDER: LedgerTheme[] = ["obsidian", "midnight", "ember", "matrix"];

export function StatsPage() {
  const { isLoading: summaryLoading } = useGetStatsSummary();
  const { isLoading: weeklyLoading }  = useGetWeeklyStats();
  const { isLoading: weeksLoading }   = useListWeeks();
  const ledgerRef  = useRef<HTMLDivElement>(null);
  const { toast }  = useToast();
  const [exporting, setExporting] = useState(false);
  const [theme, setTheme] = useState<LedgerTheme>("obsidian");

  const isLoading = summaryLoading || weeklyLoading || weeksLoading;
  const t = THEMES[theme];

  const handleDownload = async () => {
    if (!ledgerRef.current) return;
    setExporting(true);
    try {
      const node = ledgerRef.current;
      const dataUrl = await domtoimage.toPng(node, {
        bgcolor: t.bg,
        width:  node.scrollWidth,
        height: node.scrollHeight,
        scale: 2,
        ignoreCSSRuleErrors: true,
        onImageError: (info) => console.warn("[dom-to-image-more] resource failed:", info),
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `trade-ledger-${theme}-${format(new Date(), "yyyy-MM-dd")}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: "Ledger downloaded!" });
    } catch (err) {
      console.error("[dom-to-image-more] render failed:", err);
      toast({ title: "Failed to download ledger", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Performance Stats</h1>
          <p className="text-muted-foreground mt-1">Full trading ledger — all weeks, all trades.</p>
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
                background: active ? `${th.containerBorder}` : "rgba(255,255,255,0.03)",
                border: `1px solid ${active ? th.containerBorder : "rgba(255,255,255,0.06)"}`,
                color: active ? th.textPrimary : "#64748b",
                boxShadow: active ? `0 0 12px ${th.dot}28` : "none",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: th.dot,
                  flexShrink: 0,
                  boxShadow: active ? `0 0 6px ${th.dot}` : "none",
                }}
              />
              {th.name}
            </button>
          );
        })}
      </div>

      {/* Ledger — entire node is captured on download */}
      <div ref={ledgerRef}>
        <LedgerSheet theme={theme} />
      </div>
    </div>
  );
}
