---
name: ux-audit
description: Conduct comprehensive UX audits of websites. Use when the user provides a website URL and requests a UX audit, usability evaluation, accessibility review, or heuristic analysis. Evaluates sites against WCAG 2.2 AA accessibility standards (labeling the WCAG 2.1 AA legal baseline), Nielsen Norman Group's 10 usability heuristics, healthcare-specific UX considerations, information architecture, visual design, and user flow analysis. Works in Claude Code (via Puppeteer), Cowork (via Chrome), or chat (with provided screenshots). Outputs a structured audit report with prioritized findings and recommendations, optionally rendered as a branded Word (.docx) deliverable.
---

# UX Audit Skill

Systematic UX audits evaluating websites against usability and accessibility standards.

## Known Limitations

**Deliverable screenshots are captured and annotated by the auditor, by hand.** The skill doesn't put screenshots into deliverables. This doesn't change the review itself: the site is still reviewed live through Cowork (Claude in Chrome) or headless Puppeteer in Claude Code.
- `capture-site.js` saves no images by default. It still loads every page and records DOM structure, the form-label check, axe-core results, page text, a keyboard focus test, and a mobile-load check.
- `--with-screenshots` saves `desktop.png` and `mobile.png` (real device emulation, lazy content loaded, consent banners dismissed with `--dismiss`). They're reliable for the auditor's own reference, and each one's viewport, user agent and timestamp are recorded in `analysis.json`. They are not annotated deliverable screenshots.
- Cowork should still `navigate` and inspect pages live, without saving `computer` screenshots as output.
- **Automated checks don't settle everything.** axe `incomplete` items, alt-text *quality* (an image whose alt is present but wrong), and whether focus order makes sense all need a human look. Treat those as `Inferred — needs human check` until confirmed.

## Environment Setup

### Claude Code (Terminal-Based)

```bash
# 1. Create workspace
mkdir -p audit-output

# 2. Install pinned Puppeteer + axe-core (once per skill install)
cd /path/to/skill/scripts && npm install && cd -

# 3. Run capture script (no screenshots unless --with-screenshots)
node /path/to/skill/scripts/capture-site.js https://target-site.com \
  --pages pages.json \
  --output ./audit-output \
  --dismiss "#onetrust-accept-btn-handler"   # optional consent-banner selector(s)

# 4. Analyze captured data — see "Reading analysis.json" below
```

**Reading `analysis.json`** (one per page; `capture-summary.json` lists every page and any failed step):
- `accessibility.violations[]`: axe rule, impact, WCAG tags, and up to 10 node selectors. Run with `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice`. Use the rule ID and selectors in Evidence; findings confirmed this way are `Automated-confirmed` once you've checked the flagged element.
- `accessibility.incomplete[]`: items axe couldn't decide. **These are a manual-review list, not findings.**
- `pageData.unlabelledFields[]` / `formFields[].labelSource`: label check (label[for], wrapping label, aria-labelledby, aria-label, title).
- `pageData.imagesMissingAlt[]` / `imagesEmptyAlt[]`: missing alt vs `alt=""` (valid for decorative images).
- `keyboardFocus.withoutFocusIndicator[]`: Tab stops whose outline/box-shadow/border/background didn't change on focus. `keyboardFocus.focusLost[]`: Tab stops that dropped focus to the page (e.g. `onfocus="blur()"`).
- `mobile.checks`: viewport meta and horizontal overflow from a real mobile-device load.
- `errors[]`: steps that failed on this page. The other steps still ran, so treat missing sections as "not tested," not "passed."


Create `pages.json` for multi-page audits:
```json
[
  { "name": "homepage", "path": "/" },
  { "name": "about", "path": "/about" },
  { "name": "contact", "path": "/contact" },
  { "name": "login", "path": "/login" }
]
```

### Cowork (Browser-Based)

Use Claude in Chrome tools directly to review the live site:
1. `tabs_create_mcp` - Create tab
2. `navigate` - Go to URL
3. `resize_window` - Set viewport (1440px desktop, 375px mobile)
4. `read_page` - Get accessibility tree
5. `get_page_text` - Get rendered content for readability/microcopy review

This is still a full live-browser review; screenshots just aren't saved as output (see Known Limitations above). Annotated screenshots for the deliverable are captured and added manually by the auditor.

### Chat (Manual Input)

