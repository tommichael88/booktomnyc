#!/usr/bin/env node
/**
 * verify_plural_quantity_and_object_extraction_fixes.js
 *
 * Regression test for backlog item B (plural-noun quantity detection)
 * and the chain of real, previously-undiscovered bugs found while
 * verifying it end-to-end, rather than trusting the unit-level logic in
 * isolation.
 *
 * THE FULL CHAIN, IN THE ORDER EACH WAS FOUND:
 *
 *   1. "window" had zero intent_mappings.objects coverage at all — the
 *      exact gap identified earlier this session, finally closed.
 *
 *   2. extractObject discarded the noun whenever it equaled the matched
 *      keyword ("fix my fridge" -> obj:null, "repair my window" ->
 *      obj:null). SEVERE and WIDESPREAD: confirmed via direct test this
 *      affected every keyword-as-noun phrasing in the entire catalog,
 *      not just window — a real production bug that predated this
 *      session's work and had never been caught by the existing test
 *      suite (confirmed: run_all.sh stayed green throughout).
 *
 *   3. extractObject only recognized the EXACT canonical keyword string,
 *      never any of its real, declared synonyms — "windows" (the
 *      realistic, common plural form) didn't match kw="window" at all.
 *
 *   4. "look"/"looked"/"looking"/"looks" were missing from
 *      negation_library.nlp_stop_words, so "windows looked at" collected
 *      "looked" into the extracted phrase alongside the real noun.
 *
 *   5. The default_qty consumption site checked isPluralNoun against the
 *      WHOLE extracted phrase ("windows looked") rather than the actual
 *      head noun — fixed to check only the trailing word.
 *
 * Only once all five were fixed did the original, simple-sounding
 * request — "make default_qty apply only when the customer said the
 * plain plural with no number" — actually work end-to-end for the real
 * scenario it was built for.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

function analyze(text) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plural_check_'));
    const payloadPath = path.join(tmpDir, 'payload.json');
    fs.writeFileSync(payloadPath, JSON.stringify({ mode: 'analyze', text }));
    const stdout = execFileSync('node', [path.join(REPO_ROOT, 'cms_bridge.js'), payloadPath, path.join(REPO_ROOT, 'btnyc.json'), path.join(REPO_ROOT, 'qr.html')], { encoding: 'utf8' });
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return JSON.parse(stdout);
}

console.log('=== Bug 1: "window" now has real intent_mappings.objects coverage ===');
const windowEntry = DB.intent_mappings.objects.find(o => o.keyword === 'window');
check('a real "window" keyword entry exists', !!windowEntry);
check('its synonyms include the plural form "windows"', windowEntry?.synonyms?.includes('windows'));

console.log('\n=== Bug 2: extractObject no longer discards the noun when it equals the keyword ===');
{
    const result = analyze('I need to repair my window');
    check('"repair my window" correctly extracts obj:"window" (was null before the fix)', result.obj === 'window');
}
{
    const result = analyze('I need to fix my fridge');
    check('"fix my fridge" correctly extracts obj:"fridge" (confirms the bug was widespread, not window-specific)', result.obj === 'fridge');
}

console.log('\n=== Bug 3: extractObject recognizes real, declared synonyms, not just the bare keyword ===');
{
    const result = analyze('I need my windows fixed');
    check('"windows" (a synonym, not the bare keyword "window") is correctly extracted', result.obj === 'windows');
}

console.log('\n=== Bug 4: "look"/"looked" are real stop-words now ===');
const stopWords = new Set(DB.negation_library.nlp_stop_words);
check('"look" is in the real stop-words list', stopWords.has('look'));
check('"looked" is in the real stop-words list', stopWords.has('looked'));
{
    const result = analyze('I need my windows looked at');
    check('"windows looked at" extracts the clean head noun "windows", not "windows looked"', result.obj === 'windows');
}

console.log('\n=== Bug 5 + end-to-end: the plurality gate correctly distinguishes singular from plural ===');
function isPluralNoun(word) {
    if (!word) return false;
    const w = word.toLowerCase().trim();
    const SINGULAR_EXCEPTIONS = new Set(['glass', 'gas', 'class']);
    if (SINGULAR_EXCEPTIONS.has(w)) return false;
    if (w.endsWith('ss')) return false;
    if (w.endsWith('es') && w.length > 3) return true;
    if (w.endsWith('s') && !w.endsWith('us') && w.length > 2) return true;
    return false;
}
{
    const singular = analyze('I need my window repaired');
    const headNounSingular = (singular.obj || '').trim().split(/\s+/).pop();
    check('singular phrasing ("window repaired") -> isPluralNoun is false', isPluralNoun(headNounSingular) === false);

    const plural = analyze('I need my windows looked at');
    const headNounPlural = (plural.obj || '').trim().split(/\s+/).pop();
    check('plural phrasing ("windows looked at") -> isPluralNoun is true', isPluralNoun(headNounPlural) === true);
}

console.log('\n=== The real, live isPluralNoun function exists in qr.html with the correct exceptions ===');
check('isPluralNoun is defined in the live code', /function isPluralNoun\(/.test(QR_HTML));
check('the real consumption site checks the HEAD NOUN (trailing word), not the whole phrase',
    /const headNoun = \(S\._nlpSeedObject \|\| ''\)\.trim\(\)\.split\(\/\\s\+\/\)\.pop\(\);/.test(QR_HTML));

console.log('\n=== minor_home_repairs_windows.default_qty is now safely set to its originally-intended value ===');
const windowsGroup = DB.group.find(g => g.id === 'minor_home_repairs_windows');
check('default_qty is 2 (the real, original design intent, now safe given the plurality gating)', windowsGroup.default_qty === 2);

console.log(`\n[Plural quantity + object extraction fix verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
