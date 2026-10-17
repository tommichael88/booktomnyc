#!/usr/bin/env node
'use strict';
/**
 * project_legacy.js -- rebuild the legacy authored sections of btnyc.json from ssot/btnyc_source.json ALONE (T175).
 *
 *   node test_harness/tools/entity_first/project_legacy.js [--check] [--out <file>]
 *
 * This is the content-preservation proof of the migration (design note 12.1): it reads only the source, so a field the migration dropped, or an id it mislabelled, cannot come back. `--check`
 * compares the projection to btnyc.json (minus the compiler-owned keys) and fails on any difference that is not a declared normalisation (DECLARED below, each with its reason).
 * `routing_archetypes` is projected as the compiler's SEED (the curated part); parity_compiler.py-style proof that the compiler then reproduces the whole of it is in verify_entity_first_roundtrip.js.
 * During the dual-source period (ssot/TRANSITION_DUALSOURCE.md) this is also the way `btnyc.json`'s authored sections are regenerated from the source.
 */
const fs = require('fs'), path = require('path');
const lib = require('./lib.js');
const refs = require('./refs.js');
const vocab = require('./vocabulary.js');
const { clone, stripId } = lib;

function project(src) {
  const ctx = { actionByLegacy: new Map(), actionLabel: new Map() };
  src.registries.actions.forEach(a => { ctx.actionLabel.set(a.id, a.label); ctx.actionByLegacy.set(a.label, a.id); });
  const S = refs.makeSpellings(ctx);
  const R = src.registries;
  const out = {};
  out.$schema = src.legacy_envelope.$schema; out.$id = src.legacy_envelope.$id;
  out.meta = clone(src.meta);
  out.workflow = clone(src.policy.workflow); out.invariants = clone(src.policy.invariants);

  // ---- questions: every question in the source, by id ----
  const questions = new Map(); const owner = new Map();
  for (const e of src.entities) for (const q of e.questions) { questions.set(q.id, q); owner.set(q.id, e); }
  for (const q of src.shared_questions) questions.set(q.id, q);
  const classes = new Map(); for (const e of src.entities) e.uncertainty_classes.forEach(c => classes.set(c.id, c)); src.shared_uncertainty_classes.forEach(c => classes.set(c.id, c));
  const baseOf = q => (q.instance_of ? questions.get(q.instance_of) : q);
  const optsOf = q => q.options || baseOf(q).options;
  const labelOf = (qid, optId) => { const q = questions.get(qid); if (!q) throw new Error('no question ' + qid); const o = optsOf(q).find(x => x.id === optId); if (!o) throw new Error(`no option ${optId} in ${qid}`); return o.label; };
  const pairsToLegacy = pairs => Object.fromEntries(pairs.map(p => [stripId('q', p.question_id), labelOf(p.question_id, p.option_id)]));

  const optToLegacy = o => {
    const l = { label: o.label };
    if (o.tag_ids !== undefined) l.tags = o.tag_ids.map(S.tag_hash.i);
    if (o.complexity_override !== undefined) l.complexity_override = o.complexity_override;
    if (o.modifier_id !== undefined) l.modifier_ref = stripId('mod', o.modifier_id);
    if (o.checkout_state_id !== undefined) l.checkout_state_override = stripId('chk', o.checkout_state_id);
    if (o.qty_value !== undefined) l.qty_value = o.qty_value;
    if (o.route_to) l.route_to = { service: stripId('svc', o.route_to.service_id), answers: pairsToLegacy(o.route_to.answers), because: o.route_to.because };
    if (o.mat_min !== undefined) l.mat_min = o.mat_min; if (o.mat_max !== undefined) l.mat_max = o.mat_max;
    if (o.formula_id !== undefined) l.formula_override = stripId('fml', o.formula_id);
    if (o.location_hints !== undefined) l.location_hints = o.location_hints;
    if (o.tile !== undefined) l.tile = o.tile;
    if (o._note !== undefined) l._note = o._note;
    return l;
  };
  const QFIELDS = new Set(['id', 'prompt', 'type', 'purpose', 'entity_scope', 'depends_on', 'options', 'runtime_compat', 'instance_of', 'item_noun', 'prompt_override']);
  out.intake_modules = {};
  for (const [qid, q] of questions) {
    if (q.instance_of) continue;
    const m = { question: q.prompt, type: q.type, purpose: q.purpose };
    if (q.options) m.client_response = q.options.map(optToLegacy);
    const cls = classes.get('u.' + qid.slice(2)); if (cls && cls.default_weight !== undefined) m.confidence_gain = cls.default_weight;
    if (q.runtime_compat && q.runtime_compat.affects_price !== undefined) m.affects_price = q.runtime_compat.affects_price;
    if (q.depends_on.length) m.depends_on = pairsToLegacy(q.depends_on);
    for (const k of Object.keys(q)) if (!QFIELDS.has(k)) m[k] = clone(q[k]);
    out.intake_modules[stripId('q', qid)] = m;
  }

  // ---- chains: the constructive inverse of the dependency view (design note 7.5) ----
  function authoredChain(steps, ownerLabel) {
    const items = steps.map(st => {
      const q = questions.get(st.question_id); const inst = !!q.instance_of;
      const parents = []; for (const t of st.depends_on) (t.any_of || [t]).forEach(p => parents.push(p));
      return { st, q, module: stripId('q', inst ? q.instance_of : q.id), key: inst ? `${stripId('q', q.instance_of)}::${q.item_noun}` : stripId('q', q.id), parents };
    });
    const thenOf = P => {
      const t = {}; for (const o of optsOf(P.q)) { const deps = items.filter(d => d.parents.some(p => p.question_id === P.q.id && p.option_id === o.id)).map(d => d.module); if (deps.length) t[o.label] = deps; }
      return t;
    };
    const hasDependents = P => items.some(d => d.parents.some(p => p.question_id === P.q.id));
    const entryOf = (i, withThen) => {
      const e = { module: i.module };
      if (withThen && hasDependents(i)) e.then = thenOf(i); else e.then = {};
      if (i.q.instance_of) { const p = { item_noun: i.q.item_noun }; if (i.q.options) p.client_response = i.q.options.map(optToLegacy); if (i.q.prompt_override !== undefined) p.question_override = i.q.prompt_override; e.params = p; }
      for (const k of ['_note', '_quantity_justification']) if (i.st[k] !== undefined) e[k] = i.st[k];
      return e;
    };
    // Construct the entries. Roots are entries; a step that depends on something is injected by its parent's `then`, so the parent's entry is emitted at the point its first dependent appears
    // (the runtime injects a branch target where the parent's ENTRY is processed, which fixes the resolved order). Then every step the legacy chain LISTED (not marked
    // runtime_compat.legacy_chain_entry = branch_target_only) but that has no entry yet gets a trailing no-op entry, because the compiler's module_index is built from listed entries.
    const E = []; const attached = new Set(); const entryKeys = new Set();
    const have = () => new Set(lib.resolveChain(E).map(r => r.key));
    const emit = i => { E.push(entryOf(i, true)); entryKeys.add(i.key); };
    for (const i of items) {
      if (have().has(i.key)) continue;
      if (i.parents.length === 0) { emit(i); attached.add(i.key); continue; }
      const P = i.parents.map(p => items.find(d => d.q.id === p.question_id)).find(P => P && have().has(P.key) && !attached.has(P.key));
      if (!P) throw new Error(`${ownerLabel}: cannot place dependent ${i.key} (no parent entry can still inject it)`);
      emit(P); attached.add(P.key);
      if (!have().has(i.key)) throw new Error(`${ownerLabel}: ${i.key} not injected by its parent ${P.key}`);
    }
    for (const i of items) if (!entryKeys.has(i.key) && !(i.st.runtime_compat && i.st.runtime_compat.legacy_chain_entry === 'branch_target_only')) emit(i);
    const want = items.map(i => i.key).join(','), got = lib.resolveChain(E).map(r => r.key).join(',');
    if (want !== got) throw new Error(`${ownerLabel}: projected chain resolves to [${got}] not [${want}]`);
    return E;
  }

  // ---- confidence ----
  const r6 = x => Math.round(x * 100 * 1e6) / 1e6;
  const strategyOf = (policy, compat) => {
    const cs = clone(compat.confidence_strategy || {});
    if (cs._inherits_from_archetype !== undefined) cs._inherits_from_archetype = stripId('cls', cs._inherits_from_archetype);
    if (policy.policy_sources.exact_at === 'service_override') cs.minimum_quote_confidence = r6(policy.exact_at);
    if (policy.policy_sources.diagnostic_below === 'service_override') cs.diagnostic_threshold = r6(policy.diagnostic_below);
    return cs;
  };

  // ---- services ----
  const svcById = new Map(); for (const e of src.entities) for (const s of e.services) svcById.set(s.id, s);
  out.services = R.service_order.map(sid => {
    const s = svcById.get(sid); if (!s) throw new Error('service_order names a missing service ' + sid);
    const l = { id: stripId('svc', s.id) };
    l.operational_metrics = clone(s.pricing.operational_metrics);
    l.pricing_engine = s.pricing.engine !== undefined ? s.pricing.engine : stripId('fml', s.pricing.formula_id);
    l.default_estimates = clone(s.pricing.default_estimates);
    const ui = clone(s.presentation.ui_taxonomy); ui.category_id = stripId('cat', ui.category_id); ui.group_id = stripId('grp', ui.group_id); l.ui_taxonomy = ui;
    const fe = clone(s.pricing.financial_engine);
    if (fe.formula_ref !== undefined) fe.formula_ref = stripId('fml', fe.formula_ref); if (fe.pricing_archetype !== undefined) fe.pricing_archetype = stripId('par', fe.pricing_archetype);
    if (fe.checkout_state !== undefined) fe.checkout_state = stripId('chk', fe.checkout_state);
    if (fe._inherits_checkout_state_from_archetype !== undefined) fe._inherits_checkout_state_from_archetype = stripId('cls', fe._inherits_checkout_state_from_archetype);
    l.financial_engine = fe;
    if (s.presentation.aliases !== undefined) l.aliases = clone(s.presentation.aliases);
    l.service_type = S.act.i(s.action_id);
    l.intake_chain = authoredChain(s.intake.steps, s.id);
    if (s.tags && s.tags.default_tag_ids !== undefined) l.default_tags = s.tags.default_tag_ids.map(S.tag_ref.i);
    l.confidence_strategy = strategyOf(s.confidence_policy, s.runtime_compat);
    l.verb_natural = s.presentation.verb_natural;
    if (s.pricing.required_material_ids !== undefined) l.required_materials = s.pricing.required_material_ids.map(x => stripId('mat', x));
    if (s.pricing.optional_material_ids !== undefined) l.optional_materials = s.pricing.optional_material_ids.map(x => stripId('mat', x));
    if (s.pricing.per_unit_answers_vary !== undefined) l.per_unit_answers_vary = s.pricing.per_unit_answers_vary;
    if (s.intake.module_refs !== undefined) l.intake_modules_refs = Array.isArray(s.intake.module_refs) ? s.intake.module_refs.map(x => stripId('q', x)) : s.intake.module_refs;
    if (s.pricing.override_root !== undefined) l.override_root = s.pricing.override_root;
    if (s.presentation.detail_prompt !== undefined) l.detail_prompt = s.presentation.detail_prompt; if (s.presentation.details !== undefined) l.details = clone(s.presentation.details);
    if (s.pricing.materials_included !== undefined) l.materials_included = s.pricing.materials_included;
    if (s.pricing.requires_furniture_selection !== undefined) l.requires_furniture_selection = s.pricing.requires_furniture_selection;
    if (s.tags && s.tags.suggested_tag_ids !== undefined) l.suggested_tags = s.tags.suggested_tag_ids.map(S.tag_ref.i);
    if (s.related_service_ids !== undefined) l.related_services = s.related_service_ids.map(x => stripId('svc', x));
    if (s.intake.behavior !== undefined) l.behavior = clone(s.intake.behavior);
    if (s.recovery_affordances.deep_dive_declared !== false) l.remote_deep_dive_modules = s.recovery_affordances.deep_dive_question_ids.map(x => stripId('q', x));
    if (s.notes) Object.assign(l, clone(s.notes));
    return l;
  });

  // ---- dynamic services ----
  out.dynamic_services = {};
  for (const e of src.entities) for (const c of e.default_compositions) {
    const key = [stripId('cat', c.category_id)].concat(c.group_id ? [stripId('grp', c.group_id)] : [], [S.act.i(c.action_id)]).join('+');
    const l = {};
    const fe = clone(c.pricing.financial_engine); if (fe.checkout_state !== undefined) fe.checkout_state = stripId('chk', fe.checkout_state); if (fe.formula_ref !== undefined) fe.formula_ref = stripId('fml', fe.formula_ref); if (fe.pricing_archetype !== undefined) fe.pricing_archetype = stripId('par', fe.pricing_archetype);
    l.financial_engine = fe; l.operational_metrics = clone(c.pricing.operational_metrics); l.default_estimate = clone(c.pricing.default_estimate);
    l.intake_chain = authoredChain(c.intake.steps, c.id);
    if (c.suggested_tag_ids !== undefined) l.suggested_tags = c.suggested_tag_ids.map(S.tag_ref.i);
    if (c.smart_tag_ids !== undefined) l.smart_tags = c.smart_tag_ids.map(S.tag_ref.i);
    l.confidence_strategy = strategyOf(c.confidence_policy, c.runtime_compat);
    l.merge_strategy = c.runtime_compat.merge_strategy;
    if (c.recovery_affordances.deep_dive_declared !== false) l.remote_deep_dive_modules = c.recovery_affordances.deep_dive_question_ids.map(x => stripId('q', x));
    if (c.notes) Object.assign(l, clone(c.notes));
    out.dynamic_services[key] = l;
  }

  // ---- registries ----
  out.service_types = {}; { const acts = clone(R.actions); refs.inverse(acts, refs.RULES.actions, ctx); for (const a of acts) { const { id, label, ...rest } = a; out.service_types[label] = rest; } }
  out.category = clone(R.categories); refs.inverse(out.category, refs.RULES.categories, ctx);
  out.group = R.groups.map(g => { const { picker, ...rest } = clone(g); return rest; }); refs.inverse(out.group, refs.RULES.groups_base, ctx);
  out.smart_tags = {};
  { const tags = clone(R.tags); tags.forEach(t => { if (Array.isArray(t.answers)) t.answers = pairsToLegacy(t.answers); }); refs.inverse(tags, refs.RULES.tags_base, ctx); for (const t of tags) { const { id, ...rest } = t; out.smart_tags[S.tag_hash.i(id)] = rest; } }
  out.materials_catalog = {}; for (const m of R.materials) { const { id, ...rest } = clone(m); out.materials_catalog[rest.sku] = rest; }
  out.furniture_catalog = R.furniture.map(f => { const { id, ...rest } = clone(f); return rest; });
  out.checkout_states = {}; for (const c of R.checkout_states) { const { id, ...rest } = clone(c); out.checkout_states[stripId('chk', id)] = rest; }
  out.pricing_formulas = {};
  { const fs_ = clone(R.pricing_formulas); for (const f of fs_) { delete f.inputs; delete f.qty_aware; } // source-only (T177): which answers a formula reads, and that it scales quantity; the runtime reads them from code today
    refs.inverse(fs_, refs.RULES.formulas, ctx);
    for (const f of fs_) {
      const { id, ...rest } = f;
      if (Array.isArray(rest.issue_type_fees)) rest.issue_type_fees = Object.fromEntries(rest.issue_type_fees.map(r => { const { question_id, option_id, modifier_id, ...more } = r; return [labelOf(question_id, option_id), Object.assign(modifier_id !== undefined ? { modifier_ref: stripId('mod', modifier_id) } : {}, more)]; }));
      if (Array.isArray(rest.anchor_and_overflow_ref_by_service)) rest.anchor_and_overflow_ref_by_service = Object.fromEntries(rest.anchor_and_overflow_ref_by_service.map(r => { const { service_id, ...more } = r; const o = {}; for (const [k, v] of Object.entries(more)) o[k === 'overflow_modifier_id' ? 'overflow_rate_ref' : k] = k === 'overflow_modifier_id' ? stripId('mod', v) : v; return [stripId('svc', service_id), o]; }));
      out.pricing_formulas[stripId('fml', id)] = rest;
    } }
  out.archetypes = {};
  { const cl = clone(R.behavioral_classes); refs.inverse(cl, refs.RULES.classes, ctx);
    for (const c of cl) { const { id, default_confidence_policy, runtime_compat, ...rest } = c; rest.default_confidence_strategy = { minimum_quote_confidence: r6(default_confidence_policy.exact_at), maximum_followup_questions: runtime_compat.default_maximum_followup_questions }; out.archetypes[stripId('cls', id)] = rest; } }

  // ---- policy and vocabulary ----
  const gr = clone(src.policy.global_rules); refs.inverse(gr, refs.RULES.global_rules, ctx);
  gr.modifiers = {}; for (const m of R.modifiers) { if (m.role === 'condition') continue; /* a domain condition (T177) is not a fee row; btnyc.json has no such thing */ const { id, affects, ...rest } = clone(m); gr.modifiers[stripId('mod', id)] = rest; }
  out.global_rules = gr;
  out.ui_config = clone(src.policy.ui_config); refs.inverse(out.ui_config, refs.RULES.ui_config, ctx);
  out.adlib_phrase_overrides = clone(src.vocabulary.adlib_phrase_overrides); out.negation_library = Object.assign(clone(src.vocabulary.negation_library), { action_conjugations: vocab.joinActionVocabulary(src.vocabulary.action_vocabulary, R.actions) });
  { const objs = clone(src.vocabulary.nlp_objects); for (const o of objs) delete o.resolves_to; /* source-only (T177): which entity the object feeds */ refs.inverse(objs, refs.RULES.nlp_objects, ctx); const fb = clone(src.vocabulary.nlp_default_fallback); refs.inverse(fb, refs.RULES.nlp_default_fallback, ctx); out.intent_mappings = { default_fallback: fb, objects: objs }; }

  // ---- routing_archetypes: the compiler's seed (curated part) ----
  out.routing_archetypes = {};
  for (const g of R.groups) {
    const gid = stripId('grp', g.id); const p = g.picker;
    const seed = { display_name: g.display_name, category_id: stripId('cat', g.category_id), routing_archetype: p.entry_mode, real_action_ids: p.action_ids.map(S.act.i).sort(),
      real_component_ids: p.component_entity_ids.map(e => 'comp.' + stripId('ent', e)).sort(), component_id_to_service_ids: {}, real_symptom_ids: [], symptom_id_to_service_ids: {}, real_gaps: clone(p.real_gaps) };
    for (const l of p.component_links) seed.component_id_to_service_ids['comp.' + stripId('ent', l.entity_id)] = l.service_ids.map(x => stripId('svc', x)).sort();
    if (p.symptoms) { seed.real_symptom_ids = p.symptoms.map(x => x.id).sort(); for (const x of p.symptoms) seed.symptom_id_to_service_ids[x.id] = x.service_ids.map(y => stripId('svc', y)).sort(); }
    if (p.symptom_question_id) seed.symptom_module = stripId('q', p.symptom_question_id);
    if (p.ask_action_first !== undefined) seed.ask_action_first = p.ask_action_first;
    if (p.symptom_prompt !== undefined) seed.symptom_prompt = p.symptom_prompt;
    if (p.symptom_tiles !== undefined) seed.symptom_tiles = p.symptom_tiles.map(t => { const { tag_ids, ...rest } = t; return Object.assign(rest, tag_ids ? { tags: tag_ids.map(S.tag_hash.i) } : {}); });
    if (p.known_need_prompt !== undefined) seed.known_need_prompt = p.known_need_prompt;
    if (p.known_need_tiles !== undefined) seed.known_need_tiles = p.known_need_tiles.map(t => Object.assign({}, t, { service_id: stripId('svc', t.service_id) }));
    out.routing_archetypes[gid] = seed;
  }
  // btnyc.json's top-level member order is kept (the compiler lists unchanged keys in input order); the order is recorded in the envelope
  const ordered = {}; for (const k of src.legacy_envelope.top_level_order) { if (!(k in out)) throw new Error('top_level_order names a section the projection did not build: ' + k); ordered[k] = out[k]; }
  for (const k of Object.keys(out)) if (!(k in ordered)) throw new Error('the projection built a section top_level_order does not list: ' + k);
  return ordered;
}

