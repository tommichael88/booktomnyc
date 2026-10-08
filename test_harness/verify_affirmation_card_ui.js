#!/usr/bin/env node
/**
 * verify_affirmation_card_ui.js
 *
 * Real browser automation (Puppeteer, connected to an actual Chrome
 * binary -- not jsdom) for the affirmation card UI flow (T33/T36). This
 * is a genuinely different, necessary class of test: every other test in
 * this harness checks DOM presence or computed logic, never actual CSS
 * visibility the way a real browser enforces it. That gap let 4 real,
 * severe bugs ship completely undetected -- the feature was built,
 * function-level-tested, and "functionally verified" for an entire
 * session, but never actually visible to a real customer in a real
 * browser:
 *
 *   1. sqTagLabel's arguments were swapped at this one call site (all 12
 *      other call sites elsewhere in the file were correct) -- every chip
 *      showed the customer's service type ("Repair") instead of the
 *      tag's real phrase ("urgent / same-day").
 *   2. renderTagAffirmationCard sets its container to display:block, then
 *      immediately calls enterFocusedMode(), which unconditionally
 *      force-hid that exact same container -- the card never became
 *      visible at all, hidden by the very function that renders it.
 *   3. sqRenderQuote populated #sqQuoteOut's content but never made the
 *      container visible (no CSS rule did either) -- the quote, after
 *      affirming, also never became visible.
 *   4. sqAffirmNo() ("let me explain further") never called the existing,
 *      correct exitFocusedMode() -- the text input stayed hidden inside
 *      the still-force-hidden sqTextBar, so .focus() silently failed.
 *
 * Needs a real Chrome/Chromium binary. Uses puppeteer-core (no bundled
 * download) pointed at whatever binary is actually available --
 * confirmed one already exists in this environment at
 * ~/.cache/puppeteer/chrome/. If genuinely unavailable, skips gracefully
 * rather than failing the whole suite over an environment gap.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.dirname(__dirname);
let pass = 0, fail = 0, skipped = false;
function check(label, cond) { if (cond) { pass++; console.log(`  ✓ ${label}`); } else { fail++; console.log(`  ✗ ${label}`); } }

function findChrome() {
    const candidates = [
        process.env.CHROME_PATH,
        ...(() => {
            try {
                // Explicit paths, not `~` expansion -- $HOME may not match
                // where the actual binary was installed (e.g. root vs. the
                // user running this process).
                // v9.6+ FIX (2026-08-28 recovery session): find's overall
                // exit code goes nonzero when ANY of the multiple search
                // roots doesn't exist (e.g. /root/.cache/puppeteer, when
                // this process doesn't run as root) -- even though it
                // still successfully finds the binary under the OTHER
                // root and prints it to stdout. execSync throws on that
                // nonzero exit by default, and the catch below was
                // discarding the successful result along with it.
                // Confirmed directly: this silently made the whole
                // function report "no Chrome found" (0/0, skipped, exits
                // 0 -- indistinguishable from passing in run_all.sh's
                // summary) even with a real, working binary present.
                // `|| true` keeps the shell's own exit code 0 regardless,
                // since stdout is what's actually being read here, not
                // the exit code.
                return execSync('find /home/*/.cache/puppeteer /root/.cache/puppeteer -type f -name chrome 2>/dev/null || true', { shell: '/bin/bash' })
                    .toString().trim().split('\n').filter(Boolean);
            } catch { return []; }
        })(),
        '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
    ].filter(Boolean);
    for (const c of candidates) {
        if (c && fs.existsSync(c)) return c;
    }
    return null;
}

