#!/usr/bin/env node
/**
 * verify_dynamic_service_qty_gate.js
 *
 * Real, full-document, jsdom-based end-to-end test for the T118, Step 6
 * item 6 fix for PENDING_DECISIONS.md #21: catalog navigation directly
 * into a dynamic-service-only group (no real named services, no real
 * component/symptom mapping -- e.g. Ceiling Tile Replacement) fell
 * through to sqOpenBuilderPreseeded with BLD.qty hardcoded to 1 and no
 * step anywhere that ever let the customer change it, then showed a
 * real, correctly-computed price with zero questions asked at all.
 *
 * Fix: a new 'qty' step in BLD_STEPS, included by sqBuilderGetSteps()
 * specifically when BLD._fromOtherTile is true (the marker for a
 * catalog-navigation-seeded session) -- not for free-text sessions,
 * which already attempt real extraction via extractQty(existingText)
 * at open time, so asking again there would be redundant friction, not
 * a gap.
 *
 * Also verifies the group's own rename ("Ceilings" -> "Ceiling Tile
 * Replacement") landed consistently in both the source group data and
 * its compiler-derived routing_archetypes copy.
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
function chip(doc, re) {
    return [...doc.querySelectorAll('#sqBuilderChips .sq-b-chip')].find(c => re.test(c.textContent));
}

(async () => {
    const w = await wait(3000).then(() => dom.window);
    const doc = w.document;

    console.log('=== App initializes cleanly with the new qty-step code present ===');
    check('zero console.error calls during init', consoleErrors.length === 0);
    if (consoleErrors.length) consoleErrors.forEach(e => console.log('    console.error:', e));
    check('zero uncaught window errors during init', windowErrors.length === 0);
    check('sqBuilderGetSteps is defined', typeof w.sqBuilderGetSteps === 'function');
    check('sqOpenBuilderPreseeded is defined', typeof w.sqOpenBuilderPreseeded === 'function');

    console.log('\n=== The group rename landed consistently ===');
    const ceilGroup = w.DB.group.find(g => g.id === 'minor_home_repairs_ceilings');
    check('source group data renamed to "Ceiling Tile Replacement"', ceilGroup?.display_name === 'Ceiling Tile Replacement');
    check('the compiler-derived routing_archetypes copy was also updated, not left stale',
        w.DB.routing_archetypes?.minor_home_repairs_ceilings?.display_name === 'Ceiling Tile Replacement');

    console.log('\n=== The real, diagnosed navigation path: tapping into the group reaches the builder with _fromOtherTile set ===');
    w.resolveComponentSymptomTap([], ceilGroup, 'minor_home_repairs', 'Repair');
    await wait(50);
    // BLD/S are `let`-declared at script scope, not window properties (confirmed
    // directly: w.BLD is undefined even though the state genuinely exists) --
    // window.eval runs in that same script scope, so it's the real, reliable way
    // to inspect them, not a workaround masking a problem.
    check('BLD._fromOtherTile is true (the real marker this fix gates on)', w.eval('BLD._fromOtherTile') === true);
    check('BLD.qty starts unanswered (null) until the customer answers the new step -- not the literal 1 first attempted, which the existing skip-forward logic silently treated as "already answered"',
        w.eval('BLD.qty') === null);

    const steps = w.sqBuilderGetSteps();
    check('sqBuilderGetSteps() now includes "qty" for this catalog-navigation session (the actual fix)', steps.includes('qty'));

    console.log('\n=== Stepping through the builder to the new qty step and selecting a real quantity ===');
    // Walk forward through whatever steps precede qty (action is pre-filled
    // via chosenAction in this real entry path but still needs a tap to
    // advance in this simulated flow; object/specific are already seeded
    // from groupId and get auto-skipped by sqBuilderRender's own
    // empty-choices skip logic -- confirmed by not manually skipping them
    // here and letting the real render loop handle it).
    let guard = 0;
    while (w.sqBuilderCurrentStep()?.id !== 'qty' && guard < 10) {
        const stepDef = w.sqBuilderCurrentStep();
        if (!stepDef) break;
        const anyChip = doc.querySelector('#sqBuilderChips .sq-b-chip');
        if (anyChip) tap(anyChip, w);
        await wait(20);
        guard++;
    }
    check('the builder genuinely reaches the new qty step (not stuck or skipped past it)', w.sqBuilderCurrentStep()?.id === 'qty');
    check('the qty step prompt reads "How many?"', doc.getElementById('sqBuilderPrompt')?.textContent.includes('How many?'));

    const fiveChip = chip(doc, /5 or more/i);
    check('a real "5 or more" chip is rendered', !!fiveChip);
    if (fiveChip) tap(fiveChip, w);
    await wait(50);
    check('BLD.qty is now 5, genuinely changed from the old stuck-at-1 default', w.eval('typeof BLD !== "undefined" ? BLD.qty : null') === 5 || w.eval('typeof S !== "undefined" ? S.qty : null') === 5);

    console.log('\n=== The selected quantity actually reaches the final quote, not just BLD state ===');
    // sqBuilderChoose auto-advances past the finished sequence into
    // sqBuilderFinish() once qty was the last step -- confirmed by reading
    // sqBuilderFinish directly rather than assumed: S.qty = BLD.qty when
    // the resolved entity has no qty question of its own. By this point BLD
    // itself may have been reset/reassigned by a subsequent flow, so S.qty
    // (set once, at the moment of finishing) is the reliable, real signal.
    await wait(50);
    check('S.qty reflects the real, customer-selected quantity (5), not the old hardcoded 1',
        w.eval('S.qty') === 5);

    console.log(`\n[dynamic-service qty gate, #21] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
    process.exit(fail > 0 ? 1 : 0);
})();
