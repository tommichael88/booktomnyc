#!/usr/bin/env node
/**
 * verify_furniture_catalog_fix.js
 *
 * Regression test for two real bugs found and fixed this session, both
 * behind the reported "Furniture service tile just says CALL and leads
 * nowhere":
 *
 * 1. formatServicePrice's final fallback returned the literal string
 *    'Call' for any service with base_price=0 and no svc.price field —
 *    matching no real checkout_state — instead of recognizing
 *    assembly_formula/hourly pricing types, which genuinely have no
 *    static base_price by design (their real price is computed later:
 *    per-item via mathFurnitureAssembly, or from elapsed time × rate).
 * 2. The furniture catalog's lookup map (furnitureMap) was keyed by
 *    `f.article || f.code || f.id` — but the real furniture_catalog data
 *    has zero items with code/id, and 14 of 124 items have article: null,
 *    silently dropping those 14 from the furniture-selection UI entirely.
 *    sku (present on all 124 items) was never checked at all.
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

console.log('=== formatServicePrice no longer returns "Call" for assembly_formula/hourly services ===');
const code = findFn('formatServicePrice');
const sandbox = { SERVICE_DATA: DB, State: { activeSmartTags: [] }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'formatServicePrice' });

const KNOWN_AFFECTED = ['furniture_assembly_flat_pack', 'dishwasher_repair', 'furniture_disassembly_for_moving', 'furniture_repair_hourly'];
for (const sid of KNOWN_AFFECTED) {
    const svc = DB.services.find(s => s.id === sid);
    const result = sandbox.formatServicePrice(svc);
    check(`${sid}: shows a real rate, not the literal string "Call"`, result !== 'Call' && /\$\d/.test(result));
}

check('dishwasher_repair specifically shows the SPECIALIZED tier rate ($110/hr), not a flat fallback',
    sandbox.formatServicePrice(DB.services.find(s => s.id === 'dishwasher_repair')) === 'from $110/hr');

const control = DB.services.find(s => s.id === 'toilet_install');
check('control case (a normal static-price service) is unaffected', /\$100/.test(sandbox.formatServicePrice(control)));

console.log('\n=== furnitureMap keying covers all 124 real catalog items, not just the 110 with an article field ===');
const fc = DB.furniture_catalog;
const oldKeyCoverage = fc.filter(f => f.article || f.code || f.id).length;
const newKeyCoverage = fc.filter(f => f.sku || f.article || f.code || f.id).length;
check('old key approach (article||code||id) only covered a subset', oldKeyCoverage < fc.length);
check('new key approach (sku||article||code||id) covers all 124 items', newKeyCoverage === fc.length);
check('qr.html source actually checks f.sku first in the real fix', /const key = f\.sku \|\| f\.article \|\| f\.code \|\| f\.id;/.test(QR_HTML));

console.log(`\n[furniture catalog fix verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
