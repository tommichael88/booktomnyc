#!/usr/bin/env node
/**
 * verify_fixed_point.js -- R-INVARIANT-FIXEDPOINT and R-SYSTEM-UNBOUNDED: a generated artifact has a stable, reproducible form and never uses its own contents as an input to a value written back into them (T180 6/n).
 *
 * @enforces R-INVARIANT-FIXEDPOINT
 * @enforces R-SYSTEM-UNBOUNDED
 * @enforces R-TEST-CANFAIL
 * @detects DEFECT-TEST-CANTFAIL
 *
 * THE RULES (Charter, Part IV). FIXEDPOINT: "An artifact that refers to or reproduces itself must have a defined stable fixed point, or the self-reference must be removed. Hashes cannot depend on a hash embedded
 * in the same content; generation cannot vary with process hash seed or incidental iteration order; output cannot drift on a second run; and validity cannot depend on the artifact's own mutable line shape. ...
 * Accomplishment: identical inputs yield byte-identical canonical output; integrity values have a defined canonicalization rule; and validity does not depend on editing a self-referential value."
 * UNBOUNDED: "No generated artifact may use its own mutable contents as an input to a value written back into those contents. Move integrity values to a sidecar ... Accomplishment: scans identify
 * self-referential hash/splice patterns; each is removed or uses a documented canonical fixed-point algorithm; repeated generation remains stable."
 *
 * WHAT THIS FOUND AND FIXED (T180 6/n). FILE_MANIFEST.json listed ITSELF ("File integrity manifest (self-referencing)"): --update wrote an entry for the manifest, which changed the manifest, which made the entry
 * stale; a second and a third write tried to patch it and the code said so ("Not solved here ... nothing ever checks this specific field"). And every --update restamped the `updated` time of all ~325 entries, so two
 * runs on one tree gave two different files. Now: no self-entry (the sidecar FILE_MANIFEST.json.sha256, the hash of the manifest exactly as written, is the integrity value); one write; an entry's `updated` moves
 * only when its file's content did; the manifest's _meta records the last change, so a second --update on an unchanged tree writes the same bytes.
 *
 * WHAT IS HELD
 *   1. THE MANIFEST, run as the real tool in a throwaway mini-repo: no entry for itself; the sidecar is the hash of the bytes written; verify passes; a second --update (after the clock has moved) is byte-identical;
 *      editing one file changes that file's entry (and the manifest's _meta) and no other entry; a hand-edited manifest fails the sidecar check.
 *   2. THE REAL TREE: the committed manifest has no self-entry and its sidecar matches it.
 *   3. THE GENERATORS give identical bytes on a second run: the migration, the derivation, the coverage/migration reports, and (as a process, under two different PYTHONHASHSEEDs) the Python compiler's output.
 *   4. SELF-REFERENCE SCAN over every tracked JSON artifact in ssot/, test_harness/ (top level), schema/ and legacy/: none holds a record that names its own path next to a hash, checksum or digest.
 *   5. SPLICE PATTERN SCAN over every generator and tool: none writes a file, hashes it, and writes the same file again with the hash in it (the bootstrap this found).
 *   6. NON-VACUITY (R-TEST-CANFAIL): the pre-fix tool (self-entry, restamp, three writes) fails parts 1, 4 and 5; a generator that stamps the time fails part 3's comparison; a self-entry and a bootstrap are each found by the scans.
 *
 * NOT COVERED (named): master_edit.js `stamp` writes `_last_updated` by design (it is a ledger of when Claude last changed the suite, not a derivation); the extract_modules.js copies are generated and untracked (R-SYSTEM-
 * SINGLEFILECOST names them); the running of splice_compiled.py's own two-seed check on btnyc.json is part 3's last line, as a process.
 * Node + python3. No network.
 */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { spawnSync } = require('child_process');
