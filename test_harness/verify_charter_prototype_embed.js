#!/usr/bin/env node
/**
 * verify_charter_prototype_embed.js -- the Charter and the prototype it embeds travel together, and the prototype works where the Charter shows it (T180).
 *
 * @enforces R-TEST-CANFAIL
 * @detects DEFECT-TEST-CANTFAIL
 *
 * WHY THIS TEST EXISTS. The Operator's 2026-10-16 17:35 NY message installed a Charter that embeds `PROTOTYPE_SMARTQUOTE.html` by iframe (`<iframe src="./PROTOTYPE_SMARTQUOTE.html" ... sandbox="allow-scripts">`)
 * and said the supporting document "should accompany the update in the repo". A Charter installed without its prototype opens with an empty frame and no error anywhere; a prototype whose script throws
 * leaves a blank page the same way. The prototype is NON-NORMATIVE (the Charter says so and so does its iframe title): it decides nothing, prices nothing and reads no repo catalog. What this test
 * holds is only that the pair is whole and that what the Charter shows is alive.
 *
 * WHAT THIS HOLDS.
 *   1. THE PAIR. The Charter's iframe names a file next to the Charter; the repo has it; the iframe is sandboxed to scripts only (no same-origin, no top navigation), as its label promises.
 *   2. IT BOOTS IN THE FRAME. Opened inside the Charter, as a visitor gets it: no page error, no "Boot failed", six category tiles, the four slots of the sentence on screen, Continue/Edit disabled.
 *   3. A TYPED SENTENCE FILLS THE SLOTS. "I need 2 doors repaired in the kitchen" fills quantity, item, action and room and enables both buttons; clearing the input empties them again.
 *   4. IT PHONES NOWHERE BUT FONTS. Every request the frame makes is a file of the repo or the two font hosts it names: a prototype that fetched a catalog or posted a quote would be a second pricing path.
 *   5. NON-VACUITY (R-TEST-CANFAIL). The same checks, run on three broken copies, each find it: the Charter with no prototype beside it, a prototype whose script throws, a prototype whose sentence parser
 *      is gone.
 *
 * Needs a Chrome (CHROME_PATH, the usual locations, or /opt/pw-browsers). With none, this test FAILS rather than skipping (DEFECT-SILENT-SKIP).
 */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CHARTER = path.join(ROOT, 'PROJECT_CHARTER.html');
const PROTO_NAME = 'PROTOTYPE_SMARTQUOTE.html';
const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
const SENTENCE = 'I need 2 doors repaired in the kitchen';

let pass = 0, fail = 0;
const ok = m => { pass++; console.log('  ✓ ' + m); };
const bad = (m, d) => { fail++; console.log('  ✗ ' + m + (d ? '\n      ' + String(d).split('\n').join('\n      ') : '')); };
const check = (c, okMsg, badMsg, d) => (c ? ok(okMsg) : bad(badMsg || okMsg, d));

function findChrome() {
    const c = [process.env.CHROME_PATH, process.env.PUPPETEER_EXECUTABLE_PATH];
    try { c.push(...execSync('find /home/*/.cache/puppeteer /root/.cache/puppeteer -type f -name chrome 2>/dev/null || true', { shell: '/bin/bash' }).toString().trim().split('\n')); } catch (e) { /* ignore */ }
    c.push('/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium', '/opt/pw-browsers/chromium');
    return c.filter(Boolean).find(p => fs.existsSync(p));
}

