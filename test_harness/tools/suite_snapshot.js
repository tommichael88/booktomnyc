#!/usr/bin/env node
/**
 * suite_snapshot.js -- run every test the way run_all.sh does and record the outcome of each, so a change can be compared with a baseline.
 *
 *   node test_harness/tools/suite_snapshot.js --out snapshot.tsv [--compare archive/suite_baseline_T156.tsv] [--jobs 6] [--timeout 300] [--only <substring>]
 *
 * One row per test: name <TAB> exit code <TAB> failed-count (from "N failed", else 0/1) <TAB> the last "passed/failed" summary line. Tests are the same set run_all.sh runs
 * (verify_*.js, verify_*.py, find_*.py in test_harness/), each with cwd = test_harness. With --compare, prints the tests whose outcome got WORSE (exit 0 -> not 0) and
 * those that got better, and exits 1 if any got worse: the project's rule is that a change may not turn a passing test red (never loosen a test to pass; retarget one only when
 * the SSOT is the right side).
 *
 * An environment gap (a browser test that could not run its browser half and says "environment gap") is recorded with a trailing "[GAP]" in the summary column, because exit 0
 * from a test that skipped its browser is not a pass of the browser half (DEFECT-SILENT-SKIP). This tool does not hide it; --fail-on-gap makes it an error.
 *
 * This lives in the repo (not beside it) because the T157 container reset showed what a baseline tool kept outside the tree is worth.
 */
'use strict';
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const HARNESS = path.resolve(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const OUT = arg('out', null), CMP = arg('compare', null), JOBS = +arg('jobs', 6), TIMEOUT = +arg('timeout', 300) * 1000, ONLY = arg('only', null), FAIL_ON_GAP = process.argv.includes('--fail-on-gap');
const env = Object.assign({}, process.env, { CHROME_PATH: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' });

const names = fs.readdirSync(HARNESS).filter(f => /^(verify_.*\.(js|py)|find_.*\.py)$/.test(f)).filter(f => !ONLY || f.includes(ONLY)).sort();
const parseTsv = f => new Map(fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => { const c = l.split('\t'); return [c[0], { rc: +c[1], fails: +c[2], summary: c[3] || '' }]; }));

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
      resolve({ name, rc: code === null ? 124 : code, fails: fm ? +fm[1] : (code ? 1 : 0), summary: (last + (gap ? ' [GAP]' : '')).trim() });
    });
  });
}

(async () => {
  const results = []; let next = 0;
  await Promise.all(Array.from({ length: JOBS }, async () => { while (next < names.length) { const n = names[next++]; results.push(await run(n)); } }));
  results.sort((a, b) => a.name.localeCompare(b.name));
  const tsv = results.map(r => [r.name, r.rc, r.fails, r.summary].join('\t')).join('\n') + '\n';
  if (OUT) fs.writeFileSync(OUT, tsv);
  const pass = results.filter(r => r.rc === 0).length, gaps = results.filter(r => /\[GAP\]/.test(r.summary));
  console.log(`[suite_snapshot] ${results.length} tests: ${pass} pass, ${results.length - pass} fail` + (gaps.length ? `, ${gaps.length} with an environment gap (browser half skipped): ${gaps.map(g => g.name).join(', ')}` : ''));
  let worse = [];
  if (CMP) {
    const base = parseTsv(CMP), now = new Map(results.map(r => [r.name, r]));
    worse = [...now].filter(([n, r]) => base.has(n) && base.get(n).rc === 0 && r.rc !== 0).map(([n]) => n);
    const better = [...now].filter(([n, r]) => base.has(n) && base.get(n).rc !== 0 && r.rc === 0).map(([n]) => n);
    const added = [...now.keys()].filter(n => !base.has(n)), gone = [...base.keys()].filter(n => !now.has(n) && (!ONLY || n.includes(ONLY)));
    console.log(`  vs ${path.basename(CMP)}: pass->fail: ${worse.length ? worse.join(', ') : 'none'}`);
    console.log(`                      fail->pass: ${better.length ? better.join(', ') : 'none'}`);
    console.log(`                      new tests: ${added.length ? added.join(', ') : 'none'}; no longer present: ${gone.length ? gone.join(', ') : 'none'}`);
  }
  process.exit((worse.length || (FAIL_ON_GAP && gaps.length)) ? 1 : 0);
})();
