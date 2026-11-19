#!/usr/bin/env node
/**
 * verify_faucet_leak_routes.js -- T198 (R1): a leak at the faucet is the faucet repair.
 *
 * Before: "faucet leak", "bathroom faucet leak", "kitchen faucet leaking" were quoted as Under-Sink Leak Repair (description-sibling scoring picked it on the word "leak"), and
 * "water leak from the faucet", "tap is leaking", "water leak at the faucet" got no service (the generic leak object took them). After: a leak word with a faucet/tap word is Faucet Drip Repair ($50);
 * a leak described under the sink (also hyphenated "under-sink") is still the under-sink leak job.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..');
const { check: _check, finish } = require('./_shared.js'); const check = (l, c) => _check(l, c);
const { engine } = require('./_engine.js');
function load(mod) {
    const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8')); if (mod) mod(DB);
    const sb = { DB, SERVICE_DATA: DB, window: { DB }, console: { log() {}, warn() {}, error() {}, info() {}, debug() {} } }; sb.global = sb; vm.createContext(sb);
    vm.runInContext(engine().wrapper, sb); if (typeof sb.initNlpSets === 'function') sb.initNlpSets(); return sb;
}
const ent = (sb, t) => { const r = sb.executeWorkflow(Object.assign({}, sb.collectBookingContext_freeText(t), { tagsAffirmed: true }), sb.DB); return r.entity && r.entity.id || null; };
const E = load(); const FAUCET = 'faucet_repair_drip', LEAK = 'leak_under_sink_repair';
for (const t of ['faucet leak', 'bathroom faucet leak', 'kitchen faucet leaking', 'water leak from the faucet', 'water leak at the faucet', 'tap is leaking', 'water leaking from faucet handle', 'faucet leaking at the base', 'faucet is leaking', 'dripping faucet', 'faucet a pipe leak'])
    check(`"${t}" is Faucet Drip Repair`, ent(E, t) === FAUCET, ent(E, t));
const KEEP = { 'leak under the sink': LEAK, 'water leak at the sink': LEAK, 'faucet leaking under the sink': LEAK, 'Under-sink leak repair on dripping faucet': LEAK, 'under-sink leak': LEAK, 'kitchen sink leaking': LEAK,
    'washing machine leaking at the tap': 'washer_repair', 'sink is clogged': 'slow_drain_clearing', 'install a sink': null };
for (const t in KEEP) check(`"${t}" is ${KEEP[t]}`, ent(E, t) === KEEP[t], ent(E, t));
const O = load(DB => { for (const o of DB.intent_mappings.objects) if (o.contextual_overrides) o.contextual_overrides = o.contextual_overrides.filter(c => !/T198 R1/.test(c.note || '')); });
check('planted original (no R1 overrides): "faucet leak" is NOT Faucet Drip Repair (this is the defect)', ent(O, 'faucet leak') !== FAUCET, ent(O, 'faucet leak'));
check('planted original: "water leak from the faucet" is NOT Faucet Drip Repair', ent(O, 'water leak from the faucet') !== FAUCET, ent(O, 'water leak from the faucet'));
finish();
