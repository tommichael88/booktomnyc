#!/usr/bin/env node
/**
 * tools/charter_reflow_proof.js -- prove that a re-flow of the Charter changed line breaks and nothing else.
 *
 *   node test_harness/tools/charter_reflow_proof.js <base_PROJECT_CHARTER.html> <head_PROJECT_CHARTER.html> [--no-browser]
 *
 * #198 (T173): "no content change, proved with the DOM tool". Five independent checks, from the strongest (bytes) to the one a reader would notice (pixels):
 *
 *   A  BYTES      the base file is the head file with some "\n" characters deleted -- nothing else differs (no character removed, replaced or moved).
 *   B  TREE       both files parsed (parse5, the HTML5 algorithm): the same elements, the same attributes in the same order, the same non-whitespace text, in the same
 *                 order. The only difference allowed is whitespace-only text nodes outside <pre>/<textarea>/<script>/<style> (a line break between two blocks).
 *   C  CODE       every <style>: the same CSS tokens (css-tree), ignoring whitespace tokens. Every <script>: the same JavaScript token stream (acorn) and the same syntax
 *                 tree ignoring positions. A break inside a string, a regular expression or a template literal would change a token and fail here.
 *   D  LAYOUT     the page in a real headless Chrome (served over http, as the Charter says to open it) at three widths, every <details> closed and then open: the box of
 *      AND PIXELS every element and every text run (page and builder iframe) is identical to 0.01px, the rendered text is identical, and eight viewport screenshots down the
 *                 page are byte-identical, with the base loaded twice as a control for reproducibility.  [skipped with --no-browser]
 *   E  SCRIPTS    (run separately) tools/charter_dom_proof.js base head --ws: the builder demo in its iframe, every popover, the status band, hostile data.
 *
 * Exit 0 = every check passed. Exit 1 = a difference. Exit 2 = cannot run.
 */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const NM = path.join(__dirname, '..', 'node_modules');
