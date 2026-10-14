#!/usr/bin/env node
/**
 * verify_entity_first_migration.js -- the entity-first migration is idempotent and deterministic, and the source CARRIES everything btnyc.json authors (T175; R-SYSTEM-DUALSOURCE, R-INVARIANT-DERIVATION, R-TEST-CANFAIL).
 *
 * @enforces R-SYSTEM-DUALSOURCE
 * @enforces R-INVARIANT-DERIVATION
 * @enforces R-TEST-CANFAIL
 * @detects DEFECT-DERIVED-AUTHORITY
 * @detects DEFECT-TEST-CANTFAIL
 *
 * THE DEFECT-SHAPE. btnyc.json (service-first, ~45k lines) is re-authored as ssot/btnyc_source.json (entity-first). While both exist (a bounded dual-source transition, ssot/TRANSITION_DUALSOURCE.md) the
 * failure that matters is silent loss or silent drift: a curated value (a picker label, a tile, a component link, a gap, an answer, a fee, a branch) that the source no longer holds; or a value the source
 * holds that the legacy file does not; or a migration whose output depends on the order the legacy file happened to list things in (it did: `registries.contexts` was in order of first use, found by this test).
 *
 * WHAT IS HELD (properties of the migration and the projection, not of any one value):
 *   1. Idempotence: migrating twice gives byte-identical text, and migrate(project(migrate(L))) == migrate(L): the source is a fixed point of the round trip source -> legacy -> source. Migration does not write
 *      to its input.
 *   2. Determinism: deriving the graph twice gives byte-identical text; a source whose object keys are listed in the opposite order derives a structurally equal graph (key order is not meaning).
 *   3. Content preservation (the parity check): the projection of the source reproduces EVERY authored section of btnyc.json, except the declared normalizations; and the production compiler, run on that projection
 *      alone, reproduces all 8 compiler-owned keys. Both checks are run on the real data AND must FAIL on counterfactuals of every class:
 *        - a curated value dropped or changed in the source (an answer label, a fee, a base price, a branch, a picker tile, a component link, a tag, a vocabulary entry, a formula, a checkout state, a group ...);
 *        - a curated value ADDED to the source that the legacy file does not have (drift the other way);
 *        - a curated value added to ANY authored top-level section of the legacy file (a section the projection did not compare would pass);
 *   4. The pinned normalization list cannot grow silently or go stale: an undeclared difference fails, a declared one that no longer occurs fails, an unknown class fails.
 *   5. The generated reports and the provenance ledger are current: a number edited by hand, or a source/legacy change that was not re-reported, fails `report.js --check`.
 *
 * Node + python3; no browser, no network.
 */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const ROOT = process.env.BTNYC_ROOT ? path.resolve(process.env.BTNYC_ROOT) : path.resolve(__dirname, '..');
process.env.BTNYC_ROOT = ROOT;
const EF = path.join(__dirname, 'tools', 'entity_first');
const lib = require(path.join(EF, 'lib.js'));
const { migrate } = require(path.join(EF, 'migrate_legacy.js'));
const PL = require(path.join(EF, 'project_legacy.js'));
const RT = require(path.join(EF, 'compiler_roundtrip.js'));
const DN = require(path.join(EF, 'declared_normalizations.js'));
const { derive } = require(path.join(EF, 'derive_graph.js'));

let passed = 0, failed = 0;
const check = (label, ok, detail) => { if (ok) { passed++; console.log(`  ✓ ${label}`); } else { failed++; console.log(`  ✗ ${label}${detail ? ' -- ' + detail : ''}`); } };
const deepFreeze = o => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };

const LEGACY = lib.readJson(lib.PATHS.legacy);
const SRCTEXT = fs.readFileSync(lib.PATHS.source, 'utf8'); const SRC = JSON.parse(SRCTEXT);
const questionsOf = s => [...s.entities.flatMap(e => e.questions), ...s.shared_questions];
const need = (x, what) => { if (x === undefined || x === null) throw new Error('no site for the mutant: ' + what); return x; };

