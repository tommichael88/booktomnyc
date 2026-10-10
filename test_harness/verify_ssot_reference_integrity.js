#!/usr/bin/env node
/**
 * verify_ssot_reference_integrity.js -- every pointer inside btnyc.json points at something, and means the same thing to every reader.
 *
 * @enforces R-INVARIANT-DISEASE
 *
 * THE CLASS (proposed name DEFECT-DANGLING-REFERENCE, PENDING_DECISIONS #163; the Charter does not name it yet, so this file carries no @detects tag): a hand-authored pointer in the SSOT that
 * resolves to nothing, or that is spelled in a way one of its readers does not recognise, so the thing it was meant to do silently does not happen. Nothing crashes. A branch never opens, a tag is
 * never cleared, a suggestion is never made. Three instances were found by the T166 audit, each with a different mechanism:
 *   - a TAG POINTER to a tag that no longer exists     dynamic_services['tech_trouble+Install'].suggested_tags[1] = #pets_on_site (retired in v9.5 when pets became a module)
 *   - a BRANCH KEY that is not any option's label       electric_lighting+Install, electrical_item.then['Under-cabinet light']: the option's label is spelled with U+2011 (non-breaking hyphen)
 *                                                       and the key with U+002D, so choosing "Under-cabinet light" never opened "item_count_template" and "removal"
 *   - an OPTION TAG in a spelling its reader ignores    intake_modules.<m>.client_response[].tags held three spellings of one thing (#id, bare id, {"$ref":"#id"}); the one reader that
 *                                                       compares them (pricing engine, "an explicit answer supersedes a contradicting detected tag") compares raw strings against "#id", so
 *                                                       32 of 76 entries (28 bare, 4 `$ref` objects) could never match and the supersession never happened for them.
 * The compiler's own validator already checked part of this (smart_tag_references: requires, mutually_exclusive, answers, default_tags) and returned valid:true while all three stood, because it
 * did not read suggested_tags, dynamic tags, option tags or the keys of `then`. This file is the independent reader, and it proves the compiler's validator now sees every class (section 3).
 *
 * MEASURED BY WHAT THE RULE CLAIMS (P-GOVERN-GOODHART): the claim is "every pointer resolves, in the spelling its reader reads". So this reads the raw SSOT (not `_validation`, which is derived from
 * the same code the claim is about) and walks EVERY place a pointer can sit. It asserts:
 *   1. RESOLUTION      tag pointers (service default/suggested tags, dynamic suggested/smart tags, option tags, tag requires/mutually_exclusive) -> smart_tags; chain and `then` modules -> intake_modules;
 *                      `then` keys -> a label of the module they hang off; tag `answers` (module, label) -> a real module and a real label; modifier_ref -> global_rules.modifiers; formula_override ->
 *                      pricing_formulas; checkout_state_override -> checkout_states; tag scoping (categories, groups, excluded services); intent mapping targets; group/category/service membership.
 *   2. ONE SPELLING    option tags are "#id" strings -- the only form the engine compares against (and the form the proposed one-spelling reference model, #165, settles on).
 *   3. THE VALIDATOR   the compiler's validate_structural reports each class above on a copy of the SSOT broken in exactly that one way, and reports nothing on the SSOT as it is.
 *   4. NON-VACUITY     the walker is shown to find a planted dangling tag, a planted unmatched `then` key and a planted bare option tag, in every place it claims to look.
 *
 * WHAT THIS DOES NOT COVER (named): (a) it does not judge whether a pointer points at the RIGHT thing, only that it points; (b) `group.explicit_services` is checked for resolution but not for completeness
 * (no reader uses it; five services are in no group's list -- #165 proposes deriving it); (c) `compiled.*` is derived and is not walked (splice_compiled.py regenerates it).
 *
 * RUN ON ANOTHER TREE (G-INVARIANT-PREFIX): BTNYC_ROOT=<tree> node test_harness/verify_ssot_reference_integrity.js
 */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const { check, finish } = require('./_shared.js');
const ROOT = process.env.BTNYC_ROOT ? path.resolve(process.env.BTNYC_ROOT) : path.resolve(__dirname, '..');
const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));

