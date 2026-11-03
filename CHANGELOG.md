# Changelog

All notable changes to this skill are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [1.5.0] - 2026-11-03

Phase 1 of the v1.5 plan: evidence, verification, and consolidation. Every finding now shows what it's based on and how it was confirmed, and repeated issues are consolidated.

### Added
- **Three new finding fields** in `SKILL.md` Finding Documentation: `Evidence` (URLs, selector/element, axe rule ID, screenshot ref), `Verification` (`Automated-confirmed` | `Observed live` | `Inferred — needs human check`, each defined), and `Instances` (count + pages).
- **Verification rule:** findings marked `Inferred — needs human check` may not appear in a client deliverable until a human changes the value.
- **Consolidation Rule** (under Scope of Impact): the same root issue on 3+ pages or in a shared component becomes one Site-wide finding with every location in Instances; no per-page findings for template-level problems; don't report what wasn't observed — test it live or mark it Inferred.
- `docx-report-template.js`: reads `Evidence` / `Verification` / `Instances` with the same loose column matching and shows them in small muted text under Reference. Verification values are normalized loosely (`observed`, `automated`, `inferred - …` all resolve); unrecognized values warn.
- `docx-report-template.js --strict`: exits 1 and writes nothing if any finding is Inferred, naming the IDs. Without the flag it prints a warning with the same IDs.

### Changed
- `assets/findings.example.csv` gains `Evidence`, `Verification`, `Instances` columns, filled in for both rows.
- `assets/audit-report-template.md` finding blocks include the new fields, plus a pre-delivery note on Inferred findings and consolidation.
- README: Finding Documentation Format and Word pipeline sections describe the new fields, the consolidation rule, and `--strict`.
- SKILL.md footer synced to 1.5.0 (it had lagged at 1.4.0).

### Back-compat
- A CSV without the new columns still builds, with a single warning that they're missing. When the columns exist but a row is blank, the script warns with the affected IDs. Neither case fails the build.

### Verified
- Old-format 8-finding / 4-dimension CarePath-equivalent CSV, built with the new script: 87.5% overall (Good); Usability Heuristics 43, Accessibility 38.5, Content & Microcopy 48.5, Mobile/Responsive 45; Top 5 ACC-001, UH-003, MOB-001, UH-001, ACC-002. The extracted document text is identical to the v1.4.1 script's output on the same CSV.
- New-format CSV: Evidence, Verification, and Instances render under Reference on all 8 findings (checked visually and in the extracted text).
- `--strict` with one Inferred row (UH-003): exit 1, names UH-003, no file written. `--strict` on the same CSV with UH-003 changed to Observed live: exit 0.
- `assets/findings.example.csv` builds cleanly.
- Caveats: the original CarePath CSV isn't in the repo, so the old-format check used a reconstructed 8-row CSV that reproduces the published v1.4 numbers under the v1.4.1 script. LibreOffice/poppler weren't installed on the test machine, so the visual check used the macOS Quick Look render and the text checks used `textutil`, not `soffice` + `pdftotext`. Re-run with the real CarePath CSV and `soffice` when they're available.

## [1.4.1] - 2026-07-08

### Changed
- **`README.md` substantially expanded** — restructured around an Executive Summary, a Workflow overview (the URL-to-deliverables pipeline), and full detail sections for each stage: Environments (Claude Code / Cowork / Chat), the 8 Audit Dimensions, Finding Documentation Format (including the Severity/Scope distinction), the Severity x Scope Scoring Matrix (with worked example and rationale), and the Word (.docx) Generation Pipeline. No functional changes to the skill itself — documentation only.

## [1.4.0] - 2026-07-08

