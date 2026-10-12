#!/usr/bin/env node
/**
 * verify_non_retiring_answers.js -- the Charter's delta check: a fallback answer must move the job, or carry a modifier, or the question goes.
 *
 * @enforces R-INTAKE-NONRETIRING
 * @enforces R-INTAKE-WIREREMOVE
 * @detects DEFECT-NON-RETIRING-ANSWER
 *
 * THE CLASS (R-INTAKE-NONRETIRING): an intake question offers a fallback -- "not sure", "the tech will measure on site", "I'll describe it in the notes" -- and that fallback resolves to the
 * SAME outcome as a confident answer and carries no modifier. The customer's admission that they do not know is real, but the question has not retired any uncertainty: the visit
 * measures it anyway. The Charter's mechanical test: "enumerate every module in intake_modules, resolve each option's downstream effect against the tuple the option produces, and fail when
 * a fallback option produces the same tuple as a confident option and carries no modifier." This file is that test, BEHAVIORAL: it drives the real executeWorkflow for every option of every
 * module in every service that asks it, and compares what the engine produced.
 *
 * T164 (item G) retired the two modules the Charter names (door_size, space_ready). This file holds the class, not those two names. It asserts:
 *
 *   1. THE DELTA CHECK     For every module and every fallback option without a modifier: the outcome tuple of that option is compared with that of every other option, in every service
 *                          that asks the module, the 76 named services AND the 82 dynamic ones (a module is flagged only when the fallback equals the other option EVERYWHERE the module is asked:
 *                          a module that moves the job in one place is wired; plumbing_fixture's "Other" opens no follow-up in the plumbing builder where "Toilet" does, so it is not flagged). The tuple is what the engine returns: labor, extra and per-visit fees, total minutes, complexity tier, checkout state, materials estimate, the
 *                          branch (the visible chain after the answer), the active tags, the fee breakdown and the forced modules.
 *   2. THE FILED LIST      The modules the check flags today are FILED (24 besides the two retired: 24 until T166, 23 after it, 24 again with `brand` in T169, 23 after T170 Part C took `computer_component` out: its "something else" answer now hands the job to the diagnostic; see below), each citing the ledger entry that names them. A new flagged module is red;
 *                          a filed module that no longer flags is red too (delete its entry: the list only shrinks).
 *   3. THE TWO ARE GONE    door_size and space_ready are absent from the catalog (modules, chains, then-branches, compiled), from the page's component set and from the compiler's module lists. T170 adds `fixture_type` (retired by the operator's ruling of 2026-10-11 04:57 NY: a question that moves no price, time or scope; PENDING_DECISIONS #179).
 *   4. NO QUESTION, NO BAR A service whose intake chain is empty has no question to raise its confidence, so its bar must be one the keyword evidence can reach (minimum_quote_confidence <=
 *                          base_confidence, no follow-up questions) and the free-text route must meet it. (The four appliance services were the first empty chains, T164.)
 *   5. NON-VACUITY         The fallback vocabulary recognises the Charter's own exemplars (the three honest "wired" fallbacks and the two dead ones); synthetic modules are shown flagged when inert and
 *                          not flagged when the fallback carries a modifier, an override, a tag or a branch; an empty-chain service with a bar above its base is shown flagged.
 *   6. (T169) THE QUESTION AND LABEL PASS  Section 6, PENDING_DECISIONS #167: four legs on what the customer READS (a duplicate question in one service, a brand/make/model question with no way
 *                          out, a dollar figure in a question or answer, a module with no `purpose`), each pure, each shown red on the catalog as it stood and able to fail on a planted one.
 *
 * WHAT THIS DOES NOT COVER (named, so it is not read as more): (a) the Charter's tuple has axes the SSOT cannot express -- risk tier, batch risk and PREP (what a technician needs before arriving).
 * No field of the catalog or the engine carries them, so a fallback that only changes prep is not distinguishable here; it would be flagged, and that is the finding behind the missing channel.
 * (b) A fallback is recognised by its label (vocabulary below); an equivalent worded differently is not seen. (c) Modules no service reaches. (d) A dynamic service is priced through computeUnifiedQuote
 * (there is no executeWorkflow for an entity that is not a named service), so its tuple is the quote's fields plus the branch the answer opens; the active-tags and forced-modules axes are read for named services only.
 * HISTORY: the first run of this check, over the named services only, found 20 modules (20 fallback options; the plan's count was "25 pairs in 20 modules", this one's is 50 (service, module) pairs; the module count agrees); widening to the dynamic services
 * removed two (plumbing_fixture, mounting_item) and found eight more.
 *
 * RUN ON ANOTHER TREE (G-INVARIANT-PREFIX; run against the tree as it was BEFORE the fix, this file fails):
 *     BTNYC_QR_FILE=<tree>/qr.html BTNYC_PAGE_ROOT=<tree> node test_harness/verify_non_retiring_answers.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Q = require('./_qr_blocks.js');
const Page = require('./_page.js');

const ROOT = process.env.BTNYC_PAGE_ROOT ? path.resolve(process.env.BTNYC_PAGE_ROOT) : Page.REPO_ROOT;
const QR = Page.QR_PATH;
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const SSOT = JSON.parse(read('btnyc.json'));
const clone = o => JSON.parse(JSON.stringify(o));

let pass = 0, fail = 0;
const check = (label, ok, detail) => {
    if (ok) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); if (detail) console.log(`      ${detail}`); }
};
const section = (title, fn) => {
    console.log(`\n=== ${title} ===`);
    try { fn(); } catch (e) { check(`${title}: ran to completion`, false, String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')); }
};

// ---- the two retired, and the modules filed while the rest of the class is open ---------------------------------------------------------------------------------------------
const RETIRED = ['door_size', 'space_ready', 'fixture_type'];   // fixture_type: T170 (PENDING_DECISIONS #173/#179), four answers that all priced the same ('Ceiling light (flush or semi-flush)' and 'Flush mount (tight to ceiling)' were one thing); retired, not renamed
// The modules this check flags today besides the two retired ones: a fallback option with no modifier whose outcome equals a confident option's in every service that asks the module.
// Filed with the ledger entry that names them (R-INVARIANT-DUPLICATION-TICKET's shape: a known instance is ticketed). The list can only shrink.
const FILED_LEDGER = '#158';
const FILED = [
    // asked in a named service (16):
    'angle_stop_condition', 'appliance_type', 'cable_install_item', 'computer_symptom', 'disposal_size', 'dishwasher_symptom', 'door_style_pref', 'existing_toilet_type',
    'furn_item', 'inwall_power_for_tv', 'leak_loc', 'software_install_type', 'switch_wiring', 'washer_type', 'window_ac_support',
    // asked only in dynamic services (6; 8 until T166, 7 until T174): found when the check was widened from the 76 named services to the 82 dynamic ones (see the header and PENDING_DECISIONS #158).
    // T166 delisted `electrical_item`: its option "Under\u2011cabinet light" (non-breaking hyphen) had a follow-up branch keyed with an ASCII hyphen, so the branch never opened; the key was renamed
    // in the catalog (btnyc.json, no code), the fallback now moves the job, and the list shrinks by design.
    // T174 delisted `window_ac_issue` (#199): its "Other (describe in notes)" equalled "Not cooling properly" (neither carried an effect); "Not cooling properly" is now a diagnostic answer with the
    // Dryer's dead-machine effect, so the fallback no longer equals any other answer, and the list shrinks by design.
    'appliance_item', 'cable_symptom', 'generic_tech_symptom', 'install_target', 'network_symptom', 'smart_device_symptom',
    // T169 ADDED `brand` (asked in smart_speaker_setup): PENDING_DECISIONS #167 gave it the "Other / don't know" way out its open set lacked (leg 6b). `brand` moves nothing the engine reports, so the
    // new fallback equals every brand: the module is a retirement candidate (R-INTAKE-WIREREMOVE), filed here and in #167 by the operator's rule for this session (no removals; "extend the #158
    // list"). It leaves this list by an explicit ruling (wire it to something, or retire it), not by editing this file.
    'brand',
];

// The Charter's fallback exemplars: "not sure", "the tech will measure/check on site", "I'll describe it in the notes" (and the equivalent forms the catalog uses).
const FALLBACK_RE = /\b(not sure|don.?t know|unsure|no idea)\b|tech(nician)?\s+(can\s+)?(measure|check|determine|assess|verify|inspect)|describe\b.*\bnotes|i.?ll describe|measure on site|check on site/i;

// ---- loading the engine from the page as written, for a given catalog ----------------------------------------------------------------------------------------------------------
const stripIife = c => { const m = c.match(/^\s*\(function\s*\(\)\s*\{([\s\S]*)\}\s*\)\s*\(\s*\)\s*;?\s*$/); return m ? m[1] : c; };
const ENGINE_MODULES = ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js'];
let engineBlocks = null;
function loadEngine(DB) {
    if (!engineBlocks) {
        const html = Page.readPage(QR, ROOT);
        const blocks = Q.splitScriptBlocks(html);
        engineBlocks = ENGINE_MODULES.map(n => {
            const b = blocks.find(x => Q.headerRegex(n).test(x.src));
            if (!b) throw new Error(`module ${n} not found in the page`);
            return { name: n, code: stripIife(b.src) };
        });
    }
    const sb = { DB, SERVICE_DATA: DB, window: { DB }, console: { log() {}, warn() {}, error() {}, info() {}, debug() {} } };
    sb.global = sb;
    vm.createContext(sb);
    for (const m of engineBlocks) vm.runInContext(m.code, sb, { filename: m.name });
    if (typeof sb.initNlpSets === 'function') { sb.initNlpSets(); if (typeof sb.refreshNlpPreviewBindings === 'function') sb.refreshNlpPreviewBindings(); }
    return sb;
}

// ---- the delta check ------------------------------------------------------------------------------------------------------------------------------------------------------------
/** Every (service, module, answers-needed-to-reach-it) the catalog asks: a chain step, or a module a step's `then` opens (with the parent's answer that opens it). */
function contexts(DB) {
    const out = [];
    const add = (s, dyn) => {
        for (const st of s.intake_chain || []) {
            const P = st.module || st;
            out.push({ s, dyn, mod: P, via: {}, step: st });
            for (const [label, targets] of Object.entries(st.then || {})) for (const T of targets) out.push({ s, dyn, mod: T, via: { [P]: label }, step: null });
        }
    };
    for (const s of DB.services || []) add(s, false);
    // The dynamic services ask the same modules (the guided builder and the other-tile reach them), and a module can mean something there that it does not in a named service:
    // plumbing_fixture's "Other" opens no follow-up where "Toilet" and "Sink or faucet" do. A fallback is judged on every place it is asked.
    for (const [key, d] of Object.entries(DB.dynamic_services || {})) add(Object.assign({}, d, { id: 'dyn:' + key }), true);
    return out;
}
const optionsOf = (DB, ctx) => {
    const m = DB.intake_modules[ctx.mod];
    const cr = (ctx.step && ctx.step.params && ctx.step.params.client_response) || (m && m.client_response);
    return Array.isArray(cr) ? cr : [];
};
function tupleOfDyn(sb, d, answers, step, label) {
    const r = sb.computeUnifiedQuote({ svc: null, dynDef: d, activeTagIds: [], answers: Object.assign({}, answers), qty: 1 });
    return JSON.stringify({
        labor: r.laborEstimate, extra: r.extraFee, visit: r.perVisitFee, minutes: r.totalMin, tier: r.complexityTier, state: r.checkoutStateKey,
        fees: (r.feeBreakdown || []).map(f => [f.label || f.name, f.amount != null ? f.amount : f.fee]),
        branch: ((step && step.then && step.then[label]) || []).slice(),
    });
}
function tupleOf(sb, DB, s, answers) {
    const c = sb.collectBookingContext_catalog(s, s.ui_taxonomy.category_id);
    c.answers = Object.assign({}, answers);
    c.extractedQty = 1;
    const r = sb.executeWorkflow(c, DB), q = r.quote || {};
    const m = r.materialsEstimate;
    return JSON.stringify({
        labor: q.laborEstimate, extra: q.extraFee, visit: q.perVisitFee, minutes: q.totalMin, tier: q.complexityTier, state: q.checkoutStateKey,
        materials: m ? [m.min, m.max] : null, branch: (r.visibleChain || []).map(x => x.moduleKey || x), tags: (r.activeTags || []).slice().sort(),
        fees: (q.feeBreakdown || []).map(f => [f.label || f.name, f.amount != null ? f.amount : f.fee]), forced: q.forceModules || null, divergence: q.divergenceFee,
    });
}
/**
 * deltaCheck(DB, only) -> { flagged: [{ module, fallback, equalTo:[labels], services:[ids] }], reached, calls }
 * `only` (optional) restricts the check to the named modules (the non-vacuity probes use it).
 */
