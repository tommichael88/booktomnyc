#!/usr/bin/env node
/**
 * catalog_diff.js -- audit and compare versions of the catalog (btnyc.json) from the repository's own history. Read-only; it never writes a file unless you redirect its output.
 *
 *   node test_harness/tools/catalog_diff.js list [--md]            every commit on the current branch that changed btnyc.json: date, subject, blob, bytes, meta.version, counts
 *   node test_harness/tools/catalog_diff.js diff <A> <B> [--all]   what changed between two versions (default: A = the previous version of the file in history, B = the working file)
 *
 * A and B are each one of:  a git revision (a commit, a branch, `origin/main~3`; the file read is btnyc.json at that revision),  `REV:path` (any other file at a revision, e.g.
 * `legacy-archive:btnyc_v4.json`),  or a file path on disk. The report names, for each collection (services, modifiers, smart_tags, intake_modules, ...), what was added, removed and
 * changed, and lists every changed field that carries money or time (fee, price, rate, minutes) with the old and the new value, so that "did a price move?" is answered first.
 * (The same function is what verify_catalog_diff.js drives.)
 */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const git = args => cp.execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

function load(spec) {
  if (fs.existsSync(spec) && fs.statSync(spec).isFile()) return { label: spec, db: JSON.parse(fs.readFileSync(spec, 'utf8')) };
  const ref = spec.includes(':') ? spec : spec + ':btnyc.json';
  return { label: ref, db: JSON.parse(git(['show', ref])) };
}
const MONEY = /(^|_)(fee|price|rate|cost|minutes?|min|max|base|surcharge|hourly)(_|$)|fee|price|minutes/i;
const isObj = o => o && typeof o === 'object' && !Array.isArray(o);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// every differing leaf path between two values (arrays compared whole when they are not arrays of objects with ids)
function leafDiffs(a, b, p, out) {
  if (same(a, b)) return out;
  if (isObj(a) && isObj(b)) { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) leafDiffs(a[k], b[k], p ? p + '.' + k : k, out); return out; }
  out.push({ path: p, from: a, to: b });
  return out;
}
const asMap = (v, keyOf) => {
  if (isObj(v)) return v;
  if (Array.isArray(v)) { const m = {}; v.forEach((x, i) => { const k = keyOf(x, i); m[k in m ? k + '#' + i : k] = x; }); return m; }
  return null;
};
function compare(A, B) {
  const report = { collections: {}, money: [], scalars: [] };
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
    const a = A[k], b = B[k];
    if (same(a, b)) continue;
    const ma = asMap(a, (x, i) => (x && (x.id || x.name || x.module)) || '#' + i), mb = asMap(b, (x, i) => (x && (x.id || x.name || x.module)) || '#' + i);
    if (!ma || !mb) { report.scalars.push({ path: k, from: typeof a === 'string' ? a : '(' + typeof a + ')', to: typeof b === 'string' ? b : '(' + typeof b + ')' }); continue; }
    const added = Object.keys(mb).filter(x => !(x in ma)), removed = Object.keys(ma).filter(x => !(x in mb)), changed = [];
    for (const id of Object.keys(ma)) if (id in mb && !same(ma[id], mb[id])) {
      const d = leafDiffs(ma[id], mb[id], '', []);
      changed.push({ id, fields: d.length, paths: d.slice(0, 40).map(x => x.path) });
      for (const x of d) if (MONEY.test(x.path.split('.').pop() || '') || MONEY.test(x.path)) report.money.push({ where: `${k}.${id}.${x.path}`, from: x.from, to: x.to });
    }
    report.collections[k] = { added, removed, changed };
  }
  return report;
}

