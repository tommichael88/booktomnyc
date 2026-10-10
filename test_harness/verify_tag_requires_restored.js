#!/usr/bin/env node
/**
 * verify_tag_requires_restored.js
 *
 * smart_tags[tid].requires is authored SSOT data (#very_heavy requires #two_person_required; #virus requires #tech_device_computer).
 * The retired legacy curated-intake builder enforced it, on the tag-chip path only. After that builder was removed NOTHING did --
 * verify_ssot_consultation.js reported the field consulted by no live code.
 *
 * WHAT THIS MEASURES, AND BY WHAT MECHANISM (R-GOVERN-GOODHART). The claim is behavioral -- "a requirement is honoured, the same way, on
 * every entry path, and the customer's own words beat it" -- so it is asserted at the public boundaries, never by naming a helper:
 *   * the state path         computeQuoteFromState(state)  -> the tags in force, and the price
 *   * the orchestrator path  executeWorkflow(context, DB)  -> the price
 *   * the tag-chip tap       toggleTagState(...)           -> what a customer's select / deselect leaves behind
 * Expectations come from the SSOT itself, not from the code under test. "Priced" is checked by EQUIVALENCE (deriving a requirement prices
 * exactly what selecting both tags explicitly prices), so no particular internal algorithm is required, and a NON-VACUITY check demands
 * that at least one requirement is really worth something in the price (an equivalence between two zeros measures nothing).
 * R-INVARIANT-NOPATCH: the same behavior must hold across the gateways -- the agreement between the two paths is asserted, not assumed.
 * NOT ASSERTED HERE, deliberately: that the two paths agree on the PRICE of a tag. They do not today, and did not in the original file: the
 * state path synthesizes a tag's authored answers (so #very_heavy adds its fee) and the orchestrator route never does (the same tag adds $0).
 * That is a separate, pre-existing convergence defect (R-CLIENT-CONVERGE), tracked in the ledger; a test asserting agreement would be red
 * for a reason unrelated to `requires`, and a red test is fixed or retired in session (R-INVARIANT-REDTEST). What this test pins is that
 * deriving a requirement behaves EXACTLY like choosing the required tag explicitly on the same path, and that the tags in force agree.
 * Pure Logic: a Node VM over the extracted engine modules, no browser.
 */
'use strict';
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const { check, finish } = require('./_shared.js');
const ROOT = path.resolve(__dirname, '..');
const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
const sb = { DB, SERVICE_DATA: DB, window: { DB }, console }; sb.global = sb; vm.createContext(sb);
for (const f of ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });

