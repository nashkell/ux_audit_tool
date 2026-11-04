# Task Walkthroughs

Many heuristic problems only show up when you actually use the site: losing your place on Back, a form that clears itself, an error that's never announced. A static capture can't find these. Every audit walks through 2–3 key tasks live.

## Contents
- [1. Define the tasks at audit setup](#1-define-the-tasks-at-audit-setup)
- [2. Walk each task](#2-walk-each-task)
- [3. Deliberate-error script](#3-deliberate-error-script)
- [4. What to look for at each step](#4-what-to-look-for-at-each-step)
- [5. Recording findings](#5-recording-findings)
- [6. Recording the task in audit-meta.json](#6-recording-the-task-in-audit-metajson)
- [7. Tools](#7-tools)
- [8. Safety](#8-safety)

## 1. Define the tasks at audit setup

Before reviewing anything, agree 2–3 tasks with the client (or pick them from the site's stated purpose if the client hasn't said). Each task needs:

| Field | Example |
|-------|---------|
| Task, in the user's words | "Book a new-patient appointment" |
| Who is doing it | A new patient on a phone |
| Start | Homepage |
| Success | Confirmation screen showing date, time, location |

Good tasks are the ones the site exists for: book, find a provider or location, check insurance or cost, pay a bill, request a refill, find safety information, contact support. Pick at least one task with a form.

## 2. Walk each task

1. Start where a real user starts (usually the homepage or a search result), not deep-linked into the form.
2. Do the task the obvious way first, as a first-time user would. Note every hesitation: where did you have to read twice, guess, or scroll to find the next step?
3. Repeat it with the deliberate-error script below.
4. Repeat the key steps keyboard-only (Tab, Shift+Tab, Enter, Space, Esc, arrows).
5. Repeat at phone width (375 px or a real device emulation).
6. Count the steps and screens from start to success. Note the count in the task's `notes`.

## 3. Deliberate-error script

Do each of these on every form or multi-step flow in the task. Each is a quick check that often finds a Major finding.

| Action | What good looks like |
|--------|----------------------|
| Submit with every field empty | Errors appear next to each required field, in text, and focus moves to the first one or to an error summary |
| Enter clearly invalid input (bad email, 8-digit phone, a date in the past) | The message says what's wrong and how to fix it; entered values are kept |
| Fix one error and resubmit | The other fields are still filled; the fixed error clears |
| Press the browser Back button mid-flow | Returns to the previous step with entries kept, not to the homepage or an expired page |
| Refresh mid-flow | Progress kept, or a clear message explains what was lost |
| Leave the page idle (if a session timeout is likely) | Warning before timeout, with a way to extend (WCAG 2.2.1) |
| Open a link or modal and close it again | Focus returns to where it was; Esc closes modals |
| Use the site's search with a typo and with no results | Suggestions or a helpful empty state, not a dead end |

## 4. What to look for at each step

- **Visibility of status (H1):** Does the user know where they are, how many steps remain, and whether an action worked?
- **Information scent:** Does each link or button label predict what comes next? Would a user know which option to pick without trying them all?
- **Control (H3):** Can they go back, cancel, or change an earlier answer without starting over?
- **Error prevention and recovery (H5, H9):** Are mistakes prevented (input masks, date pickers, sensible defaults) and easy to recover from?
- **Recognition over recall (H6):** Is earlier information shown when needed, or does the user have to remember it? Does the flow ask for the same information twice (WCAG 3.3.7)?
- **Accessible completion:** Can a keyboard-only or screen reader user complete it? Are errors and status changes announced (WCAG 3.3.1, 4.1.3)?

## 5. Recording findings

- Findings from a walkthrough default to **Verification = Observed live**: you did it and saw it.
- **Evidence** records the steps, so someone else can reproduce it: URL, what you entered or pressed, and what happened. For example: `/book step 3; entered 8-digit phone, pressed Submit; all 9 fields cleared on reload`.
- If you couldn't complete a step (it would place a real order, send a real message, or needs an account you don't have), say so in Evidence. Anything you only inferred about the steps after that is `Inferred — needs human check`.
- Apply the Consolidation Rule as usual: the same error-handling problem across three forms is one finding.

## 6. Recording the task in audit-meta.json

```json
"keyTasks": [
  {
    "task": "Book a new-patient appointment",
    "start": "Homepage",
    "success": "Confirmation screen with date, time, location",
    "result": "Completed with difficulty",
    "findings": ["FLOW-001", "UH-001"],
    "notes": "7 screens; stopped before final confirm to avoid booking a real slot"
  }
]
```

`result` is one of `Completed`, `Completed with difficulty`, `Not completed`, `Not attempted`. The Word builder prints the tasks in Appendix A. It warns if `keyTasks` is missing, a result isn't recognized, a listed finding isn't in the CSV, or a task that wasn't completed cleanly lists no findings.

## 7. Tools

- **Cowork (Claude in Chrome):** use `navigate`, `find`, `form_input`, and `computer` (click, type, key presses such as Tab and Escape) to perform each step. Use `read_page` after each step to check focus, error text, and live regions. Use `resize_window` for the phone-width pass.
- **Claude Code:** write a short Puppeteer script for the task (`page.click`, `page.type`, `page.keyboard.press('Tab')`, `page.goBack()`, `page.reload()`), and log the URL, `document.activeElement`, visible error text, and field values after each step. Or use Claude in Chrome if it's connected. To make deliberate-error passes safe, block everything except page loads so no form can actually be sent:
  ```js
  await page.setRequestInterception(true);
  page.on("request", r => r.method() === "GET" ? r.continue() : r.abort());
  ```
  Read `el.checkValidity()` and `el.validationMessage` to record native browser validation, which doesn't appear in headless screenshots reliably. Compare a field's computed style before and after focus to check the focus indicator. A blocked request makes some forms show their own failure message; don't report that as a finding.
- **Chat:** ask the user to perform the steps and describe or screenshot what happens. Mark anything you didn't see happen as Inferred.

## 8. Safety

Walkthroughs happen on live sites. Never finish an action with real-world effects (book a real slot, place an order, pay, send a message to staff, submit health information) unless the client has given you a test account or a staging environment for it. Stop at the final step, note it in `notes`, and treat behavior after that point as Inferred. Use obviously fake data (`test@example.com`, `555-0100`) for any input.
