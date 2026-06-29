#!/usr/bin/env node
/**
 * verify_curated_card_chain_rewire.js
 *
 * Regression test for the Phase 6/7 rewire's second slice:
 * sqBuildCuratedIntake's manual chain-composition (resolve chain +
 * manually loop force-module injection) was replaced with a direct call
 * to orch_compose_intake_chain, the real, already-verified orchestrator
 * function. Confirmed via direct trace before the rewire that this
 * function is a strict superset of the prior manual logic (it calls the
 * exact same _resolveIntakeChain internally, then applies the same
 * force-module injection with an even more defensive tier-fallback).
 *
 * This test reimplements the OLD, removed logic exactly and diffs it
 * against the new wiring's real output across the complete, real
 * catalog, confirming byte-for-byte parity before trusting the swap.
 */
const fs = require('fs');
const path = require('path');
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

console.log('=== The live code genuinely calls the real orchestrator function, not a re-implementation ===');
check('sqBuildCuratedIntake calls orch_compose_intake_chain directly', /const allMods = orch_compose_intake_chain\(\{\}, \{ entity: svc \}, DB\);/.test(QR_HTML));
check('the old, manual force-module injection loop is genuinely removed', !/SSOT: S\._forceModules \(set in sqPrepareFlow from/.test(QR_HTML));

const code = [findFn('_resolveIntakeChain'), findFn('orch_compose_intake_chain')].join('\n\n');
const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'curated_card_rewire' });

function oldLogic(svc) {
    const allMods = sandbox._resolveIntakeChain(svc);
    const tier = svc.confidence_strategy?._variability_tier || 'medium';
    const forceMods = DB.global_rules?.force_modules_by_variability?.[tier] || ['hybrid_qty'];
    const existingKeys = new Set(allMods.map(m => m.moduleKey));
    for (const fKey of forceMods) {
        if (!existingKeys.has(fKey) && DB.intake_modules?.[fKey]) {
            allMods.push({ moduleKey: fKey, then: {}, ...DB.intake_modules[fKey], _forced: true });
            existingKeys.add(fKey);
        }
    }
    return allMods.map(m => m.moduleKey);
}

console.log('\n=== Complete, real catalog parity: the new wiring matches the old, removed logic exactly ===');
{
    let mismatches = [];
    for (const svc of DB.services) {
        const oldKeys = oldLogic(svc);
        const newKeys = sandbox.orch_compose_intake_chain({}, { entity: svc }, DB).map(m => m.moduleKey);
        if (JSON.stringify(oldKeys) !== JSON.stringify(newKeys)) {
            mismatches.push({ id: svc.id, oldKeys, newKeys });
        }
    }
    check(`zero real mismatches across all ${DB.services.length} real, current services (found ${mismatches.length})`, mismatches.length === 0);
    mismatches.forEach(m => {
        console.log(`    ${m.id}:`);
        console.log(`      old: ${JSON.stringify(m.oldKeys)}`);
        console.log(`      new: ${JSON.stringify(m.newKeys)}`);
    });
}

console.log('\n=== Specific, real, previously-verified case: dimmer_switch_install\'s real chain matches the originally-confirmed shape ===');
{
    const svc = DB.services.find(s => s.id === 'dimmer_switch_install');
    const keys = sandbox.orch_compose_intake_chain({}, { entity: svc }, DB).map(m => m.moduleKey);
    const expected = ['item_count_template::light switches', 'hybrid_qty', 'access', 'parking_difficulty', 'disposal_request', 'pets_present', 'urgency', 'item_volume'];
    check('matches the exact, real, previously-confirmed chain shape', JSON.stringify(keys) === JSON.stringify(expected));
}

console.log(`\n[Curated-card chain-composition rewire verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
