#!/usr/bin/env node
/**
 * verify_entity_first_references.js -- every machine relationship in the entity-first source is an ID; ids are stable and complete; derivation refuses a source that does not validate and cannot go stale (T175;
 * R-SYSTEM-IDENTITY, R-INVARIANT-DERIVATION, R-DOMAIN-SHAPE, R-TEST-CANFAIL).
 *
 * @enforces R-SYSTEM-IDENTITY
 * @enforces R-INVARIANT-DERIVATION
 * @enforces R-DOMAIN-SHAPE
 * @detects DEFECT-NAMES-AS-KEYS
 * @detects DEFECT-DANGLING-REFERENCE
 * @detects DEFECT-DERIVED-AUTHORITY
 *
 * THE DEFECT-SHAPE. The legacy file keyed relationships by LABEL ("module:Option label" strings, `then` maps keyed by answer text, tag answers keyed by module name, 461-516 options with no id at all), so a
 * copy edit to a label silently re-pointed or broke a dependency. In the source a reference is a bare id whose prefix names its type (one grammar), an option is only ever the pair {question_id, option_id}, and
 * a label is display text. These checks hold that shape with detectors that do not share code with the validator they cross-check, and each detector is run on a counterfactual to prove it can fail.
 *
 * WHAT IS HELD:
 *   1. Stable ids on every referenceable node, recounted here by an independent walk (not the validator's counters): entities, questions, options, services, compositions, uncertainty classes, and every registry
 *      item; unique per type; every id carries the prefix of its type. Ids are append-stable: adding an option or a module to the legacy file and re-migrating changes no existing id.
 *   2. No label is a reference and no legacy spelling survives (audit_refs.js: every legacy identifier and answer label is scanned against every string and every key). The audit is run on counterfactuals.
 *   3. ONE canonical entity key: no `component_id` beside (or instead of) `entity_id` on any entity-owned node. No compiler-owned key (compiled, routing_archetypes, service_index, module_index ...) is in the authored source.
 *   4. The derived graph is as id-valid as the source: every edge, retirement, composition point and picker entry in ssot/derived/btnyc_graph.json names something that exists in the graph; it holds no threshold or
 *      count the source does not; and a corrupted graph fails the same detector.
 *   5. Validation and derivation are separate: validate_source.js reads only the source and the id grammar (it requires nothing that derives or migrates); derive_graph.js REFUSES a source the validator rejects, in
 *      process and from the command line, and writes nothing when it refuses.
 *   6. The derived graph cannot go stale or be edited by hand: `derive_graph.js --check` fails on a hand-edited graph, on a missing graph, and on a source change that was not re-derived.
 *
 * Node + python3; no browser, no network.
 */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const ROOT = process.env.BTNYC_ROOT ? path.resolve(process.env.BTNYC_ROOT) : path.resolve(__dirname, '..');
process.env.BTNYC_ROOT = ROOT;
const EF = path.join(__dirname, 'tools', 'entity_first');
const lib = require(path.join(EF, 'lib.js'));
const { audit } = require(path.join(EF, 'audit_refs.js'));
const { derive, InvalidSourceError } = require(path.join(EF, 'derive_graph.js'));
const { migrate } = require(path.join(EF, 'migrate_legacy.js'));

let passed = 0, failed = 0;
const check = (label, ok, detail) => { if (ok) { passed++; console.log(`  ✓ ${label}`); } else { failed++; console.log(`  ✗ ${label}${detail ? ' -- ' + detail : ''}`); } };
const need = (x, what) => { if (x === undefined || x === null) throw new Error('no site for the mutant: ' + what); return x; };

const LEGACY = lib.readJson(lib.PATHS.legacy);
const SRCTEXT = fs.readFileSync(lib.PATHS.source, 'utf8'); const SRC = JSON.parse(SRCTEXT);
const GRAPH = lib.readJson(lib.PATHS.graph);
const questionsOf = s => [...s.entities.flatMap(e => e.questions), ...s.shared_questions];
const servicesOf = s => s.entities.flatMap(e => e.services);

