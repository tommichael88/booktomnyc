#!/usr/bin/env node
/**
 * verify_xss_fixes.js
 *
 * Regression test for two confirmed XSS vulnerabilities found via GitHub
 * CodeQL ("DOM text reinterpreted as HTML", alerts #53/#54) and one
 * "Incomplete string escaping or encoding" finding (alert #52), all fixed
 * in v9.4. See CHANGELOG_v9.4.md for the full trace of how each was
 * confirmed exploitable before being fixed (not just CodeQL's say-so —
 * each was traced back to its actual data source: the raw SmartQuote
 * textarea value, via S.desc / S._location / S._sizeHint).
 *
 * This test does two things:
 *   1. Confirms the escapeHtml() utility itself correctly neutralizes a set
 *      of real XSS payloads (tag injection, attribute breakout).
 *   2. Confirms the fixed call sites (ctxBadge; the legacy builderDesc site retired with the builder, T190) actually USE escapeHtml()
 *      — i.e. checks the real source text for the call, not just that the
 *      helper function works in isolation, since a helper existing
 *      unused doesn't fix anything.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.dirname(__dirname);

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

// ── Part 1: escapeHtml() itself neutralizes real payloads ──────────────────
// T190 (#137 S2): the test used to carry its own COPY of escapeHtml, so it could pass while the page's function was broken (DEFECT-STALE-COPY). It now runs the page's own function,
// cut out of the assembled page the browser runs (a `const` arrow: from its declaration to the closing `};` at the same indent).
const qrHtml = require('./_page.js').readPage(path.join(REPO_ROOT, 'qr.html'));
const escapeHtml = (() => {
    const m = qrHtml.match(/^([ \t]*)const escapeHtml = \(str\) => \{[\s\S]*?^\1\};/m);
    if (!m) throw new Error("verify_xss_fixes: could not find the page's escapeHtml");
    return new Function(m[0] + '\nreturn escapeHtml;')();
})();

const PAYLOADS = [
    '<img src=x onerror=alert(1)>',
    '"><script>alert(1)</script>',
    "'-alert(1)-'",
    '<svg onload=alert(1)>',
];

console.log('=== escapeHtml() neutralizes known XSS payload shapes ===');
for (const input of PAYLOADS) {
    const escaped = escapeHtml(input);
    // The actual security property: no literal < or > survives unescaped,
    // since that's what's required for the browser to parse the string as
    // a real HTML element/tag rather than inert text. Checking for
    // substrings like "onerror=" would be the wrong test — that word alone
    // is harmless once it can never form part of an actual parsed tag.
    const hasRawAngleBracket = /[<>]/.test(escaped);
    const hasRawQuote = /["']/.test(escaped);
    check(`"${input}" -> no raw < > " ' survive escaping`, !hasRawAngleBracket && !hasRawQuote);
}

// ── Part 2: the real fixed call sites actually call escapeHtml() ───────────
console.log('\n=== Fixed call sites actually use escapeHtml() (not just helper-exists) ===');
// T190 (#137 S2): builderDesc lived in the legacy curated-intake builder, retired (the curated card is drawn from the orchestrator's route). ctxBadge is the surviving site. The page is read
// whole, so the check does not depend on the generated AppController.js / UIRenderer.js copies.
check('qr.html: ctxBadge calls escapeHtml(text)',
    /pp\.innerHTML\s*=[\s\S]{0,260}escapeHtml\(text\)/.test(qrHtml));
check('qr.html: escapeHtml is declared once, as the shared utility', (qrHtml.match(/^[ \t]*const escapeHtml\s*=\s*\(str\)\s*=>/gm) || []).length === 1);   // a declaration at the start of a line; one mention sits inside a comment
check('escapeHtml escapes all five characters (& < > " \') and maps null/undefined to empty',
    escapeHtml('&<>"\'') === '&amp;&lt;&gt;&quot;&#39;' && escapeHtml(null) === '' && escapeHtml(undefined) === '');
check('escapeHtml encodes & exactly once per pass (no double-encoding inside one call)', escapeHtml('<') === '&lt;' && escapeHtml('&lt;') === '&amp;lt;');

// ── Part 3: no OTHER unescaped interpolation of the known-risky fields ─────
// A coarse regression guard: every line of the page that assigns innerHTML and names one of the three user-typed fields (S.desc, S._location, S._sizeHint -- all NLP-extracted from the raw
// SmartQuote textarea) must also call escapeHtml on that line. It cannot catch every possible new instance; it catches the pattern already found once.
console.log('\n=== No raw (un-escaped) interpolation of the user-typed fields into innerHTML ===');
const risky = qrHtml.split('\n').filter(l => /innerHTML\s*(\+?=)/.test(l) && /\bS\.(desc|_location|_sizeHint)\b/.test(l));
check(`every innerHTML assignment that names S.desc / S._location / S._sizeHint escapes it (${risky.length} such line(s))`, risky.every(l => /escapeHtml\(/.test(l)));
check('qr.html: ctxBadge no longer concatenates raw `text` without escapeHtml',
    !/pp\.innerHTML\s*=\s*\([^)]*\)\s*\+\s*text;/.test(qrHtml));

console.log(`\n[XSS fix verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
