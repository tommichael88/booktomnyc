#!/usr/bin/env node
/**
 * verify_waterproof_area_formula_fix.js
 *
 * Real bug found via §6E's own question-count audit (PENDING_DECISIONS.md
 * item #17): `waterproof_area` already had a real, authored modifier
 * (`waterproof_area_yes_requires_membrane`, $30/45min) consumed correctly
 * by the generic per-answer `modifier_ref` loop in computeUnifiedQuote --
 * but that loop only runs `if (!formulaResult)`, so it's silently skipped
 * whenever a pricing formula is active. The dynamic-services "Tile"
 * branch (minor_home_repairs+Repair) activates `tile_repair_formula` via
 * `surface_type`'s own `formula_override`, so waterproof_area's real
 * modifier never actually reached that specific path -- a real, silent
 * undercharge for wet-area tile jobs routed through the dynamic-service
 * path specifically.
 *
 * Named services with no formula_override (e.g. `loose_tile_replacement`)
 * were never affected -- they correctly use the generic mechanism, which
 * this fix does not touch or duplicate.
 *
 * Honest process note, kept here rather than only in TIMELINE.md: an
 * earlier draft of this fix authored a brand-new, different-valued
 * modifier (`tile_membrane`, $35/30min) before the real, existing one
 * was found -- corrected to reference the real modifier before this test
 * was written, so this suite covers the corrected, real fix only.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.join(__dirname, '..');
const QR_HTML = require('./_page.js').readPage(path.join(REPO_ROOT, 'qr.html'));
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

function _cherryPickFn(name) {
    const m = QR_HTML.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) throw new Error(`Could not find function: ${name}`);
    let depth = 0, start = m.index, i = m.index + m[0].length - 1;
    for (let j = i; j < QR_HTML.length; j++) {
        if (QR_HTML[j] === '{') depth++;
        else if (QR_HTML[j] === '}') { depth--; if (depth === 0) return QR_HTML.slice(start, j + 1); }
    }
}
// T190 (#138 I3): the engine modules are loaded whole (T136, test_harness/_engine.js) so a helper added next to a cherry-picked function can never go missing from this sandbox;
// a function the modules do not declare still goes through this test's own extractor.
const { engineAwareFindFn } = require('./_engine.js');
const findFn = engineAwareFindFn(_cherryPickFn);

const FNS = ['syncTagSynthesizedAnswers', '_isModVisible',
    'resolveDynamicService', 'resolveBaseConfidenceStrategy', 'resolveServiceCheckoutStateKey', 
    'applyLiveConfidenceEscalation', 'resolveSkillTier', 'priceAddedTime', 'splitAddedTimeDollars', 'applyPricingFormula',
    'buildCheckoutStateModel', 'sqTagLabel', 'tagValidForCategory', 'resolveEngineKey',
    'resolveServiceBadge', 'computeUnifiedQuote', 'computeArchetypeQuote', 'computeQuoteFromState'];
const code = FNS.map(findFn).join('\n\n');
const sandbox = { DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

console.log('=== Real modifier data, checked directly rather than assumed ===');
const realModifier = DB.global_rules.modifiers['waterproof_area_yes_requires_membrane'];
check('the real, existing waterproof_area modifier is still exactly $30/45min (not a value this fix invented)',
    realModifier && realModifier.fee === 30 && realModifier.minutes === 45);
const pf = DB.pricing_formulas.tile_repair_formula;
check('tile_repair_formula references the REAL, existing modifier_ref, not a new/duplicate one',
    pf.membrane_modifier_ref === 'waterproof_area_yes_requires_membrane');

function runDynamicTile(waterproofVal) {
    sandbox.S = {
        qty: 1, intent: { key: 'minor_home_repairs+Repair', category: 'minor_home_repairs', label: 'Test', dynamic_rule: 'tile_repair_formula' },
        stype: 'Repair', detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: [],
        answers: {
            surface_type: 'Tile (wall or floor)', item_count_template: '1', waterproof_area: waterproofVal,
            has_matching_tiles: 'Yes', grout_repair: 'No', water_damage: 'No',
            ceiling_height: 'No, standard reach', disposal: "No, I'll handle disposal",
        },
        _tagSynthesizedModules: {}, _tagsAffirmed: true,
    };
    return sandbox.computeQuoteFromState(sandbox.S);
}

console.log('\n=== The real bug: the dynamic-service "Tile" path, which activates tile_repair_formula ===');
const dynNo = runDynamicTile('No');
const dynYes = runDynamicTile('Yes (Requires membrane)');
check('dynamic-service Tile path: selecting the membrane answer now genuinely raises the price (was previously a silent no-op)',
    dynYes.laborCalc > dynNo.laborCalc);
check('dynamic-service Tile path: the real $30 fee is visible in the fee breakdown, sourced from the formula (not duplicated from the generic mechanism)',
    dynYes.feeBreakdown.some(f => f.fee === 30 && f.source === 'formula'));
check('dynamic-service Tile path: exactly one membrane-related fee entry, not double-counted',
    dynYes.feeBreakdown.filter(f => f.fee === 30).length === 1);

function runNamedService(waterproofVal) {
    const svc = DB.services.find(s => s.id === 'loose_tile_replacement');
    sandbox.S = {
        qty: 1, intent: { key: svc.id, category: svc.ui_taxonomy?.category, label: 'Test' },
        stype: 'Repair', detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: [],
        answers: { tile_condition: DB.intake_modules.tile_condition.client_response[0].label, waterproof_area: waterproofVal, has_matching_tiles: 'Yes' },
        _tagSynthesizedModules: {}, _tagsAffirmed: true, _svc: svc,
    };
    return sandbox.computeQuoteFromState(sandbox.S);
}

console.log('\n=== Regression guard: the named service (loose_tile_replacement) was already correct via the generic mechanism -- confirm this fix did not change or duplicate its behavior ===');
const namedNo = runNamedService('No');
const namedYes = runNamedService('Yes (Requires membrane)');
check('named service: membrane answer still correctly raises the price (unchanged, pre-existing behavior)',
    namedYes.laborCalc > namedNo.laborCalc);
// T190 (#138 I3): this read the fee as sourced from "answer" (the generic per-answer loop). T135+ (#65) moved loose_tile_replacement onto tile_repair_formula, whose own branch now carries the
// waterproof_area modifier -- the service's own note records it ("handled by the formula's own equivalent branch ... confirmed still firing"). The guard it is for -- one $30 entry, not two --
// is the next check; here the source is the formula, and the generic mechanism must NOT also add it.
check('named service: the real $30 fee is sourced from "formula" (T135+: the tile formula carries the modifier), and no "answer" entry duplicates it',
    namedYes.feeBreakdown.some(f => f.fee === 30 && f.source === 'formula') && !namedYes.feeBreakdown.some(f => f.fee === 30 && f.source === 'answer'));
check('named service: exactly one membrane-related fee entry, not double-counted',
    namedYes.feeBreakdown.filter(f => f.fee === 30).length === 1);

console.log(`\n[waterproof_area formula fix] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
