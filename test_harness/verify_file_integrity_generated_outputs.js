#!/usr/bin/env node
/**
 * verify_file_integrity_generated_outputs.js -- #202: the integrity count must not depend on which tests ran first.
 *
 * On a fresh checkout verify_file_integrity.js read 12 failures in one suite run and 10 in the next, on the same tree: the manifest listed files that scripts WRITE (the test
 * screenshots and reports, the root copies extract_modules.js generates), so whether they existed, and what they held, when the integrity test ran was a function of test order.
 * A baseline taken from a suite run could not carry that count. This test holds the two rules that remove the dependence. It runs the REAL tool, copied into a throwaway
 * mini-repo (the pattern of verify_integrity_tool_cannot_bless_drift.js), and checks the real tree against the real lists:
 *   1. --update never writes a generated file, and drops one an older manifest carried (with and without --keep-absent);
 *   2. the verdict is the same whether the generated files are absent, present, or present with other content (the property itself);
 *   3. a manifest that lists a generated file fails verify, naming it;
 *   4. an OPERATOR-LOCAL entry (flag `local_only`, set only by --local-only=) is reported and not counted when absent, checked when present, and an unflagged absent entry still fails;
 *      --update preserves the flag but never invents it;
 *   5. the real tree: the manifest lists no generated file; the tool's lists agree with .gitignore and with extract_modules.js (a new generated file that is not listed fails here);
 *   6. the sources that replaced the root copies are tracked (every file in modules/), and the page's own source is;
 *   7. non-vacuity: the same scenarios against a mutant tool (generated-file rule removed; local-only rule removed) fail the checks that guard them.
 */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { spawnSync } = require('child_process');
const TOOL = path.join(__dirname, 'verify_file_integrity.js');
const REPO = path.dirname(__dirname);
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (detail ? '\n      ' + detail : '')); } };
const h16 = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16);

const GENERATED_FILES = (root, th) => [path.join(root, 'ui_test_report.json'), path.join(root, 'state_mutation_classification.json'), path.join(th, 'failure_Cart_Operations.png'), path.join(th, 'failure_Guided_Builder.png'), path.join(root, 'nlp_engine.js'), path.join(root, 'UIRenderer.js')];

function mkRepo(toolSource) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'integrity-gen-')), th = path.join(root, 'test_harness');
  for (const d of ['', 'tools']) fs.mkdirSync(path.join(th, d), { recursive: true });
  fs.mkdirSync(path.join(root, 'modules'));
  fs.writeFileSync(path.join(th, 'verify_file_integrity.js'), toolSource);
  fs.writeFileSync(path.join(th, 'verify_a.js'), "console.log('a');\n");
  fs.writeFileSync(path.join(th, 'run_all.sh'), '#!/bin/sh\necho run\n'); fs.writeFileSync(path.join(th, 'tools', 'helper.js'), 'module.exports = 1;\n');
  const listed = ['verify_a.js', 'verify_file_integrity.js'];
  fs.writeFileSync(path.join(th, 'MASTER_TEST_SUITE.json'), JSON.stringify({ test_files: listed, test_hashes: Object.fromEntries(listed.map(n => [n, h16(path.join(th, n))])) }, null, 2));
  fs.writeFileSync(path.join(root, 'qr.html'), '<html></html>'); fs.writeFileSync(path.join(root, 'modules', 'm.js'), 'module.exports = 2;\n');
  return { root, th };
}
const run = (th, args, env) => { const r = spawnSync('node', ['verify_file_integrity.js', ...args], { cwd: th, encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_SESSION_LABEL: 'TEST' }, env || {}) }); return { code: r.status, out: (r.stdout || '') + (r.stderr || '') }; };
const manifestOf = th => JSON.parse(fs.readFileSync(path.join(th, 'FILE_MANIFEST.json'), 'utf8'));
const verdict = out => (out.match(/\[File integrity\][^\n]*/) || ['(no summary line)'])[0];
const toolSrc = fs.readFileSync(TOOL, 'utf8');

function writeGenerated(root, th, content) { for (const f of GENERATED_FILES(root, th)) fs.writeFileSync(f, content); }
function removeGenerated(root, th) { for (const f of GENERATED_FILES(root, th)) try { fs.unlinkSync(f); } catch (e) { } }
const GENERATED_NAMES = ['ui_test_report.json', 'state_mutation_classification.json', 'failure_Cart_Operations.png', 'failure_Guided_Builder.png', 'nlp_engine.js', 'UIRenderer.js'];

