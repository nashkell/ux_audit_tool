# UX Audit Report

**Website**: [URL]  
**Date**: [DATE]  
**Pages/Flows Audited**: [PAGES/FLOWS]  
**Compliance Baseline**: [e.g. WCAG 2.1 AA — HHS Section 504; confirmed with client — see references/regulatory-context.md]

---

## Executive Summary

### Overall Score: [XX]% - [Rating]

| Dimension | Score | Issues |
|-----------|-------|--------|
| Usability Heuristics | /50 | |
| Accessibility | /50 | |
| Visual Design | /50 | |
| Information Architecture | /50 | |
| Content & Microcopy | /50 | |
| User Flows | /50 | |
| Mobile/Responsive | /50 | |
| Healthcare-Specific | /50 | |
| **Overall** | **[XX]%** (evaluated dimensions only) | |

*List every dimension you evaluated in `audit-meta.json` `dimensionsEvaluated`. An evaluated dimension with no findings scores 50/50; mark any dimension you didn't evaluate "Not evaluated" and leave it out of the overall %. Scores are only comparable between audits of the same scope (SKILL.md → Audit Breadth and Comparability).*


### Issue Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | |
| 🟠 Major | |
| 🟡 Minor | |
| ⚪ Cosmetic | |

### Top 5 Priorities

1. [Finding] - Impact: High, Effort: [X]
2. [Finding] - Impact: High, Effort: [X]
3. [Finding] - Impact: Medium, Effort: [X]
4. [Finding] - Impact: Medium, Effort: [X]
5. [Finding] - Impact: [X], Effort: [X]

### Quick Wins

- [ ] [Quick fix 1]
- [ ] [Quick fix 2]
- [ ] [Quick fix 3]

---

## Findings

### Usability Heuristics

**Score**: [XX]/50

#### [FINDING-ID]
- **Severity**: 🔴/🟠/🟡/⚪
- **Scope**: Site-wide / Page-level / Element-level
- **Heuristic**: [#] [Name]
- **Location**: [Page/Element]
- **Observation**: [Description]
- **Impact**: [Effect on users]
- **Recommendation**: [Fix]
- **Evidence**: [URL(s); selector or element description; axe rule ID if any; screenshot ref if any]
- **Verification**: Automated-confirmed / Observed live / Inferred — needs human check
- **Instances**: [Count + pages, if the issue appears in more than one place; otherwise 1]
- **At a Glance**: [One-sentence client-facing "so what"]

---

### Accessibility

**Score**: [XX]/50

#### [FINDING-ID]
- **Severity**: 🔴/🟠/🟡/⚪
- **Scope**: Site-wide / Page-level / Element-level
- **WCAG**: [Criterion number and name, e.g. 2.4.7 Focus Visible]
- **Standard**: WCAG 2.1 AA (legal baseline) / WCAG 2.2 AA (new) / Best practice
- **Location**: [Page/Element]
- **Observation**: [Description]
- **Impact**: [Affected users]
- **Recommendation**: [Fix]
- **Evidence**: [URL(s); selector or element description; axe rule ID if any; screenshot ref if any]
- **Verification**: Automated-confirmed / Observed live / Inferred — needs human check
- **Instances**: [Count + pages, if the issue appears in more than one place; otherwise 1]
- **At a Glance**: [One-sentence client-facing "so what"]

---

[REPEAT FOR EACH DIMENSION]

*Before delivery: no finding may still say "Inferred — needs human check" (confirm it live or remove it), and any issue seen on 3+ pages or in a shared component is consolidated into one Site-wide finding — see Finding Documentation in SKILL.md.*

---

## Prioritization Matrix

```
            HIGH IMPACT
                 │
    QUICK WINS   │   MAJOR PROJECTS
    [IDs]        │   [IDs]
─────────────────┼─────────────────
    FILL-INS     │   RECONSIDER
    [IDs]        │   [IDs]
                 │
            LOW IMPACT
    LOW EFFORT ←───→ HIGH EFFORT
```

---

## Recommendations Roadmap

### Phase 1: [Name reflecting the nature of the work] (1-2 weeks)
| Finding | Action | Owner |
|---------|--------|-------|
| | | |

### Phase 2: [Name reflecting the nature of the work] (1-2 months)
| Finding | Action | Owner |
|---------|--------|-------|
| | | |

### Phase 3: [Name reflecting the nature of the work] (3+ months)
| Finding | Action | Owner |
|---------|--------|-------|
| | | |

*Name each phase for what it delivers (e.g. "Foundation & Compliance," not "Quick Wins") — see Roadmap Phase Naming in SKILL.md.*

---

## Appendix

### A. Screenshots
[Annotated screenshots — captured and annotated manually by the auditor; not auto-generated. See Known Limitations in SKILL.md.]

### B. Methodology
- NN/g 10 Usability Heuristics
- WCAG 2.2 Level AA (findings labeled where they also fail the WCAG 2.1 AA legal baseline)
- Healthcare UX Best Practices

**Key tasks walked through** (performed live, including empty/invalid input, Back, and refresh mid-flow):

| Task | Start → success | Result | Findings |
|------|-----------------|--------|----------|
| [Task in the user's words] | [Start] → [Success point] | [Completed / Completed with difficulty / Not completed / Not attempted] | [IDs] |

### C. Scoring Calculations
[Dimension score breakdowns — show deduction per finding using the Severity × Scope table in SKILL.md, not a flat per-severity deduction]

### D. WCAG 2.2 AA Conformance

**Summary**: [#] Fail · [#] Pass · [#] Needs manual check · [#] N/A · [#] Not tested
**Failed criteria**: [#] in the WCAG 2.1 AA legal baseline · [#] new in WCAG 2.2

| SC | Criterion | Level | Result | Findings / Notes |
|----|-----------|-------|--------|------------------|
| 1.1.1 | Non-text Content | A | [Pass / Fail / Needs manual check / N/A / Not tested] | [IDs, note] |
| … | *(every WCAG 2.2 A/AA criterion — see references/accessibility-checklist.md)* | | | |

*Fail = a finding in this report fails it. Pass / N/A / Needs manual check = recorded by the auditor. Anything not assessed = Not tested. Never mark Pass for a criterion that wasn't checked.*
