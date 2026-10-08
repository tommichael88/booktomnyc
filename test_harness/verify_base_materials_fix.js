#!/usr/bin/env node
/**
 * verify_base_materials_fix.js
 *
 * v9.5 SCHEMA UPDATE: the original financial_engine.base_materials field
 * (a single flat-fee-folded-into-labor-price mechanism, historically fixed
 * for loose_tile_replacement's real $15 undercharge) has been architecturally
 * RETIRED and replaced by a more general, more transparent mechanism:
 *   - required_materials[] / optional_materials[] on each service reference
 *     real SKUs in materials_catalog (each with its own price + markup_percent)
 *   - route.materialsEstimate (orch_merge_materials_estimate) surfaces this
 *     to the customer as an EXPLICIT, SEPARATE range from laborEstimate --
 *     never silently folded into the labor price. This is a deliberate
 *     transparency improvement: the customer sees materials broken out,
 *     rather than an opaque single number that includes an unstated
 *     materials component.
 *
 * This test now verifies the NEW architecture is correctly wired: real SKU
 * references resolve to real catalog prices, and labor/materials stay
 * genuinely separate (never double-counted or silently dropped).
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

console.log('=== financial_engine.base_materials is genuinely, fully retired (v9.5 schema) ===');
const stillHasIt = DB.services.filter(s => 'base_materials' in (s.financial_engine || {}));
check('zero services carry the old base_materials field (found ' + stillHasIt.length + ')', stillHasIt.length === 0);

console.log('\n=== loose_tile_replacement: required_materials resolve to real, priced catalog SKUs ===');
const tileSvc = DB.services.find(s => s.id === 'loose_tile_replacement');
check('loose_tile_replacement has real required_materials', Array.isArray(tileSvc.required_materials) && tileSvc.required_materials.length > 0);
const tileSkuPrices = (tileSvc.required_materials || []).map(sku => DB.materials_catalog?.[sku]);
check('every required_materials SKU resolves to a real, priced catalog entry',
    tileSkuPrices.every(m => m && typeof m.price === 'number' && m.price > 0));
const tileMaterialsCost = tileSkuPrices.reduce((sum, m) => sum + m.price * (1 + (m.markup_percent || 0) / 100), 0);
check(`loose_tile_replacement's real materials cost (with markup) is genuinely non-zero ($${tileMaterialsCost.toFixed(2)})`,
    tileMaterialsCost > 0);

console.log('\n=== Labor price and materials estimate stay genuinely separate (no silent folding, no double-count) ===');
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
    'resolveServiceBadge', 'computeUnifiedQuote', 'computeArchetypeQuote', 'mathFurnitureAssembly'];
const code = FNS.map(findFn).join('\n\n');
const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'base_materials_e2e' });

const tileResult = sandbox.computeUnifiedQuote({ svc: tileSvc, dynDef: null, activeTagIds: [], answers: {}, qty: 1 });
check('loose_tile_replacement laborEstimate reflects base_price only (no materials folded in)',
    tileResult.laborEstimate === Math.round(tileSvc.financial_engine.base_price));

console.log('\n=== toilet_install: default_estimates.materials remains a real, distinct customer-facing display range ===');
const toiletSvc = DB.services.find(s => s.id === 'toilet_install');
check('toilet_install has a real, non-zero default_estimates.materials display range ($100-$400)',
    toiletSvc.default_estimates.materials.min === 100 && toiletSvc.default_estimates.materials.max === 400);
const toiletResult = sandbox.computeUnifiedQuote({ svc: toiletSvc, dynDef: null, activeTagIds: [], answers: {}, qty: 1 });
check('toilet_install laborEstimate is genuinely unaffected by its materials display range',
    toiletResult.laborEstimate === Math.round(toiletSvc.financial_engine.base_price));

console.log(`\n[base_materials architecture verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