function deltaCheck(DB, only) {
    const sb = loadEngine(DB);
    const byMod = {};
    let calls = 0;
    for (const cx of contexts(DB)) {
        if (only && !only.includes(cx.mod)) continue;
        const opts = optionsOf(DB, cx);
        if (!opts.length) continue;
        const tups = opts.map(o => { calls++; const ans = Object.assign({}, cx.via, { [cx.mod]: o.label }); return cx.dyn ? tupleOfDyn(sb, cx.s, ans, cx.step, o.label) : tupleOf(sb, DB, cx.s, ans); });
        (byMod[cx.mod] = byMod[cx.mod] || []).push({ svc: cx.s.id, opts, tups });
    }
    const flagged = [];
    for (const [mod, list] of Object.entries(byMod)) {
        const labels = list[0].opts.map(o => o.label);
        labels.forEach((fb, i) => {
            if (!FALLBACK_RE.test(fb) || list[0].opts[i].modifier_ref) return;
            const same = labels.map((l, j) => j).filter(j => j !== i && !FALLBACK_RE.test(labels[j]) && list.every(c => c.opts[i] && c.opts[j] && c.tups[i] === c.tups[j] && tagKey(c.opts[i]) === tagKey(c.opts[j])));
            if (same.length) flagged.push({ module: mod, fallback: fb, equalTo: same.map(j => labels[j]), services: list.map(c => c.svc) });
        });
    }
    // modules whose EVERY answer (not only a fallback) produces the same outcome and the same tags everywhere the module is asked: nothing the engine can observe depends on the answer
    const inert = Object.entries(byMod).filter(([, list]) => list.every(c => c.tups.every(t => t === c.tups[0]) && c.opts.every(o => tagKey(o) === tagKey(c.opts[0])))).map(([m]) => m).sort();
    return { flagged, reached: Object.keys(byMod).length, calls, inert };
}
// An option's own `tags` are read in exactly one place (computeUnifiedQuote's contradicted-tag clean-up, qr.html ~L2530): choosing an answer drops an ACTIVE
// tag that some other answer of the same module owns and this answer does not. With no tag active (the state every engine run above starts from) that is
// inert, so two options are equal on this axis only when they own the same tags -- the tuple alone cannot see it, so the comparison carries it.
const tagKey = o => JSON.stringify(((o && o.tags) || []).slice().sort());
const flaggedModules = res => [...new Set(res.flagged.map(f => f.module))].sort();

