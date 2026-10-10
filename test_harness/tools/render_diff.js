#!/usr/bin/env node
/**
 * tools/render_diff.js -- did a refactor change what the customer sees?
 *
 * Loads two builds of qr.html in a real headless Chrome (with btnyc.json served), drives the real code for EVERY
 * service, and diffs what comes out. The test suite checks code shape; this checks behavior.
 *
 *   node test_harness/tools/render_diff.js <base_qr.html> <head_qr.html> [btnyc.json] [--ignore key[,key]]
 *
 * Per service (76 in the SSOT) it records, for each build:
 *   card      createServiceCardElement(svc)                     -> the service-card DOM
 *   panel     showIntakeQuestions(svc)                          -> the intake panel DOM
 *   route     executeWorkflow + renderCuratedCardFromRoute      -> the curated route card DOM, and the route payload
 *   restart   sqRestart()                                       -> session state S + the reset view
 *   prefill   sqRestart(); prefillSmartQuoteFromService(svc)    -> session state S + the rendered step-3 view
 *   quote     prefill, then a state variant, then sqRenderQuote()-> the quote panel markup, for 5 variants per service:
 *             default | qty 2 | three smart tags selected | auto-matched banner | suggested-match banner
 * Options: --ignore key[,key]   drop keys from route payloads / state before comparing (e.g. a field a change deliberately added)
 *          --rename new=old[@prefix]  treat `new` in HEAD output as `old` (a deliberate rename, e.g. a handler name), optionally only
 *                               for entry keys starting with `prefix` (e.g. @quote:) so an allowance is never broader than the change; repeatable
 *          --drop 'regex[@prefix]'    remove text matching `regex` from HEAD output (optionally only for keys starting with `prefix`) before
 *                               comparing -- for a change that deliberately ADDS markup, so the allowance names exactly what was added; repeatable
 *          --trace <trace.js>   serve this file for the page's <script src=".../trace.js"> in the HEAD run ONLY. With base == head (the same
 *                               qr.html twice) this proves the trace layer is observation-only: output with it loaded must equal output without.
 * A1.6 (PHASE_PLAN.md, Phase A) EXTENSION -- inputs only, new key families; no original entry or input changed (so the original 836 are still a subset): two families the Phase A
 * collapses reach and the original probes did not --
 *   adlib     sqBuildAdlib() on a prefilled service, 3 variants (default | 3 smart tags + a location | qty 3): the interactive ad-lib sentence's DOM (AC-27)
 *   builder   the guided builder end to end for every dynamic entity: BLD seeded as the chip builder seeds it, sqBuilderFinish() (-> sqPrepareFlow(true) -> step 3): session state S + the step-3 DOM (AC-13/AC-29)
 * (the extended differential is 836 + 76x3 + 82 = 1,146 entries; the original 836 are reproduced exactly as before.)
 * Exit 0 only when every entry is identical after those declared, explicit allowances.
 *
 * Needs puppeteer-core (already a harness dependency) and a Chrome: set CHROME_PATH, or it searches the usual
 * places and the puppeteer cache. Serves btnyc.json with CORS headers so a build that fetches an absolute URL
 * works from file:// too.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const ignoreIdx = args.indexOf('--ignore');
const ignore = new Set(ignoreIdx >= 0 ? (args[ignoreIdx + 1] || '').split(',').filter(Boolean) : []);
const traceIdx = args.indexOf('--trace'); const traceFile = traceIdx >= 0 ? path.resolve(args[traceIdx + 1]) : null;
const renames = []; args.forEach((a, i) => { if (a === '--rename' && args[i + 1]) { const [spec, scope] = args[i + 1].split('@'); const [n, o] = spec.split('='); renames.push([n, o, scope || '']); } });
const drops = []; args.forEach((a, i) => { if (a === '--drop' && args[i + 1]) { const at = args[i + 1].lastIndexOf('@'); const hasScope = at > 0 && !/[\\)\]]$/.test(args[i + 1].slice(at + 1)) && args[i + 1].slice(at + 1).length < 20 && /^[a-z]+:?$/.test(args[i + 1].slice(at + 1)); drops.push(hasScope ? [new RegExp(args[i + 1].slice(0, at), 'g'), args[i + 1].slice(at + 1)] : [new RegExp(args[i + 1], 'g'), '']); } });
const isOptVal = i => (ignoreIdx >= 0 && i === ignoreIdx + 1) || (i > 0 && (args[i - 1] === '--rename' || args[i - 1] === '--drop' || args[i - 1] === '--trace'));
const pos = args.filter((a, i) => !a.startsWith('--') && !isOptVal(i));
if (pos.length < 2) { console.error('usage: render_diff.js <base_qr.html> <head_qr.html> [btnyc.json] [--ignore key[,key]]'); process.exit(2); }
const [baseFile, headFile] = pos.map(p => path.resolve(p));
const ssot = path.resolve(pos[2] || path.join(__dirname, '..', '..', 'btnyc.json'));
const puppeteer = require(path.join(__dirname, '..', 'node_modules', 'puppeteer-core'));

function findChrome() {
    const c = [process.env.CHROME_PATH];
    try { c.push(...execSync('find /home/*/.cache/puppeteer /root/.cache/puppeteer -type f -name chrome 2>/dev/null || true', { shell: '/bin/bash' }).toString().trim().split('\n')); } catch (e) { /* ignore */ }
    c.push('/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium', '/opt/pw-browsers/chromium');   // the last: the Playwright-provisioned Chromium of the cloud sandbox
    return c.filter(Boolean).find(p => fs.existsSync(p));
}

