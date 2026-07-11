import { useState } from "react";
import { format } from "date-fns";
import { 
  ChevronDown, 
  ChevronRight, 
  MoreVertical, 
  Pencil, 
  Trash2, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Minus 
} from "lucide-react";
import { Week, TradeResult, Trade } from "@workspace/api-client-react";
import { 
  useDeleteWeek, 
  useDeleteTrade,
  useListTrades,
  getListWeeksQueryKey,
  getListTradesQueryKey,
  getGetStatsSummaryQueryKey,
  getGetWeeklyStatsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { TradeForm } from "./trade-form";
import { WeekForm } from "./week-form";

interface WeekCardProps {
  week: Week;
  dragHandle?: React.ReactNode;
  /** When true, hides edit/delete/add-trade actions — used on the Archive page. */
  readOnly?: boolean;
}

export function WeekCard({ week, dragHandle, readOnly = false }: WeekCardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isTradeFormOpen, setIsTradeFormOpen] = useState(false);
  const [isEditWeekOpen, setIsEditWeekOpen] = useState(false);
  const [isDeleteWeekOpen, setIsDeleteWeekOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const deleteWeek = useDeleteWeek();
  const deleteTrade = useDeleteTrade();
  const { data: trades = [] } = useListTrades({ weekId: week.id }, { query: { queryKey: getListTradesQueryKey({ weekId: week.id }) } });

  const handleDeleteWeek = () => {
    deleteWeek.mutate({ id: week.id }, {
      onSuccess: () => {
        toast({ title: "Week deleted" });
        queryClient.invalidateQueries({ queryKey: getListWeeksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetWeeklyStatsQueryKey() });
        setIsDeleteWeekOpen(false);
      },
      onError: () => {
        toast({ title: "Failed to delete week", variant: "destructive" });
      }
    });
  };

  const handleDeleteTrade = (tradeId: number) => {
    if (confirm("Are you sure you want to delete this trade?")) {
      deleteTrade.mutate({ id: tradeId }, {
        onSuccess: () => {
          toast({ title: "Trade deleted" });
          queryClient.invalidateQueries({ queryKey: getListTradesQueryKey({ weekId: week.id }) });
          queryClient.invalidateQueries({ queryKey: getListWeeksQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetWeeklyStatsQueryKey() });
        },
        onError: () => {
          toast({ title: "Failed to delete trade", variant: "destructive" });
        }
      });
    }
  };

  const handleEditTrade = (trade: Trade) => {
    setEditingTrade(trade);
  };

  // Calculate stats for this week
  const wins = trades.filter(t => t.result === TradeResult.Win).length;
  const losses = trades.filter(t => t.result === TradeResult.Loss).length;
  const breakEvens = trades.filter(t => t.result === TradeResult.BE).length;
  const totalTrades = trades.length;
  const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
  const netRR = trades.reduce((sum, t) => sum + Number(t.rrr || 0), 0);
  const netPips = trades.reduce((sum, t) => sum + Number(t.pips || 0), 0);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="border border-white/10 bg-white/[0.02] backdrop-blur-xl rounded-xl overflow-hidden shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5)] transition-all duration-300"
    >
      <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/[0.01]">
        <div className="flex items-center gap-4">
          {dragHandle}
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-8 h-8 p-0 hover:bg-white/10">
              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          <div>
            <h3 className="text-lg font-semibold text-white">{week.label}</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span>{format(new Date(week.startDate), "MMM d, yyyy")}</span>
              {week.notes && (
                <>
                  <span>•</span>
                  <span className="truncate max-w-[200px] sm:max-w-[400px]">{week.notes}</span>
                </>
              )}
            </div>
          </div>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="bg-white/5 hover:bg-white/10 text-white"
              onClick={() => setIsTradeFormOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Trade
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="w-8 h-8 p-0 text-muted-foreground hover:text-white">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-background border-white/10">
                <DropdownMenuItem onClick={() => setIsEditWeekOpen(true)} className="cursor-pointer">
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit Week
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setIsDeleteWeekOpen(true)}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Week
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <CollapsibleContent className="animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="p-0 overflow-x-auto">
          {trades.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No trades logged this week.
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-white/[0.02] border-b border-white/5">
                <tr>
                  <th className="px-6 py-3 font-medium">Trade #</th>
                  <th className="px-6 py-3 font-medium">Result</th>
                  <th className="px-6 py-3 font-medium text-right">RRR</th>
                  <th className="px-6 py-3 font-medium text-right">Pips</th>
                  <th className="px-6 py-3 font-medium">Notes</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {trades.map((trade, i) => (
                  <tr key={trade.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 font-medium text-white">#{trade.tradeNumber}</td>
                    <td className="px-6 py-4">
                      {trade.result === TradeResult.Win && (
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20">
                          <TrendingUp className="w-3 h-3 mr-1" /> Win
                        </Badge>
                      )}
                      {trade.result === TradeResult.Loss && (
                        <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20">
                          <TrendingDown className="w-3 h-3 mr-1" /> Loss
                        </Badge>
                      )}
                      {trade.result === TradeResult.BE && (
                        <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/20 hover:bg-slate-500/20">
                          <Minus className="w-3 h-3 mr-1" /> BE
                        </Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-muted-foreground">
                      1 / <span className={Number(trade.rrr) > 0 ? "text-emerald-400" : Number(trade.rrr) < 0 ? "text-rose-400" : "text-slate-400"}>
                        {Math.abs(Number(trade.rrr)).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono">
                      <span className={Number(trade.pips) > 0 ? "text-emerald-400" : Number(trade.pips) < 0 ? "text-rose-400" : "text-muted-foreground"}>
                        {Number(trade.pips) > 0 ? "+" : ""}{trade.pips}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground truncate max-w-[200px]">
                      {trade.notes || "-"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-white" onClick={() => handleEditTrade(trade)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteTrade(trade.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white/[0.03] p-4 border-t border-white/5 flex flex-wrap gap-4 text-sm justify-between items-center">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Wins:</span>
              <span className="font-semibold text-emerald-400">{wins}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Losses:</span>
              <span className="font-semibold text-rose-400">{losses}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">BE:</span>
              <span className="font-semibold text-slate-400">{breakEvens}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Win Rate:</span>
              <span className="font-semibold text-white">{winRate}%</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Net RR:</span>
              <span className={`font-mono font-semibold ${netRR > 0 ? 'text-emerald-400' : netRR < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                {netRR > 0 ? '+' : ''}{netRR.toFixed(2)}R
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Net Pips:</span>
              <span className={`font-mono font-semibold ${netPips > 0 ? 'text-emerald-400' : netPips < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                {netPips > 0 ? '+' : ''}{netPips.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      </CollapsibleContent>

      <TradeForm 
        weekId={week.id} 
        open={isTradeFormOpen} 
        onOpenChange={setIsTradeFormOpen} 
      />
      
      <TradeForm 
        weekId={week.id} 
        trade={editingTrade || undefined} 
        open={!!editingTrade} 
        onOpenChange={(open) => !open && setEditingTrade(null)} 
      />
      
      <WeekForm 
        week={week} 
        open={isEditWeekOpen} 
        onOpenChange={setIsEditWeekOpen} 
      />

      <AlertDialog open={isDeleteWeekOpen} onOpenChange={setIsDeleteWeekOpen}>
        <AlertDialogContent className="bg-background border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the week "{week.label}" and all its recorded trades. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 hover:bg-white/10 hover:text-white">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteWeek}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {deleteWeek.isPending ? "Deleting..." : "Delete Week"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Collapsible>
  );
}
