/**
 * UX Audit Skill — Word (.docx) Report Builder
 *
 * Generates a client-facing Word document directly from a findings.csv
 * (as produced elsewhere in this skill) plus a small metadata JSON file for
 * the handful of things a CSV can't hold (narrative, roadmap phases, cover
 * page details). Styled to the Relevate Health brand system (dark
 * navy/purple, lime-green + teal accents, Inter typeface).
 *
 * Requires the `docx` skill's environment (npm `docx` package) — see
 * /mnt/skills/public/docx/SKILL.md for setup, gotchas, and the
 * verify-by-rendering-to-PDF workflow. Always render and visually check the
 * output before delivering it (see that skill's "Verify the output").
 *
 * USAGE
 *   cd scripts && npm install   (installs the pinned docx version from package.json)
 *   node docx-report-template.js [findings.csv] [audit-meta.json] [output.docx] [--strict]
 *
 *   --strict   Exit non-zero (and write nothing) if any finding has
 *              Verification = "Inferred — needs human check". Without the
 *              flag those findings only produce a warning listing their IDs.
 *
 * Defaults: ./findings.csv, ./audit-meta.json, /mnt/user-data/outputs/UX-Audit-Report.docx
 *
 * findings.csv is expected to have the columns produced by this skill's
 * Finding Documentation format: ID, Dimension, Severity, Scope,
 * Standard/Heuristic (or Reference/WCAG), Location, Observation, Impact,
 * Recommendation, At a Glance, Priority Score, plus (v1.5+) Evidence,
 * Verification, Instances, Standard (WCAG 2.1 AA | WCAG 2.2 AA (new) |
 * Best practice) and an optional WCAG SC override. The v1.5 columns are
 * optional: an older CSV without them still builds, with a warning. Column names are matched
 * case- and punctuation-insensitively, so minor header variations are fine.
 * See assets/findings.example.csv for a reference file.
 *
 * audit-meta.json holds everything the CSV doesn't: site name, client,
 * prepared-by, date, pages audited, the executive summary narrative, and
 * the roadmap phases/arc. See assets/audit-meta.example.json for a
 * reference file and field-by-field comments.
 *
 * Dimension scores, severity counts, top priorities (ranked by Priority
 * Score), and the appendix scoring table are all computed automatically
 * from the CSV using the Severity x Scope deduction table — no need to
 * hand-calculate them.
 *
 * Appendix D (WCAG 2.2 AA conformance) lists all 55 A/AA criteria. Fail
 * rows come from findings (criterion numbers in Reference, or the WCAG SC
 * column); Pass / N/A / Needs manual check come from audit-meta.json
 * `criteriaResults`; everything else is "Not tested". A Fail from a finding
 * always wins over an auditor Pass, with a warning.
 *
 * BRAND COLORS BELOW ARE PLACEHOLDERS approximated from the HTML deck
 * system — confirm against the actual brand guide before client delivery
 * and update the hex values if they're off.
 */

const fs = require("fs");
const { WCAG22_AA, BY_SC, OBSOLETE, scSortKey, extractSCs } = require("./wcag22-criteria");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, ShadingType, AlignmentType, BorderStyle, PageBreak,
  Header, Footer, PageNumber, VerticalAlign
} = require("docx");

const cliArgs = process.argv.slice(2);
const STRICT = cliArgs.includes("--strict");
const [csvArg, metaArg, outArg] = cliArgs.filter(a => !a.startsWith("--"));
const CSV_PATH = csvArg || "./findings.csv";
const META_PATH = metaArg || "./audit-meta.json";
const OUTPUT_PATH = outArg || "/mnt/user-data/outputs/UX-Audit-Report.docx";

// Canonical dimension order — matches the Audit Dimensions section of SKILL.md.
// Dimensions found in the CSV but not listed here are appended alphabetically.
const DIMENSION_ORDER = [
  "Usability Heuristics", "Accessibility", "Visual Design", "Information Architecture",
  "Content & Microcopy", "User Flows", "Mobile/Responsive", "Healthcare-Specific"
];

// ============================================================================
// CSV parsing (RFC4180-ish: quoted fields, embedded commas/quotes/newlines)
// ============================================================================

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const filtered = rows.filter(r => r.some(f => f.trim() !== ""));
  const header = filtered[0].map(h => h.trim());
  return filtered.slice(1).map(r => {
    const obj = {};
    header.forEach((h, i) => { obj[h] = (r[i] || "").trim(); });
    return obj;
  });
}

function normKey(s) { return s.toLowerCase().replace(/[^a-z0-9]/g, ""); }

function pick(rowObj, candidates) {
  const normMap = {};
  Object.keys(rowObj).forEach(k => { normMap[normKey(k)] = k; });
  for (const c of candidates) {
    const nk = normKey(c);
    if (normMap[nk] !== undefined) return rowObj[normMap[nk]];
  }
  return "";
}

// ============================================================================
// Verification values (see SKILL.md Finding Documentation)
// ============================================================================

const VERIFICATION = {
  AUTOMATED: "Automated-confirmed",
  OBSERVED: "Observed live",
  INFERRED: "Inferred \u2014 needs human check"
};

// Loose match so "automated", "Observed-live", "inferred - needs human check"
// etc. all resolve. Unrecognized non-empty values are kept as-is (and warned).
function normVerification(v) {
  const k = normKey(v);
  if (!k) return "";
  if (k.startsWith("automated")) return VERIFICATION.AUTOMATED;
  if (k.startsWith("observed")) return VERIFICATION.OBSERVED;
  if (k.startsWith("inferred")) return VERIFICATION.INFERRED;
  return v;
}

