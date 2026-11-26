/**
 * verify_requested_action_preserved.js -- T198 (Z2): what the customer asked to be DONE is its own fact, distinct from the resolved service's type.
 *   "my blind is broken" / "repair the shades" seeded the guided builder with INSTALL (the blind service is authored as an Install), so its sentence said "I need to install my blind".
 *   A. ENGINE   statedStype (the customer's verb -> authored service type) reaches the booking context and route.requestedAction; service identity and price are unchanged.
 *   B. THE PAGE the builder keeps the stated verb (fix stays fix; hang still refines to mount; no verb falls back to the resolved type); free text shows the same verb.
 *   C. NEGATIVE  ambiguous words (blind spot, shades of gray) still route nowhere new; no price or service moved.
 *   D. NON-VACUITY the stated type removed -> the builder says install for a broken blind again.
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
const P1 = ['my blinds are broken', 'install blinds', 'hang a picture', 'light wont turn on', 'fix my blind'];
console.log('A. engine');
const rr = t => route(E, t);
check('A1 "my blinds are broken" asks for a repair (requestedAction Repair) of the Blinds service (identity unchanged)', rr('my blinds are broken').requestedAction === 'Repair' && rr('my blinds are broken').entity.id === 'blinds_shades_curtains_buy_the_hour');
check('A2 "install blinds" asks for an install', rr('install blinds').requestedAction === 'Install');
check('A3 "hang a picture" is the install family (hang is authored with install)', rr('hang a picture').requestedAction === 'Install');
check('A4 "fix my blind" is a repair even though the word is held and asked about', rr('fix my blind').requestedAction === 'Repair');
check('A5 a request with no verb or malfunction states no action', rr('curtains').requestedAction === null);
check('A6 the price of the same service is unchanged by the stated action (hourly $50 for repair and install alike)', rr('my blinds are broken').basePrice === rr('install blinds').basePrice || (rr('my blinds are broken').quote && rr('install blinds').quote && rr('my blinds are broken').quote.total === rr('install blinds').quote.total), JSON.stringify([rr('my blinds are broken').basePrice, rr('install blinds').basePrice]));
console.log('C. negatives');
for (const t of ['blind spot in my mirror', 'shades of gray', 'candle sconce']) { const r = rr(t); check(`C1 "${t}" is not routed to the blinds or lighting service`, !(r.entity && /blinds_shades|light_fixture/.test(r.entity.id || '')), r.entity && r.entity.id); }
(async () => {
  let puppeteer = null; try { puppeteer = require('puppeteer-core'); } catch { /* below */ }
  const chromePath = findChrome();
  if (!chromePath || !puppeteer) { check('a browser is required', false, 'No Chrome or puppeteer-core. This test FAILS rather than skipping (DEFECT-SILENT-SKIP).'); console.log(`\n[requested action] ${pass} passed, ${fail} failed (of ${pass + fail} checks)`); process.exit(1); }
  const browser = await puppeteer.launch({ headless: 'new', executablePath: chromePath, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const run = async () => {
    const page = await browser.newPage(); const errors = new Set();
    await page.setViewport({ width: 1280, height: 2400 }); await page.setRequestInterception(true);
    page.on('request', r => { const d = PAGE.documentResponse(r.url()); if (d) return r.respond(d); r.url().includes('btnyc.json') ? r.respond({ status: 200, contentType: 'application/json', body: DATA }) : r.continue(); });
    page.on('pageerror', e => errors.add(String(e.message).slice(0, 140)));
    await page.goto('file://' + HTML, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.waitForFunction(() => window.DB && window.DB.services, { timeout: 20000 });
    return { page, errors };
  };
  const typeIn = async (page, say) => { await page.evaluate(() => { try { sqRestart(); } catch (e) {} document.getElementById('sqDescIn').value = ''; }); await page.click('#sqDescIn'); await page.type('#sqDescIn', say, { delay: 2 }); await page.click('#sqUnifiedActionBtn'); await sleep(1300); };
  const seeded = page => page.evaluate(() => JSON.stringify({ a: BLD.action, o: BLD.object }));
  const live = page => page.evaluate(() => { const m = document.body.innerText.replace(/\s+/g, ' ').match(/CLEAR (I [^\n]{0,120}?) live/); return m ? m[1] : null; });
  console.log('\nB. the page');
  { const { page, errors } = await run();
    for (const [t, act, word] of [['fix my blind', 'fix', 'fix'], ['repair the shades', 'fix', 'fix'], ['hang my clock', 'mount', 'hang'], ['fix my light', 'fix', 'fix']]) {
      await typeIn(page, t); const b = JSON.parse(await seeded(page)); const l = await live(page);
      check(`B1 "${t}": the builder keeps the stated action (${act}) and the sentence says "${word}"`, b.a === act && new RegExp('\\b' + word + '\\b', 'i').test(l || ''), JSON.stringify(b) + ' || ' + l);
    }
    await typeIn(page, 'my blinds are broken'); const lf = await live(page);
    check('B2 free text for the broken blinds says fix (not install)', /fix my blinds/i.test(lf || '') && !/install/i.test(lf || ''), lf);
    check('B3 no page error', errors.size === 0, [...errors].join('; '));
    await page.close(); }
  console.log('\nD. non-vacuity');
  { const { page } = await run();
    await page.evaluate(() => { const o = window.understandRequest; window.understandRequest = (t, op) => Object.assign({}, o(t, op), { statedStype: null }); });
    await typeIn(page, 'fix my blind'); const b = JSON.parse(await seeded(page));
    check('D1 with the stated action removed, the builder seeds install for a broken blind again (this is the defect)', b.a === 'install', JSON.stringify(b)); await page.close(); }
  await browser.close();
  console.log(`\n[requested action] ${pass} passed, ${fail} failed (of ${pass + fail} checks)`); process.exit(fail ? 1 : 0);
})();
