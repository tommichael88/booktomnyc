#!/usr/bin/env node
'use strict';
/**
 * The id register: the smallest reliable mechanism that makes "an id is frozen" a checked fact (R-SYSTEM-IDENTITY, R-INVARIANT-FROZEN; #165 gap 1).
 *
 * WHAT IS FROZEN. Every identifier that something can hold across a release:
 *   - the 17 typed ids the validator declares (ent, act, mod, svc, cmp, q, u, tag, mat, fml, chk, cat, grp, cls, ctx, par, fur);
 *   - option ids, as the pair `question_id#option_id` (an option id is unique only within its question, and is only ever referenced as the pair);
 *   - group-picker symptom ids and symptom-tile ids, as `group_id#id` (the curated ids routing_archetypes already carries).
 * NOT frozen: labels, display names, aliases, descriptions, order, numbers (prices, minutes), and the contents of any node. Those may change freely; an id may not.
 *
 * WHAT AN INTENTIONAL CHANGE IS. An id leaves the live set only through an entry in `retired[]` that a person wrote: {id, type, reason, replaced_by, ticket, retired_in}.
 *   `reason` says why; `replaced_by` is the live id of the same type that consumers move to, or null if none; `ticket` is the ledger entry that decided it (#NNN or TNNN). A retired id is never reused.
 *   There is no other way to remove or rename an id: a rename is a retirement (old id) plus an addition (new id) with `replaced_by` linking them.
 *
 * THE REGISTER IS A GUARD, NOT AN AUTHORITY. It records which ids existed; the source is the only owner of what they mean. `--write` only ever APPENDS ids that the source declares and the register lacks,
 * and refuses to write at all while any registered id is lost or reused. It never removes, renames or edits an id, and it never touches `retired[]`.
 * Its consumer is `test_harness/verify_entity_first_id_freeze.js` (suite-registered) and the pre-commit `--check`; it is not read at runtime and is not part of the published artifact.
 *
 * node id_register.js --check     exit 0 only if every registered id is live or properly retired, no retired id is live, every retirement is well-formed, and the register lists every live id (current)
 * node id_register.js --write     append newly declared ids (refuses while --check has a loss or a reuse)
 * node id_register.js --list      print counts by type
 */
const fs = require('fs'); const path = require('path');
const lib = require('./lib.js'); const V = require('./validate_source.js');