const REPO = path.resolve(__dirname, '..'), TH = __dirname;
const TOOL = path.join(TH, 'verify_file_integrity.js');
let passed = 0, failed = 0;
const check = (label, ok, detail) => { if (ok) { passed++; console.log('  ✓ ' + label); } else { failed++; console.log('  ✗ ' + label + (detail ? ' -- ' + String(detail).split('\n').slice(0, 6).join('\n      ') : '')); } };
const h16 = b => crypto.createHash('sha256').update(b).digest('hex').slice(0, 16);
const sleep = ms => { const t = Date.now(); while (Date.now() - t < ms); };
const toolSrc = fs.readFileSync(TOOL, 'utf8');

// ── a throwaway mini-repo around a given copy of the integrity tool ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function mkRepo(tool) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fixedpoint-')), th = path.join(root, 'test_harness');
  fs.mkdirSync(path.join(th, 'tools'), { recursive: true }); fs.mkdirSync(path.join(root, 'modules'));
  fs.writeFileSync(path.join(th, 'verify_file_integrity.js'), tool);
  fs.writeFileSync(path.join(th, 'verify_a.js'), "console.log('a');\n"); fs.writeFileSync(path.join(th, 'run_all.sh'), '#!/bin/sh\necho run\n'); fs.writeFileSync(path.join(th, 'tools', 'helper.js'), 'module.exports = 1;\n');
  const listed = ['verify_a.js', 'verify_file_integrity.js'];
  fs.writeFileSync(path.join(th, 'MASTER_TEST_SUITE.json'), JSON.stringify({ test_files: listed, test_hashes: Object.fromEntries(listed.map(n => [n, h16(fs.readFileSync(path.join(th, n)))])) }, null, 2));
  fs.writeFileSync(path.join(root, 'qr.html'), '<html></html>'); fs.writeFileSync(path.join(root, 'modules', 'm.js'), 'module.exports = 2;\n');
  return { root, th };
}
const run = (th, args) => { const r = spawnSync('node', ['verify_file_integrity.js', ...args], { cwd: th, encoding: 'utf8', env: Object.assign({}, process.env, { CLAUDE_SESSION_LABEL: 'TEST' }) }); return { code: r.status, out: (r.stdout || '') + (r.stderr || '') }; };
const read = (th, f) => fs.readFileSync(path.join(th, f), 'utf8');

// the part-1 questions, asked of any copy of the tool
function manifestFacts(tool) {
  const { root, th } = mkRepo(tool), F = {};
  run(th, ['--update']);
  const m1 = read(th, 'FILE_MANIFEST.json'), s1 = read(th, 'FILE_MANIFEST.json.sha256');
  const parsed = JSON.parse(m1);
  F.selfEntry = Object.prototype.hasOwnProperty.call(parsed, 'FILE_MANIFEST.json');
  F.sidecarIsHashOfBytes = s1.trim() === h16(Buffer.from(m1));
  F.verifies = run(th, []).code === 0;
  sleep(1200);                                                                  // the entries' clock is whole seconds: let it move
  run(th, ['--update']);
  const m2 = read(th, 'FILE_MANIFEST.json'), s2 = read(th, 'FILE_MANIFEST.json.sha256');
  F.secondRunIdentical = m1 === m2 && s1 === s2;
  // one file edited: only its entry (and _meta) may change
  sleep(1200);
  fs.writeFileSync(path.join(root, 'qr.html'), '<html>edited</html>');
  run(th, ['--update']);
  const m3 = JSON.parse(read(th, 'FILE_MANIFEST.json'));
  F.changed = Object.keys(m3).filter(k => k !== '_meta' && JSON.stringify(m3[k]) !== JSON.stringify(parsed[k]));
  // hand edit
  fs.writeFileSync(path.join(th, 'FILE_MANIFEST.json'), read(th, 'FILE_MANIFEST.json').replace('"qr.html"', '"qr.html" '));
  const v = run(th, []); F.handEditFails = v.code !== 0 && /SELF-CHECK MISMATCH/.test(v.out);
  fs.rmSync(root, { recursive: true, force: true });
  return F;
}