// A chain is compared by what the runtime does with it (lib.chainSignature: resolved order, params, and each module's branch map as label -> sorted target set) plus the annotations each module
// carries. Entry layout, a `then` that names an already-placed module, and the order of targets inside one branch are authored spelling, not behavior (design note 7.5; declared below).
function chainView(chain, stats, owner) {
  const notes = {};
  chain = chain.map(e => { if (!e.then) return e; const t = {}; for (const [l, ts] of Object.entries(e.then)) { if (ts && ts.length) t[l] = ts; else if (stats) stats.empty_branch_lists.push(`${owner} :: ${e.module} :: ${l}`); } return Object.assign({}, e, { then: t }); });
  for (const e of chain) {
    const key = e.params && e.params.item_noun ? `${e.module}::${e.params.item_noun}` : e.module;
    for (const k of ['_note', '_quantity_justification']) if (e[k] !== undefined) { notes[key] = notes[key] || {}; if (notes[key][k] === undefined) notes[key][k] = e[k]; }
  }
  return { resolved: lib.chainSignature(chain), listed: chain.map(e => (e.params && e.params.item_noun ? `${e.module}::${e.params.item_noun}` : e.module)).sort(), annotations: notes };
}
function viewChains(db, stats) {
  const o = clone(db);
  for (const s of o.services) s.intake_chain = chainView(s.intake_chain, stats, s.id);
  for (const [k, d] of Object.entries(o.dynamic_services)) d.intake_chain = chainView(d.intake_chain, stats, k);
  return o;
}