const req = n => { try { return require(path.join(NM, n)); } catch { return require(n); } };
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const NO_BROWSER = process.argv.includes('--no-browser');
const [BASE, HEAD] = args;
if (!BASE || !HEAD) { console.error('usage: charter_reflow_proof.js <base.html> <head.html> [--no-browser]'); process.exit(2); }
const base = fs.readFileSync(BASE, 'utf8'), head = fs.readFileSync(HEAD, 'utf8');
let fail = 0;
const report = (ok, label, detail) => { if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ': ' + detail : ''}`); };

// ---- A bytes ----------------------------------------------------------------------------------------------------------------------------------------------------------
(function bytes() {
  let i = 0, inserted = 0, bad = -1;
  for (let j = 0; j < head.length; j++) {
    if (i < base.length && head[j] === base[i]) i++;
    else if (head[j] === '\n') inserted++;
    else { bad = j; break; }
  }
  const ok = bad < 0 && i === base.length;
  report(ok, 'A bytes: head = base + inserted line breaks only', ok ? `${inserted} line break(s) inserted, ${base.length} characters kept in order` : `first foreign character at head offset ${bad} (${JSON.stringify(head.slice(Math.max(0, bad - 20), bad + 20))})`);
})();

// ---- B tree -----------------------------------------------------------------------------------------------------------------------------------------------------------
const parse5 = req('parse5');
const RAW = new Set(['pre', 'textarea', 'title']);              // text kept exactly; <script>/<style> text is compared by check C (tokens), not here
const CODE = new Set(['script', 'style']);
function canon(src) {
  const doc = parse5.parse(src, { sourceCodeLocationInfo: true }), out = [];
  (function walk(n, rawParent, codeParent) {
    if (n.nodeName === '#text') { if (codeParent) return; if (rawParent || !/^[\t\n\f\r ]*$/.test(n.value)) out.push('T:' + JSON.stringify(n.value)); return; }
    if (n.nodeName === '#comment') { out.push('C:' + JSON.stringify(n.data)); return; }
    if (n.tagName) out.push('<' + n.tagName + (n.attrs || []).map(a => ' ' + a.name + '=' + JSON.stringify(a.value)).join(''));
    const kids = n.content ? n.content.childNodes : (n.childNodes || []);
    for (const k of kids) walk(k, rawParent || (n.tagName ? RAW.has(n.tagName) : false), codeParent || (n.tagName ? CODE.has(n.tagName) : false));
    if (n.tagName) out.push('>');
  })(doc, false, false);
  return out;
}
const cb = canon(base), ch = canon(head);
{
  let d = -1; const n = Math.max(cb.length, ch.length);
  for (let k = 0; k < n; k++) if (cb[k] !== ch[k]) { d = k; break; }
  report(d < 0, 'B tree: same elements, attributes and text (whitespace-only nodes between blocks aside)', d < 0 ? `${cb.length} nodes compared` : `first difference at node ${d}: ${JSON.stringify(cb[d])} vs ${JSON.stringify(ch[d])}`);
}

// ---- C code -----------------------------------------------------------------------------------------------------------------------------------------------------------
function rawTexts(src, tag) {
  const doc = parse5.parse(src, { sourceCodeLocationInfo: true }), out = [];
  (function walk(n) {
    if (n.tagName === tag) { const t = (n.childNodes || [])[0]; out.push({ attrs: n.attrs.map(a => a.name + '=' + a.value).join(' '), text: t && t.nodeName === '#text' ? t.value : '' }); }
    for (const k of (n.content ? n.content.childNodes : (n.childNodes || []))) walk(k);
  })(doc);
  return out;
}
(function css() {
  const csstree = req('css-tree');
  const tokens = text => { const r = [], names = Object.fromEntries(Object.entries(csstree.tokenTypes).map(([k, v]) => [v, k])); csstree.tokenize(text, (type, s, e) => { if (names[type] !== 'WhiteSpace') r.push(names[type] + ':' + text.slice(s, e)); }); return r; };
  const a = rawTexts(base, 'style'), b = rawTexts(head, 'style'); let ok = a.length === b.length, n = 0;
  for (let i = 0; ok && i < a.length; i++) { const ta = tokens(a[i].text), tb = tokens(b[i].text); n += ta.length; if (ta.length !== tb.length || ta.some((x, k) => x !== tb[k])) ok = false; }
  report(ok, 'C css: same tokens in every <style>', `${a.length} stylesheet(s), ${n} tokens`);
})();
(function js() {
  const acorn = req('acorn');
  const a = rawTexts(base, 'script'), b = rawTexts(head, 'script'); let ok = a.length === b.length, n = 0, note = '';
  const strip = (k, v) => (k === 'start' || k === 'end' || k === 'loc' || k === 'range') ? undefined : v;
  for (let i = 0; ok && i < a.length; i++) {
    if (a[i].attrs !== b[i].attrs) { ok = false; note = 'script attributes differ'; break; }
    if (/type=(?!text\/javascript|application\/javascript|module)/.test(a[i].attrs)) { if (a[i].text !== b[i].text) { ok = false; note = `data block ${a[i].attrs} differs`; } continue; }   // JSON and other data: untouched, compared whole
    let ta, tb, aa, ab;
    try {
      const lex = t => { const r = []; for (const tk of acorn.tokenizer(t, { ecmaVersion: 'latest', allowReturnOutsideFunction: true })) r.push(tk.type.label + ':' + (tk.value === undefined ? '' : String(tk.value))); return r; };
      ta = lex(a[i].text); tb = lex(b[i].text);
      aa = JSON.stringify(acorn.parse(a[i].text, { ecmaVersion: 'latest', allowReturnOutsideFunction: true }), strip); ab = JSON.stringify(acorn.parse(b[i].text, { ecmaVersion: 'latest', allowReturnOutsideFunction: true }), strip);
    } catch (e) { if (a[i].text !== b[i].text) { ok = false; note = 'unparseable script changed: ' + e.message; } continue; }
    n += ta.length;
    if (ta.length !== tb.length || ta.some((x, k) => x !== tb[k])) { ok = false; note = `script ${i}: token streams differ`; }
    else if (aa !== ab) { ok = false; note = `script ${i}: syntax trees differ`; }
  }
  report(ok, 'C js: same token stream and same syntax tree in every <script>', note || `${a.length} script(s), ${n} tokens`);
})();

// ---- D layout and pixels ----------------------------------------------------------------------------------------------------------------------------------------------
// The page is 130,000 px tall and has a fixed, blurred header and one animation, so a full-page screenshot is not reproducible even for the SAME file loaded twice (measured:
// 9 of 22 tiles differ between two loads of the base). So the proof does not lean on one: (1) LAYOUT -- every element's box and every text run's box in the page and in the
// builder iframe, to 0.01px: identical boxes mean identical layout; (2) PIXELS -- eight viewport-sized screenshots down the page with animations and transitions switched
// off. A CONTROL (the base loaded a second time) is compared with the base first, to show the method is reproducible; a method that cannot tell the base from itself proves nothing.
async function pixels() {
  let puppeteer; try { puppeteer = req('puppeteer-core'); } catch { console.error('puppeteer-core not found (use --no-browser)'); process.exit(2); }
  const chrome = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium', '/opt/pw-browsers/chromium'].filter(Boolean).find(p => fs.existsSync(p));
  if (!chrome) { console.error('No Chrome found: set CHROME_PATH'); process.exit(2); }
  const serve = html => new Promise(res => { const srv = http.createServer((q, r) => { if (q.url === '/PROJECT_CHARTER.html') { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return r.end(html); } r.writeHead(404); r.end(); }).listen(0, '127.0.0.1', () => res({ srv, url: `http://127.0.0.1:${srv.address().port}/PROJECT_CHARTER.html` })); });
  const browser = await puppeteer.launch({ headless: 'new', executablePath: chrome, args: ['--no-sandbox', '--disable-setuid-sandbox', '--force-color-profile=srgb'] });
  const sb = await serve(base), sh = await serve(head);
  const STILL = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}';
  const geometry = () => {                                     // runs in the page/frame: one string per element and per text run
    const r = e => { const b = e.getBoundingClientRect(); return [b.x, b.y, b.width, b.height].map(v => Math.round(v * 100) / 100).join(','); };
    const out = [], w = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let n = w.currentNode; n; n = w.nextNode()) {
      if (n.nodeType === 1) out.push(n.tagName + '|' + r(n));
      else if (/\S/.test(n.nodeValue)) { range.selectNodeContents(n); const b = range.getBoundingClientRect(); out.push('#|' + [b.x, b.y, b.width, b.height].map(v => Math.round(v * 100) / 100).join(',')); }
    }
    return out;
  };
  const load = async (url, width, open) => {
    const pg = await browser.newPage(); await pg.setViewport({ width, height: 900, deviceScaleFactor: 1 });
    await pg.goto(url, { waitUntil: 'load' }); await new Promise(r => setTimeout(r, 2300));
    await pg.addStyleTag({ content: STILL });
    if (open) await pg.evaluate(() => document.querySelectorAll('details').forEach(d => d.open = true));
    await new Promise(r => setTimeout(r, 300));
    const geo = [await pg.evaluate(geometry)];
    for (const f of pg.frames()) if (f !== pg.mainFrame()) { try { await f.addStyleTag({ content: STILL }); geo.push(await f.evaluate(geometry)); } catch { geo.push(['frame-unreadable']); } }
    const text = await pg.evaluate(() => document.body.innerText), h = await pg.evaluate(() => document.documentElement.scrollHeight);
    const shots = [];
    for (let k = 0; k < 8; k++) { const y = Math.floor((h - 900) * k / 7); await pg.evaluate(yy => window.scrollTo(0, yy), y); await new Promise(r => setTimeout(r, 120)); shots.push(await pg.screenshot()); }
    await pg.close(); return { geo, text, h, shots };
  };
  const eq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const geoSame = (a, b) => a.geo.length === b.geo.length && a.geo.every((g, i) => eq(g, b.geo[i]));
  const shotsSame = (a, b) => a.shots.every((s, i) => s.equals(b.shots[i]));
  try {
    for (const width of [1280, 820, 390]) for (const open of [false, true]) {
      const a = await load(sb.url, width, open), control = await load(sb.url, width, open), b = await load(sh.url, width, open);
      const nBoxes = a.geo.reduce((s, g) => s + g.length, 0);
      const ctlGeo = geoSame(a, control), ctlPx = shotsSame(a, control);
      const geoOk = geoSame(a, b), pxOk = shotsSame(a, b), txtOk = a.text === b.text && a.h === b.h;
      report(geoOk && txtOk, `D layout ${width}px, details ${open ? 'open' : 'closed'}`, `${nBoxes} boxes (${a.geo.length} document(s)), page ${a.h}px tall: ${geoOk ? 'identical' : 'DIFFERS'}; rendered text ${txtOk ? 'identical' : 'DIFFERS'}; control (base vs base) ${ctlGeo ? 'identical' : 'DIFFERS -- method not reproducible'}`);
      report(pxOk, `D pixels ${width}px, details ${open ? 'open' : 'closed'}`, `8 viewport screenshots down the page: ${pxOk ? 'byte-identical' : 'DIFFER'}; control (base vs base) ${ctlPx ? 'byte-identical' : 'DIFFERS -- method not reproducible'}`);
    }
  } finally { sb.srv.close(); sh.srv.close(); await browser.close(); }
}

(async () => {
  if (!NO_BROWSER) await pixels(); else console.log('SKIP  D pixels (--no-browser)');
  console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
