# UX Audit Skill — v1.5 Improvement Plan

> **How to use this plan:** Hand this file to Claude with an instruction like
> *"Implement Phase 1 of IMPROVEMENT_PLAN_v1.5.md in my ux_audit_tool folder."*
> Work one phase at a time. Each phase ends with a verification step and a version bump. Don't start the next phase until the current one passes.

---

## Context

- **Repo:** `ux_audit_tool` (GitHub: `nashkell/ux_audit_tool`, branch `main`)
- **Current version:** 1.4.1 (CHANGELOG). The SKILL.md footer still says 1.4.0, which is a known mismatch.
- **Current structure:**
  ```
  SKILL.md
  README.md
  CHANGELOG.md
  references/heuristics-checklist.md
  references/accessibility-checklist.md
  assets/audit-report-template.md
  assets/executive-summary-template.md
  assets/findings.example.csv
  assets/audit-meta.example.json
  scripts/capture-site.js
  scripts/docx-report-template.js
  ```
- **What works and must not break:**
  - Severity × Scope deduction table
  - At a Glance writing guidance
  - Roadmap Phase Naming guidance
  - CSV-driven Word builder
  - CarePath sample results: 87.5% overall; Accessibility 38.5, Usability Heuristics 43, Content & Microcopy 48.5, Mobile/Responsive 45; Top 5 order ACC-001, UH-003, MOB-001, UH-001, ACC-002
- **Why v1.5:** research and a code review found that the skill's main weakness is accuracy and evidence, not structure:
  - AI heuristic evaluations produce false positives (about 24% in one GPT-4o study) and report the same issue repeatedly.
  - They are weakest on heuristics that depend on interaction.
  - `capture-site.js` has bugs that likely explain the screenshot problems.
  - The accessibility baseline is out of date (WCAG 2.1, plus an incorrect 44px "AA" touch-target claim).

## Ground rules for every phase

1. **Scope discipline.** No SEO/GEO and no agent orchestration in this plan. Both stay deferred to separate tracks.
2. **Don't change the Severity × Scope deduction values.** Phase 4 changes *what* gets scored, not the table itself.
3. **Back-compat.** An old `findings.csv` (without the new columns) must still build a Word doc. Missing new fields produce warnings, not failures.
4. **Verify before declaring done:**
   - Run the scripts.
   - Render any docx to PDF (`soffice --headless --convert-to pdf`, then `pdftoppm -jpeg -r 100`) and look at the pages.
   - Confirm numbers with `pdftotext -layout`.
5. **Each phase ends with:**
   - a CHANGELOG entry
   - a version bump in the SKILL.md footer
   - updated README sections where behavior changed
   - **its own branch and pull request** (decision D6):
     - Branch from an up-to-date `main`, named `v1.5/phase-N-<short-name>` (e.g. `v1.5/phase-1-evidence`).
     - Commit, push the branch to `origin`, and open a PR against `main` with `gh pr create`. Title it `v1.5.x — Phase N: <name>`. The PR description is that phase's CHANGELOG entry plus the verification results.
     - **Never merge.** Buddy reviews and merges. Don't start the next phase until the previous PR is merged and `main` is pulled.
     - If `gh` isn't installed or authenticated, push the branch and give Buddy the GitHub compare link instead.
6. **Keep SKILL.md under ~500 lines.** Move detail into `references/` files linked directly from SKILL.md (one level deep, no chains).
7. **No date-stamped wording** in SKILL.md (e.g. "as of July 2026"). Put history in the CHANGELOG.

---

## Phase 1 — Evidence, verification, and consolidation (→ v1.5.0)

**Goal:** every finding shows what it's based on and how it was confirmed. Repeated issues are consolidated.

### Tasks

1.1 **Extend the finding format in SKILL.md** with three new fields:
```
Evidence:     [URL(s); CSS selector or element description; axe rule ID if any; screenshot ref if any]
Verification: [Automated-confirmed | Observed live | Inferred — needs human check]
Instances:    [Count + list of pages, when the same issue appears in more than one place]
```
- Define each Verification value in one line.
- Add the rule: **findings marked "Inferred — needs human check" may not appear in a client deliverable until a human changes the value.**

1.2 **Add a Consolidation rule** to SKILL.md, under Scope of Impact:
- The same root issue on **3 or more pages** (decision D1), or in a shared component, becomes **one** finding with Scope = Site-wide, and every location is listed in Instances.
- Don't file one finding per page for a template-level problem.
- Don't report a problem you didn't observe. If a behavior can't be checked from what was captured (e.g. a static screenshot), either test it live or mark it Inferred.

