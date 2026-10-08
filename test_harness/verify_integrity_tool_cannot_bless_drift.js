#!/usr/bin/env node
/**
 * verify_integrity_tool_cannot_bless_drift.js -- holds verify_file_integrity.js to the property it exists for.
 *
 * The tool's original design was circular: `--update` hashed whatever was on disk and verify compared disk to that, so after any --update verify passed BY CONSTRUCTION. It
 * could only catch drift between an --update and the next verify; it could never catch "the whole set has drifted since Claude's last delivery", because --update silently
 * rebaselined everything it saw. Nothing checked the checker. This test runs the REAL tool, copied into a throwaway mini-repo, through the scenarios that matter. Every scenario
 * starts from a fresh copy, so none can contaminate another:
 *   - a clean repo verifies;
 *   - a locally edited TEST file fails verify, naming MASTER's expected hash and the found one;
 *   - running --update afterwards REFUSES to bless it (non-zero exit, loud warning), refreshes the manifest as accounting, leaves MASTER byte-identical, and verify STILL fails:
 *     the circularity is broken;
 *   - a locally edited NON-test file is still accepted by --update (the manifest remains the authority for those), and then verifies;
 *   - discovery is recursive for hashing (tools/ and retired/ are tracked) and tests are FLAT (a test hiding in tools/ fails; retired/ is the stated exception);
 *   - MASTER with no test_hashes, a missing hash, or an orphan hash fails; an unlisted test fails;
 *   - --keep-absent preserves manifest entries for files this machine lacks, and without it they are dropped.
 */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { spawnSync } = require('child_process');
const TOOL = path.join(__dirname, 'verify_file_integrity.js');
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log('  \u2713 ' + name); } else { fail++; console.log('  \u2717 ' + name + (detail ? '\n      ' + detail : '')); } };
const h16 = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16);
const sha = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

function mkRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'integrity-')), th = path.join(root, 'test_harness');
  for (const d of ['', 'tools', 'retired']) fs.mkdirSync(path.join(th, d), { recursive: true });
  fs.copyFileSync(TOOL, path.join(th, 'verify_file_integrity.js'));
  fs.writeFileSync(path.join(th, 'verify_a.js'), "console.log('a');\n"); fs.writeFileSync(path.join(th, 'verify_b.js'), "console.log('b');\n");
  fs.writeFileSync(path.join(th, 'run_all.sh'), '#!/bin/sh\necho run\n'); fs.writeFileSync(path.join(th, 'tools', 'helper.js'), "module.exports = 1;\n");
  fs.writeFileSync(path.join(th, 'retired', 'verify_old.py'), "print('old')\n");
  // MASTER lists the two top-level tests and stamps their content, as a Claude delivery does
  // (the tool's own file is test-named, and in the real tree it is a listed test, so the fixture lists it too)
  const listed = ['verify_a.js', 'verify_b.js', 'verify_file_integrity.js'];
  fs.writeFileSync(path.join(th, 'MASTER_TEST_SUITE.json'), JSON.stringify({ test_files: listed, test_hashes: Object.fromEntries(listed.map(n => [n, h16(path.join(th, n))])) }, null, 2));
  fs.writeFileSync(path.join(root, 'qr.html'), '<html></html>');
  run(th, ['--update'], { CLAUDE_SESSION_LABEL: 'TEST' });          // the delivery's manifest
  return { root, th };
}
function run(th, args, env) { const r = spawnSync('node', ['verify_file_integrity.js', ...args], { cwd: th, encoding: 'utf8', env: Object.assign({}, process.env, env || {}) }); return { code: r.status, out: (r.stdout || '') + (r.stderr || '') }; }
const verify = th => run(th, []);
const master = th => fs.readFileSync(path.join(th, 'MASTER_TEST_SUITE.json'));
const manifest = th => JSON.parse(fs.readFileSync(path.join(th, 'FILE_MANIFEST.json'), 'utf8'));

console.log('\n=== 1. a clean repo verifies, and discovery is recursive ===');
{ const { th } = mkRepo(), v = verify(th), m = manifest(th);
  check('a freshly delivered repo verifies (exit 0)', v.code === 0, v.out.split('\n').filter(l => /\u2717|failed/.test(l)).join(' | '));
  check('the manifest tracks files in subdirectories (tools/helper.js and retired/verify_old.py), which the old top-level walk never saw', !!m['tools/helper.js'] && !!m['retired/verify_old.py'], Object.keys(m).join(', '));
  check('the manifest marks a runner test as accounting only, with MASTER as its authority', m['verify_a.js'] && m['verify_a.js'].authority === 'MASTER_TEST_SUITE.json'); }

