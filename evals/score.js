#!/usr/bin/env node
/**
 * evals/score.js — measure an audit run against a known answer key.
 *
 *   node evals/score.js <expected.csv> <run-findings.csv> [--verbose]
 *       Recall, precision, and duplicate rate of a run's findings.csv against
 *       an expected-findings list (e.g. evals/bad-before/expected.csv).
 *
 *   node evals/score.js --scores <expected-scores.json> <findings.csv> <audit-meta.json>
 *       Checks that the Word builder's scoring reproduces known numbers
 *       (e.g. evals/carepath).
 *
 *   node evals/score.js --all
 *       Runs every eval in this folder: CarePath scores + validator, and the
 *       BAD automated baseline. Exits 1 if a check fails or a metric drops
 *       below its recorded floor.
 *
 * Matching (expected list mode). A reported finding covers an expected item when
 *   - it's on the right page: its text names the page, or it's Site-wide, or
 *     the expected item is a template issue (Page = all); and
 *   - it's the same issue: it cites one of the item's WCAG criteria and hits
 *     at least one of its keywords, or (for a finding that cites no WCAG
 *     criterion, e.g. a usability finding) it hits two or more keywords.
 * A run CSV may instead give an explicit `Matches` column (expected IDs,
 * separated by ; or ,), which overrides automatic matching for that row; use
 * it when grading a run by hand.
 *
 * Precision counts findings that cover at least one expected item. Answer
 * keys like the BAD annotations aren't exhaustive, so an optional
 * also-valid.csv next to expected.csv lists real issues the key leaves out
 * (same columns, plus Why). A finding matching one counts as precise but
 * doesn't add to recall. Anything still unmatched is printed for a human to
 * review, so precision is a lower bound.
 *
 * A finding is a duplicate when every expected item it covers is already
 * covered by an earlier finding (the consolidation rule should have merged it).
 */

const fs = require("fs");
const path = require("path");
const B = require("../scripts/docx-report-template");
const { extractSCs } = require("../scripts/wcag22-criteria");

const rel = p => { const r = path.relative(process.cwd(), p); return r.startsWith("..") ? p : r; };
const PAGE_NAMES = ["home", "news", "tickets", "survey"];

function loadExpected(p) {
  return B.parseCSV(fs.readFileSync(p, "utf-8")).map(r => ({
    id: B.pick(r, ["ExpectedID", "ID"]),
    page: B.pick(r, ["Page"]).toLowerCase(),
    title: B.pick(r, ["Title"]),
    scs: B.pick(r, ["WCAG"]).split(/[;,\s]+/).filter(Boolean),
    level: B.pick(r, ["Level"]),
    keywords: B.pick(r, ["Keywords"]).toLowerCase().split(";").map(k => k.trim()).filter(Boolean)
  }));
}