1.3 **Update `assets/findings.example.csv`** with the columns `Evidence`, `Verification`, `Instances`, and fill them in for the example rows.

1.4 **Update `scripts/docx-report-template.js`:**
- Read the new columns, using the same loose `normKey` matching.
- Show Evidence and Verification in each finding block (small, muted text under Reference).
- If any finding has Verification = Inferred, **print a warning listing those IDs**. Add a `--strict` flag that makes it exit non-zero instead.

1.5 **Update `assets/audit-report-template.md`** with the new fields.

### Done when
- An old-format CSV (the current CarePath sample) still builds and reproduces the exact v1.4 numbers.
- A new-format CSV renders Evidence and Verification in the PDF.
- `--strict` with an Inferred row exits non-zero and names the IDs.

---

## Phase 2 — Fix `capture-site.js` (→ v1.5.1)

**Goal:** reliable data capture. Screenshot capture gets fixed so `--with-screenshots` works properly, but it **stays off by default** (decision D3). The auditor keeps capturing and annotating deliverable screenshots by hand.

### Tasks

2.1 **Replace the removed Puppeteer API:**
- `page.waitForTimeout(1000)` was removed in Puppeteer v22. Replace it with `page.waitForNetworkIdle()` plus a `waitForFunction` that checks `document.fonts.ready`.
- Remove `headless: 'new'` (use the default).
- Pin a tested Puppeteer version in a new `scripts/package.json`.

2.2 **Real mobile capture:**
- Use `puppeteer.KnownDevices` (e.g. an iPhone profile) through `page.emulate()`, then **reload the page** before capturing mobile.
- Capture desktop and mobile as separate loads.

2.3 **Screenshot reliability:**
- Scroll the page in steps to trigger lazy-loaded images before a full-page capture.
- Add an optional `--dismiss` selector list for cookie and consent banners.
- Record the viewport, user agent, and timestamp in `analysis.json` alongside each image.

2.4 **Fix the broken accessibility data:**
- `hasLabel` should also count a wrapping `<label>`, `aria-label`, and `aria-labelledby` (pointing at an element that exists and has text), plus `title` as a last resort.
- Remove the `hasVisibleFocus` check: `getComputedStyle(el, ':focus')` can't read focus styles. Replace it with a real test: press Tab N times, and after each press take the active element's computed outline/box-shadow and compare it to its unfocused state.

2.5 **axe-core:**
- Inject axe from the local `axe-core` npm package (or use `@axe-core/puppeteer`) instead of the CDN, so sites with strict security settings can't block it silently.
- Run with tags `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice`.
- **Keep `incomplete` results**, with their selectors, in `analysis.json`. These are items for manual review.
- Save each violation's node selectors (first 10), not just a count.

2.6 **Error handling:** every step on a page is wrapped. One failing step records `{step, error}` and the rest still run. The summary lists any step that failed.

2.7 **Keep screenshots off by default** (decision D3). Update Known Limitations in SKILL.md and README: the capture bugs are fixed and `--with-screenshots` is reliable for the auditor's own reference, but deliverable screenshots are still captured and annotated manually by the auditor. Remove the wording that blames screenshot inaccuracy on unknown causes.

