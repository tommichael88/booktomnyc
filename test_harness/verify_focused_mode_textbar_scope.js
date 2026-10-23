#!/usr/bin/env node
/**
 * verify_focused_mode_textbar_scope.js   (T186; replaces the T125 jsdom version, whose rule the operator reversed in issue #22)
 *
 * WHAT THIS PROVES (the operator's rule, recorded in issue #22 on 2026-10-19):
 *   The SmartQuote text bar "should ONLY be visible outside of focused-mode and never during the Grid navigation path except when Other Tile is tapped."
 *
 * WHY A REAL BROWSER. The T125 test read inline `style.display` in jsdom, so it could neither see the stylesheet cascade nor the nesting that decides what a visitor sees.
 * Two defects lived exactly there:
 *   1. THE #22 DEFECT. Every caller of enterFocusedMode() except the category tile left the bar visible (T125 made hiding a per-caller choice). After a group tile the visitor saw
 *      the bar beside the group grid: focusedMode true, sqTextBar 931x221, serviceContainer grid, sqStepFlow none.
 *   2. THE DEFECT THE FIRST ATTEMPT AT A FIX INTRODUCED (cc3641f9, a stylesheet rule hiding the whole #smartQuoteEngine in focused mode). The text bar sits inside that engine, and
 *      so do the step flow, the guided builder and the quote: after a service tile or the Other tile the overlay went blank, and the confirmation sentence could not be reached.
 *      No test noticed, because none looked at the step flow in a browser.
 *
 * So the claims are about what is VISIBLE (a laid-out box, in a real page), in both directions:
 *   - home: the bar is visible, nothing is focused.
 *   - category tile, group tile, sub-group tile: focused, the bar is hidden, the grid is visible, the engine around the bar is NOT hidden.
 *   - a service tile: the step flow is visible (the engine shows it), the bar is hidden.
 *   - the Other tile: the builder and step flow are visible, the bar is hidden (the exception is the SmartQuote UI, which the Other tile opens).
 *   - the Other (free-text) SERVICE view, the one place the page asks for the bar by name (setFocusedTextBarAllowed(true)): the bar is visible there, and a Back into the
 *     grid (Breadcrumbs.goBack) takes the exception away again.
 *   - leaving focused mode (restoreCategoryView): the bar is visible again.
 *   - the same sequence at a phone width.
 * Each claim is shown able to fail: five source mutants (the engine-wide CSS rule back; the stylesheet rule gone; the per-caller form back; the exception never granted;
 * a Back that keeps the exception) are run through the same scenario and each is caught.
 *
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

// ── source claims (cheap, and they name the mechanism) ───────────────────────────────────────────────────────────────────────────────────────────────────────
console.log('=== 1. source: one rule, held by the stylesheet, and the engine is not hidden ===');
{
    check('enterFocusedMode takes no per-caller choice about the text bar', /function enterFocusedMode\(\)\s*\{/.test(RAW) && !/hideTextBar/.test(RAW));
    check('no call site passes an argument to enterFocusedMode', !/enterFocusedMode\([^)\s]/.test(RAW));
    check('the stylesheet holds the bar: .focused-mode:not(.sq-text-bar-allowed) #sqTextBar {display:none!important}', /\.focused-mode:not\(\.sq-text-bar-allowed\)\s+#sqTextBar\s*\{\s*display:\s*none\s*!important\s*\}/.test(RAW));
    check('no stylesheet rule hides #smartQuoteEngine as a whole in focused mode (it holds the step flow, the builder and the quote)', !/focused-mode[^{}]*#smartQuoteEngine\s*\{[^}]*display:\s*none/.test(RAW));
    check('the Other (free-text) service view asks for the bar by name, after entering the overlay', /showIntakeQuestions\(svc, category_id\);\s*setFocusedTextBarAllowed\(true\)/.test(RAW));
    check('a Back into the grid (showGroupsForCategory / showSubGroups with fromBack) withdraws the exception', (RAW.match(/else setFocusedTextBarAllowed\(false\)/g) || []).length === 2);
}

// ── the scenario: one real page load per section ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function scenario(puppeteer, chromePath, html, size) {
    const base = PAGE.DEPLOY_BASE + 'qr.html';
    const browser = await puppeteer.launch({ headless: 'new', executablePath: chromePath, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const out = { errors: [], rows: {} };
    try {
        const page = await browser.newPage();
        await page.setViewport(size);
        await page.setRequestInterception(true);
        page.on('request', r => {
            const u = r.url(), bare = u.split(/[?#]/)[0];
            if (bare === base) return r.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
            const f = PAGE.localFileForUrl(u);
            if (f) return r.respond({ status: 200, contentType: f.endsWith('.js') ? 'application/javascript' : f.endsWith('.json') ? 'application/json' : 'text/plain', headers: { 'Access-Control-Allow-Origin': '*' }, body: fs.readFileSync(f) });
            if (/^https?:/.test(u)) return r.abort();
            r.continue();
        });
        page.on('pageerror', e => out.errors.push(String(e.message).slice(0, 140)));
        await page.goto(base, { waitUntil: 'load' });
        await page.waitForFunction(() => window.DB && window.DB.services, { timeout: 30000 });
        await sleep(900);
        const snap = (label) => page.evaluate((label) => {
            const vis = id => { const el = document.getElementById(id); if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
            const card = document.querySelector('.main-card-schedule-service');
            return { label, focused: !!(card && card.classList.contains('focused-mode')), engine: vis('smartQuoteEngine'), bar: vis('sqTextBar'), stepFlow: vis('sqStepFlow'), builder: vis('sqBuilder'), grid: vis('serviceContainer') };
        }, label);
        const click = async (sel, i) => { await page.evaluate((sel, i) => document.querySelectorAll(sel)[i || 0].click(), sel, i); await sleep(450); };
        const R = out.rows;
        R.home = await snap('home');
        await click('.category-card[data-category-id]', 0); R.category = await snap('category tile');
        await click('#serviceContainer > *', 0); R.group = await snap('group tile');        // "Appliances" (the #22 trace: subgroup:minor_home_repairs_appliances)
        await click('#serviceContainer .group-tile', 0); R.subgroup = await snap('sub-group tile');  // "Washer"
        // a service tile: category 0, its group 3 holds service tiles
        await page.evaluate(() => restoreCategoryView()); await sleep(200);
        await click('.category-card[data-category-id]', 0); await click('#serviceContainer > *', 3);
        R.serviceGrid = await snap('grid of services');
        await click('#serviceContainer .service-tile:not(.service-tile-other)', 0); await sleep(500); R.service = await snap('service tile');
        // the Other tile: category 0, group 7
        await page.evaluate(() => restoreCategoryView()); await sleep(200);
        await click('.category-card[data-category-id]', 0); await click('#serviceContainer > *', 7);
        R.otherGrid = await snap('grid with the Other tile');
        await click('.service-tile-other', 0); await sleep(500); R.other = await snap('Other tile');
        // the Other (free-text) service view: a service the catalog marks #adhoc (none does today, so the page's own entry point is driven with a copy of a real one)
        const enterOtherService = async () => {
            await page.evaluate(() => restoreCategoryView()); await sleep(200);
            await click('.category-card[data-category-id]', 0); await click('#serviceContainer > *', 3);
            await page.evaluate(() => {
                const svc = JSON.parse(JSON.stringify(Object.values(window.DB.services).find(s => s && s.category_id === 'minor_home_repairs') || window.DB.services[0]));
                svc.default_tags = ['#adhoc'];
                prefillSmartQuoteFromService(svc, 'minor_home_repairs');
            });
            await sleep(600);
        };
        await enterOtherService(); R.otherService = await snap('Other (free-text) service view');
        // a new forward view (a category's groups) takes the exception away
        await page.evaluate(() => showGroupsForCategory('minor_home_repairs')); await sleep(500); R.afterForward = await snap('a new forward view');
        // Back, the way the page's own BACK button goes (Breadcrumbs.goBack -> showGroupsForCategory(.., true))
        await enterOtherService();
        await page.evaluate(() => Breadcrumbs.goBack()); await sleep(500);
        R.afterBack = await snap('after Back into the grid');
        // leaving the overlay
        await page.evaluate(() => restoreCategoryView()); await sleep(400); R.exited = await snap('left focused mode');
    } finally { await browser.close(); }
    return out;
}

function claims(R, tag) {
    const t = s => (tag ? tag + ': ' : '') + s;
    check(t('home: not focused, the bar and the engine are visible'), !R.home.focused && R.home.bar && R.home.engine, JSON.stringify(R.home));
    check(t('category tile: focused, the bar is hidden, the grid is visible'), R.category.focused && !R.category.bar && R.category.grid, JSON.stringify(R.category));
    check(t('group tile (the #22 state): focused, the bar is hidden, the grid is visible, the step flow and builder are not drawn'), R.group.focused && !R.group.bar && R.group.grid && !R.group.stepFlow && !R.group.builder, JSON.stringify(R.group));
    check(t('sub-group tile: the bar is still hidden'), R.subgroup.focused && !R.subgroup.bar && R.subgroup.grid, JSON.stringify(R.subgroup));
    check(t('the engine around the bar is not hidden in focused mode (it holds the step flow, the builder and the quote)'), R.group.engine && R.subgroup.engine, JSON.stringify([R.group, R.subgroup]));
    check(t('a grid of services: the bar is hidden'), R.serviceGrid.focused && !R.serviceGrid.bar && R.serviceGrid.grid, JSON.stringify(R.serviceGrid));
    check(t('a service tile: the step flow is visible and the bar is hidden'), R.service.focused && R.service.stepFlow && !R.service.bar, JSON.stringify(R.service));
    check(t('the grid with the Other tile: the bar is hidden'), R.otherGrid.focused && !R.otherGrid.bar && R.otherGrid.grid, JSON.stringify(R.otherGrid));
    check(t('the Other tile: the builder and step flow are visible, the grid is not'), R.other.focused && R.other.builder && R.other.stepFlow && !R.other.grid, JSON.stringify(R.other));
    check(t('the Other (free-text) service view: the bar is visible (the one exception)'), R.otherService.focused && R.otherService.bar, JSON.stringify(R.otherService));
    check(t('a new forward view takes the exception away: the bar is hidden'), R.afterForward.focused && !R.afterForward.bar, JSON.stringify(R.afterForward));
    check(t('a Back into the grid takes the exception away: the bar is hidden again'), R.afterBack.focused && !R.afterBack.bar, JSON.stringify(R.afterBack));
    check(t('leaving focused mode: the bar is visible again'), !R.exited.focused && R.exited.bar, JSON.stringify(R.exited));
}

(async () => {
    const chromePath = findChrome(); let puppeteer = null; try { puppeteer = require('puppeteer-core'); } catch { /* handled below */ }
    if (!chromePath || !puppeteer) { console.log('\n  environment gap: no Chrome / puppeteer-core here -- the real-browser half was SKIPPED. Set CHROME_PATH to run it.'); console.log(`\n[focused mode text bar scope, T186] ${pass} passed, ${fail} failed (of ${pass + fail} checks) -- browser half SKIPPED\n`); process.exit(fail ? 1 : 0); }

    console.log('\n=== 2. the real page, desktop width ===');
    const real = await scenario(puppeteer, chromePath, RAW, { width: 1000, height: 1600 });
    check('no page error while driving it', real.errors.length === 0, real.errors.join(' | '));
    claims(real.rows);

    console.log('\n=== 3. the real page, phone width ===');
    const phone = await scenario(puppeteer, chromePath, RAW, { width: 390, height: 844 });
    claims(phone.rows, 'phone');

    console.log('\n=== 4. mutants: each way the rule can break is caught ===');
    const mutants = [
        ['the engine-wide stylesheet rule is back (cc3641f9)', h => h.replace('.focused-mode:not(.sq-text-bar-allowed) #sqTextBar{display:none!important}', '.focused-mode #smartQuoteEngine,.focused-mode-inner #smartQuoteEngine {display: none !important;}'), r => r.rows.service.stepFlow === false || r.rows.other.builder === false],
        ['the stylesheet rule is gone and the function leaves the bar alone (the #22 state)', h => h.replace('.focused-mode:not(.sq-text-bar-allowed) #sqTextBar{display:none!important}', '').replace("if (bar) bar.style.removeProperty('display'); // an old inline hide/show", "// an old inline hide/show"), r => r.rows.group.bar === true],
        ['the Other service view never asks for the bar', h => h.replace('setFocusedTextBarAllowed(true); // after the call', '/* mutated */ // after the call'), r => r.rows.otherService.bar === false],
        ['a Back into the grid keeps the exception (showGroupsForCategory / showSubGroups do not withdraw it)', h => h.split('else setFocusedTextBarAllowed(false);').join('else void 0;'), r => r.rows.afterBack.bar === true],
        ['the overlay never withdraws the exception on a new view', h => h.replace('            setFocusedTextBarAllowed(false);\n        }\n\n        /** The SmartQuote text bar', '            void 0;\n        }\n\n        /** The SmartQuote text bar'), r => r.rows.afterForward.bar === true],
    ];
    for (const [name, mutate, caught] of mutants) {
        const html = mutate(RAW);
        if (html === RAW) { check('mutant applies: ' + name, false, 'the mutation did not change the page (the text it targets moved)'); continue; }
        let r; try { r = await scenario(puppeteer, chromePath, html, { width: 1000, height: 1600 }); } catch (e) { r = { error: e.message }; }
        check('mutant is caught: ' + name, !!r.rows && caught(r), r.error || '');
    }

    console.log(`\n[focused mode text bar scope, T186] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
    process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.log('TEST ERROR ' + e.stack); process.exit(1); });
