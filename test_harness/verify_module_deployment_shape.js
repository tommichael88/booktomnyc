#!/usr/bin/env node
/**
 * verify_module_deployment_shape.js -- the class detector for "a module has one home, and its header says where that is".
 *
 * @enforces R-INVARIANT-SINGLEDEF
 * @enforces R-SYSTEM-SCRIPT
 *
 * THE CLASS (R-INVARIANT-SINGLEDEF; R-SYSTEM-SCRIPT: "script-tag scope is real"): a module lives in one place, and what a file says about how it reaches the browser is what the page does.
 * Two things went wrong with the cart module and the headers around it, and neither was red:
 *   - cart_logic existed twice, as the inline block qr.html runs and as modules/cart_logic.js, which nothing loaded. Every edit had to be made twice, and the only guard was a test that
 *     fails when the two copies differ -- a test that holds a duplicate in place instead of forbidding it (PENDING_DECISIONS #129).
 *   - three inline blocks said "Loaded as a plain global-scope <script> ... ships as a verified, standalone reference module" (they are inline; nothing is shipped alongside them), one said
 *     "this file MUST be loaded before qr.html's main <script> block" (there is no such block), and nlp_engine.js, which the page DOES load by <script src>, said qr.html "was NOT modified
 *     to load this file". A reader who trusted them would edit a file that does not run, or not publish one that does.
 * T163 (item F) deleted the copy and gave each inline block one Deployment statement. This file holds the class, not those two files. It asserts:
 *
 *   1. ONE PLACE            Every module the tooling names (_qr_blocks.js MODULE_NAMES) is in the page exactly once: as an inline block (found by its own header) or as one <script src>.
 *                           No file in modules/ shares a name with an inline block (the cart_logic shape), and no file in modules/ is unloaded (an orphan is a second copy waiting to happen).
 *                           Every name is git-ignored at the repo root, where extract_modules.js writes its generated reference copies.
 *   2. THE HEADER SAYS IT   An inline module's header carries a "Deployment:" statement, and the shape it states ("runs inline from qr.html") is the shape the page has. An external module's
 *                           header either has no such statement or states its own modules/ file. Outside that statement, an inline header makes no load-shape claim (no "<script>", "loaded as",
 *                           "must be loaded", "standalone", "single-file", "ships as"); an external header makes no claim that it is not loaded ("NOT modified to load", "single-file deployment",
 *                           "runs inline").
 *   3. LOAD ORDER IS TRUE   "load X.js before this file" in a header names a module that comes earlier in the page.
 *   3b. THE LAYER MAP SAYS IT   COMPONENT_LAYER_MAP.md's module table states each module's source ("inline", or "external: `modules/X.js`") as the page has it. (Its line numbers are not checked:
 *                           they move with every edit above a block, and a test that fails on an unrelated edit gets disabled; the column says "as of T163" and is not a claim of this file.)
 *   4. NON-VACUITY          Each leg is shown able to fail on synthetic pages (a twin in modules/, an orphan, a false header, a missing statement, a wrong shape, a wrong order, a missing
 *                           .gitignore line), and shown not to flag a correct page.
 *
 * WHAT THIS DOES NOT COVER (named so it is not read as more): a load-shape claim worded in a way the vocabulary above does not contain; claims in a comment that is not the module's header;
 * a module that is in neither MODULE_NAMES nor loaded by <script src>; any other document that restates where a module lives. The detector reads the page as written (qr.html's own text), NOT the assembled page: assembling hides exactly the
 * difference between "inline" and "loaded".
 *
 * RUN ON ANOTHER TREE (G-INVARIANT-PREFIX; run against the tree as it was BEFORE the fix, this file fails):
 *     BTNYC_QR_FILE=<tree>/qr.html BTNYC_PAGE_ROOT=<tree> node test_harness/verify_module_deployment_shape.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const Q = require('./_qr_blocks.js');
const Page = require('./_page.js');

let pass = 0, fail = 0;
const check = (label, ok, detail) => {
    if (ok) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); if (detail) console.log(`      ${detail}`); }
};
const section = (title, fn) => {
    console.log(`\n=== ${title} ===`);
    try { fn(); } catch (e) { check(`${title}: ran to completion`, false, String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')); }
};

// ---- the vocabulary of load-shape claims (the list the "does not cover" paragraph refers to) ----------------------------------------------------------------------------------------
// In an INLINE module's header, outside its Deployment statement: anything that says the block is loaded, shipped alone, or ordered against a script block.
const INLINE_CLAIMS = [
    [/<script\b/i, 'names a <script> tag'],
    [/\bloaded as\b/i, '"loaded as"'],
    [/\bmust be loaded\b/i, '"must be loaded"'],
    [/\bstandalone\b/i, '"standalone"'],
    [/\bsingle-file\b/i, '"single-file"'],
    [/\bships as\b/i, '"ships as"'],
    [/\bnot modified\b/i, '"not modified"'],
];
// In an EXTERNAL module's header: anything that says the page does not load it.
const EXTERNAL_CLAIMS = [
    [/\bnot modified to load\b/i, '"not modified to load"'],
    [/\bsingle-file deployment\b/i, '"single-file deployment"'],
    [/\bfully self-contained\b/i, '"fully self-contained"'],
    [/\bruns inline\b/i, '"runs inline"'],
];
const ORDER_CLAIM = /\bload\s+(?:the\s+)?([A-Za-z_][\w]*\.js)\s+before\s+this\s+file\b/gi;

// ---- reading headers ----------------------------------------------------------------------------------------------------------------------------------------------------------------
const stripStars = c => c.split('\n').map(l => l.replace(/^\s*(?:\/\*\*|\*\/|\*)?[ \t]?/, '').replace(/\*\/\s*$/, '')).join('\n');
const leadingComment = text => { const m = /^\s*\/\*\*[\s\S]*?\*\//.exec(text); return m ? m[0] : ''; };
const firstDocComment = text => { const m = /\/\*\*[\s\S]*?\*\//.exec(text); return m ? m[0] : ''; };
/** The Deployment statement of a header: from the line that starts "Deployment:" to the next blank comment line. null when the header has none. */
function deploymentOf(headerText) {
    const t = stripStars(headerText), i = t.search(/^Deployment:/m);
    if (i < 0) return { text: t, statement: null };
    const rest = t.slice(i), end = rest.search(/\n[ \t]*\n/), statement = end < 0 ? rest : rest.slice(0, end);
    return { text: t.replace(statement, ''), statement };
}
const oneLine = s => s.replace(/\s+/g, ' ');
/** The shape a Deployment statement claims: 'inline', 'external:<modules/file>', or 'unreadable'. */
function claimedShape(statement) {
    const flat = oneLine(statement);
    if (/\bruns inline from qr\.html\b/i.test(flat)) return 'inline';
    const m = /\bloaded from (modules\/[\w.]+)/i.exec(flat);
    return m ? 'external:' + m[1] : 'unreadable';
}

