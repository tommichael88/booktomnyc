#!/usr/bin/env node
/**
 * verify_stale_sandbox_baseline.js -- the detector for DEFECT-STALE-SANDBOX (PROJECT_CHARTER.html, Named Defect Classes; operator ruling #105(1)).
 *
 * @detects DEFECT-STALE-SANDBOX
 *
 * THE CLASS. A test assembles its own copy of the code under test by extracting functions from qr.html BY NAME. When the product gains a dependency
 * next to one of those functions (a helper, a constant, a shared extractor), or a function is renamed, the copy silently loses it: the test fails
 * with "X is not defined" -- noise unrelated to what it asserts -- or, worse, keeps passing while measuring something other than the product.
 * Found five times (the stale $925 price check T144; 13 regressions from one new dependency T147; the rule-index bundles T147; the extraction
 * generator behind _extracted_engine.js T147; the Phase 5.5 sweep, dead for months until T156). Its price is paid on EVERY change: renaming one
 * function (resolveCheckoutState, T150) touched 52 occurrences in 40 test files. The structural fix is _engine.js: load the engine modules WHOLE,
 * so a sandbox cannot go stale by construction.
 *
 * WHAT THIS DETECTOR DOES (a baseline ratchet; the class is closed only when the baseline is empty).
 *   1. CLASSIFY. A verify_ test is a CHERRY-PICKER when it carries its own by-name extractor (a RegExp built from `function\s+` and a name variable)
 *      and does not load the engine through _engine.js (engineAwareFindFn, or require('./_engine.js')). The classification is itself tested on
 *      synthetic sources, including the ones a careless pattern gets wrong (loader named only in a comment; a template-literal extractor).
 *   2. RATCHET. The cherry-pickers are frozen BY NAME in stale_sandbox_baseline.json. A cherry-picker not on the list fails ("new tests may not
 *      cherry-pick: load the engine through _engine.js"). A name on the list that no longer cherry-picks, or no longer exists, FAILS TOO ("remove
 *      it, and lower the ceiling"): the list can only shrink, and it shrinks in the commit that earns it. The list length must equal `ceiling`,
 *      and `ceiling` may never exceed the count the baseline shipped with (HISTORICAL_MAX, below).
 *   3. THE LOADER IS COMPLETE. The loader is only a fix if it can actually supply what a test asks for. Every function the three engine modules
 *      declare at top level -- found by parsing them, not by the loader's own pattern -- must be one the loader exports, and exporting it must
 *      yield a function. (This is the check that would have caught the three column-0 pricing functions the loader's indent-anchored pattern
 *      skipped until T156: tests that asked for computeUnifiedQuote fell back to cherry-picking it.)
 *   4. NON-VACUITY. Each of the three checks is run on deliberately broken inputs and must fail on every one (a check that cannot fail proves
 *      nothing), and the scan must have seen a population of tests, loader users and engine functions large enough to mean something.
 *
 * SCOPE, STATED HONESTLY. This holds the ENGINE modules (pricing, nlp, orchestrator). Tests that cherry-pick functions from the other layers
 * (renderer, store, glue) still carry the hazard; the baseline lists every test that cherry-picks AT ALL, so the list is the true count, but the
 * remedy for those layers (a whole-module loader for each) is a separate step (PENDING_DECISIONS #111).
 *
 * Exit: 0 = the ratchet holds; 1 = a new cherry-picker, a stale baseline entry, a loader gap, or a detector that cannot fail.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { engine } = require('./_engine.js');
const { loadQr, findModuleBlock, parseJs, moduleStatements, MODULE_NAMES } = require('./_qr_blocks.js');

const TEST_DIR = __dirname;
const REPO_ROOT = path.dirname(TEST_DIR);
const BASELINE_PATH = path.join(TEST_DIR, 'stale_sandbox_baseline.json');
const HISTORICAL_MAX = 42;   // the count the baseline shipped with (T156). It is a constant HERE so that raising it is an edit to a test, not to a data file.
const ENGINE_MODULES = ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js'];

let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log('  ✓ ' + m); };
const bad = (m, d) => { fail++; console.log('  ✗ ' + m + (d ? '\n      ' + String(d).split('\n').join('\n      ') : '')); };
const check = (cond, okMsg, badMsg, detail) => (cond ? ok(okMsg) : bad(badMsg || okMsg, detail));

// ── 1. Classification ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// A by-name extractor builds a RegExp from the text `function\s+` and a name: either 'function\\s+' + name  or  `function\\s+${name}`.
const EXTRACTOR = /function\\\\s\+(?:['"]\s*\+|\$\{)/;
// The loader, used for real: a call to engineAwareFindFn, or a require of ./_engine(.js). Comments are removed first (both patterns are tested on the
// code only), so naming the loader or quoting the extractor in a comment counts for nothing.
const LOADER = /engineAwareFindFn\s*\(|require\(\s*['"]\.\/_engine(?:\.js)?['"]\s*\)/;
// Comments are found by the parser (acorn, via _qr_blocks), so a `//` inside a string is never mistaken for one. A source that does not parse falls back
// to a pattern strip that errs toward removing too much, which can only make the classifier call a loader user a cherry-picker (the ratchet then asks
// for it by name), never the reverse.
function stripComments(src) {
    for (const sourceType of ['script', 'module']) {
        const ranges = [];
        try {
            parseJs(src, { sourceType, allowHashBang: true, onComment: (block, text, start, end) => ranges.push([start, end]) });
        } catch (_) { continue; }
        let out = src;
        for (const [a, b] of ranges.reverse()) out = out.slice(0, a) + ' '.repeat(b - a) + out.slice(b);
        return out;
    }
    return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ');
}

function classify(src) {
    const code = stripComments(src);   // a comment that quotes the extractor, or names the loader, is neither
    if (!EXTRACTOR.test(code)) return 'neither';
    return LOADER.test(code) ? 'loader' : 'cherry-picker';
}

function scanTests(dir) {
    const files = fs.readdirSync(dir).filter(f => /^verify_.*\.js$/.test(f)).sort();
    const out = { files, cherryPickers: [], loaderUsers: [], neither: [] };
    for (const f of files) {
        const c = classify(fs.readFileSync(path.join(dir, f), 'utf8'));
        (c === 'cherry-picker' ? out.cherryPickers : c === 'loader' ? out.loaderUsers : out.neither).push(f);
    }
    return out;
}

// ── 2. Ratchet ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Returns the list of problems; empty = the ratchet holds.
function ratchet(observed, baseline, ceiling, existing) {
    const problems = [];
    const base = new Set(baseline);
    if (base.size !== baseline.length) problems.push('the baseline lists a test twice');
    for (const f of observed) if (!base.has(f)) problems.push(`NEW cherry-picker: ${f} extracts functions from qr.html by name without loading the engine through _engine.js (engineAwareFindFn). New tests may not cherry-pick.`);
    for (const f of baseline) {
        if (!existing.has(f)) problems.push(`STALE baseline entry: ${f} no longer exists. Remove it from stale_sandbox_baseline.json and lower the ceiling to ${baseline.length - 1}.`);
        else if (!observed.includes(f)) problems.push(`STALE baseline entry: ${f} no longer cherry-picks (it loads the engine whole, or has no extractor). Remove it from stale_sandbox_baseline.json and lower the ceiling to ${baseline.length - 1}: the list only shrinks.`);
    }
    if (baseline.length !== ceiling) problems.push(`the baseline lists ${baseline.length} tests but declares a ceiling of ${ceiling}: they must be equal (a shrink lowers both, in the same commit)`);
    if (ceiling > HISTORICAL_MAX) problems.push(`the ceiling ${ceiling} is above the ${HISTORICAL_MAX} the baseline shipped with: the list may not grow`);
    return problems;
}

// ── 3. The loader is complete ────────────────────────────────────────────────────────────────────────────────────────────────────────────
// declared = what the parsed modules declare at top level; exported = what the loader claims; usable = the names that are functions once loaded.
function loaderGaps(declared, exported, usable) {
    const problems = [];
    const exp = new Set(exported), use = new Set(usable);
    for (const n of declared) if (!exp.has(n)) problems.push(`the engine modules declare ${n} but the loader does not export it, so a test that asks for it falls back to cherry-picking`);
    for (const n of exported) if (!new Set(declared).has(n)) problems.push(`the loader claims ${n} but no engine module declares it at top level`);
    for (const n of exported) if (!use.has(n)) problems.push(`the loader exports ${n} but it is not a function once the modules are loaded`);
    return problems;
}

function declaredEngineFunctions() {
    const { blocks } = loadQr(path.join(REPO_ROOT, 'qr.html'));
    const names = new Set();
    for (const mod of ENGINE_MODULES) {
        const block = findModuleBlock(blocks, mod);
        if (!block) throw new Error(`engine module ${mod} not found in qr.html`);
        const ast = parseJs(block.src);
        for (const st of moduleStatements(ast)) if (st.type === 'FunctionDeclaration' && st.id) names.add(st.id.name);
    }
    return names;
}

function usableAfterLoad() {
    const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));
    const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
    sandbox.global = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(engine().wrapper, sandbox, { filename: 'engine_modules' });
    return [...engine().names].filter(n => typeof sandbox[n] === 'function');
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
console.log('=== 0. The detector can fail (non-vacuity) ===');
{
    // Synthetic sources. The extractor text is built here, not written out, so this file never matches its own signature.
    const BS2 = '\\\\';
    const quoted = `const m = QR_HTML.match(new RegExp('function${BS2}s+' + name + '${BS2}s*(')); `;
    const template = 'const re = new RegExp(`(?:async\\\\s+)?function' + BS2 + 's+${funcName}`, "g"); ';
    const cases = [
        ['a quoted-concatenation extractor, no loader',                  quoted,                                                          'cherry-picker'],
        ['a template-literal extractor, no loader',                      template,                                                        'cherry-picker'],
        ['an extractor plus engineAwareFindFn(...)',                     quoted + "const { engineAwareFindFn } = require('./_engine.js'); const f = engineAwareFindFn(g);", 'loader'],
        ['an extractor plus require of ./_engine (no destructure)',      quoted + "const E = require('./_engine'); E.engine();",           'loader'],
        ['an extractor that only NAMES the loader in comments',          quoted + '// T136: see engineAwareFindFn( ) and require("./_engine.js")\n/* engineAwareFindFn( x ) */', 'cherry-picker'],
        ['a test with no extractor at all',                              "const x = require('fs'); x.readFileSync('qr.html');",           'neither'],
        ['a comment that merely quotes the extractor pattern',           '// the extractor is ' + quoted + '\nconst x = 1;',               'neither'],
    ];
    for (const [label, src, expect] of cases) {
        const got = classify(src);
        check(got === expect, `classify: ${label} -> ${expect}`, `classify: ${label} -> expected ${expect}, got ${got}`);
    }

    const existing = new Set(['a.js', 'b.js', 'c.js', 'd.js']);
    check(ratchet(['a.js', 'b.js'], ['a.js', 'b.js'], 2, existing).length === 0, 'ratchet: an unchanged baseline holds', 'ratchet: an unchanged baseline reported problems');
    check(ratchet(['a.js', 'b.js', 'c.js'], ['a.js', 'b.js'], 2, existing).some(p => /NEW cherry-picker: c\.js/.test(p)), 'ratchet mutant: a new cherry-picker is caught');
    check(ratchet(['a.js'], ['a.js', 'b.js'], 2, existing).some(p => /STALE baseline entry: b\.js no longer cherry-picks/.test(p)), 'ratchet mutant: a listed test that stopped cherry-picking is caught (the list must shrink)');
    check(ratchet(['a.js'], ['a.js', 'zz.js'], 2, existing).some(p => /STALE baseline entry: zz\.js no longer exists/.test(p)), 'ratchet mutant: a listed test that was deleted is caught');
    check(ratchet(['a.js', 'b.js'], ['a.js', 'b.js'], 3, existing).some(p => /must be equal/.test(p)), 'ratchet mutant: a ceiling that does not equal the list length is caught');
    check(ratchet(['a.js'], Array.from({ length: HISTORICAL_MAX + 1 }, (_, i) => 'a.js'), HISTORICAL_MAX + 1, existing).some(p => /may not grow/.test(p)), 'ratchet mutant: a ceiling above the shipped count is caught');
    check(ratchet(['a.js', 'b.js'], ['a.js', 'a.js'], 2, existing).some(p => /twice/.test(p)), 'ratchet mutant: a duplicated baseline entry is caught');

    check(loaderGaps(['f', 'g'], ['f', 'g'], ['f', 'g']).length === 0, 'loaderGaps: a complete loader holds', 'loaderGaps: a complete loader reported problems');
    check(loaderGaps(['f', 'g'], ['f'], ['f']).some(p => /declare g but the loader does not export it/.test(p)), 'loader mutant: a declared function the loader does not export is caught (the column-0 gap)');
    check(loaderGaps(['f'], ['f', 'h'], ['f', 'h']).some(p => /claims h but no engine module declares/.test(p)), 'loader mutant: a name the loader claims but no module declares is caught (a function that exists only in a comment)');
    check(loaderGaps(['f', 'g'], ['f', 'g'], ['f']).some(p => /g but it is not a function once/.test(p)), 'loader mutant: an export that is not a function after loading is caught');
}

