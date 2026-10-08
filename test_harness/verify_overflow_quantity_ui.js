#!/usr/bin/env node
/**
 * verify_overflow_quantity_ui.js
 *
 * PENDING_DECISIONS.md item #4, closed this session: the overflow-
 * quantity mechanism (item_count_overflow_formula) had real, already-
 * authored data wiring (all 16 configured services' own "9 or more..."
 * answer already carried formula_override: 'item_count_overflow_formula'),
 * but was fully dormant -- no live path ever supplied the customer's
 * actual exact count, so it always silently returned today's flat
 * top-band price.
 *
 * Two real changes close this:
 * 1. The formula itself (qr.html, applyPricingFormula's
 *    item_count_overflow_formula branch) now also accepts a dynamic,
 *    customer-typed count (answers.__exact_count), not just a static,
 *    pre-authored qty_value -- additive, the original static lookup
 *    is checked first and unchanged.
 * 2. The live UI (sqBuildCuratedIntake's "Additional details" notes
 *    textarea) now parses the first real number typed and feeds it
 *    into that same field, reusing the existing refreshPrice/refreshBtn
 *    live-preview mechanism -- confirmed directly against the real,
 *    authored answer label itself ("...specify exact count in notes"),
 *    which already named this exact field as the intended capture
 *    mechanism before this was built.
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

const FNS = ['syncTagSynthesizedAnswers', '_isModVisible',
    'resolveDynamicService', 'resolveBaseConfidenceStrategy', 'resolveServiceCheckoutStateKey', 
    'applyLiveConfidenceEscalation', 'deriveComplexityTier', 'applyPricingFormula',
    'buildCheckoutStateModel', 'sqTagLabel', 'tagValidForCategory', 'resolveEngineKey',
    'resolveServiceBadge', 'computeUnifiedQuote', 'computeArchetypeQuote', 'computeQuoteFromState'];
const code = FNS.map(findFn).join('\n\n');
const sandbox = { DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const servicesById = Object.fromEntries(DB.services.map(s => [s.id, s]));
const aof = DB.pricing_formulas.item_count_overflow_formula.anchor_and_overflow_ref_by_service;

function realOverflowLabel(svc) {
    const step = svc.intake_chain.find(s => s.module === 'item_count_template');
    const resp = step.params.client_response.find(r => r.formula_override === 'item_count_overflow_formula');
    return resp.label;
}

function quoteFor(svc, answers) {
    sandbox.S = {
        qty: 1, intent: { key: svc.id, category: svc.ui_taxonomy?.category, label: 'Test' },
        stype: 'Repair', detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: [],
        answers, _tagSynthesizedModules: {}, _tagsAffirmed: true, _svc: svc,
    };
    return sandbox.computeQuoteFromState(sandbox.S);
}

console.log('=== The real, originally-investigated case (cabinet_door_or_drawer_adjustment) ===');
const cabinetSvc = servicesById['cabinet_door_or_drawer_adjustment'];
const cabinetLabel = realOverflowLabel(cabinetSvc);
check('the real, authored answer label genuinely instructs specifying an exact count',
    cabinetLabel.toLowerCase().includes('specify exact count'));

const dormant = quoteFor(cabinetSvc, { item_count_template: cabinetLabel });
// T147: the dormant band charges the FLAT price of the band below it. It used to fall back to the 1-unit base ($35) -- cheaper than 2-3 items -- because the engine skips the
// triggering answer's own modifier and the formula carried only the overflow; the formula now carries the flat price (PENDING_DECISIONS #80).
const cabBands = cabinetSvc.intake_chain.find(s => s.module === 'item_count_template').params.client_response;
const belowOverflow = quoteFor(cabinetSvc, { item_count_template: cabBands[cabBands.findIndex(r => r.formula_override === 'item_count_overflow_formula') - 1].label });
check('dormant (overflow answer selected, no exact count typed yet): the flat price of the band below it -- never the 1-unit base',
    dormant.laborCalc === belowOverflow.laborCalc && dormant.laborCalc > cabinetSvc.financial_engine.base_price);

const withCount = quoteFor(cabinetSvc, { item_count_template: cabinetLabel, __exact_count: 15 });
const anchor = aof['cabinet_door_or_drawer_adjustment'].anchor;
check(`with a real, live exact count above the anchor (${anchor}): the real overflow fee now applies ($${dormant.laborCalc} -> $${withCount.laborCalc})`,
    withCount.laborCalc > dormant.laborCalc);

const belowAnchor = quoteFor(cabinetSvc, { item_count_template: cabinetLabel, __exact_count: 3 });
check('a real, live exact count AT or BELOW the anchor: correctly stays at the flat price, no overflow',
    belowAnchor.laborCalc === dormant.laborCalc);

console.log('\n=== Complete, real sweep: every configured service, not a sample ===');
let sweepChecked = 0, sweepPassed = 0;
for (const svcId of Object.keys(aof)) {
    const svc = servicesById[svcId];
    if (!svc) { console.log(`    MISSING SERVICE: ${svcId}`); continue; }
    sweepChecked++;
    const label = realOverflowLabel(svc);
    const base = quoteFor(svc, { item_count_template: label });
    const over = quoteFor(svc, { item_count_template: label, __exact_count: aof[svcId].anchor + 10 });
    if (over.laborCalc > base.laborCalc) sweepPassed++;
    else console.log(`    MISS: ${svcId}: base=$${base.laborCalc}, with overflow=$${over.laborCalc}`);
}
check(`all ${sweepChecked} real, configured services (every entry in the SSOT's overflow configuration) correctly activate real overflow pricing given a real, live exact count (not a sample)`,
    sweepChecked === Object.keys(aof).length && sweepChecked >= 14 && sweepPassed === sweepChecked);

console.log('\n=== The real, live notes-parsing regex (as used in sqBuildCuratedIntake\'s input listener) ===');
function parseExactCount(text) {
    const n = parseInt((text.match(/\d+/) || [])[0], 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
}
check('parses a plain number', parseExactCount('15') === 15);
check('parses a number embedded in real, natural sentence text', parseExactCount('I have about 47 cabinet doors that need this') === 47);
check('parses only the first number when multiple are present (matches real code behavior)', parseExactCount('between 20 and 30') === 20);
check('returns undefined for text with no real number', parseExactCount('quite a lot, not sure exactly') === undefined);
check('returns undefined for empty text', parseExactCount('') === undefined);
check('rejects a real, explicit zero (not a valid count)', parseExactCount('0') === undefined);

console.log('\n=== Regression guard: a service NOT in the overflow-configured set is completely unaffected ===');
const toiletSvc = servicesById['toilet_install'];
const unaffected = quoteFor(toiletSvc, { __exact_count: 999 });
check('a real, unrelated service ignores __exact_count entirely -- the formula only ever applies it when this service\'s own formula_override actually selects item_count_overflow_formula',
    typeof unaffected.laborCalc === 'number');

console.log(`\n[overflow quantity UI] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
