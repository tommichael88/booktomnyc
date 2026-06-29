#!/usr/bin/env node
/**
 * verify_nlp_analyze_mode.js
 *
 * Regression test for v9.5's new cms_bridge.js mode:'analyze' command
 * (added for btnyc.py's SmartQuoteNlpSimulator panel), and for a real bug
 * found while building it: extractObject/extractQty/extractLocation each
 * exist TWICE in qr.html (a fast preview-pipeline version in block 0, a
 * more thorough analysis-pipeline version in block 1 — see
 * nlp_engine.js's header for the full explanation). cms_bridge.js's
 * extraction previously always grabbed the FIRST occurrence by default,
 * silently using the wrong, lower-fidelity preview version for anything
 * that called these through the bridge — confirmed by checking the actual
 * extracted function signature (the preview version takes one parameter;
 * the analysis version genuinely used by sqAnalyze takes two).
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO_ROOT = path.dirname(__dirname);
const BRIDGE = path.join(REPO_ROOT, 'cms_bridge.js');
const DB_PATH = path.join(REPO_ROOT, 'btnyc.json');
const QR_PATH = path.join(REPO_ROOT, 'qr.html');

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

// ── Part 1: extraction grabs the ANALYSIS-pipeline version, not preview ────
console.log('=== Duplicated-function extraction picks the right occurrence ===');
const { extractEngine } = require(BRIDGE);
const extractedCode = extractEngine(QR_PATH);

check('extractObject extracted with TWO params (text, intentKeyword) — the analysis version, not the one-param preview version',
    /function extractObject\(text,\s*intentKeyword\)/.test(extractedCode));

// ── Part 2: mode:'analyze' produces correct, sensible output end-to-end ───
console.log('\n=== mode:\'analyze\' end-to-end (real cms_bridge.js subprocess call) ===');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nlp_analyze_check_'));
const payloadPath = path.join(tmpDir, 'payload.json');
fs.writeFileSync(payloadPath, JSON.stringify({
    mode: 'analyze',
    text: 'mount a heavy tv on a brick wall in my living room',
}));

let result;
try {
    const stdout = execFileSync('node', [BRIDGE, payloadPath, DB_PATH, QR_PATH], { encoding: 'utf8' });
    result = JSON.parse(stdout);
} catch (err) {
    fail++;
    console.log(`  ✗ bridge call failed: ${err.message.split('\n')[0]}`);
}

if (result) {
    check('detected intent category is wall_mounting', result.intent && result.intent.category === 'wall_mounting');
    check('detected intent recommends flatscreen_mounting_standard', result.intent && result.intent.recommendedSku === 'flatscreen_mounting_standard');
    check('detected #brick_wall tag', (result.tagsResult.found || []).includes('#brick_wall'));
    check('detected #heavy_item tag', (result.tagsResult.found || []).includes('#heavy_item'));
    check('detected #two_person_required tag', (result.tagsResult.found || []).includes('#two_person_required'));
    check('extracted object is "tv"', result.obj === 'tv');
    check('extracted location is "living room"', result.location === 'living room');
}

fs.rmSync(tmpDir, { recursive: true, force: true });

// ── Part 3: standalone mode correctly rejects analyze requests ────────────
console.log('\n=== Standalone mode correctly refuses mode:\'analyze\' (no NLP functions in pricing_engine.js) ===');
const tmpDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'nlp_analyze_standalone_check_'));
const payloadPath2 = path.join(tmpDir2, 'payload.json');
fs.writeFileSync(payloadPath2, JSON.stringify({ mode: 'analyze', text: 'fix my faucet' }));
try {
    execFileSync('node', [BRIDGE, payloadPath2, DB_PATH, QR_PATH], {
        encoding: 'utf8', env: { ...process.env, PRICING_ENGINE_MODE: 'standalone' },
    });
    check('standalone mode rejects analyze with a non-zero exit', false);
} catch (err) {
    check('standalone mode rejects analyze with a non-zero exit', err.status !== 0);
    check('standalone mode error message explains why', /does not support mode/.test(err.stderr || ''));
}
fs.rmSync(tmpDir2, { recursive: true, force: true });

console.log(`\n[NLP analyze mode verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
