import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, AlertCircle, Lock, ShieldCheck, Activity } from "lucide-react";
import { login } from "@/lib/auth-api";
import { AUTH_QUERY_KEY } from "@/hooks/use-auth";
import { APP_SETTINGS_QUERY_KEY, getAppSettings } from "@/lib/app-settings-api";
import { useDisplayPrefs } from "@/hooks/use-display-prefs";

const SETUP_TYPES = [
  "MSS + Retest", "Breakout", "Pullback", "Reversal", "Range Play",
  "FVG", "S/R Flip + Sweep", "Continuation", "S/R Flip",
];

const PILLARS = [
  {
    title: "Nothing gets rewritten",
    body: "Archive a week and it's locked — for good. No edits, no deletes, not even from the admin account. What happened stays what happened.",
    icon: Lock,
  },
  {
    title: "No spin, ever",
    body: "No mistake tags. No partial-exit stories. Just the setup, the trade, and the result — exactly as it went down.",
    icon: ShieldCheck,
  },
  {
    title: "Finds where you slip",
    body: "Losing streaks, setups that quietly bleed you, drawdowns you didn't notice — calculated the moment you log a trade, no spreadsheet math required.",
    icon: Activity,
  },
] as const;

const FALLBACK_DESCRIPTION =
  "TradeOps is a private trading journal built on one rule: log the real trade, not the story about it. No phantom entries, no outcome bias.";

const WIN = "#10B981";
const LOSS = "#EF4444";
const AMETHYST = "#A855F7";
const CYAN = "#06B6D4";

// ── Brand mark ──────────────────────────────────────────────────────────────

function Sparkmark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M2,17 C6,15 7,19 10,15 C13,10 14,14 17,10 C19,7 20,9 22,5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="22" cy="5" r="2" fill="currentColor" />
    </svg>
  );
}

// ── Background candlestick field (decorative only) ─────────────────────────

function CandleField({ reduceMotion }: { reduceMotion: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const NS = "http://www.w3.org/2000/svg";
    const W = 1400, H = 900;
    const n = 60, spacing = W / n, bodyW = spacing * 0.5;
    let price = 34;
    const toY = (v: number) => H - 80 - (v / 100) * (H - 200);

    for (let i = 1; i < 6; i++) {
      const y = (H / 6) * i;
      const line = document.createElementNS(NS, "line");
      line.setAttribute("x1", "0"); line.setAttribute("x2", String(W));
      line.setAttribute("y1", String(y)); line.setAttribute("y2", String(y));
      line.setAttribute("stroke", "rgba(255,255,255,0.04)");
      svg.appendChild(line);
    }

    for (let i = 0; i < n; i++) {
      let bias = 0.62;
      if (i > n * 0.4 && i < n * 0.6) bias = 0.36;
      const open = price;
      const drift = (Math.random() < bias ? 1 : -1) * (Math.random() * 7 + 1.5);
      const close = Math.max(6, Math.min(94, open + drift));
      const high = Math.max(open, close) + Math.random() * 3.5;
      const low = Math.min(open, close) - Math.random() * 3.5;
      const x = i * spacing + spacing / 2;
      const color = close >= open ? WIN : LOSS;

      const wick = document.createElementNS(NS, "line");
      wick.setAttribute("x1", String(x)); wick.setAttribute("x2", String(x));
      wick.setAttribute("y1", String(toY(high))); wick.setAttribute("y2", String(toY(low)));
      wick.setAttribute("stroke", color);
      wick.setAttribute("stroke-width", "1.5");
      wick.setAttribute("opacity", "0.5");
      svg.appendChild(wick);

      const body = document.createElementNS(NS, "rect");
      const yTop = toY(Math.max(open, close));
      const bodyH = Math.max(2, Math.abs(toY(open) - toY(close)));
      body.setAttribute("x", String(x - bodyW / 2));
      body.setAttribute("y", String(yTop));
      body.setAttribute("width", String(bodyW));
      body.setAttribute("height", String(bodyH));
      body.setAttribute("rx", "1.5");
      body.setAttribute("fill", color);
      body.setAttribute("opacity", "0.6");
      svg.appendChild(body);

      price = close;
    }
  }, []);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 1400 900"
      preserveAspectRatio="none"
      className={[
        "absolute inset-0 w-full h-full opacity-[0.28] pointer-events-none",
        reduceMotion ? "" : "",
      ].join(" ")}
      aria-hidden
    />
  );
}

