#!/usr/bin/env node
/**
 * verify_entity_first_id_freeze.js -- an id that was published is not removed, renamed or reused except by a written retirement (T176; #165 gap 1; R-SYSTEM-IDENTITY, R-INVARIANT-FROZEN, R-TEST-CANFAIL).
 *
 * @enforces R-SYSTEM-IDENTITY
 * @enforces R-INVARIANT-FROZEN
 * @enforces R-TEST-CANFAIL
 * @detects DEFECT-FROZEN-INTERFACE
 *
 * THE DEFECT-SHAPE. The migration generated every id once and said they were "frozen", but nothing compared the ids with an earlier set. A consistent rename (the id changed in its definition AND in every reference)
 * leaves the source valid, so the validator passes it; the page, a saved cart, a test or a consumer outside the repository that holds the old id breaks anyway. The register (ssot/migration/id_register.json,
 * tools/entity_first/id_register.js) is the earlier set: every typed id, every option as `question_id#option_id`, every picker symptom and symptom tile as `group_id#id`.
 *
 * WHAT IS HELD:
 *   1. The committed register is current against the real source, recounted here from the raw JSON independently of the register tool's collector (a collector that silently dropped a type would pass its own check).
 *   2. A CONSISTENT rename of a service, a question or an option (every definition and every reference updated, so the validator still passes) is caught: the old id is lost, the new one is unregistered.
 *   3. Deleting a service, a question or an option is caught; adding one is caught as unregistered until `--write` appends it, after which the register passes (additions are free; losses are not).
 *   4. A rename done properly (a written retirement that names the old id, a reason, the replacement, a ledger ticket) passes; a retirement missing any of those, naming an id that was never registered, naming a
 *      replacement that does not exist, or repeated, fails with its own code. A retired id that is declared again is a reuse and fails.
 *   5. `--write` can only append: it refuses while an id is lost or reused, never removes or edits an id, never touches retired[], and is idempotent.
 *   6. Labels, display text and order are not ids: renaming every label and reversing every array changes nothing.
 *   7. The command line fails closed: a stale register, a lost id and a source that does not validate exit non-zero, in a scratch copy of the tree.
 *   8. The register is a guard and not an authority: it names its consumer, nothing the runtime ships reads it, and it is held to the canonical form.
 *
 * WHAT THE DETECTOR CANNOT SEE. An id that was never registered (added and removed before the first `--write`) was never frozen; the register starts at the T176 baseline (the ids the T175 migration produced),
 * so an id that changed between migration and baseline is not tracked. A consumer that holds an id the source never declared is not this check's business (V-REF-DANGLING is).
 */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const ROOT = process.env.BTNYC_ROOT ? path.resolve(process.env.BTNYC_ROOT) : path.resolve(__dirname, '..');
process.env.BTNYC_ROOT = ROOT;
const EF = path.join(__dirname, 'tools', 'entity_first');
const lib = require(path.join(EF, 'lib.js'));
const V = require(path.join(EF, 'validate_source.js'));
const R = require(path.join(EF, 'id_register.js'));

let passed = 0, failed = 0;
const check = (label, ok, detail) => { if (ok) { passed++; console.log(`  ✓ ${label}`); } else { failed++; console.log(`  ✗ ${label}${detail ? ' -- ' + detail : ''}`); } };
const need = (x, what) => { if (x === undefined || x === null || x === false) throw new Error('no site for the mutant: ' + what); return x; };

const SRC = lib.readJson(lib.PATHS.source);
const REG = JSON.parse(fs.readFileSync(R.REGISTER_PATH, 'utf8'));
const LIVE = R.collect(SRC);
const clone = o => JSON.parse(JSON.stringify(o));
const questionsOf = s => [...s.entities.flatMap(e => e.questions), ...s.shared_questions];
const servicesOf = s => s.entities.flatMap(e => e.services);
const codes = p => [...new Set(p.map(x => x.code))].sort().join(',');
const verdict = (reg, src) => { const v = V.validate(src); if (!v.declared) return { invalid: true, problems: [] }; return { invalid: false, valid: v.ok, problems: R.compare(reg, R.collect(src, v)).problems }; };
const has = (r, code, id) => r.problems.some(p => p.code === code && (id === undefined || p.id === id));
const textRename = (src, oldId, newId) => JSON.parse(JSON.stringify(src).split(JSON.stringify(oldId)).join(JSON.stringify(newId)));   // every definition, reference and key spelled "old"

