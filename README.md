# UX Audit Skill

A Claude Agent Skill for running systematic, structured UX audits of websites — evaluated against WCAG 2.2 AA (with the WCAG 2.1 AA legal baseline labeled), Nielsen Norman Group's 10 usability heuristics, and healthcare-specific UX considerations.

Built and maintained by the AI Center of Excellence. Originally developed for client-facing audit work in the healthcare/medical device space, generalized for broader team use.

## Executive Summary

Given a website URL, this skill runs a structured audit across 8 dimensions (usability heuristics, accessibility, visual design, information architecture, content & microcopy, user flows, mobile/responsive, healthcare-specific) and turns the results into a client-ready deliverable set: a full findings report, a one-page executive summary, a findings CSV, and — optionally — a branded Word document, all generated from the same underlying data.

It's built to work the same way regardless of which environment it's run in (Claude Code, Cowork, or Chat), and to score findings by both how severe they are and how far they reach, rather than severity alone. Every finding carries a plain-language "so what" line that's meant to be read on its own — the goal is a report a busy stakeholder can skim and still walk away understanding what matters and why, without reading the full technical writeup.

This is a living framework, not a fixed spec — the severity scale, scoring model, and templates below have already been revised once based on real client work, and are expected to keep evolving.

## Workflow

The skill runs a linear pipeline from URL to deliverables:

```
Website URL
    |
    v
Choose environment -- Code, Cowork, or Chat
    |
    v
Live browser review -- 8 dimensions, all pages
    |
    v
Document findings -- Severity + Scope + At a Glance
    |
    v
Score & prioritize -- Severity x Scope, auto-computed
    |
    v
Generate deliverables -- report, summary, CSV, Word doc
    |
    +-- audit-report.md
    +-- findings.csv
    +-- Word doc (optional, generated from findings.csv)
```

The environment choice only changes *how* pages get reviewed — all three feed the same downstream finding format, scoring model, and report templates. The sections below walk through each stage in the detail that matters if you're running or modifying the skill.

---

## Environments: Claude Code, Cowork, and Chat

The three modes run the same 8-dimension evaluation — what differs is how the site data gets gathered and how automated that gathering is.

**Claude Code (headless, via Puppeteer)**
Fully scripted. `scripts/capture-site.js` drives headless Chrome against a list of pages defined in `pages.json`. Desktop and mobile are separate loads; mobile uses real device emulation (`--mobile-device`, default iPhone 13). For each page it records:
- DOM structure and a form-label check (label[for], wrapping label, aria-labelledby, aria-label, title)
- axe-core violations with node selectors, plus `incomplete` items for manual review. axe is injected from the local npm package, so a site's Content-Security-Policy can't block it.
- page text
- a keyboard focus test that presses Tab and compares each element's focused and unfocused styles
- mobile viewport/overflow checks

All of this is written to an `analysis.json` per page. Each step is wrapped: one failure is recorded and the rest still run. Install once with `cd scripts && npm install` (Puppeteer and axe-core versions are pinned in `scripts/package.json`). Screenshots are off by default (see Known Limitation below), so visual-design findings still need a human look at the live site or manually supplied images.

**Cowork (live, via Claude in Chrome)**
Interactive rather than scripted. Navigate, resize the viewport (1440px desktop / 375px mobile), and use `read_page` for the accessibility tree plus `get_page_text` for rendered content — against the actual live page each time, not a captured snapshot. This is the better fit when a site has JS-heavy interactions, login flows, or dynamic states that are awkward to script in advance. Same screenshot caveat applies — live review still happens, but images aren't auto-saved into the output.

**Chat (manual)**
No automated browsing at all. URLs and/or screenshots are supplied directly and evaluated from what's given. This is the fallback when neither Code nor Cowork is available, or when specific pages/states need evaluating without a full crawl.

The practical difference: Code gives breadth (many pages, consistent structured data) with the least hands-on interaction; Cowork gives fidelity on tricky interactive flows; Chat gives control over exactly what gets evaluated but costs the automation. All three produce findings in the same format, so the report structure doesn't change based on which one was used.

