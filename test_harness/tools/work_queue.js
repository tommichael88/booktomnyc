#!/usr/bin/env node
/**
 * work_queue.js -- the agent's view of GitHub Issues, over the REST API (stdlib only; shells out to `gh api`).
 *
 * WHY THIS EXISTS. GitHub Issues are the one backlog. `gh issue list` is the native query, but it uses GraphQL, which Claude Code sessions cannot reach
 * (HTTP 403); `gh api repos/.../issues` (REST) works everywhere. This is the smallest wrapper over that, plus two views GitHub does not give in one command.
 * It creates nothing, writes no file and keeps no state: every answer is derived from GitHub at the moment it is asked.
 *
 *   node test_harness/tools/work_queue.js                      open Issues grouped by kind (the current-work query a new session starts with)
 *   node test_harness/tools/work_queue.js --kind customer-defect [--json]
 *   node test_harness/tools/work_queue.js history --since 2026-11-01   merged PRs since a date (the on-demand chronology; replaces appending to TIMELINE.md)
 *   node test_harness/tools/work_queue.js check                online Issue-integrity check (needs network; NOT part of the application suite)
 *
 * The pure functions (groupQueue, mergedSince, lintIssue) are exported and held offline by verify_workflow_contract.js, with planted bad cases.
 */
'use strict';
const { execFileSync } = require('child_process');

const KINDS = ['customer-defect', 'architecture', 'qa-verification', 'external-decision', 'process'];
const PLACEHOLDER = /^(none|n\/a|na|tbd|todo|unknown|\?+|-+|\.+)\.?$/i;

function groupQueue(issues) {
  const open = issues.filter(i => !i.pull_request && i.state === 'open');
  const out = {};
  for (const k of [...KINDS, 'unlabelled']) out[k] = [];
  for (const i of open) {
    const names = (i.labels || []).map(l => (typeof l === 'string' ? l : l.name));
    const kind = KINDS.find(k => names.includes(k)) || 'unlabelled';
    out[kind].push({ number: i.number, title: i.title, labels: names, legacy: names.includes('legacy-ledger') });
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => a.number - b.number);
  return out;
}

function mergedSince(pulls, since) {
  const t = Date.parse(since);
  if (Number.isNaN(t)) throw new Error('bad --since date: ' + since);
  return pulls.filter(p => p.merged_at && Date.parse(p.merged_at) >= t)
    .sort((a, b) => Date.parse(a.merged_at) - Date.parse(b.merged_at))
    .map(p => ({ merged_at: p.merged_at, number: p.number, title: p.title, sha: (p.merge_commit_sha || '').slice(0, 7) }));
}

// Problems with one Issue's text. Pure; the online `check` applies it to live Issues, the offline test applies it to planted ones.
function lintIssue(issue) {
  const names = (issue.labels || []).map(l => (typeof l === 'string' ? l : l.name));
  const body = String(issue.body || ''), problems = [];
  const outsideCode = body.replace(/`[^`]*`/g, '').replace(/\]\([^)]*\)/g, '](');
  if (names.includes('external-decision')) {
    const m = /^###[ \t]*Default in force[^\n]*\n?([\s\S]*?)(?=^###[ \t]|(?![\s\S]))/im.exec(body);
    const text = m ? m[1].replace(/\s+/g, ' ').trim() : '';
    if (!m) problems.push('external-decision without a "Default in force" section');
    else if (text.length < 12 || PLACEHOLDER.test(text)) problems.push('"Default in force" is empty or a placeholder');
  }
  if (names.includes('legacy-ledger')) {
    if (!/LEGACY-LEDGER-\d+/.test(body)) problems.push('legacy-ledger Issue without a LEGACY-LEDGER-n provenance reference');
    const bare = [...outsideCode.matchAll(/(?<![\w/&-])#(\d+)\b/g)].map(m => m[1]).filter(n => n !== String(issue.trackerNumber || ''));
    if (bare.length) problems.push('bare #n reference(s) in a migrated Issue (would link to an unrelated GitHub number): ' + [...new Set(bare)].join(', '));
  }
  return problems;
}

// ---- network layer (CLI only) ---------------------------------------------------------------------------------------------------------------------------------
function repo() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  try { const u = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim(); const m = /github\.com[/:]([^/]+\/[^/.]+)/.exec(u); if (m) return m[1]; } catch (e) { /* fall through */ }
  return 'tommichael88/booktomnyc';
}
function gh(path) {
  const all = [];
  for (let page = 1; page <= 20; page++) {
    const sep = path.includes('?') ? '&' : '?';
    const chunk = JSON.parse(execFileSync('gh', ['api', `${path}${sep}per_page=100&page=${page}`], { encoding: 'utf8', maxBuffer: 64 << 20 }));
    all.push(...chunk);
    if (chunk.length < 100) break;
  }
  return all;
}

function main(argv) {
  const [cmd] = argv[0] && !argv[0].startsWith('--') ? [argv[0]] : [''];
  const opt = n => { const i = argv.indexOf('--' + n); return i < 0 ? null : argv[i + 1]; };
  const R = repo();
  if (cmd === 'history') {
    const since = opt('since'); if (!since) { console.error('history needs --since YYYY-MM-DD'); return 2; }
    const rows = mergedSince(gh(`repos/${R}/pulls?state=closed&sort=updated&direction=desc`), since);
    if (argv.includes('--json')) console.log(JSON.stringify(rows, null, 1));
    else rows.forEach(r => console.log(`${r.merged_at.slice(0, 16)}  #${r.number}  ${r.sha}  ${r.title}`));
    return 0;
  }
  const issues = gh(`repos/${R}/issues?state=open`);
  if (cmd === 'check') {
    let bad = 0;
    for (const i of issues.filter(x => !x.pull_request)) for (const p of lintIssue({ ...i, trackerNumber: 31 })) { bad++; console.log(`#${i.number}: ${p}`); }
    console.log(bad ? `${bad} problem(s)` : `ok: ${issues.filter(x => !x.pull_request).length} open Issues pass the integrity check`);
    return bad ? 1 : 0;
  }
  const g = groupQueue(issues), kind = opt('kind');
  if (argv.includes('--json')) { console.log(JSON.stringify(kind ? g[kind] : g, null, 1)); return 0; }
  for (const k of Object.keys(g)) {
    if (kind && k !== kind) continue;
    if (!g[k].length) continue;
    console.log(`\n== ${k} (${g[k].length})`);
    g[k].forEach(i => console.log(`#${i.number}  ${i.title}${i.legacy ? '  [legacy]' : ''}`));
  }
  return 0;
}

module.exports = { groupQueue, mergedSince, lintIssue, KINDS };
if (require.main === module) process.exit(main(process.argv.slice(2)));
