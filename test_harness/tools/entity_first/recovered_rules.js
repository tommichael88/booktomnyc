'use strict';
/**
 * recovered_rules.js -- applies ssot/migration/recovered_rules.json to the entity-first source while migrate_legacy.js builds it (T177).
 *
 * The rules file holds business knowledge the legacy runtime applies in CODE (qr.html applyPricingFormula, FORMULA_CONSUMED_KEYS, QTY_AWARE_FORMULAS) and the service-defining conditions that
 * btnyc.json only implies in a service's name. Each rule cites the code it was read from. This module is the only place the rules enter the source, so the migration stays a pure function of
 * (btnyc.json, recovered_rules.json): nothing here is invented, and nothing is re-derived from label text.
 *
 * It does NOT check the result. validate_source.js owns that, independently, from the source alone.
 */
const fs = require('fs'), path = require('path');
const lib = require('./lib.js');

const RULES_PATH = path.join(lib.ROOT, 'ssot', 'migration', 'recovered_rules.json');
const AFFECT_ORDER = ['price', 'minutes', 'branch', 'prep', 'checkout_state', 'complexity', 'quantity', 'materials', 'tags'];

function load(p = RULES_PATH) {
  const text = fs.readFileSync(p, 'utf8');
  return { rules: JSON.parse(text), sha256: lib.sha(text), path: p };
}

// An input as the source carries it: the rule without its code citation (the citation stays in the rules file, where the staleness test reads it).
const inputForSource = inp => { const o = {}; for (const [k, v] of Object.entries(inp)) if (k !== 'evidence') o[k] = lib.clone(v); return o; };

// formulas: the registry array (mutated). Adds `inputs` and `qty_aware`.
function applyFormulas(formulas, rules, report) {
  const byId = new Map(formulas.map(f => [f.id, f]));
  let inputs = 0, qtyAware = 0;
  for (const [fid, list] of Object.entries(rules.formula_inputs)) {
    const f = byId.get(fid); if (!f) throw new Error(`recovered_rules: formula_inputs names ${fid}, which btnyc.json does not define`);
    f.inputs = list.map(inputForSource); inputs += list.length;
  }
  for (const fid of rules.formula_qty_aware.formulas) {
    const f = byId.get(fid); if (!f) throw new Error(`recovered_rules: formula_qty_aware names ${fid}, which btnyc.json does not define`);
    f.qty_aware = true; qtyAware++;
  }
  report.counts.formulaInputs = inputs; report.counts.formulasWithInputs = Object.keys(rules.formula_inputs).length; report.counts.formulasQtyAware = qtyAware;
  report.counts.droppedLegacyConsumedKeys = rules.dropped_legacy_consumed_keys.length;
}

// modifiers: the registry array (mutated, appended to). A condition modifier names a domain condition; it carries no fee or minutes (the service keeps its own price).
function addConditionModifiers(modifiers, rules, report) {
  const have = new Set(modifiers.map(m => m.id));
  for (const c of rules.condition_modifiers) {
    if (have.has(c.id)) throw new Error(`recovered_rules: condition modifier ${c.id} collides with a legacy modifier`);
    modifiers.push({ id: c.id, role: 'condition', label: c.label, description: c.description, basis: c.basis, affects: [] });
  }
  report.counts.conditionModifiers = rules.condition_modifiers.length;
}

// services: the migrated service array (mutated). A service that carries a condition modifier is told apart from its siblings at the same (entity, action) point.
function assignServiceModifiers(services, rules, report) {
  const byId = new Map(services.map(s => [s.id, s])); let assigned = 0;
  for (const c of rules.condition_modifiers) {
    for (const sid of c.service_ids) {
      const s = byId.get(sid); if (!s) throw new Error(`recovered_rules: ${c.id} is assigned to ${sid}, which btnyc.json does not define`);
      if (s.entity_id !== c.entity_id || s.action_id !== c.action_id) throw new Error(`recovered_rules: ${sid} is (${s.entity_id}, ${s.action_id}), the rule says (${c.entity_id}, ${c.action_id})`);
      if (!s.modifier_ids.includes(c.id)) { s.modifier_ids.push(c.id); assigned++; }
    }
    for (const sid of c.siblings_without) {
      const s = byId.get(sid); if (!s) throw new Error(`recovered_rules: ${c.id} names the sibling ${sid}, which btnyc.json does not define`);
      if (s.entity_id !== c.entity_id || s.action_id !== c.action_id) throw new Error(`recovered_rules: sibling ${sid} is not at (${c.entity_id}, ${c.action_id})`);
    }
  }
  report.counts.servicesWithConditionModifiers = assigned;
}

// questions: Map(qid -> question) (mutated). Completes each option's `affects` with what the formula inputs make it do.
// The effect of a trigger is the modifier's own (fee -> price, minutes -> minutes); a branch selector and a quantity input carry the effects the rule declares.
function completeOptionEffects(questions, formulas, modifiers, report) {
  const modById = new Map(modifiers.map(m => [m.id, m]));
  const add = new Map(); // `${qid}#${oid}` -> Set(effect)
  const put = (qid, oid, effects) => { const k = qid + '#' + oid; if (!add.has(k)) add.set(k, new Set()); for (const e of effects) add.get(k).add(e); };
  const modEffects = id => { const m = modById.get(id); if (!m) return []; return [m.fee ? 'price' : null, m.minutes ? 'minutes' : null].filter(Boolean); };
  for (const f of formulas) {
    for (const row of f.issue_type_fees || []) put(row.question_id, row.option_id, modEffects(row.modifier_id));
    for (const inp of f.inputs || []) {
      if (inp.role === 'trigger_modifier') for (const oid of inp.option_ids) put(inp.question_id, oid, modEffects(f[inp.modifier_param]));
      else if (inp.role === 'select_branch') for (const b of inp.branches) for (const oid of b.option_ids) put(inp.question_id, oid, inp.affects || []);
      else if (inp.role === 'quantity' && inp.source === 'answer_values') for (const v of inp.values) put(inp.question_id, v.option_id, ['quantity', ...(inp.affects || [])]);
      else if (inp.role === 'quantity' && inp.source === 'option_qty_value' && inp.question_id) { const q = questions.get(inp.question_id); for (const o of (q && q.options) || []) if (o.qty_value !== undefined) put(inp.question_id, o.id, o.qty_value === 0 ? ['quantity'] : ['quantity', ...(inp.affects || [])]); } // a count of zero adds nothing to the quote
    }
  }
  let touched = 0;
  for (const [k, effects] of add) {
    const [qid, oid] = k.split('#'); const q = questions.get(qid); const o = q && (q.options || []).find(x => x.id === oid);
    if (!o) throw new Error(`recovered_rules: a formula input names the option ${k}, which does not exist`);
    const before = o.affects.join(','); o.affects = AFFECT_ORDER.filter(a => a === 'branch' ? o.affects.includes(a) : (o.affects.includes(a) || effects.has(a))); // the derived `branch` effect is added later and kept as is
    if (o.affects.join(',') !== before) touched++;
  }
  report.counts.optionsEffectsCompletedByFormulaInputs = touched;
}

module.exports = { RULES_PATH, AFFECT_ORDER, load, applyFormulas, addConditionModifiers, assignServiceModifiers, completeOptionEffects };