// `--list` prints every flagged fallback with the options it equals and the services that ask it (the table the ledger entry quotes).
if (process.argv.includes('--list')) {
    const res = deltaCheck(SSOT), sb0 = SSOT.intake_modules;
    const live = o => !!(o.modifier_ref || o.formula_override || o.checkout_state_override || o.mat_min != null || o.mat_max != null || o.qty_value != null || (o.complexity_override && o.complexity_override !== 'routine') || (o.tags || []).length);
    console.log(`# ${res.inert.length} of ${res.reached} modules reached are inert on every observable axis (no answer changes anything the engine reports): ${res.inert.join(', ')}`);
    for (const f of res.flagged) {
        const opts = sb0[f.module].client_response, others = opts.filter(o => o.label !== f.fallback);
        console.log([f.module, `"${f.fallback}"`, `= ${f.equalTo.map(l => `"${l}"`).join(' = ')}`, `[${others.filter(live).length} of ${others.length} other answers carry an effect]`, `asked in ${f.services.join(', ')}`].join(' | '));
    }
    process.exit(0);
}

// ---- 1-2. the real catalog ------------------------------------------------------------------------------------------------------------------------------------------------------
let REAL = null;
section('1-2. the delta check on the real catalog, and the filed list', () => {
    REAL = deltaCheck(SSOT);
    const mods = flaggedModules(REAL);
    console.log(`  (${REAL.calls} engine runs over ${REAL.reached} modules; ${REAL.flagged.length} flagged fallback option(s) in ${mods.length} module(s): ${mods.join(', ') || 'none'})`);
    const unfiled = mods.filter(m => !FILED.includes(m)), stale = FILED.filter(m => !mods.includes(m));
    check('no module is flagged that is not filed (a fallback that resolves to the same outcome as a confident answer, with no modifier)', unfiled.length === 0,
        unfiled.map(m => `${m}: ${REAL.flagged.filter(f => f.module === m).map(f => `"${f.fallback}" = ${f.equalTo.map(l => `"${l}"`).join(' = ')}`).join('; ')} (asked in ${REAL.flagged.find(f => f.module === m).services.join(', ')})`).join(' | '));
    check('every filed module still flags (a module that no longer flags is deleted from the list: the list only shrinks)', stale.length === 0, stale.join(', ') + ': delete from FILED');
    const ledger = read('PENDING_DECISIONS.md');
    check(`the filed list cites a ledger entry that exists (${FILED_LEDGER})`, new RegExp('^### ' + FILED_LEDGER.replace('#', '#') + ' ', 'm').test(ledger));
    check('the filed list has no duplicates and no retired module in it', new Set(FILED).size === FILED.length && !FILED.some(m => RETIRED.includes(m)));
});

