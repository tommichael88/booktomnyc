#!/usr/bin/env node
/**
 * verify_entity_first_validator.js -- the entity-first source validator can FAIL, for every class of defect it claims to catch (T175; R-TEST-CANFAIL, R-DOMAIN-SHAPE).
 *
 * @enforces R-TEST-CANFAIL
 * @enforces R-SYSTEM-IDENTITY
 * @enforces R-DOMAIN-SHAPE
 * @detects DEFECT-TEST-CANTFAIL
 * @detects DEFECT-SILENT-SKIP
 * @detects DEFECT-NAMES-AS-KEYS
 *
 * THE DEFECT-SHAPE. ssot/btnyc_source.json is the authored source of the catalog; test_harness/tools/entity_first/validate_source.js is the only thing that stands between a bad edit (a missing id, a
 * dangling reference, a question nobody scopes, an option that claims an effect it does not have, a confidence threshold nothing can meet, a "not sure" answer that retires uncertainty, two services
 * at one composition point) and a derived graph the runtime would trust. A validator that was only ever run on the GOOD source proves nothing: it would pass whether or not it checked anything.
 *
 * WHAT IS HELD (a property of the validator, per rule code, not of any one id in the catalog):
 *   1. Baseline: the real source validates (zero errors, schema included), so a mutant that fails fails because of its mutation.
 *   2. Counterfactual, per class: for each rule code V-* the validator can emit, at least one mutant of the real source -- found by property, not by a hard-coded id -- is REJECTED WITH THAT CODE.
 *      A mutant the validator accepts, or rejects under another code only, fails the test. The validator must report; if it throws on invalid input that fails too.
 *   3. Completeness: the codes that validate_source.js emits are read from its text; a code with no mutant here fails. Adding a rule without a mutant is not possible.
 *   4. Declared gaps are not errors and not defaults: an unknown answer with a cost effect, a class with no authored weight, a service with no confidence gate are RESIDUALS (reported, counted),
 *      never errors and never silently complete. "Not sure" never retires: an unknown answer in retired_by is rejected, and a class retired only by one is unreachable.
 *   5. Labels are never keys and order is not meaning: renaming every option label of a question, or reversing the entity order, leaves the source valid.
 *   6. Validation reads; it never writes: validate() on a deep-frozen source does not throw and the source is unchanged.
 *   7. The structural schema also fails: a mutant that violates only the JSON Schema is rejected by validateFull, and a schema check that cannot run is a finding, never a pass.
 *
 * Node + python3 (jsonschema) only; no browser, no network.
 */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = process.env.BTNYC_ROOT ? path.resolve(process.env.BTNYC_ROOT) : path.resolve(__dirname, '..');
process.env.BTNYC_ROOT = ROOT;
const EF = path.join(__dirname, 'tools', 'entity_first');
const lib = require(path.join(EF, 'lib.js'));
const V = require(path.join(EF, 'validate_source.js'));

let passed = 0, failed = 0;
const check = (label, ok, detail) => { if (ok) { passed++; console.log(`  ✓ ${label}`); } else { failed++; console.log(`  ✗ ${label}${detail ? ' -- ' + detail : ''}`); } };

const SRC = lib.readJson(lib.PATHS.source);

// ---- finding sites by property ------------------------------------------------------------------------------------------------------------------------------------------------
const questionsOf = s => [...s.entities.flatMap(e => e.questions), ...s.shared_questions];
const classesOf = s => [...s.entities.flatMap(e => e.uncertainty_classes), ...s.shared_uncertainty_classes];
const ownersOf = s => s.entities.flatMap(e => [...e.services, ...e.default_compositions]);
const servicesOf = s => s.entities.flatMap(e => e.services);
const need = (x, what) => { if (x === undefined || x === null) throw new Error('no site for the mutant: ' + what); return x; };
const optsOf = (s, q) => q.options || (q.instance_of ? questionsOf(s).find(x => x.id === q.instance_of).options : undefined);
const gated = s => ownersOf(s).filter(o => o.confidence_gate && o.confidence_gate.mode === 'weighted_uncertainty' && o.uncertainty_profile.length >= 2);
const askersOf = (s, qid) => new Set(ownersOf(s).filter(o => o.intake.steps.some(st => st.question_id === qid)).map(o => o.entity_id));

// ---- the mutants: each is { id, expect: [codes that must appear], absent: [codes that must NOT appear], via, run(src) } -----------------------------------------------------------------------
const M = [];
const mut = (id, expect, run, extra = {}) => M.push(Object.assign({ id, expect, absent: [], via: 'semantic', run }, extra));

