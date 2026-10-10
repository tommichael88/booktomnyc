#!/usr/bin/env node
/**
 * @enforces R-CLIENT-CONVERGE
 * verify_tag_synthesis_convergence.js
 *
 * R-CLIENT-CONVERGE: "different entry paths must ultimately resolve to the same underlying ... pricing logic." A smart tag whose authored `answers` map names a
 * module and a label (operator brief section 2.8) synthesizes that answer, so the customer is not asked and the answer's own modifier prices. Before T146 only the
 * state path did this: `#very_heavy` was +$110 on the state path and +$0 on the orchestrator route, on 66 of 68 services (PENDING_DECISIONS #82), so a route's
 * price line (the tag-affirmation card, say) could differ from the panel's final price.
 *
 * MEASURED BY WHAT THE RULE CLAIMS (R-GOVERN-GOODHART): a behavioural claim about two entry paths, so it is asserted at their two public boundaries --
 *   the state path        computeQuoteFromState(state)       -> the price and the answers in force
 *   the orchestrator      executeWorkflow(context, DB)       -> the route's quote and answers
 * for EVERY tag with authored answers on EVERY service, comparing what a tag is WORTH (price with it minus price without) on each path. No helper is named.
 * A non-vacuity check demands that a good share of those pairs are worth something. Scope, stated: customer evidence only (tags the customer chose or the NLP
 * detected). Inherent service-default tags are the operator's v9.6 "service facts" on the state path and are not yet applied on the card path -- #93.
 * Pure Logic: a Node VM over the extracted engine modules, no browser.
 */
'use strict';
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const { check, finish } = require('./_shared.js');
const ROOT = path.resolve(__dirname, '..');
const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
const sb = { DB, SERVICE_DATA: DB, window: { DB }, console }; sb.global = sb; vm.createContext(sb);
for (const f of ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });

const catOf = x => x.ui_taxonomy.category_id;
const services = DB.services.filter(x => x.financial_engine && x.financial_engine.base_price > 0 && x.ui_taxonomy && x.ui_taxonomy.category_id);
const answerTags = Object.entries(DB.smart_tags).filter(([k, v]) => v && v.answers && Object.keys(v.answers).some(m => DB.intake_modules[m])).map(([k]) => k);
check('the SSOT carries tags with authored answers to converge on (otherwise this test is vacuous)', answerTags.length >= 10, { expected: '>= 10', got: answerTags.length });

const mkState = (x, over) => Object.assign({ qty: 1, intent: { key: x.id, category: catOf(x), label: x.ui_taxonomy.display_name, qtyLabel: 'item' }, stype: 'Repair',
    answers: {}, detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: [], userTagIds: [], _svc: x, _tagsAffirmed: false }, over || {});
const state = (x, over) => { const st = mkState(x, over); const q = sb.computeQuoteFromState(st); return { price: q.laborCalc, answers: st.answers }; };
const orch = (x, o) => {
    const c = sb.collectBookingContext_catalog(x, catOf(x));
    c.manuallyToggledTagIds = (o && o.man) || []; c.detectedTagIds = (o && o.det) || []; c.negatedTagIds = (o && o.neg) || []; if (o && o.answers) c.answers = Object.assign({}, o.answers);
    // A request that carries an NLP keyword is a free-text request: it says so (the way collectBookingContext_freeText does), since the orchestrator now reads the entry a context declares (T159, R-CONF-ONEFORMULA)
    // instead of guessing it from the keyword -- a context that claimed 'catalog' AND carried a keyword was one no real entry produces.
    if (o && o.nlp) { c.nlpIntent = { key: o.nlp }; c.entry = 'free_text'; } if (o && o.affirmed) c.tagsAffirmed = true;
    const r = sb.executeWorkflow(c, DB); return { price: r.quote.laborEstimate, answers: r.answers };
};

// A DETECTED tag arrives with free text, so BOTH paths carry the same NLP keyword. (Without one the paths describe the intent differently -- the state path passes
// the service id as a weak keyword, the orchestrator's catalog context passes none and counts as fully confident -- which has nothing to do with tags.)
const KW = 'probe_keyword';
const detIntent = x => ({ key: KW, category: catOf(x), label: x.ui_taxonomy.display_name, qtyLabel: 'item' });

