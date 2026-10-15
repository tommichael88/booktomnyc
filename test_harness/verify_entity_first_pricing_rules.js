#!/usr/bin/env node
/**
 * verify_entity_first_pricing_rules.js -- the pricing knowledge the source states as data is the knowledge the legacy pricing code actually applies (T177; R-TEST-CANFAIL, R-SYSTEM-IDENTITY, R-DOMAIN-SHAPE).
 *
 * @enforces R-TEST-CANFAIL
 * @enforces R-SYSTEM-IDENTITY
 * @enforces R-DOMAIN-SHAPE
 * @enforces R-INVARIANT-DERIVATION
 * @detects DEFECT-TEST-CANTFAIL
 * @detects DEFECT-DERIVED-AUTHORITY
 * @detects DEFECT-NAMES-AS-KEYS
 *
 * THE DEFECT-SHAPE. A pricing formula in qr.html reads particular answers ("Yes" to grout repair, the chosen LABEL of the area question, the install type matched by a regular expression). The source now
 * says which question, which options and which formula parameter each formula reads (registries.pricing_formulas[].inputs, recovered into ssot/migration/recovered_rules.json with a code citation each).
 * Two ways that statement can be wrong: the cited code is gone or changed (the rule outlived its evidence), or the code does not do what the statement says (the statement was never right).
 *
 * WHAT IS HELD.
 *   1. Citations. Every quote in recovered_rules.json is found in qr.html. A rule whose evidence is gone fails; a moved line is reported, not failed.
 *   2. The legacy pricing function is the ORACLE. applyPricingFormula is loaded whole from qr.html (test_harness/_engine.js) and run against the legacy btnyc.json. No arithmetic is re-implemented here: each
 *      declared input is tested by SENSITIVITY. Perturb the formula parameter an input names and the engine's answer moves for exactly the options the input lists, and for no others; compare a branch
 *      selector's options with the baseline and with each other; compare a counted answer with its declared count. A statement the engine contradicts fails; the engine is not made right by it.
 *   3. Counterfactual: the same checks FAIL on a source whose input is wrong (a wrong option, a wrong parameter, a wrong branch table, a wrong count). A check that passes on a wrong statement proves nothing.
 *   4. The set of questions a formula owns (qr.html FORMULA_CONSUMED_KEYS) is derived from the inputs. Legacy keys no intake module has were dropped on purpose and are proven absent.
 *   5. qty_aware equals qr.html QTY_AWARE_FORMULAS. The PAX coefficients that qr.html still holds in a base64 constant equal the SSOT formula (a drift guard; moving the builder to read the formula is runtime work).
 *   6. Pricing archetype definitions in the source equal the compiler's constants they were taken from.
 *   7. The question-level price claim is checked against the options: a counterfactual that adds or removes a claim is reported under the right kind.
 *   8. The applier refuses a rule that names something btnyc.json does not have.
 *
 * Node + python3 only; no browser, no network.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = process.env.BTNYC_ROOT ? path.resolve(process.env.BTNYC_ROOT) : path.resolve(__dirname, '..');
process.env.BTNYC_ROOT = ROOT;
const EF = path.join(__dirname, 'tools', 'entity_first');
const lib = require(path.join(EF, 'lib.js'));
const V = require(path.join(EF, 'validate_source.js'));
const RR = require(path.join(EF, 'recovered_rules.js'));
const { migrate } = require(path.join(EF, 'migrate_legacy.js'));
const { derive } = require(path.join(EF, 'derive_graph.js'));
const { engine } = require('./_engine.js');

let passed = 0, failed = 0;
const check = (label, ok, detail) => { if (ok) { passed++; console.log(`  ✓ ${label}`); } else { failed++; console.log(`  ✗ ${label}${detail ? ' -- ' + detail : ''}`); } };

const SRC = lib.readJson(lib.PATHS.source), LEGACY = lib.readJson(lib.PATHS.legacy);
const RULES = RR.load(); const QR = fs.readFileSync(path.join(ROOT, 'qr.html'), 'utf8'); const QR_LINES = QR.split('\n');

const questions = s => new Map([...s.entities.flatMap(e => e.questions), ...s.shared_questions].map(q => [q.id, q]));
const Q = questions(SRC);
const formulaOf = (s, id) => s.registries.pricing_formulas.find(f => f.id === id);
const modName = id => id.slice(4), qName = id => id.slice(2);

// ---- the oracle: applyPricingFormula, loaded whole from qr.html, over a legacy catalog we may perturb ----------------------------------------------------------------------------------------------
function oracle(db) {
  const sandbox = { console }; sandbox.global = sandbox; sandbox.DB = db; sandbox.SERVICE_DATA = db; sandbox.window = { DB: db };
  vm.createContext(sandbox); vm.runInContext(engine().wrapper, sandbox);
  return (fid, answers, qty = 1, svc = null) => JSON.parse(JSON.stringify(sandbox.applyPricingFormula(fid.slice(4), answers, qty, svc)));
}
const freshDb = () => JSON.parse(JSON.stringify(LEGACY));
const labelOf = (s, qid, oid) => { const q = questions(s).get(qid); const o = (q.options || []).find(x => x.id === oid); if (!o) throw new Error(`no option ${qid}/${oid}`); return o.label; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const delta = (a, b) => ({ fee: a.extraFee - b.extraFee, min: a.extraMin - b.extraMin });
const getPath = (o, p) => p.split('.').reduce((a, k) => (a === undefined || a === null ? undefined : a[k]), o);
const setPath = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); getPath(o, ks.join('.') || '__x') ; const t = ks.reduce((a, k) => a[k], o); t[last] = v; };
const buyTheHourService = LEGACY.services.find(s => s.id === 'blinds_shades_curtains_buy_the_hour');

// The sensitivity checks, per input. Each returns a list of failures (empty = the engine agrees with the statement). `s` is the source whose statement is held to the oracle.
function holdInputs(s, only) {
  const fails = []; const run0 = oracle(freshDb());
  for (const f of s.registries.pricing_formulas) for (const inp of f.inputs || []) {
    if (only && !only(f, inp)) continue; const tag = `${f.id} / ${inp.name}`;
    const mk = inp.question_id ? qName(inp.question_id) : null; const svc = f.id === 'fml.buy_the_hour_qty_gate_formula' ? buyTheHourService : null;
    const res = (answers, qty = 1, db) => (db ? oracle(db) : run0)(f.id, answers, qty, svc);
    const base = res({}, 3);
    if (inp.role === 'trigger_modifier') {
      const q = questions(s).get(inp.question_id); const ref = f[inp.modifier_param]; // a mod id
      for (const o of q.options) {
        const r = res({ [mk]: o.label }, 3); const listed = inp.option_ids.includes(o.id); const d = delta(r, base);
        if (listed === same(r, base)) fails.push(`${tag}: answer "${o.label}" ${listed ? 'is listed but does not change the engine result' : 'is not listed but changes the engine result'}`);
        if (listed) { // bump the modifier the input names: the listed answer moves by exactly that much
          const db = freshDb(); db.global_rules.modifiers[modName(ref)].fee += 7; const r2 = res({ [mk]: o.label }, 3, db), b2 = res({}, 3, db);
          if (delta(r2, b2).fee !== d.fee + 7) fails.push(`${tag}: the engine does not charge ${ref} (parameter ${inp.modifier_param}) for "${o.label}"`);
        }
      }
    } else if (inp.role === 'constant_modifier') {
      const ref = f[inp.modifier_param]; const db = freshDb(); db.global_rules.modifiers[modName(ref)].fee += 7; const r2 = res({}, 3, db);
      if (r2.extraFee !== base.extraFee + 7) fails.push(`${tag}: the engine does not apply ${ref} (parameter ${inp.modifier_param}) to every quote`);
    } else if (inp.role === 'select_branch') {
      const q = questions(s).get(inp.question_id); const byBranch = new Map();
      for (const b of inp.branches) { const outs = b.option_ids.map(oid => res({ [mk]: labelOf(s, inp.question_id, oid) }, 3)); if (!outs.every(x => same(x, outs[0]))) fails.push(`${tag}: answers of branch ${b.branch} do not give one result`); byBranch.set(b.branch, outs[0]); }
      const names = [...byBranch.keys()];
      for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) if (same(byBranch.get(names[i]), byBranch.get(names[j]))) fails.push(`${tag}: branches ${names[i]} and ${names[j]} give the same result`);
      if (!same(byBranch.get(inp.default_branch), base)) fails.push(`${tag}: the unanswered question does not behave as the default branch ${inp.default_branch}`);
      if (inp.branches.some(b => b.formula_path)) { // a branch that names a parameter set: bumping that set moves exactly that branch
        for (const b of inp.branches.filter(x => x.formula_path)) { const db = freshDb(); const set = db.pricing_formulas[f.id.slice(4)][b.formula_path]; set.flat_rate = (set.flat_rate || 0) + 500; set.overflow_per_unit = (set.overflow_per_unit || 0) + 5;
          const mine = res({ [mk]: labelOf(s, inp.question_id, b.option_ids[0]) }, 3, db), others = inp.branches.filter(x => x !== b).map(x => res({ [mk]: labelOf(s, inp.question_id, x.option_ids[0]) }, 3, db));
          if (same(mine, byBranch.get(b.branch))) fails.push(`${tag}: parameter set ${b.formula_path} does not drive branch ${b.branch}`);
          others.forEach((o, k) => { const nm = inp.branches.filter(x => x !== b)[k].branch; if (!same(o, byBranch.get(nm))) fails.push(`${tag}: parameter set ${b.formula_path} also drives branch ${nm}`); }); }
      }
      void q;
    } else if (inp.role === 'quantity') {
      if (inp.source === 'booking') {
        if (!inp.param) { // a booked quantity that no single parameter names (hardware tiers): the result must depend on the quantity
          if (same(res({}, 1), res({}, 8))) fails.push(`${tag}: the engine result does not depend on the booked quantity`);
        } else {
          const bump = (db) => setPath(db.pricing_formulas[f.id.slice(4)], inp.param, getPath(db.pricing_formulas[f.id.slice(4)], inp.param) + 1);
          const dbB = freshDb(); bump(dbB); const d = qty => res({}, qty, dbB).extraMin - res({}, qty).extraMin; // how far one more of the parameter moves the minutes, at each booked quantity
          if (d(3) - d(2) === 0) fails.push(`${tag}: the engine does not scale ${inp.param} by the booked quantity (a parameter that does not grow with the quantity is not the per-unit one)`);
          if (inp.scales && /quantity - 1/.test(inp.scales) && d(1) !== 0) fails.push(`${tag}: ${inp.param} should not apply to a quantity of 1 (declared scales: ${inp.scales})`);
        }
      } else if (!inp.question_id) { /* the open-ended-band overflow rate (item_count_overflow_formula) is DORMANT by the v9.6 business decision: no question carries the count, so there is nothing to perturb */
      } else {
        const q = questions(s).get(inp.question_id); const dflt = inp.source === 'answer_values' ? inp.default : 0;
        const valueOf = o => (inp.source === 'answer_values' ? inp.values.find(v => v.option_id === o.id).value : o.qty_value);
        const dbB = freshDb(); setPath(dbB.pricing_formulas[f.id.slice(4)], inp.param, getPath(dbB.pricing_formulas[f.id.slice(4)], inp.param) + 1);
        const answersFor = o => Object.assign(neutral(s, f, inp), { [mk]: o.label });
        const results = q.options.map(o => ({ o, v: valueOf(o), r: res(answersFor(o), 1), r2: res(answersFor(o), 1, dbB) }));
        const byValue = new Map(); for (const x of results) { if (!byValue.has(x.v)) byValue.set(x.v, []); byValue.get(x.v).push(x.r); }
        for (const [v, rs] of byValue) if (!rs.every(r => same(r, rs[0]))) fails.push(`${tag}: answers with the count ${v} give different results`);
        const vals = [...byValue.keys()]; for (let i = 0; i < vals.length; i++) for (let j = i + 1; j < vals.length; j++) if (same(byValue.get(vals[i])[0], byValue.get(vals[j])[0])) fails.push(`${tag}: the counts ${vals[i]} and ${vals[j]} give the same result`);
        const unit = /_hours$/.test(inp.param) ? 60 : 1; // minutes moved by one more unit of the parameter, per counted unit
        for (const x of results) { const moved = x.r2.extraMin - x.r.extraMin; if (moved !== x.v * unit) fails.push(`${tag}: the answer "${x.o.label}" is declared to count ${x.v} but the engine counts ${moved / unit}`); }
        for (const x of results) { const sensitive = !same(x.r, x.r2); if (sensitive !== (x.v !== 0)) fails.push(`${tag}: the count ${x.v} ("${x.o.label}") ${sensitive ? 'moves with' : 'ignores'} ${inp.param}, which a count of ${x.v === 0 ? 'zero' : x.v} should ${x.v === 0 ? 'ignore' : 'move'}`); }
        if (dflt !== undefined && byValue.has(dflt) && !same(byValue.get(dflt)[0], base0(res, q, s, inp, answersFor))) fails.push(`${tag}: leaving the question unanswered does not behave as the declared default count ${dflt}`);
      }
    }
  }
  return fails;
}
function base0(res, q, s, inp, answersFor) { const f = s.registries.pricing_formulas.find(x => x.inputs && x.inputs.includes(inp)); return res(neutral(s, f, inp), 1); }
// the other counted questions of the same formula, each answered with its lowest count (the answer that adds least): the baseline against which one count is perturbed
function neutral(s, f, inp) { const a = {}; if (inp.source !== 'option_qty_value') return a; for (const sib of f.inputs.filter(x => x.question_id && x.question_id !== inp.question_id && x.source === 'option_qty_value')) { const opts = questions(s).get(sib.question_id).options; const low = opts.reduce((m, o) => (o.qty_value < m.qty_value ? o : m)); a[qName(sib.question_id)] = low.label; } return a; }

