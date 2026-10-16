#!/usr/bin/env node
/**
 * verify_legacy_archive.js -- the Operator's older files are kept whole in legacy/, and nothing live reads them (T180).
 *
 * @enforces R-TEST-CANFAIL
 * @detects DEFECT-TEST-CANTFAIL
 *
 * WHY THIS TEST EXISTS. On 2026-10-16 the Operator asked that the legacy files, side projects and documents written over the years, mostly in the repository root, be retained, in a legacy branch
 * or an archive. 58 of them were moved to legacy/ (the whole pre-move tree is the branch `legacy-archive`). A move is only a retention if nothing was dropped or changed on the way, and it is only a
 * tidy-up if the old catalogs and pages cannot quietly become a second source the system reads (the Charter allows one source of business truth). Neither is visible in a diff of 58 renames.
 *
 * WHAT THIS HOLDS.
 *   1. RETENTION. legacy/INDEX.json lists every moved file with its sha256; each is at its new path with the same bytes, and none is also still at the old root path (a copy would be two of them).
 *   2. COMPLETENESS. A file under legacy/ that INDEX.json does not list is reported (never silent), not failed: adding to the archive later is allowed.
 *   3. THE SNAPSHOT. Where the snapshot commit the index names is in this clone, every original path at that commit has the indexed sha256 (the move changed no byte, and the pre-move tree is whole).
 *      A clone without that commit says so and counts it as an environment gap, not a pass.
 *   4. NO LIVE READER. No page, module, service worker, manifest, bridge or production tool names legacy/ or a moved file as something to load.
 *   5. NON-VACUITY (R-TEST-CANFAIL). The same checks find a deleted file, a changed byte, a copy left at the root, and a runtime file that loads from legacy/.
 */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
let pass = 0, fail = 0, gap = 0;
const ok = m => { pass++; console.log('  ✓ ' + m); };
const bad = (m, d) => { fail++; console.log('  ✗ ' + m + (d ? '\n      ' + String(d).split('\n').join('\n      ') : '')); };
const check = (c, okMsg, badMsg, d) => (c ? ok(okMsg) : bad(badMsg || okMsg, d));

// The files whose job is to load things at run time. Documents, tests and the register name old files in prose and are not readers.
const RUNTIME = ['qr.html', 'index.html', 'cat.html', 'contact.html', 'cms_bridge.js', 'sw.js', 'manifest.json', 'trace.js', 'state.js'];
function runtimeFiles(dir) {
    const out = RUNTIME.filter(f => fs.existsSync(path.join(dir, f))).map(f => f);
    for (const sub of ['modules', 'test_harness/tools/entity_first']) {
        const d = path.join(dir, sub);
        if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) if (/\.js$/.test(f)) out.push(path.join(sub, f));
    }
    return out;
}

// 1-2: retention, from the index and the files
function retentionProblems(dir) {
    const probs = [], notes = [];
    const ip = path.join(dir, 'legacy', 'INDEX.json');
    if (!fs.existsSync(ip)) return { probs: ['legacy/INDEX.json is missing'], notes };
    let idx; try { idx = JSON.parse(fs.readFileSync(ip, 'utf8')); } catch (e) { return { probs: ['legacy/INDEX.json does not parse: ' + e.message], notes }; }
    if (!Array.isArray(idx.files) || !idx.files.length) return { probs: ['legacy/INDEX.json lists no files'], notes };
    const listed = new Set();
    for (const e of idx.files) {
        listed.add(e.path);
        const p = path.join(dir, e.path);
        if (!fs.existsSync(p)) { probs.push(`${e.original_path}: missing from ${e.path}`); continue; }
        const b = fs.readFileSync(p);
        if (sha(b) !== e.sha256) probs.push(`${e.path}: bytes differ from the index (sha256 ${sha(b).slice(0, 12)}…, indexed ${e.sha256.slice(0, 12)}…)`);
        if (b.length !== e.bytes) probs.push(`${e.path}: ${b.length} bytes, indexed ${e.bytes}`);
        if (fs.existsSync(path.join(dir, e.original_path))) probs.push(`${e.original_path}: still at the root as well as in legacy/ (a copy is two files, not one move)`);
    }
    const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(x => x.isDirectory() ? walk(path.join(d, x.name)) : [path.relative(dir, path.join(d, x.name))]);
    const unlisted = walk(path.join(dir, 'legacy')).filter(f => !['legacy/INDEX.json', 'legacy/README.md'].includes(f) && !listed.has(f));
    if (unlisted.length) notes.push(`${unlisted.length} file(s) under legacy/ are not in INDEX.json (allowed, reported): ${unlisted.slice(0, 5).join(', ')}${unlisted.length > 5 ? '…' : ''}`);
    return { probs, notes, idx };
}