// ── scans ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const HASHY = /sha|hash|digest|checksum/i;
// a record that names the artifact's own path next to a hash: { path|file|name: <self>, sha256: .. } or { "<self>": { hash: .. } }
function selfRecords(relPath, json) {
  const self = relPath, base = path.basename(relPath), found = [];
  (function walk(v, trail) {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, trail + '[' + i + ']'));
    if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) {
        if ((k === self || k === base) && x && typeof x === 'object' && Object.keys(x).some(kk => HASHY.test(kk))) found.push(trail + '.' + k + ' (keyed by its own name, with a hash)');
        if (typeof x === 'string' && (x === self || x === base) && Object.keys(v).some(kk => HASHY.test(kk) && kk !== k)) found.push(trail + ' (names itself next to ' + Object.keys(v).filter(kk => HASHY.test(kk)).join(',') + ')');
        walk(x, trail + '.' + k);
      }
    }
  })(json, '$');
  return found;
}
// the bootstrap: write F, hash F, write F again (the second write puts the hash into the file it hashed)
function splicePatterns(text) {
  const out = [], re = /writeFileSync\(\s*([A-Za-z_][\w.]*)\s*,[^;]*;[\s\S]{0,700}?(?:sha256|hashOf|h16|sha)\(\s*\1\s*\)[\s\S]{0,700}?writeFileSync\(\s*\1\s*,/g;
  let m; while ((m = re.exec(text))) out.push(m[1]); return out;
}
const stripComments = t => t.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

console.log('verify_fixed_point.js');
console.log('\n1. The manifest, run as the real tool in a throwaway mini-repo');
const F = manifestFacts(toolSrc);
check('the manifest has no entry for itself (R-SYSTEM-UNBOUNDED)', F.selfEntry === false);
check('its sidecar FILE_MANIFEST.json.sha256 is the hash of the manifest exactly as written, and verify passes', F.sidecarIsHashOfBytes && F.verifies, JSON.stringify(F));
check('a second --update, a clock tick later, is byte-identical (manifest and sidecar): identical inputs, identical output', F.secondRunIdentical);
check('editing one file changes that file\'s entry and no other: ' + JSON.stringify(F.changed), F.changed.length === 1 && F.changed[0] === 'qr.html');
check('a hand-edited manifest fails the sidecar check', F.handEditFails);

console.log('\n2. The real tree');
{
  const m = JSON.parse(fs.readFileSync(path.join(TH, 'FILE_MANIFEST.json'), 'utf8')), side = fs.readFileSync(path.join(TH, 'FILE_MANIFEST.json.sha256'), 'utf8').trim();
  check('the committed manifest has no entry for itself', !Object.prototype.hasOwnProperty.call(m, 'FILE_MANIFEST.json'), 'FILE_MANIFEST.json is listed in itself');
  check('and its sidecar (' + side + ') is the hash of the committed bytes', side === h16(fs.readFileSync(path.join(TH, 'FILE_MANIFEST.json'))), side);
}

console.log('\n3. The generators give identical bytes on a second run');
{
  process.env.BTNYC_ROOT = REPO;
  const EF = path.join(TH, 'tools', 'entity_first'), lib = require(path.join(EF, 'lib.js'));
  const { migrate } = require(path.join(EF, 'migrate_legacy.js')), { derive } = require(path.join(EF, 'derive_graph.js')), report = require(path.join(EF, 'report.js'));
  const L = lib.readJson(lib.PATHS.legacy);
  const t1 = lib.toText(migrate(lib.clone(L)).source), t2 = lib.toText(migrate(lib.clone(L)).source);
  check('the migration: two runs, one text (' + t1.length + ' bytes)', t1 === t2 && t1.length > 1e5);
  const SRC = lib.readJson(lib.PATHS.source), txt = fs.readFileSync(lib.PATHS.source, 'utf8');
  const d1 = lib.toText(derive(lib.clone(SRC), txt)), d2 = lib.toText(derive(lib.clone(SRC), txt));
  check('the derivation: two runs, one text (' + d1.length + ' bytes)', d1 === d2 && d1.length > 1e5);
  const r1 = JSON.stringify(report.build()), r2 = JSON.stringify(report.build());
  check('the coverage and migration reports: two builds, identical', r1 === r2 && r1.length > 1e3);
  // iteration order: the same source with every object's keys written in reverse derives the same graph. The TEXT follows the author's key order by design (a person's source reads the way they wrote it), so the
  // comparison is of content: both graphs with every object's keys sorted. (This found a validator rule that compared an object's keys as an ordered list: fixed, validate_source.js V-COMPLEX-VOCAB.)
  const rev = o => Array.isArray(o) ? o.map(rev) : (o && typeof o === 'object') ? Object.fromEntries(Object.keys(o).reverse().map(k => [k, rev(o[k])])) : o;
  const canon = o => Array.isArray(o) ? o.map(canon) : (o && typeof o === 'object') ? Object.fromEntries(Object.keys(o).sort().map(k => [k, canon(o[k])])) : o;
  let reversed = null, reversedErr = null; try { reversed = derive(rev(lib.clone(SRC)), txt); } catch (e) { reversedErr = e.message; }
  check('and the derivation is a function of the source\'s content, not of the order its object keys were written in (every object reversed; compared with keys sorted)', reversed && JSON.stringify(canon(reversed)) === JSON.stringify(canon(JSON.parse(d1))), reversedErr || 'the graphs differ');
  const Vd = require(path.join(EF, 'validate_source.js')), rv = Vd.validate(rev(lib.clone(SRC)));
  check('and the validator accepts the key-reversed source (a rule that read an object\'s key order as meaning would reject it)', rv.errors.length === 0, rv.errors.slice(0, 2).map(e => e.code + ' ' + e.message).join('; '));
  // the Python compiler under two hash seeds, as a process: splice_compiled.py's own check 0 does exactly this, and a dry run writes nothing
  const before = fs.readFileSync(path.join(REPO, 'btnyc.json'));
  const p = spawnSync('python3', [path.join(TH, 'tools', 'splice_compiled.py'), path.join(REPO, 'btnyc.json')], { encoding: 'utf8', timeout: 240000 });
  check('the Python compiler (splice_compiled.py, dry run): exit 0, writes nothing, and its own two-seed check passes', p.status === 0 && Buffer.compare(before, fs.readFileSync(path.join(REPO, 'btnyc.json'))) === 0, (p.stdout || '').slice(-300) + (p.stderr || '').slice(-300));
  // non-vacuity: a generator that stamps the time is not a fixed point, and the comparison sees it
  const stamped = () => lib.toText(Object.assign(migrate(lib.clone(L)).source, { generated_at: String(process.hrtime.bigint()) }));
  check('a generator that stamps the time gives two different texts, and the comparison used above sees it', stamped() !== stamped());
}

console.log('\n4. Self-reference scan: no tracked JSON artifact holds a record of itself next to a hash');
{
  const scanDirs = [['ssot', true], ['test_harness', false], ['schema', false], ['legacy', false], ['.', false]];
  const files = [];
  for (const [d, rec] of scanDirs) {
    const dir = path.join(REPO, d); if (!fs.existsSync(dir)) continue;
    const walk = (x, depth) => fs.readdirSync(x, { withFileTypes: true }).forEach(e => { const p = path.join(x, e.name); if (e.isDirectory()) { if (rec && e.name !== 'node_modules') walk(p, depth + 1); } else if (/\.json$/.test(e.name) && fs.statSync(p).size < 5e7) files.push(path.relative(REPO, p)); });
    walk(dir, 0);
  }
  const uniq = [...new Set(files)].filter(f => !/node_modules|package-lock/.test(f));
  const hits = []; let scanned = 0;
  for (const f of uniq) { let j; try { j = JSON.parse(fs.readFileSync(path.join(REPO, f), 'utf8')); } catch (e) { continue; } scanned++; for (const h of selfRecords(f, j)) hits.push(f + ': ' + h); }
  check(`${scanned} tracked JSON artifacts scanned (ssot/, test_harness/, schema/, legacy/, the root): ${hits.length} self-referential record(s)`, scanned > 15 && hits.length === 0, hits.slice(0, 4).join('\n'));
  check('the scan can fail: a manifest-shaped artifact that lists itself with a hash is found', selfRecords('test_harness/FILE_MANIFEST.json', { 'FILE_MANIFEST.json': { hash: 'abc', lines: 1 } }).length === 1 && selfRecords('x/y.json', { files: [{ path: 'y.json', sha256: 'z' }] }).length === 1 && selfRecords('x/y.json', { files: [{ path: 'other.json', sha256: 'z' }] }).length === 0);
}

console.log('\n5. Splice pattern scan: no generator writes a file, hashes it, and writes it again');
{
  const sources = [];
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => { const p = path.join(d, e.name); if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'retired') walk(p); } else if (/\.js$/.test(e.name)) sources.push(p); });
  walk(TH); for (const f of fs.readdirSync(REPO).filter(f => /\.js$/.test(f))) sources.push(path.join(REPO, f));
  const hits = []; for (const f of sources) { const t = stripComments(fs.readFileSync(f, 'utf8')); for (const m of splicePatterns(t)) hits.push(path.relative(REPO, f) + ': ' + m); }
  const own = path.relative(REPO, __filename);
  const real = hits.filter(h => !h.startsWith(own + ':'));      // this file names the pattern in its own scanner
  check(`${sources.length} JavaScript files scanned: ${real.length} write-hash-write pattern(s)`, sources.length > 100 && real.length === 0, real.slice(0, 4).join('\n'));
  check('the scan can fail: it finds the bootstrap in a snippet that has it, and not in one that writes once', splicePatterns("fs.writeFileSync(P, a); const r = sha256(P); fs.writeFileSync(P, b);").length === 1 && splicePatterns("fs.writeFileSync(P, a); const r = sha256(P); fs.writeFileSync(Q + '.sha256', r);").length === 0);
}

