#!/usr/bin/env node
/**
 * verify_intake_card_presentation.js -- what the customer SEES when the intake question card is on screen (T158).
 *
 * @enforces R-INVARIANT-BOUNDARY
 *
 * TWO DEFECTS, both found by looking at the page in a real browser rather than reading its markup, and both invisible to every test that read the DOM tree or the CSS text.
 *
 *   1. THE GRID STAYED UP BESIDE THE CARD. #serviceContainer is `class="group-grid"`. The page's CSS said `.group-grid{display:grid!important;...}`; showIntakeQuestions hides the
 *      grid with an inline `style.display='none'`; an inline style loses to `!important`, so the group tiles stayed on screen above the intake card (computed display `grid`, 340px tall,
 *      with the card under it). The fix is in the stylesheet (no `!important`) and in the restore path (`style.display=''`, not `'block'`, so the class's grid layout is not replaced).
 *   2. A BLACK BAR BEHIND THE SERVICE DESCRIPTION. `#intakeQuestionsContainer p{background:#000;...}` is a rule from the dark focused-mode theme. Every paragraph the renderers put in that container
 *      sets its own colour for a LIGHT card (#555, #666), so the description rendered as dark grey on a solid black fill: contrast 2.82:1, on 75 of the 76 plain intake cards.
 *
 * WHAT THIS HOLDS, in Chromium, at a desktop (1280) and a phone (375) width:
 *   A. BROWSING: after a category tap the group grid is on screen with more than one tile per row (the class's grid layout, not a stack), and the page does not scroll sideways.
 *   B. THE INTAKE CARD REPLACES THE GRID: with the card up, #serviceContainer's COMPUTED display is none and it occupies no space; the card is visible, inside the viewport horizontally.
 *      On the real tap journey (category -> tile -> tile ...), the grid and the card are never both on screen at any step.
 *   C. BACK, AND BACK AGAIN: restoreCategoryView() hides the card and returns to the category cards (in columns); tapping a category AGAIN brings the group grid back in columns -- the inline
 *      `display:none` the card left on it must not stick.
 *   D. THE CARD IS READABLE: for EVERY service the app can open an intake card for (the population is DB.services, not a list), every piece of text in the card whose background is a known
 *      solid fill has WCAG contrast >= 4.5:1. Text over a gradient, an image or the translucent page background cannot be judged from here and is counted, not guessed.
 *   E. NON-VACUITY. Five mutants of the page are driven the same way and each must trip ITS OWN check (not merely some check): the `!important` back on .group-grid; the grid-hiding line
 *      removed from showIntakeQuestions; the restore path setting display 'block'; the display reset after the card removed; the black paragraph rule restored.
 *
 * Needs a Chrome (CHROME_PATH, the usual locations, or /opt/pw-browsers). With none, this test FAILS rather than skipping: a behavioral test that silently does not run is a false
 * statement of coverage (DEFECT-SILENT-SKIP). BTNYC_QR_FILE=<file> runs sections A-D against any copy of qr.html.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const PAGE = require('./_page.js');

const ROOT = path.resolve(__dirname, '..');
const QR = process.env.BTNYC_QR_FILE ? path.resolve(process.env.BTNYC_QR_FILE) : path.join(ROOT, 'qr.html');
const SSOT = fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8');
const SCHEMA = fs.readFileSync(path.join(ROOT, 'schema', 'btnyc_schema.json'), 'utf8');

let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log('  ✓ ' + m); };
const bad = (m, d) => { fail++; console.log('  ✗ ' + m + (d ? '\n      ' + String(d).split('\n').join('\n      ') : '')); };
const check = (c, okMsg, badMsg, d) => (c ? ok(okMsg) : bad(badMsg || okMsg, d));

function findChrome() {
    const c = [process.env.CHROME_PATH];
    try { c.push(...execSync('find /home/*/.cache/puppeteer /root/.cache/puppeteer -type f -name chrome 2>/dev/null || true', { shell: '/bin/bash' }).toString().trim().split('\n')); } catch (e) { /* ignore */ }
    c.push('/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium', '/opt/pw-browsers/chromium');
    return c.filter(Boolean).find(p => fs.existsSync(p));
}

