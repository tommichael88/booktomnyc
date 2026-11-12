#!/usr/bin/env node
/**
 * verify_review_request_honest.js -- T198 (K1): a review request that cannot be transmitted is never presented as sent, and is never an ordinary $0 booking.
 *
 * Before: finalizeBooking() toasted "Booking confirmed! (demo)", emptied the cart and thanked the customer; nothing was sent anywhere (the page has no submission channel). A "Request a review quote"
 * line read as a request someone would answer; asked for twice it became "x 2" (240 shelves); the stated quantity and review status were discarded with the cart.
 * After: the overlay says so before the button; the button prepares the request (it does not "book"); the completion state says "Not sent yet ... Nothing has been sent to BookTOM, and no one has been
 * notified", lists every line (review lines "needs a review quote (not priced)", stated quantity kept), keeps the cart, and offers the customer's own text/email/copy. Also: the same stated scope asked
 * twice is one line; a lone trailing number ("mount shelf 120") is asked about, not priced as one unit.
 *   A. SOURCE      finalizeBooking has no "Booking confirmed" / "Thank you" and does not empty the cart.
 *   B. THE PAGE    real browser: mixed cart (two review lines, one priced) -> overlay notice, button, total "$1910 + 2 to be quoted", completion panel, cart intact with reviewRequired and stated scope.
 *   C. AMBIGUITY   "mount shelf 120" asks (no price, no Add); model/inch/room/plural-count/supported-count forms do not; each answer lands where it should.
 *   D. NON-VACUITY the old completion wording planted back is caught by A.
 */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { execSync } = require('child_process');
