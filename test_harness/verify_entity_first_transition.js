#!/usr/bin/env node
/**
 * verify_entity_first_transition.js -- the dual-source transition btnyc.json -> ssot/btnyc_source.json is BOUNDED, and its detector can say complete, not complete, overdue and malformed (T175; R-SYSTEM-DUALSOURCE).
 *
 * @enforces R-SYSTEM-DUALSOURCE
 * @enforces R-GOVERN-TRANSITION
 * @enforces R-SYSTEM-DEPLOY-CONTRACT
 *
 * THE DEFECT-SHAPE. "Both are authoritative" drifts into a steady state: two live sources, no owner, no end, no way to know when the old one can go. R-SYSTEM-DUALSOURCE asks for six fields in a ledger
 * (start, owner, completion condition, detector, expected cost, target end date) and a detector that returns complete / not-complete, and forbids silent extension past the end date.
 *
 * WHAT IS HELD:
 *   1. The ledger (ssot/TRANSITION_DUALSOURCE.md) carries all six fields, a readable start and end, and a consumer list in which every pattern matches something (a list of nothing proves nothing),
 *      unless the transition is already COMPLETE.
 *   2. The detector says each thing it claims, on fixtures (reconciled T176: the completion condition is the Charter's end state, not "btnyc.json is gone"). COMPLETE only when all five hold: the
 *      artifact (btnyc.json) carries a `$source` provenance reference whose hash is the source's hash now and holds none of the hybrid's compiler-owned keys; the publish command exists and its --check passes;
 *      the tools that exist only because there are two sources are deleted; no runtime consumer names the authored source; one consumer reads the artifact. NOT COMPLETE names each condition that fails, one
 *      fixture per condition (including a stale provenance hash, a hybrid that merely gained a `$source`, and a publish command that exits non-zero). OVERDUE after the end date; MALFORMED when any one of the six
 *      fields, the artifact line, the publish line or the retired-tools line is missing, the ledger is missing, or a reauthorization gives no reason. A reauthorization with a reason and a later date moves OVERDUE
 *      back to NOT COMPLETE; an edit that merely moves the Target end date later is the only silent extension a text file allows, so reauthorizations are the one way the detector honours.
 *   3. The suite fails on the real repository when the transition is OVERDUE or its ledger is MALFORMED: after the end date someone must close it, reauthorize it with a reason, or roll it back.
 *      (This is a calendar tripwire by design. It does not fail while the transition is open and inside its dates.)
 *
 * Node only; no browser, no network.
 */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const ROOT = process.env.BTNYC_ROOT ? path.resolve(process.env.BTNYC_ROOT) : path.resolve(__dirname, '..');
const EF = path.join(__dirname, 'tools', 'entity_first');
const T = require(path.join(EF, 'transition_status.js'));

let passed = 0, failed = 0;
const check = (label, ok, detail) => { if (ok) { passed++; console.log(`  ✓ ${label}`); } else { failed++; console.log(`  ✗ ${label}${detail ? ' -- ' + detail : ''}`); } };

const LEDGER = fs.readFileSync(path.join(ROOT, 'ssot', 'TRANSITION_DUALSOURCE.md'), 'utf8');

