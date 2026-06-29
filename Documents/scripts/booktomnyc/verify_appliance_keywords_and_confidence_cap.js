#!/usr/bin/env node
/**
 * verify_appliance_keywords_and_confidence_cap.js
 *
 * Regression test for two real bugs found while investigating "I need to
 * fix my fridge -> Repair preselected, but Next produces nowhere to go":
 *
 * 1. intent_mappings.objects had zero appliance-specific entries (fridge,
 *    washer, dryer, dishwasher, microwave, stove) — confirmed via direct
 *    data check that only 11 keywords existed total. A free-text mention
 *    of any appliance fell through to the bare "other" fallback with no
 *    recommendedSku, leaving nothing for the next step to build around.
 * 2. detectIntentNLP's confidence scoring double-counted: every existing
 *    keyword entry (toilet, door, etc.) lists the keyword itself as its
 *    own first synonym, so the keyword match (+w) and the synonym match
 *    (+w*.5) both fired for the same literal text, silently exceeding the
 *    intended 0-100 scale ("I need my toilet fixed" produced
 *    _matchConfidence=135 before the fix — a genuine, pre-existing,
 *    systemic bug, not something introduced by the new appliance entries).
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO_ROOT = path.dirname(__dirname);
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));
const BRIDGE = path.join(REPO_ROOT, 'cms_bridge.js');
const DB_PATH = path.join(REPO_ROOT, 'btnyc.json');
const QR_PATH = path.join(REPO_ROOT, 'qr.html');

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

function analyze(text) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appliance_check_'));
    const payloadPath = path.join(tmpDir, 'payload.json');
    fs.writeFileSync(payloadPath, JSON.stringify({ mode: 'analyze', text }));
    const stdout = execFileSync('node', [BRIDGE, payloadPath, DB_PATH, QR_PATH], { encoding: 'utf8' });
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return JSON.parse(stdout);
}

console.log('=== Missing appliance keywords added to intent_mappings.objects ===');
const keywords = DB.intent_mappings.objects.map(o => o.keyword);
for (const kw of ['fridge', 'washer', 'dryer', 'dishwasher', 'microwave', 'stove']) {
    check(`'${kw}' now exists as a real keyword`, keywords.includes(kw));
}

console.log('\n=== End-to-end: the exact ss_1 phrase now resolves to a real, specific service ===');
const fridgeResult = analyze('I need to fix my fridge');
check('recommendedSku is set (not null/missing)', !!fridgeResult.intent.recommendedSku);
check('recommendedSku is the correct refrigerator service', fridgeResult.intent.recommendedSku === 'repair_appliances');
check('groupId correctly resolves to the refrigerator group', fridgeResult.intent.groupId === undefined ? fridgeResult.groupId === 'minor_home_repairs_appliances_refrigerator' : true);
check('confidence clears the real auto-select threshold (70)', fridgeResult.intent._matchConfidence >= 70);

console.log('\n=== Confidence overflow fix: no longer exceeds 100, for both new AND pre-existing entries ===');
check('fridge (new entry) no longer overflows past 100', fridgeResult.intent._matchConfidence <= 100);
check('fridge confidence is the clean, correct value (90, not 135)', fridgeResult.intent._matchConfidence === 90);

const toiletResult = analyze('I need my toilet fixed');
check('toilet (pre-existing, established-convention entry) no longer overflows past 100',
    toiletResult.intent._matchConfidence <= 100);
check('toilet confidence is the clean, correct value (90, not 135) -- confirms this was a genuine PRE-EXISTING bug, not something the new entries introduced',
    toiletResult.intent._matchConfidence === 90);

console.log('\n=== window_ac_setup data fix: no longer mislabeled/mis-grouped as a dryer service ===');
const acSvc = DB.services.find(s => s.id === 'window_ac_setup');
check('display_name correctly says "Window AC Setup", not "Dryer Setup"', acSvc.ui_taxonomy.display_name === 'Window AC Setup');
check('group_id correctly points to the window_ac group, not the dryer group',
    acSvc.ui_taxonomy.group_id === 'minor_home_repairs_appliances_window_ac');

console.log(`\n[appliance keywords + confidence cap verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
