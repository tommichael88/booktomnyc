#!/usr/bin/env node
/**
 * verify_masonry_mount_identity.js -- T198 (A1): a mounting request that names no item is not a SHELF job because the wall is brick.
 *
 * Before: T197 (#250) authored a contextual override on the `mount` object that sent EVERY request with a masonry word to Shelf Mortar Mounting (an hourly, skilled-tier service for shelves,
 * picture frames, heavy mirrors and wall art). "Wall Mounting for Any Item on brick wall" -- the generic service's own name plus a wall -- was told to the customer as "a shelf mortar mounting job"
 * and quoted From $304 (engine labor $358), while the same sentence on drywall was the generic service at $75. The wall changed the SERVICE, not just its wall answer.
 *
 * The relationship is a conjunction (masonry word AND an item the mortar service mounts), so the override carries `requires_any` and both override evaluators honour it (modules/nlp_engine.js
 * detectIntentNLP; qr.html's object-based re-check). A masonry word alone leaves the mount object's default, the generic service, which asks the item and the wall.
 *
 *   1. IDENTITY      expected service identity by the SCOPE each service declares (shelf, mirror, frame, art, sign on masonry = the mortar service; TV = the TV service; an unnamed item = the generic
 *                    service), not by what the router returns.
 *   2. CONVERGENCE   the same generic sentence reaches the same service on brick, concrete-free walls and drywall; its quote on brick is its own tile's quote with the wall answered, and it is not the
 *                    mortar service's hourly figure.
 *   3. NON-VACUITY   plant each part's removal in a copy of the catalog: no `requires_any` -> the generic request is a shelf job again; no masonry override -> a named shelf on brick leaves the mortar
 *                    service; no "mortar" override -> the word "mortar" leaves it.
 *   4. BOTH EVALUATORS  the two places that read a contextual override both ask the one helper that owns `requires_any` (overrideRequiresMet, nlp_engine).
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

// ===== 1. identity, by declared scope ======================================================================================================================================================
const UNNAMED = [   // no item the mortar service mounts is named: the job is "Wall Mounting for Any Item" whatever the wall
    'wall mounting for any item on brick wall', 'wall mounting for any item', 'wall mounting for any item on drywall', 'mount something on a brick wall',
    'I need a bracket mounted on a brick wall', 'mount items on a brick wall',
];
for (const t of UNNAMED) check(`1.1 "${t}" is the generic mounting service, not a shelf job`, entityOf(E, t) === GENERIC, { reached: entityOf(E, t) });
const NAMED_ON_MASONRY = [   // the service's own scope: shelves, picture frames, heavy mirrors, wall art (and the signs/artwork rule beside it) into brick, concrete or mortar
    'mount a shelf on brick wall', 'hang a floating shelf on brick', 'install a shelf in brick', 'mount a mirror on brick wall', 'hang art on masonry wall', 'mount a sign on brick wall',
    'mortar mounting', 'mount floating shelves on a cinder block wall',
];
for (const t of NAMED_ON_MASONRY) check(`1.2 "${t}" stays Shelf Mortar Mounting (the T197 coverage)`, entityOf(E, t) === MORTAR, { reached: entityOf(E, t) });
const OTHERS = [   // the neighbours the change must not move
    ['mount a tv on brick wall', TV], ['mount a tv on drywall', TV], ['mount a shelf on drywall', STD], ['mount a mirror on drywall', STD], ['mount a shelf and a tv on brick', TV],
];
for (const [t, want] of OTHERS) check(`1.3 "${t}" -> ${want}`, entityOf(E, t) === want, { reached: entityOf(E, t) });
const mortarName = DB0.services.find(s => s.id === MORTAR).ui_taxonomy.display_name;
check(`1.4 the mortar service's own published name ("${mortarName}") still reaches it (T197: all 76 names)`, entityOf(E, mortarName) === MORTAR, { reached: entityOf(E, mortarName) });

// ===== 2. convergence =========================================================================================================================================================================
const onBrick = typed(E, 'wall mounting for any item on brick wall'), onDrywall = typed(E, 'wall mounting for any item on drywall'), mortar = typed(E, 'mount a shelf on brick wall');
check('2.1 the generic sentence is the same service on brick and on drywall (the wall is an answer, not a different service)', onBrick.entity && onDrywall.entity && onBrick.entity.id === onDrywall.entity.id);
const svc = DB0.services.find(s => s.id === GENERIC);
const tile = E.collectBookingContext_catalog(svc, svc.ui_taxonomy.category_id); tile.answers = { wall_type: 'Brick or concrete' };
const tileQuote = E.executeWorkflow(tile, E.DB).quote;
check('2.2 typed on brick, the generic service quotes what its own tile quotes with the wall answered "Brick or concrete"', onBrick.quote.laborEstimate === tileQuote.laborEstimate && onBrick.quote.totalMin === tileQuote.totalMin,
    { typed: [onBrick.quote.laborEstimate, onBrick.quote.totalMin], tile: [tileQuote.laborEstimate, tileQuote.totalMin] });
check('2.3 the generic request is not quoted the mortar service\'s hourly figure', onBrick.quote.laborEstimate !== mortar.quote.laborEstimate && onBrick.quote.laborEstimate < mortar.quote.laborEstimate,
    { generic: onBrick.quote.laborEstimate, mortar: mortar.quote.laborEstimate });
check('2.4 the brick answer still prices the generic service (brick costs more than drywall)', onBrick.quote.laborEstimate > onDrywall.quote.laborEstimate, { brick: onBrick.quote.laborEstimate, drywall: onDrywall.quote.laborEstimate });

// ===== 3. non-vacuity ========================================================================================================================================================================
const mountOverrides = db => db.intent_mappings.objects.find(o => o.keyword === 'mount').contextual_overrides;
const masonryOf = db => mountOverrides(db).find(c => Array.isArray(c.requires_any));
const without = mut => { const db = clone(DB0); mut(db); return load(db); };
check('3.0 the real catalog carries the conditional masonry override and the unconditional "mortar" one', !!masonryOf(DB0) && mountOverrides(DB0).some(c => (c.keywords || []).join() === 'mortar'));
check('3.1 without `requires_any`: the generic request is a shelf job again (the test would catch the T197 behaviour)',
    entityOf(without(db => { delete masonryOf(db).requires_any; }), 'wall mounting for any item on brick wall') === MORTAR);
check('3.2 without the masonry override: a named shelf on brick leaves the mortar service (the item arm is measured)',
    entityOf(without(db => { db.intent_mappings.objects.find(o => o.keyword === 'mount').contextual_overrides = mountOverrides(db).filter(c => !Array.isArray(c.requires_any)); }), 'mount a mirror on brick wall') !== MORTAR);
check('3.3 without the "mortar" override: the word "mortar" no longer reaches the mortar service',
    entityOf(without(db => { db.intent_mappings.objects.find(o => o.keyword === 'mount').contextual_overrides = mountOverrides(db).filter(c => (c.keywords || []).join() !== 'mortar'); }), 'mortar mounting') !== MORTAR);

// ===== 4. both evaluators ask the one helper, `overrideRequiresMet` ============================================================================================================================================
const nlpSrc = fs.readFileSync(path.join(ROOT, 'modules', 'nlp_engine.js'), 'utf8'), pageSrc = require('./_page.js').readPage(path.join(ROOT, 'qr.html'), ROOT);
check('4.1 detectIntentNLP (modules/nlp_engine.js) asks overrideRequiresMet of each override it considers, and that helper reads requires_any', /overrideRequiresMet\(ctx, lower\)/.test(nlpSrc) && /function overrideRequiresMet[\s\S]{0,200}requires_any/.test(nlpSrc));
check('4.2 the object-based re-check in qr.html asks the same helper (one owner of the rule)', /ctxMatch = objectMap\.contextual_overrides\.find[\s\S]{0,300}overrideRequiresMet\(ov, lowerDesc\)/.test(pageSrc));

finish();
