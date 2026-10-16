#!/usr/bin/env node
/**
 * verify_file_integrity.js
 *
 * SYSTEMIC FIX: Ensures every project file AND every test harness file
 * matches its known-good checksum. This prevents two failure modes:
 *   1. Working on a stale/wrong version of a source file (qr.html, btnyc.json, etc.)
 *   2. Silently using a modified test file that produces misleading results
 *      (e.g. replacing verify_btnyc_v5_compiler.js content without detection)
 *
 * HOW TO UPDATE: When a file is intentionally changed, run:
 *   node test_harness/verify_file_integrity.js --update
 * This regenerates the manifest with current checksums.
 *
 * FILES TRACKED:
 *   - All source files in the project root (qr.html, btnyc.json, *.js, *.py)
 *   - All files in test_harness/ (verify_*.js, run_all.sh, FILE_MANIFEST.json, etc.)
 *
 * IMPORTANT: FILE_MANIFEST.json itself is tracked. Modifying it without
 * running --update causes the suite to fail, preventing silent manifest tampering.
 *
 * T174 (#202) -- A COUNT THAT DEPENDS ON TEST ORDER IS NOT A COUNT: on a fresh checkout this tool read 12 failures in one suite run and 10 in the next, on the same tree, because the manifest
 * listed files that scripts WRITE (test screenshots and reports, and the root copies extract_modules.js generates). Whether those existed, and what they held, when this test ran
 * depended on which tests had finished first. Two rules now, both stated where they are enforced:
 *   - GENERATED files are never manifest entries. --update skips them (and drops any an old manifest carried), verify fails a manifest that lists one. Their sources are tracked
 *     instead: qr.html, and now every file in modules/ (the root copies were a hash of a derivative).
 *   - OPERATOR-LOCAL files (an entry flagged `local_only` by --local-only=a,b, a flag --update only ever preserves, never invents) must match IF PRESENT and are reported, not counted,
 *     when this checkout does not have them. An unflagged entry that is absent is still a failure.
 *
 * T151 -- WHO IS THE AUTHORITY (the circularity this tool used to have): --update hashes whatever is on disk, and verify compared disk to that, so after any --update
 * verify passed by construction: it could catch drift BETWEEN an --update and the next verify, never "the whole set has drifted since Claude's last delivery". Now:
 *   - TEST files (verify_*.js|py, find_*.py in test_harness/) are verified against MASTER_TEST_SUITE.json's `test_hashes`, a file Claude writes at delivery. --update never
 *     reads that as input and NEVER writes it; and if any test file on disk disagrees with MASTER, --update still refreshes the manifest (accounting) but prints a loud
 *     warning and EXITS NON-ZERO, so it can no longer silently bless a locally edited or stale test.
 *   - every OTHER tracked file (root sources, harness utilities, meta files) is verified against FILE_MANIFEST.json exactly as before.
 *   - discovery is RECURSIVE for hashing (tools/, retired/ are covered; node_modules, RESULTS, __pycache__, .git are not), and tests are FLAT: a test-named file in any
 *     subdirectory other than retired/ is a failure, because the runner globs the top level only and such a test would never run.
 *   - residual trust boundary, stated: MASTER itself is the root of trust and is replaced only by a Claude delivery; verify prints its own hash so it can be compared with
 *     the one the delivery notes state. A local edit to MASTER followed by --update would still be absorbed.
 *   - options for sandboxes that lack some of the operator's local files: --keep-absent (preserve manifest entries for files not present here) and --exclude=a,b.
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const REPO_ROOT = path.dirname(__dirname);
const TEST_DIR = __dirname;
const MANIFEST_PATH = path.join(TEST_DIR, 'FILE_MANIFEST.json');

function sha256(filePath) {
    try {
        const content = fs.readFileSync(filePath);
        return {
            hash: crypto.createHash('sha256').update(content).digest('hex').slice(0, 16),
            lines: content.toString().split('\n').length,
            bytes: content.length
        };
    } catch (e) {
        return null;
    }
}

// Update mode: regenerate the manifest for all source + test harness files
// ---- T151: recursive discovery, test classification, MASTER access --------------------------------------------------------------------------------------------
const SKIP_DIRS = new Set(['node_modules', 'RESULTS', '__pycache__', '.git']);
function walk(dir, rel = '') {
    const out = [];
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const r = rel ? rel + '/' + e.name : e.name;
        if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) out.push(...walk(dir, r)); }
        else if (e.isFile()) out.push(r);
    }
    return out;
}
// T174 (#202): files a script writes. Never manifest entries (see the header). Kept in step with .gitignore and with extract_modules.js by verify_file_integrity_generated_outputs.js.
const GENERATED_ROOT_MODULES = ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js', 'UIRenderer.js', 'AppController.js', 'appReducer.js', 'store.js', 'cart_logic.js'];   // extract_modules.js writes these
const GENERATED_OUTPUTS = ['ui_test_report.json', 'state_mutation_classification.json', 'smoke_test_result.json', 'SWEEP_RESULTS.json'];                                              // tests write these
// A DERIVED record is a file a test rewrites from the sources AND the repository tracks on purpose (it is read by people, not by the harness): purity_audit.json is verify_purity_audit.js's by-product of qr.html. Same rule as above
// (T174, found committing #204: the suite rewrote it after the manifest was refreshed, and the integrity check called the rewrite "modified outside test suite"), but git-tracked, so it is not in .gitignore.
const DERIVED_TRACKED_OUTPUTS = ['purity_audit.json'];
const isGenerated = f => GENERATED_ROOT_MODULES.includes(f) || GENERATED_OUTPUTS.includes(path.basename(f)) || DERIVED_TRACKED_OUTPUTS.includes(path.basename(f)) || /^failure_.*\.png$/.test(path.basename(f));
const localOnlyFlag = new Set(((process.argv.find(a => a.startsWith('--local-only=')) || '').slice('--local-only='.length)).split(',').filter(Boolean));
const isTestName = f => /^verify_.*\.(js|py)$/.test(path.basename(f)) || /^find_.*\.py$/.test(path.basename(f));
const isRunnerTest = f => isTestName(f) && !f.includes('/');           // only top-level tests run; retired/ keeps its tests but they are not part of the suite
const excludedByFlag = new Set(((process.argv.find(a => a.startsWith('--exclude=')) || '').slice('--exclude='.length)).split(',').filter(Boolean));
function readMaster() { const p = path.join(TEST_DIR, 'MASTER_TEST_SUITE.json'); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; }

if (process.argv.includes('--update')) {
    const existing = fs.existsSync(MANIFEST_PATH)
        ? JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
        : {};

    // v9.6+ FIX: this tool can only ever compare "current disk state" against
    // "whatever the manifest last said" -- it has no way to know whether the
    // manifest ITSELF is trustworthy, i.e. whether it reflects Claude's real,
    // current sandbox state or a stale local copy. Confirmed directly this
    // silently defeats the whole safeguard: running --update always succeeds
    // by definition (it just re-hashes whatever's on disk right now), so a
    // local file that's genuinely stale relative to Claude's sandbox produces
    // a manifest that "passes" against itself. Real, concrete case that
    // surfaced this: verify_confidence_gated_tags.js was fixed in an earlier
    // session (T77) but a stale, pre-fix local copy was never actually
    // overwritten -- --update ran anyway and produced a manifest that
    // "matched," masking the gap until the test itself threw at runtime.
    // This doesn't prevent that -- it can't, since it has no access to
    // Claude's sandbox -- but it makes the moment of overwriting a
    // Claude-sourced manifest LOUD and deliberate instead of silent, so the
    // operator has to consciously confirm they've actually synced first
    // rather than running this as an unconsidered, routine habit.
    if (existing._meta && existing._meta.generated_by === 'Claude sandbox') {
        console.log('\n⚠️  WARNING: the current manifest was last generated by Claude');
        console.log(`    (session: ${existing._meta.session_label || 'unknown'}, at ${existing._meta.timestamp || 'unknown time'}).`);
        console.log('    Running --update now will overwrite it with checksums of');
        console.log('    whatever is CURRENTLY on this disk -- if any file here is');
        console.log('    stale relative to what Claude actually has, that gap becomes');
        console.log('    invisible to every future test run, not caught by it.');
        console.log('    Only proceed if you have just downloaded/synced ALL of');
        console.log("    Claude's latest files, or made deliberate, local-only edits.\n");
    }

    const manifest = {};
    // R-INVARIANT-FIXEDPOINT / R-SYSTEM-UNBOUNDED (T180 6/n): identical inputs give a byte-identical manifest. An entry's `updated` moves only when that file's content did, so a second --update
    // on an unchanged tree writes the same bytes (it used to restamp all ~325 entries every run: a diff of the whole file on every commit, and output that drifted on a second run).
    const NOW = new Date().toISOString().slice(0, 19);
    const stamped = (name, result) => (existing[name] && existing[name].hash === result.hash && existing[name].updated) ? existing[name].updated : NOW;

    // Source files in REPO_ROOT.
    // v9.6+ FIX (2026-08-28 recovery session): was a fixed 12-item list --
    // confirmed directly this silently DROPS every other real, currently-
    // tracked root file (TIMELINE.md, btnyc.py, appReducer.js, store.js,
    // PROJECT_GOALS, and more) from the manifest the moment anyone runs
    // --update, since verify mode below iterates whatever's actually IN
    // the manifest (checking either location for each name) but update
    // mode only ever wrote back this narrow list -- a real, silent,
    // permanent coverage loss built into this tool's own maintenance
    // path, the exact class of bug this project's whole test culture
    // exists to catch elsewhere. Fixed by unioning the known baseline
    // with every root-level name already tracked in the existing
    // manifest, so --update preserves coverage instead of narrowing it.
    const existingRootNames = Object.keys(existing).filter(name =>
        name !== 'FILE_MANIFEST.json' && !isGenerated(name) &&
        !fs.existsSync(path.join(TEST_DIR, name)) &&
        fs.existsSync(path.join(REPO_ROOT, name))
    );
    const sourceFiles = [...new Set([
        'qr.html', 'btnyc.json', 'schema/btnyc_schema.json',
        'cms_bridge.js',
        ...(fs.existsSync(path.join(REPO_ROOT, 'modules')) ? walk(path.join(REPO_ROOT, 'modules')).map(f => 'modules/' + f) : []),   // T174 (#202): the SOURCES of the modules extract_modules.js generates

        'btnyc_v10_compiler.py', 'btnyc_v8_compiler.py', 'btnyc_v7_compiler.py', 'btnyc_master_deprecated.py',
        // v9.6+ FIX (2026-08-28 recovery session): these 7 real,
        // hand-maintained source files existed but were never tracked at
        // all, even before today's fix -- confirmed each is genuinely
        // static (no script writes to any of them, unlike
        // smoke_test_result.json/state_mutation_classification.json,
        // which correctly stay untracked because they regenerate every
        // run and a checksum "mismatch" would be meaningless noise for
        // those two specifically).
        // v9.6+ FIX: same class of gap as the one this hardcoded list
        // already exists to fix -- a brand-new reference file
        // (COMPONENT_LAYER_MAP.md) was created and did NOT get picked up
        // by --update automatically, since it's neither in the existing
        // manifest nor in this hardcoded list. Added directly. Honest
        // limitation, not fully closed: this same gap will recur for any
        // future new reference file until this list is updated again --
        // a fully general fix would need --update to discover new,
        // untracked .md/root-level files itself rather than rely on a
        // hardcoded list at all, which is real, separate, future work.
        'CHANGELOG_v9_5_divergence_resolution.md', 'OBJECTIVES_', 'PROJECT_GOALS',
        'COMPONENT_LAYER_MAP.md',
        'dumb_ui_prototype.html', 'qr_loader.js', 'innerhtml_audit.json',
        ...existingRootNames,
    ])].filter(n => !isGenerated(n));
    for (const name of sourceFiles) {
        const filePath = path.join(REPO_ROOT, name);
        if (!fs.existsSync(filePath)) continue;
        const result = sha256(filePath);
        const label = (existing[name] || {}).label || name;
        manifest[name] = { hash: result.hash, lines: result.lines, bytes: result.bytes, label, updated: stamped(name, result), ...(((existing[name] || {}).local_only || localOnlyFlag.has(name)) ? { local_only: true } : {}) };
        console.log(`  [src]  ${name}: ${result.hash} (${result.lines} lines)`);
    }

    // All files in test_harness/
    // v9.6+ FIX: exclude the sidecar file itself from regular tracking -- it
    // is verification machinery (checked directly via the self-check above),
    // not a source/test file. Tracking it as a normal entry recreates the
    // exact same fixed-point problem one level removed: its content changes
    // the moment it's rewritten after this loop already recorded its
    // pre-rewrite hash. Confirmed directly this was a real, live issue --
    // verify mode failed on it immediately after a fresh --update.
    const testFiles = walk(TEST_DIR).filter(f => f !== 'FILE_MANIFEST.json' && f !== 'FILE_MANIFEST.json.sha256' && !excludedByFlag.has(f) && !isGenerated(f));   // the manifest does not list itself (R-SYSTEM-UNBOUNDED); its sidecar holds its hash   // T151: recursive (was readdirSync of the top level only)
    for (const fname of testFiles) {
        const filePath = path.join(TEST_DIR, fname);
        const result = sha256(filePath);
        const label = (existing[fname] || {}).label || fname;
        manifest[fname] = { hash: result.hash, lines: result.lines, bytes: result.bytes, label, updated: stamped(fname, result), ...(isRunnerTest(fname) ? { authority: 'MASTER_TEST_SUITE.json' } : {}) };   // T151: a test's hash here is accounting only; MASTER is the authority
        console.log(`  [test] ${fname}: ${result.hash}`);
    }

    if (process.argv.includes('--keep-absent')) {   // T151: a sandbox that lacks some of the operator's local files must not silently drop their entries
        for (const name of Object.keys(existing)) { if (name === 'FILE_MANIFEST.json' || name === '_meta' || manifest[name] || isGenerated(name)) continue; manifest[name] = { ...existing[name], ...(localOnlyFlag.has(name) ? { local_only: true } : {}) }; console.log(`  [kept] ${name} (not present here; entry preserved verbatim)`); }
    }
    // _meta is provenance, not a tracked file. It records the last CHANGE: when nothing in the manifest changed, the previous _meta stands, so a second --update on an unchanged tree
    // writes the same bytes (R-INVARIANT-FIXEDPOINT).
    const sameEntries = JSON.stringify(manifest) === JSON.stringify(Object.fromEntries(Object.entries(existing).filter(([k]) => k !== '_meta')));
    if (sameEntries && existing._meta) manifest._meta = existing._meta;
    else if (process.env.CLAUDE_SESSION_LABEL) {
        manifest._meta = {
            generated_by: 'Claude sandbox',
            session_label: process.env.CLAUDE_SESSION_LABEL,
            timestamp: new Date().toISOString(),
        };
    }

    // The manifest does NOT list itself (R-SYSTEM-UNBOUNDED: no generated artifact may use its own mutable contents as an input to a value written back into those contents). It used to: an
    // entry for FILE_MANIFEST.json was written, which changed the file, which made the entry stale, which was patched by a second and a third write that could not converge ("Not solved here").
    // Its integrity value is the sidecar, FILE_MANIFEST.json.sha256: the hash of the manifest exactly as written, in a file that does not contain itself, so there is no fixed point to find.
    // One write, then one hash of those bytes.
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    const finalManifestHash = sha256(MANIFEST_PATH);
    fs.writeFileSync(MANIFEST_PATH + '.sha256', finalManifestHash.hash + '\n');
    console.log(`\nManifest written: ${Object.keys(manifest).length} files tracked`);
    // T151: --update refreshed the manifest (accounting). It must not be able to bless drift in a TEST file: MASTER (never written here) is the authority for those.
    {
        const master = readMaster(), disagree = [];
        if (!master) disagree.push('MASTER_TEST_SUITE.json is missing');
        else for (const tname of master.test_files) {
            const r = sha256(path.join(TEST_DIR, tname)), want = (master.test_hashes || {})[tname];
            if (!r) disagree.push(`${tname}: absent on disk`);
            else if (!want) disagree.push(`${tname}: MASTER records no hash for it`);
            else if (r.hash !== want) disagree.push(`${tname}: on disk ${r.hash}, but MASTER expects ${want}`);
        }
        if (disagree.length) {
            console.log(`\n\u26a0  --update DID NOT BLESS ${disagree.length} TEST FILE(S). The manifest was refreshed, MASTER_TEST_SUITE.json was NOT touched, and these disagree with MASTER:`);
            disagree.slice(0, 40).forEach(d => console.log('     - ' + d));
            console.log('    Each is a test file edited locally or stale relative to the version Claude shipped. Restore the delivered file (or take a new delivery);');
            console.log('    this tool will not rebaseline test content, because that would make the drift invisible to every future run.\n');
            process.exit(1);
        }
    }
    process.exit(0);
}

// Verify mode
if (!fs.existsSync(MANIFEST_PATH)) {
    console.error('FILE_MANIFEST.json not found. Run: node test_harness/verify_file_integrity.js --update');
    process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
let pass = 0, fail = 0;

console.log('\n=== File integrity verification ===');

// v9.6+ FIX: genuine self-verification via the sidecar written above --
// this actually checks what the manifest's own docstring always claimed to
// (tampering protection), which the per-file loop below cannot do for this
// one file without circularity.
const sidecarPath = MANIFEST_PATH + '.sha256';
if (fs.existsSync(sidecarPath)) {
    const expectedSelfHash = fs.readFileSync(sidecarPath, 'utf8').trim();
    const actualSelfHash = sha256(MANIFEST_PATH).hash;
    if (expectedSelfHash === actualSelfHash) {
        console.log(`  ✓ FILE_MANIFEST.json [self-check via sidecar: ${actualSelfHash}]`);
        pass++;
    } else {
        console.log('  ✗ FILE_MANIFEST.json: SELF-CHECK MISMATCH (edited outside --update?)');
        console.log(`    Expected: ${expectedSelfHash}`);
        console.log(`    Found:    ${actualSelfHash}`);
        fail++;
    }
} else {
    console.log('  (no FILE_MANIFEST.json.sha256 sidecar found -- run --update once to create it)');
}

// T134 FIX, direct operator feedback: FILE_MANIFEST.json tracks
// checksums (content drift) but "loses its memory after more than one
// update command" for *membership* drift -- it has no concept of "this
// test used to exist and is now silently gone," since --update simply
// re-snapshots whatever's currently on disk. Relying on run_all.sh's
// own glob discovery (verify_*.js/py, find_*.py) doesn't catch this
// either -- a glob only reports what IS there, never what's missing
// relative to what SHOULD be there. MASTER_TEST_SUITE.json is the
// separate, deliberately-static source of truth this needs: updated
// only in the same turn a test is genuinely added or removed, never
// on a routine run, so a real gap in either direction fails loudly
// here instead of a suite silently running fewer tests than it should.
console.log('\n=== Master test-suite membership and content check ===');
{
    const masterPath = path.join(TEST_DIR, 'MASTER_TEST_SUITE.json');
    if (!fs.existsSync(masterPath)) {
        console.log('  \u2717 MASTER_TEST_SUITE.json is missing entirely -- cannot verify test-suite membership or content at all.');
        fail++;
    } else {
        const masterRaw = JSON.parse(fs.readFileSync(masterPath, 'utf8'));
        const master = new Set(masterRaw.test_files);
        const actual = new Set(fs.readdirSync(TEST_DIR).filter(f => fs.statSync(path.join(TEST_DIR, f)).isFile() && isTestName(f)));
        const missing = [...master].filter(f => !actual.has(f));
        const unlisted = [...actual].filter(f => !master.has(f));
        if (missing.length === 0 && unlisted.length === 0) {
            console.log(`  \u2713 all ${master.size} tests in MASTER_TEST_SUITE.json are present on disk, and none on disk are unlisted`);
            pass++;
        } else {
            if (missing.length > 0) {
                console.log(`  \u2717 ${missing.length} test(s) listed in MASTER_TEST_SUITE.json are MISSING from test_harness/:`);
                missing.forEach(f => console.log(`      - ${f}`));
                fail++;
            }
            if (unlisted.length > 0) {
                console.log(`  \u2717 ${unlisted.length} test(s) exist in test_harness/ but are NOT in MASTER_TEST_SUITE.json (silently running, unacknowledged):`);
                unlisted.forEach(f => console.log(`      - ${f}`));
                console.log(`      -> If genuinely new and intentional, add to MASTER_TEST_SUITE.json's test_files array in this same change.`);
                fail++;
            }
        }
        // T151: tests are FLAT. The runner globs the top level only, so a test anywhere else (retired/ excepted) would never run.
        const strays = walk(TEST_DIR).filter(f => f.includes('/') && isTestName(f) && !f.startsWith('retired/'));
        if (strays.length === 0) { console.log('  \u2713 no test file hides in a subdirectory (retired/ excepted): every test is one the runner will find'); pass++; }
        else { console.log(`  \u2717 ${strays.length} test-named file(s) live in a subdirectory, where the runner never looks:`); strays.forEach(f => console.log(`      - ${f}`)); fail++; }
        // T151: CONTENT. MASTER's test_hashes are written by Claude at delivery; --update never reads or writes them.
        const hashes = masterRaw.test_hashes;
        if (!hashes || typeof hashes !== 'object') {
            console.log('  \u2717 MASTER_TEST_SUITE.json has no test_hashes: test CONTENT is unverified (a Claude delivery stamps it).');
            fail++;
        } else {
            const noHash = [...master].filter(t => !hashes[t]), orphan = Object.keys(hashes).filter(t => !master.has(t));
            const bad = []; let okN = 0;
            for (const tname of master) {
                const r = sha256(path.join(TEST_DIR, tname));
                if (!r || !hashes[tname]) continue;   // absence and missing hashes are reported separately
                if (r.hash === hashes[tname]) okN++; else bad.push({ tname, want: hashes[tname], got: r.hash, lines: r.lines });
            }
            if (noHash.length === 0 && orphan.length === 0 && bad.length === 0) {
                console.log(`  \u2713 all ${okN} test files match the content hashes MASTER_TEST_SUITE.json records (the authority for test content)`);
                pass++;
            } else {
                if (noHash.length) { console.log(`  \u2717 ${noHash.length} listed test(s) have NO recorded hash in MASTER: ${noHash.slice(0, 8).join(', ')}`); fail++; }
                if (orphan.length) { console.log(`  \u2717 ${orphan.length} hash(es) in MASTER belong to no listed test: ${orphan.slice(0, 8).join(', ')}`); fail++; }
                if (bad.length) {
                    console.log(`  \u2717 ${bad.length} test file(s) DIFFER from the version MASTER says Claude shipped:`);
                    bad.slice(0, 40).forEach(b => console.log(`      - ${b.tname}: expected ${b.want}, found ${b.got} (${b.lines} lines)`));
                    console.log('      -> edited locally or stale. Restore the delivered file; --update will refuse to bless it.');
                    fail++;
                }
            }
        }
        console.log(`  (MASTER_TEST_SUITE.json itself: ${sha256(masterPath).hash} -- compare with the value the delivery notes state; a local edit to MASTER is the one thing this tool cannot see)`);
    }
}

// FORBIDDEN FILE CHECK: test_harness/qr.html must not exist.
// If present, it is the original uploaded base file (hash b0676cb8) with all
// unfixed bugs -- commented-out click handlers, missing grid class, no T62 fixes.
// Opening it instead of the root qr.html is the cause of tiles appearing dead
// and groups showing in single-column layout. DELETE this file if it exists.
const forbiddenPath = path.join(TEST_DIR, 'qr.html');
if (fs.existsSync(forbiddenPath)) {
    console.log('\n  ✗ FORBIDDEN FILE FOUND: test_harness/qr.html');
    console.log('    This is the original uploaded base file with unfixed bugs.');
    console.log('    It must be DELETED. The working file is the ROOT qr.html.');
    console.log('    Run: rm test_harness/qr.html');
    fail++;
}

// T174 (#202): the manifest may not list a file a script writes. Its presence and content when this test runs depend on which tests ran first, so the count would be a function of
// test order, not of the tree (a clean checkout read 12 in one suite run and 10 in the next). --update never writes such an entry; this fails one that arrived another way.
{
    const listed = Object.keys(manifest).filter(n => n !== '_meta' && isGenerated(n));
    if (listed.length === 0) { console.log('\n  \u2713 the manifest lists no generated file (nothing here depends on which tests ran first)'); pass++; }
    else { console.log(`\n  \u2717 the manifest lists ${listed.length} file(s) a script writes, so this count would depend on test order (#202): ${listed.join(', ')}`); console.log('      -> run: node test_harness/verify_file_integrity.js --update --keep-absent   (it drops them)'); fail++; }
}
let localOnlyAbsent = 0;

for (const [name, expected] of Object.entries(manifest)) {
    // FILE_MANIFEST.json is the source of truth -- it cannot verify itself
    // without circularity. Skip it in the per-file loop.
    if (name === 'FILE_MANIFEST.json') continue;
    // _meta is provenance metadata (see the --update warning logic above),
    // not a tracked file -- skip it here too.
    if (name === '_meta') continue;
    if (isRunnerTest(name)) continue;   // T151: a runner test's authority is MASTER_TEST_SUITE.json (checked above); the manifest's copy of its hash is accounting only
    if (isGenerated(name)) continue;    // T174 (#202): reported once, above, as a failure of the manifest; not read as a file
    // Determine the file path: test_harness/ files or REPO_ROOT files
    const inTestDir = fs.existsSync(path.join(TEST_DIR, name));
    const inRepoRoot = fs.existsSync(path.join(REPO_ROOT, name));
    const filePath = inTestDir ? path.join(TEST_DIR, name) : path.join(REPO_ROOT, name);

    const actual = sha256(filePath);
    if (!actual) {
        if (expected.local_only) { localOnlyAbsent++; console.log(`  \u00b7 ${name}: operator-local, not in this checkout (not counted; it is checked wherever it exists)`); continue; }   // T174 (#202)
        console.log(`  ✗ ${name}: FILE MISSING`);
        fail++;
        continue;
    }
    if (actual.hash === expected.hash) {
        console.log(`  ✓ ${name} [${expected.hash}]`);
        pass++;
    } else {
        console.log(`  ✗ ${name}: CHECKSUM MISMATCH`);
        console.log(`    Expected: ${expected.hash} (${expected.label || name}, ${expected.lines} lines)`);
        console.log(`    Found:    ${actual.hash} (${actual.lines} lines)`);
        console.log(`    → File modified outside test suite.`);
        console.log(`      Intentional change: run 'node test_harness/verify_file_integrity.js --update'`);
        console.log(`      Unintentional: restore the correct version.`);
        fail++;
    }
}

console.log(`\n[File integrity] ${pass} passed, ${fail} failed (of ${pass + fail} files checked)${localOnlyAbsent ? `; ${localOnlyAbsent} operator-local file(s) not in this checkout, not counted` : ''}\n`);
process.exit(fail > 0 ? 1 : 0);
