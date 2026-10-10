/**
 * verify_tech_symptom_content_upgrade.js
 *
 * Verifies the T118, Step 6 item 5 fix for PENDING_DECISIONS.md #40:
 * network_symptom, smart_device_symptom, and generic_tech_symptom were
 * T114 directional drafts, not reviewed content -- flagged with their
 * own `_note` fields and never held to computer_symptom's bar. Also,
 * cable_management's own Diagnostic chain used generic_tech_symptom as
 * an imperfect fit ("Won't power on" doesn't describe a passive
 * cable's own failure modes).
 *
 * Fix: all three drafts expanded to real, distinct, customer-answerable
 * option sets matching computer_symptom's own bar; a new, dedicated
 * cable_symptom module authored for cable-specific conditions; the
 * cable_management chain rewired to use it.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.dirname(__dirname);
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(desc, cond) {
    if (cond) { pass++; console.log(`  \u2713 ${desc}`); }
    else { fail++; console.log(`  \u2717 ${desc}`); }
}

const COMPUTER_SYMPTOM_OPTION_COUNT = DB.intake_modules.computer_symptom.client_response.length;

console.log('=== The three T114 drafts are expanded, not left as directional stubs ===');
for (const key of ['network_symptom', 'smart_device_symptom', 'generic_tech_symptom']) {
    const mod = DB.intake_modules[key];
    check(`${key} no longer carries the T114 "STUB" flag in its own _note`,
        !/STUB per the brief/i.test(mod._note || ''));
    check(`${key} has a real, non-trivial option set (>= 6 options, computer_symptom's own bar is ${COMPUTER_SYMPTOM_OPTION_COUNT})`,
        mod.client_response.length >= 6);
    check(`${key} ends with a genuine "Other (describe in notes)" escape hatch, matching computer_symptom's own pattern`,
        /other/i.test(mod.client_response[mod.client_response.length - 1].label));
    check(`${key} matches computer_symptom's own deliberate choice: no modifier_ref or #emergency tag on any option (a pricing/urgency decision this item does not make)`,
        mod.client_response.every(r => !r.modifier_ref && !(r.tags || []).includes('#emergency')));
}

console.log('\n=== cable_symptom: a real, dedicated module, not a borrowed catch-all ===');
{
    const mod = DB.intake_modules.cable_symptom;
    check('cable_symptom exists with a real question', !!mod && typeof mod.question === 'string' && mod.question.length > 0);
    check('cable_symptom has the required type field (schema-valid)', mod.type === 'single');
    check('cable_symptom has a real, non-trivial option set', mod.client_response.length >= 5);
    check('cable_symptom\'s options describe cable-specific conditions, not device power/boot states (the exact #40 mismatch)',
        mod.client_response.some(r => /tangl|damag|frayed|hazard|hidden|loose|intermittent/i.test(r.label)) &&
        !mod.client_response.some(r => /power on|boot|blue screen/i.test(r.label)));
}

console.log('\n=== cable_management\'s own Diagnostic chain is rewired to the new module ===');
{
    const dyn = DB.dynamic_services['tech_trouble+tech_trouble_cable_management+Diagnostic'];
    const modules = (dyn?.intake_chain || []).map(s => s.module);
    check('cable_management Diagnostic now uses cable_symptom, not generic_tech_symptom',
        modules.length === 1 && modules[0] === 'cable_symptom');
}

console.log(`\n[tech symptom content upgrade, #40] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
