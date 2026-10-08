/**
 * verify_store_reducer.js
 *
 * Self-contained regression test for appReducer.js + store.js, in the same
 * style as the project's other verify_*.js harness files. Runs with plain
 * `node verify_store_reducer.js`. Exits non-zero on any failure.
 *
 * It validates the reducer against the REAL btnyc.json shapes where possible
 * (checkout_states keys, service_types, entry paths) rather than invented data.
 */

const path = require('path');
const fs = require('fs');

const { appReducer, initialAppState, ActionTypes, actions,
        _computeActiveTagIds } = require('../appReducer.js');
const { createStore } = require('../store.js');

let passed = 0, failed = 0;
function check(name, cond) {
  if (cond) { passed++; console.log('  ok  - ' + name); }
  else { failed++; console.error('  FAIL- ' + name); }
}
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

// Load the real catalog to assert against real field values, not guesses.
const CATALOG_PATH = path.resolve(__dirname, '../btnyc.json');
const DB = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const REAL_CHECKOUT_STATES = Object.keys(DB.checkout_states); // 4 real
const REAL_ENTRY_PATHS = ['catalog', 'other_tile', 'free_text']; // 3 real

console.log('\n== 1. Initial state shape mirrors the 4 slices + cart ==');
check('has activeContext/quoteData/intakeAnswers/tagState/session/cart',
  ['activeContext','quoteData','intakeAnswers','tagState','session','cart']
    .every(k => k in initialAppState));
check('initial entryPath is idle', initialAppState.activeContext.entryPath === 'idle');
check('initial cart empty', initialAppState.cart.serviceRequest.length === 0);
check('legacyView has the exact S keys',
  eq(Object.keys(initialAppState.session.legacyView).sort(),
     ['_autoSelectedFrom','_confidenceStrategy','_curatedMode','_escalatedBy','_forceModules',
      '_fromBuilder','_isOtherTileEntry','_jobNotes','_location','_nlpSeedDesc','_nlpSeedObject',
      '_notes','_objectNoun','_selfQuoteSvc','_sizeHint','_suggestedTagIds','_svc','adlibConfirmed',
      'answers','desc','detTagIds','intent','manTagIds','negatedTagIds','qty','stype','userTagIds'].sort()));

console.log('\n== 2. Reducer purity (no-op returns same reference) ==');
const s0 = initialAppState;
check('unknown action returns same ref', appReducer(s0, { type: 'nope/UNKNOWN' }) === s0);
check('null action returns same ref', appReducer(s0, null) === s0);
const before = JSON.parse(JSON.stringify(s0));
appReducer(s0, actions.setQty(9));
check('reducer did not mutate input', eq(s0, before));

console.log('\n== 3. BEGIN_CONTEXT accepts the 3 real entry paths ==');
REAL_ENTRY_PATHS.forEach(entry => {
  const ctx = { entry, manuallyToggledTagIds: ['#a'], negatedTagIds: [], nlpIntent: { stype: 'Repair' } };
  const st = appReducer(s0, actions.beginContext(ctx));
  check('entryPath set to ' + entry, st.activeContext.entryPath === entry);
});

console.log('\n== 4. RESOLVE_ROUTE folds route + quote + chain + answers ==');
const route = {
  entityType: 'service',
  entity: { id: 'toilet_repair' },
  uiTemplate: 'curated_card',
  intakeChain: ['issue', 'location'],
  answers: { issue: 'Running' },
  quote: { laborEstimate: 45, dispatchFee: 45, checkoutStateKey: 'standard_flat_rate',
           isProject: false, isDiagnostic: false, isAssembly: false, meetsConfidenceBar: true },
};
let st = appReducer(s0, actions.resolveRoute(route));
check('resolvedEntityId', st.activeContext.resolvedEntityId === 'toilet_repair');
check('uiTemplate mirrored', st.activeContext.uiTemplate === 'curated_card');
check('intake chain stored', eq(st.intakeAnswers.chain, ['issue','location']));
check('answer stored', st.intakeAnswers.answers.issue === 'Running');
check('quote folded in', st.quoteData.laborEstimate === 45);
check('quote checkoutStateKey is a REAL checkout_state',
  REAL_CHECKOUT_STATES.indexOf(st.quoteData.checkoutStateKey) !== -1);

console.log('\n== 5. tagState.activeTagIds matches executeWorkflow derivation ==');
let ts = appReducer(s0, actions.beginContext({ entry: 'free_text', manuallyToggledTagIds: ['#x','#y','#x'], negatedTagIds: ['#y'] }));
check('active = manual(unique) minus negated', eq(ts.tagState.activeTagIds, ['#x']));
check('matches _computeActiveTagIds helper',
  eq(ts.tagState.activeTagIds, _computeActiveTagIds(['#x','#y','#x'], ['#y'])));
