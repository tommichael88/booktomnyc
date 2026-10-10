#!/usr/bin/env node
/**
 * verify_checkout_state_convergence.js -- R-CLIENT-CONVERGE and R-INVARIANT-PROVENANCE for the `checkout_state` concept.
 *
 * The concept's precedence (service override > archetype default > dynamic engine > fallback) was written in five places, and the direct readers were blind to archetype
 * inheritance: 69 of 76 services inherit. The consequence was behavioral, not cosmetic: `classifyServiceIntake` (the card-tap path) said NO service self-quotes, while the
 * orchestrator route said two do (LED bulb upgrade; standard shelf mounting), so the same service got a one-tap priced card from a search and a questionnaire from a tap.
 * T150 made one resolver (returning { key, source }) the only reader. This test holds the behavior, not the shape:
 *   1. the resolver answers for EVERY entity, with a valid key and a named source, and never needs its fallback (the fallback is a net, not a data path);
 *   2. the card path never self-quotes what the route does not, never self-quotes a service whose QUANTITY moves its price (the card can express one price), and -- since T154
 *      (operator ruling "LED yes" on PENDING_DECISIONS #108) -- the two paths AGREE for every service: no declared exceptions remain. The route's own LED outcome is held directly
 *      (curated card, asks the bulb count, prices $20 / $35 / $50 by answer), and the self-quote half of the comparison is kept non-vacuous by a counterfactual world;
 *   3. the quote carries the resolver's key and source on both the route path and the state path; an answer-level override is named as such;
 *   4. counterfactual worlds: (A) every archetype defaults to 'diagnostic' and every reader must follow the inheritance (the real data hides a reader that ignores it); (B) the LED bulb
 *      service (the one authored bypass_intake count template) becomes single-unit: the route must then self-quote it via template-matrix rule 5 and the card path must agree;
 *   5. seven mutants -- each re-introducing one defect -- are caught.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..');
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log('  \u2713 ' + name); } else { fail++; console.log('  \u2717 ' + name + (detail ? '\n      ' + detail : '')); } };
const SOURCES = new Set(['service_override', 'archetype_default', 'dynamic_engine', 'fallback']); // the Charter's R-INVARIANT-PROVENANCE vocabulary; the quote may also say answer_override

function world({ mutateDb, mutateSrc } = {}) {
  const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8')); if (mutateDb) mutateDb(DB);
  const sb = { DB, SERVICE_DATA: DB, window: { DB }, console: { log() {}, warn() {}, error() {}, info() {} } }; sb.global = sb; vm.createContext(sb);
  for (const f of ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js']) {
    let src = fs.readFileSync(path.join(ROOT, f), 'utf8'); if (mutateSrc && mutateSrc[f]) src = mutateSrc[f](src);
    vm.runInContext(src, sb, { filename: f });
  }
  return { DB, sb };
}
const stateFor = (s, cat, answers) => ({ qty: 1, intent: { key: s.id, category: cat, label: 'x', qtyLabel: 'item' }, stype: 'Repair', answers: answers || {}, detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: [], userTagIds: [], _svc: s, _tagsAffirmed: false });
// The ORIGINAL card-tap rule (a second copy of the self-quote decision, deleted from source in T155 -- PHASE_PLAN C-01 -- because classifyServiceIntake is the one definition),
// restated here from raw SSOT fields as an INDEPENDENT oracle: priced + flat checkout state (resolved, inheritance-aware) + a chain of only quantity modules. It lacks the
// quantity_is_fixed term T150 added, so the card path (classifyServiceIntake) may only ever be stricter than it.
function origCardRule(sb, DB, s) {
  const om = s.operational_metrics || {}, chain = s.intake_chain || [], byp = !!(s.behavior && s.behavior.bypass_intake), qm = new Set(['item_count', 'count', 'hybrid_qty', 'global_quantity']);
  const only = chain.length === 0 || chain.every(m => qm.has(m.module) || (m.module === 'item_count_template' && byp));
  const priced = (om.expected_minutes > 0) && om.complexity_tier && (s.financial_engine && s.financial_engine.base_price > 0);
  const st = DB.checkout_states && DB.checkout_states[sb.resolveServiceCheckoutStateKey(s, null).key];
  return !!(priced && st && st.is_flat_checkout && only);
}
function census({ DB, sb }) {
  const rows = DB.services.map(s => {
    const cat = s.ui_taxonomy.category_id, R = sb.resolveServiceCheckoutStateKey(s, null);
    const route = sb.executeWorkflow(sb.collectBookingContext_catalog(s, cat), DB), state = sb.computeQuoteFromState(stateFor(s, cat));
    const hasQ = (s.intake_chain || []).some(st => ['item_count', 'count', 'hybrid_qty', 'global_quantity', 'item_count_template'].includes(st.module || st));
    const fixed = !hasQ || sb.resolveQuantityUnits({ entity: s, entityType: 'service', requestedQty: 2 }).stance === 'single_unit';
    return { id: s.id, R, fixed, bypass: !!(s.behavior && s.behavior.bypass_intake), cls: sb.classifyServiceIntake(s).isSelfQuoting, legacy: origCardRule(sb, DB, s), tpl: route.uiTemplate,
      rk: route.quote && route.quote.checkoutStateKey, rs: route.quote && route.quote.checkoutStateSource, sk: state.checkoutStateKey, ss: state.checkoutStateSource, diag: sb.getServiceProfile(s).isDiagnostic };
  });
  return rows;
}

console.log('\n=== 1. the resolver answers for every entity, with a named source ===');
const W = world(), rows = census(W), { DB, sb } = W;
check(`every one of the ${DB.services.length} services resolves to { key, source } with a defined key and a known source`,
  rows.every(r => r.R && DB.checkout_states[r.R.key] && SOURCES.has(r.R.source)), rows.filter(r => !(r.R && DB.checkout_states[r.R.key] && SOURCES.has(r.R.source))).map(r => r.id).join(', '));
const dyn = Object.entries(DB.dynamic_services).map(([k, d]) => [k, sb.resolveServiceCheckoutStateKey(null, d)]);
check(`every one of the ${dyn.length} dynamic entries resolves to { key, source } with a defined key and a known source`, dyn.every(([, r]) => r && DB.checkout_states[r.key] && SOURCES.has(r.source)));
check('population: 76 services and 80+ dynamic entries were enumerated', rows.length >= 76 && dyn.length >= 80);
check('the fallback rung is never used by real data (it is a safety net, not a data path)', rows.every(r => r.R.source !== 'fallback') && dyn.every(([, r]) => r.source !== 'fallback'),
  [...rows.filter(r => r.R.source === 'fallback').map(r => r.id), ...dyn.filter(([, r]) => r.source === 'fallback').map(([k]) => k)].join(', '));

console.log('\n=== 2. the card path is never more permissive than the route, and where it is stricter the reason is declared and true ===');
// T154: the declared exception list is EMPTY. led_bulb_upgrade (an AUTHORED behavior.bypass_intake count template whose three bands move price: $20 / $35 / $50) used to be the one service
// the route self-quoted and the card tap did not. Template-matrix rule 5 now requires quantity_is_fixed, exactly as rule 4 has since T151, so both paths ask the bulb count.
const LED = 'led_bulb_upgrade';
check('the card path never self-quotes a service the route does not', rows.every(r => !r.cls || r.tpl === 'self_quote'), rows.filter(r => r.cls && r.tpl !== 'self_quote').map(r => r.id).join(', '));
check('the card path never self-quotes a service whose quantity moves its price (the card shows one price for one unit)', rows.every(r => !r.cls || r.fixed), rows.filter(r => r.cls && !r.fixed).map(r => r.id).join(', '));
check('the ROUTE never self-quotes a service whose quantity moves its price -- not by rule 4 (operator ruling A, shelf mounting) and not by rule 5 (operator ruling "LED yes")', rows.every(r => r.tpl !== 'self_quote' || r.fixed), rows.filter(r => r.tpl === 'self_quote' && !r.fixed).map(r => r.id).join(', '));
const stricter = rows.filter(r => r.tpl === 'self_quote' && !r.cls).map(r => r.id);
check('there are NO services where the route self-quotes and the card tap does not (the declared-exception list is empty; a new disagreement fails)', stricter.length === 0, 'actual: ' + stricter.join(', '));
const ledRow = rows.find(r => r.id === LED);
check('led_bulb_upgrade is a real, price-moving-quantity service that still carries the authored bypass flag (the reason rule 5 once matched it is still true)', ledRow && ledRow.bypass === true && ledRow.fixed === false);
check('and its route is the curated card, not a self-quote', ledRow.tpl === 'curated_card', 'route template: ' + ledRow.tpl);
{
  const ledSvc = DB.services.find(x => x.id === LED), askRoute = ans => { const c = sb.collectBookingContext_catalog(ledSvc, ledSvc.ui_taxonomy.category_id); c.answers = ans; return sb.executeWorkflow(c, DB); };
  const bands = ledSvc.intake_chain[0].params.client_response.map(r => r.label), priced = bands.map(l => askRoute({ item_count_template: l }).quote.laborEstimate);
  check('the route ASKS the bulb count (an unanswered visible question) and does not bypass intake', askRoute({}).bypassIntake === false && askRoute({}).intakeChain.length === 1 && askRoute({}).flags.all_visible_real_questions_answered === false);
  check('and prices it $20 / $35 / $50 by answer -- the same figure the card tap produces (no price moved by the ruling)', JSON.stringify(priced) === JSON.stringify([20, 35, 50]), 'priced: ' + priced.join(', '));
}
check('the card path is never more permissive than the original card-tap rule (restated from raw SSOT fields, since its source copy was deleted in T155)', rows.every(r => !r.cls || r.legacy));
// (no population floor here: since T154 NO catalog service self-quotes on the route -- every chain has a real question or a price-moving quantity. The self-quote half of the comparison
//  is kept non-vacuous by counterfactual B below.)

console.log('\n=== 3. the quote carries the resolver\'s key and source, on both paths ===');
check('route path: quote.checkoutStateKey and checkoutStateSource equal the resolver\'s for every service', rows.every(r => r.rk === r.R.key && r.rs === r.R.source), rows.filter(r => r.rk !== r.R.key || r.rs !== r.R.source).slice(0, 4).map(r => `${r.id}: ${r.rk}/${r.rs} vs ${r.R.key}/${r.R.source}`).join(' | '));
check('state path: the same, for every service', rows.every(r => r.sk === r.R.key && r.ss === r.R.source), rows.filter(r => r.sk !== r.R.key || r.ss !== r.R.source).slice(0, 4).map(r => `${r.id}: ${r.sk}/${r.ss}`).join(' | '));
const overrideCases = [];
for (const s of DB.services) for (const step of (s.intake_chain || [])) { const m = DB.intake_modules[step.module || step]; for (const a of (m && m.client_response) || []) if (a.checkout_state_override === 'diagnostic' && sb.resolveServiceCheckoutStateKey(s, null).key !== 'diagnostic') overrideCases.push([s, step.module || step, a.label]); }
const overrideOk = overrideCases.filter(([s, mod, label]) => { const q = sb.computeUnifiedQuote({ svc: s, activeTagIds: [], answers: { [mod]: label }, qty: 1 }); return q.checkoutStateKey === 'diagnostic' && q.checkoutStateSource === 'answer_override'; });
check(`an answer-level override is applied AND named (${overrideOk.length} of ${overrideCases.length} cases; floor 3)`, overrideCases.length >= 3 && overrideOk.length === overrideCases.length, overrideCases.filter(c => !overrideOk.includes(c)).slice(0, 3).map(c => c[0].id + '/' + c[2]).join(' | '));

console.log('\n=== 4. counterfactual world: every archetype defaults to \'diagnostic\' -- every reader must follow the inheritance ===');
const WA = world({ mutateDb: db => { for (const a of Object.values(db.archetypes)) a.default_checkout_state = 'diagnostic'; } });
const inheritors = WA.DB.services.filter(s => !(s.financial_engine && s.financial_engine.checkout_state));
check(`population: ${inheritors.length} inheriting services (floor 60)`, inheritors.length >= 60);
check('the resolver follows the archetype (key diagnostic, source archetype_default) for every inheritor', inheritors.every(s => { const r = WA.sb.resolveServiceCheckoutStateKey(s, null); return r.key === 'diagnostic' && r.source === 'archetype_default'; }));
check('getServiceProfile(...).isDiagnostic follows it for every inheritor', inheritors.every(s => WA.sb.getServiceProfile(s).isDiagnostic === true), inheritors.filter(s => WA.sb.getServiceProfile(s).isDiagnostic !== true).slice(0, 3).map(s => s.id).join(', '));
check('the route and state quotes follow it for every inheritor', inheritors.every(s => { const cat = s.ui_taxonomy.category_id; return WA.sb.executeWorkflow(WA.sb.collectBookingContext_catalog(s, cat), WA.DB).quote.checkoutStateKey === 'diagnostic' && WA.sb.computeQuoteFromState(stateFor(s, cat)).checkoutStateKey === 'diagnostic'; }));
check('no inheritor self-quotes in that world (a diagnostic state is not a flat checkout)', inheritors.every(s => WA.sb.classifyServiceIntake(s).isSelfQuoting === false));

console.log('\n=== counterfactual B: the LED bulb service becomes single-unit -- the route must then self-quote it (rule 5) and the card path must agree everywhere ===');
const WBp = { mutateDb: db => { for (const s of db.services) if (s.id === LED) s.per_unit_answers_vary = true; } };
const rowsB = census(world(WBp));
check('once its quantity no longer moves the price, the card path self-quotes LED and agrees with the route for every service', rowsB.every(r => r.cls === (r.tpl === 'self_quote')) && rowsB.filter(r => r.cls).length >= 1, rowsB.filter(r => r.cls !== (r.tpl === 'self_quote')).map(r => r.id).join(', '));
check('and it is rule 5 that does it: the route self-quotes LED (bypass_intake) in that world, which it did not in the real one', rowsB.find(r => r.id === LED).tpl === 'self_quote' && rowsB.find(r => r.id === LED).bypass === true && rows.find(r => r.id === LED).tpl !== 'self_quote');
check('so the quantity rule is the ONLY thing that separates the two worlds for it (it inherits its state and is otherwise eligible)', rowsB.find(r => r.id === LED).cls === true && rowsB.find(r => r.id === LED).R.source === 'archetype_default');

console.log('\n=== 5. mutants: each re-introduces one defect, and each is caught ===');
const direct = src => { const a = 'isFlatCheckoutState(resolveServiceCheckoutStateKey(svc, null).key);'; if (!src.includes(a)) throw new Error('mutant anchor missing (classifyServiceIntake)'); return src.replace(a, 'isFlatCheckoutState(svc.financial_engine?.checkout_state);'); };
const M1 = census(world({ mutateDb: WBp.mutateDb, mutateSrc: { 'pricing_engine.js': direct } })), m1 = M1.filter(r => r.cls !== (r.tpl === 'self_quote'));
check('MUTANT 1 (the card-tap classification reads the raw field again) is caught -- in counterfactual B, where it would wrongly disqualify the inheriting service', m1.length >= 1, 'disagreeing: ' + m1.map(r => r.id).join(', '));
const noRule = src => { const a = '&& chainIsQtyOnly && _quantityIsFixed)';  /* unchanged anchor: classifyServiceIntake still ANDs the shared predicate */ if (!src.includes(a)) throw new Error('mutant anchor missing (quantity rule)'); return src.replace(a, '&& chainIsQtyOnly)'); };
const M4 = census(world({ mutateSrc: { 'pricing_engine.js': noRule } })), m4 = M4.filter(r => r.cls && !r.fixed);   // (the rule lives in isQuantityFixed now, so this mutant removes the card path's use of it)
check('MUTANT 4 (the quantity rule is removed) is caught: the card would show a one-unit price for a service whose quantity moves it', m4.length >= 2, 'self-quoting wrongly: ' + m4.map(r => r.id).join(', '));
const blindProfile = src => { const a = 'isDiagnosticService(fe, csKey)'; if (!src.includes(a)) throw new Error('mutant anchor missing (getServiceProfile)'); return src.replace(a, 'isDiagnosticService(fe, fe.checkout_state)'); };
const WM2 = world({ mutateDb: db => { for (const a of Object.values(db.archetypes)) a.default_checkout_state = 'diagnostic'; }, mutateSrc: { 'pricing_engine.js': blindProfile } });
const hiddenInRealWorld = census(world({ mutateSrc: { 'pricing_engine.js': blindProfile } })).every((r, i) => r.diag === rows[i].diag);
check('MUTANT 2 (the profile reads the raw field and ignores inheritance) is INVISIBLE on real data...', hiddenInRealWorld, 'the real data was expected to hide this defect');
check('...and caught in the counterfactual world, which is why that world exists', WM2.DB.services.filter(s => !(s.financial_engine && s.financial_engine.checkout_state)).some(s => WM2.sb.getServiceProfile(s).isDiagnostic !== true));
// T158: matched by shape, not by whitespace: the operator's formatter lays this statement out over several lines, and an anchor that depends on the layout fails when the layout changes (the mutant is unchanged: the archetype branch is removed)
const noArch = src => { const a = /if \(archetypeDefault\) return \{\s*key: archetypeDefault,\s*source: 'archetype_default'\s*\};/; if (!a.test(src)) throw new Error('mutant anchor missing (resolver)'); return src.replace(a, ''); };
const M3 = census(world({ mutateSrc: { 'pricing_engine.js': noArch } }));
check('MUTANT 3 (the resolver loses its archetype rung) is caught: inheritors now report source \'fallback\' on the resolver and on the quote', M3.filter(r => r.R.source === 'fallback').length >= 60 && M3.filter(r => r.rs === 'fallback').length >= 60);

