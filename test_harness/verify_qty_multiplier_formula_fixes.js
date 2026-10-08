#!/usr/bin/env node
/**
 * verify_qty_multiplier_formula_fixes.js
 *
 * A real, 3-part bug family, found and fixed by reconciling this
 * session's own test results against a real screenshot's exact,
 * displayed price ($1225) -- the user directly confirmed the real,
 * live UI's qty×5 multiplier was correct, which meant this session's
 * own code was wrong, not the screenshot.
 *
 * T118 UPDATE: that $1225 "confirmed correct" value has itself been
 * reclassified, not this test's own bug fixes. Confirmed precisely:
 * $1225 = (170 + 75) * 5 -- the per-unit answers (wall_type $25,
 * dmg_size $35, mounting_height $40 -> $170 with base) and the
 * per-visit answers (disposal_request $25, urgency $50 -> $75) were both being
 * multiplied by quantity together, which is exactly
 * PENDING_DECISIONS.md #29's own diagnosed bug -- this screenshot
 * documented a live instance of it, not a case that happened to avoid
 * it. The real, correct price is $925 = ($170 * 5) + $75 -- per-unit
 * fees scale with quantity, per-visit fees (disposal_request, urgency) apply
 * once. This test's own qty=1 case ($245 = $170 + $75) was already,
 * coincidentally correct either way, since multiplying anything by 1
 * doesn't expose the bug -- which is exactly why #29 went unnoticed
 * this long: it only manifests at qty>1.
 *
 * Bug 1 (computeUnifiedQuote): `formulaIsQtyAware = !!formulaResult` --
 * correct in intent (a formula that already scales its own minutes by
 * qty internally shouldn't ALSO get multiplied by the outer qty) but
 * wrong in scope: true for ANY active formula, silently forcing
 * qtyMultiplier to 1 whenever any formula fired, including ones that
 * don't internally handle qty at all (item_count_overflow_formula).
 *
 * Bug 2 (computeArchetypeQuote): the formula/tiered_per_unit branch
 * never applied a qty multiplier at all -- always a single-unit price
 * regardless of requested quantity.
 *
 * Bug 3 (both functions, the real, correct qty-aware set): confirmed
 * directly by reading each real formula's own code, not guessed --
 * furniture_repair_formula, tile_repair_formula, and
 * hardware_install_formula all genuinely, internally scale via their
 * own count-style answer (`parseInt(answers.X) || qty || 1`), the same
 * real pattern under different key names. All three are correctly
 * qty-aware; the other 3 real formulas are not and must receive the
 * outer multiplier.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.join(__dirname, '..');
const QR_HTML = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
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

console.log('=== The real, exact screenshot scenario: the definitive, empirical validation ===');
const wallSvc = DB.services.find(s => s.id === 'wall_hole_or_crack_repair');
function quoteFor(svc, answers, qty) {
    sandbox.S = {
        qty, intent: { key: svc.id, category: svc.ui_taxonomy?.category, label: 'Test' },
        stype: 'Repair', detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: [],
        answers, _tagSynthesizedModules: {}, _tagsAffirmed: true, _svc: svc,
    };
    return sandbox.computeQuoteFromState(sandbox.S);
}
// T147: the count question was re-authored (walls, wired, priced) and project_scale -- which asked the same extent -- was removed from this chain; the scenario keeps its heavy conditions
const wallLabels = wallSvc.intake_chain.find(t => t.module === 'item_count_template').params.client_response.map(r => r.label);
const screenshotAnswers = {
    wall_type: 'Brick or concrete', dmg_size: 'Large (bigger than a sheet of paper)',
    item_count_template: wallLabels[0],
    mounting_height: 'High (8-16 ft, ladder needed)',
    disposal_request: 'Yes, please haul it away', urgency: 'Urgent — today or tomorrow',
};
// R-GOVERN-GOODHART: a sandbox that omits a function the real code calls measures something else. This test once asserted $925 here and passed ONLY because
// its hand-picked function list left out entityHasOwnQtyQuestion (so the guard below did not exist in the sandbox). In the real browser -- original file and
// current build alike -- this scenario prices at $245. The sandbox now loads the engine modules whole (the T136 `_engine.js` loader), and its fidelity is asserted.
check('the sandbox is FAITHFUL: it contains the quantity guard the product has (entityHasOwnQtyQuestion)', typeof sandbox.entityHasOwnQtyQuestion === 'function');
const q5 = quoteFor(wallSvc, screenshotAnswers, 5).laborCalc, q1 = quoteFor(wallSvc, screenshotAnswers, 1).laborCalc;
check(`documented contract (the quantity guard, brief section 3.6): wall_hole_or_crack_repair owns a dedicated quantity question (item_count_template), so an OUTER quantity of 5 does not multiply it -- $${q5} at qty 5 equals $${q1} at qty 1 ($245), as in the real browser. (The $925 once asserted here was the pre-guard T118 contract.)`,
    sandbox.entityHasOwnQtyQuestion(wallSvc) === true && q5 === q1 && q5 === 245);
// T147: a single-unit service (per_unit_answers_vary) prices ONE unit by design, so the contrast must be a BATCHED service that owns no count question and really scales
const plain = DB.services.find(s => s.per_unit_answers_vary !== true && s.financial_engine && s.financial_engine.base_price > 0 && !sandbox.entityHasOwnQtyQuestion(s) && quoteFor(s, {}, 3).laborCalc > quoteFor(s, {}, 1).laborCalc);
check('contrast (so the check above is not vacuous): for a service WITHOUT its own quantity question the outer quantity still multiplies', !!plain && quoteFor(plain, {}, 3).laborCalc > quoteFor(plain, {}, 1).laborCalc, { got: plain && [plain.id, quoteFor(plain, {}, 1).laborCalc, quoteFor(plain, {}, 3).laborCalc] });
check('the same scenario at qty=1 correctly produces $245 (the real, per-unit price)',
    quoteFor(wallSvc, screenshotAnswers, 1).laborCalc === 245);

console.log('\n=== computeArchetypeQuote now genuinely matches computeUnifiedQuote across real qty values (was previously silently wrong for ALL qty>1 formula cases) ===');
const knob = DB.services.find(s => s.id === 'cabinet_knob_or_pull_install');
let knobAllMatch = true;
for (const [qty, type] of [[1, 'Swapping existing hardware (same holes)'], [50, 'Swapping existing hardware (same holes)'], [400, 'Swapping existing hardware (same holes)']]) {
    const r = sandbox.computeArchetypeQuote(knob, 'tiered_per_unit', { install_type: type }, qty, DB);
    const legacy = sandbox.computeUnifiedQuote({ svc: knob, dynDef: null, activeTagIds: [], answers: { install_type: type }, qty, formulaId: knob.pricing_engine });
    if (r.laborEstimate !== legacy.laborEstimate) knobAllMatch = false;
}
check('cabinet_knob_or_pull_install: both calculators genuinely agree at qty 1/50/400', knobAllMatch);

console.log('\n=== Regression guard: the 3 real, confirmed qty-aware formulas correctly do NOT get double-multiplied ===');
const dyn = DB.dynamic_services['minor_home_repairs+Repair'];
const tile5 = sandbox.computeUnifiedQuote({ svc: null, dynDef: dyn, activeTagIds: [], answers: { surface_type: 'Tile (wall or floor)', tile_count: '5', grout_repair: 'No', water_damage: 'No' }, qty: 5, formulaId: 'tile_repair_formula' });
const tile1 = sandbox.computeUnifiedQuote({ svc: null, dynDef: dyn, activeTagIds: [], answers: { surface_type: 'Tile (wall or floor)', tile_count: '1', grout_repair: 'No', water_damage: 'No' }, qty: 1, formulaId: 'tile_repair_formula' });
check(`tile_repair_formula: 5 tiles (via its own internal count) prices sensibly above 1 tile, not multiplied by an ADDITIONAL outer 5x on top ($${tile1.laborEstimate} vs $${tile5.laborEstimate})`,
    tile5.laborEstimate > tile1.laborEstimate && tile5.laborEstimate < tile1.laborEstimate * 5);

console.log(`\n[qty multiplier formula fixes] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
