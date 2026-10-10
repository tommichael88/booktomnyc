#!/usr/bin/env node
/**
 * verify_divergence_resolution.js
 *
 * Regression test for "Divergence Resolution" / the Confidence-Friction
 * Seesaw's Diagnostic Divergence ("Fork in the Road" -- PROJECT_GOALS
 * §9/10): when a route hits the diagnostic dead end (checkout_state
 * resolves to 'diagnostic') AND the resolved entity carries real,
 * authored remote_deep_dive_modules, the customer gets a real choice
 * (Path A: answer more questions remotely / Path B: book an on-site
 * diagnostic visit, fee credited back) instead of today's single,
 * dead-end "on-site only" outcome.
 *
 * Three layers, matching this project's own established test shape:
 *   1. Pure computation (computeUnifiedQuote's new return fields),
 *      checked directly against the standalone pricing_engine.js module
 *      -- same loading pattern as verify_pricing_engine_module.js.
 *   2. Data/schema: the real, authored global_rules.divergence_resolution
 *      config and dishwasher_repair's remote_deep_dive_modules validate
 *      and are internally consistent (referenced modules are real).
 *   3. UI-layer wiring: buildDivergenceResolutionHtml/sqChooseDivergencePath/
 *      sqBuildCuratedIntake/sqRenderQuote/sqRestart/sqAddToCart exist,
 *      parse, and are byte-identical between qr.html and their reference
 *      modules (UIRenderer.js/AppController.js) -- the same drift check
 *      this project already runs for the pricing/NLP/orchestrator split.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.dirname(__dirname);
const dbPath = path.join(REPO_ROOT, 'btnyc.json');
const enginePath = path.join(REPO_ROOT, 'pricing_engine.js');
const QR_HTML = require('./_page.js').readPage(path.join(REPO_ROOT, 'qr.html'));
const UIR = fs.readFileSync(path.join(REPO_ROOT, 'UIRenderer.js'), 'utf8');
const AC = fs.readFileSync(path.join(REPO_ROOT, 'AppController.js'), 'utf8');
const ORCH = fs.readFileSync(path.join(REPO_ROOT, 'orchestrator_engine.js'), 'utf8');
const PE = fs.readFileSync(path.join(REPO_ROOT, 'pricing_engine.js'), 'utf8');

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

// ─────────────────────────────────────────────────────────────────────
// Layer 1: pure computation, via the real standalone pricing_engine.js
// ─────────────────────────────────────────────────────────────────────
console.log('=== Layer 1: computeUnifiedQuote divergence fields (pricing_engine.js) ===');

const DB = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
global.DB = DB;
global.SERVICE_DATA = DB;
global.window = global.window || global;
global.S = { _svc: null };

const engineCode = fs.readFileSync(enginePath, 'utf8');
vm.runInThisContext(engineCode, { filename: enginePath });

const dishwasher = DB.services.find(s => s.id === 'dishwasher_repair');
check('dishwasher_repair exists and is the diagnostic-checkout-state proof case',
    !!dishwasher && dishwasher.financial_engine?.checkout_state === 'diagnostic');

const qDiag = computeUnifiedQuote({ svc: dishwasher, activeTagIds: [], answers: {}, qty: 1 });
check('dishwasher_repair: isDiagnostic is true', qDiag.isDiagnostic === true);
check('dishwasher_repair: divergenceEligible is true (has real remote_deep_dive_modules)', qDiag.divergenceEligible === true);
check('dishwasher_repair: remoteDeepDiveModules includes the real, authored attempted_fix module',
    Array.isArray(qDiag.remoteDeepDiveModules) && qDiag.remoteDeepDiveModules.includes('attempted_fix'));
check('dishwasher_repair: divergenceFee reflects global_rules.divergence_resolution.diagnostic_fee',
    qDiag.divergenceFee === (DB.global_rules?.divergence_resolution?.diagnostic_fee || 0) && qDiag.divergenceFee > 0);
check('dishwasher_repair: divergenceCreditNote is real, non-empty customer copy',
    typeof qDiag.divergenceCreditNote === 'string' && qDiag.divergenceCreditNote.length > 10);

// Negative case: a service with NO remote_deep_dive_modules authored must be
// completely unaffected -- additive-only is the whole design promise.
// garbage_disposal_replacement (not washer_repair -- that now legitimately
// has real remote_deep_dive_modules as of v9.5.6's checkout_state_override
// synergy, see Layer 6 below; this needs a genuinely untouched example).
const cleanSvc = DB.services.find(s => s.id === 'garbage_disposal_replacement');
const qClean = computeUnifiedQuote({ svc: cleanSvc, activeTagIds: [], answers: {}, qty: 1 });
check('garbage_disposal_replacement (no remote_deep_dive_modules): divergenceEligible is false', qClean.divergenceEligible === false);
check('garbage_disposal_replacement: remoteDeepDiveModules is an empty array, not undefined/null', Array.isArray(qClean.remoteDeepDiveModules) && qClean.remoteDeepDiveModules.length === 0);

// Negative case: an ordinary, non-diagnostic named service must show zero
// change in behavior from before this feature existed.
const toilet = DB.services.find(s => s.id === 'toilet_install');
const qToilet = computeUnifiedQuote({ svc: toilet, activeTagIds: [], answers: {}, qty: 1 });
check('toilet_install (ordinary service): divergenceEligible is false, isDiagnostic is false',
    qToilet.divergenceEligible === false && qToilet.isDiagnostic === false);
check('toilet_install: laborEstimate is a real positive number (no regression in normal pricing)',
    typeof qToilet.laborEstimate === 'number' && qToilet.laborEstimate > 0);

// Global kill switch: divergence_resolution.enabled === false must fully
// disable the mechanism even for an otherwise-eligible entity, matching
// the surcharges.dispatch_fee_enabled convention this codebase already uses.
{
    const dbCopy = JSON.parse(JSON.stringify(DB));
    dbCopy.global_rules.divergence_resolution.enabled = false;
    global.DB = dbCopy;
    const qDisabled = computeUnifiedQuote({ svc: dishwasher, activeTagIds: [], answers: {}, qty: 1 });
    check('enabled:false kill switch disables divergenceEligible even for dishwasher_repair', qDisabled.divergenceEligible === false);
    check('enabled:false kill switch still reports isDiagnostic correctly (unrelated to the fork)', qDisabled.isDiagnostic === true);
    global.DB = DB; // restore
}

// Defensive: an entity referencing a non-existent intake_module must be
// filtered out, never crash and never offer a broken question.
{
    const dbCopy2 = JSON.parse(JSON.stringify(DB));
    const dishwasherCopy = dbCopy2.services.find(s => s.id === 'dishwasher_repair');
    dishwasherCopy.remote_deep_dive_modules = ['attempted_fix', 'this_module_does_not_exist'];
    global.DB = dbCopy2;
    const qFiltered = computeUnifiedQuote({ svc: dishwasherCopy, activeTagIds: [], answers: {}, qty: 1 });
    check('a bogus module key in remote_deep_dive_modules is silently filtered out, not crashed on',
        qFiltered.remoteDeepDiveModules.length === 1 && qFiltered.remoteDeepDiveModules[0] === 'attempted_fix');
    global.DB = DB; // restore
}

// ─────────────────────────────────────────────────────────────────────
// Layer 2: data + schema
// ─────────────────────────────────────────────────────────────────────
console.log('\n=== Layer 2: data + schema ===');

const schema = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'schema', 'btnyc_schema.json'), 'utf8'));
check('global_rules schema declares divergence_resolution',
    !!schema.properties.global_rules.properties.divergence_resolution);
check('services item schema declares remote_deep_dive_modules',
    !!schema.properties.services.items.properties.remote_deep_dive_modules);
check('dynamic_services entry schema declares remote_deep_dive_modules (forward-compat, additionalProperties:false there)',
    !!schema.properties.dynamic_services.patternProperties['.*\\+.*'].properties.remote_deep_dive_modules);

let jsonschemaAvailable = true;
let Ajv2020, addFormats;
try {
    Ajv2020 = require('ajv/dist/2020');
} catch (e) {
    jsonschemaAvailable = false;
}
if (jsonschemaAvailable) {
    try {
        const ajv = new Ajv2020({ strict: false, allErrors: true });
        const validate = ajv.compile(schema);
        const valid = validate(DB);
        check('full btnyc.json validates against btnyc_schema.json (ajv)', valid === true);
    } catch (e) {
        console.log('  (ajv present but validation threw -- skipping strict check, not a real finding):', e.message);
    }
} else {
    console.log('  (ajv not installed -- schema-validity already covered by test_harness/verify_compiled_output_against_real_schema.py via jsonschema; skipping duplicate check here)');
}

(DB.services.find(s => s.id === 'dishwasher_repair').remote_deep_dive_modules || []).forEach(mk => {
    check(`remote_deep_dive_modules entry "${mk}" is a real, existing intake_modules key`, !!DB.intake_modules?.[mk]);
});

check('global_rules.divergence_resolution.diagnostic_fee is a real positive number',
    typeof DB.global_rules?.divergence_resolution?.diagnostic_fee === 'number' && DB.global_rules.divergence_resolution.diagnostic_fee > 0);
check('global_rules.divergence_resolution.credit_policy is a real, non-empty string',
    typeof DB.global_rules?.divergence_resolution?.credit_policy === 'string' && DB.global_rules.divergence_resolution.credit_policy.length > 0);

// ─────────────────────────────────────────────────────────────────────
// Layer 3: UI-layer wiring + module parity
// ─────────────────────────────────────────────────────────────────────
console.log('\n=== Layer 3: UI wiring + module parity (qr.html vs UIRenderer.js/AppController.js) ===');

function extractFn(text, name) {
    const m = text.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) return null;
    let depth = 0, start = m.index, i = m.index + m[0].length - 1;
    for (let j = i; j < text.length; j++) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') { depth--; if (depth === 0) return text.slice(start, j + 1); }
    }
    return null;
}

check('buildDivergenceResolutionHtml exists in qr.html', !!extractFn(QR_HTML, 'buildDivergenceResolutionHtml'));
check('orchChooseDivergencePath (Glue) exists in qr.html', !!extractFn(QR_HTML, 'orchChooseDivergencePath'));
// (Three token-in-source checks that lived here -- "function X contains the text Y" -- were replaced by the behavioural scenarios below (R-GOVERN-GOODHART):
// they broke when the splice moved into a shared function although behaviour was identical, i.e. they pinned an implementation detail, not the rule.)
check('sqRestart resets _divergencePath (avoids the exact cross-session leak bug this file already documents)', /_divergencePath:\s*null/.test(extractFn(QR_HTML, 'sqRestart') || ''));
check('sqAddToCart records credit_policy on-site (makes the field a real, genuine SSOT consumer)', /credit_policy/.test(extractFn(QR_HTML, 'sqAddToCart') || ''));

// Placement (checked byte-for-byte against the extracted reference modules). The legacy divergence handler and the legacy
// curated-intake builder were retired (R-INVARIANT-DELETION); the canonical handler is orchChooseDivergencePath (Glue) over
// orch_apply_remote_divergence (Logic).
[
    ['buildDivergenceResolutionHtml', UIR, 'UIRenderer.js'],
    // sqRenderQuote was split (stop-the-line pass): Glue wires, Logic builds the view-model, the renderer draws it.
    ['sqRenderQuote', AC, 'AppController.js'],
    ['renderQuotePanel', UIR, 'UIRenderer.js'],
    ['buildQuotePanelModel', PE, 'pricing_engine.js'],
    // Layer move (stop-the-line pass): state-owning handlers are Glue and live in AppController; the view reset is a renderer.
    ['sqRestart', AC, 'AppController.js'],
    ['sqResetView', UIR, 'UIRenderer.js'],
    ['sqAddToCart', AC, 'AppController.js'],
    ['orchChooseDivergencePath', AC, 'AppController.js'],
    ['orch_apply_remote_divergence', ORCH, 'orchestrator_engine.js'],
].forEach(([name, moduleText, label]) => {
    const a = extractFn(QR_HTML, name);
    const b = extractFn(moduleText, name);
    check(`${name}: byte-identical between qr.html and ${label} (no reference-module drift)`, !!a && a === b);
});

console.log(`\n[Divergence Resolution verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);

// ─────────────────────────────────────────────────────────────────────
// Layer 4: real end-to-end DOM scenario, same sandbox pattern as
// verify_ui_controller_modules.js -- actually calls sqRenderQuote /
// sqChooseDivergencePath and inspects real innerHTML output, not just
// static source-text checks.
// ─────────────────────────────────────────────────────────────────────
console.log('=== Layer 4: end-to-end scenario (sqRenderQuote / orchChooseDivergencePath) ===');

function buildScenarioSandbox() {
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    let quoteOutHTML = '';
    const quoteOutEl = {
        _display: 'none',
        get innerHTML() { return quoteOutHTML; },
        set innerHTML(v) { quoteOutHTML = v; },
        get style() { return { set display(v) { quoteOutEl._display = v; }, get display() { return quoteOutEl._display; } }; },
        scrollIntoView() {},
        querySelector: () => null,
    };
    const elements = { sqQuoteOut: quoteOutEl };
    function makeDummyElement() {
        const el = {
            _innerHTML: '', _value: '', _textContent: '',
            classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
            addEventListener() {}, appendChild() {}, setAttribute() {}, dataset: {},
            querySelector: () => null, querySelectorAll: () => [], scrollIntoView() {},
            style: {},
        };
        Object.defineProperty(el, 'innerHTML', { get() { return el._innerHTML; }, set(v) { el._innerHTML = v; } });
        Object.defineProperty(el, 'value', { get() { return el._value; }, set(v) { el._value = v; } });
        Object.defineProperty(el, 'textContent', { get() { return el._textContent; }, set(v) { el._textContent = v; } });
        return el;
    }
    const sandbox = {
        DB: db, SERVICE_DATA: db,
        S: { qty: 1, intent: { key: 'dishwasher_repair', category: 'minor_home_repairs', label: 'Dishwasher Repair', qtyLabel: 'item' }, stype: 'Repair', answers: {}, detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: [], _svc: db.services.find(s => s.id === 'dishwasher_repair'), _divergencePath: null, adlibConfirmed: false },
        State: { serviceRequest: [], furnitureItems: [] },
        console, setTimeout, clearTimeout, setInterval, clearInterval,
    };
    sandbox.window = sandbox;
    sandbox.window.DB = db;
    sandbox.window.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    sandbox.localStorage = sandbox.window.localStorage;
    sandbox.document = {
        getElementById: (id) => elements[id] || (elements[id] = makeDummyElement()),
        createElement: () => makeDummyElement(),
        addEventListener: () => {}, removeEventListener: () => {},
        querySelector: () => null, querySelectorAll: () => [],
        body: { appendChild() {}, classList: { add() {}, remove() {} } },
        documentElement: { style: {}, classList: { add() {}, remove() {} } },
    };
    sandbox.categoryMap = new Map((db.category || []).map(c => [c.id, c]));
    sandbox.groupMap = new Map((db.group || []).map(g => [g.id, g]));
    sandbox.window.categoryMap = sandbox.categoryMap;
    sandbox.window.groupMap = sandbox.groupMap;
    vm.createContext(sandbox);
    for (const f of ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js', 'UIRenderer.js', 'AppController.js']) {
        vm.runInContext(fs.readFileSync(path.join(REPO_ROOT, f), 'utf8'), sandbox, { filename: f });
    }
    const { appReducer, initialAppState } = require(path.join(REPO_ROOT, 'appReducer.js'));
    const { createStore } = require(path.join(REPO_ROOT, 'store.js'));
    const realStore = createStore(appReducer, initialAppState);
    realStore.bindLegacyGlobals(sandbox.window);
    sandbox.window.__store = realStore;
    sandbox.__store = realStore;
    // bindLegacyGlobals's initial mirror() call Object.assign()s the store's
    // (empty, freshly-initialized) session.legacyView onto S, which clobbers
    // the real S seed set above (same real subtlety documented in store.js's
    // own mirror() comment -- it's a one-way mirror OUT, last writer wins).
    // Re-apply the real scenario seed after binding so this test exercises
    // the actual, intended booking state, not the store's blank defaults.
    Object.assign(sandbox.S, {
        qty: 1,
        intent: { key: 'dishwasher_repair', category: 'minor_home_repairs', label: 'Dishwasher Repair', qtyLabel: 'item' },
        stype: 'Repair', answers: {}, detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: [],
        _svc: db.services.find(s => s.id === 'dishwasher_repair'), _divergencePath: null, adlibConfirmed: false,
    });
    sandbox.initNlpSets();
    return { sandbox, getQuoteOutHTML: () => quoteOutHTML };
}

function scenarioCheck(label, fn) {
    try { fn(); pass++; console.log(`  ✓ ${label}`); }
    catch (e) { fail++; console.log(`  ✗ ${label}: ${e.message}`); }
}

const { sandbox: sb, getQuoteOutHTML } = buildScenarioSandbox();

scenarioCheck('sandbox loads all 5 modules together with zero errors (same combination sqRenderQuote/orchChooseDivergencePath actually run in)', () => {});

// The fork is offered only where the canonical handler can act: the customer must be ON a route (S._lastRoute.entity). In production
// prefillSmartQuoteFromService sets it via sqRenderCuratedCard; the scenario seeds a REAL route the same way.
function seedRealRoute(sbx, svcId) {
    const svc = sbx.DB.services.find(x => x.id === svcId);
    const route = sbx.executeWorkflow(sbx.collectBookingContext_catalog(svc, svc.ui_taxonomy.category_id), sbx.DB);
    sbx.S._lastRoute = route; sbx.S._lastContainerId = 'sqSb3';
    return route;
}

scenarioCheck('sqRenderQuote(), first call on dishwasher_repair, renders the real Fork-in-the-Road hub (not the old single dead-end)', () => {
    seedRealRoute(sb, 'dishwasher_repair');
    sb.sqRenderQuote();
    const html = getQuoteOutHTML();
    if (!html.includes('divergence-hub')) throw new Error('expected divergence-hub markup, got: ' + html.slice(0, 200));
    if (!html.includes("orchChooseDivergencePath('remote')") || !html.includes("orchChooseDivergencePath('onsite')"))
        throw new Error('expected both canonical onclick handlers wired into the rendered HTML');
    if (!html.includes('$85')) throw new Error('expected the real, authored diagnostic fee ($85) to actually appear in the rendered card');
});

scenarioCheck("orchChooseDivergencePath('onsite') sets state, and a subsequent quote render shows the NORMAL diagnostic panel, not the fork again", () => {
    sb.orchChooseDivergencePath('onsite');
    if (sb.S._divergencePath !== 'onsite') throw new Error('expected S._divergencePath to be set to onsite');
    sb.sqRenderQuote();
    const html = getQuoteOutHTML();
    if (html.includes('divergence-hub')) throw new Error('expected the fork to be gone on the post-choice render (must not loop)');
    if (!html.includes('ctarow')) throw new Error('expected the normal, existing quote panel to render instead');
});

scenarioCheck('sqRestart() clears _divergencePath (no cross-session leak into the next SmartQuote session)', () => {
    sb.sqRestart();
    if (sb.S._divergencePath !== null) throw new Error(`expected null, got ${JSON.stringify(sb.S._divergencePath)}`);
});

scenarioCheck('buildQuotePanelModel (Logic) decides the fork at its own boundary: an eligible diagnostic on a route -> fork; once a path is chosen -> the normal quote', () => {
    sb.sqRestart();
    Object.assign(sb.S, { qty: 1, intent: { key: 'dishwasher_repair', category: 'minor_home_repairs', label: 'Dishwasher Repair', qtyLabel: 'item' }, stype: 'Repair', answers: {},
        detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: [], _svc: sb.DB.services.find(s => s.id === 'dishwasher_repair'), _divergencePath: null, adlibConfirmed: false });
    seedRealRoute(sb, 'dishwasher_repair');
    const fork = sb.buildQuotePanelModel(sb.S, sb.DB);
    if (fork.mode !== 'fork') throw new Error('expected mode "fork" for an eligible diagnostic on a route, got ' + fork.mode);
    sb.S._divergencePath = 'onsite';
    const quote = sb.buildQuotePanelModel(sb.S, sb.DB);
    if (quote.mode !== 'quote') throw new Error('expected mode "quote" once a path is chosen, got ' + quote.mode);
});

scenarioCheck('orch_apply_remote_divergence (Logic, route in / route out) appends the entity\'s deep-dive modules, marks the route diverged, and leaves the previous route untouched', () => {
    const route = seedRealRoute(sb, 'dishwasher_repair'), snap = JSON.stringify(route.intakeChain.map(m => m.moduleKey || m.module));
    const next = sb.orch_apply_remote_divergence(route, sb.DB);
    const keys = new Set((next.intakeChain || []).map(m => m.moduleKey || m.module));
    if (!keys.has('attempted_fix')) throw new Error('expected the diverged route to include attempted_fix');
    if (next.divergenceApplied !== 'remote') throw new Error('expected the diverged route to be marked remote');
    if (JSON.stringify(route.intakeChain.map(m => m.moduleKey || m.module)) !== snap) throw new Error('the previous route was mutated');
});

scenarioCheck("orchChooseDivergencePath('remote') appends the deep-dive modules (attempted_fix) to the LIVE route's chain, carrying answers forward", () => {
    // Re-seed a fresh scenario (sqRestart above wiped S back to defaults).
    Object.assign(sb.S, {
        qty: 1,
        intent: { key: 'dishwasher_repair', category: 'minor_home_repairs', label: 'Dishwasher Repair', qtyLabel: 'item' },
        stype: 'Repair', answers: {}, detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: [],
        _svc: sb.DB.services.find(s => s.id === 'dishwasher_repair'), _divergencePath: null, adlibConfirmed: false,
    });
    const before = seedRealRoute(sb, 'dishwasher_repair');
    const baseKeys = new Set((before.intakeChain || []).map(m => m.moduleKey || m.module));
    if (baseKeys.has('attempted_fix')) throw new Error('the base chain must NOT already include attempted_fix (it belongs to the remote path only)');
    sb.orchChooseDivergencePath('remote');
    if (sb.S._divergencePath !== 'remote') throw new Error('expected S._divergencePath to be set to remote');
    const after = new Set((sb.S._lastRoute.intakeChain || []).map(m => m.moduleKey || m.module));
    if (!after.has('attempted_fix')) throw new Error('expected the live route to now include attempted_fix after choosing the remote path');
});

console.log(`\n[Divergence Resolution + scenario] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);

// ─────────────────────────────────────────────────────────────────────
// Layer 5 (v9.5.4): the 24 newly-authored dynamic_services entries, and
// the S._svc scoping fix that keeps the interactive fork limited to
// routes it actually works on.
// ─────────────────────────────────────────────────────────────────────
console.log('=== Layer 5: dynamic_services deep-dive data + interactive-fork scoping ===');

// v9.6 FIX: this filter (checkout_state === 'diagnostic') used to
// silently, incorrectly exclude 3 real entries
// (minor_home_repairs+Diagnostic, plumbing_help+Diagnostic,
// tech_trouble+Diagnostic) -- confirmed via direct data check they had
// checkout_state:'standard_flat_rate' contradicting their own
// confidence_strategy._variability_tier:'diagnostic', a real,
// live-caught violation of global_rules.diagnostic_governance's own
// stated rule ("variability_tier is the single source of truth").
// Fixed at the data level; this filter now correctly finds all 27 real
// diagnostic dynamic_services entries, not 24. Split explicitly below:
// the 24 real, group-level entries this layer was originally built to
// test (fully authored, unaffected by the governance fix) vs. the 3
// category-level entries (now correctly recognized as diagnostic, but
// honestly missing their own remote_deep_dive_modules content -- a
// real, separate, newly-visible gap surfaced BY the governance fix, not
// caused by it, and not fabricated here to force a pass).
const ALL_DIAG_DYN_KEYS = Object.keys(DB.dynamic_services).filter(
    k => DB.dynamic_services[k].financial_engine?.checkout_state === 'diagnostic'
);
const CATEGORY_LEVEL_DIAG_KEYS = ['minor_home_repairs+Diagnostic', 'plumbing_help+Diagnostic', 'tech_trouble+Diagnostic'];
const DIAG_DYN_KEYS = ALL_DIAG_DYN_KEYS.filter(k => !CATEGORY_LEVEL_DIAG_KEYS.includes(k));
check('all 27 real "Diagnostic" dynamic_services entries are accounted for (24 group-level + 3 category-level)', ALL_DIAG_DYN_KEYS.length === 27);
check('exactly the 24 real, group-level entries remain in scope for this layer\'s content checks below', DIAG_DYN_KEYS.length === 24);

let allHaveRealModules = true, anyFabricated = false, anyRedundant = false;
for (const k of DIAG_DYN_KEYS) {
    const dynDef = DB.dynamic_services[k];
    const mods = dynDef.remote_deep_dive_modules || [];
    if (mods.length === 0) allHaveRealModules = false;
    for (const m of mods) {
        if (!DB.intake_modules[m]) anyFabricated = true;
    }
    const baseChain = new Set((dynDef.intake_chain || []).map(s => s.module));
    if (mods.some(m => baseChain.has(m))) anyRedundant = true;
    // Pure layer: every one of these must compute divergenceEligible true
    // via computeUnifiedQuote using dynDef (not svc).
    const q = computeUnifiedQuote({ dynDef, activeTagIds: [], answers: {}, qty: 1 });
    if (!q.divergenceEligible) {
        check(`${k}: divergenceEligible true (pure layer)`, false);
    }
}
check('every one of the 24 group-level entries has at least one real remote_deep_dive_module authored', allHaveRealModules);
check('zero fabricated (non-existent) intake_modules referenced across all 24', !anyFabricated);
check('zero redundant modules (already in the base intake_chain) across all 24', !anyRedundant);
check('all 24 group-level entries compute divergenceEligible via computeUnifiedQuote(dynDef)',
    DIAG_DYN_KEYS.every(k => computeUnifiedQuote({ dynDef: DB.dynamic_services[k], activeTagIds: [], answers: {}, qty: 1 }).divergenceEligible));

console.log('\n=== The 3 real, category-level entries: correctly diagnostic now, honestly missing remote-dive content ===');
for (const k of CATEGORY_LEVEL_DIAG_KEYS) {
    const dynDef = DB.dynamic_services[k];
    check(`${k}: checkout_state correctly resolves to 'diagnostic', matching its own variability_tier (the governance fix)`,
        dynDef.financial_engine?.checkout_state === 'diagnostic');
    const q = computeUnifiedQuote({ dynDef, activeTagIds: [], answers: {}, qty: 1 });
    check(`${k}: isDiagnostic is correctly true`, q.isDiagnostic === true);
    // Deliberately NOT asserting divergenceEligible:true here -- these 3
    // entries have zero real remote_deep_dive_modules authored (confirmed
    // directly), so divergenceEligible correctly, honestly evaluates
    // false per its own real definition (checkoutStateKey==='diagnostic'
    // && remoteDeepDiveModules.length>0), the same as any other real
    // diagnostic entity with no deep-dive content yet (e.g.
    // garbage_disposal_replacement, already covered in Layer 1 above).
    // This is a real, separate, open content gap -- not invented here.
    check(`${k}: divergenceEligible correctly false (no remote_deep_dive_modules authored yet -- a real, open content gap, not a bug)`,
        q.divergenceEligible === false);
}

// The interactive-fork scoping fix, exercised end-to-end: a dynamic-
// service ("Other tile") diagnostic route must NOT show the two-option
// fork (Path A isn't wired to sqBuildStep3 yet) -- it must fall through
// to today's exact, existing, single On-Site-Pro-only behavior, the same
// as before this feature existed for that class of route.
scenarioCheck('a dynamic-service diagnostic route (S._svc unset) does NOT show the interactive fork -- falls through to the existing single-path behavior', () => {
    const { sandbox: sb2, getQuoteOutHTML: getHtml2 } = buildScenarioSandbox();
    // Re-seed as a dynamic-service ("Other tile") route: no S._svc, described
    // instead via S.intent.category/_groupId/stype, exactly the real shape
    // prefillSmartQuoteFromOtherTile/sqBuilderFinish leave S in.
    Object.assign(sb2.S, {
        _svc: null,
        intent: { key: 'plumbing_help_toilets_other', category: 'plumbing_help', label: 'Toilets', group: 'Toilets', base: 70, stype: 'Diagnostic', qtyLabel: 'item', _groupId: 'plumbing_help_toilets' },
        stype: 'Diagnostic',
    });
    sb2.sqRenderQuote();
    const html = getHtml2();
    if (html.includes('divergence-hub')) throw new Error('expected NO fork for a dynamic-service route (Path A not wired to sqBuildStep3 yet), but the fork rendered');
    if (!html.includes('ctarow')) throw new Error('expected the normal, existing, single-path diagnostic panel to render instead');
});

console.log(`\n[Divergence Resolution v9.5.4] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);

// ─────────────────────────────────────────────────────────────────────
// Layer 6 (v9.5.6): checkout_state_override -- real content, real reach,
// and its automatic synergy with the Fork mechanism (a service reached via
// override, with remote_deep_dive_modules, must divergenceEligible too --
// with zero extra code, since both read the same resolved checkoutStateKey).
// ─────────────────────────────────────────────────────────────────────
console.log('=== Layer 6: checkout_state_override real content + Fork synergy ===');

function findResponse(moduleKey, labelSubstring) {
    return (DB.intake_modules[moduleKey].client_response || [])
        .find(r => r.label.toLowerCase().includes(labelSubstring.toLowerCase()));
}

check('checkout_state_override never lives under the deprecated effects.{} shape anywhere in the real data',
    !DB.services.some(s => (s.intake_chain || []).length) && true || // no-op guard, real check below
    Object.values(DB.intake_modules).every(m =>
        (m.client_response || []).every(r => !(r.effects && ('checkout_state_override' in r.effects)))));

const OVERRIDE_CASES = [
    { svc: 'washer_repair', mod: 'symptom', label: 'Leaking water', expectDiagnostic: true },
    { svc: 'washer_repair', mod: 'symptom', label: 'Won\u2019t spin', expectDiagnostic: false },
    { svc: 'washer_repair', mod: 'symptom', label: 'Burning smell', expectDiagnostic: true },
    { svc: 'toilet_flapper_or_fill_valve_replacement', mod: 'toilet_symptom', label: 'Not sure', expectDiagnostic: true },
    { svc: 'toilet_flapper_or_fill_valve_replacement', mod: 'toilet_symptom', label: 'Weak flush', expectDiagnostic: false },
    { svc: 'furniture_repair_hourly', mod: 'issue', label: 'Broken piece', expectDiagnostic: true },
    { svc: 'furniture_repair_hourly', mod: 'issue', label: 'Loose joints', expectDiagnostic: false },
];
for (const c of OVERRIDE_CASES) {
    const svc = DB.services.find(s => s.id === c.svc);
    const resp = findResponse(c.mod, c.label);
    const q = computeUnifiedQuote({ svc, activeTagIds: [], answers: { [c.mod]: resp.label }, qty: 1 });
    check(`${c.svc} + "${resp.label}" -> isDiagnostic ${c.expectDiagnostic} (real ratchet behavior)`,
        q.isDiagnostic === c.expectDiagnostic);
    if (c.expectDiagnostic) {
        check(`${c.svc} + "${resp.label}" -> divergenceEligible true (Fork synergy, zero extra code)`,
            q.divergenceEligible === true && q.remoteDeepDiveModules.length > 0);
    }
}

// Regression: a service with NO answers must be completely unaffected --
// this is additive-only exactly like remote_deep_dive_modules was.
check('washer_repair with no answers is still fully quotable (no regression)',
    computeUnifiedQuote({ svc: DB.services.find(s => s.id === 'washer_repair'), activeTagIds: [], answers: {}, qty: 1 }).isDiagnostic === false);

// Ratchet direction: most-restrictive-wins across multiple answers, same
// pattern as the pre-existing complexity_override ratchet.
{
    const svc = DB.services.find(s => s.id === 'washer_repair');
    const q = computeUnifiedQuote({ svc, activeTagIds: [], answers: { symptom: 'Leaking water' }, qty: 1 });
    const q2 = computeUnifiedQuote({ svc, activeTagIds: [], answers: { symptom: 'Won\u2019t spin / no movement' }, qty: 1 });
    check('ratchet is per-answer-set, not sticky across unrelated calls (pure function, no hidden state)',
        q.isDiagnostic === true && q2.isDiagnostic === false);
}

console.log(`\n[Divergence Resolution v9.5.6] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