// ---- 1. idempotence ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('Idempotence');
const m1 = migrate(lib.clone(LEGACY)), m2 = migrate(lib.clone(LEGACY));
const t1 = lib.toText(m1.source);
check('migrating the legacy file twice gives byte-identical text', t1 === lib.toText(m2.source));
check('the migration report is identical twice (no clock, no order dependence)', JSON.stringify(m1.report) === JSON.stringify(m2.report));
{ let threw = null; try { migrate(deepFreeze(lib.clone(LEGACY))); } catch (e) { threw = e.message; } check('migrate() on a deep-frozen legacy file does not throw (it writes nothing it reads)', threw === null, threw || ''); }
{ // source -> legacy -> source is the identity: the projection is a faithful inverse, and the migration is a pure function of the authored content
  const proj = PL.project(m1.source); const L2 = Object.assign({}, lib.clone(LEGACY), lib.authoredLegacy(proj)); const m3 = migrate(L2);
  const d = lib.diffAll(m1.source, m3.source, '$', [], 5);
  check('migrate(project(migrate(L))) == migrate(L): the source is a fixed point of the round trip', lib.toText(m3.source) === t1, d.map(x => x.path).join(', ')); }
{ const V = require(path.join(EF, 'validate_source.js')); const vr = V.validate(lib.clone(m1.source)); const kept = vr.residuals.filter(r => r.kind === 'dangling_legacy_reference').length;
  check(`the migration leaves no unresolved node, and every dangling legacy reference it found (${m1.report.danglingLegacy.length}) is kept visibly as a validator residual (${kept}), neither dropped nor given an invented target`, Array.isArray(m1.report.unresolved) && m1.report.unresolved.length === 0 && Array.isArray(m1.report.danglingLegacy) && m1.report.danglingLegacy.length === kept, JSON.stringify(m1.report.unresolved).slice(0, 200)); }

{ // a deep-dive question is asked of the unit's customer: it is a use, so the question's entity_scope covers the deep-diving entity (found at T175: q.attempted_fix was scoped to ONE entity while 33 deep-dived it)
  const V = require(path.join(EF, 'validate_source.js')); const L2 = lib.clone(LEGACY); const s0 = L2.services[0]; const free = Object.keys(L2.intake_modules).find(k => !JSON.stringify(L2.services).includes('"' + k + '"') && !JSON.stringify(L2.dynamic_services).includes('"' + k + '"') && !JSON.stringify(L2.group).includes('"' + k + '"'));
  s0.remote_deep_dive_modules = [...(s0.remote_deep_dive_modules || []), free]; const mm = migrate(L2).source; const q = [...mm.entities.flatMap(e => e.questions), ...mm.shared_questions].find(x => x.id === 'q.' + free); const ent = mm.entities.find(e => e.services.some(v => v.id === 'svc.' + s0.id)).id;
  check(`a legacy module that is only a deep-dive question (${free}) is scoped to the entity that deep-dives it (${ent}), not left unreferenced`, Array.isArray(q.entity_scope) && q.entity_scope.includes(ent), JSON.stringify(q.entity_scope));
  check('...and that source validates (the validator counts the deep-dive use too)', V.validate(mm).ok, JSON.stringify(V.validate(mm).errors.slice(0, 2))); }

// ---- 2. determinism of the derivation --------------------------------------------------------------------------------------------------------------------------------------------------
console.log('\nDeterminism');
const validated = { ok: true, errors: [] };
const g1 = derive(lib.clone(SRC), SRCTEXT, { validated }), g2 = derive(lib.clone(SRC), SRCTEXT, { validated });
check('deriving the graph twice gives byte-identical text', lib.toText(g1) === lib.toText(g2));
const revKeys = o => Array.isArray(o) ? o.map(revKeys) : (o && typeof o === 'object' ? Object.fromEntries(Object.keys(o).reverse().map(k => [k, revKeys(o[k])])) : o);
check('a source with every object\'s keys in the opposite order derives a structurally equal graph (key order is not meaning)', lib.diff(g1, derive(revKeys(SRC), SRCTEXT, { validated })) === null);
{ const frozen = deepFreeze(lib.clone(SRC)); let threw = null; try { derive(frozen, SRCTEXT, { validated }); } catch (e) { threw = e.message; } check('derive() on a deep-frozen source does not throw (derivation writes nothing it reads)', threw === null, threw || ''); }