// ── Dashboard mockup carousel ───────────────────────────────────────────────

function MockupCarousel({ reduceMotion }: { reduceMotion: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [tiltRevealed, setTiltRevealed] = useState(false);
  const titles = ["This Week", "Archived", "Post-Loss"];

  useEffect(() => {
    if (active === 2) setTiltRevealed(true);
  }, [active]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let debounce: ReturnType<typeof setTimeout>;
    const settle = () => setActive(Math.round(el.scrollLeft / el.clientWidth));
    const supportsScrollEnd = "onscrollend" in window;
    const handler = supportsScrollEnd
      ? settle
      : () => { clearTimeout(debounce); debounce = setTimeout(settle, 150); };
    el.addEventListener(supportsScrollEnd ? "scrollend" : "scroll", handler);
    return () => el.removeEventListener(supportsScrollEnd ? "scrollend" : "scroll", handler);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const hoverCapable = window.matchMedia("(hover: hover)").matches;
    if (!hoverCapable) return;
    const wrap = panelRef.current?.parentElement;
    const panel = panelRef.current;
    if (!wrap || !panel) return;

    function onMove(e: MouseEvent) {
      const r = panel!.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) / r.width;
      const y = (e.clientY - r.top - r.height / 2) / r.height;
      panel!.style.transform = `perspective(1000px) rotateY(${x * 7}deg) rotateX(${-y * 7}deg)`;
    }
    function onLeave() {
      panel!.style.transform = "perspective(1000px) rotateY(0deg) rotateX(0deg)";
    }
    wrap.addEventListener("mousemove", onMove as EventListener);
    wrap.addEventListener("mouseleave", onLeave);
    return () => {
      wrap.removeEventListener("mousemove", onMove as EventListener);
      wrap.removeEventListener("mouseleave", onLeave);
    };
  }, [reduceMotion]);

  function goTo(i: number) {
    scrollRef.current?.scrollTo({
      left: i * (scrollRef.current?.clientWidth ?? 0),
      behavior: reduceMotion ? "auto" : "smooth",
    });
    setActive(i);
  }

  return (
    <div
      ref={panelRef}
      className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-2xl overflow-hidden transition-transform duration-150 ease-out"
      style={{ transformStyle: "preserve-3d", willChange: "transform" }}
    >
      <div className="h-1 bg-primary" />
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground/60">
            {titles[active]}
          </span>
          <div className="flex items-center gap-1.5">
            {titles.map((t, i) => (
              <button
                key={t}
                type="button"
                aria-label={`Show ${t}`}
                onClick={() => goTo(i)}
                className={[
                  "h-2 rounded-full transition-all",
                  i === active ? "w-4 bg-primary" : "w-2 bg-white/15",
                ].join(" ")}
              />
            ))}
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex overflow-x-auto no-scrollbar"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {/* Slide 1 — This Week */}
          <div className="w-full shrink-0" style={{ scrollSnapAlign: "start", scrollSnapStop: "always" }}>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
                <div className="font-mono text-lg font-bold" style={{ color: WIN }}>62%</div>
                <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground/50">Win Rate</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
                <div className="font-mono text-lg font-bold text-primary">+14.2R</div>
                <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground/50">Net R</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5">
                <div className="font-mono text-lg font-bold text-foreground">7</div>
                <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground/50">Trades</div>
              </div>
            </div>
            <svg viewBox="0 0 400 90" preserveAspectRatio="none" className="w-full h-16 mb-4">
              <path
                d="M5,70 C40,60 55,75 85,58 C120,38 140,55 175,40 C215,22 235,48 270,30 C310,10 335,25 395,8"
                stroke="currentColor" className="text-primary" strokeWidth="2.5" fill="none" strokeLinecap="round"
              />
            </svg>
            {[
              { dir: "LONG", setup: "MSS + Retest", r: "+2.4R", pos: true, dot: WIN },
              { dir: "SHORT", setup: "Breakout", r: "\u22121.0R", pos: false, dot: LOSS },
              { dir: "LONG", setup: "Pullback", r: "+4.1R", pos: true, dot: CYAN },
            ].map((row) => (
              <div key={row.setup} className="flex items-center gap-2.5 py-2 border-b border-white/[0.06] last:border-0">
                <span
                  className={[
                    "font-mono text-[10px] font-bold px-1.5 py-0.5 rounded",
                    row.dir === "LONG" ? "bg-primary/15 text-primary" : "bg-amber-500/15 text-amber-500",
                  ].join(" ")}
                >
                  {row.dir}
                </span>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: row.dot }} />
                <span className="flex-1 text-sm text-muted-foreground">{row.setup}</span>
                <span className="font-mono text-sm font-semibold" style={{ color: row.pos ? WIN : LOSS }}>{row.r}</span>
              </div>
            ))}
            <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-wide text-muted-foreground/40">
              Preview — illustrative data
            </p>
          </div>

          {/* Slide 2 — Archived */}
          <div className="w-full shrink-0" style={{ scrollSnapAlign: "start", scrollSnapStop: "always" }}>
            <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground/50 mb-3">
              Locked forever once archived:
            </p>
            {[
              { week: "Week 31 — Jul 27–Aug 2", r: "+6.8R", pos: true, dot: WIN },
              { week: "Week 30 — Jul 20–26", r: "\u22122.1R", pos: false, dot: LOSS },
              { week: "Week 29 — Jul 13–19", r: "+9.4R", pos: true, dot: AMETHYST },
              { week: "Week 28 — Jul 6–12", r: "+3.5R", pos: true, dot: WIN },
            ].map((row) => (
              <div key={row.week} className="flex items-center gap-2.5 py-2 border-b border-white/[0.06] last:border-0">
                <Lock className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                <span className="flex-1 text-sm text-muted-foreground">{row.week}</span>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: row.dot }} />
                <span className="font-mono text-sm font-semibold" style={{ color: row.pos ? WIN : LOSS }}>{row.r}</span>
              </div>
            ))}
            <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-wide text-muted-foreground/40">
              Once archived, nothing can be edited — not even by an admin.
            </p>
          </div>

          {/* Slide 3 — Post-Loss */}
          <div className="w-full shrink-0" style={{ scrollSnapAlign: "start", scrollSnapStop: "always" }}>
            <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground/50 mb-4">
              Win rate after a losing streak:
            </p>
            {[
              { label: "After 1 loss", pct: 58, color: "#84CC16" },
              { label: "After 2 losses", pct: 71, color: AMETHYST },
              { label: "After 3+ losses", pct: 39, color: "#F97316" },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-3 mb-4">
                <span className="w-24 shrink-0 text-xs text-muted-foreground">{row.label}</span>
                <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-700 ease-out"
                    style={{ width: tiltRevealed ? `${row.pct}%` : "0%", background: row.color }}
                  />
                </div>
                <span className="w-9 shrink-0 text-right font-mono text-sm font-bold">{row.pct}%</span>
              </div>
            ))}
            <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-wide text-muted-foreground/40">
              Calculated automatically the moment you log a trade, no spreadsheet math required.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Ticker strip ─────────────────────────────────────────────────────────────