const REGISTER_PATH = path.join(lib.ROOT, 'ssot', 'migration', 'id_register.json');
const SOURCE_PATH = lib.PATHS && lib.PATHS.source ? lib.PATHS.source : path.join(lib.ROOT, 'ssot', 'btnyc_source.json');
const PAIR_TYPES = { opt: 'option (question_id#option_id)', sym: 'picker symptom (group_id#id)', tile: 'picker symptom tile (group_id#id)' };
const ALL_TYPES = [...Object.keys(lib.ID_TYPES), ...Object.keys(PAIR_TYPES)];
const TICKET_RE = /^(#|T)\d+/;
const REGISTER_NOTE = 'Guard, not authority: records which ids existed so a loss or a rename is a failure. Consumer: test_harness/verify_entity_first_id_freeze.js. Edit retired[] by hand (a person, with a ticket); ids[] is append-only via id_register.js --write.';

const sorted = a => [...new Set(a)].sort();

/** The live frozen set of a (valid) source: { type: [ids] } */
function collect(src, validation) {
  const v = validation || V.validate(src);
  if (!v.declared) throw new Error('the source does not validate, so its declared ids are unknown: ' + (v.errors || []).slice(0, 2).map(e => e.code + ' ' + e.path).join('; '));
  const out = {}; for (const t of Object.keys(lib.ID_TYPES)) out[t] = sorted(v.declared[t]);
  const qs = [...(src.entities || []).flatMap(e => e.questions || []), ...(src.shared_questions || [])];
  out.opt = sorted(qs.flatMap(q => (q.options || []).map(o => `${q.id}#${o.id}`)));
  const groups = (src.registries && src.registries.groups) || [];
  out.sym = sorted(groups.flatMap(g => ((g.picker || {}).symptoms || []).map(s => `${g.id}#${s.id}`)));
  out.tile = sorted(groups.flatMap(g => ((g.picker || {}).symptom_tiles || []).map(s => `${g.id}#${s.id}`)));
  return out;
}

const emptyRegister = () => ({ $comment: REGISTER_NOTE, register_version: 1, ids: Object.fromEntries(ALL_TYPES.map(t => [t, []])), retired: [] });

/** Compare a register with a live set. Returns { problems: [{code,type,id,note}], appended: {type:[ids]} } */
function compare(reg, live) {
  const problems = []; const P = (code, type, id, note) => problems.push({ code, type, id, note });
  if (!reg || typeof reg !== 'object' || reg.register_version !== 1 || !reg.ids || typeof reg.ids !== 'object' || !Array.isArray(reg.retired)) { P('R-FORM', '-', '-', 'the register is not {register_version: 1, ids: {...}, retired: [...]}'); return { problems, appended: {} }; }
  const retired = new Map(); const liveSet = {}; for (const t of ALL_TYPES) liveSet[t] = new Set(live[t] || []);
  reg.retired.forEach((r, i) => {
    const where = `retired[${i}]`;
    if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !r.id) { P('R-RETIRE-FORM', '-', where, 'a retirement is {id, type, reason, replaced_by, ticket, retired_in}'); return; }
    if (!ALL_TYPES.includes(r.type)) P('R-RETIRE-FORM', String(r.type), r.id, `${where}: type ${JSON.stringify(r.type)} is not one of ${ALL_TYPES.join(', ')}`);
    if (typeof r.reason !== 'string' || r.reason.trim().length < 12) P('R-RETIRE-FORM', r.type, r.id, `${where}: a retirement states its reason (at least a sentence)`);
    if (typeof r.ticket !== 'string' || !TICKET_RE.test(r.ticket)) P('R-RETIRE-FORM', r.type, r.id, `${where}: a retirement names the ledger entry that decided it (#NNN or TNNN)`);
    if (typeof r.retired_in !== 'string' || !r.retired_in.trim()) P('R-RETIRE-FORM', r.type, r.id, `${where}: a retirement names the change that made it (retired_in)`);
    if (!('replaced_by' in r) || (r.replaced_by !== null && typeof r.replaced_by !== 'string')) P('R-RETIRE-FORM', r.type, r.id, `${where}: replaced_by is the live id consumers move to, or null`);
    else if (typeof r.replaced_by === 'string') { if (!(liveSet[r.type] && liveSet[r.type].has(r.replaced_by))) P('R-RETIRE-REPLACEMENT', r.type, r.id, `${where}: replaced_by ${r.replaced_by} is not a live ${r.type} id`); if (r.replaced_by === r.id) P('R-RETIRE-REPLACEMENT', r.type, r.id, `${where}: an id is not replaced by itself`); }
    const key = r.type + ' ' + r.id; if (retired.has(key)) P('R-RETIRE-DUPLICATE', r.type, r.id, `${where}: retired twice`); retired.set(key, r);
  });
  const appended = {};
  for (const t of ALL_TYPES) {
    const have = Array.isArray(reg.ids[t]) ? reg.ids[t] : null;
    if (!have) { P('R-FORM', t, '-', `ids.${t} is missing or not an array`); continue; }
    if (new Set(have).size !== have.length) P('R-FORM', t, '-', `ids.${t} lists an id twice`);
    const haveSet = new Set(have);
    for (const id of have) {
      const isLive = liveSet[t].has(id), isRetired = retired.has(t + ' ' + id);
      if (isLive && isRetired) P('R-REUSE', t, id, `${id} was retired (${retired.get(t + ' ' + id).ticket}) and is declared again: a retired id is never reused`);
      else if (!isLive && !isRetired) P('R-LOST', t, id, `${id} is registered and no longer declared, and no retirement names it: an id is removed or renamed only by a written retirement`);
    }
    for (const id of live[t] || []) if (!haveSet.has(id)) (appended[t] = appended[t] || []).push(id);
  }
  for (const [key, r] of retired) if (!(reg.ids[r.type] || []).includes(r.id)) P('R-RETIRE-UNKNOWN', r.type, r.id, `${r.id} is retired but was never registered (nothing to retire)`);
  for (const t of Object.keys(appended)) for (const id of appended[t]) P('R-UNREGISTERED', t, id, `${id} is declared and not yet registered: run id_register.js --write so a later loss is caught`);
  return { problems, appended };
}

