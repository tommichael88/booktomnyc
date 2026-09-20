/**
 * trace.js
 *
 * Component-level tracing overlay, extracted from qr.html into its own
 * file (per direct request) so future edits to qr.html cannot accidentally
 * lose or regress this layer. Loaded via a plain <script src> tag, before
 * pricing_engine.js -- so all six callers of its public functions
 * (_trace, _traceStart, _traceExport, _traceToggle, _renderTraceOverlay,
 * _traceDomSnapshot) see them as globals by the time any runtime call
 * happens.
 *
 * Self-contained: every top-level function and window.* state field this
 * needs is declared here. The only two dependencies on the host page are
 * (1) the two container elements #traceToggleBtn and #traceOverlayPanel,
 * which live in qr.html's <body>, and (2) window.DB, read optionally for
 * the btnyc.json hash in exports -- degrades to null gracefully if absent.
 *
 * Load order note: since this file uses classic (non-module) script
 * semantics, top-level `function` declarations become window globals, and
 * top-level `const`/`let` (e.g. QR_BUILD_VERSION) live in the shared
 * global lexical environment -- accessible to every other classic script
 * block on the page by their bare identifier. Nothing here needs `defer`
 * or `async`.
 *
 * CSP note: qr.html's current Content-Security-Policy allows script-src
 * 'self' and 'unsafe-inline' -- so ./trace.js served from the same origin
 * as qr.html loads without any CSP change. Loading it from a CDN would
 * require adding that host to script-src.
 *
 * Service-worker note: sw.js is registered at qr.html's end. If the SW
 * caches trace.js, ship a version bump (or a cache-name bump in sw.js)
 * whenever this file changes, or the tester's browser may serve a stale
 * copy during debugging.
 */

// A manually-maintained build marker for the trace layer itself. Was
// previously QR_BUILD_VERSION inside qr.html; moved here alongside the
// code it tracks. Update by hand whenever this file changes.
const TRACE_BUILD_VERSION = 'T135';

window._traceEnabled = false;
window._traceLog = [];
window._traceInput = null;
// Tracks which entry's flag-note editor is currently open (by entry.seq),
// so incoming trace entries can't disrupt an in-progress edit.
window._editingFlagNoteSeq = null;
// Entry count at the last render -- used to decide whether to preserve
// scroll position (same count = user action) or jump to the bottom.
window._lastRenderedTraceCount = 0;

// Fast, synchronous, non-cryptographic string hash (djb2). Purpose is
// "are we looking at the same btnyc.json", not tamper-proofing.
function _simpleHash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(16).padStart(8, '0');
}

function _trace(layer, label, data) {
    if (!window._traceEnabled) return; // true no-op when disabled
    try {
        // Record entryPath honestly if no explicit _traceStart was ever
        // fired for this session (e.g. pure category/group-tile navigation).
        if (window._traceEnabled && !window._traceEntryPath && layer !== 'user_interaction') {
            window._traceEntryPath = 'catalog_direct (inferred -- no explicit _traceStart call fired on this path)';
        }
        window._traceLog.push({
            seq: window._traceLog.length,
            t: Date.now(),
            layer,
            label,
            // Deep-cloned snapshot so later mutation of the real object can
            // never retroactively change a past trace entry. The tester's
            // _flag metadata lives on a separate key of the entry itself,
            // unaffected by this clone.
            data: JSON.parse(JSON.stringify(data == null ? {} : data)),
        });
        // 2000-entry safety valve, well above any realistic single-session
        // flow. When it fires, keep the most recent half and renumber.
        const MAX_ENTRIES = 2000;
        if (window._traceLog.length > MAX_ENTRIES) {
            window._traceLog = window._traceLog.slice(-Math.floor(MAX_ENTRIES / 2));
            window._traceLog.forEach((e, i) => { e.seq = i; });
        }
        if (typeof _renderTraceOverlay === 'function') _renderTraceOverlay();
    } catch (e) {
        // A tracing failure must never surface to the customer or block the
        // real pipeline it's observing.
        console.warn('[trace] entry failed, ignored:', e);
    }
}

