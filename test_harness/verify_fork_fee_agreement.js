#!/usr/bin/env node
/**
 * verify_fork_fee_agreement.js -- R-WHITEFLAG-FORKB: the fee the customer saw on the Fork is the fee the booking carries (T180 6/n).
 *
 * @enforces R-WHITEFLAG-FORKB
 * @enforces R-TEST-CANFAIL
 * @detects DEFECT-TEST-CANTFAIL
 *
 * THE RULE (Charter, Part VII, "The Diagnostic Path Preserves the Customer's Price"): "When a customer chooses a priced diagnostic/on-site path, the fee displayed at the decision point must be the fee
 * carried into the booking ... Accomplishment: an end-to-end test selects the diagnostic path and asserts agreement among displayed fee, BookingContext fee, checkout fee, and booking payload; a deliberately
 * mismatched fee fails the test."
 *
 * THE CHAIN, measured on the REAL PAGE (jsdom, the production entry points) for EVERY service that offers the Fork:
 *   displayed        the $ on the Fork's "Book an on-site diagnostic" button
 *   BookingContext   the route's own quote (route.quote.divergenceFee), and the catalog's fee policy (global_rules.divergence_resolution.diagnostic_fee)
 *   Path B           the card's "On-site diagnostic (flat rate): $N" after the customer taps it
 *   booking payload  the cart entry the page holds for the booking: price, the Fork-B discriminator, and the note that records the fee
 *   checkout         the cart's Subtotal and its "Due Today"
 * and again at quantity 3 (a flat fee is not multiplied by how many items the customer described).
 *
 * THE TWO WAYS A FORK-B LINE REACHES THE CART, both measured: (1) the curated card's add button (what a customer reaches today); (2) sqAddToCart(), the quote panel's add button, which has a branch
 * for "the customer booked via the On-Site path". Branch (2) used to write the quote's labor estimate as the price ($183 .. $422) while its own note said "$85 diagnostic fee": found by this test's
 * first run, corrected in T180 6/n (qr.html), and held here for all 31 diagnostic entries the catalog has (4 services, 27 group fallbacks).
 *
 * NAMED NON-COVERAGE (never silent):
 *   - finalizeBooking() is a demo: it clears the cart and toasts "Booking confirmed! (demo)"; nothing is sent anywhere, so there is no transmitted payload to assert on. The "booking payload" here is the cart
 *     entry the page itself holds for the booking. When a real submission exists, this test must be extended to read what it sends (the mismatch mutants below show where a break would be caught).
 *   - the 27 group fallbacks never show the Fork today: the quote panel offers it only on a live route, and a group fallback has none (qr.html says so in buildQuotePanelModel). They are measured at the
 *     cart step, and on the path they do take (the estimate shown is the estimate carried).
 *   - after Path B on a curated route the quote panel's "Calculate Estimate" button is hidden, so a customer cannot draw the quote panel and reach branch (2). Reported below; the invariant is asserted anyway.
 *
 * NON-VACUITY (R-TEST-CANFAIL): five mutants of qr.html -- the curated card carrying the labor estimate; the terms' fee drifting from the Fork's; the Fork showing a different fee; sqAddToCart carrying the estimate
 * again; the booking note dropping the fee -- each make this test fail in the leg that guards it.
 *
 * RUN ON ANOTHER TREE: QR_ROOT=<tree> node test_harness/verify_fork_fee_agreement.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..');
const { JSDOM } = require(path.join(__dirname, 'node_modules', 'jsdom'));
const { assemble } = require('./_page.js');
const { waitForAppReady } = require('./_jsdom_helpers.js');

let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (detail ? '\n      ' + String(detail).split('\n').join('\n      ') : '')); } };
const clone = o => JSON.parse(JSON.stringify(o)), wait = ms => new Promise(r => setTimeout(r, ms)), clean = s => String(s || '').replace(/\s+/g, ' ').trim();
const text = e => { if (!e) return ''; const c = e.cloneNode(true); c.querySelectorAll('script,style').forEach(n => n.remove()); return clean(c.textContent); };
const DB0 = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
const QR_TEXT = fs.readFileSync(path.join(ROOT, 'qr.html'), 'utf8');
const dollars = s => { const m = /\$\s*(\d+(?:\.\d+)?)/.exec(String(s || '')); return m ? Number(m[1]) : null; };

async function openPage(html, db) {
  const dom = new JSDOM(html, { url: 'https://tommichael88.github.io/booktomnyc/qr.html', runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, beforeParse(w) {
    w.fetch = async u => String(u).includes('btnyc.json') ? { ok: true, json: async () => clone(db) } : { ok: false, status: 404 };
    w.HTMLElement.prototype.scrollIntoView = function () {}; w.console.log = () => {}; w.console.warn = () => {}; w.console.error = () => {};
  } });
  await waitForAppReady(dom.window);
  return dom;
}
const tapOn = (w, el) => el.dispatchEvent(new w.Event('click', { bubbles: true }));
const btnOf = (doc, re) => [...doc.querySelectorAll('button')].find(b => re.test(b.textContent));
const cartItems = w => ((w.__store.getState().cart || {}).serviceRequest) || [];
const clearCart = w => { w.__store.dispatch({ type: 'cart/SET', payload: { serviceRequest: [] } }); w.eval('cartLimiter.requests.clear()'); };   // the page's own 5-adds-per-2s guard is not what is under test
const subtotal = doc => { const m = text(doc.body).match(/Subtotal \((\d+) items?\): \$(\d+(?:\.\d+)?)/); return m ? Number(m[2]) : 0; };
const dueToday = doc => dollars(text(doc.getElementById('totalAmount')));

// ── the roster, from the catalog (not the page), then compared with what the page says ──
const CURATED = DB0.services.filter(s => (s.financial_engine || {}).checkout_state === 'diagnostic' && (s.remote_deep_dive_modules || []).length).map(s => s.id);
const DYNAMIC = Object.keys(DB0.dynamic_services || {}).filter(k => ((DB0.dynamic_services[k].financial_engine || {}).checkout_state === 'diagnostic' || /\+Diagnostic$/.test(k)) && (DB0.dynamic_services[k].remote_deep_dive_modules || []).length);
const POLICY_FEE = ((DB0.global_rules || {}).divergence_resolution || {}).diagnostic_fee;

// The customer reaches the service the way a tile reaches it (prefillSmartQuoteFromService), answers whatever the triage still asks (taking the first answer that does not move the job to another service),
// and sqRenderCuratedCard draws the card. Returns the route on screen.
async function reachFork(w, doc, id) {
  const svc = w.DB.services.find(s => s.id === id);
  w.sqRestart(); w.S._divergencePath = null;
  w.prefillSmartQuoteFromService(svc, svc.ui_taxonomy.category_id);
  await wait(60);
  let route = w.S._lastRoute;
  for (let i = 0; i < 14 && route && route.triagePending; i++) {
    const open = (route.visibleChain || []).filter(m => !(route.answers || {})[m.moduleKey]);
    let moved = false;
    for (const m of open) { const opt = (m.client_response || []).find(o => !o.route_to); if (opt) { route = w.orch_apply_answer(route, m.moduleKey, opt.label, w.DB); moved = true; break; } }
    if (!moved) break;
  }
  w.sqRenderCuratedCard(route, 'sqCardHost');
  return route;
}

// One service, one quantity: the whole chain. Returns { id, qty, values, problems }.
async function measureCurated(w, doc, id, qty) {
  const P = [], V = { id, qty };
  clearCart(w);
  let route = await reachFork(w, doc, id);
  if (qty > 1) { w.handleIntakeQuantity(qty); await wait(40); route = w.S._lastRoute; }
  const fork = btnOf(doc, /Book an on-site diagnostic/);
  if (!fork || !btnOf(doc, /Answer a few more questions/)) { P.push(id + ' x' + qty + ': the Fork is not on the card (entity ' + (route && route.entity && route.entity.id) + ')'); return { id, qty, V, P }; }
  V.displayed = dollars(text(fork.querySelector('.do-meta')));
  V.route = route.quote && route.quote.divergenceFee;
  V.policy = POLICY_FEE;
  tapOn(w, fork);
  V.pathB = dollars(text(doc.querySelector('.summary-estimate')));
  V.pathBText = text(doc.querySelector('.summary-estimate'));
  const before = subtotal(doc);
  const add = doc.getElementById('btn-curated-add');
  if (!add) { P.push(id + ' x' + qty + ': no add button on the Path B card'); return { id, qty, V, P }; }
  tapOn(w, add);
  const items = cartItems(w), line = items[items.length - 1] || {};
  V.cart = dollars(line.price); V.variant = line._variant; V.note = line.notes || '';
  V.delta = subtotal(doc) - before; V.due = dueToday(doc);
  const who = id + ' x' + qty;
  if (V.displayed == null) P.push(who + ': no fee on the Fork button');
  for (const [k, label] of [['route', 'the route quote (BookingContext)'], ['policy', 'the catalog fee policy'], ['pathB', 'the Path B card'], ['cart', 'the cart entry price'], ['delta', 'the cart subtotal change'], ['due', 'Due Today']])
    if (V[k] !== V.displayed) P.push(who + ': ' + label + ' is ' + V[k] + ' but the Fork showed ' + V.displayed);
  if (!/flat rate/i.test(V.pathBText)) P.push(who + ': the Path B card does not say flat rate ("' + V.pathBText + '")');
  if (V.variant !== 'onsite') P.push(who + ': the cart entry is not marked as the Fork-B line (_variant ' + V.variant + ')');
  if (!new RegExp('\\$' + V.displayed + ' diagnostic fee').test(V.note)) P.push(who + ': the booking note does not record the $' + V.displayed + ' fee ("' + V.note.slice(-110) + '")');
  return { id, qty, V, P };
}

// sqAddToCart(), the quote panel's add button, with the customer on Path B. State is seeded the way the existing divergence tests seed it.
function seedQuoteState(w, kind, key, onsite) {
  w.sqRestart();
  const S = w.S;                                                                  // after the restart: it may hand back a fresh session object
  if (kind === 'service') {
    const svc = w.DB.services.find(s => s.id === key);
    Object.assign(S, { qty: 1, intent: { key, category: svc.ui_taxonomy.category_id, label: svc.ui_taxonomy.display_name, qtyLabel: 'item' }, stype: 'Repair', answers: {}, detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: [], _svc: svc });
  } else {
    const parts = key.split('+'), cat = parts[0], stype = parts[parts.length - 1], grp = parts.length === 3 ? parts[1] : undefined;
    Object.assign(S, { qty: 1, intent: { key, category: cat, _groupId: grp, group: grp, label: 'Diagnostic', qtyLabel: 'item' }, stype, answers: {}, detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: [], _svc: null });
  }
  S._divergencePath = onsite ? 'onsite' : null; S.adlibConfirmed = false;
}
function measureQuoteAdd(w, kind, key) {
  const P = [], V = { key };
  for (const onsite of [true, false]) {
    clearCart(w); seedQuoteState(w, kind, key, onsite);
    const q = w.computeQuoteFromState(w.S);
    if (!q.isDiagnostic || !q.divergenceEligible) { P.push(key + ': not a Fork-eligible diagnostic on this page (isDiagnostic ' + q.isDiagnostic + ', eligible ' + q.divergenceEligible + ')'); return { key, V, P }; }
    V.fee = q.divergenceFee; V.labor = q.laborCalc;
    // restore the seeded state: computeQuoteFromState may normalise it, sqAddToCart reads it again
    w.sqAddToCart();
    const items = cartItems(w), line = items[items.length - 1] || {};
    if (onsite) {
      V.price = dollars(line.price); V.note = line.notes || ''; V.variant = line._variant;
      if (V.price !== V.fee) P.push(key + ': Path B through sqAddToCart carried $' + V.price + ' (the labor estimate is $' + V.labor + ') but the Fork shows $' + V.fee);
      if (!new RegExp('\\$' + V.fee + ' diagnostic fee').test(V.note)) P.push(key + ': the note does not record the $' + V.fee + ' fee');
      if (V.variant !== 'onsite') P.push(key + ': the entry is not marked as the Fork-B line');
    } else {
      // intent preserved: a diagnostic that did not go through the Fork is priced and noted as before
      if (dollars(line.price) !== q.laborCalc) P.push(key + ': without the Fork the entry carried $' + dollars(line.price) + ', the quote shows $' + q.laborCalc);
      if (/diagnostic fee/.test(line.notes || '')) P.push(key + ': without the Fork the entry still carries a Fork-B note');
      if (line._variant) P.push(key + ': without the Fork the entry is marked ' + line._variant);
    }
  }
  return { key, V, P };
}

// What the customer sees on the path the group fallbacks DO take: no Fork, the estimate on the panel is the estimate in the cart.
function measureDynamicPanel(w, doc, key) {
  const P = [];
  clearCart(w); seedQuoteState(w, 'dynamic', key, false);
  w.S._lastRoute = null;
  w.sqRenderQuote();
  const out = doc.getElementById('sqQuoteOut');
  const forkShown = /divergence-hub/.test(out.innerHTML);
  const m = /Total labor<\/span><span[^>]*>\$(\d+)/.exec(out.innerHTML);
  const shownTotal = m ? Number(m[1]) : null;
  const btn = out.querySelector('.ctap');
  if (!btn) P.push(key + ': no add button on the quote panel');
  else { tapOn(w, btn); const items = cartItems(w), line = items[items.length - 1] || {}; if (dollars(line.price) !== shownTotal) P.push(key + ': the panel showed $' + shownTotal + ', the cart took ' + line.price); }
  return { key, forkShown, shownTotal, P };
}

async function runAll(html, opts) {
  opts = opts || {};
  const dom = await openPage(html, DB0), w = dom.window, doc = w.document;
  const R = { roster: [], rosterDyn: [], curated: [], quoteAdd: [], dynPanel: [], notes: [], problems: [] };
  // the roster the page itself derives, to compare with the catalog's
  const st = (id, cat) => ({ qty: 1, intent: { key: id, category: cat, label: 'x', qtyLabel: 'item' }, stype: 'Repair', answers: {}, detTagIds: [], manTagIds: [], negatedTagIds: [] });
  for (const s of w.DB.services) { const q = w.computeQuoteFromState(st(s.id, s.ui_taxonomy.category_id)); if (q.isDiagnostic && q.divergenceEligible) R.roster.push(s.id); }
  for (const k of Object.keys(w.DB.dynamic_services || {})) {
    seedQuoteState(w, 'dynamic', k, false);
    let q; try { q = w.computeQuoteFromState(w.S); } catch (e) { continue; }
    if (q.isDiagnostic && q.divergenceEligible) R.rosterDyn.push(k);
  }
  const curated = opts.services || CURATED;
  for (const id of curated) for (const qty of (opts.quantities || [1, 3])) { const r = await measureCurated(w, doc, id, qty); R.curated.push(r); R.problems.push(...r.P); }
  if (!opts.skipQuoteAdd) {
    for (const id of (opts.services || CURATED)) { const r = measureQuoteAdd(w, 'service', id); R.quoteAdd.push(r); R.problems.push(...r.P); }
    for (const k of (opts.services ? [] : DYNAMIC)) { const r = measureQuoteAdd(w, 'dynamic', k); R.quoteAdd.push(r); R.problems.push(...r.P); }
    for (const k of (opts.services ? [] : DYNAMIC)) { const r = measureDynamicPanel(w, doc, k); R.dynPanel.push(r); R.problems.push(...r.P); }
  }
  // reported, not asserted: can a customer draw the quote panel after Path B on a curated route?
  if (!opts.services && !opts.skipQuoteAdd) {
    clearCart(w); await reachFork(w, doc, CURATED[0]); tapOn(w, btnOf(doc, /Book an on-site diagnostic/));
    const ad = doc.querySelector('.adlib-yes'); let hidden = !ad;
    for (let n = ad; n && n.style && !hidden; n = n.parentElement) if (n.style.display === 'none') hidden = true;
    R.notes.push('after Path B on ' + CURATED[0] + ' the quote panel\'s "Calculate Estimate" button is ' + (hidden ? 'hidden' : 'VISIBLE (a customer can now draw the quote panel after Path B: the invariant above is the guard)'));
  }
  dom.window.close();
  return R;
}

// A mutant is one exact, single-occurrence replacement (split/join, never String.replace: "$'" in a replacement string is a pattern there, and these edits are full of dollar signs).
function mutantHtml(label, from, to) {
  const n = QR_TEXT.split(from).length - 1;
  check('mutant "' + label + '" applies to exactly one place in the page source', n === 1, n + ' occurrences of: ' + from.slice(0, 80));
  return assemble(QR_TEXT.split(from).join(to), ROOT);
}

(async () => {
  console.log('verify_fork_fee_agreement.js');
  console.log('\n=== 1. the roster: who offers the Fork ===');
  check('the catalog names ' + CURATED.length + ' services whose checkout state is "diagnostic" with an authored second path: ' + CURATED.join(', '), CURATED.length >= 4, CURATED.join(','));
  check('and ' + DYNAMIC.length + ' group fallbacks that are diagnostics with an authored second path', DYNAMIC.length >= 20, String(DYNAMIC.length));
  check('the catalog has one fee policy: $' + POLICY_FEE, Number.isFinite(POLICY_FEE) && POLICY_FEE > 0, String(POLICY_FEE));

  const HTML = assemble(QR_TEXT, ROOT);
  const R = await runAll(HTML);
  console.log('\n=== 2. the real page: the fee on the Fork is the fee in the booking ===');
  check('the page\'s own Fork-eligible services are exactly the catalog\'s diagnostics: [' + R.roster.join(', ') + ']', JSON.stringify([...R.roster].sort()) === JSON.stringify([...CURATED].sort()), 'page ' + R.roster + ' vs catalog ' + CURATED);
  check('the page\'s Fork-eligible group fallbacks are the catalog\'s: ' + R.rosterDyn.length, JSON.stringify([...R.rosterDyn].sort()) === JSON.stringify([...DYNAMIC].sort()), 'page ' + R.rosterDyn.length + ' vs catalog ' + DYNAMIC.length);
  for (const r of R.curated) {
    const v = r.V;
    check(r.id + ' x' + r.qty + ': Fork $' + v.displayed + ' = route $' + v.route + ' = policy $' + v.policy + ' = Path B $' + v.pathB + ' = cart entry $' + v.cart + ' = subtotal +$' + v.delta + ' = Due Today $' + v.due + ', marked ' + v.variant + ', note records the fee', r.P.length === 0, r.P.join('\n'));
  }
  check('every one of the ' + R.curated.length + ' chains was measured to the end (the Fork was on the card each time)', R.curated.every(r => r.V.cart != null), R.curated.filter(r => r.V.cart == null).map(r => r.id + ' x' + r.qty).join(', '));

  console.log('\n=== 3. the quote panel\'s add button (sqAddToCart) on Path B, and the path the group fallbacks take ===');
  const qa = R.quoteAdd;
  const bad = qa.filter(r => r.P.length);
  check('all ' + qa.length + ' diagnostic entries (' + CURATED.length + ' services, ' + DYNAMIC.length + ' group fallbacks): Path B through sqAddToCart carries the Fork\'s fee and records it; without the Fork the entry is priced and noted as before', qa.length === CURATED.length + DYNAMIC.length && bad.length === 0, bad.slice(0, 5).map(r => r.P[0]).join('\n') + (bad.length > 5 ? '\n… ' + (bad.length - 5) + ' more' : ''));
  const dp = R.dynPanel, dbad = dp.filter(r => r.P.length || r.forkShown || r.shownTotal == null);
  check('the ' + dp.length + ' group fallbacks show no Fork (no live route) and the total on their quote panel is the price the cart takes', dp.length === DYNAMIC.length && dbad.length === 0, dbad.slice(0, 5).map(r => r.key + ': ' + (r.P[0] || ('fork ' + r.forkShown + ', total ' + r.shownTotal))).join('\n'));
  for (const n of R.notes) console.log('     (reported) ' + n);

  console.log('\n=== 4. non-vacuity: a deliberately mismatched fee fails the test ===');
  const SMALL = { services: ['dishwasher_repair'], quantities: [1], skipQuoteAdd: true };
  { // the curated card carries the labor estimate instead of the fee
    const h = mutantHtml('the curated card adds the labor estimate, not the fee', "price: '$' + (onsite ? terms.fee : q.laborEstimate),", "price: '$' + q.laborEstimate,");
    const r = await runAll(h, SMALL);
    check('  -> the cart entry disagrees with the Fork (' + r.problems.length + ' violation(s)): ' + (r.problems[0] || '').slice(0, 90), r.problems.some(p => /cart entry price|subtotal|Due Today/.test(p))); }
  { // the terms' fee drifts away from the one the Fork displays
    const h = mutantHtml('onsiteDiagnosticTerms returns a fee $5 higher than the Fork shows', "            return {\n                fee,\n                label: dr.onsite_price_label", "            return {\n                fee: fee + 5,\n                label: dr.onsite_price_label");
    const r = await runAll(h, SMALL);
    check('  -> Path B and the cart carry a fee the Fork never showed (' + r.problems.length + '): ' + (r.problems[0] || '').slice(0, 90), r.problems.some(p => /Path B card|cart entry price/.test(p))); }
  { // the Fork shows a different fee than the route holds
    const h = mutantHtml('the Fork button shows the fee + $10', "'<div class=\"do-meta\">$' + fee + ", "'<div class=\"do-meta\">$' + (fee + 10) + ");
    const r = await runAll(h, SMALL);
    check('  -> the displayed fee disagrees with the route\'s (' + r.problems.length + '): ' + (r.problems[0] || '').slice(0, 90), r.problems.some(p => /route quote|catalog fee policy/.test(p))); }
  { // sqAddToCart carries the estimate again (the defect this test found)
    const h = mutantHtml('sqAddToCart writes the labor estimate as the Fork-B price (the pre-T180-6 behaviour)', "price: '$' + (_onsiteTerms ? _onsiteTerms.fee : q.laborCalc),", "price: '$' + q.laborCalc,");
    const r = await runAll(h, { services: ['dishwasher_repair'], quantities: [1] });
    check('  -> Path B through sqAddToCart carries the estimate, not the fee (' + r.problems.length + '): ' + (r.problems[0] || '').slice(0, 100), r.problems.some(p => /through sqAddToCart carried/.test(p))); }
  { // the booking note drops the fee
    const h = mutantHtml('the booking note drops the fee', "bookingNote: 'On-site diagnostic booked via Fork-in-the-Road: $' + fee + ' diagnostic fee. ' +", "bookingNote: 'On-site diagnostic booked via Fork-in-the-Road: ' + ' diagnostic fee. ' +");
    const r = await runAll(h, { services: ['dishwasher_repair'], quantities: [1] });
    check('  -> the note no longer records the fee (' + r.problems.length + '): ' + (r.problems[0] || '').slice(0, 90), r.problems.some(p => /note does not record/.test(p))); }

  console.log('\n[fork fee agreement] ' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail > 0 ? 1 : 0);
})().catch(err => { console.error(err); process.exit(2); });