const M5 = census(world({ mutateDb: db => { delete db.workflow.ui_template_matrix.rules[4].if.quantity_is_fixed; } })), m5 = M5.filter(r => r.tpl === 'self_quote' && !r.fixed && !r.bypass);
check('MUTANT 5 (the matrix\'s pure-quantity rule loses its quantity_is_fixed condition) is caught: shelf mounting would self-quote again on the route', m5.length >= 1, 'self-quoting wrongly: ' + m5.map(r => r.id).join(', '));

const M6 = census(world({ mutateDb: db => { delete db.workflow.ui_template_matrix.rules[5].if.quantity_is_fixed; } })), m6 = M6.filter(r => r.tpl === 'self_quote' && !r.fixed);
check('MUTANT 6 (template-matrix rule 5 loses its quantity_is_fixed condition) is caught: LED would self-quote again on the route while the card tap asks the bulb count', m6.some(r => r.id === LED) && M6.some(r => r.tpl === 'self_quote' && !r.cls), 'self-quoting wrongly: ' + m6.map(r => r.id).join(', '));

// MUTANT 7 proves the restated original card-tap rule is a live oracle (after C-01 deleted its source copy): the classification loses its quantity-only-chain clause, so the card tap would
// self-quote a flat-priced service that has real questions -- strictly more permissive than the original rule, which is exactly what the 'never more permissive' check exists to catch.
const noChainClause = src => { const a = '&& chainIsQtyOnly && _quantityIsFixed)'; if (!src.includes(a)) throw new Error('mutant anchor missing (chain clause)'); return src.replace(a, '&& _quantityIsFixed)'); };
const M7 = census(world({ mutateSrc: { 'pricing_engine.js': noChainClause } })), m7 = M7.filter(r => r.cls && !r.legacy);
check('MUTANT 7 (the card-tap classification loses its quantity-only-chain clause) is caught: the card path becomes more permissive than the original rule', m7.length >= 1, 'self-quoting wrongly: ' + m7.length + ' services');

console.log(`\n[checkout_state convergence] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail ? 1 : 0);
