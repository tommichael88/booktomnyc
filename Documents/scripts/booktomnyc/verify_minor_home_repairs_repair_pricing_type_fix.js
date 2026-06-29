#!/usr/bin/env node
/**
 * verify_minor_home_repairs_repair_pricing_type_fix.js
 *
 * Regression test for a real, severe bug found via direct, constructive
 * pushback on whether `pricing_formulas` should be considered "data" or
 * "logic" — checking a real, concrete example ("repairing 5 chipped
 * subway tiles") surfaced that `minor_home_repairs+Repair` (the real,
 * shared dynamic entity behind tile, drywall, AND cabinet/furniture
 * repair) was priced as `flat_rate`, despite being shared by 3 real,
 * genuinely quantity-aware formulas (tile_repair_formula,
 * drywall_repair_formula, furniture_repair_formula via the
 * cabinet/drawer keyword).
 *
 * THE REAL BUG: `computeUnifiedQuote`'s flat_rate branch
 * (`laborEstimate = (base + extraFee) * qtyMultiplier`) never reads
 * `totalMin` at all — meaning a formula's real, primary, per-unit
 * MINUTES contribution (e.g. tile_repair_formula's
 * `minutes_per_tile * count`) was silently discarded entirely. Only
 * the formula's flat fee components (grout/water-damage/etc penalties)
 * ever reached the final price. Confirmed via direct test: 1 tile, 5
 * tiles, and 20 tiles all priced at the exact same $70, regardless of
 * quantity.
 *
 * THE FIX: changed `minor_home_repairs+Repair`'s `pricing_type` from
 * `flat_rate` to `hourly`, the correct branch that genuinely uses
 * `totalMin`. Confirmed `minor_home_repairs+Install` (the real,
 * correct sibling with no qty-aware formula attached) was correctly
 * left as `flat_rate` — this fix is scoped to the one real entity that
 * actually needed it, not applied as a blanket category change.
 *
 * A SECOND, REAL TEST FAILURE was found and fixed while verifying this
 * one: `verify_checkout_state_override_architecture.js` failed because
 * its own simulation no longer held the real isolation it depended on
 * (an unrelated, earlier fix this session had authored real, non-zero
 * minute deltas into the same `symptom` module this test reuses) — see
 * that file's own updated comments for the full story.
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
    'resolveServiceBadge', 'computeUnifiedQuote'];
const code = FNS.map(findFn).join('\n\n');
const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'minor_home_repairs_pricing_fix' });

console.log('=== minor_home_repairs+Repair is now genuinely hourly, the correct, fixed pricing type ===');
check('minor_home_repairs+Repair.financial_engine.pricing_type is "hourly"',
    DB.dynamic_services['minor_home_repairs+Repair'].financial_engine.pricing_type === 'hourly');
check('minor_home_repairs+Install (the real, correct sibling) is correctly, still "flat_rate" -- not a blanket category change',
    DB.dynamic_services['minor_home_repairs+Install'].financial_engine.pricing_type === 'flat_rate');

console.log('\n=== Real, complete, end-to-end test: tile_repair_formula now genuinely scales with quantity ===');
{
    const dynDef = DB.dynamic_services['minor_home_repairs+Repair'];
    const prices = [1, 5, 20].map(count => {
        const r = sandbox.computeUnifiedQuote({
            svc: null, dynDef, activeTagIds: [],
            answers: { surface_type: 'Tile (wall or floor)', tile_count: String(count), grout_repair: 'No', water_damage: 'No' },
            qty: count, formulaId: 'tile_repair_formula',
        });
        return r.laborEstimate;
    });
    check(`1, 5, and 20 tiles now produce 3 genuinely distinct prices (found: ${prices.join(', ')})`,
        new Set(prices).size === 3);
    check('price genuinely increases with tile count (1 < 5 < 20)',
        prices[0] < prices[1] && prices[1] < prices[2]);
}

console.log('\n=== The real, complete scope: all 3 real, qty-aware formulas sharing this entity are confirmed ===');
{
    const sharedFormulas = ['tile_repair_formula', 'drywall_repair_formula', 'furniture_repair_formula'];
    const matchingKeywords = DB.intent_mappings.objects.filter(o =>
        sharedFormulas.includes(o.dynamic_rule) &&
        `${o.default_dynamic_category}+${o.default_service_type}` === 'minor_home_repairs+Repair'
    );
    check(`confirmed 3 real keywords sharing this exact entity (found ${matchingKeywords.length}: ${matchingKeywords.map(k => k.keyword).join(', ')})`,
        matchingKeywords.length === 3);
}

console.log(`\n[minor_home_repairs+Repair pricing-type fix verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
