#!/usr/bin/env node
/**
 * verify_dynamic_archetype_batch_2b.js
 *
 * Verifies Issue 2b of the operator-directed external catalog audit:
 * symptom_first appliance groups' Repair fallbacks asked surface_type
 * -- "what kind of surface?" for a broken appliance is a category
 * error, not a scoping question. Per §6E.6's own routing-archetype
 * table, a symptom_first group's chain must include a real symptom
 * question, not a generic surface_type.
 *
 * Resolution: swapped surface_type for symptom, the same shared,
 * established module already used by the real, named services
 * (washer_repair, dishwasher_repair, microwave_repair,
 * repair_appliances) for exactly this purpose -- no new module
 * needed, this batch is a pure, direct substitution.
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

const targets = [
    'minor_home_repairs+minor_home_repairs_appliances+Repair',
    'minor_home_repairs+minor_home_repairs_appliances_washer+Repair',
    'minor_home_repairs+minor_home_repairs_appliances_dryer+Repair',
    'minor_home_repairs+minor_home_repairs_appliances_stove_range+Repair',
    'minor_home_repairs+minor_home_repairs_appliances_refrigerator+Repair',
    'minor_home_repairs+minor_home_repairs_appliances_dishwasher+Repair',
    'minor_home_repairs+minor_home_repairs_appliances_microwave+Repair',
    'minor_home_repairs+minor_home_repairs_appliances_window_ac+Repair',
];

console.log('=== All 8 appliance +Repair fallbacks now ask symptom, not surface_type ===');
for (const key of targets) {
    const chain = DB.dynamic_services[key].intake_chain.map(s => s.module);
    check(`${key} -> ['symptom']`, JSON.stringify(chain) === JSON.stringify(['symptom']));
}

console.log('\n=== Regression: surface_type is not orphaned -- it remains correctly used by real surface_repair-archetype groups ===');
{
    let stillReferenced = false;
    for (const dyn of Object.values(DB.dynamic_services)) {
        if (dyn.intake_chain.some(s => s.module === 'surface_type')) { stillReferenced = true; break; }
    }
    if (!stillReferenced) {
        for (const svc of DB.services) {
            if ((svc.intake_chain || []).some(s => s.module === 'surface_type')) { stillReferenced = true; break; }
        }
    }
    check('surface_type still has at least one real referrer elsewhere in the catalog', stillReferenced);
}

console.log('\n=== Regression: the real, named appliance-repair services (the reference shape this batch matched) are untouched ===');
{
    for (const sid of ['washer_repair', 'dishwasher_repair', 'microwave_repair', 'repair_appliances']) {
        const svc = DB.services.find(s => s.id === sid);
        check(`${sid} still includes symptom in its own chain (unaffected by this batch)`,
            svc.intake_chain.some(s => s.module === 'symptom'));
    }
}

console.log(`\n[dynamic archetype alignment, Issue 2b] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
