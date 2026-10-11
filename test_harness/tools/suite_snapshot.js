#!/usr/bin/env node
/**
 * suite_snapshot.js -- run every test the way run_all.sh does and record the outcome of each, so a change can be compared with a baseline.
 *
 *   node test_harness/tools/suite_snapshot.js --out snapshot.tsv [--compare archive/suite_baseline_T156.tsv] [--accept a.js,b.js] [--jobs 6] [--timeout 300] [--only <substring>]
 *
 * One row per test: name <TAB> exit code <TAB> failed-count (from "N failed", else 0/1) <TAB> the last "passed/failed" summary line <TAB> marks (lines that begin with a cross). Tests are the same set run_all.sh runs
 * (verify_*.js, verify_*.py, find_*.py in test_harness/), each with cwd = test_harness.
 *
 * THE GATE (--compare). A change may not make the suite worse, and "worse" has two parts (T173, #197; the second part was missing until then):
 *   1. a test that PASSED on the baseline may not fail now                                (pass -> fail; the original rule)
 *   2. a test that was ALREADY RED on the baseline may not report more failing assertions (red -> worse), and may not stop reporting a count (a crash or a timeout
 *      hides every assertion after it). T159 and T164 each made verify_confidence_strategy_inheritance.js fail more assertions (3 -> 6 -> 7) while it was red;
 *      the old gate compared pass against not-pass only, so a red test was a place where anything could break for free.
 * Exit 1 if either part trips. A test that gets better is reported, not rewarded. A deliberate deepening (a stale assertion the change made stale) is named with
 * --accept <test.js>: it is printed as ACCEPTED, so it appears in the log; an --accept that did not deepen is itself an error, so the list cannot rot into a loophole.
 * The failing-assertion count is the "N failed" in the test's own summary line; for a red test that prints assertion lines but no such summary (the Charter tests, a
 * browser test that stops on an ERROR) it is the number of lines that begin with a cross (the "marks" column, written by this tool from T173). A red test with neither
 * (it crashes before printing one) cannot be held to part 2; it is counted and reported on every run. Order of operations that matters: run `node test_harness/extract_modules.js` first (the tests read the generated root modules; a stale root module crashes
 * verify_confidence_strategy_inheritance.js before its summary) and refresh the manifest first (`node test_harness/verify_file_integrity.js --update --keep-absent`;
 * verify_file_integrity.js's count is the manifest's staleness, and moves with every commit otherwise). The comparison itself is a pure function (compare), tested in
 * verify_suite_gate_red_to_worse.js on planted snapshots and on the archived ones.
 *
 * An environment gap (a browser test that could not run its browser half and says "environment gap") is recorded with a trailing "[GAP]" in the summary column, because exit 0
 * from a test that skipped its browser is not a pass of the browser half (DEFECT-SILENT-SKIP). This tool does not hide it; --fail-on-gap makes it an error.
 *
 * This lives in the repo (not beside it) because the T157 container reset showed what a baseline tool kept outside the tree is worth.
 */
'use strict';
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const HARNESS = path.resolve(__dirname, '..');

// ---------------------------------------------------------------- the pure part (exported)
const parseTsv = text => new Map(String(text).split('\n').filter(Boolean).map(l => { const c = l.split('\t'); return [c[0], { rc: +c[1], fails: +c[2], summary: c[3] || '', marks: c[4] === undefined || c[4] === '' ? null : +c[4] }]; }));

/**
 * How a red test's failing assertions are counted, and by what: { n, kind } or null.
 *   'summary'  the last "N failed" in its summary line (what a test prints when it finishes)
 *   'marks'    lines that begin with a cross, for a red test that prints assertions but no such summary (written to the TSV's 5th column since T173)
 * null: the test is red and reports neither (it crashed, or printed one failure line and stopped). 'pass' for a passing row.
 */
function measure(row) {
  if (!row) return null;
  if (row.rc === 0) return { n: 0, kind: 'pass' };
  const m = [...String(row.summary || '').matchAll(/(\d+)\s+failed/gi)].pop();
  if (m) return { n: +m[1], kind: 'summary' };
  if (row.marks > 0) return { n: row.marks, kind: 'marks' };
  return null;
}
/** Failing assertions of a row: 0 if it passed; else its measured count; null when a red test reports none. */
const failingCount = row => { const m = measure(row); return m ? m.n : null; };

