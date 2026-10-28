#!/usr/bin/env node
/**
 * answer_space_diff.js -- the render/behaviour differential for a change to how a job is routed or held (T189, PENDING_DECISIONS #184; the "render differential" and "typed corpus" of its done-when).
 *
 *   node test_harness/tools/answer_space_diff.js capture <out.json> [--services a,b,c] [--phrases <file>]      (QR_ROOT=<tree> to measure another tree)
 *   node test_harness/tools/answer_space_diff.js compare <before.json> <after.json> [--new-question <module key>]
 *
 * capture   For each service named, walks EVERY state the customer can reach from the service's own tile, one tap at a time (each unanswered question on the card, each of its answers, to a bounded depth)
 *           and records, per state (service the job is in + the answers given): the labor, the minutes, the checkout state, whether the job is waiting on a routing question (triage), whether the price is held
 *           (guard), where it was moved from, and which questions are still open. With --phrases, also types each line of the file as free text and records the same facts.
 * compare   Between two captures (the tree before a change, and after). With --new-question, answers to that question are removed from the after-states before matching them to the before-states, and the
 *           states that carry it are counted as new: so a change that adds one question can be read as "what did it do to everything that is not the new question".
 *           Prints: states identical; states present in both with different values (field by field); states only before (the job is somewhere else, or waits); states only after; typed phrases changed.
 * It measures; it does not judge. The reader judges the differences against the change's declared effect.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.QR_ROOT ? path.resolve(process.env.QR_ROOT) : path.resolve(__dirname, '..', '..');

function load() {
  const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
  const sb = { DB, SERVICE_DATA: DB, window: { DB }, console: { log() {}, warn() {}, error() {}, info() {}, debug() {} } }; sb.global = sb; vm.createContext(sb);
  for (const f of ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
  sb.initNlpSets(); if (typeof sb.refreshNlpPreviewBindings === 'function') sb.refreshNlpPreviewBindings();
  return { DB, sb };
}
const facts = r => ({ labor: r.quote && r.quote.laborEstimate, mins: r.quote && r.quote.totalMin, state: r.quote && r.quote.checkoutStateKey, triage: !!r.triagePending, guard: !!r.guardPending, routedFrom: (r.routedFrom && r.routedFrom.fromServiceId) || null,
  open: (r.visibleChain || []).filter(m => !(r.answers || {})[m.moduleKey]).map(m => m.moduleKey).join(',') });
const keyOf = (tag, ent, answers) => tag + '|' + ent + '|' + JSON.stringify(Object.entries(answers || {}).sort());

function capture(out, services, phrases) {
  const { DB, sb } = load(), nodes = {}, typed = [];
  for (const id of services) {
    const s = DB.services.find(x => x.id === id); if (!s) throw new Error('no such service: ' + id);
    const c = sb.collectBookingContext_catalog(s, s.ui_taxonomy.category_id); c.answers = {};
    const seen = new Set();
    (function visit(r, depth) {
      const k = keyOf(id, r.entity && r.entity.id, r.answers); if (seen.has(k) || depth > 9) return; seen.add(k); nodes[k] = facts(r);
      for (const m of (r.visibleChain || []).filter(m => !(r.answers || {})[m.moduleKey])) for (const o of (m.client_response || [])) { let n; try { n = sb.orch_apply_answer(r, m.moduleKey, o.label, DB); } catch (e) { continue; } visit(n, depth + 1); }
    })(sb.executeWorkflow(c, DB), 0);
  }
  for (const phrase of phrases) { try { const c = sb.collectBookingContext_freeText(phrase); const r = sb.executeWorkflow(Object.assign({}, c, { tagsAffirmed: true }), DB); typed.push({ phrase, entity: r.entity && r.entity.id, answers: r.answers || {}, ...facts(r) }); } catch (e) { typed.push({ phrase, error: String(e.message) }); } }
  fs.writeFileSync(out, JSON.stringify({ root: ROOT, services, nodes, typed }, null, 0));
  console.log(`captured ${Object.keys(nodes).length} states for ${services.length} service(s) and ${typed.length} typed phrase(s) -> ${out}`);
}

function compare(a, b, newQ) {
  const A = JSON.parse(fs.readFileSync(a, 'utf8')), B = JSON.parse(fs.readFileSync(b, 'utf8'));
  const after = new Map(), withNew = [], continuedAs = new Map();
  for (const [k, v] of Object.entries(B.nodes)) {
    const [tag, ent, json] = [k.split('|')[0], k.split('|')[1], k.split('|').slice(2).join('|')]; const ans = JSON.parse(json);
    const stripped = ans.filter(([q]) => q !== newQ); if (newQ && stripped.length !== ans.length) { withNew.push(k); const sk = keyOf(tag, ent, Object.fromEntries(stripped)); continuedAs.set(sk, (continuedAs.get(sk) || 0) + 1); continue; }
    after.set(keyOf(tag, ent, Object.fromEntries(stripped)), v);
  }
  let same = 0; const changed = [], gone = [], fieldCounts = {};
  for (const [k, v] of Object.entries(A.nodes)) {
    const w = after.get(k); if (!w) { gone.push(k); continue; }
    const d = Object.keys(v).filter(f => JSON.stringify(v[f]) !== JSON.stringify(w[f])); if (!d.length) { same++; continue; }
    changed.push({ k, d }); d.forEach(f => { const s = `${f}: ${JSON.stringify(v[f])} -> ${JSON.stringify(w[f])}`; fieldCounts[s] = (fieldCounts[s] || 0) + 1; });
  }
  const beforeKeys = new Set(Object.keys(A.nodes)); const onlyAfter = [...after.keys()].filter(k => !beforeKeys.has(k));
  console.log(`states before ${Object.keys(A.nodes).length}, after ${Object.keys(B.nodes).length}${newQ ? ` (${withNew.length} of them carry an answer to ${newQ})` : ''}`);
  console.log(`  identical: ${same}`); console.log(`  present in both, different: ${changed.length}`); Object.entries(fieldCounts).forEach(([s, n]) => console.log(`    ${String(n).padStart(4)}  ${s}`));
  const lost = gone.filter(k => !continuedAs.has(k));
  console.log(`  only before (the job is elsewhere, or waits, after the change): ${gone.length}`);
  if (newQ) console.log(`      of which continue after the change as states that carry ${newQ}: ${gone.length - lost.length}; reachable no other way: ${lost.length}${lost.length ? '   <-- a state the customer could reach before and cannot now' : ''}`); console.log(`  only after (not carrying ${newQ || 'a new answer'}): ${onlyAfter.length}`);
  const byClass = {}; for (const k of gone) { const [tag, ent, json] = [k.split('|')[0], k.split('|')[1], k.split('|').slice(2).join('|')]; const a2 = Object.fromEntries(JSON.parse(json)); const c = `${tag}>${ent} | ${Object.keys(a2).sort().join(',')}`; byClass[c] = (byClass[c] || 0) + 1; }
  Object.entries(byClass).sort((x, y) => y[1] - x[1]).slice(0, 12).forEach(([c, n]) => console.log(`      ${String(n).padStart(4)}  ${c}`));
  const typedChanged = []; (A.typed || []).forEach((t, i) => { const u = (B.typed || [])[i]; if (!u) return; const f = x => JSON.stringify([x.entity, x.labor, x.mins, x.state, x.triage, x.routedFrom, x.answers]); if (f(t) !== f(u) || t.guard !== u.guard) typedChanged.push(`${JSON.stringify(t.phrase)}: ${t.entity} ${t.labor}/${t.mins}${t.guard ? ' held' : ''} -> ${u.entity} ${u.labor}/${u.mins}${u.guard ? ' held' : ''}`); });
  console.log(`typed phrases: ${(A.typed || []).length}, changed: ${typedChanged.length}`); typedChanged.forEach(s => console.log('    ' + s));
}

const [cmd, ...rest] = process.argv.slice(2);
const opt = n => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : null; };
if (cmd === 'capture' && rest[0]) capture(rest[0], (opt('--services') || '').split(',').filter(Boolean), opt('--phrases') ? fs.readFileSync(opt('--phrases'), 'utf8').split('\n').map(s => s.trim()).filter(Boolean) : []);
else if (cmd === 'compare' && rest[0] && rest[1]) compare(rest[0], rest[1], opt('--new-question'));
else { console.error('usage: answer_space_diff.js capture <out.json> --services a,b [--phrases file]  |  compare <before.json> <after.json> [--new-question key]'); process.exit(2); }
