#!/usr/bin/env node
/**
 * T164 (item G): did anything the customer is quoted move?  Key-by-key diff of computeQuoteFromState's whole result,
 * for the four services G gave an empty intake chain, between the tree before G and the tree after it.
 *
 *   node archive/T164_G_result_key_diff.js <root_before> <root_after>
 *
 * A root is a directory holding btnyc.json and the generated pricing_engine.js, nlp_engine.js, orchestrator_engine.js
 * (the repo root is one; the tree before G is `git archive 0b89edf` plus `node test_harness/extract_modules.js` inside it).
 * 4 services x 4 tag states (none / detected / chosen / detected+affirmed) x 4 quantities = 64 states.
 * It reports, per key of the result, in how many states the two trees differ, and checks the named price-bearing keys.
 */
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
function load(root) {
  const DB = JSON.parse(fs.readFileSync(path.join(root, 'btnyc.json'), 'utf8'));
  const sb = { DB, SERVICE_DATA: DB, window: { DB }, console }; sb.global = sb; vm.createContext(sb);
  for (const f of ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sb, { filename: f });
  return { DB, sb };
}
const [rootA, rootB] = process.argv.slice(2);
if (!rootA || !rootB) { console.error('usage: T164_G_result_key_diff.js <root_before> <root_after>'); process.exit(2); }
const pre = load(rootA), post = load(rootB);
const SERVICES = ['microwave_setup', 'washer_install', 'dishwasher_install', 'refrigerator_install'];
// The result's price-bearing keys: the labor, the dispatch fee, the minutes, the fee lines, the tier, the checkout state, the base.
const PRICE_KEYS = ['laborCalc', 'dispatchFee', 'totalMin', 'feeBreakdown', 'tierKey', 'tierRate', 'checkoutStateKey', 'checkoutStateSource', 'base', 'laborWithTags', 'divergenceTerms', 'isDiagnostic', 'isProject', 'hideTime'];
const keyDiff = {}; let states = 0;
for (const id of SERVICES) for (const [mode, key] of [['none', null], ['detected', 'detTagIds'], ['chosen', 'manTagIds'], ['detected+affirmed', 'detAff']]) for (const q of [1, 2, 3, 5]) {
  const res = [pre, post].map(({ DB, sb }) => {
    const s = DB.services.find(x => x.id === id), cat = s.ui_taxonomy.category_id, grp = s.ui_taxonomy.group_id;
    const tags = Object.keys(DB.smart_tags || {}).filter(t => { try { return sb.tagValidForCategory(t, cat, grp); } catch (e) { return false; } }).slice(0, 3);
    const st = Object.assign({ qty: q, intent: { key: s.id, category: cat, label: 'x', qtyLabel: 'item' }, stype: 'Repair', answers: {}, detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: [], userTagIds: [], _svc: s, _tagsAffirmed: false },
      key === 'detTagIds' ? { detTagIds: tags } : key === 'manTagIds' ? { manTagIds: tags } : key === 'detAff' ? { detTagIds: tags, _tagsAffirmed: true } : {});
    return sb.computeQuoteFromState(st);
  });
  states++;
  for (const k of new Set([...Object.keys(res[0]), ...Object.keys(res[1])])) if (JSON.stringify(res[0][k]) !== JSON.stringify(res[1][k])) keyDiff[k] = (keyDiff[k] || 0) + 1;
}
console.log(`${states} states (${SERVICES.length} services x 4 tag states x 4 quantities); keys of computeQuoteFromState's result that differ between the two trees (count of states):`);
for (const [k, n] of Object.entries(keyDiff).sort()) console.log(`  ${k}: ${n}`);
const moved = PRICE_KEYS.filter(k => keyDiff[k]);
console.log(`price-bearing keys checked: ${PRICE_KEYS.join(', ')}`);
console.log(moved.length ? `PRICE-BEARING KEYS THAT MOVED: ${moved.join(', ')}` : 'price-bearing keys that moved: none');
process.exit(moved.length ? 1 : 0);
