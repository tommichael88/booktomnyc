#!/usr/bin/env node
/**
 * verify_computer_diagnostic_gateway.js -- #201 / #205: the Computer Diagnostic is the registered diagnostic (a gateway fee credited toward the repair, not a labor estimate), it offers the
 * Fork in the Road only when its own questions can no longer name the part, and the Fork's first path asks something new.
 *
 * Principles served (a Principle is not enforced by definition; the Rules below are what this test enforces): P-WHITEFLAG-PRICED, P-WHITEFLAG-DIAG, P-WHITEFLAG-PRECISE, P-INTAKE-INFER
 * @enforces R-INTAKE-WIREREMOVE
 *
 * THE DEFECT (PENDING_DECISIONS #201, your 01:49 NY: "was the diagnostic meant to be a higher fee, or a gateway fee that credits back against the repair?"): `computer_diagnostic` was an ordinary
 * hourly service whose name is "Diagnostic": 75 + 85 minutes at the specialized rate = $231 firm, no registered state, no $85, no credit sentence, no Fork. The catalog's one diagnostic-fee rule
 * (`global_rules.divergence_resolution`: $85, "fully credited toward any subsequent repair work") never reached it, so a dead charger cost $231 + $125 = $356 against $125 for a customer
 * routed straight to the part. Your 03:38 NY: "A is the direction ... Land A only after the second-path question is authored ... A diagnostic priced as a gateway with no gateway to offer is
 * worse than the current state -- it's the dead end P-WHITEFLAG-PRICED forbids." And your #180 rule for this group: the diagnostic only when remote questions cannot retire the uncertainty.
 *
 * Measured on the REAL PAGE (jsdom), read where the customer reads it, and on the catalog's own answers (every combination of answers the Computer Diagnostic's chain can be given):
 *   1. DATA          The Computer Diagnostic has the shape the registered diagnostics have (state, archetype, base price, variability tier); the fee and the credit are the catalog's; it authors a second
 *                    path that is a real module, is not one the entity already asks (Path A would draw nothing new at the end of the triage: the gap you named), is the computer's own question
 *                    (not the plumbing one: "used a plunger"), is used by no other group, and its one effect reuses an existing anchor (no new figure).
 *   2. WHEN THE FORK  For EVERY combination of answers: the Fork is withheld exactly while some answer to a question not yet asked can still move the job to another service (route_to), and offered
 *                    when none can. Stated as behaviour, not as the function: "pending" equals "the subtree of further answers contains a routed service".
 *   3. THE PAGE       Triage first (the device question and the targeted questions are on the card, no Fork, no hourly estimate); at each dead end the Fork with $85 and the credit sentence and no $231;
 *                    Path A draws the second-path question unanswered and answering it leaves one price card; Path B is "On-site diagnostic (flat rate): $85" and the cart holds $85 due today; a routed end
 *                    is the part service's firm price with no Fork.
 *   4. NON-VACUITY   Six mutants (the second path removed; the second path a question the chain already asks; the old shape restored; the Fork not waiting; the hourly estimate shown mid-triage;
 *                    the plumbing question as the second path) each fail the check that guards them.
 *
 * WHAT THIS DOES NOT COVER (named): whether "opened up or a part replaced" deserves ten minutes is bench knowledge and a technician's read (same standing as #183); this proves it takes an existing
 * anchor and says nothing about whether the anchor is right. The Fork's "N more questions" count is the number of second-path modules (one), not the number of questions Path A shows (found, not fixed).
 *
 * RUN ON ANOTHER TREE: QR_ROOT=<tree> node test_harness/verify_computer_diagnostic_gateway.js
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..');
const { JSDOM } = require(path.join(__dirname, 'node_modules', 'jsdom'));
const { assemble } = require('./_page.js');
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (detail ? '\n      ' + detail : '')); } };
const clone = o => JSON.parse(JSON.stringify(o)), wait = ms => new Promise(r => setTimeout(r, ms)), clean = s => String(s || '').replace(/\s+/g, ' ').trim();
const text = e => { if (!e) return ''; const c = e.cloneNode(true); c.querySelectorAll('script,style').forEach(n => n.remove()); return clean(c.textContent); };
const DB0 = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
const QR_TEXT = fs.readFileSync(path.join(ROOT, 'qr.html'), 'utf8');

const HOST = 'computer_diagnostic', GROUP = 'tech_trouble_computer_repair', CAT = 'tech_trouble';
const REFERENCES = ['dishwasher_repair', 'dryer_repair', 'stove_repair'];       // the services that already are the registered diagnostic
const DYN_KEY = 'tech_trouble+tech_trouble_computer_repair+Diagnostic';
const PLUMBING = /plunger|drain|snak|pipe|clog|toilet|faucet|water/i;
const chainMods = e => (e.intake_chain || []).map(s => (s && s.module) || s);
const svcOf = (db, id) => db.services.find(s => s.id === id);

// ── 1. data ─────────────────────────────────────────────────────────────────────────────────────
function dataLeg(db) {
  const o = { shape: [], second: [], notes: [] };
  const host = svcOf(db, HOST);
  const shapeOf = s => JSON.stringify([s.financial_engine.checkout_state || null, s.financial_engine.pricing_archetype || null, s.financial_engine.base_price, (s.confidence_strategy || {})._variability_tier || null]);
  const ref = REFERENCES.map(id => shapeOf(svcOf(db, id)));
  o.refsAgree = ref.every(r => r === ref[0]);
  o.hostShape = shapeOf(host); o.refShape = ref[0];
  const dr = (db.global_rules || {}).divergence_resolution || {};
  o.fee = dr.diagnostic_fee; o.credit = dr.credit_policy || '';
  o.modules = host.remote_deep_dive_modules || [];
  o.real = o.modules.every(m => !!db.intake_modules[m]);
  // every module the entity's chain asks, including the branches its answers open (the card draws them all before any second path)
  const asked = new Set(chainMods(host));
  chainMods(host).forEach(mk => Object.values((db.intake_modules[mk] || {}).client_response || []).forEach(() => {}));
  (host.intake_chain || []).forEach(step => Object.values((step && step.then) || {}).forEach(ts => (ts || []).forEach(t => asked.add(t))));
  o.redundant = o.modules.filter(m => asked.has(m));
  const m0 = db.intake_modules[o.modules[0]] || {};
  o.labels = (m0.client_response || []).map(r => r.label).concat([m0.question || '']);
  o.plumbing = o.labels.filter(l => PLUMBING.test(l));
  // used by no other group
  const users = [];
  db.services.forEach(s => { if (chainMods(s).includes(o.modules[0]) || (s.remote_deep_dive_modules || []).includes(o.modules[0])) users.push(s.ui_taxonomy.group_id); });
  Object.keys(db.dynamic_services).forEach(k => { const d = db.dynamic_services[k]; if (chainMods(d).includes(o.modules[0]) || (d.remote_deep_dive_modules || []).includes(o.modules[0])) users.push(k.split('+')[1] || '(category)'); });
  o.otherGroups = [...new Set(users)].filter(g => g !== GROUP);
  // the effect reuses an existing anchor
  const withMod = (m0.client_response || []).filter(r => r.modifier_ref);
  o.effects = withMod.map(r => ({ label: r.label, mod: (db.global_rules.modifiers || {})[r.modifier_ref] }));
  o.anchor = (db.global_rules.modifiers || {}).attempted_fix_yes_snaked_it_myself;
  o.dyn = (db.dynamic_services[DYN_KEY] || {}).remote_deep_dive_modules || [];
  return o;
}

// ── page ──────────────────────────────────────────────────────────────────────────────────────────
async function openPage(html, db) {
  const dom = new JSDOM(html, { url: 'https://tommichael88.github.io/booktomnyc/qr.html', runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, beforeParse(w) {
    w.fetch = async u => String(u).includes('btnyc.json') ? { ok: true, json: async () => clone(db) } : { ok: false, status: 404 };
    w.HTMLElement.prototype.scrollIntoView = function () {}; w.console.log = () => {}; w.console.warn = () => {}; w.console.error = () => {};
  } });
  for (let i = 0; i < 60 && !(dom.window.DB && dom.window.renderRoute); i++) await wait(100);
  return dom;
}
const tapOn = (w, el) => el.dispatchEvent(new w.Event('click', { bubbles: true }));
const btnOf = (doc, re) => [...doc.querySelectorAll('button')].find(b => re.test(b.textContent));
const hasFork = doc => !!(btnOf(doc, /Answer a few more questions/) && btnOf(doc, /Book an on-site diagnostic/));
const drawn = (doc, mk) => !!doc.querySelector('.ims-label[data-mod="' + mk + '"]');
const unansweredDrawn = (w, doc) => [...doc.querySelectorAll('.ims-label[data-mod]')].map(l => l.dataset.mod).filter(m => !w.S._lastRoute.answers[m]);
// the card is drawn into the container the route was rendered to (the page body also holds the cart and a service-details panel with figures of their own)
const cardText = (w, doc) => text(doc.getElementById(w.S._lastContainerId || 'intakeQuestionsContainer') || doc.body);
const DEVICES_LABELS = db => (db.intake_modules.device_type.client_response || []).map(r => r.label);

// the Computer Diagnostic reached the way the group's symptom tile reaches it, with the symptom answered (the tile's own fact)
function start(w, symptomLabel) {
  w.S._divergencePath = null;
  const s = svcOf(w.DB, HOST), ctx = w.collectBookingContext_catalog(s, CAT);
  ctx.answers = Object.assign({}, ctx.answers || {}, symptomLabel ? { computer_symptom: symptomLabel } : {});
  return w.executeWorkflow(ctx, w.DB);
}
const show = (w, route) => { w.S._divergencePath = null; w.renderRoute(route); return route; };

// EVERY combination of answers the chain can be given: each unanswered drawn question, each of its options, in any order. Memoised on the answers.
function explore(w, symptomLabel) {
  const seen = new Map(), nodes = [];
  const key = a => JSON.stringify(Object.keys(a).sort().map(k => [k, a[k]]));
  function visit(route) {
    const k = key(route.answers || {});
    if (seen.has(k)) return seen.get(k);
    seen.set(k, { routes: false });                                              // guards a cycle; the real value is written below
    const here = route.entity && route.entity.id;
    const node = { answers: Object.assign({}, route.answers), entity: here, state: route.quote && route.quote.checkoutStateKey, pending: !!route.triagePending, eligible: !!(route.quote && route.quote.divergenceEligible), unanswered: [], routesBelow: false, route };
    nodes.push(node);
    let routesBelow = here !== HOST;
    if (here === HOST) {
      const open = (route.visibleChain || []).filter(m => !(route.answers || {})[m.moduleKey]);
      node.unanswered = open.map(m => m.moduleKey);
      for (const m of open) for (const o of (m.client_response || [])) {
        const next = w.orch_apply_answer(route, m.moduleKey, o.label, w.DB);
        if (visit(next).routes) routesBelow = true;
      }
    }
    node.routesBelow = routesBelow;
    const res = { routes: routesBelow }; seen.set(k, res); return res;
  }
  visit(start(w, symptomLabel));
  return nodes;
}

async function run(html, db, opts) {
  opts = opts || {};
  const dom = await openPage(html, db), w = dom.window, doc = w.document, tap = el => tapOn(w, el);
  const o = { nodes: 0, wrongPending: [], deadEnds: 0, noForkAtEnd: [], forkEarly: [], estimateEarly: [], noPlaceholder: [], money: [], pathA: [], afterA: [], pathB: [], routed: [], firm231: [], devs: new Set() };
  const syms = (db.intake_modules.computer_symptom.client_response || []).map(r => r.label);
  const dead = [];                                                              // one dead end per (device, last answered module), for the page
  for (const sym of syms.slice(0, opts.symptoms || syms.length)) {
    const nodes = explore(w, sym);
    for (const n of nodes) {
      if (n.entity !== HOST) continue;
      o.nodes++;
      // 2. behaviour: pending exactly when a further answer can route the job away (at a node whose own entity still is the host)
      const below = (() => { // does ANY descendant (not the node itself) route away?
        const open = n.route.visibleChain.filter(m => !n.answers[m.moduleKey]);
        for (const m of open) for (const op of (m.client_response || [])) { const nx = w.orch_apply_answer(n.route, m.moduleKey, op.label, w.DB); if ((nx.entity && nx.entity.id) !== HOST) return true; if (nodesRoute(w, nx, 0)) return true; }
        return false;
      })();
      if (n.pending !== below) o.wrongPending.push(sym + ' / ' + JSON.stringify(n.answers) + ': pending ' + n.pending + ', routes below ' + below);
      if (!n.pending) {
        o.deadEnds++;
        const last = Object.keys(n.answers).filter(k => k !== 'computer_symptom' && k !== 'device_type').pop() || '(device)';
        const tag = (n.answers.device_type || '-') + '|' + last;
        if (!dead.some(d => d.tag === tag)) dead.push({ tag, sym, n });
      }
    }
  }
  // 3. the page
  // 3a. triage first: the tile's own state, then after the device, mid-triage
  {
    const r = show(w, start(w, syms[0]));
    const t = text(doc.body);
    if (hasFork(doc)) o.forkEarly.push('at the tile');
    if (/Estimated labor/.test(cardText(w, doc))) o.estimateEarly.push('at the tile');
    if (!/Please answer the questions above to see a quote/.test(cardText(w, doc))) o.noPlaceholder.push('at the tile');
    if (!drawn(doc, 'device_type')) o.forkEarly.push('device question not drawn at the tile');
    const lap = DEVICES_LABELS(db).find(l => /^laptop$/i.test(l));
    const r2 = show(w, w.orch_apply_answer(r, 'device_type', lap, w.DB));
    if (hasFork(doc)) o.forkEarly.push('after the device');
    if (/Estimated labor/.test(cardText(w, doc))) o.estimateEarly.push('after the device');
    if (!unansweredDrawn(w, doc).length) o.forkEarly.push('no targeted question drawn after the device');
  }
  // 3b. each dead end
  for (const d of dead.slice(0, opts.deadEnds || dead.length)) {
    try {
      const route = show(w, d.n.route);
      const card = cardText(w, doc);
      if (!hasFork(doc)) { o.noForkAtEnd.push(d.tag); continue; }
      const dr = db.global_rules.divergence_resolution;
      if (!card.includes('$' + dr.diagnostic_fee) || !/fully credited toward any subsequent repair work/.test(card)) o.money.push(d.tag + ': the $' + dr.diagnostic_fee + ' / credit sentence is not on the Fork');
      if (/\$231|\$273/.test(card)) o.firm231.push(d.tag + ' (Fork)');
      // Path B
      tap(btnOf(doc, /Book an on-site diagnostic/));
      const priceB = text(doc.querySelector('.summary-estimate'));
      if (priceB !== 'On-site diagnostic (flat rate):$' + dr.diagnostic_fee && !/On-site diagnostic \(flat rate\):\s*\$85/.test(priceB)) o.pathB.push(d.tag + ': "' + priceB + '"');
      const before = (text(doc.body).match(/Subtotal \((\d+) items?\): \$(\d+)/) || [0, 0, 0]).slice(1).map(Number);
      const add = doc.getElementById('btn-curated-add'); if (add) tap(add);
      const after = (text(doc.body).match(/Subtotal \((\d+) items?\): \$(\d+)/) || [0, 0, 0]).slice(1).map(Number);
      if (after[1] - before[1] !== dr.diagnostic_fee) o.pathB.push(d.tag + ': the cart rose by $' + (after[1] - before[1]) + ', not $' + dr.diagnostic_fee);
      // Path A, on a fresh card of the same end
      show(w, d.n.route);
      const atFork = d.n.unanswered;                      // the Fork draws no questions: what was still open on the route is what Path A may bring back
      tap(btnOf(doc, /Answer a few more questions/));
      const second = (svcOf(db, HOST).remote_deep_dive_modules || [])[0];
      const unans = unansweredDrawn(w, doc);
      if (!drawn(doc, second) || !unans.includes(second)) { o.pathA.push(d.tag + ': "' + second + '" not drawn unanswered (unanswered: ' + unans.join(',') + ')'); continue; }
      // nothing the customer already answered comes back as a question: what is unanswered now was unanswered before, plus the second path
      const back = unans.filter(m => m !== second && !atFork.includes(m));
      if (back.length) o.pathA.push(d.tag + ': Path A re-asks ' + back.join(','));
      for (const opt of db.intake_modules[second].client_response) {
        tap([...doc.querySelectorAll('.ims-chip[data-mod="' + second + '"]')].find(c => c.dataset.label === opt.label));
        const RA = w.S._lastRoute, c2 = cardText(w, doc);
        if (hasFork(doc) || RA.divergenceApplied !== 'remote' || !/Estimated labor/.test(c2)) o.afterA.push(d.tag + ' / ' + opt.label + ': fork ' + hasFork(doc) + ', applied ' + RA.divergenceApplied);
        if (/\$231|\$273/.test(c2)) o.firm231.push(d.tag + ' (Path A)');
      }
    } catch (err) { o.afterA.push(d.tag + ': ' + (err && err.message)); }
  }
  // 3c. a routed end is the part service's firm price, with no Fork
  {
    const lap = DEVICES_LABELS(db).find(l => /^laptop$/i.test(l));
    const sig = db.intake_modules.laptop_power_signs.client_response.find(r => r.route_to);
    let r = start(w, syms[0]); r = w.orch_apply_answer(r, 'device_type', lap, w.DB); r = w.orch_apply_answer(r, 'laptop_power_signs', sig.label, w.DB);
    show(w, r);
    const part = svcOf(db, sig.route_to.service);
    if ((r.entity && r.entity.id) !== sig.route_to.service || hasFork(doc) || r.quote.checkoutStateKey === 'diagnostic' || !/Estimated labor/.test(cardText(w, doc)) ) o.routed.push('routed to ' + (r.entity && r.entity.id) + ' (' + r.quote.checkoutStateKey + '), fork ' + hasFork(doc));
    if (/\$231/.test(cardText(w, doc))) o.firm231.push('routed card');
    if (part && r.quote.laborEstimate !== w.computeUnifiedQuote({ svc: part, dynDef: null, activeTagIds: [], answers: r.answers, qty: 1, intentKeyword: part.id, entry: 'catalog' }).laborEstimate) o.routed.push('the routed card is not the part service\'s own price');
  }
  o.deadTags = dead.map(d => d.tag);
  dom.window.close();
  return o;
}
// does any descendant of this route (further answers, any order) route the job away from the host? (a separate walk from explore(): the specification, not the implementation)
function nodesRoute(w, route, depth) {
  if (depth > 6) return false;
  if ((route.entity && route.entity.id) !== HOST) return true;
  const open = (route.visibleChain || []).filter(m => !(route.answers || {})[m.moduleKey]);
  for (const m of open) for (const op of (m.client_response || [])) { if (nodesRoute(w, w.orch_apply_answer(route, m.moduleKey, op.label, w.DB), depth + 1)) return true; }
  return false;
}

function mutantHtml(label, fn) {
  const mutated = fn(QR_TEXT);
  check('mutant "' + label + '" changed the page source', mutated !== QR_TEXT);
  return assemble(mutated, ROOT);
}

(async () => {
  console.log('\n=== 1. data: the registered diagnostic, a gateway with a second path ===');
  const D = dataLeg(DB0);
  check('the three services that are the registered diagnostic share one shape (state, archetype, base price, tier)', D.refsAgree, D.refShape);
  check('the Computer Diagnostic has that shape (it was ["null","hourly_timed",75,"high"]: an ordinary hourly service)', D.hostShape === D.refShape, D.hostShape + ' vs ' + D.refShape);
  check('the fee and the credit are the catalog\'s (one rule): $85, "fully credited toward any subsequent repair work"', D.fee === 85 && /fully credited toward any subsequent repair work/.test(D.credit), D.fee + ' / ' + D.credit);
  check('it authors a second path, each a real intake module', D.modules.length > 0 && D.real, JSON.stringify(D.modules));
  check('the second path is not a question the entity already asks (Path A at the end of the triage would draw nothing new)', D.redundant.length === 0, D.redundant.join(', '));
  check('it is the computer\'s own question: no option or question names plumbing ("used a plunger")', D.plumbing.length === 0 && D.labels.length >= 3, D.plumbing.join(' | '));
  check('it is used by no other group (cross-category bleed)', D.otherGroups.length === 0, D.otherGroups.join(', '));
  check('its one effect reuses an existing anchor: a fee of 0 and the minutes of attempted_fix\'s "snaked it myself"; no new figure', D.effects.length === 1 && D.effects[0].mod && D.effects[0].mod.fee === D.anchor.fee && D.effects[0].mod.minutes === D.anchor.minutes && D.effects[0].mod.scope === D.anchor.scope, JSON.stringify(D.effects));
  check('the group\'s Diagnostic fallback asks the same question (not the plumbing one)', D.dyn.includes(D.modules[0]) && !D.dyn.includes('attempted_fix'), JSON.stringify(D.dyn));

  const HTML = assemble(QR_TEXT, ROOT);
  console.log('\n=== 2-3. the real page and every combination of answers ===');
  const P = await run(HTML, DB0);
  console.log('  (' + P.nodes + ' answer combinations on the Computer Diagnostic; ' + P.deadEnds + ' dead ends, ' + P.deadTags.length + ' distinct (device, last question) shown on the page)');
  check('the Fork is withheld exactly while a further answer can still move the job to another service, in every combination -- wrong: ' + P.wrongPending.length, P.nodes > 40 && P.wrongPending.length === 0, P.wrongPending.slice(0, 4).join(' | '));
  check('there are dead ends to judge (the triage does end at the diagnostic for some answers)', P.deadEnds >= 14, String(P.deadEnds));
  check('triage first: at the tile and after the device the card has the questions, no Fork, no hourly estimate, and says to answer them -- problems: ' + (P.forkEarly.length + P.estimateEarly.length + P.noPlaceholder.length), P.forkEarly.length + P.estimateEarly.length + P.noPlaceholder.length === 0, JSON.stringify([P.forkEarly, P.estimateEarly, P.noPlaceholder]));
  check('every dead end draws the Fork with the $85 and the credit sentence -- without: ' + P.noForkAtEnd.length + ', wrong terms: ' + P.money.length, P.noForkAtEnd.length === 0 && P.money.length === 0, P.noForkAtEnd.concat(P.money).slice(0, 4).join(' | '));
  check('Path B is "On-site diagnostic (flat rate): $85" and the cart rises by $85 -- violations: ' + P.pathB.length, P.pathB.length === 0, P.pathB.slice(0, 4).join(' | '));
  check('Path A draws the second-path question, unanswered, and only it -- violations: ' + P.pathA.length, P.pathA.length === 0, P.pathA.slice(0, 4).join(' | '));
  check('answering it leaves one price card, diverged "remote", and no second Fork -- violations: ' + P.afterA.length, P.afterA.length === 0, P.afterA.slice(0, 4).join(' | '));
  check('a routed end is the part service\'s own firm price with no Fork -- violations: ' + P.routed.length, P.routed.length === 0, P.routed.join(' | '));
  check('no card at any end shows the old firm $231 / $273 -- ' + P.firm231.length, P.firm231.length === 0, P.firm231.slice(0, 4).join(' | '));

  console.log('\n=== 4. non-vacuity: a break in the data or the page fails the check that guards it ===');
  { // the second path is removed
    const db = clone(DB0); delete svcOf(db, HOST).remote_deep_dive_modules;
    const d = dataLeg(db), r = await run(HTML, db, { symptoms: 2, deadEnds: 3 });
    check('  -> the data check names it (no module) and the page draws no Fork at the dead end (' + r.noForkAtEnd.length + ' of ' + Math.min(3, r.deadTags.length) + ')', d.modules.length === 0 && r.noForkAtEnd.length >= 1); }
  { // the second path is a question the chain already asks
    const db = clone(DB0); svcOf(db, HOST).remote_deep_dive_modules = ['device_type'];
    const d = dataLeg(db), r = await run(HTML, db, { symptoms: 2, deadEnds: 3 });
    check('  -> the data check names it (' + d.redundant.join(',') + ') and Path A draws nothing new at the dead end (' + r.pathA.length + ' violations)', d.redundant.length === 1 && r.pathA.length >= 1); }
  { // the old shape is restored
    const db = clone(DB0), s = svcOf(db, HOST); s.financial_engine = { type: 'hourly', base_price: 75, pricing_archetype: 'hourly_timed', _inherits_checkout_state_from_archetype: 'electronic_device' }; s.confidence_strategy._variability_tier = 'high';
    const d = dataLeg(db), r = await run(HTML, db, { symptoms: 2, deadEnds: 3 });
    check('  -> the shape check is red and the page shows no Fork at the dead end (' + r.noForkAtEnd.length + ')', d.hostShape !== d.refShape && r.noForkAtEnd.length >= 1); }
  { // the plumbing question as the second path
    const db = clone(DB0); svcOf(db, HOST).remote_deep_dive_modules = ['attempted_fix'];
    const d = dataLeg(db);
    check('  -> the vocabulary check names it (' + d.plumbing.length + ' plumbing words)', d.plumbing.length >= 2); }
  { // the Fork does not wait for the triage
    const h = mutantHtml('the Fork does not wait for the triage', src => src.replace('triagePending: orch_route_still_possible(intakeChain, answers),', 'triagePending: false,'));
    const r = await run(h, DB0, { symptoms: 3, deadEnds: 2 });
    check('  -> the Fork is drawn at the tile (' + r.forkEarly.length + ') and the behaviour check is red (' + r.wrongPending.length + ' combinations)', r.forkEarly.length >= 1 && r.wrongPending.length >= 1); }
  { // the hourly estimate is shown while the triage is pending
    const h = mutantHtml('the hourly estimate is shown mid-triage', src => src.replace('} else if (q && !awaitingTriage) {', '} else if (q) {'));
    const r = await run(h, DB0, { symptoms: 2, deadEnds: 2 });
    check('  -> the card shows "Estimated labor" before the questions are answered (' + r.estimateEarly.length + ')', r.estimateEarly.length >= 1); }

  console.log('\n[computer diagnostic gateway] ' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail > 0 ? 1 : 0);
})().catch(err => { console.error(err); process.exit(2); });
