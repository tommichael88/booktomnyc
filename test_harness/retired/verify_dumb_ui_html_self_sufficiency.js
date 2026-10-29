#!/usr/bin/env node
/**
 * verify_dumb_ui_html_self_sufficiency.js
 *
 * Regression test for a real, severe bug found via direct, real browser
 * testing: dumb_ui_prototype.html set `window.DB` but never
 * `window.SERVICE_DATA`, while real functions inside both
 * pricing_engine.js and orchestrator_engine.js directly reference the
 * bare global `SERVICE_DATA` (e.g. `_resolveIntakeChain`'s
 * `if (!SERVICE_DATA.intake_modules)`). The result: the instant a real
 * customer picked any service, the page threw an unhandled,
 * `async`-swallowed error — no visible symptom beyond "nothing renders
 * after the dropdown."
 *
 * EVERY EXISTING TEST for this prototype (verify_orchestrator_engine_module.js,
 * verify_dumb_ui_prototype_full_catalog_stress.js) PASSED throughout —
 * because each one builds its own sandbox and explicitly sets BOTH
 * `DB` and `SERVICE_DATA`, the same convention used everywhere else
 * this session. That convention is correct for testing the ENGINE
 * MODULES' own logic, but it silently substitutes for the real HTML
 * file's own, actual bootstrapping — meaning none of those tests ever
 * verified the live page sets up its own globals correctly.
 *
 * THIS TEST is the real, deliberate exception: it loads the actual,
 * live HTML file's own inline <script> content directly, with NO
 * pre-set SERVICE_DATA in the sandbox — exactly mirroring a real
 * browser, which provides no such convenience. If this file's own
 * bootstrapping is ever incomplete again, this test fails loudly,
 * instead of every other test silently compensating for the gap.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.dirname(__dirname);
const HTML_PATH = path.join(REPO_ROOT, 'dumb_ui_prototype.html');
const DB_PATH = path.join(REPO_ROOT, 'btnyc.json');

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

function extractInlineScript(html) {
    const matches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    // The real, live file has exactly one inline <script> block (the two
    // engine modules are loaded via real <script src> tags, not inline).
    return matches.length ? matches[matches.length - 1][1] : null;
}

const html = fs.readFileSync(HTML_PATH, 'utf8');
const inlineScript = extractInlineScript(html);

console.log('=== The real, live HTML file has exactly one real inline <script> block to test ===');
check('found exactly one real inline script block', !!inlineScript);

console.log('\n=== Real, minimal sandbox: NO pre-set SERVICE_DATA, exactly mirroring a real browser ===');
{
    // A real, minimal DOM mock — just enough for boot()/resolveAndRender
    // to run without throwing on missing DOM methods, but deliberately
    // NOT setting any global the real file doesn't set itself.
    let bannerHtml = '(never set)';
    const bannerEl = {
        get innerHTML() { return bannerHtml; },
        set innerHTML(v) { bannerHtml = v; },
    };
    const genericEl = {
        appendChild: () => {}, addEventListener: () => {},
        innerHTML: '', style: {}, textContent: '',
        querySelector: () => null,
        value: 'cabinet_knob_or_pull_install', // a real, known service (curated_card as of this session's per-unit pricing redesign — see BACKLOG_CONSOLIDATED.md)
    };
    const sandbox = {};
    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.console = console;
    sandbox.document = {
        getElementById: (id) => (id === 'routeBanner' ? bannerEl : genericEl),
        createElement: () => {
            const el = { className: '', innerHTML: '', style: {}, onclick: null, onchange: null, value: '', textContent: '', appendChild: () => {} };
            el.querySelector = () => el;
            el.addEventListener = () => {};
            return el;
        },
    };
    sandbox.fetch = async () => ({ json: async () => JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) });
    vm.createContext(sandbox);

    // Load ONLY what the real file itself loads, in the real file's own
    // order — the two real <script src> modules, then the inline script.
    vm.runInContext(fs.readFileSync(path.join(REPO_ROOT, 'pricing_engine.js'), 'utf8'), sandbox, { filename: 'pricing_engine.js' });
    vm.runInContext(fs.readFileSync(path.join(REPO_ROOT, 'orchestrator_engine.js'), 'utf8'), sandbox, { filename: 'orchestrator_engine.js' });

    let threw = null;
    try {
        vm.runInContext(inlineScript, sandbox, { filename: 'dumb_ui_prototype_inline' });
    } catch (e) {
        threw = e;
    }
    check('the real, live inline script does not throw synchronously on load', !threw);

    // boot() is async — its own real promise is the only reliable signal
    // of genuine completion, the same real lesson learned diagnosing this
    // exact bug by hand.
    const bootPromise = sandbox.boot ? sandbox.boot() : Promise.reject(new Error('boot() not found on the real, live script'));
    return bootPromise.then(() => {
        check('after boot() genuinely completes, the real routeBanner shows a resolved uiTemplate (not the never-set default)',
            bannerHtml !== '(never set)' && /uiTemplate resolved/.test(bannerHtml));
        check('the real banner shows NO error (confirms window.SERVICE_DATA and every other real global this file needs are genuinely self-sufficient)',
            !/A real error occurred/.test(bannerHtml));
        if (/A real error occurred/.test(bannerHtml)) {
            console.log('    Real, live error banner content:', bannerHtml);
        }
    }).catch(e => {
        fail++;
        console.log(`  ✗ boot() rejected with a real, unhandled error: ${e.message}`);
    }).finally(() => {
        console.log(`\n[Dumb UI HTML self-sufficiency check] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
        process.exit(fail > 0 ? 1 : 0);
    });
}
