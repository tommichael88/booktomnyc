#!/usr/bin/env node
/**
 * verify_shadow_mode_phase5.js
 *
 * Regression test for Master Blueprint Phase 5: Shadow Mode.
 *
 * Single hook point: computeQuoteFromState (the one real function every
 * legacy entry path calls right before rendering a quote). Confirms,
 * with direct, deliberate proof rather than just inspecting the code:
 *
 *   1. The legacy quote object is byte-identical before and after the
 *      shadow call — shadow mode never mutates what the real user sees.
 *   2. A deliberately-broken orchestrator's error is caught and logged,
 *      never escapes into the caller (i.e. the real, live website never
 *      crashes because of a shadow-mode bug).
 *   3. A real, matching scenario produces zero diffs (the legacy and
 *      orchestrator paths currently agree).
 *   4. The historical, now-fixed dispatch-fee bug specifically does NOT
 *      reappear as a diff for a real service.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

function findFn(name) {
    const m = QR_HTML.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) return null;
    let depth = 0, start = m.index, i = m.index + m[0].length - 1;
    for (let j = i; j < QR_HTML.length; j++) {
        if (QR_HTML[j] === '{') depth++;
        else if (QR_HTML[j] === '}') { depth--; if (depth === 0) return QR_HTML.slice(start, j + 1); }
    }
    return null;
}

console.log('=== Safety contract, part 1: a broken orchestrator never escapes into the caller ===');
{
    const sandbox = {
        DB, SERVICE_DATA: DB, window: { DB },
        S: { _svc: null, intent: { category: 'plumbing_help', key: 'toilet' }, desc: 'test', qty: 1, manTagIds: [], detTagIds: [], inherentTagIds: [], negatedTagIds: [], answers: {}, stype: 'Repair' },
        console,
        makeBookingContext: (entry, overrides) => Object.assign({ entry }, overrides),
        executeWorkflow: () => { throw new Error('Deliberately broken orchestrator for this test'); },
    };
    sandbox.global = sandbox;
    vm.createContext(sandbox);
    const shadowDiffQuoteSrc = findFn('shadowDiffQuote');
    vm.runInContext(
        'window.__BTNYC_SHADOW_DIFFS__ = [];\nfunction shadowReconstructContext(){ return makeBookingContext("catalog", {}); }\n' + shadowDiffQuoteSrc,
        sandbox, { filename: 'shadow_safety_1' }
    );
    const fakeU = { laborEstimate: 100, dispatchFee: 45 };
    let threw = false;
    try { sandbox.shadowDiffQuote(fakeU); } catch (e) { threw = true; }
    check('shadowDiffQuote does not throw even when executeWorkflow is broken', !threw);
    check('the legacy quote object is byte-identical after the shadow call (no mutation)', JSON.stringify(fakeU) === '{"laborEstimate":100,"dispatchFee":45}');
    check('the broken orchestrator error is captured as its own diagnostic entry', sandbox.window.__BTNYC_SHADOW_DIFFS__.some(d => d.entry === 'shadow_mode_error' && d.error.includes('Deliberately broken')));
}

console.log('\n=== Safety contract, part 2: real end-to-end run against the genuine orchestrator ===');
{
    const FNS = ['resolveDynamicService', 'resolveBaseConfidenceStrategy', 'resolveForceModules',
        'applyLiveConfidenceEscalation', 'deriveComplexityTier', 'applyPricingFormula',
        'resolveCheckoutState', 'sqTagLabel', 'tagValidForCategory', 'resolveEngineKey',
        'resolveServiceBadge', 'computeUnifiedQuote', '_resolveIntakeChain', '_isModVisible',
        'resolveGroupFromIntent', 'makeBookingContext', 'orch_resolve_entity', 'orch_apply_object_based_resolution', 'orch_enrich_from_dynamic_service',
        'orch_compute_variability_flags', 'orch_compose_intake_chain', 'orch_apply_location_hints',
        'orch_compute_confidence', 'orch_select_ui_template', 'orch_merge_materials_estimate',
        'orch_compute_quote', 'orch_apply_intake_bypass_rules', 'readRoutePath', 'evaluateInvariant', 'describeInvariantFailure', 'checkRoutingArchetypeConsistency', 'validateRoute',
        'catastrophicFallbackRoute', 'executeWorkflow', 'simpleContentHash', 'dumpTrace', 'shadowReconstructContext', 'shadowDiffQuote', 'legacyDetermineSelfQuoting'];
    let code = "const ORCH_QTY_MODS = new Set(['item_count', 'count', 'hybrid_qty', 'global_quantity']);\n";
    code += "const KNOWN_UI_TEMPLATES = new Set(['self_quote', 'curated_card', 'chip_grid', 'legacy_flow']);\n";
    code += FNS.map(findFn).join('\n\n');
    const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
    sandbox.global = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: 'shadow_real' });

    sandbox.S = {
        _svc: DB.services.find(s => s.id === 'toilet_install'),
        intent: { category: 'plumbing_help', key: null },
        desc: null, qty: 1, manTagIds: [], detTagIds: [], inherentTagIds: [], negatedTagIds: [],
        answers: {}, stype: 'Repair',
    };
    sandbox.window.__BTNYC_SHADOW_DIFFS__ = [];
    const realU = sandbox.computeUnifiedQuote({ svc: sandbox.S._svc, activeTagIds: [], answers: {}, qty: 1 });
    sandbox.shadowDiffQuote(realU);
    check('a real, matching scenario (toilet_install) produces ZERO diffs', sandbox.window.__BTNYC_SHADOW_DIFFS__.length === 0);
    check('the historical $45 dispatch-fee gap bug does not reappear', !sandbox.window.__BTNYC_SHADOW_DIFFS__.some(d => (d.diffs || []).some(x => x.includes('dispatchFee'))));

    console.log('\n=== Extended diff fields: checkoutStateKey/complexityTier are genuinely checked, and dumpTrace fires correctly on a real diff ===');
    sandbox.window.__BTNYC_SHADOW_DIFFS__ = [];
    const tamperedU = Object.assign({}, realU, { checkoutStateKey: 'totally_wrong_state', complexityTier: 'totally_wrong_tier' });
    sandbox.shadowDiffQuote(tamperedU);
    const diffEntries = sandbox.window.__BTNYC_SHADOW_DIFFS__;
    check('a deliberately mismatched checkoutStateKey is correctly caught', diffEntries.some(d => (d.diffs || []).some(x => x.includes('checkoutStateKey'))));
    check('a deliberately mismatched complexityTier is correctly caught', diffEntries.some(d => (d.diffs || []).some(x => x.includes('complexityTier'))));
    check('the stored legacyQuote snapshot includes the new fields', diffEntries.some(d => d.legacyQuote && 'checkoutStateKey' in d.legacyQuote && 'complexityTier' in d.legacyQuote));
    check('dumpTrace genuinely fires and produces a real, self-contained replay object (confirmed: this path was never exercised by the original test)',
        diffEntries.some(d => d.historianDump && d.historianDump.bookingContext && d.historianDump.workflowHash && d.historianDump.resolvedRoute));
}

console.log('\n=== Wiring: the real, live computeQuoteFromState calls shadowDiffQuote, without altering its own return value ===');
check('computeQuoteFromState calls shadowDiffQuote(u) right after computing the real quote', /shadowDiffQuote\(u\);/.test(QR_HTML));
check('the shadow call happens BEFORE any other line reads/derives from u (placed immediately after computeUnifiedQuote)',
    (() => {
        const fnBody = findFn('computeQuoteFromState');
        const uAssignIdx = fnBody.indexOf('const u = computeUnifiedQuote(');
        const shadowCallIdx = fnBody.indexOf('shadowDiffQuote(u)');
        const csAssignIdx = fnBody.indexOf('resolveCheckoutState(u.checkoutStateKey');
        return uAssignIdx > -1 && shadowCallIdx > uAssignIdx && shadowCallIdx < csAssignIdx;
    })());
check('window.__BTNYC_SHADOW_DIFFS__ is initialized (Phase 7 observability groundwork)', /window\.__BTNYC_SHADOW_DIFFS__ = window\.__BTNYC_SHADOW_DIFFS__ \|\| \[\];/.test(QR_HTML));

console.log(`\n[Phase 5 Shadow Mode verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