function _traceStart(input, entryPath) {
    if (!window._traceEnabled) return;
    // No longer clears the log -- a new entry flow is recorded as a
    // session/context_transition marker so multi-step debugging (e.g. add
    // to cart failed on service A, then tried service B) preserves all
    // prior context. The trashcan button in the panel header clears
    // explicitly when the tester wants a clean slate.
    window._traceInput = input;
    window._traceEntryPath = entryPath || 'unknown';
    window._editingFlagNoteSeq = null;
    _trace('session', 'context_transition', {
        entryPath: entryPath || 'unknown',
        input,
    });
}

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

    // The tester's annotations, structured for machine consumption. Each
    // carries the entry's seq/layer/label, the tester's note, the timestamp
    // the flag was set, and the full entry snapshot so a bug-fixing AI has
    // the complete context of what was on screen when the flag was raised.
    const flagged = window._traceLog.filter(e => e._flag && e._flag.flagged);
    const annotations = flagged.map(e => ({
        seq: e.seq,
        layer: e.layer,
        label: e.label,
        note: (e._flag && e._flag.note) || null,
        flaggedAt: (e._flag && e._flag.flaggedAt) || null,
        entrySnapshot: e.data,
    }));

    return JSON.stringify({
        meta: {
            entryPath: window._traceEntryPath || 'unknown',
            traceBuildVersion: TRACE_BUILD_VERSION,
            btnycJsonHash: btnycHash,
            exportedAt: new Date().toISOString(),
            totalEntries: window._traceLog.length,
            flaggedCount: flagged.length,
        },
        summary,
        // Tester-raised flags/notes, directly consumable by a bug-fixing
        // machine without scanning the full trace.
        annotations,
        lastVisibleScreen: lastDomSnapshot,
        narrative: _traceNarrative(window._traceLog),
        input: window._traceInput,
        trace: window._traceLog,
    });
}

function _traceToggle(on) {
    window._traceEnabled = (on !== undefined) ? !!on : !window._traceEnabled;
    if (typeof _renderTraceOverlay === 'function') _renderTraceOverlay(true);
    return window._traceEnabled;
}

function _readCurrentEstimate() {
    // Reads the current, live estimate off whatever panel is on screen.
    // The specific selector is captured so the tester/developer knows
    // exactly which UI element produced the number -- multiple panels use
    // different class names for the same concept.
    const candidates = [
        '#sqLivePrice',
        '.sq-ic-price',
        '.iph-price',
        '#current-estimate',
        '.qprice',
        '.qpranger',
        '.price-value',
        '#sqCurEstBtn',
    ];
    for (const sel of candidates) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const t = (el.textContent || '').trim();
        if (t) return { selector: sel, text: t.slice(0, 80) };
    }
    return null;
}

