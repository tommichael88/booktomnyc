#!/usr/bin/env node
/**
 * verify_service_naming.js -- a curated service's name is composed from the scope it authors, and the confirmation sentence reads that scope, not the title (T188).
 *
 * @enforces R-CLIENT-STUTTER
 * @enforces R-TEST-CANFAIL
 * Principle served (a Principle is not enforced by definition): P-CLIENT-THREE
 *
 * THE DEFECT-SHAPE. The Charter ("Naming From Scope") says a client-facing service name renders its scope, often as [Object] + [Qualifier] + [Action]; that the same scope gives the same name
 * whichever gateway the client came by; and that the name must not stutter ("Faucet Repair (Drip)" is the Charter's own example of a name the strip rule cannot save: the label is corrected).
 * Names were typed by hand, one string per service. The confirmation sentence then recovered its noun and its verb by running a regex and substring checks over that typed title (sqBuildAdlib),
 * so every quirk of a title reached the sentence: "I need 1 Faucet Repair (Drip) repaired", "a shelf mounting standard job", "I need 1 Furniture Disassembly for Moving assembled".
 *
 * WHAT IS HELD
 *   1. The Charter's own words: the guidance sentence and the three worked names are read from PROJECT_CHARTER.html; the composer gives exactly those names for exactly those scopes.
 *   2. The data: all 76 curated services author a scope; the vocabulary is whole; every name, title and verb in the source AND in btnyc.json is what the scope composes; names and titles are unique;
 *      no title has a pipe, slash, bracket, parenthesis or emoji except the one tail the vocabulary defines; the mirror differs from the source in no naming field.
 *   3. Every rule of the validator can fail: a mutant of each (stale title, stale verb, a parenthetical, an emoji, a lowercase noun, a capitalised "or", a stutter, a duplicate, a condition with no
 *      qualifier, a name that shares nothing with its entity, an unused entity note, a tail on the wrong pricing, an unknown action, an unknown key, a missing scope, an exception with no reason,
 *      an exception that excepts nothing, a vocabulary without a past participle) is rejected with its own code, validate_source.js reports it as V-NAME-<CODE>, and a valid exception is accepted.
 *      (and deriving is idempotent and touches only name, display_name and verb_natural).
 *      (3b. The 15 titles that changed are typed again as a customer would, alone and with a count, on today's data and engine, and must route exactly as the last golden master recorded: renaming is not a change to what
 *      a customer's words do.)
 *   4. THE PAGE (real Chrome): for all 76 services the confirmation card's job phrase and the ad-lib sentence's noun and verb come from the authored scope, with no parenthetical, emoji, repeated
 *      word or title suffix; the named quirks above are gone; and four source mutants (the sentence reads the title again, the verb is guessed again, the card cleans the title again, the
 *      acronym article is dropped) are caught. Skips (loudly: "environment gap") only the page half if there is no Chrome / puppeteer-core.
 */
'use strict';
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const cp_ = () => require('child_process');
const ROOT = process.env.BTNYC_ROOT ? path.resolve(process.env.BTNYC_ROOT) : path.resolve(__dirname, '..');
process.env.BTNYC_ROOT = ROOT;
const EF = path.join(__dirname, 'tools', 'entity_first');
const lib = require(path.join(EF, 'lib.js'));
const SN = require(path.join(EF, 'service_naming.js'));
const V = require(path.join(EF, 'validate_source.js'));
const PAGE = require('./_page.js');
const QR = process.env.QR_HTML || path.join(ROOT, 'qr.html');

let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (detail ? '\n      ' + detail : '')); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clone = lib.clone;
const SRC = lib.readJson(lib.PATHS.source), DB = lib.readJson(lib.PATHS.legacy);
const VOCAB = SRC.policy.ui_config.service_naming;
const NOT_HOURLY = DB.services.find(s => s.financial_engine.type !== 'hourly').id;
const codes = f => [...new Set(f.map(x => x.code))].sort().join(',');