// ---- 3. content preservation: the parity check, real and counterfactual ------------------------------------------------------------------------------------------------------------------
console.log('\nContent preservation (real data)');
const par = PL.check(lib.clone(SRC), LEGACY);
check('the projection of the source reproduces every authored section of btnyc.json (no difference outside the pinned normalizations)', par.diffs.length === 0 && par.problems.length === 0, par.diffs.slice(0, 3).map(d => d.path).join(', ') + ' ' + par.problems.join('; '));
const rt = RT.run(lib.clone(SRC), LEGACY);
check('the production compiler, run on the projection alone, reproduces all 8 compiler-owned keys', rt.ok && rt.compilerKeys === 8 && rt.differ.length === 0, rt.why || (rt.differ || []).map(d => d.key).join(','));
check('...and is hash-seed independent (two PYTHONHASHSEEDs, byte-identical output)', !(rt.why || '').includes('hash seed'));

console.log('\nContent preservation (counterfactual): a curated value lost or changed in the source is detected');
const detectsInSource = (label, mutate) => {
  const s = lib.clone(SRC); let site = null; try { mutate(s); } catch (e) { site = e.message; }
  if (site) { check(label, false, 'the mutation could not be applied: ' + site); return; }
  if (lib.diff(s, SRC) === null) { check(label, false, 'the mutation changed nothing'); return; }
  const r = PL.check(s, LEGACY); const found = r.diffs.length > 0 || r.problems.length > 0;
  check(label, found, 'the parity check ACCEPTED the loss');
};
detectsInSource('an answer label changed', s => { need(questionsOf(s).find(q => q.options), 'a question with options').options[0].label += ' (edited)'; });
detectsInSource('an answer dropped', s => { need(questionsOf(s).find(q => q.options && q.options.length > 2), 'a question with 3 answers').options.pop(); });
detectsInSource('a question prompt changed', s => { questionsOf(s).find(q => q.prompt).prompt += ' ?!'; });
detectsInSource('a modifier fee changed', s => { const m = s.registries.modifiers.find(x => typeof x.fee === 'number'); m.fee += 1; });
detectsInSource('a service base price changed', s => { s.entities.flatMap(e => e.services).find(v => typeof v.pricing.financial_engine.base_price === 'number').pricing.financial_engine.base_price += 1; });
detectsInSource('a service display name changed', s => { s.entities.flatMap(e => e.services)[0].presentation.ui_taxonomy.display_name += '!'; });
detectsInSource('a branch (a gated question) lost its gate', s => { const st = need(s.entities.flatMap(e => e.services).flatMap(v => v.intake.steps).find(x => x.depends_on.length), 'a gated step'); st.depends_on = []; });
detectsInSource('a branch lost one of its alternatives', s => { const st = need(s.entities.flatMap(e => e.services).flatMap(v => v.intake.steps).find(x => x.depends_on.some(t => t.any_of && t.any_of.length > 1)), 'an any_of gate'); const t = st.depends_on.find(x => x.any_of && x.any_of.length > 1); t.any_of.pop(); });
detectsInSource('a question\'s own dependency dropped', s => { need(questionsOf(s).find(q => q.depends_on.length), 'a question with depends_on').depends_on = []; });
detectsInSource('a picker symptom tile dropped (curated routing_archetypes knowledge)', s => { need(s.registries.groups.find(g => g.picker.symptom_tiles && g.picker.symptom_tiles.length), 'a group with tiles').picker.symptom_tiles.pop(); });
detectsInSource('a picker known-need tile relabelled', s => { need(s.registries.groups.find(g => g.picker.known_need_tiles && g.picker.known_need_tiles.length), 'a group with known-need tiles').picker.known_need_tiles[0].label += '!'; });
detectsInSource('a picker component link dropped', s => { need(s.registries.groups.find(g => g.picker.component_links && g.picker.component_links.length), 'a group with component links').picker.component_links.pop(); });
detectsInSource('a picker prompt changed', s => { need(s.registries.groups.find(g => g.picker.symptom_prompt), 'a group with a symptom prompt').picker.symptom_prompt += '!'; });
detectsInSource('a smart tag dropped', s => { s.registries.tags.pop(); });
detectsInSource('a smart tag\'s mutual exclusion dropped', s => { const t = need(s.registries.tags.find(x => x.mutually_exclusive && x.mutually_exclusive.length), 'a tag with exclusions'); t.mutually_exclusive = []; });
detectsInSource('a pricing formula parameter changed', s => { const f = s.registries.pricing_formulas.find(x => Object.values(x).some(v => typeof v === 'number')); const k = Object.keys(f).find(key => typeof f[key] === 'number'); f[k] += 1; });
detectsInSource('a checkout state changed', s => { const c = s.registries.checkout_states[0]; const k = Object.keys(c).find(key => typeof c[key] === 'string' && key !== 'id'); c[k] += '!'; });
detectsInSource('a material dropped', s => { s.registries.materials.pop(); });
detectsInSource('a furniture entry dropped', s => { s.registries.furniture.pop(); });
detectsInSource('a group dropped', s => { s.registries.groups.pop(); });
detectsInSource('a category relabelled', s => { const c = s.registries.categories[0]; const k = Object.keys(c).find(key => typeof c[key] === 'string' && key !== 'id' && !/^grp\./.test(c[key])); c[k] += '!'; });
detectsInSource('a behavioral class changed', s => { const c = s.registries.behavioral_classes[0]; const k = Object.keys(c).find(key => typeof c[key] === 'string' && key !== 'id' && !/^[a-z]{1,4}\./.test(c[key])); c[k] += '!'; });
detectsInSource('a vocabulary (NLP) entry dropped', s => { s.vocabulary.nlp_objects.pop(); });
detectsInSource('a vocabulary default fallback changed', s => { const f = s.vocabulary.nlp_default_fallback; const k = Object.keys(f).find(key => typeof f[key] === 'string' && !/^[a-z]{1,4}\./.test(f[key])); f[k] += '!'; });
detectsInSource('a policy rule changed', s => { s.policy.ui_config.__curated_edit__ = true; });
detectsInSource('a meta field changed', s => { s.meta.note = String(s.meta.note) + '!'; });
detectsInSource('a default composition\'s pricing changed', s => { const c = s.entities.flatMap(e => e.default_compositions)[0]; c.pricing.financial_engine.base_price = (c.pricing.financial_engine.base_price || 0) + 1; });
detectsInSource('a service dropped from a group\'s explicit list', s => { need(s.registries.groups.find(g => g.explicit_services && g.explicit_services.length), 'a group with explicit services').explicit_services.pop(); });