/** The register that --write would produce: the old ids plus every new one, order canonical (sorted). Refuses on a loss or a reuse. */
function appendOnly(reg, live) {
  const c = compare(reg, live);
  const bad = c.problems.filter(p => p.code !== 'R-UNREGISTERED');
  if (bad.length) { const e = new Error('refusing to write: ' + bad.length + ' problem(s) that --write must not paper over (first: ' + bad[0].code + ' ' + bad[0].id + ')'); e.problems = bad; throw e; }
  const next = JSON.parse(JSON.stringify(reg)); for (const t of ALL_TYPES) next.ids[t] = sorted([...(reg.ids[t] || []), ...(live[t] || [])]);
  next.$comment = REGISTER_NOTE; return next;
}

const readRegister = () => (fs.existsSync(REGISTER_PATH) ? JSON.parse(fs.readFileSync(REGISTER_PATH, 'utf8')) : null);
const render = reg => JSON.stringify(reg, null, 2) + '\n';

if (require.main === module) {
  const mode = process.argv[2] || '--check';
  const src = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8')); const live = collect(src);
  const counts = o => ALL_TYPES.map(t => `${t} ${(o[t] || []).length}`).join(', ');
  if (mode === '--list') { console.log('live: ' + counts(live)); process.exit(0); }
  const reg = readRegister() || (mode === '--write' ? emptyRegister() : null);
  if (!reg) { console.error('no register at ' + path.relative(lib.ROOT, REGISTER_PATH) + ' (run --write once to create it from the source)'); process.exit(1); }
  if (mode === '--write') {
    let next; try { next = appendOnly(reg, live); } catch (e) { console.error(e.message); for (const p of e.problems || []) console.error('  ' + p.code + ' [' + p.type + '] ' + p.note); process.exit(1); }
    const text = render(next); if (!fs.existsSync(REGISTER_PATH) || fs.readFileSync(REGISTER_PATH, 'utf8') !== text) { fs.writeFileSync(REGISTER_PATH, text); console.log('wrote ' + path.relative(lib.ROOT, REGISTER_PATH) + ' (' + counts(next.ids) + ')'); } else console.log('unchanged');
    process.exit(0);
  }
  if (mode === '--check') {
    const c = compare(reg, live);
    if (c.problems.length) { console.error('id register: ' + c.problems.length + ' problem(s)'); for (const p of c.problems.slice(0, 40)) console.error('  ' + p.code + ' [' + p.type + '] ' + p.note); process.exit(1); }
    const text = render(reg); if (fs.readFileSync(REGISTER_PATH, 'utf8') !== text) { console.error('id register is not in canonical form (run --write)'); process.exit(1); }
    console.log('id register current: ' + counts(reg.ids) + '; ' + reg.retired.length + ' retired'); process.exit(0);
  }
  console.error('usage: id_register.js --check | --write | --list'); process.exit(2);
}
module.exports = { collect, compare, appendOnly, emptyRegister, render, readRegister, REGISTER_PATH, ALL_TYPES, PAIR_TYPES, TICKET_RE };
