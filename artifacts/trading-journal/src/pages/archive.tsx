import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Archive } from "lucide-react";
import type { Week } from "@workspace/api-client-react";

import { WeekCard } from "@/components/week-card";
import { Skeleton } from "@/components/ui/skeleton";
import { listArchivedWeeks, type ArchivedWeek } from "@/lib/weeks-api";

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Group archived weeks by monthLabel, sorted most-recently-archived first. */
function groupByMonth(weeks: ArchivedWeek[]): Array<{ label: string; weeks: ArchivedWeek[]; latestAt: string }> {
  const map = new Map<string, ArchivedWeek[]>();
  for (const w of weeks) {
    const key = w.monthLabel || "Uncategorised";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(w);
  }
  return Array.from(map.entries())
    .map(([label, ws]) => ({
      label,
      weeks: ws,
      // Use the most recent archivedAt in the group to sort groups
      latestAt: ws.reduce((max, w) => (w.archivedAt > max ? w.archivedAt : max), ws[0].archivedAt),
    }))
    .sort((a, b) => b.latestAt.localeCompare(a.latestAt));
}

// ─── month group ──────────────────────────────────────────────────────────────

function MonthGroup({ label, weeks }: { label: string; weeks: ArchivedWeek[] }) {
  const [open, setOpen] = useState(true);
  const totalTrades = weeks.reduce((sum, w) => sum + 0, 0); // trade count shown per card
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          {open
            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
            : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <span className="text-white font-semibold text-lg">{label}</span>
          <span className="text-xs text-muted-foreground/60 font-normal">
            {weeks.length} week{weeks.length !== 1 ? "s" : ""}
          </span>
        </div>
      </button>

      {open && (
        <div className="p-4 space-y-4 border-t border-white/5">
          {weeks.map((w) => (
            <WeekCard
              key={w.id}
              // ArchivedWeek is a superset of the Week shape — safe to cast
              week={w as unknown as Week}
              readOnly
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export function ArchivePage() {
  const { data: archivedWeeks = [], isLoading, error } = useQuery({
    queryKey: ["archived-weeks"],
    queryFn: listArchivedWeeks,
  });

  const groups = groupByMonth(archivedWeeks);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Archive</h1>
        <p className="text-muted-foreground mt-1">Past months, preserved for reference.</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-14 w-full rounded-xl bg-white/5" />
          <Skeleton className="h-14 w-full rounded-xl bg-white/5" />
        </div>
      ) : error ? (
        <div className="p-8 text-center border border-destructive/20 bg-destructive/10 rounded-xl">
          <p className="text-destructive">Failed to load archive. Please try again.</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 border border-dashed border-white/10 rounded-xl bg-white/5 backdrop-blur-sm">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <Archive className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-medium text-white mb-2">No archived months yet</h3>
          <p className="text-muted-foreground text-center max-w-md">
            Use "Start New Month" on the Journal page to close out your active weeks and start fresh.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <MonthGroup key={g.label} label={g.label} weeks={g.weeks} />
          ))}
        </div>
      )}
    </div>
  );
}
