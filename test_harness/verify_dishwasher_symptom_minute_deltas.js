#!/usr/bin/env node
/**
 * verify_dishwasher_symptom_minute_deltas.js
 *
 * Regression test for a real, severe, precisely-diagnosed bug: a real,
 * specific, external diagnosis correctly identified that
 * dishwasher_repair's price was "collapsing" to the static midpoint of
 * its authored default_estimates.total_minutes range (70-390 ->
 * (70+390)/2 = 230 minutes), regardless of which real symptom the
 * customer actually selected on the service's own, real, already-wired
 * `symptom` intake module — because every one of that module's 4 real
 * options carried `minutes: 0`.
 *
 * Confirmed via direct trace this is the EXACT mechanism already found
 * twice this session (damage_type, dmg_size) — a real question exists,
 * looks like it should narrow the estimate, and structurally does
 * nothing because its content was never authored with real deltas.
 *
 * Fixed by authoring real, defensible minute deltas for each symptom,
 * grounded in the catalog's own, already-real complexity-tier
 * boundaries (routine: 0-45min, specialized: 91+min) rather than
 * invented numbers — reusing the EXISTING, already-wired mechanism
 * (computeUnifiedQuote already reads answers[mod.moduleKey].effects.minutes)
 * rather than building a new, parallel "symptom_modifiers" structure.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
// T147: functions declared in the three engine modules are loaded WHOLE (the T136 `_engine.js` loader), so a helper or resolver added next to a function can no longer
// drop out of this sandbox ("X is not defined" -- noise unrelated to what this test asserts). Anything else is still extracted by name, below.
const { engineAwareFindFn } = require('./_engine.js');
const findFn = engineAwareFindFn(_cherryPickFn);

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML = require('./_page.js').readPage(path.join(REPO_ROOT, 'qr.html'));
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

function _cherryPickFn(name) {
    const m = QR_HTML.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) return null;
    let depth = 0, start = m.index, i = m.index + m[0].length - 1;
    for (let j = i; j < QR_HTML.length; j++) {
        if (QR_HTML[j] === '{') depth++;
        else if (QR_HTML[j] === '}') { depth--; if (depth === 0) return QR_HTML.slice(start, j + 1); }
    }
    return null;
}

const FNS = ['resolveDynamicService', 'resolveBaseConfidenceStrategy', 'resolveServiceCheckoutStateKey', 
    'applyLiveConfidenceEscalation', 'deriveComplexityTier', 'applyPricingFormula',
    'buildCheckoutStateModel', 'sqTagLabel', 'tagValidForCategory', 'resolveEngineKey',
    'resolveServiceBadge', 'computeUnifiedQuote'];
const code = FNS.map(findFn).join('\n\n');
const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'dishwasher_symptom_fix' });

console.log('=== The real symptom module now carries genuinely real, non-zero minute deltas ===');
{
    const mod = DB.intake_modules.symptom;
    const mods = DB.global_rules.modifiers;
    const allNonZero = mod.client_response.every(r => {
        const m = r.modifier_ref ? mods[r.modifier_ref] : r.effects;
        return (m?.minutes || 0) > 0;
    });
    check('every real symptom option now has a non-zero, authored minutes delta', allNonZero);
}

console.log('\n=== Real, complete, end-to-end test: each real symptom produces a genuinely distinct, sensible price ===');
{
    const svc = DB.services.find(s => s.id === 'dishwasher_repair');
    const results = {};
    for (const opt of DB.intake_modules.symptom.client_response) {
        const r = sandbox.computeUnifiedQuote({ svc, activeTagIds: [], answers: { symptom: opt.label }, qty: 1 });
        results[opt.label] = r.laborEstimate;
    }
    const prices = Object.values(results);
    const uniquePrices = new Set(prices);
    check(`the 4 real symptoms produce more than 1 distinct price (found ${uniquePrices.size} distinct values, confirming the collapse is genuinely fixed)`, uniquePrices.size > 1);

    const spinLabel = DB.intake_modules.symptom.client_response[0].label;
    const drainLabel = DB.intake_modules.symptom.client_response[1].label;
    const leakLabel = DB.intake_modules.symptom.client_response[2].label;
    check('a simple symptom ("won\'t spin") prices lower than a complex one ("leaking water")',
        results[spinLabel] < results[leakLabel]);
    check('"won\'t drain" (specialized) prices higher than "won\'t spin" (routine)',
        results[drainLabel] > results[spinLabel]);
}

console.log(`\n[dishwasher_repair symptom minute-delta verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