console.log('\nContent preservation (counterfactual): a curated value ADDED to the source, or to any authored legacy section, is detected');
detectsInSource('a modifier added to the source that btnyc.json does not have', s => { s.registries.modifiers.push(Object.assign(lib.clone(s.registries.modifiers[0]), { id: 'mod.added_in_source_only' })); });
detectsInSource('a tag added to the source that btnyc.json does not have', s => { s.registries.tags.push(Object.assign(lib.clone(s.registries.tags[0]), { id: 'tag.added_in_source_only' })); });
detectsInSource('an answer added to the source that btnyc.json does not have', s => { const q = questionsOf(s).find(x => x.options); q.options.push(Object.assign(lib.clone(q.options[0]), { id: 'added_in_source_only', label: 'Added in the source only' })); });
{ // every authored top-level section of the legacy file is compared by the projection: add a curated value to each in turn
  const sections = Object.keys(lib.authoredLegacy(LEGACY)); const blind = [];
  for (const k of sections) {
    const L2 = lib.clone(LEGACY); const v = L2[k];
    if (Array.isArray(v)) v.push(typeof v[0] === 'object' && v[0] !== null && !Array.isArray(v[0]) ? Object.assign(lib.clone(v[0]), { id: '__added_to_legacy__' }) : '__added_to_legacy__');
    else if (v && typeof v === 'object') { const first = Object.values(v)[0]; v.__added_to_legacy__ = first && typeof first === 'object' && !Array.isArray(first) ? lib.clone(first) : 'x'; } // an entry shaped like its neighbours
    else L2[k] = String(v) + '__added_to_legacy__';
    const r = PL.check(lib.clone(SRC), L2); if (!(r.diffs.length || r.problems.length)) blind.push(k);
  }
  check(`a value added to each of the ${sections.length} authored sections of btnyc.json is detected (sections the projection does not compare: ${blind.join(', ') || 'none'})`, sections.length > 5 && blind.length === 0); }

