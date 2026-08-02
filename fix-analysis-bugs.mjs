// Self-verifying find-and-replace script.
// Run from the repo root in Replit Shell:  node fix-analysis-bugs.mjs
//
// For each edit: checks the target snippet appears EXACTLY ONCE before writing.
// If it's missing or appears more than once, that edit is skipped and reported —
// nothing is written for that edit, so partial/unexpected file state can't happen.

import { readFileSync, writeFileSync } from "fs";

const FILE = "artifacts/trading-journal/src/pages/analysis.tsx"; // adjust if your path differs

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

// ── Edit 1: BucketTradesModal — add optional `title` prop ──────────────────
applyEdit(
  "add title prop to BucketTradesModal signature",
  `function BucketTradesModal({
  bucket,
  subtitle,
  onClose,
}: {
  bucket: AnalysisRRRBucket | null;
  /** Optional subtitle shown below the modal title — used for setup type descriptions. */
  subtitle?: string | null;
  onClose: () => void;
}) {`,
  `function BucketTradesModal({
  bucket,
  subtitle,
  title,
  onClose,
}: {
  bucket: AnalysisRRRBucket | null;
  /** Optional subtitle shown below the modal title — used for setup type descriptions. */
  subtitle?: string | null;
  /** Optional title override — used to show the setup type's name instead of the RRR range label. */
  title?: string | null;
  onClose: () => void;
}) {`
);

// ── Edit 2: use the title override when computing rangeLabel ───────────────
applyEdit(
  "use title override in rangeLabel computation",
  `  const rangeLabel = bucket
    ? bucket.max != null ? \`\${bucket.min}–\${bucket.max}R\` : \`\${bucket.min}R+\`
    : "";`,
  `  const rangeLabel = bucket
    ? (title ?? (bucket.max != null ? \`\${bucket.min}–\${bucket.max}R\` : \`\${bucket.min}R+\`))
    : "";`
);

// ── Edit 3: pass title from the setup-type drill-down call site ────────────
applyEdit(
  "pass setup type name as title override",
  `        subtitle={selectedSetupRow?.description ?? null}
        onClose={() => setSelectedSetupRow(null)}
      />`,
  `        subtitle={selectedSetupRow?.description ?? null}
        title={selectedSetupRow?.name ?? null}
        onClose={() => setSelectedSetupRow(null)}
      />`
);

// ── Edit 4: constrain table column widths so long setup names don't overflow ─
applyEdit(
  "add table-fixed + colgroup to By Setup Type table",
  `          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.04]">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Setup</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Trades</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Win Rate</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Net RR</th>
                </tr>
              </thead>`,
  `          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col style={{ width: "42%" }} />
                <col style={{ width: "19%" }} />
                <col style={{ width: "19%" }} />
                <col style={{ width: "20%" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.04]">
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Setup</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Trades</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Win Rate</th>
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Net RR</th>
                </tr>
              </thead>`
);

// ── Edit 5: truncate long setup names instead of overflowing the row ───────
applyEdit(
  "truncate long setup type names in table cell",
  `                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="flex-shrink-0 w-2.5 h-2.5 rounded-full ring-1 ring-white/20"
                          style={{ backgroundColor: row.color ?? "rgba(255,255,255,0.2)" }}
                        />
                        <span className="text-white font-semibold">{row.name}</span>
                      </div>
                    </td>`,
  `                    <td className="px-4 py-3 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="flex-shrink-0 w-2.5 h-2.5 rounded-full ring-1 ring-white/20"
                          style={{ backgroundColor: row.color ?? "rgba(255,255,255,0.2)" }}
                        />
                        <span className="text-white font-semibold truncate">{row.name}</span>
                      </div>
                    </td>`
);

if (failed > 0) {
  console.log(`\n${failed} edit(s) skipped, ${changed} edit(s) matched. File NOT written because not all edits succeeded.`);
  console.log("This usually means the file has already changed since this script was written, or the path is wrong.");
  console.log("Send Claude the output above plus the current file so it can adjust the script.");
  process.exit(1);
}

writeFileSync(FILE, src, "utf8");
console.log(`\nAll ${changed} edits applied and written to ${FILE}.`);