// ---- the walker: returns { dangling: [...], spelling: [...] } for a given SSOT object ----
function walk(D) {
    const dangling = [], spelling = [];
    const dang = (cls, at, what) => dangling.push({ cls, at, what });
    const cats = new Set(D.category.map(c => c.id)), grps = new Set(D.group.map(g => g.id)), svcs = new Set(D.services.map(s => s.id));
    const mods = D.intake_modules, tags = D.smart_tags, mats = D.materials_catalog;
    const stypes = D.service_types, forms = D.pricing_formulas, cstates = D.checkout_states, modifs = D.global_rules.modifiers, tiers = D.global_rules.complexity_tiers;
    const tagOf = r => (typeof r === 'string' ? r : r && typeof r === 'object' ? r.$ref : null);
    const tagKey = r => { const t = tagOf(r); return typeof t === 'string' ? (t[0] === '#' ? t : '#' + t) : null; };
    const tagPtr = (cls, at, r) => { const k = tagKey(r); if (!k || !tags[k]) dang(cls, at, String(tagOf(r))); };
    const modOf = x => (typeof x === 'string' ? x : x && x.module);

    const chain = (owner, ch) => (ch || []).forEach((c, i) => {
        const m = mods[c.module];
        if (!m) dang('chain-module', `${owner}.intake_chain[${i}]`, c.module);
        Object.entries(c.then || {}).forEach(([lbl, arr]) => {
            if (m && !(m.client_response || []).some(o => o.label === lbl)) dang('then-key', `${owner}.intake_chain[${i}].then`, `${c.module}: "${lbl}" (${[...lbl].map(ch2 => ch2.charCodeAt(0) > 127 ? 'U+' + ch2.charCodeAt(0).toString(16).toUpperCase() : '').filter(Boolean).join(',') || 'ASCII'})`);
            (Array.isArray(arr) ? arr : []).forEach(x => { if (!mods[modOf(x)]) dang('then-module', `${owner}.intake_chain[${i}].then["${lbl}"]`, String(modOf(x))); });
        });
    });

    D.category.forEach(c => (c.group_ids || []).forEach(g => { if (!grps.has(g)) dang('membership', `category[${c.id}].group_ids`, g); }));
    D.group.forEach(g => {
        if (!cats.has(g.category_id)) dang('membership', `group[${g.id}].category_id`, g.category_id);
        if (g.parent_group && !grps.has(g.parent_group)) dang('membership', `group[${g.id}].parent_group`, g.parent_group);
        (g.explicit_services || []).forEach(s => { if (!svcs.has(s)) dang('membership', `group[${g.id}].explicit_services`, s); });
        (g.dynamic_service_types || []).forEach(t => { if (!stypes[t]) dang('membership', `group[${g.id}].dynamic_service_types`, t); });
    });
    D.services.forEach(s => {
        const u = s.ui_taxonomy || {};
        if (!cats.has(u.category_id)) dang('membership', `services[${s.id}].ui_taxonomy.category_id`, u.category_id);
        if (!grps.has(u.group_id)) dang('membership', `services[${s.id}].ui_taxonomy.group_id`, u.group_id);
        if (!stypes[s.service_type]) dang('membership', `services[${s.id}].service_type`, s.service_type);
        chain(`services[${s.id}]`, s.intake_chain);
        (s.default_tags || []).forEach((r, i) => tagPtr('tag-pointer', `services[${s.id}].default_tags[${i}]`, r));
        (s.suggested_tags || []).forEach((r, i) => tagPtr('tag-pointer', `services[${s.id}].suggested_tags[${i}]`, r));
        (s.required_materials || []).concat(s.optional_materials || []).forEach(m => { if (!mats[m]) dang('material', `services[${s.id}]`, m); });
        (s.remote_deep_dive_modules || []).concat(s.intake_modules_refs || []).forEach(m => { if (!mods[modOf(m)]) dang('chain-module', `services[${s.id}].remote_deep_dive_modules|intake_modules_refs`, String(modOf(m))); });
    });
    Object.entries(D.dynamic_services).forEach(([k, d]) => {
        chain(`dynamic_services[${k}]`, d.intake_chain);
        (d.suggested_tags || []).forEach((r, i) => tagPtr('tag-pointer', `dynamic_services[${k}].suggested_tags[${i}]`, r));
        (d.smart_tags || []).forEach((r, i) => tagPtr('tag-pointer', `dynamic_services[${k}].smart_tags[${i}]`, r));
        (d.remote_deep_dive_modules || []).forEach(m => { if (!mods[modOf(m)]) dang('chain-module', `dynamic_services[${k}].remote_deep_dive_modules`, String(modOf(m))); });
    });
    Object.entries(mods).forEach(([id, m]) => (m.client_response || []).forEach((o, i) => {
        (o.tags || []).forEach((r, j) => {
            const at = `intake_modules[${id}].client_response[${i}].tags[${j}]`;
            tagPtr('tag-pointer', at, r);
            if (typeof r !== 'string' || r[0] !== '#') spelling.push({ at, what: JSON.stringify(r) });
        });
        if (o.modifier_ref && !modifs[o.modifier_ref]) dang('modifier', `intake_modules[${id}].client_response[${i}]`, o.modifier_ref);
        if (o.formula_override && !forms[o.formula_override]) dang('formula', `intake_modules[${id}].client_response[${i}]`, o.formula_override);
        if (o.checkout_state_override && !cstates[o.checkout_state_override]) dang('checkout-state', `intake_modules[${id}].client_response[${i}]`, o.checkout_state_override);
    }));
    Object.entries(tags).forEach(([id, t]) => {
        (t.requires || []).forEach((r, i) => tagPtr('tag-pointer', `smart_tags[${id}].requires[${i}]`, r));
        (t.mutually_exclusive || []).forEach((r, i) => tagPtr('tag-pointer', `smart_tags[${id}].mutually_exclusive[${i}]`, r));
        (t.applicable_categories || []).forEach(c => { if (c !== 'all' && !cats.has(c)) dang('scoping', `smart_tags[${id}].applicable_categories`, c); });
        (t.applicable_group_ids || []).forEach(g => { if (!grps.has(g)) dang('scoping', `smart_tags[${id}].applicable_group_ids`, g); });
        (t.excluded_service_ids || []).forEach(s => { if (!svcs.has(s)) dang('scoping', `smart_tags[${id}].excluded_service_ids`, s); });
        if (t.escalate_complexity && !tiers[t.escalate_complexity]) dang('scoping', `smart_tags[${id}].escalate_complexity`, t.escalate_complexity);
        Object.entries(t.answers || {}).forEach(([mk, want]) => {
            const m = mods[mk];
            if (!m) return dang('tag-answer', `smart_tags[${id}].answers`, `module ${mk}`);
            (Array.isArray(want) ? want : [want]).forEach(v => { if (typeof v === 'string' && !(m.client_response || []).some(o => o.label === v)) dang('tag-answer', `smart_tags[${id}].answers.${mk}`, `label "${v}"`); });
        });
    });
    (D.intent_mappings.objects || []).forEach(o => {
        if (o.default_dynamic_category && !cats.has(o.default_dynamic_category)) dang('intent', `intent_mappings[${o.keyword}].default_dynamic_category`, o.default_dynamic_category);
        if (o.default_service_type && !stypes[o.default_service_type]) dang('intent', `intent_mappings[${o.keyword}].default_service_type`, o.default_service_type);
        if (o.default_service_sku && !svcs.has(o.default_service_sku)) dang('intent', `intent_mappings[${o.keyword}].default_service_sku`, o.default_service_sku);
        (o.contextual_overrides || []).forEach(c => { if (c.override_sku && !svcs.has(c.override_sku)) dang('intent', `intent_mappings[${o.keyword}].contextual_overrides`, c.override_sku); });
    });
    return { dangling, spelling };
}

