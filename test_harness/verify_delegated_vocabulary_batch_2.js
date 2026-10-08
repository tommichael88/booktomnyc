#!/usr/bin/env node
/**
 * verify_delegated_vocabulary_batch_2.js
 *
 * Regression test for the second delegated vocabulary batch. Of 7
 * proposed entries, 4 merged as new keywords (light bulb, furniture
 * assembly, mirror, shelf), 1 folded into an existing keyword rather
 * than duplicated (blinds -> curtain rod, since both pointed at the
 * identical real service), and 2 REJECTED after verification:
 *
 *   - "appliance" -> repair_appliances: confirmed via direct check that
 *     this service's real ui_taxonomy is "Refrigerator Repair" /
 *     minor_home_repairs_appliances_refrigerator -- a generic "my
 *     appliance is broken" entry pointing here would misroute every
 *     non-fridge appliance complaint. The REAL, current baseline
 *     behavior (falls to the honest generic fallback, but with groupId
 *     already correctly resolving to the real, generic
 *     minor_home_repairs_appliances parent group) is more correct than
 *     what was proposed.
 *   - "painting" -> wall_hole_or_crack_repair: confirmed via direct
 *     check of the real intake_chain that this service is about wall
 *     DAMAGE (holes/cracks), never paint color, coverage, or finish.
 *     Confirmed no real, dedicated painting service exists anywhere in
 *     the catalog -- this is a genuine content gap, not a
 *     keyword-routing bug, and forcing a wrong match would be worse
 *     than the honest current fallback.
 *
 * Also found and fixed a real, PRE-EXISTING data inconsistency while
 * verifying "light bulb" (not caused by this batch): "bulb" appeared in
 * TWO real rule sets with two different group assignments
 * (resolveGroupFromIntent's cross-category rules sent it to
 * light_fixtures; the per-category rules correctly sent it to the
 * dedicated electric_lighting_bulbs group). Removed the less-precise
 * cross-category entry.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');

const REPO_ROOT = path.dirname(__dirname);
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

function analyze(text) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocab2_check_'));
    const payloadPath = path.join(tmpDir, 'payload.json');
    fs.writeFileSync(payloadPath, JSON.stringify({ mode: 'analyze', text }));
    const stdout = execFileSync('node', [path.join(REPO_ROOT, 'cms_bridge.js'), payloadPath, path.join(REPO_ROOT, 'btnyc.json'), path.join(REPO_ROOT, 'qr.html')], { encoding: 'utf8' });
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return JSON.parse(stdout);
}

console.log('=== 4 new entries merged, all resolve correctly end-to-end ===');
const cases = [
    { phrase: 'I need a new light bulb', key: 'light bulb', sku: 'led_bulb_upgrade', group: 'electric_lighting_bulbs' },
    { phrase: 'furniture assembly help', key: 'furniture assembly', sku: 'furniture_assembly_flat_pack', group: 'furniture_fixes_assembly_assembly' },
    { phrase: 'hang a mirror', key: 'mirror', sku: 'shelf_mounting_standard_buy_the_hour', group: 'wall_mounting_frames_shelves' },
    { phrase: 'I need a shelf mounted', key: 'mount', sku: 'shelf_mounting_standard_buy_the_hour', group: 'wall_mounting_frames_shelves' },
];
for (const c of cases) {
    const result = analyze(c.phrase);
    check(`"${c.phrase}" -> key=${c.key}`, result.intent.key === c.key);
    check(`"${c.phrase}" -> recommendedSku=${c.sku}`, result.intent.recommendedSku === c.sku);
    check(`"${c.phrase}" -> groupId=${c.group}`, result.groupId === c.group);
}

console.log('\n=== "blinds" was folded into curtain rod, not duplicated ===');
check('"blinds" is not a separate top-level keyword', !DB.intent_mappings.objects.some(o => o.keyword === 'blinds'));
const curtainRod = DB.intent_mappings.objects.find(o => o.keyword === 'curtain rod');
check('curtain rod\'s synonyms now include the real blinds-related words', ['blinds', 'blind', 'window blinds', 'shades'].every(s => curtainRod.synonyms.includes(s)));
check('"I need to fix some blinds" correctly resolves through curtain rod to the shared, correct real service',
    analyze('I need to fix some blinds').intent.recommendedSku === 'blinds_shades_curtains_buy_the_hour');

console.log('\n=== "appliance" was correctly REJECTED, not merged ===');
check('no "appliance" keyword exists in the real, live catalog', !DB.intent_mappings.objects.some(o => o.keyword === 'appliance'));
{
    const result = analyze('my appliance is broken');
    check('the real, current fallback for a generic appliance complaint correctly resolves to the GENERIC parent group, not the fridge-specific one',
        result.groupId === 'minor_home_repairs_appliances');
}

console.log('\n=== "painting" was correctly REJECTED, not merged ===');
check('no "painting" keyword exists in the real, live catalog', !DB.intent_mappings.objects.some(o => o.keyword === 'painting'));
check('no real, dedicated painting service exists anywhere in the catalog (confirming this is a genuine content gap, not a routing bug)',
    !DB.services.some(s => s.ui_taxonomy.display_name.toLowerCase().includes('paint')));

console.log('\n=== Real, pre-existing "bulb" group-routing inconsistency found and fixed ===');
const QR_HTML = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
check('the cross-category rule set no longer sends "bulb" to the less-precise light_fixtures group',
    !/keywords: \['light','fixture','chandelier','pendant','sconce','bulb'\]/.test(QR_HTML));
check('the per-category rule correctly still sends bulb to the dedicated electric_lighting_bulbs group',
    /keywords: \['bulb','light bulb','lamp'\], group: 'electric_lighting_bulbs'/.test(QR_HTML));

console.log(`\n[Delegated vocabulary batch 2 verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
