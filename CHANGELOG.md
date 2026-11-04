# Changelog

All notable changes to this skill are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [1.5.5] - 2026-11-04

Phase 6 of the v1.5 plan: workflow checklist, validator, and evals. The QA gate is now code, and the skill's accuracy is measurable.

### Added
- **Progress checklist** at the top of SKILL.md: 9 steps from scope to rendered PDF, to copy into working notes for each audit.
- **`scripts/validate-findings.js`**: checks `findings.csv` against `audit-meta.json` and exits 1 on any error. Each message names the finding and the fix (`UH-003: Scope "Sitewide" not allowed; write it as "Site-wide"`). Checks:
  - allowed values (Severity, Scope, Dimension, Standard, Verification) and empty required fields;
  - unique IDs and a prefix that matches the dimension (prefix table added to SKILL.md);
  - At a Glance is one sentence and doesn't repeat the Observation (exact, contained, or 70%+ word overlap);
  - no placeholders (`[Capitalized ...]` template text, "lorem", "TBD"/"TODO", the example file's instruction text);
  - no Inferred findings;
  - priority inputs 1–5 and consistent with Priority Score;
  - WCAG criteria valid (not 4.1.1) and consistent with Standard; accessibility findings cite one;
  - metadata: narrative and roadmap filled in, `dimensionsEvaluated` covers every finding, **`complianceBaseline` required when accessibility is in scope** (this closes the gap noted in Phase 3), `keyTasks` and `criteriaResults` consistent with the findings.
  
  Warnings (don't fail): Site-wide findings without an Instances list, possible duplicates, an unconfirmed baseline, a single key task.
- SKILL.md **Validate** section: run it, fix, and repeat; generate deliverables only once it passes. The Word workflow's first step now includes it.
- **`evals/`**:
  - `carepath/`: the CarePath sample in full v1.5 form, with `expected-scores.json`.
  - `bad-before/`: an answer key of 44 issues from the W3C BAD "before" annotations (Home, News, Tickets, Survey, plus the Template page's site-wide issues); `also-valid.csv` for real issues the key omits; `pages.json`; scored runs; `baseline.json` floors.
  - `score.js`: recall, precision (lower bound), and duplicate rate against an answer key, with a `Matches` column for hand grading and `--verbose` for the match map; `--scores` checks a sample's scores; `--all` runs everything and fails on any regression below the floors.
  - `automated-baseline.js`: turns `capture-site.js` output into an automation-only findings CSV.
  - `README.md`: how to run the evals, score a full skill run blind, and add a real client page later (no real-client eval is included).
- **`package-skill.sh`**: builds `dist/ux-audit.zip` for upload to Claude.ai / Cowork.

### Changed
- `docx-report-template.js` can be required as a module (exports its parsing and scoring functions; the CLI runs only when it's executed directly). The `docx` package loads lazily, so the validator works before `npm install`; the builder gives a clear error instead of a stack trace.
- SKILL.md description rewritten in the third person ("Conducts…"), mentioning task walkthroughs, evidence, Severity × Scope, and the Word deliverable (803 characters).
- Removed history wording from SKILL.md ("replaces the old flat formula", "pre-v1.5").
- README: workflow diagram, validator, Evals section, repo structure, and packaging.

### Verified
- **Validator, planted errors:** 21 planted errors across the CSV and metadata, each caught with a specific message (bad Scope, lowercase Severity, empty Recommendation, duplicate ID, prefix mismatch, two-sentence At a Glance, At a Glance copying the Observation, "TBD", template placeholder, Inferred, EaseOfFix 7, Priority Score disagreeing with inputs, Standard not matching the criterion, instruction-text narrative and roadmap focus, empty timeframe, missing complianceBaseline, unknown task result, unknown finding in keyTasks, Pass conflicting with a finding, 4.1.1).
- **Validator, clean sample:** `evals/carepath` passes with 0 warnings. The shipped example fails only on its intentional Inferred HC-003.
- **Evals (`node evals/score.js --all`), baseline:**
  - CarePath: 87.5%; 43 / 38.5 / 48.5 / 45; Top 5 ACC-001, UH-003, MOB-001, UH-001, ACC-002. PASS.
  - W3C BAD before, automation-only run (axe-core 4.14.0 + capture keyboard checks, 12 findings): **recall 20.5%** (9/44; 24.3% of the 37 A/AA items), **precision 100%** (12/12; 8 match the key, 4 are also-valid: page language, target size, landmarks), **duplicate rate 0%**.
  - The score.js checks of duplicate detection, unmatched findings, and the `Matches` column behave as documented on a planted run.
  - A full skill run should be scored blind in a fresh session (see `evals/README.md`); none is recorded yet.
- Builder output for the CarePath fixture is text-identical to v1.5.4 after the module refactor; the example renders unchanged (Quick Look).
- The packaged zip, unpacked with no `node_modules`, runs the validator; the builder prints the install hint.

## [1.5.4] - 2026-11-04

Phase 5 of the v1.5 plan: task walkthroughs and the missing reference files. Interaction problems that a static capture can't see are now part of every audit, and every dimension has concrete criteria.

### Added
- **Audit Setup** section in SKILL.md: settle pages, `dimensionsEvaluated`, 2–3 **key tasks**, and the **compliance baseline** with the user before reviewing. The compliance-baseline question addresses the earlier gap where nothing prompted the auditor for it. If the client hasn't confirmed, record "Not confirmed — client to advise".
- **Task walkthroughs.** Each key task is performed live, the obvious way first, then with deliberate errors (empty submit, invalid input, Back and refresh mid-flow), keyboard-only, and at phone width. Walkthrough findings default to `Observed live`, with the steps in Evidence. Never complete an action with real-world effects without a test account.
- `references/task-walkthroughs.md`: defining tasks, the deliberate-error script, what to look for, recording findings, tools for Cowork / Claude Code / chat (including blocking non-GET requests so nothing is sent), and the safety rule.
- `references/evaluation-criteria.md`: concrete checks for Visual Design, Information Architecture, Content & Microcopy, User Flows, and Mobile/Responsive, with a table of contents.
- `references/healthcare-checklist.md`: ISI and fair balance (visible, persistent where required, comparable prominence), PI/IFU links, trust signals (credentials, review dates, sources), health literacy against PEMAT understandability and actionability as well as reading level, consent/privacy banner clarity and health information in forms (UX only, no legal conclusions), emergency guidance.
- **`keyTasks` in `audit-meta.json`** (`task`, `start`, `success`, `result`, `findings`, `notes`). The Word builder prints a "Key tasks walked through" table in Appendix A. It warns when `keyTasks` is missing or not an array, a result isn't one of `Completed | Completed with difficulty | Not completed | Not attempted`, a listed finding isn't in the CSV, a task has no description, or a task that wasn't completed cleanly lists no findings.
- The example metadata has three key tasks linked to the example findings; the report template has a key-tasks table.

### Changed
- SKILL.md Audit Dimensions starts with a table linking every dimension to its reference file (one level deep). Each dimension section links its reference.
- **Information Architecture: the fixed click-count rule is removed.** Findability is now "can users find key content, and does each step give a clear scent?"
- **Reading level: 6th–8th grade is the single target** for patient-facing content. Content & Microcopy said "8th grade"; it now matches Healthcare-Specific.
- Healthcare-Specific bullets in SKILL.md and README updated to match the checklist.
- README: dimensions, a key-task walkthroughs section, and the repo structure.

### Back-compat
- Metadata without `keyTasks` builds with one warning and no Appendix A task table.

### Verified
- **Live walkthrough on a real site** (pivotpump.com, task "As a patient, ask how to get Pivot", homepage → Get Pivot chooser → Patient Contact Form). Every non-GET request was blocked; nothing was submitted. It produced 5 interaction findings, all `Observed live` with steps in Evidence, including:
  - empty submit flags only First Name in a brief browser tooltip, with Last Name, Email and Message unmarked and no persistent error text;
  - form fields show no focus change except the caret;
  - the Phone field accepts "not a number";
  - the main Get Pivot button adds a chooser screen;
  - no privacy note, response time, or urgent-help notice on a patient health form.
  
  The findings stay out of the repo (no real client page in evals). Built into a test report: the Appendix A task table renders, checked visually (Quick Look).
- keyTasks edge cases (bare string, unknown result, unknown finding ID, difficulty with no findings, missing task, non-array, missing field) each give the expected warning.
- CarePath-equivalent CSV still 87.5%, Top 5 unchanged; the example still builds with only the intended HC-003 Inferred warning.
- The "8th grade" grep finds only the 6th–8th target, and the click-rule grep finds nothing outside the improvement plan.

## [1.5.3] - 2026-11-04

Phase 4 of the v1.5 plan: scoring correctness. Scores mean the same thing regardless of how big the audit was. The Severity × Scope deduction values are unchanged.

### Fixed
- **Clean dimensions no longer disappear.**
  - New `audit-meta.json` field `dimensionsEvaluated`. Every listed dimension appears in the scores and the overall average, scoring 50/50 if it has no findings ("Evaluated — no findings in this dimension." in Detailed Findings).
  - Any of the 8 standard dimensions not listed shows as "Not evaluated" in the At a Glance table and is left out of the average.
  - Names match loosely (`"visual design"` → Visual Design). A finding in an unlisted dimension is scored as evaluated, with a warning.
  - Without `dimensionsEvaluated`, the builder keeps the old behavior and warns.

### Added
- **Stored Priority Score inputs.** New CSV columns `UserReach`, `BusinessImpact`, `EaseOfFix` (whole numbers 1–5; ease 5 = easiest).
  - The builder computes `priority = sev×3 + reach×2 + impact×2 + ease×1` (Critical 4, Major 3, Minor 2, Cosmetic 1).
  - Missing or invalid inputs fall back to the `Priority Score` column, with a warning naming the bad values.
  - When both are present and disagree, it warns and uses the computed value. A finding with no priority at all is warned and ranked last.
- Appendix B shows each finding's priority and its inputs (`35 (S4 R5 I4 E5)`, or `(given)` when taken from the column).
- Appendix B states how many dimensions were averaged and which were not evaluated.
- **SKILL.md "Audit Breadth and Comparability"**:
  - The consolidation rule keeps scores from scaling with page count.
  - Audits with different dimension or page sets aren't directly comparable; keep scope fixed for re-audits.

### Changed
- SKILL.md Scoring: the Priority Score section documents the stored inputs, fallback and range (8–37; it said 1–40, which the formula can't produce). The Overall Health formula now counts evaluated dimensions. The Word workflow mentions `dimensionsEvaluated` and the inputs.
- `assets/audit-meta.example.json` gains `dimensionsEvaluated` (all 8, with a comment). `assets/findings.example.csv` gains the three input columns.
- **The example is now a realistic full audit.** With all 8 dimensions evaluated, the old 2-finding example scored 97.5% ("Excellent"), which misrepresented a typical result. `assets/findings.example.csv` now has 23 findings across all 8 dimensions of a fictional healthcare site (3 Critical, 13 Major, 6 Minor, 1 Cosmetic), and the example metadata has a matching narrative, roadmap, and `criteriaResults`. One finding (HC-003) is deliberately `Inferred — needs human check` to show what an unverified finding looks like.
- The report and executive-summary templates list Healthcare-Specific, explain Not evaluated / 50/50, and label the total as an evaluated-dimensions %.
- README scoring and Word-pipeline sections updated.

### Back-compat
- An old CSV without input columns builds with one warning and uses `Priority Score` as before. Old metadata without `dimensionsEvaluated` scores exactly as v1.5.2, with a warning.

### Verified
- CarePath-equivalent CSV:
  - `dimensionsEvaluated` = the 4 sampled dimensions: **87.5%** exactly. 43 / 38.5 / 48.5 / 45; the other 4 shown as Not evaluated.
  - Adding a fifth evaluated dimension with no findings (Visual Design): **90%**, Visual Design shown at 50 / 50.
  - No `dimensionsEvaluated`: 87.5% with the fallback warning.
- Computed priorities match hand calculation:
  - ACC-001: 4×3+5×2+4×2+5 = 35
  - MOB-001: 3×3+5×2+4×2+3 = 30
  - ACC-003: 2×3+2×2+3×2+2 = 18
  - CON-001: 2×3+1×2+2×2+3 = 15
  - All 8 rows reproduce the original Priority Score column, so the Top 5 order is unchanged (ACC-001, UH-003, MOB-001, UH-001, ACC-002).
- Planted disagreement (column 30 vs computed 22) is warned and 22 used. Planted EaseOfFix = 7 is warned and falls back to the column.
- Example files: 81.8% (Good) across 8 evaluated dimensions, with Accessibility at 26.5 / 50 (Poor). Top 5: ACC-001, FLOW-001, ACC-003, IA-001, UH-003. Appendix D: 8 Fail, 3 Pass, 2 Needs manual check, 1 N/A. The only warning is the Inferred one for HC-003, and `--strict` exits 1 on it, as intended.
- Rendered and inspected (Quick Look): At a Glance table with Not evaluated rows; Appendix B priority column and breadth note.

## [1.5.2] - 2026-11-03

Phase 3 of the v1.5 plan: accessibility baseline. Audits now evaluate against **WCAG 2.2 AA**, and every accessibility finding is labeled to show whether it also fails the **WCAG 2.1 AA** legal baseline (decision D2).

### Added
- **`references/accessibility-checklist.md` rewritten for WCAG 2.2 AA:**
  - All 55 A/AA success criteria, each tagged `[SC · Level · version introduced]`.
  - The six criteria new in 2.2: 2.4.11 Focus Not Obscured (Min), 2.5.7 Dragging Movements, 2.5.8 Target Size (Min), 3.2.6 Consistent Help, 3.3.7 Redundant Entry, 3.3.8 Accessible Authentication (Min).
  - 4.1.1 Parsing removed, with a note on where real markup problems belong instead.
  - Automation hints pointing to `capture-site.js` fields and axe rules, a Standard-labeling guide, and a target-size table.
  - A **Needs manual verification** section: alt-text quality, focus-order sense, keyboard traps in custom widgets, screen reader output, error announcement, reflow at 400%/320px, focus not obscured, authentication/redundant entry, axe `incomplete` items.
  - Table of contents.
- **`Standard` finding field / CSV column:** `WCAG 2.1 AA` (legal baseline) | `WCAG 2.2 AA (new)` | `Best practice`. Shown under Reference in the Word doc, with "(legal baseline)" appended for 2.1.
- **`references/regulatory-context.md`** (undated):
  - The HHS Section 504 rule requires WCAG 2.1 AA from HHS-funded recipients. Whether it applies, and which compliance date applies, depend on the client and are checked at audit time.
  - Short notes on ADA Title II/III, EN 301 549 and client policy, with a not-legal-advice framing.
  - New `audit-meta.json` field `complianceBaseline`.
- **Appendix D, WCAG 2.2 AA Conformance**, in the Word report:
  - Lists all 55 criteria with Pass / Fail / Needs manual check / N/A / Not tested, a summary line, and a count of failed criteria in the 2.1 baseline vs new in 2.2.
  - Fail rows are derived from findings: the criterion number in Reference, or an optional `WCAG SC` column. Best-practice findings never create a Fail.
  - Pass / N/A / Needs manual check come only from `audit-meta.json` `criteriaResults`. Anything not listed is Not tested.
  - The script never writes Pass on its own.
- `scripts/wcag22-criteria.js`: the shared WCAG 2.2 A/AA list (number, name, level, version introduced).

### Changed
- **Touch-target guidance fixed** in SKILL.md (dimensions 2 and 7), the checklist and README. Below 24×24 CSS px fails WCAG 2.5.8 (AA); 24–43px is a best-practice finding (44px recommended, usually Minor). The incorrect "44px AA minimum" claim is gone.
- SKILL.md: dimension 2 is now WCAG 2.2 AA and links the regulatory note; the finding format adds `Standard` with definitions; the Word workflow documents Appendix D, `criteriaResults` and `complianceBaseline`. The description now says WCAG 2.2 AA.
- Default methodology line and `assets/audit-meta.example.json` updated to WCAG 2.2 AA. The example metadata gains `complianceBaseline` and a sample `criteriaResults`.
- `assets/findings.example.csv` gains a `Standard` column; `assets/audit-report-template.md` gains Standard, a Compliance Baseline line, and an Appendix D table.

### Warnings (never fail the build)
- **Results:**
  - An auditor Pass / Needs manual check conflicts with a failing finding (reported as Fail).
  - A criterion is marked Fail with no finding behind it.
  - A `criteriaResults` entry has an unknown criterion, 4.1.1, an unrecognized result, or a finding ID not in the CSV.
- **Standard:**
  - The Standard label doesn't match the cited criteria.
  - An accessibility finding has no Standard and cites no criterion, or cites no criterion when it isn't Best practice.
  - `complianceBaseline` is missing on an audit with accessibility findings.
- **Back-compat:**
  - A CSV without a `Standard` column builds with a warning, and Standard is filled in from cited criteria.
  - A legacy CSV that used `Standard` as its Reference header is recognized by value and builds as before.

### Verified
- Checklist ↔ script cross-check: 55 tagged items, 55 unique criteria; every number, level and version matches `wcag22-criteria.js`.
- `grep` for 44px claims: every remaining mention presents 44px as a recommendation; no "44px … AA" claims.
- Old-format CarePath-equivalent CSV: still 87.5%; 43 / 38.5 / 48.5 / 45; Top 5 ACC-001, UH-003, MOB-001, UH-001, ACC-002. No v1.4 line removed. The only changed line is the methodology bullet from the updated example metadata; additions are Standard lines and Appendix D.
- Edge-case fixture (11 findings plus a `criteriaResults` with planted errors):
  - 30px target labeled Best practice cites 2.5.8 and creates no Fail.
  - Pass on 2.4.7 overridden to Fail.
  - Fail on 1.3.1 with no finding warned.
  - 9.9.9, 4.1.1, "Maybe" and ACC-999 each warned.
  - Mismatched Standard on ACC-005 warned.
  - The summary counts (5 Fail · 2 Pass · 1 N/A · 47 Not tested; 4 baseline · 1 new) match a hand count.
- Rendered (Quick Look) and inspected: Standard under Reference; Appendix D table with colored results and "new in 2.2" marks.
- `assets/findings.example.csv` + example metadata build with no warnings. `--strict` still exits 1 on an Inferred finding.

## [1.5.1] - 2026-11-03

Phase 2 of the v1.5 plan: fix `capture-site.js`. Capture is now reliable. Screenshots still default to off (decision D3), and deliverable screenshots stay manual.

### Fixed
- **Removed Puppeteer APIs.** `page.waitForTimeout()` (removed in v22) is replaced by `waitForNetworkIdle()` plus a `waitForFunction` on `document.fonts.ready`. `headless: 'new'` is dropped; the default is used.
- **Real mobile capture.** Mobile is a separate load using `puppeteer.KnownDevices` (`--mobile-device`, default "iPhone 13") through `page.emulate()`, followed by a reload. Before, the desktop page was just resized to 375px after loading, so the mobile layout usually never appeared.
- **Label check.** `hasLabel` counts `label[for]` (with text), a wrapping `<label>`, `aria-labelledby` (targets must exist and have text), `aria-label`, and `title` as a last resort. Button-type inputs are named by `value`. Each field records `labelSource`.
- **Focus check.** The old `hasVisibleFocus` used `getComputedStyle(el, ':focus')`, which can't read focus styles, so it was meaningless and is removed. The new `keyboardFocus` test presses Tab N times (`--tab-count`, default 25) and compares each element's focused and unfocused outline, box-shadow, border, background and color. It also records `focusLost`: Tab stops that drop focus back to the page (e.g. `onfocus="blur()"`), naming the element. Passing through `<body>` at the end of the page isn't counted.
- **axe-core is injected from the local npm package** instead of a CDN, via `page.evaluate`, which a page's Content-Security-Policy can't block. It runs with `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice`. Each violation keeps up to 10 node selectors with an HTML snippet. `incomplete` results are kept with their selectors as a manual-review list.
- **Error handling.** Every step on a page is wrapped. A failing step is recorded as `{step, error}` in `analysis.json`, the remaining steps still run, and `capture-summary.json` and the console list every failed step.
- `--skip-a11y` was parsed but ignored. It now skips axe.

### Added
- `scripts/package.json` (+ lockfile) pinning `puppeteer` 25.14.0, `axe-core` 4.14.0 and `docx` 9.10.0. Set up with `cd scripts && npm install`.
- Screenshot reliability for `--with-screenshots`: the page is scrolled in steps to trigger lazy-loaded content, with a wait for images before the full-page capture. `--dismiss "<sel>,<sel>"` clicks consent/cookie banners. Each image's viewport, user agent and timestamp are recorded in `analysis.json`.
- Images: `imagesMissingAlt` (no alt attribute) is reported separately from `imagesEmptyAlt` (`alt=""`, valid for decorative images), both with selectors.
- Mobile checks: viewport meta and horizontal overflow from the device load.
- `.gitignore` (`node_modules/`, `.DS_Store`, `audit-output/`).

### Changed
- SKILL.md Known Limitations and README Known Limitation are rewritten. The capture bugs are fixed and `--with-screenshots` is reliable for reference, but deliverable screenshots are still captured and annotated by the auditor. Removed the wording that blamed screenshot problems on unknown causes. Added a note that alt-text quality, axe `incomplete` items and focus-order sense need human review.
- SKILL.md Environment Setup uses the pinned install and adds a "Reading `analysis.json`" guide. The README Claude Code environment section and repo structure are updated. "Fix and re-enable automated screenshot capture" is removed from the README Roadmap.

### Verified
- **W3C BAD "before"** (Home, News, Tickets, Survey), freshly installed pinned Puppeteer, `--with-screenshots`: 0 failed steps.
  - Unlabelled fields per page: 1 / 1 / 1 / 13, the same as axe `label` + `select-name` node counts. They include BAD Survey annotations 03 (radio `res` not associated with its label) and 04 (select `cc` missing caption).
  - Missing-alt images per page: 33 / 39 / 26 / 24, the same as axe `image-alt`. They include BAD Tickets annotation 01 (`headline_ticket_offers.gif`).
  - BAD Home annotation 07 (linked image with empty alt) is caught by axe `link-name`.
  - BAD annotations about *incorrect or inadequate* alt text can't be detected automatically. They're expected manual-review items.
  - The focus test flags the nav links with `onfocus="blur();"` as `focusLost` on all four pages.
- **Local fixture page** with known traps:
  - `outline:none` link and button: flagged as having no focus indicator.
  - box-shadow focus ring: detected as an indicator.
  - self-blurring link: named in `focusLost`.
  - end-of-page wrap: not counted as a loss.
  - dangling `aria-labelledby`, placeholder-only field, empty `<label>`: all reported unlabelled; the five valid label methods are recognized.
- **Real client page** (pivotpump.com, `--with-screenshots --dismiss '[data-consent="declined"]'`): 0 failed steps. The mobile image (390×844 @3x, iPhone UA) shows the actual mobile layout with the hamburger nav; the desktop image shows the full nav. The consent banner was dismissed. axe violations are saved with selectors (9 rules), plus 2 incomplete rules.
- **Run without `--with-screenshots`**: only `analysis.json` written, no images.
- **Unreachable page in a multi-page run**: `desktop:load` and `mobile:load` are recorded as failed steps, the next page still captured, and the summary lists both failures.
- **Phase 1 regression**: the Word builder on the pinned docx 9.10.0 still reproduces the v1.4 CarePath numbers (text identical to the baseline).

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
