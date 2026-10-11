#!/usr/bin/env node
/**
 * measure_tag_rules_gateways.js -- PENDING_DECISIONS #166 / #178: do two customers with the same facts reach the same result whether the tag rules are applied (the guided builder) or not
 * (the free-text and state paths)? A read-only measurement, not a test: it changes nothing and exits 0. T169 ran it and the answer is NO (#178); it is kept so the fix session starts
 * from a number, and so the fix can be shown to take every cell below to "same".
 *
 *   node test_harness/tools/measure_tag_rules_gateways.js [--sentences]
 *
 * THE QUESTION. The SSOT's tag rules (the default tag of a display group, mutual exclusion between tags, a negation that dies when an exclusive sibling is active) are applied by ONE gateway,
 * the guided builder: sqBuildStep3 -> applySSOTRules -> resolveTagRules. The free-text route (executeWorkflow) and the state path (computeQuoteFromState) price from the raw tag sets. So the
 * question reduces to: for the same facts, does resolveTagRules change anything that is priced or shown?
 *
 * THE FACTS. Every entity (the 82 dynamic services, which are the guided builder's own entities, and the 76 named services, reached by a catalog tap or by free text) crossed with the tags
 * the customer holds: none, each tag valid for the entity's category and group, each PAIR of them. Two ways of holding them, because they are not equally reachable:
 *   tapped  the customer taps chips. toggleTagState removes a mutually exclusive sibling, so two exclusive tags are never held; only non-exclusive pairs are generated.
 *   typed   one sentence names both ("a leaky faucet and a clogged drain"): the detector finds both, and an exclusive pair IS held. Every pair is generated.
 * A named service is a curated session, which skips the group default (resolveTagRules: `if (curatedMode) return`); it is judged on exclusion only.
 *
 * THE COMPARISON. price = computeQuoteFromState on the raw sets (what the free-text and state paths charge) against the same state after resolveTagRules (exactly what applySSOTRules
 * stores). Reported separately: the price (laborCalc, extraFee, totalMin, tier, checkout state, bar verdict) and the tags in force.
 *
 * `--sentences` also drives ordinary sentences end to end: the real collectBookingContext_freeText + executeWorkflow against the builder's sequence (resolveBuilderTags ->
 * resolveTagRules -> computeQuoteFromState) on the entity the words resolve to.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..', '..');
const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
const sb = { DB, SERVICE_DATA: DB, window: { DB }, console: { log() {}, warn() {}, error() {}, info() {}, debug() {} } }; sb.global = sb; vm.createContext(sb);
for (const f of ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
if (typeof sb.initNlpSets === 'function') { sb.initNlpSets(); if (typeof sb.refreshNlpPreviewBindings === 'function') sb.refreshNlpPreviewBindings(); }

const TAGIDS = Object.keys(DB.smart_tags).filter(k => k.startsWith('#'));
const refOf = r => (r && typeof r === 'object' && r.$ref) ? r.$ref : r;
const excl = (a, b) => (DB.smart_tags[a].mutually_exclusive || []).map(refOf).includes(b) || (DB.smart_tags[b].mutually_exclusive || []).map(refOf).includes(a);
const mk = (e, over) => Object.assign({ qty: 1, answers: {}, detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: [], userTagIds: [], _tagsAffirmed: true, _curatedMode: e.kind === 'named' }, e.base, over || {});
const ents = [];
for (const s of DB.services) ents.push({ id: s.id, kind: 'named', cat: s.ui_taxonomy.category_id, grp: s.ui_taxonomy.group_id, svc: s,
    base: { intent: { key: s.id, category: s.ui_taxonomy.category_id, label: s.ui_taxonomy.display_name, qtyLabel: 'item', _groupId: s.ui_taxonomy.group_id }, stype: 'Repair', inherentTagIds: (s.default_tags || []).map(refOf).filter(t => typeof t === 'string') } });
for (const k of Object.keys(DB.dynamic_services)) {
    const p = k.split('+'), stype = p[p.length - 1], cat = p[0], grp = p.length === 3 ? p[1] : null;
    ents.push({ id: 'dyn:' + k, kind: 'dynamic', cat, grp, svc: null, base: { intent: { key: 'x', category: cat, label: 'x', qtyLabel: 'item', _groupId: grp, stype }, stype } });
}
const validFor = e => TAGIDS.filter(t => { try { return sb.tagValidForCategory(t, e.cat, e.grp); } catch (x) { return false; } });
const quote = (st, e) => { const r = sb.computeQuoteFromState(Object.assign({}, JSON.parse(JSON.stringify(st)), { _svc: e.svc })); return { labor: r.laborCalc, extra: r.extraFee, min: r.totalMin, tier: r.complexityTier, state: r.checkoutStateKey, meets: r.meetsConfidenceBar, tags: (r.activeTagIds || []).slice().sort() }; };
const num = p => JSON.stringify({ labor: p.labor, extra: p.extra, min: p.min, tier: p.tier, state: p.state, meets: p.meets });
const withRules = st => { const r = sb.resolveTagRules({ category: st.intent.category, groupId: st.intent._groupId, curatedMode: st._curatedMode, detTagIds: st.detTagIds, manTagIds: st.manTagIds, userTagIds: st.userTagIds, negatedTagIds: st.negatedTagIds }); return Object.assign({}, st, { detTagIds: r.detTagIds, manTagIds: r.manTagIds, userTagIds: r.userTagIds, negatedTagIds: r.negatedTagIds }); };

const cls = {}, situations = new Map();
let cells = 0;
for (const e of ents) {
    const v = validFor(e), sets = { typed: [[]], tapped: [[]] };
    v.forEach(a => { sets.typed.push([a]); sets.tapped.push([a]); });
    for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) { sets.typed.push([v[i], v[j]]); if (!excl(v[i], v[j])) sets.tapped.push([v[i], v[j]]); }
    for (const how of ['typed', 'tapped']) for (const S of sets[how]) {
        const raw = mk(e, how === 'typed' ? { detTagIds: S.slice() } : { manTagIds: S.slice() }), after = withRules(raw);
        const free = quote(raw, e), built = quote(after, e); cells++;
        const held = raw.detTagIds.concat(raw.manTagIds), kept = after.detTagIds.concat(after.manTagIds);
        const added = kept.filter(t => !held.includes(t)), removed = held.filter(t => !kept.includes(t));
        const rule = added.length && removed.length ? 'default + exclusion' : added.length ? 'group default' : removed.length ? 'exclusion' : 'no rule fired';
        const priceDiffers = num(free) !== num(built), tagsDiffer = JSON.stringify(free.tags) !== JSON.stringify(built.tags);
        const k = `${e.kind} | ${how} | ${rule} | ${priceDiffers ? 'PRICE DIFFERS' : tagsDiffer ? 'tags differ, same price' : 'same'}`;
        cls[k] = (cls[k] || 0) + 1;
        if (priceDiffers) { const key = `${e.kind} | ${how} | ${rule} | held ${S.join(' + ')} | rules added ${added.join(',') || '-'} removed ${removed.join(',') || '-'}`;
            if (!situations.has(key)) situations.set(key, []); situations.get(key).push({ e: e.id, dl: built.labor - free.labor, dm: built.min - free.min }); }
    }
}
const sum = pred => Object.entries(cls).filter(([k]) => pred(k)).reduce((a, [, v]) => a + v, 0);
console.log(`[tag rules across gateways] ${ents.length} entities (${ents.filter(e => e.kind === 'dynamic').length} dynamic, ${ents.filter(e => e.kind === 'named').length} named), ${cells} fact sets`);
Object.entries(cls).sort().forEach(([k, v]) => console.log(`  ${String(v).padStart(6)}  ${k}`));
console.log(`  no rule fired: ${sum(k => /no rule fired/.test(k))} fact sets, ${sum(k => /no rule fired/.test(k) && !/same$/.test(k))} differ`);
console.log(`  a rule fired:  ${sum(k => !/no rule fired/.test(k))} fact sets: price differs in ${sum(k => /PRICE DIFFERS/.test(k))}, only the tags shown differ in ${sum(k => /tags differ/.test(k))}`);
console.log(`\n  ${situations.size} distinct tag situations move the price (labor delta = the builder's minus the free-text/state path's):`);
[...situations.entries()].sort((a, b) => b[1].length - a[1].length).forEach(([k, l]) => console.log(`  ${String(l.length).padStart(4)}x  ${k}  | labor ${[...new Set(l.map(x => x.dl))].sort((a, b) => a - b).join(', ')} | minutes ${[...new Set(l.map(x => x.dm))].sort((a, b) => a - b).join(', ')} | e.g. ${l.slice(0, 2).map(x => x.e).join(', ')}`));

if (process.argv.includes('--sentences')) {
    // Ordinary sentences, end to end. FREE-TEXT is the real front door (collectBookingContext_freeText + executeWorkflow, the customer having affirmed the tags the words detected). BUILDER is
    // the guided builder's sequence on the entity the words resolve to: the tags the words earn (resolveBuilderTags), then the SSOT's tag rules (resolveTagRules), then the state path's
    // quote. The tags printed are what the rules ADDED or REMOVED, which is the part of the difference the rules cause (the two paths also list inherent tags differently, which is not a rule).
    const SENT = ['patch a hole in a brick wall and a plaster wall', 'virus on my laptop and I need data recovery', 'very high ceiling light fixture replacement', 'clogged drain and a leaky faucet',
        'my toilet keeps running and the kitchen faucet leaks', 'replace a light fixture on a high ceiling', 'hang a mirror'];
    console.log('\n  ordinary sentences, end to end:');
    for (const text of SENT) {
        const ctx = sb.collectBookingContext_freeText(text);
        const route = sb.executeWorkflow(Object.assign({}, ctx, { tagsAffirmed: true, manuallyToggledTagIds: (ctx.detectedTagIds || []).slice() }), DB);
        const ent = route.entity; if (!ent || !ent.id) { console.log(`   "${text}" -> no named service; skipped (the builder enters through a group the customer picks)`); continue; }
        const cat = ent.ui_taxonomy.category_id, grp = ent.ui_taxonomy.group_id;
        const bt = sb.resolveBuilderTags({ desc: text, category: cat, groupId: grp, sizeHint: null, manTagIds: [], userTagIds: [] });
        const e = { kind: 'named', svc: ent, base: { intent: { key: ent.id, category: cat, _groupId: grp, label: 'x', qtyLabel: 'item' }, stype: ent.service_type || 'Repair', inherentTagIds: (ent.default_tags || []).map(refOf) } };
        const st = mk(e, { detTagIds: bt.detTagIds.slice(), negatedTagIds: bt.negatedTagIds.slice() }), after = withRules(st);
        const held = st.detTagIds.concat(st.manTagIds), kept = after.detTagIds.concat(after.manTagIds);
        const f = route.quote || {}, b = quote(after, e);
        console.log(`   "${text}" -> ${ent.id}\n       free-text: labor ${f.laborEstimate}, ${f.totalMin} min | builder: labor ${b.labor}, ${b.min} min | the rules removed ${JSON.stringify(held.filter(t => !kept.includes(t)))} added ${JSON.stringify(kept.filter(t => !held.includes(t)))} | ${f.laborEstimate === b.labor && f.totalMin === b.min ? 'same' : 'DIFFERENT'}`);
    }
}
