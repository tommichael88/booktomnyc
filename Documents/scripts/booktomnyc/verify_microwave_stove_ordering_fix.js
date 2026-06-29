#!/usr/bin/env node
/**
 * verify_microwave_stove_ordering_fix.js
 *
 * Regression test closing backlog item U.1: resolveGroupFromIntent's
 * array-order tie-break let "stove"'s broader "oven" keyword win over
 * "microwave"'s more specific keyword for phrases mentioning both (e.g.
 * "microwave oven"). Fixed by reordering microwave's rule before
 * stove's.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');

const REPO_ROOT = path.dirname(__dirname);

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

function analyze(text) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'micro_check_'));
    const payloadPath = path.join(tmpDir, 'payload.json');
    fs.writeFileSync(payloadPath, JSON.stringify({ mode: 'analyze', text }));
    const stdout = execFileSync('node', [path.join(REPO_ROOT, 'cms_bridge.js'), payloadPath, path.join(REPO_ROOT, 'btnyc.json'), path.join(REPO_ROOT, 'qr.html')], { encoding: 'utf8' });
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return JSON.parse(stdout);
}

console.log('=== "microwave oven" now correctly resolves to the microwave group, not stove_range ===');
{
    const result = analyze('microwave oven is broken');
    check('groupId correctly resolves to minor_home_repairs_appliances_microwave', result.groupId === 'minor_home_repairs_appliances_microwave');
}

console.log('\n=== The genuine, no-microwave oven case still correctly resolves to stove_range ===');
{
    const result = analyze("my oven won't heat up");
    check('groupId correctly resolves to minor_home_repairs_appliances_stove_range', result.groupId === 'minor_home_repairs_appliances_stove_range');
}

console.log(`\n[Microwave/stove ordering fix verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