// ---- 1. the committed register is current, and an independent recount agrees -------------------------------------------------------------------------------------------------------------
console.log('\nThe committed register against the real source');
{ const c = R.compare(REG, LIVE); check('the committed register is current: every registered id is live, none is reused, every live id is registered', c.problems.length === 0, codes(c.problems) + ' ' + c.problems.slice(0, 2).map(p => p.id).join(',')); }
{ const raw = { ent: SRC.entities.length, svc: servicesOf(SRC).length, cmp: SRC.entities.reduce((a, e) => a + e.default_compositions.length, 0), q: questionsOf(SRC).length,
    u: SRC.entities.reduce((a, e) => a + e.uncertainty_classes.length, 0) + SRC.shared_uncertainty_classes.length, opt: questionsOf(SRC).reduce((a, q) => a + (q.options || []).length, 0),
    grp: SRC.registries.groups.length, cat: SRC.registries.categories.length, tag: SRC.registries.tags.length, mat: SRC.registries.materials.length, act: SRC.registries.actions.length, mod: SRC.registries.modifiers.length,
    sym: SRC.registries.groups.reduce((a, g) => a + (g.picker.symptoms || []).length, 0), tile: SRC.registries.groups.reduce((a, g) => a + (g.picker.symptom_tiles || []).length, 0) };
  const off = Object.entries(raw).filter(([t, n]) => REG.ids[t].length !== n).map(([t, n]) => `${t}: register ${REG.ids[t].length}, raw ${n}`);
  check('an independent count of the raw source (entities, services, compositions, questions, classes, options, groups, categories, tags, materials, actions, modifiers, symptoms, tiles) equals the register', off.length === 0, off.join('; ')); }
check('the register covers all 17 typed id kinds the validator declares, plus option, symptom and tile pairs', R.ALL_TYPES.length === 20 && R.ALL_TYPES.every(t => Array.isArray(REG.ids[t]) && REG.ids[t].length > 0), R.ALL_TYPES.filter(t => !(REG.ids[t] || []).length).join(','));
check('every option pair is `question_id#option_id` and every question of the pair is a registered question', REG.ids.opt.every(p => { const [q] = p.split('#'); return p.split('#').length === 2 && REG.ids.q.includes(q); }));
check('nothing is retired yet, and the register says so (retired is the only way an id leaves)', Array.isArray(REG.retired) && REG.retired.length === 0, String((REG.retired || []).length));

// ---- 2. a consistent rename: the validator passes, the register catches it -------------------------------------------------------------------------------------------------------------------
console.log('\nA consistent rename is caught (the validator cannot see it)');
{ const svc = need(servicesOf(SRC).find(s => s.id === 'svc.angle_stop_replacement'), 'a service'); const s = textRename(SRC, svc.id, 'svc.angle_stop_swap'); const r = verdict(REG, s);
  check('renaming a service everywhere leaves the SOURCE VALID (the premise: the validator is blind to this)', !r.invalid && r.valid);
  check('...and the register reports the old id lost and the new one unregistered', has(r, 'R-LOST', svc.id) && has(r, 'R-UNREGISTERED', 'svc.angle_stop_swap'), codes(r.problems)); }
{ const q = need(questionsOf(SRC).find(x => x.id === 'q.angle_stop_condition'), 'a question'); const s = textRename(SRC, q.id, 'q.angle_stop_state'); const r = verdict(REG, s);
  check('renaming a question everywhere leaves the source valid, and the register reports the question AND each of its option pairs lost', !r.invalid && r.valid && has(r, 'R-LOST', q.id) && q.options.every(o => has(r, 'R-LOST', `${q.id}#${o.id}`)), codes(r.problems)); }
{ const s = clone(SRC); const q = need(questionsOf(s).find(x => (x.options || []).length > 2 && x.id !== 'q.general_symptom'), 'a question with options'); const o = q.options[1]; const old = o.id, nu = old + '_renamed'; o.id = nu;
  const walk = x => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { if (x.question_id === q.id && x.option_id === old) x.option_id = nu; if (x.question_id === q.id && Array.isArray(x.option_ids)) x.option_ids = x.option_ids.map(i => i === old ? nu : i); Object.values(x).forEach(walk); } };
  walk(s); const r = verdict(REG, s);
  check('renaming an option id (and every {question_id, option_id} that names it) leaves the source valid; the register reports the old pair lost', !r.invalid && r.valid && has(r, 'R-LOST', `${q.id}#${old}`) && has(r, 'R-UNREGISTERED', `${q.id}#${nu}`), r.invalid ? 'invalid' : codes(r.problems)); }
{ const s = clone(SRC); const g = need(s.registries.groups.find(x => (x.picker.symptoms || []).length), 'a group with symptoms'); const old = g.picker.symptoms[0].id; g.picker.symptoms[0].id = old + '_x';
  const r = verdict(REG, s); check('renaming a picker symptom id is reported lost', has(r, 'R-LOST', `${g.id}#${old}`), codes(r.problems)); }

