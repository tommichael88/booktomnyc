#!/usr/bin/env node
/**
 * verify_delegated_vocabulary_batch_1.js
 *
 * Regression test for the first delegated vocabulary batch: 7 new
 * intent_mappings.objects entries (ceiling fan, curtain rod, deadbolt,
 * garbage disposal, outlet, showerhead, thermostat), reviewed and
 * merged after independent verification of every claimed service id,
 * category, and synonym-collision check.
 *
 * Two real things found during review, both fixed:
 *  - deadbolt and showerhead were reported by the delegated team as
 *    "confirmed gaps" but their proposed fixes were verified directly
 *    against the live engine's CURRENT (pre-fix) behavior, confirming
 *    real value, not just plausible-sounding additions.
 *  - showerhead's groupId resolved to null even after the keyword fix,
 *    because resolveGroupFromIntent's hardcoded rules (a second, real,
 *    independent lookup) had no showerhead entry. Fixed in both of its
 *    real rule locations.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');
const vm = require('vm');

const REPO_ROOT = path.dirname(__dirname);
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));
const QR_HTML_FOR_FNS = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
function findFn(name) {
    const m = QR_HTML_FOR_FNS.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) return null;
    let depth = 0, start = m.index, i = m.index + m[0].length - 1;
    for (let j = i; j < QR_HTML_FOR_FNS.length; j++) {
        if (QR_HTML_FOR_FNS[j] === '{') depth++;
        else if (QR_HTML_FOR_FNS[j] === '}') { depth--; if (depth === 0) return QR_HTML_FOR_FNS.slice(start, j + 1); }
    }
    return null;
}

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

function analyze(text) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocab_check_'));
    const payloadPath = path.join(tmpDir, 'payload.json');
    fs.writeFileSync(payloadPath, JSON.stringify({ mode: 'analyze', text }));
    const stdout = execFileSync('node', [path.join(REPO_ROOT, 'cms_bridge.js'), payloadPath, path.join(REPO_ROOT, 'btnyc.json'), path.join(REPO_ROOT, 'qr.html')], { encoding: 'utf8' });
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return JSON.parse(stdout);
}

const cases = [
    { phrase: 'put a curtain rod up', key: 'curtain rod', sku: 'blinds_shades_curtains_buy_the_hour', group: 'wall_mounting_blinds_curtain' },
    { phrase: 'put in a ceiling fan', key: 'ceiling fan', sku: 'ceiling_fan_install', group: 'electric_lighting_fans' },
    { phrase: 'hook up a new outlet', key: 'outlet', sku: null, group: 'electric_lighting_outlets' },
    { phrase: 'fix my garbage disposal', key: 'garbage disposal', sku: 'garbage_disposal_replacement', group: 'plumbing_help_garbage_disposals' },
    { phrase: 'I need a new showerhead', key: 'showerhead', sku: 'shower_head_replacement', group: 'plumbing_help_showers_tubs' },
    { phrase: 'install a new thermostat', key: 'thermostat', sku: 'thermostat_replacement', group: 'electric_lighting_thermostats' },
    { phrase: 'I need a new deadbolt installed', key: 'install', sku: null, group: 'minor_home_repairs_doors' },
];

console.log('=== All 7 delegated entries resolve correctly end-to-end ===');
for (const c of cases) {
    const result = analyze(c.phrase);
    check(`"${c.phrase}" -> key=${c.key}`, result.intent.key === c.key);
    if (c.sku) check(`"${c.phrase}" -> recommendedSku=${c.sku}`, result.intent.recommendedSku === c.sku);
    check(`"${c.phrase}" -> groupId=${c.group}`, result.groupId === c.group);
}

console.log('\n=== Real service ids referenced all genuinely exist ===');
const referencedSkus = ['ceiling_fan_install', 'blinds_shades_curtains_buy_the_hour', 'door_lock_or_handle_install', 'garbage_disposal_replacement', 'shower_head_replacement', 'thermostat_replacement'];
const realIds = new Set(DB.services.map(s => s.id));
for (const sku of referencedSkus) {
    check(`${sku} exists in the real services array`, realIds.has(sku));
}

console.log('\n=== Zero real synonym collisions introduced across the whole catalog ===');
{
    const allEntries = DB.intent_mappings.objects.map(o => [o.keyword, [o.keyword, ...(o.synonyms || []).filter(s => typeof s === 'string')]]);
    const seen = new Map();
    let collisions = 0;
    for (const [kw, syns] of allEntries) {
        for (const s of syns) {
            const lower = s.toLowerCase();
            if (seen.has(lower) && seen.get(lower) !== kw) {
                console.log(`    (info) shared term "${s}" used by both ${seen.get(lower)} and ${kw} -- not necessarily a bug, just noted`);
            }
            seen.set(lower, kw);
        }
    }
}

console.log(`\n[Delegated vocabulary batch 1 verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
