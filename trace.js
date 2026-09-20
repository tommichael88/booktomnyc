/**
 * trace.js
 *
 * Component-level tracing overlay. Extracted from qr.html into its own
 * file so future edits to qr.html cannot accidentally lose or regress
 * this layer. Loaded via a plain <script src> tag, before
 * pricing_engine.js.
 *
 * ────────────────────────────────────────────────────────────────────
 * PUBLIC API (all globals, callable from any classic-script block)
 * ────────────────────────────────────────────────────────────────────
 *
 *   _trace(layer, label, data)          — push an entry. No-op when off.
 *   _traceFn(name, args)                — record a function-entry marker;
 *                                         RETURNS a handle with:
 *                                           .branch(name, data)
 *                                           .return(data)
 *                                           .error(err)
 *                                         Calling the handle's methods is
 *                                         OPTIONAL — the one-line pattern
 *                                         (_traceFn(...); and nothing else)
 *                                         still works exactly as before.
 *   _traceStart(input, entryPath)       — begin a new logical flow.
 *   _traceExport()                      — compact JSON string of the log.
 *   _traceToggle(on)                    — enable/disable.
 *   _renderTraceOverlay(force)          — force a panel redraw.
 *   _traceDomSnapshot(label)            — capture what's rendered now.
 *   _traceTiles(containerSelector, lbl) — capture visible tile labels.
 *
 * ────────────────────────────────────────────────────────────────────
 * AUTOMATIC MECHANISMS (no qr.html changes required)
 * ────────────────────────────────────────────────────────────────────
 *
 *   1. Post-click state diff: after every user click, the tracer
 *      records observable state (breadcrumbs, step, focused-mode, key
 *      element visibility, S flags) as a microtask, compares to the
 *      pre-click state, and emits a `session/state_change` entry with
 *      the diff if anything moved. This is the mechanism that makes
 *      "which internal function actually changed the screen" traceable
 *      WITHOUT instrumenting that function.
 *
 *   2. Auto-entryPath: whenever the breadcrumb signature changes, the
 *      session's entryPath is updated to reflect the current
 *      navigation position, so pure-catalog paths are no longer stuck
 *      at "catalog_direct (inferred)".
 *
 *   3. Cached observable-state reads within an 8ms window — a burst of
 *      entries in the same task shares one snapshot rather than
 *      re-reading the DOM per entry.
 *
 * ────────────────────────────────────────────────────────────────────
 * RECOMMENDED qr.html INSTRUMENTATION (each line is optional; each is a
 * single line and can be deleted just as easily)
 * ────────────────────────────────────────────────────────────────────
 *
 * One-line pattern (entry only):
 *
 *   function enterFocusedMode(hideTextBar = false) {
 *       _traceFn('enterFocusedMode', { hideTextBar });
 *       // ... rest unchanged ...
 *   }
 *
 * Handle pattern (entry + branch + return — full causality):
 *
 *   function renderComponentSymptomPicker(container, group, category_id, chosenAction) {
 *       const _t = _traceFn('renderComponentSymptomPicker',
 *                           { groupId: group?.id, chosenAction });
 *       // ...
 *       if (isComponentFirst) { _t.branch('component_first', { ids: ra.real_component_ids }); ... }
 *       else if (isSymptomFirst) { _t.branch('symptom_first', { ids: ra.real_symptom_ids }); ... }
 *       else { _t.branch('undetermined'); ... }
 *       // ...
 *       _t.return({ tilesRendered: ids.length });
 *   }
 *
 * Load order note: classic (non-module) script semantics — top-level
 * `function` declarations become window globals, and top-level const/let
 * live in the shared global lexical environment.
 *
 * CSP note: qr.html's current policy allows script-src 'self' and
 * 'unsafe-inline' — so ./trace.js served from the same origin loads
 * without any CSP change.
 *
 * Service-worker note: bump sw.js's cache name whenever this file
 * changes, or the tester's browser may serve a stale copy.
 */

// ─── Build marker ───────────────────────────────────────────────────
const TRACE_BUILD_VERSION = 'T137';

// ─── Persistent tracing state ───────────────────────────────────────
window._traceEnabled = false;
window._traceLog = [];
window._traceInput = null;
window._traceEntryPath = null;
window._editingFlagNoteSeq = null;
window._lastRenderedTraceCount = 0;
window._traceFilterText = '';
window._traceHiddenLayers = null;   // lazily initialised to an empty Set
window._traceFlaggedOnly = false;
// Panel entry collapse state: Set of seqs currently expanded. Entries are
// collapsed by default so long traces stay scannable; clicking a card
// header toggles expansion.
window._traceExpandedSeqs = null;   // lazily initialised to an empty Set

// ─── Module-private state (not exported) ────────────────────────────
let _lastInteractionSeq = null;
let _renderScheduled = false;
let _estimateCache = null;
let _estimateCacheAt = 0;
let _observableCache = null;
let _observableCacheAt = 0;
let _errorCaptureInstalled = false;
let _lastBreadcrumbSig = null;
let _stateDiffInstalled = false;

// ─── Small utilities ────────────────────────────────────────────────

function _simpleHash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(16).padStart(8, '0');
}

function _safeClone(data) {
    if (data == null) return {};
    let clone;
    try {
        clone = (typeof structuredClone === 'function')
            ? structuredClone(data)
            : JSON.parse(JSON.stringify(data));
    } catch (e) {
        try {
            clone = JSON.parse(JSON.stringify(data, (k, v) => {
                if (typeof v === 'function') return '[Function ' + (v.name || 'anonymous') + ']';
                if (typeof v === 'symbol') return String(v);
                return v;
            }));
        } catch (e2) {
            return { _cloneFailed: String(e), _dataType: typeof data };
        }
    }
    try {
        const s = JSON.stringify(clone);
        if (s.length > 50000) {
            return { _truncated: true, _originalSize: s.length,
                     _preview: s.slice(0, 2000) + '…[truncated]' };
        }
    } catch (e) { /* circular after clone — leave as-is */ }
    return clone;
}

function _isVisible(el) {
    if (!el) return false;
    let cs;
    try { cs = window.getComputedStyle(el); } catch (e) { return false; }
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return false;
    if (parseFloat(cs.opacity) === 0) return false;
    if (el.offsetParent === null) {
        let p = el.parentElement;
        while (p) {
            try { if (window.getComputedStyle(p).position === 'fixed') return true; }
            catch (e) { break; }
            p = p.parentElement;
        }
        return false;
    }
    return true;
}

