#!/usr/bin/env node
/**
 * verify_workflow_contract.js -- the deterministic, offline contract of the Issues-based engineering workflow.
 *
 * @enforces R-DOC-SINGLEPURPOSE
 * @enforces R-DOC-NOSTALE
 * @enforces R-TEST-CANFAIL
 *
 * WHAT IT HOLDS (stdlib only; no network, no GitHub; runs in CI, a fresh clone, or a bare sandbox)
 *   1. MIGRATION COMPLETENESS. The legacy ledger (PENDING_DECISIONS.md, frozen history) is accounted for by test_harness/fixtures/legacy_ledger_accounting.json:
 *      every unique numbered heading has exactly one row with a known disposition; open dispositions carry an Issue number; closed ones do not.
 *   2. FROZEN HISTORY. The ledger's bytes equal the hash recorded at cutover, so nothing is routinely appended to it again.
 *   3. ISSUE INTEGRITY RULES (the same pure function the online `work_queue.js check` applies to live Issues): a decision without a real default, a migrated
 *      Issue without provenance, a bare "#n" that would link to an unrelated GitHub number.
 *   4. THE FORMS: the decision form requires its default; the PR template carries the Fixes/Refs rule.
 *   5. THE VIEWS: the queue groups open Issues by kind without PRs or closed ones; the history lists merged PRs from a date, in order.
 *
 * NON-VACUITY (R-TEST-CANFAIL). Every rule is also run on a planted bad case that must be reported: an unmapped ID, a doubly-assigned ID, an open ID with no
 * Issue, a closed ID that still points at one, an unknown disposition, an edited ledger, a decision with an empty / placeholder / absent default, a legacy
 * Issue with a bare number, a form without the required default.
 *
 * NOT COVERED (named): that a given Issue exists or is open (online check), and that a disposition is *right* (independent QA sampling; the fixture records
 * the evidence strength of each). Exit 0 = contract holds.
 */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { groupQueue, mergedSince, lintIssue } = require('./tools/work_queue.js');
const ROOT = process.env.BTNYC_ROOT ? path.resolve(process.env.BTNYC_ROOT) : path.resolve(__dirname, '..');
let passed = 0, failed = 0;
const check = (label, ok, detail) => { if (ok) { passed++; console.log('  ✓ ' + label); } else { failed++; console.log('  ✗ ' + label + (detail ? ' -- ' + detail : '')); } };
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const OPEN = new Set(['ACTIONABLE', 'EXTERNAL', 'ASSOCIATED']);
const CLOSED = new Set(['RESOLVED', 'SUPERSEDED_OR_HISTORICAL', 'DURABLE_SPEC']);

