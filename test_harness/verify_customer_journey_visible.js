#!/usr/bin/env node
/**
 * verify_customer_journey_visible.js -- can a customer actually USE the page? (R-SYSTEM-LAYERS / dumb-UI: render targets are disjoint and owned by one renderer.)
 *
 * Every earlier check of the route UI compared "old render" with "new render" (the differential) or read a node's innerText / style.display. Both pass when BOTH are dead: the search flow
 * was dead in the project's ORIGINAL file, byte for byte, and no test noticed, because the cart panel (#serviceRequestSummary) -- also the render target for the affirmation and
 * self-quote cards -- was nested inside #intakeQuestionsContainer, so renderRoute's `intakeContainer.innerHTML = ''` destroyed it and the card renderers then did
 * `const c = document.getElementById(...); if (!c) return;` and returned silently. This test asserts FUNCTION, in a real browser, with a strict definition of visible
 * (a real layout box AND the topmost element at its centre is the thing itself, so a card behind a hidden wrapper or under an overlay does not count):
 *   1. STRUCTURE  -- the four hosts are present and are SIBLINGS (none nested in another); the cart panel lives in its own wrapper;
 *   2. REACHABLE  -- each realistic request (covering the affirmation, self-quote and curated-card templates) reaches a visible screen;
 *   3. PROCEEDS   -- from the affirmation card, "Yes" reaches a visible curated card with a visible price; "No" removes the card and returns focus to the input;
 *   4. SURVIVES   -- the persistent nodes (cart panel, cart list, total) are the SAME nodes after several renders: nothing destroyed them, so the cached DOM.* references the cart renderer
 *                    holds cannot go stale;
 *   5. CART       -- adding from the self-quote card updates the visible cart count, and a second search after returning home still works;
 *   6. MUTANTS    -- re-nesting the cart panel, and pointing the card back at the cart panel, are each caught.
 * Skips (loudly) only if there is no Chrome / puppeteer-core, exactly as the smoke test does.
 */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { execSync } = require('child_process');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..');
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log('  \u2713 ' + name); } else { fail++; console.log('  \u2717 ' + name + (detail ? '\n      ' + detail : '')); } };
function findChrome() { const c = [process.env.CHROME_PATH, ...(() => { try { return execSync('find /home/*/.cache/puppeteer /root/.cache/puppeteer -type f -name chrome 2>/dev/null || true', { shell: '/bin/bash' }).toString().trim().split('\n').filter(Boolean); } catch { return []; } })(), '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'].filter(Boolean); return c.find(p => fs.existsSync(p)) || null; }
const VIS = `(sel)=>{const e=typeof sel==='string'?document.querySelector(sel):sel; if(!e||!e.getClientRects().length||e.offsetHeight<=0) return false; const r=e.getBoundingClientRect(); const t=document.elementFromPoint(r.left+Math.min(r.width/2,40), r.top+Math.min(r.height/2,12)); return !!(t&&(e===t||e.contains(t)));}`;
const REQUESTS = [  // realistic customer phrases, chosen to reach each template the route can produce
  { say: 'my dishwasher is leaking', expect: 'affirm' }, { say: 'mount a tv on the wall', expect: 'affirm' }, { say: 'toilet keeps running', expect: 'affirm' },
  { say: 'urgent, need help with something in my house', expect: 'affirm' }, { say: 'replace 3 light bulbs', expect: 'selfquote' },
  { say: 'hang a shelf', expect: 'intake' }, { say: 'install a ceiling fan', expect: 'intake' } ];