## The 8 Audit Dimensions

1. **Usability Heuristics** — Nielsen Norman Group's 10 heuristics (visibility of system status, error recovery, consistency & standards, etc.)
2. **Accessibility** — WCAG 2.2 Level AA: perceivable, operable, understandable, robust. Each finding is labeled `WCAG 2.1 AA` (legal baseline), `WCAG 2.2 AA (new)`, or `Best practice`. Target size: below 24×24 CSS px fails 2.5.8; 24–43px is a best-practice finding (44px recommended).
3. **Visual Design** — hierarchy, typography, spacing, consistency
4. **Information Architecture** — findability and information scent (no fixed click-count rule), labels, search
5. **Content & Microcopy** — reading level (6th–8th grade for patient-facing content), CTA clarity, error message quality
6. **User Flows** — friction points, cognitive load, error recovery paths, judged by walking key tasks live
7. **Mobile/Responsive** — touch target sizing, readability, mobile nav patterns
8. **Healthcare-Specific** — ISI and fair balance, PI/IFU links, trust signals, health literacy (reading level plus PEMAT), consent and privacy UX, emergency guidance

Every dimension has a reference file of concrete checks: `heuristics-checklist.md` (1), `accessibility-checklist.md` (2), `evaluation-criteria.md` (3–7), and `healthcare-checklist.md` (8).

**Key-task walkthroughs (v1.5.4).** At audit setup, 2–3 key user tasks are agreed (e.g. "Book a new-patient appointment: homepage → confirmation") and recorded in `audit-meta.json` as `keyTasks`. Each one is performed live in the browser, including deliberate errors: empty submit, invalid input, Back and refresh mid-flow, keyboard-only, and phone width. This is where the interaction-dependent problems a static capture can't see show up (forms that clear themselves, Back losing your place, errors that aren't announced). Walkthrough findings default to `Observed live`, with the steps in Evidence. The Word report lists each task, its result, and the findings it surfaced in Appendix A. See `references/task-walkthroughs.md`, including its safety rule: never complete a real booking, payment, or message without a test account.

Not every audit necessarily touches all 8 — a non-healthcare client might skip dimension 8, or a scoped engagement might cover a subset. Each finding within a dimension gets the same structure regardless of which dimension it came from (see below), so the dimensions differ in *what* they're looking for, not in how findings get documented or scored.

## Finding Documentation Format

Every finding uses the same structure:

```
ID: [DIM]-[###]
Severity: [1-4]
Scope: [Site-wide / Page-level / Element-level]
Location: [Page/Element]
Observation: [What was found]
Impact: [User/business effect]
Recommendation: [Specific fix]
Reference: [Standard violated — include the WCAG criterion number, e.g. "WCAG 2.4.7 Focus Visible"]
Standard: [WCAG 2.1 AA | WCAG 2.2 AA (new) | Best practice] (accessibility findings)
Evidence: [URL(s); CSS selector or element description; axe rule ID if any; screenshot ref if any]
Verification: [Automated-confirmed | Observed live | Inferred — needs human check]
Instances: [Count + list of pages, when the same issue appears in more than one place]
At a Glance: [One-sentence client-facing takeaway]
```

**ID** — a dimension prefix plus a number, like `ACC-001` (Accessibility) or `UH-003` (Usability Heuristics). Keeps findings traceable across the report, the CSV, and any tracker they get imported into.

**Severity** — the four-level scale: Critical, Major, Minor, Cosmetic. Not every finding is a matter of degree — some conditions are pass/fail (an image either has alt text or it doesn't, a form field either has a label or it doesn't). For those, severity is assigned by the *consequence* of the failure, not a graduated "how close to correct" judgment. A missing label on a decorative field is Cosmetic; a missing label on a required checkout field is Critical. The failure itself doesn't get described as "partially" anything — it's binary, and the severity carries the weight.

**Scope** — the axis that answers "how much of the site does this touch":

