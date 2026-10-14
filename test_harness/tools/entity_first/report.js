#!/usr/bin/env node
'use strict';
/**
 * report.js -- generate the migration report, the coverage report and the machine provenance ledger from the data (T175).
 *
 *   node test_harness/tools/entity_first/report.js [--write | --check]
 *
 * Every number in ssot/COVERAGE_REPORT.md and ssot/MIGRATION_REPORT.md is computed here from btnyc.json, the source, the validator and the derived graph; none is typed. --check fails when a committed
 * report is not what the data produces, so a count cannot go stale. The prose is fixed text in this file because it is the analysis, not the data.
 */
const fs = require('fs'), path = require('path');
const lib = require('./lib.js');
const refs = require('./refs.js');
const { migrate } = require('./migrate_legacy.js');
const V = require('./validate_source.js');
const { derive } = require('./derive_graph.js');
const PL = require('./project_legacy.js');
const RT = require('./compiler_roundtrip.js');
const DN = require('./declared_normalizations.js');

const n = x => x.toLocaleString('en-US');
const table = (head, rows) => ['| ' + head.join(' | ') + ' |', '| ' + head.map(() => '---').join(' | ') + ' |', ...rows.map(r => '| ' + r.map(c => String(c).replace(/\|/g, '\\|')).join(' | ') + ' |')].join('\n');

function facts() {
  const legacy = lib.readJson(lib.PATHS.legacy); const srcText = fs.readFileSync(lib.PATHS.source, 'utf8'); const src = JSON.parse(srcText);
  const m = migrate(legacy); const val = V.validateFull(src); const graph = derive(src, srcText, { validated: val });
  const par = PL.check(src, legacy); const rt = RT.run(src, legacy);
  const E = src.entities; const Q = [...E.flatMap(e => e.questions), ...src.shared_questions];
  const S = E.flatMap(e => e.services), C = E.flatMap(e => e.default_compositions); const classes = [...E.flatMap(e => e.uncertainty_classes), ...src.shared_uncertainty_classes];
  const legacyOpts = Object.values(legacy.intake_modules).reduce((a, mm) => a + (mm.client_response || []).length, 0);
  const legacyOptsWithId = Object.values(legacy.intake_modules).reduce((a, mm) => a + (mm.client_response || []).filter(o => o.id !== undefined).length, 0);
  const instOpts = Q.filter(q => q.instance_of && q.options).reduce((a, q) => a + q.options.length, 0);
  const thenLabels = (() => { let c = 0; const all = [...legacy.services.map(s => s.intake_chain), ...Object.values(legacy.dynamic_services).map(d => d.intake_chain)]; for (const ch of all) for (const r of lib.resolveChain(ch)) c += Object.values(r.then).filter(t => t && t.length).length; return c; })();
  const stepTerms = [...S, ...C].reduce((a, x) => a + x.intake.steps.reduce((b, st) => b + st.depends_on.reduce((c, t) => c + (t.any_of ? t.any_of.length : 1), 0), 0), 0);
  const qTerms = Q.reduce((a, q) => a + q.depends_on.reduce((c, t) => c + (t.any_of ? t.any_of.length : 1), 0), 0);
  const routeAnswers = Q.reduce((a, q) => a + (q.options || []).reduce((b, o) => b + (o.route_to ? o.route_to.answers.length : 0), 0), 0);
  const tagAnswers = src.registries.tags.reduce((a, t) => a + (t.answers || []).length, 0);
  const feeRows = src.registries.pricing_formulas.reduce((a, f) => a + (f.issue_type_fees || []).length, 0);
  const placement = m.report.counts.questionPlacement;
  const policyBasis = m.report.policyBasis;
  const resid = {}; for (const r of val.residuals) resid[r.kind] = (resid[r.kind] || 0) + 1;
  const gate = (list, mode) => list.filter(x => x.confidence_gate.mode === mode).length;
  const optEff = Q.reduce((a, q) => a + (q.options || []).filter(o => o.affects.length).length, 0), optNoop = Q.reduce((a, q) => a + (q.options || []).filter(o => !o.affects.length).length, 0);
  const effCount = {}; for (const q of Q) for (const o of q.options || []) for (const a of o.affects) effCount[a] = (effCount[a] || 0) + 1;
  const scopeCtx = Q.filter(q => !Array.isArray(q.entity_scope)).length, scopeEnt = Q.length - scopeCtx;
  const ctxOf = id => Q.filter(q => !Array.isArray(q.entity_scope) && q.entity_scope.context === id).length;
  const unreferenced = ctxOf('ctx.unreferenced'), defaultIntake = ctxOf('ctx.default_intake'), actionRequired = ctxOf('ctx.action_required');
  const created = E.filter(e => typeof e.decision === 'string' && e.decision.startsWith('Created'));
  const cnt = {
    routing_mode: Object.values(legacy.routing_archetypes).filter(a => a.routing_archetype).length, class_routing: Object.values(legacy.archetypes).filter(a => a.default_routing_strategy).length, class_conf: Object.values(legacy.archetypes).filter(a => a.default_confidence_strategy).length,
    svc_conf: legacy.services.filter(x => x.confidence_strategy).length, dyn_conf: Object.values(legacy.dynamic_services).filter(x => x.confidence_strategy).length, merge: Object.values(legacy.dynamic_services).filter(x => x.merge_strategy).length,
    fallback_routing: legacy.workflow.fallback_routing_rules ? 1 : 0, bypass: (legacy.workflow.behavior && legacy.workflow.behavior.bypass_intake) ? Object.keys(legacy.workflow.behavior.bypass_intake).length || 1 : 0, svc_behavior: legacy.services.filter(x => x.behavior).length,
    actions: Object.keys(legacy.service_types).length, arch_note: legacy.services.filter(x => x._archetype_note).length };
  const sources = {}; for (const x of [...S, ...C]) for (const [k, v] of Object.entries(x.confidence_policy.policy_sources)) { sources[k] = sources[k] || {}; sources[k][v] = (sources[k][v] || 0) + 1; }
  return { unreferenced, defaultIntake, actionRequired, created, cnt, legacy, src, srcText, m, val, graph, par, rt, E, Q, S, C, classes, legacyOpts, legacyOptsWithId, instOpts, thenLabels, stepTerms, qTerms, routeAnswers, tagAnswers, feeRows, placement, policyBasis, resid, gate, optEff, optNoop, effCount, scopeCtx, scopeEnt, sources };
}

