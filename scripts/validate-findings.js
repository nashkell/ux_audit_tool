#!/usr/bin/env node
/**
 * validate-findings.js — QA gate for a finished audit.
 *
 * Checks findings.csv against audit-meta.json before any deliverable is
 * generated. Run it, fix what it reports, and repeat until it passes; only
 * then build the report, summary, and Word doc (see SKILL.md, Validate).
 *
 * Usage:
 *   node validate-findings.js [findings.csv] [audit-meta.json]
 *
 * Exits 1 if there are any errors. Warnings are printed but don't fail.
 * Unlike the Word builder (which warns and builds anyway, for back-compat),
 * the validator is strict: a deliverable needs every v1.5 field.
 */

const fs = require("fs");
const path = require("path");
const B = require("./docx-report-template");
const { BY_SC, OBSOLETE, extractSCs } = require("./wcag22-criteria");

const SEVERITIES = ["Critical", "Major", "Minor", "Cosmetic"];
const SCOPES = ["Site-wide", "Page-level", "Element-level"];
const VERIFICATIONS = Object.values(B.VERIFICATION);
const STANDARDS = Object.values(B.STANDARD);
const TASK_RESULTS = Object.values(B.TASK_RESULT);
const NOT_CONFIRMED = /not confirmed/i;

// ID prefix per dimension. The first one is the recommended prefix; the rest
// are accepted aliases. Keep in sync with SKILL.md Finding Documentation.
const PREFIXES = {
  "Usability Heuristics": ["UH"],
  "Accessibility": ["ACC", "A11Y"],
  "Visual Design": ["VIS", "VD"],
  "Information Architecture": ["IA"],
  "Content & Microcopy": ["CON", "CM"],
  "User Flows": ["UF", "FLOW"],
  "Mobile/Responsive": ["MOB"],
  "Healthcare-Specific": ["HC", "HLT"]
};

// Required CSV columns: [label, candidate header names].
const REQUIRED_FIELDS = [
  ["ID", ["ID"]],
  ["Dimension", ["Dimension"]],
  ["Severity", ["Severity"]],
  ["Scope", ["Scope"]],
  ["Reference", B.REFERENCE_KEYS],
  ["Location", ["Location"]],
  ["Observation", ["Observation"]],
  ["Impact", ["Impact"]],
  ["Recommendation", ["Recommendation"]],
  ["At a Glance", ["At a Glance", "At-a-Glance", "AtAGlance"]],
  ["Evidence", B.EVIDENCE_KEYS],
  ["Verification", B.VERIFICATION_KEYS]
];

