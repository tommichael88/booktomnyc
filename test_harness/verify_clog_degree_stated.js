#!/usr/bin/env node
/**
 * verify_clog_degree_stated.js -- T198 (F1): "clogged drain" says the drain is clogged, not that it is completely blocked.
 *
 * Before: #clogged_drain answered drain_speed "Standing water - completely blocked" for every clog word ("clogged drain", "drain clog", "unclog", "drain is partially clogged", "clogged drain but
 * water still goes down slowly"), a $35 / 30 min charge for a degree nobody stated, and the question was shown already answered. After: the degree is stated or asked.
 *   1. UNSTATED  a plain clog word carries #clogged_drain and no drain_speed answer; the price is the service's price without the blocked-drain charge; where the service asks drain_speed it is asked.
 *   2. COMPLETE  words that say so (completely/totally clogged, standing water, won't drain at all, water backing up) carry the answer "Standing water - completely blocked" and its charge, as before.
 *   3. PARTIAL   words that say the drain still drains (partially clogged, draining slowly, goes down slowly) carry the question's own "Slow" answer, no charge.
 *   4. NON-VACUITY  plant the old tag (the answer back on #clogged_drain): the plain clog words are "completely blocked" again.
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
const typed = (sb, t) => { const c = sb.collectBookingContext_freeText(t); const r = sb.executeWorkflow(Object.assign({}, c, { tagsAffirmed: true }), sb.DB); const q = r.quote || {}; return { id: (r.entity && r.entity.id) || r.entityType, q: q.laborEstimate + '/' + q.totalMin, ans: (r.answers || {}).drain_speed || null, tags: c.detectedTagIds || [], asks: (r.visibleChain || []).map(x => x.id) }; };
const E = load(DB0), FULL = 'Standing water - completely blocked', SLOW = 'Slow - takes a few minutes to empty';
const sdc = E.DB.services.find(x => x.id === 'slow_drain_clearing');
const tile = a => { const c = E.collectBookingContext_catalog(sdc, sdc.ui_taxonomy.category_id); c.answers = a ? { drain_speed: a } : {}; const q = E.executeWorkflow(c, E.DB).quote; return q.laborEstimate + '/' + q.totalMin; };
const t0 = tile(null), tFull = tile(FULL), tSlow = tile(SLOW);
function FULLQ() { return tFull; }
check('0 the service tile: unanswered and "Slow" cost the same, "completely blocked" costs more (the charge lives in the answer)', t0 === tSlow && t0 !== tFull, { t0, tSlow, tFull });
for (const p of ['clogged drain', 'clogged sink', 'unclog the drain', 'drain clog', 'clogged shower drain', 'bathtub drain clog']) {
    const x = typed(E, p);
    check(`1 "${p}": clogged, degree unstated -> no drain_speed answer (${x.id} ${x.q})`, x.tags.includes('#clogged_drain') && x.ans === null && !x.tags.includes('#drain_blocked_completely'), x);
}
for (const p of ['drain clog', 'bathtub drain clog']) { const x = typed(E, p); check(`1.1 "${p}": Slow Drain Clearing quotes its unanswered price (${t0}) and asks drain_speed`, x.id === 'slow_drain_clearing' && x.q === t0 && x.asks.includes('q.drain_speed'), x); }
for (const p of ['completely clogged drain', 'totally clogged sink', "sink won't drain at all", 'completely clogged bathtub drain'])
    check(`2 "${p}": says so -> "completely blocked" and its charge`, typed(E, p).ans === FULL && typed(E, p).tags.includes('#drain_blocked_completely'), typed(E, p));
check('2.1 a completely blocked bathtub drain on the service tile price: the same charge as the tile with that answer', (() => { const x = typed(E, 'bathtub drain completely blocked'); return x.id !== 'slow_drain_clearing' || x.q === tFull; })());
for (const p of ['drain is partially clogged', 'clogged drain but water still goes down slowly', 'sink is draining slowly', 'bathtub drain is partially clogged']) {
    const x = typed(E, p);
    check(`3 "${p}": still drains -> "Slow", no blocked charge (${x.q})`, x.ans === SLOW && x.tags.includes('#drain_partially_clogged') && !x.tags.includes('#drain_blocked_completely'), x);
}
check('3.1 "slow drain" (the service itself) is unchanged: Slow Drain Clearing, no clog tag, its unanswered price', (() => { const x = typed(E, 'slow drain'); return x.id === 'slow_drain_clearing' && x.q === t0 && x.ans === null && !x.tags.includes('#clogged_drain'); })());
{
    const db = JSON.parse(JSON.stringify(DB0)); db.smart_tags['#clogged_drain'].answers = { drain_speed: FULL };
    const P = load(db); const x = typed(P, 'clogged drain');
    check('4 non-vacuity: with the answer back on #clogged_drain the plain clog word is "completely blocked" again', x.ans === FULL, x);
}
// 5. the job is a drain job, whatever the sink word says: a blocked or slow sink is not a faucet repair, and the degree tags price it as the drain service prices it
for (const [p, price, tag] of [["sink won't drain at all", FULLQ(), '#drain_blocked_completely'], ['clogged sink', t0, '#clogged_drain'], ['unclog my sink', t0, '#clogged_drain'], ['my kitchen sink is clogged', t0, '#clogged_drain'],
    ['bathroom sink is completely clogged', FULLQ(), '#drain_blocked_completely'], ['kitchen sink blocked', t0, null], ['sink is draining slowly', t0, '#drain_partially_clogged']]) {
    const x = typed(E, p);
    check(`5 "${p}": Slow Drain Clearing, ${price} (not a faucet repair or an under-sink leak)`, x.id === 'slow_drain_clearing' && x.q === price && (!tag || x.tags.includes(tag)), x);
}
for (const [p, id] of [['fix dripping faucet', 'faucet_repair_drip'], ['sink faucet replacement', 'faucet_repair_drip'], ['leak under the kitchen sink', 'leak_under_sink_repair'], ['leaky kitchen sink faucet', 'leak_under_sink_repair']])
    check(`5.1 "${p}" is unchanged: ${id}`, typed(E, p).id === id, typed(E, p));
{
    const db = JSON.parse(JSON.stringify(DB0)); const f = db.intent_mappings.objects.find(o => o.keyword === 'faucet'); f.contextual_overrides = f.contextual_overrides.filter(c => c.override_sku !== 'slow_drain_clearing');
    const P = load(db);
    check('5.2 non-vacuity: without the faucet-object override a clogged sink is a faucet repair again', typed(P, 'clogged sink').id !== 'slow_drain_clearing' && typed(P, "sink won't drain at all").id === 'faucet_repair_drip');
}
finish();
