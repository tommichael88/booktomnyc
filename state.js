// state.js – Redux-style state management for BTNYC

// ---------- Action Types ----------
export const SQ_SET_QTY = 'SQ_SET_QTY';
export const SQ_SET_INTENT = 'SQ_SET_INTENT';
export const SQ_SET_STYPE = 'SQ_SET_STYPE';
export const SQ_TOGGLE_TAG = 'SQ_TOGGLE_TAG';
export const SQ_SET_DESC = 'SQ_SET_DESC';
export const SQ_SET_OBJECT_NOUN = 'SQ_SET_OBJECT_NOUN';
export const SQ_SET_LOCATION = 'SQ_SET_LOCATION';
export const SQ_SET_SIZE_HINT = 'SQ_SET_SIZE_HINT';
export const SQ_SET_ANSWERS = 'SQ_SET_ANSWERS';
export const SQ_SET_ADLIB_CONFIRMED = 'SQ_SET_ADLIB_CONFIRMED';
export const SQ_SET_SVC = 'SQ_SET_SVC';
export const SQ_SET_AUTO_SELECTED = 'SQ_SET_AUTO_SELECTED';
export const SQ_RESET = 'SQ_RESET';

export const BLD_SET_STEP = 'BLD_SET_STEP';
export const BLD_SET_ACTION = 'BLD_SET_ACTION';
export const BLD_SET_OBJECT = 'BLD_SET_OBJECT';
export const BLD_SET_SPECIFIC = 'BLD_SET_SPECIFIC';
export const BLD_SET_CONDITION = 'BLD_SET_CONDITION';
export const BLD_SET_LOCATION = 'BLD_SET_LOCATION';
export const BLD_SET_PRESEEDED = 'BLD_SET_PRESEEDED';
export const BLD_RESET = 'BLD_RESET';

export const CART_ADD_ITEM = 'CART_ADD_ITEM';
export const CART_REMOVE_ITEM = 'CART_REMOVE_ITEM';
export const CART_CLEAR = 'CART_CLEAR';

export const BREADCRUMBS_PUSH = 'BREADCRUMBS_PUSH';
export const BREADCRUMBS_POP = 'BREADCRUMBS_POP';
export const BREADCRUMBS_CLEAR = 'BREADCRUMBS_CLEAR';

export const UI_SET_STEP = 'UI_SET_STEP';
export const UI_TOGGLE_FOCUSED = 'UI_TOGGLE_FOCUSED';
export const UI_TOGGLE_CART_OVERLAY = 'UI_TOGGLE_CART_OVERLAY';
export const UI_TOGGLE_BUILDER = 'UI_TOGGLE_BUILDER';
export const UI_SET_SQ_FLOW_VISIBLE = 'UI_SET_SQ_FLOW_VISIBLE';

export const ROUTE_SET = 'ROUTE_SET';

// ---------- Initial State ----------
export const initialState = {
  sq: {
    qty: 1,
    intent: null,
    stype: null,
    detTagIds: [],
    manTagIds: [],
    negatedTagIds: [],
    userTagIds: [],
    inherentTagIds: [],
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
  },
  builder: {
    step: 0,
    action: null,
    object: null,
    specific: null,
    condition: null,
    location: null,
    qty: 1,
    _stype: null,
    _cat: null,
    _groupId: null,
    _keyword: null,
    _fromOtherTile: false,
    _contextLabel: null,
    _objectLabel: null,
    _allowedTypes: null,
    _preseededSteps: new Set(),
  },
  cart: [],
  breadcrumbs: [],
  ui: {
    currentStep: 1,
    focusedMode: false,
    cartOverlayOpen: false,
    builderOpen: false,
    sqFlowVisible: false,
    quoteVisible: false,
  },
  route: null,
  quote: null,
};

