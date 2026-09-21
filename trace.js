/**
 * trace.js (T142)
 *
 * Component-level tracing overlay. Captures user interactions, DOM states,
 * internal function executions, and pricing engine logic.
 *
 * ─────────────────────────────────────────────────────────────────────
 * T142 CHANGES OVER T141
 * ─────────────────────────────────────────────────────────────────────
 * 1. Panel layout is now internally consistent. T141 set the panel to
 *    `display:block` while the list container inside it declared
 *    `flex:1; overflow-y:auto;` — those two cannot coexist. T140 had the
 *    inverse problem: `display:flex` with the default `flex-direction:row`,
 *    so `flex:1` grew the list horizontally, not vertically. T142 sets
 *    `display:flex; flex-direction:column` on the panel and leaves
 *    `flex:1; overflow-y:auto` on the list, which is the only combination
 *    that actually produces a scrollable list under a fixed toolbar.
 *
 * 2. `_traceNarrative` is now genuinely domain-aware. T141 decoded:
 *      - pricing fields that the pricing engine never emits
 *        (`$laborEstimate`, `tier`, `frictionX`, `frictionY`),
 *      - branch data under `d.args` / `d.visibleElements`, which are
 *        never set (branch fields are spread flat into entry.data),
 *      - no `fn_call`/`fn_return` bodies at all (they degraded to
 *        `[fn_call] name`),
 *      - no `window_error`, `unhandled_rejection`, `ui_renderer:…:invoked`,
 *        or tile-snapshot bodies,
 *      - no click `priorSelection` / `estimateAtClick`,
 *      - no `dom_snapshot` priceLine values or add-to-cart state.
 *    T142 decodes every layer that the rest of this file actually emits,
 *    using the field names the rest of this file actually uses.
 *
 * 3. `_traceStart`'s smart_quote mismatch branch now includes `step`,
 *    matching T137 (`{claimed, breadcrumbs, step}`), not just breadcrumbs.
 *
 * 4. `_traceExport` accepts a `compact` flag, defaulting to `true`. The
 *    Copy JSON button therefore writes a single-line, non-truncated
 *    payload to the clipboard. Call `_traceExport(false)` explicitly for
 *    the old 2-space pretty form. Nothing is ever truncated by the
 *    serializer; the only log-size limit is the tracer's own
 *    MAX_ENTRIES = 2000 cap (see `_trace`).
 *
 * 5. `_traceNarrative` degrades safely if `window._traceLog` is empty
 *    and if any decoded field is missing — every accessor has a `'?'`
 *    fallback so a truncated or partially-populated entry never throws
 *    mid-narrative.
 *
 * ─────────────────────────────────────────────────────────────────────
 * ARCHITECTURAL WINS CARRIED FORWARD (T138)
 * ─────────────────────────────────────────────────────────────────────
 * - Monotonic `_traceNextId` — stable entry references across truncation.
 * - Macrotask (`setTimeout 50ms`) diff — allows React/Vue/Svelte repaint.
 * - `DocumentFragment` batched rendering — avoids layout thrashing.
 * - `WeakSet` clone fallback — handles circular references.
 *
 * ─────────────────────────────────────────────────────────────────────
 * FEATURE SURFACE CARRIED FORWARD (T137, T140, T141)
 * ─────────────────────────────────────────────────────────────────────
 * - `visibility` map in observable state and diffs.
 * - Auto-`entryPath` from breadcrumb signature changes.
 * - Rich export: summary, lastVisibleScreen, narrative, counts, hashes.
 * - Rich interaction descriptor (SVG-safe, aria-aware).
 * - Multi-selector estimate read; clicked-element-excluded prior selection.
 * - Filter / layer toggle / flag-only / copy / clear toolbar.
 * - Focus and selection-range preservation across re-renders.
 * - Auto-scroll guard; dangling-parentId cleanup on truncation.
 * - `_installStateDiff` and `_installErrorCapture` are idempotent markers.
 * - `btnycJsonHash` fingerprints `window.DB`, guarded for absence.
 */

const TRACE_BUILD_VERSION = 'T142';

// ─── Persistent State ───────────────────────────────────────────────
window._traceEnabled         = false;
window._traceLog             = [];
window._traceInput           = null;
window._traceEntryPath       = null;
window._editingFlagNoteId    = null;
window._traceFilterText      = '';
window._traceHiddenLayers    = new Set();
window._traceFlaggedOnly     = false;
window._traceExpandedIds     = new Set();
window._lastRenderedTraceCount = 0;

// ─── Private Module State ───────────────────────────────────────────
let _traceNextId          = 1;
let _lastInteractionId    = null;
let _renderScheduled      = false;
let _pendingForceInit     = false;
let _estimateCache        = null;
let _estimateCacheAt      = 0;
let _observableCache      = null;
let _observableCacheAt    = 0;
let _errorCaptureInstalled = false;
let _stateDiffInstalled   = false;
let _lastBreadcrumbSig    = null;

const _LAYER_COLORS = {
    nlp_engine:          '#38bdf8',
    orchestrator_engine: '#fbbf24',
    pricing_engine:      '#4ade80',
    ui_renderer:         '#f472b6',
    dom_snapshot:        '#a78bfa',
    user_interaction:    '#fb923c',
    session:             '#94a3b8',
    fn_call:             '#22d3ee',
    fn_return:           '#0e7490',
};
const _ALL_LAYERS = Object.keys(_LAYER_COLORS);

const _KEY_ELEMENTS = [
    'sqTextBar', 'category-card', 'serviceContainer', 'serviceRequestSummary',
    'intakeQuestionsContainer', 'sqQuoteOut', 'sqStepFlow', 'sqBuilder',
    'cartOverlay', 'bookingStepBar', 'toast-container',
];

// Matches T137's original selector list — the one the tracer was tuned on.
const _ESTIMATE_SELECTORS = [
    '#sqLivePrice', '.sq-ic-price', '.iph-price', '.qprice',
    '.qpranger', '#current-estimate', '.price-value', '#sqCurEstBtn',
];

// ─── Core Utilities ─────────────────────────────────────────────────

function _simpleHash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16).padStart(8, '0');
}

