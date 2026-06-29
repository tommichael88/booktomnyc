#!/usr/bin/env node
/**
 * verify_delegated_vocabulary_batch_3.js
 *
 * Regression test for the third delegated vocabulary batch (19
 * proposed entries) plus a severe, pre-existing regression found while
 * verifying it.
 *
 * MERGE DECISIONS:
 *   - 19 of 19 proposed entries reviewed; "lock" REJECTED as a pure
 *     duplicate of the existing "deadbolt" keyword (identical target
 *     service) -- its one new synonym ("lock install") folded into
 *     deadbolt instead.
 *   - "cable" merged with a corrected default_dynamic_category
 *     ("wall_mounting", not the proposed "tech_trouble" -- confirmed via
 *     direct check that cable_management's real ui_taxonomy.category_id
 *     is wall_mounting, a TV-cable-concealment service, distinct from
 *     the real, separate, named-service-less tech_trouble_cable_management
 *     GROUP).
 *   - "leak" merged WITHOUT a default_service_sku -- confirmed via
 *     direct test that the proposed default (leak_under_sink_repair)
 *     would misroute any non-sink leak (ceiling, wall, roof) that today
 *     honestly falls to the generic fallback instead.
 *
 * REAL REGRESSION FOUND AND FIXED (introduced by this batch):
 *   Adding "brick" with a redundant "brick wall" synonym let it
 *   outscore "mount"/"tv" for "mount a heavy tv on a brick wall" --
 *   confirmed via the existing verify_nlp_analyze_mode.js test, which
 *   caught this immediately on the first post-merge regression run.
 *   Fixed by removing the redundant synonym (already covered by the
 *   bare "brick" keyword match).
 *
 * SEVERE, PRE-EXISTING REGRESSION FOUND (NOT introduced by this batch,
 * but only discovered while re-verifying it): the original
 * washer/dishwasher word-boundary fix (several turns earlier) correctly
 * rejected substring-within-a-word matches, but ALSO accidentally
 * blocked every regular plural form catalog-wide ("doors" no longer
 * matched "door" at all). Fixed in all 3 real locations where this
 * helper is independently defined.
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
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocab3_check_'));
    const payloadPath = path.join(tmpDir, 'payload.json');
    fs.writeFileSync(payloadPath, JSON.stringify({ mode: 'analyze', text }));
    const stdout = execFileSync('node', [path.join(REPO_ROOT, 'cms_bridge.js'), payloadPath, path.join(REPO_ROOT, 'btnyc.json'), path.join(REPO_ROOT, 'qr.html')], { encoding: 'utf8' });
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return JSON.parse(stdout);
}

console.log('=== 17 of 19 new entries resolve correctly end-to-end (cable + leak checked separately below) ===');
const cases = [
    { phrase: 'fix my baseboards', key: 'baseboard', sku: 'baseboard_install', group: 'minor_home_repairs_floors_trim' },
    { phrase: 'I need a bidet installed', key: 'bidet', sku: 'bidet_attachment_install_or_removal', group: 'plumbing_help_toilets' },
    { phrase: 'I have a crack in my brick wall', key: 'brick', sku: 'brick_or_concrete_crack_repair', group: 'minor_home_repairs_walls' },
    { phrase: 'my drain is clogged', key: 'clog', sku: 'slow_drain_clearing', group: 'plumbing_help_showers_tubs' },
    { phrase: 'install a dimmer switch', key: 'dimmer', sku: 'dimmer_switch_install', group: 'electric_lighting_switches' },
    { phrase: 'I need a gfci outlet', key: 'gfci', sku: 'gfci_outlet_replacement', group: 'electric_lighting_outlets' },
    { phrase: 'ice maker water line', key: 'ice maker', sku: 'refrigerator_water_line_install', group: 'plumbing_help_water_lines' },
    { phrase: 'lathe and plaster repair', key: 'plaster', sku: 'plaster_wall_repair', group: 'minor_home_repairs_walls' },
    { phrase: 'set up my wifi router', key: 'router', sku: 'router_configuration', group: 'tech_trouble_networking' },
    { phrase: 'I need a smart plug', key: 'smart plug', sku: 'smart_plug_configuration', group: 'tech_trouble_smart_home' },
    { phrase: 'my floor is squeaky', key: 'squeaky', sku: 'squeaky_floor_repair', group: 'minor_home_repairs_floors_trim' },
    { phrase: 'watch tv mounting', key: 'tv', sku: 'flatscreen_mounting_standard', group: 'wall_mounting_tv_flatscreen' },
    { phrase: 'usb outlet install', key: 'usb', sku: 'usb_outlet_install', group: 'electric_lighting_outlets' },
    { phrase: 'remove a virus', key: 'virus', sku: 'virus_or_malware_removal', group: 'tech_trouble_computer_repair' },
    { phrase: 'my wifi has a dead zone', key: 'wifi', sku: 'wi_fi_extender_setup', group: 'tech_trouble_networking' },
    { phrase: 'set up my window ac', key: 'window ac', sku: 'window_ac_setup', group: 'minor_home_repairs_appliances_window_ac' },
    { phrase: 'mount a flatscreen tv', key: 'flatscreen', sku: 'flatscreen_mounting_standard', group: 'wall_mounting_tv_flatscreen' },
];
for (const c of cases) {
    const result = analyze(c.phrase);
    check(`"${c.phrase}" -> key=${c.key}`, result.intent.key === c.key);
    check(`"${c.phrase}" -> recommendedSku=${c.sku}`, result.intent.recommendedSku === c.sku);
    check(`"${c.phrase}" -> groupId=${c.group}`, result.groupId === c.group);
}

console.log('\n=== "lock" correctly REJECTED as a pure duplicate of "deadbolt" ===');
check('no "lock" keyword exists in the real, live catalog', !DB.intent_mappings.objects.some(o => o.keyword === 'lock'));
const deadbolt = DB.intent_mappings.objects.find(o => o.keyword === 'deadbolt');
check('deadbolt\'s synonyms include the one genuinely new word from the rejected entry ("lock install")', deadbolt.synonyms.includes('lock install'));

console.log('\n=== "cable" merged with a CORRECTED category, not the originally-proposed one ===');
const cable = DB.intent_mappings.objects.find(o => o.keyword === 'cable');
check('cable\'s default_dynamic_category is the real, correct "wall_mounting", not the proposed "tech_trouble"', cable.default_dynamic_category === 'wall_mounting');
{
    const result = analyze('I need help with my cable management');
    check('"cable management" correctly resolves to the real cable_management service', result.intent.recommendedSku === 'cable_management');
}

console.log('\n=== "leak" merged WITHOUT a forced default_service_sku ===');
const leak = DB.intent_mappings.objects.find(o => o.keyword === 'leak');
check('leak has no default_service_sku (deliberately omitted)', !leak.default_service_sku);
{
    const result = analyze('I have a leak in my ceiling');
    check('a non-sink leak still honestly falls to the generic fallback, not a misrouted specific service',
        result.intent.key === 'other' || !result.intent.recommendedSku);
}

console.log('\n=== Real regression (brick vs mount) found and fixed ===');
const brick = DB.intent_mappings.objects.find(o => o.keyword === 'brick');
check('the redundant "brick wall" synonym was removed from brick\'s synonym list', !brick.synonyms.includes('brick wall'));
{
    const result = analyze('mount a heavy tv on a brick wall in my living room');
    check('the original regression test scenario now correctly resolves to mount/flatscreen, not brick',
        result.intent.recommendedSku === 'flatscreen_mounting_standard');
}

console.log('\n=== SEVERE, pre-existing plural-form regression found and fixed (all 3 real locations) ===');
check('all 3 real word-boundary helpers allow an optional trailing s/es/ed/ing (extended further this session to also handle verb conjugations, not just plurals)',
    (QR_HTML.match(/\(\?:'\?s\|es\|ed\|ing\)\?/g) || []).length >= 3);
{
    const doorsResult = analyze('I need help with my doors');
    check('the real, common plural "doors" now correctly resolves to the door keyword (was completely broken, falling to the generic fallback)',
        doorsResult.intent.key === 'door');
}
{
    const washerResult = analyze('dishwasher is leaking water');
    check('the ORIGINAL fix (washer must not match inside dishwasher) still genuinely holds after the plural-form fix',
        washerResult.intent.recommendedSku === 'dishwasher_repair');
}
{
    const baseboardResult = analyze('fix my baseboards');
    check('the real, exact case that surfaced this regression (baseboards) now correctly resolves its groupId',
        baseboardResult.groupId === 'minor_home_repairs_floors_trim');
}

console.log(`\n[Delegated vocabulary batch 3 + plural-form regression verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
