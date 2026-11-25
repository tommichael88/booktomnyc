/**
 * verify_builder_defers_to_resolution.js -- T198 (Y2): the guided builder and free text make ONE decision about the same facts.
 *   "fix light" -> won't turn on -> bathroom used to price a generic "light repaired" ($64: 45 min + $45 dispatch) while "light wont turn on" typed asks which lighting job.
 *   A. ENGINE   orch_builder_unresolved: true for the built sentence of an ambiguous word with no group, false for a named group and for a sentence that resolves.
 *   B. THE PAGE the builder path shows the same question (the lighting groups) as free text, with no price and no Add; a builder that names its group keeps its price.
 *   C. NON-VACUITY the deferral removed -> the builder prices $64 again.
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
const U = (t, g) => E.orch_builder_unresolved(t, E.DB, g || null);
check('A1 the built sentence for an ambiguous "light" is unresolved', U("I need to fix my light because it won't turn on in the bathroom") === true);
check('A2 the same words with a named group are not asked again', U("I need to fix my light because it won't turn on in the bathroom", 'light_fixtures') === false);
check('A3 a sentence that resolves to a service is not deferred', U('I need to install my curtains') === false);
check('A4 an empty sentence is not deferred', U('') === false);
console.log('C. non-vacuity');
const hasLine = fs.readFileSync(HTML, 'utf8').includes('if (orch_builder_unresolved(desc, DB, BLD._groupId)) { sqAnalyze(); return; }');
check('C0 the deferral is in the page source', hasLine);
(async () => {
  let puppeteer = null; try { puppeteer = require('puppeteer-core'); } catch { /* below */ }
  const chromePath = findChrome();
  if (!chromePath || !puppeteer) { check('a browser is required', false, 'No Chrome or puppeteer-core. This test FAILS rather than skipping (DEFECT-SILENT-SKIP).'); console.log(`\n[builder defers] ${pass} passed, ${fail} failed (of ${pass + fail} checks)`); process.exit(1); }
  const browser = await puppeteer.launch({ headless: 'new', executablePath: chromePath, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const run = async (mutate) => {
    const page = await browser.newPage(); const errors = new Set();
    await page.setViewport({ width: 1280, height: 2400 }); await page.setRequestInterception(true);
    page.on('request', r => { const d = PAGE.documentResponse(r.url()); if (d) { if (mutate && d.body && typeof d.body === 'string') d.body = mutate(d.body); return r.respond(d); } r.url().includes('btnyc.json') ? r.respond({ status: 200, contentType: 'application/json', body: DATA }) : r.continue(); });
    page.on('pageerror', e => errors.add(String(e.message).slice(0, 140)));
    await page.goto('file://' + HTML, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.waitForFunction(() => window.DB && window.DB.services, { timeout: 20000 });
    return { page, errors };
  };
  const typeIn = async (page, say) => { await page.evaluate(() => { try { sqRestart(); } catch (e) {} const i = document.getElementById('sqDescIn'); i.value = ''; }); await page.click('#sqDescIn'); await page.type('#sqDescIn', say, { delay: 2 }); await page.click('#sqUnifiedActionBtn'); await sleep(1300); };
  const tap = async (page, re) => { const r = await page.evaluate(src => { const b = [...document.querySelectorAll('#sqBuilderChips .sq-b-chip')].find(x => new RegExp(src, 'i').test((x.innerText || '').trim())); if (b) { b.click(); return b.innerText; } return null; }, re); await sleep(1000); return r; };
  const host = page => page.evaluate(() => [...document.querySelectorAll('.route-clarify')].map(e => e.innerText).join(' | '));
  const vis = page => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  const builderLight = async (page) => { await typeIn(page, 'fix light'); const a = await tap(page, "turn on"); const b = await tap(page, 'bathroom|bedroom|kitchen'); return [a, b]; };
  console.log('\nB. the page');
  { const { page, errors } = await run(); const tapped = await builderLight(page); const h = await host(page); const v = await vis(page);
    check('B0 the builder path was walked (condition and room chosen)', !!tapped[0] && !!tapped[1], JSON.stringify(tapped));
    check('B1 the builder asks which lighting job (the lighting groups), as free text does', /one more detail to price this/i.test(h) && /Light Fixtures/.test(h) && /Switches/.test(h), h.slice(0, 300));
    check('B2 no $64, no "light repaired", no Add to Cart on the builder path', !/\$\s?64/.test(v) && !/light repaired/i.test(v) && !/Add to Cart/i.test(v), v.slice(0, 400));
    check('B3 no page error', errors.size === 0, [...errors].join('; '));
    await typeIn(page, 'light wont turn on'); const h2 = await host(page);
    check('B4 free text for the same job asks the same question (same group chips)', /one more detail to price this/i.test(h2) && /Light Fixtures/.test(h2) && /Switches/.test(h2), h2.slice(0, 300));
    const chips = t => (t.match(/Bulbs|Fans|Light Fixtures|Outlets|Switches|Thermostats/g) || []).join(',');
    check('B5 both paths offer the identical set of choices', chips(h) === chips(h2) && chips(h) !== '', chips(h) + ' vs ' + chips(h2));
    await page.close(); }
  { const { page, errors } = await run(); await typeIn(page, 'fix curtains'); const v = await vis(page);
    check('B6 a request that resolves keeps its service and price (Blinds, Shades or Curtains, $50)', /Blinds, Shades or Curtains/.test(v) && /\$50/.test(v) && errors.size === 0, v.slice(0, 300)); await page.close(); }
  { const { page } = await run(); await page.evaluate(() => { window.orch_builder_unresolved = () => false; }); await builderLight(page); await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /calculate estimate/i.test(x.innerText || '')); if (b) b.click(); }); await sleep(1200); const v = await vis(page);
    check('B7 non-vacuity: with the deferral removed the builder prices a generic $64 (this is the defect)', /\$\s?64/.test(v) && /light repaired|Add to Cart/i.test(v), v.slice(0, 300)); await page.close(); }
  await browser.close();
  console.log(`\n[builder defers to resolution] ${pass} passed, ${fail} failed (of ${pass + fail} checks)`); process.exit(fail ? 1 : 0);
})();