function _safeClone(data) {
    if (data == null) return {};
    try {
        return (typeof structuredClone === 'function')
            ? structuredClone(data)
            : JSON.parse(JSON.stringify(data));
    } catch (e) {
        const seen = new WeakSet();
        try {
            const cloneStr = JSON.stringify(data, (key, value) => {
                if (typeof value === 'object' && value !== null) {
                    if (seen.has(value)) return '[Circular]';
                    seen.add(value);
                }
                if (typeof value === 'function') return '[Function ' + (value.name || 'anonymous') + ']';
                if (typeof value === 'symbol') return String(value);
                return value;
            });
            return JSON.parse(cloneStr);
        } catch (e2) {
            return { _cloneFailed: String(e2), _dataType: typeof data };
        }
    }
}

function _isVisible(el) {
    if (!el) return false;
    let r;
    try { r = el.getBoundingClientRect(); } catch (e) { return false; }
    if (r.width === 0 || r.height === 0) return false;
    if (el.offsetParent === null) {
        try {
            if (window.getComputedStyle(el).position === 'fixed') return true;
        } catch (e) { /* fall through */ }
        return false;
    }
    try {
        const cs = window.getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
    } catch (e) { return false; }
    return true;
}

function _readElementVisibility(id) {
    const el = document.getElementById(id);
    if (!el) return 'absent';
    let cs;
    try { cs = window.getComputedStyle(el); } catch (e) { return 'error'; }
    const disp = cs.display;
    if (disp === 'none') return 'none';
    let r;
    try { r = el.getBoundingClientRect(); } catch (e) { r = { width: 0, height: 0 }; }
    const v = _isVisible(el) ? 'vis' : 'hid';
    return `${disp}/${v}/${Math.round(r.width)}x${Math.round(r.height)}`;
}

// ─── Domain & Context Readers ───────────────────────────────────────

function _readCurrentEstimate() {
    const now = Date.now();
    if (_estimateCache && now - _estimateCacheAt < 100) return _estimateCache;

    for (const sel of _ESTIMATE_SELECTORS) {
        let el;
        try { el = document.querySelector(sel); } catch (e) { continue; }
        if (el && _isVisible(el)) {
            const txt = (el.textContent || '').trim();
            if (txt) {
                _estimateCache = { selector: sel, text: txt };
                _estimateCacheAt = now;
                return _estimateCache;
            }
        }
    }
    _estimateCache = null;
    _estimateCacheAt = now;
    return null;
}

function _readPriorSelection(el) {
    if (!el) return null;
    const container = el.closest('.sq-ic-q, .intake-module-step, .step-question');
    if (!container) return null;
    const prior = container.querySelector('.sel, .selected, [aria-selected="true"]');
    if (!prior || prior === el) return null;
    const label = (prior.textContent || '').trim();
    return label ? { label } : null;
}

function _readScreenContext() {
    return [...document.querySelectorAll('.sq-ic-nlp-chip.sel, .sq-ic-chip.sel, .ims-chip.sel, .chip.sel')]
        .filter(_isVisible)
        .map(c => (c.textContent || '').trim())
        .filter(Boolean);
}

function _breadcrumbSignature() {
    try {
        if (typeof Breadcrumbs !== 'undefined' && Breadcrumbs && Array.isArray(Breadcrumbs.stack)) {
            return Breadcrumbs.stack.map(f =>
                f.type + (f.group ? ':' + f.group : (f.category_id ? ':' + f.category_id : ''))
            ).join('|');
        }
    } catch (e) { /* best-effort */ }
    return '';
}

function _describeInteractionTarget(el) {
    if (!el || el === document || el === document.body) return null;
    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    if (['html', 'body'].includes(tag)) return null;

    const rawClass = (typeof el.className === 'string')
        ? el.className
        : (el.getAttribute ? el.getAttribute('class') || '' : '');

    const desc = {
        tag,
        id:    el.id || null,
        class: rawClass.slice(0, 120) || null,
        text:  (el.textContent || '').trim().slice(0, 100) || null,
        disabled: !!el.disabled || el.getAttribute('aria-disabled') === 'true',
        checked:  !!el.checked,
        ariaPressed:  el.getAttribute('aria-pressed'),
        ariaSelected: el.getAttribute('aria-selected'),
    };

    if (el.dataset && Object.keys(el.dataset).length) desc.data = { ...el.dataset };

    const cl = el.classList;
    if (cl) {
        if (cl.contains('sel') || cl.contains('selected')) desc.uiSelected = true;
        if (cl.contains('active'))  desc.uiActive  = true;
        if (cl.contains('locked'))  desc.uiLocked  = true;
        if (cl.contains('done'))    desc.uiDone    = true;
    }
    return desc;
}

function _readObservableState(force) {
    const now = Date.now();
    if (!force && _observableCache && now - _observableCacheAt < 8) return _observableCache;

    const out = {};
    try {
        out.breadcrumbs = typeof Breadcrumbs !== 'undefined' ? Breadcrumbs?.stack : null;
        out.step        = typeof State       !== 'undefined' ? State?.currentStep   : null;
        out.focusedMode = document.querySelector('.main-card-schedule-service')?.classList.contains('focused-mode') || null;
        out.uiTemplate  = window._currentRoute?.uiTemplate || null;

        if (window._currentRoute) {
            out.route = {
                entityType: window._currentRoute.entityType || null,
                entityId:   window._currentRoute.entity?.id
                            || window._currentRoute.entityId
                            || null,
            };
        }

        if (typeof State !== 'undefined' && State?.entryFlags) {
            out.entryFlags = State.entryFlags;
        } else if (typeof S !== 'undefined' && S) {
            out.entryFlags = {
                otherTile:     !!S._isOtherTileEntry,
                fromBuilder:   !!S._fromBuilder,
                curated:       !!S._curatedMode,
                adlibConfirmed: !!S.adlibConfirmed,
            };
        }

        out.visibility = {};
        for (const id of _KEY_ELEMENTS) out.visibility[id] = _readElementVisibility(id);

        if (typeof S !== 'undefined' && S) {
            out.intent = S.intent || null;
            out.svcId  = S._svc?.id || null;
            out.qty    = S.qty;
        }
    } catch (e) { out._error = String(e); }

    _observableCache = out;
    _observableCacheAt = now;
    return out;
}