// ---- 3. deletion and addition ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('\nDeleting is caught; adding is free once registered');
{ const s = clone(SRC); const svc = need(servicesOf(s).find(x => x.id === 'svc.angle_stop_replacement'), 'a service');
  for (const e of s.entities) e.services = e.services.filter(x => x.id !== svc.id);
  s.registries.service_order = s.registries.service_order.filter(i => i !== svc.id); for (const g of s.registries.groups) g.explicit_services = g.explicit_services.filter(i => i !== svc.id);
  const r = verdict(REG, s); check('deleting a service (when nothing references it) is reported lost', has(r, 'R-LOST', svc.id), r.invalid ? 'the mutant is invalid: ' + codes(r.problems) : codes(r.problems)); }
{ const s = clone(SRC); const q = need(questionsOf(s).find(x => (x.options || []).length > 2), 'a question'); const o = q.options.pop();
  const r = verdict(REG, s); check('deleting an option (the last one) is reported lost, as its pair', !r.invalid && has(r, 'R-LOST', `${q.id}#${o.id}`), r.invalid ? 'the mutant is invalid (a vacuous pass)' : codes(r.problems)); }
{ const s = clone(SRC); const q = need(questionsOf(s).find(x => (x.options || []).length > 1), 'a question'); const nu = clone(q.options[q.options.length - 1]); nu.id = 'added_by_the_test'; q.options.push(nu);
  const r = verdict(REG, s); check('adding an option is reported unregistered (a stale register cannot defend what it does not list)', has(r, 'R-UNREGISTERED', `${q.id}#added_by_the_test`) && !r.problems.some(p => p.code !== 'R-UNREGISTERED'), codes(r.problems));
  const live = R.collect(s, V.validate(s)); const next = R.appendOnly(REG, live); const r2 = R.compare(next, live);
  check('...and after --write appends it, the register passes', r2.problems.length === 0 && next.ids.opt.includes(`${q.id}#added_by_the_test`), codes(r2.problems)); }

// ---- 4. retirement ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('\nA rename is a written retirement');
const RET = (over) => Object.assign({ id: 'svc.angle_stop_replacement', type: 'svc', reason: 'renamed to match the catalog wording (test fixture)', replaced_by: 'svc.angle_stop_swap', ticket: '#165', retired_in: 'T176' }, over || {});
{ const s = textRename(SRC, 'svc.angle_stop_replacement', 'svc.angle_stop_swap'); const live = R.collect(s, V.validate(s));
  const reg = clone(REG); reg.retired = [RET()]; reg.ids.svc = [...reg.ids.svc, 'svc.angle_stop_swap'].sort();
  check('a rename with a written retirement (reason, replacement, ticket) passes', R.compare(reg, live).problems.length === 0, codes(R.compare(reg, live).problems));
  const bad = (label, over, code) => { const g = clone(reg); g.retired = [RET(over)]; const c = R.compare(g, live); check(label, c.problems.some(p => p.code === code), codes(c.problems)); };
  bad('...but a retirement with no reason fails', { reason: '' }, 'R-RETIRE-FORM');
  bad('...with no ticket fails', { ticket: '' }, 'R-RETIRE-FORM');
  bad('...with a ticket that is not a ledger entry fails', { ticket: 'because' }, 'R-RETIRE-FORM');
  bad('...with no retired_in fails', { retired_in: '' }, 'R-RETIRE-FORM');
  bad('...with a replacement that is not a live id of its type fails', { replaced_by: 'svc.nothing_like_it' }, 'R-RETIRE-REPLACEMENT');
  bad('...with a replacement that is itself fails', { replaced_by: 'svc.angle_stop_replacement' }, 'R-RETIRE-REPLACEMENT');
  bad('...with an unknown type fails', { type: 'widget' }, 'R-RETIRE-FORM');
  { const g = clone(reg); g.retired = [RET(), RET()]; check('...repeated, fails', R.compare(g, live).problems.some(p => p.code === 'R-RETIRE-DUPLICATE')); }
  { const g = clone(reg); g.retired = [RET({ id: 'svc.never_existed', replaced_by: null })]; check('...naming an id that was never registered fails (nothing to retire)', R.compare(g, live).problems.some(p => p.code === 'R-RETIRE-UNKNOWN'), codes(R.compare(g, live).problems)); }
  { const g = clone(reg); g.retired = [RET({ replaced_by: null })]; check('...a retirement with no replacement (replaced_by null) is allowed: some ids are simply gone', R.compare(g, live).problems.length === 0, codes(R.compare(g, live).problems)); }
  { const g = clone(reg); g.retired = [RET()]; delete g.retired[0].replaced_by; check('...but omitting replaced_by altogether is not (null is a decision, absence is an oversight)', R.compare(g, live).problems.some(p => p.code === 'R-RETIRE-FORM')); } }
{ const reg = clone(REG); reg.retired = [RET({ id: 'svc.angle_stop_replacement', replaced_by: null })]; const c = R.compare(reg, LIVE);
  check('a retired id that the source still declares is a REUSE and fails', c.problems.some(p => p.code === 'R-REUSE' && p.id === 'svc.angle_stop_replacement'), codes(c.problems)); }

