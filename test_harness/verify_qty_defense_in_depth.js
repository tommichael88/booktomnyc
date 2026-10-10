#!/usr/bin/env node
/**
 * verify_qty_defense_in_depth.js
 *
 * A real gap found by the new automated_path_sweep.js tool (T104),
 * not by hand-testing -- exactly the systematic coverage that tool
 * exists to provide. The two real UI entry points (Guided Builder's
 * sqBuilderFinish, T102; the free-text flow, T103) both already,
 * correctly gate qty down to 1 before calling computeUnifiedQuote
 * when the resolved entity has its own, dedicated quantity question
 * -- but computeUnifiedQuote itself had no independent safeguard,
 * meaning any OTHER current or future caller passing qty>1 directly
 * would silently reproduce the same double-counting bug. Fixed by
 * adding the same, shared entityHasOwnQtyQuestion check directly
 * inside computeUnifiedQuote's own qtyMultiplier computation.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
// T147: functions declared in the three engine modules are loaded WHOLE (the T136 `_engine.js` loader), so a helper or resolver added next to a function can no longer
// drop out of this sandbox ("X is not defined" -- noise unrelated to what this test asserts). Anything else is still extracted by name, below.
const { engineAwareFindFn } = require('./_engine.js');
const findFn = engineAwareFindFn(_cherryPickFn);

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

const PRICING_FNS = ['syncTagSynthesizedAnswers', '_isModVisible',
    'resolveDynamicService', 'entityHasOwnQtyQuestion', 'resolveBaseConfidenceStrategy', 'resolveServiceCheckoutStateKey', 
    'applyLiveConfidenceEscalation', 'deriveComplexityTier', 'applyPricingFormula',
    'buildCheckoutStateModel', 'sqTagLabel', 'tagValidForCategory', 'resolveEngineKey',
    'resolveServiceBadge', 'computeUnifiedQuote', 'computeArchetypeQuote', 'computeQuoteFromState'];
const sandbox = { DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext('const _GENERIC_QTY_MODULE_KEYS = new Set([\'item_count\', \'count\', \'hybrid_qty\', \'global_quantity\']);\n' + PRICING_FNS.map(findFn).join('\n\n'), sandbox);

console.log('=== computeUnifiedQuote itself now independently refuses to double-multiply, regardless of caller ===');
const dynDef = DB.dynamic_services['minor_home_repairs+minor_home_repairs_ceilings+Repair'];
const answers = { item_count_template: '4+', ceiling_tile_access: 'Standard height, reachable with a step ladder', has_matching_tiles: 'Yes' };

const withQty1 = sandbox.computeUnifiedQuote({ svc: null, dynDef, activeTagIds: [], answers, qty: 1 });
const withQty5Direct = sandbox.computeUnifiedQuote({ svc: null, dynDef, activeTagIds: [], answers, qty: 5 });
check('calling computeUnifiedQuote directly with qty=5 (bypassing both fixed UI entry points entirely) still produces the SAME price as qty=1 -- the pricing engine itself now refuses to double-count, not just the two callers that were already fixed',
    withQty1.laborEstimate === withQty5Direct.laborEstimate);

console.log('\n=== Regression guard: entities WITHOUT their own quantity question are correctly unaffected ===');
const mirrorSvc = DB.services.find(s => s.id === 'shelf_mounting_standard_buy_the_hour') || DB.services.find(s => s.ui_taxonomy?.group_id === 'wall_mounting_frames_shelves');
if (mirrorSvc) {
    const m1 = sandbox.computeUnifiedQuote({ svc: mirrorSvc, dynDef: null, activeTagIds: [], answers: {}, qty: 1 });
    const m3 = sandbox.computeUnifiedQuote({ svc: mirrorSvc, dynDef: null, activeTagIds: [], answers: {}, qty: 3 });
    check('an entity with no dedicated quantity question still correctly scales with qty (unaffected by this fix)',
        m3.laborEstimate > m1.laborEstimate);
} else {
    check('mirror-mounting control service found for the regression check', false);
}

console.log(`\n[qty defense in depth] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
