/**
 * verify_unsupported_trade_painting.js -- T198 (Y1): painting is understood as painting ("light" is a colour there) and answered as outside what we offer: no price, no other trade put in its place.
 *   A. ENGINE   painting phrasings carry route.unsupportedTrade (authored in global_rules.unsupported_trades); supported neighbours (patch and paint, hang a painting, a light that will not turn on) do not.
 *   B. THE PAGE real browser: the answer shows no price or Add; neighbours unchanged.
 *   C. NON-VACUITY the rule removed -> the request is priced as another trade again.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), { execSync } = require('child_process');
const PAGE = require('./_page.js');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..');
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (detail ? '\n      ' + String(detail).split('\n').join('\n      ') : '')); } };
function findChrome() { const c = [process.env.CHROME_PATH, ...(() => { try { return execSync('find /home/*/.cache/puppeteer /root/.cache/puppeteer -type f -name chrome 2>/dev/null || true', { shell: '/bin/bash' }).toString().trim().split('\n').filter(Boolean); } catch { return []; } })(), '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'].filter(Boolean); return c.find(p => fs.existsSync(p)) || null; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HTML = path.join(ROOT, 'qr.html'), DATA = fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8');
const { engine } = require('./_engine.js');
function load(mutate) {
    const DB = JSON.parse(DATA); const w = engine(); let code = w.wrapper; if (mutate) code = mutate(code);
    const sb = { DB, SERVICE_DATA: DB, window: { DB }, console: { log() {}, warn() {}, error() {}, info() {}, debug() {} } }; sb.global = sb; vm.createContext(sb);
    vm.runInContext(code, sb); if (typeof sb.initNlpSets === 'function') sb.initNlpSets(); return sb;
}
const route = (sb, t) => sb.executeWorkflow(Object.assign({}, sb.collectBookingContext_freeText(t), { tagsAffirmed: true }), sb.DB);

const STOP = ['paint the walls light gray','paint my bedroom','repaint the ceiling','light gray walls need painting','paint the door light blue','white shades of paint','I need a painter','painting my kitchen'];
const OK = ['patch the hole and paint it','touch up paint after drywall repair','hang a painting','mount a framed picture','I will paint it myself, just patch the crack','paint is peeling on the wall','light wont turn on','install a ceiling light','fix a light fixture','replace smoke alarm battery','hang a mirror'];
const E = load();
console.log('A. engine');
for (const t of STOP) { const r = route(E, t); check(`A1 "${t}" is the painting answer`, r.unsupportedTrade && r.unsupportedTrade.id === 'painting' && !r.safetyStop, JSON.stringify(r.unsupportedTrade)); }
for (const t of OK) { const r = route(E, t); check(`A2 "${t}" is not an unsupported trade`, !r.unsupportedTrade, JSON.stringify(r.unsupportedTrade)); }
check('A3 an unsupported trade has no price on its own (nothing authored for painting)', !JSON.stringify(E.DB.services).match(/"id":\s*"svc\.paint/i));
console.log('C. non-vacuity');
const P = load(code => { const a = 'route.unsupportedTrade = orch_unsupported_trade(context, db);'; return code.includes(a) ? code.replace(a, 'route.unsupportedTrade = null;') : code; });
const pr = route(P, 'paint my bedroom');
check('C1 without the rule painting has no answer and is priced as another trade (this is the defect)', !pr.unsupportedTrade && !!pr.entity && !!(pr.quote && pr.quote.total != null || pr.basePrice != null), JSON.stringify([pr.uiTemplate, pr.basePrice]));
(async () => {
  let puppeteer = null; try { puppeteer = require('puppeteer-core'); } catch { /* below */ }
  const chromePath = findChrome();
  if (!chromePath || !puppeteer) { check('a browser is required', false, 'No Chrome or puppeteer-core. This test FAILS rather than skipping (DEFECT-SILENT-SKIP).'); console.log(`\n[unsupported trade: painting] ${pass} passed, ${fail} failed (of ${pass + fail} checks)`); process.exit(1); }
  const browser = await puppeteer.launch({ headless: 'new', executablePath: chromePath, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage(); const errors = new Set();
  await page.setViewport({ width: 1280, height: 2400 }); await page.setRequestInterception(true);
  page.on('request', r => { const d = PAGE.documentResponse(r.url()); if (d) return r.respond(d); r.url().includes('btnyc.json') ? r.respond({ status: 200, contentType: 'application/json', body: DATA }) : r.continue(); });
  page.on('pageerror', e => errors.add(String(e.message).slice(0, 140)));
  await page.goto('file://' + HTML, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction(() => window.DB && window.DB.services, { timeout: 20000 });
  const type = async say => { await page.evaluate(() => { try { sqRestart(); } catch (e) {} const i = document.getElementById('sqDescIn'); i.value = ''; }); await page.click('#sqDescIn'); await page.type('#sqDescIn', say, { delay: 2 }); await page.click('#sqUnifiedActionBtn'); await sleep(1300); };
  const body = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  console.log('\nB. the page');
  for (const t of ['paint the walls light gray', 'paint my bedroom', 'repaint the ceiling']) {
    errors.clear(); await type(t); const host = await page.evaluate(() => (document.getElementById('routeCardHost') || {}).innerText || ''); const b = await body();
    check(`B1 "${t}" says painting is not offered: no price, no Add, no Legacy text`, /painting/i.test(host) && /not something we offer|don't take painting/i.test(host) && !/\$\d/.test(host) && !/add to cart/i.test(host) && !/legacy flow/i.test(b), host.slice(0, 300));
    check(`B2 "${t}" throws no page error`, errors.size === 0, [...errors].join('; '));
  }
  errors.clear(); await type('hang a painting'); const h = await body();
  const stale3 = await page.evaluate(() => { const e = document.getElementById('routeCardHost'); return e ? e.style.display + '|' + e.innerText.slice(0,60) : 'none'; }); check('B3 "hang a painting" is not the painting answer (the builder asks what to hang)', !/Painting isn't something we offer/.test(h) && /hang|mount/i.test(h) && errors.size === 0, stale3 + ' || ' + h.slice(0, 120));
  errors.clear(); await type('patch the hole and paint it'); const ph = await body();
  check('B4 "patch the hole and paint it" is still patch work (the builder asks about the hole)', !/Painting isn't something we offer/.test(ph) && /patch|hole/i.test(ph) && errors.size === 0, [...errors].join('; ') + ' || ' + ph.slice(0, 300));
  await browser.close();
  console.log(`\n[unsupported trade: painting] ${pass} passed, ${fail} failed (of ${pass + fail} checks)`); process.exit(fail ? 1 : 0);
})();
