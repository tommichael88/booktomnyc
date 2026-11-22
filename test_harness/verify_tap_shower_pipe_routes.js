/**
 * verify_tap_shower_pipe_routes.js -- T198 (W4): a dripping tap is the faucet repair (as a leaking tap is); a shower or pipe leak is answered, not blank.
 *   A. ENGINE   "dripping tap"/"tap dripping" -> faucet_repair_drip $50 (same as "tap leaking"); "shower leaking", "leaking pipe", "pipe leak" resolve to the plumbing diagnostic (an entity, a curated card), not a null entity.
 *   B. THE PAGE real browser: "leaking pipe", then "Yes, that's it", shows the on-site quote panel (it showed nothing), no page error; "dripping tap" suggests Faucet Drip Repair From $50.
 *   C. NON-VACUITY the resolver without the Diagnostic rule leaves "leaking pipe" with no entity again.
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


const E = load();
console.log('A. engine');
for (const t of ['dripping tap', 'tap dripping', 'leaky tap', 'tap leaking', 'dripping faucet']) { const r = route(E, t); check(`A1 "${t}" is Faucet Drip Repair at $50`, r.entity && r.entity.id === 'faucet_repair_drip' && Number(r.basePrice || r.price && r.price.base) === 50 || (r.entity && r.entity.id === 'faucet_repair_drip' && /50/.test(JSON.stringify(r.price || r.basePrice))), JSON.stringify({ e: r.entity && r.entity.id, b: r.basePrice })); }
for (const t of ['shower leaking', 'shower head leaking', 'leaking pipe', 'pipe leak', 'basin leaking', 'drain trap leaking']) { const r = route(E, t); check(`A2 "${t}" has an entity (the plumbing diagnostic), not a null route`, !r._vetoed && r.entity && r.entityType === 'dynamic', JSON.stringify({ e: r.entity && r.entity.id, t: r.entityType, v: r._vetoed })); }
console.log('C. non-vacuity');
const P = load(code => { const a = "!catDef && normSt === 'Repair'"; return code.includes(a) ? code.replace(a, 'false') : code; });
check('C1 without the group last-resort rule "leaking pipe" has no entity again (this is the defect)', !route(P, 'leaking pipe').entity);
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
  const yes = () => page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Yes, that/.test(x.innerText)); if (b) b.click(); });
  for (const t of ['leaking pipe', 'pipe leak', 'shower leaking']) {
    errors.clear(); await type(t); await yes(); await sleep(900); const b = await body();
    check(`B1 "${t}" shows the on-site quote panel`, /On-site quote/.test(b) && /Book an on-site diagnostic/.test(b), b.replace(/^.*?BUILD YOUR R/, '').slice(0, 300));
    check(`B2 "${t}" throws no page error`, errors.size === 0, [...errors].join('; '));
  }
  errors.clear(); await type('dripping tap'); const f = await body();
  check('B3 "dripping tap" suggests Faucet Drip Repair From $50', /Faucet Drip Repair/.test(f) && /From \$50/.test(f) && !/From \$165/.test(f) && errors.size === 0, f.replace(/^.*?BUILD YOUR R/, '').slice(0, 300));
  await browser.close();
  console.log(`\n[tap shower pipe] ${pass} passed, ${fail} failed (of ${pass + fail} checks)`); process.exit(fail ? 1 : 0);
})();