function check(src, legacy) {
  const stats = { empty_branch_lists: [], compiler_derived_symptom_groups: [], action_double_spelling: [] };
  const projFull = project(src); const proj = viewChains(projFull, null); const want = viewChains(lib.authoredLegacy(legacy), stats); want.routing_archetypes = clone(legacy.routing_archetypes);
  // a symptom-first group that declares its symptom question has its symptom ids and symptom->service links COMPILED from that question's options (btnyc_v10_compiler.py, T174 / PENDING_DECISIONS #199);
  // they are not authored, so the seed carries none. verify_entity_first_roundtrip.js runs the compiler and proves it reproduces them.
  for (const [gid, ra] of Object.entries(want.routing_archetypes)) {
    if (ra.symptom_module && ra.routing_archetype === 'symptom_first') { ra.real_symptom_ids = []; ra.symptom_id_to_service_ids = {}; stats.compiler_derived_symptom_groups.push(gid); }
    if ((ra.real_action_ids || []).some(a => /^act\./.test(a))) { stats.action_double_spelling.push(gid); ra.real_action_ids = ra.real_action_ids.filter(a => !/^act\./.test(a)); }
  }
  const diffs = lib.diffAll(want, proj, '$', [], 400);
  const undeclared = diffs;
  const problems = require('./declared_normalizations.js').verify(stats, ['empty_branch_lists', 'compiler_derived_symptom_groups', 'action_double_spelling']);
  return { diffs, undeclared, problems, stats, projection: projFull };
}

