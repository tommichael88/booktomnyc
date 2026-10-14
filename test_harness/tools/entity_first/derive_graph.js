#!/usr/bin/env node
'use strict';
/**
 * derive_graph.js -- derive the runtime graph from the validated entity-first source (T175).
 *
 *   node test_harness/tools/entity_first/derive_graph.js            # write ssot/derived/btnyc_graph.json
 *   node test_harness/tools/entity_first/derive_graph.js --check    # fail if the committed graph is not what the source derives (stale or hand-edited)
 *
 * The graph is a DERIVED artifact (R-INVARIANT-DERIVATION): reproducible from the source alone, never edited, never authoritative, kept apart from the source in ssot/derived/. It is what a runtime
 * adapter (resolver, confidence engine, composer, recovery engine) would read: entity-keyed indexes, the option-id <-> label bridge, resolved dependency graphs, per-service uncertainty and
 * confidence tables, retirement and recovery tables, the composition index, the picker graph. It contains no authored fact the source does not.
 *
 * Validation and derivation are separate: derive() REFUSES a source that does not pass validate_source.validateFull(); it does not repair it and it does not guess.
 */
const fs = require('fs');
const lib = require('./lib.js');
const V = require('./validate_source.js');

class InvalidSourceError extends Error { constructor(result) { super(`derivation refused: the source has ${result.errors.length} validation finding(s); first: [${result.errors[0].code}] ${result.errors[0].path}: ${result.errors[0].msg}`); this.result = result; this.name = 'InvalidSourceError'; } }

const sortKeys = o => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]));

