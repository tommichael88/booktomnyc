#!/usr/bin/env node
/**
 * verify_qr_build_version_freshness.js
 *
 * @enforces R-DOC-NOSTALE, R-TEST-CANFAIL
 *
 * THE DEFECT IT HOLDS (T109, flagged by the operator): QR_BUILD_VERSION is a hand-maintained marker (declared in modules/nlp_engine.js, shown in the page's
 * diagnostics) that was left at 'T103' through five real qr.html edits. A marker that says "this build" while the page has changed since is quiet wrongness.
 * It cannot be self-updating without a build step (a self-contained HTML file cannot hash itself), so the drift is made loud instead.
 *
 * HOW IT IS HELD NOW (workflow consolidation, Stage E). The check used to read TIMELINE.md: it failed when the newest TIMELINE entry listing qr.html under
 * "Files modified" was newer than the marker, so every qr.html edit needed a new ledger entry to even exist. TIMELINE.md is frozen history, so the
 * condition is read from the change itself: if the change under test (base..HEAD) modifies qr.html, the marker declared at HEAD must differ from the one at
 * base. Same defect, same scope (qr.html), same remedy (bump the marker in the change); no ledger entry is consulted or required.
 *
 * BASE. BTNYC_BASE (any ref or SHA) if set; otherwise the merge-base of HEAD with origin/main when that is not HEAD itself; otherwise HEAD's first parent
 * (a push to main, or the merge commit a pull-request run checks out). When no base can be found (a shallow local clone with no origin/main) the diff
 * cannot be measured: that is reported as NOT VERIFIED, and under CI (GITHUB_ACTIONS set) it is a failure, because the workflow checks out full history.
 *
 * The decision is a pure function (needsBump), exercised below on planted cases, each of which must be reported or accepted as stated (R-TEST-CANFAIL).
 */
'use strict';
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.dirname(__dirname);
const MARKER_FILES = ['qr.html', 'modules'];            // where the declaration may live
const WATCHED = ['qr.html'];                             // the edit that obliges a bump (the scope the old TIMELINE rule used)
const MARKER_RE = /const\s+QR_BUILD_VERSION\s*=\s*'([^']+)'/;
const MARKER_FORMAT = /^(T\d+|PR\d+|[0-9a-f]{7,40})$/;   // a ticket, a pull request, or a commit

let pass = 0, fail = 0, unverified = 0;
function check(label, cond, detail) {
    if (cond) { pass++; console.log('  ✓ ' + label); }
    else { fail++; console.log('  ✗ ' + label + (detail ? ' -- ' + detail : '')); }
}

/** @returns {string[]} the problems (empty = fine). */
function needsBump({ changedFiles, baseMarker, headMarker }) {
    const probs = [];
    if (headMarker == null) { probs.push('QR_BUILD_VERSION is not declared at HEAD (or not in the form const QR_BUILD_VERSION = \'...\')'); return probs; }
    if (!MARKER_FORMAT.test(headMarker)) probs.push(`marker '${headMarker}' is not a ticket (T123), pull request (PR123) or commit id`);
    const touched = changedFiles.filter(f => WATCHED.includes(f));
    if (touched.length && baseMarker != null && headMarker === baseMarker) {
        probs.push(`${touched.join(', ')} changed and QR_BUILD_VERSION is still '${headMarker}': bump it (modules/nlp_engine.js) in this change`);
    }
    return probs;
}

console.log('=== QR_BUILD_VERSION is bumped by any change that edits qr.html (read from the diff, not from a ledger) ===');