// ---- 5. --write can only append --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('\nWriting the register can only append');
{ const s = textRename(SRC, 'svc.angle_stop_replacement', 'svc.angle_stop_swap'); const live = R.collect(s, V.validate(s)); let threw = null; try { R.appendOnly(REG, live); } catch (e) { threw = e; }
  check('--write refuses while a registered id is lost (it would otherwise bless the rename)', !!threw && (threw.problems || []).some(p => p.code === 'R-LOST'), threw && threw.message); }
{ const reg = clone(REG); reg.retired = [RET({ id: 'svc.angle_stop_replacement', replaced_by: null })]; let threw = null; try { R.appendOnly(reg, LIVE); } catch (e) { threw = e; } check('--write refuses while a retired id is reused', !!threw && (threw.problems || []).some(p => p.code === 'R-REUSE')); }
{ const next = R.appendOnly(REG, LIVE); check('--write on a current register changes nothing (idempotent) and never edits retired[]', R.render(next) === R.render(REG) && JSON.stringify(next.retired) === JSON.stringify(REG.retired)); }
{ const s = clone(SRC); questionsOf(s).find(q => (q.options || []).length > 1).options.push({ id: 'x_new', label: 'New', affects: [], tag_ids: [] }); const live = R.collect(s, V.validate(s)); const next = R.appendOnly(REG, live);
  check('--write keeps every old id and adds only the new one', R.ALL_TYPES.every(t => REG.ids[t].every(id => next.ids[t].includes(id))) && R.ALL_TYPES.reduce((a, t) => a + next.ids[t].length - REG.ids[t].length, 0) === 1); }
{ const empty = R.emptyRegister(); const next = R.appendOnly(empty, LIVE); check('from an empty register --write reproduces the committed register (the baseline is derivable from the source)', R.render(next).replace(/"\$comment": "[^"]*"/, '') === R.render(REG).replace(/"\$comment": "[^"]*"/, '')); }

// ---- 6. labels and order are not ids ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('\nLabels and order are not ids');
{ const s = clone(SRC); questionsOf(s).forEach(q => (q.options || []).forEach((o, i) => { o.label = 'Renamed ' + i; })); servicesOf(s).forEach(x => { x.presentation.ui_taxonomy.display_name = 'Renamed ' + x.id; }); s.entities.forEach(e => { e.label = 'Renamed ' + e.id; });
  const r = verdict(REG, s); check('renaming every option label, service display name and entity label changes no registered id', !r.invalid && r.valid && r.problems.length === 0, codes(r.problems)); }
{ const s = clone(SRC); s.entities.reverse(); s.registries.tags.reverse(); s.registries.groups.reverse(); questionsOf(s).forEach(q => (q.options || []).reverse()); const r = verdict(REG, s);
  check('reversing the entities, tags, groups and every option list changes no registered id', !r.invalid && r.problems.length === 0, codes(r.problems)); }

