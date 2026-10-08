#!/usr/bin/env node
/**
 * verify_quantity_control_curated_card.js -- a price that scales with quantity must come with a way to enter the quantity (dumb UI: the card is a pure render of the route).
 *
 * Found at T152/T153: the curated card drew only chip questions (`if (!responses.length) return;`), so a numeric quantity module was never drawn. TEN services quote a price that scales
 * with quantity (stance 'batched') and have such a module, and on every one a customer could see $159 but could not say "I have three shelves": cabinet_knob_or_pull_install,
 * furniture_disassembly_for_moving, furniture_repair_hourly, loose_tile_replacement, scratch_or_water_ring_removal, both shelf-mounting services, smart_speaker_setup,
 * generic_mounting_service and pax_wardrobe_assembly. (My own T151 browser check "found" a stepper on shelf mounting because its selector matched ANY <button>, including Add to Request.)
 * The population is computed from the data, not listed, so a new service with the same shape is covered automatically:
 *   1. LOGIC     -- orch_apply_quantity: price is non-decreasing in quantity and strictly higher at 3 than at 1; out-of-range input clamps; the route reports the quantity it priced;
 *   2. POPULATION-- the set of affected services is large enough that "every one" means something;
 *   3. CONTROL   -- for EACH of them, in a real browser with strict visibility: both buttons are visible; "+" raises the displayed quantity and the displayed price; "-" lowers them
 *                   and never goes below one; no page error;
 *   4. CART      -- the quantity reaches the cart: after setting three, Add to Request puts an item in the cart whose price is the price on the card;
 *   5. MUTANT    -- a renderer that does not draw the control is caught.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os'), { execSync } = require('child_process');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..');
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log('  \u2713 ' + name); } else { fail++; console.log('  \u2717 ' + name + (detail ? '\n      ' + detail : '')); } };
function findChrome() { const c = [process.env.CHROME_PATH, ...(() => { try { return execSync('find /home/*/.cache/puppeteer /root/.cache/puppeteer -type f -name chrome 2>/dev/null || true', { shell: '/bin/bash' }).toString().trim().split('\n').filter(Boolean); } catch { return []; } })(), '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'].filter(Boolean); return c.find(p => fs.existsSync(p)) || null; }
const VIS = `(sel)=>{const e=typeof sel==='string'?document.querySelector(sel):sel; if(!e||!e.getClientRects().length||e.offsetHeight<=0) return false; const r=e.getBoundingClientRect(); const t=document.elementFromPoint(r.left+Math.min(r.width/2,20), r.top+Math.min(r.height/2,8)); return !!(t&&(e===t||e.contains(t)));}`;