// ---- 3. the two are gone --------------------------------------------------------------------------------------------------------------------------------------------------------
section('3. door_size, space_ready and fixture_type are retired everywhere the SSOT, the page and the compiler name modules', () => {
    for (const mod of RETIRED) {
        const where = [];
        if (SSOT.intake_modules && SSOT.intake_modules[mod]) where.push('intake_modules');
        for (const s of SSOT.services || []) for (const st of s.intake_chain || []) {
            if ((st.module || st) === mod) where.push(`${s.id}.intake_chain`);
            for (const t of Object.values(st.then || {})) if (t.includes(mod)) where.push(`${s.id}.intake_chain[].then`);
        }
        const c = SSOT.compiled || {};
        if (c.module_index && c.module_index[mod]) where.push('compiled.module_index');
        for (const [id, e] of Object.entries(c.service_index || {})) if (JSON.stringify(e.intake_chain || []).includes(`"${mod}"`) || (e.modules_needed_for_exact || []).includes(mod)) where.push(`compiled.service_index.${id}`);
        check(`${mod}: not a module, not in any service's chain or then-branch, not in the compiled indexes`, where.length === 0, [...new Set(where)].join(', '));
        const rawSsot = read('btnyc.json'), hits = (rawSsot.match(new RegExp(mod, 'g')) || []).length;
        check(`${mod}: the name appears nowhere in btnyc.json (modules, chains, notes and the compiled copies alike: R-INVARIANT-DELETION counts a remaining mention)`, hits === 0, `${hits} mention(s)`);
        const qr = fs.readFileSync(QR, 'utf8').replace(/\/\/[^\n]*/g, '');   // comments are not references
        check(`${mod}: not in the page's code`, !new RegExp(`['"]${mod}['"]`).test(qr));
        const compiler = fs.existsSync(path.join(ROOT, 'test_harness/btnyc_v10_compiler.py')) ? read('test_harness/btnyc_v10_compiler.py') : '';
        check(`${mod}: not in the compiler's module lists`, compiler === '' || !new RegExp(`"${mod}"`).test(compiler));
    }
});

