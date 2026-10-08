/**
 * extract_modules.js
 *
 * Extracts each JavaScript module from qr.html and writes it to a separate
 * .js file in the project root, so the existing tests can require() them.
 *
 * Run with: node test_harness/extract_modules.js
 */
const fs = require('fs');
const path = require('path');

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
};

// Read the entire HTML file
const html = fs.readFileSync(QR_PATH, 'utf8');

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
    const byHeader = blocks.find(b => headerRe.test(b));
    if (byHeader) return byHeader;
    // Defensive fallback (should not trigger for any of the 7 known modules
    // today, given the header convention above holds for all of them) --
    // last resort only, not the primary path.
    console.warn(`⚠️ No header-anchored match for "${marker}" -- falling back to bare substring match (unreliable if multiple blocks mention it).`);
    return blocks.find(b => b.includes(marker));
}

// For each module, find the block that contains its marker
let extractedCount = 0;
for (const [filename, marker] of Object.entries(MODULE_MARKERS)) {
    const block = findOwnBlock(blocks, marker);
    if (!block) {
        console.warn(`⚠️ Could not find marker "${marker}" for ${filename} – skipping.`);
        continue;
    }
    const outPath = path.join(PROJECT_ROOT, filename);
    fs.writeFileSync(outPath, block, 'utf8');
    console.log(`✅ Extracted ${filename}`);
    extractedCount++;
}

console.log(`\nExtracted ${extractedCount} modules to ${PROJECT_ROOT}`);
process.exit(0);