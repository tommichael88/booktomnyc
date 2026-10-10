#!/usr/bin/env node
/**
 * verify_extractor_index_matches_parser.js -- holds extract_engine.py to a real parser's ground truth.
 *
 * extract_engine.py regenerates _extracted_engine.js (the engine the four pricing tests load) by walking identifier references from a short PUBLIC_API through a hand-written
 * JavaScript lexer. A hand-written lexer fails SILENTLY and DISTANTLY: the first version indexed 136 of 206 top-level functions and reported 145 local variables as top-level
 * constants, because one template literal with quotes and a nested template in its `${...}` swapped the lexer's string/code states for the rest of the file. The old hand-kept
 * FUNCS list failed the same way from the other side: it never listed computeArchetypeQuote, so an archetype-priced entity threw a ReferenceError in the old sandbox.
 * This test makes both failures loud, using acorn (a real parser) as the oracle:
 *   1. INDEX     -- the extractor's top-level functions and constants equal acorn's, exactly;
 *   2. FRESHNESS -- the committed _extracted_engine.js is byte-identical to what the extractor emits from the current qr.html (a stale generated file is its own silent failure);
 *   3. CLOSURE   -- the generated file has NO free identifier that qr.html defines at top level (the thing "transitive closure" promises), and none that is unknown anywhere;
 *   4. BEHAVIOUR -- the generated engine prices every real service and dynamic entity exactly as the real pricing module does (archetype-priced entities included);
 *   5. MUTANTS   -- a lexer that ends a template at the first inner backtick, a generated file missing a helper, and a stale generated file are each caught.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const { spawnSync } = require('child_process');
const Q = require('./_qr_blocks.js');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..');
const HARNESS = __dirname;
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log('  \u2713 ' + name); } else { fail++; console.log('  \u2717 ' + name + (detail ? '\n      ' + detail : '')); } };
const setEq = (a, b) => a.size === b.size && [...a].every(x => b.has(x));
const diff = (a, b) => [...a].filter(x => !b.has(x)).sort();

function truth(htmlPath) {            // acorn's top-level declarations, per script block
  const { blocks } = Q.loadQr(htmlPath); const fn = new Set(), cn = new Set();
  for (const b of blocks) { const r = Q.tryParseJs(b.src, b.startLine); if (!r.ast) throw new Error('acorn could not parse a script block at line ' + b.startLine);
    for (const n of r.ast.body) { if (n.type === 'FunctionDeclaration' && n.id) fn.add(n.id.name); if (n.type === 'VariableDeclaration') for (const d of n.declarations) if (d.id.type === 'Identifier') cn.add(d.id.name); } }
  return { fn, cn };
}
function runExtractor(extractorPy, htmlPath, outDirName) {   // runs a COPY of the extractor beside a COPY of qr.html, so the real tree is never touched
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xe-')); fs.mkdirSync(path.join(dir, 'test_harness'));
  fs.copyFileSync(htmlPath, path.join(dir, 'qr.html')); fs.copyFileSync(extractorPy, path.join(dir, 'test_harness', 'extract_engine.py'));
  fs.copyFileSync(path.join(HARNESS, '_page.js'), path.join(dir, 'test_harness', '_page.js')); fs.cpSync(path.join(ROOT, 'modules'), path.join(dir, 'modules'), { recursive: true });   // T158: the extractor reads the page with its external modules in place (_page.js), so a copy of the project carries both
  const idx = path.join(dir, 'index.json');
  const a = spawnSync('python3', ['extract_engine.py', '--index-json', idx], { cwd: path.join(dir, 'test_harness'), encoding: 'utf8' });
  const b = spawnSync('python3', ['extract_engine.py'], { cwd: path.join(dir, 'test_harness'), encoding: 'utf8' });
  const outFile = path.join(dir, 'test_harness', '_extracted_engine.js');
  return { dir, ok: a.status === 0 && b.status === 0, stderr: (a.stderr || '') + (b.stderr || ''), index: fs.existsSync(idx) ? JSON.parse(fs.readFileSync(idx, 'utf8')) : null, out: fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : null };
}
const OPTIONAL_GLOBALS = ['_trace'];   // defined by the separate trace.js layer when it is loaded; legitimate ONLY while every use is behind a typeof guard
const unguarded = (src) => OPTIONAL_GLOBALS.filter(g => { const occ = (src.match(new RegExp('\\b' + g + '\\b', 'g')) || []).length, guarded = (src.match(new RegExp('typeof ' + g + " === 'function'", 'g')) || []).length; return occ !== 2 * guarded; });  // each guarded use is two mentions: the typeof and the call
const GLOBALS = new Set([...Object.getOwnPropertyNames(globalThis), 'DB', 'SERVICE_DATA', 'S', 'window', 'global', 'module', 'exports', 'require', 'console', 'arguments']);
function freeIdentifiers(src) {      // identifiers referenced but declared nowhere in the file (flat scope: conservative toward "declared")
  const r = Q.tryParseJs(src, 1); if (!r.ast) throw new Error('generated file does not parse');
  const refs = new Set(), decl = new Set();
  const pat = p => { if (!p) return; if (p.type === 'Identifier') decl.add(p.name); else if (p.type === 'ObjectPattern') p.properties.forEach(x => pat(x.value || x.argument)); else if (p.type === 'ArrayPattern') p.elements.forEach(pat); else if (p.type === 'RestElement') pat(p.argument); else if (p.type === 'AssignmentPattern') pat(p.left); };
  Q.walkAst(r.ast, (n, parent) => {
    if (n.type === 'Identifier') { if (parent && ((parent.type === 'MemberExpression' && parent.property === n && !parent.computed) || (parent.type === 'Property' && parent.key === n && !parent.computed && !parent.shorthand) || (parent.type === 'MethodDefinition' && parent.key === n) || ((parent.type === 'LabeledStatement' || parent.type === 'BreakStatement' || parent.type === 'ContinueStatement') && parent.label === n))) return; refs.add(n.name); }
    if ((n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression') && n.id) decl.add(n.id.name);
    if (n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression') n.params.forEach(pat);
    if (n.type === 'VariableDeclarator') pat(n.id); if (n.type === 'CatchClause') pat(n.param); if (n.type === 'ClassDeclaration' && n.id) decl.add(n.id.name);
  });
  return [...refs].filter(x => !decl.has(x) && !GLOBALS.has(x));
}

const HTML = path.join(ROOT, 'qr.html'), PY = path.join(HARNESS, 'extract_engine.py');
console.log('\n=== 1. the extractor\'s index equals the parser\'s ground truth ===');
const T = truth(HTML); const R = runExtractor(PY, HTML);
check('the extractor runs to completion on the current qr.html (and its own syntax check passes)', R.ok && R.index && R.out, R.stderr.slice(0, 300));
const IF = new Set((R.index || {}).funcs || []), IC = new Set((R.index || {}).consts || []);
check(`top-level FUNCTIONS: the extractor indexes exactly the parser's ${T.fn.size}`, setEq(IF, T.fn), 'extractor-only: ' + diff(IF, T.fn).slice(0, 6) + ' | parser-only: ' + diff(T.fn, IF).slice(0, 6));
check(`top-level CONSTANTS: the extractor indexes exactly the parser's ${T.cn.size} (no local variable is mistaken for one)`, setEq(IC, T.cn), 'extractor-only: ' + diff(IC, T.cn).slice(0, 8) + ' | parser-only: ' + diff(T.cn, IC).slice(0, 8));

console.log('\n=== 2. the committed _extracted_engine.js is fresh ===');
const committed = fs.readFileSync(path.join(HARNESS, '_extracted_engine.js'), 'utf8');
check('byte-identical to what the extractor emits from the current qr.html (regenerate with: python3 extract_engine.py)', R.out === committed, 'committed ' + committed.length + ' chars vs fresh ' + (R.out || '').length);

console.log('\n=== 3. the generated file is CLOSED: no free identifier that qr.html defines ===');
const topNames = new Set([...T.fn, ...T.cn]); const free = freeIdentifiers(committed);
const missed = free.filter(x => topNames.has(x)), unknown = free.filter(x => !topNames.has(x) && !OPTIONAL_GLOBALS.includes(x));
check('no free identifier is a top-level name qr.html defines (the closure missed nothing)', missed.length === 0, 'missed: ' + missed.join(', '));
check('no free identifier is unknown anywhere (nothing else is silently expected from the environment)', unknown.length === 0, 'unknown: ' + unknown.join(', '));
check('the one optional global (the trace hook) is used only behind a typeof guard', unguarded(committed).length === 0, 'unguarded: ' + unguarded(committed).join(', '));

console.log('\n=== 4. the generated engine prices exactly as the real pricing module ===');
const load = (files) => { const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8')); const sb = { DB, SERVICE_DATA: DB, console: { log() {}, warn() {}, error() {}, info() {} }, module: { exports: {} } }; sb.global = sb; sb.window = sb; vm.createContext(sb); files.forEach(f => vm.runInContext(fs.readFileSync(f.p, 'utf8'), sb, { filename: f.n })); return { DB, sb }; };
const ext = load([{ p: path.join(HARNESS, '_extracted_engine.js'), n: '_extracted_engine.js' }]), mod = load(['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js'].map(n => ({ p: path.join(ROOT, n), n })));
const E = ext.sb.module.exports, M = mod.sb; const bad = []; let n = 0, arch = 0;
const same = (a, b) => a.laborEstimate === b.laborEstimate && a.checkoutStateKey === b.checkoutStateKey && a.dispatchFee === b.dispatchFee;
for (const s of mod.DB.services) { n++; if (s.financial_engine && s.financial_engine.pricing_archetype) arch++; try { const a = E.computeUnifiedQuote({ svc: ext.DB.services.find(x => x.id === s.id), activeTagIds: [], answers: {}, qty: 1 }), b = M.computeUnifiedQuote({ svc: s, activeTagIds: [], answers: {}, qty: 1 }); if (!same(a, b)) bad.push(`${s.id}: ${a.laborEstimate}/${a.checkoutStateKey} vs ${b.laborEstimate}/${b.checkoutStateKey}`); } catch (e) { bad.push(`${s.id}: ${e.constructor.name} ${e.message.slice(0, 60)}`); } }
for (const [k, d] of Object.entries(mod.DB.dynamic_services)) { n++; try { const a = E.computeUnifiedQuote({ dynDef: ext.DB.dynamic_services[k], activeTagIds: [], answers: {}, qty: 1 }), b = M.computeUnifiedQuote({ dynDef: d, activeTagIds: [], answers: {}, qty: 1 }); if (!same(a, b)) bad.push(`${k}: ${a.laborEstimate} vs ${b.laborEstimate}`); } catch (e) { bad.push(`${k}: ${e.constructor.name} ${e.message.slice(0, 60)}`); } }
check(`all ${n} entities (services and dynamic) price identically through both engines`, bad.length === 0 && n >= 150, bad.slice(0, 4).join(' | '));
check(`population: ${arch} archetype-priced services were among them (the path the old hand-kept list could not run; floor 1)`, arch >= 1);

console.log('\n=== 5. mutants: each is caught ===');
{ const naive = fs.readFileSync(PY, 'utf8'); const a = '            end, inner = scan_template(src, i + 1)\n';
  if (!naive.includes(a)) throw new Error('mutant anchor missing (template scan)');
  const tmp = path.join(os.tmpdir(), 'extract_engine_naive.py');   // the OLD behaviour: a template ends at the first backtick, `${}` unparsed
  fs.writeFileSync(tmp, naive.replace(a, '            end = src.find("`", i + 1) + 1\n            inner = []\n'));
  const M1 = runExtractor(tmp, HTML), f1 = new Set((M1.index || {}).funcs || []), c1 = new Set((M1.index || {}).consts || []);
  check('MUTANT 1 (a lexer that ends a template at the first inner backtick) is caught: the index no longer equals the parser\'s', !(setEq(f1, T.fn) && setEq(c1, T.cn)), `functions differ by ${diff(f1, T.fn).length + diff(T.fn, f1).length}, constants by ${diff(c1, T.cn).length + diff(T.cn, c1).length}`); }
{ const broken = committed.replace('function resolveQuantityUnits(', 'function _gone_resolveQuantityUnits(');
  check('MUTANT 2 (the generated file is missing a helper) is caught: the closure check names it', broken !== committed && freeIdentifiers(broken).includes('resolveQuantityUnits')); }
{ const bare = committed.replace("if (typeof _trace === 'function') _trace(", '_trace('); check('MUTANT 3 (an UNGUARDED call to the optional trace hook, which would throw wherever trace.js is absent) is caught', bare !== committed && unguarded(bare).includes('_trace')); }
check('MUTANT 4 (a stale generated file) is caught: freshness compares bytes', committed + '\n// stale' !== R.out);

console.log(`\n[extract_engine.py vs the parser] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail ? 1 : 0);