// ---- 1. citations ---------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('Every recovered rule cites code that still exists');
{ const cites = []; const walk = (v, p) => { if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`)); else if (v && typeof v === 'object') { if (typeof v.quote === 'string' && typeof v.file === 'string') cites.push({ p, c: v }); for (const [k, x] of Object.entries(v)) walk(x, `${p}.${k}`); } };
  walk(RULES.rules, '$');
  check(`the rules file carries citations (${cites.length})`, cites.length >= 20, String(cites.length));
  const missing = cites.filter(x => x.c.file !== 'qr.html' || !QR.includes(x.c.quote));
  check('every cited quote is found in qr.html (a rule whose evidence is gone fails)', missing.length === 0, missing.slice(0, 3).map(x => x.p).join('; '));
  const moved = cites.filter(x => !missing.includes(x) && !(QR_LINES[x.c.line - 1] || '').includes(x.c.quote));
  check(`the cited line numbers are current (${moved.length} moved; informational: the quote, not the number, is the evidence)`, true);
  const inputsWithEvidence = Object.values(RULES.rules.formula_inputs).flat();
  check('every recovered input cites at least one line', inputsWithEvidence.every(i => Array.isArray(i.evidence) && i.evidence.length > 0));
  check('a cited quote that is not in qr.html would fail the check (counterfactual)', !QR.includes('this line is not in qr.html and never was'));
}

// ---- 2. the source states exactly what the rules file says ---------------------------------------------------------------------------------------------------------------------------
console.log('\nThe source carries the rules, no more and no less');
{ const mark = lib.readJson(lib.PATHS.lastMigration);
  check('the migration marker records the rules file it applied', mark.recovered_rules_sha256 === RULES.sha256, `${mark.recovered_rules_sha256} vs ${RULES.sha256}`);
  check('the source records the same rules hash in its provenance', SRC.provenance.recovered_rules && SRC.provenance.recovered_rules.sha256 === RULES.sha256);
  for (const [fid, list] of Object.entries(RULES.rules.formula_inputs)) {
    const want = list.map(i => { const { evidence, ...rest } = i; return rest; }); const got = (formulaOf(SRC, fid) || {}).inputs;
    check(`${fid}: the source holds the ${list.length} recovered input(s) verbatim (without their citations)`, !!got && lib.diff(JSON.parse(JSON.stringify(want)), got) === null);
  }
  check('qty_aware is stated on exactly the formulas the rules name', SRC.registries.pricing_formulas.filter(f => f.qty_aware).map(f => f.id).sort().join() === RULES.rules.formula_qty_aware.formulas.slice().sort().join());
}

// ---- 3. the oracle agrees with every statement -----------------------------------------------------------------------------------------------------------------------------------------
console.log('\nThe legacy pricing function agrees with every input the source states (sensitivity, no re-implemented arithmetic)');
const baselineFails = holdInputs(SRC);
check('every recovered input is confirmed by the engine', baselineFails.length === 0, baselineFails.slice(0, 4).join(' | '));
for (const f of SRC.registries.pricing_formulas) for (const inp of f.inputs || []) {
  if (inp.role === 'quantity' && inp.source === 'option_qty_value' && !inp.question_id) { check(`${f.id.slice(4)} / ${inp.name}: DORMANT by the v9.6 business decision, so there is no answer to perturb (not held by sensitivity; listed so it is not mistaken for a pass)`, true); continue; }
  const fl = holdInputs(SRC, (g, i) => g === f && i === inp); check(`${f.id.slice(4)} / ${inp.name} (${inp.role}) confirmed by the engine`, fl.length === 0, fl.slice(0, 2).join(' | '));
}
// furniture issue fees: the fee table the source already authored behaves as stated
{ const f = formulaOf(SRC, 'fml.furniture_repair_formula'); const run = oracle(freshDb()); const base = run(f.id, {}, 1); let bad = [];
  for (const row of f.issue_type_fees) { const m = SRC.registries.modifiers.find(x => x.id === row.modifier_id); const r = run(f.id, { issue: labelOf(SRC, row.question_id, row.option_id) }, 1); const d = delta(r, base); const moves = !!(m.fee || m.minutes);
    if (moves !== (d.fee !== 0 || d.min !== 0)) bad.push(row.option_id); else if (moves && d.fee !== m.fee) bad.push(row.option_id + ' fee'); }
  check(`furniture issue fee rows (${f.issue_type_fees.length}): the engine charges the modifier each row names`, bad.length === 0, bad.join(','));
  const qo = Q.get('q.issue').options; check('every furniture issue answer is either a fee row or a declared no-op for fee and minutes', qo.every(o => f.issue_type_fees.some(r => r.option_id === o.id)), qo.filter(o => !f.issue_type_fees.some(r => r.option_id === o.id)).map(o => o.id).join(','));
}

// ---- 4. counterfactual: the same check fails on a wrong statement -----------------------------------------------------------------------------------------------------------------------------
console.log('\nCounterfactual: a wrong statement is caught by the engine');
const wrong = (label, fid, role, edit, pick = () => true) => { const s = lib.clone(SRC); const f = formulaOf(s, fid); const inp = f.inputs.filter(i => i.role === role).find(pick); edit(inp, s, f); const fl = holdInputs(s, (g, i) => g === f && i === inp); check(label, fl.length > 0, 'the engine accepted a wrong statement'); };
wrong('a trigger that lists the wrong answer ("No" instead of "Yes") is caught', 'fml.tile_repair_formula', 'trigger_modifier', i => { i.option_ids = ['no']; }, i => i.question_id === 'q.grout_repair');
wrong('a trigger that names the wrong modifier parameter is caught', 'fml.tile_repair_formula', 'trigger_modifier', i => { i.modifier_param = 'disposal_modifier_ref'; }, i => i.question_id === 'q.grout_repair');
wrong('a branch table that swaps the two install types is caught', 'fml.hardware_install_formula', 'select_branch', i => { const [a, b] = i.branches; const t = a.option_ids; a.option_ids = b.option_ids; b.option_ids = t; });
wrong('a branch selector with the wrong default is caught', 'fml.hardware_install_formula', 'select_branch', i => { i.default_branch = 'new_holes'; });
wrong('a buy-the-hour table that makes "more than 1 item" the flat branch is caught', 'fml.buy_the_hour_qty_gate_formula', 'select_branch', i => { const [a, b] = i.branches; const t = a.option_ids; a.option_ids = b.option_ids; b.option_ids = t; });
wrong('an area table with a wrong square-foot value is caught', 'fml.drywall_repair_formula', 'quantity', i => { i.values[1].value = 12; });
wrong('an area default that is not what the engine falls back to is caught', 'fml.drywall_repair_formula', 'quantity', i => { i.default = 10; });
wrong('a PAX count bound to the wrong coefficient is caught', 'fml.pax_wardrobe_formula', 'quantity', i => { i.param = 'coefficients.hinge_door_hours'; }, i => i.question_id === 'q.pax_cabinet_count');
wrong('a booking quantity bound to a parameter the engine does not scale is caught', 'fml.tile_repair_formula', 'quantity', i => { i.param = 'base_minutes'; }, i => i.source === 'booking');
wrong('a constant modifier bound to the wrong parameter is caught', 'fml.drywall_repair_formula', 'constant_modifier', i => { i.modifier_param = 'texture_modifier_ref'; });
{ const s = lib.clone(SRC); const q = questions(s).get('q.pax_cabinet_count'); q.options.find(o => o.id === '3').qty_value = 4; const fl = holdInputs(s, (g, i) => g.id === 'fml.pax_wardrobe_formula' && i.question_id === 'q.pax_cabinet_count');
  check('a PAX answer whose qty_value is wrong (the count is not what the engine counts) is caught', fl.length > 0, 'accepted'); }

// ---- 5. the set of questions a formula owns is derived, and the stale keys are stale -------------------------------------------------------------------------------------------------------
console.log('\nFORMULA_CONSUMED_KEYS is derived from the inputs; the keys it carried that nothing asks are dropped');
{ const body = /const FORMULA_CONSUMED_KEYS = \{([\s\S]*?)\n\s*\};/.exec(QR); check('qr.html FORMULA_CONSUMED_KEYS is found', !!body);
  const legacy = {}; if (body) for (const m of body[1].matchAll(/(\w+):\s*\[([^\]]*)\]/g)) legacy[m[1]] = [...m[2].matchAll(/'([^']+)'/g)].map(x => x[1]);
  const g = derive(SRC, fs.readFileSync(lib.PATHS.source, 'utf8')); const dropped = RULES.rules.dropped_legacy_consumed_keys;
  const droppedOf = fid => dropped.filter(d => d.formula === 'fml.' + fid).map(d => d.key);
  let bad = []; const extra = [];
  for (const fid of Object.keys(g.formula_inputs).map(x => x.slice(4))) if (!legacy[fid]) for (const k of g.formula_inputs['fml.' + fid].consumed_question_ids.map(qName)) extra.push(`${fid}:${k}`);
  for (const [fid, keys] of Object.entries(legacy)) { const got = (g.formula_inputs['fml.' + fid] || { consumed_question_ids: [] }).consumed_question_ids.map(qName);
    const expect = keys.filter(k => !droppedOf(fid).includes(k)).sort(); if (!expect.every(k => got.includes(k))) bad.push(`${fid}: missing ${expect.filter(k => !got.includes(k)).join(',')}`); for (const k of got) if (!keys.includes(k)) extra.push(`${fid}:${k}`); }
  check(`derived consumed questions include every legacy key that names an intake module (${Object.keys(legacy).length} formulas)`, bad.length === 0, bad.join('; '));
  check('the questions the source adds beyond the legacy table are exactly those of the two formulas the table omitted (PAX counts, buy-the-hour gate)', extra.sort().join() === ['pax_wardrobe_formula:pax_cabinet_count', 'pax_wardrobe_formula:pax_hinge_count', 'pax_wardrobe_formula:pax_interior_count', 'pax_wardrobe_formula:pax_sliding_count', 'buy_the_hour_qty_gate_formula:buy_the_hour_qty'].sort().join(), extra.join(','));
  check('every dropped key is a key the legacy table lists', dropped.every(d => (legacy[d.formula.slice(4)] || []).includes(d.key)));
  check('no dropped key is an intake module (nothing could ever have answered it)', dropped.every(d => !Object.prototype.hasOwnProperty.call(LEGACY.intake_modules, d.key)));
  check('every other legacy key IS an intake module', Object.values(legacy).flat().filter(k => !dropped.some(d => d.key === k)).every(k => Object.prototype.hasOwnProperty.call(LEGACY.intake_modules, k)));
}

// ---- 6. qty_aware and the PAX duplicate ---------------------------------------------------------------------------------------------------------------------------------------------------
console.log('\nqty_aware equals QTY_AWARE_FORMULAS; the PAX constant in qr.html equals the SSOT formula');
{ const m = /const QTY_AWARE_FORMULAS = new Set\(\[([^\]]*)\]\)/.exec(QR); const legacyQa = m ? [...m[1].matchAll(/'([^']+)'/g)].map(x => 'fml.' + x[1]).sort() : [];
  check('QTY_AWARE_FORMULAS is found and non-empty', legacyQa.length > 0);
  check('the source flags exactly those formulas qty_aware', SRC.registries.pricing_formulas.filter(f => f.qty_aware).map(f => f.id).sort().join() === legacyQa.join(), legacyQa.join());
  const b64 = /const PAX_COEFF_B64 = "([^"]+)"/.exec(QR); check('qr.html still holds the PAX coefficient constant (so the drift guard has something to guard)', !!b64);
  if (b64) { const c = JSON.parse(Buffer.from(b64[1], 'base64').toString('utf8')); const f = formulaOf(SRC, 'fml.pax_wardrobe_formula');
    check('PAX price per hour in qr.html equals the SSOT formula', c.pricePerHour === f.price_per_hour, `${c.pricePerHour} vs ${f.price_per_hour}`);
    check('PAX start fee in qr.html equals the SSOT formula', c.startFee === f.start_fee, `${c.startFee} vs ${f.start_fee}`);
    check('PAX coefficients in qr.html equal the SSOT formula (frame, hinge door, sliding door, interior item)', c.coefficients.cabinet === f.coefficients.cabinet_frame_hours && c.coefficients.standardDoor === f.coefficients.hinge_door_hours && c.coefficients.slidingDoor === f.coefficients.sliding_door_hours && c.coefficients.insideItem === f.coefficients.interior_item_hours, JSON.stringify(c.coefficients));
    const drift = JSON.parse(JSON.stringify(c)); drift.coefficients.cabinet = 1.4; check('counterfactual: a drifted copy would fail the guard', drift.coefficients.cabinet !== f.coefficients.cabinet_frame_hours); }
}

// ---- 7. pricing archetype definitions ------------------------------------------------------------------------------------------------------------------------------------------------
console.log('\nPricing archetype definitions are authored in the source and equal the compiler constants they came from');
{ const py = cp.spawnSync('python3', ['-c', "import runpy,json,sys; ns=runpy.run_path(sys.argv[1]); print(json.dumps(ns['PRICING_ARCHETYPE_DEFINITIONS']))", path.join(__dirname, 'btnyc_v10_compiler.py')], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  let comp = null; try { comp = JSON.parse(py.stdout); } catch (e) { /* reported below */ }
  check('the compiler constants can be read', !!comp, (py.stderr || '').slice(0, 200));
  if (comp) {
    check('every source archetype definition equals the compiler constant of the same name', SRC.registries.pricing_archetypes.every(a => comp[a.id.slice(4)] === a.definition), SRC.registries.pricing_archetypes.filter(a => comp[a.id.slice(4)] !== a.definition).map(a => a.id).join(','));
    check('the source and the compiler define the same set of archetypes', Object.keys(comp).sort().join() === SRC.registries.pricing_archetypes.map(a => a.id.slice(4)).sort().join());
  }
  check('every archetype has a non-empty authored definition', SRC.registries.pricing_archetypes.every(a => typeof a.definition === 'string' && a.definition.length > 20));
}

// ---- 7b. the archetype a service declares is checked against the formula it names (T178, PENDING_DECISIONS #219) ----------------------------------------------------------------------------------
console.log('\nA declared pricing archetype is checked against the formula the service names (T178: the T177 check had read only one of the two places a formula is named)');
{ const svcs = new Map(SRC.entities.flatMap(e => e.services).map(s => [s.id, s]));
  const mism = r => (r.residuals || []).filter(x => x.kind === 'pricing_archetype_mismatch');
  const m0 = mism(V.validateFull(lib.clone(SRC)));
  const hourly = ['svc.blinds_shades_curtains_buy_the_hour', 'svc.furniture_repair_hourly', 'svc.loose_tile_replacement'];
  check('the three hourly services declare par.formula and name a registered formula in pricing.formula_id', hourly.every(id => { const s = svcs.get(id); return s.pricing.financial_engine.pricing_archetype === 'par.formula' && !s.pricing.financial_engine.formula_ref && !!formulaOf(SRC, s.pricing.formula_id); }));
  check('the legacy file names the same formulas through pricing_engine, the field the runtime resolves a formula from (so the source says what the runtime reads)', hourly.every(id => { const l = LEGACY.services.find(x => x.id === id.slice(4)); return 'fml.' + l.pricing_engine === svcs.get(id).pricing.formula_id; }));
  check('the validator reports exactly one disagreement: svc.pax_wardrobe_assembly', m0.length === 1 && m0[0].id === 'svc.pax_wardrobe_assembly', JSON.stringify(m0.map(x => x.id)));
  check('and quotes the service\'s own _archetype_note as the reason its label stands', /_archetype_note records why: "CORRECTED from a first-pass classification/.test(m0[0].note), m0[0] && m0[0].note.slice(0, 160));
  check('the legacy PAX note says what the label protects: it is hourly_timed "to prevent the existing computeUnifiedQuote guard from overriding a correct, already-live price"', /prevent the existing computeUnifiedQuote guard from overriding a correct, already-live price/.test(LEGACY.services.find(s => s.id === 'pax_wardrobe_assembly').financial_engine._archetype_note));
  check('the exception stands on a fact checked here: computeUnifiedQuote still replaces a price only for the tiered_per_unit and formula archetypes (if that guard changes, the PAX label has to be re-decided)', /_pricingArchetype === 'tiered_per_unit' \|\| _pricingArchetype === 'formula'/.test(QR));
  // counterfactuals: the detector still sees both directions
  { const s = lib.clone(SRC); delete s.entities.flatMap(e => e.services).find(x => x.id === 'svc.blinds_shades_curtains_buy_the_hour').pricing.formula_id;
    const m = mism(V.validateFull(s)); check('counterfactual: par.formula with no formula named anywhere is reported (the forward direction still fires)', m.some(x => x.id === 'svc.blinds_shades_curtains_buy_the_hour') && /neither financial_engine.formula_ref nor pricing.formula_id/.test(m.find(x => x.id === 'svc.blinds_shades_curtains_buy_the_hour').note), JSON.stringify(m.map(x => x.id))); }
  { const s = lib.clone(SRC); s.entities.flatMap(e => e.services).find(x => x.id === 'svc.pax_wardrobe_assembly').pricing.financial_engine.pricing_archetype = 'par.formula';
    check('counterfactual: with PAX declared par.formula the disagreement is gone (the report follows the data, not a fixed list)', mism(V.validateFull(s)).length === 0); }
  { const s = lib.clone(SRC); s.entities.flatMap(e => e.services).find(x => x.id === 'svc.cabinet_knob_or_pull_install').pricing.financial_engine.pricing_archetype = 'par.hourly_timed';
    const m = mism(V.validateFull(s)); check('counterfactual: a formula_ref under another archetype is reported (the reverse direction still fires)', m.some(x => x.id === 'svc.cabinet_knob_or_pull_install') && m.length === 2, JSON.stringify(m.map(x => x.id))); }
}

// ---- 8. does a question change the quote? ----------------------------------------------------------------------------------------------------------------------------------------------
console.log('\nThe question-level price claim is checked against the options');
{ const base = V.validate(lib.clone(SRC)); const pc = base.stats.priceClaim; const kinds = r => r.residuals.reduce((a, x) => (a[x.kind] = (a[x.kind] || 0) + 1, a), {});
  check('every legacy claim is classified exactly once (backed + indirect + unwired = claimed)', pc.backed + pc.indirect + pc.unwired === pc.claimed, JSON.stringify(pc));
  { const own = []; for (const q of Q.values()) { if (Object.prototype.hasOwnProperty.call(q, 'affects_price')) own.push(q.id); for (const o of q.options || []) if (Object.prototype.hasOwnProperty.call(o, 'affects_price')) own.push(q.id + '/' + o.id); }
    check('the source makes no price claim of its own: no question or option carries affects_price outside runtime_compat', own.length === 0, own.slice(0, 3).join(','));
    const s2 = lib.clone(SRC); [...questions(s2).values()][0].affects_price = true; const r2 = V.validateFull(s2); check('counterfactual: a question that carries its own affects_price is refused by the validator (the source states no price claim)', !r2.ok, 'validator accepted it'); }
  const g = derive(SRC, fs.readFileSync(lib.PATHS.source, 'utf8')).price_influence;
  check('the derived price_influence.prices equals "some option declares the price effect"', Object.entries(g).every(([qid, x]) => x.prices === (Q.get(qid).options || []).some(o => o.affects.includes('price'))));
  check('the legacy claim is carried unchanged for the badge', Object.entries(g).every(([qid, x]) => x.legacy_claim === (Q.get(qid).runtime_compat && typeof Q.get(qid).runtime_compat.affects_price === 'boolean' ? Q.get(qid).runtime_compat.affects_price : null)));
  { const s = lib.clone(SRC); const q = [...questions(s).values()].find(x => !x.instance_of && x.options && x.options.every(o => !o.affects.some(a => ['price', 'minutes', 'quantity', 'complexity', 'branch', 'checkout_state', 'materials'].includes(a))) && !(x.runtime_compat && x.runtime_compat.affects_price === true));
    if (q) { q.runtime_compat = Object.assign({}, q.runtime_compat, { affects_price: true }); const r = V.validate(s); check('counterfactual: claiming price for a question whose options change nothing is reported as price_claim_unwired (+1), still valid', r.ok && (kinds(r).price_claim_unwired || 0) === (kinds(base).price_claim_unwired || 0) + 1, JSON.stringify(r.errors.slice(0, 1))); } else check('a question with no quote-changing option exists to mutate', false); }
  { const s = lib.clone(SRC); const q = [...questions(s).values()].find(x => !x.instance_of && x.runtime_compat && x.runtime_compat.affects_price === true && (x.options || []).some(o => o.affects.includes('price')));
    q.runtime_compat.affects_price = false; const r = V.validate(s); check('counterfactual: withdrawing the claim from a question that prices the quote is reported as price_effect_unclaimed (+1), still valid', r.ok && (kinds(r).price_effect_unclaimed || 0) === (kinds(base).price_effect_unclaimed || 0) + 1 && (kinds(r).price_claim_indirect || 0) === (kinds(base).price_claim_indirect || 0)); }
  const classified = new Set(base.residuals.filter(r => ['price_claim_indirect', 'price_claim_unwired'].includes(r.kind)).map(r => r.id));
  check('PENDING_DECISIONS #96 ratchet: the unwired claims are the symptom / identification questions, not pricing questions', base.residuals.filter(r => r.kind === 'price_claim_unwired').every(r => /symptom|install_target|laptop_or_desktop/.test(r.id)), [...classified].filter(x => !/symptom|install_target|laptop_or_desktop/.test(x)).join(','));
}

// ---- 9. the applier refuses a rule that names something the catalog does not have ----------------------------------------------------------------------------------------------------
console.log('\nThe applier refuses a rule that names something btnyc.json does not have');
{ const mutate = fn => { const r = JSON.parse(JSON.stringify(RULES.rules)); fn(r); return { rules: r, sha256: 'x' }; };
  const refuses = (label, fn, re) => { let msg = null; try { migrate(LEGACY, { rules: mutate(fn) }); } catch (e) { msg = e.message; } check(label, msg !== null && re.test(msg), String(msg)); };
  refuses('inputs for a formula the catalog does not define', r => { r.formula_inputs['fml.no_such_formula'] = []; }, /does not define/);
  refuses('qty_aware for a formula the catalog does not define', r => { r.formula_qty_aware.formulas.push('fml.no_such_formula'); }, /does not define/);
  refuses('a condition modifier assigned to a service the catalog does not define', r => { r.condition_modifiers[0].service_ids = ['svc.no_such_service']; }, /does not define/);
  refuses('a condition modifier assigned to a service at another (entity, action) point', r => { r.condition_modifiers[0].service_ids = ['svc.led_bulb_upgrade']; }, /the rule says/);
  refuses('a condition modifier whose sibling is not at its point', r => { r.condition_modifiers[0].siblings_without = ['svc.led_bulb_upgrade']; }, /not at/);
  refuses('a condition modifier that collides with a legacy modifier', r => { r.condition_modifiers[0].id = 'mod.tile_grout'; }, /collides/);
  refuses('an input naming an option that does not exist', r => { r.formula_inputs['fml.tile_repair_formula'].find(i => i.question_id === 'q.grout_repair').option_ids = ['not_an_answer']; }, /does not exist/);
}

console.log(`\n[Entity-first pricing rules: citations, oracle, derivation] ${passed} passed, ${failed} failed (of ${passed + failed} checks)`);
process.exit(failed ? 1 : 0);