### Added
- **CSV-driven Word generation.** `scripts/docx-report-template.js` now reads `findings.csv` directly (plus a small `audit-meta.json` for the handful of things a CSV can't hold — narrative, roadmap, cover details) instead of requiring findings to be re-typed into a hardcoded data object. Dimension scores, severity counts, top-5 priorities (ranked by Priority Score), and the appendix scoring table are all computed automatically from the CSV using the Severity × Scope deduction table.
- `assets/findings.example.csv` and `assets/audit-meta.example.json` — reference files showing the expected input format, with inline comments on each metadata field.
- Built-in CSV parser (quoted fields, embedded commas/newlines) and case/punctuation-insensitive column matching, so minor header variations across exports don't break the script.
- Run as `node scripts/docx-report-template.js findings.csv audit-meta.json output.docx` (all three args optional, with sensible defaults).

### Changed
- `SKILL.md`'s Word Deliverable workflow rewritten around this — no more manual data re-entry step.

### Verified
- End-to-end tested against a real 8-finding, 4-dimension sample CSV: computed overall health (87.5%), all four dimension scores, severity counts, and Top 5 priority ranking matched hand-calculated values exactly.

## [1.3.0] - 2026-07-08

### Added
- **`scripts/docx-report-template.js`** — a reusable, data-driven builder for a branded Word (.docx) deliverable, using the `docx` skill's environment. Takes the same data already captured in `audit-report.md`/`findings.csv` (dimension scores, severity counts, top priorities with At a Glance lines, roadmap phases, per-dimension findings with Severity + Scope tags) and produces a cover page, executive summary, detailed findings, and appendix with the scoring breakdown — styled to the Relevate Health palette (navy/purple/lime/teal, Inter).
- **Report Generation** section in `SKILL.md` now documents the docx workflow: read the `docx` skill first, populate the `AUDIT` data object, run the script, then render to PDF and visually verify before delivery (per the `docx` skill's standard verification step).

### Notes
- Brand hex values in the template are approximated from the HTML deck system and marked as placeholders in the file itself — confirm against the actual brand guide before client delivery.
- Severity badges use the standard red/orange/yellow/gray convention, kept intentionally separate from the brand accent colors so severity reads independently of brand styling.

## [1.2.0] - 2026-07-08

Follow-up round, driven by further review of production use on the pivotpump.com deck.

### Added
- **`assets/executive-summary-template.md`** — the one-pager template referenced by `SKILL.md` but previously missing from the repo. Built around dimension scores, severity breakdown, top-priority findings (using the At a Glance line from each finding, not a restated observation), and an outcome-named roadmap overview.
- **Scope of Impact** as a second axis alongside Severity in Finding Documentation. Every finding now gets a `Scope` (Site-wide / Page-level / Element-level) in addition to a `Severity`, since a Critical finding in the global nav and a Critical finding on one element aren't the same problem even though both are "Critical."
- **Severity × Scope deduction table**, replacing the flat `critical×10 / major×6 / minor×3 / cosmetic×1` Dimension Score formula. The new table (Site-wide / Page-level / Element-level columns) scores findings more accurately by weighing both how bad and how far-reaching an issue is. This directly addresses a scoring-accuracy issue found while finalizing pivotpump.com findings.

### Changed
- Clarified that browser-based review (Cowork or headless Puppeteer) is unaffected by the screenshot-capture limitation introduced in 1.1.0 — only the step that saves screenshot *images* into the output is disabled. Live site navigation and analysis (DOM, a11y, text, keyboard-nav) continue as normal; annotated screenshots for the deliverable are the auditor's responsibility to capture and add manually for now.
- Renamed the report template's top-level `Scope` field (pages/flows covered by the audit) to `Pages/Flows Audited` to avoid collision with the new per-finding `Scope` (Site-wide/Page-level/Element-level).

## [1.1.0] - 2026-07-08

Updates driven by production use on a client audit deck (healthcare/medical device site).

### Added
- **"At a Glance" field** added to the finding documentation format and report template. Every finding now includes a one-sentence, client-facing "so what" takeaway, written as a synthesis after Observation/Impact/Recommendation — not a compressed restatement of the Observation.
- **Binary vs. graded findings principle** added to the Severity Scale section. Some findings (across all dimensions, not just Accessibility) are pass/fail conditions rather than matters of degree; severity for these is now explicitly tied to the consequence of failure, not a graduated distance from an ideal.
- **Roadmap Phase Naming** section. Phases should be named for the nature of the work they contain, not for how easy the work is — "Quick Wins" mislabels a phase dominated by compliance work. Includes a reusable outcome + narrative-arc pattern.
- `README.md`, `CHANGELOG.md`, `.gitignore` for version-controlled, shareable distribution.

### Changed
- Report template's roadmap phase headers changed from fixed effort-based labels ("Quick Wins," "Medium-Term," "Long-Term") to outcome-based placeholders with a pointer to the naming guidance.

### Known Limitations
- **Screenshot capture disabled by default.** Automated desktop/mobile screenshot output (via Puppeteer in Claude Code, or the `computer` action in Cowork) was found to be unreliable in production. DOM extraction, axe-core accessibility checks, text extraction, and keyboard-nav analysis are unaffected and continue to run. `capture-site.js` now accepts `--with-screenshots` to opt back in for testing; Cowork/Chat workflows now default to requesting user-supplied screenshots when a visual reference is needed.

### Deferred
- SEO/GEO assessment as a paired audit dimension — this came up because of a specific client request to combine UX and SEO/GEO in one deck, not a standing need for this skill. Likely to become its own companion skill for parallel-track audits (UX + SEO/GEO SME) rather than folded into this one.

## [1.0.0] - 2026-02

Initial skill release: 8 audit dimensions, WCAG 2.1 AA + NN/g heuristics + healthcare-specific criteria, severity scale, scoring model, Claude Code / Cowork / Chat workflows, report templates.