// 4: no live reader
function readerProblems(dir, idx) {
    const names = idx.files.map(e => e.original_path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    // a moved file named as a thing to load: after a quote, a slash or a parenthesis, before a quote, a query or a hash. Longer names that merely end the same way (new_services.json) do not match.
    const named = new RegExp('[\'"`/(](' + names.join('|') + ')(?=[\'"`?#)\\s])');
    const under = /legacy\/(catalogs|pages|qqb)\//;
    const probs = [];
    for (const f of runtimeFiles(dir)) {
        const t = fs.readFileSync(path.join(dir, f), 'utf8');
        const m = t.match(under) || t.match(named);
        if (m) probs.push(`${f} names ${m[0].replace(/^['"`/(]/, '')} (a runtime file must not load from the archive)`);
    }
    return probs;
}

// 3: the snapshot
function snapshotProblems(dir, idx) {
    const c = idx.snapshot_commit;
    try { execFileSync('git', ['-C', dir, 'cat-file', '-e', c + '^{commit}'], { stdio: 'ignore' }); } catch (e) { return { gap: `snapshot commit ${String(c).slice(0, 10)} is not in this clone (a shallow or partial clone); fetch full history to check it` }; }
    const probs = [];
    for (const e of idx.files) {
        let b; try { b = execFileSync('git', ['-C', dir, 'cat-file', 'blob', `${c}:${e.original_path}`], { maxBuffer: 1 << 28 }); } catch (err) { probs.push(`${e.original_path}: not in the snapshot commit`); continue; }
        if (sha(b) !== e.sha256) probs.push(`${e.original_path}: the index's sha256 is not the snapshot's`);
    }
    return { probs };
}

function tmpTree(label, setup) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-' + label + '-'));
    const mk = (rel, content) => { const p = path.join(dir, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content); };
    const files = [['a.json', '{"a":1}\n', 'catalogs'], ['b.html', '<html><title>b</title></html>', 'pages'], ['c.py', 'print(1)\n', 'qqb']];
    const idx = { snapshot_commit: '0'.repeat(40), files: files.map(([n, c, cat]) => ({ original_path: n, path: `legacy/${cat}/${n}`, category: cat, sha256: sha(Buffer.from(c)), bytes: Buffer.byteLength(c) })) };
    for (const [n, c, cat] of files) mk(`legacy/${cat}/${n}`, c);
    mk('legacy/INDEX.json', JSON.stringify(idx)); mk('legacy/README.md', 'x'); mk('qr.html', '<script src="modules/store.js"></script>');
    mk('modules/store.js', 'var x = 1;');
    if (setup) setup(dir, mk);
    return dir;
}

console.log('verify_legacy_archive.js');
console.log('\n1-2. Retention');
const live = retentionProblems(ROOT);
check(live.probs.length === 0, `legacy/INDEX.json lists ${live.idx ? live.idx.files.length : 0} files; each is at its new path with the indexed bytes and none is also left at the root`, 'the archive does not hold what its index says', live.probs.join('\n'));
for (const n of live.notes) console.log('     (' + n + ')');
if (live.idx) {
    const cats = {}; for (const e of live.idx.files) cats[e.category] = (cats[e.category] || 0) + 1;
    check(Object.keys(cats).sort().join() === 'catalogs,pages,qqb', `three groups: ${Object.entries(cats).map(([k, v]) => k + ' ' + v).join(', ')}`, 'unexpected groups in the index', JSON.stringify(cats));
    check(live.idx.files.every(e => e.path === `legacy/${e.category}/${e.original_path}`), 'every file keeps its name; only the folder changed', 'a moved file was renamed');

    console.log('\n3. The snapshot');
    const snap = snapshotProblems(ROOT, live.idx);
    if (snap.gap) { gap++; console.log('  ~ environment gap, NOT a pass: ' + snap.gap); }
    else check(snap.probs.length === 0, `every indexed file has the same sha256 at snapshot commit ${live.idx.snapshot_commit.slice(0, 10)} (the move changed no byte)`, 'the index disagrees with the snapshot', snap.probs.join('\n'));

    console.log('\n4. No live reader');
    const rp = readerProblems(ROOT, live.idx);
    check(rp.length === 0, `${runtimeFiles(ROOT).length} runtime files (pages, modules, bridge, service worker, manifest, entity-first tools) name nothing in legacy/ and none of the ${live.idx.files.length} moved files`, 'a runtime file reads the archive', rp.join('\n'));
}

console.log('\n5. Non-vacuity: the same checks find five broken trees');
const cases = [
    ['a deleted archive file', d => fs.unlinkSync(path.join(d, 'legacy/pages/b.html')), d => retentionProblems(d).probs, /missing from legacy\/pages\/b\.html/],
    ['a changed byte', d => fs.appendFileSync(path.join(d, 'legacy/catalogs/a.json'), ' '), d => retentionProblems(d).probs, /bytes differ from the index/],
    ['a copy left at the root', (d, mk) => mk('c.py', 'print(1)\n'), d => retentionProblems(d).probs, /still at the root as well as in legacy\//],
    ['a page that loads from the archive', (d, mk) => mk('qr.html', '<script>fetch("legacy/catalogs/a.json")</script>'), d => readerProblems(d, retentionProblems(d).idx), /must not load from the archive/],
    ['a module that fetches a moved file by name', (d, mk) => mk('modules/store.js', 'fetch("/a.json")'), d => readerProblems(d, retentionProblems(d).idx), /must not load from the archive/],
];
check(retentionProblems(tmpTree('ok')).probs.length === 0 && readerProblems(tmpTree('ok2'), retentionProblems(tmpTree('ok3')).idx).length === 0, 'the checks accept an intact synthetic tree', 'the checks reject an intact tree (they would fail everything)');
for (const [name, setup, run, expect] of cases) {
    const dir = tmpTree('m', setup);
    try { const p = run(dir); check(p.length > 0 && expect.test(p.join('\n')), `${name}: found (${(p[0] || '').slice(0, 70)})`, `${name}: NOT found, the test cannot fail here`, p.join('\n')); }
    finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

console.log(`\n[Legacy archive] ${pass} passed, ${fail} failed${gap ? `, ${gap} environment gap(s) reported` : ''}`);
process.exit(fail ? 1 : 0);