| Scope | Meaning |
|-------|---------|
| Site-wide | A template, component, or pattern used across the whole site |
| Page-level | Confined to one page, but affects it broadly |
| Element-level | Confined to a single component on one page |

Scope is assigned independently of Severity — a Critical, Site-wide issue and a Critical, Element-level issue are both genuinely Critical, but they're not the same problem, and the scoring model (below) treats them differently.

**Standard** (v1.5.2) — which bar an accessibility finding fails. Audits evaluate against WCAG 2.2 AA, but most current regulations (e.g. the HHS Section 504 rule) reference WCAG 2.1 AA, so each finding says whether it's inside that legal baseline (`WCAG 2.1 AA`), fails only a criterion new in 2.2 (`WCAG 2.2 AA (new)`), or fails no A/AA criterion (`Best practice`). Which baseline applies to a client is recorded in `audit-meta.json` as `complianceBaseline` — see `references/regulatory-context.md`.

**Evidence / Verification / Instances** (v1.5) — what the finding is based on and how it was confirmed. AI heuristic reviews produce false positives and repeat themselves, so every finding now names where to see it (URL, selector, axe rule) and is marked `Automated-confirmed`, `Observed live`, or `Inferred — needs human check`. Inferred findings can't go into a client deliverable until a human confirms them. **Consolidation rule:** the same root issue on 3 or more pages, or in a shared component, is filed once as a Site-wide finding with every location listed under Instances — not once per page.

**Observation / Impact / Recommendation** — the factual core: what was found, who it affects and how, and the specific fix. These stay descriptive and technical.

**At a Glance** — written *after* the other fields, as a synthesis of them, not a compressed version of the Observation. The test is whether a stakeholder who reads only this one line understands why it matters — plain language, leads with the consequence rather than the mechanism, empathetic rather than clinical. "Patients on mobile can't complete the booking form" beats "Form fields lack accessible labels below 768px," even though both describe the same finding. This line also feeds the executive summary's Top Priorities section and the Word doc's callout boxes, so it's doing double duty as both the plain-language explanation and the thing that gets reused downstream.

## Severity x Scope Scoring Matrix

Every dimension starts at a ceiling of 50 points. Each finding looks up one cell in this table — its Severity row, its Scope column — and that's the point deduction it costs the dimension:

| Severity | Site-wide | Page-level | Element-level |
|----------|-----------|------------|----------------|
| Critical | -8 | -5 | -3 |
| Major | -5 | -3 | -2 |
| Minor | -2 | -1.5 | -1 |
| Cosmetic | -1 | -0.5 | -0.5 |

```
score = 50 - sum(deduction for each finding in the dimension)
minimum = 0
```

**What it replaced.** The original model scored purely on Severity: every Critical cost 10 points, every Major cost 6, every Minor cost 3, every Cosmetic cost 1 — regardless of how much of the site the finding touched. That overstated isolated problems and understated systemic ones; a single broken link and a sitewide keyboard-focus failure would score identically if both were "Critical."

**Worked example.** Accessibility with three findings — ACC-001 (Critical, Site-wide, -8), ACC-002 (Major, Element-level, -2), ACC-003 (Minor, Page-level, -1.5) — scores `50 - 8 - 2 - 1.5 = 38.5/50` (77%, "Good").

**Why the same Severity can score differently.** ACC-001 above (Critical, Site-wide) costs -8; a Critical, Element-level finding like a single broken password-reset link costs only -3. Both are genuinely Critical, but ACC-001 is nearly three times as expensive to the dimension score — fixing it protects every page and every user, while the broken link, though urgent, is a contained fix. This is the entire point of the matrix: Severity alone can't distinguish those two situations, but Severity x Scope can. It cuts the other way too — three separate Element-level Critical findings (-9 total) cost *more* than one Site-wide Critical (-8), which is the intended effect of weighing frequency-times-consequence against a single big systemic hit.

**Where it doesn't apply.** This table only drives the Dimension Score. The Priority Score (1-40) — which ranks findings for the Top Priorities list and the roadmap — is a separate formula:

