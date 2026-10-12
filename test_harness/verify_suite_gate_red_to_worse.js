#!/usr/bin/env node
/**
 * verify_suite_gate_red_to_worse.js -- the suite gate also holds a test that is already red (PENDING_DECISIONS #197, T173).
 *
 * THE HOLE (operator, 2026-10-11 15:14 NY): the gate compared pass against not-pass, so a test that was red on the baseline could get any worse for free.
 * verify_confidence_strategy_inheritance.js went from 3 failing assertions to 6 (T159) to 7 (T164) and nothing said so. The property added to tools/suite_snapshot.js:
 * for a test that is red on the baseline, the failing-assertion count may not increase, and may not disappear (a crash or a timeout hides every assertion after it).
 * It is a property of the existing gate, not a class detector.
 *
 * WHAT IS CHECKED HERE
 *   - the comparison itself, on planted snapshots: pass->fail (the original rule, still held), red->worse, red->no count, red->same, red->better, a new test red at birth,
 *     the `accepted` path (printed, and an accept that did not get worse is an error so the list cannot rot into a loophole), and an old-format TSV row whose count column is 0.
 *   - the planted cases are not vacuous: the pre-T173 rule (pass->fail only) is reimplemented here and passes the very snapshots the new rule fails.
 *   - a red test that prints assertion lines but no "N failed" summary (the Charter tests, a browser test that stops on an ERROR) is counted by its cross-marked lines, the TSV's 5th
 *     column (T173); a summary count lost to a cross-count is a loss, a cross-count replaced by a real summary is not comparable.
 *   - the HISTORY: the archived snapshots are replayed pair by pair. The two steps nobody saw (3->6 at T159, 6->7 at T164) are found, and so are earlier ones.
 *   - the blind set is reported, not hidden: the red tests that print no "N failed" cannot be held to the count, and the number is stated.
 *
 * Node, no browser, no network.
 */
'use strict';
const fs = require('fs'), path = require('path');
const { parseTsv, measure, failingCount, compare, report } = require('./tools/suite_snapshot.js');
const ARCHIVE = path.resolve(__dirname, '..', 'archive');

let passed = 0, failed = 0;
const check = (label, ok, detail) => { if (ok) { passed++; console.log(`  ✓ ${label}`); } else { failed++; console.log(`  ✗ ${label}${detail ? ' -- ' + detail : ''}`); } };
const tsv = rows => parseTsv(rows.map(r => r.join('\t')).join('\n') + '\n');
const green = n => [n, 0, 0, '[x] 10 passed, 0 failed (of 10 checks)'];
const red = (n, k) => [n, 1, k, `[x] ${10 - k} passed, ${k} failed (of 10 checks)`];
const crash = n => [n, 1, 1, ''];
const oldPassFailOnly = (base, now) => [...now].filter(([n, r]) => base.has(n) && base.get(n).rc === 0 && r.rc !== 0).map(([n]) => n);   // the gate as it was before T173

console.log('=== planted snapshots: each rule, and what the old rule said about it ===');
{
  const base = tsv([green('a.js'), red('b.js', 3), red('c.js', 3), red('d.js', 3), crash('e.js'), red('f.js', 3), green('g.js'), red('h.js', 3)]);
  const now = tsv([red('a.js', 1), red('b.js', 7), red('c.js', 3), red('d.js', 2), red('e.js', 4), crash('f.js'), green('g.js'), red('h.js', 3), red('new_red.js', 2), green('new_green.js')]);
  const r = compare(base, now);
  check('pass -> fail is still caught (the original rule)', r.worse.length === 1 && r.worse[0] === 'a.js', JSON.stringify(r.worse));
  check('red -> more failing assertions is caught (3 -> 7)', r.deeper.length === 1 && r.deeper[0].name === 'b.js' && r.deeper[0].from === 3 && r.deeper[0].to === 7, JSON.stringify(r.deeper));
  check('red -> the same count is not an event (c.js 3 -> 3, h.js 3 -> 3)', !r.deeper.concat(r.shallower, r.lost).some(e => e.name === 'c.js' || e.name === 'h.js'));
  check('red -> fewer is reported as better and does not fail the gate (d.js 3 -> 2)', r.shallower.length === 1 && r.shallower[0].name === 'd.js');
  check('a red test that stops reporting a count is caught (f.js was 3, now a crash)', r.lost.length === 1 && r.lost[0].name === 'f.js' && r.lost[0].from === 3, JSON.stringify(r.lost));
  check('a red test that had no count and now reports one is reported, not failed (e.js crash -> 4)', r.nowCounted.length === 1 && r.nowCounted[0].name === 'e.js' && r.nowCounted[0].to === 4);
  check('a test red at birth is reported with its count and does not fail the gate on its own', r.newRed.length === 1 && r.newRed[0].name === 'new_red.js' && r.newRed[0].count === 2 && r.added.includes('new_green.js'));
  check('the gate fails when any of the three gating events is present', r.failed === true);
  check('NOT VACUOUS: the pre-T173 rule (pass -> fail only) sees only a.js in this snapshot, so b.js 3 -> 7 and f.js lost its count were invisible to it',
    JSON.stringify(oldPassFailOnly(base, now)) === JSON.stringify(['a.js']));
  const onlyRedMoves = compare(tsv([red('b.js', 3), crash('e.js')]), tsv([red('b.js', 7), crash('e.js')]));
  check('NOT VACUOUS: a snapshot whose ONLY change is 3 -> 7 in an already-red test fails the new gate and passes the old one',
    onlyRedMoves.failed === true && oldPassFailOnly(tsv([red('b.js', 3)]), tsv([red('b.js', 7)])).length === 0);
  const clean = compare(tsv([green('g.js'), red('b.js', 3), crash('e.js')]), tsv([green('g.js'), red('b.js', 3), crash('e.js')]));
  check('an unchanged suite passes, and the red test with no count is counted as the blind set', clean.failed === false && clean.unmeasured.length === 1 && clean.unmeasured[0] === 'e.js');
}

