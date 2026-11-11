#!/usr/bin/env node
/**
 * verify_composite_count_answers_price.js -- T198 (I1): a count band the customer picked is priced, whatever key its answer is stored under.
 *
 * A step with params.item_noun ("light bulbs", "walls") stores its answer under the key _resolveIntakeChain mints for it, "item_count_template::light bulbs". That key is not a key of
 * intake_modules, and the three places that turn an answer into a price (the formula-trigger loop and the fee loop of computeUnifiedQuote, and the item_count_overflow formula) read
 * intake_modules / the step by the stored key: they found nothing, so the band's authored fee, minutes and overflow formula were never priced for eighteen services (LED bulbs, plaster
 * and wall-hole repair, windows, switches, ...). The ratchet and golden master answered under the PLAIN key, so nothing saw it.
 *
 * The expected prices below are NOT read from the engine. They are the governing contract written out from the data:
 *   price = the service's flat base_price
 *         + for each per-unit answer that adds minutes, the minutes priced at global_rules.pricing_engines.flat_rate.time_pricing (T182: rate_per_hour, rounded to round_to dollars)
 *         + a per-visit fee at its own fee (it is a visit, not work), + a per-unit fee that authors no minutes at its fee.
 *   the open-ended top band, with an exact count: the band's own price plus the overflow rate's minutes for each unit past the formula's anchor (priced_formulas, T182).
 * and, for the wall family, the Operator's rule #80 ("n walls cost n x the base price") and the T154/T182 LED bands, written as literal dollars at the foot of the file.
 *   1. BUILDER / CART   every band of every affected service, answered under the key the chain mints, through computeQuoteFromState: the price, and the sentence the customer reads.
 *   2. CATALOG TAP      the same bands tapped on the card (orch_apply_answer): the same price.
 *   3. TYPED            "<service> <n> <noun>" answers the band through #249 and now prices it.
 *   4. OVERFLOW         the top band with an exact count; no quantity is multiplied twice (units 1).
 *   5. SHAPE            price never falls as the count rises; a band and its plain-key spelling price the same.
 *   6. LITERAL          LED $20/$40/$50, plaster $80/$160/$240/$320/$400, wall hole $70/$140/$210/$280/$350, with the arithmetic.
 *   7. NON-VACUITY      plant the original lookup (intake_modules by the stored key): checks 1, 2 and 6 fail.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..');
const { check, finish } = require('./_shared.js');
const { engine } = require('./_engine.js');
const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
function load(patch) {
    const sb = { DB, SERVICE_DATA: DB, window: { DB }, console: { log() {}, warn() {}, error() {}, info() {}, debug() {} } };
    sb.global = sb; vm.createContext(sb);
    let wrapper = engine().wrapper; if (patch) { const w2 = patch(wrapper); if (w2 === wrapper) throw new Error('the planted change did not apply'); wrapper = w2; }
    vm.runInContext(wrapper, sb);
    if (typeof sb.initNlpSets === 'function') { sb.initNlpSets(); if (typeof sb.refreshNlpPreviewBindings === 'function') sb.refreshNlpPreviewBindings(); }
    return sb;
}
const MODS = DB.global_rules.modifiers, TP = DB.global_rules.pricing_engines.flat_rate.time_pricing, FML = DB.pricing_formulas.item_count_overflow_formula;
const roundTo = (x) => Math.round(x / TP.round_to) * TP.round_to;
const timeDollars = (min) => roundTo(min * TP.rate_per_hour / 60);

// the affected services, from the authored chain (not from a list written here)
const affected = [];
for (const s of DB.services) for (const st of s.intake_chain || []) {
    if (st.module === 'item_count_template' && st.params && st.params.item_noun) {
        const bands = st.params.client_response || DB.intake_modules.item_count_template.client_response;
        affected.push({ svc: s, key: 'item_count_template::' + st.params.item_noun, noun: st.params.item_noun, bands });
    }
}
// the contract, from the data
function expected(a, band, exactCount) {
    const base = a.svc.financial_engine.base_price;
    const m = band.modifier_ref ? MODS[band.modifier_ref] : null;
    let fee = 0, min = 0;
    if (m) {
        if (m.scope === 'per_visit') fee += m.fee || 0;
        else if ((m.minutes || 0) > 0) min += m.minutes; else fee += m.fee || 0;
    }
    if (band.formula_override === 'item_count_overflow_formula' && exactCount != null) {
        const cfg = FML.anchor_and_overflow_ref_by_service[a.svc.id], rate = MODS[cfg.overflow_rate_ref];
        if (exactCount > cfg.anchor) min += rate.minutes * (exactCount - cfg.anchor);
    }
    return base + fee + (min ? timeDollars(min) : 0);
}

const E = load();
check(`0 the affected services are found from the authored chains (${affected.length}, the eighteen the golden master and the fee table name)`, affected.length >= 18, affected.map(a => a.svc.id));

const stateFor = (a, label, extra) => ({ qty: 1, _svc: a.svc, intent: { key: a.svc.id, category: a.svc.ui_taxonomy.category_id }, stype: 'Repair', detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: [],
    answers: Object.assign({ [a.key]: label }, extra || {}), _tagSynthesizedModules: {}, _tagsAffirmed: true });
function builderPrice(sb, a, label, extra) { const q = sb.computeQuoteFromState(stateFor(a, label, extra)); return { labor: q.laborCalc, say: sb.resolvePriceStatement(q, a.svc).display, state: q.checkoutStateKey, q }; }

// 1. builder / cart path ---------------------------------------------------------------------------------------------------------------------------------------------------------------
function sweep(sb) {
    const bad = []; let n = 0;
    for (const a of affected) for (const b of a.bands) {
        n++; const want = expected(a, b, null), got = builderPrice(sb, a, b.label);
        if (got.labor !== want || !got.say.endsWith('$' + want)) bad.push(`${a.svc.id} | ${b.label}: want $${want}, got $${got.labor} ("${got.say}")`);
    }
    return { n, bad };
}
{
    const r = sweep(E);
    check(`1 builder / cart: every band of every affected service prices the contract, and the sentence the customer reads states it (${r.n} bands)`, r.bad.length === 0, r.bad.slice(0, 6));
}

// 2. catalog tap -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
function tapSweep(sb) {
    const bad = []; let n = 0;
    for (const a of affected) {
        const ctx = sb.collectBookingContext_catalog(a.svc, a.svc.ui_taxonomy.category_id); ctx.answers = {};
        const r0 = sb.executeWorkflow(ctx, sb.DB);
        for (const b of a.bands) {
            n++; const r1 = sb.orch_apply_answer(r0, a.key, b.label, sb.DB), got = r1.quote && r1.quote.laborEstimate, want = expected(a, b, null);
            if (got !== want) bad.push(`${a.svc.id} | ${b.label}: want $${want}, got $${got}`);
        }
    }
    return { n, bad };
}
{
    const r = tapSweep(E);
    check(`2 catalog tap: tapping each band on the card prices the contract (${r.n} taps)`, r.bad.length === 0, r.bad.slice(0, 6));
}

// 3. typed -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
    const bad = [], routed = []; let n = 0;
    for (const a of affected) { let tagOffset = null;   // a service's own words can earn a tag with a fee of its own ("in high ceilings" +$35); it is the same for every count, so the first phrase measures it and the bands are compared net of it
      for (const b of a.bands) {
        const cr = b.count_range; if (!cr || b.formula_override) continue;
        const phrase = `${a.svc.ui_taxonomy.display_name.toLowerCase()} ${cr.min} ${a.noun}`;
        const c = E.collectBookingContext_freeText(phrase), r = E.executeWorkflow(Object.assign({}, c, { tagsAffirmed: true }), E.DB);
        if (!r.entity || r.entity.id !== a.svc.id) continue;
        n++; routed.push(a.svc.id); const got = r.quote && r.quote.laborEstimate;
        if (tagOffset === null) tagOffset = got - expected(a, b, null);
        const want = expected(a, b, null) + tagOffset;
        if (got !== want || (r.quantity && r.quantity.units) !== 1) bad.push(`"${phrase}": want $${want} x1 unit, got $${got} x${r.quantity && r.quantity.units}`);
      }
      if (tagOffset !== null && tagOffset !== 0 && a.svc.id !== 'high_ceiling_bulb_replacement') bad.push(`${a.svc.id}: unexpected tag offset ${tagOffset}`);
    }
    check(`3 typed: "<service> <n> <things>" answers the band and prices it, one unit (${n} phrases routed to their service)`, n >= 30 && bad.length === 0, bad.slice(0, 6));
}

// 4. overflow, and no double count -----------------------------------------------------------------------------------------------------------------------------------------------------
{
    const bad = []; let n = 0;
    for (const a of affected) {
        const top = a.bands.find(b => b.formula_override === 'item_count_overflow_formula'); if (!top) continue;
        const cfg = FML.anchor_and_overflow_ref_by_service[a.svc.id];
        for (const cnt of [cfg.anchor, cfg.anchor + 1, cfg.anchor + 3, cfg.anchor + 10]) {
            n++; const want = expected(a, top, cnt), got = builderPrice(E, a, top.label, { __exact_count: cnt }).labor;
            if (got !== want) bad.push(`${a.svc.id} | ${top.label} | ${cnt}: want $${want}, got $${got}`);
        }
        const flat = builderPrice(E, a, top.label).labor, below = a.bands.filter(b => b !== top && b.modifier_ref).map(b => builderPrice(E, a, b.label).labor);
        if (below.length && flat < Math.max(...below)) bad.push(`${a.svc.id}: "${top.label}" $${flat} is below the band under it $${Math.max(...below)}`);
    }
    check(`4 overflow: the open-ended band with an exact count prices band + overflow minutes, never below the band under it (${n} counts)`, bad.length === 0, bad.slice(0, 6));
    const st = stateFor(affected.find(a => a.svc.id === 'plaster_wall_repair'), '3 walls'); st.qty = 3;
    const once = E.computeQuoteFromState(stateFor(affected.find(a => a.svc.id === 'plaster_wall_repair'), '3 walls')).laborCalc, with3 = E.computeQuoteFromState(st).laborCalc;
    check('4.1 no double count: a session quantity of 3 does not multiply the service that owns the walls question (3 walls = $240, not $720)', once === 240 && with3 === 240, { once, with3 });
}

// 5. shape ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
    const bad = [];
    for (const a of affected) {
        let prev = -1;
        for (const b of a.bands) { const p = builderPrice(E, a, b.label).labor; if (p < prev) bad.push(`${a.svc.id}: "${b.label}" $${p} < $${prev}`); prev = p; }
    }
    check('5 the price never falls as the count band rises (R-DOMAIN-QTYBANDS: a bigger job is not cheaper)', bad.length === 0, bad.slice(0, 6));
    // the plain-key spelling (the ratchet's) and the minted key price the same band the same
    const diff = [];
    for (const a of affected) for (const b of a.bands) {
        const x = builderPrice(E, a, b.label).labor, st = stateFor(a, b.label); st.answers = { item_count_template: b.label };
        const y = E.computeQuoteFromState(st).laborCalc; if (x !== y) diff.push(`${a.svc.id} | ${b.label}: ${x} vs plain ${y}`);
    }
    check('5.1 the minted key and the plain key price a band identically (one contract, two spellings)', diff.length === 0, diff.slice(0, 6));
}

// 6. the literal contract -----------------------------------------------------------------------------------------------------------------------------------------------------------
{
    const lit = {
        // T154 ruled LED's bands move the price; T182 (later, governing) prices an answer's minutes: 15 min = $17.50 -> $20 (round to $5), 24 min = $28 -> $30. Base $20.
        led_bulb_upgrade: [20, 40, 50],
        // Operator rule #80, "n walls cost n x the base price": base $80 -> $80, $160, $240, $320, and 7... the open band without an exact count is the 5-wall price $400.
        plaster_wall_repair: [80, 160, 240, 320, 400],
        // base $70 -> n x $70; 60 min = $70 per extra wall.
        wall_hole_or_crack_repair: [70, 140, 210, 280, 350],
    };
    const bad = [];
    for (const [id, prices] of Object.entries(lit)) {
        const a = affected.find(x => x.svc.id === id);
        a.bands.forEach((b, i) => { const got = builderPrice(E, a, b.label).labor; if (got !== prices[i]) bad.push(`${id} | ${b.label}: want $${prices[i]}, got $${got}`); });
    }
    check('6 LED $20/$40/$50; plaster $80/$160/$240/$320/$400; wall hole $70/$140/$210/$280/$350', bad.length === 0, bad);
    const w3 = builderPrice(E, affected.find(x => x.svc.id === 'plaster_wall_repair'), '3 walls');
    check('6.1 three plaster walls: a project estimate that says "From $240" (added time 137 min is past the 30-minute project line)', w3.state === 'project_based' && w3.say === 'From $240', w3);
    const l1 = builderPrice(E, affected.find(x => x.svc.id === 'led_bulb_upgrade'), '1 bulb');
    check('6.2 one bulb is still a plain flat price', l1.labor === 20 && l1.state !== 'project_based', l1);
}

// 7. non-vacuity ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
    const D = load(w => w.replace('const mod = resolveAnsweredModule(svc, moduleKey);\n                    if (!mod) continue;', 'const mod = DB.intake_modules?.[moduleKey];\n                    if (!mod) continue;')
        .replace('const mod = resolveAnsweredModule(svc, moduleKey);\n                    const chosen', 'const mod = DB.intake_modules?.[moduleKey];\n                    const chosen'));
    const s1 = sweep(D), s2 = tapSweep(D);
    check(`7 planted original lookup: the builder sweep fails ${s1.bad.length} of ${s1.n} bands`, s1.bad.length > 20, s1.bad.slice(0, 3));
    check(`7.1 planted original lookup: the tap sweep fails ${s2.bad.length} of ${s2.n} bands`, s2.bad.length > 20, s2.bad.slice(0, 3));
    const led = affected.find(x => x.svc.id === 'led_bulb_upgrade');
    check('7.2 planted original lookup: LED "2-3 bulbs" prices $20, not $40', builderPrice(D, led, '2-3 bulbs').labor === 20);
    const P = load(w => w.replace("const _bands = step?.params?.client_response || (String(moduleKey).indexOf('::') >= 0 ? resolveAnsweredModule(svc, moduleKey)?.client_response : null);", 'const _bands = step?.params?.client_response;'));
    const pl = affected.find(x => x.svc.id === 'plaster_wall_repair');
    check('7.3 planted: without the overflow formula\'s band lookup "5 or more walls" falls to the 1-wall base $80, under the 4-wall $320', builderPrice(P, pl, '5 or more walls (specify exact count in notes)').labor === 80 && builderPrice(E, pl, '5 or more walls (specify exact count in notes)').labor === 400);
}
finish('verify_composite_count_answers_price');
