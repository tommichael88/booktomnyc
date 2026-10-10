#!/usr/bin/env node
/**
 * verify_smart_tag_reference_pathway.js
 *
 * Verifies the PENDING_DECISIONS.md #35 fix to btnyc_master_deprecated.py's
 * orphan-module checker: a smart_tag's own `answers` field synthesizes an
 * answer for a module directly (e.g. #no_parking -> {parking_difficulty:
 * "..."}) without that module ever appearing in any service's
 * intake_chain or in intake_defaults -- a third, real, previously
 * unchecked reference pathway. parking_difficulty and item_volume were
 * being falsely flagged as orphans before this fix, despite being
 * genuinely live (and covered by verify_answer_supersedes_nlp_tag.js's
 * own real test coverage).
 */
const { execFileSync } = require('child_process');
const path = require('path');

let pass = 0, fail = 0;
function check(desc, cond) {
    if (cond) { pass++; console.log(`  \u2713 ${desc}`); }
    else { fail++; console.log(`  \u2717 ${desc}`); }
}

const REPO_ROOT = path.dirname(__dirname);
let output;
try {
    execFileSync('python3', [path.join(REPO_ROOT, 'btnyc_master_deprecated.py'), path.join(REPO_ROOT, 'btnyc.json'), '--validate']);
    output = '';
} catch (e) {
    // --validate exits non-zero when warnings are present; stdout still has the real content.
    output = (e.stdout || '').toString();
}
if (!output) {
    output = execFileSync('python3', [path.join(REPO_ROOT, 'btnyc_master_deprecated.py'), path.join(REPO_ROOT, 'btnyc.json'), '--validate']).toString();
}

console.log('=== The real, previously-false positives no longer flag ===');
check('parking_difficulty is NOT flagged as an orphan (genuinely referenced via #no_parking\'s smart_tag answers)',
    !output.includes("'parking_difficulty' is defined but never referenced"));
check('item_volume is NOT flagged as an orphan (genuinely referenced via #high_volume\'s smart_tag answers)',
    !output.includes("'item_volume' is defined but never referenced"));

console.log('\n=== Regression: pets_present and disposal_request remain correctly unflagged (resolved by earlier, separate fixes) ===');
check('pets_present is not flagged (module deleted entirely, T118 #45)', !output.includes("'pets_present' is defined but never referenced"));
check('disposal_request is not flagged (now a real group default, T118 #45)', !output.includes("'disposal_request' is defined but never referenced"));

console.log('\n=== T119/T120: 5 of the 6 previously-genuinely-orphaned modules are correctly wired in; install_target correctly reverted ===');
// PENDING_DECISIONS.md #35's own remaining finding -- appliance_type,
// floor_type, hardware_type, install_target, leak_loc, washer_type --
// were each wired into a real, specific service. T120 correction:
// install_target's fit was confirmed wrong (6 of 8 options don't
// belong on a wall-mounting service, no pricing mechanism on any
// option) and reverted back to orphaned rather than left half-fixed.
// T123 (external catalog audit, Issue 2a): wired again, correctly this
// time -- into the bare minor_home_repairs+Install dynamic_service
// fallback, a genuine, multi-category catch-all this module's own
// broad option set (fixture/appliance, outlet/switch, light bulb,
// faucet/shower head, TV/wall mount, shelf/artwork, door/window
// hardware) actually fits, unlike the single, narrow wall-mounting
// service it was wrongly forced onto in T119.
const nowWired = ['appliance_type', 'floor_type', 'hardware_type', 'leak_loc', 'washer_type', 'install_target'];
for (const mod of nowWired) {
    check(`${mod} is no longer flagged as an orphan (wired into a real service or dynamic_service)`,
        !output.includes(`'${mod}' is defined but never referenced`));
}

console.log('\n=== Regression guard: a genuinely, fully unreferenced module still correctly flags ===');
// T119: the catalog's own real orphans were all resolved this session
// (the 6 above, plus pets_present/disposal_request earlier), so this
// guard no longer has a real, naturally-occurring example to point at.
// Uses a synthetic module on a cloned, temporary copy of btnyc.json
// instead, so this regression guard doesn't silently stop meaning
// anything the next time every real orphan happens to get resolved.
const fs = require('fs');
const os = require('os');
const db = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));
db.intake_modules['__t119_synthetic_orphan_test__'] = { question: 'Synthetic, never-referenced test module', type: 'single', client_response: [{ label: 'A' }] };
const tmpPath = path.join(os.tmpdir(), `btnyc_synthetic_orphan_${Date.now()}.json`);
fs.writeFileSync(tmpPath, JSON.stringify(db));
let synthOutput;
try {
    execFileSync('python3', [path.join(REPO_ROOT, 'btnyc_master_deprecated.py'), tmpPath, '--validate']);
    synthOutput = '';
} catch (e) {
    synthOutput = (e.stdout || '').toString();
}
fs.unlinkSync(tmpPath);
check('a synthetic module referenced by nothing at all is still correctly flagged as an orphan',
    synthOutput.includes("'__t119_synthetic_orphan_test__' is defined but never referenced"));

console.log(`\n[smart_tag reference pathway, #35] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
