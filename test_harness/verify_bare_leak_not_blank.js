#!/usr/bin/env node
/**
 * verify_bare_leak_not_blank.js -- T198 (S1): a leak with no named fixture is answered, not ignored.
 *
 * Before: "water leak", "I have a leak", "leak", "my house is leaking", "roof leak" produced NO response on the page. The plumbing category has a Diagnostic dynamic definition but no Repair one, so a repair request
 * naming no fixture fell to the catastrophic fallback (a vetoed legacy route with no quantity); sqAnalyze then threw "Cannot read properties of undefined (reading 'units')" and the customer saw nothing.
 * After: such a request resolves to the category's diagnostic (which asks which fixture; on-site diagnostic offered), and a route without a quantity can no longer throw.
 *   A. ENGINE   the leak phrasings resolve to a dynamic route with a quantity (not vetoed); named-fixture leaks keep their routes; a leaking window AC is the window AC repair (not a plumbing question).
 *   B. THE PAGE real browser: those phrasings show the on-site quote panel (answer questions / book the diagnostic), with no page error; a faucet leak is unchanged.
 *   C. NON-VACUITY the fallback branch planted back (no Diagnostic substitute) vetoes the route again.
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
const LEAKS = ['water leak', 'I have a leak', 'leak', 'my house is leaking', 'roof leak', 'there is a leak'];
const E = load();
console.log('A. engine');
for (const t of LEAKS) { const r = route(E, t); check(`A1 "${t}" is a dynamic route with a quantity (not vetoed)`, !r._vetoed && r.entityType === 'dynamic' && r.quantity && r.quantity.units >= 1, JSON.stringify({ v: r._vetoed, e: r.entityType, q: r.quantity })); }
for (const [t, id] of [['faucet leak', 'faucet_repair_drip'], ['leak under the sink', 'leak_under_sink_repair'], ['dripping faucet', 'faucet_repair_drip'], ['window air conditioner leaking', 'window_ac_repair']]) check(`A2 "${t}" keeps ${id}`, (route(E, t).entity || {}).id === id, (route(E, t).entity || {}).id);
console.log('C. non-vacuity');
const P = load(code => { const a = "if (normSt === 'Repair') return defs[cat + '+Diagnostic']"; return code.includes(a) ? code.replace(a, "if (false) return defs[cat + '+Diagnostic']") : code; });
check('C1 the resolver without the last-resort Diagnostic rule vetoes "water leak" again (this is the defect)', route(P, 'water leak')._vetoed === true, JSON.stringify({ v: route(P, 'water leak')._vetoed, e: route(P, 'water leak').entityType }));
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
  for (const t of ['water leak', 'I have a leak', 'leak', 'my house is leaking']) {  // W3: "roof leak" is no longer a plumbing diagnostic: it is answered by the roofer stop (below)
    errors.clear(); await type(t); const b = await body();
    check(`B1 "${t}" shows the on-site quote panel`, /On-site quote/.test(b) && /Book an on-site diagnostic/.test(b) && /Answer a few more questions/.test(b), b.slice(0, 300));
    check(`B2 "${t}" throws no page error`, errors.size === 0, [...errors].join('; '));
  }
  errors.clear(); await type('roof leak'); const rf = await body();
  check('B1b "roof leak" is answered (the roofer stop: not a plumbing quote, not blank), no page error', /needs a roofer/.test(rf) && !/Book an on-site diagnostic/.test(rf) && errors.size === 0, rf.slice(0, 300));
  errors.clear(); await type('faucet leak'); const f = await body();
  check('B3 "faucet leak" is unchanged: Faucet Drip Repair, From $50', /Faucet Drip Repair/.test(f) && /From \$50/.test(f) && errors.size === 0, f.slice(0, 300));
  await browser.close();
  console.log(`\n[bare leak not blank] ${pass} passed, ${fail} failed (of ${pass + fail} checks)`); process.exit(fail ? 1 : 0);
})();
