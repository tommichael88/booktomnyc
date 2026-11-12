#!/usr/bin/env node
/**
 * verify_unsupported_quantity_asks.js -- T198 (J1): a count the customer stated that a request cannot price is asked about, never quoted as one unit.
 *
 * Before: "mount 120 shelves" -> extractQty 1 (H1: no invented 99) -> the card showed $159 with the stepper at 1 and an Add button: the priced scope (1) and the requested scope (120) disagreed
 * and the one-unit figure read as the price of the job. After: the stated count is kept as evidence (context.statedBeyondRange, extractUnsupportedCount; extractQty is unchanged), the route
 * carries a `scope` state, and while it is pending the card holds the price and asks (yes that many -> quoted after a review; a priced number; "not a count"). Nothing new prices a number.
 *   1. EVIDENCE      counts 100..99,999 before a plural noun are evidence; 3, 12, 99, model 4500, years, dimensions, serials, ambiguous trailing numbers are not.
 *   2. ROUTE         "mount 120 shelves" -> scope pending; resolved by review / quantity / not_a_count; ordinary counts carry no scope.
 *   3. SAME PRICES   extractQty is unchanged (1 for 120; 12 for 12); a confirmed "quantity" resolution prices exactly what orch_apply_quantity always priced.
 *   4. CART          cartTotalLabel never reads a review line as $0.
 *   5. CARD SOURCE   the curated and affirm cards hold the price while pending; the generic chip handler excludes the scope buttons.
 *   6. NON-VACUITY   plant the original (no evidence): "mount 120 shelves" is not pending and the check fails.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..');
const { check: _check, finish } = require('./_shared.js'); const check = (l, c) => _check(l, c);
const { engine } = require('./_engine.js');
const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
const html = fs.readFileSync(path.join(ROOT, 'qr.html'), 'utf8');
function load(patch) {
    const sb = { DB, SERVICE_DATA: DB, window: { DB }, console: { log() {}, warn() {}, error() {}, info() {}, debug() {} } };
    sb.global = sb; vm.createContext(sb);
    let wrapper = engine().wrapper; if (patch) { const w2 = patch(wrapper); if (w2 === wrapper) throw new Error('the planted change did not apply'); wrapper = w2; }
    vm.runInContext(wrapper, sb);
    if (typeof sb.initNlpSets === 'function') { sb.initNlpSets(); if (typeof sb.refreshNlpPreviewBindings === 'function') sb.refreshNlpPreviewBindings(); }
    return sb;
}
const E = load();
const route = (sb, t) => sb.executeWorkflow(Object.assign({}, sb.collectBookingContext_freeText(t), { tagsAffirmed: true }), sb.DB);

// 1. evidence
const yes = ['mount 120 shelves', 'mount 100 shelves', 'replace 150 light bulbs', 'replace 150 outlets', 'patch 300 plaster holes', 'mount 1,200 shelves', 'mount 120 shelves and install model 4500'];
const no = ['mount 3 shelves', 'mount 12 shelves', 'mount 99 shelves', 'replace light bulb model 4500', 'furniture assembly 4500', 'mount shelf 120', 'replace 12 bulbs in room 120', 'install ceiling fan serial 123456',
    'install shelf 36 x 12', 'mount tv in 2024 apartment', 'repair 4500', 'fix the door in apartment 4B', 'mount a 55" tv', 'replace bulb 2024 model', 'mount tv for 2024'];
for (const p of yes) { const u = E.extractUnsupportedCount(p); check(`1 "${p}" is a stated count past the range`, !!u && u.value >= 100, u); }
for (const p of no) { const u = E.extractUnsupportedCount(p); check(`1 "${p}" is not`, u === null, u); }

// 2. route states
{
    const r = route(E, 'mount 120 shelves'), s = r.scope;
    check('2.1 "mount 120 shelves": scope pending, stated 120', !!s && s.pending && s.stated === 120 && !s.review, s);
    check('2.2 an ordinary count carries no scope', route(E, 'mount 12 shelves').scope === null && route(E, 'replace light bulb model 4500').scope === null);
    const rev = E.orch_resolve_scope(r, 'review', E.DB), nc = E.orch_resolve_scope(r, 'not_a_count', E.DB), back = E.orch_resolve_scope(rev, null, E.DB), qn = E.orch_apply_quantity(r, 40, E.DB);
    check('2.3 review -> not pending, review', !rev.scope.pending && rev.scope.review);
    check('2.4 not_a_count -> resolved, not review', !nc.scope.pending && !nc.scope.review);
    check('2.5 "change the number" asks again', back.scope.pending);
    check('2.6 a priced number resolves the question', !qn.scope.pending && !qn.scope.review && qn.context.extractedQty === 40);

    // 3. same prices
    check('3.1 extractQty unchanged: 120 -> 1, 12 -> 12', E.extractQty('mount 120 shelves') === 1 && E.extractQty('mount 12 shelves') === 12);
    const typed40 = route(E, 'mount 40 shelves');
    check('3.2 setting 40 on the held card prices exactly what typing 40 prices', qn.quote && typed40.quote && qn.quote.laborEstimate === typed40.quote.laborEstimate, [qn.quote && qn.quote.laborEstimate, typed40.quote && typed40.quote.laborEstimate]);
    check('3.3 "not a count" is the one-unit quote of the same words', nc.quote && route(E, 'mount shelves').quote && nc.quote.laborEstimate === route(E, 'mount shelves').quote.laborEstimate);
}

// 4. cart total label (the real function, from the page source)
{
    const m = html.match(/function cartLineAmount[\s\S]*?\n}\n[\s\S]*?function cartLineQty[\s\S]*?\n}\n[\s\S]*?function cartTotal\([\s\S]*?\n}\n[\s\S]*?function cartTotalLabel[\s\S]*?\n}\n/);
    check('4.0 cart functions found', !!m);
    const f = new Function(m[0] + '; return cartTotalLabel;')();
    check('4.1 only a review line -> "To be quoted"', f([{ price: 'Quote after review', reviewRequired: true }]) === 'To be quoted');
    check('4.2 priced + review line -> "$478 + 1 to be quoted"', f([{ price: '$478' }, { price: 'Quote after review', reviewRequired: true }]) === '$478 + 1 to be quoted');
    check('4.3 no review line -> "$478"', f([{ price: '$478' }]) === '$478');
}

// 5. card source
check('5.1 curated card: price and stepper held while pending', /_scopeHeld/.test(html) && /!_scopeHeld && !\(_scope && _scope\.review\)/.test(html) && /awaitingTriage = [^;]*_scopeHeld/.test(html));
check('5.2 affirm card: price held while pending', /priceDisplay = \(route\.scope && route\.scope\.pending\)/.test(html));
check('5.3 scope buttons are not routed to the chip-answer handler', /\.ims-chip:not\(\.scope-action\)/.test(html) && (html.match(/ims-chip scope-action" id="btn-scope-/g) || []).length === 3);

// 6. non-vacuity: the original (no evidence)
{
    const O = load(w => w.replace('function extractUnsupportedCount(text) {', 'function extractUnsupportedCount(text) { return null;'));
    const r = route(O, 'mount 120 shelves');
    check('6 planted original: "mount 120 shelves" is not held (this is the defect)', !(r.scope && r.scope.pending) && r.quote && r.quote.laborEstimate > 0);
}
// 7. K1: a lone trailing number of unknown meaning is asked about (evidence, never a quantity)
{
    const amb = ['mount shelf 120', 'mount shelf 12', 'mount shelf 4', 'mount tv 55', 'furniture assembly 4500', 'light bulbs 3'];
    const notAmb = ['mount shelf model 120', 'mount a 120-inch shelf', 'install shelves in room 120', 'mount 120 shelves', 'mount 12 shelves', 'mount shelf 1', 'mount shelf 2024', 'mount shelf 120 and paint the wall',
        'mount 3 shelves 120', 'install shelf 36 x 12', 'replace bulb in 3', 'mount shelf', 'mount shelf KD-4500', 'mount shelf #120'];
    for (const p of amb) { const u = E.extractAmbiguousNumber(p); check(`7 "${p}" ends with a number of unknown meaning`, !!u && u.kind === 'ambiguous', u); }
    for (const p of notAmb) { const u = E.extractAmbiguousNumber(p); check(`7 "${p}" does not`, u === null, u); }
    const r = route(E, 'mount shelf 120'), s = r.scope;
    check('7.1 "mount shelf 120": scope pending, kind ambiguous, 120', !!s && s.pending && s.kind === 'ambiguous' && s.stated === 120, s);
    check('7.2 extractQty is still 1 (nothing is priced as 120)', E.extractQty('mount shelf 120') === 1);
    const yes12 = E.orch_resolve_scope(route(E, 'mount shelf 12'), 'count', E.DB), typed12 = route(E, 'mount 12 shelves');
    check('7.3 "yes, 12" prices exactly what "mount 12 shelves" prices', yes12.scope && !yes12.scope.pending && yes12.quote.laborEstimate === typed12.quote.laborEstimate, [yes12.quote && yes12.quote.laborEstimate, typed12.quote && typed12.quote.laborEstimate]);
    const yes120 = E.orch_resolve_scope(r, 'count', E.DB);
    check('7.4 "yes, 120" is a review (no online price), not 120 priced', yes120.scope.review && !yes120.scope.pending);
    const no = E.orch_resolve_scope(r, 'not_a_count', E.DB);
    check('7.5 "it is a model or label" is the one-unit quote of the same words', !no.scope.pending && no.quote.laborEstimate === route(E, 'mount shelf').quote.laborEstimate);
    check('7.6 a supported count, a model, a dimension, a room carry no scope', ['mount 12 shelves', 'mount shelf model 120', 'mount a 120-inch shelf', 'install shelves in room 120'].every(t => route(E, t).scope === null));
    const O = load(w => w.replace('function extractAmbiguousNumber(text) {', 'function extractAmbiguousNumber(text) { return null;'));
    check('7.7 planted original: "mount shelf 120" is not held (this is the defect)', !(route(O, 'mount shelf 120').scope && route(O, 'mount shelf 120').scope.pending));
}
finish();
