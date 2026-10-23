#!/usr/bin/env node
'use strict';
/**
 * service_naming.js -- the canonical naming mechanism for curated services (T188; Charter "Naming From Scope", R-CLIENT-STUTTER, R-SYSTEM-IDENTITY, R-SYSTEM-NODATA, R-DOMAIN-COMPILER).
 *
 *   node test_harness/tools/entity_first/service_naming.js --check     # source and btnyc.json: every service's name is exactly what its authored scope composes (exit 0 only if so)
 *   node test_harness/tools/entity_first/service_naming.js --write     # derive name, display_name and verb_natural in the SOURCE from the authored scope (changes nothing else)
 *   node test_harness/tools/entity_first/service_naming.js --patch F   # write the ssot_patch operations that bring btnyc.json to the source's naming; apply them with ssot_patch.js
 *   node test_harness/tools/entity_first/service_naming.js --report    # the table: service, scope, name, what changed
 *
 * WHAT IT IS. The Charter says a client-facing service name "should render its scope clearly, often as [Object] + [Qualifier] + [Action]", that "the same scope produces the same name regardless of
 * whether the client arrived via Gateway A, B, or C", and that "the name must not stutter". Names were typed by hand, one string per service, so none of that was held. Now each service AUTHORS
 * its scope, once, in ui_taxonomy.naming:
 *
 *     "naming": { "object": "Faucet", "qualifier": "Drip", "actions": ["repair"], "tail": "buy_the_hour"?, "entity_note": "..."?, "exception": { "display_name": "...", "reason": "..." }?,
 *                 "name": "Faucet Drip Repair" }          // name is DERIVED (this tool writes it); everything else is authored
 *
 * and the vocabulary the words come from lives in the SSOT too (ui_config.service_naming: the action nouns and their past participles, the words that stay lowercase, the prepositions that
 * make a qualifier follow the action, the presentation tails). From those:
 *
 *   name         = [Object] [Qualifier] [Action nouns joined by " or "]      "Faucet Drip Repair"; a qualifier that begins with a preposition follows the action: "Flatscreen Mounting with Hidden Cables"
 *   display_name = name + " " + tail text                                    the title on a tile: the only place presentation extras (the clock and "Buy-the-Hour") may appear
 *                  (or exception.display_name, which needs a written reason: the one escape for a name that cannot be a clear client-language name any other way)
 *   verb_natural = the past participle of the first action                  the sentence's verb ("I need 1 Faucet repaired") and the title's action are one authored fact
 *
 * The confirmation sentence reads naming.object and verb_natural, never the display name, so a wording quirk of a title can no longer reach the sentence (that is how "Faucet Repair (Drip) repaired"
 * and "a shelf mounting standard ⏰buy-the-hour job" were made). Identity stays the id (R-SYSTEM-IDENTITY): renaming changes no relationship.
 *
 * The rules the validator holds (every finding is V-NAME-<CODE> in validate_source.js):
 *   VOCAB      the vocabulary is whole: every action has a noun and a past participle; the word lists are lists; every tail has text.
 *   MISSING    a curated service without a naming block.        PARTS   an unknown key, an empty object, an unknown action, a duplicated action, an unknown tail, a malformed exception.
 *   CHARS      the object and the qualifier use letters, digits, spaces, commas, apostrophes, periods and hyphens: no pipe, slash, bracket, parenthesis, "&" or emoji (a title may carry a tail).
 *   CASE       every word is capitalised except the vocabulary's lowercase words (or, for, with ...), which are always lowercase.
 *   STUTTER    no word twice in a row; the object or the qualifier never ends in the action's own noun ("Faucet Repair" + Repair).
 *   STALE      name, display_name or verb_natural is not what the authored scope composes (run --write).
 *   UNIQUE     two services with one name, or one display_name.
 *   MODIFIER   a service that carries domain modifiers names the condition: its qualifier is not empty.
 *   ENTITY     the object or qualifier shares a word with the service's entity (label or alias), or entity_note says in a sentence why the customer's noun is not the entity's; a note on a name that
 *              already shares a word is itself a finding.
 *   TAIL       a tail that names a pricing type (buy_the_hour: hourly) is used only on a service priced that way.
 *   EXCEPTION  an exception without a reason, or one that equals the derived title.
 *
 * Nothing here is read by the page at run time except through the data it writes: the page reads ui_taxonomy.naming.object / .name and verb_natural from btnyc.json.
 */
const fs = require('fs');
const lib = require('./lib.js');

