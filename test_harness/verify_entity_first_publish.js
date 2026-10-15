#!/usr/bin/env node
/**
 * verify_entity_first_publish.js -- the published artifact can be refused, for every gate, and a consumer can refuse a mismatched one (T177; R-TEST-CANFAIL, R-SYSTEM-INDEXPROXY, R-INVARIANT-FROZEN, P-SYSTEM-VERSIONS).
 *
 * @enforces R-TEST-CANFAIL
 * @enforces R-SYSTEM-INDEXPROXY
 * @enforces R-INVARIANT-FROZEN
 * @enforces R-INVARIANT-DERIVATION
 * @enforces R-SYSTEM-DUALSOURCE
 * @detects DEFECT-TEST-CANTFAIL
 * @detects DEFECT-FROZEN-INTERFACE
 * @detects DEFECT-DERIVED-AUTHORITY
 * @detects DEFECT-SILENT-SKIP
 *
 * THE DEFECT-SHAPE. The derived artifact is what a runtime module would read instead of the authored source. If publishing can succeed on a source that does not validate, on an artifact that has quietly
 * gained a section of the authored source, on an index no module reads, on bytes that differ from what the source derives (stale, hand-edited, missing), or on versions a consumer was not built for, then
 * the artifact is an authority nobody checked -- and a consumer that trusts it has no way to refuse a mismatched one.
 *
 * WHAT IS HELD.
 *   1. Baseline: the tree publishes cleanly, and `publish.js --check` exits 0 on it.
 *   2. Each gate is REFUSED by a mutated input that breaks exactly that gate and no earlier one: G-SOURCE (invalid JSON; a source the validator rejects), G-DERIVE (derivation throws), G-REPRODUCIBLE
 *      (two derivations differ), G-ARTIFACT (an authored section rides along; a missing provenance), G-CONSUMERS (an index with no consumer; a manifest entry for an index that is not held),
 *      G-COMPAT (source-schema, derivation and interface-major mismatches; a required index missing), G-FRESH (a hash that is not the source's), G-COMMITTED (stale, hand-edited, missing).
 *      A refusal writes nothing; it names the gate.
 *   3. Compatibility is a consumer-side check that needs nothing else: artifact_compat.js requires no module, and refuses each version meaning separately (source schema, derivation, interface), accepts a
 *      newer MINOR interface and refuses a newer MAJOR one.
 *   4. R-SYSTEM-INDEXPROXY: every index the artifact holds names a consumer, and every consumer module named is a real module of COMPONENT_LAYER_MAP.md (or the CMS).
 *   5. The CLI: in a scratch tree, a refused publish leaves the committed artifact and btnyc.json byte-identical; an accepted one writes the artifact and nothing else (btnyc.json is not touched).
 *   6. The validator's --json output survives a pipe (it exceeds 64 KiB) -- a truncated report would read as a pass.
 *
 * Node + python3 (jsonschema) only; no browser, no network.
 */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const ROOT = process.env.BTNYC_ROOT ? path.resolve(process.env.BTNYC_ROOT) : path.resolve(__dirname, '..');
process.env.BTNYC_ROOT = ROOT;
const EF = path.join(__dirname, 'tools', 'entity_first');
const lib = require(path.join(EF, 'lib.js'));
const D = require(path.join(EF, 'derive_graph.js'));
const P = require(path.join(EF, 'publish.js'));
const C = require(path.join(EF, 'artifact_compat.js'));

let passed = 0, failed = 0;
const check = (label, ok, detail) => { if (ok) { passed++; console.log(`  ✓ ${label}`); } else { failed++; console.log(`  ✗ ${label}${detail ? ' -- ' + detail : ''}`); } };

const SOURCE_TEXT = fs.readFileSync(lib.PATHS.source, 'utf8'), COMMITTED = fs.readFileSync(lib.PATHS.graph, 'utf8');
const CONTRACT = lib.readJson(P.CONTRACT_PATH);
const gates = r => [...new Set(r.refusals.map(x => x.gate))];
const refused = (r, gate) => !r.ok && gates(r).includes(gate);

