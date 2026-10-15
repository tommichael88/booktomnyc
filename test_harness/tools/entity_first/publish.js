#!/usr/bin/env node
'use strict';
/**
 * publish.js -- the one place the derived runtime artifact is written (T177; R-SYSTEM-CMS publishing, P-SYSTEM-VERSIONS, R-SYSTEM-INDEXPROXY, R-INVARIANT-DERIVATION).
 *
 *   node test_harness/tools/entity_first/publish.js            # run every gate; write ssot/derived/btnyc_graph.json only if all pass
 *   node test_harness/tools/entity_first/publish.js --check    # run every gate and compare with the committed artifact; write nothing (exit 0 only if the committed artifact is exactly what would be published)
 *
 * The gates, in order. A failure is a REFUSAL that names the gate, says what to do, and writes nothing; nothing is repaired or guessed.
 *   G-SOURCE        the source passes the independent validator (schema and semantic rules)
 *   G-DERIVE        derivation succeeds on a valid source
 *   G-REPRODUCIBLE  deriving again, from a fresh parse of the same text, gives the same bytes
 *   G-ARTIFACT      the artifact satisfies schema/btnyc-artifact.schema.json: provenance present, closed key set (no authored-source section can ride along), every manifest consumer list non-empty
 *   G-CONSUMERS     every index the artifact holds is named in the manifest with a consumer, and the manifest names no index the artifact lacks
 *   G-COMPAT        a consumer built for schema/btnyc-interface-contract.json would accept it (artifact_compat.js: source-schema, derivation and interface versions)
 *   G-FRESH         $source.sha256 is the hash of the source text as it is now
 *   G-COMMITTED     (--check only) the committed artifact is byte-for-byte what was just derived: not stale, not hand-edited, not missing; and the committed text itself passes G-ARTIFACT and G-COMPAT
 *
 * Today it publishes the CANDIDATE artifact, ssot/derived/btnyc_graph.json. It does not write btnyc.json: the hybrid stays a hand-carried mirror until the runtime reads the artifact (ssot/TRANSITION_DUALSOURCE.md),
 * and no runtime adapter is built here. When that happens, the artifact path moves to btnyc.json and this file is the only writer.
 */
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const lib = require('./lib.js');
const V = require('./validate_source.js');
const D = require('./derive_graph.js');
const C = require('./artifact_compat.js');

const CONTRACT_PATH = path.join(lib.ROOT, 'schema', 'btnyc-interface-contract.json');
const ARTIFACT_SCHEMA_PATH = path.join(lib.ROOT, 'schema', 'btnyc-artifact.schema.json');