console.log('\n=== --accept: a deliberate deepening is named, printed, and cannot be left behind ===');
{
  const base = tsv([red('b.js', 3), red('f.js', 3)]), now = tsv([red('b.js', 7), crash('f.js')]);
  const acc = compare(base, now, { accept: ['b.js', 'f.js'] });
  check('naming the tests in accept lets the gate pass', acc.failed === false && acc.deeper.length === 0 && acc.lost.length === 0);
  check('accepted entries are carried in the result and printed (they stay in the log)', acc.accepted.length === 2 && report(acc, 'base.tsv', ['b.js', 'f.js']).join('\n').includes('ACCEPTED by --accept'));
  const stale = compare(tsv([red('b.js', 3), red('c.js', 3)]), tsv([red('b.js', 7), red('c.js', 3)]), { accept: ['b.js', 'c.js'] });
  check('an accept that did not get worse (c.js 3 -> 3) is itself an error', stale.failed === true && stale.staleAccept.length === 1 && stale.staleAccept[0] === 'c.js');
  const partial = compare(base, now, { accept: ['b.js'] });
  check('accepting one test does not excuse another (f.js still fails the gate)', partial.failed === true && partial.lost.length === 1 && partial.lost[0].name === 'f.js');
}

console.log('\n=== how a count is read ===');
{
  check('a passing row has zero failing assertions', failingCount({ rc: 0, fails: 0, summary: 'x' }) === 0);
  check('"78 passed, 7 failed (of 85 checks)" reads as 7', failingCount({ rc: 1, fails: 7, summary: '[c] 78 passed, 7 failed (of 85 checks)' }) === 7);
  check('an old-format row (count column 0 although red) reads its count from the summary: T156 recorded 0 for a test whose summary says 3 failed',
    failingCount({ rc: 1, fails: 0, summary: '[confidence_strategy inheritance verification] 82 passed, 3 failed (of 85 checks)' }) === 3);
  check('a red test with an empty summary has no count (it crashed or printed none)', failingCount({ rc: 1, fails: 1, summary: '' }) === null);
  check('the default 1 that suite_snapshot writes for a crash is not mistaken for a count', failingCount({ rc: 2, fails: 1, summary: '' }) === null);
  check('"0 failed" on a red exit is a count of 0, not a missing one', failingCount({ rc: 1, fails: 0, summary: '[y] 9 passed, 0 failed' }) === 0);
}

console.log('\n=== a red test with assertion lines but no summary is counted by its cross-marked lines ===');
{
  const rowM = (n, marks, summary = '') => [n, 1, 1, summary, marks];
  const base = tsv([rowM('m.js', 5), rowM('k.js', 5), rowM('s.js', 0, ''), rowM('t.js', 5), rowM('u.js', 5)]);
  const now = tsv([rowM('m.js', 9), rowM('k.js', 5), rowM('s.js', 3), [ 't.js', 1, 1, '[t] 4 passed, 2 failed (of 6 checks)', 5 ], rowM('u.js', 0)]);
  const r = compare(base, now);
  check('a cross-count that rises is caught like a summary count (5 -> 9)', r.deeper.length === 1 && r.deeper[0].name === 'm.js' && r.deeper[0].from === 5 && r.deeper[0].to === 9, JSON.stringify(r.deeper));
  check('an unchanged cross-count is not an event', !r.deeper.concat(r.lost, r.shallower).some(e => e.name === 'k.js'));
  check('a red test with no summary and no crosses starts to report crosses: reported, not failed', r.nowCounted.some(e => e.name === 's.js' && e.to === 3));
  check('a cross-count replaced by a real summary is reported as recounted and not compared (5 -> 2 failed)', r.recounted.length === 1 && r.recounted[0].name === 't.js' && !r.deeper.concat(r.lost).some(e => e.name === 't.js'));
  check('a cross-counted test whose crosses disappear (it now crashes first) is a lost count', r.lost.length === 1 && r.lost[0].name === 'u.js' && r.lost[0].from === 5, JSON.stringify(r.lost));
  const sumToMarks = compare(tsv([red('c.js', 3)]), tsv([[ 'c.js', 1, 1, '', 2 ]]));
  check('a real summary count (3) that falls back to a partial cross-count (2) is a loss, not an improvement', sumToMarks.lost.length === 1 && sumToMarks.shallower.length === 0, JSON.stringify(sumToMarks));
  check('measure() names the kind: summary beats marks, marks beats nothing, a pass has none',
    measure({ rc: 1, summary: 'x 4 failed', marks: 9 }).kind === 'summary' && measure({ rc: 1, summary: '', marks: 9 }).kind === 'marks' && measure({ rc: 1, summary: '', marks: 0 }) === null && measure({ rc: 0 }).kind === 'pass');
  check('a TSV with the 5th column and one without it (an older snapshot) both parse', parseTsv('a.js\t1\t1\t\t4\nb.js\t1\t3\tx 3 failed\n').get('a.js').marks === 4 && parseTsv('a.js\t1\t1\t\t4\nb.js\t1\t3\tx 3 failed\n').get('b.js').marks === null);
}