function TickerStrip() {
  const items = [...SETUP_TYPES, ...SETUP_TYPES];
  return (
    <div className="border-y border-white/10 bg-white/[0.02] overflow-hidden py-4" aria-hidden>
      <div className="flex gap-4 w-max animate-[ticker-scroll_32s_linear_infinite] motion-reduce:animate-none">
        {items.map((t, i) => (
          <span key={i} className="flex items-center gap-4 shrink-0">
            <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground/50 whitespace-nowrap">{t}</span>
            <span className="text-muted-foreground/30">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export function LoginPage() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const prefs = useDisplayPrefs();

  const [systemReduceMotion, setSystemReduceMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setSystemReduceMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setSystemReduceMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  const reduceMotion = prefs.reduceMotion || systemReduceMotion;

  const aboutQuery = useQuery({
    queryKey: APP_SETTINGS_QUERY_KEY,
    queryFn: getAppSettings,
  });
  const description = aboutQuery.data?.description || FALLBACK_DESCRIPTION;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;

    setError(null);
    setIsPending(true);

    try {
      const me = await login(code);
      queryClient.setQueryData(AUTH_QUERY_KEY, { userId: me.userId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid access code.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground font-sans">
      <style>{`
        @keyframes ticker-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { scrollbar-width: none; }
      `}</style>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden pb-10">
        <CandleField reduceMotion={reduceMotion} />

        <div className="relative z-10 flex items-center gap-2 px-6 sm:px-10 pt-7 pb-2">
          <Sparkmark className="w-5 h-5 text-primary" />
          <span className="font-mono text-xs tracking-[0.24em] text-muted-foreground/70">TRADEOPS</span>
        </div>

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-16 items-start px-6 sm:px-10 pt-8 max-w-6xl mx-auto">
          {/* Left column */}
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse motion-reduce:animate-none" />
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">Private Access</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05] mb-5">
              Track what actually<br />
              <span className="text-primary">happened.</span>
            </h1>

            <p className="text-base text-muted-foreground max-w-md mb-6">
              {description}
            </p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-6 font-mono text-[11px] uppercase tracking-wide text-muted-foreground/50">
              <span>Real MT5 fills only</span>
              <span className="text-muted-foreground/25">·</span>
              <span>Immutable once archived</span>
              <span className="text-muted-foreground/25">·</span>
              <span>Invite-only access</span>
            </div>

            <form onSubmit={handleSubmit} className="flex items-stretch gap-2.5 max-w-md">
              <div className="relative min-w-0 flex-1">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40 pointer-events-none" />
                <input
                  type="text"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="Enter access code"
                  value={code}
                  onChange={(e) => { setCode(e.target.value); if (error) setError(null); }}
                  disabled={isPending}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.03] pl-10 pr-4 py-2.5 text-sm font-mono tracking-widest uppercase placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition disabled:opacity-50"
                />
              </div>
              <button
                type="submit"
                disabled={isPending || !code.trim()}
                className="shrink-0 flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enter →"}
              </button>
            </form>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 mt-3 max-w-md text-sm text-destructive">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <p className="text-xs text-muted-foreground/50 mt-3">
              Codes are issued by an admin. No self-signup.
            </p>
          </div>

          {/* Right column */}
          <div className="min-w-0">
            <MockupCarousel reduceMotion={reduceMotion} />
          </div>
        </div>
      </div>

      <TickerStrip />

      {/* ── Pillars ─────────────────────────────────────────────────────── */}
      <div className="bg-white/[0.02] px-6 sm:px-10 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 max-w-6xl mx-auto">
          {PILLARS.map((p) => (
            <div key={p.title}>
              <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center mb-4">
                <p.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{p.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="border-t border-white/10 px-6 sm:px-10 py-6 flex items-center justify-between flex-wrap gap-2">
        <span className="font-mono text-xs tracking-[0.2em] text-muted-foreground/40">TRADEOPS</span>
        <span className="font-mono text-[11px] tracking-wide text-muted-foreground/40 uppercase">
          Private · Invite-only · No self-signup
        </span>
      </div>
    </div>
  );
}
