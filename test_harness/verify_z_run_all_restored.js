#!/usr/bin/env node
/**
 * verify_z_run_all_restored.js
 *
 * Detects drift between test_harness/run_all.sh and test_harness/run_all.golden.
 * DOES NOT MODIFY EITHER FILE. Reports a mismatch as a real, failing check with
 * a real diff, and leaves the decision to a human -- same philosophy as
 * verify_file_integrity.js's hash precheck, which this deliberately mirrors
 * rather than duplicating with different (and, it turned out, riskier) logic.
 *
 * v9.5.3: replaces an earlier version of this file that, on any mismatch,
 * silently backed up and overwrote run_all.sh with run_all.golden's content
 * -- and always exited 0 regardless, so the overwrite could never surface as
 * a failure. Two concrete problems with that, both reproduced directly
 * before rewriting this:
 *
 *   1. Any legitimate, intentional edit to run_all.sh (this file's own
 *      history has had three in one session) gets silently discarded the
 *      next time the suite runs, unless run_all.golden happens to already
 *      have been regenerated in lockstep -- a real, repeatedly-demonstrated
 *      maintenance burden, not a hypothetical one.
 *   2. A check that can never fail, while performing a destructive file
 *      write as a side effect, is exactly the failure mode this project's
 *      own test culture (see TIMELINE.md) exists to catch in application
 *      code -- it shouldn't exist in the test harness itself.
 *
 * A verification suite should verify. If you want run_all.sh's current
 * state to become the new accepted baseline, do that explicitly:
 *     cp test_harness/run_all.sh test_harness/run_all.golden
 * If the drift is unexpected, that's exactly what this check existing is
 * for -- go look at what changed and why before deciding either way.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const RUN_ALL_PATH = path.join(__dirname, 'run_all.sh');
const GOLDEN_PATH = path.join(__dirname, 'run_all.golden');

function normalize(s) {
    return s.replace(/\r\n/g, '\n').trim();
}

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

if (!fs.existsSync(RUN_ALL_PATH)) {
    console.warn(`⚠️  ${RUN_ALL_PATH} not found.`);
    process.exit(1);
}

if (!fs.existsSync(GOLDEN_PATH)) {
    // No golden file yet is a legitimate first-time state, not a failure --
    // there's nothing to compare against. Say so plainly and pass, rather
    // than either fail on a file that was never created or silently invent
    // one no one asked for.
    console.log('ℹ️  No run_all.golden present -- nothing to compare against yet.');
    console.log(`   To start tracking drift: cp run_all.sh run_all.golden`);
    process.exit(0);
}

const golden = fs.readFileSync(GOLDEN_PATH, 'utf8');
const current = fs.readFileSync(RUN_ALL_PATH, 'utf8');
const matches = normalize(current) === normalize(golden);

check('run_all.sh matches run_all.golden (no undocumented drift)', matches);

if (!matches) {
    console.log('');
    console.log('  run_all.sh has changed since run_all.golden was last set. This is not');
    console.log('  auto-fixed -- decide which direction is correct:');
    console.log('');
    console.log('    Intentional change, should become the new baseline:');
    console.log('      cp test_harness/run_all.sh test_harness/run_all.golden');
    console.log('');
    console.log('    Unexpected drift, should be discarded:');
    console.log('      cp test_harness/run_all.golden test_harness/run_all.sh');
    console.log('');
    try {
        // Best-effort real diff for a human to read; entirely optional --
        // the check above has already correctly failed either way even if
        // `diff` isn't on PATH for some reason.
        const tmpGolden = path.join(require('os').tmpdir(), 'run_all.golden.tmp');
        fs.writeFileSync(tmpGolden, golden);
        const diffOut = execSync(`diff -u "${tmpGolden}" "${RUN_ALL_PATH}" || true`, { encoding: 'utf8' });
        console.log('  --- diff (golden vs current) ---');
        console.log(diffOut.split('\n').slice(0, 60).join('\n'));
    } catch (e) {
        console.log(`  (could not generate a diff for display: ${e.message})`);
    }
}

console.log(`\n[run_all.sh drift check] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