// V-SCHEMA (the fields the semantic rules read)
mut('top-level section removed', ['V-SCHEMA'], s => { delete s.entities; });
mut('entity kind outside the vocabulary', ['V-SCHEMA'], s => { s.entities[0].kind = 'noun_phrase'; });
mut('entity without its questions array', ['V-SCHEMA'], s => { delete s.entities[0].questions; });
mut('question without a prompt', ['V-SCHEMA'], s => { delete need(questionsOf(s).find(q => q.prompt), 'a question with a prompt').prompt; });
// V-ID-*
mut('option without an id', ['V-ID-MISSING'], s => { delete need(questionsOf(s).find(q => q.options), 'a question with options').options[0].id; });
mut('question without an id', ['V-ID-MISSING'], s => { delete s.entities.find(e => e.questions.length).questions[0].id; });
mut('id whose prefix is another type', ['V-ID-PREFIX'], s => { const q = s.entities.find(e => e.questions.length).questions[0]; q.id = 'svc.' + q.id.slice(2); });
mut('two options of a question share an id', ['V-ID-DUPLICATE'], s => { const q = need(questionsOf(s).find(x => x.options && x.options.length > 1), 'a question with two options'); q.options[1].id = q.options[0].id; });
mut('two questions share an id', ['V-ID-DUPLICATE'], s => { const e = s.entities.find(x => x.questions.length > 1); e.questions[1].id = e.questions[0].id; });
mut('service listed twice in service_order', ['V-ID-DUPLICATE'], s => { s.registries.service_order.push(s.registries.service_order[0]); });
// V-REF-*
mut('service names an action that does not exist', ['V-REF-DANGLING'], s => { servicesOf(s)[0].action_id = 'act.no_such_action'; });
mut('id-shaped value in a free-form field names nothing', ['V-REF-DANGLING'], s => { s.registries.tags[0].note_for_editors = 'ent.no_such_entity'; });
mut('id-shaped KEY names nothing', ['V-REF-DANGLING'], s => { s.policy.stray = { 'svc.ghost_service': 1 }; });
mut('service missing from service_order', ['V-REF-DANGLING'], s => { s.registries.service_order.pop(); });
mut('reference site holds an id of the wrong type', ['V-REF-TYPE'], s => { const v = servicesOf(s)[0]; v.entity_id = v.action_id; });
mut('a label where an id belongs', ['V-REF-LABEL'], s => { servicesOf(s)[0].action_id = 'Repair'; });
mut('label-keyed dependency term', ['V-REF-LABEL'], s => { const st = need(ownersOf(s).flatMap(o => o.intake.steps).find(x => x.depends_on.length), 'a gated step'); st.depends_on = [{ module: 'device_type', label: 'Laptop' }]; });
mut('route_to answer keyed by module and label', ['V-REF-LABEL'], s => { const o = need(questionsOf(s).flatMap(q => q.options || []).find(x => x.route_to), 'a routing option'); o.route_to.answers = [{ device_type: 'Laptop' }]; });
mut('tag answers as a label-keyed object', ['V-REF-LABEL'], s => { const t = need(s.registries.tags.find(x => Array.isArray(x.answers) && x.answers.length), 'a tag with answers'); t.answers = { device_type: ['Laptop'] }; });
// V-SCOPE-*
mut('question without entity_scope', ['V-SCOPE-MISSING'], s => { delete questionsOf(s)[0].entity_scope; });
mut('question with an empty entity_scope', ['V-SCOPE-MISSING'], s => { questionsOf(s)[0].entity_scope = []; });
mut('entity_scope in no recognised shape', ['V-SCOPE-MISSING'], s => { questionsOf(s)[0].entity_scope = 'everyone'; });
mut('an entity asks a question it is not scoped to', ['V-SCOPE-ASKER'], s => {
  const q = need(s.shared_questions.find(x => Array.isArray(x.entity_scope) && x.entity_scope.length >= 3 && x.entity_scope.some(e => askersOf(s, x.id).has(e))), 'a shared question that is asked');
  const a = [...askersOf(s, q.id)].find(e => q.entity_scope.includes(e)); q.entity_scope = q.entity_scope.filter(e => e !== a);
});
mut('an entity deep-dives a question its entity_scope omits (a deep-dive question is a use)', ['V-SCOPE-ASKER'], s => {
  const u = need(ownersOf(s).find(o => o.recovery_affordances.deep_dive_question_ids.length), 'a unit with a deep-dive question'); const q = need(questionsOf(s).find(x => x.id === u.recovery_affordances.deep_dive_question_ids[0]), 'its question');
  q.entity_scope = s.entities.filter(e => e.id !== u.entity_id).slice(0, 2).map(e => e.id);
});
mut('an entity is scoped to a question it never asks', ['V-SCOPE-CLAIM'], s => {
  const e = s.entities.find(x => x.questions.some(q => q.entity_scope.length === 1 && !q.instance_of)); const q = e.questions.find(x => x.entity_scope.length === 1 && !x.instance_of);
  const other = need(s.entities.find(x => x.id !== e.id && !askersOf(s, q.id).has(x.id)), 'an entity that does not ask the question'); q.entity_scope.push(other.id);
});
mut('an entity is listed twice in one scope', ['V-SCOPE-CLAIM'], s => { const q = s.entities.find(x => x.questions.length).questions[0]; q.entity_scope = [q.entity_scope[0], q.entity_scope[0]]; });
mut('a question lives under an entity its scope omits', ['V-SCOPE-OWNER'], s => { const e = s.entities.find(x => x.questions.length); const other = s.entities.find(x => x.id !== e.id); e.questions[0].entity_scope = [other.id]; });
mut('a shared question scoped to a single entity', ['V-SCOPE-OWNER'], s => { const q = s.shared_questions.find(x => Array.isArray(x.entity_scope)); q.entity_scope = [q.entity_scope[0]]; });
mut('a question under an entity is context-scoped', ['V-SCOPE-OWNER'], s => { s.entities.find(x => x.questions.length).questions[0].entity_scope = { context: s.registries.contexts[0].id }; });
// V-DEP-*
mut('depends_on is not an array', ['V-DEP-SHAPE'], s => { need(ownersOf(s).flatMap(o => o.intake.steps)[0], 'a step').depends_on = {}; });
mut('any_of with no alternatives', ['V-DEP-SHAPE'], s => { const st = ownersOf(s).flatMap(o => o.intake.steps)[0]; st.depends_on = [{ any_of: [] }]; });
mut('a question is a step twice in one chain', ['V-DEP-SHAPE'], s => { const o = ownersOf(s).find(x => x.intake.steps.length > 1); o.intake.steps.push(Object.assign({}, o.intake.steps[0])); });
mut('dependency names an answer the question does not have', ['V-DEP-OPTION'], s => { const o = ownersOf(s).find(x => x.intake.steps.length > 1 && questionsOf(s).find(q => q.id === x.intake.steps[0].question_id && q.options)); o.intake.steps[1].depends_on = [{ question_id: o.intake.steps[0].question_id, option_id: 'not_an_answer' }]; });
mut('retirement names an answer the question does not have', ['V-DEP-OPTION'], s => { const c = classesOf(s).find(x => x.retired_by.some(r => r.option_ids)); c.retired_by[0].option_ids = ['not_an_answer']; });
mut('route_to names an answer the question does not have', ['V-DEP-OPTION'], s => { const o = questionsOf(s).flatMap(q => q.options || []).find(x => x.route_to && x.route_to.answers.length); o.route_to.answers[0].option_id = 'not_an_answer'; });
mut('step depends on a question outside its chain (the gate can never open)', ['V-DEP-NOTINCHAIN'], s => {
  const o = ownersOf(s).find(x => x.intake.steps.length > 1); const inChain = new Set(o.intake.steps.map(t => t.question_id));
  const q = need(questionsOf(s).find(x => x.options && !inChain.has(x.id)), 'a question outside the chain'); o.intake.steps[o.intake.steps.length - 1].depends_on = [{ question_id: q.id, option_id: q.options[0].id }];
});
mut('step depends on itself', ['V-DEP-SELF'], s => { const o = ownersOf(s).find(x => x.intake.steps.some(st => questionsOf(s).find(q => q.id === st.question_id && q.options))); const st = o.intake.steps.find(t => questionsOf(s).find(q => q.id === t.question_id && q.options)); const q = questionsOf(s).find(x => x.id === st.question_id); st.depends_on = [{ question_id: q.id, option_id: q.options[0].id }]; });
mut('question depends on itself', ['V-DEP-SELF'], s => { const q = questionsOf(s).find(x => x.options && !x.instance_of); q.depends_on = [{ question_id: q.id, option_id: q.options[0].id }]; });
mut('two steps of a chain depend on each other', ['V-DEP-CYCLE'], s => {
  const has = st => { const q = questionsOf(s).find(x => x.id === st.question_id); return q && q.options; };
  const o = ownersOf(s).find(x => x.intake.steps.filter(has).length >= 2); const [a, b] = o.intake.steps.filter(has);
  const qa = questionsOf(s).find(x => x.id === a.question_id), qb = questionsOf(s).find(x => x.id === b.question_id);
  a.depends_on = [{ question_id: b.question_id, option_id: qb.options[0].id }]; b.depends_on = [{ question_id: a.question_id, option_id: qa.options[0].id }];
});
mut('two questions depend on each other', ['V-DEP-CYCLE'], s => {
  const qs = questionsOf(s).filter(x => x.options && !x.instance_of); const a = qs[0], b = qs[1];
  a.depends_on = [{ question_id: b.id, option_id: b.options[0].id }]; b.depends_on = [{ question_id: a.id, option_id: a.options[0].id }];
});
// V-UNC-*
mut('uncertainty weight is not positive', ['V-UNC-WEIGHT'], s => { classesOf(s).find(c => typeof c.default_weight === 'number').default_weight = -3; });
mut('uncertainty weight without a declared basis', ['V-UNC-WEIGHT'], s => { delete classesOf(s).find(c => typeof c.default_weight === 'number').weight_basis; });
mut('a class with a weight claims to be unauthored', ['V-UNC-WEIGHT'], s => { classesOf(s).find(c => typeof c.default_weight === 'number').weight_basis = 'unauthored'; });
mut('profile weight is zero', ['V-UNC-WEIGHT'], s => { gated(s)[0].uncertainty_profile[0].weight = 0; });
mut('a class nothing retires', ['V-UNC-RETIRE'], s => { classesOf(s)[0].retired_by = []; });
mut('a retirement with no qualifying answers', ['V-UNC-RETIRE'], s => { const c = classesOf(s).find(x => x.retired_by.some(r => r.option_ids)); c.retired_by = [{ question_id: c.retired_by[0].question_id }]; });
// the mutants must not depend on the catalog still having a residual to mutate: when no answer is classified "not sure" yet, one is made
const unknownOption = s => { for (const q of questionsOf(s)) for (const o of q.options || []) if (o.evidence === 'unknown') return { q, o }; const q = need(questionsOf(s).find(x => x.options && x.options.length > 1), 'a question with two answers'); q.options[0].evidence = 'unknown'; return { q, o: q.options[0] }; };
mut('"not sure" retires an uncertainty class', ['V-UNC-RETIRE-UNKNOWN'], s => {
  const { q, o } = unknownOption(s); const real = need((q.options || []).find(x => x.evidence !== 'unknown'), 'a qualifying answer beside the unknown one');
  const c = classesOf(s).find(x => x.retired_by.some(r => r.option_ids)); c.retired_by = [{ question_id: q.id, option_ids: [o.id, real.id] }];
}, { absent: ['V-UNC-UNREACHABLE'] });
mut('a class retired only by "not sure" can never be retired', ['V-UNC-RETIRE-UNKNOWN', 'V-UNC-UNREACHABLE'], s => { const { q, o } = unknownOption(s); const c = classesOf(s).find(x => x.retired_by.some(r => r.option_ids)); c.retired_by = [{ question_id: q.id, option_ids: [o.id] }]; });
mut('an entity-owned class retired by a question outside that entity', ['V-UNC-SCOPE'], s => {
  const e = s.entities.find(x => x.uncertainty_classes.length); const c = e.uncertainty_classes[0];
  const q = need(questionsOf(s).find(x => Array.isArray(x.entity_scope) && !x.entity_scope.includes(e.id) && x.options && x.options.some(o => o.evidence !== 'unknown')), 'a question outside the entity'); c.retired_by = [{ question_id: q.id, option_ids: [q.options.find(o => o.evidence !== 'unknown').id] }];
});
mut('a service counts a class it never asks about', ['V-UNC-PROFILE-UNASKED'], s => {
  const o = gated(s)[0]; const inChain = new Set(o.intake.steps.map(t => t.question_id)); const have = new Set(o.uncertainty_profile.map(p => p.class_id));
  const c = need(classesOf(s).find(x => !have.has(x.id) && !x.retired_by.some(r => inChain.has(r.question_id))), 'a class the service does not ask'); o.uncertainty_profile.push({ class_id: c.id, weight: 1 });
});
mut('a class is in a profile twice', ['V-UNC-PROFILE-DUP'], s => { const o = gated(s)[0]; o.uncertainty_profile.push(Object.assign({}, o.uncertainty_profile[0])); });
// V-CONF-*
mut('a service without a confidence_policy', ['V-CONF-POLICY'], s => { delete ownersOf(s)[0].confidence_policy; });
mut('a threshold missing from the policy', ['V-CONF-POLICY'], s => { delete ownersOf(s)[0].confidence_policy.exact_at; });
mut('a policy that does not say where its thresholds came from', ['V-CONF-POLICY'], s => { delete ownersOf(s)[0].confidence_policy.policy_sources; });
mut('exact_at outside (0, 1]', ['V-CONF-THRESHOLD'], s => { ownersOf(s)[0].confidence_policy.exact_at = 1.5; });
mut('thresholds out of order', ['V-CONF-THRESHOLD'], s => { const p = ownersOf(s)[0].confidence_policy; p.exact_at = 0.5; p.range_at = 0.9; p.diagnostic_below = 0.1; });
mut('thresholds on the wrong scale', ['V-CONF-THRESHOLD'], s => { ownersOf(s)[0].confidence_policy.scale = '0-100'; });
mut('exact_at that no answer set can reach', ['V-CONF-IMPOSSIBLE'], s => {
  const o = gated(s).find(x => x.confidence_policy.exact_at > 0.5); const p0 = o.uncertainty_profile[0]; p0.weight = 100000;
  const c = classesOf(s).find(x => x.id === p0.class_id); const st = o.intake.steps.find(t => t.question_id === c.retired_by[0].question_id); const q = questionsOf(s).find(x => x.id === st.question_id); const opt = (q.options || [])[0];
  need(opt, 'a retiring question with options'); opt.evidence = 'unknown'; c.retired_by = [{ question_id: q.id, option_ids: [opt.id] }];
});
mut('a service with no confidence_gate (absent is never certainty)', ['V-CONF-GATE-MISSING'], s => { delete gated(s)[0].confidence_gate; });
mut('a confidence-gated service with an empty profile', ['V-CONF-GATE-MISSING'], s => { gated(s)[0].uncertainty_profile = []; });
mut('gate "none" that still carries a profile', ['V-CONF-GATE-MISSING'], s => { gated(s)[0].confidence_gate = { mode: 'none', reason: 'no gate' }; });
mut('gate "none" that does not say why', ['V-CONF-GATE-MISSING'], s => { const o = ownersOf(s).find(x => x.confidence_gate.mode === 'none') || gated(s)[0]; o.confidence_gate = { mode: 'none', reason: 'a stated reason' }; o.uncertainty_profile = []; delete o.confidence_gate.reason; });
// V-OPT-*
mut('an option that declares no affects', ['V-OPT-EFFECT'], s => { delete questionsOf(s).find(q => q.options).options[0].affects; });
mut('an option affects something that is not an effect', ['V-OPT-EFFECT'], s => { questionsOf(s).find(q => q.options).options[0].affects = ['vibes']; });
mut('an option claims a price effect nothing causes', ['V-OPT-EFFECT'], s => { const o = questionsOf(s).flatMap(q => q.options || []).find(x => !x.affects.includes('price') && !x.modifier_id && !x.formula_id); o.affects = [...o.affects, 'price']; });
mut('an option carries tags but does not declare the effect', ['V-OPT-EFFECT'], s => { const o = questionsOf(s).flatMap(q => q.options || []).find(x => x.tag_ids && x.tag_ids.length); o.affects = o.affects.filter(a => a !== 'tags'); });
mut('an option carries a priced modifier but does not declare price', ['V-OPT-EFFECT'], s => { const mods = new Map(s.registries.modifiers.map(m => [m.id, m])); const o = questionsOf(s).flatMap(q => q.options || []).find(x => x.modifier_id && Number(mods.get(x.modifier_id).fee) !== 0 && x.affects.includes('price')); o.affects = o.affects.filter(a => a !== 'price'); });
mut('an option lists an effect twice', ['V-OPT-EFFECT'], s => { const o = questionsOf(s).flatMap(q => q.options || []).find(x => x.affects.length); o.affects = [o.affects[0], o.affects[0]]; });
mut('evidence that is not "unknown"', ['V-OPT-EFFECT'], s => { questionsOf(s).find(q => q.options).options[0].evidence = 'probably'; });
mut('two answers of a question share a label', ['V-OPT-LABEL-DUP'], s => { const q = questionsOf(s).find(x => x.options && x.options.length > 1); q.options[1].label = q.options[0].label; });
// V-COMP-*
mut('a service filed under an entity it does not name', ['V-COMP-OWNER'], s => { const e = s.entities.find(x => x.services.length); e.services[0].entity_id = s.entities.find(x => x.id !== e.id).id; });
mut('a service without a financial engine', ['V-COMP-PRICING'], s => { delete servicesOf(s)[0].pricing.financial_engine; });
mut('a service that names two pricing paths', ['V-COMP-PRICING'], s => { const v = servicesOf(s).find(x => x.pricing.engine !== undefined); v.pricing.formula_id = s.registries.pricing_formulas[0].id; });
mut('a service that names no pricing path', ['V-COMP-PRICING'], s => { const v = servicesOf(s).find(x => x.pricing.engine !== undefined); delete v.pricing.engine; });
mut('a service with neither a checkout state nor the class it inherits one from', ['V-COMP-CHECKOUT'], s => { const fe = servicesOf(s)[0].pricing.financial_engine; delete fe.checkout_state; delete fe._inherits_checkout_state_from_archetype; });
mut('a service without recovery_affordances', ['V-COMP-RECOVERY'], s => { delete ownersOf(s)[0].recovery_affordances; });
mut('recovery that is not composed from open uncertainty', ['V-COMP-RECOVERY'], s => { ownersOf(s)[0].recovery_affordances.source = 'replay_list'; });
mut('recovery with no declared route when nothing can retire the uncertainty', ['V-COMP-RECOVERY'], s => { delete ownersOf(s)[0].recovery_affordances.when_no_path; });
mut('recovery that names a question that does not exist', ['V-REF-DANGLING'], s => { ownersOf(s)[0].recovery_affordances.deep_dive_question_ids = ['q.no_such_question']; });
mut('two curated services at one (entity, action, modifiers) point, undeclared', ['V-COMP-AMBIGUOUS'], s => {
  const e = need(s.entities.find(x => x.services.length > 1 && x.services.every(v => v.decomposition === undefined)), 'an entity with two unambiguous services'); const [a, b] = e.services; b.action_id = a.action_id; b.modifier_ids = a.modifier_ids.slice();
});
mut('an open decomposition that loses its note', ['V-COMP-AMBIGUOUS'], s => { const v = servicesOf(s).find(x => x.decomposition) || servicesOf(s)[0]; v.decomposition = { status: 'open', note: 'an open business decision' }; delete v.decomposition.note; });
mut('a decomposition that is not open', ['V-COMP-AMBIGUOUS'], s => { servicesOf(s)[0].decomposition = { status: 'closed', note: 'x' }; });
// V-FML-* (T177): the answers a pricing formula reads, stated as data
const formulaOf = (s, id) => need(s.registries.pricing_formulas.find(f => f.id === id), 'formula ' + id);
const inputsOf = (s, fid, role) => formulaOf(s, fid).inputs.filter(i => i.role === role);
const inputOf = (s, fid, role) => need(inputsOf(s, fid, role)[0], `a ${role} input of ${fid}`);
const optionOfQ = (s, qid, oid) => need(need(questionsOf(s).find(q => q.id === qid), qid).options.find(o => o.id === oid), `${qid}/${oid}`);
mut('formula input without a name', ['V-FML-INPUT-SHAPE'], s => { delete inputOf(s, 'fml.tile_repair_formula', 'trigger_modifier').name; });
mut('formula input with a role outside the vocabulary', ['V-FML-INPUT-SHAPE'], s => { inputOf(s, 'fml.tile_repair_formula', 'trigger_modifier').role = 'guess'; });
mut('a booking quantity that reads a question', ['V-FML-INPUT-SHAPE'], s => { inputsOf(s, 'fml.tile_repair_formula', 'quantity').find(i => i.source === 'booking').question_id = 'q.install_type'; });
mut('qty_aware that is not true', ['V-FML-INPUT-SHAPE'], s => { s.registries.pricing_formulas.find(f => f.qty_aware === true).qty_aware = false; });
mut('an input effect outside price / minutes', ['V-FML-INPUT-SHAPE'], s => { inputOf(s, 'fml.hardware_install_formula', 'select_branch').affects = ['price', 'tags']; });
mut('two inputs of one formula share a name', ['V-FML-INPUT-DUP'], s => { const t = inputsOf(s, 'fml.tile_repair_formula', 'trigger_modifier'); t[1].name = t[0].name; });
mut('two inputs read the same answer', ['V-FML-INPUT-DUP'], s => { const t = inputsOf(s, 'fml.tile_repair_formula', 'trigger_modifier'); t[1].question_id = t[0].question_id; t[1].option_ids = t[0].option_ids.slice(); });
mut('an input names an answer the question does not have', ['V-FML-INPUT-OPTION'], s => { inputOf(s, 'fml.tile_repair_formula', 'trigger_modifier').option_ids = ['not_an_answer']; });
mut('an input names no answer at all', ['V-FML-INPUT-OPTION'], s => { inputOf(s, 'fml.tile_repair_formula', 'trigger_modifier').option_ids = []; });
mut('an input names a question that has no options', ['V-FML-INPUT-OPTION'], s => { const q = need(questionsOf(s).find(x => !x.options && !x.instance_of), 'a numeric question'); inputOf(s, 'fml.tile_repair_formula', 'trigger_modifier').question_id = q.id; });
mut('an input names a modifier parameter the formula lacks', ['V-FML-INPUT-PARAM'], s => { inputOf(s, 'fml.tile_repair_formula', 'trigger_modifier').modifier_param = 'no_such_param'; });
mut('a quantity input names a parameter that is not a number', ['V-FML-INPUT-PARAM'], s => { inputOf(s, 'fml.drywall_repair_formula', 'quantity').param = 'patch_modifier_ref'; });
mut('a branch names a parameter set the formula lacks', ['V-FML-INPUT-PARAM'], s => { inputOf(s, 'fml.hardware_install_formula', 'select_branch').branches[0].formula_path = 'no_such_rate'; });
mut('an answer carries its own modifier and the formula charges another', ['V-FML-INPUT-MODIFIER'], s => { optionOfQ(s, 'q.waterproof_area', 'yes_requires_membrane').modifier_id = 'mod.tile_grout'; });
mut('a branch selector with one branch', ['V-FML-BRANCH-COVER'], s => { inputOf(s, 'fml.hardware_install_formula', 'select_branch').branches.pop(); });
mut('a branch selector whose default is no branch', ['V-FML-BRANCH-COVER'], s => { inputOf(s, 'fml.hardware_install_formula', 'select_branch').default_branch = 'nowhere'; });
mut('an answer that selects two branches', ['V-FML-BRANCH-COVER'], s => { const i = inputOf(s, 'fml.hardware_install_formula', 'select_branch'); i.branches[1].option_ids.push(i.branches[0].option_ids[0]); });
mut('an answer of a selector question that selects no branch', ['V-FML-BRANCH-COVER'], s => { const q = questionsOf(s).find(x => x.id === 'q.install_type'); q.options.push({ id: 'something_else', label: 'Something else', affects: [] }); });
mut('an answer with no quantity value', ['V-FML-QTY-VALUES'], s => { inputOf(s, 'fml.drywall_repair_formula', 'quantity').values.pop(); });
mut('a negative quantity value', ['V-FML-QTY-VALUES'], s => { inputOf(s, 'fml.drywall_repair_formula', 'quantity').values[0].value = -1; });
mut('a quantity input with no default for the unanswered question', ['V-FML-QTY-VALUES'], s => { delete inputOf(s, 'fml.drywall_repair_formula', 'quantity').default; });
mut('a counted answer with no qty_value', ['V-FML-QTY-VALUES'], s => { delete optionOfQ(s, 'q.pax_cabinet_count', '2').qty_value; });
// V-MOD-* (T177): a domain condition tells services apart; a fee row prices an answer
const conditionOf = s => need(s.registries.modifiers.find(m => m.role === 'condition'), 'a condition modifier');
mut('a condition modifier that carries a fee', ['V-MOD-ROLE'], s => { conditionOf(s).fee = 5; });
mut('a condition modifier without a basis', ['V-MOD-ROLE'], s => { delete conditionOf(s).basis; });
mut('a modifier role outside the vocabulary', ['V-MOD-ROLE'], s => { conditionOf(s).role = 'surcharge'; });
mut('a service carrying a fee row as its condition', ['V-MOD-ASSIGN'], s => { servicesOf(s)[0].modifier_ids = [s.registries.modifiers.find(m => m.role !== 'condition').id]; });
mut('a service listing a condition twice', ['V-MOD-ASSIGN'], s => { const c = conditionOf(s); servicesOf(s)[0].modifier_ids = [c.id, c.id]; });
mut('an answer charged by a condition modifier', ['V-MOD-ASSIGN'], s => { questionsOf(s).flatMap(q => q.options || []).find(o => o.modifier_id).modifier_id = conditionOf(s).id; });
// V-VOC-* (T177): the customer's words
const entWithAlias = s => need(s.entities.find(e => e.aliases.length), 'an entity with aliases');
mut('an alias that is not lowercase', ['V-VOC-ALIAS-SHAPE'], s => { entWithAlias(s).aliases[0] = 'Mixed Case'; });
mut('an alias that repeats the entity\'s own name', ['V-VOC-ALIAS-SHAPE'], s => { const e = entWithAlias(s); e.aliases.push(e.label.toLowerCase()); });
mut('an alias listed twice by one entity', ['V-VOC-ALIAS-DUP'], s => { const e = entWithAlias(s); e.aliases.push(e.aliases[0]); });
mut('an alias that is another entity\'s name', ['V-VOC-ALIAS-AMBIGUOUS'], s => { const a = entWithAlias(s); const b = need(s.entities.find(e => e.id !== a.id), 'a second entity'); a.aliases.push(b.label.toLowerCase()); });
mut('two entities claiming one alias', ['V-VOC-ALIAS-AMBIGUOUS'], s => { const [a, b] = s.entities.filter(e => e.aliases.length === 0 || true).slice(0, 2); a.aliases.push('a thing both claim'); b.aliases.push('a thing both claim'); });
mut('an NLP object that records the wrong entity', ['V-VOC-OBJECT-RESOLVE'], s => { const o = s.vocabulary.nlp_objects.find(x => x.resolves_to.entity_id); o.resolves_to.entity_id = s.entities.find(e => e.id !== o.resolves_to.entity_id).id; });
mut('an NLP object that records no resolution', ['V-VOC-OBJECT-RESOLVE'], s => { delete s.vocabulary.nlp_objects[0].resolves_to; });
mut('an NLP object claiming a basis it does not have', ['V-VOC-OBJECT-RESOLVE'], s => { const o = s.vocabulary.nlp_objects.find(x => x.resolves_to.basis === 'default_service_entity'); o.resolves_to.basis = 'keyword_is_entity'; });
mut('an action with two vocabulary entries', ['V-VOC-ACTION-DUP'], s => { const av = s.vocabulary.action_vocabulary; av.actions.push(JSON.parse(JSON.stringify(av.actions[0]))); });
mut('an unmapped verb listed twice', ['V-VOC-ACTION-DUP'], s => { const av = s.vocabulary.action_vocabulary; av.unmapped_verbs.push(JSON.parse(JSON.stringify(av.unmapped_verbs[0]))); });
mut('an infinitive that is none of the forms the engine matches', ['V-VOC-ACTION-FORMS'], s => { s.vocabulary.action_vocabulary.actions[0].infinitive_for_adlib = 'zzzz'; });
mut('an action entry with no forms', ['V-VOC-ACTION-FORMS'], s => { s.vocabulary.action_vocabulary.actions[0].all_forms = []; });
mut('an action vocabulary naming an action that does not exist', ['V-REF-DANGLING'], s => { s.vocabulary.action_vocabulary.actions[0].action_id = 'act.no_such_action'; });
// the schema also fails, and a schema check that cannot run is a finding
mut('schema: an unknown property on a service', ['V-SCHEMA'], s => { servicesOf(s)[0].component_id = 'ent.computer'; }, { via: 'full' });
mut('schema: a compiler-owned key in the authored source', ['V-SCHEMA'], s => { s.compiled = { service_index: {} }; }, { via: 'full' });
mut('schema: an id that breaks the grammar', ['V-SCHEMA'], s => { s.entities[0].questions[0].id = 'q.Has Spaces'; }, { via: 'full' });
mut('schema: an option with a label but no affects field type', ['V-SCHEMA'], s => { questionsOf(s).find(q => q.options).options[0].affects = 'price'; }, { via: 'full' });