/**
 * analyse(raw, modFiles, gitignore, names, layerMap) -> [{ id, label, offenders: [string] }]. Pure: the real run and the probes feed it the same way.
 *   raw        qr.html as written
 *   modFiles   { 'name.js': text } for every .js file under modules/
 *   gitignore  the text of .gitignore
 *   names      the module names the tooling knows (Q.MODULE_NAMES)
 *   layerMap   the text of COMPONENT_LAYER_MAP.md
 */
function analyse(raw, modFiles, gitignore, names, layerMap) {
    const blocks = Q.splitScriptBlocks(raw);
    const scripts = Page.externalScripts(raw).filter(s => s.repoPath);
    const inlineOf = n => blocks.filter(b => b.src.trim() && Q.headerRegex(n).test(b.src));
    const externalOf = n => scripts.filter(s => s.repoPath === 'modules/' + n);
    const shape = n => inlineOf(n).length && !externalOf(n).length ? 'inline' : externalOf(n).length && !inlineOf(n).length ? 'external:modules/' + n : null;
    const position = n => inlineOf(n).length ? inlineOf(n)[0].offset : externalOf(n).length ? externalOf(n)[0].index : -1;
    const externalNames = [...new Set(scripts.filter(s => /^modules\/[^/]+\.js$/.test(s.repoPath)).map(s => s.repoPath.slice('modules/'.length)))];
    const allNames = [...new Set([...names, ...externalNames])];
    const rows = [];
    const row = (id, label, offenders) => rows.push({ id, label, offenders });

    row('one-place', 'every module the tooling names is in the page exactly once: one inline block or one <script src>, never both, never neither', names.flatMap(n => {
        const i = inlineOf(n).length, e = externalOf(n).length;
        return i + e === 1 ? [] : [`${n}: ${i} inline block(s) and ${e} <script src>`];
    }));
    row('no-twin', 'no file in modules/ shares a name with an inline block (the cart_logic shape: the same module in two places)', Object.keys(modFiles).filter(f => inlineOf(f).length).map(f => `modules/${f} is also an inline block of the page`));
    row('no-orphan', 'every file in modules/ is loaded by a <script src> of the page (an unloaded copy is a second definition waiting for an edit)', Object.keys(modFiles).filter(f => !externalOf(f).length).map(f => `modules/${f} is loaded by nothing`));
    row('ignored', 'every module name is git-ignored at the repo root, where the generated reference copies are written (extract_modules.js)', names.filter(n => !new RegExp('^/' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'm').test(gitignore)).map(n => `/${n} is not in .gitignore`));

    const lmCell = {};
    for (const line of String(layerMap || '').split('\n')) { const m = /^\|\s*`([\w.]+\.js)`\s*\|[^|]*\|\s*([^|]*?)\s*\|/.exec(line); if (m) lmCell[m[1]] = m[2]; }
    const lmShape = cell => /^inline$/.test(cell) ? 'inline' : (m => m ? 'external:' + m[1] : 'unreadable')(/^external:\s*`(modules\/[\w.]+)`$/.exec(cell));
    row('layer-map', 'COMPONENT_LAYER_MAP.md states each module\'s source as the page has it ("inline", or "external: `modules/X.js`")', allNames.filter(n => shape(n)).flatMap(n =>
        lmCell[n] === undefined ? [`${n}: no row in the Layer Map's module table`] : lmShape(lmCell[n]) === shape(n) ? [] : [`${n}: the page has it ${shape(n)}, the Layer Map says "${lmCell[n]}"`]));
    const stmtBad = [], inlineClaimBad = [], extClaimBad = [], orderBad = [];
    let orderChecked = 0;
    for (const n of allNames) {
        const real = shape(n);
        if (!real) continue;                                   // 'one-place' already reports a module in neither or both
        const isInline = real === 'inline';
        const header = isInline ? leadingComment(inlineOf(n)[0].src) : firstDocComment(modFiles[n] || '');
        const { text, statement } = deploymentOf(header);
        if (isInline) {
            if (!statement) stmtBad.push(`${n}: inline, and its header has no "Deployment:" statement`);
            else { const c = claimedShape(statement); if (c !== 'inline') stmtBad.push(`${n}: the page runs it inline, its Deployment statement claims ${c}`); }
            for (const [re, what] of INLINE_CLAIMS) if (re.test(text)) inlineClaimBad.push(`${n}: header outside its Deployment statement makes a load-shape claim (${what})`);
        } else {
            if (statement) { const c = claimedShape(statement); if (c !== real) stmtBad.push(`${n}: loaded as ${real}, its Deployment statement claims ${c}`); }
            for (const [re, what] of EXTERNAL_CLAIMS) if (re.test(oneLine(text))) extClaimBad.push(`${n}: loaded by the page from ${real.slice('external:'.length)}, its header says otherwise (${what})`);
        }
        const flat = oneLine(text);
        let m; ORDER_CLAIM.lastIndex = 0;
        while ((m = ORDER_CLAIM.exec(flat)) !== null) {
            orderChecked++;
            const other = m[1], po = position(other), pn = position(n);
            if (po < 0) orderBad.push(`${n}: says load ${other} before it, and the page has no ${other}`);
            else if (!(po < pn)) orderBad.push(`${n}: says load ${other} before it, and the page loads ${other} after it`);
        }
    }
    row('statement', 'an inline module\'s header has a Deployment statement and it states the shape the page has; an external module\'s states its own modules/ file or is absent', stmtBad);
    row('inline-claims', 'an inline module\'s header makes no load-shape claim outside its Deployment statement', inlineClaimBad);
    row('external-claims', 'an external module\'s header does not say the page does not load it', extClaimBad);
    row('order', 'every "load X.js before this file" in a header names a module that comes earlier in the page', orderBad);
    rows.find(r => r.id === 'order').checked = orderChecked;
    return rows;
}
const fails = (rows, id) => rows.find(r => r.id === id).offenders.length > 0;
const allClean = rows => rows.every(r => r.offenders.length === 0);

