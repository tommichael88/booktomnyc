#!/usr/bin/env node
/**
 * verify_pricing_engine_module.js
 *
 * Runs every pricing_test_vectors.json vector against the STANDALONE,
 * committed pricing_engine.js file (the Phase 1 PricingEngine module — see
 * CHANGELOG_v9.4.md), as opposed to _extracted_engine.js (which is
 * regenerated on demand from qr.html by extract_engine.py for general
 * regression testing). This is the actual proof that the physically
 * separated module — the file someone would really load and use — produces
 * identical results to qr.html's own functions.
 *
 * Run this after any edit to pricing_engine.js, and after any edit to the
 * 21 functions it contains inside qr.html (to confirm whether they've
 * drifted apart — if so, pricing_engine.js needs re-extracting via the same
 * process used to build it; see architecture_audit/ for the methodology).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.dirname(__dirname);
const dbPath = process.argv[2] || path.join(REPO_ROOT, 'btnyc.json');
const vectorsPath = process.argv[3] || path.join(__dirname, 'pricing_test_vectors.json');
const enginePath = process.argv[4] || path.join(REPO_ROOT, 'pricing_engine.js');

global.DB = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
global.SERVICE_DATA = global.DB;
global.window = global.window || global;
global.S = { _svc: null };

const engineCode = fs.readFileSync(enginePath, 'utf8');
vm.runInThisContext(engineCode, { filename: enginePath });
// After this, computeUnifiedQuote, applyPricingFormula, mathFurnitureAssembly,
// resolveDynamicService etc. are all real global functions in this process,
// exactly as they'd be in a browser that loaded pricing_engine.js as a <script>.

const { vectors } = JSON.parse(fs.readFileSync(vectorsPath, 'utf8'));

let pass = 0, fail = 0;
const failures = [];

for (const v of vectors) {
    let actual;
    try {
        if (v.fn === 'mathFurnitureAssembly') {
            actual = mathFurnitureAssembly(v.input);
        } else if (v.namedServiceId) {
            const svc = global.DB.services.find(s => s.id === v.namedServiceId);
            if (!svc) throw new Error(`named service '${v.namedServiceId}' not found`);
            actual = computeUnifiedQuote({
                svc, dynDef: null, qty: v.qty || 1,
                answers: v.answers || {}, activeTagIds: v.activeTagIds || []
            });
        } else if (v.dynKey) {
            const dynDef = global.DB.dynamic_services[v.dynKey];
            if (!dynDef) throw new Error(`dynamic_service '${v.dynKey}' not found`);
            if (v.formulaId) {
                actual = applyPricingFormula(v.formulaId, v.answers || {}, v.qty || 1);
            } else {
                actual = computeUnifiedQuote({
                    svc: null, dynDef, qty: v.qty || 1,
                    answers: v.answers || {}, activeTagIds: v.activeTagIds || [],
                    formulaId: v.formulaId || null
                });
            }
        } else {
            throw new Error('vector has no fn/namedServiceId/dynKey — cannot dispatch');
        }
    } catch (e) {
        fail++;
        failures.push({ id: v.id, error: e.message });
        continue;
    }

    let vectorPassed = true;
    const mismatches = [];
    for (const [key, expected] of Object.entries(v.expect)) {
        if (!(key in actual)) {
            vectorPassed = false;
            mismatches.push(`${key}: not present on actual result`);
            continue;
        }
        if (actual[key] !== expected) {
            vectorPassed = false;
            mismatches.push(`${key}: expected ${expected}, got ${actual[key]}`);
        }
    }
    if (vectorPassed) pass++;
    else { fail++; failures.push({ id: v.id, error: mismatches.join('; ') }); }
}

console.log(`\n[pricing_engine.js standalone module] ${pass} passed, ${fail} failed (of ${vectors.length} vectors)\n`);
if (failures.length) {
    console.log('FAILURES:');
    failures.forEach(f => console.log(`  ✗ ${f.id}: ${f.error}`));
}

// v9.5: the real, permanent fix for the staleness this file's own test
// could never catch on its own — checking correctness against real
// vectors says nothing about whether this committed file is still the
// SAME code as qr.html's current, live functions. A function could drift
// (lose a real fix made later in qr.html) while still passing every
// vector above, if the vectors don't happen to exercise the changed
// behavior. This explicitly checks freshness, not just correctness.
const { checkParity, printReport } = require('./check_module_parity.js');
const parityResult = checkParity({
    modulePath: enginePath,
    functionNames: ['resolveDynamicService', 'resolveBaseConfidenceStrategy', 'resolveForceModules',
        'applyLiveConfidenceEscalation', 'deriveComplexityTier', 'applyPricingFormula',
        'computeUnifiedQuote', 'sqTagLabel', 'mathFurnitureAssembly'],
});
const parityOk = printReport(parityResult, 'pricing_engine.js');
if (!parityOk) fail += parityResult.stale.length;

process.exit(fail > 0 ? 1 : 0);

