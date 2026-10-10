#!/usr/bin/env node
/**
 * verify_r-system-layers_full_matrix.js
 *
 * @enforces R-SYSTEM-LAYERS
 * @enforces R-INVARIANT-BOUNDARY
 *
 * THE RULES (PROJECT_CHARTER.html, amended 2026-10-02 by operator override, both Enforced):
 *   R-SYSTEM-LAYERS: "Every function belongs to exactly one of four roles ... A function whose body violates its
 *     declared layer's responsibilities is non-compliant; the violation disqualifies the function, with no partial
 *     credit." Index: "Full-matrix structural source analysis."
 *   R-INVARIANT-BOUNDARY: "Layer assignment is mechanically enforced across all four layers, not reviewed."
 *
 * WHAT THIS DOES: for every <script> block of qr.html it looks up the module's layer in COMPONENT_LAYER_MAP.md,
 * parses the block into an AST, and checks every function body against that layer's "Must Not Own" column
 * (see _layers.js for exactly which clauses are decidable from source and which are not). It also checks that the
 * SSOT (btnyc.json) is declarative. Any violation fails; there is NO allowlist, NO baseline file and NO ratchet --
 * the directive is explicit that red is the honest state until the code is compliant.
 *
 * LIFECYCLE: red against code with layer debt. Per R-GOVERN-STOPTHELINE a rule whose test is red is not in force;
 * per R-INVARIANT-COMPLY nothing may ship that touches a non-compliant function (see the ship gate), so this whole-file
 * census is what the migration burns down.
 *
 * Output: a per-module summary, the violating functions with real qr.html line numbers, and the full list in
 * RESULTS/LAYER_MATRIX_VIOLATIONS.json. Run with BTNYC_QR_FILE=<file> to analyse any copy.
 * Exit: 0 only when every layer is clean.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { check, finish, envelope, RESULTS_DIR } = require('./_shared.js');
const Q = require('./_qr_blocks.js');
const L = require('./_layers.js');

// ═══ PART 1: the detectors detect, and leave look-alikes alone ═══════════
console.log('\n=== Detector self-test (every clause fires; every look-alike is left alone) ===');
const kinds = (layer, code) => L.analyzeLayer(code, layer).violations.map(v => v.kind).sort();
const FX = [
    // Logic: must not access the DOM, global window UI state, or declare inline handlers
    ['logic', 'pure function of its arguments', 'function f(state, DB){ return state.qty * 2; }', []],
    ['logic', 'document', 'function f(){ return document.title; }', ['logic-dom']],
    ['logic', 'DOM property write', 'function f(el){ el.innerHTML = "x"; }', ['logic-dom']],
    ['logic', 'q() DOM helper', 'function f(){ return q("#a"); }', ['logic-dom']],
    ['logic', 'global S read', 'function f(){ return S.qty; }', ['logic-global-ui-state']],
    ['logic', 'global State read', 'function f(){ return State.serviceRequest; }', ['logic-global-ui-state']],
    ['logic', 'global BLD read', 'function f(){ return BLD.step; }', ['logic-global-ui-state']],
    ['logic', 'global DOM cache read', 'function f(){ return DOM.cartFab; }', ['logic-global-ui-state']],
    ['logic', 'S shadowed by a parameter is fine', 'function f(S){ return S.qty; }', []],
    ['logic', 'window data read', 'function f(){ return window._currentRoute; }', ['logic-global-ui-state']],
    ['logic', 'window.DB is the SSOT handle (allowed)', 'function f(){ return window.DB.services; }', []],
    ['logic', 'assigning a FUNCTION to window is an export (allowed)', 'window.foo = function(){ return 1; };', []],
    ['logic', 'assigning UI/session DATA to window is state', 'function f(){ window._sqMode = {a:1}; }', ['logic-global-ui-state']],
    ['logic', 'a vocabulary CACHE on window is an implementation detail, not UI state', 'function f(){ return window._NLP.SKIP_WORDS; }', []],
    ['logic', 'calling a shared helper function via window is not UI state', 'function f(t){ return window._normServiceType(t); }', []],
    ['logic', 'inline handler in a string', 'function f(){ return \'<button onclick="go()">x</button>\'; }', ['logic-inline-handler']],
    ['logic', 'inline handler in a template', 'function f(){ return `<a onclick="go()">x</a>`; }', ['logic-inline-handler']],
    ['logic', '.onclick = assignment', 'function f(b){ b.onclick = function(){}; }', ['logic-inline-handler']],
    ['logic', 'prose that merely says "click on" is not a handler', 'function f(){ return "we click on the button = fine"; }', []],
    // Glue: must not contain business rules, pricing, or resolution (the decidable subset)
    ['glue', 'benign wiring', 'function onTap(){ const q2 = computeQuoteFromState(S); render(q2); }', []],
    ['glue', 'direct pricing engine call', 'function f(){ return computeUnifiedQuote(x); }', ['glue-engine-call']],
    ['glue', 'direct resolver call via window', 'function f(){ return window.resolveDynamicService(a); }', ['glue-engine-call']],
    ['glue', 'pricing SSOT read', 'function f(svc){ return svc.financial_engine.base_price; }', ['glue-pricing-ssot']],
    ['glue', 'pricing SSOT via destructuring', 'function f(svc){ const { pricing_formulas } = svc; }', ['glue-pricing-ssot']],
    ['glue', 'engine name inside a string is not a call', 'function f(){ return "computeUnifiedQuote"; }', []],
    // Rendering is delegated to the charter-literal analyzer
    ['rendering', 'renderer reading S', 'function f(){ return S.qty; }', ['rendering-session-state']],
    ['rendering', 'renderer reading resolved view data', 'function f(view){ return view.qty; }', []],
];
for (const [layer, label, code, expected] of FX) {
    const got = kinds(layer, code);
    check(`${layer}: ${label}`, JSON.stringify(got) === JSON.stringify(expected), { expected, got });
}
{
    const k = o => L.analyzeKnowledge(o).length;
    check('knowledge: plain declarative data is clean', k({ a: 'Replace the faucet cartridge?', b: { c: ['A', 'B'] } }) === 0);
    check('knowledge: a function expression in a value is code', k({ x: 'function(a){ return a }' }) === 1);
    check('knowledge: an arrow function in a value is code', k({ x: '(a) => a * 2' }) === 1);
    check('knowledge: an if-branch in a value is branching', k({ x: 'if (qty > 2) { fee = 5 }' }) === 1);
    check('knowledge: a template expression with operators is a calculation', k({ x: 'total ${a + b}' }) === 1);
    check('knowledge: a named placeholder like ${labor_total} is declarative copy, not code', k({ x: 'Add to Cart (${labor_total})' }) === 0);
}
{
    // UMD wrappers keep the module body in the factory argument: it must be analysed, not skipped.
    const umd = '(function(root, factory){ const api = factory(); root.x = api; })(this, function(){ function leak(){ return document.title; } return {leak}; });';
    check('UMD factory body is analysed (a violation inside it is found)', kinds('logic', umd).includes('logic-dom'), { got: kinds('logic', umd) });
}

// ═══ PART 2: the real code ═══════════════════════════════════════════════
console.log('\n=== R-SYSTEM-LAYERS / R-INVARIANT-BOUNDARY: every function complies with its layer ===');
let map;
try { map = L.loadLayerMap(); check('COMPONENT_LAYER_MAP.md exists and assigns btnyc.json and inline blocks', true); }
catch (e) { check('COMPONENT_LAYER_MAP.md exists and assigns btnyc.json and inline blocks', false, { got: e.message }); finish('R-SYSTEM-LAYERS: full matrix'); }

const { blocks } = Q.loadQr();
const all = [];
const perModule = [];
for (const b of blocks) {
    if (!b.src.trim()) continue;
    const mod = L.moduleOf(blocks, b);
    const layer = map[mod] || map.inline;
    const label = mod === 'inline' ? `inline <script> @L${b.startLine}` : mod;
    if (!map[mod] && mod !== 'inline') check(`${mod} has a row in COMPONENT_LAYER_MAP.md`, false, { got: 'unassigned module' });
    const p = Q.tryParseJs(b.src, b.startLine);
    if (p.error) { check(`${label} compiles (the layer analysis cannot judge code that does not parse)`, false, { got: `${p.error.message} @L${p.error.absLine}` }); continue; }
    const an = L.analyzeLayer(b.src, layer, { startLine: b.startLine });
    const fnUnits = an.units.filter(u => u.fnNode).length;
    perModule.push({ label, layer, fns: fnUnits, violations: an.violations });
    an.violations.forEach(v => all.push(Object.assign({ module: mod }, v)));
}

for (const m of perModule) {
    const byKind = {};
    m.violations.forEach(v => { byKind[v.kind] = (byKind[v.kind] || 0) + 1; });
    const owners = new Map();
    m.violations.forEach(v => { const k = `${v.owner}@${v.ownerLine}`; if (!owners.has(k)) owners.set(k, []); owners.get(k).push(v); });
    check(`${m.label} [${m.layer}] has no layer violations (${m.fns} functions scanned)`, m.violations.length === 0,
        { expected: 0, got: `${m.violations.length} in ${owners.size} owners: ${JSON.stringify(byKind)}` });
    let shown = 0;
    for (const [k, vs] of [...owners].sort((a, b) => a[1][0].ownerLine - b[1][0].ownerLine)) {
        if (shown++ >= 14) { console.log(`      … ${owners.size - 14} more owners (full list in RESULTS/LAYER_MATRIX_VIOLATIONS.json)`); break; }
        const sites = vs.slice(0, 3).map(v => `L${v.line} ${v.kind} ${v.detail}`).join('; ');
        console.log(`      ${vs[0].owner} (L${vs[0].ownerLine}): ${vs.length} -- ${sites}${vs.length > 3 ? ' …' : ''}`);
    }
}

{
    const ssotPath = path.join(Q.REPO_ROOT, 'btnyc.json');
    if (fs.existsSync(ssotPath)) {
        const v = L.analyzeKnowledge(JSON.parse(fs.readFileSync(ssotPath, 'utf8')));
        check(`btnyc.json [knowledge] contains no executable logic, branching or calculations`, v.length === 0, { expected: 0, got: v.slice(0, 5).map(x => `${x.path}: ${x.detail}`) });
        v.slice(0, 8).forEach(x => console.log(`      ${x.path}: ${x.detail}  "${x.snippet}"`));
        v.forEach(x => all.push(Object.assign({ module: 'btnyc.json' }, x)));
    } else check('btnyc.json is present to be checked (Knowledge layer)', false, { got: 'missing' });
}

const byLayer = {};
all.forEach(v => { byLayer[v.layer] = (byLayer[v.layer] || 0) + 1; });
console.log(`\n  total layer violations: ${all.length}  ${JSON.stringify(byLayer)}`);
check('every layer is compliant (zero violations across the full matrix)', all.length === 0, { expected: 0, got: `${all.length} ${JSON.stringify(byLayer)}` });

try {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    fs.writeFileSync(path.join(RESULTS_DIR, 'LAYER_MATRIX_VIOLATIONS.json'),
        JSON.stringify(envelope('verify_r-system-layers_full_matrix', { violations: all.length, by_layer: byLayer }, all), null, 2));
} catch (e) { /* non-fatal */ }

finish('R-SYSTEM-LAYERS: full matrix');
