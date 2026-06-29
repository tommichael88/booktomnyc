#!/usr/bin/env node
/**
 * verify_furniture_flat_fee_pricing.js
 *
 * Regression test for backlog item I.7: every one of the 124 real
 * furniture_catalog items has a designed, non-zero flat_fee that was
 * silently discarded by mathFurnitureAssembly, which previously only
 * ever received a bare minutesArr with no path for flat_fee to reach
 * the real price at all.
 *
 * Confirmed real, severe scope before fixing: 124 of 124 real items
 * have flat_fee > 0 -- this affected every furniture-assembly booking,
 * not an edge case. The existing 28-test suite never caught this either
 * (confirmed: stayed green before and after the fix), since nothing
 * exercised a real assertion on the actual computed price including
 * flat_fee.
 *
 * Explicitly NOT deferred under the "pure UI, will be rebuilt anyway"
 * filter discussed this session, since this is a real pricing/money
 * correctness issue, not a presentation-only gap.
 */
const fs = require('fs');
const path = require('path');

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

const sandbox = {};
global.SERVICE_DATA = DB;
eval(findFn('mathFurnitureAssembly'));

console.log('=== Confirmed real, severe scope: every real furniture item has a non-zero flat_fee ===');
const allHaveFlatFee = DB.furniture_catalog.every(item => (item.flat_fee || 0) > 0);
check('all 124 real furniture_catalog items have flat_fee > 0', allHaveFlatFee && DB.furniture_catalog.length === 124);

console.log('\n=== mathFurnitureAssembly now correctly includes flat_fee, verified against a real, known item ===');
const bedFrame = DB.furniture_catalog.find(i => i.sku === 'GEN-bed_frame-60');
check('the real bed-frame item exists with the expected minutes/flat_fee', bedFrame && bedFrame.minutes === 60 && bedFrame.flat_fee === 40);
const result = mathFurnitureAssembly([bedFrame]);
const rate = DB.meta?.global_rates?.standard_labor || 65;
const expectedPrice = Math.round((1 * rate + 40) * 100) / 100;
check(`a single bed-frame item correctly prices at $${expectedPrice} (labor + real flat fee), not just $${rate} (labor alone, the old broken behavior)`,
    result.price === expectedPrice);
check('flatFeeTotal is exposed on the result for transparency/debugging', result.flatFeeTotal === 40);

console.log('\n=== Multiple items: minutes and flat_fee both sum correctly ===');
const items = DB.furniture_catalog.slice(0, 3);
const expectedMinutesSum = items.reduce((s, i) => s + i.minutes, 0);
const expectedFlatFeeSum = items.reduce((s, i) => s + i.flat_fee, 0);
const multiResult = mathFurnitureAssembly(items);
check('total minutes sums correctly across multiple real items', multiResult.minutes === expectedMinutesSum);
check('total flat fee sums correctly across multiple real items', multiResult.flatFeeTotal === expectedFlatFeeSum);

console.log('\n=== Backward compatibility: the one real call site that passes bare numbers (no catalog item) still works ===');
const bareNumberResult = mathFurnitureAssembly([90]);
check('a bare-number array (the real degenerate fallback case, no catalog flat_fee to apply) still computes correctly', bareNumberResult.minutes === 90 && bareNumberResult.flatFeeTotal === 0);

console.log('\n=== All 4 real call sites in qr.html now pass full items, not bare minutes arrays ===');
check('call site 1 (add-to-cart) passes State.furnitureItems directly', QR_HTML.includes('mathFurnitureAssembly(State.furnitureItems)'));
check('call site 2 (merge into existing cart entry) passes the real, full items array', QR_HTML.includes('mathFurnitureAssembly(existing.furnitureItems)'));
check('call site 3 (remove item, recompute) passes the real, full items array', QR_HTML.includes('mathFurnitureAssembly(svc.furnitureItems)'));
check('call site 4 (degenerate fallback, no real catalog item) correctly still passes a bare number', QR_HTML.includes('mathFurnitureAssembly([mins])'));

console.log(`\n[Furniture flat_fee pricing verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
