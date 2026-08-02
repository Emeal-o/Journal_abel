// Self-verifying find-and-replace script — run from repo root in Replit Shell:
//   node add-tilt-report.mjs
//
// Adds the "Post-Loss Performance" (Tilt Report) section across 3 files:
//   1. artifacts/api-server/src/routes/stats.ts   — computation + response field
//   2. artifacts/trading-journal/src/lib/analysis-api.ts — new type
//   3. artifacts/trading-journal/src/pages/analysis.tsx  — new UI section
//
// Buckets each trade by how many consecutive LOSSES immediately preceded it,
// using trade ORDER (reusing the same orderedTrades array the existing streak
// calc uses) — not calendar dates — so backfilled trades never distort it.
// Each of the 3 edits is checked for an exact single match before writing;
// if any file has changed since this script was written, nothing is touched
// and it tells you exactly which edit failed.

import { readFileSync, writeFileSync } from "fs";

let totalChanged = 0;
let totalFailed = 0;

function editFile(file, edits) {
  let src;
  try {
    src = readFileSync(file, "utf8");
  } catch (e) {
    console.log(`✗ SKIPPED FILE [${file}] — could not read: ${e.message}`);
    totalFailed += edits.length;
    return;
  }
  let fileChanged = 0;
  let fileFailed = 0;
  for (const { label, find, replace } of edits) {
    const count = src.split(find).length - 1;
    if (count !== 1) {
      console.log(`✗ SKIPPED [${file} :: ${label}] — expected 1 match, found ${count}.`);
      fileFailed++;
      continue;
    }
    src = src.replace(find, replace);
    console.log(`✓ Applied [${file} :: ${label}]`);
    fileChanged++;
  }
  totalChanged += fileChanged;
  totalFailed += fileFailed;
  if (fileFailed === 0 && fileChanged > 0) {
    writeFileSync(file, src, "utf8");
    console.log(`  → wrote ${fileChanged} change(s) to ${file}`);
  } else if (fileFailed > 0) {
    console.log(`  → ${file} NOT written (${fileFailed} edit(s) failed in this file)`);
  }
}

// ── 1. Backend: stats.ts ────────────────────────────────────────────────────
editFile("artifacts/api-server/src/routes/stats.ts", [
  {
    label: "insert Tilt Report computation before res.json",
    find: `    .sort((a, b) => {
      if (a.setupTypeId === null && b.setupTypeId !== null) return 1;
      if (a.setupTypeId !== null && b.setupTypeId === null) return -1;
      return b.totalTrades - a.totalTrades;
    });

  res.json({
    allTime,`,
    replace: `    .sort((a, b) => {
      if (a.setupTypeId === null && b.setupTypeId !== null) return 1;
      if (a.setupTypeId !== null && b.setupTypeId === null) return -1;
      return b.totalTrades - a.totalTrades;
    });

  // 12. Post-Loss Performance ("Tilt Report") — buckets each trade by how many
  //     consecutive losses immediately preceded it, using trade ORDER (the
  //     same orderedTrades array used for the existing streak calc above) —
  //     not calendar dates — so backfilled trades never distort the bucket.
  const TILT_LABELS: Record<number, string> = {
    0: "After 0 losses (fresh)",
    1: "After 1 loss",
    2: "After 2 losses",
    3: "After 3+ losses",
  };
  const tiltGroups = new Map<number, AnalysisTrade[]>([[0, []], [1, []], [2, []], [3, []]]);
  let precedingLossStreak = 0;
  for (const t of orderedTrades) {
    const bucketKey = Math.min(precedingLossStreak, 3);
    tiltGroups.get(bucketKey)!.push(t);
    precedingLossStreak = t.result === "Loss" ? precedingLossStreak + 1 : 0;
  }
  const postLossPerformance = [0, 1, 2, 3].map(afterLosses => {
    const trades = tiltGroups.get(afterLosses)!;
    return { afterLosses, label: TILT_LABELS[afterLosses]!, ...computeStats(trades) };
  });

  res.json({
    allTime,`,
  },
  {
    label: "add postLossPerformance to response",
    find: `    rrrDistribution,
    bySetupType,
  });`,
    replace: `    rrrDistribution,
    bySetupType,
    postLossPerformance,
  });`,
  },
]);

