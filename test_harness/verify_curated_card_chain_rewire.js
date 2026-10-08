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
 * This test originally reimplemented the OLD, removed logic exactly and
 * diffed it against the new wiring's real output, confirming byte-for-byte
 * parity before trusting the swap -- correct for a pure refactor (Phase
 * 6/7: same behavior, different code path).
 *
 * T118 UPDATE: that premise is now backwards. T118 deliberately replaced
 * universal force-injection with per-category/group intake_defaults, so
 * "the new output should match the old" is no longer the right question --
 * the old behavior is exactly what was being corrected. This test now
 * confirms the change took effect substantially and deliberately (a real,
 * large share of services now differ from the old universal logic) rather
 * than asserting they should still agree.
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
    const forceMods = (DB.global_rules?.force_modules_by_variability_DEPRECATED?.[tier]) || ['hybrid_qty'];
    const existingKeys = new Set(allMods.map(m => m.moduleKey));
    for (const fKey of forceMods) {
        if (!existingKeys.has(fKey) && DB.intake_modules?.[fKey]) {
            allMods.push({ moduleKey: fKey, then: {}, ...DB.intake_modules[fKey], _forced: true });
            existingKeys.add(fKey);
        }
    }
    return allMods.map(m => m.moduleKey);
}

console.log('\n=== T118 UPDATE: this test\'s own original premise (old and new should match byte-for-byte) is now backwards ===');
console.log('    That check was right for a pure refactor (Phase 6/7: same behavior, different code path).');
console.log('    T118 deliberately changed the behavior itself (removed universal force-injection), so the');
console.log('    old, removed, indiscriminate logic is now the thing being corrected, not a baseline to match.');
{
    let realDifferences = 0;
    let hybridQtyCorrectlyRemoved = 0;
    for (const svc of DB.services) {
        const oldKeys = oldLogic(svc);
        const newKeys = sandbox.orch_compose_intake_chain({}, { entity: svc }, DB).map(m => m.moduleKey);
        if (JSON.stringify(oldKeys) !== JSON.stringify(newKeys)) {
            realDifferences++;
            if (oldKeys.includes('hybrid_qty') && !newKeys.includes('hybrid_qty')) hybridQtyCorrectlyRemoved++;
        }
    }
    check(`the new mechanism now genuinely, substantially differs from the old universal one (${realDifferences} of ${DB.services.length} real services changed) -- confirms the removal actually took effect, not just theoretically`,
        realDifferences > 30);
    check(`a real share of those differences are hybrid_qty correctly no longer force-added (${hybridQtyCorrectlyRemoved} services) -- Specialized/diagnostic-tier services per FORCE_INJECTION_AUDIT.md §5, not just noise`,
        hybridQtyCorrectlyRemoved >= 8);
}

console.log('\n=== Specific, real, previously-verified case: three named services show the NEW, deliberate scoping, not the old universal one ===');
{
    const doorInstall = DB.services.find(s => s.id === 'prehung_interior_door_install');
    const doorKeys = sandbox.orch_compose_intake_chain({}, { entity: doorInstall }, DB).map(m => m.moduleKey);
    check('prehung_interior_door_install no longer gets hybrid_qty -- fixes the §6E contradiction this exact service was already named for ("door installation should never carry a quantity question")',
        !doorKeys.includes('hybrid_qty'));

    const wallRepair = DB.services.find(s => s.id === 'wall_hole_or_crack_repair');
    const wallKeys = sandbox.orch_compose_intake_chain({}, { entity: wallRepair }, DB).map(m => m.moduleKey);
    check('wall_hole_or_crack_repair (this test suite\'s own original motivating example) gets disposal_request (its group default still correctly applies) but not urgency (not emergency-shaped) or access (removed catalog-wide, T118 operator-directed -- reachability isn\'t a meaningful, price-changing question here)',
        wallKeys.includes('disposal_request') && !wallKeys.includes('urgency') && !wallKeys.includes('access'));
}

console.log(`\n[Curated-card chain-composition rewire verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
