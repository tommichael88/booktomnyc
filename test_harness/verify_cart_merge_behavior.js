#!/usr/bin/env node
/**
 * verify_cart_merge_behavior.js -- what the customer sees when they tap "Add to Request" more than once (the cart's merge rule, through the real interface), T158.
 *
 * @enforces R-INVARIANT-BEHAVIORAL, R-INVARIANT-CANONICAL, R-DOMAIN-SHAPE
 *
 * WHY THIS EXISTS. verify_cart_logic.js holds the rule on the module in isolation. A rule held only there can be right while the page is wrong (P-GOVERN-GOODHART: test the rule's own
 * mechanism, and the customer's experience of it). Driving the real cart found two defects the unit tests could not see, because both were in how the page USED the module:
 *   (1) the cart merged two identical taps into "qty 2", but the summary, the overlay and the total all ignored qty -- the customer tapped twice and was quoted once;
 *   (2) the line identity omitted a priced fact: three shelves ($478) and then one shelf ($159), same service and same answers, merged into ONE line at $478 -- the second request vanished.
 * Named defect class: DEFECT-UNPRICED-IDENTITY (an identity that leaves out something the price depends on; a stored count that nothing reads).
 *
 * WHAT IT DRIVES (real Chromium; real mouse clicks on real chips, steppers, the Add button and the cart button; no state is poked except emptying the cart between scenarios):
 *   A. POPULATION  -- computed from the catalog: every service whose curated card shows chip questions and an Add button, and every service with a quantity stepper. Floors, so "every" means something.
 *   B. SAME TAP TWICE (a spread sample of the chip population) -- answer, Add, come back, answer the same way, Add:
 *        ONE line; the summary line says "<price> x 2"; the total is exactly twice the price the card showed; the cart overlay shows the same line and the same total;
 *        the price on the line is the price the card showed (nothing recomputed).
 *   C. DIFFERENT ANSWER -- the same service answered another way is a SECOND line, and the total is the two prices the cards showed.
 *   D. SAME ANSWERS, DIFFERENT QUANTITY (every quantity-stepper service) -- three, then one: TWO lines, each at the price its card showed, and the total is both.
 *   E. NON-VACUITY -- four mutants of the PAGE (the amount dropped from the identity, the total ignoring qty, the line wording ignoring qty, the answers dropped from the identity) are each
 *      driven through the same scenarios and each must trip ITS OWN check.
 */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { execSync } = require('child_process');
