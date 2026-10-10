#!/usr/bin/env node
/**
 * verify_ssot_boot_validation.js
 *
 * @enforces R-SYSTEM-NODATA, R-GOVERN-INDEX
 *
 * WHAT THIS PROVES (PHASE_PLAN.md Phase A, A3). The page validates btnyc.json against btnyc_schema.json at boot, and stops if the data does not conform.
 * Three claims, each shown to be able to fail (a check that cannot fail proves nothing; R-INVARIANT-PREFIX: this file was run against the pre-change page first and
 * was red there):
 *
 *   1. THE CHECKER AGREES WITH THE REFERENCE VALIDATOR. The in-tree validator (ajv, test_harness/node_modules) cannot run in the page, so the page carries a small pure
 *      checker (`orch_validate_ssot`, the Logic layer). It must give the same verdict as ajv on the real catalog AND on mutated copies of it: 30 directed mutations
 *      (every required top-level key removed, an unknown key added, a wrong type, a bad date-time, an enum and a minItems violation ...) plus 250 seeded random ones
 *      (a node deleted, retyped, nulled, emptied, or given an extra property). It also refuses to pass what it does not understand: a schema keyword it does not
 *      implement is an error, however deeply it sits.
 *   2. THE PAGE STOPS ON NON-CONFORMING DATA. In a real jsdom page, the real catalog boots (`window.renderRoute` exists, `window.__ssotValidation.status` is 'valid');
 *      a catalog missing a required key does NOT boot, never becomes DB, and the console says why; and if the gate is cut out of the source the same invalid catalog
 *      boots (so the check above is not vacuous).
 *   3. A MISSING SCHEMA FILE DOES NOT BREAK THE PAGE, but is loud: the page boots, the status says 'unavailable', and a warning is logged (PENDING_DECISIONS #119).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM, VirtualConsole } = require(path.join(__dirname, 'node_modules', 'jsdom'));
const Ajv = require(path.join(__dirname, 'node_modules', 'ajv'));
const addFormats = require(path.join(__dirname, 'node_modules', 'ajv-formats'));

const REPO_ROOT = path.dirname(__dirname);
const QR = process.env.QR_HTML || path.join(REPO_ROOT, 'qr.html');
const HTML = require('./_page.js').readPage(QR);
const BASE = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));
const SCHEMA = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'schema', 'btnyc_schema.json'), 'utf8'));
const clone = o => JSON.parse(JSON.stringify(o));

let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + (detail ? '\n      ' + detail : '')); }
}
const wait = ms => new Promise(r => setTimeout(r, ms));

// ─── the two validators ──────────────────────────────────────────────────────────────────────────────────────────────────────
const ajv = new Ajv({ allErrors: true, strict: false }); addFormats(ajv);
const ajvValidate = ajv.compile(SCHEMA);
const ajvVerdict = d => { const ok = ajvValidate(d); return { ok, paths: new Set((ajvValidate.errors || []).map(e => e.instancePath)) }; };
const sandbox = { console }; sandbox.window = sandbox; vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(REPO_ROOT, 'orchestrator_engine.js'), 'utf8'), sandbox, { filename: 'orchestrator_engine.js' });
const HAS_CHECKER = typeof sandbox.orch_validate_ssot === 'function';
const mine = (d, s) => HAS_CHECKER ? sandbox.orch_validate_ssot(d, s || SCHEMA) : { valid: null, errors: [{ path: '', message: 'orch_validate_ssot does not exist' }] };

(async () => {
  console.log('=== 1. the page\'s checker gives the same verdict as the reference validator (ajv) ===');
  check('the orchestrator module carries the checker (orch_validate_ssot)', HAS_CHECKER);
  check('the real catalog conforms, per both', ajvVerdict(BASE).ok === true && mine(BASE).valid === true, JSON.stringify(mine(BASE).errors.slice(0, 3)));
  check('the schema is published where btnyc.json\'s own $schema says it is, and the page reads it from there (T157: orch_resolve_schema_location)', (() => { const loc = typeof sandbox.orch_resolve_schema_location === 'function' ? sandbox.orch_resolve_schema_location(BASE) : null; return !!loc && loc.source === 'ssot.$schema' && fs.existsSync(path.join(REPO_ROOT, loc.path)); })());

  const mismatches = []; let invalidByAjv = 0, total = 0, pathAgree = 0, pathCases = 0;
  function compare(label, doc) {
    total++;
    const a = ajvVerdict(doc), m = mine(doc);
    if (!a.ok) invalidByAjv++;
    if (a.ok !== m.valid) mismatches.push(`${label}: ajv ${a.ok ? 'valid' : 'invalid'}, checker ${m.valid ? 'valid' : 'invalid'}${m.errors[0] ? ' (' + m.errors[0].path + ' ' + m.errors[0].message + ')' : ''}`);
    else if (!a.ok) { pathCases++; if (m.errors.some(e => a.paths.has(e.path) || [...a.paths].some(p => e.path === p || p.startsWith(e.path + '/') || e.path.startsWith(p + '/')))) pathAgree++; }
  }
  // directed mutations
  SCHEMA.required.forEach(k => { const d = clone(BASE); delete d[k]; compare('remove top-level "' + k + '"', d); });
  { const d = clone(BASE); d.__not_in_the_schema = 1; compare('unknown top-level key', d); }
  { const d = clone(BASE); d.services = {}; compare('services is an object', d); }
  { const d = clone(BASE); d.meta = []; compare('meta is an array', d); }
  { const d = clone(BASE); d.meta.last_updated = 'yesterday'; compare('meta.last_updated is not a date-time', d); }
  { const d = clone(BASE); delete d.services[0].id; compare('service[0] has no id', d); }
  { const d = clone(BASE); d.services[0].id = 17; compare('service[0].id is a number', d); }
  { const d = clone(BASE); d.services[0].__extra = true; compare('service[0] has an extra property (strict object?)', d); }
  { const d = clone(BASE); d.invariants = null; compare('invariants is null', d); }
  { const d = clone(BASE); d.services = null; compare('services is null', d); }
  // seeded random mutations
  let seed = 20260507; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const paths = []; (function walk(o, p, depth) { if (o && typeof o === 'object') { paths.push(p); if (depth < 6) Object.keys(o).slice(0, 40).forEach(k => walk(o[k], p.concat([k]), depth + 1)); } else paths.push(p); })(BASE, [], 0);
  const KINDS = ['delete', 'retype', 'null', 'empty', 'extra'];
  const kindName = v => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
  for (let i = 0; i < 250; i++) {
    const p = paths[Math.floor(rnd() * paths.length)]; if (!p.length) continue;
    const d = clone(BASE); let parent = d; for (let j = 0; j < p.length - 1; j++) parent = parent[p[j]]; const key = p[p.length - 1], cur = parent[key], kind = KINDS[Math.floor(rnd() * KINDS.length)];
    if (kind === 'delete') { if (Array.isArray(parent)) parent.splice(Number(key), 1); else delete parent[key]; }
    else if (kind === 'retype') parent[key] = ({ string: 7, number: 'x', boolean: 'true', object: [], array: {} })[kindName(cur)] ?? 'x';
    else if (kind === 'null') parent[key] = null;
    else if (kind === 'empty') parent[key] = Array.isArray(cur) ? [] : (cur && typeof cur === 'object') ? {} : '';
    else if (cur && typeof cur === 'object' && !Array.isArray(cur)) cur.__extra = 1; else parent[key] = cur;
    compare(`random #${i} ${kind} at /${p.join('/')}`, d);
  }
  check(`the checker and ajv return the same verdict on all ${total} documents (the real catalog and ${total - 1} mutated copies)`, mismatches.length === 0, mismatches.slice(0, 5).join('\n      '));
  check(`non-vacuity: many of those mutants are actually invalid under ajv (${invalidByAjv} of ${total}), so agreement is not "everything passes"`, invalidByAjv >= 60 && invalidByAjv < total, `${invalidByAjv} of ${total}`);
  check(`where both say invalid, the checker's complaint is at (or on the path to/from) a place ajv also complains about (${pathAgree} of ${pathCases})`, pathCases > 0 && pathAgree === pathCases, `${pathAgree} of ${pathCases}`);

  const u = (d, s) => mine(d, s);
  check('a schema keyword the checker does not implement is an error, not a silent pass (top level)', u({}, { type: 'object', minLength: 3 }).valid === false && /not supported/.test(u({}, { type: 'object', minLength: 3 }).errors[0].message));
  check('... and the same when it sits deep in the schema, in a branch the data never visits', u({}, { type: 'object', properties: { a: { type: 'array', items: { allOf: [] } } } }).valid === false);
  check('an unresolvable $ref is an error', u({}, { $ref: '#/$defs/nope', $defs: {} }).valid === false);
  check('the real schema uses only keywords the checker implements (so its verdicts can be trusted)', mine(BASE).errors.length === 0);

  console.log('\n=== 2. the page stops on non-conforming data ===');
  function world({ mutateDb, mutateHtml, schema = 'serve' } = {}) {
    const DB = clone(BASE); if (mutateDb) mutateDb(DB);
    let html = HTML; if (mutateHtml) html = mutateHtml(html);
    const logs = { error: [], warn: [], log: [] };
    const vc = new VirtualConsole(); ['error', 'warn', 'log'].forEach(k => vc.on(k, (...a) => logs[k].push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '))));
    const dom = new JSDOM(html, {
      url: 'https://tommichael88.github.io/booktomnyc/qr.html', runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
      beforeParse(w) {
        w.fetch = async u => {
          const url = String(u);
          if (url.includes('btnyc_schema.json')) return schema === 'serve' ? { ok: true, status: 200, json: async () => SCHEMA } : { ok: false, status: 404 };
          return url.includes('btnyc.json') ? { ok: true, status: 200, json: async () => DB } : { ok: false, status: 404 };
        };
        w.HTMLElement.prototype.scrollIntoView = function () {};
      },
    });
    return { dom, logs };
  }
  const booted = w => typeof w.renderRoute === 'function';

  const good = world(); await wait(2500);
  check('the real catalog boots: the page finished initializing and the validation status is "valid"', booted(good.dom.window) && good.dom.window.__ssotValidation && good.dom.window.__ssotValidation.status === 'valid', JSON.stringify(good.dom.window.__ssotValidation));
  check('... and nothing was logged as an error or warning on the way', good.logs.error.length === 0 && good.logs.warn.length === 0, (good.logs.error.concat(good.logs.warn)).slice(0, 2).join(' | '));
  good.dom.window.close();

  const dropKey = DB => { delete DB.invariants; };
  const bad = world({ mutateDb: dropKey }); await wait(2500);
  const bw = bad.dom.window, bv = bw.__ssotValidation || {};
  check('a catalog missing a required key does NOT boot', !booted(bw), 'renderRoute exists: the page booted');
  check('... the status is "invalid" and it names the missing key', bv.status === 'invalid' && (bv.errors || []).some(e => /invariants/.test(e.message)), JSON.stringify(bv).slice(0, 200));
  check('... the invalid catalog never became DB', !bw.DB, 'window.DB was set');
  check('... and the console says why (every problem, then the boot failure)', bad.logs.error.some(l => /does not conform/.test(l) && /invariants/.test(l)) && bad.logs.error.some(l => /failed to initialize/.test(l)), bad.logs.error.slice(0, 2).join(' | ').slice(0, 300));
  bad.dom.window.close();

  const GATE = "if (_ssot.status === 'invalid') {";   // T157: init keeps its verdict in a local (_ssot) and publishes it as window.__ssotValidation; the gate reads the local
  const ungated = world({ mutateDb: dropKey, mutateHtml: h => { if (!h.includes(GATE)) throw new Error('mutant anchor missing (the boot gate)'); return h.replace(GATE, 'if (false) {'); } }); await wait(2500);
  check('MUTANT (the gate cut out of the source): the same invalid catalog boots, so the check above can fail', booted(ungated.dom.window), 'the page did not boot even without the gate');
  ungated.dom.window.close();

  console.log('\n=== 3. a missing schema file does not break the page, and is loud ===');
  const nosch = world({ schema: 'missing' }); await wait(2500);
  const nw = nosch.dom.window;
  check('the page boots without the schema file', booted(nw));
  check('... the status says "unavailable"', nw.__ssotValidation && nw.__ssotValidation.status === 'unavailable', JSON.stringify(nw.__ssotValidation));
  check('... and a warning says the SSOT was not validated', nosch.logs.warn.some(l => /NOT validated/.test(l)), nosch.logs.warn.join(' | ').slice(0, 200));
  nosch.dom.window.close();

  console.log(`\n[SSOT boot validation, A3] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
  process.exit(fail ? 1 : 0);
})();
