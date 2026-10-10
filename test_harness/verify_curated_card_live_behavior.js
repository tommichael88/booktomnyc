#!/usr/bin/env node
/**
 * verify_curated_card_live_behavior.js
 *
 * WHY THIS EXISTS. verify_reported_ui_bugs_batch2.js protected two real, customer-reported bugs, but its checks were
 * regexes over the SOURCE TEXT of the legacy curated-intake builder (`questionIndex`, `minsAffectPrice`). That builder
 * was not what customers ran -- the curated card is drawn by renderCuratedCardFromRoute -- so the suite stayed green
 * while asserting nothing about the live screen (PROJECT_CHARTER Battle 13: "a code-shape check will miss the class of
 * bug that only shows up when the DOM is genuinely rendered"). The legacy builder is retired (R-INVARIANT-DELETION);
 * the intent of those two fixes is verified here against the REAL rendered card, in a real browser, for EVERY service.
 *
 *   BUG 1 (misleading "+45min"): an answer that changes only minutes -- and so not the price -- must not be labelled
 *          with minutes. Invariant: no "+<n>min" text appears anywhere in the rendered card.
 *   BUG 2 (broken question numbers, reported as "0, 1, 1, 2, 2, 2"): Invariant: the numbers shown are positive,
 *          strictly increasing, and never repeat -- with nothing answered, and with the first two questions answered.
 *
 * WHAT KIND OF CHECK EACH IS (R-GOVERN-GOODHART). Question numbering and the minutes label are INTERFACE-CONTRACT checks of the renderer's boundary
 * (route in, DOM out) -- including a state with answers, which a customer cannot reach through the catalog tile today (answer chips are inert there:
 * a pre-existing defect, tracked in the ledger, deliberately NOT asserted green here). The price indicator is a BEHAVIORAL check through the real tile.
 * ANSWERING is measured by clicking the real chips on the real card (and the diagnostic fork's deep-dive questions), for every service with a chip.
 * Needs a Chrome (CHROME_PATH, the usual locations, or the puppeteer cache) -- the same requirement as
 * verify_smoke_test_puppeteer.js. If none is found this test FAILS rather than skipping: a behavioral test that
 * silently does not run is a false statement of coverage.
 * BTNYC_QR_FILE=<file> runs it against any copy of qr.html.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { check, finish } = require('./_shared.js');
const Q = require('./_qr_blocks.js');

const ROOT = path.resolve(__dirname, '..');
const SSOT = path.join(ROOT, 'btnyc.json');

function findChrome() {
    const c = [process.env.CHROME_PATH];
    try { c.push(...execSync('find /home/*/.cache/puppeteer /root/.cache/puppeteer -type f -name chrome 2>/dev/null || true', { shell: '/bin/bash' }).toString().trim().split('\n')); } catch (e) { /* ignore */ }
    c.push('/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium');
    return c.filter(Boolean).find(p => fs.existsSync(p));
}