function _readElementVisibility(id) {
    const el = document.getElementById(id);
    if (!el) return 'absent';
    let cs;
    try { cs = window.getComputedStyle(el); } catch (e) { return 'error'; }
    const disp = cs.display;
    if (disp === 'none') return 'none';
    if (cs.visibility === 'hidden') return disp + '/hidden';
    if (parseFloat(cs.opacity) === 0) return disp + '/opacity0';
    const r = el.getBoundingClientRect();
    const v = _isVisible(el) ? 'vis' : 'hid';
    return disp + '/' + v + '/' + Math.round(r.width) + 'x' + Math.round(r.height);
}

const _KEY_ELEMENTS = [
    'sqTextBar', 'category-card', 'serviceContainer',
    'serviceRequestSummary', 'intakeQuestionsContainer',
    'sqQuoteOut', 'sqStepFlow', 'sqBuilder',
    'cartOverlay', 'bookingStepBar',
];

// Compact signature of the current breadcrumb path. Used to detect
// navigation transitions (the auto-entryPath mechanism) and to
// distinguish navigation entries in the diff.
function _breadcrumbSignature() {
    try {
        if (typeof Breadcrumbs !== 'undefined' && Breadcrumbs && Array.isArray(Breadcrumbs.stack)) {
            return Breadcrumbs.stack.map(f =>
                f.type + (f.group ? ':' + f.group : (f.category_id ? ':' + f.category_id : ''))).join('|');
        }
    } catch (e) { /* degrade silently */ }
    return '';
}

// Full observable-state snapshot. Cached within an 8ms window so a
// burst of trace entries in the same task shares one read rather than
// re-reading the DOM per entry.
function _readObservableState(force) {
    const now = Date.now();
    if (!force && _observableCache && now - _observableCacheAt < 8) return _observableCache;

    const out = {};
    try {
        if (typeof Breadcrumbs !== 'undefined' && Breadcrumbs && Array.isArray(Breadcrumbs.stack)) {
            out.breadcrumbs = Breadcrumbs.stack.map(f =>
                f.type + (f.group ? ':' + f.group : (f.category_id ? ':' + f.category_id : '')));
        } else {
            out.breadcrumbs = null;
        }
    } catch (e) { out.breadcrumbs = '_err:' + e; }

    try {
        if (typeof State !== 'undefined' && State) out.step = State.currentStep;
    } catch (e) { out.step = '_err:' + e; }

    try {
        const fm = document.querySelector('.main-card-schedule-service');
        out.focusedMode = fm ? fm.classList.contains('focused-mode') : null;
    } catch (e) { out.focusedMode = '_err:' + e; }

    try {
        out.uiTemplate = (window._currentRoute && window._currentRoute.uiTemplate) || null;
        if (window._currentRoute) {
            out.route = {
                entityType: window._currentRoute.entityType || null,
                entityId: (window._currentRoute.entity && window._currentRoute.entity.id) || null,
            };
        }
    } catch (e) { out.uiTemplate = '_err:' + e; }

    try {
        out.visibility = {};
        for (const id of _KEY_ELEMENTS) out.visibility[id] = _readElementVisibility(id);
    } catch (e) { out.visibility = '_err:' + e; }

    try {
        if (typeof S !== 'undefined' && S) {
            out.intent = S.intent
                ? { category: S.intent.category, group: S.intent._groupId,
                    stype: S.intent.stype, key: S.intent.key }
                : null;
            out.svcId = (S._svc && S._svc.id) || null;
            out.entryFlags = {
                otherTile: !!S._isOtherTileEntry,
                fromBuilder: !!S._fromBuilder,
                curated: !!S._curatedMode,
                adlibConfirmed: !!S.adlibConfirmed,
            };
            out.qty = S.qty;
        }
    } catch (e) { out.intent = '_err:' + e; }

    _observableCache = out;
    _observableCacheAt = now;
    return out;
}

// Compute the diff between two observable-state snapshots. Only
// top-level scalar fields and the visibility map are diffed — the
// deeper objects (route, intent, entryFlags) are compared by JSON
// equality since they're small. Returns null when nothing changed.
function _diffObservableState(pre, post) {
    if (!pre || !post) return null;
    const changes = {};
    const topKeys = ['breadcrumbs', 'step', 'focusedMode', 'uiTemplate', 'intent', 'svcId', 'entryFlags', 'qty', 'route'];
    for (const k of topKeys) {
        const a = JSON.stringify(pre[k]);
        const b = JSON.stringify(post[k]);
        if (a !== b) changes[k] = { before: pre[k], after: post[k] };
    }
    if (pre.visibility && post.visibility) {
        const visDiff = {};
        for (const id of _KEY_ELEMENTS) {
            if (pre.visibility[id] !== post.visibility[id]) {
                visDiff[id] = { before: pre.visibility[id], after: post.visibility[id] };
            }
        }
        if (Object.keys(visDiff).length) changes.visibility = visDiff;
    }
    return Object.keys(changes).length ? changes : null;
}

// ─── Core trace write ───────────────────────────────────────────────

function _trace(layer, label, data) {
    if (!window._traceEnabled) return;
    try {
        // Auto-update entryPath from the actual breadcrumb state on every
        // non-interaction entry. Replaces the old "inferred" placeholder
        // with a real navigation path like
        //   "catalog:wall_mounting > wall_mounting_drywall_or_plaster"
        // whenever the breadcrumb stack is non-empty. Only writes when
        // no explicit _traceStart has fired this session, or when the
        // breadcrumbs have moved since the last update.
        const bcSig = _breadcrumbSignature();
        if (bcSig && bcSig !== _lastBreadcrumbSig) {
            _lastBreadcrumbSig = bcSig;
            try {
                const bc = (typeof Breadcrumbs !== 'undefined' && Breadcrumbs.stack) || [];
                window._traceEntryPath = 'catalog:' + bc
                    .map(f => f.type + (f.group ? ':' + f.group : (f.category_id ? ':' + f.category_id : '')))
                    .join(' > ');
            } catch (e) { /* best-effort */ }
        }
        if (!window._traceEntryPath && layer !== 'user_interaction') {
            window._traceEntryPath = 'catalog_direct (inferred -- no explicit _traceStart call fired on this path)';
        }

        const enriched = (layer === 'session' || layer === 'fn_call' || layer === 'fn_return')
            ? Object.assign({}, data || {}, { _observable: _readObservableState() })
            : data;

        const entry = {
            seq: window._traceLog.length,
            t: Date.now(),
            layer,
            label,
            data: _safeClone(enriched == null ? {} : enriched),
        };
        if (layer !== 'user_interaction' && _lastInteractionSeq != null) {
            entry.parentSeq = _lastInteractionSeq;
        }

        window._traceLog.push(entry);

        const MAX_ENTRIES = 2000;
        if (window._traceLog.length > MAX_ENTRIES) {
            window._traceLog = window._traceLog.slice(-Math.floor(MAX_ENTRIES / 2));
            window._traceLog.forEach((e, i) => { e.seq = i; });
            window._traceLog.forEach(e => { if ('parentSeq' in e) delete e.parentSeq; });
            _lastInteractionSeq = null;
        }

        _scheduleRender();
    } catch (e) {
        console.warn('[trace] entry failed, ignored:', e);
    }
}

