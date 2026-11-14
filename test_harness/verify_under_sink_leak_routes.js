#!/usr/bin/env node
/**
 * verify_under_sink_leak_routes.js -- T198 (O1): a leak described under the sink is the Under-Sink Leak Repair job.
 *
 * Before: "fix a leaking pipe under the sink" / "pipe under sink is leaking" were quoted as Angle Stop Replacement (leftover-word sibling scoring), "dripping under the sink" as Faucet Drip Repair, and
 * "water leaking under the sink" got no service at all (the generic leak object took it). After: a leak/drip/water word plus an under-the-sink phrase reaches Under-Sink Leak Repair ($75), while jobs
 * that merely happen under the sink (angle stop, P-trap, disposal, a shelf) are not hijacked.
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
for (const t of ['fix a leaking pipe under the sink', 'pipe under sink is leaking', 'water leaking under the sink', 'water leaking under kitchen sink', 'dripping under the sink', 'leak under the sink', 'shut off valve under sink is leaking', 'my bathroom sink is leaking under my sink'])
    check(`"${t}" is Under-Sink Leak Repair`, ent(E, t) === LEAK, ent(E, t));
const KEEP = { 'replace angle stop under the sink': 'angle_stop_replacement', 'replace p trap under sink': 'p_trap_cleaning', 'garbage disposal under sink leaking': 'garbage_disposal_replacement', 'sink is clogged': 'slow_drain_clearing', 'faucet leaking': 'faucet_repair_drip' };
for (const t in KEEP) check(`"${t}" still reaches ${KEEP[t]}`, ent(E, t) === KEEP[t], ent(E, t));
const O = load(DB => { for (const o of DB.intent_mappings.objects) if (o.contextual_overrides) o.contextual_overrides = o.contextual_overrides.filter(c => !/T198 O1/.test(c.note || '')); });
check('planted original (no under-sink override): "fix a leaking pipe under the sink" is NOT Under-Sink Leak Repair (this is the defect)', ent(O, 'fix a leaking pipe under the sink') !== LEAK, ent(O, 'fix a leaking pipe under the sink'));
check('planted original: "water leaking under the sink" is NOT Under-Sink Leak Repair', ent(O, 'water leaking under the sink') !== LEAK, ent(O, 'water leaking under the sink'));
finish();
