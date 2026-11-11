#!/usr/bin/env node
/**
 * verify_typed_count_answers_question.js -- T198 (G1, #249): a count the customer typed answers the count question that asks about that thing.
 *
 * Before: "replace 3 light bulbs" reached Led Bulb Upgrade, the count was extracted (qty 3) and the customer was still asked "How many light bulbs need attention?" -- the same question,
 * the same quote as "replace 1 light bulb" and "replace 6 light bulbs". After: the option whose AUTHORED count_range contains the stated count is the answer; nothing else changes.
 *   0. THE DATA     every count question of every service (item_count_template) carries a count_range on every option: integers, 1 or more, max >= min, no two ranges of a question overlap.
 *   1. REPRESENTATIVE  Led Bulb Upgrade: one, two, three, four, six (the boundaries of "1 bulb", "2-3 bulbs", "4-6 bulbs"), by digit and by word, with and without the adjective.
 *   2. NOT STATED   no number, "0", a count past the last authored range (7 bulbs), a count after the noun: the question is still asked (no guess).
 *   3. AMBIGUOUS    two different counts beside the question's noun ("2 bulbs and 4 bulbs"): asked. The same count twice: answered. A count beside ANOTHER noun answers another question.
 *   4. INCIDENTAL   a TV size, a model number, an ordinal floor, a duration, a height, a room count, a bedroom count: never an item count.
 *   5. PRICE        a typed count quotes what tapping that answer quotes (labor, minutes, checkout state), for every service in the family; the quantity the quote prices stays 1 (no double count); and the
 *                   quote does not change against the same words with the number removed.
 *   6. THE FAMILY   all 18 count questions: the stated count lands on the option whose range contains it, at each option's lowest and highest count; the lowest count one past the last range asks.
 *   7. THE CUSTOMER'S OWN ANSWER is never replaced by a typed count.
 *   8. NON-VACUITY  without the ranges nothing is answered; with two overlapping ranges nothing is answered; with the labels renamed the answer still follows the range (the label is never read).
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
const E = load(DB0);
const KEY = 'item_count_template::light bulbs';
const countKey = r => (r.visibleChain || []).map(m => m.moduleKey).find(k => /^item_count_template/.test(k));
const typed = (sb, t) => {
    const c = sb.collectBookingContext_freeText(t); const r = sb.executeWorkflow(Object.assign({}, c, { tagsAffirmed: true }), sb.DB); const q = r.quote || {};
    const k = countKey(r);
    return { id: (r.entity && r.entity.id) || r.entityType, q: q.laborEstimate + '/' + q.totalMin + '/' + q.checkoutStateKey, units: r.quantity && r.quantity.units, key: k || null,
        ans: k ? ((r.answers || {})[k] || null) : null, open: (r.visibleChain || []).filter(m => !(r.answers || {})[m.moduleKey]).map(m => m.moduleKey) };
};
const countSteps = db => db.services.map(s => ({ s, step: (s.intake_chain || []).find(x => x.module === 'item_count_template') })).filter(x => x.step);

// 0. the data -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const family = countSteps(DB0);
check('0 the family is the 18 services that ask a count question', family.length === 18, family.length);
for (const { s, step } of family) {
    const os = step.params.client_response, rs = os.map(o => o.count_range);
    const shaped = rs.every(r => r && Number.isInteger(r.min) && r.min >= 1 && (r.max === undefined || (Number.isInteger(r.max) && r.max >= r.min)) && Object.keys(r).every(k => k === 'min' || k === 'max'));
    const sorted = rs.slice().sort((a, b) => a.min - b.min); let disjoint = true;
    for (let i = 1; i < sorted.length; i++) if (sorted[i].min <= (sorted[i - 1].max === undefined ? Infinity : sorted[i - 1].max)) disjoint = false;
    check(`0.1 ${s.id}: every option carries a count_range, and the ranges are disjoint`, shaped && disjoint, rs);
}

{
    // The page validates btnyc.json against schema/btnyc_schema.json at boot with its OWN small checker (orch_validate_ssot), which supports a subset of JSON Schema. A keyword it does not know
    // ("minimum") is an error, and a failing boot validation takes the whole page down (the first G1 gate: 17 pass->fail). The catalog and the schema have to agree in THAT checker.
    const SCHEMA = JSON.parse(fs.readFileSync(path.join(ROOT, 'schema', 'btnyc_schema.json'), 'utf8')), v = E.orch_validate_ssot(DB0, SCHEMA);
    check('0.2 the page\'s own boot checker accepts the catalog with its count ranges (no keyword it does not support)', v.valid === true, v.errors && v.errors.slice(0, 2));
}

// 1. representative: Led Bulb Upgrade ------------------------------------------------------------------------------------------------------------------------------------------------------
for (const [p, label] of [['replace 1 light bulb', '1 bulb'], ['replace one light bulb', '1 bulb'], ['replace 2 light bulbs', '2-3 bulbs'], ['replace 3 light bulbs', '2-3 bulbs'], ['replace three light bulbs', '2-3 bulbs'],
    ['replace 4 light bulbs', '4-6 bulbs'], ['replace 6 light bulbs', '4-6 bulbs'], ['replace 3 bulbs', '2-3 bulbs'], ['3 light bulbs', '2-3 bulbs']]) {
    const x = typed(E, p);
    check(`1 "${p}": Led Bulb Upgrade, "${label}" answered, nothing left to ask (${x.q})`, x.id === 'led_bulb_upgrade' && x.ans === label && !x.open.includes(KEY), x);
}

// 2. not stated ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
for (const p of ['replace light bulbs', 'replace 0 light bulbs', 'replace 7 light bulbs', 'replace 12 light bulbs', 'replace light bulbs 3']) {
    const x = typed(E, p);
    check(`2 "${p}": the question is still asked (no count the options cover was stated)`, x.id === 'led_bulb_upgrade' && x.ans === null && x.open.includes(KEY), x);
}

// 3. ambiguous -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
check('3 "replace 2 bulbs and 4 bulbs": two different counts beside the noun -> asked', (() => { const x = typed(E, 'replace 2 bulbs and 4 bulbs'); return x.ans === null && x.open.includes(KEY); })());
check('3.1 "replace 3 bulbs and 3 bulbs": the same count twice -> answered', typed(E, 'replace 3 bulbs and 3 bulbs').ans === '2-3 bulbs');
check('3.2 "replace 3 light bulbs and 2 smoke detectors": 2 is beside another noun; 3 answers the bulbs question', typed(E, 'replace 3 light bulbs and 2 smoke detectors').ans === '2-3 bulbs');

// 4. incidental numbers --------------------------------------------------------------------------------------------------------------------------------------------------------------------
for (const p of ['replace light bulb model 4500', 'replace 4500 light bulbs', 'replace bulbs in room 4', 'replace light bulbs 5 rooms', 'my 3 year old light bulb', 'replace bulb in 3rd floor',
    'replace the light bulbs in my 2 bedroom apartment', 'replace light bulbs 12 feet up', 'replace light bulb part 12', 'replace light bulb #7']) {
    const x = typed(E, p);
    check(`4 "${p}": not an item count -> nothing answered by it (${x.ans === null ? 'asked or other service' : 'ANSWERED ' + x.ans})`, x.ans === null, x);
}
{
    const tv = typed(E, 'mount 65 inch tv on wall');
    check('4.1 "mount 65 inch tv on wall": the TV size is not a count (qty 1, nothing answered, the service is unchanged)', tv.id === 'flatscreen_mounting_standard' && tv.ans === null && tv.units === 1, tv);
}
check('4.2 a count beside a dimension still answers: "replace 3 light bulbs 12 feet up" -> 2-3 bulbs (the 12 is a height)', typed(E, 'replace 3 light bulbs 12 feet up').ans === '2-3 bulbs');

// 5. price ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
    let n = 0, bad = [];
    for (const { s, step } of family) {
        const cat = s.ui_taxonomy.category_id, key = 'item_count_template::' + step.params.item_noun;
        const noun = step.params.item_noun.split('/')[0];
        for (const o of step.params.client_response) {
            const tap = (() => { const c = E.collectBookingContext_catalog(s, cat); c.answers = { [key]: o.label }; const r = E.executeWorkflow(c, E.DB); const q = r.quote; return q.laborEstimate + '/' + q.totalMin + '/' + q.checkoutStateKey; })();
            const c = E.collectBookingContext_catalog(s, cat); c.answers = {}; c.statedCounts = E.extractStatedCounts(o.count_range.min + ' ' + noun);
            const r = E.executeWorkflow(c, E.DB), q = r.quote, got = q.laborEstimate + '/' + q.totalMin + '/' + q.checkoutStateKey;
            n++;
            if (!(r.answers[key] === o.label && got === tap && r.quantity && r.quantity.units === 1)) bad.push({ s: s.id, o: o.label, tap, got, ans: r.answers[key], units: r.quantity && r.quantity.units });
        }
    }
    check(`5 every service x every count answer (${n}): the typed count quotes exactly what tapping that answer quotes, and prices one unit (no double count)`, bad.length === 0, bad.slice(0, 3));
}
for (const [withN, without] of [['replace 3 light bulbs', 'replace light bulbs'], ['replace 6 light bulbs', 'replace light bulbs'], ['install 2 dimmer switches', 'install dimmer switches'], ['fix 4 cabinet doors', 'fix cabinet doors'], ['seal 3 windows', 'seal windows']]) {
    const a = typed(E, withN), b = typed(E, without);
    check(`5.1 "${withN}" quotes what "${without}" quotes (${a.q}): answering the question did not move the price`, a.id === b.id && a.q === b.q && a.units === b.units, { a, b });
}

// 6. the family -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
    let n = 0, bad = [];
    for (const { s, step } of family) {
        const cat = s.ui_taxonomy.category_id, key = 'item_count_template::' + step.params.item_noun;
        const noun = step.params.item_noun.split('/').pop();
        const os = step.params.client_response, last = os.map(o => o.count_range).reduce((m, r) => Math.max(m, r.max === undefined ? r.min : r.max), 0);
        const open = s.id; // the highest finite count past an open-ended last range still lands on it
        for (const o of os) for (const count of new Set([o.count_range.min, o.count_range.max === undefined ? o.count_range.min + 5 : o.count_range.max])) {
            const c = E.collectBookingContext_catalog(s, cat); c.answers = {}; c.statedCounts = E.extractStatedCounts(count + ' ' + noun);
            const r = E.executeWorkflow(c, E.DB); n++;
            if (r.answers[key] !== o.label) bad.push({ s: open, count, want: o.label, got: r.answers[key] });
        }
        const lastR = os.map(o => o.count_range).find(r => r.max === undefined);
        if (!lastR) { // a closed last range: one past it is not covered -> asked
            const c = E.collectBookingContext_catalog(s, cat); c.answers = {}; c.statedCounts = E.extractStatedCounts((last + 1) + ' ' + noun);
            const r = E.executeWorkflow(c, E.DB); n++;
            if (r.answers[key] !== undefined) bad.push({ s: open, count: last + 1, want: 'asked', got: r.answers[key] });
        }
    }
    check(`6 the family (${n} counts across 18 services): each count lands on the option whose authored range contains it; a count no range covers is asked`, bad.length === 0, bad.slice(0, 4));
}
for (const [p, id, label] of [['install 2 dimmer switches', 'dimmer_switch_install', '2 switches'], ['install 5 dimmer switches', 'dimmer_switch_install', '4 or more switches (specify exact count in notes)'], ['fix 4 cabinet doors', 'cabinet_door_or_drawer_adjustment', '4-8 items'],
    ['fix 12 cabinet doors', 'cabinet_door_or_drawer_adjustment', '10 or more items (specify exact count in notes)'], ['seal 5 windows', 'window_draft_sealing', '5 or more windows (specify exact count in notes)']]) {
    const x = typed(E, p);
    check(`6.1 "${p}" -> ${id}, "${label}"`, x.id === id && x.ans === label, x);
}

// 7. the customer's own answer is not replaced -----------------------------------------------------------------------------------------------------------------------------------------------
{
    const c = E.collectBookingContext_freeText('replace 3 light bulbs'); c.answers = { [KEY]: '1 bulb' };
    const r = E.executeWorkflow(Object.assign({}, c, { tagsAffirmed: true }), E.DB);
    check('7 a count answer the customer already gave stays ("1 bulb" is not replaced by the typed 3)', r.answers[KEY] === '1 bulb', r.answers);
}

// 8. non-vacuity ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const bulbs = db => countSteps(db).filter(x => x.s.id === 'led_bulb_upgrade')[0].step.params.client_response;
{
    const db = JSON.parse(JSON.stringify(DB0)); bulbs(db).forEach(o => delete o.count_range);
    const P = load(db), x = typed(P, 'replace 3 light bulbs');
    check('8 without the authored ranges the typed count answers nothing (the data is what answers, not a guess)', x.ans === null && x.open.includes(KEY), x);
}
{
    const db = JSON.parse(JSON.stringify(DB0)); const os = bulbs(db); os[2].count_range = { min: 3, max: 6 };   // overlaps "2-3 bulbs" at 3
    const P = load(db);
    check('8.1 two overlapping ranges: the count they share answers nothing (ask, never guess); a count only one covers still answers', typed(P, 'replace 3 light bulbs').ans === null && typed(P, 'replace 5 light bulbs').ans === '4-6 bulbs', { three: typed(P, 'replace 3 light bulbs').ans, five: typed(P, 'replace 5 light bulbs').ans });
}
{
    const db = JSON.parse(JSON.stringify(DB0)); bulbs(db).forEach((o, i) => { o.label = 'Option ' + (i + 1); });
    const P = load(db), x = typed(P, 'replace 3 light bulbs'), y = typed(P, 'replace 5 light bulbs');
    check('8.2 with every label renamed the answer still follows the range ("Option 2" for 3, "Option 3" for 5): the label is never parsed', x.ans === 'Option 2' && y.ans === 'Option 3', { x: x.ans, y: y.ans });
}
{
    const db = JSON.parse(JSON.stringify(DB0)); bulbs(db)[1].count_range = { min: 2, max: 2 };   // 3 is now in no range
    const P = load(db);
    check('8.3 the range, not the label, decides: "2-3 bulbs" re-authored as exactly 2 leaves 3 unanswered', typed(P, 'replace 3 light bulbs').ans === null && typed(P, 'replace 2 light bulbs').ans === '2-3 bulbs');
}

finish();
