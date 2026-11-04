# WCAG 2.2 AA Accessibility Checklist

Audits evaluate against **WCAG 2.2 Level AA**. Every accessibility finding also carries a **Standard** label so the client can see which failures fall inside the **WCAG 2.1 AA legal baseline** (see `regulatory-context.md`).

Each item below is tagged `[SC number · Level · version introduced]`. Items tagged **2.2** are new in WCAG 2.2 and are *not* part of the WCAG 2.1 AA baseline. Automation hints name the `capture-site.js` output or axe rule that helps; a hint is a starting point, never a verdict on its own.

## Contents
- [Labeling findings: the Standard field](#labeling-findings-the-standard-field)
- [Touch and pointer target size](#touch-and-pointer-target-size)
- [1. Perceivable](#1-perceivable)
- [2. Operable](#2-operable)
- [3. Understandable](#3-understandable)
- [4. Robust](#4-robust)
- [Removed in WCAG 2.2](#removed-in-wcag-22)
- [Needs manual verification](#needs-manual-verification)
- [Quick tests](#quick-tests)

---

## Labeling findings: the Standard field

| Standard | Use when |
|----------|----------|
| `WCAG 2.1 AA` | The finding fails a WCAG 2.0/2.1 A or AA criterion — inside the legal baseline. |
| `WCAG 2.2 AA (new)` | The finding fails only one of the six criteria new in 2.2 (2.4.11, 2.5.7, 2.5.8, 3.2.6, 3.3.7, 3.3.8). |
| `Best practice` | No WCAG A/AA criterion is failed, but the issue still harms users (e.g. a 30px tap target, AAA-level concerns). |

Put the criterion number in Reference (e.g. `WCAG 2.4.7 Focus Visible`) — the Word builder reads it to fill the appendix conformance table. A Best-practice finding never counts as a Fail in that table, even if it mentions a criterion.

## Touch and pointer target size

| Target size (CSS px) | Result | Standard | Typical severity |
|----------------------|--------|----------|------------------|
| Below 24 × 24, without the spacing or other exceptions in 2.5.8 | Fails 2.5.8 Target Size (Minimum) | `WCAG 2.2 AA (new)` | By consequence (Major+ for primary actions) |
| 24 × 24 to 43 × 43 | Passes AA; below the 44 × 44 recommendation | `Best practice` | Usually Minor |
| 44 × 44 or larger | Meets the recommendation | — | — |

44 × 44 is the WCAG 2.5.5 *AAA* figure and common platform guidance — it is a recommendation, not an AA requirement. 2.5.8 exceptions: enough spacing (a 24px circle centered on the target doesn't overlap another target), an equivalent control elsewhere, inline links in text, user-agent default controls, or when the size is essential.

---

## 1. Perceivable

### Text alternatives
- [ ] Informative images have alt text that conveys their purpose; decorative images have `alt=""`; icons and image links have accessible names `[1.1.1 · A · 2.0]` — *hint:* `pageData.imagesMissingAlt`, axe `image-alt`, `link-name`. Alt *quality* is manual.

### Time-based media
- [ ] Prerecorded audio-only has a transcript; video-only has a transcript or audio track `[1.2.1 · A · 2.0]`
- [ ] Prerecorded video with audio has captions `[1.2.2 · A · 2.0]`
- [ ] Prerecorded video has audio description or a full text alternative `[1.2.3 · A · 2.0]`
- [ ] Live video with audio has captions `[1.2.4 · AA · 2.0]`
- [ ] Prerecorded video has audio description `[1.2.5 · AA · 2.0]`
- *Mark all 1.2.x N/A when the site has no audio or video.*

### Adaptable
- [ ] Structure is in the markup: headings, lists, tables, form groups, landmarks `[1.3.1 · A · 2.0]` — *hint:* `pageData.headings`, axe `list`, `th-has-data-cells`, `label`
- [ ] Reading order in the DOM matches the visual meaning `[1.3.2 · A · 2.0]`
- [ ] Instructions don't rely only on shape, size, position, or sound ("click the round button on the right") `[1.3.3 · A · 2.0]`
- [ ] Content works in portrait and landscape `[1.3.4 · AA · 2.1]`
- [ ] Personal-data fields use `autocomplete` (name, email, tel, address…) `[1.3.5 · AA · 2.1]` — *hint:* axe `autocomplete-valid`

### Distinguishable
- [ ] Color isn't the only way information is conveyed (links in text, errors, required fields, charts) `[1.4.1 · A · 2.0]` — *hint:* axe `link-in-text-block`
- [ ] Audio that plays automatically for more than 3s can be paused or muted `[1.4.2 · A · 2.0]`
- [ ] Text contrast ≥ 4.5:1; large text (24px, or 18.66px bold) ≥ 3:1 `[1.4.3 · AA · 2.0]` — *hint:* axe `color-contrast`; check axe `incomplete` color-contrast items by hand (text over images/gradients)
- [ ] Text resizes to 200% without loss of content or function `[1.4.4 · AA · 2.0]`
- [ ] Real text is used instead of images of text (logos excepted) `[1.4.5 · AA · 2.0]`
- [ ] Content reflows at 320 CSS px wide (400% zoom) without two-direction scrolling `[1.4.10 · AA · 2.1]` — *hint:* `mobile.checks.horizontalOverflow` is a clue, not the test
- [ ] UI component boundaries, states, and meaningful graphics have ≥ 3:1 contrast `[1.4.11 · AA · 2.1]`
- [ ] No content lost when line-height 1.5, paragraph spacing 2×, letter spacing 0.12em, word spacing 0.16em are applied `[1.4.12 · AA · 2.1]`
- [ ] Hover/focus pop-ups are dismissible (Esc), hoverable, and persistent `[1.4.13 · AA · 2.1]`

---

## 2. Operable

### Keyboard accessible
- [ ] Every function works from the keyboard `[2.1.1 · A · 2.0]` — *hint:* `keyboardFocus.stops`, `keyboardFocus.focusLost`
- [ ] Focus can always move away from a component (no keyboard trap) `[2.1.2 · A · 2.0]`
- [ ] Single-character shortcuts can be turned off, remapped, or only work on focus `[2.1.4 · A · 2.1]`

### Enough time
- [ ] Time limits can be turned off, adjusted, or extended (session timeouts on forms, booking holds) `[2.2.1 · A · 2.0]`
- [ ] Moving, blinking, scrolling, or auto-updating content (carousels, tickers) can be paused, stopped, or hidden `[2.2.2 · A · 2.0]`

### Seizures
- [ ] Nothing flashes more than 3 times per second `[2.3.1 · A · 2.0]`

### Navigable
- [ ] A skip link or landmarks let users bypass repeated blocks `[2.4.1 · A · 2.0]` — *hint:* axe `bypass`, `region`, `landmark-one-main`
- [ ] Each page has a descriptive, unique title `[2.4.2 · A · 2.0]` — *hint:* `pageData.title`
- [ ] Focus order preserves meaning and operability `[2.4.3 · A · 2.0]` — *hint:* `keyboardFocus.stops` order; judgment is manual
- [ ] Link purpose is clear from link text or its context ("Read more" alone fails) `[2.4.4 · A · 2.0]` — *hint:* `pageData.links`, axe `link-name`
- [ ] More than one way to find pages (nav + search, or sitemap) `[2.4.5 · AA · 2.0]`
- [ ] Headings and labels describe topic or purpose `[2.4.6 · AA · 2.0]`
- [ ] Keyboard focus indicator is visible `[2.4.7 · AA · 2.0]` — *hint:* `keyboardFocus.withoutFocusIndicator`
- [ ] **New in 2.2:** A focused element isn't entirely hidden by sticky headers, footers, cookie banners, or chat widgets `[2.4.11 · AA · 2.2]`

### Input modalities
- [ ] Multipoint or path-based gestures (pinch, swipe) have a single-pointer alternative `[2.5.1 · A · 2.1]`
- [ ] Actions fire on pointer up, or can be aborted/undone `[2.5.2 · A · 2.1]`
- [ ] The accessible name contains the visible label text `[2.5.3 · A · 2.1]` — *hint:* axe `label-content-name-mismatch` (best-practice tag)
- [ ] Motion-triggered actions (shake, tilt) have a UI alternative and can be disabled `[2.5.4 · A · 2.1]`
- [ ] **New in 2.2:** Anything done by dragging (sliders, sortable lists, maps) can also be done with single clicks/taps `[2.5.7 · AA · 2.2]`
- [ ] **New in 2.2:** Pointer targets are at least 24 × 24 CSS px, or meet a spacing/other exception `[2.5.8 · AA · 2.2]` — see [Touch and pointer target size](#touch-and-pointer-target-size); *hint:* axe `target-size`

---

## 3. Understandable

### Readable
- [ ] Page language is set (`<html lang>`) `[3.1.1 · A · 2.0]` — *hint:* `pageData.lang`, axe `html-has-lang`
- [ ] Passages in another language are marked (`lang` on the element) `[3.1.2 · AA · 2.0]`

### Predictable
- [ ] Receiving focus doesn't change context (no auto-submit, no new window on focus) `[3.2.1 · A · 2.0]` — *hint:* `keyboardFocus.focusLost` can reveal scripts reacting to focus
- [ ] Changing a field's value doesn't change context unless the user was told `[3.2.2 · A · 2.0]` (e.g. a `<select>` that navigates on change)
- [ ] Repeated navigation is in the same order on every page `[3.2.3 · AA · 2.0]`
- [ ] Components with the same function are identified the same way across pages `[3.2.4 · AA · 2.0]`
- [ ] **New in 2.2:** Help mechanisms (phone, chat, contact link, FAQ) appear in the same relative order on every page that has them `[3.2.6 · A · 2.2]`

### Input assistance
- [ ] Errors are identified in text and the field in error is indicated `[3.3.1 · A · 2.0]`
- [ ] Fields have labels or instructions (required fields, formats) `[3.3.2 · A · 2.0]` — *hint:* `pageData.unlabelledFields`, axe `label`, `select-name`
- [ ] Error messages suggest a fix when one is known `[3.3.3 · AA · 2.0]`
- [ ] Legal, financial, or data-changing submissions can be reversed, checked, or confirmed `[3.3.4 · AA · 2.0]`
- [ ] **New in 2.2:** Information already entered in the same process is auto-filled or selectable, not re-typed (e.g. shipping → billing, patient details across intake steps) `[3.3.7 · A · 2.2]`
- [ ] **New in 2.2:** Login doesn't require a cognitive function test (memorizing, transcribing, puzzle CAPTCHA) unless there's an alternative, a mechanism to help, or it's object/personal-content recognition; paste and password managers work `[3.3.8 · AA · 2.2]`

---

## 4. Robust

- [ ] Custom controls expose name, role, state, and value to assistive technology `[4.1.2 · A · 2.0]` — *hint:* axe `button-name`, `aria-*` rules, `nested-interactive`
- [ ] Status messages (form saved, results count, errors after submit) are announced without moving focus (`role="status"`, `aria-live`) `[4.1.3 · AA · 2.1]`

## Removed in WCAG 2.2

- **4.1.1 Parsing** is obsolete in WCAG 2.2, and W3C errata treat it as always satisfied for HTML under 2.0/2.1 too. Don't file findings against it. Markup problems that actually affect users (duplicate IDs breaking label associations, invalid ARIA) belong under 1.3.1 or 4.1.2.

---

## Needs manual verification

Automation can't settle these. A finding based only on capture data in these areas stays `Inferred — needs human check` until someone verifies it live, and the matching criterion should be marked `Needs manual check` in `criteriaResults` until then.

- [ ] **Alt text quality** — present but wrong, inadequate, or redundant alt text `[1.1.1]` (axe only checks presence)
- [ ] **Focus order makes sense** — the sequence of `keyboardFocus.stops` matches the visual and logical order `[2.4.3]`
- [ ] **Keyboard traps inside custom widgets** — date pickers, modals, carousels, embedded video, chat widgets `[2.1.2]`
- [ ] **What a screen reader announces** — names, roles, states, and reading order with VoiceOver/NVDA `[1.3.1, 4.1.2]`
- [ ] **Error messages are announced** — submit with errors and confirm they're read out or focus moves to them `[3.3.1, 4.1.3]`
- [ ] **Reflow at 400% / 320px** — zoom the desktop browser to 400% (or 320 CSS px wide) and check for two-direction scrolling and lost content `[1.4.10]`
- [ ] **Focus not obscured** — tab through with sticky headers/banners present `[2.4.11]`
- [ ] **Authentication and redundant entry** — walk the login and multi-step forms `[3.3.7, 3.3.8]`
- [ ] **axe `incomplete` items** — each listed selector in `accessibility.incomplete`

---

## Quick tests

### Keyboard
1. Tab through the whole page. Every interactive element reachable, in a sensible order?
2. Focus visible at every stop, and never hidden under a sticky header or banner?
3. Can you open and escape every menu, modal, and widget?

### Zoom and reflow
1. Zoom to 200%: all text readable, nothing cut off?
2. Zoom to 400% (or 320px wide): no horizontal scrolling for text content?

### Color
1. View in grayscale: information still clear? Links in body text distinguishable?

### Pointer
1. Measure small targets (DevTools): anything under 24 × 24 without spacing?
2. Anything that needs a drag or a multi-finger gesture — is there a click/tap alternative?
