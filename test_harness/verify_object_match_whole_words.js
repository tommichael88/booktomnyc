#!/usr/bin/env node
/**
 * verify_object_match_whole_words.js -- T198 (M1): an object keyword matches whole words, not letters inside a longer word.
 *
 * Before: orch_apply_object_based_resolution matched by raw substring, so "install a doorbell camera" (object "doorbell camera" contains the keyword "door") became Prehung Interior Door Install,
 * a $-priced door job for a customer who asked for a camera. After: "door" is not found inside "doorbell"; the request is unmatched and goes to the general intake instead of a wrong service.
 * Whole-word matches (a plural s/es allowed) are unchanged: "install a door", "replace two doors", "door repair".
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..');
const { check: _check, finish } = require('./_shared.js'); const check = (l, c) => _check(l, c);
const { engine } = require('./_engine.js');
const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
function load(patch) {
    const sb = { DB, SERVICE_DATA: DB, window: { DB }, console: { log() {}, warn() {}, error() {}, info() {}, debug() {} } }; sb.global = sb; vm.createContext(sb);
    let w = engine().wrapper; if (patch) { const w2 = patch(w); if (w2 === w) throw new Error('the planted change did not apply'); w = w2; }
    vm.runInContext(w, sb); if (typeof sb.initNlpSets === 'function') sb.initNlpSets(); return sb;
}
const entity = (sb, t) => { const r = sb.executeWorkflow(Object.assign({}, sb.collectBookingContext_freeText(t), { tagsAffirmed: true }), sb.DB); return r.entity && r.entity.id || null; };
const E = load();
const O = load(w => w.replace(".includes(' ' + needle.replace(/(?:es|s)$/, '') + ' ') || (' ' + hay + ' ').includes(' ' + needle + ' ')", ".includes(needle) || hay.includes(needle)"));
for (const t of ['install a doorbell camera', 'install a doorbell']) check(`"${t}" is not routed to a door service`, entity(E, t) !== 'prehung_interior_door_install');
check('planted original (raw substring): "install a doorbell camera" IS a door service (this is the defect)', entity(O, 'install a doorbell camera') === 'prehung_interior_door_install');
for (const t of ['install a door', 'replace two doors', 'door repair']) check(`"${t}" still reaches its door service (whole word, plural allowed)`, entity(E, t) === entity(O, t), entity(E, t));
finish();