(async () => {
    const chromePath = findChrome();
    if (!chromePath) {
        console.log('  ⚠ No Chrome/Chromium binary found -- skipping real-browser UI test (environment gap, not a code failure).');
        console.log('\n[Affirmation card UI, real browser] 0 passed, 0 failed (skipped)\n');
        process.exit(0);
    }

    let puppeteer;
    try {
        puppeteer = require('puppeteer-core');
    } catch {
        console.log('  ⚠ puppeteer-core not installed -- run `npm install puppeteer-core` in test_harness/. Skipping.');
        console.log('\n[Affirmation card UI, real browser] 0 passed, 0 failed (skipped)\n');
        process.exit(0);
    }

    const http = require('http');
    const PORT = 8917 + Math.floor(Math.random() * 500); // avoid collisions with any leftover server
    const server = http.createServer((req, res) => {
        const filePath = path.join(REPO_ROOT, decodeURIComponent(req.url.split('?')[0]) === '/' ? '/qr.html' : req.url.split('?')[0]);
        fs.readFile(filePath, (err, data) => {
            if (err) { res.writeHead(404); res.end(); return; }
            const ext = path.extname(filePath);
            const type = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript' }[ext] || 'text/plain';
            res.writeHead(200, { 'Content-Type': type });
            res.end(data);
        });
    });
    await new Promise(resolve => server.listen(PORT, '127.0.0.1', resolve));

    const browser = await puppeteer.launch({
        headless: 'new', executablePath: chromePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 2000 });
        page.on('pageerror', err => console.log('  [browser error]', err.message));

        await page.goto(`http://127.0.0.1:${PORT}/qr.html`, { waitUntil: 'networkidle0', timeout: 15000 });
        await new Promise(r => setTimeout(r, 1000));

        const click = (sel) => page.waitForSelector(sel, { timeout: 5000 }).then(() => page.click(sel));
        const waitFor = (sel) => page.waitForSelector(sel, { visible: true, timeout: 5000 });

        console.log('=== Real browser: the affirmation card flow works end-to-end ===');

        await page.type('#sqDescIn', 'urgent, need help with something in my house');
        await click('#sqUnifiedActionBtn');
        await waitFor('#sqAffirmCard');
        check('Affirmation card genuinely becomes visible (not just present in the DOM) for a low-confidence + tagged phrase', true);

        const chipText = await page.$eval('.affirm-chip', el => el.textContent);
        check(`Chip shows the real tag phrase, not the customer's service type ("${chipText.trim()}")`, chipText.includes('urgent'));

        const priceText = await page.$eval('.affirm-price', el => el.textContent);
        check(`Price preview is shown ("${priceText}")`, priceText.includes('$'));

        await click('.affirm-yes-btn');
        // T70: sqAnalyze is now a real, thin dispatcher to
        // executeWorkflow/renderRoute -- confirming became curated_card
        // (renderCuratedCardFromRoute), which renders into
        // #intakeQuestionsContainer with a real .price-value total, not
        // the retired #sqQuoteOut/.qlv (sqRenderQuote's own elements,
        // which the new flow never touches). Scoped to
        // #intakeQuestionsContainer specifically -- confirmed via direct
        // real-browser inspection that the bare .price-value class alone
        // matches a different, unrelated, hidden element elsewhere on
        // the page (a cart/checkout modal's own price display,
        // #current-estimate) that comes first in DOM order; the real,
        // correct element inside #intakeQuestionsContainer is genuinely
        // visible.
        await waitFor('#intakeQuestionsContainer .price-value');
        const totalLine = await page.$eval('#intakeQuestionsContainer .price-value', el => el.textContent);
        check(`Quote genuinely becomes visible after affirmation with a real total ("${totalLine}")`, totalLine.includes('$'));

        // T70: the old #sqQuoteOut .ctag "change" button has no direct
        // equivalent in the new flow -- confirmed directly that #sqDescIn
        // remains present and fully functional for a fresh submission
        // regardless of its own current visibility, so this sets its
        // value directly rather than depend on a specific restart
        // affordance this test doesn't actually need to verify.
        await page.evaluate(() => { document.getElementById('sqDescIn').value = ''; });
        await new Promise(r => setTimeout(r, 300));
        await page.evaluate((text) => {
            document.getElementById('sqDescIn').value = text;
            window.sqAnalyze();
        }, 'urgent, need help with something in my house');
        await new Promise(r => setTimeout(r, 500));
        await waitFor('#sqAffirmCard');
        await click('.affirm-no-btn');
        await new Promise(r => setTimeout(r, 500));
        const textareaFocused = await page.evaluate(() => document.activeElement === document.getElementById('sqDescIn'));
        check(`"Let me explain further" genuinely returns visible focus to the text input`, textareaFocused);

        await page.evaluate(() => { document.getElementById('sqDescIn').value = ''; });
        // T118: was "...with pets present" -- pets_present and its
        // #pets_on_site smart tag were deleted catalog-wide (fee: 0,
        // could never meaningfully change a price, per the operator's
        // own explicit removal principle). "no parking" still triggers a
        // real, distinct tag (#no_parking).
        await page.type('#sqDescIn', 'urgent issue somewhere in the house, no parking available');
        await click('#sqUnifiedActionBtn');
        await waitFor('#sqAffirmCard');
        const chipsBefore = await page.$$('.affirm-chip');
        check(`Multiple chips present before removal (found ${chipsBefore.length})`, chipsBefore.length >= 2);
        await page.click('.affirm-chip');
        await new Promise(r => setTimeout(r, 300));
        const chipsAfter = await page.$$('.affirm-chip');
        check(`Removing one chip leaves exactly one fewer (${chipsBefore.length} -> ${chipsAfter.length})`, chipsAfter.length === chipsBefore.length - 1);

    } catch (err) {
        fail++;
        console.log(`  ✗ Real-browser test threw: ${err.message}`);
    } finally {
        await browser.close();
        server.close();
    }

    console.log(`\n[Affirmation card UI, real browser] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
    process.exit(fail > 0 ? 1 : 0);
})();
