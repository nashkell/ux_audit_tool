# Regulatory Context

This note helps the auditor record which accessibility standard a client is held to. It is context for a UX audit, **not legal advice**. Don't state in a deliverable that a client is or isn't legally compliant; report findings against the standards and let the client's counsel draw conclusions.

## What the skill audits against

- Audits evaluate against **WCAG 2.2 Level AA**: it's the current W3C recommendation and the better user-experience bar.
- Each accessibility finding is labeled with its **Standard** (`WCAG 2.1 AA`, `WCAG 2.2 AA (new)`, or `Best practice`) so the client can see which failures fall inside the **WCAG 2.1 AA** baseline most current regulations reference. See `accessibility-checklist.md` for the labeling rules.

## HHS Section 504 rule

- The HHS rule implementing Section 504 of the Rehabilitation Act requires **recipients of HHS federal financial assistance** to make their web content and mobile apps conform to **WCAG 2.1 Level AA**.
- **Whether it applies depends on the client.** Hospitals, health systems, and clinics that take Medicare/Medicaid or other HHS funding usually are recipients. A medical device or pharmaceutical manufacturer's marketing site often is not — but don't assume either way.
- **Which compliance date applies depends on the client** (the rule's dates are staggered by recipient size). Check the current dates on the HHS Office for Civil Rights site at audit time; don't copy them into this skill.
- The rule has exceptions (e.g. archived content, some pre-existing documents, some third-party content). Deciding whether an exception applies is a legal question — note the possibility, don't rule on it.

## Other rules that may apply

Check these with the client; record what they confirm.

- **ADA Title II** (state and local government entities, including public hospitals and health systems): the DOJ rule also references WCAG 2.1 AA.
- **ADA Title III** (private businesses open to the public): no technical standard is set in regulation; WCAG 2.1 AA is commonly used as the benchmark.
- **Non-US audiences** (e.g. EU consumer-facing services under the European Accessibility Act): obligations generally reference EN 301 549, which incorporates WCAG 2.1 AA.
- **Client policy or contract**: some clients have adopted WCAG 2.2 AA (or another target) themselves.

## Recording it: `complianceBaseline`

At audit setup, confirm with the client which standard applies and record it in `audit-meta.json`:

```json
"complianceBaseline": "WCAG 2.1 AA — HHS Section 504 (recipient, confirmed by client)"
```

Other example values:
- `"WCAG 2.1 AA — ADA Title II (county health system)"`
- `"WCAG 2.2 AA — client accessibility policy"`
- `"Not confirmed — client to advise"` (use this rather than guessing)

The Word report prints it in the Methodology appendix and above the conformance table. The build warns if it's missing on an audit that has accessibility findings.
