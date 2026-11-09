#!/usr/bin/env node
/**
 * verify_tag_service_exclusion.js -- T198 (D2, #248): a tag authored as "never for this service" (excluded_service_ids) is not applied to that service by the words a customer typed.
 *
 * Before: no caller handed the service to the scope test, so "under-cabinet light install on very high ceiling" carried #very_high_ceiling and was charged $140 / 140 min for ceiling height on a
 * light installed under a cabinet (its tile: $70 / 80). After: the request-level scope test (tagInScopeForRequest) refuses a tag the service excludes.
 *
 *   1. EXCLUDED     the ceiling-height phrasings carry no ceiling tag and are quoted what the service's tile quotes.
 *   2. PROTECTED    the same words for a service that does not exclude them (a ceiling fan, a chandelier) still carry the tag and the surcharge.
 *   3. NON-VACUITY  plant the exclusion out of a copy of the catalog: the old charge returns.
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
const typed = (sb, t) => { const c = sb.collectBookingContext_freeText(t); const r = sb.executeWorkflow(Object.assign({}, c, { tagsAffirmed: true }), sb.DB); return { c, r }; };
const tile = (sb, id) => { const s = sb.DB.services.find(x => x.id === id); const c = sb.collectBookingContext_catalog(s, s.ui_taxonomy.category_id); c.answers = {}; return sb.executeWorkflow(c, sb.DB).quote; };
const SVC = 'under_cabinet_light_install', E = load(DB0);
const t0 = tile(E, SVC);
const PH = ['under-cabinet light install on vaulted ceiling', 'under-cabinet light install on very high ceiling', 'light fixture a under cabinet on very high ceiling'];
for (const p of PH) {
    const x = typed(E, p), q = x.r.quote || {};
    check(`1.${PH.indexOf(p) + 1} "${p}": no ceiling tag, quoted its tile (${t0.laborEstimate}/${t0.totalMin})`,
        x.r.entity && x.r.entity.id === SVC && !(x.c.detectedTagIds || []).some(t => /ceiling/.test(t)) && q.laborEstimate === t0.laborEstimate && q.totalMin === t0.totalMin, { tags: x.c.detectedTagIds, q: [q.laborEstimate, q.totalMin] });
}
for (const p of ['ceiling fan install on very high ceiling', 'chandelier install on vaulted ceiling']) {
    const x = typed(E, p);
    check(`2 "${p}": a service that does not exclude the tag still carries it`, (x.c.detectedTagIds || []).some(t => /ceiling/.test(t)), { tags: x.c.detectedTagIds });
}
{
    const db = JSON.parse(JSON.stringify(DB0));
    for (const t of Object.values(db.smart_tags)) if (t.excluded_service_ids) t.excluded_service_ids = t.excluded_service_ids.filter(s => s !== SVC);
    const P = load(db), x = typed(P, PH[1]);
    check('3 non-vacuity: with the exclusion planted out of the catalog the old ceiling charge returns', (x.c.detectedTagIds || []).some(t => /ceiling/.test(t)) && x.r.quote.laborEstimate > t0.laborEstimate, { tags: x.c.detectedTagIds, q: x.r.quote && x.r.quote.laborEstimate });
}
finish();
