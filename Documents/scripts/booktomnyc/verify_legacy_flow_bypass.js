#!/usr/bin/env node
/**
 * verify_legacy_flow_bypass.js
 *
 * Regression test for Archaeology Audit finding D: requires_furniture_selection
 * and the isOther condition (default_tags includes #adhoc or #manual_review)
 * BOTH completely bypass the curated-card/self-quote matrix in the legacy
 * code, diverting to showIntakeQuestions entirely -- a categorically
 * different UI (a furniture item-picker grid, not a question card).
 *
 * Confirmed: this MUST be identified to the orchestrator before Phase 4
 * (renderRoute needs a real ResolvedRoute.uiTemplate value for this case,
 * not an incorrectly-resolved curated_card/self_quote guess).
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

console.log('=== Matrix has the two legacy_flow bypass rules, checked FIRST ===');
const rules = DB.workflow.ui_template_matrix.rules;
check('rule 0 checks requires_furniture_selection -> legacy_flow', rules[0].if.requires_furniture_selection === true && rules[0].then.ui_template === 'legacy_flow');
check('rule 1 checks is_other_adhoc_service -> legacy_flow', rules[1].if.is_other_adhoc_service === true && rules[1].then.ui_template === 'legacy_flow');

const FNS = ['resolveDynamicService', 'resolveBaseConfidenceStrategy', 'resolveForceModules',
    'applyLiveConfidenceEscalation', 'deriveComplexityTier', 'applyPricingFormula',
    'resolveCheckoutState', 'sqTagLabel', 'tagValidForCategory', 'resolveEngineKey',
    'resolveServiceBadge', 'computeUnifiedQuote', '_resolveIntakeChain', '_isModVisible',
    'resolveGroupFromIntent', 'collectBookingContext_catalog', 'makeBookingContext',
    'orch_resolve_entity', 'orch_apply_object_based_resolution', 'orch_enrich_from_dynamic_service', 'orch_compute_variability_flags', 'orch_compose_intake_chain',
    'orch_apply_location_hints', 'orch_compute_confidence', 'orch_select_ui_template',
    'orch_merge_materials_estimate', 'orch_compute_quote', 'orch_apply_intake_bypass_rules', 'readRoutePath', 'evaluateInvariant', 'describeInvariantFailure', 'checkRoutingArchetypeConsistency', 'validateRoute', 'catastrophicFallbackRoute',
    'executeWorkflow'];
let code = "const ORCH_QTY_MODS = new Set(['item_count', 'count', 'hybrid_qty', 'global_quantity']);\nconst KNOWN_UI_TEMPLATES = new Set(['self_quote', 'curated_card', 'chip_grid', 'legacy_flow']);\n";
code += FNS.map(findFn).join('\n\n');
const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'legacy_flow' });

console.log('\n=== End-to-end: the one real furniture-selection service routes correctly ===');
const furnSvc = DB.services.find(s => s.id === 'furniture_assembly_flat_pack');
check('furniture_assembly_flat_pack has requires_furniture_selection: true', furnSvc.requires_furniture_selection === true);
const furnCtx = sandbox.collectBookingContext_catalog(furnSvc, furnSvc.ui_taxonomy.category_id);
const furnRoute = sandbox.executeWorkflow(furnCtx, DB);
check('routes to uiTemplate: legacy_flow (NOT curated_card/self_quote)', furnRoute.uiTemplate === 'legacy_flow');

console.log('\n=== Control: a normal service is unaffected by the new rules ===');
const controlSvc = DB.services.find(s => s.id === 'toilet_install');
const controlCtx = sandbox.collectBookingContext_catalog(controlSvc, 'plumbing_help');
const controlRoute = sandbox.executeWorkflow(controlCtx, DB);
check('toilet_install still correctly routes to curated_card', controlRoute.uiTemplate === 'curated_card');

console.log('\n=== Dormant case acknowledged: zero real services currently trigger is_other_adhoc_service ===');
const adhocServices = DB.services.filter(s => {
    const tags = (s.default_tags || []).map(t => (typeof t === 'object' && t.$ref) ? t.$ref : t);
    return tags.includes('#adhoc') || tags.includes('#manual_review');
});
check('confirmed dormant today (documented, not silently dropped) -- zero services currently set #adhoc/#manual_review', adhocServices.length === 0);

console.log(`\n[legacy_flow bypass verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