// ---- 1. baseline ---------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('Baseline');
const base = V.validateFull(lib.clone(SRC));
check('the real source validates with zero errors (schema included)', base.ok && base.errors.length === 0, base.errors.slice(0, 3).map(e => `[${e.code}] ${e.path}`).join('; '));
check('the real source has no option without an id', base.stats.optionsWithoutId === 0, String(base.stats.optionsWithoutId));
check('ids are counted (some are assigned)', base.stats.idsAssigned > 0, String(base.stats.idsAssigned));

// ---- 2. counterfactual, per class ----------------------------------------------------------------------------------------------------------------------------------------
console.log('\nCounterfactual mutants: each must be rejected with its own code');
const seen = new Set(); let crashed = 0;
for (const m of M) {
  const s = lib.clone(SRC);
  let site = null; try { m.run(s); } catch (e) { site = e.message; }
  if (site) { check(`${m.expect[0]}: ${m.id}`, false, 'the mutation could not be applied: ' + site); continue; }
  if (lib.diff(s, SRC) === null) { check(`${m.expect[0]}: ${m.id}`, false, 'the mutation changed nothing'); continue; }
  let r; try { r = m.via === 'full' ? V.validateFull(s) : V.validate(s); } catch (e) { crashed++; check(`${m.expect[0]}: ${m.id}`, false, 'the validator threw instead of reporting: ' + String(e.stack || e).split('\n').slice(0, 2).join(' | ')); continue; }
  const codes = new Set(r.errors.map(e => e.code)); for (const c of m.expect) seen.add(c);
  const missing = m.expect.filter(c => !codes.has(c)), wrong = m.absent.filter(c => codes.has(c));
  check(`${m.expect.join('+')}: ${m.id}`, !r.ok && !missing.length && !wrong.length, r.ok ? 'ACCEPTED' : (missing.length ? `missing ${missing.join(',')}; got ${[...codes].join(',')}` : `wrongly also reported ${wrong.join(',')}`));
}
check('no mutant made the validator throw', crashed === 0, String(crashed));

