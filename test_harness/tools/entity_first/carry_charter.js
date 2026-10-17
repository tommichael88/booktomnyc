#!/usr/bin/env node
'use strict';
/**
 * carry_charter.js -- carry the Charter's explicit fields from ssot/btnyc_source.json into the live btnyc.json (T181).
 *
 *   node test_harness/tools/entity_first/carry_charter.js            # --check: exit 0 only if btnyc.json already carries exactly what the source says
 *   node test_harness/tools/entity_first/carry_charter.js --write    # make it so, changing only the spans that differ (hand layout, `50.0`, inline objects: every other byte is left alone)
 *   node test_harness/tools/entity_first/carry_charter.js --report   # what is carried, per kind, and how many records
 *
 * WHY. The Charter names btnyc.json the derived runtime artifact and lists what a record must carry: a stable id on every entity, question, option and service; `entity_scope` on a question;
 * `affects` on an option; `depends_on` as {question_id, option_id} pairs; `uncertainty_profile`, `confidence_policy` and `recovery_affordances` on a service; `entity_id` / `action_id` /
 * `modifier_ids` on a service; and the three-axis `complexity_profile` (R-COMPLEX-AXES). The authored source has all of them. The live file is still the legacy shape the page reads
 * (label-keyed intake_modules, a service-first `services` array, `compiled.*`), because the runtime has not moved to the artifact yet (ssot/TRANSITION_DUALSOURCE.md). This carries the
 * fields onto the legacy records IN PLACE, so that the file the site loads has every field the Charter requires without any record the page reads changing meaning:
 *
 *   - ADDITIVE on every record the page reads, except one: a module's `depends_on` changes from {moduleKey: label} to the Charter's [{question_id, option_id}] pairs (6 modules; the two
 *     runtime readers, the compiler and three tests read both spellings -- see _dependsOnAsLabels in qr.html and orch_depends_on_as_labels in the orchestrator module).
 *   - NEW top-level members: `$source` (the provenance reference and what is carried where), and the registries the carried ids point at: `entities` (with their uncertainty classes and
 *     retirement), `shared_uncertainty_classes`, `contexts`, `actions`, `modifiers`.
 *   - a typed id lives in `id` where the legacy record had none, and in `charter_id` where the legacy record already has a bare `id` the runtime reads (services, categories, groups).
 *
 * `strip(db)` is the exact inverse (it gives back the pre-carry legacy shape). lib.authoredLegacy applies it, so every tool that compares btnyc.json with the projection of the source
 * (project_legacy --check, the compiler roundtrip, the migration proofs) sees the same thing it saw before the carry. Nothing is read from the carry by the projection: the source is the
 * only input, the carry is an output, and `--check` fails on any difference (a stale value, a hand edit, a missing member, a member the source no longer produces).
 */
const fs = require('fs'), path = require('path');
const lib = require('./lib.js');
const refs = require('./refs.js');
const SP = require('./span_splice.js');
const { stripId, clone } = lib;

const CARRY_VERSION = '1.0.0';

// Every member this tool owns, per record kind. strip() removes exactly these; --check fails on one that the source no longer produces.
const CARRIED = {
  module: ['id', 'entity_scope', 'depends_on'],
  option: ['id', 'affects', 'evidence'],
  params: ['id', 'entity_scope', 'depends_on'],
  service: ['charter_id', 'entity_id', 'action_id', 'modifier_ids', 'complexity_profile', 'uncertainty_profile', 'confidence_policy', 'confidence_gate', 'recovery_affordances', 'decomposition'],
  dynamic: ['charter_id', 'entity_id', 'action_id', 'modifier_ids', 'uncertainty_profile', 'confidence_policy', 'confidence_gate', 'recovery_affordances'],
};
const TOP_KEYS = ['$source', 'entities', 'shared_uncertainty_classes', 'contexts', 'actions', 'modifiers'];
// registries whose records get a typed id: container, id prefix, field the id is written to when the legacy record has no `id` of its own
const REGISTRIES = [
  { section: 'category', prefix: 'cat', shape: 'array' }, { section: 'group', prefix: 'grp', shape: 'array' },
  { section: 'smart_tags', prefix: 'tag', shape: 'map' }, { section: 'materials_catalog', prefix: 'mat', shape: 'map' }, { section: 'furniture_catalog', prefix: 'fur', shape: 'array' },
  { section: 'checkout_states', prefix: 'chk', shape: 'map' }, { section: 'pricing_formulas', prefix: 'fml', shape: 'map' }, { section: 'archetypes', prefix: 'cls', shape: 'map' },
];

