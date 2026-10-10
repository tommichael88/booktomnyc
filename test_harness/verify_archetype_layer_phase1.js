#!/usr/bin/env node
/**
 * verify_archetype_layer_phase1.js
 *
 * Regression test for Track A Phase 1 (Entity -> Archetype -> Capability
 * hierarchy, per DEVELOPERS_CHECKLIST_ROADMAP_TO_SEESAW.md).
 *
 * Phase 1's own explicit requirements, each checked directly:
 *   1. Additive only -- nothing reads `archetypes` to alter behavior yet.
 *      The full test suite must be 100% unaffected.
 *   2. Real, evidence-derived defaults, not the checklist's illustrative
 *      examples copied verbatim -- every archetype's member_group_ids and
 *      default_routing_strategy were cross-referenced against the real,
 *      already-classified routing_archetypes data before being written.
 *   3. Complete coverage -- all 32 real groups with named services belong
 *      to exactly one archetype.
 *   4. An informational-only compiler check (build_archetype_mismatch_report)
 *      exists, runs, and never blocks/alters compilation.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.dirname(__dirname);
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

console.log('=== The archetypes block exists with the real, expected shape ===');
{
    check('archetypes exists as a real top-level key', typeof DB.archetypes === 'object' && DB.archetypes !== null);
    const names = Object.keys(DB.archetypes);
    check('9 real, evidence-derived archetypes exist (not 30, not the checklist\'s illustrative count)', names.length === 9);
    for (const name of names) {
        const a = DB.archetypes[name];
        check(`${name}: has all 5 required fields`, ['display_name', 'default_routing_strategy', 'default_confidence_strategy', 'typical_actions', 'member_group_ids'].every(f => f in a));
        check(`${name}: default_routing_strategy is a real, valid value`, ['component_first', 'symptom_first', 'action_first'].includes(a.default_routing_strategy));
    }
}

console.log('\n=== Complete, verified coverage: every real group with named services belongs to exactly one archetype ===');
{
    const allRealGroups = new Set();
    for (const s of DB.services) {
        const gid = s.ui_taxonomy?.group_id;
        if (gid) allRealGroups.add(gid);
    }
    const coverage = {};
    for (const [name, a] of Object.entries(DB.archetypes)) {
        for (const gid of a.member_group_ids) {
            coverage[gid] = (coverage[gid] || 0) + 1;
        }
    }
    check(`all ${allRealGroups.size} real groups are covered`, [...allRealGroups].every(g => coverage[g] === 1));
    check('no group is claimed by more than one archetype', Object.values(coverage).every(c => c === 1));
}

console.log('\n=== Zero real effect on pricing/routing -- the actual Phase 1 safety bar ===');
{
    const sandbox = { DB, SERVICE_DATA: DB, window: { DB } };
    sandbox.global = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(REPO_ROOT, 'pricing_engine.js'), 'utf8'), sandbox, { filename: 'pe' });

    const dbWithout = JSON.parse(JSON.stringify(DB));
    delete dbWithout.archetypes;
    const sandboxWithout = { DB: dbWithout, SERVICE_DATA: dbWithout, window: { DB: dbWithout } };
    sandboxWithout.global = sandboxWithout;
    vm.createContext(sandboxWithout);
    vm.runInContext(fs.readFileSync(path.join(REPO_ROOT, 'pricing_engine.js'), 'utf8'), sandboxWithout, { filename: 'pe2' });

    let diffs = 0;
    for (const svc of DB.services) {
        const svcWithout = dbWithout.services.find(s => s.id === svc.id);
        const q1 = sandbox.computeUnifiedQuote({ svc, activeTagIds: [], answers: {}, qty: 1 });
        const q2 = sandboxWithout.computeUnifiedQuote({ svc: svcWithout, activeTagIds: [], answers: {}, qty: 1 });
        if (q1.laborEstimate !== q2.laborEstimate) diffs++;
    }
    check('zero price divergences with vs. without the archetypes block present (confirms genuinely additive)', diffs === 0);
}

console.log('\n=== The compiler\'s informational mismatch check runs and produces real, explainable output ===');
{
    const tmpOut = '/tmp/archetype_phase1_test_output.json';
    execFileSync('python3', [path.join(REPO_ROOT, 'btnyc_v10_compiler.py'), path.join(REPO_ROOT, 'btnyc.json'), tmpOut]);
    const compiled = JSON.parse(fs.readFileSync(tmpOut, 'utf8'));
    const report = compiled._archetype_mismatch_report;
    check('the mismatch report exists in compiler output', typeof report === 'object');
    // v9.6+ FIX: was checking === 70. Confirmed directly against a fresh
    // compiler run (2026-08-28 recovery session): the real, live catalog
    // now has 74 real, named services (100% pricing_archetype coverage,
    // zero services_with_no_archetype) -- a stale count from catalog
    // growth since this test was written, not a regression. The actual
    // bar this check protects (complete coverage, checked on the next
    // line) still holds.
    check('every real, named service was checked (74)', report.real_services_checked === 74);
    check('zero services have no archetype (complete coverage confirmed via the compiler too)', report.services_with_no_archetype.length === 0);
    check('a real, non-trivial number of both matches and mismatches exist (confirms this is genuine signal, not a rubber stamp)',
        report.real_routing_matches > 40 && report.real_routing_mismatches.length > 5);
    check('the additive promise still holds after adding this new output key', compiled.services.length === DB.services.length);
    fs.unlinkSync(tmpOut);
}

console.log(`\n[Archetype layer Phase 1 verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
