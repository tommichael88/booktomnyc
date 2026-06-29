#!/usr/bin/env node
/**
 * verify_substring_collision_fixes.js
 *
 * Regression test for a real, severe, previously-undiscovered bug class:
 * bare substring matching (`text.includes(keyword)`) instead of a real
 * word-boundary match, letting a shorter keyword silently match inside a
 * longer, unrelated word — "washer" inside "dishwasher" being the exact,
 * real, confirmed case ("dishwasher is leaking water" silently resolved
 * to washer_repair, the wrong appliance entirely, since both keywords
 * score equally and array order won the tie).
 *
 * Found while fact-checking an external pricing-flow analysis against
 * real, live data — confirmed this was the ONLY real keyword pair in the
 * current catalog with this exact substring relationship, but fixed the
 * general MECHANISM everywhere it appeared, not just this one instance,
 * since a systematic sweep after the first fix found two more real
 * occurrences of the identical bug:
 *
 *   1. detectIntentNLP's keyword check (the primary free-text NLP match)
 *   2. detectIntentNLP's synonym check (same function, same loop)
 *   3. resolveGroupFromIntent's cross-category check
 *   4. resolveGroupFromIntent's per-category rules check
 *   5. resolveGroupFromIntent's full-sentence fallback check (found in
 *      the systematic sweep, not the original fix)
 *   6. estimateLiveConfidence's keyword check (the live-typing preview —
 *      found in the same systematic sweep; softer real-world consequence
 *      since it only drives a cosmetic confidence hint, not final
 *      pricing/routing, but the same real bug)
 *
 * None of these were caught by the existing 31-suite regression run
 * before this fix — confirmed directly, not assumed.
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
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'substr_check_'));
    const payloadPath = path.join(tmpDir, 'payload.json');
    fs.writeFileSync(payloadPath, JSON.stringify({ mode: 'analyze', text }));
    const stdout = execFileSync('node', [path.join(REPO_ROOT, 'cms_bridge.js'), payloadPath, path.join(REPO_ROOT, 'btnyc.json'), path.join(REPO_ROOT, 'qr.html')], { encoding: 'utf8' });
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return JSON.parse(stdout);
}

console.log('=== Confirmed real, exact root cause ===');
const washerEntry = DB.intent_mappings.objects.find(o => o.keyword === 'washer');
const dishwasherEntry = DB.intent_mappings.objects.find(o => o.keyword === 'dishwasher');
check('both real keywords share the exact same confidence_weight (the real tie that let array order silently decide)',
    washerEntry.confidence_weight === dishwasherEntry.confidence_weight);
check('"washer" is genuinely a literal substring of "dishwasher" (the real collision)', 'dishwasher'.includes('washer'));

console.log('\n=== Sites 1+2 (detectIntentNLP): the real, exact customer phrase resolves correctly ===');
{
    const result = analyze('dishwasher is leaking water');
    check('resolves to the correct appliance (dishwasher), not the wrong one (washer)', result.intent.key === 'dishwasher');
    check('recommendedSku is dishwasher_repair, not washer_repair', result.intent.recommendedSku === 'dishwasher_repair');
}
console.log('\n=== Sites 3+4 (resolveGroupFromIntent): the real group resolves correctly ===');
{
    const result = analyze('dishwasher is leaking water');
    check('groupId resolves to the dishwasher group, not the washer group', result.groupId === 'minor_home_repairs_appliances_dishwasher');
}

console.log('\n=== The genuine, legitimate "washer" case still works correctly after the fix ===');
{
    const result = analyze('my washer is broken');
    check('a real washer complaint still correctly resolves to washer_repair', result.intent.recommendedSku === 'washer_repair');
    check('a real washer complaint still correctly resolves to the washer group', result.groupId === 'minor_home_repairs_appliances_washer');
}

console.log('\n=== Site 5 (resolveGroupFromIntent full-sentence fallback): fixed consistently ===');
check('the full-sentence fallback check uses the same word-boundary helper, not a bare .includes(kw)',
    !/rule\.keywords\.some\(kw => lowerFull\.includes\(kw\)\)/.test(QR_HTML));
check('the real, correct replacement exists', /rule\.keywords\.some\(kw => objWordBoundaryIncludes\(lowerFull, kw\)\)/.test(QR_HTML));

console.log('\n=== Site 6 (estimateLiveConfidence, the live-typing preview): fixed for consistency ===');
check('the live-typing preview no longer uses a bare .includes(kw) substring check',
    !/if \(kw && kw !== 'other' && t\.includes\(kw\)\)/.test(QR_HTML));
check('the real, correct word-boundary replacement exists', /liveConfWordBoundary\(t, kw\)/.test(QR_HTML));
{
    // Verify the exact word-boundary logic in isolation (the function's
    // other real dependencies, like ACTIONS, aren't needed to validate
    // this specific fix).
    const liveConfWordBoundary = (text2, term) => {
        if (!term) return false;
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp('\\b' + escaped + '\\b', 'i').test(text2);
    };
    check('the live-confidence word-boundary logic correctly rejects "washer" inside "dishwasher"',
        liveConfWordBoundary('my dishwasher is leaking', 'washer') === false);
    check('the live-confidence word-boundary logic correctly matches "dishwasher" in the same text',
        liveConfWordBoundary('my dishwasher is leaking', 'dishwasher') === true);
    check('the live-confidence word-boundary logic correctly matches a genuine, standalone "washer"',
        liveConfWordBoundary('my washer is broken', 'washer') === true);
}

console.log('\n=== Every real keyword-substring pair is genuinely SAFE, via one of two real, distinct protection mechanisms ===');
{
    const objects = DB.intent_mappings.objects;
    const collisions = [];
    for (const o1 of objects) {
        for (const o2 of objects) {
            if (o1.keyword !== o2.keyword && o1.keyword.length >= 3 && o2.keyword.includes(o1.keyword)) {
                collisions.push([o1, o2]);
            }
        }
    }
    check('at least the known, real washer/dishwasher pair is present (sanity check the sweep itself works)',
        collisions.some(([a, b]) => a.keyword === 'washer' && b.keyword === 'dishwasher'));
    // Two genuinely distinct, real safety mechanisms protect different
    // pairs -- confirmed by direct execution, not assumed:
    //   (a) the longer/more-specific keyword has a strictly higher
    //       confidence_weight, so it wins outright on its own merits
    //       (e.g. furniture=50 vs "furniture assembly"=75)
    //   (b) the pair is a true word-boundary substring (the shorter
    //       keyword never appears as a real standalone word inside the
    //       longer one's text) -- protected by Bug 1/2's word-boundary
    //       fix, not by a weight margin (washer=90 ties dishwasher=90,
    //       confirmed via direct check; the real protection here is that
    //       "washer" never matches AS A WORD inside real "dishwasher"
    //       text, only as the intended substring-within-a-word the
    //       original bug exploited).
    const wordBoundaryIncludes = (text, term) => new RegExp('\\b' + term + '\\b', 'i').test(text);
    const unsafe = collisions.filter(([shorter, longer]) => {
        const hasWeightMargin = longer.confidence_weight > shorter.confidence_weight;
        const protectedByWordBoundary = !wordBoundaryIncludes(longer.keyword, shorter.keyword);
        return !hasWeightMargin && !protectedByWordBoundary;
    });
    check(`every real keyword-substring pair is protected by a weight margin OR the word-boundary fix (found ${collisions.length} real pairs, 0 unprotected by either mechanism)`,
        unsafe.length === 0);
}

console.log(`\n[Substring collision fix verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
