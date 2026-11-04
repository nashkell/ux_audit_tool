#!/usr/bin/env node

/**
 * UX Audit - Browser Capture Script
 *
 * Loads each page in headless Chrome and records the data an auditor needs:
 * DOM structure, form-label check, axe-core results (violations with
 * selectors + incomplete items for manual review), a real keyboard focus
 * test, page text, and a mobile-load check. Screenshots are OFF by default;
 * pass --with-screenshots for reference images (see SKILL.md Known Limitations).
 *
 * Setup (once):   cd scripts && npm install      (versions pinned in package.json)
 * Usage:          node capture-site.js <url> [options]   (run with no args for help)
 *
 * Every step on a page is wrapped: if one fails it is recorded as
 * { step, error } in that page's analysis.json and the remaining steps still run.
 */

const puppeteer = require('puppeteer');
const { KnownDevices } = require('puppeteer');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const DEFAULT_MOBILE_DEVICE = 'iPhone 13';
const DEFAULT_TAB_COUNT = 25;
const NAV_TIMEOUT = 30000;

// Screenshots stay off by default (decision D3): the auditor captures and
// annotates deliverable screenshots by hand. --with-screenshots turns on
// reference images for the auditor's own use.
const SCREENSHOTS_ENABLED_DEFAULT = false;

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];
const MAX_NODES_PER_RULE = 10;

const DEFAULT_PAGES = [{ name: 'homepage', path: '/' }];

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ============================================================================
// Step runner — one failing step never aborts the page
// ============================================================================

async function runStep(errors, step, fn) {
  try {
    return await fn();
  } catch (e) {
    const error = (e && e.message ? e.message : String(e)).split('\n')[0];
    errors.push({ step, error });
    console.log(`  ⚠️  ${step} failed: ${error}`);
    return null;
  }
}

// ============================================================================
// Page loading helpers
// ============================================================================

// Wait until the network is quiet and web fonts have finished loading.
// Replaces page.waitForTimeout(), which was removed in Puppeteer v22.
async function settle(page) {
  try {
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 10000 });
  } catch { /* busy sites (analytics beacons, long-polling) may never go fully idle */ }
  await page.waitForFunction(
    async () => { await document.fonts.ready; return true; },
    { timeout: 10000 }
  );
}

async function loadPage(page, url) {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT });
  await settle(page);
}

// Click away cookie/consent banners. Missing selectors are fine (banner may not show).
async function dismissBanners(page, selectors) {
  const clicked = [];
  for (const sel of selectors) {
    const handle = await page.$(sel).catch(() => null);
    if (!handle) continue;
    const visible = await handle.isVisible().catch(() => false);
    if (!visible) continue;
    await handle.click().catch(() => {});
    clicked.push(sel);
    await sleep(300);
  }
  if (clicked.length) await settle(page).catch(() => {});
  return clicked;
}

// Scroll down in steps so lazy-loaded images/sections load, then return to top.
async function scrollForLazyLoad(page) {
  await page.evaluate(async () => {
    const delay = ms => new Promise(r => setTimeout(r, ms));
    const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
    const maxHeight = 30000; // guard against infinite-scroll pages
    let y = 0;
    while (y < Math.min(document.documentElement.scrollHeight, maxHeight)) {
      y += step;
      window.scrollTo(0, y);
      await delay(150);
    }
    window.scrollTo(0, 0);
  });
  await settle(page).catch(() => {});
  // Wait for images that started loading during the scroll.
  await page.evaluate(async () => {
    const imgs = Array.from(document.images).filter(i => !i.complete);
    await Promise.race([
      Promise.all(imgs.map(i => new Promise(r => { i.onload = i.onerror = r; }))),
      new Promise(r => setTimeout(r, 5000))
    ]);
  });
}

async function takeScreenshot(page, file, label) {
  await scrollForLazyLoad(page);
  await page.screenshot({ path: file, fullPage: true });
  const viewport = page.viewport();
  const userAgent = await page.evaluate(() => navigator.userAgent);
  return { file: path.basename(file), label, viewport, userAgent, capturedAt: new Date().toISOString() };
}

// ============================================================================
// In-page helpers (serialized into the page)
// ============================================================================

