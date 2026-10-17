#!/usr/bin/env node
/**
 * verify_chips_not_fees.js -- a chip (a #smart_tag shown under the text box) is NEVER a pricing input (T180 8/n).
 *
 * @enforces P-INVARIANT-CHIPSNOTFEES
 *
 * THE RULE (Charter, T135: "No chip carries a fee ... Fees live on answers; the pricing engine reads answers, not chips") AND THE OPERATOR'S RULING, 2026-10-16 23:34 NY: "by 'chips' I assumed it was understood
 * to be the #smart_tags that appear in the adlib under the text input box ... those SHOULD NEVER be used to increase pricing. The client responses are 'responses' or 'answers'."
 *
 * WHAT WAS WRONG. computeUnifiedQuote ratcheted the hourly-rate tier from the worst `escalate_complexity` among the ACTIVE TAGS (v9.2, PENDING_DECISIONS #149): #brick_wall -> specialized, #fragile_item -> skilled.
 * A chip raised the rate in its own right. Measured on the 2,988-point golden master: 8 points were higher because of it (e.g. 235 -> 198, 705 -> 593, 250 -> 213, 750 -> 638 once removed). T180 8/n deletes the
 * loop. A fact the NLP detected still reaches the price the proper way: the tag's `answers` map is synthesized into real answers upstream (and gated by the client's affirmation), and the ANSWER carries the
 * fee / minutes / tier. `escalate_complexity` on a tag is still read, by applyLiveConfidenceEscalation, for the confidence BAR -- a bar, not a price (verify_single_escalation_path.js holds that).
 *
 * WHAT THIS HOLDS (four legs, none of them a copy of the engine and none a frozen price):
 *   1. THE TAG CARRIES NO MONEY     Every field a smart tag has is on a short list of vocabulary that is not price (labels, synonyms, scoping, the answers it stands for, a confidence tier); no tag field's name says
 *                                   fee / price / cost / rate / minutes / surcharge / modifier; every value in a tag's `answers` is an option LABEL (a string), never a number.
 *   2. THE ENGINE IGNORES THE TAG   computeUnifiedQuote, for EVERY smart tag x EVERY named service and dynamic service: the quote with the tag active equals the quote with no tag -- labor, minutes, tier, hourly rate, checkout state,
 *                                   dispatch fee, fee breakdown. (A tag is allowed to add its LABEL; nothing else moves.)
 *   3. THE PRODUCTION PATH TOO      computeQuoteFromState (the page's own entry, with the chargeability gate), with each tag chosen by the client (manual = affirmed), on a catalogue whose tags have had their `answers` removed
 *                                   (so the one legitimate channel, answer synthesis, is closed): the same equality. This is what shows the money cannot arrive by a side door of the state path.
 *   4. THE ANSWER IS THE CHANNEL    Counted, not asserted as a price: with the real catalogue, the tags that DO move a price do so only through their own `answers` (a tag with an empty `answers` map moves nothing).
 *
 * NON-VACUITY (R-TEST-CANFAIL): the engine text is mutated and legs 2 and 3 must go red --
 *   M1  the deleted loop is put back (worst `escalate_complexity` among the active tags feeds the tier): red, and only on the tags that declare a tier (#brick_wall, #fragile_item);
 *   M2  a tag fee is read in the label loop (`extraFee += t.fee`) on a catalogue where one tag carries `fee: 25`: red on that tag, at every entity it is valid for;
 *   plus: leg 1 is shown able to fail on a tag with a `fee` field and a tag with a numeric answer; and the sweep is shown to be non-empty (tags x entities counted).
 *
 * Edits are exact single-occurrence split/join (never String.replace, whose `$'` patterns corrupt code). Node only; no browser, no network.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.BTNYC_ROOT ? path.resolve(process.env.BTNYC_ROOT) : path.resolve(__dirname, '..');
let passed = 0, failed = 0;
const check = (label, ok, detail) => { if (ok) { passed++; console.log('  ✓ ' + label); } else { failed++; console.log('  ✗ ' + label + (detail ? ' -- ' + detail : '')); } };
const clone = o => JSON.parse(JSON.stringify(o));

const BASE_DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
const FILES = ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js'];
const SRC = Object.fromEntries(FILES.map(f => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]));

// one sandbox = one catalogue + one set of engine texts
function boot(DB, mutate) {
  const sb = { DB, SERVICE_DATA: DB, window: { DB }, console: { log() {}, warn() {}, error() {} } }; sb.global = sb; vm.createContext(sb);
  for (const f of FILES) vm.runInContext(mutate && mutate[f] ? mutate[f](SRC[f]) : SRC[f], sb, { filename: f });
  return sb;
}
// exact single-occurrence edit; returns null when the needle is not there exactly once (so a mutant that did not apply cannot pass as "caught")
function editOnce(src, needle, replacement) {
  const parts = src.split(needle);
  return parts.length === 2 ? parts[0] + replacement + parts[1] : null;
}

const TAGS = Object.keys(BASE_DB.smart_tags);
const SERVICES = BASE_DB.services;
const DYN = Object.entries(BASE_DB.dynamic_services || {});

// ---- leg 1: the tag carries no money -------------------------------------------------------------------------------------------------------------------------------------------------
const ALLOWED_TAG_FIELDS = new Set(['id' /* T181: the Charter's stable typed id (tag.<key>); identity, not a price */, 'synonyms', 'answers', 'requires', 'display_group', 'mutually_exclusive', 'escalate_complexity', 'applicable_categories', 'is_logistic', 'ui_phrase', 'negation_phrase',
  'applicable_group_ids', 'note', '_review_note', 'excluded_service_ids', 'is_default_for_group', 'context_hints', 'derived_from', '_note_scoping', 'display_name', 'label_short']);
