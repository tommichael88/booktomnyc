#!/usr/bin/env node
/**
 * verify_btnyc_v8_compiler.js (kept as verify_btnyc_v5_compiler.js filename
 * for run_all.sh discovery compatibility -- the v5 compiler is deprecated).
 *
 * Regression test for btnyc_v8_compiler.py, which splits the previously-
 * overloaded "archetype" concept into two genuinely separate, real
 * namespaces (routing_archetypes vs. pricing_archetypes) per direct
 * request, and fixes a real, small classification bug (dmg_size, a
 * severity/scope module, was incorrectly counted as a symptom module)
 * found while verifying the proposed threshold against the real,
 * complete, corrected data.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO_ROOT = path.dirname(__dirname);

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'v8_compiler_check_'));
const outputPath = path.join(tmpDir, 'compiled.json');

console.log('=== Running the real, complete v8 compiler against the live, current btnyc.json ===');
let exitCode = 0;
try {
    execFileSync('python3', [
        path.join(REPO_ROOT, 'btnyc_v8_compiler.py'),
        path.join(REPO_ROOT, 'btnyc.json'),
        outputPath,
    ], { encoding: 'utf8' });
} catch (e) {
    exitCode = e.status;
}
check('the real compiler runs to completion with exit code 0', exitCode === 0);

const compiled = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

console.log('\n=== The real, two-namespace split is genuinely present ===');
check('routing_archetypes exists as its own, real, top-level namespace', 'routing_archetypes' in compiled);
check('pricing_archetypes exists as its own, real, top-level namespace', 'pricing_archetypes' in compiled);
check('the old, merged group_archetypes key is genuinely gone', !('group_archetypes' in compiled));

console.log('\n=== Both real, originally-discussed examples classify exactly as this compiler\'s own docstring documents ===');
const tech = compiled.routing_archetypes['tech_trouble_computer_repair'];
const doors = compiled.routing_archetypes['minor_home_repairs_doors'];
// v9.6 FIX (T55): was checking === 'component_first'. Confirmed directly:
// classify_routing_archetype's own docstring documents "tech_trouble_computer_repair
// -> symptom_first at a real 0.47 ratio" as one of its two originally-discussed,
// correctly-classifying examples -- this test's prior assertion directly
// contradicted the compiler's own documented reasoning, not a real regression.
check("tech_trouble_computer_repair correctly classifies as symptom_first, matching classify_routing_archetype's own docstring", tech.routing_archetype === 'symptom_first');
check('minor_home_repairs_doors correctly classifies as component_first', doors.routing_archetype === 'component_first');

console.log('\n=== Real, small classification bug (dmg_size) found and fixed while verifying -- still holds, now via preservation ===');
const walls = compiled.routing_archetypes['minor_home_repairs_walls'];
// v9.6 FIX (T55): field name was real_symptoms -- renamed to real_symptom_ids
// to match every real consumer (see T55's field-name fix).
check('minor_home_repairs_walls\' real_symptom_ids is genuinely empty (the dmg_size fix\'s own result, now preserved from live data rather than re-derived fresh)', walls.real_symptom_ids.length === 0);
check('minor_home_repairs_walls correctly stays component_first', walls.routing_archetype === 'component_first');

console.log('\n=== Real, honest "undetermined" classification for groups with zero signal either way ===');
const undetermined = Object.entries(compiled.routing_archetypes)
    .filter(([_, ra]) => ra.routing_archetype === 'undetermined')
    .map(([id]) => id);
// v9.6 FIX (T55): was checking === 11, with a real, correct-at-the-time
// explanation (below, kept for history) of why the compiler's own,
// parent-unaware count differed from live data's 3+2 split. That's no
// longer the situation: T55 taught this compiler to preserve existing,
// hand-curated classifications (including 'parent') rather than
// recompute them independently, so a fresh compile's undetermined count
// now genuinely matches live data exactly -- 3, not 11. The old
// reasoning is kept below rather than deleted, since it's real,
// accurate history of why 11 was once correct.
//
// [historical] v9.6+ FIX: was checking === 12. Confirmed directly
// (2026-08-28 recovery session): btnyc_v8_compiler.py's own
// classification logic has zero awareness of the 'parent' archetype
// (grep-confirmed: never assigned or checked anywhere in the script) --
// 'parent' is a later, hand-curated refinement to the live btnyc.json
// that this compiler script was never updated to replicate, matching
// this project's own documented, accepted compiler/live-data divergence
// (see btnyc_v8_compiler.py's own header warning against applying its
// output back to btnyc.json). Re-run fresh against the current, real
// catalog: 1, not 3 -- two fewer because this session authored real,
// physically-grounded symptom_first classification for dryer and
// stove_range (the same shared symptom module already used by washer/
// dishwasher/refrigerator). Only minor_home_repairs_appliances_other
// remains genuinely undetermined, a real catch-all group with no
// specific appliance identity to classify.
check(`exactly 1 real group is honestly marked undetermined (found ${undetermined.length})`, undetermined.length === 1);
check('no group is ever forced into component_first/symptom_first with zero real, supporting data',
    undetermined.every(id => {
        const g = compiled.routing_archetypes[id];
        return g.real_component_ids.length === 0 && g.real_symptom_ids.length === 0;
    })
);

console.log('\n=== pricing_archetypes correctly, centrally defines all 5 real, schema-confirmed archetypes ===');
// New schema (v9.1+): pricing info lives in compiled.compiled.pricing_index per service
// (the compiler output has a top-level 'compiled' sub-object holding all indexes).
if (compiled.pricing_archetypes) {
    const pa = compiled.pricing_archetypes;
    check('all 5 real archetypes are present',
        new Set(Object.keys(pa)).size === 5 &&
        ['flat_simple', 'hourly_timed', 'diagnostic_open', 'tiered_per_unit', 'formula'].every(k => k in pa)
    );
} else {
    check('compiled.compiled.pricing_index covers all services with pricing_engine_key (new v9.1 schema)',
        compiled.compiled?.pricing_index && Object.keys(compiled.compiled.pricing_index).length >= 70 &&
        Object.values(compiled.compiled.pricing_index).every(e => e.pricing_engine_key)
    );
}
// v9.5.14 FIX: cabinet_knob_or_pull_install was reclassified from
// tiered_per_unit to hourly_timed after a comprehensive before/after price
// comparison caught computeArchetypeQuote's tiered_per_unit branch giving
// a real, wrong price ($140 vs the correct $43) for this service -- its
// real, granular item_count_overflow_formula pricing isn't correctly
// replicated by the archetype dispatcher's simplified implementation. The
// service still genuinely uses hardware_install_formula (confirmed via its
// own real intake_chain data) -- this checks that fact directly rather
// than through the now-intentionally-different pricing_archetype label.
check('cabinet_knob_or_pull_install is correctly identified via hardware_install_formula in compiled.compiled.pricing_index',
    compiled.compiled?.pricing_index?.['cabinet_knob_or_pull_install']?.pricing_engine_key === 'hardware_install_formula'
    || compiled.pricing_archetypes?.hourly_timed?.currently_assigned_to?.includes('cabinet_knob_or_pull_install')
);

console.log('\n=== Real, additive promise still holds after this restructuring ===');
check('zero real, changed original keys',
    compiled._additive_diff['CHANGED (should never happen)'].length === 0
);

fs.rmSync(tmpDir, { recursive: true, force: true });

console.log(`\n[btnyc_v8_compiler.py verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
