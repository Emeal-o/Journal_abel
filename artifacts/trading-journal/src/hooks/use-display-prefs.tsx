import { createContext, useContext, useEffect, useState } from "react";

// — Types —————————————————————————————————————

export type LandingPage    = "journal" | "analysis";
export type StatDisplay    = "rrr" | "pips";
export type FontSizePref   = "small" | "default" | "large";
export type ThemePref      = "current" | "amoled" | "dim";

export interface DisplayPrefs {
  defaultLanding:     LandingPage;
  defaultStatDisplay: StatDisplay;
  fontSize:           FontSizePref;
  reduceMotion:       boolean;
  showRRCalculator:   boolean;
  theme:              ThemePref;
  setDefaultLanding:     (v: LandingPage) => void;
  setDefaultStatDisplay: (v: StatDisplay) => void;
  setFontSize:           (v: FontSizePref) => void;
  setReduceMotion:       (v: boolean) => void;
  setShowRRCalculator:   (v: boolean) => void;
  setTheme:              (v: ThemePref) => void;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ }
}

function systemReduceMotion() {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// — Context —————————————————————————————————————

const Ctx = createContext<DisplayPrefs | null>(null);

// — Provider —————————————————————————————————————

export function DisplayPrefsProvider({ children }: { children: React.ReactNode }) {
  const [defaultLanding, _setDefaultLanding] = useState<LandingPage>(() =>
    read("tradeops_default_landing", "journal"),
  );
  const [defaultStatDisplay, _setDefaultStatDisplay] = useState<StatDisplay>(() =>
    read("tradeops_default_stat_display", "rrr"),
  );
  const [fontSize, _setFontSize] = useState<FontSizePref>(() =>
    read("tradeops_font_size", "default"),
  );
  const [reduceMotion, _setReduceMotion] = useState<boolean>(() => {
    const stored = localStorage.getItem("tradeops_reduce_motion");
    return stored !== null ? stored === "true" : systemReduceMotion();
  });
  const [showRRCalculator, _setShowRRCalculator] = useState<boolean>(() =>
    read("tradeops_show_rr_calculator", true),
  );
  const [theme, _setTheme] = useState<ThemePref>(() =>
    read<ThemePref>("tradeops_theme", "amoled"),
  );

  // Apply font scale to :root
  useEffect(() => {
    const scale = { small: "0.9", default: "1", large: "1.1" }[fontSize];
    document.documentElement.style.setProperty("--font-scale", scale);
  }, [fontSize]);

  // Apply reduce-motion class to :root
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reduceMotion);
  }, [reduceMotion]);

  // Apply theme class to :root
  useEffect(() => {
    document.documentElement.classList.remove("theme-amoled", "theme-dim");
    if (theme === "amoled") document.documentElement.classList.add("theme-amoled");
    if (theme === "dim") document.documentElement.classList.add("theme-dim");
  }, [theme]);

  function setDefaultLanding(v: LandingPage) {
    write("tradeops_default_landing", v);
    _setDefaultLanding(v);
  }
  function setDefaultStatDisplay(v: StatDisplay) {
    write("tradeops_default_stat_display", v);
    _setDefaultStatDisplay(v);
  }
  function setFontSize(v: FontSizePref) {
    write("tradeops_font_size", v);
    _setFontSize(v);
  }
  function setReduceMotion(v: boolean) {
    write("tradeops_reduce_motion", String(v));
    _setReduceMotion(v);
  }
  function setShowRRCalculator(v: boolean) {
    write("tradeops_show_rr_calculator", v);
    _setShowRRCalculator(v);
  }
  function setTheme(v: ThemePref) {
    write("tradeops_theme", v);
    _setTheme(v);
  }

  return (
    <Ctx.Provider value={{
      defaultLanding, defaultStatDisplay, fontSize, reduceMotion, showRRCalculator, theme,
      setDefaultLanding, setDefaultStatDisplay, setFontSize, setReduceMotion, setShowRRCalculator, setTheme,
    }}>
      {children}
    </Ctx.Provider>
  );
}

// — Hook —————————————————————————————————————

export function useDisplayPrefs(): DisplayPrefs {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDisplayPrefs must be used within DisplayPrefsProvider");
  return ctx;
}