// toggling a negated tag ON un-negates it
ts = appReducer(ts, actions.toggleManualTag('#y'));
check('toggle-on removes negation', ts.tagState.negatedTagIds.indexOf('#y') === -1);
check('toggle-on adds to active', ts.tagState.activeTagIds.indexOf('#y') !== -1);

console.log('\n== 6. intake answers accumulate (multi-recompute pattern) ==');
let ia = appReducer(s0, actions.setIntakeAnswer('issue', 'Leak'));
ia = appReducer(ia, actions.setIntakeAnswer('severity', 'Large'));
check('two answers retained', eq(ia.intakeAnswers.answers, { issue:'Leak', severity:'Large' }));

console.log('\n== 7. cart add/remove/update mirror the State object ==');
let c = appReducer(s0, actions.addToCart({ id: 'e1', name: 'Toilet', price: '$45' }));
c = appReducer(c, actions.addToCart({ id: 'e2', name: 'Door', price: '$115' }));
check('cart has 2', c.cart.serviceRequest.length === 2);
check('addToCart guards on missing id',
  appReducer(c, actions.addToCart({ name: 'no id' })) === c);
c = appReducer(c, actions.updateCartEntry(0, { price: '$90', qty: 2 }));
check('update patched entry 0', c.cart.serviceRequest[0].price === '$90');
c = appReducer(c, actions.removeFromCart(1));
check('cart has 1 after remove', c.cart.serviceRequest.length === 1);

console.log('\n== 8. legacyView stays in sync (the migration bridge contract) ==');
let lv = appReducer(s0, actions.setQty(3));
lv = appReducer(lv, actions.setServiceType('Install'));
lv = appReducer(lv, actions.setDesc('fix my window'));
check('legacyView.qty synced', lv.session.legacyView.qty === 3);
check('legacyView.stype synced', lv.session.legacyView.stype === 'Install');
check('legacyView.desc synced', lv.session.legacyView.desc === 'fix my window');

console.log('\n== 9. RESET_SESSION is one action, clears session, preserves cart ==');
let big = appReducer(s0, actions.addToCart({ id: 'keep', name: 'Keep me' }));
big = appReducer(big, actions.setQty(7));
big = appReducer(big, actions.beginContext({ entry: 'catalog' }));
let reset = appReducer(big, actions.resetSession());
check('session qty reset to 1', reset.session.qty === 1);
check('entryPath back to idle', reset.activeContext.entryPath === 'idle');
check('cart preserved across reset', reset.cart.serviceRequest.length === 1);
check('legacyView freshly reset',
  eq(Object.keys(reset.session.legacyView).length, 27) && reset.session.legacyView.qty === 1);

console.log('\n== 10. store.js: getState/dispatch/subscribe + bindLegacyGlobals ==');
const store = createStore(appReducer, initialAppState);
let notified = 0;
const unsub = store.subscribe(() => { notified++; });
store.dispatch(actions.setQty(5));
check('subscriber notified on change', notified === 1);
store.dispatch({ type: 'nope/NOOP' });
check('subscriber NOT notified on no-op', notified === 1);
check('getState reflects dispatch', store.getState().session.qty === 5);
unsub();
store.dispatch(actions.setQty(6));
check('unsubscribe works', notified === 1);

// bindLegacyGlobals mirrors onto a fake window
const fakeWin = { S: {}, State: {} };
const store2 = createStore(appReducer, initialAppState);
const unbind = store2.bindLegacyGlobals(fakeWin);
store2.dispatch(actions.setQty(4));
store2.dispatch(actions.addToCart({ id: 'x' }));
check('window.S mirrored qty', fakeWin.S.qty === 4);
check('window.State.serviceRequest mirrored', fakeWin.State.serviceRequest.length === 1);
check('window.S identity preserved (same object)', fakeWin.S && typeof fakeWin.S === 'object');
unbind();

console.log('\n== 11. store guards against nested dispatch / bad actions ==');
let threw = false;
try { store.dispatch({ foo: 'no type' }); } catch (e) { threw = true; }
check('dispatch rejects action without string type', threw);

console.log('\n────────────────────────────────────────');
console.log(`  ${passed} passed, ${failed} failed`);
console.log('────────────────────────────────────────\n');
process.exit(failed === 0 ? 0 : 1);
