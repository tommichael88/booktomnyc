#!/usr/bin/env node
/**
 * verify_shadow_mode_phase5.js
 *
 * Was a regression test for Master Blueprint Phase 5: Shadow Mode --
 * `shadowDiffQuote`, a hook inside `computeQuoteFromState` that ran the
 * new orchestrator (`executeWorkflow`) alongside the legacy calculation
 * path on every real quote and diffed the two, as a safety net WHILE the
 * orchestrator migration was still being trusted.
 *
 * v9.5.8: rewritten. `shadowDiffQuote` no longer exists anywhere --
 * confirmed directly, not assumed: zero occurrences across qr.html,
 * pricing_engine.js, orchestrator_engine.js, UIRenderer.js, and
 * AppController.js. That's a real, clean, complete removal, not partial
 * drift (a partial removal would leave *some* trace -- a dangling
 * `window.__BTNYC_SHADOW_DIFFS__` init, a stray call site, a leftover
 * reference in a comment being the only clue). The orchestrator has long
 * since become the real, sole, primary path -- extensively verified
 * elsewhere in this suite (verify_orchestrator_engine_module.js,
 * verify_orchestrator_phase2.js, verify_routing_archetype_semantic_check.js,
 * and dozens of scenario tests throughout this project's history) -- so
 * the transitional safety net this test protected has served its purpose
 * and been retired. Resurrecting a deliberately-removed diffing mechanism
 * just to make an old test pass would be reintroducing dead weight, not
 * fixing anything real.
 *
 * What's actually worth guarding against now: shadow mode reappearing
 * PARTIALLY (a real, if unlikely, regression -- e.g. someone pastes back
 * a stale snippet from an old branch) or the orchestrator silently
 * stopping being the thing computeQuoteFromState actually calls. Both
 * checked directly below.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.dirname(__dirname);
const FILES_TO_CHECK = ['qr.html', 'pricing_engine.js', 'orchestrator_engine.js', 'UIRenderer.js', 'AppController.js'];

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

console.log('=== Shadow mode was cleanly, completely retired -- not partially left in place ===');
for (const f of FILES_TO_CHECK) {
    const src = fs.readFileSync(path.join(REPO_ROOT, f), 'utf8');
    check(`${f}: zero references to shadowDiffQuote`, !src.includes('shadowDiffQuote'));
    check(`${f}: zero references to __BTNYC_SHADOW_DIFFS__ (the diagnostic array shadow mode used to populate)`, !src.includes('__BTNYC_SHADOW_DIFFS__'));
}

console.log('\n=== The thing shadow mode used to safety-net is still true without it: the orchestrator is the real, live, primary path ===');
{
    const qrHtml = require('./_page.js').readPage(path.join(REPO_ROOT, 'qr.html'));
    const m = qrHtml.match(/function\s+computeQuoteFromState\s*\([^)]*\)\s*\{/);
    check('computeQuoteFromState exists in qr.html', !!m);
    if (m) {
        let depth = 0, start = m.index, end = null;
        for (let j = m.index + m[0].length - 1; j < qrHtml.length; j++) {
            if (qrHtml[j] === '{') depth++;
            else if (qrHtml[j] === '}') { depth--; if (depth === 0) { end = j + 1; break; } }
        }
        const body = qrHtml.slice(start, end);
        check('computeQuoteFromState calls the real computeUnifiedQuote directly (the primary path, not a shadowed/parallel one)', /\bcomputeUnifiedQuote\s*\(/.test(body));
    }
}

console.log(`\n[Shadow mode retirement verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