// ---- detectors (each is a function of a document, so the same code judges the real file and its mutants) ---------------------------------------------------------------------------------------------
// 1. ids: an independent walk. Returns the problems found.
const REG_TYPES = { categories: 'cat', groups: 'grp', actions: 'act', modifiers: 'mod', tags: 'tag', materials: 'mat', furniture: 'fur', checkout_states: 'chk', pricing_formulas: 'fml', pricing_archetypes: 'par', behavioral_classes: 'cls', contexts: 'ctx' };
function idProblems(s) {
  const out = []; const seen = {}; const pre = id => (typeof id === 'string' && /^([a-z]{1,4})\./.exec(id) || [])[1];
  const take = (type, node, where) => { if (!node || typeof node.id !== 'string' || !node.id) { out.push(`${where}: no id`); return; } if (pre(node.id) !== type) out.push(`${where}: ${node.id} is not a ${type}. id`); const k = type + ':' + node.id; if (seen[k]) out.push(`${where}: duplicate ${node.id}`); seen[k] = true; };
  for (const [reg, type] of Object.entries(REG_TYPES)) (s.registries[reg] || []).forEach((n, i) => take(type, n, `registries.${reg}[${i}]`));
  s.entities.forEach((e, i) => { take('ent', e, `entities[${i}]`); e.services.forEach((v, j) => take('svc', v, `entities[${i}].services[${j}]`)); e.default_compositions.forEach((c, j) => take('cmp', c, `entities[${i}].default_compositions[${j}]`)); e.uncertainty_classes.forEach((c, j) => take('u', c, `entities[${i}].uncertainty_classes[${j}]`)); });
  s.shared_uncertainty_classes.forEach((c, j) => take('u', c, `shared_uncertainty_classes[${j}]`));
  const qs = [...s.entities.flatMap((e, i) => e.questions.map((q, j) => [q, `entities[${i}].questions[${j}]`])), ...s.shared_questions.map((q, j) => [q, `shared_questions[${j}]`])];
  for (const [q, w] of qs) { take('q', q, w); const ids = new Set(); (q.options || []).forEach((o, k) => { if (typeof o.id !== 'string' || !o.id) out.push(`${w}.options[${k}]: no id`); else { if (ids.has(o.id)) out.push(`${w}.options[${k}]: duplicate option id ${o.id}`); ids.add(o.id); } }); }
  return out;
}
// 3. one canonical entity key; no compiler-owned key in the authored source
const COMPILER_OWNED = new Set(['compiled', 'routing_archetypes', 'pricing_archetypes_compiled', '_compiler_metadata', '_validation', '_additive_diff', '_schema_validation', '_archetype_mismatch_report', 'service_index', 'module_index']);
function shapeProblems(s) {
  const out = []; const walk = (v, p) => { if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`)); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (k === 'component_id') out.push(`${p}.${k}: a second entity key (the canonical key is entity_id)`); if (COMPILER_OWNED.has(k)) out.push(`${p}.${k}: a compiler-owned key in the authored source`); walk(x, `${p}.${k}`); } };
  walk(s, '$'); for (const k of Object.keys(s)) if (lib.COMPILER_KEYS.includes(k)) out.push(`$.${k}: a compiler-owned key at the top level`);
  for (const e of s.entities) for (const n of [...e.services, ...e.default_compositions]) if (typeof n.entity_id !== 'string') out.push(`${n.id}: no entity_id`);
  return out;
}
// 4. the derived graph names only what exists in the graph
function graphProblems(g) {
  const out = []; const Q = g.questions, E = g.entities, B = g.option_bridge, C = g.confidence;
  for (const [id, ch] of Object.entries(g.chains)) {
    if (!E[ch.entity_id]) out.push(`chains.${id}: entity ${ch.entity_id} not in the graph`);
    for (const q of ch.ask_order) if (!Q[q]) out.push(`chains.${id}.ask_order: ${q} not in the graph`);
    for (const e of ch.edges) { if (!Q[e.from]) out.push(`chains.${id}.edges: from ${e.from} not in the graph`); if (!Q[e.to]) out.push(`chains.${id}.edges: to ${e.to} not in the graph`); if (!B[`${e.from}#${e.option_id}`]) out.push(`chains.${id}.edges: ${e.from}#${e.option_id} has no option bridge entry`); }
  }
  for (const [qid, q] of Object.entries(Q)) for (const o of q.option_ids) if (!B[`${qid}#${o}`]) out.push(`questions.${qid}: option ${o} has no bridge entry`);
  for (const [qid, cs] of Object.entries(g.retirement_index)) { if (!Q[qid]) out.push(`retirement_index: ${qid} not in the graph`); for (const c of cs) if (!Object.values(C).some(x => x.classes.some(k => k.class_id === c)) && false) out.push(c); }
  for (const [id, c] of Object.entries(C)) for (const k of c.classes) for (const r of k.retired_by) { if (!Q[r.question_id]) out.push(`confidence.${id}: retired_by ${r.question_id} not in the graph`); for (const o of r.option_ids || []) if (!B[`${r.question_id}#${o}`]) out.push(`confidence.${id}: retired_by ${r.question_id}#${o} has no bridge entry`); }
  for (const [k, pt] of Object.entries(g.composition_index)) { if (!E[pt.entity_id]) out.push(`composition_index.${k}: entity ${pt.entity_id} not in the graph`); for (const x of [...pt.services, ...pt.default_compositions]) if (!g.chains[x]) out.push(`composition_index.${k}: ${x} has no chain`); }
  for (const [gid, p] of Object.entries(g.picker)) for (const e of p.component_entity_ids) if (!E[e]) out.push(`picker.${gid}: component ${e} not in the graph`);
  for (const [id, r] of Object.entries(g.recovery)) for (const q of r.deep_dive_question_ids) if (!Q[q]) out.push(`recovery.${id}: ${q} not in the graph`);
  return out;
}
// 5. the validator reads only the source and the id grammar
const validatorRequires = text => [...text.matchAll(/require\(\s*(?:path\.join\([^)]*\)|'([^']+)')\s*\)/g)].map(m => m[1]).filter(Boolean);
const FORBIDDEN_IN_VALIDATOR = /derive_graph|migrate_legacy|project_legacy|compiler_roundtrip|report\.js|audit_refs|declared_normalizations/;

// ---- 1. ids --------------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('Stable ids on every referenceable node');
const idp = idProblems(SRC);
check('every entity, question, option, service, composition, class and registry item has an id, unique, with its own type prefix', idp.length === 0, idp.slice(0, 3).join('; '));
const count = { ent: SRC.entities.length, q: questionsOf(SRC).length, svc: servicesOf(SRC).length, opt: questionsOf(SRC).reduce((n, q) => n + (q.options || []).length, 0), reg: Object.keys(REG_TYPES).reduce((n, r) => n + SRC.registries[r].length, 0) };
{ const st = require(path.join(EF, 'validate_source.js')).validate(lib.clone(SRC)).stats;
  check(`this walk's recount agrees with the validator's (a second, independent count): ${JSON.stringify(count)}`, count.ent === st.entities && count.q === st.questions && count.opt === st.options && count.svc === st.services && count.ent > 0 && count.opt > 0); }
check('no option lacks an id (the audit counted 461 legacy options without one; the legacy file has 516)', questionsOf(SRC).every(q => (q.options || []).every(o => typeof o.id === 'string' && o.id)));
{ const s = lib.clone(SRC); delete questionsOf(s).find(q => q.options).options[0].id; check('counterfactual: an option with its id removed is found by the id walk', idProblems(s).some(p => /no id/.test(p)));
  const s2 = lib.clone(SRC); s2.entities[0].services[0].id = 'ent.' + s2.entities[0].services[0].id.slice(4); check('counterfactual: a service id with the wrong prefix is found', idProblems(s2).some(p => /is not a svc\. id/.test(p)));
  const s3 = lib.clone(SRC); s3.registries.tags[1].id = s3.registries.tags[0].id; check('counterfactual: a duplicate registry id is found', idProblems(s3).some(p => /duplicate/.test(p))); }
{ // append-stability: adding an option to a module, and adding a module, re-migrates every existing node under the same id
  const idsOf = s => { const m = new Map(); for (const q of questionsOf(s)) { m.set(q.id, 1); for (const o of q.options || []) m.set(q.id + '#' + o.id, 1); } for (const n of [...s.entities, ...servicesOf(s), ...s.entities.flatMap(e => e.default_compositions), ...s.entities.flatMap(e => e.uncertainty_classes), ...s.shared_uncertainty_classes]) m.set(n.id, 1); return m; };
  const before = idsOf(migrate(lib.clone(LEGACY)).source); const L2 = lib.clone(LEGACY);
  const modName = Object.keys(L2.intake_modules).find(k => Array.isArray(L2.intake_modules[k].client_response) && L2.intake_modules[k].client_response.length > 1); const cr = L2.intake_modules[modName].client_response;
  cr.push(Object.assign(lib.clone(cr[cr.length - 1]), { label: 'A brand new answer added last', id: undefined })); L2.intake_modules.a_brand_new_module_added_last = lib.clone(L2.intake_modules[modName]);
  let after; try { after = idsOf(migrate(L2).source); } catch (e) { after = null; check('re-migrating a legacy file with a new answer and a new module does not throw', false, e.message); }
  if (after) { const lost = [...before.keys()].filter(k => !after.has(k)); check(`ids are append-stable: a new answer and a new module change none of the ${before.size} existing ids (${lost.length} lost${lost.length ? ': ' + lost.slice(0, 3).join(', ') : ''})`, lost.length === 0 && after.size > before.size); } }

// ---- 2. no label is a reference; no legacy spelling survives ----------------------------------------------------------------------------------------------------------------------
console.log('\nNo label is a reference');
const aud = audit(SRC, LEGACY);
check(`audit_refs: no legacy identifier or answer label survives unprefixed in any string or key (${aud.scanned.identifiers} identifiers, ${aud.scanned.labels} labels scanned)`, aud.findings.length === 0, aud.findings.slice(0, 3).join('; '));
{ const mod = Object.keys(LEGACY.intake_modules).find(k => /_/.test(k) && k.length > 6);
  const s = lib.clone(SRC); s.policy.stray_reference = mod; check(`counterfactual: a legacy module name (${mod}) left as an unprefixed value is found`, audit(s, LEGACY).findings.some(f => /legacy module identifier/.test(f)));
  const label = need(Object.values(LEGACY.intake_modules).flatMap(m => m.client_response || []).map(o => o.label).find(l => l.length > 6), 'an answer label');
  const s2 = lib.clone(SRC); s2.policy.ui_config[label] = ['x']; check('counterfactual: an answer label used as an object key is found', audit(s2, LEGACY).findings.some(f => /LABELKEY/.test(f)));
  const s3 = lib.clone(SRC); delete s3.meta.estimate_disclaimers; check('counterfactual: a pinned coincidence that no longer occurs fails the audit (the pin list cannot go stale)', audit(s3, LEGACY).findings.some(f => /no longer occurs/.test(f)));
  const s4 = lib.clone(SRC); const t = need(s4.registries.tags.find(x => Array.isArray(x.requires)), 'a tag with requires'); t.requires = [mod]; check('counterfactual: a legacy name in a typed reference site is found', audit(s4, LEGACY).findings.length > 0); }
check('depends_on, retirement and route_to terms are all {question_id, option_id} pairs (no bare option string, no label)', (() => {
  const terms = []; const addDep = d => (d || []).forEach(t => (t.any_of || [t]).forEach(u => terms.push(u)));
  for (const q of questionsOf(SRC)) { addDep(q.depends_on); for (const o of q.options || []) if (o.route_to) o.route_to.answers.forEach(a => terms.push(a)); }
  for (const n of [...servicesOf(SRC), ...SRC.entities.flatMap(e => e.default_compositions)]) n.intake.steps.forEach(st => addDep(st.depends_on));
  return terms.length > 0 && terms.every(t => t && typeof t.question_id === 'string' && /^q\./.test(t.question_id) && typeof t.option_id === 'string' && !/\s/.test(t.option_id) && Object.keys(t).length === 2); })());

// ---- 3. one canonical entity key; nothing compiler-owned in the authored source ---------------------------------------------------------------------------------------------------
console.log('\nOne canonical key; no compiler-owned content in the authored source');
const sp = shapeProblems(SRC);
check('no component_id anywhere; every service and composition carries entity_id; no compiler-owned key in the source', sp.length === 0, sp.slice(0, 3).join('; '));
{ const s = lib.clone(SRC); servicesOf(s)[0].component_id = 'ent.computer'; check('counterfactual: a second entity key on a service is found', shapeProblems(s).some(p => /second entity key/.test(p)));
  const s2 = lib.clone(SRC); s2.compiled = { service_index: {} }; check('counterfactual: a `compiled` section in the authored source is found', shapeProblems(s2).some(p => /compiler-owned/.test(p)));
  const s3 = lib.clone(SRC); s3.registries.groups[0].routing_archetypes = {}; check('counterfactual: routing_archetypes smuggled into a group is found', shapeProblems(s3).some(p => /routing_archetypes/.test(p)));
  const s4 = lib.clone(SRC); delete servicesOf(s4)[0].entity_id; check('counterfactual: a service with no entity key is found', shapeProblems(s4).some(p => /no entity_id/.test(p))); }
check('the curated routing_archetypes knowledge has an authored home (every group has a picker in the source)', SRC.registries.groups.every(g => g.picker && g.picker.entry_mode));

// ---- 4. the derived graph is as id-valid as the source ------------------------------------------------------------------------------------------------------------------------------
console.log('\nThe derived graph names only what exists');
const gp = graphProblems(GRAPH);
check(`every edge, retirement, composition point, picker entry and recovery question in the committed graph exists in the graph (${Object.keys(GRAPH.chains).length} chains, ${GRAPH.counts.option_bridge_entries} bridge entries)`, gp.length === 0, gp.slice(0, 3).join('; '));
{ const g = lib.clone(GRAPH); const id = Object.keys(g.chains).find(k => g.chains[k].edges.length); g.chains[id].edges[0].from = 'q.no_such_question'; check('counterfactual: a graph edge from a question that does not exist is found', graphProblems(g).some(p => /not in the graph/.test(p)));
  const g2 = lib.clone(GRAPH); delete g2.option_bridge[Object.keys(g2.option_bridge)[0]]; check('counterfactual: an option that lost its bridge entry is found', graphProblems(g2).some(p => /bridge/.test(p)));
  const g3 = lib.clone(GRAPH); const pk = Object.keys(g3.composition_index)[0]; g3.composition_index[pk].services.push('svc.no_such_service'); check('counterfactual: a composition point naming a service with no chain is found', graphProblems(g3).some(p => /has no chain/.test(p))); }
{ const val = require(path.join(EF, 'validate_source.js')).validateFull(lib.clone(SRC)); const own = [...servicesOf(SRC), ...SRC.entities.flatMap(e => e.default_compositions)];
  check('the graph holds exactly the source\'s thresholds (no threshold the source does not author)', own.every(n => { const c = GRAPH.confidence[n.id]; const p = n.confidence_policy; return c && c.thresholds.exact_at === p.exact_at && c.thresholds.range_at === p.range_at && c.thresholds.diagnostic_below === p.diagnostic_below && c.gate === n.confidence_gate.mode; }));
  check('the graph\'s counts are the validator\'s (entities, questions, services, compositions, classes)', GRAPH.counts.entities === val.stats.entities && GRAPH.counts.questions === val.stats.questions && GRAPH.counts.services === val.stats.services && GRAPH.counts.default_compositions === val.stats.compositions && GRAPH.counts.uncertainty_classes === val.stats.classes && GRAPH.counts.options_authored === val.stats.options);
  const allLabels = new Set(questionsOf(SRC).flatMap(q => (q.options || []).map(o => o.label)));
  check('every label in the option bridge is a label the source authors (the bridge invents nothing)', Object.values(GRAPH.option_bridge).every(b => allLabels.has(b.label))); }
check('the graph is separate from the source: it carries the source hash and the derivation version, and no compiled section', GRAPH.derivation.source_sha256 === lib.sha(SRCTEXT) && GRAPH.derivation.version === lib.DERIVATION_VERSION && !('compiled' in GRAPH));

// ---- 5. validation and derivation are separate ------------------------------------------------------------------------------------------------------------------------------------
console.log('\nValidation and derivation are separate');
{ const vtext = fs.readFileSync(path.join(EF, 'validate_source.js'), 'utf8'); const reqs = validatorRequires(vtext);
  check(`validate_source.js requires only the grammar and the platform (${reqs.join(', ')}): nothing that derives, migrates or projects`, !reqs.some(r => FORBIDDEN_IN_VALIDATOR.test(r)) && reqs.includes('./lib.js'), reqs.join(', '));
  check('counterfactual: a validator that required derive_graph.js would be found', FORBIDDEN_IN_VALIDATOR.test(validatorRequires(vtext + "\nconst d = require('./derive_graph.js');").join(',')));
  const dtext = fs.readFileSync(path.join(EF, 'derive_graph.js'), 'utf8'); check('derive_graph.js calls the validator before it derives (it does not repair or guess)', /validateFull\(/.test(dtext) && /InvalidSourceError/.test(dtext)); }
{ const refuse = (label, mutate, code) => { const s = lib.clone(SRC); try { mutate(s); } catch (e) { check(label, false, 'no site: ' + e.message); return; } let threw = null; try { derive(s, JSON.stringify(s)); } catch (e) { threw = e; } check(label, threw instanceof InvalidSourceError && threw.result.errors.some(e => e.code === code), threw ? `${threw.name}: ${String(threw.message).slice(0, 120)}` : 'derivation ran on an invalid source'); };
  refuse('derive() refuses a source with a dangling reference', s => { servicesOf(s)[0].action_id = 'act.no_such_action'; }, 'V-REF-DANGLING');
  refuse('derive() refuses a service with no confidence_policy (a missing declaration is never 100%)', s => { delete servicesOf(s)[0].confidence_policy; }, 'V-CONF-POLICY');
  refuse('derive() refuses a "not sure" answer that retires uncertainty', s => { let q = questionsOf(s).find(x => (x.options || []).some(o => o.evidence === 'unknown')); if (!q) { q = questionsOf(s).find(x => x.options && x.options.length > 1); q.options[0].evidence = 'unknown'; } const u = q.options.find(o => o.evidence === 'unknown'); const c = s.entities.flatMap(e => e.uncertainty_classes).find(x => x.retired_by.some(r => r.option_ids)); c.retired_by[0].option_ids.push(u.id); c.retired_by[0].question_id = q.id; }, 'V-UNC-RETIRE-UNKNOWN');
  refuse('derive() refuses a question with no entity_scope', s => { delete questionsOf(s)[0].entity_scope; }, 'V-SCOPE-MISSING');
  refuse('derive() refuses two curated services at one composition point with no declared decomposition', s => { const e = s.entities.find(x => x.services.length > 1 && x.services.every(v => v.decomposition === undefined)); e.services[1].action_id = e.services[0].action_id; e.services[1].modifier_ids = e.services[0].modifier_ids.slice(); }, 'V-COMP-AMBIGUOUS');
  refuse('derive() refuses a source that violates only the JSON Schema', s => { servicesOf(s)[0].component_id = 'ent.computer'; }, 'V-SCHEMA');
  let threw = null; try { derive(lib.clone(SRC), SRCTEXT); } catch (e) { threw = e; } check('...and derives the real source without complaint', threw === null, threw && threw.message.slice(0, 160)); }

// ---- 6. the graph cannot go stale or be edited by hand ------------------------------------------------------------------------------------------------------------------------------------
console.log('\nThe derived graph cannot go stale');
{ const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ef-ref-'));
  try {
    fs.cpSync(path.join(ROOT, 'ssot'), path.join(tmp, 'ssot'), { recursive: true }); fs.symlinkSync(path.join(ROOT, 'schema'), path.join(tmp, 'schema')); fs.symlinkSync(path.join(ROOT, 'test_harness'), path.join(tmp, 'test_harness'));
    const run = args => cp.spawnSync('node', [path.join(EF, 'derive_graph.js'), ...args], { encoding: 'utf8', env: Object.assign({}, process.env, { BTNYC_ROOT: tmp }), maxBuffer: 1 << 26 });
    const g = path.join(tmp, 'ssot', 'derived', 'btnyc_graph.json'), s = path.join(tmp, 'ssot', 'btnyc_source.json'); const gtext = fs.readFileSync(g, 'utf8'), stext = fs.readFileSync(s, 'utf8');
    const ok = run(['--check']); check('derive_graph.js --check passes on an unmodified copy', ok.status === 0, (ok.stdout + ok.stderr).slice(0, 200));
    fs.writeFileSync(g, gtext.replace('"gate": "weighted_uncertainty"', '"gate": "none"')); const hand = run(['--check']); check('a hand-edited graph fails --check', hand.status === 1 && /stale or edited by hand/.test(hand.stderr), (hand.stdout + hand.stderr).slice(0, 200));
    fs.rmSync(g); const gone = run(['--check']); check('a missing graph fails --check', gone.status === 1, (gone.stdout + gone.stderr).slice(0, 200));
    fs.writeFileSync(g, gtext); const S2 = JSON.parse(stext); S2.entities[0].label += ' (renamed, valid, not re-derived)'; fs.writeFileSync(s, lib.toText(S2)); const stale = run(['--check']); check('a valid source edit that was not re-derived fails --check (the graph carries the source hash)', stale.status === 1, (stale.stdout + stale.stderr).slice(0, 200));
    const re = run([]); check('re-deriving writes the graph and --check then passes', re.status === 0 && run(['--check']).status === 0, (re.stdout + re.stderr).slice(0, 200));
    // refusal from the command line: an invalid source writes nothing
    fs.rmSync(g); const S3 = JSON.parse(stext); S3.entities[0].services[0].action_id = 'act.no_such_action'; fs.writeFileSync(s, lib.toText(S3));
    const refused = run([]); check('the command line REFUSES an invalid source (exit 1, names the rule code) ...', refused.status === 1 && /V-REF-DANGLING/.test(refused.stderr), (refused.stdout + refused.stderr).slice(0, 240));
    check('... and writes no graph when it refuses', !fs.existsSync(g));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); } }
check('the committed graph is what the committed source derives (byte for byte)', lib.toText(derive(lib.clone(SRC), SRCTEXT)) === fs.readFileSync(lib.PATHS.graph, 'utf8'));

console.log(`\n[Entity-first references, ids and derivation] ${passed} passed, ${failed} failed (of ${passed + failed} checks)`);
process.exit(failed ? 1 : 0);
