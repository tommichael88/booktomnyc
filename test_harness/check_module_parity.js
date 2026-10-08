/**
 * check_module_parity.js
 *
 * RECONSTRUCTED FILE — genuinely missing from the recovered baseline (not
 * present in /mnt/project/ nor findable in project knowledge search). Built
 * from its fully-specified contract: three real call sites
 * (verify_pricing_engine_module.js, verify_nlp_engine_module.js,
 * verify_orchestrator_engine_module.js) already destructure
 * `{ checkParity, printReport } = require('./check_module_parity.js')` and
 * call `checkParity({ modulePath, functionNames, preferFirst })`, and
 * TIMELINE.md's T22/T23 entries describe its purpose precisely: "a real,
 * shared, reusable tool that diffs a committed module's functions against
 * the live qr.html". Flagged here rather than silently presented as the
 * original — if the real original resolved multi-occurrence ambiguity
 * differently than the `preferFirst`-else-"any occurrence matches" rule
 * below, that would only ever show up as a parity check being MORE lenient
 * than intended, never as a false failure against real, correct code.
 *
 * Usage:
 *   const { checkParity, printReport } = require('./check_module_parity.js');
 *   const result = checkParity({ modulePath, functionNames, preferFirst });
 *   const ok = printReport(result, 'pricing_engine.js');
 */
const fs = require('fs');
const path = require('path');

// Extracts the full source of `function NAME(...) { ... }` starting at each
// match of `function NAME(`, via brace-depth counting — the same pattern
// used throughout this project's own verify_*.js files (e.g.
// verify_no_module_drift.js's findFn, verify_tile_drywall_formula_wiring.js's
// findFn) for exactly this purpose. Returns ALL occurrences, not just one.
function findAllFnOccurrences(src, name) {
    const results = [];
    const re = new RegExp('function\\s+' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\([^)]*\\)\\s*\\{', 'g');
    let m;
    while ((m = re.exec(src)) !== null) {
        const start = m.index;
        let depth = 0;
        let i = m.index + m[0].length - 1; // position of the opening '{'
        for (let j = i; j < src.length; j++) {
            if (src[j] === '{') depth++;
            else if (src[j] === '}') {
                depth--;
                if (depth === 0) {
                    results.push(src.slice(start, j + 1));
                    break;
                }
            }
        }
        // Avoid infinite loop on a pathological/unterminated match.
        if (re.lastIndex <= m.index) re.lastIndex = m.index + 1;
    }
    return results;
}

function normalize(s) {
    // Whitespace-insensitive comparison only — never touches identifiers,
    // string/number literals, or logic. Two functions that differ only in
    // indentation (e.g. one extracted from a deeper <script> nesting level)
    // should not be reported as stale.
    return s.replace(/\s+/g, ' ').trim();
}

/**
 * @param {Object} opts
 * @param {string} opts.modulePath - absolute path to the committed standalone module (e.g. PROJECT_ROOT/pricing_engine.js)
 * @param {string[]} opts.functionNames - function names to check
 * @param {Set<string>} [opts.preferFirst] - when a function name has multiple
 *   occurrences live in qr.html, compare against the FIRST occurrence for
 *   names in this set. For names not in this set, if the committed module's
 *   version normalizes-equal to ANY live occurrence, it's treated as current
 *   (the check's purpose is "is this still live somewhere in qr.html", and
 *   unrelated same-named helpers elsewhere in the file shouldn't produce a
 *   false-stale result).
 * @returns {{ ok: string[], stale: {name:string, moduleSrc:string, qrSrc:string}[], missingInModule: string[], missingInQr: string[] }}
 */
function checkParity({ modulePath, functionNames, preferFirst }) {
    preferFirst = preferFirst || new Set();
    const moduleDir = path.dirname(modulePath);
    const qrPath = path.join(moduleDir, 'qr.html');

    const moduleSrc = fs.readFileSync(modulePath, 'utf8');
    const qrSrc = fs.readFileSync(qrPath, 'utf8');

    const result = { ok: [], stale: [], missingInModule: [], missingInQr: [] };

    for (const name of functionNames) {
        const moduleOccs = findAllFnOccurrences(moduleSrc, name);
        const qrOccs = findAllFnOccurrences(qrSrc, name);

        if (moduleOccs.length === 0) {
            result.missingInModule.push(name);
            continue;
        }
        if (qrOccs.length === 0) {
            result.missingInQr.push(name);
            continue;
        }

        const moduleNorm = normalize(moduleOccs[0]);

        let matched;
        if (preferFirst.has(name)) {
            matched = normalize(qrOccs[0]) === moduleNorm;
        } else {
            matched = qrOccs.some(occ => normalize(occ) === moduleNorm);
        }

        if (matched) {
            result.ok.push(name);
        } else {
            result.stale.push({
                name,
                moduleSrc: moduleOccs[0],
                qrSrc: preferFirst.has(name) ? qrOccs[0] : qrOccs[0],
            });
        }
    }

    return result;
}

function printReport(result, label) {
    const total = result.ok.length + result.stale.length + result.missingInModule.length + result.missingInQr.length;
    console.log(`\n  Module parity (${label} vs live qr.html): ${result.ok.length}/${total} functions current`);
    for (const name of result.missingInModule) {
        console.log(`  ✗ ${name}: not found in ${label} (committed module)`);
    }
    for (const name of result.missingInQr) {
        console.log(`  ✗ ${name}: not found in live qr.html`);
    }
    for (const entry of result.stale) {
        console.log(`  ✗ ${entry.name}: STALE — ${label}'s copy no longer matches qr.html's live version`);
    }
    const ok = result.stale.length === 0 && result.missingInModule.length === 0 && result.missingInQr.length === 0;
    return ok;
}

module.exports = { checkParity, printReport, findAllFnOccurrences, normalize };
