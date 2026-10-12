#!/usr/bin/env node
/**
 * price_part_replacement_matrix.js -- PENDING_DECISIONS #185 (T173 follow-up): what does Computer Part Replacement quote for every part x computer type x who sources the part?
 * A read-only measurement: prints a table, writes nothing, exits 0.
 *
 *   node test_harness/tools/price_part_replacement_matrix.js > archive/T173_part_price_matrix.txt
 *
 * The answers are the option labels of the service's own three modules (computer_component, device_type, customer_supplied_part), given to the engine's computeQuoteFromState
 * exactly as a customer's taps are. The finding it records: the part axis moves nothing (no option carries a modifier); only the computer type (All-in-one +$15, +15 min) and
 * sourcing the part (+$20, +20 min) do.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..', '..');
const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
const sb = { DB, SERVICE_DATA: DB, window: { DB }, console: { log() {}, warn() {}, error() {}, info() {}, debug() {} } }; sb.global = sb; vm.createContext(sb);
for (const f of ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
const id = 'internal_hardware_replacement', svc = DB.services.find(s => s.id === id), cat = svc.ui_taxonomy.category_id;
const labels = m => DB.intake_modules[m].client_response.map(o => o.label);
const parts = labels('computer_component').filter(l => !/^Something else/.test(l)), devices = labels('device_type'), supplied = labels('customer_supplied_part');
const price = answers => { const r = sb.computeQuoteFromState({ qty: 1, intent: { key: id, category: cat, label: 'x', qtyLabel: 'item' }, stype: 'Repair', answers, detTagIds: [], manTagIds: [], negatedTagIds: [] }); return [r.laborCalc, r.totalMin, r.tierKey, r.checkoutStateKey]; };
console.log('part | computer type | part supplied | $ | min | tier | state');
const seen = new Map();
for (const p of parts) for (const d of devices) for (const s of supplied) {
  const q = price({ computer_component: p, device_type: d, customer_supplied_part: s });
  console.log([p, d, s, ...q].join(' | '));
  const k = d + '|' + s; seen.set(k, (seen.get(k) || new Set()).add(q.slice(0, 2).join('/')));
}
const moved = [...seen.values()].filter(v => v.size > 1).length;
console.log(`\n${parts.length} parts x ${devices.length} computer types x ${supplied.length} = ${parts.length * devices.length * supplied.length} quotes; for the same type and sourcing, the price differs between parts in ${moved} of ${seen.size} cases.`);