Request from user:
- Desktop screenshot(s), if a visual reference is needed
- Mobile screenshot(s), if a visual reference is needed
- Specific page URLs for analysis

---

## Audit Dimensions

Evaluate all applicable dimensions. Reference detailed criteria in `references/` files.

### 1. Usability Heuristics (NN/g)
See `references/heuristics-checklist.md`

| # | Heuristic | Key Checks |
|---|-----------|------------|
| 1 | Visibility of System Status | Loading states, progress, feedback |
| 2 | Match System/Real World | Plain language, familiar icons |
| 3 | User Control & Freedom | Undo, cancel, exit options |
| 4 | Consistency & Standards | Internal + external consistency |
| 5 | Error Prevention | Constraints, confirmations, defaults |
| 6 | Recognition vs Recall | Visible options, context preserved |
| 7 | Flexibility & Efficiency | Shortcuts, personalization |
| 8 | Aesthetic & Minimalist | Essential content, clear hierarchy |
| 9 | Error Recovery | Plain language errors, solutions |
| 10 | Help & Documentation | Searchable, contextual, task-focused |

### 2. Accessibility (WCAG 2.2 AA)
See `references/accessibility-checklist.md` (every A/AA criterion, tagged) and `references/regulatory-context.md` (which baseline applies to the client).

- **Perceivable**: Contrast 4.5:1, alt text, captions, reflow
- **Operable**: Keyboard nav, focus visible and not obscured, target size (below 24×24 CSS px fails 2.5.8; 24–43px is a best-practice finding, 44px recommended), dragging alternatives
- **Understandable**: Readable, predictable, consistent help, input assistance, no redundant entry, accessible authentication
- **Robust**: Accessible names, roles, states; status messages

Audit to WCAG 2.2 AA, and label every accessibility finding with its **Standard** so the client can see what fails the WCAG 2.1 AA legal baseline. Items in the checklist's "Needs manual verification" section (alt-text quality, focus-order sense, screen reader output, reflow at 400%) can't be settled from capture data alone.

### 3. Visual Design
- Hierarchy and focal points
- Typography (16px+ body, 1.5 line-height)
- Color usage and meaning
- Spacing and whitespace
- Component consistency

### 4. Information Architecture
- Navigation depth and breadth
- Label clarity
- Findability (3-click rule)
- Search effectiveness

### 5. Content & Microcopy
- Reading level (target 8th grade)
- CTA clarity (action verbs)
- Error message helpfulness
- Form labels and help text

### 6. User Flows
- Task step count
- Friction points
- Cognitive load
- Error recovery paths

### 7. Mobile/Responsive
- Touch targets: below 24×24 CSS px fails WCAG 2.5.8 (AA); 24–43px is a best-practice finding (44px recommended, usually Minor)
- Content prioritization
- Navigation patterns
- Text readability without zoom

### 8. Healthcare-Specific (when applicable)
- Trust signals and credentials
- Health literacy (6th-8th grade)
- Regulatory UX (fair balance, ISI)
- Emotional appropriateness

---

## Finding Documentation

For each issue found:

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

**Standard** says which bar the finding fails. `WCAG 2.1 AA` = a WCAG 2.0/2.1 A or AA criterion (the legal baseline). `WCAG 2.2 AA (new)` = only one of the six criteria new in 2.2. `Best practice` = no A/AA criterion failed, but users are still affected. Required on accessibility findings; leave blank elsewhere unless a finding cites WCAG. If it's blank, the Word builder fills it from the criterion number in Reference. Rules and the target-size table are in `references/accessibility-checklist.md`.

**Evidence** is what the finding is based on — specific enough that someone else can go and see it. Name the URL(s), the selector or a plain description of the element, the axe rule ID if automation flagged it, and a screenshot reference if one exists.

**Verification** records how the finding was confirmed. Use exactly one of:

| Value | Meaning |
|-------|---------|
| Automated-confirmed | A tool (e.g. axe-core) flagged it and the flagged element was checked against the actual page. |
| Observed live | Seen directly by interacting with the live page (keyboard, click-through, resize, form submit). |
| Inferred — needs human check | Reasoned from indirect data (a static capture, DOM, or screenshot) and not yet confirmed on the live site. |

**Findings marked "Inferred — needs human check" may not appear in a client deliverable until a human changes the value** — by confirming it live (→ Observed live) or deleting the finding. The Word builder warns on any Inferred finding, and `--strict` makes it refuse to build.

