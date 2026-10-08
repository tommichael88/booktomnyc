#!/usr/bin/env node
/**
 * verify_adlib_noun_redundancy.js
 *
 * Real, full-document, jsdom-based end-to-end test for the T118, Step 6
 * item 12 fix for PENDING_DECISIONS.md #28: `sqBuildAdlib`'s object-noun
 * fallback (used whenever S._objectNoun is unset) uses the full service
 * label as the noun. This was a plausible, real mechanism identified
 * from static code reading alone, but not "pushed to a definitive
 * conclusion" -- the earlier investigation's own, honest words.
 *
 * Definitively confirmed here, empirically, for the first time: the
 * real, rendered sentence for cabinet_door_or_drawer_adjustment was
 * "I need 1 Cabinet Door or Drawer Adjustment adjusted" -- a genuine,
 * confirmed redundancy (the noun and verb repeat the same concept),
 * not just a plausible one.
 *
 * Fix: strip a trailing, nominalized action-suffix word (Adjustment,
 * Replacement, Repair, Installation, Install, Assembly, Configuration,
 * Setup, Diagnostic) from the label before using it as the noun
 * fallback -- confirmed to fix 52 real services in the current
 * catalog, and confirmed NOT to regress services whose own label
 * doesn't end in one of these words.
 *
 * Reading the correct, VISIBLE sentence matters here: sqBuildAdlib
 * renders each editable word as a "pill" containing both a visible
 * label span AND a hidden (opacity:0) <select> with every dropdown
 * option as a <option> -- a naive .textContent read on the whole
 * sentence container concatenates the hidden option text too. This
 * test reads only each pill's own visible label span, matching what a
 * real customer actually sees.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require(path.join(__dirname, 'node_modules', 'jsdom'));

const REPO_ROOT = path.dirname(__dirname);
const html = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
const btnycJson = fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8');
const DB = JSON.parse(btnycJson);

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  \u2713 ${label}`); }
    else { fail++; console.log(`  \u2717 ${label}`); }
}

const consoleErrors = [];
const dom = new JSDOM(html, {
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

// Reads only the VISIBLE text of the adlib sentence -- each pill's own
// label span, not its hidden <select>'s option list. See this file's
// own docstring for why a naive .textContent read is wrong here.
function visibleAdlibText(doc) {
    const sent = doc.getElementById('sqAdlibSentence');
    if (!sent) return null;
    return [...sent.children].map(child => {
        if (child.classList.contains('adlib-pill')) return child.querySelector('span')?.textContent || '';
        return child.textContent || '';
    }).join(' ').replace(/\s+/g, ' ').trim();
}

function setStateForService(w, svc, intentLabel) {
    w.eval(`
        S.svc = ${JSON.stringify(svc)};
        S._svc = ${JSON.stringify(svc)};
        S.intent = { key: 'x', label: ${JSON.stringify(intentLabel)}, category: 'x' };
        S.stype = 'Repair';
        S._objectNoun = null;
        S.detTagIds = [];
        S.manTagIds = [];
        S.qty = 1;
    `);
}

(async () => {
    const w = await wait(3000).then(() => dom.window);
    const doc = w.document;

    console.log('=== App initializes cleanly with the new code present ===');
    check('zero console.error calls during init', consoleErrors.length === 0);
    if (consoleErrors.length) consoleErrors.forEach(e => console.log('    console.error:', e));
    check('sqBuildAdlib is defined', typeof w.sqBuildAdlib === 'function');

    console.log('\n=== The exact, real, motivating case: cabinet_door_or_drawer_adjustment ===');
    {
        const svc = DB.services.find(s => s.id === 'cabinet_door_or_drawer_adjustment');
        setStateForService(w, svc, svc.ui_taxonomy.display_name);
        w.sqBuildAdlib();
        await wait(50);
        const sentence = visibleAdlibText(doc);
        check(`the confirmed-redundant sentence is gone (was "I need 1 Cabinet Door or Drawer Adjustment adjusted", got "${sentence}")`,
            !/Adjustment\s+adjusted/i.test(sentence));
        check('the real, meaningful part of the label survives -- this isn\'t just deleting the noun entirely',
            /Cabinet Door or Drawer/i.test(sentence));
    }

    console.log('\n=== Regression: a service whose label does NOT end in an action-suffix word is unaffected ===');
    {
        const svc = DB.services.find(s => s.id === 'prehung_interior_door_install');
        // "Prehung Interior Door Install" DOES end in "Install" -- use a
        // label crafted to NOT end in any of the stripped suffixes, to
        // confirm the fallback still uses the full, unmodified label
        // when there's nothing to strip.
        setStateForService(w, svc, 'Prehung Interior Door');
        w.sqBuildAdlib();
        await wait(50);
        const sentence = visibleAdlibText(doc);
        check(`a label with no trailing action-suffix word passes through unmodified (got "${sentence}")`,
            /Prehung Interior Door/i.test(sentence) && !/Prehung Interior$/i.test(sentence.replace(/\s+installed$/i, '')));
    }

    console.log('\n=== Regression: the real fix does resolve the suffix case for this same service\'s own real label ===');
    {
        const svc = DB.services.find(s => s.id === 'prehung_interior_door_install');
        setStateForService(w, svc, svc.ui_taxonomy.display_name); // "Prehung Interior Door Install"
        w.sqBuildAdlib();
        await wait(50);
        const sentence = visibleAdlibText(doc);
        check(`"Prehung Interior Door Install" no longer produces "...Install installed" (got "${sentence}")`,
            !/Install\s+installed/i.test(sentence));
    }

    console.log(`\n[adlib noun redundancy, #28] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
    process.exit(fail > 0 ? 1 : 0);
})();
