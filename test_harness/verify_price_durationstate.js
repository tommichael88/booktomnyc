#!/usr/bin/env node
/**
 * verify_price_durationstate.js -- R-PRICE-DURATIONSTATE: a job longer than sixty minutes may not be presented as a flat-rate card (T180 6/n). A KNOWN VIOLATION, measured and pinned; PENDING_DECISIONS #234.
 *
 * The Charter (Part VIII): "A job whose resolved minimum minutes exceed sixty may not be presented as a flat-rate card, even if its tier is routine. Tier names skill; checkout state names how the price is
 * presented." and "A resolved job whose minimum minutes cross the threshold -- default sixty, sourced from policy -- may not resolve to a standard_flat_rate or any checkout state whose presentation implies
 * a small, bounded visit. It resolves instead to hourly | bulk_rate | half_day | project_based." Accomplishment: "duration alone never changes skill or risk tier."
 *
 * WHAT IS MEASURED. The production quote path (computeQuoteFromState, the three engine modules whole) for every service at quantities 1, 2, 3, 5, 10, 20; for each point: the resolved minimum minutes, the
 * checkout state, whether that state's presentation is flat (the catalog's own checkout_states.<state>.is_flat_checkout), and the skill tier.
 *
 * WHAT IS FOUND (T180, pinned below; the numbers are the evidence in #234):
 *   - the catalog has four checkout states (database_summation, diagnostic, project_based, standard_flat_rate); hourly, bulk_rate and half_day, which the Rule resolves a long job to, do not exist;
 *   - no policy value for the sixty-minute threshold exists (nothing to source it from);
 *   - the flat-rate state is presented for jobs whose resolved minutes exceed sixty, at the points and services counted below;
 *   - the only duration -> tier rule is the one #229 holds (deriveComplexityTier reads minutes); that is the mechanism the Rule says was aimed wrongly.
 * It changes what customers are shown and charged, so it is an Operator decision (#234, packaged with #229, which it depends on). NOTHING in the runtime is changed here.
 *
 * HOW A RULING CHANGES THIS TEST. When #234 is ruled and implemented: delete the three KNOWN pins, and the "no flat-rate point above the threshold" line below, already written as the Rule states it, replaces them.
 * (It is asserted now as the pinned count, so it is green only while the violation is exactly as measured; it turns red the moment the count moves in either direction.)
 *
 * NON-VACUITY (R-TEST-CANFAIL): the detector is run on synthetic points -- a >60-minute job in an hourly state is not a violation, in the flat state it is; the sweep covers every service; and the counterfactual of
 * the engine with the flat state refused above the threshold is not simulated (that is the fix); instead the detector is shown to count exactly the synthetic violations it is given.
 *
 * Deliberately NOT tagged @enforces: the Rule is not enforced by the runtime; tagging a test that records its violation would claim otherwise (the Charter rule-index test counts @enforces tags).
 * Node only; no browser, no network.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.BTNYC_ROOT ? path.resolve(process.env.BTNYC_ROOT) : path.resolve(__dirname, '..');
let passed = 0, failed = 0;
const check = (label, ok, detail) => { if (ok) { passed++; console.log('  ✓ ' + label); } else { failed++; console.log('  ✗ ' + label + (detail ? ' -- ' + detail : '')); } };

const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
const sb = { DB, SERVICE_DATA: DB, window: { DB }, console: { log() {}, warn() {}, error() {} } }; sb.global = sb; vm.createContext(sb);
for (const f of ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });

const THRESHOLD = 60;                                             // the Charter's default; the catalog authors none (pinned below)
const QTYS = [1, 2, 3, 5, 10, 20];
const STATES = DB.checkout_states || {};
const isFlat = k => !!(STATES[k] && STATES[k].is_flat_checkout);

// the detector: points whose resolved minutes exceed the threshold while the checkout state is presented as flat
const violations = rows => rows.filter(r => r.min > THRESHOLD && isFlat(r.state));

console.log('verify_price_durationstate.js');
console.log('\n1. The states and the policy the Rule names');
const have = Object.keys(STATES).sort();
check('the catalog authors exactly four checkout states: ' + have.join(', '), JSON.stringify(have) === JSON.stringify(['database_summation', 'diagnostic', 'project_based', 'standard_flat_rate']), have.join(','));
const missing = ['hourly', 'bulk_rate', 'half_day'].filter(k => !STATES[k]);
check('KNOWN GAP (pinned, #234): the Rule resolves a long job to hourly | bulk_rate | half_day | project_based; the catalog has only project_based -- missing: ' + missing.join(', '), JSON.stringify(missing) === JSON.stringify(['hourly', 'bulk_rate', 'half_day']), missing.join(','));
const flatStates = have.filter(isFlat);
check('the flat presentation is the catalog\'s own: ' + flatStates.join(', ') + ' (is_flat_checkout)', flatStates.length >= 1 && flatStates.includes('standard_flat_rate'), flatStates.join(','));
const policyHits = JSON.stringify([DB.global_rules, DB.invariants, DB.meta, DB.workflow]).match(/"[a-z_]*(?:duration_threshold|flat_rate_max_minutes|max_flat_minutes|checkout_duration|sixty|60_min)[a-z_]*"/gi) || [];
check('KNOWN GAP (pinned, #234): no policy value for the sixty-minute threshold exists in the catalog (the Rule says it is "sourced from policy")', policyHits.length === 0, policyHits.join(', '));

console.log('\n2. The production quote path, every service, quantities ' + QTYS.join(', '));
const rows = [];
for (const s of DB.services) for (const q of QTYS) {
  const st = { qty: q, intent: { key: s.id, category: s.ui_taxonomy.category_id, label: 'x', qtyLabel: 'item' }, stype: 'Repair', answers: {}, detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: [] };
  try { const r = sb.computeQuoteFromState(st); rows.push({ id: s.id, q, min: Number(r.totalMin), state: r.checkoutStateKey, tier: r.tierKey }); } catch (e) { rows.push({ id: s.id, q, err: e.message }); }
}
const ok = rows.filter(r => !r.err);
check('the sweep ran through the production quote path for all ' + DB.services.length + ' services x ' + QTYS.length + ' quantities with no error', rows.length === DB.services.length * QTYS.length && ok.length === rows.length && ok.every(r => Number.isFinite(r.min)), rows.filter(r => r.err).slice(0, 3).map(r => r.id + ': ' + r.err).join('; '));
const byState = {}; for (const r of ok) byState[r.state] = (byState[r.state] || 0) + 1;
console.log('     (points by checkout state: ' + Object.entries(byState).map(([k, v]) => k + ' ' + v).join(', ') + ')');

const v = violations(ok);
const vServices = [...new Set(v.map(r => r.id))].sort();
const vAtOne = [...new Set(v.filter(r => r.q === 1).map(r => r.id))].sort();
const flatPoints = ok.filter(r => isFlat(r.state));
// the pinned measurement (T180): of the points the flat card is presented for, this many resolve to more than sixty minutes
const PIN = { flatPoints: 420, violatingPoints: 236, violatingServices: 39 };
check('KNOWN VIOLATION (pinned, #234): the flat-rate card is presented at ' + PIN.flatPoints + ' sweep points; at ' + PIN.violatingPoints + ' of them the resolved minimum exceeds ' + THRESHOLD + ' minutes (measured: ' + flatPoints.length + ' flat, ' + v.length + ' above the threshold)',
  flatPoints.length === PIN.flatPoints && v.length === PIN.violatingPoints, flatPoints.length + ' flat, ' + v.length + ' violating');
check('KNOWN VIOLATION (pinned, #234): ' + PIN.violatingServices + ' services are presented as flat-rate at quantity 1 with a resolved minimum above ' + THRESHOLD + ' minutes (measured: ' + vAtOne.length + ')', vAtOne.length === PIN.violatingServices, vAtOne.join(', '));
const longest = v.slice().sort((a, b) => b.min - a.min)[0];
console.log('     (longest flat-rate card: ' + (longest ? longest.id + ' x' + longest.q + ' at ' + longest.min + ' minutes' : 'none') + '; services affected at any quantity: ' + vServices.length + ')');
// the tier is a separate fact: the Rule's own example (twenty knob swaps stay routine) -- here, recorded not asserted: how many violating points sit in each tier
const byTier = {}; for (const r of v) byTier[r.tier] = (byTier[r.tier] || 0) + 1;
console.log('     (violating points by skill tier: ' + Object.entries(byTier).map(([k, n]) => k + ' ' + n).join(', ') + ')');

console.log('\n3. Non-vacuity: the detector counts exactly the violations it is given');
{
  const syn = [
    { id: 'a', min: 90, state: 'standard_flat_rate' },     // violation
    { id: 'b', min: 90, state: 'project_based' },           // long, but not presented as small and bounded
    { id: 'c', min: 60, state: 'standard_flat_rate' },     // at the threshold, not above ("exceed sixty")
    { id: 'd', min: 61, state: 'standard_flat_rate' },     // violation
    { id: 'e', min: 90, state: 'diagnostic' },
  ];
  const got = violations(syn).map(r => r.id).join('');
  check('on five synthetic points the detector finds exactly the two flat-rate cards above sixty minutes (a, d); not the project, the diagnostic or sixty itself', got === 'ad', got);
  check('on a sweep with every flat-rate point at or under sixty it finds none (the form the test takes when #234 is implemented)', violations(ok.map(r => isFlat(r.state) ? { ...r, min: Math.min(r.min, THRESHOLD) } : r)).length === 0);
  check('and the sweep it was run on includes points above the threshold in more than one state (the detector was not handed an all-short catalog)', ok.some(r => r.min > THRESHOLD && isFlat(r.state)) && ok.some(r => r.min > THRESHOLD && !isFlat(r.state)));
}

console.log('\n[Price / duration state: a pinned known violation (#234)] ' + passed + ' passed, ' + failed + ' failed (of ' + (passed + failed) + ' checks)');
process.exit(failed ? 1 : 0);
