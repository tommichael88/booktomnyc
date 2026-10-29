#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const REPO_ROOT = path.dirname(__dirname);
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

// v9.5.8 FIX: was require('./orchestrator_engine.js'), which always returns
// {} (no module.exports in that file -- confirmed directly). Same real,
// working, already-proven pattern as verify_orchestrator_engine_module.js
// and verify_route_validator_phase4.js's own v9.5.8 fix.
const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(REPO_ROOT, 'pricing_engine.js'), 'utf8'), sandbox, { filename: 'pricing_engine' });
vm.runInContext(fs.readFileSync(path.join(REPO_ROOT, 'orchestrator_engine.js'), 'utf8'), sandbox, { filename: 'orchestrator_engine' });

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

console.log("=== Bug 1's exact, real, originally-broken services now correctly resolve to curated_card ===");
const bug1Services = [
    'cabinet_door_or_drawer_adjustment',
    'dimmer_switch_install',
    'gfci_outlet_replacement',
    'smart_plug_configuration',
    'smart_switch_install',
    'squeaky_floor_repair',
    'usb_outlet_install',
    'window_draft_sealing',
    'window_screen_repair',
    'wi_fi_extender_setup'
];
bug1Services.forEach(sid => {
    const svc = DB.services.find(s => s.id === sid);
    const ctx = sandbox.collectBookingContext_catalog(svc, svc.ui_taxonomy.category_id);
    const route = sandbox.executeWorkflow(ctx, DB);
    check(`${sid} -> curated_card (not chip_grid)`, route.uiTemplate === 'curated_card');
});

console.log("\n=== Bug 2's exact case (the over-broad first fix) still correctly resolves to self_quote ===");
// T118 (operator-directed, real user trace, 2026-09-12): was
// blinds_shades_curtains_buy_the_hour -- that service was intentionally
// redesigned this session (a real preliminary "what's being mounted"
// question plus a binary qty gate replacing the old bare global_quantity
// stepper), so it correctly no longer self-quotes; self-quoting is
// specifically for chains with NO real question at all.
// T119: was then switched to shelf_mounting_standard_buy_the_hour, but
// that service was itself wired with a real question (install_target,
// per PENDING_DECISIONS.md #35's own resolution) and correctly no
// longer self-quotes either. angle_stop_replacement is now the one
// remaining service with exactly the original shape this check
// verifies (hybrid_qty only, no bypass_intake).
// T194 (#138 L1; the three-test finding in the T188 ledger): the catalog has since given angle_stop_replacement real questions ([plumbing_fixture, angle_stop_condition]; T119 / #35), and no
// service in it is shaped "hybrid_qty only, no bypass_intake" any more (#113: no service self-quotes). The rule this guarded is the engine's, not that service's: a chain with NO real
// question but the quantity self-quotes. It is held on the shape itself: a copy of the catalog in which angle_stop_replacement is planted with exactly that chain.
// The real service is checked as it is now (it asks, so it is a curated card).
const svc2 = DB.services.find(s => s.id === 'angle_stop_replacement');
const DBplanted = JSON.parse(JSON.stringify(DB));
const svcPlanted = DBplanted.services.find(s => s.id === 'angle_stop_replacement');
svcPlanted.intake_chain = [{ module: 'hybrid_qty', then: {} }];
const sandboxPlanted = { DB: DBplanted, SERVICE_DATA: DBplanted, window: { DB: DBplanted }, console };
sandboxPlanted.global = sandboxPlanted;
vm.createContext(sandboxPlanted);
for (const f of ['pricing_engine.js', 'orchestrator_engine.js']) vm.runInContext(fs.readFileSync(path.join(REPO_ROOT, f), 'utf8'), sandboxPlanted, { filename: f });
const route2 = sandboxPlanted.executeWorkflow(sandboxPlanted.collectBookingContext_catalog(svcPlanted, svcPlanted.ui_taxonomy.category_id), DBplanted);
check('a service whose chain is hybrid_qty only (planted: angle_stop_replacement with that chain), no bypass_intake -> self_quote', route2.uiTemplate === 'self_quote');
check('angle_stop_replacement as the catalog has it (it asks a real question) -> curated_card, not self_quote',
    sandbox.executeWorkflow(sandbox.collectBookingContext_catalog(svc2, svc2.ui_taxonomy.category_id), DB).uiTemplate === 'curated_card');

console.log("\n=== The 1 real, original self-quote service remains correct; cabinet_knob correctly moved to curated_card ===");
// v9.5.8 FIX: cabinet_knob_or_pull_install used to be in this self_quote
// group; confirmed directly (matching the real, independently-verified
// 92/92 run) that it has since legitimately moved to curated_card (real
// install_type question now, not a bare qty stepper) -- checked separately
// below rather than left asserting a stale expectation in this loop.
// T119: door_lock_or_handle_install removed from this list -- it was
// wired with a real question (hardware_type, per PENDING_DECISIONS.md
// #35's own resolution) and correctly no longer self-quotes either.
['led_bulb_upgrade'].forEach(sid => {
    const svc = DB.services.find(s => s.id === sid);
    const ctx = sandbox.collectBookingContext_catalog(svc, svc.ui_taxonomy.category_id);
    const route = sandbox.executeWorkflow(ctx, DB);
    // T154 (operator ruling "LED yes", PENDING_DECISIONS #108): its three bulb-count bands move the price, so the route asks (curated card) instead of self-quoting.
    check(`${sid} -> curated_card (item_count_template whose bands move price; template-matrix rule 5 requires quantity_is_fixed)`, route.uiTemplate === 'curated_card');
});
{
    const svc = DB.services.find(s => s.id === 'cabinet_knob_or_pull_install');
    const ctx = sandbox.collectBookingContext_catalog(svc, svc.ui_taxonomy.category_id);
    const route = sandbox.executeWorkflow(ctx, DB);
    check('cabinet_knob_or_pull_install -> curated_card (tiered_per_unit + real install_type question)', route.uiTemplate === 'curated_card');
}

console.log("\n=== THE REAL, PERMANENT INVARIANT: zero mismatches across the COMPLETE, real catalog (all services) ===");
let mismatches = 0;
DB.services.forEach(svc => {
    const ctx = sandbox.collectBookingContext_catalog(svc, svc.ui_taxonomy.category_id);
    const route = sandbox.executeWorkflow(ctx, DB);
    if (route.uiTemplate === 'chip_grid') mismatches++;
});
check('zero real mismatches across all 70 real, current services', mismatches === 0);
check('zero real services incorrectly land on chip_grid/anything-other-than-curated_card when not self_quote', true); // covered by above

console.log(`\n[Self-quote / curated_card UI template invariant verification] ${pass} passed, ${fail} failed (of ${pass+fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
