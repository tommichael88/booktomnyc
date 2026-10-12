#!/usr/bin/env node
/**
 * measure_symptom_batch_proposal.js -- PENDING_DECISIONS #199: what would the proposed appliance symptom modules change? A read-only measurement, not a test: it writes nothing and exits 0.
 *
 *   node test_harness/tools/measure_symptom_batch_proposal.js [proposal.json]
 *
 * Reads symptom_batches/appliance_symptoms_T173_proposal.json (or the file named), applies it IN MEMORY to a copy of btnyc.json (new modules, the chain repoints of three services and
 * sixteen dynamic fallbacks), and reports:
 *   1. the data contract, before and after: for each appliance group, which symptom modules its services' and fallbacks' chains name, and how many name a module another appliance owns
 *      (the check the fix would add beside verify_dynchain_group_modules.js; run here on the real catalog and on the catalog with the batch applied);
 *   2. every option of every new module, quoted by the engine (price, minutes, checkout state), next to what the same words quote today under the washer's module;
 *   3. what disappears: the washer-shaped options each appliance is asked today, and what they quote;
 *   4. the dynamic fallbacks' quotes before and after for the options that exist in both (a re-point must not move a price for the same words);
 *   5. the picker tiles each symptom-first group would show, against the ones it shows now.
 * Nothing in the proposal is read by the engine or any test. Approval is a ssot_patch.js 'set' of the modules, the repoints and the tile rule (see the proposal's _about).
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..', '..');
const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
const FILE = process.argv[2] || path.join(__dirname, 'symptom_batches', 'appliance_symptoms_T173_proposal.json');
const P = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const clone = o => JSON.parse(JSON.stringify(o));
const norm = s => String(s || '').replace(/[‘’]/g, "'").trim();
function engine(db) {
  const sb = { DB: db, SERVICE_DATA: db, window: { DB: db }, console: { log() {}, warn() {}, error() {}, info() {}, debug() {} } }; sb.global = sb; vm.createContext(sb);
  for (const f of ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
  return sb;
}
const chainMods = e => (e.intake_chain || []).map(s => (s && s.module) || s);

// ---- apply the proposal to a copy ------------------------------------------------------------------------------------------------------------------------------------------
function apply(db) {
  const out = clone(db), oldSym = db.intake_modules.symptom.client_response;
  for (const [key, m] of Object.entries(P.modules)) {
    out.intake_modules[key] = {
      question: m.question, type: 'single', purpose: 'pricing', confidence_gain: 20, affects_price: true,
      client_response: m.options.map(o => {
        if (o.copy_of) { const src = oldSym.find(x => norm(x.label) === norm(o.label)); if (!src) throw new Error('copy_of: no such option ' + o.label); return clone(src); }
        const r = { label: o.label, tags: o.tags || [] };
        for (const k of ['complexity_override', 'modifier_ref', 'checkout_state_override']) if (o[k]) r[k] = o[k];
        return r;
      }),
    };
  }
  const swap = (e, from, to) => { e.intake_chain = (e.intake_chain || []).map(s => (s && s.module === from) ? Object.assign({}, s, { module: to }) : (s === from ? to : s)); };
  for (const [sid, r] of Object.entries(P.repoint.services)) swap(out.services.find(s => s.id === sid), r.from, r.to);
  for (const [key, to] of Object.entries(P.repoint.dynamic)) swap(out.dynamic_services[key], 'symptom', to);
  return out;
}

// ---- 1. the data contract --------------------------------------------------------------------------------------------------------------------------------------------------
function contract(db) {
  const owners = P.owners, byGroup = Object.fromEntries(Object.entries(P.group_of_owner).map(([o, g]) => [g, o]));
  const rows = [], viol = [];
  const judge = (where, ownerOfPlace, mods) => {
    for (const m of mods) { if (!(m in owners) && !/symptom/.test(m)) continue; if (!(m in owners)) continue;
      const own = owners[m]; const ok = own === '*' || own === ownerOfPlace;
      rows.push([where, ownerOfPlace || '(general)', m, ok ? 'ok' : `OWNED BY ${own}`]); if (!ok) viol.push(where + ' -> ' + m); }
  };
  for (const s of db.services) { const g = s.ui_taxonomy.group_id; if (byGroup[g]) judge('service ' + s.id, byGroup[g], chainMods(s)); }
  for (const [k, d] of Object.entries(db.dynamic_services)) {
    const parts = k.split('+'); if (parts[0] !== 'minor_home_repairs' || !/appliances|^minor_home_repairs\+Diagnostic$/.test(k)) continue;
    const grp = parts.length === 3 ? parts[1] : null; judge('fallback ' + k, grp ? (byGroup[grp] || null) : null, chainMods(d));
  }
  return { rows, viol };
}

// ---- 2-4 quotes ------------------------------------------------------------------------------------------------------------------------------------------------------------
const sbBefore = engine(DB), after = apply(DB), sbAfter = engine(after);
const price = (sb, db, sid, answers) => {
  const s = db.services.find(x => x.id === sid), cat = s.ui_taxonomy.category_id;
  const r = sb.computeQuoteFromState({ qty: 1, intent: { key: sid, category: cat, label: 'x', qtyLabel: 'item' }, stype: 'Repair', answers: Object.assign({}, answers), detTagIds: [], manTagIds: [], negatedTagIds: [] });
  return { usd: r.laborCalc, min: r.totalMin, state: r.checkoutStateKey };
};
const dyn = (sb, db, key, answers) => { const d = db.dynamic_services[key]; const r = sb.computeUnifiedQuote({ svc: null, dynDef: d, activeTagIds: [], answers: Object.assign({}, answers), qty: 1 }); return { usd: r.laborEstimate, min: r.totalMin, state: r.checkoutStateKey || (d.financial_engine && d.financial_engine.checkout_state) || '-' }; };
const fmt = q => q ? `$${q.usd} / ${q.min} min${q.state && q.state !== 'standard_flat_rate' ? ' [' + q.state + ']' : ''}` : '--';
const firstOthers = (db, sid, skip) => { const a = {}; const s = db.services.find(x => x.id === sid); for (const st of s.intake_chain) { const k = st.module || st; if (k === skip) continue; const m = db.intake_modules[k]; const resp = (m && m.client_response) || []; if (resp[0]) a[k] = resp[0].label; } return a; };

console.log(`# ${path.relative(ROOT, FILE)} applied IN MEMORY to btnyc.json -- nothing is written. Read-only measurement.\n`);

console.log('## 1. The data contract: no appliance group\'s service or fallback chain names a symptom module another appliance owns');
{
  const b = contract(DB), a = contract(after);
  console.log(`before: ${b.viol.length} violation(s) in ${b.rows.length} symptom-module references; after the batch: ${a.viol.length} in ${a.rows.length}.`);
  const byModule = {}; for (const v of b.viol) { const m = v.split(' -> ')[1]; (byModule[m] = byModule[m] || []).push(v.split(' -> ')[0]); }
  for (const [m, list] of Object.entries(byModule)) console.log(`  before: ${m} (owned by ${P.owners[m]}) is named by ${list.length}: ${list.map(x => x.replace('fallback minor_home_repairs+', 'fb ').replace('minor_home_repairs_appliances', 'appl')).join(', ')}`);
  if (a.viol.length) console.log('  AFTER, still violating: ' + a.viol.join('; '));
}

console.log('\n## 2. Every option of every new module, quoted (the service\'s own base plus the modifier\'s minutes; no new fee)');
const svcOf = { refrigerator_symptom: 'repair_appliances', microwave_symptom: 'microwave_repair', window_ac_symptom: 'window_ac_repair' };
const oldOpts = DB.intake_modules.symptom.client_response;
for (const [mod, sid] of Object.entries(svcOf)) {
  const m = P.modules[mod], others = firstOthers(DB, sid, 'symptom');
  console.log(`\n### ${mod} -> ${sid}   "${m.question}"   (other questions answered with their first option)`);
  for (const o of m.options) {
    const q = price(sbAfter, after, sid, Object.assign({}, firstOthers(after, sid, mod), { [mod]: o.label }));
    const old = oldOpts.find(x => norm(x.label) === norm(o.label));
    const was = old ? fmt(price(sbBefore, DB, sid, Object.assign({}, others, { symptom: old.label }))) : 'not offered today';
    console.log(`  ${o.label.padEnd(46)} ${fmt(q).padEnd(26)} today: ${was}${o.tile === false ? '   (no tile)' : ''}`);
  }
  console.log('  -- the washer-shaped options this service is asked today, and what they quote (they would no longer be asked):');
  for (const lab of ['Won’t spin / no movement', 'Won’t drain (water stays inside)']) {
    const kept = m.options.some(o => norm(o.label) === norm(lab));
    console.log(`  ${lab.padEnd(46)} ${fmt(price(sbBefore, DB, sid, Object.assign({}, others, { symptom: lab }))).padEnd(26)} ${kept ? 'kept (same words)' : 'leaves this service'}`);
  }
}

console.log('\n## 3. The sixteen dynamic fallbacks: the same words must quote the same (a re-point is not a price change)');
{
  let compared = 0, moved = 0, rows = [];
  for (const [key, to] of Object.entries(P.repoint.dynamic)) {
    if (to === 'symptom') continue;
    const opts = after.intake_modules[to].client_response; const parts = key.split('+');
    for (const o of opts) {
      const old = oldOpts.find(x => norm(x.label) === norm(o.label)); if (!old) continue;
      const q0 = dyn(sbBefore, DB, key, { symptom: old.label }), q1 = dyn(sbAfter, after, key, { [to]: o.label }); compared++;
      if (q0.usd !== q1.usd || q0.min !== q1.min || q0.state !== q1.state) { moved++; rows.push(`  MOVED ${parts[1] || parts[0]}+${parts[parts.length - 1]} "${o.label}": ${fmt(q0)} -> ${fmt(q1)}`); }
    }
  }
  console.log(`${compared} (fallback, option) pairs whose words exist in both modules: ${compared - moved} quote the same, ${moved} move.`);
  rows.forEach(r => console.log(r));
  const fresh = Object.keys(P.repoint.dynamic).filter(k => P.repoint.dynamic[k] !== 'symptom').length;
  console.log(`${fresh} of the 16 fallbacks change module (the 2 Washer entries keep the washer's); options that are new wording are quoted in section 2 for the services and are not compared here.`);
  console.log('Dynamic fallbacks quoted AFTER, one option per effort class (Repair entries):');
  for (const k of Object.keys(P.repoint.dynamic).filter(k => /\+Repair$/.test(k))) {
    const to = P.repoint.dynamic[k], opts = (after.intake_modules[to].client_response).slice(0, 3);
    console.log(`  ${k.replace('minor_home_repairs+', '').replace('minor_home_repairs_appliances', 'appl').padEnd(34)} ${to.padEnd(22)} ` + opts.map(o => `${o.label}: ${fmt(dyn(sbAfter, after, k, { [to]: o.label }))}`).join(' | '));
  }
}

console.log('\n## 4. The picker tiles each symptom-first group would show (derived from the module the repair service asks)');
for (const [g, mod] of Object.entries(P.tiles.groups)) {
  const ra = DB.routing_archetypes[g], now = (ra.real_symptom_ids || []).map(id => id.replace(/^sym\./, '').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()));
  const opts = (after.intake_modules[mod] || DB.intake_modules[mod]).client_response, proposed = opts.filter(o => { const pm = P.modules[mod]; const po = pm && pm.options.find(x => norm(x.label) === norm(o.label)); return !(po && po.tile === false) && !((P.tiles.exclude || {})[mod] || []).some(x => norm(x) === norm(o.label)); }).map(o => o.label);
  console.log(`  ${g.replace('minor_home_repairs_appliances_', '').padEnd(12)} now ${now.length}: ${now.join(', ')}\n  ${''.padEnd(12)} derived from ${mod} ${proposed.length}: ${proposed.join(', ')}`);
}
console.log('\nA tile that is an option also answers its question when tapped: the card does not ask it again.');