const brief = xs => xs.slice(0, 6).map(x => `${x.at}: ${x.what}`).join(' | ') + (xs.length > 6 ? ` ... (+${xs.length - 6})` : '');

// ---- 1 + 2. the SSOT as it is ----
const { dangling, spelling } = walk(DB);
const byClass = {}; dangling.forEach(d => { (byClass[d.cls] = byClass[d.cls] || []).push(d); });
const CLASSES = ['tag-pointer', 'chain-module', 'then-module', 'then-key', 'tag-answer', 'modifier', 'formula', 'checkout-state', 'material', 'scoping', 'intent', 'membership'];
for (const c of CLASSES) check(`no dangling ${c} pointer in the SSOT`, !(byClass[c] || []).length, { expected: 'none', got: brief(byClass[c] || []) });
check('every option tag is spelled "#id" (the one form the engine compares against)', spelling.length === 0, { expected: 'none', got: brief(spelling) });

// the walk actually covered the catalog (a walker that reads an empty graph proves nothing)
const optTags = Object.values(DB.intake_modules).reduce((n, m) => n + (m.client_response || []).reduce((k, o) => k + (o.tags || []).length, 0), 0);
const thenKeys = [...DB.services, ...Object.values(DB.dynamic_services)].reduce((n, s) => n + s.intake_chain.reduce((k, c) => k + Object.keys(c.then || {}).length, 0), 0);
const svcTagPtrs = DB.services.reduce((n, s) => n + (s.default_tags || []).length, 0) + Object.values(DB.dynamic_services).reduce((n, d) => n + (d.suggested_tags || []).length, 0);
check('the walk reaches the catalog it claims to (>= 70 option tags, >= 35 `then` keys, >= 200 tag pointers on services)', optTags >= 70 && thenKeys >= 35 && svcTagPtrs >= 200, { expected: '>= 70 / 35 / 200', got: `${optTags} / ${thenKeys} / ${svcTagPtrs}` });

