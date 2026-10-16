#!/usr/bin/env node
/**
 * verify_deploy_order.js -- R-SYSTEM-DEPLOYORDER: deployment compatibility is explicit (T180 6/n).
 *
 * @enforces R-SYSTEM-DEPLOYORDER
 * @enforces R-TEST-CANFAIL
 * @detects DEFECT-TEST-CANTFAIL
 *
 * The Charter: "Artifacts sharing a contract declare compatible source-schema, derivation, and runtime-interface versions. A release states deployment order or ships atomically. At startup, the runtime
 * refuses a known incompatible combination with a clear diagnostic instead of continuing with a mixed shape that can throw, misroute, or misprice." Accomplishment: "published artifacts carry relevant
 * versions; the runtime checks them before customer work; and a deliberately mismatched fixture is refused with an actionable error."
 *
 * Four claims, one per clause. (R-SYSTEM-DEPLOY-CONTRACT, which verify_resolver_module.js and verify_resolver_wiring.js enforce, is the neighbouring Rule: WHO may read WHAT. This one is WHEN a combination is
 * allowed: what a release states, and what the runtime does at the first moment it can know.)
 *
 *   1. THE RELEASE STATES ITS ORDER   ssot/ENTITY_FIRST_DESIGN_NOTE.md section 14.6 says the release is atomic, gives the order for a release that cannot be, and says what a major interface change needs;
 *                                      and the files it names exist.
 *   2. THE ARTIFACT CARRIES ITS VERSIONS   The published artifact states source-schema, derivation and interface versions; the consumer contract accepts exactly those; the publisher and the consumer run the
 *                                      same check (one file); the versions agree with the source the artifact was derived from.
 *   3. A MISMATCH IS REFUSED, ACTIONABLY   For each way the versions can disagree (and for provenance, a missing index, and a malformed version) the pure check refuses, names WHICH version meaning disagrees,
 *                                      both values, and what to do.
 *   4. THE PAGE REFUSES AT STARTUP     Booted under each mismatched artifact: the resolver is unavailable as a whole (never part-used), __resolverStatus carries the reason and the detail, the console
 *                                      says it, the page still boots and serves, and a tap is answered by no index. Before any artifact has been checked the resolver answers nothing. A good
 *                                      artifact is not refused (no false alarm).
 *
 * R-TEST-CANFAIL: eight mutants (a page that stays quiet, a page that reports availability whatever the verdict, a resolver that skips the check, a check that stops comparing derivation versions, one that
 * stops comparing the source schema, one whose refusal drops the values, a doc without the order, a doc without the major-version rule) are each shown to turn a claim red.
 *
 * Neighbours that are NOT repeated here: that the page behaves identically with and without the resolver (verify_resolver_wiring.js); that a catalog failing its schema stops the boot with a visible panel
 * (verify_boot_failure_visible.js); that the publisher refuses an artifact no consumer could read (verify_publish_*). This file is about the combination.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..');
const { JSDOM } = require(path.join(__dirname, 'node_modules', 'jsdom'));
const { readPage } = require('./_page.js');

let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (detail ? '\n      ' + detail : '')); } };
const section = t => console.log('\n=== ' + t + ' ===');
const clone = o => JSON.parse(JSON.stringify(o));
const wait = ms => new Promise(r => setTimeout(r, ms));
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const HTML = readPage(path.join(ROOT, 'qr.html'));
const BTNYC = read('btnyc.json');
const ART = JSON.parse(read('ssot/derived/btnyc_graph.json'));
const CONTRACT = JSON.parse(read('schema/btnyc-interface-contract.json'));
const SOURCE = JSON.parse(read('ssot/btnyc_source.json'));
const NOTE = read('ssot/ENTITY_FIRST_DESIGN_NOTE.md');
const COMPAT_SRC = read('modules/artifact_compat.js');

// ---- the mismatched fixtures: one per way the combination can be wrong --------------------------------------------------------------------------------
// expect: the reason the resolver reports; mustSay: what an actionable diagnostic contains (the meaning that disagrees, the values, the way out)
const FIXTURES = [
  { id: 'source_schema', label: 'a newer source schema (2.0.0)', make: a => { a.$source.source_schema_version = '2.0.0'; }, kind: 'source_schema_version', reason: 'incompatible', mustSay: ['2.0.0', '1.1.0', 'Re-derive'] },
  { id: 'derivation_new', label: 'a newer derivation (9.9.9)', make: a => { a.$source.derivation_version = '9.9.9'; }, kind: 'derivation_version', reason: 'incompatible', mustSay: ['9.9.9', '1.2.0', 'Re-publish'] },
  { id: 'derivation_old', label: 'an older derivation (1.1.0)', make: a => { a.$source.derivation_version = '1.1.0'; }, kind: 'derivation_version', reason: 'stale', mustSay: ['1.1.0', '1.2.0', 'Re-publish'] },
  { id: 'interface_major', label: 'a different interface major (2.0.0)', make: a => { a.interface_version = '2.0.0'; }, kind: 'interface_version', reason: 'incompatible', mustSay: ['2.0.0', '1.1.0', 'publish and deploy together'] },
  { id: 'interface_old', label: 'an older interface minor (1.0.0)', make: a => { a.interface_version = '1.0.0'; }, kind: 'interface_version', reason: 'stale', mustSay: ['1.0.0', '1.1.0', 'older'] },
  { id: 'interface_garbled', label: 'an interface version that is not a version', make: a => { a.interface_version = 'one'; }, kind: 'interface_version', reason: 'incompatible', mustSay: ['"one"', 'semantic version'] },
  { id: 'no_provenance', label: 'no $source at all', make: a => { delete a.$source; }, kind: 'provenance', reason: 'incompatible', mustSay: ['$source'] },
  { id: 'index_missing', label: 'a required index absent', make: a => { delete a.picker; }, kind: 'required_index', reason: 'incompatible', mustSay: ['picker'] },
];
const mismatched = f => { const a = clone(ART); f.make(a); return a; };

// the picker request used to ask "does a tap get answered by an index?"
const TAP = (() => {
  const gKey = Object.keys(ART.picker)[0], g = ART.picker[gKey];
  const ent = g.component_entity_ids[0];
  return { group_id: gKey.replace(/^grp\./, ''), action: null, evidence: { kind: 'component', id: 'comp.' + ent.replace(/^ent\./, '') } };
})();

// ---- the pure check, loadable from mutated source -------------------------------------------------------------------------------------------------------
function loadCompat(src) { const m = { exports: {} }; new Function('module', 'self', src)(m, undefined); return m.exports; }
const Compat = loadCompat(COMPAT_SRC);

// pure-check verdict for one fixture: the problems and whether the diagnostic is actionable
function pureVerdict(compat, f) {
  const r = compat.check(mismatched(f), CONTRACT);
  const mine = r.problems.filter(p => p.kind === f.kind);
  const text = compat.refusal(r) || '';
  return { refused: !r.ok, named: mine.length > 0, said: f.mustSay.filter(s => text.includes(s)).length === f.mustSay.length, text };
}

// ---- the page under an artifact --------------------------------------------------------------------------------------------------------------------------
async function boot(html, artifact, opts) {
  opts = opts || {};
  const warns = [], errors = [], pageErrors = [];
  const dom = new JSDOM(html, {
    url: 'https://tommichael88.github.io/booktomnyc/qr.html', runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    beforeParse(window) {
      window.fetch = async url => {
        const u = String(url);
        if (u.includes('btnyc.json')) return { ok: true, json: async () => JSON.parse(BTNYC) };
        if (u.includes('btnyc_graph.json')) return opts.hang ? new Promise(() => {}) : { ok: true, json: async () => clone(artifact) };
        if (u.includes('btnyc-interface-contract.json')) return { ok: true, json: async () => clone(CONTRACT) };
        return { ok: false, status: 404 };
      };
      window.HTMLElement.prototype.scrollIntoView = function () {};
      window.console.warn = (...a) => warns.push(a.join(' '));
      window.console.error = (...a) => errors.push(a.join(' '));
      window.addEventListener('error', e => pageErrors.push(e.message));
    },
  });
  const w = dom.window;
  for (let i = 0; i < 80 && !(w.DB && w.__resolverStatus && w.__resolverStatus.status !== 'loading') && !(opts.hang && w.DB); i++) await wait(100);
  await wait(100);
  const res = w.Resolver && w.Resolver.current ? w.Resolver.current() : null;
  const out = {
    status: w.__resolverStatus ? w.__resolverStatus.status : null, reason: w.__resolverStatus ? w.__resolverStatus.reason : null, detail: w.__resolverStatus ? w.__resolverStatus.detail : null,
    available: !!(res && res.available), booted: !!(w.DB && w.DB.services && w.DB.services.length > 0 && w.document.querySelector('#category-card')),
    tap: res ? res.resolveTap(TAP) : null, warns, errors, pageErrors,
  };
  w.close();
  return out;
}
const artifactWarn = p => p.warns.find(m => /published artifact was not used/.test(m)) || '';

// what a refused page must show (claim 4) -- returned as a list of failed clauses, so mutants can be told apart from real defects
function judgePage(f, p) {
  const bad = [];
  if (p.status !== 'unavailable') bad.push('status is ' + p.status + ', not unavailable');
  if (p.reason !== f.reason) bad.push('reason ' + p.reason + ', expected ' + f.reason);
  if (p.available) bad.push('the resolver is available');
  if (!p.tap || p.tap.status !== 'unavailable') bad.push('a tap was answered: ' + JSON.stringify(p.tap && p.tap.status));
  const detail = p.detail || '';
  const missing = f.mustSay.filter(s => !detail.includes(s));
  if (missing.length) bad.push('detail lacks ' + missing.join(', ') + ' (detail: ' + detail.slice(0, 120) + ')');
  const warn = artifactWarn(p);
  if (!warn) bad.push('nothing said on the console'); else if (!warn.includes('(' + f.reason + ')') || (detail && !warn.includes(detail.slice(0, 40)))) bad.push('the console line does not carry the reason and the detail: ' + warn.slice(0, 160));
  if (!p.booted) bad.push('the page did not boot');
  if (p.pageErrors.length || p.errors.length) bad.push('page errors: ' + p.errors.concat(p.pageErrors).slice(0, 2).join(' | '));
  return bad;
}

function section146() {
  const i = NOTE.indexOf('### 14.6 Deployment order');
  return i < 0 ? '' : NOTE.slice(i);
}
function judgeDoc(text) {
  const bad = [];
  if (!/^### 14\.6 Deployment order \(R-SYSTEM-DEPLOYORDER\)/m.test(text)) bad.push('no section 14.6 naming the Rule');
  const s = text.slice(Math.max(0, text.indexOf('### 14.6 Deployment order')));
  if (!/A release is atomic: one commit is one Pages deployment/.test(s)) bad.push('does not state the release is atomic');
  const a = s.indexOf('widen the contract'), b = s.indexOf('publish the new artifact'), c = s.indexOf('narrow the contract');
  if (!(a > 0 && b > a && c > b)) bad.push('does not give the split-release order (widen -> publish -> narrow)');
  if (!/major version[\s\S]{0,200}version-gated|version-gated[\s\S]{0,200}major version/.test(s)) bad.push('does not say what a major interface change needs');
  if (!/ArtifactCompat\.check/.test(s) || !/__resolverStatus/.test(s)) bad.push('does not say what the runtime does at startup');
  return bad;
}

// ---- mutants -----------------------------------------------------------------------------------------------------------------------------------------------
function once(text, from, to, what) {
  const parts = text.split(from);
  if (parts.length !== 2) throw new Error('mutant "' + what + '": the anchor occurs ' + (parts.length - 1) + ' times, expected exactly once');
  return parts[0] + to + parts[1];
}

(async () => {
  section('1. The release states its order');
  {
    const bad = judgeDoc(section146());
    check('ssot/ENTITY_FIRST_DESIGN_NOTE.md 14.6 states atomic release, the split order, the major-version rule and the startup check', bad.length === 0, bad.join('; '));
    const named = ['qr.html', 'schema/btnyc-interface-contract.json', 'ssot/derived/btnyc_graph.json', 'btnyc.json'];
    const s = section146();
    check('it names the four files that share the contract, and all four exist', named.every(n => s.includes('`' + n + '`') && fs.existsSync(path.join(ROOT, n))), named.filter(n => !s.includes('`' + n + '`') || !fs.existsSync(path.join(ROOT, n))).join(', '));
    check('it names this test as the thing that holds the release to it', s.includes('test_harness/verify_deploy_order.js') && fs.existsSync(path.join(ROOT, 'test_harness/verify_deploy_order.js')));
  }

  section('2. The artifact carries its versions; the consumer accepts them; the publisher runs the consumer\'s check');
  {
    const src = ART.$source || {};
    check('the artifact states a source-schema version, a derivation version and an interface version, each a semantic version', [src.source_schema_version, src.derivation_version, ART.interface_version].every(v => /^\d+\.\d+\.\d+$/.test(v || '')), JSON.stringify([src.source_schema_version, src.derivation_version, ART.interface_version]));
    check('the three are distinct meanings, kept apart (the contract lists source-schema and derivation versions separately from the interface version)', Array.isArray(CONTRACT.accepts.source_schema_versions) && Array.isArray(CONTRACT.accepts.derivation_versions) && typeof CONTRACT.interface_version === 'string');
    const r = Compat.check(ART, CONTRACT);
    check('the committed artifact is accepted by the committed contract (the release as shipped is compatible)', r.ok, Compat.refusal(r));
    check('the artifact\'s source-schema version is the one the source it names declares', src.source_schema_version === SOURCE.source_schema_version, src.source_schema_version + ' vs ' + SOURCE.source_schema_version);
    check('the artifact states its derivation version the same way in both places it carries it ($source and derivation)', ART.derivation && ART.derivation.version === src.derivation_version && ART.derivation.source_schema_version === src.source_schema_version, JSON.stringify(ART.derivation && [ART.derivation.version, ART.derivation.source_schema_version]));
    const reexport = read('test_harness/tools/entity_first/artifact_compat.js');
    const publish = read('test_harness/tools/entity_first/publish.js');
    const QR_RAW = read('qr.html');
    check('the publisher runs the consumer\'s check: publish.js loads a one-line re-export of modules/artifact_compat.js, the file the page loads with its own script tag', /module\.exports = require\('\.\.\/\.\.\/\.\.\/modules\/artifact_compat\.js'\)/.test(reexport) && /require\('\.\/artifact_compat\.js'\)/.test(publish) && /<script src="[^"]*\/modules\/artifact_compat\.js"><\/script>/.test(QR_RAW));
  }

  section('3. Each mismatch is refused by the check, naming the version that disagrees');
  for (const f of FIXTURES) {
    const v = pureVerdict(Compat, f);
    check(f.label + ': refused; the [' + f.kind + '] problem is named; the text carries ' + f.mustSay.map(s => JSON.stringify(s)).join(', '), v.refused && v.named && v.said, v.text.slice(0, 220));
  }
  {
    const r = Compat.check(ART, CONTRACT);
    check('and the unmodified artifact is not refused (the fixtures differ from it in one fact each)', r.ok && r.problems.length === 0);
    check('each fixture differs from the real artifact in exactly the fact it names (nothing else was broken to make it fail)', FIXTURES.every(f => { const m = mismatched(f); const keys = ['$source', 'interface_version', 'picker']; const diff = keys.filter(k => JSON.stringify(m[k]) !== JSON.stringify(ART[k])); return diff.length === 1; }));
  }

  section('4. The page refuses a mismatched combination at startup, before customer work');
  const real = await boot(HTML, ART);
  check('a good artifact: available, nothing said about the artifact, the page booted, a tap is answered from the index (no false alarm)', real.status === 'available' && real.available && real.booted && !artifactWarn(real) && real.pageErrors.length === 0 && real.errors.length === 0 && real.tap && real.tap.status === 'resolved', JSON.stringify({ s: real.status, t: real.tap && real.tap.status, w: real.warns.slice(0, 2) }));
  const probes = {};
  for (const f of FIXTURES) {
    const p = await boot(HTML, mismatched(f));
    probes[f.id] = p;
    const bad = judgePage(f, p);
    check(f.label + ': unavailable (' + f.reason + '), whole; detail and console carry the values; a tap is answered by no index; the page boots and serves', bad.length === 0, bad.join('; '));
  }
  {
    const h = await boot(HTML, ART, { hang: true });
    check('before any artifact has been checked (the request has not answered) the resolver answers nothing: status "loading", unavailable, and a tap is not answered', h.status === 'loading' && !h.available && h.tap && h.tap.status === 'unavailable' && h.booted, JSON.stringify({ s: h.status, a: h.available, t: h.tap && h.tap.status }));
  }

  section('5. Each clause can fail (R-TEST-CANFAIL): mutants');
  const interfaceFx = FIXTURES.find(f => f.id === 'interface_major'), derivFx = FIXTURES.find(f => f.id === 'derivation_new'), schemaFx = FIXTURES.find(f => f.id === 'source_schema');
  {
    // a page that stays quiet when it refuses
    const m1 = once(HTML, 'if (!_inst.available) console.warn(', 'if (false) console.warn(', 'quiet page');
    const p = await boot(m1, mismatched(interfaceFx));
    check('MUTANT a page that refuses but says nothing: claim 4 turns red on "nothing said on the console"', judgePage(interfaceFx, p).some(b => /nothing said/.test(b)), judgePage(interfaceFx, p).join('; '));
    // a page that reports availability whatever the verdict
    const m2 = once(HTML, 'window.__resolverStatus = _inst.available ? {', 'window.__resolverStatus = true ? {', 'status lie');
    const p2 = await boot(m2, mismatched(interfaceFx));
    check('MUTANT a page that reports "available" whatever the verdict: claim 4 turns red on the status', judgePage(interfaceFx, p2).some(b => /status is available/.test(b)), judgePage(interfaceFx, p2).join('; '));
    // a resolver that skips the check: the mismatched artifact is read as if compatible
    const m3 = once(HTML, 'try { verdict = ArtifactCompat.check(artifact, contract); }', 'try { verdict = { ok: true, problems: [] }; }', 'resolver skips check');
    const p3 = await boot(m3, mismatched(interfaceFx));
    check('MUTANT a resolver that skips the compatibility check: the mismatched artifact is used (available), and claim 4 turns red', p3.available === true && judgePage(interfaceFx, p3).length > 0, JSON.stringify({ a: p3.available, s: p3.status }));
  }
  {
    // a check that stops comparing the derivation version
    const anchor = "if (typeof src.derivation_version === 'string' && !contract.accepts.derivation_versions.includes(src.derivation_version)) say(";
    const m4src = once(COMPAT_SRC, anchor, "if (false) say(", 'no derivation compare');
    const C4 = loadCompat(m4src);
    const v4 = pureVerdict(C4, derivFx);
    check('MUTANT a check that stops comparing derivation versions: the derivation fixture is not refused, and claim 3 turns red', !v4.refused || !v4.named, v4.text.slice(0, 120));
    const anchor5 = "if (typeof src.source_schema_version === 'string' && !contract.accepts.source_schema_versions.includes(src.source_schema_version)) say(";
    const C5 = loadCompat(once(COMPAT_SRC, anchor5, 'if (false) say(', 'no schema compare'));
    const v5 = pureVerdict(C5, schemaFx);
    check('MUTANT a check that stops comparing the source schema: the source-schema fixture is not refused, and claim 3 turns red', !v5.refused || !v5.named, v5.text.slice(0, 120));
    // a refusal that drops the values (a diagnostic that is not actionable)
    const C6 = loadCompat(once(COMPAT_SRC, "say('derivation_version', `the artifact has derivation version ${src.derivation_version}; this consumer accepts ${contract.accepts.derivation_versions.join(', ')}. Re-publish with an accepted derivation.`)", "say('derivation_version', 'incompatible derivation')", 'terse refusal'));
    const v6 = pureVerdict(C6, derivFx);
    check('MUTANT a refusal that says only "incompatible derivation": still refused, but the diagnostic is not actionable (no values, no way out), and claim 3 turns red', v6.refused && v6.named && !v6.said, v6.text.slice(0, 120));
  }
  {
    const noOrder = section146().replace('widen the contract', 'change the contract');
    const noMajor = section146().replace(/version-gated/g, 'handled');
    check('MUTANT a design note without the split-release order: claim 1 turns red', judgeDoc(noOrder).some(b => /split-release order/.test(b)), judgeDoc(noOrder).join('; '));
    check('MUTANT a design note without the major-version rule: claim 1 turns red', judgeDoc(noMajor).some(b => /major interface change/.test(b)), judgeDoc(noMajor).join('; '));
    check('and the real note passes the same judge (the mutants differ from it only in the sentence they remove)', judgeDoc(section146()).length === 0);
  }

  console.log(`\n[Deployment order: explicit, checked, refused with an actionable error] ${pass} passed, ${fail} failed (of ${pass + fail} checks)`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
