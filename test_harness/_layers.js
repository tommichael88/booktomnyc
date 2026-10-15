/**
 * _layers.js -- the ONE implementation of the four-layer structural analysis.
 *
 * Serves the layer rules, which are one mechanism viewed several ways (R-INVARIANT-SINGLEDEF):
 *   R-SYSTEM-LAYERS     (Enforced) "Full-matrix structural source analysis" -- verify_r-system-layers_full_matrix.js
 *   R-INVARIANT-BOUNDARY(Enforced) the same analysis, as the mechanical check                -- same test + the Rendering test
 *   the ship gate      a function that is new or changed must comply with its layer (the replaced edition's R-INVARIANT-COMPLY / R-INVARIANT-NOLEGACY; now R-SYSTEM-LAYERS applied to touched code, #214) -- verify_r-invariant-comply_ship_gate.js
 *
 * WHAT IS CHECKED (charter, "Layered Architecture": Owns / Must Not Own)
 *   Rendering  must not read session state (S.*), the pricing SSOT (DB.financial_engine / pricing_formulas /
 *              checkout_states), or call the engine functions                       -> _ui_boundary.js (unchanged)
 *   Logic      must not access the DOM, global window UI state, or declare inline event handlers
 *                logic-dom               `document`, DOM property/method names, the q()/qAll() DOM helpers
 *                logic-global-ui-state   the globals S / State / BLD / DOM, and window.<x> for UI/session state names
 *                                        (S, State, BLD, DOM, __store, _sq*, _current*, _last*). Caches and shared helper
 *                                        functions on window are NOT UI state (charter: caching/lookup structures are permitted
 *                                        implementation details); window.DB is the SSOT handle; assigning a FUNCTION to a
 *                                        window property is a module export. All allowed.
 *                logic-inline-handler    `onclick="..."`-style attributes in strings/templates, `.onclick = ...`
 *   Glue       must not contain business rules, pricing, or resolution
 *                glue-pricing-ssot       reading .financial_engine / .pricing_formulas / .checkout_states
 *                glue-engine-call        calling/referencing the six pricing & resolution engine functions directly
 *   Knowledge  must not contain executable logic, branching, or calculations (btnyc.json string values)
 *
 * WHAT IS NOT CHECKED, stated so nobody assumes coverage: "business rule" in Glue and "business logic" in a
 * renderer are only partly decidable from source. The checks above are the decidable subset (R-GOVERN-JUDGMENT-
 * RECLASSIFY: the specific case is Enforced, the general case stays Judgment). A Glue function that implements a
 * pricing rule without touching those tokens will pass here and must be caught in review.
 *
 * MODULE -> LAYER comes from COMPONENT_LAYER_MAP.md (the charter says assignments live there), never from this file.
 * A <script> block with no module header is the `inline` row.
 *
 * Files whose name starts with "_" are helpers; run_all.sh globs verify_*.js only.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const Q = require('./_qr_blocks.js');
const B = require('./_ui_boundary.js');
const { isFn, parseJs, tryParseJs, declaredNames, keyName, isValueRef } = Q;

// ─── layer map ──────────────────────────────────────────────────────────
/**
 * Reads COMPONENT_LAYER_MAP.md (the operator's own document; nothing in this file defines a layer) into a MODEL that keeps three things apart, because the map keeps them apart
 * and a single "layer" label for all three is how a deployment container ends up owning business code (T176, PENDING_DECISIONS #214):
 *
 *   responsibility  what the row's Layer cell says the thing IS, in the map's own words: knowledge-source, knowledge-validation, build-publish, published-artifact,
 *                   deployment-shell, logic, rendering, glue, observation. (A cell naming Logic is Logic even when it also says "Glue role": the orchestrator is held to the stricter
 *                   Logic contract. A cell naming State -- store.js "State boundary", appReducer.js "State transition / Logic" -- is Logic, because section 7 of the map counts the
 *                   store's legacy bridge as Logic-layer debt and relabelling it would improve a metric.)
 *   location        where it physically lives, read from the "Current source / status" cell: inline (a block in qr.html), external (modules/<name>.js), target-unwritten (a module whose
 *                   responsibility is recorded before its file exists), file, legacy-files, or unestablished (the map says the migration design must name it). Physical co-location is
 *                   not ownership: the five inline blocks are owned by their own rows, not by the page that hosts them.
 *   role            what it is for at deployment: page-code (assembled into or loaded by the page), shell (the container and its own bootstrap), build (tooling that runs before
 *                   publication), schema (the validator), data (authored source, published artifact).
 *
 * `loadLayerMap()` is the compact view the analyses use: module -> the CONTRACT its page code is held to (logic | rendering | glue | observation), `btnyc.json` -> knowledge, and
 * `inline` -> shell: a <script> block with no module header is code the page hosts and the map does not assign to a module. It is held to the shell contract (no business rules, no
 * pricing or resolution, no reading the authoring source as a fallback: the map's "Must not absorb" cell for the shell), it is reported as unowned, and it is not called Glue.
 * Rows that are not page code (schema/validator, compiler/derivation, published artifact) are in the model and are accounted for by name in verify_r-system-layers_full_matrix.js:
 * leaving them out of the page analysis does not leave them out of the architecture.
 *
 * What is refused, loudly, never skipped (a row that quietly drops out of the analysis is DEFECT-SILENT-SKIP): a Layer cell this reader does not know (the error names the row), a key
 * assigned twice, no module table, no `module.js` row, no Knowledge/source row, and no Deployment / UI shell row (headerless blocks would have no declared host).
 */
