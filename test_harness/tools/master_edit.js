#!/usr/bin/env node
/**
 * master_edit.js -- the one way Claude edits MASTER_TEST_SUITE.json (membership + content hashes), so the bookkeeping is a command, not hand-editing.
 *
 *   node test_harness/tools/master_edit.js add <test file name> [--note "why"]   list the test (sorted) and stamp its hash; --note appends to this build's _<T>_additions entry
 *   node test_harness/tools/master_edit.js remove <test file name> --reason "why" delist it and drop its hash
 *   node test_harness/tools/master_edit.js stamp                                  re-stamp the hash of every listed test (after an edit to any of them)
 *   node test_harness/tools/master_edit.js build <T###> [--reason "why"]           set _last_updated (and _last_updated_reason only if given)
 *
 * Hash = sha256 of the file, first 16 hex characters: exactly what verify_file_integrity.js recomputes (MASTER's test_hashes are written here, at delivery; `--update` of the
 * integrity tool never reads or writes them, so drift in a test can never be blessed by the tool that watches for it).
 */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const HARNESS = path.resolve(__dirname, '..'), FILE = path.join(HARNESS, 'MASTER_TEST_SUITE.json');
const m = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const h16 = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(HARNESS, f))).digest('hex').slice(0, 16);
const [cmd, a] = process.argv.slice(2), opt = n => { const i = process.argv.indexOf('--' + n); return i < 0 ? null : process.argv[i + 1]; };
const build = () => m._last_updated || 'T000';
m.test_hashes = m.test_hashes || {};

if (cmd === 'add') {
  if (!a || !fs.existsSync(path.join(HARNESS, a))) { console.error('no such test file: ' + a); process.exit(2); }
  if (!m.test_files.includes(a)) m.test_files = [...m.test_files, a];   // appended, as earlier builds did: the list is a record of when each test arrived
  m.test_hashes[a] = h16(a);
  const note = opt('note'); if (note) { const k = `_${build()}_additions`; m[k] = (m[k] ? m[k] + ' ' : '') + a + ' (' + note + ').'; }
} else if (cmd === 'remove') {
  if (!opt('reason')) { console.error('--reason is required'); process.exit(2); }
  m.test_files = m.test_files.filter(f => f !== a); delete m.test_hashes[a];
  const k = `_${build()}_removals`; m[k] = (m[k] ? m[k] + ' ' : '') + a + ': ' + opt('reason') + '.';
} else if (cmd === 'stamp') {
  for (const f of m.test_files) if (fs.existsSync(path.join(HARNESS, f))) m.test_hashes[f] = h16(f);
} else if (cmd === 'build') {
  if (!/^T\d+$/.test(a || '')) { console.error('usage: build T### [--reason "why"]'); process.exit(2); }
  m._last_updated = a; if (opt('reason')) m._last_updated_reason = opt('reason');   // the reason is the file's creation note; set it only when it genuinely changes
} else { console.error('usage: add|remove|stamp|build (see the header)'); process.exit(2); }

// the hash table keeps its own order (alphabetical, as it was written); a new entry is placed alphabetically, a removed one is gone
m.test_hashes = Object.fromEntries(Object.entries(m.test_hashes).filter(([f]) => m.test_files.includes(f)).sort(([x], [y]) => x < y ? -1 : x > y ? 1 : 0));
fs.writeFileSync(FILE, JSON.stringify(m, null, 2) + '\n');
console.log(`MASTER_TEST_SUITE.json: ${m.test_files.length} tests listed, ${Object.keys(m.test_hashes).length} hashes (${cmd}${a ? ' ' + a : ''})`);
