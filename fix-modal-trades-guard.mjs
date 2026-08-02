// Self-verifying find-and-replace script — run from repo root in Replit Shell:
//   node fix-modal-trades-guard.mjs
//
// Same class of bug as before, one field deeper: if a cached/stale API
// response reaches the frontend with a bucket that's missing its `trades`
// array (e.g. right after this exact deploy, before a truly fresh fetch),
// the shared BucketTradesModal crashes reading bucket.trades.length on
// undefined. This guards it permanently — fixing all three drill-downs
// (RRR histogram, Setup Type, Tilt Report) at once, for good, regardless
// of what causes a bucket to arrive without its trades array in the future.

import { readFileSync, writeFileSync } from "fs";

const FILE = "artifacts/trading-journal/src/pages/analysis.tsx";

let src = readFileSync(FILE, "utf8");
let changed = 0;
let failed = 0;

function applyEdit(label, find, replace) {
  const count = src.split(find).length - 1;
  if (count !== 1) {
    console.log(`✗ SKIPPED [${label}] — expected 1 match, found ${count}. No change made for this edit.`);
    failed++;
    return;
  }
  src = src.replace(find, replace);
  console.log(`✓ Applied [${label}]`);
  changed++;
}

applyEdit(
  "guard bucket.trades against undefined in the shared drill-down modal",
  `          {!bucket || bucket.trades.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">No trades in this bucket.</p>
          ) : (
            <div className="space-y-2 pb-2">
              {bucket.trades.map((trade: AnalysisRRRBucketTrade) => (`,
  `          {!bucket || !bucket.trades || bucket.trades.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">No trades in this bucket.</p>
          ) : (
            <div className="space-y-2 pb-2">
              {bucket.trades.map((trade: AnalysisRRRBucketTrade) => (`
);

if (failed > 0) {
  console.log(`\n${failed} edit(s) skipped, ${changed} edit(s) matched. File NOT written because not all edits succeeded.`);
  console.log("Send Claude this output plus the current file section so it can adjust the script.");
  process.exit(1);
}

writeFileSync(FILE, src, "utf8");
console.log(`\nAll ${changed} edits applied and written to ${FILE}.`);
