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
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const QR_HTML = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

console.log('=== 1. DOM snapshot: broadened to real, confirmed selectors covering both real rendering systems ===');
check('now checks the real ims-chip/intake-module-step system (renderCuratedCardFromRoute), not just sq-ic-*',
    QR_HTML.includes("document.querySelectorAll('.intake-module-step')") && QR_HTML.includes(".ims-label"));
check('the second rendering system\'s own real refreshPrice() now calls _traceDomSnapshot -- confirmed the original T106 hook never touched this function at all',
    /function refreshPrice\(\) \{[\s\S]{0,1500}_traceDomSnapshot\('refreshPrice: ims-chip card settled'\)/.test(QR_HTML));
check('the real, confirmed add-to-cart button id (#btn-curated-add, seen directly in the real trace) is now checked, not just .ctap',
    QR_HTML.includes("document.getElementById('btn-curated-add')"));

console.log('\n=== 2. entryPath: an honest, inferred fallback instead of a silent, permanent "unknown" ===');
check('_trace itself now records an honest, explicit note when no entry point ever called _traceStart, rather than leaving entryPath silently blank',
    /_traceEntryPath = 'catalog_direct \(inferred/.test(QR_HTML));

console.log('\n=== 3. Trace panel: confirmed capable of fully covering a real, narrow viewport -- now constrained ===');
const panelMarker = QR_HTML.indexOf('id="traceOverlayPanel"');
const panelTag = QR_HTML.slice(panelMarker, panelMarker + 400);
check('panel width is now capped relative to viewport width (max-width), not just a fixed 420px that can exceed real phone screens',
    /max-width:\s*70vw/.test(panelTag));
check('panel height no longer claims the full 100vh, leaving room for on-screen action buttons near the bottom of a real screen',
    /height:\s*85vh/.test(panelTag) && !/height:\s*100vh/.test(panelTag));

console.log(`\n[T107 tracing corrections] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