const LAYER_WORDS = [   // order matters: the first pattern that matches the Layer cell wins
    [/deployment/i, 'deployment-shell', 'shell', 'shell'],
    [/knowledge\s*\/\s*validation/i, 'knowledge-validation', null, 'schema'],
    [/build\s*\/\s*publish/i, 'build-publish', null, 'build'],
    [/published\s+knowledge\s+artifact/i, 'published-artifact', null, 'data'],
    [/knowledge|ssot/i, 'knowledge-source', 'knowledge', 'data'],
    [/logic|engine|state/i, 'logic', 'logic', 'page-code'],
    [/render/i, 'rendering', 'rendering', 'page-code'],
    [/glue|controller/i, 'glue', 'glue', 'page-code'],
    [/observ|diagnos/i, 'observation', 'observation', 'page-code'],
];
function parseLocation(status, key) {
    const t = status || '';
    const ticks = [...t.matchAll(/`([^`]+)`/g)].map(m => m[1]);
    let m;
    if (/target module/i.test(t)) return { kind: 'target-unwritten' };
    if (/inline block in\s*`qr\.html`/i.test(t)) return { kind: 'inline', host: 'qr.html' };
    if ((m = /external module:\s*`modules\/([A-Za-z0-9_]+)(?:\.js)?`/i.exec(t))) return { kind: 'external', file: `modules/${m[1]}.js` };
    if (/exact filename\/location is to be established|must be a separate generated output/i.test(t)) return { kind: 'unestablished' };
    if (/recorded legacy (?:path|locations)/i.test(t) && ticks.length) return { kind: 'legacy-files', files: ticks.filter(x => /[\/.]/.test(x)) };
    if (/current (?:app\/deployment )?file/i.test(t)) {
        const hosts = /(?:five|\d+)\s+inline\s+JavaScript\s+blocks:\s*([^.]*)/i.exec(t);
        return { kind: 'file', files: [key], hostsInline: hosts ? [...hosts[1].matchAll(/`([A-Za-z0-9_]+)`/g)].map(x => x[1]) : [] };
    }
    return { kind: 'unspecified' };
}
function loadLayerModel(mdPath) {
    const p = mdPath || path.join(Q.REPO_ROOT, 'COMPONENT_LAYER_MAP.md');
    if (!fs.existsSync(p)) throw new Error(`COMPONENT_LAYER_MAP.md is missing (${p}); the charter says module assignments are tracked there`);
    return layerModelOf(fs.readFileSync(p, 'utf8'), p);
}
/** The model of a map given as text (a pure function of the document, so a test can feed it a changed copy). Throws on every condition listed above. */
function layerModelOf(text, p) {
    const rows = [], unknown = []; let cols = null;
    for (const line of String(text).split('\n')) {
        if (!cols) {
            if (/^\|\s*Module(?:\s*\/\s*responsibility)?\s*\|\s*Layer\s*\|/i.test(line)) cols = line.split('|').slice(1, -1).map(c => c.trim().toLowerCase());
            continue;
        }
        if (!/^\|/.test(line)) break; // the table ended
        if (/^\|\s*-{3,}/.test(line)) continue; // the separator row
        const cells = line.split('|').slice(1, -1).map(c => c.trim());
        if (cells.length < 2) continue;
        const col = name => { const i = cols.findIndex(c => c.startsWith(name)); return i < 0 ? '' : (cells[i] || ''); };
        const tok = /^`([A-Za-z0-9_.]+)`/.exec(cells[0]);
        const key = tok ? tok[1] : cells[0].replace(/[`*]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const word = LAYER_WORDS.find(w => w[0].test(cells[1]));
        if (!word) { unknown.push(`${tok ? tok[1] : cells[0]} ("${cells[1]}")`); continue; }
        rows.push({ key, label: cells[0], layerCell: cells[1], responsibility: word[1], analysis: word[2], role: word[3],
            location: parseLocation(col('current source'), key), owns: col('owns'), mustNotAbsorb: col('must not') });
    }
    if (unknown.length) throw new Error(`COMPONENT_LAYER_MAP.md names a layer this reader does not know for: ${unknown.join('; ')}`);
    if (!cols) throw new Error('COMPONENT_LAYER_MAP.md has no module table (a header row `| Module / responsibility | Layer | ...`)');
    const seen = new Set();
    for (const r of rows) { if (seen.has(r.key)) throw new Error(`COMPONENT_LAYER_MAP.md assigns ${r.key} twice`); seen.add(r.key); }
    if (!rows.some(r => /\.js$/.test(r.key))) throw new Error('COMPONENT_LAYER_MAP.md module table has no `module.js` row');
    if (!rows.some(r => r.responsibility === 'knowledge-source')) throw new Error('COMPONENT_LAYER_MAP.md has no Knowledge row for the authored SSOT');
    if (!rows.some(r => r.responsibility === 'deployment-shell') && !seen.has('inline')) throw new Error('COMPONENT_LAYER_MAP.md has no Deployment / UI shell row: a <script> block with no module header would have no declared host');
    return { path: p, rows, byKey: new Map(rows.map(r => [r.key, r])) };
}
function loadLayerMap(mdPath) {
    const model = loadLayerModel(mdPath), map = {};
    for (const r of model.rows) if (r.analysis && r.role === 'page-code' && /\.js$/.test(r.key)) map[r.key] = r.analysis;
    map['btnyc.json'] = 'knowledge';
    // headerless <script> blocks: a row the map gives to `inline` wins; otherwise they are the shell's, under the shell contract
    const explicit = model.byKey.get('inline');
    map.inline = explicit && explicit.analysis ? explicit.analysis : 'shell';
    Object.defineProperty(map, '__model', { value: model, enumerable: false });
    return map;
}
const moduleOf = (blocks, b) => Q.moduleNameOfBlock(blocks, b.index) || 'inline';
/** The non-empty <script> blocks of the page that carry no module header: code the shell hosts and no row of the map owns. Each is { line, chars, head } -- `head` is its first 80 characters, so a report can name it. */
function unownedBlocks(html) {
    const blocks = Q.splitScriptBlocks(html);
    return blocks.filter(b => b.src.trim() && moduleOf(blocks, b) === 'inline').map(b => ({ line: b.startLine, chars: b.src.length, head: b.src.trim().replace(/\s+/g, ' ').slice(0, 80), src: b.src }));
}