console.log('\n0. NON-VACUITY: the decision is run on planted cases');
const planted = [
    ['qr.html edited, marker unchanged -> reported', { changedFiles: ['qr.html'], baseMarker: 'T198', headMarker: 'T198' }, /still 'T198'/],
    ['qr.html edited with other files, marker unchanged -> reported', { changedFiles: ['README.md', 'qr.html'], baseMarker: 'PR98', headMarker: 'PR98' }, /still 'PR98'/],
    ['marker not declared at HEAD -> reported', { changedFiles: ['qr.html'], baseMarker: 'T198', headMarker: null }, /not declared/],
    ['marker in an unrecognised form -> reported', { changedFiles: [], baseMarker: 'T198', headMarker: 'latest' }, /not a ticket/],
];
for (const [label, input, re] of planted) { const p = needsBump(input); check('planted: ' + label, p.length > 0 && re.test(p.join(' ')), JSON.stringify(p)); }
const fine = [
    ['qr.html edited and marker bumped -> accepted', { changedFiles: ['qr.html'], baseMarker: 'T198', headMarker: 'PR99' }],
    ['qr.html edited and marker bumped to a commit id -> accepted', { changedFiles: ['qr.html'], baseMarker: 'T198', headMarker: '1a2b3c4d' }],
    ['only a test edited, marker unchanged -> accepted (no bump owed)', { changedFiles: ['test_harness/verify_x.js'], baseMarker: 'T198', headMarker: 'T198' }],
    ['btnyc.json edited, marker unchanged -> accepted (data-only change owes no bump)', { changedFiles: ['btnyc.json'], baseMarker: 'T198', headMarker: 'T198' }],
];
for (const [label, input] of fine) { const p = needsBump(input); check('planted: ' + label, p.length === 0, JSON.stringify(p)); }

console.log('\n1. THE CHANGE UNDER TEST');
function git(args) { return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
function tryGit(args) { try { return git(args); } catch (e) { return null; } }

function resolveBase() {
    const head = tryGit(['rev-parse', 'HEAD']);
    if (!head) return { error: 'not a git checkout' };
    if (process.env.BTNYC_BASE) { const b = tryGit(['rev-parse', '--verify', process.env.BTNYC_BASE + '^{commit}']); return b ? { head, base: b, how: 'BTNYC_BASE' } : { error: `BTNYC_BASE=${process.env.BTNYC_BASE} is not a commit here` }; }
    const mb = tryGit(['merge-base', 'HEAD', 'origin/main']);
    if (mb && mb !== head) return { head, base: mb, how: 'merge-base with origin/main' };
    const parent = tryGit(['rev-parse', '--verify', 'HEAD^1^{commit}']);
    if (parent) return { head, base: parent, how: 'first parent of HEAD' };
    return { error: 'no base commit available (shallow clone with no origin/main?)' };
}
function markerAt(rev) {
    const out = tryGit(['grep', '-h', '-e', 'const QR_BUILD_VERSION', rev, '--', ...MARKER_FILES]);
    const m = out && out.match(MARKER_RE);
    return m ? m[1] : null;
}

const r = resolveBase();
if (r.error) {
    if (process.env.GITHUB_ACTIONS) check('a base commit for the diff exists (CI checks out full history)', false, r.error);
    else { unverified++; console.log('  - NOT VERIFIED: ' + r.error + '. Set BTNYC_BASE=<ref> to measure a change; CI always can.'); }
} else {
    const changed = git(['diff', '--name-only', r.base, r.head]).split('\n').filter(Boolean);
    const headMarker = markerAt(r.head), baseMarker = markerAt(r.base);
    console.log(`  base ${r.base.slice(0, 8)} (${r.how}), head ${r.head.slice(0, 8)}; ${changed.length} file(s) changed; marker '${baseMarker}' -> '${headMarker}'`);
    const probs = needsBump({ changedFiles: changed, baseMarker, headMarker });
    check('QR_BUILD_VERSION is declared, well-formed, and bumped if this change edits qr.html', probs.length === 0, probs.join('; '));
}

console.log(`\n[QR_BUILD_VERSION freshness verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)${unverified ? `, ${unverified} NOT VERIFIED (no base commit)` : ''}\n`);
process.exit(fail > 0 ? 1 : 0);
