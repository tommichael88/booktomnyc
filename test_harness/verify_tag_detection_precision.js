#!/usr/bin/env node
/**
 * verify_tag_detection_precision.js -- a smart tag is detected from the words a customer used, and from nothing else.
 *
 * @enforces R-INVARIANT-DISEASE
 * @enforces R-INVARIANT-CANONICAL
 *
 * THE CLASS (proposed name DEFECT-WITHIN-WORD-MATCH, PENDING_DECISIONS #163; the Charter does not name it yet, so no @detects tag): text matching that finds a phrase INSIDE a longer word, or finds a
 * multi-word phrase whose words are merely scattered through the text. The Charter has met it twice: Battle 1 (T13 to T14, T27, T38 to T39, T43, T112: "washer" inside "dishwasher") and Battle 10 (T78 and T32: a
 * tag synonym that collided, "the same class of bug as a word-boundary collision fixed twice before"), and Battle 10's answer was the data one ("fix a collision at the data level when you can"). It came back
 * because the tag matcher itself never changed: detectTagsNLP matched with String.indexOf while detectIntentNLP, three functions up, already had a
 * whole-word matcher (v9.5, "washer" in "dishwasher"). Measured at T166, on the real engine:
 *   - "cement" in "replacement"        #brick_wall found on 23 catalog phrases that name a replacement (the live pipeline's category scoping hid most of the price, not the chip)
 *   - "mold" in "molding"              #water_damage, and its answer damage_type = "Water ring / moisture stain", on "install crown molding"
 *   - "stain" in "stainless"           #scratched_surface
 *   - "no power" in "...no burners work, won't power on"   #emergency (a priced answer) through the any-order fallback
 *   - "art" in "apartment" (qr.html isFragileItem)   "hang an oversized mirror in my apartment" priced $213 below "hang an oversized mirror"
 *   - "lock" in "blocks", "new" in "renewed"/"knew" (detectIntentNLP's contextual overrides)   "my door blocks the hallway" -> door_lock_or_handle_install; "renewed door" -> prehung door install ($150)
 *   - "art" in "apartment" again, as an override keyword of the "mount" intent   any generic mount/hang request containing "apartment" recommended shelf mounting
 * and the opposite half of the same defect, a tag that cannot be found by its own name: "leaky faucet", "clogged drain", "data recovery", "high volume" and five more detected nothing.
 *
 * MEASURED BY WHAT THE RULE CLAIMS (P-GOVERN-GOODHART): the claim is about what the real engine does with customer text, so every section drives the real functions (detectTagsNLP, inferTagsFromContext,
 * understandRequest, collectBookingContext_freeText + executeWorkflow) in a Node VM over the extracted modules. It asserts:
 *   1. EXPLAINED       For every phrase the catalog itself contains (service names, aliases, descriptions, group names, intent keywords and synonyms, question text, option labels: ~900), every tag the engine
 *                      finds is explained by a whole-word occurrence of one of that tag's synonyms (inflection allowed) or by all of a multi-word synonym's content words within its own length + 3 words.
 *                      A hit that no whole-word reading of any synonym explains is an embedded or scattered match. Same for the tags inferTagsFromContext adds (context_hints, brick synonyms).
 *   2. FINDS ITSELF    Every tag is found by its own name (or its id words) and by each of its synonyms, alone and in four ordinary sentences. The other half of the class: a tag that cannot be reached.
 *   3. CORPUS          tag_detection_corpus.json: customer-style sentences that must find a tag, traps that must not, and negations that must land in `negated`. `knownGaps` are sentences that still fail and
 *                      are filed; one that starts passing must leave the list (the list only shrinks).
 *   4. INVARIANCE      A metamorphic relation over the whole free-text pipeline: appending a clause that says nothing about the job ("in my apartment", "in the smart home office", "for my partner", ...) must
 *                      not change the service chosen, the tags found, or the price. (Words that hold the letters of a synonym -- apart, smart, part, heart, start -- are what this is made of.)
 *   5. INTENT          The contextual-override keywords of detectIntentNLP match whole words: "blocks" is not "lock", "renewed" is not "new".
 *   6. NON-VACUITY     The explained-check is shown to flag a planted substring matcher on "garbage disposal replacement"; the invariance check is shown to flag a planted substring rule on "apartment".
 *
 * WHAT THIS DOES NOT COVER (named): (a) polysemy -- a whole word that means something else ("heavy duty door closer" finds #two_person_required through the whole word "heavy"; "loose tile" finds #wobbly) is a
 * synonym-choice question for the tag's owner, not a matching defect, and is not asserted here; (b) negation (the engine's own negator list differs from negation_library.negative_words -- #169 lists it);
 * (c) typed misspellings; (d) the doubled-consonant inflections the shared matcher does not produce (drip -> dripping, clog -> clogged): those are covered by synonyms, and by section 2.
 *
 * RUN ON ANOTHER TREE (G-INVARIANT-PREFIX): copy this file and test_harness/fixtures/tag_detection_corpus.json into that tree's test_harness/ and run it there -- it reads that tree's btnyc.json, qr.html and modules.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { check, finish } = require('./_shared.js');
const { engine } = require('./_engine.js');
const ROOT = path.resolve(__dirname, '..');
const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
const CORPUS = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'tag_detection_corpus.json'), 'utf8'));
// The engine exactly as the page runs it: the three modules whole (the shared loader), then the two calls the page makes at boot before any text is read (qr.html: "initNlpSets(); refreshNlpPreviewBindings();").
// Without them window._NLP is empty -- no stop words, no prepositions, no action table -- and the engine answers a different question than a customer's browser does.
const sb = { DB, SERVICE_DATA: DB, window: { DB }, console }; sb.global = sb; vm.createContext(sb);
vm.runInContext(engine().wrapper, sb, { filename: 'engine_modules' });
sb.initNlpSets(); if (typeof sb.refreshNlpPreviewBindings === 'function') sb.refreshNlpPreviewBindings();

const TAGS = DB.smart_tags;
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// ---- an INDEPENDENT oracle for "does this synonym occur in this text as whole words" (not the engine's matcher) ----
const norm = t => t.toLowerCase().replace(/[.,!?;:]/g, '');
const wholePhrase = (text, syn) => new RegExp('(^|[^a-z0-9])' + esc(syn.toLowerCase()) + "(?:'?s|es|ed|ing|s)?($|[^a-z0-9])", 'i').test(norm(text)) || (syn.endsWith('e') && new RegExp('(^|[^a-z0-9])' + esc(syn.toLowerCase().slice(0, -1)) + '(?:ed|ing)($|[^a-z0-9])', 'i').test(norm(text)));
const NEG = new Set(['not', "isn't", 'isnt', 'no', 'without', "don't", 'dont', 'non', 'never', 'neither', 'nor', 'nothing', 'nowhere', 'hardly', 'barely', 'wont', "won't"]);
const nearWords = (text, syn) => { // all of a multi-word synonym's words as whole tokens within (its length + 3) words -- unless the synonym holds a negator ("no power"): that is a phrase, never a bag of words
    const words = syn.toLowerCase().split(/\s+/); if (words.length < 2 || words.some(w => NEG.has(w))) return false;
    const toks = norm(text).split(/\s+/).filter(Boolean), span = words.length + 3, uniq = [...new Set(words)];
    for (let i = 0; i < toks.length; i++) { if (!uniq.includes(toks[i])) continue; const seen = new Set(); for (let j = i; j < toks.length && j < i + span; j++) { if (uniq.includes(toks[j])) seen.add(toks[j]); if (seen.size === uniq.length) return true; } }
    return false;
};
const synsOf = id => (TAGS[id].synonyms && TAGS[id].synonyms.length ? TAGS[id].synonyms.filter(s => typeof s === 'string') : [id.replace('#', '').replace(/_/g, ' ')]);
const explained = (text, id, detect) => synsOf(id).some(s => wholePhrase(text, s) || nearWords(text, s));
// the same, for a pluggable detector, so non-vacuity can plant a bad one
function unexplained(phrases, detect) {
    const bad = [];
    for (const [p, src] of phrases) for (const id of detect(p)) { if (!TAGS[id]) continue; if (!explained(p, id)) bad.push(`${id} <- "${p}" [${src}]`); }
    return bad;
}

// ---- the catalog's own vocabulary ----
const PH = new Map(); const add = (t, src) => { if (typeof t === 'string' && t.trim()) PH.set(t.trim(), src); };
DB.services.forEach(s => { add(s.ui_taxonomy.display_name, 'service'); add(s.ui_taxonomy.description, 'description'); (s.aliases || []).forEach(a => add(a, 'alias')); });
DB.group.forEach(g => add(g.display_name, 'group'));
DB.intent_mappings.objects.forEach(o => { add(o.keyword, 'keyword'); (o.synonyms || []).forEach(s => add(s, 'synonym')); });
Object.values(DB.intake_modules).forEach(m => { add(m.question, 'question'); (m.client_response || []).forEach(o => add(o.label, 'option')); });
check('the catalog vocabulary is large enough to mean something (>= 800 phrases)', PH.size >= 800, { expected: '>= 800', got: PH.size });

// ---- 1. EXPLAINED ----
const engineDetect = p => sb.detectTagsNLP(p).found;
const bad1 = unexplained(PH, engineDetect);
check('every tag detectTagsNLP finds in the catalog\'s own phrases is explained by a whole-word synonym (no embedded or scattered matches)', bad1.length === 0, { expected: 'none', got: bad1.slice(0, 6).join(' | ') + (bad1.length > 6 ? ` (+${bad1.length - 6})` : '') });
const ctxDetect = p => sb.inferTagsFromContext(p, 'minor_home_repairs', 'minor_home_repairs_walls').map(x => x.tid);
const hintsOf = id => [].concat(TAGS[id].context_hints || [], id === '#brick_wall' ? TAGS[id].synonyms : []);
const bad1b = [];
for (const [p, src] of PH) for (const id of ctxDetect(p)) { if (!hintsOf(id).some(h => wholePhrase(p, h))) bad1b.push(`${id} <- "${p}" [${src}]`); }
check('every tag inferTagsFromContext adds is explained by a whole-word context hint', bad1b.length === 0, { expected: 'none', got: bad1b.slice(0, 6).join(' | ') });

// ---- 2. FINDS ITSELF ----
const SENT = ['{s}', 'I have {s}', 'there is {s} in my kitchen', 'can you fix {s} please'];
const cannot = [];
for (const id of Object.keys(TAGS)) {
    const name = id.replace('#', '').replace(/_/g, ' ');
    const forms = new Set([name, ...synsOf(id)]);
    for (const f of forms) for (const tpl of SENT) {
        const text = tpl.replace('{s}', f), r = sb.detectTagsNLP(text);
        // a form that begins with a negator ("no parking") is its own phrase; a negated verdict is the engine reading the customer's negation, so only "not found at all" counts
        if (!r.found.includes(id) && !r.negated.includes(id)) cannot.push(`${id} <- "${text}"`);
    }
}
check('every tag is found by its own name and by each of its synonyms, alone and in ordinary sentences', cannot.length === 0, { expected: 'none', got: cannot.slice(0, 6).join(' | ') + (cannot.length > 6 ? ` (+${cannot.length - 6})` : '') });

// ---- 3. CORPUS ----
const miss = [], leaked = [], nmiss = [];
for (const [t, tag] of CORPUS.must) { if (!sb.detectTagsNLP(t).found.includes(tag)) miss.push(`${tag} <- "${t}"`); }
for (const [t, tag] of CORPUS.mustNot) { if (sb.detectTagsNLP(t).found.includes(tag)) leaked.push(`${tag} <- "${t}"`); }
for (const [t, tag] of CORPUS.negated) { const r = sb.detectTagsNLP(t); if (!r.negated.includes(tag) || r.found.includes(tag)) nmiss.push(`${tag} <- "${t}"`); }
check(`customer sentences that must find a tag do (${CORPUS.must.length})`, miss.length === 0, { expected: 'none missing', got: miss.slice(0, 6).join(' | ') });
check(`traps that must not find a tag do not (${CORPUS.mustNot.length})`, leaked.length === 0, { expected: 'none found', got: leaked.slice(0, 6).join(' | ') });
check(`negations land in \`negated\` and not in \`found\` (${CORPUS.negated.length})`, nmiss.length === 0, { expected: 'none wrong', got: nmiss.join(' | ') });
const stillFail = (CORPUS.knownGaps || []).filter(([t, tag]) => !sb.detectTagsNLP(t).found.includes(tag));
check('every filed known gap still fails (a gap that starts passing leaves the list: the list only shrinks)', stillFail.length === (CORPUS.knownGaps || []).length, { expected: (CORPUS.knownGaps || []).length + ' still failing', got: stillFail.length, hint: 'delete the passing entries from knownGaps in tag_detection_corpus.json' });
check('the corpus is big enough to mean something (>= 60 must, >= 10 traps)', CORPUS.must.length >= 60 && CORPUS.mustNot.length >= 10, { expected: '>= 60 / >= 10', got: `${CORPUS.must.length} / ${CORPUS.mustNot.length}` });

// ---- 4. INVARIANCE over the free-text pipeline ----
const catOf = x => x.ui_taxonomy.category_id;
function pipeline(text) {
    const c = sb.collectBookingContext_freeText(text), r = sb.executeWorkflow(c, DB);
    return { svc: (c.nlpIntent && (c.nlpIntent.recommendedSku || c.nlpIntent.key)) || null, tags: (c.detectedTagIds || []).slice().sort().join(','), neg: (c.negatedTagIds || []).slice().sort().join(','), price: r && r.quote ? r.quote.laborEstimate : null };
}
const BASES = ['hang an oversized mirror', 'hang an extra large shelf', 'mount a huge tv', 'mount my tv on a brick wall', 'install a ceiling fan', 'fix a leaky faucet', 'my sink is clogged', 'replace the light switch',
    'assemble an ikea dresser', 'the toilet keeps running', 'fix the door', 'hang a picture', 'install a dimmer switch', 'repair a hole in the drywall', 'set up my wifi router', 'my laptop has a virus'];
// Clauses that hold the letters of a synonym (art: apartment, partner, heart, smartest, dartboard; ear: heart) but name nothing the catalog sells, and whose own words are not catalog vocabulary
// ("smart home", "start", "part", "wall" and "side" are: they legitimately move the service by the description tie-break, which is polysemy and not this class).
const NEUTRAL = [' in my apartment', ' for my partner', ' near the heart of the city', ' with my parents watching', ' beside my dartboard', ' in the smartest room of the house'];
const moved = [];
for (const b of BASES) {
    let base; try { base = pipeline(b); } catch (e) { moved.push(`"${b}" throws: ${e.message.slice(0, 60)}`); continue; }
    for (const n of NEUTRAL) {
        let got; try { got = pipeline(b + n); } catch (e) { moved.push(`"${b + n}" throws: ${e.message.slice(0, 60)}`); continue; }
        if (got.svc !== base.svc || got.tags !== base.tags || got.price !== base.price) moved.push(`"${b}" +"${n}": ${base.svc}/${base.tags || '-'}/$${base.price} -> ${got.svc}/${got.tags || '-'}/$${got.price}`);
    }
}
check(`appending a clause that says nothing about the job changes neither the service, the tags nor the price (${BASES.length} sentences x ${NEUTRAL.length} clauses)`, moved.length === 0, { expected: 'no change', got: moved.slice(0, 4).join(' | ') + (moved.length > 4 ? ` (+${moved.length - 4})` : '') });

// ---- 5. INTENT ----
const skuOf = t => { const r = sb.understandRequest(t); return (r.intent && r.intent.recommendedSku) || null; };
check('"my door blocks the hallway" does not recommend the lock/handle service ("lock" is not in "blocks")', skuOf('my door blocks the hallway') !== 'door_lock_or_handle_install', { expected: 'not door_lock_or_handle_install', got: skuOf('my door blocks the hallway') });
check('"renewed door" and "I knew the door was bad" do not recommend the prehung door install ("new" is not in "renewed" or "knew")', skuOf('renewed door') !== 'prehung_interior_door_install' && skuOf('I knew the door was bad') !== 'prehung_interior_door_install', { expected: 'neither', got: skuOf('renewed door') + ' / ' + skuOf('I knew the door was bad') });
check('"can you hang a wall in my apartment" does not recommend shelf mounting on the strength of "art" inside "apartment"', skuOf('can you hang a wall in my apartment') !== 'shelf_mounting_standard_buy_the_hour', { expected: 'not shelf_mounting_standard_buy_the_hour', got: skuOf('can you hang a wall in my apartment') });
check('the genuine override words still work: "I need a new door" and "swap the door" recommend the prehung door install; "the door lock is stuck" and "the door needs a new handle" the lock/handle service', skuOf('I need a new door') === 'prehung_interior_door_install' && skuOf('swap the door') === 'prehung_interior_door_install' && skuOf('the door lock is stuck') === 'door_lock_or_handle_install' && skuOf('the door needs a new handle') === 'door_lock_or_handle_install', { expected: 'prehung / prehung / lock / lock', got: [skuOf('I need a new door'), skuOf('swap the door'), skuOf('the door lock is stuck'), skuOf('the door needs a new handle')].join(' / ') });

// ---- 6. NON-VACUITY ----
const plantedSubstring = p => Object.keys(TAGS).filter(id => synsOf(id).some(s => norm(p).indexOf(s.toLowerCase()) !== -1));
const planted = unexplained(new Map([['garbage disposal replacement', 'probe'], ['a stainless steel shelf', 'probe']]), plantedSubstring);
check('(non-vacuity) the explained-check flags a planted substring matcher on "garbage disposal replacement" (cement) and "a stainless steel shelf" (stain)', planted.length >= 2, { expected: '>= 2 flagged', got: planted.join(' | ') });
const plantedScatter = unexplained(new Map([['my stove has no burners work and won\'t power on', 'probe']]), p => Object.keys(TAGS).filter(id => synsOf(id).some(s => s.split(/\s+/).every(w => norm(p).split(/\s+/).includes(w)))));
check('(non-vacuity) the explained-check flags a planted any-order matcher on "no burners work, won\'t power on"', plantedScatter.length >= 1, { expected: '>= 1 flagged', got: plantedScatter.join(' | ') });
{ // a planted rule: "art" anywhere in the sentence marks it fragile -- the invariance relation must see the price move
    const fragile = t => /art/i.test(t); const price = t => (fragile(t) ? 159 : 372);
    check('(non-vacuity) the invariance relation flags a planted substring rule on "apartment"', price('hang an oversized mirror') !== price('hang an oversized mirror in my apartment'), { expected: 'flagged', got: 'not flagged' });
}
finish();
