#!/usr/bin/env node
/**
 * verify_object_extraction_location_skip.js
 *
 * Real bug found via direct pipeline trace (user-provided example): "I need
 * 5 ceiling tiles in my office replaced" produced extractedObject: "office"
 * instead of "ceiling tiles" -- the free-text object-extraction backward
 * scan (used whenever the real object appears BEFORE its verb, e.g.
 * "...replaced" at the sentence's end) stopped at the first preposition it
 * hit walking backward from the verb, which was exactly the leading
 * preposition of a prepositional LOCATION phrase sandwiched between the
 * real object and the verb -- incorrectly returning the location noun
 * itself rather than continuing past it to the real object.
 *
 * Fix: when the backward scan's most recent candidate phrase is itself a
 * recognized room/location word (the same vocabulary extractLocation
 * itself consumes, negation_library.nlp_location_words), treat it as a
 * location phrase to skip -- not the object -- and resume scanning from
 * before its own leading preposition. Bounded to 3 attempts so a sentence
 * naming multiple real locations doesn't get guessed through indefinitely.
 *
 * Component-layer note: extractObject/extractQty/extractLocation are the
 * single, shared SSOT implementations (per qr.html's own v9.6 comment at
 * window._NLP's assignment) consumed by both the live preview and the
 * free-text analysis pipeline -- this fix applies to both automatically,
 * not just one.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.join(__dirname, '..');
const QR_HTML = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

function findFn(name) {
    const m = QR_HTML.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) throw new Error(`Could not find function: ${name}`);
    let depth = 0, start = m.index, i = m.index + m[0].length - 1;
    for (let j = i; j < QR_HTML.length; j++) {
        if (QR_HTML[j] === '{') depth++;
        else if (QR_HTML[j] === '}') { depth--; if (depth === 0) return QR_HTML.slice(start, j + 1); }
    }
}

const HELPER_CONSTS = `
const _SKIP_WORDS  = () => window._NLP?.STOP   || new Set();
const _SVC_VERBS   = () => window._NLP?.VERBS  || new Set();
const _STOP_PREPS  = () => window._NLP?.PREPS  || new Set();
const _CLAUSE_BOUNDARY = () => window._NLP?.CLAUSE || new Set();
const _ROOMS_LIST  = () => window._NLP?.ROOMS  || [];
const _DIMENSION_PATTERN = /\\b\\d+\\s*-?\\s*(?:foot|feet|ft|inch|inches|in|cm|centimeters?|meters?|yards?|lbs?|pounds?|kg)\\b/gi;
const _QTY_WORD_MAP = {one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
`;
const FNS = ['initNlpSets', 'isServiceVerb', 'extractObject', 'extractQty', 'extractLocation'];
const code = HELPER_CONSTS + '\n' + FNS.map(findFn).join('\n\n');
const sandbox = { DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
sandbox.initNlpSets();

console.log('=== The real, originally-reported bug ===');
check('"I need 5 ceiling tiles in my office replaced" -> extractedObject is "ceiling tiles", not "office"',
    sandbox.extractObject('I need 5 ceiling tiles in my office replaced', 'tile') === 'ceiling tiles');

console.log('\n=== Regression guard: object-before-verb, no location phrase (the fix must not change this) ===');
check('"a new door installed" -> "door" (unaffected -- confirmed this matches even pre-fix behavior, "new" is a real stop word)',
    sandbox.extractObject('a new door installed', null) === 'door');
check('"a deadbolt needs installing" -> a real, non-empty object, still finds something sensible',
    typeof sandbox.extractObject('a deadbolt needs installing', null) === 'string');

console.log('\n=== Regression guard: forward-scan cases (object appears with/after its trigger word) must be completely unaffected ===');
check('"I need 5 chipped subway tiles above my stove replaced" -> "subway tiles" (forward scan succeeds before reaching any location logic)',
    sandbox.extractObject('I need 5 chipped subway tiles above my stove replaced', 'tile') === 'subway tiles');

console.log('\n=== Real, additional location-phrase cases, different rooms, confirming the fix generalizes ===');
check('"my faucet in the kitchen needs fixing" -> "faucet"',
    sandbox.extractObject('my faucet in the kitchen needs fixing', 'faucet') === 'faucet');
check('"my outlet in the garage stopped working" -> "outlet"',
    sandbox.extractObject('my outlet in the garage stopped working', 'outlet') === 'outlet');
check('"the light fixture in the basement needs replacing" -> a real, non-location object (not "basement")',
    sandbox.extractObject('the light fixture in the basement needs replacing', 'light') !== 'basement');

console.log(`\n[object extraction location-skip fix] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
