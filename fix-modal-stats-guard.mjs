// Self-verifying find-and-replace script — run from repo root in Replit Shell:
//   node fix-modal-stats-guard.mjs
//
// Missed spot from the previous fix: this earlier line in the same modal
// ALSO reads bucket.trades.length directly, and runs on every render before
// the part that was already guarded — so it crashes first if trades is
// undefined, before ever reaching the earlier fix.

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
  "guard the stats computation line against missing trades array",
  `  const stats = bucket && bucket.trades.length > 0 ? computeBucketStats(bucket.trades) : null;`,
  `  const stats = bucket && bucket.trades && bucket.trades.length > 0 ? computeBucketStats(bucket.trades) : null;`
);

if (failed > 0) {
  console.log(`\n${failed} edit(s) skipped, ${changed} edit(s) matched. File NOT written because not all edits succeeded.`);
  console.log("Send Claude this output plus the current file section so it can adjust the script.");
  process.exit(1);
}

writeFileSync(FILE, src, "utf8");
console.log(`\nAll ${changed} edits applied and written to ${FILE}.`);
