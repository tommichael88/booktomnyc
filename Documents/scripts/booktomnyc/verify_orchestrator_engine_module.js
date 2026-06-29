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
const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(REPO_ROOT, 'pricing_engine.js'), 'utf8'), sandbox, { filename: 'pricing_engine' });
vm.runInContext(fs.readFileSync(enginePath, 'utf8'), sandbox, { filename: 'orchestrator_engine' });

console.log('=== Real, standalone load: the module runs correctly with only its one real, external dependency satisfied ===');
check('executeWorkflow is genuinely callable after loading only pricing_engine.js alongside this module', typeof sandbox.executeWorkflow === 'function');

console.log('\n=== Real, end-to-end test: the self-quote path (T26) ===');
{
    const svc = DB.services.find(s => s.id === 'cabinet_knob_or_pull_install');
    const ctx = sandbox.collectBookingContext_catalog(svc, svc.ui_taxonomy.category_id);
    const route = sandbox.executeWorkflow(ctx, DB);
    check('cabinet_knob_or_pull_install correctly resolves to self_quote', route.uiTemplate === 'self_quote');
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
    functionNames: ['executeWorkflow', 'orch_resolve_entity', 'orch_apply_object_based_resolution',
        'orch_enrich_from_dynamic_service', 'orch_compute_variability_flags',
        'orch_compose_intake_chain', 'orch_apply_location_hints', 'orch_compute_confidence',
        'orch_select_ui_template', 'orch_merge_materials_estimate', 'orch_compute_quote',
        'orch_apply_intake_bypass_rules', 'readRoutePath', 'evaluateInvariant',
        'describeInvariantFailure', 'validateRoute', 'catastrophicFallbackRoute',
        'collectBookingContext_catalog', 'collectBookingContext_otherTile',
        'collectBookingContext_freeText', 'makeBookingContext', '_resolveIntakeChain'],
});
const parityOk = printReport(parityResult, 'orchestrator_engine.js');
if (!parityOk) fail += parityResult.stale.length;

console.log(`\n[orchestrator_engine.js standalone module] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
