#!/usr/bin/env node
/**
 * verify_synonym_promotion_safety.js
 *
 * PENDING_DECISIONS #72 (operator ruling A, T147): a phrase that matches only a SYNONYM scores at half weight, so about a quarter of realistic single-object phrases open the
 * guided builder instead of a result. Lowering the bar would send "car seat" to Toilet Seat Replacement on an uncertainty-retirement model, so the ruling is to promote the
 * high-precision synonyms to `full_weight_synonyms`, ONE BATCH AT A TIME, each batch measured. This test is what makes the next batch safe:
 *   1. every promoted synonym is a real synonym of its own entry and owned by exactly ONE entry (no cross-entry ambiguity);
 *   2. the HELD list -- synonyms judged too generic, polysemous, a verb, or a different job -- is explicit, each with its reason, and none of it may be promoted without
 *      leaving the list (the judgment is on the record; the list may only shrink);
 *   3. PROMOTION WORKS: "fix my <synonym>" is understood as the synonym's own entry, for every promoted synonym (non-vacuity);
 *   4. NOTHING OUT OF DOMAIN ROUTES: the out-of-domain probes and each synonym's curated polysemy probes ("mac and cheese recipe", "silver pendant") select no named service;
 *   5. the batch's own differential is re-run on every run: strip batch 1 from this SSOT, and the real understandRequest must show zero changed entities, zero newly-routed probes.
 * Measured at the public boundary (understandRequest), no helper named (R-GOVERN-GOODHART).
 */
'use strict';
const fs = require('fs'), path = require('path');
const { check, finish } = require('./_shared.js');
const D = require('./tools/synonym_batch_differential.js');
const ROOT = path.resolve(__dirname, '..');
const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8')); const objs = D.objsOf(DB);
const BATCH1 = JSON.parse(fs.readFileSync(path.join(__dirname, 'tools', 'synonym_batches', 'batch1.json'), 'utf8'));
const POLY = JSON.parse(fs.readFileSync(path.join(__dirname, 'tools', 'synonym_batches', 'polysemy_probes.json'), 'utf8'));

// ---- the HELD list: judged by hand in T147, with the reason. May only shrink; to promote one, remove it here WITH its justification and run the batch differential. ----
const HELD = [
 ['backup', 'transfer data', 'recovery and transfer are different jobs from backup'], ['backup', 'data recovery', 'a different (specialist) job'], ['backup', 'recover data', 'a different job'], ['backup', 'lost files', 'a recovery problem, not a backup'],
 ['baseboard', 'crown moulding', 'ceiling trim: a different job'], ['baseboard', 'trim', 'generic: door and window trim'], ['baseboard', 'molding', 'generic: crown, door, window'],
 ['brick', 'mortar', 'a material, not the object'], ['cabinet', 'pantry', 'a room or closet, not a cabinet'],
 ['curtain rod', 'rod', 'generic: shower rod, closet rod'], ['curtain rod', 'curtains', 'the covering, not the rod'], ['curtain rod', 'drapes', 'the covering, not the rod'], ['curtain rod', 'blind', 'a separate service; "blind spot"'], ['curtain rod', 'shades', 'a separate service; sunglasses'],
 ['deadbolt', 'lock', 'generic: padlock, bike lock, car lock'], ['door', 'entry', 'generic: entry level, entry form'],
 ['faucet', 'tap', 'homonym: tap water, tap to pay'], ['faucet', 'basin', 'toilet or wash basin'],
 ['furniture', 'table', 'generic token: data table'], ['furniture', 'desk', 'generic token: help desk'], ['garbage disposal', 'disposal', 'generic: waste or junk disposal'],
 ['mount', 'hung', 'a verb, not an object name'], ['mount', 'attach', 'a verb'], ['mount', 'attached', 'a verb'], ['mount', 'affix', 'a verb'],
 ['organize', 'clean wires', 'a description, not a name'], ['other', 'other', 'the meta entry'], ['other', 'misc', 'the meta entry'], ['other', 'odd job', 'the meta entry'],
 ['outlet', 'socket', 'a light socket is a different job'], ['slow drain', 'clog', 'toilet vs drain vs gutter'], ['slow drain', 'clogged', 'toilet vs drain vs gutter'], ['slow drain', 'unclog', 'toilet vs drain vs gutter'],
 ['software', 'program', 'TV program; program a thermostat'], ['stove', 'burner', 'water-heater burner; burner phone'], ['thermostat', 'nest', 'Nest speakers and cameras'],
 ['tile', 'ceramic', 'ceramic mugs, sinks'], ['tile', 'porcelain', 'porcelain sinks and toilets'], ['tile', 'subway', 'subway trains'],
 ['virus', 'pop ups', 'pop-up tents and stores'], ['water line', 'ice maker', 'ice maker repair is a refrigerator job'],
 ['leak', 'leaky pipe', 'GATE: promotion does not promote -- "fix my leaky pipe" stays held by the object-grounding rule, and "install leaky pipe" worsened'],
 ['computer', 'mac', 'GATE: "mac and cheese recipe" newly routed to a computer service'], ['chandelier', 'pendant', 'GATE: "silver pendant" newly routed (jewellery)'], ['light fixture', 'sconce', 'GATE: "candle sconce" newly routed (decorative)'],
];
const find = kw => objs.find(o => o.keyword === kw);

