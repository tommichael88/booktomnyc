#!/usr/bin/env node
/**
 * verify_qr_build_version_freshness.js
 *
 * Regression test for a real, confirmed "quiet wrongness" finding (T109,
 * flagged directly by the operator): QR_BUILD_VERSION is a hand-maintained
 * marker (qr.html, "meant to be updated by hand alongside every real
 * change" per its own comment) that was set to 'T103' and then left
 * untouched through five subsequent, real qr.html edits (T104, T105, T106,
 * T107, T108) -- confirmed directly against every TIMELINE.md entry's own
 * "Files modified" line, not assumed.
 *
 * This can't be made fully self-updating without a real build step (the
 * comment beside QR_BUILD_VERSION's own declaration already explains the
 * genuine chicken-and-egg problem with a single, self-contained HTML file
 * hashing itself) -- so instead of leaving the drift silent, this test
 * makes it loud: it fails the very next time qr.html is edited (a new
 * TIMELINE.md entry lists qr.html under "Files modified") without
 * QR_BUILD_VERSION being bumped to match in the same pass.
 *
 * Bumped to 'T109' as part of this same fix -- T109's own edit (this
 * bump itself) is what makes T109, not T108, the real latest-touching
 * entry; see qr.html's own comment at the declaration site for why that
 * isn't a chase-your-tail problem.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
const TIMELINE = fs.readFileSync(path.join(REPO_ROOT, 'TIMELINE.md'), 'utf8');

let pass = 0, fail = 0;
function check(label, cond) {
    if (cond) { pass++; console.log('  \u2713 ' + label); }
    else { fail++; console.log('  \u2717 ' + label); }
}

console.log('=== QR_BUILD_VERSION matches the most recent qr.html-touching TIMELINE.md entry ===');
{
    const declMatch = QR_HTML.match(/const\s+QR_BUILD_VERSION\s*=\s*'(T\d+)'/);
    check('QR_BUILD_VERSION is declared and parseable', !!declMatch);
    const declaredT = declMatch ? parseInt(declMatch[1].slice(1), 10) : null;

    // Split TIMELINE.md into one chunk per "## Txxx" entry, and find every
    // entry whose own "Files modified" line names qr.html -- deliberately
    // scoped to the Files-modified line specifically (not any mention of
    // "qr.html" anywhere in the entry's narrative prose), since plenty of
    // entries discuss qr.html's behavior without actually editing it this
    // pass (this is exactly why a plain "latest T-number overall" check
    // would be wrong: Session 2 of the current operator-brief arc, for
    // example, is data-only against btnyc.json and correctly should NOT
    // force a QR_BUILD_VERSION bump).
    const chunks = TIMELINE.split(/(?=^## T\d+)/m);
    let maxQrTouchingT = 0;
    let matchedEntries = 0;
    for (const chunk of chunks) {
        const headerMatch = chunk.match(/^## T(\d+)/);
        if (!headerMatch) continue;
        if (/Files modified[^\n]{0,20}qr\.html/i.test(chunk)) {
            matchedEntries++;
            const tnum = parseInt(headerMatch[1], 10);
            if (tnum > maxQrTouchingT) maxQrTouchingT = tnum;
        }
    }
    check('at least a few real qr.html-touching TIMELINE.md entries were found (parser sanity check)', matchedEntries >= 5);
    check(
        `QR_BUILD_VERSION ('${declMatch ? declMatch[1] : '?'}') matches the latest qr.html-touching entry (T${maxQrTouchingT})` +
        (declaredT !== maxQrTouchingT ? ` -- STALE by ${maxQrTouchingT - declaredT} real edit(s). Bump QR_BUILD_VERSION in qr.html to 'T${maxQrTouchingT}' as part of THIS session's own fix, before ending the session.` : ''),
        declaredT === maxQrTouchingT
    );
}

console.log(`\n[QR_BUILD_VERSION freshness verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
