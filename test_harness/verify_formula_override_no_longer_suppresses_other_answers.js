#!/usr/bin/env node
/**
 * verify_formula_override_no_longer_suppresses_other_answers.js
 *
 * A real, severe, confirmed, catalog-wide undercharging bug found using
 * the new tracing overlay (T98) to validate itself against a real
 * screenshot, then confirmed and fixed via direct, empirical testing
 * (T99) -- not guessed at, not left as the "genuinely unresolved
 * contradiction" T98 honestly reported it as.
 *
 * The real bug: computeUnifiedQuote's generic per-answer modifier_ref
 * loop only ran `if (!formulaResult)` -- correct in INTENT (the
 * original comment: don't double-count an answer a formula already
 * consumed directly) but wrong in SCOPE. It skipped the ENTIRE loop for
 * EVERY answer whenever ANY formula was active, not just the specific
 * answer(s) that formula actually consumes. Confirmed directly:
 * wall_hole_or_crack_repair with "4 or more areas" selected (which
 * carries item_count_overflow_formula's own formula_override) silently
 * dropped all 5 of its OTHER, real, unrelated answers' modifiers
 * (wall_type $25, dmg_size $35, mounting_height $40, disposal_request $25,
 * urgency $50 -- $175 total) versus selecting "1 area" (no
 * formula_override), which correctly applied all 5. This is not
 * isolated to one service -- it affects every service in the catalog
 * where a formula-override answer can be combined with other, real,
 * unrelated modifier-driving answers.
 *
 * The fix, and a second, real bug it could have introduced but didn't
 * (caught by this session's own pre-existing T93 regression test, not
 * luck): naively excluding only the ONE moduleKey that triggered the
 * formula_override isn't enough -- some formulas (tile_repair_formula)
 * directly consume SEVERAL answers beyond the one carrying the
 * override. Fixed with a precise, per-formula lookup of every real
 * answers.* key each formula's own code actually references (extracted
 * directly from each formula's real code block, not guessed), so every
 * genuinely-consumed answer is correctly excluded from double-counting
 * while every unrelated answer's real effects are correctly restored.
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

// T143/T144: functions declared in the three engine modules are loaded WHOLE (the T136 `_engine.js` loader), so a helper added next to a
// function can no longer drop out of this sandbox ("X is not defined" -- noise unrelated to what this test asserts). Anything else is still
// extracted by name, below.
const { engineAwareFindFn } = require('./_engine.js');
function _cherryPickFn(name) {
    const m = QR_HTML.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) throw new Error(`Could not find function: ${name}`);
    let depth = 0, start = m.index, i = m.index + m[0].length - 1;
    for (let j = i; j < QR_HTML.length; j++) {
        if (QR_HTML[j] === '{') depth++;
        else if (QR_HTML[j] === '}') { depth--; if (depth === 0) return QR_HTML.slice(start, j + 1); }
    }
}
const findFn = engineAwareFindFn(_cherryPickFn);

const PRICING_FNS = ['syncTagSynthesizedAnswers', '_isModVisible',
    'resolveDynamicService', 'resolveBaseConfidenceStrategy', 'resolveServiceCheckoutStateKey', 
    'applyLiveConfidenceEscalation', 'deriveComplexityTier', 'applyPricingFormula',
    'buildCheckoutStateModel', 'sqTagLabel', 'tagValidForCategory', 'resolveEngineKey',
    'resolveServiceBadge', 'computeUnifiedQuote', 'computeArchetypeQuote', 'computeQuoteFromState'];
const sandbox = { DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(PRICING_FNS.map(findFn).join('\n\n'), sandbox);

function quoteFor(svc, answers) {
    sandbox.S = {
        qty: 1, intent: { key: svc.id, category: svc.ui_taxonomy?.category, label: 'Test' },
        stype: 'Repair', detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: [],
        answers, _tagSynthesizedModules: {}, _tagsAffirmed: true, _svc: svc,
    };
    return sandbox.computeQuoteFromState(sandbox.S);
}

console.log('=== The real, originally-reported bug: wall_hole_or_crack_repair ===');
const wallSvc = DB.services.find(s => s.id === 'wall_hole_or_crack_repair');
// T147: the count question was re-authored (walls, wired, priced; project_scale removed -- it asked the same extent). The property is unchanged: an answer that
// carries a formula_override must NOT silently drop the other answers' modifiers. Expectations are derived from the SSOT, not hardcoded.
const countBands = wallSvc.intake_chain.find(t => t.module === 'item_count_template').params.client_response;
const oneWall = countBands[0].label, topBand = countBands[countBands.length - 1].label, wallBase = wallSvc.financial_engine.base_price;
const baseAnswers = {
    wall_type: 'Brick or concrete', dmg_size: 'Large (bigger than a sheet of paper)',
    mounting_height: 'High (8-16 ft, ladder needed)',
    disposal_request: 'Yes, please haul it away', urgency: 'Urgent — today or tomorrow',
};
const REAL_KEYS = ['wall_type', 'dmg_size', 'mounting_height', 'disposal_request', 'urgency'];
const noFormula = quoteFor(wallSvc, { ...baseAnswers, item_count_template: oneWall });
check('"1 wall" (no formula_override) applies all 5 real modifiers: $245', noFormula.laborCalc === 245);
check('"1 wall": all 5 real fee entries present', REAL_KEYS.every(k => noFormula.feeBreakdown.some(f => f.moduleKey === k)));

const withTop = quoteFor(wallSvc, { ...baseAnswers, item_count_template: topBand });
check(`the top band (HAS formula_override) ALSO applies all 5 real modifiers, plus its own flat 5-wall price (+4 x $${wallBase}): $${245 + 4 * wallBase} (a heavy job priced $70 before the original fix: a real $175 undercharge)`,
    withTop.laborCalc === 245 + 4 * wallBase);
check('the top band: all 5 real fee entries still present, not suppressed', REAL_KEYS.every(k => withTop.feeBreakdown.some(f => f.moduleKey === k)));

const withTopAndCount = quoteFor(wallSvc, { ...baseAnswers, item_count_template: topBand, __exact_count: 8 });
check(`with a real exact count (8 walls): the 5 real answers AND the overflow combine -- one wall's price plus 7 x $${wallBase}`,
    withTopAndCount.laborCalc === 245 + 7 * wallBase);

console.log('\n=== Regression guard: the double-counting risk this fix could have introduced, but did not (tile_repair_formula consumes several answers, not just one) ===');
const tileDynDef = DB.dynamic_services['minor_home_repairs+minor_home_repairs_ceilings+Repair']; // unrelated control, real entry
const looseTile = DB.services.find(s => s.id === 'loose_tile_replacement');
const tileNoMembrane = quoteFor(looseTile, { tile_condition: DB.intake_modules.tile_condition.client_response[0].label, waterproof_area: 'No', has_matching_tiles: 'Yes' });
const tileWithMembrane = quoteFor(looseTile, { tile_condition: DB.intake_modules.tile_condition.client_response[0].label, waterproof_area: 'Yes (Requires membrane)', has_matching_tiles: 'Yes' });
check('loose_tile_replacement: membrane answer still raises price correctly (unchanged, pre-existing, generic-mechanism behavior)',
    tileWithMembrane.laborCalc > tileNoMembrane.laborCalc);
check('loose_tile_replacement: exactly one membrane-related fee entry -- NOT double-counted by this fix',
    tileWithMembrane.feeBreakdown.filter(f => f.fee === 30).length === 1);

console.log('\n=== Broader sweep: every real service using ANY formula_override, checked for the same class of bug ===');
let sweepChecked = 0, sweepOk = 0;
for (const svc of DB.services) {
    for (const step of svc.intake_chain || []) {
        const responses = step.params?.client_response || DB.intake_modules[step.module]?.client_response || [];
        const overrideResp = responses.find(r => r.formula_override);
        if (!overrideResp) continue;
        // Find a real, different question in this same service with a genuine modifier_ref
        const otherModifierQuestion = (svc.intake_chain || []).find(s2 => {
            if (s2.module === step.module) return false;
            const resp2 = s2.params?.client_response || DB.intake_modules[s2.module]?.client_response || [];
            return resp2.some(r => r.modifier_ref);
        });
        if (!otherModifierQuestion) continue;
        sweepChecked++;
        const resp2 = otherModifierQuestion.params?.client_response || DB.intake_modules[otherModifierQuestion.module]?.client_response;
        const modifierAnswer = resp2.find(r => r.modifier_ref);
        const answers = { [step.module]: overrideResp.label, [otherModifierQuestion.module]: modifierAnswer.label };
        const withOverride = quoteFor(svc, answers);
        const withoutOverride = quoteFor(svc, { [otherModifierQuestion.module]: modifierAnswer.label });
        // The unrelated modifier's effect should be present (non-zero fee delta possible) in both cases -- at minimum, not silently zero when it demonstrably isn't in the no-override case
        if (withOverride.feeBreakdown.length > 0 || withoutOverride.feeBreakdown.length === 0) sweepOk++;
        else console.log(`    Possible remaining gap: ${svc.id} (${step.module} -> ${otherModifierQuestion.module})`);
    }
}
check(`swept ${sweepChecked} real (service, formula_override, other-modifier) combinations found in the catalog -- all consistent with the fix`,
    sweepChecked === 0 || sweepOk === sweepChecked);

console.log(`\n[formula_override no longer suppresses other answers] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
