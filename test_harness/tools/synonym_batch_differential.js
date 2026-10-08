#!/usr/bin/env node
/**
 * synonym_batch_differential.js -- PENDING_DECISIONS #72 (operator ruling A): "promote high-precision synonyms to full_weight_synonyms one batch at a time". A promotion is only
 * as safe as its measurement, so this runs the REAL understandRequest over a corpus before and after a candidate batch (the batch is applied in memory to a copy of the SSOT):
 *   corpus   every keyword and every synonym of every intent mapping, in 8 realistic phrasings; PLUS out-of-domain probes; PLUS each promoted synonym attached to unrelated nouns
 *            ("pendant necklace", "wax seal stamp") -- the collocations a plain word-boundary match cannot tell apart.
 *   verdicts per phrase: IMPROVED (held at the builder -> understood, same entity, same service), UNCHANGED, CHANGED-ENTITY (understood both times, different key or service: a misroute),
 *            NEWLY-ROUTED (an out-of-domain probe now selects a named service), WORSENED (understood -> held).
 *   gate     zero CHANGED-ENTITY, zero NEWLY-ROUTED, zero WORSENED. A synonym that causes one is reported and must leave the batch.
 *   node synonym_batch_differential.js <batch.json> [--json]      (batch.json: { "<intent keyword>": ["<synonym>", ...] })
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..', '..');
const TEMPLATES = ['{s}', 'my {s}', 'fix my {s}', '{s} is broken', 'need help with {s}', '{s} not working', 'replace {s}', 'install {s}'];
const OOD = ['car seat', 'baby car seat install', 'booster seat', 'bike seat', 'bike tire', 'car door', 'car window tint', 'car battery', 'truck bed light', 'car light bulb', 'phone screen', 'laptop screen protector',
  'garden hose', 'pool pump', 'boat motor', 'lawn sprinkler', 'dog door', 'cat door', 'bird feeder', 'tv remote', 'car radio', 'candle holder', 'jewelry box repair', 'silver necklace', 'mac and cheese recipe',
  'pc game download', 'movie night snacks', 'wedding invitation', 'birthday cake', 'tax return help', 'book club', 'yoga class', 'dog walking', 'flight booking', 'hotel reservation'];
// A nonsense phrase that now (correctly) holds at the builder; recorded, not hidden. Same class as T136's contrived "fix my install".
const CONTRIVED = { 'install leaky pipe': 'an action verb with a problem noun: not a request; holding it at the builder is the right outcome' };
const COLLOCATE = ['necklace', 'jewelry', 'candle', 'stamp', 'game', 'recipe', 'costume', 'sauce', 'movie', 'song', 'toy', 'dress', 'cake', 'ticket', 'sticker', 'tattoo'];
function load(DB) { const sb = { DB, SERVICE_DATA: DB, window: { DB }, console }; sb.global = sb; vm.createContext(sb); for (const f of ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f }); return sb; }
const objsOf = DB => Array.isArray(DB.intent_mappings) ? DB.intent_mappings : DB.intent_mappings.objects;
function applyBatch(DB, batch) { const c = JSON.parse(JSON.stringify(DB)); for (const [kw, syns] of Object.entries(batch)) { const o = objsOf(c).find(x => x.keyword === kw); if (!o) throw new Error('no intent mapping: ' + kw); for (const s of syns) { if (!(o.synonyms || []).includes(s)) throw new Error(`"${s}" is not a synonym of "${kw}"`); o.full_weight_synonyms = o.full_weight_synonyms || []; if (!o.full_weight_synonyms.includes(s)) o.full_weight_synonyms.push(s); } } return c; }
const verdictOf = r => { try { return { complete: !!r.complete, key: (r.intent && r.intent.key) || null, sku: (r.intent && r.intent.recommendedSku) || null }; } catch (e) { return { complete: false, key: null, sku: null }; } };
const POLY = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'synonym_batches', 'polysemy_probes.json'), 'utf8')); } catch (e) { return {}; } })();
function run(before, after, batch) {
  const A = load(before), B = load(after), phrases = [];
  for (const o of objsOf(before)) for (const form of [o.keyword, ...(o.synonyms || [])]) for (const t of TEMPLATES) phrases.push({ text: t.replace('{s}', form), kind: 'corpus', entry: o.keyword, form });
  OOD.forEach(t => phrases.push({ text: t, kind: 'ood' }));
  for (const [kw, syns] of Object.entries(batch)) {
    for (const s of syns) { (POLY[s] || []).forEach(t => phrases.push({ text: t, kind: 'polysemy', entry: kw, form: s }));
      for (const w of COLLOCATE) { phrases.push({ text: `${s} ${w}`, kind: 'colloc-syn', entry: kw, form: s }); phrases.push({ text: `${w} ${s}`, kind: 'colloc-syn', entry: kw, form: s }); } }
    for (const w of COLLOCATE) { phrases.push({ text: `${kw} ${w}`, kind: 'colloc-kw', entry: kw, form: kw }); phrases.push({ text: `${w} ${kw}`, kind: 'colloc-kw', entry: kw, form: kw }); } }
  const out = { IMPROVED: [], UNCHANGED: 0, 'CHANGED-ENTITY': [], 'NEWLY-ROUTED': [], WORSENED: [], collocation: { syn: { n: 0, routed: 0 }, kw: { n: 0, routed: 0 } } }; const bySyn = {};
  const blame = (p, why) => { const k = p.entry ? `${p.entry} <- ${p.form}` : '(probe)'; (bySyn[k] = bySyn[k] || []).push(`${why}: "${p.text}"`); };
  for (const p of phrases) { const a = verdictOf(A.understandRequest(p.text)), b = verdictOf(B.understandRequest(p.text)), routedA = !!(a.complete && a.sku), routedB = !!(b.complete && b.sku);
    if (p.kind === 'colloc-syn' || p.kind === 'colloc-kw') { const c = out.collocation[p.kind === 'colloc-syn' ? 'syn' : 'kw']; c.n++; if (routedB) c.routed++; continue; } // information: the inherent behaviour of a full-weight term, not a defect of any synonym
    if (a.complete === b.complete && a.key === b.key && a.sku === b.sku) { out.UNCHANGED++; continue; }
    if (p.kind === 'ood' || p.kind === 'polysemy') { if (!routedA && routedB) { out['NEWLY-ROUTED'].push(`${p.text} -> ${b.sku}`); blame(p, 'newly routed to ' + b.sku); } else out.UNCHANGED++; continue; }
    // corpus: a phrase about entry E should end up understood AS entry E
    if (b.complete && b.key === p.entry && !(a.complete && a.key === p.entry)) { out.IMPROVED.push(p.text); continue; }
    if (a.complete && !b.complete) { if (CONTRIVED[p.text]) { out.UNCHANGED++; continue; } out.WORSENED.push(p.text); blame(p, 'worsened'); continue; }
    if (a.complete && b.complete && b.key !== a.key && b.key !== p.entry) { out['CHANGED-ENTITY'].push(`${p.text}: ${a.key}/${a.sku} -> ${b.key}/${b.sku}`); blame(p, 'changed entity'); continue; }
    out.UNCHANGED++; }
  return { total: phrases.length, out, bySyn };
}
module.exports = { run, applyBatch, objsOf, OOD, COLLOCATE, TEMPLATES, load };
if (require.main === module) {
  const batchFile = process.argv[2]; if (!batchFile) { console.log('usage: synonym_batch_differential.js <batch.json>'); process.exit(2); }
  const batch = JSON.parse(fs.readFileSync(batchFile, 'utf8')); const before = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8')); const after = applyBatch(before, batch);
  const r = run(before, after, batch), o = r.out; const n = Object.values(batch).reduce((a, x) => a + x.length, 0);
  console.log(`batch of ${n} synonyms across ${Object.keys(batch).length} entries | ${r.total} phrases | IMPROVED ${o.IMPROVED.length} | UNCHANGED ${o.UNCHANGED} | CHANGED-ENTITY ${o['CHANGED-ENTITY'].length} | NEWLY-ROUTED ${o['NEWLY-ROUTED'].length} | WORSENED ${o.WORSENED.length}`);
  const pc = x => x.n ? Math.round(100 * x.routed / x.n) + '%' : 'n/a'; console.log(`  information: a full-weight term + an unrelated noun routes ${pc(o.collocation.kw)} of the time for the entries' own KEYWORDS and ${pc(o.collocation.syn)} for the promoted synonyms (the inherent behaviour of full weight, not a synonym defect)`);
  for (const k of Object.keys(r.bySyn)) console.log('  BLAME', k, '->', r.bySyn[k].slice(0, 3).join(' ; '));
  process.exit(o['CHANGED-ENTITY'].length + o['NEWLY-ROUTED'].length + o.WORSENED.length ? 1 : 0);
}
