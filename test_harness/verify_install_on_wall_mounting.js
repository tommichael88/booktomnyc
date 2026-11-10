#!/usr/bin/env node
/**
 * verify_install_on_wall_mounting.js -- T198 (E1): "install a towel bar on concrete wall" is a mounting job, not a crack repair.
 *
 * Before: "install" is not a word of the mount object, so nothing yielded and the wall material decided the job (concrete: crack repair 95/100; brick / drywall / tile: the dynamic fallback).
 * After: a placing verb (authored on the surface, `yields_to.placed_by_any`), an item the mount object says it mounts (`mounts_items_any`) and the surface named as where it goes (on/onto/to/against ... surface, and
 * "wall" unless the surface is a wall by nature) route to the mount object, whose own overrides then pick the service. "install" is NOT a mounting word: nothing else moves.
 *   1. ROUTED      the towel-bar / grab-bar / shelf / mirror / TV install phrasings on brick, concrete, drywall, plaster and tile reach the same service and quote as their "mount ..." twin.
 *   2. UNCHANGED   appliance, lighting, fan, faucet, tile-install, drywall-install and floor installs keep the routing they had; damage words keep the repair; the repair requests are repairs.
 *   3. NON-VACUITY plant the data out (no placed_by_any / no mounts_items_any): the old repair routing returns.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..');
const { check, finish } = require('./_shared.js');
const { engine } = require('./_engine.js');
const DB0 = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
function load(db) {
    const sb = { DB: db, SERVICE_DATA: db, window: { DB: db }, console: { log() {}, warn() {}, error() {}, info() {}, debug() {} } };
    sb.global = sb; vm.createContext(sb); vm.runInContext(engine().wrapper, sb);
    if (typeof sb.initNlpSets === 'function') { sb.initNlpSets(); if (typeof sb.refreshNlpPreviewBindings === 'function') sb.refreshNlpPreviewBindings(); }
    return sb;
}
const typed = (sb, t) => { const c = sb.collectBookingContext_freeText(t); const r = sb.executeWorkflow(Object.assign({}, c, { tagsAffirmed: true }), sb.DB); const q = r.quote || {}; return { id: (r.entity && r.entity.id) || r.entityType, q: q.laborEstimate + '/' + q.totalMin, ans: JSON.stringify(r.answers || {}) }; };
const E = load(DB0);
const sig = x => [x.id, x.q, x.ans].join('|');
// 1. routed: each install phrasing equals its mount twin (same service, quote and typed answers)
const TWINS = [
    ['install a towel bar on concrete wall', 'mount a towel bar on concrete wall'], ['install a towel bar on brick wall', 'mount a towel bar on brick wall'],
    ['install a towel bar on drywall', 'mount a towel bar on drywall'], ['install a towel bar on tile wall', 'mount a towel bar on tile wall'], ['install a towel bar on plaster wall', 'mount a towel bar on plaster wall'],
    ['install the towel bar on my brick wall', 'mount the towel bar on my brick wall'], ['installing a towel ring on concrete wall', 'mount a towel ring on concrete wall'], ['install a towel rack on concrete wall', 'mount a towel rack on concrete wall'],
    ['install a grab bar on concrete wall', 'mount a grab bar on concrete wall'], ['install a grab bar on drywall', 'mount a grab bar on drywall'],
    ['install a shelf on concrete wall', 'mount a shelf on concrete wall'], ['install a mirror on brick wall', 'mount a mirror on brick wall'], ['install a mirror on drywall', 'mount a mirror on drywall'], ['install a tv on concrete wall', 'mount a tv on concrete wall'],
    ['install a tv on drywall', 'mount a tv on drywall'],
];
for (const [a, b] of TWINS) { const x = typed(E, a), y = typed(E, b); check(`1 "${a}" -> ${x.id} ${x.q}, the same as "${b}"`, sig(x) === sig(y) && !/crack_repair|plaster_wall_repair|wall_hole/.test(x.id) && x.id !== 'dynamic', { x, y }); }
check('1.1 the headline: install a towel bar on concrete wall is Wall Mounting for Any Item, not a crack repair', typed(E, 'install a towel bar on concrete wall').id === 'generic_mounting_service');
// 2. unchanged: what these phrases routed to before is pinned by identity
const KEEP = [
    ['install a dishwasher', 'dishwasher_install'], ['install a ceiling fan', 'ceiling_fan_install'], ['install a light fixture on brick wall', 'light_fixture_replacement'], ['install a faucet', 'faucet_repair_drip'],
    ['install a shower curtain rod on tile', 'blinds_shades_curtains_buy_the_hour'], ['repair a crack in concrete wall', 'brick_or_concrete_crack_repair'], ['patch a hole in drywall', 'wall_hole_or_crack_repair'],
    ['install a towel bar on concrete wall crack', 'brick_or_concrete_crack_repair'],
];
for (const [t, id] of KEEP) check(`2 "${t}" stays ${id}`, typed(E, t).id === id, typed(E, t));
for (const t of ['install tile on the wall', 'install a tile backsplash on the wall', 'install drywall on the wall', 'install a towel bar on tile floor', 'install a toilet on tile floor', 'install a dishwasher against the wall', 'install a towel bar'])
    check(`2 "${t}": not a mounting job (no item on a wall surface)`, typed(E, t).id !== 'generic_mounting_service' || /towel bar$/.test(t) === false, typed(E, t));
check('2.1 "install a towel bar" with no wall surface is not routed by this rule (unchanged: the dynamic fallback)', typed(E, 'install a towel bar').id === 'dynamic');
check('2.2 a damage word keeps the repair routing even beside an install-on-wall phrase (unchanged: not the mounting service)', ['fix the hole where the towel bar was installed on the drywall', 'patch the hole in the drywall where I installed a towel bar'].every(t => typed(E, t).id !== 'generic_mounting_service'));
check('2.3 hung/mount twins are untouched: mount a towel bar on concrete wall is still Wall Mounting for Any Item', typed(E, 'mount a towel bar on concrete wall').id === 'generic_mounting_service');
// 3. non-vacuity
{
    const a = JSON.parse(JSON.stringify(DB0)); for (const o of a.intent_mappings.objects) if (o.yields_to) delete o.yields_to.placed_by_any;
    const b = JSON.parse(JSON.stringify(DB0)); for (const o of b.intent_mappings.objects) delete o.mounts_items_any;
    check('3.1 non-vacuity: with the placing verbs removed the headline phrase is a crack repair again', typed(load(a), 'install a towel bar on concrete wall').id === 'brick_or_concrete_crack_repair');
    check('3.2 non-vacuity: with the mountable items removed the headline phrase is a crack repair again', typed(load(b), 'install a towel bar on concrete wall').id === 'brick_or_concrete_crack_repair');
}
finish();
