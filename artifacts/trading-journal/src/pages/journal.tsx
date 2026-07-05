import { useState } from "react";
import { BookOpen, GripVertical, Plus, RotateCcw } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Week } from "@workspace/api-client-react";

import { WeekCard } from "@/components/week-card";
import { WeekForm } from "@/components/week-form";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useOrderedWeeks } from "@/hooks/use-ordered-weeks";

// ─── sortable wrapper ─────────────────────────────────────────────────────────

function SortableWeekCard({ week }: { week: Week }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: week.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative",
    zIndex: isDragging ? 50 : undefined,
  };

  const dragHandle = (
    <button
      {...listeners}
      {...attributes}
      className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground/30 hover:text-muted-foreground/70 hover:bg-white/5 transition-colors cursor-grab active:cursor-grabbing touch-none"
      aria-label="Drag to reorder"
      tabIndex={-1}
    >
      <GripVertical className="w-4 h-4" />
    </button>
  );

  return (
    <div ref={setNodeRef} style={style}>
      <WeekCard week={week} dragHandle={dragHandle} />
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export function JournalPage() {
  const { orderedWeeks, isLoading, error, setOrderedIds, resetOrder, isCustomOrder } =
    useOrderedWeeks();
  const [isAddWeekOpen, setIsAddWeekOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = orderedWeeks.map((w) => w.id);
    const oldIndex = ids.indexOf(active.id as number);
    const newIndex = ids.indexOf(over.id as number);
    setOrderedIds(arrayMove(ids, oldIndex, newIndex));
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Trading Journal</h1>
          <p className="text-muted-foreground mt-1">Log your sessions and analyze your edge.</p>
        </div>
        <div className="flex items-center gap-2">
          {isCustomOrder && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetOrder}
              className="gap-1.5 text-muted-foreground hover:text-white"
              title="Reset to date order"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset order
            </Button>
          )}
          <Button
            onClick={() => setIsAddWeekOpen(true)}
            className="gap-2 shadow-[0_0_15px_rgba(var(--primary),0.2)]"
          >
            <Plus className="w-4 h-4" />
            Add Week
          </Button>
        </div>
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
      ) : orderedWeeks.length === 0 ? (
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={orderedWeeks.map((w) => w.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-6">
              {orderedWeeks.map((week) => (
                <SortableWeekCard key={week.id} week={week} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <WeekForm open={isAddWeekOpen} onOpenChange={setIsAddWeekOpen} />
    </div>
  );
}