function derive(src, sourceText, opts = {}) {
  const check = opts.validated || V.validateFull(src);
  if (!check.ok) throw new InvalidSourceError(check);
  const R = src.registries;
  const entities = new Map(src.entities.map(e => [e.id, e]));
  const questions = new Map(); const qEntity = new Map();
  for (const e of src.entities) for (const q of e.questions) { questions.set(q.id, q); qEntity.set(q.id, e.id); }
  for (const q of src.shared_questions) { questions.set(q.id, q); qEntity.set(q.id, null); }
  const classes = new Map(); for (const e of src.entities) for (const c of e.uncertainty_classes) classes.set(c.id, c); for (const c of src.shared_uncertainty_classes) classes.set(c.id, c);
  const optionsOf = q => q.options || (q.instance_of ? questions.get(q.instance_of).options : undefined);
  const baseOf = q => (q.instance_of || q.id);

  // ---- entities -------------------------------------------------------------------------------------------------------------------------------------------------------------
  const entityIndex = {};
  for (const e of src.entities) {
    const chain = []; let p = e.parent_id; while (p) { chain.push(p); p = entities.get(p).parent_id; }
    entityIndex[e.id] = { label: e.label, kind: e.kind, ancestors: chain, owns: { questions: e.questions.map(q => q.id), uncertainty_classes: e.uncertainty_classes.map(c => c.id), services: e.services.map(s => s.id), default_compositions: e.default_compositions.map(c => c.id) } };
  }

  // ---- questions and the option bridge: the ONLY place an option id is paired with its label ----------------------------------------------------------------------------------------------------
  const questionIndex = {}; const optionBridge = {};
  for (const [qid, q] of questions) {
    const scope = Array.isArray(q.entity_scope) ? { kind: 'entities', entity_ids: q.entity_scope.slice() } : { kind: 'context', context_id: q.entity_scope.context };
    questionIndex[qid] = { owner: qEntity.get(qid), scope, base: baseOf(q), depends_on: q.depends_on, option_ids: (optionsOf(q) || []).map(o => o.id), numeric: !optionsOf(q) };
    for (const o of optionsOf(q) || []) { const k = `${qid}#${o.id}`; if (!optionBridge[k]) optionBridge[k] = { label: o.label, affects: o.affects, unknown: o.evidence === 'unknown' }; }
  }

  // ---- chains: resolved dependency graph per service / composition ----------------------------------------------------------------------------------------------------------------------------------------
  const owners = []; for (const e of src.entities) { for (const s of e.services) owners.push({ kind: 'service', n: s }); for (const c of e.default_compositions) owners.push({ kind: 'composition', n: c }); }
  const chains = {}, confidence = {}, recovery = {};
  const retiresBy = {}; // question id -> class ids it can retire (the retirement index)
  for (const c of classes.values()) for (const r of c.retired_by) { (retiresBy[r.question_id] = retiresBy[r.question_id] || []).push(c.id); }
  for (const k of Object.keys(retiresBy)) retiresBy[k] = [...new Set(retiresBy[k])].sort();
  for (const { kind, n } of owners) {
    const steps = n.intake.steps; const order = steps.map(s => s.question_id);
    const edges = []; const depth = new Map();
    steps.forEach(s => {
      const parents = new Set();
      for (const t of s.depends_on) for (const u of (t.any_of || [t])) { edges.push({ from: u.question_id, option_id: u.option_id, to: s.question_id, gate: t.any_of ? 'any_of' : 'all_of' }); parents.add(u.question_id); }
      depth.set(s.question_id, parents);
    });
    const dep = id => { const ps = depth.get(id); if (!ps || !ps.size) return 0; return 1 + Math.max(...[...ps].map(dep)); };
    chains[n.id] = { kind, entity_id: n.entity_id, ask_order: order, roots: steps.filter(s => s.depends_on.length === 0).map(s => s.question_id), edges, max_depth: Math.max(0, ...order.map(dep)) };

    // ---- confidence: Cx = sum(w of retired) / sum(w of active); the table a confidence engine needs, authored inputs only ----------------------------------------------------------------------------------------------------
    const prof = n.uncertainty_profile; const total = prof.reduce((a, p) => a + p.weight, 0);
    confidence[n.id] = {
      gate: n.confidence_gate.mode, thresholds: { exact_at: n.confidence_policy.exact_at, range_at: n.confidence_policy.range_at, diagnostic_below: n.confidence_policy.diagnostic_below },
      weight_total: total,
      classes: prof.map(p => { const c = classes.get(p.class_id); return { class_id: p.class_id, weight: p.weight, share: total ? p.weight / total : 0, retired_by: c.retired_by.map(r => (r.any_value ? { question_id: r.question_id, any_value: true } : { question_id: r.question_id, option_ids: r.option_ids.slice() })), asked_at_step: Math.max(...c.retired_by.map(r => order.indexOf(r.question_id))) }; }),
    };
    // ---- recovery: composed from what is still open, not from a replayed list ----------------------------------------------------------------------------------------------------
    recovery[n.id] = {
      source: n.recovery_affordances.source,
      open_uncertainty: prof.map(p => ({ class_id: p.class_id, question_ids: [...new Set(classes.get(p.class_id).retired_by.map(r => r.question_id))].filter(q => order.includes(q)) })),
      deep_dive_question_ids: n.recovery_affordances.deep_dive_question_ids.slice(), when_no_path: n.recovery_affordances.when_no_path,
    };
  }

  // ---- composition index: the (entity, action, modifiers) points. A point that two curated services occupy is curated_only: the composer must not compose from it. ----------------------------
  const points = {};
  for (const { kind, n } of owners) {
    const key = [n.entity_id, n.action_id, [...n.modifier_ids].sort().join('+')].join('|');
    const pt = (points[key] = points[key] || { entity_id: n.entity_id, action_id: n.action_id, modifier_ids: [...n.modifier_ids].sort(), services: [], default_compositions: [] });
    (kind === 'service' ? pt.services : pt.default_compositions).push(n.id);
  }
  for (const pt of Object.values(points)) { pt.curated_only = pt.services.length > 1; pt.resolution = pt.services.length === 1 ? 'curated_service' : pt.services.length > 1 ? 'ambiguous_open_decomposition' : 'default_composition'; }

  // ---- picker graph ------------------------------------------------------------------------------------------------------------------------------------------------------------------
  const picker = {};
  for (const g of R.groups) {
    const p = g.picker; const symptoms = {};
    if (p.symptom_question_id) { const q = questions.get(p.symptom_question_id); const asking = owners.filter(o => o.kind === 'service' && o.n.presentation.ui_taxonomy.group_id === g.id && o.n.intake.steps.some(s => s.question_id === q.id)).map(o => o.n.id).sort(); for (const o of optionsOf(q)) symptoms[o.id] = { label: o.label, service_ids: asking }; }
    else for (const s of p.symptoms || []) symptoms[s.id] = { label: null, service_ids: s.service_ids.slice().sort() };
    picker[g.id] = { entry_mode: p.entry_mode, category_id: g.category_id, component_entity_ids: p.component_entity_ids.slice(), component_services: Object.fromEntries(p.component_links.map(l => [l.entity_id, l.service_ids.slice().sort()])), symptoms, symptom_source: p.symptom_question_id ? { question_id: p.symptom_question_id } : { authored: true } };
  }

  // ---- reverse index of the things a validator or an editor asks "who uses this?" -------------------------------------------------------------------------------------------------------------------------
  const usedBy = { questions: {}, tags: {}, modifiers: {} };
  for (const { n } of owners) for (const s of n.intake.steps) (usedBy.questions[s.question_id] = usedBy.questions[s.question_id] || []).push(n.id);
  for (const q of questions.values()) for (const o of q.options || []) { if (o.modifier_id) (usedBy.modifiers[o.modifier_id] = usedBy.modifiers[o.modifier_id] || []).push(`${q.id}#${o.id}`); for (const t of o.tag_ids || []) (usedBy.tags[t] = usedBy.tags[t] || []).push(`${q.id}#${o.id}`); }

  const graph = {
    derivation: { version: lib.DERIVATION_VERSION, source: 'ssot/btnyc_source.json', source_schema_version: src.source_schema_version, source_sha256: sourceText === undefined ? null : lib.sha(sourceText), generated: 'by test_harness/tools/entity_first/derive_graph.js; never edit by hand' },
    counts: { entities: entities.size, questions: questions.size, options_authored: [...questions.values()].reduce((n, q) => n + (q.options ? q.options.length : 0), 0), option_bridge_entries: Object.keys(optionBridge).length, /* an instance question that carries no options of its own is bridged under its own id too */ services: owners.filter(o => o.kind === 'service').length, default_compositions: owners.filter(o => o.kind === 'composition').length, uncertainty_classes: classes.size, composition_points: Object.keys(points).length, curated_only_points: Object.values(points).filter(p => p.curated_only).length },
    entities: sortKeys(entityIndex), questions: sortKeys(questionIndex), option_bridge: sortKeys(optionBridge), chains: sortKeys(chains), confidence: sortKeys(confidence), retirement_index: sortKeys(retiresBy), recovery: sortKeys(recovery),
    composition_index: sortKeys(points), picker: sortKeys(picker), used_by: { questions: sortKeys(usedBy.questions), tags: sortKeys(usedBy.tags), modifiers: sortKeys(usedBy.modifiers) },
  };
  return graph;
}

