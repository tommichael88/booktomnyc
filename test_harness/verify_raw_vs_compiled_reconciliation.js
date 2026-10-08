#!/usr/bin/env node
/**
 * verify_raw_vs_compiled_reconciliation.js
 *
 * Verifies the operator-directed "Issue 1" fix: btnyc.json's raw
 * `services`/`dynamic_services` entries must agree with the compiled
 * `compiled.service_index`/`candidate_matrix` in the same file. Two
 * confirmed instances were named directly: `angle_stop_replacement`
 * (raw had `hybrid_qty`, compiled had a stale `access`) and
 * `faucet_repair_drip` (raw had no `access`, compiled had one added).
 *
 * Root cause, confirmed directly: the `compiled` namespace had not
 * been regenerated since before this session's own `#45` (`access`
 * removed catalog-wide) -- it still referenced a module that no
 * longer exists anywhere else in the catalog.
 *
 * A third, real, previously-undetected bug was found while verifying
 * the fix, not assumed away: `plumbing_help+Install`'s own RAW source
 * data (not just the stale compiled cache) had two `then`-branch
 * target lists still naming `access` as a module to route to --
 * `#45`'s original removal checked authored `intake_chain` arrays and
 * `intake_defaults`, but never checked `then`-branch target lists.
 * Fixed at the source, not just in the regenerated compile.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.dirname(__dirname);
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(desc, cond) {
    if (cond) { pass++; console.log(`  \u2713 ${desc}`); }
    else { fail++; console.log(`  \u2717 ${desc}`); }
}

console.log('=== The two originally-named discrepancies are resolved ===');
{
    const angleStop = DB.services.find(s => s.id === 'angle_stop_replacement');
    const angleStopCompiled = DB.compiled.service_index['angle_stop_replacement'];
    check('angle_stop_replacement: raw and compiled intake_chain now agree',
        JSON.stringify(angleStop.intake_chain.map(s => s.module)) === JSON.stringify(angleStopCompiled.intake_chain.map(s => s.module)));
    check('angle_stop_replacement: compiled chain is hybrid_qty, not the old stale access',
        angleStopCompiled.intake_chain.map(s => s.module).includes('hybrid_qty') &&
        !angleStopCompiled.intake_chain.map(s => s.module).includes('access'));

    const faucetDrip = DB.services.find(s => s.id === 'faucet_repair_drip');
    const faucetDripCompiled = DB.compiled.service_index['faucet_repair_drip'];
    check('faucet_repair_drip: raw and compiled intake_chain now agree',
        JSON.stringify(faucetDrip.intake_chain.map(s => s.module)) === JSON.stringify(faucetDripCompiled.intake_chain.map(s => s.module)));
    check('faucet_repair_drip: compiled chain has no extra, unauthored access step',
        !faucetDripCompiled.intake_chain.map(s => s.module).includes('access'));
}

console.log('\n=== The real, previously-undetected bug found while verifying: dangling access references in then-branches ===');
{
    const plumbingInstall = DB.dynamic_services['plumbing_help+Install'];
    const fixtureStep = plumbingInstall.intake_chain.find(s => s.module === 'plumbing_fixture');
    check('"Sink or faucet" branch no longer targets the deleted access module',
        !fixtureStep.then['Sink or faucet'].includes('access'));
    check('"Sink or faucet" branch still correctly targets its two real, remaining modules',
        JSON.stringify(fixtureStep.then['Sink or faucet']) === JSON.stringify(['faucet_type', 'sink_type']));
    check('"Other (describe in notes)" branch no longer targets the deleted access module',
        !fixtureStep.then['Other (describe in notes)'].includes('access'));
}

console.log('\n=== Comprehensive, catalog-wide sweep: zero remaining dangling access references anywhere ===');
{
    let danglingCount = 0;
    const scan = (chain) => {
        for (const step of chain || []) {
            if (step.module === 'access') danglingCount++;
            for (const targets of Object.values(step.then || {})) {
                if (targets.includes('access')) danglingCount++;
            }
        }
    };
    for (const svc of DB.services) scan(svc.intake_chain);
    for (const dyn of Object.values(DB.dynamic_services)) scan(dyn.intake_chain);
    check(`zero dangling "access" references across all ${DB.services.length} services and ${Object.keys(DB.dynamic_services).length} dynamic_services (found ${danglingCount})`,
        danglingCount === 0);

    const compiledStr = JSON.stringify(DB.compiled);
    check('zero literal "access" strings anywhere in the compiled namespace', !compiledStr.includes('"access"'));
}

console.log('\n=== Full reconciliation: every real service agrees between raw and a freshly re-run compile ===');
{
    const freshOutPath = '/tmp/verify_fresh_compile_check.json';
    execFileSync('python3', [path.join(REPO_ROOT, 'btnyc_v10_compiler.py'), path.join(REPO_ROOT, 'btnyc.json'), freshOutPath]);
    const fresh = JSON.parse(fs.readFileSync(freshOutPath, 'utf8'));
    let disagreements = 0;
    for (const svc of DB.services) {
        const rawChain = svc.intake_chain.map(s => s.module);
        const freshChain = (fresh.compiled.service_index[svc.id]?.intake_chain || []).map(s => s.module);
        if (JSON.stringify(rawChain) !== JSON.stringify(freshChain)) disagreements++;
    }
    check(`zero raw-vs-fresh-compile disagreements across all ${DB.services.length} real services (found ${disagreements})`,
        disagreements === 0);
    fs.unlinkSync(freshOutPath);
}

console.log(`\n[raw vs compiled reconciliation, Issue 1] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