async function journey(puppeteer, chromePath, htmlPath, dataPath) {
  const data = fs.readFileSync(dataPath, 'utf8'), out = { errors: new Set() };
  const browser = await puppeteer.launch({ headless: 'new', executablePath: chromePath, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 2200 }); await page.setRequestInterception(true);
    page.on('request', r => { const _d = require('./_page.js').documentResponse(r.url()); if (_d) return r.respond(_d); r.url().includes('btnyc.json') ? r.respond({ status: 200, contentType: 'application/json', body: data }) : r.continue(); });
    page.on('pageerror', e => out.errors.add(String(e.message).slice(0, 120)));
    await page.goto('file://' + htmlPath, { waitUntil: 'networkidle0', timeout: 60000 }); await page.waitForFunction(() => window.DB && window.DB.services, { timeout: 20000 });
    out.structure = await page.evaluate(() => { const ids = ['routeCardHost', 'serviceContainer', 'intakeQuestionsContainer', 'summaryMainContainer'], els = ids.map(i => document.getElementById(i)); const nested = els.filter(Boolean).some(a => els.filter(Boolean).some(b => a !== b && a.contains(b)));
      return { present: els.every(Boolean), nested, cartInOwnWrapper: !!document.querySelector('#summaryMainContainer #serviceRequestSummary'), cartListInPanel: !!document.querySelector('#serviceRequestSummary #serviceRequestList') }; });
    await page.evaluate(() => { window.__persist = ['serviceRequestSummary', 'serviceRequestList', 'totalAmount'].map(i => document.getElementById(i)); });
    out.reached = [];
    for (const r of REQUESTS) {
      await page.evaluate(() => { try { sqRestart(); } catch (e) {} const i = document.getElementById('sqDescIn'); if (i) i.value = ''; });
      await page.click('#sqDescIn'); await page.type('#sqDescIn', r.say, { delay: 3 }); await page.click('#sqUnifiedActionBtn'); await new Promise(x => setTimeout(x, 1200));
      const s = await page.evaluate(`(()=>{ const vis=${VIS}; const q=s=>document.querySelector(s), ic=q('#intakeQuestionsContainer'); return { affirm: vis('#sqAffirmCard'), selfquote: vis('#btn-self-quote-add'), intake: !!ic&&vis(ic)&&ic.children.length>0 }; })()`);
      const shown = s.affirm ? 'affirm' : s.selfquote ? 'selfquote' : s.intake ? 'intake' : 'nothing';
      const row = { say: r.say, expect: r.expect, shown };
      if (s.affirm && r.say === 'toilet keeps running') {   // proceed through "Yes"
        await page.click('.affirm-yes-btn'); await new Promise(x => setTimeout(x, 1200));
        row.afterYes = await page.evaluate(`(()=>{ const vis=${VIS}; const c=document.querySelector('#intakeQuestionsContainer'), pv=c&&c.querySelector('.price-value'); return { curated: !!c&&vis(c)&&c.children.length>0, price: pv&&vis(pv) ? pv.innerText.trim() : null }; })()`);
      }
      out.reached.push(row);
    }
    // "No": remove the card and return focus
    await page.evaluate(() => { try { sqRestart(); } catch (e) {} document.getElementById('sqDescIn').value = ''; });
    await page.click('#sqDescIn'); await page.type('#sqDescIn', 'my dishwasher is leaking', { delay: 3 }); await page.click('#sqUnifiedActionBtn'); await new Promise(x => setTimeout(x, 1100));
    if (await page.evaluate(`(${VIS})('#sqAffirmCard')`)) { await page.click('.affirm-no-btn'); await new Promise(x => setTimeout(x, 600));
      out.afterNo = await page.evaluate(`(()=>{ const vis=${VIS}; return { cardGone: !document.getElementById('sqAffirmCard'), focused: document.activeElement===document.getElementById('sqDescIn') }; })()`); }
    out.persist = await page.evaluate(() => ['serviceRequestSummary', 'serviceRequestList', 'totalAmount'].map((id, i) => { const e = document.getElementById(id); return !!e && e === window.__persist[i] && e.isConnected; }));
    // CART: add from the self-quote card, see the visible count, then search again
    await page.evaluate(() => { try { sqRestart(); } catch (e) {} document.getElementById('sqDescIn').value = ''; });
    await page.click('#sqDescIn'); await page.type('#sqDescIn', 'replace 3 light bulbs', { delay: 3 }); await page.click('#sqUnifiedActionBtn'); await new Promise(x => setTimeout(x, 1100));
    if (await page.evaluate(`(${VIS})('#btn-self-quote-add')`)) {
      const before = await page.evaluate(() => (document.getElementById('fabCartCount') || {}).innerText || '0');
      await page.click('#btn-self-quote-add'); await new Promise(x => setTimeout(x, 900));
      out.cart = await page.evaluate(`(()=>{ const vis=${VIS}; const f=document.getElementById('fabCartCount'); return { count: f?f.innerText.trim():null, fabVisible: !!document.getElementById('cartFab')&&vis('#cartFab'), cartState: (window.__store?window.__store.getState().cart.serviceRequest.length:null) }; })()`);
      out.cart.before = before;
      await page.evaluate(() => { try { sqRestart(); } catch (e) {} const i = document.getElementById('sqDescIn'); if (i) i.value = ''; });
      await page.click('#sqDescIn'); await page.type('#sqDescIn', 'toilet keeps running', { delay: 3 }); await page.click('#sqUnifiedActionBtn'); await new Promise(x => setTimeout(x, 1100));
      out.secondSearchWorks = await page.evaluate(`(${VIS})('#sqAffirmCard')`);
    }
  } finally { await browser.close(); }
  return out;
}

