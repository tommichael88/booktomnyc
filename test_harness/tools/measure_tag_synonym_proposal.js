#!/usr/bin/env node
/**
 * measure_tag_synonym_proposal.js -- PENDING_DECISIONS #177: what would the proposed tag synonyms change? A read-only measurement, not a test: it writes nothing and exits 0.
 *
 *   node test_harness/tools/measure_tag_synonym_proposal.js [proposal.json]
 *
 * Reads synonym_batches/tag_synonyms_T169_proposal.json (or the file named), applies each tag's `final_synonyms` (or `final_synonyms_if_approved`, for the tags marked HOLD) IN
 * MEMORY to a copy of btnyc.json, and runs detectTagsNLP before and after over (a) every phrase the catalog itself contains (service names, descriptions, aliases, group and
 * category text, intent keywords and synonyms, every module question and answer, dynamic-service text) and (b) the proposal's own probe sentences.
 *
 * It reports, per tag: the catalog phrases that would newly find the tag (the corpus is the catalog's own wording; there is no customer-language corpus in the repository,
 * R-SYSTEM-NODATA), the phrases that would LOSE a tag (adding any synonym to a tag drops the id-phrase it was matched on until then, so a loss is a list missing its id-phrase),
 * any other tag that gained a hit, and how each probe sentence changes. `demos` (in the proposal file) are REJECTED candidates applied one at a time, each in its own world, only to
 * show why they were rejected. Approval of a proposal is a ssot_patch.js `set` of smart_tags.<tag>.synonyms; after it, this tool
 * reports "0 new" for that tag, because the catalog already says it.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..', '..');
const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
const PROPOSAL_FILE = process.argv[2] || path.join(__dirname, 'synonym_batches', 'tag_synonyms_T169_proposal.json');
const P = JSON.parse(fs.readFileSync(PROPOSAL_FILE, 'utf8'));
const clone = o => JSON.parse(JSON.stringify(o));
function engine(db) {
    const sb = { DB: db, SERVICE_DATA: db, window: { DB: db }, console: { log() {}, warn() {}, error() {}, info() {}, debug() {} } }; sb.global = sb; vm.createContext(sb);
    for (const f of ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
    if (typeof sb.initNlpSets === 'function') { sb.initNlpSets(); if (typeof sb.refreshNlpPreviewBindings === 'function') sb.refreshNlpPreviewBindings(); }
    return sb;
}
const corpus = new Set(); const add = x => { if (typeof x === 'string' && x.trim().length > 2) corpus.add(x.trim()); };
for (const s of DB.services) { add(s.ui_taxonomy.display_name); add(s.ui_taxonomy.description); (s.aliases || []).forEach(add); add(s.description); add(s.id.replace(/_/g, ' ')); }
(DB.group || []).forEach(g => { add(g.display_name); add(g.description); }); (DB.category || []).forEach(g => { add(g.display_name); add(g.description); });
const objs = Array.isArray(DB.intent_mappings) ? DB.intent_mappings : ((DB.intent_mappings || {}).objects || []);
objs.forEach(o => { add(o.keyword); (o.synonyms || []).forEach(add); });
for (const m of Object.values(DB.intake_modules)) { add(m.question); (m.client_response || []).forEach(o => add(o.label)); }
for (const d of Object.values(DB.dynamic_services || {})) { add(d.display_name); add(d.description); }

const after = clone(DB), applied = {};
for (const [tag, e] of Object.entries(P.tags)) {
    const list = e.final_synonyms_if_approved || e.final_synonyms || [];
    if (!list.length) continue;
    if (!after.smart_tags[tag]) { console.log(`  ! ${tag}: not a tag in the catalog`); continue; }
    after.smart_tags[tag].synonyms = list.slice(); applied[tag] = list;
}
const A = engine(DB), B = engine(after);
console.log(`[tag synonym proposal] ${Object.keys(P.tags).length} tags; ${Object.keys(applied).length} carry a list to apply; corpus ${corpus.size} catalog phrases + ${(P._probes || []).length} probe sentences`);
const gained = {}, lost = {};
for (const p of corpus) {
    let a, b; try { a = A.detectTagsNLP(p).found; b = B.detectTagsNLP(p).found; } catch (e) { continue; }
    b.filter(t => !a.includes(t)).forEach(t => (gained[t] = gained[t] || []).push(p));
    a.filter(t => !b.includes(t)).forEach(t => (lost[t] = lost[t] || []).push(p));
}
const sh = l => l.slice(0, 8).map(x => `"${x.slice(0, 64)}"`).join(' | ') + (l.length > 8 ? ` | ... (+${l.length - 8})` : '');
for (const [tag, e] of Object.entries(P.tags)) {
    const list = applied[tag];
    console.log(`\n${tag}  [${e.recommend}]${list ? '  applying ' + JSON.stringify(list) : '  nothing to apply'}`);
    if (!list) continue;
    const g = gained[tag] || [], l = lost[tag] || [];
    console.log(`   newly found on ${g.length} catalog phrase(s)${g.length ? ': ' + sh(g) : ''}`);
    console.log(`   tag LOST on ${l.length} catalog phrase(s)${l.length ? ': ' + sh(l) : ''}`);
}
const others = Object.keys(gained).filter(t => !applied[t]), losers = Object.keys(lost).filter(t => !applied[t]);
console.log(`\nother tags that gained a hit: ${others.length ? others.join(', ') : 'none'}; other tags that lost one: ${losers.length ? losers.join(', ') : 'none'}`);
console.log('\nprobe sentences (tags found: before -> after; only the tags this proposal touches are marked *):');
for (const s of P._probes || []) {
    const a = A.detectTagsNLP(s).found, b = B.detectTagsNLP(s).found; const mark = t => (applied[t] ? '*' : '') + t;
    console.log(`   ${JSON.stringify(a.map(mark)) === JSON.stringify(b.map(mark)) ? ' ' : '~'} "${s}": ${JSON.stringify(a)} -> ${JSON.stringify(b.map(mark))}`);
}

// the rejected candidates, each in its own world, to show the reason on the same corpus and probes
for (const d of P.demos || []) {
    const w = clone(DB); w.smart_tags[d.tag].synonyms = d.synonyms.slice(); const W = engine(w);
    const g = [...corpus].filter(p => { try { return W.detectTagsNLP(p).found.includes(d.tag) && !A.detectTagsNLP(p).found.includes(d.tag); } catch (e) { return false; } });
    console.log(`\nREJECTED, applied only to show why: ${d.tag} <- ${JSON.stringify(d.synonyms)}  (${d.why})`);
    console.log(`   newly found on ${g.length} catalog phrase(s)${g.length ? ': ' + sh(g) : ''}`);
    for (const s of d.probes || []) console.log(`     "${s}": ${JSON.stringify(A.detectTagsNLP(s).found)} -> ${JSON.stringify(W.detectTagsNLP(s).found)}`);
}