// Short, reasonably stable CSS selector for an element. Defined as a string so
// it can be injected once per document and reused by several evaluate() calls.
const SELECTOR_HELPER = `
window.__uxaSelector = function (el) {
  if (!el || el.nodeType !== 1) return null;
  if (el.id) return '#' + CSS.escape(el.id);
  const parts = [];
  let node = el;
  while (node && node.nodeType === 1 && parts.length < 4) {
    let part = node.tagName.toLowerCase();
    if (node.id) { parts.unshift('#' + CSS.escape(node.id) + ' > ' + part); break; }
    const cls = Array.from(node.classList).slice(0, 2).map(c => '.' + CSS.escape(c)).join('');
    part += cls;
    const parent = node.parentElement;
    if (parent) {
      const same = Array.from(parent.children).filter(c => c.tagName === node.tagName);
      if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(node) + 1) + ')';
    }
    parts.unshift(part);
    node = parent;
  }
  return parts.join(' > ');
};`;

async function ensureHelpers(page) {
  await page.evaluate(SELECTOR_HELPER);
}

// ============================================================================
// Data extraction
// ============================================================================

async function extractPageData(page) {
  await ensureHelpers(page);
  return page.evaluate(() => {
    const sel = window.__uxaSelector;
    const textOf = el => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '');

    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .map(h => ({ level: parseInt(h.tagName[1], 10), text: textOf(h).substring(0, 100) }));

    const links = Array.from(document.querySelectorAll('a[href]')).map(a => ({
      text: textOf(a).substring(0, 50),
      href: a.href,
      isExternal: !a.href.startsWith(window.location.origin)
    }));

    // alt="" is valid for decorative images, so report missing vs empty separately.
    const images = Array.from(document.querySelectorAll('img'));
    const imagesMissingAlt = images.filter(img => !img.hasAttribute('alt'))
      .map(img => ({ src: img.currentSrc || img.src, selector: sel(img) }));
    const imagesEmptyAlt = images.filter(img => img.hasAttribute('alt') && img.alt.trim() === '')
      .map(img => ({ src: img.currentSrc || img.src, selector: sel(img) }));

    // Label check: label[for], wrapping <label>, aria-labelledby (must point at
    // existing elements with text), aria-label, then title as a last resort.
    // Button-like inputs are named by their value instead.
    const fields = Array.from(document.querySelectorAll('input, select, textarea'))
      .filter(f => f.type !== 'hidden');
    const formFields = fields.map(field => {
      const type = field.tagName === 'INPUT' ? (field.type || 'text') : field.tagName.toLowerCase();
      let labelSource = null;
      let labelText = '';
      if (['submit', 'button', 'reset'].includes(type)) {
        if ((field.value || '').trim()) { labelSource = 'value'; labelText = field.value.trim(); }
      } else if (type === 'image' && (field.alt || '').trim()) {
        labelSource = 'alt'; labelText = field.alt.trim();
      }
      if (!labelSource && field.id) {
        const forLabels = Array.from(document.querySelectorAll(`label[for="${CSS.escape(field.id)}"]`));
        const t = forLabels.map(textOf).join(' ').trim();
        if (t) { labelSource = 'label-for'; labelText = t; }
      }
      if (!labelSource) {
        const wrap = field.closest('label');
        const t = textOf(wrap);
        if (t) { labelSource = 'wrapping-label'; labelText = t; }
      }
      if (!labelSource && field.hasAttribute('aria-labelledby')) {
        const ids = field.getAttribute('aria-labelledby').split(/\s+/).filter(Boolean);
        const t = ids.map(id => textOf(document.getElementById(id))).join(' ').trim();
        if (t) { labelSource = 'aria-labelledby'; labelText = t; }
      }
      if (!labelSource && (field.getAttribute('aria-label') || '').trim()) {
        labelSource = 'aria-label'; labelText = field.getAttribute('aria-label').trim();
      }
      if (!labelSource && (field.getAttribute('title') || '').trim()) {
        labelSource = 'title'; labelText = field.getAttribute('title').trim();
      }
      return {
        type,
        name: field.name || null,
        id: field.id || null,
        selector: sel(field),
        hasLabel: !!labelSource,
        labelSource,
        labelText: labelText.substring(0, 80),
        placeholder: field.placeholder || null
      };
    });

    const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]'))
      .map(btn => ({
        text: (textOf(btn) || btn.value || btn.getAttribute('aria-label') || '').substring(0, 50),
        tag: btn.tagName.toLowerCase(),
        type: btn.type || null,
        selector: sel(btn)
      }));

    return {
      title: document.title,
      metaDescription: document.querySelector('meta[name="description"]')?.content || null,
      lang: document.documentElement.lang || null,
      headings,
      links: links.slice(0, 50),
      imagesMissingAlt,
      imagesEmptyAlt,
      formFields,
      unlabelledFields: formFields.filter(f => !f.hasLabel),
      buttons,
      stats: {
        totalLinks: links.length,
        totalImages: images.length,
        totalForms: document.querySelectorAll('form').length,
        totalFields: formFields.length,
        unlabelledFields: formFields.filter(f => !f.hasLabel).length,
        totalButtons: buttons.length
      }
    };
  });
}