// ============================================================================
// Standard values (see SKILL.md Finding Documentation, Phase 3 / D2)
// ============================================================================

const STANDARD = {
  WCAG21: "WCAG 2.1 AA",
  WCAG22NEW: "WCAG 2.2 AA (new)",
  BEST: "Best practice"
};

// Returns the canonical Standard value, or "" if the text isn't one.
function normStandard(v) {
  const k = normKey(v || "");
  if (!k) return "";
  if (k.startsWith("wcag21")) return STANDARD.WCAG21;
  if (k.startsWith("wcag22")) return STANDARD.WCAG22NEW;
  if (k.startsWith("best")) return STANDARD.BEST;
  return "";
}

const RESULT = { PASS: "Pass", FAIL: "Fail", NOT_TESTED: "Not tested", MANUAL: "Needs manual check", NA: "N/A" };
function normResult(v) {
  const k = normKey(v || "");
  if (k === "pass" || k === "passed") return RESULT.PASS;
  if (k === "fail" || k === "failed") return RESULT.FAIL;
  if (k === "nottested" || k === "untested") return RESULT.NOT_TESTED;
  if (k.startsWith("needsmanual") || k === "manual" || k === "manualcheck") return RESULT.MANUAL;
  if (k === "na" || k === "notapplicable") return RESULT.NA;
  return null;
}

// ============================================================================
// Severity x Scope deduction table (see SKILL.md Scoring)
// ============================================================================

const SEVERITY_SCOPE_TABLE = {
  Critical: { "Site-wide": -8, "Page-level": -5, "Element-level": -3 },
  Major: { "Site-wide": -5, "Page-level": -3, "Element-level": -2 },
  Minor: { "Site-wide": -2, "Page-level": -1.5, "Element-level": -1 },
  Cosmetic: { "Site-wide": -1, "Page-level": -0.5, "Element-level": -0.5 }
};

function ratingFor(pct) {
  if (pct >= 90) return "Excellent";
  if (pct >= 75) return "Good";
  if (pct >= 60) return "Needs Improvement";
  if (pct >= 40) return "Poor";
  return "Critical";
}