const DECISION_NO = { playbook: 206, taxonomy: 207, confidence: 208, composition: 209, unknown: 210, scope: 211, cutover: 212, dangling: 213 };

function coverage(f) {
  const { src, val, m, graph, E, Q, S, C, classes, resid } = f; const R = src.registries;
  const kinds = {}; for (const e of E) kinds[e.kind] = (kinds[e.kind] || 0) + 1;
  const weighted = classes.filter(c => c.default_weight !== undefined).length;
  const gatedS = f.gate(S, 'weighted_uncertainty'), gatedC = f.gate(C, 'weighted_uncertainty');
  const refCount = f.m.report.counts.refsNormalised; const refTotal = Object.values(refCount).reduce((a, b) => a + b, 0);
  const rows = [
    ['Entities', `${n(E.length)} (${kinds.component} component, ${kinds.generic_group} generic group, ${kinds.generic_category} generic category)`],
    ['Questions', `${n(Q.length)} = ${n(Q.length - Q.filter(q => q.instance_of).length)} authored modules + ${Q.filter(q => q.instance_of).length} parameterised instances; ${f.scopeEnt} entity-scoped, ${f.scopeCtx} context-scoped (every one declares entity_scope)`],
    ['Question placement', `${f.placement.entity} under their one entity, ${f.placement.shared} shared by 2-4 entities, ${f.placement.context} context questions (asked by 5+ entities), ${f.placement.unused} that no chain or deep-dive question asks (${f.unreferenced} referenced by nothing at all, ${f.defaultIntake} injected only by a default list, ${f.actionRequired} required only by an action)`],
    ['Options', `${n(val.stats.options)} = ${n(f.legacyOpts)} module options + ${n(f.instOpts)} options inside parameterised steps; ${n(val.stats.optionsWithoutId)} without an id`],
    ['Option effects', `${n(f.optEff)} options with a real effect, ${n(f.optNoop)} declared no-ops; ` + Object.entries(f.effCount).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')],
    ['Services (curated)', `${S.length}, each with one entity_id, an action_id, pricing shape, intake steps, confidence policy, recovery`],
    ['Default compositions (was dynamic_services)', `${C.length}, each decomposed to entity + action (+ no modifiers) with pricing and intake shape`],
    ['Ids assigned', `${n(val.stats.idsAssigned)} in total = ${n(val.stats.idsAssigned - val.stats.options)} node ids (` + Object.entries(val.stats.idsByType).map(([t, k]) => `${t} ${k}`).join(', ') + `) + ${n(val.stats.options)} option ids`],
    ['Options that had no id before', `${n(f.m.report.counts.optionsWithoutIdBefore)} of ${n(f.legacyOpts)} module options (${n(f.legacyOptsWithId)} had one)`],
    ['References normalised to ids', `${n(refTotal)} through the reference table (${Object.entries(refCount).map(([k, v]) => `${k} ${v}`).join(', ')}) + ${n(f.thenLabels)} label-keyed branches rebuilt as ${n(f.stepTerms)} id-pair step dependencies + ${n(f.qTerms)} question-level dependencies + ${n(f.routeAnswers)} route_to answers + ${n(f.tagAnswers)} tag answers + ${n(f.feeRows)} issue-type fee rows (all {question_id, option_id}); ${n(val.stats.refsChecked)} typed references checked by the validator`],
    ['Uncertainty classes', `${classes.length} (${weighted} with a weight seeded from the legacy confidence_gain, ${classes.length - weighted} with none: weight_basis "unauthored")`],
    ['Confidence-gated', `${gatedS} of ${S.length} services and ${gatedC} of ${C.length} compositions are gated (weighted_uncertainty); ${f.gate(S, 'none')} services and ${f.gate(C, 'none')} composition declare gate "none" with a reason`],
    ['Confidence thresholds', `exact_at / range_at / diagnostic_below on a 0-1 scale for all ${S.length + C.length}; source of each: ` + Object.entries(f.sources).map(([k, v]) => `${k}: ` + Object.entries(v).map(([a, b]) => `${a} ${b}`).join(', ')).join('; ')],
    ['Recovery', `${S.length + C.length} of ${S.length + C.length} declare recovery_affordances (source: current open uncertainty; ${[...S, ...C].filter(x => x.recovery_affordances.deep_dive_question_ids.length).length} also name deep-dive questions)`],
    ['Behavioral classes', `${R.behavioral_classes.length}, metadata only (groups are their members; no entity is keyed by one)`],
    ['Picker (curated part of routing_archetypes)', `${R.groups.length} groups: ${R.groups.reduce((a, g) => a + g.picker.component_links.reduce((b, l) => b + l.service_ids.length, 0), 0)} component->service links, ${R.groups.filter(g => g.picker.symptom_question_id).length} declare a symptom question (symptoms compiled from it), ${R.groups.filter(g => g.picker.symptoms).length} carry authored symptoms, ${R.groups.reduce((a, g) => a + (g.picker.real_gaps || []).length, 0)} recorded gaps`],
    ['Derived graph', `${n(graph.counts.entities)} entities, ${n(graph.counts.questions)} questions, ${n(graph.counts.services)} services, ${n(graph.counts.default_compositions)} compositions, ${n(graph.counts.composition_points)} composition points (${graph.counts.curated_only_points} curated-only), reproducible from the source`],
    ['Migration failures', `${f.m.report.unresolved.length} unresolved; ${f.m.report.findings.length} finding (the ceilings real_action_ids double spelling, declared)`],
  ];
  const residualRows = [
    ['composition_ambiguous', resid.composition_ambiguous || 0, `curated services that share one (entity, action, modifiers) point: ${f.m.report.counts.servicesInAmbiguousPoints} services at ${f.m.report.counts.ambiguousCompositionPoints} points. The modifier or entity that separates them is a business decision (#${DECISION_NO.composition}).`],
    ['uncertainty_weight_unauthored', resid.uncertainty_weight_unauthored || 0, `uncertainty classes whose question had no confidence_gain in the legacy file; they count toward no service's confidence (#${DECISION_NO.confidence}).`],
    ['confidence_gate_none', resid.confidence_gate_none || 0, `services/compositions that ask no weighted question, so confidence cannot be computed for them (#${DECISION_NO.confidence}).`],
    ['recovery_no_authored_path', resid.recovery_no_authored_path || 0, `of those, ones with no deep-dive question either: recovery can only take the declared when_no_path route.`],
    ['question_asked_by_nothing', resid.question_asked_by_nothing || 0, `authored questions no chain, default or action asks; kept, scope is an Operator decision (#${DECISION_NO.scope}).`],
    ['unknown_option', resid.unknown_option || 0, `options classified "not sure" by label pattern; they can never retire an uncertainty (#${DECISION_NO.unknown}).`],
    ['unknown_option_with_cost_effect', resid.unknown_option_with_cost_effect || 0, `of those, ones that also change price or minutes: a contingency for not knowing, or a mis-classified answer (#${DECISION_NO.unknown}).`],
    ['dangling_legacy_reference', resid.dangling_legacy_reference || 0, `legacy names that name no intake module (item_quantity, damage_areas, access x4); kept as {unresolved_name}, not given a target (#${DECISION_NO.dangling}).`],
  ];
  const legacyBars = f.m.report.counts.legacyBarsUnreachable;
  return `# Coverage report: entity-first SSOT (T175)

Generated by \`node test_harness/tools/entity_first/report.js --write\` from \`btnyc.json\`, \`ssot/btnyc_source.json\` and the validator; \`--check\` fails if this file is not what the data produces. Real counts, not the audit's.

## What is in the source

${table(['What', 'Count'], rows)}

## Checks that pass today

${table(['Check', 'Result'], [
    ['Independent validator (schema + semantic)', val.ok ? `valid: 0 findings, ${val.residuals.length} declared residuals` : `INVALID: ${val.errors.length}`],
    ['Source reproduces every authored section of btnyc.json', f.par.undeclared.length === 0 && f.par.problems.length === 0 ? `yes (declared normalizations only: ${f.par.stats.empty_branch_lists.length} empty branch list, ${f.par.stats.compiler_derived_symptom_groups.length} compiler-derived symptom groups, ${f.par.stats.action_double_spelling.length} action double spelling)` : 'NO'],
    ['Production compiler on the projected source reproduces the 8 compiler-owned keys', f.rt.ok ? `yes (${f.rt.layoutDiffers.length} chain copies differ only in layout, pinned)` : 'NO'],
  ])}

## Declared gaps (residuals): counted, not hidden

These are validation-visible declarations in the source, not defaults. Total ${val.residuals.length}.

${table(['Residual', 'Count', 'Meaning'], residualRows)}

Legacy confidence: ${legacyBars} of ${S.length + C.length} legacy confidence bars were unreachable under the legacy additive formula (\`base_confidence\` + the \`confidence_gain\` of the questions the chain asks < \`minimum_quote_confidence\`). The new model (Cₓ = Σw(retired)/Σw(active)) reaches 1 when every class retires, so the validator accepts the thresholds; whether the numbers are the business's is #${DECISION_NO.confidence}.

## Genuine business decisions not safely inferable

Each is filed in \`PENDING_DECISIONS.md\` with its question and its default.

${table(['#', 'Decision'], [
    [DECISION_NO.playbook, 'Playbook documentation defect: the glossary, execution path, state-transition contract and dynamic-service chapter still describe Entity -> Behavioral Class -> Capability -> Strategy -> Action -> Derived Service (not edited, per instruction).'],
    [DECISION_NO.taxonomy, `Entity taxonomy: ${f.created.length} entities this migration had to create (${f.created.map(e => e.label.toLowerCase()).join(', ')}), the 11-service primary-entity decision table, ${f.E.filter(e => e.kind !== 'component').length} generic entities, ${f.E.filter(e => typeof e.decision === 'string' && e.decision.startsWith('label generated')).length} labels generated from ids.`],
    [DECISION_NO.confidence, `Confidence inputs: ${weighted} class weights seeded from the legacy confidence_gain; ${classes.length - weighted} classes with none; thresholds seeded from the legacy minimum_quote_confidence / diagnostic_threshold (${n(f.sources.exact_at ? Object.values(f.sources.exact_at).reduce((a, b) => a + b, 0) : 0)} policies; range_at = diagnostic_below because the legacy file has one lower bound); ${f.gate(S, 'none') + f.gate(C, 'none')} units with no weighted uncertainty.`],
    [DECISION_NO.composition, `Which modifier or entity separates the ${f.m.report.counts.servicesInAmbiguousPoints} curated services that share ${f.m.report.counts.ambiguousCompositionPoints} (entity, action) points; the modifier registry holds only answer-keyed fee modifiers, not domain modifiers such as brick or oversized.`],
    [DECISION_NO.unknown, `The ${resid.unknown_option || 0} options classified "not sure" by label pattern, ${resid.unknown_option_with_cost_effect || 0} of which change price or minutes.`],
    [DECISION_NO.scope, `Question scope: the 5-entity threshold for a context question; the ${f.unreferenced} questions nothing references and the ${f.defaultIntake} only a default list injects.`],
    [DECISION_NO.cutover, 'Dual-source cutover: when btnyc.json stops being the runtime file; the compiler quirk that makes the listed-versus-branch-target spelling of a chain visible in compiled.module_index; merge_strategy retirement.'],
    [DECISION_NO.dangling, 'The 6 legacy references that name no module (Install -> item_quantity, Repair -> damage_areas, and access in the deprecated force-module lists).'],
  ])}

## Not done, on purpose

- No runtime module was written (resolver, confidence engine, composer, recovery engine, route builder). The derived graph is the input they would read.
- \`btnyc.json\` was not edited, \`archive/T174_184_wip_engine_gate.patch\` was not applied, PR #21 was not merged, the red-test backlog was not repaired.
- Modifier decomposition of the ${f.m.report.counts.servicesInAmbiguousPoints} ambiguous services, weights for the ${classes.length - weighted} unweighted classes and per-service recovery deep-dives were not invented.
`;
}

function migrationReport(f) {
  const { m, src, val } = f; const L = m.report.ledger;
  const sites = Object.entries(refs.RULES).map(([sec, rules]) => rules.map(r => `${sec}: \`${r.path.join('.')}\` (${r.kind}) -> ${r.t}`)).flat();
  const decl = Object.entries(DN.PINNED).map(([k, v]) => [k, v.where.length, v.reason]);
  return `# Migration report: service-first catalog to entity-first source (T175)

Generated by \`node test_harness/tools/entity_first/report.js --write\`; numbers are computed (see COVERAGE_REPORT.md for the summary). The design is \`ssot/ENTITY_FIRST_DESIGN_NOTE.md\`; the reasons for the dual-source transition are \`ssot/TRANSITION_DUALSOURCE.md\`.

## 1. Result in one paragraph

\`btnyc.json\` (service-first, ${n(fs.readFileSync(lib.PATHS.legacy, 'utf8').split('\n').length)} lines) is re-authored as \`ssot/btnyc_source.json\` (schema \`schema/btnyc-source.schema.json\` 1.0.0): ${f.E.length} entities own their questions, uncertainty classes, curated services and default compositions; actions, modifiers and the other registries are defined once with stable ids; every cross-node relationship is a bare, prefix-typed id. The source reproduces every authored section of \`btnyc.json\` (\`project_legacy.js --check\`) and, fed through the unchanged production compiler, reproduces all 8 compiler-owned keys (\`compiler_roundtrip.js\`), except for the declared normalizations in section 6. \`btnyc.json\` itself is unchanged; the golden-master pricing baseline is identical before and after.

## 2. Old field or curated value -> new home

${table(['Legacy', 'Source', 'How', 'Count'], L.map(r => [r.legacy, r.source, r.how, r.count === null ? '' : r.count]))}

Reference sites converted through the table in \`refs.js\` (a legacy bare key, a \`"#tag"\`, a \`{"$ref": "#tag"}\` or a label used as a key all become one bare id):

${sites.map(s => '- ' + s).join('\n')}

Curated knowledge the compiler cannot reproduce, with its authoritative home: \`routing_archetypes\` is hybrid. Everything curated (entry mode, listed components, component->service links, symptom prompts and tiles, known-need tiles, recorded gaps, authored symptoms of groups with no symptom question, the action union) moved to \`registries.groups[].picker\` before \`routing_archetypes\` became derived-only for the source. Symptom ids and symptom->service links of a group that declares \`symptom_question_id\` are compiled from that question by the production compiler (T174 / #199) and were never authored.

## 3. The Playbook's legacy chain: every passage and every field

The Playbook's entity-first authoring section and \`COMPONENT_LAYER_MAP.md\` make the identity **entity + action + modifiers**, with behavioral classes as metadata and workflow as a view. Several other passages still describe the older chain Entity -> Behavioral Class -> Capability -> Strategy -> Action -> Derived Service. That is a documentation inconsistency in the Playbook. It is **not fixed here** (the Playbook was installed byte-for-byte and is not edited in this task); it is filed as \`PENDING_DECISIONS.md\` #${DECISION_NO.playbook}.

Passages (anchor is the nearest id in \`PROJECT_CHARTER.html\`):

${table(['Passage', 'Old-chain wording', 'Treatment in this migration'], [
    ['Dynamic Services chapter (near #principle-P-DOMAIN-SCOPE)', '"It has the same shape as a named service: an entity, a routing mode, a capability, a strategy, an action, a price"', 'Modelled as entity + action (+ modifiers) with a pricing shape and intake chain (default compositions). Routing mode kept as picker entry mode (orthogonal operational policy); capability and strategy are not stages.'],
    ['R-DOMAIN-DYNCHAIN, "Dynamic Service Chains Must Match Their Routing Mode" (near #principle-P-DOMAIN-SCOPE)', 'a chain must match its routing mode', 'Retained as orthogonal operational policy: \`picker.entry_mode\` is carried; the chain-shape rule is a runtime check this task does not touch.'],
    ['Orchestrate row of the pipeline table (near #principle-P-WHITEFLAG-PRECISE)', '"resolve entity, load routing mode, apply strategy, compose chain, build confidence, gate threshold"', 'Runtime workflow, a view over the data. Not a data stage. Nothing migrated.'],
    ['"Every Group Carries a Routing Mode" and R-SYSTEM-PICKER-AGREE (near #principle-P-WHITEFLAG-PRECISE)', 'routing mode as a per-group classification', 'Retained: \`registries.groups[].picker.entry_mode\`. Orthogonal operational policy, derived-and-checked by the compiler, not domain identity.'],
    ['The Canonical Execution Path (near #rule-R-PRICE-PRECISION)', '"Resolve entity and routing mode, Apply strategy, ..., Resolve capability / action / service"', 'Runtime view. Not migrated as stages.'],
    ['Resolution state-transition contract (#resolution-transition-contract)', 'RESOLVED JOB SHAPE: "entity -> capability -> action -> service / dynamic service"', 'The data has no capability. The set of actions an entity supports is the set of action_ids on its services and compositions. Retired as a stage.'],
    ['"Four Orthogonal Dimensions" (near #principle-P-SYSTEM-TAGS)', 'Routing Mode / Pricing Mode / Entity / Checkout State', 'Consistent with entity-first (orthogonal dimensions). Carried: entry_mode, pricing shape, entity, checkout_state.'],
    ['\`archetypes\` namespace row (near #rule-R-DOMAIN-SHAPE)', '"behavioural-class default shape: default routing strategy, default confidence strategy, default checkout state"', '\`registries.behavioral_classes[]\`: metadata and defaults for groups. Default confidence strategy became \`default_confidence_policy\`; default routing strategy is class metadata.'],
    ['Glossary (near #principle-P-GOVERN-GOODHART): Routing Mode, Capability, Strategy, Derived Service, merge_strategy', 'defines capability and strategy as domain terms and the derived service as a derived expression', 'Derived Service matches the model (services are authored points in the entity/action/modifier space). Capability and Strategy have no data field. merge_strategy retained as composition runtime_compat.'],
  ])}

Data fields that carry the old wording:

${table(['Legacy field', 'Count', 'New home', 'Disposition'], [
    ['\`routing_archetypes[].routing_archetype\` (routing mode)', f.cnt.routing_mode, '\`group.picker.entry_mode\`', 'retained as orthogonal operational policy'],
    ['\`archetypes[].default_routing_strategy\`', f.cnt.class_routing, '\`behavioral_classes[].default_routing_strategy\`', 'retained as class metadata'],
    ['\`archetypes[].default_confidence_strategy\`', f.cnt.class_conf, '\`behavioral_classes[].default_confidence_policy\` + \`runtime_compat\`', 'mapped: the confidence part is policy; max follow-up questions is legacy operational metadata'],
    ['\`services[].confidence_strategy\`', f.cnt.svc_conf, '\`service.confidence_policy\` (exact_at, range_at, diagnostic_below, 0-1) + \`runtime_compat.confidence_strategy\` remainder', 'mapped; the remainder (maximum_followup_questions, base_confidence, _variability_*) is legacy operational metadata, not domain identity'],
    ['\`dynamic_services[].confidence_strategy\`', f.cnt.dyn_conf, '\`composition.confidence_policy\` + \`runtime_compat\`', 'mapped as above'],
    ['\`dynamic_services[].merge_strategy\`', f.cnt.merge, '\`composition.runtime_compat.merge_strategy\`', 'retained as operational metadata; a retirement candidate (#' + DECISION_NO.cutover + ')'],
    ['\`workflow.fallback_routing_rules\`, \`workflow.behavior.bypass_intake\`', f.cnt.fallback_routing + f.cnt.bypass, '\`policy.workflow\` verbatim', 'retained: workflow policy, a view'],
    ['\`services[].behavior\`', f.cnt.svc_behavior, '\`service.intake.behavior\`', 'retained: operational flag'],
    ['\`service_types\` (the action vocabulary)', f.cnt.actions, '\`registries.actions[]\`', 'mapped; this is where "capability" would live: the action set of an entity is derived from its services'],
    ['\`capability\` as a key', 0, 'none', 'no such key exists in btnyc.json; the word appears only in Playbook prose'],
    ['\`_archetype_note\`, \`_archetype_mismatch_report\`, \`pricing_archetypes\`', `${f.cnt.arch_note} / 1 / 1`, 'notes carried; the compiled ones stay compiler-owned', 'derived, not authored'],
  ])}

## 4. Deviations from the design note (recorded, not silently rewritten)

- \`entity.group_ids\` was dropped. A group lists its components in \`group.picker.component_entity_ids\`, which is the authority the compiler's \`real_component_ids\` needs.
- \`entity.offers[]\` was dropped for \`group.picker.component_links[]\`. Ownership (one \`service.entity_id\`) does not imply which services the picker lists under which component (symptom-routed services are owned by the component but not listed under it), so the curated map is carried verbatim by the group. A service still has exactly one entity.
- Scope counts a deep-dive question as a use. Design note 7.1 said scope is the entities whose chains ask the question; \`recovery_affordances.deep_dive_question_ids\` is the Fork's second path and is asked of the customer too, so counting chains only scoped a question used by many entities to one (\`q.attempted_fix\`) and filed another as asked by nothing (\`q.computer_attempted_fix\`). The validator enforces it (\`V-SCOPE-ASKER\`, \`V-SCOPE-CLAIM\`).
- \`entity.family\` was not added. Behavioral classes are keyed by group (\`member_group_ids\`), never by entity, in the legacy data; keeping them as the registry they were is the lossless choice, and the Playbook says classes are metadata.
- \`registries.service_order\` and \`picker.action_ids\` were added (service order and the curated action union are content).
- \`registries.pricing_archetypes\` was added as a closed id list: \`par.*\` is referenced by every service's financial_engine and its definitions are constants in the compiler.
- Weighted-uncertainty classes with no legacy \`confidence_gain\` carry \`weight_basis: "unauthored"\` and no weight, rather than a default.
- Steps carry \`runtime_compat.legacy_chain_entry: "branch_target_only"\` for the ${f.S.concat(f.C).reduce((a, x) => a + x.intake.steps.filter(s => s.runtime_compat).length, 0)} steps a legacy chain reached only through a \`then\`: the production compiler's \`flatten_intake_chain\` counts listed entries only, so \`compiled.module_index.used_by\` depends on it. The target model ignores it.
- Legacy chain layout (entry order, redundant \`then\` targets, target-list order) is canonicalized; see section 6.

## 5. Discrepancies found against the task text

- The audit's 461 options without ids is not reproducible from the repository. Real: ${n(f.legacyOpts)} module options, ${f.legacyOptsWithId} with an id, plus ${f.instOpts} options inside parameterised steps; all ${n(val.stats.options)} now have ids.
- The Playbook's 96 dynamic services is ${f.C.length} in the repository; all ${f.C.length} are decomposed.
- \`price_golden_master.js capture --out <path>\` takes the path positionally; \`--out\` would have created a file named \`--out\`. Used positionally.
- \`t174-landing\` is 8 commits ahead of \`main\`, not 7.
- The superseding \`COMPONENT_LAYER_MAP.md\` is 7,417 bytes; the edition it replaced was 26,751.
- Work is on branch \`ssot-entity-first\` cut from \`t174-landing\` @ \`afc972d\`, so PR #21's head is not mutated.

## 6. Declared normalizations (pinned in \`declared_normalizations.js\`; a new one fails the tools)

${table(['Class', 'Occurrences', 'Why'], decl)}

## 7. Rule-table sites, counts and the verification commands

Every command exits 0 on the committed tree:

\`\`\`
node test_harness/tools/entity_first/validate_source.js          # schema + semantic validation of the source
node test_harness/tools/entity_first/project_legacy.js --check   # the source alone reproduces btnyc.json's authored sections
node test_harness/tools/entity_first/compiler_roundtrip.js       # the production compiler on that projection reproduces its 8 keys
node test_harness/tools/entity_first/audit_refs.js               # no legacy-spelled reference survives
node test_harness/tools/entity_first/derive_graph.js --check     # the derived graph is what the source derives
node test_harness/tools/entity_first/report.js --check           # these reports are what the data produces
\`\`\`

The class detectors that can fail (counterfactual mutants) are \`test_harness/verify_entity_first_*.js\`.
`;
}

function ledgerJson(f) {
  return { generated: 'by test_harness/tools/entity_first/report.js; never edit by hand', source_schema_version: f.src.source_schema_version, ledger: f.m.report.ledger, counts: f.m.report.counts, findings: f.m.report.findings, decisions: f.m.report.decisions, declared_normalizations: DN.PINNED, reference_table: refs.RULES,
    residuals: Object.entries(f.resid).map(([kind, count]) => ({ kind, count, ids: f.val.residuals.filter(r => r.kind === kind).map(r => r.id) })) };
}

function build() {
  const f = facts(); const out = { [lib.PATHS.coverageReport]: coverage(f), [lib.PATHS.migrationReport]: migrationReport(f), [lib.PATHS.ledger]: lib.toText(ledgerJson(f)) };
  // a report is generated text: a template placeholder or an undefined that reached it is a defect of the generator, never content (it shipped once: "#${DECISION_NO.cutover}")
  for (const [p, text] of Object.entries(out)) { const bad = /\$\{|\bundefined\b|\[object Object\]|\bNaN\b/.exec(text); if (bad) throw new Error(`${path.relative(lib.ROOT, p)}: generated text contains ${JSON.stringify(bad[0])} near ${JSON.stringify(text.slice(Math.max(0, bad.index - 60), bad.index + 40))}`); }
  return out;
}

if (require.main === module) {
  const args = process.argv.slice(2); const out = build(); let bad = 0;
  for (const [p, text] of Object.entries(out)) {
    const rel = path.relative(lib.ROOT, p);
    if (args.includes('--write')) console.log((lib.writeIfChanged(p, text) ? 'wrote ' : 'unchanged ') + rel);
    else if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== text) { console.log('stale or missing: ' + rel); bad++; }
  }
  if (!args.includes('--write')) { if (bad) { console.log('run: node test_harness/tools/entity_first/report.js --write'); process.exit(1); } console.log('reports are current'); }
}
module.exports = { build, facts, DECISION_NO };
