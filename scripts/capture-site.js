#!/usr/bin/env node

/**
 * UX Audit - Browser Capture Script
 * 
 * Captures screenshots and page data for UX audit analysis.
 * Usage: node capture-site.js <url> [--pages <urls.json>] [--output <dir>]
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// Viewport configurations
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 375, height: 812 }
};

// Screenshot capture is disabled by default as of 2026-07 — output accuracy
// issues surfaced in production use are still being investigated. DOM/a11y/
// text extraction below is unaffected and still runs normally. Pass
// --with-screenshots to re-enable while testing a fix.
const SCREENSHOTS_ENABLED_DEFAULT = false;

// Default pages to capture if not specified
const DEFAULT_PAGES = [
  { name: 'homepage', path: '/' }
];

async function captureScreenshot(page, outputPath, viewport) {
  await page.setViewport(viewport);
  await page.waitForTimeout(1000); // Allow reflow
  await page.screenshot({ path: outputPath, fullPage: true });
}

async function extractPageData(page) {
  return await page.evaluate(() => {
    // Extract heading structure
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .map(h => ({
        level: parseInt(h.tagName[1]),
        text: h.textContent.trim().substring(0, 100)
      }));

    // Extract links
    const links = Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({
        text: a.textContent.trim().substring(0, 50),
        href: a.href,
        isExternal: !a.href.startsWith(window.location.origin)
      }));

    // Extract images without alt text
    const imagesWithoutAlt = Array.from(document.querySelectorAll('img'))
      .filter(img => !img.alt || img.alt.trim() === '')
      .map(img => img.src);

    // Extract form fields
    const formFields = Array.from(document.querySelectorAll('input, select, textarea'))
      .map(field => ({
        type: field.type || field.tagName.toLowerCase(),
        name: field.name,
        id: field.id,
        hasLabel: !!document.querySelector(`label[for="${field.id}"]`),
        placeholder: field.placeholder
      }));

    // Extract buttons
    const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]'))
      .map(btn => ({
        text: btn.textContent?.trim().substring(0, 50) || btn.value,
        type: btn.type
      }));

    // Check color contrast (simplified)
    const bodyStyles = window.getComputedStyle(document.body);
    
    // Get page metadata
    const title = document.title;
    const metaDescription = document.querySelector('meta[name="description"]')?.content;
    const lang = document.documentElement.lang;

    return {
      title,
      metaDescription,
      lang,
      headings,
      links: links.slice(0, 50), // Limit for large sites
      imagesWithoutAlt,
      formFields,
      buttons,
      stats: {
        totalLinks: links.length,
        totalImages: document.querySelectorAll('img').length,
        totalForms: document.querySelectorAll('form').length,
        totalButtons: buttons.length
      }
    };
  });
}

async function checkAccessibility(page) {
  // Inject axe-core for accessibility testing
  await page.addScriptTag({
    url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.8.2/axe.min.js'
  });

  const results = await page.evaluate(async () => {
    return await axe.run();
  });

  return {
    violations: results.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      helpUrl: v.helpUrl,
      nodes: v.nodes.length
    })),
    passes: results.passes.length,
    incomplete: results.incomplete.length
  };
}

async function getPageText(page) {
  return await page.evaluate(() => {
    // Get main content text, excluding nav/footer
    const main = document.querySelector('main') || document.body;
    return main.innerText.substring(0, 10000); // Limit for analysis
  });
}

async function testKeyboardNav(page) {
  const focusableElements = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ));
    return elements.map((el, index) => ({
      index,
      tag: el.tagName.toLowerCase(),
      text: el.textContent?.trim().substring(0, 30),
      hasVisibleFocus: window.getComputedStyle(el, ':focus').outlineStyle !== 'none'
    }));
  });

  return {
    totalFocusable: focusableElements.length,
    elements: focusableElements.slice(0, 20) // Sample
  };
}

async function capturePage(browser, baseUrl, pageConfig, outputDir, withScreenshots) {
  const page = await browser.newPage();
  const url = new URL(pageConfig.path, baseUrl).href;
  const pageName = pageConfig.name || pageConfig.path.replace(/\//g, '-') || 'page';

  console.log(`\n📄 Capturing: ${pageName} (${url})`);

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Create page output directory
    const pageDir = path.join(outputDir, pageName);
    await fs.mkdir(pageDir, { recursive: true });

    if (withScreenshots) {
      // Capture desktop screenshot
      console.log('  📸 Desktop screenshot...');
      await captureScreenshot(
        page,
        path.join(pageDir, 'desktop.png'),
        VIEWPORTS.desktop
      );

      // Capture mobile screenshot
      console.log('  📱 Mobile screenshot...');
      await captureScreenshot(
        page,
        path.join(pageDir, 'mobile.png'),
        VIEWPORTS.mobile
      );
    } else {
      console.log('  ⏭️  Screenshots skipped (disabled — see SKILL.md Known Limitations)');
    }

    // Extract page data
    console.log('  🔍 Extracting page data...');
    const pageData = await extractPageData(page);

    // Run accessibility checks
    console.log('  ♿ Running accessibility checks...');
    let a11yResults = { error: 'Skipped' };
    try {
      a11yResults = await checkAccessibility(page);
    } catch (e) {
      a11yResults = { error: e.message };
    }

    // Get page text for readability analysis
    console.log('  📝 Extracting text content...');
    const pageText = await getPageText(page);

    // Test keyboard navigation
    console.log('  ⌨️ Analyzing keyboard navigation...');
    const keyboardNav = await testKeyboardNav(page);

    // Compile results
    const results = {
      url,
      pageName,
      capturedAt: new Date().toISOString(),
      pageData,
      accessibility: a11yResults,
      keyboardNav,
      textContent: pageText
    };

    // Save results
    await fs.writeFile(
      path.join(pageDir, 'analysis.json'),
      JSON.stringify(results, null, 2)
    );

    console.log(`  ✅ Complete: ${pageDir}`);
    return results;

  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return { url, pageName, error: error.message };
  } finally {
    await page.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
UX Audit - Site Capture Tool

Usage: node capture-site.js <url> [options]

Options:
  --pages <file.json>     JSON file with pages to capture
  --output <dir>          Output directory (default: ./audit-output)
  --skip-a11y             Skip accessibility testing
  --with-screenshots      Re-enable screenshot capture (disabled by default —
                          see SKILL.md Known Limitations before using)

Example:
  node capture-site.js https://example.com
  node capture-site.js https://example.com --pages pages.json --output ./my-audit
    `);
    process.exit(1);
  }

  const baseUrl = args[0];
  const pagesIndex = args.indexOf('--pages');
  const outputIndex = args.indexOf('--output');
  const skipA11y = args.includes('--skip-a11y');
  const withScreenshots = args.includes('--with-screenshots') || SCREENSHOTS_ENABLED_DEFAULT;

  let pages = DEFAULT_PAGES;
  if (pagesIndex !== -1 && args[pagesIndex + 1]) {
    const pagesFile = await fs.readFile(args[pagesIndex + 1], 'utf-8');
    pages = JSON.parse(pagesFile);
  }

  const outputDir = outputIndex !== -1 && args[outputIndex + 1]
    ? args[outputIndex + 1]
    : './audit-output';

  console.log(`
╔════════════════════════════════════════════╗
║         UX AUDIT - SITE CAPTURE            ║
╚════════════════════════════════════════════╝

🌐 Target: ${baseUrl}
📁 Output: ${outputDir}
📄 Pages:  ${pages.length}
📸 Screenshots: ${withScreenshots ? 'ON' : 'OFF (disabled by default, see SKILL.md)'}
`);

  // Create output directory
  await fs.mkdir(outputDir, { recursive: true });

  // Launch browser
  console.log('🚀 Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const allResults = [];

  try {
    // Capture each page
    for (const pageConfig of pages) {
      const results = await capturePage(browser, baseUrl, pageConfig, outputDir, withScreenshots);
      allResults.push(results);
    }

    // Save summary
    const summary = {
      baseUrl,
      capturedAt: new Date().toISOString(),
      pagesAnalyzed: allResults.length,
      pages: allResults.map(r => ({
        name: r.pageName,
        url: r.url,
        hasError: !!r.error,
        a11yViolations: r.accessibility?.violations?.length || 0
      }))
    };

    await fs.writeFile(
      path.join(outputDir, 'capture-summary.json'),
      JSON.stringify(summary, null, 2)
    );

    console.log(`
╔════════════════════════════════════════════╗
║              CAPTURE COMPLETE              ║
╚════════════════════════════════════════════╝

📊 Summary:
   Pages captured: ${allResults.length}
   Output folder:  ${outputDir}

📁 Files created:
   - capture-summary.json
   - [page]/analysis.json${withScreenshots ? '\n   - [page]/desktop.png\n   - [page]/mobile.png' : ''}

Next: Run UX analysis on the captured data.
`);

  } finally {
    await browser.close();
  }
}

main().catch(console.error);
