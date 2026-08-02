// Self-verifying find-and-replace script — run from repo root in Replit Shell:
//   node fix-table-clip-v5.mjs
//
// Root cause finally isolated: since v2 the table has used AUTO layout, which
// lets browsers stretch the whole table wider than its container when content
// demands it — that's what was escaping past the screen edge, not a header
// wrapping issue. Percentage max-width on a <td> doesn't reliably constrain
// anything in auto layout.
//
// Fix: use table-layout: fixed with small FIXED PIXEL widths for the three
// numeric columns (their content is bounded and doesn't change with screen
// size — "41", "100%", "+102.62R" are always about the same width). The Setup
// name column gets no explicit width, so under fixed layout it automatically
// absorbs whatever space is left — a small amount on narrow phones (truncates
// gracefully), a large amount on desktop (shows the full name), and the table
// itself can never exceed its container because fixed layout doesn't let
// content stretch it.

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
  "switch to table-fixed with pixel-width colgroup for numeric columns",
  `          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>`,
  `          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col />
                <col style={{ width: "64px" }} />
                <col style={{ width: "74px" }} />
                <col style={{ width: "96px" }} />
              </colgroup>
              <thead>`
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
