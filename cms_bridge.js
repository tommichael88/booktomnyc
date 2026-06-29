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
    'resolveForceModules',
    'applyLiveConfidenceEscalation',
    'deriveComplexityTier',
    'applyPricingFormula',
    'computeUnifiedQuote',
    'resolveCheckoutState',
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
    'extractObject',
    'extractQty',
    'extractLocation',
    'extractSizeHint',
    'resolveGroupFromIntent',
    'isServiceVerb',
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
    const pattern = new RegExp(`const\\s+${constName}\\s*=[^\\n]*;`);
    const m = pattern.exec(src);
    return m ? m[0] : null;
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
const DUPLICATED_FUNCTIONS_PREFER_LAST = new Set(['extractObject', 'extractQty', 'extractLocation']);

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
    const html = fs.readFileSync(qrHtmlPath, 'utf8');

    // Fix for bug #1 above: search EVERY <script>...</script> block, not
    // just the first one. computeUnifiedQuote and most of the engine live
    // in the second block; resolveDynamicService/resolveEngineKey/
    // resolveServiceBadge live in the first. A future qr.html refactor that
    // consolidates these into one script block (see CHANGELOG_v9.3.md's
    // note on this exact split) won't break this — it'll just find
    // everything in one block instead of two.
    const scriptBlocks = [];
    const scriptRe = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g;
    let sm;
    while ((sm = scriptRe.exec(html)) !== null) {
        scriptBlocks.push(sm[1]);
    }
    if (scriptBlocks.length === 0) {
        throw new Error('No <script> blocks found in qr.html');
    }
    const allScripts = scriptBlocks.join('\n');

    const blocks = [];
    const missing = [];

    // v9.5: plain literal consts (regex/object literals) needed by extractQty.
    for (const name of PLAIN_CONST_NAMES) {
        const block = findPlainConst(allScripts, name);
        if (block === null) {
            missing.push(name);
        } else {
            blocks.push(block);
        }
    }

    // v9.5: arrow-const accessor helpers (_SKIP_WORDS etc.) needed by the
    // NLP analysis functions — extracted first so they're defined before
    // any function below that calls them.
    for (const name of ARROW_CONST_NAMES) {
        const block = findArrowConst(allScripts, name);
        if (block === null) {
            missing.push(name);
        } else {
            blocks.push(block);
        }
    }

    for (const fn of FUNCTION_NAMES) {
        const block = findFunctionBlock(allScripts, fn);
        if (block === null) {
            missing.push(fn);
        } else {
            blocks.push(block);
        }
    }
    if (missing.length) {
        throw new Error(
            `Could not find the following function(s)/const(s) in qr.html: ${missing.join(', ')}. ` +
            `qr.html's structure may have changed — update FUNCTION_NAMES/ARROW_CONST_NAMES in cms_bridge.js, ` +
            `or check whether these were renamed/removed (see qr.html's own CHANGELOG entries).`
        );
    }

    const engineCode = blocks.join('\n\n') + `
module.exports = { ${FUNCTION_NAMES.join(', ')} };
`;
    return engineCode;
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
        window: { DB: config }, // resolveDynamicService reads window.DB directly
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
        checkoutState = engine.resolveCheckoutState(quote.checkoutStateKey, quote.laborEstimate);
    } catch (err) {
        console.error(`resolveCheckoutState threw: ${err.message}`);
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