console.log('\n=== 1. The loader supplies every engine function ===');
{
    const declared = declaredEngineFunctions();
    const exported = [...engine().names];
    const usable = usableAfterLoad();
    check(declared.size >= 80, `the parser found ${declared.size} top-level engine functions (floor 80: the modules are being read)`, `only ${declared.size} engine functions found (floor 80): the modules are not being read`);
    const gaps = loaderGaps([...declared], exported, usable);
    check(gaps.length === 0, `the loader exports all ${declared.size} declared engine functions, each a function once loaded`, 'the loader has gaps', gaps.slice(0, 8).join('\n'));
}

console.log('\n=== 2. The ratchet over the cherry-picking tests ===');
{
    const scan = scanTests(TEST_DIR);
    check(scan.files.length >= 150, `the scan saw ${scan.files.length} verify_ tests (floor 150)`, `the scan saw only ${scan.files.length} verify_ tests (floor 150)`);
    check(scan.loaderUsers.length >= 20, `${scan.loaderUsers.length} tests load the engine through _engine.js (floor 20: the classifier recognises the loader)`, `only ${scan.loaderUsers.length} tests were recognised as loader users (floor 20)`);

    if (!fs.existsSync(BASELINE_PATH)) {
        bad('stale_sandbox_baseline.json is missing');
    } else {
        const base = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
        const problems = ratchet(scan.cherryPickers, base.cherry_pickers || [], base.ceiling, new Set(scan.files));
        check(problems.length === 0,
            `the ratchet holds: ${scan.cherryPickers.length} tests cherry-pick, exactly the ${base.cherry_pickers.length} on the baseline (ceiling ${base.ceiling}, shipped at ${HISTORICAL_MAX}); ${scan.loaderUsers.length} load the engine whole`,
            `the ratchet is broken (${problems.length})`, problems.slice(0, 12).join('\n'));
        console.log(`    ℹ  burn-down: ${base.ceiling} of ${HISTORICAL_MAX} remain. DEFECT-STALE-SANDBOX is closed when the baseline is empty.`);
    }
}

console.log(`\n[DEFECT-STALE-SANDBOX detector] ${pass} passed, ${fail} failed (of ${pass + fail} checks)`);
process.exit(fail > 0 ? 1 : 0);
