import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Week } from "@workspace/api-client-react";
import { 
  useCreateWeek, 
  useUpdateWeek,
  useGetWeekSuggestion,
  getGetWeekSuggestionQueryKey,
  getListWeeksQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

const weekSchema = z.object({
  label: z.string().min(1, "Label is required"),
  startDate: z.date({ required_error: "Start date is required" }),
  notes: z.string().optional(),
});

type WeekFormValues = z.infer<typeof weekSchema>;

interface WeekFormProps {
  week?: Week;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WeekForm({ week, open, onOpenChange }: WeekFormProps) {
  const isEditing = !!week;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createWeek = useCreateWeek();
  const updateWeek = useUpdateWeek();

  // Auto-suggested Week Label + Start Date for a brand-new week, derived
  // server-side from the single most recent week (active or archived)
  // across the user's entire journal. Only fetched when the dialog is
  // open to create a new week (not when editing an existing one).
  const { data: suggestion } = useGetWeekSuggestion({
    query: { queryKey: getGetWeekSuggestionQueryKey(), enabled: open && !week },
  });

  const form = useForm<WeekFormValues>({
    resolver: zodResolver(weekSchema),
    defaultValues: {
      label: "",
      startDate: new Date(),
      notes: "",
    },
  });

  useEffect(() => {
    if (open && week) {
      form.reset({
        label: week.label,
        startDate: new Date(week.startDate),
        notes: week.notes || "",
      });
    } else if (open && !week) {
      form.reset({
        label: suggestion?.label ?? "",
        // Parse "YYYY-MM-DD" as a local date, not UTC, to avoid the date
        // shifting a day when the browser's timezone is behind UTC.
        startDate: suggestion?.startDate
          ? new Date(`${suggestion.startDate}T00:00:00`)
          : new Date(),
        notes: "",
      });
    }
    // Re-run once the suggestion arrives (it loads async after the dialog
    // opens) so the fields still get pre-filled, while remaining fully
    // editable afterward — this effect doesn't run again once the user types.
  }, [open, week, form, suggestion]);

  const onSubmit = (data: WeekFormValues) => {
    const formattedData = {
      ...data,
      startDate: data.startDate.toISOString().split("T")[0],
    };

    if (isEditing) {
      updateWeek.mutate(
        { id: week.id, data: formattedData },
        {
          onSuccess: () => {
            toast({ title: "Week updated successfully" });
            queryClient.invalidateQueries({ queryKey: getListWeeksQueryKey() });
            onOpenChange(false);
          },
          onError: () => {
            toast({ title: "Failed to update week", variant: "destructive" });
          },
        }
      );
    } else {
      createWeek.mutate(
        { data: formattedData },
        {
          onSuccess: () => {
            toast({ title: "Week created successfully" });
            queryClient.invalidateQueries({ queryKey: getListWeeksQueryKey() });
            onOpenChange(false);
          },
          onError: () => {
            toast({ title: "Failed to create week", variant: "destructive" });
          },
        }
      );
    }
  };

  const isPending = createWeek.isPending || updateWeek.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-background border-white/10 shadow-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Week" : "Add New Week"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Week Label</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Week 1, Jan Week 2" className="bg-white/5 border-white/10" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Start Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal bg-white/5 border-white/10 hover:bg-white/10 hover:text-white",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-white/10 bg-background" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date("2100-01-01") || date < new Date("2000-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Overall week context, rules, or focus..." 
                      className="resize-none bg-white/5 border-white/10 min-h-[100px]" 
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
                {isPending ? "Saving..." : "Save Week"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
