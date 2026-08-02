// Self-verifying find-and-replace script — run from repo root in Replit Shell:
//   node tilt-row-modal.mjs
//
// Adds:
//   1. Backend (stats.ts): individual trade list per Tilt Report bucket
//   2. Type (analysis-api.ts): trades field on AnalysisPostLossRow
//   3. Shared modal (analysis.tsx): always-visible Win/Loss/BE breakdown line
//      (benefits RRR histogram + Setup Type drill-downs too, automatically)
//   4. Tilt Report table rows: clickable (whole row), opens the same shared
//      drill-down modal, matching the Setup Type row pattern exactly.
//
// Each edit checked for exactly 1 match before writing anything.

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

// ── 1. Backend: stats.ts — add trade list per tilt bucket ──────────────────
editFile("artifacts/api-server/src/routes/stats.ts", [
  {
    label: "add trades array to each postLossPerformance bucket",
    find: `  const postLossPerformance = [0, 1, 2, 3].map(afterLosses => {
    const trades = tiltGroups.get(afterLosses)!;
    return { afterLosses, label: TILT_LABELS[afterLosses]!, ...computeStats(trades) };
  });`,
    replace: `  const postLossPerformance = [0, 1, 2, 3].map(afterLosses => {
    const bucketTrades = tiltGroups.get(afterLosses)!;
    const stats = computeStats(bucketTrades);
    const tradeRows = bucketTrades.map(t => {
      const wk = weekById.get(t.weekId);
      return {
        id: t.id,
        result: t.result,
        rrr: t.rrr,
        pips: t.pips,
        weekId: t.weekId,
        weekLabel: wk?.label ?? null,
        weekStartDate: wk?.startDate ?? null,
      };
    });
    return { afterLosses, label: TILT_LABELS[afterLosses]!, ...stats, trades: tradeRows };
  });`,
  },
]);

// ── 2. Type: analysis-api.ts — add trades field ─────────────────────────────
editFile("artifacts/trading-journal/src/lib/analysis-api.ts", [
  {
    label: "add trades field to AnalysisPostLossRow",
    find: `export interface AnalysisPostLossRow extends AnalysisSummary {
  afterLosses: number;
  label: string;
}`,
    replace: `export interface AnalysisPostLossRow extends AnalysisSummary {
  afterLosses: number;
  label: string;
  trades: AnalysisRRRBucketTrade[];
}`,
  },
]);

// ── 3 & 4. Frontend: analysis.tsx ───────────────────────────────────────────
editFile("artifacts/trading-journal/src/pages/analysis.tsx", [
  {
    label: "extend computeBucketStats to include win/loss/BE counts",
    find: `function computeBucketStats(trades: AnalysisRRRBucketTrade[]) {
  const total = trades.length;
  const wins  = trades.filter(t => t.result === "Win").length;
  const winRate = total > 0 ? Math.round((wins / total) * 10000) / 100 : 0;
  const netRR = Math.round(
    trades.reduce((sum, t) => {
      if (t.result === "Win")  return sum + t.rrr;
      if (t.result === "Loss") return sum - 1;
      return sum;
    }, 0) * 100,
  ) / 100;
  const netPips = Math.round(trades.reduce((sum, t) => sum + t.pips, 0) * 10) / 10;
  return { winRate, netRR, netPips };
}`,
    replace: `function computeBucketStats(trades: AnalysisRRRBucketTrade[]) {
  const total = trades.length;
  const wins  = trades.filter(t => t.result === "Win").length;
  const losses = trades.filter(t => t.result === "Loss").length;
  const breakEvens = trades.filter(t => t.result === "BE").length;
  const winRate = total > 0 ? Math.round((wins / total) * 10000) / 100 : 0;
  const netRR = Math.round(
    trades.reduce((sum, t) => {
      if (t.result === "Win")  return sum + t.rrr;
      if (t.result === "Loss") return sum - 1;
      return sum;
    }, 0) * 100,
  ) / 100;
  const netPips = Math.round(trades.reduce((sum, t) => sum + t.pips, 0) * 10) / 10;
  return { winRate, netRR, netPips, wins, losses, breakEvens };
}`,
  },
  {
    label: "add always-visible Win/Loss/BE breakdown line to shared modal",
    find: `          )}
        </DialogHeader>

        {/* Collapsible summary row */}`,
    replace: `          )}
        </DialogHeader>

        {/* Always-visible Win/Loss/BE breakdown */}
        {stats && (
          <p className="flex-shrink-0 text-xs text-muted-foreground -mt-1 mb-1">
            {bucket?.count ?? 0} {(bucket?.count ?? 0) === 1 ? "trade" : "trades"} ·{" "}
            <span className="text-emerald-400 font-medium">{stats.wins} Win</span>
            {" · "}
            <span className="text-rose-400 font-medium">{stats.losses} Loss</span>
            {" · "}
            <span className="text-amber-400 font-medium">{stats.breakEvens} BE</span>
          </p>
        )}

        {/* Collapsible summary row */}`,
  },
  {
    label: "add selectedTiltRow state",
    find: `  const [selectedSetupRow, setSelectedSetupRow] = useState<AnalysisSetupTypeRow | null>(null);`,
    replace: `  const [selectedSetupRow, setSelectedSetupRow] = useState<AnalysisSetupTypeRow | null>(null);
  const [selectedTiltRow, setSelectedTiltRow] = useState<AnalysisPostLossRow | null>(null);`,
  },
  {
    label: "make Tilt Report rows clickable (whole row)",
    find: `                {(data.postLossPerformance ?? []).map((row: AnalysisPostLossRow, i: number) => (
                  <tr
                    key={row.afterLosses}
                    className={i < (data.postLossPerformance ?? []).length - 1 ? "border-b border-white/5" : ""}
                  >`,
    replace: `                {(data.postLossPerformance ?? []).map((row: AnalysisPostLossRow, i: number) => (
                  <tr
                    key={row.afterLosses}
                    className={\`transition-colors \${row.totalTrades > 0 ? "hover:bg-white/[0.03] cursor-pointer" : ""} \${i < (data.postLossPerformance ?? []).length - 1 ? "border-b border-white/5" : ""}\`}
                    onClick={row.totalTrades > 0 ? () => setSelectedTiltRow(row) : undefined}
                  >`,
  },
  {
    label: "insert Tilt Report drill-down modal instance after the section",
    find: `      {/* 8. Drawdown & Recovery */}`,
    replace: `      {/* Post-Loss Performance drill-down modal */}
      <BucketTradesModal
        bucket={
          selectedTiltRow
            ? {
                label: selectedTiltRow.label,
                min: 0,
                max: null,
                count: selectedTiltRow.totalTrades,
                trades: selectedTiltRow.trades,
              }
            : null
        }
        title={selectedTiltRow?.label ?? null}
        onClose={() => setSelectedTiltRow(null)}
      />

      {/* 8. Drawdown & Recovery */}`,
  },
]);

console.log(`\n${totalChanged} edit(s) applied across all files, ${totalFailed} skipped.`);
if (totalFailed > 0) {
  console.log("Some file(s) were NOT written. Send Claude this full output so it can adjust the script.");
  process.exit(1);
}
console.log("All edits written successfully.");
