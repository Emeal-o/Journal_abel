// Self-verifying find-and-replace script — run from repo root in Replit Shell:
//   node fix-table-clip.mjs
//
// Fixes residual clipping in the "By Setup Type" table using a fully responsive
// approach (no fixed rem/px width, so desktop isn't artificially constrained):
//
//   1. Revert table-fixed + colgroup back to auto layout (matches Year-by-Year).
//   2. On the Setup name <td>, use the standard CSS truncation trick for
//      auto-layout tables: `max-w-0 w-full` on the cell forces it to shrink to
//      whatever space remains after the other (short, natural-width) columns
//      claim their space — it scales correctly at any viewport width, unlike a
//      fixed max-width. `truncate` on the inner span then ellipsizes long names
//      only when there genuinely isn't room, on mobile or desktop alike.

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

// ── Edit 1: revert table-fixed + colgroup back to plain auto layout ────────
applyEdit(
  "revert to auto table layout (remove table-fixed + colgroup)",
  `          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col style={{ width: "42%" }} />
                <col style={{ width: "19%" }} />
                <col style={{ width: "19%" }} />
                <col style={{ width: "20%" }} />
              </colgroup>
              <thead>`,
  `          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>`
);

// ── Edit 2: responsive truncation — no fixed width, scales at any screen size ─
applyEdit(
  "responsive truncation on setup name cell (max-w-0 w-full trick)",
  `                    <td className="px-4 py-3 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="flex-shrink-0 w-2.5 h-2.5 rounded-full ring-1 ring-white/20"
                          style={{ backgroundColor: row.color ?? "rgba(255,255,255,0.2)" }}
                        />
                        <span className="text-white font-semibold truncate">{row.name}</span>
                      </div>
                    </td>`,
  `                    <td className="px-4 py-3 max-w-0 w-full">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="flex-shrink-0 w-2.5 h-2.5 rounded-full ring-1 ring-white/20"
                          style={{ backgroundColor: row.color ?? "rgba(255,255,255,0.2)" }}
                        />
                        <span className="text-white font-semibold truncate block">{row.name}</span>
                      </div>
                    </td>`
);

if (failed > 0) {
  console.log(`\n${failed} edit(s) skipped, ${changed} edit(s) matched. File NOT written because not all edits succeeded.`);
  console.log("Send Claude this output plus the current file section so it can adjust the script.");
  process.exit(1);
}

writeFileSync(FILE, src, "utf8");
console.log(`\nAll ${changed} edits applied and written to ${FILE}.`);
