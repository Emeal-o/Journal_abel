import { useRef, useState } from "react";
import { Download } from "lucide-react";
import domtoimage from "dom-to-image-more";
import { format } from "date-fns";
import { useGetStatsSummary, useGetWeeklyStats, useListWeeks } from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LedgerSheet } from "@/components/ledger-sheet";

export function StatsPage() {
  const { isLoading: summaryLoading } = useGetStatsSummary();
  const { isLoading: weeklyLoading } = useGetWeeklyStats();
  const { isLoading: weeksLoading } = useListWeeks();
  const ledgerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);

  const isLoading = summaryLoading || weeklyLoading || weeksLoading;

  const handleDownload = async () => {
    if (!ledgerRef.current) return;
    setExporting(true);
    try {
      const node = ledgerRef.current;
      const dataUrl = await domtoimage.toPng(node, {
        bgcolor: "#0b0f1a",
        scale: 2,
        ignoreCSSRuleErrors: true,
        onImageError: (info) => {
          console.warn("[dom-to-image-more] Resource failed:", info);
        },
      });

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `trade-ledger-${format(new Date(), "yyyy-MM-dd")}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({ title: "Ledger downloaded!" });
    } catch (error) {
      console.error("[dom-to-image-more] Failed to render ledger:", error);
      toast({ title: "Failed to download ledger", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Performance Stats
          </h1>
          <p className="text-muted-foreground mt-1">
            Full trading ledger — all weeks, all trades.
          </p>
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

      {/* Full ledger — this entire node is captured */}
      <div ref={ledgerRef}>
        <LedgerSheet />
      </div>
    </div>
  );
}
