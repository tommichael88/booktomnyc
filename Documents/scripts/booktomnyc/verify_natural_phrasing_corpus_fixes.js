#!/usr/bin/env node
/**
 * verify_natural_phrasing_corpus_fixes.js
 *
 * Regression test for 4 real, distinct bugs found by running a
 * delegated, 40-phrase natural-language test corpus through the live
 * engine and checking each result individually (not trusting the
 * corpus's own naive labels — 8 of 12 initial "mismatches" were
 * confirmed correct, more-specific resolutions, not bugs).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');
const vm = require('vm');

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

function findFn(name) {
    const m = QR_HTML.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) return null;
    let depth = 0, start = m.index, i = m.index + m[0].length - 1;
    for (let j = i; j < QR_HTML.length; j++) {
        if (QR_HTML[j] === '{') depth++;
        else if (QR_HTML[j] === '}') { depth--; if (depth === 0) return QR_HTML.slice(start, j + 1); }
    }
    return null;
}

function analyze(text) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'corpus_check_'));
    const payloadPath = path.join(tmpDir, 'payload.json');
    fs.writeFileSync(payloadPath, JSON.stringify({ mode: 'analyze', text }));
    const stdout = execFileSync('node', [path.join(REPO_ROOT, 'cms_bridge.js'), payloadPath, path.join(REPO_ROOT, 'btnyc.json'), path.join(REPO_ROOT, 'qr.html')], { encoding: 'utf8' });
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return JSON.parse(stdout);
}

console.log('=== Fix 1: mount now has real, plain single-word verb synonyms ===');
const mountObj = DB.intent_mappings.objects.find(o => o.keyword === 'mount');
check('mount synonyms include "hang"', mountObj.synonyms.includes('hang'));
check('mount synonyms include "attach"', mountObj.synonyms.includes('attach'));
check('"hang a picture on the wall" correctly resolves to mount, not drywall', analyze('hang a picture on the wall').intent.key === 'mount');
check('"attach a bracket to the wall" correctly resolves to mount, not drywall (re-targeted: a later, legitimate batch added a real "mirror" keyword that now correctly, more-specifically outscores "mount" for the original mirror phrase -- 100 vs 42.5, confirmed by hand-calculation -- so this check now uses a phrase that still genuinely tests the original collision fix without colliding with that newer, correct addition)',
    analyze('attach a bracket to the wall').intent.key === 'mount');

console.log('\n=== Fix 2: toilet has the real, missing install override ===');
const toiletObj = DB.intent_mappings.objects.find(o => o.keyword === 'toilet');
check('toilet has a real contextual_override for install/new toilet', toiletObj.contextual_overrides.some(o => o.override_sku === 'toilet_install'));
check('"install a new toilet" correctly resolves recommendedSku to toilet_install, not the flapper/fill-valve default',
    analyze('install a new toilet').intent.recommendedSku === 'toilet_install');

console.log('\n=== Fix 3: the object-based resolver re-checks contextual_overrides (both legacy and orchestrator paths) ===');
check('the live legacy resolver re-checks contextual_overrides', /objectMap\.contextual_overrides\)\) \{[\s\S]{0,400}ctxMatch\?\.override_sku/.test(QR_HTML));
check('the orchestrator port also re-checks contextual_overrides', /resolved\.default_service_sku = ctxMatch\.override_sku/.test(QR_HTML));
{
    const FNS = ['resolveDynamicService', 'orch_apply_object_based_resolution'];
    const code = FNS.map(findFn).join('\n\n');
    const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
    sandbox.global = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: 'resolver_check' });
    const context = {
        nlpIntent: { category: 'minor_home_repairs', stype: 'Install', key: 'install', base: 70, resolver: 'object_based', recommendedSku: null, _matchConfidence: 75, _groupId: 'minor_home_repairs_doors' },
        extractedObject: 'front door',
        rawText: 'install a new front door',
    };
    const resolved = sandbox.orch_apply_object_based_resolution(context, DB);
    check('the real, exact end-to-end case resolves to prehung_interior_door_install via the orchestrator path',
        resolved.recommendedSku === 'prehung_interior_door_install');
}

console.log('\n=== Fix 4: the live $ref-contamination bug (8 instances) is genuinely fixed ===');
const drywallObj = DB.intent_mappings.objects.find(o => o.keyword === 'drywall / wall');
check('drywall / wall synonyms no longer contain a $ref object', drywallObj.synonyms.every(s => typeof s === 'string'));
check('the plain word "drywall" is a real synonym', drywallObj.synonyms.includes('drywall'));
check('"repair a crack in the drywall" correctly resolves to drywall / wall, not the generic other fallback',
    analyze('repair a crack in the drywall').intent.key === 'drywall / wall');

let totalContaminated = 0;
for (const o of DB.intent_mappings.objects) {
    if ((o.synonyms || []).some(s => typeof s !== 'string')) totalContaminated++;
}
for (const t of Object.values(DB.smart_tags)) {
    if ((t.synonyms || []).some(s => typeof s !== 'string')) totalContaminated++;
}
check('zero remaining $ref-contaminated synonyms anywhere in intent_mappings.objects or smart_tags', totalContaminated === 0);

console.log(`\n[Natural-phrasing corpus fix verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