function main() {
  const args = process.argv.slice(2);
  const text = fs.readFileSync(lib.PATHS.source, 'utf8'); const src = JSON.parse(text);
  let graph;
  try { graph = derive(src, text); } catch (e) { if (e.name === 'InvalidSourceError') { console.error(e.message); return 1; } throw e; }
  const out = lib.toText(graph);
  if (args.includes('--check')) {
    if (!fs.existsSync(lib.PATHS.graph)) { console.error('no derived graph at ' + lib.PATHS.graph); return 1; }
    if (fs.readFileSync(lib.PATHS.graph, 'utf8') !== out) { console.error('ssot/derived/btnyc_graph.json is not what the source derives (stale or edited by hand): run derive_graph.js'); return 1; }
    console.log('derived graph is current'); return 0;
  }
  const changed = lib.writeIfChanged(lib.PATHS.graph, out);
  console.log(`${changed ? 'wrote' : 'unchanged'} ${require('path').relative(lib.ROOT, lib.PATHS.graph)}: ${graph.counts.entities} entities, ${graph.counts.questions} questions, ${graph.counts.options_authored} authored options (${graph.counts.option_bridge_entries} bridge entries), ${graph.counts.services} services, ${graph.counts.default_compositions} default compositions, ${graph.counts.composition_points} composition points (${graph.counts.curated_only_points} curated-only)`);
  return 0;
}
if (require.main === module) process.exit(main());
module.exports = { derive, InvalidSourceError };
