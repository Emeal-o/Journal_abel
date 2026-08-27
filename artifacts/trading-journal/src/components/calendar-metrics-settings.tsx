import { ArrowLeft, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Switch } from "@/components/ui/switch";
import {
  CALENDAR_METRIC_LABELS,
  type CalendarMetricId,
  useCalendarPrefs,
} from "@/hooks/use-calendar-prefs";

function SortableMetricRow({
  id,
  hidden,
  onToggle,
}: {
  id: CalendarMetricId;
  hidden: boolean;
  onToggle: (id: CalendarMetricId, hidden: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: hidden ? 0.45 : isDragging ? 0.65 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
      className="flex items-center gap-3 min-h-[54px] px-4 py-3 border-b border-white/[0.06] last:border-b-0"
      data-testid={`row-calendar-metric-${id}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Drag ${CALENDAR_METRIC_LABELS[id]}`}
        data-testid={`button-drag-calendar-metric-${id}`}
        className="flex-shrink-0 text-muted-foreground/40 hover:text-muted-foreground/80 cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical className="w-5 h-5" />
      </button>
      <span className="flex-1 min-w-0 font-mono text-sm text-foreground/80">
        {CALENDAR_METRIC_LABELS[id]}
      </span>
      <Switch
        checked={!hidden}
        onCheckedChange={(checked) => onToggle(id, !checked)}
        aria-label={`${hidden ? "Show" : "Hide"} ${CALENDAR_METRIC_LABELS[id]}`}
        data-testid={`switch-calendar-metric-${id}`}
      />
    </div>
  );
}

export function CalendarMetricsSettings({ onBack }: { onBack: () => void }) {
  const {
    calendarMetricsOrder,
    hiddenCalendarMetrics,
    setCalendarMetricsOrder,
    setHiddenCalendarMetrics,
  } = useCalendarPrefs();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = calendarMetricsOrder.indexOf(active.id as CalendarMetricId);
    const to = calendarMetricsOrder.indexOf(over.id as CalendarMetricId);
    if (from >= 0 && to >= 0) setCalendarMetricsOrder(arrayMove(calendarMetricsOrder, from, to));
  }

  function handleToggle(id: CalendarMetricId, hidden: boolean) {
    setHiddenCalendarMetrics(
      hidden
        ? [...hiddenCalendarMetrics, id]
        : hiddenCalendarMetrics.filter((metric) => metric !== id),
    );
  }

  return (
    <div className="max-w-lg mx-auto animate-in fade-in slide-in-from-right-2 duration-300">
      <button
        type="button"
        onClick={onBack}
        data-testid="button-back-calendar-metrics"
        className="flex items-center gap-2 text-sm font-mono text-muted-foreground hover:text-white transition-colors mb-5"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Settings
      </button>
      <h1 className="text-2xl font-semibold tracking-tight mb-2">Calendar Metrics</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Choose the read-only values shown inside each period. Drag to set their order.
      </p>
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={calendarMetricsOrder} strategy={verticalListSortingStrategy}>
            {calendarMetricsOrder.map((id) => (
              <SortableMetricRow
                key={id}
                id={id}
                hidden={hiddenCalendarMetrics.includes(id)}
                onToggle={handleToggle}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
      <p className="mt-3 px-1 text-[11px] font-mono text-muted-foreground/50">
        The first enabled performance metric sets each block’s color. Trade Count never colors a block.
      </p>
    </div>
  );
}