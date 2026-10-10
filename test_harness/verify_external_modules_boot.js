#!/usr/bin/env node
/**
 * verify_external_modules_boot.js -- the page in its PRODUCTION SHAPE: qr.html served from the deployed origin, its components fetched from that origin (T158).
 *
 * @enforces R-SYSTEM-SCRIPT, R-SYSTEM-CSP
 *
 * WHY THIS TEST EXISTS. The operator moved four components out of qr.html into their own files (modules/trace.js, nlp_engine.js, appReducer.js, store.js), loaded by absolute URL:
 *     <script src="https://tommichael88.github.io/booktomnyc/modules/nlp_engine.js"></script>
 * Every other browser test opens the page from disk (file://) and hands the browser the ASSEMBLED document (_page.js: each deployed tag replaced by its repo file, inline), because a
 * file:// page cannot load them -- its Content-Security-Policy allows scripts only from 'self'. That is the right way to test the page's BEHAVIOR; it says nothing about whether the page
 * BOOTS the way a visitor gets it. This test does that, and only that: the origin is stood in for by request interception (https://tommichael88.github.io/booktomnyc/ answers with the
 * repo's own files), the raw qr.html is served unassembled, and the browser fetches every module itself, under the page's real CSP.
 *
 * WHAT THIS HOLDS.
 *   1. MAPPING. Every <script src> under the deployed base names a file the repo has (so a deploy of the repo can serve it), once each.
 *   2. THE BOOT. Served as production serves it: every deployed module is requested and answered; no Content-Security-Policy violation; no page error; the catalog loads (DB.services);
 *      the build constant the page stamps on its quotes is defined (QR_BUILD_VERSION); the category grid is live (a tap opens the group grid); and the SmartQuote text input (#sqDescIn)
 *      is on screen under the grid -- the thing a customer reported absent when a boot failed silently.
 *   3. A MISSING COMPONENT IS SEEN. With any ONE required module answered 404, the page shows its boot-failure panel (#bootFailure) instead of a dead grid with no input. The tracer
 *      is the exception by design (observation-only, optional): without it the page must still boot normally.
 *
 *   4. NON-VACUITY of the CSP check: the same page with one extra script from a foreign origin must be reported as a CSP violation (so "no violation" in section 2 means something).
 *
 * Needs a Chrome (CHROME_PATH, the usual locations, or /opt/pw-browsers). With none, this test FAILS rather than skipping (DEFECT-SILENT-SKIP).
 * BTNYC_QR_FILE=<file> runs it against any copy of qr.html.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const PAGE = require('./_page.js');

const ROOT = path.resolve(__dirname, '..');
const QR = process.env.BTNYC_QR_FILE ? path.resolve(process.env.BTNYC_QR_FILE) : path.join(ROOT, 'qr.html');
const PAGE_URL = PAGE.DEPLOY_BASE + 'qr.html';

let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log('  ✓ ' + m); };
const bad = (m, d) => { fail++; console.log('  ✗ ' + m + (d ? '\n      ' + String(d).split('\n').join('\n      ') : '')); };
const check = (c, okMsg, badMsg, d) => (c ? ok(okMsg) : bad(badMsg || okMsg, d));

function findChrome() {
    const c = [process.env.CHROME_PATH];
    try { c.push(...execSync('find /home/*/.cache/puppeteer /root/.cache/puppeteer -type f -name chrome 2>/dev/null || true', { shell: '/bin/bash' }).toString().trim().split('\n')); } catch (e) { /* ignore */ }
    c.push('/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium', '/opt/pw-browsers/chromium');
    return c.filter(Boolean).find(p => fs.existsSync(p));
}

const RAW = fs.readFileSync(QR, 'utf8');
const SCRIPTS = PAGE.externalScripts(RAW).filter(s => s.repoPath);   // the ones under the deployed base
const OPTIONAL = new Set(['modules/trace.js', 'trace.js']);          // observation-only (#77)

