#!/usr/bin/env node
/**
 * verify_checkout_state_override_architecture.js
 *
 * The checkout_state_override field (added v9.3, see CHANGELOG_v9.3.md) is
 * schema/engine plumbing only — no client_response in btnyc.json sets it
 * yet (that's the deferred backlog work: authoring real per-answer
 * overrides for the 16 services that are currently unconditionally
 * 'diagnostic'). Because no real vector can exercise it today, this script
 * proves the plumbing itself works correctly using a SIMULATED data
 * mutation (never written back to btnyc.json), kept separate from
 * pricing_test_vectors.json so that file stays an honest reflection of
 * real, currently-authored SSOT data.
 *
 * Run this after any change to the checkout_state_override logic in
 * _computePrice or computeUnifiedQuote, and again once real per-answer
 * overrides are actually authored (at which point promote a real vector
 * into pricing_test_vectors.json and this script can be retired).
 */
const fs = require('fs');
const path = require('path');

const realDB = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'btnyc.json'), 'utf8'));

// Simulate: 'symptom' module's "Won't drain" answer gets a diagnostic
// override; "Won't spin" is left alone (should stay confidently quotable).
const simDB = JSON.parse(JSON.stringify(realDB));
const spinResp = simDB.intake_modules.symptom.client_response.find(r => r.label.includes("Won\u2019t spin"));
const drainResp = simDB.intake_modules.symptom.client_response.find(r => r.label.includes("Won\u2019t drain"));
if (!spinResp || !drainResp) throw new Error("Couldn't find 'Won't spin'/'Won't drain' responses — has intake_modules.symptom changed shape?");
// v9.5 FIX (real, genuine test failure found while verifying an unrelated
// fix this session): this test's own real comment, further down, claims
// "no fee/minutes were set on either answer in this simulation" — true
// when written, but factually false the moment real, authored minute
// deltas were added to THIS SAME module for the real dishwasher_repair
// midpoint-collapse fix. This test exists to isolate
// checkout_state_override specifically, not to depend on this module's
// real, business content staying permanently zero forever — explicitly
// zero both compared answers' real fee/minutes/complexity_override here,
// so the test's real isolation holds regardless of what real content
// this module carries going forward.
spinResp.effects.fee = 0; spinResp.effects.minutes = 0; delete spinResp.effects.complexity_override;
drainResp.effects.fee = 0; drainResp.effects.minutes = 0; delete drainResp.effects.complexity_override;
drainResp.effects.checkout_state_override = 'diagnostic';

global.DB = simDB;
global.SERVICE_DATA = simDB;
const engine = require('./_extracted_engine.js');

const dynDef = simDB.dynamic_services['minor_home_repairs+Repair'];
if (!dynDef) throw new Error("minor_home_repairs+Repair dynamic_service not found");

const deterministic = engine.computeUnifiedQuote({
    svc: null, dynDef, qty: 1, answers: { symptom: "Won\u2019t spin / no movement" }, activeTagIds: []
});
const ambiguous = engine.computeUnifiedQuote({
    svc: null, dynDef, qty: 1, answers: { symptom: "Won\u2019t drain (water stays inside)" }, activeTagIds: []
});

let pass = true;
if (deterministic.checkoutStateKey !== 'standard_flat_rate') {
    pass = false;
    console.log(`FAIL: deterministic-answer case expected 'standard_flat_rate', got '${deterministic.checkoutStateKey}'`);
}
if (ambiguous.checkoutStateKey !== 'diagnostic') {
    pass = false;
    console.log(`FAIL: ambiguous-answer case expected 'diagnostic' (the override), got '${ambiguous.checkoutStateKey}'`);
}
if (deterministic.laborEstimate !== ambiguous.laborEstimate) {
    // The override should change the CHECKOUT STATE / badge / messaging,
    // not the underlying labor math itself — the simulation above
    // explicitly, deliberately zeroes both compared answers' real
    // fee/minutes/complexity_override before adding the override flag,
    // so this isolates checkout_state_override specifically, regardless
    // of what real, non-zero content this module's OTHER options
    // (or this module in some future, further-edited state) might carry.
    // If this ever differs, something is bleeding between the two ratchets.
    pass = false;
    console.log(`FAIL: labor estimates differ (${deterministic.laborEstimate} vs ${ambiguous.laborEstimate}) when only checkout_state_override was set — expected identical labor math.`);
}

if (pass) {
    console.log('PASS: checkout_state_override architecture verified —');
    console.log(`  no override -> checkoutStateKey = '${deterministic.checkoutStateKey}' (confident, direct quote)`);
    console.log(`  override=diagnostic -> checkoutStateKey = '${ambiguous.checkoutStateKey}' (escalated, only for that answer)`);
    process.exit(0);
} else {
    process.exit(1);
}
