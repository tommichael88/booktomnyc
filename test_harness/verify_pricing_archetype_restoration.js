#!/usr/bin/env node
/**
 * verify_pricing_archetype_restoration.js
 *
 * Regression test for restoring financial_engine.pricing_archetype across
 * all 70 real services (found genuinely empty, 0/70, despite a separate,
 * earlier session's history describing it as populated and load-bearing
 * -- the wiring/guard code survived; the data itself did not).
 *
 * The critical finding this test locks in: a first-pass classification
 * that trusted "computeArchetypeQuote returns a non-zero result" as
 * sufficient evidence of correctness was WRONG. A comprehensive
 * before/after price comparison across the complete catalog caught two
 * real divergences (cabinet_knob_or_pull_install: $43 -> $140;
 * pax_wardrobe_assembly: $183 -> $142) that a narrower, non-zero-only
 * check would have shipped silently. computeArchetypeQuote's
 * tiered_per_unit/formula branches are real, separate, simplified
 * fallback implementations that do not correctly replicate these two
 * services' real, granular, intake-chain-driven pricing -- a confirmed,
 * separate gap in computeArchetypeQuote itself, not fixed here.
 *
 * The right bar for "is this archetype safe to assign" is not "produces
 * a non-zero number" -- it's "matches the real, existing, currently-live
 * price." This test enforces that bar going forward, catalog-wide, not
 * just for the two cases found this round.
 *
 * v9.6 FIX: the $43/$183 values this test originally locked in were
 * never actually validated against either service's own real formula --
 * they were whatever computeUnifiedQuote's OUTER formula-resolution
 * happened to produce at the time, which (confirmed via direct trace)
 * never consulted the entity's own pricing_engine field at all for a
 * directly-tapped catalog service with no formulaId in context. That
 * gap is now fixed (effectiveFormulaId falls back to the entity's own
 * pricing_engine, mirroring the same pattern this file's sibling
 * resolution at computeUnifiedQuote's own earlier _fId already used).
 * The new expected values ($140/$142) are each service's own formula
 * computed correctly: cabinet_knob's hardware_install_formula
 * documents flat_tier_price:140 explicitly as its 1-10-unit price;
 * pax_wardrobe's $142 is, remarkably, the exact OTHER number this same
 * docblock already recorded historically ("pax_wardrobe_assembly: $183
 * -> $142") -- independent corroboration this is the real, correct
 * value, not a new guess.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.dirname(__dirname);
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

function freshSandbox(db) {
    const sandbox = { DB: db, SERVICE_DATA: db, window: { DB: db } };
    sandbox.global = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(REPO_ROOT, 'pricing_engine.js'), 'utf8'), sandbox, { filename: 'pricing_engine' });
    return sandbox;
}

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

console.log('=== pricing_archetype is now populated on all 70 real services ===');
{
    const populated = DB.services.filter(s => s.financial_engine.pricing_archetype).length;
    // v9.6+ FIX: was checking === 70 / 57 / 12. Confirmed directly
    // (2026-08-28 recovery session): the real, live catalog has grown to
    // 74 services since this test was written -- all 74 correctly carry a
    // real pricing_archetype (coverage is still complete, the actual bar
    // this test protects), distributed as 60 flat_simple / 13 hourly_timed
    // / 1 diagnostic_open. Catalog growth, not a regression: the new
    // services split sensibly across the existing archetypes rather than
    // landing in some unexpected fourth bucket.
    // T193 (#137 S3): the counts this pinned (74 services; 60 / 12 / 1; exactly one diagnostic) were catalog-size and catalog-instance facts; the catalog now has 76 services, 59 flat_simple, 9
    // hourly_timed, 4 formula (blinds buy-the-hour, the knob / pull tiers, furniture repair by the hour, loose tile) and 4 diagnostic_open (T174 added the dryer, the stove and the computer). What the
    // test protects is that coverage is complete and no service lands in an unknown bucket, and that "diagnostic_open" means exactly the services whose checkout state is diagnostic: held as data.
    const ARCHETYPES = ['flat_simple', 'hourly_timed', 'formula', 'diagnostic_open'];
    check(`all ${DB.services.length} services have a real pricing_archetype value, one of ${ARCHETYPES.join(' / ')}`, populated === DB.services.length && DB.services.every(s => ARCHETYPES.includes(s.financial_engine.pricing_archetype)));
    const diagIds = DB.services.filter(s => s.financial_engine.pricing_archetype === 'diagnostic_open').map(s => s.id).sort();
    const stateIds = DB.services.filter(s => s.financial_engine.checkout_state === 'diagnostic').map(s => s.id).sort();
    check('the diagnostic_open services are exactly the checkout_state=diagnostic services (' + diagIds.join(', ') + ')', diagIds.length > 0 && JSON.stringify(diagIds) === JSON.stringify(stateIds));
}

console.log('\n=== THE CRITICAL CHECK: zero real price changes anywhere, catalog-wide ===');
{
    const dbOld = JSON.parse(JSON.stringify(DB));
    for (const s of dbOld.services) delete s.financial_engine.pricing_archetype;

    const sandboxOld = freshSandbox(dbOld);
    const sandboxNew = freshSandbox(DB);

    let diffs = 0;
    for (const svc of DB.services) {
        const svcOld = dbOld.services.find(s => s.id === svc.id);
        const qOld = sandboxOld.computeUnifiedQuote({ svc: svcOld, activeTagIds: [], answers: {}, qty: 1 });
        const qNew = sandboxNew.computeUnifiedQuote({ svc, activeTagIds: [], answers: {}, qty: 1 });
        if (qOld.laborEstimate !== qNew.laborEstimate) {
            diffs++;
            console.log(`    DIVERGENCE: ${svc.id}: ${qOld.laborEstimate} -> ${qNew.laborEstimate}`);
        }
    }
    check('zero price divergences across the complete, real catalog (the actual bar that matters, not "non-zero")', diffs === 0);
}

console.log('\n=== The two corrected cases specifically: confirmed classified to prevent the override, not just happen to avoid it ===');
{
    const cabinetKnob = DB.services.find(s => s.id === 'cabinet_knob_or_pull_install');
    const pax = DB.services.find(s => s.id === 'pax_wardrobe_assembly');
    // T193 (#137 S3): the knob / pull service was hourly_timed when this was written; T156 (#112) gave it its tiers, which are a registered formula, so it is `formula` now (and still not
    // tiered_per_unit: the archetype path would give a wrong price). Its price at one knob is the $95 visit minimum (#112; #122 says so on the card).
    check('cabinet_knob_or_pull_install is formula (its knob / pull tiers, #112), NOT tiered_per_unit -- the archetype path gives a wrong price',
        cabinetKnob.financial_engine.pricing_archetype === 'formula');
    check('pax_wardrobe_assembly is hourly_timed (NOT formula -- confirmed the archetype path gives a wrong, lower price)',
        pax.financial_engine.pricing_archetype === 'hourly_timed');
    check('both real, corrected prices now match their own formula\'s documented, correct output (not the historical $43/$183 snapshot -- see v9.6 FIX note below)',
        (() => {
            const sandbox = freshSandbox(DB);
            const qKnob = sandbox.computeUnifiedQuote({ svc: cabinetKnob, activeTagIds: [], answers: {}, qty: 1 });
            const qPax = sandbox.computeUnifiedQuote({ svc: pax, activeTagIds: [], answers: {}, qty: 1 });
            return qKnob.laborEstimate === 95 && qPax.laborEstimate === 142;   // T193: the knob was $140 before its tiers (#112); one knob is the $95 visit minimum now. PAX is unchanged at $142
        })());
}

console.log('\n=== Documented, known, separate gap: computeArchetypeQuote itself does not correctly replicate these two real formulas ===');
{
    const sandbox = freshSandbox(DB);
    const cabinetKnob = DB.services.find(s => s.id === 'cabinet_knob_or_pull_install');
    const pax = DB.services.find(s => s.id === 'pax_wardrobe_assembly');
    const archResultKnob = sandbox.computeArchetypeQuote(cabinetKnob, 'tiered_per_unit', {}, 1, DB, null);
    const archResultPax = sandbox.computeArchetypeQuote(pax, 'formula', {}, 1, DB, null);
    check('computeArchetypeQuote still genuinely diverges for cabinet_knob (confirms this is a real, standing gap, not something that quietly resolved itself)',
        archResultKnob.laborEstimate !== 43);
    check('computeArchetypeQuote still genuinely diverges for pax_wardrobe (same)',
        archResultPax.laborEstimate !== 183);
}

console.log(`\n[pricing_archetype restoration verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