const PAGE = require('./_page.js');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..');
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (detail ? '\n      ' + String(detail).split('\n').join('\n      ') : '')); } };
function findChrome() { const c = [process.env.CHROME_PATH, ...(() => { try { return execSync('find /home/*/.cache/puppeteer /root/.cache/puppeteer -type f -name chrome 2>/dev/null || true', { shell: '/bin/bash' }).toString().trim().split('\n').filter(Boolean); } catch { return []; } })(), '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'].filter(Boolean); return c.find(p => fs.existsSync(p)) || null; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dollars = s => { const m = String(s == null ? '' : s).match(/(\d+(?:\.\d+)?)/); return m ? Math.round(parseFloat(m[1])) : null; };   // the test's own reader of what the SCREEN says

const HTML = path.join(ROOT, 'qr.html');
const DATA = fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8');
const SAMPLE_SIZE = Number(process.env.CART_MERGE_SAMPLE || 8);

async function open(puppeteer, chromePath, htmlPath) {
  const browser = await puppeteer.launch({ headless: 'new', executablePath: chromePath, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage(); const errors = new Set();
  await page.setViewport({ width: 1280, height: 2400 }); await page.setRequestInterception(true);
  page.on('request', r => { const d = PAGE.documentResponse(r.url()); if (d) return r.respond(d); r.url().includes('btnyc.json') ? r.respond({ status: 200, contentType: 'application/json', body: DATA }) : r.continue(); });
  page.on('pageerror', e => errors.add(String(e.message).slice(0, 140)));
  await page.goto('file://' + htmlPath, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction(() => window.DB && window.DB.services, { timeout: 20000 });
  return { browser, page, errors };
}

// ---- in-page helpers (each is one thing a customer does or sees) ----
const emptyCart = page => page.evaluate(() => { window.__store.dispatch({ type: 'cart/SET', payload: { serviceRequest: [] } }); if (typeof renderCart === 'function') renderCart(); });
const showCard = async (page, id) => { await page.evaluate((id) => { try { sqRestart(); } catch (e) {} const svc = DB.services.find(x => x.id === id); const ctx = collectBookingContext_catalog(svc, svc.ui_taxonomy.category_id); window._currentContext = ctx; renderRoute(executeWorkflow(ctx, DB)); }, id); await sleep(220); };
const cardPrice = page => page.evaluate(() => { const e = document.querySelector('#intakeQuestionsContainer .price-value'); return e ? e.innerText : null; });
async function clickChip(page, mod, label) {
  const h = await page.evaluateHandle((mod, label) => [...document.querySelectorAll('#intakeQuestionsContainer .ims-chip')].find(b => b.dataset.mod === mod && b.dataset.label === label) || null, mod, label);
  const el = h.asElement(); if (!el) return false; await el.click(); await sleep(220); return true;
}
async function clickStepper(page, delta) { const el = await page.$(`.ims-qty-btn[data-qty-delta="${delta}"]`); if (!el) return false; await el.click(); await sleep(180); return true; }
async function tapAdd(page) { const el = await page.$('#btn-curated-add'); if (!el) return false; await el.click(); await sleep(450); return true; }
// what the page SHOWS and holds after the taps: the store's lines, the summary's lines, and the two totals (summary + overlay, the overlay opened with a real click on the cart button)
async function readCart(page) {
  const store = await page.evaluate(() => window.__store.getState().cart.serviceRequest.map(i => ({ id: i.serviceId, price: i.price, qty: i.qty, answers: i.intakeAnswers || null })));
  const summary = await page.evaluate(() => ({ lines: [...document.querySelectorAll('#serviceRequestList .summary-service-item')].map(e => (e.querySelector('.summary-service-price') || {}).textContent || ''), notes: [...document.querySelectorAll('#serviceRequestList .summary-service-item')].map(e => (e.querySelector('.service-notes') || {}).textContent || ''), total: (document.querySelector('#totalAmount') || {}).textContent || '' }));
  let overlay = { lines: [], total: '' };
  const fab = await page.$('#cartFab');
  if (fab && await page.evaluate(() => { const e = document.querySelector('#cartFab'); return !!(e && e.offsetHeight > 0 && getComputedStyle(e).display !== 'none'); })) {
    await fab.click(); await sleep(300);
    overlay = await page.evaluate(() => ({ lines: [...document.querySelectorAll('#cartServiceList .cart-service-item .cart-service-price')].map(e => e.textContent), total: (document.querySelector('#cartTotal') || {}).textContent || '' }));
    await page.evaluate(() => { try { closeCartOverlay(); } catch (e) {} }); await sleep(120);
  }
  return { store, summary, overlay };
}

// ---- the scenarios ----
async function population(page) {
  return page.evaluate(() => {
    const chips = [], steppers = [];
    for (const svc of DB.services) {
      try {
        sqRestart(); const ctx = collectBookingContext_catalog(svc, svc.ui_taxonomy.category_id); window._currentContext = ctx; renderRoute(executeWorkflow(ctx, DB));
        const first = [...document.querySelectorAll('#intakeQuestionsContainer .ims-chip')];
        const add = !!document.querySelector('#btn-curated-add');
        if (add && first.length) {
          const mod = first[0].dataset.mod, labels = first.filter(b => b.dataset.mod === mod).map(b => b.dataset.label);
          if (labels.length >= 2) chips.push({ id: svc.id, mod, a: labels[0], b: labels[1] });
        }
        if (add && document.querySelector('.ims-qty-btn')) steppers.push(svc.id);
      } catch (e) { /* a service with no curated card is simply not in the population */ }
    }
    return { chips, steppers };
  });
}
const spread = (arr, n) => { if (arr.length <= n) return arr.slice(); const out = []; for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * arr.length / n)]); return out; };

async function drive(puppeteer, chromePath, htmlPath, opts) {
  opts = opts || {};
  const { browser, page, errors } = await open(puppeteer, chromePath, htmlPath);
  const out = { errors, pop: null, same: [], diff: [], qty: [] };
  try {
    out.pop = await population(page);
    const sample = opts.sample || spread(out.pop.chips, SAMPLE_SIZE);
    // B + C
    for (const s of sample) {
      const row = { id: s.id };
      await emptyCart(page);
      await showCard(page, s.id); row.clickedA1 = await clickChip(page, s.mod, s.a); row.p1 = await cardPrice(page); row.added1 = await tapAdd(page);
      row.afterOne = await readCart(page);
      await showCard(page, s.id); row.clickedA2 = await clickChip(page, s.mod, s.a); row.p2 = await cardPrice(page); row.added2 = await tapAdd(page);
      row.afterTwo = await readCart(page);
      await showCard(page, s.id); row.clickedB = await clickChip(page, s.mod, s.b); row.p3 = await cardPrice(page); row.added3 = await tapAdd(page);
      row.afterThree = await readCart(page);
      out.same.push(row);
    }
    // D
    if (!opts.skipQty) for (const id of out.pop.steppers) {
      const row = { id }; await emptyCart(page);
      await showCard(page, id); await clickStepper(page, 1); await clickStepper(page, 1); row.p3 = await cardPrice(page); row.added1 = await tapAdd(page);
      await showCard(page, id); row.p1 = await cardPrice(page); row.added2 = await tapAdd(page);
      row.after = await readCart(page); out.qty.push(row);
    }
  } finally { await browser.close(); }
  return out;
}

// ---- the judgments, one per behavior (each returns [ok, detail]) ----
const J = {
  firstTap: r => { const s = r.afterOne.store; const ok = r.clickedA1 && r.added1 && s.length === 1 && (s[0].qty || 1) === 1 && dollars(s[0].price) === dollars(r.p1); return [ok, `${r.id}: lines ${s.length}, qty ${s[0] && s[0].qty}, line ${s[0] && s[0].price}, card said ${r.p1}`]; },
  oneLine: r => { const s = r.afterTwo.store; return [r.clickedA2 && r.added2 && s.length === 1 && s[0].qty === 2, `${r.id}: ${s.length} line(s), qty ${s.map(x => x.qty).join('/')} (card said ${r.p1} then ${r.p2})`]; },
  linePriceKept: r => { const s = r.afterTwo.store; return [s.length === 1 && dollars(s[0].price) === dollars(r.p1) && dollars(r.p1) === dollars(r.p2), `${r.id}: line ${s[0] && s[0].price}, cards said ${r.p1} / ${r.p2}`]; },
  summaryWording: r => { const l = r.afterTwo.summary.lines; return [l.length === 1 && /×\s*2\b/.test(l[0]) && dollars(l[0]) === dollars(r.p1), `${r.id}: summary lines ${JSON.stringify(l)} (want "<price> × 2")`]; },
  summaryTotal: r => [dollars(r.afterTwo.summary.total) === 2 * dollars(r.p1), `${r.id}: summary total ${r.afterTwo.summary.total}, want twice ${r.p1} = $${2 * dollars(r.p1)}`],
  overlayTotal: r => [r.afterTwo.overlay.lines.length === 1 && /×\s*2\b/.test(r.afterTwo.overlay.lines[0]) && dollars(r.afterTwo.overlay.total) === 2 * dollars(r.p1), `${r.id}: overlay lines ${JSON.stringify(r.afterTwo.overlay.lines)} total ${r.afterTwo.overlay.total}, want "× 2" and $${2 * dollars(r.p1)}`],
  otherAnswer: r => { const s = r.afterThree.store; return [r.clickedB && r.added3 && s.length === 2 && s[0].qty === 2 && (s[1].qty || 1) === 1 && dollars(s[1].price) === dollars(r.p3), `${r.id}: ${s.length} line(s) [${s.map(x => x.price + '×' + x.qty).join(', ')}], third card said ${r.p3}`]; },
  otherTotal: r => [dollars(r.afterThree.summary.total) === 2 * dollars(r.p1) + dollars(r.p3) && dollars(r.afterThree.overlay.total) === 2 * dollars(r.p1) + dollars(r.p3), `${r.id}: totals ${r.afterThree.summary.total} / ${r.afterThree.overlay.total}, want $${2 * dollars(r.p1) + dollars(r.p3)}`],
  qtyTwoLines: r => { const s = r.after.store; return [r.added1 && r.added2 && s.length === 2 && dollars(s[0].price) === dollars(r.p3) && dollars(s[1].price) === dollars(r.p1), `${r.id}: ${s.length} line(s) [${s.map(x => x.price + '×' + x.qty).join(', ')}], cards said ${r.p3} (three) then ${r.p1} (one) -- equal prices (a visit minimum) must NOT merge three and one`]; },
  qtyWording: r => { const l = r.after.summary.notes; return [l.length === 2 && /Quantity:\s*3\b/.test(l[0]) && !/Quantity:/.test(l[1]), `${r.id}: the lines' notes read ${JSON.stringify(l)} (want "Quantity: 3" on the first and none on the second)`]; },
  qtyTotal: r => [dollars(r.after.summary.total) === dollars(r.p3) + dollars(r.p1) && dollars(r.after.overlay.total) === dollars(r.p3) + dollars(r.p1), `${r.id}: totals ${r.after.summary.total} / ${r.after.overlay.total}, want $${dollars(r.p3) + dollars(r.p1)}`],
};
const judgeAll = (name, rows, key) => { const bad = rows.map(r => ({ r, j: J[key](r) })).filter(x => !x.j[0]); return [bad.length === 0 && rows.length > 0, bad.map(x => x.j[1]).slice(0, 4).join('\n')]; };

function report(real) {
  const ch = real.same, qt = real.qty;
  check(`A. the chip population is large (${real.pop.chips.length} services show chip questions and an Add button; floor 20) and the quantity-stepper population is real (${real.pop.steppers.length}; floor 8)`, real.pop.chips.length >= 20 && real.pop.steppers.length >= 8, `chips ${real.pop.chips.length}, steppers ${real.pop.steppers.length}`);
  check(`A. the sample driven is real (${ch.length} chip services, spread across the catalog; floor ${Math.min(SAMPLE_SIZE, 8)})`, ch.length >= Math.min(SAMPLE_SIZE, 8), String(ch.length));
  let r;
  r = judgeAll('first', ch, 'firstTap'); check('B. the first tap puts ONE line in the cart, qty 1, at the price the card showed', r[0], r[1]);
  r = judgeAll('one', ch, 'oneLine'); check('B. the same answers tapped a second time are still ONE line, now qty 2', r[0], r[1]);
  r = judgeAll('kept', ch, 'linePriceKept'); check('B. that line keeps the price the card showed (unit price; nothing recomputed or compounded)', r[0], r[1]);
  r = judgeAll('wording', ch, 'summaryWording'); check('B. the summary line SAYS it was requested twice: "<price> × 2"', r[0], r[1]);
  r = judgeAll('stotal', ch, 'summaryTotal'); check('B. the summary total is exactly twice the price the card showed (a second tap is not free)', r[0], r[1]);
  r = judgeAll('ototal', ch, 'overlayTotal'); check('B. the cart overlay agrees: one line "× 2" and the same total', r[0], r[1]);
  r = judgeAll('other', ch, 'otherAnswer'); check('C. the same service answered another way is a SECOND line (the first stays at qty 2), at the price its own card showed', r[0], r[1]);
  r = judgeAll('otot', ch, 'otherTotal'); check('C. the totals are both lines: twice the first price plus the second', r[0], r[1]);
  r = judgeAll('qty2', qt, 'qtyTwoLines'); check(`D. ${qt.length} quantity-stepper services: three, then one, same answers -> TWO lines, each at its own card's price (the $159 request does not vanish into the $478 line)`, r[0], r[1]);
  r = judgeAll('qtyw', qt, 'qtyWording'); check('D. and each line SAYS how many it is for: "Quantity: 3" on the three-line, nothing on the one-line (the technician is told the count)', r[0], r[1]);
  r = judgeAll('qtyt', qt, 'qtyTotal'); check('D. and the total is both prices', r[0], r[1]);
  check('no uncaught page error while driving all of it', real.errors.size === 0, [...real.errors].join(' | '));
}

// the mutant needs only the scenarios it targets: the first few chip services, and (for the amount mutant) the steppers
const MUTANTS = [
  { name: 'the quantity is not recorded on the line', expect: ['qtyTwoLines', 'qtyWording'], anchor: '...(!onsite && _unitsPriced !== null ? { __qty: _unitsPriced } : {})', to: '' },
  { name: 'the total ignores qty', expect: ['summaryTotal', 'overlayTotal'], anchor: 'cartLineAmount(it) * cartLineQty(it)', to: 'cartLineAmount(it)' },
  { name: 'the line wording ignores qty', expect: ['summaryWording'], anchor: "return n > 1 ? shown + ' \\u00d7 ' + n : shown;", to: 'return shown;' },
  { name: 'the answers dropped from the line identity', expect: ['otherAnswer'], anchor: /\n\s*answersPart,\n/, to: "\n        '',\n" },
];

(async () => {
  const chromePath = findChrome(); let puppeteer = null; try { puppeteer = require('puppeteer-core'); } catch { /* handled below */ }
  console.log('verify_cart_merge_behavior: tapping Add to Request more than once, through the real interface\n');
  if (!chromePath || !puppeteer) {
    check('a browser is required', false, (!chromePath ? 'No Chrome/Chromium binary found' : 'puppeteer-core not installed') + '. This test FAILS rather than skipping: set CHROME_PATH (e.g. /opt/pw-browsers/chromium). Silent skipping would be a false statement of coverage (DEFECT-SILENT-SKIP).');
    console.log(`\n[cart merge behavior] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`); process.exit(1);
  }
  const real = await drive(puppeteer, chromePath, HTML);
  report(real);

  console.log('\nE. non-vacuity: each mutant of the page must trip its own check');
  const src = PAGE.readPage(HTML), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cartmerge-'));
  for (const m of MUTANTS) {
    const hits = typeof m.anchor === 'string' ? src.split(m.anchor).length - 1 : (src.match(new RegExp(m.anchor.source, 'g')) || []).length;
    if (hits !== 1) { check(`mutant "${m.name}": its anchor is in the page exactly once`, false, `found ${hits}`); continue; }
    const f = path.join(tmp, 'mutant.html'); fs.writeFileSync(f, src.replace(m.anchor, () => m.to));
    // the answers mutant can only show itself where the two answers quote the SAME price (otherwise the amount keeps the lines apart): sample those, taken from the real run
    const samePriced = real.same.filter(x => dollars(x.p1) === dollars(x.p3)).map(x => real.pop.chips.find(c => c.id === x.id)).filter(Boolean);
    if (m.expect.includes('otherAnswer')) check('E. the real run has services whose two answers quote the same price (so the answers mutant is reachable)', samePriced.length >= 1, 'none in the sample');
    const mut = await drive(puppeteer, chromePath, f, { sample: m.expect.includes('otherAnswer') ? samePriced.slice(0, 3) : spread(real.pop.chips, 3), skipQty: !m.expect.some(k => k.startsWith('qty')) });
    const rows = k => (k.startsWith('qty') ? mut.qty : mut.same);
    const tripped = m.expect.filter(k => !judgeAll(k, rows(k), k)[0]);
    check(`MUTANT (${m.name}) is caught by [${m.expect.join(', ')}]`, tripped.length === m.expect.length, `tripped only: ${tripped.join(', ') || 'none'}`);
  }
  console.log(`\n[cart merge behavior] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR', e.stack || e.message); process.exit(2); });
