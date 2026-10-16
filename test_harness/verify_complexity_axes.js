#!/usr/bin/env node
/**
 * verify_complexity_axes.js -- every service declares three independent axes, and none is derived from another (T180; R-COMPLEX-AXES, R-COMPLEX-COMPOUNDS; P-COMPLEX-FURNITURE).
 *
 * @enforces R-COMPLEX-AXES
 * @enforces R-COMPLEX-COMPOUNDS
 * @enforces R-TEST-CANFAIL
 * @detects DEFECT-AXIS-CONFLATION
 * @detects DEFECT-TEST-CANTFAIL
 *
 * THE DEFECT-SHAPE. The Charter (R-COMPLEX-AXES) requires every service to declare a skill tier, a risk tier and a batch-risk flag, independently, and (its enforcement paragraph) a structural test that
 * reads every service's complexity_profile and a resolver test that no code path derives one axis from another. Until T180 the catalog declared one axis (complexity_tier) and no test read any: the
 * requirement was in the Charter and nowhere in the repo. This file is that test.
 *
 * WHAT IS HELD
 *   1. The legal values are the Charter's, read from the Charter's own text (not from this file, not from the source): a Charter that changes an enumeration fails here until the vocabulary follows.
 *   2. Every service declares all three keys, each a legal value; the skill tier agrees with the one the runtime reads; the risk tier is the highest of the hazards it names; the batch flag is true exactly
 *      when it names a ground, and a signal the service's own record shows (R-COMPLEX-COMPOUNDS) is named, while a signal the record does not show is not (belief alone is not a signal).
 *   3. The axes are independent as DATA: no axis is a function of another across the catalog (a catalog where the risk tier follows from the tier would pass every per-service check and still be derived).
 *   4. The assembly-family services are the three the Charter names, each declares its class, and its tier is at least the class's minimum (P-COMPLEX-FURNITURE).
 *   5. The Charter's own worked examples hold (a cabinet-knob install is skilled / R1 / true; a wall crack repair is specialized / R2 / true).
 *   6. Authored in ONE place: the axes file, copied by the migration; the source, the marker and the provenance record its hash.
 *   7. Every check above is shown able to fail: a service without a profile, a lost key, an illegal value, a risk tier that follows the skill tier, a lost signal, an unnamed signal ...
 *   8. THE RESOLVER HALF, and what it finds. The runtime derives the skill tier from minutes (deriveComplexityTier, global_rules.complexity_tiers min_minutes/max_minutes), which R-COMPLEX-VOLUME names
 *      as forbidden ("skill_tier := f(minutes)"). That is DEFECT-AXIS-CONFLATION. It changes the hourly rate, so it is an Operator decision (PENDING_DECISIONS #229): it is NOT changed here. It is PINNED:
 *      the exact sites that read minutes to derive a tier, and the exact services whose tier moves when only the quantity changes. A new site, or a new service, fails; so does a fix that leaves the pin
 *      (remove the pin when #229 is ruled). No runtime code reads risk_tier, batch_risk_compounds or complexity_profile yet, so nothing derives them; that is pinned too, so the first consumer arrives with its check.
 *
 * Node only; no browser, no network.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.BTNYC_ROOT ? path.resolve(process.env.BTNYC_ROOT) : path.resolve(__dirname, '..');
process.env.BTNYC_ROOT = ROOT;
const EF = path.join(__dirname, 'tools', 'entity_first');
const lib = require(path.join(EF, 'lib.js'));
const V = require(path.join(EF, 'validate_source.js'));
const CA = require(path.join(EF, 'complexity_axes.js'));
const { migrate } = require(path.join(EF, 'migrate_legacy.js'));

let passed = 0, failed = 0;
const check = (label, ok, detail) => { if (ok) { passed++; console.log(`  ✓ ${label}`); } else { failed++; console.log(`  ✗ ${label}${detail ? ' -- ' + detail : ''}`); } };
const SRC = lib.readJson(lib.PATHS.source);
const servicesOf = s => s.entities.flatMap(e => e.services);

// ---- 1. the Charter's own enumerations --------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('The legal values are the Charter\'s own');
const CHARTER_TEXT = (() => { const raw = fs.readFileSync(path.join(ROOT, 'PROJECT_CHARTER.html'), 'utf8'); return raw.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;|&lsquo;/g, "'").replace(/\s+/g, ' '); })();
const enumOf = re => { const m = re.exec(CHARTER_TEXT); return m ? m[1].split('|').map(x => x.trim()).filter(Boolean) : null; };
const CHARTER = {
  tiers: enumOf(/\btier:\s*((?:routine|skilled|specialized|project)(?:\s*\|\s*(?:routine|skilled|specialized|project))+)/),
  risk: enumOf(/\brisk_tier:\s*((?:R\d)(?:\s*\|\s*R\d)+)/),
  flag: enumOf(/\bbatch_risk_compounds:\s*((?:true|false)(?:\s*\|\s*(?:true|false))+)/),
};
check('the Charter\'s R-COMPLEX-AXES declares the skill tiers routine | skilled | specialized | project', Array.isArray(CHARTER.tiers) && CHARTER.tiers.join('|') === 'routine|skilled|specialized|project', JSON.stringify(CHARTER.tiers));
check('...the risk tiers R0 | R1 | R2 | R3, and the batch flag true | false', Array.isArray(CHARTER.risk) && CHARTER.risk.join('|') === 'R0|R1|R2|R3' && Array.isArray(CHARTER.flag) && CHARTER.flag.join('|') === 'true|false', JSON.stringify([CHARTER.risk, CHARTER.flag]));
const AX = SRC.policy.complexity_axes;
check('the source\'s vocabulary has exactly the Charter\'s tiers and risk tiers, in the Charter\'s order', JSON.stringify(AX.tiers) === JSON.stringify(CHARTER.tiers) && JSON.stringify(AX.risk_tiers) === JSON.stringify(CHARTER.risk));
for (const [name, re] of [['an overflow formula (item_count_overflow_formula)', /item_count_overflow_formula/], ['per-unit penalty minutes', /per-unit penalty minutes/], ['a single-use consumable', /single-use consumable/], ['a scope-changing branch', /scope-changing branch/]])
  check(`the Charter still names the batch-risk signal ${name} (R-COMPLEX-COMPOUNDS), so the vocabulary's signals are the Charter's`, re.test(CHARTER_TEXT));
const FAMILY = (() => { const m = /The existing (\w+) , (\w+) , and (\w+) services declare their assembly class explicitly/.exec(CHARTER_TEXT); return m ? m.slice(1).map(x => 'svc.' + x) : null; })();
check('the assembly-family services are the three the Charter names (P-COMPLEX-FURNITURE)', Array.isArray(FAMILY) && JSON.stringify(FAMILY.slice().sort()) === JSON.stringify(AX.assembly_family_service_ids.slice().sort()), JSON.stringify(FAMILY));

// ---- 2. the structural test: every service, every axis ---------------------------------------------------------------------------------------------------------------------------------------------
// Written from the Charter's enumerations and the source alone; it shares no code with validate_source.js (which checks the same facts a second way, and has its own mutants).
const RANK = r => CHARTER.risk.indexOf(r);
function problems(src) {
  const out = []; const ax = src.policy.complexity_axes;
  const svcs = servicesOf(src);
  for (const v of svcs) {
    const p = v.complexity_profile;
    if (!p || typeof p !== 'object') { out.push(`${v.id}: no complexity_profile`); continue; }
    for (const k of ['tier', 'risk_tier', 'batch_risk_compounds']) if (!(k in p)) out.push(`${v.id}: complexity_profile has no ${k}`);
    if ('tier' in p && !CHARTER.tiers.includes(p.tier)) out.push(`${v.id}: tier ${JSON.stringify(p.tier)} is not legal`);
    if ('risk_tier' in p && !CHARTER.risk.includes(p.risk_tier)) out.push(`${v.id}: risk_tier ${JSON.stringify(p.risk_tier)} is not legal`);
    if ('batch_risk_compounds' in p && typeof p.batch_risk_compounds !== 'boolean') out.push(`${v.id}: batch_risk_compounds ${JSON.stringify(p.batch_risk_compounds)} is not a boolean`);
    if (v.pricing && v.pricing.operational_metrics && v.pricing.operational_metrics.complexity_tier !== p.tier) out.push(`${v.id}: tier ${p.tier} disagrees with the tier the runtime reads (${v.pricing.operational_metrics.complexity_tier})`);
    const hz = Array.isArray(p.risk_basis) ? p.risk_basis : [];
    if (!hz.length) out.push(`${v.id}: names no hazard`);
    const top = hz.reduce((m, h) => { const t = ax.risk_hazards[h] && ax.risk_hazards[h].tier; return t && RANK(t) > RANK(m) ? t : m; }, 'R0');
    if (hz.some(h => !ax.risk_hazards[h])) out.push(`${v.id}: names a hazard the vocabulary does not have`);
    if (p.risk_tier !== top) out.push(`${v.id}: risk_tier ${p.risk_tier} is not the highest hazard it names (${top})`);
    const bb = Array.isArray(p.batch_risk_basis) ? p.batch_risk_basis : null;
    if (!bb) out.push(`${v.id}: batch_risk_basis is not a list`);
    else if (p.batch_risk_compounds !== (bb.length > 0)) out.push(`${v.id}: batch_risk_compounds ${p.batch_risk_compounds} but ${bb.length} ground(s) named`);
    if (bb) {
      const sig = V.complexitySignals(v, new Map(src.registries.pricing_formulas.map(f => [f.id, f])), new Map([...src.entities.flatMap(e => e.questions), ...src.shared_questions].map(q => [q.id, q])), ax.single_use_consumable_material_ids);
      for (const g of sig) if (!bb.includes(g)) out.push(`${v.id}: its record shows ${g} but the profile does not name it`);
      for (const b of bb) if ((b in ax.batch_signals || b.startsWith('single_use_consumable:')) && !sig.includes(b)) out.push(`${v.id}: names ${b}, which its record does not show`);
      for (const b of bb) if (!(b in ax.batch_physical_bases) && !(b in ax.batch_signals) && !b.startsWith('single_use_consumable:')) out.push(`${v.id}: ground ${JSON.stringify(b)} is neither physical nor a signal`);
    }
    const fam = ax.assembly_family_service_ids.includes(v.id);
    if (fam && !p.assembly_class) out.push(`${v.id}: assembly-family service with no assembly class`);
    if (!fam && p.assembly_class) out.push(`${v.id}: assembly class on a service outside the family`);
    if (p.assembly_class && ax.assembly_classes[p.assembly_class] && CHARTER.tiers.indexOf(p.tier) < CHARTER.tiers.indexOf(ax.assembly_classes[p.assembly_class].minimum_tier)) out.push(`${v.id}: tier ${p.tier} is below the minimum of class ${p.assembly_class}`);
  }
  return out;
}
// no axis a function of another, as data: for each ordered pair (X, Y) two services agree on X and differ on Y
function dependent(src) {
  const rows = servicesOf(src).map(v => v.complexity_profile).filter(Boolean); const axes = ['tier', 'risk_tier', 'batch_risk_compounds'];
  const bad = [];
  for (const x of axes) for (const y of axes) if (x !== y) {
    let free = false; for (const a of rows) for (const b of rows) if (a[x] === b[x] && a[y] !== b[y]) free = true;
    if (!free) bad.push(`${y} is a function of ${x}`);
  }
  return bad;
}
console.log('\nEvery service declares all three axes, each a legal value');
const real = problems(SRC);
const names = servicesOf(SRC);
check(`the catalog has ${names.length} services and each declares a complexity_profile with a skill tier, a risk tier and a batch-risk flag, each a legal value, consistent with its named hazards and grounds`, names.length === SRC.registries.service_order.length && names.length >= 70 && real.length === 0, real.slice(0, 4).join(' | '));
check('the source passes validate_source.js with no V-COMPLEX finding', (() => { const r = V.validate(lib.clone(SRC)); return r.ok && !r.errors.some(e => e.code.startsWith('V-COMPLEX')); })());
{ const vals = k => new Set(names.map(v => v.complexity_profile[k]));
  check('non-vacuity: the catalog uses more than one skill tier, at least three risk tiers, and both batch-risk values (a catalog of one value would satisfy every check above)', vals('tier').size >= 2 && vals('risk_tier').size >= 3 && vals('batch_risk_compounds').size === 2, JSON.stringify([...vals('tier')]) + JSON.stringify([...vals('risk_tier')])); }
{ const d = dependent(SRC); check('no axis is a function of another across the catalog (R-COMPLEX-AXES: "no axis may be derived from another")', d.length === 0, d.join('; ')); }

console.log('\nThe Charter\'s own worked examples hold');
{ const p = id => names.find(v => v.id === id).complexity_profile;
  const k = p('svc.cabinet_knob_or_pull_install'), w = p('svc.wall_hole_or_crack_repair');
  check('a knob install is skilled / R1 / true ("a service that is skilled / R1 / true — a knob install")', k.tier === 'skilled' && k.risk_tier === 'R1' && k.batch_risk_compounds === true, JSON.stringify(k));
  check('a wall crack repair is specialized / R2 / true ("specialized / R2 / true — a wall crack repair")', w.tier === 'specialized' && w.risk_tier === 'R2' && w.batch_risk_compounds === true, JSON.stringify(w)); }
console.log('\nThe signals R-COMPLEX-COMPOUNDS names are read from the record');
{ const F = new Map(SRC.registries.pricing_formulas.map(f => [f.id, f])), Q = new Map([...SRC.entities.flatMap(e => e.questions), ...SRC.shared_questions].map(q => [q.id, q]));
  const sig = id => V.complexitySignals(names.find(v => v.id === id), F, Q, AX.single_use_consumable_material_ids);
  check('the hardware formula\'s overflow rate is a signal for the knob install', sig('svc.cabinet_knob_or_pull_install').includes('overflow_formula'));
  check('the wax ring a toilet install requires is a single-use consumable signal', sig('svc.toilet_install').includes('single_use_consumable:mat.MAT-PLM-TLT-WaxRing'));
  check('the tile formula\'s penalty minutes are a signal for a loose-tile replacement', sig('svc.loose_tile_replacement').includes('per_unit_penalty_minutes'));
  check('an answer that routes to another service is a scope-changing branch (computer diagnostic)', sig('svc.computer_diagnostic').includes('scope_changing_branch'));
  check('a service with none of the four signals shows none (a bulb replacement)', sig('svc.led_bulb_upgrade').length === 0); }

console.log('\nAssembly services declare their class (P-COMPLEX-FURNITURE)');
for (const id of AX.assembly_family_service_ids) { const v = names.find(x => x.id === id); check(`${id} declares assembly class ${v.complexity_profile.assembly_class} and its tier ${v.complexity_profile.tier} is at least the class minimum ${AX.assembly_classes[v.complexity_profile.assembly_class].minimum_tier}`, !problems(SRC).some(x => x.startsWith(id))); }

// ---- 3. authored in one place ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('\nAuthored in one place: the axes file, copied by the migration');
{ const AXF = CA.load(); const mark = lib.readJson(lib.PATHS.lastMigration);
  check('the source\'s vocabulary is the axes file\'s vocabulary, exactly', JSON.stringify(SRC.policy.complexity_axes) === JSON.stringify(AXF.axes.vocabulary));
  check('every service\'s profile is its axes-file entry plus the skill tier btnyc.json declares (no second copy of any authored value)', names.every(v => { const L = AXF.axes.services[v.id.slice(4)]; return L && JSON.stringify(v.complexity_profile) === JSON.stringify(CA.profileFor(AXF, v.id.slice(4), v.pricing.operational_metrics.complexity_tier)); }));
  check('the migration marker records the axes file it applied, and so does the source\'s provenance', mark.complexity_axes_sha256 === AXF.sha256 && SRC.provenance.complexity_axes && SRC.provenance.complexity_axes.sha256 === AXF.sha256, `${mark.complexity_axes_sha256} / ${SRC.provenance.complexity_axes && SRC.provenance.complexity_axes.sha256} vs ${AXF.sha256}`);
  const L = lib.readJson(lib.PATHS.legacy);
  { const A2 = lib.clone(AXF); delete A2.axes.services[Object.keys(A2.axes.services)[0]]; const m = migrate(lib.clone(L), { axes: A2 });
    check('counterfactual: a service the axes file does not name is reported by the migration, never defaulted (a new service cannot enter without its axes)', m.report.unresolved.some(u => /no entry in complexity_axes\.json/.test(u.what))); }
  { const A2 = lib.clone(AXF); A2.axes.services.no_such_service = lib.clone(A2.axes.services[Object.keys(A2.axes.services)[0]]); const m = migrate(lib.clone(L), { axes: A2 });
    check('counterfactual: a name in the axes file that btnyc.json does not define is reported', m.report.unresolved.some(u => /names a service btnyc\.json does not define/.test(u.what))); }
  const m0 = migrate(lib.clone(L));
  check('the migration of the real inputs reproduces the committed source byte for byte (nothing was hand-edited into it)', lib.toText(m0.source) === fs.readFileSync(lib.PATHS.source, 'utf8') && m0.report.unresolved.length === 0); }

// ---- 4. the checks can fail --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('\nCounterfactuals: each check above fails on its own mutant');
const mutant = (label, fn, want) => { const s = lib.clone(SRC); fn(s); const p = problems(s), d = dependent(s); check(`${label}`, want === 'dependent' ? d.length > 0 : p.some(x => want.test(x)), (want === 'dependent' ? d : p).slice(0, 2).join(' | ')); };
const first = s => servicesOf(s)[0], named = (s, id) => servicesOf(s).find(v => v.id === 'svc.' + id);
mutant('a service with no complexity_profile is found', s => { delete first(s).complexity_profile; }, /no complexity_profile/);
mutant('a profile without a risk tier is found', s => { delete first(s).complexity_profile.risk_tier; }, /has no risk_tier/);
mutant('a profile without the batch flag is found', s => { delete first(s).complexity_profile.batch_risk_compounds; }, /has no batch_risk_compounds/);
mutant('a skill tier outside the four is found', s => { first(s).complexity_profile.tier = 'expert'; }, /tier "expert" is not legal/);
mutant('a risk tier outside R0..R3 is found', s => { first(s).complexity_profile.risk_tier = 'R4'; }, /risk_tier "R4" is not legal/);
mutant('a batch flag that is not a boolean is found', s => { first(s).complexity_profile.batch_risk_compounds = 'maybe'; }, /is not a boolean/);
mutant('a skill tier that disagrees with the runtime\'s is found', s => { const v = first(s); v.pricing.operational_metrics.complexity_tier = v.complexity_profile.tier === 'skilled' ? 'routine' : 'skilled'; }, /disagrees with the tier the runtime reads/);
mutant('a risk tier that is not the highest of its hazards is found', s => { named(s, 'gfci_outlet_replacement').complexity_profile.risk_tier = 'R0'; }, /not the highest hazard/);
mutant('a signal the record shows but the profile does not name is found', s => { const p = named(s, 'toilet_install').complexity_profile; p.batch_risk_basis = p.batch_risk_basis.filter(b => !b.startsWith('single_use_consumable')); }, /its record shows single_use_consumable/);
mutant('a signal named without the record showing it ("belief alone is not a signal") is found', s => { const p = named(s, 'led_bulb_upgrade').complexity_profile; p.batch_risk_basis = ['overflow_formula']; p.batch_risk_compounds = true; }, /names overflow_formula, which its record does not show/);
mutant('a flag that disagrees with its grounds is found', s => { named(s, 'cabinet_knob_or_pull_install').complexity_profile.batch_risk_compounds = false; }, /batch_risk_compounds false but/);
mutant('an assembly service that loses its class is found', s => { delete named(s, 'pax_wardrobe_assembly').complexity_profile.assembly_class; }, /no assembly class/);
mutant('an assembly class whose minimum tier exceeds the tier is found', s => { named(s, 'pax_wardrobe_assembly').complexity_profile.assembly_class = 'A3'; }, /below the minimum of class A3/);
mutant('a catalog whose risk tier follows from the skill tier is found (derived, though every service has all three keys)', s => { for (const v of servicesOf(s)) { const p = v.complexity_profile; p.risk_tier = p.tier === 'routine' ? 'R0' : p.tier === 'skilled' ? 'R1' : 'R2'; p.risk_basis = [p.risk_tier === 'R0' ? 'none' : p.risk_tier === 'R1' ? 'minor_water' : 'active_water']; } }, 'dependent');
mutant('a catalog whose batch flag follows from the risk tier is found', s => { for (const v of servicesOf(s)) { const p = v.complexity_profile; p.batch_risk_compounds = RANK(p.risk_tier) >= 2; p.batch_risk_basis = p.batch_risk_compounds ? ['cut'] : []; } }, 'dependent');

// ---- 5. the resolver half -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('\nThe resolver half: no code path derives one axis from another (R-COMPLEX-AXES enforcement; R-COMPLEX-VOLUME: "skill_tier := f(minutes)" is forbidden)');
const stripComments = t => t.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
const runtimeFiles = ['qr.html', 'pricing_engine.js', 'orchestrator_engine.js', 'nlp_engine.js', ...fs.readdirSync(path.join(ROOT, 'modules')).filter(f => f.endsWith('.js')).map(f => 'modules/' + f)].filter(f => fs.existsSync(path.join(ROOT, f)));
const code = Object.fromEntries(runtimeFiles.map(f => [f, stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'))]));
const functionBody = (t, name) => { const i = t.indexOf('function ' + name + '('); if (i < 0) return null; let d = 0, j = t.indexOf('{', i); for (let k = j; k < t.length; k++) { if (t[k] === '{') d++; else if (t[k] === '}' && --d === 0) return t.slice(i, k + 1); } return null; };
// The pin. FOUND at T180 by this test. Price-affecting (the hourly rate follows the tier), so it is an Operator decision, PENDING_DECISIONS #229; remove the pin when #229 is ruled and the derivation is gone.
const PINNED_MINUTES_SITES = ['pricing_engine.js', 'qr.html'];
const sites = runtimeFiles.filter(f => /\.(min|max)_minutes\b/.test(code[f]));
check('KNOWN VIOLATION (pinned, #229): the only runtime sites that read global_rules.complexity_tiers min_minutes/max_minutes to derive a skill tier are exactly pricing_engine.js and qr.html', JSON.stringify(sites.slice().sort()) === JSON.stringify(PINNED_MINUTES_SITES.slice().sort()), sites.join(', '));
check('...and each is inside deriveComplexityTier(totalMinutes, ...), the one function that derives a tier from minutes', sites.every(f => { const b = functionBody(code[f], 'deriveComplexityTier'); return b && /\.min_minutes/.test(b) && /totalMinutes/.test(b); }));
check('...and nothing else in the runtime reads minutes to name a tier (a second site would be a new derivation)', runtimeFiles.every(f => (code[f].match(/\.(min|max)_minutes\b/g) || []).length === (sites.includes(f) ? 2 : 0)));
check('no runtime code reads risk_tier, batch_risk_compounds or complexity_profile yet, so no code path derives either from anything; the first consumer arrives with its own no-derivation check', runtimeFiles.every(f => !/risk_tier|batch_risk|complexity_profile/.test(code[f])));
{ // the symptom the Charter names: a tier that changes while only the quantity changes (DEFECT-AXIS-CONFLATION). Same answers, quantity 1..20, through the production quote path.
  const DB = lib.readJson(lib.PATHS.legacy); const sb = { DB, SERVICE_DATA: DB, window: { DB }, console: { log() {}, warn() {}, error() {} } }; sb.global = sb; vm.createContext(sb);
  for (const f of ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
  const moved = []; let swept = 0;
  for (const s of DB.services) {
    const st = q => ({ qty: q, intent: { key: s.id, category: s.ui_taxonomy.category_id, label: 'x', qtyLabel: 'item' }, stype: 'Repair', answers: {}, detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: [] });
    const tiers = [1, 2, 3, 5, 10, 20].map(q => { try { return sb.computeQuoteFromState(st(q)).tierKey; } catch (e) { return 'ERR'; } });
    swept++; if (new Set(tiers).size > 1) moved.push(s.id);
  }
  const PINNED_MOVED = ['loose_tile_replacement'];
  check(`non-vacuity: the sweep ran through the production quote path for all ${DB.services.length} services`, swept === DB.services.length && swept >= 70);
  check('KNOWN VIOLATION (pinned, #229): the services whose tier changes while ONLY the quantity changes are exactly ' + PINNED_MOVED.join(', ') + ' (skilled at 1 tile, specialized at 20: the hourly rate follows the minutes)', JSON.stringify(moved) === JSON.stringify(PINNED_MOVED), moved.join(', '));
  // the detector can fail: with the minutes derivation removed from the engine, the same sweep finds no service whose tier follows quantity
  const patched = fs.readFileSync(path.join(ROOT, 'pricing_engine.js'), 'utf8').replace(/if \(totalMinutes >= min && \(max == null \|\| totalMinutes <= max\)\) \{/, 'if (false) {');
  const sb2 = { DB, SERVICE_DATA: DB, window: { DB }, console: { log() {}, warn() {}, error() {} } }; sb2.global = sb2; vm.createContext(sb2);
  vm.runInContext(patched, sb2, { filename: 'pricing_engine.js' }); for (const f of ['nlp_engine.js', 'orchestrator_engine.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb2, { filename: f });
  check('counterfactual: the same sweep on an engine whose tier no longer follows minutes finds no service whose tier follows quantity (the detector sees the derivation, and only it)', patched !== fs.readFileSync(path.join(ROOT, 'pricing_engine.js'), 'utf8') && DB.services.every(s => { const t = q => sb2.computeQuoteFromState({ qty: q, intent: { key: s.id, category: s.ui_taxonomy.category_id, label: 'x', qtyLabel: 'item' }, stype: 'Repair', answers: {}, detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: [] }).tierKey; try { return new Set([1, 2, 3, 5, 10, 20].map(t)).size === 1; } catch (e) { return true; } })); }

// ---- 6. the declared gap ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('\nThe declared gap: dynamic services (P-COMPLEX-DYNAMIC)');
{ const r = V.validate(lib.clone(SRC)); const n = r.residuals.filter(x => x.kind === 'composition_axes_undeclared').length; const cmps = SRC.entities.reduce((a, e) => a + e.default_compositions.length, 0);
  check(`every default composition (${cmps}) is a declared residual: a dynamic service inherits its group's axes, no group declares them yet (#228); the count cannot change without this line changing`, n === cmps && cmps === 82, `${n} of ${cmps}`); }

console.log(`\n[Complexity axes: every service declares three independent axes] ${passed} passed, ${failed} failed (of ${passed + failed} checks)`);
process.exit(failed ? 1 : 0);
