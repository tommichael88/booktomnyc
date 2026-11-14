#!/usr/bin/env node
/**
 * verify_install_sink_not_leak.js -- T198 (P1): installing a sink is not the leak job.
 *
 * Before: "install a sink" / "install a new sink" were quoted as Under-Sink Leak Repair ($75): the install resolver found the object "sink leak" because "sink" is a fragment of its keyword. No
 * service installs a sink, so the honest answer is the general intake (as "install a tap" or "install a basin" already get). After: an object may opt out of fragment matching
 * (`fragment_match: false`, authored on "sink leak"), so the leak job is reached only by leak phrasing.
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
for (const t of ['install a sink', 'install a new sink', 'install sink', 'install a tap']) check(`"${t}" is not Under-Sink Leak Repair`, ent(E, t) !== LEAK, ent(E, t));
const KEEP = { 'sink leak': LEAK, 'leak under the sink': LEAK, 'fix a leaking pipe under the sink': LEAK, 'dripping under the sink': LEAK, 'install a faucet': 'faucet_repair_drip', 'sink is clogged': 'slow_drain_clearing',
    'install a toilet': 'toilet_install', 'install a garbage disposal': 'garbage_disposal_replacement', 'install a dishwasher': 'dishwasher_install', 'install a ceiling fan': 'ceiling_fan_install' };
for (const t in KEEP) check(`"${t}" still reaches ${KEEP[t]}`, ent(E, t) === KEEP[t], ent(E, t));
const O = load(DB => { for (const o of DB.intent_mappings.objects) delete o.fragment_match; });
check('planted original (no opt-out): "install a sink" IS Under-Sink Leak Repair (this is the defect)', ent(O, 'install a sink') === LEAK, ent(O, 'install a sink'));
finish();
