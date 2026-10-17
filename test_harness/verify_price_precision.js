#!/usr/bin/env node
/**
 * verify_price_precision.js -- R-PRICE-PRECISION: pricing may not claim more precision than the resolution permits (T180 6/n). A KNOWN VIOLATION, measured and pinned; PENDING_DECISIONS #234.
 *
 * The Charter (Part VIII): "the presented outcome must not claim a level of precision the active resolution state does not justify. Exact quote, bounded range, conditional quote, and diagnostic pricing are
 * distinct reproducible outcomes." "Numeric precision bands belong to the owning policy/specification; this Playbook does not invent universal gap values." Accomplishment: "For every quote, the presented
 * exact amount, range, condition, or diagnostic is no more precise than the active resolved evidence supports; an unsupported exact amount is rejected."
 *
 * WHAT IS MEASURED. The production panel path (buildQuotePanelModel -> computeQuoteFromState, the three engine modules whole) for every service at quantities 1 and 3, with NO customer evidence (no answers, no
 * tags): the least resolved state a quote can be asked for. For each point: the checkout state, whether the legacy confidence bar is met (meetsConfidenceBar, the engine's existing measure of "enough evidence"),
 * and the FORM of the presented price: an exact "$X", or a lower bound "From $X".
 *
 * WHAT IS FOUND (T180, pinned below; the numbers are the evidence in #234), AND WHAT T182 CHANGED. At T180 the presentation had two forms, exact and "From $", chosen by the checkout state alone, so the exact form was
 *   presented below the confidence bar at 132 of 152 no-evidence points. The Operator's direction (2026-10-16 23:34 NY, confirmed 2026-10-17 02:30 NY) is that a flat quote is a FLOOR that rises with the time the
 *   client's answers add: it reads "From $X" until the engine's own confidence bar is met and a plain "$X" once the client has answered what sets the time (resolvePriceStatement, one definition for the panel and the
 *   card). That is now built for every quote the time model prices (q.timePriced: flat-rate services), which is 106 of the 132 points: the form follows the evidence for them. What remains is pinned: 26 of 152 points
 *   are services the time model does not price (hourly and assembly estimates drawn on the flat-rate card), and they still present an exact amount below the bar. The Rule's other two outcomes, a bounded range
 *   and a conditional quote, still do not exist, and the catalog still authors no precision policy (no bands, no thresholds, no ranges), so the Rule's mechanical test has no boundary to be written at.
 *   The 26 are an Operator decision (#234, packaged with the duration state). NOTHING about them is changed here.
 *
 * HOW A RULING CHANGES THIS TEST. When the 26 are ruled and implemented: delete the KNOWN pin; the line "no exact amount is presented below the confidence bar", already written as the Rule states it, replaces it.
 *
 * NON-VACUITY (R-TEST-CANFAIL): the detector is run on synthetic points (an exact amount at an unmet bar is a violation; a "From $" is not; an exact amount at a met bar is not) and counts exactly those; the sweep
 * contains points in each state and in both bar statuses, so the detector was not handed a one-sided catalog.
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

const QTYS = [1, 3];
const formOf = d => /^From \$\d/.test(d) ? 'from' : /^\$\d/.test(d) ? 'exact' : 'other';
// the detector: an exact amount presented while the engine's own confidence measure says the evidence is below the bar
const unsupported = rows => rows.filter(r => r.form === 'exact' && !r.bar);

console.log('verify_price_precision.js');
console.log('\n1. The outcomes the Rule names, and the policy it says they come from');
const policyKeys = new Set(); (function walk(o) { if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { policyKeys.add(k); walk(v); } })([DB.global_rules, DB.invariants, DB.meta, DB.workflow, DB.checkout_states]);
const precisionKeys = [...policyKeys].filter(k => /(^|_)(precision|bands?|price_range|estimate_range|bounded|conditional_quote)(_|$)/i.test(k));
check('KNOWN GAP (pinned, #234): the catalog authors no precision policy -- no key naming a precision band, a price range, a bounded or a conditional quote (found: ' + (precisionKeys.join(', ') || 'none') + ')', precisionKeys.length === 0, precisionKeys.join(', '));

console.log('\n2. The production panel path, every service, quantities ' + QTYS.join(', ') + ', no customer evidence');
const rows = []; let errors = 0, forks = 0;
for (const s of DB.services) for (const q of QTYS) {
  const st = { qty: q, intent: { key: s.id, category: s.ui_taxonomy.category_id, label: 'x', qtyLabel: 'item' }, stype: 'Repair', answers: {}, detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: [] };
  try {
    const m = sb.buildQuotePanelModel(st, DB);
    if (m.mode !== 'quote') { forks++; continue; }
    rows.push({ id: s.id, q, state: m.q.checkoutStateKey, bar: !!m.q.meetsConfidenceBar, timePriced: !!m.q.timePriced, form: formOf(m.q.priceDisplay), shown: m.q.priceDisplay });
  } catch (e) { errors++; }
}
check('the sweep ran through the production panel path for all ' + DB.services.length + ' services x ' + QTYS.length + ' quantities with no error and no fork panel', rows.length === DB.services.length * QTYS.length && errors === 0 && forks === 0, 'rows ' + rows.length + ', errors ' + errors + ', forks ' + forks);
check('every presented price is one of the two forms (no range, no condition anywhere in the sweep)', rows.every(r => r.form === 'exact' || r.form === 'from'), [...new Set(rows.filter(r => r.form === 'other').map(r => r.shown))].join(', '));
const tally = {}; for (const r of rows) { const k = r.state + ' | bar ' + (r.bar ? 'met' : 'unmet') + ' | ' + r.form; tally[k] = (tally[k] || 0) + 1; }
console.log('     (' + Object.entries(tally).sort().map(([k, v]) => k + ': ' + v).join('; ') + ')');

// T182: the form follows the evidence for every quote the time model prices; for the rest it is still a function of the checkout state alone
const timed = rows.filter(r => r.timePriced && (r.state === 'standard_flat_rate'));
check('diagnostic and project_based present "From $" at every point (' + rows.filter(r => r.state === 'diagnostic' || r.state === 'project_based').length + ' points), whatever the confidence', rows.filter(r => r.state === 'diagnostic' || r.state === 'project_based').every(r => r.form === 'from') && rows.some(r => r.state === 'diagnostic') && rows.some(r => r.state === 'project_based'));
check('a flat quote the time model prices presents "From $" below the confidence bar (' + timed.filter(r => !r.bar).length + ' points) and the exact amount once the bar is met (' + timed.filter(r => r.bar).length + ' points): the form follows the evidence (#234, T182)',
  timed.filter(r => !r.bar).length > 0 && timed.filter(r => r.bar).length > 0 && timed.filter(r => !r.bar).every(r => r.form === 'from') && timed.filter(r => r.bar).every(r => r.form === 'exact'), JSON.stringify(timed.filter(r => (r.form === 'from') === r.bar).slice(0, 3)));
check('every flat-rate service the time model prices is in that group (a time-priced quote is never presented as an exact amount below the bar)', unsupported(rows.filter(r => r.timePriced)).length === 0);

const PIN = { points: 152, exactBelowBar: 26 };
const bad = unsupported(rows);
check('KNOWN VIOLATION (pinned, #234): an exact amount is presented below the confidence bar at ' + PIN.exactBelowBar + ' of ' + PIN.points + ' no-evidence points (measured: ' + bad.length + ' of ' + rows.length + '); it was 132 before the time model, and none of the 26 is a quote the time model prices', rows.length === PIN.points && bad.length === PIN.exactBelowBar && bad.every(r => !r.timePriced), bad.length + ' of ' + rows.length);
const svcs = [...new Set(bad.map(r => r.id))];
console.log('     (services affected at either quantity: ' + svcs.length + ' of ' + DB.services.length + ': ' + svcs.join(', ') + ')');

console.log('\n3. Non-vacuity: the detector counts exactly the violations it is given');
{
  const syn = [
    { id: 'a', form: 'exact', bar: false },     // violation
    { id: 'b', form: 'from', bar: false },       // a lower bound at an unmet bar is the honest form
    { id: 'c', form: 'exact', bar: true },       // an exact amount with the evidence to support it
    { id: 'd', form: 'exact', bar: false },     // violation
    { id: 'e', form: 'from', bar: true },
  ];
  const got = unsupported(syn).map(r => r.id).join('');
  check('on five synthetic points the detector finds exactly the two exact amounts at an unmet bar (a, d)', got === 'ad', got);
  check('on the sweep with every unmet-bar exact amount turned into a lower bound it finds none (the form the test takes when #234 is implemented)', unsupported(rows.map(r => r.form === 'exact' && !r.bar ? { ...r, form: 'from' } : r)).length === 0);
  check('and the sweep it was run on holds both bar statuses and both forms (the detector was not handed a one-sided catalog)', rows.some(r => r.bar) && rows.some(r => !r.bar) && rows.some(r => r.form === 'exact') && rows.some(r => r.form === 'from'));
}

console.log('\n[Price precision: the time model closes 106 of the 132 (#234); 26 pinned] ' + passed + ' passed, ' + failed + ' failed (of ' + (passed + failed) + ' checks)');
process.exit(failed ? 1 : 0);
