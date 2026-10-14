#!/usr/bin/env node
'use strict';
/**
 * transition_status.js -- the detector of the btnyc.json -> ssot/btnyc_source.json dual-source transition (T175; R-SYSTEM-DUALSOURCE).
 *
 *   node test_harness/tools/entity_first/transition_status.js [--json]
 *
 * Reads the transition ledger (ssot/TRANSITION_DUALSOURCE.md) and the consumers it lists, and answers the one question the rule asks of a detector: is the transition COMPLETE?
 *   exit 0  COMPLETE      every listed consumer reads the target (the derived graph) and none reads btnyc.json, and btnyc.json is no longer live at the repository root
 *   exit 1  NOT COMPLETE  the transition is open and inside its end date (the files that still read the retired source are listed with their reference counts)
 *   exit 3  OVERDUE       not complete, and the end date (or the latest reauthorized end date) has passed: close it, reauthorize it in the ledger with a reason and a new date, or roll it back
 *   exit 2  MALFORMED     the ledger lacks one of the six fields the rule requires, or a date that cannot be read
 * A reference is any mention of `btnyc.json` (code or comment): a consumer that still names the retired source has not been cut over. The detector does not judge whether a mention is live; closing the transition
 * means the mentions go too.
 */
const fs = require('fs'), path = require('path');
const lib = require('./lib.js');

const FIELDS = ['Start', 'Owner', 'Completion condition', 'Detector', 'Expected cost', 'Target end date'];
const TARGET = /btnyc_graph(?:\.json)?/, RETIRED = /btnyc\.json/g;

function parseLedger(text) {
  const fields = {}; for (const f of FIELDS) { const m = new RegExp('^- \\*\\*' + f + ':\\*\\*\\s*(.+)$', 'm').exec(text); if (m) fields[f] = m[1].trim(); }
  const missing = FIELDS.filter(f => !fields[f]); const date = s => { const m = /(\d{4}-\d{2}-\d{2})/.exec(s || ''); return m ? m[1] : null; };
  const reauth = [...text.matchAll(/^- \*\*Reauthorized (\d{4}-\d{2}-\d{2}):\*\*\s*(.+?);\s*new end date (\d{4}-\d{2}-\d{2})\s*$/gm)].map(m => ({ on: m[1], reason: m[2].trim(), end: m[3] }));
  const cons = /^\*\*Consumers:\*\*\s*(.+)$/m.exec(text); const consumers = cons ? [...cons[1].matchAll(/`([^`]+)`/g)].map(m => m[1]) : [];
  const problems = missing.map(f => `the ledger has no "${f}" field`);
  if (fields['Target end date'] && !date(fields['Target end date'])) problems.push('the Target end date has no YYYY-MM-DD date'); if (fields.Start && !date(fields.Start)) problems.push('the Start has no YYYY-MM-DD date');
  if (!consumers.length) problems.push('the ledger lists no consumers (a line "**Consumers:** `path`, ...")');
  const ends = [date(fields['Target end date']), ...reauth.map(r => r.end)].filter(Boolean).sort();
  for (const r of reauth) if (!r.reason || r.reason.length < 10) problems.push(`the reauthorization of ${r.on} gives no reason`);
  return { fields, reauth, consumers, problems, endDate: ends.length ? ends[ends.length - 1] : null };
}
function expand(root, pat) { if (!pat.includes('*')) return fs.existsSync(path.join(root, pat)) ? [pat] : []; const dir = path.dirname(pat), re = new RegExp('^' + path.basename(pat).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'); const d = path.join(root, dir); return fs.existsSync(d) ? fs.readdirSync(d).filter(f => re.test(f)).sort().map(f => path.join(dir, f)) : []; }

function status(root, now) {
  const ledgerPath = path.join(root, 'ssot', 'TRANSITION_DUALSOURCE.md');
  if (!fs.existsSync(ledgerPath)) return { verdict: 'MALFORMED', code: 2, problems: ['ssot/TRANSITION_DUALSOURCE.md does not exist: a dual-source period with no ledger is not bounded'] };
  const L = parseLedger(fs.readFileSync(ledgerPath, 'utf8')); if (L.problems.length) return { verdict: 'MALFORMED', code: 2, problems: L.problems };
  const files = [...new Set(L.consumers.flatMap(p => expand(root, p)))]; const rows = files.map(f => { const t = fs.readFileSync(path.join(root, f), 'utf8'); return { file: f, retired: (t.match(RETIRED) || []).length, target: TARGET.test(t) }; });
  const retiredLive = fs.existsSync(path.join(root, 'btnyc.json')); const stillReading = rows.filter(r => r.retired > 0), reading = rows.filter(r => r.target);
  const reasons = []; if (!rows.length) reasons.push('none of the listed consumers exists in the repository, so nothing proves a consumer reads the target');
  for (const r of stillReading) reasons.push(`${r.file} still names btnyc.json (${r.retired} reference${r.retired === 1 ? '' : 's'})`);
  if (rows.length && !reading.length) reasons.push('no listed consumer reads the derived graph (ssot/derived/btnyc_graph.json)');
  if (retiredLive) reasons.push('btnyc.json is still live at the repository root');
  const complete = reasons.length === 0; const today = (now || new Date()).toISOString().slice(0, 10); const overdue = !complete && L.endDate < today;
  return { verdict: complete ? 'COMPLETE' : overdue ? 'OVERDUE' : 'NOT COMPLETE', code: complete ? 0 : overdue ? 3 : 1, reasons, consumers: rows, endDate: L.endDate, today, reauthorizations: L.reauth.length, start: L.fields.Start, owner: L.fields.Owner };
}

if (require.main === module) {
  const r = status(lib.ROOT);
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else {
    console.log(`dual-source transition: ${r.verdict}` + (r.endDate ? ` (target end ${r.endDate}, today ${r.today}${r.reauthorizations ? `, ${r.reauthorizations} reauthorization(s)` : ''})` : ''));
    for (const x of r.problems || []) console.log('  ledger: ' + x);
    for (const x of r.reasons || []) console.log('  - ' + x);
    if (r.verdict === 'OVERDUE') console.log('  the end date has passed: close the transition, reauthorize it in ssot/TRANSITION_DUALSOURCE.md with a reason and a new end date, or roll it back. A silent extension is not allowed.');
  }
  process.exit(r.code);
}
module.exports = { status, parseLedger, FIELDS };
