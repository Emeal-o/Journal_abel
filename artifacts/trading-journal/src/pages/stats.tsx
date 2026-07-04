import { useRef, useState } from "react";
import { Download } from "lucide-react";
import domtoimage from "dom-to-image-more";
import { format } from "date-fns";
import { useGetStatsSummary, useGetWeeklyStats, useListWeeks } from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LedgerSheet } from "@/components/ledger-sheet";
import type { LedgerTheme } from "@/components/ledger-sheet";

const THEMES: { id: LedgerTheme; label: string; dot: string }[] = [
  { id: "obsidian", label: "Obsidian", dot: "#ffffff" },
  { id: "midnight", label: "Midnight", dot: "#818cf8" },
  { id: "ember",    label: "Ember",    dot: "#fbbf24" },
];

export function StatsPage() {
  const { isLoading: summaryLoading } = useGetStatsSummary();
  const { isLoading: weeklyLoading }  = useGetWeeklyStats();
  const { isLoading: weeksLoading }   = useListWeeks();
  const ledgerRef  = useRef<HTMLDivElement>(null);
  const { toast }  = useToast();
  const [exporting, setExporting] = useState(false);
  const [theme, setTheme] = useState<LedgerTheme>("obsidian");

  const isLoading = summaryLoading || weeklyLoading || weeksLoading;

  const handleDownload = async () => {
    if (!ledgerRef.current) return;
    setExporting(true);
    try {
      const node = ledgerRef.current;
      const dataUrl = await domtoimage.toPng(node, {
        bgcolor: node.style.background || "#080808",
        width:  node.scrollWidth,
        height: node.scrollHeight,
        scale: 2,
        ignoreCSSRuleErrors: true,
        onImageError: (info) => {
          console.warn("[dom-to-image-more] resource failed:", info);
        },
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
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60 mr-1">Theme</span>
        {THEMES.map((th) => (
          <button
            key={th.id}
            onClick={() => setTheme(th.id)}
            className={[
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all border",
              theme === th.id
                ? "bg-white/10 border-white/20 text-white"
                : "bg-transparent border-white/8 text-muted-foreground hover:border-white/15 hover:text-white/70",
            ].join(" ")}
          >
            <span
              style={{ background: th.dot }}
              className="w-2 h-2 rounded-full flex-shrink-0"
            />
            {th.label}
          </button>
        ))}
      </div>

      {/* Ledger — entire node captured on download */}
      <div ref={ledgerRef}>
        <LedgerSheet theme={theme} />
      </div>
    </div>
  );
}
