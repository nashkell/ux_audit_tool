# Evaluation Criteria: Dimensions 3–7

Concrete checks for Visual Design, Information Architecture, Content & Microcopy, User Flows, and Mobile/Responsive. Dimension 1 is in `heuristics-checklist.md`, dimension 2 in `accessibility-checklist.md`, and dimension 8 in `healthcare-checklist.md`.

Each check says what to look at and what counts as a problem. Where a check overlaps a WCAG criterion, the criterion is named: file the finding under Accessibility with a Standard if it fails the criterion, and under this dimension if it doesn't fail the criterion but still affects users.

Severity guidance is a starting point. As always, set severity by the consequence for the user on that page (see Severity Scale in SKILL.md).

## Contents
- [3. Visual Design](#3-visual-design)
- [4. Information Architecture](#4-information-architecture)
- [5. Content & Microcopy](#5-content--microcopy)
- [6. User Flows](#6-user-flows)
- [7. Mobile/Responsive](#7-mobileresponsive)

---

## 3. Visual Design

### Hierarchy and focal points
- [ ] Each page has one clear primary action, and it's the most visually prominent element. *Problem:* two or more competing primary buttons, or the primary action styled as a text link.
- [ ] The squint test: blur your eyes (or view the page zoomed out). Can you still tell the page title, main content, and primary action apart?
- [ ] Headings look like headings: visibly larger or heavier than body text, with a consistent scale (e.g. H1 > H2 > H3).

### Typography
- [ ] Body text is at least 16 px with line height about 1.5. Below 16 px is usually Minor; below 14 px on core content is Major.
- [ ] Line length about 50–80 characters on desktop. *Problem:* full-width paragraphs on wide screens.
- [ ] No more than 2 typefaces; weights used consistently.
- [ ] Text isn't fully justified, and long passages aren't all caps or italic.

### Color
- [ ] Color carries meaning consistently (e.g. red = error everywhere, not also a brand accent on buttons).
- [ ] Meaning is never color-only (WCAG 1.4.1). Contrast is checked under Accessibility (1.4.3, 1.4.11).
- [ ] Links are distinguishable from body text without relying on color alone (underline or another cue).

### Spacing and layout
- [ ] Related items are grouped and unrelated items separated (proximity). *Problem:* a field label closer to the field above than to its own field.
- [ ] Spacing uses a consistent scale; elements align to a grid.
- [ ] Nothing important sits so far below the fold, or in such low contrast, that users miss it.

### Component consistency
- [ ] The same component (button, card, form field, alert) looks and behaves the same on every page. *Problem:* several primary button styles (consolidate into one Site-wide finding).
- [ ] Interactive elements look interactive; non-interactive ones don't (no underlined non-links, no flat buttons that look like labels).
- [ ] Hover, focus, active, and disabled states exist and are distinct.

### Imagery
- [ ] Images are sharp at the sizes shown (no stretched or pixelated images).
- [ ] Photos support the content rather than filling space. In healthcare, prefer real people and settings over generic stock.
- [ ] Icons are consistent in style and paired with text labels where the meaning isn't universal.

---

## 4. Information Architecture

### Findability and information scent
Don't apply a fixed click-count rule. The question is: **can users find key content, and does each step give a clear scent?**
- [ ] For each key task (see `task-walkthroughs.md`), the entry point is visible on the homepage or in the main navigation, without scrolling to the footer.
- [ ] At every step, the label the user must choose predicts what's behind it. *Problem:* the user has to open several sections to find the right one, or the right label is vague ("Resources", "Solutions").
- [ ] The destination page confirms the user is in the right place (its heading matches the link they clicked).

### Navigation labels
- [ ] Labels use the user's words, not internal or organizational terms. *Problem:* navigation organized by department ("Our Services") when users think in tasks or conditions.
- [ ] Labels are mutually exclusive: a user shouldn't wonder whether an item is under "Patients" or "Resources".
- [ ] Same item, same name everywhere (navigation, buttons, page headings). Overlaps with heuristic 4 and WCAG 3.2.4.

### Structure
- [ ] Navigation breadth and depth suit the content: about 5–9 top-level items, with grouping rather than one long menu.
- [ ] The current location is shown (active nav state, breadcrumbs on deep sites).
- [ ] Every page can reach the homepage and main sections; no dead-end pages.
- [ ] Long content pages (FAQs, policies) are grouped with headings and in-page links.

### Search
- [ ] Search is available where the site has more content than navigation can expose, and it's visible.
- [ ] Results are relevant for common queries, including misspellings and synonyms (e.g. "doctor" vs "provider" vs "physician").
- [ ] A no-results page suggests alternatives instead of a dead end.
- [ ] Results show enough context (title, snippet, type) to choose between them.

### Footer and utility navigation
- [ ] Common utility tasks (log in, pay, contact, locations) are in a predictable place, usually the header utility bar.
- [ ] The footer supplements the main navigation; it isn't the only route to key tasks.

---

## 5. Content & Microcopy

### Reading level and plain language
- [ ] Patient-facing content targets a **6th–8th grade** reading level. Measure representative passages (e.g. Flesch-Kincaid grade) and record the number in Evidence. Reading level is a signal, not the whole test; see the PEMAT checks in `healthcare-checklist.md` for understandability.
- [ ] Short sentences (about 15–20 words on average), active voice, common words.
- [ ] Unavoidable technical or insurance terms are explained in plain words where they're used.
- [ ] Content leads with what the user needs (the answer, the action), not background.

### Calls to action
- [ ] Buttons say what will happen, starting with a verb ("Book appointment", "Download form"). *Problem:* "Submit", "Click here", "Learn more" repeated with no context.
- [ ] Link text makes sense out of context (WCAG 2.4.4 when it can't be determined from context).
- [ ] The CTA label matches the destination or result.

### Error messages
- [ ] Say what went wrong and how to fix it, in plain language. *Problem:* "Error 422", "Invalid input", "Something went wrong."
- [ ] Don't blame the user; keep a calm tone.
- [ ] Appear next to the problem field and in text (WCAG 3.3.1, 3.3.3).

### Forms
- [ ] Every field has a visible label (placeholder text alone isn't a label).
- [ ] Required and optional fields are marked consistently.
- [ ] Format help appears before the user makes the mistake (e.g. "MM/DD/YYYY").
- [ ] The form explains why sensitive information is needed.

### Scannability and voice
- [ ] Meaningful headings, short paragraphs, and lists for steps or options.
- [ ] Consistent terminology across pages (the same thing always has the same name).
- [ ] Tone fits the audience and moment: reassuring and direct on health topics, never flippant about symptoms or cost.
- [ ] Dates, prices, and contact details are current and consistently formatted.

---

## 6. User Flows

Evaluate flows by walking them live (see `task-walkthroughs.md`). Most findings here come from performing the task, not from reading the page.

### Step count and friction
- [ ] Count screens and required inputs from start to success. Each screen or field that doesn't serve the user is a finding to consider.
- [ ] Nothing is asked before it's needed. *Problem:* account creation before the user can see availability or prices.
- [ ] Guest or low-commitment paths exist where account creation isn't essential.
- [ ] No information is requested twice in the same process (WCAG 3.3.7 Redundant Entry).

### Orientation and progress
- [ ] Multi-step flows show the current step and how many remain.
- [ ] Back, refresh, and returning later behave predictably (see the deliberate-error script).
- [ ] The final step summarizes what the user is committing to, with a way to edit, before they confirm.

### Cognitive load
- [ ] One main decision per screen; related choices grouped.
- [ ] Sensible defaults and remembered choices reduce effort.
- [ ] Users don't need to remember information from an earlier screen (heuristic 6).

### Error recovery and dead ends
- [ ] Every error state has a way forward (fix, retry, alternative contact).
- [ ] Expired links, timeouts, and failed payments explain what happened and offer the next step.
- [ ] There's a visible fallback (phone, chat) when the online flow can't serve the user.

### Completion and confirmation
- [ ] Success is unmistakable: a confirmation page or message with the key details (what, when, where, reference number).
- [ ] The user is told what happens next (email, call, what to bring).
- [ ] Confirmation messages are announced to assistive technology (WCAG 4.1.3).

---

## 7. Mobile/Responsive

Test with a real device emulation (e.g. `capture-site.js` `--mobile-device`, or Chrome device mode), at 375 px and at least one tablet width. Check both portrait and landscape.

### Layout and reflow
- [ ] No horizontal scrolling at 320–375 px for normal content (WCAG 1.4.10 at 320 CSS px). `analysis.json` `mobile.checks` reports horizontal overflow.
- [ ] Wide components (tables, calendars, carousels) adapt or scroll inside their own container.
- [ ] Content order still makes sense when columns stack.
- [ ] A viewport meta tag is present, and pinch-zoom isn't disabled (`user-scalable=no` or `maximum-scale=1` is a finding).

### Touch targets
- [ ] Below 24×24 CSS px fails WCAG 2.5.8 (file under Accessibility). 24–43 px is a best-practice finding, usually Minor; 44×44 px is recommended. See the target-size table in `accessibility-checklist.md`.
- [ ] Adjacent targets have enough spacing that users don't hit the wrong one.

### Navigation pattern
- [ ] The mobile menu is easy to find, labeled (not icon-only without a name), and closable.
- [ ] Key tasks (book, call, find a location) are reachable within the first screen or one tap from the menu.
- [ ] Sticky headers or banners don't cover a large share of the screen, or cover focused elements (WCAG 2.4.11).

### Content prioritization
- [ ] The most important content and actions come first on small screens; desktop sidebars don't push them down.
- [ ] Content hidden on mobile is either unneeded or reachable another way.

### Readability and input
- [ ] Text is readable without zooming (body at least 16 px).
- [ ] Phone numbers are tap-to-call (`tel:` links); addresses link to maps.
- [ ] Form fields use the right input types (`type="email"`, `tel`, `inputmode="numeric"`) so the correct keyboard appears, and use `autocomplete` (WCAG 1.3.5).
- [ ] Interstitials and pop-ups are easy to dismiss and don't block the content the user came for.