```
priority = (severity x 3) + (userReach x 2) + (businessImpact x 2) + (easeOfFix x 1)
```

Scope can *inform* the `userReach` rating (Site-wide findings usually reach more users) but the two aren't forced to match — a low-traffic page can still carry high business impact at Page-level scope, so `userReach` gets rated on actual reach, not auto-derived from Scope.

**Stored inputs (v1.5.3).** Record the three ratings in `findings.csv` as `UserReach`, `BusinessImpact`, `EaseOfFix` (1–5; ease 5 = easiest). Severity maps Critical 4 / Major 3 / Minor 2 / Cosmetic 1. The Word builder computes the score itself and shows each finding's inputs in the appendix (`35 (S4 R5 I4 E5)`), so the ranking can be checked. If the inputs are missing, it uses the `Priority Score` column as given. If both are present and disagree, it warns and uses the computed value.

**Evaluated dimensions and comparability (v1.5.3).** `audit-meta.json` lists `dimensionsEvaluated`.
- Every listed dimension counts toward the overall score, at 50/50 if it has no findings. Previously a clean dimension simply vanished, so a site scored *worse* for having one fewer problem area evaluated.
- Unlisted dimensions show as "Not evaluated" and are left out of the average.
- Without the field, the builder falls back to the old behavior and warns.

Scores are only comparable between audits of the same scope: same dimensions, same pages/flows. The consolidation rule keeps them from scaling with page count.

## Word (.docx) Generation Pipeline

`scripts/docx-report-template.js` builds a fully-formatted, branded Word document directly from `findings.csv` — no manual re-entry of finding data.

**Two inputs, different jobs.**
`findings.csv` carries everything about the findings themselves (ID, Dimension, Severity, Scope, Reference, Location, Observation, Impact, Recommendation, At a Glance, Priority Score, and — from v1.5 — Evidence, Verification, Instances) — the same file already produced elsewhere in the skill. `audit-meta.json` carries the handful of things a CSV structurally can't hold: site name, prepared-by, date, pages audited, evaluated dimensions, key tasks, compliance baseline, the executive summary narrative, and the roadmap phases. Copy `assets/audit-meta.example.json` and fill in the ~7 fields; everything else is derived.

```bash
node scripts/docx-report-template.js findings.csv audit-meta.json output.docx
```

**Parsing.** A small hand-written CSV parser handles quoted fields with embedded commas (Location and Observation routinely have commas in them). Column matching is case- and punctuation-insensitive — "At a Glance," "at_a_glance," and "AtAGlance" all resolve to the same field — so minor header drift between exports won't break it.

**Evidence and the verification gate.** Evidence, Verification, and Instances render in small muted text under each finding's Reference. They're optional for back-compat: a pre-v1.5 CSV builds exactly as before, with a warning that the columns are missing. Any finding marked `Inferred — needs human check` prints a warning naming its ID; pass `--strict` to make the script exit non-zero and write nothing instead (use it for the final client build):

```bash
node scripts/docx-report-template.js findings.csv audit-meta.json output.docx --strict
```

**WCAG 2.2 AA conformance table (Appendix D).** All 55 WCAG 2.2 A/AA criteria, each with a result:
- **Fail** comes from the findings: the criterion number in Reference, or an optional `WCAG SC` column. `Best practice` findings never create a Fail.
- **Pass / N/A / Needs manual check** come only from the auditor, in `audit-meta.json` `criteriaResults`.
- Everything else is **Not tested**.

The script never writes Pass on its own, since no finding isn't proof a criterion was checked. It warns when:
- an auditor Pass conflicts with a finding (Fail wins)
- a Fail has no finding behind it
- a Standard label doesn't match the criteria cited
- a criterion is unknown or obsolete (4.1.1)

A blank Standard is filled in from the cited criteria. A CSV without a Standard column still builds, with a warning.

