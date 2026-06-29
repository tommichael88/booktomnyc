#!/usr/bin/env node
/**
 * verify_self_quote_ui_template_invariant.js
 *
 * Regression test for a real, two-part bug found while extending the
 * Phase 6/7 orchestrator rewire from the self-quote entry point to the
 * curated-card entry point.
 *
 * THE REAL INVARIANT: for any service the orchestrator resolves to
 * something other than legacy_flow, legacyDetermineSelfQuoting(svc)
 * (the already-verified, real legacy self-quote eligibility check) must
 * agree EXACTLY with whether executeWorkflow resolves uiTemplate to
 * 'self_quote'. If they disagree, either a customer who should see a
 * one-tap self-quote button gets a (potentially wrong) curated card
 * instead, or vice versa — silently showing/hiding real questions.
 *
 * BUG 1 (too narrow): chain_is_pure_quantity never treated
 * item_count_template as a quantity module, while a separate flag
 * (chain_has_real_non_quantity_question) correctly did via an ad-hoc
 * exception. This internal inconsistency meant 10 real services (e.g.
 * dimmer_switch_install — a qty-only chain using item_count_template,
 * not bypass_intake-eligible) fell through every real ui_template_matrix
 * rule to the chip_grid catch-all, silently hiding their one real,
 * designed question.
 *
 * BUG 2 (the first fix was too broad): a first attempt added a blanket
 * behavior.bypass_intake requirement to fix bug 1, but this incorrectly
 * excluded a real, different case: blinds_shades_curtains_buy_the_hour
 * (global_quantity, no bypass_intake) is genuinely, correctly self-quote
 * eligible under the legacy code's real, two-clause logic — only the
 * item_count_template-specific clause requires bypass_intake; the
 * unconditional-qty-module clause never did. Found by running a complete
 * catalog sweep against the legacy function, not assumed correct after
 * the first fix passed its own, narrower test case.
 *
 * FINAL, CORRECT FIX: chain_is_pure_quantity now has two, precisely-scoped
 * sub-conditions matching the legacy code's real structure exactly.
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
    'legacyDetermineSelfQuoting', 'orch_resolve_entity', 'orch_apply_object_based_resolution',
    'orch_enrich_from_dynamic_service', 'orch_compute_variability_flags',
    'orch_compose_intake_chain', 'orch_apply_location_hints', 'orch_compute_confidence',
    'orch_select_ui_template', 'orch_merge_materials_estimate', 'orch_compute_quote',
    'orch_apply_intake_bypass_rules', 'readRoutePath', 'evaluateInvariant',
    'describeInvariantFailure', 'checkRoutingArchetypeConsistency', 'validateRoute', 'catastrophicFallbackRoute', 'executeWorkflow'];
let code = "const ORCH_QTY_MODS = new Set(['item_count', 'count', 'hybrid_qty', 'global_quantity']);\nconst KNOWN_UI_TEMPLATES = new Set(['self_quote', 'curated_card', 'chip_grid', 'legacy_flow']);\n";
code += FNS.map(findFn).join('\n\n');
const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'self_quote_invariant' });

console.log('=== Bug 1\'s exact, real, originally-broken services now correctly resolve to curated_card ===');
const bug1Services = ['cabinet_door_or_drawer_adjustment', 'dimmer_switch_install', 'gfci_outlet_replacement',
    'smart_plug_configuration', 'smart_switch_install', 'squeaky_floor_repair', 'usb_outlet_install',
    'window_draft_sealing', 'window_screen_repair', 'wi_fi_extender_setup'];
for (const sid of bug1Services) {
    const svc = DB.services.find(s => s.id === sid);
    const ctx = sandbox.collectBookingContext_catalog(svc, svc.ui_taxonomy.category_id);
    const route = sandbox.executeWorkflow(ctx, DB);
    check(`${sid} -> curated_card (not chip_grid)`, route.uiTemplate === 'curated_card');
}

console.log('\n=== Bug 2\'s exact, real case (the over-broad first fix) still correctly resolves to self_quote ===');
{
    const svc = DB.services.find(s => s.id === 'blinds_shades_curtains_buy_the_hour');
    const ctx = sandbox.collectBookingContext_catalog(svc, svc.ui_taxonomy.category_id);
    const route = sandbox.executeWorkflow(ctx, DB);
    check('blinds_shades_curtains_buy_the_hour -> self_quote (global_quantity, no bypass_intake required)', route.uiTemplate === 'self_quote');
}

console.log('\n=== The 3 real, original self-quote services remain correct ===');
for (const sid of ['cabinet_knob_or_pull_install', 'door_lock_or_handle_install', 'led_bulb_upgrade']) {
    const svc = DB.services.find(s => s.id === sid);
    const ctx = sandbox.collectBookingContext_catalog(svc, svc.ui_taxonomy.category_id);
    const route = sandbox.executeWorkflow(ctx, DB);
    check(`${sid} -> self_quote`, route.uiTemplate === 'self_quote');
}

console.log('\n=== THE REAL, PERMANENT INVARIANT: zero mismatches across the COMPLETE, real catalog (all services) ===');
{
    let mismatches = [];
    let chipGridMismatches = [];
    for (const svc of DB.services) {
        const ctx = sandbox.collectBookingContext_catalog(svc, svc.ui_taxonomy.category_id);
        const route = sandbox.executeWorkflow(ctx, DB);
        if (route.uiTemplate === 'legacy_flow') continue; // legacy_flow is a separate, correctly-handled case
        const legacySelfQuote = sandbox.legacyDetermineSelfQuoting(svc);
        const orchSelfQuote = route.uiTemplate === 'self_quote';
        if (legacySelfQuote !== orchSelfQuote) {
            mismatches.push(`${svc.id} (legacy=${legacySelfQuote}, orchestrator=${route.uiTemplate})`);
        }
        // v9.5: this looser check alone was confirmed INSUFFICIENT during
        // this fix's own second iteration -- it would pass even if a real
        // service incorrectly routed to chip_grid (chip_grid !== self_quote
        // is still consistent with legacySelfQuote===false). Every real,
        // directly-resolved service (a real catalog entity, not a
        // free-text/low-confidence case) should land on either self_quote
        // or curated_card -- chip_grid is reserved for the genuinely
        // unresolved/low-confidence case, never for a real, directly-
        // tapped catalog service.
        if (!orchSelfQuote && route.uiTemplate !== 'curated_card') {
            chipGridMismatches.push(`${svc.id} -> ${route.uiTemplate} (should be curated_card)`);
        }
    }
    check(`zero real mismatches across all ${DB.services.length} real, current services (found ${mismatches.length})`, mismatches.length === 0);
    if (mismatches.length) mismatches.forEach(m => console.log(`    ${m}`));
    check(`zero real services incorrectly land on chip_grid/anything-other-than-curated_card when not self_quote (found ${chipGridMismatches.length})`, chipGridMismatches.length === 0);
    if (chipGridMismatches.length) chipGridMismatches.forEach(m => console.log(`    ${m}`));
}

console.log(`\n[Self-quote / curated_card UI template invariant verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
