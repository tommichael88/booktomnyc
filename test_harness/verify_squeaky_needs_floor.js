#!/usr/bin/env node
/**
 * verify_squeaky_needs_floor.js -- T198 (N1): "squeaky" alone does not name a floor job.
 *
 * Before: the objects entry for Squeaky Floor Repair carried the bare keyword "squeaky", so "fix a squeaky door" (and squeaky stairs, a squeaky bed) was quoted as Squeaky Floor Repair, a floor price
 * for a door. After: the entry is named by floor phrases only ("squeaky floor(s)", "floor is/are squeaky", "floor squeaky", "floor squeak"), so a squeaky door or stairs goes to the general intake and every
 * way of saying the floor squeaks still reaches the floor service.
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
const E = load();
const FLOOR = 'squeaky_floor_repair';
for (const t of ['fix squeaky door', 'fix a squeaky door', 'squeaky stairs', 'my bed is squeaky']) check(`"${t}" is not Squeaky Floor Repair`, ent(E, t) !== FLOOR, ent(E, t));
for (const t of ['squeaky floor', 'fix squeaky floor in bedroom', 'squeaky floors', 'my floor is squeaky', 'the floors are squeaky', 'floor squeaks when i walk', 'floor squeak', 'floor squeaky']) check(`"${t}" still reaches Squeaky Floor Repair`, ent(E, t) === FLOOR, ent(E, t));
const O = load(DB => { const o = DB.intent_mappings.objects.find(x => x.keyword === 'squeaky floor'); o.keyword = 'squeaky'; o.synonyms = ['squeaky'].concat(o.synonyms); });
check('planted original (bare "squeaky"): "fix squeaky door" IS Squeaky Floor Repair (this is the defect)', ent(O, 'fix squeaky door') === FLOOR);
finish();