// ---- the real tree -----------------------------------------------------------------------------------------------------------------------------------------------------------------
const ROOT = process.env.BTNYC_PAGE_ROOT ? path.resolve(process.env.BTNYC_PAGE_ROOT) : Page.REPO_ROOT, QR = Page.QR_PATH;
const raw = fs.readFileSync(QR, 'utf8');
const modDir = path.join(ROOT, 'modules');
const modFiles = fs.existsSync(modDir) ? Object.fromEntries(fs.readdirSync(modDir).filter(f => f.endsWith('.js')).map(f => [f, fs.readFileSync(path.join(modDir, f), 'utf8')])) : {};
const gitignorePath = path.join(ROOT, '.gitignore');
const gitignore = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
const layerMapPath = path.join(ROOT, 'COMPONENT_LAYER_MAP.md');
const layerMap = fs.existsSync(layerMapPath) ? fs.readFileSync(layerMapPath, 'utf8') : '';

section('1-3. the page as written: one home per module, a header that says it, a load order that is true', () => {
    const rows = analyse(raw, modFiles, gitignore, Q.MODULE_NAMES, layerMap);
    const inl = Q.MODULE_NAMES.filter(n => Q.splitScriptBlocks(raw).some(b => b.src.trim() && Q.headerRegex(n).test(b.src)));
    const ext = Page.externalScripts(raw).filter(s => s.repoPath).map(s => s.repoPath);
    console.log(`  (inline: ${inl.join(', ')}; loaded by <script src>: ${ext.join(', ')}; files in modules/: ${Object.keys(modFiles).join(', ')})`);
    for (const r of rows) check(r.label, r.offenders.length === 0, r.offenders.join(' | '));
    const oc = rows.find(r => r.id === 'order').checked;
    console.log(`  (${oc} load-order claim(s) found in the headers and checked)`);
    check('the load-order leg sees at least one claim on this page (a pattern that matched nothing would pass for the wrong reason)', oc >= 1, `${oc} claims`);
});