// ─── units: the module's top-level functions (and its module-level statements) ───
/** UMD wrappers keep the real module body inside the factory argument: unwrap to it. */
function layerStatements(ast) {
    if (ast.body.length === 1 && ast.body[0].type === 'ExpressionStatement') {
        const e = ast.body[0].expression;
        if (e.type === 'CallExpression' && isFn(e.callee) && e.callee.body.type === 'BlockStatement') {
            const factory = e.arguments.find(a => isFn(a) && a.body.type === 'BlockStatement');
            return factory ? factory.body.body : e.callee.body.body;
        }
    }
    return ast.body;
}

function collectUnits(src, startLine) {
    const ast = parseJs(src);
    const units = [];
    const textOf = n => src.slice(n.start, n.end).replace(/\s+/g, ' ').slice(0, 40);
    const add = (owner, node, fnNode) => {
        const n = fnNode || node;
        units.push({
            owner, node, fnNode: fnNode || null,
            line: startLine + n.loc.start.line - 1, endLine: startLine + n.loc.end.line - 1,
            text: src.slice(n.start, n.end),
        });
    };
    for (const st of layerStatements(ast)) {
        if (st.type === 'FunctionDeclaration') add(st.id.name, st, st);
        else if (st.type === 'VariableDeclaration') {
            for (const d of st.declarations) {
                if (d.init && isFn(d.init) && d.id.type === 'Identifier') add(d.id.name, d, d.init);
                else add('<module-level>', d, null);
            }
        } else if (st.type === 'ExpressionStatement' && st.expression.type === 'AssignmentExpression' && isFn(st.expression.right)) {
            add(textOf(st.expression.left), st, st.expression.right);
        } else add('<module-level>', st, null);
    }
    return { units, ast };
}

