#!/usr/bin/env node
/**
 * verify_flat_checkout_names_live_in_ssot.js -- R-SYSTEM-NODATA for the flat-checkout vocabulary (operator ruling on PENDING_DECISIONS #107).
 *
 * "Which checkout states present a firm flat price" is business vocabulary, and it was a name list typed into three places (the intake classification, the original legacy oracle,
 * and the tag-affirmation card). It now lives in the SSOT as checkout_states.<state>.is_flat_checkout and is read through one helper, isFlatCheckoutState. This test holds the move:
 *   1. every checkout state declares a boolean, and the declared vocabulary is EXACTLY the old hardcoded one (the move changed no behaviour);
 *   2. no line of code names the flat states as a list any more (comments excluded);
 *   3. BEHAVIOUR, in a counterfactual world: with the data's flags flipped off, the classification and the legacy oracle stop treating anything as flat -- they READ the data.
 *      A real-data comparison cannot show that (the answers would be the same either way), which is why the world exists;
 *   4. three mutants -- the hardcoded list reintroduced in the classification, in the legacy oracle, and as a source line -- are caught.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..');
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log('  \u2713 ' + name); } else { fail++; console.log('  \u2717 ' + name + (detail ? '\n      ' + detail : '')); } };

const OLD_VOCABULARY = new Set(['standard_flat_rate', 'database_summation']);   // what the three code sites hardcoded before T151
function world({ mutateDb, mutateSrc } = {}) {
  const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8')); if (mutateDb) mutateDb(DB);
  const sb = { DB, SERVICE_DATA: DB, window: { DB }, console: { log() {}, warn() {}, error() {}, info() {} } }; sb.global = sb; vm.createContext(sb);
  for (const f of ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js']) { let src = fs.readFileSync(path.join(ROOT, f), 'utf8'); if (mutateSrc && mutateSrc[f]) src = mutateSrc[f](src); vm.runInContext(src, sb, { filename: f }); }
  return { DB, sb };
}
const namesBoth = text => text.split('\n').map((l, i) => ({ l, i: i + 1 })).filter(({ l }) => !/^\s*(\/\/|\*|\/\*)/.test(l) && /'standard_flat_rate'/.test(l.replace(/\/\/.*$/, '')) && /'database_summation'/.test(l.replace(/\/\/.*$/, '')));
// the counterfactual: LED (an inheriting, flat service with an authored bypass) made single-unit so that it self-quotes on the card path in the real data, then the flat flags flipped OFF
const LED = 'led_bulb_upgrade', ledSingle = db => { db.services.find(s => s.id === LED).per_unit_answers_vary = true; };
const flipOff = db => { ledSingle(db); for (const st of Object.values(db.checkout_states)) st.is_flat_checkout = false; };

console.log('\n=== 1. the vocabulary is in the data, and the move changed nothing ===');
const real = world(), DB = real.DB;
check('every checkout state declares is_flat_checkout as a boolean', Object.values(DB.checkout_states).every(s => typeof s.is_flat_checkout === 'boolean'), Object.entries(DB.checkout_states).filter(([, s]) => typeof s.is_flat_checkout !== 'boolean').map(([k]) => k).join(', '));
const declared = new Set(Object.entries(DB.checkout_states).filter(([, s]) => s.is_flat_checkout).map(([k]) => k));
check('the declared flat states are EXACTLY the old hardcoded pair (the move preserved the vocabulary; change it deliberately, here and in the data, if the business changes it)', declared.size === OLD_VOCABULARY.size && [...OLD_VOCABULARY].every(k => declared.has(k)), 'declared: ' + [...declared].join(', '));
check('the helper agrees with the data for every state', Object.keys(DB.checkout_states).every(k => real.sb.isFlatCheckoutState(k) === !!DB.checkout_states[k].is_flat_checkout) && real.sb.isFlatCheckoutState('no_such_state') === false);

console.log('\n=== 2. no code line names the flat states as a list ===');
const code = require('./_page.js').readPage(path.join(ROOT, 'qr.html')), hits = namesBoth(code);
check('qr.html has no non-comment line naming both flat states (the three hardcoded lists are gone)', hits.length === 0, hits.map(h => 'L' + h.i).join(', '));

console.log('\n=== 3. counterfactual world: flip the data, and the readers follow ===');
const on = world({ mutateDb: ledSingle }), off = world({ mutateDb: flipOff });
const led = w => w.DB.services.find(s => s.id === LED);
check('contrast: with the real flags (LED made single-unit) the card path self-quotes it', on.sb.classifyServiceIntake(led(on)).isSelfQuoting === true);
check('with every is_flat_checkout flipped OFF the classification no longer self-quotes it (it READS the data)', off.sb.classifyServiceIntake(led(off)).isSelfQuoting === false);
check('with the flags OFF no service is self-quoting under the classification (it reads the data for EVERY service, not just the one above)', off.DB.services.every(s => off.sb.classifyServiceIntake(s).isSelfQuoting === false));
check('with the flags OFF the helper reports every real state as not flat', Object.keys(off.DB.checkout_states).every(k => off.sb.isFlatCheckoutState(k) === false));

console.log('\n=== 4. mutants: each regression is caught ===');
const classify = src => { const a = 'const isFlatCheckout = isFlatCheckoutState(resolveServiceCheckoutStateKey(svc, null).key);'; if (!src.includes(a)) throw new Error('mutant anchor missing (classifyServiceIntake)'); return src.replace(a, "const isFlatCheckout = ['standard_flat_rate', 'database_summation'].includes(resolveServiceCheckoutStateKey(svc, null).key);"); };
const m1 = world({ mutateDb: flipOff, mutateSrc: { 'pricing_engine.js': classify } });
check('MUTANT 1 (the hardcoded list is back in the classification) is caught: it ignores the flipped data and still self-quotes', m1.sb.classifyServiceIntake(led(m1)).isSelfQuoting === true);
check('MUTANT 2 (a source line naming both flat states again) is caught by the scan', namesBoth("const a = 1;\nconst x = ['standard_flat_rate', 'database_summation'].includes(k);\n// ['standard_flat_rate', 'database_summation'] in a comment is fine\n").length === 1);

console.log(`\n[flat-checkout vocabulary lives in the SSOT] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail ? 1 : 0);
