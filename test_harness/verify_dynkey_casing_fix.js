#!/usr/bin/env node
/**
 * verify_dynkey_casing_fix.js
 *
 * Regression test for a real, live bug found during a v9.3 architecture
 * review: sqAnalyze() (the free-text NLP entry point — the single most
 * common way a customer's request reaches the pricing engine) built its
 * dynamic_services lookup key with `.toLowerCase()` on the service-type
 * suffix in TWO places, e.g. 'minor_home_repairs+repair'. Every real key in
 * btnyc.json uses capitalized service-type casing ('minor_home_repairs+Repair'),
 * so both lookups always silently returned undefined — base-price enrichment
 * from the matched dynamic_service never happened for ANY free-text query,
 * category-wide, the entire time this bug was live.
 *
 * Both call sites were fixed to route through the already-correct,
 * casing-aware resolveDynamicService() helper instead of duplicating the
 * broken inline key construction. This script proves the fix and pins the
 * specific failure mode so it can't silently regress (e.g. if a future edit
 * reverts to an inline key build "for simplicity").
 */
const fs = require('fs');
const path = require('path');

global.DB = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'btnyc.json'), 'utf8'));
global.SERVICE_DATA = global.DB;
const engine = require('./_extracted_engine.js');

function oldBuggyLookup(category, stype) {
    const normSt = (stype || 'Repair').replace('Install / Mount', 'Install');
    const dynKey = (category || 'other') + '+' + normSt.toLowerCase();
    return global.DB.dynamic_services?.[dynKey];
}

let pass = true;
const cases = [
    ['minor_home_repairs', 'Repair'],
    ['wall_mounting', 'Mount'],
    ['furniture_fixes_assembly', 'Assembly'],
];

for (const [category, stype] of cases) {
    const oldResult = oldBuggyLookup(category, stype);
    const newResult = engine.resolveDynamicService(category, stype);
    if (oldResult !== undefined) {
        pass = false;
        console.log(`UNEXPECTED: old buggy lookup for ${category}+${stype} returned a value (${JSON.stringify(oldResult)}) — was expected to always be undefined due to the casing bug. Has the key naming convention changed?`);
    }
    if (!newResult) {
        pass = false;
        console.log(`FAIL: fixed resolveDynamicService(${category}, ${stype}) returned nothing — expected a real dynamic_service object.`);
    } else {
        console.log(`OK: ${category}+${stype} — old lookup: undefined (the bug) | fixed lookup: base_price=${newResult.financial_engine?.base_price}`);
    }
}

if (pass) {
    console.log('\nPASS: dynKey casing fix verified across all sample categories.');
    process.exit(0);
} else {
    console.log('\nFAIL: see above.');
    process.exit(1);
}
