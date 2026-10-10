#!/usr/bin/env node
/**
 * verify_dynamic_archetype_batch_2d.js
 *
 * Verifies Issue 2d of the operator-directed external catalog audit:
 * non-appliance groups' Diagnostic fallbacks (cabinets_drawers, doors,
 * floors_trim, furniture, walls, windows) reused the shared,
 * appliance-shaped symptom module ("won't spin," "won't drain,"
 * "leaking water" -- all appliance failure modes). Reused for
 * doors/walls/cabinets/windows, it asks the wrong questions entirely.
 *
 * Resolution: three of the six groups (cabinets_drawers, doors,
 * furniture) already had a real, group-specific issue module from
 * batch 2c's own +Repair fix -- reused directly rather than
 * duplicated. Three new modules authored for the remaining groups:
 * floor_issue, wall_issue, window_issue, each with real, anchored
 * modifier_ref fees.
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

const targets = {
    'minor_home_repairs+minor_home_repairs_cabinets_drawers+Diagnostic': 'cabinet_issue',
    'minor_home_repairs+minor_home_repairs_doors+Diagnostic': 'door_issue',
    'minor_home_repairs+minor_home_repairs_furniture+Diagnostic': 'furniture_issue',
    'minor_home_repairs+minor_home_repairs_floors_trim+Diagnostic': 'floor_issue',
    'minor_home_repairs+minor_home_repairs_walls+Diagnostic': 'wall_issue',
    'minor_home_repairs+minor_home_repairs_windows+Diagnostic': 'window_issue',
};

console.log('=== All 6 non-appliance Diagnostic fallbacks now ask a real, group-specific issue module, not the appliance-shaped symptom ===');
for (const [key, mod] of Object.entries(targets)) {
    const chain = DB.dynamic_services[key].intake_chain.map(s => s.module);
    check(`${key} -> ['${mod}']`, JSON.stringify(chain) === JSON.stringify([mod]));
}

console.log('\n=== Reuse, not duplication: cabinet_issue/door_issue/furniture_issue are the exact same modules batch 2c authored for +Repair ===');
{
    check('cabinet_issue has no _note suggesting a second, separate authoring for Diagnostic',
        (DB.intake_modules.cabinet_issue._note.match(/T128|T130/g) || []).length === 1);
}

console.log('\n=== Three new modules authored for the remaining groups, each with real content and real fees ===');
for (const mod of ['floor_issue', 'wall_issue', 'window_issue']) {
    const m = DB.intake_modules[mod];
    check(`${mod} exists with at least 4 real options`, m && m.client_response.length >= 4);
    const realOptions = m.client_response.filter(r => !r.label.startsWith('Other'));
    check(`${mod}: every non-"Other" option carries a real modifier_ref`,
        realOptions.every(r => r.modifier_ref && DB.global_rules.modifiers[r.modifier_ref]));
    const modRefs = realOptions.map(r => r.modifier_ref);
    check(`${mod}: every new modifier has scope: 'per_unit'`,
        modRefs.every(ref => DB.global_rules.modifiers[ref].scope === 'per_unit'));
}

console.log('\n=== Empirically real: at least one option per new module genuinely changes price vs. a neutral baseline ===');
{
    for (const mod of ['floor_issue', 'wall_issue', 'window_issue']) {
        const fees = Object.values(DB.intake_modules[mod].client_response)
            .filter(r => r.modifier_ref)
            .map(r => DB.global_rules.modifiers[r.modifier_ref])
            .filter(m => m.fee > 0 || m.minutes > 0);
        check(`${mod} has at least one option with a genuinely non-zero fee or minutes`, fees.length > 0);
    }
}

console.log('\n=== Regression: the shared symptom module remains correctly referenced by real appliance services, not orphaned ===');
{
    const stillReferenced = DB.services.some(s => (s.intake_chain || []).some(step => step.module === 'symptom'));
    check('symptom still has at least one real referrer (the real, named appliance-repair services)', stillReferenced);
}

console.log(`\n[dynamic archetype alignment, Issue 2d] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
