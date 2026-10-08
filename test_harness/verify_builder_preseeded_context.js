#!/usr/bin/env node
/**
 * verify_builder_preseeded_context.js
 *
 * Regression test for two real, severe, confirmed bugs in the guided
 * builder's "pre-seeded from a catalog Other tile" flow, found via a
 * real user bug report ("catalog walls other only diagnose option which
 * tapped asks again about group walls -- no contextual awareness at
 * all") and confirmed with real browser automation before any fix:
 *
 * 1. BLD_ACTION_MAP's "Hang / Mount" chip had stype: 'Install' instead
 *    of the real, distinct 'Mount' service type (confirmed in
 *    DB.service_types). This meant the action-step chip filter
 *    (BLD_ACTION_MAP.filter(a => bld._allowedTypes.includes(a.stype)))
 *    could never match this chip against an allowedTypes list containing
 *    "Mount" -- for Walls specifically (uncovered types: Diagnostic +
 *    Mount, since Repair is already covered by 4 real named services),
 *    only "Diagnose" ever appeared. This was not a Walls-only bug --
 *    checked programmatically against the full catalog and found 20
 *    different groups whose "Other" tile would hit the exact same
 *    filter-exclusion, all fixed by this one, single, shared root-cause
 *    correction.
 *
 * 2. sqBuilderChoose's `BLD.step++` always advanced by exactly one step,
 *    never checking whether the NEXT step's field was already populated
 *    -- so a pre-seeded builder (entered via a catalog "Other" tile,
 *    which already knows the group) blindly re-asked "What is it?"
 *    after the action step, showing an unrelated, unscoped list of
 *    groups from entirely different categories, with the already-known
 *    group not even among them. sqOpenBuilderPreseeded already correctly
 *    skips pre-answered fields when INITIALLY calculating BLD.step, but
 *    that logic never re-ran on subsequent chip taps.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

function extractConstArray(name) {
    const start = QR_HTML.indexOf(`const ${name} = [`);
    const arrStart = QR_HTML.indexOf('[', start);
    let depth = 0;
    for (let j = arrStart; j < QR_HTML.length; j++) {
        if (QR_HTML[j] === '[') depth++;
        else if (QR_HTML[j] === ']') { depth--; if (depth === 0) return QR_HTML.slice(start, j + 1); }
    }
    return null;
}

console.log('=== Fix 1: every multi-uncovered-type group\'s "Other" tile has a real chip for every type ===');
{
    const sandbox = { DB, window: { DB } };
    const vm = require('vm');
    vm.createContext(sandbox);
    vm.runInContext(extractConstArray('BLD_ACTION_MAP').replace('const BLD_ACTION_MAP', 'var BLD_ACTION_MAP'), sandbox);

    function normalize(t) { return (t || 'Repair').replace('Install / Mount', 'Install').replace('Install/Mount', 'Install'); }
    const affectedGroups = [];
    for (const g of DB.group) {
        const dynTypes = g.dynamic_service_types || [];
        if (!dynTypes.length) continue;
        const realServices = DB.services.filter(s => s.ui_taxonomy?.group_id === g.id);
        const covered = new Set(realServices.map(s => normalize(s.service_type)));
        const uncovered = dynTypes.filter(t => !covered.has(normalize(t)));
        if (uncovered.length > 1) affectedGroups.push({ id: g.id, uncovered });
    }
    // T72 FIX: was >= 15. This count measures groups with more than one
    // "uncovered" dynamic_service_types entry -- precisely the customer-
    // confusion pattern T72 fixed (e.g. washer's Diagnostic/Mount, neither
    // ever a real action, both leading nowhere useful). Dropped from 15+
    // to 4 as the direct, intended, positive consequence of that fix, not
    // a regression -- confirmed the remaining 4 are groups deliberately
    // left untouched (the Appliances parent group, which delegates to its
    // children rather than resolving directly, plus 3 groups genuinely
    // lacking verified real_action_ids data at all, so T72 had no
    // objective basis to touch them yet). See TIMELINE.md's T72 entry.
    check(`found a real, non-trivial set of multi-type groups to check (${affectedGroups.length} groups)`, affectedGroups.length >= 3);

    let allCovered = true;
    for (const { id, uncovered } of affectedGroups) {
        const matchedStypes = new Set(sandbox.BLD_ACTION_MAP.filter(a => uncovered.includes(a.stype)).map(c => c.stype));
        const missing = uncovered.filter(t => !matchedStypes.has(t));
        if (missing.length > 0) { allCovered = false; console.log(`    ${id}: missing chip(s) for ${JSON.stringify(missing)}`); }
    }
    check('every affected group has a real, matching action chip for every one of its uncovered types', allCovered);

    check('"Hang / Mount" specifically now has stype: "Mount", not "Install"',
        sandbox.BLD_ACTION_MAP.find(a => a.label === 'Hang / Mount')?.stype === 'Mount');
}

console.log('\n=== Fix 2: sqBuilderChoose skips forward past already-answered steps ===');
{
    check('sqBuilderChoose contains a skip-forward loop checking already-populated fields (not just a bare increment)',
        QR_HTML.includes('while (BLD.step < stepsAfterChoice.length &&') &&
        QR_HTML.includes('stepsAfterChoice[BLD.step]] !== null'));
}

console.log('\n=== Real browser: the complete Walls "Other" tile flow works end-to-end ===');
{
    function findChrome() {
        try {
            return execSync('find /home/*/.cache/puppeteer /root/.cache/puppeteer -type f -name chrome 2>/dev/null', { shell: '/bin/bash' })
                .toString().trim().split('\n')[0];
        } catch { return null; }
    }
    const chromePath = findChrome();
    if (!chromePath) {
        console.log('  ⚠ No Chrome/Chromium binary found -- skipping real-browser check (environment gap, not a code failure).');
    } else {
        runBrowserCheck(chromePath).catch(err => {
            fail++;
            console.log(`  ✗ Real-browser check threw: ${err.message}`);
            finish();
        });
        return; // async path handles finish()
    }
}

