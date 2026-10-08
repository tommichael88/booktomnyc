#!/usr/bin/env node
/**
 * verify_orchestrator_phase2.js
 *
 * Regression test for Phase 2 of the Orchestrator Overhaul: executeWorkflow
 * and its 6 operation handlers.
 *
 * A real, genuine matrix bug was caught here by actually RUNNING the
 * engine against real data (toilet_install), not by reading the matrix
 * rules on paper: a directly-resolved, real named service with real,
 * unanswered questions but no behavior.bypass_intake flag fell through
 * to the confidence_score<60 catch-all rule (chip_grid/
 * force_dynamic_fallback) -- a rule meant for the genuinely unresolved
 * free-text case, not for an ordinary named service that simply hasn't
 * had its questions answered yet. Fixed by inserting a real rule for
 * that case before the catch-all. This is exactly the kind of thing
 * Phase 5.5 (shadow-mode diffing) exists to catch systematically --
 * this test captures the specific instance found this session.
 *
 * Also verified by hand: the materials-merge math (10.20/31.80 for
 * toilet_install) against the real catalog prices and markup percentage.
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

const FNS = ['resolveDynamicService', 'resolveBaseConfidenceStrategy', 'resolveServiceCheckoutStateKey', 
    'applyLiveConfidenceEscalation', 'deriveComplexityTier', 'applyPricingFormula',
    'buildCheckoutStateModel', 'sqTagLabel', 'tagValidForCategory', 'resolveEngineKey',
    'resolveServiceBadge', 'computeUnifiedQuote', 'computeArchetypeQuote', 'mathFurnitureAssembly', '_resolveIntakeChain', '_isModVisible',
    'resolveGroupFromIntent', 'collectBookingContext_catalog', 'collectBookingContext_freeText',
    'collectBookingContext_otherTile', 'makeBookingContext', 'extractQty', 'extractObject',
    'extractLocation', 'detectIntentNLP', 'orch_resolve_entity', 'orch_apply_object_based_resolution', 'orch_enrich_from_dynamic_service', 'orch_compute_variability_flags',
    'orch_compose_intake_chain', 'orch_apply_location_hints', 'orch_compute_confidence',
    'orch_select_ui_template', 'orch_merge_materials_estimate', 'orch_compute_quote',
    'orch_apply_intake_bypass_rules', 'readRoutePath', 'evaluateInvariant', 'describeInvariantFailure', 'checkRoutingArchetypeConsistency', 'validateRoute', 'catastrophicFallbackRoute', 'executeWorkflow', 'orch_max_followup_questions'];

let code = "const ORCH_QTY_MODS = new Set(['item_count', 'count', 'hybrid_qty', 'global_quantity']);\nconst KNOWN_UI_TEMPLATES = new Set(['self_quote', 'curated_card', 'chip_grid', 'legacy_flow']);\n";
code += FNS.map(findFn).join('\n\n');

code += "const COMPONENT_MODULE_NAMES = new Set(['wall_type','surface_type','door_type','door_style_pref','door_size','client_supplying_door','existing_frame','faucet_type','sink_type','toilet_style_pref','existing_toilet_type','window_type','removal','install_type','existing_type','furn_item','mounting_item','wall_mount_items','item_type','fixture_type','electrical_item','plumbing_fixture','tech_device','computer_component','device_type','laptop_or_desktop','existing_box','ducting','length','distance','weight','mounting_height','tile_condition','waterproof_area','has_matching_tiles','thermostat_type','customer_supplied_part','software_install_type','brand','router_owned','mesh_network','pax_cabinet_count','pax_hinge_count','pax_interior_count','pax_sliding_count']);\n";
code += "const SYMPTOM_MODULE_NAMES = new Set(['symptom','toilet_symptom','tech_problem_type','leak_type','drain_speed','issue','damage_type','device_state','internet_active','tech_issue_source']);\n";

const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'orchestrator' });

console.log('=== Matrix bug fix: a real named service with real, unanswered questions routes to curated_card, not chip_grid ===');
const toiletSvc = DB.services.find(s => s.id === 'toilet_install');
const toiletCtx = sandbox.collectBookingContext_catalog(toiletSvc, 'plumbing_help');
const toiletRoute = sandbox.executeWorkflow(toiletCtx, DB);
check('toilet_install routes to curated_card (NOT chip_grid)', toiletRoute.uiTemplate === 'curated_card');
check('toilet_install entity resolved correctly', toiletRoute.entity?.id === 'toilet_install');
check('toilet_install intake chain includes its real named modules', toiletRoute.intakeChain.some(m => (m.moduleKey || m.module) === 'toilet_style_pref'));
check('toilet_install intake chain includes urgency (plumbing_help\'s own category default -- access was removed catalog-wide, T118 operator-directed, since reachability isn\'t a meaningful, price-changing question for residential handyman work)', toiletRoute.intakeChain.some(m => (m.moduleKey || m.module) === 'urgency'));

console.log('\n=== Genuine self-quote / bypass cases still classify correctly after the matrix fix ===');
// led_bulb_upgrade: genuinely bypass_intake + qty-only chain -> self_quote (unchanged)
const ledSvc = DB.services.find(s => s.id === 'led_bulb_upgrade');
const ledCtx = sandbox.collectBookingContext_catalog(ledSvc, ledSvc.ui_taxonomy.category_id);
const ledRoute = sandbox.executeWorkflow(ledCtx, DB);
check('led_bulb_upgrade -> self_quote (qty-only chain, bypass_intake, no real pricing question)', ledRoute.uiTemplate === 'self_quote');

// cabinet_knob_or_pull_install: was self_quote (bypass_intake) before pricing_archetype:
// tiered_per_unit and the real install_type question were authored. Now correctly routes
// to curated_card to ask "Swapping existing hardware?" before computing the tiered price.
// This is the intended, correct, deliberate behavior as of v9.5 -- not a regression.
// See BACKLOG_CONSOLIDATED.md Section WW for the full design decision history.
const knobSvc = DB.services.find(s => s.id === 'cabinet_knob_or_pull_install');
const knobCtx = sandbox.collectBookingContext_catalog(knobSvc, knobSvc.ui_taxonomy.category_id);
const knobRoute = sandbox.executeWorkflow(knobCtx, DB);
check('cabinet_knob_or_pull_install -> curated_card (pricing_archetype:tiered_per_unit + real install_type question)', knobRoute.uiTemplate === 'curated_card');
check('cabinet_knob_or_pull_install laborEstimate is $140 (tiered flat price, swap tier)', knobRoute.quote?.laborEstimate === 140);
const showerSvc = DB.services.find(s => s.id === 'shower_head_replacement');
const showerCtx = sandbox.collectBookingContext_catalog(showerSvc, showerSvc.ui_taxonomy.category_id);
const showerRoute = sandbox.executeWorkflow(showerCtx, DB);
check('shower_head_replacement (real non-qty question, bypass_intake set) -> curated_card, NOT self_quote (must still ask its real question)',
    showerRoute.uiTemplate === 'curated_card');

console.log('\n=== Materials merge math verified by hand against real catalog prices ===');
check('toilet_install materialsEstimate.min matches hand-computed value (10.2)', Math.abs(toiletRoute.materialsEstimate.min - 10.2) < 0.01);
check('toilet_install materialsEstimate.max matches hand-computed value (31.8)', Math.abs(toiletRoute.materialsEstimate.max - 31.8) < 0.01);
check('legacy note text is preserved verbatim even though the catalog-derived range won (content updated -- the original note was found to be severely misleading, describing a $100-400 toilet price beside a materials figure that explicitly excludes the toilet; see BACKLOG_CONSOLIDATED.md Section VV)',
    toiletRoute.materialsEstimate.note.includes('Does NOT include the toilet itself'));

console.log('\n=== Quote computation reaches the single, real pricing engine (no separate _computePrice) ===');
check('quote.dispatchFee is present and matches the real SSOT value', toiletRoute.quote?.dispatchFee === DB.global_rules?.surcharges?.dispatch_fee);
check('quote.laborEstimate is a real, positive number', toiletRoute.quote?.laborEstimate > 0);

console.log('\n=== Trace log (Phase 7 groundwork) records every step ===');
check('trace has 9 entries: the 8 real workflow steps + Phase 3\'s intake_bypass_rules', toiletRoute.trace.length === 9);
check('trace entries have the real shape (step_id, operation, output_summary)',
    toiletRoute.trace.every(t => 'step_id' in t && 'operation' in t && 'output_summary' in t));

console.log(`\n[Phase 2 Orchestrator engine verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
