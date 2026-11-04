#!/usr/bin/env node
/**
 * evals/automated-baseline.js — turn capture-site.js output into a findings
 * CSV using automation alone (axe-core violations plus the capture's own
 * keyboard-focus checks), with no human judgment.
 *
 *   node evals/automated-baseline.js <capture-output-dir> <out.csv>
 *
 * This is the floor an audit should beat: scoring it with evals/score.js
 * shows how much of a known answer key automation finds by itself. It applies
 * the consolidation rule (the same axe rule on 3+ pages becomes one Site-wide
 * finding). Every row is marked "Inferred — needs human check" because no one
 * has looked at the flagged elements. It is not a deliverable.
 */

const fs = require("fs");
const path = require("path");
const { BY_SC } = require("../scripts/wcag22-criteria");

const [dir, out] = process.argv.slice(2);
if (!dir || !out) { console.log("Usage: node evals/automated-baseline.js <capture-output-dir> <out.csv>"); process.exit(2); }

const summary = JSON.parse(fs.readFileSync(path.join(dir, "capture-summary.json"), "utf-8"));
const pages = summary.pages.map(p => ({ name: p.name, url: p.url, a: JSON.parse(fs.readFileSync(path.join(dir, p.name, "analysis.json"), "utf-8")) }));

const SEVERITY = { critical: "Critical", serious: "Major", moderate: "Minor", minor: "Cosmetic" };
const WEIGHT = { Critical: 4, Major: 3, Minor: 2, Cosmetic: 1 };
const scFromTags = tags => tags.map(t => t.match(/^wcag(\d)(\d)(\d+)$/)).filter(Boolean).map(m => `${m[1]}.${m[2]}.${m[3]}`).filter(sc => BY_SC[sc]);

// Group axe violations by rule across pages.
const byRule = {};
pages.forEach(p => (p.a.accessibility && p.a.accessibility.violations || []).forEach(v => {
  const g = (byRule[v.id] = byRule[v.id] || { v, pages: [] });
  g.pages.push({ page: p, nodes: v.nodes || [], count: v.nodeCount || (v.nodes || []).length });
}));

// The capture's keyboard checks, grouped the same way.
const focusLost = pages.filter(p => p.a.keyboardFocus && p.a.keyboardFocus.focusLost && p.a.keyboardFocus.focusLost.length);
const noIndicator = pages.filter(p => p.a.keyboardFocus && p.a.keyboardFocus.withoutFocusIndicator && p.a.keyboardFocus.withoutFocusIndicator.length);

const rows = [];
let n = 0;
const nextId = () => `ACC-${String(++n).padStart(3, "0")}`;
const sitewide = list => list.length >= 3;

Object.values(byRule).forEach(({ v, pages: hits }) => {
  const scs = scFromTags(v.tags || []);
  const severity = SEVERITY[v.impact] || "Minor";
  const groups = sitewide(hits) ? [hits] : hits.map(h => [h]);
  groups.forEach(group => {
    const total = group.reduce((s, h) => s + h.count, 0);
    const scope = group.length >= 3 ? "Site-wide" : total > 1 ? "Page-level" : "Element-level";
    const where = group.map(h => h.page.name).join(", ");
    const nodes = group.flatMap(h => h.nodes.slice(0, 4).map(nd => `${h.page.name}: ${nd.target} ${String(nd.html || "").slice(0, 120)}`));
    rows.push({
      ID: nextId(), Dimension: "Accessibility", Severity: severity, Scope: scope,
      Reference: scs.length ? scs.map(sc => `WCAG ${sc} ${BY_SC[sc].name}`).join("; ") : `axe ${v.id} (best practice)`,
      Standard: scs.length ? (scs.some(sc => !BY_SC[sc].isNew22) ? "WCAG 2.1 AA" : "WCAG 2.2 AA (new)") : "Best practice",
      Location: `${where} page${group.length > 1 ? "s" : ""}`,
      Observation: `axe ${v.id}: ${v.help} (${total} element${total === 1 ? "" : "s"}).`,
      Impact: v.description,
      Recommendation: `Fix each flagged element; see ${v.helpUrl || "the axe rule documentation"}.`,
      "At a Glance": `Automated check: ${v.help.charAt(0).toLowerCase()}${v.help.slice(1)}.`,
      UserReach: scope === "Site-wide" ? 4 : 2, BusinessImpact: 3, EaseOfFix: 3,
      Evidence: `axe rule ${v.id}; ${group.map(h => h.page.url).join(", ")}; ${nodes.join(" | ")}`,
      Verification: "Inferred — needs human check",
      Instances: `${group.length} page${group.length > 1 ? "s" : ""}: ${where}`
    });
  });
});

function keyboardRow(list, label, sc, observation, sample) {
  if (!list.length) return;
  const groups = sitewide(list) ? [list] : list.map(p => [p]);
  groups.forEach(group => {
    const where = group.map(p => p.name).join(", ");
    rows.push({
      ID: nextId(), Dimension: "Accessibility", Severity: "Major", Scope: group.length >= 3 ? "Site-wide" : "Page-level",
      Reference: `WCAG ${sc} ${BY_SC[sc].name}`, Standard: "WCAG 2.1 AA",
      Location: `${where} page${group.length > 1 ? "s" : ""}`,
      Observation: observation,
      Impact: "Keyboard users can't see or keep their place on the page.",
      Recommendation: "Remove scripts that remove focus and give every focusable element a visible focus style.",
      "At a Glance": `Automated check: ${label}.`,
      UserReach: group.length >= 3 ? 4 : 2, BusinessImpact: 3, EaseOfFix: 3,
      Evidence: `capture-site.js keyboardFocus; ${group.map(p => `${p.name}: ${sample(p)}`).join(" | ")}`,
      Verification: "Inferred — needs human check",
      Instances: `${group.length} page${group.length > 1 ? "s" : ""}: ${where}`
    });
  });
}
keyboardRow(focusLost, "keyboard focus is lost on some links", "2.4.7",
  "Tab stops drop focus back to the page (focusLost), e.g. onfocus=\"blur()\".",
  p => p.a.keyboardFocus.focusLost.slice(0, 3).map(f => f.lostFrom).join(", "));
keyboardRow(noIndicator, "some focusable elements show no focus indicator", "2.4.7",
  "Tab stops whose outline, box-shadow, border, and background don't change on focus.",
  p => p.a.keyboardFocus.withoutFocusIndicator.slice(0, 3).map(f => f.selector || f.el || JSON.stringify(f)).join(", "));

rows.forEach(r => { r["Priority Score"] = WEIGHT[r.Severity] * 3 + r.UserReach * 2 + r.BusinessImpact * 2 + r.EaseOfFix; });

const cols = ["ID", "Dimension", "Severity", "Scope", "Reference", "Standard", "Location", "Observation", "Impact", "Recommendation", "At a Glance", "UserReach", "BusinessImpact", "EaseOfFix", "Priority Score", "Evidence", "Verification", "Instances"];
const q = v => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
fs.writeFileSync(out, [cols.join(","), ...rows.map(r => cols.map(c => q(r[c])).join(","))].join("\n") + "\n");
console.log(`Wrote ${rows.length} automated findings to ${out} (from ${pages.length} pages captured ${summary.capturedAt}).`);
