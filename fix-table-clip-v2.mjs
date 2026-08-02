// Self-verifying find-and-replace script — run from repo root in Replit Shell:
//   node fix-table-clip-v2.mjs
//
// The previous fix (max-w-0 w-full) over-corrected: it squeezed the setup name
// down to almost nothing ("M..", "U...") because the numeric columns were
// claiming more room than they need. This gives the name column a genuine,
// percentage-based cap (scales correctly on mobile AND desktop, unlike a fixed
// rem/px value) while keeping the numeric columns tight and non-wrapping so
// they never get clipped either.

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

// ── Edit 1: give the name cell a percentage-based cap, and make numeric ─────
// ── header + cells nowrap/tight so they don't demand more room than needed ──
applyEdit(
  "responsive percentage cap on name column, tighten numeric columns",
  `                <tr className="border-b border-white/10 bg-white/[0.04]">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Setup</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Trades</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Win Rate</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Net RR</th>
                </tr>
              </thead>
              <tbody>
                {data.bySetupType.map((row, i) => (
                  <tr
                    key={row.setupTypeId ?? "untagged"}
                    className={\`hover:bg-white/[0.03] cursor-pointer transition-colors \${i < data.bySetupType.length - 1 ? "border-b border-white/5" : ""}\`}
                    onClick={() => setSelectedSetupRow(row)}
                  >
                    <td className="px-4 py-3 max-w-0 w-full">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="flex-shrink-0 w-2.5 h-2.5 rounded-full ring-1 ring-white/20"
                          style={{ backgroundColor: row.color ?? "rgba(255,255,255,0.2)" }}
                        />
                        <span className="text-white font-semibold truncate block">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{row.totalTrades}</td>
                    <td className="px-4 py-3 text-right font-semibold" style={{ color: row.winRate >= 50 ? "#34d399" : "#fb7185" }}>{row.winRate}%</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: rrColor(row.netRR) }}>{fmtRR(row.netRR)}</td>`,
  `                <tr className="border-b border-white/10 bg-white/[0.04]">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Setup</th>
                  <th className="text-right px-2 py-3 text-muted-foreground font-medium whitespace-nowrap">Trades</th>
                  <th className="text-right px-2 py-3 text-muted-foreground font-medium whitespace-nowrap">Win Rate</th>
                  <th className="text-right px-3 py-3 text-muted-foreground font-medium whitespace-nowrap">Net RR</th>
                </tr>
              </thead>
              <tbody>
                {data.bySetupType.map((row, i) => (
                  <tr
                    key={row.setupTypeId ?? "untagged"}
                    className={\`hover:bg-white/[0.03] cursor-pointer transition-colors \${i < data.bySetupType.length - 1 ? "border-b border-white/5" : ""}\`}
                    onClick={() => setSelectedSetupRow(row)}
                  >
                    <td className="px-4 py-3 max-w-[55%]">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="flex-shrink-0 w-2.5 h-2.5 rounded-full ring-1 ring-white/20"
                          style={{ backgroundColor: row.color ?? "rgba(255,255,255,0.2)" }}
                        />
                        <span className="text-white font-semibold truncate block">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-right text-muted-foreground whitespace-nowrap">{row.totalTrades}</td>
                    <td className="px-2 py-3 text-right font-semibold whitespace-nowrap" style={{ color: row.winRate >= 50 ? "#34d399" : "#fb7185" }}>{row.winRate}%</td>
                    <td className="px-3 py-3 text-right font-mono font-semibold whitespace-nowrap" style={{ color: rrColor(row.netRR) }}>{fmtRR(row.netRR)}</td>`
);

if (failed > 0) {
  console.log(`\n${failed} edit(s) skipped, ${changed} edit(s) matched. File NOT written because not all edits succeeded.`);
  console.log("Send Claude this output plus the current file section so it can adjust the script.");
  process.exit(1);
}

writeFileSync(FILE, src, "utf8");
console.log(`\nAll ${changed} edits applied and written to ${FILE}.`);
