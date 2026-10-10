#!/usr/bin/env node
/**
 * verify_intake_defaults_meaningfulness_review.js
 *
 * Verifies the T118, operator-directed review applying the same test
 * used to remove `access` -- "does a real customer's answer meaningfully
 * change the price, and would the customer recognize the change as
 * fair?" -- to every other module in global_rules.intake_defaults.
 *
 * Decisions made:
 *   - urgency: kept, but scoped down to categories with genuine
 *     emergency scenarios (plumbing_help, tech_trouble) per explicit
 *     operator direction; removed from electric_lighting.
 *   - parking_difficulty: kept as-is (opt-in only, real $20 fee, a
 *     fairness case a customer would recognize -- common in the
 *     industry). No change needed.
 *   - pets_present: REMOVED entirely, module + modifier + its
 *     #pets_on_site smart tag. Fails the test outright: its own
 *     modifier_ref carries fee: 0, so by definition a customer's answer
 *     can never meaningfully change the price.
 *   - disposal_request: kept as-is (real $25 fee, correctly scoped to
 *     specific debris-generating groups already). No change needed.
 *   - item_volume: kept as-is (opt-in only, real $50 fee for a
 *     genuinely large job). No change needed.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.dirname(__dirname);
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(desc, cond) {
    if (cond) { pass++; console.log(`  \u2713 ${desc}`); }
    else { fail++; console.log(`  \u2717 ${desc}`); }
}

console.log('=== pets_present: removed entirely, the module that failed the test outright ===');
{
    check('intake_modules.pets_present does not exist', !('pets_present' in DB.intake_modules));
    check('global_rules.modifiers.pets_present_yes_pets_may_be_loose does not exist',
        !('pets_present_yes_pets_may_be_loose' in DB.global_rules.modifiers));
    check('#pets_on_site smart tag does not exist (its own answers pointed at the deleted module)',
        !('#pets_on_site' in DB.smart_tags));
    check('zero services author pets_present directly in their own intake_chain',
        !DB.services.some(s => (s.intake_chain || []).some(step => step.module === 'pets_present')));
}

console.log('\n=== urgency: kept, but scoped down to genuine emergency categories only ===');
{
    const cd = DB.global_rules.intake_defaults.category_defaults;
    check('plumbing_help still gets urgency (a genuine emergency category)', (cd.plumbing_help || []).includes('urgency'));
    check('tech_trouble still gets urgency (a genuine emergency category)', (cd.tech_trouble || []).includes('urgency'));
    check('electric_lighting no longer gets urgency (removed, not a genuine-emergency category per explicit operator direction)',
        !(cd.electric_lighting || []).includes('urgency'));
    check('urgency itself still exists as a real module and modifier -- this was a scoping change, not a removal',
        'urgency' in DB.intake_modules && 'urgency_urgent_today_or_tomorrow' in DB.global_rules.modifiers);
}

console.log('\n=== The three modules confirmed to genuinely pass the test: kept exactly as they were ===');
{
    const survivors = [
        ['parking_difficulty', 'parking_difficulty_yes_parking_is_difficult', 20],
        ['disposal_request', 'disposal_request_yes_please_haul_it_away', 25],
        ['item_volume', 'item_volume_a_large_quantity_7_or_more', 50],
    ];
    for (const [modKey, modifierKey, expectedFee] of survivors) {
        check(`${modKey} still exists as a real module`, modKey in DB.intake_modules);
        const mod = DB.global_rules.modifiers[modifierKey];
        check(`${modKey}'s real modifier carries a genuinely non-zero fee ($${expectedFee}) -- the actual bar pets_present failed`,
            mod && mod.fee === expectedFee);
    }
}

console.log('\n=== The real, general principle this whole review applied, checked mechanically: every surviving per_visit modifier has fee > 0 ===');
{
    const perVisitMods = Object.entries(DB.global_rules.modifiers).filter(([, v]) => v.scope === 'per_visit');
    const zeroFee = perVisitMods.filter(([, v]) => !(v.fee > 0));
    check(`every remaining per_visit modifier has a real, non-zero fee (found ${zeroFee.length} with fee <= 0: ${zeroFee.map(([k]) => k).join(', ') || 'none'})`,
        zeroFee.length === 0);
}

console.log(`\n[intake_defaults meaningfulness review] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
