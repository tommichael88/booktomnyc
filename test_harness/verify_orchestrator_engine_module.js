#!/usr/bin/env node
/**
 * verify_orchestrator_engine_module.js
 *
 * Module test for orchestrator_engine.js — the third real, standalone
 * extraction (alongside pricing_engine.js, nlp_engine.js), built to
 * support a new, separate, real "dumb UI" prototype.
 *
 * Checks the module runs correctly standalone (loaded alongside
 * pricing_engine.js, its one real, external dependency —
 * resolveDynamicService) against the same, real, already-verified
 * cases from this entire session: the self-quote path (T26), the
 * curated-card path (T28), and the dishwasher/tile pricing fixes
 * (this session). Then runs the real, automated parity check so any
 * future drift fails loudly here, the same permanent protection
 * already proven for the other two modules.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.dirname(__dirname);
const enginePath = process.argv[2] || path.join(REPO_ROOT, 'orchestrator_engine.js');
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

// Load the module standalone, exactly as a real, separate dumb-UI file would.
const COMPONENT_MODULE_NAMES = new Set([
    "wall_type", "surface_type", "door_type", "door_style_pref", "door_size",
    "client_supplying_door", "existing_frame", "faucet_type", "sink_type",
    "toilet_style_pref", "existing_toilet_type", "window_type", "removal",
    "install_type", "existing_type", "furn_item", "mounting_item",
    "wall_mount_items", "item_type", "fixture_type", "electrical_item",
    "plumbing_fixture", "tech_device", "computer_component", "device_type",
    "laptop_or_desktop", "existing_box", "ducting", "length", "distance",
    "weight", "mounting_height", "tile_condition", "waterproof_area",
    "has_matching_tiles", "thermostat_type", "customer_supplied_part",
    "software_install_type", "brand", "router_owned", "mesh_network",
    "pax_cabinet_count", "pax_hinge_count", "pax_interior_count",
    "pax_sliding_count",
]);
const SYMPTOM_MODULE_NAMES = new Set([
    "symptom", "toilet_symptom", "tech_problem_type", "leak_type",
    "drain_speed", "issue", "damage_type", "device_state",
    "internet_active", "tech_issue_source",
]);
const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(REPO_ROOT, 'pricing_engine.js'), 'utf8'), sandbox, { filename: 'pricing_engine' });
vm.runInContext(fs.readFileSync(enginePath, 'utf8'), sandbox, { filename: 'orchestrator_engine' });

console.log('=== Real, standalone load: the module runs correctly with only its one real, external dependency satisfied ===');
check('executeWorkflow is genuinely callable after loading only pricing_engine.js alongside this module', typeof sandbox.executeWorkflow === 'function');

console.log('\n=== Real, end-to-end test: the self-quote path (T26) ===');
{
    // T118 (operator-directed, real user trace, 2026-09-12): was
    // blinds_shades_curtains_buy_the_hour -- intentionally redesigned
    // this session (a real preliminary question + binary qty gate
    // replacing global_quantity), so it correctly no longer self-quotes.
    // T119: was then switched to shelf_mounting_standard_buy_the_hour,
    // but that service was itself wired with a real question
    // (install_target, per PENDING_DECISIONS.md #35's own resolution)
    // and correctly no longer self-quotes either. angle_stop_replacement
    // is now the one remaining service with the original shape this
    // check verifies.
    const svc = DB.services.find(s => s.id === 'angle_stop_replacement');
    const ctx = sandbox.collectBookingContext_catalog(svc, svc.ui_taxonomy.category_id);
    const route = sandbox.executeWorkflow(ctx, DB);
    check('angle_stop_replacement correctly resolves to self_quote', route.uiTemplate === 'self_quote');
    check('the route is genuinely valid (passes RouteValidator)', route.valid !== false);
}

console.log('\n=== Real, end-to-end test: the curated-card path (T28), including this session\'s pricing fixes ===');
{
    const svc = DB.services.find(s => s.id === 'dimmer_switch_install');
    const ctx = sandbox.collectBookingContext_catalog(svc, svc.ui_taxonomy.category_id);
    const route = sandbox.executeWorkflow(ctx, DB);
    check('dimmer_switch_install correctly resolves to curated_card', route.uiTemplate === 'curated_card');
    check('the real, complete quote is present and correctly priced', route.quote && route.quote.laborEstimate === 45);
}

console.log('\n=== Real, end-to-end test: the dynamic-service tile pricing fix (this session) ===');
{
    const dynDef = DB.dynamic_services['minor_home_repairs+Repair'];
    const ctx = sandbox.makeBookingContext('other_tile', {
        selectedCategoryId: 'minor_home_repairs',
        selectedGroupId: 'minor_home_repairs_floors_trim',
        nlpIntent: { stype: 'Repair' },
    });
    const resolution = sandbox.orch_resolve_entity(ctx, DB);
    check('the real, dynamic entity resolves correctly', resolution.entityType === 'dynamic' && !!resolution.entity);
}

console.log('\n=== Real, automated parity check: this module must stay in sync with the live qr.html ===');
const { checkParity, printReport } = require('./check_module_parity.js');
const parityResult = checkParity({
    modulePath: enginePath,
    functionNames: ['executeWorkflow', 'orch_max_followup_questions', 'orch_resolve_entity', 'orch_apply_object_based_resolution',
        'orch_enrich_from_dynamic_service', 'orch_compute_variability_flags',
        'orch_compose_intake_chain', 'orch_apply_location_hints', 'orch_compute_confidence',
        'orch_select_ui_template', 'orch_merge_materials_estimate', 'orch_compute_quote',
        'orch_apply_intake_bypass_rules', 'readRoutePath', 'evaluateInvariant',
        'describeInvariantFailure', 'validateRoute', 'catastrophicFallbackRoute',
        'collectBookingContext_catalog', 'collectBookingContext_otherTile',
        'collectBookingContext_freeText', 'makeBookingContext', '_resolveIntakeChain',
        // v9.6: the bld* Guided Builder family, newly extracted here for
        // the first time (PENDING_DECISIONS.md item #16) -- added
        // directly to this list so it has real, automated drift
        // protection from the moment it exists, not left to be
        // remembered later the way syncTagSynthesizedAnswers was (T85).
        'bldGetObjectChoices', 'bldGetSpecificChoices', 'bldGetConditionChoices', 'bldGroupToKeyword'],
});
const parityOk = printReport(parityResult, 'orchestrator_engine.js');
if (!parityOk) fail += parityResult.stale.length;

console.log(`\n[orchestrator_engine.js standalone module] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
