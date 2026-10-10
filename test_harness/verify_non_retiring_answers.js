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
 *   2. THE FILED LIST      The modules the check flags today are FILED (24 besides the two retired), each citing the ledger entry that names them. A new flagged module is red;
 *                          a filed module that no longer flags is red too (delete its entry: the list only shrinks).
 *   3. THE TWO ARE GONE    door_size and space_ready are absent from the catalog (modules, chains, then-branches, compiled), from the page's component set and from the compiler's module lists.
 *   4. NO QUESTION, NO BAR A service whose intake chain is empty has no question to raise its confidence, so its bar must be one the keyword evidence can reach (minimum_quote_confidence <=
 *                          base_confidence, no follow-up questions) and the free-text route must meet it. (The four appliance services were the first empty chains, T164.)
 *   5. NON-VACUITY         The fallback vocabulary recognises the Charter's own exemplars (the three honest "wired" fallbacks and the two dead ones); synthetic modules are shown flagged when inert and
 *                          not flagged when the fallback carries a modifier, an override, a tag or a branch; an empty-chain service with a bar above its base is shown flagged.
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
const RETIRED = ['door_size', 'space_ready'];
// The modules this check flags today besides the two retired ones: a fallback option with no modifier whose outcome equals a confident option's in every service that asks the module.
// Filed with the ledger entry that names them (R-INVARIANT-DUPLICATION-TICKET's shape: a known instance is ticketed). The list can only shrink.
const FILED_LEDGER = '#158';
const FILED = [
    // asked in a named service (16):
    'angle_stop_condition', 'appliance_type', 'cable_install_item', 'computer_component', 'computer_symptom', 'disposal_size', 'dishwasher_symptom', 'door_style_pref', 'existing_toilet_type',
    'furn_item', 'inwall_power_for_tv', 'leak_loc', 'software_install_type', 'switch_wiring', 'washer_type', 'window_ac_support',
    // asked only in dynamic services (8): found when the check was widened from the 76 named services to the 82 dynamic ones (see the header and PENDING_DECISIONS #158)
    'appliance_item', 'cable_symptom', 'electrical_item', 'generic_tech_symptom', 'install_target', 'network_symptom', 'smart_device_symptom', 'window_ac_issue',
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
section('3. door_size and space_ready are retired everywhere the SSOT, the page and the compiler name modules', () => {
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

console.log(`\n[non-retiring answers] ${pass} passed, ${fail} failed (of ${pass + fail} checks)`);
process.exit(fail ? 1 : 0);