// ---- every tag with authored answers x every service: worth the same on both paths, for a customer-chosen tag and for a detected one ----
let errors = [], pairs = 0, worth = 0, tagsWorth = new Set(), badMan = [], badDet = [], badAff = [], badAnswers = [], gated = 0;
for (const x of services) {
    let sBase, oBase;
    try { sBase = state(x).price; oBase = orch(x).price; } catch (e) { errors.push(`${x.id}: ${e.message}`); continue; }
    for (const t of answerTags) {
        try {
            const sMan = state(x, { manTagIds: [t] }), oMan = orch(x, { man: [t] });
            const sDet = state(x, { detTagIds: [t], intent: detIntent(x) }), oDet = orch(x, { det: [t], nlp: KW });
            const sAff = state(x, { detTagIds: [t], intent: detIntent(x), _tagsAffirmed: true }), oAff = orch(x, { det: [t], nlp: KW, affirmed: true });
            pairs++;
            if (sMan.price - sBase !== oMan.price - oBase) badMan.push(`${x.id}/${t}: state +${sMan.price - sBase}, orchestrator +${oMan.price - oBase}`);
            if (sDet.price - sBase !== oDet.price - oBase) badDet.push(`${x.id}/${t}: state +${sDet.price - sBase}, orchestrator +${oDet.price - oBase}`);
            if (sAff.price - sBase !== oAff.price - oBase) badAff.push(`${x.id}/${t}: state +${sAff.price - sBase}, orchestrator +${oAff.price - oBase}`);
            if (sDet.price !== sAff.price) gated++;
            if (sMan.price !== sBase) { worth++; tagsWorth.add(t); }
            // the answers the tag synthesizes are the same on both paths (compared on the modules the tag names)
            for (const m of Object.keys(DB.smart_tags[t].answers).filter(k => DB.intake_modules[k])) if (sMan.answers[m] !== oMan.answers[m]) { badAnswers.push(`${x.id}/${t}/${m}: state ${JSON.stringify(sMan.answers[m])}, orchestrator ${JSON.stringify(oMan.answers[m])}`); break; }
        } catch (e) { errors.push(`${x.id}/${t}: ${e.message}`); }
    }
}
check(`every (service, tag) pair ran on both paths without throwing (${pairs} pairs over ${services.length} services x ${answerTags.length} tags)`, errors.length === 0 && pairs > 1000, { expected: '0 errors, > 1000 pairs', got: { pairs, errors: errors.slice(0, 3) } });
check(`non-vacuity: a good share of the pairs really price (${worth} pairs across ${tagsWorth.size} tags move the price)`, worth >= 200 && tagsWorth.size >= 5, { expected: '>= 200 pairs, >= 5 tags', got: { worth, tags: tagsWorth.size } });
check('a customer-CHOSEN tag is worth exactly the same on the state path and on the orchestrator route, for every service and every tag', badMan.length === 0, { expected: 0, got: { n: badMan.length, first: badMan.slice(0, 4) } });
check(`a DETECTED, not-yet-affirmed tag is worth exactly the same on both paths -- the chargeability gate is applied identically (${gated} pairs where the gate really changes the price)`, badDet.length === 0 && gated >= 1, { expected: 0, got: { n: badDet.length, first: badDet.slice(0, 4) } });
check('an AFFIRMED detected tag is worth exactly the same on both paths, for every service and every tag', badAff.length === 0, { expected: 0, got: { n: badAff.length, first: badAff.slice(0, 4) } });
check('the answers a tag synthesizes are the same on both paths', badAnswers.length === 0, { expected: 0, got: { n: badAnswers.length, first: badAnswers.slice(0, 3) } });

