import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trade, TradeResult, TradeInputResult } from "@workspace/api-client-react";
import { 
  useCreateTrade, 
  useUpdateTrade,
  getListWeeksQueryKey,
  getListTradesQueryKey,
  getGetStatsSummaryQueryKey,
  getGetWeeklyStatsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

const tradeSchema = z.object({
  result: z.enum([TradeResult.Win, TradeResult.Loss, TradeResult.BE]),
  rrr: z.coerce.number().min(-100).max(100),
  pips: z.coerce.number().min(-10000).max(10000),
  notes: z.string().optional(),
  flagEmoji: z.string().optional(),
});

type TradeFormValues = z.infer<typeof tradeSchema>;

interface TradeFormProps {
  weekId: number;
  trade?: Trade;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TradeForm({ weekId, trade, open, onOpenChange }: TradeFormProps) {
  const isEditing = !!trade;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createTrade = useCreateTrade();
  const updateTrade = useUpdateTrade();

  const form = useForm<TradeFormValues>({
    resolver: zodResolver(tradeSchema),
    defaultValues: {
      result: TradeResult.Win,
      rrr: 0,
      pips: 0,
      notes: "",
      flagEmoji: "",
    },
  });

  useEffect(() => {
    if (open && trade) {
      form.reset({
        result: trade.result,
        rrr: Number(trade.rrr),
        pips: Number(trade.pips),
        notes: trade.notes || "",
        flagEmoji: trade.flagEmoji || "",
      });
    } else if (open && !trade) {
      form.reset({
        result: TradeResult.Win,
        rrr: 0,
        pips: 0,
        notes: "",
        flagEmoji: "",
      });
    }
  }, [open, trade, form]);

  const onSubmit = (data: TradeFormValues) => {
    if (isEditing) {
      updateTrade.mutate(
        { id: trade.id, data },
        {
          onSuccess: () => {
            toast({ title: "Trade updated successfully" });
            queryClient.invalidateQueries({ queryKey: getListTradesQueryKey({ weekId }) });
            queryClient.invalidateQueries({ queryKey: getListWeeksQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetWeeklyStatsQueryKey() });
            onOpenChange(false);
          },
          onError: () => {
            toast({ title: "Failed to update trade", variant: "destructive" });
          },
        }
      );
    } else {
      createTrade.mutate(
        { data: { ...data, weekId } },
        {
          onSuccess: () => {
            toast({ title: "Trade created successfully" });
            queryClient.invalidateQueries({ queryKey: getListTradesQueryKey({ weekId }) });
            queryClient.invalidateQueries({ queryKey: getListWeeksQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetWeeklyStatsQueryKey() });
            onOpenChange(false);
          },
          onError: () => {
            toast({ title: "Failed to create trade", variant: "destructive" });
          },
        }
      );
    }
  };

  const isPending = createTrade.isPending || updateTrade.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-background border-white/10 shadow-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Trade" : "Log New Trade"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            
            <FormField
              control={form.control}
              name="result"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Result</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-white/5 border-white/10">
                        <SelectValue placeholder="Select a result" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-background border-white/10">
                      <SelectItem value={TradeResult.Win} className="text-emerald-400">Win</SelectItem>
                      <SelectItem value={TradeResult.Loss} className="text-rose-400">Loss</SelectItem>
                      <SelectItem value={TradeResult.BE} className="text-slate-400">Break Even</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="rrr"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Risk/Reward (R)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" className="bg-white/5 border-white/10 font-mono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="pips"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pips</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" className="bg-white/5 border-white/10 font-mono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes / Lessons (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Why did you take this trade? Any mistakes?" 
                      className="resize-none bg-white/5 border-white/10 min-h-[100px]" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="flagEmoji"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Flag emoji (optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. 🔥"
                      maxLength={8}
                      className="bg-white/5 border-white/10 w-24"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end pt-4 gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="bg-transparent border-white/10 hover:bg-white/5">
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className="shadow-[0_0_10px_rgba(var(--primary),0.3)]">
                {isPending ? "Saving..." : "Save Trade"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
