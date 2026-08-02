// Self-verifying find-and-replace script — run from repo root in Replit Shell:
//   node fix-tilt-crash.mjs
//
// The Analysis page went blank/"failed to fetch" right after the Tilt Report
// deploy. Likely cause: data.postLossPerformance.some(...) was called
// unconditionally — if a stale/cached API response (missing the new field,
// e.g. from a 304 conditional response predating this deploy) reaches the
// frontend, that line throws immediately and crashes the whole page render.
// This makes both the check and the map defensive with `?? []`, so the page
// can never crash even if that field is temporarily missing — it'll just
// hide the section until fresh data with the field arrives.

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
  "guard the section visibility check against missing/undefined data",
  `      {data.postLossPerformance.some((r: AnalysisPostLossRow) => r.totalTrades > 0) && (`,
  `      {(data.postLossPerformance ?? []).some((r: AnalysisPostLossRow) => r.totalTrades > 0) && (`
);

applyEdit(
  "guard the table map against missing/undefined data",
  `                {data.postLossPerformance.map((row: AnalysisPostLossRow, i: number) => (`,
  `                {(data.postLossPerformance ?? []).map((row: AnalysisPostLossRow, i: number) => (`
);

applyEdit(
  "guard the row-count reference used for the last-row border check",
  `                    className={i < data.postLossPerformance.length - 1 ? "border-b border-white/5" : ""}`,
  `                    className={i < (data.postLossPerformance ?? []).length - 1 ? "border-b border-white/5" : ""}`
);

if (failed > 0) {
  console.log(`\n${failed} edit(s) skipped, ${changed} edit(s) matched. File NOT written because not all edits succeeded.`);
  console.log("Send Claude this output plus the current file section so it can adjust the script.");
  process.exit(1);
}

writeFileSync(FILE, src, "utf8");
console.log(`\nAll ${changed} edits applied and written to ${FILE}.`);