// ---- in-page measurement (runs in the browser) ----------------------------------------------------------------------------------------------------------------------------------
const MEASURE = () => {
    const vis = el => { if (!el) return false; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const perRowOf = kids => { const tops = kids.map(k => Math.round(k.getBoundingClientRect().top / 4)); return tops.length ? Math.max(...Object.values(tops.reduce((a, t) => (a[t] = (a[t] || 0) + 1, a), {}))) : 0; };
    const grid = document.getElementById('serviceContainer'), card = document.getElementById('intakeQuestionsContainer'), cats = document.getElementById('category-card');
    const kids = grid ? [...grid.children].filter(vis) : [], catKids = cats ? [...cats.children].filter(vis) : [];
    const gr = grid ? grid.getBoundingClientRect() : null, cr = card ? card.getBoundingClientRect() : null;
    return {
        gridDisplay: grid ? getComputedStyle(grid).display : null, gridVisible: vis(grid), gridHeight: gr ? Math.round(gr.height) : 0, gridTiles: kids.length, gridPerRow: perRowOf(kids),
        catVisible: vis(cats), catTiles: catKids.length, catPerRow: perRowOf(catKids),
        cardVisible: vis(card), cardHeight: cr ? Math.round(cr.height) : 0, cardLeft: cr ? Math.round(cr.left) : 0, cardRight: cr ? Math.round(cr.right) : 0,
        cardText: card ? (card.innerText || '').slice(0, 80) : '',
        hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth, viewW: document.documentElement.clientWidth,
    };
};

// Contrast sweep: every service, rendered the app's own way (showIntakeQuestions), text judged against a KNOWN solid fill only.
const SWEEP = async () => {
    const parse = c => { const m = String(c).match(/[\d.]+/g); return m ? m.map(Number) : [0, 0, 0, 0]; };
    const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    // The fill behind `el`: the nearest ancestor, INSIDE the card, with an (almost) opaque background colour. null when an image/gradient or an element at partial opacity comes first, or when
    // the card itself supplies no fill (the page's own background -- a photo behind translucent glass -- is not an ancestor's colour, so reading <body> would be a guess).
    const fillBehind = (el, root) => {
        for (let e = el; e && root.contains(e); e = e.parentElement) {
            const cs = getComputedStyle(e);
            if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
            if (parseFloat(cs.opacity) < 1) return null;
            const m = parse(cs.backgroundColor);
            if ((m.length < 4 ? 1 : m[3]) >= 0.95) return m;
        }
        return null;
    };
    const bad = {}; let rendered = 0, judged = 0, unjudged = 0;
    for (const svc of DB.services) {
        try { showIntakeQuestions(svc, svc.ui_taxonomy.category_id); } catch (e) { continue; }
        await new Promise(r => setTimeout(r, 4));
        const root = document.getElementById('intakeQuestionsContainer');
        if (!root || getComputedStyle(root).display === 'none') continue;
        rendered++;
        root.querySelectorAll('*').forEach(el => {
            if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden' || el.disabled) return;
            const bg = fillBehind(el, root);
            if (!bg) { unjudged++; return; }
            judged++;
            const fg = parse(cs.color), a = fg.length > 3 ? fg[3] : 1;
            const eff = [0, 1, 2].map(i => fg[i] * a + bg[i] * (1 - a));
            const L1 = lum(eff), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
            if (ratio < 4.5) {
                const k = `<${el.tagName.toLowerCase()}${el.className ? ' class="' + el.className + '"' : ''}> ${cs.color} on ${cs.backgroundColor} (${ratio.toFixed(2)}:1)`;
                (bad[k] = bad[k] || { services: 0, example: el.textContent.trim().slice(0, 50) }).services++;
            }
        });
    }
    return { rendered, judged, unjudged, offenders: bad };
};

// ---- drive one build of the page ------------------------------------------------------------------------------------------------------------------------------------------------
async function drive(puppeteer, chrome, file, width, withSweep) {
    const browser = await puppeteer.launch({ headless: 'new', executablePath: chrome, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
        const page = await browser.newPage();
        await page.setViewport({ width, height: 1600 });
        const pageErrors = new Set();
        page.on('pageerror', e => pageErrors.add(String(e.message).slice(0, 140)));
        await page.setRequestInterception(true);
        page.on('request', r => {
            const d = PAGE.documentResponse(r.url()); if (d) return r.respond(d);
            const u = r.url();
            if (u.includes('btnyc_schema.json')) r.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: SCHEMA });
            else if (u.includes('btnyc.json')) r.respond({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: SSOT });
            else if (/^https?:/.test(u)) r.abort(); else r.continue();
        });
        await page.goto('file://' + file, { waitUntil: 'load' });
        await page.waitForFunction(() => window.DB && window.DB.services, { timeout: 20000 });
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        await sleep(600);
        const out = { width, pageErrors: [] };

        // A. browse: first category tile
        await page.click('#category-card .category-card'); await sleep(600);
        out.browse = await page.evaluate(MEASURE);

        // B1. the real tap journey: tap the first tile of the grid until the grid is replaced by something else (or 4 taps); the grid and the card are never both on screen.
        out.journey = [];
        for (let i = 0; i < 4; i++) {
            const tapped = await page.evaluate(() => { const g = document.getElementById('serviceContainer'); const t = g && [...g.children].find(c => c.getBoundingClientRect().height > 0); if (!t) return null; t.click(); return (t.innerText || '').trim().slice(0, 30); });
            if (tapped === null) break;
            await sleep(700);
            out.journey.push(Object.assign({ tapped }, await page.evaluate(MEASURE)));
        }

        // B2. the card for a known plain-intake service, opened the app's own way
        const forced = await page.evaluate(async () => {
            const svc = DB.services.find(s => s.id === 'faucet_repair_drip');
            if (!svc) return null;
            showIntakeQuestions(svc, svc.ui_taxonomy.category_id);
            return svc.ui_taxonomy.display_name || svc.id;
        });
        await sleep(800);
        out.forcedFor = forced;
        out.card = await page.evaluate(MEASURE);

        // C. back: the app's own restoreCategoryView returns to the CATEGORY cards (and empties the group grid) ...
        await page.evaluate(() => restoreCategoryView());
        await sleep(600);
        out.back = await page.evaluate(MEASURE);
        // ... and the next visit to a category must show the group grid again: the inline `display:none` the intake card left on it must not stick.
        await page.click('#category-card .category-card'); await sleep(600);
        out.revisit = await page.evaluate(MEASURE);

        // D. contrast over every service's card
        if (withSweep) out.sweep = await page.evaluate(SWEEP);
        out.pageErrors = [...pageErrors];
        return out;
    } finally { await browser.close(); }
}

