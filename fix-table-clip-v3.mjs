// Self-verifying find-and-replace script — run from repo root in Replit Shell:
//   node fix-table-clip-v3.mjs
//
// v2 gave the name column 55% width, which let long names show in full but
// pushed Trades/Win Rate/Net RR off the edge of narrow phone screens instead.
// This shrinks the name column's cap so the three numeric columns always have
// guaranteed room and never clip — the name truncates first when space is
// tight, exactly the priority requested.

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
  "shrink name column cap so numeric columns always have room",
  `                    <td className="px-4 py-3 max-w-[55%]">`,
  `                    <td className="px-4 py-3 max-w-[36%]">`
);

applyEdit(
  "tighten trades column padding further",
  `                    <td className="px-2 py-3 text-right text-muted-foreground whitespace-nowrap">{row.totalTrades}</td>`,
  `                    <td className="px-1.5 py-3 text-right text-muted-foreground whitespace-nowrap">{row.totalTrades}</td>`
);

applyEdit(
  "tighten win rate column padding further",
  `                    <td className="px-2 py-3 text-right font-semibold whitespace-nowrap" style={{ color: row.winRate >= 50 ? "#34d399" : "#fb7185" }}>{row.winRate}%</td>`,
  `                    <td className="px-1.5 py-3 text-right font-semibold whitespace-nowrap" style={{ color: row.winRate >= 50 ? "#34d399" : "#fb7185" }}>{row.winRate}%</td>`
);

applyEdit(
  "tighten header padding to match tightened cells",
  `                  <th className="text-right px-2 py-3 text-muted-foreground font-medium whitespace-nowrap">Trades</th>
                  <th className="text-right px-2 py-3 text-muted-foreground font-medium whitespace-nowrap">Win Rate</th>`,
  `                  <th className="text-right px-1.5 py-3 text-muted-foreground font-medium whitespace-nowrap">Trades</th>
                  <th className="text-right px-1.5 py-3 text-muted-foreground font-medium whitespace-nowrap">Win Rate</th>`
);

if (failed > 0) {
  console.log(`\n${failed} edit(s) skipped, ${changed} edit(s) matched. File NOT written because not all edits succeeded.`);
  console.log("Send Claude this output plus the current file section so it can adjust the script.");
  process.exit(1);
}

writeFileSync(FILE, src, "utf8");
console.log(`\nAll ${changed} edits applied and written to ${FILE}.`);
