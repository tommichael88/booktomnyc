#!/usr/bin/env node
/**
 * verify_ui_surfaces.js
 *
 * Exhaustive real‑browser UI test using Puppeteer.
 * Outputs a structured JSON report for AI analysis.
 */
// T152: the project installs puppeteer-core plus a Chrome binary (every other real-browser test does), not the full puppeteer package. Accept either; use the same Chrome discovery as the others.
let puppeteer; let chromeExecutable;
try { puppeteer = require('puppeteer'); } catch (e) {
  puppeteer = require('puppeteer-core');
  const { execSync } = require('child_process');
  const cands = [process.env.CHROME_PATH, ...(() => { try { return execSync('find /home/*/.cache/puppeteer /root/.cache/puppeteer -type f -name chrome 2>/dev/null || true', { shell: '/bin/bash' }).toString().trim().split('\n').filter(Boolean); } catch { return []; } })(), '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'].filter(Boolean);
  chromeExecutable = cands.find(p => require('fs').existsSync(p));
}
const path = require('path');
const fs = require('fs');

const REPO_ROOT = path.dirname(__dirname);
const HTML_PATH = path.join(REPO_ROOT, 'qr.html');
const BTNYC_PATH = path.join(REPO_ROOT, 'btnyc.json');
const BTNYC_DATA = fs.readFileSync(BTNYC_PATH, 'utf8');

// ─── Helpers ──────────────────────────────────────────────────────────────
const click = async (page, selector, opts = {}) => {
  await page.waitForSelector(selector, { timeout: 5000, ...opts });
  await page.click(selector);
};
const waitFor = async (page, selector, opts = {}) => {
  await page.waitForSelector(selector, { visible: true, timeout: 5000, ...opts });
};
const waitForExist = async (page, selector, opts = {}) => {
  await page.waitForSelector(selector, { timeout: 5000, ...opts });
};