// --- 1. the pair, read from the files (no browser) --------------------------------------------------------------------------------------------------------------------------------------
function pairProblems(dir) {
    const probs = [];
    const html = fs.readFileSync(path.join(dir, 'PROJECT_CHARTER.html'), 'utf8');
    const tags = html.match(/<iframe\b[^>]*>/gi) || [];
    const tag = tags.find(t => /PROTOTYPE_SMARTQUOTE\.html/.test(t));
    if (!tag) return ['the Charter has no iframe naming ' + PROTO_NAME];
    const src = (tag.match(/\bsrc="([^"]+)"/) || [])[1];
    const sandbox = (tag.match(/\bsandbox="([^"]*)"/) || [])[1];
    if (src !== './' + PROTO_NAME) probs.push('the iframe src is ' + src + ', expected ./' + PROTO_NAME);
    if (!fs.existsSync(path.join(dir, PROTO_NAME))) probs.push(PROTO_NAME + ' is not beside the Charter');
    else if (fs.statSync(path.join(dir, PROTO_NAME)).size < 1000) probs.push(PROTO_NAME + ' is empty or truncated');
    if (sandbox == null) probs.push('the iframe is not sandboxed');
    else {
        const toks = sandbox.split(/\s+/).filter(Boolean);
        if (!toks.includes('allow-scripts')) probs.push('the iframe sandbox does not allow scripts, so the prototype cannot run');
        for (const bannedTok of ['allow-same-origin', 'allow-top-navigation', 'allow-forms', 'allow-popups']) if (toks.includes(bannedTok)) probs.push('the iframe sandbox grants ' + bannedTok + ', which its label ("cannot access the parent document") rules out');
    }
    return probs;
}

// --- 2-4. the frame in a browser ---------------------------------------------------------------------------------------------------------------------------------------------------------
async function frameProblems(puppeteer, chrome, dir) {
    const probs = [], seen = { external: new Set(), errors: [], consoleErrors: [] };
    const browser = await puppeteer.launch({ headless: 'new', executablePath: chrome, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1000, height: 1600 });
        await page.setRequestInterception(true);
        page.on('request', r => {
            const u = r.url();
            if (/^(file|data|blob|about):/.test(u)) return r.continue();
            let host = ''; try { host = new URL(u).host; } catch (e) { /* none */ }
            seen.external.add(host || u);
            return r.abort();   // the workspace has no network; the host is what is recorded
        });
        page.on('pageerror', e => seen.errors.push(String(e && e.message || e)));
        page.on('console', m => { if (m.type() === 'error') seen.consoleErrors.push(m.text()); });
        await page.goto('file://' + path.join(dir, 'PROJECT_CHARTER.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
        // the frame is lazy-loaded: bring it into view, then wait for it to navigate to the prototype
        await page.evaluate(() => { const f = document.getElementById('builder-frame'); if (f) { f.loading = 'eager'; f.scrollIntoView(); } });
        let frame = null;
        for (let i = 0; i < 60 && !frame; i++) {
            frame = page.frames().find(f => /PROTOTYPE_SMARTQUOTE\.html$/.test(f.url()));
            if (!frame) await new Promise(r => setTimeout(r, 250));
        }
        if (!frame) { probs.push('the Charter\'s frame never navigated to ' + PROTO_NAME); return { probs, seen }; }
        let boot;
        try {
            await frame.waitForSelector('#preview .slot', { timeout: 8000 });
            boot = await frame.evaluate(() => ({
                tiles: document.querySelectorAll('#tiles .tile').length,
                slots: [...document.querySelectorAll('#preview .slot')].map(s => s.dataset.slot),
                continueDisabled: document.getElementById('submitBtn').disabled,
                editDisabled: document.getElementById('editBtn').disabled,
            }));
        } catch (e) { probs.push('the prototype did not draw its sentence slots: ' + String(e.message).split('\n')[0]); return { probs, seen }; }
        if (boot.tiles !== 6) probs.push('expected 6 category tiles, found ' + boot.tiles);
        if (boot.slots.join(',') !== 'qty,items,action,location') probs.push('expected the four slots qty,items,action,location, found ' + boot.slots.join(','));
        if (!boot.continueDisabled || !boot.editDisabled) probs.push('Continue and Edit must be disabled before the sentence is complete');
        await frame.type('#freeText', SENTENCE, { delay: 2 });
        const typed = await frame.evaluate(() => ({
            slots: Object.fromEntries([...document.querySelectorAll('#preview .slot')].map(s => [s.dataset.slot, s.classList.contains('filled') ? s.textContent : null])),
            continueDisabled: document.getElementById('submitBtn').disabled,
            editDisabled: document.getElementById('editBtn').disabled,
        }));
        const want = { qty: '2', items: 'Door', action: 'Repaired', location: 'Kitchen' };
        for (const k of Object.keys(want)) if (typed.slots[k] !== want[k]) probs.push(`typing "${SENTENCE}" should fill ${k} with "${want[k]}", found ${JSON.stringify(typed.slots[k])}`);
        if (typed.continueDisabled || typed.editDisabled) probs.push('a complete sentence should enable Continue and Edit');
        await frame.click('#clearIn').catch(() => {});
        const cleared = await frame.evaluate(() => [...document.querySelectorAll('#preview .slot.filled')].length);
        if (cleared !== 0) probs.push('clearing the input should empty the slots, ' + cleared + ' stayed filled');
        if (seen.errors.length) probs.push('page errors: ' + seen.errors.slice(0, 3).join(' | '));
        const boots = seen.consoleErrors.filter(m => /Boot failed/i.test(m));
        if (boots.length) probs.push('the prototype logged "Boot failed"');
        const foreign = [...seen.external].filter(h => !FONT_HOSTS.has(h));
        if (foreign.length) probs.push('requests beyond the two font hosts: ' + foreign.join(', '));
        return { probs, seen };
    } finally { await browser.close(); }
}

function copyPair(label, mutate) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'charter-proto-' + label + '-'));
    fs.copyFileSync(CHARTER, path.join(dir, 'PROJECT_CHARTER.html'));
    fs.copyFileSync(path.join(ROOT, PROTO_NAME), path.join(dir, PROTO_NAME));
    if (mutate) mutate(dir);
    return dir;
}

