/**
 * verify_gas_safety_stop.js -- T198 (W1): a described gas, carbon-monoxide or fire hazard is answered with what to do, never a quote.
 *   A. ENGINE   hazard phrasings carry route.safetyStop (authored in global_rules.safety_stops); lookalike jobs (gas stove install, gas leak detector, smoke detector, candle) do not.
 *   B. THE PAGE real browser: hazard phrasings show the stop panel with 911 and no price or Add; a leak job is unchanged.
 *   C. NON-VACUITY the stop removed (no safetyStop) -> the hazard is quoted again.
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

const STOP = [['I smell gas in my kitchen','gas_odor'],['gas leak in the basement','gas_odor'],['my carbon monoxide alarm is going off','carbon_monoxide'],['there is smoke coming from the outlet','fire_smoke'],['the wire caught fire','fire_smoke'],['smells like gas near the stove','gas_odor']];
const OK = ['install a gas leak detector','hook up a gas stove','mount a smoke detector','replace smoke alarm battery','faucet leak','leak under the sink','install a carbon monoxide detector','candle smoke on the wall','fix the fireplace screen','clean behind the gas stove','paint a ceiling'];
const E = load();
console.log('A. engine');
for (const [t, id] of STOP) { const r = route(E, t); check(`A1 "${t}" is the ${id} stop`, r.safetyStop && r.safetyStop.id === id, JSON.stringify(r.safetyStop)); }
for (const t of OK) { const r = route(E, t); check(`A2 "${t}" is not a stop`, !r.safetyStop, JSON.stringify(r.safetyStop)); }
console.log('C. non-vacuity');
const P = load(code => { const a = 'route.safetyStop = orch_safety_stop(context, db);'; return code.includes(a) ? code.replace(a, 'route.safetyStop = null;') : code; });
check('C1 without the stop the hazard has no safetyStop (this is the defect)', !route(P, 'I smell gas in my kitchen').safetyStop);
(async () => {
  let puppeteer = null; try { puppeteer = require('puppeteer-core'); } catch { /* below */ }
  const chromePath = findChrome();
  if (!chromePath || !puppeteer) { check('a browser is required', false, 'No Chrome or puppeteer-core. This test FAILS rather than skipping (DEFECT-SILENT-SKIP).'); console.log(`\n[bare leak not blank] ${pass} passed, ${fail} failed (of ${pass + fail} checks)`); process.exit(1); }
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
  for (const t of ['I smell gas in my kitchen', 'my carbon monoxide alarm is going off', 'there is smoke coming from the outlet']) {
    errors.clear(); await type(t); const b = await body();
    const host = await page.evaluate(() => (document.getElementById('routeCardHost') || {}).innerText || ''); check(`B1 "${t}" shows the stop with 911, no price, no Add`, /911/.test(host) && !/\$\d/.test(host) && !/add to cart/i.test(host), host.slice(0, 300) + ' || ' + (await body()).slice(0, 200));
    check(`B2 "${t}" throws no page error`, errors.size === 0, [...errors].join('; '));
  }
  errors.clear(); await type('faucet leak'); const f = await body();
  check('B3 "faucet leak" is unchanged: Faucet Drip Repair, From $50', /Faucet Drip Repair/.test(f) && /From \$50/.test(f) && !/911/.test(f) && errors.size === 0, f.slice(0, 300));
  await browser.close();
  console.log(`\n[gas safety stop] ${pass} passed, ${fail} failed (of ${pass + fail} checks)`); process.exit(fail ? 1 : 0);
})();
