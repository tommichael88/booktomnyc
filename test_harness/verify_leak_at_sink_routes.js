#!/usr/bin/env node
/**
 * verify_leak_at_sink_routes.js -- T198 (Q1): a leak at, in, from or near the sink is the under-sink leak job.
 *
 * Before: "water leak at the sink", "leak in the sink", "water leaking from sink" got no service (the generic leak object took the request and had only an "under the sink" override).
 * After: that override covers at/in/from/near/beneath the sink (and kitchen/bathroom sink). Faucet-named leaks, other fixtures and a bare "water leak" keep their routes.
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
const E = load(); const LEAK = 'leak_under_sink_repair';
for (const t of ['water leak at the sink', 'leak in the sink', 'water leaking from sink', 'water leak near the kitchen sink', 'leak at the bathroom sink', 'water leak from the sink', 'leak under the sink', 'sink leak'])
    check(`"${t}" is Under-Sink Leak Repair`, ent(E, t) === LEAK, ent(E, t));
const KEEP = { 'faucet leaking at the sink': 'faucet_repair_drip', 'sink is leaking': 'faucet_repair_drip', 'toilet leaking at the base': 'toilet_wax_ring_replacement', 'washing machine leaking at the sink': 'washer_repair',
    'install a sink': null, 'sink is clogged': 'slow_drain_clearing', 'put a shelf under the sink': 'shelf_mounting_standard_buy_the_hour' };
for (const t in KEEP) check(`"${t}" is ${KEEP[t]}`, ent(E, t) === KEEP[t], ent(E, t));
check('a bare "water leak" is not forced to the sink job', ent(E, 'water leak') !== LEAK, ent(E, 'water leak'));
const O = load(DB => { for (const o of DB.intent_mappings.objects) if (o.contextual_overrides) for (const c of o.contextual_overrides) if (/T198 O1\/Q1/.test(c.note || '')) c.keywords = c.keywords.filter(k => /^under /.test(k)); });
check('planted original (override knows only "under"): "water leak at the sink" is NOT the leak job (this is the defect)', ent(O, 'water leak at the sink') !== LEAK, ent(O, 'water leak at the sink'));
check('planted original: "leak under the sink" still is (O1)', ent(O, 'leak under the sink') === LEAK, ent(O, 'leak under the sink'));
finish();
