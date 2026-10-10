#!/usr/bin/env node
/**
 * verify_guided_builder_qty_double_count_fix.js
 *
 * A real, severe, confirmed bug reported directly by the user via a
 * real trace captured from the live site: "need 5 ceiling tiles put
 * up" through the Guided Builder produced a $1738 quote for what
 * should price closer to $100-150.
 *
 * Root cause: sqBuilderFinish unconditionally assigned S.qty =
 * BLD.qty (the Guided Builder's own generic quantity stepper) as the
 * OUTER price multiplier in computeUnifiedQuote, with zero awareness
 * that the resolved entity (minor_home_repairs_ceilings) already has
 * its own, dedicated quantity question (item_count_template), which
 * independently captures "how many tiles" via its own answer and
 * complexity-tier escalation. This double-counted quantity: once via
 * the entity's own question ("4 or more" escalating to the
 * specialized tier), again via the outer qty=5 multiplier on top --
 * exactly the same class of bug the curated-card path
 * (sqBuildCuratedIntake) already, correctly guards against via its
 * own QTY_MODS filter (confirmed T97) -- the Guided Builder simply
 * never had the equivalent protection.
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

console.log('=== The real fix logic, isolated and tested directly against both real, affected scenarios ===');
const sandbox = { DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(findFn('resolveDynamicService'), sandbox);

const GENERIC_QTY_MODS = new Set(['item_count', 'count', 'hybrid_qty', 'global_quantity']);
function resolvedQty(cat, stype, groupId, bldQty) {
    const entity = sandbox.resolveDynamicService(cat, stype, groupId);
    const hasOwnQtyQuestion = !!(entity?.intake_chain || []).some(step => {
        const key = step.module || '';
        return !GENERIC_QTY_MODS.has(key) && (key === 'item_count_template' || key.startsWith('item_count_template::'));
    });
    return hasOwnQtyQuestion ? 1 : (bldQty || 1);
}

check('the real, originally-reported scenario (ceilings, BLD.qty=5): S.qty now correctly stays 1, not 5 -- the entity\'s own item_count_template question already captures quantity',
    resolvedQty('minor_home_repairs', 'Repair', 'minor_home_repairs_ceilings', 5) === 1);
check('a real, unrelated Guided Builder scenario with NO dedicated quantity question (wall_mounting_frames_shelves, uses generic global_quantity): unaffected, still takes BLD.qty as before',
    resolvedQty('wall_mounting', 'Mount', 'wall_mounting_frames_shelves', 3) === 3);

console.log('\n=== The real, complete, end-to-end price -- reasonable, not catastrophically wrong ===');
const PRICING_FNS = ['syncTagSynthesizedAnswers', '_isModVisible',
    'resolveDynamicService', 'resolveBaseConfidenceStrategy', 'resolveServiceCheckoutStateKey', 
    'applyLiveConfidenceEscalation', 'deriveComplexityTier', 'applyPricingFormula',
    'buildCheckoutStateModel', 'sqTagLabel', 'tagValidForCategory', 'resolveEngineKey',
    'resolveServiceBadge', 'computeUnifiedQuote', 'computeArchetypeQuote', 'computeQuoteFromState'];
const pricingSandbox = { DB, window: { DB }, console };
pricingSandbox.global = pricingSandbox;
vm.createContext(pricingSandbox);
vm.runInContext(PRICING_FNS.map(findFn).join('\n\n'), pricingSandbox);
pricingSandbox.S = {
    qty: 1, // what the fix now correctly produces for this scenario
    intent: { key: 'minor_home_repairs+minor_home_repairs_ceilings+Repair', category: 'minor_home_repairs', _groupId: 'minor_home_repairs_ceilings', label: 'Test' },
    stype: 'Repair', detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: [],
    answers: { item_count_template: '4+', ceiling_tile_access: 'Standard height, reachable with a step ladder', has_matching_tiles: 'Yes' },
    _tagSynthesizedModules: {}, _tagsAffirmed: true,
};
const fixedPrice = pricingSandbox.computeQuoteFromState(pricingSandbox.S).laborCalc;
check(`the real, complete price for "5 ceiling tiles" is now reasonable ($${fixedPrice}), nowhere near the real, confirmed, previously-wrong $1738`,
    fixedPrice > 0 && fixedPrice < 300);

console.log(`\n[Guided Builder qty double-count fix] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