// The page's Content-Security-Policy allows scripts only from 'self' (the deployed origin), so a file:// page can never load trace.js -- the
// request is blocked before it is made. A --trace run therefore serves BOTH pages from the deployed origin (virtual: intercepted, nothing
// leaves the machine); the run without trace.js aborts that one request, i.e. trace.js genuinely absent.
const PAGE = require('../_page.js');
const VIRTUAL_URL = 'https://tommichael88.github.io/booktomnyc/qr.html';
async function probe(browser, file, traceFile, virtual) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e.message).slice(0, 160)));
    await page.setRequestInterception(true);
    page.on('request', r => {
        if (virtual && r.url().split('?')[0] === VIRTUAL_URL) r.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(file, 'utf8') });
        else if (r.url().includes('btnyc.json')) r.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: fs.readFileSync(ssot, 'utf8') });
        else if (/trace\.js(\?|$)/.test(r.url())) { if (traceFile) r.respond({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(traceFile, 'utf8') }); else r.abort(); }   // the tracer is present only when --trace asks for it
        else if (!virtual && PAGE.documentResponse(r.url())) r.respond(PAGE.documentResponse(r.url()));   // file mode: the page with its external modules assembled in (CSP blocks them from file://)
        else if (virtual && PAGE.localFileForUrl(r.url())) r.respond({ status: 200, contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body: fs.readFileSync(PAGE.localFileForUrl(r.url()), 'utf8') });   // virtual mode: the deployed origin's own module files
        else if (/^https?:/.test(r.url())) r.abort(); else r.continue();
    });
    await page.goto(virtual ? VIRTUAL_URL : 'file://' + file, { waitUntil: 'load' });
    await page.waitForFunction(() => window.DB && window.DB.services, { timeout: 20000 });
    // The trace layer ships OFF; testers switch it ON, which installs the console/error capture and the state-diff observer. The
    // non-interference check must therefore run it RECORDING, not idle.
    if (traceFile) await page.evaluate(() => { _traceToggle(true); });
    const res = await page.evaluate(() => {
        const R = {};
        const norm = s => String(s).replace(/sq-\d+-[a-z0-9]+/g, 'sq-ID').replace(/\s+/g, ' ');
        const cat = svc => svc.ui_taxonomy?.category_id || 'other';
        const snap = () => norm(JSON.stringify(S, (k, v) => (k === '_lastRoute' || k === '_svc' || k === '_selfQuoteSvc') ? ((v && v.id) || undefined) : v));
        const routeJson = r => JSON.stringify(r, (k, v) => typeof v === 'function' ? undefined : (k === 'entity' || k === 'context' ? undefined : v));
        for (const svc of DB.services) {
            const id = svc.id;
            try { R['card:' + id] = norm(createServiceCardElement(svc, cat(svc)).outerHTML); } catch (e) { R['card:' + id] = 'ERR ' + e.message; }
            try { const c = document.getElementById('intakeQuestionsContainer') || document.body; c.innerHTML = ''; showIntakeQuestions(svc, cat(svc)); R['panel:' + id] = norm(c.innerHTML); } catch (e) { R['panel:' + id] = 'ERR ' + e.message; }
            try {
                const route = executeWorkflow(collectBookingContext_catalog(svc, cat(svc)), DB);
                const box = document.createElement('div'); box.id = 'probeBox'; document.body.appendChild(box);
                if (typeof renderCuratedCardFromRoute === 'function') { renderCuratedCardFromRoute(route, 'probeBox'); R['route:' + id] = norm(box.innerHTML); }
                box.remove(); R['routeJson:' + id] = routeJson(route);
            } catch (e) { R['route:' + id] = 'ERR ' + e.message; }
            try { sqRestart(); R['restart:' + id] = snap() + '||' + norm(document.getElementById('sqQuoteOut')?.innerHTML || '') + '||' + norm(document.getElementById('sqUnifiedActionLabel')?.textContent || ''); } catch (e) { R['restart:' + id] = 'ERR ' + e.message; }
            for (const [vname, mut] of [
                ['default', () => {}],
                ['qty2', () => { S.qty = 2; }],
                ['tags', () => { S.manTagIds = Object.keys(DB.smart_tags || {}).slice(0, 3); }],
                ['auto', () => { S._autoSelectedFrom = 'probe'; }],
                ['rec', () => { const o = DB.services.find(x => x.id !== id); S.intent = S.intent || {}; S.intent.recommendedSku = o && o.id; }],
            ]) {
                try { sqRestart(); prefillSmartQuoteFromService(svc, cat(svc)); mut(); sqRenderQuote(); R['quote:' + vname + ':' + id] = norm(document.getElementById('sqQuoteOut')?.innerHTML || ''); }
                catch (e) { R['quote:' + vname + ':' + id] = 'ERR ' + e.message; }
            }
            try { sqRestart(); prefillSmartQuoteFromService(svc, cat(svc)); R['prefill:' + id] = snap() + '||' + norm(document.getElementById('sqSb3')?.innerHTML || '') + '||' + (document.getElementById('sqStepFlow')?.style?.display || ''); } catch (e) { R['prefill:' + id] = 'ERR ' + e.message; }
        }
        // ---- A1.6 extension ------------------------------------------------------------------------------------------------------------------------------------------------
        return R;
    });
    // The adlib and builder families run on a FRESH page load. Before T156 a catalog tap rendered the curated card INTO #sqSb3 and destroyed the step-3 skeleton (#sqQtyV, #sqDetTags, #sqDynGroups),
    // so on a used page sqBuilderFinish() threw on `document.getElementById('sqQtyV').textContent` (PENDING_DECISIONS #114, found by this probe). #114 is fixed (the card has its own host, #sqCardHost),
    // and the used-page journey (tap -> back -> Build it step by step -> finish -> quote) is held by verify_step3_card_host_disjoint.js. These families stay on a fresh page on purpose: a base build older
    // than T156 cannot run them on a used page, and a probe that errors on one side of a comparison compares nothing. To diff across the #114 change itself, the markup it added is allowed by name
    // (see archive/differential_change_T156_card_host.md for the exact --rename / --drop arguments).
    await page.goto(virtual ? VIRTUAL_URL : 'file://' + file, { waitUntil: 'load' });
    await page.waitForFunction(() => window.DB && window.DB.services, { timeout: 20000 });
    if (traceFile) await page.evaluate(() => { _traceToggle(true); });
    const bres = await page.evaluate(() => {
        const R = {};
        const norm = s => String(s).replace(/sq-\d+-[a-z0-9]+/g, 'sq-ID').replace(/\s+/g, ' ');
        const snap = () => norm(JSON.stringify(S, (k, v) => (k === '_lastRoute' || k === '_svc' || k === '_selfQuoteSvc') ? ((v && v.id) || undefined) : v));
        // adlib: sqBuildAdlib() on a seeded session (NOT via prefillSmartQuoteFromService: that renders the curated card into #sqSb3 and destroys #sqAdlibSentence, so sqBuildAdlib would return
        // early and this family would be vacuous -- caught by a mutant test at A1.6). S is seeded as a service tap seeds it: the service, its intent, its type; then 3 variants.
        for (const svc of DB.services) {
            const id = svc.id, c = svc.ui_taxonomy?.category_id || 'other';
            for (const [vname, mut] of [
                ['default', () => {}],
                ['tags', () => { S.manTagIds = Object.keys(DB.smart_tags || {}).slice(0, 3); S._location = 'kitchen'; }],
                ['qty3', () => { S.qty = 3; }],
            ]) {
                try {
                    sqRestart();
                    S._svc = svc; S.stype = (svc.service_type || 'Repair').replace('Install / Mount', 'Install'); S.qty = 1;
                    S.intent = { category: c, label: svc.ui_taxonomy?.display_name || svc.id, group: svc.ui_taxonomy?.display_name || svc.id, base: svc.financial_engine?.base_price ?? 0, stype: S.stype, qtyLabel: 'item', key: svc.id, _groupId: svc.ui_taxonomy?.group_id || null };
                    mut(); sqBuildAdlib();
                    const sent = document.getElementById('sqAdlibSentence');
                    R['adlib:' + vname + ':' + id] = sent ? norm(sent.innerHTML) + '||' + norm(document.getElementById('sqAdlibLogisticNote')?.outerHTML || '') : 'ERR no #sqAdlibSentence';
                } catch (e) { R['adlib:' + vname + ':' + id] = 'ERR ' + e.message; }
            }
        }
        for (const [k, d] of Object.entries(DB.dynamic_services || {})) {
            const parts = k.split('+'), bcat = parts[0], bstype = parts[parts.length - 1], bgrp = parts.length === 3 ? parts[1] : null;
            try {
                sqRestart();
                Object.assign(BLD, { _cat: bcat, _groupId: bgrp, _stype: bstype, _keyword: bgrp || bcat, object: bgrp || bcat, specific: null, action: bstype === 'Install' ? 'install' : bstype === 'Diagnostic' ? 'fix' : 'repair', condition: null, location: null, qty: 1 });
                sqBuilderFinish();
                R['builder:' + k] = snap() + '||' + norm(document.getElementById('sqSb3')?.innerHTML || '') + '||' + norm(document.getElementById('sqAdlibSentence')?.innerHTML || '');
            } catch (e) { R['builder:' + k] = 'ERR ' + e.message; }
        }
        return R;
    });
    Object.assign(res, bres);
    // Is the trace layer genuinely live on this page? (reported, and REQUIRED to be live when --trace was asked for: a non-interference
    // result for a script that never ran would be a false assurance.)
    const traceLive = await page.evaluate(() => ({ fn: typeof _trace, start: typeof _traceStart, log: Array.isArray(window._traceLog) ? window._traceLog.length : null }));
    await page.close();
    return { res, errors: [...new Set(errors)].slice(0, 6), traceLive };
}