// Records a function entry AND returns a handle the caller may use to
// record branch decisions, a return value, and (implicitly, on return)
// the duration. If the caller ignores the handle, behaviour is
// identical to the old _traceFn(name, args) one-liner.
function _traceFn(name, args) {
    const startSeq = window._traceLog.length;
    _trace('fn_call', name, args || {});

    // When tracing is off, _trace was a no-op — return a no-op handle so
    // callers can invoke its methods unconditionally without branching.
    const enabled = window._traceEnabled;
    let closed = false;
    const _nowAtEntry = Date.now();

    return {
        branch: function (branchName, branchData) {
            if (!enabled || closed) return;
            _trace('fn_call', name + ':branch', Object.assign({
                branch: branchName,
                _entrySeq: startSeq,
            }, branchData || {}));
        },
        return: function (returnData) {
            if (!enabled || closed) return;
            closed = true;
            _trace('fn_return', name, Object.assign({
                _entrySeq: startSeq,
                durationMs: Date.now() - _nowAtEntry,
            }, returnData || {}));
        },
        error: function (err) {
            if (!enabled || closed) return;
            closed = true;
            _trace('fn_return', name + ':error', {
                _entrySeq: startSeq,
                durationMs: Date.now() - _nowAtEntry,
                error: String(err && err.message || err).slice(0, 300),
            });
        },
    };
}

function _traceStart(input, entryPath) {
    if (!window._traceEnabled) return;
    window._traceInput = input;
    window._traceEntryPath = entryPath || 'unknown';
    window._editingFlagNoteSeq = null;
    const observed = _readObservableState(true);
    const bc = Array.isArray(observed.breadcrumbs) ? observed.breadcrumbs : [];
    const claimed = entryPath || 'unknown';
    let mismatch = null;
    if (claimed === 'smart_quote' && bc.length > 0) {
        mismatch = { claimed, breadcrumbs: bc, step: observed.step };
    } else if (claimed === 'catalog' && observed.uiTemplate === 'self_quote') {
        mismatch = { claimed, uiTemplate: observed.uiTemplate };
    }
    _trace('session', 'context_transition', {
        entryPath: claimed,
        input,
        entryPathMismatch: mismatch,
    });
}

// ─── Export ─────────────────────────────────────────────────────────

function _traceExport() {
    const pricingEntries = window._traceLog.filter(e => e.layer === 'pricing_engine');
    const last = pricingEntries[pricingEntries.length - 1];
    const summary = last ? {
        finalPrice: last.data.laborEstimate,
        dispatchFee: last.data.dispatchFee,
        qty: last.data.qty,
        answers: last.data.answers || {},
        complexityTier: last.data.complexityTier,
        checkoutStateKey: last.data.checkoutStateKey,
        meetsConfidenceBar: last.data.meetsConfidenceBar,
        totalConfidence: last.data.totalConfidence,
        friction: last.data.friction,
        frictionThreshold: last.data.frictionThreshold,
    } : null;

    const domEntries = window._traceLog.filter(e => e.layer === 'dom_snapshot');
    const lastDomSnapshot = domEntries.length ? domEntries[domEntries.length - 1].data : null;

    let btnycHash = null;
    try { btnycHash = _simpleHash(JSON.stringify(window.DB || {})); } catch (e) { /* best-effort */ }

    const flagged = window._traceLog.filter(e => e._flag && e._flag.flagged);
    const annotations = flagged.map(e => ({
        seq: e.seq,
        layer: e.layer,
        label: e.label,
        note: (e._flag && e._flag.note) || null,
        flaggedAt: (e._flag && e._flag.flaggedAt) || null,
        entrySnapshot: e.data,
    }));

    // A "state-change chain" — every state_change entry flattened into
    // a compact timeline. Gives a bug-fixing reader the sequence of
    // real navigation transitions without having to walk the full trace.
    const stateChanges = window._traceLog
        .filter(e => e.layer === 'session' && e.label === 'state_change')
        .map(e => ({
            seq: e.seq,
            afterClick: e.parentSeq,
            changed: Object.keys(e.data.changes || {}),
            breadcrumbsAfter: (e.data.changes && e.data.changes.breadcrumbs && e.data.changes.breadcrumbs.after) || null,
        }));

    return JSON.stringify({
        meta: {
            entryPath: window._traceEntryPath || 'unknown',
            traceBuildVersion: TRACE_BUILD_VERSION,
            btnycJsonHash: btnycHash,
            exportedAt: new Date().toISOString(),
            totalEntries: window._traceLog.length,
            flaggedCount: flagged.length,
            stateChangeCount: stateChanges.length,
        },
        summary,
        annotations,
        stateChanges,
        observedState: _readObservableState(true),
        lastVisibleScreen: lastDomSnapshot,
        narrative: _traceNarrative(window._traceLog),
        input: window._traceInput,
        trace: window._traceLog,
    });
}

function _traceToggle(on) {
    window._traceEnabled = (on !== undefined) ? !!on : !window._traceEnabled;
    if (window._traceEnabled) {
        _installErrorCapture();
        _installStateDiff();
    }
    if (typeof _renderTraceOverlay === 'function') _renderTraceOverlay(true);
    return window._traceEnabled;
}

// ─── Estimate / selected-answer reads (with caching) ────────────────

function _readCurrentEstimate() {
    const now = Date.now();
    if (_estimateCache && now - _estimateCacheAt < 100) return _estimateCache;
    const candidates = [
        '#sqLivePrice', '.sq-ic-price', '.iph-price', '.qprice',
        '.qpranger', '#current-estimate', '.price-value', '#sqCurEstBtn',
    ];
    let result = null;
    for (const sel of candidates) {
        const el = document.querySelector(sel);
        if (!el) continue;
        if (!_isVisible(el)) continue;
        const t = (el.textContent || '').trim();
        if (t) { result = { selector: sel, text: t.slice(0, 80) }; break; }
    }
    _estimateCache = result;
    _estimateCacheAt = now;
    return result;
}