// Where each kind of id lives in the file: the Charter's "stable id" obligation made checkable (verify_charter_carry.js walks this table).
const ID_HOMES = {
  entity: 'entities[].id', question: 'intake_modules.<key>.id, and params.id on a service chain step that instantiates a template', uncertainty_class: 'entities[].uncertainty_classes[].id, shared_uncertainty_classes[].id',
  service: 'services[].charter_id (services[].id stays the bare id the page reads)', composition: 'dynamic_services.<key>.charter_id', action: 'actions[].id', modifier: 'modifiers[].id', context: 'contexts[].id',
  tag: 'smart_tags.<key>.id', material: 'materials_catalog.<sku>.id', furniture: 'furniture_catalog[].id', formula: 'pricing_formulas.<key>.id', checkout_state: 'checkout_states.<key>.id',
  category: 'category[].charter_id', group: 'group[].charter_id', behavioral_class: 'archetypes.<key>.id', option: '<module or params>.client_response[].id (unique within its question)',
};

// What reads each carried member. These are TARGETS (Layer Map) except where stated: today the boot gate checks their shape and the verify_* tests read them; no runtime module reads them yet.
const D = require('./derive_graph.js');
const MEMBER_CONSUMERS = {
  entities: D.INDEX_CONSUMERS.entities, shared_uncertainty_classes: D.INDEX_CONSUMERS.retirement_index, contexts: D.INDEX_CONSUMERS.questions, actions: D.INDEX_CONSUMERS.composition_index, modifiers: D.INDEX_CONSUMERS.composition_index,
  'intake_modules[].id|entity_scope|depends_on': D.INDEX_CONSUMERS.questions, 'client_response[].id|affects': D.INDEX_CONSUMERS.option_bridge,
  'services[].entity_id|action_id|modifier_ids': D.INDEX_CONSUMERS.composition_index, 'services[].uncertainty_profile|confidence_policy|confidence_gate': D.INDEX_CONSUMERS.confidence,
  'entities[].uncertainty_classes[].retired_by': D.INDEX_CONSUMERS.retirement_index, 'services[].recovery_affordances': D.INDEX_CONSUMERS.recovery,
  'services[].complexity_profile': [{ module: 'pricing_engine.js', reads: 'the three complexity axes of a service (R-COMPLEX-AXES); the structural test verify_complexity_axes.js reads them today' }],
};
const CONSUMER_STATUS = 'Today these members are read by the boot gate (orch_validate_ssot checks their shape against schema/btnyc_schema.json) and by the verify_*.js tests; the page reads the legacy sections it always read, and `depends_on` through _dependsOnAsLabels (pricing module) and orch_depends_on_as_labels (orchestrator module). Every module named here is a target by the Layer Map, not yet extracted from the runtime (the runtime slices are Prompt 3 of the Charter plan).';

const withLead = (o, k, v) => { o[k] = v; return o; };

function sourceIndex(src) {
  const ctx = { actionByLegacy: new Map(), actionLabel: new Map() };
  src.registries.actions.forEach(a => { ctx.actionLabel.set(a.id, a.label); ctx.actionByLegacy.set(a.label, a.id); });
  const S = refs.makeSpellings(ctx);
  const Q = new Map(); for (const e of src.entities) for (const q of e.questions) Q.set(q.id, q); for (const q of src.shared_questions) Q.set(q.id, q);
  const svc = new Map(); for (const e of src.entities) for (const s of e.services) svc.set(s.id, s);
  const comp = new Map();
  for (const e of src.entities) for (const c of e.default_compositions) comp.set([stripId('cat', c.category_id)].concat(c.group_id ? [stripId('grp', c.group_id)] : [], [S.act.i(c.action_id)]).join('+'), c);
  return { S, Q, svc, comp, R: src.registries };
}

