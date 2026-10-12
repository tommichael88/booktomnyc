#!/usr/bin/env node
/**
 * verify_route_to_resolution.js -- an answer that settles WHICH service the job is, moves the job to that service, once, in the one place, and says so.
 *
 * @enforces R-CLIENT-CONVERGE
 * @enforces R-INVARIANT-CANONICAL
 * @enforces R-INTAKE-WIREREMOVE
 * @enforces P-WHITEFLAG-PRICED
 *
 * THE SHAPE (R-GOVERN-TRANSITION / R-SYSTEM-SHAPE: "a shape that forces a workaround is the defect"): the catalog could say "this answer adds $X" or "this answer opens question Y" and could not say
 * "this answer means the job is a different service". So "my laptop only works while plugged in" -- a battery, a $125 part replacement -- could only ever end on the diagnostic that asked the question, and
 * Computer Repair authored nothing but the diagnostic (PENDING_DECISIONS #180). An option may now carry
 *     "route_to": { "service": "<service id>", "answers": { "<module>": "<label>" }, "because": "<one sentence the customer reads>" }
 * and the ORCHESTRATOR (executeWorkflow, the one function every gateway passes through -- catalog tap, free text, other tile; Battle 7: "a single call in the right place") resolves it: the route that
 * comes back is the target service's, carrying the answers the customer gave and the ones the route names, and `route.routedFrom` is the record of why (R-INVARIANT-PROVENANCE). A renderer decides nothing.
 *
 * MEASURED BY WHAT THE RULE CLAIMS (P-GOVERN-GOODHART): the real engine at its public boundary (executeWorkflow, orch_apply_answer, orch_unroute), on the real catalog and on copies broken in one way:
 *   1. IT HOPS         An explicit answer whose option carries route_to returns the target's route; the customer's other answers come with it; the route's own answers are on it; routedFrom names module, answer, reason.
 *   2. IT DOES NOT     An option without route_to does not move the job; a route_to to a service that does not exist is ignored (no throw, no half-route).
 *   3. EVERY WAY IN    A tag whose `answers` names the routing question hops too (the typed sentence and the tile are the same fact as a tapped chip); so does the free-text context, and its recommendation follows.
 *   4. IDEMPOTENT      Running the returned route's own context again returns the same route (orch_apply_answer re-enters through it).
 *   5. TAKEN BACK      orch_unroute returns to the service that asked, with the routing answer gone and that route declined, so a tag that re-supplies the answer does not send the customer round again.
 *   6. TERMINATES      Two options that route to each other cannot loop: the engine stops at a bounded number of hops and never re-enters a service within one resolution.
 *   7. THE DATA        Every route_to in the catalog: the service exists, every named answer is a real module and a real label, `because` is a customer sentence (no bench jargon), the module that holds it is a
 *                      routing question (`purpose: "routing"`), and the target is not the service that asks. The catalog holds at least one (non-vacuity), and a planted dangling one is seen.
 *
 * RUN ON ANOTHER TREE (G-INVARIANT-PREFIX): BTNYC_ROOT=<tree> node test_harness/verify_route_to_resolution.js
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { check, finish } = require('./_shared.js');
const { engine } = require('./_engine.js');
const ROOT = process.env.BTNYC_ROOT ? path.resolve(process.env.BTNYC_ROOT) : path.resolve(__dirname, '..');
const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
const sb = { DB, SERVICE_DATA: DB, window: { DB }, console: { log() {}, warn() {}, error() {}, info() {}, debug() {} } }; sb.global = sb; vm.createContext(sb);
vm.runInContext(engine().wrapper, sb, { filename: 'engine_modules' });
sb.initNlpSets(); if (typeof sb.refreshNlpPreviewBindings === 'function') sb.refreshNlpPreviewBindings();
const clone = (o = DB) => JSON.parse(JSON.stringify(o));
// The engine reads the catalog it was booted with in several places (DB.intake_modules, DB.smart_tags), not only the `db` argument: a copy broken in one way must be the catalog the engine sees, or the
// planted defect is never in effect and the check passes for nothing. withDB swaps the sandbox's catalog for the copy for the duration of one block.
const withDB = (d, fn) => { const keep = [sb.DB, sb.window.DB, sb.SERVICE_DATA]; sb.DB = d; sb.window.DB = d; sb.SERVICE_DATA = d; try { return fn(); } finally { [sb.DB, sb.window.DB, sb.SERVICE_DATA] = keep; } };
const S = (name, fn) => { try { fn(); } catch (e) { check(name + ': ran to completion', false, { expected: 'no throw', got: String(e && e.stack || e).split('\n').slice(0, 2).join(' | ') }); } };
const brief = x => String(JSON.stringify(x)).slice(0, 360);

const HOST = 'computer_diagnostic', PARTS = 'internal_hardware_replacement';
const mod = (D, k) => D.intake_modules[k];
const opt = (D, m, re) => ((mod(D, m) || {}).client_response || []).find(o => re.test(o.label));
const batteryOpt = opt(DB, 'laptop_power_signs', /unplug/i), blackOpt = opt(DB, 'laptop_power_signs', /screen stays black/i);
const svc = (D, id) => D.services.find(s => s.id === id);
const catalogCtx = (D, id, answers, tags) => { const s = svc(D, id); const c = sb.collectBookingContext_catalog(s, s.ui_taxonomy.category_id); c.answers = Object.assign({}, answers || {}); if (tags) c.manuallyToggledTagIds = tags; return c; };
const run = (D, ctx) => sb.executeWorkflow(ctx, D);
const LAPTOP = 'Laptop', SYMPTOM = (DB.intake_modules.computer_symptom.client_response.find(o => /power on at all/i.test(o.label)) || {}).label;
const A0 = { device_type: LAPTOP, computer_symptom: SYMPTOM };

// ---- 7. the data (first, so a missing feature is named before the mechanism is blamed) -----------------------------------------------------------------------------------------------
const JARGON = /\b(psu|vrm|bios|post|dc jack|motherboard|logic board|rail|firmware|chipset)\b/i;
function routes(D) {
    const out = [];
    Object.entries(D.intake_modules).forEach(([m, def]) => (def.client_response || []).forEach((o, i) => { if (o.route_to) out.push({ module: m, i, label: o.label, rt: o.route_to, purpose: def.purpose }); }));
    return out;
}
function audit(D) {
    const bad = [];
    const svcs = new Set(D.services.map(s => s.id));
    for (const r of routes(D)) {
        const at = `${r.module}[${r.i}] "${r.label}"`;
        if (!r.rt || typeof r.rt !== 'object' || !svcs.has(r.rt.service)) { bad.push(`${at}: service "${r.rt && r.rt.service}" does not exist`); continue; }
        const target = D.services.find(s => s.id === r.rt.service);
        const chainMods = new Set((target.intake_chain || []).map(c => c.module));
        for (const [mk, lbl] of Object.entries(r.rt.answers || {})) {
            const m = D.intake_modules[mk];
            if (!m) bad.push(`${at}: answers names module "${mk}", which does not exist`);
            else if (!(m.client_response || []).some(o => o.label === lbl)) bad.push(`${at}: answers.${mk} = "${lbl}" is no label of that module`);
            else if (!chainMods.has(mk) && !(D.services.some(s => (s.intake_chain || []).some(c => c.module === mk)))) bad.push(`${at}: answers.${mk} is asked by no service`);
        }
        if (typeof r.rt.because !== 'string' || r.rt.because.trim().length < 25 || !/[.!]$/.test(r.rt.because.trim())) bad.push(`${at}: "because" is not a sentence the customer can read`);
        else if (JARGON.test(r.rt.because)) bad.push(`${at}: "because" uses bench jargon (${(r.rt.because.match(JARGON) || [])[0]})`);
        if (r.purpose !== 'routing') bad.push(`${at}: the question that routes is not marked purpose "routing"`);
        const owners = D.services.filter(s => (s.intake_chain || []).some(c => c.module === r.module)).map(s => s.id);
        if (owners.length && owners.every(id => id === r.rt.service)) bad.push(`${at}: routes to the only service that asks it`);
    }
    return bad;
}
const nRoutes = routes(DB).length;
check(`7.1 non-vacuity: the catalog authors route_to (${nRoutes})`, nRoutes >= 12, { expected: '>= 12', got: nRoutes });
const bad = audit(DB);
check('7.2 every route_to resolves: a real service, real modules and labels, a customer sentence for "because", on a routing question', bad.length === 0, { expected: 'none', got: bad.slice(0, 6) });
S('block 1', () => { const d = clone(); const r = routes(d)[0]; if (r) d.intake_modules[r.module].client_response[r.i].route_to.service = 'no_such_service';
  check('7.3 (non-vacuity) a planted dangling target is seen', !!r && audit(d).length > bad.length, { expected: '+1', got: audit(d).length - bad.length });
  const d2 = clone(); const r2 = routes(d2)[0]; if (r2) d2.intake_modules[r2.module].client_response[r2.i].route_to.because = 'Uses the motherboard rail.';
  check('7.4 (non-vacuity) planted bench jargon in "because" is seen', !!r2 && audit(d2).length > bad.length, { expected: '+1', got: audit(d2).length - bad.length }); });

// ---- 1. it hops --------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const hopCtx = catalogCtx(DB, HOST, Object.assign({}, A0, { laptop_power_signs: batteryOpt && batteryOpt.label }));
let r1 = null; try { r1 = run(DB, hopCtx); } catch (e) { r1 = { err: String(e && e.stack || e).split('\n')[0] }; }
const rt = (batteryOpt && batteryOpt.route_to) || {};
check('1.1 an explicit answer whose option carries route_to returns the TARGET service\'s route', !!batteryOpt && r1 && r1.entity && r1.entity.id === rt.service && r1.entity.id === PARTS, { expected: PARTS, got: r1 && (r1.err || (r1.entity && r1.entity.id)) });
check('1.2 the customer\'s other answers come with it, and the answers the route names are on it', !!r1 && !!r1.answers && r1.answers.device_type === LAPTOP && Object.entries(rt.answers || {}).length > 0 && Object.entries(rt.answers || {}).every(([k, v]) => r1.answers[k] === v), { expected: 'device_type + route answers', got: r1 && r1.answers });
check('1.3 routedFrom records module, answer and reason (provenance), and the context that produced the route is the target\'s', !!r1 && !!r1.routedFrom && r1.routedFrom.moduleKey === 'laptop_power_signs' && r1.routedFrom.label === (batteryOpt && batteryOpt.label) && r1.routedFrom.because === rt.because && r1.routedFrom.fromServiceId === HOST && r1.context && r1.context.selectedServiceId === PARTS, { expected: 'laptop_power_signs / label / because / ' + HOST, got: r1 && brief(r1.routedFrom) });
check('1.4 the target\'s own chain is what is left to ask (the question that routed is not on it, and what the route answered is not asked again)', !!r1 && Array.isArray(r1.visibleChain) && r1.visibleChain.filter(m => !r1.answers[m.moduleKey || m.module]).map(m => m.moduleKey || m.module).join() === 'customer_supplied_part', { expected: 'customer_supplied_part', got: r1 && r1.visibleChain && r1.visibleChain.filter(m => !r1.answers[m.moduleKey || m.module]).map(m => m.moduleKey || m.module) });
check('1.5 the quote is the target\'s (a part replacement is not priced as a diagnostic)', !!r1 && !!r1.quote && r1.quote.laborEstimate !== run(DB, catalogCtx(DB, HOST, A0)).quote.laborEstimate, { expected: 'a different price from the diagnostic', got: r1 && r1.quote && r1.quote.laborEstimate });

// ---- 2. it does not ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
const stay = blackOpt ? run(DB, catalogCtx(DB, HOST, Object.assign({}, A0, { laptop_power_signs: blackOpt.label }))) : null;
check('2.1 an option without route_to does not move the job, and there is no routedFrom', !!stay && stay.entity.id === HOST && !stay.routedFrom, { expected: HOST + ' / null', got: stay && [stay.entity.id, stay.routedFrom] });
S('block 2', () => { const d = clone(); const o = opt(d, 'laptop_power_signs', /unplug/i); if (o) o.route_to.service = 'no_such_service';
  let r = null, err = null; try { r = withDB(d, () => run(d, catalogCtx(d, HOST, Object.assign({}, A0, { laptop_power_signs: o && o.label })))); } catch (e) { err = String(e && e.message || e); }
  check('2.2 a route_to to a service that does not exist is ignored: no throw, the job stays where it is', !!o && !err && r && r.entity.id === HOST && !r.routedFrom, { expected: HOST + ' / no throw', got: err || (r && r.entity.id) }); });

// ---- 3. every way in ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
S('block 3', () => { const d = clone(); d.smart_tags['#t_plugged_in_only'] = { synonyms: ['only works plugged in'], answers: { laptop_power_signs: batteryOpt && batteryOpt.label }, requires: [], display_group: 'Tech Conditions', applicable_categories: ['tech_trouble'], mutually_exclusive: [], is_logistic: false, ui_phrase: 'only works plugged in', negation_phrase: '' };
  let r = null, err = null; try { r = withDB(d, () => run(d, catalogCtx(d, HOST, A0, ['#t_plugged_in_only']))); } catch (e) { err = String(e && e.message || e); }
  check('3.1 a tag whose answers name the routing question hops too: the sentence and the tile are the same fact as a tapped chip', !!batteryOpt && !err && r && r.entity.id === PARTS && r.routedFrom && r.routedFrom.moduleKey === 'laptop_power_signs', { expected: PARTS, got: err || (r && r.entity.id) });
  // 5. taken back, with a tag re-supplying the answer
  const un = r && r.routedFrom ? withDB(d, () => sb.orch_unroute(r, d)) : null;
  check('5.1 orch_unroute returns to the service that asked', !!un && un.entity.id === HOST && !un.routedFrom, { expected: HOST + ' / no routedFrom', got: un && [un.entity.id, un.routedFrom && un.routedFrom.moduleKey] });
  check('5.2 and the route is declined: the tag that supplied the answer does not send the customer round again (running the returned context again stays)', !!un && withDB(d, () => run(d, un.context)).entity.id === HOST && Array.isArray(un.context.declinedRoutes) && un.context.declinedRoutes.length === 1, { expected: 'stays on ' + HOST, got: un && withDB(d, () => run(d, un.context)).entity.id }); });
S('block 4', () => { const ex = run(DB, hopCtx), un = ex.routedFrom ? sb.orch_unroute(ex, DB) : null;
  check('5.3 an explicit answer is removed by taking it back (the question is open again), everything else kept', !!un && !un.answers.laptop_power_signs && un.answers.device_type === LAPTOP && un.answers.computer_symptom === SYMPTOM, { expected: 'laptop_power_signs gone, device and symptom kept', got: un && un.answers }); });
S('block 5', () => { const tc = sb.collectBookingContext_freeText("my laptop won't turn on");
  const r = run(DB, Object.assign({}, tc, { tagsAffirmed: true, answers: { laptop_power_signs: batteryOpt && batteryOpt.label } }));
  check('3.2 the free-text context hops too, and the recommendation follows the answer (the card on screen names the part service, not the diagnostic the words first suggested)', !!batteryOpt && r.entity.id === PARTS && r.recommendedSku === PARTS && r.context.nlpIntent && r.context.nlpIntent.recommendedSku === PARTS, { expected: PARTS + ' recommended', got: [r.entity.id, r.recommendedSku] }); });

// ---- 4. idempotent -----------------------------------------------------------------------------------------------------------------------------------------------------------------------
S('block 6', () => { const again = r1 && r1.context ? run(DB, r1.context) : null;
  check('4.1 running the returned route\'s own context again returns the same route (orch_apply_answer re-enters through it)', !!again && again.entity.id === r1.entity.id && brief(again.answers) === brief(r1.answers) && again.quote.laborEstimate === r1.quote.laborEstimate && !!again.routedFrom && again.routedFrom.moduleKey === r1.routedFrom.moduleKey, { expected: 'same entity, answers, price, routedFrom', got: again && [again.entity.id, again.quote.laborEstimate] });
  const next = r1 && r1.context ? sb.orch_apply_answer(r1, 'customer_supplied_part', (DB.intake_modules.customer_supplied_part.client_response[0] || {}).label, DB) : null;
  check('4.2 answering the next question on the routed route keeps the part service and the reason', !!next && next.entity.id === PARTS && !!next.routedFrom && next.answers.customer_supplied_part === DB.intake_modules.customer_supplied_part.client_response[0].label, { expected: PARTS + ' with routedFrom', got: next && [next.entity.id, !!next.routedFrom] }); });

// ---- 6. terminates -----------------------------------------------------------------------------------------------------------------------------------------------------------------------
S('block 7', () => { const d = clone();
  const o1 = opt(d, 'laptop_power_signs', /unplug/i);
  const comp = d.intake_modules.computer_component.client_response.find(o => /battery/i.test(o.label));
  if (o1 && comp) {
      comp.route_to = { service: HOST, answers: {}, because: 'Planted: the battery answer sends the job back to the diagnostic.' };
      d.intake_modules.computer_component.purpose = 'routing';
      let r = null, err = null, edge = null; const t0 = Date.now();
      try { edge = withDB(d, () => run(d, catalogCtx(d, PARTS, { computer_component: comp.label }))); r = withDB(d, () => run(d, catalogCtx(d, HOST, Object.assign({}, A0, { laptop_power_signs: o1.label })))); } catch (e) { err = String(e && e.message || e); }
      check('6.0 (non-vacuity) the planted edge is live: answering Battery on the part service sends the job to the diagnostic', !err && !!edge && edge.entity.id === HOST && !!edge.routedFrom, { expected: HOST + ' via the planted option', got: err || (edge && edge.entity.id) });
      check('6.1 two options that route to each other cannot loop: resolution ends, in bounded time, on a service (never re-entering one within a resolution)', !err && !!r && !!r.entity && Date.now() - t0 < 5000, { expected: 'terminates on a service', got: err || (r && r.entity && r.entity.id) });
      check('6.2 and it stopped at the first re-entry, so the customer is shown ONE hop and its reason', !err && !!r && r.entity.id === PARTS && !!r.routedFrom && r.routedFrom.fromServiceId === HOST, { expected: PARTS + ' from ' + HOST, got: r && [r.entity.id, r.routedFrom && r.routedFrom.fromServiceId] });
  } else check('6.1 the planted loop could be built', false, { expected: 'the battery option and a Battery component', got: !!o1 + '/' + !!comp });
});
finish();