// ---- 4. no question, no bar ------------------------------------------------------------------------------------------------------------------------------------------------------
function emptyChainFindings(DB) {
    const sb = loadEngine(DB), bad = [], empties = [];
    for (const s of DB.services || []) {
        if ((s.intake_chain || []).length) continue;
        empties.push(s.id);
        const cs = s.confidence_strategy || {};
        if (!(cs.minimum_quote_confidence <= cs.base_confidence)) bad.push(`${s.id}: no questions, and the bar (${cs.minimum_quote_confidence}) is above the base confidence (${cs.base_confidence}), so nothing can raise the score to it`);
        if (cs.maximum_followup_questions) bad.push(`${s.id}: no questions, and maximum_followup_questions is ${cs.maximum_followup_questions}`);
        try {
            const nm = (s.ui_taxonomy.display_name || s.id).toLowerCase();
            const r = sb.executeWorkflow(sb.collectBookingContext_freeText(nm), DB);
            if (!(r.entity && r.entity.id === s.id)) bad.push(`${s.id}: the free-text route for "${nm}" does not land on this service (it lands on ${r.entity ? r.entity.id : 'nothing'}), so the bar is not exercised`);
            else if (!(r.quote && r.quote.meetsConfidenceBar)) bad.push(`${s.id}: the free-text route for "${nm}" does not meet the bar (score ${r.confidence && r.confidence.score} against ${r.confidence && r.confidence.minConf})`);
        } catch (e) { bad.push(`${s.id}: the free-text route threw: ${e.message}`); }
    }
    return { empties, bad };
}
section('4. a service with no questions has a bar its evidence can reach', () => {
    const r = emptyChainFindings(SSOT);
    console.log(`  (services with an empty intake chain: ${r.empties.join(', ') || 'none'})`);
    check('every empty-chain service: bar <= base confidence, no follow-up questions, and the free-text route meets the bar', r.bad.length === 0, r.bad.join(' | '));
});

// ---- 5. non-vacuity ---------------------------------------------------------------------------------------------------------------------------------------------------------------
section('5. non-vacuity: the vocabulary, the check and the empty-chain leg are shown able to fail', () => {
    // the Charter's own exemplars: three honest fallbacks (Form a, each wired by a modifier) and the two dead ones (Form b)
    const exemplars = [['existing_type', true], ['lath_check', true], ['faucet_part_available', true]];
    for (const [mod, wired] of exemplars) {
        const m = SSOT.intake_modules[mod], fb = m && m.client_response.find(o => FALLBACK_RE.test(o.label));
        check(`vocabulary: ${mod} has a fallback option the check recognises, and it carries a modifier (the Charter's Form (a))`, !!fb && !!fb.modifier_ref === wired, fb ? `"${fb.label}" modifier_ref=${fb.modifier_ref}` : 'no fallback recognised');
    }
    check('vocabulary: the Charter\'s two dead exemplars read as fallbacks ("I don’t know – the tech can measure on site"; "Not sure – I’ll describe in notes")',
        FALLBACK_RE.test('I don’t know – the tech can measure on site') && FALLBACK_RE.test('Not sure – I’ll describe in notes'));
    check('vocabulary: a confident answer is not a fallback ("Yes, everything is ready"; "Standard 30″ x 80″")', !FALLBACK_RE.test('Yes, everything is ready') && !FALLBACK_RE.test('Standard 30″ x 80″'));

    // synthetic modules, asked in one real service
    const svcId = SSOT.services.find(s => (s.intake_chain || []).length && s.ui_taxonomy && s.id !== 'prehung_interior_door_install').id;
    const modifierId = Object.keys(SSOT.global_rules.modifiers).find(k => !k.startsWith('_') && (SSOT.global_rules.modifiers[k].fee || SSOT.global_rules.modifiers[k].minutes));
    const probe = (name, options, mutate) => {
        const DB = clone(SSOT);
        DB.intake_modules.__probe = { question: 'Probe?', type: 'single', client_response: options, purpose: 'pricing', confidence_gain: 0, affects_price: false };
        DB.services.find(s => s.id === svcId).intake_chain.push({ module: '__probe', then: {} });
        if (mutate) mutate(DB);
        return flaggedModules(deltaCheck(DB, ['__probe'])).includes('__probe');
    };
    const opts = () => [{ label: 'Option A', tags: [] }, { label: 'Option B', tags: [] }, { label: 'Not sure – the tech can measure on site', tags: [] }];
    check('a module whose fallback resolves like the confident answers (no modifier, no override, no tag, no branch) is flagged', probe('inert', opts()) === true);
    check('the same module is NOT flagged when the fallback carries a modifier', (() => { const o = opts(); o[2].modifier_ref = modifierId; return probe('modifier', o) === false; })(), `modifier ${modifierId}`);
    check('the same module is NOT flagged when the fallback raises the complexity tier', (() => { const o = opts(); o[2].complexity_override = 'specialized'; return probe('override', o) === false; })());
    // a tag the engine will actually carry in the probe service's category (tags are category-scoped; a tag scoped elsewhere is dropped and the probe would pass vacuously)
    const probeCat = SSOT.services.find(s => s.id === svcId).ui_taxonomy.category_id;
    const tagId = Object.keys(SSOT.smart_tags).find(k => !k.startsWith('_') && (SSOT.smart_tags[k].applicable_categories || []).includes(probeCat) && !(SSOT.smart_tags[k].requires || []).length);
    check('the same module is NOT flagged when the fallback carries a different tag', (() => { const o = opts(); o[2].tags = [tagId]; return probe('tag', o) === false; })(), `tag ${tagId} in ${probeCat}`);
    check('the same module is NOT flagged when the fallback opens a branch (a then-target the confident answers do not open)', (() => {
        const o = opts(), DB = clone(SSOT);
        DB.intake_modules.__probe = { question: 'Probe?', type: 'single', client_response: o, purpose: 'pricing', confidence_gain: 0, affects_price: false };
        DB.intake_modules.__followup = { question: 'Follow-up?', type: 'single', client_response: [{ label: 'X', tags: [] }, { label: 'Y', tags: [] }], purpose: 'pricing', confidence_gain: 0, affects_price: false };
        DB.services.find(s => s.id === svcId).intake_chain.push({ module: '__probe', then: { [o[2].label]: ['__followup'] } });
        return !flaggedModules(deltaCheck(DB, ['__probe'])).includes('__probe');
    })());
    check('a module with only confident answers is never flagged (no fallback, nothing to compare)', probe('noFallback', [{ label: 'Option A', tags: [] }, { label: 'Option B', tags: [] }]) === false);

    // the empty-chain leg: a bar above the base on a service with no questions
    const DBe = clone(SSOT), tgt = DBe.services.find(s => s.id === (SSOT.services.find(x => !(x.intake_chain || []).length) || SSOT.services[0]).id);
    const DBm = clone(SSOT), svc = DBm.services.find(s => s.id === 'microwave_setup') || DBm.services[0];
    svc.intake_chain = []; svc.confidence_strategy.minimum_quote_confidence = (svc.confidence_strategy.base_confidence || 40) + 40; svc.confidence_strategy.maximum_followup_questions = 2;
    check('the empty-chain leg flags a service with no questions and a bar above its base confidence', emptyChainFindings(DBm).bad.length >= 1, `${svc.id}`);
    const DBo = clone(SSOT), so = DBo.services.find(s => s.id === svc.id);
    so.intake_chain = []; so.confidence_strategy.minimum_quote_confidence = so.confidence_strategy.base_confidence; so.confidence_strategy.maximum_followup_questions = 0;
    check('...and does NOT flag the same service once the bar is its base confidence and it asks nothing', emptyChainFindings(DBo).bad.length === 0, emptyChainFindings(DBo).bad.join(' | '));
});

