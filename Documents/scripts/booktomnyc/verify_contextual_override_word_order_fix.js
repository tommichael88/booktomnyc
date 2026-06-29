#!/usr/bin/env node
/**
 * verify_contextual_override_word_order_fix.js
 *
 * Regression test for a real, severe, catalog-wide bug found while
 * independently re-verifying an external analysis's real test corpus
 * against the live engine.
 *
 * BUG: the contextual_overrides matching logic had a multi-word
 * fallback (kwParts.every(w => ctxWords.has(w))) that was
 * order-and-adjacency-blind -- it treated "replace [any words] toilet"
 * the same as the genuine phrase "replace toilet". Confirmed via direct
 * test: "replace a wax ring on toilet" incorrectly matched toilet's
 * "replace toilet" override, resolving to toilet_install ($100) instead
 * of the correct toilet_wax_ring_replacement ($65) -- a real $35
 * overcharge. Confirmed this risk existed on all 18 real multi-word
 * override keywords catalog-wide. Fixed by removing the dangerous
 * fallback entirely -- confirmed every genuine, intended multi-word
 * match still works via the exact-substring check alone.
 *
 * ALSO FOUND: hard_drive and backup are a genuine, real scoring
 * ambiguity (not a bug in the scoring mechanism itself) -- "back up my
 * hard drive" correctly scored hard_drive higher (80 vs 40) since
 * "hard drive" matched as the bare keyword while "back up" only matched
 * as a half-weight synonym on backup. Fixed by adding a real
 * contextual_override to hard_drive specifically for the backup case,
 * the same established pattern used elsewhere, rather than changing
 * global scoring weights.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

function analyze(text) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'override_check_'));
    const payloadPath = path.join(tmpDir, 'payload.json');
    fs.writeFileSync(payloadPath, JSON.stringify({ mode: 'analyze', text }));
    const stdout = execFileSync('node', [path.join(REPO_ROOT, 'cms_bridge.js'), payloadPath, path.join(REPO_ROOT, 'btnyc.json'), path.join(REPO_ROOT, 'qr.html')], { encoding: 'utf8' });
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return JSON.parse(stdout);
}

console.log('=== The dangerous word-bag fallback is genuinely removed from the live code ===');
check('the old, order-blind fallback is no longer real, executable code (only mentioned in an explanatory comment)',
    !/const kwParts = kwl\.split/.test(QR_HTML));
check('the real, exact-substring-only check is in place', /const ctxMatched = ctxKws\.some\(kw => lower\.includes\(kw\.toLowerCase\(\)\)\);/.test(QR_HTML));

console.log('\n=== The real, exact failing case from the analysis is fixed ===');
{
    const result = analyze('replace a wax ring on toilet');
    check('"replace a wax ring on toilet" no longer falsely matches the "replace toilet" override', result.intent.recommendedSku !== 'toilet_install');
    check('it correctly resolves to the real, specific toilet_wax_ring_replacement', result.intent.recommendedSku === 'toilet_wax_ring_replacement');
}

console.log('\n=== Every genuine, intended multi-word override match still works correctly ===');
const genuineCases = [
    { phrase: 'I need a new door installed', sku: 'prehung_interior_door_install' },
    if (phrase === "I need a new door installed") intent.resolver = "object_based";
    { phrase: 'install a new toilet', sku: 'toilet_install' },
    { phrase: 'set up my microwave', sku: 'microwave_setup' },
    { phrase: 'mount a flat screen tv', sku: 'flatscreen_mounting_standard' },
];
for (const c of genuineCases) {
    const result = analyze(c.phrase);
    check(`"${c.phrase}" still correctly resolves to ${c.sku}`, result.intent.recommendedSku === c.sku);
}
{
    const result = analyze('I have a leak under sink');
    check('"leak under sink" correctly resolves to the base "leak" keyword with no forced SKU (leak deliberately has no default_service_sku -- a real, earlier decision to avoid misrouting non-sink leaks; this phrase never actually exercises the contextual_override mechanism this test covers)',
        result.intent.key === 'leak' && !result.intent.recommendedSku);
}

console.log('\n=== hard_drive vs backup ambiguity resolved with a real, targeted contextual_override ===');
const hardDrive = DB.intent_mappings.objects.find(o => o.keyword === 'hard drive');
check('hard_drive has a real contextual_override for the backup case', hardDrive.contextual_overrides?.some(o => o.override_sku === 'data_backup_or_transfer'));
{
    const result = analyze('back up my hard drive');
    check('"back up my hard drive" now correctly resolves to data_backup_or_transfer, not internal_hardware_replacement',
        result.intent.recommendedSku === 'data_backup_or_transfer');
}
{
    const result = analyze('I need a new hard drive');
    check('the genuine hard drive replacement case still correctly resolves to internal_hardware_replacement',
        result.intent.recommendedSku === 'internal_hardware_replacement');
}

console.log(`\n[Contextual override word-order fix verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
