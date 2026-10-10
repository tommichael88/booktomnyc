#!/usr/bin/env node
/**
 * verify_shadow_mode_broad_sweep_phase5_5.js -- the broad sweep: every service in the catalog, routed through the live workflow, held to the
 * properties a route must have. (Retargeted T156, operator ruling #103.)
 *
 * What it was. Phase 5.5 ran the orchestrator and the old per-screen code against each other ("shadow mode") and required zero divergence before
 * the migration could be cleared. The comparison needed a SECOND implementation to diff against, so the test carried copies of the legacy decisions
 * (the self-quote eligibility check, the intake-chain composition). T155 deleted those copies: classifyServiceIntake is the one definition of the
 * card-tap decision and orch_compose_intake_chain the one composition. The test then diffed each against itself, and its hand-assembled sandbox
 * (41 functions copied out of qr.html by name) had lost closeTagsOverRequires -- it failed on every service with "X is not defined" and proved nothing.
 *
 * What it is now. Nothing is diffed against a deleted oracle, and nothing is copied out of qr.html: the three engine modules load WHOLE through
 * _engine.js (so a helper added next to a function can never drop out of this sandbox), and each route is checked against the CANONICAL property
 * it must satisfy, read from the SSOT or from the one function that owns the decision:
 *
 *   - the route is produced, not thrown, not vetoed;
 *   - the template is one the ui_template_matrix declares (its rules' `then` values and its fallback), and the self-quote answer is the one
 *     classifyServiceIntake gives (the card-tap path and the route path make ONE decision: R-CLIENT-CONVERGE);
 *   - the checkout state is the one resolveServiceCheckoutStateKey resolves (the only reader of an entity's checkout state) and is declared in
 *     checkout_states; the complexity tier is declared in global_rules.complexity_tiers;
 *   - the route's labor and dispatch are what the one pricing function (computeUnifiedQuote) gives for the same service;
 *   - every intake module the route composes is declared in intake_modules (a parametrized key `template::noun` is checked by its template), none
 *     twice, and the chain is the composition orch_compose_intake_chain gives for the bare service;
 *   - every module the SSOT's intake_defaults assign to the service (universal, its category's, its group's, less excluded_services) is in the chain
 *     -- the data decides which questions a service gets, the composer only carries it out;
 *   - a service with no catalog materials links carries its own default_estimates.materials; one with links carries a well-formed range.
 *
 * Plus the targeted shape checks this session's real bugs earned (a base_price:0 service never receives the generic dynamic fallback's base price; the
 * furniture-selection service hands off to the legacy flow; a bypass service with a real question still routes to the curated card).
 *
 * A check this retarget REMOVED, and why. The old sweep asserted by name that a plumbing service "receives its category default (urgency)". The catalog
 * no longer says so: global_rules.intake_defaults.category_defaults.plumbing_help and .tech_trouble are both [] although PENDING_DECISIONS #45 (T118,
 * operator-directed) records urgency as KEPT for exactly those two categories. Three older tests assert the #45 state and are red at the T154 baseline
 * for that reason (verify_intake_defaults_meaningfulness_review, verify_orchestrator_phase2, verify_reported_ui_bugs_batch1). This sweep does not
 * hard-code either state: the defaults property above follows whatever the data says, and the data-versus-ruling disagreement is a catalog decision
 * for the operator (PENDING_DECISIONS, T156), not something a sweep should paper over by agreeing with the data or the test.
 *
 * NON-VACUITY (a check that cannot fail proves nothing). The property check is one function, `problemsFor(svc, route)`. Before the sweep trusts it
 * the test breaks a real route nine ways (wrong checkout state, undeclared tier, drifted price, wrong self-quote answer, undeclared template,
 * duplicated module, undeclared module, a missing default module, inverted materials range) and requires `problemsFor` to name each; and it requires the sweep to have
 * routed at least as many services as the catalog holds, in at least two templates.
 *
 * Dollar amounts are NOT pinned here. Price levels are held by the golden master (price_golden_master.js) and the behavior tests; this sweep holds
 * the structure of the answer.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { engine } = require('./_engine.js');

const REPO_ROOT = path.dirname(__dirname);
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
const allDiffs = [];
const ok = (msg) => { pass++; console.log('  ✓ ' + msg); };
const bad = (msg, detail) => { fail++; console.log('  ✗ ' + msg); allDiffs.push({ check: msg, detail }); };

// The engine modules, whole. No function is copied out of qr.html by name.
const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(engine().wrapper, sandbox, { filename: 'engine_modules' });

const matrix = DB.workflow?.ui_template_matrix || {};
const DECLARED_TEMPLATES = new Set([
    ...(matrix.rules || []).map(r => r.then?.ui_template),
    matrix.fallback?.ui_template,
].filter(Boolean));
const DECLARED_CHECKOUT_STATES = new Set(Object.keys(DB.checkout_states || {}));
const DECLARED_TIERS = new Set(Object.keys(DB.global_rules?.complexity_tiers || {}));
const DECLARED_MODULES = new Set(Object.keys(DB.intake_modules || {}));
const moduleKeyOf = (m) => m?.moduleKey || m?.module || m;
const templateOfKey = (k) => String(k).split('::')[0];

// The modules the SSOT says every route for this service must carry (declared modules only; excluded_services can remove, never add).
function defaultsFor(svc) {
    const defs = DB.global_rules?.intake_defaults || {};
    const excluded = new Set(defs.excluded_services?.[svc.id] || []);
    return [...new Set([
        ...(defs.universal || []),
        ...(defs.category_defaults?.[svc.ui_taxonomy?.category_id] || []),
        ...(defs.group_defaults?.[svc.ui_taxonomy?.group_id] || []),
    ])].filter(m => !excluded.has(m) && DECLARED_MODULES.has(m));
}

// The one place the properties are stated. Returns a list of problems (empty = the route is well-formed for this service).
function problemsFor(svc, route) {
    const problems = [];
    if (!DECLARED_TEMPLATES.has(route.uiTemplate)) problems.push(`uiTemplate "${route.uiTemplate}" is not declared by ui_template_matrix (${[...DECLARED_TEMPLATES].join(', ')})`);
    if (route.uiTemplate === 'legacy_flow') return problems;   // hands off entirely; there is no orchestrated quote to hold

    const q = route.quote;
    if (!q) return problems.concat('no quote on a route that is not a legacy hand-off');
    const resolvedKey = sandbox.resolveServiceCheckoutStateKey(svc).key;
    if (q.checkoutStateKey !== resolvedKey) problems.push(`checkoutStateKey ${q.checkoutStateKey} is not the resolver's ${resolvedKey}`);
    if (!DECLARED_CHECKOUT_STATES.has(q.checkoutStateKey)) problems.push(`checkoutStateKey ${q.checkoutStateKey} is not declared in checkout_states`);
    if (!DECLARED_TIERS.has(q.complexityTier)) problems.push(`complexityTier ${q.complexityTier} is not declared in global_rules.complexity_tiers`);

    // One pricing function: the route's money is computeUnifiedQuote's for the same service.
    const formulaId = svc.pricing_engine && DB.pricing_formulas?.[svc.pricing_engine] ? svc.pricing_engine : null;
    const canonical = sandbox.computeUnifiedQuote({ svc, activeTagIds: [], answers: {}, qty: 1, formulaId });
    if (q.laborEstimate !== canonical.laborEstimate) problems.push(`laborEstimate ${q.laborEstimate} is not computeUnifiedQuote's ${canonical.laborEstimate}`);
    if (q.dispatchFee !== canonical.dispatchFee) problems.push(`dispatchFee ${q.dispatchFee} is not computeUnifiedQuote's ${canonical.dispatchFee}`);

    // One self-quote decision.
    const selfQuoteByClassifier = !!sandbox.classifyServiceIntake(svc).isSelfQuoting;
    if (selfQuoteByClassifier !== (route.uiTemplate === 'self_quote')) {
        problems.push(`self-quote: classifyServiceIntake says ${selfQuoteByClassifier}, the route chose ${route.uiTemplate}`);
    }

    // Intake chain: declared, unique, and the composition the single composer gives for the bare service.
    const keys = (route.intakeChain || []).map(moduleKeyOf);
    const undeclared = keys.filter(k => !DECLARED_MODULES.has(templateOfKey(k)));
    if (undeclared.length) problems.push(`intake modules not declared in intake_modules: ${undeclared.join(', ')}`);
    if (new Set(keys).size !== keys.length) problems.push(`an intake module appears twice: ${keys.filter((k, i) => keys.indexOf(k) !== i).join(', ')}`);
    const composed = (sandbox.orch_compose_intake_chain({}, { entity: svc }, DB) || []).map(moduleKeyOf).filter(Boolean).sort();
    if (JSON.stringify(composed) !== JSON.stringify(keys.slice().sort())) problems.push(`intake chain ${JSON.stringify(keys.slice().sort())} is not the composer's ${JSON.stringify(composed)}`);

    // The SSOT's intake defaults reach the chain.
    const missingDefaults = defaultsFor(svc).filter(m => !keys.some(k => templateOfKey(k) === m));
    if (missingDefaults.length) problems.push(`intake_defaults assign ${missingDefaults.join(', ')} to this service but the route's chain lacks ${missingDefaults.length > 1 ? 'them' : 'it'}`);

    // Materials.
    const hasCatalogLink = (svc.required_materials || []).length > 0 || (svc.optional_materials || []).length > 0;
    const mat = route.materialsEstimate;
    if (!mat || !Number.isFinite(mat.min) || !Number.isFinite(mat.max) || mat.min < 0 || mat.min > mat.max) {
        problems.push(`materialsEstimate is not a well-formed range: ${JSON.stringify(mat)}`);
    } else if (!hasCatalogLink) {
        const d = svc.default_estimates?.materials || {};
        if (mat.min !== (d.min || 0) || mat.max !== (d.max || 0)) problems.push(`no catalog materials link, so materialsEstimate must be the service's default_estimates.materials [${d.min || 0},${d.max || 0}], got [${mat.min},${mat.max}]`);
    }
    return problems;
}

function routeFor(svc) {
    return sandbox.executeWorkflow(sandbox.collectBookingContext_catalog(svc, svc.ui_taxonomy?.category_id), DB);
}
const clone = (o) => JSON.parse(JSON.stringify(o));

// ── 0. Non-vacuity: the property check must fail on broken routes ─────────────────────────────────────────────────────────────────────────────
console.log('=== 0. The property check can fail ===');
{
    // The mutant base is a real service that the SSOT gives at least one default module, so the defaults property can be broken too.
    const svc = DB.services.find(s => defaultsFor(s).length > 0 && routeFor(s).uiTemplate !== 'legacy_flow');
    if (!svc) { bad('no routed service carries an intake default, so the defaults property cannot be shown to fail'); }
    const base = svc ? routeFor(svc) : null;
    const baseline = svc ? problemsFor(svc, base) : ['no mutant base'];
    if (svc && baseline.length === 0) ok(`a real route (${svc.id}) has no problems -- the mutants below are measured against that`);
    else bad('the baseline route already has problems, so the mutants cannot be measured', baseline);

    const mutants = [
        ['wrong checkout state', r => { r.quote.checkoutStateKey = 'no_such_checkout_state'; }, /checkoutStateKey/],
        ['undeclared complexity tier', r => { r.quote.complexityTier = 'galactic'; }, /complexityTier/],
        ['drifted price', r => { r.quote.laborEstimate += 1; }, /laborEstimate/],
        ['self-quote answer disagrees with the classifier', r => { r.uiTemplate = 'self_quote'; }, /self-quote/],
        ['undeclared template', r => { r.uiTemplate = 'banner_ad'; }, /uiTemplate/],
        ['module composed twice', r => { r.intakeChain.push(r.intakeChain[0]); }, /appears twice/],
        ['undeclared module', r => { r.intakeChain.push({ moduleKey: 'no_such_module' }); }, /not declared in intake_modules/],
        ['inverted materials range', r => { r.materialsEstimate = { min: 50, max: 10 }; }, /materialsEstimate/],
        ['a default module the SSOT assigns is missing', r => { const d = defaultsFor(svc)[0]; r.intakeChain = r.intakeChain.filter(m => templateOfKey(moduleKeyOf(m)) !== d); }, /intake_defaults assign/],
    ];
    for (const [name, mutate, expect] of (svc ? mutants : [])) {
        const broken = clone(base);
        mutate(broken);
        const found = problemsFor(svc, broken);
        if (found.some(p => expect.test(p))) ok(`mutant "${name}" is caught`);
        else bad(`mutant "${name}" went UNDETECTED -- the sweep below could pass on a broken route`, found);
    }
}

// ── 1. The sweep: every service ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
console.log(`\n=== 1. Every service in the catalog (${DB.services.length}) ===`);
const byTemplate = {};
let routed = 0;
for (const svc of DB.services) {
    let route;
    try { route = routeFor(svc); }
    catch (e) { bad(`${svc.id}: executeWorkflow threw -- ${e.message}`, { id: svc.id, error: e.message }); continue; }
    if (route._vetoed) { bad(`${svc.id}: route was VETOED -- ${JSON.stringify(route._vetoReasons)}`, { id: svc.id, reasons: route._vetoReasons }); continue; }
    routed++;
    byTemplate[route.uiTemplate] = (byTemplate[route.uiTemplate] || 0) + 1;
    const problems = problemsFor(svc, route);
    if (problems.length) bad(`${svc.id}: ${problems.join('; ')}`, { id: svc.id, problems });
    else ok(`${svc.id} -> ${route.uiTemplate}${route.bypassIntake ? ' (bypass)' : ''}`);
}
if (routed === DB.services.length) ok(`all ${routed} services were routed (none skipped)`);
else bad(`only ${routed} of ${DB.services.length} services were routed`);
if (Object.keys(byTemplate).length >= 2) ok(`the sweep exercised ${Object.keys(byTemplate).length} templates: ${Object.entries(byTemplate).map(([k, v]) => k + '=' + v).join(', ')}`);
else bad(`the sweep saw only one template (${JSON.stringify(byTemplate)}); a sweep of one shape proves little`);

// ── 2. Targeted shape checks: what each real bug this session found would look like if it came back ────────────────────────────────────────────
console.log('\n=== 2. Targeted shape checks ===');
{
    const get = (id) => DB.services.find(s => s.id === id);

    // Bypass services: the ones with a real question still ask it (curated card); the batched one is not a bare self-quote.
    const r1 = routeFor(get('cabinet_knob_or_pull_install'));
    if (r1.uiTemplate === 'curated_card') ok('cabinet_knob_or_pull_install routes to curated_card (it has a real install_type question and a quantity)');
    else bad(`cabinet_knob_or_pull_install routed to ${r1.uiTemplate} instead of curated_card`);

    const r2 = routeFor(get('shower_head_replacement'));
    if (r2.uiTemplate === 'curated_card') ok('a bypass service with a real question (shower_head_replacement) still routes to curated_card -- its question gets asked');
    else bad(`shower_head_replacement routed to ${r2.uiTemplate} instead of curated_card`);

    // requires_furniture_selection hands off to the legacy flow, for every service that carries it (read from the data, not named).
    const furnitureServices = DB.services.filter(s => s.requires_furniture_selection);
    if (furnitureServices.length === 0) bad('no service carries requires_furniture_selection, so the legacy hand-off is untested');
    for (const s of furnitureServices) {
        const r = routeFor(s);
        if (r.uiTemplate === 'legacy_flow') ok(`${s.id} (requires_furniture_selection) hands off to legacy_flow`);
        else bad(`${s.id} carries requires_furniture_selection but routed to ${r.uiTemplate}`);
    }

    // The SSOT's intake defaults are not vacuous: at least one (service, module) pair is assigned by the data, and every pair is honored (the per-service
    // property above); here we only make sure the sweep had something to hold.
    const pairs = DB.services.reduce((n, sv) => n + defaultsFor(sv).length, 0);
    if (pairs > 0) ok(`intake_defaults assign ${pairs} (service, module) pairs; each was checked against its route in section 1`);
    else bad('intake_defaults assign no module to any service, so the defaults property was never exercised');

    // The bug this sweep found first: an explicit base_price 0 (every hourly- or formula-priced service) must NEVER receive the generic dynamic fallback's
    // base price through enrichment. The fallback is for entities with NO base_price at all, not a deliberate zero. Read from the data.
    const hourly = DB.services.filter(s => s.financial_engine?.base_price === 0);
    if (hourly.length === 0) bad('no service has base_price 0, so the enrichment-leak guard is untested');
    for (const s of hourly) {
        const q = sandbox.computeUnifiedQuote({ svc: s, activeTagIds: [], answers: {}, qty: 1 });
        if (q.base === 0 && q.laborEstimate > 0) ok(`${s.id} (base_price 0) prices from time x rate or its formula alone: base stays 0, labor is positive`);
        else bad(`${s.id} (base_price 0): base=${q.base}, laborEstimate=${q.laborEstimate} -- the generic dynamic fallback's base price has leaked in, or the hourly price is gone`);
    }
}

console.log(`\n[Phase 5.5 broad sweep] ${pass} passed, ${fail} failed (of ${pass + fail} checks)`);
if (allDiffs.length > 0) {
    console.log('\nFull failure detail:');
    console.log(JSON.stringify(allDiffs, null, 2));
}
console.log('');
process.exit(fail > 0 ? 1 : 0);
