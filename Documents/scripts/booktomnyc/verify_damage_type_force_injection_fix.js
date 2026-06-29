#!/usr/bin/env node
/**
 * verify_damage_type_force_injection_fix.js
 *
 * Regression test for a real, severe bug found via direct, constructive
 * pushback, not internal review: `damage_type` (a real, narrow,
 * surface-repair-specific module — "scratch / water-ring / veneer
 * peeling") was force-injected into EVERY `high`-variability-tier
 * service via `global_rules.force_modules_by_variability`, regardless
 * of whether the service had anything to do with surface damage.
 *
 * Confirmed via direct trace this genuinely affected 2 real services
 * today: `toilet_install` and `prehung_interior_door_install`, neither
 * of which plausibly needs a question about scratches or veneer
 * peeling. The module's own, real, sole intended home —
 * `scratch_or_water_ring_removal` — already correctly authors it
 * directly in its own intake_chain, confirming it was never meant to
 * be a tier-wide, generic question the way `project_scale`/`access`
 * genuinely are.
 *
 * This is the same real bug CLASS as an earlier-remembered "drywall
 * attached to every service" issue — not the same literal mechanism
 * (no #drywall/wall_type module was found bleeding via this path), but
 * the same real, structural cause: a generic, tier-wide force-injection
 * list containing content that is narrow and service-specific, not
 * actually general-purpose, silently surfacing on services where it
 * makes no sense.
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

const code = [findFn('_resolveIntakeChain'), findFn('orch_compose_intake_chain')].join('\n\n');
const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'damage_type_fix' });

console.log('=== global_rules data: damage_type is genuinely removed from the high-tier force list ===');
check('damage_type is no longer in global_rules.force_modules_by_variability.high',
    !DB.global_rules.force_modules_by_variability.high.includes('damage_type'));
check('project_scale (a genuinely general-purpose question) is still correctly present',
    DB.global_rules.force_modules_by_variability.high.includes('project_scale'));

console.log('\n=== The 2 real, originally-affected services no longer get damage_type force-injected ===');
for (const sid of ['toilet_install', 'prehung_interior_door_install']) {
    const svc = DB.services.find(s => s.id === sid);
    const allMods = sandbox.orch_compose_intake_chain({}, { entity: svc }, DB);
    check(`${sid} no longer has damage_type in its real, complete intake chain`,
        !allMods.some(m => m.moduleKey === 'damage_type'));
}

console.log('\n=== The one real service that genuinely owns this module is unaffected ===');
{
    const svc = DB.services.find(s => s.id === 'scratch_or_water_ring_removal');
    const allMods = sandbox.orch_compose_intake_chain({}, { entity: svc }, DB);
    check('scratch_or_water_ring_removal still correctly has damage_type (authored directly in its own chain, not via force-injection)',
        allMods.some(m => m.moduleKey === 'damage_type'));
}

console.log(`\n[damage_type force-injection fix verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
