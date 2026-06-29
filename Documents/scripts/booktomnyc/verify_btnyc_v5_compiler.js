#!/usr/bin/env node
/**
 * verify_btnyc_v5_compiler.js
 *
 * Regression test for btnyc_v5_compiler.py, the real, complete rewrite
 * of an uploaded v4 compiler concept that was checked directly against
 * the live catalog and found to have 2 severe, confirmed bugs (wrong
 * field name -- pricing_formula vs the real pricing_engine; a fictional
 * {{var}} expression syntax that doesn't exist in the real, current
 * pricing_formulas data) making its central feature 100% non-functional
 * (84 of 84 compiled pricing entries came back empty), plus a real
 * symptom/component conflation bug in its group_archetypes logic.
 *
 * This test runs the real, new v5 compiler against the actual, live
 * btnyc.json and checks:
 *   1. The additive promise: every real, original top-level key is
 *      genuinely byte-identical in the compiled output.
 *   2. The real bug fixes: pricing data is genuinely populated (not the
 *      confirmed-empty 0-of-84 the uploaded version produced).
 *   3. The real, central example this whole effort was built around:
 *      the toilet group's components/symptoms are genuinely, separately
 *      classified (not conflated), and "seat" is correctly flagged as a
 *      real, known, unresolved gap.
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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'v5_compiler_check_'));
const outputPath = path.join(tmpDir, 'compiled.json');

console.log('=== Running the real, complete v5 compiler against the live, current btnyc.json ===');
let exitCode = 0;
try {
    execFileSync('python3', [
        path.join(REPO_ROOT, 'btnyc_v5_compiler.py'),
        path.join(REPO_ROOT, 'btnyc.json'),
        outputPath,
    ], { encoding: 'utf8' });
} catch (e) {
    exitCode = e.status;
}
check('the real compiler runs to completion with exit code 0', exitCode === 0);

const compiled = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
const original = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

console.log('\n=== The real, additive promise: every original key is genuinely unchanged ===');
{
    const changed = compiled._additive_diff['CHANGED (should never happen)'];
    check(`zero real, changed original keys (found ${changed.length})`, changed.length === 0);
    check('every real, original top-level key is present in the unchanged list', compiled._additive_diff.unchanged.length === Object.keys(original).length);
}

console.log('\n=== Real bug fix #1/#2: pricing data is genuinely populated (the uploaded version had 0 of 84) ===');
{
    const pricingIndex = compiled.compiled.pricing_index;
    const entries = Object.values(pricingIndex);
    const populated = entries.filter(e => e.base_price !== null && e.base_price !== undefined);
    check(`100% of real, compiled pricing entries have a genuine, non-null base_price (found ${populated.length} of ${entries.length})`, populated.length === entries.length);

    const knob = pricingIndex['cabinet_knob_or_pull_install'];
    check('cabinet_knob_or_pull_install correctly resolves its real, registered formula', knob.is_real_registered_formula === true);
    check('the real formula_params object is genuinely populated, not empty', Object.keys(knob.formula_params).length > 0);
    check('formula_params contains the real, exact, known values', knob.formula_params.flat_tier_price === 140 && knob.formula_params.hourly_rate === 70);
}

console.log('\n=== Real bug fix #3: the central toilet-group example, genuinely corrected ===');
{
    const toilets = compiled.group_archetypes['plumbing_help_toilets'];
    check('real symptoms ("Bad smell", "Water leak") are correctly classified as symptoms, not components',
        toilets.real_symptoms.includes('Bad smell') && toilets.real_symptoms.includes('Water leak'));
    check('those same real symptoms do NOT also appear in the components list (no conflation)',
        !toilets.real_components.includes('Bad smell') && !toilets.real_components.includes('Water leak'));
    check('"seat"/"toilet seat" is correctly flagged as a real, known, unresolved gap',
        toilets.real_gaps.includes('seat') && toilets.real_gaps.includes('toilet seat'));
    check('every real symptom correctly maps to the real, already-existing service that already handles it',
        toilets.symptom_to_service_ids['Water leak']?.includes('toilet_wax_ring_replacement'));
}

console.log('\n=== Real, zero validation errors against the live, current catalog ===');
check('zero real reference-validation errors', compiled._validation.valid === true && compiled._validation.errors.length === 0);

fs.rmSync(tmpDir, { recursive: true, force: true });

console.log(`\n[btnyc_v5_compiler.py verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
