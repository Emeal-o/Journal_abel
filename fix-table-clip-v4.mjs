// Self-verifying find-and-replace script — run from repo root in Replit Shell:
//   node fix-table-clip-v4.mjs
//
// Root cause of the continued overflow: v2/v3 added whitespace-nowrap to the
// column HEADERS ("Win Rate", "Net RR"), forcing them onto one line each.
// That's actually wider than before, since they used to wrap onto two short
// lines (e.g. "Win" / "Rate"), which took less horizontal room. The nowrap
// protection only needs to apply to the actual VALUE cells (so a number like
// "+102.62R" never gets clipped mid-digit) — headers can wrap freely like
// they always did. This removes nowrap from the three headers only.

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
  "let Trades header wrap freely again (remove nowrap)",
  `                  <th className="text-right px-1.5 py-3 text-muted-foreground font-medium whitespace-nowrap">Trades</th>`,
  `                  <th className="text-right px-1.5 py-3 text-muted-foreground font-medium">Trades</th>`
);

applyEdit(
  "let Win Rate header wrap freely again (remove nowrap)",
  `                  <th className="text-right px-1.5 py-3 text-muted-foreground font-medium whitespace-nowrap">Win Rate</th>`,
  `                  <th className="text-right px-1.5 py-3 text-muted-foreground font-medium">Win Rate</th>`
);

applyEdit(
  "let Net RR header wrap freely again (remove nowrap)",
  `                  <th className="text-right px-3 py-3 text-muted-foreground font-medium whitespace-nowrap">Net RR</th>`,
  `                  <th className="text-right px-3 py-3 text-muted-foreground font-medium">Net RR</th>`
);

if (failed > 0) {
  console.log(`\n${failed} edit(s) skipped, ${changed} edit(s) matched. File NOT written because not all edits succeeded.`);
  console.log("Send Claude this output plus the current file section so it can adjust the script.");
  process.exit(1);
}

writeFileSync(FILE, src, "utf8");
console.log(`\nAll ${changed} edits applied and written to ${FILE}.`);