// Serve the deployed origin from the repo. `missing` is a repo path answered 404.
async function boot(puppeteer, chrome, missing, html) {
    const browser = await puppeteer.launch({ headless: 'new', executablePath: chrome, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1000, height: 1600 });
        const out = { requested: {}, pageErrors: [], csp: [], console: [] };
        page.on('pageerror', e => out.pageErrors.push(String(e.message).slice(0, 160)));
        page.on('console', m => { const t = m.text(); if (/Content Security Policy|violates the following/i.test(t)) out.csp.push(t.slice(0, 200)); });
        await page.evaluateOnNewDocument(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
        await page.setRequestInterception(true);
        page.on('request', r => {
            const u = r.url(), bare = u.split(/[?#]/)[0];
            if (bare === PAGE_URL) return r.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: html || RAW });
            const rel = PAGE.repoPathOfUrl(u);
            if (rel) {
                const isModule = SCRIPTS.some(s => s.repoPath === rel);
                if (isModule) out.requested[rel] = 'requested';
                if (missing && rel === missing) { out.requested[rel] = '404'; return r.respond({ status: 404, contentType: 'text/plain', body: 'not found' }); }
                const f = PAGE.localFileForUrl(u);
                if (f) {
                    if (isModule) out.requested[rel] = '200';
                    const type = f.endsWith('.js') ? 'application/javascript' : f.endsWith('.json') ? 'application/json' : 'text/plain';
                    return r.respond({ status: 200, contentType: type, headers: { 'Access-Control-Allow-Origin': '*' }, body: fs.readFileSync(f) });
                }
                return r.respond({ status: 404, contentType: 'text/plain', body: 'not in the repo' });
            }
            if (/^https?:/.test(u)) return r.abort();
            r.continue();
        });
        await page.goto(PAGE_URL, { waitUntil: 'load' });
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        // wait for either a booted page or the failure panel
        await page.waitForFunction(() => (window.DB && window.DB.services) || document.getElementById('bootFailure'), { timeout: 15000 }).catch(() => { /* judged below */ });
        await sleep(900);
        Object.assign(out, await page.evaluate(() => {
            const vis = el => { if (!el) return false; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
            const bf = document.getElementById('bootFailure'), inp = document.getElementById('sqDescIn');
            return {
                booted: !!(window.DB && window.DB.services && window.DB.services.length), serviceCount: window.DB && window.DB.services ? window.DB.services.length : 0,
                buildVersion: (typeof QR_BUILD_VERSION !== 'undefined') ? QR_BUILD_VERSION : null,
                bootFailureVisible: vis(bf), bootFailureText: bf ? (bf.innerText || '').slice(0, 120) : '',
                inputVisible: vis(inp), categoryTiles: document.querySelectorAll('#category-card .category-card').length, cspEvents: window.__csp || [],
            };
        }));
        if (out.booted) {   // the grid is live: a tap opens the group grid
            const tapped = await page.evaluate(async () => {
                const t = document.querySelector('#category-card .category-card'); if (!t) return 0; t.click();
                await new Promise(r => setTimeout(r, 600));
                const g = document.getElementById('serviceContainer'); return g ? [...g.children].filter(c => c.getBoundingClientRect().height > 0).length : 0;
            });
            out.groupTilesAfterTap = tapped;
        }
        return out;
    } finally { await browser.close(); }
}

(async () => {
    console.log('verify_external_modules_boot: the page as the deployed origin serves it\n');
    let puppeteer;
    try { puppeteer = require('puppeteer-core'); } catch (e) { try { puppeteer = require('puppeteer'); } catch (e2) { /* none */ } }
    const chrome = findChrome();
    if (!puppeteer || !chrome) {
        bad('a browser is required', 'No Chrome/puppeteer found. This test FAILS rather than skipping: set CHROME_PATH (e.g. /opt/pw-browsers/chromium). Silent skipping would be a false statement of coverage (DEFECT-SILENT-SKIP).');
        console.log(`\n${pass} passed, ${fail} failed`); process.exit(1);
    }

    console.log('1. mapping: every deployed <script src> is a file the repo has');
    check(SCRIPTS.length > 0, `${SCRIPTS.length} deployed script tags: ${SCRIPTS.map(s => s.repoPath).join(', ')}`, 'qr.html names no deployed script (nothing to boot-test)');
    const missingFiles = SCRIPTS.filter(s => !fs.existsSync(path.join(PAGE.REPO_ROOT, s.repoPath)));
    check(missingFiles.length === 0, 'every one exists in the repo', `the repo has no file for: ${missingFiles.map(s => s.repoPath).join(', ')}`, 'A deploy of the repo could not serve these; the page would load without them.');
    const dup = SCRIPTS.map(s => s.repoPath).filter((p, i, a) => a.indexOf(p) !== i);
    check(dup.length === 0, 'each is loaded once', `loaded more than once: ${[...new Set(dup)].join(', ')}`);

    console.log('\n2. the boot, as production serves it');
    const good = await boot(puppeteer, chrome, null);
    const notServed = SCRIPTS.filter(s => good.requested[s.repoPath] !== '200').map(s => `${s.repoPath} (${good.requested[s.repoPath] || 'never requested'})`);
    check(notServed.length === 0, `the browser requested and was answered for all ${SCRIPTS.length} modules`, `modules not fetched and answered: ${notServed.join(', ')}`);
    check(good.csp.length === 0 && good.cspEvents.length === 0, 'no Content-Security-Policy violation', 'the CSP blocked something', [...good.csp, ...good.cspEvents].join('\n'));
    check(good.pageErrors.length === 0, 'no page error during boot', 'page error during boot', good.pageErrors.join('\n'));
    check(good.booted, `the catalog loaded (${good.serviceCount} services)`, 'the page did not finish booting', good.bootFailureText || 'no #bootFailure panel either');
    check(typeof good.buildVersion === 'string' && /^T\d+/.test(good.buildVersion), `QR_BUILD_VERSION is defined by the loaded modules (${good.buildVersion})`, 'QR_BUILD_VERSION is not defined after boot', String(good.buildVersion));
    check(good.categoryTiles > 0 && good.groupTilesAfterTap > 0, `the category grid is live: ${good.categoryTiles} categories, a tap opens ${good.groupTilesAfterTap} group tiles`, 'the category grid did not respond to a tap', `categories ${good.categoryTiles}, group tiles after tap ${good.groupTilesAfterTap}`);
    check(good.inputVisible, 'the SmartQuote text input (#sqDescIn) is on screen under the grid', 'the SmartQuote text input is absent or hidden');
    check(!good.bootFailureVisible, 'no boot-failure panel on a healthy boot', 'the boot-failure panel is showing on a healthy boot');

    console.log('\n3. a missing component is seen');
    for (const s of SCRIPTS) {
        const r = await boot(puppeteer, chrome, s.repoPath);
        if (OPTIONAL.has(s.repoPath)) {
            check(r.booted && !r.bootFailureVisible && r.inputVisible, `${s.repoPath} answered 404: the optional tracer is absent and the page still boots normally`, `${s.repoPath} answered 404 and the page did not boot normally`, `booted ${r.booted}, failure panel ${r.bootFailureVisible}, input ${r.inputVisible}`);
        } else {
            check(r.bootFailureVisible, `${s.repoPath} answered 404: the page says so (#bootFailure: "${r.bootFailureText.replace(/\s+/g, ' ').slice(0, 70)}")`,
                `${s.repoPath} answered 404 and the page shows NO explanation`, `booted ${r.booted}; input visible ${r.inputVisible}; category tiles ${r.categoryTiles}; page errors: ${r.pageErrors.slice(0, 3).join(' | ')}`);
        }
    }

    console.log('\n4. non-vacuity: the CSP check must see a violation when there is one');
    const foreign = await boot(puppeteer, chrome, null, RAW.replace(/<\/head>/i, '<script src="https://example.invalid/foreign.js"></script></head>'));
    check(foreign.csp.length > 0 || foreign.cspEvents.length > 0, `a script from a foreign origin is reported (${(foreign.cspEvents[0] || foreign.csp[0] || '').slice(0, 90)})`, 'a foreign-origin script produced no CSP violation report: the check in section 2 proves nothing');

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
