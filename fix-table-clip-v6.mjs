// Self-verifying find-and-replace script — run from repo root in Replit Shell:
//   node fix-table-clip-v6.mjs
//
// v5's search string matched the wrapper div in TWO places in the file (both
// tables share the same "rounded-xl border ... overflow-hidden" class), so it
// safely aborted without touching anything. This uses a longer, unique anchor
// that includes the actual "Setup" header text, so it can only match the
// By Setup Type table and nowhere else.

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
  "switch to table-fixed with pixel-width colgroup (uniquely anchored to By Setup Type table)",
  `          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.04]">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Setup</th>`,
  `          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col />
                <col style={{ width: "64px" }} />
                <col style={{ width: "74px" }} />
                <col style={{ width: "96px" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.04]">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Setup</th>`
);

applyEdit(
  "remove the percentage cap on the name cell — colgroup now handles sizing",
  `                    <td className="px-4 py-3 max-w-[36%]">`,
  `                    <td className="px-4 py-3 overflow-hidden">`
);

if (failed > 0) {
  console.log(`\n${failed} edit(s) skipped, ${changed} edit(s) matched. File NOT written because not all edits succeeded.`);
  console.log("Send Claude this output plus the current file section so it can adjust the script.");
  process.exit(1);
}

writeFileSync(FILE, src, "utf8");
console.log(`\nAll ${changed} edits applied and written to ${FILE}.`);