function fmtNum(n) {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

// ============================================================================
// Load and normalize findings.csv
// ============================================================================

const EVIDENCE_KEYS = ["Evidence"];
const VERIFICATION_KEYS = ["Verification", "Verified", "Verification Status"];
const INSTANCES_KEYS = ["Instances", "Instance List", "Occurrences"];

function hasColumn(rows, candidates) {
  if (!rows.length) return false;
  const keys = Object.keys(rows[0]).map(normKey);
  return candidates.some(c => keys.includes(normKey(c)));
}

const EVIDENCE_COLUMNS_PRESENT = {};
const STANDARD_KEYS = ["Standard", "Conformance", "Conformance Standard"];
const REFERENCE_KEYS = ["Standard/Heuristic", "Heuristic", "Reference", "WCAG"];
const SC_KEYS = ["WCAG SC", "SC", "Success Criterion", "Success Criteria"];
const REACH_KEYS = ["UserReach", "User Reach", "Reach"];
const IMPACT_KEYS = ["BusinessImpact", "Business Impact", "Impact Score"];
const EASE_KEYS = ["EaseOfFix", "Ease of Fix", "Ease"];

function loadFindings(csvPath) {
  const raw = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCSV(raw);

  // v1.5 evidence columns are optional for back-compat: warn, never fail.
  [["Evidence", EVIDENCE_KEYS], ["Verification", VERIFICATION_KEYS], ["Instances", INSTANCES_KEYS]]
    .forEach(([name, keys]) => { EVIDENCE_COLUMNS_PRESENT[name] = hasColumn(rows, keys); });
  const missingCols = Object.keys(EVIDENCE_COLUMNS_PRESENT).filter(n => !EVIDENCE_COLUMNS_PRESENT[n]);
  if (missingCols.length) {
    console.warn(`Warning: ${csvPath} has no ${missingCols.join("/")} column(s) (pre-v1.5 format). The doc will build, but findings won't show what they're based on or how they were confirmed.`);
  }

  const standardColumn = hasColumn(rows, STANDARD_KEYS);

  const findings = rows.map(r => {
    const severity = pick(r, ["Severity"]);
    const scope = pick(r, ["Scope"]);
    // "Standard" used to be accepted as the Reference column. Tell them apart
    // by value: a conformance label is a Standard, anything else is a Reference.
    const standardRaw = pick(r, STANDARD_KEYS);
    const standard = normStandard(standardRaw);
    let reference = pick(r, REFERENCE_KEYS);
    let standardUnrecognized = "";
    if (standardRaw && !standard) {
      if (!reference) reference = standardRaw; else standardUnrecognized = standardRaw;
    }
    const scOverride = pick(r, SC_KEYS);
    return {
      _standardColumn: standardColumn,
      _standardUnrecognized: standardUnrecognized,
      standard,
      scs: extractSCs(scOverride || reference),
      _scFromOverride: !!scOverride,
      id: pick(r, ["ID"]),
      dimension: pick(r, ["Dimension"]),
      severity,
      scope,
      reference,
      location: pick(r, ["Location"]),
      observation: pick(r, ["Observation"]),
      impact: pick(r, ["Impact"]),
      recommendation: pick(r, ["Recommendation"]),
      glance: pick(r, ["At a Glance", "At-a-Glance", "AtAGlance"]),
      _priorityColumn: pick(r, ["Priority Score", "Priority"]),
      _reach: pick(r, REACH_KEYS),
      _impact: pick(r, IMPACT_KEYS),
      _ease: pick(r, EASE_KEYS),
      priorityScore: 0,
      priorityInputs: null,
      evidence: pick(r, EVIDENCE_KEYS),
      verification: normVerification(pick(r, VERIFICATION_KEYS)),
      instances: pick(r, INSTANCES_KEYS)
    };
  });

  checkStandards(findings, standardColumn, csvPath);
  resolvePriorities(findings, rows, csvPath);
  return findings;
}

// ============================================================================
// Priority Score (see SKILL.md Scoring)
//   priority = severity×3 + userReach×2 + businessImpact×2 + easeOfFix×1
//   severity: Critical=4, Major=3, Minor=2, Cosmetic=1; other inputs 1-5
//   (easeOfFix 5 = easiest). Computed when all three inputs are present and
//   valid; otherwise falls back to the CSV's Priority Score column.
// ============================================================================

const SEVERITY_WEIGHT = { Critical: 4, Major: 3, Minor: 2, Cosmetic: 1 };

function computePriority(severity, reach, impact, ease) {
  return SEVERITY_WEIGHT[severity] * 3 + reach * 2 + impact * 2 + ease * 1;
}

function resolvePriorities(findings, rows, csvPath) {
  const hasInputs = hasColumn(rows, REACH_KEYS) || hasColumn(rows, IMPACT_KEYS) || hasColumn(rows, EASE_KEYS);
  if (!hasInputs) {
    console.warn(`Warning: ${csvPath} has no UserReach/BusinessImpact/EaseOfFix columns (pre-v1.5.3 format). Using the Priority Score column as given; it can't be checked.`);
  }
  const fellBack = [], missing = [];
  findings.forEach(f => {
    const given = f._priorityColumn === "" ? null : parseFloat(f._priorityColumn);
    const raw = [f._reach, f._impact, f._ease];
    const anyInput = raw.some(v => v !== "");
    const nums = raw.map(v => Number(v));
    const valid = raw.every(v => v !== "") && nums.every(n => Number.isInteger(n) && n >= 1 && n <= 5) && SEVERITY_WEIGHT[f.severity];

    if (valid) {
      const [reach, impact, ease] = nums;
      f.priorityScore = computePriority(f.severity, reach, impact, ease);
      f.priorityInputs = { severity: SEVERITY_WEIGHT[f.severity], reach, impact, ease };
      if (given !== null && !Number.isNaN(given) && given !== f.priorityScore) {
        console.warn(`Warning: ${f.id}: Priority Score column says ${f._priorityColumn} but the inputs compute ${f.priorityScore} (${f.severity}=${SEVERITY_WEIGHT[f.severity]}×3 + reach ${reach}×2 + impact ${impact}×2 + ease ${ease}) — using ${f.priorityScore}.`);
      }
      return;
    }
    if (anyInput) {
      const why = !SEVERITY_WEIGHT[f.severity]
        ? `Severity "${f.severity}" isn't Critical/Major/Minor/Cosmetic`
        : `UserReach/BusinessImpact/EaseOfFix must all be whole numbers 1-5 (got ${raw.map(v => v === "" ? "blank" : v).join("/")})`;
      console.warn(`Warning: ${f.id}: ${why} — falling back to the Priority Score column.`);
    }
    if (given !== null && !Number.isNaN(given)) {
      f.priorityScore = given;
      if (hasInputs) fellBack.push(f.id);
    } else {
      missing.push(f.id);
    }
  });
  if (fellBack.length) console.warn(`Warning: Priority Score taken from the CSV column (no valid inputs) for ${fellBack.join(", ")}.`);
  if (missing.length) console.warn(`Warning: no priority for ${missing.join(", ")} — treated as 0 and ranked last in Top Priorities.`);
}

// Validate cited criteria and the Standard label; fill a blank Standard from
// the cited criteria. Warnings only — never fails the build.
function checkStandards(findings, standardColumn, csvPath) {
  const isA11y = f => normKey(f.dimension) === "accessibility";
  if (!standardColumn && findings.some(isA11y)) {
    console.warn(`Warning: ${csvPath} has no Standard column (pre-v1.5.2 format). Accessibility findings won't say whether they fail the WCAG 2.1 AA legal baseline; it will be inferred from cited criteria where possible.`);
  }
  const derived = [];
  findings.forEach(f => {
    if (f._standardUnrecognized) {
      console.warn(`Warning: ${f.id}: Standard "${f._standardUnrecognized}" not recognized; use ${Object.values(STANDARD).join(" | ")}.`);
    }
    const unknown = f.scs.filter(sc => !BY_SC[sc]);
    unknown.forEach(sc => console.warn(`Warning: ${f.id}: ${OBSOLETE[sc] || `"${sc}" is not a WCAG 2.2 A/AA success criterion`} — not used in the conformance table.`));
    f.scs = f.scs.filter(sc => BY_SC[sc]);
    const known = f.scs.map(sc => BY_SC[sc]);
    if (!f.standard && known.length) {
      f.standard = known.some(c => !c.isNew22) ? STANDARD.WCAG21 : STANDARD.WCAG22NEW;
      derived.push(`${f.id} → ${f.standard}`);
    } else if (f.standard === STANDARD.WCAG21 && known.length && known.every(c => c.isNew22)) {
      console.warn(`Warning: ${f.id}: Standard is "${STANDARD.WCAG21}" but it only cites criteria new in WCAG 2.2 (${f.scs.join(", ")}). Use "${STANDARD.WCAG22NEW}".`);
    } else if (f.standard === STANDARD.WCAG22NEW && known.length && known.every(c => !c.isNew22)) {
      console.warn(`Warning: ${f.id}: Standard is "${STANDARD.WCAG22NEW}" but it only cites WCAG 2.1 criteria (${f.scs.join(", ")}). Use "${STANDARD.WCAG21}".`);
    }
    if (isA11y(f) && !f.standard) {
      console.warn(`Warning: ${f.id}: Accessibility finding has no Standard and cites no WCAG criterion.`);
    }
    else if (isA11y(f) && f.standard !== STANDARD.BEST && !f.scs.length) {
      console.warn(`Warning: ${f.id}: no WCAG success criterion found in Reference — it won't appear in the conformance table. Add one to Reference or the WCAG SC column.`);
    }
  });
  if (derived.length) console.log(`Note: Standard filled in from cited criteria: ${derived.join(", ")}.`);
}

// ============================================================================
// WCAG 2.2 AA conformance table (Appendix D)
//   Fail       — derived from findings (Best-practice findings excluded)
//   Pass / N/A / Needs manual check — from meta.criteriaResults
//   otherwise  — Not tested
// ============================================================================

function buildConformance(findings, meta) {
  const ids = new Set(findings.map(f => f.id));
  const failsFrom = {};
  findings.filter(f => f.standard !== STANDARD.BEST).forEach(f => {
    f.scs.forEach(sc => { (failsFrom[sc] = failsFrom[sc] || []).push(f.id); });
  });

  const entries = {};
  const raw = Array.isArray(meta.criteriaResults) ? meta.criteriaResults : [];
  if (meta.criteriaResults !== undefined && meta.criteriaResults !== null && !Array.isArray(meta.criteriaResults)) {
    console.warn("Warning: audit-meta.json criteriaResults should be an array — ignored.");
  }
  raw.forEach((e, i) => {
    const sc = String(e && e.sc || "").trim();
    if (!BY_SC[sc]) {
      console.warn(`Warning: criteriaResults[${i}]: ${OBSOLETE[sc] || `"${sc}" is not a WCAG 2.2 A/AA success criterion`} — ignored.`);
      return;
    }
    const result = normResult(e.result);
    if (!result) {
      console.warn(`Warning: criteriaResults ${sc}: result "${e.result}" not recognized; use ${Object.values(RESULT).join(" | ")} — ignored.`);
      return;
    }
    if (entries[sc]) console.warn(`Warning: criteriaResults lists ${sc} more than once — using the last entry.`);
    const listed = String(e.findings || "").split(/[,;\s]+/).filter(Boolean);
    listed.filter(id => !ids.has(id)).forEach(id => console.warn(`Warning: criteriaResults ${sc} references ${id}, which isn't in findings.csv.`));
    entries[sc] = { result, note: e.note || "", findings: listed };
  });

  if (!Object.keys(failsFrom).length && !Object.keys(entries).length) return null;

  const rows = WCAG22_AA.map(c => {
    const e = entries[c.sc];
    const fromFindings = failsFrom[c.sc] || [];
    let result = e ? e.result : RESULT.NOT_TESTED;
    if (fromFindings.length && result !== RESULT.FAIL) {
      if (e) console.warn(`Warning: ${c.sc} ${c.name}: criteriaResults says "${e.result}" but ${fromFindings.join(", ")} fail${fromFindings.length === 1 ? "s" : ""} it — reported as Fail.`);
      result = RESULT.FAIL;
    }
    const allFindings = [...new Set([...fromFindings, ...(e ? e.findings : [])])];
    if (result === RESULT.FAIL && !allFindings.length) {
      console.warn(`Warning: ${c.sc} ${c.name}: marked Fail in criteriaResults but no finding cites it. Add a finding or a note explaining the failure.`);
    }
    const notes = [allFindings.join(", "), e ? e.note : ""].filter(Boolean).join(" — ");
    return { ...c, result, notes };
  });

  const count = r => rows.filter(x => x.result === r).length;
  const failed = rows.filter(r => r.result === RESULT.FAIL);
  return {
    rows,
    counts: Object.fromEntries(Object.values(RESULT).map(r => [r, count(r)])),
    failedBaseline: failed.filter(r => !r.isNew22).length,
    failedNew22: failed.filter(r => r.isNew22).length
  };
}

// ============================================================================
// Load audit-meta.json (with sensible fallbacks if fields are missing)
// ============================================================================

function loadMeta(metaPath) {
  const defaults = {
    siteName: "example-site.com",
    preparedBy: "Relevate Health",
    date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    pagesAudited: "[Pages/flows audited]",
    sampleNote: null,
    overallNarrative: "[Add a 1-2 sentence plain-language summary of where the site stands and what matters most.]",
    roadmapArc: null,
    roadmapPhases: [],
    methodology: [
      "Nielsen Norman Group's 10 Usability Heuristics",
      "WCAG 2.2 Level AA (findings labeled where they also fail the WCAG 2.1 AA legal baseline)",
      "Healthcare UX best practices (health literacy, trust signals, regulatory UX)"
    ]
  };
  if (!fs.existsSync(metaPath)) {
    console.warn(`Warning: ${metaPath} not found — using placeholder metadata. Copy assets/audit-meta.example.json and fill it in for a real deliverable.`);
    return defaults;
  }
  const userMeta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
  return { ...defaults, ...userMeta };
}

// ============================================================================
// Derive report data (dimension scores, severity counts, priorities, scoring rows)
// ============================================================================

// Map a dimension name loosely onto the canonical spelling ("mobile responsive"
// → "Mobile/Responsive"); unknown names are kept as written.
function canonicalDimension(name) {
  const k = normKey(name || "");
  return DIMENSION_ORDER.find(d => normKey(d) === k) || String(name || "").trim();
}

// Which dimensions count toward the score. With meta.dimensionsEvaluated, every
// listed dimension is scored (50/50 if it has no findings) and the rest are
// "Not evaluated". Without it, fall back to "dimensions that have findings".
function resolveDimensions(byDim, meta) {
  const ordered = names => [
    ...DIMENSION_ORDER.filter(d => names.includes(d)),
    ...names.filter(d => !DIMENSION_ORDER.includes(d)).sort()
  ];
  if (!Array.isArray(meta.dimensionsEvaluated)) {
    if (meta.dimensionsEvaluated !== undefined && meta.dimensionsEvaluated !== null) {
      console.warn("Warning: audit-meta.json dimensionsEvaluated should be an array of dimension names — ignored.");
    }
    console.warn("Warning: audit-meta.json has no dimensionsEvaluated — scoring only the dimensions that have findings. A dimension that was evaluated and came up clean won't appear or count toward the overall score. List the dimensions you evaluated to fix this.");
    return { evaluated: ordered(Object.keys(byDim)), notEvaluated: null };
  }
  const evaluated = [...new Set(meta.dimensionsEvaluated.map(canonicalDimension).filter(Boolean))];
  evaluated.filter(d => !DIMENSION_ORDER.includes(d)).forEach(d =>
    console.warn(`Warning: dimensionsEvaluated lists "${d}", which isn't one of the 8 standard dimensions — scored as a custom dimension.`));
  Object.keys(byDim).filter(d => !evaluated.includes(d)).forEach(d => {
    console.warn(`Warning: ${byDim[d].map(f => f.id).join(", ")} ${byDim[d].length === 1 ? "is" : "are"} in "${d}", which isn't in dimensionsEvaluated — scoring it as evaluated. Add it to dimensionsEvaluated (or fix the Dimension) to silence this.`);
    evaluated.push(d);
  });
  return { evaluated: ordered(evaluated), notEvaluated: DIMENSION_ORDER.filter(d => !evaluated.includes(d)) };
}

function buildAuditData(findings, meta) {
  const byDim = {};
  findings.forEach(f => {
    f.dimension = canonicalDimension(f.dimension);
    if (!byDim[f.dimension]) byDim[f.dimension] = [];
    byDim[f.dimension].push(f);
  });

  const { evaluated: orderedDimNames, notEvaluated } = resolveDimensions(byDim, meta);

  const dimensions = orderedDimNames.map(name => {
    const dimFindings = byDim[name] || [];
    const totalDeduction = dimFindings.reduce((sum, f) => {
      const table = SEVERITY_SCOPE_TABLE[f.severity];
      const d = table && table[f.scope] !== undefined ? table[f.scope] : 0;
      if (!table || table[f.scope] === undefined) {
        console.warn(`Warning: no deduction found for ${f.id} (Severity="${f.severity}", Scope="${f.scope}") — treated as 0.`);
      }
      return sum + d;
    }, 0);
    const score = Math.max(0, 50 + totalDeduction);
    return { name, score: `${fmtNum(score)} / 50`, rating: ratingFor((score / 50) * 100), findings: dimFindings, _scoreNum: score };
  });

  const dimensionScores = [
    ...dimensions.map(d => ({ name: d.name, score: d.score, rating: d.rating })),
    ...(notEvaluated || []).map(name => ({ name, score: "\u2014", rating: "Not evaluated" }))
  ];

  const overallPct = dimensions.length
    ? (dimensions.reduce((s, d) => s + d._scoreNum, 0) / (50 * dimensions.length)) * 100
    : 0;

  const severityCounts = { Critical: 0, Major: 0, Minor: 0, Cosmetic: 0 };
  findings.forEach(f => { if (severityCounts[f.severity] !== undefined) severityCounts[f.severity]++; });

  const topPriorities = [...findings]
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 5)
    .map(f => ({ id: f.id, glance: f.glance || f.observation }));

  const scoringRows = findings.map(f => {
    const table = SEVERITY_SCOPE_TABLE[f.severity];
    const d = table && table[f.scope] !== undefined ? table[f.scope] : 0;
    const p = f.priorityInputs;
    const priority = p ? `${fmtNum(f.priorityScore)} (S${p.severity} R${p.reach} I${p.impact} E${p.ease})` : (f.priorityScore ? `${fmtNum(f.priorityScore)} (given)` : "\u2014");
    return { id: f.id, severity: f.severity, scope: f.scope, deduction: fmtNum(d), priority };
  });

  return {
    siteName: meta.siteName,
    preparedBy: meta.preparedBy,
    date: meta.date,
    pagesAudited: meta.pagesAudited,
    sampleNote: meta.sampleNote,
    overallHealthPct: `${fmtNum(overallPct)}%`,
    overallRating: ratingFor(overallPct),
    overallNarrative: meta.overallNarrative,
    dimensionScores,
    severityCounts,
    topPriorities,
    roadmapArc: meta.roadmapArc,
    roadmapPhases: meta.roadmapPhases,
    dimensions: dimensions.map(d => ({ name: d.name, score: d.score, findings: d.findings })),
    notEvaluated,
    dimensionCount: dimensions.length,
    methodology: meta.methodology,
    complianceBaseline: meta.complianceBaseline || null,
    conformance: buildConformance(findings, meta),
    scoringRows
  };
}

