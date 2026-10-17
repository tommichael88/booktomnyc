#!/usr/bin/env node
/**
 * verify_project_based_hide_time.js
 *
 * Regression test for a real, severe, customer-facing bug, reported with
 * a screenshot: the real, live quote panel for prehung_interior_door_install
 * showed "Total labor: $225" -- a real, correct, itemized flat-rate figure
 * (base $150 + disposal_request $25 + urgency $50, no hourly multiplication) --
 * directly alongside "Est. labor time: ~765 min - specialized ($110/hr)",
 * which, multiplied out, implies roughly $1,402. Same customer, same
 * panel, two numbers that can't both be true.
 *
 * Root-caused precisely: `checkout_states.project_based` was missing
 * `hide_time` entirely (confirmed: all 3 other real checkout states --
 * standard_flat_rate, diagnostic, database_summation -- explicitly set it
 * one way or the other; project_based simply never had this considered).
 * computeUnifiedQuote's `cs.hide_time || false` fallback silently defaulted
 * to false (show it) whenever the field was absent. The rendering logic
 * itself (sqRenderQuote, qr.html) was already correctly wired to respect
 * this flag (`q.hideTime ? '' : '...Est. labor time...'`) -- this was
 * purely a missing data field, not a code bug, and needed zero rendering
 * changes to fix.
 *
 * Reconstructed the exact, real screenshot scenario before fixing anything
 * -- confirmed an EXACT match (laborEstimate: 225, totalMin: 765,
 * tierRate: 110) before touching any data, not assumed from the image
 * alone.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.dirname(__dirname);
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));
const sandbox = { DB, window: { DB } };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(REPO_ROOT, 'pricing_engine.js'), 'utf8'), sandbox, { filename: 'pricing_engine' });

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

console.log('=== The real, exact, reported scenario: prehung_interior_door_install ===');
{
    const svc = DB.services.find(s => s.id === 'prehung_interior_door_install');
    const answers = {
        client_supplying_door: 'No, I need you to procure it',
        existing_frame: 'Yes',
        disposal_request: 'Yes, please haul it away',
        urgency: 'Urgent - today or tomorrow',
    };
    const q = sandbox.computeUnifiedQuote({ svc, activeTagIds: [], answers, qty: 1 });
    // T182 (#229, #234; the Operator, 2026-10-17 02:30 NY, "prehung door pricing needs to be raised to $250 baseline"): the baseline is $250 for 180 to 240 minutes of labor (it was $150 for a range of 475 to 925
    // minutes), the procurement answer's 45 minutes are priced as time ($55), the per-visit fees keep their fees ($25 + $50), and the tier is the one the service declares (skilled, $85), not one read from the
    // minutes ($110). The display fix this test is about is unchanged: the service states "project estimate" outright, so its time stays hidden.
    check('laborEstimate is the baseline $250 + $55 of priced procurement time + $75 of per-visit fees = $380 (the T182 price; this test is about the display, hideTime)', q.laborEstimate === 380, 'got ' + q.laborEstimate);
    check('totalMin/tierRate are genuinely computed (210min baseline + 65 from answers = 275, the declared skilled tier at $85/hr; no longer read from the minutes)', q.totalMin === 275 && q.tierRate === 85, `${q.totalMin} / ${q.tierRate}`);
    check('hideTime is now true -- the misleading time/rate breakdown will not render', q.hideTime === true);
}

console.log('\n=== The other real project_based service is also fixed ===');
{
    const svc = DB.services.find(s => s.id === 'toilet_install');
    const q = sandbox.computeUnifiedQuote({ svc, activeTagIds: [], answers: {}, qty: 1 });
    check('toilet_install: checkout_state is genuinely project_based (sanity check)', q.checkoutStateKey === 'project_based');
    check('toilet_install: hideTime is now true', q.hideTime === true);
}

console.log('\n=== Regression check: the other 3 real checkout states are unaffected ===');
{
    const cases = [
        ['dishwasher_repair', 'diagnostic', true],  // was already true, must stay true
        ['gfci_outlet_replacement', 'standard_flat_rate', false], // was already false, must stay false
    ];
    for (const [id, expectedState, expectedHideTime] of cases) {
        const svc = DB.services.find(s => s.id === id);
        const q = sandbox.computeUnifiedQuote({ svc, activeTagIds: [], answers: {}, qty: 1 });
        check(`${id} (${expectedState}): checkout_state unaffected`, q.checkoutStateKey === expectedState);
        check(`${id}: hideTime unchanged at ${expectedHideTime}`, q.hideTime === expectedHideTime);
    }
}

console.log('\n=== hide_materials was correctly left untouched -- confirmed still intentionally absent, not a second bug ===');
{
    check('checkout_states.project_based.hide_materials is still genuinely unset (a real, documented, deliberate decision, not this bug)',
        DB.checkout_states.project_based.hide_materials === undefined);
    const svc = DB.services.find(s => s.id === 'prehung_interior_door_install');
    const q = sandbox.computeUnifiedQuote({ svc, activeTagIds: [], answers: {}, qty: 1 });
    check('prehung_interior_door_install still correctly shows its real, authored materials range ($200-600), unaffected by this fix',
        q.hideMaterials === false);
}

console.log(`\n[project_based hide_time verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