// run publish.run with derive_graph.derive replaced; always restored
function withDerive(fn, f) { const orig = D.derive; D.derive = fn; try { return f(); } finally { D.derive = orig; } }
const realDerive = D.derive;

// ---- 1. baseline --------------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('The tree publishes, and --check agrees');
const base = P.run({ sourceText: SOURCE_TEXT, committedText: COMMITTED, check: true });
check('every gate passes on the real source, and the committed artifact is exactly what it derives', base.ok, JSON.stringify(base.refusals));
check('the artifact text is the committed text, byte for byte', base.artifactText === COMMITTED);
{ const r = cp.spawnSync(process.execPath, [path.join(EF, 'publish.js'), '--check'], { encoding: 'utf8' }); check('publish.js --check exits 0 on the tree', r.status === 0, (r.stderr || r.stdout || '').slice(0, 300)); }

// ---- 2. each gate refuses --------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('\nEach gate refuses, by name, and nothing is published');
{ const r = P.run({ sourceText: '{ not json', committedText: COMMITTED, check: false }); check('G-SOURCE: a source that is not JSON is refused', refused(r, 'G-SOURCE') && !r.artifactText); }
{ const s = JSON.parse(SOURCE_TEXT); s.entities[0].services[0].entity_id = 'ent.no_such_entity'; const r = P.run({ sourceText: JSON.stringify(s), committedText: COMMITTED, check: false });
  check('G-SOURCE: a source the validator rejects (a service pointing at a missing entity) is refused, naming the rule', refused(r, 'G-SOURCE') && /V-/.test(r.refusals[0].msg) && !r.artifactText, JSON.stringify(r.refusals).slice(0, 200)); }
{ const s = JSON.parse(SOURCE_TEXT); delete s.vocabulary.action_vocabulary; const r = P.run({ sourceText: JSON.stringify(s), committedText: COMMITTED, check: false }); check('G-SOURCE: a source missing a required section is refused', refused(r, 'G-SOURCE') && !r.artifactText); }
{ const r = withDerive(() => { throw new Error('boom'); }, () => P.run({ sourceText: SOURCE_TEXT, committedText: COMMITTED, check: false })); check('G-DERIVE: a derivation that throws is refused', refused(r, 'G-DERIVE') && /boom/.test(r.refusals[0].msg)); }
{ let n = 0; const r = withDerive((src, text, o) => { const g = realDerive(src, text, o); if (n++ > 0) g.counts = Object.assign({}, g.counts, { entities: -1 }); return g; }, () => P.run({ sourceText: SOURCE_TEXT, committedText: COMMITTED, check: false }));
  check('G-REPRODUCIBLE: a derivation that gives different bytes the second time is refused', refused(r, 'G-REPRODUCIBLE')); }
{ const r = withDerive((src, text, o) => { const g = realDerive(src, text, o); g.entities_of_the_source = src.entities; return g; }, () => P.run({ sourceText: SOURCE_TEXT, committedText: COMMITTED, check: false }));
  check('G-ARTIFACT: an artifact that carries a section of the authored source is refused (closed key set)', refused(r, 'G-ARTIFACT') && !gates(r).includes('G-SOURCE')); }
{ const r = withDerive((src, text, o) => { const g = realDerive(src, text, o); g.entities = src.entities; return g; }, () => P.run({ sourceText: SOURCE_TEXT, committedText: COMMITTED, check: false }));
  check('G-ARTIFACT: the derived entities index cannot be replaced by the authored entity list (hybrid): the schema names the key', refused(r, 'G-ARTIFACT') && r.refusals.some(x => /\$\.entities/.test(x.msg)) && !gates(r).includes('G-SOURCE')); }
{ const r = withDerive((src, text, o) => { const g = realDerive(src, text, o); delete g.$source; return g; }, () => P.run({ sourceText: SOURCE_TEXT, committedText: COMMITTED, check: false }));
  check('G-ARTIFACT: an artifact without $source is refused (provenance required)', refused(r, 'G-ARTIFACT')); check('G-COMPAT: ... and a consumer would refuse it for the same reason', refused(r, 'G-COMPAT') && r.refusals.some(x => /\[provenance\]/.test(x.msg))); }
{ const r = withDerive((src, text, o) => { const g = realDerive(src, text, o); g.manifest.indexes.picker.consumers = []; return g; }, () => P.run({ sourceText: SOURCE_TEXT, committedText: COMMITTED, check: false }));
  check('G-CONSUMERS: an index whose manifest entry lists no consumer is refused (R-SYSTEM-INDEXPROXY)', refused(r, 'G-CONSUMERS') && r.refusals.some(x => /picker/.test(x.msg))); }
{ const r = withDerive((src, text, o) => { const g = realDerive(src, text, o); delete g.manifest.indexes.alias_index; return g; }, () => P.run({ sourceText: SOURCE_TEXT, committedText: COMMITTED, check: false }));
  check('G-CONSUMERS: an index the artifact holds but the manifest does not name is refused', refused(r, 'G-CONSUMERS') && r.refusals.some(x => /alias_index/.test(x.msg))); }
{ const r = withDerive((src, text, o) => { const g = realDerive(src, text, o); g.manifest.indexes.ghost_index = { consumers: [{ module: 'resolver.js', reads: 'an index that is not there' }] }; return g; }, () => P.run({ sourceText: SOURCE_TEXT, committedText: COMMITTED, check: false }));
  check('G-CONSUMERS: a manifest entry for an index the artifact does not hold is refused', refused(r, 'G-CONSUMERS') && r.refusals.some(x => /ghost_index/.test(x.msg))); }
{ const r = withDerive((src, text, o) => { const g = realDerive(src, text, o); g.$source.sha256 = 'f'.repeat(64); return g; }, () => P.run({ sourceText: SOURCE_TEXT, committedText: COMMITTED, check: false }));
  check('G-FRESH: an artifact whose $source.sha256 is not the source\'s hash is refused', refused(r, 'G-FRESH')); }
{ const r = P.run({ sourceText: SOURCE_TEXT, committedText: null, check: true }); check('G-COMMITTED: no committed artifact is refused ("run publish.js")', refused(r, 'G-COMMITTED') && /run publish\.js/.test(r.refusals.map(x => x.msg).join())); }
{ const stale = COMMITTED.replace(/"sha256": "[0-9a-f]{64}"/, '"sha256": "' + '0'.repeat(64) + '"'); const r = P.run({ sourceText: SOURCE_TEXT, committedText: stale, check: true }); check('G-COMMITTED: a stale committed artifact (another source hash) is refused', stale !== COMMITTED && refused(r, 'G-COMMITTED')); }
{ const j = JSON.parse(COMMITTED); j.counts.entities += 1; const edited = lib.toText(j); const r = P.run({ sourceText: SOURCE_TEXT, committedText: edited, check: true }); check('G-COMMITTED: a hand-edited committed artifact (one count changed) is refused', refused(r, 'G-COMMITTED')); }
{ const r = P.run({ sourceText: SOURCE_TEXT, committedText: '{ nope', check: true }); check('G-COMMITTED: a committed artifact that is not JSON is refused', refused(r, 'G-COMMITTED') && r.refusals.some(x => /not valid JSON/.test(x.msg))); }
{ const j = JSON.parse(COMMITTED); j.$source.source_schema_version = '0.9.0'; const r = P.run({ sourceText: SOURCE_TEXT, committedText: lib.toText(j), check: true }); check('a hand-edited committed artifact is also held to the consumer contract (G-COMPAT, named for the right reason)', refused(r, 'G-COMMITTED') && r.refusals.some(x => x.gate === 'G-COMPAT' && /committed artifact/.test(x.msg))); }
{ const r = P.run({ sourceText: SOURCE_TEXT, committedText: COMMITTED, check: false }); check('without --check the committed text is not consulted (a stale artifact does not block republishing)', r.ok); }