/**
 * compare(base, now, { accept, only }) -> everything the gate knows. Maps are name -> { rc, fails, summary }.
 *   worse        passed on the base, fails now                                    (gating)
 *   deeper       red on both, more failing assertions now                        (gating unless accepted)
 *   lost         red on both, counted on the base, no count now (crash/timeout)  (gating unless accepted)
 *   staleAccept  names in `accept` that neither deepened nor lost their count    (gating)
 *   accepted     deeper/lost entries that were named in `accept`                  (reported)
 *   better, shallower, nowCounted, recounted, unmeasured, added, newRed, gone    (reported)
 */
function compare(base, now, opts = {}) {
  const accept = new Set(opts.accept || []), only = opts.only || null;
  const r = { worse: [], better: [], deeper: [], shallower: [], lost: [], accepted: [], staleAccept: [], nowCounted: [], recounted: [], unmeasured: [], added: [], newRed: [], gone: [] };
  for (const [n, cur] of now) {
    const b = base.get(n);
    if (!b) { r.added.push(n); if (cur.rc !== 0) r.newRed.push({ name: n, count: failingCount(cur) }); continue; }
    if (b.rc === 0 && cur.rc !== 0) { r.worse.push(n); continue; }
    if (b.rc !== 0 && cur.rc === 0) { r.better.push(n); continue; }
    if (b.rc === 0) continue;                                     // green on both
    const bm = measure(b), nm = measure(cur);
    if (!bm && !nm) r.unmeasured.push(n);
    else if (!bm) r.nowCounted.push({ name: n, to: nm.n });
    else if (!nm) r.lost.push({ name: n, from: bm.n });
    else if (bm.kind !== nm.kind) { if (bm.kind === 'summary') r.lost.push({ name: n, from: bm.n }); else r.recounted.push({ name: n, from: bm.n, to: nm.n, kind: nm.kind }); }   // a summary count replaced by a partial one is a loss; a cross-count replaced by a real summary is a better measure, not comparable
    else if (nm.n > bm.n) r.deeper.push({ name: n, from: bm.n, to: nm.n });
    else if (nm.n < bm.n) r.shallower.push({ name: n, from: bm.n, to: nm.n });
  }
  for (const n of base.keys()) if (!now.has(n) && (!only || n.includes(only))) r.gone.push(n);
  const take = (list) => list.filter(e => { if (!accept.has(e.name)) return true; r.accepted.push(e); return false; });
  r.deeper = take(r.deeper); r.lost = take(r.lost);
  const used = new Set(r.accepted.map(e => e.name));
  r.staleAccept = [...accept].filter(n => !used.has(n));
  r.failed = !!(r.worse.length || r.deeper.length || r.lost.length || r.staleAccept.length);
  return r;
}

const fmt = (list, f) => list.length ? list.map(f).join(', ') : 'none';
function report(r, label, accept) {
  const L = [];
  L.push(`  vs ${label}: pass->fail: ${fmt(r.worse, x => x)}`);
  L.push(`${' '.repeat(label.length + 6)}red->worse (more failing assertions): ${fmt(r.deeper, e => `${e.name} ${e.from}->${e.to}`)}`);
  L.push(`${' '.repeat(label.length + 6)}red->no count (crash/timeout hides assertions): ${fmt(r.lost, e => `${e.name} (was ${e.from})`)}`);
  if (r.accepted.length) L.push(`${' '.repeat(label.length + 6)}ACCEPTED by --accept: ${fmt(r.accepted, e => e.to === undefined ? `${e.name} (count lost, was ${e.from})` : `${e.name} ${e.from}->${e.to}`)}`);
  if (r.staleAccept.length) L.push(`${' '.repeat(label.length + 6)}--accept names a test that did not get worse (remove it): ${r.staleAccept.join(', ')}`);
  L.push(`${' '.repeat(label.length + 6)}fail->pass: ${fmt(r.better, x => x)}`);
  L.push(`${' '.repeat(label.length + 6)}red->fewer failing assertions: ${fmt(r.shallower, e => `${e.name} ${e.from}->${e.to}`)}`);
  L.push(`${' '.repeat(label.length + 6)}new tests: ${fmt(r.added, x => x)}${r.newRed.length ? ` (RED at birth: ${fmt(r.newRed, e => `${e.name}${e.count === null ? '' : ' ' + e.count + ' failing'}`)})` : ''}; no longer present: ${fmt(r.gone, x => x)}`);
  if (r.nowCounted.length) L.push(`${' '.repeat(label.length + 6)}red tests that now report a count (they had none on the base): ${fmt(r.nowCounted, e => `${e.name} ${e.to}`)}`);
  if (r.recounted.length) L.push(`${' '.repeat(label.length + 6)}red tests whose count changed kind (a cross-count is now a real summary), not compared: ${fmt(r.recounted, e => `${e.name} ${e.from}->${e.to}`)}`);
  if (r.unmeasured.length) L.push(`${' '.repeat(label.length + 6)}red on both with no failing-assertion count, held to pass->fail only: ${r.unmeasured.length}`);
  if (r.deeper.some(e => e.name === 'verify_file_integrity.js')) L.push(`  hint: verify_file_integrity.js counts the manifest's staleness -- run \`node test_harness/verify_file_integrity.js --update --keep-absent\` and snapshot again.`);
  return L;
}

