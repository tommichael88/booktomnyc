#!/usr/bin/env node
/**
 * verify_harness_boots_nlp.js -- a test that calls the NLP engine runs it the way the page does, or it measures a parser no customer ever has.
 *
 * @enforces R-INVARIANT-DISEASE
 *
 * THE CLASS (proposed name DEFECT-UNBOOTED-MEASUREMENT, PENDING_DECISIONS #164; the Charter does not name it, so no @detects tag): the page, before it reads any text, calls
 * `initNlpSets(); refreshNlpPreviewBindings();` (qr.html boot), which fills window._NLP from DB.negation_library: the stop words, the prepositions, the clause words, the service verbs, the action
 * table. A harness that loads the engine modules into a sandbox and calls detectTagsNLP / detectIntentNLP / understandRequest / collectBookingContext_freeText without those two calls runs the
 * engine against EMPTY word sets. Measured at T166: "the toilet won't stop running" and "I need a helper for this" behave differently in that state than in the page's; a tag-matching change
 * that passed every probe in the un-booted state failed two corpus sentences once the sets were filled, and an object extractor with no prepositions turned "a ceiling fan for my partner" into
 * the object "install a ceiling fan for". Twenty-three harness files call the NLP functions this way. (price_golden_master.js already boots the engine; its comment says why.)
 *
 * WHAT THIS ASSERTS: (1) the scan sees enough files to mean something; (2) no harness file that calls an NLP entry point lacks the boot (a call to initNlpSets, or a real page: puppeteer / jsdom)
 * unless it is on the ratchet list `test_harness/tools/unbooted_nlp_baseline.json`; (3) every file on the list still exists and still lacks the boot (the list only shrinks: a file that boots
 * leaves it); (4) non-vacuity: the scanner flags a synthetic test that calls the engine un-booted, passes the same test once it boots, and ignores a mention in a comment.
 *
 * WHAT THIS DOES NOT DO: fix the twenty-three. Booting them changes what they measure, so each is a judgement (does its assertion still hold on the parser the page runs?) that belongs to a sweep,
 * not to a lint; the list is that sweep's worklist and its length is the ratchet.
 *
 * Reading: acorn's tokenizer, so a mention in a comment is not a call. An entry point named in a string or a template literal (an extractor's list of function names, code handed to a VM) counts as a
 * reference to it; the boot counts when initNlpSets is an identifier in the file's own code, or is CALLED inside code the file hands to a VM ("initNlpSets()" in a string or template), or when the file
 * drives a real page. A list of names ('initNlpSets' among function names to extract) is not a boot.
 *
 *   node test_harness/verify_harness_boots_nlp.js --write-baseline     rewrite the ratchet list from the tree as it is (use it only to SHRINK the list, or to start it)
 */
'use strict';
const fs = require('fs'), path = require('path');
const { check, finish } = require('./_shared.js');
const acorn = require('acorn');

const HARNESS = __dirname;
const BASELINE_PATH = path.join(HARNESS, 'tools', 'unbooted_nlp_baseline.json');
const ENTRY = new Set(['detectTagsNLP', 'detectIntentNLP', 'understandRequest', 'collectBookingContext_freeText', 'inferTagsFromContext', 'extractObject']);
const PAGE_RUNNERS = /puppeteer|jsdom|_jsdom_helpers/;
const SELF = path.basename(__filename);

