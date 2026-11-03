---
name: ux-audit
description: Conduct comprehensive UX audits of websites. Use when the user provides a website URL and requests a UX audit, usability evaluation, accessibility review, or heuristic analysis. Evaluates sites against WCAG 2.1 accessibility standards, Nielsen Norman Group's 10 usability heuristics, healthcare-specific UX considerations, information architecture, visual design, and user flow analysis. Works in Claude Code (via Puppeteer), Cowork (via Chrome), or chat (with provided screenshots). Outputs a structured audit report with prioritized findings and recommendations, optionally rendered as a branded Word (.docx) deliverable.
---

# UX Audit Skill

Systematic UX audits evaluating websites against usability and accessibility standards.

## Known Limitations

**Screenshot capture for output/findings is disabled by default (as of July 2026).** This does not affect browser-based review — the site should still be reviewed live via Cowork (Claude in Chrome) or headless browser (Puppeteer in Claude Code) as normal; that's how the audit gets done. What's disabled is specifically the step that saves desktop/mobile screenshot *images* into the deliverables, which was found to be unreliable in production use and is being revisited.
- `capture-site.js` still navigates and analyzes every page normally — DOM extraction, axe-core accessibility checks, text extraction, keyboard-nav analysis all run. Only the image-saving step is skipped.
- Cowork should still `navigate` and inspect pages live; just skip the `computer` screenshot action for output purposes.
- Annotated screenshots for the deliverable are, for now, the auditor's responsibility to capture and annotate manually after the audit — not something this skill generates automatically.
- If you need to test a fix, `capture-site.js` accepts `--with-screenshots` to re-enable image capture, but treat any resulting images as unverified until this note is removed.

## Environment Setup

### Claude Code (Terminal-Based)

```bash
# 1. Create workspace
mkdir -p audit-output

# 2. Install Puppeteer
npm install puppeteer

# 3. Run capture script (screenshots off by default — see Known Limitations)
node /path/to/skill/scripts/capture-site.js https://target-site.com \
  --pages pages.json \
  --output ./audit-output

# 4. Analyze captured data (analysis.json per page: DOM structure, a11y
#    violations, text content, keyboard-nav data)
```

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

This is still a full live-browser review — only the step that saves screenshot images into the output is skipped for now (see Known Limitations above). Annotated screenshots for the deliverable are captured and added manually by the auditor.

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

### 2. Accessibility (WCAG 2.1 AA)
See `references/accessibility-checklist.md`

- **Perceivable**: Contrast 4.5:1, alt text, captions
- **Operable**: Keyboard nav, focus visible, touch targets 44px
- **Understandable**: Readable, predictable, input assistance
- **Robust**: Valid markup, accessible names

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
- Touch targets (44x44px min)
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
Reference: [Standard violated]
Evidence: [URL(s); CSS selector or element description; axe rule ID if any; screenshot ref if any]
Verification: [Automated-confirmed | Observed live | Inferred — needs human check]
Instances: [Count + list of pages, when the same issue appears in more than one place]
At a Glance: [One-sentence client-facing takeaway]
```

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
4. `screenshots/` - Annotated evidence, added manually by the auditor (not auto-generated — see Known Limitations)

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

The `Evidence`, `Verification`, and `Instances` columns are shown in small, muted text under each finding's Reference. A CSV without them (pre-v1.5) still builds, with a warning. Any finding with Verification = Inferred triggers a warning listing its ID; add `--strict` to make the build exit non-zero instead — use it for the final client build:
```bash
node scripts/docx-report-template.js findings.csv audit-meta.json output.docx --strict
```

The script's brand palette (navy/purple/lime/teal, Inter typeface) is approximated from the HTML deck system and marked as placeholder in the file — confirm hex values against the actual brand guide before client delivery. Severity badges intentionally use a separate red/orange/yellow/gray convention rather than brand accent colors, so severity reads independently of brand styling.

---

*Skill Version: 1.5.0 — see `CHANGELOG.md` for version history.*