finish();

async function runBrowserCheck(chromePath) {
    const puppeteer = require('puppeteer-core');
    const http = require('http');
    const PORT = 9000 + Math.floor(Math.random() * 900);
    const server = http.createServer((req, res) => {
        const filePath = path.join(REPO_ROOT, req.url.split('?')[0] === '/' ? '/qr.html' : req.url.split('?')[0]);
        fs.readFile(filePath, (err, data) => {
            if (err) { res.writeHead(404); res.end(); return; }
            const ext = path.extname(filePath);
            res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.json': 'application/json' }[ext] || 'text/plain' });
            res.end(data);
        });
    });
    await new Promise(r => server.listen(PORT, '127.0.0.1', r));
    const browser = await puppeteer.launch({ headless: 'new', executablePath: chromePath, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 2400 });
        await page.goto(`http://127.0.0.1:${PORT}/qr.html`, { waitUntil: 'networkidle0', timeout: 15000 });
        await new Promise(r => setTimeout(r, 1000));

        const catCards = await page.$$('.category-card');
        for (const card of catCards) {
            if ((await page.evaluate(el => el.textContent, card)).includes('Minor Home Repairs')) { await card.click(); break; }
        }
        await new Promise(r => setTimeout(r, 800));
        const groupTiles = await page.$$('.group-tile');
        for (const tile of groupTiles) {
            if ((await page.evaluate(el => el.textContent, tile)).includes('Walls')) { await tile.click(); break; }
        }
        await new Promise(r => setTimeout(r, 800));
        const serviceTiles = await page.$$('.service-tile');
        for (const tile of serviceTiles) {
            if ((await page.evaluate(el => el.textContent, tile)).includes('Walls Other')) { await tile.click(); break; }
        }
        await new Promise(r => setTimeout(r, 1000));

        const chips = await page.$$eval('#sqBuilderChips .sq-b-chip', els => els.map(el => el.textContent.trim()));
        check('the action step shows both real uncovered options (Mount and Diagnose), not just one', chips.length === 2 && chips.includes('Hang / Mount') && chips.includes('Diagnose'));

        const chipEls = await page.$$('#sqBuilderChips .sq-b-chip');
        for (const chip of chipEls) {
            if ((await page.evaluate(el => el.textContent, chip)).includes('Mount')) { await chip.click(); break; }
        }
        await new Promise(r => setTimeout(r, 500));

        const promptAfter = await page.evaluate(() => document.getElementById('sqBuilderPrompt')?.textContent || '');
        check('tapping an action chip does NOT re-ask "What is it?" (the group is already known)', !promptAfter.includes('What is it'));

        const nextChips = await page.$$eval('#sqBuilderChips .sq-b-chip', els => els.map(el => el.textContent.trim()));
        const hasUnrelatedGroups = nextChips.some(c => ['Bulbs', 'Sinks', 'Toilets', 'Computer Repair'].includes(c));
        check('the next step does not show unrelated groups from entirely different categories', !hasUnrelatedGroups);
    } finally {
        await browser.close();
        server.close();
    }
}

function finish() {
    console.log(`\n[Builder pre-seeded context verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
    process.exit(fail > 0 ? 1 : 0);
}