**Instances** lists every place a consolidated finding occurs (see the Consolidation rule below). For a single-location finding, `1` is enough.

**Writing the "At a Glance" line.** This is the sentence a busy stakeholder reads when they don't have time for the full finding. It is not a compressed restatement of the Observation — it answers "so what."

- One sentence, plain language, no jargon from the Reference/standard.
- Lead with the client-relevant consequence, not the technical mechanism. ("Patients on mobile can't complete the booking form" beats "Form fields lack accessible labels on viewports under 768px.")
- Tone is empathetic, not alarmist or clinical — the goal is a stakeholder nodding along, not feeling attacked or lectured.
- Write it after the Observation/Impact/Recommendation are drafted, as a synthesis of them — not as a first pass that the rest gets built around.

### Severity Scale

| Level | Label | Definition |
|-------|-------|------------|
| 4 | Critical | Blocks task completion or accessibility |
| 3 | Major | Significant confusion/delay |
| 2 | Minor | Some confusion, tasks completable |
| 1 | Cosmetic | Polish, minimal impact |

**Binary vs. graded findings.** Not every finding varies "by degree." Some conditions are pass/fail — an image either has alt text or it doesn't; a form field either has an associated label or it doesn't; a page either has a keyboard-reachable focus order or it doesn't. This applies across dimensions, not just Accessibility.

For binary findings, severity is assigned based on the *consequence of the failure*, not a graduated distance from some ideal:
- A missing label on a single decorative field → likely Cosmetic or Minor
- A missing label on a required field in a checkout/booking flow → likely Critical or Major

Don't force a binary finding into a graded description ("partially meets contrast requirements") when the underlying condition is actually pass/fail — describe it as what it is, and let the severity level carry the weight of how much it matters.

### Scope of Impact

Severity alone doesn't capture how much of the site a finding touches — a Critical issue in the global nav is a different problem than a Critical issue on one form field on one page, even though both are "Critical." Every finding gets a Scope in addition to a Severity:

| Scope | Definition |
|-------|------------|
| Site-wide | Affects a template, component, or pattern used across the whole site (global nav, footer, design system token, sitewide policy) |
| Page-level | Confined to one page, but affects the page broadly (page layout, a whole section, a page-level flow) |
| Element-level | Confined to a single component or element on one page (one button, one field, one image) |

Scope is assigned independently of Severity — don't infer one from the other. A Cosmetic, site-wide inconsistency and a Critical, element-level blocker are both real findings; the scoring model (below) is what weighs them against each other.

### Consolidation Rule

AI-assisted reviews tend to report the same issue over and over. Before scoring:

- **The same root issue on 3 or more pages, or in a shared component** (global nav, footer, a reused form or card), becomes **one** finding with Scope = Site-wide. List every location in Instances.
- **Don't file one finding per page for a template-level problem.** Five pages with the same unlabelled search field is one finding, not five.
- **Don't report a problem you didn't observe.** If a behavior can't be checked from what was captured (e.g. a hover state, an error message, or a back-button flow from a static screenshot), either test it live or mark it `Inferred — needs human check`.

---

## Scoring

### Dimension Score (0-50)

```
score = 50 - sum(deduction for each finding)
minimum = 0
```

**Deduction is looked up by Severity *and* Scope together, not Severity alone.** A flat per-severity deduction (e.g. every Critical finding costs 10 points regardless of reach) overstates isolated issues and understates systemic ones. Use this table:

| Severity | Site-wide | Page-level | Element-level |
|----------|-----------|------------|----------------|
| Critical | -8 | -5 | -3 |
| Major | -5 | -3 | -2 |
| Minor | -2 | -1.5 | -1 |
| Cosmetic | -1 | -0.5 | -0.5 |

Example: three Critical, Element-level findings and one Critical, Site-wide finding are not scored the same (3 × -3 = -9 vs. -8) even though all four are "Critical" — which is the intended effect. This replaces the old flat `critical×10 / major×6 / minor×3 / cosmetic×1` formula.

### Priority Score (1-40)

```
priority = (severity×3) + (userReach×2) + (businessImpact×2) + (easeOfFix×1)
```
Each factor rated 1-5. Scope can inform the `userReach` rating (site-wide findings generally reach more users) but the two aren't identical — a low-traffic page can still be page-level scope with high business impact, and vice versa. Rate `userReach` on actual reach, not just scope category.

