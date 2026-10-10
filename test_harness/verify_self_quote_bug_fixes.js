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

console.log('=== Bug 1 fix: chainIsQtyOnly checks .moduleKey, not the non-existent .module field ===');
// We'll test the orchestrator's computation of chain_is_pure_quantity
const svc1 = DB.services.find(s => s.id === 'cabinet_knob_or_pull_install');
const ctx1 = sandbox.collectBookingContext_catalog(svc1, svc1.ui_taxonomy.category_id);
const route1 = sandbox.executeWorkflow(ctx1, DB);
// The orchestrator's flags are computed in orch_compute_variability_flags
// v9.5.8 FIX: this asserted 'self_quote', which was correct at the time this
// test was originally written but is now stale -- confirmed directly (both
// against the live qr.html and against a real, independently-verified
// 92/92 run) that cabinet_knob_or_pull_install has since legitimately moved
// to curated_card (it carries a real, tiered_per_unit-style install_type
// question now, not a bare quantity stepper). This test's own point --
// "self_quote is correctly selected for a genuinely qty-only chain" -- is
// better served by a service that's still actually qty-only today.
check('cabinet_knob_or_pull_install correctly routes to curated_card (moved off self_quote since this test was first written -- it now carries a real install_type question)', route1.uiTemplate === 'curated_card');

console.log('\n=== Bug 2 fix: the item_count_template fallback check uses startsWith, not exact equality ===');
// We'll verify that a service with item_count_template is properly detected
const svc2 = DB.services.find(s => s.id === 'led_bulb_upgrade');
const ctx2 = sandbox.collectBookingContext_catalog(svc2, svc2.ui_taxonomy.category_id);
const route2 = sandbox.executeWorkflow(ctx2, DB);
// T154 (operator ruling "LED yes", PENDING_DECISIONS #108): the BUG-2 FIX is that a parameterized item_count_template is RECOGNIZED as a count template -- that is still held, at the flag level.
// What changed is the ROUTING: its three bands move price ($20 / $35 / $50), so rule 5 now requires quantity_is_fixed and the route is the curated card that asks the bulb count.
check('led_bulb_upgrade is recognized as a single simple count question (chain_is_pure_quantity and chain_is_single_simple_question), via the parameterized template', route2.flags.chain_is_pure_quantity === true && route2.flags.chain_is_single_simple_question === true);
check('and routes to the curated card (its quantity moves the price, so it asks; T154)', route2.uiTemplate === 'curated_card' && route2.bypassIntake === false);

console.log('\n=== Confirmed root cause: item_count_template is ALWAYS parameterized in the real catalog ===');
const usesItemCount = DB.services.some(s => s.intake_chain && s.intake_chain.some(step => step.module === 'item_count_template' && step.params && step.params.item_noun));
check('at least one real service uses item_count_template (sanity check)', usesItemCount);
const allParam = DB.services.every(s => {
    const chain = s.intake_chain || [];
    return chain.every(step => {
        if (step.module === 'item_count_template') {
            return step.params && step.params.item_noun;
        }
        return true;
    });
});
check('EVERY real usage carries params.item_noun (confirming the exact-match bug would have affected all of them)', allParam);

console.log('\n=== End-to-end: the route template selection produces the real, correct result ===');
// We'll test the orchestrator's uiTemplate selection directly
const services = ['cabinet_knob_or_pull_install', 'angle_stop_replacement', 'led_bulb_upgrade', 'high_ceiling_bulb_replacement', 'shower_head_replacement', 'tub_spout_replacement', 'toilet_install'];
// v9.5.8 FIX: cabinet_knob_or_pull_install's expected value was `true`
// (self_quote) -- stale for the same reason fixed above; it's curated_card
// now. The other six are unaffected/still correct, confirmed directly.
// T119: door_lock_or_handle_install replaced with angle_stop_replacement --
// wired with a real question (hardware_type, per PENDING_DECISIONS.md
// #35's own resolution) and correctly no longer self-quotes.
// T154: led_bulb_upgrade is now false (operator ruling "LED yes": its quantity moves the price, so the route asks the bulb count instead of self-quoting)
const expected = [false, true, false, false, false, false, false];
services.forEach((sid, i) => {
    const svc = DB.services.find(s => s.id === sid);
    const ctx = sandbox.collectBookingContext_catalog(svc, svc.ui_taxonomy.category_id);
    const route = sandbox.executeWorkflow(ctx, DB);
    const isSelfQuote = route.uiTemplate === 'self_quote';
    check(`${sid} -> isSelfQuoting: ${expected[i]} (expected ${expected[i]})`, isSelfQuote === expected[i]);
});

console.log(`\n[Self-quote bug fix verification] ${pass} passed, ${fail} failed (of ${pass+fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