// ── 2. Frontend types: analysis-api.ts ──────────────────────────────────────
editFile("artifacts/trading-journal/src/lib/analysis-api.ts", [
  {
    label: "add AnalysisPostLossRow interface",
    find: `export interface AnalysisData {`,
    replace: `export interface AnalysisPostLossRow extends AnalysisSummary {
  afterLosses: number;
  label: string;
}

export interface AnalysisData {`,
  },
  {
    label: "add postLossPerformance field to AnalysisData",
    find: `  rrrDistribution: AnalysisRRRBucket[];
  bySetupType: AnalysisSetupTypeRow[];
}`,
    replace: `  rrrDistribution: AnalysisRRRBucket[];
  bySetupType: AnalysisSetupTypeRow[];
  postLossPerformance: AnalysisPostLossRow[];
}`,
  },
]);

// ── 3. Frontend UI: analysis.tsx ────────────────────────────────────────────
editFile("artifacts/trading-journal/src/pages/analysis.tsx", [
  {
    label: "import Flame icon",
    find: `import { ArrowLeft, TrendingUp, TrendingDown, BarChart2, Activity, Target, Zap, X, Download, Tag } from "lucide-react";`,
    replace: `import { ArrowLeft, TrendingUp, TrendingDown, BarChart2, Activity, Target, Zap, X, Download, Tag, Flame } from "lucide-react";`,
  },
  {
    label: "import AnalysisPostLossRow type",
    find: `import type { AnalysisCumulativePoint, AnalysisRRRPoint, AnalysisRRRBucket, AnalysisRRRBucketTrade, AnalysisSetupTypeRow } from "@/lib/analysis-api";`,
    replace: `import type { AnalysisCumulativePoint, AnalysisRRRPoint, AnalysisRRRBucket, AnalysisRRRBucketTrade, AnalysisSetupTypeRow, AnalysisPostLossRow } from "@/lib/analysis-api";`,
  },
  {
    label: "insert Post-Loss Performance section after Setup Type drill-down modal",
    find: `        subtitle={selectedSetupRow?.description ?? null}
        title={selectedSetupRow?.name ?? null}
        onClose={() => setSelectedSetupRow(null)}
      />

      {/* 8. Drawdown & Recovery */}`,
    replace: `        subtitle={selectedSetupRow?.description ?? null}
        title={selectedSetupRow?.name ?? null}
        onClose={() => setSelectedSetupRow(null)}
      />

      {/* Post-Loss Performance ("Tilt Report") */}
      {data.postLossPerformance.some((r: AnalysisPostLossRow) => r.totalTrades > 0) && (
        <Section title="Post-Loss Performance" icon={Flame}>
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col />
                <col style={{ width: "64px" }} />
                <col style={{ width: "74px" }} />
                <col style={{ width: "96px" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.04]">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">After Streak</th>
                  <th className="text-right px-1.5 py-3 text-muted-foreground font-medium">Trades</th>
                  <th className="text-right px-1.5 py-3 text-muted-foreground font-medium">Win Rate</th>
                  <th className="text-right px-3 py-3 text-muted-foreground font-medium">Net RR</th>
                </tr>
              </thead>
              <tbody>
                {data.postLossPerformance.map((row: AnalysisPostLossRow, i: number) => (
                  <tr
                    key={row.afterLosses}
                    className={i < data.postLossPerformance.length - 1 ? "border-b border-white/5" : ""}
                  >
                    <td className="px-4 py-3 text-white font-semibold">{row.label}</td>
                    <td className="px-1.5 py-3 text-right text-muted-foreground whitespace-nowrap">{row.totalTrades}</td>
                    <td className="px-1.5 py-3 text-right font-semibold whitespace-nowrap" style={{ color: row.totalTrades > 0 ? (row.winRate >= 50 ? "#34d399" : "#fb7185") : "#64748b" }}>
                      {row.totalTrades > 0 ? \`\${row.winRate}%\` : "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-semibold whitespace-nowrap" style={{ color: row.totalTrades > 0 ? rrColor(row.netRR) : "#64748b" }}>
                      {row.totalTrades > 0 ? fmtRR(row.netRR) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* 8. Drawdown & Recovery */}`,
  },
]);

console.log(`\n${totalChanged} edit(s) applied across all files, ${totalFailed} skipped.`);
if (totalFailed > 0) {
  console.log("Some file(s) were NOT written. Send Claude this full output so it can adjust the script.");
  process.exit(1);
}
console.log("All edits written successfully.");
