/**
 * _ledger_ref.js -- the one rule for "this known instance is filed with an entry that names it" (R-INVARIANT-DUPLICATION-TICKET,
 * R-INVARIANT-SINGLEDEF: ratchets used to each hold their own copy of "the ledger has a heading `### #n`").
 *
 * Since the workflow consolidation the ledger PENDING_DECISIONS.md is FROZEN history; a new filing is a GitHub Issue. A ratchet's filed reference is
 * therefore one of:
 *     #n | LEGACY-LEDGER-n   an entry of the frozen ledger: its heading `### #n ` must exist there (a renumbered or deleted entry is a dangling reference);
 *     issue:n                a GitHub Issue of the repository: well-formed here (an offline test cannot ask GitHub); `work_queue.js check` is the online counterpart.
 * A bare number written `#n` always means the LEGACY ledger, never an Issue: both numberings overlap, which is why Issues are written `issue:n`.
 *
 * Pure: parseRef(ref) and filingProblem(ref, ledgerText) take strings and return values; nothing reads the file system here.
 */
'use strict';

function parseRef(ref) {
    const s = String(ref == null ? '' : ref).trim();
    let m;
    if ((m = /^#(\d+)$/.exec(s)) || (m = /^LEGACY-LEDGER-(\d+)$/.exec(s))) return { kind: 'ledger', n: Number(m[1]) };
    if ((m = /^issue:(\d+)$/.exec(s))) return Number(m[1]) > 0 ? { kind: 'issue', n: Number(m[1]) } : null;
    if (/^\d+$/.test(s)) return { kind: 'ledger', n: Number(s) };     // a bare number in a table that predates the prefix: a ledger entry
    return null;
}

/** @returns {string|null} null when the filing is sound, else why not. */
function filingProblem(ref, ledgerText) {
    const p = parseRef(ref);
    if (!p) return `"${ref}" is not a filing reference (#n / LEGACY-LEDGER-n for the frozen ledger, issue:n for an Issue)`;
    if (p.kind === 'issue') return null;
    return new RegExp('^### #' + p.n + ' ', 'm').test(ledgerText) ? null : `the frozen ledger has no entry "### #${p.n}" (a dangling reference; file a new one as issue:n)`;
}

module.exports = { parseRef, filingProblem };
