#!/usr/bin/env node
'use strict';
/**
 * validate_source.js -- the independent validator of ssot/btnyc_source.json (T175).
 *
 *   node test_harness/tools/entity_first/validate_source.js [--json] [--residuals] [path]
 *
 * It reads ONLY the source. It shares nothing with the migration, the legacy projection or the graph derivation except the id grammar (lib.js ID_TYPES / ID_RE): the one reference syntax.
 * Validation is callable without deriving anything, and derive_graph.js refuses a source that fails here (R-INVARIANT-DERIVATION: what is valid is decided apart from what is derived).
 *
 * Every finding carries a rule code. The codes are the class detectors the counterfactual tests mutate (verify_entity_first_validator.js): a mutant of each class must be rejected with its code.
 *   V-SCHEMA          the shape the versioned schema fixes (checked by schema_check.py; this file checks the fields the semantic rules read)
 *   V-ID-MISSING      a referenceable node with no id            V-ID-PREFIX    an id whose prefix is not its node type      V-ID-DUPLICATE   two nodes of one type with one id
 *   V-REF-DANGLING    an id-shaped value or key that names nothing   V-REF-TYPE  a reference site that holds an id of the wrong type   V-REF-LABEL   a reference that is a label, not an id pair
 *   V-SCOPE-MISSING / V-SCOPE-ASKER / V-SCOPE-CLAIM / V-SCOPE-OWNER   a question's entity_scope, in both directions
 *   V-DEP-DANGLING / V-DEP-OPTION / V-DEP-NOTINCHAIN / V-DEP-SELF / V-DEP-CYCLE / V-DEP-SHAPE   depends_on
 *   V-COMPLEX-*       the three axes every service declares (R-COMPLEX-AXES, R-COMPLEX-COMPOUNDS, P-COMPLEX-FURNITURE): PROFILE (a missing or illegal axis), TIER (the skill tier is declared twice and the two disagree), RISK (the risk tier is not the highest hazard it names),
 *                     BATCH (the flag is not what its signals say), ASSEMBLY (the assembly class), VOCAB (the vocabulary they are written in)
 *   V-UNC-*           uncertainty classes, profiles and retirement       V-CONF-*   confidence policy and gate       V-OPT-*   option effects     V-COMP-*   unsafe-to-compose services
 * Declared gaps are not errors and not hidden: they are returned as `residuals` and counted in the coverage report.
 */
const fs = require('fs');
const lib = require('./lib.js');
const { ID_TYPES, ID_RE, idType } = lib;

const AFFECTS = ['price', 'minutes', 'branch', 'prep', 'checkout_state', 'complexity', 'quantity', 'materials', 'tags'];
const ENTITY_KINDS = ['component', 'generic_group', 'generic_category'];
const ENTRY_MODES = ['component_first', 'symptom_first', 'parent', 'undetermined'];
const GATE_MODES = ['weighted_uncertainty', 'none'];

function eachAt(node, segs, fn, p = '') {
  if (node === undefined || node === null) return;
  if (segs.length === 0) { fn(node, p); return; }
  const [s, ...rest] = segs;
  if (s === '[]') { if (Array.isArray(node)) node.forEach((x, i) => eachAt(x, rest, fn, `${p}[${i}]`)); }
  else if (s === '*') { if (lib.isObj(node)) for (const k of Object.keys(node)) eachAt(node[k], rest, fn, `${p}.${k}`); }
  else if (lib.isObj(node) && s in node) eachAt(node[s], rest, fn, `${p}.${s}`);
}

// R-COMPLEX-COMPOUNDS: the batch-risk flag is read from signals in the SSOT, not asserted by belief. These are the four signals the Charter names, derived from a service's own record.
// An overflow rate or penalty minutes anywhere in the service's formula; a required material that policy.complexity_axes lists as a single-use consumable; an answer in its intake that routes to another service.
function complexitySignals(svc, formulas, questions, consumables) {
  const out = [];
  const hasKey = (o, re) => { let hit = false; (function w(x) { if (x && typeof x === 'object') for (const k of Object.keys(x)) { if (k.startsWith('_')) continue; if (re.test(k)) hit = true; w(x[k]); } })(o); return hit; };
  const f = svc.pricing && formulas.get(svc.pricing.formula_id);
  if (f && (f.id === 'fml.item_count_overflow_formula' || hasKey(f, /overflow/))) out.push('overflow_formula');
  if (f && hasKey(f, /penalty_minutes/)) out.push('per_unit_penalty_minutes');
  for (const m of (svc.pricing && svc.pricing.required_material_ids) || []) if (consumables.includes(m)) out.push('single_use_consumable:' + m);
  const qids = [...((svc.intake && svc.intake.steps) || []).map(s => s.question_id), ...((svc.recovery_affordances && svc.recovery_affordances.deep_dive_question_ids) || [])];
  if (qids.some(id => { const q = questions.get(id); return q && Array.isArray(q.options) && q.options.some(o => o.route_to && o.route_to.service_id && o.route_to.service_id !== svc.id); })) out.push('scope_changing_branch');
  return out;
}

