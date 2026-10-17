#!/usr/bin/env node
/**
 * verify_doc_nostale.js -- R-DOC-NOSTALE: a maintained document describes current reality or labels the history it records (T180 7/n).
 *
 * @enforces R-DOC-NOSTALE
 * @enforces R-TEST-CANFAIL
 * @detects DEFECT-TEST-CANTFAIL
 *
 * THE RULE (Charter, Part IV): "A maintained document describes current reality or clearly labels the historical state it records. References to supposedly current files, directories, Rules, defect classes,
 * and implementations must resolve. Retire documents that are neither maintained nor needed as historical evidence; do not carry stale claims forward as current facts." Accomplishment: "path/link checks find
 * no broken current-state references; Rule and defect-class references resolve; historical material is dated or scoped as history."
 *
 * WHAT IS HELD
 *   1. THE MAINTAINED DOCUMENTS are declared below (the ones a fresh session is told to trust as current). In each, every backticked file reference resolves to a file of the repository, from the root, the
 *      document's own directory, or one of the directories the documents use as shorthand (test_harness/, modules/, ssot/, schema/, archive/, the tool directories, legacy/<group>/).
 *   2. A REFERENCE THAT DOES NOT RESOLVE IS A TARGET, AND SAYS SO. The Layer Map and the design note name modules that do not exist yet (the confidence engine, the composer, the recovery engine, the route
 *      builder). Each mention of one is on a line that scopes it as a target (target, not yet, will, next, planned, slice, extract, ...). A mention that reads as present tense fails.
 *   3. RULE, PRINCIPLE AND DEFECT-CLASS CODES RESOLVE in the Charter. A code the Charter renamed resolves through its alias map (charter_model.js RENAMED_CODES), because history is append-only; a prefix used as
 *      shorthand for a family (R-CONF-*, R-CONF as in "R-CONF-" followed by an asterisk) is accepted only when at least one Rule has that prefix.
 *   4. HISTORICAL DOCUMENTS ARE SCOPED. The plan documents that name files which never existed or no longer do (SESSION_PLAN.md, RESHAPE_SCOPE_S1_S6.md) open with a status or a filing date; they are history
 *      or a filed plan, not current-state claims, and their references are not required to resolve. A new root document with unresolved references and no status line fails.
 *   5. THE FINDING. The design note said the original `then` maps were "preserved verbatim in ssot/migration/legacy_encodings.json". No such file was ever written. It was found by this check and corrected.
 *   6. NON-VACUITY (R-TEST-CANFAIL): the checker finds a path that does not exist, a Rule code the Charter does not have, a target module in the present tense, and a renamed code it must accept; and the
 *      mutation "restore the false sentence" is found.
 *
 * NOT COVERED (named): whether a sentence that resolves is still TRUE (a claim about behavior is the job of the test that holds the behavior); links to the web (the site's own pages are checked by the
 * workflow that deploys them); documents outside the declared list (adding one to MAINTAINED is the act of promising it is current). Node only; no browser, no network.
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = process.env.BTNYC_ROOT ? path.resolve(process.env.BTNYC_ROOT) : path.resolve(__dirname, '..');
const { RENAMED_CODES } = require('./charter_model.js');
let passed = 0, failed = 0;
const check = (label, ok, detail) => { if (ok) { passed++; console.log('  ✓ ' + label); } else { failed++; console.log('  ✗ ' + label + (detail ? ' -- ' + detail : '')); } };
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(ROOT, rel));

const MAINTAINED = ['COMPONENT_LAYER_MAP.md', 'HANDOFF_CURRENT_STATE.md', 'ssot/ENTITY_FIRST_DESIGN_NOTE.md', 'ssot/COVERAGE_REPORT.md', 'ssot/MIGRATION_REPORT.md', 'ssot/TRANSITION_DUALSOURCE.md', 'legacy/README.md'];
const HISTORICAL = ['SESSION_PLAN.md', 'RESHAPE_SCOPE_S1_S6.md'];
const SHORTHAND_DIRS = ['', 'test_harness/', 'modules/', 'ssot/', 'ssot/migration/', 'ssot/derived/', 'schema/', 'archive/', 'test_harness/tools/', 'test_harness/tools/entity_first/', 'legacy/', 'legacy/catalogs/', 'legacy/pages/', 'legacy/qqb/', '.github/workflows/'];
// modules the Layer Map names as targets of the migration (not yet files)
const TARGET_MODULES = ['confidence_engine.js', 'composer.js', 'recovery_engine.js', 'route_builder.js'];
const SCOPES = /\b(target|targets|not yet|will|next|planned|slice|extract|extracted|to be|future|the map|pending|is the|are the|owns|own|moves?|move|do not|must not|never)\b/i;

const FILE_REF = /`([A-Za-z0-9_.\/@-]+\.(?:js|json|md|html|py|tsv|txt|sh|css|yml))`/g;
const refsOf = text => [...new Set([...text.matchAll(FILE_REF)].map(m => m[1]))];
const resolves = (ref, doc) => SHORTHAND_DIRS.some(d => exists(d + ref)) || exists(path.join(path.dirname(doc), ref));
const unresolved = (text, doc) => refsOf(text).filter(r => !resolves(r, doc));

const charter = read('PROJECT_CHARTER.html');
// a code is defined where the Charter gives it an anchor or a heading span; the publisher's own gates (G-SOURCE, G-COMPAT, ...) are defined in publish.js and share the G- prefix, so they resolve there
const codes = new Set([...charter.matchAll(/id="((?:R|G|P)-[A-Z0-9-]+)"/g)].map(m => m[1]).concat([...charter.matchAll(/class="rule-code">((?:R|G|P)-[A-Z0-9-]+)</g)].map(m => m[1])));
const publishGates = new Set([...read('test_harness/tools/entity_first/publish.js').matchAll(/\bG-[A-Z]+\b/g)].map(m => m[0]));
const defects = new Set([...charter.matchAll(/\bDEFECT-[A-Z0-9]+(?:-[A-Z0-9]+)*/g)].map(m => m[0]));
const CODE_REF = /\b((?:R|G|P)-[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*)(-\*)?/g;
// codes in `text` that do not resolve: not a Charter code, not a renamed one, not a family prefix written with a trailing "-*"
function badCodes(text) {
  const bad = new Set();
  for (const m of text.matchAll(CODE_REF)) {
    const code = m[1], family = !!m[2];
    if (codes.has(code) || publishGates.has(code) || Object.prototype.hasOwnProperty.call(RENAMED_CODES, code)) continue;
    if (family && [...codes].some(c => c.startsWith(code + '-'))) continue;
    // a bare family stem written in prose ("R-CONF") is accepted only when it is the prefix of some Rule and appears as a stem of a listed family
    if ([...codes].some(c => c.startsWith(code + '-')) && /^(R|P)-[A-Z]+$/.test(code)) continue;
    bad.add(code);
  }
  return [...bad];
}
const badDefects = text => [...new Set([...text.matchAll(/\bDEFECT-[A-Z0-9]+(?:-[A-Z0-9]+)*/g)].map(m => m[0]))].filter(d => !defects.has(d));
// target modules mentioned in a line that does not scope them
const unscopedTargets = text => text.split('\n').filter(l => TARGET_MODULES.some(t => l.includes('`' + t + '`')) && !SCOPES.test(l));

console.log('verify_doc_nostale.js');
console.log('\n1. File references in the maintained documents resolve');
const unresolvedByDoc = {};
for (const d of MAINTAINED) {
  check(d + ' exists', exists(d));
  const bad = unresolved(read(d), d).filter(r => !TARGET_MODULES.includes(r));
  unresolvedByDoc[d] = bad;
  check(d + ': ' + refsOf(read(d)).length + ' file references, ' + bad.length + ' that name no file' + (bad.length ? ' (' + bad.join(', ') + ')' : ''), bad.length === 0, bad.join(', '));
}

console.log('\n2. A module that does not exist yet is named as a target');
for (const d of MAINTAINED) {
  const t = read(d), named = TARGET_MODULES.filter(m => t.includes('`' + m + '`'));
  if (!named.length) continue;
  const bad = unscopedTargets(t);
  check(d + ': ' + named.length + ' target module(s) named (' + named.join(', ') + '), each on a line that scopes it as a target', bad.length === 0, bad.map(l => l.trim().slice(0, 120)).join(' | '));
}
check('and none of the target modules exists as a file yet (when one does, it leaves this list and its references must resolve)', TARGET_MODULES.every(m => !SHORTHAND_DIRS.some(d => exists(d + m))), TARGET_MODULES.filter(m => SHORTHAND_DIRS.some(d => exists(d + m))).join(', '));

console.log('\n3. Rule, principle and defect-class codes resolve in the Charter');
check('the Charter defines ' + codes.size + ' codes (rules, governance processes, principles) and names ' + defects.size + ' defect classes; publish.js defines ' + publishGates.size + ' gates of its own', codes.size > 100 && defects.size > 20 && publishGates.has('G-COMPAT'), codes.size + ' codes, ' + defects.size + ' defects');
for (const d of MAINTAINED) {
  const t = read(d), bad = badCodes(t), bd = badDefects(t);
  check(d + ': every code and defect class it cites resolves (' + (bad.concat(bd).join(', ') || 'none unresolved') + ')', bad.length === 0 && bd.length === 0, bad.concat(bd).join(', '));
}

console.log('\n4. Historical documents are scoped as history');
for (const d of HISTORICAL) {
  const head = read(d).split('\n').slice(0, 12).join('\n');
  check(d + ' opens with a status or a filing date (it is history or a filed plan, not a current-state claim)', /\bStatus\b|\bFiled\b|\b20\d\d-\d\d-\d\d\b/.test(head), head.slice(0, 100));
}
{
  const rootDocs = fs.readdirSync(ROOT).filter(f => /\.md$/.test(f));
  const strays = rootDocs.filter(d => !MAINTAINED.includes(d) && !HISTORICAL.includes(d) && !['PENDING_DECISIONS.md', 'TIMELINE.md', 'SECURITY.md', 'css_extras_Privacy_Policy_inline_markdown_code.md', 'README.md'].includes(d)).filter(d => unresolved(read(d), d).length > 0);
  check('no other root document has unresolved file references without being declared (' + (strays.join(', ') || 'none') + ')', strays.length === 0, strays.join(', '));
}

console.log('\n5. The finding: the file the design note named was never written');
{
  const note = read('ssot/ENTITY_FIRST_DESIGN_NOTE.md');
  check('the design note no longer claims the `then` maps are preserved in ssot/migration/legacy_encodings.json', !/preserved verbatim in `ssot\/migration\/legacy_encodings\.json`/.test(note));
  check('... and says where they are (btnyc.json, which the projection reproduces) and what the cutover must do', /original maps are not copied into the source: they are `btnyc\.json`'s own/.test(note) && /the cutover must keep them or declare the normalisation/.test(note));
  check('no file by that name exists, and no tool writes one', !exists('ssot/migration/legacy_encodings.json') && !fs.readdirSync(path.join(ROOT, 'test_harness/tools/entity_first')).some(f => /\.js$/.test(f) && /legacy_encodings/.test(fs.readFileSync(path.join(ROOT, 'test_harness/tools/entity_first', f), 'utf8'))));
}

console.log('\n6. Non-vacuity: each check can fail');
{
  check('the path check finds a file reference that names no file', unresolved('See `ssot/migration/no_such_file.json` for the maps.', 'ssot/X.md').length === 1);
  check('... and accepts one that does (a path relative to the repository, and a name that is shorthand for test_harness/)', unresolved('`qr.html` and `verify_doc_nostale.js`', 'ssot/X.md').length === 0);
  check('the code check finds a Rule code the Charter does not have', badCodes('Held by R-NO-SUCH-RULE.').join() === 'R-NO-SUCH-RULE');
  check('... accepts a renamed governance code and a family written with a star, and a real Rule', badCodes('R-GOVERN-ANTISTALE, R-CONF-*, R-DOC-NOSTALE').length === 0);
  check('... and finds a defect class the Charter does not name', badDefects('see DEFECT-NO-SUCH-CLASS').join() === 'DEFECT-NO-SUCH-CLASS');
  check('the target check finds a target module written as if it existed', unscopedTargets('The route builder is `route_builder.js`, it builds routes.').length === 1);
  check('... and accepts it when the line scopes it as a target', unscopedTargets('`route_builder.js` is the target module the next slice extracts.').length === 0);
  const mutated = read('ssot/ENTITY_FIRST_DESIGN_NOTE.md') + '\nthe original maps are preserved verbatim in `ssot/migration/legacy_encodings.json`.\n';
  check('the original false sentence, restored, is found as an unresolved reference', unresolved(mutated, 'ssot/ENTITY_FIRST_DESIGN_NOTE.md').includes('ssot/migration/legacy_encodings.json'));
}

console.log('\n[Documentation: current-state references resolve; history is labelled] ' + passed + ' passed, ' + failed + ' failed (of ' + (passed + failed) + ' checks)');
process.exit(failed ? 1 : 0);