// ---- pure checks ---------------------------------------------------------------------------------------------------------------------------------------------
const ledgerIds = text => [...new Set([...text.matchAll(/^###\s+#(\d+)\b/gm)].map(m => Number(m[1])))].sort((a, b) => a - b);
function accountingProblems(ids, rows) {
  const p = [], seen = new Map();
  for (const r of rows) seen.set(r.id, (seen.get(r.id) || 0) + 1);
  for (const id of ids) if (!seen.has(id)) p.push(`unmapped: LEGACY-LEDGER-${id} has no disposition`);
  for (const [id, n] of seen) { if (n > 1) p.push(`doubly assigned: LEGACY-LEDGER-${id} has ${n} rows`); if (!ids.includes(id)) p.push(`phantom: LEGACY-LEDGER-${id} is not a ledger heading`); }
  for (const r of rows) {
    if (!OPEN.has(r.disposition) && !CLOSED.has(r.disposition)) p.push(`unknown disposition "${r.disposition}" for LEGACY-LEDGER-${r.id}`);
    else if (OPEN.has(r.disposition) && !Number.isInteger(r.issue)) p.push(`falsely inactive: open LEGACY-LEDGER-${r.id} (${r.disposition}) has no Issue`);
    else if (CLOSED.has(r.disposition) && r.issue != null) p.push(`falsely active: closed LEGACY-LEDGER-${r.id} (${r.disposition}) points at Issue ${r.issue}`);
  }
  return p;
}
const sha = buf => crypto.createHash('sha256').update(buf).digest('hex');

// ---- 1. migration completeness --------------------------------------------------------------------------------------------------------------------------------
console.log('verify_workflow_contract.js');
console.log('\n1. Every legacy ledger ID has exactly one disposition');
const fixture = JSON.parse(read('test_harness/fixtures/legacy_ledger_accounting.json'));
const ledgerBuf = fs.readFileSync(path.join(ROOT, 'PENDING_DECISIONS.md'));
const ids = ledgerIds(ledgerBuf.toString('utf8'));
check(`the ledger parses to ${ids.length} unique numbered entries (floor 200: the file is being read)`, ids.length >= 200);
const real = accountingProblems(ids, fixture.rows);
check(`all ${fixture.rows.length} rows account for all ${ids.length} IDs, none unmapped, doubled, phantom, falsely active or falsely inactive`, real.length === 0, real.slice(0, 5).join(' | '));
{
  const dropped = fixture.rows.filter(r => r.id !== ids[10]);
  check('planted: a dropped row is reported as unmapped', accountingProblems(ids, dropped).some(s => s.startsWith('unmapped')));
  check('planted: a duplicated row is reported as doubly assigned', accountingProblems(ids, [...fixture.rows, fixture.rows[3]]).some(s => s.startsWith('doubly')));
  const openRow = fixture.rows.findIndex(r => OPEN.has(r.disposition)), closedRow = fixture.rows.findIndex(r => CLOSED.has(r.disposition));
  const noIssue = fixture.rows.map((r, i) => i === openRow ? { ...r, issue: null } : r);
  check('planted: an open entry with no Issue is reported as falsely inactive', accountingProblems(ids, noIssue).some(s => s.startsWith('falsely inactive')));
  const reopened = fixture.rows.map((r, i) => i === closedRow ? { ...r, issue: 99 } : r);
  check('planted: a closed entry that points at an Issue is reported as falsely active', accountingProblems(ids, reopened).some(s => s.startsWith('falsely active')));
  const odd = fixture.rows.map((r, i) => i === 0 ? { ...r, disposition: 'MAYBE' } : r);
  check('planted: an unknown disposition is reported', accountingProblems(ids, odd).some(s => s.startsWith('unknown')));
  check('planted: a phantom ID is reported', accountingProblems(ids, [...fixture.rows, { id: 99999, disposition: 'RESOLVED', issue: null }]).some(s => s.startsWith('phantom')));
}

// ---- 2. frozen history ----------------------------------------------------------------------------------------------------------------------------------------
console.log('\n2. The legacy ledger is frozen history');
check('PENDING_DECISIONS.md equals the bytes recorded at cutover (no routine appends; an amendment is a deliberate fixture change)', sha(ledgerBuf) === fixture.frozen_ledger_sha256);
check('planted: one appended line changes the hash', sha(Buffer.concat([ledgerBuf, Buffer.from('\n### #999 — a new entry\n')])) !== fixture.frozen_ledger_sha256);

// ---- 3. Issue integrity rules ---------------------------------------------------------------------------------------------------------------------------------
console.log('\n3. Issue integrity rules');
const dec = (def) => ({ number: 7, labels: ['external-decision'], body: `### What is needed\nX\n\n### Default in force\n${def}\n\n### Done when\nY` });
check('a decision with a real default passes', lintIssue(dec('Unchanged: one flat price stays, on the record as known-wrong.')).length === 0);
check('planted: a decision with no default section is reported', lintIssue({ number: 7, labels: ['external-decision'], body: '### Done when\nY' }).length === 1);
check('planted: an empty default is reported', lintIssue(dec('')).length === 1);
check('planted: a placeholder default ("TBD", "n/a", "none") is reported', ['TBD', 'n/a', 'none.'].every(d => lintIssue(dec(d)).length === 1));
const mig = body => ({ number: 40, labels: ['legacy-ledger'], body, trackerNumber: 31 });
check('a migrated Issue with provenance and only code-spanned/tracker numbers passes', lintIssue(mig('**Legacy:** LEGACY-LEDGER-83 · [src](https://x/y#L1-L2) · tracker #31\nSee `#83` in the ledger.')).length === 0);
check('planted: a migrated Issue with no LEGACY-LEDGER reference is reported', lintIssue(mig('just text')).length === 1);
check('planted: a bare ledger number in a migrated Issue is reported (it would link to an unrelated GitHub number)', lintIssue(mig('LEGACY-LEDGER-83 and also #66 here')).some(s => /bare/.test(s)));

// ---- 4. the forms ---------------------------------------------------------------------------------------------------------------------------------------------
console.log('\n4. The forms carry the contract');
const decisionForm = read('.github/ISSUE_TEMPLATE/decision-needed.yml');
const blockOf = (t, id) => t.split(/^  - type:/m).find(b => new RegExp('\\bid:\\s*' + id + '\\b').test(b)) || '';
const requiresDefault = t => /required:\s*true/.test(blockOf(t, 'default')) && /labels:\s*\[external-decision\]/.test(t);
check('the decision form requires a "Default in force" field and applies the external-decision label', requiresDefault(decisionForm));
check('planted: a form whose default is optional is reported', !requiresDefault(decisionForm.replace(blockOf(decisionForm, 'default'), blockOf(decisionForm, 'default').replace('required: true', 'required: false'))));
const pr = read('.github/pull_request_template.md');
check('the PR template states the Fixes/Refs rule', /Fixes #n/.test(pr) && /Refs #n/.test(pr));
check('the work-item form asks for observed state, outcome and done-when', ['observed', 'outcome', 'done'].every(k => new RegExp('id:\\s*' + k).test(read('.github/ISSUE_TEMPLATE/work-item.yml'))));

// ---- 5. the views ---------------------------------------------------------------------------------------------------------------------------------------------
console.log('\n5. The on-demand views');
const issues = [
  { number: 5, state: 'open', title: 'b', labels: [{ name: 'architecture' }] }, { number: 3, state: 'open', title: 'a', labels: [{ name: 'architecture' }, { name: 'legacy-ledger' }] },
  { number: 4, state: 'open', title: 'pr', labels: [], pull_request: {} }, { number: 6, state: 'closed', title: 'done', labels: [{ name: 'architecture' }] }, { number: 8, state: 'open', title: 'u', labels: [] }];
const g = groupQueue(issues);
check('the queue lists open Issues by kind in number order, marks legacy ones', g.architecture.map(i => i.number).join() === '3,5' && g.architecture[0].legacy === true);
check('... leaves out pull requests and closed Issues, and shows unlabelled ones', !JSON.stringify(g).includes('"pr"') && !JSON.stringify(g).includes('"done"') && g.unlabelled.length === 1);
const pulls = [{ number: 1, title: 'old', merged_at: '2026-10-01T00:00:00Z', merge_commit_sha: 'aaaaaaaa1' }, { number: 3, title: 'b', merged_at: '2026-11-20T00:00:00Z', merge_commit_sha: 'cccccccc3' }, { number: 2, title: 'a', merged_at: '2026-11-10T00:00:00Z', merge_commit_sha: 'bbbbbbbb2' }, { number: 4, title: 'closed unmerged', merged_at: null }];
const h = mergedSince(pulls, '2026-11-01');
check('the history lists merged PRs from the date, oldest first, never unmerged or earlier ones', h.map(p => p.number).join() === '2,3' && h[0].sha === 'bbbbbbb');
check('planted: a bad date is an error, not an empty history', (() => { try { mergedSince(pulls, 'soon'); return false; } catch (e) { return true; } })());

// ---- 6. filing references (the ratchets' "ticketed" rule) ---------------------------------------------------------------------------------------------------------
console.log('\n6. A ratchet\'s filing reference is a frozen-ledger entry or an Issue');
const { parseRef, filingProblem } = require('./_ledger_ref.js');
const LEDGER_SAMPLE = '### #155 duplicate constants\ntext\n### #144 defaults\n';
check('#n, LEGACY-LEDGER-n and a bare number name the frozen ledger; issue:n names an Issue', parseRef('#155').kind === 'ledger' && parseRef('LEGACY-LEDGER-155').n === 155 && parseRef(144).kind === 'ledger' && parseRef('issue:42').kind === 'issue');
check('a legacy entry that exists is sound, one that does not is a dangling reference', filingProblem('#155', LEDGER_SAMPLE) === null && /no entry "### #999"/.test(filingProblem('LEGACY-LEDGER-999', LEDGER_SAMPLE)));
check('an Issue reference needs no ledger heading (a new filing never touches the frozen file)', filingProblem('issue:42', LEDGER_SAMPLE) === null);
check('planted: "#42" is read as the LEGACY ledger, never as Issue 42 (the numberings overlap)', parseRef('#42').kind === 'ledger' && filingProblem('#42', LEDGER_SAMPLE) !== null);
check('planted: free text, an empty reference and issue:0 are not filings', ['soon', '', 'issue:0', 'issue:', 'TODO'].every(r => parseRef(r) === null && filingProblem(r, LEDGER_SAMPLE) !== null));

console.log('\n[Issues-based workflow contract] ' + passed + ' passed, ' + failed + ' failed (of ' + (passed + failed) + ' checks)');
process.exit(failed ? 1 : 0);
