import { useMemo, useState, useEffect, useRef } from "react";
import { parseISO } from "date-fns";
import { useListWeeks } from "@workspace/api-client-react";
import type { Week } from "@workspace/api-client-react";

export type SortMode = "date-desc" | "date-asc" | "added-desc" | "added-asc" | "label-asc" | "custom";

const ORDER_KEY = "tradeops-week-order";
const SORT_KEY  = "tradeops-sort-mode";

function loadSaved<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}

function persist(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ }
}

function sortWeeks(weeks: Week[], mode: SortMode): Week[] {
  const arr = [...weeks];
  switch (mode) {
    case "date-desc":
      return arr.sort((a, b) => {
        try { return parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime(); }
        catch { return 0; }
      });
    case "date-asc":
      return arr.sort((a, b) => {
        try { return parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime(); }
        catch { return 0; }
      });
    case "added-desc":
      return arr.sort((a, b) => b.id - a.id);
    case "added-asc":
      return arr.sort((a, b) => a.id - b.id);
    case "label-asc":
      return arr.sort((a, b) => (a.label ?? "").localeCompare(b.label ?? "", undefined, { numeric: true }));
    default:
      return arr;
  }
}

export function useOrderedWeeks() {
  const { data: weeks = [], isLoading, error } = useListWeeks();
  const [customOrder, setCustomOrder] = useState<number[] | null>(() => loadSaved<number[]>(ORDER_KEY));
  const [sortMode, setSortModeState]  = useState<SortMode>(
    () => (loadSaved<SortMode>(SORT_KEY) ?? "date-desc")
  );

  const setSortMode = (mode: SortMode) => {
    setSortModeState(mode);
    persist(SORT_KEY, mode);
    // Clear custom order when switching away from custom
    if (mode !== "custom") {
      setCustomOrder(null);
      try { localStorage.removeItem(ORDER_KEY); } catch { /* noop */ }
    }
  };

  // Reconcile saved custom order when weeks change (new week added / deleted)
  const prevWeekIds = useRef<number[]>([]);
  useEffect(() => {
    if (!weeks.length) return;
    const allIds = weeks.map((w) => w.id);
    const prev   = prevWeekIds.current;

    if (customOrder) {
      const filtered = customOrder.filter((id) => allIds.includes(id));
      const added    = allIds.filter((id) => !customOrder.includes(id));
      if (added.length || filtered.length !== customOrder.length) {
        const next = [...added, ...filtered];
        setCustomOrder(next);
        persist(ORDER_KEY, next);
      }
    }

    // Auto-switch to custom mode if a new week was dragged (handled via setOrderedIds),
    // but also prepend newly added weeks to custom order if we're already in custom mode
    if (sortMode === "custom" && customOrder) {
      const added = allIds.filter((id) => !prev.includes(id));
      if (added.length) {
        const next = [...added, ...customOrder.filter((id) => allIds.includes(id))];
        setCustomOrder(next);
        persist(ORDER_KEY, next);
      }
    }

    prevWeekIds.current = allIds;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks]);

  const orderedWeeks = useMemo((): Week[] => {
    if (!weeks.length) return weeks;

    if (sortMode === "custom" && customOrder) {
      const map = new Map(weeks.map((w) => [w.id, w]));
      const result: Week[] = [];
      for (const id of customOrder) {
        const w = map.get(id);
        if (w) result.push(w);
      }
      // Append any not yet in the custom order
      for (const w of weeks) {
        if (!customOrder.includes(w.id)) result.push(w);
      }
      return result;
    }

    return sortWeeks(weeks, sortMode === "custom" ? "date-desc" : sortMode);
  }, [weeks, customOrder, sortMode]);

  const setOrderedIds = (ids: number[]) => {
    // Dragging → auto-activate custom mode
    if (sortMode !== "custom") {
      setSortModeState("custom");
      persist(SORT_KEY, "custom");
    }
    setCustomOrder(ids);
    persist(ORDER_KEY, ids);
  };

  return {
    orderedWeeks,
    isLoading,
    error,
    setOrderedIds,
    sortMode,
    setSortMode,
    isCustomOrder: sortMode === "custom" && customOrder !== null,
  };
}
