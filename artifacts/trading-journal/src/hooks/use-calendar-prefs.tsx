import { createContext, useContext, useState } from "react";

export type CalendarPeriodMode = "4week" | "calendar_month";
export type CalendarViewMode = "list" | "grid";
export type CalendarMetricId = "rrSum" | "pipsSum" | "winRate" | "tradeCount";

export const CALENDAR_METRIC_ORDER: readonly CalendarMetricId[] = [
  "rrSum",
  "pipsSum",
  "winRate",
  "tradeCount",
];

export const CALENDAR_METRIC_LABELS: Record<CalendarMetricId, string> = {
  rrSum: "RR Sum",
  pipsSum: "Pips Sum",
  winRate: "Win Rate %",
  tradeCount: "Trade Count",
};

export const CALENDAR_PERIOD_KEY = "tradeops_calendar_period_mode";
export const CALENDAR_METRICS_ORDER_KEY = "tradeops_calendar_metrics_order";
export const CALENDAR_METRICS_HIDDEN_KEY = "tradeops_calendar_metrics_hidden";
export const CALENDAR_VIEW_MODE_KEY = "tradeops_calendar_view_mode";

interface CalendarPrefs {
  calendarPeriodMode: CalendarPeriodMode;
  calendarViewMode: CalendarViewMode;
  calendarMetricsOrder: CalendarMetricId[];
  hiddenCalendarMetrics: CalendarMetricId[];
  setCalendarPeriodMode: (value: CalendarPeriodMode) => void;
  setCalendarViewMode: (value: CalendarViewMode) => void;
  setCalendarMetricsOrder: (value: CalendarMetricId[]) => void;
  setHiddenCalendarMetrics: (value: CalendarMetricId[]) => void;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function persist(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Preferences are best-effort; the visual surface remains usable.
  }
}

function readViewMode(): CalendarViewMode {
  try {
    const raw = localStorage.getItem(CALENDAR_VIEW_MODE_KEY);
    if (raw === "list" || raw === "grid") return raw;
    const parsed = raw === null ? null : JSON.parse(raw);
    return parsed === "list" || parsed === "grid" ? parsed : "list";
  } catch {
    return "list";
  }
}

function isMetric(value: unknown): value is CalendarMetricId {
  return (CALENDAR_METRIC_ORDER as readonly string[]).includes(value as string);
}

function readMetricOrder(): CalendarMetricId[] {
  const stored = readJson<unknown>(CALENDAR_METRICS_ORDER_KEY, [...CALENDAR_METRIC_ORDER]);
  const valid = Array.isArray(stored) ? stored.filter(isMetric) : [];
  return [...valid, ...CALENDAR_METRIC_ORDER.filter((metric) => !valid.includes(metric))];
}

function readHiddenMetrics(): CalendarMetricId[] {
  const stored = readJson<unknown>(CALENDAR_METRICS_HIDDEN_KEY, []);
  return Array.isArray(stored) ? stored.filter(isMetric) : [];
}

const CalendarPrefsContext = createContext<CalendarPrefs | null>(null);

export function CalendarPrefsProvider({ children }: { children: React.ReactNode }) {
  const [calendarPeriodMode, setPeriodState] = useState<CalendarPeriodMode>(() => {
    const stored = readJson<unknown>(CALENDAR_PERIOD_KEY, "calendar_month");
    return stored === "4week" || stored === "calendar_month" ? stored : "calendar_month";
  });
  const [calendarViewMode, setViewState] = useState<CalendarViewMode>(() => {
    return readViewMode();
  });
  const [calendarMetricsOrder, setOrderState] = useState<CalendarMetricId[]>(readMetricOrder);
  const [hiddenCalendarMetrics, setHiddenState] = useState<CalendarMetricId[]>(readHiddenMetrics);

  function setCalendarPeriodMode(value: CalendarPeriodMode) {
    persist(CALENDAR_PERIOD_KEY, value);
    setPeriodState(value);
  }

  function setCalendarViewMode(value: CalendarViewMode) {
    try {
      localStorage.setItem(CALENDAR_VIEW_MODE_KEY, value);
    } catch {
      // Preferences are best-effort; the visual surface remains usable.
    }
    setViewState(value);
  }

  function setCalendarMetricsOrder(value: CalendarMetricId[]) {
    const next = [...value.filter(isMetric), ...CALENDAR_METRIC_ORDER.filter((metric) => !value.includes(metric))];
    persist(CALENDAR_METRICS_ORDER_KEY, next);
    setOrderState(next);
  }

  function setHiddenCalendarMetrics(value: CalendarMetricId[]) {
    const next = value.filter(isMetric);
    persist(CALENDAR_METRICS_HIDDEN_KEY, next);
    setHiddenState(next);
  }

  return (
    <CalendarPrefsContext.Provider
      value={{
        calendarPeriodMode,
        calendarViewMode,
        calendarMetricsOrder,
        hiddenCalendarMetrics,
        setCalendarPeriodMode,
        setCalendarViewMode,
        setCalendarMetricsOrder,
        setHiddenCalendarMetrics,
      }}
    >
      {children}
    </CalendarPrefsContext.Provider>
  );
}

export function useCalendarPrefs(): CalendarPrefs {
  const context = useContext(CalendarPrefsContext);
  if (!context) throw new Error("useCalendarPrefs must be used within CalendarPrefsProvider");
  return context;
}