#!/usr/bin/env node
/**
 * verify_diagnostic_answer_reaches_fork.js -- #204: an answer the catalog says "needs a look first" must reach the customer as the Fork in the Road, on every entity that can
 * be answered that way and on every way in; and the Fork's first path ("Answer a few more questions") must put a question on the screen. (Class: a rule the catalog states in
 * data -- `checkout_state_override: diagnostic` on an option -- held only on the surfaces that happened to carry a second path and a card that could draw it; the other surfaces
 * quoted a firm price for a leaking dishwasher. R-INVARIANT-PROVENANCE: the number on screen must be the number the catalog's own rule gives; R-CLIENT-CONVERGE: the same
 * answer, the same state, on every entry path.)
 *
 * Measured on the REAL PAGE (jsdom, the way verify_state_ignorance.js does), read where the customer reads it -- the card -- not in the field:
 *   1. DATA: every dynamic entity that can turn diagnostic (statically diagnostic, or one of its chain's options carries the override) authors a second path
 *      (`remote_deep_dive_modules`): non-empty, each a real intake module, none already asked by the entity, and the compiled service_index says the same.
 *   2. THE FORK: each such entity (dynamic and service), reached the way the tile / card reaches it, answered with its diagnostic option (or diagnostic from the start),
 *      draws the Fork (both buttons); an option that is NOT diagnostic still draws the firm price (the control: the Fork is not simply always on).
 *   3. PATH A: tapping "Answer a few more questions" puts the entity's second-path question on the screen (within the questions the entity's own ceiling lets it ask first),
 *      and answering it leaves a price card without a second Fork. This was dead on every service before T174: the route's visible chain was resolved before the splice.
 *   4. PATH B: tapping "Book an on-site diagnostic" draws the flat diagnostic fee and the credit terms the SSOT states.
 *   5. THE GUIDED BUILDER: the condition the customer picks is their answer to the question the priced entity asks, so it prices as one: on each appliance group, the
 *      diagnostic chip is a diagnostic quote (the state the catalog's rule gives, the same state and price the typed card gives for the same answer) and a non-diagnostic chip is not.
 *   6. ONE DEFINITION: resolveBuilderConditionAnswer is defined once and is what sqBuilderFinish calls.
 *   7. NON-VACUITY: four mutants -- the splice leaves the visible chain stale (Path A draws nothing), Path A rebuilds a catalog context (dynamic entities draw no
 *      question), the builder drops the answer (the chip is only words), and an entity loses its second path in the data -- each fail the check that guards them.
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
const IM = DB0.intake_modules;

// What the catalog says can turn an entity diagnostic: its own static state, or an option in a module it asks.
const diagOptions = mk => ((IM[mk] || {}).client_response || []).filter(o => o.checkout_state_override === 'diagnostic');
const chainMods = e => (e.intake_chain || []).map(s => (s && s.module) || s);
const capable = e => ({ isStatic: !!(e.financial_engine && e.financial_engine.checkout_state === 'diagnostic'), mods: chainMods(e).filter(mk => diagOptions(mk).length) });
const isCapable = e => { const c = capable(e); return c.isStatic || c.mods.length > 0; };
const DYN = Object.keys(DB0.dynamic_services).filter(k => isCapable(DB0.dynamic_services[k]));
const SVC = DB0.services.filter(isCapable);

// ── 1. data ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function dataLeg(db) {
  const out = { missing: [], bogus: [], redundant: [], mirror: [] };
  const idx = (db.compiled && db.compiled.service_index) || {};
  // T174 (#201): the real services are held to the same four claims as the fallbacks (the Computer Diagnostic became one of them: a registered diagnostic with no second path is the dead end the Charter forbids)
  const entities = DYN.map(k => [k, db.dynamic_services[k]]).concat(SVC.map(sv => [sv.id, db.services.find(x => x.id === sv.id)]));
  for (const [k, e] of entities) {
    const mods = e.remote_deep_dive_modules || [];
    if (!mods.length) out.missing.push(k);
    for (const m of mods) { if (!db.intake_modules[m]) out.bogus.push(k + ':' + m); if (chainMods(e).includes(m)) out.redundant.push(k + ':' + m); }
    if (JSON.stringify(idx[k] ? idx[k].remote_deep_dive_modules || [] : null) !== JSON.stringify(mods)) out.mirror.push(k);
  }
  return out;
}

// ── 2-5. the page ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function openPage(html, db) {
  const dom = new JSDOM(html, { url: 'https://tommichael88.github.io/booktomnyc/qr.html', runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, beforeParse(w) {
    w.fetch = async u => String(u).includes('btnyc.json') ? { ok: true, json: async () => clone(db) } : { ok: false, status: 404 };
    w.HTMLElement.prototype.scrollIntoView = function () {}; w.console.log = () => {}; w.console.warn = () => {}; w.console.error = () => {};
  } });
  for (let i = 0; i < 60 && !(dom.window.DB && dom.window.renderRoute); i++) await wait(100);
  return dom;
}
const tapOn = (w, el) => el.dispatchEvent(new w.Event('click', { bubbles: true }));
const chipOf = (doc, label) => [...doc.querySelectorAll('.ims-chip')].find(c => clean(c.dataset.label) === clean(label));
const btnOf = (doc, re) => [...doc.querySelectorAll('button')].find(b => re.test(b.textContent));
const hasFork = doc => !!(btnOf(doc, /Answer a few more questions/) && btnOf(doc, /Book an on-site diagnostic/));
const drawn = (doc, mk) => !!doc.querySelector('.ims-label[data-mod="' + mk + '"]');

// T174 (#201): an entity whose own questions can still name the part (route.triagePending) does not offer the Fork yet: the customer answers its triage first. Walk it to the dead end the way a
// customer would: the first drawn question that is not answered, an option that does not route the job away; return the steps so a second visit can repeat them.
function settle(w, doc) {
  const steps = [];
  for (let i = 0; i < 8 && w.S._lastRoute.triagePending && !hasFork(doc); i++) {
    const R = w.S._lastRoute;
    const q = (R.visibleChain || []).find(m => !R.answers[m.moduleKey]);
    if (!q) break;
    const opt = (q.client_response || []).find(o => !o.route_to);
    const chip = opt && chipOf(doc, opt.label); if (!chip) break;
    steps.push(chip.dataset.label); tapOn(w, chip);
  }
  return steps;
}

// reach an entity the way its entry reaches it: a service by its card, a dynamic fallback by its tile
function reach(w, key, isSvc) {
  w.S._divergencePath = null;
  let ctx;
  if (isSvc) { const s = w.DB.services.find(x => x.id === key); ctx = w.collectBookingContext_catalog(s, s.ui_taxonomy.category_id); }
  else {
    const parts = key.split('+'), grp = parts.length === 3 ? parts[1] : null, st = parts[parts.length - 1];
    ctx = w.collectBookingContext_otherTile({ ui_taxonomy: { group_id: grp }, service_type: st, uncovered_service_types: [st], id: key }, parts[0]);
  }
  const route = w.executeWorkflow(ctx, w.DB); w.renderRoute(route); return route;
}

async function pageLeg(html, db, opts) {
  opts = opts || {};
  const dom = await openPage(html, db), w = dom.window, doc = w.document, tap = el => tapOn(w, el);
  const out = { entities: 0, fork: [], noFork: [], control: [], controlN: 0, pathA: [], afterA: [], pathB: [], builder: [], builderN: 0, errors: [] };
  const dr = (db.global_rules || {}).divergence_resolution || {};
  const targets = (opts.only ? opts.only : DYN.map(k => ({ key: k, svc: false })).concat(SVC.map(s => ({ key: s.id, svc: true }))));
  for (const t of targets) {
    const e = t.svc ? db.services.find(s => s.id === t.key) : db.dynamic_services[t.key], c = capable(e);
    out.entities++;
    try {
      const route = reach(w, t.key, t.svc);
      // 2. the Fork: diagnostic from the start (once its own triage has nothing left that could name the part), or once its diagnostic option is chosen
      const triage = c.isStatic ? settle(w, doc) : [];
      if (!c.isStatic) {
        const mk = c.mods.find(m => doc.querySelector('.ims-label[data-mod="' + m + '"]'));
        const opt = mk && diagOptions(mk)[0], chip = opt && chipOf(doc, opt.label);
        if (!chip) { out.errors.push(t.key + ': no visible chip for a diagnostic option (modules ' + c.mods.join(',') + ')'); continue; }
        // the control first: an answer of the same module that is NOT diagnostic draws the firm price card
        const plain = IM[mk].client_response.find(o => o.checkout_state_override !== 'diagnostic' && !/other/i.test(o.label));
        if (plain && chipOf(doc, plain.label)) {
          out.controlN++; tap(chipOf(doc, plain.label));
          const q0 = w.S._lastRoute.quote;
          if (hasFork(doc) || q0.checkoutStateKey === 'diagnostic' || !/Estimated labor/.test(text(doc.body))) out.control.push(t.key + ' + "' + plain.label + '": ' + q0.checkoutStateKey);
        }
        tap(chipOf(doc, opt.label));
      }
      const R = w.S._lastRoute;
      if (!(hasFork(doc) && R.quote.divergenceEligible)) { out.noFork.push(t.key + (c.isStatic ? ' (static)' : ' + "' + (c.mods[0]) + '"') + ': ' + R.quote.checkoutStateKey + ', fork ' + hasFork(doc)); continue; }
      out.fork.push(t.key);
      // 4. Path B on a fresh card of the same entity
      tap(btnOf(doc, /Book an on-site diagnostic/));
      const RB = w.S._lastRoute, priceB = text(doc.querySelector('.summary-estimate .price-value')), fee = RB.onsiteTerms && RB.onsiteTerms.fee;
      if (!(fee > 0 && priceB === '$' + fee && /credit/i.test(text(doc.querySelector('.divergence-credit-note') || doc.body)))) out.pathB.push(t.key + ': ' + priceB + ' vs fee ' + fee);
      // 3. Path A: re-reach, choose the diagnostic option again, then ask for more questions
      reach(w, t.key, t.svc);
      if (!c.isStatic) tap(chipOf(doc, diagOptions(c.mods.find(m => doc.querySelector('.ims-label[data-mod="' + m + '"]')))[0].label));
      else triage.forEach(lab => tap(chipOf(doc, lab)));
      tap(btnOf(doc, /Answer a few more questions/));
      const second = e.remote_deep_dive_modules || [], first = second[0];
      // the entity's own ceiling lets it ask only so many unanswered questions at once: answer what is drawn until the second-path question has its slot
      for (let i = 0; i < 4 && !drawn(doc, first); i++) {
        const lab = [...doc.querySelectorAll('.ims-label')].find(l => !w.S._lastRoute.answers[l.dataset.mod]);
        const ch = lab && doc.querySelector('.ims-chip[data-mod="' + lab.dataset.mod + '"]'); if (!ch) break; tap(ch);
        if (hasFork(doc)) break;
      }
      if (!drawn(doc, first)) { out.pathA.push(t.key + ': "' + first + '" not drawn; visible ' + (w.S._lastRoute.visibleChain || []).map(m => m.moduleKey).join(',') + '; intake ' + w.S._lastRoute.intakeChain.map(m => m.moduleKey).join(',')); continue; }
      tap(doc.querySelector('.ims-chip[data-mod="' + first + '"]'));
      const RA = w.S._lastRoute;
      if (hasFork(doc) || !/Estimated labor/.test(text(doc.body)) || RA.divergenceApplied !== 'remote') out.afterA.push(t.key + ': fork ' + hasFork(doc) + ', applied ' + RA.divergenceApplied);
    } catch (err) { out.errors.push(t.key + ': ' + (err && err.message)); }
  }

  // 5. the guided builder: each appliance group whose Repair fallback can turn diagnostic
  const groups = opts.noBuilder ? [] : DYN.map(k => k.split('+')).filter(p => p.length === 3 && p[2] === 'Repair' && !capable(db.dynamic_services[p.join('+')]).isStatic);
  for (const [cat, grp] of groups) {
    const key = cat + '+' + grp + '+Repair', e = db.dynamic_services[key], mk = capable(e).mods[0];
    const diagLabel = diagOptions(mk)[0].label, plain = IM[mk].client_response.find(o => o.checkout_state_override !== 'diagnostic' && !/other/i.test(o.label));
    // a module whose every real answer is diagnostic (the Stove's three, #199) has no plain option to control with
    for (const [label, wantDiag] of [[diagLabel, true]].concat(plain ? [[plain.label, false]] : [])) {
      out.builderN++;
      try {
        w.sqRestart();
        w.eval('BLD.action="fix"; BLD.object=' + JSON.stringify(grp) + '; BLD.specific=' + JSON.stringify(grp) + '; BLD._groupId=' + JSON.stringify(grp) + '; BLD._cat=' + JSON.stringify(cat) + '; BLD._stype="Repair"; BLD._keyword=bldGroupToKeyword(' + JSON.stringify(grp) + ', ' + JSON.stringify(cat) + '); BLD.condition=' + JSON.stringify(label.toLowerCase()) + '; BLD.qty=1;');
        w.sqBuilderFinish(); w.sqConfirmAdlib();
        const m = w.computeQuoteFromState(w.S);
        // the typed card's state for the same answer on the same entity (the route is the reference: R-CLIENT-CONVERGE)
        const ref = w.orch_apply_answer(reach(w, key, false), mk, label, w.DB).quote;
        const bad = [];
        if (w.S.answers[mk] !== label) bad.push('answer not carried (' + JSON.stringify(w.S.answers) + ')');
        if ((m.checkoutStateKey === 'diagnostic') !== wantDiag) bad.push('state ' + m.checkoutStateKey);
        if (m.checkoutStateKey !== ref.checkoutStateKey || !!m.divergenceEligible !== !!ref.divergenceEligible) bad.push('builder ' + m.checkoutStateKey + '/' + m.divergenceEligible + ' vs card ' + ref.checkoutStateKey + '/' + ref.divergenceEligible);
        if (m.laborCalc !== ref.laborEstimate) bad.push('builder labor $' + m.laborCalc + ' vs card $' + ref.laborEstimate);
        if (wantDiag && !/On-site quote/.test(text(doc.getElementById('sqQuoteOut')))) bad.push('quote panel is not the on-site quote');
        if (!wantDiag && !/Fixed price/.test(text(doc.getElementById('sqQuoteOut')))) bad.push('quote panel is not the fixed price');
        if (bad.length) out.builder.push(key + ' + "' + label + '": ' + bad.join('; '));
      } catch (err) { out.builder.push(key + ' + "' + label + '": ' + (err && err.message)); }
    }
  }
  dom.window.close();
  return out;
}

// ── mutation harness ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────
function mutantHtml(label, fn) {
  const mutated = fn(QR_TEXT);
  check('mutant "' + label + '" changed the page source', mutated !== QR_TEXT);
  return assemble(mutated, ROOT);
}

(async () => {
  console.log('\n=== 1. data: every entity that can turn diagnostic authors a second path ===');
  console.log('  (' + DYN.length + ' dynamic entities and ' + SVC.length + ' services can turn diagnostic)');
  const D = dataLeg(DB0);
  check('every diagnostic-capable entity (dynamic and real service) has a non-empty remote_deep_dive_modules -- missing: ' + D.missing.length, D.missing.length === 0, D.missing.join(', '));
  check('each names a real intake module', D.bogus.length === 0, D.bogus.join(', '));
  check('none is a question the entity already asks', D.redundant.length === 0, D.redundant.join(', '));
  check('compiled.service_index says the same as dynamic_services for every one', D.mirror.length === 0, D.mirror.join(', '));
  check('every diagnostic-capable real service has one too', SVC.every(s => (s.remote_deep_dive_modules || []).length > 0), SVC.filter(s => !(s.remote_deep_dive_modules || []).length).map(s => s.id).join(', '));

  const HTML = assemble(QR_TEXT, ROOT);
  console.log('\n=== 2-5. the real page: Fork, Path A, Path B, the guided builder ===');
  const P = await pageLeg(HTML, DB0);
  console.log('  (' + P.entities + ' entities reached; ' + P.fork.length + ' draw the Fork; control answers ' + P.controlN + '; builder cases ' + P.builderN + ')');
  check('no entity failed to load or be answered -- errors: ' + P.errors.length, P.errors.length === 0, P.errors.slice(0, 6).join(' | '));
  check('every diagnostic-capable entity draws the Fork for its diagnostic answer (both buttons, divergenceEligible) -- without: ' + P.noFork.length, P.noFork.length === 0 && P.fork.length === DYN.length + SVC.length, P.noFork.slice(0, 8).join(' | '));
  check('control: an answer that is not diagnostic draws the firm price card, not the Fork (' + P.controlN + ' answers) -- violations: ' + P.control.length, P.controlN >= 10 && P.control.length === 0, P.control.slice(0, 6).join(' | '));
  check('Path A puts the entity\'s second-path question on the screen -- without: ' + P.pathA.length, P.pathA.length === 0, P.pathA.slice(0, 6).join(' | '));
  check('and answering it leaves a price card (no second Fork, route diverged "remote") -- violations: ' + P.afterA.length, P.afterA.length === 0, P.afterA.slice(0, 6).join(' | '));
  check('Path B draws the flat diagnostic fee and the credit terms -- violations: ' + P.pathB.length, P.pathB.length === 0, P.pathB.slice(0, 6).join(' | '));
  check('guided builder: the chosen condition prices as the answer it is -- the diagnostic chip is the diagnostic quote, the others are not, and the state and the price are the typed card\'s (' + P.builderN + ' cases) -- violations: ' + P.builder.length, P.builderN >= 14 && P.builder.length === 0, P.builder.slice(0, 6).join(' | '));

  console.log('\n=== 6. one definition ===');
  { const defs = (QR_TEXT.match(/function resolveBuilderConditionAnswer\(/g) || []).length, calls = (QR_TEXT.match(/resolveBuilderConditionAnswer\(/g) || []).length - defs;
    check('resolveBuilderConditionAnswer is defined exactly once', defs === 1, 'definitions: ' + defs);
    check('and sqBuilderFinish is its one caller', calls === 1 && /function sqBuilderFinish\(\)[\s\S]*?resolveBuilderConditionAnswer\(/.test(QR_TEXT), 'call sites: ' + calls); }

  console.log('\n=== 7. non-vacuity: a break in the page or the data fails the check that guards it ===');
  { // the splice leaves the route's visible chain as it was before the second path was appended
    const h = mutantHtml('the splice leaves the visible chain stale', src => src.replace(/if \(route\.visibleChain\) \{\s*const _answers = route\.answers \|\| \{\};/, 'if (false) {\n                const _answers = route.answers || {};'));
    const r = await pageLeg(h, DB0, { noBuilder: true, only: [{ key: 'dishwasher_repair', svc: true }, { key: 'minor_home_repairs+minor_home_repairs_appliances_dishwasher+Repair', svc: false }] });
    check('  -> Path A draws nothing on the service and on the fallback (' + r.pathA.length + ' of 2 entities without the question)', r.pathA.length === 2); }
  { // Path A rebuilds a catalog context from the entity, as it did before
    const h = mutantHtml('Path A rebuilds a catalog context', src => src.replace('if (prevRoute.context) {\n                ctx = Object.assign({}, prevRoute.context);', 'if (false) {\n                ctx = Object.assign({}, prevRoute.context);'));
    const key = 'minor_home_repairs+minor_home_repairs_appliances_dishwasher+Repair';
    const r = await pageLeg(h, DB0, { noBuilder: true, only: [{ key, svc: false }, { key: 'dishwasher_repair', svc: true }] });
    check('  -> the fallback draws no second-path question while the named service still does (' + r.pathA.length + ' without; fallback among them: ' + r.pathA.some(x => x.startsWith(key)) + ')', r.pathA.length === 1 && r.pathA[0].startsWith(key)); }
  { // the builder keeps the chosen condition as words only
    const h = mutantHtml('the builder drops the chosen condition', src => src.replace('if (_condAnswer) S.answers[_condAnswer.moduleKey] = _condAnswer.label;', ''));
    const r = await pageLeg(h, DB0, { only: [] });
    check('  -> the builder check goes red (' + r.builder.length + ' of ' + r.builderN + ' cases)', r.builder.length >= 8); }
  { // an entity loses its second path in the data
    const db = clone(DB0), k = 'minor_home_repairs+minor_home_repairs_appliances_washer+Repair'; delete db.dynamic_services[k].remote_deep_dive_modules;
    const d = dataLeg(db); check('  -> the data check names it (' + d.missing.join(',') + ')', d.missing.length === 1 && d.missing[0] === k);
    const r = await pageLeg(HTML, db, { noBuilder: true, only: [{ key: k, svc: false }] });
    check('  -> and the rendered Fork is gone for it (' + r.noFork.length + ' entity without the Fork)', r.noFork.length === 1); }

  console.log('\n[diagnostic answer reaches the Fork] ' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail > 0 ? 1 : 0);
})().catch(err => { console.error(err); process.exit(2); });
