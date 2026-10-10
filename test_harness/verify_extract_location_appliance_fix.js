#!/usr/bin/env node
/**
 * verify_extract_location_appliance_fix.js
 *
 * Verifies the PENDING_DECISIONS.md #19 fix: extractLocation's room
 * vocabulary didn't cover appliance/fixture context (e.g. "stove"),
 * so "above my stove" produced no location signal at all.
 *
 * Two real, distinct gaps found and fixed together:
 *
 *   1. The preposition set was `in|into` only. "above my stove",
 *      "behind my fridge", "under my sink" all failed to extract ANY
 *      location before this fix, regardless of vocabulary, because the
 *      regex itself never matched. Confirmed directly, before touching
 *      vocabulary at all: expanding just the preposition set already
 *      made appliance terms fall through to the existing raw-fallback
 *      branch correctly.
 *
 *   2. That raw fallback alone returns an unmapped string ("stove"),
 *      which can never match an existing or future location_hints
 *      entry authored against room names (the one real, live use of
 *      location_hints today, door_style_pref, keys entirely on room
 *      names). Added a new, deliberately conservative
 *      nlp_location_appliance_map for terms with a single, unambiguous
 *      real-world room. Genuinely ambiguous terms (sink, water heater)
 *      are deliberately excluded rather than guessed.
 *
 * A real bug was found and fixed while building this: the appliance
 * lookup was first written as a separate, named helper function
 * (_APPLIANCE_ROOM_MAP), which broke 19 existing tests that extract
 * extractLocation's own source in isolation via a findFn-style
 * mechanism and don't know about a brand-new helper function. Fixed by
 * inlining the lookup directly. This test's own "self-contained
 * extraction" check below guards against that exact regression
 * reappearing.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require(path.join(__dirname, 'node_modules', 'jsdom'));

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML = require('./_page.js').readPage(path.join(REPO_ROOT, 'qr.html'));
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(desc, cond) {
    if (cond) { pass++; console.log(`  \u2713 ${desc}`); }
    else { fail++; console.log(`  \u2717 ${desc}`); }
}

console.log('=== Data: the new appliance map is real, conservative, and deliberately excludes ambiguous terms ===');
{
    const map = DB.negation_library.nlp_location_appliance_map;
    check('stove/oven/range/refrigerator/fridge/dishwasher/microwave all map to kitchen',
        ['stove', 'oven', 'range', 'refrigerator', 'fridge', 'dishwasher', 'microwave'].every(k => map[k] === 'kitchen'));
    check('toilet/bathtub/tub/shower all map to bathroom',
        ['toilet', 'bathtub', 'tub', 'shower'].every(k => map[k] === 'bathroom'));
    check('washer/dryer map to laundry room',
        ['washer', 'dryer'].every(k => map[k] === 'laundry room'));
    check('"sink" is deliberately NOT in the map (genuinely ambiguous: kitchen or bathroom)', !('sink' in map));
    check('"water heater" is deliberately NOT in the map (genuinely ambiguous: basement/garage/utility)', !('water heater' in map));
}

console.log('\n=== Regression guard: extractLocation is still self-contained enough to extract and run in isolation ===');
{
    // This is the exact failure mode the first attempt at this fix hit --
    // 19 existing tests extract this function's own source via a
    // findFn-style brace-counter and run it in a minimal sandbox. If a
    // future edit reintroduces a separately-named helper function
    // dependency, this check catches it here rather than in 19 unrelated
    // test files' confusing "not defined" crashes.
    const m = QR_HTML.match(/function\s+extractLocation\s*\([^)]*\)\s*\{/);
    let depth = 0, start = m.index, src = null;
    for (let j = m.index + m[0].length - 1; j < QR_HTML.length; j++) {
        if (QR_HTML[j] === '{') depth++;
        else if (QR_HTML[j] === '}') { depth--; if (depth === 0) { src = QR_HTML.slice(start, j + 1); break; } }
    }
    check('extractLocation\'s own source was found', !!src);
    const sandbox = { window: { _NLP: { ROOMS: DB.negation_library.nlp_location_words, APPLIANCES: DB.negation_library.nlp_location_appliance_map } } };
    sandbox.global = sandbox;
    const vm = require('vm');
    vm.createContext(sandbox);
    vm.runInContext(
        'const _SKIP_WORDS = () => new Set(); const _SVC_VERBS = () => new Set(); const _ROOMS_LIST = () => window._NLP.ROOMS;\n' + src,
        sandbox
    );
    let threw = null;
    try { sandbox.extractLocation('above my stove'); } catch (e) { threw = e; }
    check('runs standalone with only window._NLP and the three pre-existing lazy accessors -- no new, separately-named helper function required',
        threw === null);
}

const consoleErrors = [];
const dom = new JSDOM(QR_HTML, {
    url: 'https://tommichael88.github.io/booktomnyc/qr.html',
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    beforeParse(window) {
        window.fetch = async (url) => {
            if (String(url).includes('btnyc.json')) return { ok: true, json: async () => DB };
            return { ok: false, status: 404 };
        };
        window.HTMLElement.prototype.scrollIntoView = function () {};
        window.console.error = (...args) => consoleErrors.push(args.join(' '));
    },
});

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

(async () => {
    const w = await wait(3000).then(() => dom.window);

    console.log('\n=== App initializes cleanly ===');
    check('zero console.error calls during init', consoleErrors.length === 0);
    if (consoleErrors.length) consoleErrors.forEach(e => console.log('    console.error:', e));

    console.log('\n=== Real, end-to-end: the exact motivating case, and its neighbors ===');
    const cases = [
        ['above my stove', 'kitchen', 'the exact case #19 was raised about'],
        ['behind my fridge', 'kitchen', 'a different preposition, same room family'],
        ['near the dishwasher', 'kitchen', 'another kitchen appliance, another preposition'],
        ['above my toilet', 'bathroom', 'bathroom fixture, new preposition'],
        ['next to the washer', 'laundry room', 'laundry appliance, a two-word preposition'],
        ['under my sink', 'sink', 'deliberately ambiguous -- extracted, but NOT force-mapped to a room'],
    ];
    for (const [input, expected, note] of cases) {
        const got = w.extractLocation(input);
        check(`"${input}" -> "${expected}" (${note})`, got === expected);
    }

    console.log('\n=== Regression: pre-existing room-name detection via "in"/"into" is untouched ===');
    check('"in my kitchen" still -> "kitchen"', w.extractLocation('in my kitchen') === 'kitchen');
    check('"into the garage" still -> "garage"', w.extractLocation('into the garage') === 'garage');

    console.log('\n=== Regression: text with no location signal at all still correctly returns null ===');
    check('"fix my laptop" -> null', w.extractLocation('fix my laptop') === null);

    console.log(`\n[extractLocation appliance fix, #19] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
    process.exit(fail > 0 ? 1 : 0);
})();
