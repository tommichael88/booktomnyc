#!/usr/bin/env node
/**
 * verify_boot_failure_visible.js
 *
 * @enforces R-SYSTEM-NODATA, R-INVARIANT-PROVENANCE, R-SYSTEM-LAYERS
 *
 * WHAT THIS PROVES (the T157 live-site report: "the SmartQuote text input is totally absent under the category grid").
 *
 * THE DEFECT, reproduced from the exact files then deployed. The category grid exists as STATIC HTML in qr.html, so it shows even when `init()` never finishes; the text bar is
 * injected only by `initSmartQuote()`, late in `init()`. The T155 boot gate fetched the schema from a path it hard-coded (`./btnyc_schema.json`, beside the data) while the SSOT
 * itself declares `"$schema": ".../schema/btnyc_schema.json"` and the operator publishes it there. The root copy was a stale file from another generation of the schema, so the
 * (correct, T156) data failed it with 907 problems, `init()` stopped at the gate, and the visitor saw an inert grid with no input and a three-second toast.
 *
 * Two independent faults, so two independent claims:
 *   1. THE SCHEMA IS READ FROM WHERE THE SSOT SAYS IT LIVES. `orch_resolve_schema_location(data)` returns `{ path, source }` (R-INVARIANT-PROVENANCE): the path of `$schema`
 *      relative to the data's own `$id`, source 'ssot.$schema' -- or the old default with source 'default' when the data declares nothing usable. It never points off-site or
 *      outside the data's directory. In a real browser, with the stale schema left at the root and the right one in schema/, the page boots and the text input is visible.
 *   2. A BOOT FAILURE IS NEVER A SILENT HALF-PAGE. When `init()` fails before the live grid exists, the visitor gets a visible panel (`#bootFailure`) that says so, carries the
 *      reason for whoever has to fix it, and the dead static grid is hidden; when it fails AFTER the live grid exists, the panel appears and the working grid is left alone.
 *
 * Each claim is shown able to fail (R-INVARIANT-PREFIX: this file was run against the pre-change page first and was red there) and three source mutants are caught.
 * Skips (loudly: "environment gap") only if there is no Chrome / puppeteer-core, exactly as the other browser tests do.
 */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm'), { execSync } = require('child_process');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..');