const clean = o => (o && typeof o === 'object') ? (Array.isArray(o) ? o.map(clean) : Object.fromEntries(Object.entries(o).filter(([k]) => !ignore.has(k)).map(([k, v]) => [k, clean(v)]))) : o;
const normalize = (k, v) => {
    if (typeof v !== 'string') return v;
    if (k.startsWith('routeJson:')) { try { return clean(JSON.parse(v)); } catch (e) { return v; } }
    if (k.startsWith('restart:') || k.startsWith('prefill:')) { // state snapshot is the part before the first '||'
        const i = v.indexOf('||'); let st = v.slice(0, i); try { st = JSON.stringify(clean(JSON.parse(st))); } catch (e) { /* keep */ } return st + v.slice(i);
    }
    return v;
};

(async () => {
    const chrome = findChrome();
    if (!chrome) { console.error('No Chrome found: set CHROME_PATH'); process.exit(2); }
    const browser = await puppeteer.launch({ headless: 'new', executablePath: chrome, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const a = await probe(browser, baseFile, null, !!traceFile), b = await probe(browser, headFile, traceFile, !!traceFile);
    for (const k of Object.keys(b.res)) if (typeof b.res[k] === 'string') for (const [n, o, scope] of renames) if (k.startsWith(scope)) b.res[k] = b.res[k].split(n).join(o);
    for (const k of Object.keys(b.res)) if (typeof b.res[k] === 'string') for (const [re, scope] of drops) if (k.startsWith(scope)) b.res[k] = b.res[k].replace(re, '');
    await browser.close();
    if (traceFile) {
        const live = b.traceLive.fn === 'function' && b.traceLive.start === 'function', absent = a.traceLive.fn === 'undefined';
        console.log(`trace layer: base run ${absent ? 'ABSENT (as intended)' : 'PRESENT (unexpected)'} | head run ${live ? 'LIVE' : 'NOT LIVE'} (_trace is a ${b.traceLive.fn}; ${b.traceLive.log} trace events captured while rendering)`);
        const recording = b.traceLive.log > 0;
        if (!recording) console.error('The trace layer was switched ON but recorded nothing: the instrumentation never ran.');
        if (!live || !absent || !recording) { console.error('The trace layer was not genuinely live in the head run / absent in the base run: the comparison below would prove nothing.'); process.exit(3); }
    }
    const keys = Object.keys(a.res);
    const diff = keys.filter(k => JSON.stringify(normalize(k, a.res[k])) !== JSON.stringify(normalize(k, b.res[k])));
    const errs = Object.values(b.res).filter(v => String(v).startsWith('ERR')).length;
    const kinds = {}; keys.forEach(k => { const t = k.split(':')[0]; kinds[t] = (kinds[t] || 0) + 1; });
    console.log(`base: ${baseFile}\nhead: ${headFile}`);
    console.log(`entries ${keys.length} ${JSON.stringify(kinds)} | DIFFERENT: ${diff.length} | render errors in head: ${errs} | page errors base/head: ${a.errors.length}/${b.errors.length} | ignored keys: ${[...ignore].join(',') || 'none'} | renames: ${renames.map(r => r[0] + '=' + r[1] + (r[2] ? '@' + r[2] : '')).join(',') || 'none'} | drops: ${drops.length}`);
    Object.entries(b.res).filter(([, v]) => String(v).startsWith('ERR')).slice(0, +process.env.SHOW_ERR || 0).forEach(([k, v]) => console.log('  ERR  ' + k + ' -> ' + String(v).slice(0, 200)));   // SHOW_ERR=n prints the first n render errors (A1.6)
    diff.slice(0, +process.env.SHOW || 6).forEach(k => console.log('  DIFF ' + k)); // SHOW=9999 lists every difference (T148)
    process.exit(diff.length || errs ? 1 : 0);
})().catch(e => { console.error('render_diff failed:', e.message); process.exit(2); });
