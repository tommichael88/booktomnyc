#!/usr/bin/env node
/**
 * verify_entity_shape_single.js -- R-INVARIANT-CANONICAL (one representation of a thing) for the service-like entity.
 *
 * A "service-like entity" is whatever a renderer is handed: a real service, a resolved dynamic entity, a synthetic "Other" tile. The SSOT has ONE shape for it
 * (ui_taxonomy.display_name / ui_taxonomy.group_id / financial_engine.base_price / default_estimates.disclaimer). The retired legacy pipeline used a flat shape
 * (svc.display_name, svc.group_id, svc.base_price, svc.estimate_disclaimer). T148 found eight readers still carrying `|| svc.<flat field>` fallbacks to that dead
 * shape: dead code that pretends a second representation exists, and (because a typo in the primary path then falls through silently to 0 / undefined) the same
 * silent-failure shape as the T69 misspelled-field bug. They were deleted only after the behavior proved them dead; this test keeps them dead.
 *
 * Three layers, because a name heuristic alone gave three false positives in the unified suite (R-INVARIANT-VERIFY infers an object's type from its VARIABLE NAME):
 *   1. UNIT   -- the classifier and the scanner can fail (a flat entity is flagged; a clean one is not).
 *   2. STATIC -- no reader of qr.html falls back to a flat legacy field on an entity identifier (comments excluded).
 *   3. BEHAVIOR (real browser) -- enumerate EVERY entity the page can produce (all real services, every group x dynamic type through the real resolver, every Other
 *      tile through the real builder) and require that none carries a flat legacy field. Population floors keep it from passing on an empty enumeration.
 * Skips layer 3 (loudly) only if no Chrome / puppeteer-core exists, exactly as the smoke test does.
 */
'use strict';
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'qr.html');
const FLAT = ['display_name', 'group_id', 'base_price', 'estimate_disclaimer', 'group'];

let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log('  \u2713 ' + name); } else { fail++; console.log('  \u2717 ' + name + (detail ? '\n      ' + detail : '')); } };

function flatFieldsOn(entity) { return FLAT.filter(f => Object.prototype.hasOwnProperty.call(entity || {}, f)); }

function scanFlatReads(src) {
  const hits = [];
  src.split('\n').forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    const code = line.replace(/\/\/.*$/, '');
    const re = /(?<![\w.$])(svc|entity|tile)\??\.(base_price|display_name|group_id|estimate_disclaimer)\b/g;
    let m; while ((m = re.exec(code))) hits.push({ line: i + 1, text: m[0] });
    if (/\bs\.ui_taxonomy\?\.group_id\s*\|\|\s*s\.group/.test(code)) hits.push({ line: i + 1, text: 's.group_id / s.group fallback' });
  });
  return hits;
}

function findChrome() {
  const candidates = [process.env.CHROME_PATH, ...(() => { try { return execSync('find /home/*/.cache/puppeteer /root/.cache/puppeteer -type f -name chrome 2>/dev/null || true', { shell: '/bin/bash' }).toString().trim().split('\n').filter(Boolean); } catch { return []; } })(), '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'].filter(Boolean);
  for (const c of candidates) if (c && fs.existsSync(c)) return c;
  return null;
}

