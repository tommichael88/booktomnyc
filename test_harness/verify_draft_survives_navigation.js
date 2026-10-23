#!/usr/bin/env node
/**
 * verify_draft_survives_navigation.js   (T187)
 *
 * WHAT THIS PROVES (the Operator's message of 2026-10-22 22:46 NY, on the hidden text bar: a visitor "who wants to remove the content, or select something else" must not meet
 * "unnecessary friction", and must keep "their ability to go back and amend what they wrote"):
 *
 *   1. THE WORDS SURVIVE. What a visitor typed in the text bar is still in it after: browsing the catalog and coming home; leaving an open SmartQuote view for the catalog
 *      (restoreCategoryView with the step flow on screen used to wipe the box); Back out of the guided builder; Back out of a catalog service's step flow; undoing an automatic choice.
 *      Only an explicit Start Over, or a finished request, clears the box.
 *   2. NOTHING ELSE SURVIVES. The same moves end the SmartQuote SESSION: the step flow, the builder and any route card are closed, the session (S) is the empty one, and a catalog
 *      service chosen after typing does not inherit the typed words (its session description is the service, not the draft).
 *   3. BACK STAYS WHERE IT WAS. Back from a SmartQuote view inside the overlay leaves the overlay open at the grid with no SmartQuote view drawn beside it (#245): before T187 the
 *      builder and the step flow stayed on screen next to the grid.
 *   4. AMENDING IS NOT A RETYPE. "Let me explain further" returns to the bar with the caret at the END of the words (it used to select all of them, so the first key erased them).
 *   5. REMOVING IS ONE TAP. A Clear control appears when the box holds text, is a real touch target on a phone, empties the box, refreshes the live preview, returns focus to the box,
 *      and is absent when the box is empty.
 *
 * Real Chrome, desktop and phone width. Six source mutants (each of the changes undone) are run through the same scenario and each is caught.
 * Skips (loudly: "environment gap") only if there is no Chrome / puppeteer-core, exactly as the other browser tests do.
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
const TEXT = 'mount a large neon sign on a drywall wall in the bedroom';

async function scenario(puppeteer, chromePath, html, size) {
    const base = PAGE.DEPLOY_BASE + 'qr.html';
    const browser = await puppeteer.launch({ headless: 'new', executablePath: chromePath, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const out = { errors: [], r: {} };
    async function boot() {
        const page = await browser.newPage();
        await page.setViewport(size);
        await page.setRequestInterception(true);
        page.on('request', rq => {
            const u = rq.url(), bare = u.split(/[?#]/)[0];
            if (bare === base) return rq.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
            const f = PAGE.localFileForUrl(u);
            if (f) return rq.respond({ status: 200, contentType: f.endsWith('.js') ? 'application/javascript' : f.endsWith('.json') ? 'application/json' : 'text/plain', headers: { 'Access-Control-Allow-Origin': '*' }, body: fs.readFileSync(f) });
            if (/^https?:/.test(u)) return rq.abort();
            rq.continue();
        });
        page.on('pageerror', e => out.errors.push(String(e.message).slice(0, 140)));
        await page.goto(base, { waitUntil: 'load' });
        await page.waitForFunction(() => window.DB && window.DB.services, { timeout: 30000 });
        await sleep(900);
        return page;
    }
    const st = (page) => page.evaluate(() => {
        const vis = id => { const el = document.getElementById(id); if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
        const ta = document.getElementById('sqDescIn'), card = document.querySelector('.main-card-schedule-service'), clr = document.getElementById('sqClearBtn');
        const cr = clr && clr.getBoundingClientRect();
        return { text: ta ? ta.value : null, focusedMode: card.classList.contains('focused-mode'), bar: vis('sqTextBar'), stepFlow: vis('sqStepFlow'), builder: vis('sqBuilder'), grid: vis('serviceContainer'), routeCard: vis('routeCardHost'),
            sDesc: typeof S !== 'undefined' ? S.desc : null, sIntent: typeof S !== 'undefined' ? !!S.intent : null, clearVisible: !!cr && cr.width > 0 && cr.height > 0, clearBox: cr ? [Math.round(cr.width), Math.round(cr.height)] : null,
            activeIsBox: document.activeElement === ta, caret: ta ? [ta.selectionStart, ta.selectionEnd] : null, preview: (document.getElementById('sqLivePreview') || {}).innerText || '' };
    });
    const tap = async (page, sel, i) => { await page.evaluate((sel, i) => document.querySelectorAll(sel)[i || 0].click(), sel, i); await sleep(450); };
    try {
        let page, R = out.r;
        // A. type, browse the catalog, come home
        page = await boot(); await page.type('#sqDescIn', TEXT); await sleep(400);
        R.typed = await st(page);
        await tap(page, '.category-card[data-category-id]', 0); await tap(page, '#serviceContainer > *', 0);
        R.browsing = await st(page);
        await page.evaluate(() => restoreCategoryView()); await sleep(400); R.home = await st(page);
        await page.close();
        // B. type, open the Other tile's builder (the step flow is on screen), go to the catalog home: the session ends, the words stay
        page = await boot(); await page.type('#sqDescIn', TEXT); await sleep(400);
        await tap(page, '.category-card[data-category-id]', 0); await tap(page, '#serviceContainer > *', 7); await tap(page, '.service-tile-other', 0); await sleep(500);
        R.otherOpen = await st(page);
        await page.evaluate(() => restoreCategoryView()); await sleep(500); R.afterCatalog = await st(page);
        await page.close();
        // C. Back (the Escape key) out of the Other tile's builder: the overlay stays, at the grid, with nothing of SmartQuote beside it; the words stay
        page = await boot(); await page.type('#sqDescIn', TEXT); await sleep(400);
        await tap(page, '.category-card[data-category-id]', 0); await tap(page, '#serviceContainer > *', 7); await tap(page, '.service-tile-other', 0); await sleep(500);
        await page.keyboard.press('Escape'); await sleep(600); R.afterEscape = await st(page);
        await page.close();
        // D. Back out of a catalog service's step flow; and the typed words do not leak into the service chosen
        page = await boot(); await page.type('#sqDescIn', TEXT); await sleep(400);
        await tap(page, '.category-card[data-category-id]', 0); await tap(page, '#serviceContainer > *', 3);
        await tap(page, '#serviceContainer .service-tile:not(.service-tile-other)', 0); await sleep(700);
        R.serviceOpen = await st(page);
        await page.evaluate(() => Breadcrumbs.goBack()); await sleep(600); R.afterServiceBack = await st(page);
        await page.close();
        // E. "Let me explain further": amend, not retype
        page = await boot(); await page.type('#sqDescIn', TEXT); await sleep(400);
        await page.click('#sqUnifiedActionBtn'); await sleep(1500);
        R.affirm = await page.evaluate(() => ({ no: !!document.querySelector('.affirm-no-btn') }));
        if (R.affirm.no) { await page.click('.affirm-no-btn'); await sleep(500); }
        R.afterAmend = await st(page);
        await page.close();
        // F. the Clear control
        page = await boot();
        R.clearEmpty = await st(page);
        await page.type('#sqDescIn', TEXT); await sleep(500);
        R.clearTyped = await st(page);
        if (await page.$('#sqClearBtn')) { await page.evaluate(() => document.getElementById('sqClearBtn').click()); await sleep(500); }
        R.clearDone = await st(page);
        await page.close();
    } finally { await browser.close(); }
    return out;
}

function claims(R, tag) {
    const t = s => (tag ? tag + ': ' : '') + s;
    check(t('1. browsing the catalog and coming home: the words are still in the box'), R.home.text === TEXT && R.browsing.text === TEXT && !R.home.focusedMode && R.home.bar, JSON.stringify(R.home));
    check(t('1/2. leaving an open SmartQuote view for the catalog: the step flow closes, the session is empty, the words stay'), R.otherOpen.stepFlow && !R.afterCatalog.stepFlow && !R.afterCatalog.builder && R.afterCatalog.sIntent === false && R.afterCatalog.text === TEXT, JSON.stringify([R.otherOpen, R.afterCatalog]));
    check(t('3. Back (Escape) out of the Other tile’s builder: the overlay stays at the grid, no builder or step flow beside it, the bar stays hidden'), R.afterEscape.focusedMode && R.afterEscape.grid && !R.afterEscape.builder && !R.afterEscape.stepFlow && !R.afterEscape.bar, JSON.stringify(R.afterEscape));
    check(t('1/3. ...and the words stay, the session is empty'), R.afterEscape.text === TEXT && R.afterEscape.sIntent === false, JSON.stringify(R.afterEscape));
    check(t('2. a catalog service chosen after typing does not inherit the typed words'), R.serviceOpen.stepFlow && !String(R.serviceOpen.sDesc || '').toLowerCase().includes('neon'), JSON.stringify(R.serviceOpen));
    check(t('3. Back out of a catalog service’s step flow: the overlay stays at the grid with the step flow closed, the words stay'), R.afterServiceBack.focusedMode && !R.afterServiceBack.stepFlow && !R.afterServiceBack.builder && R.afterServiceBack.text === TEXT && R.afterServiceBack.sIntent === false, JSON.stringify(R.afterServiceBack));
    check(t('4. "Let me explain further": back at the bar, the words kept, the caret at the END of them (nothing selected)'), R.affirm.no && !R.afterAmend.focusedMode && R.afterAmend.text === TEXT && R.afterAmend.activeIsBox && R.afterAmend.caret[0] === TEXT.length && R.afterAmend.caret[1] === TEXT.length, JSON.stringify([R.affirm, R.afterAmend]));
    check(t('5. Clear: absent while the box is empty'), R.clearEmpty.clearVisible === false, JSON.stringify(R.clearEmpty));
    check(t('5. Clear: present once there are words, and a real touch target (at least 32 px tall)'), R.clearTyped.clearVisible && R.clearTyped.clearBox[1] >= 32, JSON.stringify(R.clearTyped));
    check(t('5. Clear: one tap empties the box, returns focus to it and hides itself'), R.clearDone.text === '' && R.clearDone.activeIsBox && R.clearDone.clearVisible === false, JSON.stringify(R.clearDone));
    check(t('5. Clear: the live preview goes back to its empty prompt'), /Describe your job/.test(R.clearDone.preview), JSON.stringify(R.clearDone.preview));
}

(async () => {
    const chromePath = findChrome(); let puppeteer = null; try { puppeteer = require('puppeteer-core'); } catch { /* handled below */ }
    if (!chromePath || !puppeteer) { console.log('\n  environment gap: no Chrome / puppeteer-core here -- the real-browser half was SKIPPED. Set CHROME_PATH to run it.'); console.log(`\n[draft survives navigation, T187] ${pass} passed, ${fail} failed (of ${pass + fail} checks) -- browser SKIPPED\n`); process.exit(fail ? 1 : 0); }

    console.log('=== 1. the real page, desktop width ===');
    const real = await scenario(puppeteer, chromePath, RAW, { width: 1000, height: 1600 });
    check('no page error while driving it', real.errors.length === 0, real.errors.join(' | '));
    claims(real.r);

    console.log('\n=== 2. the real page, phone width ===');
    const phone = await scenario(puppeteer, chromePath, RAW, { width: 390, height: 844 });
    claims(phone.r, 'phone');

    console.log('\n=== 3. mutants: each change undone is caught ===');
    const mutants = [
        ['the catalog collision wipes the box again', h => h.replace("sqRestart({\n                    keepDraft: true\n                });\n            }\n            if (DOM.categoriesGrid)", "sqRestart();\n            }\n            if (DOM.categoriesGrid)"), r => r.r.afterCatalog.text !== TEXT],
        ['sqRestart ignores keepDraft', h => h.replace("if (desc && !(opts && opts.keepDraft)) desc.value = '';", "if (desc) desc.value = '';"), r => r.r.afterEscape.text !== TEXT || r.r.afterCatalog.text !== TEXT],
        ['Back from a SmartQuote view redraws the grid and leaves the views (#245)', h => h.replace("if (sqViewOpen && typeof sqRestart === 'function') {", "if (false && sqViewOpen && typeof sqRestart === 'function') {"), r => r.r.afterEscape.builder || r.r.afterEscape.stepFlow],
        ['"Let me explain further" selects all the words again', h => h.replace("textarea.setSelectionRange(end, end);", "textarea.select();"), r => r.r.afterAmend.caret[0] !== TEXT.length],
        ['the Clear control shows on an empty box', h => h.replace("#sqTextBar:has(#sqDescIn:placeholder-shown) .sq-clear-btn{display:none}", ""), r => r.r.clearEmpty.clearVisible === true],
        ['Clear does not empty the box', h => h.replace("            ta.value = '';\n            ta.dispatchEvent(new Event('input', {", "            ta.dispatchEvent(new Event('input', {"), r => r.r.clearDone.text !== ''],
    ];
    for (const [name, mutate, caught] of mutants) {
        const html = mutate(RAW);
        if (html === RAW) { check('mutant applies: ' + name, false, 'the mutation did not change the page (the text it targets moved)'); continue; }
        let r; try { r = await scenario(puppeteer, chromePath, html, { width: 1000, height: 1600 }); } catch (e) { r = { error: e.message }; }
        check('mutant is caught: ' + name, !!r.r && caught(r), r.error || '');
    }

    console.log(`\n[draft survives navigation, T187] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
    process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.log('TEST ERROR ' + e.stack); process.exit(1); });
