#!/usr/bin/env node
/**
 * verify_entity_first_independent.js -- the validator and the derivation are checked against knowledge that does NOT come from the migration (T177; R-TEST-CANFAIL, R-SYSTEM-IDENTITY, R-DOMAIN-SHAPE).
 *
 * @enforces R-TEST-CANFAIL
 * @enforces R-DOMAIN-SHAPE
 * @enforces R-SYSTEM-IDENTITY
 * @enforces R-INVARIANT-DERIVATION
 * @detects DEFECT-TEST-CANTFAIL
 * @detects DEFECT-DERIVED-AUTHORITY
 *
 * THE DEFECT-SHAPE. Every other entity-first test starts from ssot/btnyc_source.json, which the migration made from btnyc.json. A validator and a derivation that were both tuned to what the migration
 * produces would pass those tests whether or not they implement the Charter Playbook. This test removes the migration from the loop twice.
 *
 *   PART A -- the Playbook's own worked example. A source of one entity, the washer, authored here by hand from the Playbook's "Example of the target contract" (the washer, its three questions, its three
 *      uncertainty classes, the service svc.washer_repair = ent.washer + act.repair + no modifiers). The example is illustrative, not a schema substitute; three things are completed so it is valid:
 *        - kind is "component" (the schema's vocabulary; the example says "appliance");
 *        - every effect an option claims has the field that causes it (the Playbook: a module cannot claim an effect nothing declares): location_hints for "prep", a priced modifier for "price" and "minutes",
 *          checkout_state_id for "checkout_state", a dependent question for "branch";
 *        - "Not sure" carries evidence "unknown" (R-INTAKE-NONRETIRING), so it can be told from a real answer.
 *      The validator must accept it; the derivation must give EXACTLY the graph written out below by hand (no value is copied from the program's output); and each Playbook rule has a mutant of it that the
 *      validator refuses with the right code. The same tiny source must go through every publish gate, so the gates are not tuned to the catalog either.
 *   PART B -- a reference sample read off btnyc.json by hand: three real services, each with the entity, action, question order, branch and thresholds typed here from the legacy file, compared with the
 *      published artifact.
 *
 * Node + python3 (jsonschema) only; no browser, no network.
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = process.env.BTNYC_ROOT ? path.resolve(process.env.BTNYC_ROOT) : path.resolve(__dirname, '..');
process.env.BTNYC_ROOT = ROOT;
const EF = path.join(__dirname, 'tools', 'entity_first');
const lib = require(path.join(EF, 'lib.js'));
const V = require(path.join(EF, 'validate_source.js'));
const D = require(path.join(EF, 'derive_graph.js'));
const P = require(path.join(EF, 'publish.js'));

let passed = 0, failed = 0;
const check = (label, ok, detail) => { if (ok) { passed++; console.log(`  ✓ ${label}`); } else { failed++; console.log(`  ✗ ${label}${detail ? ' -- ' + detail : ''}`); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const close = (a, b) => Math.abs(a - b) < 1e-12;

const REAL = lib.readJson(lib.PATHS.source);

// =====================================================================================================================================================================================================
// PART A -- the washer, authored by hand
// =====================================================================================================================================================================================================
// The inert scaffolding every source needs (the schema's required sections, one category, one group, the action, the checkout states, the policy defaults) is taken from the committed source with every
// reference to the catalog's own groups, questions and services removed. None of the washer's domain content comes from the catalog.
function washerSource() {
  const f = lib.clone(REAL);
  f.registries.categories = [{ id: 'cat.fixture_home', display_name: 'Fixture home', icon: 'ti ti-home', group_ids: ['grp.fixture_washers'] }];
  f.registries.groups = [{ id: 'grp.fixture_washers', category_id: 'cat.fixture_home', display_name: 'Washers', icon: 'x', explicit_services: ['svc.washer_repair'], dynamic_service_types: [],
    picker: { entry_mode: 'symptom_first', component_entity_ids: ['ent.washer'], component_links: [{ entity_id: 'ent.washer', service_ids: ['svc.washer_repair'] }], symptom_question_id: 'q.washer_symptom', real_gaps: [], action_ids: ['act.repair'] } }];
  f.registries.actions = REAL.registries.actions.filter(a => a.id === 'act.repair');
  f.registries.modifiers = [ // the two causes of a priced answer: a fee and minutes each
    { id: 'mod.leak_hose', fee: 45, minutes: 30, scope: 'per_unit', affects: ['price', 'minutes'] },
    { id: 'mod.leak_door_seal', fee: 60, minutes: 45, scope: 'per_unit', affects: ['price', 'minutes'] }];
  f.registries.tags = []; f.registries.materials = []; f.registries.furniture = []; f.registries.pricing_formulas = []; f.registries.service_order = ['svc.washer_repair'];
  f.registries.behavioral_classes = REAL.registries.behavioral_classes.filter(c => c.id === 'cls.major_appliance').map(c => Object.assign(lib.clone(c), { member_group_ids: ['grp.fixture_washers'], typical_actions: ['act.repair'] }));
  f.shared_questions = []; f.shared_uncertainty_classes = [];
  const gr = f.policy.global_rules; gr.intake_defaults.group_defaults = {}; gr.intake_defaults.category_defaults = {};
  for (const k of Object.keys(gr.force_modules_by_variability_DEPRECATED)) if (Array.isArray(gr.force_modules_by_variability_DEPRECATED[k])) gr.force_modules_by_variability_DEPRECATED[k] = [];
  f.policy.ui_config.step2_types = ['act.repair'];
  f.vocabulary.nlp_objects = []; f.vocabulary.nlp_default_fallback.category = 'cat.fixture_home';
  f.vocabulary.action_vocabulary.actions = f.vocabulary.action_vocabulary.actions.filter(a => a.action_id === 'act.repair');

  // the service: the scaffolding of any service (presentation, pricing path, runtime_compat) borrowed from one real service, then every identity, question, weight and threshold set by hand
  const donor = REAL.entities.find(e => e.id === 'ent.computer').services.find(s => s.confidence_gate && s.confidence_gate.mode === 'weighted_uncertainty');
  const svc = lib.clone(donor); delete svc.decomposition;
  Object.assign(svc, { id: 'svc.washer_repair', entity_id: 'ent.washer', action_id: 'act.repair', modifier_ids: [] });
  svc.presentation.ui_taxonomy.category_id = 'cat.fixture_home'; svc.presentation.ui_taxonomy.group_id = 'grp.fixture_washers'; svc.presentation.ui_taxonomy.display_name = 'Washer Repair';
  svc.pricing.required_material_ids = []; svc.pricing.optional_material_ids = []; svc.tags = { default_tag_ids: [], suggested_tag_ids: [] };
  svc.intake = { steps: [{ question_id: 'q.washer_type', depends_on: [] }, { question_id: 'q.washer_symptom', depends_on: [] }, { question_id: 'q.washer_leak_source', depends_on: [{ question_id: 'q.washer_symptom', option_id: 'sym.leaking' }] }] };
  svc.uncertainty_profile = [{ class_id: 'u.washer_type', weight: 20 }, { class_id: 'u.symptom', weight: 40 }, { class_id: 'u.leak_source', weight: 30 }];
  svc.confidence_policy = { exact_at: 0.8, range_at: 0.5, diagnostic_below: 0.5, scale: '0-1', policy_sources: { exact_at: 'service_override', range_at: 'service_override', diagnostic_below: 'service_override' } };
  svc.recovery_affordances = { source: 'current_open_uncertainty', deep_dive_question_ids: [], when_no_path: { route: 'diagnostic', checkout_state_id: 'chk.diagnostic' }, deep_dive_declared: false };

  const Q = (id, prompt, options, depends_on = []) => ({ id, prompt, type: 'single', purpose: 'routing', entity_scope: ['ent.washer'], depends_on, options });
  f.entities = [{
    id: 'ent.washer', label: 'Washer', kind: 'component', parent_id: null, aliases: ['washing machine', 'clothes washer'],
    questions: [
      Q('q.washer_type', 'What kind of washer is it?', [
        { id: 'washer.front_load', label: 'Front-load', affects: ['prep'], location_hints: ['laundry room'] },
        { id: 'washer.top_load', label: 'Top-load', affects: ['prep'], location_hints: ['laundry room'] }]),
      Q('q.washer_symptom', 'What is it doing?', [
        { id: 'sym.leaking', label: 'Leaking', affects: ['branch', 'prep'], location_hints: ['laundry room'] }]),
      Q('q.washer_leak_source', 'Where is the water coming from?', [
        { id: 'leak.hose', label: 'Hose or connection', affects: ['price', 'minutes', 'prep'], modifier_id: 'mod.leak_hose', location_hints: ['laundry room'] },
        { id: 'leak.door_seal', label: 'Door seal', affects: ['price', 'minutes', 'prep'], modifier_id: 'mod.leak_door_seal', location_hints: ['laundry room'] },
        { id: 'leak.unknown', label: 'Not sure', affects: ['checkout_state'], checkout_state_id: 'chk.diagnostic', evidence: 'unknown' }],
        [{ question_id: 'q.washer_symptom', option_id: 'sym.leaking' }])],
    uncertainty_classes: [
      { id: 'u.washer_type', label: 'Washer type', retired_by: [{ question_id: 'q.washer_type', option_ids: ['washer.front_load', 'washer.top_load'] }], default_weight: 20, weight_basis: 'authored' },
      { id: 'u.symptom', label: 'Symptom', retired_by: [{ question_id: 'q.washer_symptom', option_ids: ['sym.leaking'] }], default_weight: 40, weight_basis: 'authored' },
      { id: 'u.leak_source', label: 'Leak source', retired_by: [{ question_id: 'q.washer_leak_source', option_ids: ['leak.hose', 'leak.door_seal'] }], default_weight: 30, weight_basis: 'authored' }],
    services: [svc], default_compositions: [], decision: REAL.entities.find(e => e.id === 'ent.washer').decision }];
  return f;
}
const W = washerSource(); const WTEXT = lib.toText(W);

console.log('PART A -- the washer, authored by hand from the Playbook\'s worked example');
const base = V.validateFull(lib.clone(W));
check('the validator accepts the Playbook\'s washer, completed so every claimed effect has its cause', base.ok, base.errors.slice(0, 3).map(e => `[${e.code}] ${e.msg}`).join(' | '));
const G = D.derive(lib.clone(W), WTEXT);

// ---- the graph the Playbook implies, written out by hand ----------------------------------------------------------------------------------------------------------------------------------------
console.log('\nThe derived graph is exactly what the Playbook\'s washer implies (hand-written expectation)');
check('one entity owning its three questions, three classes and one service, with no ancestors', same(G.entities, { 'ent.washer': { label: 'Washer', kind: 'component', ancestors: [], owns: { questions: ['q.washer_type', 'q.washer_symptom', 'q.washer_leak_source'], uncertainty_classes: ['u.washer_type', 'u.symptom', 'u.leak_source'], services: ['svc.washer_repair'], default_compositions: [] } } }), JSON.stringify(G.entities));
check('q.washer_leak_source depends on q.washer_symptom = sym.leaking; the other two questions depend on nothing', same(G.questions['q.washer_leak_source'].depends_on, [{ question_id: 'q.washer_symptom', option_id: 'sym.leaking' }]) && G.questions['q.washer_type'].depends_on.length === 0 && G.questions['q.washer_symptom'].depends_on.length === 0);
check('every question is scoped to the washer alone and owned by it', ['q.washer_type', 'q.washer_symptom', 'q.washer_leak_source'].every(q => G.questions[q].owner === 'ent.washer' && same(G.questions[q].scope, { kind: 'entities', entity_ids: ['ent.washer'] })));
check('the answers of each question, in the order authored', same(G.questions['q.washer_type'].option_ids, ['washer.front_load', 'washer.top_load']) && same(G.questions['q.washer_symptom'].option_ids, ['sym.leaking']) && same(G.questions['q.washer_leak_source'].option_ids, ['leak.hose', 'leak.door_seal', 'leak.unknown']));
const B = G.option_bridge;
check('the six options carry their effects: front/top-load prep; leaking branch + prep; hose and door seal price + minutes + prep; "Not sure" checkout_state only', Object.keys(B).length === 6
  && same(B['q.washer_type#washer.front_load'].affects, ['prep']) && same(B['q.washer_type#washer.top_load'].affects, ['prep']) && same(B['q.washer_symptom#sym.leaking'].affects, ['branch', 'prep'])
  && same(B['q.washer_leak_source#leak.hose'].affects, ['price', 'minutes', 'prep']) && same(B['q.washer_leak_source#leak.door_seal'].affects, ['price', 'minutes', 'prep']) && same(B['q.washer_leak_source#leak.unknown'].affects, ['checkout_state']));
check('only "Not sure" is the unknown answer', Object.entries(B).every(([k, v]) => v.unknown === (k === 'q.washer_leak_source#leak.unknown')), JSON.stringify(Object.entries(B).filter(([, v]) => v.unknown).map(x => x[0])));
check('each question retires exactly its own class (an answer set retires, "Not sure" retires nothing)', same(G.retirement_index, { 'q.washer_leak_source': ['u.leak_source'], 'q.washer_symptom': ['u.symptom'], 'q.washer_type': ['u.washer_type'] }) && !JSON.stringify(G.confidence['svc.washer_repair'].classes).includes('leak.unknown'));
{ const c = G.chains['svc.washer_repair'];
  check('the chain asks type, symptom, leak source in that order; the first two are roots; the third opens only on "leaking"', same(c.ask_order, ['q.washer_type', 'q.washer_symptom', 'q.washer_leak_source']) && same(c.roots, ['q.washer_type', 'q.washer_symptom']) && c.edges.length === 1 && c.edges[0].from === 'q.washer_symptom' && c.edges[0].option_id === 'sym.leaking' && c.edges[0].to === 'q.washer_leak_source' && c.max_depth === 1, JSON.stringify(c)); }
{ const c = G.confidence['svc.washer_repair'];
  check('the confidence gate is weighted uncertainty with the Playbook\'s thresholds 0.80 / 0.50 / 0.50', c.gate === 'weighted_uncertainty' && same(c.thresholds, { exact_at: 0.8, range_at: 0.5, diagnostic_below: 0.5 }));
  check('weights 20 / 40 / 30 total 90; each share is its weight over 90; asked at steps 0 / 1 / 2', c.weight_total === 90 && same(c.classes.map(x => x.class_id), ['u.washer_type', 'u.symptom', 'u.leak_source']) && same(c.classes.map(x => x.weight), [20, 40, 30]) && close(c.classes[0].share, 20 / 90) && close(c.classes[1].share, 40 / 90) && close(c.classes[2].share, 30 / 90) && same(c.classes.map(x => x.asked_at_step), [0, 1, 2]));
  check('the three shares add up to 1', close(c.classes.reduce((n, x) => n + x.share, 0), 1)); }
{ const r = G.recovery['svc.washer_repair'];
  check('recovery is composed from the open uncertainty (each open class with the question that can retire it), not a replay of the question list; with no path, diagnostic', r.source === 'current_open_uncertainty' && same(r.open_uncertainty, [{ class_id: 'u.washer_type', question_ids: ['q.washer_type'] }, { class_id: 'u.symptom', question_ids: ['q.washer_symptom'] }, { class_id: 'u.leak_source', question_ids: ['q.washer_leak_source'] }]) && r.when_no_path.route === 'diagnostic' && r.when_no_path.checkout_state_id === 'chk.diagnostic', JSON.stringify(r)); }
check('svc.washer_repair is the only service at the point (ent.washer, act.repair, no modifiers)', same(Object.keys(G.composition_index), ['ent.washer|act.repair|']) && same(G.composition_index['ent.washer|act.repair|'].services, ['svc.washer_repair']) && G.composition_index['ent.washer|act.repair|'].curated_only === false && G.composition_index['ent.washer|act.repair|'].modifier_ids.length === 0);
check('the customer\'s words reach the washer: "washing machine", "clothes washer" and "washer" all name ent.washer and nothing else', same(G.alias_index, { 'clothes washer': ['ent.washer'], washer: ['ent.washer'], 'washing machine': ['ent.washer'] }), JSON.stringify(G.alias_index));
check('each priced answer uses its modifier, and nothing else uses them', same(G.used_by.modifiers, { 'mod.leak_door_seal': ['q.washer_leak_source#leak.door_seal'], 'mod.leak_hose': ['q.washer_leak_source#leak.hose'] }));
check('exactly one question prices the quote (the leak source), the symptom changes the quote by routing, the washer type does neither', G.price_influence['q.washer_leak_source'].prices === true && same(G.price_influence['q.washer_leak_source'].price_option_ids, ['leak.hose', 'leak.door_seal']) && G.price_influence['q.washer_symptom'].prices === false && G.price_influence['q.washer_symptom'].changes_quote === true && G.price_influence['q.washer_type'].changes_quote === false);
check('the derivation is reproducible: a second derivation from a fresh parse gives the same bytes', lib.toText(D.derive(JSON.parse(WTEXT), WTEXT)) === lib.toText(G));
check('the derivation reads; it does not write: a deep-frozen source derives and is unchanged', (() => { const fz = o => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(fz); } return o; }; const c = fz(JSON.parse(WTEXT)); try { return lib.toText(D.derive(c, WTEXT)) === lib.toText(G) && lib.toText(c) === WTEXT; } catch (e) { return false; } })());

// ---- the Playbook's rules, each with a mutant of the washer ---------------------------------------------------------------------------------------------------------------------------------------
console.log('\nEach Playbook rule has a mutant of the washer that the validator refuses, with the right code');
const mutant = (label, codes, run) => { const s = lib.clone(W); run(s); const r = V.validateFull(s); const got = new Set(r.errors.map(e => e.code)); check(`${label} -> ${codes.join(' + ')}`, !r.ok && codes.every(c => got.has(c)), `got ${[...got].join(',') || 'nothing (accepted)'}`); };
const ent = s => s.entities[0], qn = (s, id) => ent(s).questions.find(q => q.id === id), cls = (s, id) => ent(s).uncertainty_classes.find(c => c.id === id), svc = s => ent(s).services[0];
mutant('"Not sure" retires the leak-source uncertainty (R-INTAKE-NONRETIRING)', ['V-UNC-RETIRE-UNKNOWN'], s => { cls(s, 'u.leak_source').retired_by[0].option_ids.push('leak.unknown'); });
mutant('the leak source is retired only by "Not sure": it could never be retired', ['V-UNC-RETIRE-UNKNOWN', 'V-UNC-UNREACHABLE'], s => { cls(s, 'u.leak_source').retired_by[0].option_ids = ['leak.unknown']; });
mutant('a question with no entity_scope (question scope)', ['V-SCOPE-MISSING'], s => { qn(s, 'q.washer_type').entity_scope = []; });
mutant('a question scoped to an entity that does not exist', ['V-REF-DANGLING'], s => { qn(s, 'q.washer_type').entity_scope = ['ent.washer', 'ent.dryer']; });
mutant('a question under the washer scoped to someone else', ['V-SCOPE-OWNER'], s => { qn(s, 'q.washer_type').entity_scope = ['ent.dryer']; });
mutant('a dependency on an answer the prerequisite does not have (dependencies are first-class data)', ['V-DEP-OPTION'], s => { qn(s, 'q.washer_leak_source').depends_on[0].option_id = 'sym.vibrating'; });
mutant('the symptom depends on the leak source it gates: a cycle', ['V-DEP-CYCLE'], s => { qn(s, 'q.washer_symptom').depends_on = [{ question_id: 'q.washer_leak_source', option_id: 'leak.hose' }]; });
mutant('an option claims "price" and nothing prices it (option effects are real)', ['V-OPT-EFFECT'], s => { qn(s, 'q.washer_type').options[0].affects.push('price'); });
mutant('an option that carries a priced modifier does not declare "price"', ['V-OPT-EFFECT'], s => { qn(s, 'q.washer_leak_source').options[0].affects = ['minutes', 'prep']; });
mutant('an option without an id (stable identity)', ['V-ID-MISSING'], s => { delete qn(s, 'q.washer_type').options[0].id; });
mutant('two answers of one question with one label', ['V-OPT-LABEL-DUP'], s => { qn(s, 'q.washer_type').options[1].label = 'Front-load'; });
mutant('the service counts a class it never asks about (service-specific profile)', ['V-UNC-PROFILE-UNASKED'], s => { svc(s).intake.steps = svc(s).intake.steps.filter(st => st.question_id !== 'q.washer_leak_source'); });
mutant('thresholds on the 0-100 scale (the scale is explicit: 0-1)', ['V-CONF-THRESHOLD'], s => { Object.assign(svc(s).confidence_policy, { exact_at: 80, range_at: 50, diagnostic_below: 50 }); });
mutant('thresholds out of order', ['V-CONF-THRESHOLD'], s => { Object.assign(svc(s).confidence_policy, { exact_at: 0.4, range_at: 0.5, diagnostic_below: 0.5 }); });
mutant('a service with a confidence bar and no gate (absent is never certainty)', ['V-CONF-GATE-MISSING'], s => { delete svc(s).confidence_gate; });
mutant('recovery that is not composed from open uncertainty', ['V-COMP-RECOVERY'], s => { svc(s).recovery_affordances.source = 'entity_default_questions'; });
mutant('a service without its action_id (component/action identity is authored)', ['V-SCHEMA'], s => { delete svc(s).action_id; });
mutant('a service that names an action that does not exist', ['V-REF-DANGLING'], s => { svc(s).action_id = 'act.exorcise'; });
mutant('a second curated service at the same (entity, action, no modifiers) point: undeclared ambiguity', ['V-COMP-AMBIGUOUS'], s => { const t = lib.clone(svc(s)); t.id = 'svc.washer_repair_express'; ent(s).services.push(t); });
mutant('a label standing where an id belongs', ['V-REF-LABEL'], s => { qn(s, 'q.washer_leak_source').depends_on = [{ question_id: 'What is it doing?', option_id: 'Leaking' }]; });

// ---- labels are presentation; order is not meaning --------------------------------------------------------------------------------------------------------------------------------------------
console.log('\nLabels are presentation and order is not meaning');
const idKeyed = g => ({ chains: g.chains, confidence: g.confidence, retirement_index: g.retirement_index, recovery: g.recovery, composition_index: g.composition_index, used_by: g.used_by, price_influence: g.price_influence, alias_index: g.alias_index });
{ const s = lib.clone(W); ent(s).label = 'Laundry washer'; for (const q of ent(s).questions) { q.prompt = 'Reworded: ' + q.prompt; for (const o of q.options) o.label = 'Renamed ' + o.label; } for (const c of ent(s).uncertainty_classes) c.label = 'Renamed ' + c.label;
  const r = V.validateFull(s); check('renaming every label leaves the source valid', r.ok, r.errors.slice(0, 2).map(e => e.code).join());
  const g2 = D.derive(s, lib.toText(s)); const rest = g => { const x = idKeyed(g); delete x.alias_index; return x; };
  check('... and every id-keyed index of the derived graph is identical (chains, confidence, retirement, recovery, composition, usage, price influence)', same(rest(g2), rest(G)));
  check('... except the customer vocabulary, which follows the entity\'s name by design: the new name reaches the washer, the aliases still do, and no id is guessed', same(g2.alias_index, { 'clothes washer': ['ent.washer'], 'laundry washer': ['ent.washer'], 'washing machine': ['ent.washer'] }), JSON.stringify(g2.alias_index));
  check('... only the labels moved', g2.option_bridge['q.washer_type#washer.front_load'].label === 'Renamed Front-load' && g2.entities['ent.washer'].label === 'Laundry washer'); }
{ const s = lib.clone(W); qn(s, 'q.washer_leak_source').options.reverse(); cls(s, 'u.leak_source').retired_by[0].option_ids.reverse(); ent(s).aliases.reverse();
  const r = V.validateFull(s); check('reversing the answers of a question (and the retirement lists) leaves the source valid', r.ok, r.errors.slice(0, 2).map(e => e.code).join());
  const g2 = D.derive(s, lib.toText(s)); const norm = g => { const x = JSON.parse(JSON.stringify(idKeyed(g))); x.confidence['svc.washer_repair'].classes.forEach(c => c.retired_by.forEach(rb => rb.option_ids.sort())); x.price_influence['q.washer_leak_source'].price_option_ids.sort(); return x; };
  check('... and the derived chains, confidence, retirement and composition mean the same thing', same(norm(g2), norm(G))); }
{ const s = lib.clone(W); ent(s).questions.reverse(); const r = V.validateFull(s); check('reversing the order the entity lists its questions leaves the source valid (the chain, not the list, orders what is asked)', r.ok, r.errors.slice(0, 2).map(e => e.code).join());
  const g2 = D.derive(s, lib.toText(s)); check('... and the service\'s ask order does not change', same(g2.chains['svc.washer_repair'].ask_order, G.chains['svc.washer_repair'].ask_order)); }

// ---- the same tiny source goes through every publish gate -----------------------------------------------------------------------------------------------------------------------------------------
console.log('\nA different source publishes through the same gates (the gates are not tuned to the catalog)');
{ const r = P.run({ sourceText: WTEXT, committedText: null, check: false }); check('every gate passes on the washer source', r.ok, JSON.stringify(r.refusals).slice(0, 300));
  check('the washer artifact is its own: it names the washer source by hash and holds the same indexes as the catalog artifact', r.ok && r.graph.$source.sha256 === lib.sha(WTEXT) && same(Object.keys(r.graph).sort(), Object.keys(JSON.parse(fs.readFileSync(lib.PATHS.graph, 'utf8'))).sort()));
  const bad = lib.clone(W); qn(bad, 'q.washer_type').options[0].id = qn(bad, 'q.washer_type').options[1].id; const rb = P.run({ sourceText: lib.toText(bad), committedText: null, check: false });
  check('and the gate refuses a broken washer, naming the rule', !rb.ok && rb.refusals[0].gate === 'G-SOURCE' && /V-ID-DUPLICATE/.test(rb.refusals[0].msg), JSON.stringify(rb.refusals).slice(0, 200)); }

// =====================================================================================================================================================================================================
// PART B -- a reference sample read off btnyc.json by hand
// =====================================================================================================================================================================================================
console.log('\nPART B -- three real services, typed from btnyc.json, against the published artifact');
const ART = JSON.parse(fs.readFileSync(lib.PATHS.graph, 'utf8')); const LEGACY = lib.readJson(lib.PATHS.legacy);
const legacySvc = id => LEGACY.services.find(s => s.id === id);
// Each row is what btnyc.json says, typed by hand: the service_type, the intake_chain modules in order, a branch (answer label -> modules it opens) where there is one, and the confidence thresholds (percent).
const HAND = [
  { id: 'toilet_install', type: 'Install', entity: 'ent.toilet', action: 'act.install', modules: ['removal', 'toilet_style_pref'], branch: null, minimum_quote_confidence: 80, diagnostic_threshold: 40 },
  { id: 'cable_management', type: 'Install', entity: 'ent.cables', action: 'act.install', modules: ['cable_install_item', 'mounting_height'], branch: { from: 'cable_install_item', option: 'hide_or_run_cables_through_a_wall_floor', to: 'wall_type' }, diagnostic_threshold: 30 },
  { id: 'wall_hole_or_crack_repair', type: 'Repair', entity: 'ent.drywall', action: 'act.repair', modules: ['wall_type', 'dmg_size', 'mounting_height'], branch: { from: 'wall_type', option: 'drywall_standard', to: 'dmg_size' }, minimum_quote_confidence: 90, diagnostic_threshold: 0 },
];
for (const h of HAND) {
  const L = legacySvc(h.id), sid = 'svc.' + h.id;
  check(`${h.id}: btnyc.json says ${h.type} and the chain ${h.modules.join(' > ')} (the hand table matches the legacy file it was typed from)`, L.service_type === h.type && h.modules.every(m => L.intake_chain.some(e => e.module === m)) && (h.minimum_quote_confidence === undefined || L.confidence_strategy.minimum_quote_confidence === h.minimum_quote_confidence) && L.confidence_strategy.diagnostic_threshold === h.diagnostic_threshold);
  const point = Object.values(ART.composition_index).find(p => p.services.includes(sid));
  check(`${h.id}: the artifact files it at (${h.entity}, ${h.action})`, !!point && point.entity_id === h.entity && point.action_id === h.action, JSON.stringify(point));
  const ask = ART.chains[sid].ask_order;
  check(`${h.id}: the legacy modules ${h.modules.join(', ')} are asked in the legacy order`, h.modules.every(m => ask.some(q => q === 'q.' + m || q.startsWith('q.' + m + '.'))) && h.modules.map(m => ask.findIndex(q => q === 'q.' + m || q.startsWith('q.' + m + '.'))).every((x, i, a) => i === 0 || x > a[i - 1]), ask.join());
  if (h.branch) { const e = ART.chains[sid].edges.find(x => x.from === 'q.' + h.branch.from && x.to === 'q.' + h.branch.to && x.option_id === h.branch.option); check(`${h.id}: ${h.branch.from} = ${h.branch.option} opens ${h.branch.to}`, !!e, JSON.stringify(ART.chains[sid].edges.slice(0, 3))); }
  else check(`${h.id}: the chain has no branch (every then map is empty in btnyc.json)`, ART.chains[sid].edges.length === 0 && L.intake_chain.every(e => !e.then || Object.keys(e.then).length === 0));
  const t = ART.confidence[sid].thresholds;
  check(`${h.id}: thresholds are the legacy percentages on the 0-1 scale (diagnostic ${h.diagnostic_threshold / 100}${h.minimum_quote_confidence !== undefined ? ', exact ' + h.minimum_quote_confidence / 100 : ''})`, close(t.diagnostic_below, h.diagnostic_threshold / 100) && close(t.range_at, h.diagnostic_threshold / 100) && (h.minimum_quote_confidence === undefined || close(t.exact_at, h.minimum_quote_confidence / 100)), JSON.stringify(t));
}
check('a hand row that disagreed with the artifact would be seen (counterfactual)', (() => { const t = ART.confidence['svc.toilet_install'].thresholds; return !close(t.exact_at, 0.85); })());

console.log(`\n[Entity-first independent: the Playbook's washer, and a hand-read reference sample] ${passed} passed, ${failed} failed (of ${passed + failed} checks)`);
process.exit(failed ? 1 : 0);