// ---- judge one drive: returns [{key, msg}] ------------------------------------------------------------------------------------------------------------------------------------
function judge(r) {
    const f = [], add = (key, msg) => f.push({ key, msg: `${r.width}px: ${msg}` });
    const b = r.browse;
    if (!(b.gridVisible && b.gridTiles >= 2)) add('browse-grid', `after a category tap the group grid is not on screen with tiles (display ${b.gridDisplay}, ${b.gridTiles} tiles)`);
    if (!(b.gridPerRow >= 2)) add('grid-layout', `the group grid is not a multi-column grid after a category tap: ${b.gridPerRow} tile(s) per row (display ${b.gridDisplay})`);
    if (b.hScroll > 0) add('hscroll', `the page scrolls sideways by ${b.hScroll}px while browsing`);
    for (const j of r.journey) if (j.gridVisible && j.cardVisible) add('journey-both', `after tapping "${j.tapped}" the group grid AND the intake card are both on screen`);
    const c = r.card;
    if (!c.cardVisible) add('card-visible', `the intake card for "${r.forcedFor}" is not on screen`);
    if (c.gridVisible || c.gridDisplay !== 'none' || c.gridHeight > 0) add('grid-hidden', `with the intake card up, the group grid is still there: computed display ${c.gridDisplay}, ${c.gridHeight}px tall, ${c.gridTiles} visible tile(s)`);
    if (c.cardVisible && (c.cardLeft < 0 || c.cardRight > c.viewW + 0.5)) add('card-in-viewport', `the intake card runs outside the viewport (${c.cardLeft}..${c.cardRight} of ${c.viewW})`);
    if (c.hScroll > 0) add('hscroll', `the page scrolls sideways by ${c.hScroll}px with the intake card up`);
    const k = r.back;
    if (!(k.catVisible && k.catTiles >= 2 && k.catPerRow >= 2)) add('back-categories', `after restoreCategoryView the category cards are not back in columns (visible ${k.catVisible}, ${k.catTiles} tiles, ${k.catPerRow}/row)`);
    if (k.cardVisible) add('back-card', 'after restoreCategoryView the intake card is still on screen');
    const v = r.revisit;
    if (!(v.gridVisible && v.gridTiles >= 2)) add('revisit-grid', `tapping a category again after the intake card does not bring the group grid back (display ${v.gridDisplay}, ${v.gridTiles} tiles)`);
    else if (!(v.gridPerRow >= 2)) add('revisit-layout', `the group grid on a second visit is not in columns: ${v.gridPerRow} per row`);
    if (v.cardVisible) add('revisit-card', 'the intake card is still on screen after tapping a category again');
    if (r.pageErrors.length) add('page-error', 'page error: ' + r.pageErrors.join(' | '));
    if (r.sweep) {
        const o = Object.entries(r.sweep.offenders);
        if (o.length) add('contrast', `text in the intake card is below 4.5:1 contrast:\n` + o.slice(0, 6).map(([k2, v]) => `${k2} -- "${v.example}" -- in ${v.services} service card(s)`).join('\n'));
    }
    return f;
}

