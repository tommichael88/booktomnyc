/**
 * verify_light_window_furniture_routes.js -- T198 (X1-X3): lighting, window-treatment and furniture requests are answered; nothing says "Legacy flow".
 *   A. ENGINE   curtains/drapes/shades/blind -> Blinds, Shades or Curtains (hourly); sconce -> Light Fixture Replacement; assemble furniture -> Flat-Pack Furniture Assembly
 *               (take-apart and repair unchanged); install furniture / a cupboard shelf / fix a rod resolve (a group under its own category; Install = Mount where only one is authored);
 *               an ambiguous "fix light" / "fix fixture" is NOT guessed: the vetoed fallback carries the kind of job (electric_lighting) so the page can ask.
 *   B. THE PAGE real browser: furniture assembly shows the furniture selection (it showed "Legacy flow – please use the new UI."); "fix light" asks which lighting job, a choice opens
 *               that group and the question goes; "fix curtains" shows the blinds/curtains card; "install furniture" after "Looks right" is not blank; no "Legacy flow" text, no page error.
 *   C. NON-VACUITY the resolver without the group's own category, or without Install = Mount, leaves those requests unresolved again.
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
const ent = r => r._vetoed ? 'VETO' : r.entityType === 'service' ? r.entity.id : r.entity ? 'dynamic' : 'NULL';
console.log('A. engine');
for (const t of ['fix curtains', 'my blind is broken', 'replace shades', 'drapes making noise', 'hang curtains', 'install blinds'])
    check(`A1 "${t}" is Blinds, Shades or Curtains`, ent(route(E, t)) === 'blinds_shades_curtains_buy_the_hour', ent(route(E, t)));
for (const t of ['fix sconce', 'sconce not working', 'replace sconce', 'replace light fixture'])
    check(`A2 "${t}" is Light Fixture Replacement`, ent(route(E, t)) === 'light_fixture_replacement', ent(route(E, t)));
for (const [t, id] of [['assemble furniture', 'furniture_assembly_flat_pack'], ['assemble an ikea dresser', 'furniture_assembly_flat_pack'], ['furniture assembly', 'furniture_assembly_flat_pack'], ['disassemble my bed', 'furniture_disassembly_for_moving'], ['fix my wobbly chair', 'furniture_repair_hourly']])
    check(`A3 "${t}" is ${id}`, ent(route(E, t)) === id, ent(route(E, t)));
for (const t of ['install furniture', 'install a cupboard shelf', 'fix rod', 'organize cables'])
    check(`A4 "${t}" resolves (not a null or vetoed route)`, !['VETO', 'NULL'].includes(ent(route(E, t))), ent(route(E, t)));
for (const t of ['fix light', 'fix fixture', 'flickering light'])
    { const r = route(E, t); check(`A5 "${t}" is not guessed: the fallback carries intentCategory electric_lighting`, r._vetoed && r.intentCategory === 'electric_lighting', JSON.stringify({ v: r._vetoed, c: r.intentCategory })); }
check('A6 resolveDynamicService finds a group under its own category', !!E.resolveDynamicService('furniture_fixes_assembly', 'Install', 'minor_home_repairs_furniture'));
check('A7 Install resolves to the Mount definition where only Mount is authored', E.resolveDynamicService('wall_mounting', 'Install', null) === E.DB.dynamic_services['wall_mounting+Mount']);
console.log('C. non-vacuity');
const P1 = load(code => code.replace("const groupCat = groupObj ? (groupObj.category_id || null) : null;", 'const groupCat = null;'));
check('C1 without the group\'s own category "install furniture" has no entity again (the blank)', !route(P1, 'install furniture').entity);
const P2 = load(code => code.replace("const alt = normSt === 'Install' ? 'Mount' : normSt === 'Mount' ? 'Install' : null;", 'const alt = null;'));
check('C2 without Install = Mount "fix rod" is vetoed again', !!route(P2, 'fix rod')._vetoed);
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
  const clickText = re => page.evaluate(r => { const b = [...document.querySelectorAll('button,.chip,[role=button]')].find(x => new RegExp(r, 'i').test((x.innerText || '').trim())); if (b) { b.click(); return true; } return false; }, re);
  const noLegacy = b => !/Legacy flow/.test(b);
  errors.clear(); await type('fix fixture'); let b = await body();
  check('B4 "fix fixture" (ambiguous) is asked about (the builder asks what is wrong, or the page asks which job), not guessed, never "Legacy flow"', (/We need one more detail/.test(b) || /What's the issue\?/.test(b)) && !/Add to Cart/.test(b) && noLegacy(b) && errors.size === 0, b.slice(-600));
  errors.clear(); await type('light wont turn on'); b = await body();
  check('B2 "light wont turn on" asks which lighting job (Bulbs, Light Fixtures, Switches), never "Legacy flow"', /We need one more detail/.test(b) && /Light Fixtures/.test(b) && /Switches/.test(b) && noLegacy(b) && errors.size === 0, b.slice(0, 400));
  await clickText('^Light Fixtures$'); await sleep(1000); b = await body();
  check('B3 choosing Light Fixtures opens that group, and the question goes', /Which part\?/.test(b) && !/We need one more detail/.test(b) && errors.size === 0, b.slice(0, 400));
  errors.clear(); await type('fix curtains'); b = await body();
  check('B5 "fix curtains" shows the Blinds, Shades or Curtains card', /Blinds, Shades or Curtains/.test(b) && noLegacy(b) && errors.size === 0, b.slice(0, 400));
  errors.clear(); await type('install furniture'); await clickText('^Looks right'); await sleep(1200); b = await body();
  check('B6 "install furniture", then "Looks right", is not blank (asks what is being installed)', /What are we installing/.test(b) && noLegacy(b) && errors.size === 0, b.slice(0, 400));
  // last: the furniture selection opens the catalog's focused panel, which a real visitor leaves with Back (the restart helper does not)
  for (const t of ['furniture assembly', 'assemble furniture']) {
    errors.clear(); await type(t); const b = await body();
    check(`B1 "${t}" shows the furniture selection, never "Legacy flow"`, /Select Furniture Type/.test(b) && noLegacy(b) && errors.size === 0, b.slice(0, 300) + ' ' + [...errors].join(';'));
  }
  await browser.close();
  console.log(`\n[light window furniture] ${pass} passed, ${fail} failed (of ${pass + fail} checks)`); process.exit(fail ? 1 : 0);
})();
