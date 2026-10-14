'use strict';
/**
 * declared_normalizations.js -- the complete list of places where the source does NOT reproduce btnyc.json byte-for-byte in meaning (T175, design note 12.1).
 *
 * Every difference the projection / compiler roundtrip tolerates is pinned here, with its reason. verify() compares what the tools OBSERVED to this list in both directions: a difference that is not
 * declared fails, and a declared one that no longer occurs fails too, so the list cannot grow silently and cannot go stale. Adding an entry is a reviewed change to this file, not a flag on a tool.
 */
const PINNED = {
  action_double_spelling: {
    reason: 'legacy routing_archetypes[minor_home_repairs_ceilings].real_action_ids holds both "Repair" and the id-spelled "act.repair"; one action has one spelling after migration (the compiler preserves the curated union, so it carries into compiled too)',
    where: ['minor_home_repairs_ceilings'],
  },
  empty_branch_lists: {
    reason: 'a `then` label with an empty target list ("this answer opens nothing") authors no dependency and has no runtime effect; the option is recorded with no `branch` effect instead',
    where: ['plumbing_help+Install :: plumbing_fixture :: Other (describe in notes)'],
  },
  compiler_derived_symptom_groups: {
    reason: 'a symptom-first group that declares symptom_module has real_symptom_ids and symptom_id_to_service_ids compiled from that question\'s options (T174 / #199); they are not authored, so the seed carries none',
    where: ['minor_home_repairs_appliances_dishwasher', 'minor_home_repairs_appliances_dryer', 'minor_home_repairs_appliances_microwave', 'minor_home_repairs_appliances_refrigerator', 'minor_home_repairs_appliances_stove_range', 'minor_home_repairs_appliances_washer'],
  },
  chain_layout: {
    reason: 'compiled.service_index[*].intake_chain is the compiler\'s verbatim copy of the authored chain layout (entry order, redundant `then` targets, target-list order). The source holds steps + depends_on and regenerates a canonical layout; these chains differ in raw layout from the legacy spelling but have the same resolved order, branch map, params and annotations',
    where: ['computer_diagnostic', 'electric_lighting+Install', 'flatscreen_mounting_standard', 'flatscreen_mounting_with_hidden_cables', 'plumbing_help+Install', 'wall_hole_or_crack_repair'],
  },
};

function verify(observed, classes) {
  const problems = [];
  for (const [k, spec] of Object.entries(PINNED)) {
    if (!classes.includes(k)) continue;
    const got = (observed[k] || []).slice().sort(), want = spec.where.slice().sort();
    for (const g of got) if (!want.includes(g)) problems.push(`undeclared ${k}: ${g}`);
    for (const w of want) if (!got.includes(w)) problems.push(`declared ${k} no longer occurs (remove it from declared_normalizations.js): ${w}`);
  }
  for (const k of Object.keys(observed)) if (!PINNED[k]) problems.push(`observed ${k} is not a declared normalization class`);
  return problems;
}
module.exports = { PINNED, verify };
