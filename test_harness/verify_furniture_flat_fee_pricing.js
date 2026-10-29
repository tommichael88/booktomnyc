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
const QR_HTML = require('./_page.js').readPage(path.join(REPO_ROOT, 'qr.html'));
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

// T193 (#137 S3): this test locked in the I.7 fix (flat_fee added on top of the labor). T135+ B2 reversed it ON PURPOSE, from direct business input (PRICING_GUIDE 5.4 / 10.2): an item's authored
// flat_fee already IS its labor at the standard rate (a 60-minute Bed Frame's $40 is 1 hour at $40), so adding both double-counted labor (a Bed Frame priced $105 against its own catalog's $40).
// mathFurnitureAssembly now prices minutes / 60 x the standard rate with a one-hour minimum and does not sum flat_fee at all. The assertions below hold that: the price IS the item's own
// authored flat_fee (not flat_fee on top of labor), and the double count does not come back.
console.log('\n=== mathFurnitureAssembly prices the minutes at the standard rate and does NOT add flat_fee on top (T135+ B2), verified against a real, known item ===');
const bedFrame = DB.furniture_catalog.find(i => i.sku === 'GEN-bed_frame-60');
check('the real bed-frame item exists with the expected minutes/flat_fee', bedFrame && bedFrame.minutes === 60 && bedFrame.flat_fee === 40);
const result = mathFurnitureAssembly([bedFrame]);
const rate = DB.meta?.global_rates?.standard_labor || 65;
const expectedPrice = Math.round(Math.max(rate, (60 / 60) * rate) * 100) / 100;
check(`a single bed-frame item prices at $${expectedPrice} (1 hour at the standard rate; equal to its own authored flat_fee of $${bedFrame.flat_fee}), not labor + flat_fee ($${rate + bedFrame.flat_fee}, the double count B2 removed)`,
    result.price === expectedPrice && result.price === bedFrame.flat_fee && result.price !== rate + bedFrame.flat_fee);
check('flat_fee is not summed into the result at all (no flatFeeTotal is reported)', result.flatFeeTotal === undefined);

console.log('\n=== Multiple items: the minutes sum, and the price follows the minutes at the standard rate (with the one-hour minimum) ===');
const items = DB.furniture_catalog.slice(0, 3);
const expectedMinutesSum = items.reduce((s, i) => s + i.minutes, 0);
const expectedMultiPrice = Math.round(Math.max(rate, (expectedMinutesSum / 60) * rate) * 100) / 100;
const multiResult = mathFurnitureAssembly(items);
check('total minutes sums correctly across multiple real items', multiResult.minutes === expectedMinutesSum);
check('the price across multiple real items is their total minutes at the standard rate, one-hour minimum (flat_fee not added)', multiResult.price === expectedMultiPrice);

console.log('\n=== Backward compatibility: call sites that pass bare minutes (no catalog item) still work ===');
const bareNumberResult = mathFurnitureAssembly([90]);
check('a bare-number array (what the cart call sites pass) computes correctly: 90 minutes at the standard rate', bareNumberResult.minutes === 90 && bareNumberResult.price === Math.round(Math.max(rate, 1.5 * rate) * 100) / 100);

console.log('\n=== All real call sites in qr.html use the correct pattern ===');
check('call site 1 (merge existing cart entry) maps furnitureItems to mins array', QR_HTML.includes('newFurnitureItems.map(f => f.minutes)'));
check('call site 2 (merge) passes the mapped mins array to mathFurnitureAssembly', QR_HTML.includes('const charge = mathFurnitureAssembly(mins)'));
// T193: the two "degenerate fallback" call sites (`mathFurnitureAssembly([mins]).price || basePrice`) no longer exist; what remains are the three calls below, each handing over a list (items or minutes).
{
    const calls = [...QR_HTML.matchAll(/mathFurnitureAssembly\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)].map(m => m[1].trim()).filter(a => !/^items$/.test(a) && !/^\)/.test(a));
    const known = new Set(['State.furnitureItems', 'merged.map(f => f.minutes)', 'mins']);
    check('call site 3: every real call passes a list (State.furnitureItems, the merged minutes, or the mapped minutes); none passes a bare number', calls.length >= 3 && calls.every(a => known.has(a) || /^\*?\s*$/.test(a)));
    check('call site 4: the retired fallback shape (`mathFurnitureAssembly([mins]).price || basePrice`) is gone', !QR_HTML.includes('mathFurnitureAssembly([mins]).price || basePrice'));
}

console.log(`\n[Furniture flat_fee pricing verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
