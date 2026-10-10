#!/usr/bin/env node
/**
 * run_vectors.js — executes pricing_test_vectors.json against the REAL
 * pricing engine extracted from qr.html (_extracted_engine.js), not a
 * hand-written reimplementation. This is the regression check referenced
 * throughout CHANGELOG_v9.2.md and the btnyc.py Price Simulator.
 *
 * Usage: node run_vectors.js [path-to-btnyc.json] [path-to-vectors.json]
 * Exit code 0 = all pass, 1 = any failure (for CI / pre-commit use).
 */
const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '..');
const dbPath = process.argv[2] || path.join(repoRoot, 'btnyc.json');
const vectorsPath = process.argv[3] || path.join(__dirname, 'pricing_test_vectors.json');

global.DB = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
global.SERVICE_DATA = global.DB; // qr.html uses both `DB` and `SERVICE_DATA` as aliases for the same loaded JSON in different functions — see CHANGELOG_v9.2.md
const SERVICE_DATA = global.DB;
const engine = require('./_extracted_engine.js');
const { vectors } = JSON.parse(fs.readFileSync(vectorsPath, 'utf8'));

let pass = 0, fail = 0;
const failures = [];

for (const v of vectors) {
    let actual;
    try {
        if (v.fn === 'mathFurnitureAssembly') {
            actual = engine.mathFurnitureAssembly(v.input);
        } else if (v.namedServiceId) {
            const svc = SERVICE_DATA.services.find(s => s.id === v.namedServiceId);
            if (!svc) throw new Error(`named service '${v.namedServiceId}' not found`);
            actual = engine.computeUnifiedQuote({
                svc, dynDef: null, qty: v.qty || 1,
                answers: v.answers || {}, activeTagIds: v.activeTagIds || []
            });
        } else if (v.dynKey) {
            const dynDef = SERVICE_DATA.dynamic_services[v.dynKey];
            if (!dynDef) throw new Error(`dynamic_service '${v.dynKey}' not found`);
            if (v.formulaId) {
                actual = engine.applyPricingFormula(v.formulaId, v.answers || {}, v.qty || 1);
            } else {
                actual = engine.computeUnifiedQuote({
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
            mismatches.push(`${key}: not present on actual result (got keys: ${Object.keys(actual).join(', ')})`);
            continue;
        }
        const got = actual[key];
        if (got !== expected) {
            vectorPassed = false;
            mismatches.push(`${key}: expected ${expected}, got ${got}`);
        }
    }
    if (vectorPassed) {
        pass++;
    } else {
        fail++;
        failures.push({ id: v.id, error: mismatches.join('; ') });
    }
}

console.log(`\n${pass} passed, ${fail} failed (of ${vectors.length} vectors)\n`);
if (failures.length) {
    console.log('FAILURES:');
    failures.forEach(f => console.log(`  ✗ ${f.id}: ${f.error}`));
}
process.exit(fail > 0 ? 1 : 0);
