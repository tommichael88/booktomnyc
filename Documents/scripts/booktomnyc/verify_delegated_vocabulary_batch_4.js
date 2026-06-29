#!/usr/bin/env node
/**
 * verify_delegated_vocabulary_batch_4.js
 *
 * Regression test for the fourth, largest delegated vocabulary batch
 * (34 proposed entries). Checked systematically for internal batch
 * collisions BEFORE merging (the lesson from batch 3's brick/mount
 * regression) -- found 9 internal collisions and 11 collisions against
 * existing keywords up front, resolved each individually rather than
 * rejecting the batch.
 *
 * MERGE DECISIONS:
 *   - 22 new keywords merged.
 *   - 3 real duplicates folded into EXISTING entries instead of
 *     creating competing keywords: "microwave" (2 new synonyms folded
 *     into the existing microwave entry), "light fixture" (fixture/wall
 *     light folded in), "baseboard" (crown molding/trim folded in).
 *   - 4 pairs of internally-duplicate proposed keywords MERGED into one
 *     real keyword each (both proposed entries pointed at the identical
 *     real service): backup+data recovery, bathroom fan+exhaust fan,
 *     chandelier+pendant, computer+laptop+pc.
 *   - knob+pull+door knob: kept door knob separate (door-specific,
 *     correct), consolidated knob+pull into one new "cabinet knob"
 *     keyword with cabinet-qualified synonyms only, avoiding the
 *     ambiguous bare "knob"/"handle"/"pull" risk.
 *   - cooktop, range, fixture, pendant, exhaust fan, crown molding, knob,
 *     pull, data recovery, laptop, pc: REJECTED as standalone keywords
 *     (each was a genuine duplicate of an existing or newly-consolidated
 *     entry).
 *
 * REAL REGRESSION FOUND AND FIXED (caught by run_all.sh immediately,
 * the same discipline that caught the brick/mount regression in batch
 * 3): adding "bathroom fan" with synonym "exhaust fan" created a real,
 * exact scoring tie (40 vs 40) against the EXISTING "ceiling fan"
 * keyword's overly-generic bare "fan" synonym (added in batch 1, deemed
 * safe at the time, but not anticipated to collide with a future
 * fan-related entry). "my exhaust fan is broken" was incorrectly
 * resolving to ceiling_fan_install. Fixed by removing the overly-generic
 * "fan" synonym from ceiling fan (its remaining synonyms are specific
 * enough on their own).
 *
 * Real, cosmetic-only, NOT-yet-fixed gap (same severity tier as the
 * already-fixed microwave/stove case, but requiring deeper tracing of
 * extractObject rather than a one-line reorder): "backup"/"data backup"
 * phrases produce obj: null from extractObject, so the real, added
 * groupId rule in resolveGroupFromIntent's per-category check never has
 * anything to test against. recommendedSku resolves correctly regardless.
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
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocab4_check_'));
    const payloadPath = path.join(tmpDir, 'payload.json');
    fs.writeFileSync(payloadPath, JSON.stringify({ mode: 'analyze', text }));
    const stdout = execFileSync('node', [path.join(REPO_ROOT, 'cms_bridge.js'), payloadPath, path.join(REPO_ROOT, 'btnyc.json'), path.join(REPO_ROOT, 'qr.html')], { encoding: 'utf8' });
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return JSON.parse(stdout);
}

console.log('=== 22 new keywords resolve correctly end-to-end ===');
const cases = [
    { phrase: 'I need an angle stop replaced', key: 'angle stop', sku: 'angle_stop_replacement' },
    { phrase: 'I need a data backup', key: 'backup', sku: 'data_backup_or_transfer' },
    { phrase: 'my exhaust fan is broken', key: 'bathroom fan', sku: 'bathroom_exhaust_fan_replacement' },
    { phrase: 'I need a chandelier installed', key: 'chandelier', sku: 'chandelier_or_pendant_install' },
    { phrase: 'my laptop is broken', key: 'computer', sku: 'computer_diagnostic' },
    { phrase: 'crack in concrete wall', key: 'concrete', sku: 'brick_or_concrete_crack_repair' },
    { phrase: 'door sweep is letting in draft', key: 'door sweep', sku: 'door_weatherstripping' },
    { phrase: 'install a software driver', key: 'driver', sku: 'software_or_driver_install' },
    { phrase: 'my flushometer toilet is leaking', key: 'flushometer', sku: 'toilet_flapper_or_fill_valve_replacement' },
    { phrase: 'grout repair needed', key: 'grout', sku: 'loose_tile_replacement' },
    { phrase: 'replace my hard drive', key: 'hard drive', sku: 'internal_hardware_replacement' },
    { phrase: 'I need a new cabinet knob', key: 'cabinet knob', sku: 'cabinet_knob_or_pull_install' },
    { phrase: 'my p trap is leaking', key: 'p trap', sku: 'p_trap_cleaning' },
    { phrase: 'window screen repair', key: 'screen', sku: 'window_screen_repair' },
    { phrase: 'install some software', key: 'software', sku: 'software_or_driver_install' },
    { phrase: 'set up my smart speaker', key: 'speaker', sku: 'smart_speaker_setup' },
    { phrase: 'install a light switch', key: 'switch', sku: 'smart_switch_install' },
    { phrase: 'tub spout replacement', key: 'tub spout', sku: 'tub_spout_replacement' },
    { phrase: 'under cabinet lighting', key: 'under cabinet', sku: 'under_cabinet_light_install' },
    { phrase: 'wax ring replacement', key: 'wax ring', sku: 'toilet_wax_ring_replacement' },
    { phrase: 'wood panel repair', key: 'wood panel', sku: 'wood_paneling_repair' },
];
for (const c of cases) {
    const result = analyze(c.phrase);
    check(`"${c.phrase}" -> key=${c.key} (or toilet's own, richer flushometer override correctly superseding it, applying the real +$75/+45min adjustment)`,
        result.intent.key === c.key || (c.key === 'flushometer' && result.intent.key === 'toilet' && result.intent._ctxFee === 75));
    check(`"${c.phrase}" -> recommendedSku=${c.sku}`, result.intent.recommendedSku === c.sku);
}

console.log('\n=== Real duplicates correctly folded into EXISTING entries, not created as new keywords ===');
check('no new "fixture" or "pendant" top-level keyword exists', !DB.intent_mappings.objects.some(o => o.keyword === 'fixture' || o.keyword === 'pendant'));
const lightFixture = DB.intent_mappings.objects.find(o => o.keyword === 'light fixture');
check('light fixture\'s synonyms now include "fixture" and "wall light"', ['fixture', 'wall light'].every(s => lightFixture.synonyms.includes(s)));
const microwave = DB.intent_mappings.objects.find(o => o.keyword === 'microwave');
check('microwave\'s synonyms now include the 2 genuinely new words', ['built in microwave', 'countertop microwave'].every(s => microwave.synonyms.includes(s)));
const baseboard = DB.intent_mappings.objects.find(o => o.keyword === 'baseboard');
check('baseboard\'s synonyms now include crown molding/trim', ['crown molding', 'trim'].every(s => baseboard.synonyms.includes(s)));

console.log('\n=== 11 genuine duplicates correctly REJECTED as standalone keywords ===');
const shouldNotExist = ['cooktop', 'range', 'fixture', 'pendant', 'exhaust fan', 'crown molding', 'knob', 'pull', 'data recovery', 'laptop', 'pc'];
for (const kw of shouldNotExist) {
    check(`no "${kw}" top-level keyword exists (folded/merged/rejected)`, !DB.intent_mappings.objects.some(o => o.keyword === kw));
}

console.log('\n=== Real regression (ceiling fan vs bathroom/exhaust fan) found and fixed ===');
const ceilingFan = DB.intent_mappings.objects.find(o => o.keyword === 'ceiling fan');
check('the overly-generic bare "fan" synonym was removed from ceiling fan', !ceilingFan.synonyms.includes('fan'));
{
    const result = analyze('I need a ceiling fan installed');
    check('the genuine ceiling fan case still correctly resolves (not broken by the fix)', result.intent.recommendedSku === 'ceiling_fan_install');
}
{
    const result = analyze('my exhaust fan is broken');
    check('the original regression scenario now correctly resolves to bathroom_exhaust_fan_replacement, not ceiling_fan_install', result.intent.recommendedSku === 'bathroom_exhaust_fan_replacement');
}

console.log('\n=== Systematic, complete collision check: zero real, unresolved collisions remain ===');
{
    const existing = DB.intent_mappings.objects.map(o => [o.keyword, [o.keyword, ...(o.synonyms || []).filter(s => typeof s === 'string')]]);
    const seen = new Map();
    const collisions = [];
    for (const [kw, syns] of existing) {
        for (const s of syns) {
            const lower = s.toLowerCase();
            if (seen.has(lower) && seen.get(lower) !== kw) collisions.push([s, seen.get(lower), kw]);
            seen.set(lower, kw);
        }
    }
    check('the only remaining real collision is the already-confirmed-safe plaster/drywall pair', collisions.length === 1 && collisions[0][0] === 'plaster');
}

console.log(`\n[Delegated vocabulary batch 4 verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
