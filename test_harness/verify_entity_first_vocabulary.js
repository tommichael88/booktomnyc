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

// ---- 1. provenance: no alias is invented ------------------------------------------------------------------------------------------------------------------------------------
console.log('Every alias comes from a legacy NLP object that resolves to that entity');
{ const termsOf = new Map(); // entity id -> Set(norm term) offered by the legacy objects that resolve to it
  for (const o of OBJ) { const r = byKeyword.get(o.keyword).resolves_to; if (!r.entity_id) continue; if (!termsOf.has(r.entity_id)) termsOf.set(r.entity_id, new Set()); for (const t of [o.keyword, ...(o.synonyms || [])]) termsOf.get(r.entity_id).add(norm(t)); }
  const invented = []; let n = 0;
  for (const e of SRC.entities) for (const a of e.aliases || []) { n++; if (!(termsOf.get(e.id) || new Set()).has(a)) invented.push(`${e.id}:${a}`); }
  check(`the source carries aliases (${n} on ${SRC.entities.filter(e => (e.aliases || []).length).length} entities)`, n > 200, String(n));
  check('every alias is a keyword or synonym of a legacy object that resolves to that entity (none invented)', invented.length === 0, invented.slice(0, 5).join(', '));
  const bad = SRC.entities.flatMap(e => (e.aliases || []).filter(a => a !== norm(a) || a === '').map(a => `${e.id}:${a}`));
  check('every alias is stored lower-case, single-spaced and non-empty', bad.length === 0, bad.slice(0, 5).join(', '));
}

// ---- 2. coverage: nothing is dropped silently ---------------------------------------------------------------------------------------------------------------------------------
console.log('\nEvery term of a resolved object is an alias, the entity\'s own name, or a reported skip');
{ const skipped = new Map(m.report.aliasSkipped.map(x => [x.entity_id + '|' + x.term, x]));
  const idWords = id => id.slice(4).replace(/_/g, ' ');
  const lost = []; let terms = 0, asAlias = 0, own = 0, skip = 0;
  for (const o of OBJ) { const r = byKeyword.get(o.keyword).resolves_to; if (!r.entity_id) continue; const e = ENT.get(r.entity_id);
    for (const t of new Set([o.keyword, ...(o.synonyms || [])].map(norm))) { terms++;
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

console.log(`\n[Entity-first vocabulary: provenance, coverage, round trip] ${passed} passed, ${failed} failed (of ${passed + failed} checks)`);
process.exit(failed ? 1 : 0);