// the JSON Schema check of an artifact text; a check that cannot run is a refusal, never a pass
function artifactSchemaFindings(artifactText, schemaPath) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ef-artifact-'));
  try {
    const f = path.join(dir, 'artifact.json'); fs.writeFileSync(f, artifactText);
    const p = cp.spawnSync('python3', ['-I', path.join(__dirname, 'schema_check.py'), schemaPath, f], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (p.status === 0) return [];
    if (p.status === 1) { const lines = (p.stdout || '').split('\n').filter(Boolean).map(l => { try { const j = JSON.parse(l); return `${j.path}: ${j.msg}`; } catch (e) { return l.slice(0, 200); } }); return lines.length ? lines : ['the artifact schema check reported the artifact invalid but gave no finding (treated as a failure to run)']; }
    return ['the artifact schema check could not run: ' + ((p.stdout || '') + (p.stderr || '')).slice(0, 300)];
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function manifestFindings(art) {
  const out = []; const m = art && art.manifest && art.manifest.indexes;
  if (!m || typeof m !== 'object') return ['the artifact has no manifest.indexes'];
  const held = Object.keys(art).filter(k => !['$source', 'interface_version', 'derivation', 'counts', 'manifest'].includes(k));
  for (const k of held) if (!m[k] || !Array.isArray(m[k].consumers) || m[k].consumers.length === 0) out.push(`the index ${k} has no consumer in the manifest: an index nothing reads is not shipped (R-SYSTEM-INDEXPROXY)`);
  for (const k of Object.keys(m)) if (!held.includes(k)) out.push(`the manifest names the index ${k}, which the artifact does not hold`);
  return out;
}

// run({ sourceText, committedText, contract, schemaPath, check }) -> { ok, refusals: [{gate, msg}], artifactText, graph }
function run(o) {
  const refusals = []; const refuse = (gate, msg) => refusals.push({ gate, msg });
  const contract = o.contract || lib.readJson(CONTRACT_PATH); const schemaPath = o.schemaPath || ARTIFACT_SCHEMA_PATH;
  let src; try { src = JSON.parse(o.sourceText); } catch (e) { refuse('G-SOURCE', 'the source is not valid JSON: ' + e.message); return { ok: false, refusals }; }
  const v = V.validateFull(src);
  if (!v.ok) { refuse('G-SOURCE', `the source has ${v.errors.length} validation finding(s); first: [${v.errors[0].code}] ${v.errors[0].path}: ${v.errors[0].msg}. Fix the source (validate_source.js shows all of them).`); return { ok: false, refusals }; }
  let graph, text;
  try { graph = D.derive(src, o.sourceText, { validated: v }); text = lib.toText(graph); } catch (e) { refuse('G-DERIVE', 'derivation failed: ' + e.message); return { ok: false, refusals }; }
  { const again = lib.toText(D.derive(JSON.parse(o.sourceText), o.sourceText)); if (again !== text) refuse('G-REPRODUCIBLE', 'deriving twice from the same source gave different bytes: the derivation is not reproducible, so nothing is published'); }
  for (const f of artifactSchemaFindings(text, schemaPath).slice(0, 5)) refuse('G-ARTIFACT', f);
  for (const f of manifestFindings(graph)) refuse('G-CONSUMERS', f);
  { const c = C.check(graph, contract); if (!c.ok) for (const p of c.problems) refuse('G-COMPAT', `[${p.kind}] ${p.msg}`); }
  if (!graph.$source || graph.$source.sha256 !== lib.sha(o.sourceText)) refuse('G-FRESH', '$source.sha256 is not the hash of the source as it is now');
  if (o.check) {
    if (o.committedText === null || o.committedText === undefined) refuse('G-COMMITTED', 'there is no published artifact: run publish.js');
    else if (o.committedText !== text) {
      refuse('G-COMMITTED', 'the committed artifact is not what the source derives (stale, or edited by hand): run publish.js');
      // what a consumer would read is also held to the contract, so a hand-edited artifact is named for the right reason
      let committed = null; try { committed = JSON.parse(o.committedText); } catch (e) { refuse('G-COMMITTED', 'the committed artifact is not valid JSON'); }
      if (committed) { const c = C.check(committed, contract); if (!c.ok) for (const p of c.problems) refuse('G-COMPAT', `committed artifact: [${p.kind}] ${p.msg}`); for (const f of artifactSchemaFindings(o.committedText, schemaPath).slice(0, 3)) refuse('G-ARTIFACT', 'committed artifact: ' + f); }
    }
  }
  return { ok: refusals.length === 0, refusals, artifactText: text, graph };
}

function main() {
  const args = process.argv.slice(2); const check = args.includes('--check');
  const sourceText = fs.readFileSync(lib.PATHS.source, 'utf8');
  const committedText = fs.existsSync(lib.PATHS.graph) ? fs.readFileSync(lib.PATHS.graph, 'utf8') : null;
  const r = run({ sourceText, committedText, check });
  const rel = p => path.relative(lib.ROOT, p);
  if (!r.ok) { console.error(`publish REFUSED (${r.refusals.length}):`); for (const x of r.refusals) console.error(`  [${x.gate}] ${x.msg}`); return 1; }
  if (check) { console.log(`publish check passed: ${rel(lib.PATHS.graph)} is exactly what ${rel(lib.PATHS.source)} (source schema ${r.graph.$source.source_schema_version}) derives; interface ${r.graph.interface_version}, derivation ${r.graph.$source.derivation_version}; ${Object.keys(r.graph.manifest.indexes).length} indexes, each with a consumer`); return 0; }
  const changed = lib.writeIfChanged(lib.PATHS.graph, r.artifactText);
  console.log(`${changed ? 'published' : 'unchanged'} ${rel(lib.PATHS.graph)} (interface ${r.graph.interface_version}, derivation ${r.graph.$source.derivation_version}, from source schema ${r.graph.$source.source_schema_version}, sha256 ${r.graph.$source.sha256.slice(0, 12)}…)`);
  return 0;
}
if (require.main === module) process.exit(main());
module.exports = { run, artifactSchemaFindings, manifestFindings, CONTRACT_PATH, ARTIFACT_SCHEMA_PATH };