const refId = r => typeof r === 'string' ? r : '#' + String(r.$ref).split('/').pop().replace(/^#/, '');
const withReq = Object.entries(DB.smart_tags).filter(([k, v]) => v && v.requires && v.requires.length)
    .map(([k, v]) => ({ tid: k, need: v.requires.map(refId) }));
check('the SSOT really carries non-empty `requires` entries to honour (otherwise this test is vacuous)', withReq.length >= 2, { expected: '>= 2', got: withReq.length });
check('every required tag the SSOT names exists in the catalog (no dangling reference)', withReq.every(w => w.need.every(n => DB.smart_tags[n])), { got: withReq });

const catOf = x => x.ui_taxonomy.category_id;
const mkState = (x, over) => Object.assign({ qty: 1, intent: { key: x.id, category: catOf(x), label: x.ui_taxonomy.display_name, qtyLabel: 'item' }, stype: 'Repair',
    answers: {}, detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: [], userTagIds: [], _svc: x, _tagsAffirmed: false }, over || {});
const stateQuote = (x, over) => sb.computeQuoteFromState(mkState(x, over));
const orchRoute = (x, man, det, neg) => {
    const ctx = sb.collectBookingContext_catalog(x, catOf(x));
    ctx.manuallyToggledTagIds = man || []; ctx.detectedTagIds = det || []; ctx.negatedTagIds = neg || [];
    return sb.executeWorkflow(ctx, DB);
};
const sameSet = (a, b) => JSON.stringify([...new Set(a)].sort()) === JSON.stringify([...new Set(b)].sort());
const candidates = DB.services.filter(x => x.financial_engine && x.financial_engine.base_price > 0 && x.ui_taxonomy && x.ui_taxonomy.category_id);

// ---- the real SSOT pairs: what is in force, and which question the requirement retires ----
for (const { tid, need } of withReq) {
    const svc = candidates[0];
    const man = stateQuote(svc, { manTagIds: [tid] });
    check(`state path: choosing ${tid} puts what it requires (${need.join(', ')}) in force`, need.every(n => man.activeTagIds.includes(n) && man.allTagIds.includes(n)), { got: { active: man.activeTagIds, all: man.allTagIds } });
    const manNeg = stateQuote(svc, { manTagIds: [tid], negatedTagIds: need });
    check(`state path: the customer's explicit negation of ${need[0]} beats the requirement (in force: no; ${tid} itself: still yes)`, !manNeg.activeTagIds.includes(need[0]) && !manNeg.allTagIds.includes(need[0]) && manNeg.activeTagIds.includes(tid), { got: manNeg.activeTagIds });
    const r = orchRoute(svc, [tid], [], []), rBoth = orchRoute(svc, [tid, ...need], [], []), rNeg = orchRoute(svc, [tid], [], need);
    check(`orchestrator path: choosing ${tid} puts what it requires in force on the route (route.activeTags)`, need.every(n => r.activeTags.includes(n)), { got: r.activeTags });
    check(`orchestrator path: deriving the requirement puts EXACTLY the tags in force that choosing both explicitly does (${tid})`, sameSet(r.activeTags, rBoth.activeTags), { got: [r.activeTags, rBoth.activeTags] });
    check(`orchestrator path: the customer's explicit negation beats the requirement (in force: no; ${tid} itself: still yes)`, !need.some(n => rNeg.activeTags.includes(n)) && rNeg.activeTags.includes(tid), { got: rNeg.activeTags });
    check(`R-INVARIANT-NOPATCH: both gateways put the same tags in force for ${tid} (state path vs route)`, sameSet(man.activeTagIds, r.activeTags), { got: { state: man.activeTagIds, route: r.activeTags } });
}
{   // a requirement that sets an answer retires that question -- the effect of #virus -> #tech_device_computer
    const modKey = Object.keys(DB.smart_tags['#tech_device_computer'].answers || {})[0], want = (DB.smart_tags['#tech_device_computer'].answers || {})[modKey];
    const st = mkState(candidates[0], { manTagIds: ['#virus'] }); sb.computeQuoteFromState(st);
    check(`question retired: choosing #virus answers "${modKey}" as "${want}" through the tag it requires (the customer is not asked)`, st.answers[modKey] === want, { got: st.answers });
    const stNeg = mkState(candidates[0], { manTagIds: ['#virus'], negatedTagIds: ['#tech_device_computer'] }); sb.computeQuoteFromState(stNeg);
    check('question NOT retired when the customer negated the required tag (their own words win)', stNeg.answers[modKey] === undefined, { got: stNeg.answers });
    const stOwn = mkState(candidates[0], { manTagIds: ['#virus'], answers: { [modKey]: 'a real answer the customer gave' } }); sb.computeQuoteFromState(stOwn);
    check("a real customer answer is never overwritten by a derived tag's synthesized one", stOwn.answers[modKey] === 'a real answer the customer gave', { got: stOwn.answers });
}

// ---- PRICE equivalence needs a requirement that is worth something; the authored ones are worth nothing today, so a synthetic priced pair is used ----
// (#t_price_b borrows #virus's authored answer, which is priced; #t_price_a requires it.)
DB.smart_tags['#t_price_b'] = { answers: { tech_problem_type: 'Virus or pop-ups' }, requires: [] };
DB.smart_tags['#t_price_a'] = { requires: [{ $ref: '#t_price_b' }] };
{
    const svc = candidates[0];
    const sDerived = stateQuote(svc, { manTagIds: ['#t_price_a'] }).laborCalc, sBoth = stateQuote(svc, { manTagIds: ['#t_price_a', '#t_price_b'] }).laborCalc, sNeg = stateQuote(svc, { manTagIds: ['#t_price_a'], negatedTagIds: ['#t_price_b'] }).laborCalc;
    check(`non-vacuity: the required tag is really worth something in the price (state path: ${sDerived} with it derived vs ${sNeg} with it negated)`, sDerived > sNeg, { got: { sDerived, sNeg } });
    check('state path: deriving the requirement prices EXACTLY what choosing both explicitly prices', sDerived === sBoth, { got: [sDerived, sBoth] });
    check("state path: the customer's explicit negation removes the requirement's price", sNeg < sDerived, { got: { sNeg, sDerived } });
    const r = orchRoute(svc, ['#t_price_a'], [], []), rBoth = orchRoute(svc, ['#t_price_a', '#t_price_b'], [], []);
    check('orchestrator path: the priced requirement is in force on the route exactly as if chosen explicitly', r.activeTags.includes('#t_price_b') && sameSet(r.activeTags, rBoth.activeTags), { got: [r.activeTags, rBoth.activeTags] });
}

// provenance: a requirement derived from a DETECTED, unaffirmed tag is itself unaffirmed (in force, not chargeable), exactly like its source
{
    const { tid, need } = withReq[0];
    let found = null;
    for (const s of DB.services.filter(x => x.financial_engine && x.ui_taxonomy && x.ui_taxonomy.category_id)) {
        const q = sb.computeQuoteFromState({ qty: 1, intent: { key: s.id, category: s.ui_taxonomy.category_id, label: s.ui_taxonomy.display_name, qtyLabel: 'item' }, stype: 'Repair', answers: {}, detTagIds: [tid], manTagIds: [], negatedTagIds: [], inherentTagIds: [], userTagIds: [], _svc: s, _tagsAffirmed: false });
        if (!q.detTagsChargeable) { found = q; break; }
    }
    check('provenance: found a state where a detected tag is NOT yet chargeable (otherwise the next check would be vacuous)', !!found);
    if (found) check(`provenance: a requirement derived from the detected, unaffirmed ${tid} is in force (allTagIds) but not chargeable (activeTagIds), like its source`,
        need.every(n => found.allTagIds.includes(n) && !found.activeTagIds.includes(n)) && !found.activeTagIds.includes(tid), { got: { all: found.allTagIds, active: found.activeTagIds } });
}

// transitive, ordered, cycle-safe (synthetic tags added to the sandbox catalog)
DB.smart_tags['#t_a'] = { requires: [{ $ref: '#t_b' }] }; DB.smart_tags['#t_b'] = { requires: [{ $ref: '#t_c' }] }; DB.smart_tags['#t_c'] = { requires: [] };
DB.smart_tags['#t_x'] = { requires: [{ $ref: '#t_y' }] }; DB.smart_tags['#t_y'] = { requires: [{ $ref: '#t_x' }] };
{
    const q = stateQuote(candidates[0], { manTagIds: ['#t_a'] });
    check('transitive: a requires b requires c -> all three in force, the chosen tag first', JSON.stringify(q.allTagIds) === JSON.stringify(['#t_a', '#t_b', '#t_c']), { got: q.allTagIds });
    const cyc = stateQuote(candidates[0], { manTagIds: ['#t_x'] });
    check('cycle-safe: x requires y requires x terminates with both in force exactly once', JSON.stringify([...cyc.allTagIds].sort()) === JSON.stringify(['#t_x', '#t_y']), { got: cyc.allTagIds });
    const none = stateQuote(candidates[0], { manTagIds: ['#brick_wall', '#fragile_item'] });
    check('no requirement in play: the tag set is exactly what was given, in order (behaviour unchanged for every other tag)', JSON.stringify(none.allTagIds) === JSON.stringify(['#brick_wall', '#fragile_item']), { got: none.allTagIds });
}

// the tag-chip tap
const tog = (state, tid, was) => { sb.toggleTagState(state, tid, !!was, DB); return state; };
const base = () => ({ manTagIds: [], detTagIds: [], negatedTagIds: [], userTagIds: [] });
{
    const { tid, need } = withReq[0];
    let s = tog(base(), tid, false);
    check(`chip: selecting ${tid} also shows what it requires as selected (the chip display follows the rule)`, s.manTagIds.includes(tid) && need.every(n => s.manTagIds.includes(n) && s.userTagIds.includes(n)), { got: s });
    s = tog(s, need[0], true);
    check(`chip: deselecting ${need[0]} while ${tid} still requires it records an explicit negation (it cannot go neutral)`, !s.manTagIds.includes(need[0]) && s.negatedTagIds.includes(need[0]), { got: s });
    check('chip: …and that negation then beats the requirement at pricing time', !stateQuote(candidates[0], { manTagIds: s.manTagIds, negatedTagIds: s.negatedTagIds }).activeTagIds.includes(need[0]));
    s = tog(s, need[0], false);
    check(`chip: re-selecting ${need[0]} clears its negation`, s.manTagIds.includes(need[0]) && !s.negatedTagIds.includes(need[0]), { got: s });
    let t = tog(base(), '#brick_wall', false); t = tog(t, '#brick_wall', true);
    check('chip: deselecting a tag nothing requires stays neutral (no negation recorded)', t.negatedTagIds.length === 0 && t.manTagIds.length === 0, { got: t });
    let u = tog(base(), tid, false); u = tog(u, tid, true);
    check("chip: deselecting the REQUIRING tag leaves what it pulled in as the customer's own selection (legacy behaviour kept)", need.every(n => u.manTagIds.includes(n)) && !u.manTagIds.includes(tid), { got: u });
}
{
    const mx = Object.entries(DB.smart_tags).find(([k, v]) => v && v.mutually_exclusive && v.mutually_exclusive.length && !k.startsWith('#t_'));
    if (mx) {
        const [tid, v] = mx; const sib = refId(v.mutually_exclusive[0]);
        const s = tog({ manTagIds: [sib], detTagIds: [], negatedTagIds: [sib], userTagIds: [sib] }, tid, false);
        check(`chip: mutual exclusion still holds (selecting ${tid} removes ${sib} everywhere and clears its negation)`, !s.manTagIds.includes(sib) && !s.negatedTagIds.includes(sib) && !s.userTagIds.includes(sib) && s.manTagIds.includes(tid), { got: s });
    }
    const s2 = tog({ manTagIds: [], detTagIds: [], negatedTagIds: ['#very_heavy'], userTagIds: [] }, '#very_heavy', false);
    check('chip: selecting a tag clears its own negation (the customer is overriding the NLP)', !s2.negatedTagIds.includes('#very_heavy'), { got: s2 });
}
finish('tag requires honoured on every path (Logic)');
