#!/usr/bin/env node
/**
 * verify_confidence_and_intake_rendering.js
 *
 * Regression test for two real, confirmed production bugs found and fixed
 * in this session:
 *
 * BUG 1: orch_compute_confidence applied an NLP-confidence formula to ALL
 * entry types, including direct catalog taps. Since catalog taps have no
 * NLP matchConfidence (it's null/0), the score formula always returned
 * base_confidence (40) for every named service. Services with
 * minimum_quote_confidence > 40 permanently failed the confidence bar --
 * the estimate button was always disabled on a direct catalog tap.
 * Confirmed: prehung_interior_door_install (minConf: 95), toilet_flapper
 * (minConf: 50), virus_or_malware_removal (minConf: 50) all had
 * meetsConfidenceBar: false on a direct catalog selection.
 *
 * FIX: orch_compute_confidence now accepts entryType. 'catalog' → score 100.
 * 'other_tile' → elevated base + partial NLP bonus. 'free_text' → original
 * NLP formula (base + 0.2 * matchConfidence, unchanged).
 *
 * BUG 2: renderCuratedCardFromRoute (UIRenderer.js) did not accumulate
 * confidence_gain from answered intake modules, and the Add to Request
 * button was always enabled regardless of confidence state. For free_text
 * entries with low initial confidence, this meant the button enabled too
 * early (before enough questions were answered).
 *
 * FIX: renderCuratedCardFromRoute now computes running confidence from
 * answered modules and gates the CTA button accordingly.
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

// Extract functions from qr.html
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
    'catastrophicFallbackRoute', 'executeWorkflow', 'orch_max_followup_questions',
];
const COMPONENT_MODULE_NAMES = new Set();
const SYMPTOM_MODULE_NAMES = new Set();
const ORCH_QTY_MODS = new Set(['item_count', 'count', 'hybrid_qty', 'global_quantity']);
const KNOWN_UI_TEMPLATES = new Set(['self_quote', 'curated_card', 'chip_grid', 'legacy_flow', 'force_dynamic_fallback']);
let code = `const ORCH_QTY_MODS = new Set(${JSON.stringify([...ORCH_QTY_MODS])});\n`;
code += `const KNOWN_UI_TEMPLATES = new Set(${JSON.stringify([...KNOWN_UI_TEMPLATES])});\n`;
code += `const COMPONENT_MODULE_NAMES = new Set();\nconst SYMPTOM_MODULE_NAMES = new Set();\n`;
code += FNS.map(findFn).filter(Boolean).join('\n\n');

const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

console.log('\n=== BUG 1 FIX: catalog entries always get score >= minConf ===');
// v9.6 FIX: all 5 expected values below were stale, superseded by a
// direct, deliberate business decision to standardize
// minimum_quote_confidence by complexity tier (routine=70/skilled=80/
// specialized=90) rather than leave the previous, inconsistent
// per-service/per-archetype values (which ranged 40-95 within the
// same tier). Re-verified each against the current, real data before
// updating, not guessed.
const catalogTests = [
    ['toilet_flapper_or_fill_valve_replacement', 'plumbing_help', 80],
    ['prehung_interior_door_install', 'minor_home_repairs', 80],
    ['virus_or_malware_removal', 'tech_trouble', 80],
    ['dishwasher_repair', 'minor_home_repairs', 90],
    ['door_repair_impact_damage', 'minor_home_repairs', 90],
];
for (const [sid, cat, expectedMinConf] of catalogTests) {
    const svc = DB.services.find(s => s.id === sid);
    const ctx = sandbox.collectBookingContext_catalog(svc, cat);
    const route = sandbox.executeWorkflow(ctx, DB);
    check(`${sid}: score is 100 for catalog entry`, route.confidence.score === 100);
    check(`${sid}: meetsBar is true on direct catalog tap`, route.confidence.score >= route.confidence.minConf);
    check(`${sid}: minConf matches authored strategy (${expectedMinConf})`, route.confidence.minConf === expectedMinConf);
}

console.log('\n=== free_text still uses the NLP formula (not the catalog shortcut) ===');
{
    // Simulate a free_text entry with a known NLP match at 70% confidence
    const ctx = sandbox.makeBookingContext('free_text', {
        selectedCategoryId: 'plumbing_help',
        nlpIntent: { _matchConfidence: 70, category: 'plumbing_help', stype: 'Install' },
    });
    const svc = DB.services.find(s => s.id === 'toilet_flapper_or_fill_valve_replacement');
    const mockResolution = { entity: svc, entityType: 'service' };
    const confState = sandbox.orch_compute_confidence(mockResolution, [], 70, DB, 'free_text');
    // free_text: score = base_confidence(40) + min(20, 70*0.2) = 40 + 14 = 54
    check('free_text with 70% NLP match: score is 54 (not 100)', confState.score === 54);
    check('free_text score is not 100 (would bypass the NLP formula)', confState.score !== 100);
}

console.log('\n=== other_tile gets elevated base (between free_text and catalog) ===');
{
    const svc = DB.services.find(s => s.id === 'toilet_flapper_or_fill_valve_replacement');
    const mockResolution = { entity: svc, entityType: 'service' };
    const confFreeText = sandbox.orch_compute_confidence(mockResolution, [], 0, DB, 'free_text');
    const confOtherTile = sandbox.orch_compute_confidence(mockResolution, [], 0, DB, 'other_tile');
    const confCatalog = sandbox.orch_compute_confidence(mockResolution, [], 0, DB, 'catalog');
    check('free_text (no NLP match) scores lowest', confFreeText.score < confOtherTile.score);
    check('other_tile scores between free_text and catalog', confOtherTile.score > confFreeText.score && confOtherTile.score <= confCatalog.score);
    check('catalog scores 100', confCatalog.score === 100);
}

console.log('\n=== Complexity escalation still raises the bar (not the score) ===');
{
    // #fragile_item has escalate_complexity: 'skilled' -> minConf should rise by 15.
    // (Note: #heavy_item's fee/complexity effects were deliberately retired in v9.5 --
    // see its SSOT note -- weight is now priced via the intake module's own answer
    // effects, not an independent tag. #fragile_item is the tag that still carries
    // escalate_complexity directly.)
    const svc = DB.services.find(s => s.id === 'toilet_flapper_or_fill_valve_replacement');
    const mockResolution = { entity: svc, entityType: 'service' };
    const baseConf = sandbox.orch_compute_confidence(mockResolution, [], 0, DB, 'catalog');
    const escalatedConf = sandbox.orch_compute_confidence(mockResolution, ['#fragile_item'], 0, DB, 'catalog');
    check('catalog score stays 100 regardless of complexity tags', escalatedConf.score === 100);
    // v9.6 FIX: base minConf for this service is now 80 (tier-standardized,
    // inherited from the plumbing_fixture archetype), not the old 50 --
    // so the escalated value is 80+15=95, not 50+15=65.
    check('minConf rises when skilled tag is active (15 delta -> 80+15=95)', escalatedConf.minConf === 95);
    check('meetsBar still true for catalog even with escalation (100 >= 65)', escalatedConf.score >= escalatedConf.minConf);
}

console.log('\n=== The complete catalog: zero services permanently fail confidence bar on catalog tap ===');
{
    let permanentlyBlocked = [];
    for (const svc of DB.services) {
        if (svc.requires_furniture_selection) continue; // legacy_flow, out of scope
        const ctx = sandbox.collectBookingContext_catalog(svc, svc.ui_taxonomy?.category_id);
        const route = sandbox.executeWorkflow(ctx, DB);
        if (route.uiTemplate === 'curated_card' || route.uiTemplate === 'self_quote') {
            const meetsBar = route.confidence.score >= route.confidence.minConf;
            if (!meetsBar) permanentlyBlocked.push(`${svc.id} (score:${route.confidence.score} < minConf:${route.confidence.minConf})`);
        }
    }
    check(`zero services permanently blocked (found ${permanentlyBlocked.length})`, permanentlyBlocked.length === 0);
    if (permanentlyBlocked.length > 0) {
        permanentlyBlocked.forEach(s => console.log('    - ' + s));
    }
}

console.log(`\n[confidence + intake rendering verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
