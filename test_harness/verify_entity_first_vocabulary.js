#!/usr/bin/env node
/**
 * verify_entity_first_vocabulary.js -- the customer's words reach the domain model through data, not through code or guesses (T177; R-TEST-CANFAIL, R-DOMAIN-SHAPE, R-SYSTEM-IDENTITY).
 *
 * @enforces R-TEST-CANFAIL
 * @enforces R-SYSTEM-IDENTITY
 * @enforces R-DOMAIN-SHAPE
 * @enforces R-INVARIANT-DERIVATION
 * @detects DEFECT-TEST-CANTFAIL
 * @detects DEFECT-NAMES-AS-KEYS
 * @detects DEFECT-SILENT-SKIP
 *
 * THE DEFECT-SHAPE. btnyc.json teaches the NLP engine the customer's words as two label-keyed tables: intent_mappings.objects (a word and its synonyms, with a default service) and
 * negation_library.action_conjugations (keyed by the service-type LABEL "Install", "Repair"). The entity-first model needs the same knowledge attached to the domain: an entity knows what customers
 * call it (entity.aliases), an action knows how customers say it (vocabulary.action_vocabulary, keyed by action id). Two ways to get that wrong: invent a routing the legacy file never made (a word
 * pointed at an entity by a guess), or lose what the legacy file said (a synonym that no longer reaches anything, a verb form that vanished) -- and in both cases say nothing.
 *
 * WHAT IS HELD.
 *   1. Provenance: every alias in the source is a keyword or synonym of a legacy NLP object that resolves to that very entity. No alias is invented.
 *   2. Coverage: every keyword or synonym of a resolved legacy object is accounted for in exactly one way -- the entity's own name, an alias, or an entry in the migration's skipped list with its reason.
 *      Nothing is dropped silently. The unresolved objects are listed by name in the source (resolves_to.basis "unresolved") and never given a guessed entity.
 *   3. A hand-audited sample: object -> entity pairs written here by hand from btnyc.json (the object's default service and the entity that service belongs to), NOT computed by the code under test.
 *   4. No alias is ambiguous: no term is an alias of two entities, and no alias is another entity's own name.
 *   5. Order is not meaning: the same objects in the reverse order give the same alias sets.
 *   6. The action vocabulary round-trips: id-keyed in the source, label-keyed again in the projection, byte-identical to btnyc.json's negation_library. remove / replace (no action) and Mount
 *      (no vocabulary) are reported, not invented.
 *   7. Counterfactuals through the validator and the migration: a duplicate or ambiguous alias, an unresolvable object, an action_conjugations key that is no action are caught or reported, never fixed up.
 *
 * Node only; no browser, no network.
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = process.env.BTNYC_ROOT ? path.resolve(process.env.BTNYC_ROOT) : path.resolve(__dirname, '..');
process.env.BTNYC_ROOT = ROOT;
const EF = path.join(__dirname, 'tools', 'entity_first');
const lib = require(path.join(EF, 'lib.js'));
const V = require(path.join(EF, 'validate_source.js'));
const vocab = require(path.join(EF, 'vocabulary.js'));
const { migrate } = require(path.join(EF, 'migrate_legacy.js'));
const { project } = require(path.join(EF, 'project_legacy.js'));

let passed = 0, failed = 0;
const check = (label, ok, detail) => { if (ok) { passed++; console.log(`  ✓ ${label}`); } else { failed++; console.log(`  ✗ ${label}${detail ? ' -- ' + detail : ''}`); } };

const SRC = lib.readJson(lib.PATHS.source), LEGACY = lib.readJson(lib.PATHS.legacy);
const A = lib.authoredLegacy(LEGACY);
const norm = s => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
const OBJ = A.intent_mappings.objects;
const SRC_OBJ = SRC.vocabulary.nlp_objects; const byKeyword = new Map(SRC_OBJ.map(o => [o.keyword, o]));
const ENT = new Map(SRC.entities.map(e => [e.id, e]));
const m = migrate(lib.clone(LEGACY)); // the migration, run fresh: its report names what it skipped and could not resolve
// Which entity a customer word reaches: the entity its object resolves to, except that a word which IS the name of a service (slug words or display name) reaches the entity that owns the service (T166, "Internal
// Hardware Replacement"). Written here from the services themselves, not taken from the code under test.
const SVC_NAME_OWNER = new Map();
for (const e of SRC.entities) for (const sv of e.services || []) for (const n of [sv.id.slice(4).replace(/_/g, ' '), ((sv.presentation || {}).ui_taxonomy || {}).display_name]) { if (!n) continue; const k = norm(n); if (!SVC_NAME_OWNER.has(k)) SVC_NAME_OWNER.set(k, new Set()); SVC_NAME_OWNER.get(k).add(e.id); }
const feeds = (o, term) => { const own = SVC_NAME_OWNER.get(norm(term)); const r = byKeyword.get(o.keyword).resolves_to; return own && own.size === 1 && !own.has(r.entity_id) ? [...own][0] : r.entity_id; };

// ---- 1. provenance: no alias is invented ------------------------------------------------------------------------------------------------------------------------------------
console.log('Every alias comes from a legacy NLP object that resolves to that entity');
{ const termsOf = new Map(); // entity id -> Set(norm term) offered by the legacy objects that resolve to it
  for (const o of OBJ) { const r = byKeyword.get(o.keyword).resolves_to; if (!r.entity_id) continue; for (const t of [o.keyword, ...(o.synonyms || [])]) { const to = feeds(o, t); if (!termsOf.has(to)) termsOf.set(to, new Set()); termsOf.get(to).add(norm(t)); } }
  const invented = []; let n = 0;
  for (const e of SRC.entities) for (const a of e.aliases || []) { n++; if (!(termsOf.get(e.id) || new Set()).has(a)) invented.push(`${e.id}:${a}`); }
  check(`the source carries aliases (${n} on ${SRC.entities.filter(e => (e.aliases || []).length).length} entities)`, n > 200, String(n));
  check('every alias is a keyword or synonym of a legacy object that resolves to that entity, or names a service that entity owns (none invented)', invented.length === 0, invented.slice(0, 5).join(', '));
  const bad = SRC.entities.flatMap(e => (e.aliases || []).filter(a => a !== norm(a) || a === '').map(a => `${e.id}:${a}`));
  check('every alias is stored lower-case, single-spaced and non-empty', bad.length === 0, bad.slice(0, 5).join(', '));
}

// ---- 2. coverage: nothing is dropped silently ---------------------------------------------------------------------------------------------------------------------------------
console.log('\nEvery term of a resolved object is an alias, the entity\'s own name, or a reported skip');
{ const skipped = new Map(m.report.aliasSkipped.map(x => [x.entity_id + '|' + x.term, x]));
  const idWords = id => id.slice(4).replace(/_/g, ' ');
  const lost = []; let terms = 0, asAlias = 0, own = 0, skip = 0;
  for (const o of OBJ) { const r = byKeyword.get(o.keyword).resolves_to; if (!r.entity_id) continue;
    for (const t of new Set([o.keyword, ...(o.synonyms || [])].map(norm))) { terms++; const e = ENT.get(feeds(o, t));
      if ((e.aliases || []).includes(t)) asAlias++; else if (t === norm(e.label) || t === idWords(e.id)) own++; else if (skipped.has(e.id + '|' + t)) skip++; else lost.push(`${o.keyword}:${t}`); } }
  check(`no legacy term is lost (${terms} terms: ${asAlias} aliases, ${own} the entity's own name, ${skip} reported skips)`, lost.length === 0, lost.slice(0, 5).join(', '));
  check('every skip carries a reason that names the other entity', m.report.aliasSkipped.every(x => ['names_another_entity', 'claimed_by_another_entity'].includes(x.reason) && x.other.length >= 1));
  check('the skips are surfaced by the validator as residuals (object_term_not_aliased), one per skip', V.validate(SRC).residuals.filter(r => r.kind === 'object_term_not_aliased').length === m.report.aliasSkipped.length, `${V.validate(SRC).residuals.filter(r => r.kind === 'object_term_not_aliased').length} vs ${m.report.aliasSkipped.length}`);
  const unresolvedInSource = SRC_OBJ.filter(o => o.resolves_to.basis === 'unresolved').map(o => o.keyword).sort();
  check('the objects that resolve to no entity are exactly those the migration reports unresolved', JSON.stringify(unresolvedInSource) === JSON.stringify(m.report.nlpObjectsUnresolved.slice().sort()), unresolvedInSource.join());
  check('an unresolved object has no entity and no default service to infer one from (nothing is guessed)', OBJ.filter(o => unresolvedInSource.includes(o.keyword)).every(o => !o.default_service_sku) && SRC_OBJ.filter(o => unresolvedInSource.includes(o.keyword)).every(o => o.resolves_to.entity_id === null));
  check('an unresolved object is surfaced by the validator as a residual (nlp_object_unresolved), one per object', V.validate(SRC).residuals.filter(r => r.kind === 'nlp_object_unresolved').map(r => r.id).sort().join() === unresolvedInSource.join());
}

// ---- 3. hand-audited sample -------------------------------------------------------------------------------------------------------------------------------------------------
console.log('\nHand-audited sample: object -> entity, written from btnyc.json by hand');
{ // keyword -> [default_service_sku in btnyc.json, entity expected], read off btnyc.json by hand: the object's default service, and the thing that service is done to.
  const HAND = [
    ['door', 'ent.door', 'keyword_is_entity'], ['toilet', 'ent.toilet', 'keyword_is_entity'], ['tv', 'ent.tv', 'keyword_is_entity'],
    ['light fixture', 'ent.ceiling_light', 'default_service_entity'], ['cabinet', 'ent.cabinet_door', 'default_service_entity'], ['fridge', 'ent.refrigerator', 'default_service_entity'],
    ['curtain rod', 'ent.blinds', 'default_service_entity'], ['light bulb', 'ent.bulb', 'default_service_entity'], ['dimmer', 'ent.dimmer_switch', 'default_service_entity'],
    ['flatscreen', 'ent.tv', 'default_service_entity'], ['gfci', 'ent.gfci_outlet', 'default_service_entity'], ['virus', 'ent.computer', 'default_service_entity'],
    ['wifi', 'ent.wifi_extender', 'default_service_entity'], ['door knob', 'ent.door_lock', 'default_service_entity'], ['door sweep', 'ent.door', 'default_service_entity'],
    ['grout', 'ent.tile', 'default_service_entity'], ['software', 'ent.os', 'default_service_entity'], ['speaker', 'ent.smart_speaker', 'default_service_entity'],
    ['switch', 'ent.smart_switch', 'default_service_entity'], ['wood panel', 'ent.wall_paneling', 'default_service_entity'],
    ['install', null, 'unresolved'], ['mount', null, 'unresolved'], ['other', null, 'unresolved'], ['outlet', null, 'unresolved'], ['leak', null, 'unresolved'],
  ];
  const handFails = objs => HAND.filter(([kw, ent, basis]) => { const r = (objs.find(o => o.keyword === kw) || {}).resolves_to; return !(r && r.entity_id === ent && r.basis === basis); }).map(x => x[0]);
  for (const [kw, ent, basis] of HAND) { const r = (byKeyword.get(kw) || {}).resolves_to; check(`"${kw}" -> ${ent || 'no entity'} (${basis})`, !!r && r.entity_id === ent && r.basis === basis, JSON.stringify(r)); }
  check('every object of the legacy file is present, once, in the source (81)', OBJ.length === SRC_OBJ.length && new Set(SRC_OBJ.map(o => o.keyword)).size === SRC_OBJ.length && OBJ.every(o => byKeyword.has(o.keyword)), `${OBJ.length} vs ${SRC_OBJ.length}`);
  { const wrong = lib.clone(SRC_OBJ); wrong.find(o => o.keyword === 'cabinet').resolves_to = { entity_id: 'ent.cabinet', basis: 'keyword_is_entity' }; wrong.find(o => o.keyword === 'leak').resolves_to = { entity_id: 'ent.pipe', basis: 'default_service_entity' };
    check('counterfactual: the hand table fails on objects routed by a guess ("cabinet" by its word, "leak" to a pipe)', handFails(SRC_OBJ).length === 0 && handFails(wrong).join() === 'cabinet,leak', handFails(wrong).join()); }
}

// ---- 4. no alias is ambiguous --------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('\nNo alias is ambiguous');
{ const owner = new Map(); const dup = []; for (const e of SRC.entities) for (const a of e.aliases || []) { if (owner.has(a)) dup.push(`${a}: ${owner.get(a)} / ${e.id}`); else owner.set(a, e.id); }
  check('no term is an alias of two entities', dup.length === 0, dup.slice(0, 4).join('; '));
  const idWords = id => id.slice(4).replace(/_/g, ' '); const names = new Map(); for (const e of SRC.entities) for (const n of [norm(e.label), idWords(e.id)]) { if (!names.has(n)) names.set(n, new Set()); names.get(n).add(e.id); }
  const clash = []; for (const e of SRC.entities) for (const a of e.aliases || []) { const who = [...(names.get(a) || [])].filter(x => x !== e.id); if (who.length) clash.push(`${e.id}:${a} names ${who.join()}`); }
  check('no alias is the name of a different entity', clash.length === 0, clash.slice(0, 4).join('; '));
  check('no alias is the entity\'s own name (an entity is not an alias of itself)', SRC.entities.every(e => !(e.aliases || []).includes(norm(e.label)) && !(e.aliases || []).includes(idWords(e.id))));
}

// ---- 5. order is not meaning ---------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('\nOrder is not meaning');
{ const run = objs => { const ents = lib.clone(SRC.entities).map(e => Object.assign(e, { aliases: [] })); const services = ents.flatMap(e => e.services); const stats = vocab.seedAliases(ents, lib.clone(objs), services); return { sets: new Map(ents.map(e => [e.id, e.aliases.slice().sort().join('|')])), stats }; };
  const fwd = run(OBJ.map(o => lib.clone(o))), rev = run(OBJ.slice().reverse().map(o => lib.clone(o)));
  // the service list the seeding reads is the SOURCE's (ids already normalised); the legacy objects name legacy ids, so normalise the sku the way the migration does
  const norm2 = objs => objs.map(o => Object.assign(lib.clone(o), { default_service_sku: o.default_service_sku ? 'svc.' + o.default_service_sku : o.default_service_sku }));
  const f2 = run(norm2(OBJ)), r2 = run(norm2(OBJ.slice().reverse()));
  check('the same objects in reverse order give the same alias set for every entity', [...f2.sets].every(([id, v]) => r2.sets.get(id) === v), [...f2.sets].filter(([id, v]) => r2.sets.get(id) !== v).map(x => x[0]).slice(0, 3).join());
  check('the same objects in reverse order give the same skip and unresolved lists (as sets)', JSON.stringify(f2.stats.skipped.map(x => x.entity_id + '|' + x.term).sort()) === JSON.stringify(r2.stats.skipped.map(x => x.entity_id + '|' + x.term).sort()) && JSON.stringify(f2.stats.unresolved.slice().sort()) === JSON.stringify(r2.stats.unresolved.slice().sort()));
  void fwd; void rev;
  check('the fresh seeding reproduces the alias sets the source holds', SRC.entities.every(e => f2.sets.get(e.id) === (e.aliases || []).slice().sort().join('|')), SRC.entities.filter(e => f2.sets.get(e.id) !== (e.aliases || []).slice().sort().join('|')).map(e => e.id).slice(0, 3).join());
}

// ---- 6. the action vocabulary round-trips ---------------------------------------------------------------------------------------------------------------------------------------
console.log('\nThe action vocabulary is id-keyed in the source and label-keyed again in the projection');
{ const legacyAc = A.negation_library.action_conjugations; const av = SRC.vocabulary.action_vocabulary; const actions = SRC.registries.actions;
  const back = vocab.joinActionVocabulary(av, actions);
  check('joining the id-keyed vocabulary gives exactly btnyc.json\'s action_conjugations (keys, order and values)', JSON.stringify(back) === JSON.stringify(legacyAc));
  check('every vocabulary entry names an action that exists', av.actions.every(a => actions.some(x => x.id === a.action_id)));
  check('the vocabulary is keyed by action id, never by label', av.actions.every(a => /^act\./.test(a.action_id)) && !Object.keys(av).some(k => /^(Install|Repair|Diagnostic|Assembly|Setup)$/.test(k)));
  const labels = Object.keys(legacyAc).filter(k => !k.startsWith('_')); const projected = project(SRC).negation_library.action_conjugations;
  check('the projection hands the NLP engine the legacy shape (negation_library equal to btnyc.json\'s, every label key present)', lib.diff(A.negation_library, project(SRC).negation_library) === null && labels.every(k => Object.prototype.hasOwnProperty.call(projected, k)), labels.join());
  const noVocab = actions.filter(a => !av.actions.some(x => x.action_id === a.id)).map(a => a.id);
  check('an action with no vocabulary is reported, not invented (act.mount)', JSON.stringify(noVocab) === JSON.stringify(['act.mount']) && V.validate(SRC).residuals.some(r => r.kind === 'action_without_vocabulary' && r.id === 'act.mount'), noVocab.join());
  check('verbs that name no action (remove, replace) are kept as unmapped verbs and reported', av.unmapped_verbs.map(v => v.verb).sort().join() === 'remove,replace' && V.validate(SRC).residuals.filter(r => r.kind === 'verb_without_action').map(r => r.id).sort().join() === 'remove,replace');
  // counterfactual: the round trip is not a tautology -- a lost form is seen
  const lossy = lib.clone(av); lossy.actions[0].all_forms = lossy.actions[0].all_forms.slice(1);
  check('counterfactual: dropping one verb form breaks the round trip', JSON.stringify(vocab.joinActionVocabulary(lossy, actions)) !== JSON.stringify(legacyAc));
  let threw = false; try { vocab.joinActionVocabulary({ _note: 'x', actions: [{ action_id: 'act.no_such' }], unmapped_verbs: [] }, actions); } catch (e) { threw = /not in the registry/.test(e.message); }
  check('joining an entry for an action that does not exist is refused, not skipped', threw);
}

// ---- 7. counterfactuals through the validator and the migration -------------------------------------------------------------------------------------------------------------------------
console.log('\nA wrong vocabulary is caught or reported, never repaired');
{ const codes = r => new Set(r.errors.map(e => e.code));
  { const s = lib.clone(SRC); const e = s.entities.find(x => (x.aliases || []).length >= 2); e.aliases.push(e.aliases[0]); check('a duplicated alias on one entity is refused (V-VOC-ALIAS-DUP)', codes(V.validateFull(s)).has('V-VOC-ALIAS-DUP')); }
  { const s = lib.clone(SRC); const [e1, e2] = s.entities.filter(x => (x.aliases || []).length >= 1); e2.aliases.push(e1.aliases[0]); check('one term as the alias of two entities is refused (V-VOC-ALIAS-AMBIGUOUS)', codes(V.validateFull(s)).has('V-VOC-ALIAS-AMBIGUOUS')); }
  { const s = lib.clone(SRC); s.vocabulary.nlp_objects.find(o => o.resolves_to.entity_id).resolves_to.entity_id = 'ent.no_such_entity'; check('an object routed to an entity that does not exist is refused (V-VOC-OBJECT-RESOLVE)', codes(V.validateFull(s)).has('V-VOC-OBJECT-RESOLVE')); }
  { const s = lib.clone(SRC); s.vocabulary.action_vocabulary.actions.push(lib.clone(s.vocabulary.action_vocabulary.actions[0])); check('an action given two vocabularies is refused (V-VOC-ACTION-DUP)', codes(V.validateFull(s)).has('V-VOC-ACTION-DUP')); }
  { const L2 = lib.clone(LEGACY); const A2 = lib.authoredLegacy(L2); A2.negation_library.action_conjugations['Nonsense Action'] = { infinitive_for_adlib: 'nonsense', all_forms: ['nonsense'], synonym_clusters: [] };
    const r = migrate(L2).report; check('an action_conjugations key that is no action label is reported unresolved by the migration, not mapped to a guess', r.unresolved.some(u => /action_conjugations key/.test(u.what) && u.detail === 'Nonsense Action')); }
  { const L2 = lib.clone(LEGACY); const A2 = lib.authoredLegacy(L2); A2.intent_mappings.objects.push({ keyword: 'zzz thing', synonyms: ['zzz'], default_service_type: 'Repair', contextual_overrides: [], confidence_weight: 1 });
    const r = migrate(L2); const o = r.source.vocabulary.nlp_objects.find(x => x.keyword === 'zzz thing');
    check('a new object with no entity word and no default service is left unresolved and given no entity', !!o && o.resolves_to.basis === 'unresolved' && o.resolves_to.entity_id === null && r.report.nlpObjectsUnresolved.includes('zzz thing'));
    check('the unresolved object contributes no alias to any entity', r.source.entities.every(e => !(e.aliases || []).includes('zzz'))); }
}

// ---- 8. the T166 findings, carried into the model ------------------------------------------------------------------------------------------------------------------------------------------
// T166 (TIMELINE.md, archive/T166_within_word_hazards.txt, archive/T166_golden_compare.txt) found: smart-tag text matched inside other words (26 hazards); a customer word that names a service reaching
// a different one ("Internal Hardware Replacement": $80 -> $135 once it reached the service it names); tag sets chosen by position; tag exclusivity and the context vocabulary living in code. The model adds
// a NEW matching surface (entity aliases), so what it must keep is each finding's meaning, not the legacy projection. This section asserts that, and plants each defect to show the check can fail.
console.log('\nT166 findings carried into the model: how terms are matched, what a service name reaches, tag order, tag rules');
const D = require(path.join(EF, 'derive_graph.js'));
const ART = lib.readJson(lib.PATHS.graph);
const CONTRACT = lib.readJson(path.join(ROOT, 'schema', 'btnyc-interface-contract.json'));
// the runtime's own matcher, cut out of modules/nlp_engine.js by its text (R-INVARIANT-CANONICAL: one matcher for "does this phrase occur in this text")
const ENGINE_SRC = fs.readFileSync(path.join(ROOT, 'modules', 'nlp_engine.js'), 'utf8');
const cut = (() => { const a = ENGINE_SRC.indexOf('const wordBoundaryMatch = (text, term) => {'), b = ENGINE_SRC.indexOf('const wordBoundaryIncludes = ', a); return a >= 0 && b > a ? ENGINE_SRC.slice(a, ENGINE_SRC.indexOf('\n', b)) : null; })();
const runtimeIncludes = cut ? new Function(cut + '\nreturn wordBoundaryIncludes;')() : null;
const substringIncludes = (text, term) => text.toLowerCase().includes(term.toLowerCase()); // the defect, planted
check('the matcher the contract names is in modules/nlp_engine.js (wordBoundaryMatch, wordBoundaryIncludes)', !!runtimeIncludes && CONTRACT.matching && CONTRACT.matching.canonical_matcher.file === 'modules/nlp_engine.js' && CONTRACT.matching.canonical_matcher.function === 'wordBoundaryMatch');
check('the contract states the matching rule: whole word or phrase, never inside another word', !!CONTRACT.matching && /whole word or a whole phrase/.test(CONTRACT.matching.rule) && /never matches inside another word/.test(CONTRACT.matching.rule));
check('the artifact manifest tells a reader of alias_index the same, and points at the contract', ART.manifest.indexes.alias_index.consumers.some(c => /whole words or phrases, never inside another word/.test(c.reads) && /btnyc-interface-contract\.json/.test(c.reads)));
if (runtimeIncludes) {
  const PROBE = [['cement', 'brick wall repair', false], ['cement', 'cement wall', true], ['cement', 'garbage disposal replacement', false], ['desk', 'desktop pc setup', false], ['desk', 'assemble two desks', true], ['screen', 'mount a flatscreen tv', false],
    ['range', 'stove is strange', false], ['range', 'the range hood', true], ['replace', 'replacing a bulb', true], ['wash', 'washing machine', true], ['lock', 'my door blocks the hallway', false], ['frame', 'framed picture', true], ['ram', 'install a program', false], ['drip', 'a dripping tap', false]];
  const wrong = PROBE.filter(([t, x, want]) => runtimeIncludes(x, t) !== want);
  check(`the runtime matcher behaves as the contract says on ${PROBE.length} hand-written probes (the doubled-consonant gap drip -> dripping is the documented exception)`, wrong.length === 0, wrong.map(w => w.slice(0, 2).join(' / ')).join('; '));
  // the catalog's own text, as the T166 detectors read it
  const texts = []; const add = t => { if (typeof t === 'string' && t.trim()) texts.push(t.toLowerCase()); };
  for (const e of SRC.entities) { add(e.label); for (const q of e.questions || []) { add(q.prompt); for (const o of q.options || []) add(o.label); } for (const sv of e.services || []) { const u = (sv.presentation || {}).ui_taxonomy || {}; add(u.display_name); add(u.description); (sv.aliases || (sv.presentation || {}).aliases || []).forEach(add); } }
  for (const q of SRC.shared_questions || []) { add(q.prompt); for (const o of q.options || []) add(o.label); }
  for (const g of SRC.registries.groups) add(g.display_name);
  for (const o of SRC_OBJ) { add(o.keyword); (o.synonyms || []).forEach(add); }
  const PHRASES = [...new Set(texts)];
  const TERMS = Object.keys(ART.alias_index);
  // an independent reading of "whole word": tokens, in sequence, the last one allowed a suffix
  const tokens = x => x.match(/[a-z0-9]+/g) || [];
  const tokenIncludes = (x, term) => { const T = tokens(x), W = tokens(term); if (!W.length) return false; const last = W[W.length - 1]; const forms = new Set([last, last + 's', last + 'es', last + 'ed', last + 'ing']); if (last.endsWith('e')) { forms.add(last.slice(0, -1) + 'ed'); forms.add(last.slice(0, -1) + 'ing'); }
    for (let i = 0; i + W.length <= T.length; i++) { let ok = true; for (let j = 0; j < W.length - 1; j++) if (T[i + j] !== W[j]) { ok = false; break; } if (ok && forms.has(T[i + W.length - 1])) return true; } return false; };
  let pairs = 0, runtimeHits = 0, unexplained = [], substringOnly = new Map(), plantedUnexplained = 0;
  for (const term of TERMS) for (const x of PHRASES) { pairs++; const rt = runtimeIncludes(x, term), tk = tokenIncludes(x, term);
    if (rt) { runtimeHits++; if (!tk && unexplained.length < 5) unexplained.push(`${term} in "${x.slice(0, 50)}"`); }
    if (!rt && substringIncludes(x, term) && !tk) { const k = term; substringOnly.set(k, (substringOnly.get(k) || 0) + 1); }
    if (substringIncludes(x, term) && !tk) plantedUnexplained++; }
  check(`over the catalog's own text (${TERMS.length} alias terms x ${PHRASES.length} phrases = ${pairs} pairs) every alias hit of the runtime matcher is a whole-word occurrence (${runtimeHits} hits)`, unexplained.length === 0, unexplained.join('; '));
  const inside = (term, word) => [...substringOnly.keys()].includes(term) && PHRASES.some(x => x.includes(word) && x.includes(term) && !runtimeIncludes(x, term));
  check(`the vocabulary does hold within-word hazards (${[...substringOnly.values()].reduce((a, b) => a + b, 0)} alias occurrences inside another word, over ${substringOnly.size} terms), so the check above is not vacuous`, [...substringOnly.values()].reduce((a, b) => a + b, 0) >= 100, JSON.stringify([...substringOnly]));
  check('the named hazards are among them and the runtime matcher refuses each: "cement" in "replacement", "desk" in "desktop", "screen" in "flatscreen", "range" in "strange"', inside('cement', 'replacement') && inside('desk', 'desktop') && inside('screen', 'flatscreen') && inside('range', 'strange'));
  check('counterfactual: a substring matcher produces the defect the rule exists to prevent (the same check fails on it)', plantedUnexplained >= 100 && TERMS.some(t => PHRASES.some(x => substringIncludes(x, t) && !tokenIncludes(x, t))));
  const unreachable = TERMS.filter(t => !runtimeIncludes(`i need ${t} done`, t));
  check(`every alias term is found by its own words in an ordinary sentence (the other half of the class: no alias that cannot be reached; ${TERMS.length} terms)`, unreachable.length === 0, unreachable.slice(0, 5).join(', '));
}

console.log('\nA customer word that names a service reaches the entity that owns it (T166: "Internal Hardware Replacement")');
{ const owner = SVC_NAME_OWNER;
  const stray = []; for (const e of SRC.entities) for (const a of e.aliases || []) { const o = owner.get(a); if (o && o.size === 1 && !o.has(e.id)) stray.push(`${e.id}:${a} (service of ${[...o][0]})`); }
  check('no alias is the name of a service that another entity owns', stray.length === 0, stray.join('; '));
  const phrase = 'internal hardware replacement';
  check(`"${phrase}" is an alias of ent.computer, the owner of svc.internal_hardware_replacement, and of no other entity`, SRC.entities.filter(e => (e.aliases || []).includes(phrase)).map(e => e.id).join() === 'ent.computer' && ENT.get('ent.computer').services.some(sv => sv.id === 'svc.internal_hardware_replacement'));
  check('the published alias_index sends the phrase to ent.computer', JSON.stringify(ART.alias_index[phrase]) === JSON.stringify(['ent.computer']));
  check('the legacy intent object that carries the phrase is unchanged in the projection (it still defaults to svc.internal_hardware_replacement)', (() => { const o = project(SRC).intent_mappings.objects.find(x => (x.synonyms || []).includes(phrase)); return !!o && o.default_service_sku === 'internal_hardware_replacement' && JSON.stringify(o) === JSON.stringify(OBJ.find(x => (x.synonyms || []).includes(phrase))); })());
  { const s = lib.clone(SRC); s.entities.find(e => e.id === 'ent.computer').aliases = s.entities.find(e => e.id === 'ent.computer').aliases.filter(a => a !== phrase); s.entities.find(e => e.id === 'ent.hard_drive').aliases.push(phrase);
    check('counterfactual: the phrase back on ent.hard_drive (whose only service is a data backup) is refused (V-VOC-ALIAS-SERVICE-OWNER)', new Set(V.validateFull(s).errors.map(e => e.code)).has('V-VOC-ALIAS-SERVICE-OWNER')); }
  { const run = mut => { const ents = lib.clone(SRC.entities).map(e => Object.assign(e, { aliases: [] })); const services = ents.flatMap(e => e.services); if (mut) mut(ents, services); const st = vocab.seedAliases(ents, lib.clone(SRC_OBJ), services); return { ents, st }; };
    const a = run(); check('the seeder moves exactly this one term off its object\'s entity (and says so)', a.st.namesService.length === 1 && a.st.namesService[0].term === phrase && a.st.namesService[0].object === 'hard drive' && a.st.namesService[0].from === 'ent.hard_drive' && a.st.namesService[0].to === 'ent.computer', JSON.stringify(a.st.namesService));
    const b = run((ents, services) => { services.find(sv => sv.id === 'svc.internal_hardware_replacement').entity_id = 'ent.hard_drive'; });
    check('counterfactual: the rule follows ownership, not the term: if ent.hard_drive owned the service the phrase would stay there', b.st.namesService.length === 0 && b.ents.find(e => e.id === 'ent.hard_drive').aliases.includes(phrase)); }
  // decided in T178 (PENDING_DECISIONS #220) and not yet applied: the source has no field that records a placement by meaning, and nothing reads aliases before the resolver exists, so the words stay where the object puts them and this pin changes on purpose when the placement lands
  const rest = ['internal hardware', 'internal parts', 'computer internals', 'memory upgrade', 'power supply', 'psu'];
  check('DECIDED, NOT YET APPLIED (#220, T178): the six other words of the "hard drive" object name the computer, and belong to ent.computer once the source can record a placement (with the resolver milestone); until then they are still aliases of ent.hard_drive', rest.every(a => ENT.get('ent.hard_drive').aliases.includes(a)));
}

console.log('\nTag sets are chosen by what they say, not by where they sit (T166 / #169: the golden master chose its "B" tag set by position)');
{ const r = lib.clone(SRC); r.registries.tags.reverse(); const sh = lib.clone(SRC); const t = sh.registries.tags; for (let i = t.length - 1; i > 0; i--) { const j = (i * 7919 + 13) % (i + 1); [t[i], t[j]] = [t[j], t[i]]; }
  const base = JSON.stringify(D.derive(lib.clone(SRC)));
  check(`the source is valid and the published artifact is byte-identical with the ${SRC.registries.tags.length} tags in reverse order`, V.validate(r).ok && JSON.stringify(D.derive(r)) === base);
  check('...and with the tags in a fixed shuffle', V.validate(sh).ok && JSON.stringify(D.derive(sh)) === base);
  check('...and the artifact on disk is the artifact of the source on disk', JSON.stringify(ART) === base || JSON.stringify(ART.entities) === JSON.stringify(JSON.parse(base).entities));
}

console.log('\nTag rules T166 moved into the data are carried and checked');
{ const LT = A.smart_tags; const bare = x => String(x).replace(/^#/, '').replace(/^tag\./, ''); const ST = new Map(SRC.registries.tags.map(t => [bare(t.id), t]));
  const exOf = o => Object.keys(o).filter(k => (o[k] || {}).mutually_exclusive && o[k].mutually_exclusive.length).sort();
  const legacyEx = exOf(LT).map(bare), sourceEx = [...ST.values()].filter(t => (t.mutually_exclusive || []).length).map(t => bare(t.id)).sort();
  check(`mutual exclusivity is carried: the same ${legacyEx.length} tags, each excluding the same tags`, legacyEx.join() === sourceEx.join() && legacyEx.every(k => JSON.stringify(LT['#' + k].mutually_exclusive.map(bare).sort()) === JSON.stringify(ST.get(k).mutually_exclusive.map(bare).sort())));
  check('the three wall materials exclude each other (drywall, brick wall, plaster wall) and drywall is the group default', ['drywall', 'brick_wall', 'plaster_wall'].every(a => ['drywall', 'brick_wall', 'plaster_wall'].filter(b => b !== a).every(b => ST.get(a).mutually_exclusive.map(bare).includes(b))) && ST.get('drywall').is_default_for_group === true && [...ST.values()].filter(t => t.is_default_for_group).length === Object.keys(LT).filter(k => LT[k].is_default_for_group).length);
  const ctx = Object.keys(LT).filter(k => LT[k].context_hints);
  check(`the context vocabulary (context_hints) moved from code to the data is carried unchanged: ${ctx.join(', ')}`, ctx.length === 2 && ctx.every(k => JSON.stringify(LT[k].context_hints) === JSON.stringify(ST.get(bare(k)).context_hints)));
  const tagIds = new Set(SRC.registries.tags.map(t => t.id)); const kinds = [['a service default tag', s => { const sv = s.entities.flatMap(e => e.services).find(x => ((x.tags || {}).default_tag_ids || []).length); sv.tags.default_tag_ids[0] = 'tag.no_such_tag'; }], ['a composition suggested tag', s => { const c = s.entities.flatMap(e => e.default_compositions).find(x => (x.suggested_tag_ids || []).length); c.suggested_tag_ids[0] = 'tag.no_such_tag'; }], ['an option\'s tag', s => { const o = s.entities.flatMap(e => e.questions).flatMap(q => q.options).find(x => (x.tag_ids || []).length); o.tag_ids[0] = 'tag.no_such_tag'; }], ['an exclusion', s => { s.registries.tags.find(t => (t.mutually_exclusive || []).length).mutually_exclusive.push('tag.no_such_tag'); }]];
  for (const [name, f] of kinds) { const s = lib.clone(SRC); f(s); check(`a dangling pointer from ${name} is refused (the "#id" pointer class T166 found)`, !V.validate(s).ok && new Set(V.validate(s).errors.map(e => e.code)).has('V-REF-DANGLING')); }
  check('(sanity) the tag registry is what those pointers resolve against', tagIds.size === SRC.registries.tags.length && tagIds.size >= 50);
}

console.log(`\n[Entity-first vocabulary: provenance, coverage, round trip] ${passed} passed, ${failed} failed (of ${passed + failed} checks)`);
process.exit(failed ? 1 : 0);
