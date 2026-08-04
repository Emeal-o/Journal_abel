import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TradeResult, TradeInputResult } from "@workspace/api-client-react";
import { 
  useCreateTrade, 
  useUpdateTrade,
  getListWeeksQueryKey,
  getListTradesQueryKey,
  getGetStatsSummaryQueryKey,
  getGetWeeklyStatsQueryKey
} from "@workspace/api-client-react";
import type { TradeWithSetupType, TradeInputWithSetupType, TradeUpdateWithSetupType } from "@/lib/trade-types";
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
import { useSetupTypes } from "@/lib/setup-types-api";

const CLEAR_SENTINEL = "__none__";

const tradeSchema = z.object({
  result: z.enum([TradeResult.Win, TradeResult.Loss, TradeResult.BE]),
  rrr: z.coerce.number().min(-100).max(100),
  pips: z.coerce.number().min(-10000).max(10000),
  notes: z.string().optional(),
  flagEmoji: z.string().optional(),
  setupTypeId: z.number().nullable().optional(),
  direction: z.enum(["Long", "Short"], { message: "Please select Long or Short." }),
});

type TradeFormValues = z.infer<typeof tradeSchema>;

interface TradeFormProps {
  weekId: number;
  trade?: TradeWithSetupType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TradeForm({ weekId, trade, open, onOpenChange }: TradeFormProps) {
  const isEditing = !!trade;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: setupTypes = [] } = useSetupTypes();
  
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
      setupTypeId: null,
      direction: undefined,
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
        setupTypeId: trade.setupTypeId ?? null,
        // Pre-select existing direction; undefined leaves neither toggle selected
        // (forces the user to pick one for old trades that pre-date this field).
        direction: (trade.direction as "Long" | "Short" | undefined) ?? undefined,
      });
    } else if (open && !trade) {
      form.reset({
        result: TradeResult.Win,
        rrr: 0,
        pips: 0,
        notes: "",
        flagEmoji: "",
        setupTypeId: null,
        direction: undefined,
      });
    }
  }, [open, trade, form]);

  const onSubmit = (data: TradeFormValues) => {
    const { setupTypeId, direction, ...rest } = data;
    if (isEditing) {
      // TradeUpdateWithSetupType structurally satisfies TradeUpdate (it adds optional fields),
      // so it is assignable to the hook's expected type without a cast.
      const updatePayload: TradeUpdateWithSetupType = { ...rest, setupTypeId: setupTypeId ?? null, direction: direction ?? null };
      updateTrade.mutate(
        { id: trade.id, data: updatePayload },
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
      // Same pattern: TradeInputWithSetupType satisfies TradeInput structurally.
      const createPayload: TradeInputWithSetupType = { ...rest, weekId, setupTypeId: setupTypeId ?? undefined, direction: direction ?? null };
      createTrade.mutate(
        { data: createPayload },
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

            {/* Direction — required toggle: Long or Short */}
            <FormField
              control={form.control}
              name="direction"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Direction</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      {(["Long", "Short"] as const).map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => field.onChange(option)}
                          className={[
                            "flex-1 py-2 rounded-lg border text-sm font-semibold transition-colors",
                            field.value === option
                              ? option === "Long"
                                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                                : "bg-rose-500/20 border-rose-500/50 text-rose-400"
                              : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10",
                          ].join(" ")}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Setup Type — only rendered when the user has at least one active type */}
            {setupTypes.length > 0 && (
              <FormField
                control={form.control}
                name="setupTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Setup Type (optional)</FormLabel>
                    <Select
                      value={field.value != null ? String(field.value) : CLEAR_SENTINEL}
                      onValueChange={(val) =>
                        field.onChange(val === CLEAR_SENTINEL ? null : Number(val))
                      }
                    >
                      <FormControl>
                        <SelectTrigger className="bg-white/5 border-white/10">
                          <SelectValue placeholder="No setup type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background border-white/10">
                        <SelectItem value={CLEAR_SENTINEL} className="text-muted-foreground">
                          No setup type
                        </SelectItem>
                        {setupTypes.map((st) => (
                          <SelectItem key={st.id} value={String(st.id)}>
                            <span className="flex items-center gap-2">
                              <span
                                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: st.color }}
                              />
                              {st.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
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
