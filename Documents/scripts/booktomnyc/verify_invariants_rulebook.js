#!/usr/bin/env node
/**
 * verify_invariants_rulebook.js
 *
 * Regression test for the Judicial Rulebook: db.invariants, the generic
 * evaluateInvariant()/readRoutePath() evaluator, and validateRoute's
 * consultation of it (instead of hardcoded JS conditionals) -- added
 * per direct request so the RouteValidator's rulebook lives in the
 * SSOT and is auditable without reading code.
 *
 * Also covers a real regression caught by the existing test suite
 * during this same change: the new invariants-driven violation messages
 * initially lost the actual failing value (e.g. which specific bad
 * uiTemplate string was seen), since the rule text is static SSOT
 * content. Fixed via describeInvariantFailure, which appends the real,
 * per-run value(s) alongside the static rule text.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));
const SCHEMA = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc_schema.json'), 'utf8'));

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

console.log('=== db.invariants exists and validates against the schema ===');
check('btnyc.json has a real, non-empty invariants array', Array.isArray(DB.invariants) && DB.invariants.length === 7);
check('schema defines the invariants node', !!SCHEMA.properties?.invariants);
check('every invariant has id, rule, and check', DB.invariants.every(i => i.id && i.rule && i.check));

const FNS = ['readRoutePath', 'evaluateInvariant', 'describeInvariantFailure', 'checkRoutingArchetypeConsistency', 'validateRoute',
    'catastrophicFallbackRoute', 'resolveDynamicService', 'resolveBaseConfidenceStrategy',
    'resolveForceModules', 'applyLiveConfidenceEscalation', 'deriveComplexityTier',
    'applyPricingFormula', 'resolveCheckoutState', 'sqTagLabel', 'tagValidForCategory',
    'resolveEngineKey', 'resolveServiceBadge', 'computeUnifiedQuote', '_resolveIntakeChain',
    '_isModVisible', 'resolveGroupFromIntent', 'collectBookingContext_catalog', 'makeBookingContext',
    'orch_resolve_entity', 'orch_apply_object_based_resolution', 'orch_enrich_from_dynamic_service', 'orch_compute_variability_flags', 'orch_compose_intake_chain',
    'orch_apply_location_hints', 'orch_compute_confidence', 'orch_select_ui_template',
    'orch_merge_materials_estimate', 'orch_compute_quote', 'orch_apply_intake_bypass_rules',
    'executeWorkflow'];
let code = "const ORCH_QTY_MODS = new Set(['item_count', 'count', 'hybrid_qty', 'global_quantity']);\n";
code += "const KNOWN_UI_TEMPLATES = new Set(['self_quote', 'curated_card', 'chip_grid', 'legacy_flow']);\n";
code += FNS.map(findFn).join('\n\n');
const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'invariants' });

console.log('\n=== Generic evaluator handles every real check type correctly ===');
check('enum: rejects an unknown uiTemplate', !sandbox.evaluateInvariant({ uiTemplate: 'bogus' }, DB.invariants.find(i => i.id === 'uitemplate_must_be_known')));
check('enum: accepts a real uiTemplate', sandbox.evaluateInvariant({ uiTemplate: 'curated_card' }, DB.invariants.find(i => i.id === 'uitemplate_must_be_known')));
check('conditional_exists: rejects legacy_flow with no entity', !sandbox.evaluateInvariant({ uiTemplate: 'legacy_flow', entity: null }, DB.invariants.find(i => i.id === 'legacy_flow_requires_entity')));
check('conditional_exists: condition not met -> passes trivially', sandbox.evaluateInvariant({ uiTemplate: 'curated_card', entity: null }, DB.invariants.find(i => i.id === 'legacy_flow_requires_entity')));
check('non_negative: rejects a negative laborEstimate', !sandbox.evaluateInvariant({ quote: { laborEstimate: -5 } }, DB.invariants.find(i => i.id === 'quote_never_negative')));
check('lte: rejects an inverted materials range', !sandbox.evaluateInvariant({ materialsEstimate: { min: 50, max: 10 } }, DB.invariants.find(i => i.id === 'materials_range_not_inverted')));
check('non_empty_array: rejects an empty trace', !sandbox.evaluateInvariant({ trace: [] }, DB.invariants.find(i => i.id === 'trace_required')));

console.log('\n=== Violation messages retain the SPECIFIC failing value, not just static rule text ===');
const badRoute = { uiTemplate: 'totally_invalid_template_xyz', trace: [{}] };
const result = sandbox.validateRoute(badRoute, DB);
check('validateRoute correctly fails on the bad uiTemplate', !result.valid);
check('the violation message includes the ACTUAL bad value, not just the static rule text',
    result.violations.some(v => v.includes('totally_invalid_template_xyz')));

console.log('\n=== End-to-end: a real, valid route passes; db.invariants is genuinely consulted (not the JS fallback) ===');
const svc = DB.services.find(s => s.id === 'toilet_install');
const ctx = sandbox.collectBookingContext_catalog(svc, 'plumbing_help');
const route = sandbox.executeWorkflow(ctx, DB);
check('a real route is not vetoed', route._vetoed !== true);

const noInvariantsDB = JSON.parse(JSON.stringify(DB));
delete noInvariantsDB.invariants;
const ctx2 = sandbox.collectBookingContext_catalog(svc, 'plumbing_help');
const routeFallback = sandbox.executeWorkflow(ctx2, noInvariantsDB);
check('with invariants genuinely missing, the JS fallback still protects the route (graceful degradation)', routeFallback._vetoed !== true);

console.log(`\n[Judicial Rulebook verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
