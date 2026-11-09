#!/usr/bin/env node
/**
 * verify_typed_fact_service_category.js -- T198 (D4, #252): a tag typed beside a furniture word is judged in the category of the service the words reached, not only the object's.
 *
 * Before: "scratch or water ring removal from furniture on water stain" reached its minor_home_repairs service, but the request kept the object's category (furniture_fixes_assembly), so `#water_damage`
 * (applicable to minor_home_repairs and plumbing_help) was dropped and the card asked damage_type though the customer said "water stain" (quoted 45 / 55 min). After: the tag is kept, answers the question, and
 * the quote is what the tile quotes for that answer.
 *   1. KEPT        the three phrasings carry #water_damage, the question is answered, and the quote equals the service's tile with that answer chosen.
 *   2. PROTECTED   furniture services of another category are not given the tag ("Flat-Pack Furniture Assembly on water stain", "PAX wardrobe on water stain"): no #water_damage, price as before.
 *   3. NON-VACUITY plant the old category test back: the three are dropped again.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..');
const { check, finish } = require('./_shared.js');
const { engine } = require('./_engine.js');
const DB0 = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
function load(db, mut) {
    const sb = { DB: db, SERVICE_DATA: db, window: { DB: db }, console: { log() {}, warn() {}, error() {}, info() {}, debug() {} } };
    sb.global = sb; vm.createContext(sb); vm.runInContext(mut ? mut(engine().wrapper) : engine().wrapper, sb);
    if (typeof sb.initNlpSets === 'function') { sb.initNlpSets(); if (typeof sb.refreshNlpPreviewBindings === 'function') sb.refreshNlpPreviewBindings(); }
    return sb;
}
const typed = (sb, t) => { const c = sb.collectBookingContext_freeText(t); const r = sb.executeWorkflow(Object.assign({}, c, { tagsAffirmed: true }), sb.DB); return { c, r }; };
const E = load(DB0), SVC = 'scratch_or_water_ring_removal', svc = E.DB.services.find(x => x.id === SVC);
const tileWith = (sb, ans) => { const s = sb.DB.services.find(x => x.id === SVC); const c = sb.collectBookingContext_catalog(s, s.ui_taxonomy.category_id); c.answers = { damage_type: ans }; return sb.executeWorkflow(c, sb.DB).quote; };
const tile = tileWith(E, 'Water ring / moisture stain');
for (const p of ['scratch or water ring removal from furniture on water stain', 'furniture a scratch on water stain', 'furniture a scratches on water stain']) {
    const x = typed(E, p), q = x.r.quote || {};
    check(`1 "${p}": the service, #water_damage kept, damage_type answered, quoted its tile for that answer (${tile.laborEstimate}/${tile.totalMin})`,
        x.r.entity && x.r.entity.id === SVC && (x.c.detectedTagIds || []).includes('#water_damage') && (x.r.answers || {}).damage_type === 'Water ring / moisture stain' && q.laborEstimate === tile.laborEstimate && q.totalMin === tile.totalMin,
        { id: x.r.entity && x.r.entity.id, tags: x.c.detectedTagIds, ans: (x.r.answers || {}).damage_type, q: [q.laborEstimate, q.totalMin] });
}
for (const p of ['flat-pack furniture assembly on water stain', 'PAX wardrobe assembly on water stain']) {
    const x = typed(E, p);
    check(`2 "${p}": a furniture service in another category is not given #water_damage`, !(x.c.detectedTagIds || []).includes('#water_damage'), { id: x.r.entity && x.r.entity.id, tags: x.c.detectedTagIds });
}
{
    const P = load(JSON.parse(JSON.stringify(DB0)), w => w.replace(/ \|\| \(svcCat && cats\.includes\(svcCat\)\)/, ''));
    const x = typed(P, 'furniture a scratch on water stain');
    check('3 non-vacuity: with the object-category test alone the water stain is dropped again', !(x.c.detectedTagIds || []).includes('#water_damage'), { tags: x.c.detectedTagIds });
}
finish();
