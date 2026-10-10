/**
 * _qr_blocks.js -- the one place that knows how to find a module's <script>
 * block inside qr.html and map a position in that block back to an absolute
 * qr.html line number.
 *
 * WHY THIS EXISTS (R-INVARIANT-SINGLEDEF / R-SYSTEM-SCRIPT): the structural
 * tests for R-INVARIANT-BOUNDARY and R-INVARIANT-DELETION both need to parse
 * exactly the same block that extract_modules.js materialises as
 * UIRenderer.js, AppController.js, etc. extract_modules.js is a script with
 * side effects (it writes files on require), so it cannot be imported. The
 * locating rule is therefore stated here, once, for the tests that need an
 * in-memory parse, and it is deliberately the SAME rule: a module's block is
 * the <script> whose own first comment is the JSDoc header
 *
 *     /**
 *      * <ModuleName>.js
 *
 * A bare substring match is NOT used -- these headers cross-reference each
 * other by filename, and extract_modules.js documents that a substring match
 * once mis-extracted three modules as byte copies of another.
 *
 * Files whose name starts with "_" are helpers, not tests: run_all.sh only
 * globs verify_*.js, so this file is never executed on its own.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const page = require('./_page.js');   // T158: the page's external <script src> files are part of "the page" (see _page.js)

const REPO_ROOT = path.resolve(__dirname, '..');
// BTNYC_QR_FILE lets the structural tests analyse any copy (a historical commit, a renamed file) without touching qr.html.
const QR_PATH = process.env.BTNYC_QR_FILE ? path.resolve(process.env.BTNYC_QR_FILE) : path.join(REPO_ROOT, 'qr.html');

const MODULE_NAMES = [
    'pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js',
    'UIRenderer.js', 'AppController.js', 'appReducer.js', 'store.js',
    'cart_logic.js',   // T158: the cart-line identity, merge and total rules (Logic); an inline block until the page loads modules/cart_logic.js
];

function headerRegex(moduleFile) {
    const esc = moduleFile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('^\\s*/\\*\\*\\s*\\r?\\n\\s*\\*\\s*' + esc + '\\b');
}

/**
 * Split an HTML string into its <script> blocks.
 * Each block: { index, src, offset, startLine }
 *   offset    -- index in `html` of the first character of `src`
 *   startLine -- 1-based qr.html line on which `src` begins
 * A position on line L (1-based) inside `src` is absolute line
 * `startLine + L - 1`.
 */
function splitScriptBlocks(html) {
    const blocks = [];
    const re = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g;
    let m;
    while ((m = re.exec(html)) !== null) {
        const offset = m.index + m[0].indexOf('>') + 1;
        const startLine = html.slice(0, offset).split('\n').length;
        blocks.push({ index: blocks.length, src: m[1], offset, startLine });
    }
    return blocks;
}

// T158: `html` is the ASSEMBLED document -- each external <script src> under the deployed base replaced in place by the repo file it names (_page.js). Line numbers
// (startLine, absLine) are therefore lines of the assembled document; a block that came from an external file also carries `external` = its repo-relative path.
function loadQr(qrPath) {
    const raw = fs.readFileSync(qrPath || QR_PATH, 'utf8');
    const html = page.assemble(raw);
    const blocks = splitScriptBlocks(html);
    const ext = page.externalScripts(raw).filter(s => s.repoPath);
    // an assembled external block is the one whose text equals the repo file's text; tag it so a report can name the real file
    for (const s of ext) {
        const text = fs.readFileSync(path.join(page.REPO_ROOT, s.repoPath), 'utf8');
        const b = blocks.find(x => x.src === '\n' + text + '\n');
        if (b) b.external = s.repoPath;
    }
    return { html, blocks };
}

/** Returns the block whose own header names `moduleFile`, or null. */
function findModuleBlock(blocks, moduleFile) {
    const re = headerRegex(moduleFile);
    return blocks.find(b => re.test(b.src)) || null;
}

/** Which module (if any) owns the block at `blockIndex`. */
function moduleNameOfBlock(blocks, blockIndex) {
    const b = blocks[blockIndex];
    if (!b) return null;
    for (const name of MODULE_NAMES) if (headerRegex(name).test(b.src)) return name;
    return null;
}