function render(r, la, lb, all) {
  const L = [`catalog diff  A = ${la}   B = ${lb}`, ''];
  const cols = Object.entries(r.collections);
  if (!cols.length && !r.scalars.length) L.push('No difference.');
  for (const [k, c] of cols) {
    L.push(`${k}: ${c.added.length} added, ${c.removed.length} removed, ${c.changed.length} changed`);
    const cap = all ? 1e9 : 12;
    if (c.added.length) L.push('   added:   ' + c.added.slice(0, cap).join(', ') + (c.added.length > cap ? ` ... +${c.added.length - cap}` : ''));
    if (c.removed.length) L.push('   removed: ' + c.removed.slice(0, cap).join(', ') + (c.removed.length > cap ? ` ... +${c.removed.length - cap}` : ''));
    for (const x of c.changed.slice(0, cap)) L.push(`   changed: ${x.id} (${x.fields} fields: ${x.paths.slice(0, 5).join(', ')}${x.paths.length > 5 ? ', ...' : ''})`);
    if (c.changed.length > cap) L.push(`   ... +${c.changed.length - cap} more changed (use --all)`);
  }
  for (const s of r.scalars) L.push(`${s.path}: ${s.from} -> ${s.to}`);
  L.push('', `money / time fields that changed: ${r.money.length}`);
  for (const m of r.money.slice(0, all ? 1e9 : 40)) L.push(`   ${m.where}: ${JSON.stringify(m.from)} -> ${JSON.stringify(m.to)}`);
  if (!all && r.money.length > 40) L.push(`   ... +${r.money.length - 40} more (use --all)`);
  return L.join('\n');
}

function history() {
  const rows = git(['log', '--format=%H|%ad|%s', '--date=short', '--', 'btnyc.json']).trim().split('\n').filter(Boolean);
  return rows.map(line => {
    const [sha, date, ...rest] = line.split('|'); const subject = rest.join('|');
    let meta = {};
    try {
      const raw = git(['show', `${sha}:btnyc.json`]); const db = JSON.parse(raw);
      meta = { bytes: Buffer.byteLength(raw), blob: git(['rev-parse', `${sha}:btnyc.json`]).trim(), version: (db.meta && db.meta.version) || null, services: (db.services || []).length, modifiers: Object.keys((db.global_rules && db.global_rules.modifiers) || {}).length, smart_tags: Object.keys(db.smart_tags || {}).length, intake_modules: Object.keys(db.intake_modules || {}).length };
    } catch (e) { meta = { error: e.message.split('\n')[0] }; }
    return Object.assign({ commit: sha.slice(0, 8), date, subject }, meta);
  });
}

module.exports = { load, compare, render, history, leafDiffs };

if (require.main === module) {
  const [cmd, ...rest] = process.argv.slice(2), flags = rest.filter(x => x.startsWith('--')), args = rest.filter(x => !x.startsWith('--'));
  if (cmd === 'list') {
    const h = history();
    if (flags.includes('--md')) {
      console.log('| commit | date | meta.version | bytes | blob | services | modifiers | tags | modules | subject |\n|---|---|---|---|---|---|---|---|---|---|');
      for (const r of h) console.log(`| \`${r.commit}\` | ${r.date} | ${r.version} | ${r.bytes} | \`${(r.blob || '').slice(0, 10)}\` | ${r.services} | ${r.modifiers} | ${r.smart_tags} | ${r.intake_modules} | ${String(r.subject).replace(/\|/g, '/').slice(0, 110)} |`);
    } else for (const r of h) console.log(`${r.commit}  ${r.date}  v${r.version}  ${r.bytes}b  services ${r.services}  modifiers ${r.modifiers}  tags ${r.smart_tags}  modules ${r.intake_modules}  ${String(r.subject).slice(0, 90)}`);
  } else if (cmd === 'diff') {
    let [a, b] = args;
    if (!b) { const h = history(); b = a || 'btnyc.json'; a = a ? a : (h[0] ? h[0].commit : 'HEAD'); if (!args.length) { a = 'HEAD'; b = 'btnyc.json'; } }
    const A = load(a), B = load(b);
    console.log(render(compare(A.db, B.db), A.label, B.label, flags.includes('--all')));
  } else { console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 12).join('\n')); process.exit(cmd ? 2 : 0); }
}