console.log('\n=== the archive replayed: would the gate have caught what it missed ===');
{
  const chain = ['baseline_T154', 'baseline_T156', 'T157', 'T158', 'T159_pre', 'T159_B', 'T160_C', 'T161_D', 'T162_E', 'T163_F', 'T164_G', 'T165_H', 'T166', 'T168', 'T169', 'T170', 'T171', 'T172'];
  const files = chain.map(c => path.join(ARCHIVE, `suite_${c}.tsv`));
  check(`all ${chain.length} archived snapshots are present`, files.every(f => fs.existsSync(f)), files.filter(f => !fs.existsSync(f)).join(', '));
  if (files.every(f => fs.existsSync(f))) {
    const snaps = files.map(f => parseTsv(fs.readFileSync(f, 'utf8')));
    const steps = []; for (let i = 1; i < chain.length; i++) steps.push({ from: chain[i - 1], to: chain[i], r: compare(snaps[i - 1], snaps[i]) });
    const find = (name, from, to) => steps.find(s => s.r.deeper.some(e => e.name === name && e.from === from && e.to === to));
    const csi = 'verify_confidence_strategy_inheritance.js';
    const s1 = find(csi, 3, 6), s2 = find(csi, 6, 7);
    check('T159 (items B, C, D): verify_confidence_strategy_inheritance.js 3 -> 6 is found', !!s1 && s1.to === 'T159_B', s1 ? s1.from + ' -> ' + s1.to : 'not found');
    check('T164 (item G): verify_confidence_strategy_inheritance.js 6 -> 7 is found', !!s2 && s2.to === 'T164_G', s2 ? s2.from + ' -> ' + s2.to : 'not found');
    check('and every pair on the chain between the two is quiet for that test (it was 3 at T157/T158/T159_pre, 6 through T163_F, 7 from T164_G to T172)',
      steps.filter(s => s.r.deeper.some(e => e.name === csi)).length === 2);
    const found = steps.flatMap(s => s.r.deeper.map(e => `${e.name} ${e.from}->${e.to} (${s.from} -> ${s.to})`).concat(s.r.lost.map(e => `${e.name} lost its count, was ${e.from} (${s.from} -> ${s.to})`)));
    const byTest = new Set(steps.flatMap(s => s.r.deeper.concat(s.r.lost).map(e => e.name)));
    console.log(`    replay: ${found.length} events on ${byTest.size} tests across ${steps.length} consecutive pairs:`);
    found.forEach(f => console.log(`      ${f}`));
    check('the replay finds events beyond the one that was named (it is a detector of unnamed instances, not a record of the named one)', byTest.size > 1);
    const last = snaps[snaps.length - 1];
    const redNow = [...last].filter(([, r]) => r.rc !== 0), counted = redNow.filter(([, r]) => failingCount(r) !== null);
    console.log(`    blind set at ${chain[chain.length - 1]}: ${redNow.length} red tests, ${counted.length} report a failing-assertion count and are held to it, ${redNow.length - counted.length} print none (they stop before a summary) and are held to pass->fail only`);
    const lines = report(compare(last, last), 'suite_T172.tsv', []).join('\n');
    check('the comparison prints the blind set every time it runs (the number of red tests it cannot hold to a count), so it is never silent', redNow.length > counted.length && lines.includes(`no failing-assertion count, held to pass->fail only: ${redNow.length - counted.length}`), lines.split('\n').filter(l => /held to/.test(l)).join(''));
  }
}

console.log(`\n[suite gate: red -> worse] ${passed} passed, ${failed} failed (of ${passed + failed} checks)`);
process.exit(failed ? 1 : 0);
