/**
 * appReducer.js
 *
 * PHASE 6 — the pure state-transition function behind store.js.
 *
 * SINGLE SOURCE OF TRUTH FOR SHAPE. Every field below was derived directly
 * from the live qr.html / btnyc.json, NOT invented, matching the project's
 * standing rule that a comment claiming "confirmed against the data" must mean
 * it, not "read a field name by eye" (BACKLOG_CONSOLIDATED.md Section AAA).
 * The exact sources are cited inline per slice so a future reader can re-verify
 * against the real files rather than trust this header:
 *
 *   activeContext  <- makeBookingContext()  (qr.html orchestrator block) +
 *                     the ResolvedRoute built by executeWorkflow().
 *                     entry is one of the 3 REAL paths: 'catalog',
 *                     'other_tile', 'free_text'. 'idle' is added here as the
 *                     pre-entry state (no BookingContext built yet).
 *   quoteData      <- computeUnifiedQuote()/orch_compute_quote() return object
 *                     (laborEstimate, dispatchFee, checkoutStateKey, ...) and
 *                     the 4 real checkout_states in btnyc.json.
 *   intakeAnswers  <- the `answers` map executeWorkflow threads through
 *                     (orch_apply_location_hints, orch_compute_quote) and the
 *                     live handleIntakeAnswer(moduleKey, label) event.
 *   tagState       <- S.detTagIds / S.manTagIds / S.negatedTagIds / S.userTagIds
 *                     (qr.html sqRestart) and BookingContext.manuallyToggledTagIds
 *                     / negatedTagIds.
 *   cart           <- the global `State` object: { serviceRequest[],
 *                     furnitureItems[], currentStep } (qr.html line ~790).
 *
 * The reducer ALSO maintains `session.legacyView`: a flat object with EXACTLY
 * the keys the live `S` object carries (the full list from sqRestart), so the
 * migration bridge (store.bindLegacyGlobals) can mirror the store back onto the
 * legacy global `S` byte-for-byte while call sites are moved over one at a time.
 * This is what makes the change additive and non-breaking per the purge plan.
 *
 * PURITY CONTRACT: this file imports nothing, touches no DOM, reads no globals,
 * and never mutates its inputs. Given the same (state, action) it always
 * returns the same result, and returns the SAME reference for any action it
 * does not handle (so store.js can skip notifying subscribers on no-ops).
 */

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.appReducer = api.appReducer;
    root.initialAppState = api.initialAppState;
    root.ActionTypes = api.ActionTypes;
    root.actions = api.actions;
  }
})(typeof self !== 'undefined' ? self : this, function () {

  'use strict';

  // ─────────────────────────── Action types ───────────────────────────
  // Named string constants (no magic strings at call sites). Grouped by slice.
  const ActionTypes = Object.freeze({
    // activeContext (entry / routing)
    BEGIN_CONTEXT:        'context/BEGIN',          // a BookingContext was built (catalog|other_tile|free_text)
    RESOLVE_ROUTE:        'context/RESOLVE_ROUTE',   // executeWorkflow returned a ResolvedRoute
    SET_ENTRY_PATH:       'context/SET_ENTRY_PATH',  // narrow: change entry only

    // quoteData
    SET_QUOTE:            'quote/SET',               // store a computeUnifiedQuote result
    CLEAR_QUOTE:          'quote/CLEAR',

    // intakeAnswers
    SET_INTAKE_ANSWER:    'intake/SET_ANSWER',       // handleIntakeAnswer(moduleKey, label)
    SET_INTAKE_CHAIN:     'intake/SET_CHAIN',        // the resolved intakeChain (module list)
    CLEAR_INTAKE:         'intake/CLEAR',

    // tagState
    TOGGLE_MANUAL_TAG:    'tags/TOGGLE_MANUAL',      // sqToggleTag
    SET_DETECTED_TAGS:    'tags/SET_DETECTED',       // NLP detTagIds
    SET_SUGGESTED_TAGS:   'tags/SET_SUGGESTED',
    NEGATE_TAG:           'tags/NEGATE',

    // session scalars (qty / desc / stype / notes / flags)
    SET_QTY:              'session/SET_QTY',         // sqAdjQty
    SET_DESC:             'session/SET_DESC',
    SET_SERVICE_TYPE:     'session/SET_STYPE',       // sqPickType
    PATCH_SESSION:        'session/PATCH',           // generic field set for un-migrated fields

    // cart (the legacy `State` object)
    ADD_TO_CART:          'cart/ADD',
    REMOVE_FROM_CART:     'cart/REMOVE',
    UPDATE_CART_ENTRY:    'cart/UPDATE',
    SET_CART:             'cart/SET',                // bulk hydrate from loadCart()
    SET_CURRENT_STEP:     'cart/SET_STEP',

    // lifecycle
    RESET_SESSION:        'session/RESET',           // the sqRestart equivalent — ONE action
  });

  // ────────────────────── The legacy `S` field template ──────────────────────
  // EXACT keys/defaults from qr.html sqRestart's `S = { ... }` reset block.
  // Kept as a factory so every reset produces a fresh object (no shared refs —
  // the exact bug class sqRestart's giant manual list existed to prevent).
  function makeLegacyS() {
    return {
      qty: 1,
      intent: null,
      stype: null,
      detTagIds: [],
      manTagIds: [],
      negatedTagIds: [],
      userTagIds: [],
      desc: '',
      adlibConfirmed: false,
      _suggestedTagIds: [],
      _svc: null,
      answers: {},
      _curatedMode: false,
      _jobNotes: '',
      _objectNoun: null,
      _location: null,
      _sizeHint: null,
      _notes: null,
      _confidenceStrategy: null,
      _escalatedBy: null,
      _forceModules: null,
      _fromBuilder: false,
      _selfQuoteSvc: null,
      _isOtherTileEntry: false,
      _autoSelectedFrom: null,
      _nlpSeedDesc: null,
      _nlpSeedObject: null,
    };
  }

  // ───────────────────────── Initial state ─────────────────────────
  const initialAppState = Object.freeze({
    // 1. activeContext — the current entryPath + resolved route. Mirrors
    //    makeBookingContext() + executeWorkflow()'s ResolvedRoute.
    activeContext: {
      entryPath: 'idle',            // 'idle' | 'catalog' | 'other_tile' | 'free_text'
      bookingContext: null,         // the raw BookingContext object as built by makeBookingContext
      route: null,                  // the ResolvedRoute from executeWorkflow (entity, uiTemplate, ...)
      uiTemplate: null,             // convenience mirror of route.uiTemplate: self_quote|curated_card|chip_grid|legacy_flow
      resolvedEntityId: null,       // route.entity?.id
      resolvedEntityType: null,     // route.entityType: 'service'|'dynamic_service'|'group'|'fallback'
    },

    // 2. quoteData — the calculated price/metadata. Mirrors computeUnifiedQuote.
    quoteData: {
      laborEstimate: null,          // number (USD)
      dispatchFee: null,            // number; defaults to 45 live
      checkoutStateKey: null,       // one of: database_summation|diagnostic|project_based|standard_flat_rate
      badgeLabel: '',
      badgeIcon: '',
      btnText: '',
      totalMin: null,
      complexityTier: null,
      isProject: false,
      isDiagnostic: false,
      isAssembly: false,
      meetsConfidenceBar: false,
      raw: null,                    // the full quote object, for un-migrated readers
    },

    // 3. intakeAnswers — user selections. Mirrors the `answers` map + chain.
    intakeAnswers: {
      chain: [],                    // resolved intake_module keys (order matters)
      answers: {},                  // { [moduleKey]: label } — the shape orch_compute_quote reads
    },

    // 4. tagState — NLP + manual tags. Mirrors S.*TagIds + context tag fields.
    tagState: {
      detectedTagIds: [],           // S.detTagIds (from detectTagsNLP)
      manualTagIds: [],             // S.manTagIds (user toggled on)
      negatedTagIds: [],            // S.negatedTagIds (user toggled off / NLP negation)
      suggestedTagIds: [],          // S._suggestedTagIds
      // Derived, read-only convenience: the ACTIVE set executeWorkflow computes
      // as [...manual] minus negated. Recomputed on every tag action so
      // consumers never re-derive it (and never drift from the orchestrator).
      activeTagIds: [],
    },

    // Session scalars + the legacy mirror (see header). `legacyView` is the
    // flat `S`-shaped object the migration bridge writes back onto window.S.
    session: {
      qty: 1,
      desc: '',
      serviceType: null,            // S.stype
      curatedMode: false,           // S._curatedMode
      fromBuilder: false,           // S._fromBuilder
      isOtherTileEntry: false,      // S._isOtherTileEntry
      jobNotes: '',                 // S._jobNotes
      legacyView: makeLegacyS(),
    },

    // 5. cart — the global `State` object.
    cart: {
      serviceRequest: [],
      furnitureItems: [],
      currentStep: 1,
    },
  });

  // ───────────────────────── Helpers (pure) ─────────────────────────
  function computeActiveTagIds(manualTagIds, negatedTagIds) {
    // Mirror of executeWorkflow's activeTagIds line exactly:
    //   [...new Set([...manuallyToggledTagIds])].filter(t => !negated.includes(t))
    const neg = new Set(negatedTagIds || []);
    return [...new Set(manualTagIds || [])].filter(function (t) { return !neg.has(t); });
  }

  // Rebuild the flat legacy `S` view from the structured slices, so the bridge
  // can mirror it onto window.S. This is the ONE place structure->legacy mapping
  // lives; every field maps back to its real S key.
  function projectLegacyView(state) {
    const base = makeLegacyS();
    base.qty              = state.session.qty;
    base.desc             = state.session.desc;
    base.stype            = state.session.serviceType;
    base.intent           = state.activeContext.bookingContext
                              ? state.activeContext.bookingContext.nlpIntent
                              : null;
    base._svc             = state.activeContext.route
                              ? state.activeContext.route.entity
                              : null;
    base._curatedMode     = state.session.curatedMode;
    base._fromBuilder     = state.session.fromBuilder;
    base._isOtherTileEntry = state.session.isOtherTileEntry;
    base._jobNotes        = state.session.jobNotes;
    base.detTagIds        = state.tagState.detectedTagIds.slice();
    base.manTagIds        = state.tagState.manualTagIds.slice();
    base.negatedTagIds    = state.tagState.negatedTagIds.slice();
    base._suggestedTagIds = state.tagState.suggestedTagIds.slice();
    base.userTagIds       = state.tagState.activeTagIds.slice();
    base.answers          = Object.assign({}, state.intakeAnswers.answers);
    return base;
  }

  // After any slice update, re-sync the derived legacyView in one place.
  function withLegacyView(state) {
    return Object.assign({}, state, {
      session: Object.assign({}, state.session, {
        legacyView: projectLegacyView(state),
      }),
    });
  }

  // ───────────────────────── The reducer ─────────────────────────
  function appReducer(state, action) {
    if (state === undefined) state = initialAppState;
    if (!action || typeof action.type !== 'string') return state;

    switch (action.type) {

      // ---- activeContext ----
      case ActionTypes.BEGIN_CONTEXT: {
        // payload: { bookingContext }  (already built by makeBookingContext_*)
        const ctx = action.payload && action.payload.bookingContext;
        if (!ctx || typeof ctx.entry !== 'string') return state;
        const next = Object.assign({}, state, {
          activeContext: Object.assign({}, state.activeContext, {
            entryPath: ctx.entry,           // 'catalog' | 'other_tile' | 'free_text'
            bookingContext: ctx,
          }),
          tagState: Object.assign({}, state.tagState, {
            manualTagIds: (ctx.manuallyToggledTagIds || []).slice(),
            negatedTagIds: (ctx.negatedTagIds || []).slice(),
            activeTagIds: computeActiveTagIds(ctx.manuallyToggledTagIds, ctx.negatedTagIds),
          }),
        });
        return withLegacyView(next);
      }

      case ActionTypes.RESOLVE_ROUTE: {
        // payload: { route }  (the ResolvedRoute from executeWorkflow)
        const route = action.payload && action.payload.route;
        if (!route) return state;
        const next = Object.assign({}, state, {
          activeContext: Object.assign({}, state.activeContext, {
            route: route,
            uiTemplate: route.uiTemplate || null,
            resolvedEntityId: (route.entity && route.entity.id) || null,
            resolvedEntityType: route.entityType || null,
          }),
          intakeAnswers: Object.assign({}, state.intakeAnswers, {
            chain: Array.isArray(route.intakeChain) ? route.intakeChain.slice() : state.intakeAnswers.chain,
            answers: route.answers ? Object.assign({}, route.answers) : state.intakeAnswers.answers,
          }),
        });
        // If the route carried a quote, fold it in too (single resolution can
        // arrive already-priced from executeWorkflow's calculate step).
        if (route.quote) {
          return appReducer(next, { type: ActionTypes.SET_QUOTE, payload: { quote: route.quote } });
        }
        return withLegacyView(next);
      }

      case ActionTypes.SET_ENTRY_PATH: {
        const entryPath = action.payload && action.payload.entryPath;
        if (!entryPath || entryPath === state.activeContext.entryPath) return state;
        return withLegacyView(Object.assign({}, state, {
          activeContext: Object.assign({}, state.activeContext, { entryPath: entryPath }),
        }));
      }

      // ---- quoteData ----
      case ActionTypes.SET_QUOTE: {
        const q = action.payload && action.payload.quote;
        if (!q) return state;
        return withLegacyView(Object.assign({}, state, {
          quoteData: {
            laborEstimate: typeof q.laborEstimate === 'number' ? q.laborEstimate : null,
            dispatchFee: typeof q.dispatchFee === 'number' ? q.dispatchFee : null,
            checkoutStateKey: q.checkoutStateKey || null,
            badgeLabel: q.badgeLabel || '',
            badgeIcon: q.badgeIcon || '',
            btnText: q.btnText || '',
            totalMin: typeof q.totalMin === 'number' ? q.totalMin : null,
            complexityTier: q.complexityTier || null,
            isProject: !!q.isProject,
            isDiagnostic: !!q.isDiagnostic,
            isAssembly: !!q.isAssembly,
            meetsConfidenceBar: !!q.meetsConfidenceBar,
            raw: q,
          },
        }));
      }

      case ActionTypes.CLEAR_QUOTE:
        if (state.quoteData.raw === null) return state;
        return withLegacyView(Object.assign({}, state, {
          quoteData: initialAppState.quoteData,
        }));

      // ---- intakeAnswers ----
      case ActionTypes.SET_INTAKE_ANSWER: {
        // payload: { moduleKey, label }  (mirrors handleIntakeAnswer)
        const p = action.payload || {};
        if (!p.moduleKey) return state;
        return withLegacyView(Object.assign({}, state, {
          intakeAnswers: Object.assign({}, state.intakeAnswers, {
            answers: Object.assign({}, state.intakeAnswers.answers, { [p.moduleKey]: p.label }),
          }),
        }));
      }

      case ActionTypes.SET_INTAKE_CHAIN: {
        const chain = action.payload && action.payload.chain;
        if (!Array.isArray(chain)) return state;
        return withLegacyView(Object.assign({}, state, {
          intakeAnswers: Object.assign({}, state.intakeAnswers, { chain: chain.slice() }),
        }));
      }

      case ActionTypes.CLEAR_INTAKE:
        if (state.intakeAnswers.chain.length === 0 &&
            Object.keys(state.intakeAnswers.answers).length === 0) return state;
        return withLegacyView(Object.assign({}, state, {
          intakeAnswers: { chain: [], answers: {} },
        }));

      // ---- tagState ----
      case ActionTypes.TOGGLE_MANUAL_TAG: {
        const tagId = action.payload && action.payload.tagId;
        if (!tagId) return state;
        // A tag's on/off is judged by its EFFECTIVE (active) state, not raw
        // manual membership: a tag can be in manualTagIds AND negatedTagIds at
        // once (e.g. seeded manually, then NLP-negated). Using active state
        // mirrors what executeWorkflow actually sees, and makes a single toggle
        // always flip the visible result. (Regression: verify_store_reducer.js
        // test 5 caught the raw-membership version toggling the wrong way.)
        const isActive = state.tagState.activeTagIds.indexOf(tagId) !== -1;
        let manualTagIds, negatedTagIds;
        if (isActive) {
          // Currently ON -> turn OFF: drop from manual, ensure negated.
          manualTagIds = state.tagState.manualTagIds.filter(function (t) { return t !== tagId; });
          negatedTagIds = state.tagState.negatedTagIds.indexOf(tagId) === -1
            ? state.tagState.negatedTagIds.concat([tagId])
            : state.tagState.negatedTagIds;
        } else {
          // Currently OFF -> turn ON: ensure in manual, clear any negation.
          manualTagIds = state.tagState.manualTagIds.indexOf(tagId) === -1
            ? state.tagState.manualTagIds.concat([tagId])
            : state.tagState.manualTagIds;
          negatedTagIds = state.tagState.negatedTagIds.filter(function (t) { return t !== tagId; });
        }
        return withLegacyView(Object.assign({}, state, {
          tagState: Object.assign({}, state.tagState, {
            manualTagIds: manualTagIds,
            negatedTagIds: negatedTagIds,
            activeTagIds: computeActiveTagIds(manualTagIds, negatedTagIds),
          }),
        }));
      }

      case ActionTypes.SET_DETECTED_TAGS: {
        const ids = (action.payload && action.payload.tagIds) || [];
        return withLegacyView(Object.assign({}, state, {
          tagState: Object.assign({}, state.tagState, { detectedTagIds: ids.slice() }),
        }));
      }

      case ActionTypes.SET_SUGGESTED_TAGS: {
        const ids = (action.payload && action.payload.tagIds) || [];
        return withLegacyView(Object.assign({}, state, {
          tagState: Object.assign({}, state.tagState, { suggestedTagIds: ids.slice() }),
        }));
      }

      case ActionTypes.NEGATE_TAG: {
        const tagId = action.payload && action.payload.tagId;
        if (!tagId || state.tagState.negatedTagIds.indexOf(tagId) !== -1) return state;
        const negatedTagIds = state.tagState.negatedTagIds.concat([tagId]);
        const manualTagIds = state.tagState.manualTagIds.filter(function (t) { return t !== tagId; });
        return withLegacyView(Object.assign({}, state, {
          tagState: Object.assign({}, state.tagState, {
            negatedTagIds: negatedTagIds,
            manualTagIds: manualTagIds,
            activeTagIds: computeActiveTagIds(manualTagIds, negatedTagIds),
          }),
        }));
      }

      // ---- session scalars ----
      case ActionTypes.SET_QTY: {
        const qty = action.payload && action.payload.qty;
        if (typeof qty !== 'number' || qty < 1 || qty === state.session.qty) return state;
        return withLegacyView(Object.assign({}, state, {
          session: Object.assign({}, state.session, { qty: qty }),
        }));
      }

      case ActionTypes.SET_DESC: {
        const desc = (action.payload && action.payload.desc) || '';
        if (desc === state.session.desc) return state;
        return withLegacyView(Object.assign({}, state, {
          session: Object.assign({}, state.session, { desc: desc }),
        }));
      }

      case ActionTypes.SET_SERVICE_TYPE: {
        const stype = action.payload && action.payload.serviceType;
        if (stype === state.session.serviceType) return state;
        return withLegacyView(Object.assign({}, state, {
          session: Object.assign({}, state.session, { serviceType: stype || null }),
        }));
      }

      case ActionTypes.PATCH_SESSION: {
        // Escape hatch for the not-yet-migrated `S._*` fields. Accepts a flat
        // patch of known session keys only; unknown keys are ignored to keep
        // the slice from silently growing (the leak class this replaces).
        const patch = action.payload && action.payload.patch;
        if (!patch || typeof patch !== 'object') return state;
        const allowed = ['qty', 'desc', 'serviceType', 'curatedMode', 'fromBuilder', 'isOtherTileEntry', 'jobNotes'];
        const clean = {};
        allowed.forEach(function (k) { if (k in patch) clean[k] = patch[k]; });
        if (Object.keys(clean).length === 0) return state;
        return withLegacyView(Object.assign({}, state, {
          session: Object.assign({}, state.session, clean),
        }));
      }

      // ---- cart (legacy `State`) ----
      case ActionTypes.ADD_TO_CART: {
        const entry = action.payload && action.payload.entry;
        if (!entry || !entry.id) return state;   // mirrors addToCart's own guard
        return withLegacyView(Object.assign({}, state, {
          cart: Object.assign({}, state.cart, {
            serviceRequest: state.cart.serviceRequest.concat([entry]),
          }),
        }));
      }

      case ActionTypes.REMOVE_FROM_CART: {
        const idx = action.payload && action.payload.index;
        if (typeof idx !== 'number' || idx < 0 || idx >= state.cart.serviceRequest.length) return state;
        return withLegacyView(Object.assign({}, state, {
          cart: Object.assign({}, state.cart, {
            serviceRequest: state.cart.serviceRequest.filter(function (_, i) { return i !== idx; }),
          }),
        }));
      }

      case ActionTypes.UPDATE_CART_ENTRY: {
        const p = action.payload || {};
        if (typeof p.index !== 'number' || !p.patch) return state;
        const serviceRequest = state.cart.serviceRequest.map(function (e, i) {
          return i === p.index ? Object.assign({}, e, p.patch) : e;
        });
        return withLegacyView(Object.assign({}, state, {
          cart: Object.assign({}, state.cart, { serviceRequest: serviceRequest }),
        }));
      }

      case ActionTypes.SET_CART: {
        const list = (action.payload && action.payload.serviceRequest) || [];
        return withLegacyView(Object.assign({}, state, {
          cart: Object.assign({}, state.cart, { serviceRequest: list.slice() }),
        }));
      }

      case ActionTypes.SET_CURRENT_STEP: {
        const step = action.payload && action.payload.step;
        if (typeof step !== 'number' || step === state.cart.currentStep) return state;
        return withLegacyView(Object.assign({}, state, {
          cart: Object.assign({}, state.cart, { currentStep: step }),
        }));
      }

      // ---- lifecycle ----
      case ActionTypes.RESET_SESSION: {
        // The whole point of the store: sqRestart's 30-field manual reset
        // becomes ONE action that cannot forget a field. Cart is preserved
        // (sqRestart never cleared the cart either — only the session).
        const fresh = Object.assign({}, initialAppState, {
          session: Object.assign({}, initialAppState.session, { legacyView: makeLegacyS() }),
          cart: state.cart,   // preserve the cart across a session restart
        });
        return fresh;
      }

      default:
        // No-op: return the SAME reference so store.js skips notifying.
        return state;
    }
  }

  // ────────────────────── Action creators (optional sugar) ──────────────────────
  // Thin, pure creators so call sites read as store.dispatch(actions.setQty(2)).
  const actions = {
    beginContext:    function (bookingContext) { return { type: ActionTypes.BEGIN_CONTEXT, payload: { bookingContext } }; },
    resolveRoute:    function (route)           { return { type: ActionTypes.RESOLVE_ROUTE, payload: { route } }; },
    setEntryPath:    function (entryPath)       { return { type: ActionTypes.SET_ENTRY_PATH, payload: { entryPath } }; },
    setQuote:        function (quote)           { return { type: ActionTypes.SET_QUOTE, payload: { quote } }; },
    clearQuote:      function ()                { return { type: ActionTypes.CLEAR_QUOTE }; },
    setIntakeAnswer: function (moduleKey, label){ return { type: ActionTypes.SET_INTAKE_ANSWER, payload: { moduleKey, label } }; },
    setIntakeChain:  function (chain)           { return { type: ActionTypes.SET_INTAKE_CHAIN, payload: { chain } }; },
    clearIntake:     function ()                { return { type: ActionTypes.CLEAR_INTAKE }; },
    toggleManualTag: function (tagId)           { return { type: ActionTypes.TOGGLE_MANUAL_TAG, payload: { tagId } }; },
    setDetectedTags: function (tagIds)          { return { type: ActionTypes.SET_DETECTED_TAGS, payload: { tagIds } }; },
    setSuggestedTags:function (tagIds)          { return { type: ActionTypes.SET_SUGGESTED_TAGS, payload: { tagIds } }; },
    negateTag:       function (tagId)           { return { type: ActionTypes.NEGATE_TAG, payload: { tagId } }; },
    setQty:          function (qty)             { return { type: ActionTypes.SET_QTY, payload: { qty } }; },
    setDesc:         function (desc)            { return { type: ActionTypes.SET_DESC, payload: { desc } }; },
    setServiceType:  function (serviceType)     { return { type: ActionTypes.SET_SERVICE_TYPE, payload: { serviceType } }; },
    patchSession:    function (patch)           { return { type: ActionTypes.PATCH_SESSION, payload: { patch } }; },
    addToCart:       function (entry)           { return { type: ActionTypes.ADD_TO_CART, payload: { entry } }; },
    removeFromCart:  function (index)           { return { type: ActionTypes.REMOVE_FROM_CART, payload: { index } }; },
    updateCartEntry: function (index, patch)    { return { type: ActionTypes.UPDATE_CART_ENTRY, payload: { index, patch } }; },
    setCart:         function (serviceRequest)  { return { type: ActionTypes.SET_CART, payload: { serviceRequest } }; },
    setCurrentStep:  function (step)            { return { type: ActionTypes.SET_CURRENT_STEP, payload: { step } }; },
    resetSession:    function ()                { return { type: ActionTypes.RESET_SESSION }; },
  };

  return {
    appReducer: appReducer,
    initialAppState: initialAppState,
    ActionTypes: ActionTypes,
    actions: actions,
    // exported for the test harness / bridge only:
    _computeActiveTagIds: computeActiveTagIds,
    _projectLegacyView: projectLegacyView,
    _makeLegacyS: makeLegacyS,
  };
});