// ---- the plan: [{ path, spec }] where spec is span_splice.setMembers's spec ------------------------------------------------------------------------------------------------------
function buildOps(src, srcText, legacy) {
  const X = sourceIndex(src), ops = [], R = src.registries;
  const op = (p, spec) => ops.push({ path: p, spec });
  const optionOps = (basePath, legacyOpts, q, owner) => {
    const so = q.options || [];
    if (legacyOpts.length !== so.length) throw new Error(`${owner}: the file has ${legacyOpts.length} options, the source ${so.length}`);
    so.forEach((o, i) => {
      if (legacyOpts[i].label !== o.label) throw new Error(`${owner} option ${i}: the file says ${JSON.stringify(legacyOpts[i].label)}, the source ${JSON.stringify(o.label)} (the carry aligns by position and refuses on any difference)`);
      const spec = { head: [['id', o.id]], after: { label: [['affects', clone(o.affects)]] }, tail: [] };
      if (o.evidence !== undefined) spec.tail.push(['evidence', o.evidence]);
      op(basePath.concat([i]), spec);
    });
  };
  const questionTail = q => [['entity_scope', clone(q.entity_scope)], ['depends_on', clone(q.depends_on)]];

  // modules
  for (const [key, m] of Object.entries(legacy.intake_modules)) {
    const q = X.Q.get('q.' + key); if (!q || q.instance_of) throw new Error(`intake_modules.${key} has no (non-instance) question q.${key} in the source`);
    op(['intake_modules', key], { head: [['id', q.id]], tail: questionTail(q) });
    if (m.client_response || q.options) optionOps(['intake_modules', key, 'client_response'], m.client_response || [], q, 'intake_modules.' + key);
  }
  // chain steps that instantiate a template: the question is the instance, whose id, scope and options are its own
  const chainOps = (basePath, chain, steps, owner) => {
    const byKey = new Map();
    for (const st of steps) { const q = X.Q.get(st.question_id); if (q && q.instance_of) byKey.set(`${stripId('q', q.instance_of)}::${q.item_noun}`, q); }
    chain.forEach((e, j) => {
      if (!e.params || e.params.item_noun === undefined) return;
      const q = byKey.get(`${e.module}::${e.params.item_noun}`); if (!q) throw new Error(`${owner}: chain step ${j} (${e.module}::${e.params.item_noun}) is no instance question in the source`);
      if (q.depends_on.length) throw new Error(`${owner}: instance question ${q.id} has a depends_on, which the legacy chain cannot hold (carry it explicitly)`);
      op(basePath.concat([j, 'params']), { head: [['id', q.id]], tail: questionTail(q) });
      if (e.params.client_response || q.options) optionOps(basePath.concat([j, 'params', 'client_response']), e.params.client_response || [], q, `${owner} step ${j}`);
    });
  };
  // services
  legacy.services.forEach((s, i) => {
    const v = X.svc.get('svc.' + s.id); if (!v) throw new Error('services[' + i + '] ' + s.id + ' is not in the source');
    const spec = { after: { id: [['charter_id', v.id], ['entity_id', v.entity_id], ['action_id', v.action_id], ['modifier_ids', clone(v.modifier_ids)]] },
      tail: [['complexity_profile', clone(v.complexity_profile)], ['uncertainty_profile', clone(v.uncertainty_profile)], ['confidence_policy', clone(v.confidence_policy)], ['confidence_gate', clone(v.confidence_gate)], ['recovery_affordances', clone(v.recovery_affordances)]] };
    if (v.decomposition !== undefined) spec.tail.push(['decomposition', clone(v.decomposition)]);
    op(['services', i], spec);
    chainOps(['services', i, 'intake_chain'], s.intake_chain, v.intake.steps, 'services[' + s.id + ']');
  });
  // dynamic services
  for (const [key, d] of Object.entries(legacy.dynamic_services)) {
    const c = X.comp.get(key); if (!c) throw new Error('dynamic_services.' + key + ' is not a default composition in the source');
    op(['dynamic_services', key], { head: [['charter_id', c.id], ['entity_id', c.entity_id], ['action_id', c.action_id], ['modifier_ids', clone(c.modifier_ids)]],
      tail: [['uncertainty_profile', clone(c.uncertainty_profile)], ['confidence_policy', clone(c.confidence_policy)], ['confidence_gate', clone(c.confidence_gate)], ['recovery_affordances', clone(c.recovery_affordances)]] });
    chainOps(['dynamic_services', key, 'intake_chain'], d.intake_chain, c.intake.steps, 'dynamic_services.' + key);
  }
  // registries: a typed id on each record
  // a record that already has a bare `id` the page reads keeps it; the typed id goes in `charter_id`. A record without one (or whose `id` is already the typed id this tool wrote) gets `id`.
  const idOp = (p, rec, typedId) => {
    const bare = rec && Object.prototype.hasOwnProperty.call(rec, 'id') && !String(rec.id).startsWith(typedId.split('.')[0] + '.');
    op(p, bare ? { after: { id: [['charter_id', typedId]] } } : { head: [['id', typedId]] });
  };
  const regOps = (section, prefix, shape, list, keyOf) => {
    const sec = legacy[section];
    if (shape === 'array') { if (!Array.isArray(sec) || sec.length !== list.length) throw new Error(`${section}: ${sec && sec.length} records in the file, ${list.length} in the source`); list.forEach((r, i) => idOp([section, i], sec[i], r.id)); }
    else { const keys = Object.keys(sec); if (keys.length !== list.length) throw new Error(`${section}: ${keys.length} records in the file, ${list.length} in the source`); list.forEach(r => { const k = keyOf(r); if (!(k in sec)) throw new Error(`${section}: the source's ${r.id} has no record ${JSON.stringify(k)} in the file`); idOp([section, k], sec[k], r.id); }); }
  };
  regOps('category', 'cat', 'array', R.categories); regOps('group', 'grp', 'array', R.groups);
  regOps('smart_tags', 'tag', 'map', R.tags, t => X.S.tag_hash.i(t.id)); regOps('materials_catalog', 'mat', 'map', R.materials, m => m.sku); regOps('furniture_catalog', 'fur', 'array', R.furniture);
  regOps('checkout_states', 'chk', 'map', R.checkout_states, c => stripId('chk', c.id)); regOps('pricing_formulas', 'fml', 'map', R.pricing_formulas, f => stripId('fml', f.id)); regOps('archetypes', 'cls', 'map', R.behavioral_classes, c => stripId('cls', c.id));

  // top level
  const entities = src.entities.map(e => {
    const o = { id: e.id, label: e.label, kind: e.kind, parent_id: e.parent_id, aliases: clone(e.aliases), question_ids: e.questions.map(q => q.id), service_ids: e.services.map(s => s.id), composition_ids: e.default_compositions.map(c => c.id), uncertainty_classes: clone(e.uncertainty_classes) };
    if (e.decision !== undefined) o.decision = e.decision;
    return o;
  });
  const modifiers = R.modifiers.map(m => { const o = { id: m.id, key: stripId('mod', m.id), affects: clone(m.affects) }; for (const k of ['role', 'label', 'description', 'basis']) if (m[k] !== undefined) o[k] = m[k]; return o; });
  const actions = R.actions.map(a => ({ id: a.id, label: a.label }));
  const carried = {}; for (const [k, v] of Object.entries(MEMBER_CONSUMERS)) carried[k] = { consumers: clone(v) };
  const $source = { path: 'ssot/btnyc_source.json', sha256: lib.sha(srcText), source_schema_version: src.source_schema_version, carry_version: CARRY_VERSION, form: 'legacy_shape_with_charter_carry',
    note: 'This file is still the legacy-shaped runtime file. The members listed under `carried` are generated from the source by test_harness/tools/entity_first/carry_charter.js and are refused by --check if edited by hand (ssot/TRANSITION_DUALSOURCE.md).',
    id_homes: clone(ID_HOMES), carried, consumer_status: CONSUMER_STATUS };
  op([], { after: { $id: [['$source', $source]], meta: [['entities', entities], ['shared_uncertainty_classes', clone(src.shared_uncertainty_classes)], ['contexts', clone(R.contexts)], ['actions', actions], ['modifiers', modifiers]] } });
  return ops;
}

