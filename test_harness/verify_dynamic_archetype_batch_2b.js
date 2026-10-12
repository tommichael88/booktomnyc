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
 *
 * T174 (PENDING_DECISIONS #199): the shared `symptom` was the washer's, so each
 * appliance group now DECLARES its own symptom module
 * (routing_archetypes[group].symptom_module) and its fallbacks and services ask
 * that. The claim this file holds is unchanged -- a symptom_first appliance
 * fallback asks a real symptom question, never surface_type -- and is now stated
 * against the declaration instead of the washer's module name.
 * verify_group_symptoms_one_derivation.js holds the declaration itself.
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

console.log('=== All 8 appliance +Repair fallbacks ask their group\'s symptom question, not surface_type ===');
for (const key of targets) {
    const chain = DB.dynamic_services[key].intake_chain.map(s => s.module);
    const group = key.split('+')[1], declared = DB.routing_archetypes[group] && DB.routing_archetypes[group].symptom_module;
    check(`${key} -> ['${declared}'] (the group's declared symptom module)`, !!declared && JSON.stringify(chain) === JSON.stringify([declared]) && !chain.includes('surface_type'));
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

console.log('\n=== Regression: the real, named appliance-repair services (the reference shape this batch matched) still ask their group\'s symptom question ===');
{
    for (const sid of ['washer_repair', 'dishwasher_repair', 'microwave_repair', 'repair_appliances', 'window_ac_repair']) {
        const svc = DB.services.find(s => s.id === sid);
        const declared = DB.routing_archetypes[svc.ui_taxonomy.group_id].symptom_module;
        check(`${sid} still asks its group's symptom module (${declared}) in its own chain (unaffected by this batch)`,
            !!declared && svc.intake_chain.some(s => s.module === declared));
    }
}

console.log(`\n[dynamic archetype alignment, Issue 2b] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