const PAGE = require('./_page.js');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..');
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (detail ? '\n      ' + String(detail).split('\n').join('\n      ') : '')); } };
function findChrome() { const c = [process.env.CHROME_PATH, ...(() => { try { return execSync('find /home/*/.cache/puppeteer /root/.cache/puppeteer -type f -name chrome 2>/dev/null || true', { shell: '/bin/bash' }).toString().trim().split('\n').filter(Boolean); } catch { return []; } })(), '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'].filter(Boolean); return c.find(p => fs.existsSync(p)) || null; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HTML = path.join(ROOT, 'qr.html'), DATA = fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8');
const src = fs.readFileSync(HTML, 'utf8');

// A. source
const fb = () => { const a = src.indexOf('function finalizeBooking()'); return src.slice(a, src.indexOf('function prefillSmartQuoteFromOtherTile')); };
const honest = body => !/Booking confirmed/.test(body) && !/Thank you for your request/.test(body) && !/serviceRequest:\s*\[\]/.test(body) && /Nothing has been sent to BookTOM/.test(body);
console.log('A. the completion state is honest (source)');
check('A1 finalizeBooking does not say booked / thank you, does not empty the cart, and says nothing was sent', honest(fb()));
check('A2 the final button no longer says BOOK', !/id="finalBookBtn"[^>]*>[^<]*BOOK/.test(src) && /id="cartPreviewNotice"/.test(src));
console.log('D. non-vacuity: the old completion planted back');
check('D1 the old finalizeBooking is caught by A1', !honest(fb().replace("toast(\"Nothing was sent — this page can't submit requests yet.\", 'error');", "toast('Booking confirmed! (demo)', 'success'); window.__store.dispatch({type:'cart/SET',payload:{serviceRequest: []}});")));

(async () => {
  let puppeteer = null; try { puppeteer = require('puppeteer-core'); } catch { /* below */ }
  const chromePath = findChrome();
  if (!chromePath || !puppeteer) { check('a browser is required', false, 'No Chrome or puppeteer-core. This test FAILS rather than skipping (DEFECT-SILENT-SKIP).'); console.log(`\n[review request honest] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`); process.exit(1); }
  const browser = await puppeteer.launch({ headless: 'new', executablePath: chromePath, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage(); const errors = new Set();
  await page.setViewport({ width: 1280, height: 2400 }); await page.setRequestInterception(true);
  page.on('request', r => { const d = PAGE.documentResponse(r.url()); if (d) return r.respond(d); r.url().includes('btnyc.json') ? r.respond({ status: 200, contentType: 'application/json', body: DATA }) : r.continue(); });
  page.on('pageerror', e => errors.add(String(e.message).slice(0, 140)));
  await page.goto('file://' + HTML, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction(() => window.DB && window.DB.services, { timeout: 20000 });
  const type = async say => { await page.evaluate(() => { try { sqRestart(); } catch (e) {} document.getElementById('sqDescIn').value = ''; }); await page.click('#sqDescIn'); await page.type('#sqDescIn', say, { delay: 2 }); await page.click('#sqUnifiedActionBtn'); await sleep(1300); };
  const click = async sel => { await page.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); }, sel); await sleep(900); };
  const intake = () => page.evaluate(() => { const e = document.getElementById('intakeQuestionsContainer'); return e ? e.innerText.replace(/\s+/g, ' ') : ''; });
  const cart = () => page.evaluate(() => window.__store.getState().cart.serviceRequest.map(i => ({ name: i.name, price: i.price, review: !!i.reviewRequired, qty: i.qty || 1, units: i.intakeAnswers && i.intakeAnswers.__qty, scope: i.intakeAnswers && i.intakeAnswers.__stated_scope })));

  console.log('\nC. a lone trailing number is asked about');
  const asks = t => /how many you want\?/.test(t) && !/ADD TO REQUEST/i.test(t) && !/Estimated labor: \$/.test(t);
  await type('mount shelf 120'); let t = await intake();
  check('C1 "mount shelf 120": asks whether 120 is how many (no price, no Add)', asks(t), t.slice(0, 300));
  for (const [say, why] of [['mount shelf model 120', 'a model'], ['mount a 120-inch shelf', 'a dimension'], ['install shelves in room 120', 'a room'], ['mount 12 shelves', 'a supported count'], ['mount 120 shelves', 'a stated large count (the J1 notice, not this question)']]) {
    await type(say); t = await intake();
    check(`C2 "${say}" (${why}) does not get the which-is-it question`, !/how many you want\?/.test(t), t.slice(0, 200));
  }
  await type('mount 12 shelves'); t = await intake(); check('C3 "mount 12 shelves" keeps its ordinary price and Add', /\$1910/.test(t) && /ADD TO REQUEST/i.test(t), t.slice(0, 300));
  await type('mount 120 shelves'); t = await intake(); check('C4 "mount 120 shelves" keeps the J1 review notice', /You asked for 120 shelves/.test(t), t.slice(0, 300));
  await type('mount shelf 12'); await click('#btn-scope-count'); t = await intake();
  check('C5 "mount shelf 12" -> "Yes, 12 of them" prices exactly twelve (as typing "mount 12 shelves")', /\$1910/.test(t) && /ADD TO REQUEST/i.test(t), t.slice(0, 300));
  await type('mount shelf 12'); await click('#btn-scope-notcount'); t = await intake();
  check('C6 "mount shelf 12" -> "it\'s a model or label" is the one-unit quote', /\$159/.test(t), t.slice(0, 300));
  await type('mount shelf 120'); await click('#btn-scope-count'); t = await intake();
  check('C7 "mount shelf 120" -> "Yes" is a review request (no price, "Quote after review")', /Quote after review/.test(t) && !/Estimated labor: \$/.test(t), t.slice(0, 300));

  console.log('\nB. the real cart and completion state');
  await page.evaluate(() => window.__store.dispatch({ type: 'cart/SET', payload: { serviceRequest: [] } }));
  await type('mount 120 shelves'); await click('#btn-scope-review'); await click('#btn-curated-add');
  await type('mount 120 shelves'); await click('#btn-scope-review'); await click('#btn-curated-add');
  let c = await cart();
  check('B1 asking for the same 120 shelves twice is ONE line, not "x 2"', c.length === 1 && c[0].qty === 1 && c[0].review, JSON.stringify(c));
  await type('mount 150 shelves'); await click('#btn-scope-review'); await click('#btn-curated-add');
  await type('mount 12 shelves'); await click('#btn-curated-add');
  c = await cart();
  check('B2 mixed cart: two review lines (120, 150) kept apart and one priced line, stated scope and review status preserved', c.length === 3 && c.filter(x => x.review).length === 2 && /120/.test(c[0].scope) && /150/.test(c[1].scope) && !c[2].review && c[2].units === 12, JSON.stringify(c));
  await page.evaluate(() => openCartOverlay()); await sleep(600);
  const ov = await page.evaluate(() => ({ text: document.getElementById('cartOverlay').innerText.replace(/\s+/g, ' '), btn: document.getElementById('finalBookBtn').innerText, notice: !!document.getElementById('cartPreviewNotice') && document.getElementById('cartPreviewNotice').getClientRects().length > 0 }));
  check('B3 the overlay says, before the button, that this page cannot send requests', ov.notice && /can't send requests yet/.test(ov.text), ov.text.slice(0, 200));
  check('B4 the button does not say BOOK', !/BOOK/i.test(ov.btn), ov.btn);
  check('B5 the total never reads a review line as $0: "$1910 + 2 to be quoted"', /\$1910 \+ 2 to be quoted/.test(ov.text), ov.text.slice(-300));
  await page.evaluate(() => { const k = document.getElementById('termsCheckbox'); k.checked = true; k.onchange && k.onchange(); }); await click('#finalBookBtn');
  const done = await page.evaluate(() => { const p = document.getElementById('requestNotSent'); return p ? p.innerText.replace(/\s+/g, ' ') : null; });
  check('B6 the completion state says nothing was sent and no one was notified', !!done && /Not sent yet/.test(done) && /Nothing has been sent to BookTOM/.test(done) && /no one has been notified/.test(done), done);
  check('B7 it lists the review lines as not priced and the priced line with its quantity', !!done && /120.*needs a review quote \(not priced\)/.test(done) && /150.*needs a review quote \(not priced\)/.test(done) && /× 12 — \$1910/.test(done), done);
  check('B8 it says how many are to be quoted, not that anyone will respond', !!done && /2 to be quoted/.test(done) && !/will (review|respond|contact|get back)/i.test(done) && !/we('|’)ll (review|respond|contact|get back)/i.test(done), done);
  const after = await cart();
  check('B9 the cart is kept: same three lines, review status and stated scope intact', JSON.stringify(after) === JSON.stringify(c), JSON.stringify(after));
  check('B10 no "booked" toast', !(await page.evaluate(() => /Booking confirmed|Thank you for your request/.test(document.body.innerText))));
  await click('#requestNotSent .request-not-sent-actions button:last-child');
  check('B11 "Back to my list" returns to the list', await page.evaluate(() => !document.getElementById('requestNotSent') && !document.querySelector('.cart-modal-content.not-sent')));
  check('B12 no uncaught page error', errors.size === 0, [...errors].join(' | '));
  await browser.close();
  console.log(`\n[review request honest] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message); process.exit(2); });
