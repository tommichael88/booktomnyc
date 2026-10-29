#!/usr/bin/env node
/**
 * verify_no_module_drift.js
 *
 * _resolveIntakeChain is intentionally duplicated in both pricing_engine.js
 * and orchestrator_engine.js (each module needs it and neither imports from
 * the other, avoiding a circular/cross-module dependency for one shared
 * helper). Currently byte-identical, but nothing previously enforced that --
 * a fix applied to one copy without the other would silently drift, exactly
 * the class of bug this project has hit before (T-many "looked wired,
 * wasn't" findings). This is a permanent guard, not a one-time check.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.dirname(__dirname);
let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

function findFn(src, name) {
    const m = src.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) return null;
    let depth = 0, start = m.index, i = m.index + m[0].length - 1;
    for (let j = i; j < src.length; j++) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(start, j + 1); }
    }
    return null;
}

console.log('=== Known-intentional duplicate: _resolveIntakeChain (pricing_engine.js / orchestrator_engine.js) ===');
{
    const pe = fs.readFileSync(path.join(REPO_ROOT, 'pricing_engine.js'), 'utf8');
    const oe = fs.readFileSync(path.join(REPO_ROOT, 'orchestrator_engine.js'), 'utf8');
    const peFn = findFn(pe, '_resolveIntakeChain');
    const oeFn = findFn(oe, '_resolveIntakeChain');
    check('both copies exist', !!peFn && !!oeFn);
    check('both copies are byte-identical (no drift)', peFn === oeFn);
}

console.log(`\n[module drift verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
