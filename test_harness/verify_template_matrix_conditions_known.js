#!/usr/bin/env node
/**
 * verify_template_matrix_conditions_known.js -- the route's template decision must not silently ignore a condition it does not understand (DEFECT-SILENT-SKIP).
 *
 *
 * T158: the Charter's 2026-10-09 revision no longer names DEFECT-SILENT-SKIP (it was added at T156 under operator ruling #105, and the new Charter does not carry that amendment), so this test
 * carries no `@detects` tag for it: a tag naming a class the Charter does not declare is an orphan. The detector keeps running; PENDING_DECISIONS asks whether the class was dropped on purpose.
 *
 * workflow.ui_template_matrix.rules is DATA, but orch_select_ui_template evaluates it with one hand-written `if ('key' in cond && ...)` line per condition it knows. A condition key
 * it did not know used to be IGNORED, so a rule carrying one still matched on its other conditions: add a new condition to the data without a matching line in the evaluator and
 * the rule looks enforced and does nothing. T151 found this while adding quantity_is_fixed to the pure-quantity rule (shelf mounting). The evaluator now fails CLOSED (a rule with
 * an unknown condition does not match), and this test holds three things:
 *   1. the evaluator's declared vocabulary (KNOWN_CONDITIONS) equals the keys it actually handles, line by line;
 *   2. every condition key used by every rule in the SSOT is in that vocabulary;
 *   3. BEHAVIOUR: a rule with an unknown condition is skipped, not matched on its remaining conditions -- and a mutant that restores the old fail-open loop is caught.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..');
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log('  \u2713 ' + name); } else { fail++; console.log('  \u2717 ' + name + (detail ? '\n      ' + detail : '')); } };
const orchSrc = fs.readFileSync(path.join(ROOT, 'orchestrator_engine.js'), 'utf8');
const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
const body = src => { const a = src.indexOf('function orch_select_ui_template('), b = src.indexOf('function orch_merge_materials_estimate(', a); if (a < 0 || b < 0) throw new Error('evaluator not found'); return src.slice(a, b); };
const handled = src => new Set([...body(src).matchAll(/'([A-Za-z_.]+)' in cond/g)].map(m => m[1]));
const declared = src => { const m = body(src).match(/KNOWN_CONDITIONS = new Set\(\[([^\]]*)\]\)/); return new Set(m ? [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : []); };
const eq = (a, b) => a.size === b.size && [...a].every(x => b.has(x));
const load = src => { const sb = { DB, SERVICE_DATA: DB, window: { DB }, console: { log() {}, warn() {}, error() {}, info() {} } }; sb.global = sb; vm.createContext(sb); for (const f of ['pricing_engine.js', 'nlp_engine.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f }); vm.runInContext(src, sb, { filename: 'orchestrator_engine.js' }); return sb; };
const FLAGS = { chain_is_pure_quantity: true, quantity_is_fixed: true }, RES = { entity: { behavior: {} } }, CONF = { score: 90 };
const probe = (sb) => sb.orch_select_ui_template(FLAGS, RES, CONF, { workflow: { ui_template_matrix: { rules: [{ if: { bogus_condition: true, chain_is_pure_quantity: true }, then: { ui_template: 'WRONG' } }, { if: { chain_is_pure_quantity: true }, then: { ui_template: 'right' } }], fallback: { ui_template: 'fallback' } } } }).ui_template;

console.log('\n=== 1. the declared vocabulary equals what the evaluator handles ===');
const H = handled(orchSrc), K = declared(orchSrc);
check(`KNOWN_CONDITIONS (${K.size}) equals the ${H.size} keys the evaluator has a line for`, K.size > 0 && eq(H, K), 'handled-only: ' + [...H].filter(x => !K.has(x)) + ' | declared-only: ' + [...K].filter(x => !H.has(x)));
console.log('\n=== 2. every condition the data uses is one the evaluator understands ===');
const used = new Set(); (DB.workflow.ui_template_matrix.rules || []).forEach(r => Object.keys(r.if || {}).forEach(k => used.add(k)));
check(`all ${used.size} condition keys used by the ${DB.workflow.ui_template_matrix.rules.length} rules are known`, [...used].every(k => K.has(k)), 'unknown in the data: ' + [...used].filter(k => !K.has(k)));
check('the pure-quantity rule carries quantity_is_fixed (operator ruling A on shelf mounting), and the evaluator handles it', DB.workflow.ui_template_matrix.rules.some(r => r.if && r.if.chain_is_pure_quantity === true && r.if.quantity_is_fixed === true) && H.has('quantity_is_fixed'));
console.log('\n=== 3. behaviour: an unknown condition fails CLOSED ===');
const real = load(orchSrc);
check('a rule with an unknown condition is SKIPPED, not matched on its other conditions (the next rule wins)', probe(real) === 'right', 'got ' + probe(real));
const failOpen = orchSrc.replace('             if (Object.keys(cond).some(k => !KNOWN_CONDITIONS.has(k))) continue;\n', '');
check('MUTANT (the old fail-open loop restored) is caught: the unknown-condition rule would match', failOpen !== orchSrc && probe(load(failOpen)) === 'WRONG', 'mutant anchor missing or mutant not caught');
const noHandler = orchSrc.replace("if ('quantity_is_fixed' in cond && cond.quantity_is_fixed !== flags.quantity_is_fixed) matches = false; // T151\n", '');
check('MUTANT (the evaluator loses its quantity_is_fixed line while the data keeps the condition) is caught by the vocabulary check', noHandler !== orchSrc && !eq(handled(noHandler), declared(noHandler)));
console.log(`\n[template matrix: no silently ignored condition] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail ? 1 : 0);