(async () => {
  console.log('\n=== 1. unit: the classifier and the scanner can fail ===');
  check('a flat-shaped entity is flagged', JSON.stringify(flatFieldsOn({ id: 'x', base_price: 5, display_name: 'X' })) === JSON.stringify(['display_name', 'base_price']));
  check('an SSOT-shaped entity is not flagged', flatFieldsOn({ id: 'x', ui_taxonomy: { display_name: 'X', group_id: 'g' }, financial_engine: { base_price: 5 } }).length === 0);
  check('the scanner flags a fallback to a flat field', scanFlatReads('const n = svc.ui_taxonomy?.display_name || svc.display_name || "x";').length === 1);
  check('the scanner flags the three-way group fallback', scanFlatReads('const parent = s.ui_taxonomy?.group_id || s.group_id || s.group;').length === 1);
  check('the scanner ignores the SSOT path and comments', scanFlatReads('const n = svc.ui_taxonomy?.display_name || "x";\n// was: svc.display_name || svc.base_price\n * svc.group_id').length === 0);

  console.log('\n=== 2. static: no reader falls back to the retired flat shape ===');
  const hits = scanFlatReads(require('./_page.js').readPage(HTML_PATH));
  check('qr.html has no `svc | entity | tile` read of base_price / display_name / group_id / estimate_disclaimer outside comments, and no s.group fallback',
    hits.length === 0, hits.slice(0, 8).map(h => 'L' + h.line + ' ' + h.text).join(' | '));

  console.log('\n=== 3. behavior: every entity the page can hand a renderer carries only the SSOT shape ===');
  const chromePath = findChrome(); let puppeteer = null;
  try { puppeteer = require('puppeteer-core'); } catch { /* handled below */ }
  if (!chromePath || !puppeteer) {
    console.log('  \u26a0 ' + (!chromePath ? 'no Chrome/Chromium binary found' : 'puppeteer-core not installed') + ' -- the behavioral layer was SKIPPED (environment gap, not a code failure).');
  } else {
    const data = fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8');
    const browser = await puppeteer.launch({ headless: 'new', executablePath: chromePath, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
      const page = await browser.newPage(); await page.setRequestInterception(true);
      page.on('request', r => { const _d = require('./_page.js').documentResponse(r.url()); if (_d) return r.respond(_d); r.url().includes('btnyc.json') ? r.respond({ status: 200, contentType: 'application/json', body: data }) : r.continue(); });
      await page.goto('file://' + HTML_PATH, { waitUntil: 'networkidle0', timeout: 60000 });
      await page.waitForFunction(() => window.DB && window.DB.services, { timeout: 15000 });
      const census = await page.evaluate((FLATNAMES) => {
        const rows = { services: { n: 0, flat: {} }, dynamic: { n: 0, flat: {} }, other: { n: 0, flat: {} } };
        const note = (kind, e, id) => { rows[kind].n++; for (const f of FLATNAMES) if (Object.prototype.hasOwnProperty.call(e, f)) (rows[kind].flat[f] = rows[kind].flat[f] || []).push(id); };
        for (const s of DB.services) note('services', s, s.id);
        const groups = DB.group || []; const gm = new Map(groups.map(g => [g.id, g]));
        for (const g of groups) {
          const cat = g.category_id || g.category || (g.ui_taxonomy && g.ui_taxonomy.category_id);
          for (const t of (g.dynamic_service_types || [])) { try { const e = resolveDynamicService(cat, t, g.id); if (e) note('dynamic', e, g.id + '|' + t); } catch (x) { /* an unresolvable pair is not an entity */ } }
          const real = DB.services.filter(s => (s.ui_taxonomy && s.ui_taxonomy.group_id) === g.id);
          for (const tile of buildOtherTilesForGroup(real, g.id, gm, DB)) note('other', tile, tile.id);
        }
        return { groups: groups.length, dbGroups: (DB.group || []).length, rows };
      }, FLAT);
      const R = census.rows, show = k => JSON.stringify(R[k].flat);
      check(`population: every real service enumerated (${R.services.n} >= 70)`, R.services.n >= 70);
      check(`population: dynamic entities enumerated through the real resolver (${R.dynamic.n} >= 50)`, R.dynamic.n >= 50);
      check(`population: Other tiles enumerated through the real builder (${R.other.n} >= 10)`, R.other.n >= 10);
      check('population: every group was visited', census.groups === census.dbGroups && census.groups > 0);
      check('no real service carries a flat legacy field', Object.keys(R.services.flat).length === 0, show('services'));
      check('no resolved dynamic entity carries a flat legacy field', Object.keys(R.dynamic.flat).length === 0, show('dynamic'));
      check('no Other tile carries a flat legacy field', Object.keys(R.other.flat).length === 0, show('other'));
    } finally { await browser.close(); }
  }
  console.log(`\n[Entity shape, one representation] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR', e.message); process.exit(2); });
