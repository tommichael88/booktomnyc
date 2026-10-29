#!/usr/bin/env node
/**
 * cms_bridge.js
 *
 * Pulls the LIVE pricing engine straight out of qr.html (verbatim function
 * bodies, not a hand-maintained copy) so btnyc.py's Price Simulator can
 * compute a quote using the exact same math the actual site uses, without
 * a second JS file to keep in sync by hand. This is the corrected
 * replacement for an earlier draft of this file and the now-retired
 * pricing_engine.js — see CHANGELOG_v9.4.md for the two bugs that made the
 * original version non-functional:
 *
 *   1. Its <script> extraction regex was non-greedy and matched only the
 *      FIRST <script> tag in qr.html. computeUnifiedQuote and most of the
 *      real engine live in the SECOND script block — so the original would
 *      silently fail to find 8 of the 11 functions it needed, including
 *      computeUnifiedQuote itself. Fixed here by searching every <script>
 *      block, same approach already proven in test_harness/extract_engine.py.
 *   2. The companion pricing_engine.js (a hand-maintained standalone copy,
 *      now retired in favor of this live-extraction approach) had a
 *      resolveCheckoutState that hardcoded svcDiscKey = null, silently
 *      dropping the real per-service default_estimates.disclaimer override
 *      that 69/69 services actually set (6 of them to "hourly", a value the
 *      inferred fallback can never produce). Fixed here by extracting
 *      resolveCheckoutState VERBATIM (including its real S._svc read) and
 *      supplying a proper `global.S = { _svc: ctx.svc }` shim before calling
 *      it, instead of reimplementing the function by hand.
 *
 * Usage:
 *   node cms_bridge.js <payload.json> [path/to/btnyc.json] [path/to/qr.html]
 *
 * payload.json shape — see btnyc.py's PriceSimulator dialog for the Python
 * side that builds this:
 *   {
 *     "serviceId": "toilet_install",          // OR dynamic lookup below
 *     "category": "minor_home_repairs", "stype": "Repair", "groupId": null,
 *     "answers": { "wall_type": "Brick or concrete" },
 *     "tags": ["#heavy_item"],
 *     "qty": 2,
 *     "formulaId": "tile_repair_formula"      // optional
 *   }
 *
 * Prints one line of JSON (the computeUnifiedQuote result merged with the
 * resolveCheckoutState result) to stdout. Non-zero exit + stderr message on
 * any failure — never prints a partial/guessed result.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SCRIPT_DIR = __dirname;

// Functions to extract verbatim from qr.html, by name. Order doesn't matter
// — each is found independently via brace-matching, not assembled by
// concatenation order like the original draft assumed.
const FUNCTION_NAMES = [
    'resolveDynamicService',
    'resolveBaseConfidenceStrategy',
    'resolveServiceCheckoutStateKey',
    
    'applyLiveConfidenceEscalation',
    'resolveSkillTier', 'priceAddedTime', 'splitAddedTimeDollars',
    'applyPricingFormula',
    'computeUnifiedQuote',
    'buildCheckoutStateModel',   // T189: was resolveCheckoutState; renamed at T150 (it builds the presentation model from an already-resolved key)
    'sqTagLabel',
    'tagValidForCategory',
    'resolveEngineKey',
    'resolveServiceBadge',
    // v9.5: NLP analysis functions, added for the new SmartQuote/NLP
    // simulator (btnyc.py: Tools panel below the category TileGrid).
    // These live in qr.html block 0 (initNlpSets, detectTagsNLP) and
    // block 1 (detectIntentNLP, extractObject, extractQty, extractLocation,
    // resolveGroupFromIntent) — the brace-matching extraction below finds
    // them regardless of which block, same as every other function here.
    'initNlpSets',
    'detectTagsNLP',
    'detectIntentNLP',
    'extractObject',  // NOTE: qr.html has TWO: 2-param analysis version (extracted here) and 1-param preview version. findFunctionBlock gets the first match which is the analysis version.
    'extractQty',
    'extractLocation',
    'extractSizeHint',
    'resolveGroupFromIntent',
    'isServiceVerb',
    'inferTagsFromContext',
    'refreshNlpPreviewBindings',  // v9.5 new arch: must be called after initNlpSets
];

// v9.5: the analysis-pipeline extractObject/extractLocation/isServiceVerb
// don't call FUNCTION_NAMES' declared functions directly — they call these
// lazy accessor helpers (one-liner arrow functions, not `function` decls,
// so they need their own extraction path — see findArrowConst below),
// found missing by actually running the extracted engine end-to-end rather
// than assuming the function-name list was complete.
const ARROW_CONST_NAMES = ['_SKIP_WORDS', '_SVC_VERBS', '_STOP_PREPS', '_CLAUSE_BOUNDARY', '_ROOMS_LIST'];

// v9.5: plain literal consts (a regex literal and an object literal,
// neither a function nor an arrow-const) that extractQty depends on —
// found missing by actually running mode:'analyze' end-to-end (the same
// _QTY_WORD_MAP/_DIMENSION_PATTERN gap already found and fixed once in
// nlp_engine.js — see CHANGELOG_v9.4.md — reproduced here independently
// since cms_bridge.js extracts directly from qr.html rather than reusing
// nlp_engine.js's already-fixed copy).
const PLAIN_CONST_NAMES = ['_QTY_WORD_MAP', '_DIMENSION_PATTERN'];

function findPlainConst(src, constName) {
    const pattern = new RegExp(`const\\s+${constName}\\s*=`);
    const m = pattern.exec(src);
    if (!m) return null;
    // T189: the literal may span lines (_QTY_WORD_MAP is a multi-line object in modules/nlp_engine.js). Read to the end of the statement: the first ';' at depth 0
    // outside strings, comments and regex literals' brackets is not attempted -- the constants named in PLAIN_CONST_NAMES are a regex literal and an object literal of
    // words and numbers, so brace/bracket/paren depth plus quotes is enough, and an unterminated statement is an error, not a guess.
    let i = m.index + m[0].length, depth = 0, q = null;
    for (; i < src.length; i++) {
        const c = src[i];
        if (q) { if (c === '\\') i++; else if (c === q) q = null; continue; }
        if (c === '"' || c === "'" || c === '`') { q = c; continue; }
        if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
        if (c === '/' && depth === 0 && /=\s*$/.test(src.slice(m.index, i))) { // a regex literal: skip to its closing '/' then its flags
            i++; while (i < src.length && src[i] !== '/') { if (src[i] === '\\') i++; else if (src[i] === '[') { while (i < src.length && src[i] !== ']') { if (src[i] === '\\') i++; i++; } } i++; }
            continue;
        }
        if (c === '{' || c === '[' || c === '(') depth++;
        else if (c === '}' || c === ']' || c === ')') depth--;
        else if (c === ';' && depth === 0) return src.slice(m.index, i + 1);
    }
    return null;
}

function findArrowConst(src, constName) {
    const pattern = new RegExp(`(?:const|let|var)\\s+${constName}\\s*=[^\\n;]*;?`);
    const m = pattern.exec(src);
    return m ? m[0] : null;
}

// v9.5: these three function names exist TWICE in qr.html — a fast
// preview-pipeline version (block 0, used only for the live-as-you-type
// "looks right" hint) and a more thorough analysis-pipeline version
// (block 1, used by sqAnalyze and everything that actually affects the
// computed quote — see nlp_engine.js's header for the full trace of this
// duplication). A regex match against "the first occurrence" silently
// grabs the WRONG, lower-fidelity version for these three, since block 0
// comes first in document order. Force the LAST occurrence for them.
// In the new multi-block architecture, analysis functions (2-param) come BEFORE
// preview functions (1-param). PREFER_LAST is no longer needed for extractObject
// etc. -- the first occurrence is now the correct analysis version.
// Kept as an empty set in case future duplicates need it.
const DUPLICATED_FUNCTIONS_PREFER_LAST = new Set([]);

function findFunctionBlock(src, funcName) {
    // Brace-counting extraction — identical approach to
    // test_harness/extract_engine.py's find_function_block, so the two stay
    // consistent. Matches occurrences of `function <name>(...) {` and walks
    // forward counting braces until they balance back to zero. Defaults to
    // the FIRST occurrence; DUPLICATED_FUNCTIONS_PREFER_LAST overrides this
    // to the LAST occurrence for the specific names where that matters.
    const declRe = new RegExp(`function\\s+${funcName}\\s*\\([^)]*\\)\\s*\\{`, 'g');
    const matches = [...src.matchAll(declRe)];
    if (!matches.length) return null;
    const m = DUPLICATED_FUNCTIONS_PREFER_LAST.has(funcName) ? matches[matches.length - 1] : matches[0];
    const start = m.index;
    let depth = 0;
    for (let j = m.index + m[0].length - 1; j < src.length; j++) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}') {
            depth--;
            if (depth === 0) return src.slice(start, j + 1);
        }
    }
    throw new Error(`Braces never balanced for '${funcName}' in qr.html — extraction would be truncated. Has the function's structure changed?`);
}

function extractEngine(qrHtmlPath) {
    if (!fs.existsSync(qrHtmlPath)) {
        throw new Error(`qr.html not found at ${qrHtmlPath}`);
    }
    // T189 (PENDING_DECISIONS #138, I1): the three engine modules WHOLE, exactly as the page runs them, not a hand-kept list of functions found by name. The list went stale every
    // time a helper was added or renamed (resolveCheckoutState became buildCheckoutStateModel at T150; _QTY_WORD_MAP became a multi-line literal; resolveQuantityUnits and
    // wordBoundaryIncludes were never on it), and each time the bridge failed with "X is not defined" for a reason unrelated to the quote it was asked for. test_harness/_engine.js
    // does this for forty tests (R-DEFECT-STALE-SANDBOX): it reads the assembled page (the external modules in place, _page.js), takes the pricing, NLP and orchestrator modules
    // whole, and exports every top-level function onto the sandbox global. The bridge exports the same functions on module.exports, where its callers look.
    const { engine } = require('./test_harness/_engine.js');
    const e = engine(path.resolve(qrHtmlPath));
    const names = [...e.names];
    return e.wrapper + `
;(function () { for (const n of ${JSON.stringify(names)}) { if (typeof globalThis[n] === 'function') module.exports[n] = globalThis[n]; } })();
`;
}

function loadEngineFromStandaloneModule(pricingEngineJsPath, config) {
    // v9.4: explicit, opt-in alternative to extractEngine() — loads the
    // already-extracted, already-verified pricing_engine.js (see
    // CHANGELOG_v9.4.md / architecture_audit/) directly, instead of
    // re-parsing qr.html on every call. Faster, and works in contexts where
    // qr.html isn't available alongside this script (e.g. a deployed
    // server-side simulator) — but it is a SNAPSHOT: if qr.html's pricing
    // functions are edited and pricing_engine.js isn't re-extracted to
    // match (see test_harness/verify_pricing_engine_module.js, which exists
    // specifically to catch that drift), this mode will silently compute
    // against stale logic. Live extraction (the default) can never go
    // stale by construction, since it re-reads qr.html every single call —
    // that's why it stays the default; this mode is opt-in only.
    if (!fs.existsSync(pricingEngineJsPath)) {
        throw new Error(`pricing_engine.js not found at ${pricingEngineJsPath}. Run the Phase 1 extraction (see architecture_audit/) to generate it, or unset PRICING_ENGINE_MODE to use live qr.html extraction instead.`);
    }
    const engineCode = fs.readFileSync(pricingEngineJsPath, 'utf8');
    const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
        DB: config,
        SERVICE_DATA: config,
        window: { DB: config },
        S: { _svc: null },
        require,
    };
    sandbox.global = sandbox;
    vm.createContext(sandbox);
    try {
        vm.runInContext(engineCode + `\nmodule.exports = { ${FUNCTION_NAMES.join(', ')} };\n`, sandbox, { filename: pricingEngineJsPath });
    } catch (err) {
        throw new Error(`Failed to execute pricing_engine.js: ${err.message}\n\npricing_engine.js may be out of date relative to qr.html — re-run the Phase 1 extraction, or unset PRICING_ENGINE_MODE to use live qr.html extraction.`);
    }
    return { engine: sandbox.module.exports, sandbox };
}

function loadEngine(qrHtmlPath, config) {
    const engineCode = extractEngine(qrHtmlPath);
    const sandbox = {
        module: { exports: {} },
        exports: {},
        console,
        DB: config,
        SERVICE_DATA: config,
        // v9.5: new architecture stores NLP globals under window._NLP.
        // Pre-initialize with empty values so any function that reads
        // window._NLP before it's fully initialized doesn't crash.
        // The NLP init code in qr.html's block 2 will populate this.
        window: {
            DB: config,
            _NLP: { STOP: new Set(), PREPS: new Set(), CLAUSE: new Set(), VERBS: new Set(), ROOMS: [], CONDS: [], VMAP: {}, NEG: new Set(), ACTIONS: [] },
            ACTIONS: [],
            SERVICE_VERBS: new Set(),
            STOP_PREPS: new Set(),
            VERB_PAST_MAP: {},
            ROOMS: [],
            CONDITIONS: [],
        },
        // Also expose as top-level sandbox globals for backward compat
        ACTIONS: [],
        SERVICE_VERBS: new Set(),
        STOP_PREPS: new Set(),
        VERB_PAST_MAP: {},
        ROOMS: [],
        CONDITIONS: [],
        S: { _svc: null },      // resolveCheckoutState reads S._svc directly — set per-call below
        require,
    };
    sandbox.global = sandbox;
    vm.createContext(sandbox);
    try {
        vm.runInContext(engineCode, sandbox, { filename: 'qr.html-extracted-engine' });
    } catch (err) {
        throw new Error(`Failed to execute extracted engine code: ${err.message}\n\nThis usually means qr.html's function signatures changed in a way that broke a brace-matched extraction, or one function now calls a helper not in FUNCTION_NAMES. Check the error above for the specific ReferenceError/SyntaxError.`);
    }
    // v9.5 new architecture: NLP globals are initialized via initNlpSets() → window._NLP,
    // then refreshNlpPreviewBindings() sets the module-level `let` bindings (STOP_WORDS etc.)
    // that all NLP functions read. Call both in sequence now that the engine is loaded.
    if (sandbox.module.exports.initNlpSets) {
        sandbox.module.exports.initNlpSets();
    }
    if (sandbox.module.exports.refreshNlpPreviewBindings) {
        sandbox.module.exports.refreshNlpPreviewBindings();
    }
    return { engine: sandbox.module.exports, sandbox };
}

function main() {
    const payloadPath = process.argv[2];
    if (!payloadPath) {
        console.error('Usage: node cms_bridge.js <payload.json> [btnyc.json path] [qr.html path]');
        process.exit(1);
    }
    const configPath = process.argv[3] || path.join(SCRIPT_DIR, 'btnyc.json');
    const qrHtmlPath = process.argv[4] || path.join(SCRIPT_DIR, 'qr.html');

    let payload, config;
    try {
        payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (err) {
        console.error(`Failed to read/parse input files: ${err.message}`);
        process.exit(1);
    }

    let engine, sandbox;
    try {
        // v9.4: PRICING_ENGINE_MODE=standalone is an explicit opt-in to load
        // pricing_engine.js directly instead of live-extracting from
        // qr.html on every call — see loadEngineFromStandaloneModule's
        // comment for the tradeoff. Default (unset, or any other value)
        // stays live extraction, unchanged from before this option existed.
        // v9.5: standalone mode does NOT support payload.mode === 'analyze'
        // — pricing_engine.js intentionally contains no NLP functions
        // (those live in the separate nlp_engine.js reference module).
        if (process.env.PRICING_ENGINE_MODE === 'standalone') {
            if (payload.mode === 'analyze') {
                console.error("PRICING_ENGINE_MODE=standalone does not support mode:'analyze' — pricing_engine.js has no NLP functions. Unset PRICING_ENGINE_MODE to use live qr.html extraction for analysis requests.");
                process.exit(1);
            }
            const pricingEngineJsPath = process.argv[5] || path.join(SCRIPT_DIR, 'pricing_engine.js');
            ({ engine, sandbox } = loadEngineFromStandaloneModule(pricingEngineJsPath, config));
        } else {
            ({ engine, sandbox } = loadEngine(qrHtmlPath, config));
        }
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }

    // v9.5: mode:'analyze' — run the free-text NLP pipeline (the same
    // functions sqAnalyze calls) and return the full analysis, without
    // computing a quote. Used by the new SmartQuote/NLP simulator in
    // btnyc.py (Tools panel below the category TileGrid) to let an editor
    // see exactly what the live site would detect for a typed phrase —
    // intent/category match, suggested smart tags, extracted object/qty/
    // location — before deciding whether to adjust the underlying
    // intent_mappings/smart_tags data.
    if (payload.mode === 'analyze') {
        const text = payload.text || '';
        let result;
        try {
            engine.initNlpSets();
            const intent = engine.detectIntentNLP(text);
            const tagsResult = engine.detectTagsNLP(text);
            const obj = engine.extractObject(text, intent && intent.key);
            const qty = engine.extractQty(text);
            const location = engine.extractLocation(text);
            const sizeHint = engine.extractSizeHint ? engine.extractSizeHint(text, config.smart_tags || {}) : null;
            const groupId = intent ? engine.resolveGroupFromIntent(intent.category, obj, intent.stype, text) : null;
            result = { intent, tagsResult, obj, qty, location, sizeHint, groupId };
        } catch (err) {
            console.error(`NLP analysis threw: ${err.message}`);
            process.exit(1);
        }
        console.log(JSON.stringify(result));
        return;
    }

    const svc = payload.serviceId
        ? (config.services || []).find(s => s.id === payload.serviceId)
        : null;
    if (payload.serviceId && !svc) {
        console.error(`serviceId '${payload.serviceId}' not found in services[]`);
        process.exit(1);
    }

    let dynDef = payload.dynDef || null;
    if (!svc && !dynDef && payload.category && payload.stype) {
        dynDef = engine.resolveDynamicService(payload.category, payload.stype, payload.groupId || null);
        if (!dynDef) {
            console.error(`No dynamic_service found for category='${payload.category}' stype='${payload.stype}' groupId='${payload.groupId || ''}'`);
            process.exit(1);
        }
    }
    if (!svc && !dynDef) {
        console.error('Payload must supply either serviceId, or category+stype (for dynamic_service lookup), or dynDef directly.');
        process.exit(1);
    }

    const ctx = {
        svc,
        dynDef,
        activeTagIds: payload.tags || [],
        answers: payload.answers || {},
        qty: payload.qty || 1,
        intentKeyword: payload.intentKeyword || null,
        formulaId: payload.formulaId || null,
    };

    let quote;
    try {
        quote = engine.computeUnifiedQuote(ctx);
    } catch (err) {
        console.error(`computeUnifiedQuote threw: ${err.message}`);
        process.exit(1);
    }

    // resolveCheckoutState reads the global S._svc directly (a real,
    // intentional read in the live code — see the comment above
    // FUNCTION_NAMES for why this is extracted verbatim rather than
    // reimplemented). Set the shim to what S._svc would actually be at this
    // point in a real session before calling it, so the genuine per-service
    // default_estimates.disclaimer override resolves correctly instead of
    // always falling through to the generic inferred key.
    sandbox.S._svc = svc || null;
    let checkoutState;
    try {
        // T189: the page calls buildCheckoutStateModel(key, labor, service, timeSwitched) (qr.html, the quote panel); the bridge passes the same four.
        checkoutState = engine.buildCheckoutStateModel(quote.checkoutStateKey, quote.laborEstimate, svc || null, quote.checkoutStateSource === 'added_time');
    } catch (err) {
        console.error(`buildCheckoutStateModel threw: ${err.message}`);
        process.exit(1);
    }

    const result = Object.assign({}, quote, {
        disclaimerText: checkoutState.disclaimerText,
        btnText: checkoutState.btnText || quote.btnText,
    });
    console.log(JSON.stringify(result));
}

if (require.main === module) {
    main();
}

module.exports = { extractEngine, loadEngine, FUNCTION_NAMES };
