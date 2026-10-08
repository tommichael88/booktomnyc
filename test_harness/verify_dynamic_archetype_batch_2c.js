#!/usr/bin/env node
/**
 * verify_dynamic_archetype_batch_2c.js
 *
 * Verifies Issue 2c of the operator-directed external catalog audit:
 * component_first non-appliance groups' Repair fallbacks
 * (cabinets_drawers, furniture, doors) asked surface_type -- the same
 * category error as batch 2b, but for groups where no existing
 * "symptom" vocabulary fit either (that module is appliance-shaped:
 * "won't spin," "won't drain," etc.), so three small, new,
 * group-specific issue modules were authored instead, each with real,
 * anchored modifier_ref fees rather than left purely informational.
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
    'minor_home_repairs+minor_home_repairs_cabinets_drawers+Repair': 'cabinet_issue',
    'minor_home_repairs+minor_home_repairs_furniture+Repair': 'furniture_issue',
    'minor_home_repairs+minor_home_repairs_doors+Repair': 'door_issue',
};

console.log('=== All 3 non-appliance component_first Repair fallbacks now ask a real, group-specific issue module, not surface_type ===');
for (const [key, mod] of Object.entries(targets)) {
    const chain = DB.dynamic_services[key].intake_chain.map(s => s.module);
    check(`${key} -> ['${mod}']`, JSON.stringify(chain) === JSON.stringify([mod]));
}

console.log('\n=== Each new module has real, non-overlapping content, and every fee-bearing option carries a real modifier_ref ===');
for (const [, mod] of Object.entries(targets)) {
    const m = DB.intake_modules[mod];
    check(`${mod} exists with at least 4 real options`, m && m.client_response.length >= 4);
    const realOptions = m.client_response.filter(r => !r.label.startsWith('Other'));
    check(`${mod}: every non-"Other" option carries a real modifier_ref`,
        realOptions.every(r => r.modifier_ref && DB.global_rules.modifiers[r.modifier_ref]));
}

console.log('\n=== Every new modifier has an explicit scope, matching this catalog\'s own established convention ===');
{
    const newMods = ['cabinet_issue_face_scratched_or_scuffed', 'cabinet_issue_hinge_loose_or_squeaky',
        'cabinet_issue_door_wont_stay_closed', 'furniture_issue_wood_split_or_cracked',
        'furniture_issue_finish_damaged_or_worn', 'furniture_issue_piece_is_wobbly_or_unstable',
        'door_issue_wont_latch_or_stay_closed', 'door_issue_rubs_against_the_frame',
        'door_issue_hinge_loose_or_squeaky'];
    check(`all ${newMods.length} new modifiers have scope: 'per_unit'`,
        newMods.every(n => DB.global_rules.modifiers[n]?.scope === 'per_unit'));
}

console.log('\n=== Regression: surface_type remains correctly referenced elsewhere, not orphaned ===');
{
    let stillReferenced = false;
    for (const dyn of Object.values(DB.dynamic_services)) {
        if (dyn.intake_chain.some(s => s.module === 'surface_type')) { stillReferenced = true; break; }
    }
    check('surface_type still has at least one real referrer elsewhere in the catalog', stillReferenced);
}

console.log('\n=== Regression: furniture_issue is genuinely distinct from the existing "issue" module (used by the real, named furniture_repair_hourly service) ===');
{
    const furnitureIssueLabels = DB.intake_modules.furniture_issue.client_response.map(r => r.label).filter(l => !l.startsWith('Other'));
    const existingIssueLabels = DB.intake_modules.issue.client_response.map(r => r.label).filter(l => !l.startsWith('Other'));
    check('zero overlapping real option labels between furniture_issue and the existing issue module',
        !furnitureIssueLabels.some(l => existingIssueLabels.includes(l)));
}

console.log(`\n[dynamic archetype alignment, Issue 2c] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