module.exports = { parseTsv, measure, failingCount, compare, report };

// ---------------------------------------------------------------- the runner
if (require.main === module) main();

function main() {
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const OUT = arg('out', null), CMP = arg('compare', null), JOBS = +arg('jobs', 6), TIMEOUT = +arg('timeout', 300) * 1000, ONLY = arg('only', null), FAIL_ON_GAP = process.argv.includes('--fail-on-gap');
const env = Object.assign({}, process.env, { CHROME_PATH: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' });

const names = fs.readdirSync(HARNESS).filter(f => /^(verify_.*\.(js|py)|find_.*\.py)$/.test(f)).filter(f => !ONLY || f.includes(ONLY)).sort();

function run(name) {
  return new Promise(resolve => {
    const cmd = name.endsWith('.py') ? 'python3' : 'node';
    const child = spawn(cmd, [name], { cwd: HARNESS, env });
    let out = ''; const cap = d => { out += d; if (out.length > 4e6) out = out.slice(-2e6); };
    child.stdout.on('data', cap); child.stderr.on('data', cap);
    const timer = setTimeout(() => { out += '\n[suite_snapshot] TIMEOUT'; child.kill('SIGKILL'); }, TIMEOUT);
    child.on('close', code => {
      clearTimeout(timer);
      const lines = out.split('\n').map(l => l.trim()).filter(Boolean);
      const sums = lines.filter(l => /\d+\s+passed/i.test(l) || /\d+\s+failed/i.test(l));
      const last = sums.length ? sums[sums.length - 1].slice(0, 200) : '';
      const fm = [...out.matchAll(/(\d+)\s+failed/gi)].pop();
      const gap = /environment gap/i.test(out);
      const marks = (out.match(/^\s*(?:✗|❌)/gm) || []).length;
      resolve({ name, rc: code === null ? 124 : code, fails: fm ? +fm[1] : (code ? 1 : 0), summary: (last + (gap ? ' [GAP]' : '')).trim(), marks });
    });
  });
}

(async () => {
  const results = []; let next = 0;
  await Promise.all(Array.from({ length: JOBS }, async () => { while (next < names.length) { const n = names[next++]; results.push(await run(n)); } }));
  results.sort((a, b) => a.name.localeCompare(b.name));
  const tsv = results.map(r => [r.name, r.rc, r.fails, r.summary, r.marks].join('\t')).join('\n') + '\n';
  if (OUT) fs.writeFileSync(OUT, tsv);
  const pass = results.filter(r => r.rc === 0).length, gaps = results.filter(r => /\[GAP\]/.test(r.summary));
  console.log(`[suite_snapshot] ${results.length} tests: ${pass} pass, ${results.length - pass} fail` + (gaps.length ? `, ${gaps.length} with an environment gap (browser half skipped): ${gaps.map(g => g.name).join(', ')}` : ''));
  let gate = { failed: false };
  if (CMP) {
    const base = parseTsv(fs.readFileSync(CMP, 'utf8')), now = new Map(results.map(r => [r.name, r]));
    const accept = String(arg('accept', '') === true ? '' : arg('accept', '')).split(',').map(x => x.trim()).filter(Boolean);
    gate = compare(base, now, { accept, only: ONLY });
    report(gate, path.basename(CMP), accept).forEach(l => console.log(l));
  }
  process.exit((gate.failed || (FAIL_ON_GAP && gaps.length)) ? 1 : 0);
})();
}
