#!/usr/bin/env node
/**
 * verify_knob_pull_tiered_pricing.js -- cabinet knob / pull install is priced by graduated tiers, a visit minimum, and never less than the old flat price
 * (PENDING_DECISIONS #112, operator ruling 2026-10-07, option A).
 *
 * THE FINDING (T153). A customer with ten knobs was quoted $20, the same as a customer with one: the quantity reached the engine and the price did not
 * move. The service's own justification says it is "priced per unit by the tiered per-unit archetype".
 *
 * THE RULING. "Tiers: 1-5 knobs $20 each, 6-15 $15 each, 16+ $10 each, $95 visit minimum, using the higher of tier price vs. current flat."
 *
 * HOW THIS TEST READS IT, AND WHY. Graduated (marginal) tiers: the first five knobs are $20 each, the next ten (6th to 15th) are $15 each, every knob after the
 * fifteenth is $10. Price = max(visit minimum, tier total, the old flat price for the install type). The alternative reading (the whole order priced at the
 * tier its COUNT falls in) puts a customer with 5 knobs at $100 and a customer with 6 at $90, and one with 15 at $225 and one with 16 at $160: the price FALLS
 * as the count rises, which the Charter forbids ("The Three Components": quantity-per-unit labor "scales continuously. Never stepped. Stepping creates artificial price cliffs"; the same
 * defect is the proposed class DEFECT-NONMONOTONE-BANDS, held for the band questions by verify_quantity_question_ratchet.js C2). So this test holds the graduated
 * reading and PROVES the other reading fails it (a mutant). The tier table and the minimum live in btnyc.json (pricing_formulas.hardware_install_formula:
 * `tiers`, `visit_minimum`), so a different reading is a data edit plus this test's pinned vectors, not a code change.
 *
 * WHAT IT HOLDS.
 *   1. PINNED VECTORS (the ruling, as dollars): 1..4 knobs $95 (the minimum), 5 $100, 6 $115, 10 $175, 15 $250, 16 $260, 20 $300, 50 $600.
 *   2. PROPERTIES over 1..100 knobs, for both install types: non-decreasing (never falls as the count rises); no step larger than the highest tier rate and
 *      none smaller than the lowest (continuous, no cliff); never below the visit minimum; never below the old flat price.
 *   3. THE DATA DRIVES IT (R-SYSTEM-NODATA). In a counterfactual world with a different tier table and minimum, the engine follows; in one where the old flat
 *      price is higher than the tiers, the old flat price wins ("the higher of").
 *   4. ONE PRICE ON EVERY PATH. The card's quantity control (orch_apply_quantity) and the engine called directly give the same price at every quantity.
 *   5. NON-VACUITY. The same property checker is run on four wrong pricing functions (the old flat price; the whole-order-tier reading; tiers without the
 *      minimum; tiers that ignore the old flat price in a world where it is higher) and must fail each.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { engine } = require('./_engine.js');

const ROOT = path.dirname(__dirname);
const DB0 = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
const SERVICE_ID = 'cabinet_knob_or_pull_install';
const SWAP = 'Swapping existing hardware (same holes)';
const NEW_HOLES = 'New holes needed (measure, drill, mark)';

let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log('  ✓ ' + m); };
const bad = (m, d) => { fail++; console.log('  ✗ ' + m + (d ? '\n      ' + String(d).split('\n').join('\n      ') : '')); };
const check = (c, okMsg, badMsg, d) => (c ? ok(okMsg) : bad(badMsg || okMsg, d));

// A world = the engine loaded whole over a (possibly altered) catalog.
function world(alter) {
    const DB = JSON.parse(JSON.stringify(DB0));
    if (alter) alter(DB);
    const sb = { DB, SERVICE_DATA: DB, window: { DB }, console: { log() {}, warn() {}, error() {}, info() {} } };
    sb.global = sb;
    vm.createContext(sb);
    vm.runInContext(engine().wrapper, sb, { filename: 'engine_modules' });
    const svc = DB.services.find(s => s.id === SERVICE_ID);
    const direct = (installType, n) => sb.computeUnifiedQuote({ svc, activeTagIds: [], answers: { install_type: installType }, qty: n, formulaId: svc.pricing_engine }).laborEstimate;
    const route0 = sb.executeWorkflow(sb.collectBookingContext_catalog(svc, svc.ui_taxonomy.category_id), DB);
    const viaCard = (n) => sb.orch_apply_quantity(route0, n, DB).quote.laborEstimate;
    return { DB, sb, svc, direct, viaCard };
}

const formula = DB0.pricing_formulas.hardware_install_formula;
check(Array.isArray(formula.tiers) && formula.tiers.length >= 2 && typeof formula.visit_minimum === 'number',
    'the SSOT carries the ruling as data: hardware_install_formula.tiers and .visit_minimum',
    'the SSOT does not carry hardware_install_formula.tiers / .visit_minimum', JSON.stringify({ tiers: formula.tiers, visit_minimum: formula.visit_minimum }));

// The property checker: one function, given any price function. Returns problems.
function problemsOf(price, spec) {
    const problems = [];
    const N = 100, seq = Array.from({ length: N }, (_, i) => price(i + 1));
    for (let n = 2; n <= N; n++) if (seq[n - 1] < seq[n - 2]) problems.push(`price FALLS from $${seq[n - 2]} at ${n - 1} to $${seq[n - 1]} at ${n} (a price cliff)`);
    for (let n = 2; n <= N; n++) {
        const step = seq[n - 1] - seq[n - 2];
        if (step > spec.maxRate) problems.push(`a step of $${step} at ${n} exceeds the highest tier rate $${spec.maxRate} (a cliff)`);
    }
    for (let n = 1; n <= N; n++) if (seq[n - 1] < spec.visitMinimum) problems.push(`$${seq[n - 1]} at ${n} is under the $${spec.visitMinimum} visit minimum`);
    const flatAbove = seq.findIndex((p, i) => p < spec.oldFlat(i + 1));
    if (flatAbove >= 0) problems.push(`$${seq[flatAbove]} at ${flatAbove + 1} is under the old flat price $${spec.oldFlat(flatAbove + 1)}`);
    for (let n = spec.lastTierStart; n < N; n++) if (seq[n] - seq[n - 1] < spec.minRate && n > 5) problems.push(`the price does not scale: only +$${seq[n] - seq[n - 1]} from ${n} to ${n + 1} (lowest tier rate is $${spec.minRate})`);
    return problems;
}

const spec = (DB) => {
    const f = DB.pricing_formulas.hardware_install_formula;
    const rates = f.tiers.map(t => t.rate_per_unit);
    const oldFlatOf = (type) => (n) => { const r = type === NEW_HOLES ? f.new_holes : f.swap; return r.flat_rate + Math.max(0, n - r.included_units) * r.overflow_per_unit; };
    return { maxRate: Math.max(...rates), minRate: Math.min(...rates), visitMinimum: f.visit_minimum, oldFlatOf, lastTierStart: 20 };
};

console.log('=== 1. The ruling, as dollars (swap) ===');
const W = world();
{
    const vectors = { 1: 95, 2: 95, 3: 95, 4: 95, 5: 100, 6: 115, 10: 175, 15: 250, 16: 260, 20: 300, 50: 600 };
    for (const [n, want] of Object.entries(vectors)) {
        const got = W.direct(SWAP, Number(n));
        check(got === want, `${n} knob${n === '1' ? '' : 's'} (swap) -> $${want}`, `${n} knobs (swap) -> expected $${want}, got $${got}`);
    }
}

const HAVE_TIERS = Array.isArray(formula.tiers) && formula.tiers.length >= 2 && typeof formula.visit_minimum === 'number';
if (!HAVE_TIERS) {
    // Not a crash and not a skip: the properties below need the tier table, and without it the ruling is simply not implemented.
    bad('sections 2-5 cannot be evaluated without hardware_install_formula.tiers and .visit_minimum: the ruling is not in the data');
    console.log(`\n[Knob/pull tiered pricing] ${pass} passed, ${fail} failed (of ${pass + fail} checks)`);
    process.exit(1);
}

console.log('\n=== 2. Properties over 1..100 knobs, both install types ===');
for (const [label, type] of [['swap', SWAP], ['new holes', NEW_HOLES]]) {
    const s = spec(W.DB);
    const problems = problemsOf(n => W.direct(type, n), Object.assign({}, s, { oldFlat: s.oldFlatOf(type) }));
    check(problems.length === 0, `${label}: non-decreasing, no cliff, never under the $${s.visitMinimum} minimum, never under the old flat price, still scaling past the last tier`, `${label}: the price is wrong in ${problems.length} way(s)`, problems.slice(0, 6).join('\n'));
}

console.log('\n=== 3. The data drives it ===');
{
    const alt = world(DB => {
        const f = DB.pricing_formulas.hardware_install_formula;
        f.tiers = [{ up_to_units: 2, rate_per_unit: 50 }, { up_to_units: null, rate_per_unit: 40 }];
        f.visit_minimum = 10;
    });
    check(alt.direct(SWAP, 1) === 50 && alt.direct(SWAP, 2) === 100 && alt.direct(SWAP, 3) === 140 && alt.direct(SWAP, 10) === 420,
        'counterfactual tiers ($50 for 2, then $40; minimum $10): the engine follows the data (1 -> $50, 2 -> $100, 3 -> $140, 10 -> $420)',
        'the engine did not follow a different tier table in the data', [1, 2, 3, 10].map(n => `${n}: $${alt.direct(SWAP, n)}`).join(', '));
    const min = world(DB => { DB.pricing_formulas.hardware_install_formula.visit_minimum = 200; });
    check(min.direct(SWAP, 1) === 200 && min.direct(SWAP, 5) === 200 && min.direct(SWAP, 12) === 205,
        'counterfactual minimum ($200): 1 and 5 knobs quote the minimum, 12 knobs ($205) quote the tiers',
        'the engine did not follow a different visit minimum', [1, 5, 12].map(n => `${n}: $${min.direct(SWAP, n)}`).join(', '));
    const flat = world(DB => { const f = DB.pricing_formulas.hardware_install_formula; f.swap.flat_rate = 700; f.swap.included_units = 100; });
    check(flat.direct(SWAP, 1) === 700 && flat.direct(SWAP, 30) === 700,
        'counterfactual old flat price ($700, higher than the tiers): "the higher of" holds, no one is quoted less than the old price',
        'the old flat price did not act as a floor when it is higher than the tiers', [1, 30].map(n => `${n}: $${flat.direct(SWAP, n)}`).join(', '));
}

console.log('\n=== 4. One price on every path ===');
{
    const ns = [1, 2, 3, 5, 6, 10, 16, 40];
    const diffs = ns.filter(n => W.viaCard(n) !== W.direct(SWAP, n)).map(n => `${n}: card $${W.viaCard(n)} vs engine $${W.direct(SWAP, n)}`);
    check(diffs.length === 0, `the card's quantity control and the engine give the same price at ${ns.join(', ')} knobs`, 'the card path and the engine disagree', diffs.join('\n'));
    check(W.viaCard(10) > W.viaCard(1), 'the card shows a higher price for ten knobs than for one (the T153 finding: it was $20 for both)', `the card still quotes $${W.viaCard(1)} for one and $${W.viaCard(10)} for ten`);
}

console.log('\n=== 5. The property checker can fail (non-vacuity) ===');
{
    const s = spec(W.DB);
    const f = W.DB.pricing_formulas.hardware_install_formula;
    const tierTotal = (n) => { let t = 0, prev = 0; for (const x of f.tiers) { const cap = x.up_to_units == null ? Infinity : x.up_to_units; t += Math.max(0, Math.min(n, cap) - prev) * x.rate_per_unit; prev = cap; if (n <= cap) break; } return t; };
    const wholeOrderTier = (n) => { const x = f.tiers.find(t => t.up_to_units == null || n <= t.up_to_units); return Math.max(f.visit_minimum, n * x.rate_per_unit); };
    const base = Object.assign({}, s, { oldFlat: s.oldFlatOf(SWAP) });
    const right = problemsOf(n => Math.max(f.visit_minimum, tierTotal(n), base.oldFlat(n)), base);
    check(right.length === 0, 'the checker accepts the intended function (graduated tiers, minimum, higher-of the old flat price)', 'the checker rejects the intended function', right.slice(0, 4).join('\n'));
    const mutants = [
        ['the old flat price (the bug: $20 for any number)',               n => base.oldFlat(n),                                         /under the \$95 visit minimum/],
        ['the whole order priced at the tier its count falls in',          wholeOrderTier,                                               /FALLS/],
        ['graduated tiers without the visit minimum',                      n => Math.max(tierTotal(n), base.oldFlat(n)),                /under the \$95 visit minimum/],
        ['graduated tiers with the minimum but a cliff of $200 at 11',     n => Math.max(f.visit_minimum, tierTotal(n)) + (n >= 11 ? 200 : 0), /exceeds the highest tier rate/],
    ];
    for (const [label, fn, expect] of mutants) {
        const found = problemsOf(fn, base);
        check(found.some(p => expect.test(p)), `mutant "${label}" is caught`, `mutant "${label}" went UNDETECTED`, found.slice(0, 3).join('\n'));
    }
    // "the higher of": in a world where the old flat price is above the tiers, a function that ignores it must be caught.
    const hi = world(DB => { const g = DB.pricing_formulas.hardware_install_formula; g.swap.flat_rate = 700; g.swap.included_units = 100; });
    const sHi = spec(hi.DB);
    const baseHi = Object.assign({}, sHi, { oldFlat: sHi.oldFlatOf(SWAP) });
    const ignoring = problemsOf(n => Math.max(hi.DB.pricing_formulas.hardware_install_formula.visit_minimum, tierTotal(n)), baseHi);
    check(ignoring.some(p => /under the old flat price/.test(p)), 'mutant "tiers that ignore the old flat price, in a world where it is higher" is caught', 'the "higher of" mutant went UNDETECTED', ignoring.slice(0, 3).join('\n'));
}

console.log('\n=== 6. The schema guards the tier table (the page refuses to boot on a malformed one) ===');
{
    // The in-page checker (orch_validate_ssot) over the real schema. A tier table the engine would mis-read must be refused at boot, not discovered in a quote.
    const SCHEMA = JSON.parse(fs.readFileSync(path.join(ROOT, 'schema', 'btnyc_schema.json'), 'utf8'));
    const W = world();
    const validate = (alter) => { const DB = JSON.parse(JSON.stringify(DB0)); if (alter) alter(DB.pricing_formulas.hardware_install_formula); return W.sb.orch_validate_ssot(DB, SCHEMA); };
    const real = validate(null);
    check(real.valid, 'the real catalog, with the tier table and the minimum, passes the schema', 'the real catalog fails the schema', real.errors.slice(0, 3).map(e => e.path + ' ' + e.message).join('\n'));
    const refused = [
        ['a tier with no rate',              g => { delete g.tiers[1].rate_per_unit; }],
        ['a tier whose rate is text',        g => { g.tiers[0].rate_per_unit = '20'; }],
        ['a tier with no upper bound field', g => { delete g.tiers[2].up_to_units; }],
        ['an empty tier table',              g => { g.tiers = []; }],
        ['a tier carrying an unknown key',   g => { g.tiers[0].discount = 5; }],
        ['a visit minimum that is text',     g => { g.visit_minimum = '95'; }],
        ['a missing visit minimum',          g => { delete g.visit_minimum; }],
    ];
    for (const [label, alter] of refused) {
        const r = validate(alter);
        check(!r.valid && r.errors.some(e => /hardware_install_formula/.test(e.path)), `the schema refuses ${label}`, `the schema ACCEPTED ${label}`, JSON.stringify(r.errors.slice(0, 2)));
    }
    // What the schema cannot say (the checker has no 'minimum' or 'ascending' keyword) is held here, on the real data.
    const g = DB0.pricing_formulas.hardware_install_formula, ups = g.tiers.map(t => t.up_to_units);
    const ascending = ups.every((u, i) => i === 0 || (u === null ? i === ups.length - 1 : (ups[i - 1] !== null && u > ups[i - 1])));
    check(ascending && ups[ups.length - 1] === null && g.tiers.every(t => t.rate_per_unit >= 0) && g.visit_minimum >= 0,
        'the tier table is ascending, ends with an open band, has no negative rate, and the minimum is not negative (the parts the schema cannot express)');
}

console.log('\n=== 7. The four copies of the formula parameters agree (three are hand-edited mirrors: the compiler that made them is absent, PENDING_DECISIONS #111/#122) ===');
{
    // The live parameters are pricing_formulas.hardware_install_formula; the compiled index copies are what a regenerate would overwrite. If one drifts from
    // the live copy, a reader that goes through the compiled index prices differently from the engine, and nothing else would notice.
    const mirrorsOf = (DB) => ({
        'compiled.pricing_index.cabinet_knob_or_pull_install.formula_params': DB.compiled.pricing_index.cabinet_knob_or_pull_install.formula_params,
        'compiled.service_index.cabinet_knob_or_pull_install.pricing.formula_params': DB.compiled.service_index.cabinet_knob_or_pull_install.pricing.formula_params,
        'compiled.formula_index.hardware_install_formula.params': DB.compiled.formula_index.hardware_install_formula.params,
    });
    const FIELDS = ['swap', 'new_holes', 'tiers', 'visit_minimum'];
    const disagreements = (DB) => {
        const live = DB.pricing_formulas.hardware_install_formula, out = [];
        for (const [where, m] of Object.entries(mirrorsOf(DB))) for (const f of FIELDS) if (JSON.stringify(m[f]) !== JSON.stringify(live[f])) out.push(`${where}.${f}`);
        return out;
    };
    const real = disagreements(DB0);
    check(real.length === 0 && Object.keys(mirrorsOf(DB0)).length === 3, 'the live parameters and the 3 compiled mirrors agree on swap, new_holes, tiers and visit_minimum', 'the compiled mirrors disagree with the live formula', real.join('\n'));
    for (const f of ['tiers', 'visit_minimum']) {
        const DB = JSON.parse(JSON.stringify(DB0));
        const m = DB.compiled.formula_index.hardware_install_formula.params;
        if (f === 'tiers') m.tiers[0].rate_per_unit += 1; else m.visit_minimum += 5;
        check(disagreements(DB).some(x => x.endsWith('.' + f)), `mutant "a mirror whose ${f} drifted" is caught`, `mutant "a mirror whose ${f} drifted" went UNDETECTED`);
    }
}

console.log(`\n[Knob/pull tiered pricing] ${pass} passed, ${fail} failed (of ${pass + fail} checks)`);
process.exit(fail > 0 ? 1 : 0);