console.log('\n=== 1. --update never writes a generated file, and drops one an older manifest carried ===');
{ const { root, th } = mkRepo(toolSrc); writeGenerated(root, th, 'first run output\n');
  const u = run(th, ['--update']), m = manifestOf(th);
  check('--update succeeds on a tree with the generated files present', u.code === 0, u.out.slice(-300));
  check('the manifest names none of the generated files (screenshots, reports, extract_modules copies)', GENERATED_NAMES.every(n => !m[n]), Object.keys(m).filter(n => GENERATED_NAMES.includes(n)).join(', '));
  check('it still names the sources: qr.html, the harness helper, and every file in modules/', !!m['qr.html'] && !!m['tools/helper.js'] && !!m['modules/m.js'], Object.keys(m).join(', '));
  // an older manifest that carried them (the T173 one did), with --keep-absent as the operator's sandbox runs it
  const old = manifestOf(th); for (const n of GENERATED_NAMES) old[n] = { hash: '0123456789abcdef', lines: 1, bytes: 1, label: n, updated: '2026-10-12T00:00:00' };
  fs.writeFileSync(path.join(th, 'FILE_MANIFEST.json'), JSON.stringify(old, null, 2));
  removeGenerated(root, th);
  const u2 = run(th, ['--update', '--keep-absent']), m2 = manifestOf(th);
  check('--update --keep-absent drops the generated entries an old manifest carried (it must not preserve them)', GENERATED_NAMES.every(n => !m2[n]) && u2.code === 0, Object.keys(m2).filter(n => GENERATED_NAMES.includes(n)).join(', ')); }

console.log('\n=== 2. the verdict is the same whether the generated files are absent, present, or present with other content ===');
{ const { root, th } = mkRepo(toolSrc); run(th, ['--update']);
  removeGenerated(root, th); const absent = run(th, []);
  writeGenerated(root, th, 'this suite run\n'); const present = run(th, []);
  writeGenerated(root, th, 'another suite run, other bytes\n'.repeat(50)); const changed = run(th, []);
  check('a freshly delivered tree verifies with no generated file on disk (exit 0)', absent.code === 0, absent.out.split('\n').filter(l => /✗|failed/.test(l)).join(' | '));
  check('the summary line is identical with the generated files present', verdict(present.out) === verdict(absent.out) && present.code === absent.code, verdict(absent.out) + ' vs ' + verdict(present.out));
  check('and identical when they hold other content (a different suite run)', verdict(changed.out) === verdict(absent.out) && changed.code === absent.code, verdict(absent.out) + ' vs ' + verdict(changed.out));
  check('no per-file line mentions a generated file in any of the three', ![absent, present, changed].some(r => GENERATED_NAMES.some(n => r.out.includes(n + ':') || r.out.includes(n + ' ['))), 'a generated file was read'); }

console.log('\n=== 3. a manifest that lists a generated file fails verify, naming it ===');
{ const { th } = mkRepo(toolSrc); run(th, ['--update']);
  const m = manifestOf(th); m['ui_test_report.json'] = { hash: 'aaaaaaaaaaaaaaaa', lines: 1, bytes: 1, label: 'x', updated: '2026-10-12T00:00:00' }; m['failure_Affirmation_Card.png'] = { hash: 'bbbbbbbbbbbbbbbb', lines: 1, bytes: 1, label: 'x', updated: '2026-10-12T00:00:00' };
  fs.writeFileSync(path.join(th, 'FILE_MANIFEST.json'), JSON.stringify(m, null, 2));
  // the sidecar covers the manifest itself, so a hand-edit also trips the self-check; refresh it the way --update does, to isolate THIS rule
  fs.writeFileSync(path.join(th, 'FILE_MANIFEST.json.sha256'), h16(path.join(th, 'FILE_MANIFEST.json')) + '\n');
  const v = run(th, []);
  check('verify FAILS and names both generated entries', v.code !== 0 && v.out.includes('ui_test_report.json') && v.out.includes('failure_Affirmation_Card.png') && /depend on test order/.test(v.out), v.out.split('\n').filter(l => /✗/.test(l)).join(' | '));
  check('it fails once, as a fact about the manifest, not once per missing file', (v.out.match(/FILE MISSING/g) || []).length === 0); }

