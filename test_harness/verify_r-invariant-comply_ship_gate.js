#!/usr/bin/env node
/**
 * verify_r-invariant-comply_ship_gate.js
 *
 * @enforces R-INVARIANT-COMPLY
 * @enforces R-INVARIANT-NOLEGACY
 *
 * THE RULES (PROJECT_CHARTER.html, added 2026-10-02 by operator override, Enforced):
 *   R-INVARIANT-COMPLY: "Every change to the codebase -- bug fix, new feature, refactor, or configuration -- must
 *     respect layer responsibilities. If the code being changed is not in compliance, the change brings it into
 *     compliance before the change ships. Nothing goes live in a non-compliant state. Compliance is binary ...
 *     There is no third path." Index mechanism: "Compliance gate at ship time."
 *   R-INVARIANT-NOLEGACY: "Non-compliant code receives compliance or removal."
 *
 * HOW IT WORKS: it compares the code being shipped (HEAD: qr.html, or BTNYC_QR_FILE) against a BASE and finds every
 * function that is TOUCHED -- new, text changed, or moved to another layer. Each touched function is then analysed
 * against its layer (_layers.js, using COMPONENT_LAYER_MAP.md). Any violation in a touched function fails the gate.
 * Untouched functions are not judged here: their debt is the whole-file census (verify_r-system-layers_full_matrix.js).
 * That split is the rule: debt may exist, but a change may not walk through it. Touch it and you fix it, or delete it.
 *
 * BASE (a gate with no base cannot gate, so a missing base FAILS, it does not pass silently):
 *   BTNYC_BASE_QR=<path to the previous qr.html>          explicit file, or
 *   BTNYC_BASE_REF=<git ref>   (default HEAD)             `git show <ref>:qr.html` in the repo root.
 *   In CI after committing, use BTNYC_BASE_REF=HEAD~1 (or the merge base).
 *
 * Note a whitespace-only edit counts as "changed" (exact text compare): reformatting a non-compliant function is
 * touching it. That is deliberate -- it is the cheap, honest rule.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { check, finish, envelope, RESULTS_DIR } = require('./_shared.js');
const Q = require('./_qr_blocks.js');
const L = require('./_layers.js');

// ═══ PART 1: the gate gates ══════════════════════════════════════════════
console.log('\n=== Gate self-test (base/head fixtures) ===');
const mk = (mod, code) => `<script>\n/**\n * ${mod}\n */\n${code}\n</script>\n`;
const MAP = { 'btnyc.json': 'knowledge', 'pricing_engine.js': 'logic', 'UIRenderer.js': 'rendering', 'AppController.js': 'glue', inline: 'glue' };
const gate = (b, h) => L.shipGate(b, h, MAP);
{
    const same = mk('pricing_engine.js', 'function bad(){ return document.title; }');
    const r = gate(same, same);
    check('pre-existing debt that is NOT touched does not block a change', r.touched.length === 0 && r.violating.length === 0, { got: r });
}
{
    const r = gate(mk('pricing_engine.js', 'function f(){ return 1; }'), mk('pricing_engine.js', 'function f(){ return document.title; }'));
    check('touching a function and leaving it non-compliant FAILS', r.violating.length === 1 && r.violating[0].why === 'changed', { got: r.violating.map(v => v.why) });
}
{
    const r = gate(mk('pricing_engine.js', 'function f(){ return 1; }'), mk('pricing_engine.js', 'function f(){ return 1; }\nfunction g(state){ return state.qty; }'));
    check('a new compliant function passes', r.touched.length === 1 && r.touched[0].why === 'new' && r.violating.length === 0, { got: r.touched.map(t => t.why) });
}
{
    const r = gate(mk('pricing_engine.js', 'function f(){ return 1; }'), mk('pricing_engine.js', 'function f(){ return 1; }\nfunction g(){ return S.qty; }'));
    check('a new function that violates its layer FAILS (no new debt, ever)', r.violating.length === 1 && r.violating[0].why === 'new', { got: r.violating.map(v => v.why) });
}
{
    const r = gate(mk('UIRenderer.js', 'function f(){ return 1; }'), mk('pricing_engine.js', 'function f(){ return 1; }'));
    check('moving a compliant function to another layer is touched and passes', r.touched.length === 1 && r.touched[0].why === 'moved' && r.violating.length === 0, { got: r.touched.map(t => t.why) });
}
{
    const r = gate(mk('UIRenderer.js', 'function f(){ return document.title; }'), mk('pricing_engine.js', 'function f(){ return document.title; }'));
    check('moving a function into a layer it does not satisfy FAILS (a move is not a fix)', r.violating.length === 1 && r.violating[0].why === 'moved', { got: r.violating.map(v => v.why) });
}
{
    const r = gate(mk('pricing_engine.js', 'function f(){ return document.title; }'), mk('pricing_engine.js', 'function f(){ return document.title;  }'));
    check('a whitespace-only edit of a non-compliant function still counts as touching it', r.violating.length === 1, { got: r.violating.map(v => v.why) });
}
{
    const r = gate(mk('pricing_engine.js', 'function f(){ return 1; }'), mk('pricing_engine.js', 'function f({ return 1; }'));
    check('a head block that does not compile is reported (the gate cannot judge it)', r.headErrors.length === 1, { got: r.headErrors });
}
{
    const r = gate(mk('AppController.js', 'function f(){ return 1; }'), mk('AppController.js', 'function f(){ return computeUnifiedQuote(x); }'));
    check('Glue: touching a function and adding a direct pricing-engine call FAILS', r.violating.length === 1 && r.violating[0].unit.violations[0].kind === 'glue-engine-call', { got: r.violating });
}

// ═══ PART 2: the real change ═════════════════════════════════════════════
console.log('\n=== R-INVARIANT-COMPLY: every function touched by this change complies with its layer ===');
let map;
try { map = L.loadLayerMap(); check('COMPONENT_LAYER_MAP.md present', true); }
catch (e) { check('COMPONENT_LAYER_MAP.md present', false, { got: e.message }); finish('R-INVARIANT-COMPLY: ship gate'); }

function readBase() {
    if (process.env.BTNYC_BASE_QR) return { html: fs.readFileSync(path.resolve(process.env.BTNYC_BASE_QR), 'utf8'), from: `file ${process.env.BTNYC_BASE_QR}` };
    const ref = process.env.BTNYC_BASE_REF || 'HEAD';
    try {
        const out = execFileSync('git', ['-C', Q.REPO_ROOT, 'show', `${ref}:qr.html`], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
        return { html: out, from: `git ${ref}:qr.html` };
    } catch (e) { return null; }
}
const base = readBase();
check('a BASE to compare against is available (BTNYC_BASE_QR, or a git ref in BTNYC_BASE_REF / HEAD)', !!base,
    { expected: 'the previous qr.html', got: 'none -- a ship gate with no base cannot gate; set BTNYC_BASE_QR=<file> or BTNYC_BASE_REF=<ref>' });
if (!base) finish('R-INVARIANT-COMPLY: ship gate');

const head = fs.readFileSync(Q.QR_PATH, 'utf8');
const r = L.shipGate(base.html, head, map);
console.log(`  base: ${base.from}`);
console.log(`  head: ${Q.QR_PATH}`);
r.baseErrors.forEach(e => console.log(`  note: base block ${e.module} @L${e.line} does not compile (${e.error.message})`));
check('every changed script block compiles (the gate cannot judge code that does not parse)', r.headErrors.length === 0, { expected: 0, got: r.headErrors.map(e => `${e.module} @L${e.error.absLine}: ${e.error.message}`) });

const byWhy = {}; r.touched.forEach(t => { byWhy[t.why] = (byWhy[t.why] || 0) + 1; });
const byLayer = {}; r.touched.forEach(t => { byLayer[t.unit.layer] = (byLayer[t.unit.layer] || 0) + 1; });
console.log(`  ${r.headFunctions} functions in HEAD; ${r.touched.length} touched ${JSON.stringify(byWhy)} by layer ${JSON.stringify(byLayer)}`);

for (const t of r.violating) {
    const u = t.unit;
    check(`${u.owner} [${u.layer}, ${t.why}, ${u.module} L${u.line}] complies with its layer`, false,
        { expected: 'no violations', got: u.violations.map(v => `L${v.line} ${v.kind} ${v.detail}`) });
    u.violations.slice(0, 6).forEach(v => console.log(`      L${v.line}:${v.col} [${v.kind}] ${v.detail}   ${v.snippet}`));
}
check(`all ${r.touched.length} touched functions comply with their layer (binary: any violation fails the change)`, r.violating.length === 0,
    { expected: 0, got: `${r.violating.length} non-compliant touched function(s)` });

try {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    fs.writeFileSync(path.join(RESULTS_DIR, 'COMPLY_SHIP_GATE.json'), JSON.stringify(envelope('verify_r-invariant-comply_ship_gate',
        { touched: r.touched.length, violating: r.violating.length }, r.touched.map(t => ({ owner: t.unit.owner, layer: t.unit.layer, module: t.unit.module, why: t.why, violations: t.unit.violations }))), null, 2));
} catch (e) { /* non-fatal */ }

finish('R-INVARIANT-COMPLY: ship gate');