// ---- 7. the command line fails closed (scratch copy of the tree) -----------------------------------------------------------------------------------------------------------------------------------------------
console.log('\nThe command line fails closed');
const tool = path.join(EF, 'id_register.js');
const run = (root, mode) => cp.spawnSync(process.execPath, [tool, mode], { env: Object.assign({}, process.env, { BTNYC_ROOT: root }), encoding: 'utf8' });
const scratch = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'idreg-')); fs.mkdirSync(path.join(d, 'ssot', 'migration'), { recursive: true }); fs.copyFileSync(lib.PATHS.source, path.join(d, 'ssot', 'btnyc_source.json')); fs.copyFileSync(R.REGISTER_PATH, path.join(d, 'ssot', 'migration', 'id_register.json')); return d; };
{ const d = scratch(); try {
    check('--check exits 0 on the real tree', run(ROOT, '--check').status === 0, (run(ROOT, '--check').stderr || '').slice(0, 200));
    check('--check exits 0 on a scratch copy of it', run(d, '--check').status === 0);
    const sp = path.join(d, 'ssot', 'btnyc_source.json'); fs.writeFileSync(sp, JSON.stringify(textRename(SRC, 'svc.angle_stop_replacement', 'svc.angle_stop_swap'), null, 2));
    const a = run(d, '--check'); check('--check exits non-zero after a consistent rename, and names the lost id', a.status === 1 && /R-LOST/.test(a.stderr) && /svc\.angle_stop_replacement/.test(a.stderr), a.status + ' ' + (a.stderr || '').slice(0, 160));
    const b = run(d, '--write'); check('--write exits non-zero after it, and leaves the register as it was', b.status === 1 && fs.readFileSync(path.join(d, 'ssot', 'migration', 'id_register.json'), 'utf8') === fs.readFileSync(R.REGISTER_PATH, 'utf8'), b.status + ' ' + (b.stderr || '').slice(0, 160));
    const broken = clone(SRC); broken.entities[0].services = 'not an array'; fs.writeFileSync(sp, JSON.stringify(broken)); const c = run(d, '--check');
    check('--check exits non-zero (does not pass) when the source does not validate', c.status !== 0, String(c.status));
    fs.writeFileSync(sp, JSON.stringify(SRC, null, 2)); const rp = path.join(d, 'ssot', 'migration', 'id_register.json'); const reg = JSON.parse(fs.readFileSync(rp, 'utf8')); reg.ids.svc.pop(); fs.writeFileSync(rp, JSON.stringify(reg, null, 2) + '\n');
    const e = run(d, '--check'); check('--check exits non-zero when the register is stale (a live id is not registered)', e.status === 1 && /R-UNREGISTERED/.test(e.stderr), e.status + ' ' + (e.stderr || '').slice(0, 160));
    const f = run(d, '--write'); check('...and --write then repairs it, after which --check passes', f.status === 0 && run(d, '--check').status === 0);
    fs.rmSync(rp); const g = run(d, '--check'); check('--check exits non-zero when the register file is missing (absence is not a pass)', g.status === 1, String(g.status));
  } finally { fs.rmSync(d, { recursive: true, force: true }); } }

// ---- 8. a guard, not an authority ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('\nA guard, not an authority');
check('the register names its consumer and says it is a guard', /Guard, not authority/.test(REG.$comment) && /verify_entity_first_id_freeze\.js/.test(REG.$comment));
check('the register is in canonical form (sorted, rendered by the tool)', R.render(REG) === fs.readFileSync(R.REGISTER_PATH, 'utf8') && R.ALL_TYPES.every(t => JSON.stringify(REG.ids[t]) === JSON.stringify([...REG.ids[t]].sort())));
{ const shipped = []; const scan = d => { for (const n of fs.readdirSync(d, { withFileTypes: true })) { if (n.name === 'node_modules' || n.name === '.git') continue; const p = path.join(d, n.name); if (n.isDirectory()) scan(p); else if (/\.(js|html)$/.test(n.name)) shipped.push(p); } };
  scan(path.join(ROOT, 'modules')); scan(path.join(ROOT, 'js')); shipped.push(path.join(ROOT, 'qr.html'));
  const readers = shipped.filter(f => fs.existsSync(f) && /id_register/.test(fs.readFileSync(f, 'utf8')));
  check('nothing the page ships (qr.html, modules/, js/) reads the register', readers.length === 0, readers.map(f => path.relative(ROOT, f)).join(',')); }

console.log(`\n[Entity-first id freeze] ${passed} passed, ${failed} failed (of ${passed + failed} checks)`);
process.exit(failed ? 1 : 0);
