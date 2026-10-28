#!/usr/bin/env node
/**
 * verify_t107_tracing_corrections.js
 *
 * Real, confirmed corrections found by directly analyzing two real
 * traces the user captured from live testing (T107) -- not
 * hypothesized, not assumed working from last turn's synthetic tests.
 *
 * 1. The DOM-snapshot selectors from T106 were verified only against a
 *    synthetic DOM built to match my own assumptions -- the real trace
 *    showed them capturing nothing at all against the real, live page,
 *    on BOTH of the two real, separate curated-card rendering systems
 *    this codebase actually has. Broadened to real, confirmed
 *    selectors, and wired into the second system's own real
 *    calculation path (refreshPrice), which the original hook never
 *    touched.
 * 2. entryPath stuck at "unknown" for an entire real session (pure
 *    catalog/group-tile navigation) -- confirmed at least one real
 *    entry point never calls _traceStart. Added an honest, inferred
 *    fallback rather than leaving it silently blank.
 * 3. The trace overlay panel itself was confirmed capable of fully
 *    covering a real, narrow viewport (420px fixed width, 100vh fixed
 *    height) -- directly matching the user's own reported "the tracing
 *    prevents me from tapping add" -- constrained to never fully cover
 *    the screen.
 *
 * T189 re-anchor: these claims were written when the tracer and the panel's box were inline in qr.html. The tracer is modules/trace.js (T158 on) and the panel's box
 * is the `#traceOverlayPanel` rule in styles/qr.css (the operator's stylesheet split), so each claim now reads the file it lives in. Three of them had gone red
 * silently at T158 (the tracer text was not in the page text any more) and two more at the split; nothing about the corrections themselves had changed except the
 * entry-path fallback, which the tracer now does by following the breadcrumb stack (`_trace`, "Auto-update entryPath whenever the breadcrumb signature moves")
 * instead of writing an "inferred" note.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const QR_HTML = require('./_page.js').readPage(path.join(REPO_ROOT, 'qr.html'));   // the document a browser runs: the stylesheet and the modules in place
const TRACE_SRC = fs.readFileSync(path.join(REPO_ROOT, 'modules', 'trace.js'), 'utf8');   // the tracer itself (the page loads it by URL and the harness does not assemble it in)

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

console.log('=== 1. DOM snapshot: broadened to real, confirmed selectors covering both real rendering systems ===');
check('now checks the real ims-chip/intake-module-step system (renderCuratedCardFromRoute), not just sq-ic-*',
    /querySelectorAll\(\s*'[^']*\.intake-module-step[^']*'\s*\)/.test(TRACE_SRC) && TRACE_SRC.includes('.ims-label'));
check('the second rendering system\'s own real refreshPrice() now calls _traceDomSnapshot -- confirmed the original T106 hook never touched this function at all',
    /function refreshPrice\(\) \{[\s\S]{0,1500}_traceDomSnapshot\('refreshPrice: ims-chip card settled'\)/.test(QR_HTML));
check('the real, confirmed add-to-cart button id (#btn-curated-add, seen directly in the real trace) is now checked, not just .ctap',
    /querySelector\(\s*'[^']*#btn-curated-add[^']*'\s*\)/.test(TRACE_SRC));

console.log('\n=== 2. entryPath: an honest, inferred fallback instead of a silent, permanent "unknown" ===');
check('_trace itself now follows the breadcrumb stack into entryPath when no entry point ever called _traceStart, rather than leaving entryPath silently blank',
    /window\._traceEntryPath = 'catalog:' \+ Breadcrumbs\.stack/.test(TRACE_SRC));

console.log('\n=== 3. Trace panel: confirmed capable of fully covering a real, narrow viewport -- now constrained ===');
const panelRule = (QR_HTML.match(/#traceOverlayPanel\s*\{([^}]*)\}/) || [, ''])[1];   // the panel's box, from the page's stylesheet
check('the page has a #traceOverlayPanel rule to read', panelRule.length > 0);
const panelTag = panelRule;
check('panel width is now capped relative to viewport width (max-width), not just a fixed 420px that can exceed real phone screens',
    /max-width:\s*70vw/.test(panelTag));
check('panel height no longer claims the full 100vh, leaving room for on-screen action buttons near the bottom of a real screen',
    /height:\s*85vh/.test(panelTag) && !/height:\s*100vh/.test(panelTag));

console.log(`\n[T107 tracing corrections] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