// Placeholder text left over from templates. Square brackets only count when
// they start with a capital, '#', or '...', so CSS selectors like
// [data-consent] or [name=Email] in Evidence aren't flagged.
const PLACEHOLDER_PATTERNS = [
  [/\[(?:[A-Z#]|\.\.\.|…)[^\]]*\]/, m => `template placeholder "${m[0]}"`],
  [/lorem ipsum|\blorem\b/i, () => `"lorem" filler text`],
  [/\b(TBD|TODO|TKTK|FIXME)\b/i, m => `"${m[0]}"`],
  [/^(one sentence\b|one to two plain-language sentences)/i, () => "the example file's instruction text"]
];

function findPlaceholder(text) {
  if (!text) return null;
  for (const [re, label] of PLACEHOLDER_PATTERNS) {
    const m = String(text).match(re);
    if (m) return label(m);
  }
  return null;
}

// Sentence count that ignores common abbreviations and decimals (3.5:1).
function sentenceCount(text) {
  const t = String(text)
    .replace(/\b(e\.g|i\.e|etc|vs|Dr|Mr|Mrs|Ms|St|No|approx|U\.S)\./gi, "$1")
    .replace(/(\d)\.(\d)/g, "$1$2");
  return t.split(/[.!?]+(?:["'”’)]*)(?:\s+|$)/).filter(s => s.trim()).length;
}

function words(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 2);
}

// How much of the At a Glance line is just the Observation's wording.
function overlap(glance, observation) {
  const g = new Set(words(glance)), o = new Set(words(observation));
  if (!g.size) return 0;
  let shared = 0;
  g.forEach(w => { if (o.has(w)) shared++; });
  return shared / g.size;
}

function closest(value, allowed) {
  const k = B.normKey(value || "");
  return allowed.find(a => B.normKey(a) === k) || null;
}

function validate(csvPath, metaPath) {
  const errors = [], warnings = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

  // ---------- findings.csv ----------
  if (!fs.existsSync(csvPath)) { err(csvPath, "file not found"); return { errors, warnings }; }
  let rows;
  try { rows = B.parseCSV(fs.readFileSync(csvPath, "utf-8")); }
  catch (e) { err(csvPath, `couldn't parse CSV (${e.message})`); return { errors, warnings }; }
  if (!rows.length) { err(csvPath, "no findings"); return { errors, warnings }; }

  const csvName = path.basename(csvPath);
  const missingCols = REQUIRED_FIELDS.filter(([, keys]) => !B.hasColumn(rows, keys)).map(([l]) => l);
  if (missingCols.length) err(csvName, `missing column(s): ${missingCols.join(", ")}`);
  const hasInputs = [B.REACH_KEYS, B.IMPACT_KEYS, B.EASE_KEYS].map(k => B.hasColumn(rows, k));
  if (!hasInputs.every(Boolean)) {
    warn(csvName, "no UserReach / BusinessImpact / EaseOfFix columns; Priority Score can't be checked against its inputs");
  }

  const seenIds = {};
  const findings = [];
  rows.forEach((r, i) => {
    const id = B.pick(r, ["ID"]);
    const where = id || `row ${i + 2}`;
    const get = keys => B.pick(r, keys);

    // Required fields.
    REQUIRED_FIELDS.forEach(([label, keys]) => {
      if (B.hasColumn(rows, keys) && !get(keys)) err(where, `${label} is empty`);
    });

    // IDs: unique, PREFIX-### form, prefix matches the dimension.
    if (id) {
      if (seenIds[id]) err(where, `duplicate ID (also row ${seenIds[id]})`);
      else seenIds[id] = i + 2;
    }

    const dimension = get(["Dimension"]);
    let canonDim = null;
    if (dimension) {
      canonDim = B.DIMENSION_ORDER.includes(dimension) ? dimension : B.canonicalDimension(dimension);
      if (!B.DIMENSION_ORDER.includes(canonDim)) {
        err(where, `Dimension "${dimension}" not recognized; use ${B.DIMENSION_ORDER.join(" | ")}`);
        canonDim = null;
      } else if (canonDim !== dimension) {
        err(where, `Dimension "${dimension}" should be written exactly as "${canonDim}"`);
      }
    }
    if (id) {
      const m = id.match(/^([A-Z0-9]+)-(\d{3,})$/);
      if (!m) err(where, `ID "${id}" should look like PREFIX-### (e.g. UH-003)`);
      else if (canonDim && !PREFIXES[canonDim].includes(m[1])) {
        err(where, `ID prefix "${m[1]}" doesn't match dimension "${canonDim}"; use ${PREFIXES[canonDim][0]}-###`);
      }
    }

    // Severity and Scope.
    const severity = get(["Severity"]), scope = get(["Scope"]);
    if (severity && !SEVERITIES.includes(severity)) {
      const c = closest(severity, SEVERITIES);
      err(where, `Severity "${severity}" not allowed; ${c ? `write it as "${c}"` : `use ${SEVERITIES.join(" | ")}`}`);
    }
    if (scope && !SCOPES.includes(scope)) {
      const c = closest(scope, SCOPES);
      err(where, `Scope "${scope}" not allowed; ${c ? `write it as "${c}"` : `use ${SCOPES.join(" | ")}`}`);
    }

    // Verification.
    const verRaw = get(B.VERIFICATION_KEYS);
    if (verRaw) {
      const ver = B.normVerification(verRaw);
      if (!VERIFICATIONS.includes(ver)) err(where, `Verification "${verRaw}" not allowed; use ${VERIFICATIONS.join(" | ")}`);
      else if (ver === B.VERIFICATION.INFERRED) err(where, `still "${B.VERIFICATION.INFERRED}". Confirm it live (then mark Observed live) or delete it`);
    }

    // Standard and WCAG criteria.
    const reference = get(B.REFERENCE_KEYS);
    const standardRaw = get(B.STANDARD_KEYS);
    const standard = B.normStandard(standardRaw);
    const scOverride = get(B.SC_KEYS);
    const scsAll = extractSCs(scOverride || reference);
    scsAll.filter(sc => !BY_SC[sc]).forEach(sc => err(where, OBSOLETE[sc] || `"${sc}" is not a WCAG 2.2 A/AA success criterion`));
    const scs = scsAll.filter(sc => BY_SC[sc]);
    if (standardRaw && !standard && B.hasColumn(rows, B.STANDARD_KEYS) && B.hasColumn(rows, B.REFERENCE_KEYS)) {
      err(where, `Standard "${standardRaw}" not allowed; use ${STANDARDS.join(" | ")}`);
    }
    if (canonDim === "Accessibility") {
      if (!standard) err(where, `accessibility finding has no Standard; use ${STANDARDS.join(" | ")}`);
      else if (standard !== B.STANDARD.BEST && !scs.length) err(where, "accessibility finding cites no WCAG success criterion (e.g. \"WCAG 2.4.7 Focus Visible\" in Reference)");
    }
    if (standard && scs.length) {
      const known = scs.map(sc => BY_SC[sc]);
      if (standard === B.STANDARD.WCAG21 && known.every(c => c.isNew22)) err(where, `Standard is "${B.STANDARD.WCAG21}" but ${scs.join(", ")} ${scs.length > 1 ? "are" : "is"} new in WCAG 2.2; use "${B.STANDARD.WCAG22NEW}"`);
      if (standard === B.STANDARD.WCAG22NEW && known.every(c => !c.isNew22)) err(where, `Standard is "${B.STANDARD.WCAG22NEW}" but ${scs.join(", ")} ${scs.length > 1 ? "are" : "is"} in WCAG 2.1; use "${B.STANDARD.WCAG21}"`);
    }

    // At a Glance: one sentence, not a restatement of the Observation.
    const glance = get(["At a Glance", "At-a-Glance", "AtAGlance"]);
    const observation = get(["Observation"]);
    if (glance) {
      const n = sentenceCount(glance);
      if (n > 1) err(where, `At a Glance has ${n} sentences; it should be one`);
      const g = B.normKey(glance), o = B.normKey(observation);
      if (o && (g === o || o.includes(g))) err(where, "At a Glance repeats the Observation; say why it matters to the client instead");
      else if (observation && overlap(glance, observation) >= 0.7) err(where, `At a Glance reuses ${Math.round(overlap(glance, observation) * 100)}% of the Observation's words; lead with the consequence, not the mechanism`);
    }

    // Placeholder text anywhere in the row.
    Object.entries(r).forEach(([col, val]) => {
      const p = findPlaceholder(val);
      if (p) err(where, `${col} contains ${p}`);
    });

    // Priority inputs.
    const inputs = [["UserReach", B.REACH_KEYS], ["BusinessImpact", B.IMPACT_KEYS], ["EaseOfFix", B.EASE_KEYS]]
      .map(([label, keys]) => [label, get(keys)]);
    const given = get(["Priority Score", "Priority"]);
    const filled = inputs.filter(([, v]) => v !== "");
    let computed = null;
    inputs.forEach(([label, v]) => {
      if (v !== "" && !/^[1-5]$/.test(v)) err(where, `${label} "${v}" out of range; use a whole number 1-5`);
    });
    if (filled.length && filled.length < 3) err(where, `priority inputs incomplete: ${inputs.filter(([, v]) => v === "").map(([l]) => l).join(", ")} empty`);
    if (filled.length === 3 && inputs.every(([, v]) => /^[1-5]$/.test(v)) && SEVERITIES.includes(severity)) {
      computed = B.computePriority(severity, ...inputs.map(([, v]) => Number(v)));
      if (given && Number(given) !== computed) err(where, `Priority Score ${given} doesn't match its inputs (computes to ${computed})`);
    }
    if (!filled.length) {
      if (!given) err(where, "no Priority Score and no UserReach / BusinessImpact / EaseOfFix");
      else if (!/^\d+(\.\d+)?$/.test(given) || Number(given) < 8 || Number(given) > 37) err(where, `Priority Score "${given}" out of range (8-37)`);
      else if (hasInputs.some(Boolean)) warn(where, "Priority Score given without its inputs; add UserReach / BusinessImpact / EaseOfFix");
    }

    // Consolidation: a Site-wide finding should list where it occurs.
    const instances = get(B.INSTANCES_KEYS);
    if (scope === "Site-wide" && B.hasColumn(rows, B.INSTANCES_KEYS) && (!instances || /^1$/.test(instances.trim()))) {
      warn(where, "Site-wide but Instances doesn't list where it occurs (consolidation rule)");
    }

    findings.push({ id, where, dimension: canonDim, severity, scope, reference: B.normKey(reference), location: B.normKey(get(["Location"])), scs, standard });
  });

  // Possible duplicates the consolidation rule should have merged.
  for (let a = 0; a < findings.length; a++) {
    for (let b = a + 1; b < findings.length; b++) {
      const x = findings[a], y = findings[b];
      if (!x.dimension || x.dimension !== y.dimension) continue;
      const sameRef = x.reference && x.reference === y.reference;
      const sameSC = x.scs.length && x.scs.length === y.scs.length && x.scs.every(sc => y.scs.includes(sc));
      if (sameRef || sameSC) warn(`${x.where} / ${y.where}`, `same ${sameSC ? "WCAG criterion" : "Reference"} in ${x.dimension}; if it's the same root issue, merge into one finding and list Instances`);
    }
  }

  // ---------- audit-meta.json ----------
  const metaName = path.basename(metaPath);
  if (!fs.existsSync(metaPath)) { err(metaName, "file not found; copy assets/audit-meta.example.json and fill it in"); return { errors, warnings }; }
  let meta;
  try { meta = JSON.parse(fs.readFileSync(metaPath, "utf-8")); }
  catch (e) { err(metaName, `not valid JSON (${e.message})`); return { errors, warnings }; }

  const text = (key, label) => {
    const v = meta[key];
    if (v === undefined || v === null || String(v).trim() === "") { err(metaName, `${label} (${key}) is empty`); return; }
    const p = findPlaceholder(v);
    if (p) err(metaName, `${key} contains ${p}`);
  };
  text("siteName", "site name");
  text("preparedBy", "prepared-by");
  text("date", "date");
  text("pagesAudited", "pages audited");
  text("overallNarrative", "executive summary narrative");
  if (meta.siteName === "example-site.com") warn(metaName, "siteName is still the example value");

  if (!Array.isArray(meta.roadmapPhases) || !meta.roadmapPhases.length) {
    err(metaName, "roadmapPhases is empty; add at least one phase with name, focus, and timeframe");
  } else {
    meta.roadmapPhases.forEach((ph, i) => {
      ["name", "focus", "timeframe"].forEach(k => {
        if (!ph || !ph[k] || !String(ph[k]).trim()) err(metaName, `roadmapPhases[${i}].${k} is empty`);
        else { const p = findPlaceholder(ph[k]); if (p) err(metaName, `roadmapPhases[${i}].${k} contains ${p}`); }
      });
    });
  }

  // Dimensions.
  let evaluated = null;
  if (!Array.isArray(meta.dimensionsEvaluated) || !meta.dimensionsEvaluated.length) {
    err(metaName, "dimensionsEvaluated is missing; list every dimension you evaluated (clean ones score 50/50)");
  } else {
    evaluated = new Set();
    meta.dimensionsEvaluated.forEach(d => {
      const c = B.canonicalDimension(String(d));
      if (!B.DIMENSION_ORDER.includes(c)) err(metaName, `dimensionsEvaluated "${d}" not recognized; use ${B.DIMENSION_ORDER.join(" | ")}`);
      else evaluated.add(c);
    });
    const outside = [...new Set(findings.filter(f => f.dimension && !evaluated.has(f.dimension)).map(f => f.dimension))];
    outside.forEach(d => err(metaName, `findings exist in "${d}" but it isn't in dimensionsEvaluated`));
  }

  // Compliance baseline: required whenever accessibility is in scope.
  const a11yInScope = (evaluated && evaluated.has("Accessibility")) || findings.some(f => f.dimension === "Accessibility");
  if (a11yInScope) {
    if (!meta.complianceBaseline || !String(meta.complianceBaseline).trim()) {
      err(metaName, "complianceBaseline is missing. Ask the client which standard applies (see references/regulatory-context.md); if they haven't said, use \"Not confirmed — client to advise\"");
    } else if (NOT_CONFIRMED.test(meta.complianceBaseline)) {
      warn(metaName, "complianceBaseline is not confirmed yet; confirm it with the client before delivery if you can");
    }
  }

  // Key tasks.
  const ids = new Set(findings.map(f => f.id).filter(Boolean));
  if (!Array.isArray(meta.keyTasks) || !meta.keyTasks.length) {
    err(metaName, "keyTasks is missing; record the 2-3 tasks you walked through live (references/task-walkthroughs.md)");
  } else {
    if (meta.keyTasks.length < 2) warn(metaName, "only one key task; audits normally walk 2-3");
    meta.keyTasks.forEach((t, i) => {
      const w = `keyTasks[${i}]`;
      if (!t || typeof t !== "object") { err(metaName, `${w} should be an object with task, start, success, result`); return; }
      ["task", "start", "success", "result"].forEach(k => { if (!t[k] || !String(t[k]).trim()) err(metaName, `${w}.${k} is empty`); });
      if (t.result && !B.normTaskResult(t.result)) err(metaName, `${w}.result "${t.result}" not allowed; use ${TASK_RESULTS.join(" | ")}`);
      const related = Array.isArray(t.findings) ? t.findings : [];
      related.filter(id => !ids.has(id)).forEach(id => err(metaName, `${w} lists ${id}, which isn't in ${csvName}`));
      const r = B.normTaskResult(t.result);
      if ((r === B.TASK_RESULT.HARD || r === B.TASK_RESULT.FAILED) && !related.length) err(metaName, `${w} is "${r}" but lists no findings`);
      if (r === B.TASK_RESULT.SKIPPED) warn(metaName, `${w} was not attempted`);
    });
  }

  // criteriaResults.
  if (meta.criteriaResults !== undefined && meta.criteriaResults !== null) {
    if (!Array.isArray(meta.criteriaResults)) err(metaName, "criteriaResults should be an array");
    else {
      const fails = {};
      findings.filter(f => f.standard !== B.STANDARD.BEST).forEach(f => f.scs.forEach(sc => (fails[sc] = fails[sc] || []).push(f.id)));
      meta.criteriaResults.forEach((c, i) => {
        const w = `criteriaResults[${i}]`;
        const sc = c && String(c.sc || "").trim();
        if (!sc) { err(metaName, `${w} has no sc`); return; }
        if (!BY_SC[sc]) { err(metaName, `${w}: ${OBSOLETE[sc] || `"${sc}" is not a WCAG 2.2 A/AA success criterion`}`); return; }
        const res = B.normResult(c.result);
        if (!res) { err(metaName, `${w} (${sc}): result "${c.result}" not allowed; use ${Object.values(B.RESULT).join(" | ")}`); return; }
        if (res !== B.RESULT.FAIL && fails[sc]) err(metaName, `${w}: ${sc} marked "${res}" but ${fails[sc].join(", ")} fail${fails[sc].length === 1 ? "s" : ""} it`);
        if (res === B.RESULT.FAIL && !fails[sc] && !c.note) err(metaName, `${w}: ${sc} marked Fail with no finding and no note`);
      });
    }
  }

  return { errors, warnings, count: rows.length };
}

if (require.main === module) {
  const [csvArg, metaArg] = process.argv.slice(2).filter(a => !a.startsWith("--"));
  const csvPath = csvArg || "./findings.csv";
  const metaPath = metaArg || "./audit-meta.json";
  const { errors, warnings, count } = validate(csvPath, metaPath);
  warnings.forEach(w => console.log(`WARN   ${w}`));
  errors.forEach(e => console.log(`ERROR  ${e}`));
  if (errors.length) {
    console.log(`\nFAIL: ${errors.length} error(s), ${warnings.length} warning(s). Fix the errors and run again before generating deliverables.`);
    process.exit(1);
  }
  console.log(`\nPASS: ${count} findings, ${warnings.length} warning(s). OK to generate deliverables.`);
}

module.exports = { validate, sentenceCount, overlap, findPlaceholder, PREFIXES };