console.log('\n=== 4. an operator-local entry: reported not counted when absent, checked when present; the flag is never invented ===');
{ const { root, th } = mkRepo(toolSrc);
  fs.writeFileSync(path.join(root, 'legacy.py'), "print('operator local')\n"); fs.writeFileSync(path.join(root, 'qr_loader.js'), 'x\n');
  const m0 = (run(th, ['--update']), manifestOf(th));
  check('without --local-only, --update does not pick the file up at all (root files enter by name; nothing invented)', !m0['legacy.py']);
  const m = manifestOf(th);
  for (const n of ['legacy.py']) m[n] = { hash: h16(path.join(root, n)), lines: 2, bytes: 24, label: n, updated: '2026-10-12T00:00:00', local_only: true };
  m['qr_loader.js'] = { hash: h16(path.join(root, 'qr_loader.js')), lines: 2, bytes: 2, label: 'qr_loader.js', updated: '2026-10-12T00:00:00' };   // present, NOT flagged
  fs.writeFileSync(path.join(th, 'FILE_MANIFEST.json'), JSON.stringify(m, null, 2)); fs.writeFileSync(path.join(th, 'FILE_MANIFEST.json.sha256'), h16(path.join(th, 'FILE_MANIFEST.json')) + '\n');
  const present = run(th, []);
  check('present and matching: it passes', present.code === 0 && present.out.includes('✓ legacy.py'), present.out.split('\n').filter(l => /✗|failed/.test(l)).join(' | '));
  fs.appendFileSync(path.join(root, 'legacy.py'), '# edited\n');
  const edited = run(th, []);
  check('present and edited: it FAILS (checked wherever it exists)', edited.code !== 0 && /legacy\.py: CHECKSUM MISMATCH/.test(edited.out));
  fs.unlinkSync(path.join(root, 'legacy.py'));
  const gone = run(th, []);
  check('absent: reported as operator-local, not counted, and verify passes', gone.code === 0 && /operator-local, not in this checkout/.test(gone.out) && /1 operator-local file\(s\) not in this checkout, not counted/.test(verdict(gone.out)), verdict(gone.out) + ' exit ' + gone.code);
  fs.unlinkSync(path.join(root, 'qr_loader.js'));
  const unflagged = run(th, []);
  check('an UNFLAGGED absent entry still fails as FILE MISSING', unflagged.code !== 0 && /qr_loader\.js: FILE MISSING/.test(unflagged.out));
  run(th, ['--update', '--keep-absent']);
  check('--update --keep-absent preserves the flag on the entry that had it', manifestOf(th)['legacy.py'] && manifestOf(th)['legacy.py'].local_only === true);
  check('and does not turn the unflagged entry into a local-only one', manifestOf(th)['qr_loader.js'] && !manifestOf(th)['qr_loader.js'].local_only);
  run(th, ['--update', '--keep-absent', '--local-only=qr_loader.js']);
  check('--local-only=NAME is the only way to set the flag', manifestOf(th)['qr_loader.js'] && manifestOf(th)['qr_loader.js'].local_only === true); }

