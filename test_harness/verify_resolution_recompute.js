#!/usr/bin/env node
/**
 * verify_resolution_recompute.js -- R-RESOLUTION-RECOMPUTE: after every accepted evidence mutation, incremental resolution equals fresh resolution (T180 6/n).
 *
 * @enforces R-RESOLUTION-RECOMPUTE
 * @enforces R-TEST-CANFAIL
 * @detects DEFECT-TEST-CANTFAIL
 *
 * THE RULE (Charter, Part VII): "Every canonical evidence mutation must be followed by downstream re-resolution before the next decision. The mechanical test mutates one BookingContext fact at a time, records the
 * incremental result, then resolves a fresh context containing the same resulting facts. The two results must agree for resolved scope, complexity profile, active uncertainty classes, retired uncertainty, Ci, Cx, tx,
 * precision policy, pricing result, and checkout state. The same test verifies that the next intake action is selected from the new state rather than from the pre-answer chain."
 *
 * WHAT IS HELD, through the production workflow (executeWorkflow, orch_apply_answer, orch_apply_quantity -- the three engine modules whole):
 *   1. EVERY ONE-ANSWER STEP. For every service, every unanswered question, every answer: the route orch_apply_answer returns is compared with a FRESH resolution of a deep copy of the facts it ended with
 *      (the context, serialized and read back, so nothing but the facts can carry over). Compared: the resolved entity, price, checkout state, skill tier, Ci/Cx (score) and the bar, the verdict, whether the fork
 *      is offered and at what fee, whether the triage is pending, and the NEXT INTAKE ACTION (the chain, in order, and the first question still open).
 *   2. ORDER. Two answers given in either order resolve to the same state: for every service with two open questions, three answers each.
 *   3. QUANTITY. orch_apply_quantity(route, n) equals a fresh resolution with that quantity, for every service at quantities 1, 2, 5, 20.
 *   4. THE NEXT ACTION IS FROM THE NEW STATE: the question just answered is not offered again; an answer that routes the job to another service replaces the chain with that service's.
 *   5. NON-VACUITY (R-TEST-CANFAIL): three mutants -- the pre-answer quote kept, the pre-answer chain kept, earlier answers dropped -- are each found by the check that guards them.
 *
 * NOT HELD, FOUND, PINNED (KNOWN GAP, filed with the recovery engine, Prompt 3 / PENDING_DECISIONS #231): the customer's choice of the Fork's first path ("answer a few more questions") lives on the ROUTE
 * (divergenceApplied), not in the BookingContext. orch_apply_answer carries it forward, so the incremental result is right; but a fresh resolution from the facts alone has lost the deep-dive questions.
 * Anything that rebuilds a route from the context (a restore, a reload, a second renderer) shows the customer a shorter chain than the one they chose. Measured below: which services, and how.
 *
 * "Active uncertainty classes, retired uncertainty, precision policy" do not exist in the runtime yet (no ledger: verify_confidence_accounting.js); they join this comparison when the confidence engine lands.
 * Node only; no browser, no network.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.BTNYC_ROOT ? path.resolve(process.env.BTNYC_ROOT) : path.resolve(__dirname, '..');
const MODULES = ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js'];
let passed = 0, failed = 0;
const check = (label, ok, detail) => { if (ok) { passed++; console.log('  ✓ ' + label); } else { failed++; console.log('  ✗ ' + label + (detail ? ' -- ' + detail : '')); } };
const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
const TEXT = Object.fromEntries(MODULES.map(f => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]));
const clone = o => JSON.parse(JSON.stringify(o));

function load(wrap) {
  const db = clone(DB), sb = { DB: db, SERVICE_DATA: db, window: { DB: db }, console: { log() {}, warn() {}, error() {} } }; sb.global = sb; vm.createContext(sb);
  for (const f of MODULES) vm.runInContext(TEXT[f], sb, { filename: f });
  if (wrap) wrap(sb);
  return sb;
}
const open = r => (r.visibleChain || []).filter(m => !(r.answers || {})[m.moduleKey]);
const view = (r, ordered) => {
  const q = r.quote || {}, c = r.confidence || {};
  const chain = (r.visibleChain || []).map(m => m.moduleKey);
  return JSON.stringify({
    entity: r.entity && r.entity.id, price: q.laborEstimate, state: q.checkoutStateKey, tier: q.complexityTier, score: c.score, bar: c.minConf, meets: q.meetsConfidenceBar,
    fork: q.divergenceEligible, fee: q.divergenceFee, triage: !!r.triagePending, chain: ordered ? chain : chain.slice().sort(), nextOpen: (open(r)[0] || {}).moduleKey || null,
  });
};
const freshOf = (sb, route) => sb.executeWorkflow(clone(route.context), sb.DB);       // a deep copy of the facts: nothing else can carry over

function oneAnswerSweep(sb) {
  const o = { steps: 0, mismatches: [], reoffered: [], errors: [], services: 0 };
  for (const s of sb.DB.services) {
    let r0; try { r0 = sb.executeWorkflow(sb.collectBookingContext_catalog(s, s.ui_taxonomy.category_id), sb.DB); } catch (e) { o.errors.push(s.id + ': ' + e.message); continue; }
    o.services++;
    for (const m of open(r0)) for (const opt of (m.client_response || [])) {
      try {
        const r1 = sb.orch_apply_answer(r0, m.moduleKey, opt.label, sb.DB), r2 = freshOf(sb, r1); o.steps++;
        if (view(r1, true) !== view(r2, true)) o.mismatches.push(`${s.id} / ${m.moduleKey} = ${opt.label}: incremental ${view(r1, true)} vs fresh ${view(r2, true)}`);
        // the answer is recorded as given (a routing answer may be recorded alongside the target's own carried answers), and it is never the next thing asked
        const recorded = r1.answers && r1.answers[m.moduleKey] === opt.label;
        if ((!recorded && r1.entity && r1.entity.id === s.id) || (open(r1)[0] || {}).moduleKey === m.moduleKey) o.reoffered.push(`${s.id} / ${m.moduleKey} = ${opt.label}`);
      } catch (e) { o.errors.push(`${s.id} / ${m.moduleKey}: ${e.message}`); }
    }
  }
  return o;
}
function orderSweep(sb) {
  const o = { pairs: 0, dependent: [], errors: [] };
  for (const s of sb.DB.services) {
    const r0 = sb.executeWorkflow(sb.collectBookingContext_catalog(s, s.ui_taxonomy.category_id), sb.DB), op = open(r0);
    for (let i = 0; i < op.length; i++) for (let j = i + 1; j < op.length; j++) for (const oa of (op[i].client_response || []).slice(0, 3)) for (const ob of (op[j].client_response || []).slice(0, 3)) {
      try {
        const ab = sb.orch_apply_answer(sb.orch_apply_answer(r0, op[i].moduleKey, oa.label, sb.DB), op[j].moduleKey, ob.label, sb.DB);
        const ba = sb.orch_apply_answer(sb.orch_apply_answer(r0, op[j].moduleKey, ob.label, sb.DB), op[i].moduleKey, oa.label, sb.DB);
        o.pairs++; if (view(ab, false) !== view(ba, false)) o.dependent.push(`${s.id}: ${op[i].moduleKey}=${oa.label} then ${op[j].moduleKey}=${ob.label}`);
      } catch (e) { o.errors.push(s.id + ': ' + e.message); }
    }
  }
  return o;
}
function quantitySweep(sb) {
  const o = { steps: 0, mismatches: [], errors: [] };
  for (const s of sb.DB.services) {
    const r0 = sb.executeWorkflow(sb.collectBookingContext_catalog(s, s.ui_taxonomy.category_id), sb.DB);
    for (const n of [1, 2, 5, 20]) { try { const r1 = sb.orch_apply_quantity(r0, n, sb.DB), r2 = freshOf(sb, r1); o.steps++; if (view(r1, true) !== view(r2, true)) o.mismatches.push(`${s.id} x${n}`); } catch (e) { o.errors.push(s.id + ': ' + e.message); } }
  }
  return o;
}

console.log('verify_resolution_recompute.js');
const sb = load();
console.log('\n1. Every one-answer step: incremental = fresh resolution of the facts it ended with');
const A = oneAnswerSweep(sb);
check(`the sweep ran ${A.steps} steps over ${A.services} services through the production workflow, no error`, A.steps > 400 && A.services === DB.services.length && A.errors.length === 0, A.errors.slice(0, 2).join('; '));
check(`incremental and fresh agree on entity, price, checkout state, tier, score, bar, verdict, fork and fee, triage, the chain in order and the next open question -- disagreements: ${A.mismatches.length}`, A.mismatches.length === 0, A.mismatches.slice(0, 2).join('\n'));

console.log('\n2. Order: two answers in either order give one state');
const O = orderSweep(sb);
check(`${O.pairs} two-answer sequences, no error`, O.pairs > 800 && O.errors.length === 0, O.errors.slice(0, 2).join('; '));
check(`both orders resolve to the same entity, price, state, tier, score, bar, verdict, fork, triage, chain (as a set) and next open question -- order-dependent: ${O.dependent.length}`, O.dependent.length === 0, O.dependent.slice(0, 3).join('\n'));

console.log('\n3. Quantity: orch_apply_quantity = fresh resolution with that quantity');
const Q = quantitySweep(sb);
check(`${Q.steps} steps (every service x 1, 2, 5, 20), no error; disagreements: ${Q.mismatches.length}`, Q.steps === DB.services.length * 4 && Q.errors.length === 0 && Q.mismatches.length === 0, Q.errors.concat(Q.mismatches).slice(0, 3).join('; '));

console.log('\n4. The next intake action is selected from the new state');
check(`the answer is recorded as given and the question just answered is never the next one asked (${A.steps} answers checked; violations: ${A.reoffered.length})`, A.reoffered.length === 0, A.reoffered.slice(0, 3).join('; '));
{ // an answer that routes the job to another service: the chain is the new service's, not the one it was
  let routed = 0; const bad = [];
  for (const s of sb.DB.services) {
    const r0 = sb.executeWorkflow(sb.collectBookingContext_catalog(s, s.ui_taxonomy.category_id), sb.DB);
    for (const m of open(r0)) for (const opt of (m.client_response || []).filter(x => x.route_to)) {
      const r1 = sb.orch_apply_answer(r0, m.moduleKey, opt.label, sb.DB);
      if (!r1.entity || r1.entity.id === s.id) continue;
      routed++;
      // the new service resolved on its own, given the answers the job carries (a carried answer can unlock a dependent question of the new service)
      const target = sb.DB.services.find(x => x.id === r1.entity.id), tctx = sb.collectBookingContext_catalog(target, target.ui_taxonomy.category_id);
      tctx.answers = Object.assign({}, tctx.answers || {}, clone(r1.answers || {}));
      const fresh = sb.executeWorkflow(tctx, sb.DB);
      const known = new Set((fresh.visibleChain || []).map(x => x.moduleKey).concat(Object.keys(r1.answers || {})));
      const stray = (r1.visibleChain || []).map(x => x.moduleKey).filter(k => !known.has(k));
      if (stray.length) bad.push(`${s.id} -> ${r1.entity.id}: ${stray.join(',')} is from the pre-answer chain`);
    }
  }
  check(`${routed} answers route the job to another service; in each the chain offered is the new service's own for the answers carried, nothing is left over from the old one`, routed >= 3 && bad.length === 0, `${routed} routed; ` + bad.slice(0, 3).join('; '));
}

console.log('\n5. Non-vacuity: a resolver that keeps the pre-answer state is found');
{
  const stale = load(s => { const orig = s.orch_apply_answer; s.orch_apply_answer = (r, m, l, d) => { const n = orig(r, m, l, d); n.quote = r.quote; return n; }; });
  const a = oneAnswerSweep(stale);
  check(`mutant "the pre-answer quote kept": ${a.mismatches.length} one-answer steps now disagree with fresh resolution`, a.mismatches.length > 10, String(a.mismatches.length));
  const chain = load(s => { const orig = s.orch_apply_answer; s.orch_apply_answer = (r, m, l, d) => { const n = orig(r, m, l, d); n.visibleChain = r.visibleChain; return n; }; });
  const b = oneAnswerSweep(chain);
  check(`mutant "the pre-answer chain kept": ${b.mismatches.length} one-answer steps disagree with fresh resolution (the chain and the next question are the old ones)`, b.mismatches.length > 10, String(b.mismatches.length));
  const drop = load(s => { const orig = s.orch_apply_answer; s.orch_apply_answer = (r, m, l, d) => orig(Object.assign({}, r, { context: Object.assign({}, r.context, { answers: {} }) }), m, l, d); });
  const c = orderSweep(drop);
  check(`mutant "earlier answers dropped": ${c.dependent.length} two-answer sequences now depend on the order`, c.dependent.length > 50, String(c.dependent.length));
}

console.log('\n6. KNOWN GAP (pinned, #231 / the recovery engine): the Fork\'s first path is route state, not a fact in the context');
{
  const rows = [];
  for (const s of sb.DB.services.filter(x => (x.remote_deep_dive_modules || []).length)) {
    let r = sb.executeWorkflow(sb.collectBookingContext_catalog(s, s.ui_taxonomy.category_id), sb.DB);
    for (let i = 0; i < 14 && r.triagePending; i++) { const op = open(r); let moved = false; for (const m of op) { const o = (m.client_response || []).find(x => !x.route_to); if (o) { r = sb.orch_apply_answer(r, m.moduleKey, o.label, sb.DB); moved = true; break; } } if (!moved) break; }
    const rem = sb.orch_apply_remote_divergence(r, sb.DB); if (rem.divergenceApplied !== 'remote') continue;
    const deep = open(rem).pop(); if (!deep) continue;
    const inc = sb.orch_apply_answer(rem, deep.moduleKey, deep.client_response[0].label, sb.DB), fresh = freshOf(sb, inc);
    const lost = (inc.visibleChain || []).map(x => x.moduleKey).filter(k => !(fresh.visibleChain || []).some(y => y.moduleKey === k));
    rows.push({ id: s.id, lost, carried: Object.keys(inc.context).filter(k => /diverg|remote/i.test(k)) });
  }
  const gap = rows.filter(r => r.lost.length);
  check(`${rows.length} services have a Fork's first path; for ${gap.length} of them a fresh resolution of the facts alone has lost the deep-dive question(s) the customer chose (${gap.map(r => r.id + ': ' + r.lost.join('+')).join('; ')})`, rows.length >= 4 && gap.length === rows.length, `${gap.length} of ${rows.length}`);
  check('and the context carries no divergence fact (nothing for a rebuild to read)', rows.every(r => r.carried.length === 0), rows.filter(r => r.carried.length).map(r => r.id).join(','));
}

console.log(`\n[Resolution recompute: incremental = fresh] ${passed} passed, ${failed} failed (of ${passed + failed} checks)`);
process.exit(failed ? 1 : 0);
