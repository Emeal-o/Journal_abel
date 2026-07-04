import { useListWeeks } from "@workspace/api-client-react";
import { WeekCard } from "@/components/week-card";
import { WeekForm } from "@/components/week-form";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function JournalPage() {
  const { data: weeks, isLoading, error } = useListWeeks();
  const [isAddWeekOpen, setIsAddWeekOpen] = useState(false);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Trading Journal</h1>
          <p className="text-muted-foreground mt-1">Log your sessions and analyze your edge.</p>
        </div>
        <Button onClick={() => setIsAddWeekOpen(true)} className="gap-2 shadow-[0_0_15px_rgba(var(--primary),0.2)]">
          <Plus className="w-4 h-4" />
          Add Week
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-[200px] w-full rounded-xl bg-white/5" />
          <Skeleton className="h-[200px] w-full rounded-xl bg-white/5" />
        </div>
      ) : error ? (
        <div className="p-8 text-center border border-destructive/20 bg-destructive/10 rounded-xl">
          <p className="text-destructive">Failed to load journal. Please try again.</p>
        </div>
      ) : weeks?.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 border border-dashed border-white/10 rounded-xl bg-white/5 backdrop-blur-sm">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <BookOpen className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-medium text-white mb-2">No weeks logged yet</h3>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            Start tracking your trading journey by adding your first week.
          </p>
          <Button onClick={() => setIsAddWeekOpen(true)}>Add Your First Week</Button>
        </div>
      ) : (
        <div className="space-y-6">
          {weeks?.map((week) => (
            <WeekCard key={week.id} week={week} />
          ))}
        </div>
      )}

      <WeekForm open={isAddWeekOpen} onOpenChange={setIsAddWeekOpen} />
    </div>
  );
}

// Need to import BookOpen since it's used in empty state
import { BookOpen } from "lucide-react";