const NAMING_KEYS = ['object', 'qualifier', 'actions', 'tail', 'entity_note', 'exception', 'name'];
const EMOJI = /\p{Extended_Pictographic}/u;
const PART_CHARS = /^[A-Za-z0-9][A-Za-z0-9 ,'’.\-]*$/;
const words = s => String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const STOP = new Set(['or', 'and', 'for', 'with', 'to', 'of', 'in', 'on', 'from', 'under', 'at', 'by', 'the', 'a', 'an', 'my', 'any']);

const isStr = v => typeof v === 'string' && v.trim().length > 0;
const tailText = t => (t && typeof t === 'object' ? t.text : t);

// ---- composition (pure) --------------------------------------------------------------------------------------------------------------------------------------------------------
function followsAction(qualifier, v) {
  const first = String(qualifier || '').split(/\s+/)[0].toLowerCase();
  return !!first && Array.isArray(v.qualifier_follows_action_when_it_starts_with) && v.qualifier_follows_action_when_it_starts_with.includes(first);
}
function actionNouns(actions, v) { return actions.map(a => v.actions[a].noun).join(' or '); }
/** The scope name of one naming block, or throws if it names an action the vocabulary does not have. */
function composeName(n, v) {
  const q = n.qualifier ? String(n.qualifier).trim() : '';
  const act = actionNouns(n.actions, v);
  return [n.object.trim(), q && !followsAction(q, v) ? q : '', act, q && followsAction(q, v) ? q : ''].filter(Boolean).join(' ');
}
function composeDisplay(n, v) {
  if (n.exception && isStr(n.exception.display_name)) return n.exception.display_name;
  const name = composeName(n, v);
  return n.tail ? name + ' ' + tailText(v.tails[n.tail]) : name;
}
const composeVerb = (n, v) => v.actions[n.actions[0]].past;

// ---- findings (pure: one list of entries and a vocabulary in, findings out) ----------------------------------------------------------------------------------------------------
function vocabFindings(v) {
  const f = []; const add = (msg, path = '') => f.push({ code: 'VOCAB', path: 'ui_config.service_naming' + path, msg });
  if (!lib.isObj(v)) { add('ui_config.service_naming is missing: the words a service name is built from have no home'); return f; }
  if (!lib.isObj(v.actions) || !Object.keys(v.actions).length) add('actions is empty: no service can name what is done', '.actions');
  else for (const [id, a] of Object.entries(v.actions)) {
    if (!/^[a-z][a-z_]*$/.test(id)) add(`action id ${JSON.stringify(id)} is not lower_snake_case`, '.actions.' + id);
    if (!lib.isObj(a) || !isStr(a.noun) || !isStr(a.past)) add(`action ${id} needs a noun ("Replacement") and a past participle ("replaced")`, '.actions.' + id);
    else { if (!/^[A-Z]/.test(a.noun)) add(`action ${id}: the noun ${JSON.stringify(a.noun)} starts with a capital`, '.actions.' + id); if (a.past !== a.past.toLowerCase()) add(`action ${id}: the past participle ${JSON.stringify(a.past)} is lowercase`, '.actions.' + id); }
  }
  for (const k of ['qualifier_follows_action_when_it_starts_with', 'lowercase_words']) {
    if (!Array.isArray(v[k]) || !v[k].length || v[k].some(w => !isStr(w) || w !== w.toLowerCase() || /\s/.test(w))) add(`${k} is a non-empty list of single lowercase words`, '.' + k);
  }
  if (!lib.isObj(v.tails)) add('tails is an object of tail id to {text}', '.tails');
  else for (const [id, t] of Object.entries(v.tails)) if (!isStr(tailText(t))) add(`tail ${id} has no text`, '.tails.' + id);
  return f;
}

/** entries: [{ id, path, naming, display_name, verb_natural, modifier_ids, pricing_type, entity: {label, aliases} }] */
function entryFindings(entries, v) {
  const f = []; const add = (code, e, msg, sub = '') => f.push({ code, path: e.path + sub, msg: `${e.id}: ${msg}` });
  const lower = new Set((v.lowercase_words || []));
  const seenName = new Map(), seenDisplay = new Map();
  for (const e of entries) {
    const n = e.naming;
    if (!lib.isObj(n)) { add('MISSING', e, 'a curated service authors its scope in ui_taxonomy.naming (object, actions, ...): its name is composed from it, not typed'); continue; }
    let parts = true;
    for (const k of Object.keys(n)) if (!NAMING_KEYS.includes(k)) { add('PARTS', e, `naming has an unknown key ${JSON.stringify(k)} (allowed: ${NAMING_KEYS.join(', ')})`, '.naming'); }
    if (!isStr(n.object)) { add('PARTS', e, 'naming.object is the customer\'s noun and is not empty', '.naming.object'); parts = false; }
    if (n.qualifier !== undefined && !isStr(n.qualifier)) { add('PARTS', e, 'naming.qualifier, when present, is not empty', '.naming.qualifier'); parts = false; }
    if (!Array.isArray(n.actions) || !n.actions.length) { add('PARTS', e, 'naming.actions names at least one action', '.naming.actions'); parts = false; }
    else {
      const unknown = n.actions.filter(a => !(a in (v.actions || {})));
      if (unknown.length) { add('PARTS', e, `naming.actions names ${unknown.map(a => JSON.stringify(a)).join(', ')}, which ${unknown.length > 1 ? 'are' : 'is'} not in ui_config.service_naming.actions`, '.naming.actions'); parts = false; }
      if (new Set(n.actions).size !== n.actions.length) { add('PARTS', e, 'naming.actions repeats an action', '.naming.actions'); parts = false; }
    }
    if (n.tail !== undefined && !(lib.isObj(v.tails) && n.tail in v.tails)) { add('PARTS', e, `naming.tail ${JSON.stringify(n.tail)} is not in ui_config.service_naming.tails`, '.naming.tail'); parts = false; }
    if (n.exception !== undefined && !(lib.isObj(n.exception) && isStr(n.exception.display_name) && isStr(n.exception.reason))) add('EXCEPTION', e, 'naming.exception is {display_name, reason}: both written, the reason in a sentence', '.naming.exception');
    if (n.entity_note !== undefined && !isStr(n.entity_note)) add('PARTS', e, 'naming.entity_note, when present, is a sentence', '.naming.entity_note');
    if (!parts) continue;

    // characters and case, on the two authored phrases
    for (const k of ['object', 'qualifier']) {
      const t = n[k]; if (t === undefined) continue;
      if (EMOJI.test(t) || !PART_CHARS.test(t.trim())) add('CHARS', e, `naming.${k} ${JSON.stringify(t)} has a character a client-language name does not use (letters, digits, spaces, commas, apostrophes, periods and hyphens only; a title's extras go in a tail)`, '.naming.' + k);
      t.trim().split(/\s+/).forEach((w, i) => {
        const bare = w.replace(/^[,.']+|[,.']+$/g, '');
        if (lower.has(bare.toLowerCase())) { if (bare !== bare.toLowerCase()) add('CASE', e, `"${bare}" stays lowercase`, '.naming.' + k); }
        else if (!/^[A-Z0-9]/.test(bare)) add('CASE', e, `"${bare}" starts with a capital (Title Case; only ${[...lower].join(', ')} stay lowercase)`, '.naming.' + k);
      });
    }
    const name = composeName(n, v), display = composeDisplay(n, v), verb = composeVerb(n, v);
    // stutter
    const w = name.toLowerCase().split(/\s+/);
    for (let i = 1; i < w.length; i++) if (w[i] && w[i] === w[i - 1]) add('STUTTER', e, `"${name}" says "${w[i]}" twice in a row`);
    const nouns = n.actions.map(a => v.actions[a].noun.toLowerCase());
    for (const k of ['object', 'qualifier']) {
      if (n[k] === undefined || (k === 'qualifier' && followsAction(n[k], v))) continue;
      const last = n[k].trim().split(/\s+/).pop().toLowerCase();
      if (nouns.includes(last)) add('STUTTER', e, `naming.${k} ends in "${last}", the noun of its own action: the title would say it twice`, '.naming.' + k);
    }
    // derived fields
    if (n.name !== name) add('STALE', e, `naming.name is ${JSON.stringify(n.name)} but the scope composes ${JSON.stringify(name)}`, '.naming.name');
    if (e.display_name !== display) add('STALE', e, `display_name is ${JSON.stringify(e.display_name)} but the scope composes ${JSON.stringify(display)}`, '.display_name');
    if (e.verb_natural !== verb) add('STALE', e, `verb_natural is ${JSON.stringify(e.verb_natural)} but the first action (${n.actions[0]}) is "${verb}"`, '.verb_natural');
    if (n.exception && isStr(n.exception.display_name) && n.exception.display_name === (n.tail ? name + ' ' + tailText(v.tails[n.tail]) : name)) add('EXCEPTION', e, 'naming.exception equals the derived title: it excepts nothing', '.naming.exception');
    // uniqueness
    if (seenName.has(name)) add('UNIQUE', e, `the name ${JSON.stringify(name)} is also ${seenName.get(name)}'s`, '.naming.name'); else seenName.set(name, e.id);
    if (seenDisplay.has(display)) add('UNIQUE', e, `the title ${JSON.stringify(display)} is also ${seenDisplay.get(display)}'s`, '.display_name'); else seenDisplay.set(display, e.id);
    // a condition that changes the work is named
    if ((e.modifier_ids || []).length && !isStr(n.qualifier)) add('MODIFIER', e, `it carries ${e.modifier_ids.join(', ')} but names no qualifier: the condition that separates it from its sibling is not in the name`, '.naming.qualifier');
    // the customer's noun and the entity
    if (e.entity) {
      const mine = new Set(words(n.object + ' ' + (n.qualifier || '')).filter(x => !STOP.has(x)));
      const theirs = new Set([e.entity.label, ...(e.entity.aliases || [])].flatMap(words).filter(x => !STOP.has(x)));
      const share = [...mine].some(x => theirs.has(x) || theirs.has(x.replace(/s$/, '')) || theirs.has(x + 's'));
      if (!share && !isStr(n.entity_note)) add('ENTITY', e, `its name (${JSON.stringify(n.object + (n.qualifier ? ' ' + n.qualifier : ''))}) shares no word with its entity (${JSON.stringify(e.entity.label)} and its aliases); either the entity or the name is wrong, or entity_note says why the customer's noun is not the entity's`, '.naming');
      if (share && isStr(n.entity_note)) add('ENTITY', e, 'entity_note explains a difference that is not there (the name shares a word with its entity): remove it', '.naming.entity_note');
    }
    // a tail that names a pricing type
    const t = n.tail && v.tails && v.tails[n.tail];
    if (lib.isObj(t) && t.pricing_type && e.pricing_type !== t.pricing_type) add('TAIL', e, `tail ${n.tail} is for services priced ${t.pricing_type}, and this one is priced ${e.pricing_type}`, '.naming.tail');
  }
  return f;
}

// ---- the two shapes ------------------------------------------------------------------------------------------------------------------------------------------------------------
function fromSource(src) {
  const v = src && src.policy && src.policy.ui_config && src.policy.ui_config.service_naming;
  const entries = [];
  (src.entities || []).forEach((en, ei) => (en.services || []).forEach((s, si) => {
    const ui = (s.presentation && s.presentation.ui_taxonomy) || {};
    entries.push({ id: s.id.replace(/^svc\./, ''), path: `$.entities[${ei}].services[${si}].presentation.ui_taxonomy`, naming: ui.naming, display_name: ui.display_name,
      verb_natural: s.presentation && s.presentation.verb_natural, modifier_ids: s.modifier_ids || [], pricing_type: s.pricing && s.pricing.financial_engine && s.pricing.financial_engine.type,
      entity: { label: en.label, aliases: en.aliases || [] }, _ref: s });
  }));
  return { vocab: v, entries };
}
function fromLegacy(db) {
  const E = new Map((db.entities || []).map(e => [e.id, e]));
  const entries = (db.services || []).map((s, i) => {
    const ui = s.ui_taxonomy || {}; const en = E.get(s.entity_id);
    return { id: s.id, path: `$.services[${i}].ui_taxonomy`, naming: ui.naming, display_name: ui.display_name, verb_natural: s.verb_natural, modifier_ids: s.modifier_ids || [],
      pricing_type: s.financial_engine && s.financial_engine.type, entity: en ? { label: en.label, aliases: en.aliases || [] } : null };
  });
  return { vocab: db.ui_config && db.ui_config.service_naming, entries };
}
function findings(model) {
  const f = vocabFindings(model.vocab);
  if (f.length) return f;               // without a whole vocabulary no name can be composed: say that, once
  return entryFindings(model.entries, model.vocab);
}
const findingsFromSource = src => findings(fromSource(src));
const findingsFromLegacy = db => findings(fromLegacy(db));

// ---- derive (source) and patch (btnyc.json) ------------------------------------------------------------------------------------------------------------------------------------
/** Set name, display_name and verb_natural in the parsed source from each service's authored scope. Returns the number of fields changed. */
function deriveSource(src) {
  const m = fromSource(src); const bad = vocabFindings(m.vocab); if (bad.length) throw new Error('the vocabulary is not whole: ' + bad[0].msg);
  let changed = 0;
  for (const e of m.entries) {
    const n = e.naming; if (!lib.isObj(n) || !isStr(n.object) || !Array.isArray(n.actions) || n.actions.some(a => !(a in m.vocab.actions))) continue;
    const ui = e._ref.presentation.ui_taxonomy, pres = e._ref.presentation;
    const name = composeName(n, m.vocab), display = composeDisplay(n, m.vocab), verb = composeVerb(n, m.vocab);
    if (n.name !== name) { n.name = name; changed++; }
    if (ui.display_name !== display) { ui.display_name = display; changed++; }
    if (pres.verb_natural !== verb) { pres.verb_natural = verb; changed++; }
  }
  return changed;
}
/** ssot_patch.js operations that make the mirror's naming equal the source's: the vocabulary, each service's naming block, display_name and verb_natural. */
function patchOps(src, db) {
  const m = fromSource(src), ops = [];
  const lv = db.ui_config && db.ui_config.service_naming;
  if (lv === undefined) ops.push({ op: 'add', path: ['ui_config'], value: { service_naming: lib.clone(m.vocab) } });
  else if (JSON.stringify(lv) !== JSON.stringify(m.vocab)) ops.push({ op: 'set', path: ['ui_config', 'service_naming'], value: lib.clone(m.vocab) });
  const idx = new Map((db.services || []).map((s, i) => [s.id, i]));
  for (const e of m.entries) {
    const i = idx.get(e.id); if (i === undefined) continue; const s = db.services[i];
    if (JSON.stringify(s.ui_taxonomy.naming) !== JSON.stringify(e.naming)) {
      if (s.ui_taxonomy.naming === undefined) ops.push({ op: 'add', path: ['services', i, 'ui_taxonomy'], value: { naming: lib.clone(e.naming) } });
      else ops.push({ op: 'set', path: ['services', i, 'ui_taxonomy', 'naming'], value: lib.clone(e.naming) });
    }
    if (s.ui_taxonomy.display_name !== e.display_name) ops.push({ op: 'set', path: ['services', i, 'ui_taxonomy', 'display_name'], value: e.display_name });
    if (s.verb_natural !== e.verb_natural) ops.push({ op: 'set', path: ['services', i, 'verb_natural'], value: e.verb_natural });
  }
  return ops;
}

// ---- CLI ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
function cli() {
  const args = process.argv.slice(2);
  const src = lib.readJson(lib.PATHS.source), db = lib.readJson(lib.PATHS.legacy);
  const say = (label, f) => { console.log(`${label}: ${f.length ? f.length + ' finding(s)' : 'ok'}`); f.slice(0, 40).forEach(x => console.log(`  [V-NAME-${x.code}] ${x.path}: ${x.msg}`)); };
  if (args.includes('--write')) {
    const n = deriveSource(src);
    const text = lib.toText(src); const wrote = lib.writeIfChanged(lib.PATHS.source, text);
    console.log(`source: ${n} derived field(s) changed${wrote ? ' (written)' : ' (nothing to write)'}`);
    say('source', findingsFromSource(src)); process.exitCode = findingsFromSource(src).length ? 1 : 0; return;
  }
  if (args.includes('--patch')) {
    const out = args[args.indexOf('--patch') + 1]; if (!out) { console.error('--patch needs a file name'); process.exit(2); }
    const ops = patchOps(src, db); fs.writeFileSync(out, JSON.stringify(ops, null, 1) + '\n'); console.log(`${ops.length} operation(s) written to ${out}`); return;
  }
  if (args.includes('--report')) {
    const m = fromSource(src);
    for (const e of m.entries) { const was = (db.services.find(s => s.id === e.id) || { ui_taxonomy: {} }).ui_taxonomy.display_name; const n = e.naming || {};
      console.log([e.id.padEnd(42), (n.object || '?') + (n.qualifier ? ' | ' + n.qualifier : '') + ' | ' + (n.actions || []).join('+'), '=>', JSON.stringify(e.display_name), was === e.display_name ? '' : '(was ' + JSON.stringify(was) + ')'].join(' ')); }
    return;
  }
  // --check (default)
  const a = findingsFromSource(src), b = findingsFromLegacy(db);
  say('source (ssot/btnyc_source.json)', a); say('mirror (btnyc.json)', b);
  const ops = a.length ? [] : patchOps(src, db);
  if (ops.length) console.log(`the mirror differs from the source in ${ops.length} naming field(s); run --patch and ssot_patch.js`);
  process.exitCode = a.length || b.length || ops.length ? 1 : 0;
}
if (require.main === module) cli();

const CODES = ['VOCAB', 'MISSING', 'PARTS', 'CHARS', 'CASE', 'STUTTER', 'STALE', 'UNIQUE', 'MODIFIER', 'ENTITY', 'TAIL', 'EXCEPTION'];   // every code a finding can carry; validate_source.js reports each as V-NAME-<CODE>

module.exports = { CODES, composeName, composeDisplay, composeVerb, followsAction, vocabFindings, entryFindings, fromSource, fromLegacy, findings, findingsFromSource, findingsFromLegacy, deriveSource, patchOps, NAMING_KEYS };