function main() {
  const args = process.argv.slice(2);
  const src = lib.readJson(lib.PATHS.source); const legacy = lib.readJson(lib.PATHS.legacy);
  const out = args.indexOf('--out');
  if (args.includes('--check') || out < 0) {
    const r = check(src, legacy);
    if (r.problems.length) { console.log('declared normalizations do not match what was observed:'); r.problems.forEach(p => console.log('  ' + p)); return 1; }
    if (!r.undeclared.length) { console.log(`projection parity: the source reproduces every authored section of btnyc.json (declared normalizations: ${r.stats.empty_branch_lists.length} empty branch list, ${r.stats.compiler_derived_symptom_groups.length} compiler-derived symptom group(s), ${r.stats.action_double_spelling.length} action double spelling; pinned in declared_normalizations.js)`); return 0; }
    console.log(`projection parity FAILED: ${r.undeclared.length} undeclared difference(s) (first ${Math.min(r.undeclared.length, 15)}):`);
    r.undeclared.slice(0, 15).forEach(d => console.log('  ', d.path, '\n      legacy:', String(JSON.stringify(d.a)).slice(0, 220), '\n      source:', String(JSON.stringify(d.b)).slice(0, 220)));
    return 1;
  }
  // T181: the file that is written is the projection WITH the Charter carry (the runtime schema requires it); --check above compares the projection alone, with the carry taken off the file
  fs.writeFileSync(args[out + 1], require('./carry_charter.js').carry(lib.toText(project(src)), src, fs.readFileSync(lib.PATHS.source, 'utf8')).text); console.log('wrote', args[out + 1]); return 0;
}
if (require.main === module) process.exit(main());
module.exports = { project, check, chainView, viewChains };
