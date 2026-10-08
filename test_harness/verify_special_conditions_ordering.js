#!/usr/bin/env node
/**
 * verify_special_conditions_ordering.js
 *
 * Real, full-document, jsdom-based end-to-end test for the T118, Step 6
 * item 10 fix for PENDING_DECISIONS.md #26: the "Special Conditions"
 * chip row (sqRenderQuote's tagsRow) rendered every active condition in
 * whatever order they happened to accumulate, with no distinction
 * between fee-bearing and purely informational conditions -- described
 * directly as unordered and cluttered relative to the "We understood"
 * summary above it.
 *
 * Fix: conditions are now sorted by real fee impact (traced from each
 * tag's own authored answers via the new sqTagFeeImpact, not the
 * mostly-retired effects.fee field), and zero-fee conditions collapse
 * into a single "+N more details" toggle instead of full-sized chips.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require(path.join(__dirname, 'node_modules', 'jsdom'));

const REPO_ROOT = path.dirname(__dirname);
const html = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
const btnycJson = fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8');
const DB = JSON.parse(btnycJson);

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  \u2713 ${label}`); }
    else { fail++; console.log(`  \u2717 ${label}`); }
}

const consoleErrors = [];
const windowErrors = [];
const dom = new JSDOM(html, {
    url: 'https://tommichael88.github.io/booktomnyc/qr.html',
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    beforeParse(window) {
        window.fetch = async (url) => {
            if (String(url).includes('btnyc.json')) return { ok: true, json: async () => DB };
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

    console.log('=== App initializes cleanly with the new code present ===');
    check('zero console.error calls during init', consoleErrors.length === 0);
    if (consoleErrors.length) consoleErrors.forEach(e => console.log('    console.error:', e));
    check('zero uncaught window errors during init', windowErrors.length === 0);
    check('sqTagFeeImpact is defined', typeof w.sqTagFeeImpact === 'function');
    check('sqToggleZeroFeeConditions is defined', typeof w.sqToggleZeroFeeConditions === 'function');

    console.log('\n=== sqTagFeeImpact: correct against real, known tags ===');
    check('#no_parking -> real $20 fee, traced from its own answers, not a guess (T118: replaces #access_obstructed as this test\'s example -- access and its own smart tag were removed catalog-wide)', w.sqTagFeeImpact('#no_parking') === 20);
    check('#bidet_attachment -> genuinely $0 (display-only, no answers)', w.sqTagFeeImpact('#bidet_attachment') === 0);
    check('an unknown tag id returns 0, not a crash', w.sqTagFeeImpact('#not_a_real_tag') === 0);

    console.log('\n=== Real end-to-end: a mix of fee-bearing and zero-fee conditions renders correctly ordered and collapsed ===');
    // Set up real state: one fee-bearing tag (#no_parking, $20) and
    // one zero-fee, display-only tag (#bidet_attachment) both active, on a
    // real plumbing service so both tags are legitimately applicable.
    const svc = DB.services.find(s => s.id === 'faucet_repair_drip');
    w.eval(`
        S.svc = ${JSON.stringify(svc)};
        S.intent = { key: 'faucet', category: 'plumbing_help', label: 'Faucet Repair' };
        S.stype = 'Repair';
        S.detTagIds = ['#no_parking', '#bidet_attachment'];
        S.manTagIds = [];
        S.negatedTagIds = [];
        S.answers = {};
        S.qty = 1;
    `);
    w.sqRenderQuote();
    await wait(50);

    const row = doc.getElementById('sqConditionsRow');
    check('the conditions row renders', !!row);
    const visibleChips = [...(row?.children || [])].filter(c => c.classList.contains('chip') && c.id !== 'sqZeroFeeToggle');
    check('exactly one fee-bearing chip shows by default (the zero-fee one is collapsed, not rendered as a full chip)',
        visibleChips.length === 1 && /parking/i.test(visibleChips[0].textContent));

    const toggle = doc.getElementById('sqZeroFeeToggle');
    check('a real "+1 more detail" collapse toggle renders for the one zero-fee condition', !!toggle && /\+1 more detail/i.test(toggle.textContent));

    const collapsedGroup = doc.getElementById('sqZeroFeeConditions');
    check('the collapsed group starts hidden', collapsedGroup?.style.display === 'none');

    console.log('\n=== Clicking the toggle actually reveals the collapsed condition ===');
    if (toggle) tap(toggle, w);
    await wait(30);
    check('the collapsed group is now visible after clicking', doc.getElementById('sqZeroFeeConditions')?.style.display !== 'none');
    check('the toggle itself hides once expanded (not a redundant, still-visible "+1 more" alongside the real content)',
        doc.getElementById('sqZeroFeeToggle')?.style.display === 'none');

    console.log(`\n[special conditions ordering, #26] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
    process.exit(fail > 0 ? 1 : 0);
})();
