#!/usr/bin/env node
/**
 * verify_entity_first_transition.js -- the dual-source transition btnyc.json -> ssot/btnyc_source.json is BOUNDED, and its detector can say complete, not complete, overdue and malformed (T175; R-SYSTEM-DUALSOURCE).
 *
 * @enforces R-SYSTEM-DUALSOURCE
 * @enforces R-GOVERN-TRANSITION
 *
 * THE DEFECT-SHAPE. "Both are authoritative" drifts into a steady state: two live sources, no owner, no end, no way to know when the old one can go. R-SYSTEM-DUALSOURCE asks for six fields in a ledger
 * (start, owner, completion condition, detector, expected cost, target end date) and a detector that returns complete / not-complete, and forbids silent extension past the end date.
 *
 * WHAT IS HELD:
 *   1. The ledger (ssot/TRANSITION_DUALSOURCE.md) carries all six fields, a readable start and end, and a consumer list in which every pattern matches something (a list of nothing proves nothing),
 *      unless the transition is already COMPLETE.
 *   2. The detector says each thing it claims, on fixtures: COMPLETE when every listed consumer reads the derived graph, none names btnyc.json and btnyc.json is gone; NOT COMPLETE (naming the files)
 *      when a consumer still names it, when none reads the graph, or when btnyc.json is still live; OVERDUE after the end date; MALFORMED when any one of the six fields is missing, the ledger is missing,
 *      or a reauthorization gives no reason. A reauthorization with a reason and a later date moves OVERDUE back to NOT COMPLETE; an edit that merely moves the Target end date later is the only silent
 *      extension a text file allows, so reauthorizations are the one way the detector honours.
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
check('the Target end date says it is a default awaiting the Operator, not a decision (it is not inferable from the repository)', /default/i.test(LEDGER.split('\n').find(l => /\*\*Target end date:\*\*/.test(l))));
const real = T.status(ROOT);
check(`every listed consumer pattern matches at least one file (${parsed.consumers.length} patterns), unless the transition is complete`, real.verdict === 'COMPLETE' || parsed.consumers.every(p => (function expand() { const f = path.join(ROOT, p); if (!p.includes('*')) return fs.existsSync(f); const d = path.join(ROOT, path.dirname(p)); return fs.existsSync(d) && fs.readdirSync(d).some(x => new RegExp('^' + path.basename(p).replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$').test(x)); })()), parsed.consumers.join(', '));

// ---- 2. the detector, on fixtures ----------------------------------------------------------------------------------------------------------------------------------------------------
console.log('\nThe detector says each thing it claims');
const CONSUMERS = ['qr.html', 'modules/a.js', 'modules/b.js', 'test_harness/btnyc_v10_compiler.py', 'test_harness/tools/ssot_patch.js', 'test_harness/tools/splice_compiled.py'];
function fixture(opts = {}) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ef-tr-'));
  fs.mkdirSync(path.join(d, 'ssot'), { recursive: true }); fs.writeFileSync(path.join(d, 'ssot', 'TRANSITION_DUALSOURCE.md'), opts.ledger !== undefined ? opts.ledger : LEDGER.replace(/^\*\*Consumers:\*\*.*$/m, '**Consumers:** `qr.html`, `modules/*.js`, `test_harness/btnyc_v10_compiler.py`, `test_harness/tools/ssot_patch.js`, `test_harness/tools/splice_compiled.py`'));
  for (const f of CONSUMERS) { fs.mkdirSync(path.join(d, path.dirname(f)), { recursive: true }); fs.writeFileSync(path.join(d, f), (opts.consumers && opts.consumers[f]) || (opts.reading === false ? '// nothing relevant\n' : '// reads ssot/derived/btnyc_graph.json\n')); }
  if (opts.retiredLive) fs.writeFileSync(path.join(d, 'btnyc.json'), '{}');
  if (opts.noLedger) fs.rmSync(path.join(d, 'ssot', 'TRANSITION_DUALSOURCE.md'));
  return d;
}
const withFixture = (opts, fn) => { const d = fixture(opts); try { return fn(d); } finally { fs.rmSync(d, { recursive: true, force: true }); } };
const BEFORE = new Date('2026-12-01T12:00:00Z'), AFTER = new Date('2027-03-01T12:00:00Z');

withFixture({}, d => { const r = T.status(d, BEFORE); check('COMPLETE: every consumer reads the derived graph, none names btnyc.json, btnyc.json is gone (exit 0)', r.verdict === 'COMPLETE' && r.code === 0, JSON.stringify(r.reasons)); });
withFixture({}, d => { const r = T.status(d, AFTER); check('COMPLETE stays COMPLETE after the end date (a finished transition is not overdue)', r.verdict === 'COMPLETE'); });
withFixture({ consumers: { 'qr.html': 'fetch("btnyc.json"); // and btnyc_graph.json\n' } }, d => { const r = T.status(d, BEFORE); check('NOT COMPLETE: one consumer still names btnyc.json, and it is named with its count (exit 1)', r.verdict === 'NOT COMPLETE' && r.code === 1 && r.reasons.some(x => /qr\.html still names btnyc\.json \(1 reference\)/.test(x)), JSON.stringify(r.reasons)); });
withFixture({ consumers: { 'modules/b.js': 'a(btnyc.json); b(btnyc.json);\n' } }, d => { const r = T.status(d, BEFORE); check('NOT COMPLETE: a glob consumer (modules/*.js) is scanned too, with its count', r.verdict === 'NOT COMPLETE' && r.reasons.some(x => /modules\/b\.js still names btnyc\.json \(2 references\)/.test(x)), JSON.stringify(r.reasons)); });
withFixture({ reading: false }, d => { const r = T.status(d, BEFORE); check('NOT COMPLETE: no consumer reads the derived graph (nothing proves the target is used)', r.verdict === 'NOT COMPLETE' && r.reasons.some(x => /reads the derived graph/.test(x)), JSON.stringify(r.reasons)); });
withFixture({ retiredLive: true }, d => { const r = T.status(d, BEFORE); check('NOT COMPLETE: btnyc.json is still live at the repository root (the retired source is not disconnected)', r.verdict === 'NOT COMPLETE' && r.reasons.some(x => /still live/.test(x)), JSON.stringify(r.reasons)); });
withFixture({ retiredLive: true }, d => { const r = T.status(d, AFTER); check('OVERDUE: not complete after the end date, with no reauthorization (exit 3)', r.verdict === 'OVERDUE' && r.code === 3, r.verdict); });
withFixture({ retiredLive: true, ledger: LEDGER.replace(/^\*\*Consumers:\*\*.*$/m, '**Consumers:** `qr.html`').replace('(none yet; each is a line', '(each is a line') + '\n- **Reauthorized 2027-01-10:** the runtime adapter is scheduled for the next quarter; new end date 2027-06-30\n' }, d => {
  const r = T.status(d, AFTER); check('a reauthorization with a reason and a later date moves OVERDUE back to NOT COMPLETE (the one honoured way to extend)', r.verdict === 'NOT COMPLETE' && r.endDate === '2027-06-30' && r.reauthorizations === 1, JSON.stringify([r.verdict, r.endDate])); });
withFixture({ retiredLive: true, ledger: LEDGER.replace(/^\*\*Consumers:\*\*.*$/m, '**Consumers:** `qr.html`') + '\n- **Reauthorized 2027-01-10:** later; new end date 2027-06-30\n' }, d => {
  const r = T.status(d, AFTER); check('MALFORMED: a reauthorization that gives no real reason does not extend anything (exit 2)', r.verdict === 'MALFORMED' && r.code === 2, JSON.stringify([r.verdict, r.problems])); });
for (const f of T.FIELDS) {
  withFixture({ ledger: LEDGER.replace(new RegExp('^- \\*\\*' + f + ':\\*\\*.*$', 'm'), '') }, d => { const r = T.status(d, BEFORE); check(`MALFORMED: the ledger without its "${f}" field (exit 2)`, r.verdict === 'MALFORMED' && r.code === 2 && r.problems.some(p => p.includes(f)), JSON.stringify([r.verdict, r.problems])); });
}
withFixture({ ledger: LEDGER.replace(/^- \*\*Target end date:\*\*.*$/m, '- **Target end date:** whenever it is done') }, d => { const r = T.status(d, BEFORE); check('MALFORMED: an end date that is not a date', r.verdict === 'MALFORMED'); });
withFixture({ ledger: LEDGER.replace(/^\*\*Consumers:\*\*.*$/m, '') }, d => { const r = T.status(d, BEFORE); check('MALFORMED: a ledger that lists no consumers', r.verdict === 'MALFORMED'); });
withFixture({ noLedger: true }, d => { const r = T.status(d, BEFORE); check('MALFORMED: a dual-source period with no ledger at all', r.verdict === 'MALFORMED' && r.code === 2); });
withFixture({ retiredLive: true }, d => {
  const run = env => cp.spawnSync('node', [path.join(EF, 'transition_status.js')], { encoding: 'utf8', env: Object.assign({}, process.env, { BTNYC_ROOT: d }, env) });
  const r = run({}); check('the command line exits 1 for NOT COMPLETE (or 3 once the real date is past the fixture end date) and prints the verdict', [1, 3].includes(r.status) && /dual-source transition: (NOT COMPLETE|OVERDUE)/.test(r.stdout), `exit ${r.status}: ${r.stdout.slice(0, 120)}`); });

// ---- 3. the tripwire on the real repository --------------------------------------------------------------------------------------------------------------------------------------------------------
console.log('\nThe real transition');
check(`the real transition is ${real.verdict}${real.endDate ? ` (target end ${real.endDate}, today ${real.today})` : ''}: not MALFORMED, and not OVERDUE (after the end date: close it, reauthorize it in the ledger with a reason, or roll it back)`, real.verdict === 'COMPLETE' || real.verdict === 'NOT COMPLETE', (real.problems || []).join('; ') || 'overdue');

console.log(`\n[Entity-first dual-source transition] ${passed} passed, ${failed} failed (of ${passed + failed} checks)`);
process.exit(failed ? 1 : 0);