// ---- 6. the question and label pass (PENDING_DECISIONS #167, T169) --------------------------------------------------------------------------------------------------------------
// R-INTAKE-WIREREMOVE says a question the customer is asked must do something; the delta check above asks it of an ANSWER. These four legs ask it of what the customer READS: the
// same question twice in one service, a question about an open set with no way out, a price written into a label, and a module with no `purpose` (the field the chip UI reads
// to choose its badge). Each is a pure function of the catalog, so each is shown red on the starting catalog and able to fail on a planted one (below).
//
//   6a. DUPLICATE QUESTION   Two different modules asked in ONE service (a chain step, or a module a step's `then` opens; two branches of one parent are alternatives, never both asked)
//                            whose answers are drawn from the same named things: >= 2 shared answers after normalising (case, parentheses, punctuation), not counting the generic ones
//                            (yes / no / other / not sure / none) and not counting a count scale ("1", "2", "6 or more"), which one scale legitimately serves for different counts
//                            (pax_cabinet_count / pax_hinge_count / pax_sliding_count share one and are not duplicates). Internal Hardware Replacement asked `device_type` (Laptop /
//                            Desktop (tower) / All-in-one) and then `laptop_or_desktop` (Laptop / Desktop): the customer chooses between the same two things twice.
//   6b. NO WAY OUT           A question that asks for a brand, make, manufacturer or model asks about an open set, which no list is ever complete for: it must offer an option the vocabulary
//                            reads as an escape (other / not sure / don't know / something else / not listed). `brand` offered three speakers; a customer with another brand could not answer.
//                            (Scope, named: this is NOT every "what type of ..." question; 13 of those are closed taxonomies without an escape today and are listed in the ledger as a question, not a defect.)
//   6c. MONEY IN A LABEL     No option label and no question holds a dollar figure (/\$\s?\d/). The fee lives in the modifier; a label that repeats it is a second copy that does not follow it
//                            (R-SYSTEM-NODATA: one place for a number). The engine also builds the quote's fee line FROM the label ("<question>: <answer>"), so the figure was printed twice there.
//   6d. PURPOSE              Every module has a `purpose`, and it is one of the four the catalog uses (pricing, scheduling, routing, diagnostic). The only reader is the chip UI, which draws the
//                            "affects price" badge when it is `pricing`; a missing value draws nothing, and a typo ("pricng") silently drops a badge the module earns.
//                            (Whether a `pricing` badge is EARNED is #96's ratchet, verify_quantity_question_ratchet.js section G, not repeated here.)
const PURPOSES = ['pricing', 'scheduling', 'routing', 'diagnostic'];
const ESCAPE_RE = /\b(other|not sure|don.?t know|unsure|no idea|something else|not listed|none of (these|the above))\b/i;
const OPEN_SET_RE = /\b(brand|make|manufacturer|model)\b/i;
const MONEY_RE = /\$\s?\d/;
const GENERIC_ANSWERS = new Set(['yes', 'no', 'other', 'not sure', 'unsure', 'none', 'dont know', 'i dont know']);
const COUNT_ANSWER = /^\d+( \d+)?( or more| plus)?$/;
const normAnswer = l => String(l).toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[‘’'`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const nameSet = opts => new Set((opts || []).map(o => normAnswer(o.label)).filter(x => x && !GENERIC_ANSWERS.has(x) && !COUNT_ANSWER.test(x)));
/** Every option the customer can read, wherever it is authored: module answers and chain-embedded answers. */
function allOptionTexts(DB) {
    const out = [];
    Object.entries(DB.intake_modules || {}).forEach(([id, m]) => {
        if (m && typeof m.question === 'string') out.push({ at: `intake_modules[${id}].question`, text: m.question, kind: 'question' });
        ((m && m.client_response) || []).forEach((o, i) => out.push({ at: `intake_modules[${id}].client_response[${i}]`, text: String(o.label), kind: 'label' }));
    });
    const emb = (owner, ch) => (ch || []).forEach((c, i) => {
        const p = (c && c.params) || {};
        if (typeof p.question === 'string') out.push({ at: `${owner}.intake_chain[${i}].params.question`, text: p.question, kind: 'question' });
        (p.client_response || []).forEach((o, j) => out.push({ at: `${owner}.intake_chain[${i}].params.client_response[${j}]`, text: String(o.label), kind: 'label' }));
    });
    (DB.services || []).forEach(s => emb(`services[${s.id}]`, s.intake_chain));
    Object.entries(DB.dynamic_services || {}).forEach(([k, d]) => emb(`dynamic_services[${k}]`, d.intake_chain));
    return out;
}
function questionPassFindings(DB) {
    const duplicate = [], noEscape = [], money = [], purpose = [];
    // 6a: per service entity, every pair of different modules the customer can be asked together
    const byEntity = new Map();
    for (const cx of contexts(DB)) { if (!byEntity.has(cx.s.id)) byEntity.set(cx.s.id, []); byEntity.get(cx.s.id).push(cx); }
    const exclusive = (x, y) => Object.keys(x.via).some(p => p in y.via && x.via[p] !== y.via[p]);
    const seen = new Set();
    for (const [svc, list] of byEntity) {
        for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
            const a = list[i], b = list[j];
            if (a.mod === b.mod || exclusive(a, b)) continue;
            const A = nameSet(optionsOf(DB, a)), B = nameSet(optionsOf(DB, b));
            const shared = [...A].filter(x => B.has(x));
            if (shared.length < 2) continue;
            const key = svc + '|' + [a.mod, b.mod].sort().join('|');
            if (seen.has(key)) continue; seen.add(key);
            duplicate.push({ svc, a: a.mod, b: b.mod, shared });
        }
    }
    // 6b: a module that asks for a brand / make / manufacturer / model must offer a way out (judged on the module's own answers and on every chain-embedded override)
    for (const [id, m] of Object.entries(DB.intake_modules || {})) {
        if (!m || !OPEN_SET_RE.test(String(m.question || '')) || !Array.isArray(m.client_response) || !m.client_response.length) continue;
        if (!m.client_response.some(o => ESCAPE_RE.test(String(o.label)))) noEscape.push({ module: id, question: m.question, answers: m.client_response.map(o => o.label) });
    }
    // 6c: a dollar figure in anything the customer reads as a question or an answer
    for (const t of allOptionTexts(DB)) if (MONEY_RE.test(t.text)) money.push({ at: t.at, text: t.text });
    // 6d: purpose present and spelled as the catalog spells it
    for (const [id, m] of Object.entries(DB.intake_modules || {})) {
        if (!m || typeof m !== 'object') continue;   // (no key under intake_modules starts with an underscore today; a non-object entry is a note, not a module)
        if (!PURPOSES.includes(m.purpose)) purpose.push({ module: id, purpose: m.purpose === undefined ? '(missing)' : JSON.stringify(m.purpose) });
    }
    return { duplicate, noEscape, money, purpose };
}
section('6. the question and label pass (#167): no duplicate question, no open set without a way out, no price in a label, every module has a purpose', () => {
    const r = questionPassFindings(SSOT);
    console.log(`  (${Object.keys(SSOT.intake_modules).filter(k => !k.startsWith('_')).length} modules; ${allOptionTexts(SSOT).length} question and answer texts read)`);
    check('6a. no service asks two different modules whose answers are the same named things',
        r.duplicate.length === 0, r.duplicate.map(d => `${d.svc}: ${d.a} and ${d.b} share ${JSON.stringify(d.shared)}`).join(' | '));
    check('6b. every question that asks for a brand, make, manufacturer or model offers a way out (other / not sure / don\'t know)',
        r.noEscape.length === 0, r.noEscape.map(d => `${d.module} "${d.question}": ${d.answers.map(a => `"${a}"`).join(', ')}`).join(' | '));
    check('6c. no question or answer holds a dollar figure (the fee is in the modifier)', r.money.length === 0, r.money.map(d => `${d.at}: "${d.text}"`).join(' | '));
    check(`6d. every module has a purpose, one of ${PURPOSES.join(' / ')}`, r.purpose.length === 0, `${r.purpose.length}: ` + r.purpose.map(d => `${d.module} (${d.purpose})`).join(', '));
});
section('6 (non-vacuity). each leg of the question pass is shown able to fail, and shown not to over-reach', () => {
    const svcId = SSOT.services.find(s => (s.intake_chain || []).length && s.ui_taxonomy && s.id !== 'prehung_interior_door_install').id;
    const plant = (mods, chainMods) => {
        const DB = clone(SSOT);
        Object.entries(mods).forEach(([k, m]) => { DB.intake_modules[k] = Object.assign({ type: 'single', purpose: 'diagnostic', confidence_gain: 0, affects_price: false }, m); });
        const s = DB.services.find(x => x.id === svcId);
        (chainMods || []).forEach(k => s.intake_chain.push({ module: k, then: {} }));
        return DB;
    };
    const L = (...ls) => ls.map(label => ({ label }));
    const dupOf = DB => questionPassFindings(DB).duplicate.filter(d => /^__/.test(d.a) || /^__/.test(d.b));
    check('6a flags two modules in one chain that offer the same two named things (Laptop / Desktop twice)', dupOf(plant({ __a: { question: 'Which?', client_response: L('Laptop', 'Desktop (tower)', 'All-in-one') }, __b: { question: 'Is it a laptop or desktop?', client_response: L('Laptop', 'Desktop') } }, ['__a', '__b'])).length === 1);
    check('6a does not flag one count scale reused for different counts ("1".."6 or more")', dupOf(plant({ __a: { question: 'How many doors?', client_response: L('1', '2', '3', '6 or more') }, __b: { question: 'How many hinges?', client_response: L('1', '2', '3', '6 or more') } }, ['__a', '__b'])).length === 0);
    check('6a does not flag two modules that share only generic answers (Yes / No / Other / Not sure)', dupOf(plant({ __a: { question: 'Is it A?', client_response: L('Yes', 'No', 'Not sure') }, __b: { question: 'Is it B?', client_response: L('Yes', 'No', 'Not sure', 'Other') } }, ['__a', '__b'])).length === 0);
    check('6a does not flag two modules that share one named thing', dupOf(plant({ __a: { question: 'Which?', client_response: L('Laptop', 'Router') }, __b: { question: 'Which else?', client_response: L('Laptop', 'Printer') } }, ['__a', '__b'])).length === 0);
    check('6a does not flag the same module asked twice, or two branches of one parent (alternatives, never both asked)', (() => {
        const DB = plant({ __a: { question: 'Which?', client_response: L('Router', 'Printer') }, __p: { question: 'Parent?', client_response: L('Left', 'Right') }, __x: { question: 'X?', client_response: L('Laptop', 'Desktop') }, __y: { question: 'Y?', client_response: L('Laptop', 'Desktop') } }, ['__a', '__a']);
        DB.services.find(x => x.id === svcId).intake_chain.push({ module: '__p', then: { Left: ['__x'], Right: ['__y'] } });
        return dupOf(DB).length === 0;
    })());
    const escOf = DB => questionPassFindings(DB).noEscape.filter(d => /^__/.test(d.module));
    check('6b flags a brand question with no way out', escOf(plant({ __b: { question: 'Which brand is it?', client_response: L('Amazon Echo', 'Google Nest', 'Apple HomePod') } })).length === 1);
    check('6b flags a make, a manufacturer and a model question alike', ['Which make is it?', 'Who is the manufacturer?', 'What model is it?'].every(q => escOf(plant({ __b: { question: q, client_response: L('A', 'B') } })).length === 1));
    check('6b does not flag the same question once it offers "Other / don\'t know"', escOf(plant({ __b: { question: 'Which brand is it?', client_response: L('Amazon Echo', 'Google Nest', 'Other / don\'t know') } })).length === 0);
    check('6b does not flag a closed taxonomy ("What type of faucet is it?" is outside the rule, named in the header)', escOf(plant({ __b: { question: 'What type of faucet is it?', client_response: L('Kitchen', 'Bath', 'Utility') } })).length === 0);
    const monOf = DB => questionPassFindings(DB).money.filter(d => /__/.test(d.at));
    check('6c flags a price in an answer label ("(+$25)") and in a question', monOf(plant({ __m: { question: 'Remove it?', client_response: L('Yes (+$25)', 'No') } })).length === 1 && monOf(plant({ __m: { question: 'Is the job over $500?', client_response: L('Yes', 'No') } })).length === 1);
    check('6c does not flag a label with no dollar figure ("2-3 feet", "5 dollars-ish is words, not a figure")', monOf(plant({ __m: { question: 'How long?', client_response: L('2-3 feet', 'Under 5 dollars is words') } })).length === 0);
    const purOf = DB => questionPassFindings(DB).purpose.filter(d => /^__/.test(d.module));
    check('6d flags a module with no purpose, and one with a mistyped purpose', (() => {
        const a = plant({ __p: { question: 'Q?', client_response: L('A', 'B') } }); delete a.intake_modules.__p.purpose;
        return purOf(a).length === 1 && purOf(plant({ __p: { question: 'Q?', client_response: L('A', 'B'), purpose: 'pricng' } })).length === 1;
    })());
    check('6d does not flag each of the four purposes the catalog uses', PURPOSES.every(p => purOf(plant({ __p: { question: 'Q?', client_response: L('A', 'B'), purpose: p } })).length === 0));
    check('the question pass reads the real catalog: the vocabulary matches what is in use (every in-use purpose is in the list)', (() => {
        const used = new Set(Object.values(SSOT.intake_modules).map(m => m && m.purpose).filter(Boolean));
        return [...used].every(p => PURPOSES.includes(p));
    })(), `in use: ${[...new Set(Object.values(SSOT.intake_modules).map(m => m && m.purpose))].join(', ')}`);
});

console.log(`\n[non-retiring answers] ${pass} passed, ${fail} failed (of ${pass + fail} checks)`);
process.exit(fail ? 1 : 0);
