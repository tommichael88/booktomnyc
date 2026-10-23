#!/usr/bin/env node
/**
 * verify_clear_and_undo.js   (T187)
 *
 * WHAT THIS PROVES (the Operator's message of 2026-10-22 22:59 NY: "there needs to be a clear option or button as persisted states make undoing things very annoying").
 * The page keeps three things between moves: the words in the text bar, the cart (sessionStorage `booktom_cart_v2`, kept for the session) and the SmartQuote session. Each has to be
 * removable in one tap, and what is removed has to be easy to take back:
 *
 *   1. THE CART. Clear All (the cart overlay's button AND the request summary's, which had no handler at all) empties the cart at once: no blocking "Remove all services?" dialog.
 *      Its toast carries Undo, and Undo puts back exactly what was there, in the same order, in storage too. Removing one service does the same: the toast names it, Undo puts it back
 *      in the place it was.
 *   2. THE SMARTQUOTE SESSION. While the step flow is on screen there is a "Start over" in it: one tap closes the views, leaves the overlay, ends the session and clears the words.
 *   3. THE WORDS. (Covered by verify_draft_survives_navigation.js: the Clear control.)
 *
 * Real Chrome at phone width (the narrow case). Five source mutants (the dialog back, no Undo on Clear All, no Undo on a removal, the summary button unbound, no Start over) are run
 * through the same scenario and each is caught. Skips (loudly: "environment gap") only if there is no Chrome / puppeteer-core.
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

const ITEMS = [1, 2, 3].map(n => ({ id: 'cart-test-' + n, serviceId: 'svc-test-' + n, category_id: 'minor_home_repairs', name: 'Test service ' + n, price: '$' + (100 * n) + '.00', icon: '🛠️', detail: 'Test', notes: 'Test ' + n, estimatedPrice: 100 * n }));

async function scenario(puppeteer, chromePath, html) {
    const base = PAGE.DEPLOY_BASE + 'qr.html';
    const browser = await puppeteer.launch({ headless: 'new', executablePath: chromePath, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const out = { errors: [], dialogs: 0, r: {} };
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
        page.on('pageerror', e => out.errors.push(String(e.message).slice(0, 140)));
        page.on('dialog', async d => { out.dialogs++; await d.accept(); });
        await page.goto(base, { waitUntil: 'load' });
        await page.waitForFunction(() => window.DB && window.DB.services, { timeout: 30000 });
        await sleep(900);
        const cart = () => page.evaluate(() => ({ ids: window.__store.getState().cart.serviceRequest.map(s => s.id), stored: JSON.parse(sessionStorage.getItem('booktom_cart_v2') || '[]').map(s => s.id) }));
        const fill = async () => { await page.evaluate((items) => { window.__store.dispatch({ type: 'cart/SET', payload: { serviceRequest: items } }); renderCart(); }, ITEMS); await sleep(200); };
        const undo = async () => { const had = await page.evaluate(() => { const b = document.querySelector('#toast-container .toast-action'); if (b) { b.click(); return true; } return false; }); await sleep(300); return had; };
        const R = out.r;
        // 1a. Clear All in the cart overlay
        await fill(); R.filled = await cart();
        await page.evaluate(() => document.getElementById('clearAllServicesBtn').click()); await sleep(300);
        R.clearedOverlay = await cart(); R.clearedOverlayToast = await page.evaluate(() => (document.querySelector('#toast-container') || { innerText: '' }).innerText);
        R.undoClearOverlay = await undo(); R.restoredOverlay = await cart();
        // 1b. Clear All in the request summary (its own button)
        await page.evaluate(() => { document.querySelectorAll('#toast-container > *').forEach(e => e.remove()); });
        await page.evaluate(() => document.querySelector('#serviceRequestSummary .clear-all-btn').click()); await sleep(300);
        R.clearedSummary = await cart();
        R.undoClearSummary = await undo(); R.restoredSummary = await cart();
        // 1c. one service out, and back in the place it was
        await page.evaluate(() => { document.querySelectorAll('#toast-container > *').forEach(e => e.remove()); });
        await page.evaluate(() => removeServiceFromCart('cart-test-2')); await sleep(300);
        R.removed = await cart(); R.removedToast = await page.evaluate(() => (document.querySelector('#toast-container') || { innerText: '' }).innerText);
        R.undoRemove = await undo(); R.restoredOne = await cart();
        // 2. Start over in the step flow
        await page.evaluate(() => restoreCategoryView()); await sleep(300);
        await page.type('#sqDescIn', 'some words'); await sleep(300);
        await page.evaluate(() => { document.querySelectorAll('.category-card[data-category-id]')[0].click(); }); await sleep(350);
        await page.evaluate(() => { document.querySelectorAll('#serviceContainer > *')[7].click(); }); await sleep(350);
        await page.evaluate(() => { document.querySelector('.service-tile-other').click(); }); await sleep(600);
        R.flowOpen = await page.evaluate(() => { const b = document.getElementById('sqStartOverBtn'), f = document.getElementById('sqStepFlow'); const r = b && b.getBoundingClientRect(); return { btn: !!r && r.width > 0 && r.height >= 32, flow: getComputedStyle(f).display !== 'none' }; });
        if (R.flowOpen.btn) { await page.evaluate(() => document.getElementById('sqStartOverBtn').click()); await sleep(600); }
        R.afterStartOver = await page.evaluate(() => { const vis = id => { const e = document.getElementById(id); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }; return { text: document.getElementById('sqDescIn').value, focusedMode: document.querySelector('.main-card-schedule-service').classList.contains('focused-mode'), flow: vis('sqStepFlow'), builder: vis('sqBuilder'), bar: vis('sqTextBar'), sIntent: !!S.intent }; });
    } finally { await browser.close(); }
    return out;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const IDS = ITEMS.map(i => i.id);

function claims(out) {
    const R = out.r;
    check('no page error while driving it', out.errors.length === 0, out.errors.join(' | '));
    check('the cart holds three services, in the page and in sessionStorage', same(R.filled.ids, IDS) && same(R.filled.stored, IDS), JSON.stringify(R.filled));
    check('1. Clear All (cart overlay): empties the cart at once, in storage too', R.clearedOverlay.ids.length === 0 && R.clearedOverlay.stored.length === 0, JSON.stringify(R.clearedOverlay));
    check('1. ...with no blocking dialog', out.dialogs === 0, 'dialogs: ' + out.dialogs);
    check('1. ...and the toast offers Undo', R.undoClearOverlay === true && /Cart cleared/.test(R.clearedOverlayToast) && /Undo/.test(R.clearedOverlayToast), JSON.stringify(R.clearedOverlayToast));
    check('1. ...Undo puts the three services back, in order, in storage too', same(R.restoredOverlay.ids, IDS) && same(R.restoredOverlay.stored, IDS), JSON.stringify(R.restoredOverlay));
    check('1. Clear All (request summary): its own button works, and Undo restores', R.clearedSummary.ids.length === 0 && R.undoClearSummary === true && same(R.restoredSummary.ids, IDS), JSON.stringify([R.clearedSummary, R.restoredSummary]));
    check('1. removing one service: it is out, the toast names it and offers Undo', same(R.removed.ids, [IDS[0], IDS[2]]) && /Test service 2 removed/.test(R.removedToast) && /Undo/.test(R.removedToast), JSON.stringify([R.removed, R.removedToast]));
    check('1. ...Undo puts it back in the place it was', R.undoRemove === true && same(R.restoredOne.ids, IDS) && same(R.restoredOne.stored, IDS), JSON.stringify(R.restoredOne));
    check('2. the step flow has a Start over, a real touch target', R.flowOpen.flow && R.flowOpen.btn, JSON.stringify(R.flowOpen));
    check('2. Start over: the views close, the overlay is left, the session ends and the words are cleared', R.afterStartOver.text === '' && !R.afterStartOver.focusedMode && !R.afterStartOver.flow && !R.afterStartOver.builder && R.afterStartOver.bar && R.afterStartOver.sIntent === false, JSON.stringify(R.afterStartOver));
}

(async () => {
    const chromePath = findChrome(); let puppeteer = null; try { puppeteer = require('puppeteer-core'); } catch { /* handled below */ }
    if (!chromePath || !puppeteer) { console.log('\n  environment gap: no Chrome / puppeteer-core here -- SKIPPED. Set CHROME_PATH to run it.'); console.log('\n[clear and undo, T187] 0 passed, 0 failed -- SKIPPED\n'); process.exit(0); }
    console.log('=== 1. the real page, phone width ===');
    claims(await scenario(puppeteer, chromePath, RAW));
    console.log('\n=== 2. mutants ===');
    const mutants = [
        ['the blocking dialog is back', h => h.replace("function clearCartWithUndo() {\n            const snapshot = window.__store.getState().cart.serviceRequest;\n            if (!snapshot.length) return;", "function clearCartWithUndo() {\n            const snapshot = window.__store.getState().cart.serviceRequest;\n            if (!snapshot.length || !confirm('Remove all services?')) return;"), r => r.dialogs > 0],
        ['Clear All offers no Undo', h => h.replace("toast('Cart cleared', 'info', {\n                label: 'Undo',\n                onClick: () => restoreCartSnapshot(snapshot)\n            });", "toast('Cart cleared');"), r => r.r.undoClearOverlay !== true],
        ['a removal offers no Undo', h => h.replace("if (at >= 0) {\n                const removed = currentCart[at];", "if (false) {\n                const removed = currentCart[at];"), r => r.r.undoRemove !== true],
        ['the summary’s Clear All is unbound again', h => h.replace("document.querySelectorAll('.clear-all-btn').forEach(", "document.querySelectorAll('#clearAllServicesBtn').forEach("), r => r.r.clearedSummary.ids.length !== 0],
        ['the step flow has no Start over', h => h.replace('<button id="sqStartOverBtn"', '<button id="sqStartOverBtnX"'), r => !r.r.flowOpen.btn],
    ];
    for (const [name, mutate, caught] of mutants) {
        const html = mutate(RAW);
        if (html === RAW) { check('mutant applies: ' + name, false, 'the mutation did not change the page'); continue; }
        let r; try { r = await scenario(puppeteer, chromePath, html); } catch (e) { r = { error: e.message }; }
        check('mutant is caught: ' + name, !!r.r && caught(r), r.error || '');
    }
    console.log(`\n[clear and undo, T187] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
    process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.log('TEST ERROR ' + e.stack); process.exit(1); });