function _diffObservableState(pre, post) {
    if (!pre || !post) return null;
    const changes = {};
    const topKeys = ['breadcrumbs', 'step', 'focusedMode', 'uiTemplate',
                     'intent', 'svcId', 'qty', 'entryFlags', 'route'];
    for (const k of topKeys) {
        const a = JSON.stringify(pre[k]);
        const b = JSON.stringify(post[k]);
        if (a !== b) changes[k] = { before: pre[k], after: post[k] };
    }

    if (pre.visibility && post.visibility) {
        const visDiff = {};
        for (const id of _KEY_ELEMENTS) {
            if (pre.visibility[id] !== post.visibility[id]) {
                visDiff[id] = { before: pre[id], after: post[id] };
            }
        }
        if (Object.keys(visDiff).length) changes.visibility = visDiff;
    }

    return Object.keys(changes).length ? changes : null;
}

// ─── Trace Core Write & Control ─────────────────────────────────────

function _traceStart(input, entryPath, options = {}) {
    if (options.clear) {
        window._traceLog = [];
        _lastInteractionId = null;
        window._traceExpandedIds = new Set();
    }
    window._traceInput        = _safeClone(input);
    window._traceEntryPath    = entryPath;
    window._editingFlagNoteId = null;

    // Narrow T137 mismatch heuristic: only fire on the two cases that
    // actually indicated a real navigation divergence. Broad substring
    // heuristics produce false positives on legitimate labels.
    const state = _readObservableState();
    const bc    = state.breadcrumbs;
    const ui    = state.uiTemplate;

    if (entryPath === 'smart_quote' && bc && bc.length > 0) {
        _trace('session', 'entry_path_mismatch', {
            expected: 'smart_quote', foundBreadcrumbs: bc, step: state.step,
        });
    } else if (entryPath === 'catalog' && ui === 'self_quote') {
        _trace('session', 'entry_path_mismatch', {
            expected: 'catalog', uiTemplate: ui,
        });
    }

    return _trace('session', 'trace_started', { input, entryPath });
}

function _trace(layer, label, data, explicitParentId) {
    if (!window._traceEnabled) return null;
    try {
        // Auto-update entryPath whenever the breadcrumb signature moves.
        const bcSig = _breadcrumbSignature();
        if (bcSig && bcSig !== _lastBreadcrumbSig) {
            _lastBreadcrumbSig = bcSig;
            try {
                if (typeof Breadcrumbs !== 'undefined' && Array.isArray(Breadcrumbs.stack)) {
                    window._traceEntryPath = 'catalog:' + Breadcrumbs.stack
                        .map(f => f.type + (f.group ? ':' + f.group : ''))
                        .join(' > ');
                }
            } catch (e) { /* best-effort */ }
        }

        const enriched = (['session', 'fn_call', 'fn_return'].includes(layer))
            ? Object.assign({}, data || {}, { _observable: _readObservableState() })
            : data;

        const entryId = _traceNextId++;
        const entry = {
            id: entryId,
            t:  Date.now(),
            layer,
            label,
            data: _safeClone(enriched == null ? {} : enriched),
        };

        if (explicitParentId != null) {
            entry.parentId = explicitParentId;
        } else if (layer !== 'user_interaction' && _lastInteractionId != null) {
            entry.parentId = _lastInteractionId;
        }

        window._traceLog.push(entry);

        const MAX_ENTRIES = 2000;
        if (window._traceLog.length > MAX_ENTRIES) {
            window._traceLog = window._traceLog.slice(-Math.floor(MAX_ENTRIES / 2));
            if (_lastInteractionId != null
                && !window._traceLog.some(e => e.id === _lastInteractionId)) {
                _lastInteractionId = null;
            }
        }

        _scheduleRender();
        return entryId;
    } catch (e) {
        console.warn('[trace] entry failed:', e);
        return null;
    }
}

function _traceFn(name, args) {
    const startId = _trace('fn_call', name, args || {});
    const enabled = window._traceEnabled;
    let closed = false;
    const _nowAtEntry = Date.now();

    return {
        branch: (branchName, branchData) => {
            if (!enabled || closed) return;
            _trace('fn_call', name + ':branch', Object.assign(
                { branch: branchName, _entryId: startId },
                branchData || {}
            ));
        },
        return: (returnData) => {
            if (!enabled || closed) return;
            closed = true;
            _trace('fn_return', name, Object.assign(
                { _entryId: startId, durationMs: Date.now() - _nowAtEntry },
                returnData || {}
            ));
        },
        error: (err) => {
            if (!enabled || closed) return;
            closed = true;
            _trace('fn_return', name + ':error', {
                _entryId: startId,
                durationMs: Date.now() - _nowAtEntry,
                error: String(err && err.message || err).slice(0, 300),
            });
        },
    };
}

function _traceTiles(target, label) {
    if (!window._traceEnabled) return;
    let rawElements = [];
    if (typeof target === 'string') rawElements = [...document.querySelectorAll(target)];
    else if (target instanceof Element) rawElements = [target];
    else if (Array.isArray(target) || target instanceof NodeList) rawElements = [...target];

    const tiles = rawElements.map(t => ({
        id:    t.id || null,
        text:  (t.textContent || '').trim().slice(0, 50),
        classes: typeof t.className === 'string'
            ? t.className
            : (t.getAttribute?.('class') || ''),
    }));
    _trace('dom_snapshot', label || 'tiles_read', { count: tiles.length, tiles });
}

// ─── Export & Narrative Engine ──────────────────────────────────────

/**
 * Produce a human-readable, layer-aware narrative of the trace log.
 *
 * Returns a single newline-joined string. Every decoded field has a `'?'`
 * fallback so a partially-populated entry never throws.
 */
