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

{
    // The layer-map READER (T176, PENDING_DECISIONS #214). The map keeps three things apart -- what a row IS (its Layer cell), where it PHYSICALLY lives (its "Current source / status"
    // cell) and what it is for at deployment -- and a reader that collapses them hands the deployment container the business code it hosts. So it is held on fixtures (what it reads,
    // what it refuses), on the real map (every row is read; none is dropped), and on the rows that are not page code (each is named below with the detector that holds it).
    const os = require('os');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'layermap-'));
    let n = 0;
    const load = text => { const f = path.join(dir, `m${n++}.md`); fs.writeFileSync(f, text); try { return { map: L.loadLayerMap(f), model: L.loadLayerModel(f) }; } catch (e) { return { err: e.message }; } };
    const T = rows => ['# fixture', '', '| Module / responsibility | Layer | Current source / status | Owns | Must not absorb |', '|---|---|---|---|---|', ...rows, ''].join('\n');
    const row = (mod, layer, status = 'x') => `| \`${mod}\` | ${layer} | ${status} | x | y |`;
    const SSOT = '| `btnyc.json` — authored SSOT | Knowledge / source | **Current file at repo root.** legacy | facts | code |';
    const SHELL = '| `qr.html` — shell | Deployment / UI shell | **Current app/deployment file.** It has five inline JavaScript blocks: `a_engine`, `e_ui`; four are loaded from `modules/`. | host | logic |';
    const good = load(T([row('a.js', 'Logic / Engine', 'Inline block in `qr.html` per the handoff'), row('b.js', 'Logic coordination / Glue role'), row('c.js', 'State boundary', 'External module: `modules/c`'), row('d.js', 'State transition / Logic'),
        row('e.js', 'UI / Renderer'), row('f.js', 'Controller / Glue'), row('g.js', 'Observation / diagnostics'), '| `h.js` *(target responsibility; proposed file)* | Logic / Engine | **Target module; not yet a standalone file.** | x | y |',
        '| Compiler / derivation | Build / publish | `x/compiler.py` plus `x/splice.py` are the recorded legacy path | derive | decide |',
        '| Schema and independent validator | Knowledge / validation | `x/schema.json` are the recorded legacy locations | validate | mutate |',
        '| Derived runtime artifact | Published knowledge artifact | **Must be a separate generated output.** Exact filename/location is to be established by the migration design | project | hybrid |',
        SSOT, SHELL]));
    const want = { 'a.js': 'logic', 'b.js': 'logic', 'c.js': 'logic', 'd.js': 'logic', 'e.js': 'rendering', 'f.js': 'glue', 'g.js': 'observation', 'h.js': 'logic', 'btnyc.json': 'knowledge', inline: 'shell' };
    check('layer map reader: every layer the merged map words differently is read (Logic / Engine, Logic coordination / Glue role, State boundary, State transition / Logic, UI / Renderer, Controller / Glue, Observation, a proposed file)',
        !good.err && Object.keys(want).every(k => good.map[k] === want[k]) && Object.keys(good.map).length === Object.keys(want).length, { got: good.err || good.map });
    const by = k => good.model && good.model.byKey.get(k);
    check('layer map reader: Build / publish, Knowledge / validation and Published knowledge artifact are read as their own responsibilities and are NOT page code (not in the page map, but in the model)',
        !good.err && by('compiler-derivation').responsibility === 'build-publish' && by('compiler-derivation').role === 'build' && by('schema-and-independent-validator').responsibility === 'knowledge-validation'
        && by('derived-runtime-artifact').responsibility === 'published-artifact' && !('compiler-derivation' in good.map) && !('derived-runtime-artifact' in good.map), { got: good.err || good.model.rows.map(r => r.key + ':' + r.responsibility) });
    check('layer map reader: Deployment / UI shell is its own responsibility (not Glue), and headerless <script> blocks fall under the shell contract because the map names the shell as their host',
        !good.err && by('qr.html').responsibility === 'deployment-shell' && by('qr.html').role === 'shell' && good.map.inline === 'shell', { got: good.err || by('qr.html') });
    check('layer map reader: physical location is read apart from responsibility (inline in qr.html, external module, target not yet written, legacy files, a path the design must still name)',
        !good.err && by('a.js').location.kind === 'inline' && by('c.js').location.kind === 'external' && by('c.js').location.file === 'modules/c.js' && by('h.js').location.kind === 'target-unwritten'
        && by('compiler-derivation').location.kind === 'legacy-files' && by('compiler-derivation').location.files.length === 2 && by('derived-runtime-artifact').location.kind === 'unestablished'
        && JSON.stringify(by('qr.html').location.hostsInline) === '["a_engine","e_ui"]', { got: good.err || good.model.rows.map(r => r.key + ':' + JSON.stringify(r.location)) });
    check('layer map reader: a responsibility whose file does not exist yet stays identifiable (h.js is a Logic row with location target-unwritten, not an error and not dropped)', !good.err && good.map['h.js'] === 'logic' && by('h.js').location.kind === 'target-unwritten');
    const explicit = load(T([row('a.js', 'Logic / Engine'), row('inline', 'Glue'), SSOT, SHELL]));
    check('layer map reader: a row for `inline` in the map itself wins over the shell contract', !explicit.err && explicit.map.inline === 'glue', { got: explicit.err || explicit.map });
    const unknown = load(T([row('a.js', 'Logic / Engine'), row('z.js', 'Wizardry'), SSOT, SHELL]));
    check('layer map reader: a layer it does not know is an error that names the module (a module must not silently drop out of the analysis)', !!unknown.err && /z\.js/.test(unknown.err) && /Wizardry/.test(unknown.err), { got: unknown.err || unknown.map });
    check('layer map reader: no Knowledge row for the authored SSOT is an error', /Knowledge row/.test(load(T([row('a.js', 'Logic / Engine'), SHELL])).err || ''));
    check('layer map reader: no Deployment / UI shell row is an error (headerless blocks would have no declared host)', /Deployment \/ UI shell row/.test(load(T([row('a.js', 'Logic / Engine'), SSOT])).err || ''));
    check('layer map reader: a module assigned twice is an error', /twice/.test(load(T([row('a.js', 'Logic / Engine'), row('a.js', 'Controller / Glue'), SSOT, SHELL])).err || ''));
    check('layer map reader: no module table is an error (not an empty map)', /no module table/.test(load('# nothing here\n\n| Concern | Note |\n|---|---|\n| x | y |\n').err || ''));
    check('layer map reader: a table with no module row is an error', /no `module\.js` row/.test(load(T([SSOT, SHELL])).err || ''));
    // the shell contract: same decidable subset as Glue (no pricing-SSOT read, no direct engine call), plus no reading of the authoring source as a fallback; reported as shell, never as glue
    const shellKinds = src => L.analyzeLayer(src, 'shell').violations.map(v => v.layer + ':' + v.kind);
    check('shell contract: a headerless block that reads the pricing SSOT or calls an engine directly is a violation, reported as shell (not glue)',
        shellKinds('function f(DB){ return DB.financial_engine; }').join() === 'shell:shell-pricing-ssot' && shellKinds('function g(){ return computeUnifiedQuote(); }').join() === 'shell:shell-engine-call', { got: [shellKinds('function f(DB){ return DB.financial_engine; }'), shellKinds('function g(){ return computeUnifiedQuote(); }')] });
    check('shell contract: a headerless block that fetches the authoring source is a violation (the shell must not read it as a runtime fallback); a fetch of the published file is not',
        shellKinds("async function f(){ return fetch('./ssot/btnyc_source.json'); }").join() === 'shell:shell-source-fallback' && shellKinds("async function f(){ return fetch('./btnyc.json'); }").length === 0, { got: shellKinds("async function f(){ return fetch('./ssot/btnyc_source.json'); }") });
    check('shell contract: bootstrap code that touches the DOM and storage is allowed in the shell (it is not the Logic contract)', shellKinds("function boot(){ document.getElementById('x').style.display='none'; sessionStorage.setItem('k','v'); }").length === 0);
    fs.rmSync(dir, { recursive: true, force: true });

    // the real map
    const realText = fs.readFileSync(path.join(Q.REPO_ROOT, 'COMPONENT_LAYER_MAP.md'), 'utf8');
    const listed = [...new Set([...realText.matchAll(/^\|\s*`([A-Za-z0-9_]+\.js)`/gm)].map(m => m[1]))];
    let realMap = null, realModel = null; try { realMap = L.loadLayerMap(); realModel = realMap.__model; } catch (e) { /* reported by PART 2 */ }
    check(`layer map reader: every module the real map lists in its first column is read (${listed.length} listed; at least 10, so a reader that found nothing cannot pass)`,
        listed.length >= 10 && !!realMap && listed.every(m => realMap[m]), { got: listed.filter(m => !realMap || !realMap[m]) });
    // ACCOUNTED: every row of the real map that is NOT page code is held by a named detector that is in the suite. Leaving a row out of the page analysis must not leave it out of the
    // architecture: a Build / publish, schema or artifact row with no detector is a finding, and so is a new such row nobody accounted for.
    const ACCOUNTED = {
        'btnyc.json': ['verify_entity_first_migration.js', 'verify_entity_first_transition.js'],                    // the authored shape the source must reproduce; the end of its authoring role
        'schema-and-independent-validator': ['verify_entity_first_validator.js'],                                   // the source validator, separate from derivation (86 mutants)
        'compiler-derivation': ['verify_entity_first_migration.js', 'verify_entity_first_references.js'],           // the unchanged compiler reproduces the compiler-owned keys; derivation refuses an invalid source and cannot go stale
        'derived-runtime-artifact': ['verify_entity_first_references.js', 'verify_entity_first_transition.js'],     // the derived graph is what the source derives; the publication boundary's completion
        'qr.html': ['verify_module_deployment_shape.js', 'verify_r-system-layers_full_matrix.js'],                  // one home per module; the shell contract on the code it hosts
    };
    const suite = JSON.parse(fs.readFileSync(path.join(Q.REPO_ROOT, 'test_harness', 'MASTER_TEST_SUITE.json'), 'utf8'));
    const inSuite = new Set((suite.test_files || []).map(t => (typeof t === 'string' ? t : t.file || t.name)));
    const nonPage = realModel ? realModel.rows.filter(r => !(r.role === 'page-code' && /\.js$/.test(r.key))) : [];
    check(`layer map: every row that is not page code is accounted for by a detector in the suite (${nonPage.length} such rows: ${nonPage.map(r => r.key).join(', ')})`,
        !!realModel && nonPage.length >= 5 && nonPage.every(r => (ACCOUNTED[r.key] || []).length && ACCOUNTED[r.key].every(t => inSuite.has(t) && fs.existsSync(path.join(Q.REPO_ROOT, 'test_harness', t)))),
        { got: nonPage.filter(r => !(ACCOUNTED[r.key] || []).length || !ACCOUNTED[r.key].every(t => inSuite.has(t))).map(r => r.key) });
    check('layer map: the accountability table names no row the map does not have (a retired row cannot leave a stale claim of coverage)', !!realModel && Object.keys(ACCOUNTED).every(k => realModel.byKey.has(k)), { got: Object.keys(ACCOUNTED).filter(k => !realModel || !realModel.byKey.has(k)) });
}

// ═══ PART 2: the real code ═══════════════════════════════════════════════
console.log('\n=== R-SYSTEM-LAYERS / R-INVARIANT-BOUNDARY: every function complies with its layer ===');
let map;
try { map = L.loadLayerMap(); check('COMPONENT_LAYER_MAP.md exists, assigns btnyc.json, and names the shell that hosts headerless blocks', true); }
catch (e) { check('COMPONENT_LAYER_MAP.md exists, assigns btnyc.json, and names the shell that hosts headerless blocks', false, { got: e.message }); finish('R-SYSTEM-LAYERS: full matrix'); }

const { blocks } = Q.loadQr();
const all = [];
const perModule = [];
for (const b of blocks) {
    if (!b.src.trim()) continue;
    const mod = L.moduleOf(blocks, b);
    const layer = map[mod] || map.inline;
    if (layer === 'observation') continue; // observation tooling is not assembled into the page
    const label = mod === 'inline' ? `shell-hosted <script> @L${b.startLine} (no module header)` : mod;
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