// ============================================================================
// axe-core — injected from the local npm package (not a CDN), via
// page.evaluate, which a page's Content-Security-Policy can't block.
// ============================================================================

let AXE_SOURCE = null;
function axeSource() {
  if (!AXE_SOURCE) AXE_SOURCE = fsSync.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf-8');
  return AXE_SOURCE;
}

async function checkAccessibility(page) {
  await page.evaluate(axeSource());
  const results = await page.evaluate(async tags => {
    // eslint-disable-next-line no-undef
    return await axe.run(document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations', 'incomplete'] });
  }, AXE_TAGS);

  const mapRule = r => ({
    id: r.id,
    impact: r.impact,
    description: r.description,
    help: r.help,
    helpUrl: r.helpUrl,
    tags: r.tags.filter(t => /^wcag|best-practice/.test(t)),
    nodeCount: r.nodes.length,
    nodes: r.nodes.slice(0, MAX_NODES_PER_RULE).map(n => ({
      target: n.target.join(' '),
      html: (n.html || '').substring(0, 200),
      summary: (n.failureSummary || '').substring(0, 300)
    }))
  });

  return {
    axeVersion: results.testEngine?.version,
    tags: AXE_TAGS,
    violations: results.violations.map(mapRule),
    // Items axe could not decide — these need manual review by the auditor.
    incomplete: results.incomplete.map(mapRule),
    passes: results.passes.length
  };
}

async function getPageText(page) {
  return page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    return main.innerText.substring(0, 10000);
  });
}

// ============================================================================
// Keyboard focus test — presses Tab N times. For each focused element it
// compares the computed outline/box-shadow/border/background while focused
// against the same element after blur(). (getComputedStyle(el, ':focus')
// cannot read focus styles, which is why the old check was removed.)
// ============================================================================

