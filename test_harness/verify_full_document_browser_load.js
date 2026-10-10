#!/usr/bin/env node
/**
 * verify_full_document_browser_load.js
 *
 * Regression test for a severe, real, production incident: the entire app
 * failed to initialize ("TypeError: store.dispatch is not a function" on
 * every single page load), which cascaded into "renderRoute is not defined"
 * and "S is not defined" everywhere else. Root cause: the browser branch of
 * store.js's UMD wrapper returned factory()'s WHOLE result ({createStore,
 * store}) instead of a real store -- window.createStore() never had a real
 * .dispatch. The CommonJS/Node branch (used by every existing test in this
 * harness) was ALWAYS correct, which is exactly why 64/64 suites passed
 * while the real, deployed page was completely broken. Every test in this
 * harness up to this point extracts and evals INDIVIDUAL functions or
 * blocks in isolation -- none of them ever loaded the actual, complete
 * qr.html file the way a real browser does (all 10 script blocks, in
 * document order, sharing one global scope, with real hoisting/TDZ/
 * execution-order semantics). This test closes that real, structural gap
 * in the test harness itself, not just the one bug that exposed it.
 *
 * Found and fixed alongside the store bug, using this same full-document
 * load technique to investigate:
 *   - QTY_MODS referenced in prefillSmartQuoteFromService but only ever
 *     declared in a different, unrelated function's scope (crashed sqAnalyze
 *     for every catalog-tapped multi-step service)
 *   - 'remaining' used in a price-prefix calculation before the const that
 *     computes it (temporal dead zone crash, same class of bug)
 *   - renderFurnitureSelection / renderPaxConfigurator / stDefaultAction /
 *     sqBuilderGetSteps / sqBuilderCurrentStep / bldGroupToKeyword / 
 *     renderIcon / BLD_ACTION_MAP / BLD_LOCATIONS / BLD_STEPS -- an entire
 *     subsystem (the guided builder + furniture selection) completely
 *     missing from the live file despite being called from real, reachable
 *     code paths -- recovered from an intact reference copy, not rewritten
 *     from scratch
 *   - DB.service_types read without the SSOT-standard DB?. optional chain
 *     inside a top-level const array (BLD_ACTION_MAP) that evaluates
 *     synchronously at script-parse time, while DB itself is still null
 *     (only populated later, asynchronously, inside init()) -- this was
 *     the actual root cause of a real, observed TDZ crash on BLD_STEPS:
 *     the earlier, uncaught error aborted the rest of that script block's
 *     execution before BLD_STEPS's own declaration was ever reached
 *   - loadGroupView referenced but never defined anywhere (dead code path
 *     via the step-dot back-navigation), fixed by redirecting to the real,
 *     existing showGroupsForCategory
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require(path.join(__dirname, 'node_modules', 'jsdom'));

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML_PATH = path.join(REPO_ROOT, 'qr.html');
const BTNYC_JSON_PATH = path.join(REPO_ROOT, 'btnyc.json');

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

const html = require('./_page.js').readPage(QR_HTML_PATH);
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
        // jsdom does not implement scrollIntoView (no real layout engine) --
        // real browsers do. No-op polyfill so real code isn't penalized for
        // calling a real, standard DOM API jsdom just doesn't have.
        window.HTMLElement.prototype.scrollIntoView = function () {};
        window.console.error = (...args) => consoleErrors.push(args.join(' '));
        window.addEventListener('error', (e) => windowErrors.push(e.message));
    },
});

function run() {
    return new Promise((resolve) => setTimeout(() => resolve(dom.window), 3000));
}

(async () => {
    const w = await run();
    const doc = w.document;

    console.log('=== The real app initializes cleanly on a genuine, full-document load ===');
    check('zero console.error calls during init', consoleErrors.length === 0);
    if (consoleErrors.length) consoleErrors.forEach(e => console.log('    console.error:', e));
    check('zero uncaught window errors during init', windowErrors.length === 0);
    // v9.6+ FIX: was checking === 70. Catalog has grown to 74 real services
    // since this was written (confirmed elsewhere in this same file, which
    // already correctly used w.DB.services.length dynamically further down
    // -- this one literal check was simply missed at the time).
    // T152: the expected count is READ from the SSOT, not typed here. This line was edited 70 -> 74 -> (now 76) as the catalog grew, which is the drift a hardcoded number guarantees.
    const _ssotServices = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'btnyc.json'), 'utf8')).services.length;
    check(`DB loaded with the real, complete catalog (${_ssotServices} services, read from btnyc.json)`, _ssotServices > 0 && w.DB?.services?.length === _ssotServices);
    check('window.__store exists and has a real, working .dispatch', typeof w.__store?.dispatch === 'function');
    check('renderRoute is defined (was undefined -- the exact reported crash)', typeof w.renderRoute === 'function');
    check('S (global booking state) is defined (was undefined -- the exact reported crash)', typeof w.S === 'object' && w.S !== null);

    console.log('\n=== Every real category -> group -> subgroup navigates without throwing ===');
    {
        let errors = 0, total = 0;
        for (const cat of w.DB.category) {
            total++;
            try {
                w.showGroupsForCategory(cat.id);
                for (const g of w.DB.group.filter(gr => gr.category_id === cat.id)) {
                    total++;
                    try { w.showSubGroups(g, cat.id); } catch (e) { errors++; }
                }
            } catch (e) { errors++; }
        }
        check(`zero real navigation errors across ${total} real category/group combinations (found ${errors})`, errors === 0);
    }

    console.log('\n=== Every real service resolves through prefillSmartQuoteFromService without throwing ===');
    {
        let errors = 0;
        for (const svc of w.DB.services) {
            try {
                w.sqRestart();
                w.prefillSmartQuoteFromService(svc, svc.ui_taxonomy?.category_id || 'minor_home_repairs');
            } catch (e) { errors++; console.log(`    CRASH on ${svc.id}: ${e.message}`); }
        }
        check(`zero real errors across all ${w.DB.services.length} real services (found ${errors})`, errors === 0);
    }

    console.log('\n=== Realistic free-text queries resolve through sqAnalyze without throwing ===');
    {
        const queries = [
            'mount a large neon sign in my bedroom',
            'my dryer is not heating',
            'install 5 gfci outlets',
            'hang a heavy tv on a brick wall',
            'assemble a new bookshelf',
        ];
        let errors = 0;
        for (const qStr of queries) {
            try {
                w.sqRestart();
                doc.getElementById('sqDescIn').value = qStr;
                w.sqAnalyze();
            } catch (e) { errors++; console.log(`    CRASH on "${qStr}": ${e.message}`); }
        }
        check(`zero real errors across ${queries.length} realistic free-text queries (found ${errors})`, errors === 0);
    }

    console.log(`\n[full-document browser load verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
    process.exit(fail > 0 ? 1 : 0);
})();