// ---- 1. the Charter's own words -------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('=== 1. the Charter\'s own words ===');
const CHARTER = fs.readFileSync(path.join(ROOT, 'PROJECT_CHARTER.html'), 'utf8').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/\s+/g, ' ');
check('the Charter still says a client-facing name renders its scope as [Object] + [Qualifier] + [Action]', /client-facing service name should render its scope clearly, often as \[Object\] \+ \[Qualifier\] \+ \[Action\]/.test(CHARTER));
check('...that the same scope gives the same name by any gateway', /same scope produces the same name regardless of whether the client arrived via Gateway A, B, or C/.test(CHARTER));
check('...and that the name must not stutter, with "Faucet Repair (Drip)" as the name that is corrected', /the name must not stutter/.test(CHARTER) && /Faucet Repair \(Drip\)/.test(CHARTER));
const WORKED = [['Sink Drip-Leak Repair', { object: 'Sink', qualifier: 'Drip-Leak', actions: ['repair'] }], ['Flatscreen Mortar Mounting', { object: 'Flatscreen', qualifier: 'Mortar', actions: ['mount'] }], ['Door Deadbolt Install', { object: 'Door Deadbolt', actions: ['install'] }]];
for (const [name, n] of WORKED) {
    check(`the Charter prints "${name}"`, CHARTER.includes(name));
    check(`...and the composer gives it for ${JSON.stringify(n)}`, SN.composeName(n, VOCAB) === name, 'got ' + SN.composeName(n, VOCAB));
}
check('a qualifier that begins with a preposition follows the action ("Flatscreen Mounting with Hidden Cables")', SN.composeName({ object: 'Flatscreen', qualifier: 'with Hidden Cables', actions: ['mount'] }, VOCAB) === 'Flatscreen Mounting with Hidden Cables');
check('two actions join with "or" ("Bidet Attachment Install or Removal")', SN.composeName({ object: 'Bidet Attachment', actions: ['install', 'remove'] }, VOCAB) === 'Bidet Attachment Install or Removal');
check('the same scope composes the same name every time', [1, 2, 3].every(() => SN.composeName(WORKED[1][1], VOCAB) === WORKED[1][0]));
check('the Charter\'s corrected label: the scope [Faucet] + [Drip] + [Repair] is "Faucet Drip Repair", not "Faucet Repair (Drip)"', SN.composeName({ object: 'Faucet', qualifier: 'Drip', actions: ['repair'] }, VOCAB) === 'Faucet Drip Repair');