function _traceNarrative(log) {
    const traceArray = Array.isArray(log) ? log : window._traceLog;
    if (!traceArray.length) return 'No trace log entries recorded.';

    const lines = [];
    lines.push(`=== TRACE NARRATIVE (Entries: ${traceArray.length}) ===`);
    lines.push(`Entry Path: ${window._traceEntryPath || 'N/A'}`);
    lines.push('--------------------------------------------------');

    const flaggedEntries = [];

    for (const e of traceArray) {
        const d = e.data || {};
        const timeStr = new Date(e.t).toISOString().substring(11, 23);
        const parentStr = e.parentId != null ? ` (after #${e.parentId})` : '';
        const flagStr   = e._flag?.flagged ? ' 🚩' : '';

        if (e._flag?.flagged) flaggedEntries.push(e);

        // ─── Session: lifecycle, state change, errors ────────────────
        if (e.layer === 'session' && (e.label === 'context_transition' || e.label === 'trace_started')) {
            const inp = typeof d.input === 'string'
                ? d.input.slice(0, 60)
                : JSON.stringify(d.input || '').slice(0, 60);
            lines.push(`── new ${d.entryPath || '?'} entry: ${inp}${flagStr}`);
            // T137 stored mismatch inline on context_transition; T141 splits
            // it into a sibling entry_path_mismatch. Handle both.
            if (d.entryPathMismatch) _renderMismatch(lines, d.entryPathMismatch);

        } else if (e.layer === 'session' && e.label === 'entry_path_mismatch') {
            _renderMismatch(lines, d);

        } else if (e.layer === 'session' && e.label === 'state_change') {
            const ch = d.changes || {};
            const parts = [];
            const changedKeys = Object.keys(ch).filter(k => k !== 'visibility');
            for (const k of changedKeys) {
                parts.push(`${k}: ${JSON.stringify(ch[k].before)} → ${JSON.stringify(ch[k].after)}`);
            }
            if (ch.visibility) {
                const visParts = Object.keys(ch.visibility).map(k =>
                    `${k}=${ch.visibility[k].after}`
                );
                parts.push('visibility: ' + visParts.join(', '));
            }
            lines.push(`↻ state changed${parentStr}: ${parts.join(' | ')}${flagStr}`);

        } else if (e.layer === 'session' && e.label === 'window_error') {
            lines.push(`⚠️ window.onerror: ${d.message || '?'} (${d.file || '?'}:${d.line || '?'})${flagStr}`);

        } else if (e.layer === 'session' && e.label === 'unhandled_rejection') {
            lines.push(`⚠️ unhandled rejection: ${d.reason || '?'}${flagStr}`);

        // ─── User interaction ────────────────────────────────────────
        } else if (e.layer === 'user_interaction' && e.label === 'click') {
            const what = (d.data && d.data.mod)
                ? `question option "${d.data.label || d.newSelection || d.text || ''}" (${d.data.mod})`
                : (d.text || d.tag || 'an element');
            const prior  = d.priorSelection
                ? ` [changed from "${d.priorSelection.label || d.priorSelection}"]` : '';
            const est    = d.estimateAtClick
                ? ` — estimate: ${d.estimateAtClick.text} (${d.estimateAtClick.selector})` : '';
            lines.push(`User tapped: ${what}${prior}${est}${flagStr}`);

        } else if (e.layer === 'user_interaction' && e.label === 'change') {
            const val = typeof d.value === 'string'
                ? (d.value.length > 60 ? d.value.slice(0, 60) + '…' : d.value)
                : d.value;
            const est = d.estimateAtChange ? ` — estimate: ${d.estimateAtChange.text}` : '';
            lines.push(`User changed ${d.tag || d.class || 'control'}: "${val}"${est}${flagStr}`);

        } else if (e.layer === 'user_interaction' && e.label === 'input_settled') {
            const val = (d.value || '').length > 40
                ? d.value.slice(0, 40) + '…' : (d.value || '');
            lines.push(`User typed (settled): "${val}" into ${d.class || d.tag || 'control'}${flagStr}`);

        // ─── Function entry / branch / return ────────────────────────
        } else if (e.layer === 'fn_call' && /:branch$/.test(e.label)) {
            const br = d.branch || '(unnamed)';
            const restKeys = Object.keys(d).filter(k =>
                !['_observable', 'branch', '_entryId'].includes(k)
            );
            const restStr = restKeys.length
                ? ' ' + restKeys.map(k => `${k}=${JSON.stringify(d[k])}`).join(' ')
                : '';
            lines.push(`  branch → ${br}${restStr}${flagStr}`);

        } else if (e.layer === 'fn_call') {
            const obs = d._observable || {};
            const vis = obs.visibility || {};
            const visibleIds = Object.keys(vis).filter(k => /\/vis\//.test(vis[k]));
            const argKeys = Object.keys(d).filter(k => k !== '_observable');
            const argStr = argKeys.length
                ? argKeys.map(k => `${k}=${JSON.stringify(d[k])}`).join(' ')
                : '';
            const bcStr  = (obs.breadcrumbs && obs.breadcrumbs.length)
                ? ' bc=[' + obs.breadcrumbs.map(b => typeof b === 'string' ? b : b.type || '?').join(' > ') + ']'
                : '';
            const stepStr = obs.step != null ? ` step=${obs.step}` : '';
            const visStr  = visibleIds.length ? ` visible={${visibleIds.join(',')}}` : '';
            lines.push(`fn ${e.label}(${argStr})${bcStr}${stepStr}${visStr}${flagStr}`);

        } else if (e.layer === 'fn_return') {
            const dur = d.durationMs != null ? ` (${d.durationMs}ms)` : '';
            const restKeys = Object.keys(d).filter(k =>
                !['_observable', 'durationMs', '_entryId'].includes(k)
            );
            const restStr = restKeys.length
                ? ' ' + restKeys.map(k => `${k}=${JSON.stringify(d[k])}`).join(' ')
                : '';
            lines.push(`  ↩ ${e.label}${dur}${restStr}${flagStr}`);

        // ─── Engine layers ───────────────────────────────────────────
        } else if (e.layer === 'nlp_engine') {
            const kw  = d.winningKeyword || d.keyword || '?';
            const cat = d.category || d.winningCategory || '?';
            const conf = d.matchConfidence != null ? ` (confidence ${d.matchConfidence})` : '';
            lines.push(`NLP matched: "${kw}"${conf} → category ${cat}${flagStr}`);

        } else if (e.layer === 'orchestrator_engine') {
            const grp = d.resolvedGroupId || d.group || '?';
            lines.push(`Routed to group: ${grp}${flagStr}`);

        } else if (e.layer === 'pricing_engine') {
            const est  = d.laborEstimate != null ? d.laborEstimate : '?';
            const qty  = d.qty != null ? d.qty : '?';
            const tier = d.complexityTier != null ? d.complexityTier : '?';
            let frictionNote = '';
            if (d.frictionThreshold != null && d.totalConfidence != null) {
                frictionNote = `, friction ${d.friction} (need ${d.frictionThreshold}, have ${d.totalConfidence})`;
            }
            const feeNote = d.dispatchFee != null ? ` + $${d.dispatchFee} dispatch` : '';
            lines.push(`Price computed: $${est} (qty ${qty}, tier ${tier}${frictionNote})${feeNote}${flagStr}`);

        } else if (e.layer === 'ui_renderer' && e.label === 'sqAddToCart: invoked') {
            lines.push(`Add to Cart invoked (qty ${d.qty ?? '?'}, ${d.answersCount ?? '?'} answers on file)${flagStr}`);

        // ─── DOM snapshots ───────────────────────────────────────────
        } else if (e.layer === 'dom_snapshot') {
            if (Array.isArray(d.tiles)) {
                lines.push(`Tiles rendered in ${d.container || '?'}: [${d.tiles.map(t => t.text || t).join(' | ')}]${flagStr}`);
            } else {
                const chips = (d.weUnderstoodChips || []).join(', ');
                const qCount = (d.questions || []).length;
                const priceList = (d.priceLines || [])
                    .map(l => `${l.label || '?'}=${l.val ?? l.value ?? '?'}`)
                    .join(', ');
                const price = d.livePriceText ? ` | price ${d.livePriceText}` : '';
                const adlib = d.adlibText ? ` | adlib "${d.adlibText.slice(0, 60)}"` : '';
                const cart  = d.addToCartLabel
                    ? ` | add-to-cart "${d.addToCartLabel}"${d.addToCartLooksDisabled ? ' [DISABLED-LOOKING]' : ''}`
                    : '';
                lines.push(`Screen showed: ${chips ? `chips [${chips}], ` : ''}${qCount} question(s), price lines [${priceList}]${price}${adlib}${cart}${flagStr}`);
            }

        // ─── Fallback for any layer we don't know ────────────────────
        } else {
            lines.push(`[${timeStr}] [${e.layer}] ${e.label}${parentStr}${flagStr}`);
            continue;
        }

        // For the branches that emit a bare line, prepend the timestamp
        // to match the fallback's format so the whole document reads
        // consistently.
        const last = lines[lines.length - 1];
        if (!last.startsWith('[')) {
            lines[lines.length - 1] = `[${timeStr}] ${last}`;
        }
    }

    if (flaggedEntries.length > 0) {
        lines.push('');
        lines.push(`🚩 ${flaggedEntries.length} flagged entr${flaggedEntries.length === 1 ? 'y' : 'ies'}:`);
        for (const e of flaggedEntries) {
            const note = e._flag?.note ? ' — ' + e._flag.note : '';
            lines.push(`  - #${e.id} [${e.layer}] ${e.label}${note}`);
        }
    }

    return lines.join('\n');
}

function _renderMismatch(lines, mm) {
    if (!mm) return;
    const claimed = mm.claimed || mm.expected || '?';
    const bcs = mm.breadcrumbs || mm.foundBreadcrumbs || [];
    const bcStr = Array.isArray(bcs)
        ? bcs.map(b => typeof b === 'string' ? b : (b.type || '?')).join(' > ')
        : String(bcs);
    const stepStr = mm.step != null ? `, step=${mm.step}` : '';
    const uiStr   = mm.uiTemplate ? `, uiTemplate=${mm.uiTemplate}` : '';
    lines.push(`   ⚠ entryPath mismatch: caller claimed "${claimed}", breadcrumbs=[${bcStr}]${stepStr}${uiStr}`);
}

/**
 * Serialize the current trace log.
 *
 * @param {boolean} [compact=true]
 *      true  → single-line JSON, no indentation, nothing dropped.
 *              This is what the "Copy JSON" button uses, so the
 *              clipboard receives one line that pastes cleanly into
 *              issue trackers, chat, and log aggregators.
 *      false → 2-space pretty printed. Preserved for any consumer that
 *              was relying on the previous multi-line shape.
 *
 * No truncation is ever performed by this function. The only size
 * ceiling on the log is the tracer's own MAX_ENTRIES = 2000 cap inside
 * `_trace`, after which the log is halved.
 */
function _traceExport(compact = true) {
    const pricingEntries = window._traceLog.filter(e => e.layer === 'pricing_engine');
    const last = pricingEntries[pricingEntries.length - 1];

    // T137-style summary: the last pricing engine's decision-relevant fields.
    const summary = last ? {
        finalPrice:         last.data.laborEstimate,
        dispatchFee:        last.data.dispatchFee,
        qty:                last.data.qty,
        answers:            last.data.answers || {},
        complexityTier:     last.data.complexityTier,
        checkoutStateKey:   last.data.checkoutStateKey,
        meetsConfidenceBar: last.data.meetsConfidenceBar,
        totalConfidence:    last.data.totalConfidence,
        friction:           last.data.friction,
        frictionThreshold:  last.data.frictionThreshold,
    } : null;

    const domEntries = window._traceLog.filter(e => e.layer === 'dom_snapshot');
    const lastDomSnapshot = domEntries.length
        ? domEntries[domEntries.length - 1].data
        : null;

    const flagged = window._traceLog.filter(e => e._flag?.flagged);
    const annotations = flagged.map(e => ({
        id:            e.id,
        layer:         e.layer,
        label:         e.label,
        note:          e._flag.note || null,
        flaggedAt:     e._flag.flaggedAt || null,
        entrySnapshot: e.data,
    }));

    const stateChanges = window._traceLog
        .filter(e => e.layer === 'session' && e.label === 'state_change')
        .map(e => ({
            id:         e.id,
            afterClick: e.parentId,
            changed:    Object.keys(e.data.changes || {}),
            breadcrumbsAfter:
                (e.data.changes && e.data.changes.breadcrumbs
                    && e.data.changes.breadcrumbs.after) || null,
        }));

    let btnycHash = null;
    try {
        if (typeof window.DB !== 'undefined') {
            btnycHash = _simpleHash(JSON.stringify(window.DB));
        }
    } catch (e) { /* best-effort */ }

    const payload = {
        meta: {
            entryPath:         window._traceEntryPath || 'unknown',
            traceBuildVersion: TRACE_BUILD_VERSION,
            btnycJsonHash:     btnycHash,
            exportedAt:        new Date().toISOString(),
            totalEntries:      window._traceLog.length,
            flaggedCount:      flagged.length,
            stateChangeCount:  stateChanges.length,
        },
        input:             window._traceInput,
        summary,
        annotations,
        stateChanges,
        observedState:     _readObservableState(true),
        lastVisibleScreen: lastDomSnapshot,
        narrative:         _traceNarrative(window._traceLog),
        trace:             window._traceLog,
    };

    // compact === true  → single line, no indentation, nothing dropped.
    // compact === false → 2-space pretty print.
    return compact ? JSON.stringify(payload) : JSON.stringify(payload, null, 2);
}

function _traceToggle(on) {
    window._traceEnabled = (on !== undefined) ? !!on : !window._traceEnabled;
    if (window._traceEnabled) {
        _installErrorCapture();
        _installStateDiff();
    }

    const panel = document.getElementById('traceOverlayPanel');
    if (panel) {
        // A flex column is the ONLY layout in which the internal
        // toolbar + `flex:1; overflow-y:auto` list actually works.
        // T140 set display:flex but left flex-direction at its default
        // `row`, which grew the list horizontally. T141 set display:block,
        // under which `flex:1` on the list is inert. Column-flex is the
        // single correct option for the DOM structure this file builds.
        panel.style.display = window._traceEnabled ? 'flex' : 'none';
        panel.style.flexDirection = 'column';
        panel.style.overflow = 'hidden';
    }

    const toggleBtn = document.getElementById('traceToggleBtn');
    if (toggleBtn) {
        toggleBtn.textContent = `🔍 Trace: ${window._traceEnabled ? 'ON' : 'OFF'}`;
        toggleBtn.style.background = window._traceEnabled ? '#15803d' : '#334155';
    }

    _scheduleRender(true);
    return window._traceEnabled;
}

// ─── Global Event Captures ──────────────────────────────────────────

function _installStateDiff() {
    if (_stateDiffInstalled) return;
    _stateDiffInstalled = true;
    // Intentionally a marker only: the actual diff is scheduled per-click
    // by the interaction listener below. Exists so the toggle path can
    // invoke it unconditionally.
}

function _installErrorCapture() {
    if (_errorCaptureInstalled) return;
    _errorCaptureInstalled = true;
    window.addEventListener('error', (e) => _trace('session', 'window_error', {
        message: e.message,
        file: (e.filename || '').slice(-80),
        line: e.lineno,
        col:  e.colno,
    }));
    window.addEventListener('unhandledrejection', (e) => _trace('session', 'unhandled_rejection', {
        reason: String(e.reason).slice(0, 300),
    }));
}

function _initGlobalInteractionTracing() {
    if (typeof document === 'undefined' || window._interactionTracingInit) return;
    window._interactionTracingInit = true;

    // ── Clicks ───────────────────────────────────────────────────────
    document.addEventListener('click', (e) => {
        if (!window._traceEnabled) return;
        if (e.target?.closest('#traceOverlayPanel, #traceToggleBtn, #toast-container')) return;

        let el = e.target;
        for (let i = 0; i < 4 && el && el !== document.body; i++) {
            if (el.tagName === 'BUTTON' || el.dataset?.mod
                || (typeof el.className === 'string' && el.className.trim())) break;
            el = el.parentElement;
        }

        const desc = _describeInteractionTarget(el);
        if (!desc) return;

        desc.module        = el.closest('.intake-module-step, .step-question')?.dataset?.moduleName || null;
        desc.newSelection  = (el.textContent || '').trim().slice(0, 50);
        desc.priorSelection = _readPriorSelection(el);
        desc.estimateAtClick = _readCurrentEstimate();
        desc.selectedAnswers = _readScreenContext();

        const preState = _readObservableState(true);
        const clickId  = _trace('user_interaction', 'click', desc);
        _lastInteractionId = clickId;

        // Macrotask delay lets React/Vue/Svelte commit their re-render
        // before we diff. Microtask ran before the commit and produced
        // false-negative diffs.
        setTimeout(() => {
            if (!window._traceEnabled) return;
            const postState = _readObservableState(true);
            const diff = _diffObservableState(preState, postState);
            if (diff) {
                _trace('session', 'state_change', { changes: diff }, clickId);
            }
        }, 50);
    }, true);

    // ── Form changes ────────────────────────────────────────────────
    document.addEventListener('change', (e) => {
        if (!window._traceEnabled) return;
        if (e.target?.closest('#traceOverlayPanel')) return;

        const desc = _describeInteractionTarget(e.target);
        if (!desc) return;

        desc.value = e.target.value;
        desc.estimateAtChange = _readCurrentEstimate();

        const preState = _readObservableState(true);
        const changeId = _trace('user_interaction', 'change', desc);
        _lastInteractionId = changeId;

        setTimeout(() => {
            if (!window._traceEnabled) return;
            const postState = _readObservableState(true);
            const diff = _diffObservableState(preState, postState);
            if (diff) {
                _trace('session', 'state_change', { changes: diff }, changeId);
            }
        }, 50);
    }, true);
}

function _traceDomSnapshot(label) {
    if (!window._traceEnabled) return;
    try {
        const weUnderstoodChips = [...document.querySelectorAll(
            '.sq-ic-nlp-chip, .sq-ic-chip, .ims-chip.sel, .chip.sel'
        )].filter(_isVisible).map(c => (c.textContent || '').trim()).filter(Boolean);

        const questions = [...document.querySelectorAll(
            '.sq-ic-q, .intake-module-step, .step-question'
        )].map(q => ({
            label: q.querySelector('.sq-ic-q-lbl, .ims-label, .ims-lbl, .intake-label')?.textContent?.trim() || null,
            selectedOption: q.querySelector('.sq-ic-btn.sel, .ims-chip.sel, .ims-btn.sel, .chip.sel')?.textContent?.trim() || null,
            optionCount: q.querySelectorAll('.sq-ic-btn, .ims-chip, .ims-btn, .chip').length,
        }));

        const priceLines = [...document.querySelectorAll('.ql, .ql-row, .price-line')].map(ql => ({
            label: ql.querySelector('.ql-lbl, .qll, .label')?.textContent?.trim() || null,
            val:   ql.querySelector('.ql-val, .qlv, .value')?.textContent?.trim() || null,
        }));

        const livePriceText = _readCurrentEstimate();
        const adlibText = document.querySelector('.adlib-summary, #sqAdlibSentence')?.textContent?.trim() || null;

        const cartBtn = document.querySelector(
            '#addToCartBtn, .ctap, #btn-curated-add, button[data-action="add-to-cart"]'
        );
        const cartDisabled = cartBtn
            ? (cartBtn.disabled
                || cartBtn.classList.contains('disabled')
                || cartBtn.getAttribute('aria-disabled') === 'true')
            : null;

        _trace('dom_snapshot', label || 'render: visible DOM state', {
            weUnderstoodChips, questions, priceLines,
            livePriceText, adlibText,
            addToCartLabel: cartBtn?.textContent?.trim() || null,
            addToCartLooksDisabled: cartDisabled,
        });
    } catch (e) {
        console.warn('[trace] dom snapshot failed, ignored:', e);
    }
}

// ─── Rendering Engine & Panel UI ────────────────────────────────────

function _scheduleRender(forceInit = false) {
    if (forceInit) _pendingForceInit = true;
    if (_renderScheduled) return;
    _renderScheduled = true;
    requestAnimationFrame(() => {
        _renderScheduled = false;
        const doForce = _pendingForceInit;
        _pendingForceInit = false;
        _renderTraceOverlay(doForce);
    });
}

function _renderTraceOverlay(forceInit) {
    const panel = document.getElementById('traceOverlayPanel');
    if (!panel || !window._traceEnabled) return;

    // Preserve filter-cursor and note-editor cursor across re-renders.
    const listContainer = document.getElementById('traceListContainer') || panel;
    const atBottom = listContainer.scrollTop + listContainer.clientHeight
                     >= listContainer.scrollHeight - 30;
    const countChanged = window._lastRenderedTraceCount !== window._traceLog.length;
    window._lastRenderedTraceCount = window._traceLog.length;

    const activeEl = document.activeElement;
    const activeId = activeEl ? activeEl.id : null;
    let selectionStart = null;
    let selectionEnd = null;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        try {
            selectionStart = activeEl.selectionStart;
            selectionEnd   = activeEl.selectionEnd;
        } catch (e) { /* selectionRange unsupported on this input type */ }
    }

    let listWrap = document.getElementById('traceListContainer');

    // ── Toolbar + list container (built once, then updated in place) ─
    if (forceInit || !document.getElementById('traceToolbar')) {
        const fragment = document.createDocumentFragment();

        const toolbar = document.createElement('div');
        toolbar.id = 'traceToolbar';
        toolbar.style.cssText =
            'padding:10px;border-bottom:1px solid #334155;background:#0f172a;'
            + 'flex:0 0 auto;';

        const controls = document.createElement('div');
        controls.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;';

        const filterInput = document.createElement('input');
        filterInput.id = 'traceFilterInput';
        filterInput.type = 'text';
        filterInput.placeholder = 'Filter trace…';
        filterInput.value = window._traceFilterText;
        filterInput.style.cssText =
            'flex:1;background:#1e293b;color:#e2e8f0;border:1px solid #334155;'
            + 'padding:4px 8px;border-radius:4px;font-family:monospace;font-size:11px;';
        filterInput.oninput = (e) => {
            window._traceFilterText = e.target.value.toLowerCase();
            _scheduleRender();
        };
        controls.appendChild(filterInput);

        const flagToggle = document.createElement('button');
        flagToggle.type = 'button';
        flagToggle.textContent = window._traceFlaggedOnly ? '🚩 Only' : 'All';
        flagToggle.style.cssText =
            `background:${window._traceFlaggedOnly ? '#ca8a04' : '#334155'};`
            + 'color:#fff;border:none;border-radius:4px;padding:4px 8px;'
            + 'cursor:pointer;font-size:11px;';
        flagToggle.onclick = () => {
            window._traceFlaggedOnly = !window._traceFlaggedOnly;
            _scheduleRender(true);
        };
        controls.appendChild(flagToggle);

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.textContent = 'Copy JSON';
        copyBtn.style.cssText =
            'background:#2563eb;color:#fff;border:none;border-radius:4px;'
            + 'padding:4px 8px;cursor:pointer;font-size:11px;';
        copyBtn.onclick = () => {
            // Compact by default — single line, nothing truncated.
            const json = _traceExport();
            if (navigator.clipboard) navigator.clipboard.writeText(json);
            copyBtn.textContent = 'Copied!';
            setTimeout(() => { copyBtn.textContent = 'Copy JSON'; }, 1500);
        };
        controls.appendChild(copyBtn);

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.textContent = 'Clear';
        clearBtn.style.cssText =
            'background:#b91c1c;color:#fff;border:none;border-radius:4px;'
            + 'padding:4px 8px;cursor:pointer;font-size:11px;';
        clearBtn.onclick = () => {
            window._traceLog = [];
            window._traceInput = null;
            window._editingFlagNoteId = null;
            _lastInteractionId = null;
            window._traceExpandedIds = new Set();
            _scheduleRender(true);
        };
        controls.appendChild(clearBtn);

        toolbar.appendChild(controls);

        const layersWrap = document.createElement('div');
        layersWrap.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;';
        _ALL_LAYERS.forEach(layer => {
            const chip = document.createElement('span');
            const isHidden = window._traceHiddenLayers.has(layer);
            chip.textContent = layer.replace('_engine', '').replace('_interaction', '');
            chip.style.cssText =
                `font-size:10px;padding:2px 6px;border-radius:12px;cursor:pointer;`
                + `background:${isHidden ? '#334155' : _LAYER_COLORS[layer]};`
                + `color:${isHidden ? '#94a3b8' : '#000'};`
                + (isHidden ? 'text-decoration:line-through;' : '');
            chip.onclick = () => {
                if (window._traceHiddenLayers.has(layer)) window._traceHiddenLayers.delete(layer);
                else window._traceHiddenLayers.add(layer);
                _scheduleRender(true);
            };
            layersWrap.appendChild(chip);
        });
        toolbar.appendChild(layersWrap);
        fragment.appendChild(toolbar);

        listWrap = document.createElement('div');
        listWrap.id = 'traceListContainer';
        listWrap.style.cssText = 'flex:1 1 auto;overflow-y:auto;padding:10px;min-height:0;';
        fragment.appendChild(listWrap);

        panel.replaceChildren(fragment);
    }

    if (!listWrap) return;

    // ── Entry cards (single batched fragment) ────────────────────────
    const listFragment = document.createDocumentFragment();
    let shownCount = 0;

    for (const entry of window._traceLog) {
        if (window._traceHiddenLayers.has(entry.layer)) continue;
        if (window._traceFlaggedOnly && !entry._flag?.flagged) continue;

        if (window._traceFilterText) {
            const q = window._traceFilterText;
            const hit =
                (entry.layer || '').toLowerCase().includes(q)
                || (entry.label || '').toLowerCase().includes(q)
                || JSON.stringify(entry.data || {}).toLowerCase().includes(q);
            if (!hit) continue;
        }

        shownCount++;
        const isFlagged     = !!entry._flag?.flagged;
        const isEditingThis = window._editingFlagNoteId === entry.id;
        const isExpanded    = window._traceExpandedIds.has(entry.id) || isEditingThis || isFlagged;

        const card = document.createElement('div');
        card.style.cssText =
            `background:${isFlagged ? '#2a2416' : '#1e293b'};`
            + `border-left:3px solid ${_LAYER_COLORS[entry.layer] || '#64748b'};`
            + 'border-radius:0 4px 4px 0;padding:6px 8px;margin-bottom:6px;'
            + 'word-break:break-word;'
            + (isFlagged ? 'box-shadow:inset 0 0 0 1px #fbbf24;' : '');

        const headerRow = document.createElement('div');
        headerRow.style.cssText = 'display:flex;align-items:center;gap:4px;';

        const layerLine = document.createElement('div');
        layerLine.style.cssText =
            `color:${_LAYER_COLORS[entry.layer] || '#64748b'};font-size:10px;`
            + 'font-weight:bold;flex:1;cursor:pointer;user-select:none;';
        layerLine.textContent =
            `${isExpanded ? '▾' : '▸'} #${entry.id} · ${entry.layer}`
            + (entry.parentId != null ? ` · ← #${entry.parentId}` : '');
        layerLine.onclick = () => {
            if (window._traceExpandedIds.has(entry.id)) window._traceExpandedIds.delete(entry.id);
            else window._traceExpandedIds.add(entry.id);
            _scheduleRender();
        };
        headerRow.appendChild(layerLine);

        const flagBtn = document.createElement('button');
        flagBtn.type = 'button';
        flagBtn.textContent = '🚩';
        flagBtn.setAttribute('aria-pressed', String(isFlagged));
        flagBtn.style.cssText =
            `background:none;border:none;cursor:pointer;font-size:13px;`
            + `padding:0 3px;line-height:1;opacity:${isFlagged ? '1' : '0.35'};`;
        flagBtn.onclick = () => {
            if (isFlagged) {
                entry._flag = { flagged: false, note: entry._flag?.note || '' };
                if (window._editingFlagNoteId === entry.id) window._editingFlagNoteId = null;
            } else {
                entry._flag = {
                    flagged: true,
                    note: entry._flag?.note || '',
                    flaggedAt: Date.now(),
                };
            }
            _scheduleRender();
        };
        headerRow.appendChild(flagBtn);

        if (isFlagged) {
            const noteBtn = document.createElement('button');
            noteBtn.type = 'button';
            noteBtn.textContent = '📝';
            noteBtn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:13px;padding:0 3px;line-height:1;';
            noteBtn.onclick = () => {
                window._editingFlagNoteId =
                    (window._editingFlagNoteId === entry.id) ? null : entry.id;
                _scheduleRender();
            };
            headerRow.appendChild(noteBtn);
        }

        card.appendChild(headerRow);

        const labelLine = document.createElement('div');
        labelLine.style.cssText = 'color:#e2e8f0;margin:2px 0;';
        labelLine.textContent = entry.label;
        card.appendChild(labelLine);

        if (isExpanded) {
            const dataLine = document.createElement('pre');
            dataLine.style.cssText =
                'color:#94a3b8;font-size:10px;white-space:pre-wrap;margin:2px 0 0 0;';
            try {
                dataLine.textContent = JSON.stringify(entry.data, null, 1);
            } catch (e) {
                dataLine.textContent = '[unserializable]';
            }
            card.appendChild(dataLine);
        }

        if (isEditingThis) {
            const editor = document.createElement('div');
            editor.style.cssText = 'margin-top:6px;display:flex;flex-direction:column;gap:4px;';
            const ta = document.createElement('textarea');
            ta.id = `traceNote_${entry.id}`;
            ta.value = entry._flag?.note || '';
            ta.placeholder = 'Plain English note… (saved live; exported as annotations[].note)';
            ta.style.cssText =
                'background:#0f172a;color:#e2e8f0;border:1px solid #334155;'
                + 'border-radius:4px;padding:5px;font-family:monospace;font-size:11px;'
                + 'min-height:52px;resize:vertical;outline:none;';
            ta.addEventListener('input', () => {
                if (!entry._flag) entry._flag = { flagged: true, note: '', flaggedAt: Date.now() };
                entry._flag.note = ta.value;
            });
            const doneBtn = document.createElement('button');
            doneBtn.type = 'button';
            doneBtn.textContent = 'Done';
            doneBtn.style.cssText =
                'background:#334155;color:#e2e8f0;border:none;border-radius:4px;'
                + 'align-self:flex-end;padding:3px 10px;font-size:11px;cursor:pointer;';
            doneBtn.onclick = () => {
                window._editingFlagNoteId = null;
                _scheduleRender();
            };
            editor.append(ta, doneBtn);
            card.appendChild(editor);
        } else if (isFlagged && entry._flag?.note) {
            const noteDisplay = document.createElement('div');
            noteDisplay.style.cssText =
                'margin-top:6px;padding:4px 8px;background:#1c1917;'
                + 'border-left:2px solid #fbbf24;color:#fcd34d;font-size:11px;'
                + 'white-space:pre-wrap;border-radius:0 4px 4px 0;';
            noteDisplay.textContent = '📝 ' + entry._flag.note;
            card.appendChild(noteDisplay);
        }

        listFragment.appendChild(card);
    }

    listWrap.replaceChildren(listFragment);

    if (shownCount === 0 && window._traceLog.length > 0) {
        const empty = document.createElement('div');
        empty.style.cssText =
            'color:#64748b;font-size:11px;text-align:center;padding:16px 8px;font-style:italic;';
        empty.textContent = 'No entries match the current filter.';
        listWrap.appendChild(empty);
    }

    // ── Restore focus and cursor position ────────────────────────────
    if (activeId) {
        const restoredEl = document.getElementById(activeId);
        if (restoredEl) {
            try { restoredEl.focus(); } catch (e) { /* best-effort */ }
            if (selectionStart != null && selectionEnd != null && restoredEl.setSelectionRange) {
                try { restoredEl.setSelectionRange(selectionStart, selectionEnd); }
                catch (e) { /* selectionRange unsupported */ }
            }
        }
    } else if (window._editingFlagNoteId) {
        document.getElementById(`traceNote_${window._editingFlagNoteId}`)?.focus();
    }

    // ── Auto-scroll only when a new entry arrived and we were at bottom
    if (atBottom && countChanged) {
        listWrap.scrollTop = listWrap.scrollHeight;
    }
}

if (typeof document !== 'undefined') _initGlobalInteractionTracing();