function validate(src, opts = {}) {
  const errors = [], residuals = [];
  const err = (code, path, msg) => errors.push({ code, path, msg });
  const res = (kind, id, note) => residuals.push({ kind, id, note });
  const stats = { idsAssigned: 0, idsMissing: 0, refsChecked: 0, entities: 0, questions: 0, options: 0, optionsWithoutId: 0, services: 0, compositions: 0, classes: 0, gatedServices: 0, gatedCompositions: 0, refTypes: {} };

  // ---- top level -----------------------------------------------------------------------------------------------------------------------------------------------------------
  for (const k of ['source_schema_version', 'meta', 'registries', 'entities', 'shared_questions', 'shared_uncertainty_classes', 'policy', 'vocabulary']) if (!(k in src)) err('V-SCHEMA', '$.' + k, 'required top-level section is missing');
  if (errors.length) return { errors, residuals, stats, ok: false };
  const R = src.registries;
  for (const k of ['categories', 'groups', 'actions', 'modifiers', 'tags', 'materials', 'furniture', 'checkout_states', 'pricing_formulas', 'pricing_archetypes', 'behavioral_classes', 'contexts', 'service_order']) if (!Array.isArray(R[k])) err('V-SCHEMA', '$.registries.' + k, 'registry is missing or not an array');
  if (errors.length) return { errors, residuals, stats, ok: false };

  // ---- ids -----------------------------------------------------------------------------------------------------------------------------------------------------------------
  const decl = {}; for (const t of Object.keys(ID_TYPES)) decl[t] = new Map();
  const declare = (type, node, path) => {
    if (!node || typeof node.id !== 'string' || node.id === '') { stats.idsMissing++; err('V-ID-MISSING', path, `a ${ID_TYPES[type]} has no id`); return null; }
    if (idType(node.id) !== type) { err('V-ID-PREFIX', path, `${ID_TYPES[type]} id ${JSON.stringify(node.id)} does not carry the ${type}. prefix`); return null; }
    if (decl[type].has(node.id)) { err('V-ID-DUPLICATE', path, `${ID_TYPES[type]} id ${node.id} is declared twice (first at ${decl[type].get(node.id).path})`); return null; }
    decl[type].set(node.id, { node, path }); stats.idsAssigned++; return node.id;
  };
  const registryTypes = { categories: 'cat', groups: 'grp', actions: 'act', modifiers: 'mod', tags: 'tag', materials: 'mat', furniture: 'fur', checkout_states: 'chk', pricing_formulas: 'fml', pricing_archetypes: 'par', behavioral_classes: 'cls', contexts: 'ctx' };
  for (const [reg, type] of Object.entries(registryTypes)) R[reg].forEach((n, i) => declare(type, n, `$.registries.${reg}[${i}]`));

  const entities = new Map(), questions = new Map(), classes = new Map(), services = new Map(), compositions = new Map();
  const qOwner = new Map(), svcEntity = new Map(), classOwner = new Map(), cmpOwner = new Map(); // validation never writes to the source it reads
  src.entities.forEach((e, i) => {
    const ep = `$.entities[${i}]`;
    if (declare('ent', e, ep)) { entities.set(e.id, e); stats.entities++; }
    if (!ENTITY_KINDS.includes(e.kind)) err('V-SCHEMA', ep + '.kind', `kind ${JSON.stringify(e.kind)} is not one of ${ENTITY_KINDS.join(', ')}`);
    for (const k of ['questions', 'uncertainty_classes', 'services', 'default_compositions']) if (!Array.isArray(e[k])) err('V-SCHEMA', `${ep}.${k}`, 'entity section is missing or not an array');
    (e.questions || []).forEach((q, j) => { if (declare('q', q, `${ep}.questions[${j}]`)) { questions.set(q.id, q); qOwner.set(q.id, e.id); } });
    (e.uncertainty_classes || []).forEach((c, j) => { if (declare('u', c, `${ep}.uncertainty_classes[${j}]`)) { classes.set(c.id, c); classOwner.set(c.id, e.id); } });
    (e.services || []).forEach((s, j) => { if (declare('svc', s, `${ep}.services[${j}]`)) { services.set(s.id, s); svcEntity.set(s.id, e.id); } });
    (e.default_compositions || []).forEach((c, j) => { if (declare('cmp', c, `${ep}.default_compositions[${j}]`)) { compositions.set(c.id, c); cmpOwner.set(c.id, e.id); } });
  });
  src.shared_questions.forEach((q, j) => { if (declare('q', q, `$.shared_questions[${j}]`)) { questions.set(q.id, q); qOwner.set(q.id, null); } });
  src.shared_uncertainty_classes.forEach((c, j) => { if (declare('u', c, `$.shared_uncertainty_classes[${j}]`)) { classes.set(c.id, c); classOwner.set(c.id, null); } });
  stats.questions = questions.size; stats.services = services.size; stats.compositions = compositions.size; stats.classes = classes.size;
  if (errors.some(e => e.code === 'V-SCHEMA')) return { errors, residuals, stats, ok: false };

  const exists = id => { const t = idType(id); return !!t && decl[t].has(id); };
  const need = (path, id, type) => {
    stats.refsChecked++; stats.refTypes[type] = (stats.refTypes[type] || 0) + 1;
    if (typeof id !== 'string') { err('V-REF-LABEL', path, `a ${ID_TYPES[type]} reference must be an id string, found ${JSON.stringify(id)}`); return false; }
    const t = idType(id);
    if (!t) { err('V-REF-LABEL', path, `${JSON.stringify(id)} is not an id (labels and aliases are never references)`); return false; }
    if (t !== type) { err('V-REF-TYPE', path, `expected a ${ID_TYPES[type]} id, found ${id} (a ${ID_TYPES[t]})`); return false; }
    if (!decl[type].has(id)) { err('V-REF-DANGLING', path, `${id} names no ${ID_TYPES[type]}`); return false; }
    return true;
  };

  // ---- options: ids unique per question; the effective options of an instance question are its base's unless it carries its own -------------------------------------------------
  const optionsOf = q => (q.options ? q.options : (q.instance_of && questions.get(q.instance_of) ? questions.get(q.instance_of).options : undefined));
  const optionById = (qid, oid) => { const q = questions.get(qid); const os = q && optionsOf(q); return os ? os.find(o => o.id === oid) : undefined; };
  const modById = new Map(R.modifiers.filter(m => m && m.id).map(m => [m.id, m]));
  const opensBranch = new Set(); // `${qid}#${oid}` named as a parent by some dependency

  // ---- dependencies ------------------------------------------------------------------------------------------------------------------------------------------------------------
  const termsOf = (dep, path) => {
    const out = [];
    if (!Array.isArray(dep)) { err('V-DEP-SHAPE', path, 'depends_on must be an array (empty when the question is ungated)'); return out; }
    dep.forEach((t, i) => {
      const tp = `${path}[${i}]`;
      if (lib.isObj(t) && Array.isArray(t.any_of)) { if (!t.any_of.length) err('V-DEP-SHAPE', tp, 'any_of must not be empty'); t.any_of.forEach((u, j) => { if (lib.isObj(u) && typeof u.question_id === 'string' && typeof u.option_id === 'string') out.push({ term: u, path: `${tp}.any_of[${j}]` }); else err('V-REF-LABEL', `${tp}.any_of[${j}]`, 'a dependency term is {question_id, option_id}'); }); }
      else if (lib.isObj(t) && typeof t.question_id === 'string' && typeof t.option_id === 'string') out.push({ term: t, path: tp });
      else err('V-REF-LABEL', tp, 'a dependency term is {question_id, option_id} or {any_of: [...]}; a label-keyed dependency is not a reference');
    });
    return out;
  };
  const checkTerm = ({ term, path }) => {
    if (!need(path + '.question_id', term.question_id, 'q')) return false;
    if (!optionById(term.question_id, term.option_id)) { err('V-DEP-OPTION', path + '.option_id', `${term.option_id} is not an option of ${term.question_id}`); return false; }
    opensBranch.add(`${term.question_id}#${term.option_id}`); return true;
  };

  // ---- questions ----------------------------------------------------------------------------------------------------------------------------------------------------------------
  const questionDeps = new Map(); // qid -> Set(parent qids)
  const allQuestions = [...questions.values()];
  for (const q of allQuestions) {
    const path = decl.q.get(q.id).path;
    if (q.instance_of === undefined) { if (typeof q.prompt !== 'string' || !q.prompt) err('V-SCHEMA', path + '.prompt', 'a question has a prompt'); if (typeof q.type !== 'string') err('V-SCHEMA', path + '.type', 'a question has a type'); }
    else { need(path + '.instance_of', q.instance_of, 'q'); if (typeof q.item_noun !== 'string' || !q.item_noun) err('V-SCHEMA', path + '.item_noun', 'an instance question names its item'); }
    // scope
    const sc = q.entity_scope;
    if (sc === undefined || sc === null) err('V-SCOPE-MISSING', path + '.entity_scope', 'every question declares entity_scope');
    else if (Array.isArray(sc)) { if (!sc.length) err('V-SCOPE-MISSING', path + '.entity_scope', 'entity_scope is empty'); sc.forEach((id, i) => need(`${path}.entity_scope[${i}]`, id, 'ent')); if (new Set(sc).size !== sc.length) err('V-SCOPE-CLAIM', path + '.entity_scope', 'an entity is listed twice'); }
    else if (lib.isObj(sc) && typeof sc.context === 'string') need(path + '.entity_scope.context', sc.context, 'ctx');
    else err('V-SCOPE-MISSING', path + '.entity_scope', 'entity_scope is an array of entity ids or {context: ctx.id}');
    // owner
    const owner = qOwner.get(q.id);
    if (owner && Array.isArray(sc) && !sc.includes(owner)) err('V-SCOPE-OWNER', path, `${q.id} lives under ${owner} but its entity_scope does not include that entity`);
    if (owner === null && Array.isArray(sc) && sc.length < 2) err('V-SCOPE-OWNER', path, `${q.id} is a shared question but is scoped to fewer than two entities (it belongs under its entity)`);
    if (owner && !Array.isArray(sc)) err('V-SCOPE-OWNER', path, `${q.id} lives under ${owner} but is context-scoped (a context-scoped question is shared)`);
    // options
    const opts = q.options;
    if (opts !== undefined) {
      if (!Array.isArray(opts) || !opts.length) err('V-SCHEMA', path + '.options', 'options is a non-empty array when present');
      else {
        const ids = new Set(), labels = new Set();
        opts.forEach((o, i) => {
          const op = `${path}.options[${i}]`; stats.options++;
          if (typeof o.id !== 'string' || !o.id) { stats.optionsWithoutId++; err('V-ID-MISSING', op, 'an option has no id'); } else { stats.idsAssigned++; if (ids.has(o.id)) err('V-ID-DUPLICATE', op, `option id ${o.id} is used twice in ${q.id}`); ids.add(o.id); }
          if (typeof o.label !== 'string' || !o.label) err('V-SCHEMA', op + '.label', 'an option has a label'); else { if (labels.has(o.label)) err('V-OPT-LABEL-DUP', op, `two options of ${q.id} share the label ${JSON.stringify(o.label)} (an answer is stored by label)`); labels.add(o.label); }
        });
      }
    }
    // question-level dependencies
    const parents = new Set();
    for (const t of termsOf(q.depends_on, path + '.depends_on')) { if (checkTerm(t)) { if (t.term.question_id === q.id) err('V-DEP-SELF', t.path, `${q.id} depends on itself`); parents.add(t.term.question_id); } }
    questionDeps.set(q.id, parents);
  }
  // instance questions that carry no options of their own must have a base that does
  for (const q of allQuestions) if (q.instance_of && questions.has(q.instance_of) && !optionsOf(q)) err('V-SCHEMA', decl.q.get(q.id).path, `${q.id} is an instance of ${q.instance_of}, which has no options, and has none of its own`);
  stats.options = allQuestions.reduce((n, q) => n + (q.options ? q.options.length : 0), 0);

  // dependency cycles across questions (question-level)
  { const state = new Map(); const visit = (id, trail) => { if (state.get(id) === 2) return; if (state.get(id) === 1) { err('V-DEP-CYCLE', decl.q.get(id).path, `question dependencies form a cycle: ${[...trail, id].join(' -> ')}`); return; } state.set(id, 1); for (const p of questionDeps.get(id) || []) if (questions.has(p)) visit(p, [...trail, id]); state.set(id, 2); };
    for (const id of questions.keys()) visit(id, []); }

  // ---- options: references and effects -----------------------------------------------------------------------------------------------------------------------------------------------
  // (done after steps so that `branch` can be derived from dependencies)
  const stepsOf = x => (x.intake && Array.isArray(x.intake.steps) ? x.intake.steps : null);
  const owners = [...[...services.values()].map(s => ({ kind: 'service', node: s, path: decl.svc.get(s.id).path, entity: svcEntity.get(s.id) })), ...[...compositions.values()].map(c => ({ kind: 'composition', node: c, path: decl.cmp.get(c.id).path, entity: cmpOwner.get(c.id) }))];
  const askers = new Map(); // qid -> Set(entity)
  const baseOfQ = qid => { const q = questions.get(qid); return q && q.instance_of ? q.instance_of : qid; };
  for (const o of owners) {
    const { node: n, path, entity } = o; const steps = stepsOf(n);
    if (!steps) { err('V-SCHEMA', path + '.intake.steps', `${o.kind} has no intake.steps array`); continue; }
    const inChain = new Set(); const seen = new Set();
    steps.forEach((st, i) => { if (typeof st.question_id === 'string') { if (seen.has(st.question_id)) err('V-DEP-SHAPE', `${path}.intake.steps[${i}]`, `${st.question_id} is a step twice in one chain`); seen.add(st.question_id); inChain.add(st.question_id); } });
    const parents = new Map();
    steps.forEach((st, i) => {
      const sp = `${path}.intake.steps[${i}]`;
      if (!need(sp + '.question_id', st.question_id, 'q')) return;
      if (!askers.has(st.question_id)) askers.set(st.question_id, new Set()); askers.get(st.question_id).add(entity);
      const ps = new Set();
      for (const t of termsOf(st.depends_on, sp + '.depends_on')) {
        if (!checkTerm(t)) continue;
        const pq = t.term.question_id;
        if (pq === st.question_id) { err('V-DEP-SELF', t.path, `${st.question_id} depends on itself in ${n.id}`); continue; }
        if (!inChain.has(pq)) { err('V-DEP-NOTINCHAIN', t.path, `${n.id}: ${st.question_id} depends on ${pq}, which is not a step of this chain, so the gate can never open`); continue; }
        ps.add(pq);
      }
      parents.set(st.question_id, ps);
    });
    { const state = new Map(); const visit = (id, trail) => { if (state.get(id) === 2) return; if (state.get(id) === 1) { err('V-DEP-CYCLE', path + '.intake.steps', `${n.id}: step dependencies form a cycle: ${[...trail, id].join(' -> ')}`); return; } state.set(id, 1); for (const p of parents.get(id) || []) visit(p, [...trail, id]); state.set(id, 2); };
      for (const id of parents.keys()) visit(id, []); }
    o.inChain = inChain;
  }

  // A deep-dive question (recovery_affordances.deep_dive_question_ids: the Fork's "answer a few more questions" path) is asked of the unit's customer: it is a use of the question, so the unit's
  // entity belongs in the question's entity_scope exactly as if a chain asked it. A scope that counts chains only would call a question used by 33 entities a question of one.
  for (const o of owners) { const rec = o.node.recovery_affordances; if (rec && Array.isArray(rec.deep_dive_question_ids)) for (const q of rec.deep_dive_question_ids) if (typeof q === 'string' && questions.has(q)) { if (!askers.has(q)) askers.set(q, new Set()); askers.get(q).add(o.entity); } }
  // scope, both directions
  for (const q of allQuestions) {
    const sc = q.entity_scope; const as = askers.get(q.id) || new Set(); const path = decl.q.get(q.id).path + '.entity_scope';
    // an instance question's chain-level asker also asks its base
    if (Array.isArray(sc)) {
      for (const a of as) if (!sc.includes(a)) err('V-SCOPE-ASKER', path, `${a} asks ${q.id} (in a chain or as a deep-dive question) but is not in its entity_scope`);
      for (const e of sc) if (!as.has(e) && !(owners.some(o => o.entity === e && o.node.intake && (o.node.intake.steps || []).some(st => baseOfQ(st.question_id) === q.id)))) err('V-SCOPE-CLAIM', path, `${e} is in the entity_scope of ${q.id} but asks nothing that uses it (no chain step and no deep-dive question)`);
    }
  }
  // a base question asked only through instances: scope of the base covers the instance askers
  for (const q of allQuestions) if (q.instance_of) { const b = questions.get(q.instance_of); const as = askers.get(q.id) || new Set(); if (b && Array.isArray(b.entity_scope)) for (const a of as) if (!b.entity_scope.includes(a)) err('V-SCOPE-ASKER', decl.q.get(b.id).path + '.entity_scope', `${a} asks an instance of ${b.id} but is not in its entity_scope`); }

  // ---- formula inputs (T177): which answers a pricing formula reads, stated as data -------------------------------------------------------------------------------------------------------------------
  // The runtime reads these answers in code (qr.html applyPricingFormula). The source says which question, which options and which formula parameter, so an option's effects can be backed by a cause the
  // validator can see, and so the set of questions a formula owns (qr.html FORMULA_CONSUMED_KEYS) is derived instead of kept by hand.
  const INPUT_ROLES = ['trigger_modifier', 'select_branch', 'quantity', 'constant_modifier'], INPUT_EFFECTS = ['price', 'minutes'];
  const inputCause = new Map(); // `${qid}#${oid}` -> Set(effect): what a formula input or a fee row makes an answer do
  const causeAdd = (qid, oid, effects) => { const k = `${qid}#${oid}`; if (!inputCause.has(k)) inputCause.set(k, new Set()); for (const e of effects) inputCause.get(k).add(e); };
  const consumedBy = new Map(); // qid -> Set(formula id)
  const consume = (qid, fid) => { if (!consumedBy.has(qid)) consumedBy.set(qid, new Set()); consumedBy.get(qid).add(fid); };
  const modEff = id => { const m = modById.get(id); return m ? [Number(m.fee) ? 'price' : null, Number(m.minutes) ? 'minutes' : null].filter(Boolean) : []; };
  const pathGet = (obj, p) => String(p).split('.').reduce((a, k) => (a !== undefined && a !== null ? a[k] : undefined), obj);
  stats.formulaInputs = 0; stats.formulasWithInputs = 0;
  R.pricing_formulas.forEach((f, fi) => {
    if (!lib.isObj(f) || typeof f.id !== 'string') return;
    const fp = `$.registries.pricing_formulas[${fi}]`;
    if (f.qty_aware !== undefined && f.qty_aware !== true) err('V-FML-INPUT-SHAPE', fp + '.qty_aware', 'qty_aware is true or absent');
    for (const row of Array.isArray(f.issue_type_fees) ? f.issue_type_fees : []) if (lib.isObj(row) && typeof row.question_id === 'string' && typeof row.option_id === 'string' && optionById(row.question_id, row.option_id)) { causeAdd(row.question_id, row.option_id, modEff(row.modifier_id)); consume(row.question_id, f.id); }
    const named = new Set();
    if (f.inputs !== undefined) {
      if (!Array.isArray(f.inputs)) err('V-FML-INPUT-SHAPE', fp + '.inputs', 'inputs is an array');
      else {
        stats.formulasWithInputs++; const names = new Set(), claimed = new Map();
        f.inputs.forEach((inp, ii) => {
          const ip = `${fp}.inputs[${ii}]`; stats.formulaInputs++;
          if (!lib.isObj(inp) || typeof inp.name !== 'string' || !inp.name) { err('V-FML-INPUT-SHAPE', ip, 'an input has a name'); return; }
          if (names.has(inp.name)) err('V-FML-INPUT-DUP', ip + '.name', `${f.id} has two inputs named ${inp.name}`); names.add(inp.name);
          if (!INPUT_ROLES.includes(inp.role)) { err('V-FML-INPUT-SHAPE', ip + '.role', `role ${JSON.stringify(inp.role)} is not one of ${INPUT_ROLES.join(', ')}`); return; }
          const effects = Array.isArray(inp.affects) ? inp.affects : [];
          for (const a of effects) if (!INPUT_EFFECTS.includes(a)) err('V-FML-INPUT-SHAPE', ip + '.affects', `${JSON.stringify(a)} is not an effect a formula input can have (${INPUT_EFFECTS.join(', ')})`);
          // the formula parameter an input names must exist, and a modifier parameter must hold a modifier
          const modParam = () => {
            if (typeof inp.modifier_param !== 'string' || typeof f[inp.modifier_param] !== 'string') { err('V-FML-INPUT-PARAM', ip + '.modifier_param', `${f.id} has no modifier parameter ${JSON.stringify(inp.modifier_param)}`); return null; }
            named.add(inp.modifier_param); return need(`${fp}.${inp.modifier_param}`, f[inp.modifier_param], 'mod') ? f[inp.modifier_param] : null;
          };
          const numParam = () => { if (inp.param === undefined) return; if (typeof pathGet(f, inp.param) !== 'number') err('V-FML-INPUT-PARAM', ip + '.param', `${f.id} has no numeric parameter ${JSON.stringify(inp.param)}`); };
          const claim = (qid, oid) => { const k = `${qid}#${oid}`; if (claimed.has(k)) err('V-FML-INPUT-DUP', ip, `${k} is read by two inputs of ${f.id} (${claimed.get(k)} and ${inp.name})`); else claimed.set(k, inp.name); };
          const optionsOfInput = () => {
            if (!need(ip + '.question_id', inp.question_id, 'q')) return null;
            const os = optionsOf(questions.get(inp.question_id)); if (!os) { err('V-FML-INPUT-OPTION', ip + '.question_id', `${inp.question_id} has no options`); return null; }
            consume(inp.question_id, f.id); return os;
          };
          const optionsExist = (os, ids, p) => { let ok = Array.isArray(ids) && ids.length > 0; if (!ok) err('V-FML-INPUT-OPTION', p, 'the input names no option'); for (const [j, oid] of (Array.isArray(ids) ? ids : []).entries()) if (!os.some(o => o.id === oid)) { err('V-FML-INPUT-OPTION', `${p}[${j}]`, `${oid} is not an option of ${inp.question_id}`); ok = false; } return ok; };
          if (inp.role === 'constant_modifier') { modParam(); return; }
          if (inp.role === 'trigger_modifier') {
            const os = optionsOfInput(); const mid = modParam(); if (!os || !optionsExist(os, inp.option_ids, ip + '.option_ids')) return;
            for (const oid of inp.option_ids) {
              claim(inp.question_id, oid); const o = os.find(x => x.id === oid);
              if (mid && o.modifier_id !== undefined && o.modifier_id !== mid) err('V-FML-INPUT-MODIFIER', ip, `${inp.question_id}/${oid} carries its own modifier ${o.modifier_id}, but ${f.id}.${inp.modifier_param} is ${mid}: the answer would be charged by two rows`);
              causeAdd(inp.question_id, oid, mid ? modEff(mid) : []);
            }
            return;
          }
          if (inp.role === 'select_branch') {
            const os = optionsOfInput(); if (!os) return;
            if (!Array.isArray(inp.branches) || inp.branches.length < 2) { err('V-FML-BRANCH-COVER', ip + '.branches', 'a branch selector names at least two branches'); return; }
            const bn = new Set(), all = new Set();
            inp.branches.forEach((b, bi) => {
              const bp = `${ip}.branches[${bi}]`;
              if (!lib.isObj(b) || typeof b.branch !== 'string' || !b.branch) { err('V-FML-INPUT-SHAPE', bp, 'a branch has a name'); return; }
              if (bn.has(b.branch)) err('V-FML-BRANCH-COVER', bp, `branch ${b.branch} is named twice`); bn.add(b.branch);
              if (b.formula_path !== undefined && !lib.isObj(pathGet(f, b.formula_path))) err('V-FML-INPUT-PARAM', bp + '.formula_path', `${f.id} has no parameter set ${JSON.stringify(b.formula_path)}`);
              if (!optionsExist(os, b.option_ids, bp + '.option_ids')) return;
              for (const oid of b.option_ids) { if (all.has(oid)) err('V-FML-BRANCH-COVER', bp, `${oid} selects two branches`); all.add(oid); claim(inp.question_id, oid); causeAdd(inp.question_id, oid, effects); }
            });
            for (const o of os) if (!all.has(o.id)) err('V-FML-BRANCH-COVER', ip + '.branches', `${inp.question_id}/${o.id} selects no branch (every answer of a selector question is assigned one, so no label has to be read)`);
            if (!bn.has(inp.default_branch)) err('V-FML-BRANCH-COVER', ip + '.default_branch', `default_branch ${JSON.stringify(inp.default_branch)} is not one of the branches`);
            return;
          }
          // quantity
          numParam();
          if (!['booking', 'answer_values', 'option_qty_value'].includes(inp.source)) { err('V-FML-INPUT-SHAPE', ip + '.source', `quantity source ${JSON.stringify(inp.source)} is not booking, answer_values or option_qty_value`); return; }
          if (inp.source === 'booking') { if (inp.question_id !== undefined) err('V-FML-INPUT-SHAPE', ip, 'a booking quantity is read from the booking, not from a question'); return; }
          if (inp.source === 'answer_values') {
            const os = optionsOfInput(); if (!os) return;
            if (!Array.isArray(inp.values)) { err('V-FML-QTY-VALUES', ip + '.values', 'answer_values lists the number each option stands for'); return; }
            const seen = new Set();
            inp.values.forEach((v, vi) => {
              const vp = `${ip}.values[${vi}]`;
              if (!lib.isObj(v) || !os.some(o => o.id === v.option_id)) { err('V-FML-INPUT-OPTION', vp, `${lib.isObj(v) ? v.option_id : v} is not an option of ${inp.question_id}`); return; }
              if (seen.has(v.option_id)) err('V-FML-QTY-VALUES', vp, `${v.option_id} is valued twice`); seen.add(v.option_id);
              if (typeof v.value !== 'number' || !Number.isFinite(v.value) || v.value < 0) err('V-FML-QTY-VALUES', vp + '.value', 'a quantity value is a finite number, zero or more');
              claim(inp.question_id, v.option_id); causeAdd(inp.question_id, v.option_id, v.value === 0 ? ['quantity'] : ['quantity', ...effects]);
            });
            for (const o of os) if (!seen.has(o.id)) err('V-FML-QTY-VALUES', ip + '.values', `${inp.question_id}/${o.id} has no value (the count must never be read from the label)`);
            if (typeof inp.default !== 'number') err('V-FML-QTY-VALUES', ip + '.default', 'the count used when the question is unanswered is stated');
            return;
          }
          // option_qty_value: the count is each option's own qty_value
          if (inp.question_id !== undefined) {
            const os = optionsOfInput(); if (!os) return;
            for (const o of os) {
              if (typeof o.qty_value !== 'number') { err('V-FML-QTY-VALUES', ip, `${inp.question_id}/${o.id} has no numeric qty_value`); continue; }
              claim(inp.question_id, o.id); causeAdd(inp.question_id, o.id, o.qty_value === 0 ? ['quantity'] : ['quantity', ...effects]);
            }
          } else for (const q of allQuestions) for (const o of q.options || []) if (o.formula_id === f.id && o.qty_value !== undefined) { claim(q.id, o.id); causeAdd(q.id, o.id, ['quantity', ...effects]); consume(q.id, f.id); }
        });
      }
    }
    for (const k of Object.keys(f)) if (/_modifier_ref$/.test(k) && !named.has(k)) res('formula_modifier_without_input', `${f.id}.${k}`, `${f.id} names ${f[k]} as ${k}, but no input says which answer (or constant) applies it`);
  });

  // ---- option fields and effects ----------------------------------------------------------------------------------------------------------------------------------------------------
  for (const q of allQuestions) {
    (q.options || []).forEach((o, i) => {
      const op = `${decl.q.get(q.id).path}.options[${i}]`;
      const has = k => o[k] !== undefined;
      if (!Array.isArray(o.affects)) { err('V-OPT-EFFECT', op + '.affects', 'every option declares affects (an empty array for a no-op)'); return; }
      for (const a of o.affects) if (!AFFECTS.includes(a)) err('V-OPT-EFFECT', op + '.affects', `${JSON.stringify(a)} is not an effect (${AFFECTS.join(', ')})`);
      if (new Set(o.affects).size !== o.affects.length) err('V-OPT-EFFECT', op + '.affects', 'an effect is listed twice');
      const aff = new Set(o.affects);
      (o.tag_ids || []).forEach((t, j) => need(`${op}.tag_ids[${j}]`, t, 'tag'));
      if (has('modifier_id')) need(op + '.modifier_id', o.modifier_id, 'mod');
      if (has('checkout_state_id')) need(op + '.checkout_state_id', o.checkout_state_id, 'chk');
      if (has('formula_id')) need(op + '.formula_id', o.formula_id, 'fml');
      if (has('route_to')) {
        const r = o.route_to; need(op + '.route_to.service_id', r.service_id, 'svc');
        if (!Array.isArray(r.answers)) err('V-REF-LABEL', op + '.route_to.answers', 'route_to.answers is an array of {question_id, option_id}');
        else r.answers.forEach((a, j) => { if (!lib.isObj(a) || typeof a.question_id !== 'string' || typeof a.option_id !== 'string') { err('V-REF-LABEL', `${op}.route_to.answers[${j}]`, 'an answer is {question_id, option_id}, never {module: label}'); return; } if (need(`${op}.route_to.answers[${j}].question_id`, a.question_id, 'q') && !optionById(a.question_id, a.option_id)) err('V-DEP-OPTION', `${op}.route_to.answers[${j}].option_id`, `${a.option_id} is not an option of ${a.question_id}`); });
      }
      // effects must match the fields that cause them, both ways
      const mod = has('modifier_id') ? modById.get(o.modifier_id) : undefined;
      const modPrice = mod && Number(mod.fee) !== 0 && mod.fee !== undefined, modMin = mod && Number(mod.minutes) !== 0 && mod.minutes !== undefined;
      const rule = (effect, backed, why) => { if (aff.has(effect) && !backed) err('V-OPT-EFFECT', op, `${q.id}/${o.id} declares effect "${effect}" but nothing in the option causes it (${why})`); if (!aff.has(effect) && backed) err('V-OPT-EFFECT', op, `${q.id}/${o.id} has ${why} but does not declare effect "${effect}"`); };
      rule('tags', Array.isArray(o.tag_ids) && o.tag_ids.length > 0, 'tag_ids');
      rule('complexity', has('complexity_override'), 'complexity_override');
      rule('checkout_state', has('checkout_state_id'), 'checkout_state_id');
      const ic = inputCause.get(`${q.id}#${o.id}`) || new Set(); // what a formula input or a fee row makes this answer do
      rule('quantity', has('qty_value') || ic.has('quantity'), 'qty_value or a formula quantity input');
      rule('materials', has('mat_min') || has('mat_max'), 'mat_min/mat_max');
      rule('prep', has('location_hints'), 'location_hints');
      rule('branch', has('route_to') || opensBranch.has(`${q.id}#${o.id}`), 'route_to or a dependent question');
      const priceBacked = has('formula_id') || modPrice || ic.has('price'), minBacked = modMin || ic.has('minutes');
      if (aff.has('price') && !priceBacked) err('V-OPT-EFFECT', op, `${q.id}/${o.id} declares effect "price" but has no priced modifier, no formula and no formula input or fee row that prices it`);
      if (!aff.has('price') && priceBacked) err('V-OPT-EFFECT', op, `${q.id}/${o.id} has a formula, a priced modifier or a formula input but does not declare effect "price"`);
      if (aff.has('minutes') && !minBacked) err('V-OPT-EFFECT', op, `${q.id}/${o.id} declares effect "minutes" but has no modifier with minutes and no formula input or fee row that adds minutes`);
      if (!aff.has('minutes') && minBacked) err('V-OPT-EFFECT', op, `${q.id}/${o.id} has a modifier with minutes or a formula input but does not declare effect "minutes"`);
      if (mod && mod.role === 'condition') err('V-MOD-ASSIGN', op + '.modifier_id', `${o.modifier_id} is a domain condition, not a fee row: an answer cannot be charged by it`);
      if (o.evidence !== undefined && o.evidence !== 'unknown') err('V-OPT-EFFECT', op + '.evidence', `evidence is "unknown" or absent, found ${JSON.stringify(o.evidence)}`);
      // An unknown answer may still carry a fee or minutes (a contingency for not knowing); that is authored business behavior, so it is reported as a residual for the Operator, not rejected.
      if (o.evidence === 'unknown' && (aff.has('price') || aff.has('minutes'))) res('unknown_option_with_cost_effect', `${q.id}/${o.id}`, `${JSON.stringify(o.label)} is classified as an unknown answer and also changes ${['price', 'minutes'].filter(a => aff.has(a)).join(' and ')}: a contingency for not knowing, or a mis-classified answer`);
    });
  }

  // ---- uncertainty classes ---------------------------------------------------------------------------------------------------------------------------------------------------------------
  const reachableRetire = new Map(); // class id -> bool: some qualifying (non-unknown) option exists on an existing question
  for (const c of classes.values()) {
    const path = decl.u.get(c.id).path;
    if (typeof c.label !== 'string' || !c.label) err('V-SCHEMA', path + '.label', 'a class has a label');
    if (typeof c.weight_basis !== 'string' || !c.weight_basis) err('V-UNC-WEIGHT', path + '.weight_basis', 'the basis of a weight is declared, not implied');
    if (c.default_weight === undefined) { if (c.weight_basis !== 'unauthored') err('V-UNC-WEIGHT', path + '.default_weight', `${c.id} has no weight and does not declare weight_basis "unauthored"`); else res('uncertainty_weight_unauthored', c.id, `${c.id} has no authored weight: it cannot count toward any service's confidence until the Operator sets one`); }
    else if (!(typeof c.default_weight === 'number' && Number.isFinite(c.default_weight) && c.default_weight > 0)) err('V-UNC-WEIGHT', path + '.default_weight', 'a class weight is a positive number');
    else if (c.weight_basis === 'unauthored') err('V-UNC-WEIGHT', path + '.weight_basis', 'a class with a weight cannot be "unauthored"');
    if (!Array.isArray(c.retired_by) || !c.retired_by.length) { err('V-UNC-RETIRE', path + '.retired_by', 'a class names the question and answers that retire it'); reachableRetire.set(c.id, false); continue; }
    let reach = false;
    c.retired_by.forEach((r, i) => {
      const rp = `${path}.retired_by[${i}]`;
      if (lib.isObj(r) && r.any_value === true && r.option_ids === undefined) { // a numeric question has no options: any value given retires it
        if (!need(rp + '.question_id', r.question_id, 'q')) return;
        const qq = questions.get(r.question_id); if (qq && optionsOf(qq)) err('V-UNC-RETIRE', rp, `${r.question_id} has options; retirement names the qualifying options, not any_value`); else reach = true;
        return;
      }
      if (!lib.isObj(r) || !Array.isArray(r.option_ids) || !r.option_ids.length) { err('V-UNC-RETIRE', rp, 'a retirement is {question_id, option_ids: [..]} with at least one qualifying answer, or {question_id, any_value: true} on a numeric question'); return; }
      if (!need(rp + '.question_id', r.question_id, 'q')) return;
      r.option_ids.forEach((oid, j) => {
        const o = optionById(r.question_id, oid);
        if (!o) { err('V-DEP-OPTION', `${rp}.option_ids[${j}]`, `${oid} is not an option of ${r.question_id}`); return; }
        if (o.evidence === 'unknown') err('V-UNC-RETIRE-UNKNOWN', `${rp}.option_ids[${j}]`, `${r.question_id}/${oid} is an unknown answer and cannot retire ${c.id} ("not sure" never retires anything)`);
        else reach = true;
      });
    });
    reachableRetire.set(c.id, reach);
    if (!reach) err('V-UNC-UNREACHABLE', path, `${c.id} can never be retired: no qualifying answer exists`);
    const cOwner = classOwner.get(c.id);
    if (cOwner) { // an entity-owned class is reusable by that entity: the question that retires it must be one of that entity's
      for (const r of c.retired_by) { const q = questions.get(r.question_id); if (q && Array.isArray(q.entity_scope) && !q.entity_scope.includes(cOwner)) err('V-UNC-SCOPE', path, `${c.id} is owned by ${cOwner} but is retired by ${r.question_id}, which is not scoped to that entity`); }
    }
  }

  // ---- services and compositions ---------------------------------------------------------------------------------------------------------------------------------------------------------
  const tuples = new Map();
  const actionById = new Map(R.actions.filter(a => a && a.id).map(a => [a.id, a]));
  for (const o of owners) {
    const { node: n, path, entity } = o; const isSvc = o.kind === 'service';
    need(path + '.entity_id', n.entity_id, 'ent');
    if (n.entity_id !== entity) err('V-COMP-OWNER', path + '.entity_id', `${n.id} is listed under ${entity} but names ${n.entity_id} as its entity (one canonical entity key)`);
    need(path + '.action_id', n.action_id, 'act');
    if (!Array.isArray(n.modifier_ids)) err('V-SCHEMA', path + '.modifier_ids', 'modifier_ids is an array (empty when none)'); else n.modifier_ids.forEach((m, i) => need(`${path}.modifier_ids[${i}]`, m, 'mod'));
    if (!isSvc) { need(path + '.category_id', n.category_id, 'cat'); if (n.group_id !== null && n.group_id !== undefined) need(path + '.group_id', n.group_id, 'grp'); }
    else { const ui = n.presentation && n.presentation.ui_taxonomy; if (!ui) err('V-SCHEMA', path + '.presentation.ui_taxonomy', 'a service has a ui_taxonomy'); else { need(path + '.presentation.ui_taxonomy.category_id', ui.category_id, 'cat'); need(path + '.presentation.ui_taxonomy.group_id', ui.group_id, 'grp'); } }
    // pricing: one path
    const pr = n.pricing; if (!pr || !pr.financial_engine) err('V-COMP-PRICING', path + '.pricing', `${n.id} has no pricing.financial_engine`);
    else {
      const fe = pr.financial_engine;
      if (isSvc) { const hasE = pr.engine !== undefined, hasF = pr.formula_id !== undefined; if (hasE === hasF) err('V-COMP-PRICING', path + '.pricing', `${n.id} names exactly one of pricing.engine and pricing.formula_id`); if (hasF) need(path + '.pricing.formula_id', pr.formula_id, 'fml'); }
      if (fe.formula_ref !== undefined) need(path + '.pricing.financial_engine.formula_ref', fe.formula_ref, 'fml');
      if (fe.pricing_archetype !== undefined) need(path + '.pricing.financial_engine.pricing_archetype', fe.pricing_archetype, 'par');
      if (fe.checkout_state !== undefined) need(path + '.pricing.financial_engine.checkout_state', fe.checkout_state, 'chk');
      if (fe._inherits_checkout_state_from_archetype !== undefined) need(path + '.pricing.financial_engine._inherits_checkout_state_from_archetype', fe._inherits_checkout_state_from_archetype, 'cls');
      if (fe.checkout_state === undefined && fe._inherits_checkout_state_from_archetype === undefined) err('V-COMP-CHECKOUT', path + '.pricing.financial_engine', `${n.id} declares neither a checkout state nor the class it inherits one from`);
    }
    // action-required questions are asked
    // composition identity
    if (isSvc) { const k = [n.entity_id, n.action_id, [...(n.modifier_ids || [])].sort().join(',')].join('|'); if (!tuples.has(k)) tuples.set(k, []); tuples.get(k).push(n); }
    // confidence
    const pol = n.confidence_policy;
    if (!lib.isObj(pol)) err('V-CONF-POLICY', path + '.confidence_policy', `${n.id} has no confidence_policy (a missing declaration is a failure, never 100%)`);
    else {
      const ok = k => typeof pol[k] === 'number' && Number.isFinite(pol[k]);
      for (const k of ['exact_at', 'range_at', 'diagnostic_below']) if (!ok(k)) err('V-CONF-POLICY', `${path}.confidence_policy.${k}`, `${k} is a number`);
      if (pol.scale !== '0-1') err('V-CONF-THRESHOLD', path + '.confidence_policy.scale', 'thresholds are on a 0-1 scale');
      if (ok('exact_at') && ok('range_at') && ok('diagnostic_below')) {
        if (pol.exact_at > 1 || pol.exact_at <= 0) err('V-CONF-THRESHOLD', path + '.confidence_policy.exact_at', `exact_at ${pol.exact_at} is outside (0, 1]`);
        if (pol.diagnostic_below < 0 || pol.range_at < pol.diagnostic_below || pol.exact_at < pol.range_at) err('V-CONF-THRESHOLD', path + '.confidence_policy', `thresholds must satisfy 0 <= diagnostic_below (${pol.diagnostic_below}) <= range_at (${pol.range_at}) <= exact_at (${pol.exact_at})`);
      }
      if (!lib.isObj(pol.policy_sources)) err('V-CONF-POLICY', path + '.confidence_policy.policy_sources', 'where each threshold came from is recorded');
    }
    const gate = n.confidence_gate;
    if (!lib.isObj(gate) || !GATE_MODES.includes(gate.mode)) err('V-CONF-GATE-MISSING', path + '.confidence_gate', `${n.id} declares no confidence_gate (weighted_uncertainty | none); an absent gate is never read as certainty`);
    const prof = n.uncertainty_profile;
    if (gate && gate.mode === 'weighted_uncertainty') {
      if (isSvc) stats.gatedServices++; else stats.gatedCompositions++;
      if (!Array.isArray(prof) || !prof.length) err('V-CONF-GATE-MISSING', path + '.uncertainty_profile', `${n.id} is confidence-gated but its uncertainty_profile is empty`);
      else {
        const seenC = new Set(); let total = 0, reach = 0;
        prof.forEach((p, i) => {
          const pp = `${path}.uncertainty_profile[${i}]`;
          if (!lib.isObj(p) || !need(pp + '.class_id', p.class_id, 'u')) return;
          if (seenC.has(p.class_id)) err('V-UNC-PROFILE-DUP', pp, `${p.class_id} is in the profile twice`); seenC.add(p.class_id);
          if (!(typeof p.weight === 'number' && p.weight > 0 && Number.isFinite(p.weight))) { err('V-UNC-WEIGHT', pp + '.weight', 'a profile weight is a positive number'); return; }
          total += p.weight;
          const c = classes.get(p.class_id); const asksIt = c && c.retired_by.some(r => o.inChain && o.inChain.has(r.question_id));
          if (!asksIt) err('V-UNC-PROFILE-UNASKED', pp, `${n.id} counts ${p.class_id} but never asks a question that retires it, so its confidence can never reach 1`);
          if (asksIt && reachableRetire.get(p.class_id)) reach += p.weight;
        });
        if (total > 0 && pol && typeof pol.exact_at === 'number' && reach / total + 1e-9 < pol.exact_at) err('V-CONF-IMPOSSIBLE', path + '.confidence_policy.exact_at', `${n.id}: exact_at ${pol.exact_at} can never be met: the classes that can be retired carry ${(reach / total).toFixed(3)} of the weight`);
      }
    } else if (gate && gate.mode === 'none') {
      if (Array.isArray(prof) && prof.length) err('V-CONF-GATE-MISSING', path + '.confidence_gate', `${n.id} declares gate "none" but has an uncertainty_profile`);
      if (typeof gate.reason !== 'string' || !gate.reason) err('V-CONF-GATE-MISSING', path + '.confidence_gate.reason', 'gate "none" states why');
      res('confidence_gate_none', n.id, `${o.kind} ${n.id} asks no question with an authored uncertainty weight, so it is not confidence-gated`);
    }
    // recovery
    const rec = n.recovery_affordances;
    if (!lib.isObj(rec)) err('V-COMP-RECOVERY', path + '.recovery_affordances', `${n.id} declares no recovery_affordances`);
    else {
      if (rec.source !== 'current_open_uncertainty') err('V-COMP-RECOVERY', path + '.recovery_affordances.source', 'recovery is composed from the current open uncertainty');
      if (!Array.isArray(rec.deep_dive_question_ids)) err('V-COMP-RECOVERY', path + '.recovery_affordances.deep_dive_question_ids', 'deep_dive_question_ids is an array'); else rec.deep_dive_question_ids.forEach((q, i) => need(`${path}.recovery_affordances.deep_dive_question_ids[${i}]`, q, 'q'));
      if (!lib.isObj(rec.when_no_path) || !need(path + '.recovery_affordances.when_no_path.checkout_state_id', rec.when_no_path.checkout_state_id, 'chk')) err('V-COMP-RECOVERY', path + '.recovery_affordances.when_no_path', 'when no path can retire the open uncertainty, the route is declared');
      if (Array.isArray(rec.deep_dive_question_ids) && rec.deep_dive_question_ids.length === 0 && gate && gate.mode === 'none') res('recovery_no_authored_path', n.id, `${o.kind} ${n.id} has no uncertainty class and no deep-dive question, so recovery can only take the declared when_no_path route`);
    }
    // tags
    for (const k of ['default_tag_ids', 'suggested_tag_ids']) { const v = isSvc ? (n.tags || {})[k] : n[k]; if (v !== undefined) v.forEach((t, i) => need(`${path}.${k}[${i}]`, t, 'tag')); }
    if (!isSvc && n.smart_tag_ids !== undefined) n.smart_tag_ids.forEach((t, i) => need(`${path}.smart_tag_ids[${i}]`, t, 'tag'));
    if (isSvc) { (n.pricing.required_material_ids || []).forEach((m, i) => need(`${path}.pricing.required_material_ids[${i}]`, m, 'mat')); (n.pricing.optional_material_ids || []).forEach((m, i) => need(`${path}.pricing.optional_material_ids[${i}]`, m, 'mat')); (n.related_service_ids || []).forEach((s, i) => need(`${path}.related_service_ids[${i}]`, s, 'svc')); }
  }
  // two curated services at one (entity, action, modifiers) point: the composer cannot choose between them unless the gap is declared
  for (const [k, list] of tuples) if (list.length > 1) for (const s of list) {
    const d = s.decomposition;
    if (!lib.isObj(d) || d.status !== 'open' || typeof d.note !== 'string' || !d.note) err('V-COMP-AMBIGUOUS', decl.svc.get(s.id).path, `${s.id} shares (entity, action, modifiers) = ${k} with ${list.filter(x => x !== s).map(x => x.id).join(', ')} and declares no open decomposition: composing from this point is unsafe`);
    else res('composition_ambiguous', s.id, `${s.id} shares (entity, action, modifiers) = ${k} with ${list.filter(x => x !== s).map(x => x.id).join(', ')}; which modifier or entity separates them is an open business decision`);
  }
  for (const s of services.values()) if (s.decomposition !== undefined && !(lib.isObj(s.decomposition) && s.decomposition.status === 'open')) err('V-COMP-AMBIGUOUS', decl.svc.get(s.id).path + '.decomposition', 'decomposition is {status: "open", note} or absent');

  // ---- condition modifiers (T177): the domain condition that tells two services of one entity and action apart ----------------------------------------------------------------------------------------
  { const used = new Set();
    for (const m of R.modifiers) {
      if (!lib.isObj(m) || !decl.mod.has(m.id)) continue; const mp = decl.mod.get(m.id).path;
      if (m.role !== undefined && m.role !== 'condition') err('V-MOD-ROLE', mp + '.role', `modifier role is "condition" or absent, found ${JSON.stringify(m.role)}`);
      if (m.role === 'condition') {
        if (Number(m.fee) || Number(m.minutes) || (Array.isArray(m.affects) && m.affects.length)) err('V-MOD-ROLE', mp, `${m.id} is a condition modifier and carries no fee or minutes (the service keeps its own price)`);
        for (const k of ['label', 'basis']) if (typeof m[k] !== 'string' || !m[k]) err('V-MOD-ROLE', `${mp}.${k}`, `a condition modifier states its ${k}`);
      }
    }
    for (const o of owners) {
      const ids = o.node.modifier_ids || []; if (new Set(ids).size !== ids.length) err('V-MOD-ASSIGN', o.path + '.modifier_ids', `${o.node.id} lists a modifier twice`);
      ids.forEach((mid, i) => { const m = modById.get(mid); if (!m) return; used.add(mid); if (m.role !== 'condition') err('V-MOD-ASSIGN', `${o.path}.modifier_ids[${i}]`, `${o.node.id} carries ${mid}, which is a fee row (it prices an answer), not a domain condition`); });
    }
    for (const m of R.modifiers) if (lib.isObj(m) && m.role === 'condition' && !used.has(m.id)) res('condition_modifier_unused', m.id, `${m.id} is a condition no service or composition carries`);
    stats.conditionModifiers = R.modifiers.filter(m => lib.isObj(m) && m.role === 'condition').length;
  }

  // service_order is a permutation of the services
  { const so = R.service_order; if (new Set(so).size !== so.length) err('V-ID-DUPLICATE', '$.registries.service_order', 'a service is listed twice');
    so.forEach((id, i) => need(`$.registries.service_order[${i}]`, id, 'svc')); for (const id of services.keys()) if (!so.includes(id)) err('V-REF-DANGLING', '$.registries.service_order', `${id} is a service but is missing from service_order`); }

  // S4 (#165): a group lists its services and a service also names its group. The two are written twice and disagree. Reported, never resolved:
  // which side is right is an Operator ruling per service (RESHAPE_SCOPE_S1_S6.md S4), so each service whose group membership is not exactly one list that matches its own group_id is a declared residual.
  { const listedIn = new Map(); for (const g of Array.isArray(R.groups) ? R.groups : []) if (g && Array.isArray(g.explicit_services)) for (const sid of g.explicit_services) { if (!listedIn.has(sid)) listedIn.set(sid, []); if (!listedIn.get(sid).includes(g.id)) listedIn.get(sid).push(g.id); }
    for (const s of services.values()) { const own = lib.isObj(s.presentation) && lib.isObj(s.presentation.ui_taxonomy) ? s.presentation.ui_taxonomy.group_id : undefined; const lists = listedIn.get(s.id) || [];
      if (lists.length === 0) res('group_membership_disagreement', s.id, `${s.id} names ${own || 'no group'} (ui_taxonomy.group_id) but no group lists it in explicit_services; either the list omits it or its group_id is wrong: an Operator ruling per service, not resolved here`);
      else if (lists.length > 1) res('group_membership_disagreement', s.id, `${s.id} names ${own || 'no group'} (ui_taxonomy.group_id) but ${lists.length} groups list it in explicit_services (${lists.join(', ')}); which listing is right is an Operator ruling per service, not resolved here`);
      else if (own !== lists[0]) res('group_membership_disagreement', s.id, `${s.id} names ${own || 'no group'} (ui_taxonomy.group_id) but is listed in ${lists[0]}; an Operator ruling per service, not resolved here`); } }

  // ---- registries and the carried sections ----------------------------------------------------------------------------------------------------------------------------------------------------
  // A question reference may be {unresolved_name}: a name the legacy file used that names no intake module. It is kept visibly (a residual), never dropped and never given an invented target.
  const dangling = (path, v) => { if (lib.isObj(v) && typeof v.unresolved_name === 'string' && v.unresolved_name && Object.keys(v).length === 1) { res('dangling_legacy_reference', path, `"${v.unresolved_name}" names no intake module in the legacy file; it is kept as an unresolved name, not a reference`); return true; } return false; };
  const typed = (root, rp, segs, type) => eachAt(root, segs, (v, p) => { const one = (x, pp) => { if (type === 'q' && dangling(pp, x)) return; need(pp, x, type); }; if (Array.isArray(v)) v.forEach((x, i) => one(x, `${rp}${p}[${i}]`)); else one(v, rp + p); });
  typed(src.entities, '$.entities', ['[]', 'parent_id'], 'ent');
  typed(R.categories, '$.registries.categories', ['[]', 'group_ids', '[]'], 'grp');
  typed(R.groups, '$.registries.groups', ['[]', 'category_id'], 'cat');
  typed(R.groups, '$.registries.groups', ['[]', 'parent_group'], 'grp');
  typed(R.groups, '$.registries.groups', ['[]', 'explicit_services', '[]'], 'svc');
  typed(R.groups, '$.registries.groups', ['[]', 'dynamic_service_types', '[]'], 'act');
  typed(R.groups, '$.registries.groups', ['[]', 'picker', 'component_entity_ids', '[]'], 'ent');
  typed(R.groups, '$.registries.groups', ['[]', 'picker', 'component_links', '[]', 'entity_id'], 'ent');
  typed(R.groups, '$.registries.groups', ['[]', 'picker', 'component_links', '[]', 'service_ids', '[]'], 'svc');
  typed(R.groups, '$.registries.groups', ['[]', 'picker', 'symptom_question_id'], 'q');
  typed(R.groups, '$.registries.groups', ['[]', 'picker', 'symptoms', '[]', 'service_ids', '[]'], 'svc');
  typed(R.groups, '$.registries.groups', ['[]', 'picker', 'known_need_tiles', '[]', 'service_id'], 'svc');
  typed(R.groups, '$.registries.groups', ['[]', 'picker', 'symptom_tiles', '[]', 'tag_ids', '[]'], 'tag');
  typed(R.groups, '$.registries.groups', ['[]', 'picker', 'action_ids', '[]'], 'act');
  typed(R.tags, '$.registries.tags', ['[]', 'requires', '[]'], 'tag');
  typed(R.tags, '$.registries.tags', ['[]', 'derived_from', '[]'], 'tag');
  typed(R.tags, '$.registries.tags', ['[]', 'mutually_exclusive', '[]'], 'tag');
  typed(R.tags, '$.registries.tags', ['[]', 'applicable_group_ids', '[]'], 'grp');
  typed(R.tags, '$.registries.tags', ['[]', 'excluded_service_ids', '[]'], 'svc');
  eachAt(R.tags, ['[]', 'applicable_categories', '[]'], (v, p) => { if (v !== 'all') need('$.registries.tags' + p, v, 'cat'); });
  eachAt(R.tags, ['[]', 'answers', '[]'], (a, p) => { const ap = '$.registries.tags' + p; if (!lib.isObj(a) || typeof a.question_id !== 'string' || typeof a.option_id !== 'string') { err('V-REF-LABEL', ap, 'a tag answer is {question_id, option_id}'); return; } if (need(ap + '.question_id', a.question_id, 'q') && !optionById(a.question_id, a.option_id)) err('V-DEP-OPTION', ap + '.option_id', `${a.option_id} is not an option of ${a.question_id}`); });
  for (const t of R.tags) if (t && !Array.isArray(t.answers) && t.answers !== undefined) err('V-REF-LABEL', '$.registries.tags', `${t.id}: answers must be an array of {question_id, option_id}, found ${typeof t.answers}`);
  typed(R.actions, '$.registries.actions', ['[]', 'required_intake_modules', '[]'], 'q');
  typed(R.behavioral_classes, '$.registries.behavioral_classes', ['[]', 'member_group_ids', '[]'], 'grp');
  typed(R.behavioral_classes, '$.registries.behavioral_classes', ['[]', 'typical_actions', '[]'], 'act');
  typed(R.behavioral_classes, '$.registries.behavioral_classes', ['[]', 'default_checkout_state'], 'chk');
  for (const k of ['patch_modifier_ref', 'texture_modifier_ref', 'grout_modifier_ref', 'water_damage_modifier_ref', 'high_ceiling_modifier_ref', 'disposal_modifier_ref', 'membrane_modifier_ref']) typed(R.pricing_formulas, '$.registries.pricing_formulas', ['[]', k], 'mod');
  eachAt(R.pricing_formulas, ['[]', 'issue_type_fees', '[]'], (r, p) => { const rp = '$.registries.pricing_formulas' + p; if (!lib.isObj(r) || typeof r.question_id !== 'string' || typeof r.option_id !== 'string') { err('V-REF-LABEL', rp, 'an issue-type fee is keyed by {question_id, option_id}, never by an option label'); return; } if (need(rp + '.question_id', r.question_id, 'q') && !optionById(r.question_id, r.option_id)) err('V-DEP-OPTION', rp + '.option_id', `${r.option_id} is not an option of ${r.question_id}`); if (r.modifier_id !== undefined) need(rp + '.modifier_id', r.modifier_id, 'mod'); });
  for (const f of R.pricing_formulas) if (f && f.issue_type_fees !== undefined && !Array.isArray(f.issue_type_fees)) err('V-REF-LABEL', '$.registries.pricing_formulas', `${f.id}: issue_type_fees must be an array of {question_id, option_id, ...}`);
  eachAt(R.pricing_formulas, ['[]', 'anchor_and_overflow_ref_by_service', '[]'], (r, p) => { const rp = '$.registries.pricing_formulas' + p; if (!lib.isObj(r)) { err('V-REF-LABEL', rp, 'an anchor is {service_id, ...}'); return; } need(rp + '.service_id', r.service_id, 'svc'); if (r.overflow_modifier_id !== undefined) need(rp + '.overflow_modifier_id', r.overflow_modifier_id, 'mod'); });
  { const gr = src.policy.global_rules || {};
    for (const [sect, type] of [['group_defaults', 'grp'], ['category_defaults', 'cat']]) { const m = (gr.intake_defaults || {})[sect] || {}; for (const [k, list] of Object.entries(m)) { need(`$.policy.global_rules.intake_defaults.${sect}.${k}`, k, type); if (Array.isArray(list)) list.forEach((q, i) => { if (!dangling(`$.policy.global_rules.intake_defaults.${sect}.${k}[${i}]`, q)) need(`$.policy.global_rules.intake_defaults.${sect}.${k}[${i}]`, q, 'q'); }); else err('V-SCHEMA', `$.policy.global_rules.intake_defaults.${sect}.${k}`, 'a default list is an array of question ids'); } }
    const fm = gr.force_modules_by_variability_DEPRECATED || {}; for (const [k, list] of Object.entries(fm)) if (Array.isArray(list)) list.forEach((q, i) => { if (!dangling(`$.policy.global_rules.force_modules_by_variability_DEPRECATED.${k}[${i}]`, q)) need(`$.policy.global_rules.force_modules_by_variability_DEPRECATED.${k}[${i}]`, q, 'q'); }); }
  typed(src.policy.ui_config, '$.policy.ui_config', ['step2_types', '[]'], 'act');
  typed(src.vocabulary.nlp_objects, '$.vocabulary.nlp_objects', ['[]', 'default_dynamic_category'], 'cat');
  typed(src.vocabulary.nlp_objects, '$.vocabulary.nlp_objects', ['[]', 'default_service_type'], 'act');
  typed(src.vocabulary.nlp_objects, '$.vocabulary.nlp_objects', ['[]', 'default_service_sku'], 'svc');
  typed(src.vocabulary.nlp_objects, '$.vocabulary.nlp_objects', ['[]', 'contextual_overrides', '[]', 'override_sku'], 'svc');
  typed(src.vocabulary.nlp_objects, '$.vocabulary.nlp_objects', ['[]', 'contextual_overrides', '[]', 'smart_tag'], 'tag');
  typed(src.vocabulary.nlp_objects, '$.vocabulary.nlp_objects', ['[]', 'dynamic_rule'], 'fml');
  typed(src.vocabulary.nlp_default_fallback, '$.vocabulary.nlp_default_fallback', ['category'], 'cat');
  typed(src.vocabulary.nlp_default_fallback, '$.vocabulary.nlp_default_fallback', ['service_type'], 'act');
  R.groups.forEach((g, i) => { const p = g.picker; if (!lib.isObj(p)) { err('V-SCHEMA', `$.registries.groups[${i}].picker`, 'a group has a picker'); return; } if (!ENTRY_MODES.includes(p.entry_mode)) err('V-SCHEMA', `$.registries.groups[${i}].picker.entry_mode`, `entry_mode is one of ${ENTRY_MODES.join(', ')}`);
    for (const l of p.component_links || []) if (!(p.component_entity_ids || []).includes(l.entity_id)) err('V-REF-DANGLING', `$.registries.groups[${i}].picker.component_links`, `${l.entity_id} is linked but is not one of the group's listed components`); });
  // a category lists exactly the groups that name it
  for (const c of R.categories) for (const gid of c.group_ids || []) { const g = decl.grp.get(gid); if (g && g.node.category_id !== c.id) err('V-REF-DANGLING', '$.registries.categories', `${c.id} lists ${gid}, whose category_id is ${g.node.category_id}`); }

  // ---- generic scan: nothing id-shaped anywhere names something that does not exist ------------------------------------------------------------------------------------------------------------
  const scanSkip = new Set(['id']);
  const walk = (v, p, key) => {
    if (typeof v === 'string') { if (!scanSkip.has(key) && ID_RE.test(v) && idType(v) && !exists(v)) err('V-REF-DANGLING', p, `${v} is id-shaped and names no ${ID_TYPES[idType(v)]}`); }
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`, key));
    else if (lib.isObj(v)) for (const [k, x] of Object.entries(v)) { if (ID_RE.test(k) && idType(k) && !exists(k)) err('V-REF-DANGLING', `${p}.${k}`, `key ${k} is id-shaped and names no ${ID_TYPES[idType(k)]}`); walk(x, `${p}.${k}`, k); }
  };
  for (const k of ['registries', 'entities', 'shared_questions', 'shared_uncertainty_classes', 'policy', 'vocabulary']) walk(src[k], '$.' + k, k);

  // ---- customer vocabulary (T177): how the customer's words reach an entity and an action --------------------------------------------------------------------------------------------------------------
  { const normS = x => String(x).toLowerCase().replace(/\s+/g, ' ').trim();
    const idWords = id => id.slice(id.indexOf('.') + 1).replace(/_/g, ' ');
    const slugS = x => String(x).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const nameOf = new Map(); // the words that already name an entity: its label and its id
    for (const e of entities.values()) for (const n of [normS(e.label), normS(idWords(e.id))]) { if (!nameOf.has(n)) nameOf.set(n, new Set()); nameOf.get(n).add(e.id); }
    const svcNameOwner = new Map(); // the names of services (slug words, display name) -> Set(owning entity id): a customer word that names a service belongs to its owner
    for (const e of src.entities) for (const sv of (e.services || [])) for (const n of [normS(idWords(sv.id)), sv.presentation && sv.presentation.ui_taxonomy && sv.presentation.ui_taxonomy.display_name ? normS(sv.presentation.ui_taxonomy.display_name) : null]) { if (!n) continue; if (!svcNameOwner.has(n)) svcNameOwner.set(n, new Set()); svcNameOwner.get(n).add(e.id); }
    const claimedBy = new Map(); stats.aliases = 0;
    src.entities.forEach((e, i) => {
      const ap = `$.entities[${i}].aliases`; const seen = new Set(); if (!Array.isArray(e.aliases)) return;
      e.aliases.forEach((a, j) => {
        const pj = `${ap}[${j}]`; stats.aliases++;
        if (typeof a !== 'string' || a === '' || a !== normS(a)) { err('V-VOC-ALIAS-SHAPE', pj, `an alias is a non-empty lowercase string with single spaces, found ${JSON.stringify(a)}`); return; }
        if (seen.has(a)) { err('V-VOC-ALIAS-DUP', pj, `${e.id} lists the alias ${JSON.stringify(a)} twice`); return; } seen.add(a);
        if ([normS(e.label), normS(idWords(e.id))].includes(a)) err('V-VOC-ALIAS-SHAPE', pj, `the alias ${JSON.stringify(a)} repeats the name of ${e.id} itself`);
        const others = [...(nameOf.get(a) || [])].filter(x => x !== e.id);
        if (others.length) err('V-VOC-ALIAS-AMBIGUOUS', pj, `the alias ${JSON.stringify(a)} of ${e.id} is the name of ${others.join(', ')}: a word that names one entity cannot be another's alias`);
        const svcOwners = svcNameOwner.get(a); if (svcOwners && svcOwners.size === 1 && !svcOwners.has(e.id)) err('V-VOC-ALIAS-SERVICE-OWNER', pj, `the alias ${JSON.stringify(a)} of ${e.id} is the name of a service owned by ${[...svcOwners][0]}: a word that names a service reaches the entity that owns it`);
        if (!claimedBy.has(a)) claimedBy.set(a, []); claimedBy.get(a).push(e.id);
      });
    });
    for (const [a, es] of claimedBy) if (es.length > 1) err('V-VOC-ALIAS-AMBIGUOUS', '$.entities', `the alias ${JSON.stringify(a)} is claimed by ${es.join(', ')}: ambiguity is surfaced, not chosen`);
    (Array.isArray(src.vocabulary.nlp_objects) ? src.vocabulary.nlp_objects : []).forEach((o, i) => {
      const op = `$.vocabulary.nlp_objects[${i}]`; const r = o.resolves_to;
      if (!lib.isObj(r)) { err('V-VOC-OBJECT-RESOLVE', op + '.resolves_to', `${o.keyword}: an NLP object records which entity it feeds (or that it feeds none)`); return; }
      const direct = 'ent.' + slugS(o.keyword);
      const wantBasis = decl.ent.has(direct) ? 'keyword_is_entity' : (svcEntity.has(o.default_service_sku) ? 'default_service_entity' : 'unresolved');
      const wantEnt = wantBasis === 'keyword_is_entity' ? direct : (wantBasis === 'default_service_entity' ? svcEntity.get(o.default_service_sku) : null);
      if (r.basis !== wantBasis || (r.entity_id === undefined ? null : r.entity_id) !== wantEnt) { err('V-VOC-OBJECT-RESOLVE', op + '.resolves_to', `${o.keyword}: feeds ${wantEnt || 'no entity'} by ${wantBasis} (its keyword names an entity, else its default service's entity), but records ${JSON.stringify(r)}`); return; }
      if (wantBasis === 'unresolved') { res('nlp_object_unresolved', o.keyword, `the NLP object "${o.keyword}" names no entity and has no default service, so none of its words reaches an entity (a category-level word)`); return; }
      const seenT = new Set();
      for (const t of [o.keyword, ...(Array.isArray(o.synonyms) ? o.synonyms : [])]) { const n = normS(t); if (seenT.has(n)) continue; seenT.add(n);
        const svcOwn = svcNameOwner.get(n); const target = svcOwn && svcOwn.size === 1 && !svcOwn.has(wantEnt) ? [...svcOwn][0] : wantEnt; // a word that names a service goes to the service's owner
        const e = entities.get(target); const have = new Set([...(e.aliases || []), normS(e.label), normS(idWords(e.id))]); if (have.has(n)) continue;
        const other = [...(nameOf.get(n) || [])].filter(x => x !== target);
        res('object_term_not_aliased', `${o.keyword}:${n}`, other.length ? `"${n}" is a synonym of the NLP object "${o.keyword}" (feeding ${target}) but is also the name of ${other.join(', ')}; it is not an alias of either until an Operator rules which the customer means` : `"${n}" is a synonym of the NLP object "${o.keyword}" (feeding ${target}) but is not among its aliases`); }
    });
    // action vocabulary: id-keyed
    const av = src.vocabulary.action_vocabulary; const seenA = new Set(), formOwner = new Map();
    const forms = (x, xp) => {
      if (typeof x.infinitive_for_adlib !== 'string' || !x.infinitive_for_adlib) err('V-VOC-ACTION-FORMS', xp + '.infinitive_for_adlib', 'an action states its infinitive');
      if (!Array.isArray(x.all_forms) || !x.all_forms.length || x.all_forms.some(f => typeof f !== 'string' || !f)) { err('V-VOC-ACTION-FORMS', xp + '.all_forms', 'all_forms is a non-empty array of strings'); return []; }
      const out = [...x.all_forms];
      (x.synonym_clusters || []).forEach((c, ci) => { if (!lib.isObj(c) || typeof c.infinitive !== 'string' || !Array.isArray(c.forms) || !c.forms.length) { err('V-VOC-ACTION-FORMS', `${xp}.synonym_clusters[${ci}]`, 'a synonym cluster has an infinitive and forms'); return; } if (!c.forms.includes(c.infinitive)) err('V-VOC-ACTION-FORMS', `${xp}.synonym_clusters[${ci}]`, `forms do not include ${JSON.stringify(c.infinitive)}`); out.push(...c.forms); });
      if (!out.includes(x.infinitive_for_adlib)) err('V-VOC-ACTION-FORMS', xp + '.infinitive_for_adlib', `the infinitive ${JSON.stringify(x.infinitive_for_adlib)} is none of the forms the engine matches (all_forms or a synonym cluster's forms), so the ad-lib sentence would say a word the customer's sentence could never have matched`);
      return out;
    };
    if (lib.isObj(av) && Array.isArray(av.actions) && Array.isArray(av.unmapped_verbs)) {
      av.actions.forEach((a, i) => {
        const ap = `$.vocabulary.action_vocabulary.actions[${i}]`; if (!lib.isObj(a) || !need(ap + '.action_id', a.action_id, 'act')) return;
        if (seenA.has(a.action_id)) err('V-VOC-ACTION-DUP', ap, `${a.action_id} has two vocabulary entries`); seenA.add(a.action_id);
        for (const f of new Set(forms(a, ap).map(normS))) { if (!formOwner.has(f)) formOwner.set(f, new Set()); formOwner.get(f).add(a.action_id); }
      });
      const seenV = new Set();
      av.unmapped_verbs.forEach((v, i) => { const vp = `$.vocabulary.action_vocabulary.unmapped_verbs[${i}]`; if (!lib.isObj(v) || typeof v.verb !== 'string' || !v.verb) { err('V-VOC-ACTION-FORMS', vp, 'an unmapped verb has a name'); return; } if (seenV.has(v.verb)) err('V-VOC-ACTION-DUP', vp, `${v.verb} is listed twice`); seenV.add(v.verb); forms(v, vp);
        res('verb_without_action', v.verb, `the customer verb "${v.verb}" has vocabulary but no action in the registry, so it cannot yet reach an (entity, action) pair; whether it becomes an action is an Operator decision`); });
      for (const a of R.actions) if (lib.isObj(a) && !seenA.has(a.id)) res('action_without_vocabulary', a.id, `${a.id} has no customer vocabulary in action_vocabulary, so no word the customer says maps to it`);
      for (const [f, as] of formOwner) if (as.size > 1) res('verb_form_shared', f, `the customer form "${f}" is vocabulary of ${[...as].join(' and ')}: which one the customer means is not decided by the vocabulary`);
    } else err('V-SCHEMA', '$.vocabulary.action_vocabulary', 'action_vocabulary is {actions: [...], unmapped_verbs: [...]}');
  }

  // ---- pricing archetypes (T177): the shape a service declares must be the shape its engine has -------------------------------------------------------------------------------------------------------------
  // The legacy file declares an archetype on most services but nothing checks it. Only DECLARED archetypes are checked, and a disagreement is reported, never rewritten.
  // A service names its formula in one of two places and the runtime reads both: financial_engine.formula_ref (a service typed "formula") or the entity's own pricing_engine, which the source holds as pricing.formula_id
  // (the hourly services bound to a formula by T118 and T135+). T177 read only the first and so reported three correctly labelled services as having no formula (T178 corrected it, PENDING_DECISIONS #219).
  // The reverse direction (a named formula under another archetype) stays on formula_ref alone: formula_id is also set on services that are meant to be priced by their hourly engine.
  { stats.archetypeChecked = 0;
    for (const o of owners) { const fe = o.node.pricing && o.node.pricing.financial_engine; if (!lib.isObj(fe) || fe.pricing_archetype === undefined) continue; stats.archetypeChecked++;
      const par = fe.pricing_archetype;
      const named = fe.formula_ref || o.node.pricing.formula_id;
      if (par === 'par.formula' && !named) res('pricing_archetype_mismatch', o.node.id, `${o.node.id} declares par.formula but names no formula (neither financial_engine.formula_ref nor pricing.formula_id), so there is no formula to look up and run`);
      else if (par !== 'par.formula' && fe.formula_ref) { const why = typeof fe._archetype_note === 'string' ? fe._archetype_note.trim().replace(/\s+/g, ' ') : '';
        res('pricing_archetype_mismatch', o.node.id, `${o.node.id} names the formula ${fe.formula_ref} but declares ${par}, not par.formula${why ? ` (its own _archetype_note records why: "${why.length > 220 ? why.slice(0, 220) + '...' : why}")` : ''}`); }
      else if (par === 'par.flat_simple' && fe.type !== 'flat_rate') res('pricing_archetype_mismatch', o.node.id, `${o.node.id} declares par.flat_simple (one fixed base price) but its financial type is ${JSON.stringify(fe.type)}`);
    }
  }

  // ---- does a question change the quote? (T177, PENDING_DECISIONS #96) ---------------------------------------------------------------------------------------------------------------------------------------
  // The legacy flag affects_price is a claim the file makes about a question; its only reader is a UI badge. Whether a question changes a price is a FACT of its options (an option declares the effect "price",
  // and the validator holds that declaration to its cause). So the claim is checked against the options, in both directions, and every disagreement is reported:
  //   backed            some option prices the quote                                         (counted)
  //   price_claim_indirect  claimed, no option prices it, but an option changes minutes, quantity, complexity, a branch, a checkout state or materials
  //   price_claim_unwired   claimed, and no option changes the quote at all
  //   price_effect_unclaimed  not claimed, yet an option prices the quote (the badge would be missing)
  { const QUOTE = ['minutes', 'quantity', 'complexity', 'branch', 'checkout_state', 'materials'];
    stats.priceClaim = { claimed: 0, backed: 0, indirect: 0, unwired: 0, unclaimed_priced: 0, not_claimed: 0 };
    for (const q of allQuestions) {
      if (q.instance_of) continue; // an instance is the same question under another noun
      const os = optionsOf(q) || []; const any = k => os.some(o => Array.isArray(o.affects) && o.affects.includes(k));
      const claim = lib.isObj(q.runtime_compat) ? q.runtime_compat.affects_price : undefined;
      const numeric = q.type === 'numeric_multiplier'; // a count the booking multiplies by: it changes the quote by being a quantity
      const priced = any('price'), other = numeric || QUOTE.some(any);
      if (claim === true) {
        stats.priceClaim.claimed++;
        if (priced) stats.priceClaim.backed++;
        else if (other) { stats.priceClaim.indirect++; res('price_claim_indirect', q.id, `${q.id} is claimed to affect price, but no option prices the quote; it changes ${numeric ? 'the quantity (a numeric count)' : QUOTE.filter(any).join(', ')} only`); }
        else { stats.priceClaim.unwired++; res('price_claim_unwired', q.id, `${q.id} is claimed to affect price, but no option changes the quote (price, minutes, quantity, complexity, branch, checkout state or materials)`); }
      } else { stats.priceClaim.not_claimed++; if (priced) { stats.priceClaim.unclaimed_priced++; res('price_effect_unclaimed', q.id, `${q.id} carries no affects_price claim, yet an option prices the quote`); } }
    }
  }

  // ---- the three axes (R-COMPLEX-AXES, R-COMPLEX-COMPOUNDS, P-COMPLEX-FURNITURE) -----------------------------------------------------------------------------------------------------------------------
  // Every curated service declares complexity_profile {tier, risk_tier, batch_risk_compounds}; none is inferred from another. The risk tier is the highest tier of the hazards the profile names, the batch flag is true exactly
  // when it names a ground (a physical one the Charter lists, or a signal this validator can read from the service's own record), and a signal present in the record must be named: belief alone is not a signal.
  { const AX = src.policy && src.policy.complexity_axes; let vocabOk = true;
    const vErr = (p, m) => { vocabOk = false; err('V-COMPLEX-VOCAB', '$.policy.complexity_axes' + p, m); };
    if (!lib.isObj(AX)) vErr('', 'policy.complexity_axes is missing: the three axes have no vocabulary to be declared in');
    else {
      const sameList = (a, b) => Array.isArray(a) && a.length === b.length && b.every((x, i) => a[i] === x);
      if (!sameList(AX.tiers, ['routine', 'skilled', 'specialized', 'project'])) vErr('.tiers', 'the skill tiers are routine, skilled, specialized, project, in that order (R-COMPLEX-AXES)');
      if (!sameList(AX.risk_tiers, ['R0', 'R1', 'R2', 'R3'])) vErr('.risk_tiers', 'the risk tiers are R0, R1, R2, R3, in that order (R-COMPLEX-AXES)');
      if (!lib.isObj(AX.risk_hazards) || !Object.keys(AX.risk_hazards).length) vErr('.risk_hazards', 'risk_hazards names the hazards a risk tier rests on');
      else for (const [h, d] of Object.entries(AX.risk_hazards)) { if (!lib.isObj(d) || !(AX.risk_tiers || []).includes(d.tier) || typeof d.meaning !== 'string' || !d.meaning) vErr('.risk_hazards.' + h, 'a hazard names its risk tier (one of R0..R3) and its meaning'); }
      if (lib.isObj(AX.risk_hazards) && !(AX.risk_hazards.none && AX.risk_hazards.none.tier === 'R0')) vErr('.risk_hazards.none', 'the hazard "none" is R0 (a service with no hazard says so; it does not leave the axis blank)');
      for (const k of ['batch_physical_bases', 'batch_signals']) if (!lib.isObj(AX[k]) || !Object.keys(AX[k]).length) vErr('.' + k, k + ' is a non-empty object of code -> meaning');
      if (lib.isObj(AX.batch_signals)) for (const k of ['overflow_formula', 'per_unit_penalty_minutes', 'single_use_consumable', 'scope_changing_branch']) if (!(k in AX.batch_signals)) vErr('.batch_signals.' + k, 'the Charter names this signal (R-COMPLEX-COMPOUNDS); the vocabulary must carry it');
      if (!Array.isArray(AX.single_use_consumable_material_ids)) vErr('.single_use_consumable_material_ids', 'an array of material ids');
      else AX.single_use_consumable_material_ids.forEach((m, i) => { if (!decl.mat.has(m)) vErr(`.single_use_consumable_material_ids[${i}]`, `${JSON.stringify(m)} names no material`); });
      if (!lib.isObj(AX.assembly_classes) || !sameList(Object.keys(AX.assembly_classes), ['A0', 'A1', 'A2', 'A3'])) vErr('.assembly_classes', 'the assembly classes are A0, A1, A2, A3 (P-COMPLEX-FURNITURE)');
      else for (const [c, d] of Object.entries(AX.assembly_classes)) if (!lib.isObj(d) || !(AX.tiers || []).includes(d.minimum_tier)) vErr('.assembly_classes.' + c, 'an assembly class names the minimum skill tier it implies');
      if (!Array.isArray(AX.assembly_family_service_ids)) vErr('.assembly_family_service_ids', 'an array of service ids');
      else AX.assembly_family_service_ids.forEach((id, i) => { if (!services.has(id)) vErr(`.assembly_family_service_ids[${i}]`, `${JSON.stringify(id)} names no service`); });
    }
    const formulas = new Map(R.pricing_formulas.map(f => [f.id, f]));
    stats.complexity = { profiled: 0, services: services.size, batch_true: 0, risk: { R0: 0, R1: 0, R2: 0, R3: 0 } };
    for (const s of services.values()) {
      const path = decl.svc.get(s.id).path + '.complexity_profile'; const p = s.complexity_profile;
      if (!lib.isObj(p)) { err('V-COMPLEX-PROFILE', path, `${s.id} declares no complexity_profile (R-COMPLEX-AXES: every service declares all three axes; none is left to be inferred)`); continue; }
      if (!vocabOk) continue;
      let okP = true;
      if (!AX.tiers.includes(p.tier)) { okP = false; err('V-COMPLEX-PROFILE', path + '.tier', `${s.id}: tier ${JSON.stringify(p.tier)} is not one of ${AX.tiers.join(' | ')}`); }
      if (!AX.risk_tiers.includes(p.risk_tier)) { okP = false; err('V-COMPLEX-PROFILE', path + '.risk_tier', `${s.id}: risk_tier ${JSON.stringify(p.risk_tier)} is not one of ${AX.risk_tiers.join(' | ')}`); }
      if (typeof p.batch_risk_compounds !== 'boolean') { okP = false; err('V-COMPLEX-PROFILE', path + '.batch_risk_compounds', `${s.id}: batch_risk_compounds is true or false, found ${JSON.stringify(p.batch_risk_compounds)}`); }
      if (!Array.isArray(p.risk_basis) || !p.risk_basis.length) { okP = false; err('V-COMPLEX-RISK', path + '.risk_basis', `${s.id}: the risk tier names the hazards it rests on (a service with none says ["none"])`); }
      if (!Array.isArray(p.batch_risk_basis)) { okP = false; err('V-COMPLEX-BATCH', path + '.batch_risk_basis', `${s.id}: batch_risk_basis is an array (empty when the flag is false)`); }
      if (!okP) continue;
      stats.complexity.profiled++; stats.complexity.risk[p.risk_tier]++; if (p.batch_risk_compounds) stats.complexity.batch_true++;
      // the skill tier is declared in two places (the profile, and pricing.operational_metrics which the runtime reads today); one axis, one value
      const om = s.pricing && s.pricing.operational_metrics;
      if (om && om.complexity_tier !== p.tier) err('V-COMPLEX-TIER', path + '.tier', `${s.id}: the profile says tier ${p.tier} but pricing.operational_metrics.complexity_tier says ${om.complexity_tier}; the two declare the same axis and must agree`);
      // the risk tier is the highest tier among the hazards named: it follows from named hazards, it is not a free-hand value
      const hz = p.risk_basis; let top = 'R0', hazOk = true;
      for (const h of hz) { const d = AX.risk_hazards[h]; if (!d) { hazOk = false; err('V-COMPLEX-RISK', path + '.risk_basis', `${s.id}: ${JSON.stringify(h)} is not a hazard in policy.complexity_axes.risk_hazards`); continue; } if (AX.risk_tiers.indexOf(d.tier) > AX.risk_tiers.indexOf(top)) top = d.tier; }
      if (new Set(hz).size !== hz.length) err('V-COMPLEX-RISK', path + '.risk_basis', `${s.id}: a hazard is named twice`);
      if (hz.includes('none') && hz.length > 1) err('V-COMPLEX-RISK', path + '.risk_basis', `${s.id}: "none" cannot be named beside another hazard`);
      if (hazOk && top !== p.risk_tier) err('V-COMPLEX-RISK', path + '.risk_tier', `${s.id}: risk_tier is ${p.risk_tier} but the hazards it names (${hz.join(', ')}) reach ${top}`);
      // the batch flag: true exactly when a ground is named; a physical ground must be one the vocabulary lists; a signal must be backed by the service's own record, and a signal in the record must be named
      const sig = complexitySignals(s, formulas, questions, AX.single_use_consumable_material_ids || []);
      const bb = p.batch_risk_basis;
      if (new Set(bb).size !== bb.length) err('V-COMPLEX-BATCH', path + '.batch_risk_basis', `${s.id}: a ground is named twice`);
      for (const b of bb) {
        if (typeof b !== 'string') { err('V-COMPLEX-BATCH', path + '.batch_risk_basis', `${s.id}: a ground is a string code`); continue; }
        if (b in AX.batch_physical_bases) continue;
        if (b in AX.batch_signals || b.startsWith('single_use_consumable:')) { if (!sig.includes(b)) err('V-COMPLEX-BATCH', path + '.batch_risk_basis', `${s.id}: names the signal ${b}, which its own record does not show (belief alone is not a signal; R-COMPLEX-COMPOUNDS)`); continue; }
        err('V-COMPLEX-BATCH', path + '.batch_risk_basis', `${s.id}: ${JSON.stringify(b)} is neither a physical ground nor a signal in policy.complexity_axes`);
      }
      for (const g of sig) if (!bb.includes(g)) err('V-COMPLEX-BATCH', path + '.batch_risk_basis', `${s.id}: its record shows the signal ${g} (R-COMPLEX-COMPOUNDS), so it compounds and must name it`);
      if (p.batch_risk_compounds !== (bb.length > 0)) err('V-COMPLEX-BATCH', path + '.batch_risk_compounds', `${s.id}: batch_risk_compounds is ${p.batch_risk_compounds} but it names ${bb.length} ground(s); the flag is true exactly when a ground is named`);
      // P-COMPLEX-FURNITURE: the assembly-family services declare their class, and the tier is at least the class's minimum; no other service carries one
      const fam = AX.assembly_family_service_ids.includes(s.id);
      if (fam && p.assembly_class === undefined) err('V-COMPLEX-ASSEMBLY', path + '.assembly_class', `${s.id} is an assembly-family service and declares its assembly class explicitly (P-COMPLEX-FURNITURE)`);
      if (!fam && p.assembly_class !== undefined) err('V-COMPLEX-ASSEMBLY', path + '.assembly_class', `${s.id} is not in policy.complexity_axes.assembly_family_service_ids but declares an assembly class`);
      if (p.assembly_class !== undefined) {
        const ac = AX.assembly_classes[p.assembly_class];
        if (!ac) err('V-COMPLEX-ASSEMBLY', path + '.assembly_class', `${s.id}: ${JSON.stringify(p.assembly_class)} is not one of ${Object.keys(AX.assembly_classes).join(', ')}`);
        else if (AX.tiers.indexOf(p.tier) < AX.tiers.indexOf(ac.minimum_tier)) err('V-COMPLEX-ASSEMBLY', path + '.tier', `${s.id}: assembly class ${p.assembly_class} implies a tier of at least ${ac.minimum_tier}, but the tier is ${p.tier}`);
      }
    }
    // a dynamic service inherits the axes of the group it resolves into (P-COMPLEX-DYNAMIC); no group declares axes, so a default composition carries only its skill tier. Declared, counted, not hidden.
    for (const c of compositions.values()) res('composition_axes_undeclared', c.id, `${c.id}: a dynamic service inherits its group's axes (P-COMPLEX-DYNAMIC), and no group declares a risk tier or batch-risk flag yet; only the skill tier is declared`);
  }

  // ---- coverage facts the report reads --------------------------------------------------------------------------------------------------------------------------------------------------------------
  for (const q of allQuestions) { if (Array.isArray(q.entity_scope) === false && q.entity_scope && q.entity_scope.context === 'ctx.unreferenced') res('question_asked_by_nothing', q.id, `${q.id} is authored but no chain, deep-dive question, default list or action asks it; its entity scope is an Operator decision`); }
  for (const q of allQuestions) for (const o of q.options || []) if (o.evidence === 'unknown') res('unknown_option', `${q.id}/${o.id}`, `${JSON.stringify(o.label)} is classified as an unknown answer by label pattern (never retires uncertainty)`);
  stats.idsByType = Object.fromEntries(Object.keys(ID_TYPES).map(t => [t, decl[t].size]).filter(([, n]) => n > 0));
  stats.errors = errors.length; stats.residuals = residuals.length;
  // the declared ids by type, for the id register (id_register.js); read-only, the same declarations every reference above was checked against
  const declared = Object.fromEntries(Object.keys(ID_TYPES).map(t => [t, [...decl[t].keys()]]));
  return { ok: errors.length === 0, errors, residuals, stats, declared };
}

