#!/usr/bin/env node
/**
 * verify_charter_carry.js -- the live btnyc.json carries every field the Charter requires, authored from the source, and a missing or wrong one is found (T181).
 *
 * @enforces R-SYSTEM-IDENTITY
 * @enforces R-COMPLEX-AXES
 * @enforces R-INVARIANT-DERIVATION
 * @enforces R-INVARIANT-PROVENANCE
 *
 * The Operator's request (2026-10-17 00:15 NY): "get [btnyc.json] fully committed and authored fully so it's got all required fields, authored data and consistent with the Charter requirements".
 * The Charter names btnyc.json the derived runtime artifact and says what a record carries. This holds the file to each of the seven obligations, measured on the file the site loads and not on the
 * source it came from, and shows each check able to fail on a counterfactual:
 *
 *   1. UNCERTAINTY  every service and composition has an uncertainty_profile whose classes exist, each class says which answers retire it, thresholds are on one explicit 0-1 scale and ordered, and the
 *                   few services with no profile are exactly the declared ones (confidence_gate mode "none", with a reason).
 *   2. IDS          every entity, question, option, service, composition, uncertainty class, action, modifier, context, tag, material, furniture item, formula, checkout state, category, group and
 *                   behavioral class has a stable typed id, unique, and the set in the file equals the set in the frozen id register (ssot/migration/id_register.json), kind by kind.
 *   3. ENTITY SCOPE every question names the entity (or, for a shared question, the context) it is about, and it exists.
 *   4. AFFECTS      every option declares what it changes, from a closed vocabulary, and every mechanism an answer actually carries (a fee, minutes, a tier, a route, a checkout state, a tag, a quantity)
 *                   is declared.
 *   5. DEPENDS_ON   every question has depends_on as [{question_id, option_id}] pairs that resolve; the runtime reads them through two pure translators, which agree with each other and with the legacy
 *                   {module key: label} spelling on every module, and a chain resolved from the pairs shows the same questions as one resolved from the legacy spelling.
 *   6. RECOVERY     every service and composition declares what is offered when no path remains, and where it routes resolves.
 *   7. ENTITY/ACTION/MODIFIERS  every service resolves to an entity that owns it, an action whose label is its service type, and modifiers that exist.
 *   + R-COMPLEX-AXES: every service declares the three complexity axes with legal values.
 * Provenance: $source names the source and its hash; carry_charter.js --check is clean; carrying the stripped file gives back this file (the carry is a function of the source alone).
 * The schema the site validates against (schema/btnyc_schema.json) REQUIRES all of it, in the page's own checker and in ajv, and refuses the legacy depends_on spelling.
 *
 * Node only; no browser, no network.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), zlib = require('zlib');
const ROOT = path.resolve(__dirname, '..');
const lib = require('./tools/entity_first/lib.js');
const C = require('./tools/entity_first/carry_charter.js');
let passed = 0, failed = 0;
const check = (label, ok, detail) => { if (ok) { passed++; console.log('  ✓ ' + label); } else { failed++; console.log('  ✗ ' + label + (detail ? ' -- ' + detail : '')); } };
const clone = o => JSON.parse(JSON.stringify(o));
const DBTEXT = fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'), DB = JSON.parse(DBTEXT);
const SRCTEXT = fs.readFileSync(path.join(ROOT, 'ssot', 'btnyc_source.json'), 'utf8'), SRC = JSON.parse(SRCTEXT);
const REG = JSON.parse(fs.readFileSync(path.join(ROOT, 'ssot', 'migration', 'id_register.json'), 'utf8')).ids;

const AFFECTS = new Set(['complexity', 'price', 'minutes', 'branch', 'tags', 'checkout_state', 'quantity', 'materials', 'prep']);
// the services/compositions the source declares as having no uncertainty profile (confidence_gate mode "none"): five curated services and one composition (see ssot/COVERAGE_REPORT.md,
// uncertainty_weight_unauthored). A new one is a business fact to author, not a thing to pin here.
const NO_PROFILE = { services: ['data_backup_or_transfer', 'dishwasher_install', 'microwave_setup', 'refrigerator_install', 'washer_install'], dynamic: ['tech_trouble+tech_trouble_cable_management+Diagnostic'] };

// ---- the audit: findings for any btnyc.json-shaped object (so a counterfactual can be handed to the same function) -----------------------------------------------------------------------
function audit(db, srcSha) {
  const out = []; const bad = (code, msg) => out.push(code + ': ' + msg);
  const members = (o, keys, where, code) => { for (const k of keys) if (o[k] === undefined) bad(code, `${where} has no ${k}`); };
  const unique = (list, what, code) => { const seen = new Set(); for (const x of list) { if (seen.has(x)) bad(code, `${what} ${x} appears twice`); seen.add(x); } };
  for (const k of C.TOP_KEYS) if (db[k] === undefined) bad('SECTION', `the file has no ${k}`);
  const src = db.$source || {};
  if (srcSha && src.sha256 !== srcSha) bad('PROVENANCE', `$source.sha256 is not the hash of ssot/btnyc_source.json as it is now`);
  if (src.path !== 'ssot/btnyc_source.json') bad('PROVENANCE', `$source.path is ${JSON.stringify(src.path)}`);
  const entities = db.entities || [], classes = entities.flatMap(e => e.uncertainty_classes || []).concat(db.shared_uncertainty_classes || []);
  const entIds = new Set(entities.map(e => e.id)), ctxIds = new Set((db.contexts || []).map(c => c.id)), actIds = new Map((db.actions || []).map(a => [a.id, a.label])), modIds = new Set((db.modifiers || []).map(m => m.id));
  const classIds = new Set(classes.map(c => c.id));
  unique(entities.map(e => e.id), 'entity', 'ID'); unique(classes.map(c => c.id), 'uncertainty class', 'ID'); unique((db.actions || []).map(a => a.id), 'action', 'ID'); unique((db.modifiers || []).map(m => m.id), 'modifier', 'ID'); unique((db.contexts || []).map(c => c.id), 'context', 'ID');
  for (const e of entities) { if (!/^ent\./.test(e.id || '')) bad('ID', `entity id ${e.id}`); members(e, ['label', 'kind', 'aliases', 'question_ids', 'service_ids', 'composition_ids', 'uncertainty_classes'], 'entity ' + e.id, 'ENTITY'); }
  // questions: modules and the instance questions inside chain params
  const Q = []; // { id, where, scope, depends_on, options, key }
  for (const [key, m] of Object.entries(db.intake_modules || {})) Q.push({ id: m.id, where: `intake_modules.${key}`, key, scope: m.entity_scope, depends_on: m.depends_on, options: m.client_response, module: true });
  const chains = [...(db.services || []).map(s => ['services.' + s.id, s.intake_chain]), ...Object.entries(db.dynamic_services || {}).map(([k, d]) => ['dynamic_services.' + k, d.intake_chain])];
  for (const [at, ch] of chains) (ch || []).forEach((st, j) => { if (st.params) { const own = st.params.client_response, tpl = (db.intake_modules[st.module] || {}).client_response; Q.push({ id: st.params.id, where: `${at}.intake_chain[${j}].params`, key: st.module + '::' + st.params.item_noun, scope: st.params.entity_scope, depends_on: st.params.depends_on, options: own || tpl || [], inherited: !own, module: false }); } });
  const qById = new Map(); for (const q of Q) if (q.id !== undefined) qById.set(q.id, q);
  unique(Q.map(q => q.id).filter(Boolean), 'question', 'ID');
  for (const q of Q) {
    if (typeof q.id !== 'string' || !/^q\./.test(q.id)) { bad('ID', `${q.where} has no question id (${JSON.stringify(q.id)})`); continue; }
    if (q.module && q.id !== 'q.' + q.key) bad('ID', `${q.where}.id is ${q.id}, not q.${q.key}`);
    const sc = q.scope;
    if (sc === undefined) bad('SCOPE', `${q.where} has no entity_scope`);
    else if (Array.isArray(sc)) { if (!sc.length) bad('SCOPE', `${q.where}.entity_scope is empty`); for (const t of sc) if (!entIds.has(t)) bad('SCOPE', `${q.where}.entity_scope names ${t}, which is no entity`); }
    else if (sc && typeof sc === 'object' && typeof sc.context === 'string') { if (!ctxIds.has(sc.context)) bad('SCOPE', `${q.where}.entity_scope names the context ${sc.context}, which does not exist`); }
    else bad('SCOPE', `${q.where}.entity_scope is neither an entity list nor a {context}`);
    if (!Array.isArray(q.depends_on)) bad('DEPENDS', `${q.where}.depends_on is not an array of pairs (${JSON.stringify(q.depends_on)})`);
    const ids = []; for (const [i, o] of (q.inherited ? [] : q.options || []).entries()) {
      if (typeof o.id !== 'string' || !o.id) { bad('ID', `${q.where} option ${i} (${JSON.stringify(o.label)}) has no id`); continue; }
      ids.push(o.id);
      if (!Array.isArray(o.affects)) bad('AFFECTS', `${q.where} option ${o.id} declares no affects`); else for (const a of o.affects) if (!AFFECTS.has(a)) bad('AFFECTS', `${q.where} option ${o.id} affects ${JSON.stringify(a)}, which is not in the vocabulary`);
    }
    unique(ids, `${q.where} option id`, 'ID');
  }
  for (const q of Q) for (const p of Array.isArray(q.depends_on) ? q.depends_on : []) {
    const t = qById.get(p && p.question_id);
    if (!t) bad('DEPENDS', `${q.where} depends on ${p && p.question_id}, which is no question`);
    else if (!(t.options || []).some(o => o.id === p.option_id)) bad('DEPENDS', `${q.where} depends on ${p.question_id}#${p.option_id}, which that question does not offer`);
  }
  // affects is not decoration: every mechanism an answer carries is declared
  const mods = (db.global_rules || {}).modifiers || {};
  for (const q of Q) for (const o of q.inherited ? [] : q.options || []) {
    const a = o.affects || [], m = o.modifier_ref && mods[o.modifier_ref], at = `${q.where} option ${o.id}`;
    if (m && m.fee > 0 && !a.includes('price')) bad('AFFECTS', `${at} carries a fee and does not declare price`);
    if (m && m.minutes > 0 && !a.includes('minutes')) bad('AFFECTS', `${at} carries minutes and does not declare minutes`);
    if (o.complexity_override && !a.includes('complexity')) bad('AFFECTS', `${at} carries a complexity tier and does not declare complexity`);
    if (o.route_to && !a.includes('branch')) bad('AFFECTS', `${at} routes the job and does not declare branch`);
    if (o.checkout_state_override && !a.includes('checkout_state')) bad('AFFECTS', `${at} sets a checkout state and does not declare checkout_state`);
    if ((o.tags || []).length && !a.includes('tags')) bad('AFFECTS', `${at} sets tags and does not declare tags`);
    if (o.qty_value !== undefined && !a.includes('quantity')) bad('AFFECTS', `${at} sets a quantity and does not declare quantity`);
  }
  // uncertainty classes
  for (const c of classes) {
    if (!/^u\./.test(c.id || '')) bad('ID', `uncertainty class id ${c.id}`);
    if (!Array.isArray(c.retired_by) || !c.retired_by.length) bad('UNCERTAINTY', `class ${c.id} says nothing about what retires it`);
    for (const r of c.retired_by || []) {
      const t = qById.get(r.question_id);
      if (!t) bad('UNCERTAINTY', `class ${c.id} is retired by ${r.question_id}, which is no question`);
      else if (!r.any_value) { if (!(r.option_ids || []).length) bad('UNCERTAINTY', `class ${c.id} names no answer that retires it`); for (const oid of r.option_ids || []) if (!(t.options || []).some(o => o.id === oid)) bad('UNCERTAINTY', `class ${c.id} is retired by ${r.question_id}#${oid}, which that question does not offer`); }
    }
  }
  // entities own what they say they own
  const svcByCharter = new Map((db.services || []).map(s => [s.charter_id, s])), cmpByCharter = new Map(Object.entries(db.dynamic_services || {}).map(([k, d]) => [d.charter_id, [k, d]]));
  for (const e of entities) {
    for (const id of e.question_ids || []) if (!qById.has(id)) bad('ENTITY', `${e.id} owns the question ${id}, which the file does not have`);
    for (const id of e.service_ids || []) { const s = svcByCharter.get(id); if (!s) bad('ENTITY', `${e.id} owns ${id}, which is no service`); else if (s.entity_id !== e.id) bad('ENTITY', `${id} is owned by ${e.id} but says ${s.entity_id}`); }
    for (const id of e.composition_ids || []) { const c = cmpByCharter.get(id); if (!c) bad('ENTITY', `${e.id} owns ${id}, which is no composition`); else if (c[1].entity_id !== e.id) bad('ENTITY', `${id} is owned by ${e.id} but says ${c[1].entity_id}`); }
    for (const c of e.uncertainty_classes || []) if (!classIds.has(c.id)) bad('UNCERTAINTY', `${e.id} lists the class ${c.id}`);
  }
  // services and compositions
  const chk = new Set(Object.values(db.checkout_states || {}).map(c => c.id));
  const recs = [...(db.services || []).map(s => ({ kind: 'service', key: s.id, r: s })), ...Object.entries(db.dynamic_services || {}).map(([k, d]) => ({ kind: 'composition', key: k, r: d }))];
  const need = ['charter_id', 'entity_id', 'action_id', 'modifier_ids', 'uncertainty_profile', 'confidence_policy', 'confidence_gate', 'recovery_affordances'];
  unique(recs.map(x => x.r.charter_id), 'service/composition id', 'ID');
  for (const { kind, key, r } of recs) {
    const at = `${kind} ${key}`; members(r, need, at, 'SERVICE');
    if (kind === 'service' && !r.complexity_profile) bad('COMPLEXITY', `${at} declares no complexity_profile`);
    if (kind === 'service' && r.charter_id !== 'svc.' + r.id) bad('ID', `${at}.charter_id is ${r.charter_id}`);
    if (kind === 'composition' && !/^cmp\./.test(r.charter_id || '')) bad('ID', `${at}.charter_id is ${r.charter_id}`);
    if (r.entity_id !== undefined && !entIds.has(r.entity_id)) bad('ENTITY', `${at}.entity_id ${r.entity_id} is no entity`);
    if (r.action_id !== undefined && !actIds.has(r.action_id)) bad('ACTION', `${at}.action_id ${r.action_id} is no action`);
    else if (r.action_id !== undefined) { const label = kind === 'service' ? r.service_type : key.split('+').pop(); if (actIds.get(r.action_id) !== label) bad('ACTION', `${at}.action_id ${r.action_id} is the action "${actIds.get(r.action_id)}", the record says "${label}"`); }
    for (const m of r.modifier_ids || []) if (!modIds.has(m)) bad('MODIFIER', `${at}.modifier_ids names ${m}, which is no modifier`);
    const prof = r.uncertainty_profile || [], gate = r.confidence_gate || {}, pol = r.confidence_policy || {};
    for (const p of prof) { if (!classIds.has(p.class_id)) bad('UNCERTAINTY', `${at} carries the class ${p.class_id}, which does not exist`); if (!(typeof p.weight === 'number' && p.weight > 0)) bad('UNCERTAINTY', `${at} class ${p.class_id} has weight ${p.weight}`); }
    if (gate.mode === 'none') { if (prof.length) bad('UNCERTAINTY', `${at} has gate mode none and a profile`); if (!gate.reason) bad('UNCERTAINTY', `${at} has gate mode none and gives no reason`); }
    else if (gate.mode === 'weighted_uncertainty') { if (!prof.length) bad('UNCERTAINTY', `${at} is weighted and has an empty profile`); if (!gate.basis) bad('UNCERTAINTY', `${at} is weighted and says nothing of the weights' basis`); }
    else bad('UNCERTAINTY', `${at}.confidence_gate.mode is ${JSON.stringify(gate.mode)}`);
    if (pol.scale !== '0-1') bad('SCALE', `${at}.confidence_policy.scale is ${JSON.stringify(pol.scale)}, not "0-1"`);
    const t = [pol.diagnostic_below, pol.range_at, pol.exact_at];
    if (!t.every(x => typeof x === 'number' && x >= 0 && x <= 1)) bad('SCALE', `${at} thresholds ${JSON.stringify(t)} are not all numbers in 0-1`);
    else if (!(t[0] <= t[1] && t[1] <= t[2])) bad('SCALE', `${at} thresholds are not ordered diagnostic_below <= range_at <= exact_at: ${JSON.stringify(t)}`);
    const rec = r.recovery_affordances || {};
    if (rec.source !== 'current_open_uncertainty') bad('RECOVERY', `${at}.recovery_affordances.source is ${JSON.stringify(rec.source)}`);
    if (!rec.when_no_path || !rec.when_no_path.route) bad('RECOVERY', `${at} says nothing of where the job goes when no path remains`);
    else if (!chk.has(rec.when_no_path.checkout_state_id)) bad('RECOVERY', `${at} routes to the checkout state ${rec.when_no_path.checkout_state_id}, which does not exist`);
    for (const q of rec.deep_dive_question_ids || []) if (!qById.has(q)) bad('RECOVERY', `${at} deep-dives into ${q}, which is no question`);
    if (kind === 'service') {
      const cp = r.complexity_profile || {};
      if (!['routine', 'skilled', 'specialized'].includes(cp.tier)) bad('COMPLEXITY', `${at}.complexity_profile.tier is ${JSON.stringify(cp.tier)}`);
      if (!['R0', 'R1', 'R2'].includes(cp.risk_tier)) bad('COMPLEXITY', `${at}.complexity_profile.risk_tier is ${JSON.stringify(cp.risk_tier)}`);
      if (typeof cp.batch_risk_compounds !== 'boolean') bad('COMPLEXITY', `${at}.complexity_profile.batch_risk_compounds is ${JSON.stringify(cp.batch_risk_compounds)}`);
    }
  }
  // registries
  const typed = (section, prefix, keyOf, list) => { const ids = []; for (const [k, rec] of list) { const want = prefix + '.' + keyOf(k, rec); const got = prefix === 'cat' || prefix === 'grp' ? rec.charter_id : rec.id; if (got !== want) bad('ID', `${section} ${JSON.stringify(k)} has id ${JSON.stringify(got)}, expected ${want}`); ids.push(got); } unique(ids, section + ' id', 'ID'); };
  typed('smart_tags', 'tag', k => k.slice(1), Object.entries(db.smart_tags || {})); typed('materials_catalog', 'mat', (k, r) => r.sku, Object.entries(db.materials_catalog || {})); typed('furniture_catalog', 'fur', (k, r) => r.sku.normalize('NFKD').replace(/[\u0300-\u036f]/g, ''), (db.furniture_catalog || []).map((r, i) => [i, r]));
  typed('checkout_states', 'chk', k => k, Object.entries(db.checkout_states || {})); typed('pricing_formulas', 'fml', k => k, Object.entries(db.pricing_formulas || {})); typed('archetypes', 'cls', k => k, Object.entries(db.archetypes || {}));
  typed('category', 'cat', (k, r) => r.id, (db.category || []).map((r, i) => [i, r])); typed('group', 'grp', (k, r) => r.id, (db.group || []).map((r, i) => [i, r]));
  for (const m of db.modifiers || []) { if (m.role === 'condition') { if (mods[m.key]) bad('MODIFIER', `the condition ${m.id} has a fee row`); } else if (!mods[m.key]) bad('MODIFIER', `${m.id} names the fee row ${m.key}, which does not exist`); }
  return out;
}

console.log('verify_charter_carry.js');

console.log('\n1. The live file satisfies the seven obligations (measured on btnyc.json, not on the source)');
const real = audit(DB, lib.sha(SRCTEXT));
check('audit(btnyc.json): no finding in uncertainty, ids, entity scope, affects, depends_on, recovery, entity/action/modifiers, complexity axes, registries or provenance', real.length === 0, real.slice(0, 4).join(' | ') + (real.length > 4 ? ` ... +${real.length - 4}` : ''));
const n = (a, f) => a.filter(f).length;
const rep = C.report(DB);
check(`all ${rep.modules} modules carry id, entity_scope and depends_on; all ${rep.options} module options carry id and affects`, rep.modulesWithId === rep.modules && rep.modulesWithScope === rep.modules && rep.modulesWithDependsOn === rep.modules && rep.optionsWithId === rep.options && rep.optionsWithAffects === rep.options, JSON.stringify(rep));
check(`all ${rep.services} services carry entity, uncertainty profile, confidence policy, recovery and complexity profile; ${Object.keys(DB.dynamic_services).length} compositions carry all but complexity`, rep.servicesWithEntity === rep.services && rep.servicesWithProfile === rep.services && rep.servicesWithPolicy === rep.services && rep.servicesWithRecovery === rep.services && rep.servicesWithComplexity === rep.services && Object.values(DB.dynamic_services).every(d => d.entity_id && d.uncertainty_profile && d.confidence_policy && d.recovery_affordances));
const noneS = DB.services.filter(s => s.confidence_gate.mode === 'none').map(s => s.id).sort(), noneD = Object.entries(DB.dynamic_services).filter(([, d]) => d.confidence_gate.mode === 'none').map(([k]) => k).sort();
check('the services without an uncertainty profile are exactly the declared ones (gate mode "none", each with a reason)', JSON.stringify(noneS) === JSON.stringify(NO_PROFILE.services) && JSON.stringify(noneD) === JSON.stringify(NO_PROFILE.dynamic), JSON.stringify([noneS, noneD]));
check('the carried thresholds agree with the legacy confidence_strategy wherever the service overrides the archetype (exact_at x 100 = minimum_quote_confidence)', DB.services.every(s => s.confidence_policy.policy_sources.exact_at !== 'service_override' || Math.abs(s.confidence_policy.exact_at * 100 - s.confidence_strategy.minimum_quote_confidence) < 1e-6) && Object.values(DB.dynamic_services).every(d => d.confidence_policy.policy_sources.exact_at !== 'service_override' || Math.abs(d.confidence_policy.exact_at * 100 - d.confidence_strategy.minimum_quote_confidence) < 1e-6));
check('every service\'s entity is the entity of its `entities[]` row, and every composition key\'s action is its action (checked in the audit above; here, by count)', n(DB.entities, e => e.service_ids.length) > 0 && DB.entities.reduce((a, e) => a + e.service_ids.length, 0) === DB.services.length && DB.entities.reduce((a, e) => a + e.composition_ids.length, 0) === Object.keys(DB.dynamic_services).length);

console.log('\n2. Ids: the set in the file is the frozen register, kind by kind');
{
  const F = { ent: DB.entities.map(e => e.id), act: DB.actions.map(a => a.id), mod: DB.modifiers.map(m => m.id), svc: DB.services.map(s => s.charter_id), cmp: Object.values(DB.dynamic_services).map(d => d.charter_id), u: DB.entities.flatMap(e => e.uncertainty_classes).concat(DB.shared_uncertainty_classes).map(c => c.id),
    tag: Object.values(DB.smart_tags).map(t => t.id), mat: Object.values(DB.materials_catalog).map(t => t.id), fml: Object.values(DB.pricing_formulas).map(t => t.id), chk: Object.values(DB.checkout_states).map(t => t.id), cat: DB.category.map(t => t.charter_id), grp: DB.group.map(t => t.charter_id),
    cls: Object.values(DB.archetypes).map(t => t.id), ctx: DB.contexts.map(c => c.id), par: Object.keys(DB.pricing_archetypes).map(k => 'par.' + k), fur: DB.furniture_catalog.map(f => f.id) };
  const qs = [], opts = []; for (const [k, m] of Object.entries(DB.intake_modules)) { qs.push(m.id); for (const o of m.client_response || []) opts.push(`${m.id}#${o.id}`); }
  for (const s of DB.services.map(x => x.intake_chain).concat(Object.values(DB.dynamic_services).map(d => d.intake_chain))) for (const st of s) if (st.params) { qs.push(st.params.id); for (const o of st.params.client_response || []) opts.push(`${st.params.id}#${o.id}`); }
  F.q = qs; F.opt = opts;
  for (const kind of Object.keys(F)) { const a = new Set(F[kind]), b = new Set(REG[kind]); const missing = [...b].filter(x => !a.has(x)), extra = [...a].filter(x => !b.has(x)); check(`${kind}: ${a.size} ids in the file = ${b.size} in the register`, !missing.length && !extra.length && F[kind].length === a.size, `missing ${missing.slice(0, 3)} extra ${extra.slice(0, 3)} dup ${F[kind].length - a.size}`); }
  const picker = new Set(); for (const [g, ra] of Object.entries(DB.routing_archetypes)) { (ra.real_symptom_ids || []).forEach(s => picker.add(`grp.${g}#${s}`)); (ra.symptom_tiles || []).forEach(t => picker.add(`grp.${g}#${t.id}`)); }
  check('picker symptom and tile ids (sym, tile): every registered one is in routing_archetypes, where they already lived', [...REG.sym, ...REG.tile].every(x => picker.has(x)), [...REG.sym, ...REG.tile].filter(x => !picker.has(x)).slice(0, 3).join(','));
  check('every kind of id in $source.id_homes has a home, and every kind in the register is either homed or declared (sym, tile live in routing_archetypes; par is the key of a compiler-owned record)', Object.keys(C.ID_HOMES).length >= 16 && Object.keys(DB.$source.id_homes).length === Object.keys(C.ID_HOMES).length);
}

console.log('\n3. Provenance and derivation: the carry is a function of the source alone');
{
  check('$source names the source, its hash is the hash of the file as it is, and its form says what this file still is', DB.$source.path === 'ssot/btnyc_source.json' && DB.$source.sha256 === lib.sha(SRCTEXT) && DB.$source.form === 'legacy_shape_with_charter_carry' && DB.$source.carry_version === C.CARRY_VERSION && DB.$source.source_schema_version === SRC.source_schema_version);
  const r = C.carry(DBTEXT, SRC, SRCTEXT);
  check('carry_charter --check: btnyc.json carries exactly what the source says (0 spans differ, 0 stale members)', r.splices === 0 && r.stale === 0, `${r.splices} spans, ${r.stale} stale`);
  const stripped = C.strip(DB);
  check('strip() gives back the pre-carry legacy shape: no carried member survives, depends_on is the {module key: label} map again, and the 8 compiler-owned keys are untouched', !C.TOP_KEYS.some(k => k in stripped) && Object.values(stripped.intake_modules).every(m => !('id' in m) && !('entity_scope' in m) && (m.depends_on === undefined || !Array.isArray(m.depends_on))) && stripped.services.every(s => !('entity_id' in s) && !('charter_id' in s)) && lib.COMPILER_KEYS.every(k => JSON.stringify(stripped[k]) === JSON.stringify(DB[k])));
  const again = JSON.parse(C.carry(lib.toText(stripped), SRC, SRCTEXT).text);
  check('carrying the stripped file gives back this file, member for member (so nothing here was hand-written, and nothing was lost by carrying)', lib.diff(again, DB) === null, JSON.stringify(lib.diff(again, DB) || '').slice(0, 200));
  const touched = C.strip(DB); const orig = JSON.stringify(touched);
  check('the carry only ADDS, apart from depends_on: every pre-existing member of every record is unchanged (strip is the exact inverse, proven by the round trip above)', orig === JSON.stringify(C.strip(JSON.parse(C.carry(lib.toText(touched), SRC, SRCTEXT).text))));
}

console.log('\n4. The checks can fail: a counterfactual for each obligation is found');
{
  const firstMod = d => Object.values(d.intake_modules).find(m => (m.client_response || []).length >= 2);
  const depMod = d => Object.values(d.intake_modules).find(m => m.depends_on.length);
  const mutants = [
    ['a module without its id', d => { delete firstMod(d).id; }, 'ID'],
    ['two questions with one id', d => { const [a, b] = Object.values(d.intake_modules); b.id = a.id; }, 'ID'],
    ['an option without its id', d => { delete firstMod(d).client_response[0].id; }, 'ID'],
    ['two options of one question with one id', d => { const m = firstMod(d); m.client_response[1].id = m.client_response[0].id; }, 'ID'],
    ['an entity id of the wrong kind', d => { d.entities[0].id = 'svc.not_an_entity'; }, 'ID'],
    ['a service id that is not svc.<id>', d => { d.services[0].charter_id = 'svc.something_else'; }, 'ID'],
    ['a tag id that is not tag.<key>', d => { Object.values(d.smart_tags)[0].id = 'tag.something_else'; }, 'ID'],
    ['a question with no entity_scope', d => { delete firstMod(d).entity_scope; }, 'SCOPE'],
    ['an entity_scope naming an entity that does not exist', d => { firstMod(d).entity_scope = ['ent.no_such_entity']; }, 'SCOPE'],
    ['a shared question scoped to a context that does not exist', d => { const m = Object.values(d.intake_modules).find(x => x.entity_scope && !Array.isArray(x.entity_scope)); m.entity_scope = { context: 'ctx.no_such_context' }; }, 'SCOPE'],
    ['an option without affects', d => { delete firstMod(d).client_response[0].affects; }, 'AFFECTS'],
    ['an option affecting something outside the vocabulary', d => { firstMod(d).client_response[0].affects = ['vibes']; }, 'AFFECTS'],
    ['an answer that carries a fee and does not declare price', d => { const m = Object.values(d.intake_modules).find(x => x.client_response.some(o => o.modifier_ref && d.global_rules.modifiers[o.modifier_ref] && d.global_rules.modifiers[o.modifier_ref].fee > 0)); const o = m.client_response.find(o => o.modifier_ref && d.global_rules.modifiers[o.modifier_ref] && d.global_rules.modifiers[o.modifier_ref].fee > 0); o.affects = o.affects.filter(a => a !== 'price'); }, 'AFFECTS'],
    ['an answer that routes the job and does not declare branch', d => { const o = Object.values(d.intake_modules).flatMap(m => m.client_response || []).find(x => x.route_to); o.affects = o.affects.filter(a => a !== 'branch'); }, 'AFFECTS'],
    ['a depends_on in the legacy spelling', d => { depMod(d).depends_on = { computer_symptom: 'x' }; }, 'DEPENDS'],
    ['a depends_on naming a question that does not exist', d => { depMod(d).depends_on[0].question_id = 'q.no_such_question'; }, 'DEPENDS'],
    ['a depends_on naming an option its question does not offer', d => { depMod(d).depends_on[0].option_id = 'no_such_option'; }, 'DEPENDS'],
    ['a module with no depends_on', d => { delete firstMod(d).depends_on; }, 'DEPENDS'],
    ['a service without an uncertainty_profile', d => { delete d.services[0].uncertainty_profile; }, 'SERVICE'],
    ['a profile naming a class that does not exist', d => { const s = d.services.find(x => x.uncertainty_profile.length); s.uncertainty_profile[0].class_id = 'u.no_such_class'; }, 'UNCERTAINTY'],
    ['a weighted service whose profile is empty', d => { const s = d.services.find(x => x.confidence_gate.mode === 'weighted_uncertainty'); s.uncertainty_profile = []; }, 'UNCERTAINTY'],
    ['a class retired by an answer its question does not offer', d => { d.entities.find(e => e.uncertainty_classes.some(c => (c.retired_by[0].option_ids || []).length)).uncertainty_classes.find(c => (c.retired_by[0].option_ids || []).length).retired_by[0].option_ids.push('no_such_answer'); }, 'UNCERTAINTY'],
    ['a class with nothing to retire it', d => { d.entities[0].uncertainty_classes[0].retired_by = []; }, 'UNCERTAINTY'],
    ['thresholds on the 0-100 scale', d => { const p = d.services[0].confidence_policy; p.exact_at = 80; p.scale = '0-100'; }, 'SCALE'],
    ['thresholds out of order', d => { const p = d.services[0].confidence_policy; p.range_at = 0.95; p.exact_at = 0.5; p.diagnostic_below = 0.2; }, 'SCALE'],
    ['a service with no recovery_affordances', d => { delete d.services[0].recovery_affordances; }, 'SERVICE'],
    ['recovery that routes to a checkout state that does not exist', d => { d.services[0].recovery_affordances.when_no_path.checkout_state_id = 'chk.no_such_state'; }, 'RECOVERY'],
    ['a service whose entity does not exist', d => { d.services[0].entity_id = 'ent.no_such_entity'; }, 'ENTITY'],
    ['a service claimed by an entity that does not own it', d => { d.services[0].entity_id = d.entities.find(e => e.id !== d.services[0].entity_id).id; }, 'ENTITY'],
    ['a service whose action is not its service type', d => { d.services[0].action_id = d.actions.find(a => a.id !== d.services[0].action_id).id; }, 'ACTION'],
    ['a service naming a modifier that does not exist', d => { d.services[0].modifier_ids = ['mod.no_such_modifier']; }, 'MODIFIER'],
    ['a service with no complexity_profile (R-COMPLEX-AXES)', d => { delete d.services[0].complexity_profile; }, 'COMPLEXITY'],
    ['a complexity_profile with an illegal risk tier', d => { d.services[0].complexity_profile.risk_tier = 'R9'; }, 'COMPLEXITY'],
    ['no $source', d => { delete d.$source; }, 'SECTION'],
    ['a $source whose hash is not the source as it is', d => { d.$source.sha256 = '0'.repeat(64); }, 'PROVENANCE'],
    ['no entities registry', d => { delete d.entities; }, 'SECTION'],
  ];
  for (const [name, mutate, code] of mutants) { const d = clone(DB); mutate(d); const f = audit(d, lib.sha(SRCTEXT)); check(`${name} is found (${code})`, f.some(x => x.startsWith(code + ':')), f.slice(0, 2).join(' | ') || 'no finding'); }
  // the carry tool sees a hand edit, and a stale value, in the text
  const edit = (label, mutateText) => { const t = mutateText(DBTEXT); const r = C.carry(t, SRC, SRCTEXT); check(`carry_charter --check sees ${label}`, r.splices > 0, 'no span differs'); };
  edit('a carried value edited by hand (a policy threshold)', t => t.replace('"exact_at": 0.8,', '"exact_at": 0.81,'));
  edit('a carried member deleted by hand (one option\'s affects)', t => { const i = t.indexOf('"affects": ['); const j = t.indexOf(']', i) + 1; return t.slice(0, i) + 'zz_removed": []' .replace('zz_removed', '"zz_removed') + t.slice(j); });
  edit('a source that moved on (a different source hash)', t => t.replace(DB.$source.sha256, '1'.repeat(64)));
}

console.log('\n5. The runtime reads the Charter spelling of depends_on and shows the same questions');
{
  // the engine as the page loads it (R-DEFECT-STALE-SANDBOX): findFn returns the whole engine wrapper for any function the engine modules declare, so a helper one function calls is never missing
  const { engine } = require('./_engine.js');
  const WRAPPER = engine(path.join(ROOT, 'qr.html')).wrapper;
  const NAMES = engine(path.join(ROOT, 'qr.html')).names;
  const findFn = name => (NAMES.has(name) ? WRAPPER : '');
  const boot = (data, text) => { const sb = { DB: data, SERVICE_DATA: data, window: { DB: data }, console }; sb.window = Object.assign(sb, sb.window); sb.global = sb; vm.createContext(sb); vm.runInContext(text || WRAPPER, sb); return sb; };
  const sb = boot(DB), legacy = C.strip(DB), sbL = boot(legacy);
  check('the page carries both translators (pricing module: _dependsOnAsLabels, orchestrator module: orch_depends_on_as_labels)', typeof sb._dependsOnAsLabels === 'function' && typeof sb.orch_depends_on_as_labels === 'function');
  const withDeps = Object.entries(DB.intake_modules).filter(([, m]) => m.depends_on.length);
  check(`${withDeps.length} modules carry a dependency; each translates to the legacy {module key: label} map, by both translators`, withDeps.length === Object.values(legacy.intake_modules).filter(m => m.depends_on).length && withDeps.every(([k, m]) => JSON.stringify(sb._dependsOnAsLabels(m.depends_on, DB.intake_modules)) === JSON.stringify(legacy.intake_modules[k].depends_on) && JSON.stringify(sb.orch_depends_on_as_labels(m.depends_on, DB.intake_modules)) === JSON.stringify(legacy.intake_modules[k].depends_on)));
  check('the legacy spelling passes through both translators untouched (a cached old file and a new page agree)', JSON.stringify(sb._dependsOnAsLabels({ a: 'b' }, {})) === '{"a":"b"}' && JSON.stringify(sb.orch_depends_on_as_labels({ a: 'b' }, {})) === '{"a":"b"}' && sb._dependsOnAsLabels(undefined, {}) === undefined);
  const dang = sb._dependsOnAsLabels([{ question_id: 'q.computer_symptom', option_id: 'no_such_option' }], DB.intake_modules);
  check('a pair that names no real answer becomes a label nothing equals (the module stays hidden, never shown by accident)', Object.values(dang)[0].startsWith('\u0000unresolved:') && !DB.intake_modules.computer_symptom.client_response.some(o => o.label === Object.values(dang)[0]));
  // the chain a customer sees: same visible modules, from the pairs and from the legacy spelling, over every answer to the questions the dependent modules depend on and are opened by
  const users = DB.services.filter(s => s.intake_chain.some(e => withDeps.some(([k]) => k === e.module))).map(s => s.id);
  check('the service that asks the dependent questions is found (non-vacuity; today computer_diagnostic, the one chain that holds them)', users.length >= 1 && users.includes('computer_diagnostic'), users.join());
  // The grid is every answer to the two questions the modules depend on, AND to the questions that open a dependent module by a `then` branch (T189: `thin_laptop` depends on the device
  // and is opened by three answers of two other questions; a grid over the first two alone never shows it, and "shown for some answers" would fail for a reason that is the grid's).
  const diag = DB.services.find(s => s.id === 'computer_diagnostic');
  const dimKeys = ['computer_symptom', 'device_type'];
  for (const e of diag.intake_chain) if (e.then && Object.values(e.then).some(l => Array.isArray(l) && withDeps.some(([k]) => l.includes(k))) && !dimKeys.includes(e.module)) dimKeys.push(e.module);
  let combos = [{}];
  for (const key of dimKeys) combos = combos.flatMap(a => [a, ...DB.intake_modules[key].client_response.map(o => Object.assign({}, a, { [key]: o.label }))]);
  const visibleSets = (box, data) => { const svc = data.services.find(s => s.id === 'computer_diagnostic'), chain = box._resolveIntakeChain(svc); return combos.map(ans => chain.filter(m => box._isModVisible(m, ans, chain)).map(m => m.moduleKey).join()); };
  const fromPairs = visibleSets(sb, DB), fromLegacy = visibleSets(sbL, legacy);
  check(`over ${combos.length} answer combinations the visible questions are identical whether depends_on is the pairs or the legacy map`, JSON.stringify(fromPairs) === JSON.stringify(fromLegacy));
  const shownAt = k => fromPairs.filter(v => v.split(',').includes(k)).length;
  check('each dependent question is shown for some answers and hidden for others (the grid exercises the dependency in both directions)', withDeps.every(([k]) => shownAt(k) > 0 && shownAt(k) < combos.length), withDeps.map(([k]) => k + ':' + shownAt(k) + '/' + combos.length).join(' '));
  check('with no answers given (the first combination), every dependent question is hidden', withDeps.every(([k]) => !fromPairs[0].split(',').includes(k)));
  // counterfactual: a translator that drops the answer (keeps the question, loses which answer opens it) is caught by the same grid
  const droppedText = WRAPPER.replace("out[key] = opt ? opt.label : '\\u0000unresolved:' + (p && p.option_id);", "out[key] = 'x';"), dropper = boot(DB, droppedText);
  check('(non-vacuity) a translator that loses the answer is caught: the grid shows different questions', droppedText !== WRAPPER && JSON.stringify(visibleSets(dropper, DB)) !== JSON.stringify(fromPairs));
}

console.log('\n6. The schema the site validates against requires all of it, in the page\'s own checker and in ajv');
{
  const SCHEMA = JSON.parse(fs.readFileSync(path.join(ROOT, 'schema', 'btnyc_schema.json'), 'utf8'));
  let Ajv, addFormats; try { Ajv = require(path.join(__dirname, 'node_modules', 'ajv')); addFormats = require(path.join(__dirname, 'node_modules', 'ajv-formats')); } catch (e) { Ajv = null; }
  const sb = { console }; sb.window = sb; vm.createContext(sb); vm.runInContext(fs.readFileSync(path.join(ROOT, 'orchestrator_engine.js'), 'utf8'), sb);
  const ajv = Ajv ? new Ajv({ allErrors: true, strict: false }) : null; if (ajv) addFormats(ajv);
  const validate = ajv ? ajv.compile(SCHEMA) : null;
  const verdicts = d => ({ page: sb.orch_validate_ssot(d, SCHEMA).valid, ajv: validate ? validate(d) : null });
  const v0 = verdicts(DB);
  check('the real file conforms, per the page\'s checker and per ajv', v0.page === true && v0.ajv === true);
  const cases = [
    ['no $source', d => { delete d.$source; }], ['no entities', d => { delete d.entities; }], ['no actions', d => { delete d.actions; }], ['no modifiers', d => { delete d.modifiers; }],
    ['a module without its id', d => { delete Object.values(d.intake_modules)[0].id; }], ['a module without entity_scope', d => { delete Object.values(d.intake_modules)[0].entity_scope; }], ['a module without depends_on', d => { delete Object.values(d.intake_modules)[0].depends_on; }],
    ['the legacy depends_on spelling', d => { Object.values(d.intake_modules)[0].depends_on = { x: 'y' }; }],
    ['an option without its id', d => { delete Object.values(d.intake_modules).find(m => m.client_response)  .client_response[0].id; }], ['an option without affects', d => { delete Object.values(d.intake_modules).find(m => m.client_response).client_response[0].affects; }],
    ['an affects outside the vocabulary', d => { Object.values(d.intake_modules).find(m => m.client_response).client_response[0].affects = ['vibes']; }],
    ['a service without entity_id', d => { delete d.services[0].entity_id; }], ['a service without uncertainty_profile', d => { delete d.services[0].uncertainty_profile; }], ['a service without confidence_policy', d => { delete d.services[0].confidence_policy; }],
    ['a service without recovery_affordances', d => { delete d.services[0].recovery_affordances; }], ['a service without complexity_profile (R-COMPLEX-AXES)', d => { delete d.services[0].complexity_profile; }],
    ['a composition without entity_id', d => { delete Object.values(d.dynamic_services)[0].entity_id; }],
    ['a confidence scale that is not 0-1', d => { d.services[0].confidence_policy.scale = '0-100'; }], ['a risk tier outside R0-R2', d => { d.services[0].complexity_profile.risk_tier = 'R9'; }],
    ['a tag without its id', d => { delete Object.values(d.smart_tags)[0].id; }], ['a material without its id', d => { delete Object.values(d.materials_catalog)[0].id; }], ['a category without charter_id', d => { delete d.category[0].charter_id; }],
    ['an unknown top-level member', d => { d.something_else = 1; }],
  ];
  for (const [name, mutate] of cases) { const d = clone(DB); mutate(d); const v = verdicts(d); check(`${name}: refused by the page's checker${validate ? ' and by ajv' : ''}`, v.page === false && (validate ? v.ajv === false : true), JSON.stringify(v)); }
  check('the page checker and ajv agree on every case above (one verdict)', cases.every(([, mutate]) => { const d = clone(DB); mutate(d); const v = verdicts(d); return !validate || v.page === v.ajv; }));
}

console.log('\n7. What it costs (R-SYSTEM-SINGLEFILECOST, measured) and how it is held');
{
  const gz = zlib.gzipSync(Buffer.from(DBTEXT)).length, raw = Buffer.byteLength(DBTEXT);
  const carriedBytes = Buffer.byteLength(JSON.stringify(Object.fromEntries(C.TOP_KEYS.map(k => [k, DB[k]]))));
  console.log(`  (info) btnyc.json ${raw} bytes, ${gz} gzipped; the six new top-level members ${carriedBytes} bytes minified; before the carry: 1,526,808 bytes, 177,436 gzipped`);
  check('the file stays under its size budget (gzip 250,000 bytes; raise it only on purpose, with the cost written down)', gz <= 250000, `${gz}`);
  const tool = fs.readFileSync(path.join(ROOT, 'test_harness', 'tools', 'entity_first', 'carry_charter.js'), 'utf8');
  check('the consultation allowlist is derived from the tool\'s own table (verify_ssot_consultation.js calls consultationSubtrees, and every carried key is in it)', fs.readFileSync(path.join(__dirname, 'verify_ssot_consultation.js'), 'utf8').includes('consultationSubtrees()') && [...C.CARRIED.service, ...C.CARRIED.dynamic, ...C.CARRIED.module, ...C.CARRIED.option].every(k => C.consultationSubtrees().some(s => s.endsWith('.' + k) || s.endsWith(']' + '.' + k) || s === k)) && /consultationSubtrees/.test(tool));
}

console.log(`\n[Charter carry] ${passed} passed, ${failed} failed (of ${passed + failed} checks)`);
process.exit(failed ? 1 : 0);