// ============================================================================
// BRAND PALETTE — placeholders, confirm against real brand guide
// ============================================================================

const NAVY = "14142B";
const PURPLE = "3D2C8D";
const LIME = "BEF264";
const TEAL = "2DD4BF";
const INK = "1A1A2E";
const MUTED = "5B5B72";
const LINE = "D8D8E4";
const WHITE = "FFFFFF";

// Severity uses the standard red/orange/yellow/gray convention — kept
// distinct from brand accent colors since severity meaning should read
// independently of brand styling.
const SEV_COLOR = { Critical: "C0392B", Major: "D9822B", Minor: "B7950B", Cosmetic: "7F8C8D" };
const SEV_LABEL = {
  Critical: "\u25CF CRITICAL", Major: "\u25CF MAJOR",
  Minor: "\u25CF MINOR", Cosmetic: "\u25CF COSMETIC"
};

// Display-formatted version (string values) for the appendix table — kept
// separate from the numeric SEVERITY_SCOPE_TABLE used for computation above.
const SEVERITY_SCOPE_DISPLAY = {
  Critical: { "Site-wide": "-8", "Page-level": "-5", "Element-level": "-3" },
  Major: { "Site-wide": "-5", "Page-level": "-3", "Element-level": "-2" },
  Minor: { "Site-wide": "-2", "Page-level": "-1.5", "Element-level": "-1" },
  Cosmetic: { "Site-wide": "-1", "Page-level": "-0.5", "Element-level": "-0.5" }
};

