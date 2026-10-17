#!/usr/bin/env node
/**
 * verify_compiler_not_test.js -- R-SYSTEM-COMPILER-NOT-TEST: behavioral tests do not use the compiler to manufacture their expected results (T180 7/n).
 *
 * @enforces R-SYSTEM-COMPILER-NOT-TEST
 * @enforces R-TEST-CANFAIL
 * @detects DEFECT-TEST-CANTFAIL
 *
 * THE RULE (Charter, Part IV): "Tests of runtime behavior or source/output contracts must not invoke the production compiler to create the expected result they then compare against ... Those tests use
 * independently authored expectations, known fixtures, or a separately defined contract. The compiler itself must still have direct tests of derivation, determinism, preservation of curated knowledge, and
 * invalid-input rejection. Validation tests invoke validation independently of derivation, as required by R-INVARIANT-DERIVATION." Accomplishment: "behavioral and contract tests can run without invoking
 * derivation to manufacture expected values; compiler tests separately demonstrate both correct output and failure on deliberately invalid or changed input."
 *
 * "THE COMPILER" is every tool that produces a generated representation from an authored one: the migration (migrate_legacy.js), the projection (project_legacy.js), the derivation (derive_graph.js), the
 * publisher (publish.js), the compile round trip (compiler_roundtrip.js), the splice (splice_compiled.py) and the Python catalog compiler (btnyc_v*_compiler.py).
 *
 * WHAT IS HELD (a ratchet and a coverage check; the judgment of each test's role is recorded in the table below, not inferred):
 *   1. THE SCAN. Every test file in test_harness/ is read; a line that require()s or spawns a compiler tool (comments and prose do not count) puts the file on the measured list. At T180 that is 13 of 222
 *      files. Every file on the list is DECLARED below with its role -- `compiler` (it tests the compiler: its output is the thing under test, and the expectation comes from elsewhere) or `contract` (it tests
 *      a consumer or a contract and uses a compiler tool only as stated). A test that starts invoking a compiler without being declared fails here; the declaration is where its author says why.
 *   2. THE CONTRACT TESTS ARE CLEAN. A file declared `contract` does not CALL the compiler tool (no derive/project/migrate/run call); it names it only to check the file exists. The one such file today is
 *      verify_resolver_module.js, whose expected values come from btnyc.json, and which says so in its header.
 *   3. THE COMPILER IS TESTED DIRECTLY: derivation, determinism, preservation of curated knowledge, invalid-input rejection -- each by at least one declared compiler test whose text carries the marks of it.
 *   4. VALIDATION IS INDEPENDENT OF DERIVATION (R-INVARIANT-DERIVATION): validate_source.js requires none of the compiler tools.
 *   5. NON-VACUITY (R-TEST-CANFAIL): the scan finds a require and a spawn and ignores a comment; a behavioral test with a compiler call added is found as undeclared; a `contract` file that gains a call
 *      is found; a coverage list with a category emptied is found.
 *
 * WHAT THIS DOES NOT PROVE (named): that every declared `compiler` test compares against an independently authored expectation. That is a reading of each test; the table says what each compares against so a
 * reviewer can check one line rather than one file. OBSERVED, not asserted: verify_archetype_layer_phase1.js runs the Python compiler from a path that no longer exists (the compiler moved to test_harness/ in
 * T164), so its last section throws; it is on the known-red baseline and is a compiler test, not a behavioral one.
 * Node only; no browser, no network.
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = process.env.BTNYC_ROOT ? path.resolve(process.env.BTNYC_ROOT) : path.resolve(__dirname, '..');
const HARNESS = path.join(ROOT, 'test_harness');
let passed = 0, failed = 0;
const check = (label, ok, detail) => { if (ok) { passed++; console.log('  ✓ ' + label); } else { failed++; console.log('  ✗ ' + label + (detail ? ' -- ' + detail : '')); } };

const TOOLS = /(derive_graph|migrate_legacy|project_legacy|compiler_roundtrip|splice_compiled|btnyc_v\d+_compiler|(?<![\w.])publish\.js)/;
const INVOKE = /require\(|spawnSync|execFileSync|execSync|\bspawn\(|runpy/;
const isProse = l => /^\s*(\/\/|\*|\/\*)/.test(l);

// the scan: lines that bring a compiler tool into the test (a require or a spawn that names it), prose excluded
function invocations(text) {
  const out = [];
  text.split('\n').forEach((l, i) => { if (!isProse(l) && INVOKE.test(l) && TOOLS.test(l)) out.push({ line: i + 1, tool: TOOLS.exec(l)[1].replace('.js', '') }); });
  return out;
}
// a call INTO a compiler tool's API (beyond requiring it): the verbs the tools export
const CALLS = /\b(?:derive|migrate|project|publish|run|runRoundtrip|compile)\s*\(/;
const callsCompiler = text => text.split('\n').filter(l => !isProse(l) && CALLS.test(l) && /\b(D|P|PL|M|derive_graph|project_legacy|migrate_legacy|projected|publish)\b/.test(l)).length;

// ---- the declaration: every test that invokes a compiler tool, its role, what it compares against, and what it demonstrates of the compiler ------------------------------------------------
const DECLARED = {
  'verify_archetype_layer_phase1.js':               { role: 'compiler', covers: [],                                    against: "the compiler's own mismatch report (stale: see the header)" },
  'verify_compiled_output_against_real_schema.js':  { role: 'compiler', covers: ['rejection'],                         against: 'the real schema (an independently authored contract)' },
  'verify_complexity_axes.js':                      { role: 'compiler', covers: ['preservation', 'rejection'],         against: 'ssot/migration/complexity_axes.json, authored by hand from the Charter' },
  'verify_confidence_declared.js':                  { role: 'compiler', covers: ['rejection'],                         against: 'mutants of the source: the compiler must refuse each' },
  'verify_entity_first_independent.js':             { role: 'compiler', covers: ['derivation', 'determinism'],         against: 'a hand-written world W and an independent reader' },
  'verify_entity_first_migration.js':               { role: 'compiler', covers: ['determinism', 'preservation'],       against: 'btnyc.json (the projection must reproduce every authored section)' },
  'verify_entity_first_pricing_rules.js':           { role: 'compiler', covers: ['preservation'],                      against: 'the recovered rules file and the legacy engine\'s constants' },
  'verify_entity_first_publish.js':                 { role: 'compiler', covers: ['rejection'],                         against: 'each publish gate, shown able to fail' },
  'verify_entity_first_references.js':              { role: 'compiler', covers: ['rejection'],                         against: 'invalid sources: the compiler must refuse them' },
  'verify_entity_first_vocabulary.js':              { role: 'compiler', covers: ['determinism', 'preservation'],       against: 'reordered copies of the source; the legacy vocabulary' },
  'verify_fixed_point.js':                          { role: 'compiler', covers: ['determinism'],                       against: 'the compiler\'s own second run' },
  'verify_raw_vs_compiled_reconciliation.js':       { role: 'compiler', covers: ['preservation'],                      against: 'the raw catalog\'s intake chains' },
  'verify_resolver_module.js':                      { role: 'contract', covers: [],                                    against: 'btnyc.json (the legacy decision the module replaces); project_legacy.js is only checked to exist' },
};
// what a test must carry to count for each thing the compiler must be shown to do
const MARKS = {
  derivation: /independent|hand-written|derive\(/i,
  determinism: /reproducible|byte-identical|second (run|derivation|--update)|deterministic|hash.?seed/i,
  preservation: /parity|reproduces every authored|agree|preserv|reconcil|carried/i,
  rejection: /refus|reject|InvalidSourceError|must fail|fails? (the|on)/i,
};

console.log('verify_compiler_not_test.js');
// this file is not scanned: its non-vacuity fixtures are strings that name compiler tools on purpose
const files = fs.readdirSync(HARNESS).filter(f => /^verify_.*\.js$/.test(f) && f !== path.basename(__filename)).sort();
const text = f => fs.readFileSync(path.join(HARNESS, f), 'utf8');

const coverage = decl => { const c = {}; for (const cat of Object.keys(MARKS)) c[cat] = Object.entries(decl).filter(([f, d]) => d.role === 'compiler' && d.covers.includes(cat) && MARKS[cat].test(text(f))).map(([f]) => f); return c; };

console.log('\n1. The scan: every test that invokes a compiler tool is declared');
const measured = {}; for (const f of files) { const inv = invocations(text(f)); if (inv.length) measured[f] = inv; }
const undeclared = Object.keys(measured).filter(f => !DECLARED[f]);
const gone = Object.keys(DECLARED).filter(f => !measured[f]);
check('the scan read ' + files.length + ' test files (this one excepted: its fixtures name compiler tools on purpose) and found ' + Object.keys(measured).length + ' that require or spawn a compiler tool', files.length > 200 && Object.keys(measured).length === 13, files.length + ' files, ' + Object.keys(measured).length + ' invoking');
check('every one of them is declared with a role in this file (undeclared: ' + (undeclared.join(', ') || 'none') + ')', undeclared.length === 0, undeclared.map(f => f + ' [' + measured[f].map(m => m.tool + '@' + m.line).join(', ') + ']').join('; '));
check('every declaration still describes a test that invokes a compiler (a stale declaration is removed: ' + (gone.join(', ') || 'none stale') + ')', gone.length === 0, gone.join(', '));
check('every declared test is a real file, and every declaration states what the test compares against', Object.entries(DECLARED).every(([f, d]) => files.includes(f) && d.against && d.against.length > 10 && ['compiler', 'contract'].includes(d.role)));

console.log('\n2. The contract and behavioral tests do not call the compiler');
{
  const contract = Object.entries(DECLARED).filter(([, d]) => d.role === 'contract').map(([f]) => f);
  check('the files declared `contract` are: ' + contract.join(', '), contract.length >= 1);
  for (const f of contract) {
    const t = text(f), inv = invocations(t), calls = callsCompiler(t);
    check(f + ' names the tool (' + inv.map(i => i.tool).join(', ') + ') and calls none of its functions', calls === 0, calls + ' call line(s)');
    check(f + ' says in its header that it is independent of the derivation', /independent of the derivation|nothing here calls derive_graph/i.test(t.slice(0, 3000)));
  }
  // and, for the whole behavioral estate: the runtime-behavior tests (golden master, quote, route, resolver, page) never reach a compiler
  const behavioral = files.filter(f => !measured[f]);
  check('the other ' + behavioral.length + ' test files (the runtime-behavior, price, route, page and record tests) invoke no compiler tool at all', behavioral.length === files.length - Object.keys(measured).length);
}

console.log('\n3. The compiler has direct tests of what the Rule names');
{
  const covered = coverage(DECLARED);
  for (const cat of Object.keys(MARKS)) check(cat + ': demonstrated by ' + covered[cat].length + ' declared compiler test(s) whose text carries it (' + covered[cat].map(f => f.replace(/^verify_|\.js$/g, '')).join(', ') + ')', covered[cat].length >= 1);
  check('both halves of "correct output and failure on invalid or changed input" are present (a test that derives correctly and a test that refuses)', covered.derivation.length >= 1 && covered.rejection.length >= 1);
}

console.log('\n4. Validation is independent of derivation (R-INVARIANT-DERIVATION)');
{
  const v = fs.readFileSync(path.join(HARNESS, 'tools', 'entity_first', 'validate_source.js'), 'utf8');
  const reqs = [...v.matchAll(/require\(([^)]*)\)/g)].map(m => m[1]);
  check('validate_source.js requires: ' + reqs.join(', ') + ' -- none is a compiler tool', reqs.length > 0 && !reqs.some(r => TOOLS.test(r)), reqs.join(', '));
}

console.log('\n5. Non-vacuity: each check can fail');
{
  const behavioralSample = text('verify_resolver_wiring.js');
  check('the scan finds a require of a compiler tool', invocations("const D = require(path.join(EF, 'derive_graph.js'));").length === 1);
  check('... and a spawn of one', invocations("cp.spawnSync(process.execPath, [path.join(EF, 'publish.js'), '--check']);").length === 1);
  check('... and ignores a comment and prose that name one', invocations("// requires derive_graph.js\n * spawnSync publish.js in prose").length === 0);
  check('a behavioral test with a compiler call added is found, and is undeclared', (() => { const t = behavioralSample + "\nconst D = require(path.join(EF, 'derive_graph.js')); const expected = D.derive(src);\n"; return invocations(t).length === 1 && !DECLARED['verify_resolver_wiring.js']; })());
  check('a `contract` file that gains a call into the compiler is found by the call scan', callsCompiler(text('verify_resolver_module.js') + "\nconst expected = projected.project(L);\n") > callsCompiler(text('verify_resolver_module.js')));
  check('a declaration table with a category emptied is found by the coverage check (no determinism test declared -> determinism uncovered)', (() => { const stripped = Object.fromEntries(Object.entries(DECLARED).map(([f, d]) => [f, { ...d, covers: d.covers.filter(c => c !== 'determinism') }])); return coverage(stripped).determinism.length === 0 && coverage(DECLARED).determinism.length > 0; })());
  check('a test whose text carries no mark of rejecting anything does not count for rejection', !MARKS.rejection.test('check("the output is the same", a === b);'));
  check('the real tree passes the same scan without the mutations (the findings above are the mutations\' doing)', undeclared.length === 0 && callsCompiler(text('verify_resolver_module.js')) === 0);
}

console.log('\n[Compiler is not the test: behavioral tests do not manufacture expected results] ' + passed + ' passed, ' + failed + ' failed (of ' + (passed + failed) + ' checks)');
process.exit(failed ? 1 : 0);
