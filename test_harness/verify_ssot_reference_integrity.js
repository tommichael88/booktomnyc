#!/usr/bin/env node
/**
 * verify_ssot_reference_integrity.js -- every pointer inside btnyc.json points at something, and means the same thing to every reader.
 *
 * @enforces R-INVARIANT-DISEASE
 * @detects DEFECT-DANGLING-REFERENCE
 *
 * THE CLASS (DEFECT-DANGLING-REFERENCE; named in Charter Part X on the operator's ruling of 2026-10-10, PENDING_DECISIONS #163, and this file is its class detector): a hand-authored pointer in the SSOT that
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
    // a fee map keyed by an option label (T167: S2 of RESHAPE_SCOPE_S1_S6.md lists it with `then` and tag answers): pricing reads `issue_type_fees[answers.issue]`, so a key that is no label of module `issue` is a fee that never applies
    Object.entries(forms).forEach(([fid, f]) => Object.keys((f && f.issue_type_fees) || {}).forEach(k => {
        if (!mods.issue || !(mods.issue.client_response || []).some(o => o.label === k)) dang('fee-key', `pricing_formulas[${fid}].issue_type_fees`, `"${k}"`);
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
const CLASSES = ['tag-pointer', 'chain-module', 'then-module', 'then-key', 'tag-answer', 'fee-key', 'modifier', 'formula', 'checkout-state', 'material', 'scoping', 'intent', 'membership'];
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

// ---- 5. TYPOGRAPHY (T167, #167 item 5): a label is a key, so what it is spelled with is part of what it points at ----
// The `electrical_item` branch was dead for months because one hyphen was U+002D and the other U+2011: identical on screen, different to every comparison. Two kinds of character make that
// possible, and they are governed differently:
//   INVISIBLE   a character that renders as a hyphen, a space or nothing and is a different code point (U+2010 to U+2012, U+2212, U+00AD, U+00A0, zero-width). Nothing is gained by one in an
//               SSOT string and every comparison is lost, so the rule is absolute: none anywhere in the file (derived data included, which also catches a `compiled` that was not regenerated).
//   VISIBLE     en dash, em dash, horizontal bar. Real typography, so prose may keep it (the operator's prose does); but in an OPTION LABEL, which `then`, tag `answers` and `issue_type_fees`
//               point at by its exact text, it is a second spelling of the hyphen the author types and a test hard-codes. Ruled mechanical on 2026-10-10 19:45 NY: none in a label.
//   CURLY       apostrophes and quotation marks in a label are the same hazard; NOT ruled, so FILED: the labels that still carry one are listed below (PENDING_DECISIONS #167 item 5), keyed by
//               their folded spelling, the list may only shrink, and a new label with one fails.
const INVISIBLE = /[ ­‐‑‒−﹘﹣－​-‍⁠﻿]/u;
const VISIBLE_DASH = /[–—―]/u;
const CURLY = /[‘’“”]/u;
const fold = x => x.normalize('NFKC').replace(/[‐-―−﹘﹣－]/gu, '-').replace(/[‘’]/gu, "'").replace(/[“”]/gu, '"').replace(/\s+/g, ' ').trim().toLowerCase();
const uplus = ch => 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
const FILED_CURLY = new Set([
    "appliance_type|not sure - i'll describe in the notes",
    "computer_symptom|battery won't charge or drains quickly",
    "computer_symptom|turns on but won't boot / stuck on loading",
    "computer_symptom|won't connect to wifi or internet",
    "computer_symptom|won't power on at all",
    "device_state|dead / won't power on",
    "ducting|no - it's recirculating (no duct)",
    "ducting|not sure - i'll describe in notes",
    "existing_box|no / i'm not sure (may need a new box)",
    "garbage_disposal_issue|won't drain (water stays inside)",
    "garbage_disposal_issue|won't spin / no movement",
    "generic_tech_symptom|won't connect to wifi, bluetooth, or an app",
    "generic_tech_symptom|won't power on",
    "leak_loc|not sure - i'll describe in notes",
    "network_symptom|can't connect new devices to the network",
    "network_symptom|won't power on or reboots constantly",
    "plumbing_fixture_issue|won't drain (water stays inside)",
    "smart_device_symptom|won't connect to wifi or the app",
    "smart_device_symptom|won't power on",
    "symptom|won't drain (water stays inside)",
    "symptom|won't spin / no movement",
    "window_ac_issue|won't turn on / fan won't spin",
]);
function optionLabels(D) {   // module options and the options a service's chain overrides in place
    const out = [];
    Object.entries(D.intake_modules).forEach(([id, m]) => (m.client_response || []).forEach((o, i) => out.push({ at: `intake_modules[${id}].client_response[${i}]`, module: id, label: String(o.label) })));
    const emb = (owner, ch) => (ch || []).forEach((c, i) => ((c && c.params && c.params.client_response) || []).forEach((o, j) => out.push({ at: `${owner}.intake_chain[${i}].params.client_response[${j}]`, module: (c && c.module) || '?', label: String(o.label) })));
    D.services.forEach(s => emb(`services[${s.id}]`, s.intake_chain));
    Object.entries(D.dynamic_services).forEach(([k, d]) => emb(`dynamic_services[${k}]`, d.intake_chain));
    return out;
}
function typography(D) {
    const labels = optionLabels(D), invisible = [], dashes = [], curly = [], collisions = [];
    labels.forEach(x => {
        const v = x.label.match(VISIBLE_DASH) || x.label.match(INVISIBLE);
        if (v) dashes.push({ at: x.at, what: `"${x.label}" holds ${uplus(v[0])}` });
        if (CURLY.test(x.label)) curly.push({ at: x.at, key: x.module + '|' + fold(x.label), what: `"${x.label}"` });
    });
    const seen = {};
    Object.entries(D.intake_modules).forEach(([id, m]) => (m.client_response || []).forEach(o => { const k = id + '|' + fold(String(o.label)); (seen[k] = seen[k] || []).push(o.label); }));
    Object.entries(seen).forEach(([k, v]) => { if (v.length > 1) collisions.push({ at: k.split('|')[0], what: JSON.stringify(v) }); });
    (function w(o, at) {
        if (typeof o === 'string') { const m = o.match(INVISIBLE); if (m) invisible.push({ at, what: `${uplus(m[0])} in "${o.slice(0, 50)}"` }); return; }
        if (o && typeof o === 'object') for (const k of Object.keys(o)) { const m = k.match(INVISIBLE); if (m) invisible.push({ at: at + '.' + k, what: `${uplus(m[0])} in the key "${k.slice(0, 50)}"` }); w(o[k], at + (Array.isArray(o) ? `[${k}]` : '.' + k)); }
    })(D, '');
    return { labels, invisible, dashes, curly, collisions };
}
const ty = typography(DB);
check('no INVISIBLE lookalike character (non-breaking hyphen, minus, soft hyphen, NBSP, zero-width ...) anywhere in the SSOT', ty.invisible.length === 0, { expected: 'none', got: ty.invisible.length + ': ' + brief(ty.invisible) });
check('no dash other than the ASCII hyphen-minus in any option label (module options and chain-embedded options)', ty.dashes.length === 0, { expected: 'none', got: ty.dashes.length + ': ' + brief(ty.dashes) });
check('no two options of a module differ only by typography (case, dash, apostrophe, space)', ty.collisions.length === 0, { expected: 'none', got: brief(ty.collisions) });
{ const now = new Set(ty.curly.map(x => x.key)), unlisted = [...now].filter(k => !FILED_CURLY.has(k)), stale = [...FILED_CURLY].filter(k => !now.has(k));
  check('curly apostrophes and quotes in labels: only the filed ones (#167 item 5; the list may only shrink)', unlisted.length === 0, { expected: 'no label outside the filed list', got: unlisted.join(' | ') });
  check('every label on the filed curly-apostrophe list still carries one (a fixed label leaves the list)', stale.length === 0, { expected: 'none stale', got: stale.join(' | ') }); }
check('the typography scan reaches the catalog it claims to (>= 450 module options, >= 60 chain-embedded options)', ty.labels.length >= 520 && ty.labels.filter(x => x.at.includes('.params.')).length >= 60, { expected: '>= 520 / 60', got: `${ty.labels.length} / ${ty.labels.filter(x => x.at.includes('.params.')).length}` });
{   // non-vacuity: the scan sees each planted defect in each place it claims to look, and passes the clean variant
    const plant = fn => { const d = clone(); fn(d); return typography(d); };
    const m0 = d => Object.values(d.intake_modules).find(m => (m.client_response || []).length >= 2);
    const base0 = typography(DB);
    const a = plant(d => { const m = m0(d); m.client_response[0].label = 'Yes‑no'; });
    check('(non-vacuity) a planted non-breaking hyphen in a module option label is seen as a label dash and as an invisible character', a.dashes.length === base0.dashes.length + 1 && a.invisible.length === base0.invisible.length + 1, { expected: '+1 / +1', got: `${a.dashes.length - base0.dashes.length} / ${a.invisible.length - base0.invisible.length}` });
    const b = plant(d => { const m = m0(d); m.client_response[0].label = 'Two – three'; });
    check('(non-vacuity) a planted en dash in a label is a label dash (and not an invisible character: it is visible)', b.dashes.length === base0.dashes.length + 1 && b.invisible.length === base0.invisible.length, { expected: '+1 / +0', got: `${b.dashes.length - base0.dashes.length} / ${b.invisible.length - base0.invisible.length}` });
    const c = plant(d => { d.services[0].name = 'Fix‑it'; });
    check('(non-vacuity) a planted non-breaking hyphen in a service name (not a label) is an invisible character and not a label dash', c.invisible.length === base0.invisible.length + 1 && c.dashes.length === base0.dashes.length, { expected: '+1 / +0', got: `${c.invisible.length - base0.invisible.length} / ${c.dashes.length - base0.dashes.length}` });
    const e = plant(d => { const dd = Object.values(d.dynamic_services).find(x => (x.intake_chain || []).some(ch => ch && ch.params && ch.params.client_response)); const ch = dd && dd.intake_chain.find(x => x && x.params && x.params.client_response); if (ch) ch.params.client_response[0].label = 'Plain — dash'; else d.services.forEach(s => (s.intake_chain || []).forEach(x => { if (x && x.params && x.params.client_response) x.params.client_response[0].label = 'Plain — dash'; })); });
    check('(non-vacuity) a planted em dash in a chain-embedded option label is seen (the scan reads past the module catalog)', e.dashes.length >= base0.dashes.length + 1, { expected: '>= +1', got: e.dashes.length - base0.dashes.length });
    const f = plant(d => { const m = m0(d); m.client_response[0].label = 'Brand-new it’s'; });
    check('(non-vacuity) a planted curly apostrophe in a new label is outside the filed list', f.curly.map(x => x.key).filter(k => !FILED_CURLY.has(k)).length === base0.curly.map(x => x.key).filter(k => !FILED_CURLY.has(k)).length + 1, { expected: '+1 unlisted', got: 'no change' });
    const g = plant(d => { const m = m0(d); m.client_response[1].label = m.client_response[0].label.toUpperCase().replace(/-/g, '–') + ' '; });
    check('(non-vacuity) two options that differ only by case, dash and a trailing space collide', g.collisions.length === base0.collisions.length + 1, { expected: '+1', got: g.collisions.length - base0.collisions.length });
    const h = plant(d => { const m = m0(d); m.client_response[0].label = 'Plain ASCII - label'; });
    check('(non-vacuity) a plain ASCII label with a spaced hyphen adds no finding of any kind', h.dashes.length === base0.dashes.length - (VISIBLE_DASH.test(m0(DB).client_response[0].label) || INVISIBLE.test(m0(DB).client_response[0].label) ? 1 : 0) && h.invisible.length <= base0.invisible.length, { expected: 'no new finding', got: JSON.stringify([h.dashes.length, h.invisible.length]) });
}

finish();
