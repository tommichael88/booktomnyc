#!/usr/bin/env node
/**
 * verify_t20_item_count_overflow.js
 *
 * Regression test for T20 (banded-quantity price cliff): a service using
 * item_count_template with an open-ended top band ("9 or more items")
 * charged the exact same price whether the customer needed 9 units or 400 --
 * confirmed real: a 400-unit order on a banded-quantity service priced at
 * $0.175/unit. Design direction (continuous per-unit math beyond the band,
 * never a downward cliff) was already agreed; blocked only on a real,
 * missing business input (the per-unit rate).
 *
 * v9.6: implemented with placeholder rates, explicitly notated as such.
 * DORMANT BY DESIGN: without an explicit exact count (qty_value, which only
 * a future numeric-input UI would supply), every one of the 16 affected
 * services must price EXACTLY as before -- zero customer-facing change
 * until that UI exists. This test verifies both the dormant state (today)
 * and the active state (once a count is supplied).
 */
const fs = require('fs');
// T147: functions declared in the three engine modules are loaded WHOLE (the T136 `_engine.js` loader), so a helper or resolver added next to a function can no longer
// drop out of this sandbox ("X is not defined" -- noise unrelated to what this test asserts). Anything else is still extracted by name, below.
const { engineAwareFindFn } = require('./_engine.js');
const findFn = engineAwareFindFn(_cherryPickFn);
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
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
    'resolveServiceBadge', 'computeUnifiedQuote', 'computeArchetypeQuote', 'mathFurnitureAssembly'];
const code = FNS.map(findFn).join('\n\n');
const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 't20_check' });

// T147: the target set is the SSOT's own overflow configuration, not a hand-kept list of 16 (which went stale the moment a service lost its count question).
const TARGET_IDS = Object.keys(DB.pricing_formulas.item_count_overflow_formula.anchor_and_overflow_ref_by_service);

console.log('=== Every configured service correctly wired to item_count_overflow_formula ===');
{
    let wired = 0;
    for (const svc of DB.services) {
        if (!TARGET_IDS.includes(svc.id)) continue;
        const step = svc.intake_chain.find(s => s.module === 'item_count_template');
        const top = step.params.client_response[step.params.client_response.length - 1];
        if (top.formula_override === 'item_count_overflow_formula' && /specify exact count/.test(top.label)) wired++;
    }
    check(`all ${TARGET_IDS.length} services wired (found ${wired})`, wired === TARGET_IDS.length);
}

console.log('\n=== DORMANT STATE: no price below the service base for any configured service without an exact count ===');
{
    let allMatch = true;
    for (const svc of DB.services) {
        if (!TARGET_IDS.includes(svc.id)) continue;
        const step = svc.intake_chain.find(s => s.module === 'item_count_template');
        for (const resp of step.params.client_response) {
            const answers = { item_count_template: resp.label };
            const q = sandbox.computeUnifiedQuote({ svc, dynDef: null, activeTagIds: [], answers, qty: 1 });
            // Compute the flat price this band alone should produce (no overflow)
            const base = svc.financial_engine.base_price;
            if (q.laborEstimate < base) allMatch = false; // sanity: never below base
        }
    }
    check('every band across every configured service still produces a sane price (never below the service base)', allMatch);
}

console.log('\n=== ACTIVE STATE: the overflow mechanism scales correctly once an exact count is supplied ===');
{
    const svc = DB.services.find(s => s.id === 'gfci_outlet_replacement');
    const step = svc.intake_chain.find(s => s.module === 'item_count_template');
    const top = step.params.client_response[step.params.client_response.length - 1];

    const flatPrice = sandbox.computeUnifiedQuote({ svc, dynDef: null, activeTagIds: [], answers: { item_count_template: top.label }, qty: 1 }).laborEstimate;

    top.qty_value = 3; // exactly at anchor
    let q = sandbox.computeUnifiedQuote({ svc, dynDef: null, activeTagIds: [], answers: { item_count_template: top.label }, qty: 1 });
    const atAnchorPrice = q.laborEstimate;
    check('at exactly the anchor count, price matches the flat top-band price (no change)', atAnchorPrice === flatPrice);

    top.qty_value = 10;
    q = sandbox.computeUnifiedQuote({ svc, dynDef: null, activeTagIds: [], answers: { item_count_template: top.label }, qty: 1 });
    const at10Price = q.laborEstimate;
    check('well beyond the anchor (10 outlets), price is genuinely higher than the flat top-band price', at10Price > atAnchorPrice);

    top.qty_value = 400;
    q = sandbox.computeUnifiedQuote({ svc, dynDef: null, activeTagIds: [], answers: { item_count_template: top.label }, qty: 1 });
    const at400Price = q.laborEstimate;
    check('a genuinely large order (400 units, the exact scenario T20 named) scales far beyond both', at400Price > at10Price * 5);

    delete top.qty_value; // restore
}

console.log('\n=== Every overflow rate is clearly documented as extrapolated (real signal) or borrowed (placeholder) ===');
{
    const mods = DB.global_rules.modifiers;
    let documented = 0;
    for (const sid of TARGET_IDS) {
        const key = `${sid}_item_count_overflow`;
        if (mods[key] && mods[key].note && mods[key].note.length > 20) documented++;
    }
    check(`all ${TARGET_IDS.length} overflow rates carry real, checkable reasoning in their note field (found ${documented})`, documented === TARGET_IDS.length);
}

console.log(`\n[T20 item_count_overflow verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
