/**
 * extract_modules.js
 *
 * Extracts each JavaScript module from the PAGE and writes it to a separate
 * .js file in the project root, so the existing tests can require() them.
 *
 * T158: "the page" is qr.html with its external <script src> files in place (see _page.js:
 * a URL under the deployed base IS the repo file at the rest of the URL, e.g. modules/nlp_engine.js).
 * The root files this writes are generated, gitignored copies; modules/*.js and qr.html are the sources.
 * A module that cannot be found by its own header is an ERROR (the earlier "bare substring" fallback
 * silently wrote the orchestrator block under the name nlp_engine.js once nlp_engine moved out of qr.html).
 *
 * Run with: node test_harness/extract_modules.js
 */
const fs = require('fs');
const path = require('path');
const page = require('./_page.js');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const QR_PATH = path.join(PROJECT_ROOT, 'qr.html');

// Map each module name to a unique marker inside its <script> block.
// The marker can be a comment or a distinctive function name.
const MODULE_MARKERS = {
    'pricing_engine.js':        'pricing_engine.js',
    'nlp_engine.js':            'nlp_engine.js',
    'orchestrator_engine.js':   'orchestrator_engine.js',
    'UIRenderer.js':            'UIRenderer.js',
    'AppController.js':         'AppController.js',
    'appReducer.js':            'appReducer.js',
    'store.js':                 'store.js',
    'cart_logic.js':            'cart_logic.js',
};

// Read the page as a browser runs it: external scripts assembled in place (throws if a named file is missing)
const html = page.readPage(QR_PATH);

// Extract all <script> blocks, stripping outer IIFE wrappers if present
function extractScriptBlocks(html) {
    const blocks = [];
    const scriptRegex = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g;
    let match;
    while ((match = scriptRegex.exec(html)) !== null) {
        let content = match[1];
        // Remove outer IIFE: (function(){ ... })()
        const iifeMatch = content.match(/^\s*\(function\s*\(\)\s*\{([\s\S]*)\}\s*\)\s*\(\s*\)\s*;?\s*$/);
        if (iifeMatch) {
            content = iifeMatch[1];
        }
        blocks.push(content);
    }
    return blocks;
}

const blocks = extractScriptBlocks(html);

// For each module, find the block that IS that module (not merely a block
// that mentions it). Every real module block opens with its own JSDoc
// header (`/**\n * FILENAME\n *\n * PHASE N ...`) — anchoring to that
// header, rather than a bare substring match anywhere in the block, is
// required now that these headers cross-reference each other by name
// ("See pricing_engine.js and nlp_engine.js for the first two modules...").
// A bare `blocks.find(b => b.includes(marker))` silently picks the FIRST
// block that merely *mentions* the filename — confirmed to actually
// mis-extract orchestrator_engine.js and AppController.js as byte-for-byte
// copies of nlp_engine.js, and store.js as a copy of appReducer.js, since
// nlp_engine.js's/appReducer.js's own header comments happen to name-check
// those other files first. Fixed by requiring the marker to appear as the
// block's own self-identifying header line.
function findOwnBlock(blocks, marker) {
    const headerRe = new RegExp('^\\s*/\\*\\*\\s*\\r?\\n\\s*\\*\\s*' + marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
    return blocks.find(b => headerRe.test(b)) || null;
}

// For each module, find the block that contains its marker
let extractedCount = 0;
for (const [filename, marker] of Object.entries(MODULE_MARKERS)) {
    const block = findOwnBlock(blocks, marker);
    if (block === null) {
        console.error(`❌ No <script> block opens with a header naming "${marker}" (page: ${QR_PATH}). Not guessing: fix the page or MODULE_MARKERS.`);
        process.exit(1);
    }
    const outPath = path.join(PROJECT_ROOT, filename);
    fs.writeFileSync(outPath, block, 'utf8');
    console.log(`✅ Extracted ${filename}`);
    extractedCount++;
}

console.log(`\nExtracted ${extractedCount} modules to ${PROJECT_ROOT}`);
process.exit(0);