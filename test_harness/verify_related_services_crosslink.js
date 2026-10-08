#!/usr/bin/env node
/**
 * verify_related_services_crosslink.js
 *
 * Real, full-document, jsdom-based end-to-end test for the T118, Step 6
 * item 9 fix for PENDING_DECISIONS.md #25: a customer wanting knob
 * installation (cabinet_knob_or_pull_install) can land on
 * cabinet_door_or_drawer_adjustment instead via catalog navigation --
 * a materially different job.
 *
 * Fix: a bidirectional related_services field, surfaced as a real,
 * working cross-link on the curated intake card (renderCuratedCardFromRoute)
 * that switches to the other service via prefillSmartQuoteFromService,
 * the same proven navigation path other flows already use.
 *
 * Built as a full jsdom render+click test, not a data-only check --
 * Step 6 item 6's own fix had a real bug (a step silently auto-skipped)
 * that only an end-to-end test caught, not a narrower one.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require(path.join(__dirname, 'node_modules', 'jsdom'));

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML_PATH = path.join(REPO_ROOT, 'qr.html');
const BTNYC_JSON_PATH = path.join(REPO_ROOT, 'btnyc.json');

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  \u2713 ${label}`); }
    else { fail++; console.log(`  \u2717 ${label}`); }
}

const html = fs.readFileSync(QR_HTML_PATH, 'utf8');
const btnycJson = fs.readFileSync(BTNYC_JSON_PATH, 'utf8');
const consoleErrors = [];
const windowErrors = [];

const dom = new JSDOM(html, {
    url: 'https://tommichael88.github.io/booktomnyc/qr.html',
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    beforeParse(window) {
        window.fetch = async (url) => {
            if (String(url).includes('btnyc.json')) return { ok: true, json: async () => JSON.parse(btnycJson) };
            return { ok: false, status: 404 };
        };
        window.HTMLElement.prototype.scrollIntoView = function () {};
        window.console.error = (...args) => consoleErrors.push(args.join(' '));
        window.addEventListener('error', (e) => windowErrors.push(e.message));
    },
});

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function tap(t, w) { t.dispatchEvent(new w.Event('click', { bubbles: true })); }

(async () => {
    const w = await wait(3000).then(() => dom.window);
    const doc = w.document;

    console.log('=== App initializes cleanly with the new cross-link code present ===');
    check('zero console.error calls during init', consoleErrors.length === 0);
    if (consoleErrors.length) consoleErrors.forEach(e => console.log('    console.error:', e));
    check('zero uncaught window errors during init', windowErrors.length === 0);
    check('renderCuratedCardFromRoute is defined', typeof w.renderCuratedCardFromRoute === 'function');
    check('prefillSmartQuoteFromService is defined', typeof w.prefillSmartQuoteFromService === 'function');

    console.log('\n=== Data: related_services is real and bidirectional ===');
    const adj = w.DB.services.find(s => s.id === 'cabinet_door_or_drawer_adjustment');
    const knob = w.DB.services.find(s => s.id === 'cabinet_knob_or_pull_install');
    check('cabinet_door_or_drawer_adjustment links to cabinet_knob_or_pull_install', adj.related_services?.includes('cabinet_knob_or_pull_install'));
    check('cabinet_knob_or_pull_install links back', knob.related_services?.includes('cabinet_door_or_drawer_adjustment'));

    console.log('\n=== Rendering the curated card for the real, motivating case (landed on adjustment, wanted knob install) ===');
    const route = {
        entity: adj,
        intakeChain: [],
        answers: {},
        quote: null,
    };
    w.renderCuratedCardFromRoute(route);
    await wait(50);

    const notice = doc.querySelector('.related-services-notice');
    check('the related-services notice actually renders in the DOM', !!notice);
    check('it names the real, correct alternative service by its real display name',
        notice?.textContent.includes(knob.ui_taxonomy.display_name));

    const switchBtn = doc.querySelector('.related-service-switch');
    check('a real, clickable "Switch to that" button renders', !!switchBtn);
    check('the button carries the correct target service id as a data attribute',
        switchBtn?.dataset.relatedSvc === 'cabinet_knob_or_pull_install');

    console.log('\n=== Clicking the button actually switches, via the same real navigation path other flows use ===');
    let capturedSvc = null, capturedCat = null;
    const originalPrefill = w.prefillSmartQuoteFromService;
    w.prefillSmartQuoteFromService = (svc, cat) => { capturedSvc = svc; capturedCat = cat; };
    if (switchBtn) tap(switchBtn, w);
    await wait(50);
    check('clicking the button calls prefillSmartQuoteFromService with the real, correct target service',
        capturedSvc?.id === 'cabinet_knob_or_pull_install');
    check('with a real, correct category_id, not null/undefined', capturedCat === 'minor_home_repairs');
    w.prefillSmartQuoteFromService = originalPrefill;

    console.log('\n=== Regression: a service with no related_services renders cleanly, no notice, no crash ===');
    consoleErrors.length = 0;
    const plainSvc = w.DB.services.find(s => s.id === 'faucet_repair_drip');
    w.renderCuratedCardFromRoute({ entity: plainSvc, intakeChain: [], answers: {}, quote: null });
    await wait(50);
    check('no related-services notice renders for a service with none defined', !doc.querySelector('.related-services-notice'));
    check('no new console errors from rendering a service with no related_services', consoleErrors.length === 0);

    console.log(`\n[related-services cross-link, #25] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
    process.exit(fail > 0 ? 1 : 0);
})();
