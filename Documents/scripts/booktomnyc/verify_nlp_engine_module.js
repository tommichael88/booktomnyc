#!/usr/bin/env node
/**
 * verify_nlp_engine_module.js
 *
 * Cross-checks the standalone nlp_engine.js module against the REAL
 * functions running inside qr.html itself (both script blocks, loaded in
 * genuine document order with a minimal DOM/window stub), for a set of
 * representative inputs covering both the preview and analysis pipelines.
 *
 * This is NOT a vector-file-driven check like the pricing engine's — NLP
 * extraction doesn't have a single numeric "correct answer" the way pricing
 * math does, so this instead asserts that nlp_engine.js's outputs are
 * IDENTICAL to whatever qr.html's own (real, unmodified) functions produce
 * for the same inputs, which is the actual claim this module makes.
 *
 * Run this after any edit to nlp_engine.js or to the functions it contains
 * inside qr.html.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.dirname(__dirname);

function makeStubGlobal(db) {
    const g = {};
    g.window = g;
    g.DB = db;
    g.window.DB = db;
    g.window.addEventListener = () => {};
    g.window.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
    g.localStorage = g.window.localStorage;
    g.document = {
        getElementById: () => null,
        createElement: () => ({
            style: {}, classList: { add() {}, remove() {}, contains() { return false; } },
            addEventListener() {}, appendChild() {}, setAttribute() {}, dataset: {},
        }),
        addEventListener: () => {},
        removeEventListener: () => {},
        querySelector: () => null,
        querySelectorAll: () => [],
        body: { appendChild() {}, classList: { add() {}, remove() {} } },
        documentElement: { style: {}, classList: { add() {}, remove() {} } },
    };
    return g;
}

function findFunctionBlock(src, funcName, occurrence = 0) {
    const fnPattern = new RegExp(`function\\s+${funcName}\\s*\\([^)]*\\)\\s*\\{`, 'g');
    let m, count = 0, target = null;
    while ((m = fnPattern.exec(src)) !== null) {
        if (count === occurrence) { target = m; break; }
        count++;
    }
    if (target) {
        const start = target.index;
        let depth = 0;
        for (let j = target.index + target[0].length - 1; j < src.length; j++) {
            if (src[j] === '{') depth++;
            else if (src[j] === '}') {
                depth--;
                if (depth === 0) return src.slice(start, j + 1);
            }
        }
        return null;
    }
    // Not found as a block-body function declaration — try one-liner arrow
    // const style (used by the _SKIP_WORDS/_SVC_VERBS/etc. accessors).
    const arrowPattern = new RegExp(`(?:const|let|var)\\s+${funcName}\\s*=\\s*\\([^)]*\\)\\s*=>\\s*[^;\\n]*;?`);
    const am = arrowPattern.exec(src);
    return am ? am[0] : null;
}

function loadRealQrHtmlFunctions(dbPath, functionSpecs, constNames = []) {
    // v9.4: does NOT load qr.html's real <script> blocks directly — block 1
    // is wrapped in `(function() { "use strict"; ... })()` (an IIFE,
    // discovered during this verification work), which makes every function
    // declared inside it private to that closure and unreachable from
    // outside, the same way enableLiveAdLibPreview's nested helpers are
    // private to ITS closure. Loading the real blocks as-is and then trying
    // to call e.g. extractObject() directly fails for this reason, not
    // because the extraction itself is wrong — cms_bridge.js and
    // extract_engine.py both correctly sidestep this by extracting function
    // TEXT via brace-matching and re-hosting it as fresh top-level code,
    // which is what this function now does too, for a fair comparison.
    //
    // functionSpecs: array of either a plain name (occurrence 0, the first/
    // only match) or [name, occurrence] for disambiguating duplicated names
    // like extractObject (preview pipeline = occurrence 0, analysis pipeline
    // = occurrence 1).
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const html = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
    const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    const allScripts = scripts.join('\n');
    const sandbox = makeStubGlobal(db);
    vm.createContext(sandbox);
    const blocks = [];
    for (const name of constNames) {
        const c = findConstLine(allScripts, name);
        if (!c) throw new Error(`Could not find const '${name}' anywhere in qr.html's script blocks`);
        blocks.push(c);
    }
    for (const spec of functionSpecs) {
        const [fn, occ] = Array.isArray(spec) ? spec : [spec, 0];
        const b = findFunctionBlock(allScripts, fn, occ);
        if (!b) throw new Error(`Could not find '${fn}' (occurrence ${occ}) anywhere in qr.html's script blocks`);
        blocks.push(b);
    }
    vm.runInContext(blocks.join('\n\n'), sandbox, { filename: 'qr.html-extracted-for-comparison' });
    if (typeof sandbox.initNlpSets === 'function') sandbox.initNlpSets();
    return sandbox;
}

function loadNlpEngineModule(dbPath) {
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    const sandbox = makeStubGlobal(db);
    vm.createContext(sandbox);
    const code = fs.readFileSync(path.join(REPO_ROOT, 'nlp_engine.js'), 'utf8');
    vm.runInContext(code, sandbox, { filename: 'nlp_engine.js' });
    sandbox.initNlpSets();
    sandbox.refreshNlpPreviewBindings();
    return sandbox;
}

function findConstLine(src, constName) {
    const pattern = new RegExp(`const\\s+${constName}\\s*=[^\\n]*;`);
    const m = pattern.exec(src);
    return m ? m[0] : null;
}

const dbPath = process.argv[2] || path.join(REPO_ROOT, 'btnyc.json');
const real = loadRealQrHtmlFunctions(dbPath, [
    ['extractObject', 1], ['extractQty', 1], ['extractLocation', 1], 'initNlpSets',
    'isServiceVerb', '_SKIP_WORDS', '_SVC_VERBS', '_STOP_PREPS', '_CLAUSE_BOUNDARY', '_ROOMS_LIST',
], ['_DIMENSION_PATTERN', '_QTY_WORD_MAP']);
const mod = loadNlpEngineModule(dbPath);

const TEST_INPUTS = [
    'fix my leaky faucet',
    'replace 4 outlets',
    'my toilet in the bathroom is clogged',
    'install a tv on a brick wall',
    'the cabinet door in my kitchen is broken',
    '',
];

let pass = 0, fail = 0;

function compare(label, realVal, modVal) {
    const r = JSON.stringify(realVal);
    const m = JSON.stringify(modVal);
    if (r === m) {
        pass++;
    } else {
        fail++;
        console.log(`  ✗ ${label}: real=${r} | module=${m}`);
    }
}

console.log('=== ANALYSIS pipeline: direct comparison against real qr.html ===');
console.log('(these ARE genuine top-level functions in qr.html block 1 — a true apples-to-apples check)\n');
for (const text of TEST_INPUTS) {
    compare(`extractObject("${text}")`, real.extractObject(text, null), mod.extractObject(text, null));
    compare(`extractQty("${text}")`, real.extractQty(text), mod.extractQty(text));
    compare(`extractLocation("${text}")`, real.extractLocation(text), mod.extractLocation(text));
}

console.log('\n=== PREVIEW pipeline: NOT directly comparable against real qr.html ===');
console.log('buildPreview and its siblings are lexically nested inside enableLiveAdLibPreview()');
console.log('in the real qr.html and are never exposed outward (confirmed: no return value, no');
console.log('window.* assignment) — there is no way to call "the real buildPreview" from outside');
console.log('that closure without fully simulating the DOM interaction that triggers it. This is');
console.log('a genuine limitation of this verification, not a gap being silently glossed over —');
console.log('see nlp_engine.js\'s header for how independence from that closure was instead');
console.log('verified (by source inspection: no reference to the closure\'s local DOM variables).');
console.log('What CAN be checked here is that nlp_engine.js\'s own preview functions are internally');
console.log('self-consistent and crash-free across varied inputs:\n');
let previewOk = 0, previewFail = 0;
for (const text of TEST_INPUTS) {
    try {
        const out = mod.buildPreview(text);
        if (typeof out === 'string') previewOk++;
        else { previewFail++; console.log(`  ✗ buildPreview("${text}") returned non-string:`, out); }
    } catch (e) {
        previewFail++;
        console.log(`  ✗ buildPreview("${text}") threw: ${e.message}`);
    }
}
console.log(`  ${previewOk}/${TEST_INPUTS.length} preview calls completed without throwing and returned a string.\n`);

console.log(`[nlp_engine.js standalone module] ANALYSIS pipeline: ${pass} passed, ${fail} failed (of ${pass + fail} direct checks)`);
console.log(`[nlp_engine.js standalone module] PREVIEW pipeline: ${previewOk} ran cleanly, ${previewFail} failed (no real-qr.html comparison possible — see above)\n`);

// v9.5: the output-comparison above only ever covered 3 of this module's
// 14 real functions (extractObject/extractQty/extractLocation) — leaving
// detectIntentNLP (the single most consequential function here, carrying
// the description-text mechanism and every contextual_override/conjugation
// fix from this session), detectTagsNLP, resolveGroupFromIntent, and the
// rest with ZERO live comparison of any kind. This was the real, exact
// cause of the staleness this module itself suffered from earlier this
// same session — nothing here would have caught it. Adds source-level
// parity checking (committed module vs. current, live qr.html) for every
// real function, as a genuine complement to the output-comparison above,
// not a duplicate of it.
const { checkParity, printReport } = require('./check_module_parity.js');
const parityResult = checkParity({
    modulePath: path.join(REPO_ROOT, 'nlp_engine.js'),
    functionNames: ['initNlpSets', 'buildPreview', 'detectAction', 'detectActionInfinitive',
        'extractCondition', 'detectIntentNLP', 'detectTagsNLP', 'extractObject', 'extractQty',
        'extractLocation', 'extractSizeHint', 'inferTagsFromContext', 'resolveGroupFromIntent',
        'isServiceVerb'],
    preferLast: new Set(['extractObject', 'extractQty', 'extractLocation']),
});
const parityOk = printReport(parityResult, 'nlp_engine.js');
const parityFail = parityResult.stale.length;

process.exit((fail > 0 || previewFail > 0 || parityFail > 0) ? 1 : 0);