function loadRun(p) {
  return B.parseCSV(fs.readFileSync(p, "utf-8")).map((r, i) => {
    const text = ["Location", "Observation", "Evidence", "Instances", "Recommendation", "Impact"]
      .map(k => B.pick(r, [k])).concat(B.pick(r, B.REFERENCE_KEYS)).join(" ").toLowerCase();
    const matches = B.pick(r, ["Matches", "Expected", "ExpectedID"]);
    return {
      id: B.pick(r, ["ID"]) || `row ${i + 2}`,
      scope: B.pick(r, ["Scope"]),
      scs: extractSCs(B.pick(r, B.SC_KEYS) || B.pick(r, B.REFERENCE_KEYS) + " " + B.pick(r, ["Observation"])),
      text,
      explicit: matches ? matches.split(/[;,\s]+/).filter(Boolean) : null
    };
  });
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function keywordHits(text, keywords) {
  return keywords.filter(k => new RegExp(`(^|[^a-z0-9])${escapeRe(k)}`).test(text)).length;
}

function pageOk(f, e) {
  if (e.page === "all" || f.scope === "Site-wide") return true;
  if (f.text.includes(e.page)) return true;
  // A finding that names no BAD page at all is treated as page-agnostic.
  return !PAGE_NAMES.some(p => f.text.includes(p));
}

function covers(f, e) {
  if (!pageOk(f, e)) return false;
  const hits = keywordHits(f.text, e.keywords);
  const scOverlap = f.scs.some(sc => e.scs.includes(sc));
  // A finding that cites WCAG criteria must share one with the item; keyword
  // matches alone only count for findings that cite none (e.g. usability).
  if (f.scs.length) return scOverlap && hits >= 1;
  return hits >= 2;
}

function scoreRun(expectedPath, runPath, { quiet = false, verbose = false } = {}) {
  const expected = loadExpected(expectedPath);
  const alsoPath = path.join(path.dirname(expectedPath), "also-valid.csv");
  const alsoValid = fs.existsSync(alsoPath) ? loadExpected(alsoPath) : [];
  const run = loadRun(runPath);
  const ids = new Set(expected.map(e => e.id));
  const coveredBy = {};
  const seen = new Set();
  let duplicates = 0, matchedFindings = 0;
  const unmatched = [], dupList = [], unknownExplicit = [], extra = [];

  run.forEach(f => {
    let set;
    if (f.explicit) {
      f.explicit.filter(id => !ids.has(id)).forEach(id => unknownExplicit.push(`${f.id} → ${id}`));
      set = f.explicit.filter(id => ids.has(id));
    } else {
      set = expected.filter(e => covers(f, e)).map(e => e.id);
    }
    const valid = set.length || f.explicit ? [] : alsoValid.filter(e => covers(f, e)).map(e => e.id);
    if (verbose) console.log(`  ${f.id} → ${set.join(", ") || (valid.length ? `(also valid: ${valid.join(", ")})` : "(none)")}`);
    if (!set.length) {
      if (valid.length) { extra.push(`${f.id} (${valid.join(", ")})`); matchedFindings++; }
      else unmatched.push(f.id);
      return;
    }
    matchedFindings++;
    if (set.every(id => seen.has(id))) { duplicates++; dupList.push(`${f.id} (${set.join(", ")})`); }
    set.forEach(id => { seen.add(id); (coveredBy[id] = coveredBy[id] || []).push(f.id); });
  });

  const inScope = expected.filter(e => e.level === "A/AA");
  const pct = (n, d) => d ? `${(100 * n / d).toFixed(1)}%` : "n/a";
  const result = {
    expected: expected.length,
    reported: run.length,
    recall: expected.filter(e => coveredBy[e.id]).length / expected.length,
    recallAA: inScope.length ? inScope.filter(e => coveredBy[e.id]).length / inScope.length : 0,
    precision: run.length ? matchedFindings / run.length : 0,
    duplicateRate: run.length ? duplicates / run.length : 0
  };

  if (!quiet) {
    const found = expected.filter(e => coveredBy[e.id]).length;
    const foundAA = inScope.filter(e => coveredBy[e.id]).length;
    console.log(`Run:      ${rel(runPath)} (${run.length} findings)`);
    console.log(`Expected: ${rel(expectedPath)} (${expected.length} items, ${inScope.length} at WCAG A/AA)\n`);
    console.log(`Recall (all expected):     ${pct(found, expected.length)}  (${found}/${expected.length})`);
    console.log(`Recall (A/AA items only):  ${pct(foundAA, inScope.length)}  (${foundAA}/${inScope.length})`);
    console.log(`Precision (lower bound):   ${pct(matchedFindings, run.length)}  (${matchedFindings}/${run.length} findings match an expected${alsoValid.length ? " or also-valid" : ""} item)`);
    console.log(`Duplicate rate:            ${pct(duplicates, run.length)}  (${duplicates}/${run.length})`);

    const byPage = {};
    expected.forEach(e => { const b = (byPage[e.page] = byPage[e.page] || [0, 0]); b[1]++; if (coveredBy[e.id]) b[0]++; });
    console.log(`\nRecall by page: ${Object.entries(byPage).map(([p, [a, b]]) => `${p} ${a}/${b}`).join(" · ")}`);
    const missed = expected.filter(e => !coveredBy[e.id]);
    if (missed.length) console.log(`\nMissed (${missed.length}):\n${missed.map(e => `  ${e.id}  [${e.level}] ${e.title}`).join("\n")}`);
    if (extra.length) console.log(`\nReal but not in the answer key (also-valid.csv): ${extra.join(", ")}`);
    if (unmatched.length) console.log(`\nUnmatched findings — review by hand; they may be real issues the answer key doesn't list (${unmatched.length}): ${unmatched.join(", ")}`);
    if (dupList.length) console.log(`\nDuplicates (${dupList.length}): ${dupList.join("; ")}`);
    if (unknownExplicit.length) console.log(`\nWarning: Matches column names unknown expected IDs: ${unknownExplicit.join(", ")}`);
  }
  return result;
}

// ---------- scores mode ----------
function checkScores(expectedScoresPath, csvPath, metaPath, { quiet = false } = {}) {
  const exp = JSON.parse(fs.readFileSync(expectedScoresPath, "utf-8"));
  const log = console.log, warnFn = console.warn;
  console.warn = () => {}; console.log = () => {};          // the builder's notes aren't eval output
  let data;
  try { data = B.buildAuditData(B.loadFindings(csvPath), B.loadMeta(metaPath)); }
  finally { console.log = log; console.warn = warnFn; }
  const failures = [];
  const check = (label, got, want) => { if (String(got) !== String(want)) failures.push(`${label}: got ${got}, expected ${want}`); };
  check("overall", data.overallHealthPct, exp.overall);
  Object.entries(exp.dimensions || {}).forEach(([name, want]) => {
    const d = data.dimensionScores.find(x => x.name === name);
    check(name, d ? d.score : "missing", want);
  });
  if (exp.top5) check("Top 5", data.topPriorities.map(p => p.id).join(", "), exp.top5.join(", "));
  if (!quiet) {
    console.log(`Scores: ${rel(csvPath)}`);
    console.log(`  overall ${data.overallHealthPct} (${data.overallRating}); ${data.dimensionScores.map(d => `${d.name} ${d.score}`).join(" · ")}`);
    console.log(`  Top 5 ${data.topPriorities.map(p => p.id).join(", ")}`);
    console.log(failures.length ? `  FAIL\n${failures.map(f => `    ${f}`).join("\n")}` : "  PASS: matches expected scores");
  }
  return failures;
}

// ---------- --all ----------
function runAll() {
  const here = __dirname;
  let failed = false;
  console.log("=== CarePath: scoring reproduces known numbers ===");
  const cp = path.join(here, "carepath");
  if (checkScores(path.join(cp, "expected-scores.json"), path.join(cp, "findings.csv"), path.join(cp, "audit-meta.json")).length) failed = true;

  console.log("\n=== CarePath: validator passes the clean sample ===");
  const { validate } = require("../scripts/validate-findings");
  const v = validate(path.join(cp, "findings.csv"), path.join(cp, "audit-meta.json"));
  v.warnings.forEach(w => console.log(`  WARN  ${w}`));
  v.errors.forEach(e => console.log(`  ERROR ${e}`));
  console.log(v.errors.length ? `  FAIL: ${v.errors.length} error(s)` : `  PASS (${v.warnings.length} warning(s))`);
  if (v.errors.length) failed = true;

  const bad = path.join(here, "bad-before");
  const floors = JSON.parse(fs.readFileSync(path.join(bad, "baseline.json"), "utf-8"));
  fs.readdirSync(bad).filter(f => /^run-.*\.csv$/.test(f)).sort().forEach(f => {
    console.log(`\n=== W3C BAD before: ${f} ===`);
    const r = scoreRun(path.join(bad, "expected.csv"), path.join(bad, f));
    const floor = floors.runs && floors.runs[f];
    if (floor) {
      const drops = ["recall", "precision"].filter(k => r[k] + 1e-9 < floor[k]);
      if (r.duplicateRate > floor.duplicateRate + 1e-9) drops.push("duplicateRate");
      if (drops.length) { failed = true; console.log(`  REGRESSION vs baseline.json: ${drops.join(", ")}`); }
      else console.log("  No regression vs baseline.json.");
    }
  });
  console.log(failed ? "\nEVALS FAILED" : "\nALL EVALS PASSED");
  process.exit(failed ? 1 : 0);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === "--all") runAll();
  else if (args[0] === "--scores" && args.length === 4) process.exit(checkScores(args[1], args[2], args[3]).length ? 1 : 0);
  else if (args.filter(a => a !== "--verbose").length === 2) scoreRun(...args.filter(a => a !== "--verbose"), { verbose: args.includes("--verbose") });
  else {
    console.log("Usage:\n  node evals/score.js <expected.csv> <run-findings.csv> [--verbose]\n  node evals/score.js --scores <expected-scores.json> <findings.csv> <audit-meta.json>\n  node evals/score.js --all");
    process.exit(2);
  }
}

module.exports = { scoreRun, checkScores };
