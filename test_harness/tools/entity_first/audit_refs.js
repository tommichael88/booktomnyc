#!/usr/bin/env node
'use strict';
/**
 * audit_refs.js -- prove no legacy-spelled reference survives in the source (T175).
 *
 *   node test_harness/tools/entity_first/audit_refs.js
 *
 * The migration converts the reference sites in refs.js RULES (and the structural ones it builds itself). This audit does not trust that table: it takes the legacy file's identifiers (module keys,
 * service ids, group/category ids, formula/modifier/checkout keys, class names, tag names, with an underscore so a generic word cannot match) and every legacy option label, and scans EVERY string
 * value and EVERY object key of the source for them. An identifier that survives unprefixed at a site not pinned below is a reference the migration missed. Pinned collisions are coincidences of
 * spelling (an option slug that happens to equal a tag name; a disclaimer type that equals a checkout-state key) listed with their reason; a pinned collision that no longer occurs fails too.
 * Single-word identifiers cannot be told from vocabulary by spelling; their sites are held by the schema (id patterns) and the validator (typed sites, generic id-shape scan), not by this audit.
 */
const lib = require('./lib.js');

const PINNED = [
  { site: '$.entities[].questions[].options[].id', reason: 'an option id is a slug of its label; two labels slug to a word that is also a tag name (the id is scoped to its question and is never a reference by itself)' },
  { site: '$.entities[].uncertainty_classes[].retired_by[].option_ids[]', reason: 'option_ids hold option ids (scoped to retired_by.question_id); same coincidence as the option id above' },
  { site: '$.registries.pricing_formulas[].inputs[].option_ids[]', reason: 'a formula input names the options it reads by option id (scoped to its question_id); the option id high_ceiling equals the tag name high_ceiling by slug' },
  { site: '$.registries.tags[].answers[].option_id', reason: 'a tag answer is {question_id, option_id}; the option id equals a tag name by slug' },
  { site: '$.entities[].services[].pricing.default_estimates.disclaimer', reason: 'disclaimer is an estimate-disclaimer type (meta.estimate_disclaimers key), not a checkout state; the two vocabularies share a word' },
  { site: '$.entities[].default_compositions[].pricing.default_estimate.disclaimer', reason: 'as above' },
  { site: 'KEY $.meta.estimate_disclaimers', reason: 'meta.estimate_disclaimers is keyed by disclaimer type, which shares a word with a checkout-state key' },
];

function collect(legacy) {
  const ids = new Map(); const add = (kind, x) => { if (typeof x === 'string' && x.length > 3 && /_/.test(x) && !/\s/.test(x)) { if (!ids.has(x)) ids.set(x, new Set()); ids.get(x).add(kind); } };
  Object.keys(legacy.intake_modules).forEach(k => add('module', k)); legacy.services.forEach(s => add('service', s.id));
  legacy.group.forEach(g => add('group', g.id)); legacy.category.forEach(c => add('category', c.id));
  Object.keys(legacy.pricing_formulas).forEach(k => add('formula', k)); Object.keys(legacy.global_rules.modifiers).forEach(k => add('modifier', k));
  Object.keys(legacy.checkout_states).forEach(k => add('checkout_state', k)); Object.keys(legacy.archetypes).forEach(k => add('class', k));
  Object.keys(legacy.smart_tags).forEach(k => { add('tag', k); add('tag', k.replace(/^#/, '')); });
  const labels = new Set(); for (const m of Object.values(legacy.intake_modules)) for (const o of m.client_response || []) if (typeof o.label === 'string' && o.label.length > 3) labels.add(o.label);
  return { ids, labels };
}
const norm = p => p.replace(/\[\d+\]/g, '[]').replace(/\.(?:ent|svc|q|cmp|u|tag|grp|cat|fml|mod|chk|cls|act|mat|fur|ctx|par)\.[^.\[]*/g, '.<id>');

function audit(src, legacy) {
  const { ids, labels } = collect(legacy); const seen = new Map();
  const note = (site, what) => { const k = site; if (!seen.has(k)) seen.set(k, { site, what, n: 0 }); seen.get(k).n++; };
  const walk = (v, p) => {
    if (typeof v === 'string') { if (ids.has(v)) note(norm(p), `value ${JSON.stringify(v)} is the legacy ${[...ids.get(v)].join('/')} identifier, unprefixed`); }
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) {
      if (ids.has(k)) note('KEY ' + norm(p), `key ${JSON.stringify(k)} is the legacy ${[...ids.get(k)].join('/')} identifier, unprefixed`);
      if (labels.has(k) && !/^(?:\$\.(?:vocabulary|meta))/.test(p)) note('LABELKEY ' + norm(p), `key ${JSON.stringify(k)} is a legacy answer label used as a key`);
      walk(x, `${p}.${k}`);
    }
  };
  walk(src, '$');
  const findings = [], matched = new Set();
  for (const s of seen.values()) { const pin = PINNED.find(x => x.site === s.site); if (pin) matched.add(pin.site); else findings.push(`${s.site}: ${s.what} (${s.n}x)`); }
  for (const pin of PINNED) if (!matched.has(pin.site)) findings.push(`pinned collision no longer occurs (remove it from audit_refs.js): ${pin.site}`);
  return { findings, scanned: { identifiers: ids.size, labels: labels.size }, pinned: PINNED.length };
}

if (require.main === module) {
  const r = audit(lib.readJson(lib.PATHS.source), lib.readJson(lib.PATHS.legacy));
  if (!r.findings.length) { console.log(`reference audit: no legacy-spelled reference survives (${r.scanned.identifiers} legacy identifiers and ${r.scanned.labels} answer labels scanned against every string and key; ${r.pinned} pinned coincidences)`); process.exit(0); }
  console.log(`reference audit FAILED: ${r.findings.length}`); r.findings.forEach(f => console.log('  ' + f)); process.exit(1);
}
module.exports = { audit, PINNED };
