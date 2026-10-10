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
const QR_HTML = require('./_page.js').readPage(path.join(REPO_ROOT, 'qr.html'));
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
const FNS = ['resolveDynamicService', 'resolveBaseConfidenceStrategy', 'resolveServiceCheckoutStateKey', 
    'applyLiveConfidenceEscalation', 'deriveComplexityTier', 'applyPricingFormula',
    'buildCheckoutStateModel', 'sqTagLabel', 'tagValidForCategory', 'resolveEngineKey',
    'resolveServiceBadge', 'computeUnifiedQuote', 'computeArchetypeQuote', 'mathFurnitureAssembly',
    '_resolveIntakeChain', '_isModVisible',
    'resolveGroupFromIntent', 'collectBookingContext_catalog', 'makeBookingContext',
    'orch_resolve_entity', 'orch_apply_object_based_resolution', 'orch_enrich_from_dynamic_service',
    'orch_compute_variability_flags', 'orch_compose_intake_chain', 'orch_apply_location_hints',
    'orch_compute_confidence', 'orch_select_ui_template', 'orch_merge_materials_estimate',
    'orch_compute_quote', 'orch_apply_intake_bypass_rules', 'readRoutePath', 'evaluateInvariant',
    'describeInvariantFailure', 'checkRoutingArchetypeConsistency', 'validateRoute', 'catastrophicFallbackRoute', 'executeWorkflow', 'orch_max_followup_questions'];
let code = "const ORCH_QTY_MODS = new Set(['item_count', 'count', 'hybrid_qty', 'global_quantity']);\nconst KNOWN_UI_TEMPLATES = new Set(['self_quote', 'curated_card', 'chip_grid', 'legacy_flow']);\n";
code += FNS.map(findFn).join('\n\n');

code += "const COMPONENT_MODULE_NAMES = new Set(['wall_type','surface_type','door_type','door_style_pref','door_size','client_supplying_door','existing_frame','faucet_type','sink_type','toilet_style_pref','existing_toilet_type','window_type','removal','install_type','existing_type','furn_item','mounting_item','wall_mount_items','item_type','fixture_type','electrical_item','plumbing_fixture','tech_device','computer_component','device_type','laptop_or_desktop','existing_box','ducting','length','distance','weight','mounting_height','tile_condition','waterproof_area','has_matching_tiles','thermostat_type','customer_supplied_part','software_install_type','brand','router_owned','mesh_network','pax_cabinet_count','pax_hinge_count','pax_interior_count','pax_sliding_count']);\n";
code += "const SYMPTOM_MODULE_NAMES = new Set(['symptom','toilet_symptom','tech_problem_type','leak_type','drain_speed','issue','damage_type','device_state','internet_active','tech_issue_source']);\n";

const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'phase6_self_quote' });

// Services that correctly remain self_quote: qty-only chains, flat-rate, no real pricing questions
// T119: door_lock_or_handle_install removed -- wired with a real question
// (hardware_type, per PENDING_DECISIONS.md #35's own resolution) and
// correctly no longer self-quotes. angle_stop_replacement is now the
// one remaining service with this exact shape.
const EXPECTED_SELF_QUOTE = {
    angle_stop_replacement: 60,
    led_bulb_upgrade: 20,
};
for (const [sid, expectedLabor] of Object.entries(EXPECTED_SELF_QUOTE)) {
    const svc = DB.services.find(s => s.id === sid);
    const ctx = sandbox.collectBookingContext_catalog(svc, svc.ui_taxonomy.category_id);
    const route = sandbox.executeWorkflow(ctx, DB);
    check(`${sid} -> uiTemplate: self_quote`, route.uiTemplate === 'self_quote');
    check(`${sid} -> laborEstimate: $${expectedLabor}`, route.quote?.laborEstimate === expectedLabor);
    check(`${sid} -> dispatchFee: $45`, route.quote?.dispatchFee === 45);
}

// cabinet_knob_or_pull_install now correctly routes to curated_card:
// pricing_archetype:tiered_per_unit was authored and the real install_type
// question was added. The old $30 self_quote was correct before that data
// existed; $140 curated_card is correct now. This is a deliberate v9.5 change.
const knobSvc = DB.services.find(s => s.id === 'cabinet_knob_or_pull_install');
const knobCtx = sandbox.collectBookingContext_catalog(knobSvc, knobSvc.ui_taxonomy.category_id);
const knobRoute = sandbox.executeWorkflow(knobCtx, DB);
check('cabinet_knob_or_pull_install -> curated_card (has real install_type question + tiered_per_unit archetype)', knobRoute.uiTemplate === 'curated_card');
check('cabinet_knob_or_pull_install -> laborEstimate: $140 (tiered flat rate, swap tier)', knobRoute.quote?.laborEstimate === 140);

console.log('\n=== renderSelfQuoteFromRoute is a real, new function sourcing price from the route, not recomputing it ===');
const renderFn = findFn('renderSelfQuoteFromRoute');
check('renderSelfQuoteFromRoute exists', !!renderFn);
check('it reads perItemLabor from route.quote.laborEstimate, not from an inline recomputation', renderFn.includes('const perItemLabor = quote.laborEstimate'));
check('it reads dispatch from route.quote.dispatchFee', renderFn.includes('const dispatch = quote.dispatchFee'));
check('it does NOT contain the old inline pricing-engine lookup logic (resolveEngineKey/formula_components) -- confirming this is a genuine swap, not a duplicate calculation kept alongside the new one', !renderFn.includes('resolveEngineKey'));

console.log(`\n[Phase 6/7 self-quote rewire verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