// ---- 2. the data -----------------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('\n=== 2. the data: the source and btnyc.json ===');
const services = SRC.entities.flatMap(e => e.services);
check('the vocabulary is whole and lives in the SSOT (ui_config.service_naming in the source and in btnyc.json)', SN.vocabFindings(VOCAB).length === 0 && JSON.stringify(DB.ui_config.service_naming) === JSON.stringify(VOCAB), JSON.stringify(SN.vocabFindings(VOCAB)).slice(0, 200));
check(`all ${services.length} curated services author a scope (ui_taxonomy.naming) in the source`, services.length === 76 && services.every(s => s.presentation.ui_taxonomy.naming && s.presentation.ui_taxonomy.naming.object && s.presentation.ui_taxonomy.naming.actions.length));
check(`...and all ${DB.services.length} in btnyc.json`, DB.services.length === 76 && DB.services.every(s => s.ui_taxonomy.naming && s.ui_taxonomy.naming.object));
const fs_ = SN.findingsFromSource(SRC), fl_ = SN.findingsFromLegacy(DB);
check('the source has no naming finding', fs_.length === 0, JSON.stringify(fs_.slice(0, 3)));
check('btnyc.json has no naming finding', fl_.length === 0, JSON.stringify(fl_.slice(0, 3)));
check('the mirror differs from the source in no naming field (no patch operation is needed)', SN.patchOps(SRC, DB).length === 0, JSON.stringify(SN.patchOps(SRC, DB).slice(0, 2)));
const tailTexts = Object.values(VOCAB.tails).map(t => t.text);
const oddTitle = DB.services.filter(s => { let t = s.ui_taxonomy.display_name; for (const x of tailTexts) t = t.replace(x, ''); return /[|\/()\[\]{}<>&]|\p{Extended_Pictographic}/u.test(t); }).map(s => s.id);
check('no title has a pipe, slash, bracket, parenthesis, ampersand or emoji except the vocabulary\'s tails', oddTitle.length === 0, oddTitle.join(', '));
check('the names are unique and so are the titles', new Set(DB.services.map(s => s.ui_taxonomy.naming.name)).size === 76 && new Set(DB.services.map(s => s.ui_taxonomy.display_name)).size === 76);
check('every name is its title without the tail', DB.services.every(s => { const n = s.ui_taxonomy.naming; return s.ui_taxonomy.display_name === (n.tail ? n.name + ' ' + VOCAB.tails[n.tail].text : n.name); }));
check('every verb_natural is the past participle of the first action', DB.services.every(s => s.verb_natural === VOCAB.actions[s.ui_taxonomy.naming.actions[0]].past));
check('the services with a tail are exactly the hourly-priced ones the tail names (4), and every one of them is priced hourly', (() => { const t = DB.services.filter(s => s.ui_taxonomy.naming.tail); return t.length === 4 && t.every(s => s.financial_engine.type === 'hourly'); })());
check('a service that carries domain modifiers names the condition (3 services: hidden cables, high ceiling, mortar)', (() => { const m = DB.services.filter(s => (s.modifier_ids || []).length); return m.length === 3 && m.every(s => s.ui_taxonomy.naming.qualifier); })());
check('at most 2 services explain why the customer\'s noun is not their entity\'s (the explanation may not quietly grow)', services.filter(s => s.presentation.ui_taxonomy.naming.entity_note).length <= 2);
check('no service uses the exception hatch today (a title that is not its composed name)', services.every(s => !s.presentation.ui_taxonomy.naming.exception));
const QUIRKS = { faucet_repair_drip: 'Faucet Drip Repair', flatscreen_mounting_standard: 'Flatscreen Mounting', furniture_assembly_flat_pack: 'Flat-Pack Furniture Assembly', stove_repair: 'Stove or Range Repair', generic_mounting_service: 'Wall Mounting for Any Item', door_repair_impact_damage: 'Door Impact-Damage Repair', leak_under_sink_repair: 'Under-Sink Leak Repair', router_configuration: 'Router Setup', shelf_mounting_standard_buy_the_hour: 'Shelf Mounting ⏰ Buy-the-Hour', blinds_shades_curtains_buy_the_hour: 'Blinds, Shades or Curtains Install ⏰ Buy-the-Hour' };
const quirkBad = Object.entries(QUIRKS).filter(([id, t]) => DB.services.find(s => s.id === id).ui_taxonomy.display_name !== t);
check('the titles that were typed with a parenthetical, a slash, a pipe or a reversed order are the composed ones', quirkBad.length === 0, quirkBad.map(([id]) => id).join(', '));

