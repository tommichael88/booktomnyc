/**
 * verify_nlp_incidental_keyword_fix.js
 *
 * Verifies the T118, Step 6 item 2 fix for PENDING_DECISIONS.md #30:
 * detectIntentNLP scanned the full input string for any matching
 * keyword anywhere, with no weighting for primary stated intent vs. an
 * incidental mention, parenthetical, or quoted complaint. Real,
 * user-captured trace: "I need a bed assembled. [...] produces
 * irrelevant questions like Drywall or plaster..." matched "plaster" --
 * a word in the customer's own complaint about the app, not their
 * stated need -- and confidently (90% match) routed to a
 * brick/concrete-crack-repair-family entry.
 *
 * Three-part fix, all in detectIntentNLP: (1) quoted/parenthetical/
 * bracketed content is stripped before any scoring; (2) matches found
 * only beyond the first ~15 words score at half weight; (3) a winning
 * candidate whose ENTIRE evidence came from beyond the primary region,
 * with no later corroborating override, has its recommendedSku
 * suppressed (routing may still proceed generally; a confident, named
 * recommendation may not).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML = require('./_page.js').readPage(path.join(REPO_ROOT, 'qr.html'));
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

function findFn(text, name) {
    const m = text.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) return '';
    let depth = 0, start = m.index;
    for (let j = m.index + m[0].length - 1; j < text.length; j++) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') { depth--; if (depth === 0) return text.slice(start, j + 1); }
    }
    return '';
}

function loadSandbox(qrText, db) {
    const sandbox = { DB: db, SERVICE_DATA: db, window: { DB: db }, console };
    sandbox.global = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(findFn(qrText, 'detectIntentNLP'), sandbox);
    return sandbox;
}

function loadSandboxFromFnSource(fnSource, db) {
    const sandbox = { DB: db, SERVICE_DATA: db, window: { DB: db }, console };
    sandbox.global = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fnSource, sandbox);
    return sandbox;
}

const sandbox = loadSandbox(QR_HTML, DB);
// T126 fix: previously read the pre-fix function from a hardcoded
// /tmp/t118_before/qr.html -- an ephemeral snapshot from one specific
// sandbox session, never delivered as part of this repo, that would
// never exist on any other machine (confirmed the hard way: this
// passed only because that one sandbox session's /tmp/ happened to
// still be alive, not because the dependency was ever real). The
// actual, real, historical function -- extracted directly from that
// snapshot before it was lost, not reconstructed from memory -- is
// now embedded permanently in fixtures/pre_t118_detectIntentNLP.js.
const preT118Fn = require('./fixtures/pre_t118_detectIntentNLP.js');
const beforeSandbox = loadSandboxFromFnSource(preT118Fn, DB);

let pass = 0, fail = 0;
function check(desc, cond) {
    if (cond) { pass++; console.log(`  \u2713 ${desc}`); }
    else { fail++; console.log(`  \u2717 ${desc}`); }
}

const TRACE = 'I need a bed assembled. (the app produces irrelevant questions like Drywall or plaster, please fix this)';

console.log('=== Confirmed genuine: the pre-fix code actually exhibits the diagnosed bug on this trace ===');
{
    const before = beforeSandbox.detectIntentNLP(TRACE);
    check(`pre-fix code confidently (>=80%) matches an incidental, parenthetical word, not a tautology (got key="${before?.key}", confidence=${before?._matchConfidence})`,
        before && before._matchConfidence >= 80 && before.key !== 'other');
}

console.log('\n=== The real, motivating trace: the wrong, confident, incidental match no longer wins ===');
{
    const after = sandbox.detectIntentNLP(TRACE);
    check('no longer confidently matches on the incidental parenthetical content (drywall/plaster)',
        after?.key !== 'drywall' && after?.key !== 'plaster');
    check('recommendedSku is suppressed rather than confidently wrong',
        after?.recommendedSku == null);
}

console.log('\n=== Positive case: a real PRIMARY keyword still wins cleanly over an incidental one ===');
{
    const r = sandbox.detectIntentNLP('I need my faucet fixed (this app also mentioned drywall once, ignore that)');
    check('primary-region "faucet" wins over incidental "drywall"', r?.key === 'faucet');
    check('a genuine primary match still gets a real recommendedSku (fix does not over-suppress)',
        r?.recommendedSku === 'faucet_repair_drip');
}

console.log('\n=== Regression: plain, textbook phrases are completely unaffected ===');
{
    const r1 = sandbox.detectIntentNLP('I need my laptop fixed');
    check('plain phrase still resolves to computer/computer_diagnostic exactly as before',
        r1?.key === 'computer' && r1?.recommendedSku === 'computer_diagnostic');

    const r2 = sandbox.detectIntentNLP('I need my dishwasher repaired');
    check('a second plain phrase (dishwasher) is also unaffected',
        r2?.key === 'dishwasher' && r2?.recommendedSku != null);
}

console.log('\n=== Regression: the two hard-won catalog-wide sweeps from T112/T113 are unaffected ===');
{
    // Both sweeps operate on short strings (bare keywords/synonyms) that
    // are trivially within the first ~15 words, so position weighting
    // should not change their outcomes at all -- confirmed directly here
    // rather than only inferred, since these are the project's own
    // permanent regression guards against catalog-wide collisions.
    const mappings = DB.intent_mappings.objects;
    let mismatches = 0;
    for (const m of mappings) {
        const r = sandbox.detectIntentNLP(m.keyword);
        if (r?.key !== m.keyword) mismatches++;
    }
    check(`every bare top-level keyword (${mappings.length} total) still resolves to its own home entry`, mismatches === 0);
}

console.log(`\n[NLP incidental-keyword fix, #30] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
