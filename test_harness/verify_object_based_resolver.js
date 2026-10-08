#!/usr/bin/env node
/**
 * verify_object_based_resolver.js
 *
 * Regression test for Archaeology Audit finding #1 — and the deeper,
 * more important discovery made while verifying it.
 *
 * The orchestrator's port of the legacy resolver:object_based logic
 * (orch_apply_object_based_resolution) was built and looked correct —
 * but direct execution proof revealed detectIntentNLP's real object-
 * literal construction NEVER copied the matched intent_mappings entry's
 * own `resolver` field onto the returned intent object at all. This
 * meant the ENTIRE object-based re-resolution mechanism — distinguishing
 * "install a TV" from "install a faucet" by the actual object, not just
 * the shared verb — was completely unreachable in BOTH the legacy
 * sqAnalyze code AND the orchestrator's faithful port of that same
 * logic. The bug was one level upstream of where it was first suspected.
 *
 * This test specifically guards the true fix (detectIntentNLP now
 * copies m.resolver), not just the orchestrator-side handler that was
 * already correctly built but had no real data to act on.
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

console.log('=== The real intent_mappings data genuinely has a resolver:object_based entry ===');
const installEntry = DB.intent_mappings.objects.find(o => o.keyword === 'install');
check('the "install" keyword entry exists and carries resolver:object_based', installEntry?.resolver === 'object_based');

console.log('\n=== TRUE ROOT CAUSE FIX: detectIntentNLP now copies resolver onto its returned intent object ===');
{
    const sandbox = { DB, window: { DB }, console };
    sandbox.global = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(findFn('detectIntentNLP'), sandbox, { filename: 'detect_intent' });

    const installResult = sandbox.detectIntentNLP('I need to install a new faucet');
    check('a real "install" phrase now produces resolver:"object_based" on the returned intent', installResult.resolver === 'object_based');

    const unrelatedResult = sandbox.detectIntentNLP('I need to fix my toilet');
    check('an unrelated intent correctly has resolver: null (no false positive)', unrelatedResult.resolver === null);
}

console.log('\n=== End-to-end via the real, full NLP pipeline (cms_bridge.js analyze mode) ===');
{
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resolver_check_'));
    const payloadPath = path.join(tmpDir, 'payload.json');
    fs.writeFileSync(payloadPath, JSON.stringify({ mode: 'analyze', text: 'I need to install a new faucet' }));
    const stdout = execFileSync('node', [path.join(REPO_ROOT, 'cms_bridge.js'), payloadPath, path.join(REPO_ROOT, 'btnyc.json'), path.join(REPO_ROOT, 'qr.html')], { encoding: 'utf8' });
    fs.rmSync(tmpDir, { recursive: true, force: true });
    const result = JSON.parse(stdout);
    check('the real, full pipeline produces resolver:"object_based"', result.intent.resolver === 'object_based');
    check('the real, full pipeline correctly extracts "faucet" as the object', result.obj === 'faucet');
}

console.log('\n=== End-to-end: the orchestrator correctly re-resolves to the OBJECT-SPECIFIC service ===');
{
    const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
    sandbox.global = sandbox;
    vm.createContext(sandbox);
    const code = [findFn('resolveDynamicService'), findFn('orch_apply_object_based_resolution'), findFn('orch_enrich_from_dynamic_service'), findFn('orch_resolve_entity')].join('\n\n');
    vm.runInContext(code, sandbox, { filename: 'object_based_e2e' });

    const context = {
        nlpIntent: { category: 'minor_home_repairs', stype: 'Install', key: 'install', base: 70, resolver: 'object_based', recommendedSku: null, _matchConfidence: 75, _groupId: 'plumbing_help_sinks' },
        extractedObject: 'faucet',
        selectedServiceId: null,
        selectedCategoryId: 'minor_home_repairs',
        selectedGroupId: 'plumbing_help_sinks',
    };
    const resolution = sandbox.orch_resolve_entity(context, DB);
    check('a generic "install" + "faucet" re-resolves to the real, specific faucet_repair_drip service (not the generic minor_home_repairs Install bucket)',
        resolution.entityType === 'service' && resolution.entity?.id === 'faucet_repair_drip');
    check('the re-resolved entity has its own real, plumbing-specific intake_chain',
        resolution.entity?.intake_chain?.some(m => m.module === 'faucet_type'));
}

console.log(`\n[object_based resolver verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