const MONEY_WORDS = /fee|price|cost|rate|minute|surcharge|modifier|dollar|amount|charge/i;
function tagMoneyProblems(db) {
  const bad = [];
  for (const [id, t] of Object.entries(db.smart_tags)) {
    for (const k of Object.keys(t)) {
      if (MONEY_WORDS.test(k)) bad.push(`${id}.${k}: the field's name says money`);
      else if (!ALLOWED_TAG_FIELDS.has(k)) bad.push(`${id}.${k}: a tag field not on the vocabulary list (file it, or it is a new way for a chip to carry something)`);
    }
    for (const [m, v] of Object.entries(t.answers || {})) if (typeof v !== 'string') bad.push(`${id}.answers.${m} is ${typeof v}, not an option label`);
  }
  return bad;
}

// ---- legs 2 and 3: the sweeps ----------------------------------------------------------------------------------------------------------------------------------------------------------
const QUOTE_KEYS = ['laborEstimate', 'totalMin', 'complexityTier', 'tierRate', 'checkoutStateKey', 'dispatchFee', 'base'];
const sig = r => JSON.stringify(QUOTE_KEYS.map(k => r[k])) + '|' + (r.feeBreakdown || []).map(f => f.source + ':' + f.fee).join(',');
function sweepDirect(sb) {
  const diffs = []; let points = 0;
  const entities = SERVICES.map(s => ({ name: s.id, svc: s, dynDef: null })).concat(DYN.map(([k, d]) => ({ name: 'dyn:' + k, svc: null, dynDef: d })));
  for (const e of entities) {
    let none; try { none = sig(sb.computeUnifiedQuote({ svc: e.svc, dynDef: e.dynDef, activeTagIds: [], answers: {}, qty: 1 })); } catch (x) { diffs.push(e.name + ' (no tag): ' + x.message); continue; }
    for (const t of TAGS) {
      points++;
      try { const got = sig(sb.computeUnifiedQuote({ svc: e.svc, dynDef: e.dynDef, activeTagIds: [t], answers: {}, qty: 1 })); if (got !== none) diffs.push(`${e.name} + ${t}`); } catch (x) { diffs.push(`${e.name} + ${t}: ${x.message}`); }
    }
  }
  return { diffs, points, entities: entities.length };
}
function sweepState(sb) {
  const diffs = []; let points = 0;
  const rec = r => JSON.stringify([r.laborCalc, r.totalMin, r.tierKey, r.tierRate, r.checkoutStateKey, r.dispatchFee]);
  const mkNamed = (s, tags) => ({ qty: 1, intent: { key: s.id, category: s.ui_taxonomy.category_id, label: 'x', qtyLabel: 'item' }, stype: 'Repair', answers: {}, detTagIds: [], manTagIds: tags.slice(), negatedTagIds: [], inherentTagIds: [], userTagIds: [], _svc: s, _tagsAffirmed: false });
  for (const s of SERVICES) {
    let none; try { none = rec(sb.computeQuoteFromState(mkNamed(s, []))); } catch (x) { diffs.push(s.id + ' (no tag): ' + x.message); continue; }
    for (const t of TAGS) { points++; try { if (rec(sb.computeQuoteFromState(mkNamed(s, [t]))) !== none) diffs.push(`${s.id} + ${t}`); } catch (x) { diffs.push(`${s.id} + ${t}: ${x.message}`); } }
  }
  for (const [k, d] of DYN) {
    const parts = k.split('+'), cat = parts[0], stype = parts[parts.length - 1], grp = parts.length === 3 ? parts[1] : null;
    const mkDyn = tags => ({ qty: 1, intent: { key: 'builder:' + (grp || cat), category: cat, label: 'x', group: 'x', base: (d.financial_engine && d.financial_engine.base_price) || 0, stype, qtyLabel: 'item', _groupId: grp }, stype, answers: {}, detTagIds: [], manTagIds: tags.slice(), negatedTagIds: [], inherentTagIds: [], userTagIds: [], _svc: null, _tagsAffirmed: false });
    let none; try { none = rec(sb.computeQuoteFromState(mkDyn([]))); } catch (x) { diffs.push('dyn:' + k + ' (no tag): ' + x.message); continue; }
    for (const t of TAGS) { points++; try { if (rec(sb.computeQuoteFromState(mkDyn([t]))) !== none) diffs.push(`dyn:${k} + ${t}`); } catch (x) { diffs.push(`dyn:${k} + ${t}: ${x.message}`); } }
  }
  return { diffs, points };
}
const tagsOf = diffs => [...new Set(diffs.map(d => (d.match(/ \+ (#[a-z0-9_]+)/) || [])[1]).filter(Boolean))].sort();
const stripAnswers = db => { const c = clone(db); for (const t of Object.values(c.smart_tags)) t.answers = {}; return c; };

console.log('verify_chips_not_fees.js');

console.log('\n1. The tag carries no money');
const p1 = tagMoneyProblems(BASE_DB);
check(`all ${TAGS.length} smart tags: every field is on the non-price vocabulary list, none is named for money, every answer is an option label`, p1.length === 0, p1.slice(0, 4).join(' | '));
const fakeFee = clone(BASE_DB); fakeFee.smart_tags[TAGS[0]].fee = 25;
check('leg 1 is red for a tag with a `fee` field (non-vacuity)', tagMoneyProblems(fakeFee).some(p => /fee/.test(p)), tagMoneyProblems(fakeFee).join(' | '));
const fakeNum = clone(BASE_DB); const withAns = TAGS.find(t => Object.keys(BASE_DB.smart_tags[t].answers || {}).length); fakeNum.smart_tags[withAns].answers[Object.keys(BASE_DB.smart_tags[withAns].answers)[0]] = 25;
check('leg 1 is red for a tag whose answer is a number, not a label (non-vacuity)', tagMoneyProblems(fakeNum).some(p => /not an option label/.test(p)), tagMoneyProblems(fakeNum).join(' | '));
const fakeOther = clone(BASE_DB); fakeOther.smart_tags[TAGS[0]].hourly_markup = 1.2;
check('leg 1 is red for a tag field that is not on the list at all (non-vacuity)', tagMoneyProblems(fakeOther).some(p => /not on the vocabulary list|says money/.test(p)), tagMoneyProblems(fakeOther).join(' | '));

console.log('\n2. The engine ignores the tag (computeUnifiedQuote, every tag x every named and dynamic service)');
const real = boot(BASE_DB);
const d2 = sweepDirect(real);
check(`the sweep is non-empty: ${TAGS.length} tags x ${d2.entities} entities = ${d2.points} points`, d2.points === TAGS.length * d2.entities && d2.points > 1000, d2.points + ' points');
check('no point differs: the quote with the tag active equals the quote with no tag (labor, minutes, tier, rate, checkout state, dispatch, fee breakdown)', d2.diffs.length === 0, `${d2.diffs.length} differ; tags: ${tagsOf(d2.diffs).join(', ')}; first: ${d2.diffs.slice(0, 3).join(' | ')}`);

console.log('\n3. The production path too (computeQuoteFromState, tag chosen by the client, tag answers removed so the one legitimate channel is closed)');
const closed = boot(stripAnswers(BASE_DB));
const d3 = sweepState(closed);
check(`the sweep is non-empty: ${d3.points} points (${TAGS.length} tags x ${SERVICES.length + DYN.length} entities)`, d3.points === TAGS.length * (SERVICES.length + DYN.length), d3.points + ' points');
check('no point differs on the production path', d3.diffs.length === 0, `${d3.diffs.length} differ; tags: ${tagsOf(d3.diffs).join(', ')}; first: ${d3.diffs.slice(0, 3).join(' | ')}`);

console.log('\n4. The answer is the channel (counted)');
const withRealAnswers = sweepState(real);
const movers = tagsOf(withRealAnswers.diffs);
const noAnswers = movers.filter(t => !Object.keys(BASE_DB.smart_tags[t].answers || {}).length);
console.log(`     (with the tags' own answers open: ${withRealAnswers.diffs.length} of ${withRealAnswers.points} points move, across ${movers.length} tags: ${movers.join(', ')})`);
check('every tag that moves a price on the production path has `answers` (the answer is what moved it); a tag with none moves nothing', noAnswers.length === 0, 'tags with no answers that moved a price: ' + noAnswers.join(', '));
check('...and the channel is real: at least one tag moves a price through its answers (a leg with no mover proves nothing)', movers.length > 0, movers.length + ' movers');

console.log('\n5. Non-vacuity: the engine is mutated and the sweeps must go red');
const LOOP_NEEDLE = 'const complexityTier = deriveComplexityTier(totalMin, answerOverrideTier, exactTier);';
const LOOP_BACK = 'let _worst = answerOverrideTier; for (const tid of activeTagIds) { const o = smartTags[tid]?.escalate_complexity; if (o && (TIER_RANK[o] || 0) > (TIER_RANK[_worst] || 0)) _worst = o; } ' +
  'const complexityTier = deriveComplexityTier(totalMin, _worst, exactTier);';
const m1src = editOnce(SRC['pricing_engine.js'], LOOP_NEEDLE, LOOP_BACK);
check('M1 applies exactly once (the needle is in the engine exactly once)', m1src !== null, 'needle count != 1');
if (m1src !== null) {
  const m1 = boot(BASE_DB, { 'pricing_engine.js': () => m1src });
  const r1 = sweepDirect(m1), r1s = sweepState(boot(stripAnswers(BASE_DB), { 'pricing_engine.js': () => m1src }));
  const tiered = TAGS.filter(t => BASE_DB.smart_tags[t].escalate_complexity).sort();
  check('M1 (the deleted tier loop put back): leg 2 goes red', r1.diffs.length > 0, 'no point differed');
  check('M1: only tags that declare a tier are red (' + tiered.join(', ') + '), and every one of them is seen', JSON.stringify(tagsOf(r1.diffs)) === JSON.stringify(tiered), 'red tags: ' + tagsOf(r1.diffs).join(', '));
  check('M1: leg 3 (the production path) goes red too', r1s.diffs.length > 0, 'no point differed');
}
const LABEL_NEEDLE = 'activeLabels.push(sqTagLabel(t, tid));';
const m2src = editOnce(SRC['pricing_engine.js'], LABEL_NEEDLE, LABEL_NEEDLE + ' extraFee += Number(t.fee) || 0;');
check('M2 applies exactly once', m2src !== null, 'needle count != 1');
if (m2src !== null) {
  const feeDb = clone(BASE_DB); const victim = TAGS.find(t => !BASE_DB.smart_tags[t].escalate_complexity); feeDb.smart_tags[victim].fee = 25;
  const r2 = sweepDirect(boot(feeDb, { 'pricing_engine.js': () => m2src }));
  check(`M2 (a tag fee read in the label loop, ${victim}.fee = 25): leg 2 goes red, on that tag only`, r2.diffs.length > 0 && JSON.stringify(tagsOf(r2.diffs)) === JSON.stringify([victim]), 'red tags: ' + tagsOf(r2.diffs).join(', '));
  check('M2: leg 1 catches the same tag from the catalogue side', tagMoneyProblems(feeDb).some(p => p.startsWith(victim + '.fee')), tagMoneyProblems(feeDb).join(' | '));
}

console.log(`\n[chips not fees] ${passed} passed, ${failed} failed (of ${passed + failed} checks)`);
process.exit(failed ? 1 : 0);
