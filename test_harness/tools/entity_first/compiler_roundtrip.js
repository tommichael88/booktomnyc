#!/usr/bin/env node
'use strict';
/**
 * compiler_roundtrip.js -- prove that the ssot/btnyc_source.json carries everything the compiler needs (T175, design note 12.2).
 *
 *   node test_harness/tools/entity_first/compiler_roundtrip.js
 *
 * Builds a legacy-shaped file from the SOURCE ALONE (project_legacy.project: the authored sections and the curated seed of routing_archetypes, with no compiler-owned key other than the seed), runs the
 * production compiler on it under two hash seeds, and compares the 8 compiler-owned keys to btnyc.json's. The compiler is the system under test here, never the oracle: the expected values are the ones
 * already committed in btnyc.json, which the golden-master baseline holds fixed. If the source lost a curated value (a picker label, a tile, a component link, a gap) the compiled routing_archetypes would
 * differ and this fails.
 */
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const lib = require('./lib.js'); const pl = require('./project_legacy.js');

function compile(inputPath, seed) {
  const out = path.join(path.dirname(inputPath), `out_${seed}.json`);
  const r = cp.spawnSync('python3', [path.join(lib.ROOT, 'test_harness', 'btnyc_v10_compiler.py'), inputPath, out], { encoding: 'utf8', env: Object.assign({}, process.env, { PYTHONHASHSEED: String(seed) }) });
  if (r.status !== 0 || !fs.existsSync(out)) return { error: (r.stdout || '') + (r.stderr || '') };
  return { text: fs.readFileSync(out, 'utf8') };
}

function run(src, legacy) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ef-roundtrip-'));
  try {
    // T181: the compiler validates its input against schema/btnyc_schema.json, which now REQUIRES the Charter members. The projection alone is the pre-carry shape, so the carry (also a function of the source
    // alone) is applied to it, exactly as it is to the live file; lib.authoredLegacy strips it again for every comparison below.
    const proj = pl.project(src);
    const input = path.join(dir, 'projected.json'); fs.writeFileSync(input, require('./carry_charter.js').carry(lib.toText(proj), src, lib.toText(src)).text);
    const a = compile(input, 1), b = compile(input, 2);
    if (a.error) return { ok: false, why: 'the compiler did not run on the projected source', detail: a.error.slice(0, 1500) };
    if (b.error) return { ok: false, why: 'the compiler did not run on the projected source (second seed)', detail: b.error.slice(0, 1500) };
    if (a.text !== b.text) return { ok: false, why: 'the compiler output depends on the hash seed' };
    const got = JSON.parse(a.text); const differ = [];
    // compiled.service_index[*].intake_chain is the compiler's VERBATIM copy of the authored chain. The source holds the chain as steps + depends_on and regenerates it in canonical layout, so the copy is
    // compared by what the runtime does with it (same view as the projection: resolved order, params, branch map as label -> target set, annotations, which modules are listed) and the chains whose raw
    // layout differs are counted and named: that list is pinned (declared_normalizations.js), so it cannot grow silently.
    const layoutDiffers = [];
    const view = c => { const o = lib.clone(c); for (const [id, e] of Object.entries(o.service_index || {})) if (Array.isArray(e.intake_chain)) e.intake_chain = pl.chainView(e.intake_chain, null); return o; };
    for (const [id, e] of Object.entries(legacy.compiled.service_index || {})) if (Array.isArray(e.intake_chain) && lib.diff(e.intake_chain, got.compiled.service_index[id] && got.compiled.service_index[id].intake_chain)) layoutDiffers.push(id);
    const wantC = Object.assign({}, legacy, { compiled: view(legacy.compiled) }), gotC = Object.assign({}, got, { compiled: view(got.compiled) });
    // the same declared normalization as the projection: the legacy routing_archetypes carries "act.repair" beside "Repair" and the compiler preserves that curated union
    wantC.routing_archetypes = lib.clone(legacy.routing_archetypes); const doubled = [];
    for (const [gid, ra] of Object.entries(wantC.routing_archetypes)) if ((ra.real_action_ids || []).some(a => /^act\./.test(a))) { doubled.push(gid); ra.real_action_ids = ra.real_action_ids.filter(a => !/^act\./.test(a)); }
    for (const k of lib.COMPILER_KEYS) {
      const ds = lib.diffAll(wantC[k], gotC[k], '$.' + k, [], 100000);
      const bad = ds;
      if (bad.length) differ.push({ key: k, first: bad[0], count: bad.length, all: bad });
    }
    const authoredDiff = lib.diff(lib.authoredLegacy(legacy), lib.authoredLegacy(got));
    const problems = require('./declared_normalizations.js').verify({ chain_layout: layoutDiffers, action_double_spelling: doubled }, ['chain_layout', 'action_double_spelling']);
    return { ok: differ.length === 0 && problems.length === 0, problems, layoutDiffers: layoutDiffers.sort(), differ, compilerKeys: lib.COMPILER_KEYS.length, authoredAdditive: !authoredDiff || authoredDiff };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

if (require.main === module) {
  const r = run(lib.readJson(lib.PATHS.source), lib.readJson(lib.PATHS.legacy));
  if (r.ok) { console.log(`compiler roundtrip: ${r.compilerKeys} of ${r.compilerKeys} compiler-owned keys reproduced from the source alone (${r.layoutDiffers.length} chain copies differ only in layout, pinned in declared_normalizations.js)`); process.exit(0); }
  console.log('compiler roundtrip FAILED:', r.why || ''); (r.problems || []).forEach(p => console.log('  ' + p)); if (r.detail) console.log(r.detail);
  for (const d of r.differ || []) console.log('  differs:', d.key, '\n    first difference at', d.first.path, '\n      btnyc.json:', String(JSON.stringify(d.first.a)).slice(0, 260), '\n      from source:', String(JSON.stringify(d.first.b)).slice(0, 260));
  process.exit(1);
}
module.exports = { run };
