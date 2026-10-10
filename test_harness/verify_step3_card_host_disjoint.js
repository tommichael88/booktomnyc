#!/usr/bin/env node
/**
 * verify_step3_card_host_disjoint.js -- after a catalog tap, the guided builder still finishes (PENDING_DECISIONS #114, operator ruling 2026-10-07, option B).
 *
 * @enforces R-INVARIANT-BOUNDARY
 *
 * THE DEFECT (found at T155 by the A1.6 differential probe, not by a customer report). `#sqSb3` was both the step-3 skeleton (`#sqAdlibSentence`, `#sqQtyV`,
 * `#sqDetTags`, `#sqDynGroups`) and the host the curated card rendered into, so a catalog tap on a service with questions REPLACED the skeleton with the card and
 * nothing rebuilt it. A customer who tapped a service, went back, chose "Build it step by step" and finished the builder hit
 * `Cannot set properties of null (setting 'textContent')`: no sentence, no quote, step 3 never shown. Phase A could not change observable behavior, so it was filed.
 *
 * THE RULING. Option B: render the card into a host DISJOINT from the skeleton -- `#sqCardHost`, inside `#sqSb3` -- so the two never overwrite each other. Not (A)
 * (the glue rebuilding the renderer's markup) and not (C) (null guards that hide the symptom and leave the builder with no sentence).
 *
 * WHAT THIS HOLDS (R-INVARIANT-BOUNDARY: the renderer owns its host; no layer depends on a node another renderer may destroy).
 *   1. STRUCTURE. #sqCardHost is inside #sqSb3; the four skeleton nodes exist, none is inside the card host, and the card host is not inside the skeleton wrapper.
 *   2. THE CARD LIVES IN ITS OWN HOST. For EVERY service that draws a curated card on a catalog tap (the population is computed by the page's own classifier, not listed):
 *      the card is in #sqCardHost, the skeleton nodes still exist, and the skeleton is not on screen beside the card.
 *   3. THE ORDINARY JOURNEY, in a real browser: tap the service's tile -> go back (the app's own restoreCategoryView) -> the card is gone and the skeleton is back ->
 *      click the real "Build it step by step" button -> choose the first chip at every step until the builder closes -> NO page error, step 3 is on screen, the
 *      ad-lib sentence is there and names what the customer chose, and the real "Calculate Estimate" button produces a quote with a price.
 *   4. NON-VACUITY. Two mutants of the page are driven the same way and must FAIL it: (a) the card rendered back into #sqSb3 (the defect), (b) the card host not
 *      emptied on restart (the skeleton stays hidden behind a stale card).
 *
 * Needs a Chrome (CHROME_PATH, the usual locations, or /opt/pw-browsers). With none, this test FAILS rather than skipping: a behavioral test that silently does
 * not run is a false statement of coverage (DEFECT-SILENT-SKIP).
 * BTNYC_QR_FILE=<file> runs section 2-3 against any copy of qr.html.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const QR = process.env.BTNYC_QR_FILE ? path.resolve(process.env.BTNYC_QR_FILE) : path.join(ROOT, 'qr.html');
const SSOT = fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8');

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

// Drive one build of the page. `limit` caps the services driven (the mutants need only a few to be caught).
async function drive(puppeteer, chrome, file, limit) {
    const browser = await puppeteer.launch({ headless: 'new', executablePath: chrome, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1000, height: 2400 });
        const pageErrors = new Set();
        page.on('pageerror', e => pageErrors.add(String(e.message).slice(0, 140)));
        await page.setRequestInterception(true);
        page.on('request', r => {
            const _d = require('./_page.js').documentResponse(r.url()); if (_d) return r.respond(_d); 
            if (r.url().includes('btnyc.json')) r.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: SSOT });
            else if (/^https?:/.test(r.url())) r.abort(); else r.continue();
        });
        await page.goto('file://' + file, { waitUntil: 'load' });
        await page.waitForFunction(() => window.DB && window.DB.services, { timeout: 20000 });
        const result = await page.evaluate(async (limit) => {
            const sleep = ms => new Promise(r => setTimeout(r, ms));
            const shown = el => !!el && getComputedStyle(el).display !== 'none';
            const skeletonIds = ['sqAdlibSentence', 'sqQtyV', 'sqDetTags', 'sqDynGroups'];
            const host0 = document.getElementById('sqCardHost'), skel0 = document.getElementById('sqStep3Skeleton'), sb30 = document.getElementById('sqSb3');
            const structure = {
                hostExists: !!host0, hostInSb3: !!(host0 && sb30 && sb30.contains(host0)),
                skeletonIdsExist: skeletonIds.every(id => !!document.getElementById(id)),
                noneInHost: !!host0 && skeletonIds.every(id => !host0.contains(document.getElementById(id))),
                hostNotInSkeleton: !!host0 && !!skel0 && !skel0.contains(host0) && !host0.contains(skel0),
            };
            // The services the card template is meant for, by the page's own classifier. Two kinds are routed AWAY from the step-3 card by prefillSmartQuoteFromService
            // before any card is drawn (they use the older intake panel): furniture selection, and the "Other" tiles. They are excluded by that reason and by no other,
            // and the exclusion is reported, so it cannot quietly grow.
            const classified = DB.services.filter(x => { const c = classifyServiceIntake(x); return c.needsCuratedCardTemplate && !c.isSelfQuoting; });
            const routedAway = classified.filter(x => x.requires_furniture_selection || getServiceProfile(x).isOther);
            let cardServices = classified.filter(x => !routedAway.includes(x));
            const population = cardServices.length;
            if (limit) cardServices = cardServices.slice(0, limit);
            const rows = [];
            for (const svc of cardServices) {
                const row = { id: svc.id };
                try {
                    // 1. the customer taps the service's tile (its own click handler runs)
                    const tile = createServiceCardElement(svc, svc.ui_taxonomy?.category_id || 'other');
                    document.body.appendChild(tile); tile.click(); tile.remove();
                    await sleep(15);
                    const host = document.getElementById('sqCardHost'), skel = document.getElementById('sqStep3Skeleton'), sb3 = document.getElementById('sqSb3');
                    row.cardInHost = !!host && host.children.length > 0 && host.textContent.trim().length > 0;
                    row.skeletonNodesSurvive = skeletonIds.every(id => !!document.getElementById(id));
                    row.skeletonHiddenBesideCard = !!skel && !shown(skel);
                    row.step3Shown = shown(sb3);
                    // 2. the customer goes back (the app's own navigation: this is what the back control and the step-1 dot call)
                    restoreCategoryView();
                    await sleep(15);
                    row.hostEmptyAfterBack = !!document.getElementById('sqCardHost') && document.getElementById('sqCardHost').innerHTML === '';
                    row.skeletonBackAfterBack = shown(document.getElementById('sqStep3Skeleton'));
                    // 3. "Build it step by step" -> the first chip at every step, until the builder closes
                    const btn = document.getElementById('sqUnifiedActionBtn');
                    row.buildButtonVisible = shown(btn);
                    if (btn) btn.click();
                    await sleep(15);
                    const chosen = [];
                    let lastPreview = '';
                    for (let i = 0; i < 14; i++) {
                        const builder = document.getElementById('sqBuilder');
                        const chip = document.querySelector('#sqBuilderChips .sq-b-chip');
                        if (!builder || getComputedStyle(builder).display === 'none' || !chip) break;
                        lastPreview = (document.getElementById('sqBuilderSentence') || {}).textContent || lastPreview;
                        chosen.push(chip.textContent.trim());
                        chip.click();
                        await sleep(8);
                    }
                    await sleep(25);
                    row.chosen = chosen;
                    row.builderClosed = !shown(document.getElementById('sqBuilder'));
                    row.step3ShownAfterBuilder = shown(document.getElementById('sqSb3'));
                    const sentenceEl = document.getElementById('sqAdlibSentence');
                    row.sentence = sentenceEl ? sentenceEl.textContent.replace(/\s+/g, ' ').trim() : null;
                    // what the customer chose, as the builder's own live sentence showed it ("I need to repair my Washer in my Kitchen")
                    const m = /my (.+?)(?: because it is| in my|$)/.exec(lastPreview.replace(/\s+/g, ' ').trim());
                    row.chosenObject = m ? m[1].trim() : null;
                    // 4. the real "Calculate Estimate" button
                    const yes = document.querySelector('.adlib-yes');
                    row.calculateButton = shown(yes);
                    if (yes) { yes.click(); await sleep(60); }
                    const out = document.getElementById('sqQuoteOut');
                    row.quote = out ? out.textContent.replace(/\s+/g, ' ').trim().slice(0, 120) : null;
                } catch (e) { row.threw = String(e.message).slice(0, 140); }
                rows.push(row);
            }
            // A service that draws NO card (the chip path: the quantity moves its price, say) tapped right after a service that does, with no restart between:
            // its step 3 must be its own, not the previous service's card. (Before #114 the previous card stayed on screen: LED Bulb Upgrade showed Leak Under Sink Repair.)
            const noCard = DB.services.filter(x => { const c = classifyServiceIntake(x); return !c.needsCuratedCardTemplate && !c.isSelfQuoting && !x.requires_furniture_selection && !getServiceProfile(x).isOther; });
            const inherit = [];
            const tapTile = async svc => { const t = createServiceCardElement(svc, svc.ui_taxonomy?.category_id || 'other'); document.body.appendChild(t); t.click(); t.remove(); await sleep(15); };
            if (cardServices.length) {
                const first = cardServices[0], firstName = first.ui_taxonomy?.display_name || first.id;
                // The services routed to the older intake panel (furniture selection, "Other") are tapped too: they draw no card of their own and must not show the previous one either.
                for (const svc of [...noCard, ...routedAway]) {
                    try {
                        sqRestart(); await tapTile(first);
                        await tapTile(svc);
                        const host = document.getElementById('sqCardHost'), skel = document.getElementById('sqStep3Skeleton'), sb3 = document.getElementById('sqSb3');
                        const away = routedAway.includes(svc);
                        inherit.push({ id: svc.id, hostEmpty: !!host && host.innerHTML === '', skeletonShown: away ? true : shown(skel), staleName: !!sb3 && sb3.textContent.includes(firstName) });
                    } catch (e) { inherit.push({ id: svc.id, threw: String(e.message).slice(0, 100) }); }
                }
            }
            // The chip step opened while a card is still in the host (the free-text pipeline's last move, sqPrepareFlow -> sqBuildStep3): driven directly, seeded the way
            // the differential's ad-lib family seeds a session, because no customer path leaves a card there once the clears above have run -- this holds the last line.
            let chipStep = null;
            if (cardServices.length) {
                try {
                    const first = cardServices[0];
                    sqRestart(); await tapTile(first);
                    S._svc = first; S.stype = 'Repair'; S.qty = 1;
                    S.intent = { category: first.ui_taxonomy?.category_id || 'other', label: first.id, group: first.id, base: 0, stype: 'Repair', qtyLabel: 'item', key: first.id, _groupId: null };
                    sqBuildStep3();
                    await sleep(15);
                    const host = document.getElementById('sqCardHost'), skel = document.getElementById('sqStep3Skeleton');
                    chipStep = { hostEmpty: !!host && host.innerHTML === '', skeletonShown: shown(skel), chipsDrawn: (document.getElementById('sqDynGroups') || { innerHTML: '' }).innerHTML.length > 0 };
                } catch (e) { chipStep = { threw: String(e.message).slice(0, 100) }; }
            }
            return { structure, population, routedAway: routedAway.map(x => x.id), inherit, chipStep, rows };
        }, limit || 0);
        return { ...result, pageErrors: [...pageErrors] };
    } finally { await browser.close(); }
}

// Does this driven build keep the journey whole? One verdict per property, so a mutant can be told apart from the real page.
function verdicts(r) {
    const rows = r.rows;
    const all = f => rows.length > 0 && rows.every(f);
    const names = (f) => rows.filter(x => !f(x)).map(x => x.id).slice(0, 5).join(', ');
    return {
        structure: r.structure.hostExists && r.structure.hostInSb3 && r.structure.skeletonIdsExist && r.structure.noneInHost && r.structure.hostNotInSkeleton,
        cardInOwnHost: [all(x => x.cardInHost && x.step3Shown), names(x => x.cardInHost && x.step3Shown)],
        skeletonSurvivesTap: [all(x => x.skeletonNodesSurvive && x.skeletonHiddenBesideCard), names(x => x.skeletonNodesSurvive && x.skeletonHiddenBesideCard)],
        backRestoresSkeleton: [all(x => x.hostEmptyAfterBack && x.skeletonBackAfterBack), names(x => x.hostEmptyAfterBack && x.skeletonBackAfterBack)],
        builderFinishes: [all(x => !x.threw && x.buildButtonVisible && x.builderClosed && x.step3ShownAfterBuilder) && r.pageErrors.length === 0, names(x => !x.threw && x.builderClosed && x.step3ShownAfterBuilder)],
        sentenceNamesWhatWasChosen: [all(x => x.sentence && x.chosenObject && x.sentence.toLowerCase().includes(x.chosenObject.toLowerCase())), names(x => x.sentence && x.chosenObject && x.sentence.toLowerCase().includes(x.chosenObject.toLowerCase()))],
        inheritsNothing: [r.inherit.length > 0 && r.inherit.every(x => !x.threw && x.hostEmpty && x.skeletonShown && !x.staleName), r.inherit.filter(x => x.threw || !(x.hostEmpty && x.skeletonShown && !x.staleName)).map(x => x.id).slice(0, 5).join(', ')],
        chipStepGetsSkeleton: [!!r.chipStep && !r.chipStep.threw && r.chipStep.hostEmpty && r.chipStep.skeletonShown && r.chipStep.chipsDrawn, JSON.stringify(r.chipStep)],
        quoteHasAPrice: [all(x => x.calculateButton && x.quote && /\$\s*\d/.test(x.quote)), names(x => x.calculateButton && x.quote && /\$\s*\d/.test(x.quote))],
    };
}
const passes = (v, k) => (Array.isArray(v[k]) ? v[k][0] : v[k]);

(async () => {
    const chrome = findChrome();
    check(!!chrome, 'a Chrome is available to run this behavioral test', 'no Chrome found (set CHROME_PATH): a behavioral test that does not run is a false statement of coverage');
    if (!chrome) { console.log(`\n[step-3 card host disjoint] ${pass} passed, ${fail} failed (of ${pass + fail} checks)`); process.exit(1); }
    let puppeteer;
    try { puppeteer = require('puppeteer-core'); } catch (e) { puppeteer = require(path.join(__dirname, 'node_modules', 'puppeteer-core')); }

    console.log('=== 1-3. The real page: structure, the card in its own host, and tap -> back -> Build it step by step -> finish ===');
    const real = await drive(puppeteer, chrome, QR, 0);
    const v = verdicts(real);
    check(real.population >= 50, `${real.population} services draw a curated card on a catalog tap (floor 50: "every service" means something)`, `only ${real.population} card services (floor 50)`);
    check(real.routedAway.length <= 3, `${real.routedAway.length} classified card service(s) are routed to the older intake panel by the tap before any card is drawn (${real.routedAway.join(', ') || 'none'}); the exclusion may not grow past 3`, `${real.routedAway.length} services excluded (${real.routedAway.join(', ')}): the exclusion has grown`);
    check(v.structure, '#sqCardHost is inside #sqSb3; the four skeleton nodes exist, none inside the card host; the card host and the skeleton wrapper are disjoint', 'the step-3 structure is not disjoint', JSON.stringify(real.structure));
    check(passes(v, 'cardInOwnHost'), `${real.rows.length}/${real.population} taps put the card in #sqCardHost, and step 3 is on screen`, 'a tap did not draw the card in its own host', v.cardInOwnHost[1]);
    check(passes(v, 'skeletonSurvivesTap'), 'after every tap the skeleton nodes still exist and the skeleton is not shown beside the card', 'a tap destroyed (or left on screen) the step-3 skeleton', v.skeletonSurvivesTap[1]);
    check(passes(v, 'backRestoresSkeleton'), 'going back empties the card host and gives the skeleton back, for every service', 'going back left a stale card or a hidden skeleton', v.backRestoresSkeleton[1]);
    check(passes(v, 'builderFinishes'), 'tap -> back -> "Build it step by step" -> finish: the builder closes, step 3 is on screen, and the page raises no error, for every service', 'the builder did not finish after a catalog tap', JSON.stringify({ names: v.builderFinishes[1], errors: real.pageErrors, threw: real.rows.filter(r => r.threw).slice(0, 3).map(r => r.id + ': ' + r.threw) }));
    check(passes(v, 'sentenceNamesWhatWasChosen'), 'the ad-lib sentence renders and names what the customer chose in the builder, for every service', 'the sentence is missing or does not name the choice', v.sentenceNamesWhatWasChosen[1]);
    check(real.inherit.length >= 3, `${real.inherit.length} services that draw no card are tapped right after one that does (floor 3)`, `only ${real.inherit.length} no-card services found (floor 3)`);
    check(passes(v, 'inheritsNothing'), 'a service that draws no card, tapped right after one that does (no restart), shows its own step 3 and none of the previous card', 'a no-card service inherited the previous service\'s card', v.inheritsNothing[1]);
    check(passes(v, 'chipStepGetsSkeleton'), 'opening the chip step while a card is still in the host removes the card and gives the skeleton (with its chips) back', 'the chip step opened behind a stale card', v.chipStepGetsSkeleton[1]);
    check(passes(v, 'quoteHasAPrice'), 'the real "Calculate Estimate" button renders a quote with a price, for every service', 'no quote with a price after the builder', v.quoteHasAPrice[1]);

    console.log('\n=== 4. Non-vacuity: the same journey FAILS on a page with the defect ===');
    const src = require('./_page.js').readPage(QR), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'host-'));
    const mutants = [
        ['the card rendered back into #sqSb3 (the defect)', "sqRenderCuratedCard(_curatedRoute, 'sqCardHost');", "sqRenderCuratedCard(_curatedRoute, 'sqSb3');", ['skeletonSurvivesTap', 'builderFinishes']],
        ['the card host not emptied on restart', "sqClearCardHost();   // #114: a previous service's card must not survive a restart", '', ['backRestoresSkeleton']],
        ['opening step 3 does not remove a card left in the host', 'if (n === 3) sqClearCardHost();', '', ['chipStepGetsSkeleton']],
        ['the card host not emptied by a catalog tap', 'sqClearCardHost();   // #114: every catalog tap starts from an empty card host, even one that is routed to the older intake panel below (a service that draws no card must not show the previous service\'s)', '', ['inheritsNothing']],
    ];
    for (const [label, from, to, mustBreak] of mutants) {
        // T158: the anchor is matched by its tokens, not by the whitespace between them: the operator's formatter re-spaces statements and their trailing comments, and an
        // anchor that depends on the spacing fails when the spacing changes. The anchor must still exist exactly once-or-more (missing is an error), and the mutant is unchanged.
        const anchorRe = new RegExp(from.split(/\s+/).filter(Boolean).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*'));
        if (!anchorRe.test(src)) { bad(`mutant anchor missing: ${label}`, from); continue; }
        const f = path.join(tmp, 'm' + Math.abs(label.length * 31 + from.length) + '.html');
        fs.writeFileSync(f, src.replace(anchorRe, () => to));
        const m = await drive(puppeteer, chrome, f, 6);
        const mv = verdicts(m);
        const broke = mustBreak.filter(k => !passes(mv, k));
        check(broke.length === mustBreak.length, `MUTANT (${label}) is caught: ${mustBreak.join(' and ')} fail${mustBreak.length === 1 ? 's' : ''}`, `MUTANT (${label}) went undetected`, JSON.stringify({ expectedToBreak: mustBreak, broke, errors: m.pageErrors.slice(0, 2) }));
    }

    console.log(`\n[step-3 card host disjoint] ${pass} passed, ${fail} failed (of ${pass + fail} checks)`);
    process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error('ERROR', e.stack || e.message); process.exit(2); });