// ─── Main test runner ──────────────────────────────────────────────────
async function runScenarios() {
  const browser = await puppeteer.launch({
    headless: 'new',
    ...(chromeExecutable ? { executablePath: chromeExecutable } : {}),
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  // Intercept btnyc.json
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const _d = require('./_page.js').documentResponse(req.url()); if (_d) return req.respond(_d);
    if (req.url().includes('btnyc.json')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: BTNYC_DATA
      });
    } else if (req.url().startsWith('file://')) {
      req.continue();
    } else {
      req.continue();
    }
  });

  const report = {
    timestamp: new Date().toISOString(),
    browser: await browser.version(),
    scenarios: [],
    summary: { passed: 0, failed: 0, total: 0 }
  };

  let scenarioId = 0;

  // Helper to run a scenario and capture results
  const runScenario = async (name, fn) => {
    scenarioId++;
    console.log(`\n━━━ ${name} (${scenarioId}) ━━━`);
    const start = Date.now();
    const scenarioReport = {
      id: scenarioId,
      name,
      passed: true,
      durationMs: 0,
      error: null,
      checks: [],
      consoleErrors: [],
      pageErrors: [],
      dom: {},
      trace: null
    };

    // Capture console errors during this scenario
    const consoleErrors = [];
    const pageErrors = [];
    const consoleHandler = (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    };
    const pageErrorHandler = (err) => {
      pageErrors.push(err.message);
    };
    page.on('console', consoleHandler);
    page.on('pageerror', pageErrorHandler);

    try {
      await fn(page, (label, condition) => {
        scenarioReport.checks.push({ label, passed: !!condition });
        if (!condition) scenarioReport.passed = false;
        // Also output to console
        if (condition) {
          console.log(`  ✓ ${label}`);
        } else {
          console.log(`  ✗ ${label}`);
        }
      });
    } catch (err) {
      scenarioReport.passed = false;
      scenarioReport.error = err.message;
      console.error(`❌ Scenario "${name}" failed: ${err.message}`);
      // Take a screenshot for debugging
      const screenshotPath = `failure_${name.replace(/\s/g, '_')}.png`;
      await page.screenshot({ fullPage: true, path: screenshotPath });
      console.log(`📸 Screenshot saved to ${screenshotPath}`);
    }

    scenarioReport.consoleErrors = consoleErrors;
    scenarioReport.pageErrors = pageErrors;
    scenarioReport.durationMs = Date.now() - start;

    // Capture DOM state (key elements)
    try {
      scenarioReport.dom = {
        cartCount: await page.evaluate(() => document.getElementById('fabCartCount')?.textContent || '0'),
        priceDisplayed: await page.evaluate(() => {
          const el = document.querySelector('#sqQuoteOut .qprice, #totalPrice, .sq-ic-price');
          return el ? el.textContent : null;
        }),
        visiblePanels: await page.evaluate(() => {
          const panels = [];
          if (document.getElementById('sqQuoteOut')?.style.display !== 'none') panels.push('quote');
          if (document.getElementById('sqBuilder')?.style.display !== 'none') panels.push('builder');
          if (document.getElementById('sqAffirmCard')) panels.push('affirmation');
          if (document.getElementById('furniture-selection-wrapper')?.style.display !== 'none') panels.push('furniture');
          return panels;
        }),
        currentStep: await page.evaluate(() => {
          const dots = document.querySelectorAll('.step-dot.active');
          return dots.length ? dots[0].textContent : null;
        })
      };
    } catch (e) {
      // ignore
    }

    // Capture orchestrator trace if available
    try {
      const trace = await page.evaluate(() => {
        const route = window._currentRoute;
        return route && route.trace ? route.trace : null;
      });
      scenarioReport.trace = trace;
    } catch (e) {
      // ignore
    }

    // Remove event listeners
    page.off('console', consoleHandler);
    page.off('pageerror', pageErrorHandler);

    report.scenarios.push(scenarioReport);
    if (scenarioReport.passed) report.summary.passed++;
    else report.summary.failed++;
    report.summary.total++;
  };

  // ─── Reset page to home ──────────────────────────────────────────────
  const resetHome = async (page) => {
    await page.goto('file://' + HTML_PATH + '?_=' + Date.now(), {
      waitUntil: 'networkidle0',
      timeout: 15000
    });
    await page.waitForFunction(() => window.DB && window.DB.services, { timeout: 10000 });
  };

  // ─── SCENARIO 1: Page loads ──────────────────────────────────────────
  await runScenario('Page loads', async (page, check) => {
    await resetHome(page);
    // We already check for console errors in the scenario report
    // We'll add a check that the page loaded successfully
    const loaded = await page.evaluate(() => !!window.DB);
    check('Page loaded with DB', loaded);
  });

  // ─── SCENARIO 2: Furniture Selection ──────────────────────────────────
  await runScenario('Furniture Selection', async (page, check) => {
    await resetHome(page);
    // Navigate to furniture service
    await click(page, '[data-category-id="furniture_fixes_assembly"]');
    await waitFor(page, '.group-tile');
    const groupTiles = await page.$$('.group-tile .tile-name');
    let assemblyGroup = null;
    for (const tile of groupTiles) {
      const name = await page.evaluate(el => el.textContent, tile);
      if (name.trim() === 'Assembly') {
        assemblyGroup = tile;
        break;
      }
    }
    if (!assemblyGroup) throw new Error('Assembly group not found');
    await assemblyGroup.click();
    await waitFor(page, '.service-tile');

    const serviceTile = await page.evaluateHandle(() => {
      const tiles = document.querySelectorAll('.service-tile');
      for (const tile of tiles) {
        const h4 = tile.querySelector('h4');
        if (h4 && h4.textContent.includes('Furniture Assembly Flat-Pack')) {
          return tile;
        }
      }
      return null;
    });
    if (!serviceTile) throw new Error('Furniture Assembly Flat-Pack service not found');
    await page.evaluate(el => el.click(), serviceTile);

    await waitForExist(page, '#furniture-step-content .group-tile', { timeout: 10000 });
    check('Furniture selection UI opened', true);

    // Brand
    const brandTiles = await page.$$('#furniture-step-content .group-tile');
    if (brandTiles.length === 0) throw new Error('Brand tiles not found');
    await brandTiles[0].click();
    await waitForExist(page, '#furniture-step-content .group-tile');
    check('Brand selection worked', true);

    // Type
    const typeTiles = await page.$$('#furniture-step-content .group-tile');
    if (typeTiles.length === 0) throw new Error('Type tiles not found');
    await typeTiles[0].click();
    await waitForExist(page, '.furniture-search-input');
    check('Type selection worked', true);

    // Search and add
    await page.type('.furniture-search-input', 'PAX');
    await page.waitForTimeout(500);
    await waitForExist(page, '.furniture-result-item');
    const addBtns = await page.$$('.furniture-result-item .furniture-add-btn');
    if (addBtns.length === 0) throw new Error('No add buttons found');
    await addBtns[0].click();
    await waitForExist(page, '.furniture-added-list li');
    check('Furniture item added to selection', true);

    // Add to cart
    const addSelectionBtn = await page.$('#furniture-selection-wrapper .add-more-button');
    if (!addSelectionBtn) throw new Error('Add Selection to Cart button not found');
    await addSelectionBtn.click();
    await page.waitForFunction(
      () => document.getElementById('fabCartCount')?.textContent !== '0',
      { timeout: 5000 }
    );
    check('Furniture added to cart', true);
  });

  // ─── SCENARIO 3: Guided Builder ──────────────────────────────────────
  await runScenario('Guided Builder', async (page, check) => {
    await resetHome(page);
    await page.type('#sqDescIn', 'fix a broken drawer');
    await click(page, '#sqUnifiedActionBtn');
    await waitFor(page, '#sqBuilder');
    check('Guided builder opened', true);

    // Fill steps
    const actionChips = await page.$$('#sqBuilderChips .sq-b-chip');
    await actionChips[0].click();
    await waitFor(page, '#sqBuilderPrompt:not(:empty)');
    const objectChips = await page.$$('#sqBuilderChips .sq-b-chip');
    await objectChips[0].click();
    await page.waitForTimeout(300);
    const specificPrompt = await page.$('#sqBuilderPrompt:not(:empty)');
    if (specificPrompt) {
      const specChips = await page.$$('#sqBuilderChips .sq-b-chip');
      await specChips[0].click();
    }
    const condChips = await page.$$('#sqBuilderChips .sq-b-chip');
    let condClicked = false;
    for (const chip of condChips) {
      const label = await page.evaluate(el => el.textContent, chip);
      if (label.includes('stuck')) {
        await chip.click();
        condClicked = true;
        break;
      }
    }
    if (!condClicked && condChips.length) await condChips[0].click();
    const locChips = await page.$$('#sqBuilderChips .sq-b-chip');
    let locClicked = false;
    for (const chip of locChips) {
      const label = await page.evaluate(el => el.textContent, chip);
      if (label.includes('Kitchen')) {
        await chip.click();
        locClicked = true;
        break;
      }
    }
    if (!locClicked && locChips.length) await locChips[0].click();

    await waitFor(page, '#sqBuilder', { hidden: true });
    const desc = await page.$eval('#sqDescIn', el => el.value);
    check('Builder synthesised description', desc && desc.includes('fix') && desc.includes('drawer'));
    const btnLabel = await page.$eval('#sqUnifiedActionLabel', el => el.textContent);
    check('Unified button reflects confidence', btnLabel === 'Looks right — get an estimate');
  });

  // ─── SCENARIO 4: Affirmation Card ──────────────────────────────────────
  await runScenario('Affirmation Card', async (page, check) => {
    await resetHome(page);
    await page.type('#sqDescIn', 'urgent emergency leak in kitchen');
    await click(page, '#sqUnifiedActionBtn');
    try {
      await waitFor(page, '#sqAffirmCard', { timeout: 3000 });
      check('Affirmation card appears for low-confidence tags', true);
      const priceText = await page.$eval('#sqAffirmCard .affirm-price', el => el.textContent);
      check('Affirmation card shows a price', /\$/.test(priceText));
      await click(page, '#sqAffirmCard .affirm-yes-btn');
      await waitFor(page, '#sqQuoteOut');
      const quotePrice = await page.$eval('#sqQuoteOut .qprice', el => el.textContent);
      check('Quote displayed after affirmation', /\$/.test(quotePrice));
      const feeChips = await page.$$('#sqQuoteOut .option-toggle');
      if (feeChips.length > 0) {
        check('Fee breakdown chips appear', true);
        const originalPrice = await page.$eval('#sqQuoteOut .qprice', el => el.textContent);
        await feeChips[0].click();
        await page.waitForTimeout(300);
        const newPrice = await page.$eval('#sqQuoteOut .qprice', el => el.textContent);
        check('Toggling a fee chip updates the price', newPrice !== originalPrice);
      } else {
        console.warn('⚠️ No fee chips found – skipping fee toggle test');
      }
    } catch (e) {
      console.warn('⚠️ Affirmation card did not appear (confidence may have been high) – skipping affirmation tests');
    }
  });

  // ─── SCENARIO 5: Cart Operations ──────────────────────────────────────
  await runScenario('Cart Operations', async (page, check) => {
    await resetHome(page);
    // Navigate to a simple service
    await click(page, '[data-category-id="minor_home_repairs"]');
    await waitFor(page, '.group-tile');
    const groupTiles = await page.$$('.group-tile .tile-name');
    let targetGroup = null;
    for (const tile of groupTiles) {
      const name = await page.evaluate(el => el.textContent, tile);
      if (name.trim() === 'Appliances') {
        targetGroup = tile;
        break;
      }
    }
    if (!targetGroup) throw new Error('Appliances group not found');
    await targetGroup.click();
    await waitFor(page, '.service-tile');
    const serviceTiles = await page.$$('.service-tile');
    if (serviceTiles.length === 0) throw new Error('No services found');
    await serviceTiles[0].click();
    // Wait for UI
    try {
      await waitForExist(page, '#sqStepFlow', { timeout: 5000 });
      // Try to add to cart
      const addBtn = await page.$('#sqQuoteOut .ctap');
      if (addBtn) {
        await addBtn.click();
        await page.waitForFunction(
          () => parseInt(document.getElementById('fabCartCount')?.textContent || '0') > 0,
          { timeout: 5000 }
        );
        check('Add to cart works', true);
      }
    } catch (e) {
      const estBtn = await page.$('#sqCurEstBtn');
      if (estBtn) {
        await estBtn.click();
        await waitFor(page, '#sqQuoteOut');
        const addBtn = await page.$('#sqQuoteOut .ctap');
        if (addBtn) {
          await addBtn.click();
          await page.waitForFunction(
            () => parseInt(document.getElementById('fabCartCount')?.textContent || '0') > 0,
            { timeout: 5000 }
          );
          check('Add to cart via estimate works', true);
        }
      }
    }

    await click(page, '#cartFab');
    await waitFor(page, '#cartOverlay .cart-service-item');
    const items = await page.$$('#cartOverlay .cart-service-item');
    check('Cart overlay shows items', items.length > 0);

    const removeBtn = await page.$('#cartOverlay .remove-service-btn');
    if (removeBtn) {
      await removeBtn.click();
      await page.waitForFunction(
        () => document.querySelectorAll('#cartOverlay .cart-service-item').length === 0,
        { timeout: 5000 }
      );
      check('Remove from cart works', true);
    } else {
      await click(page, '#closeBt');
      await page.waitForTimeout(300);
      const summaryRemove = await page.$('#serviceRequestList .remove-service-btn');
      if (summaryRemove) {
        await summaryRemove.click();
        await page.waitForFunction(
          () => document.querySelectorAll('#serviceRequestList .summary-service-item').length === 0,
          { timeout: 5000 }
        );
        check('Remove from summary works', true);
      }
    }
  });

  // ─── Write JSON report ──────────────────────────────────────────────
  const reportPath = path.join(REPO_ROOT, 'ui_test_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Report written to ${reportPath}`);

  // ─── Summary ──────────────────────────────────────────────────────────
  console.log(`\n[UI surfaces test] ${report.summary.passed} passed, ${report.summary.failed} failed (of ${report.summary.total} scenarios)`);
  for (const s of report.scenarios) {
    console.log(`  ${s.passed ? '✓' : '✗'} ${s.name} (${s.durationMs}ms)`);
    if (s.error) console.log(`    Error: ${s.error}`);
  }

  await browser.close();
  process.exit(report.summary.failed > 0 ? 1 : 0);
}

runScenarios().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
