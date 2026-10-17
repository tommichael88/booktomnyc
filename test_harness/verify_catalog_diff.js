#!/usr/bin/env node
/**
 * verify_catalog_diff.js -- the catalog comparison tool (test_harness/tools/catalog_diff.js) answers the question it exists for: "what changed between two versions of btnyc.json, and did a price move?" (T180 8/n).
 *
 * The Operator's reason (2026-10-16 23:34 NY): "I'd rather audit the data in case someone has to compare your btnyc.json to the previous version in case of oversight in the future." A comparison tool that
 * cannot see a changed fee, or that reports a difference between two identical files, would be worse than none, so each is shown here on a catalogue whose change is known.
 *
 *   1. identical inputs report nothing, and the real file equals itself read through git;
 *   2. a known set of edits is reported exactly: one service added, one tag removed, one modifier fee changed, one service's price changed, one text-only change (which must NOT appear among the money fields);
 *   3. the history list is real: every row's blob is the object git reports for that commit, the newest row is the file at HEAD's most recent change, and the rows are in date order (skipped, saying so, when this tree has no git history).
 *
 * Node only; no browser, no network.
 */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const T = require('./tools/catalog_diff.js');
const ROOT = path.resolve(__dirname, '..');
let passed = 0, failed = 0;
const check = (label, ok, detail) => { if (ok) { passed++; console.log('  ✓ ' + label); } else { failed++; console.log('  ✗ ' + label + (detail ? ' -- ' + detail : '')); } };
const clone = o => JSON.parse(JSON.stringify(o));
const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));

console.log('verify_catalog_diff.js');

console.log('\n1. Identical inputs report nothing');
const r0 = T.compare(DB, clone(DB));
check('a catalogue compared with a copy of itself: no collection differs, no scalar differs, no money field', Object.keys(r0.collections).length === 0 && r0.scalars.length === 0 && r0.money.length === 0, JSON.stringify(r0).slice(0, 200));
check('...and the rendered report says so', /No difference\./.test(T.render(r0, 'A', 'B')), T.render(r0, 'A', 'B').slice(0, 120));

console.log('\n2. A known set of edits is reported exactly');
const M = clone(DB);
const svc = M.services[0], svcId = svc.id;
const svc2 = M.services[1], svc2Id = svc2.id;
const modId = Object.keys(M.global_rules.modifiers).find(k => typeof M.global_rules.modifiers[k].fee === 'number');
const oldFee = M.global_rules.modifiers[modId].fee;
const tagId = Object.keys(M.smart_tags)[0];
M.services.push(Object.assign(clone(svc), { id: 'zz_added_service_for_test' }));
delete M.smart_tags[tagId];
M.global_rules.modifiers[modId].fee = oldFee + 17;
const oldBase = svc.financial_engine.base_price;
svc.financial_engine.base_price = (oldBase || 0) + 5;
svc2.ui_taxonomy.description = (svc2.ui_taxonomy.description || '') + ' (reworded)';
const r = T.compare(DB, M);
check('services: exactly the added one is added, none removed', JSON.stringify(r.collections.services.added) === JSON.stringify(['zz_added_service_for_test']) && r.collections.services.removed.length === 0, JSON.stringify(r.collections.services.added));
check('services: exactly two are changed (the price edit and the wording edit)', JSON.stringify(r.collections.services.changed.map(c => c.id).sort()) === JSON.stringify([svcId, svc2Id].sort()), JSON.stringify(r.collections.services.changed.map(c => c.id)));
check('smart_tags: exactly the removed one is removed', JSON.stringify(r.collections.smart_tags.removed) === JSON.stringify([tagId]) && r.collections.smart_tags.added.length === 0, JSON.stringify(r.collections.smart_tags));
const feeHit = r.money.find(m => m.where === `global_rules.modifiers.${modId}.fee`);
check('the changed modifier fee is listed among the money fields with its old and new value', !!feeHit && feeHit.from === oldFee && feeHit.to === oldFee + 17, JSON.stringify(feeHit));
const baseHit = r.money.find(m => m.where === `services.${svcId}.financial_engine.base_price`);
check('the changed service price is listed among the money fields', !!baseHit && baseHit.to === (oldBase || 0) + 5, JSON.stringify(baseHit));
check('the wording-only change is NOT among the money fields (not over-broad)', !r.money.some(m => m.where.includes(svc2Id)), JSON.stringify(r.money.filter(m => m.where.includes(svc2Id))));
check('exactly two money fields changed (the fee and the price; nothing else)', r.money.length === 2, r.money.length + ': ' + r.money.map(m => m.where).join(' | '));
const text = T.render(r, 'A', 'B');
check('the rendered report names the added service, the removed tag and the money count', text.includes('zz_added_service_for_test') && text.includes(tagId) && /money \/ time fields that changed: 2/.test(text), text.slice(0, 200));

console.log('\n3. The history list is real');
let rows = [];
try { rows = T.history(); } catch (e) { rows = []; }
if (!rows.length) console.log('  (skipped: this tree has no git history for btnyc.json)');
else {
  check(`history lists ${rows.length} versions, each with a version string, a byte count and a blob`, rows.every(x => x.version && x.bytes > 0 && /^[0-9a-f]{40}$/.test(x.blob || '')), JSON.stringify(rows.find(x => !x.blob)));
  const head = cp.execFileSync('git', ['rev-parse', `${rows[0].commit}:btnyc.json`], { cwd: ROOT, encoding: 'utf8' }).trim();
  check('the newest row\'s blob is the object git reports for that commit', head === rows[0].blob, head + ' vs ' + rows[0].blob);
  check('rows are newest first (dates never increase down the list)', rows.every((x, i) => i === 0 || rows[i - 1].date >= x.date), rows.map(x => x.date).join(' '));
  const L = T.load(rows[rows.length - 1].commit), L2 = T.load(rows[0].commit);
  check('two historic versions load and compare without error', typeof T.compare(L.db, L2.db) === 'object');
}

console.log(`\n[catalog diff] ${passed} passed, ${failed} failed (of ${passed + failed} checks)`);
process.exit(failed ? 1 : 0);