// ---- 3. the compiler's validator sees each class ----
const PY = `
import sys, json
sys.path.insert(0, ${JSON.stringify(path.join(ROOT, 'test_harness'))})
import btnyc_v10_compiler as c
db = json.load(sys.stdin)
print(json.dumps(c.validate_structural(db)))
`;
function compilerSays(db) {
    const r = cp.spawnSync('python3', ['-I', '-c', PY], { input: JSON.stringify(db), encoding: 'utf8', maxBuffer: 1 << 28 });
    if (r.status !== 0) throw new Error('compiler validator failed: ' + (r.stderr || '').slice(-400));
    return JSON.parse(r.stdout);
}
const clone = () => JSON.parse(JSON.stringify(DB));
const total = v => Object.values(v).reduce((n, a) => n + a.length, 0);
let base;
try { base = compilerSays(DB); } catch (e) { base = null; check('the compiler validator runs', false, { expected: 'runs', got: e.message }); }
if (base) {
    check('the compiler validator reports nothing on the SSOT as it is', total(base) === 0, { expected: '0 findings', got: Object.entries(base).filter(([, a]) => a.length).map(([k, a]) => k + ': ' + a[0]).join(' | ') });
    const breaks = {
        'a dangling suggested tag on a dynamic service': d => { d.dynamic_services[Object.keys(d.dynamic_services)[0]].suggested_tags.push({ $ref: '#no_such_tag' }); },
        'a dangling suggested tag on a named service': d => { d.services[0].suggested_tags = [{ $ref: '#no_such_tag' }]; },
        'a dangling option tag': d => { const m = Object.values(d.intake_modules).find(x => (x.client_response || []).length); m.client_response[0].tags = ['#no_such_tag']; },
        'a `then` key that is no option label': d => { const s = d.services.find(x => x.intake_chain.some(c => Object.keys(c.then || {}).length)); const c = s.intake_chain.find(c => Object.keys(c.then || {}).length); const k = Object.keys(c.then)[0]; c.then[k + '‑'] = c.then[k]; delete c.then[k]; },
        'a `then` branch naming a module that does not exist': d => { const s = d.services.find(x => x.intake_chain.some(c => Object.keys(c.then || {}).length)); const c = s.intake_chain.find(c => Object.keys(c.then || {}).length); c.then[Object.keys(c.then)[0]].push('no_such_module'); },
        'an unknown modifier_ref': d => { const m = Object.values(d.intake_modules).find(x => (x.client_response || []).some(o => o.modifier_ref)); m.client_response.find(o => o.modifier_ref).modifier_ref = 'no_such_modifier'; },
    };
    for (const [name, mutate] of Object.entries(breaks)) {
        const d = clone(); mutate(d);
        let got = null; try { got = compilerSays(d); } catch (e) { got = null; }
        check(`the compiler validator reports ${name}`, got && total(got) > 0, { expected: '>= 1 finding', got: got ? total(got) + ' findings' : 'validator error' });
        const w = walk(d);
        check(`(non-vacuity) this file's own walker reports ${name}`, w.dangling.length + w.spelling.length > 0, { expected: '>= 1', got: w.dangling.length + w.spelling.length });
    }
    // spelling is this file's own claim (the compiler normalises "x" to "#x" and accepts it): a planted bare option tag must be seen here
    // measured as a DELTA against the tree as it stands, so the checks hold whether or not the tree still carries spelling defects
    const here = walk(DB), nTag = here.dangling.filter(x => x.cls === 'tag-pointer').length;
    { const d = clone(); const m = Object.values(d.intake_modules).find(x => (x.client_response || []).length); const real = Object.keys(d.smart_tags)[0]; const was = (m.client_response[0].tags || []).filter(r => typeof r !== 'string' || r[0] !== '#').length; m.client_response[0].tags = [real.slice(1)];
      const w = walk(d); check('(non-vacuity) a planted bare option tag is one more spelling defect and not a dangling pointer', w.spelling.length === here.spelling.length - was + 1 && w.dangling.filter(x => x.cls === 'tag-pointer').length === nTag, { expected: `${here.spelling.length - was + 1} spelling, ${nTag} dangling`, got: `${w.spelling.length} spelling, ${w.dangling.filter(x => x.cls === 'tag-pointer').length} dangling` }); }
    { const d = clone(); const m = Object.values(d.intake_modules).find(x => (x.client_response || []).length); const real = Object.keys(d.smart_tags)[0]; const was = (m.client_response[0].tags || []).filter(r => typeof r !== 'string' || r[0] !== '#').length; m.client_response[0].tags = [{ $ref: real }];
      const w = walk(d); check('(non-vacuity) a planted {"$ref"} option tag is one more spelling defect', w.spelling.length === here.spelling.length - was + 1, { expected: here.spelling.length - was + 1, got: w.spelling.length }); }
}
finish();