// ---- 1. the real ledger -------------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('The real ledger');
const parsed = T.parseLedger(LEDGER);
check('all six fields are present and non-empty (start, owner, completion condition, detector, expected cost, target end date)', T.FIELDS.every(f => parsed.fields[f]) && parsed.problems.length === 0, parsed.problems.join('; '));
check('the start and the end are dates and the end is after the start', /\d{4}-\d{2}-\d{2}/.test(parsed.fields.Start) && parsed.endDate > /(\d{4}-\d{2}-\d{2})/.exec(parsed.fields.Start)[1], `${parsed.fields.Start} .. ${parsed.endDate}`);
check('the Detector field names the command that runs the detector', /transition_status\.js/.test(parsed.fields.Detector));
// The end date is not inferable from the repository, so the ledger must say whose it is: the Operator's, with the date of the ruling, or a default still awaiting one. An unattributed date reads as a decision nobody made.
const attributed = line => /Set by the Operator on \d{4}-\d{2}-\d{2}/.test(line) || /\bdefault\b[^.]*\b(awaiting|Operator is asked)/i.test(line);
const endLine = LEDGER.split('\n').find(l => /\*\*Target end date:\*\*/.test(l));
check('the Target end date says whose it is: set by the Operator on a stated date, or a default awaiting the Operator (it is not inferable from the repository)', attributed(endLine), endLine.slice(0, 120));
check('...and that check can say no: a date with neither an Operator ruling nor the word default is unattributed, and so is a default that is not awaiting anyone', !attributed('- **Target end date:** 2027-06-30. After this date the transition must be closed.') && !attributed('- **Target end date:** 2027-06-30. This is a default of mine.'));
const real = T.status(ROOT);
// The completion condition must be the Charter's end state. T175 wrote "btnyc.json is removed from the repository root", which contradicted the Charter's naming of btnyc.json as the derived artifact.
check('the completion condition names the provenance reference and the publish check, and does not require the file to be removed (the retired thing is a role, not the name btnyc.json)', /\$source/.test(parsed.fields['Completion condition']) && /publish command/.test(parsed.fields['Completion condition']) && !/is (then )?removed from the repository root/.test(parsed.fields['Completion condition']), parsed.fields['Completion condition'].slice(0, 160));
check('the ledger names btnyc.json as the artifact (the Charter\'s name), a publish command, and the retired tools', parsed.artifact === 'btnyc.json' && /\.js$/.test(parsed.publish || '') && parsed.retired.length >= 4, JSON.stringify([parsed.artifact, parsed.publish, parsed.retired.length]));
check('every retired tool listed is a real file while the transition is open (a stale list would let "gone" pass vacuously)', real.verdict === 'COMPLETE' || parsed.retired.every(f => fs.existsSync(path.join(ROOT, f))), parsed.retired.filter(f => !fs.existsSync(path.join(ROOT, f))).join(','));

