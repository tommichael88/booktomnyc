#!/usr/bin/env node
/**
 * verify_base_materials_fix.js
 *
 * Regression test closing backlog item I.3's real, open investigation:
 * is services.*.financial_engine.base_materials a genuine duplicate of
 * default_estimates.materials, or a distinct, separately-intended
 * mechanism?
 *
 * CONFIRMED: two genuinely distinct fields. base_materials is a small,
 * fixed, always-incurred company cost meant to be folded into the
 * charged price. default_estimates.materials is a customer-facing
 * DISPLAY RANGE for materials the customer separately chooses/pays for.
 * Confirmed real, designed data on exactly 1 real service
 * (loose_tile_replacement, $15) that was never read/applied anywhere in
 * pricing -- a real, confirmed $15 undercharge on every quote for that
 * service, not dead/duplicate data. Fixed by folding base_materials
 * into the real base price calculation.
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

console.log('=== Confirmed real scope: exactly 1 real service has a non-zero base_materials ===');
const nonZero = DB.services.filter(s => (s.financial_engine?.base_materials || 0) > 0);
check('exactly 1 real service has a non-zero base_materials (loose_tile_replacement, $15)',
    nonZero.length === 1 && nonZero[0].id === 'loose_tile_replacement' && nonZero[0].financial_engine.base_materials === 15);

console.log('\n=== base_materials is now genuinely folded into the real base price ===');
check('computeUnifiedQuote now reads fe.base_materials', /base \+= \(fe\.base_materials \|\| 0\)/.test(QR_HTML));

const FNS = ['resolveDynamicService', 'resolveBaseConfidenceStrategy', 'resolveForceModules',
    'applyLiveConfidenceEscalation', 'deriveComplexityTier', 'applyPricingFormula',
    'resolveCheckoutState', 'sqTagLabel', 'tagValidForCategory', 'resolveEngineKey',
    'resolveServiceBadge', 'computeUnifiedQuote'];
const code = FNS.map(findFn).join('\n\n');
const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'base_materials_e2e' });

const tileResult = sandbox.computeUnifiedQuote({ svc: DB.services.find(s => s.id === 'loose_tile_replacement'), activeTagIds: [], answers: {}, qty: 1 });
check('loose_tile_replacement now correctly charges $100 (base_price $85 + base_materials $15), not the old, undercharged $85',
    tileResult.laborEstimate === 100);

const toiletResult = sandbox.computeUnifiedQuote({ svc: DB.services.find(s => s.id === 'toilet_install'), activeTagIds: [], answers: {}, qty: 1 });
check('a service with base_materials: 0 (toilet_install) is genuinely unaffected by this fix',
    toiletResult.laborEstimate === 100);

console.log('\n=== Confirmed: base_materials and default_estimates.materials are genuinely distinct, not duplicates ===');
const tileSvc = DB.services.find(s => s.id === 'loose_tile_replacement');
check('loose_tile_replacement has a real, non-zero base_materials ($15)', tileSvc.financial_engine.base_materials === 15);
check('loose_tile_replacement\'s default_estimates.materials is genuinely different (a separate, zero display range)',
    tileSvc.default_estimates.materials.min === 0 && tileSvc.default_estimates.materials.max === 0);
const toiletSvc = DB.services.find(s => s.id === 'toilet_install');
check('toilet_install has base_materials: 0 but a real, non-zero default_estimates.materials display range ($100-$400) -- proving these are NOT the same field under two names',
    toiletSvc.financial_engine.base_materials === 0 && toiletSvc.default_estimates.materials.max === 400);

console.log(`\n[base_materials fix verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
