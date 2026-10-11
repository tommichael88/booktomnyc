#!/usr/bin/env node
/**
 * verify_tag_arbitration_gateways.js -- two tags the SSOT says cannot both be true are never both handed to the engine, by ANY way in, and the one the customer's words picked is the more specific.
 *
 * @enforces R-CLIENT-CONVERGE
 * @enforces R-INVARIANT-CANONICAL
 * @detects DEFECT-ARBITRATION
 *
 * THE CLASS (DEFECT-ARBITRATION; Charter Part X, "Battle 7": "a mutual-exclusion mechanism for conflicting tags existed, correctly written. It was wired exclusively into a separate, legacy builder flow,
 * never the main curated-card path every real service actually uses. The fix was a single call in the right place, not new logic."). It had come back, in two halves, measured at T169 (PENDING_DECISIONS #166/#178)
 * on the real engine with tools/measure_tag_rules_gateways.js:
 *   1. the rules (smart_tags[].mutually_exclusive, the default tag of a display group) were still applied by ONE gateway, the guided builder. A sentence that names two exclusive facts reached the
 *      engine with both tags on the free-text route: 13 distinct situations were priced differently from the builder's answer for the same facts (a customer who types "very high ceiling" was charged for a
 *      high ceiling AND a very high ceiling, and the two conflicting answers cancelled: the ladder surcharge vanished and the job quoted its base fee);
 *   2. where the rules DID run, the tag kept was the first one in catalog order, not the one the customer said: "very high ceiling" contains the words "high ceiling", both tags were found, and the
 *      builder kept #high_ceiling (the Cross-Entry Specificity Rule, Charter Part IV: when one entry's phrase sits inside another's longer phrase and the longer one is in the text, the more specific wins).
 *
 * MEASURED BY WHAT THE RULE CLAIMS (P-GOVERN-GOODHART): the real engine, driven at its public boundaries, over every exclusive pair the SSOT declares (not a hand-picked sentence):
 *   1. SPECIFIC WINS         For each exclusive pair whose one phrase sits whole-word inside the other's phrase, the longer phrase alone, and inside an ordinary sentence, finds the longer tag and NOT the shorter.
 *   2. NO PAIR GETS IN       For each exclusive pair, a sentence that names both (inside a service both are valid for) reaches collectBookingContext_freeText holding at most one of them, and the guided builder's
 *                            sequence (resolveBuilderTags -> resolveTagRules) holds at most one. Non-vacuity: the detector really does find both before any rule runs, on most pairs.
 *   3. THE PRICE FOLLOWS     "very high ceiling fan install" quotes the very-high price, "high ceiling fan install" the high price, on the free-text route, and each equals the quote when the customer ANSWERS that height
 *      THE WORDS             (read from the tag's own `answers`, not typed here).
 *   4. THE TWO GATEWAYS      Ordinary sentences, end to end: the free-text route and the guided builder's sequence, on the entity the words resolve to, charge the same labor and minutes.
 *      AGREE                A service's OWN default tags (its `default_tags`) are left out of both sides: the free-text route does not apply them yet (PENDING_DECISIONS #93), which is a separate,
 *                           open question from the rules this file is about (a sentence whose service is itself tagged with one of the pair, such as a running-toilet fix, would otherwise measure #93).
 *
 * RUN ON ANOTHER TREE (G-INVARIANT-PREFIX): copy this file into that tree's test_harness/ and run it there -- it reads that tree's btnyc.json, qr.html and modules.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { check, finish } = require('./_shared.js');
const { engine } = require('./_engine.js');
const ROOT = path.resolve(__dirname, '..');
const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
const sb = { DB, SERVICE_DATA: DB, window: { DB }, console: { log() {}, warn() {}, error() {}, info() {}, debug() {} } }; sb.global = sb; vm.createContext(sb);
vm.runInContext(engine().wrapper, sb, { filename: 'engine_modules' });
sb.initNlpSets(); if (typeof sb.refreshNlpPreviewBindings === 'function') sb.refreshNlpPreviewBindings();

const T = DB.smart_tags, refOf = r => (r && typeof r === 'object' && r.$ref) ? r.$ref : r;
const phrases = id => (T[id].synonyms && T[id].synonyms.length) ? T[id].synonyms.filter(s => typeof s === 'string') : [id.replace('#', '').replace(/_/g, ' ')];
const exclusive = (a, b) => (T[a].mutually_exclusive || []).map(refOf).includes(b) || (T[b].mutually_exclusive || []).map(refOf).includes(a);
const PAIRS = []; const seen = new Set();
for (const [a, t] of Object.entries(T)) for (const b of (t.mutually_exclusive || []).map(refOf)) { const k = [a, b].sort().join('|'); if (!seen.has(k) && T[b]) { seen.add(k); PAIRS.push([a, b].sort()); } }
const holdsPair = ids => { const bad = []; for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (exclusive(ids[i], ids[j])) bad.push(ids[i] + ' + ' + ids[j]); return bad; };
const inside = (small, big) => small !== big && new RegExp('(^|\\s)' + small.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s|$)').test(big.toLowerCase());

// ---- 1. the more specific phrase wins -------------------------------------------------------------------------------------------------------------------------------
const containment = [];
for (const [a, b] of PAIRS) for (const [s, l] of [[a, b], [b, a]]) for (const ps of phrases(s)) for (const pl of phrases(l)) if (inside(ps, pl)) containment.push({ shorter: s, longer: l, short: ps, long: pl });
check(`non-vacuity: the SSOT has at least one exclusive pair whose phrases nest (${containment.length}: ${[...new Set(containment.map(c => c.shorter + ' in ' + c.longer))].join(', ')})`, containment.length >= 1, { expected: '>= 1', got: containment.length });
const wrongWinner = [];
for (const c of containment) for (const frame of [x => x, x => `replace a light fixture on a ${x}`, x => `${x} and I need it fixed`]) {
    const found = sb.detectTagsNLP(frame(c.long)).found;
    if (!found.includes(c.longer) || found.includes(c.shorter)) wrongWinner.push(`"${frame(c.long)}" -> ${JSON.stringify(found)} (wanted ${c.longer}, not ${c.shorter})`);
}
check(`the longer phrase wins: where one exclusive tag's phrase sits inside the other's, the text that holds the longer one finds only the longer tag (${containment.length * 3} sentences)`, wrongWinner.length === 0, { expected: 0, got: wrongWinner.slice(0, 4) });

// ---- 2. no exclusive pair reaches the engine by any way in -----------------------------------------------------------------------------------------------------------
const tagValid = (t, c, g) => { try { return sb.tagValidForCategory(t, c, g); } catch (e) { return false; } };
let bothRaw = 0, pairsTried = 0; const freeBad = [], builderBad = [], skipped = [];
for (const [a, b] of PAIRS) {
    const svc = DB.services.find(s => tagValid(a, s.ui_taxonomy.category_id, s.ui_taxonomy.group_id) && tagValid(b, s.ui_taxonomy.category_id, s.ui_taxonomy.group_id));
    if (!svc) { skipped.push(a + '|' + b); continue; }
    const cat = svc.ui_taxonomy.category_id, grp = svc.ui_taxonomy.group_id;
    // the pair's two phrases that do NOT nest (a nesting pair is section 1's), joined by "and"; both orders
    const pa = phrases(a)[0], pb = phrases(b)[0];
    for (const text of [`${svc.ui_taxonomy.display_name} ${pa} and ${pb}`, `${svc.ui_taxonomy.display_name} ${pb} and ${pa}`]) {
        pairsTried++;
        const raw = sb.detectTagsNLP(text).found.filter(t => tagValid(t, cat, grp));
        if (raw.includes(a) && raw.includes(b)) bothRaw++;
        const ctx = sb.collectBookingContext_freeText(text);
        const held = [...(ctx.detectedTagIds || []), ...(ctx.manuallyToggledTagIds || [])];
        const bad = holdsPair(held); if (bad.length) freeBad.push(`"${text}" -> free-text context holds ${bad.join(', ')}`);
        const bt = sb.resolveBuilderTags({ desc: text, category: cat, groupId: grp, sizeHint: null, manTagIds: [], userTagIds: [] });
        const r = sb.resolveTagRules({ category: cat, groupId: grp, curatedMode: true, detTagIds: bt.detTagIds, manTagIds: [], userTagIds: [], negatedTagIds: bt.negatedTagIds });
        const bbad = holdsPair([...r.detTagIds, ...r.manTagIds]); if (bbad.length) builderBad.push(`"${text}" -> builder holds ${bbad.join(', ')}`);
    }
}
check(`non-vacuity: the detector itself finds BOTH tags of an exclusive pair on most sentences before any rule runs (${bothRaw} of ${pairsTried}; ${PAIRS.length} pairs, ${skipped.length} with no service valid for both)`, bothRaw >= Math.ceil(pairsTried / 2) && pairsTried >= 8, { expected: '>= half of >= 8', got: { bothRaw, pairsTried, skipped } });
check(`the guided builder's sequence never holds an exclusive pair (the mechanism that always worked)`, builderBad.length === 0, { expected: 0, got: builderBad.slice(0, 4) });
check(`the free-text gateway never holds an exclusive pair either: the rules are applied once, where the words become tags (Battle 7: a single call in the right place)`, freeBad.length === 0, { expected: 0, got: freeBad.slice(0, 4) });

// ---- 3. the price follows the words ---------------------------------------------------------------------------------------------------------------------------------
const heightOf = id => T[id].answers.mounting_height;
const labor = (text) => { const c = sb.collectBookingContext_freeText(text); const r = sb.executeWorkflow(Object.assign({}, c, { tagsAffirmed: true }), DB); return { svc: r.entity && r.entity.id, labor: r.quote && r.quote.laborEstimate, min: r.quote && r.quote.totalMin, tags: r.activeTags }; };
const answered = (svcId, label) => { const s = DB.services.find(x => x.id === svcId); const c = sb.collectBookingContext_catalog(s, s.ui_taxonomy.category_id); c.answers = { mounting_height: label }; const r = sb.executeWorkflow(c, DB); return { labor: r.quote.laborEstimate, min: r.quote.totalMin }; };
const base = answered('ceiling_fan_install', DB.intake_modules.mounting_height.client_response[0].label);
for (const [tag, text] of [['#very_high_ceiling', 'very high ceiling fan install'], ['#high_ceiling', 'high ceiling fan install']]) {
    const said = labor(text), answeredAs = answered('ceiling_fan_install', heightOf(tag));
    check(`"${text}" resolves to ceiling_fan_install and quotes the same as answering "${heightOf(tag)}" (labor ${answeredAs.labor}, ${answeredAs.min} min), not the base ${base.labor}`,
        said.svc === 'ceiling_fan_install' && said.labor === answeredAs.labor && said.min === answeredAs.min && answeredAs.labor > base.labor, { expected: answeredAs, got: said });
}

// ---- 4. the two gateways agree on ordinary sentences ----------------------------------------------------------------------------------------------------------------
const SENT = ['patch a hole in a brick wall and a plaster wall', 'virus on my laptop and I need data recovery', 'very high ceiling ceiling fan install', 'clogged drain and a leaky faucet',
    'my toilet keeps running and the kitchen faucet leaks', 'replace a ceiling fan on a high ceiling', 'ceiling fan install on a vaulted ceiling', 'hang a mirror', 'hang a heavy mirror on a brick wall and drywall'];
const disagree = []; let compared = 0;
for (const text of SENT) {
    const ctx = sb.collectBookingContext_freeText(text);
    const route = sb.executeWorkflow(Object.assign({}, ctx, { tagsAffirmed: true, manuallyToggledTagIds: (ctx.detectedTagIds || []).slice() }), DB);
    const ent = route.entity; if (!ent || !ent.id || !ent.ui_taxonomy) continue;
    const cat = ent.ui_taxonomy.category_id, grp = ent.ui_taxonomy.group_id;
    const bt = sb.resolveBuilderTags({ desc: text, category: cat, groupId: grp, sizeHint: null, manTagIds: [], userTagIds: [] });
    const r = sb.resolveTagRules({ category: cat, groupId: grp, curatedMode: true, detTagIds: bt.detTagIds, manTagIds: [], userTagIds: [], negatedTagIds: bt.negatedTagIds });
    const st = { qty: 1, answers: {}, detTagIds: r.detTagIds, manTagIds: r.manTagIds, negatedTagIds: r.negatedTagIds, inherentTagIds: [], userTagIds: r.userTagIds, _tagsAffirmed: true, _curatedMode: true, stype: ent.service_type || 'Repair', _svc: ent,
        intent: { key: ent.id, category: cat, _groupId: grp, label: 'x', qtyLabel: 'item' } };
    const b = sb.computeQuoteFromState(st); compared++;
    if (route.quote.laborEstimate !== b.laborCalc || route.quote.totalMin !== b.totalMin) disagree.push(`"${text}" -> ${ent.id}: free-text ${route.quote.laborEstimate} / ${route.quote.totalMin} min, builder ${b.laborCalc} / ${b.totalMin} min`);
}
check(`the free-text route and the guided builder charge the same labor and minutes for the same words (${compared} sentences resolved to a named service)`, disagree.length === 0 && compared >= 4, { expected: '0 disagreements over >= 4 sentences', got: { compared, disagree } });

finish();