// ─── per-layer detectors ────────────────────────────────────────────────
const LOGIC_DOM_PROPS = new Set(['innerHTML', 'outerHTML', 'textContent', 'innerText', 'classList', 'appendChild', 'insertBefore',
    'replaceChildren', 'setAttribute', 'removeAttribute', 'addEventListener', 'createElement', 'createTextNode', 'querySelector',
    'querySelectorAll', 'getElementById', 'insertAdjacentHTML', 'scrollIntoView', 'dataset']);
const GLOBAL_STATE_IDS = new Set(['S', 'State', 'BLD', 'DOM']);
const DOM_HELPER_CALLS = new Set(['q', 'qAll']);
const INLINE_HANDLER_RE = /\bon(?:click|change|input|submit|keydown|keyup|keypress|focus|blur|load|error|dblclick|mouseover|mouseout|mouseenter|mouseleave|touchstart|touchend)\s*=\s*\\?["']/i;
const GLOBAL_OBJECTS = B.GLOBAL_OBJECTS;
// "Global window UI state" (charter) = the session/UI globals, not every property hanging off window. The charter
// permits "indexes, memoization, caching, or precomputed lookup structures" as implementation details, so an NLP
// vocabulary cache (window._NLP) or a shared helper function (window._normServiceType) is not UI state. Decision
// recorded here where it lives (R-GOVERN-AUTONOMY); reverse it by widening this pattern.
const UI_WINDOW_NAME = /^(?:S|State|BLD|DOM|__store|_sq\w*|_current\w*|_last\w*)$/;

function analyzeLayerFunctions(src, layer, startLine) {
    // The SHELL contract (T176): code the page hosts and the map assigns to no module. It is held to the map's "Must not absorb" cell for the shell -- not to become a catch-all
    // business-logic owner (the decidable subset is the Glue detectors: no pricing-SSOT reads, no direct calls to the pricing/resolution engines) and not to read the authoring
    // source as a runtime fallback (a string that names btnyc_source). Same detectors as Glue, reported as shell so that nothing calls this code Glue.
    const shell = layer === 'shell';
    if (shell) layer = 'glue';
    const { units } = collectUnits(src, startLine);
    const violations = [];
    const shadowed = (name, fns) => fns.some(f => declaredNames(f).has(name));
    for (const unit of units) {
        const walk = (node, parent, grand, fns) => {
            if (!node || typeof node.type !== 'string') return;
            const here = () => ({ line: startLine + node.loc.start.line - 1, col: node.loc.start.column + 1 });
            const add = (kind, detail) => {
                const pos = here();
                violations.push({ layer, tier: 'layer', kind, detail, line: pos.line, col: pos.col, owner: unit.owner, ownerLine: unit.line,
                    inner: unit.owner, snippet: (src.split('\n')[node.loc.start.line - 1] || '').trim().slice(0, 110) });
            };
            if (layer === 'logic') {
                if (node.type === 'Identifier') {
                    if (node.name === 'document' && isValueRef(node, parent) && !shadowed('document', fns)) add('logic-dom', 'document');
                    if (GLOBAL_STATE_IDS.has(node.name) && isValueRef(node, parent) && !shadowed(node.name, fns)) add('logic-global-ui-state', node.name);
                }
                if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && DOM_HELPER_CALLS.has(node.callee.name) && !shadowed(node.callee.name, fns))
                    add('logic-dom', `${node.callee.name}() DOM helper`);
                if (node.type === 'MemberExpression') {
                    const k = keyName(node);
                    if (k && LOGIC_DOM_PROPS.has(k)) add('logic-dom', `.${k}`);
                    if (k && node.object.type === 'Identifier' && GLOBAL_OBJECTS.has(node.object.name) && UI_WINDOW_NAME.test(k)) {
                        const isAssignTarget = parent && parent.type === 'AssignmentExpression' && parent.left === node;
                        const isExport = isAssignTarget && (isFn(parent.right) || parent.right.type === 'Identifier');
                        if (!isExport) add('logic-global-ui-state', `${node.object.name}.${k}`);
                    }
                }
                if ((node.type === 'Literal' && typeof node.value === 'string' && INLINE_HANDLER_RE.test(node.value)) ||
                    (node.type === 'TemplateElement' && INLINE_HANDLER_RE.test(node.value.cooked || node.value.raw || ''))) add('logic-inline-handler', 'inline on*= attribute in markup');
                if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression' && /^on[a-z]+$/.test(keyName(node.left) || '')) add('logic-inline-handler', `.${keyName(node.left)} =`);
            }
            if (shell && ((node.type === 'Literal' && typeof node.value === 'string' && /btnyc_source/.test(node.value)) || (node.type === 'TemplateElement' && /btnyc_source/.test(node.value.raw || '')))) add('glue-source-fallback', 'names the authoring source (btnyc_source)');
            if (layer === 'glue') {
                if (node.type === 'MemberExpression') {
                    const k = keyName(node);
                    if (k && B.PRICING_SSOT_KEYS.has(k)) add('glue-pricing-ssot', `.${k}`);
                    if (k && B.ENGINE_FUNCTIONS.has(k)) add('glue-engine-call', `${k}()`);
                }
                if (node.type === 'Identifier' && B.ENGINE_FUNCTIONS.has(node.name) && isValueRef(node, parent)) add('glue-engine-call', `${node.name}`);
                if (node.type === 'Property' && parent && parent.type === 'ObjectPattern') {
                    const k = keyName(node); if (k && B.PRICING_SSOT_KEYS.has(k)) add('glue-pricing-ssot', `{ ${k} } destructured`);
                }
            }
            const next = isFn(node) ? fns.concat([node]) : fns;
            for (const key in node) {
                if (key === 'loc') continue;
                const v = node[key];
                if (Array.isArray(v)) v.forEach(c => walk(c, node, parent, next));
                else if (v && typeof v.type === 'string') walk(v, node, parent, next);
            }
        };
        walk(unit.node, null, null, []);
    }
    if (shell) violations.forEach(v => { v.layer = 'shell'; v.kind = v.kind.replace(/^glue-/, 'shell-'); });
    return { units, violations };
}

