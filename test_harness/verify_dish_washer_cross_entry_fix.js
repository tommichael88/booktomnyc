#!/usr/bin/env node
/**
 * verify_dish_washer_cross_entry_fix.js
 *
 * Regression test for the T112 fix (PENDING_DECISIONS #37, closed):
 * "dish washer" -- a completely natural, common spelling of "dishwasher"
 * -- was confidently misrouting to washer_repair (the clothes-washing
 * machine service), because "washer" is a genuine, separate, complete
 * word inside "dish washer", independently triggering the SEPARATE
 * `washer` entry's own full keyword weight (90), which beat
 * `dishwasher`'s own un-promoted synonym weight (45) outright.
 *
 * This is the SAME underlying dishwasher/washer confusion the v9.5 fix
 * (see the comment beside detectIntentNLP's own wordBoundaryIncludes)
 * already fixed once, for the single-word spelling "dishwasher" (no
 * space) matching "washer" as a bare substring with no word boundary.
 * That fix did not, and structurally could not, cover the two-word
 * spelling "dish washer", where "washer" really is its own separate,
 * correctly word-bounded match -- a different textual path to the
 * identical customer confusion.
 *
 * THE FIX (two parts, both required):
 *   1. Data: "dish washer" promoted to `dishwasher`'s own
 *      full_weight_synonyms (bringing its own confidence for this exact
 *      phrase up to the same 90 a keyword match would score).
 *   2. Code: a new cross-entry specificity check in detectIntentNLP,
 *      added AFTER the main scoring loop and BEFORE contextual_overrides
 *      (so every downstream refinement operates on the corrected
 *      winner). Promotion alone would only produce a 90-90 TIE with
 *      `washer` (whose own keyword also matches "dish washer" as a
 *      whole word) -- the existing tie-break is pure array order, not a
 *      reliable resolution. The new check lets a genuinely more
 *      specific, multi-word AUTHORED phrase from a different entry win
 *      outright when it contains the current winner's own bare keyword.
 *
 * WHY THIS TEST IS UNUSUALLY THOROUGH: the first implementation of the
 * code fix, tested only against the diagnosed case, passed -- but a full
 * sweep of every keyword/synonym string in the catalog (441 strings)
 * showed it silently changed 29 different phrases, not 1, several of
 * them by replacing a confident wrong answer with a still-different,
 * LESS confident one (a new problem, not a fix). Two safety conditions
 * were added specifically to bring the mechanism back down to exactly
 * the diagnosed shape: the override candidate must itself clear this
 * catalog's own real confidence gate, and the mechanism never overrides
 * a resolver-bearing entry (e.g. "install"). Confirmed via the same
 * 441-string sweep, repeated below as a permanent regression guard, that
 * this narrowed version changes exactly the one diagnosed case and
 * nothing else. The other 28 changes were real, individually-plausible
 * findings (e.g. "flat screen" incorrectly matching window-screen
 * repair) but NONE were individually verified the way this one was --
 * recorded as PENDING_DECISIONS #38 for dedicated future investigation,
 * not shipped as an unverified side effect of this fix.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(label, cond) {
    if (cond) { pass++; console.log('  \u2713 ' + label); }
    else { fail++; console.log('  \u2717 ' + label); }
}

function findFn(name) {
    const m = QR_HTML.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) return '';
    let depth = 0, start = m.index, j = m.index + m[0].length - 1;
    for (; j < QR_HTML.length; j++) {
        if (QR_HTML[j] === '{') depth++;
        else if (QR_HTML[j] === '}') { depth--; if (depth === 0) return QR_HTML.slice(start, j + 1); }
    }
    return '';
}
const sandbox = { DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(findFn('detectIntentNLP'), sandbox);

console.log('=== The core fix: "dish washer" now correctly resolves to dishwasher, not washer ===');
{
    const r = sandbox.detectIntentNLP('fix my dish washer');
    check('"fix my dish washer" resolves to the dishwasher entry', r.key === 'dishwasher');
    check('"fix my dish washer" scores full weight (90)', r._matchConfidence === 90);
    check('"fix my dish washer" recommends dishwasher_repair, not washer_repair', r.recommendedSku === 'dishwasher_repair');

    const r2 = sandbox.detectIntentNLP('my dish washer won\u2019t drain');
    check('a full, natural sentence variant also resolves correctly', r2.recommendedSku === 'dishwasher_repair');
}

console.log('\n=== Regression guard: the ORIGINAL v9.5 fix (bare "dishwasher", no space) still holds ===');
{
    const r = sandbox.detectIntentNLP('fix my dishwasher');
    check('"fix my dishwasher" still resolves to dishwasher_repair', r.recommendedSku === 'dishwasher_repair');
    check('"fix my dishwasher" still scores full weight', r._matchConfidence === 90);

    const r2 = sandbox.detectIntentNLP('my dishwasher is leaking water');
    check('the exact v9.5 regression-test sentence still resolves correctly', r2.recommendedSku === 'dishwasher_repair');
}

console.log('\n=== Regression guard: the washer entry itself is untouched ===');
{
    for (const phrase of ['washer', 'washing machine', 'clothes washer']) {
        const r = sandbox.detectIntentNLP('fix my ' + phrase);
        check(`"fix my ${phrase}" still resolves to washer_repair`, r.recommendedSku === 'washer_repair');
    }
}

console.log('\n=== Safety condition 1: the override never fires below this catalog\'s own real confidence gate ===');
{
    // Directly demonstrates why the threshold matters, using the exact
    // pair this fix is about: clone the DB with dishwasher's
    // full_weight_synonyms promotion removed (everything else identical,
    // including the T112 code fix) and confirm the override correctly
    // does NOT fire -- without the data promotion, "dish washer" would
    // only clear 45 (half of dishwasher's own weight), below the real
    // gate, so the mechanism must leave `washer` as the winner rather
    // than force an under-confident switch.
    const unpromotedDB = JSON.parse(JSON.stringify(DB));
    const dw = unpromotedDB.intent_mappings.objects.find(e => e.keyword === 'dishwasher');
    dw.full_weight_synonyms = [];
    const sandbox2 = { DB: unpromotedDB, window: { DB: unpromotedDB }, console };
    sandbox2.global = sandbox2;
    vm.createContext(sandbox2);
    vm.runInContext(findFn('detectIntentNLP'), sandbox2);
    const r = sandbox2.detectIntentNLP('fix my dish washer');
    const gate = (DB.global_rules?.thresholds?.route_to_group_other_tile) ?? 50;
    check(`without the data promotion, dishwasher's own score for "dish washer" (${r.key === 'dishwasher' ? r._matchConfidence : 'n/a'}) would be below the gate (${gate}), so the override correctly does not force a switch`,
        r.key === 'washer' && r.recommendedSku === 'washer_repair');
}

console.log('\n=== Safety condition 2: resolver-bearing entries are never overridden ===');
{
    const installEntry = DB.intent_mappings.objects.find(e => e.keyword === 'install');
    check('sanity: the install entry genuinely has a resolver (this test would be meaningless otherwise)', !!installEntry?.resolver);
    const r = sandbox.detectIntentNLP('install on wall');
    check('"install on wall" still resolves through the install resolver, not a same-shape override', r.key === 'install' && r.resolver === installEntry.resolver);
}

console.log('\n=== Full catalog sweep: every keyword/synonym string still resolves to its own home entry, except pre-existing, documented exceptions ===');
{
    // Pre-existing mismatches, confirmed via a precise before/after diff
    // against a scratch copy with exactly the T112 change reverted (not
    // guessed, not assumed) -- 39 strings total resolve to a different
    // entry than their own textbook "home" entry; "dish washer" was the
    // one genuine bug among them (fixed by this session, so deliberately
    // absent from this list -- it must now pass the home-entry check
    // like any other string). The other 38 are real, individually
    // plausible candidates for the SAME shape of bug (e.g. "flat screen"
    // incorrectly matching window-screen repair) but NONE were
    // individually verified the way dish-washer was -- recorded as
    // PENDING_DECISIONS #38 for dedicated future investigation, listed
    // here only so a genuinely NEW, undocumented mismatch still fails
    // this test loudly rather than blending into an already-long list.
    const knownPreExistingExceptions = new Set([
        'plaster', 'install on wall', 'drawer front', 'lock install',
        'assemble furniture', 'concrete crack', 'flat screen', 'smart outlet',
        'wifi plug', 'floor squeak', 'window air conditioner', 'range hood',
        'hanging light', 'hanging fixture', 'door handle', 'door draft',
        'commercial toilet', 'no tank toilet', 'cabinet pull', 'drawer pull',
        'cabinet hardware', 'tidy cables', 'cable organization', 'sink trap',
        'app install', 'tub faucet', 'under-cabinet', 'toilet seal',
        'door viewer', 'cupboard hinge', 'hinge on cabinet', 'drawer handle',
        'cabinet shelves', 'cupboard shelf', 'shelf inside cabinet',
        'leak under sink', 'leaking under sink', 'leak under the sink',
    ]);
    check('the exceptions allowlist has exactly 38 entries (39 true pre-existing mismatches minus the one now-fixed "dish washer")',
        knownPreExistingExceptions.size === 38 && !knownPreExistingExceptions.has('dish washer'));
    let unexpectedMismatches = [];
    let total = 0;
    for (const e of DB.intent_mappings.objects) {
        const strings = [e.keyword, ...(e.synonyms || [])].filter(s => typeof s === 'string');
        for (const s of strings) {
            total++;
            const r = sandbox.detectIntentNLP('fix my ' + s);
            if (r.key !== e.keyword && !knownPreExistingExceptions.has(s)) {
                unexpectedMismatches.push({ testString: s, homeEntry: e.keyword, actuallyWon: r.key, score: r._matchConfidence });
            }
        }
    }
    check(`swept all ${total} keyword/synonym strings in the catalog (sanity check on the sweep itself)`, total > 400);
    check('zero UNEXPECTED mismatches (only the documented pre-existing exceptions remain, "dish washer" now correctly stays home)',
        unexpectedMismatches.length === 0);
    if (unexpectedMismatches.length > 0) {
        console.log('  New/unexpected mismatches found -- investigate before treating this as a passing suite:');
        console.log(JSON.stringify(unexpectedMismatches, null, 2));
    }
}

console.log(`\n[dish washer cross-entry fix verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
