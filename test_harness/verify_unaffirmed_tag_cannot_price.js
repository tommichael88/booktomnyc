#!/usr/bin/env node
/**
 * verify_unaffirmed_tag_cannot_price.js -- #161: a tag the customer's words DETECTED but the customer has not affirmed must not change the price, on any entry path,
 * unless the quote is confident without asking. (Class: a gate on a claim that does not cover what is derived from the claim before the gate -- the gate gated the tag's
 * direct effect, and the answers the tag synthesizes, computed before the gate from every tag, priced regardless. R-INVARIANT-PROVENANCE: the number on screen must be
 * traceable to the tags the customer affirmed; R-CLIENT-CONVERGE: the same on every entry path.)
 *
 * The property, stated once and checked over everything the catalog allows (no frozen number):
 *   1. GATE: for every (service, ONE detected tag valid for its category) with the tag unaffirmed and the bar unmet, the quote -- labor, minutes, checkout state, the
 *      fee breakdown -- is the quote the same session would get with no detected tag at all. Held on the state path (computeQuoteFromState), the orchestrator path
 *      (executeWorkflow on a catalog context) and the free-text route (every service name, a counted phrasing of each, and a corpus of ordinary requests).
 *   2. AFFIRMATION: once the customer affirms the tag it prices exactly what choosing it would (the answers it synthesizes price after the gate opens, as before).
 *   3. NOT ASKED: the gate prices, it does not ask (P-INTAKE-INFER): the answer a detected tag synthesizes stays on the session, so the question stays retired.
 *   4. ONE DEFINITION: resolveChargeableAnswers is defined once and is what both gated sites call.
 *   5. NON-VACUITY: five mutants of the page's own source -- the state path priced from every answer, the orchestrator path priced from every answer, the gate that
 *      also deletes the answers (the "re-ask" option), a gate that never opens (affirmation no longer prices), and the helper turned into a no-op -- each fail the check
 *      that guards them; and the T173 tree (modules loaded from QR_ROOT_PRE, when given) fails check 1.
 * The ratchet this replaces was the ledger's own count (#161: 526 of 1,014 pairs); it is now zero, and a nonzero count fails.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..');
const MODS = ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js'];
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (detail ? '\n      ' + detail : '')); } };

function load(root, mutate) {
  const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
  const sb = { DB, SERVICE_DATA: DB, window: { DB }, console: { log() {}, warn() {}, error() {} } }; sb.global = sb; vm.createContext(sb);
  const touched = [];
  for (const f of MODS) { let src = fs.readFileSync(path.join(root, f), 'utf8'); if (mutate) { const m = mutate(src, f); if (m !== src) touched.push(f); src = m; } vm.runInContext(src, sb, { filename: f }); }
  sb.initNlpSets(); if (typeof sb.refreshNlpPreviewBindings === 'function') sb.refreshNlpPreviewBindings();
  return { DB, sb, touched };
}

const rec = r => JSON.stringify([r.laborCalc, r.totalMin, r.checkoutStateKey, r.feeBreakdown || [], r.activeLabels || []]);
const orec = r => JSON.stringify([r.laborEstimate, r.totalMin, r.checkoutStateKey]);

function stateLeg(env) {
  const { DB, sb } = env, smart = Object.keys(DB.smart_tags || {});
  const out = { pairs: 0, gated: 0, violations: [], metBar: 0, affirmedChecked: 0, affirmedBad: [], retiredChecked: 0, retiredBad: [] };
  for (const s of DB.services) {
    const cat = s.ui_taxonomy.category_id, grp = s.ui_taxonomy.group_id;
    const mk = over => Object.assign({ qty: 1, intent: { key: s.id, category: cat, label: 'x', qtyLabel: 'item' }, stype: 'Repair', answers: {}, detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: (s.default_tags || []).slice(), userTagIds: [], _svc: s, _tagsAffirmed: false }, over);
    const none = rec(sb.computeQuoteFromState(mk({})));
    for (const t of smart.filter(t => { try { return sb.tagValidForCategory(t, cat, grp); } catch (e) { return false; } })) {
      out.pairs++;
      const st = mk({ detTagIds: [t] }), q = sb.computeQuoteFromState(st);
      if (q.detTagsChargeable) out.metBar++;
      else {
        out.gated++;
        if (rec(q) !== none) out.violations.push(`${s.id} + ${t}: ${q.laborCalc} vs ${JSON.parse(none)[0]} with no tag`);
        // NOT ASKED: every answer the tag authors for a module that exists is still on the session
        for (const [m, label] of Object.entries(DB.smart_tags[t].answers || {})) {
          if (!DB.intake_modules || !DB.intake_modules[m]) continue;
          out.retiredChecked++; if (st.answers[m] !== label) out.retiredBad.push(`${s.id} + ${t}: ${m}`);
        }
      }
      // AFFIRMATION: affirmed prices what choosing it would (whatever the bar)
      out.affirmedChecked++;
      const aff = rec(sb.computeQuoteFromState(mk({ detTagIds: [t], _tagsAffirmed: true }))), chosen = rec(sb.computeQuoteFromState(mk({ manTagIds: [t] })));
      if (aff !== chosen) out.affirmedBad.push(`${s.id} + ${t}`);
    }
  }
  return out;
}

function orchLeg(env) {
  // The orchestrator's gate closes on the entries that are not confident by construction: a typed request (a catalog tap is confident, so its gate never closes and would
  // measure nothing). Each service's own display name is typed, the context the route builds is kept (entity, intent, quantity), and ONE detected tag is set on it.
  const { DB, sb } = env, smart = Object.keys(DB.smart_tags || {});
  const out = { pairs: 0, gated: 0, violations: [], affirmedBad: [] };
  for (const s of DB.services) {
    const cat = s.ui_taxonomy.category_id, grp = s.ui_taxonomy.group_id, text = (s.ui_taxonomy.display_name || s.id).toLowerCase();
    const ctx = over => Object.assign(sb.collectBookingContext_freeText(text), { detectedTagIds: [], manuallyToggledTagIds: [], negatedTagIds: [], tagsAffirmed: false }, over);
    let none; try { none = orec(sb.executeWorkflow(ctx({}), DB).quote); } catch (e) { continue; }
    for (const t of smart.filter(t => { try { return sb.tagValidForCategory(t, cat, grp); } catch (e) { return false; } })) {
      out.pairs++;
      const r = sb.executeWorkflow(ctx({ detectedTagIds: [t] }), DB);
      if (!r.quote.meetsConfidenceBar) { out.gated++; if (orec(r.quote) !== none) out.violations.push(`${s.id} + ${t}: ${r.quote.laborEstimate}`); }
      const aff = orec(sb.executeWorkflow(ctx({ detectedTagIds: [t], tagsAffirmed: true }), DB).quote), chosen = orec(sb.executeWorkflow(ctx({ manuallyToggledTagIds: [t] }), DB).quote);
      if (aff !== chosen) out.affirmedBad.push(`${s.id} + ${t}`);
    }
  }
  return out;
}

const CORPUS = ['my dishwasher is leaking', 'mount a tv', 'toilet keeps running', 'install 3 shelves', 'replace a light bulb', 'hang a very heavy mirror on a brick wall', 'urgent leak under the sink tonight', 'fix a squeaky door', 'assemble an ikea wardrobe',
  'patch a hole in the drywall', 'replace 5 ceiling tiles', 'install a ceiling fan', 'unclog the bathtub drain', 'repair a loose tile in the kitchen', 'put up curtain rods in two rooms', 'change the lock on the front door', 'install a smart thermostat',
  'my washing machine will not spin', 'hang pictures', 'caulk the shower', 'something is wrong with the window ac', 'not sure what is wrong with my stove', 'move a couch and a bookshelf', 'fix cabinet door hinge, not heavy'];
function textLeg(env) {
  const { DB, sb } = env, phrases = [...CORPUS];
  for (const s of DB.services) { const nm = (s.ui_taxonomy.display_name || s.id).toLowerCase(); phrases.push(nm, `I need 3 ${nm}`); }
  const out = { phrases: phrases.length, onCard: 0, violations: [] };
  for (const text of phrases) {
    let c, r; try { c = sb.collectBookingContext_freeText(text); r = sb.executeWorkflow(c, DB); } catch (e) { continue; }
    if (!(c.detectedTagIds || []).length || c.tagsAffirmed || !r.quote || r.quote.meetsConfidenceBar) continue;
    out.onCard++;
    const c2 = sb.collectBookingContext_freeText(text); c2.detectedTagIds = [];
    const base = sb.executeWorkflow(c2, DB);
    if (orec(r.quote) !== orec(base.quote)) out.violations.push(`"${text}": ${r.quote.laborEstimate} vs ${base.quote.laborEstimate} with the detected tags removed`);
  }
  return out;
}

console.log('\n=== 1-3. the real tree: the gate, the affirmation, the question stays retired ===');
const real = load(ROOT);
const S = stateLeg(real), O = orchLeg(real), T = textLeg(real);
console.log(`  (state path: ${S.pairs} (service, detected tag) pairs, ${S.gated} unaffirmed with the bar unmet, ${S.metBar} confident without asking; orchestrator: ${O.pairs} pairs, ${O.gated} gated; free text: ${T.phrases} phrases, ${T.onCard} land on the tag-affirmation card)`);
check('state path: no unaffirmed detected tag changes the quote (labor, minutes, checkout state, fee breakdown) -- violations: ' + S.violations.length, S.gated > 400 && S.violations.length === 0, S.violations.slice(0, 5).join(' | ') || 'too few gated pairs measured: ' + S.gated);
check('orchestrator path (typed entries, whose gate closes): no unaffirmed detected tag changes the quote -- violations: ' + O.violations.length, O.gated > 400 && O.violations.length === 0, O.violations.slice(0, 5).join(' | ') || 'too few gated pairs measured: ' + O.gated);
check('free text: no phrase that lands on the tag-affirmation card is priced by the tags it asks about -- violations: ' + T.violations.length, T.onCard >= 15 && T.violations.length === 0, T.violations.slice(0, 5).join(' | ') || 'too few cards measured: ' + T.onCard);
check('affirming a detected tag prices exactly what choosing it would, on the state path (' + S.affirmedChecked + ' pairs)', S.affirmedChecked > 900 && S.affirmedBad.length === 0, S.affirmedBad.slice(0, 5).join(' | '));
check('and on the orchestrator path (' + O.pairs + ' pairs)', O.pairs > 900 && O.affirmedBad.length === 0, O.affirmedBad.slice(0, 5).join(' | '));
check('the gate prices, it does not ask: every answer a detected tag synthesizes is still on the session (' + S.retiredChecked + ' answers), so the question stays retired', S.retiredChecked > 300 && S.retiredBad.length === 0, S.retiredBad.slice(0, 5).join(' | '));

console.log('\n=== 4. one definition ===');
{ const page = require('./_page.js').readPage(path.join(ROOT, 'qr.html'));
  const defs = (page.match(/function resolveChargeableAnswers\(/g) || []).length, calls = (page.match(/resolveChargeableAnswers\(/g) || []).length - defs;
  check('resolveChargeableAnswers is defined exactly once', defs === 1, 'definitions: ' + defs);
  check('and is what both gated sites call (computeQuoteFromState and orch_compute_quote): 2 call sites', calls === 2, 'call sites: ' + calls);
  check('no second copy of the rule is written in a gated site (no filtering of _tagSynthesizedModules by hand)', (page.match(/_tagSynthesizedModules\)\s*\)?\s*if\s*\(!activeTagIds/g) || []).length === 0); }

console.log('\n=== 5. non-vacuity: mutants of the page\'s own source fail the check that guards them ===');
function mutant(label, fn, expectFail) {
  const env = load(ROOT, fn);
  check('mutant "' + label + '" changed the source (' + env.touched.join(', ') + ')', env.touched.length === 1, 'files changed: ' + env.touched.length);
  return env;
}
{ const m1 = mutant('state path priced from every answer', src => src.replace('answers: pricedAnswers,', 'answers: state.answers || {},'));
  const s1 = stateLeg(m1); check('  -> the state-path gate check goes red (' + s1.violations.length + ' violations)', s1.violations.length > 100);
  const m2 = mutant('orchestrator path priced from every answer', src => src.replace('answers: resolveChargeableAnswers(common.answers, synthesizedByAll, chargeableTagIds, db)', 'answers: common.answers'));
  const o2 = orchLeg(m2); check('  -> the orchestrator gate check goes red (' + o2.violations.length + ' violations)', o2.violations.length > 50);
  const m3 = mutant('the gate also deletes the answers (the re-ask option)', src => src.replace(/const pricedAnswers = (resolveChargeableAnswers\([^;]*\));/, 'const pricedAnswers = (state.answers = $1);'));
  const s3 = stateLeg(m3); check('  -> the "question stays retired" check goes red (' + s3.retiredBad.length + ' answers lost)', s3.retiredBad.length > 100 && s3.violations.length === 0);
  const m4 = mutant('a gate that never opens', src => src.replace(/const pricedAnswers = resolveChargeableAnswers\([^;]*\);/, 'const pricedAnswers = resolveChargeableAnswers(state.answers, state._tagSynthesizedModules, resolveSessionTagIds(state, false), DB);').replace('const u = detTagsChargeable ? fullQuote : computeUnifiedQuote({', 'const u = computeUnifiedQuote({'));
  const s4 = stateLeg(m4); check('  -> the affirmation check goes red (' + s4.affirmedBad.length + ' pairs no longer price once affirmed)', s4.affirmedBad.length > 100);
  const m5 = mutant('the helper turned into a no-op', src => src.replace('return synthesizeAnswersFromTags(chargeableTagIds, explicit, {}, DB).answers;', 'return Object.assign({}, answers || {});'));
  const s5 = stateLeg(m5), o5 = orchLeg(m5); check('  -> both gate checks go red (' + s5.violations.length + ' state, ' + o5.violations.length + ' orchestrator)', s5.violations.length > 100 && o5.violations.length > 50); }
if (process.env.QR_ROOT_PRE) {
  const pre = load(process.env.QR_ROOT_PRE); const sp = stateLeg(pre), op = orchLeg(pre);
  check('the pre-fix tree (QR_ROOT_PRE) is red on both paths: ' + sp.violations.length + ' state and ' + op.violations.length + ' orchestrator pairs', sp.violations.length > 100 && op.violations.length > 50);
  console.log(`  (pre-fix tree: state ${sp.violations.length} of ${sp.gated} gated pairs, orchestrator ${op.violations.length} of ${op.gated})`);
}

console.log(`\n[unaffirmed tag cannot price] ${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