function _readPriorSelection(el) {
    // When a click lands on an intake chip (data-mod/data-label), find the
    // sibling chip in the same question group currently selected. Returns
    // null for a fresh selection so the trace correctly distinguishes
    // "first pick" from "changed pick".
    const mod = el && el.dataset && el.dataset.mod;
    if (!mod) return null;
    const scope = el.closest('.sq-ic-q') || el.closest('.intake-module-step') || el.parentElement;
    if (!scope) return null;
    let selected = null;
    try {
        selected = scope.querySelector('[data-mod="' + mod.replace(/"/g, '\\"') + '"].sel');
    } catch (e) { /* malformed selector, degrade silently */ }
    if (!selected || selected === el) return null;
    return {
        label: selected.dataset.label || (selected.textContent || '').trim().slice(0, 80),
    };
}

function _readScreenContext() {
    // Compact snapshot of the two pieces most commonly needed to correlate
    // a click against the rest of the screen: current estimate, and the
    // set of currently-selected intake answers.
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

function _renderTraceOverlay(force) {
    const btn = document.getElementById('traceToggleBtn');
    const panel = document.getElementById('traceOverlayPanel');
    if (!btn || !panel) return;
    btn.textContent = window._traceEnabled ? '🔍 Trace: On' : '🔍 Trace: Off';
    btn.style.opacity = window._traceEnabled ? '1' : '0.55';
    panel.style.display = window._traceEnabled ? 'block' : 'none';
    if (!window._traceEnabled) return;

    // Don't disrupt an in-progress flag-note edit.
    if (window._editingFlagNoteSeq != null && !force) return;

    const prevScrollTop = panel.scrollTop;
    const sameCount = window._lastRenderedTraceCount === window._traceLog.length;
    window._lastRenderedTraceCount = window._traceLog.length;

    // Rebuilt via safe DOM methods every call -- every piece of trace data
    // (which may contain raw customer free text) goes through textContent,
    // never innerHTML string concatenation.
    panel.replaceChildren();

    // ── Header: title, Copy JSON, Clear log ──
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;border-bottom:1px solid #334155;padding-bottom:8px;gap:6px;';
    const title = document.createElement('strong');
    const flaggedCount = window._traceLog.filter(e => e._flag && e._flag.flagged).length;
    title.textContent = `Trace (${window._traceLog.length} entries${flaggedCount ? `, 🚩 ${flaggedCount} flagged` : ''})`;
    title.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';

    const btnGroup = document.createElement('div');
    btnGroup.style.cssText = 'display:flex;gap:6px;flex-shrink:0;';

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
        _renderTraceOverlay(true);
    };

    btnGroup.append(exportBtn, clearBtn);
    header.append(title, btnGroup);
    panel.appendChild(header);

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

    const LAYER_COLORS = {
        nlp_engine: '#38bdf8',
        orchestrator_engine: '#fbbf24',
        pricing_engine: '#4ade80',
        ui_renderer: '#f472b6',
        dom_snapshot: '#a78bfa',
        user_interaction: '#fb923c',
        session: '#94a3b8',
    };

    window._traceLog.forEach(entry => {
        const isFlagged = !!(entry._flag && entry._flag.flagged);
        const isEditingThis = window._editingFlagNoteSeq === entry.seq;

        const card = document.createElement('div');
        card.style.cssText = 'background:' + (isFlagged ? '#2a2416' : '#1e293b')
            + ';border-left:3px solid ' + (LAYER_COLORS[entry.layer] || '#64748b')
            + ';border-radius:0 4px 4px 0;padding:6px 8px;margin-bottom:6px;word-break:break-word;'
            + (isFlagged ? 'box-shadow:inset 0 0 0 1px #fbbf24;' : '');

        const headerRow = document.createElement('div');
        headerRow.style.cssText = 'display:flex;align-items:center;gap:4px;';

        const layerLine = document.createElement('div');
        layerLine.style.cssText = 'color:' + (LAYER_COLORS[entry.layer] || '#64748b')
            + ';font-size:10px;font-weight:bold;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        layerLine.textContent = `#${entry.seq} · ${entry.layer}`;
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
            noteBtn.title = (entry._flag && entry._flag.note)
                ? 'Edit flag note'
                : 'Add a note to this flag';
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

        const dataLine = document.createElement('pre');
        dataLine.style.cssText = 'color:#94a3b8;font-size:10px;white-space:pre-wrap;margin:2px 0 0 0;';
        dataLine.textContent = JSON.stringify(entry.data, null, 1);
        card.appendChild(dataLine);

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

    if (sameCount) {
        panel.scrollTop = prevScrollTop;
    } else {
        panel.scrollTop = panel.scrollHeight;
    }
}

// ─── Global interaction capture ────────────────────────────────────
// A single, capturing-phase listener on document, not per-handler
// instrumentation -- structurally guarantees coverage of every tap and
// every settled text edit, present and future.
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

    try {
        const cs = window.getComputedStyle ? window.getComputedStyle(el) : null;
        if (cs) {
            desc.style = {
                bg: cs.backgroundColor,
                color: cs.color,
                border: cs.borderTopColor,
                opacity: cs.opacity,
                fontWeight: cs.fontWeight,
            };
        }
    } catch (e) { /* getComputedStyle can throw on detached nodes */ }

    return desc;
}

function _initGlobalInteractionTracing() {
    if (typeof document === 'undefined') return;
    if (window._interactionTracingInit) return;
    window._interactionTracingInit = true;

    document.addEventListener('click', (e) => {
        if (typeof _trace !== 'function' || !window._traceEnabled) return;
        let el = e.target;
        for (let i = 0; i < 4 && el && el !== document.body; i++) {
            if (el.tagName === 'BUTTON' || (el.dataset && el.dataset.mod) ||
                (el.className && typeof el.className === 'string' && el.className.trim())) break;
            el = el.parentElement;
        }
        const desc = _describeInteractionTarget(el);
        if (!desc) return;

        // Question-response enrichment: capture the currently-selected
        // sibling BEFORE the handler mutates state, so "customer changed
        // their answer" is traceable.
        if (el && el.dataset && el.dataset.mod) {
            const prior = _readPriorSelection(el);
            if (prior) desc.priorSelection = prior;
            desc.module = el.dataset.mod;
            desc.newSelection = el.dataset.label || (el.textContent || '').trim().slice(0, 80);
        }

        // Current estimate at click time, with its selector.
        const estimate = _readCurrentEstimate();
        if (estimate) desc.estimateAtClick = estimate;

        // All currently-selected intake answers.
        const screenCtx = _readScreenContext();
        if (screenCtx.selectedAnswers && screenCtx.selectedAnswers.length) {
            desc.selectedAnswers = screenCtx.selectedAnswers;
        }

        _trace('user_interaction', 'click', desc);
    }, true);

    document.addEventListener('change', (e) => {
        if (typeof _trace !== 'function' || !window._traceEnabled) return;
        const el = e.target;
        if (!el || !('value' in el)) return;
        const desc = _describeInteractionTarget(el) || {};
        desc.value = typeof el.value === 'string' ? el.value.slice(0, 200) : el.value;
        const estimate = _readCurrentEstimate();
        if (estimate) desc.estimateAtChange = estimate;
        _trace('user_interaction', 'input_settled', desc);
    }, true);
}

// ─── DOM snapshot: what the customer actually sees ─────────────────
// Separate from the internal-state trace points -- those show what the
// CODE computed; this shows what actually rendered. Only textContent is
// read, matching this project's own established XSS-safety convention.
function _traceDomSnapshot(label) {
    if (typeof _trace !== 'function' || !window._traceEnabled) return;
    try {
        const card = document.querySelector('.sq-ic-card') || document.getElementById('sqQuoteOut')
            || document.querySelector('.intake-module-step')?.closest('div') || document.body;
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

// ─── Human-readable narrative ──────────────────────────────────────
// The full raw trace log remains available in every export; this walks it
// into a short, plain-English, step-by-step account.
function _traceNarrative(log) {
    const lines = [];
    for (const e of log) {
        const flagTag = (e._flag && e._flag.flagged)
            ? ` 🚩 FLAGGED${e._flag.note ? ' — ' + e._flag.note : ''}`
            : '';
        if (e.layer === 'session' && e.label === 'context_transition') {
            const inp = typeof e.data.input === 'string' ? e.data.input.slice(0, 60) : JSON.stringify(e.data.input).slice(0, 60);
            lines.push(`── new ${e.data.entryPath} entry: ${inp} ──${flagTag}`);
        } else if (e.layer === 'user_interaction' && e.label === 'click') {
            const d = e.data;
            const what = (d.data && d.data.mod)
                ? `question option "${d.data.label || d.newSelection || d.text || ''}" (${d.data.mod})`
                : (d.text || d.tag || 'an element');
            const priorNote = d.priorSelection ? ` [changed from "${d.priorSelection.label}"]` : '';
            const estNote = d.estimateAtClick ? ` — estimate on screen: ${d.estimateAtClick.text} (${d.estimateAtClick.selector})` : '';
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
            lines.push(`Screen showed: ${d.questions?.length || 0} question(s), price lines [${(d.priceLines || []).map(l => l.label + '=' + l.value).join(', ')}], add-to-cart button: "${d.addToCartLabel || '(none)'}"${d.addToCartLooksDisabled ? ' [DISABLED-LOOKING]' : ''}${flagTag}`);
        } else if (e.layer === 'ui_renderer' && e.label === 'sqAddToCart: invoked') {
            lines.push(`User clicked Add to Cart (qty ${e.data.qty}, ${e.data.answersCount} answers on file)${flagTag}`);
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

// Auto-wire the global click/change listeners as soon as this file loads.
// Classic (non-deferred) script: runs during HTML parsing, but only
// attaches listeners -- never queries the DOM at load time -- so it's safe
// regardless of where in <head>/<body> the <script src> tag sits.
if (typeof document !== 'undefined') _initGlobalInteractionTracing();