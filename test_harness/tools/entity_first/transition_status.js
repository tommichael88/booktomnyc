#!/usr/bin/env node
'use strict';
/**
 * transition_status.js -- the detector of the btnyc.json -> ssot/btnyc_source.json dual-source transition (T175, reconciled T176; R-SYSTEM-DUALSOURCE).
 *
 *   node test_harness/tools/entity_first/transition_status.js [--json]
 *
 * Reads the transition ledger (ssot/TRANSITION_DUALSOURCE.md) and answers the one question the rule asks of a detector: is the transition COMPLETE?
 *   exit 0  COMPLETE      the retired ROLE is gone. All five hold: (1) the artifact (`btnyc.json`) is the published derived artifact: it parses, carries a `$source` provenance reference
 *                         (path, sha256, source_schema_version, derivation_version) whose sha256 is the hash of the source as it is now, and holds none of the hybrid's compiler-owned keys;
 *                         (2) the publish command exists and its `--check` passes (validate, derive, verify freshness and reproducibility, refuse otherwise); (3) none of the tools that exist only
 *                         because there are two sources (the legacy patch/splice, migration and parity tools) is still present; (4) no listed runtime consumer reads the authored source
 *                         (`btnyc_source`), the Charter's "never the authored source as a fallback"; (5) at least one listed consumer reads the artifact.
 *   exit 1  NOT COMPLETE  the transition is open and inside its end date; each unmet condition is named
 *   exit 3  OVERDUE       not complete, and the end date (or the latest reauthorized end date) has passed: close it, reauthorize it in the ledger with a reason and a new date, or roll it back
 *   exit 2  MALFORMED     the ledger lacks one of the six fields the rule requires, a date that cannot be read, or the artifact, publish command, retired-tool or consumer lines the conditions need
 * The file NAME `btnyc.json` is not what is retired: the Charter names it as the derived runtime artifact. What is retired is its role as an authored source that the runtime also reads.
 * (T175 read the completion as "btnyc.json is gone"; that contradicted the Charter and is corrected in ssot/ENTITY_FIRST_DESIGN_NOTE.md section 3.1.)
 */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const lib = require('./lib.js');

const FIELDS = ['Start', 'Owner', 'Completion condition', 'Detector', 'Expected cost', 'Target end date'];
const SOURCE_REF = /btnyc_source/g, ARTIFACT_REF = /btnyc\.json/;
const PROVENANCE_KEYS = ['path', 'sha256', 'source_schema_version', 'derivation_version'];

