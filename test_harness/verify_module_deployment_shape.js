#!/usr/bin/env node
/**
 * verify_module_deployment_shape.js -- the class detector for "a module has one home, and its header says where that is".
 *
 * @enforces R-INVARIANT-SINGLEDEF
 * @enforces R-SYSTEM-SCRIPT-SCOPE-IS-REAL
 *
 * THE CLASS (R-INVARIANT-SINGLEDEF; R-SYSTEM-SCRIPT-SCOPE-IS-REAL, named R-SYSTEM-SCRIPT before the merged Charter edition: "script-tag scope is real"): a module lives in one place, and what a file says about how it reaches the browser is what the page does.
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
 *   3b. THE LAYER MAP SAYS IT   COMPONENT_LAYER_MAP.md's "Recorded module locations" row (section 6; "Inline in `qr.html`: `a`, `b`. External in `modules/`: `c`.") agrees with the page: every module the page has is
 *                           recorded in exactly one of the two lists, as the shape the page has it, and no module is recorded that the page does not have. (T176, PENDING_DECISIONS #214: the merged edition of
 *                           the map replaced the module table's "Source in the page" column with this row, and labels it a snapshot. The label is the map's own protection against being read as current; this
 *                           leg is what tells a maintainer that the snapshot has drifted, which the map's change protocol (section 8, step 7) says is the moment to update it. A row it cannot read is a failure,
 *                           not a pass: a missing row, a missing list label, or a list with no module names.)
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
const L = require('./_layers.js');

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
 * recordedLocations(layerMapText) -> { inline: Set('x.js'), external: Set('x.js') } or { problem: string }.
 * Reads the "Recorded module locations" row: names are written without the extension, in backticks, after "Inline in `qr.html`:" and "External in `modules/`:".
 */
function recordedLocations(text) {
    const line = String(text || '').split('\n').find(l => /^\|\s*Recorded module locations\s*\|/.test(l));
    if (!line) return { problem: 'the Layer Map has no "Recorded module locations" row (COMPONENT_LAYER_MAP.md section 6)' };
    const cell = line.split('|')[2] || '';
    const A = 'Inline in `qr.html`:', B = 'External in `modules/`:';
    const ia = cell.indexOf(A), ib = cell.indexOf(B);
    if (ia < 0 || ib < 0) return { problem: `the "Recorded module locations" row does not carry both lists ("${A}" and "${B}")` };
    const names = seg => new Set([...seg.matchAll(/`(\w+)`/g)].map(m => m[1] + '.js'));
    const inline = names(ia < ib ? cell.slice(ia + A.length, ib) : cell.slice(ia + A.length)), external = names(ib < ia ? cell.slice(ib + B.length, ia) : cell.slice(ib + B.length));
    if (!inline.size && !external.size) return { problem: 'the "Recorded module locations" row names no module in either list' };
    return { inline, external };
}


/**
 * locationDisagreements(layerMapText) -> [string]. The merged map states where a module lives TWICE: per module, in the "Current source / status" cell of its row (section 2), and as the
 * labelled snapshot row (section 7). They must say the same, and the shell's own row must list as hosted exactly the modules that are inline. (T176, #214: the section-7 row alone was
 * checked against the page; a second statement that could drift from the first without a red is the shape this class exists to forbid.)
 */
function locationDisagreements(text) {
    let model; try { model = L.layerModelOf(text); } catch (e) { return [`the Layer Map cannot be read as a model: ${e.message}`]; }
    const rec = recordedLocations(text); if (rec.problem) return [rec.problem];
    const keysOf = kind => new Set(model.rows.filter(r => r.location.kind === kind).map(r => r.key));
    const inl = keysOf('inline'), ext = keysOf('external'), out = [];
    const diff = (a, b, la, lb) => { for (const n of a) if (!b.has(n)) out.push(`${n}: ${la}, and ${lb} does not say so`); };
    diff(inl, rec.inline, 'the module row says inline', 'the "Recorded module locations" row'); diff(rec.inline, inl, 'the "Recorded module locations" row says inline', 'the module row');
    diff(ext, rec.external, 'the module row says external', 'the "Recorded module locations" row'); diff(rec.external, ext, 'the "Recorded module locations" row says external', 'the module row');
    for (const r of model.rows) if (r.location.kind === 'external' && r.location.file !== 'modules/' + r.key) out.push(`${r.key}: the module row names ${r.location.file}`);
    const shell = model.rows.find(r => r.responsibility === 'deployment-shell');
    if (shell) {
        const hosted = new Set((shell.location.hostsInline || []).map(n => n + '.js'));
        diff(inl, hosted, 'the module row says inline', `the ${shell.key} row's list of hosted inline blocks`); diff(hosted, inl, `the ${shell.key} row lists it as a hosted inline block`, 'the module row');
    }
    return out;
}

