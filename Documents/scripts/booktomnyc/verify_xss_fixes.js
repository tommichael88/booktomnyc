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
 *   2. Confirms the two fixed call sites (sqBuildCuratedIntake's
 *      builderDesc note, sqBuildAdlib's ctxBadge) actually USE escapeHtml()
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
function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

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

const qrHtml = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
const appController = fs.readFileSync(path.join(REPO_ROOT, 'AppController.js'), 'utf8');
const uiRenderer = fs.readFileSync(path.join(REPO_ROOT, 'UIRenderer.js'), 'utf8');

check('qr.html: builderDesc (sqBuildCuratedIntake) calls escapeHtml(S.desc)',
    /builderDesc\s*=.*escapeHtml\(S\.desc\)/.test(qrHtml));
check('qr.html: ctxBadge calls escapeHtml(text)',
    /pp\.innerHTML\s*=.*escapeHtml\(text\)/.test(qrHtml));
check('qr.html: buildPreview\'s esc() escapes the full 5-character set (&<>"\')',
    /const esc\s*=\s*s\s*=>\s*s\.replace\(\/\[&<>"'\]\/g/.test(qrHtml));

console.log('\n=== v9.5: renderIcon() XSS fix (introduced by the tabler-icon support change) ===');
check('qr.html: renderIcon escapes the tabler-icon class-attribute branch',
    /return\s*`<i class="\$\{escapeHtml\(icon\)\}"><\/i>`/.test(qrHtml));
check('qr.html: renderIcon escapes the emoji/fallback branch too (every call site uses html: mode, not textContent)',
    /return escapeHtml\(icon\);\s*\n\}/.test(qrHtml));
{
    function escapeHtmlLocal(str) {
        if (str == null) return '';
        return String(str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }
    function renderIconLocal(icon) {
        if (!icon) return '';
        if (typeof icon === 'string' && icon.startsWith('ti ')) {
            return `<i class="${escapeHtmlLocal(icon)}"></i>`;
        }
        return escapeHtmlLocal(icon);
    }
    check('renderIcon: legitimate tabler icon renders correctly', renderIconLocal('ti ti-tool') === '<i class="ti ti-tool"></i>');
    check('renderIcon: legitimate emoji passes through unchanged', renderIconLocal('🔧') === '🔧');
    check('renderIcon: malicious non-"ti " input is fully escaped, no raw < or >',
        !/[<>]/.test(renderIconLocal('<img src=x onerror=alert(1)>')));
    check('renderIcon: attribute-breakout attempt cannot escape the class attribute',
        !renderIconLocal('ti " onmouseover="alert(1)').includes('" onmouseover="alert(1)"'));
}

check('AppController.js: builderDesc calls escapeHtml(S.desc)',
    /builderDesc\s*=.*escapeHtml\(S\.desc\)/.test(appController));
check('AppController.js: ctxBadge calls escapeHtml(text)',
    /pp\.innerHTML\s*=.*escapeHtml\(text\)/.test(appController));

check('UIRenderer.js: declares the shared escapeHtml() utility',
    /const escapeHtml\s*=\s*\(str\)\s*=>/.test(uiRenderer));
check('UIRenderer.js: escapeHtml() escapes the full 5-character set (&<>"\')',
    /replace\(\/\[&<>"'\]\/g/.test(uiRenderer));

// ── Part 3: no OTHER unescaped interpolation of the known-risky fields ─────
// (a coarse regression guard — if a future edit reintroduces e.g.
// `+ S.desc +` or `${S._location}` directly inside an innerHTML-bound
// template literal without escapeHtml(), this won't catch every possible
// new instance, but it catches the exact two patterns already found once.)
console.log('\n=== No raw (un-escaped) interpolation reintroduced at the fixed sites ===');
check('qr.html: builderDesc ternary no longer assigns raw S.desc',
    !/builderDesc\s*=\s*\([^)]*\)\s*\?\s*S\.desc\s*:/.test(qrHtml));
check('qr.html: ctxBadge no longer concatenates raw `text` without escapeHtml',
    !/pp\.innerHTML\s*=\s*\([^)]*\)\s*\+\s*text;/.test(qrHtml));

console.log(`\n[XSS fix verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
