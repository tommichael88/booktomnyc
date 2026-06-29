#!/usr/bin/env node
/**
 * verify_phase6_self_quote_rewire.js
 *
 * Regression test for the FIRST real Phase 6/7 slice: prefillSmartQuoteFromService's
 * self-quote branch now genuinely runs through collectBookingContext_catalog
 * -> executeWorkflow -> renderSelfQuoteFromRoute, instead of the old
 * sqRenderSelfQuoteAdlib (which recomputed price inline, independently of
 * computeUnifiedQuote).
 *
 * Confirmed via direct hand-verification BEFORE this rewire that the old,
 * inline logic and the canonical computeUnifiedQuote produced IDENTICAL
 * numbers for all 3 real self-quote services (all flat_rate, no
 * tags/answers affecting price) -- this was a genuinely low-risk swap,
 * not a reconciliation of a real discrepancy. This test locks in that
 * the swap is real and the numbers stay correct.
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

console.log('=== prefillSmartQuoteFromService genuinely calls the real orchestrator for the self-quote branch ===');
check('the live code calls collectBookingContext_catalog in the self-quote branch', /const _selfQuoteCtx = collectBookingContext_catalog\(svc, category_id\);/.test(QR_HTML));
check('the live code calls executeWorkflow with the real context', /const _selfQuoteRoute = executeWorkflow\(_selfQuoteCtx, DB\);/.test(QR_HTML));
check('the live code renders from the real ResolvedRoute via renderSelfQuoteFromRoute', /renderSelfQuoteFromRoute\(_selfQuoteRoute, svc\);/.test(QR_HTML));
check('the curated-card branch is deliberately untouched (sqBuildCuratedIntake still called for that path)', /sqBuildCuratedIntake\(svc\); \/\/ <- confidence accumulation lives here/.test(QR_HTML));

console.log('\n=== The real, live ResolvedRoute correctly resolves all 3 real self-quote services ===');
const FNS = ['resolveDynamicService', 'resolveBaseConfidenceStrategy', 'resolveForceModules',
    'applyLiveConfidenceEscalation', 'deriveComplexityTier', 'applyPricingFormula',
    'resolveCheckoutState', 'sqTagLabel', 'tagValidForCategory', 'resolveEngineKey',
    'resolveServiceBadge', 'computeUnifiedQuote', '_resolveIntakeChain', '_isModVisible',
    'resolveGroupFromIntent', 'collectBookingContext_catalog', 'makeBookingContext',
    'orch_resolve_entity', 'orch_apply_object_based_resolution', 'orch_enrich_from_dynamic_service',
    'orch_compute_variability_flags', 'orch_compose_intake_chain', 'orch_apply_location_hints',
    'orch_compute_confidence', 'orch_select_ui_template', 'orch_merge_materials_estimate',
    'orch_compute_quote', 'orch_apply_intake_bypass_rules', 'readRoutePath', 'evaluateInvariant',
    'describeInvariantFailure', 'checkRoutingArchetypeConsistency', 'validateRoute', 'catastrophicFallbackRoute', 'executeWorkflow'];
let code = "const ORCH_QTY_MODS = new Set(['item_count', 'count', 'hybrid_qty', 'global_quantity']);\nconst KNOWN_UI_TEMPLATES = new Set(['self_quote', 'curated_card', 'chip_grid', 'legacy_flow']);\n";
code += FNS.map(findFn).join('\n\n');
const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'phase6_self_quote' });

const EXPECTED = {
    cabinet_knob_or_pull_install: 30,
    door_lock_or_handle_install: 50,
    led_bulb_upgrade: 20,
};
for (const [sid, expectedLabor] of Object.entries(EXPECTED)) {
    const svc = DB.services.find(s => s.id === sid);
    const ctx = sandbox.collectBookingContext_catalog(svc, svc.ui_taxonomy.category_id);
    const route = sandbox.executeWorkflow(ctx, DB);
    check(`${sid} -> uiTemplate: self_quote`, route.uiTemplate === 'self_quote');
    check(`${sid} -> laborEstimate: $${expectedLabor} (matches the old, inline-computed value exactly)`, route.quote?.laborEstimate === expectedLabor);
    check(`${sid} -> dispatchFee: $45`, route.quote?.dispatchFee === 45);
}

console.log('\n=== renderSelfQuoteFromRoute is a real, new function sourcing price from the route, not recomputing it ===');
const renderFn = findFn('renderSelfQuoteFromRoute');
check('renderSelfQuoteFromRoute exists', !!renderFn);
check('it reads perItemLabor from route.quote.laborEstimate, not from an inline recomputation', renderFn.includes('const perItemLabor = quote.laborEstimate'));
check('it reads dispatch from route.quote.dispatchFee', renderFn.includes('const dispatch = quote.dispatchFee'));
check('it does NOT contain the old inline pricing-engine lookup logic (resolveEngineKey/formula_components) -- confirming this is a genuine swap, not a duplicate calculation kept alongside the new one', !renderFn.includes('resolveEngineKey'));

console.log(`\n[Phase 6/7 self-quote rewire verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