const QR = process.env.QR_HTML || path.join(ROOT, 'qr.html');
const SRC = require('./_page.js').readPage(QR);
const DATA = fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8');
const SCHEMA = fs.readFileSync(path.join(ROOT, 'schema', 'btnyc_schema.json'), 'utf8');
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (detail ? '\n      ' + detail : '')); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function findChrome() { const c = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium', ...(() => { try { return execSync('find /home/*/.cache/puppeteer /root/.cache/puppeteer -type f -name chrome 2>/dev/null || true', { shell: '/bin/bash' }).toString().trim().split('\n').filter(Boolean); } catch { return []; } })(), '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'].filter(Boolean); return c.find(p => fs.existsSync(p)) || null; }

// A schema from "another generation": the real one with one more required key, which is what a stale copy looks like to the real data.
const STALE_SCHEMA = (() => { const s = JSON.parse(SCHEMA); s.properties.global_rules.required = [...s.properties.global_rules.required, 'force_modules_by_variability']; return JSON.stringify(s); })();

// ── scenario runner: one real page load, files served by request interception ─────────────────────────────────────────────────────────────────────────────────────────────
async function boot(puppeteer, chromePath, htmlPath, files, after) {
  const out = { errors: [], warnings: [], requests: [] };
  const browser = await puppeteer.launch({ headless: 'new', executablePath: chromePath, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 2200 }); await page.setRequestInterception(true);
    page.on('request', r => {
      const u = r.url();
      const _d = require('./_page.js').documentResponse(u); if (_d) return r.respond(_d); if (!u.startsWith('file://')) return r.abort();               // no network: everything external is out of the test
      const rel = decodeURIComponent(u.replace(/^file:\/\/.*?\/__site__\//, '')).split('?')[0];
      if (u.includes('/__site__/')) { if (rel === path.basename(htmlPath)) return r.continue(); out.requests.push(rel); const f = files[rel]; if (f === undefined || f === null) return r.respond({ status: 404, contentType: 'text/plain', body: 'nf' }); if (typeof f === 'number') return r.respond({ status: f, contentType: 'text/plain', body: 'x' }); return r.respond({ status: 200, contentType: 'application/json', body: f }); }
      return r.continue();
    });
    page.on('pageerror', e => out.errors.push(String(e.message).slice(0, 160)));
    page.on('console', m => { if (m.type() === 'warning' || m.type() === 'warn') out.warnings.push(m.text().slice(0, 220)); });
    await page.goto('file://' + htmlPath, { waitUntil: 'networkidle0', timeout: 60000 }); await sleep(1200);
    out.state = await page.evaluate(() => {
      const vis = e => !!e && e.getClientRects().length > 0 && e.offsetHeight > 0 && getComputedStyle(e).visibility !== 'hidden';
      const g = document.getElementById('category-card'), ta = document.getElementById('sqDescIn'), bf = document.getElementById('bootFailure');
      const gr = g && g.getBoundingClientRect(), tr = ta && ta.getBoundingClientRect();
      return { ssot: window.__ssotValidation || null, gridVisible: vis(g), gridKids: g ? g.children.length : 0, inputVisible: vis(ta), inputBelowGrid: !!(gr && tr && vis(g) && tr.top >= gr.bottom - 1),
        panelVisible: vis(bf), panelText: bf ? bf.innerText : '', panelDetails: bf ? (bf.querySelector('details') ? bf.querySelector('details').textContent : '') : '', panelHasLink: !!(bf && bf.querySelector('a[href]')), hasDB: !!window.DB };
    });
    if (after) { try { out.after = await after(page); } catch (e) { out.after = { error: String(e.message).slice(0, 120) }; } }
    return out;
  } finally { await browser.close(); }
}

(async () => {
  console.log('=== 1. the schema location comes from the SSOT (pure resolver, {path, source}) ===');
  const { engine } = require('./_engine.js');
  const sb = { console }; sb.window = sb; vm.createContext(sb); vm.runInContext(engine(QR).wrapper, sb, { filename: 'engine-modules' });
  const resolve = typeof sb.orch_resolve_schema_location === 'function' ? sb.orch_resolve_schema_location : null;
  check('the orchestrator module carries orch_resolve_schema_location', !!resolve);
  const ID = 'https://tommichael88.github.io/booktomnyc/btnyc.json';
  const R = d => resolve ? JSON.parse(JSON.stringify(resolve(d))) : { path: null, source: null };
  const DEFAULT = './btnyc_schema.json';
  const cases = [
    ['the real data declares schema/ beside its $id', { $id: ID, $schema: 'https://tommichael88.github.io/booktomnyc/schema/btnyc_schema.json' }, { path: './schema/btnyc_schema.json', source: 'ssot.$schema' }],
    ['a schema declared beside the data is read beside the data', { $id: ID, $schema: 'https://tommichael88.github.io/booktomnyc/btnyc_schema.json' }, { path: './btnyc_schema.json', source: 'ssot.$schema' }],
    ['a deeper folder is followed', { $id: ID, $schema: 'https://tommichael88.github.io/booktomnyc/a/b/s.json' }, { path: './a/b/s.json', source: 'ssot.$schema' }],
    ['no $schema -> the default, and it says so', { $id: ID }, { path: DEFAULT, source: 'default' }],
    ['no $id -> the default (nothing to be relative to)', { $schema: 'https://tommichael88.github.io/booktomnyc/schema/btnyc_schema.json' }, { path: DEFAULT, source: 'default' }],
    ['a schema on another host is never chased', { $id: ID, $schema: 'https://evil.example/booktomnyc/schema/btnyc_schema.json' }, { path: DEFAULT, source: 'default' }],
    ['a schema outside the data\'s directory is never chased', { $id: ID, $schema: 'https://tommichael88.github.io/other/btnyc_schema.json' }, { path: DEFAULT, source: 'default' }],
    ['a traversal attempt is refused', { $id: ID, $schema: 'https://tommichael88.github.io/booktomnyc/../etc/btnyc_schema.json' }, { path: DEFAULT, source: 'default' }],
    ['a non-.json target is refused', { $id: ID, $schema: 'https://tommichael88.github.io/booktomnyc/schema/run.js' }, { path: DEFAULT, source: 'default' }],
    ['a query string or odd characters are refused', { $id: ID, $schema: 'https://tommichael88.github.io/booktomnyc/schema/s.json?x=1' }, { path: DEFAULT, source: 'default' }],
    ['non-string fields -> the default', { $id: 5, $schema: {} }, { path: DEFAULT, source: 'default' }],
    ['null / undefined / a string -> the default, no throw', null, { path: DEFAULT, source: 'default' }]
  ];
  for (const [label, input, want] of cases) { let got; try { got = R(input); } catch (e) { got = { threw: e.message }; } check(label, got.path === want.path && got.source === want.source, JSON.stringify(got)); }
  { let got; try { got = R(undefined); } catch (e) { got = { threw: e.message }; } check('undefined -> the default, no throw', got.path === DEFAULT && got.source === 'default', JSON.stringify(got)); }
  check('the real btnyc.json resolves to the schema/ location its own $schema names', (() => { const d = JSON.parse(DATA); const g = R(d); return g.path === './schema/btnyc_schema.json' && g.source === 'ssot.$schema'; })(), JSON.stringify(R(JSON.parse(DATA))));

  const chromePath = findChrome(); let puppeteer = null; try { puppeteer = require('puppeteer-core'); } catch { /* handled below */ }
  if (!chromePath || !puppeteer) { console.log('\n  environment gap: no Chrome / puppeteer-core here -- sections 2-4 (the real-browser half) were SKIPPED. Set CHROME_PATH to run them.'); console.log(`\n[boot failure visible] ${pass} passed, ${fail} failed (of ${pass + fail} checks) -- browser half SKIPPED\n`); process.exit(fail ? 1 : 0); }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bootfail-'));
  // the page lives at <tmp>/__site__/qr.html so every sibling request is recognisable and served from `files`
  const siteDir = path.join(tmp, '__site__'); fs.mkdirSync(siteDir, { recursive: true });
  const pageFor = (name, text) => { const f = path.join(siteDir, name); fs.writeFileSync(f, text); return f; };
  const LAYOUT = { 'btnyc.json': DATA, 'schema/btnyc_schema.json': SCHEMA, 'btnyc_schema.json': STALE_SCHEMA };   // the deployed repo: right schema in schema/, a stale copy at the root

  console.log('\n=== 2. the deployed layout (right schema in schema/, a stale copy at the root): the page boots and the text input is there ===');
  const page = pageFor('qr.html', SRC);
  const a = await boot(puppeteer, chromePath, page, LAYOUT);
  check('the SSOT validates against the schema it declares', a.state.ssot && a.state.ssot.status === 'valid', JSON.stringify(a.state.ssot && { s: a.state.ssot.status, n: a.state.ssot.errors.length, first: a.state.ssot.errors[0] }));
  check('the status says which schema was used and where that came from', !!(a.state.ssot && a.state.ssot.schema && a.state.ssot.schema.path === './schema/btnyc_schema.json' && a.state.ssot.schema.source === 'ssot.$schema'), JSON.stringify(a.state.ssot && a.state.ssot.schema));
  check('the stale root schema is never requested', !a.requests.includes('btnyc_schema.json'), a.requests.join(', '));
  check('the live category grid is rendered (6 tiles)', a.state.gridVisible && a.state.gridKids === 6);
  check('THE REPORTED SYMPTOM: the SmartQuote text input is visible, under the category grid', a.state.inputVisible && a.state.inputBelowGrid, JSON.stringify({ input: a.state.inputVisible, below: a.state.inputBelowGrid }));
  check('no boot-failure panel on a healthy boot', !a.state.panelVisible);
  check('no uncaught page error', a.errors.length === 0, a.errors.join(' | '));

  console.log('\n=== 3. a schema that cannot be read does not break the page, and says so (PENDING_DECISIONS #119) ===');
  const b = await boot(puppeteer, chromePath, page, { 'btnyc.json': DATA, 'btnyc_schema.json': SCHEMA });   // nothing at schema/ : the declared location is missing
  check('the page still boots and the text input is visible', b.state.hasDB && b.state.inputVisible);
  check('status is \'unavailable\' and no other location is tried instead (one source, no fallback chain)', b.state.ssot && b.state.ssot.status === 'unavailable' && !b.requests.includes('btnyc_schema.json'), JSON.stringify({ s: b.state.ssot && b.state.ssot.status, req: b.requests }));
  check('a warning names the path that was not found', b.warnings.some(w => w.includes('schema/btnyc_schema.json')), JSON.stringify(b.warnings));

  console.log('\n=== 4. a boot failure is never a silent half-page ===');
  const bad = JSON.parse(DATA); delete bad.workflow;
  const c = await boot(puppeteer, chromePath, page, { 'btnyc.json': JSON.stringify(bad), 'schema/btnyc_schema.json': SCHEMA });
  check('data that fails the schema: the visitor sees a boot-failure panel', c.state.panelVisible, JSON.stringify({ panel: c.state.panelVisible }));
  check('...the dead static grid is hidden (its tiles have no handlers; tapping them does nothing)', !c.state.gridVisible);
  check('...the panel names the problem for whoever has to fix it (path and reason) inside a details element', /workflow/.test(c.state.panelDetails) && /schema/i.test(c.state.panelDetails), c.state.panelDetails.slice(0, 200));
  check('...and offers a way out (a refresh link)', c.state.panelHasLink);
  check('...and does not pretend the text input exists', !c.state.inputVisible);
  const d = await boot(puppeteer, chromePath, page, { 'btnyc.json': 500, 'schema/btnyc_schema.json': SCHEMA });
  check('data that cannot be fetched: the same panel, with the HTTP status in its details', d.state.panelVisible && /500/.test(d.state.panelDetails) && !d.state.gridVisible, JSON.stringify({ panel: d.state.panelVisible, det: d.state.panelDetails.slice(0, 120), grid: d.state.gridVisible }));
  const e = await boot(puppeteer, chromePath, page, LAYOUT, async p => {
    await p.evaluate(() => { window.renderBootFailure({ stage: 'running', message: 'late failure', details: ['x'] }); });
    return p.evaluate(() => { const g = document.getElementById('category-card'), bf = document.getElementById('bootFailure'); return { grid: !!g && g.offsetHeight > 0 && getComputedStyle(g).display !== 'none', input: !!document.getElementById('sqDescIn'), panel: !!bf && bf.offsetHeight > 0 }; });
  });
  check('a failure AFTER the live grid exists shows the panel but leaves the working grid and text input alone', e.after && e.after.panel && e.after.grid && e.after.input, JSON.stringify(e.after));
  check('a healthy boot shows no panel', !e.state.panelVisible);

  console.log('\n--- mutants: each restored defect is caught ---');
  const mut = async (name, mutate, files, pred) => { const m = mutate(SRC); if (m === SRC) throw new Error('mutant anchor missing: ' + name); return pred(await boot(puppeteer, chromePath, pageFor(name + '.html', m), files)); };
  const M1 = await mut('m1_oldpath', t => t.replace(/const _loc = orch_resolve_schema_location\(SERVICE_DATA\);/, "const _loc = { path: './btnyc_schema.json', source: 'default' };"), LAYOUT, r => r);
  check('MUTANT 1 (the gate reads the hard-coded root path again) is caught: the stale schema rejects the data and the text input is gone', !M1.state.inputVisible && (!M1.state.ssot || M1.state.ssot.status !== 'valid'), JSON.stringify({ input: M1.state.inputVisible, ssot: M1.state.ssot && M1.state.ssot.status }));
  const M2 = await mut('m2_silent', t => t.replace(/renderBootFailure\(\{\s*stage: _bootStage/, "void ({ stage: _bootStage"), { 'btnyc.json': JSON.stringify(bad), 'schema/btnyc_schema.json': SCHEMA }, r => r);
  check('MUTANT 2 (init\'s catch goes back to a toast only) is caught: no panel, and the dead grid is still showing', !M2.state.panelVisible && M2.state.gridVisible, JSON.stringify({ panel: M2.state.panelVisible, grid: M2.state.gridVisible }));
  const M3after = await (async () => { const m = SRC.replace(/if \(info\.stage !== 'running'\) \{/, 'if (true) {'); if (m === SRC) throw new Error('mutant anchor missing: m3'); return boot(puppeteer, chromePath, pageFor('m3b.html', m), LAYOUT, async p => { await p.evaluate(() => { window.renderBootFailure({ stage: 'running', message: 'late', details: [] }); }); return p.evaluate(() => { const g = document.getElementById('category-card'); return { grid: !!g && g.offsetHeight > 0 && getComputedStyle(g).display !== 'none' }; }); }); })();
  check('MUTANT 3 (the panel hides the grid whatever the stage) is caught: a working grid disappears on a late failure', M3after.after && M3after.after.grid === false, JSON.stringify(M3after.after));

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n[boot failure visible] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR', e.stack || e.message); process.exit(2); });