console.log('\n=== 2. a locally edited TEST file cannot be blessed by --update ===');
{ const { th } = mkRepo(); const before = master(th), want = h16(path.join(th, 'verify_a.js'));
  fs.appendFileSync(path.join(th, 'verify_a.js'), "// edited locally\n");
  const v = verify(th); check('verify FAILS, naming the test, the hash MASTER expects, and the hash found', v.code !== 0 && v.out.includes('verify_a.js') && v.out.includes(want) && v.out.includes(h16(path.join(th, 'verify_a.js'))), v.out.split('\n').filter(l => /verify_a|expected/.test(l)).join(' | '));
  const u = run(th, ['--update'], { CLAUDE_SESSION_LABEL: 'TEST' });
  check('--update then REFUSES: non-zero exit and a loud "DID NOT BLESS" warning naming the file and both hashes', u.code !== 0 && /DID NOT BLESS/.test(u.out) && u.out.includes('verify_a.js') && u.out.includes(want), u.out.slice(-400));
  check('--update left MASTER_TEST_SUITE.json byte-identical (it is never written)', Buffer.compare(before, master(th)) === 0);
  check('--update did refresh the manifest (accounting): it now records the edited file\'s new hash', manifest(th)['verify_a.js'].hash === h16(path.join(th, 'verify_a.js')));
  const v2 = verify(th); check('and verify STILL FAILS afterwards -- the old circularity (update, then pass by construction) is broken', v2.code !== 0 && v2.out.includes('verify_a.js'), 'exit ' + v2.code);
  fs.writeFileSync(path.join(th, 'verify_a.js'), "console.log('a');\n"); run(th, ['--update'], { CLAUDE_SESSION_LABEL: 'TEST' });
  check('restoring the delivered file makes verify pass again', verify(th).code === 0); }

console.log('\n=== 3. non-test files keep the manifest as their authority ===');
{ const { th } = mkRepo(); fs.appendFileSync(path.join(th, 'tools', 'helper.js'), '// local tweak\n');
  const v = verify(th); check('a locally edited non-test file fails verify against the manifest', v.code !== 0 && v.out.includes('tools/helper.js'));
  const u = run(th, ['--update'], { CLAUDE_SESSION_LABEL: 'TEST' }); check('--update accepts it (exit 0): the manifest, not MASTER, governs non-test files', u.code === 0, u.out.slice(-200));
  check('and verify then passes', verify(th).code === 0); }

console.log('\n=== 4. tests are FLAT; MASTER must be complete ===');
{ const { th } = mkRepo(); fs.writeFileSync(path.join(th, 'tools', 'verify_hidden.js'), "console.log('never runs');\n");
  const v = verify(th); check('a test hiding in a subdirectory fails (the runner globs the top level only, so it would never run)', v.code !== 0 && v.out.includes('tools/verify_hidden.js')); }
{ const { th } = mkRepo(); check('retired/ keeps a test without failing (the stated exception)', verify(th).code === 0 && fs.existsSync(path.join(th, 'retired', 'verify_old.py'))); }
{ const { th } = mkRepo(); fs.writeFileSync(path.join(th, 'verify_new.js'), "console.log('new');\n"); const v = verify(th); check('a test on disk that MASTER does not list fails (unacknowledged)', v.code !== 0 && v.out.includes('verify_new.js')); }
{ const { th } = mkRepo(); const mm = JSON.parse(master(th)); delete mm.test_hashes; fs.writeFileSync(path.join(th, 'MASTER_TEST_SUITE.json'), JSON.stringify(mm)); run(th, ['--update'], { CLAUDE_SESSION_LABEL: 'TEST' });
  const v = verify(th); check('MASTER with no test_hashes fails: test content is not verifiable', v.code !== 0 && /no test_hashes/.test(v.out)); }
{ const { th } = mkRepo(); const mm = JSON.parse(master(th)); delete mm.test_hashes['verify_b.js']; fs.writeFileSync(path.join(th, 'MASTER_TEST_SUITE.json'), JSON.stringify(mm)); run(th, ['--update'], { CLAUDE_SESSION_LABEL: 'TEST' });
  const v = verify(th); check('a listed test with no recorded hash fails', v.code !== 0 && /NO recorded hash/.test(v.out) && v.out.includes('verify_b.js')); }
{ const { th } = mkRepo(); const mm = JSON.parse(master(th)); mm.test_hashes['verify_ghost.js'] = 'deadbeefdeadbeef'; fs.writeFileSync(path.join(th, 'MASTER_TEST_SUITE.json'), JSON.stringify(mm)); run(th, ['--update'], { CLAUDE_SESSION_LABEL: 'TEST' });
  const v = verify(th); check('a hash in MASTER that belongs to no listed test fails', v.code !== 0 && /belong to no listed test/.test(v.out) && v.out.includes('verify_ghost.js')); }

console.log('\n=== 5. sandboxes that lack some of the operator\'s local files ===');
{ const { th } = mkRepo(); fs.unlinkSync(path.join(th, 'run_all.sh'));
  run(th, ['--update', '--keep-absent'], { CLAUDE_SESSION_LABEL: 'TEST' }); const kept = manifest(th)['run_all.sh'];
  check('--keep-absent preserves the manifest entry for a file this machine lacks', !!kept);
  const v = verify(th); check('and verify reports that file as MISSING rather than forgetting it', v.code !== 0 && /run_all\.sh: FILE MISSING/.test(v.out), v.out.split('\n').filter(l => /run_all/.test(l)).join(' | '));
  run(th, ['--update'], { CLAUDE_SESSION_LABEL: 'TEST' }); check('without --keep-absent the entry is dropped (the old behaviour, now an explicit choice)', !manifest(th)['run_all.sh']); }

console.log(`\n[integrity tool cannot bless drift] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail ? 1 : 0);
