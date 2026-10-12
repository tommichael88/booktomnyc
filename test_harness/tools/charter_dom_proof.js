#!/usr/bin/env node
/**
 * tools/charter_dom_proof.js -- did a change to the Charter's embedded scripts change what a reader sees, and
 * does the new Charter still execute catalog-supplied markup?
 *
 *   node test_harness/tools/charter_dom_proof.js <base_PROJECT_CHARTER.html> <head_PROJECT_CHARTER.html>
 *
 * Written for CodeQL #196 (T173): three `innerHTML` assignments in the Charter's embedded scripts (the builder demo's
 * category tile and option popover; the status band's offline view) re-read page text as HTML. Fixing a sink must not
 * change the page, so this loads BOTH files in a real headless Chrome (served over http, the way the Charter says to open it),
 * drives the same interactions, and compares what the DOM looks like. Then it makes the sinks' inputs hostile and checks the
 * HEAD build treats them as text.
 *
 *   A  offline band + the builder demo (tiles, all four popovers, editor, chips, hint) -- base DOM must equal head DOM
 *   B  the same page with a charter-status.js sidecar present (the band's success view)  -- base DOM must equal head DOM
 *   C  hostile data: an <img onerror> in a category name, in an item (a popover option) and in the status band's
 *      data-source attribute. Reported for BASE (informational: did the payload run?) and required inert for HEAD.
 *
 * With --ws the DOM strings are compared with whitespace between tags collapsed (>\s+< becomes ><): the Charter re-flow of #198 puts line breaks between block tags, which a
 * parser keeps as whitespace-only text nodes; tools/charter_reflow_proof.js proves the rest (bytes, tree, code, layout, pixels).
 * Exit 0 = A and B identical and C inert in HEAD. Exit 1 = a difference or an executed payload. Exit 2 = cannot run.
 * Needs puppeteer-core and a Chrome (CHROME_PATH, or the usual locations).
 */
'use strict';
const fs = require('fs'), http = require('http');
const WS = process.argv.includes('--ws');                 // compare with whitespace between tags collapsed: for a re-flow (#198), where the only difference is a line break between two tags
const [BASE, HEAD] = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!BASE || !HEAD) { console.error('usage: charter_dom_proof.js <base.html> <head.html>'); process.exit(2); }
let puppeteer; try { puppeteer = require('puppeteer-core'); } catch { console.error('puppeteer-core not found'); process.exit(2); }
const chrome = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium', '/opt/pw-browsers/chromium']
  .filter(Boolean).find(p => fs.existsSync(p));
if (!chrome) { console.error('No Chrome found: set CHROME_PATH'); process.exit(2); }

const SIDECAR = "window.CHARTER_STATUS={orientationHTML:'<p>Sidecar <b>state</b></p>',radarCount:3};";
const norm = s => s.replace(/status-body-inner-[a-z0-9]+/g, 'status-body-inner-X');
const nw = s => WS ? s.replace(/>[\t\n\f\r ]+</g, '><') : s;

function serve(html, sidecar) {
  return new Promise(res => {
    const srv = http.createServer((q, r) => {
      if (q.url === '/PROJECT_CHARTER.html') { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return r.end(html); }
      if (sidecar && q.url === '/charter-status.js') { r.writeHead(200, { 'content-type': 'text/javascript' }); return r.end(SIDECAR); }
      r.writeHead(404); r.end();
    }).listen(0, '127.0.0.1', () => res({ srv, url: `http://127.0.0.1:${srv.address().port}/PROJECT_CHARTER.html` }));
  });
}

