#!/usr/bin/env node
/**
 * verify_time_model.js
 *
 * @enforces R-COMPLEX-VOLUME
 * @enforces R-PRICE-SCOPE
 * @enforces R-PRICE-PRECISION
 *
 * The time model (PENDING_DECISIONS #229, #234; the Operator's direction of 2026-10-16 23:34 NY, confirmed 2026-10-17 02:30 NY):
 *
 *   On a flat-rate service the card shows the authored baseline. The customer's answers do not add fees, they add TIME, and the time prices the job:
 *     flat price  = baseline + the added minutes at global_rules.pricing_engines.flat_rate.time_pricing.rate_per_hour, rounded to round_to dollars (+ per-visit fees, which are fees)
 *     when the added minutes reach project_after_minutes the quote is a project estimate ("From $X", state project_based, source added_time) and shows its time
 *     the skill tier is never read from minutes (R-COMPLEX-VOLUME); an hourly service keeps the rate of the tier it declares
 *
 * Every number the engine uses is read from the SSOT, so this test proves it by COUNTERFACTUAL: it changes the SSOT's rate, step and threshold in a copy of the catalog and requires the
 * quotes to move with them. Expected prices are restated here as plain arithmetic ($70/h, $5 steps), not asked of the engine.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { engine } = require('./_engine.js');

const REPO_ROOT = path.dirname(__dirname);
const BASE_DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(label, condition, detail) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}${detail !== undefined ? '\n      ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`); }
}

// A fresh engine over a catalog. The catalog is deep-copied by the caller when a test needs a counterfactual.
function load(db) {
    const sb = { DB: db, SERVICE_DATA: db, window: { DB: db }, console };
    sb.global = sb;
    vm.createContext(sb);
    vm.runInContext(engine().wrapper, sb, { filename: 'engine' });
    return sb;
}
const clone = o => JSON.parse(JSON.stringify(o));
const svcOf = (db, id) => db.services.find(s => s.id === id);
const quote = (sb, svc, answers, qty = 1) => sb.computeUnifiedQuote({ svc, activeTagIds: [], answers: answers || {}, qty });

const TP = BASE_DB.global_rules.pricing_engines.flat_rate.time_pricing;
const MODS = BASE_DB.global_rules.modifiers;
const real = load(BASE_DB);

console.log('=== 1. The time price is authored in the SSOT, once ===');
{
    check('flat_rate.time_pricing carries the rate, the step, the project threshold and the priced formulas', TP && TP.rate_per_hour === 70 && TP.round_to === 5 && TP.project_after_minutes === 30 && Array.isArray(TP.priced_formulas) && TP.priced_formulas.length >= 1, TP);
    check('the flat-rate formula components are baseline + priced time + per-visit fees (no "extra fees" term)', JSON.stringify(BASE_DB.global_rules.pricing_engines.flat_rate.formula_components) === JSON.stringify(['base_price', 'priced_time', 'per_visit_fees']));
    check('the prehung interior door baseline is $250 (the Operator, 2026-10-17 02:30 NY)', svcOf(BASE_DB, 'prehung_interior_door_install').financial_engine.base_price === 250);
}

console.log('\n=== 2. Rounding and the baseline: pinned arithmetic at $70/h, $5 steps ===');
{
    // A flat-rate service, one per-unit answer: 45 min is the Operator's own example of an answer that adds time and carries no fee.
    const svc = svcOf(BASE_DB, 'prehung_interior_door_install');
    const none = quote(real, svc, { existing_frame: 'Yes' });
    check('with no answer that adds time, the quote is exactly the authored baseline, priced by time (0 added minutes, $0 of time)', none.laborEstimate === 250 && none.timePriced === true && none.pricedMin === 0 && none.timeFee === 0, { labor: none.laborEstimate, tp: none.timePriced, pm: none.pricedMin, tf: none.timeFee });
    const proc = quote(real, svc, { existing_frame: 'Yes', client_supplying_door: 'No, I need you to procure it' });
    check('an answer with minutes and NO fee is priced: 45 min x $70/h = $52.50, rounded to $55 -> $305', proc.laborEstimate === 305 && proc.timeFee === 55 && proc.pricedMin === 45, { labor: proc.laborEstimate, tf: proc.timeFee, pm: proc.pricedMin });
    check('the 45 added minutes reach the project threshold, and the door (already a project estimate by its own authoring) stays one: the switch only ever makes a state MORE restrictive, so its source stays the service\'s own', proc.timeSwitched === true && proc.checkoutStateKey === 'project_based' && proc.checkoutStateSource !== 'added_time', { sw: proc.timeSwitched, key: proc.checkoutStateKey, src: proc.checkoutStateSource });
    check('...and a service that is a project by its own authoring keeps its time hidden (the display rule of verify_project_based_hide_time.js is untouched)', proc.hideTime === true, proc.hideTime);

    // The rounding table, on a copy of the catalog where one flat-rate per-unit modifier takes each minute value.
    const flatSvcId = 'flatscreen_mounting_standard', ansKey = 'wall_type', ansLabel = 'Brick or concrete', modKey = 'wall_type_brick_or_concrete';
    const priced = (minutes) => {
        const db = clone(BASE_DB); db.global_rules.modifiers[modKey].minutes = minutes; db.global_rules.modifiers[modKey].fee = 0;
        const sb = load(db); const s = svcOf(db, flatSvcId);
        const base = quote(sb, s, {}).laborEstimate, q = quote(sb, s, { [ansKey]: ansLabel });
        return { delta: q.laborEstimate - base, q };
    };
    const TABLE = [[5, 5], [10, 10], [17, 20], [20, 25], [25, 30], [29, 35], [30, 35], [45, 55], [60, 70], [95, 110], [120, 140]]; // minutes -> dollars at $70/h, to the nearest $5
    const bad = TABLE.filter(([m, d]) => priced(m).delta !== d).map(([m, d]) => `${m} min: want $${d}, got $${priced(m).delta}`);
    check(`added minutes price at $70/h and round to the nearest $5 (${TABLE.length} pinned points: 17 min = $20, 20 = $25, 45 = $55, 95 = $110)`, bad.length === 0, bad);
    const zero = priced(0);
    check('a per-unit answer with no minutes and no fee adds nothing', zero.delta === 0, zero.delta);
}

console.log('\n=== 3. The project threshold: added time of project_after_minutes or more is a project estimate ===');
{
    const flatSvcId = 'flatscreen_mounting_standard', ansKey = 'wall_type', ansLabel = 'Brick or concrete', modKey = 'wall_type_brick_or_concrete';
    const run = (minutes, tp) => {
        const db = clone(BASE_DB); db.global_rules.modifiers[modKey].minutes = minutes; db.global_rules.modifiers[modKey].fee = 0;
        if (tp) Object.assign(db.global_rules.pricing_engines.flat_rate.time_pricing, tp);
        const sb = load(db); return quote(sb, svcOf(db, flatSvcId), { [ansKey]: ansLabel });
    };
    const a = run(29), b = run(30), c = run(31);
    check('29 added minutes stay a flat price; 30 and 31 make it a project estimate (the boundary is "reaches", not "exceeds")', a.timeSwitched === false && b.timeSwitched === true && c.timeSwitched === true, { 29: a.timeSwitched, 30: b.timeSwitched, 31: c.timeSwitched });
    check('...and the switch carries its source, so the card can say why it is an estimate', b.checkoutStateKey === 'project_based' && b.checkoutStateSource === 'added_time' && a.checkoutStateSource !== 'added_time', { a: a.checkoutStateSource, b: b.checkoutStateSource });
    const moved = run(45, { project_after_minutes: 60 }), at60 = run(60, { project_after_minutes: 60 });
    check('COUNTERFACTUAL: the threshold is read from the SSOT (raise it to 60 and 45 minutes stay flat, 60 switches)', moved.timeSwitched === false && at60.timeSwitched === true, { 45: moved.timeSwitched, 60: at60.timeSwitched });
    const csFlat = BASE_DB.checkout_states.standard_flat_rate, csProj = BASE_DB.checkout_states.project_based;
    check('a quote that became a project estimate BECAUSE of added time shows that time, though the project_based state hides time by default; the time is the reason for the estimate', csProj.hide_time === true && b.hideTime === false && a.hideTime === !!csFlat.hide_time, { flat: a.hideTime, switched: b.hideTime, projectStateHides: csProj.hide_time });
}

console.log('\n=== 4. Every number is read from the SSOT (counterfactuals) ===');
{
    const flatSvcId = 'flatscreen_mounting_standard', ansKey = 'wall_type', ansLabel = 'Brick or concrete', modKey = 'wall_type_brick_or_concrete';
    const run = (tp) => {
        const db = clone(BASE_DB); db.global_rules.modifiers[modKey].minutes = 60; db.global_rules.modifiers[modKey].fee = 0;
        Object.assign(db.global_rules.pricing_engines.flat_rate.time_pricing, tp);
        const sb = load(db), s = svcOf(db, flatSvcId); return quote(sb, s, { [ansKey]: ansLabel }).laborEstimate - quote(sb, s, {}).laborEstimate;
    };
    check('the rate: 60 minutes at $70/h is $70; at $100/h it is $100 (the engine does not carry its own rate)', run({}) === 70 && run({ rate_per_hour: 100 }) === 100, { at70: run({}), at100: run({ rate_per_hour: 100 }) });
    check('the step: 17 minutes round to $20 at a $5 step and to $20 at $10, but 20 minutes ($23.33) round to $25 at $5 and $20 at $10', (() => { const db = clone(BASE_DB); db.global_rules.modifiers[modKey].minutes = 20; db.global_rules.modifiers[modKey].fee = 0; db.global_rules.pricing_engines.flat_rate.time_pricing.round_to = 10; const sb = load(db), s = svcOf(db, flatSvcId); return quote(sb, s, { [ansKey]: ansLabel }).laborEstimate - quote(sb, s, {}).laborEstimate === 20; })());
    const noCfg = (() => { const db = clone(BASE_DB); delete db.global_rules.pricing_engines.flat_rate.time_pricing; db.global_rules.modifiers[modKey].minutes = 60; const sb = load(db), s = svcOf(db, flatSvcId); return quote(sb, s, { [ansKey]: ansLabel }); })();
    check('COUNTERFACTUAL: without a time_pricing block the engine does not invent one (the service is not time-priced; its answers keep their fees)', noCfg.timePriced === false && noCfg.timeFee === 0, { tp: noCfg.timePriced, tf: noCfg.timeFee });
}

console.log('\n=== 5. Per-visit modifiers keep their fee; per-unit time scales with the quantity ===');
{
    const svc = svcOf(BASE_DB, 'prehung_interior_door_install');
    const withVisit = quote(real, svc, { existing_frame: 'Yes', disposal_request: 'Yes, please haul it away', urgency: 'Urgent - today or tomorrow' });
    check('per-visit answers (disposal $25, urgency $50) are fees: added once, not time-priced, so 0 added minutes and the quote is $250 + $75', withVisit.laborEstimate === 325 && withVisit.pricedMin === 0 && withVisit.timeFee === 0 && withVisit.perVisitFee === 75, { labor: withVisit.laborEstimate, pm: withVisit.pricedMin, tf: withVisit.timeFee, pv: withVisit.perVisitFee });
    // Quantity: a batched flat service (no count question of its own) multiplies baseline and per-unit time; the per-visit fee still counts once.
    const batched = BASE_DB.services.find(s => s.financial_engine && s.financial_engine.type === 'flat_rate' && s.financial_engine.base_price > 0 && s.per_unit_answers_vary !== true && !real.entityHasOwnQtyQuestion(s)
        && quote(real, s, {}, 3).laborEstimate === 3 * quote(real, s, {}, 1).laborEstimate);
    check('a batched flat-rate service has a baseline that scales with the quantity (the fixture for the next checks exists)', !!batched);
    if (batched) {
        const db = clone(BASE_DB), s = svcOf(db, batched.id);
        // give this service's first answer-bearing per-unit modifier 20 minutes and no fee, on a copy
        let target = null;
        for (const st of s.intake_chain || []) {
            const opts = (st.params && st.params.client_response) || (db.intake_modules && db.intake_modules[st.module] && db.intake_modules[st.module].client_response) || [];
            const o = opts.find(x => x.modifier_ref && db.global_rules.modifiers[x.modifier_ref] && db.global_rules.modifiers[x.modifier_ref].scope === 'per_unit');
            if (o) { target = { module: st.module, label: o.label, ref: o.modifier_ref }; break; }
        }
        if (!target) check('the batched fixture has a per-unit answer to price (skipped: none authored)', true);
        else {
            db.global_rules.modifiers[target.ref].minutes = 20; db.global_rules.modifiers[target.ref].fee = 0;
            const sb = load(db);
            const d1 = quote(sb, s, { [target.module]: target.label }, 1).laborEstimate - quote(sb, s, {}, 1).laborEstimate;
            const d3 = quote(sb, s, { [target.module]: target.label }, 3).laborEstimate - quote(sb, s, {}, 3).laborEstimate;
            check(`per-unit time scales with the quantity: 20 min is $25 for one unit and 60 min = $70 for three (${batched.id})`, d1 === 25 && d3 === 70, { d1, d3 });
        }
    }
}

console.log('\n=== 6. The lines that explain the price add up to the price ===');
{
    const svc = svcOf(BASE_DB, 'flatscreen_mounting_standard');
    const answers = { wall_type: 'Brick or concrete', weight: '20 to 50 lbs (moderate)' };
    const q = quote(real, svc, answers);
    const lines = (q.feeBreakdown || []).filter(l => l.timePriced);
    const sum = lines.reduce((a, l) => a + l.fee, 0);
    check('the time-priced lines carry whole-dollar shares that add up to the time fee exactly (largest-remainder split)', lines.length >= 2 && sum === q.timeFee && lines.every(l => Number.isInteger(l.fee)), { lines: lines.map(l => [l.moduleKey, l.fee, l.minutes]), timeFee: q.timeFee });
    check('...and each line states the minutes that priced it', lines.every(l => l.minutes > 0), lines.map(l => l.minutes));
    check('baseline + time fee + per-visit fees = the labor estimate (nothing else enters the flat price)', q.laborEstimate === svc.financial_engine.base_price + q.timeFee + (q.perVisitFee || 0), { labor: q.laborEstimate, base: svc.financial_engine.base_price, tf: q.timeFee, pv: q.perVisitFee });
}

console.log('\n=== 7. Counterfactual services: what the time model must NOT touch ===');
{
    // (a) an hourly service is not time-priced: it keeps its tier rate x its minutes.
    const hourly = BASE_DB.services.find(s => s.financial_engine && s.financial_engine.type === 'hourly');
    const qh = hourly && quote(real, hourly, {});
    check('an hourly service is not time-priced (it is already priced by its time at its tier rate)', !!qh && qh.timePriced === false && qh.timeFee === 0, hourly && { id: hourly.id, tp: qh.timePriced });
    // (b) the skill tier never comes from minutes (R-COMPLEX-VOLUME): stretch an hourly service's minutes tenfold and the tier does not move.
    if (hourly) {
        const db = clone(BASE_DB), s = svcOf(db, hourly.id), om = s.operational_metrics;
        const sb0 = load(db), t0 = quote(sb0, s, {});
        om.expected_minutes = (om.expected_minutes || 60) * 10; if (s.default_estimates && s.default_estimates.total_minutes) { s.default_estimates.total_minutes.min *= 10; s.default_estimates.total_minutes.max *= 10; }
        const t1 = quote(load(db), s, {});
        check('R-COMPLEX-VOLUME: ten times the minutes bills ten times the time at the SAME tier and rate (the tier is declared, never read from the clock)', t1.complexityTier === t0.complexityTier && t1.tierRate === t0.tierRate && t1.totalMin > t0.totalMin, { t0: [t0.complexityTier, t0.tierRate, t0.totalMin], t1: [t1.complexityTier, t1.tierRate, t1.totalMin] });
    }
    // (c) no code reads a tier's minute band
    // code, not comments: tokenize the engine and look at identifiers and strings only
    const acorn = require('acorn'), codeHits = [];
    for (const t of acorn.tokenizer(engine().wrapper, { ecmaVersion: 'latest', allowReturnOutsideFunction: true })) if ((t.type.label === 'name' || t.type.label === 'string') && /^(min_minutes|max_minutes)$/.test(String(t.value))) codeHits.push(t.value + '@' + t.start);
    check('R-COMPLEX-VOLUME: no engine code reads a tier\'s min_minutes / max_minutes (the bands name no tier)', codeHits.length === 0, codeHits.slice(0, 5));
    check('resolveSkillTier takes a declared tier and an answer override and no minutes (its arity is 2)', real.resolveSkillTier.length === 2 && real.resolveSkillTier('routine', null) === 'routine' && real.resolveSkillTier(null, null) === 'skilled' && real.resolveSkillTier('routine', 'specialized') === 'specialized' && real.resolveSkillTier('specialized', 'routine') === 'specialized', [real.resolveSkillTier.length]);
}

console.log('\n=== 8. Every priced answer has a time to price (no fee hides outside the model) ===');
{
    // A per-unit modifier reachable from a flat-rate service that carries a fee and no minutes would keep a hidden fee outside the time model. The authoring rule is: a per-unit answer that
    // costs money says how long it takes, and the time is the price. (Per-visit modifiers are fees by design and are exempt.)
    const reach = new Map();
    for (const s of BASE_DB.services) {
        if (!(s.financial_engine && s.financial_engine.type === 'flat_rate')) continue;
        for (const st of s.intake_chain || []) {
            const opts = (st.params && st.params.client_response) || (BASE_DB.intake_modules && BASE_DB.intake_modules[st.module] && BASE_DB.intake_modules[st.module].client_response) || [];
            for (const o of opts) if (o.modifier_ref) { if (!reach.has(o.modifier_ref)) reach.set(o.modifier_ref, []); reach.get(o.modifier_ref).push(s.id); }
        }
    }
    const feeOnly = [...reach.keys()].filter(ref => { const m = MODS[ref]; return m && m.scope === 'per_unit' && m.fee > 0 && !(m.minutes > 0); });
    check(`every per-unit modifier a flat-rate service can reach that carries a fee also carries minutes (${reach.size} modifiers reachable)`, feeOnly.length === 0, feeOnly.slice(0, 8).map(r => `${r} (fee $${MODS[r].fee}) <- ${[...new Set(reach.get(r))].slice(0, 2).join(', ')}`));
}

console.log(`\n[time model: answers add time, and the time prices a flat-rate job] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
