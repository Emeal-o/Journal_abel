import { useMemo, useState, useEffect } from "react";
import { parseISO } from "date-fns";
import { useListWeeks } from "@workspace/api-client-react";
import type { Week } from "@workspace/api-client-react";

const STORAGE_KEY = "tradeops-week-order";

function loadSaved(): number[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as number[]) : null;
  } catch {
    return null;
  }
}

function persist(ids: number[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch { /* noop */ }
}

export function useOrderedWeeks() {
  const { data: weeks = [], isLoading, error } = useListWeeks();
  const [customOrder, setCustomOrder] = useState<number[] | null>(() => loadSaved());

  // When the weeks list changes (new week added / week deleted),
  // reconcile the saved order: append new IDs at the front, drop deleted ones.
  useEffect(() => {
    if (!weeks.length || !customOrder) return;
    const allIds = weeks.map((w) => w.id);
    const filtered = customOrder.filter((id) => allIds.includes(id));
    const added    = allIds.filter((id) => !customOrder.includes(id));
    if (added.length || filtered.length !== customOrder.length) {
      const next = [...added, ...filtered];
      setCustomOrder(next);
      persist(next);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks]);

  const orderedWeeks = useMemo((): Week[] => {
    if (!weeks.length) return weeks;

    if (customOrder) {
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

    // Default: newest start-date first
    return [...weeks].sort((a, b) => {
      try { return parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime(); }
      catch { return 0; }
    });
  }, [weeks, customOrder]);

  const setOrderedIds = (ids: number[]) => {
    setCustomOrder(ids);
    persist(ids);
  };

  const resetOrder = () => {
    setCustomOrder(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  };

  return { orderedWeeks, isLoading, error, setOrderedIds, resetOrder, isCustomOrder: customOrder !== null };
}
