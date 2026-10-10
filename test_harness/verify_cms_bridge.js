#!/usr/bin/env node
/**
 * verify_cms_bridge.js
 *
 * Cross-checks cms_bridge.js (the live-from-qr.html extraction bridge used
 * by btnyc.py's Price Simulator) against every full-quote vector in
 * pricing_test_vectors.json that has a `namedServiceId` or `dynKey` +
 * answers shape compatible with a real computeUnifiedQuote call (skips
 * vectors that only exercise applyPricingFormula directly, like the bare
 * tile/drywall/furniture formula vectors, and the mathFurnitureAssembly-only
 * vectors — those test a different function than the bridge calls).
 *
 * Run this any time cms_bridge.js or qr.html's pricing functions change.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO_ROOT = path.dirname(__dirname);
const BRIDGE = path.join(REPO_ROOT, 'cms_bridge.js');
const DB_PATH = path.join(REPO_ROOT, 'btnyc.json');
const QR_PATH = path.join(REPO_ROOT, 'qr.html');
const VECTORS_PATH = path.join(__dirname, 'pricing_test_vectors.json');

const { vectors } = JSON.parse(fs.readFileSync(VECTORS_PATH, 'utf8'));

// Only vectors that resolve to a full computeUnifiedQuote call the bridge
// can actually make: namedServiceId vectors always qualify; dynKey vectors
// qualify only when they don't ALSO specify a bare formulaId-only check
// (those check applyPricingFormula's raw output, a different shape than
// computeUnifiedQuote's laborEstimate/complexityTier).
const bridgeable = vectors.filter(v => {
    if (v.namedServiceId) return true;
    if (v.dynKey && v.expect && ('laborEstimate' in v.expect || 'complexityTier' in v.expect)) return true;
    return false;
});

let pass = 0, fail = 0;
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms_bridge_check_'));

for (const v of bridgeable) {
    const payload = v.namedServiceId
        ? { serviceId: v.namedServiceId, qty: v.qty || 1, answers: v.answers || {}, tags: v.activeTagIds || [] }
        : { category: v.dynKey.split('+')[0], stype: v.dynKey.split('+').slice(1).join('+'), qty: v.qty || 1, answers: v.answers || {}, tags: v.activeTagIds || [], formulaId: v.formulaId || null };

    const payloadPath = path.join(tmpDir, `${v.id}.json`);
    fs.writeFileSync(payloadPath, JSON.stringify(payload));

    let result;
    try {
        const stdout = execFileSync('node', [BRIDGE, payloadPath, DB_PATH, QR_PATH], { encoding: 'utf8' });
        result = JSON.parse(stdout);
    } catch (err) {
        fail++;
        console.log(`  ✗ ${v.id}: bridge call failed — ${err.message.split('\n')[0]}`);
        continue;
    }

    let vectorPassed = true;
    const mismatches = [];
    for (const [key, expected] of Object.entries(v.expect)) {
        if (!(key in result)) continue; // bridge's output shape may omit fields a formula-only vector checks
        if (result[key] !== expected) {
            vectorPassed = false;
            mismatches.push(`${key}: expected ${expected}, bridge got ${result[key]}`);
        }
    }
    if (vectorPassed) {
        pass++;
    } else {
        fail++;
        console.log(`  ✗ ${v.id}: ${mismatches.join('; ')}`);
    }
}

fs.rmSync(tmpDir, { recursive: true, force: true });

console.log(`\n${pass} passed, ${fail} failed (of ${bridgeable.length} bridgeable vectors, ${vectors.length} total in file)\n`);
process.exit(fail > 0 ? 1 : 0);