// Make the sinks' inputs hostile. Anchors are structural (the SSOT JSON's first category / first item, the band's data-source).
function hostile(html) {
  const a = html.replace(/("categories":\[\{"id":"[^"]*","name":")[^"]*(")/, '$1<img src=x onerror=top.__pwn_tile=1>$2');
  const b = a.replace(/("items":\[")[^"]*(")/, '$1<img src=x onerror=top.__pwn_pop=1>$2');
  const c = b.replace(/data-source="[^"]*"/, `data-source='x"><img src=x onerror=window.__pwn_src=1>'`);
  if (a === html || b === a || c === b) { console.error('hostile(): an anchor was not found in the Charter'); process.exit(2); }
  return c;
}

async function snapshot(browser, url) {
  const pg = await browser.newPage(); await pg.setViewport({ width: 1280, height: 900 });
  const errs = []; pg.on('pageerror', e => errs.push(String(e.message || e)));
  await pg.goto(url, { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 2300));                      // the sidecar probe times out at 1500ms
  const out = {};
  out.liveStatus = nw(norm(await pg.$eval('#live-status', e => e.outerHTML)));
  out.bandLinks = await pg.$$eval('#live-status a', as => as.map(a => a.getAttribute('href')));
  const fr = pg.frames().find(f => f !== pg.mainFrame());
  if (!fr) { out.noFrame = true; await pg.close(); return { out, errs }; }
  await fr.waitForSelector('#tiles .tile', { timeout: 5000 });
  const snap = async tag => {
    out[tag] = {};
    for (const id of ['tiles', 'preview', 'hint', 'editor', 'chips']) out[tag][id] = nw(await fr.$eval('#' + id, e => e.outerHTML));
  };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await snap('boot');
  for (const slot of ['qty', 'items', 'action', 'location']) {                // open every popover, record it, pick its 2nd option
    await fr.click(`#preview .slot[data-slot="${slot}"]`); await fr.waitForSelector('.pop.show');
    out['pop_' + slot] = nw(await fr.$eval('.pop', e => e.outerHTML));
    const opts = await fr.$$('.pop .opt'); out['pop_' + slot + '_n'] = opts.length;
    await opts[Math.min(1, opts.length - 1)].click(); await wait(300);
  }
  await snap('picked');
  await fr.click('#editBtn'); await snap('editor_open');
  const tiles = await fr.$$('#tiles .tile'); out.tileCount = tiles.length;
  await tiles[2].click(); await snap('tile_2');
  await fr.type('#freeText', 'I need 2 shelf mounted in the kitchen urgent'); await wait(200); await snap('typed');
  await fr.click('#preview .slot[data-slot="items"]'); await fr.waitForSelector('.pop.show');
  out.pop_typed = nw(await fr.$eval('.pop', e => e.outerHTML));
  await fr.click('.pop .opt-clear'); await wait(300); await snap('cleared');
  await pg.close(); return { out, errs };
}

async function payloads(browser, url) {
  const pg = await browser.newPage();
  await pg.goto(url, { waitUntil: 'load' }); await new Promise(r => setTimeout(r, 2300));
  const fr = pg.frames().find(f => f !== pg.mainFrame()); await fr.waitForSelector('#tiles .tile');
  await fr.click('#preview .slot[data-slot="items"]'); await fr.waitForSelector('.pop.show'); await new Promise(r => setTimeout(r, 400));
  const r = await pg.evaluate(() => ({ tile: window.__pwn_tile === 1, pop: window.__pwn_pop === 1, src: window.__pwn_src === 1 }));
  r.imgs = (await fr.$$eval('#tiles img, .pop img', x => x.length)) + (await pg.$$eval('#live-status img', x => x.length));
  await pg.close(); return r;
}

(async () => {
  const baseHtml = fs.readFileSync(BASE, 'utf8'), headHtml = fs.readFileSync(HEAD, 'utf8');
  const browser = await puppeteer.launch({ headless: 'new', executablePath: chrome, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  let fail = 0; const servers = [];
  const open = async (html, sidecar) => { const s = await serve(html, sidecar); servers.push(s.srv); return s.url; };
  try {
    for (const [label, sidecar] of [['A offline band + builder demo', false], ['B sidecar band + builder demo', true]]) {
      const b = await snapshot(browser, await open(baseHtml, sidecar)), h = await snapshot(browser, await open(headHtml, sidecar));
      const keys = [...new Set([...Object.keys(b.out), ...Object.keys(h.out)])];
      const diff = keys.filter(k => JSON.stringify(b.out[k]) !== JSON.stringify(h.out[k]));
      const errs = b.errs.length + h.errs.length;
      const ok = !diff.length && !errs && !b.out.noFrame;
      if (!ok) fail++;
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: ${keys.length} snapshot keys compared, ${diff.length} differ${diff.length ? ' (' + diff.join(', ') + ')' : ''}; page errors base/head: ${b.errs.length}/${h.errs.length}`);
    }
    const pb = await payloads(browser, await open(hostile(baseHtml), false)), ph = await payloads(browser, await open(hostile(headHtml), false));
    const ran = o => ['tile', 'pop', 'src'].filter(k => o[k]);
    console.log(`INFO  C hostile data, BASE: payloads that ran = [${ran(pb).join(', ')}], injected <img> elements = ${pb.imgs}`);
    const inert = !ran(ph).length && ph.imgs === 0;
    if (!inert) fail++;
    console.log(`${inert ? 'PASS' : 'FAIL'}  C hostile data, HEAD: payloads that ran = [${ran(ph).join(', ')}], injected <img> elements = ${ph.imgs}`);
  } finally { servers.forEach(s => s.close()); await browser.close(); }
  console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
