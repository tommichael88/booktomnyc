#!/usr/bin/env node
/**
 * verify_thin_laptop_question.js -- #184: a part price is not promised for a RAM or SSD swap until the customer has said whether the laptop is a very thin one.
 *
 * @enforces R-CLIENT-CONVERGE
 * @enforces R-INVARIANT-CANONICAL
 * @enforces R-INTAKE-WIREREMOVE
 * Principle served (not enforced by definition; the Rules above are what this test enforces): P-WHITEFLAG-PRICED
 *
 * THE DEFECT (PENDING_DECISIONS #184): on a thin laptop the memory or the drive is often soldered to the board, so a "RAM upgrade, $125" cannot be done. The catalog quoted it anyway (RAM or SSD
 * answered, job moved to the part service, firm price). The operator's ruling (2026-10-12 03:38 NY): direction A, with an observable wording, since "is the RAM soldered?" is a question the
 * customer cannot answer (Wire-or-Remove): "Is this a very thin laptop (under about an inch thick, like a MacBook Air or an ultrabook)?"
 *
 * THE SHAPE: the question is authored data (`intake_modules.thin_laptop`, asked only on a laptop). The three answers that mean "the part is a RAM or an SSD" (a slow-with-many-tabs answer, a slow-to-start
 * answer, a "drive not found" screen) carry `route_to.ask_first: "thin_laptop"`: the move to the part service WAITS for that question while it can still be asked and has not been answered, and is cancelled
 * by an answer whose own route_to names the service the job is already in ("Yes" and "I'm not sure" keep the job at the diagnostic, an existing priced path, so no new price is invented). The part service
 * holds its price while the question is open (`route.guardPending`, read by the card). Nothing in the engine names a module or a service.
 *
 * MEASURED BY WHAT THE RULE CLAIMS (P-GOVERN-GOODHART): the real engine at its public boundary, every way in, then the real page, and copies broken in one way each.
 *   1. THE DATA     The question's wording is the ruled wording (observable, no jargon), it is asked only on a laptop, "Yes" and "I'm not sure" send the job to the diagnostic with a customer sentence, "No" sends it
 *                   nowhere; exactly the RAM/SSD answers wait for it; nothing else in the catalog does.
 *   2. EVERY WAY IN The tile at the diagnostic with answers given, one tap at a time, the part service's own tile, a typed sentence, and tags toggled on the tile: laptop + RAM/SSD with the question
 *                   unanswered holds the price (and the job is where the customer's answers say); "No" prices exactly as a desktop is priced; "Yes" and "I'm not sure" end at the diagnostic; a desktop, an
 *                   all-in-one and every other part (a battery, a fan) are never asked and never held.
 *   3. TAKEN BACK   Taking the move back (orch_unroute) returns to the part service with the question open again, and the price is held again. And no dead end: in every state the diagnostic or the part
 *                   service can reach, one tap at a time, a held price always has a question on the card to answer.
 *   4. THE PAGE     On the real page: with the question open the card draws it, shows "Please answer the questions above to see a quote.", no labor line and no "Add to Request"; answered "No" the price
 *                   and the button appear; answered "Yes" the customer is told why the job is a diagnostic; a desktop is priced at once.
 *   5. NON-VACUITY  Twelve copies, each broken in one way (data: the wait removed from one route, the question made unconditional, the "Yes" route removed, the question's wording changed; engine: the wait
 *                   never holds, the cancellation removed, the guard always true (seen by two claims), the guard never true; page: the card ignores the guard, and two copies that break the card through the engine), each fails the check that guards it.
 *
 * WHAT THIS DOES NOT COVER (named): whether "under about an inch thick" is the right threshold is bench knowledge (a technician reads it, as for #183); this proves the question is asked, waited for and
 * honoured, not that every thin laptop is caught by it. A customer who answers "No" to a thin laptop is quoted the part and the technician finds out on site (the diagnostic fee path is the remedy).
 *
 * RUN ON ANOTHER TREE (G-INVARIANT-PREFIX): QR_ROOT=<tree> node test_harness/verify_thin_laptop_question.js
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const { check, finish } = require('./_shared.js');
const { engine } = require('./_engine.js');
const { assemble } = require('./_page.js');
const ROOT = process.env.QR_ROOT ? path.resolve(process.env.QR_ROOT) : path.resolve(__dirname, '..');
const DB0 = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
const QR_PATH = path.join(ROOT, 'qr.html');
const QR_TEXT = fs.readFileSync(QR_PATH, 'utf8');
const clone = o => JSON.parse(JSON.stringify(o));
const wait = ms => new Promise(r => setTimeout(r, ms));
const clean = s => String(s || '').replace(/\s+/g, ' ').trim();

const DIAG = 'computer_diagnostic', PARTS = 'internal_hardware_replacement';
const WORDING = 'Is this a very thin laptop (under about an inch thick, like a MacBook Air or an ultrabook)?';
const LAPTOP = 'Laptop', DESKTOP = 'Desktop (tower)', AIO = 'All-in-one';
const YES = "Yes, it's very thin", NO = "No, it's thicker", UNSURE = "I'm not sure";
const RAM_PART = 'RAM (memory)', SSD_PART = 'SSD (storage drive)';
const JARGON = /\b(solder|soldered|sodimm|dimm|form factor|chassis|bga|nvme|m\.2|ddr\d?)\b/i;

// ---- the engine, loaded whole from a page file, on a catalog -------------------------------------------------------------------------------------------------------------------------------
function sandbox(qrPath, db) {
    const sb = { DB: db, SERVICE_DATA: db, window: { DB: db }, console: { log() {}, warn() {}, error() {}, info() {}, debug() {} } }; sb.global = sb; vm.createContext(sb);
    vm.runInContext(engine(qrPath).wrapper, sb, { filename: 'engine_modules' });
    sb.initNlpSets(); if (typeof sb.refreshNlpPreviewBindings === 'function') sb.refreshNlpPreviewBindings();
    return sb;
}
const svcOf = (D, id) => D.services.find(s => s.id === id);
function tile(sb, D, id, answers, tags) { const s = svcOf(D, id); const c = sb.collectBookingContext_catalog(s, s.ui_taxonomy.category_id); c.answers = Object.assign({}, answers || {}); if (tags) c.manuallyToggledTagIds = tags.slice(); return sb.executeWorkflow(c, D); }
function typed(sb, D, phrase) { const c = sb.collectBookingContext_freeText(phrase); return sb.executeWorkflow(Object.assign({}, c, { tagsAffirmed: true }), D); }
const open = r => (r.visibleChain || []).filter(m => !(r.answers || {})[m.moduleKey]).map(m => m.moduleKey);
const drawn = (r, k) => (r.visibleChain || []).some(m => m.moduleKey === k);
const ent = r => r && r.entity && r.entity.id;

// the three answers that mean "the part is a RAM or an SSD", read from the catalog itself (never named here)
function waits(D) {
    const out = [];
    Object.entries(D.intake_modules).forEach(([m, def]) => (def.client_response || []).forEach(o => { if (o.route_to && o.route_to.ask_first) out.push({ module: m, label: o.label, ask: o.route_to.ask_first, to: o.route_to.service }); }));
    return out;
}
// the first state, found one tap at a time from the diagnostic with a device answered, in which `module` is open; then that answer applied. (Nothing here knows the route to it.)
function reach(sb, D, device, w) {
    const start = tile(sb, D, DIAG, { device_type: device });
    const seen = new Set();
    function dfs(r, depth) {
        const k = JSON.stringify(Object.entries(r.answers || {}).sort());
        if (seen.has(k) || depth > 5) return null; seen.add(k);
        if (open(r).includes(w.module) && ent(r) === DIAG) return sb.orch_apply_answer(r, w.module, w.label, D);
        for (const mk of open(r)) { const m = (r.visibleChain || []).find(x => x.moduleKey === mk); for (const o of (m.client_response || [])) { let n; try { n = sb.orch_apply_answer(r, mk, o.label, D); } catch (e) { continue; } if (ent(n) !== DIAG) continue; const hit = dfs(n, depth + 1); if (hit) return hit; } }
        return null;
    }
    return dfs(start, 0);
}

// ---- everything the checks read, measured on one (engine, catalog) pair ----------------------------------------------------------------------------------------------------------------------
function measure(sb, D) {
    const M = { waits: waits(D), taps: [], part: {}, typed: {}, tags: {} };
    for (const w of M.waits) {
        const t = { w };
        t.lap = reach(sb, D, LAPTOP, w);
        t.desk = reach(sb, D, DESKTOP, w);
        t.aio = reach(sb, D, AIO, w);
        t.no = t.lap && sb.orch_apply_answer(t.lap, w.ask, NO, D);
        t.yes = t.lap && sb.orch_apply_answer(t.lap, w.ask, YES, D);
        t.unsure = t.lap && sb.orch_apply_answer(t.lap, w.ask, UNSURE, D);
        M.taps.push(t);
    }
    // the part service's own tile and a direct answer at the diagnostic
    const at = (comp, dev, thin) => tile(sb, D, PARTS, Object.assign({ computer_component: comp }, dev ? { device_type: dev } : {}, thin ? { thin_laptop: thin } : {}));
    M.part.ram = at(RAM_PART, LAPTOP); M.part.ssd = at(SSD_PART, LAPTOP);
    M.part.ramNo = at(RAM_PART, LAPTOP, NO); M.part.ramYes = at(RAM_PART, LAPTOP, YES); M.part.ramUnsure = at(RAM_PART, LAPTOP, UNSURE); M.part.ssdNo = at(SSD_PART, LAPTOP, NO);
    M.part.ramDesk = at(RAM_PART, DESKTOP); M.part.ramAio = at(RAM_PART, AIO); M.part.ssdDesk = at(SSD_PART, DESKTOP);
    M.part.battery = at('Battery', LAPTOP); M.part.fan = at('Fan', LAPTOP);
    M.part.ramNoDevice = at(RAM_PART, null);
    M.part.diagRam = (() => { const w = M.waits.find(x => /tabs or programs/.test(x.label)); return w ? tile(sb, D, DIAG, { device_type: LAPTOP, computer_symptom: ((D.intake_modules.computer_symptom.client_response.find(o => /slow/i.test(o.label))) || {}).label, [w.module]: w.label }) : null; })();
    M.part.diagRamNo = M.part.diagRam && sb.orch_apply_answer(M.part.diagRam, 'thin_laptop', NO, D);
    // a typed sentence, and tags toggled on the tile
    M.typed.lap = typed(sb, D, 'upgrade the RAM on my laptop'); M.typed.ssdLap = typed(sb, D, 'ssd upgrade laptop'); M.typed.desk = typed(sb, D, 'upgrade the RAM in my desktop');
    M.tags.lap = tile(sb, D, PARTS, {}, ['#ram_upgrade', '#laptop']); M.tags.desk = tile(sb, D, PARTS, {}, ['#ram_upgrade', '#desktop']);
    // every state either service can reach, one tap at a time: where the price is held, is there a question on the card to answer? (no dead end)
    M.space = { nodes: 0, held: 0, dead: [] };
    { const seen = new Set(), key = r => ent(r) + JSON.stringify(Object.entries(r.answers || {}).sort());
      const visit = (r, depth) => { const k = key(r); if (seen.has(k) || depth > 9) return; seen.add(k); M.space.nodes++;
          const o = open(r); if (r.guardPending) { M.space.held++; if (!o.length) M.space.dead.push(k.slice(0, 160)); }
          for (const mk of o) { const m = (r.visibleChain || []).find(x => x.moduleKey === mk); for (const op of (m.client_response || [])) { let n; try { n = sb.orch_apply_answer(r, mk, op.label, D); } catch (e) { continue; } visit(n, depth + 1); } } };
      for (const id of [DIAG, PARTS]) visit(tile(sb, D, id, {}), 0); }
    // the move taken back
    M.back = M.part.ramYes && M.part.ramYes.routedFrom ? sb.orch_unroute(M.part.ramYes, D) : null;
    return M;
}

// each assertion is one named claim about what `measure` found; a copy broken in one way must make a NAMED one fail
function claims(M, D) {
    const C = {}; const priceDesk = M.part.ramDesk && M.part.ramDesk.quote && [M.part.ramDesk.quote.laborEstimate, M.part.ramDesk.quote.totalMin].join('/');
    const price = r => r && r.quote && [r.quote.laborEstimate, r.quote.totalMin].join('/');
    C['2.1 laptop + a RAM/SSD answer, one tap at a time: the job stays at the diagnostic while the question is open, the question is drawn, the price is held'] = M.taps.length >= 3 && M.taps.every(t => t.lap && ent(t.lap) === DIAG && open(t.lap).includes(t.w.ask) && t.lap.guardPending === true);
    C['2.2 ...answered "No, it\'s thicker": the job moves to the part service and is priced exactly as a desktop is priced'] = M.taps.length >= 3 && M.taps.every(t => t.no && ent(t.no) === PARTS && t.no.guardPending === false && !!price(t.no)) && M.taps.some(t => price(t.no) === priceDesk);
    C['2.3 ...answered "Yes, it\'s very thin" or "I\'m not sure": the job stays at the diagnostic and nothing is held'] = M.taps.length >= 3 && M.taps.every(t => t.yes && t.unsure && ent(t.yes) === DIAG && ent(t.unsure) === DIAG && !t.yes.guardPending && !t.unsure.guardPending && !(t.yes.routedFrom) && !(t.unsure.routedFrom));
    C['2.4 a desktop or an all-in-one is never asked: the job moves at once and the question is not drawn'] = M.taps.length >= 3 && M.taps.every(t => t.desk && t.aio && ent(t.desk) === PARTS && ent(t.aio) === PARTS && !drawn(t.desk, 'thin_laptop') && !drawn(t.aio, 'thin_laptop') && !t.desk.guardPending && !t.aio.guardPending);
    C['2.5 the part service\'s own tile: RAM or SSD on a laptop holds the price and draws the question'] = [M.part.ram, M.part.ssd].every(r => r && ent(r) === PARTS && r.guardPending === true && open(r).includes('thin_laptop'));
    C['2.6 ...answered "No": the price (the same as a desktop\'s) is shown; "Yes" and "I\'m not sure": the job goes to the diagnostic, with the reason recorded'] = [M.part.ramNo, M.part.ssdNo].every(r => r && ent(r) === PARTS && !r.guardPending && price(r) === priceDesk) && [M.part.ramYes, M.part.ramUnsure].every(r => r && ent(r) === DIAG && !!r.routedFrom && r.routedFrom.fromServiceId === PARTS && !r.guardPending);
    C['2.7 a desktop, an all-in-one, a battery and a fan are never held, and the question is never drawn for them'] = [M.part.ramDesk, M.part.ramAio, M.part.ssdDesk, M.part.battery, M.part.fan].every(r => r && ent(r) === PARTS && !r.guardPending && !drawn(r, 'thin_laptop'));
    C['2.8 the device not yet answered: the price waits for the device (it might be a laptop), and the question is not drawn yet'] = !!M.part.ramNoDevice && M.part.ramNoDevice.guardPending === true && !drawn(M.part.ramNoDevice, 'thin_laptop') && open(M.part.ramNoDevice).includes('device_type');
    C['2.9 a RAM answer given at the diagnostic directly (not by tap) is held the same way, and "No" there moves the job'] = !!M.part.diagRam && ent(M.part.diagRam) === DIAG && M.part.diagRam.guardPending === true && !!M.part.diagRamNo && ent(M.part.diagRamNo) === PARTS;
    C['2.10 a typed sentence: a laptop RAM or SSD job holds the price at the part service; a desktop is priced'] = [M.typed.lap, M.typed.ssdLap].every(r => r && ent(r) === PARTS && r.guardPending === true) && !!M.typed.desk && ent(M.typed.desk) === PARTS && !M.typed.desk.guardPending;
    C['2.11 tags toggled on the tile (RAM + laptop) hold the price; RAM + desktop does not'] = !!M.tags.lap && M.tags.lap.guardPending === true && !!M.tags.desk && M.tags.desk.guardPending === false;
    C['3.1 taking the move back returns to the part service with the question open again and the price held'] = !!M.back && ent(M.back) === PARTS && open(M.back).includes('thin_laptop') && M.back.guardPending === true && !(M.back.answers || {}).thin_laptop;
    C['2.12 no dead end: in every state either service can reach (one tap at a time) where the price is held, a question is on the card to answer; and the hold is not vacuous'] = M.space.nodes >= 300 && M.space.held >= 20 && M.space.dead.length === 0;
    // the data
    const q = D.intake_modules.thin_laptop;
    C['1.1 the question is the ruled wording'] = !!q && q.question === WORDING;
    C['1.2 ...an observable fact in the customer\'s words (no component jargon)'] = !!q && !JARGON.test(q.question) && !(q.client_response || []).some(o => JARGON.test(o.label) || JARGON.test((o.route_to || {}).because || '')) && /MacBook Air/.test(q.question) && /inch thick/.test(q.question);
    C['1.3 ...asked only on a laptop (depends_on the device answer "Laptop") and a routing question'] = !!q && q.purpose === 'routing' && Array.isArray(q.depends_on) && q.depends_on.length === 1 && q.depends_on[0].question_id === 'q.device_type' && ((D.intake_modules.device_type.client_response || []).find(o => o.id === q.depends_on[0].option_id) || {}).label === LAPTOP;
    C['1.4 ...three answers: "Yes" and "I\'m not sure" send the job to the diagnostic with a customer sentence; "No" sends it nowhere'] = !!q && (q.client_response || []).length === 3 && (() => { const by = Object.fromEntries(q.client_response.map(o => [o.label, o])); return !!by[YES] && !!by[NO] && !!by[UNSURE] && by[YES].route_to && by[YES].route_to.service === DIAG && by[UNSURE].route_to && by[UNSURE].route_to.service === DIAG && !by[NO].route_to && [by[YES], by[UNSURE]].every(o => /[.!]$/.test(o.route_to.because.trim()) && o.route_to.because.trim().length > 40); })();
    C['1.5 exactly three answers wait for it (a slow-with-many-tabs answer, a slow-to-start answer, a drive-not-found screen), each to the part service'] = M.waits.length === 3 && M.waits.every(w => w.ask === 'thin_laptop' && w.to === PARTS) && /operating system or drive was not found/.test(M.waits.map(w => w.label).join('|')) && /several minutes to start up/.test(M.waits.map(w => w.label).join('|')) && /many tabs or programs/.test(M.waits.map(w => w.label).join('|'));
    for (const k of Object.keys(C)) C[k] = !!C[k];
    return C;
}

// ---- 1-3. the real catalog, the real engine --------------------------------------------------------------------------------------------------------------------------------------------------
console.log('\n=== 1-3. the data, every way in, taken back (real engine, real catalog) ===');
const REAL = sandbox(QR_PATH, DB0);
let M0 = null; try { M0 = measure(REAL, DB0); } catch (e) { check('the real catalog could be measured', false, { expected: 'no throw', got: String(e.stack || e).split('\n').slice(0, 3).join(' | ') }); }
const C0 = M0 ? claims(M0, DB0) : {};
for (const [name, ok] of Object.entries(C0).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))) check(name, !!ok);

// ---- 5. non-vacuity (engine and data copies); the page copies follow the page checks ----------------------------------------------------------------------------------------------------------------
function brokenEngine(replacer) { const t = replacer(QR_TEXT); if (t === QR_TEXT) return null; const f = path.join(os.tmpdir(), `qr_thin_mut_${process.pid}_${Math.abs(hash(t))}.html`); fs.writeFileSync(f, t); return f; }
function hash(s) { let h = 0; for (let i = 0; i < s.length; i += 97) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
const dataMutants = [
    ['data: one route\'s wait removed (the job moves before the question is asked)', d => { const w = waits(d)[0]; delete d.intake_modules[w.module].client_response.find(o => o.label === w.label).route_to.ask_first; }, '2.1 laptop + a RAM/SSD answer, one tap at a time: the job stays at the diagnostic while the question is open, the question is drawn, the price is held'],
    ['data: the question asked of every device, not only a laptop', d => { delete d.intake_modules.thin_laptop.depends_on; }, '1.3 ...asked only on a laptop (depends_on the device answer "Laptop") and a routing question'],
    ['data: "Yes, it\'s very thin" no longer sends the job to the diagnostic', d => { delete d.intake_modules.thin_laptop.client_response.find(o => o.label === YES).route_to; }, '1.4 ...three answers: "Yes" and "I\'m not sure" send the job to the diagnostic with a customer sentence; "No" sends it nowhere'],
    ['data: the wording changed to the component question', d => { d.intake_modules.thin_laptop.question = 'Is the RAM soldered to the board?'; }, '1.1 the question is the ruled wording'],
];
const engineMutants = [
    ['engine: the wait never holds (orch_route_is_held always false)', t => t.replace(/function orch_route_is_held\(routeTo, route\) \{/, 'function orch_route_is_held(routeTo, route) { return false;'), '2.1 laptop + a RAM/SSD answer, one tap at a time: the job stays at the diagnostic while the question is open, the question is drawn, the price is held'],
    ['engine: the cancellation removed ("Yes" still moves the job to the part service)', t => t.replace('return !!(o && o.route_to && route.entity && o.route_to.service === route.entity.id);', 'return false;'), '2.3 ...answered "Yes, it\'s very thin" or "I\'m not sure": the job stays at the diagnostic and nothing is held'],
    ['engine: the guard is always true (every part is held)', t => t.replace(/function orch_guard_pending\(intakeChain, answers, db\) \{/, 'function orch_guard_pending(intakeChain, answers, db) { return true;'), '2.7 a desktop, an all-in-one, a battery and a fan are never held, and the question is never drawn for them'],
    ['engine: the guard is always true (a price is held where no question is left to answer)', t => t.replace(/function orch_guard_pending\(intakeChain, answers, db\) \{/, 'function orch_guard_pending(intakeChain, answers, db) { return true;'), '2.12 no dead end: in every state either service can reach (one tap at a time) where the price is held, a question is on the card to answer; and the hold is not vacuous'],
    ['engine: the guard is never true (the price is never held)', t => t.replace(/function orch_guard_pending\(intakeChain, answers, db\) \{/, 'function orch_guard_pending(intakeChain, answers, db) { return false;'), '2.5 the part service\'s own tile: RAM or SSD on a laptop holds the price and draws the question'],
];
for (const [name, mutate, claim] of dataMutants) {
    const d = clone(DB0); try { mutate(d); } catch (e) { check('mutant applies: ' + name, false, { expected: 'a change', got: String(e.message) }); continue; }
    let C = null; try { C = claims(measure(sandbox(QR_PATH, d), d), d); } catch (e) { C = { [claim]: false }; }
    check('mutant is caught: ' + name, C[claim] === false, { expected: 'the claim "' + claim.slice(0, 50) + '..." fails', got: 'it still held' });
}
for (const [name, replacer, claim] of engineMutants) {
    const f = brokenEngine(replacer);
    if (!f) { check('mutant applies: ' + name, false, { expected: 'a change', got: 'the page text did not change' }); continue; }
    let C = null; try { const d = clone(DB0); C = claims(measure(sandbox(f, d), d), d); } catch (e) { C = { [claim]: false }; } finally { try { fs.unlinkSync(f); } catch (e) { /* ignore */ } }
    check('mutant is caught: ' + name, C[claim] === false, { expected: 'the claim "' + claim.slice(0, 50) + '..." fails', got: 'it still held' });
}