// ---- 3. compatibility is a consumer-side check ---------------------------------------------------------------------------------------------------------------------------------
console.log('\nA consumer refuses a mismatched artifact, one version meaning at a time');
{ const art = JSON.parse(COMMITTED); const kinds = (a, c) => C.check(a, c).problems.map(p => p.kind).sort();
  check('the real artifact is accepted by the real contract', C.check(art, CONTRACT).ok);
  { const c = lib.clone(CONTRACT); c.accepts.source_schema_versions = ['1.0.0']; check('G-COMPAT: a contract built for source schema 1.0.0 refuses the 1.1.0 artifact (source_schema_version only)', JSON.stringify(kinds(art, c)) === '["source_schema_version"]', kinds(art, c).join()); }
  { const c = lib.clone(CONTRACT); c.accepts.derivation_versions = ['1.0.0']; check('a contract built for derivation 1.0.0 refuses it (derivation_version only)', JSON.stringify(kinds(art, c)) === '["derivation_version"]', kinds(art, c).join()); }
  { const c = lib.clone(CONTRACT); c.interface_version = '2.0.0'; check('a consumer built for interface 2.x refuses interface 1.0.0 (a different major is breaking)', JSON.stringify(kinds(art, c)) === '["interface_version"]', kinds(art, c).join()); }
  { const a = lib.clone(art); a.interface_version = '2.0.0'; check('... and a consumer built for 1.x refuses interface 2.0.0', JSON.stringify(kinds(a, CONTRACT)) === '["interface_version"]', kinds(a, CONTRACT).join()); }
  { const a = lib.clone(art); a.interface_version = '1.3.0'; check('a newer MINOR interface (an index was added) is accepted by an older consumer', C.check(a, CONTRACT).ok); }
  { const c = lib.clone(CONTRACT); c.interface_version = '1.2.0'; check('an older MINOR interface than the consumer needs is refused (an index it reads may be missing)', JSON.stringify(kinds(art, c)) === '["interface_version"]', kinds(art, c).join()); }
  { const a = lib.clone(art); delete a.alias_index; check('a required index that is missing is refused (required_index)', JSON.stringify(kinds(a, CONTRACT)) === '["required_index"]', kinds(a, CONTRACT).join()); }
  { const a = lib.clone(art); a.interface_version = 'one'; check('an interface version that is not a semantic version is refused', kinds(a, CONTRACT).includes('interface_version')); }
  { const a = lib.clone(art); delete a.$source.sha256; check('a $source with a missing field is refused (provenance)', kinds(a, CONTRACT).includes('provenance')); }
  check('the three versions are three different things: the contract names all three, and the artifact carries all three', !!CONTRACT.interface_version && !!CONTRACT.accepts.source_schema_versions && !!CONTRACT.accepts.derivation_versions && !!art.interface_version && !!art.$source.source_schema_version && !!art.$source.derivation_version);
  check('the versions the code writes are the versions the contract accepts', CONTRACT.accepts.source_schema_versions.includes(lib.SOURCE_SCHEMA_VERSION) && CONTRACT.accepts.derivation_versions.includes(lib.DERIVATION_VERSION) && CONTRACT.interface_version === lib.INTERFACE_VERSION);
  // T179 (#223): the check is a RUNTIME file (modules/artifact_compat.js: the consumer runs the check the publisher ran); the build tools' path is a one-line re-export of it
  const strip = f => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const text = strip(path.join(__dirname, '..', 'modules', 'artifact_compat.js')), shim = strip(path.join(EF, 'artifact_compat.js'));
  check('modules/artifact_compat.js requires nothing (a runtime module can load it before it reads any index)', !/\brequire\s*\(/.test(text) && !/\bimport\b/.test(text));
  check('the build tools\' artifact_compat.js is only a re-export of the runtime file: one require, of that file, and no check of its own (one implementation, publisher and consumer)', (shim.match(/\brequire\s*\(/g) || []).length === 1 && /module\.exports\s*=\s*require\(\s*'\.\.\/\.\.\/\.\.\/modules\/artifact_compat\.js'\s*\)/.test(shim) && !/function\s+check\b/.test(shim));
  check('... and both paths give the same functions (what publish.js runs is what the page runs)', (() => { const a = require(path.join(EF, 'artifact_compat.js')), b = require(path.join(__dirname, '..', 'modules', 'artifact_compat.js')); return a === b || (a.check === b.check && a.refusal === b.refusal && a.parse === b.parse); })());
  check('a refusal is one readable line that names the kind', /^artifact refused: \[source_schema_version\]/.test(C.refusal(C.check(art, (() => { const c = lib.clone(CONTRACT); c.accepts.source_schema_versions = ['1.0.0']; return c; })()))) && C.refusal(C.check(art, CONTRACT)) === null);
}

// ---- 4. every index has a real consumer ---------------------------------------------------------------------------------------------------------------------------------------------
console.log('\nEvery index names a consumer that exists (R-SYSTEM-INDEXPROXY)');
{ const art = JSON.parse(COMMITTED); const map = fs.readFileSync(path.join(ROOT, 'COMPONENT_LAYER_MAP.md'), 'utf8'); const held = Object.keys(art).filter(k => !['$source', 'interface_version', 'derivation', 'counts', 'manifest'].includes(k));
  check(`the artifact holds ${held.length} indexes and the manifest names each`, held.length >= 14 && held.every(k => art.manifest.indexes[k]) && Object.keys(art.manifest.indexes).every(k => held.includes(k)), held.join());
  check('every manifest entry lists at least one consumer', held.every(k => art.manifest.indexes[k].consumers.length >= 1));
  check('every consumer states what it reads', held.every(k => art.manifest.indexes[k].consumers.every(c => typeof c.module === 'string' && c.module && typeof c.reads === 'string' && c.reads.length > 5)));
  const mods = [...new Set(held.flatMap(k => art.manifest.indexes[k].consumers.map(c => c.module)))].filter(c => !/^CMS/.test(c));
  check(`every consumer module (${mods.join(', ')}) is a module of COMPONENT_LAYER_MAP.md`, mods.length > 0 && mods.every(c => map.includes(c)), mods.filter(c => !map.includes(c)).join());
  check('a consumer the map does not name would be seen (counterfactual)', !map.includes('no_such_module.js'));
  check('the manifest states honestly that the consumers are targets, not yet extracted', /target/i.test(JSON.stringify(art.manifest.consumer_status || '')));
  const idx = JSON.parse(JSON.stringify(art)); delete idx.manifest.indexes.recovery.consumers; check('counterfactual: removing a consumer list is found by manifestFindings', P.manifestFindings(idx).length > 0);
  check('the artifact schema refuses an authored section: adding "entities" is a finding', (() => { const a = lib.clone(art); a.entities = []; return P.artifactSchemaFindings(lib.toText(a), P.ARTIFACT_SCHEMA_PATH).length > 0; })());
  check('the artifact schema refuses a manifest entry with an empty consumer list', (() => { const a = lib.clone(art); a.manifest.indexes.picker.consumers = []; return P.artifactSchemaFindings(lib.toText(a), P.ARTIFACT_SCHEMA_PATH).length > 0; })());
  check('the artifact schema accepts the real artifact', P.artifactSchemaFindings(COMMITTED, P.ARTIFACT_SCHEMA_PATH).length === 0);
  check('a schema that cannot be read is a refusal, never a pass', P.artifactSchemaFindings(COMMITTED, '/nonexistent/schema.json').length > 0);
}

// ---- 5. the CLI, in a scratch tree --------------------------------------------------------------------------------------------------------------------------------------------------
console.log('\nThe CLI writes the candidate artifact and nothing else, and a refusal writes nothing');
{ const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ef-publish-'));
  try {
    const cp1 = (rel) => { const to = path.join(tmp, rel); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(path.join(ROOT, rel), to); };
    for (const rel of ['btnyc.json', 'ssot/btnyc_source.json', 'ssot/derived/btnyc_graph.json', 'schema/btnyc-source.schema.json', 'schema/btnyc-artifact.schema.json', 'schema/btnyc-interface-contract.json']) cp1(rel);
    const h = rel => lib.sha(fs.readFileSync(path.join(tmp, rel), 'utf8')); const before = { legacy: h('btnyc.json'), graph: h('ssot/derived/btnyc_graph.json'), source: h('ssot/btnyc_source.json') };
    const run = args => cp.spawnSync(process.execPath, [path.join(EF, 'publish.js'), ...args], { encoding: 'utf8', env: Object.assign({}, process.env, { BTNYC_ROOT: tmp }) });
    // a refused publish: the source is invalid
    const bad = JSON.parse(fs.readFileSync(path.join(tmp, 'ssot/btnyc_source.json'), 'utf8')); bad.entities[0].services[0].entity_id = 'ent.no_such_entity'; fs.writeFileSync(path.join(tmp, 'ssot/btnyc_source.json'), lib.toText(bad));
    const r1 = run([]); check('a publish on an invalid source exits non-zero and names the gate', r1.status !== 0 && /\[G-SOURCE\]/.test(r1.stderr), r1.stderr.slice(0, 200));
    check('... and leaves the committed artifact byte-identical', h('ssot/derived/btnyc_graph.json') === before.graph);
    // an accepted publish after the source changes: the artifact moves, nothing else does
    const good = JSON.parse(fs.readFileSync(path.join(ROOT, 'ssot/btnyc_source.json'), 'utf8')); const noted = lib.toText(good); fs.writeFileSync(path.join(tmp, 'ssot/btnyc_source.json'), noted);
    const stale = JSON.parse(fs.readFileSync(path.join(tmp, 'ssot/derived/btnyc_graph.json'), 'utf8')); stale.counts.entities += 1; fs.writeFileSync(path.join(tmp, 'ssot/derived/btnyc_graph.json'), lib.toText(stale));
    const r0 = run(['--check']); check('--check on a hand-edited artifact exits non-zero ([G-COMMITTED])', r0.status !== 0 && /\[G-COMMITTED\]/.test(r0.stderr));
    check('--check writes nothing', h('ssot/derived/btnyc_graph.json') === lib.sha(lib.toText(stale)));
    const r2 = run([]); check('publishing from the valid source exits 0', r2.status === 0, r2.stderr.slice(0, 200));
    check('... and rewrites the artifact to exactly what the source derives', h('ssot/derived/btnyc_graph.json') === before.graph);
    check('... and does not touch btnyc.json (the hybrid is a hand-carried mirror until the runtime reads the artifact)', h('btnyc.json') === before.legacy);
    check('... and does not touch the source', h('ssot/btnyc_source.json') === before.source);
    const r3 = run(['--check']); check('--check then passes', r3.status === 0, r3.stderr.slice(0, 200));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

// ---- 6. the validator's JSON report survives a pipe ----------------------------------------------------------------------------------------------------------------------------------
console.log('\nThe validator\'s --json report survives a pipe');
{ const r = cp.spawnSync(process.execPath, [path.join(EF, 'validate_source.js'), '--json'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  let j = null; try { j = JSON.parse(r.stdout); } catch (e) { /* reported below */ }
  check('the report is larger than one pipe buffer (64 KiB), so truncation would be possible', r.stdout.length > 65536, String(r.stdout.length));
  check('... and parses completely (a truncated report would not)', !!j && j.ok === true && Array.isArray(j.residuals), (r.stdout.slice(-120) || '').replace(/\n/g, ' '));
  check('the exit code agrees with the report (0 when ok)', r.status === 0);
  check('counterfactual: a report cut at 64 KiB does not parse', (() => { try { JSON.parse(r.stdout.slice(0, 65536)); return false; } catch (e) { return true; } })());
}

console.log(`\n[Entity-first publish: gates, compatibility, consumers] ${passed} passed, ${failed} failed (of ${passed + failed} checks)`);
process.exit(failed ? 1 : 0);