console.log('\nThe compiler round trip also fails on a lost curated value');
{ const detectsInCompile = (label, mutate) => { const s = lib.clone(SRC); try { mutate(s); } catch (e) { check(label, false, 'could not apply: ' + e.message); return; } const r = RT.run(s, LEGACY); check(label, !r.ok, 'the compiler round trip ACCEPTED the loss'); };
  detectsInCompile('a picker symptom tile dropped: the compiled routing_archetypes no longer match', s => { need(s.registries.groups.find(g => g.picker.symptom_tiles && g.picker.symptom_tiles.length), 'tiles').picker.symptom_tiles.pop(); });
  detectsInCompile('a picker component link dropped: the compiled picker no longer matches', s => { need(s.registries.groups.find(g => g.picker.component_links && g.picker.component_links.length), 'links').picker.component_links.pop(); });
  detectsInCompile('a service lost a branch: the compiled module index no longer matches', s => { need(s.entities.flatMap(e => e.services).flatMap(v => v.intake.steps).find(x => x.depends_on.length), 'a gated step').depends_on = []; });
  detectsInCompile('a service\'s pricing formula changed: the compiled service index no longer matches', s => { const v = s.entities.flatMap(e => e.services).find(x => x.pricing.financial_engine.pricing_archetype); v.pricing.financial_engine.pricing_archetype = s.registries.pricing_archetypes.find(p => p.id !== v.pricing.financial_engine.pricing_archetype).id; }); }

// ---- 4. the normalization pin list ---------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('\nDeclared normalizations cannot grow silently or go stale');
{ const classes = Object.keys(DN.PINNED); const obs = Object.fromEntries(classes.map(k => [k, DN.PINNED[k].where.slice()]));
  check('observing exactly what is pinned gives no problem', DN.verify(obs, classes).length === 0);
  const extra = lib.clone(obs); extra.chain_layout.push('some_service_that_changed_layout'); check('an UNDECLARED difference is a problem (the list cannot grow silently)', DN.verify(extra, classes).some(p => /^undeclared chain_layout/.test(p)));
  const gone = lib.clone(obs); gone.empty_branch_lists = []; check('a declared difference that no longer occurs is a problem (the list cannot go stale)', DN.verify(gone, classes).some(p => /no longer occurs/.test(p)));
  const unk = lib.clone(obs); unk.invented_class = ['x']; check('an observed class that is not declared is a problem', DN.verify(unk, classes).some(p => /not a declared normalization class/.test(p)));
  check('every pinned entry states its reason', classes.every(k => typeof DN.PINNED[k].reason === 'string' && DN.PINNED[k].reason.length > 40 && DN.PINNED[k].where.length > 0));
  // end to end: a legacy file in which a pinned difference no longer occurs makes the REAL parity check fail
  const L2 = lib.clone(LEGACY); const ra = L2.routing_archetypes.minor_home_repairs_ceilings; ra.real_action_ids = ra.real_action_ids.filter(a => !/^act\./.test(a));
  const r = PL.check(lib.clone(SRC), L2); check('end to end: removing the double spelling from the legacy file makes the parity check report the stale pin', r.problems.some(p => /no longer occurs/.test(p) && /action_double_spelling/.test(p)), r.problems.join('; ')); }

