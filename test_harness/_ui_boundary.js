/**
 * _ui_boundary.js -- the ONE definition of the R-INVARIANT-BOUNDARY analyzer.
 *
 * Imported by:
 *   verify_r-invariant-boundary_ui_renderer_layer.js  (the gate)
 *   tools/layer_drift_scan.js                          (runs the same analyzer over qr.html's git history)
 *
 * It lives here, not inside either consumer, so there is exactly one implementation of the rule
 * (R-INVARIANT-SINGLEDEF / R-INVARIANT-CANONICAL): a history scan that used a different detector
 * than the gate would be measuring something the gate does not enforce.
 *
 * Rule text, tiers, scope and the design decision behind the ADJACENT tier are documented in the
 * header of verify_r-invariant-boundary_ui_renderer_layer.js. To reverse the adjacent-tier
 * decision, set GATE_ADJACENT_TIER = false below.
 *
 * Files whose name starts with "_" are helpers, not tests (run_all.sh globs verify_*.js only).
 */
'use strict';

const { isFn, parseJs, moduleStatements, declaredNames, keyName, isValueRef } = require('./_qr_blocks.js');

// ─── Rule definition ────────────────────────────────────────────────────
const SESSION_STATE_NAME = 'S';
const PRICING_SSOT_KEYS = new Set(['financial_engine', 'pricing_formulas', 'checkout_states']);
const ENGINE_FUNCTIONS = new Set([
    'computeUnifiedQuote', 'orch_compute_confidence', 'resolveDynamicService',
    'tagValidForCategory', 'resolveBaseConfidenceStrategy', 'applyPricingFormula',
]);
const GLOBAL_OBJECTS = new Set(['window', 'globalThis', 'self']);
const GATE_ADJACENT_TIER = true; // see DECISION note in the header

const DOM_PROPS = new Set((
    'innerHTML textContent innerText className classList style appendChild append prepend ' +
    'insertBefore replaceChildren setAttribute removeAttribute addEventListener createElement ' +
    'createTextNode querySelector querySelectorAll getElementById dataset disabled checked focus ' +
    'scrollIntoView remove insertAdjacentHTML outerHTML children parentNode'
).split(' '));

// ─── AST helpers: imported from _qr_blocks.js (single definition) ──────
function isGlobalMember(n, prop) {
    return n.type === 'MemberExpression' && n.object.type === 'Identifier' && GLOBAL_OBJECTS.has(n.object.name) && keyName(n) === prop;
}
const isDbObject = o => (o.type === 'Identifier' && o.name === 'DB') || isGlobalMember(o, 'DB');

// ─── The analyzer ───────────────────────────────────────────────────────
/**
 * analyze(src, { startLine })
 *   -> { functions: [{name,line,endLine,domTouches,stateReads,bldRefs}], violations: [...] }
 * `startLine` is the absolute file line on which `src` begins (1-based), so
 * reported line numbers are real qr.html lines.
 */