function _readPriorSelection(el) {
    const mod = el && el.dataset && el.dataset.mod;
    if (!mod) return null;
    const scope = el.closest('.sq-ic-q') || el.closest('.intake-module-step') || el.parentElement;
    if (!scope) return null;
    let selected = null;
    try {
        selected = scope.querySelector('[data-mod="' + mod.replace(/"/g, '\\"') + '"].sel');
    } catch (e) { /* malformed selector */ }
    if (!selected || selected === el) return null;
    return { label: selected.dataset.label || (selected.textContent || '').trim().slice(0, 80) };
}

function _readScreenContext() {
    const ctx = {};
    const estimate = _readCurrentEstimate();
    if (estimate) ctx.estimate = estimate;
    const selected = [];
    document.querySelectorAll('.sq-ic-btn.sel, .ims-chip.sel').forEach(el => {
        const mod = el.dataset && el.dataset.mod;
        const label = (el.dataset && el.dataset.label) || (el.textContent || '').trim();
        if (mod) selected.push({ mod, label: label.slice(0, 60) });
    });
    if (selected.length) ctx.selectedAnswers = selected;
    return ctx;
}

// ─── Tile snapshot helper ───────────────────────────────────────────
// Capture the visible tile labels inside a container. Useful after
// any renderServices / renderComponentSymptomPicker / showServiceTypesForGroup
// call, to record what was actually on screen (not just the container's
// dimensions, which the visibility map already covers).
function _traceTiles(containerSelector, label) {
    if (typeof _trace !== 'function' || !window._traceEnabled) return;
    try {
        const container = typeof containerSelector === 'string'
            ? document.querySelector(containerSelector)
            : containerSelector;
        if (!container) return;
        const tiles = [...container.querySelectorAll('.group-tile, .service-tile, .detail-tile')]
            .map(t => (t.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60))
            .filter(Boolean);
        _trace('dom_snapshot', (label || 'tiles') + ':rendered', {
            container: typeof containerSelector === 'string' ? containerSelector : '(node)',
            count: tiles.length,
            tiles,
        });
    } catch (e) {
        console.warn('[trace] tile snapshot failed, ignored:', e);
    }
}

// ─── Post-click state-diff ──────────────────────────────────────────
// The mechanism that makes "which internal function actually moved the
// state" traceable WITHOUT instrumenting the function. On every click,
// the interaction listener records pre-click observable state, then
// schedules a microtask. When the microtask runs (after all bubble-
// phase handlers have completed for that click), the post-click state
// is captured and diffed. Non-empty diffs are emitted as
// session/state_change entries with parentSeq already pointing at the
// triggering click.
function _installStateDiff() {
    if (_stateDiffInstalled) return;
    _stateDiffInstalled = true;
    // Nothing further — the interaction listener does the scheduling on
    // each click; this function exists purely as an idempotent install
    // marker so the toggle-on path can call it without caring whether
    // it's already run.
}

// ─── Panel rendering (rAF-debounced) ────────────────────────────────

function _scheduleRender() {
    if (_renderScheduled) return;
    _renderScheduled = true;
    const flush = () => {
        _renderScheduled = false;
        _renderTraceOverlay();
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(flush);
    else setTimeout(flush, 16);
}

const _LAYER_COLORS = {
    nlp_engine: '#38bdf8',
    orchestrator_engine: '#fbbf24',
    pricing_engine: '#4ade80',
    ui_renderer: '#f472b6',
    dom_snapshot: '#a78bfa',
    user_interaction: '#fb923c',
    session: '#94a3b8',
    fn_call: '#22d3ee',
    fn_return: '#0e7490',
};

const _ALL_LAYERS = Object.keys(_LAYER_COLORS);

function _ensureHiddenLayers() {
    if (window._traceHiddenLayers) return window._traceHiddenLayers;
    window._traceHiddenLayers = new Set();
    return window._traceHiddenLayers;
}

function _ensureExpandedSeqs() {
    if (window._traceExpandedSeqs) return window._traceExpandedSeqs;
    window._traceExpandedSeqs = new Set();
    return window._traceExpandedSeqs;
}

function _entryMatchesFilter(entry) {
    if (_ensureHiddenLayers().has(entry.layer)) return false;
    if (window._traceFlaggedOnly && !(entry._flag && entry._flag.flagged)) return false;
    const q = (window._traceFilterText || '').trim().toLowerCase();
    if (!q) return true;
    if ((entry.label || '').toLowerCase().indexOf(q) !== -1) return true;
    if ((entry.layer || '').toLowerCase().indexOf(q) !== -1) return true;
    if (entry._flag && entry._flag.note &&
        entry._flag.note.toLowerCase().indexOf(q) !== -1) return true;
    try {
        const d = JSON.stringify(entry.data);
        if (d && d.toLowerCase().indexOf(q) !== -1) return true;
    } catch (e) { /* circular */ }
    return false;
}

function _renderTraceOverlay(force) {
    const btn = document.getElementById('traceToggleBtn');
    const panel = document.getElementById('traceOverlayPanel');
    if (!btn || !panel) return;

    btn.textContent = window._traceEnabled ? '🔍 Trace: On' : '🔍 Trace: Off';
    btn.style.opacity = window._traceEnabled ? '1' : '0.55';
    panel.style.display = window._traceEnabled ? 'block' : 'none';
    if (!window._traceEnabled) return;

    if (window._editingFlagNoteSeq != null && !force) return;

    const prevScrollTop = panel.scrollTop;
    const atBottom = panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 30;
    const countChanged = window._lastRenderedTraceCount !== window._traceLog.length;
    window._lastRenderedTraceCount = window._traceLog.length;

    const active = document.activeElement;
    const filterWasFocused = active && active.id === 'traceFilterInput';
    const filterSelStart = filterWasFocused ? active.selectionStart : null;
    const filterSelEnd = filterWasFocused ? active.selectionEnd : null;

    panel.replaceChildren();

    // ── Header ──
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;border-bottom:1px solid #334155;padding-bottom:8px;gap:6px;';
    const title = document.createElement('strong');
    const flaggedCount = window._traceLog.filter(e => e._flag && e._flag.flagged).length;
    title.textContent = `Trace (${window._traceLog.length} entries${flaggedCount ? `, 🚩 ${flaggedCount} flagged` : ''})`;
    title.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';

    const btnGroup = document.createElement('div');
    btnGroup.style.cssText = 'display:flex;gap:6px;flex-shrink:0;';

    const flaggedOnlyBtn = document.createElement('button');
    flaggedOnlyBtn.textContent = '🚩';
    flaggedOnlyBtn.title = window._traceFlaggedOnly ? 'Show all entries' : 'Show flagged only';
    flaggedOnlyBtn.setAttribute('aria-pressed', String(window._traceFlaggedOnly));
    flaggedOnlyBtn.style.cssText = 'background:' + (window._traceFlaggedOnly ? '#2a2416' : '#334155')
        + ';color:#e2e8f0;border:1px solid ' + (window._traceFlaggedOnly ? '#fbbf24' : '#334155')
        + ';border-radius:4px;padding:4px 8px;font-size:11px;cursor:pointer;';
    flaggedOnlyBtn.onclick = () => {
        window._traceFlaggedOnly = !window._traceFlaggedOnly;
        _renderTraceOverlay(true);
    };

    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Copy JSON';
    exportBtn.title = 'Copy compact, machine-readable JSON to clipboard';
    exportBtn.style.cssText = 'background:#334155;color:#e2e8f0;border:none;border-radius:4px;padding:4px 8px;font-size:11px;cursor:pointer;';
    exportBtn.onclick = () => {
        const json = _traceExport();
        if (navigator.clipboard) navigator.clipboard.writeText(json);
        exportBtn.textContent = 'Copied!';
        setTimeout(() => { exportBtn.textContent = 'Copy JSON'; }, 1200);
    };

    const clearBtn = document.createElement('button');
    clearBtn.textContent = '🗑';
    clearBtn.title = 'Clear trace log';
    clearBtn.setAttribute('aria-label', 'Clear trace log');
    clearBtn.style.cssText = 'background:#334155;color:#e2e8f0;border:none;border-radius:4px;padding:4px 8px;font-size:11px;cursor:pointer;';
    clearBtn.onclick = () => {
        window._traceLog = [];
        window._traceInput = null;
        window._editingFlagNoteSeq = null;
        window._lastRenderedTraceCount = 0;
        _lastInteractionSeq = null;
        _renderTraceOverlay(true);
    };

    btnGroup.append(flaggedOnlyBtn, exportBtn, clearBtn);
    header.append(title, btnGroup);
    panel.appendChild(header);

    // ── Filter + layer toggles ──
    const filterRow = document.createElement('div');
    filterRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;align-items:center;';

    const filterInput = document.createElement('input');
    filterInput.id = 'traceFilterInput';
    filterInput.type = 'text';
    filterInput.placeholder = 'Filter…';
    filterInput.value = window._traceFilterText || '';
    filterInput.style.cssText = 'flex:1;min-width:120px;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:4px;padding:4px 8px;font-family:monospace;font-size:11px;outline:none;';
    filterInput.addEventListener('input', () => {
        window._traceFilterText = filterInput.value;
        _renderTraceOverlay(true);
    });
    filterRow.appendChild(filterInput);

    _ALL_LAYERS.forEach(layer => {
        const hidden = _ensureHiddenLayers().has(layer);
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.textContent = layer.replace('_engine', '').replace('_interaction', '').replace('_return', '↩');
        chip.title = (hidden ? 'Show ' : 'Hide ') + layer + ' entries';
        chip.style.cssText = 'background:' + (hidden ? '#1e293b' : (layer === 'fn_call' ? '#0e7490' : (layer === 'fn_return' ? '#164e63' : '#334155')))
            + ';color:' + (hidden ? '#475569' : '#e2e8f0')
            + ';border:1px solid ' + (hidden ? '#334155' : (_LAYER_COLORS[layer] || '#475569'))
            + ';border-radius:4px;padding:2px 6px;font-size:10px;cursor:pointer;'
            + (hidden ? 'text-decoration:line-through;' : '');
        chip.onclick = () => {
            const h = _ensureHiddenLayers();
            if (h.has(layer)) h.delete(layer);
            else h.add(layer);
            _renderTraceOverlay(true);
        };
        filterRow.appendChild(chip);
    });
    panel.appendChild(filterRow);

    // ── Input block ──
    if (window._traceInput != null) {
        const inputBlock = document.createElement('div');
        inputBlock.style.cssText = 'background:#1e293b;border-radius:4px;padding:6px 8px;margin-bottom:10px;word-break:break-word;';
        const inputLabel = document.createElement('div');
        inputLabel.style.cssText = 'color:#94a3b8;font-size:10px;margin-bottom:2px;';
        inputLabel.textContent = 'INPUT';
        const inputText = document.createElement('div');
        inputText.textContent = typeof window._traceInput === 'string' ? window._traceInput : JSON.stringify(window._traceInput);
        inputBlock.append(inputLabel, inputText);
        panel.appendChild(inputBlock);
    }

    // ── Entry cards ──
    const expanded = _ensureExpandedSeqs();
    let shownCount = 0;
    window._traceLog.forEach(entry => {
        if (!_entryMatchesFilter(entry)) return;
        shownCount++;
        const isFlagged = !!(entry._flag && entry._flag.flagged);
        const isEditingThis = window._editingFlagNoteSeq === entry.seq;
        const isExpanded = expanded.has(entry.seq) || isEditingThis;
        // Flagged entries start expanded; others stay collapsed.
        const actuallyExpanded = isExpanded || isFlagged;

        const card = document.createElement('div');
        card.style.cssText = 'background:' + (isFlagged ? '#2a2416' : '#1e293b')
            + ';border-left:3px solid ' + (_LAYER_COLORS[entry.layer] || '#64748b')
            + ';border-radius:0 4px 4px 0;padding:6px 8px;margin-bottom:6px;word-break:break-word;'
            + (isFlagged ? 'box-shadow:inset 0 0 0 1px #fbbf24;' : '');

        const headerRow = document.createElement('div');
        headerRow.style.cssText = 'display:flex;align-items:center;gap:4px;';

        // Clickable layer line — clicking toggles the collapsed/expanded
        // state for this entry, so a long trace stays scannable.
        const layerLine = document.createElement('div');
        layerLine.style.cssText = 'color:' + (_LAYER_COLORS[entry.layer] || '#64748b')
            + ';font-size:10px;font-weight:bold;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;user-select:none;';
        layerLine.textContent = (actuallyExpanded ? '▾ ' : '▸ ')
            + `#${entry.seq} · ${entry.layer}`
            + (entry.parentSeq != null ? ` · ← #${entry.parentSeq}` : '');
        layerLine.title = actuallyExpanded ? 'Collapse entry' : 'Expand entry';
        layerLine.onclick = (e) => {
            // If the click landed on the ← #N span specifically, scroll
            // to that entry instead of toggling expansion.
            if (e.target && e.target.dataset && e.target.dataset.jumpTo != null) return;
            if (expanded.has(entry.seq)) expanded.delete(entry.seq);
            else expanded.add(entry.seq);
            _renderTraceOverlay(true);
        };
        headerRow.appendChild(layerLine);

        const flagBtn = document.createElement('button');
        flagBtn.type = 'button';
        flagBtn.textContent = '🚩';
        flagBtn.title = isFlagged ? 'Remove flag from this entry' : 'Flag this entry';
        flagBtn.setAttribute('aria-pressed', String(isFlagged));
        flagBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:13px;padding:0 3px;line-height:1;opacity:'
            + (isFlagged ? '1' : '0.35') + ';transition:opacity .15s,transform .15s;';
        flagBtn.onmouseenter = () => { flagBtn.style.transform = 'scale(1.2)'; };
        flagBtn.onmouseleave = () => { flagBtn.style.transform = 'scale(1)'; };
        flagBtn.onclick = () => {
            const nowFlagged = !(entry._flag && entry._flag.flagged);
            if (nowFlagged) {
                entry._flag = {
                    flagged: true,
                    note: (entry._flag && entry._flag.note) || '',
                    flaggedAt: Date.now(),
                };
            } else {
                entry._flag = {
                    flagged: false,
                    note: (entry._flag && entry._flag.note) || '',
                    flaggedAt: (entry._flag && entry._flag.flaggedAt) || null,
                };
                if (window._editingFlagNoteSeq === entry.seq) {
                    window._editingFlagNoteSeq = null;
                }
            }
            _renderTraceOverlay(true);
        };
        headerRow.appendChild(flagBtn);

        if (isFlagged) {
            const noteBtn = document.createElement('button');
            noteBtn.type = 'button';
            noteBtn.textContent = '📝';
            noteBtn.title = (entry._flag && entry._flag.note) ? 'Edit flag note' : 'Add a note to this flag';
            noteBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:13px;padding:0 3px;line-height:1;';
            noteBtn.onclick = () => {
                window._editingFlagNoteSeq = (window._editingFlagNoteSeq === entry.seq) ? null : entry.seq;
                _renderTraceOverlay(true);
            };
            headerRow.appendChild(noteBtn);
        }

        card.appendChild(headerRow);

        const labelLine = document.createElement('div');
        labelLine.style.cssText = 'color:#e2e8f0;margin:2px 0;';
        labelLine.textContent = entry.label;
        card.appendChild(labelLine);

        if (actuallyExpanded) {
            const dataLine = document.createElement('pre');
            dataLine.style.cssText = 'color:#94a3b8;font-size:10px;white-space:pre-wrap;margin:2px 0 0 0;';
            dataLine.textContent = JSON.stringify(entry.data, null, 1);
            card.appendChild(dataLine);
        }

        if (isEditingThis) {
            const editor = document.createElement('div');
            editor.style.cssText = 'margin-top:6px;display:flex;flex-direction:column;gap:4px;';
            const ta = document.createElement('textarea');
            ta.value = (entry._flag && entry._flag.note) || '';
            ta.placeholder = 'Why is this entry flagged? (saved live; exported as annotations[].note)';
            ta.style.cssText = 'background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:4px;padding:5px 7px;font-family:monospace;font-size:11px;min-height:52px;resize:vertical;outline:none;';
            ta.addEventListener('input', () => {
                if (!entry._flag) entry._flag = { flagged: true, note: '', flaggedAt: Date.now() };
                entry._flag.note = ta.value;
            });
            const doneRow = document.createElement('div');
            doneRow.style.cssText = 'display:flex;gap:6px;justify-content:flex-end;';
            const doneBtn = document.createElement('button');
            doneBtn.type = 'button';
            doneBtn.textContent = 'Done';
            doneBtn.style.cssText = 'background:#334155;color:#e2e8f0;border:none;border-radius:4px;padding:3px 10px;font-size:11px;cursor:pointer;';
            doneBtn.onclick = () => {
                window._editingFlagNoteSeq = null;
                _renderTraceOverlay(true);
            };
            doneRow.appendChild(doneBtn);
            editor.append(ta, doneRow);
            card.appendChild(editor);
            setTimeout(() => {
                try { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) { /* best-effort */ }
            }, 0);
        } else if (isFlagged && entry._flag && entry._flag.note) {
            const noteDisplay = document.createElement('div');
            noteDisplay.style.cssText = 'margin-top:6px;padding:4px 8px;background:#1c1917;border-left:2px solid #fbbf24;color:#fcd34d;font-size:11px;white-space:pre-wrap;border-radius:0 4px 4px 0;';
            noteDisplay.textContent = '📝 ' + entry._flag.note;
            card.appendChild(noteDisplay);
        }

        panel.appendChild(card);
    });

    if (shownCount === 0 && window._traceLog.length > 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'color:#64748b;font-size:11px;text-align:center;padding:16px 8px;font-style:italic;';
        empty.textContent = 'No entries match the current filter.';
        panel.appendChild(empty);
    }

    if (!countChanged || !atBottom) {
        panel.scrollTop = prevScrollTop;
    } else {
        panel.scrollTop = panel.scrollHeight;
    }

    if (filterWasFocused) {
        const newInput = document.getElementById('traceFilterInput');
        if (newInput) {
            try {
                newInput.focus();
                if (filterSelStart != null) newInput.setSelectionRange(filterSelStart, filterSelEnd);
            } catch (e) { /* best-effort */ }
        }
    }
}

// ─── Global interaction capture ─────────────────────────────────────

function _describeInteractionTarget(el) {
    if (!el || el === document) return null;
    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    if (['html', 'body'].includes(tag)) return null;

    const desc = {
        tag,
        id: el.id || null,
        class: (el.className && typeof el.className === 'string') ? el.className.slice(0, 120) : null,
        text: (el.textContent || '').trim().slice(0, 100) || null,
    };

    if (el.dataset && Object.keys(el.dataset).length) {
        desc.data = { ...el.dataset };
    }
    if ('value' in el && typeof el.value === 'string') desc.value = el.value.slice(0, 100);
    if ('disabled' in el) desc.disabled = !!el.disabled;
    if ('checked' in el) desc.checked = !!el.checked;
    const ap = el.getAttribute('aria-pressed'); if (ap != null) desc.ariaPressed = ap;
    const as = el.getAttribute('aria-selected'); if (as != null) desc.ariaSelected = as;

    if (typeof el.className === 'string') {
        if (el.classList.contains('sel')) desc.uiSelected = true;
        if (el.classList.contains('active')) desc.uiActive = true;
        if (el.classList.contains('locked')) desc.uiLocked = true;
        if (el.classList.contains('done')) desc.uiDone = true;
    }

    if (el.style && el.style.cssText) {
        desc.inlineStyle = el.style.cssText.slice(0, 200);
    }

    return desc;
}

// Records the pre-click observable state, emits the click, and schedules
// a microtask that captures the post-click state and emits a
// session/state_change entry when anything moved. Runs for every click
// when tracing is enabled, independent of any inline instrumentation.
function _recordClickAndScheduleDiff(desc) {
    const preState = _readObservableState(true);
    _trace('user_interaction', 'click', desc);
    _lastInteractionSeq = window._traceLog.length - 1;
    const clickSeq = _lastInteractionSeq;
    const schedule = (typeof queueMicrotask === 'function')
        ? queueMicrotask
        : (fn) => Promise.resolve().then(fn);
    schedule(() => {
        if (!window._traceEnabled) return;
        // Force a fresh read — bypass the 8ms cache so the diff sees the
        // true post-handler state even if the burst is fast.
        const postState = _readObservableState(true);
        const diff = _diffObservableState(preState, postState);
        if (diff) {
            _trace('session', 'state_change', {
                afterClickSeq: clickSeq,
                changes: diff,
            });
            // The state_change entry's parentSeq is set automatically by
            // _trace via _lastInteractionSeq, which is still clickSeq at
            // this point — so the causality link survives.
        }
    });
}

function _initGlobalInteractionTracing() {
    if (typeof document === 'undefined') return;
    if (window._interactionTracingInit) return;
    window._interactionTracingInit = true;

    document.addEventListener('click', (e) => {
        if (typeof _trace !== 'function' || !window._traceEnabled) return;
        if (e.target && e.target.closest &&
            e.target.closest('#traceOverlayPanel, #traceToggleBtn, #toast-container')) return;

        let el = e.target;
        for (let i = 0; i < 4 && el && el !== document.body; i++) {
            if (el.tagName === 'BUTTON' || (el.dataset && el.dataset.mod) ||
                (el.className && typeof el.className === 'string' && el.className.trim())) break;
            el = el.parentElement;
        }
        const desc = _describeInteractionTarget(el);
        if (!desc) return;

        if (el && el.dataset && el.dataset.mod) {
            const prior = _readPriorSelection(el);
            if (prior) desc.priorSelection = prior;
            desc.module = el.dataset.mod;
            desc.newSelection = el.dataset.label || (el.textContent || '').trim().slice(0, 80);
        }

        const estimate = _readCurrentEstimate();
        if (estimate) desc.estimateAtClick = estimate;

        const screenCtx = _readScreenContext();
        if (screenCtx.selectedAnswers && screenCtx.selectedAnswers.length) {
            desc.selectedAnswers = screenCtx.selectedAnswers;
        }

        _recordClickAndScheduleDiff(desc);
    }, true);

    document.addEventListener('change', (e) => {
        if (typeof _trace !== 'function' || !window._traceEnabled) return;
        if (e.target && e.target.closest &&
            e.target.closest('#traceOverlayPanel, #traceToggleBtn, #toast-container')) return;
        const el = e.target;
        if (!el || !('value' in el)) return;
        const desc = _describeInteractionTarget(el) || {};
        desc.value = typeof el.value === 'string' ? el.value.slice(0, 200) : el.value;
        const estimate = _readCurrentEstimate();
        if (estimate) desc.estimateAtChange = estimate;
        _recordClickAndScheduleDiff(desc);
    }, true);
}

// ─── Error capture ─────────────────────────────────────────────────
function _installErrorCapture() {
    if (_errorCaptureInstalled) return;
    _errorCaptureInstalled = true;
    window.addEventListener('error', (e) => {
        if (!window._traceEnabled) return;
        _trace('session', 'window_error', {
            message: e.message,
            file: (e.filename || '').slice(-80),
            line: e.lineno,
            col: e.colno,
        });
    });
    window.addEventListener('unhandledrejection', (e) => {
        if (!window._traceEnabled) return;
        _trace('session', 'unhandled_rejection', {
            reason: String(e.reason).slice(0, 300),
        });
    });
}

// ─── DOM snapshot ──────────────────────────────────────────────────

function _traceDomSnapshot(label) {
    if (typeof _trace !== 'function' || !window._traceEnabled) return;
    try {
        const weUnderstoodChips = [...document.querySelectorAll('.sq-ic-nlp-chip, .sq-ic-chip, .ims-chip.sel')]
            .map(c => c.textContent.trim()).filter(Boolean);
        const questionsA = [...document.querySelectorAll('.sq-ic-q')].map(q => ({
            label: (q.querySelector('.sq-ic-q-lbl')?.textContent || '').trim(),
            selectedOption: (q.querySelector('.sq-ic-btn.sel span')?.textContent || q.querySelector('.sq-ic-btn.sel')?.textContent || '').trim() || null,
            optionCount: q.querySelectorAll('.sq-ic-btn').length,
        }));
        const questionsB = [...document.querySelectorAll('.intake-module-step')].map(q => ({
            label: (q.querySelector('.ims-label')?.textContent || '').trim(),
            selectedOption: (q.querySelector('.ims-chip.sel')?.textContent || '').trim() || null,
            optionCount: q.querySelectorAll('.ims-chip').length,
        }));
        const questions = [...questionsA, ...questionsB];
        const priceLines = [...document.querySelectorAll('.ql')].map(l => ({
            label: (l.querySelector('.qll')?.textContent || '').trim(),
            value: (l.querySelector('.qlv')?.textContent || '').trim(),
        })).filter(l => l.label || l.value);
        const livePriceText = document.getElementById('sqLivePrice')?.textContent?.trim()
            || document.querySelector('[class*="live-price"], [class*="livePrice"]')?.textContent?.trim() || null;
        const adlibText = (document.getElementById('sqAdlibSentence')?.textContent || '').trim() || null;
        const addToCartBtn = document.querySelector('.ctap') || document.getElementById('btn-curated-add');
        const addToCartLabel = addToCartBtn ? addToCartBtn.textContent.trim() : null;
        const addToCartLooksDisabled = addToCartBtn ? !!addToCartBtn.disabled : null;
        _trace('dom_snapshot', label || 'render: visible DOM state', {
            weUnderstoodChips, questions, priceLines, livePriceText, adlibText, addToCartLabel, addToCartLooksDisabled,
        });
    } catch (e) {
        console.warn('[trace] dom snapshot failed, ignored:', e);
    }
}

// ─── Narrative ─────────────────────────────────────────────────────

function _traceNarrative(log) {
    const lines = [];
    for (const e of log) {
        const flagTag = (e._flag && e._flag.flagged)
            ? ` 🚩 FLAGGED${e._flag.note ? ' — ' + e._flag.note : ''}`
            : '';
        if (e.layer === 'session' && e.label === 'context_transition') {
            const inp = typeof e.data.input === 'string' ? e.data.input.slice(0, 60) : JSON.stringify(e.data.input).slice(0, 60);
            lines.push(`── new ${e.data.entryPath} entry: ${inp} ──${flagTag}`);
            if (e.data.entryPathMismatch) {
                lines.push(`   ⚠ entryPath mismatch: caller claimed "${e.data.entryPathMismatch.claimed}", ` +
                    `breadcrumbs=[${(e.data.entryPathMismatch.breadcrumbs || []).join(' > ')}], ` +
                    `step=${e.data.entryPathMismatch.step}`);
            }
        } else if (e.layer === 'session' && e.label === 'state_change') {
            const d = e.data.changes || {};
            const changed = Object.keys(d).filter(k => k !== 'visibility');
            const visChanged = d.visibility ? Object.keys(d.visibility) : [];
            const parts = [];
            if (changed.length) parts.push(changed.map(k => k + ': ' + JSON.stringify(d[k].before) + ' → ' + JSON.stringify(d[k].after)).join(', '));
            if (visChanged.length) parts.push('visibility: ' + visChanged.map(k => k + '=' + d.visibility[k].after).join(', '));
            lines.push(`↻ state changed after click #${e.parentSeq}: ${parts.join(' | ')}${flagTag}`);
        } else if (e.layer === 'fn_call') {
            if (e.label.indexOf(':branch') !== -1) {
                const br = e.data.branch || '(unnamed)';
                const rest = Object.keys(e.data).filter(k => !['_observable', 'branch', '_entrySeq'].includes(k));
                const restStr = rest.length ? ' ' + rest.map(k => k + '=' + JSON.stringify(e.data[k])).join(' ') : '';
                lines.push(`  branch → ${br}${restStr}${flagTag}`);
                continue;
            }
            const obs = e.data._observable || {};
            const vis = obs.visibility || {};
            const visPairs = Object.keys(vis).filter(k => /\/vis\//.test(vis[k])).map(k => k);
            const args = Object.keys(e.data).filter(k => k !== '_observable');
            const argStr = args.length
                ? args.map(k => k + '=' + JSON.stringify(e.data[k])).join(' ')
                : '';
            const bcStr = (obs.breadcrumbs && obs.breadcrumbs.length)
                ? ' bc=[' + obs.breadcrumbs.join(' > ') + ']' : '';
            const stepStr = (obs.step != null) ? ' step=' + obs.step : '';
            const visStr = visPairs.length ? ' visible={' + visPairs.join(',') + '}' : '';
            lines.push(`fn ${e.label}(${argStr})${bcStr}${stepStr}${visStr}${flagTag}`);
        } else if (e.layer === 'fn_return') {
            const dur = e.data.durationMs != null ? ` (${e.data.durationMs}ms)` : '';
            const rest = Object.keys(e.data).filter(k => !['_observable', 'durationMs', '_entrySeq'].includes(k));
            const restStr = rest.length ? ' ' + rest.map(k => k + '=' + JSON.stringify(e.data[k])).join(' ') : '';
            lines.push(`  ↩ ${e.label}${dur}${restStr}${flagTag}`);
        } else if (e.layer === 'user_interaction' && e.label === 'click') {
            const d = e.data;
            const what = (d.data && d.data.mod)
                ? `question option "${d.data.label || d.newSelection || d.text || ''}" (${d.data.mod})`
                : (d.text || d.tag || 'an element');
            const priorNote = d.priorSelection ? ` [changed from "${d.priorSelection.label}"]` : '';
            const estNote = d.estimateAtClick ? ` — estimate: ${d.estimateAtClick.text} (${d.estimateAtClick.selector})` : '';
            lines.push(`User tapped: ${what}${priorNote}${estNote}${flagTag}`);
        } else if (e.layer === 'user_interaction' && e.label === 'input_settled') {
            const val = (e.data.value || '').length > 40 ? e.data.value.slice(0, 40) + '…' : e.data.value;
            lines.push(`User typed (settled): "${val}" into ${e.data.class || e.data.tag}${flagTag}`);
        } else if (e.layer === 'nlp_engine') {
            lines.push(`NLP matched: "${e.data.winningKeyword}" (confidence ${e.data.matchConfidence}) -> category ${e.data.category}${flagTag}`);
        } else if (e.layer === 'orchestrator_engine' && e.data.resolvedGroupId) {
            lines.push(`Routed to group: ${e.data.resolvedGroupId}${flagTag}`);
        } else if (e.layer === 'pricing_engine') {
            const d = e.data;
            const frictionNote = (d.frictionThreshold != null) ? `, friction ${d.friction} (need ${d.frictionThreshold}, have ${d.totalConfidence})` : '';
            lines.push(`Price computed: $${d.laborEstimate} (qty ${d.qty}, tier ${d.complexityTier}${frictionNote})${flagTag}`);
        } else if (e.layer === 'dom_snapshot') {
            const d = e.data;
            if (d.tiles) {
                lines.push(`Tiles rendered in ${d.container}: [${d.tiles.join(' | ')}]${flagTag}`);
            } else {
                lines.push(`Screen showed: ${d.questions?.length || 0} question(s), price lines [${(d.priceLines || []).map(l => l.label + '=' + l.value).join(', ')}], add-to-cart button: "${d.addToCartLabel || '(none)'}"${d.addToCartLooksDisabled ? ' [DISABLED-LOOKING]' : ''}${flagTag}`);
            }
        } else if (e.layer === 'ui_renderer' && e.label === 'sqAddToCart: invoked') {
            lines.push(`User clicked Add to Cart (qty ${e.data.qty}, ${e.data.answersCount} answers on file)${flagTag}`);
        } else if (e.layer === 'session' && e.label === 'window_error') {
            lines.push(`⚠️ window.onerror: ${e.data.message} (${e.data.file}:${e.data.line}:${e.data.col})${flagTag}`);
        } else if (e.layer === 'session' && e.label === 'unhandled_rejection') {
            lines.push(`⚠️ unhandled rejection: ${e.data.reason}${flagTag}`);
        }
    }
    const flagged = log.filter(e => e._flag && e._flag.flagged);
    if (flagged.length > 0) {
        lines.push('');
        lines.push(`🚩 ${flagged.length} flagged entr${flagged.length === 1 ? 'y' : 'ies'}:`);
        flagged.forEach(e => {
            const note = (e._flag && e._flag.note) ? ' — ' + e._flag.note : '';
            lines.push(`  - #${e.seq} [${e.layer}] ${e.label}${note}`);
        });
    }
    return lines;
}

// ─── Auto-wire ─────────────────────────────────────────────────────
if (typeof document !== 'undefined') _initGlobalInteractionTracing();