// ---- 3. every rule can fail -------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('\n=== 3. every rule can fail ===');
const svcOf = (src, id) => src.entities.flatMap(e => e.services).find(s => s.id === 'svc.' + id);
const mut = (fn) => { const s = clone(SRC); fn(s); return s; };
const MUTANTS = [
    ['a stale title', s => { svcOf(s, 'dishwasher_repair').presentation.ui_taxonomy.display_name = 'Dishwasher Fix'; }, 'STALE'],
    ['a stale scope name', s => { svcOf(s, 'dishwasher_repair').presentation.ui_taxonomy.naming.name = 'Dishwasher Fix'; }, 'STALE'],
    ['a stale verb', s => { svcOf(s, 'dishwasher_repair').presentation.verb_natural = 'fixed'; }, 'STALE'],
    ['a parenthetical in the object', s => { const n = svcOf(s, 'dishwasher_repair').presentation.ui_taxonomy.naming; n.object = 'Dishwasher (Standard)'; }, 'CHARS'],
    ['an emoji in the qualifier', s => { const n = svcOf(s, 'dishwasher_repair').presentation.ui_taxonomy.naming; n.qualifier = 'Quick ⏰'; }, 'CHARS'],
    ['a pipe in the object', s => { const n = svcOf(s, 'dishwasher_repair').presentation.ui_taxonomy.naming; n.object = 'Dishwasher|Washer'; }, 'CHARS'],
    ['a lowercase noun', s => { const n = svcOf(s, 'dishwasher_repair').presentation.ui_taxonomy.naming; n.object = 'dishwasher'; }, 'CASE'],
    ['a capitalised "or"', s => { const n = svcOf(s, 'cabinet_knob_or_pull_install').presentation.ui_taxonomy.naming; n.object = 'Cabinet Knob Or Pull'; }, 'CASE'],
    ['an object that ends in its own action noun', s => { const n = svcOf(s, 'dishwasher_repair').presentation.ui_taxonomy.naming; n.object = 'Dishwasher Repair'; }, 'STUTTER'],
    ['a word twice in a row', s => { const n = svcOf(s, 'dishwasher_repair').presentation.ui_taxonomy.naming; n.object = 'Dish Dish'; }, 'STUTTER'],
    ['two services with one scope', s => { const a = svcOf(s, 'dishwasher_repair').presentation.ui_taxonomy.naming, b = svcOf(s, 'dryer_repair').presentation.ui_taxonomy.naming; b.object = a.object; }, 'UNIQUE'],
    ['a condition that is not in the name', s => { delete svcOf(s, 'flatscreen_mounting_with_hidden_cables').presentation.ui_taxonomy.naming.qualifier; }, 'MODIFIER'],
    ['a name that shares nothing with its entity', s => { const n = svcOf(s, 'dishwasher_repair').presentation.ui_taxonomy.naming; n.object = 'Banana'; }, 'ENTITY'],
    ['an entity note on a name that already shares a word', s => { svcOf(s, 'dishwasher_repair').presentation.ui_taxonomy.naming.entity_note = 'The customer says it differently.'; }, 'ENTITY'],
    ['a tail on a service that is not priced by the hour', s => { svcOf(s, NOT_HOURLY).presentation.ui_taxonomy.naming.tail = 'buy_the_hour'; }, 'TAIL'],
    ['an unknown action', s => { svcOf(s, 'dishwasher_repair').presentation.ui_taxonomy.naming.actions = ['fix']; }, 'PARTS'],
    ['an unknown key', s => { svcOf(s, 'dishwasher_repair').presentation.ui_taxonomy.naming.colour = 'red'; }, 'PARTS'],
    ['a repeated action', s => { svcOf(s, 'dishwasher_repair').presentation.ui_taxonomy.naming.actions = ['repair', 'repair']; }, 'PARTS'],
    ['a service with no scope', s => { delete svcOf(s, 'dishwasher_repair').presentation.ui_taxonomy.naming; }, 'MISSING'],
    ['an exception with no reason', s => { svcOf(s, 'dishwasher_repair').presentation.ui_taxonomy.naming.exception = { display_name: 'Dishwasher Rescue' }; }, 'EXCEPTION'],
    ['an exception that excepts nothing', s => { svcOf(s, 'dishwasher_repair').presentation.ui_taxonomy.naming.exception = { display_name: 'Dishwasher Repair', reason: 'None.' }; }, 'EXCEPTION'],
    ['an action with no past participle', s => { delete s.policy.ui_config.service_naming.actions.repair.past; }, 'VOCAB'],
];
for (const [name, fn, code] of MUTANTS) {
    const s = mut(fn); const f = SN.findingsFromSource(s);
    check(`mutant is rejected as ${code}: ${name}`, f.some(x => x.code === code), 'findings: ' + codes(f));
}
{
    const s = mut(MUTANTS[0][1]); const r = V.validate(s);
    check('validate_source.js reports a naming finding as V-NAME-<CODE> (so publish.js refuses the source)', r.errors.some(e => e.code === 'V-NAME-STALE'), JSON.stringify(r.errors.slice(0, 2)));
}
{
    const s = mut(x => { svcOf(x, 'dishwasher_repair').presentation.ui_taxonomy.naming.exception = { display_name: 'Dishwasher Rescue', reason: 'The customer calls a dishwasher repair a rescue in this building.' }; SN.deriveSource(x); });
    const u = svcOf(s, 'dishwasher_repair').presentation;
    check('a valid exception is accepted: the title is the exception, the scope name is still composed, the verb is still the action\'s', SN.findingsFromSource(s).length === 0 && u.ui_taxonomy.display_name === 'Dishwasher Rescue' && u.ui_taxonomy.naming.name === 'Dishwasher Repair' && u.verb_natural === 'repaired');
}
{
    const stale = mut(x => { svcOf(x, 'dishwasher_repair').presentation.ui_taxonomy.display_name = 'x'; svcOf(x, 'dryer_repair').presentation.verb_natural = 'y'; svcOf(x, 'dryer_repair').presentation.ui_taxonomy.naming.name = 'z'; });
    const before = JSON.stringify(stale); const changed = SN.deriveSource(stale);
    check('deriving repairs exactly the three stale fields', changed === 3 && SN.findingsFromSource(stale).length === 0, 'changed ' + changed);
    check('...and a second derive changes nothing (idempotent)', SN.deriveSource(stale) === 0);
    const clean = clone(SRC); check('...and a clean source derives to itself, byte for byte', SN.deriveSource(clean) === 0 && lib.toText(clean) === lib.toText(SRC));
}
{
    const m = clone(DB); m.services.find(s => s.id === 'dishwasher_repair').ui_taxonomy.display_name = 'Hand edit';
    check('a hand edit of btnyc.json\'s title is found (the mirror is held to the scope too)', SN.findingsFromLegacy(m).some(x => x.code === 'STALE'));
    const ops = SN.patchOps(SRC, m);
    check('...and the patch that repairs it is one set operation', ops.length === 1 && ops[0].op === 'set' && ops[0].path.join('.') === 'services.' + m.services.findIndex(s => s.id === 'dishwasher_repair') + '.ui_taxonomy.display_name');
}