/**
 * The code the shell hosts that no row of the map owns: <script> blocks with no module header. They exist (the global state and utilities block, the boot function, the service-worker
 * registration), the map does not assign them to a module, and the shell is told it must not become a catch-all owner. So they are listed by name; a block that matches no entry is NEW
 * unowned code (give it a module and a row, or add it here with the reason); an entry that matches no block is stale (a ratchet: this list can only shrink or be argued into).
 */
const UNOWNED = [
    { id: 'global-state-utilities', re: /GLOBAL STATE & CACHE/, finding: 'legacy globals (SERVICE_DATA, DB, State), the Breadcrumbs navigation object, rate limiters, input sanitizers, and the PAX coefficient table (business data written into code); the map assigns state to store.js, navigation to the Controller and pricing data to the SSOT: migration debt, not shell ownership' },
    { id: 'boot-init', re: /\(async function init\(\)/, finding: 'the boot function: loads and validates the SSOT, starts the modules, seeds the store; the shell\'s declared script-loading/bootstrap boundary, and where the runtime meets the published artifact' },
    { id: 'service-worker', re: /serviceWorker/, finding: 'service-worker registration: a deployment concern of the shell' },
];
function unownedProblems(html) {
    const blocks = L.unownedBlocks(html), out = [];
    for (const b of blocks) { const hit = UNOWNED.filter(u => u.re.test(b.src)); if (hit.length !== 1) out.push(`a <script> block at L${b.line} (${b.chars} chars, "${b.head.slice(0, 50)}") has no module header and ${hit.length ? 'matches several entries' : 'matches no entry of the list of unowned shell code: new code in the shell with no owner'}`); }
    for (const u of UNOWNED) if (!blocks.some(b => u.re.test(b.src))) out.push(`the list of unowned shell code names "${u.id}", and no headerless block matches it any more (stale entry: remove it)`);
    return out;
}

/**
 * Modules the page has that the Layer Map's snapshot row cannot yet record (T179, PENDING_DECISIONS #221). The map is the Operator's; it is not edited here, and it labels its row a snapshot.
 * resolver.js is on the map as a TARGET module ("not yet a standalone file") and is now a file the page loads; artifact_compat.js is the consumer-side compatibility check the resolver runs before it
 * reads an index, and the map has no row for it. Leg 3b would call both "no location recorded", which is true and is the map's move to make. So each is listed here WITH the shape the page must have,
 * and the entry is a ratchet like UNOWNED: it fails when the page no longer has the module in that shape, and it fails when the map starts recording the module (the entry is then stale: remove it).
 */
const ADOPTED_AFTER_SNAPSHOT = {
    'resolver.js': 'external:modules/resolver.js',
    'artifact_compat.js': 'external:modules/artifact_compat.js',
};

/**
 * analyse(raw, modFiles, gitignore, names, layerMap) -> [{ id, label, offenders: [string] }]. Pure: the real run and the probes feed it the same way.
 *   raw        qr.html as written
 *   modFiles   { 'name.js': text } for every .js file under modules/
 *   gitignore  the text of .gitignore
 *   names      the module names the tooling knows (Q.MODULE_NAMES)
 *   layerMap   the text of COMPONENT_LAYER_MAP.md
 *   adopted    { 'x.js': shape } the modules adopted after the map's snapshot (ADOPTED_AFTER_SNAPSHOT for the real page; {} for a synthetic one)
 */
function analyse(raw, modFiles, gitignore, names, layerMap, adopted = {}) {
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

    const rec = recordedLocations(layerMap);
    row('layer-map', 'COMPONENT_LAYER_MAP.md records each module\'s location (section 6, "Recorded module locations") as the page has it: inline in qr.html, or external in modules/', rec.problem ? [rec.problem] :
        [...allNames.filter(n => shape(n)).flatMap(n => {
            const inRec = rec.inline.has(n), exRec = rec.external.has(n);
            if (adopted[n]) return inRec || exRec ? [`${n}: the Layer Map now records it, and the list of modules adopted after the snapshot still names it (stale entry: remove it)`] : shape(n) === adopted[n] ? [] : [`${n}: adopted after the snapshot as ${adopted[n]}, and the page has it ${shape(n)}`];
            return inRec && exRec ? [`${n}: recorded as both inline and external`] : !inRec && !exRec ? [`${n}: the page has it ${shape(n)}, the Layer Map records no location for it`]
                : (inRec ? 'inline' : 'external:modules/' + n) === shape(n) ? [] : [`${n}: the page has it ${shape(n)}, the Layer Map records it ${inRec ? 'inline' : 'external'}`];
        }), ...Object.keys(adopted).filter(n => !shape(n)).map(n => `${n}: on the list of modules adopted after the snapshot, and the page does not contain it (stale entry: remove it)`),
        ...[...rec.inline, ...rec.external].filter(n => !allNames.includes(n) || !shape(n)).map(n => `${n}: recorded in the Layer Map, and the page does not contain it`)]);
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
    const rows = analyse(raw, modFiles, gitignore, Q.MODULE_NAMES, layerMap, ADOPTED_AFTER_SNAPSHOT);
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
    const lm = (inl, ext) => `| Concern | Recorded implementation shape | Migration implication |\n|---|---|---|\n| Recorded module locations | Inline in \`qr.html\`: ${inl.map(n => '`' + n + '`').join(', ') || 'none'}. External in \`modules/\`: ${ext.map(n => '`' + n + '`').join(', ') || 'none'}. | This is a snapshot, not a claim about the current checkout. |\n`;
    const LM = lm(['foo'], ['bar']);
    const A = (rawPage, files, ig, nm, lm, adopted) => analyse(rawPage, files, ig, nm, lm === undefined ? LM : lm, adopted);
    const ADOPT = { 'resolver.js': 'external:modules/resolver.js', 'artifact_compat.js': 'external:modules/artifact_compat.js' };
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
    check('leg 3b flags a module recorded as inline that the page loads by <script src> (and the reverse)', fails(A(good, goodFiles, ign, names, lm(['bar'], ['foo'])), 'layer-map'));
    check('leg 3b flags a module recorded in both lists', fails(A(good, goodFiles, ign, names, lm(['foo', 'bar'], ['bar'])), 'layer-map'));
    check('leg 3b flags a module the page has that the Layer Map does not record', fails(A(good, goodFiles, ign, names, lm(['foo'], [])), 'layer-map'));
    check('leg 3b flags a module recorded in the Layer Map that the page does not contain', fails(A(good, goodFiles, ign, names, lm(['foo', 'ghost'], ['bar'])), 'layer-map'));
    check('leg 3b accepts resolver.js and artifact_compat.js as adopted after the snapshot, in their declared shape, while the map does not record them', !fails(A(good + srcTag('resolver.js') + srcTag('artifact_compat.js'), { ...goodFiles, 'resolver.js': goodFiles['bar.js'], 'artifact_compat.js': goodFiles['bar.js'] }, ign, names, undefined, ADOPT), 'layer-map'));
    check('leg 3b flags an adopted module once the map records it (the list entry is stale)', fails(A(good + srcTag('resolver.js'), { ...goodFiles, 'resolver.js': goodFiles['bar.js'] }, ign, names, lm(['foo'], ['bar', 'resolver']), ADOPT), 'layer-map'));
    check('leg 3b flags an adopted module the page no longer has (the list entry is stale)', fails(A(good, goodFiles, ign, names, undefined, ADOPT), 'layer-map'));
    check('leg 3b flags an adopted module that the page now runs inline', fails(A(good + inlineBlock('resolver.js'), goodFiles, ign, [...names, 'resolver.js'], undefined, ADOPT), 'layer-map'));
    check('leg 3b still flags a module that is NOT on the adopted list and is not recorded', fails(A(good + srcTag('other.js'), { ...goodFiles, 'other.js': goodFiles['bar.js'] }, ign, names), 'layer-map'));
    check('leg 3b flags a Layer Map with no "Recorded module locations" row (an unreadable record is a failure, not a pass)', fails(A(good, goodFiles, ign, names, '| Concern | x | y |\n|---|---|---|\n| Cart | a | b |\n'), 'layer-map'));
    check('leg 3b flags a row that lost one of its two list labels', fails(A(good, goodFiles, ign, names, LM.replace('External in `modules/`:', 'Elsewhere:')), 'layer-map'));
    check('leg 3b reads names written without the extension and accepts a row that agrees with the page', !fails(A(good, goodFiles, ign, names, lm(['foo'], ['bar'])), 'layer-map'));
    const orderPage = (first, second) => first + second;
    const fooLoadsBar = inlineBlock('foo.js', DEP_INLINE + ' *\n * Load bar.js before this file.\n');
    check('leg 3 flags "load bar.js before this file" when the page loads bar.js after', fails(A(orderPage(fooLoadsBar, srcTag('bar.js')), goodFiles, ign, names), 'order'));
    check('leg 3 accepts it when the page loads bar.js first', !fails(A(orderPage(srcTag('bar.js'), fooLoadsBar), goodFiles, ign, names), 'order'));
    check('leg 3 flags a load-before claim naming a module the page does not have', fails(A(inlineBlock('foo.js', DEP_INLINE + ' *\n * load nothere.js before this file\n') + srcTag('bar.js'), goodFiles, ign, names), 'order'));
});

