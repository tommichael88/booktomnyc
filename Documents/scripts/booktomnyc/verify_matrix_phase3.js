#!/usr/bin/env node
/**
 * verify_matrix_phase3.js
 *
 * Regression test for the remainder of Phase 3 (the parts not already
 * covered by ui_template_matrix in Phase 2): intake_bypass_rules and
 * fallback_routing_rules. Both formalize already-correct legacy logic
 * (uncoveredTypes.length===1 type-selection skip; the 3-tier category/
 * group/no-match fallback chain) as explicit, auditable SSOT rules
 * rather than inline code discoverable only by reading the builder
 * functions directly.
 *
 * Also covers a real gap caught while building this: collectBookingContext_
 * otherTile never carried forward tile.uncovered_service_types at all,
 * which intake_bypass_rules genuinely needs — fixed by adding the field
 * to both the collector and the BookingContext schema.
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

console.log('=== Phase 3 SSOT structure exists and validates ===');
check('workflow.intake_bypass_rules exists', !!DB.workflow?.intake_bypass_rules);
check('workflow.fallback_routing_rules exists', !!DB.workflow?.fallback_routing_rules);
check('schema validates both new condition_map nodes', !!SCHEMA.properties?.workflow?.properties?.intake_bypass_rules && !!SCHEMA.properties?.workflow?.properties?.fallback_routing_rules);
check('booking_context schema includes uncoveredServiceTypes', !!SCHEMA.$defs?.booking_context?.properties?.uncoveredServiceTypes);

const FNS = ['resolveDynamicService', 'resolveBaseConfidenceStrategy', 'resolveForceModules',
    'applyLiveConfidenceEscalation', 'deriveComplexityTier', 'applyPricingFormula',
    'resolveCheckoutState', 'sqTagLabel', 'tagValidForCategory', 'resolveEngineKey',
    'resolveServiceBadge', 'computeUnifiedQuote', '_resolveIntakeChain', '_isModVisible',
    'resolveGroupFromIntent', 'collectBookingContext_otherTile', 'makeBookingContext',
    'orch_resolve_entity', 'orch_apply_object_based_resolution', 'orch_enrich_from_dynamic_service', 'orch_compute_variability_flags', 'orch_compose_intake_chain',
    'orch_apply_location_hints', 'orch_compute_confidence', 'orch_select_ui_template',
    'orch_merge_materials_estimate', 'orch_compute_quote', 'orch_apply_intake_bypass_rules', 'readRoutePath', 'evaluateInvariant', 'describeInvariantFailure', 'checkRoutingArchetypeConsistency', 'validateRoute', 'catastrophicFallbackRoute',
    'executeWorkflow'];
let code = "const ORCH_QTY_MODS = new Set(['item_count', 'count', 'hybrid_qty', 'global_quantity']);\nconst KNOWN_UI_TEMPLATES = new Set(['self_quote', 'curated_card', 'chip_grid', 'legacy_flow']);\n";
code += FNS.map(findFn).join('\n\n');
const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'phase3' });

console.log('\n=== intake_bypass_rules: real single-type case skips type selection ===');
const tile1 = { _isOtherTile: true, uncovered_service_types: ['Mount'], service_type: 'Mount', ui_taxonomy: { group_id: 'wall_mounting_tv_flatscreen' } };
const ctx1 = sandbox.collectBookingContext_otherTile(tile1, 'wall_mounting');
check('collectBookingContext_otherTile carries forward uncoveredServiceTypes', JSON.stringify(ctx1.uncoveredServiceTypes) === JSON.stringify(['Mount']));
const route1 = sandbox.executeWorkflow(ctx1, DB);
check('single uncovered type -> skipTypeSelection: true', route1.skipTypeSelection === true);
check('single uncovered type -> preseededAction matches the one real type', route1.preseededAction === 'Mount');

console.log('\n=== intake_bypass_rules: real multi-type case does NOT skip (genuinely ambiguous) ===');
const tile2 = { _isOtherTile: true, uncovered_service_types: ['Diagnostic', 'Mount', 'Repair'], service_type: 'Repair', ui_taxonomy: { group_id: 'minor_home_repairs_appliances_stove_range' } };
const ctx2 = sandbox.collectBookingContext_otherTile(tile2, 'minor_home_repairs');
const route2 = sandbox.executeWorkflow(ctx2, DB);
check('3 uncovered types -> skipTypeSelection: false', route2.skipTypeSelection === false);
check('3 uncovered types -> preseededAction is null (genuinely ambiguous, must ask)', route2.preseededAction === null);

console.log('\n=== fallback_routing_rules: documents the real, already-correct 3-tier chain ===');
const rules = DB.workflow.fallback_routing_rules.rules;
check('rule 1: category+group both resolved -> routes to dynamic_services via synthetic Other tile',
    rules.some(r => r.if.has_category === true && r.if.has_group === true && r.then.route_to === 'dynamic_services'));
check('rule 2: category only -> routes to the generic wizard, never guesses a group', 
    rules.some(r => r.if.has_category === true && r.if.has_group === false && r.then.route_to === 'generic_wizard'));
check('rule 3: no category -> routes to intent_mappings.default_fallback',
    rules.some(r => r.if.has_category === false && r.then.route_to === 'intent_mappings.default_fallback'));
check('absolute fallback never silently fails -- always resolves to SOME bookable path',
    DB.workflow.fallback_routing_rules.fallback?.route_to === 'generic_wizard');

console.log(`\n[Phase 3 matrix verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