// ---- 3b. what customers typed before still routes the same --------------------------------------------------------------------------------------------------------------------
console.log('\n=== 3b. the words a customer typed before (the old titles) still route exactly as they did ===');
{
    // A title is also the text the golden master types as a customer would. Renaming 15 titles moves 8 of those points (the NEW title typed is a different phrase), and that is a fact about the fixture,
    // not about customers. What would be a regression is the OLD phrase routing differently now: so the old titles are typed again, on today's data and engine, and compared point for point with
    // what the golden master recorded for them before the change (archive/golden_master_T182.json: the last baseline before T188).
    const WAS = {
    "blinds_shades_curtains_buy_the_hour": "Blinds|Shades|Curtains ⏰ Buy-the-Hour",
    "stove_repair": "Stove / Range Repair",
    "door_repair_impact_damage": "Door Repair Impact Damage",
    "faucet_repair_drip": "Faucet Repair (Drip)",
    "flatscreen_mounting_standard": "Flatscreen Mounting (Standard)",
    "furniture_assembly_flat_pack": "Furniture Assembly Flat-Pack",
    "furniture_repair_hourly": "Furniture Repair ⏰Hourly",
    "high_ceiling_bulb_replacement": "High Ceiling Bulb Replacement",
    "leak_under_sink_repair": "Leak Under Sink Repair",
    "router_configuration": "Router Configuration",
    "scratch_or_water_ring_removal": "Scratch or Water Ring Removal",
    "shelf_mortar_mounting_buy_the_hour": "Shelf Mortar Mounting ⏰Buy-the-Hour",
    "shelf_mounting_standard_buy_the_hour": "Shelf Mounting Standard ⏰Buy-the-Hour",
    "smart_plug_configuration": "Smart Plug Configuration",
    "generic_mounting_service": "Wall Mounting (any item)"
    };
    const vm = require('vm'), GM = path.join(ROOT, 'archive', 'golden_master_T182.json');
    check('the golden master the old titles are held to is in the archive', fs.existsSync(GM));
    try {
        const G = JSON.parse(fs.readFileSync(GM, 'utf8'));
        for (const f of ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js']) if (!fs.existsSync(path.join(ROOT, f))) cp_().execSync('node ' + JSON.stringify(path.join(__dirname, 'extract_modules.js')), { cwd: ROOT, stdio: 'ignore' });
        const sb = { DB, SERVICE_DATA: DB, window: { DB }, console: { log() {}, warn() {}, error() {} } }; sb.global = sb; vm.createContext(sb);
        for (const f of ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
        sb.initNlpSets(); if (typeof sb.refreshNlpPreviewBindings === 'function') sb.refreshNlpPreviewBindings();
        const route = text => { const c = sb.collectBookingContext_freeText(text), r = sb.executeWorkflow(c, DB); return [(r.entity && r.entity.id) || r.entityType || null, r.uiTemplate, r.quote && r.quote.laborEstimate, r.quote && r.quote.totalMin, r.confidence && r.confidence.score, r.quantity && r.quantity.units, (r.activeTags || []).slice().sort().join(',')]; };
        const moved = [];
        for (const [id, was] of Object.entries(WAS)) for (const [vn, text] of [['name', was.toLowerCase()], ['count', 'I need 3 ' + was.toLowerCase()]]) {
            const before = G['text|' + id + '|' + vn], now = route(text);
            if (JSON.stringify(before) !== JSON.stringify(now)) moved.push(`${id}|${vn}: ${JSON.stringify(before)} -> ${JSON.stringify(now)}`);
        }
        check(`the ${Object.keys(WAS).length} old titles, typed alone and with a count (${Object.keys(WAS).length * 2} phrases), give the same entity, card, price, time, confidence, quantity and tags as before`, moved.length === 0, moved.slice(0, 3).join('\n      '));
        check('...and the old titles are the titles that changed (the table is the whole change)', Object.keys(WAS).every(id => DB.services.find(s => s.id === id).ui_taxonomy.display_name !== WAS[id]) && Object.keys(WAS).length === 15);
    } catch (e) { check('the old titles could be typed on today\'s engine', false, String(e.stack || e).split('\n').slice(0, 3).join(' | ')); }
}

// ---- 4. the page -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
function findChrome() { const c = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium', ...(() => { try { return execSync('find /home/*/.cache/puppeteer /root/.cache/puppeteer -type f -name chrome 2>/dev/null || true', { shell: '/bin/bash' }).toString().trim().split('\n').filter(Boolean); } catch { return []; } })(), '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'].filter(Boolean); return c.find(p => fs.existsSync(p)) || null; }

async function run(puppeteer, chromePath, html) {
    const base = PAGE.DEPLOY_BASE + 'qr.html';
    const browser = await puppeteer.launch({ headless: 'new', executablePath: chromePath, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const out = { rows: [], acronyms: null, error: null };
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 390, height: 844 });
        await page.setRequestInterception(true);
        page.on('request', rq => {
            const u = rq.url(), bare = u.split(/[?#]/)[0];
            if (bare === base) return rq.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
            const f = PAGE.localFileForUrl(u);
            if (f) return rq.respond({ status: 200, contentType: PAGE.contentTypeOf(f), headers: { 'Access-Control-Allow-Origin': '*' }, body: fs.readFileSync(f) });
            if (/^https?:/.test(u)) return rq.abort();
            rq.continue();
        });
        await page.goto(base, { waitUntil: 'load' });
        await page.waitForFunction(() => window.DB && window.DB.services, { timeout: 30000 });
        await sleep(900);
        out.rows = await page.evaluate(async () => {
            const rows = [];
            for (const svc of DB.services) {
                const row = { id: svc.id };
                try {
                    sqRestart();
                    S._svc = svc; S.stype = svc.service_type || 'Install'; S.qty = 1; S.detTagIds = []; S.manTagIds = []; S.negatedTagIds = []; S.inherentTagIds = [];
                    S.intent = { category: svc.ui_taxonomy.category_id, label: svc.ui_taxonomy.display_name, group: svc.id, base: 0, stype: S.stype, qtyLabel: 'item', key: svc.id, _groupId: null };
                    sqBuildAdlib();
                    const noun = document.querySelector('#sqAdlibSentence .adlib-object');
                    const pills = [...document.querySelectorAll('#sqAdlibSentence .adlib-pill')].map(p => p.firstElementChild.textContent.trim());
                    row.noun = noun ? noun.textContent.trim() : null; row.verb = pills[1] || null;
                    row.sentence = document.getElementById('sqAdlibSentence').textContent.replace(/\s+/g, ' ').trim();
                    row.phrase = affirmJobPhrase(svc);
                } catch (e) { row.threw = String(e.message).slice(0, 120); }
                rows.push(row);
            }
            sqRestart();
            return rows;
        });
        out.acronyms = await page.evaluate(() => ['GFCI Outlet Replacement', 'LED Bulb Upgrade', 'USB Outlet Install', 'PAX Wardrobe Assembly', 'Window AC Setup', 'P-Trap Cleaning', 'Wi-Fi Extender Setup', 'Faucet Drip Repair', 'Outlet Install']
            .map(n => affirmJobPhrase({ ui_taxonomy: { naming: { name: n }, display_name: n + ' ⏰ Buy-the-Hour' } })));
    } catch (e) { out.error = e.message; } finally { await browser.close(); }
    return out;
}
const ACRONYMS = ['a GFCI outlet replacement job', 'an LED bulb upgrade job', 'a USB outlet install job', 'a PAX wardrobe assembly job', 'a window AC setup job', 'a P-trap cleaning job', 'a wi-fi extender setup job', 'a faucet drip repair job', 'an outlet install job'];

(async () => {
    const chromePath = findChrome(); let puppeteer = null; try { puppeteer = require('puppeteer-core'); } catch { /* handled below */ }
    if (!chromePath || !puppeteer) {
        console.log('\n  environment gap: no Chrome / puppeteer-core here -- the page half is SKIPPED. Set CHROME_PATH to run it.');
        console.log(`\n[service naming, T188] ${pass} passed, ${fail} failed -- page half SKIPPED\n`); process.exit(fail > 0 ? 1 : 0);
    }
    console.log('\n=== 4. the page: the sentence and the card read the authored scope ===');
    const RAW = fs.readFileSync(QR, 'utf8');
    const real = await run(puppeteer, chromePath, RAW);
    check('the page rendered the sentence for every service without an error', !real.error && real.rows.length === 76 && real.rows.every(r => !r.threw && r.noun && r.verb), real.error || JSON.stringify(real.rows.filter(r => r.threw || !r.noun || !r.verb).slice(0, 3)));
    const byId = Object.fromEntries(real.rows.map(r => [r.id, r]));
    const nounVerb = real.rows.filter(r => { const n = DB.services.find(s => s.id === r.id); return r.noun !== n.ui_taxonomy.naming.object || r.verb !== n.verb_natural; });
    check('the sentence\'s noun is the service\'s authored object and its verb is its authored verb, for all 76', nounVerb.length === 0, nounVerb.slice(0, 4).map(r => `${r.id}: "${r.noun}" "${r.verb}"`).join('; '));
    const phraseBad = real.rows.filter(r => { const n = DB.services.find(s => s.id === r.id).ui_taxonomy.naming.name; return !r.phrase.endsWith(' job') || /[()|⏰]|buy-the-hour/i.test(r.phrase) || !r.phrase.toLowerCase().includes(n.split(' ')[0].toLowerCase().replace(/,$/, '')); });
    check('the confirmation card\'s job phrase is the authored name: no parenthetical, emoji or "buy-the-hour", for all 76', phraseBad.length === 0, phraseBad.slice(0, 4).map(r => `${r.id}: ${r.phrase}`).join('; '));
    const stutter = real.rows.filter(r => /\b(\w+)\s+\1\b/i.test(r.sentence) || /\b(\w+)\s+\1\b/i.test(r.phrase));
    check('no sentence and no job phrase repeats a word (R-CLIENT-STUTTER), for all 76', stutter.length === 0, stutter.slice(0, 4).map(r => r.sentence).join(' | '));
    const suffix = real.rows.filter(r => { const n = DB.services.find(s => s.id === r.id).ui_taxonomy.naming; const last = r.noun.split(' ').pop().toLowerCase(); return n.actions.some(a => VOCAB.actions[a].noun.toLowerCase() === last); });
    check('no sentence noun ends in its own action\'s noun ("Cabinet Door or Drawer Adjustment adjusted")', suffix.length === 0, suffix.map(r => r.id).join(', '));
    check('the quirks named above are gone: "I need 1 Faucet repaired", "...Flatscreen mounted", "...Furniture disassembled", "...Slow Drain cleared", "...Shelf mounted"', /Faucet 1?\s*repaired|Faucet\s*repaired/.test(byId.faucet_repair_drip.sentence) && byId.faucet_repair_drip.verb === 'repaired' && byId.faucet_repair_drip.noun === 'Faucet' && byId.flatscreen_mounting_standard.verb === 'mounted' && byId.furniture_disassembly_for_moving.verb === 'disassembled' && byId.slow_drain_clearing.verb === 'cleared' && byId.shelf_mounting_standard_buy_the_hour.noun === 'Shelf', JSON.stringify([byId.faucet_repair_drip, byId.shelf_mounting_standard_buy_the_hour]));
    check('the card says "a faucet drip repair job" and "a shelf mounting job" (the title\'s extras are not spoken)', byId.faucet_repair_drip.phrase === 'a faucet drip repair job' && byId.shelf_mounting_standard_buy_the_hour.phrase === 'a shelf mounting job', byId.faucet_repair_drip.phrase + ' / ' + byId.shelf_mounting_standard_buy_the_hour.phrase);
    check('acronyms stay acronyms and take the right article (a GFCI, an LED, a USB, a PAX; a P-trap)', JSON.stringify(real.acronyms) === JSON.stringify(ACRONYMS), JSON.stringify(real.acronyms));

    console.log('\n=== 5. mutants of the page ===');
    const mutants = [
        ['the sentence reads the title again, not the authored object', h => h.replace('(_nm && _nm.object) ||', ''), r => r.rows.some(x => x.id === 'faucet_repair_drip' && x.noun !== 'Faucet')],
        ['the verb is guessed from the title again', h => h.replace("if (_nm) { /* authored: nothing to guess */ }\n            else if (_ctx.includes('adjustment'))", "if (_ctx.includes('adjustment'))"), r => r.rows.some(x => x.id === 'router_configuration' ? x.verb !== 'set up' : false) || r.rows.some(x => x.id === 'slow_drain_clearing' && x.verb !== 'cleared')],
        ['the card cleans the title again, not the authored name', h => h.replace('const authored = entity?.ui_taxonomy?.naming?.name;', 'const authored = undefined;'), r => r.rows.some(x => x.id === 'shelf_mounting_standard_buy_the_hour' && x.phrase !== 'a shelf mounting job')],
        ['an acronym is lowercased and takes "a"', h => h.replace(".map(w => /^[A-Z0-9]{2,}$/.test(w) ? w : /^[A-Z]-/.test(w) ? w[0] + w.slice(1).toLowerCase() : w.toLowerCase())", '.map(w => w.toLowerCase())'), r => JSON.stringify(r.acronyms) !== JSON.stringify(ACRONYMS)],
    ];
    for (const [name, mutate, caught] of mutants) {
        const html = mutate(RAW);
        if (html === RAW) { check('mutant applies: ' + name, false, 'the mutation did not change the page'); continue; }
        const r = await run(puppeteer, chromePath, html);
        check('mutant is caught: ' + name, !r.error && caught(r), r.error || '');
    }
    console.log(`\n[service naming, T188] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
    process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.log('TEST ERROR ' + e.stack); process.exit(1); });
