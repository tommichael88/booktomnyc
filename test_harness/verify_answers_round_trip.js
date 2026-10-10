#!/usr/bin/env node
/**
 * verify_answers_round_trip.js
 *
 * Regression test for the Session 1 fix (T108 / Charter S5A.5, S11 item 1,
 * Operator Brief "BTNYC Consolidation Arc"):
 *
 * executeWorkflow hardcoded `answers = {}` on entry and never read
 * `context.answers`. handleIntakeAnswer's real write side is:
 *
 *     ctx.answers = ctx.answers || {};
 *     ctx.answers[moduleKey] = label;
 *     const newRoute = executeWorkflow(ctx, DB);
 *
 * ...so every chip click on the orchestrator's curated card
 * (renderCuratedCardFromRoute, reached via free-text and other-tile
 * entries) was silently discarded on the very next workflow pass -- the
 * re-run always started from an empty answers map. The legacy renderer
 * (sqBuildCuratedIntake) was never affected, because its chips write
 * directly to S.answers and re-render via a local closure, never through
 * executeWorkflow.
 *
 * Fix: seed `answers` from `context.answers || {}` at the declaration site
 * inside executeWorkflow, so the read side finally honors the write side of
 * the documented BookingContext contract.
 *
 * This test simulates the real handleIntakeAnswer mutation directly against
 * a context object (setting ctx.answers[moduleKey] = label, then
 * re-invoking executeWorkflow) rather than going through any renderer --
 * the bug and the fix both live entirely inside executeWorkflow itself.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML = require('./_page.js').readPage(path.join(REPO_ROOT, 'qr.html'));
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(label, cond) {
    if (cond) { pass++; console.log('  \u2713 ' + label); }
    else { fail++; console.log('  \u2717 ' + label); }
}

// T143/T144: functions declared in the three engine modules are loaded WHOLE (the T136 `_engine.js` loader), so a helper added next to a
// function can no longer drop out of this sandbox ("X is not defined" -- noise unrelated to what this test asserts). Anything else is still
// extracted by name, below.
const { engineAwareFindFn } = require('./_engine.js');
function _cherryPickFn(name) {
    const m = QR_HTML.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) return '';
    let depth = 0, start = m.index, j = m.index + m[0].length - 1;
    for (; j < QR_HTML.length; j++) {
        if (QR_HTML[j] === '{') depth++;
        else if (QR_HTML[j] === '}') { depth--; if (depth === 0) return QR_HTML.slice(start, j + 1); }
    }
    return '';
}
const findFn = engineAwareFindFn(_cherryPickFn);

// Same function set verify_active_tags_route_flow.js uses to build a working
// executeWorkflow sandbox -- reused deliberately rather than re-derived, so
// this test exercises the identical real call graph.
const FNS = [
    'resolveDynamicService', 'resolveBaseConfidenceStrategy', 'resolveServiceCheckoutStateKey', 
    'applyLiveConfidenceEscalation', 'deriveComplexityTier', 'applyPricingFormula',
    'buildCheckoutStateModel', 'sqTagLabel', 'tagValidForCategory', 'resolveEngineKey',
    'resolveServiceBadge', 'computeUnifiedQuote', 'computeArchetypeQuote', 'mathFurnitureAssembly', '_resolveIntakeChain', '_isModVisible',
    'resolveGroupFromIntent', 'collectBookingContext_catalog',
    'collectBookingContext_otherTile', 'collectBookingContext_freeText', 'makeBookingContext',
    'orch_resolve_entity', 'orch_apply_object_based_resolution',
    'orch_enrich_from_dynamic_service', 'orch_compute_variability_flags',
    'orch_compose_intake_chain', 'orch_apply_location_hints', 'orch_compute_confidence',
    'orch_select_ui_template', 'orch_merge_materials_estimate', 'orch_compute_quote',
    'orch_apply_intake_bypass_rules', 'readRoutePath', 'evaluateInvariant',
    'describeInvariantFailure', 'checkRoutingArchetypeConsistency', 'validateRoute',
    'catastrophicFallbackRoute', 'executeWorkflow', 'orch_max_followup_questions', 'detectTagsNLP', 'detectIntentNLP',
    'extractQty', 'extractObject', 'extractLocation', 'extractSizeHint',
    'inferTagsFromContext',
];

const ORCH_QTY_MODS = new Set(['item_count', 'count', 'hybrid_qty', 'global_quantity']);
const KNOWN_UI_TEMPLATES = new Set(['self_quote', 'curated_card', 'chip_grid', 'legacy_flow', 'force_dynamic_fallback']);
const _BRICK_HINTS = new Set(['fireplace', 'brick', 'concrete', 'stone', 'mantel', 'mantle', 'chimney', 'masonry', 'cinder block']);

let code = `const ORCH_QTY_MODS = new Set(${JSON.stringify([...ORCH_QTY_MODS])});\n`;
code += `const KNOWN_UI_TEMPLATES = new Set(${JSON.stringify([...KNOWN_UI_TEMPLATES])});\n`;
code += `const COMPONENT_MODULE_NAMES = new Set();\nconst SYMPTOM_MODULE_NAMES = new Set();\n`;
code += `const _BRICK_HINTS = new Set(${JSON.stringify([..._BRICK_HINTS])});\n`;
code += FNS.map(findFn).filter(Boolean).join('\n\n');

const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'answers_round_trip' });

// Real SSOT data this test's assertions are pinned to (not invented):
// intake_modules.disposal_request's "Yes, please haul it away" option carries
// modifier_ref "disposal_request_yes_please_haul_it_away", and
// global_rules.modifiers.disposal_request_yes_please_haul_it_away = { fee: 25, minutes: 20 }.
// T118 UPDATE: this test originally used `access` for this example --
// access was removed catalog-wide (a separate, later, explicit operator
// decision: not a question with a meaningful answer distribution in
// residential handyman work). disposal_request replaces it here, carrying
// the identical $25/20min fee, so none of this test's arithmetic changes.
// The test's core logic is unaffected either way: computeUnifiedQuote applies
// modifier_ref fees generically for whatever keys are present in
// ctx.answers, with no dependency on whether that module is "in the
// resolved chain" for this specific service -- confirmed directly back at
// T108 and still true.
const DISPOSAL_LABEL = 'Yes, please haul it away';
const DISPOSAL_MODIFIER = DB.global_rules.modifiers.disposal_request_yes_please_haul_it_away;

console.log('=== Sanity: the SSOT data this test relies on is what we think it is ===');
{
    check('intake_modules.disposal_request has the "Yes, please haul it away" option with a modifier_ref',
        (DB.intake_modules.disposal_request.client_response || []).some(r => r.label === DISPOSAL_LABEL && r.modifier_ref));
    check('global_rules.modifiers.disposal_request_yes_please_haul_it_away carries a real fee and minutes',
        DISPOSAL_MODIFIER && DISPOSAL_MODIFIER.fee > 0 && DISPOSAL_MODIFIER.minutes > 0);
    check("computeUnifiedQuote applies a modifier_ref fee for any key present in answers, regardless of chain/default membership (confirmed via the door_lock_or_handle_install case below, which does not get disposal_request via intake_defaults)",
        !(DB.global_rules.intake_defaults?.category_defaults?.minor_home_repairs || []).includes('disposal_request'));
}

console.log('\n=== Core acceptance criterion: a simulated chip click survives the next executeWorkflow pass ===');
{
    const svc = DB.services.find(s => s.id === 'door_lock_or_handle_install');
    const ctx = sandbox.collectBookingContext_catalog(svc, 'minor_home_repairs');

    const routeBefore = sandbox.executeWorkflow(ctx, DB);
    check('pre-click route computes a valid quote', routeBefore.quote && typeof routeBefore.quote.laborEstimate === 'number');
    const feeBreakdownBefore = (routeBefore.quote.feeBreakdown || []).length;

    // The exact mutation handleIntakeAnswer performs in production:
    //   ctx.answers = ctx.answers || {};
    //   ctx.answers[moduleKey] = label;
    //   const newRoute = executeWorkflow(ctx, DB);
    ctx.answers = ctx.answers || {};
    ctx.answers['disposal_request'] = DISPOSAL_LABEL;
    const routeAfter = sandbox.executeWorkflow(ctx, DB);

    check('quote.laborEstimate differs after the chip click is re-run through executeWorkflow',
        routeAfter.quote.laborEstimate !== routeBefore.quote.laborEstimate);
    check('quote.feeBreakdown grows after the chip click is re-run through executeWorkflow',
        (routeAfter.quote.feeBreakdown || []).length > feeBreakdownBefore);
    check(`labor estimate increased by at least the $${DISPOSAL_MODIFIER.fee} disposal_request fee`,
        routeAfter.quote.laborEstimate >= routeBefore.quote.laborEstimate + DISPOSAL_MODIFIER.fee);
    check('the new feeBreakdown line is attributed to the disposal_request module with the real $25 fee',
        (routeAfter.quote.feeBreakdown || []).some(f => f.moduleKey === 'disposal_request' && f.fee === DISPOSAL_MODIFIER.fee));
}

console.log('\n=== The read side now genuinely matches the write side: route.answers reflects the click ===');
{
    const svc = DB.services.find(s => s.id === 'door_lock_or_handle_install');
    const ctx = sandbox.collectBookingContext_catalog(svc, 'minor_home_repairs');
    sandbox.executeWorkflow(ctx, DB); // first pass, as if the card just rendered
    ctx.answers = ctx.answers || {};
    ctx.answers['disposal_request'] = DISPOSAL_LABEL;
    const route = sandbox.executeWorkflow(ctx, DB);
    check('route.answers.disposal_request is the clicked label, not discarded', route.answers && route.answers.disposal_request === DISPOSAL_LABEL);
}

console.log('\n=== Multiple sequential chip clicks all accumulate (not just the most recent one) ===');
{
    const svc = DB.services.find(s => s.id === 'door_lock_or_handle_install');
    const ctx = sandbox.collectBookingContext_catalog(svc, 'minor_home_repairs');
    sandbox.executeWorkflow(ctx, DB);

    ctx.answers = ctx.answers || {};
    ctx.answers['disposal_request'] = DISPOSAL_LABEL;
    const routeAfterFirstClick = sandbox.executeWorkflow(ctx, DB);
    check('first click present after first re-run', routeAfterFirstClick.answers.disposal_request === DISPOSAL_LABEL);

    ctx.answers['urgency'] = 'Urgent \u2014 today or tomorrow';
    const routeAfterSecondClick = sandbox.executeWorkflow(ctx, DB);
    check('first click STILL present after a second, different click (this is exactly what was broken before the fix)',
        routeAfterSecondClick.answers.disposal_request === DISPOSAL_LABEL);
    check('second click also present', routeAfterSecondClick.answers.urgency === 'Urgent \u2014 today or tomorrow');
    check('both answers now carry real fees in feeBreakdown',
        ['disposal_request', 'urgency'].every(k => (routeAfterSecondClick.quote.feeBreakdown || []).some(f => f.moduleKey === k)));
}

console.log('\n=== A previously-answered module is never overridden by location-hint inference (orch_apply_location_hints) ===');
{
    // Direct unit check on orch_apply_location_hints itself: confirms the fix
    // doesn't create a new bug where seeded answers get silently overwritten
    // by location-hint guessing on the very next pass. door_style_pref's
    // "Hollow core" option carries a real location_hints match for "bedroom".
    const composedChain = [{ moduleKey: 'door_style_pref', client_response: DB.intake_modules.door_style_pref.client_response }];
    const ctxWithLocation = { extractedLocation: 'bedroom' };
    const seededAnswers = { door_style_pref: 'Solid core \u2013 better sound insulation (~$300\u2013$500)' };
    const result = sandbox.orch_apply_location_hints(ctxWithLocation, composedChain, seededAnswers);
    check('an explicit prior answer is never overwritten by location-hint inference',
        result.door_style_pref === seededAnswers.door_style_pref);
}

console.log('\n=== T118 UPDATE (#33 fixed): contexts with no answers set now correctly default to {}, not undefined ===');
{
    let allEmpty = true;
    for (const id of ['door_lock_or_handle_install', 'shelf_mounting_standard_buy_the_hour', 'prehung_interior_door_install']) {
        const svc = DB.services.find(s => s.id === id);
        const ctx = sandbox.collectBookingContext_catalog(svc, svc.ui_taxonomy?.category_id);
        check(`${id}: context.answers is now a real, empty object before any click (T118 #33 fix -- was undefined, PENDING_DECISIONS.md #33's own diagnosed gap)`,
            typeof ctx.answers === 'object' && ctx.answers !== null && Object.keys(ctx.answers).length === 0);
        const route = sandbox.executeWorkflow(ctx, DB);
        if (!route.answers || Object.keys(route.answers).length !== 0) allEmpty = false;
        check(`${id}: route still computes a valid quote with no answers yet`, typeof route.quote?.laborEstimate === 'number');
    }
    check('all three services: route.answers is genuinely {} (not undefined, not crashed) when context.answers was never explicitly set',
        allEmpty);
}

console.log(`\n[answers round-trip verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