// ---- mutants -----------------------------------------------------------------------------------------------------------------------------------------------------------------------
const MUTANTS = [
    { name: 'the `!important` back on .group-grid', expect: 'grid-hidden', sweep: false,
      apply: s => s.replace(/(\.group-grid\{display:grid)(;)/, '$1!important$2') },
    { name: 'the grid-hiding line removed from showIntakeQuestions', expect: 'grid-hidden', sweep: false,
      apply: s => s.replace(/(container\.style\.display = 'block';\s*\n)\s*if \(DOM\.serviceContainer\) DOM\.serviceContainer\.style\.display = 'none';\n(\s*if \(svc\.requires_furniture_selection\))/, '$1$2') },
    { name: "the restore path setting display 'block' (the grid layout replaced)", expect: 'grid-layout', sweep: false,
      apply: s => s.replace(/(container\.style\.display = )''(;\s*\/\/ let \.group-grid class take over)/g, "$1'block'$2") },
    { name: 'the group grid never un-hidden after the card (the display reset removed)', expect: 'revisit-grid', sweep: false,
      apply: s => s.replace(/DOM\.serviceContainer\.style\.display = '';\s*\/\/ let \.group-grid class take over|container\.style\.display = '';\s*\/\/ let \.group-grid class take over/g, '/* display reset removed */') },
    { name: 'the black paragraph rule restored', expect: 'contrast', sweep: true,
      apply: s => s.replace('#intakeQuestionsContainer p{font-size:.88rem', '#intakeQuestionsContainer p{background:#000;color:#ffffffb3;font-size:.88rem') },
];

(async () => {
    console.log('verify_intake_card_presentation: the intake card, as drawn in Chromium\n');
    let puppeteer;
    try { puppeteer = require('puppeteer-core'); } catch (e) { try { puppeteer = require('puppeteer'); } catch (e2) { /* none */ } }
    const chrome = findChrome();
    if (!puppeteer || !chrome) {
        bad('a browser is required', 'No Chrome/puppeteer found. This test FAILS rather than skipping: set CHROME_PATH (e.g. /opt/pw-browsers/chromium). Silent skipping would be a false statement of coverage (DEFECT-SILENT-SKIP).');
        console.log(`\n${pass} passed, ${fail} failed`); process.exit(1);
    }
    const src = fs.readFileSync(QR, 'utf8');

    // sections A-D on the real page at both widths
    console.log('A-D. the page as it is');
    const sweepSummary = [];
    for (const [width, sweep] of [[1280, true], [375, false]]) {
        const r = await drive(puppeteer, chrome, QR, width, sweep);
        const f = judge(r);
        if (r.sweep) sweepSummary.push(r.sweep);
        check(f.length === 0, `${width}px: browse -> grid in columns (${r.browse.gridPerRow}/row, ${r.browse.gridTiles} tiles); card up -> grid gone (display ${r.card.gridDisplay}), card ${r.card.cardHeight}px tall inside ${r.card.viewW}px; back -> category cards restored (${r.back.catTiles}), and a second category tap brings the group grid back (${r.revisit.gridTiles} tiles, ${r.revisit.gridPerRow}/row)` +
            (r.journey.length ? `; ${r.journey.length} real taps, never both on screen` : ''), `${width}px: the page fails`, f.map(x => `[${x.key}] ${x.msg}`).join('\n'));
        if (r.sweep) check(r.sweep.rendered > 0 && r.sweep.judged > 0, `${width}px: contrast swept ${r.sweep.rendered} service cards, ${r.sweep.judged} text elements judged against a known fill (${r.sweep.unjudged} over an image/gradient not judged)`, 'the contrast sweep judged nothing (vacuous)');
    }

    // E. non-vacuity
    console.log('\nE. non-vacuity: each mutant must trip its own check');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'btnyc_intake_'));
    try {
        for (const m of MUTANTS) {
            const mutated = m.apply(src);
            if (mutated === src) { bad(`mutant "${m.name}": its anchor is not in the page (the mutation did nothing)`, 'The page changed shape; re-anchor this mutant. A mutant that mutates nothing proves nothing.'); continue; }
            const file = path.join(dir, 'qr.html'); fs.writeFileSync(file, mutated);
            const r = await drive(puppeteer, chrome, file, 1280, m.sweep);
            const f = judge(r), tripped = f.filter(x => x.key === m.expect);
            check(tripped.length > 0, `mutant "${m.name}" is caught by [${m.expect}]: ${tripped[0] ? tripped[0].msg.split('\n')[0].slice(0, 150) : ''}`,
                `mutant "${m.name}" was NOT caught by [${m.expect}]`, `checks tripped: ${f.map(x => x.key).join(', ') || 'none'}`);
        }
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