// ---- 5. the reports and the ledger cannot go stale -----------------------------------------------------------------------------------------------------------------------------------------
console.log('\nGenerated reports are current');
{ const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ef-mig-'));
  try {
    fs.copyFileSync(lib.PATHS.legacy, path.join(tmp, 'btnyc.json')); fs.cpSync(path.join(ROOT, 'ssot'), path.join(tmp, 'ssot'), { recursive: true });
    fs.symlinkSync(path.join(ROOT, 'schema'), path.join(tmp, 'schema')); fs.symlinkSync(path.join(ROOT, 'test_harness'), path.join(tmp, 'test_harness'));
    const run = () => cp.spawnSync('node', [path.join(EF, 'report.js'), '--check'], { encoding: 'utf8', env: Object.assign({}, process.env, { BTNYC_ROOT: tmp }), maxBuffer: 1 << 26 });
    const ok = run(); check('report.js --check passes on an unmodified copy', ok.status === 0, (ok.stdout + ok.stderr).slice(0, 300));
    const cov = path.join(tmp, 'ssot', 'COVERAGE_REPORT.md'); const txt = fs.readFileSync(cov, 'utf8');
    const m = /\b(\d{1,3}(?:,\d{3})*)\b/.exec(txt.slice(txt.indexOf('\n## ')));
    fs.writeFileSync(cov, txt.replace(m[1], String(Number(m[1].replace(/,/g, '')) + 7)));
    const bad = run(); check('a number edited by hand in the coverage report fails report.js --check', bad.status !== 0, (bad.stdout + bad.stderr).slice(0, 200));
    fs.writeFileSync(cov, txt);
    const led = path.join(tmp, 'ssot', 'migration', 'provenance_ledger.json'); const L = JSON.parse(fs.readFileSync(led, 'utf8')); L.ledger.pop(); fs.writeFileSync(led, JSON.stringify(L, null, 2) + '\n');
    const bad2 = run(); check('a row removed from the provenance ledger fails report.js --check', bad2.status !== 0, (bad2.stdout + bad2.stderr).slice(0, 200));
    fs.writeFileSync(led, JSON.stringify(Object.assign(L, { ledger: JSON.parse(fs.readFileSync(lib.PATHS.ledger, 'utf8')).ledger }), null, 2) + '\n');
    const src = path.join(tmp, 'ssot', 'btnyc_source.json'); const S2 = JSON.parse(fs.readFileSync(src, 'utf8')); S2.entities[0].label += ' (renamed)'; fs.writeFileSync(src, lib.toText(S2));
    const bad3 = run(); check('a source edit that was not re-reported fails report.js --check (the counts and the graph hash moved)', bad3.status !== 0, (bad3.stdout + bad3.stderr).slice(0, 200));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); } }

// ---- 6. the migration cannot destroy an authoritative source ---------------------------------------------------------------------------------------------------------------------------------
console.log('\nThe migration will not overwrite an edited source');
{ const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ef-mig2-'));
  try {
    fs.copyFileSync(lib.PATHS.legacy, path.join(tmp, 'btnyc.json')); fs.cpSync(path.join(ROOT, 'ssot'), path.join(tmp, 'ssot'), { recursive: true });
    fs.symlinkSync(path.join(ROOT, 'schema'), path.join(tmp, 'schema')); fs.symlinkSync(path.join(ROOT, 'test_harness'), path.join(tmp, 'test_harness'));
    const src = path.join(tmp, 'ssot', 'btnyc_source.json'), mark = path.join(tmp, 'ssot', 'migration', 'last_migration.json');
    const run = (...a) => cp.spawnSync('node', [path.join(EF, 'migrate_legacy.js'), '--write', ...a], { encoding: 'utf8', env: Object.assign({}, process.env, { BTNYC_ROOT: tmp }), maxBuffer: 1 << 26 });
    const clean = fs.readFileSync(src, 'utf8'); const r0 = run(); check('--write on an unedited source succeeds and changes nothing (the migration is idempotent on disk)', r0.status === 0 && fs.readFileSync(src, 'utf8') === clean, (r0.stderr || '').slice(0, 200));
    const S2 = JSON.parse(clean); S2.entities[0].label += ' (an authored edit)'; const edited = lib.toText(S2); fs.writeFileSync(src, edited);
    const r1 = run(); check('--write REFUSES when the source has been edited since the last migration (exit 3) ...', r1.status === 3 && /REFUSED/.test(r1.stderr), `exit ${r1.status}: ${(r1.stderr || '').slice(0, 160)}`);
    check('... and leaves the edited source exactly as it was', fs.readFileSync(src, 'utf8') === edited);
    fs.rmSync(mark); const r2 = run(); check('--write REFUSES when the source has no recorded history and differs from the migration', r2.status === 3 && fs.readFileSync(src, 'utf8') === edited);
    const r3 = run('--overwrite-authored'); check('--overwrite-authored discards the edit on request (and says so by being explicit)', r3.status === 0 && fs.readFileSync(src, 'utf8') === clean, (r3.stderr || '').slice(0, 160));
    check('...and records what it wrote, so the next --write can tell', fs.existsSync(mark) && lib.readJson(mark).output_sha256 === lib.sha(clean));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); } }

console.log(`\n[Entity-first migration: idempotence, determinism, content preservation] ${passed} passed, ${failed} failed (of ${passed + failed} checks)`);
process.exit(failed ? 1 : 0);
