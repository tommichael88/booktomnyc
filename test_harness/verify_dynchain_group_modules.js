#!/usr/bin/env node
/**
 * verify_dynchain_group_modules.js -- the data contract behind R-DOMAIN-DYNCHAIN's remedy.
 *
 * T128 (door_issue), T144 (window_ac_issue) and T149 (garbage_disposal_issue, plumbing_fixture_issue, water_line_issue) each replaced the generic shared `symptom` module in a
 * component_first group's fallback chain with a module that "copies every applicable generic answer with IDENTICAL effects". Each carries a `_note` making that claim. A claim in a
 * note is not evidence, so this test holds every derived module to an explicit REGISTRY of what it drops, adds and relabels, and checks the claim answer by answer:
 *   - every generic answer is retained deep-equal, or relabelled with every other field equal, or dropped -- and only as declared (no silent drop, no silent edit);
 *   - every added answer carries NO effect (no tags, no complexity/checkout override, no modifier) so it cannot move a price;
 *   - the question names a different thing than the generic's ("the appliance"), and the module's structural fields equal the generic's;
 *   - BEHAVIOR: the real route for every dynamic entry that uses a derived module asks that module first and still prices.
 * The audit is a pure function and is proven able to fail (three mutants) before it is trusted.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..');
const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log('  \u2713 ' + name); } else { fail++; console.log('  \u2717 ' + name + (detail ? '\n      ' + detail : '')); } };

const WONT_SPIN = 'Won\u2019t spin / no movement', WONT_DRAIN = 'Won\u2019t drain (water stays inside)';
// What each derived module is DECLARED to do relative to the generic `symptom`. A new derived module is added here when it is authored; an undeclared one is invisible to the audit,
// so the population check below also requires every module whose _note claims "IDENTICAL effects" to be registered.
const REGISTRY = {
  garbage_disposal_issue: { dropped: [], added: [], relabeled: {}, nounMustNotBe: 'appliance' },
  plumbing_fixture_issue: { dropped: [WONT_SPIN], added: [], relabeled: {}, nounMustNotBe: 'appliance' },
  water_line_issue: { dropped: [WONT_SPIN, WONT_DRAIN], added: [], relabeled: {}, nounMustNotBe: 'appliance' },
  window_ac_issue: { dropped: [WONT_DRAIN], added: ['Not cooling properly', 'Other (describe in notes)'], relabeled: { [WONT_SPIN]: 'Won\u2019t turn on / fan won\u2019t spin' } },
};
const EFFECT_FIELDS = ['modifier_ref', 'complexity_override', 'checkout_state_override'];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function auditDerived(mods, registry) {
  const v = [], gen = mods.symptom, genBy = new Map(gen.client_response.map(r => [r.label, r]));
  for (const [name, spec] of Object.entries(registry)) {
    const m = mods[name]; if (!m) { v.push(`${name}: module missing`); continue; }
    const got = new Map(m.client_response.map(r => [r.label, r]));
    for (const [label, g] of genBy) {
      if (spec.dropped.includes(label)) { if (got.has(label)) v.push(`${name}: "${label}" is declared dropped but present`); continue; }
      const target = spec.relabeled[label] || label, d = got.get(target);
      if (!d) { v.push(`${name}: generic answer "${label}" silently dropped (not declared)`); continue; }
      if (!same(Object.assign({}, d, { label }), g)) v.push(`${name}: "${target}" differs from the generic answer in more than its label (effects must be identical)`);
    }
    const accounted = new Set([...genBy.keys(), ...Object.values(spec.relabeled)]);
    for (const [label, d] of got) {
      if (accounted.has(label)) continue;
      if (!spec.added.includes(label)) { v.push(`${name}: answer "${label}" is not generic, not relabelled and not declared added`); continue; }
      if (EFFECT_FIELDS.some(f => d[f] != null) || (d.tags || []).length) v.push(`${name}: added answer "${label}" carries an effect (it must not move a price)`);
    }
    for (const a of spec.added) if (!got.has(a)) v.push(`${name}: declared-added answer "${a}" is absent`);
    if (m.question === gen.question) v.push(`${name}: question is still the generic's`);
    if (spec.nounMustNotBe && new RegExp(spec.nounMustNotBe, 'i').test(m.question)) v.push(`${name}: question still names "${spec.nounMustNotBe}"`);
    for (const f of ['type', 'purpose', 'confidence_gain', 'affects_price']) if (!same(m[f], gen[f])) v.push(`${name}: ${f} differs from the generic module`);
  }
  return v;
}

console.log('\n=== 1. the audit can fail (three mutants) ===');
{ const c = () => JSON.parse(JSON.stringify(DB.intake_modules));
  const m1 = c(); m1.plumbing_fixture_issue.client_response.find(r => r.label === 'Leaking water').complexity_override = 'routine';
  check('MUTANT: an edited effect on a retained answer is caught', auditDerived(m1, REGISTRY).some(x => /differs from the generic answer/.test(x)));
  const m2 = c(); m2.water_line_issue.client_response = m2.water_line_issue.client_response.filter(r => r.label !== 'Leaking water');
  check('MUTANT: a silently dropped answer is caught', auditDerived(m2, REGISTRY).some(x => /silently dropped/.test(x)));
  const m3 = c(); m3.window_ac_issue.client_response.find(r => r.label === 'Other (describe in notes)').modifier_ref = 'x';
  check('MUTANT: an added answer that carries an effect is caught', auditDerived(m3, REGISTRY).some(x => /carries an effect/.test(x))); }

console.log('\n=== 2. the data: every derived module keeps the claim its _note makes ===');
const violations = auditDerived(DB.intake_modules, REGISTRY);
check(`all ${Object.keys(REGISTRY).length} derived modules match the registry, answer by answer`, violations.length === 0, violations.slice(0, 6).join(' | '));
const claimants = Object.entries(DB.intake_modules).filter(([k, m]) => k !== 'symptom' && /IDENTICAL effects/i.test(m._note || '')).map(([k]) => k);
check('population: every module whose _note claims "IDENTICAL effects" is in the registry', claimants.every(k => REGISTRY[k]), 'unregistered: ' + claimants.filter(k => !REGISTRY[k]).join(', '));
check('population: each registered module is actually used by a dynamic entry', Object.keys(REGISTRY).every(k => Object.values(DB.dynamic_services).some(d => (d.intake_chain || []).some(s => s.module === k))));

console.log('\n=== 3. behavior: the real route asks the derived module first, and still prices ===');
const sb = { DB, SERVICE_DATA: DB, window: { DB }, console }; sb.global = sb; vm.createContext(sb);
for (const f of ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
const users = Object.entries(DB.dynamic_services).filter(([k, d]) => (d.intake_chain || []).some(s => Object.keys(REGISTRY).includes(s.module)));
check(`population: ${users.length} dynamic entries use a derived module (>= 7)`, users.length >= 7);
const bad = [];
for (const [key, d] of users) {
  const [cat, grp, stype] = key.split('+');
  try {
    const ctx = sb.collectBookingContext_otherTile({ ui_taxonomy: { group_id: grp }, service_type: stype, uncovered_service_types: [stype] }, cat);
    const route = sb.executeWorkflow(ctx, DB);
    const first = (route.intakeChain || [])[0], mod = first && (first.moduleKey || first.module);
    const want = d.intake_chain[0].module;
    if (mod !== want) bad.push(`${key}: first question is ${mod}, data says ${want}`);
    else if (typeof (route.quote || {}).laborEstimate !== 'number') bad.push(`${key}: route carries no numeric price`);
  } catch (e) { bad.push(`${key}: ${e.message}`); }
}
check('every such route asks the derived module first and carries a numeric price', bad.length === 0, bad.slice(0, 5).join(' | '));

console.log(`\n[R-DOMAIN-DYNCHAIN data contract] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail ? 1 : 0);
