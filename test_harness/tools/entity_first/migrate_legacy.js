#!/usr/bin/env node
'use strict';
/**
 * migrate_legacy.js -- re-author btnyc.json (service-first) as ssot/btnyc_source.json (entity-first). One-time, reproducible, deterministic (T175).
 *
 *   node test_harness/tools/entity_first/migrate_legacy.js [--write] [--out <source.json>] [--report <dir>]
 *
 * Without --write it migrates in memory and prints the counts. It never touches btnyc.json. The design is ssot/ENTITY_FIRST_DESIGN_NOTE.md; every section number below refers to it.
 * Whatever the migration cannot map it reports (report.unresolved) instead of defaulting; every business-number or taxonomy choice it makes is recorded in report.decisions with its basis.
 */
const fs = require('fs'), path = require('path');
const lib = require('./lib.js');
const refs = require('./refs.js');
const { clone, slug, uniqueSlugger, isObj } = lib;

// ---- the choices this migration makes, as data ------------------------------------------------------------------------------------------------------------------------------
// qr.html resolveBaseConfidenceStrategy's last-resort constant. Services/compositions that declare nothing inherit the behavioral class, then this. Written into the source explicitly (design note 8.3).
const FALLBACK_STRATEGY = { minimum_quote_confidence: 70, maximum_followup_questions: 3, diagnostic_threshold: 35, base_confidence: 40 };
// Entities the 16 component-less services (and the group heads) need. Each is a taxonomy decision under G-GOVERN-AUTONOMY; the note travels with the entity.
const CREATED_ENTITIES = {
  computer: { label: 'Computer', note: 'Created: the head entity of the Computer Repair group. computer_diagnostic, virus_or_malware_removal and internal_hardware_replacement have no single component in routing_archetypes; laptop and desktop are its parts.' },
  door: { label: 'Door', note: 'Created: the head entity of the Doors group. door_repair_impact_damage and door_weatherstripping map to no component; the lock, handle, deadbolt and prehung door are its parts.' },
  window: { label: 'Window', note: 'Created: the head entity of the Windows group. window_draft_sealing maps to no component; window hardware and screen are its parts.' },
  floor: { label: 'Floor', note: 'Created: the head entity of the Floors and Trim group. squeaky_floor_repair maps to no component.' },
  wall: { label: 'Wall', note: 'Created: the head entity of the Walls group; brick, concrete, drywall and plaster are the surfaces it can be.' },
  wall_paneling: { label: 'Wall paneling', parent: 'ent.wall', note: 'Created: wood_paneling_repair maps to no component; paneling is a kind of wall.' },
  wall_mounted_object: { label: 'Wall-mounted object', note: 'Created (the Playbook\'s own example entity): generic_mounting_service mounts an unnamed object; shelf, frame and mirror are named kinds of it.' },
  angle_stop: { label: 'Angle stop', note: 'Created: angle_stop_replacement maps to no component; the angle stop (shut-off valve under a sink) is the thing the customer names.' },
};
// group -> head entity where the group has no single component (a created entity above); every other group with exactly one component uses it, the rest get a generic entity.
const GROUP_HEAD = { minor_home_repairs_doors: 'door', minor_home_repairs_windows: 'window', minor_home_repairs_floors_trim: 'floor', minor_home_repairs_walls: 'wall',
  tech_trouble_computer_repair: 'computer' };
// service -> primary entity where the component rule does not give one clean answer. Everything else: the single mapped component, else the first mapped component, else the group's single component.
const SERVICE_ENTITY = { angle_stop_replacement: 'ent.angle_stop', computer_diagnostic: 'ent.computer', virus_or_malware_removal: 'ent.computer', internal_hardware_replacement: 'ent.computer',
  door_repair_impact_damage: 'ent.door', door_weatherstripping: 'ent.door', squeaky_floor_repair: 'ent.floor', generic_mounting_service: 'ent.wall_mounted_object', window_draft_sealing: 'ent.window',
  wood_paneling_repair: 'ent.wall_paneling', light_fixture_replacement: 'ent.ceiling_light' };
// An option whose label says the customer does not know, or defers to notes, is evidence of nothing and never retires an uncertainty class (R-INTAKE-NONRETIRING).
const UNKNOWN_RE = /\b(not sure|unsure|i don.?t know|don.?t know|no idea|something else)\b|\bother\b|describe in (the )?notes/i;
const AFFECT_ORDER = ['price', 'minutes', 'branch', 'prep', 'checkout_state', 'complexity', 'quantity', 'materials', 'tags'];
// A question asked by at least this many distinct entities is a context question (quantity, mounting height, wall type ...), not the property of any one of them. See report.decisions.
const CONTEXT_MIN_ENTITIES = 5;

const titleCase = s => s.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