**What's derived automatically, rather than hand-calculated:**
- **Dimension scores** — findings grouped by Dimension, Severity x Scope deduction looked up and summed per group, subtracted from 50.
- **Overall Site Health %** — sum of evaluated dimension scores over their combined ceiling (an evaluated dimension with no findings counts as 50/50; "Not evaluated" dimensions are excluded), converted to a percentage and banded into a rating (Excellent/Good/Needs Improvement/Poor/Critical).
- **Severity counts** — a tally across all findings.
- **Top 5 Priorities** — findings sorted by Priority Score descending (computed from the stored inputs when present), using each one's At a Glance line as the summary text.
- **Appendix scoring table** — every finding's ID, Severity, Scope, and looked-up deduction, so a reviewer can check the math line by line.

Dimensions render in a canonical order matching the 8 dimensions above, regardless of row order in the CSV.

**Rendering and verification.** The assembled data is handed to render functions using the `docx` npm library, styled to the Relevate Health palette (navy/purple/lime/teal, Inter). The workflow always ends with converting the output to PDF and visually checking it — required by the underlying `docx` skill's standard practice, and how the automated version was confirmed to reproduce the same numbers as the original hand-built doc (87.5% overall, matching dimension scores, matching Top 5 order) before this was committed.

**Known gap.** The script doesn't validate that `audit-meta.json` is filled in — a missing narrative or roadmap phase falls back to bracketed placeholder text (`[Add a 1-2 sentence summary...]`) so the doc still builds instead of erroring. Worth a final read-through before delivery.

---

## Known Limitation

**Deliverable screenshots are captured and annotated by the auditor, by hand.** `capture-site.js` saves no images by default. The v1.5.1 capture fixes make `--with-screenshots` reliable for the auditor's own reference: real mobile emulation on a separate load, lazy content scrolled into view, consent banners dismissed with `--dismiss`, and viewport/user agent/timestamp recorded per image. The images still aren't annotated deliverables. Automated checks also don't settle alt-text quality, axe `incomplete` items, or whether focus order makes sense; those need a human. See `SKILL.md` -> Known Limitations.

## Repo structure

```
SKILL.md                            Core instructions (entry point)
references/
  heuristics-checklist.md           NN/g 10 heuristics, detailed criteria
  accessibility-checklist.md        WCAG 2.2 AA checklist: every A/AA criterion tagged, target-size rules, manual-verification list
  regulatory-context.md             Which baseline applies to a client (HHS Section 504 etc.); complianceBaseline
  evaluation-criteria.md            Concrete checks for dimensions 3-7 (visual, IA, content, flows, mobile)
  healthcare-checklist.md           Dimension 8: ISI/fair balance, PI/IFU, trust signals, health literacy (PEMAT), privacy UX
  task-walkthroughs.md              How to define and walk key tasks live, deliberate-error script, keyTasks format
assets/
  audit-report-template.md          Full report template
  executive-summary-template.md     One-page stakeholder summary template
  findings.example.csv              Example input for the docx builder
  audit-meta.example.json           Example metadata input for the docx builder
scripts/
  package.json                      Pinned Puppeteer / axe-core / docx versions (cd scripts && npm install)
  capture-site.js                   Puppeteer capture + analysis script (Claude Code)
  wcag22-criteria.js                WCAG 2.2 A/AA criteria list used by the Word builder's conformance table
  docx-report-template.js           Branded Word (.docx) builder -- reads findings.csv + audit-meta.json directly
CHANGELOG.md                        Version history
```

## Installing

Package the skill directory into a `.skill` file for upload to Claude.ai / Cowork settings, or point Claude Code at this repo directly. See your team's AI Center of Excellence for the current packaging workflow.

## Contributing

This is a living framework — evaluation criteria, severity definitions, and templates are expected to evolve as they're used on real client work. Open a PR with a description of what production use surfaced and why the change is needed; see `CHANGELOG.md` for the pattern.

## Roadmap

- Extract SEO/GEO assessment into a companion skill for audits that combine both lenses (deferred — not part of this skill's scope)
