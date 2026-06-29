#!/usr/bin/env node
/**
 * verify_ui_controller_modules.js
 *
 * Integration test for UIRenderer.js + AppController.js (Phase 1's third
 * and fourth modules) against pricing_engine.js + nlp_engine.js, loaded
 * together in a stubbed DOM/window/State/S context — the same setup used
 * manually during their extraction to find and fix four real bugs (a
 * dropped `async` keyword on init(), a missing _recomputeInstanceLabels
 * dependency the original purity audit had wrongly marked pure, an
 * undocumented third shared global DOM, and a missing parsePriceToInt).
 * This codifies that manual verification into a repeatable check.
 *
 * Unlike the pricing/NLP verification scripts, this one can't do byte-exact
 * output comparison against "real qr.html" (the whole point of this phase
 * is that these functions now live in standalone files) — instead it
 * exercises representative real user-flow scenarios end-to-end and asserts
 * on observable side effects (State mutations, no thrown errors), which is
 * what actually matters for code that's mostly DOM/state orchestration
 * rather than pure computation.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.dirname(__dirname);

function buildSandbox(dbPath) {
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const sandbox = {
        DB: db,
        S: { intent: {}, answers: {} },
        State: { serviceRequest: [], furnitureItems: [] },
        console,
        setTimeout, clearTimeout, setInterval, clearInterval,
    };
    sandbox.window = sandbox;
    sandbox.window.DB = db;
    sandbox.window.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    sandbox.localStorage = sandbox.window.localStorage;
    sandbox.document = {
        getElementById: () => null,
        createElement: () => ({
            style: {}, classList: { add() {}, remove() {}, contains() { return false; } },
            addEventListener() {}, appendChild() {}, setAttribute() {}, dataset: {},
        }),
        addEventListener: () => {},
        removeEventListener: () => {},
        querySelector: () => null,
        querySelectorAll: () => [],
        body: { appendChild() {}, classList: { add() {}, remove() {} } },
        documentElement: { style: {}, classList: { add() {}, remove() {} } },
    };
    vm.createContext(sandbox);
    for (const f of ['pricing_engine.js', 'nlp_engine.js', 'UIRenderer.js', 'AppController.js']) {
        vm.runInContext(fs.readFileSync(path.join(REPO_ROOT, f), 'utf8'), sandbox, { filename: f });
    }
    sandbox.initNlpSets();
    sandbox.cacheDOM();
    return sandbox;
}

let pass = 0, fail = 0;
function check(label, fn) {
    try {
        fn();
        pass++;
        console.log(`  ✓ ${label}`);
    } catch (e) {
        fail++;
        console.log(`  ✗ ${label}: ${e.message}`);
    }
}

const dbPath = process.argv[2] || path.join(REPO_ROOT, 'btnyc.json');
const sb = buildSandbox(dbPath);

check('all four modules load together with zero errors', () => {
    // If we got this far without throwing, this already passed — buildSandbox
    // would have thrown on load failure.
});

check('createServiceCardElement (UIRenderer) runs without throwing', () => {
    const svc = sb.DB.services.find(s => s.id === 'toilet_install');
    const card = sb.createServiceCardElement(svc, 'minor_home_repairs');
    if (typeof card !== 'object') throw new Error('expected an object (stubbed DOM element), got ' + typeof card);
});

check('renderCategoryCards (UIRenderer) runs without throwing', () => {
    sb.renderCategoryCards();
});

check('addToCart (AppController) adds a service and mutates State.serviceRequest', () => {
    sb.addToCart({ id: 'test1', name: 'Test Service', category_id: 'x', price: '$100', qty: 1 });
    if (sb.State.serviceRequest.length !== 1) throw new Error(`expected length 1, got ${sb.State.serviceRequest.length}`);
});

check('addToCart with differing notes assigns distinct instance labels (regression: v9.2 cart-dedup fix)', () => {
    sb.addToCart({ id: 'test2', name: 'Test Service', category_id: 'x', price: '$100', qty: 1, notes: 'different room' });
    const labels = sb.State.serviceRequest.map(s => s._instanceLabel);
    if (labels.join(',') !== '#1,#2') throw new Error(`expected ['#1','#2'], got ${JSON.stringify(labels)}`);
});

check('removeFurnitureEntry (AppController, the aliased-mutation function) mutates State in place', () => {
    sb.State.serviceRequest = [{ id: 'furn1', name: 'Assembly', furnitureItems: [{ minutes: 20, label: 'Table' }] }];
    sb.removeFurnitureEntry('furn1', 0);
    // furnitureItems.length === 0 + name includes 'assembly' -> removeServiceFromCart runs -> entry removed entirely
    if (sb.State.serviceRequest.length !== 0) throw new Error(`expected the entry to be removed, got ${JSON.stringify(sb.State.serviceRequest)}`);
});

check('resolveDynamicService (pricing_engine.js) is callable from within the UIRenderer/AppController context', () => {
    const d = sb.resolveDynamicService('minor_home_repairs', 'Repair');
    if (!d || !d.financial_engine) throw new Error('expected a real dynamic_service object');
});

check('detectIntentNLP (nlp_engine.js) is callable from within the UIRenderer/AppController context', () => {
    const result = sb.detectIntentNLP('fix my leaky faucet');
    if (typeof result !== 'object') throw new Error('expected an object result');
});

console.log(`\n[UIRenderer.js + AppController.js integration] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