// ---- 1. LOGIC (node, no browser) ----
const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
const sb = { DB, SERVICE_DATA: DB, window: { DB }, console: { log() {}, warn() {}, error() {}, info() {} } }; sb.global = sb; vm.createContext(sb);
for (const f of ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
const routeOf = s => sb.executeWorkflow(sb.collectBookingContext_catalog(s, s.ui_taxonomy.category_id), DB);
const needsControl = r => r.uiTemplate === 'curated_card' && r.quantity && r.quantity.stance === 'batched' && (r.intakeChain || []).some(m => !((m.client_response || []).length) && m.type === 'numeric_multiplier');
const population = DB.services.filter(s => needsControl(routeOf(s)));
// PRICING FINDING (PENDING_DECISIONS #112) -- RESOLVED at T156 (operator ruling: graduated tiers + a $95 visit minimum + never below the old flat price). The knob service's price no
// longer ignores quantity. It still does not rise from 1 to 4 knobs, on purpose: that stretch sits ON the declared visit minimum. So the old hard-coded "declared flat" exception is gone and
// the one legitimate flat stretch is DERIVED FROM THE DATA: a price may be flat only while it equals the visit minimum its formula declares (pricing_formulas.<engine>.visit_minimum).
const floorOf = s => { const f = (DB.pricing_formulas || {})[s.pricing_engine]; return f && typeof f.visit_minimum === 'number' ? f.visit_minimum : null; };

console.log('\n=== 1. logic: orch_apply_quantity ===');
const price = (r, n) => sb.orch_apply_quantity(r, n, DB).quote.laborEstimate;
const prices = s => { const r = routeOf(s); return [1, 2, 3, 4, 5].map(n => price(r, n)); };
// Quantity must reach the price. Everywhere: never falls as the count rises. Without a declared visit minimum: strictly higher at 3 than at 1. With one: flat ONLY at the minimum, and strictly higher by 5.
const movesOf = (p, fl) => { const nonDec = p.every((x, i) => i === 0 || x >= p[i - 1]); return fl === null ? nonDec && p[2] > p[0] : nonDec && p[0] === fl && p[4] > p[0]; };
const moves = s => movesOf(prices(s), floorOf(s));
// NON-VACUITY of the rule itself: it must reject the shapes it exists to reject (a price that ignores quantity, one that falls, a flat stretch NOT on the minimum, a minimum never left).
check('the quantity rule rejects: flat with no minimum; a falling price; a flat stretch above the minimum; a minimum never left; and accepts a stretch on the minimum that then rises',
  !movesOf([20, 20, 20, 20, 20], null) && !movesOf([20, 30, 25, 40, 50], null) && !movesOf([100, 100, 100, 100, 110], 95) && !movesOf([95, 95, 95, 95, 95], 95) && movesOf([95, 95, 95, 95, 100], 95) && movesOf([20, 30, 40, 50, 60], null));
check('for every affected service the price is non-decreasing in quantity and moves with it (a service with a declared visit minimum may be flat only AT that minimum, and must rise by 5)', population.every(moves), population.filter(s => !moves(s)).map(s => s.id).join(', '));
const flatNow = population.filter(s => prices(s).every(x => x === prices(s)[0])).map(s => s.id).sort();
check('no affected service ignores quantity altogether (the declared-flat exception is retired: a service whose price is flat for 1..5 fails)', flatNow.length === 0, 'flat now: ' + flatNow.join(', '));
const floored = population.filter(s => floorOf(s) !== null);
check(`the services that may be flat for a stretch are exactly those that declare a visit minimum (${floored.map(s => s.id + ' $' + floorOf(s)).join(', ') || 'none'}), and every one of them does leave the minimum within five`, floored.every(s => prices(s)[4] > floorOf(s)), floored.filter(s => !(prices(s)[4] > floorOf(s))).map(s => s.id).join(', '));
const sh = DB.services.find(s => s.id === 'shelf_mounting_standard_buy_the_hour'), shr = routeOf(sh);
check('the route reports the quantity it priced', [1, 2, 3, 5].every(n => sb.orch_apply_quantity(shr, n, DB).quantity.requestedQty === n));
check('out-of-range input clamps (0 and -4 become 1; 500 becomes 99) instead of pricing nonsense', price(shr, 0) === price(shr, 1) && price(shr, -4) === price(shr, 1) && sb.orch_apply_quantity(shr, 500, DB).quantity.requestedQty === 99);
check('a route with no context is returned unchanged (no throw)', sb.orch_apply_quantity({}, 3, DB) !== undefined);
console.log('\n=== 2. population ===');
check(`${population.length} services have a quantity-scaled curated card with no way to enter the quantity before this control (floor 8)`, population.length >= 8, population.map(s => s.id).join(', '));

async function drive(puppeteer, chromePath, htmlPath) {
  const floorIds = population.filter(s => floorOf(s) !== null).map(s => s.id);
  const out = { errors: new Set(), rows: [] }, data = fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8');
  const browser = await puppeteer.launch({ headless: 'new', executablePath: chromePath, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 2400 }); await page.setRequestInterception(true);
    page.on('request', r => r.url().includes('btnyc.json') ? r.respond({ status: 200, contentType: 'application/json', body: data }) : r.continue());
    page.on('pageerror', e => out.errors.add(String(e.message).slice(0, 120)));
    await page.goto('file://' + htmlPath, { waitUntil: 'networkidle0', timeout: 60000 }); await page.waitForFunction(() => window.DB && window.DB.services, { timeout: 20000 });
    const read = () => page.evaluate(`(()=>{ const vis=${VIS}; const b=[...document.querySelectorAll('.ims-qty-btn')], v=document.querySelector('.ims-qty-value'), pv=document.querySelector('#intakeQuestionsContainer .price-value');
      return { btns: b.length, btnsVisible: b.length===2&&b.every(x=>vis(x)), qty: v?parseInt(v.textContent,10):null, price: pv&&vis(pv)?parseInt(pv.innerText.replace(/[^0-9]/g,''),10):null }; })()`);
    for (const s of population) {
      await page.evaluate((id) => { try { sqRestart(); } catch (e) {} const svc = DB.services.find(x => x.id === id); const ctx = collectBookingContext_catalog(svc, svc.ui_taxonomy.category_id); window._currentContext = ctx; renderRoute(executeWorkflow(ctx, DB)); }, s.id);
      await new Promise(r => setTimeout(r, 250));
      const row = { id: s.id, a: await read() };
      if (row.a.btnsVisible) {
        await page.click('.ims-qty-btn[data-qty-delta="1"]'); await new Promise(r => setTimeout(r, 200)); row.up1 = await read();
        await page.click('.ims-qty-btn[data-qty-delta="1"]'); await new Promise(r => setTimeout(r, 200)); row.up2 = await read();
        await page.click('.ims-qty-btn[data-qty-delta="-1"]'); await new Promise(r => setTimeout(r, 200)); row.dn1 = await read();
        await page.click('.ims-qty-btn[data-qty-delta="-1"]'); await new Promise(r => setTimeout(r, 200)); await page.click('.ims-qty-btn[data-qty-delta="-1"]'); await new Promise(r => setTimeout(r, 200)); row.floor = await read();
        if (floorIds.includes(s.id)) { for (let i = 0; i < 4; i++) { await page.click('.ims-qty-btn[data-qty-delta="1"]'); await new Promise(r => setTimeout(r, 200)); } row.up5 = await read(); }   // a stretch on the visit minimum: go to five to leave it
      }
      out.rows.push(row);
    }
    // CART: shelf mounting, set three, add, compare the cart with the card
    await page.evaluate(() => { try { sqRestart(); } catch (e) {} const svc = DB.services.find(x => x.id === 'shelf_mounting_standard_buy_the_hour'); const ctx = collectBookingContext_catalog(svc, svc.ui_taxonomy.category_id); window._currentContext = ctx; renderRoute(executeWorkflow(ctx, DB)); });
    await new Promise(r => setTimeout(r, 250));
    if (await page.evaluate(`(${VIS})('.ims-qty-btn')`)) {
      await page.click('.ims-qty-btn[data-qty-delta="1"]'); await new Promise(r => setTimeout(r, 200)); await page.click('.ims-qty-btn[data-qty-delta="1"]'); await new Promise(r => setTimeout(r, 200));
      const shown = await read(); await page.click('#btn-curated-add'); await new Promise(r => setTimeout(r, 700));
      out.cart = await page.evaluate(() => { const items = window.__store.getState().cart.serviceRequest; const it = items[items.length - 1] || {}; return { n: items.length, price: it.price, name: it.name, qty: it.qty || it.quantity }; });
      out.cart.shown = shown;
    }
  } finally { await browser.close(); }
  return out;
}