function migrate(L) {
  const report = { decisions: [], unresolved: [], findings: [], counts: {}, ledger: [] };
  const note = (kind, text, extra) => report.decisions.push(Object.assign({ kind, text }, extra || {}));
  const unresolved = (what, detail) => report.unresolved.push({ what, detail });
  const ledger = (legacy, source, how, n, why) => report.ledger.push({ legacy, source, how, count: n === undefined ? null : n, note: why || '' });
  const refCount = {}; const counter = (rule) => { refCount[rule.t] = (refCount[rule.t] || 0) + 1; };

  const ctx = { actionByLegacy: new Map(), actionLabel: new Map() };
  report.danglingLegacy = [];
  ctx.moduleExists = name => Object.prototype.hasOwnProperty.call(L.intake_modules, name);
  ctx.onDangling = name => { report.danglingLegacy.push(name); };
  const S = refs.makeSpellings(ctx);
  const A = clone(lib.authoredLegacy(L));
  A.routing_archetypes = clone(L.routing_archetypes); // hybrid: its curated part is authored input (design note 9.2)

  // ================================================================ registries =============================================================================================
  // ---- actions (was service_types) ----
  const actions = Object.entries(A.service_types).map(([k, v]) => Object.assign({ id: 'act.' + k.toLowerCase(), label: k }, v));
  actions.forEach(a => { ctx.actionByLegacy.set(a.label, a.id); ctx.actionLabel.set(a.id, a.label); });
  refs.forward(actions, refs.RULES.actions, ctx, counter);
  ledger('service_types.<Type>', 'registries.actions[]', 'keyed object -> array with id act.<type>; label keeps the legacy key', actions.length);

  // ---- categories / groups (base fields; the picker is attached below) ----
  const categories = clone(A.category); refs.forward(categories, refs.RULES.categories, ctx, counter);
  const groups = clone(A.group); refs.forward(groups, refs.RULES.groups_base, ctx, counter);
  ledger('category[]', 'registries.categories[]', 'ids -> cat.<id>; group_ids -> grp.<id>', categories.length);
  ledger('group[]', 'registries.groups[]', 'ids -> grp.<id>; category/parent/explicit_services/dynamic_service_types normalised', groups.length);

  // ---- modifiers ----
  const modById = new Map();
  const modifiers = Object.entries(A.global_rules.modifiers).map(([k, m]) => {
    const affects = []; if (m.fee) affects.push('price'); if (m.minutes) affects.push('minutes');
    const mod = Object.assign({ id: 'mod.' + k }, m, { affects }); modById.set(mod.id, mod); return mod;
  });
  ledger('global_rules.modifiers.<slug>', 'registries.modifiers[]', 'keyed object -> array with id mod.<slug>; affects computed from fee/minutes', modifiers.length);
  report.counts.modifiersWithNoEffect = modifiers.filter(m => m.affects.length === 0).length;

  // ---- tags (answers are attached once the questions exist) ----
  const tags = Object.entries(A.smart_tags).map(([k, t]) => Object.assign({ id: S.tag_hash.f(k) }, t));
  refs.forward(tags, refs.RULES.tags_base, ctx, counter);

  // ---- materials, furniture, checkout states, formulas, behavioral classes ----
  const materials = Object.entries(A.materials_catalog).map(([k, m]) => { if (k !== m.sku) unresolved('materials_catalog key differs from sku', k); return Object.assign({ id: 'mat.' + m.sku }, m); });
  // ids are ASCII (lib.ID_RE); a SKU with a diacritic (IKE-småstad_ch-80) keeps its sku field verbatim and gets the diacritic-free id. A collision would be reported, not suffixed away.
  const ascii = x => x.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const furniture = A.furniture_catalog.map(f => Object.assign({ id: 'fur.' + ascii(f.sku) }, f));
  { const seenF = new Set(); for (const f of furniture) { if (seenF.has(f.id)) unresolved('two furniture rows collapse to one id', f.id); seenF.add(f.id); } report.counts.furnitureIdsNormalised = furniture.filter(f => f.id !== 'fur.' + f.sku).length; }
  const checkoutStates = Object.entries(A.checkout_states).map(([k, c]) => Object.assign({ id: 'chk.' + k }, c));
  const formulas = Object.entries(A.pricing_formulas).map(([k, f]) => Object.assign({ id: 'fml.' + k }, f));
  refs.forward(formulas, refs.RULES.formulas, ctx, counter);
  const classes = Object.entries(A.archetypes).map(([k, a]) => {
    const c = Object.assign({ id: 'cls.' + k }, a);
    const d = c.default_confidence_strategy; delete c.default_confidence_strategy;
    const extra = Object.keys(d).filter(x => !['minimum_quote_confidence', 'maximum_followup_questions'].includes(x));
    if (extra.length) unresolved('behavioral class default_confidence_strategy has fields with no home', `${k}: ${extra.join(',')}`);
    c.default_confidence_policy = { exact_at: d.minimum_quote_confidence / 100 };
    c.runtime_compat = { default_maximum_followup_questions: d.maximum_followup_questions };
    return c;
  });
  refs.forward(classes, refs.RULES.classes, ctx, counter);
  ledger('archetypes.<class>', 'registries.behavioral_classes[]', 'keyed object -> array with id cls.<key>; default_confidence_strategy -> default_confidence_policy.exact_at (0-1) + runtime_compat', classes.length);
  const classOfGroup = new Map(); classes.forEach(c => (c.member_group_ids || []).forEach(g => classOfGroup.set(g, c.id)));

  // ================================================================ questions ==============================================================================================
  const mods = A.intake_modules;
  const symptomModules = new Set(Object.values(A.routing_archetypes).map(a => a.symptom_module).filter(Boolean));
  const questions = new Map();   // qid -> question object (template/plain)
  const instances = [];          // instance questions in creation order
  const optIds = new Map();      // qid -> Map(label -> optionId)
  const optLabels = new Map();   // qid -> Map(optionId -> label)
  const registerOptions = (qid, list, symptom) => {
    const sl = uniqueSlugger(); const byLabel = new Map(), byId = new Map();
    list.forEach((o, i) => { const base = sl(symptom ? o.label : o.label.slice(0, 200), 'option_' + (i + 1)); const id = symptom ? 'sym.' + base : base; byLabel.set(o.label, id); byId.set(id, o.label); });
    optIds.set(qid, byLabel); optLabels.set(qid, byId);
  };
  for (const [mk, m] of Object.entries(mods)) { if (m.client_response) registerOptions('q.' + mk, m.client_response, symptomModules.has(mk)); }
  const optionId = (qid, label) => { const id = optIds.get(qid) && optIds.get(qid).get(label); if (!id) throw new Error(`no option "${label}" in ${qid}`); return id; };

  function convOption(o, qid) {
    const out = { id: optionId(qid, o.label), label: o.label, affects: [] };
    const aff = new Set();
    const known = new Set(['label', 'tags', 'complexity_override', 'modifier_ref', 'checkout_state_override', 'qty_value', 'route_to', 'mat_min', 'mat_max', '_note', 'tile', 'location_hints', 'formula_override']);
    for (const k of Object.keys(o)) if (!known.has(k)) unresolved('option field with no mapping', `${qid}: ${k}`);
    if (UNKNOWN_RE.test(o.label)) out.evidence = 'unknown';
    if (o.tags) { out.tag_ids = o.tags.map(S.tag_hash.f); if (o.tags.length) aff.add('tags'); }
    if (o.complexity_override !== undefined) { out.complexity_override = o.complexity_override; aff.add('complexity'); }
    if (o.modifier_ref !== undefined) {
      out.modifier_id = 'mod.' + o.modifier_ref; const md = modById.get(out.modifier_id);
      if (!md) unresolved('modifier_ref to a missing modifier', `${qid}: ${o.modifier_ref}`); else md.affects.forEach(a => aff.add(a));
    }
    if (o.checkout_state_override !== undefined) { out.checkout_state_id = 'chk.' + o.checkout_state_override; aff.add('checkout_state'); }
    if (o.qty_value !== undefined) { out.qty_value = o.qty_value; aff.add('quantity'); }
    if (o.route_to) {
      out.route_to = { service_id: 'svc.' + o.route_to.service, answers: Object.entries(o.route_to.answers || {}).map(([mk, label]) => ({ question_id: 'q.' + mk, option_id: optionId('q.' + mk, label) })), because: o.route_to.because };
      aff.add('branch');
    }
    if (o.mat_min !== undefined) out.mat_min = o.mat_min; if (o.mat_max !== undefined) out.mat_max = o.mat_max; if (o.mat_min !== undefined || o.mat_max !== undefined) aff.add('materials');
    if (o.formula_override !== undefined) { out.formula_id = 'fml.' + o.formula_override; aff.add('price'); }
    if (o.location_hints !== undefined) { out.location_hints = o.location_hints; aff.add('prep'); }
    if (o.tile !== undefined) out.tile = o.tile;
    if (o._note !== undefined) out._note = o._note;
    out.affects = AFFECT_ORDER.filter(a => aff.has(a));
    return out;
  }

  const QUESTION_PASS_THROUGH = new Set(['question', 'type', 'purpose', 'client_response', 'confidence_gain', 'affects_price', 'depends_on']);
  const gainOf = new Map();
  for (const [mk, m] of Object.entries(mods)) {
    const qid = 'q.' + mk;
    const q = { id: qid, prompt: m.question, type: m.type, purpose: m.purpose, entity_scope: null, depends_on: [] };
    if (m.depends_on) q.depends_on = Object.entries(m.depends_on).map(([pk, label]) => ({ question_id: 'q.' + pk, option_id: optionId('q.' + pk, label) }));
    if (m.client_response) q.options = m.client_response.map(o => convOption(o, qid));
    for (const k of Object.keys(m)) if (!QUESTION_PASS_THROUGH.has(k)) q[k] = clone(m[k]);
    if (m.affects_price !== undefined) q.runtime_compat = { affects_price: m.affects_price };
    if (m.confidence_gain !== undefined) gainOf.set(qid, m.confidence_gain);
    questions.set(qid, q);
  }
  ledger('intake_modules.<module>', 'questions (entities[].questions[] | shared_questions[])', 'keyed object -> question id q.<module>; question -> prompt; client_response -> options; depends_on -> {question_id, option_id} terms', Object.keys(mods).length);
  report.counts.optionsWithoutIdBefore = Object.values(mods).reduce((n, m) => n + (m.client_response || []).filter(o => o.id === undefined).length, 0);

  // ---- instance (parameterised) questions: created while the chains are read ----
  const instanceOf = new Map(); // `${ownerId}|${key}` -> qid
  const instanceIds = new Set();
  function instanceQuestion(ownerSlug, module, params) {
    const key = `${ownerSlug}|${module}::${params.item_noun}`;
    if (instanceOf.has(key)) return instanceOf.get(key);
    let id = `q.${module}.${ownerSlug}`; if (instanceIds.has(id)) id += '_' + slug(params.item_noun || 'x');
    instanceIds.add(id); instanceOf.set(key, id);
    const unknown = Object.keys(params).filter(k => !['item_noun', 'client_response', 'question_override'].includes(k)); if (unknown.length) unresolved('params field with no mapping', `${id}: ${unknown.join(',')}`);
    const q = { id, instance_of: 'q.' + module, item_noun: params.item_noun, entity_scope: null, depends_on: [] };
    if (params.question_override !== undefined) q.prompt_override = params.question_override;
    if (params.client_response) { registerOptions(id, params.client_response, false); q.options = params.client_response.map(o => convOption(o, id)); }
    instances.push(q); questions.set(id, q);
    return id;
  }
  const effectiveOptions = qid => { const q = questions.get(qid); if (q.options) return q.options; if (q.instance_of) return questions.get(q.instance_of).options; return null; };
  const effectiveLabelsOf = qid => { const q = questions.get(qid); if (q.options) return optLabels.get(qid); return optLabels.get(q.instance_of); };
  const effectiveIdOf = (qid, label) => { const q = questions.get(qid); const base = q.options ? qid : q.instance_of; return optionId(base, label); };

  // ================================================================ entities ===============================================================================================
  const RA = A.routing_archetypes;
  const svcLegacy = new Map(A.services.map(s => [s.id, s]));
  // comps in file order, with the groups each appears in and the services each links to there
  const compOrder = []; const compGroups = new Map(); const linkList = []; // {group, comp, svc}
  for (const [g, a] of Object.entries(RA)) {
    for (const c of a.real_component_ids || []) { if (!compGroups.has(c)) { compGroups.set(c, []); compOrder.push(c); } compGroups.get(c).push(g); }
    for (const [c, ss] of Object.entries(a.component_id_to_service_ids || {})) for (const s of ss) linkList.push({ group: g, comp: c, svc: s });
  }
  const compsOfService = new Map(); for (const l of linkList) { if (!compsOfService.has(l.svc)) compsOfService.set(l.svc, []); if (!compsOfService.get(l.svc).includes(l.comp)) compsOfService.get(l.svc).push(l.comp); }
  const entities = new Map();
  const ensureEntity = (id, label, kind, extra) => { if (!entities.has(id)) entities.set(id, Object.assign({ id, label, kind, parent_id: null, aliases: [], questions: [], uncertainty_classes: [], services: [], default_compositions: [] }, extra || {})); return entities.get(id); };
  for (const c of compOrder) ensureEntity('ent.' + c.slice(5), titleCase(c.slice(5)), 'component', { decision: 'label generated from the component id (no curated label exists)' });
  for (const [k, e] of Object.entries(CREATED_ENTITIES)) ensureEntity('ent.' + k, e.label, 'component', { parent_id: e.parent || null, decision: e.note });
  const groupHead = new Map();
  const groupSlug = g => g;
  for (const g of groups) {
    const gid = g.id.slice(4); const ra = RA[gid]; const comps = (ra && ra.real_component_ids) || [];
    let head;
    if (GROUP_HEAD[gid]) head = 'ent.' + GROUP_HEAD[gid];
    else if (comps.length === 1) head = 'ent.' + comps[0].slice(5);
    else { head = 'ent.generic_' + gid; ensureEntity(head, titleCase(gid.replace(/^[a-z]+_[a-z]+_/, '')) + ' (unspecified item)', 'generic_group', { decision: `Generic entity of group ${gid}: carries the group's default compositions (the decomposed dynamic services) because the group has ${comps.length} components and no single head entity.` }); }
    groupHead.set(g.id, head);
  }
  const categoryGeneric = new Map();
  for (const c of categories) { const id = 'ent.generic_' + c.id.slice(4); ensureEntity(id, titleCase(c.id.slice(4)) + ' (unspecified item)', 'generic_category', { decision: 'Generic entity of a category: carries the category-level default compositions (dynamic services keyed category+Type).' }); categoryGeneric.set(c.id, id); }
  // parent_id: a component that appears in exactly one group whose head is a created entity is a part/kind of that head
  for (const c of compOrder) { const gs = compGroups.get(c); if (gs.length === 1) { const head = groupHead.get('grp.' + gs[0]); if (head && head !== 'ent.' + c.slice(5) && CREATED_ENTITIES[head.slice(4)] && !entities.get('ent.' + c.slice(5)).parent_id) entities.get('ent.' + c.slice(5)).parent_id = head; } }

  // primary entity per service
  const svcEntity = new Map(), svcEntityBasis = new Map();
  for (const s of A.services) {
    let e, basis;
    if (SERVICE_ENTITY[s.id]) { e = SERVICE_ENTITY[s.id]; basis = 'decision table'; }
    else {
      const cs = compsOfService.get(s.id) || [];
      if (cs.length === 1) { e = 'ent.' + cs[0].slice(5); basis = 'single mapped component'; }
      else if (cs.length > 1) { e = 'ent.' + cs[0].slice(5); basis = 'first of ' + cs.length + ' mapped components'; }
      else { const ra = RA[s.ui_taxonomy.group_id]; const gc = (ra && ra.real_component_ids) || []; if (gc.length === 1) { e = 'ent.' + gc[0].slice(5); basis = 'the group\'s single component'; } else { unresolved('service has no entity', s.id); continue; } }
    }
    if (!entities.has(e)) { unresolved('service entity does not exist', `${s.id} -> ${e}`); continue; }
    svcEntity.set(s.id, e); svcEntityBasis.set(s.id, basis);
  }
  report.counts.serviceEntityBasis = {}; for (const b of svcEntityBasis.values()) report.counts.serviceEntityBasis[b] = (report.counts.serviceEntityBasis[b] || 0) + 1;
  // every curated component link must be to a component the group lists (the projection depends on it)
  for (const l of linkList) if (!((RA[l.group].real_component_ids) || []).includes(l.comp)) unresolved('component link to a component the group does not list', `${l.group}: ${l.comp} -> ${l.svc}`);
  // every curated component->service link must name a service that exists (the picker is the authority for these links; see the picker block)
  for (const l of linkList) if (!svcLegacy.has(l.svc)) unresolved('component link to a service that does not exist', `${l.group}: ${l.comp} -> ${l.svc}`);
  report.counts.componentLinks = linkList.length;

  // ================================================================ chains -> steps ========================================================================================
  const usage = new Map(); // qid -> Set(entity id)
  const use = (qid, ent) => { if (!usage.has(qid)) usage.set(qid, new Set()); usage.get(qid).add(ent); };
  function buildIntake(chain, ownerSlug, entityId, ownerLabel) {
    const R = lib.resolveChain(chain);
    for (const r of R) if (!mods[r.module]) { unresolved('chain names a module that does not exist', `${ownerLabel}: ${r.module}`); }
    const qidOf = r => (r.params ? instanceQuestion(ownerSlug, r.module, r.params) : 'q.' + r.module);
    const qids = R.map(qidOf);
    const listed = new Set(chain.map(e => (e.params && e.params.item_noun ? `${e.module}::${e.params.item_noun}` : e.module)));
    const steps = R.map((r, i) => {
      const parents = [];
      R.forEach((p, j) => { if (j === i || p.module === r.module) return; for (const [label, targets] of Object.entries(p.then || {})) if ((targets || []).includes(r.module)) parents.push({ question_id: qids[j], option_id: effectiveIdOf(qids[j], label) }); });
      const step = { question_id: qids[i], depends_on: parents.length === 0 ? [] : parents.length === 1 ? [parents[0]] : [{ any_of: parents }] };
      // The production compiler (flatten_intake_chain) counts only the modules a chain LISTS as entries, not modules reached only as a `then` target, and compiled.module_index.used_by is built from that.
      // Which modules a legacy chain lists is therefore not free spelling: it is carried as legacy-only metadata so the compiled indexes reproduce, and the target model ignores it.
      if (!listed.has(r.key)) step.runtime_compat = { legacy_chain_entry: 'branch_target_only' };
      use(qids[i], entityId); return step;
    });
    // annotations on authored entries land on the step of the module they name
    for (const e of chain) {
      const key = e.params && e.params.item_noun ? `${e.module}::${e.params.item_noun}` : e.module; const idx = R.findIndex(r => r.key === key); if (idx < 0) continue;
      for (const k of ['_note', '_quantity_justification']) if (e[k] !== undefined) { if (steps[idx][k] !== undefined && steps[idx][k] !== e[k]) { report.findings.push({ what: 'two authored entries of one module carry different ' + k, detail: `${ownerLabel}: ${key}` }); steps[idx][k] += '\n' + e[k]; } else steps[idx][k] = e[k]; }
    }
    return steps;
  }

  // ---- services ----
  const SVC_MAP = { /* legacy field -> [block, name, rule?] */ };
  const services = [];
  const policyBasis = report.policyBasis = { service_override: 0, archetype_default: 0, fallback: 0 };
  function buildPolicy(cs, groupId, ownerLabel) {
    const cls = classes.find(c => (c.member_group_ids || []).includes('grp.' + groupId));
    const src = {}; const eff = {};
    for (const f of ['minimum_quote_confidence', 'diagnostic_threshold']) {
      if (cs && cs[f] !== undefined) { eff[f] = cs[f]; src[f] = 'service_override'; }
      else if (f === 'minimum_quote_confidence' && cls) { eff[f] = Math.round(cls.default_confidence_policy.exact_at * 100); src[f] = 'archetype_default'; }
      else { eff[f] = FALLBACK_STRATEGY[f]; src[f] = 'fallback'; }
      policyBasis[src[f]]++;
    }
    const compat = {}; if (cs) for (const [k, v] of Object.entries(cs)) if (k !== 'minimum_quote_confidence' && k !== 'diagnostic_threshold') compat[k] = clone(v);
    if (compat._inherits_from_archetype !== undefined) compat._inherits_from_archetype = S.cls.f(compat._inherits_from_archetype);
    // policy_sources is keyed by the new field names; the one legacy lower bound (diagnostic_threshold) seeds both range_at and diagnostic_below, so both carry its source
    const sources = { exact_at: src.minimum_quote_confidence, range_at: src.diagnostic_threshold, diagnostic_below: src.diagnostic_threshold };
    return { policy: { exact_at: eff.minimum_quote_confidence / 100, range_at: eff.diagnostic_threshold / 100, diagnostic_below: eff.diagnostic_threshold / 100, scale: '0-1', policy_sources: sources }, compat };
  }

  for (const s of A.services) {
    const ent = svcEntity.get(s.id); if (!ent) continue;
    const slugOwner = s.id;
    const steps = buildIntake(s.intake_chain, slugOwner, ent, 'service ' + s.id);
    const known = new Set(['id', 'operational_metrics', 'pricing_engine', 'default_estimates', 'ui_taxonomy', 'financial_engine', 'aliases', 'service_type', 'intake_chain', 'default_tags', 'confidence_strategy', 'verb_natural',
      'required_materials', 'optional_materials', 'per_unit_answers_vary', 'intake_modules_refs', 'override_root', 'detail_prompt', 'details', 'materials_included', 'requires_furniture_selection', 'suggested_tags', 'related_services',
      'behavior', 'remote_deep_dive_modules']);
    const notes = {}; for (const k of Object.keys(s)) if (!known.has(k)) { if (k.startsWith('_')) notes[k] = s[k]; else unresolved('service field with no mapping', `${s.id}: ${k}`); }
    const fe = clone(s.financial_engine); const pricing = { };
    // pricing_engine is either an engine token or a formula key
    if (A.pricing_formulas[s.pricing_engine]) pricing.formula_id = 'fml.' + s.pricing_engine; else pricing.engine = s.pricing_engine;
    if (fe.formula_ref !== undefined) fe.formula_ref = 'fml.' + fe.formula_ref;
    if (fe.pricing_archetype !== undefined) fe.pricing_archetype = 'par.' + fe.pricing_archetype;
    if (fe.checkout_state !== undefined) fe.checkout_state = 'chk.' + fe.checkout_state;
    if (fe._inherits_checkout_state_from_archetype !== undefined) fe._inherits_checkout_state_from_archetype = S.cls.f(fe._inherits_checkout_state_from_archetype);
    pricing.financial_engine = fe; pricing.operational_metrics = clone(s.operational_metrics); pricing.default_estimates = clone(s.default_estimates);
    if (s.per_unit_answers_vary !== undefined) pricing.per_unit_answers_vary = s.per_unit_answers_vary;
    if (s.override_root !== undefined) pricing.override_root = s.override_root;
    if (s.required_materials !== undefined) pricing.required_material_ids = s.required_materials.map(m => 'mat.' + m);
    if (s.optional_materials !== undefined) pricing.optional_material_ids = s.optional_materials.map(m => 'mat.' + m);
    if (s.materials_included !== undefined) pricing.materials_included = s.materials_included;
    if (s.requires_furniture_selection !== undefined) pricing.requires_furniture_selection = s.requires_furniture_selection;
    const ui = clone(s.ui_taxonomy); ui.category_id = 'cat.' + ui.category_id; ui.group_id = 'grp.' + ui.group_id;
    const presentation = { ui_taxonomy: ui }; if (s.aliases !== undefined) presentation.aliases = s.aliases; presentation.verb_natural = s.verb_natural;
    if (s.detail_prompt !== undefined) presentation.detail_prompt = s.detail_prompt; if (s.details !== undefined) presentation.details = s.details;
    const intake = { steps }; if (s.intake_modules_refs !== undefined) intake.module_refs = Array.isArray(s.intake_modules_refs) ? s.intake_modules_refs.map(m => 'q.' + m) : s.intake_modules_refs;
    if (s.behavior !== undefined) intake.behavior = clone(s.behavior);
    const svc = { id: 'svc.' + s.id, entity_id: ent, action_id: S.act.f(s.service_type), modifier_ids: [], presentation, pricing, intake };
    if (s.default_tags !== undefined || s.suggested_tags !== undefined) { svc.tags = {}; if (s.default_tags !== undefined) svc.tags.default_tag_ids = s.default_tags.map(S.tag_ref.f); if (s.suggested_tags !== undefined) svc.tags.suggested_tag_ids = s.suggested_tags.map(S.tag_ref.f); }
    if (s.related_services !== undefined) svc.related_service_ids = s.related_services.map(x => 'svc.' + x);
    const pol = buildPolicy(s.confidence_strategy, s.ui_taxonomy.group_id, 'service ' + s.id);
    svc.confidence_policy = pol.policy; svc.runtime_compat = { confidence_strategy: pol.compat };
    svc.recovery_affordances = { source: 'current_open_uncertainty', deep_dive_question_ids: (s.remote_deep_dive_modules || []).map(m => 'q.' + m), when_no_path: { route: 'diagnostic', checkout_state_id: 'chk.diagnostic' } };
    if (s.remote_deep_dive_modules === undefined) svc.recovery_affordances.deep_dive_declared = false;
    for (const m of s.remote_deep_dive_modules || []) use('q.' + m, ent); // a deep-dive question is ASKED of this entity's customer (the Fork's second path): it is a use of the question, so it is in the question's entity_scope
    Object.assign(svc, notes && Object.keys(notes).length ? { notes } : {});
    svc._legacy_order = services.length; services.push(svc);
  }
  ledger('services[]', 'entities[].services[]', 'one entity-owned service per legacy service: entity_id/action_id added; fields regrouped into presentation / pricing / intake / tags; intake_chain -> intake.steps (resolved order, depends_on)', services.length);

  // ---- dynamic services -> default compositions ----
  const compositions = [];
  for (const [key, d] of Object.entries(A.dynamic_services)) {
    const parts = key.split('+'); const cat = 'cat.' + parts[0], grp = parts.length === 3 ? 'grp.' + parts[1] : null, type = parts[parts.length - 1];
    const ent = grp ? groupHead.get(grp) : categoryGeneric.get(cat);
    const ownerSlug = slug((grp ? grp.slice(4) : cat.slice(4)) + '_' + type);
    const steps = buildIntake(d.intake_chain, 'cmp_' + ownerSlug, ent, 'dynamic ' + key);
    const known = new Set(['financial_engine', 'operational_metrics', 'default_estimate', 'intake_chain', 'suggested_tags', 'confidence_strategy', 'merge_strategy', 'remote_deep_dive_modules', 'smart_tags']);
    const notes = {}; for (const k of Object.keys(d)) if (!known.has(k)) { if (k.startsWith('_')) notes[k] = d[k]; else unresolved('dynamic service field with no mapping', `${key}: ${k}`); }
    const fe = clone(d.financial_engine); if (fe.checkout_state !== undefined) fe.checkout_state = 'chk.' + fe.checkout_state; if (fe.formula_ref !== undefined) fe.formula_ref = 'fml.' + fe.formula_ref; if (fe.pricing_archetype !== undefined) fe.pricing_archetype = 'par.' + fe.pricing_archetype;
    const cmp = { id: 'cmp.' + (grp ? grp.slice(4) : cat.slice(4)) + '.' + type.toLowerCase(), entity_id: ent, action_id: S.act.f(type), modifier_ids: [], category_id: cat, group_id: grp,
      pricing: { financial_engine: fe, operational_metrics: clone(d.operational_metrics), default_estimate: clone(d.default_estimate) }, intake: { steps } };
    if (d.suggested_tags !== undefined) cmp.suggested_tag_ids = d.suggested_tags.map(S.tag_ref.f);
    if (d.smart_tags !== undefined) cmp.smart_tag_ids = d.smart_tags.map(S.tag_ref.f);
    const gid = grp ? grp.slice(4) : null;
    const pol = buildPolicy(d.confidence_strategy, gid || (Object.values(A.group).find(g => g.category_id === parts[0]) || {}).id, 'dynamic ' + key);
    cmp.confidence_policy = pol.policy; cmp.runtime_compat = { confidence_strategy: pol.compat, merge_strategy: d.merge_strategy };
    cmp.recovery_affordances = { source: 'current_open_uncertainty', deep_dive_question_ids: (d.remote_deep_dive_modules || []).map(m => 'q.' + m), when_no_path: { route: 'diagnostic', checkout_state_id: 'chk.diagnostic' } };
    if (d.remote_deep_dive_modules === undefined) cmp.recovery_affordances.deep_dive_declared = false;
    for (const m of d.remote_deep_dive_modules || []) use('q.' + m, ent);
    if (Object.keys(notes).length) cmp.notes = notes;
    compositions.push(cmp);
  }
  ledger('dynamic_services.<category[+group]+Type>', 'entities[].default_compositions[]', 'keyed object -> composition cmp.<group|category>.<action> on the group head / generic entity (entity, action, no modifiers); fields regrouped; merge_strategy kept in runtime_compat', compositions.length);
  { const seen = new Set(); for (const c of compositions) { if (seen.has(c.id)) unresolved('duplicate composition id', c.id); seen.add(c.id); } }

  // ================================================================ scope + placement ======================================================================================
  // Questions referenced by something other than a chain still have users: group/category default lists inject them into chains at run time, actions require them.
  const defaultsUsers = new Set();
  const gd = (A.global_rules.intake_defaults && A.global_rules.intake_defaults.group_defaults) || {}, cd = (A.global_rules.intake_defaults && A.global_rules.intake_defaults.category_defaults) || {};
  for (const l of Object.values(gd)) l.forEach(m => defaultsUsers.add('q.' + m)); for (const l of Object.values(cd)) l.forEach(m => defaultsUsers.add('q.' + m));
  const actionRequired = new Set(); actions.forEach(a => (a.required_intake_modules || []).forEach(q => actionRequired.add(q)));
  const contexts = new Map();
  const ctxFor = (id, label, description) => { if (!contexts.has(id)) contexts.set(id, { id, label, description }); return id; };
  const shared = []; const nestedCount = { entity: 0, shared: 0, context: 0, unused: 0 };
  const entityCounts = [];
  const instanceUsers = new Map(); for (const [qid, q] of questions) if (q.instance_of) for (const e of usage.get(qid) || []) { if (!instanceUsers.has(q.instance_of)) instanceUsers.set(q.instance_of, new Set()); instanceUsers.get(q.instance_of).add(e); }
  for (const [qid, q] of questions) {
    if (q.instance_of) {
      const owner = [...(usage.get(qid) || [])]; q.entity_scope = owner.length === 1 ? owner : (() => { unresolved('instance question without a single owner', qid); return owner; })();
      entities.get(owner[0]).questions.push(q); nestedCount.entity++; continue;
    }
    // a template question (one that is instantiated per service) is asked by every entity that asks one of its instances
    const users = [...new Set([...(usage.get(qid) || []), ...(instanceUsers.get(qid) || [])])].sort(); entityCounts.push(users.length);
    if (users.length === 0) {
      if (defaultsUsers.has(qid)) { q.entity_scope = { context: ctxFor('ctx.default_intake', 'Injected by group and category defaults', 'Questions that global_rules.intake_defaults adds to the chains of every service in a group or category; they belong to no one entity.') }; }
      else if (actionRequired.has(qid)) { q.entity_scope = { context: ctxFor('ctx.action_required', 'Required by an action', 'Questions an action (service type) requires of every service of that type.') }; }
      else { q.entity_scope = { context: ctxFor('ctx.unreferenced', 'Asked by no service or default today', 'Authored questions that no chain, deep-dive question, default list or action asks; kept, not deleted. Their entity scope is an Operator decision.') }; }
      nestedCount.unused++; shared.push(q); continue;
    }
    if (users.length >= CONTEXT_MIN_ENTITIES) { q.entity_scope = { context: ctxFor('ctx.' + qid.slice(2), titleCase(qid.slice(2)), `Asked by ${users.length} entities; it describes the job's circumstances (${q.purpose}), not any one of them.`) }; nestedCount.context++; shared.push(q); continue; }
    q.entity_scope = users;
    if (users.length === 1) { entities.get(users[0]).questions.push(q); nestedCount.entity++; } else { shared.push(q); nestedCount.shared++; }
  }
  report.counts.questionPlacement = nestedCount; report.counts.questionEntityCountHistogram = entityCounts.reduce((h, n) => (h[n] = (h[n] || 0) + 1, h), {});
  note('scope', `A question asked by at least ${CONTEXT_MIN_ENTITIES} distinct entities is given an explicit context scope (${nestedCount.context} questions); fewer than that, its scope is the exact set of entities that ask it. Questions no chain asks are scoped by who references them (defaults, actions) or declared unreferenced (${nestedCount.unused}).`, { default: 'as migrated' });

  // ---- option effects that depend on the steps: an option that opens another question affects the branch ----
  const opensBranch = new Set();
  const walkDeps = list => { for (const t of list) { if (t.any_of) t.any_of.forEach(p => opensBranch.add(p.question_id + '#' + p.option_id)); else opensBranch.add(t.question_id + '#' + t.option_id); } };
  for (const s of services) s.intake.steps.forEach(st => walkDeps(st.depends_on)); for (const c of compositions) c.intake.steps.forEach(st => walkDeps(st.depends_on)); for (const q of questions.values()) walkDeps(q.depends_on);
  for (const q of questions.values()) for (const o of q.options || []) if (opensBranch.has(q.id + '#' + o.id) && !o.affects.includes('branch')) o.affects = AFFECT_ORDER.filter(a => a === 'branch' || o.affects.includes(a));

  // ================================================================ uncertainty ============================================================================================
  const classOf = new Map(); // qid -> class
  const sharedClasses = [];
  const ownerOfQuestion = new Map(); for (const e of entities.values()) for (const q of e.questions) ownerOfQuestion.set(q.id, e);
  let unknownOptionTotal = 0, questionsAllUnknown = 0;
  for (const [qid, q] of questions) {
    const opts = effectiveOptions(qid) || [];
    const base = q.instance_of ? questions.get(q.instance_of) : q;
    const retiring = opts.filter(o => o.evidence !== 'unknown'); unknownOptionTotal += opts.length - retiring.length;
    const c = { id: 'u.' + qid.slice(2), label: (q.prompt_override || base.prompt || '').replace('{item_noun}', q.item_noun || 'items') };
    c.retired_by = base.type === 'numeric_multiplier' ? [{ question_id: qid, any_value: true }] : [{ question_id: qid, option_ids: retiring.map(o => o.id) }];
    if (base.type !== 'numeric_multiplier' && retiring.length === 0) questionsAllUnknown++;
    const gain = gainOf.get(q.instance_of || qid); if (gain !== undefined) { c.default_weight = gain; c.weight_basis = 'seeded_from_confidence_gain'; } else c.weight_basis = 'unauthored'; // no legacy confidence_gain: a gap, recorded as one, never a default
    classOf.set(qid, c);
    const owner = ownerOfQuestion.get(qid); if (owner) owner.uncertainty_classes.push(c); else sharedClasses.push(c);
  }
  report.counts.unknownOptions = unknownOptionTotal; report.counts.questionsAllUnknown = questionsAllUnknown;
  const fillProfile = o => {
    const prof = []; const seen = new Set();
    for (const st of o.intake.steps) { const c = classOf.get(st.question_id); if (!c || seen.has(c.id)) continue; seen.add(c.id); if (c.default_weight > 0) prof.push({ class_id: c.id, weight: c.default_weight }); }
    o.uncertainty_profile = prof;
    if (prof.length === 0) o.confidence_gate = { mode: 'none', reason: o.intake.steps.length === 0 ? 'the service asks no question' : 'none of the questions it asks carries an authored confidence weight' };
    else o.confidence_gate = { mode: 'weighted_uncertainty', basis: 'seeded_from_confidence_gain' };
  };
  services.forEach(fillProfile); compositions.forEach(fillProfile);
  // Two curated services at one (entity, action, modifiers) point cannot be told apart by the composer. The modifier or entity that separates them is a business decision (nothing in the legacy file
  // says "hidden cables" is a modifier of a TV mount rather than a different service), so the gap is declared on each of them, not resolved by a guess.
  { const at = new Map(); for (const sv of services) { const k = [sv.entity_id, sv.action_id, sv.modifier_ids.join(',')].join('|'); if (!at.has(k)) at.set(k, []); at.get(k).push(sv); }
    report.counts.ambiguousCompositionPoints = 0; report.counts.servicesInAmbiguousPoints = 0;
    for (const list of at.values()) if (list.length > 1) { report.counts.ambiguousCompositionPoints++; for (const sv of list) { report.counts.servicesInAmbiguousPoints++; sv.decomposition = { status: 'open', note: `shares entity ${sv.entity_id} and action ${sv.action_id} with ${list.filter(x => x !== sv).map(x => x.id).join(', ')}; which modifier or entity separates them is an open business decision (PENDING_DECISIONS #209)` }; } } }
  report.counts.gateNone = services.filter(s => s.confidence_gate.mode === 'none').length + compositions.filter(s => s.confidence_gate.mode === 'none').length;
  // hand services and compositions to their entities
  services.sort((a, b) => a._legacy_order - b._legacy_order); services.forEach(s => { delete s._legacy_order; entities.get(s.entity_id).services.push(s); });
  compositions.forEach(c => entities.get(c.entity_id).default_compositions.push(c));

  // quantify the legacy confidence bars that no answer sequence could clear (design note 8.3)
  { let unreachable = 0; const rows = [];
    for (const s of A.services) { const cs = s.confidence_strategy; const eff = (cs.minimum_quote_confidence !== undefined ? cs.minimum_quote_confidence : 80); const W = lib.resolveChain(s.intake_chain).reduce((n, r) => n + (mods[r.module] && mods[r.module].confidence_gain || 0), 0);
      if (W > 0 && cs.base_confidence + W < eff) { unreachable++; rows.push(s.id); } }
    report.counts.legacyBarsUnreachable = unreachable; report.legacyUnreachableServices = rows; }

  // ================================================================ tags: answers ==========================================================================================
  for (const t of tags) {
    if (!t.answers) continue; if (!Object.keys(t.answers).length) { t.answers = []; continue; }
    t.answers = Object.entries(t.answers).map(([mk, label]) => ({ question_id: 'q.' + mk, option_id: optionId('q.' + mk, label) }));
  }
  ledger('smart_tags.<#tag>', 'registries.tags[]', 'keyed object -> array with id tag.<name>; answers {module: label} -> [{question_id, option_id}]; requires/mutually_exclusive/scoping normalised', tags.length);

  // ================================================================ formulas: label-keyed and service-keyed tables =========================================================
  for (const f of formulas) {
    if (f.issue_type_fees) {
      const labels = Object.keys(f.issue_type_fees); const qids = [...questions.keys()].filter(q => !questions.get(q).instance_of && labels.every(l => optIds.get(q) && optIds.get(q).has(l)));
      if (qids.length !== 1) unresolved('issue_type_fees keys do not identify one question', `${f.id}: ${qids.join(',')}`);
      else f.issue_type_fees = Object.entries(f.issue_type_fees).map(([label, v]) => Object.assign({ question_id: qids[0], option_id: optionId(qids[0], label) }, v.modifier_ref !== undefined ? { modifier_id: 'mod.' + v.modifier_ref } : {}, Object.fromEntries(Object.entries(v).filter(([k]) => k !== 'modifier_ref'))));
    }
    if (f.anchor_and_overflow_ref_by_service) f.anchor_and_overflow_ref_by_service = Object.entries(f.anchor_and_overflow_ref_by_service).map(([sid, v]) => Object.assign({ service_id: 'svc.' + sid }, Object.fromEntries(Object.entries(v).map(([k, x]) => [k === 'overflow_rate_ref' ? 'overflow_modifier_id' : k, k === 'overflow_rate_ref' ? 'mod.' + x : x]))));
  }

  // ================================================================ picker (the curated part of routing_archetypes) ========================================================
  const symptomOptionToTile = (g, ra) => null;
  for (const g of groups) {
    const gid = g.id.slice(4); const ra = RA[gid]; if (!ra) { unresolved('group has no routing_archetypes entry', gid); continue; }
    const picker = { entry_mode: ra.routing_archetype, component_entity_ids: (ra.real_component_ids || []).map(c => 'ent.' + c.slice(5)) };
    // the curated component -> service map is the picker's, verbatim: a service has ONE owning entity (service.entity_id), and which services the picker lists under which component is presentation curation that
    // ownership does not imply (symptom-routed services are owned by the component but not listed under it; a component can list a service another entity owns)
    picker.component_links = Object.entries(ra.component_id_to_service_ids || {}).filter(([, ss]) => ss.length).map(([c, ss]) => ({ entity_id: 'ent.' + c.slice(5), service_ids: [...ss].sort().map(x => 'svc.' + x) })).sort((x, y) => (x.entity_id < y.entity_id ? -1 : 1));
    if (ra.symptom_module) picker.symptom_question_id = 'q.' + ra.symptom_module;
    if (ra.ask_action_first !== undefined) picker.ask_action_first = ra.ask_action_first;
    if (ra.symptom_prompt !== undefined) picker.symptom_prompt = ra.symptom_prompt;
    if (ra.symptom_tiles !== undefined) picker.symptom_tiles = ra.symptom_tiles.map(t => Object.assign({}, t, t.tags ? { tag_ids: t.tags.map(S.tag_hash.f) } : {}, { tags: undefined }));
    if (ra.known_need_prompt !== undefined) picker.known_need_prompt = ra.known_need_prompt;
    if (ra.known_need_tiles !== undefined) picker.known_need_tiles = ra.known_need_tiles.map(t => Object.assign({}, t, { service_id: 'svc.' + t.service_id }));
    picker.real_gaps = clone(ra.real_gaps || []);
    if (!ra.symptom_module && (ra.real_symptom_ids || []).length) picker.symptoms = ra.real_symptom_ids.map(sid => ({ id: sid, service_ids: (ra.symptom_id_to_service_ids[sid] || []).map(x => 'svc.' + x) }));
    // display_name / category_id in routing_archetypes duplicate the group's own; a mismatch would be a finding
    if (ra.display_name !== g.display_name) report.findings.push({ what: 'routing_archetypes display_name differs from group display_name', detail: `${gid}: ${ra.display_name} / ${g.display_name}` });
    if (ra.category_id !== g.category_id.slice(4)) report.findings.push({ what: 'routing_archetypes category_id differs from group category_id', detail: gid });
    { // curated union the compiler preserves; not equal to the group's dynamic_service_types. One legacy value is spelled as an id already ("act.repair" beside "Repair"): normalised, declared.
      const ids = [];
      for (const v of ra.real_action_ids || []) {
        let id; if (typeof v === 'string' && ctx.actionLabel.has(v)) { id = v; report.findings.push({ what: 'legacy real_action_ids holds an action spelled as an id, beside its label spelling', detail: `${gid}: "${v}" (declared normalisation: one action, one spelling)` }); } else id = S.act.f(v);
        if (!ids.includes(id)) ids.push(id);
      }
      picker.action_ids = ids;
    }
    g.picker = picker;
  }
  ledger('routing_archetypes.<group> (curated part)', 'registries.groups[].picker', 'entry_mode (was routing_archetype), symptom_question_id (was symptom_module), prompts and tiles, real_gaps, component_links (curated component -> service map, verbatim), symptoms with no intake question; symptom links of groups with a symptom_question_id are compiled from that question', groups.length);

  // ================================================================ carried sections =======================================================================================
  const globalRules = clone(A.global_rules); delete globalRules.modifiers; refs.forward(globalRules, refs.RULES.global_rules, ctx, counter);
  const uiConfig = clone(A.ui_config); refs.forward(uiConfig, refs.RULES.ui_config, ctx, counter);
  const nlpObjects = clone(A.intent_mappings.objects); refs.forward(nlpObjects, refs.RULES.nlp_objects, ctx, counter);
  const nlpFallback = clone(A.intent_mappings.default_fallback); refs.forward(nlpFallback, refs.RULES.nlp_default_fallback, ctx, counter);
  for (const k of Object.keys(A.intent_mappings)) if (!['objects', 'default_fallback'].includes(k)) unresolved('intent_mappings key with no mapping', k);
  ledger('intent_mappings.objects[]', 'vocabulary.nlp_objects[]', 'carried; category/type/service/tag/formula references normalised', nlpObjects.length);
  ledger('intent_mappings.default_fallback', 'vocabulary.nlp_default_fallback', 'carried; references normalised', 1);
  for (const k of Object.keys(A)) if (![ '$schema', '$id', 'meta', 'workflow', 'invariants', 'global_rules', 'category', 'group', 'services', 'service_types', 'dynamic_services', 'intake_modules', 'pricing_formulas', 'materials_catalog', 'furniture_catalog', 'smart_tags', 'checkout_states', 'ui_config', 'adlib_phrase_overrides', 'negation_library', 'intent_mappings', 'archetypes', 'routing_archetypes'].includes(k)) unresolved('top-level key with no mapping', k);

  // ================================================================ assemble ===============================================================================================
  const entityList = [...entities.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const e of entityList) {
    if (e.kind === 'generic_group' || e.kind === 'generic_category') { /* keep */ }
    e.questions.sort((a, b) => (a.id < b.id ? -1 : 1)); e.uncertainty_classes.sort((a, b) => (a.id < b.id ? -1 : 1));
  }
  shared.sort((a, b) => (a.id < b.id ? -1 : 1)); sharedClasses.sort((a, b) => (a.id < b.id ? -1 : 1));
  const source = {
    $schema: '../schema/btnyc-source.schema.json',
    source_schema_version: lib.SOURCE_SCHEMA_VERSION,
    meta: clone(A.meta),
    legacy_envelope: { $schema: A.$schema, $id: A.$id, top_level_order: Object.keys(L).filter(k => !lib.COMPILER_KEYS.includes(k) || k === 'routing_archetypes') },
    provenance: { migrated_from: 'btnyc.json', migration: 'test_harness/tools/entity_first/migrate_legacy.js', design: 'ssot/ENTITY_FIRST_DESIGN_NOTE.md', ticket: 'T175' },
    registries: { categories, groups, actions, modifiers, tags, materials, furniture, checkout_states: checkoutStates, pricing_formulas: formulas, behavioral_classes: classes, contexts: [...contexts.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)), // by id, not by first use: the registry's order must not depend on the order the legacy file happened to list its modules in
      pricing_archetypes: Object.keys(L.pricing_archetypes || {}).map(k => ({ id: 'par.' + k })), service_order: A.services.map(s => 'svc.' + s.id) },
    entities: entityList,
    shared_questions: shared,
    shared_uncertainty_classes: sharedClasses,
    policy: { workflow: clone(A.workflow), invariants: clone(A.invariants), global_rules: globalRules, ui_config: uiConfig },
    vocabulary: { negation_library: clone(A.negation_library), adlib_phrase_overrides: clone(A.adlib_phrase_overrides), nlp_objects: nlpObjects, nlp_default_fallback: nlpFallback },
  };
  // the original, authored chains and branch maps, verbatim, for the record (design note 7.5)

  // counts
  const allOptions = [...questions.values()].reduce((n, q) => n + (q.options ? q.options.length : 0), 0);
  report.counts.entities = entityList.length; report.counts.entityKinds = entityList.reduce((h, e) => (h[e.kind] = (h[e.kind] || 0) + 1, h), {});
  report.counts.questions = questions.size; report.counts.instanceQuestions = instances.length; report.counts.options = allOptions; report.counts.services = services.length; report.counts.compositions = compositions.length;
  report.counts.uncertaintyClasses = classOf.size; report.counts.gated = services.length + compositions.length - report.counts.gateNone; report.counts.refsNormalised = refCount;
  report.counts.optionsWithEffects = [...questions.values()].reduce((n, q) => n + (q.options || []).filter(o => o.affects.length).length, 0);
  report.ctx = ctx;
  return { source, report };
}

