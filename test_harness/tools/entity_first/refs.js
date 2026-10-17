'use strict';
/**
 * refs.js -- the ONE place that says how a legacy reference is spelled and how it is spelled in the source (T175).
 *
 * A reference in the source is a bare id string whose prefix names its target type (lib.js ID_TYPES). The legacy file spells references four ways (bare key, "#tag", {"$ref":"#tag"}, and
 * a label used as a key); the migration normalises every one at this boundary and the projection spells each site back the way its legacy reader expects.
 *
 * `RULES` is a table of reference SITES in the sections that are carried rather than restructured. forward() turns legacy spellings into ids, inverse() turns ids back. The table is data, so the
 * migration report can print it and a reviewer can read every site that is converted; the reference audit (audit.js) separately proves no legacy-spelled reference survives outside it.
 */
const { stripId } = require('./lib.js');

// ---- spelling per type ------------------------------------------------------------------------------------------------------------------------------------------------------
function makeSpellings(ctx) {
  const plain = prefix => ({ f: v => prefix + '.' + v, i: v => stripId(prefix, v) });
  return {
    // q: a reference to a question. A legacy name that names NO intake module (a dangling reference in btnyc.json) is kept visibly, as {unresolved_name}, so it is a residual the validator reports and the
    // projection restores exactly; it is never silently dropped and never given an invented target.
    q: { f: v => { if (ctx.moduleExists && !ctx.moduleExists(v)) { if (ctx.onDangling) ctx.onDangling(v); return { unresolved_name: v }; } return 'q.' + v; }, i: v => (v && typeof v === 'object' && typeof v.unresolved_name === 'string' ? v.unresolved_name : stripId('q', v)) },
    svc: plain('svc'), cat: plain('cat'), grp: plain('grp'), mod: plain('mod'), fml: plain('fml'), chk: plain('chk'), cls: plain('cls'), mat: plain('mat'), par: plain('par'), ent: plain('ent'),
    // "#id" in the legacy file
    tag_hash: { f: v => { if (typeof v !== 'string' || !v.startsWith('#')) throw new Error(`tag reference ${JSON.stringify(v)} is not spelled "#id"`); return 'tag.' + v.slice(1); }, i: v => '#' + stripId('tag', v) },
    // {"$ref": "#id"} in the legacy file
    tag_ref: { f: v => { if (!v || typeof v !== 'object' || typeof v.$ref !== 'string' || !v.$ref.startsWith('#')) throw new Error(`tag reference ${JSON.stringify(v)} is not {"$ref":"#id"}`); return 'tag.' + v.$ref.slice(1); }, i: v => ({ $ref: '#' + stripId('tag', v) }) },
    // a service type such as "Repair": the id is lower case, the label (the legacy key) comes back from the action registry
    act: { f: v => { if (typeof v !== 'string' || !ctx.actionByLegacy.has(v)) throw new Error(`unknown service type ${JSON.stringify(v)}`); return ctx.actionByLegacy.get(v); }, i: v => { if (!ctx.actionLabel.has(v)) throw new Error(`unknown action id ${JSON.stringify(v)}`); return ctx.actionLabel.get(v); } },
    // category list entries that may also be the sentinel "all" (a scope, not a reference)
    cat_or_all: { f: v => (v === 'all' ? 'all' : 'cat.' + v), i: v => (v === 'all' ? 'all' : stripId('cat', v)) },
  };
}