// 1. every promoted synonym is the entry's own, and owned by exactly one entry
const promoted = []; objs.forEach(o => (o.full_weight_synonyms || []).forEach(s => promoted.push([o.keyword, s])));
const owner = {}; objs.forEach(o => [o.keyword, ...(o.synonyms || [])].forEach(t => { (owner[t.toLowerCase()] = owner[t.toLowerCase()] || new Set()).add(o.keyword); }));
const notOwn = promoted.filter(([k, s]) => !(find(k).synonyms || []).includes(s)), shared = promoted.filter(([k, s]) => (owner[s.toLowerCase()] || new Set()).size > 1);
check(`every promoted synonym is a real synonym of its own entry and owned by exactly ONE entry (${promoted.length} promoted across ${new Set(promoted.map(p => p[0])).size} entries)`, notOwn.length === 0 && shared.length === 0 && promoted.length >= 40, { expected: '0 foreign, 0 shared, >= 40 promoted', got: { notOwn, shared, n: promoted.length } });
// 2. the held list
const promotedSet = new Set(promoted.map(([k, s]) => k + '|' + s)), heldPromoted = HELD.filter(([k, s]) => promotedSet.has(k + '|' + s)), heldStale = HELD.filter(([k, s]) => !(find(k) && (find(k).synonyms || []).includes(s)));
check(`none of the ${HELD.length} HELD synonyms (generic, polysemous, verbs, different jobs -- each with its reason) is promoted; the list only shrinks`, heldPromoted.length === 0, { expected: 0, got: heldPromoted });
check('every HELD entry still names a real synonym (the list is not stale)', heldStale.length === 0, { expected: 0, got: heldStale });
// 3. promotion works (non-vacuity), through the public boundary
const sb = D.load(DB), notUnderstood = [];
for (const [k, syns] of Object.entries(BATCH1)) for (const s of syns) { const r = sb.understandRequest(`fix my ${s}`); if (!(r.complete && r.intent && r.intent.key === k)) notUnderstood.push(`${s} -> ${r.complete}/${r.intent && r.intent.key}`); }
const nB1 = Object.values(BATCH1).reduce((a, x) => a + x.length, 0);
check(`PROMOTION WORKS: "fix my <synonym>" is understood as the synonym's own entry for all ${nB1} batch-1 synonyms`, notUnderstood.length === 0 && nB1 >= 25, { expected: 0, got: notUnderstood });
// 4. nothing out of domain routes to a named service
const probes = [...D.OOD, ...Object.entries(POLY).filter(([k]) => !k.startsWith('_')).flatMap(([, v]) => v)];
// PRE-EXISTING misroutes this probe list found at T147, independent of any promotion (they route identically before batch 1; PENDING_DECISIONS #101). Frozen: the list may only shrink.
const KNOWN_ROUTED = ['car light bulb', 'phone screen', 'laptop screen protector'];
const routed = probes.filter(t => { const v = sb.understandRequest(t); return v.complete && v.intent && v.intent.recommendedSku; }).filter(t => !KNOWN_ROUTED.includes(t));
check(`no out-of-domain or polysemy probe selects a named service beyond the ${KNOWN_ROUTED.length} known pre-existing misroutes (${probes.length} probes: car seat, "mac and cheese recipe", "silver pendant", "candle sconce", ...)`, routed.length === 0 && probes.length >= 50, { expected: 0, got: routed });
const fixedNow = KNOWN_ROUTED.filter(t => { const v = sb.understandRequest(t); return !(v.complete && v.intent && v.intent.recommendedSku); });
check('the known-misroute list only shrinks: each entry still routes today (delete an entry the moment it is fixed)', fixedNow.length === 0, { expected: 0, got: fixedNow });
// 5. the batch's own differential, re-run: strip batch 1 from this SSOT and compare with the real thing
const stripped = JSON.parse(JSON.stringify(DB)); for (const [k, syns] of Object.entries(BATCH1)) { const o = D.objsOf(stripped).find(x => x.keyword === k); o.full_weight_synonyms = (o.full_weight_synonyms || []).filter(s => !syns.includes(s)); if (!o.full_weight_synonyms.length) delete o.full_weight_synonyms; }
const r = D.run(stripped, DB, BATCH1), o = r.out;
check(`the batch-1 differential, re-run on every run: ${o.IMPROVED.length} phrases improved, 0 changed entity, 0 newly routed, 0 worsened (${r.total} phrases)`, o.IMPROVED.length >= 150 && o['CHANGED-ENTITY'].length === 0 && o['NEWLY-ROUTED'].length === 0 && o.WORSENED.length === 0, { expected: '>= 150 improved, 0 / 0 / 0', got: { improved: o.IMPROVED.length, changed: o['CHANGED-ENTITY'].slice(0, 3), routed: o['NEWLY-ROUTED'].slice(0, 3), worse: o.WORSENED.slice(0, 3) } });
finish('synonym promotion is measured, one batch at a time (#72)');
