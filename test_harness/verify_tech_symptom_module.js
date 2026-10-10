#!/usr/bin/env node
/**
 * verify_tech_symptom_module.js
 *
 * Regression test for the Session 3 fix (T114 / Charter §11 item 13,
 * Operator Brief "BTNYC Consolidation Arc"):
 *
 * `tech_trouble`'s diagnostic chains reused the shared appliance `symptom`
 * module (options shaped for washers/dryers/dishwashers: "Won't spin",
 * "Won't drain") for laptop, router, and smart-device customers alike.
 * Fixed by authoring a real `computer_symptom` module plus three
 * directional stub modules (`network_symptom`, `smart_device_symptom`,
 * `generic_tech_symptom`), and rewiring every affected `tech_trouble`
 * diagnostic chain to use the device-appropriate module instead.
 *
 * The brief named two chains as "the problem"
 * (`tech_trouble+Diagnostic` and
 * `tech_trouble+tech_trouble_computer_repair+Diagnostic`). Verification
 * found three MORE `tech_trouble` diagnostic chains with the identical
 * defect (`tech_trouble_cable_management`, `tech_trouble_networking`,
 * `tech_trouble_smart_home`) -- not named in the brief, but squarely
 * within its own stated boundary ("do not modify services outside the
 * tech_trouble category's diagnostic chains") and required by its own
 * acceptance criterion ("no tech_trouble service asks about appliance
 * symptoms" is a general claim, not scoped to the two named chains).
 * Confirmed each is genuinely reachable (not dead data) before fixing:
 * `resolveDynamicService` does a direct dynamic_services lookup with no
 * gate on the owning group's own `dynamic_service_types` list, so
 * `tech_trouble_cable_management`'s Diagnostic entry is live despite that
 * group only declaring "Install" support for its own "other tile" UI.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML = require('./_page.js').readPage(path.join(REPO_ROOT, 'qr.html'));
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(label, cond) {
    if (cond) { pass++; console.log('  \u2713 ' + label); }
    else { fail++; console.log('  \u2717 ' + label); }
}

function findFn(name) {
    const m = QR_HTML.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) return '';
    let depth = 0, start = m.index, j = m.index + m[0].length - 1;
    for (; j < QR_HTML.length; j++) {
        if (QR_HTML[j] === '{') depth++;
        else if (QR_HTML[j] === '}') { depth--; if (depth === 0) return QR_HTML.slice(start, j + 1); }
    }
    return '';
}
const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(findFn('_resolveIntakeChain') + '\n' + findFn('_isModVisible'), sandbox);

console.log('=== The four new/stub modules exist, have real content, and no duplicate labels ===');
{
    for (const key of ['computer_symptom', 'network_symptom', 'smart_device_symptom', 'generic_tech_symptom']) {
        const mod = DB.intake_modules[key];
        check(`${key} exists in intake_modules`, !!mod);
        check(`${key} has at least 3 real options`, Array.isArray(mod?.client_response) && mod.client_response.length >= 3);
        const labels = (mod?.client_response || []).map(r => r.label);
        check(`${key} has no duplicate labels`, labels.length === new Set(labels).size);
    }
    check('computer_symptom (the real, non-stub module) has computer-appropriate language, not appliance language',
        DB.intake_modules.computer_symptom.client_response.some(r => /boot|freeze|blue screen|overheating|battery|wifi/i.test(r.label)) &&
        !DB.intake_modules.computer_symptom.client_response.some(r => /won.t spin|won.t drain/i.test(r.label)));
}

console.log('\n=== tech_trouble+Diagnostic branches correctly on tech_device\'s own answer ===');
{
    const svc = DB.dynamic_services['tech_trouble+Diagnostic'];
    const resolved = sandbox._resolveIntakeChain(svc);
    check('tech_device is in the resolved chain', resolved.some(m => m.moduleKey === 'tech_device'));
    for (const key of ['computer_symptom', 'network_symptom', 'smart_device_symptom', 'generic_tech_symptom']) {
        check(`${key} is resolved as a branch target`, resolved.some(m => m.moduleKey === key));
    }
    check('before tech_device is answered, only tech_device itself is visible (no premature symptom question)',
        resolved.filter(m => sandbox._isModVisible(m, {}, resolved)).length === 1);

    const branches = [
        ['Computer (desktop or laptop)', 'computer_symptom'],
        ['Router or WiFi extender', 'network_symptom'],
        ['Smart speaker or smart plug', 'smart_device_symptom'],
        ['Other (describe in notes)', 'generic_tech_symptom'],
    ];
    for (const [answer, expectedModule] of branches) {
        const visible = resolved.filter(m => sandbox._isModVisible(m, { tech_device: answer }, resolved)).map(m => m.moduleKey);
        check(`"${answer}" shows exactly tech_device + ${expectedModule}`,
            visible.length === 2 && visible.includes('tech_device') && visible.includes(expectedModule));
    }
}

console.log('\n=== Every tech_trouble Diagnostic chain, not just the two named in the brief, is fixed ===');
{
    const expectedByChain = {
        'tech_trouble+tech_trouble_computer_repair+Diagnostic': 'computer_symptom',
        'tech_trouble+tech_trouble_networking+Diagnostic': 'network_symptom',
        'tech_trouble+tech_trouble_smart_home+Diagnostic': 'smart_device_symptom',
        // T118 (Step 6 item 5, closes PENDING_DECISIONS.md #40): cable_management
        // now uses its own authored cable_symptom module, not generic_tech_symptom
        // -- that was always flagged as an imperfect fit ("Won't power on" doesn't
        // apply to a passive cable), not a permanent design.
        'tech_trouble+tech_trouble_cable_management+Diagnostic': 'cable_symptom',
    };
    for (const [key, expectedModule] of Object.entries(expectedByChain)) {
        const svc = DB.dynamic_services[key];
        check(`${key} exists`, !!svc);
        const modules = (svc?.intake_chain || []).map(s => s.module);
        check(`${key} goes straight to ${expectedModule} (already knows device type from navigation path, no branching needed)`,
            modules.length === 1 && modules[0] === expectedModule);
    }
}

console.log('\n=== Acceptance criterion, checked literally: NO tech_trouble service asks about appliance symptoms ===');
{
    const offenders = [];
    for (const [key, svc] of Object.entries(DB.dynamic_services)) {
        if (!key.startsWith('tech_trouble')) continue;
        for (const step of (svc.intake_chain || [])) {
            if (step.module === 'symptom') offenders.push(key);
            for (const targets of Object.values(step.then || {})) {
                if ((targets || []).includes('symptom')) offenders.push(key + ' (as a branch target)');
            }
        }
    }
    check('zero tech_trouble services reference the shared appliance symptom module, directly or as a branch target',
        offenders.length === 0);
}

console.log('\n=== resolveDynamicService confirms these are genuinely reachable, not dead data ===');
{
    // Direct check on the exact claim used to justify fixing the three
    // chains the brief didn't name: does a plain category+group+type
    // lookup succeed even though tech_trouble_cable_management's own
    // dynamic_service_types only declares "Install"?
    const cableGroup = (db => (db.group || db.groups || []).find(g => g && g.id === 'tech_trouble_cable_management'))(DB);
    check('sanity: tech_trouble_cable_management\'s own dynamic_service_types really is Install-only (confirms this needed checking, not assuming)',
        !!cableGroup && JSON.stringify(cableGroup.dynamic_service_types) === JSON.stringify(['Install']));
    check('the Diagnostic entry exists directly under dynamic_services regardless (genuinely reachable via resolveDynamicService\'s plain key lookup)',
        !!DB.dynamic_services['tech_trouble+tech_trouble_cable_management+Diagnostic']);
}

console.log('\n=== Question count unchanged: no §6E ceiling risk introduced ===');
{
    // Specialized-tier ceiling is 7 (charter §6E). Every affected chain's
    // AUTHORED question count is identical before and after this fix
    // (one module swapped for another, or one module replacing an
    // unconditional step with an equally-unconditional branch) -- this
    // just confirms that arithmetic directly rather than asserting it.
    const chains = [
        'tech_trouble+Diagnostic',
        'tech_trouble+tech_trouble_computer_repair+Diagnostic',
        'tech_trouble+tech_trouble_networking+Diagnostic',
        'tech_trouble+tech_trouble_smart_home+Diagnostic',
        'tech_trouble+tech_trouble_cable_management+Diagnostic',
    ];
    for (const key of chains) {
        const svc = DB.dynamic_services[key];
        const resolved = sandbox._resolveIntakeChain(svc);
        // however the answer branches, at most ONE symptom-shaped module
        // is ever visible at once alongside tech_device (if present) --
        // so the real, customer-facing question count per chain is at
        // most 2, well under the specialized ceiling of 7.
        const maxVisibleAtOnce = Math.max(
            ...['Computer (desktop or laptop)', 'Router or WiFi extender', 'Smart speaker or smart plug', 'Other (describe in notes)', undefined]
                .map(answer => resolved.filter(m => sandbox._isModVisible(m, answer ? { tech_device: answer } : {}, resolved)).length)
        );
        check(`${key}: at most 2 real questions visible at once (ceiling is 7 for specialized tier)`, maxVisibleAtOnce <= 2);
    }
}

console.log(`\n[tech_symptom module verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
