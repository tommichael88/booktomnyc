#!/usr/bin/env node
/**
 * verify_smoke_test_findings.js
 *
 * Regression test for real bugs found via an external, comprehensive smoke
 * test (214 real scenarios: every named service, every group+serviceType
 * dynamic combination, and 55 curated NLP phrases) that surfaced 116 real
 * validation issues -- now 0.
 *
 * The single largest fix was a real, substantial dynamic_services
 * enrichment (14 -> 96 entries) merged in from an external script run,
 * covering the vast majority of the 116 issues (every group+serviceType
 * combination that previously had no real data, silently falling back to
 * a generic "183" placeholder). That data merge itself isn't re-verified
 * here (it's just data, covered by the standard schema/consultation
 * checks) -- this test covers the real, separate CODE bugs the smoke test
 * also surfaced, each investigated and root-caused individually:
 *
 * 1. Four intent_mappings entries ("faucet / sink", "drywall / wall",
 *    "tile / floor", "cabinet / drawer") had compound display-label
 *    keywords that never appeared literally in real customer phrasing, so
 *    their full, authored confidence_weight silently never applied --
 *    always fell back to the half-weight synonym path. Fixed via a
 *    per-entry, individually-verified-safe rename to the single most
 *    specific term (NOT a blanket algorithm change -- "wall" was
 *    confirmed genuinely unsafe to promote, since it collides with the
 *    entirely separate wall_mounting category; "sink"/"floor" were
 *    confirmed safe and given an explicit, opt-in full_weight_synonyms
 *    entry instead).
 *
 * 2. A confidence bump for "faucet" (now correctly scoring 80, not 40)
 *    could outscore "install" (75) for phrases containing both, bypassing
 *    the object-based resolver mechanism entirely and defaulting to the
 *    wrong stype (Repair instead of Install) for "install a new faucet"
 *    -type phrases. Fixed: resolver-bearing entries (currently just
 *    "install") win when their own keyword explicitly matched, since an
 *    explicit action verb is a stronger signal than which object scored
 *    marginally higher.
 *
 * 3. extractQty's bare-digit fallback had no requirement that the number
 *    appear alongside any real context -- a customer typing literally
 *    just "12345" was treated as qty=99 (clamped from 12345), producing a
 *    $555,060 quote for meaningless input. Fixed: the fallback now
 *    requires real, non-numeric content to remain after the digit and
 *    punctuation are stripped away.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

function findFn(name) {
    const m = QR_HTML.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) return null;
    let depth = 0, start = m.index, i = m.index + m[0].length - 1;
    for (let j = i; j < QR_HTML.length; j++) {
        if (QR_HTML[j] === '{') depth++;
        else if (QR_HTML[j] === '}') { depth--; if (depth === 0) return QR_HTML.slice(start, j + 1); }
    }
    return null;
}
const code = ['detectIntentNLP', 'extractQty', 'extractObject', 'wordBoundaryIncludes', 'isInflectionOnly', 'normStype']
    .map(findFn).join('\n\n');
const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console, _QTY_WORD_MAP: {}, _DIMENSION_PATTERN: /\b\d+\s*-?\s*(?:foot|feet|ft|inch|inches|in|cm|centimeters?|meters?|yards?|lbs?|pounds?|kg)\b/gi };
sandbox.global = sandbox;
const vm = require('vm');
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'smoke_findings_check' });
// pull the real _QTY_WORD_MAP too since extractQty depends on it
const qtyMapMatch = QR_HTML.match(/_QTY_WORD_MAP\s*=\s*\{[^}]*\}/);
if (qtyMapMatch) vm.runInContext('const ' + qtyMapMatch[0] + '; this._QTY_WORD_MAP = _QTY_WORD_MAP;', sandbox);

console.log('=== Fix 1: compound-keyword entries now correctly earn their full, authored weight ===');
{
    const cases = [
        ['fix a dripping faucet in the kitchen', 'faucet', 80],
        ['replace kitchen faucet cartridge', 'faucet', 80],
        ['repair drywall tape that is peeling', 'drywall', 60],
    ];
    let allPass = true;
    for (const [phrase, expectedKey, expectedConf] of cases) {
        const intent = sandbox.detectIntentNLP(phrase);
        if (intent.key !== expectedKey || intent._matchConfidence !== expectedConf) {
            allPass = false;
            console.log(`    "${phrase}": got key=${intent.key} conf=${intent._matchConfidence}, expected key=${expectedKey} conf=${expectedConf}`);
        }
    }
    check('all 3 previously under-scored phrases now score their full, authored weight', allPass);
}

console.log('\n=== Fix 1b: "wall" was deliberately NOT promoted (genuine cross-category risk) ===');
{
    const intent = sandbox.detectIntentNLP('hang a picture on the wall');
    check('"hang a picture on the wall" still correctly resolves to "mount", not "drywall"', intent.key === 'mount');
}

console.log('\n=== Fix 2: resolver-bearing entries win when their own keyword explicitly matched ===');
{
    const installResult = sandbox.detectIntentNLP('I need to install a new faucet');
    check('"install a new faucet" correctly resolves via the object-based resolver, not faucet directly',
        installResult.resolver === 'object_based' && installResult.stype === 'Install');
    const faucetResult = sandbox.detectIntentNLP('fix a dripping faucet in the kitchen');
    check('a phrase without "install" is unaffected -- faucet still wins directly', faucetResult.key === 'faucet' && faucetResult.resolver === null);
}

console.log('\n=== Fix 3: extractQty no longer treats a meaningless bare number as a real quantity ===');
{
    const cases = [
        ['12345', 1], ['999999', 1], ['mount 5 tvs', 5],
        ['replace 3 outlets', 3], ['install 12 switches', 12],
    ];
    let allPass = true;
    for (const [input, expected] of cases) {
        const result = sandbox.extractQty(input);
        if (result !== expected) { allPass = false; console.log(`    extractQty("${input}") = ${result}, expected ${expected}`); }
    }
    check('all 5 quantity-extraction cases produce the correct result', allPass);
}

console.log(`\n[smoke test findings verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