async function testKeyboardFocus(page, tabCount) {
  await ensureHelpers(page);
  const totalFocusable = await page.evaluate(() => document.querySelectorAll(
    'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'
  ).length);

  await page.evaluate(() => {
    window.scrollTo(0, 0);
    if (document.activeElement) document.activeElement.blur();
    // Remember the last element that received focus, so a Tab press that ends
    // on <body> can name the element that dropped focus (e.g. onfocus="blur()").
    // Capture-phase 'focus' runs before the element's own handler, so it still
    // fires when that handler immediately blurs (where 'focusin' would not).
    window.__uxaLastFocus = null;
    document.addEventListener('focus', e => {
      if (e.target && e.target.nodeType === 1) window.__uxaLastFocus = window.__uxaSelector(e.target);
    }, true);
  });

  const stops = [];
  const seen = new Set();
  for (let i = 0; i < tabCount; i++) {
    await page.keyboard.press('Tab');
    await sleep(60); // let CSS transitions on focus start; we read the final computed value below
    const stop = await page.evaluate(async () => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) {
        const from = window.__uxaLastFocus;
        window.__uxaLastFocus = null;
        return from ? { focusLost: true, lostFrom: from } : null;
      }
      const props = ['outlineStyle', 'outlineWidth', 'outlineColor', 'outlineOffset', 'boxShadow',
        'borderTopColor', 'borderBottomColor', 'borderBottomWidth', 'backgroundColor', 'color', 'textDecorationLine'];
      const read = () => { const cs = getComputedStyle(el); return Object.fromEntries(props.map(p => [p, cs[p]])); };
      // Wait out short focus transitions.
      await new Promise(r => setTimeout(r, 200));
      const focused = read();
      const focusVisible = el.matches(':focus-visible');
      el.blur();
      await new Promise(r => setTimeout(r, 200));
      const unfocused = read();
      el.focus({ preventScroll: true });
      const changed = props.filter(p => focused[p] !== unfocused[p]);
      // An outline that is "none" or 0px wide doesn't count as an indicator by itself.
      const outlineVisible = focused.outlineStyle !== 'none' && parseFloat(focused.outlineWidth) > 0;
      const meaningful = changed.filter(p => !p.startsWith('outline') || outlineVisible);
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role'),
        text: (el.innerText || el.value || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().substring(0, 40),
        selector: window.__uxaSelector(el),
        focusVisibleMatches: focusVisible,
        hasFocusIndicator: meaningful.length > 0,
        changedProperties: meaningful,
        focusedStyle: Object.fromEntries(meaningful.map(p => [p, focused[p]])),
        inViewport: r.bottom > 0 && r.top < window.innerHeight && r.width > 0 && r.height > 0
      };
    });
    if (!stop) continue;
    if (stop.focusLost) { stops.push({ index: i + 1, ...stop }); continue; }
    if (seen.has(stop.selector)) { stop.cycled = true; stops.push(stop); break; } // wrapped around
    seen.add(stop.selector);
    stops.push({ index: i + 1, ...stop });
  }

  // Tabbing past the last element passes through <body> before wrapping to
  // the top. A "lost" stop directly followed by the wrap-around is that, not a bug.
  stops.forEach((s, i) => { if (s.focusLost && stops[i + 1] && stops[i + 1].cycled) s.endOfPage = true; });
  const tested = stops.filter(s => !s.cycled && !s.focusLost);
  const lost = stops.filter(s => s.focusLost && !s.endOfPage);
  return {
    totalFocusable,
    tabPresses: tabCount,
    stopsTested: tested.length,
    withoutFocusIndicator: tested.filter(s => !s.hasFocusIndicator).map(s => ({ index: s.index, tag: s.tag, text: s.text, selector: s.selector })),
    // Tab presses where focus ended on <body>: the element received focus and
    // then dropped it (script blur, element removed). Keyboard users lose their place.
    focusLost: lost.map(s => ({ index: s.index, lostFrom: s.lostFrom })),
    stops
  };
}

// Mobile-only facts that need the real device load.
async function mobileChecks(page) {
  return page.evaluate(() => ({
    viewportMeta: document.querySelector('meta[name="viewport"]')?.content || null,
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
  }));
}

// ============================================================================
// Per-page capture: desktop and mobile are separate loads
// ============================================================================