// the same plan applied to a parsed object (key order is not compared; this is what the text edit must equal)
function applyToObject(db, ops) {
  const o = clone(db);
  for (const { path: p, spec } of ops) {
    let n = o; for (const seg of p) n = n[seg];
    const all = [].concat(spec.head || [], Object.values(spec.after || {}).flat(), spec.tail || []);
    for (const [k, v] of all) n[k] = clone(v);
    for (const k of spec.remove || []) delete n[k];
  }
  return o;
}

// ---- stale members: a carried key present where the source no longer produces it ---------------------------------------------------------------------------------------------
function staleOps(legacy, ops) {
  const produced = new Map(); for (const o of ops) produced.set(JSON.stringify(o.path), new Set([].concat(o.spec.head || [], Object.values(o.spec.after || {}).flat(), o.spec.tail || []).map(x => x[0])));
  const extra = [];
  const check = (p, rec, keys) => { if (!rec) return; const got = produced.get(JSON.stringify(p)) || new Set(); const stale = keys.filter(k => k in rec && !got.has(k)); if (stale.length) extra.push({ path: p, spec: { remove: stale } }); };
  for (const [k, m] of Object.entries(legacy.intake_modules)) { check(['intake_modules', k], m, CARRIED.module); (m.client_response || []).forEach((o, i) => check(['intake_modules', k, 'client_response', i], o, CARRIED.option)); }
  const chain = (bp, ch) => ch.forEach((e, j) => { if (!e.params) return; check(bp.concat([j, 'params']), e.params, CARRIED.params); (e.params.client_response || []).forEach((o, i) => check(bp.concat([j, 'params', 'client_response', i]), o, CARRIED.option)); });
  legacy.services.forEach((s, i) => { check(['services', i], s, CARRIED.service); chain(['services', i, 'intake_chain'], s.intake_chain); });
  for (const [k, d] of Object.entries(legacy.dynamic_services)) { check(['dynamic_services', k], d, CARRIED.dynamic); chain(['dynamic_services', k, 'intake_chain'], d.intake_chain); }
  return extra;
}