(async () => {
  const chromePath = findChrome(); let puppeteer = null; try { puppeteer = require('puppeteer-core'); } catch { /* handled below */ }
  console.log('\n=== 3. control: every affected service, in a real browser, strict visibility ===');
  if (!chromePath || !puppeteer) { console.log('  \u26a0 ' + (!chromePath ? 'no Chrome/Chromium binary found' : 'puppeteer-core not installed') + ' -- the browser layers were SKIPPED (environment gap, not a code failure).'); console.log(`\n[quantity control on the curated card] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`); process.exit(fail ? 1 : 0); }
  const HTML = path.join(ROOT, 'qr.html'), real = await drive(puppeteer, chromePath, HTML);
  const retraceBad = real.rows.filter(r => !(r.a.btnsVisible && r.a.qty === 1 && r.up1 && r.up1.qty === 2 && r.up2.qty === 3 && r.dn1.qty === 2 && r.dn1.price === r.up1.price && r.floor.qty === 1 && r.floor.price === r.a.price));
  check(`all ${real.rows.length} affected services draw a visible "-" / "+" control starting at 1`, real.rows.every(r => r.a.btnsVisible && r.a.qty === 1), real.rows.filter(r => !(r.a.btnsVisible && r.a.qty === 1)).map(r => r.id).join(', '));
  const floorIds = population.filter(s => floorOf(s) !== null).map(s => s.id);
  // Without a visit minimum the displayed price rises on every "+". With one, it never falls, sits AT the minimum until the formula leaves it, and has left it by five.
  const upOk = r => { if (!(r.up1 && r.up2 && r.up1.qty === 2 && r.up2.qty === 3)) return false; const fl = floorIds.includes(r.id); if (!fl) return r.up1.price > r.a.price && r.up2.price > r.up1.price; const m = floorOf(population.find(s => s.id === r.id)); return r.a.price === m && r.up1.price >= r.a.price && r.up2.price >= r.up1.price && !!r.up5 && r.up5.qty === 5 && r.up5.price > m; };
  check('"+" raises the displayed quantity and the displayed price, step by step (a service on a declared visit minimum: never falls, starts AT the minimum, and has left it by five)', real.rows.every(upOk), real.rows.filter(r => !upOk(r)).map(r => `${r.id}: ${r.a.price}/${r.up1 && r.up1.price}/${r.up2 && r.up2.price}/${r.up5 && r.up5.price}`).join(' | '));
  check('"-" retraces the price exactly, and never goes below one', real.rows.every(r => r.dn1 && r.floor && r.dn1.qty === 2 && r.dn1.price === r.up1.price && r.floor.qty === 1 && r.floor.price === r.a.price), retraceBad.map(r => r.id).join(', '));
  check('no uncaught page error while driving all of them', real.errors.size === 0, [...real.errors].join(' | '));
  console.log('\n=== 4. cart: the quantity reaches the cart, not just the display ===');
  const c = real.cart;
  check('after setting three on shelf mounting, Add to Request puts one item in the cart priced as the card says', !!c && c.n === 1 && c.shown && c.shown.qty === 3 && Number(String(c.price).replace(/[^0-9]/g, '')) === c.shown.price, JSON.stringify(c));
  console.log('\n=== 5. mutant: a renderer that does not draw the control is caught ===');
  const src = fs.readFileSync(HTML, 'utf8'), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qty-')); const a = "if (_qtyModule && route.quantity && route.quantity.stance === 'batched') {";
  if (!src.includes(a)) throw new Error('mutant anchor missing');
  const f = path.join(tmp, 'nocontrol.html'); fs.writeFileSync(f, src.replace(a, 'if (false) {'));
  const m = await drive(puppeteer, chromePath, f);
  check('MUTANT (the control is not drawn) is caught: no affected service shows it', m.rows.every(r => !r.a.btnsVisible), m.rows.filter(r => r.a.btnsVisible).map(r => r.id).join(', '));
  console.log(`\n[quantity control on the curated card] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message); process.exit(2); });