check(`every listed consumer pattern matches at least one file (${parsed.consumers.length} patterns), unless the transition is complete`, real.verdict === 'COMPLETE' || parsed.consumers.every(p => (function expand() { const f = path.join(ROOT, p); if (!p.includes('*')) return fs.existsSync(f); const d = path.join(ROOT, path.dirname(p)); return fs.existsSync(d) && fs.readdirSync(d).some(x => new RegExp('^' + path.basename(p).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$').test(x)); })()), parsed.consumers.join(', '));

// ---- 2. the detector, on fixtures ----------------------------------------------------------------------------------------------------------------------------------------------------
console.log('\nThe detector says each thing it claims');
const lib = require(path.join(EF, 'lib.js'));
const SOURCE_TEXT = '{"fixture":"source"}\n';
function fixture(opts = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ef-tr-'));
  const put = (f, text) => { fs.mkdirSync(path.join(d, path.dirname(f)), { recursive: true }); fs.writeFileSync(path.join(d, f), text); };
  put('ssot/TRANSITION_DUALSOURCE.md', opts.ledger !== undefined ? opts.ledger : LEDGER);
  put('ssot/btnyc_source.json', SOURCE_TEXT);
  for (const f of ['qr.html', 'modules/a.js', 'modules/b.js']) put(f, (opts.consumers && opts.consumers[f]) || (opts.reading === false ? '// nothing relevant\n' : '// reads btnyc.json\n'));
  const prov = Object.assign({ path: 'ssot/btnyc_source.json', sha256: lib.sha(SOURCE_TEXT), source_schema_version: '1.0.0', derivation_version: '1.0.0' }, opts.prov || {});
  const art = Object.assign({ $source: prov, graph: {} }, opts.artifact || {}); if (opts.noProvenance) delete art.$source;
  if (opts.artifactText !== undefined) put('btnyc.json', opts.artifactText); else if (!opts.noArtifact) put('btnyc.json', JSON.stringify(art));
  if (!opts.noPublish) put('test_harness/tools/entity_first/publish.js', `process.exit(${opts.publishExit || 0});\n`);
  for (const f of opts.retiredPresent || []) put(f, '// legacy\n');
  if (opts.noLedger) fs.rmSync(path.join(d, 'ssot', 'TRANSITION_DUALSOURCE.md'));
  return d;
}
const withFixture = (opts, fn) => { const d = fixture(opts); try { return fn(d); } finally { fs.rmSync(d, { recursive: true, force: true }); } };
// The dates are derived from the real ledger's end date, so moving the end date (the Operator did, at T176) does not make these fixtures lie: BEFORE is inside the period, AFTER is 60 days past
// the end, NEWEND is a later date a reauthorization could name.
const addDays = (iso, n) => new Date(new Date(iso + 'T12:00:00Z').getTime() + n * 86400000);
const BEFORE = new Date('2026-12-01T12:00:00Z'), AFTER = addDays(parsed.endDate, 60), NEWEND = addDays(parsed.endDate, 365).toISOString().slice(0, 10);
const RETIRED = parsed.retired;
check('the fixture dates are consistent with the real ledger (BEFORE is after the start and before the end; AFTER is past the end)', BEFORE.toISOString().slice(0, 10) > /(\d{4}-\d{2}-\d{2})/.exec(parsed.fields.Start)[1] && BEFORE.toISOString().slice(0, 10) < parsed.endDate && AFTER.toISOString().slice(0, 10) > parsed.endDate, `${parsed.endDate}`);
const notComplete = (label, opts, re) => withFixture(opts, d => { const r = T.status(d, BEFORE); check(label, r.verdict === 'NOT COMPLETE' && r.code === 1 && (r.reasons || []).some(x => re.test(x)), JSON.stringify([r.verdict, r.reasons, r.problems])); });

withFixture({}, d => { const r = T.status(d, BEFORE); check('COMPLETE: provenance matches the source, no hybrid keys, publish --check passes, the legacy tools are gone, no consumer reads the source, one reads the artifact (exit 0)', r.verdict === 'COMPLETE' && r.code === 0, JSON.stringify(r.reasons)); });
withFixture({}, d => { const r = T.status(d, AFTER); check('COMPLETE stays COMPLETE after the end date (a finished transition is not overdue)', r.verdict === 'COMPLETE'); });
withFixture({}, d => { check('a COMPLETE artifact is still named btnyc.json (the Charter\'s name): completion does not require the file to disappear', fs.existsSync(path.join(d, 'btnyc.json')) && T.status(d, BEFORE).verdict === 'COMPLETE'); });
notComplete('NOT COMPLETE: no artifact at all', { noArtifact: true }, /btnyc\.json does not exist/);
notComplete('NOT COMPLETE: the artifact is not valid JSON', { artifactText: '{ not json' }, /not valid JSON/);
notComplete('NOT COMPLETE: the artifact carries no $source (it is still the hybrid)', { noProvenance: true }, /carries no \$source/);
notComplete('NOT COMPLETE: $source lacks a required field (the hash)', { prov: { sha256: '' } }, /\$source lacks sha256/);
notComplete('NOT COMPLETE: $source lacks the derivation version', { prov: { derivation_version: '' } }, /\$source lacks derivation_version/);
notComplete('NOT COMPLETE: the provenance hash is not the hash of the source now (a stale artifact)', { prov: { sha256: 'a'.repeat(64) } }, /not the hash of the source as it is now/);
notComplete('NOT COMPLETE: a hybrid that merely gained a $source is not purely derived (it still holds compiler-owned keys)', { artifact: { compiled: {}, routing_archetypes: {} } }, /compiler-owned keys \(compiled, routing_archetypes\)/);
notComplete('NOT COMPLETE: the publish command does not exist', { noPublish: true }, /publish command .* does not exist/);
notComplete('NOT COMPLETE: the publish command exists and its --check fails (exit 1)', { publishExit: 1 }, /--check exits 1/);
notComplete('NOT COMPLETE: a legacy authoring tool is still present, and it is named', { retiredPresent: [RETIRED[0]] }, new RegExp('still present: ' + RETIRED[0].replace(/[.\/]/g, '\\$&')));
notComplete('NOT COMPLETE: every retired tool present is counted', { retiredPresent: RETIRED }, new RegExp(RETIRED.length + ' tool\\(s\\)'));
notComplete('NOT COMPLETE: a runtime consumer names the authored source (the Charter: never the authored source as a fallback), with its count', { consumers: { 'qr.html': 'fetch("ssot/btnyc_source.json"); // btnyc.json\n' } }, /qr\.html names the authored source btnyc_source \(1 reference\)/);
notComplete('NOT COMPLETE: a glob consumer (modules/*.js) is scanned too, with its count', { consumers: { 'modules/b.js': 'a(btnyc_source); b(btnyc_source);\n' } }, /modules\/b\.js names the authored source btnyc_source \(2 references\)/);
notComplete('NOT COMPLETE: no consumer reads the artifact (nothing proves the artifact is used)', { reading: false }, /no listed consumer reads btnyc\.json/);
withFixture({ noArtifact: true }, d => { const r = T.status(d, AFTER); check('OVERDUE: not complete after the end date, with no reauthorization (exit 3)', r.verdict === 'OVERDUE' && r.code === 3, r.verdict); });
withFixture({ noArtifact: true, ledger: LEDGER.replace('(none yet; each is a line', '(each is a line') + `\n- **Reauthorized ${addDays(parsed.endDate, 30).toISOString().slice(0, 10)}:** the runtime adapter is scheduled for the next quarter; new end date ${NEWEND}\n` }, d => {
  const r = T.status(d, AFTER); check('a reauthorization with a reason and a later date moves OVERDUE back to NOT COMPLETE (the one honoured way to extend)', r.verdict === 'NOT COMPLETE' && r.endDate === NEWEND && r.reauthorizations === 1, JSON.stringify([r.verdict, r.endDate])); });
withFixture({ noArtifact: true, ledger: LEDGER + `\n- **Reauthorized ${addDays(parsed.endDate, 30).toISOString().slice(0, 10)}:** later; new end date ${NEWEND}\n` }, d => {
  const r = T.status(d, AFTER); check('MALFORMED: a reauthorization that gives no real reason does not extend anything (exit 2)', r.verdict === 'MALFORMED' && r.code === 2, JSON.stringify([r.verdict, r.problems])); });
for (const f of T.FIELDS) {
  withFixture({ ledger: LEDGER.replace(new RegExp('^- \\*\\*' + f + ':\\*\\*.*$', 'm'), '') }, d => { const r = T.status(d, BEFORE); check(`MALFORMED: the ledger without its "${f}" field (exit 2)`, r.verdict === 'MALFORMED' && r.code === 2 && r.problems.some(p => p.includes(f)), JSON.stringify([r.verdict, r.problems])); });
}
for (const [label, re, what] of [['Artifact', /^\*\*Artifact:\*\*.*$/m, 'artifact line'], ['Publish command', /^\*\*Publish command:\*\*.*$/m, 'publish command line'], ['Retired with it', /^\*\*Retired with it:\*\*.*$/m, 'retired-tools line'], ['Consumers', /^\*\*Consumers:\*\*.*$/m, 'consumers line']]) {
  withFixture({ ledger: LEDGER.replace(re, '') }, d => { const r = T.status(d, BEFORE); check(`MALFORMED: a ledger with no ${what} (the completion conditions cannot be evaluated; exit 2)`, r.verdict === 'MALFORMED' && r.code === 2, JSON.stringify([r.verdict, r.problems])); });
}
withFixture({ ledger: LEDGER.replace(/^- \*\*Target end date:\*\*.*$/m, '- **Target end date:** whenever it is done') }, d => { const r = T.status(d, BEFORE); check('MALFORMED: an end date that is not a date', r.verdict === 'MALFORMED'); });
withFixture({ noLedger: true }, d => { const r = T.status(d, BEFORE); check('MALFORMED: a dual-source period with no ledger at all', r.verdict === 'MALFORMED' && r.code === 2); });
withFixture({ noArtifact: true }, d => {
  const run = env => cp.spawnSync('node', [path.join(EF, 'transition_status.js')], { encoding: 'utf8', env: Object.assign({}, process.env, { BTNYC_ROOT: d }, env) });
  const r = run({}); check('the command line exits 1 for NOT COMPLETE (or 3 once the real date is past the fixture end date) and prints the verdict', [1, 3].includes(r.status) && /dual-source transition: (NOT COMPLETE|OVERDUE)/.test(r.stdout), `exit ${r.status}: ${r.stdout.slice(0, 120)}`); });
withFixture({}, d => {
  const r = cp.spawnSync('node', [path.join(EF, 'transition_status.js')], { encoding: 'utf8', env: Object.assign({}, process.env, { BTNYC_ROOT: d }) });
  check('the command line exits 0 and prints COMPLETE for a complete fixture', r.status === 0 && /dual-source transition: COMPLETE/.test(r.stdout), `exit ${r.status}: ${r.stdout.slice(0, 120)}`); });

// ---- 3. the tripwire on the real repository --------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('\nThe real transition');
check(`the real transition is ${real.verdict}${real.endDate ? ` (target end ${real.endDate}, today ${real.today})` : ''}: not MALFORMED, and not OVERDUE (after the end date: close it, reauthorize it in the ledger with a reason, or roll it back)`, real.verdict === 'COMPLETE' || real.verdict === 'NOT COMPLETE', (real.problems || []).join('; ') || 'overdue');

console.log(`\n[Entity-first dual-source transition] ${passed} passed, ${failed} failed (of ${passed + failed} checks)`);
process.exit(failed ? 1 : 0);