async function capturePage(browser, baseUrl, pageConfig, outputDir, opts) {
  const url = new URL(pageConfig.path, baseUrl).href;
  const pageName = pageConfig.name || pageConfig.path.replace(/\//g, '-').replace(/^-|-$/g, '') || 'page';
  const pageDir = path.join(outputDir, pageName);
  await fs.mkdir(pageDir, { recursive: true });

  console.log(`\n📄 Capturing: ${pageName} (${url})`);
  const errors = [];
  const results = { url, pageName, capturedAt: new Date().toISOString(), screenshots: [], errors };

  // ---- Desktop load -------------------------------------------------------
  const desktop = await browser.newPage();
  try {
    await desktop.setViewport(DESKTOP_VIEWPORT);
    const loaded = await runStep(errors, 'desktop:load', () => loadPage(desktop, url).then(() => true));
    if (loaded) {
      results.finalUrl = desktop.url();
      results.desktop = {
        viewport: DESKTOP_VIEWPORT,
        userAgent: await desktop.evaluate(() => navigator.userAgent).catch(() => null)
      };
      if (opts.dismiss.length) {
        results.desktop.dismissed = await runStep(errors, 'desktop:dismiss', () => dismissBanners(desktop, opts.dismiss));
      }
      console.log('  🔍 Extracting page data...');
      results.pageData = await runStep(errors, 'pageData', () => extractPageData(desktop));
      if (!opts.skipA11y) {
        console.log('  ♿ Running axe-core...');
        results.accessibility = await runStep(errors, 'axe', () => checkAccessibility(desktop));
      }
      console.log('  📝 Extracting text content...');
      results.textContent = await runStep(errors, 'text', () => getPageText(desktop));
      console.log(`  ⌨️  Focus test (${opts.tabCount} Tab presses)...`);
      results.keyboardFocus = await runStep(errors, 'focusTest', () => testKeyboardFocus(desktop, opts.tabCount));
      if (opts.withScreenshots) {
        console.log('  📸 Desktop screenshot...');
        const shot = await runStep(errors, 'desktop:screenshot', () => takeScreenshot(desktop, path.join(pageDir, 'desktop.png'), 'desktop'));
        if (shot) results.screenshots.push(shot);
      }
    }
  } finally {
    await desktop.close().catch(() => {});
  }

  // ---- Mobile load (device emulation set before navigating) -------------
  const mobile = await browser.newPage();
  try {
    const device = KnownDevices[opts.mobileDevice];
    if (!device) throw new Error(`Unknown --mobile-device "${opts.mobileDevice}"`);
    await mobile.emulate(device);
    const loaded = await runStep(errors, 'mobile:load', () => loadPage(mobile, url).then(() => true));
    if (loaded) {
      // Reload so anything decided server-side or at first paint (UA sniffing,
      // matchMedia checks in JS) runs under the emulated device.
      await runStep(errors, 'mobile:reload', async () => {
        await mobile.reload({ waitUntil: 'networkidle2', timeout: NAV_TIMEOUT });
        await settle(mobile);
      });
      results.mobile = {
        device: opts.mobileDevice,
        viewport: device.viewport,
        userAgent: device.userAgent
      };
      if (opts.dismiss.length) {
        results.mobile.dismissed = await runStep(errors, 'mobile:dismiss', () => dismissBanners(mobile, opts.dismiss));
      }
      results.mobile.checks = await runStep(errors, 'mobile:checks', () => mobileChecks(mobile));
      if (opts.withScreenshots) {
        console.log(`  📱 Mobile screenshot (${opts.mobileDevice})...`);
        const shot = await runStep(errors, 'mobile:screenshot', () => takeScreenshot(mobile, path.join(pageDir, 'mobile.png'), 'mobile'));
        if (shot) results.screenshots.push(shot);
      }
    }
  } catch (e) {
    errors.push({ step: 'mobile:setup', error: e.message });
  } finally {
    await mobile.close().catch(() => {});
  }

  if (!opts.withScreenshots) console.log('  ⏭️  Screenshots off (pass --with-screenshots for reference images)');

  await fs.writeFile(path.join(pageDir, 'analysis.json'), JSON.stringify(results, null, 2));
  console.log(errors.length ? `  ⚠️  Done with ${errors.length} failed step(s): ${pageDir}` : `  ✅ Complete: ${pageDir}`);
  return results;
}

// ============================================================================
// CLI
// ============================================================================

function argValue(args, flag) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
}