(async () => {
    const chrome = findChrome();
    check('a Chrome is available to run this behavioral test', !!chrome, { expected: 'a Chrome binary', got: 'none (set CHROME_PATH)' });
    if (!chrome) finish('curated card live behavior');
    const puppeteer = require('puppeteer-core');
    const browser = await puppeteer.launch({ headless: 'new', executablePath: chrome, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(String(e.message).slice(0, 140)));
    await page.setRequestInterception(true);
    page.on('request', r => {
        const _d = require('./_page.js').documentResponse(r.url()); if (_d) return r.respond(_d); 
        if (r.url().includes('btnyc.json')) r.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: fs.readFileSync(SSOT, 'utf8') });
        else if (/^https?:/.test(r.url())) r.abort(); else r.continue();
    });
    await page.goto('file://' + Q.QR_PATH, { waitUntil: 'load' });
    await page.waitForFunction(() => window.DB && window.DB.services, { timeout: 20000 });

    const rows = await page.evaluate(() => {
        const out = [];
        const cat = svc => svc.ui_taxonomy?.category_id || 'other';
        for (const svc of DB.services) {
            if (!(svc.intake_chain && svc.intake_chain.length)) continue;
            for (const variant of ['nothing answered', 'first two answered']) {
                try {
                    let ctx = collectBookingContext_catalog(svc, cat(svc));
                    if (variant === 'first two answered') {
                        // Answer the first two questions of the chain the LIVE route actually composes (route.intakeChain), not of
                        // svc.intake_chain: the route composes its own chain, and answers keyed to modules it does not render would
                        // leave nothing answered -- the variant would silently test the same thing as the first one.
                        const chain0 = executeWorkflow(ctx, DB).intakeChain || [];
                        ctx = collectBookingContext_catalog(svc, cat(svc));
                        ctx.answers = {};
                        chain0.slice(0, 2).forEach(m => { const r = (m.client_response || [])[0]; if (r) ctx.answers[m.moduleKey || m.module] = r.label; });
                    }
                    const route = executeWorkflow(ctx, DB);
                    const box = document.createElement('div'); box.id = 'probeBox'; document.body.appendChild(box);
                    renderCuratedCardFromRoute(route, 'probeBox');
                    // T156: the quantity control (T153: a '-' / '+' row, `.ims-qty`) is a control, not a numbered question, so it carries an unnumbered label by design; the numbering invariant is about the questions.
                    const labels = [...box.querySelectorAll('.ims-label')].filter(e => !e.closest('.ims-qty')).map(e => e.textContent.trim());
                    const qtyRows = box.querySelectorAll('.ims-qty').length;
                    const answeredCount = Object.keys(route.answers || {}).length;
                    const minsText = (box.textContent.match(/\+\s*\d+\s*min/gi) || []);
                    box.remove();
                    out.push({ id: svc.id, variant, labels, minsText, answeredCount, qtyRows });
                } catch (e) { out.push({ id: svc.id, variant, error: e.message }); }
            }
        }
        return out;
    });
    // FEATURE: the "this question changes your price" indicator (SSOT intake_modules[*].affects_price + ui_config.affects_price_icon).
    // Measured the way a customer meets it (R-GOVERN-GOODHART): the real service TILE is tapped (its own click handler runs), and the card is
    // judged by what is VISIBLE -- each question's own text is looked up in the SSOT to learn whether it should carry the indicator. It reads no
    // internal route state and no hook added for tests, so a refactor that keeps the behavior cannot break it.
    const ind = await page.evaluate(() => {
        const out = [];
        const cat = svc => svc.ui_taxonomy?.category_id || 'other';
        // A module's question may carry placeholders the card fills in ({item_noun}); match them as wildcards, longest question first.
        const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const questions = Object.values(DB.intake_modules || {}).filter(m => m && m.question)
            .map(m => ({ q: m.question.trim(), re: new RegExp('^' + esc(m.question.trim()).replace(/\\\{[^}]*\\\}/g, '.+?')), affects: m.affects_price === true }))
            .sort((x, y) => y.q.length - x.q.length);
        for (const svc of DB.services) {
            try {
                sqRestart();   // (a service that draws no card must not inherit the previous one: the app empties the card host itself, PENDING_DECISIONS #114)
                const tile = createServiceCardElement(svc, cat(svc)); document.body.appendChild(tile); tile.click(); tile.remove();
                const box = document.getElementById('sqSb3'); if (!box) continue;
                box.querySelectorAll('.ims-label').forEach(l => {
                    const text = l.textContent.replace(/^\s*\d+\.\s*/, '').trim();
                    const m = questions.find(x => x.re.test(text));
                    if (!m) { out.push({ id: svc.id, unmatched: true, text: text.slice(0, 70) }); return; }
                    const tag = l.querySelector('.sq-ic-price-tag');
                    out.push({ id: svc.id, q: m.q.slice(0, 40), has: !!tag, want: m.affects, isElement: !!(tag && tag.querySelector('i.ti.ti-currency-dollar')), literal: /ti-currency-dollar/.test(l.textContent) });
                });
            } catch (e) { out.push({ id: svc.id, error: e.message }); }
        }
        return out;
    });
    // ANSWERING (behavioral, through the real tile). Before T145 a chip click on the catalog card selected nothing and recorded nothing (the handler
    // read window globals only the free-text path set). Measured here as a customer meets it: tap the tile, click answers, read the card.
    const ans = await page.evaluate(async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const cat = svc => svc.ui_taxonomy?.category_id || 'other';
        // Each tap starts from a clean step 3: a service that draws no chip card (a self-quote template, say) must not be judged on the PREVIOUS service's stale card.
        // This used to wipe #sqSb3 by hand (the card was rendered INTO it and the restart did not clear it); since #114 the card has its own host and the app empties it
        // on restart and on every catalog tap, so the test no longer does the app's job for it.
        const tap = async svc => { sqRestart(); const t = createServiceCardElement(svc, cat(svc)); document.body.appendChild(t); t.click(); t.remove(); await sleep(15); return document.getElementById('sqSb3'); };
        const blocks = () => [...document.getElementById('sqSb3').querySelectorAll('.intake-module-step')];
        const price = () => (document.getElementById('sqSb3').querySelector('.price-value') || {}).textContent || null;
        const labels = () => [...document.getElementById('sqSb3').querySelectorAll('.ims-label')].map(l => l.textContent.replace(/^\s*\d+\.\s*/, '').trim());
        const out = { chips: [], services: 0, priceMoves: 0, pathA: [], purity: {} };
        const out2 = { moves: [], hubs: 0 };
        for (const svc of DB.services) {
            try {
                await tap(svc);
                const b0 = blocks()[0]; if (!b0) continue;
                const texts = [...b0.querySelectorAll('.ims-chip')].map(c => c.textContent.trim()); if (!texts.length) continue;
                out.services++; const prices = new Set();
                for (let i = 0; i < texts.length; i++) {
                    if (i > 0) await tap(svc); // every answer is judged from the card exactly as the customer first sees it
                    [...blocks()[0].querySelectorAll('.ims-chip')][i].click(); await sleep(5);
                    const bl = blocks(), hub = !!document.getElementById('sqSb3').querySelector('.divergence-hub');
                    // An answer may legitimately resolve the route to the diagnostic fork ("Not sure -- just want it checked"): the card then shows
                    // the hub and no question block. A card with neither is BLANK, and that is a failure.
                    if (!bl.length) { if (hub) out2.hubs++; out.chips.push({ id: svc.id, i, ok: hub, sel: [hub ? '(fork hub)' : '(blank card)'] }); continue; }
                    const sel = [...bl[0].querySelectorAll('.ims-chip.sel')].map(c => c.textContent.trim());
                    prices.add(price()); out.chips.push({ id: svc.id, i, ok: sel.length === 1 && sel[0] === texts[i], sel });
                }
                if (prices.size > 1) out.priceMoves++;
                if (texts.length > 1) { // the selection MOVES: answer one way, then another, in the same question
                    await tap(svc); [...blocks()[0].querySelectorAll('.ims-chip')][0].click(); await sleep(5);
                    if (blocks().length) {
                        [...blocks()[0].querySelectorAll('.ims-chip')][1].click(); await sleep(5);
                        const bl = blocks();
                        if (bl.length) { const sel = [...bl[0].querySelectorAll('.ims-chip.sel')].map(c => c.textContent.trim()); out2.moves.push({ id: svc.id, ok: sel.length === 1 && sel[0] === texts[1], sel }); }
                    }
                }
            } catch (e) { out.chips.push({ id: svc.id, error: e.message }); }
        }
        out.moves = out2.moves; out.hubs = out2.hubs;
        // the diagnostic fork: "answer a few more questions" appends deep-dive questions; answering one must not make the others disappear
        for (const svc of DB.services) {
            try {
                const box = await tap(svc); if (!box.querySelector('.divergence-hub')) continue;
                const btn = [...box.querySelectorAll('[onclick]')].find(e => /orchChooseDivergencePath\('remote'\)/.test(e.getAttribute('onclick'))); if (!btn) continue;
                btn.click(); await sleep(15);
                const before = labels(), bl = blocks(), chip = bl.length && bl[bl.length - 1].querySelector('.ims-chip');
                if (!chip) { out.pathA.push({ id: svc.id, noChip: true, before }); continue; }
                const lastText = chip.textContent.trim(); chip.click(); await sleep(15);
                const after = labels(), bl2 = blocks();
                out.pathA.push({ id: svc.id, before, after, kept: before.every(q => after.includes(q)), selected: !!bl2.length && [...bl2[bl2.length - 1].querySelectorAll('.ims-chip.sel')].some(c => c.textContent.trim() === lastText) });
            } catch (e) { out.pathA.push({ id: svc.id, error: e.message }); }
        }
        // the Logic function at its own boundary: route in, route out, the previous route untouched, answers carried and accumulated
        try {
            const door = DB.services.find(x => x.id === 'prehung_interior_door_install');
            const route = executeWorkflow(collectBookingContext_catalog(door, cat(door)), DB), snap = JSON.stringify(route);
            const m0 = route.intakeChain[0], m1 = route.intakeChain[1], k0 = m0.moduleKey || m0.module, k1 = m1.moduleKey || m1.module;
            const l0 = m0.client_response[0].label, l1 = m1.client_response[0].label;
            const n1 = orch_apply_answer(route, k0, l0, DB), n2 = orch_apply_answer(n1, k1, l1, DB), bare = { entity: null };
            out.purity = { untouched: JSON.stringify(route) === snap, newRoute: n1 !== route, carried: n1.answers[k0] === l0 && n1.context.answers[k0] === l0,
                accumulates: n2.answers[k0] === l0 && n2.answers[k1] === l1, noContext: orch_apply_answer(bare, k0, l0, DB) === bare };
        } catch (e) { out.purity = { error: e.message }; }
        return out;
    });
    await browser.close();

    const errors = rows.filter(r => r.error);
    const withQuestions = rows.filter(r => !r.error && r.labels.length);
    check(`the live card rendered for ${rows.length} (service, state) cases without throwing`, errors.length === 0, { expected: 0, got: errors.slice(0, 4).map(e => `${e.id}/${e.variant}: ${e.error}`) });
    check('no page errors while rendering', pageErrors.length === 0, { expected: 0, got: pageErrors.slice(0, 3) });
    check(`enough services exercised to mean something (${withQuestions.length} cases show at least one question)`, withQuestions.length >= 40, { expected: '>= 40', got: withQuestions.length });

    // the guard on the guard: the 'answered' variant must really have changed what is on screen for some services
    const sawAnswered = rows.some(r => r.variant === 'first two answered' && r.answeredCount > 0);
    check('the "first two answered" variant really marks questions answered (otherwise it tests nothing)', sawAnswered, { expected: 'some cases with answeredCount > 0', got: 'none' });

    // The exclusion above must not be a way to stop looking: some cards must really draw the quantity row.
    check('the quantity control (.ims-qty) is exercised by this probe (the numbering check below excludes it by design)', rows.some(r => r.qtyRows > 0), { expected: 'some cards with a quantity row', got: 'none' });

    // BUG 2: numbering
    const badNumbering = [];
    for (const r of withQuestions) {
        const nums = r.labels.map(l => { const m = l.match(/^(\d+)\.\s/); return m ? parseInt(m[1], 10) : NaN; });
        const ok = nums.every(n => Number.isInteger(n) && n > 0) && nums.every((n, i) => i === 0 || n > nums[i - 1]);
        if (!ok) badNumbering.push(`${r.id}/${r.variant}: ${JSON.stringify(nums)}`);
    }
    check('BUG 2: question numbers are positive, strictly increasing and never repeat (the reported "0,1,1,2,2,2" class)', badNumbering.length === 0, { expected: 0, got: badNumbering.slice(0, 5) });

    // BUG 1: minutes-only labels
    const withMins = rows.filter(r => !r.error && r.minsText.length).map(r => `${r.id}/${r.variant}: ${r.minsText.join(',')}`);
    check('BUG 1: no "+<n>min" label appears on the card (an answer that only changes minutes must not imply a price change)', withMins.length === 0, { expected: 0, got: withMins.slice(0, 5) });

    // the price-affecting indicator
    const indErr = ind.filter(r => r.error), matched = ind.filter(r => !r.error && !r.unmatched), want = matched.filter(r => r.want), unmatched = ind.filter(r => r.unmatched);
    check('indicator: tapping the real tile and reading the card did not throw', indErr.length === 0, { expected: 0, got: indErr.slice(0, 3).map(e => `${e.id}: ${e.error}`) });
    // Parameterized quantity questions ("How many … need attention?", built from an item-count template) cannot be looked up by their text: they are REPORTED here, not judged.
    check(`indicator: the large majority of visible questions were recognised in the SSOT (${matched.length} judged, ${unmatched.length} parameterized and not judged)`, matched.length >= 100 && unmatched.length <= (matched.length + unmatched.length) * 0.10, { expected: '>= 100 judged, <= 10% not judged', got: { matched: matched.length, unmatched: unmatched.length, examples: unmatched.slice(0, 4).map(u => u.id + ': ' + u.text) } });
    check(`indicator: enough price-affecting questions exercised to mean something (${want.length})`, want.length >= 20, { expected: '>= 20', got: want.length });
    const wrong = matched.filter(r => r.has !== r.want).map(r => `${r.id}/${r.q}: has=${r.has} want=${r.want}`);
    check('indicator: shown on EVERY question the SSOT marks affects_price, and on no other', wrong.length === 0, { expected: 0, got: wrong.slice(0, 5) });
    const notEl = want.filter(r => !r.isElement || r.literal).map(r => `${r.id}/${r.q}`);
    check('indicator: drawn as a real <i class="ti ti-currency-dollar"> element, never as literal text', notEl.length === 0, { expected: 0, got: notEl.slice(0, 5) });

    // answering
    const badChip = ans.chips.filter(r => r.error || !r.ok).map(r => r.error ? `${r.id}: ${r.error}` : `${r.id}[${r.i}] selected ${JSON.stringify(r.sel)}`);
    check(`answering: clicking a chip on the real card selects exactly that chip, for every answer of the first question of ${ans.services} services (${ans.chips.length} clicks)`, badChip.length === 0, { expected: 0, got: badChip.slice(0, 5) });
    const badMove = ans.moves.filter(r => !r.ok).map(r => `${r.id}: ${JSON.stringify(r.sel)}`);
    check(`answering: the selection MOVES -- answering one way then another leaves only the second selected (${ans.moves.length} services)`, ans.moves.length >= 30 && badMove.length === 0, { expected: '>= 30 services, 0 failures', got: { n: ans.moves.length, bad: badMove.slice(0, 4) } });
    check(`answering: ${ans.hubs} answer(s) resolve the route to the diagnostic fork, and each shows the hub rather than a blank card`, ans.chips.every(r => r.ok !== false || !/blank/.test((r.sel || [])[0] || '')), { got: ans.chips.filter(r => /blank/.test((r.sel || [])[0] || '')).slice(0, 4) });
    check(`answering: enough services exercised to mean something (${ans.services})`, ans.services >= 40, { expected: '>= 40', got: ans.services });
    check(`answering: an answer is not decoration -- on ${ans.priceMoves} services some answer moves the displayed price`, ans.priceMoves >= 3, { expected: '>= 3', got: ans.priceMoves });
    const badA = ans.pathA.filter(r => r.error || r.noChip || !r.kept || !r.selected).map(r => r.error ? `${r.id}: ${r.error}` : `${r.id}: kept=${r.kept} selected=${r.selected}`);
    check(`diagnostic fork: after "answer a few more questions", answering a deep-dive question keeps every question on the card and selects the answer (${ans.pathA.length} services)`, ans.pathA.length >= 3 && badA.length === 0, { expected: '>= 3 services, 0 failures', got: { n: ans.pathA.length, bad: badA.slice(0, 4) } });
    check('orch_apply_answer: route in, route out -- the previous route is untouched and the answer is carried', ans.purity.untouched === true && ans.purity.newRoute === true && ans.purity.carried === true, { got: ans.purity });
    check('orch_apply_answer: answers accumulate across calls, and a route without its context is returned unchanged', ans.purity.accumulates === true && ans.purity.noContext === true, { got: ans.purity });

    finish('curated card live behavior');
})().catch(e => { check('the behavioral test ran to completion', false, { got: e.message }); finish('curated card live behavior'); });