console.log('\n=== 5. the real tree: no generated entry; the tool\'s lists agree with .gitignore and extract_modules.js ===');
{ const m = JSON.parse(fs.readFileSync(path.join(__dirname, 'FILE_MANIFEST.json'), 'utf8'));
  const listed = Object.keys(m).filter(n => /^failure_.*\.png$/.test(path.basename(n)) || ['ui_test_report.json', 'state_mutation_classification.json', 'smoke_test_result.json', 'SWEEP_RESULTS.json', 'pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js', 'UIRenderer.js', 'AppController.js', 'appReducer.js', 'store.js', 'cart_logic.js'].includes(n));
  check('the real FILE_MANIFEST.json lists no generated file', listed.length === 0, listed.join(', '));
  const grab = name => { const mt = toolSrc.match(new RegExp('const ' + name + ' = \\[([^\\]]*)\\]')); return mt ? mt[1].split(',').map(x => x.trim().replace(/^'|'$/g, '')).filter(Boolean) : null; };
  const mods = grab('GENERATED_ROOT_MODULES'), outs = grab('GENERATED_OUTPUTS');
  const ext = fs.readFileSync(path.join(__dirname, 'extract_modules.js'), 'utf8'), block = (ext.match(/const MODULE_MARKERS = \{([\s\S]*?)\};/) || [])[1] || '';
  const written = [...block.matchAll(/^\s*'([^']+\.js)'\s*:/gm)].map(x => x[1]);
  check('the tool\'s GENERATED_ROOT_MODULES is exactly what extract_modules.js writes (a new generated module must be listed)', mods && written.length > 0 && JSON.stringify([...mods].sort()) === JSON.stringify([...written].sort()), 'tool: ' + (mods || []).join(',') + ' | extractor: ' + written.join(','));
  const gi = fs.readFileSync(path.join(REPO, '.gitignore'), 'utf8').split('\n').map(l => l.trim());
  const ignored = n => gi.includes(n) || gi.includes('/' + n) || gi.includes('test_harness/' + n);
  check('every generated root module is git-ignored (root-anchored)', mods && mods.every(n => gi.includes('/' + n)), (mods || []).filter(n => !gi.includes('/' + n)).join(', '));
  check('every generated test output is git-ignored', outs && outs.every(ignored) && gi.some(l => /failure_\*\.png$/.test(l)), (outs || []).filter(n => !ignored(n)).join(', '));
  // the screenshots the real tests write are all covered by the failure_*.png rule
  const uiSrc = fs.readFileSync(path.join(__dirname, 'verify_ui_surfaces.js'), 'utf8');
  check('the tests that write screenshots and reports write the names the tool treats as generated', /failure_\$\{/.test(uiSrc) && /ui_test_report\.json/.test(uiSrc)); }

console.log('\n=== 6. the sources that replaced the root copies are tracked ===');
{ const m = JSON.parse(fs.readFileSync(path.join(__dirname, 'FILE_MANIFEST.json'), 'utf8'));
  const modFiles = fs.readdirSync(path.join(REPO, 'modules')).filter(f => fs.statSync(path.join(REPO, 'modules', f)).isFile());
  const missing = modFiles.filter(f => !m['modules/' + f]);
  check('every file in modules/ (' + modFiles.length + ') is a manifest entry', modFiles.length > 0 && missing.length === 0, 'untracked: ' + missing.join(', '));
  check('qr.html and btnyc.json are manifest entries', !!m['qr.html'] && !!m['btnyc.json']); }

console.log('\n=== 7. non-vacuity: a mutant tool fails the checks that guard each rule ===');
{ // (a) the generated-file rule removed: isGenerated() never true
  const mut = toolSrc.replace(/const isGenerated = f => [^\n]*\n/, 'const isGenerated = f => false;\n');
  check('the mutant source differs from the tool (the substitution applied)', mut !== toolSrc);
  const { root, th } = mkRepo(mut); writeGenerated(root, th, 'one\n'); run(th, ['--update']);
  check('mutant: --update writes generated entries into the manifest', GENERATED_NAMES.some(n => manifestOf(th)[n]));
  const present = run(th, []); removeGenerated(root, th); const absent = run(th, []);
  check('mutant: the verdict depends on whether the generated files exist (present and matching vs absent: the 12-versus-10 of #202)', verdict(present.out) !== verdict(absent.out) && present.code === 0 && absent.code !== 0, verdict(present.out) + ' / ' + verdict(absent.out));
  // (b) the local-only rule removed: an absent flagged entry counts as a failure again
  const mut2 = toolSrc.replace("if (expected.local_only) {", "if (false && expected.local_only) {");
  check('the second mutant differs from the tool', mut2 !== toolSrc);
  const r2 = mkRepo(mut2); fs.writeFileSync(path.join(r2.root, 'legacy.py'), "print('x')\n"); run(r2.th, ['--update']);
  const mm = manifestOf(r2.th); mm['legacy.py'] = { hash: h16(path.join(r2.root, 'legacy.py')), lines: 2, bytes: 11, label: 'legacy.py', updated: '2026-10-12T00:00:00', local_only: true };
  fs.writeFileSync(path.join(r2.th, 'FILE_MANIFEST.json'), JSON.stringify(mm, null, 2)); fs.writeFileSync(path.join(r2.th, 'FILE_MANIFEST.json.sha256'), h16(path.join(r2.th, 'FILE_MANIFEST.json')) + '\n');
  fs.unlinkSync(path.join(r2.root, 'legacy.py'));
  const v2 = run(r2.th, []); check('mutant: an absent operator-local file fails again (the check that guards the rule is not vacuous)', v2.code !== 0 && /legacy\.py: FILE MISSING/.test(v2.out)); }

console.log(`\n[Integrity generated outputs] ${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
