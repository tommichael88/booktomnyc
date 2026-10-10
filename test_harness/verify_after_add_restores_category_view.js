#!/usr/bin/env node
/**
 * verify_after_add_restores_category_view.js
 *
 * Regression test for a real, screenshot-reported bug: after adding an item
 * to cart through any of the four legacy_flow paths (_renderDiagnosticFlow,
 * _renderOtherFlow, _renderSimpleConfirm, _renderStructuredIntake — all four
 * funnel through the single _afterAdd(container) function), category tiles
 * were not visible.
 *
 * Root cause was two real, independent, stacked bugs, confirmed by direct
 * source inspection before writing this test (not assumed):
 *
 *   1. _afterAdd only ever called exitFocusedMode(), whose own comment
 *      explicitly disclaims responsibility for this: "serviceRequestSummary
 *      visibility is managed by cart state -- handled by
 *      restoreCategoryView". DOM.categoriesGrid was never set back to
 *      display:grid anywhere in this path -- the tiles weren't scrolled out
 *      of view, they were never shown in the DOM again at all.
 *
 *   2. Independently: #category-card sits ABOVE #serviceRequestSummary in
 *      the real page order (line 756 vs 785). Even with bug 1 fixed,
 *      scrolling straight to the summary with block:'start' would always
 *      push the tiles above the viewport.
 *
 * Fixed by having _afterAdd call the same, real, already-correct
 * restoreCategoryView() (the established "return to home" function used
 * elsewhere) instead of a second, incomplete, hand-rolled version of it,
 * and by scrolling to categoriesGrid instead of serviceRequestSummary.
 *
 * Uses a full JSDOM document load (not function-level extraction), because
 * this bug is fundamentally about real DOM state (style.display on real
 * elements after a real function runs), which extraction can't exercise.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require(path.join(__dirname, 'node_modules', 'jsdom'));

const REPO_ROOT = path.dirname(__dirname);
let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

const html = require('./_page.js').readPage(path.join(REPO_ROOT, 'qr.html'));
const btnycJson = fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8');

const scrollTargets = [];
const dom = new JSDOM(html, {
    url: 'https://tommichael88.github.io/booktomnyc/qr.html',
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    beforeParse(window) {
        window.fetch = async (url) => String(url).includes('btnyc.json')
            ? { ok: true, json: async () => JSON.parse(btnycJson) } : { ok: false, status: 404 };
        // Record what scrollIntoView is actually called ON, rather than a
        // bare no-op stub -- this bug is specifically about the WRONG
        // element being the scroll target, so that's worth capturing.
        window.HTMLElement.prototype.scrollIntoView = function () { scrollTargets.push(this.id || this.className); };
    }
});

function run() { return new Promise((resolve) => setTimeout(() => resolve(dom.window), 3000)); }

(async () => {
    const w = await run();
    const doc = w.document;
    const categoriesGrid = doc.getElementById('category-card');
    const serviceRequestSummary = doc.getElementById('serviceRequestSummary');

    console.log('=== Before _afterAdd: categoriesGrid starts hidden (matching a real focused-mode intake in progress) ===');
    categoriesGrid.style.display = 'none';
    check('categoriesGrid genuinely starts hidden for this test (sanity check on the test setup itself)', categoriesGrid.style.display === 'none');

    console.log('\n=== _afterAdd correctly restores category tile visibility (the real, reported bug) ===');
    const fakeContainer = doc.createElement('div');
    fakeContainer.style.display = 'block';
    scrollTargets.length = 0;
    w._afterAdd(fakeContainer);

    check('categoriesGrid.style.display is "grid" after _afterAdd (the core, structural fix)', categoriesGrid.style.display === 'grid');
    check('the passed-in container is still correctly hidden (no regression on existing behavior)', fakeContainer.style.display === 'none');
    check('scrollIntoView was called on categoriesGrid, not serviceRequestSummary (the second, independent fix)',
        scrollTargets.includes('category-card'));
    check('scrollIntoView was NOT called on serviceRequestSummary (confirms the scroll target genuinely changed, not just added to)',
        !scrollTargets.includes('serviceRequestSummary'));

    console.log('\n=== Real, complete flow: showIntakeQuestions -> a structured-intake service -> add -> tiles visible ===');
    {
        // A real service that routes through _renderStructuredIntake (has a
        // real intake_chain, not requires_furniture_selection, not
        // requiresSiteVisit, not isOther) -- exercises the actual reported
        // path end-to-end, not just _afterAdd in isolation.
        const svc = w.DB.services.find(s => s.id === 'gfci_outlet_replacement');
        check('sanity: gfci_outlet_replacement is a real service with a real intake_chain', !!svc && Array.isArray(svc.intake_chain) && svc.intake_chain.length > 0);
        categoriesGrid.style.display = 'none';
        w.showIntakeQuestions(svc, svc.ui_taxonomy.category_id);
        const intakeContainer = doc.getElementById('intakeQuestionsContainer');
        check('the real intake container is genuinely visible mid-flow (sanity check before add)', intakeContainer.style.display !== 'none');
        w._afterAdd(intakeContainer);
        check('after a real add-to-request flow, categoriesGrid is visible again', categoriesGrid.style.display === 'grid');
        check('after a real add-to-request flow, the real intake container is hidden again', intakeContainer.style.display === 'none');
    }

    console.log(`\n[_afterAdd category-view restoration] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
    process.exit(fail > 0 ? 1 : 0);
})();
