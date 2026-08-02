// Self-verifying find-and-replace script — run from repo root in Replit Shell:
//   node fix-analysis-caching.mjs
//
// Root cause of the recurring stale-data bugs (missing postLossPerformance,
// then missing trades arrays): the /api/stats/analysis response was being
// served stale — likely a browser/edge conditional-cache (304) response from
// before recent deploys. This endpoint serves private, per-user, frequently-
// changing data and should NEVER be cached anywhere. This adds explicit
// no-cache headers directly on the response, so no browser or intermediate
// cache layer can serve a stale copy again — fixing the root cause instead
// of patching around each new symptom of it.

import { readFileSync, writeFileSync } from "fs";

const FILE = "artifacts/api-server/src/routes/stats.ts";

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
  "add no-cache headers to /api/stats/analysis response",
  `router.get("/stats/analysis", requireAuth, async (req, res) => {
  const userId = req.session.userId!;`,
  `router.get("/stats/analysis", requireAuth, async (req, res) => {
  // This endpoint serves private, per-user, frequently-changing analytics.
  // Explicitly prevent any caching layer (browser, CDN/edge) from ever
  // serving a stale copy — this data must always be freshly computed.
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("Surrogate-Control", "no-store");
  const userId = req.session.userId!;`
);

if (failed > 0) {
  console.log(`\n${failed} edit(s) skipped, ${changed} edit(s) matched. File NOT written because not all edits succeeded.`);
  console.log("Send Claude this output plus the current file section so it can adjust the script.");
  process.exit(1);
}

writeFileSync(FILE, src, "utf8");
console.log(`\nAll ${changed} edits applied and written to ${FILE}.`);