const FONT = "Inter";

// ============================================================================
// Rendering helpers
// ============================================================================

function heading(text, level) {
  return new Paragraph({
    heading: level,
    spacing: { before: 320, after: 160 },
    children: [new TextRun({ text, font: FONT, color: NAVY, bold: true })]
  });
}

function body(text) {
  return new Paragraph({
    spacing: { after: 120, line: 288 },
    children: [new TextRun({ text, font: FONT, color: INK, size: 21 })]
  });
}

function italicNote(text) {
  return new Paragraph({
    spacing: { after: 240 },
    children: [new TextRun({ text, font: FONT, color: MUTED, italics: true, size: 18 })]
  });
}

function labelValue(label, value) {
  return new Paragraph({
    spacing: { after: 80, line: 276 },
    children: [
      new TextRun({ text: `${label}: `, font: FONT, color: MUTED, bold: true, size: 20 }),
      new TextRun({ text: value, font: FONT, color: INK, size: 20 })
    ]
  });
}

// Small, muted line for supporting detail (Evidence, Verification, Instances).
function mutedLabelValue(label, value) {
  return new Paragraph({
    spacing: { after: 60, line: 252 },
    children: [
      new TextRun({ text: `${label}: `, font: FONT, color: MUTED, bold: true, size: 17 }),
      new TextRun({ text: value, font: FONT, color: MUTED, size: 17 })
    ]
  });
}