// ---- 3. completeness: every code the validator emits has a mutant -------------------------------------------------------------------------------------------------------
console.log('\nCompleteness');
const text = fs.readFileSync(path.join(EF, 'validate_source.js'), 'utf8');
const emitted = [...new Set([...text.matchAll(/err\('(V-[A-Z-]+)'/g)].map(m => m[1]))].sort();
check(`the validator emits ${emitted.length} rule codes and each has a mutant (${emitted.filter(c => !seen.has(c)).join(', ') || 'none uncovered'})`, emitted.length >= 10 && emitted.every(c => seen.has(c)));
check('no mutant expects a code the validator does not emit', [...seen].every(c => emitted.includes(c)), [...seen].filter(c => !emitted.includes(c)).join(', '));

// ---- 4. declared gaps are residuals, not errors, not defaults -----------------------------------------------------------------------------------------------------------------------
console.log('\nDeclared gaps are residuals');
const baseSem = V.validate(lib.clone(SRC)); const resKinds = r => r.residuals.reduce((a, x) => (a[x.kind] = (a[x.kind] || 0) + 1, a), {});
{ const s = lib.clone(SRC); const c = classesOf(s).find(x => typeof x.default_weight === 'number' && x.weight_basis !== 'unauthored'); delete c.default_weight; c.weight_basis = 'unauthored';
  const r = V.validate(s); check('a class with no authored weight is a residual, not an error', r.ok && (resKinds(r).uncertainty_weight_unauthored || 0) === (resKinds(baseSem).uncertainty_weight_unauthored || 0) + 1, JSON.stringify(r.errors.slice(0, 2))); }
{ const s = lib.clone(SRC); const c = classesOf(s).find(x => typeof x.default_weight === 'number' && x.weight_basis !== 'unauthored'); delete c.default_weight; const r = V.validate(s);
  check('...but a missing weight that is not declared "unauthored" is an error (a gap is never silently 0 or 100%)', !r.ok && r.errors.some(e => e.code === 'V-UNC-WEIGHT')); }
{ const s = lib.clone(SRC);
  // a priced answer that can be turned into "not sure" without breaking a retirement path: take it out of the classes it retires first (each keeps another qualifying answer)
  const cand = questionsOf(s).flatMap(q => (q.options || []).map(x => ({ q, x }))).find(({ q, x }) => !x.evidence && x.affects.includes('price') && classesOf(s).every(c => {
    const hit = c.retired_by.some(r => r.question_id === q.id && (r.option_ids || []).includes(x.id)); if (!hit) return true;
    return c.retired_by.some(r => r.any_value || (r.option_ids || []).filter(id => !(r.question_id === q.id && id === x.id)).length > 0); }));
  need(cand, 'a priced answer that can become "not sure"');
  for (const c of classesOf(s)) { c.retired_by.forEach(r => { if (r.question_id === cand.q.id && r.option_ids) r.option_ids = r.option_ids.filter(id => id !== cand.x.id); }); c.retired_by = c.retired_by.filter(r => r.any_value || r.option_ids.length); }
  cand.x.evidence = 'unknown'; const r = V.validate(s);
  check('an unknown answer that also changes the price is a residual for the Operator, not an error', r.ok && (resKinds(r).unknown_option_with_cost_effect || 0) === (resKinds(baseSem).unknown_option_with_cost_effect || 0) + 1, JSON.stringify(r.errors.slice(0, 2))); }
{ const s = lib.clone(SRC); const o = gated(s)[0]; o.confidence_gate = { mode: 'none', reason: 'authored without a weighted class' }; o.uncertainty_profile = []; const r = V.validate(s);
  check('a service with no confidence gate, and says why, is a residual (never read as 100%)', r.ok && (resKinds(r).confidence_gate_none || 0) === (resKinds(baseSem).confidence_gate_none || 0) + 1, JSON.stringify(r.errors.slice(0, 2))); }
{ const KNOWN = new Set(['composition_ambiguous', 'uncertainty_weight_unauthored', 'confidence_gate_none', 'recovery_no_authored_path', 'question_asked_by_nothing', 'unknown_option', 'unknown_option_with_cost_effect', 'dangling_legacy_reference', 'group_membership_disagreement',
    'price_claim_indirect', 'price_claim_unwired', 'price_effect_unclaimed', 'nlp_object_unresolved', 'object_term_not_aliased', 'verb_without_action', 'action_without_vocabulary', 'verb_form_shared', 'pricing_archetype_mismatch', 'formula_modifier_without_input', 'condition_modifier_unused']);
  check('every residual the validator reports is of a declared kind and names what it is about (no anonymous gap)', baseSem.residuals.every(r => KNOWN.has(r.kind) && typeof r.id === 'string' && r.id && typeof r.note === 'string' && r.note), [...new Set(baseSem.residuals.filter(r => !KNOWN.has(r.kind)).map(r => r.kind))].join(',')); }

// S4 (#165, RESHAPE_SCOPE_S1_S6.md S4): a group lists its services and a service names its group; they disagree. The validator reports the disagreement and resolves nothing.
// The six below are the measured set (5 services listed by no group, 1 listed by two). Which side is right is an Operator ruling per service (#212 is not that ruling; #165 records the gap).
// RATCHET: the set may shrink (a ruling resolves one) and may never grow (a new disagreement fails here); the pin is the audit evidence, not a decision about the data.
{ const S4_PINNED = new Set(['svc.dryer_repair', 'svc.stove_repair', 'svc.generic_mounting_service', 'svc.pax_wardrobe_assembly', 'svc.toilet_seat_replacement', 'svc.furniture_repair_hourly']);
  const of = r => r.residuals.filter(x => x.kind === 'group_membership_disagreement');
  const base = of(baseSem);
  check('S4: the validator surfaces the group-membership disagreement (it is not silent)', base.length > 0, String(base.length));
  check('S4 ratchet: every disagreeing service is one of the six measured; a new one fails (the set only shrinks)', base.every(x => S4_PINNED.has(x.id)), base.filter(x => !S4_PINNED.has(x.id)).map(x => x.id).join(','));
  check('S4: the disagreement is a declared residual, never an error (the validator resolves nothing)', V.validate(lib.clone(SRC)).ok && base.every(x => /Operator ruling/.test(x.note)));
  const groupsOf = (s, sid) => s.registries.groups.filter(g => g.explicit_services.includes(sid));
  { const s = lib.clone(SRC); const sv = servicesOf(s).find(x => !S4_PINNED.has(x.id) && groupsOf(s, x.id).length === 1); need(sv, 'a service listed once'); groupsOf(s, sv.id)[0].explicit_services = groupsOf(s, sv.id)[0].explicit_services.filter(id => id !== sv.id);
    const r = V.validate(s); check('S4 counterfactual: dropping a service from its group list is reported (+1 residual, still valid)', r.ok && of(r).length === base.length + 1 && of(r).some(x => x.id === sv.id), String(of(r).length)); }
  { const s = lib.clone(SRC); const sv = servicesOf(s).find(x => !S4_PINNED.has(x.id) && groupsOf(s, x.id).length === 1); const other = s.registries.groups.find(g => !g.explicit_services.includes(sv.id)); other.explicit_services.push(sv.id);
    const r = V.validate(s); check('S4 counterfactual: listing a service in a second group is reported (+1 residual, still valid)', r.ok && of(r).length === base.length + 1 && of(r).some(x => x.id === sv.id && /groups list it/.test(x.note)), String(of(r).length)); }
  { const s = lib.clone(SRC); const sv = servicesOf(s).find(x => !S4_PINNED.has(x.id) && groupsOf(s, x.id).length === 1); const own = groupsOf(s, sv.id)[0]; const other = s.registries.groups.find(g => g.id !== own.id && !g.explicit_services.includes(sv.id)); own.explicit_services = own.explicit_services.filter(id => id !== sv.id); other.explicit_services.push(sv.id);
    const r = V.validate(s); check('S4 counterfactual: a service listed only in a group other than its own group_id is reported', r.ok && of(r).some(x => x.id === sv.id && /is listed in/.test(x.note)), String(of(r).length)); }
  { const s = lib.clone(SRC); const sv = servicesOf(s).find(x => x.id === 'svc.furniture_repair_hourly'); need(sv, 'the doubly listed service'); const keep = sv.presentation.ui_taxonomy.group_id; for (const g of groupsOf(s, sv.id)) if (g.id !== keep) g.explicit_services = g.explicit_services.filter(id => id !== sv.id);
    const r = V.validate(s); check('S4 counterfactual: a ruling that resolves one disagreement shrinks the set (the ratchet allows it)', r.ok && of(r).length === base.length - 1 && !of(r).some(x => x.id === sv.id), String(of(r).length)); }
  { const s = lib.clone(SRC); const g = s.registries.groups.find(x => x.explicit_services.length); s.registries.groups.forEach(x => { x.explicit_services = x.explicit_services.slice(); });
    const before = JSON.stringify(s.registries.groups.map(x => x.explicit_services)); V.validate(s); check('S4: the validator does not rewrite the lists it reports on', before === JSON.stringify(s.registries.groups.map(x => x.explicit_services)) && !!g); } }

// ---- 5. labels are never keys; order is not meaning --------------------------------------------------------------------------------------------------------------------------
console.log('\nLabels are not keys; order is not meaning');
{ const s = lib.clone(SRC); const q = questionsOf(s).find(x => x.options && x.options.length > 2); q.options.forEach((o, i) => { o.label = 'Renamed answer ' + (i + 1); });
  const r = V.validate(s); check('renaming every option label of a question leaves the source valid (a label is display text)', r.ok, JSON.stringify(r.errors.slice(0, 2))); }
{ const s = lib.clone(SRC); servicesOf(s)[0].presentation.ui_taxonomy.display_name = 'Something Else Entirely'; const r = V.validate(s); check('renaming a service display name leaves the source valid', r.ok); }
{ const s = lib.clone(SRC); s.entities.reverse(); const r = V.validate(s); check('reversing the entity order leaves the source valid (order is not meaning)', r.ok, JSON.stringify(r.errors.slice(0, 2))); }
{ const s = lib.clone(SRC); s.registries.tags.reverse(); s.registries.modifiers.reverse(); const r = V.validate(s); check('reversing the tag and modifier registries leaves the source valid', r.ok, JSON.stringify(r.errors.slice(0, 2))); }

// ---- 6. validation reads; it never writes ------------------------------------------------------------------------------------------------------------------------------------------
console.log('\nValidation never writes');
{ const frozen = lib.clone(SRC); const freeze = o => { if (o && typeof o === 'object') { Object.freeze(o); Object.values(o).forEach(freeze); } return o; }; freeze(frozen);
  let threw = null, r = null; try { r = V.validate(frozen); } catch (e) { threw = e.message; }
  check('validate() on a deep-frozen source does not throw (it assigns to nothing it reads)', threw === null, threw || ''); check('...and gives the same verdict', r && r.ok === baseSem.ok && r.errors.length === baseSem.errors.length);
  check('...and the source is unchanged', lib.diff(frozen, SRC) === null); }
check('validate() is deterministic (same verdict twice)', JSON.stringify(V.validate(lib.clone(SRC)).errors) === JSON.stringify(baseSem.errors) && JSON.stringify(V.validate(lib.clone(SRC)).residuals) === JSON.stringify(baseSem.residuals));

// ---- 7. the schema check cannot fail silently ---------------------------------------------------------------------------------------------------------------------------------------
console.log('\nA schema check that cannot run is a finding');
{ const p = cp.spawnSync('python3', ['-I', path.join(EF, 'schema_check.py'), path.join(ROOT, 'schema', 'no_such_schema.json'), lib.PATHS.source], { encoding: 'utf8' });
  check('schema_check.py exits 2 (could not run), not 0, when its schema is missing', p.status === 2, `exit ${p.status}`); }
{ const mutant = lib.clone(SRC); servicesOf(mutant)[0].component_id = 'ent.computer'; const d = fs.mkdtempSync(path.join(require('os').tmpdir(), 'ef-val-')); const f = path.join(d, 's.json'); fs.writeFileSync(f, JSON.stringify(mutant));
  const p = cp.spawnSync('python3', ['-I', path.join(EF, 'schema_check.py'), lib.PATHS.schema, f], { encoding: 'utf8' }); fs.rmSync(d, { recursive: true, force: true });
  check('schema_check.py exits 1 on a schema violation, with the path of the violation', p.status === 1 && /component_id|Additional/.test(p.stdout), `exit ${p.status}: ${p.stdout.slice(0, 160)}`); }

{ // a crash that looks like a verdict: the schema check exits 1 with nothing on stdout, or its schema is corrupt. Both must fail the source, never pass it.
  const d = fs.mkdtempSync(path.join(require('os').tmpdir(), 'ef-val-')); fs.mkdirSync(path.join(d, 'bin')); fs.mkdirSync(path.join(d, 'schema')); fs.mkdirSync(path.join(d, 'ssot'));
  fs.writeFileSync(path.join(d, 'bin', 'python3'), '#!/bin/sh\nexit 1\n', { mode: 0o755 }); fs.writeFileSync(path.join(d, 'schema', 'btnyc-source.schema.json'), '{ this is not json');
  const prog = `const V=require(${JSON.stringify(path.join(EF, 'validate_source.js'))}); const s=JSON.parse(require('fs').readFileSync(${JSON.stringify(lib.PATHS.source)},'utf8')); const r=V.validateFull(s); console.log(JSON.stringify({ok:r.ok,codes:r.errors.map(e=>e.code).slice(0,3)}));`;
  const run = env => { const p = cp.spawnSync('node', ['-e', prog], { encoding: 'utf8', env: Object.assign({}, process.env, env), maxBuffer: 1 << 26 }); try { return JSON.parse(p.stdout.trim().split('\n').pop()); } catch (e) { return { ok: 'no output: ' + (p.stderr || '').slice(0, 200) }; } };
  const corrupt = run({ BTNYC_ROOT: d }); check('validateFull fails the source when the schema file is corrupt (the check could not run)', corrupt.ok === false && corrupt.codes.includes('V-SCHEMA'), JSON.stringify(corrupt));
  fs.copyFileSync(lib.PATHS.schema, path.join(d, 'schema', 'btnyc-source.schema.json'));
  const fake = run({ BTNYC_ROOT: d, PATH: path.join(d, 'bin') + path.delimiter + process.env.PATH }); check('validateFull fails the source when the schema check exits 1 with no finding (a crash is not "no findings")', fake.ok === false && fake.codes.includes('V-SCHEMA'), JSON.stringify(fake));
  fs.rmSync(d, { recursive: true, force: true }); }

console.log(`\n[Entity-first validator, counterfactual] ${passed} passed, ${failed} failed (of ${passed + failed} checks; ${M.length} mutants over ${emitted.length} rule codes)`);
process.exit(failed ? 1 : 0);