// validate() is the semantic rules, in process. validateFull() adds the structural JSON Schema check (python jsonschema, one spawn) and is what the CLI and the derivation call. A schema check that
// cannot RUN is a finding, never a pass.
function validateFull(src) {
  const cp = require('child_process'), os = require('os'), path = require('path');
  const r = validate(src);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ef-schema-'));
  try {
    const f = path.join(dir, 'source.json'); fs.writeFileSync(f, JSON.stringify(src));
    const p = cp.spawnSync('python3', ['-I', path.join(__dirname, 'schema_check.py'), lib.PATHS.schema, f], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (p.status === 2 || p.status === null) r.errors.unshift({ code: 'V-SCHEMA', path: '$', msg: 'the schema check could not run: ' + ((p.stdout || '') + (p.stderr || '')).slice(0, 300) });
    else if (p.status === 1) {
      const lines = (p.stdout || '').split('\n').filter(Boolean);
      // exit 1 means "invalid, with findings on stdout". Exit 1 with no finding is a crash that looks like a verdict, and a verdict of "no findings" is a pass: it is a finding instead.
      if (!lines.length) r.errors.unshift({ code: 'V-SCHEMA', path: '$', msg: 'the schema check reported the source invalid but gave no finding (treated as a failure to run): ' + (p.stderr || '').slice(-300) });
      for (const line of lines) { try { const j = JSON.parse(line); r.errors.push({ code: 'V-SCHEMA', path: j.path, msg: j.msg }); } catch (e) { r.errors.push({ code: 'V-SCHEMA', path: '$', msg: line.slice(0, 200) }); } }
    } else if (p.status !== 0) r.errors.unshift({ code: 'V-SCHEMA', path: '$', msg: 'the schema check exited ' + p.status + ' (neither valid nor invalid): treated as a failure to run' });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  r.ok = r.errors.length === 0; r.stats.errors = r.errors.length;
  return r;
}

function cli() {
  const args = process.argv.slice(2); const file = args.find(a => !a.startsWith('--')) || lib.PATHS.source;
  const r = args.includes('--semantic-only') ? validate(lib.readJson(file)) : validateFull(lib.readJson(file));
  // process.exit() right after a large write to a pipe drops whatever the pipe had not taken yet (64 KiB): the exit code is set and the process ends when stdout has drained (T177)
  if (args.includes('--json')) { process.exitCode = r.ok ? 0 : 1; process.stdout.write(JSON.stringify(r, null, 2) + '\n'); return; }
  const byCode = {}; for (const e of r.errors) byCode[e.code] = (byCode[e.code] || 0) + 1;
  if (r.ok) console.log(`source valid: ${r.stats.entities} entities, ${r.stats.questions} questions, ${r.stats.options} options, ${r.stats.services} services, ${r.stats.compositions} compositions, ${r.stats.classes} uncertainty classes; ${r.stats.idsAssigned} ids, ${r.stats.refsChecked} references checked; ${r.residuals.length} declared residual(s)`);
  else { console.log(`source INVALID: ${r.errors.length} finding(s)`); for (const [c, n] of Object.entries(byCode)) console.log(`  ${c}: ${n}`); r.errors.slice(0, 40).forEach(e => console.log(`  [${e.code}] ${e.path}: ${e.msg}`)); }
  if (args.includes('--residuals')) { const g = {}; for (const x of r.residuals) g[x.kind] = (g[x.kind] || 0) + 1; console.log('residuals:', JSON.stringify(g)); }
  process.exitCode = r.ok ? 0 : 1;
}
if (require.main === module) cli();
module.exports = { validate, validateFull, AFFECTS, complexitySignals };