function divider() {
  return new Paragraph({
    spacing: { before: 120, after: 240 },
    border: { bottom: { color: LINE, space: 1, style: BorderStyle.SINGLE, size: 6 } },
    children: [new TextRun({ text: "" })]
  });
}

function spacer(after = 240) {
  return new Paragraph({ spacing: { after }, children: [new TextRun({ text: "" })] });
}

function atAGlance(text) {
  return new Paragraph({
    spacing: { before: 60, after: 200 },
    shading: { type: ShadingType.CLEAR, fill: "F2FBF9" },
    indent: { left: 200, right: 200 },
    border: { left: { color: TEAL, space: 8, style: BorderStyle.SINGLE, size: 24 } },
    children: [
      new TextRun({ text: "AT A GLANCE  ", font: FONT, color: TEAL, bold: true, size: 17 }),
      new TextRun({ text, font: FONT, color: INK, italics: true, size: 20 })
    ]
  });
}

function findingHeading(id, severity, scope) {
  return new Paragraph({
    spacing: { before: 280, after: 100 },
    children: [
      new TextRun({ text: id + "   ", font: FONT, color: NAVY, bold: true, size: 24 }),
      new TextRun({ text: SEV_LABEL[severity] + "   ", font: FONT, color: SEV_COLOR[severity], bold: true, size: 18 }),
      new TextRun({ text: scope.toUpperCase(), font: FONT, color: MUTED, bold: true, size: 18 })
    ]
  });
}

function simpleTable(headerRow, rows, colWidths) {
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  const mkCell = (text, isHeader, width) => new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: isHeader ? { type: ShadingType.CLEAR, fill: NAVY } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({
      children: [new TextRun({
        text: String(text), font: FONT, bold: isHeader,
        color: isHeader ? WHITE : INK, size: isHeader ? 18 : 19
      })]
    })]
  });
  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      new TableRow({ tableHeader: true, children: headerRow.map((h, i) => mkCell(h, true, colWidths[i])) }),
      ...rows.map(r => new TableRow({ children: r.map((c, i) => mkCell(c, false, colWidths[i])) }))
    ]
  });
}

const RESULT_COLOR = { Fail: "C0392B", Pass: "1E8449", "Needs manual check": "B9770E", "Not tested": MUTED, "N/A": MUTED };

function conformanceTable(rows) {
  const widths = [900, 3600, 700, 1600, 2560];
  const cell = (text, width, opts = {}) => new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: opts.header ? { type: ShadingType.CLEAR, fill: NAVY } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({
      children: [
        new TextRun({ text: String(text), font: FONT, bold: opts.header || opts.bold, color: opts.header ? WHITE : (opts.color || INK), size: opts.header ? 18 : 17 }),
        ...(opts.suffix ? [new TextRun({ text: opts.suffix, font: FONT, color: MUTED, italics: true, size: 15 })] : [])
      ]
    })]
  });
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: ["SC", "Criterion", "Level", "Result", "Findings / Notes"].map((h, i) => cell(h, widths[i], { header: true })) }),
      ...rows.map(r => new TableRow({
        cantSplit: true,
        children: [
          cell(r.sc, widths[0]),
          cell(r.name, widths[1], { suffix: r.isNew22 ? "  new in 2.2" : "" }),
          cell(r.level, widths[2]),
          cell(r.result, widths[3], { color: RESULT_COLOR[r.result], bold: r.result === "Fail" }),
          cell(r.notes, widths[4])
        ]
      }))
    ]
  });
}

