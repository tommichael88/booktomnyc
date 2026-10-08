#!/usr/bin/env node
/**
 * verify_r-invariant-boundary_ui_renderer_layer.js
 *
 * @enforces R-INVARIANT-BOUNDARY
 *
 * THE RULE (PROJECT_CHARTER.html, R-INVARIANT-BOUNDARY, status: Enforced):
 *   "A Rendering module must not read session state (S.*), the pricing SSOT
 *    (DB.financial_engine, DB.pricing_formulas, DB.checkout_states), or call
 *    engine functions (computeUnifiedQuote, orch_compute_confidence,
 *    resolveDynamicService, tagValidForCategory, resolveBaseConfidenceStrategy,
 *    applyPricingFormula). Enforcement is a structural test -- a source-level
 *    analysis of each function body -- not a code review and not a naming
 *    convention."
 *
 * WHAT THIS TEST IS: it parses the UIRenderer.js <script> block of qr.html
 * into an AST (acorn -- NOT regex; the UIRenderer header itself records that
 * the regex approach "was repeatedly found to miss real structure") and walks
 * every function body, nested functions and module-level statements included.
 * Any forbidden reference fails the test and is reported with its absolute
 * qr.html line number, the top-level function that owns it, and the innermost
 * function it sits in. There is NO allowlist, NO baseline file, and NO
 * "known violations" ratchet: the operator directive is explicit that there
 * is no third option between "moves to the module that owns it" and
 * "deleted", and no exception for "just this one".
 *
 * EXPECTED LIFECYCLE (operator directive, 2026-09-30): this test is written
 * BEFORE the migration and FAILS on day one against the pre-migration code
 * (R-INVARIANT-PREFIX: a test that has never been seen red proves nothing).
 * It turns green only when UIRenderer contains zero forbidden references.
 * Per R-GOVERN-STOPTHELINE, until it is green the rule is not in force; per
 * R-INVARIANT-REDTEST it must not be left red across sessions.
 *
 * TWO TIERS, BOTH GATING:
 *   charter   -- exactly the set the charter names (S.*, DB.<pricing keys>
 *                incl. window.DB.* / DB['key'] / destructuring, the six
 *                engine functions incl. window.X / obj.X / .call / bare refs,
 *                and DEFINING one of those engine functions in the renderer).
 *   adjacent  -- the same pricing-SSOT keys reached one hop away:
 *                `svc.financial_engine`, `legacy.pricing_formulas = ...`,
 *                and object literals that DEFINE a `financial_engine:` block.
 *                DECISION (agent authority, R-GOVERN-AUTONOMY; reasoning
 *                recorded here where it lives): a literal-list-only test
 *                lets `svc.financial_engine?.base_price || 85` straight
 *                through -- a renderer deriving a price from pricing data,
 *                with a hardcoded fallback price, which is exactly what the
 *                rule exists to stop and exactly the "test that passes
 *                proves only that it passed" failure (Battle 8). Reading the
 *                same SSOT data through a service object is the same
 *                violation one hop away. To reverse this decision, set
 *                GATE_ADJACENT_TIER=false in _ui_boundary.js; the operator owns that call
 *                and it should be amended in the charter if reversed.
 *
 * WHAT THIS TEST DOES NOT DO (stated so nobody assumes coverage):
 *   - It does not enforce the general rule R-INVARIANT-RENDERERS ("no business
 *     logic in renderers"), which remains Judgment. `node <this file> --census`
 *     prints a non-gating census of UIRenderer functions that never touch the
 *     DOM, which is the evidence base for deciding whether to promote it.
 *   - It does not gate `State.*` (the cart store) or `BLD.*` (builder state);
 *     the charter's rule names `S.*` only. The census reports their counts.
 *   - It analyses the source text. It cannot see a forbidden call made through
 *     a computed or aliased name assembled at runtime (e.g. window[name]()).
 *     The fixtures below pin exactly which forms ARE detected.
 *
 * Exit: 0 = zero forbidden references; 1 = any violation or self-test failure.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { check, finish, envelope, RESULTS_DIR } = require('./_shared.js');
const { loadQr, findModuleBlock, tryParseJs } = require('./_qr_blocks.js');

const { analyze, gating, ENGINE_FUNCTIONS } = require('./_ui_boundary.js');


// ═════════════════════════════════════════════════════════════════════════
// PART 1 -- the detector detects (fixtures). A guardrail that cannot be shown
// to fire is decoration. Each fixture pins one form the rule must catch, or
// one form it must NOT flag.
// ═════════════════════════════════════════════════════════════════════════
console.log('\n=== Detector self-test: every forbidden form is caught; every innocent form is left alone ===');
const kindsOf = src => analyze(src).violations.map(v => v.kind).sort();
const FIXTURES = [
    // innocent code: must produce zero violations
    ['clean DOM builder from resolved view-model', `function renderX(view){ const el=document.createElement('div'); el.textContent=view.label; return el; }`, []],
    ['S / engine names inside a string and a comment are NOT reads', `function f(){ /* S.answers computeUnifiedQuote(x) */ return 'S.answers computeUnifiedQuote(x) DB.financial_engine'; }`, []],
    ['a parameter named S shadows the global', `function f(S){ return S.answers; }`, []],
    ['a local const S shadows the global', `function f(){ const S = {a:1}; return S.a; }`, []],
    ['object key / property named S is not a reference', `function f(o){ return {S: 1, x: o.S}; }`, []],
    ['look-alike identifiers are not matched', `function f(){ const SS=1, Sx=2; return SS+Sx+DBx+resolveDynamicServiceX(); }`, []],
    // session state
    ['S read', `function f(){ return S.answers.door; }`, ['session-state']],
    ['S write', `function f(){ S.qty = 2; }`, ['session-state']],
    ['S whole-object assignment', `function f(){ S = {qty:1}; }`, ['session-state']],
    ['S increment', `function f(){ S.qty++; }`, ['session-state']],
    ['window.S', `function f(){ return window.S; }`, ['session-state']],
    ['globalThis.S', `function f(){ return globalThis.S.detTagIds; }`, ['session-state']],
    ['const { S } = window', `function f(){ const { S } = window; }`, ['session-state']],
    // pricing SSOT via DB
    ['DB.financial_engine', `function f(){ return DB.financial_engine; }`, ['ssot-pricing']],
    ['window.DB.pricing_formulas', `function f(){ return window.DB.pricing_formulas; }`, ['ssot-pricing']],
    ["DB['checkout_states'] (computed string key)", `function f(){ return DB['checkout_states']; }`, ['ssot-pricing']],
    ['DB?.financial_engine (optional chain)', `function f(){ return DB?.financial_engine?.x; }`, ['ssot-pricing']],
    ['const { financial_engine } = DB', `function f(){ const { financial_engine } = DB; }`, ['ssot-pricing']],
    // adjacent tier
    ['svc.financial_engine read with hardcoded fallback price', `function f(svc){ return svc.financial_engine?.base_price || 85; }`, ['ssot-pricing-adjacent']],
    ['legacy.pricing_formulas write', `function f(l,p){ l.pricing_formulas = p.formulas; }`, ['ssot-pricing-adjacent']],
    ['object literal defining a financial_engine block', `function f(){ return { financial_engine: { base_price: 1 } }; }`, ['pricing-structure-literal']],
    // engine functions
    ['direct call: bare name', `function f(){ return computeUnifiedQuote(x); }`, ['engine-call']],
    ['window.resolveDynamicService()', `function f(){ return window.resolveDynamicService(a,b); }`, ['engine-call']],
    ['PricingEngine.orch_compute_confidence()', `function f(){ return PricingEngine.orch_compute_confidence(a); }`, ['engine-call']],
    ['bare reference passed as a value', `function f(){ return [1].map(tagValidForCategory); }`, ['engine-call']],
    ['.call() on an engine function', `function f(){ return resolveBaseConfidenceStrategy.call(null, a); }`, ['engine-call']],
    ['engine function DEFINED in the renderer', `function applyPricingFormula(){ return 1; }`, ['engine-definition']],
];
// evasion resistance (R-GOVERN-GOODHART): each of these VIOLATES the rule in spirit through trivial indirection and must still be caught...
FIXTURES.push(
    ['EVASION: alias of window (const w = window; w.S.qty)', `function f(){ const w = window; return w.S.qty; }`, ['session-state']],
    ['EVASION: alias of globalThis', `function f(){ const g = globalThis; return g.S.answers; }`, ['session-state']],
    ['EVASION: pricing key as a template literal DB[`financial_engine`]', 'function f(){ return DB[`financial_engine`]; }', ['ssot-pricing']],
    ["EVASION: pricing key via a const string (const k = 'financial_engine'; DB[k])", `function f(){ const k = 'financial_engine'; return DB[k]; }`, ['ssot-pricing']],
    ["EVASION: pricing key via a module-level const", `const KEY = 'checkout_states'; function f(){ return DB[KEY]; }`, ['ssot-pricing']],
    ['EVASION: window alias to DB (const w = window; w.DB.pricing_formulas)', `function f(){ const w = window; return w.DB.pricing_formulas; }`, ['ssot-pricing']],
    // ...and the look-alikes must NOT be flagged (no false positives bought by the stricter reading)
    ['not an evasion: a const key that is not a pricing key (DB[k] with k = "label")', `function f(){ const k = 'label'; return DB[k]; }`, []],
    ['not an evasion: a pricing-key string that is never used as a key into DB', `function f(){ const k = 'financial_engine'; return k.length; }`, []],
    ['not an evasion: an alias of something that is not the global object (w.S)', `function f(w){ const v = w; return v.S; }`, []],
    ['not an evasion: a reassigned/ambiguous const name is not trusted as a key', `function f(){ const k = 'label'; const g = () => { const k = 'financial_engine'; return 1; }; return DB[k]; }`, []],
);
for (const name of ENGINE_FUNCTIONS) FIXTURES.push([`engine call: ${name}`, `function f(){ return ${name}(1); }`, ['engine-call']]);
for (const [label, src, expected] of FIXTURES) {
    const got = kindsOf(src);
    check(`detector: ${label}`, JSON.stringify(got) === JSON.stringify(expected), { expected, got });
}
// attribution, scoping and line mapping
{
    const nested = analyze(`function outer(){ function inner(){ return S.qty; } return inner(); }`).violations;
    check('nested function: attributed to top-level owner AND innermost function',
        nested.length === 1 && nested[0].owner === 'outer' && nested[0].inner === 'inner', { got: nested });
    const modLevel = analyze(`const x = S.qty;`).violations;
    check('module-level statement is scanned and owned by <module-level>', modLevel.length === 1 && modLevel[0].owner === '<module-level>', { got: modLevel });
    const arrow = analyze(`const f = () => S.qty;`).violations;
    check('arrow-function const is scanned and owned by its name', arrow.length === 1 && arrow[0].owner === 'f', { got: arrow });
    const iife = analyze(`(function(){ function f(){ return S.qty; } })();`).violations;
    check('IIFE-wrapped module is unwrapped and scanned', iife.length === 1 && iife[0].owner === 'f', { got: iife });
    const lined = analyze(`function f(){\n  var a = 1;\n  return S.qty;\n}`, { startLine: 100 }).violations;
    check('reported line is absolute (startLine + relative line - 1)', lined.length === 1 && lined[0].line === 102, { expected: 102, got: lined.map(v => v.line) });
    const w = analyze(`function f(){ S.qty = 2; return S.qty; }`).violations;
    check('write vs read is distinguished', w.length === 2 && w[0].write === true && w[1].write === false, { got: w });
}

// ═════════════════════════════════════════════════════════════════════════
// PART 2 -- the real UIRenderer block
// ═════════════════════════════════════════════════════════════════════════
console.log('\n=== R-INVARIANT-BOUNDARY: UIRenderer.js contains zero forbidden reads or calls ===');
const { blocks } = loadQr();
const block = findModuleBlock(blocks, 'UIRenderer.js');
check("UIRenderer.js block is located in qr.html by its own header", !!block);
if (!block) finish();

const parsed = tryParseJs(block.src, block.startLine);
check('UIRenderer.js block compiles (the boundary cannot be evaluated on code that does not parse)', !parsed.error,
    parsed.error ? { expected: 'parses', got: `${parsed.error.message} at qr.html line ${parsed.error.absLine}` } : {});
if (parsed.error) finish('R-INVARIANT-BOUNDARY: UIRenderer layer');
const result = analyze(block.src, { startLine: block.startLine });
const endLine = block.startLine + block.src.split('\n').length - 1;
console.log(`  scanned qr.html lines ${block.startLine}-${endLine}: ${result.functions.length} top-level functions`);

const gated = result.violations.filter(gating);
// Grouped by owner AT ITS LINE, not by name: a function declared twice (the later
// copy silently shadows the earlier) must be reported as two separate owners.
const ownerKey = v => `${v.owner}@${v.ownerLine}`;
const byOwner = new Map();
for (const v of gated) { const k = ownerKey(v); if (!byOwner.has(k)) byOwner.set(k, []); byOwner.get(k).push(v); }

const fnInfo = new Map(result.functions.map(f => [`${f.name}@${f.line}`, f]));
const owners = [...byOwner.keys()].sort((a, b) => byOwner.get(a)[0].ownerLine - byOwner.get(b)[0].ownerLine);
for (const key of owners) {
    const vs = byOwner.get(key);
    const owner = vs[0].owner;
    const info = fnInfo.get(key);
    const span = info ? ` (L${info.line}-L${info.endLine})` : '';
    const sites = vs.map(v => `L${v.line}:${v.col} [${v.tier}/${v.kind}] ${v.detail}${v.inner !== owner ? `  in ${v.inner}` : ''}`);
    check(`UIRenderer.${owner}${span} has no forbidden reads or calls`, false, { expected: 0, got: sites });
    sites.forEach(s => console.log(`      ${s}`));
}
check(`UIRenderer.js: zero forbidden references (${result.functions.length} functions scanned)`, gated.length === 0,
    { expected: 0, got: `${gated.length} forbidden references in ${owners.length} owners` });

if (gated.length) {
    const s = { charter: 0, adjacent: 0 };
    gated.forEach(v => s[v.tier]++);
    console.log(`\n  ${gated.length} forbidden references in ${owners.length} owners  (charter tier: ${s.charter}, adjacent tier: ${s.adjacent})`);
}

try {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    fs.writeFileSync(path.join(RESULTS_DIR, 'UIRENDERER_BOUNDARY_VIOLATIONS.json'),
        JSON.stringify(envelope('verify_r-invariant-boundary_ui_renderer_layer',
            { scanned_functions: result.functions.length, violations: gated.length, owners: owners.length }, gated), null, 2));
} catch (e) { /* non-fatal: the console output above is the record */ }

// ─── Non-gating census (opt-in) ─────────────────────────────────────────
if (process.argv.includes('--census')) {
    console.log('\n=== CENSUS (non-gating): UIRenderer functions that never touch the DOM ===');
    console.log('  Evidence base for promoting R-INVARIANT-RENDERERS (general rule) beyond Judgment.');
    const noDom = result.functions.filter(f => f.domTouches === 0).sort((a, b) => (b.endLine - b.line) - (a.endLine - a.line));
    console.log(`  ${noDom.length} of ${result.functions.length} top-level functions contain no DOM contact:`);
    noDom.forEach(f => console.log(`    L${String(f.line).padEnd(6)} ${String(f.endLine - f.line + 1).padStart(4)} lines  ${f.name}${f.violations ? `   <- ${f.violations} gated violation(s)` : ''}`));
    const st = result.functions.filter(f => f.stateReads), bl = result.functions.filter(f => f.bldRefs);
    console.log(`\n  Not gated by the rule as written: ${st.length} functions reference State.* (cart store), ${bl.length} reference BLD (builder state).`);
} else {
    console.log('\n  (run with --census for the non-gating list of functions that never touch the DOM)');
}

finish('R-INVARIANT-BOUNDARY: UIRenderer layer');
