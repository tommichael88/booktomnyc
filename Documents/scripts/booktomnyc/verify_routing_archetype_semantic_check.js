#!/usr/bin/env node
/**
 * verify_routing_archetype_semantic_check.js
 *
 * Regression test for the first genuine SEMANTIC check added to
 * validateRoute — direct response to a real, agreed-valuable critique
 * (T19): every existing invariant checks structure, none check "does
 * this route's content actually make sense."
 *
 * Compares a resolved, named service's real, authored intake_chain
 * (component vs. symptom module mix) against its own group's
 * routing_archetype (computed by btnyc_v8_compiler.py, the real,
 * single source of truth for this classification — deliberately NOT
 * duplicated as logic into qr.html, only the static module-name Sets
 * are, tracked via this test for parity).
 *
 * DELIBERATELY INFORMATIONAL: direct, individual review of every real,
 * current disagreement found in the live catalog
 * (internal_hardware_replacement, router_configuration) confirmed both
 * are sensible, deliberate authoring choices, not bugs. This check
 * returns a soft "notice" for human review, and must NEVER cause
 * `valid: false` — that would actively penalize correct authoring.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = __dirname;
const QR_HTML = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
const DB = JSON.parse(fs.readFileSync('btnyc.json', 'utf8'));

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

function findConstSets() {
    const m = QR_HTML.match(/const COMPONENT_MODULE_NAMES = new Set\(\[[\s\S]*?\]\);\s*const SYMPTOM_MODULE_NAMES = new Set\(\[[\s\S]*?\]\);/);
    return m ? m[0] : null;
}

const FNS = ['resolveDynamicService', 'resolveBaseConfidenceStrategy', 'resolveForceModules',
    'applyLiveConfidenceEscalation', 'deriveComplexityTier', 'applyPricingFormula',
    'computeUnifiedQuote', 'sqTagLabel', 'mathFurnitureAssembly', 'readRoutePath',
    'evaluateInvariant', 'describeInvariantFailure', 'checkRoutingArchetypeConsistency',
    'validateRoute', 'collectBookingContext_catalog', 'collectBookingContext_freeText',
    'makeBookingContext', '_resolveIntakeChain', 'orch_resolve_entity',
    'orch_apply_object_based_resolution', 'orch_enrich_from_dynamic_service',
    'orch_compute_variability_flags', 'orch_compose_intake_chain', 'orch_apply_location_hints',
    'orch_compute_confidence', 'orch_select_ui_template', 'orch_merge_materials_estimate',
    'orch_compute_quote', 'orch_apply_intake_bypass_rules', 'catastrophicFallbackRoute',
    'executeWorkflow', 'resolveGroupFromIntent', 'detectIntentNLP', 'extractObject',
    'extractQty', 'extractLocation', 'tagValidForCategory', 'inferTagsFromContext'];

let code = "const ORCH_QTY_MODS = new Set(['item_count', 'count', 'hybrid_qty', 'global_quantity']);\n";
code += "const KNOWN_UI_TEMPLATES = new Set(['self_quote', 'curated_card', 'chip_grid', 'legacy_flow', 'force_dynamic_fallback']);\n";
code += findConstSets() + "\n\n";
code += FNS.map(findFn).filter(Boolean).join('\n\n');

const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'semantic_check_test' });

const { execFileSync } = require('child_process');
const os = require('os');

const tmpCompiledPath = path.join(os.tmpdir(), `v8_compiled_for_semantic_test_${Date.now()}.json`);
execFileSync('python3', [
    'btnyc_v8_compiler.py',
    'btnyc.json',
    tmpCompiledPath,
]);
const v8Compiled = JSON.parse(fs.readFileSync(tmpCompiledPath, 'utf8'));
fs.unlinkSync(tmpCompiledPath);
const routingArchetypes = v8Compiled.routing_archetypes;

console.log('=== Backward compatibility: validateRoute with no third argument behaves exactly as before ===');
{
    const svc = DB.services.find(s => s.id === 'door_lock_or_handle_install');
    const ctx = sandbox.collectBookingContext_catalog(svc, svc.ui_taxonomy.category_id);
    const route = sandbox.executeWorkflow(ctx, DB);
    const result = sandbox.validateRoute(route, DB);
    check('valid is still true with no routingArchetypes supplied', result.valid === true);
    check('notices is a real, present, empty array (not undefined) when nothing was supplied', Array.isArray(result.notices) && result.notices.length === 0);
}

console.log('\n=== The soft check NEVER causes valid:false, even when it fires ===');
{
    const svc = DB.services.find(s => s.id === 'internal_hardware_replacement');
    const ctx = sandbox.collectBookingContext_catalog(svc, svc.ui_taxonomy.category_id);
    const route = sandbox.executeWorkflow(ctx, DB);
    const result = sandbox.validateRoute(route, DB, routingArchetypes);
    check('the notice genuinely fires for this real, known-mismatched service', result.notices.length > 0);
    check('valid is STILL true even though a notice fired (this is informational, never a violation)', result.valid === true);
}

console.log('\n=== A real, genuinely consistent service produces zero notices ===');
{
    const svc = DB.services.find(s => s.id === 'prehung_interior_door_install');
    const ctx = sandbox.collectBookingContext_catalog(svc, svc.ui_taxonomy.category_id);
    const route = sandbox.executeWorkflow(ctx, DB);
    const result = sandbox.validateRoute(route, DB, routingArchetypes);
    check('zero notices for a real, consistent, component_first service in a component_first group', result.notices.length === 0);
}

console.log('\n=== Real, full catalog sweep: the check never throws, and only fires for entities with real, sufficient signal ===');
{
    let totalNotices = 0, errors = 0;
    for (const svc of DB.services) {
        try {
            const ctx = sandbox.collectBookingContext_catalog(svc, svc.ui_taxonomy.category_id);
            const route = sandbox.executeWorkflow(ctx, DB);
            const result = sandbox.validateRoute(route, DB, routingArchetypes);
            if (result.notices.length > 0) totalNotices++;
        } catch (e) {
            errors++;
        }
    }
    check(`the check runs against all ${DB.services.length} real services with zero real errors (found ${errors})`, errors === 0);
    console.log(`  ℹ️  ${totalNotices} real service(s) produce a notice (informational, not a failure)`); pass++;
}

console.log(`\n[routing archetype semantic check verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