console.log('\n6. Non-vacuity: the tool as it was before this fix fails the checks that guard it');
{
  // the pre-fix tool, rebuilt from the current one: the manifest lists itself, every entry is restamped, and the manifest is written three times
  let old = toolSrc
    .replace("const testFiles = walk(TEST_DIR).filter(f => f !== 'FILE_MANIFEST.json' && f !== 'FILE_MANIFEST.json.sha256'", "const testFiles = walk(TEST_DIR).filter(f => f !== 'FILE_MANIFEST.json.sha256'")
    .replace("const stamped = (name, result) =>", "const stamped0 = (name, result) =>")
    .replace("fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));\n    const finalManifestHash", "fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));\n    manifest['FILE_MANIFEST.json'] = { ...sha256(MANIFEST_PATH), label: 'File integrity manifest (self-referencing)', updated: NOW };\n    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));\n    const finalManifestHash");
  old = old.replace("const NOW = new Date().toISOString().slice(0, 19);", "const NOW = new Date().toISOString().slice(0, 19); const stamped = () => new Date().toISOString().slice(0, 19);");
  check('the pre-fix tool was reconstructed (the three edits applied)', old !== toolSrc && /File integrity manifest \(self-referencing\)/.test(old) && /const stamped = \(\) =>/.test(old));
  const G = manifestFacts(old);
  check('part 1 finds the pre-fix tool: it lists itself (' + G.selfEntry + ') and its second run differs (identical: ' + G.secondRunIdentical + ')', G.selfEntry === true && G.secondRunIdentical === false);
  check('part 1 also sees that an edit then restamps more than the one file (' + G.changed.length + ' entries changed)', G.changed.length > 1);
  check('part 4\'s scan finds the old manifest\'s shape (self-entry with a hash)', selfRecords('test_harness/FILE_MANIFEST.json', { 'FILE_MANIFEST.json': { hash: '67dfb9f8d12d456f', lines: 2507, bytes: 75269, label: 'File integrity manifest (self-referencing)' } }).length === 1);
  check('part 5\'s scan finds the old bootstrap in the old tool\'s text', splicePatterns(stripComments(old.replace("manifest['FILE_MANIFEST.json'] = { ...sha256(MANIFEST_PATH)", "const selfResult = sha256(MANIFEST_PATH);\n    manifest['FILE_MANIFEST.json'] = { ...selfResult"))).includes('MANIFEST_PATH'));
}

console.log(`\n[Fixed point: stable, reproducible, never self-referential] ${passed} passed, ${failed} failed (of ${passed + failed} checks)`);
process.exit(failed ? 1 : 0);