(async () => {
  const chromePath = findChrome(); let puppeteer = null; try { puppeteer = require('puppeteer-core'); } catch { /* handled below */ }
  console.log('\n=== the customer journey, in a real browser, with strict visibility ===');
  if (!chromePath || !puppeteer) { console.log('  \u26a0 ' + (!chromePath ? 'no Chrome/Chromium binary found' : 'puppeteer-core not installed') + ' -- SKIPPED (environment gap, not a code failure).'); console.log(`\n[customer journey visible] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`); process.exit(0); }
  const HTML = path.join(ROOT, 'qr.html'), DATA = path.join(ROOT, 'btnyc.json');
  const real = await journey(puppeteer, chromePath, HTML, DATA);
  console.log('\n--- 1. structure ---');
  check('the four hosts exist and none is nested inside another (disjoint render targets)', real.structure.present && !real.structure.nested, JSON.stringify(real.structure));
  check('the cart panel sits in its own wrapper, with its list inside it', real.structure.cartInOwnWrapper && real.structure.cartListInPanel);
  console.log('\n--- 2. reachable: every realistic request reaches a visible screen ---');
  for (const r of real.reached) check(`"${r.say}" -> a visible ${r.expect} screen`, r.shown === r.expect, 'showed: ' + r.shown);
  console.log('\n--- 3. proceeds ---');
  const y = (real.reached.find(r => r.afterYes) || {}).afterYes;
  check('"Yes, that\'s it" reaches a visible curated card with a visible price', !!y && y.curated && /\$\d/.test(y.price || ''), JSON.stringify(y));
  check('"Let me explain further" removes the card and returns focus to the input', !!real.afterNo && real.afterNo.cardGone && real.afterNo.focused, JSON.stringify(real.afterNo));
  console.log('\n--- 4. survives: persistent nodes are never destroyed by rendering ---');
  check('the cart panel, its list and its total are the SAME connected nodes after eleven renders', real.persist && real.persist.every(Boolean), JSON.stringify(real.persist));
  console.log('\n--- 5. cart ---');
  check('adding from the self-quote card puts the item in the cart (store) and updates the visible count', !!real.cart && real.cart.cartState === 1 && String(real.cart.count) === '1', JSON.stringify(real.cart));
  check('after that, a second search still works (no stale cached references)', real.secondSearchWorks === true);
  check('no uncaught page error during the whole journey', real.errors.size === 0, [...real.errors].join(' | '));
  console.log('\n--- 6. mutants: each restored defect is caught ---');
  const src = require('./_page.js').readPage(HTML), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'journey-'));
  const run = async (name, mutate) => { const m = mutate(src); if (m === src) throw new Error('mutant anchor missing: ' + name); const f = path.join(tmp, name + '.html'); fs.writeFileSync(f, m); return journey(puppeteer, chromePath, f, DATA); };
  const m1 = await run('renest', t => t.replace('<div class="summaryMainContainer" id="summaryMainContainer" style="display:none">', '<div class="summaryMainContainer" id="summaryMainContainer" style="display:none"><!--x--></div><div id="serviceContainer2"></div>').replace('<div id="intakeQuestionsContainer"></div>', '<div id="intakeQuestionsContainer"><div class="summaryMainContainer" style="display:none"><div id="serviceRequestSummary"><div id="serviceRequestList"></div><div id="totalAmount"></div></div></div></div>').replace(/<div id="serviceRequestSummary">\s*<div id="summary-header">/, '<div id="serviceRequestSummary_unused"><div id="summary-header">'));
  check('MUTANT 1 (the cart panel is nested inside the intake container again, as in the original) is caught: cards vanish or the structure check fails', m1.structure.nested || m1.reached.some(r => r.shown === 'nothing') || !m1.structure.cartInOwnWrapper, JSON.stringify(m1.reached.map(r => r.shown)));
  const m2 = await run('oldhost', t => t.replace("const container = document.getElementById('routeCardHost');   // T152: its own host, not the cart panel", "const container = document.getElementById('serviceRequestSummary');"));
  check('MUTANT 2 (the card renderers write into the cart panel again) is caught: the card is not visible', m2.reached.some(r => r.shown === 'nothing' || (r.expect === 'affirm' && r.shown !== 'affirm')), JSON.stringify(m2.reached.map(r => r.shown)));
  console.log(`\n[customer journey visible] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message); process.exit(2); });
