/**
 * Seed test data for the Analysis page.
 * Uses the HTTP API (not direct DB writes) so all business logic,
 * auth, and user-scoping go through exactly the same paths as the frontend.
 *
 * Run: tsx scripts/seed-test-data.ts
 */

const BASE = "http://localhost:8080";

// ─── tiny HTTP client that forwards cookies ────────────────────────────────

const cookies: Record<string, string> = {};

function parseCookies(res: Response) {
  for (const [k, v] of res.headers.entries()) {
    if (k.toLowerCase() !== "set-cookie") continue;
    const part = v.split(";")[0]!;
    const eq = part.indexOf("=");
    cookies[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
}

function cookieHeader() {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
}

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader() ? { Cookie: cookieHeader() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  parseCookies(res);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

// ─── domain helpers ────────────────────────────────────────────────────────

type TradeInput = { result: "Win" | "Loss" | "BE"; rrr: number; pips: number; notes?: string };
type WeekDef = { label: string; startDate: string; trades: TradeInput[] };

async function createWeek(label: string, startDate: string): Promise<number> {
  const w = await api("POST", "/api/weeks", { label, startDate }) as { id: number };
  return w.id;
}

async function addTrades(weekId: number, trades: TradeInput[]) {
  for (const t of trades) {
    await api("POST", "/api/trades", { weekId, ...t });
  }
}

async function archiveMonth(monthLabel: string) {
  await api("POST", "/api/weeks/archive-current-month", { monthLabel });
}

// ─── trade helper builders ─────────────────────────────────────────────────

const W = (rrr: number, pips: number, notes?: string): TradeInput => ({ result: "Win",  rrr, pips, notes });
const L = (pips: number, notes?: string): TradeInput             => ({ result: "Loss", rrr: 1, pips, notes });
const BE = (pips: number = 2): TradeInput                        => ({ result: "BE",   rrr: 1, pips });

// ─── data definition ───────────────────────────────────────────────────────
//
// Month 1: solid start — best month overall
// Month 2: rough patch, 2-week no-win streak, worst month
// Month 3: big bounce, best week lives here
// Month 4: two back-to-back no-win weeks, worst week lives here
// Active (not archived): modest recovery in progress
//
// Weeks 4, 11, 18 are intentionally empty → tests Consistency rate

const MONTH_1: WeekDef[] = [
  {
    label: "Week 1 — Jan 06",
    startDate: "2025-01-06",
    trades: [W(1.5, 30), W(2.0, 40, "textbook setup"), L(-15), W(1.5, 28), BE()],
  },
  {
    label: "Week 2 — Jan 13",
    startDate: "2025-01-13",
    trades: [W(2.0, 38), L(-14), L(-15), L(-12)],
  },
  {
    label: "Week 3 — Jan 20",
    startDate: "2025-01-20",
    trades: [W(2.0, 40), W(2.0, 42), L(-15), W(1.8, 36), W(2.5, 50, "trend day"), BE(3)],
  },
  {
    label: "Week 4 — Jan 27",   // ← intentionally empty (no trades)
    startDate: "2025-01-27",
    trades: [],
  },
];

const MONTH_2: WeekDef[] = [
  {
    label: "Week 5 — Feb 03",
    startDate: "2025-02-03",
    trades: [W(1.0, 20), L(-15), L(-16)],
  },
  {
    label: "Week 6 — Feb 10",   // ← no-win week 1 (all losses)
    startDate: "2025-02-10",
    trades: [L(-15), L(-14), L(-15), L(-13)],
  },
  {
    label: "Week 7 — Feb 17",   // ← no-win week 2 (losses + BE only)
    startDate: "2025-02-17",
    trades: [L(-15), L(-16), L(-14), BE(1)],
  },
  {
    label: "Week 8 — Feb 24",
    startDate: "2025-02-24",
    trades: [W(1.5, 30), L(-15), W(1.5, 32), BE(2), W(2.0, 40)],
  },
];

const MONTH_3: WeekDef[] = [
  {
    label: "Week 9 — Mar 03",   // ← BEST WEEK (5 wins, big RRR)
    startDate: "2025-03-03",
    trades: [W(2.5, 50, "ran to TP"), W(3.0, 60, "news spike"), W(2.5, 48), L(-15), W(2.0, 40), BE(4), W(2.5, 52)],
  },
  {
    label: "Week 10 — Mar 10",
    startDate: "2025-03-10",
    trades: [W(1.5, 30), L(-14), L(-15)],
  },
  {
    label: "Week 11 — Mar 17",  // ← intentionally empty (no trades)
    startDate: "2025-03-17",
    trades: [],
  },
  {
    label: "Week 12 — Mar 24",
    startDate: "2025-03-24",
    trades: [W(1.5, 30), L(-15), BE(2), W(1.5, 28)],
  },
];

const MONTH_4: WeekDef[] = [
  {
    label: "Week 13 — Apr 07",  // ← no-win week 1 of drawdown
    startDate: "2025-04-07",
    trades: [L(-15), L(-14)],
  },
  {
    label: "Week 14 — Apr 14",  // ← WORST WEEK (all losses)
    startDate: "2025-04-14",
    trades: [L(-15), L(-15), L(-14), L(-16), L(-15), L(-13)],
  },
  {
    label: "Week 15 — Apr 21",
    startDate: "2025-04-21",
    trades: [W(1.5, 30), L(-15), W(1.5, 28), L(-14)],
  },
  {
    label: "Week 16 — Apr 28",
    startDate: "2025-04-28",
    trades: [W(2.0, 40), W(2.0, 38), L(-15), BE(2), W(2.5, 50)],
  },
];

const ACTIVE: WeekDef[] = [
  {
    label: "Week 17 — May 05",
    startDate: "2025-05-05",
    trades: [W(2.0, 40), W(2.5, 50, "momentum"), BE(3), W(2.0, 38)],
  },
  {
    label: "Week 18 — May 12",  // ← intentionally empty (no trades)
    startDate: "2025-05-12",
    trades: [],
  },
  {
    label: "Week 19 — May 19",
    startDate: "2025-05-19",
    trades: [W(1.5, 30), L(-15), W(2.0, 38)],
  },
];

// ─── main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔐 Logging in as KOCVMM3UJFIJ ...");
  const me = await api("POST", "/api/auth/login", { code: "KOCVMM3UJFIJ" }) as { id: number };
  console.log(`   Authenticated as user id=${me.id}`);

  // Safety check: confirm we are user 1 (the only account in this dev DB)
  if (me.id !== 1) {
    throw new Error(`Unexpected user id ${me.id} — aborting to avoid touching wrong account.`);
  }

  async function seedMonth(weeks: WeekDef[], monthLabel: string) {
    console.log(`\n📅 Seeding ${monthLabel} (${weeks.length} weeks) ...`);
    for (const wDef of weeks) {
      const weekId = await createWeek(wDef.label, wDef.startDate);
      if (wDef.trades.length > 0) {
        await addTrades(weekId, wDef.trades);
        console.log(`   ✅ ${wDef.label}: ${wDef.trades.length} trades → weekId=${weekId}`);
      } else {
        console.log(`   ⬜  ${wDef.label}: (empty week) → weekId=${weekId}`);
      }
    }
    await archiveMonth(monthLabel);
    console.log(`   📦 Archived as "${monthLabel}"`);
  }

  await seedMonth(MONTH_1, "Month 1");
  await seedMonth(MONTH_2, "Month 2");
  await seedMonth(MONTH_3, "Month 3");
  await seedMonth(MONTH_4, "Month 4");

  console.log(`\n📅 Seeding active weeks (${ACTIVE.length} weeks, not archived) ...`);
  for (const wDef of ACTIVE) {
    const weekId = await createWeek(wDef.label, wDef.startDate);
    if (wDef.trades.length > 0) {
      await addTrades(weekId, wDef.trades);
      console.log(`   ✅ ${wDef.label}: ${wDef.trades.length} trades → weekId=${weekId}`);
    } else {
      console.log(`   ⬜  ${wDef.label}: (empty week) → weekId=${weekId}`);
    }
  }

  // ─── isolation verification ──────────────────────────────────────────────
  console.log("\n🔍 Verifying data isolation ...");
  const summary = await api("GET", "/api/stats/summary") as { totalTrades: number; netRR: number };
  console.log(`   /api/stats/summary for user ${me.id}: totalTrades=${summary.totalTrades}, netRR=${summary.netRR}`);

  const analysis = await api("GET", "/api/stats/analysis") as {
    allTime: { totalTrades: number; netRR: number };
    consistency: { weeksWithTrades: number; totalWeeks: number; rate: number };
    bestWeek: { weekLabel: string; netRR: number } | null;
    worstWeek: { weekLabel: string; netRR: number } | null;
    maxDrawdown: number;
  };
  console.log(`   Analysis allTime: totalTrades=${analysis.allTime.totalTrades}, netRR=${analysis.allTime.netRR}`);
  console.log(`   Consistency: ${analysis.consistency.weeksWithTrades}/${analysis.consistency.totalWeeks} weeks (${analysis.consistency.rate}%)`);
  console.log(`   Best week: ${analysis.bestWeek?.weekLabel} (${analysis.bestWeek?.netRR}R)`);
  console.log(`   Worst week: ${analysis.worstWeek?.weekLabel} (${analysis.worstWeek?.netRR}R)`);
  console.log(`   Max drawdown: ${analysis.maxDrawdown}R`);

  console.log("\n✅ Seeding complete.");
}

main().catch(err => {
  console.error("❌", err.message);
  process.exit(1);
});