function main() {
  const args = process.argv.slice(2); const write = args.includes('--write');
  const L = lib.readJson(lib.PATHS.legacy);
  const { source, report } = migrate(L);
  console.log('migrated:', JSON.stringify(report.counts, null, 1));
  console.log('unresolved:', report.unresolved.length); report.unresolved.slice(0, 30).forEach(u => console.log('  -', u.what, '|', u.detail));
  console.log('findings:', report.findings.length); report.findings.slice(0, 20).forEach(u => console.log('  -', u.what, '|', u.detail));
  if (write) {
    // The source is authoritative (ssot/TRANSITION_DUALSOURCE.md). Once anyone has edited it, re-running the migration would silently overwrite the edit with what btnyc.json can express.
    // So --write replaces the source only if it is exactly what the last migration wrote (recorded in ssot/migration/last_migration.json), or the migration would write the same text, or the caller says
    // --overwrite-authored. A source with no recorded history is not overwritten either.
    const text = lib.toText(source); const outSha = lib.sha(text);
    if (fs.existsSync(lib.PATHS.source)) {
      const existing = fs.readFileSync(lib.PATHS.source, 'utf8'); const mark = fs.existsSync(lib.PATHS.lastMigration) ? lib.readJson(lib.PATHS.lastMigration) : null;
      if (existing !== text && !args.includes('--overwrite-authored') && !(mark && mark.output_sha256 === lib.sha(existing))) {
        console.error('REFUSED: ssot/btnyc_source.json is not what the last migration wrote (it has been edited since, or its history is not recorded). Writing the migration would discard those edits.\n' +
          'The source is authoritative. Carry a change in btnyc.json into the source by hand, or pass --overwrite-authored if the source edits are to be thrown away.'); return 3;
      }
    }
    lib.writeIfChanged(lib.PATHS.source, text);
    lib.writeIfChanged(lib.PATHS.lastMigration, lib.toText({ note: 'written by migrate_legacy.js --write; the sha of the source it last wrote, so a later --write can tell an edited source from an unedited one. Never edit by hand.', output_sha256: outSha, legacy_authored_sha256: lib.sha(JSON.stringify(lib.authoredLegacy(L))) }));
    console.log('wrote', lib.PATHS.source);
  }
  return report.unresolved.length ? 1 : 0;
}
if (require.main === module) process.exit(main());
module.exports = { migrate };