// ---- 4. the real page (jsdom), then the page copy -------------------------------------------------------------------------------------------------------------------------------------------------
async function pageRun(html) {
    const { JSDOM } = require(path.join(__dirname, 'node_modules', 'jsdom'));
    const dom = new JSDOM(html, { url: 'https://tommichael88.github.io/booktomnyc/qr.html', runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, beforeParse(w) {
        w.fetch = async u => String(u).includes('btnyc.json') ? { ok: true, json: async () => clone(DB0) } : { ok: false, status: 404 };
        w.HTMLElement.prototype.scrollIntoView = function () {}; w.console.log = () => {}; w.console.warn = () => {}; w.console.error = () => {};
    } });
    for (let i = 0; i < 80 && !(dom.window.DB && dom.window.renderRoute); i++) await wait(100);
    const w = dom.window, doc = w.document, out = { error: null };
    try {
        const cardText = () => clean((doc.getElementById(w.S._lastContainerId || 'intakeQuestionsContainer') || doc.body).textContent);
        const hasAdd = () => !!doc.getElementById('btn-curated-add');
        const seeRoute = (id, answers) => { const s = w.DB.services.find(x => x.id === id); const c = w.collectBookingContext_catalog(s, s.ui_taxonomy.category_id); c.answers = Object.assign({}, answers); const r = w.executeWorkflow(c, w.DB); w.S._divergencePath = null; w.renderRoute(r); return r; };
        const tapChip = (mk, label) => { const el = [...doc.querySelectorAll('.ims-chip')].find(b => b.dataset.mod === mk && b.dataset.label === label); if (!el) return false; el.dispatchEvent(new w.Event('click', { bubbles: true })); return true; };
        // the question open
        seeRoute(PARTS, { computer_component: RAM_PART, device_type: LAPTOP });
        out.open = { card: cardText(), add: hasAdd(), question: !!doc.querySelector('.ims-label[data-mod="thin_laptop"]'), chips: [...doc.querySelectorAll('.ims-chip')].filter(b => b.dataset.mod === 'thin_laptop').map(b => b.dataset.label) };
        // answered "No"
        out.tapNo = tapChip('thin_laptop', NO); await wait(50);
        out.no = { card: cardText(), add: hasAdd() };
        // answered "Yes"
        seeRoute(PARTS, { computer_component: RAM_PART, device_type: LAPTOP });
        out.tapYes = tapChip('thin_laptop', YES); await wait(50);
        out.yes = { card: cardText(), add: hasAdd(), entity: w.S._lastRoute && w.S._lastRoute.entity && w.S._lastRoute.entity.id };
        // from the diagnostic, with a slow-with-many-tabs answer given: the job waits there for the question
        const slow = w.DB.intake_modules.computer_symptom.client_response.find(o => /slow/i.test(o.label)).label;
        const ramLabel = w.DB.intake_modules.slow_pattern.client_response.find(o => /many tabs or programs/.test(o.label)).label;
        const atDiag = () => seeRoute(DIAG, { device_type: LAPTOP, computer_symptom: slow, slow_pattern: ramLabel });
        atDiag(); out.diagOpen = { card: cardText(), question: !!doc.querySelector('.ims-label[data-mod="thin_laptop"]'), add: hasAdd(), entity: w.S._lastRoute.entity.id };
        out.diagTapYes = tapChip('thin_laptop', YES); await wait(50);
        out.diagYes = { card: cardText(), entity: w.S._lastRoute.entity.id };
        atDiag(); out.diagTapNo = tapChip('thin_laptop', NO); await wait(50);
        out.diagNo = { card: cardText(), entity: w.S._lastRoute.entity.id, add: hasAdd() };
        // a desktop
        seeRoute(PARTS, { computer_component: RAM_PART, device_type: DESKTOP });
        out.desk = { card: cardText(), add: hasAdd(), question: !!doc.querySelector('.ims-label[data-mod="thin_laptop"]') };
    } catch (e) { out.error = String(e && e.stack || e).split('\n').slice(0, 3).join(' | '); } finally { dom.window.close(); }
    return out;
}
function pageClaims(P) {
    const C = {};
    C['4.1 with the question open the card draws it and its three answers, says to answer the questions, and shows no labor line and no "Add to Request"'] = !P.error && P.open.question && P.open.chips.length === 3 && /Please answer the questions above to see a quote/.test(P.open.card) && !/Estimated labor/.test(P.open.card) && !P.open.add;
    C['4.2 the card carries the ruled wording'] = !P.error && P.open.card.includes(WORDING);
    C['4.3 answered "No, it\'s thicker": the labor line and the button appear'] = !P.error && P.tapNo && /Estimated labor:\s*\$125/.test(P.no.card) && P.no.add;
    C['4.4 answered "Yes, it\'s very thin": the job is the diagnostic and the customer is told why (the sentence authored on the answer)'] = !P.error && P.tapYes && P.yes.entity === DIAG && P.yes.card.includes('memory or storage is often built onto the board') && !/Estimated labor:\s*\$125/.test(P.yes.card);
    C['4.6 from the diagnostic with a RAM answer given: the question is drawn and no price is shown; "Yes" keeps the job the diagnostic and shows no part price; "No" moves it to the part service and shows the price'] = !P.error && P.diagOpen.entity === DIAG && P.diagOpen.question && /Please answer the questions above to see a quote/.test(P.diagOpen.card) && !P.diagOpen.add && P.diagTapYes && P.diagYes.entity === DIAG && !/Estimated labor:\s*\$125/.test(P.diagYes.card) && P.diagTapNo && P.diagNo.entity === PARTS && /Estimated labor:\s*\$125/.test(P.diagNo.card) && P.diagNo.add;
    C['4.5 a desktop is priced at once: no question, the labor line and the button'] = !P.error && !P.desk.question && /Estimated labor:\s*\$/.test(P.desk.card) && P.desk.add;
    return C;
}
(async () => {
    console.log('\n=== 4. the page: the card holds the price while the question is open ===');
    const HTML = assemble(QR_TEXT, ROOT);
    const P0 = await pageRun(HTML);
    check('the page rendered the part service without an error', !P0.error, { expected: 'no error', got: P0.error });
    for (const [name, ok] of Object.entries(pageClaims(P0))) check(name, !!ok, { expected: 'true', got: JSON.stringify({ open: (P0.open || {}).card && P0.open.card.slice(0, 160), add: (P0.open || {}).add }) });
    const pageMutants = [
        ['page: the card ignores the guard (the price shows with the question open)', t => t.replace('const awaitingTriage = !!(q && ((q.divergenceEligible && route.triagePending && !divergencePath) || route.guardPending));', 'const awaitingTriage = !!(q && (q.divergenceEligible && route.triagePending && !divergencePath));'), '4.1 with the question open the card draws it and its three answers, says to answer the questions, and shows no labor line and no "Add to Request"'],
        ['page+engine: the guard is never true (the card cannot hold)', t => t.replace(/function orch_guard_pending\(intakeChain, answers, db\) \{/, 'function orch_guard_pending(intakeChain, answers, db) { return false;'), '4.1 with the question open the card draws it and its three answers, says to answer the questions, and shows no labor line and no "Add to Request"'],
        ['page+engine: the cancellation removed ("Yes" at the diagnostic prices the part)', t => t.replace('return !!(o && o.route_to && route.entity && o.route_to.service === route.entity.id);', 'return false;'), '4.6 from the diagnostic with a RAM answer given: the question is drawn and no price is shown; "Yes" keeps the job the diagnostic and shows no part price; "No" moves it to the part service and shows the price'],
    ];
    for (const [name, replacer, claim] of pageMutants) {
        const t = replacer(QR_TEXT);
        if (t === QR_TEXT) { check('mutant applies: ' + name, false, { expected: 'a change', got: 'the page text did not change' }); continue; }
        const P = await pageRun(assemble(t, ROOT));
        const C = pageClaims(P);
        check('mutant is caught: ' + name, C[claim] === false, { expected: 'the claim "' + claim.slice(0, 50) + '..." fails', got: P.error || 'it still held' });
    }
    finish('thin laptop question, #184');
})().catch(e => { console.log('TEST ERROR ' + (e && e.stack || e)); process.exit(1); });