// ---- carry: text -> text -------------------------------------------------------------------------------------------------------------------------------------------------------
function carry(text, src, srcText) {
  const db = JSON.parse(text);
  const ops = buildOps(src, srcText, db);
  const stale = staleOps(db, ops);
  const root = SP.scan(text), splices = [];
  for (const o of ops.concat(stale)) SP.setMembers(root, text, o.path, o.spec, splices);
  const out = SP.applySplices(text, splices);
  const after = JSON.parse(out);
  const want = applyToObject(db, ops); for (const o of stale) { let n = want; for (const seg of o.path) n = n[seg]; for (const k of o.spec.remove) delete n[k]; }
  const d = lib.diff(want, after);
  if (d) throw new Error('the text edit does not equal the same plan applied to the parsed file at ' + d.path);
  const back = lib.diff(strip(db), strip(after));
  if (back) throw new Error('the carry changed something that is not a carried member, at ' + back.path);
  return { text: out, splices: splices.length, ops: ops.length, stale: stale.length };
}

// ---- strip: the exact inverse ---------------------------------------------------------------------------------------------------------------------------------------------------
// Sections strip() does not touch are SHARED with `db`, not copied (lib.authoredLegacy has always returned a shallow view and callers rely on it); the sections it rewrites are cloned first.
const TOUCHED = ['intake_modules', 'services', 'dynamic_services'].concat(REGISTRIES.map(r => r.section));
function strip(db) {
  const o = Object.assign({}, db);
  for (const k of TOUCHED) if (o[k] !== undefined) o[k] = clone(o[k]);
  for (const k of TOP_KEYS) delete o[k];
  const del = (r, keys) => { if (r && typeof r === 'object') for (const k of keys) delete r[k]; };
  const mods = o.intake_modules || {};
  // depends_on back to {moduleKey: label}, using the option ids that are still present
  for (const [key, m] of Object.entries(mods)) {
    if (Array.isArray(m.depends_on)) {
      if (!m.depends_on.length) delete m.depends_on;
      else m.depends_on = Object.fromEntries(m.depends_on.map(p => { const mk = stripId('q', p.question_id), t = mods[mk]; const opt = t && (t.client_response || []).find(x => x.id === p.option_id); if (!opt) throw new Error(`${key}: depends_on names ${p.question_id}#${p.option_id}, which the file does not have`); return [mk, opt.label]; }));
    }
  }
  const stripOpts = r => (r.client_response || []).forEach(x => del(x, CARRIED.option));
  for (const m of Object.values(mods)) { del(m, ['id', 'entity_scope']); stripOpts(m); }
  const chain = ch => (ch || []).forEach(e => { if (e.params) { del(e.params, CARRIED.params); stripOpts(e.params); } });
  for (const s of o.services || []) { del(s, CARRIED.service); chain(s.intake_chain); }
  for (const d of Object.values(o.dynamic_services || {})) { del(d, CARRIED.dynamic); chain(d.intake_chain); }
  for (const reg of REGISTRIES) {
    const sec = o[reg.section]; if (!sec) continue;
    for (const r of (Array.isArray(sec) ? sec : Object.values(sec))) {
      if (!r || typeof r !== 'object') continue;
      delete r.charter_id; if (typeof r.id === 'string' && r.id.startsWith(reg.prefix + '.')) delete r.id;
    }
  }
  return o;
}