// ─── Shared AST helpers (single definition; R-INVARIANT-SINGLEDEF) ──────
const isFn = n => !!n && (n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression');

function parseJs(src, extra) {
    return acorn.parse(src, Object.assign({
        ecmaVersion: 'latest', sourceType: 'script', locations: true,
        allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true,
    }, extra || {}));
}

/**
 * Non-throwing parse: { ast } on success, { error: { message, line, column, absLine } } on failure,
 * where absLine maps the failure to an absolute qr.html line when `startLine` is given.
 */
function tryParseJs(src, startLine, extra) {
    try { return { ast: parseJs(src, extra) }; }
    catch (e) {
        const line = e.loc ? e.loc.line : null;
        return { error: { message: e.message, line, column: e.loc ? e.loc.column : null,
            absLine: line && startLine ? startLine + line - 1 : null } };
    }
}

/** Statements that make up the module. A lone IIFE wrapper is unwrapped. */
function moduleStatements(ast) {
    if (ast.body.length === 1 && ast.body[0].type === 'ExpressionStatement') {
        const e = ast.body[0].expression;
        if (e.type === 'CallExpression' && isFn(e.callee) && e.callee.body.type === 'BlockStatement') {
            return e.callee.body.body;
        }
    }
    return ast.body;
}

function patternNames(p, out) {
    if (!p) return;
    switch (p.type) {
        case 'Identifier': out.add(p.name); break;
        case 'ObjectPattern': p.properties.forEach(pr => patternNames(pr.type === 'RestElement' ? pr.argument : pr.value, out)); break;
        case 'ArrayPattern': p.elements.forEach(el => patternNames(el, out)); break;
        case 'AssignmentPattern': patternNames(p.left, out); break;
        case 'RestElement': patternNames(p.argument, out); break;
        default: break;
    }
}

const _declCache = new WeakMap();
/** Names declared in a function's OWN scope (params + var/let/const/function/class/catch), not nested functions'. */
function declaredNames(fnNode) {
    if (_declCache.has(fnNode)) return _declCache.get(fnNode);
    const names = new Set();
    fnNode.params.forEach(p => patternNames(p, names));
    (function scan(n) {
        if (!n || typeof n.type !== 'string') return;
        if (n !== fnNode && isFn(n)) { if (n.type === 'FunctionDeclaration' && n.id) names.add(n.id.name); return; }
        if (n.type === 'VariableDeclarator') patternNames(n.id, names);
        if (n.type === 'ClassDeclaration' && n.id) names.add(n.id.name);
        if (n.type === 'CatchClause' && n.param) patternNames(n.param, names);
        for (const k in n) {
            if (k === 'loc') continue;
            const v = n[k];
            if (Array.isArray(v)) v.forEach(scan); else if (v && typeof v.type === 'string') scan(v);
        }
    })(fnNode.body);
    _declCache.set(fnNode, names);
    return names;
}

/** Name of the key a MemberExpression accesses / a Property declares: .name, ['name'], name:, 'name': -- else null. */
function keyName(n) {
    const key = n.type === 'MemberExpression' ? n.property : n.key;
    if (!key) return null;
    if (!n.computed && key.type === 'Identifier') return key.name;
    if (key.type === 'Literal' && typeof key.value === 'string') return key.value;
    // `financial_engine` (a template literal with no ${...}) is the string constant it spells -- an evasion of the literal-key check otherwise
    if (key.type === 'TemplateLiteral' && key.expressions.length === 0 && key.quasis.length === 1 && n.computed) return key.quasis[0].value.cooked;
    return null;
}

/** Is this Identifier a value reference (not a property name / object key / label / function-declaration id)? */
function isValueRef(n, parent) {
    if (!parent) return true;
    if (parent.type === 'MemberExpression' && parent.property === n && !parent.computed) return false;
    if ((parent.type === 'Property' || parent.type === 'MethodDefinition') && parent.key === n && !parent.computed && !parent.shorthand) return false;
    if (parent.type === 'FunctionDeclaration' && parent.id === n) return false;
    if ((parent.type === 'LabeledStatement' || parent.type === 'BreakStatement' || parent.type === 'ContinueStatement') && parent.label === n) return false;
    return true;
}

/**
 * Depth-first walk. cb(node, parent, grand, enclosingFnNodes) for every node.
 * `enclosingFnNodes` lists the function nodes the node sits inside (outermost first).
 */
function walkAst(root, cb) {
    (function go(node, parent, grand, fns) {
        if (!node || typeof node.type !== 'string') return;
        cb(node, parent, grand, fns);
        const next = isFn(node) ? fns.concat([node]) : fns;
        for (const k in node) {
            if (k === 'loc') continue;
            const v = node[k];
            if (Array.isArray(v)) v.forEach(c => go(c, node, parent, next));
            else if (v && typeof v.type === 'string') go(v, node, parent, next);
        }
    })(root, null, null, []);
}

const isShadowedBy = (name, fnNodes) => fnNodes.some(f => declaredNames(f).has(name));

module.exports = {
    isFn, parseJs, tryParseJs, moduleStatements, patternNames, declaredNames, keyName, isValueRef, walkAst, isShadowedBy,
    REPO_ROOT, QR_PATH, MODULE_NAMES,
    splitScriptBlocks, loadQr, findModuleBlock, moduleNameOfBlock, headerRegex,
};