function analyze(src, opts = {}) {
    const startLine = opts.startLine || 1;
    const srcLines = src.split('\n');
    const ast = parseJs(src);
    const stmts = moduleStatements(ast);

    // Evasion resistance (R-GOVERN-GOODHART: a source check is only the rule's OWN mechanism if trivial indirection cannot defeat it):
    //  * an alias of the global object (`const w = window; w.S.qty`) IS the global object;
    //  * a `const` whose value is a string constant (`const k = 'financial_engine'; DB[k]`) is that string where it is used as a key.
    // Aliases are matched by name over the whole module (conservative: a few extra flags are acceptable in a gate; a miss is not).
    const globalNames = new Set(GLOBAL_OBJECTS), constStrings = new Map();
    (function prepass(n) {
        if (!n || typeof n.type !== 'string') return;
        if (n.type === 'VariableDeclaration') {
            for (const d of n.declarations) {
                if (d.id.type !== 'Identifier' || !d.init) continue;
                if (d.init.type === 'Identifier' && GLOBAL_OBJECTS.has(d.init.name)) globalNames.add(d.id.name);
                if (n.kind !== 'const') continue;
                const lit = d.init.type === 'Literal' && typeof d.init.value === 'string' ? d.init.value
                    : (d.init.type === 'TemplateLiteral' && d.init.expressions.length === 0 ? d.init.quasis[0].value.cooked : null);
                if (lit !== null) constStrings.set(d.id.name, constStrings.has(d.id.name) && constStrings.get(d.id.name) !== lit ? '' : lit);
            }
        }
        for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(prepass); else if (v && typeof v.type === 'string') prepass(v); }
    })(ast);
    const keyNameR = m => {
        const k = keyName(m); if (k !== null) return k;
        const p = m.type === 'MemberExpression' ? m.property : m.key;
        return (m.computed && p && p.type === 'Identifier' && constStrings.get(p.name)) || null;
    };
    const isGlobalMemberA = (n, prop) => n.type === 'MemberExpression' && n.object.type === 'Identifier' && globalNames.has(n.object.name) && keyNameR(n) === prop;
    const isDbObjectA = o => (o.type === 'Identifier' && o.name === 'DB') || isGlobalMemberA(o, 'DB');

    const violations = [];
    const functions = [];
    const shadowed = (name, stack) => stack.some(f => declaredNames(f.node).has(name));
    const absLine = n => startLine + n.loc.start.line - 1;
    const snippet = n => (srcLines[n.loc.start.line - 1] || '').trim().slice(0, 110);
    const textOf = n => src.slice(n.start, n.end).replace(/\s+/g, ' ').slice(0, 40);

    // Units = the module's top-level statements, split so each declarator is its own owner.
    const units = [];
    const addUnit = (owner, node, fnNode) => units.push({ owner, node, fnNode: fnNode || null });
    for (const st of stmts) {
        if (st.type === 'FunctionDeclaration') addUnit(st.id.name, st, st);
        else if (st.type === 'VariableDeclaration') {
            for (const d of st.declarations) {
                if (d.init && isFn(d.init) && d.id.type === 'Identifier') addUnit(d.id.name, d, d.init);
                else addUnit('<module-level>', d, null);
            }
        } else if (st.type === 'ExpressionStatement' && st.expression.type === 'AssignmentExpression' && isFn(st.expression.right)) {
            addUnit(textOf(st.expression.left), st, st.expression.right);
        } else addUnit('<module-level>', st, null);
    }

    units.forEach(u => { u.line = absLine(u.fnNode || u.node); });

    function fnDisplayName(node, parent) {
        if (node.type === 'FunctionDeclaration' && node.id) return node.id.name;
        if (parent) {
            if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') return parent.id.name;
            if ((parent.type === 'Property' || parent.type === 'MethodDefinition') && parent.key) return parent.key.name || String(parent.key.value);
            if (parent.type === 'AssignmentExpression') return textOf(parent.left);
        }
        return '<anonymous>';
    }

    function add(tier, kind, detail, node, unit, stack, extra = {}) {
        violations.push({
            tier, kind, detail, write: !!extra.write,
            line: absLine(node), col: node.loc.start.column + 1,
            owner: unit.owner,
            ownerLine: unit.line,
            inner: stack.length ? stack[stack.length - 1].name : unit.owner,
            snippet: snippet(node),
        });
    }

    const isWriteTarget = (member, parent) =>
        !!parent && ((parent.type === 'AssignmentExpression' && parent.left === member) ||
            (parent.type === 'UpdateExpression' && parent.argument === member) ||
            (parent.type === 'UnaryExpression' && parent.operator === 'delete' && parent.argument === member));

    function visit(node, parent, grand, stack, unit) {
        if (!node || typeof node.type !== 'string') return;

        // ---- checks at this node ---------------------------------------
        if (node.type === 'Identifier') {
            if (node.name === SESSION_STATE_NAME && isValueRef(node, parent) && !shadowed(node.name, stack)) {
                let detail = 'S', write = false;
                if (parent && parent.type === 'MemberExpression' && parent.object === node) {
                    const k = keyNameR(parent);
                    detail = k ? `S.${k}` : 'S[…]';
                    write = isWriteTarget(parent, grand);
                } else if (parent && parent.type === 'AssignmentExpression' && parent.left === node) {
                    detail = 'S = …'; write = true;
                }
                add('charter', 'session-state', detail, node, unit, stack, { write });
            }
            if (ENGINE_FUNCTIONS.has(node.name) && isValueRef(node, parent)) {
                const isCall = parent && parent.type === 'CallExpression' && parent.callee === node;
                add('charter', 'engine-call', isCall ? `${node.name}(…)` : `${node.name} [reference]`, node, unit, stack);
            }
        }

        if (node.type === 'FunctionDeclaration' && node.id && ENGINE_FUNCTIONS.has(node.id.name)) {
            add('charter', 'engine-definition', `function ${node.id.name}() defined in the renderer`, node, unit, stack);
        }

        if (node.type === 'MemberExpression') {
            const k = keyNameR(node);
            if (k && isGlobalMemberA(node, SESSION_STATE_NAME)) {
                add('charter', 'session-state', `${node.object.name}.S`, node, unit, stack, { write: isWriteTarget(node, parent) });
            }
            if (k && ENGINE_FUNCTIONS.has(k)) {
                add('charter', 'engine-call', `${textOf(node.object)}.${k}()`, node, unit, stack);
            }
            if (k && PRICING_SSOT_KEYS.has(k)) {
                const w = isWriteTarget(node, parent);
                if (isDbObjectA(node.object)) add('charter', 'ssot-pricing', `DB.${k}${w ? ' (write)' : ''}`, node, unit, stack, { write: w });
                else add('adjacent', 'ssot-pricing-adjacent', `${textOf(node.object)}.${k}${w ? ' (write)' : ''}`, node, unit, stack, { write: w });
            }
        }

        // destructuring: const { financial_engine } = DB  /  function f({ financial_engine })
        if (node.type === 'Property' && parent && parent.type === 'ObjectPattern') {
            const k = keyNameR(node);
            if (k && PRICING_SSOT_KEYS.has(k)) {
                const init = grand && grand.type === 'VariableDeclarator' && grand.id === parent ? grand.init : null;
                if (init && isDbObjectA(init)) add('charter', 'ssot-pricing', `{ ${k} } = DB`, node, unit, stack);
                else add('adjacent', 'ssot-pricing-adjacent', `{ ${k} } destructured`, node, unit, stack);
            }
            if (k === SESSION_STATE_NAME && grand && grand.type === 'VariableDeclarator' && grand.init &&
                grand.init.type === 'Identifier' && GLOBAL_OBJECTS.has(grand.init.name)) {
                add('charter', 'session-state', `{ S } = ${grand.init.name}`, node, unit, stack);
            }
            if (k && ENGINE_FUNCTIONS.has(k)) add('charter', 'engine-call', `{ ${k} } destructured`, node, unit, stack);
        }

        // object literal DEFINING a pricing block: { financial_engine: { … } }
        if (node.type === 'Property' && parent && parent.type === 'ObjectExpression') {
            const k = keyNameR(node);
            if (k && PRICING_SSOT_KEYS.has(k)) add('adjacent', 'pricing-structure-literal', `literal defines "${k}"`, node, unit, stack);
        }

        // ---- recurse ---------------------------------------------------
        let nextStack = stack;
        if (isFn(node)) nextStack = stack.concat([{ node, name: fnDisplayName(node, parent) }]);
        for (const key in node) {
            if (key === 'loc') continue;
            const v = node[key];
            if (Array.isArray(v)) v.forEach(c => visit(c, node, parent, nextStack, unit));
            else if (v && typeof v.type === 'string') visit(v, node, parent, nextStack, unit);
        }
    }

    for (const unit of units) {
        const before = violations.length;
        visit(unit.node, null, null, [], unit);
        if (unit.fnNode) {
            // per-function census data
            let dom = 0, stateReads = 0, bld = 0;
            (function scan(n) {
                if (!n || typeof n.type !== 'string') return;
                if (n.type === 'Identifier' && n.name === 'document') dom++;
                if (n.type === 'MemberExpression' && !n.computed && n.property.type === 'Identifier' && DOM_PROPS.has(n.property.name)) dom++;
                if (n.type === 'Identifier' && n.name === 'State') stateReads++;
                if (n.type === 'Identifier' && n.name === 'BLD') bld++;
                for (const k in n) {
                    if (k === 'loc') continue;
                    const v = n[k];
                    if (Array.isArray(v)) v.forEach(scan); else if (v && typeof v.type === 'string') scan(v);
                }
            })(unit.fnNode);
            functions.push({
                name: unit.owner, line: unit.line, endLine: startLine + unit.fnNode.loc.end.line - 1,
                domTouches: dom, stateReads, bldRefs: bld, violations: violations.length - before,
            });
        }
    }
    return { functions, violations };
}

const gating = v => v.tier === 'charter' || GATE_ADJACENT_TIER;

module.exports = {
    analyze, gating, isGlobalMember, isDbObject,
    SESSION_STATE_NAME, PRICING_SSOT_KEYS, ENGINE_FUNCTIONS, GLOBAL_OBJECTS, GATE_ADJACENT_TIER, DOM_PROPS,
};
