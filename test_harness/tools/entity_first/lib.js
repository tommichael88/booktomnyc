'use strict';
/**
 * lib.js -- the small shared pieces of the entity-first SSOT tools (T175): id grammar, deterministic JSON, deep comparison, the legacy loader.
 * Nothing here knows the shape of either file; the migration, the projection, the validator and the derivation each own their own shape knowledge.
 * The design is in ssot/ENTITY_FIRST_DESIGN_NOTE.md.
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const ROOT = process.env.BTNYC_ROOT ? path.resolve(process.env.BTNYC_ROOT) : path.resolve(__dirname, '..', '..', '..');
const PATHS = {
  root: ROOT,
  legacy: path.join(ROOT, 'btnyc.json'),
  source: path.join(ROOT, 'ssot', 'btnyc_source.json'),
  schema: path.join(ROOT, 'schema', 'btnyc-source.schema.json'),
  graph: path.join(ROOT, 'ssot', 'derived', 'btnyc_graph.json'),
  ledger: path.join(ROOT, 'ssot', 'migration', 'provenance_ledger.json'),
  lastMigration: path.join(ROOT, 'ssot', 'migration', 'last_migration.json'),
  migrationReport: path.join(ROOT, 'ssot', 'MIGRATION_REPORT.md'),
  coverageReport: path.join(ROOT, 'ssot', 'COVERAGE_REPORT.md'),
};

// The keys btnyc_v10_compiler.py owns (its COMPILER_KEYS). They are derived, never authored, and are not in the source.
const COMPILER_KEYS = ['compiled', 'routing_archetypes', 'pricing_archetypes', '_compiler_metadata', '_validation', '_additive_diff', '_schema_validation', '_archetype_mismatch_report'];

const SOURCE_SCHEMA_VERSION = '1.1.0';
const DERIVATION_VERSION = '1.1.0'; // 1.1.0: $source, interface_version, manifest, alias_index, action_vocabulary, formula_inputs, price_influence (T177)
// The interface version is the contract a CONSUMING module checks before it reads the artifact (P-SYSTEM-VERSIONS). It moves only when a consumer would break: a removed or reshaped index, a changed key meaning.
const INTERFACE_VERSION = '1.0.0';

// ---- ids -------------------------------------------------------------------------------------------------------------------------------------------------------------------
// The id types and their prefixes. A reference is a bare id string; the prefix names the target type. There is no second spelling.
const ID_TYPES = { ent: 'entity', act: 'action', mod: 'modifier', svc: 'service', cmp: 'composition', q: 'question', u: 'uncertainty_class', tag: 'tag', mat: 'material', fml: 'formula',
  chk: 'checkout_state', cat: 'category', grp: 'group', cls: 'behavioral_class', ctx: 'context', par: 'pricing_archetype', fur: 'furniture' };
const ID_RE = /^([a-z]{1,4})\.([A-Za-z0-9_+\-]+(?:\.[A-Za-z0-9_+\-]+)*)$/;
function idType(id) { const m = typeof id === 'string' && ID_RE.exec(id); return m && ID_TYPES[m[1]] ? m[1] : null; }
function idOf(prefix, key) { return prefix + '.' + key; }
function stripId(prefix, id) { if (typeof id !== 'string' || !id.startsWith(prefix + '.')) throw new Error(`expected a ${prefix}. id, got ${JSON.stringify(id)}`); return id.slice(prefix.length + 1); }

// slug of a human label: apostrophes (straight and typographic) dropped, anything else non-alphanumeric becomes one underscore. Same rule as the compiler's symptom_tile_id.
function slug(label, max = 60) {
  const s = String(label).replace(/[‘’']/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return s.slice(0, max).replace(/_+$/g, '');
}
// Unique slugs in document order: the first keeps the bare slug, later collisions get _2, _3 ...
function uniqueSlugger() {
  const seen = new Map();
  return (label, fallback) => {
    let s = slug(label) || fallback || 'x';
    const n = (seen.get(s) || 0) + 1; seen.set(s, n);
    return n === 1 ? s : `${s}_${n}`;
  };
}

// ---- json --------------------------------------------------------------------------------------------------------------------------------------------------------------------
function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
// Deterministic text: insertion order is kept (the document order is the authored order); 2-space indent; trailing newline. No other degrees of freedom.
function toText(v) { return JSON.stringify(v, null, 2) + '\n'; }
function sha(text) { return crypto.createHash('sha256').update(text).digest('hex'); }
function writeIfChanged(p, text) { fs.mkdirSync(path.dirname(p), { recursive: true }); if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== text) { fs.writeFileSync(p, text); return true; } return false; }

// Structural equality, key order ignored, arrays ordered. Returns null when equal, else the first difference as {path, a, b}.
function diff(a, b, p = '$') {
  if (a === b) return null;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return { path: p, a, b };
  if (Array.isArray(a) !== Array.isArray(b)) return { path: p, a, b };
  if (Array.isArray(a)) {
    if (a.length !== b.length) return { path: p + '.length', a: a.length, b: b.length };
    for (let i = 0; i < a.length; i++) { const d = diff(a[i], b[i], `${p}[${i}]`); if (d) return d; }
    return null;
  }
  const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
  for (const k of ka) if (!(k in b)) return { path: `${p}.${k}`, a: a[k], b: undefined };
  for (const k of kb) if (!(k in a)) return { path: `${p}.${k}`, a: undefined, b: b[k] };
  for (const k of ka) { const d = diff(a[k], b[k], `${p}.${k}`); if (d) return d; }
  return null;
}
// Every difference (bounded), for reports.
function diffAll(a, b, p = '$', out = [], limit = 200) {
  if (out.length >= limit) return out;
  if (a === b) return out;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object' || Array.isArray(a) !== Array.isArray(b)) { out.push({ path: p, a, b }); return out; }
  if (Array.isArray(a)) {
    if (a.length !== b.length) { out.push({ path: p + '.length', a: a.length, b: b.length }); return out; }
    for (let i = 0; i < a.length; i++) diffAll(a[i], b[i], `${p}[${i}]`, out, limit);
    return out;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of [...keys].sort()) {
    if (!(k in a)) out.push({ path: `${p}.${k}`, a: undefined, b: b[k] });
    else if (!(k in b)) out.push({ path: `${p}.${k}`, a: a[k], b: undefined });
    else diffAll(a[k], b[k], `${p}.${k}`, out, limit);
  }
  return out;
}
const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function authoredLegacy(db) { const o = {}; for (const [k, v] of Object.entries(db)) if (!COMPILER_KEYS.includes(k)) o[k] = v; return o; }

// The runtime's own chain resolution (qr.html _resolveIntakeChain, without the module lookup): the order a chain is asked in, and the branch map each resolved module carries.
// Used as the equivalence the chain projection is held to. A module named twice keeps its first position; a later `then` is kept only if the first has none (T170 / #180).
function resolveChain(chain) {
  const out = [], idx = new Map();
  const one = (module, then, params) => {
    const key = params && params.item_noun ? `${module}::${params.item_noun}` : module;
    if (idx.has(key)) { const prior = out[idx.get(key)]; if (then && Object.keys(then).length && !Object.keys(prior.then).length) prior.then = then; return; }
    idx.set(key, out.length); out.push({ key, module, then: then || {}, params: params || null });
  };
  for (const st of chain || []) {
    one(st.module, st.then, st.params);
    for (const targets of Object.values(st.then || {})) for (const t of targets || []) if (t !== st.module) one(t, undefined, undefined);
  }
  return out;
}
// Comparable form of a resolved chain: order of keys, and for each module the branch map as {label: sorted target set} (list order inside a value is not behavior; see design note 7.5).
function chainSignature(chain) {
  return resolveChain(chain).map(r => ({ key: r.key, module: r.module, params: r.params, then: Object.fromEntries(Object.entries(r.then).map(([l, ts]) => [l, [...(ts || [])].sort()])) }));
}

module.exports = { ROOT, PATHS, COMPILER_KEYS, SOURCE_SCHEMA_VERSION, DERIVATION_VERSION, INTERFACE_VERSION, ID_TYPES, ID_RE, idType, idOf, stripId, slug, uniqueSlugger, readJson, toText, sha, writeIfChanged, diff, diffAll,
  clone, isObj, authoredLegacy, resolveChain, chainSignature };
