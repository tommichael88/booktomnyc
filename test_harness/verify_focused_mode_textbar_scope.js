#!/usr/bin/env node
/**
 * verify_focused_mode_textbar_scope.js
 *
 * Verifies the T125 fix to enterFocusedMode: sqTextBar (the SmartQuote
 * free-text bar) should be hidden specifically when a user visually
 * taps a category tile, and should return (remain/become visible)
 * for every other entry path into focused mode -- "Other tile" entry,
 * a resolved/matched service, the free-text affirmation flow, and the
 * guided builder.
 *
 * History, for context: a prior "v9.6 FIX" removed sqTextBar from an
 * earlier, unconditional force-hide entirely, citing the Charter's own
 * three-parallel-entry-paths principle (hiding it while browsing was
 * "silently taking free-text off the table"). That fix corrected an
 * over-hide, but overshot in the other direction -- sqTextBar then
 * never hid at all, including for the one real case (a category tile
 * tap) it makes visual sense to hide it. This fix adds an explicit,
 * narrow parameter rather than reverting the v9.6 correction.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require(path.join(__dirname, 'node_modules', 'jsdom'));

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(desc, cond) {
    if (cond) { pass++; console.log(`  \u2713 ${desc}`); }
    else { fail++; console.log(`  \u2717 ${desc}`); }
}

console.log('=== Source: only the genuine category-tile-tap call site passes hideTextBar=true ===');
{
    check('enterFocusedMode itself defaults hideTextBar to false (safe: visible unless explicitly told to hide)',
        /function enterFocusedMode\(hideTextBar = false\)/.test(QR_HTML));
    check('showGroupsForCategory (the real category-tile handler) explicitly passes true',
        /enterFocusedMode\(true\)/.test(QR_HTML));
    const bareCalls = (QR_HTML.match(/[^(]enterFocusedMode\(\)/g) || []).length;
    check(`every other real call site still calls enterFocusedMode() bare, defaulting to false (found ${bareCalls} bare calls)`,
        bareCalls >= 5);
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
function isHidden(el) { return !el || el.style.display === 'none'; }

(async () => {
    const w = await wait(3000).then(() => dom.window);
    const doc = w.document;

    console.log('\n=== App initializes cleanly ===');
    check('zero console.error calls during init', consoleErrors.length === 0);

    console.log('\n=== Real, end-to-end: tapping a category tile hides sqTextBar ===');
    const categoryCard = doc.querySelector('.category-card[data-category-id]');
    categoryCard.dispatchEvent(new w.Event('click', { bubbles: true }));
    await wait(100);
    check('sqTextBar is hidden immediately after a real category tile tap', isHidden(doc.getElementById('sqTextBar')));

    console.log('\n=== Real, end-to-end: navigating one level deeper returns sqTextBar to visible ===');
    const groupTile = doc.querySelector('.group-tile');
    check('a group tile is present to continue navigation', !!groupTile);
    if (groupTile) {
        groupTile.dispatchEvent(new w.Event('click', { bubbles: true }));
        await wait(100);
        check('sqTextBar is visible again after navigating past the category level', !isHidden(doc.getElementById('sqTextBar')));
    }

    console.log('\n=== Direct check of the core guarantee: a bare enterFocusedMode() call (what every non-category-tile path uses) always restores visibility ===');
    {
        w.eval(`document.getElementById('sqTextBar').style.display = 'none';`); // simulate having just come from a category tap
        w.eval(`enterFocusedMode();`); // bare call, exactly the form prefillSmartQuoteFromOtherTile / showIntakeQuestions / prefillSmartQuoteFromService / renderTagAffirmationFromRoute / sqPrepareFlow all use
        check('a bare enterFocusedMode() call (the form every "Other tile", matched-service, affirmation, and guided-builder path uses) restores sqTextBar to visible',
            !isHidden(doc.getElementById('sqTextBar')));
    }

    console.log(`\n[focused mode text bar scope, T125] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
    process.exit(fail > 0 ? 1 : 0);
})();