/** layer: 'rendering' | 'logic' | 'glue' | 'shell'. Returns { units, violations[] } with a uniform record shape. */
function analyzeLayer(src, layer, opts = {}) {
    const startLine = opts.startLine || 1;
    if (layer === 'rendering') {
        const r = B.analyze(src, { startLine });
        const { units } = collectUnits(src, startLine);
        return { units, violations: r.violations.filter(B.gating).map(v => Object.assign({}, v, { layer: 'rendering', kind: 'rendering-' + v.kind })) };
    }
    if (layer === 'logic' || layer === 'glue' || layer === 'shell') return analyzeLayerFunctions(src, layer, startLine);
    throw new Error('analyzeLayer: unsupported layer ' + layer);
}

// ─── knowledge: the SSOT must be declarative ────────────────────────────
const KNOWLEDGE_CODE_PATTERNS = [
    [/\bfunction\s*\(/, 'function expression'], [/=>/, 'arrow function'], [/\beval\s*\(/, 'eval'], [/\bnew\s+Function\b/, 'new Function'],
    [/\$\{[^}]*[^\w}\s.][^}]*\}/, 'template expression (operators/calls inside ${})'], [/;\s*return\b/, 'statement sequence'], [/\bconsole\.\w+\s*\(/, 'console call'],
    [/\bif\s*\([^)]*\)\s*[\{r]/, 'if-branch'], [/\bfor\s*\([^)]*\)\s*\{/, 'loop'],
];
function analyzeKnowledge(obj) {
    const out = [];
    (function walk(v, p) {
        if (typeof v === 'string') { for (const [re, what] of KNOWLEDGE_CODE_PATTERNS) if (re.test(v)) { out.push({ layer: 'knowledge', kind: 'knowledge-code', detail: what, path: p, snippet: v.slice(0, 90) }); break; } }
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`));
        else if (v && typeof v === 'object') for (const k of Object.keys(v)) walk(v[k], p ? `${p}.${k}` : k);
    })(obj, '');
    return out;
}

// ─── ship-time compliance gate (a touched function complies with its layer) ───
function unitsOfHtml(html, map) {
    const blocks = Q.splitScriptBlocks(html);
    const out = [], errors = [];
    for (const b of blocks) {
        if (!b.src.trim()) continue;
        const mod = moduleOf(blocks, b);
        const layer = map[mod] || map.inline;
        if (layer === 'observation') continue; // observation tooling (trace.js) is not assembled into the page and is held to its own contract
        const p = tryParseJs(b.src, b.startLine);
        if (p.error) { errors.push({ module: mod, line: b.startLine, error: p.error }); continue; }
        const an = analyzeLayer(b.src, layer, { startLine: b.startLine });
        for (const u of an.units) {
            if (!u.fnNode) continue;
            out.push(Object.assign({}, u, { module: mod, layer, violations: an.violations.filter(v => v.owner === u.owner && v.ownerLine === u.line) }));
        }
    }
    return { units: out, errors };
}

/**
 * A function is TOUCHED when it is new, its text differs from the base, or it moved to another layer.
 * Every touched function must be compliant in the layer it now lives in -- binary, no partial credit.
 */
function shipGate(baseHtml, headHtml, map) {
    const base = unitsOfHtml(baseHtml, map), head = unitsOfHtml(headHtml, map);
    const byName = new Map();
    for (const u of base.units) { if (!byName.has(u.owner)) byName.set(u.owner, []); byName.get(u.owner).push(u); }
    const seen = new Map(), touched = [];
    for (const u of head.units) {
        const i = seen.get(u.owner) || 0; seen.set(u.owner, i + 1);
        const b = (byName.get(u.owner) || [])[i];
        const why = !b ? 'new' : (b.layer !== u.layer ? 'moved' : (b.text !== u.text ? 'changed' : null));
        if (why) touched.push({ unit: u, why });
    }
    return { headFunctions: head.units.length, touched, violating: touched.filter(t => t.unit.violations.length), baseErrors: base.errors, headErrors: head.errors };
}

module.exports = { loadLayerMap, loadLayerModel, layerModelOf, unownedBlocks, moduleOf, collectUnits, analyzeLayer, analyzeKnowledge, unitsOfHtml, shipGate, LOGIC_DOM_PROPS, GLOBAL_STATE_IDS };