section('3c. the map states each location twice (its module rows and its snapshot row) and they agree; the shell lists what it hosts', () => {
    const bad = locationDisagreements(layerMap);
    check('the module rows\' "Current source / status" cells, the "Recorded module locations" row and the shell row\'s hosted list say the same thing', bad.length === 0, bad.join(' | '));
    const flips = [
        ['a module row that says inline while the snapshot row says external', t => t.replace('| `nlp_engine.js` | Logic / Engine | External module: `modules/nlp_engine`', '| `nlp_engine.js` | Logic / Engine | Inline block in `qr.html`')],
        ['a module row that says external while the snapshot row says inline', t => t.replace('| `pricing_engine.js` | Logic / Engine | Inline block in `qr.html`', '| `pricing_engine.js` | Logic / Engine | External module: `modules/pricing_engine`')],
        ['a module the shell row does not list as hosted', t => t.replace('`pricing_engine`, `orchestrator_engine`,', '`orchestrator_engine`,')],
        ['a module row that names a different modules/ file', t => t.replace('External module: `modules/store`', 'External module: `modules/store2`')],
        ['a snapshot row that drops a module', t => t.replace('`trace`, ', '')],
    ];
    for (const [what, f] of flips) { const t = f(layerMap); check(`non-vacuity: ${what} is found`, t !== layerMap && locationDisagreements(t).length > 0, t === layerMap ? 'the fixture edit did not apply to the map' : ''); }
});

