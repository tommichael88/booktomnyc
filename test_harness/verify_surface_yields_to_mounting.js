#!/usr/bin/env node
/**
 * verify_surface_yields_to_mounting.js -- T198 (B1): a wall material is not the job.
 *
 * Before: the `brick`, `concrete`, `drywall`, `plaster` and `tile` objects each default to a repair service, and their match outscored the mount object's weaker words ("hang", "put up",
 * "attach"). "Hang a picture on brick wall" was told to the customer as a brick/concrete crack repair ($70-$95); "hang a picture on plaster wall" as a plaster repair; on drywall as the
 * drywall-repair dynamic fallback ($295). The material the job happens ON decided what the job WAS.
 *
 * The relationship is authored on each surface object: `yields_to: { object: 'mount', unless_any: [damage words] }`. When the customer also says a mounting action and names no damage, the
 * mount object wins and its own overrides pick the service (the T197/T198 A1 table: shelf, mirror, frame, picture, art, sign on masonry = the mortar service; otherwise the standard or
 * generic mounting service). A damage word keeps the surface object. Engine: one step in detectIntentNLP that reads the field; no second router.
 *
 *   1. IDENTITY    expected service by the scope each service declares (not by what the router returns): a picture / heavy mirror / art on masonry = Shelf Mortar Mounting; an unnamed item = the
 *                  generic mounting service; a picture / shelf on drywall, plaster, tile = Shelf Mounting (standard); TV on plaster = the TV service.
 *   2. REPAIR      the repair jobs these objects exist for keep their service: a crack in brick/concrete, a hole in drywall, a cracked plaster wall, a cracked tile; a damage word wins even
 *                  beside a mounting word ("patch the hole in the brick wall where I hung a picture").
 *   3. NON-VACUITY plant the removal of `yields_to` (all five objects) in a copy of the catalog: the picture is a crack repair again; plant the removal of the damage guard: a hole beside a
 *                  mounting word leaves the repair service.
 *   4. SHAPE       every object that names a surface carries the field and its target exists; the engine reads it (source).
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..');
const { check, finish } = require('./_shared.js');
const { engine } = require('./_engine.js');

const DB0 = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
const clone = o => JSON.parse(JSON.stringify(o));
function load(db) {
    const sb = { DB: db, SERVICE_DATA: db, window: { DB: db }, console: { log() {}, warn() {}, error() {}, info() {}, debug() {} } };
    sb.global = sb;
    vm.createContext(sb);
    vm.runInContext(engine().wrapper, sb);
    if (typeof sb.initNlpSets === 'function') { sb.initNlpSets(); if (typeof sb.refreshNlpPreviewBindings === 'function') sb.refreshNlpPreviewBindings(); }
    return sb;
}
const typed = (sb, text) => { const c = sb.collectBookingContext_freeText(text); return sb.executeWorkflow(Object.assign({}, c, { tagsAffirmed: true }), sb.DB); };
const entityOf = (sb, text) => { const r = typed(sb, text); return (r.entity && r.entity.id) || 'dynamic'; };
const E = load(DB0);
const GENERIC = 'generic_mounting_service', MORTAR = 'shelf_mortar_mounting_buy_the_hour', STD = 'shelf_mounting_standard_buy_the_hour', TV = 'flatscreen_mounting_standard';
const CRACK = 'brick_or_concrete_crack_repair', HOLE = 'wall_hole_or_crack_repair', PLASTER = 'plaster_wall_repair';

// ===== 1. identity, by declared scope ======================================================================================================================================================
const IDENT = [
    ['Hang a picture on brick wall', MORTAR], ['Hang a heavy mirror on brick wall', MORTAR], ['hang art on cinder block wall', MORTAR], ['hang a picture on brick', MORTAR],
    ['hang a picture on concrete wall', MORTAR], ['put up a shelf on concrete', MORTAR],
    ['Mount something on concrete wall', GENERIC], ['mount something on brick wall', GENERIC],
    ['hang a picture on drywall', STD], ['hang a picture on plaster wall', STD], ['mount a shelf on plaster wall', STD], ['hang a picture on tile wall', STD], ['mount a shelf on tile', STD],
    ['mount a tv on plaster wall', TV], ['mount a tv on concrete', TV], ['mortar mounting', MORTAR],
];
for (const [t, want] of IDENT) check(`1.1 "${t}" -> ${want}`, entityOf(E, t) === want, { reached: entityOf(E, t) });
const picture = typed(E, 'Hang a picture on brick wall'), crackQuote = typed(E, 'fix crack in brick wall');
check('1.2 the picture on brick is not quoted the crack repair\'s figure', picture.quote.laborEstimate !== crackQuote.quote.laborEstimate, { picture: picture.quote.laborEstimate, crack: crackQuote.quote.laborEstimate });
check('1.3 the same picture sentence reaches the same service on brick and on concrete (the material is an answer, not the service)', entityOf(E, 'hang a picture on brick wall') === entityOf(E, 'hang a picture on concrete wall'));

// ===== 2. the repair jobs keep their service ===============================================================================================================================================
const REPAIRS = [
    ['fix crack in brick wall', CRACK], ['crack in my concrete wall', CRACK], ['brick wall', CRACK], ['repair hole in concrete wall', HOLE], ['patch hole in drywall', HOLE],
    ['plaster wall is cracked', PLASTER], ['cracked tile', 'loose_tile_replacement'], ['replace broken tile', 'loose_tile_replacement'],
    ['patch the hole in the brick wall where I hung a picture', CRACK], ['crack in the concrete wall behind the picture I hung', CRACK],   // a damage word beside a (weak) mounting word keeps the surface object
];
for (const [t, want] of REPAIRS) check(`2.1 "${t}" stays ${want}`, entityOf(E, t) === want, { reached: entityOf(E, t) });

// ===== 3. non-vacuity ========================================================================================================================================================================
const SURF = ['brick', 'concrete', 'drywall', 'plaster', 'tile'];
const without = mut => { const db = clone(DB0); mut(db); return load(db); };
const obj = (db, k) => db.intent_mappings.objects.find(o => o.keyword === k);
check('3.0 the real catalog has `yields_to` on every surface object', SURF.every(k => obj(DB0, k).yields_to && obj(DB0, k).yields_to.object === 'mount'));
const noYield = without(db => { for (const k of SURF) delete obj(db, k).yields_to; });
check('3.1 without `yields_to`: the picture on brick is a crack repair again (the test would catch the old behaviour)', entityOf(noYield, 'Hang a picture on brick wall') === CRACK, { reached: entityOf(noYield, 'Hang a picture on brick wall') });
check('3.2 without `yields_to`: the picture on plaster is a plaster repair again', entityOf(noYield, 'hang a picture on plaster wall') === PLASTER, { reached: entityOf(noYield, 'hang a picture on plaster wall') });
const noGuard = without(db => { for (const k of SURF) obj(db, k).yields_to.unless_any = []; });
check('3.3 without the damage guard: the hole beside a mounting word leaves the repair service', entityOf(noGuard, 'patch the hole in the brick wall where I hung a picture') !== CRACK, { reached: entityOf(noGuard, 'patch the hole in the brick wall where I hung a picture') });

// ===== 4. shape =============================================================================================================================================================================
check('4.1 each yields_to names an existing object and a non-empty damage list', SURF.every(k => { const y = obj(DB0, k).yields_to; return obj(DB0, y.object) && Array.isArray(y.unless_any) && y.unless_any.length > 0; }));
const nlpSrc = fs.readFileSync(path.join(ROOT, 'modules', 'nlp_engine.js'), 'utf8');
check('4.2 detectIntentNLP reads `yields_to` (one step, from authored data)', /bestMapping\.yields_to/.test(nlpSrc) && /scoreByMapping/.test(nlpSrc));

finish();
