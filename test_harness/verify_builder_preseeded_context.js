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
const QR_HTML = require('./_page.js').readPage(path.join(REPO_ROOT, 'qr.html'));
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

console.log('\n=== Real browser: a current multi-action "Other" tile flow works end-to-end ===');
{
    // The suite runner and GitHub Actions supply CHROME_PATH. The old cache-only
    // search skipped this browser half even while Chrome was installed in CI.
    function findChrome() {
        const candidates = [process.env.CHROME_PATH, process.env.PUPPETEER_EXECUTABLE_PATH,
            '/opt/pw-browsers/chromium', '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'];
        try {
            candidates.push(...execSync('find /home/*/.cache/puppeteer /root/.cache/puppeteer -type f -name chrome 2>/dev/null || true', { shell: '/bin/bash' })
                .toString().trim().split('\n').filter(Boolean));
        } catch (_) { /* no cache; the configured/system Chrome may still exist */ }
        return candidates.filter(Boolean).find(p => fs.existsSync(p)) || null;
    }
    const chromePath = findChrome();
    if (!chromePath) {
        check('Chrome is required for the real-browser half (set CHROME_PATH)', false);
        finish();
    } else {
        runBrowserCheck(chromePath).then(finish).catch(err => {
            fail++;
            console.log(`  ✗ Real-browser check threw: ${err.message}`);
            finish();
        });
        return; // async path invokes finish() after all browser assertions, including on success
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
            if (ext === '.html') data = Buffer.from(require('./_page.js').assemble(data.toString('utf8')));   // T158: the page with its external modules assembled in (the page's CSP only allows scripts from its own origin)
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

        // Select a navigable nested leaf with multiple uncovered types.
        // After T72 the old Walls=Mount+Diagnose fixture was retired;
        // the remaining real examples live under the Appliances parent.
        const candidate = await page.evaluate(() => {
            const normalize = t => (t || 'Repair').replace('Install / Mount', 'Install').replace('Install/Mount', 'Install');
            const groups = DB.group || [];
            const candidates = groups.filter(g => {
                // The remaining multi-action Other tiles are nested leaves under
                // Appliances. The parent group delegates to children and has no
                // own Other tile, so select a leaf and walk its authored ancestry.
                if (groups.some(child => child.parent_group === g.id || child.parent_id === g.id)) return false;
                const covered = new Set((DB.services || []).filter(s => s.ui_taxonomy?.group_id === g.id).map(s => normalize(s.service_type)));
                const uncovered = (g.dynamic_service_types || []).map(normalize).filter(t => !covered.has(t));
                return uncovered.length > 1 && !!document.querySelector('.category-card[data-category-id="' + g.category_id + '"]');
            }).map(g => {
                const ancestry = []; let curr = g, limit = groups.length;
                while (curr && limit-- > 0) {
                    ancestry.unshift({ id: curr.id, label: curr.display_name });
                    const parent = curr.parent_group || curr.parent_id;
                    curr = parent ? groups.find(x => x.id === parent) : null;
                }
                return {
                    id: g.id, category: g.category_id, label: g.display_name, ancestry,
                    uncovered: (g.dynamic_service_types || []).map(normalize).filter(t =>
                        !(DB.services || []).some(s => s.ui_taxonomy?.group_id === g.id && normalize(s.service_type) === t))
                };
            });
            return candidates.find(g => g.id === 'minor_home_repairs_appliances_dryer') || candidates[0] || null;
        });
        check('a navigable leaf group with multiple uncovered actions exists', !!candidate);
        if (!candidate) return;
        await page.click('.category-card[data-category-id="' + candidate.category + '"]');
        await new Promise(r => setTimeout(r, 500));

        let navigated = true;
        for (const step of candidate.ancestry) {
            let tileClicked = false;
            for (const tile of await page.$$('.group-tile')) {
                if ((await page.evaluate(el => el.querySelector('.tile-name')?.textContent.trim(), tile)) === step.label) {
                    await tile.click(); tileClicked = true; break;
                }
            }
            if (!tileClicked) { navigated = false; break; }
            await new Promise(r => setTimeout(r, 400));
        }
        check('every level of the selected catalog group was opened, including its parent', navigated);
        if (!navigated) return;

        let otherClicked = false;
        for (const tile of await page.$$('.service-tile-other')) {
            if ((await page.evaluate(el => el.querySelector('h4')?.textContent.trim(), tile)) === candidate.label + ' Other') {
                await tile.click(); otherClicked = true; break;
            }
        }
        check('the selected Other tile was actually opened', otherClicked);
        if (!otherClicked) return;
        await new Promise(r => setTimeout(r, 500));

        const state = await page.evaluate(() => ({
            prompt: document.getElementById('sqBuilderPrompt')?.textContent.trim() || '',
            allowed: (typeof BLD !== 'undefined' && BLD._allowedTypes) ? BLD._allowedTypes : [],
            chips: [...document.querySelectorAll('#sqBuilderChips .sq-b-chip')].map(el => el.textContent.trim()),
            expected: (typeof BLD_ACTION_MAP !== 'undefined' ? BLD_ACTION_MAP : [])
                .filter(a => (typeof BLD !== 'undefined' && BLD._allowedTypes || []).includes(a.stype)).map(a => a.label)
        }));
        console.log('  Browser action fixture: ' + candidate.id + ' ' + JSON.stringify(state));
        const sameMembers = (a, b) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
        check('the action step offers each currently authored uncovered action (not the old Walls/Mount fixture)',
            state.prompt.includes('What do you need done') &&
            state.allowed.length > 1 && sameMembers(state.allowed, candidate.uncovered) &&
            // One service type may expose two distinct actions (Repair => Fix and Remove).
            state.expected.length >= state.allowed.length && sameMembers(state.chips, state.expected));

        const chosenChip = (await page.$$('#sqBuilderChips .sq-b-chip'))[0];
        check('an action chip is genuinely present and tappable', !!chosenChip);
        if (!chosenChip) return;
        await chosenChip.click();
        await new Promise(r => setTimeout(r, 500));

        const promptAfter = await page.evaluate(() => document.getElementById('sqBuilderPrompt')?.textContent || '');
        check('tapping an action does NOT re-ask "What is it?" (the group is already known)',
            !!promptAfter && !promptAfter.includes('What is it'));

        const nextChips = await page.$$eval('#sqBuilderChips .sq-b-chip', els => els.map(el => el.textContent.trim()));
        check('the next step does not show an unrelated group grid',
            nextChips.length > 0 && !nextChips.some(c => ['Bulbs', 'Sinks', 'Toilets', 'Computer Repair'].includes(c)));
    } finally {
        await browser.close();
        server.close();
    }
}

function finish() {
    console.log(`\n[Builder pre-seeded context verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
    process.exit(fail > 0 ? 1 : 0);
}
