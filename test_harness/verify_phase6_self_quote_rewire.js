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

function _cherryPickFn(name) {
    const m = QR_HTML.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) return null;
    let depth = 0, start = m.index, i = m.index + m[0].length - 1;
    for (let j = i; j < QR_HTML.length; j++) {
        if (QR_HTML[j] === '{') depth++;
        else if (QR_HTML[j] === '}') { depth--; if (depth === 0) return QR_HTML.slice(start, j + 1); }
    }
    return null;
}
// T190 (#138 I3): the engine modules are loaded whole (T136, test_harness/_engine.js) so a helper added next to a cherry-picked function can never go missing from this sandbox;
// a function the modules do not declare still goes through this test's own extractor.
const { engineAwareFindFn } = require('./_engine.js');
const findFn = engineAwareFindFn(_cherryPickFn);

console.log('=== prefillSmartQuoteFromService genuinely calls the real orchestrator for the self-quote branch ===');
// T190 (#138 I3): the call also carries the tapped answers now (`tapped`, the card tap that brought the customer here); the branch is otherwise as pinned.
check('the live code calls collectBookingContext_catalog in the self-quote branch', /const _selfQuoteCtx = collectBookingContext_catalog\(svc, category_id(?:, tapped)?\);/.test(QR_HTML));
check('the live code calls executeWorkflow with the real context', /const _selfQuoteRoute = executeWorkflow\(_selfQuoteCtx, DB\);/.test(QR_HTML));
check('the live code renders from the real ResolvedRoute via renderSelfQuoteFromRoute', /renderSelfQuoteFromRoute\(_selfQuoteRoute, svc\);/.test(QR_HTML));
// T190 (#138 I3): this pinned the legacy curated-intake builder as "deliberately untouched". The builder is retired: the curated branch runs through the same orchestrator (74/74 parity sweep), so the
// pin now reads that the branch reaches the orchestrator route and the builder is gone.
check('the curated-card branch runs through the same orchestrator (executeWorkflow -> sqRenderCuratedCard), and the legacy builder is retired',
    /const _curatedRoute = executeWorkflow\(_curatedCtx, DB\);\s*sqRenderCuratedCard\(_curatedRoute,/.test(QR_HTML) && !/sqBuildCuratedIntake\(svc\)/.test(QR_HTML));

console.log('\n=== The real, live ResolvedRoute correctly resolves every real self-quote service ===');
const FNS = ['resolveDynamicService', 'resolveBaseConfidenceStrategy', 'resolveServiceCheckoutStateKey', 
    'applyLiveConfidenceEscalation', 'resolveSkillTier', 'priceAddedTime', 'splitAddedTimeDollars', 'applyPricingFormula',
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
// T190 (#138 I3): re-measured against the catalog (a sweep of all 76 services: 71 curated_card, 4 self_quote, 1 legacy_flow). angle_stop_replacement gained a real chain (plumbing_fixture,
// angle_stop_condition) and led_bulb_upgrade asks its bulb count (T154, #108): neither self-quotes. The four that do are the appliance installs T164 (item G) left with no questions;
// each opens at $70 / 80 min (pinned in the T188 golden master).
const EXPECTED_SELF_QUOTE = {
    microwave_setup: 70,
    washer_install: 70,
    dishwasher_install: 70,
    refrigerator_install: 70,
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
// T190 (#138 I3): was $140 (tiered flat rate, swap tier); the service is hardware_install_formula now and opens at $95 (the #112 visit minimum, T156; pinned by the T188 golden master).
check('cabinet_knob_or_pull_install -> laborEstimate: $95 (hardware_install_formula, install_type not yet answered)', knobRoute.quote?.laborEstimate === 95);

console.log('\n=== renderSelfQuoteFromRoute is a real, new function sourcing price from the route, not recomputing it ===');
const renderFn = findFn('renderSelfQuoteFromRoute');
check('renderSelfQuoteFromRoute exists', !!renderFn);
check('it reads perItemLabor from route.quote.laborEstimate, not from an inline recomputation', renderFn.includes('const perItemLabor = quote.laborEstimate'));
check('it reads dispatch from route.quote.dispatchFee', renderFn.includes('const dispatch = quote.dispatchFee'));
check('it does NOT contain the old inline pricing-engine lookup logic (resolveEngineKey/formula_components) -- confirming this is a genuine swap, not a duplicate calculation kept alongside the new one', !renderFn.includes('resolveEngineKey'));

console.log(`\n[Phase 6/7 self-quote rewire verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
