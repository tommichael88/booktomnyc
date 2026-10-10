     /**
      * store.js
      *
      * PHASE 6 — State-machine glue layer (the "store"), fifth standalone module.
      * See pricing_engine.js, nlp_engine.js, orchestrator_engine.js, UIRenderer.js,
      * and AppController.js for the other four; and BACKLOG_CONSOLIDATED.md /
      * TIMELINE.md for the full methodology.
      *
      * WHY THIS EXISTS (the real, verified problem it solves):
      * The live qr.html mutates a single global `S` session object (declared/reset
      * in sqRestart) and a `State` cart object directly, from ~20 window.sqX event
      * handlers spread across AppController.js and UIRenderer.js. The TIMELINE's own
      * findings (T11/T27 "looked wired, wasn't"; the sqRestart cart-collision bug
      * where fields set by one entry path silently leaked into the next session)
      * are the direct, recorded symptoms of ad-hoc shared-mutable-state writes with
      * no single choke point. This store adds ONE such choke point: every write
      * becomes a dispatched, named action passed through the pure `appReducer`, so
      * the leak class the timeline documents becomes structurally impossible
      * (a full reset is one RESET_SESSION action, not 30 hand-listed field clears).
      *
      * DESIGN CONSTRAINTS, matching every prior module in this project:
      *  - Framework-free. No Redux dependency. This is a ~40-line hand-rolled store
      *    with the same contract (getState / dispatch / subscribe) so it can be
      *    dropped into a plain global-scope <script> exactly like the other modules,
      *    AND require()'d unchanged in the Node test harness.
      *  - Additive and non-breaking. It does NOT delete or replace the global `S`.
      *    During migration it MIRRORS into the legacy globals (see bindLegacyGlobals)
      *    so existing, un-migrated read sites keep working byte-for-byte while call
      *    sites are moved over one at a time — the same "keep the legacy path as a
      *    fallback" discipline Step B of the plan requires.
      *  - Pure reducer. store.js holds NO business logic; all transitions live in
      *    appReducer.js. This module is only plumbing: hold state, run the reducer,
      *    notify subscribers.
      *
      * LOAD ORDER: load appReducer.js BEFORE this file in the browser (this file
      * reads the global `appReducer` / `initialAppState` at construction time).
      * In Node, it require()s them directly.
      */

     (function(root, factory) {
         // UMD-lite: same dual browser-global / CommonJS pattern the other modules use.
         if (typeof module !== 'undefined' && module.exports) {
             const reducerModule = require('./appReducer.js');
             module.exports = factory(reducerModule.appReducer, reducerModule.initialAppState);
         } else {
             root.__BTNYC_STORE_FACTORY__ = factory;
             // In the browser, appReducer.js defines window.appReducer + window.initialAppState.
             // v9.6 FIX (severe, site-breaking bug): this used to be
             //   root.createStore = function (reducer, preloadedState) {
             //     return factory(reducer || root.appReducer, preloadedState || root.initialAppState);
             //   };
             // which returns factory()'s WHOLE result ({createStore, store}), not a
             // real store -- so window.createStore() never had a .dispatch of its own,
             // causing "TypeError: store.dispatch is not a function" on every single
             // page load (confirmed via direct browser-console error report, then
             // reproduced in a full jsdom load of the real file). The CommonJS/Node
             // branch below never had this bug: require('./store.js').createStore
             // correctly destructures the real, reusable createStore(reducer,
             // preloadedState) function from factory()'s return value. This fix gives
             // the browser branch the exact same contract: call factory() once (using
             // appReducer.js's already-loaded globals), extract its real .createStore,
             // and wrap it with the same default-argument fallback the old code
             // intended but never correctly delivered.
             const _factoryResult = factory(root.appReducer, root.initialAppState);
             root.createStore = function(reducer, preloadedState) {
                 return _factoryResult.createStore(
                     reducer || root.appReducer,
                     preloadedState || root.initialAppState
                 );
             };
         }
     })(typeof self !== 'undefined' ? self : this, function(appReducer, initialAppState) {

         /**
          * createStore(reducer, preloadedState)
          * Returns a store with the standard contract. Deliberately minimal.
          */
         function createStore(reducer, preloadedState) {
             if (typeof reducer !== 'function') {
                 throw new Error('StoreError: reducer must be a function (did appReducer.js load first?).');
             }

             // The reducer's own default is the single source of truth for shape;
             // running it once with a private @@INIT action guarantees a fully-formed
             // state even if preloadedState is undefined.
             let currentState =
                 preloadedState !== undefined ?
                 preloadedState :
                 reducer(undefined, {
                     type: '@@btnyc/INIT'
                 });

             const listeners = new Set();
             let isDispatching = false;

             function getState() {
                 if (isDispatching) {
                     // Guard against the classic footgun of reading state mid-reduce, which
                     // would return a half-applied value. Matches Redux's own invariant.
                     throw new Error('StoreError: cannot getState() while the reducer is running.');
                 }
                 return currentState;
             }

             function dispatch(action) {
                 if (!action || typeof action.type !== 'string') {
                     throw new Error('StoreError: actions must be plain objects with a string `type`.');
                 }
                 if (isDispatching) {
                     throw new Error('StoreError: reducers must not dispatch (found a nested dispatch).');
                 }

                 const prevState = currentState;
                 try {
                     isDispatching = true;
                     currentState = reducer(currentState, action);
                 } finally {
                     isDispatching = false;
                 }

                 // Only notify when the top-level reference actually changed. The reducer
                 // is written to return the SAME object for no-op actions (see appReducer),
                 // so unrelated dispatches never trigger a re-render storm.
                 if (currentState !== prevState) {
                     listeners.forEach(function(l) {
                         try {
                             l(currentState, prevState, action);
                         } catch (e) {
                             console.error('StoreError: a subscriber threw:', e);
                         }
                     });
                 }
                 return action;
             }

             /**
              * subscribe(listener) -> unsubscribe()
              * listener(nextState, prevState, action)
              */
             function subscribe(listener) {
                 if (typeof listener !== 'function') {
                     throw new Error('StoreError: subscribe expects a function.');
                 }
                 listeners.add(listener);
                 let active = true;
                 return function unsubscribe() {
                     if (!active) return;
                     active = false;
                     listeners.delete(listener);
                 };
             }

             /**
              * bindLegacyGlobals(win) — MIGRATION BRIDGE, removed at the end of Phase 6.
              *
              * The single, deliberate exception to "no legacy leakage". While call sites
              * are being migrated off direct `S.*` / `State.*` mutation, this keeps the
              * old global objects in sync with the store's `session` and `cart` slices so
              * that any not-yet-migrated READ site still sees correct data. It never
              * writes back into the store — it is a one-way mirror out. Delete this whole
              * method (and its subscribe call) once grep confirms zero remaining direct
              * reads of the legacy globals, per Step B of the purge plan.
              */
             function bindLegacyGlobals(win) {
                 win = win || (typeof window !== 'undefined' ? window : {});
                 const mirror = function(state) {
                     if (win.S && typeof win.S === 'object') {
                         Object.assign(win.S, state.session.legacyView);
                     } else {
                         win.S = Object.assign({}, state.session.legacyView);
                     }
                     // v9.6 FIX: was `win.State && typeof win.State === 'object'`. State is
                     // declared with `const State = {...}` in qr.html's main script block --
                     // in classic (non-module) scripts, top-level const/let never becomes a
                     // window property (unlike var), so win.State was always undefined and
                     // this mirroring code silently never ran. Confirmed via direct test:
                     // the store correctly received dispatched cart changes, but the real,
                     // bare `State` object every render function actually reads stayed
                     // permanently stale/empty. This never mattered before the cart
                     // mutation functions were migrated to dispatch-based writes (the old
                     // code mutated the bare State object directly), but it's a real,
                     // user-visible bug now that they rely on this mirror. bindLegacyGlobals
                     // runs in the same shared global lexical scope as State (classic
                     // script tags share one lexical environment for top-level
                     // const/let/class declarations), so referencing the bare identifier
                     // directly is correct and safe here, guarded for contexts where it
                     // might not exist (e.g. an isolated Node test).
                     if (typeof State !== 'undefined' && State && typeof State === 'object') {
                         State.serviceRequest = state.cart.serviceRequest;
                         State.furnitureItems = state.cart.furnitureItems;
                         State.currentStep = state.cart.currentStep;
                     } else if (win.State && typeof win.State === 'object') {
                         win.State.serviceRequest = state.cart.serviceRequest;
                         win.State.furnitureItems = state.cart.furnitureItems;
                         win.State.currentStep = state.cart.currentStep;
                     }
                 };
                 mirror(currentState);
                 return subscribe(mirror);
             }

             // Prime subscribers with the initial state via a real @@INIT pass so any
             // listener that renders on first tick has a fully-formed state to read.
             dispatch({
                 type: '@@btnyc/INIT'
             });

             return {
                 getState,
                 dispatch,
                 subscribe,
                 bindLegacyGlobals
             };
         }

         // Convenience: a ready-to-use singleton wired to the project's own reducer.
         // Call sites can either use this, or build their own via createStore for tests.
         const store = createStore(appReducer, initialAppState);

         return {
             createStore: createStore,
             store: store
         };
     });