// ---- the rules, on both paths (a tag whose answer is priced, on a service that has the module) ----
const pick = (() => { for (const t of answerTags) for (const x of services) { const m = Object.keys(DB.smart_tags[t].answers).find(k => DB.intake_modules[k] && (DB.intake_modules[k].client_response || []).length > 1); if (!m) continue; try { if (state(x, { manTagIds: [t] }).price !== state(x).price) return { x, t, m, label: DB.smart_tags[t].answers[m] }; } catch (e) { /* next */ } } return null; })();
check('a tag whose synthesized answer moves the price was found to exercise the rules below', !!pick);
if (pick) {
    const { x, t, m, label } = pick;
    const other = DB.intake_modules[m].client_response.map(r => r.label).find(l => l !== label);
    const sExp = state(x, { manTagIds: [t], answers: { [m]: other } }), oExp = orch(x, { man: [t], answers: { [m]: other } });
    check(`an explicit customer answer is NEVER overwritten by a tag, on either path (${m}: "${other}" beats the tag's "${label}")`, sExp.answers[m] === other && oExp.answers[m] === other && sExp.price === state(x, { answers: { [m]: other } }).price && oExp.price === orch(x, { answers: { [m]: other } }).price, { got: { state: sExp.answers[m], orchestrator: oExp.answers[m] } });
    const sNeg = state(x, { manTagIds: [t], negatedTagIds: [t] }), oNeg = orch(x, { man: [t], neg: [t] });
    check('a negated tag synthesizes nothing on either path, and the price returns to the base', sNeg.answers[m] === undefined && oNeg.answers[m] === undefined && sNeg.price === state(x).price && oNeg.price === orch(x).price, { got: { state: sNeg.answers[m], orchestrator: oNeg.answers[m] } });
    const sOn = state(x, { manTagIds: [t] }), oOn = orch(x, { man: [t] });
    check('removing the tag reverses the synthesis on both paths: the question is unanswered again', sOn.answers[m] === label && oOn.answers[m] === label && state(x).answers[m] === undefined && orch(x).answers[m] === undefined, { got: { stateWith: sOn.answers[m], orchWith: oOn.answers[m] } });
    // The SAME session, re-synced after the customer taps the tag off (how the app really works: one session object lives on). The reversal must happen
    // IN PLACE -- other code holds these two objects -- and must also work when the tag is negated rather than removed.
    {
        const st = mkState(x, { manTagIds: [t] }); sb.computeQuoteFromState(st);
        const ansRef = st.answers, synRef = st._tagSynthesizedModules, had = st.answers[m] === label;
        st.manTagIds = []; const afterRemove = sb.computeQuoteFromState(st);
        check('on the SAME session, removing the tag reverses its synthesis -- the question is asked again, the price returns to the base -- and the session objects keep their identity',
            had && st.answers[m] === undefined && afterRemove.laborCalc === state(x).price && st.answers === ansRef && st._tagSynthesizedModules === synRef && !(m in synRef), { got: { had, after: st.answers[m], sameObjects: st.answers === ansRef } });
        const st2 = mkState(x, { manTagIds: [t] }); sb.computeQuoteFromState(st2);
        st2.negatedTagIds = [t]; sb.computeQuoteFromState(st2);
        check('on the SAME session, NEGATING the tag reverses its synthesis too', st2.answers[m] === undefined, { got: st2.answers[m] });
        const st3 = mkState(x, { manTagIds: [t] }); sb.computeQuoteFromState(st3); st3.answers[m] = other; // the customer overrides the synthesized answer
        st3.manTagIds = []; sb.computeQuoteFromState(st3);
        check('on the SAME session, a customer who overrode the synthesized answer keeps it after the tag is removed', st3.answers[m] === other, { got: st3.answers[m] });
    }
    // two tags that disagree on a module leave it to be asked (synthetic tags added to the sandbox catalog)
    DB.smart_tags['#t_one'] = { answers: { [m]: label } }; DB.smart_tags['#t_two'] = { answers: { [m]: other } };
    check('two active tags that disagree on a module synthesize neither, on both paths', state(x, { manTagIds: ['#t_one', '#t_two'] }).answers[m] === undefined && orch(x, { man: ['#t_one', '#t_two'] }).answers[m] === undefined);
    // a tag derived through the SSOT `requires` relation synthesizes too (ties to PENDING_DECISIONS #78)
    DB.smart_tags['#t_req'] = { requires: [{ $ref: '#t_one' }] };
    check('a tag implied through `requires` synthesizes its answer on both paths', state(x, { manTagIds: ['#t_req'] }).answers[m] === label && orch(x, { man: ['#t_req'] }).answers[m] === label);
}
finish('tag-to-answer synthesis converges across entry paths (Logic)');
