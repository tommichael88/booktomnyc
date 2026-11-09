#!/usr/bin/env node
/**
 * verify_unsupported_inferences.js -- T198 (C1): a tag may be inferred from the customer's words only when the words say it.
 *
 * Before: (1) `#emergency` listed "leak", "leaky", "leakage" among its context hints, so a plain "Under-Sink Leak Repair" carried #emergency and the answer "Urgent - today or tomorrow" and was quoted
 * the urgent price ($125 typed against the tile's $75), though the customer said nothing about timing (T166 had moved the words from code to data and noted the bare "leak" as a known problem).
 * (2) `#clogged_drain` listed "slow drain" among its synonyms and answers drain_speed "Standing water - completely blocked", so "Slow Drain Clearing" was told to the customer as completely blocked and
 * quoted $105 against the tile's $70: the tag's one answer contradicted the words that triggered it.
 *
 * What stays: every word that DOES say urgent still infers it ("urgent", "asap", "today", "emergency", "flooding", "gas leak", "same day", "right now", "no power"), and the words that say blocked still infer
 * a blocked drain ("clogged drain", "water backing up", "blocked pipe", "unclog").
 *
 *   1. UNSUPPORTED   a leak or a slow drain, with nothing said about time or blockage, carries no tag and no inferred answer, and is quoted what its own tile quotes.
 *   2. SUPPORTED     the words that say urgent / blocked still infer their tag and answer (real urgent cases are protected), and an urgent leak is quoted the urgent price.
 *   3. NON-VACUITY   plant the old vocabulary back into a copy of the catalog: the leak is urgent again, the slow drain is blocked again.
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
const E = load(DB0);
const typed = (sb, text) => { const c = sb.collectBookingContext_freeText(text); const r = sb.executeWorkflow(Object.assign({}, c, { tagsAffirmed: true }), sb.DB); return { c, r }; };
const tagsOf = (sb, t) => typed(sb, t).c.detectedTagIds || [];
const idOf = (sb, t) => { const r = typed(sb, t).r; return (r.entity && r.entity.id) || 'dynamic'; };
const tileQuote = (sb, id) => { const s = sb.DB.services.find(x => x.id === id); const c = sb.collectBookingContext_catalog(s, s.ui_taxonomy.category_id); c.answers = {}; return sb.executeWorkflow(c, sb.DB).quote; };

// ===== 1. unsupported inferences are gone ====================================================================================================================================================
const LEAK = 'leak_under_sink_repair', DRAIN = 'slow_drain_clearing';
for (const t of ['Under-Sink Leak Repair', 'fix a leak under the sink', 'under sink leak repair', 'leaking pipe under the sink']) {
    const x = typed(E, t);
    check(`1.1 "${t}": no #emergency and no urgency answer (the customer said nothing about timing)`, !(x.c.detectedTagIds || []).includes('#emergency') && !(x.r.answers || {}).urgency, { tags: x.c.detectedTagIds, answers: x.r.answers });
}
{
    const x = typed(E, 'Under-Sink Leak Repair'), tile = tileQuote(E, LEAK);
    check('1.2 a plain Under-Sink Leak Repair is quoted what its own tile quotes (not the urgent price)', idOf(E, 'Under-Sink Leak Repair') === LEAK && x.r.quote.laborEstimate === tile.laborEstimate && x.r.quote.totalMin === tile.totalMin, { typed: [x.r.quote.laborEstimate, x.r.quote.totalMin], tile: [tile.laborEstimate, tile.totalMin] });
    check('1.3 my dishwasher is leaking: the leak word alone does not tag the job urgent', !tagsOf(E, 'my dishwasher is leaking').includes('#emergency'));
}
for (const t of ['Slow Drain Clearing', 'slow drain', 'my drain is slow']) {
    const x = typed(E, t);
    check(`1.4 "${t}": no #clogged_drain and no "completely blocked" answer`, !(x.c.detectedTagIds || []).includes('#clogged_drain') && !(x.r.answers || {}).drain_speed, { tags: x.c.detectedTagIds, answers: x.r.answers });
}
{
    const x = typed(E, 'Slow Drain Clearing'), tile = tileQuote(E, DRAIN);
    check('1.5 Slow Drain Clearing is quoted what its own tile quotes', idOf(E, 'Slow Drain Clearing') === DRAIN && x.r.quote.laborEstimate === tile.laborEstimate && x.r.quote.totalMin === tile.totalMin, { typed: [x.r.quote.laborEstimate, x.r.quote.totalMin], tile: [tile.laborEstimate, tile.totalMin] });
}

// ===== 2. what does say it still infers it ====================================================================================================================================================
for (const t of ['urgent leak under the sink tonight', 'leak under the sink asap', 'emergency leak under the sink', 'leak under the sink, I need it today', 'leak under the sink same day', 'flooding under the sink', 'leak under the sink right now']) {
    const x = typed(E, t);
    check(`2.1 "${t}": still #emergency with the urgency answer`, (x.c.detectedTagIds || []).includes('#emergency') && /Urgent/.test((x.r.answers || {}).urgency || ''), { tags: x.c.detectedTagIds, answers: x.r.answers });
}
{
    const urgent = typed(E, 'urgent leak under the sink tonight'), plain = typed(E, 'Under-Sink Leak Repair');
    check('2.2 an urgent leak is still quoted more than a plain one (the urgency is priced when it is said)', idOf(E, 'urgent leak under the sink tonight') === LEAK && urgent.r.quote.laborEstimate > plain.r.quote.laborEstimate, { urgent: urgent.r.quote.laborEstimate, plain: plain.r.quote.laborEstimate });
}
for (const t of ['clogged drain', 'water backing up in the sink', 'blocked pipe under the sink', 'unclog the drain']) {
    check(`2.3 "${t}": still #clogged_drain`, tagsOf(E, t).includes('#clogged_drain'), { tags: tagsOf(E, t) });
}

// ===== 3. non-vacuity ========================================================================================================================================================================
const without = mut => { const db = clone(DB0); mut(db); return load(db); };
{
    const oldHints = without(db => { db.smart_tags['#emergency'].context_hints.push('leak', 'leaky', 'leakage'); });
    check('3.1 with "leak" back among the #emergency hints: Under-Sink Leak Repair is urgent again (the test would catch the old behaviour)', tagsOf(oldHints, 'Under-Sink Leak Repair').includes('#emergency') && typed(oldHints, 'Under-Sink Leak Repair').r.quote.laborEstimate > typed(E, 'Under-Sink Leak Repair').r.quote.laborEstimate);
    const oldSyn = without(db => { db.smart_tags['#clogged_drain'].synonyms.unshift('slow drain'); db.smart_tags['#clogged_drain'].answers = { drain_speed: 'Standing water - completely blocked' }; });   // T198 (F1): the old tag also carried the answer; plant both
    check('3.2 with "slow drain" back among the #clogged_drain synonyms: Slow Drain Clearing is "completely blocked" again', tagsOf(oldSyn, 'Slow Drain Clearing').includes('#clogged_drain') && /completely blocked/.test((typed(oldSyn, 'Slow Drain Clearing').r.answers || {}).drain_speed || ''));
}
check('3.3 the real catalog lists neither word', !DB0.smart_tags['#emergency'].context_hints.some(h => /^leak/.test(h)) && !DB0.smart_tags['#clogged_drain'].synonyms.includes('slow drain'));

finish();
