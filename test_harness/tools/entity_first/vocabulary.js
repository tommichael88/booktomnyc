'use strict';
/**
 * vocabulary.js -- how the customer's words reach the domain model (T177).
 *
 * Two jobs, both pure functions with an exact inverse where the legacy file needs one:
 *
 *   seedAliases(entities, nlpObjects, services)   fills entity.aliases from the NLP objects that name the entity, and records on each object which entity it feeds (`resolves_to`).
 *   splitActionVocabulary / joinActionVocabulary  moves negation_library.action_conjugations (keyed by service-type LABELS) to an id-keyed vocabulary.action_vocabulary, and back.
 *
 * The migration calls the first two directions; project_legacy.js calls the inverse so btnyc.json still receives the shape the NLP engine reads. Nothing here decides a routing question: a
 * word that could name two entities is left out of both and surfaced by the validator as a residual (V-VOC residuals), never resolved by a guess.
 */
const lib = require('./lib.js');

const norm = s => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
const slugOf = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const idWords = id => id.slice(id.indexOf('.') + 1).replace(/_/g, ' ');

// Which entity does an NLP object feed? (1) its keyword is an entity's own id (door -> ent.door); (2) otherwise the entity of its default service; (3) otherwise none, and it says so.
function resolveObject(o, entityIds, entityOfService) {
  const direct = 'ent.' + slugOf(o.keyword);
  if (entityIds.has(direct)) return { entity_id: direct, basis: 'keyword_is_entity' };
  if (typeof o.default_service_sku === 'string' && entityOfService.has(o.default_service_sku)) return { entity_id: entityOfService.get(o.default_service_sku), basis: 'default_service_entity' };
  return { entity_id: null, basis: 'unresolved' };
}

function seedAliases(entities, nlpObjects, services) {
  const entityIds = new Set(entities.map(e => e.id));
  const entityOfService = new Map(services.map(s => [s.id, s.entity_id]));
  const nameOf = new Map(); // normalised label / id words -> Set(entity id): the words that ALREADY name an entity
  for (const e of entities) for (const n of [norm(e.label), norm(idWords(e.id))]) { if (!nameOf.has(n)) nameOf.set(n, new Set()); nameOf.get(n).add(e.id); }
  const candidates = new Map(); // entity id -> [term] in object order
  const stats = { objects: nlpObjects.length, keywordIsEntity: 0, defaultServiceEntity: 0, unresolved: [], skipped: [] };
  for (const o of nlpObjects) {
    const r = resolveObject(o, entityIds, entityOfService); o.resolves_to = r;
    if (r.basis === 'keyword_is_entity') stats.keywordIsEntity++; else if (r.basis === 'default_service_entity') stats.defaultServiceEntity++; else { stats.unresolved.push(o.keyword); continue; }
    if (!candidates.has(r.entity_id)) candidates.set(r.entity_id, []);
    const list = candidates.get(r.entity_id);
    for (const t of [o.keyword, ...(o.synonyms || [])]) { const n = norm(t); if (n && !list.includes(n)) list.push(n); }
  }
  const claimedBy = new Map(); for (const [eid, list] of candidates) for (const t of list) { if (!claimedBy.has(t)) claimedBy.set(t, new Set()); claimedBy.get(t).add(eid); }
  for (const e of entities) {
    const own = new Set([norm(e.label), norm(idWords(e.id))]); const aliases = [];
    for (const t of candidates.get(e.id) || []) {
      if (own.has(t)) continue; // the entity's own name is not an alias of it
      const namesOther = [...(nameOf.get(t) || [])].filter(x => x !== e.id);
      if (namesOther.length) { stats.skipped.push({ term: t, entity_id: e.id, reason: 'names_another_entity', other: namesOther }); continue; }
      const rivals = [...claimedBy.get(t)].filter(x => x !== e.id);
      if (rivals.length) { stats.skipped.push({ term: t, entity_id: e.id, reason: 'claimed_by_another_entity', other: rivals }); continue; }
      aliases.push(t);
    }
    e.aliases = aliases;
  }
  stats.entitiesWithAliases = entities.filter(e => e.aliases.length).length; stats.aliases = entities.reduce((n, e) => n + e.aliases.length, 0);
  return stats;
}

// ---- action vocabulary ----------------------------------------------------------------------------------------------------------------------------------------------------------
const EXTRA = '_extra_actions_not_tied_to_service_type';
function splitActionVocabulary(negationLibrary, actions, unresolved) {
  const nl = lib.clone(negationLibrary); const ac = nl.action_conjugations; delete nl.action_conjugations;
  const byLabel = new Map(actions.map(a => [a.label, a.id]));
  const av = { _note: ac._note, actions: [], unmapped_verbs: [] };
  for (const [k, v] of Object.entries(ac)) {
    if (k === '_note') continue;
    if (k === EXTRA) { for (const [verb, entry] of Object.entries(v)) av.unmapped_verbs.push(Object.assign({ verb }, lib.clone(entry))); continue; }
    if (!byLabel.has(k)) { unresolved('action_conjugations key that is no action label', k); continue; }
    av.actions.push(Object.assign({ action_id: byLabel.get(k) }, lib.clone(v)));
  }
  return { negation_library: nl, action_vocabulary: av };
}
function joinActionVocabulary(av, actions) {
  const labelOf = new Map(actions.map(a => [a.id, a.label]));
  const ac = { _note: av._note };
  for (const { action_id, ...entry } of av.actions) { if (!labelOf.has(action_id)) throw new Error('action_vocabulary names an action that is not in the registry: ' + action_id); ac[labelOf.get(action_id)] = lib.clone(entry); }
  const extra = {}; for (const { verb, ...entry } of av.unmapped_verbs) extra[verb] = lib.clone(entry);
  ac[EXTRA] = extra;
  return ac;
}

module.exports = { norm, slugOf, idWords, resolveObject, seedAliases, splitActionVocabulary, joinActionVocabulary };