// ---- the table --------------------------------------------------------------------------------------------------------------------------------------------------------------
// path: segments from the section root; '*' = every object member, '[]' = every array element.  kind: 'value' (a string/object leaf), 'keys' (the object's member names are the references).
// Sections are named as they are in the SOURCE (the migration applies the rules after it has placed a section; the projection applies the inverse before it hands the section back).
const RULES = {
  categories: [{ path: ['[]', 'id'], kind: 'value', t: 'cat' }, { path: ['[]', 'group_ids', '[]'], kind: 'value', t: 'grp' }],
  groups_base: [{ path: ['[]', 'id'], kind: 'value', t: 'grp' }, { path: ['[]', 'category_id'], kind: 'value', t: 'cat' }, { path: ['[]', 'parent_group'], kind: 'value', t: 'grp' },
    { path: ['[]', 'explicit_services', '[]'], kind: 'value', t: 'svc' }, { path: ['[]', 'dynamic_service_types', '[]'], kind: 'value', t: 'act' }],
  tags_base: [{ path: ['[]', 'requires', '[]'], kind: 'value', t: 'tag_ref' }, { path: ['[]', 'derived_from', '[]'], kind: 'value', t: 'tag_ref' }, { path: ['[]', 'mutually_exclusive', '[]'], kind: 'value', t: 'tag_hash' },
    { path: ['[]', 'applicable_categories', '[]'], kind: 'value', t: 'cat_or_all' }, { path: ['[]', 'applicable_group_ids', '[]'], kind: 'value', t: 'grp' }, { path: ['[]', 'excluded_service_ids', '[]'], kind: 'value', t: 'svc' }],
  actions: [{ path: ['[]', 'required_intake_modules', '[]'], kind: 'value', t: 'q' }],
  classes: [{ path: ['[]', 'member_group_ids', '[]'], kind: 'value', t: 'grp' }, { path: ['[]', 'typical_actions', '[]'], kind: 'value', t: 'act' }, { path: ['[]', 'default_checkout_state'], kind: 'value', t: 'chk' }],
  nlp_objects: [{ path: ['[]', 'default_dynamic_category'], kind: 'value', t: 'cat' }, { path: ['[]', 'default_service_type'], kind: 'value', t: 'act' }, { path: ['[]', 'default_service_sku'], kind: 'value', t: 'svc' },
    { path: ['[]', 'contextual_overrides', '[]', 'override_sku'], kind: 'value', t: 'svc' }, { path: ['[]', 'contextual_overrides', '[]', 'smart_tag'], kind: 'value', t: 'tag_ref' },
    { path: ['[]', 'dynamic_rule'], kind: 'value', t: 'fml' }, { path: ['[]', 'fallback', 'category'], kind: 'value', t: 'cat' }, { path: ['[]', 'fallback', 'service_type'], kind: 'value', t: 'act' }],
  nlp_default_fallback: [{ path: ['category'], kind: 'value', t: 'cat' }, { path: ['service_type'], kind: 'value', t: 'act' }],
  global_rules: [{ path: ['intake_defaults', 'group_defaults'], kind: 'keys', t: 'grp' }, { path: ['intake_defaults', 'group_defaults', '*', '[]'], kind: 'value', t: 'q' },
    { path: ['intake_defaults', 'category_defaults'], kind: 'keys', t: 'cat' }, { path: ['intake_defaults', 'category_defaults', '*', '[]'], kind: 'value', t: 'q' },
    { path: ['force_modules_by_variability_DEPRECATED', '*', '[]'], kind: 'value', t: 'q' },
    // T182: the formulas whose minutes the flat-rate time model prices; named by id in the source, by the legacy formula name in the file the page reads
    { path: ['pricing_engines', 'flat_rate', 'time_pricing', 'priced_formulas', '[]'], kind: 'value', t: 'fml' }],
  ui_config: [{ path: ['step2_types', '[]'], kind: 'value', t: 'act' }],
  formulas: [{ path: ['[]', 'patch_modifier_ref'], kind: 'value', t: 'mod' }, { path: ['[]', 'texture_modifier_ref'], kind: 'value', t: 'mod' }, { path: ['[]', 'grout_modifier_ref'], kind: 'value', t: 'mod' },
    { path: ['[]', 'water_damage_modifier_ref'], kind: 'value', t: 'mod' }, { path: ['[]', 'high_ceiling_modifier_ref'], kind: 'value', t: 'mod' }, { path: ['[]', 'disposal_modifier_ref'], kind: 'value', t: 'mod' },
    { path: ['[]', 'membrane_modifier_ref'], kind: 'value', t: 'mod' }],
};

// ---- the engine -------------------------------------------------------------------------------------------------------------------------------------------------------------
function step(node, seg, fn) {
  // yields child containers; fn(parent, key) is called at the last segment
  if (seg === '[]') { if (Array.isArray(node)) node.forEach((_, i) => fn(node, i)); }
  else if (seg === '*') { if (node && typeof node === 'object' && !Array.isArray(node)) Object.keys(node).forEach(k => fn(node, k)); }
  else if (node && typeof node === 'object' && seg in node) fn(node, seg);
}
function apply(root, rules, dir, ctx, counter) {
  const S = makeSpellings(ctx);
  const doRule = (rule) => {
    const sp = S[rule.t]; if (!sp) throw new Error('no spelling ' + rule.t);
    const tf = dir === 'forward' ? sp.f : sp.i;
    const walk = (node, segs) => {
      if (node === undefined || node === null) return;
      if (segs.length === 0) return;
      const [seg, ...rest] = segs;
      if (rest.length === 0) {
        if (rule.kind === 'keys') return;
        step(node, seg, (parent, key) => { const v = parent[key]; if (v === undefined || v === null) return; parent[key] = tf(v); if (counter) counter(rule, 1); });
      } else step(node, seg, (parent, key) => walk(parent[key], rest));
    };
    if (rule.kind === 'keys') {
      const walkK = (node, segs) => {
        if (segs.length === 0) {
          if (!node || typeof node !== 'object' || Array.isArray(node)) return;
          const entries = Object.entries(node); for (const k of Object.keys(node)) delete node[k];
          for (const [k, v] of entries) { node[tf(k)] = v; if (counter) counter(rule, 1); }
          return;
        }
        const [seg, ...rest] = segs; step(node, seg, (parent, key) => walkK(parent[key], rest));
      };
      walkK(root, rule.path);
    } else walk(root, rule.path);
  };
  rules.forEach(doRule);
  return root;
}
const forward = (root, rules, ctx, counter) => apply(root, rules, 'forward', ctx, counter);
const inverse = (root, rules, ctx, counter) => apply(root, rules, 'inverse', ctx, counter);

module.exports = { RULES, forward, inverse, makeSpellings };
