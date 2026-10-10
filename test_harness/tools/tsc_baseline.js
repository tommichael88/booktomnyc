#!/usr/bin/env node
/**
 * tools/tsc_baseline.js -- PHASE_PLAN.md A1: capture the TypeScript baseline for the monolith. Observation only: it never fixes anything and never gates.
 *
 * tsc cannot read an HTML file, so the plan's "add // @ts-check to the main <script> blocks" is applied the only way it can be: the named module blocks are the files
 * test_harness/extract_modules.js already writes (pricing_engine.js ... store.js); the inline blocks that are NOT named modules (global state, the boot IIFE, the service-worker
 * registration) are written to archive/_tsblocks/ with `// @ts-check` as their first line (temporary: that directory is git-ignored and is recreated on each run). qr.html itself is not modified.
 * tsconfig.json (repo root) lists exactly those files. They are classic scripts sharing one global scope, as in the browser.
 *
 *   node test_harness/tools/tsc_baseline.js [--out archive/types_baseline.txt] [--tsc /path/to/tsc.js]
 * tsc is found by --tsc, $TSC, or `npx --no-install tsc`; typescript is NOT a dependency of this repository (PHASE_PLAN: no new dependencies in Phase A).
 */
'use strict';
const fs = require('fs'), path = require('path'), { spawnSync, execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const OUT = path.resolve(ROOT, arg('--out', 'archive/types_baseline.txt')), TSC = arg('--tsc', process.env.TSC || '');

execSync(`node ${JSON.stringify(path.join(ROOT, 'test_harness', 'extract_modules.js'))}`, { stdio: 'ignore' });
const html = fs.readFileSync(path.join(ROOT, 'qr.html'), 'utf8');
const NAMED = ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js', 'UIRenderer.js', 'AppController.js', 'appReducer.js', 'store.js', 'cart_logic.js'];
const dir = path.join(ROOT, 'archive', '_tsblocks'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/g; let m, i = -1; const table = [];
while ((m = re.exec(html))) {
  i++; const attrs = m[1] || '', body = m[2], line = html.slice(0, m.index + m[0].indexOf('>') + 1).split('\n').length;
  if (/\ssrc=/.test(attrs) || !body.trim()) { table.push(`block ${i}: qr.html:${line}  (external src or empty -- not checked here)`); continue; }
  const head = body.split('\n').slice(0, 6).join('\n'), named = NAMED.find(n => new RegExp('^\\s*\\*\\s*' + n.replace('.', '\\.'), 'm').test(head));
  if (named) { table.push(`block ${i}: qr.html:${line}  -> ${named}`); continue; }
  const f = `qr_block_${String(i).padStart(2, '0')}.js`; fs.writeFileSync(path.join(dir, f), '// @ts-check\n' + body);
  table.push(`block ${i}: qr.html:${line}  -> archive/_tsblocks/${f} (line N there = qr.html line ${line} + N - 2: line 1 is the added directive)`);
}

let cmd, args;
if (TSC) { cmd = process.execPath; args = [TSC]; } else { cmd = 'npx'; args = ['--no-install', 'tsc']; }
const r = spawnSync(cmd, [...args, '-p', 'tsconfig.json', '--noEmit', '--pretty', 'false'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 29 });
const raw = (r.stdout || '') + (r.stderr || '');
if (r.status === null || (/not found|ENOENT|could not determine executable/i.test(raw) && !/error TS/.test(raw))) { console.error('tsc not available: pass --tsc /path/to/typescript/bin/tsc or set $TSC\n' + raw.slice(0, 400)); process.exit(2); }
const errs = raw.split('\n').filter(l => /\berror TS\d+:/.test(l));
const byFile = {}, byCode = {};
errs.forEach(l => { const f = l.split('(')[0]; byFile[f] = (byFile[f] || 0) + 1; const c = (l.match(/error (TS\d+):/) || [])[1]; byCode[c] = (byCode[c] || 0) + 1; });
const ver = spawnSync(cmd, [...args, '--version'], { encoding: 'utf8' }).stdout.trim();
const top = o => Object.entries(o).sort((a, b) => b[1] - a[1]);
const header = [
  '# types_baseline.txt -- PHASE_PLAN.md A1 step 3. CAPTURED, NOT FIXED. Observation only; nothing here gates Phase A.',
  `# ${ver}; tsconfig.json: allowJs, checkJs, noEmit, target ES2020, lib DOM+ES2020`,
  `# command: node test_harness/tools/tsc_baseline.js   (equivalent to: npx tsc -p tsconfig.json --noEmit, after extract_modules.js and the inline-block extraction)`,
  `# total errors: ${errs.length}`, '#', '# by file:', ...top(byFile).map(([f, n]) => `#   ${String(n).padStart(6)}  ${f}`), '#', '# by TS code (top 25):', ...top(byCode).slice(0, 25).map(([c, n]) => `#   ${String(n).padStart(6)}  ${c}`), '#',
  '# script blocks of qr.html:', ...table.map(t => '#   ' + t), '#', '# ---- raw tsc output ----'];
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, header.join('\n') + '\n' + errs.join('\n') + '\n');
console.log(`${ver}: ${errs.length} errors across ${Object.keys(byFile).length} files -> ${path.relative(ROOT, OUT)}`);