// ---- non-vacuity: synthetic pages ---------------------------------------------------------------------------------------------------------------------------------------------------
section('4. non-vacuity: each leg is shown able to fail, and a correct page is shown clean', () => {
    const DEP_INLINE = ' * Deployment: single-file `qr.html` is the deployment unit. This block runs inline from qr.html; edit qr.html.\n';
    const inlineBlock = (name, extra) => `<script>\n/**\n * ${name}\n *\n * Some description.\n *\n${extra === undefined ? DEP_INLINE : extra}*/\nfunction f_${name.replace(/\W/g, '_')}() {}\n</script>\n`;
    const srcTag = name => `<script src="${Page.DEPLOY_BASE}modules/${name}"></script>\n`;
    const names = ['foo.js', 'bar.js'], ign = '/foo.js\n/bar.js\n';
    const LM = '| Module | Layer | Source in the page | start |\n|---|---|---|---|\n| `foo.js` | Logic/Engine | inline | line 1 |\n| `bar.js` | Logic/Engine | external: `modules/bar.js` | line 9 |\n';
    const A = (rawPage, files, ig, nm, lm) => analyse(rawPage, files, ig, nm, lm === undefined ? LM : lm);
    const good = inlineBlock('foo.js') + srcTag('bar.js');
    const goodFiles = { 'bar.js': '/**\n * bar.js\n *\n * Some description.\n */\nfunction b() {}\n' };

    check('a correct page (one inline module, one loaded module, a Deployment statement, both ignored) is clean', allClean(A(good, goodFiles, ign, names)),
        JSON.stringify(A(good, goodFiles, ign, names).filter(r => r.offenders.length)));
    check('leg 1 flags a module that is an inline block AND a file in modules/ (the cart_logic shape)', fails(A(good, { ...goodFiles, 'foo.js': 'x' }, ign, names), 'no-twin'));
    check('leg 1 flags a file in modules/ that nothing loads', fails(A(good, { ...goodFiles, 'baz.js': 'x' }, ign, names), 'no-orphan'));
    check('leg 1 flags a module that is both an inline block and a <script src>', fails(A(good + srcTag('foo.js'), goodFiles, ign, names), 'one-place'));
    check('leg 1 flags a named module that the page does not contain', fails(A(inlineBlock('foo.js'), {}, ign, names), 'one-place'));
    check('leg 1 flags a module name missing from .gitignore', fails(A(good, goodFiles, '/foo.js\n', names), 'ignored'));
    check('leg 2 flags an inline header with no Deployment statement', fails(A(inlineBlock('foo.js', ' * (nothing)\n') + srcTag('bar.js'), goodFiles, ign, names), 'statement'));
    check('leg 2 flags an inline header whose Deployment statement claims it is loaded from modules/', fails(A(inlineBlock('foo.js', ' * Deployment: loaded from modules/foo.js by qr.html.\n') + srcTag('bar.js'), goodFiles, ign, names), 'statement'));
    check('leg 2 flags "Loaded as a plain global-scope <script>" outside the statement', fails(A(inlineBlock('foo.js', DEP_INLINE + ' *\n * Loaded as a plain global-scope <script>.\n') + srcTag('bar.js'), goodFiles, ign, names), 'inline-claims'));
    check('leg 2 does NOT flag the same words inside the Deployment statement', !fails(A(inlineBlock('foo.js', ' * Deployment: this block runs inline from qr.html, not as a standalone <script>.\n') + srcTag('bar.js'), goodFiles, ign, names), 'inline-claims'));
    check('leg 2 flags an external header that says qr.html was NOT modified to load it', fails(A(good, { 'bar.js': '/**\n * bar.js\n *\n * qr.html itself was NOT modified to load\n * this file.\n */\n' }, ign, names), 'external-claims'));
    check('leg 2 flags an external header whose Deployment statement claims the wrong file', fails(A(good, { 'bar.js': '/**\n * bar.js\n *\n * Deployment: loaded from modules/other.js by qr.html.\n */\n' }, ign, names), 'statement'));
    check('leg 2 accepts an external header whose Deployment statement names its own file', !fails(A(good, { 'bar.js': '/**\n * bar.js\n *\n * Deployment: loaded from modules/bar.js by qr.html.\n */\n' }, ign, names), 'statement'));
    check('leg 3b flags a Layer Map row that says "inline" for a module the page loads by <script src>', fails(A(good, goodFiles, ign, names, LM.replace('external: `modules/bar.js`', 'inline')), 'layer-map'));
    check('leg 3b flags a Layer Map row that hedges ("inline (a copy of modules/foo.js, not yet loaded from it)")', fails(A(good, goodFiles, ign, names, LM.replace('| inline |', '| inline (a copy of `modules/foo.js`, not yet loaded from it) |')), 'layer-map'));
    check('leg 3b flags a module with no row in the Layer Map', fails(A(good, goodFiles, ign, names, LM.split('\n').filter(l => !l.includes('`bar.js`')).join('\n')), 'layer-map'));
    const orderPage = (first, second) => first + second;
    const fooLoadsBar = inlineBlock('foo.js', DEP_INLINE + ' *\n * Load bar.js before this file.\n');
    check('leg 3 flags "load bar.js before this file" when the page loads bar.js after', fails(A(orderPage(fooLoadsBar, srcTag('bar.js')), goodFiles, ign, names), 'order'));
    check('leg 3 accepts it when the page loads bar.js first', !fails(A(orderPage(srcTag('bar.js'), fooLoadsBar), goodFiles, ign, names), 'order'));
    check('leg 3 flags a load-before claim naming a module the page does not have', fails(A(inlineBlock('foo.js', DEP_INLINE + ' *\n * load nothere.js before this file\n') + srcTag('bar.js'), goodFiles, ign, names), 'order'));
});

console.log(`\n[module deployment shape] ${pass} passed, ${fail} failed (of ${pass + fail} checks)`);
process.exit(fail ? 1 : 0);