function report(db) {
  const n = (a, f) => a.filter(f).length;
  const mods = Object.values(db.intake_modules), opts = mods.flatMap(m => m.client_response || []);
  return { top: TOP_KEYS.filter(k => k in db), modules: mods.length, modulesWithId: n(mods, m => m.id), modulesWithScope: n(mods, m => Array.isArray(m.entity_scope) || (m.entity_scope && typeof m.entity_scope === 'object')), modulesWithDependsOn: n(mods, m => Array.isArray(m.depends_on)),
    options: opts.length, optionsWithId: n(opts, o => o.id), optionsWithAffects: n(opts, o => Array.isArray(o.affects)),
    services: db.services.length, servicesWithEntity: n(db.services, s => s.entity_id), servicesWithProfile: n(db.services, s => Array.isArray(s.uncertainty_profile)), servicesWithPolicy: n(db.services, s => s.confidence_policy), servicesWithRecovery: n(db.services, s => s.recovery_affordances), servicesWithComplexity: n(db.services, s => s.complexity_profile),
    entities: (db.entities || []).length };
}

function main() {
  const args = process.argv.slice(2), write = args.includes('--write');
  const text = fs.readFileSync(lib.PATHS.legacy, 'utf8'), srcText = fs.readFileSync(lib.PATHS.source, 'utf8'), src = JSON.parse(srcText);
  if (args.includes('--report')) { console.log(JSON.stringify(report(JSON.parse(text)), null, 1)); return 0; }
  const r = carry(text, src, srcText);
  if (!r.splices) { console.log(`carry check passed: btnyc.json carries exactly what ssot/btnyc_source.json says (carry ${CARRY_VERSION}; ${r.ops} records/sections checked)`); return 0; }
  if (!write) { console.log(`carry check FAILED: ${r.splices} span(s) of btnyc.json differ from what the source carries (${r.ops} records/sections planned, ${r.stale} stale member(s)). Run: node test_harness/tools/entity_first/carry_charter.js --write`); return 1; }
  fs.writeFileSync(lib.PATHS.legacy, r.text);
  console.log(`carried: ${r.splices} span(s) changed; btnyc.json ${text.length} -> ${r.text.length} bytes`);
  return 0;
}
if (require.main === module) process.exit(main());
// The paths verify_ssot_consultation.js lists as "carried, not yet read by the page" (the prefix of every discovered path under each). Derived from the tables above, so it cannot drift from what the tool writes.
function consultationSubtrees() {
  const out = [...TOP_KEYS.filter(k => k !== '$source')];
  for (const k of CARRIED.module) out.push('intake_modules.*.' + k);
  for (const k of CARRIED.option) out.push('intake_modules.*.client_response[].' + k);
  for (const k of CARRIED.service) out.push('services[].' + k);
  for (const k of CARRIED.dynamic) out.push('dynamic_services.*.' + k);
  out.push('category[].charter_id', 'group[].charter_id');
  return out;
}

module.exports = { consultationSubtrees, CARRY_VERSION, CARRIED, TOP_KEYS, REGISTRIES, ID_HOMES, MEMBER_CONSUMERS, CONSUMER_STATUS, buildOps, applyToObject, carry, strip, report, sourceIndex };