function findingBlock(f) {
  return [
    findingHeading(f.id, f.severity, f.scope),
    labelValue("Reference", f.reference),
    ...(f.standard ? [labelValue("Standard", f.standard === STANDARD.WCAG21 ? `${f.standard} (legal baseline)` : f.standard)] : []),
    // v1.5 evidence fields — omitted when empty so pre-v1.5 CSVs render as before.
    ...(f.evidence ? [mutedLabelValue("Evidence", f.evidence)] : []),
    ...(f.verification ? [mutedLabelValue("Verification", f.verification)] : []),
    ...(f.instances ? [mutedLabelValue("Instances", f.instances)] : []),
    labelValue("Location", f.location),
    labelValue("Observation", f.observation),
    labelValue("Impact", f.impact),
    labelValue("Recommendation", f.recommendation),
    atAGlance(f.glance)
  ];
}

// ============================================================================
// Build document
// ============================================================================

function build(data) {
  const coverChildren = [
    new Paragraph({
      spacing: { before: 2400, after: 400 },
      children: [
        new TextRun({ text: "relevate", font: FONT, color: NAVY, bold: true, size: 32 }),
        new TextRun({ text: "health", font: FONT, color: TEAL, bold: true, size: 32 })
      ]
    }),
    new Paragraph({
      spacing: { before: 1200, after: 200 },
      children: [new TextRun({ text: "UX Audit Report", font: FONT, color: NAVY, bold: true, size: 56 })]
    }),
    new Paragraph({
      spacing: { after: 1600 },
      children: [new TextRun({ text: data.siteName, font: FONT, color: PURPLE, size: 28 })]
    }),
    labelValue("Prepared by", data.preparedBy),
    labelValue("Date", data.date),
    labelValue("Pages / Flows Audited", data.pagesAudited)
  ];
  if (data.sampleNote) coverChildren.push(spacer(0), italicNote(data.sampleNote));

  const execChildren = [
    heading("Executive Summary", HeadingLevel.HEADING_1),
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({ text: "Overall Site Health: ", font: FONT, color: INK, bold: true, size: 24 }),
        new TextRun({ text: `${data.overallHealthPct} — ${data.overallRating}`, font: FONT, color: TEAL, bold: true, size: 24 })
      ]
    }),
    body(data.overallNarrative)
  ];
  if (data.sampleNote) execChildren.push(italicNote(data.sampleNote));
  execChildren.push(
    heading("At a Glance", HeadingLevel.HEADING_2),
    simpleTable(
      ["Dimension", "Score", "Rating"],
      data.dimensionScores.map(d => [d.name, d.score, d.rating]),
      [4500, 2000, 2000]
    ),
    spacer(),
    heading("Issues by Severity", HeadingLevel.HEADING_2),
    simpleTable(
      ["Severity", "Count"],
      Object.entries(data.severityCounts).map(([k, v]) => [k, String(v)]),
      [4500, 2000]
    ),
    spacer(),
    heading("Top Priorities", HeadingLevel.HEADING_2),
    ...data.topPriorities.map((p, i) => new Paragraph({
      spacing: { after: 140 },
      children: [
        new TextRun({ text: `${i + 1}. `, font: FONT, color: NAVY, bold: true, size: 20 }),
        new TextRun({ text: `${p.id} — `, font: FONT, color: PURPLE, bold: true, size: 20 }),
        new TextRun({ text: p.glance, font: FONT, color: INK, size: 20 })
      ]
    })),
    divider(),
    heading("Roadmap at a Glance", HeadingLevel.HEADING_2)
  );
  if (data.roadmapArc) {
    execChildren.push(new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ text: data.roadmapArc, font: FONT, color: PURPLE, italics: true, bold: true, size: 22 })]
    }));
  }
  execChildren.push(simpleTable(
    ["Phase", "Focus", "Timeframe"],
    data.roadmapPhases.map(p => [p.name, p.focus, p.timeframe]),
    [2600, 5000, 1900]
  ));

  const findingsChildren = [new Paragraph({ children: [new PageBreak()] }), heading("Detailed Findings", HeadingLevel.HEADING_1)];
  data.dimensions.forEach((dim, i) => {
    findingsChildren.push(heading(`${dim.name} — Score: ${dim.score}`, HeadingLevel.HEADING_2));
    if (!dim.findings.length) findingsChildren.push(body("Evaluated \u2014 no findings in this dimension."));
    dim.findings.forEach(f => findingsChildren.push(...findingBlock(f)));
    if (i < data.dimensions.length - 1) findingsChildren.push(divider());
  });

  const scoringRows = data.scoringRows;

  const appendixChildren = [
    new Paragraph({ children: [new PageBreak()] }),
    heading("Appendix", HeadingLevel.HEADING_1),
    heading("A. Methodology", HeadingLevel.HEADING_2),
    ...data.methodology.map(t => new Paragraph({
      spacing: { after: 80 }, bullet: { level: 0 },
      children: [new TextRun({ text: t, font: FONT, color: INK, size: 20 })]
    })),
    ...(data.complianceBaseline ? [spacer(80), labelValue("Compliance baseline", data.complianceBaseline)] : []),
    heading("B. Scoring Calculations", HeadingLevel.HEADING_2),
    body("Dimension scores use the Severity \u00D7 Scope deduction table, not a flat per-severity deduction — findings with the same Severity but different Scope are weighted differently."),
    body(`Overall health averages the ${data.dimensionCount} evaluated dimension${data.dimensionCount === 1 ? "" : "s"}; an evaluated dimension with no findings scores 50 / 50.${data.notEvaluated && data.notEvaluated.length ? ` Not evaluated, and left out of the average: ${data.notEvaluated.join(", ")}.` : ""} Scores are comparable only between audits of the same scope.`),
    body("Priority = Severity\u00D73 + User reach\u00D72 + Business impact\u00D72 + Ease of fix\u00D71 (S: Critical 4 \u2026 Cosmetic 1; R, I, E rated 1\u20135, E5 = easiest)."),
    spacer(200),
    simpleTable(
      ["Finding", "Severity", "Scope", "Deduction", "Priority"],
      scoringRows.map(r => [r.id, r.severity, r.scope, r.deduction, r.priority]),
      [1500, 1500, 1800, 1300, 3260]
    ),
    spacer(280),
    heading("C. Severity \u00D7 Scope Deduction Table", HeadingLevel.HEADING_2),
    simpleTable(
      ["Severity", "Site-wide", "Page-level", "Element-level"],
      Object.entries(SEVERITY_SCOPE_DISPLAY).map(([sev, s]) => [sev, s["Site-wide"], s["Page-level"], s["Element-level"]]),
      [2500, 2100, 2100, 2100]
    )
  ];

  const conf = data.conformance;
  if (conf) {
    const c = conf.counts;
    appendixChildren.push(
      spacer(280),
      heading("D. WCAG 2.2 AA Conformance", HeadingLevel.HEADING_2),
      body(`Every WCAG 2.2 Level A and AA success criterion and its result for this audit. Fail results come from the findings in this report; Pass, N/A, and Needs manual check were recorded by the auditor; anything not assessed is shown as Not tested.${data.complianceBaseline ? ` Compliance baseline for this client: ${data.complianceBaseline}.` : ""}`),
      labelValue("Summary", `${c.Fail} Fail \u00B7 ${c.Pass} Pass \u00B7 ${c["Needs manual check"]} Needs manual check \u00B7 ${c["N/A"]} N/A \u00B7 ${c["Not tested"]} Not tested`),
      labelValue("Failed criteria", `${conf.failedBaseline} in the WCAG 2.1 AA legal baseline \u00B7 ${conf.failedNew22} new in WCAG 2.2`),
      spacer(120),
      conformanceTable(conf.rows)
    );
  }

  return new Document({
    styles: { default: { document: { run: { font: FONT, size: 21, color: INK } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 }, // US Letter
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }
        }
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: "relevate", font: FONT, color: NAVY, bold: true, size: 16 }),
              new TextRun({ text: "health", font: FONT, color: TEAL, bold: true, size: 16 })
            ]
          })]
        })
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: "UX Audit Report   ", font: FONT, color: MUTED, size: 16 }),
              new TextRun({ text: "Page ", font: FONT, color: MUTED, size: 16 }),
              new TextRun({ children: [PageNumber.CURRENT], font: FONT, color: MUTED, size: 16 })
            ]
          })]
        })
      },
      children: [
        ...coverChildren,
        new Paragraph({ children: [new PageBreak()] }),
        ...execChildren,
        ...findingsChildren,
        ...appendixChildren
      ]
    }]
  });
}

