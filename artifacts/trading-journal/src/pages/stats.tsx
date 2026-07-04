import { useRef } from "react";
import { Download, Target, Crosshair, BarChart3, Activity } from "lucide-react";
import html2canvas from "html2canvas";
import { format } from "date-fns";
import { 
  useGetStatsSummary, 
  useGetWeeklyStats,
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

export function StatsPage() {
  const { data: summary, isLoading: loadingSummary, error: summaryError } = useGetStatsSummary();
  const { data: weeklyStats, isLoading: loadingWeekly, error: weeklyError } = useGetWeeklyStats();
  const statsRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleDownload = async () => {
    if (!statsRef.current) return;

    try {
      const canvas = await html2canvas(statsRef.current, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#0b0f19",
        scale: 2,
        // Skip decorative blur divs — html2canvas cannot render CSS filter:blur()
        // and throws a rendering error when it encounters them.
        ignoreElements: (el) =>
          el instanceof HTMLElement && el.dataset.exportIgnore === "true",
      });

      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      link.download = `trade-stats-${format(new Date(), "yyyy-MM-dd")}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({ title: "Stats card downloaded!" });
    } catch (error) {
      console.error("[html2canvas] Failed to render stats card:", error);
      toast({ title: "Failed to download stats", variant: "destructive" });
    }
  };

  const isLoading = loadingSummary || loadingWeekly;
  const isError = summaryError || weeklyError;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Performance Stats</h1>
          <p className="text-muted-foreground mt-1">Your trading edge quantified.</p>
        </div>
        <Button 
          onClick={handleDownload} 
          disabled={isLoading || isError}
          className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(var(--primary),0.4)] border border-primary-foreground/10"
        >
          <Download className="w-4 h-4" />
          Download Statistics Card
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-8">
          <Skeleton className="h-[200px] w-full rounded-2xl bg-white/5" />
          <Skeleton className="h-[400px] w-full rounded-2xl bg-white/5" />
        </div>
      ) : isError ? (
        <div className="p-8 text-center border border-destructive/20 bg-destructive/10 rounded-xl">
          <p className="text-destructive">Failed to load statistics. Please try again.</p>
        </div>
      ) : summary && weeklyStats ? (
        <div className="space-y-8">
          {/* Card wrapped for export */}
          <div 
            ref={statsRef} 
            className="p-6 md:p-8 rounded-2xl border border-white/10 bg-[#0c1120] relative overflow-hidden"
          >
            {/* Background glowing effects — tagged so html2canvas skips blur() rendering */}
            <div data-export-ignore="true" className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            <div data-export-ignore="true" className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-[80px]" />
            <div data-export-ignore="true" className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/20 rounded-full blur-[80px]" />

            <div className="relative z-10">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Grand Total Summary</h2>
                  <p className="text-muted-foreground">All-time trading performance</p>
                </div>
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-lg">Trade<span className="text-primary">Ops</span></span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                <div className="p-5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col">
                  <span className="text-muted-foreground text-sm font-medium flex items-center gap-2">
                    <Target className="w-4 h-4 text-emerald-400" /> Win Rate
                  </span>
                  <span className="text-4xl font-bold text-white mt-2 tracking-tight">
                    {summary.winRate}<span className="text-2xl text-white/50">%</span>
                  </span>
                </div>
                
                <div className="p-5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col">
                  <span className="text-muted-foreground text-sm font-medium flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-400" /> Net RRR
                  </span>
                  <span className={cn(
                    "text-4xl font-bold mt-2 tracking-tight font-mono",
                    summary.netRR > 0 ? "text-emerald-400" : summary.netRR < 0 ? "text-rose-400" : "text-white"
                  )}>
                    {summary.netRR > 0 ? "+" : ""}{summary.netRR.toFixed(2)}<span className="text-2xl opacity-50">R</span>
                  </span>
                </div>

                <div className="p-5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col">
                  <span className="text-muted-foreground text-sm font-medium flex items-center gap-2">
                    <Crosshair className="w-4 h-4 text-purple-400" /> Net Pips
                  </span>
                  <span className={cn(
                    "text-4xl font-bold mt-2 tracking-tight font-mono",
                    summary.netPips > 0 ? "text-emerald-400" : summary.netPips < 0 ? "text-rose-400" : "text-white"
                  )}>
                    {summary.netPips > 0 ? "+" : ""}{summary.netPips.toFixed(1)}
                  </span>
                </div>

                <div className="p-5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between">
                  <span className="text-muted-foreground text-sm font-medium">Total Trades</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-4xl font-bold text-white tracking-tight">{summary.totalTrades}</span>
                  </div>
                  <div className="flex gap-2 mt-2 text-xs">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">{summary.wins} W</Badge>
                    <Badge variant="outline" className="bg-rose-500/10 text-rose-400 border-rose-500/20">{summary.losses} L</Badge>
                    <Badge variant="outline" className="bg-slate-500/10 text-slate-400 border-slate-500/20">{summary.breakEvens} BE</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-xl overflow-hidden shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5)]">
            <div className="p-4 border-b border-white/5 bg-white/[0.01]">
              <h3 className="text-lg font-semibold text-white">Weekly Breakdown</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-white/[0.02] border-b border-white/5">
                  <tr>
                    <th className="px-6 py-4 font-medium">Week</th>
                    <th className="px-6 py-4 font-medium text-center">Trades</th>
                    <th className="px-6 py-4 font-medium text-center">Win / Loss / BE</th>
                    <th className="px-6 py-4 font-medium text-right">Win Rate</th>
                    <th className="px-6 py-4 font-medium text-right">Net RR</th>
                    <th className="px-6 py-4 font-medium text-right">Net Pips</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {weeklyStats.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                        No weekly data available yet.
                      </td>
                    </tr>
                  ) : (
                    weeklyStats.map((stat) => (
                      <tr key={stat.weekId} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4 font-medium text-white">{stat.weekLabel}</td>
                        <td className="px-6 py-4 text-center">{stat.totalTrades}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-emerald-400">{stat.wins}</span>
                          <span className="text-muted-foreground mx-1">/</span>
                          <span className="text-rose-400">{stat.losses}</span>
                          <span className="text-muted-foreground mx-1">/</span>
                          <span className="text-slate-400">{stat.breakEvens}</span>
                        </td>
                        <td className="px-6 py-4 text-right font-semibold">
                          {stat.winRate}%
                        </td>
                        <td className="px-6 py-4 text-right font-mono">
                          <span className={stat.netRR > 0 ? "text-emerald-400" : stat.netRR < 0 ? "text-rose-400" : "text-muted-foreground"}>
                            {stat.netRR > 0 ? "+" : ""}{stat.netRR.toFixed(2)}R
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono">
                          <span className={stat.netPips > 0 ? "text-emerald-400" : stat.netPips < 0 ? "text-rose-400" : "text-muted-foreground"}>
                            {stat.netPips > 0 ? "+" : ""}{stat.netPips.toFixed(1)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Ensure cn is imported
import { cn } from "@/lib/utils";
