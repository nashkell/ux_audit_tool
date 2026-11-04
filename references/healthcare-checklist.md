# Healthcare-Specific Checklist

Checks for dimension 8. Apply them when the site is for a provider, health system, payer, pharmaceutical or device brand, or health information service. This is a UX review: report what users see and experience. **Don't give legal or regulatory conclusions** (e.g. "this violates FDA rules"). Say what's missing or hard to find, and recommend the client's regulatory or legal team review it.

## Contents
- [1. Safety information (ISI) and fair balance](#1-safety-information-isi-and-fair-balance)
- [2. Prescribing information and instructions for use](#2-prescribing-information-and-instructions-for-use)
- [3. Trust signals](#3-trust-signals)
- [4. Health literacy](#4-health-literacy)
- [5. Privacy, consent, and sensitive information](#5-privacy-consent-and-sensitive-information)
- [6. Patient safety and emotional appropriateness](#6-patient-safety-and-emotional-appropriateness)

---

## 1. Safety information (ISI) and fair balance

For branded pharmaceutical and medical device sites.

- [ ] **Visible.** Important Safety Information (ISI) is on every page that makes a benefit claim, in readable type (not smaller or lower-contrast than the benefit copy).
- [ ] **Persistent where required.** If the brand uses a persistent ISI tray or a scrolling ISI, it's present on the pages that need it, works on mobile, and can be expanded to the full text. A tray that covers content or focused elements is also an accessibility finding (WCAG 2.4.11).
- [ ] **Comparable prominence.** Risk information is presented with prominence comparable to benefit information: similar type size, contrast, and placement. *Problem:* benefits in large headline type, risks in a small grey footer.
- [ ] Risk information isn't buried behind a click, accordion, or carousel while benefits are shown up front.
- [ ] ISI is real text (selectable, readable by screen readers), not an image.
- [ ] Video content with benefit claims includes the risk information in the video, captions, or alongside it.

## 2. Prescribing information and instructions for use

- [ ] Links to the full Prescribing Information (PI), Medication Guide, Patient Information, or Instructions for Use (IFU) are visible near the top of the page and in the ISI, labeled in plain words ("Prescribing Information", not just "PI").
- [ ] Links work and open the current document. Note the document's date or version if shown.
- [ ] PDFs say they're PDFs and give file size; if a PDF is the only source of key instructions, check it's tagged and readable (or note it as a manual check).
- [ ] Device IFUs or how-to content include step-by-step instructions with images or video, not just a PDF.

## 3. Trust signals

- [ ] **Credentials.** Clinical content and provider profiles show who wrote or reviewed it and their credentials (MD, RN, PharmD, board certification).
- [ ] **Review dates.** Medical content shows when it was last reviewed or updated. *Problem:* no date, or a date more than about 2 years old on clinical content.
- [ ] **Sources.** Health claims cite sources (studies, guidelines, labeling), with links where possible.
- [ ] **Who runs the site.** It's clear who owns the site and who funds it (e.g. "Sponsored by [manufacturer]"), and how to contact them.
- [ ] **Real contact options.** Phone, address, and hours are easy to find; for providers, locations and directions are accurate.
- [ ] Advertising and sponsored content are clearly distinguished from clinical information.
- [ ] Testimonials and patient stories are labeled as individual experiences, with any required context.

## 4. Health literacy

Use **6th–8th grade** as the single reading-level target for all patient-facing content. Reading level alone doesn't make content understandable, so also assess against **PEMAT** (the AHRQ Patient Education Materials Assessment Tool) understandability and actionability items.

### Reading level
- [ ] Measure representative patient-facing passages (e.g. Flesch-Kincaid grade) and record the grade in Evidence. Above the 6th–8th grade target is a finding; well above it (grade 11+) on content patients need to act on is usually Major.
- [ ] Clinical-audience pages (HCP sections) are exempt from the patient target but should still be clear.

### PEMAT understandability (sample of items)
- [ ] The purpose of the content is evident from the start.
- [ ] Common, everyday language; medical terms used only when needed and defined.
- [ ] Active voice.
- [ ] Numbers are clear and easy to understand; no calculations required of the user.
- [ ] Content is broken into short sections with informative headings, presented in a logical order.
- [ ] Includes a summary of key points.
- [ ] Visual aids (where used) make the content easier to understand and have clear captions.

### PEMAT actionability (sample of items)
- [ ] Identifies at least one action the user can take.
- [ ] Addresses the user directly ("you") when describing actions.
- [ ] Breaks actions into explicit, manageable steps.
- [ ] Provides tangible tools where useful (checklists, reminders, calculators).
- [ ] Explains how to use any charts, tables, or diagrams to take action.

### Numbers and risk
- [ ] Risks are shown as absolute numbers ("2 in 100 people") rather than only relative risk ("50% lower").
- [ ] Costs show what the patient will actually pay, or explain clearly why it varies.

## 5. Privacy, consent, and sensitive information

UX checks only; whether a practice is lawful (HIPAA, state privacy law) is for the client's counsel.

- [ ] **Consent banner clarity.** The cookie or tracking banner says in plain words what is collected and why, offers accept and reject (or manage) options of comparable prominence, and doesn't block the page from being read.
- [ ] The banner can be dismissed by keyboard and doesn't trap or hide focus.
- [ ] Forms that ask for health information (symptoms, conditions, medications, date of birth) say how it will be used and protected, with a link to the privacy policy near the submit button.
- [ ] Sensitive health details aren't requested on unsecured or general-purpose forms when a secure portal exists. Recommend the portal instead.
- [ ] Confirmation emails and messages don't repeat health details unnecessarily (often only checkable with a test account: mark as Inferred until confirmed).
- [ ] The privacy policy is easy to find and readable.

## 6. Patient safety and emotional appropriateness

- [ ] Pages where users may be in urgent need (contact, booking, symptom content) say what to do in an emergency ("If this is an emergency, call 911"), and give crisis resources (e.g. 988) where mental health is involved.
- [ ] Contact forms and messaging state the expected response time and that they aren't for urgent needs.
- [ ] Tone is calm, respectful, and non-stigmatizing; avoids fear-based or flippant language about conditions, cost, or outcomes.
- [ ] Imagery is respectful and representative of the people the site serves.
- [ ] Content about serious diagnoses gives a clear next step and support options, not just information.
- [ ] Language access: if the audience includes non-English speakers, translated content or interpreter information is easy to find.