const findings = loadFindings(CSV_PATH);

// Verification gate (see SKILL.md): Inferred findings may not appear in a
// client deliverable until a human changes the value.
const KNOWN_VERIFICATION = Object.values(VERIFICATION);
// Per-row blanks are only reported when the column exists; a missing column
// was already reported once by loadFindings.
[["Evidence", "evidence"], ["Verification", "verification"]].forEach(([label, field]) => {
  if (!EVIDENCE_COLUMNS_PRESENT[label]) return;
  const blank = findings.filter(f => !f[field]).map(f => f.id);
  if (blank.length) console.warn(`Warning: ${label} is empty for ${blank.join(", ")}.`);
});
const unknownVerification = findings.filter(f => f.verification && !KNOWN_VERIFICATION.includes(f.verification));
if (unknownVerification.length) {
  console.warn(`Warning: unrecognized Verification value on ${unknownVerification.map(f => `${f.id} ("${f.verification}")`).join(", ")}. Use ${KNOWN_VERIFICATION.join(" | ")}.`);
}
const inferred = findings.filter(f => f.verification === VERIFICATION.INFERRED).map(f => f.id);
if (inferred.length) {
  const msg = `${inferred.length} finding(s) marked "${VERIFICATION.INFERRED}": ${inferred.join(", ")}. These may not appear in a client deliverable until a human verifies them and changes the value.`;
  if (STRICT) {
    console.error(`Error (--strict): ${msg}`);
    process.exit(1);
  }
  console.warn(`Warning: ${msg}`);
}

const meta = loadMeta(META_PATH);
if (!meta.complianceBaseline && findings.some(f => normKey(f.dimension) === "accessibility")) {
  console.warn("Warning: audit-meta.json has no complianceBaseline. Confirm which standard applies to this client (see references/regulatory-context.md).");
}
const auditData = buildAuditData(findings, meta);

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
Packer.toBuffer(build(auditData)).then(buf => {
  fs.writeFileSync(OUTPUT_PATH, buf);
  console.log(`Written to ${OUTPUT_PATH} (${findings.length} findings across ${auditData.dimensions.length} dimensions).`);
});