### Done when
- The script runs end-to-end with a freshly installed, pinned Puppeteer on the W3C BAD "before" pages (https://www.w3.org/WAI/demos/bad/) and one real client page.
- Run with `--with-screenshots`: the mobile screenshot shows the actual mobile layout (hamburger nav etc.), confirmed by viewing the image. A run without the flag produces no images.
- `analysis.json` contains axe violations with selectors, incomplete items, the label check, and focus-test results.
- On BAD "before", the unlabelled-field and alt-text results match the barriers BAD annotates.

---

## Phase 3 — Accessibility baseline: WCAG 2.2 AA (→ v1.5.2)

**Goal:** a current, correct baseline, with the legal minimum labeled separately. Audits evaluate against **WCAG 2.2 AA**, and every accessibility finding is labeled to show whether it also fails the **WCAG 2.1 AA** legal baseline (decision D2).

### Tasks

3.1 **Rewrite `references/accessibility-checklist.md` for WCAG 2.2 AA:**
- Add 2.4.11 Focus Not Obscured (Min), 2.5.7 Dragging Movements, 2.5.8 Target Size (Min, 24×24 CSS px), 3.2.6 Consistent Help, 3.3.7 Redundant Entry, and 3.3.8 Accessible Authentication (Min).
- Remove 4.1.1 Parsing.
- Tag each item with its success criterion number and level.
- Add a **"Needs manual verification"** section: things automation can't settle, such as alt text quality, whether focus order makes sense, keyboard traps inside custom widgets, what a screen reader announces, error messages being announced, and reflow at 400%/320px.

3.2 **Fix the touch-target guidance** everywhere (SKILL.md dimensions 2 and 7, the checklist):
- Below 24×24 → WCAG 2.2 AA failure.
- 24–43px → best-practice finding (44px recommended; often Minor).

3.3 **Add a `Standard` value** to findings: `WCAG 2.1 AA` (legal baseline), `WCAG 2.2 AA (new)`, or `Best practice`. Also add it as a CSV column.

3.4 **Add a short, undated "Regulatory context" note** to a new `references/regulatory-context.md`:
- The HHS Section 504 rule requires WCAG 2.1 AA from HHS-funded recipients.
- Which deadline applies depends on the client and should be checked at audit time.
- Whether it applies depends on the client (a hospital or clinic usually; a device manufacturer may not).
- Instruct: confirm which standard applies per client in `audit-meta.json` (new field `complianceBaseline`).

3.5 **Report output:** a small table in the appendix with each WCAG criterion that was checked and its result (Pass / Fail / Not tested / Needs manual check), following the W3C BAD evaluation report format.

### Done when
- No remaining "44px … AA" claims (grep the whole repo).
- The checklist covers every WCAG 2.2 A/AA criterion with a tag.
- The sample CSV includes a Standard column and the docx renders it.

---

## Phase 4 — Scoring correctness (→ v1.5.3)

**Goal:** the scores mean the same thing regardless of how big the audit was.

### Tasks

4.1 **Fix dimensions that disappear when clean:**
- Add `dimensionsEvaluated: [...]` to `audit-meta.json`.
- Every evaluated dimension appears in the scores and the overall average, scoring 50/50 if it has no findings.
- Dimensions not evaluated are listed as "Not evaluated" and left out of the average.
- If `dimensionsEvaluated` is missing, fall back to the current behavior and print a warning.

4.2 **Store the Priority Score inputs:**
- Add CSV columns `UserReach`, `BusinessImpact`, `EaseOfFix` (1–5).
- The script computes `priority = sev×3 + reach×2 + impact×2 + ease×1`, mapping severity Critical=4 … Cosmetic=1.
- If the inputs are missing, fall back to the existing `Priority Score` column.
- If both are present and disagree, print a warning.

4.3 **Document the effect of audit breadth** in SKILL.md Scoring: the consolidation rule (Phase 1) keeps scores comparable across audits of different sizes, and audits of different scope shouldn't be compared directly.

### Done when
- The CarePath sample with `dimensionsEvaluated` listing only the 4 sampled dimensions reproduces 87.5% exactly.
- Adding a fifth evaluated dimension with no findings raises the overall score (expected 90.0%) and shows 50/50.
- Computed priorities match a hand calculation for at least 3 rows.

---

## Phase 5 — Task walkthroughs and the missing reference files (→ v1.5.4)

**Goal:** cover the interaction-dependent heuristics AI tends to miss, and give dimensions 3–8 concrete criteria.

### Tasks

5.1 **Task walkthroughs:**
- Add an "Audit setup" step: define 2–3 key user tasks per audit (stored in `audit-meta.json` as `keyTasks`).
- During review, actually perform each task in the browser, including deliberate errors (empty submit, invalid input, back button, refresh mid-flow).
- Findings from walkthroughs default to Verification = Observed live.

5.2 **Add `references/evaluation-criteria.md`** with concrete checks for Visual Design, Information Architecture, Content & Microcopy, User Flows, and Mobile/Responsive. **Remove the "3-click rule"** and replace it with "can users find key content, and does each step give a clear scent?"

5.3 **Add `references/healthcare-checklist.md`:**
- ISI/safety information: visible, persistent where required, risk given comparable prominence to benefits.
- Prescribing information / IFU links.
- Trust signals: credentials, review dates, sources.
- Health literacy: assess against PEMAT understandability/actionability, not reading level alone. Use **6th–8th grade** as the single reading-level target for all patient-facing content (decision D4), and replace the current mismatch ("8th grade" in Content & Microcopy vs "6th–8th" in Healthcare-Specific) everywhere it appears.
- Consent/privacy banner clarity as a trust-signal UX check (UX only, no legal conclusions).

5.4 **Link all new references directly from SKILL.md** (one level deep). Add a table of contents to any reference file over 100 lines.

### Done when
- A walkthrough of one task on a real site produces at least one interaction finding with a filled-in Evidence field.
- Every dimension 1–8 has a linked reference file.
- `grep -rn "8th grade"` only finds the 6th–8th target.
- `grep -ri "3-click"` returns nothing.

---

## Phase 6 — Workflow checklist, validator, and evals (→ v1.5.5)

**Goal:** turn the QA gate into code, and make the skill's quality measurable.

### Tasks

6.1 **Add a copyable progress checklist** at the top of SKILL.md:
```
Audit progress:
- [ ] 1. Scope: pages, key tasks, dimensions, compliance baseline (audit-meta.json)
- [ ] 2. Capture: run capture-site.js or live review
- [ ] 3. Evaluate each dimension against its reference file
- [ ] 4. Walk through key tasks
- [ ] 5. Consolidate duplicates (consolidation rule)
- [ ] 6. Verify: resolve every "Inferred" finding
- [ ] 7. Validate: run validate-findings.js until it passes
- [ ] 8. Generate the report, summary, CSV, and Word doc
- [ ] 9. Render to PDF and inspect
```

6.2 **Add `scripts/validate-findings.js`:**
- Checks `findings.csv` against `audit-meta.json`:
  - Severity and Scope use allowed values.
  - Required fields aren't empty.
  - IDs are unique and match the dimension prefix.
  - At a Glance is a single sentence and doesn't repeat the Observation.
  - No placeholder text (`[`…`]`, "lorem", "TBD").
  - No Inferred findings remain.
  - Priority inputs are in range.
  - Narrative and roadmap phases are filled in.
- Errors are specific, e.g. `UH-003: Scope "Sitewide" not allowed; use Site-wide | Page-level | Element-level`.
- Exits non-zero on any error.
- SKILL.md says: **run it, fix, and repeat; only generate deliverables once it passes.**

6.3 **Evals (`evals/` folder):**
- `evals/bad-before/`: an expected-findings list derived from the W3C BAD "before" annotations (Home, News, Tickets, Survey).
- `evals/carepath/`: the existing sample, with expected scores.
- **No real client page for now** (decision D5). Leave an `evals/README.md` note explaining how to add one later (a URL plus a hand-verified expected-findings CSV), but don't create the folder.
- `evals/score.js`: compares a run's `findings.csv` with the expected list and reports:
  - **recall:** expected issues found
  - **precision:** reported issues that are real
  - **duplicate rate**
- README: run the evals before releasing any version and record the results in the CHANGELOG.

6.4 **Housekeeping:**
- Sync the SKILL.md footer with the CHANGELOG.
- Make the description third person ("Conducts…"), mention Severity × Scope and Word output, and keep it under 1,024 characters.
- Remove date-stamped wording.

6.5 **Reinstall:** package the skill and update the copy installed in the Claude account (it currently lags the repo).

### Done when
- The validator catches deliberately planted errors in a test CSV, each with a specific message, and passes the clean sample.
- `evals/score.js` runs against BAD "before" and prints recall, precision, and duplicate rate. Record the baseline numbers in the CHANGELOG.
- The installed skill's description matches the repo.

---

## Decisions (confirmed by Buddy, 2026-11-03)

| # | Decision | Answer | Where it applies |
|---|----------|--------|------------------|
| D1 | Consolidation threshold | **3 pages.** The same issue on 3 or more pages, or in a shared component, becomes one Site-wide finding. | Phase 1, task 1.2 |
| D2 | WCAG baseline | **Audit to WCAG 2.2 AA**, and label which findings also fail WCAG 2.1 AA (the legal baseline). | Phase 3 |
| D3 | Screenshots by default | **Keep off.** Fix the capture code, but the auditor still captures and annotates deliverable screenshots by hand. | Phase 2, task 2.7 |
| D4 | Reading-level target | **6th–8th grade** for all patient-facing content. | Phase 5, task 5.3 |
| D5 | Real page for evals | **Skip for now.** Use only W3C BAD and the CarePath sample; add a real page later. | Phase 6, task 6.3 |
| D6 | Git workflow | **Branch + PR per phase.** Claude opens the PR; Buddy reviews and merges. | Ground rule 5 |

## Out of scope (deferred)

- SEO/GEO companion skill
- Agent orchestration: page discovery, delivery integration, recurring monitoring and diffing
- Brand hex values in the docx template (needs the real brand guide)