section('5. the shell hosts no unowned code beyond the named blocks (the shell must not become a catch-all)', () => {
    const bad = unownedProblems(raw);
    check('every <script> block of the page without a module header is one of the named unowned blocks, and every named one is still there', bad.length === 0, bad.join(' | '));
    for (const u of UNOWNED) console.log(`  (unowned shell code: ${u.id}: ${u.finding})`);
    const one = '<script>\n// GLOBAL STATE & CACHE\nlet x = 1;\n</script>\n<script>\n(async function init() {})();\n</script>\n<script>\nif ("serviceWorker" in navigator) {}\n</script>\n';
    check('non-vacuity: a page with exactly the named blocks is clean', unownedProblems(one).length === 0, unownedProblems(one).join(' | '));
    check('non-vacuity: a new headerless block is found', unownedProblems(one + '<script>\nfunction newThing() { return 1; }\n</script>\n').length === 1);
    check('non-vacuity: a named block that has gone is reported stale', unownedProblems(one.replace(/<script>\nif \("serviceWorker"[^]*?<\/script>\n/, '')).length === 1);
    check('non-vacuity: an empty headerless block is not unowned code', unownedProblems(one + '<script>\n</script>\n').length === 0);
});

console.log(`\n[module deployment shape] ${pass} passed, ${fail} failed (of ${pass + fail} checks)`);
process.exit(fail ? 1 : 0);
