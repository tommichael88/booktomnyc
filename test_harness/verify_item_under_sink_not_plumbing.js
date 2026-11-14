#!/usr/bin/env node
/**
 * verify_item_under_sink_not_plumbing.js -- T198 (O2): the sink is where an item goes, not the job.
 *
 * Before: "put a shelf under the sink" (also "add a shelf under sink", "shelf under the kitchen sink") was quoted as Angle Stop Replacement or Under-Sink Leak Repair -- a plumbing price for a shelf --
 * because the sink word outscored the item. After: the faucet/sink object yields (authored `yields_to_item`) to the object the customer named when the sink appears only as a locator
 * ("under/behind/inside/in/next to the sink"). Sink jobs keep their routes: leaks, drips, angle stops, P-traps, clogs, a faucet, replacing the sink itself.
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
const E = load(); const SHELF = 'shelf_mounting_standard_buy_the_hour';
for (const t of ['put a shelf under the sink', 'add a shelf under sink', 'shelf under the kitchen sink', 'install a shelf under the sink', 'put a shelf in the sink cabinet'.replace('sink cabinet', 'kitchen')])
    check(`"${t}" is a shelf job (${SHELF})`, ent(E, t) === SHELF, ent(E, t));
const KEEP = { 'fix a leaking pipe under the sink': 'leak_under_sink_repair', 'dripping under the sink': 'leak_under_sink_repair', 'leak under the sink': 'leak_under_sink_repair', 'water leaking under the sink': 'leak_under_sink_repair',
    'replace angle stop under the sink': 'angle_stop_replacement', 'replace p trap under sink': 'p_trap_cleaning', 'clean under the sink': 'p_trap_cleaning', 'sink is clogged': 'slow_drain_clearing',
    'faucet leaking': 'faucet_repair_drip', 'replace the sink': 'faucet_repair_drip', 'sink in the bathroom is dripping': 'faucet_repair_drip' };
for (const t in KEEP) check(`"${t}" still reaches ${KEEP[t]}`, ent(E, t) === KEEP[t], ent(E, t));
const O = load(DB => { for (const o of DB.intent_mappings.objects) delete o.yields_to_item; });
check('planted original (no yields_to_item): "put a shelf under the sink" is NOT a shelf job (this is the defect)', ent(O, 'put a shelf under the sink') !== SHELF, ent(O, 'put a shelf under the sink'));
check('planted original: "shelf under the kitchen sink" is NOT a shelf job', ent(O, 'shelf under the kitchen sink') !== SHELF, ent(O, 'shelf under the kitchen sink'));
finish();
