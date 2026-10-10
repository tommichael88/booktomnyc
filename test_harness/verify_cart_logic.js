#!/usr/bin/env node
/**
 * verify_cart_logic.js -- the one cart-line identity and merge rule (cart_logic: canonicalAnswerKey, cartLineKey, resolveCartTransition), T158.
 *
 * @enforces R-INVARIANT-CANONICAL, R-DOMAIN-SHAPE, R-INVARIANT-SINGLEDEF
 *
 * THE DEFECT CLASS: DEFECT-PRESENTATION-IDENTITY. A cart line's identity used to be a string composed of what the customer SAW (name + formatted price + 'Answers: ' + JSON.stringify(answers)).
 * JSON key order is not stable, formatted prices differ by whitespace, and the name carries a presentation suffix, so two identical taps landed as two lines. The identity is now derived from the
 * entry's own structured fields, in Logic, in one place. This test holds that rule.
 *
 * A SECOND, SMALLER DEFECT this test was written against (found by verify_cart_store_migration, which saw a quantity of 3 where 2 was meant): the guard that was meant to stop an
 * entry with NO identity from matching other identity-less entries compared the key with '::', but the empty key of four joined parts is '::::::', so the guard never fired and every
 * anonymous entry merged into one line. An entry must name a service (serviceId / serviceKey) to merge at all; every entry builder in the page does.
 *
 * A THIRD, found by driving the real cart (verify_cart_merge_behavior): DEFECT-UNPRICED-IDENTITY. The key omitted a PRICED fact, so three shelves ($478) and one shelf ($159) with the
 * same answers merged into one $478 line and the $159 request vanished; and the merged line's qty was read by nothing (the cart totals summed price strings and ignored qty), so two
 * identical taps were quoted once. A line's identity now includes its quoted amount (cartLineAmount); the total is the sum of amount x qty (cartTotal); cartLineQty is the one reader of qty.
 *
 * WHAT THIS HOLDS (all against the module as the PAGE RUNS it -- the assembled document, not a copy):
 *   1. SINGLE DEFINITION: the page defines each of the six functions exactly once, and no second price reader exists.
 *   2. canonicalAnswerKey: key order never changes the key (flat and nested); null / non-object -> ''; arrays and primitives do not throw.
 *   3. cartLineKey: from business facts only -- the same service with the same answers in any order has one key; a different service, category, variant, answer or QUOTED AMOUNT has another;
 *      the entry's id, name and the price's FORMATTING never enter the key; with no structured answers it falls back to the notes string.
 *   3b. cartLineAmount / cartLineQty / cartTotal: the amount is the first number in the price (a string in any spacing, or a number; 0 when none); qty is a whole number >= 1; the total is
 *      the sum of amount x qty, so a line tapped twice costs twice, and a bad cart totals 0 instead of throwing.
 *   4. resolveCartTransition: invalid entry -> no-op; the same service tapped twice (answers in another order, price string spaced differently, name suffix changed) is ONE line, qty 2,
 *      action 'increment-qty'; different answers / a different `_variant` are separate lines; furniture merges by name + category (and only that); an entry that names no service never merges
 *      (two anonymous entries are two lines); a furniture line is never the target of a non-furniture merge; neither input is mutated; `source` names the branch that decided.
 *   5. NON-VACUITY: nine mutants of the module (presentation identity restored, answers not sorted, the dead guard restored, `_variant` dropped, furniture matched without category, the cart
 *      mutated in place, the amount dropped from the key, qty ignored by the total, the amount read from the wrong place) are each run through the same checks and each must trip ITS OWN check.
 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const Q = require('./_qr_blocks.js');   // the shared reader of the page: assembled, parsed, blocks found by their own header (never by a pattern built from a function's name)

const ROOT = path.resolve(__dirname, '..');
const QR = process.env.BTNYC_QR_FILE ? path.resolve(process.env.BTNYC_QR_FILE) : path.join(ROOT, 'qr.html');

let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log('  ✓ ' + m); };
const bad = (m, d) => { fail++; console.log('  ✗ ' + m + (d ? '\n      ' + String(d).split('\n').join('\n      ') : '')); };
const check = (c, okMsg, badMsg, d) => (c ? ok(okMsg) : bad(badMsg || okMsg, d));

// ---- the module, as the page runs it ----------------------------------------------------------------------------------------------------------------------------------
// The page is read ASSEMBLED (an external <script src> is replaced by the repo file it names), the cart module is the block whose own header names cart_logic.js, and the functions it
// declares are found by PARSING it. No pattern is built from a function's name: that is the by-name extraction that goes stale when a file is reformatted (verify_stale_sandbox_baseline).
const { blocks } = Q.loadQr(QR);
const NAMES = ['canonicalAnswerKey', 'cartLineKey', 'resolveCartTransition', 'cartLineAmount', 'cartLineQty', 'cartTotal'];
const declaredFns = (src) => { const r = Q.tryParseJs(src); return r.ast ? Q.moduleStatements(r.ast).filter(n => n.type === 'FunctionDeclaration' && n.id).map(n => n.id.name) : []; };
const defsIn = (src, n) => declaredFns(src).filter(x => x === n).length;
const holders = blocks.filter(b => NAMES.some(n => defsIn(b.src, n) > 0)).map(b => b.src);
const moduleBlock = Q.findModuleBlock(blocks, 'cart_logic.js');
const BLOCK = moduleBlock ? moduleBlock.src : '';

// mathFurnitureAssembly is the pricing engine's (it reads the catalog); the merge rule only needs its shape, so a deterministic stand-in is supplied and says so.
const FURNITURE_STUB = 'function mathFurnitureAssembly(minutes){ const m = minutes.reduce((a, b) => a + (+b || 0), 0); return { hours: m / 60, price: m, minutes: m }; }';
function load(text) {
    const ctx = vm.createContext({});
    vm.runInContext(FURNITURE_STUB + '\n' + text + '\nthis.__api = { canonicalAnswerKey, cartLineKey, resolveCartTransition, cartLineAmount, cartLineQty, cartTotal };', ctx);
    return ctx.__api;
}

// ---- the checks: each returns [id, passed, detail] -----------------------------------------------------------------------------------------------------------------------
const clone = o => JSON.parse(JSON.stringify(o));
const line = (o) => Object.assign({ id: 'x' + Math.random().toString(36).slice(2, 8), serviceId: 'faucet_repair_drip', category_id: 'plumbing', name: 'Faucet Repair (Drip)', price: '$50' }, o);

function runChecks(api) {
    const R = [], t = (id, cond, detail) => R.push([id, !!cond, detail || '']);
    const { canonicalAnswerKey: ck, cartLineKey: lk, resolveCartTransition: rt, cartLineAmount: amt, cartLineQty: lq, cartTotal: tot } = api;
    const safe = (f) => { try { return f(); } catch (e) { return { threw: String(e.message) }; } };

    // 2. canonicalAnswerKey
    t('answers-order', ck({ a: 1, b: 2 }) === ck({ b: 2, a: 1 }), 'the same answers in another key order must give the same key');
    t('answers-nested-order', ck({ q: { y: 1, x: 2 }, z: 3 }) === ck({ z: 3, q: { x: 2, y: 1 } }), 'nested objects are sorted too');
    t('answers-differ', ck({ a: 1 }) !== ck({ a: 2 }) && ck({ a: 1 }) !== ck({ b: 1 }), 'different answers must give different keys');
    t('answers-empty', ck(null) === '' && ck(undefined) === '' && ck('str') === '' && ck(5) === '', 'null / non-object -> empty string');
    const weird = safe(() => [ck({ list: [1, 2], n: null, u: undefined, b: true }), ck([]), ck({})]);
    t('answers-no-throw', !weird.threw, 'arrays, null, undefined and booleans must not throw: ' + (weird.threw || ''));

    // 3. cartLineKey
    const base = line({ intakeAnswers: { size: 'large', wall: 'drywall' } });
    t('key-order', lk(base) === lk(line({ intakeAnswers: { wall: 'drywall', size: 'large' } })), 'same service, same answers in another order: one key');
    t('key-service', lk(base) !== lk(line({ serviceId: 'faucet_replace', intakeAnswers: { size: 'large', wall: 'drywall' } })), 'a different service is a different key');
    t('key-category', lk(base) !== lk(line({ category_id: 'electrical', intakeAnswers: { size: 'large', wall: 'drywall' } })), 'a different category is a different key');
    t('key-variant', lk(base) !== lk(line({ _variant: 'onsite', intakeAnswers: { size: 'large', wall: 'drywall' } })), 'a different _variant is a different key');
    t('key-answer', lk(base) !== lk(line({ intakeAnswers: { size: 'small', wall: 'drywall' } })), 'a different answer is a different key');
    t('key-presentation-free', lk(base) === lk(Object.assign({}, base, { id: 'other-id', name: 'Faucet Repair (Drip) – On-site', price: ' $ 50.00 ' })), 'id, name and the FORMATTING of the price must not enter the key');
    t('key-amount', lk(base) !== lk(Object.assign({}, base, { price: '$159' })) && lk(base) === lk(Object.assign({}, base, { price: '$50+' })), 'DEFECT-UNPRICED-IDENTITY: the same service and answers quoting a different AMOUNT is a different key (the quoted amount is what was bought); the same amount in another format is the same key');
    t('key-notes-fallback', lk(line({ notes: 'a' })) !== lk(line({ notes: 'b' })) && lk(line({ notes: 'a' })) === lk(line({ notes: 'a' })), 'with no structured answers the key falls back to the notes string');
    t('key-servicekey-alias', lk({ serviceKey: 'k1' }) === lk({ serviceId: 'k1' }), 'serviceKey stands for serviceId');
    t('key-bad-input', lk(null) === '' && lk(undefined) === '' && lk('x') === '', 'a non-object entry has the empty key');

    // 3b. amount, qty, total
    t('amount-reads', amt({ price: '$478' }) === 478 && amt({ price: ' $ 50.00 ' }) === 50 && amt({ price: '$95+' }) === 95 && amt({ price: '$120/hr' }) === 120 && amt({ price: '$95 \u2013 $150' }) === 95 && amt({ price: 64.4 }) === 64 && amt({ price: '$49.50' }) === 50,
        'the amount is the first number in the price, rounded: ' + JSON.stringify([amt({ price: '$478' }), amt({ price: ' $ 50.00 ' }), amt({ price: '$95+' }), amt({ price: '$120/hr' }), amt({ price: '$95 \u2013 $150' }), amt({ price: 64.4 }), amt({ price: '$49.50' })]));
    t('amount-empty', amt({}) === 0 && amt({ price: '' }) === 0 && amt({ price: 'call us' }) === 0 && amt({ price: null }) === 0 && amt(null) === 0 && amt(undefined) === 0 && amt('$5') === 0 && amt({ price: NaN }) === 0, 'no number, no entry, or a non-entry quotes 0 (never throws)');
    t('qty-reads', lq({ qty: 3 }) === 3 && lq({ qty: 2.9 }) === 2 && lq({}) === 1 && lq({ qty: 0 }) === 1 && lq({ qty: -2 }) === 1 && lq({ qty: 'x' }) === 1 && lq({ qty: '4' }) === 4 && lq(null) === 1 && lq(undefined) === 1, 'qty is a whole number >= 1; anything else is 1');
    t('total-sums-amount-times-qty', tot([{ price: '$478', qty: 2 }, { price: '$159' }, { price: '$50', qty: 3 }]) === 478 * 2 + 159 + 50 * 3,
        'DEFECT-UNPRICED-IDENTITY: the total is the sum of amount x qty (a line tapped twice costs twice); got ' + tot([{ price: '$478', qty: 2 }, { price: '$159' }, { price: '$50', qty: 3 }]));
    t('total-empty', tot([]) === 0 && tot(null) === 0 && tot(undefined) === 0 && tot('x') === 0 && tot([null, {}, { price: 'x', qty: 5 }]) === 0, 'an empty, missing or malformed cart totals 0 (never throws)');

    // 4. resolveCartTransition
    const noop1 = safe(() => rt(null, [])), noop2 = safe(() => rt({ serviceId: 's' }, []));
    t('invalid-entry', noop1.action === 'no-op' && noop1.source === 'invalid-entry' && noop2.action === 'no-op' && noop2.targetId === null, 'null / id-less entry -> no-op with source invalid-entry');
    const e1 = line({ name: 'Faucet Repair (Drip)', price: '$50', notes: 'Answers: {"a":1,"b":2}', intakeAnswers: { a: 1, b: 2 } });
    const e2 = line({ name: 'Faucet Repair (Drip) ', price: '$50.00', notes: 'Answers: {"b":2,"a":1}', intakeAnswers: { b: 2, a: 1 } });
    const first = rt(e1, []), second = rt(e2, first.cart);
    t('append-first', first.action === 'append' && first.cart.length === 1 && first.cart[0].qty === 1 && first.source === 'new-line' && first.targetId === e1.id, 'a first entry is appended with qty 1');
    t('same-tap-merges', second.action === 'increment-qty' && second.cart.length === 1 && second.cart[0].qty === 2 && second.targetId === e1.id && second.source === 'line-key-match',
        'DEFECT-PRESENTATION-IDENTITY: the same service + answers tapped twice (answers re-ordered, price spaced differently, name changed) must be ONE line, qty 2 -- got ' + JSON.stringify(second.cart.map(c => ({ n: c.name, q: c.qty }))));
    t('same-tap-total', tot(second.cart) === 100, 'two identical $50 taps total $100, not $50: got ' + tot(second.cart));
    const dearer = rt(line({ price: '$159', intakeAnswers: { a: 1, b: 2 } }), first.cart);
    t('different-amount-splits', dearer.action === 'append' && dearer.cart.length === 2 && tot(dearer.cart) === 50 + 159,
        'DEFECT-UNPRICED-IDENTITY: the same service and answers at a different quoted amount is its own line, and the total is both: ' + JSON.stringify(dearer.cart.map(c => [c.price, c.qty])) + ' total ' + tot(dearer.cart));
    const third = rt(line({ intakeAnswers: { a: 1, b: 3 } }), first.cart);
    t('different-answers-split', third.action === 'append' && third.cart.length === 2, 'different answers are two lines');
    const onsite = rt(line({ _variant: 'onsite', intakeAnswers: { a: 1, b: 2 } }), first.cart);
    t('variant-splits', onsite.action === 'append' && onsite.cart.length === 2, 'the on-site variant of the same service and answers is its own line');
    const keepQty = rt(line({ qty: 3 }), []);
    t('keeps-qty', keepQty.cart[0].qty === 3, 'an entry that arrives with a qty keeps it');

    // the anonymous-entry guard (the dead `key !== "::"` comparison)
    const anon1 = { id: 'a1' }, anon2 = { id: 'a2' };
    const A1 = safe(() => rt(anon1, [])), A2 = safe(() => rt(anon2, A1.cart || []));
    t('anonymous-never-merge', A2.action === 'append' && A2.cart && A2.cart.length === 2, 'two entries that name no service are two lines, never one (got ' + (A2.cart ? A2.cart.length + ' line(s), qty ' + A2.cart.map(c => c.qty).join('/') : 'error') + ')');
    const N1 = rt({ id: 'n1', category_id: 'plumbing', notes: 'same' }, []), N2 = rt({ id: 'n2', category_id: 'plumbing', notes: 'same' }, N1.cart);
    t('no-service-never-merge', N2.action === 'append' && N2.cart.length === 2, 'same category and same notes but no service identity: still two lines');
    const K1 = rt({ id: 'k1', serviceKey: 'svc' }, []), K2 = rt({ id: 'k2', serviceKey: 'svc' }, K1.cart);
    t('servicekey-merges', K2.action === 'increment-qty' && K2.cart.length === 1 && K2.cart[0].qty === 2, 'serviceKey is an identity: the same one merges');

    // furniture
    const f1 = { id: 'f1', serviceId: 'furn', category_id: 'furniture', name: 'Furniture Assembly', price: '$0', furnitureItems: [{ label: 'Bed', minutes: 60 }] };
    const f2 = { id: 'f2', serviceId: 'furn', category_id: 'furniture', name: 'Furniture Assembly', price: '$0', furnitureItems: [{ label: 'Desk', minutes: 30 }] };
    const fa = rt(f1, []), fb = rt(f2, fa.cart);
    t('furniture-first', fa.action === 'append' && fa.source === 'new-furniture-line' && fa.cart[0].qty === 1, 'a first furniture entry is appended (source new-furniture-line)');
    t('furniture-merges', fb.action === 'merge-furniture' && fb.source === 'furniture-match' && fb.cart.length === 1 && fb.cart[0].furnitureItems.length === 2 && fb.targetId === 'f1' &&
        /Bed, Desk/.test(fb.cart[0].notes) && fb.cart[0].estimatedPrice === 90, 'the same furniture job merges its items and re-prices: ' + JSON.stringify(fb.cart[0] && { n: fb.cart[0].furnitureItems && fb.cart[0].furnitureItems.length, p: fb.cart[0].estimatedPrice }));
    const fc = rt(Object.assign({}, f2, { id: 'f3', category_id: 'other' }), fa.cart);
    t('furniture-category-splits', fc.action === 'append' && fc.cart.length === 2, 'furniture under a different category is a different job');
    const fd = rt(line({ serviceId: 'furn', category_id: 'furniture', name: 'Furniture Assembly' }), fa.cart);
    t('furniture-not-a-merge-target', fd.cart.length === 2 && fd.action === 'append', 'a non-furniture entry never merges into a furniture line');

    // no mutation
    const cartBefore = [line({ id: 'm1', intakeAnswers: { a: 1 } })], entryBefore = line({ id: 'm2', intakeAnswers: { a: 1 } });
    const snapC = JSON.stringify(cartBefore), snapE = JSON.stringify(entryBefore);
    const mm = rt(entryBefore, cartBefore);
    const furnCart = [clone(f1)], furnEntry = clone(f2), snapFC = JSON.stringify(furnCart), snapFE = JSON.stringify(furnEntry);
    rt(furnEntry, furnCart); rt(clone(f1), []);
    const appendCart = [line({ id: 'm3', intakeAnswers: { q: 1 } })], appendSnap = JSON.stringify(appendCart);
    rt(line({ id: 'm4', intakeAnswers: { q: 2 } }), appendCart);
    t('no-mutation', JSON.stringify(cartBefore) === snapC && JSON.stringify(entryBefore) === snapE && JSON.stringify(furnCart) === snapFC && JSON.stringify(furnEntry) === snapFE && JSON.stringify(appendCart) === appendSnap && mm.cart !== cartBefore,
        'resolveCartTransition must not mutate the cart or the entry it is given (it returns a new cart)');
    return R;
}

// ---- mutants: each must trip its own check ------------------------------------------------------------------------------------------------------------------------------
const MUTANTS = [
    { name: 'presentation identity restored (name + price in the key)', expect: 'same-tap-merges',
      apply: s => s.replace(/entry\.serviceId \|\| entry\.serviceKey \|\| '',\s*\n\s*entry\.category_id \|\| '',/, "entry.name || '', entry.price || '', entry.category_id || '',") },
    { name: 'answers not sorted (JSON order matters again)', expect: 'answers-order',
      apply: s => s.replace('Object.keys(answers).sort().map', 'Object.keys(answers).map') },
    { name: 'the dead guard restored (key !== "::" instead of "names a service")', expect: 'anonymous-never-merge',
      apply: s => s.replace(/if \(entry\.serviceId \|\| entry\.serviceKey\) \{/, "if (key && key !== '::') {") },
    { name: '_variant dropped from the key', expect: 'variant-splits',
      apply: s => s.replace(/\s*entry\._variant \|\| '',/, '') },
    { name: 'furniture matched on name only (category ignored)', expect: 'furniture-category-splits',
      apply: s => s.replace(/\s*it\.category_id === entry\.category_id\s*\n/, '\n true\n').replace('it.name === entry.name &&', 'it.name === entry.name &&') },
    { name: 'the quoted amount dropped from the key (3 shelves and 1 shelf merge again)', expect: 'different-amount-splits',
      apply: s => s.replace(/\s*String\(cartLineAmount\(entry\)\),/, '') },
    { name: 'the total ignores qty (a second tap is quoted once)', expect: 'total-sums-amount-times-qty',
      apply: s => s.replace('cartLineAmount(it) * cartLineQty(it)', 'cartLineAmount(it)') },
    { name: 'the amount reads the LAST number in the price (a "$120/hr" or "$95 + $10" line is mispriced)', expect: 'amount-reads',
      apply: s => s.replace("const m = p.match(/(\\d+(?:\\.\\d+)?)/);", "const m = p.match(/(\\d+(?:\\.\\d+)?)(?!.*\\d)/);") },
    { name: 'the cart mutated in place', expect: 'no-mutation',
      apply: s => s.replace("return { action: 'append', cart: [...cart, { ...entry, qty: entry.qty || 1 }], targetId: entry.id, source: 'new-line' };", "cart.push({ ...entry, qty: entry.qty || 1 }); return { action: 'append', cart, targetId: entry.id, source: 'new-line' };") },
];

console.log('verify_cart_logic: the one cart-line identity and merge rule\n');

console.log('1. single definition');
check(!!moduleBlock, 'the page has a script block headed cart_logic.js', 'no script block of the page is headed cart_logic.js');
for (const n of NAMES) {
    const total = blocks.reduce((a, b) => a + defsIn(b.src, n), 0);
    check(total === 1, `${n} is defined once in the page`, `${n} is defined ${total} times in the assembled page`, 'R-INVARIANT-SINGLEDEF: one definition of each rule.');
}
check(holders.length === 1, 'all six live in one script block', `the six functions are spread over ${holders.length} script blocks`);

// Until the page loads modules/cart_logic.js by <script src>, the module file and the page's inline block are two copies of one definition (PENDING_DECISIONS: cart_logic double definition).
// They are held byte-identical (modulo the trailing newline) so an edit to one cannot silently leave the other behind.
const MODFILE = path.join(ROOT, 'modules', 'cart_logic.js');
if (BLOCK && fs.existsSync(MODFILE)) check(fs.readFileSync(MODFILE, 'utf8').trim() === BLOCK.trim(), 'modules/cart_logic.js is the same text as the cart block the page runs', 'modules/cart_logic.js and the page\'s cart block differ: edit both, or load the module by <script src> and delete the inline copy', 'R-INVARIANT-SINGLEDEF: a definition that exists twice drifts.');

if (!BLOCK) { bad('the cart logic block was not found in the page'); console.log(`\n${pass} passed, ${fail} failed`); process.exit(1); }

console.log('\n2-4. identity and merge rule');
let api; try { api = load(BLOCK); } catch (e) { bad('the module does not load', e.message); console.log(`\n${pass} passed, ${fail} failed`); process.exit(1); }
for (const [id, passed, detail] of runChecks(api)) check(passed, id, `${id}: ${detail}`);

console.log('\n5. non-vacuity: each mutant must trip its own check');
for (const m of MUTANTS) {
    const mutated = m.apply(BLOCK);
    if (mutated === BLOCK) { bad(`mutant "${m.name}": its anchor is not in the module (the mutation did nothing)`, 'The module changed shape; re-anchor this mutant.'); continue; }
    let res; try { res = runChecks(load(mutated)); } catch (e) { bad(`mutant "${m.name}" does not even load: ${e.message}`); continue; }
    const hit = res.find(r => r[0] === m.expect);
    check(hit && !hit[1], `mutant "${m.name}" is caught by [${m.expect}]`, `mutant "${m.name}" was NOT caught by [${m.expect}]`, 'tripped: ' + (res.filter(r => !r[1]).map(r => r[0]).join(', ') || 'none'));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
