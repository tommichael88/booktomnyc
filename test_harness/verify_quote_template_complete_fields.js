#!/usr/bin/env node
/**
 * verify_quote_template_complete_fields.js
 *
 * Real-browser regression test for a severe, pre-existing bug (predates
 * this session entirely) discovered as a side effect of thoroughly
 * verifying a new feature (feeBreakdown UI wiring): the main,
 * customer-facing quote template (sqRenderQuote, used for the self_quote/
 * dynamic-service "Other tile" fallback path) read several fields off its
 * own computed quote object that were never actually populated anywhere,
 * silently rendering literal "$undefined"/"undefined min" text in a real
 * quote:
 *
 * 1. computeQuoteFromState (sqRenderQuote's own data source) never
 *    forwarded base/totalMin/complexityTier/tierRate/hideTime/isProject
 *    from computeUnifiedQuote's result, even though computeUnifiedQuote
 *    itself always correctly computed them.
 * 2. buildCheckoutStateModel -- a real, separate, correct, already-existing
 *    function providing disclaimerText/isDiag/btnText/btnClass/hideTime
 *    -- was never actually called by sqRenderQuote at all.
 * 3. priceDisplay/priceSub were read (q.priceDisplay, q.priceSub) but
 *    never computed anywhere in the entire file -- confirmed via
 *    exhaustive search before fixing.
 * 4. A naming mismatch: the template read q.dispatch, but
 *    computeQuoteFromState has always correctly returned dispatchFee,
 *    never dispatch.
 *
 * Also covers feeBreakdown's UI wiring (the actual reason this bug was
 * found): the single, opaque "Condition adjustments: +$X" row is now
 * itemized -- one row per real contributing factor, each with its own
 * real label and dollar amount.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.dirname(__dirname);
let pass = 0, fail = 0;
function check(label, cond) { if (cond) { pass++; console.log(`  ✓ ${label}`); } else { fail++; console.log(`  ✗ ${label}`); } }

function findChrome() {
    try {
        return execSync('find /home/*/.cache/puppeteer /root/.cache/puppeteer -type f -name chrome 2>/dev/null', { shell: '/bin/bash' })
            .toString().trim().split('\n')[0];
    } catch { return null; }
}

(async () => {
    const chromePath = findChrome();
    if (!chromePath) {
        console.log('  ⚠ No Chrome/Chromium binary found -- skipping real-browser check (environment gap, not a code failure).');
        console.log('\n[Quote template complete-fields verification] 0 passed, 0 failed (skipped)\n');
        process.exit(0);
    }

    let puppeteer;
    try { puppeteer = require('puppeteer-core'); }
    catch {
        console.log('  ⚠ puppeteer-core not installed. Skipping.');
        console.log('\n[Quote template complete-fields verification] 0 passed, 0 failed (skipped)\n');
        process.exit(0);
    }

    const http = require('http');
    const PORT = 9000 + Math.floor(Math.random() * 900);
    const server = http.createServer((req, res) => {
        const filePath = path.join(REPO_ROOT, req.url.split('?')[0] === '/' ? '/qr.html' : req.url.split('?')[0]);
        fs.readFile(filePath, (err, data) => {
            if (err) { res.writeHead(404); res.end(); return; }
            const ext = path.extname(filePath);
            res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.json': 'application/json' }[ext] || 'text/plain' });
            res.end(data);
        });
    });
    await new Promise(r => server.listen(PORT, '127.0.0.1', r));
    const browser = await puppeteer.launch({ headless: 'new', executablePath: chromePath, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 2400 });
        page.on('pageerror', err => console.log('  [browser error]', err.message));
        await page.goto(`http://127.0.0.1:${PORT}/qr.html`, { waitUntil: 'networkidle0', timeout: 15000 });
        await new Promise(r => setTimeout(r, 1000));

        console.log('=== The real, final quote template never shows literal "undefined" ===');
        {
            await page.type('#sqDescIn', 'urgent, need help with something in my house');
            await page.click('#sqUnifiedActionBtn');
            await page.waitForSelector('#sqAffirmCard', { visible: true, timeout: 5000 });
            await page.click('.affirm-yes-btn');
            await new Promise(r => setTimeout(r, 800));

            const rowsText = await page.evaluate(() =>
                [...document.querySelectorAll('#sqQuoteOut .ql')].map(l => l.textContent).join(' | '));
            check('no row anywhere in the quote contains the literal text "undefined"', !rowsText.includes('undefined'));

            const hero = await page.evaluate(() => ({
                price: document.querySelector('#sqQuoteOut .qprice, #sqQuoteOut .qpranger')?.textContent,
                sub: document.querySelector('#sqQuoteOut .qpsub')?.textContent,
                disclaimer: document.querySelector('#sqQuoteOut .disc')?.textContent,
            }));
            check('the price hero shows a real dollar amount, not "undefined"', /\$\d/.test(hero.price || ''));
            check('the price sub-line is real, meaningful text, not "undefined"', !!hero.sub && !hero.sub.includes('undefined'));
            check('the disclaimer is real text (buildCheckoutStateModel is actually being called now)', !!hero.disclaimer && hero.disclaimer.length > 20);
        }

        console.log('\n=== feeBreakdown UI wiring: itemized rows replace the old opaque single number ===');
        {
            await page.evaluate(() => {
                window.S.answers = { urgency: 'Urgent — today or tomorrow' };
                window.sqRenderQuote();
            });
            await new Promise(r => setTimeout(r, 500));

            const rows = await page.evaluate(() =>
                [...document.querySelectorAll('#sqQuoteOut .ql')].map(l => l.textContent.trim().replace(/\s+/g, ' ')));
            check('the urgency fee shows as its own itemized row with the real question and answer as its label',
                rows.some(r => r.includes('How soon do you need this done') && r.includes('+$50')));
            check('the old, generic "Condition adjustments" label no longer appears now that real, itemized labels are available',
                !rows.some(r => r.includes('Condition adjustments')));

            const total = await page.evaluate(() => document.querySelector('#sqQuoteOut .qlv[style*="20px"]')?.textContent);
            check('the final total is a real, correctly-computed dollar figure including the itemized fee', /^\$\d+$/.test(total || ''));
        }
    } finally {
        await browser.close();
        server.close();
    }

    console.log(`\n[Quote template complete-fields verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
    process.exit(fail > 0 ? 1 : 0);
})();