const HELP = `
UX Audit - Site Capture Tool

Usage: node capture-site.js <url> [options]

Options:
  --pages <file.json>       JSON array of { name, path } pages to capture
  --output <dir>            Output directory (default: ./audit-output)
  --skip-a11y               Skip the axe-core run
  --with-screenshots        Save desktop.png / mobile.png reference images
                            (off by default; deliverable screenshots are still
                            captured and annotated by the auditor)
  --dismiss "<sel>,<sel>"   CSS selectors to click to dismiss cookie/consent
                            banners before capturing (comma-separated)
  --mobile-device <name>    Puppeteer KnownDevices profile (default: "${DEFAULT_MOBILE_DEVICE}")
  --tab-count <n>           Tab presses for the focus test (default: ${DEFAULT_TAB_COUNT})

Example:
  node capture-site.js https://example.com
  node capture-site.js https://example.com --pages pages.json --output ./my-audit \\
    --dismiss "#onetrust-accept-btn-handler,.cookie-accept" --with-screenshots
`;

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args[0].startsWith('--')) {
    console.log(HELP);
    process.exit(args.includes('--help') ? 0 : 1);
  }

  const baseUrl = args[0];
  const opts = {
    skipA11y: args.includes('--skip-a11y'),
    withScreenshots: args.includes('--with-screenshots') || SCREENSHOTS_ENABLED_DEFAULT,
    dismiss: (argValue(args, '--dismiss') || '').split(',').map(s => s.trim()).filter(Boolean),
    mobileDevice: argValue(args, '--mobile-device') || DEFAULT_MOBILE_DEVICE,
    tabCount: parseInt(argValue(args, '--tab-count') || DEFAULT_TAB_COUNT, 10)
  };
  if (!KnownDevices[opts.mobileDevice]) {
    console.error(`Unknown --mobile-device "${opts.mobileDevice}". Examples: ${Object.keys(KnownDevices).filter(k => /iPhone 1[2-5]|Pixel/.test(k)).slice(0, 6).join(', ')}`);
    process.exit(1);
  }

  let pages = DEFAULT_PAGES;
  const pagesFile = argValue(args, '--pages');
  if (pagesFile) pages = JSON.parse(await fs.readFile(pagesFile, 'utf-8'));
  const outputDir = argValue(args, '--output') || './audit-output';

  console.log(`
╔════════════════════════════════════════════╗
║         UX AUDIT - SITE CAPTURE            ║
╚════════════════════════════════════════════╝

🌐 Target: ${baseUrl}
📁 Output: ${outputDir}
📄 Pages:  ${pages.length}
📱 Mobile: ${opts.mobileDevice}
📸 Screenshots: ${opts.withScreenshots ? 'ON (reference only)' : 'OFF (default)'}
`);

  await fs.mkdir(outputDir, { recursive: true });
  console.log('🚀 Launching browser...');
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });

  const allResults = [];
  try {
    for (const pageConfig of pages) {
      allResults.push(await capturePage(browser, baseUrl, pageConfig, outputDir, opts));
    }

    const summary = {
      baseUrl,
      capturedAt: new Date().toISOString(),
      tool: {
        puppeteer: require('puppeteer/package.json').version,
        axeCore: allResults.find(r => r.accessibility?.axeVersion)?.accessibility.axeVersion || null,
        browser: await browser.version()
      },
      options: opts,
      pagesAnalyzed: allResults.length,
      pages: allResults.map(r => ({
        name: r.pageName,
        url: r.url,
        failedSteps: r.errors,
        a11yViolations: r.accessibility?.violations?.length ?? null,
        a11yIncomplete: r.accessibility?.incomplete?.length ?? null,
        unlabelledFields: r.pageData?.stats.unlabelledFields ?? null,
        imagesMissingAlt: r.pageData?.imagesMissingAlt.length ?? null,
        focusStopsWithoutIndicator: r.keyboardFocus?.withoutFocusIndicator.length ?? null,
        focusLost: r.keyboardFocus?.focusLost.length ?? null,
        screenshots: r.screenshots.map(s => s.file)
      }))
    };
    summary.failedSteps = summary.pages.flatMap(p => p.failedSteps.map(e => ({ page: p.name, ...e })));

    await fs.writeFile(path.join(outputDir, 'capture-summary.json'), JSON.stringify(summary, null, 2));

    console.log(`
╔════════════════════════════════════════════╗
║              CAPTURE COMPLETE              ║
╚════════════════════════════════════════════╝

📊 Pages captured: ${allResults.length}   Output: ${outputDir}
${summary.failedSteps.length
    ? '⚠️  Failed steps:\n' + summary.failedSteps.map(f => `   - ${f.page} › ${f.step}: ${f.error}`).join('\n')
    : '✅ No failed steps'}

📁 Files: capture-summary.json, [page]/analysis.json${opts.withScreenshots ? ', [page]/desktop.png, [page]/mobile.png' : ''}
`);
  } finally {
    await browser.close();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
