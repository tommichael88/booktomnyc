#!/usr/bin/env node
/**
 * verify_route_validator_phase4.js
 *
 * Regression test for Master Blueprint Phase 4: validateRoute (the
 * RouteValidator) and catastrophicFallbackRoute (the Veto's safe
 * fallback). Confirms a real, valid route passes through untouched, and
 * a genuinely broken route gets intercepted and replaced before it could
 * ever reach a renderer or crash downstream code.
 *
 * Also fixes a real, expected gap caught by run_all.sh itself: adding
 * validateRoute/catastrophicFallbackRoute broke 3 existing tests whose
 * own eval-harness function lists didn't know about the new functions
 * (and the KNOWN_UI_TEMPLATES const they reference) — exactly the kind
 * of regression the master test runner exists to catch, caught on the
 * first real run.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

function findFn(name) {
    const m = QR_HTML.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) return null;
    let depth = 0, start = m.index, i = m.index + m[0].length - 1;
    for (let j = i; j < QR_HTML.length; j++) {
        if (QR_HTML[j] === '{') depth++;
        else if (QR_HTML[j] === '}') { depth--; if (depth === 0) return QR_HTML.slice(start, j + 1); }
    }
    return null;
}

const FNS = ['resolveDynamicService', 'resolveBaseConfidenceStrategy', 'resolveForceModules',
    'applyLiveConfidenceEscalation', 'deriveComplexityTier', 'applyPricingFormula',
    'resolveCheckoutState', 'sqTagLabel', 'tagValidForCategory', 'resolveEngineKey',
    'resolveServiceBadge', 'computeUnifiedQuote', '_resolveIntakeChain', '_isModVisible',
    'resolveGroupFromIntent', 'collectBookingContext_catalog', 'makeBookingContext',
    'orch_resolve_entity', 'orch_apply_object_based_resolution', 'orch_enrich_from_dynamic_service', 'orch_compute_variability_flags', 'orch_compose_intake_chain',
    'orch_apply_location_hints', 'orch_compute_confidence', 'orch_select_ui_template',
    'orch_merge_materials_estimate', 'orch_compute_quote', 'orch_apply_intake_bypass_rules',
    'readRoutePath', 'evaluateInvariant', 'describeInvariantFailure', 'checkRoutingArchetypeConsistency', 'validateRoute', 'catastrophicFallbackRoute', 'executeWorkflow'];
let code = "const ORCH_QTY_MODS = new Set(['item_count', 'count', 'hybrid_qty', 'global_quantity']);\n";
code += "const KNOWN_UI_TEMPLATES = new Set(['self_quote', 'curated_card', 'chip_grid', 'legacy_flow']);\n";
code += FNS.map(findFn).join('\n\n');
const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'route_validator' });

console.log('=== A real, valid route passes through untouched (no veto) ===');
const svc = DB.services.find(s => s.id === 'toilet_install');
const ctx = sandbox.collectBookingContext_catalog(svc, 'plumbing_help');
const validRoute = sandbox.executeWorkflow(ctx, DB);
check('uiTemplate is a real, known template', ['self_quote', 'curated_card', 'chip_grid', 'legacy_flow'].includes(validRoute.uiTemplate));
check('route is NOT vetoed', validRoute._vetoed !== true);
check('trace has real entries (Phase 7 observability intact)', Array.isArray(validRoute.trace) && validRoute.trace.length > 0);

console.log('\n=== validateRoute directly: catches each real invariant violation ===');
check('rejects an unknown uiTemplate value', !sandbox.validateRoute({ uiTemplate: 'not_a_real_template', trace: [{}] }, DB).valid);
check('rejects legacy_flow with no entity', !sandbox.validateRoute({ uiTemplate: 'legacy_flow', entity: null, trace: [{}] }, DB).valid);
check('rejects curated_card with entityType fallback (no real entity to ask questions about)',
    !sandbox.validateRoute({ uiTemplate: 'curated_card', entityType: 'fallback', trace: [{}] }, DB).valid);
check('rejects a negative laborEstimate', !sandbox.validateRoute({ uiTemplate: 'curated_card', entityType: 'service', quote: { laborEstimate: -10 }, trace: [{}] }, DB).valid);
check('rejects an inverted materialsEstimate range (min > max)',
    !sandbox.validateRoute({ uiTemplate: 'curated_card', entityType: 'service', materialsEstimate: { min: 50, max: 10 }, trace: [{}] }, DB).valid);
check('rejects a missing/empty trace', !sandbox.validateRoute({ uiTemplate: 'curated_card', entityType: 'service', trace: [] }, DB).valid);
check('accepts a genuinely well-formed route', sandbox.validateRoute({ uiTemplate: 'curated_card', entityType: 'service', quote: { laborEstimate: 100 }, materialsEstimate: { min: 0, max: 0 }, trace: [{}] }, DB).valid);

console.log('\n=== The Veto: a deliberately broken matrix produces a vetoed, safe fallback route ===');
const brokenDB = JSON.parse(JSON.stringify(DB));
brokenDB.workflow.ui_template_matrix.rules = [];
brokenDB.workflow.ui_template_matrix.fallback = { ui_template: 'totally_invalid_template_xyz' };
const ctx2 = sandbox.collectBookingContext_catalog(svc, 'plumbing_help');
const vetoedRoute = sandbox.executeWorkflow(ctx2, brokenDB);
check('the broken route was caught and vetoed', vetoedRoute._vetoed === true);
check('the veto reason is recorded and accurate', vetoedRoute._vetoReasons.some(r => r.includes('totally_invalid_template_xyz')));
check('the fallback route uses the safe legacy_flow template (never crashes, never asks an orphaned question)', vetoedRoute.uiTemplate === 'legacy_flow');
check('the fallback route has a real, non-empty trace (the veto itself is logged, not silent)', vetoedRoute.trace.length > 0);
check('the veto is visible in the trace log specifically', vetoedRoute.trace.some(t => t.step_id === 'route_validator_veto'));

console.log(`\n[Phase 4 RouteValidator verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
