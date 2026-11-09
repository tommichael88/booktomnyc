#!/usr/bin/env node
/**
 * verify_tag_service_exclusion.js -- T198 (D2/D3, #248): a tag authored as "never for this service" (excluded_service_ids) is not applied to that service on ANY entry path:
 * the typed words, a catalog tile, the session (guided-builder/chip) tag set, the chips offered, and the group test. All 13 authored (tag, service) pairs are walked (section 4).
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

// ===== 4. the whole contract: every authored (tag, service) pair on every path ======================================================================================================
const PAIRS = [];
for (const [tid, t] of Object.entries(DB0.smart_tags)) for (const sid of (t.excluded_service_ids || [])) PAIRS.push([tid, sid]);
check('4.0 the catalog authors 13 (tag, service) exclusion pairs (the contract walked below)', PAIRS.length === 13, PAIRS.length);
const stateFor = (s, cat, man) => ({ qty: 1, intent: { key: s.id, category: cat, label: 'x', qtyLabel: 'item' }, stype: 'Repair', answers: {}, detTagIds: [], manTagIds: man || [], negatedTagIds: [], inherentTagIds: [], userTagIds: [], _svc: s, _tagsAffirmed: true });
const catalogRoute = (sb, s, man) => { const c = sb.collectBookingContext_catalog(s, s.ui_taxonomy.category_id); c.answers = {}; c.manuallyToggledTagIds = man || []; return sb.executeWorkflow(c, sb.DB); };
const sig = q => [q.laborEstimate, q.totalMin].join('/');
for (const [tid, sid] of PAIRS) {
    const s = E.DB.services.find(x => x.id === sid), cat = s.ui_taxonomy.category_id, grp = s.ui_taxonomy.group_id;
    const base = catalogRoute(E, s), withTag = catalogRoute(E, s, [tid]);
    check(`4.1 ${tid} x ${sid}: catalog tile with the tag tapped does not carry it and quotes the tile`, !(withTag.activeTags || []).includes(tid) && sig(withTag.quote) === sig(base.quote), { active: withTag.activeTags });
    const st0 = E.computeQuoteFromState(stateFor(s, cat)), st1 = E.computeQuoteFromState(stateFor(s, cat, [tid]));
    check(`4.2 ${tid} x ${sid}: the session (builder/chip) path does not carry it and quotes the same`, !st1.activeTagIds.includes(tid) && st1.laborCalc === st0.laborCalc, { active: st1.activeTagIds });
    check(`4.3 ${tid} x ${sid}: not offered as a chip, not in scope for a typed request`, E.tagValidForCategory(tid, cat, grp, sid) === false && E.tagInScopeForRequest(tid, cat, grp, sid) === false);
    check(`4.4 ${tid} x ${sid}: the three entry paths quote one price for the same request`, sig(base.quote) === sig(withTag.quote) && String(st0.laborCalc) === String(base.quote.laborEstimate));
    // PROTECTED: some other service still carries the tag when it is tapped (the exclusion is per service, not per tag)
    const others = E.DB.services.filter(x => x.id !== sid && !((E.DB.smart_tags[tid].excluded_service_ids) || []).includes(x.id) && E.tagValidForCategory(tid, x.ui_taxonomy.category_id, x.ui_taxonomy.group_id, x.id));
    check(`4.5 ${tid}: other services (${others.length}) still carry it when tapped`, others.length > 0 && others.some(o => (catalogRoute(E, o, [tid]).activeTags || []).includes(tid)));
}
{   // money: a tag that prices on a service that does not exclude it keeps its price there
    const o = E.DB.services.find(x => x.id === 'ceiling_fan_install'), a = catalogRoute(E, o), b = catalogRoute(E, o, ['#very_high_ceiling']);
    check('4.6 the ceiling surcharge still prices on a ceiling fan install', o && (b.activeTags || []).includes('#very_high_ceiling') && b.quote.laborEstimate > a.quote.laborEstimate, { a: a.quote && a.quote.laborEstimate, b: b.quote && b.quote.laborEstimate });
}
{   // non-vacuity: plant the exclusions out of the catalog; every path then carries the tag
    const db = JSON.parse(JSON.stringify(DB0));
    for (const t of Object.values(db.smart_tags)) delete t.excluded_service_ids;
    const P = load(db), s = P.DB.services.find(x => x.id === SVC), cat = s.ui_taxonomy.category_id;
    check('4.7 non-vacuity: with the exclusions removed the catalog route carries the ceiling tag and charges for it', (catalogRoute(P, s, ['#very_high_ceiling']).activeTags || []).includes('#very_high_ceiling') && catalogRoute(P, s, ['#very_high_ceiling']).quote.laborEstimate > catalogRoute(P, s).quote.laborEstimate);
    check('4.8 non-vacuity: with the exclusions removed the session path carries it', P.computeQuoteFromState(stateFor(s, cat, ['#very_high_ceiling'])).activeTagIds.includes('#very_high_ceiling'));
}
finish();