/** What a source text does: { entry: it names an NLP entry point (identifier or string), boot: it calls initNlpSets (identifier) or drives a real page (a module named puppeteer / jsdom) }. */
function scan(src) {
    let entry = false, boot = false;
    const ENTRY_RE = new RegExp('\\b(?:' + [...ENTRY].join('|') + ')\\b'), BOOT_CALL = /\binitNlpSets\s*\(/;
    try {
        for (const tok of acorn.tokenizer(src, { ecmaVersion: 'latest', allowHashBang: true, allowReturnOutsideFunction: true })) {
            const v = tok.value, label = tok.type.label;
            if (label === 'name') { if (ENTRY.has(v)) entry = true; if (v === 'initNlpSets') boot = true; }
            else if ((label === 'string' || label === 'template') && typeof v === 'string') { if (ENTRY_RE.test(v)) entry = true; if (BOOT_CALL.test(v) || PAGE_RUNNERS.test(v)) boot = true; }
        }
    } catch (e) { return { entry: ENTRY_RE.test(src), boot: BOOT_CALL.test(src) || /\.initNlpSets\b/.test(src) || PAGE_RUNNERS.test(src), unparsed: true }; }
    return { entry, boot };
}
const files = [];
for (const dir of [HARNESS, path.join(HARNESS, 'tools')]) {
    for (const f of fs.readdirSync(dir)) {
        if (!/\.js$/.test(f) || f.startsWith('_') || f === SELF) continue;
        if (dir === HARNESS && !/^verify_/.test(f)) continue;
        files.push(path.relative(HARNESS, path.join(dir, f)).split(path.sep).join('/'));
    }
}
const callers = [], unbooted = [];
for (const rel of files) { const r = scan(fs.readFileSync(path.join(HARNESS, rel), 'utf8')); if (!r.entry) continue; callers.push(rel); if (!r.boot) unbooted.push(rel); }

if (process.argv.includes('--write-baseline')) {
    const prev = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
    fs.writeFileSync(BASELINE_PATH, JSON.stringify({ _note: prev._note, files: unbooted.slice().sort() }, null, 1) + '\n');
    console.log(`wrote ${unbooted.length} files to ${path.relative(process.cwd(), BASELINE_PATH)} (${callers.length} files call an NLP entry point)`); process.exit(0);
}
const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')).files;
check('the scan sees enough harness files that call an NLP entry point to mean something (>= 25)', callers.length >= 25, { expected: '>= 25', got: callers.length });
const fresh = unbooted.filter(f => !baseline.includes(f));
check('every harness file that calls an NLP entry point boots the engine (initNlpSets, or a real page) unless it is on the ratchet list', fresh.length === 0, { expected: 'none new', got: fresh.join(', '), hint: 'call sb.initNlpSets() and sb.refreshNlpPreviewBindings() after loading the modules (see verify_tag_detection_precision.js), or run a real page' });
const healed = baseline.filter(f => !unbooted.includes(f));
check('every file on the ratchet list still exists and still lacks the boot (a file that boots leaves the list: it only shrinks)', healed.length === 0, { expected: 'none', got: healed.join(', '), hint: 'delete these from test_harness/tools/unbooted_nlp_baseline.json' });
check(`the ratchet list is the sweep's worklist: ${baseline.length} files (it must not grow past 23)`, baseline.length <= 23, { expected: '<= 23', got: baseline.length });

const UNBOOTED = "const sb = load(); sb.detectTagsNLP('the toilet is running');";
const BOOTED = "const sb = load(); sb.initNlpSets(); sb.detectTagsNLP('the toilet is running');";
const COMMENT = "// call initNlpSets() first\nconst sb = load(); sb.detectTagsNLP('x');";
const STRINGLIST = "const FNS = ['initNlpSets', 'detectTagsNLP']; run(FNS);";
const PAGE = "const puppeteer = require('puppeteer'); page.evaluate(() => understandRequest('x'));";
const a = scan(UNBOOTED), b = scan(BOOTED), c = scan(COMMENT), d = scan(STRINGLIST), e = scan(PAGE);
check('(non-vacuity) the scanner flags a test that calls the engine without the boot', a.entry && !a.boot, { expected: 'entry, no boot', got: JSON.stringify(a) });
check('(non-vacuity) the scanner passes the same test once it calls initNlpSets', b.entry && b.boot, { expected: 'entry, boot', got: JSON.stringify(b) });
check('(non-vacuity) a mention of initNlpSets in a comment, or in a list of function names, is not the boot', !c.boot && !d.boot, { expected: 'no boot', got: JSON.stringify({ comment: c, list: d }) });
check('(non-vacuity) a test that drives a real page counts as booted', e.entry && e.boot, { expected: 'entry, boot', got: JSON.stringify(e) });
finish();