function parseLedger(text) {
  const fields = {}; for (const f of FIELDS) { const m = new RegExp('^- \\*\\*' + f + ':\\*\\*\\s*(.+)$', 'm').exec(text); if (m) fields[f] = m[1].trim(); }
  const missing = FIELDS.filter(f => !fields[f]); const date = s => { const m = /(\d{4}-\d{2}-\d{2})/.exec(s || ''); return m ? m[1] : null; };
  const reauth = [...text.matchAll(/^- \*\*Reauthorized (\d{4}-\d{2}-\d{2}):\*\*\s*(.+?);\s*new end date (\d{4}-\d{2}-\d{2})\s*$/gm)].map(m => ({ on: m[1], reason: m[2].trim(), end: m[3] }));
  const cons = /^\*\*Consumers:\*\*\s*(.+)$/m.exec(text); const consumers = cons ? [...cons[1].matchAll(/`([^`]+)`/g)].map(m => m[1]) : [];
  const one = label => { const m = new RegExp('^\\*\\*' + label + ':\\*\\*\\s*`([^`]+)`\\s*$', 'm').exec(text); return m ? m[1] : null; };
  const artifact = one('Artifact'), publish = one('Publish command');
  const ret = /^\*\*Retired with it:\*\*\s*(.+)$/m.exec(text); const retired = ret ? [...ret[1].matchAll(/`([^`]+)`/g)].map(m => m[1]) : [];
  const problems = missing.map(f => `the ledger has no "${f}" field`);
  if (!artifact) problems.push('the ledger names no artifact (a line "**Artifact:** `btnyc.json`")');
  if (!publish) problems.push('the ledger names no publish command (a line "**Publish command:** `path`")');
  if (!retired.length) problems.push('the ledger lists no retired tools (a line "**Retired with it:** `path`, ...")');
  if (fields['Target end date'] && !date(fields['Target end date'])) problems.push('the Target end date has no YYYY-MM-DD date'); if (fields.Start && !date(fields.Start)) problems.push('the Start has no YYYY-MM-DD date');
  if (!consumers.length) problems.push('the ledger lists no consumers (a line "**Consumers:** `path`, ...")');
  const ends = [date(fields['Target end date']), ...reauth.map(r => r.end)].filter(Boolean).sort();
  for (const r of reauth) if (!r.reason || r.reason.length < 10) problems.push(`the reauthorization of ${r.on} gives no reason`);
  return { fields, reauth, consumers, artifact, publish, retired, problems, endDate: ends.length ? ends[ends.length - 1] : null };
}
function expand(root, pat) { if (!pat.includes('*')) return fs.existsSync(path.join(root, pat)) ? [pat] : []; const dir = path.dirname(pat), re = new RegExp('^' + path.basename(pat).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'); const d = path.join(root, dir); return fs.existsSync(d) ? fs.readdirSync(d).filter(f => re.test(f)).sort().map(f => path.join(dir, f)) : []; }

function status(root, now) {
  const ledgerPath = path.join(root, 'ssot', 'TRANSITION_DUALSOURCE.md');
  if (!fs.existsSync(ledgerPath)) return { verdict: 'MALFORMED', code: 2, problems: ['ssot/TRANSITION_DUALSOURCE.md does not exist: a dual-source period with no ledger is not bounded'] };
  const L = parseLedger(fs.readFileSync(ledgerPath, 'utf8')); if (L.problems.length) return { verdict: 'MALFORMED', code: 2, problems: L.problems };
  const files = [...new Set(L.consumers.flatMap(p => expand(root, p)))]; const rows = files.map(f => { const x = fs.readFileSync(path.join(root, f), 'utf8'); return { file: f, source: (x.match(SOURCE_REF) || []).length, artifact: ARTIFACT_REF.test(x) }; });
  const reasons = []; if (!rows.length) reasons.push('none of the listed consumers exists in the repository, so nothing proves a consumer reads the artifact');
  // (1) the artifact is the published derived artifact
  const artPath = path.join(root, L.artifact), srcPath = path.join(root, 'ssot', 'btnyc_source.json');
  if (!fs.existsSync(artPath)) reasons.push(`${L.artifact} does not exist: there is no published artifact`);
  else { let art = null; try { art = JSON.parse(fs.readFileSync(artPath, 'utf8')); } catch (e) { reasons.push(`${L.artifact} is not valid JSON`); }
    if (art) { const prov = art.$source;
      if (!prov || typeof prov !== 'object') reasons.push(`${L.artifact} carries no $source provenance reference (it is still the legacy hybrid, not the derived artifact)`);
      else { const absent = PROVENANCE_KEYS.filter(k => typeof prov[k] !== 'string' || !prov[k]); if (absent.length) reasons.push(`${L.artifact} $source lacks ${absent.join(', ')} (source identity, source version and hash, derivation version)`);
        else if (!fs.existsSync(srcPath)) reasons.push('ssot/btnyc_source.json does not exist, so the provenance hash proves nothing');
        else if (prov.sha256 !== lib.sha(fs.readFileSync(srcPath, 'utf8'))) reasons.push(`${L.artifact} $source.sha256 is not the hash of the source as it is now (the artifact is stale)`); }
      const hybrid = lib.COMPILER_KEYS.filter(k => Object.prototype.hasOwnProperty.call(art, k)); if (hybrid.length) reasons.push(`${L.artifact} still holds the hybrid's compiler-owned keys (${hybrid.join(', ')}): it is not purely derived`); } }
  // (2) the publish command exists and its --check passes
  const pubPath = path.join(root, L.publish);
  if (!fs.existsSync(pubPath)) reasons.push(`the publish command ${L.publish} does not exist`);
  else { const r = cp.spawnSync(process.execPath, [pubPath, '--check'], { encoding: 'utf8', env: Object.assign({}, process.env, { BTNYC_ROOT: root }) }); if (r.status !== 0) reasons.push(`${L.publish} --check exits ${r.status}: ${(r.stderr || r.stdout || '').trim().split('\n')[0].slice(0, 160)}`); }
  // (3) the tools that exist only because there are two sources are gone
  const present = L.retired.filter(f => fs.existsSync(path.join(root, f))); if (present.length) reasons.push(`${present.length} tool(s) that exist only because there are two sources are still present: ${present.join(', ')}`);
  // (4) no runtime consumer reads the authored source; (5) one reads the artifact
  for (const r of rows.filter(x => x.source > 0)) reasons.push(`${r.file} names the authored source btnyc_source (${r.source} reference${r.source === 1 ? '' : 's'}): the runtime consumes only the derived artifact`);
  if (rows.length && !rows.some(r => r.artifact)) reasons.push(`no listed consumer reads ${L.artifact}`);
  const complete = reasons.length === 0; const today = (now || new Date()).toISOString().slice(0, 10); const overdue = !complete && L.endDate < today;
  return { verdict: complete ? 'COMPLETE' : overdue ? 'OVERDUE' : 'NOT COMPLETE', code: complete ? 0 : overdue ? 3 : 1, reasons, consumers: rows, artifact: L.artifact, publish: L.publish, endDate: L.endDate, today, reauthorizations: L.reauth.length, start: L.fields.Start, owner: L.fields.Owner };
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
