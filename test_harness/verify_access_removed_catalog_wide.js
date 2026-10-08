#!/usr/bin/env node
/**
 * verify_access_removed_catalog_wide.js
 *
 * Verifies the T118, operator-directed removal of `access` catalog-wide:
 * not a question with a meaningful answer distribution in residential
 * handyman work -- reachability is either constant for a given job type
 * (doors, cabinets, floors, furniture, standard-height work) or covered
 * by a specific, factual module where it genuinely varies (e.g.
 * mounting_height). See PROJECT_CHARTER.md §6E's own added principle
 * note for the general rule this removal follows.
 *
 * Removed from: global_rules.intake_defaults (category_defaults,
 * group_defaults, and the now-moot excluded_services entries that
 * existed only to carve exceptions out of it), every service's own
 * authored intake_chain (10 real services had it directly), the
 * intake_modules.access module definition itself, the
 * global_rules.modifiers.access_very_cramped_or_hard_to_reach fee
 * definition, and the #access_obstructed smart tag (found dangling
 * during this same fix -- its own answers mapping pointed at the
 * now-deleted module).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
// T147: functions declared in the three engine modules are loaded WHOLE (the T136 `_engine.js` loader), so a helper or resolver added next to a function can no longer
// drop out of this sandbox ("X is not defined" -- noise unrelated to what this test asserts). Anything else is still extracted by name, below.
const { engineAwareFindFn } = require('./_engine.js');
const findFn = engineAwareFindFn(_cherryPickFn);

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

function _cherryPickFn(name) {
    const m = QR_HTML.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) return '';
    let depth = 0, start = m.index;
    for (let j = m.index + m[0].length - 1; j < QR_HTML.length; j++) {
        if (QR_HTML[j] === '{') depth++;
        else if (QR_HTML[j] === '}') { depth--; if (depth === 0) return QR_HTML.slice(start, j + 1); }
    }
    return '';
}

const FNS = ['resolveDynamicService', 'resolveBaseConfidenceStrategy', 'resolveServiceCheckoutStateKey',
    'applyLiveConfidenceEscalation', 'deriveComplexityTier', 'applyPricingFormula',
    'computeUnifiedQuote', 'sqTagLabel', 'mathFurnitureAssembly', 'buildCheckoutStateModel',
    '_resolveIntakeChain', 'orch_compose_intake_chain'];
const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(FNS.map(findFn).join('\n\n'), sandbox);

let pass = 0, fail = 0;
function check(desc, cond) {
    if (cond) { pass++; console.log(`  \u2713 ${desc}`); }
    else { fail++; console.log(`  \u2717 ${desc}`); }
}

function chainFor(id) {
    const svc = DB.services.find(s => s.id === id);
    return sandbox.orch_compose_intake_chain({}, { entity: svc }, DB).map(m => m.moduleKey || m.module);
}

console.log('=== Data: access no longer exists as a module, a modifier, or a smart tag ===');
{
    check('intake_modules.access does not exist', !('access' in DB.intake_modules));
    check('global_rules.modifiers.access_very_cramped_or_hard_to_reach does not exist',
        !('access_very_cramped_or_hard_to_reach' in DB.global_rules.modifiers));
    check('#access_obstructed smart tag does not exist (found dangling -- its own answers pointed at the deleted module -- and removed alongside it)',
        !('#access_obstructed' in DB.smart_tags));
}

console.log('\n=== Data: access is absent from every intake_defaults mechanism ===');
{
    const d = DB.global_rules.intake_defaults;
    check('not in universal', !(d.universal || []).includes('access'));
    check('not in any category_defaults entry',
        !Object.values(d.category_defaults || {}).some(mods => mods.includes('access')));
    check('not in any group_defaults entry',
        !Object.values(d.group_defaults || {}).some(mods => mods.includes('access')));
    check('not in any excluded_services entry (the mechanism that used to carve access exceptions out is now empty of it too)',
        !Object.entries(d.excluded_services || {}).some(([k, v]) => k !== '_note' && (Array.isArray(v) ? v.includes('access') : false)));
}

console.log('\n=== The five named job types: access is not present in any of their real, resolved chains ===');
{
    const namedCases = [
        ['prehung_interior_door_install', 'door install'],
        ['cabinet_knob_or_pull_install', 'cabinet knob install'],
        ['furniture_assembly_flat_pack', 'furniture assembly'],
        ['loose_tile_replacement', 'floor work'],
        ['baseboard_install', 'trim work'],
    ];
    for (const [id, label] of namedCases) {
        const chain = chainFor(id);
        check(`${label} (${id}) does not get access`, !chain.includes('access'));
    }
}

console.log('\n=== Comprehensive, catalog-wide sweep: zero of the 74 real services get access, not just the five named cases ===');
{
    const withAccess = DB.services.filter(s => chainFor(s.id).includes('access'));
    check(`zero real services resolve access into their chain (found: ${withAccess.map(s => s.id).join(', ') || 'none'})`,
        withAccess.length === 0);
}

console.log('\n=== Comprehensive sweep: zero services have access authored directly in their own intake_chain (the data itself, not just the resolved chain) ===');
{
    const authoredAccess = DB.services.filter(s => (s.intake_chain || []).some(step => step.module === 'access'));
    check(`zero services author access directly (found: ${authoredAccess.map(s => s.id).join(', ') || 'none'})`,
        authoredAccess.length === 0);
}

console.log('\n=== The motivating trace, re-run after the removal, on a BATCHED service ===');
// T147: prehung doors are single-unit by the operator's own flag (two doors are two bookings), so the 10-unit trace runs on a service whose quantity really multiplies.
{
    const svc = DB.services.find(s => s.id === 'generic_mounting_service');
    const q = sandbox.computeUnifiedQuote({ svc, activeTagIds: [], answers: {}, qty: 10 });
    check(`prices exactly at base*qty ($${svc.financial_engine.base_price * 10}), no access fee, no phantom question to answer`, q.laborEstimate === svc.financial_engine.base_price * 10);
}

console.log(`\n[access removed catalog-wide] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