// ---------- Reducer ----------
export function appReducer(state = initialState, action) {
  switch (action.type) {
    // ---- SQ ----
    case SQ_SET_QTY:
      return { ...state, sq: { ...state.sq, qty: action.payload } };
    case SQ_SET_INTENT:
      return { ...state, sq: { ...state.sq, intent: action.payload } };
    case SQ_SET_STYPE:
      return { ...state, sq: { ...state.sq, stype: action.payload } };
    case SQ_TOGGLE_TAG: {
      const { tid } = action.payload;
      const sq = state.sq;
      const man = sq.manTagIds.includes(tid)
        ? sq.manTagIds.filter(t => t !== tid)
        : [...sq.manTagIds, tid];
      const det = sq.detTagIds.includes(tid)
        ? sq.detTagIds.filter(t => t !== tid)
        : [...sq.detTagIds, tid];
      // Mutual exclusion handling here (if needed) – we can implement later.
      return { ...state, sq: { ...sq, manTagIds: man, detTagIds: det } };
    }
    case SQ_SET_DESC:
      return { ...state, sq: { ...state.sq, desc: action.payload } };
    case SQ_SET_OBJECT_NOUN:
      return { ...state, sq: { ...state.sq, _objectNoun: action.payload } };
    case SQ_SET_LOCATION:
      return { ...state, sq: { ...state.sq, _location: action.payload } };
    case SQ_SET_SIZE_HINT:
      return { ...state, sq: { ...state.sq, _sizeHint: action.payload } };
    case SQ_SET_ANSWERS:
      return { ...state, sq: { ...state.sq, answers: { ...state.sq.answers, ...action.payload } } };
    case SQ_SET_ADLIB_CONFIRMED:
      return { ...state, sq: { ...state.sq, adlibConfirmed: action.payload } };
    case SQ_SET_SVC:
      return { ...state, sq: { ...state.sq, _svc: action.payload } };
    case SQ_SET_AUTO_SELECTED:
      return { ...state, sq: { ...state.sq, _autoSelectedFrom: action.payload } };
    case SQ_RESET:
      return { ...state, sq: { ...initialState.sq } };

    // ---- BLD ----
    case BLD_SET_STEP:
      return { ...state, builder: { ...state.builder, step: action.payload } };
    case BLD_SET_ACTION:
      return { ...state, builder: { ...state.builder, action: action.payload } };
    case BLD_SET_OBJECT:
      return { ...state, builder: { ...state.builder, object: action.payload } };
    case BLD_SET_SPECIFIC:
      return { ...state, builder: { ...state.builder, specific: action.payload } };
    case BLD_SET_CONDITION:
      return { ...state, builder: { ...state.builder, condition: action.payload } };
    case BLD_SET_LOCATION:
      return { ...state, builder: { ...state.builder, location: action.payload } };
    case BLD_SET_PRESEEDED:
      return { ...state, builder: { ...state.builder, _preseededSteps: action.payload } };
    case BLD_RESET:
      return { ...state, builder: { ...initialState.builder } };

    // ---- Cart ----
    case CART_ADD_ITEM:
      return { ...state, cart: [...state.cart, action.payload] };
    case CART_REMOVE_ITEM:
      return { ...state, cart: state.cart.filter(item => item.id !== action.payload) };
    case CART_CLEAR:
      return { ...state, cart: [] };

    // ---- Breadcrumbs ----
    case BREADCRUMBS_PUSH:
      return { ...state, breadcrumbs: [...state.breadcrumbs, action.payload] };
    case BREADCRUMBS_POP:
      return { ...state, breadcrumbs: state.breadcrumbs.slice(0, -1) };
    case BREADCRUMBS_CLEAR:
      return { ...state, breadcrumbs: [] };

    // ---- UI ----
    case UI_SET_STEP:
      return { ...state, ui: { ...state.ui, currentStep: action.payload } };
    case UI_TOGGLE_FOCUSED:
      return { ...state, ui: { ...state.ui, focusedMode: !state.ui.focusedMode } };
    case UI_TOGGLE_CART_OVERLAY:
      return { ...state, ui: { ...state.ui, cartOverlayOpen: !state.ui.cartOverlayOpen } };
    case UI_TOGGLE_BUILDER:
      return { ...state, ui: { ...state.ui, builderOpen: !state.ui.builderOpen } };
    case UI_SET_SQ_FLOW_VISIBLE:
      return { ...state, ui: { ...state.ui, sqFlowVisible: action.payload } };

    // ---- Route ----
    case ROUTE_SET:
      return { ...state, route: action.payload, quote: action.payload?.quote || null };

    default:
      return state;
  }
}

// ---------- Store Creator ----------
export function createStore(reducer, initialState) {
  let state = initialState;
  const listeners = [];

  const getState = () => state;
  const dispatch = (action) => {
    state = reducer(state, action);
    listeners.forEach(fn => fn(state));
    return state;
  };
  const subscribe = (fn) => {
    listeners.push(fn);
    return () => { /* unsubscribe not implemented in minimal version */ };
  };

  return { getState, dispatch, subscribe };
}
