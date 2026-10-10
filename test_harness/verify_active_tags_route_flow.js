#!/usr/bin/env node
/**
 * verify_active_tags_route_flow.js
 *
 * Regression test for the core finding: executeWorkflow computed activeTagIds
 * internally but never exposed it on the route object. Downstream renderers
 * (renderCuratedCardFromRoute, renderSelfQuoteFromRoute) read route.activeTags
 * and pass it to computeUnifiedQuote for live recompute -- but route.activeTags
 * was always undefined, so tags had no effect on any re-rendered price.
 *
 * Fix: added `activeTags: activeTagIds` to the route return object in
 * executeWorkflow. Tags now flow correctly from NLP detection → context →
 * activeTagIds → route.activeTags → computeUnifiedQuote.
 */
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const REPO_ROOT = path.dirname(__dirname);
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));
const QR_HTML = require('./_page.js').readPage(path.join(REPO_ROOT, 'qr.html'));

let pass = 0, fail = 0;
function check(label, cond) {
    if (cond) { pass++; console.log('  ✓ ' + label); }
    else { fail++; console.log('  ✗ ' + label); }
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

const FNS = [
    'resolveDynamicService', 'resolveBaseConfidenceStrategy', 'resolveServiceCheckoutStateKey', 
    'applyLiveConfidenceEscalation', 'deriveComplexityTier', 'applyPricingFormula',
    'buildCheckoutStateModel', 'sqTagLabel', 'tagValidForCategory', 'resolveEngineKey',
    'resolveServiceBadge', 'computeUnifiedQuote', 'computeArchetypeQuote', 'mathFurnitureAssembly', '_resolveIntakeChain', '_isModVisible',
    'mathFurnitureAssembly', 'resolveGroupFromIntent', 'collectBookingContext_catalog',
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
const COMPONENT_MODULE_NAMES = new Set();
const SYMPTOM_MODULE_NAMES = new Set();
const _BRICK_HINTS = new Set(['fireplace','brick','concrete','stone','mantel','mantle','chimney','masonry','cinder block']);

let code = `const ORCH_QTY_MODS = new Set(${JSON.stringify([...ORCH_QTY_MODS])});\n`;
code += `const KNOWN_UI_TEMPLATES = new Set(${JSON.stringify([...KNOWN_UI_TEMPLATES])});\n`;
code += `const COMPONENT_MODULE_NAMES = new Set();\nconst SYMPTOM_MODULE_NAMES = new Set();\n`;
code += `const _BRICK_HINTS = new Set(${JSON.stringify([..._BRICK_HINTS])});\n`;
code += FNS.map(findFn).filter(Boolean).join('\n\n');

const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

console.log('\n=== activeTags is exposed on the route object ===');
{
    const svc = DB.services.find(s => s.id === 'shelf_mounting_standard_buy_the_hour');
    const ctx = sandbox.collectBookingContext_catalog(svc, 'wall_mounting');
    const route = sandbox.executeWorkflow(ctx, DB);
    check('route.activeTags is an array (not undefined)', Array.isArray(route.activeTags));
    check('route.activeTags is accessible to downstream renderers', route.activeTags !== undefined);
}

console.log('\n=== Tags detected from free-text flow into route.activeTags ===');
{
    // Simulate what collectBookingContext_freeText produces after tag detection
    // by using makeBookingContext with pre-populated detectedTagIds
    // (collectBookingContext_freeText calls detectTagsNLP which needs ACTIONS browser global)
    const ctxWithTags = sandbox.makeBookingContext('free_text', {
        rawText: 'mount a heavy mirror on a brick wall',
        selectedCategoryId: 'wall_mounting',
        selectedGroupId: 'wall_mounting_frames_shelves',
        detectedTagIds: ['#heavy_item', '#brick_wall', '#wall_mount'],
        negatedTagIds: [],
    });
    const route = sandbox.executeWorkflow(ctxWithTags, DB);
    check('route.activeTags includes injected #heavy_item', (route.activeTags||[]).includes('#heavy_item'));
    check('route.activeTags includes injected #brick_wall', (route.activeTags||[]).includes('#brick_wall'));
    check('route.activeTags includes all three injected tags', (route.activeTags||[]).length >= 3);
}

console.log('\n=== Tag-based complexity escalation (escalate_complexity) affects the route quote ===');
{
    const svc = DB.services.find(s => s.id === 'shelf_mounting_standard_buy_the_hour');
    const ctxBase = sandbox.collectBookingContext_catalog(svc, 'wall_mounting');
    const routeBase = sandbox.executeWorkflow(ctxBase, DB);

    const ctxTagged = sandbox.makeBookingContext('catalog', {
        selectedServiceId: svc.id,
        selectedCategoryId: 'wall_mounting',
        selectedGroupId: svc.ui_taxonomy?.group_id,
        detectedTagIds: ['#fragile_item'],
    });
    const routeTagged = sandbox.executeWorkflow(ctxTagged, DB);
    check('route.activeTags includes injected #fragile_item', (routeTagged.activeTags||[]).includes('#fragile_item'));
    // NOTE: shelf_mounting_standard_buy_the_hour is already 'skilled' tier in the
    // current SSOT (v9.4) -- #fragile_item's escalate_complexity:'skilled' has no
    // headroom against an already-skilled service, so price is correctly unchanged
    // here. The mechanism itself is verified directly below against a synthetic
    // 'routine'-tier context where escalation has real headroom to show.
    check('quote does not error and returns a valid laborEstimate with the tag active',
        typeof routeTagged.quote.laborEstimate === 'number' && routeTagged.quote.laborEstimate >= routeBase.quote.laborEstimate);

    // Direct mechanism test: escalate_complexity genuinely raises price when there IS
    // headroom AND the service's pricing type is time-based (flat_rate services
    // correctly ignore complexity tier in their price -- flat means flat by design).
    const mockSvc = {
        ...svc,
        financial_engine: { type: 'hourly', base_price: 0, checkout_state: 'standard_flat_rate' },
        operational_metrics: { ...svc.operational_metrics, complexity_tier: undefined },
        default_estimates: { total_minutes: { min: 20, max: 30 } }
    };
    const routineQuote = sandbox.computeUnifiedQuote({ svc: mockSvc, dynDef: null, activeTagIds: [], answers: {}, qty: 1 });
    const escalatedQuote = sandbox.computeUnifiedQuote({ svc: mockSvc, dynDef: null, activeTagIds: ['#fragile_item'], answers: {}, qty: 1 });
    check('#fragile_item escalate_complexity genuinely raises price when the base tier has headroom (routine -> skilled)',
        escalatedQuote.laborEstimate > routineQuote.laborEstimate);
}

console.log('\n=== inherentTagIds separate from detTagIds (false banner prevention) ===');
{
    const svc = DB.services.find(s => s.id === 'shelf_mounting_standard_buy_the_hour');
    const ctx = sandbox.collectBookingContext_catalog(svc, 'wall_mounting');
    const route = sandbox.executeWorkflow(ctx, DB);
    // default_tags (#drywall, #wall_mount) should be in route.activeTags via enrichment
    // but NOT confused with user-detected tags
    check('catalog route activeTags from catalog have no detectedTagIds noise', (ctx.detectedTagIds||[]).length === 0);
}

console.log('\n=== dispatch_fee_enabled toggle is respected ===');
{
    const svc = DB.services.find(s => s.id === 'door_lock_or_handle_install');
    const ctx = sandbox.collectBookingContext_catalog(svc, 'minor_home_repairs');
    const route = sandbox.executeWorkflow(ctx, DB);
    check('dispatch_fee_enabled:true means dispatch fee > 0', route.quote.dispatchFee > 0);
    check('dispatch_fee value matches global_rules.surcharges.dispatch_fee', route.quote.dispatchFee === DB.global_rules.surcharges.dispatch_fee);
}

console.log('\n=== RouteValidator active for curated-card path ===');
{
    const svc = DB.services.find(s => s.id === 'prehung_interior_door_install');
    const ctx = sandbox.collectBookingContext_catalog(svc, 'minor_home_repairs');
    const route = sandbox.executeWorkflow(ctx, DB);
    check('valid route not vetoed', !route._vetoed);
    check('route has activeTags exposed', Array.isArray(route.activeTags));
    check('route.flags.chain_has_real_non_quantity_question true for door', route.flags?.chain_has_real_non_quantity_question === true);
}

console.log('\n=== All 70 services produce routes with activeTags array ===');
{
    let missing = 0;
    for (const svc of DB.services) {
        const ctx = sandbox.collectBookingContext_catalog(svc, svc.ui_taxonomy?.category_id);
        const route = sandbox.executeWorkflow(ctx, DB);
        if (!Array.isArray(route.activeTags)) missing++;
    }
    check(`zero services produce routes with undefined activeTags (found ${missing})`, missing === 0);
}

console.log(`\n[active tags route flow verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
