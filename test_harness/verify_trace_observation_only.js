#!/usr/bin/env node
/**
 * verify_trace_observation_only.js
 *
 * @enforces R-GOVERN-INDEX
 *
 * WHAT THIS PROVES (PHASE_PLAN.md Phase A, A4, with PENDING_DECISIONS #77's qualifier: "trace is observation-only; a trace code path that affects results is a defect").
 * Trace is non-optional: every `_trace` call is recorded in a bounded ring buffer whether or not the overlay is open, every workflow step reports to it, and
 * `window.__traceLast()` returns the newest entry. And it stays observation-only: running every service through the workflow with the tracer absent, present-but-closed and
 * open gives byte-identical routes. Each claim is shown able to fail (a check that cannot fail proves nothing; R-INVARIANT-PREFIX: this file was run against the pre-change
 * tracer and orchestrator first and was red there), including a MUTANT tracer that edits the payload it is handed, which the identical-routes check must catch.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require(path.join(__dirname, 'node_modules', 'jsdom'));

const REPO_ROOT = path.dirname(__dirname);
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));
const SRC = f => fs.readFileSync(path.join(REPO_ROOT, f), 'utf8');
const TRACE_SRC = SRC('modules/trace.js');

let pass = 0, fail = 0;
function check(label, cond, detail) {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + (detail ? '\n      ' + detail : '')); }
}

// A page-like window with the three engines loaded the way qr.html loads them, with the tracer present (open or closed) or absent.
function world({ tracer, open = false } = {}) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://example.test/' });
  const w = dom.window;
  w.DB = JSON.parse(JSON.stringify(DB)); w.SERVICE_DATA = w.DB;
  if (tracer) { w.eval(tracer === true ? TRACE_SRC : tracer); w._traceEnabled = !!open; }
  // one evaluation, as the page shares one global lexical scope across its <script> blocks (a module-level `const` must be visible to the next module)
  w.eval(['nlp_engine.js', 'pricing_engine.js', 'orchestrator_engine.js'].map(SRC).join('\n'));
  return w;
}
// the newest entry as the page exposes it; undefined (not a crash) when the page has no such accessor, so each check fails on its own
const lastOf = w => (typeof w.__traceLast === 'function' ? w.__traceLast() : undefined);
const routeOf = (w, svc) => { const ctx = w.collectBookingContext_catalog(svc, svc.ui_taxonomy.category_id); return JSON.stringify(w.executeWorkflow(ctx, w.DB)); };
const freeTextRouteOf = (w, text) => JSON.stringify(w.executeWorkflow(w.collectBookingContext_freeText(text), w.DB));

(async () => {
  console.log('=== 1. recording is non-optional: the overlay being closed does not stop it ===');
  {
    const w = world({ tracer: true, open: false });
    check('the overlay is closed in this world', w._traceEnabled === false);
    const id = w._trace('test_layer', 'first', { n: 1 });
    check('a call with the overlay closed is recorded (it returns an entry id, the log has the entry)', id != null && w._traceLog.length === 1 && w._traceLog[0].label === 'first', 'returned ' + id + ', log length ' + w._traceLog.length);
    check('window.__traceLast() returns the newest entry', typeof w.__traceLast === 'function' && lastOf(w) && lastOf(w).label === 'first' && lastOf(w).data.n === 1);
    w._trace('test_layer', 'second', { n: 2 });
    check('... and then the one after it', lastOf(w) && lastOf(w).label === 'second' && w._traceLog.length === 2);
    const fn = w._traceFn('someFunction', { a: 1 }); fn.branch('left', { x: 1 }); fn.return({ ok: true });
    check('a function trace (call, branch, return) is recorded with the overlay closed', ['someFunction', 'someFunction:branch', 'someFunction'].every((l, i) => w._traceLog[2 + i] && w._traceLog[2 + i].label === l), w._traceLog.slice(2).map(e => e.layer + ':' + e.label).join(', '));
    w.close();
  }

  console.log('\n=== 2. the recorder is a bounded ring: the oldest entries go first, memory does not grow with the session ===');
  {
    const w = world({ tracer: true, open: false });
    const CAP = w._traceRingCapacity || 2000;
    const held = w._traceLog; // a reference other code may hold
    for (let i = 1; i <= CAP * 2 + 500; i++) w._trace('ring', 'n' + i, { i });
    const N = CAP * 2 + 500;
    check(`after ${N} calls the log holds exactly its capacity (${CAP})`, w._traceLog.length === CAP, 'length ' + w._traceLog.length);
    check('the newest entry is the last call, and the oldest retained is exactly capacity-1 before it (the OLDEST were dropped, one at a time)', lastOf(w) && lastOf(w).label === 'n' + N && w._traceLog[0] && w._traceLog[0].label === 'n' + (N - CAP + 1), (w._traceLog[0] && w._traceLog[0].label) + ' .. ' + (lastOf(w) && lastOf(w).label));
    check('entry ids are strictly increasing across the drops', w._traceLog.every((e, i) => i === 0 || e.id > w._traceLog[i - 1].id));
    check('the array other code holds is still the log (dropped in place, not replaced)', held === w._traceLog);
    w.close();
  }

  console.log('\n=== 3. every workflow step reports to the tracer ===');
  {
    const w = world({ tracer: true, open: false });
    const svc = w.DB.services[0];
    const ctx = w.collectBookingContext_catalog(svc, svc.ui_taxonomy.category_id);
    w._traceLog.length = 0;
    w.executeWorkflow(ctx, w.DB);
    const seen = w._traceLog.filter(e => e.layer === 'orchestrator_engine' && /^executeWorkflow: step /.test(e.label)).map(e => e.label.replace('executeWorkflow: step ', ''));
    const want = w.DB.workflow.steps.map(s => s.id).concat(['intake_bypass_rules']);
    check(`all ${want.length} steps (the ${w.DB.workflow.steps.length} authored ones, then the standalone intake_bypass_rules) are recorded, in order, with the overlay closed`, JSON.stringify(seen) === JSON.stringify(want), 'saw ' + JSON.stringify(seen));
    const lookup = w._traceLog.find(e => e.label === 'executeWorkflow: step resolve_entity');
    check('a step entry carries what the step produced (the entity the lookup found)', lookup && lookup.data.operation === 'lookup' && lookup.data.output_summary && lookup.data.output_summary.entityId === svc.id, JSON.stringify(lookup && lookup.data));
    w.close();
  }

  console.log('\n=== 4. observation-only (#77): the tracer cannot change a result ===');
  {
    const services = DB.services;
    const absent = world({}), closed = world({ tracer: true, open: false }), open = world({ tracer: true, open: true });
    const diffs = { closed: [], open: [] };
    for (const svc of services) {
      const a = routeOf(absent, absent.DB.services.find(s => s.id === svc.id));
      if (routeOf(closed, closed.DB.services.find(s => s.id === svc.id)) !== a) diffs.closed.push(svc.id);
      if (routeOf(open, open.DB.services.find(s => s.id === svc.id)) !== a) diffs.open.push(svc.id);
    }
    const texts = services.map(s => s.ui_taxonomy.display_name);
    for (const t of texts) {
      const a = freeTextRouteOf(absent, t);
      if (freeTextRouteOf(closed, t) !== a) diffs.closed.push('text:' + t);
      if (freeTextRouteOf(open, t) !== a) diffs.open.push('text:' + t);
    }
    check(`${services.length} catalog routes and ${texts.length} free-text routes are byte-identical with the tracer absent, present-but-closed, and open`, diffs.closed.length === 0 && diffs.open.length === 0, 'closed differs: ' + diffs.closed.slice(0, 3) + '; open differs: ' + diffs.open.slice(0, 3));
    check('... and the tracer really was recording while they ran (this is not a comparison against an idle tracer)', closed._traceLog.length > 500 && open._traceLog.length > 500, closed._traceLog.length + ' / ' + open._traceLog.length);

    // A payload is never edited, and a bad payload never throws to the caller.
    const payload = { a: { b: 1 }, list: [1, 2] }; const before = JSON.stringify(payload);
    closed._trace('t', 'payload', payload); payload.a.b = 99;
    check('the payload is cloned before it is stored: editing the caller\'s object afterwards does not edit the log, and the call did not edit the caller\'s object', lastOf(closed) && lastOf(closed).data.a.b === 1 && before === JSON.stringify({ a: { b: 1 }, list: [1, 2] }));
    const circ = { name: 'c' }; circ.self = circ;
    let threw = false, hostile = null; try { hostile = closed._trace('t', 'circular', circ); closed._trace('t', 'throwing getter', { get boom() { throw new Error('nope'); } }); } catch (_) { threw = true; }
    check('a circular payload and a payload with a throwing getter do not throw to the caller', !threw && hostile != null);

    // MUTANT: a tracer that edits the object it is handed. The identical-routes check must see it.
    const mutantSrc = TRACE_SRC + '\nwindow._trace = function(layer, label, data) { if (data && data.output_summary && typeof data.output_summary === "object") data.output_summary.__edited_by_tracer = true; return null; };';
    const mutant = world({ tracer: mutantSrc, open: false });
    let caught = 0; for (const svc of services.slice(0, 20)) if (routeOf(mutant, mutant.DB.services.find(s => s.id === svc.id)) !== routeOf(absent, absent.DB.services.find(s => s.id === svc.id))) caught++;
    check('MUTANT (a tracer that writes into the data it is handed): the identical-routes check catches it, so the check can fail', caught > 0, caught + ' of 20 routes differed');
    [absent, closed, open, mutant].forEach(w => w.close());
  }

  console.log('\n=== 4b. observation-only at the page level: the real page renders the same with the tracer absent, closed and open ===');
  {
    const HTML = require('./_page.js').readPage(process.env.QR_HTML || path.join(REPO_ROOT, 'qr.html'));
    const SCHEMA = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'schema', 'btnyc_schema.json'), 'utf8'));
    const TAG = '<script src="https://tommichael88.github.io/booktomnyc/modules/trace.js"></script>';
    const wait = ms => new Promise(r => setTimeout(r, ms));
    async function page({ tracerSrc, open }) {
      if (!HTML.includes(TAG)) throw new Error('anchor missing: the page no longer loads trace.js by that tag');
      const html = HTML.replace(TAG, tracerSrc ? '<script>' + tracerSrc.replace(/<\/script>/g, '<\\/script>') + (open ? '\nwindow._traceEnabled = true;' : '') + '</script>' : '');
      const dom = new JSDOM(html, {
        url: 'https://tommichael88.github.io/booktomnyc/qr.html', runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
        beforeParse(w) {
          w.fetch = async u => { const url = String(u); return url.includes('btnyc_schema.json') ? { ok: true, status: 200, json: async () => SCHEMA } : url.includes('btnyc.json') ? { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(DB)) } : { ok: false, status: 404 }; };
          w.HTMLElement.prototype.scrollIntoView = function () {};
        },
      });
      await wait(2500);
      const w = dom.window, d = w.document;
      const snap = () => { const c = d.body.cloneNode(true); c.querySelectorAll('script,[id^=trace]').forEach(n => n.remove()); return c.innerHTML.replace(/\s+/g, ' '); };
      const out = { boot: snap() };
      w.showGroupsForCategory(DB.category[0].id); await wait(200); out.groups = snap();
      d.getElementById('sqDescIn').value = 'fix my leaky kitchen faucet'; w.sqAnalyze(); await wait(500); out.analyze = snap();
      out.recorded = w._traceLog ? w._traceLog.length : 0;
      w.close(); return out;
    }
    const absent = await page({}), closed = await page({ tracerSrc: TRACE_SRC, open: false }), open = await page({ tracerSrc: TRACE_SRC, open: true });
    const stages = ['boot', 'groups', 'analyze'];
    check('the real page\'s rendered output (boot, a category\'s groups, a typed request analysed) is identical with the tracer absent, present-but-closed, and open', stages.every(k => absent[k] === closed[k] && absent[k] === open[k]), stages.filter(k => absent[k] !== closed[k] || absent[k] !== open[k]).join(', ') + ' differ');
    check('... and the tracer recorded the whole session while the overlay was closed (boot-to-analysis, including the nine workflow steps)', closed.recorded >= 12, 'recorded ' + closed.recorded);
    const mutantSrc = TRACE_SRC + '\nwindow._trace = function () { document.body.appendChild(document.createElement("div")); return null; };';
    const mutant = await page({ tracerSrc: mutantSrc, open: false });
    check('MUTANT (a tracer that edits the page): the page-level comparison catches it, so the check can fail', stages.some(k => mutant[k] !== absent[k]));
  }

  console.log('\n=== 5. the policy is written where the next author will read it ===');
  check('trace.js states, in its header, that trace is observation-only per #77 and that a trace code path that affects results is a defect', /trace is observation-only per #77; a trace code path that affects results is a defect/.test(TRACE_SRC.slice(0, 3000)));

  console.log(`\n[trace is non-optional and observation-only, A4] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
  process.exit(fail ? 1 : 0);
})();