(async () => {
    console.log('verify_charter_prototype_embed.js');
    let puppeteer; try { puppeteer = require('puppeteer-core'); } catch (e) { try { puppeteer = require('puppeteer'); } catch (e2) { /* none */ } }
    const chrome = findChrome();
    if (!puppeteer || !chrome) {
        bad('a browser is required', 'No Chrome/puppeteer found. This test FAILS rather than skipping: set CHROME_PATH (e.g. /opt/pw-browsers/chromium). Silent skipping would be a false statement of coverage.');
        console.log(`\n${pass} passed, ${fail} failed`); process.exit(1);
    }

    console.log('\n1. The pair is whole');
    const pair = pairProblems(ROOT);
    check(pair.length === 0, `the Charter's iframe names ./${PROTO_NAME}, the repo has it, the sandbox allows scripts and nothing else`, 'the Charter and its prototype do not form a pair', pair.join('\n'));

    console.log('\n2-4. The prototype, in the Charter\'s own frame');
    const live = await frameProblems(puppeteer, chrome, ROOT);
    check(live.probs.length === 0, `boots (6 tiles, 4 slots), "${SENTENCE}" fills all four, clearing empties them, no page error, requests only to ${[...FONT_HOSTS].join(' and ')}`, 'the prototype does not work in the Charter\'s frame', live.probs.join('\n'));
    console.log(`     (requests seen outside the repo: ${[...live.seen.external].join(', ') || 'none'})`);

    console.log('\n5. Non-vacuity: the same checks find three broken copies');
    const cases = [
        ['no prototype beside the Charter', d => fs.unlinkSync(path.join(d, PROTO_NAME)), /not beside the Charter|never navigated|did not draw/],
        ['a prototype whose script throws', d => { const p = path.join(d, PROTO_NAME); fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('<script>!function(){"use strict";', '<script>throw new Error("planted");!function(){"use strict";')); }, /did not draw|page errors|never navigated/],
        ['a prototype whose sentence parser is gone', d => { const p = path.join(d, PROTO_NAME); const s = fs.readFileSync(p, 'utf8'); fs.writeFileSync(p, s.replace('m("freeText").addEventListener("input"', 'm("freeText").addEventListener("planted-event"')); }, /should fill/],
    ];
    for (const [name, mutate, expect] of cases) {
        const dir = copyPair('m', mutate);
        try {
            const p = [...pairProblems(dir), ...(await frameProblems(puppeteer, chrome, dir)).probs];
            check(p.length > 0 && expect.test(p.join('\n')), `${name}: found (${(p[0] || '').slice(0, 80)})`, `${name}: NOT found, the test cannot fail here`, p.join('\n'));
        } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    }

    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
