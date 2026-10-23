#!/usr/bin/env node
/**
 * verify_affirmation_sentence_grammar.js   (T187)
 *
 * WHAT THIS PROVES. The confirmation sentence is the product's keystone (the Project's Vision: "a fluid, linguistically flawless sentence in natural English"). Its job phrase,
 * affirmJobPhrase(entity), used to produce, on the live page: "a this job job" (no entity resolved: the placeholder was spliced into "a ... job"), "a electrical ..." (no "an"),
 * "a flatscreen mounting (standard) job" (a catalog parenthetical in the sentence) and "a shelf mounting standard ⏰buy-the-hour job" (a clock emoji and its word).
 *
 * Real Chrome: the page's own function is called with entities of each kind. Then the whole path is driven once: a typed job that resolves to no entity shows "your job", not the
 * placeholder, in the card the visitor sees. Three source mutants (the placeholder back, the article dropped, the parenthetical kept) are caught.
 * Skips (loudly: "environment gap") only if there is no Chrome / puppeteer-core.
 */
'use strict';
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..');
const QR = process.env.QR_HTML || path.join(ROOT, 'qr.html');
const PAGE = require('./_page.js');
const RAW = fs.readFileSync(QR, 'utf8');
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (detail ? '\n      ' + detail : '')); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function findChrome() { const c = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium', ...(() => { try { return execSync('find /home/*/.cache/puppeteer /root/.cache/puppeteer -type f -name chrome 2>/dev/null || true', { shell: '/bin/bash' }).toString().trim().split('\n').filter(Boolean); } catch { return []; } })(), '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'].filter(Boolean); return c.find(p => fs.existsSync(p)) || null; }

const CASES = [
    ['a plain name', { ui_taxonomy: { display_name: 'Faucet Repair' } }, 'a faucet repair job'],
    ['a vowel takes "an"', { ui_taxonomy: { display_name: 'Electrical Outlet Install' } }, 'an electrical outlet install job'],
    ['a parenthetical is not spoken', { ui_taxonomy: { display_name: 'Flatscreen Mounting (Standard)' } }, 'a flatscreen mounting job'],
    ['a clock emoji and its word are not spoken', { ui_taxonomy: { display_name: 'Shelf Mounting ⏰Buy-the-Hour' } }, 'a shelf mounting job'],
    ['no name: the id, as words', { id: 'outlet_cover-swap' }, 'an outlet cover swap job'],
    ['nothing resolved: English, not a placeholder', null, 'your job'],
    ['an entity with no name and no id', {}, 'your job'],
];

async function run(puppeteer, chromePath, html) {
    const base = PAGE.DEPLOY_BASE + 'qr.html';
    const browser = await puppeteer.launch({ headless: 'new', executablePath: chromePath, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const out = { phrases: [], card: null, error: null };
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 390, height: 844 });
        await page.setRequestInterception(true);
        page.on('request', rq => {
            const u = rq.url(), bare = u.split(/[?#]/)[0];
            if (bare === base) return rq.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
            const f = PAGE.localFileForUrl(u);
            if (f) return rq.respond({ status: 200, contentType: f.endsWith('.js') ? 'application/javascript' : f.endsWith('.json') ? 'application/json' : 'text/plain', headers: { 'Access-Control-Allow-Origin': '*' }, body: fs.readFileSync(f) });
            if (/^https?:/.test(u)) return rq.abort();
            rq.continue();
        });
        await page.goto(base, { waitUntil: 'load' });
        await page.waitForFunction(() => window.DB && window.DB.services, { timeout: 30000 });
        await sleep(900);
        out.phrases = await page.evaluate((cases) => cases.map(c => { try { return affirmJobPhrase(c[1]); } catch (e) { return 'THROWS ' + e.message; } }), CASES);
        // the whole path: a typed job the engine can route to no named entity (it is a thing the catalog has no entity for)
        await page.type('#sqDescIn', 'install an outlet'); await sleep(400);
        await page.click('#sqUnifiedActionBtn'); await sleep(1400);
        out.card = await page.evaluate(() => { const a = document.querySelector('.affirm-adlib'); return a ? a.textContent.trim() : null; });
    } catch (e) { out.error = e.message; } finally { await browser.close(); }
    return out;
}

(async () => {
    const chromePath = findChrome(); let puppeteer = null; try { puppeteer = require('puppeteer-core'); } catch { /* handled below */ }
    if (!chromePath || !puppeteer) { console.log('\n  environment gap: no Chrome / puppeteer-core here -- SKIPPED. Set CHROME_PATH to run it.'); console.log(`\n[affirmation sentence grammar, T187] 0 passed, 0 failed -- SKIPPED\n`); process.exit(0); }
    console.log('=== 1. the page’s own job phrase ===');
    const real = await run(puppeteer, chromePath, RAW);
    check('the page defines affirmJobPhrase and it ran', !real.error && real.phrases.length === CASES.length, real.error || '');
    CASES.forEach((c, i) => check(c[0] + ': ' + JSON.stringify(c[2]), real.phrases[i] === c[2], 'got ' + JSON.stringify(real.phrases[i])));
    console.log('\n=== 2. the card the visitor sees ===');
    check('a typed job with no resolved entity is never "a this job job"', real.card !== null && !/this job/i.test(real.card), JSON.stringify(real.card));
    check('...and reads as English: "your job" or "a/an ... job"', real.card !== null && /^(your job|an? [a-z][^]*job)$/.test(real.card), JSON.stringify(real.card));
    console.log('\n=== 3. mutants ===');
    const mutants = [
        ['the placeholder is back', h => h.replace("if (!name) return 'your job';", "if (!name) return 'a this job job';"), r => r.phrases[5] !== 'your job'],
        ['the article is always "a"', h => h.replace("(/^[aeiou]/.test(name) ? 'an ' : 'a ')", "'a '"), r => r.phrases[1] !== 'an electrical outlet install job'],
        ['the parenthetical is kept', h => h.replace(".replace(/\\s*\\([^)]*\\)/g, ' ')", ""), r => r.phrases[2] !== 'a flatscreen mounting job'],
    ];
    for (const [name, mutate, caught] of mutants) {
        const html = mutate(RAW);
        if (html === RAW) { check('mutant applies: ' + name, false, 'the mutation did not change the page'); continue; }
        const r = await run(puppeteer, chromePath, html);
        check('mutant is caught: ' + name, !r.error && caught(r), r.error || '');
    }
    console.log(`\n[affirmation sentence grammar, T187] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
    process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.log('TEST ERROR ' + e.stack); process.exit(1); });