### Overall Health

```
health% = (sum of dimension scores) / (50 × dimensions) × 100
```

| Range | Rating |
|-------|--------|
| 90-100% | Excellent |
| 75-89% | Good |
| 60-74% | Needs Improvement |
| 40-59% | Poor |
| <40% | Critical |

---

## Roadmap Phase Naming

Name phases by the *nature* of the work, not by how easy it is. "Quick Wins" mislabels a phase if it's actually dominated by compliance-driven or foundational fixes — clients read the phase name as a promise about what they're getting, not an estimate of effort.

A pattern that has worked well: give each phase a name tied to the outcome it delivers, then optionally tie the set together with a short narrative arc, e.g.:

```
Phase 1: Foundation & Compliance   — Protect the audience.
Phase 2: Core Experience Redesign — Improve the experience.
Phase 3: Strategic Expansion      — Earn their trust.
```

This is a pattern to adapt, not a template to reuse verbatim — the specific names and arc should reflect what's actually in each phase for the site being audited. Keep timeframes (1-2 weeks, 1-2 months, etc.) as a secondary detail, not the phase title.

## Report Generation

Use templates in `assets/`:
- `audit-report-template.md` - Full report
- `executive-summary-template.md` - One-pager

Output files:
1. `audit-report.md` - Complete findings
2. `executive-summary.md` - Stakeholder summary
3. `findings.csv` - Tabular data for tracking
4. `screenshots/` - Annotated evidence, added manually by the auditor (see Known Limitations)

Copy deliverables to output directory for user access.

### Word (.docx) Deliverable

For client-facing delivery, `scripts/docx-report-template.js` builds a branded Word document directly from `findings.csv` plus a small metadata file — no manual data re-entry. This requires the `docx` skill's environment (npm `docx` package) — read `/mnt/skills/public/docx/SKILL.md` first for setup and the common gotchas, and always render the result to PDF and visually check it before delivering, per that skill's verification step.

Workflow:
1. Have `findings.csv` ready (as already produced by this skill's Finding Documentation format).
2. Copy `assets/audit-meta.example.json` to `audit-meta.json` and fill in the handful of things a CSV can't hold: site name, prepared-by, date, pages audited, the executive summary narrative, and the roadmap phases/arc.
3. Run:
   ```bash
   node scripts/docx-report-template.js findings.csv audit-meta.json output.docx
   ```
4. Dimension scores, severity counts, top priorities (ranked by Priority Score), and the appendix scoring table are all computed automatically from the CSV using the Severity × Scope deduction table — nothing to hand-calculate.
5. Render to PDF and inspect before sending to the client.

CSV column names are matched case- and punctuation-insensitively (`At a Glance`, `at_a_glance`, etc. all resolve), so minor header variations across exports are fine. See `assets/findings.example.csv` for the expected format.

**WCAG conformance table (Appendix D).** The builder lists all 55 WCAG 2.2 A/AA criteria with a result:
- **Fail** is filled in from findings: the criterion number in Reference (or an optional `WCAG SC` column). `Best practice` findings never create a Fail.
- **Pass, N/A, Needs manual check** come only from the auditor, in `audit-meta.json` `criteriaResults` (`[{ "sc": "2.1.1", "result": "Pass", "note": "..." }]`). Anything not listed is **Not tested**. Never mark Pass for a criterion you didn't check.
- If the auditor marks Pass but a finding fails the criterion, the report shows Fail and warns. A Fail with no finding behind it also warns.
- Set `complianceBaseline` in `audit-meta.json` (see `references/regulatory-context.md`); the build warns if it's missing.

The `Evidence`, `Verification`, and `Instances` columns are shown in small, muted text under each finding's Reference. A CSV without them (pre-v1.5) still builds, with a warning. Any finding with Verification = Inferred triggers a warning listing its ID; add `--strict` to make the build exit non-zero instead — use it for the final client build:
```bash
node scripts/docx-report-template.js findings.csv audit-meta.json output.docx --strict
```

The script's brand palette (navy/purple/lime/teal, Inter typeface) is approximated from the HTML deck system and marked as placeholder in the file — confirm hex values against the actual brand guide before client delivery. Severity badges intentionally use a separate red/orange/yellow/gray convention rather than brand accent colors, so severity reads independently of brand styling.

---

*Skill Version: 1.5.2 — see `CHANGELOG.md` for version history.*
