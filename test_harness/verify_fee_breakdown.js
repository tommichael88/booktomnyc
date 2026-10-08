#!/usr/bin/env node
/**
 * verify_fee_breakdown.js
 *
 * Checks that the feeBreakdown array (a real feature that had a test
 * written for it but was never actually implemented anywhere in the code)
 * is correctly populated -- giving customers genuine transparency into
 * exactly where each dollar of their quote comes from.
 *
 * Adapted from the original test's premise: it assumed fees come directly
 * from smart_tags (activeTagIds), each contributing its own {tagId, label,
 * fee} entry. Confirmed system-wide this session that this is no longer
 * how fees actually work -- tags carry zero direct fees (retired in v9.5,
 * see any smart_tag's own SSOT note, e.g. #emergency's), replaced by
 * per-answer modifier_ref as the real, current mechanism (e.g. the
 * "urgency" module's real $50 fee). feeBreakdown is built at each of the
 * 4 real fee sources in computeUnifiedQuote: contextual_override
 * adjustments, pricing formula results, legacy tag fees (kept for
 * backward compat, though currently dormant catalog-wide), and -- the
 * primary, current source -- per-answer modifier_ref fees.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
// T147: functions declared in the three engine modules are loaded WHOLE (the T136 `_engine.js` loader), so a helper or resolver added next to a function can no longer
// drop out of this sandbox ("X is not defined" -- noise unrelated to what this test asserts). Anything else is still extracted by name, below.
const { engineAwareFindFn } = require('./_engine.js');
const findFn = engineAwareFindFn(_cherryPickFn);

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

const FNS = [
    'resolveDynamicService', 'resolveBaseConfidenceStrategy', 'resolveServiceCheckoutStateKey', 
    'applyLiveConfidenceEscalation', 'deriveComplexityTier', 'applyPricingFormula',
    'buildCheckoutStateModel', 'sqTagLabel', 'tagValidForCategory', 'resolveEngineKey',
    'resolveServiceBadge', 'computeUnifiedQuote', 'computeArchetypeQuote'
];
const code = FNS.map(findFn).filter(Boolean).join('\n\n');
const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'fee_breakdown' });

console.log('=== feeBreakdown array is present and correctly populated ===');

const svc = DB.services.find(s => s.id === 'under_cabinet_light_install');
if (!svc) throw new Error('Service not found');

// 1. With a real, current fee-bearing answer (urgency's real $50 modifier_ref fee).
const result = sandbox.computeUnifiedQuote({
    svc, dynDef: null, activeTagIds: [],
    answers: { urgency: 'Urgent — today or tomorrow' },
    qty: 1
});

check('feeBreakdown is present', typeof result.feeBreakdown !== 'undefined');
check('feeBreakdown is an array', Array.isArray(result.feeBreakdown));
check('feeBreakdown has exactly one entry for the one fee-bearing answer', result.feeBreakdown.length === 1);

if (result.feeBreakdown.length) {
    const entry = result.feeBreakdown[0];
    check('the entry has source, label, fee', typeof entry.source === 'string' && typeof entry.label === 'string' && typeof entry.fee === 'number');
    check('the entry correctly identifies this as an answer-level fee', entry.source === 'answer' && entry.moduleKey === 'urgency');
    check('the fee matches the real, authored modifier value ($50)', entry.fee === 50);
    check('the label includes the actual question and chosen answer (real transparency, not a generic placeholder)',
        entry.label.includes('How soon') && entry.label.includes('Urgent'));
}

// 2. Sum of feeBreakdown entries equals extraFee + perVisitFee (T118:
// feeBreakdown includes every answer-driven fee regardless of scope,
// but extraFee alone is now only the per_unit bucket -- perVisitFee is
// the new, separate bucket. See PENDING_DECISIONS.md #29's fix.)
const sumFees = result.feeBreakdown.reduce((s, e) => s + e.fee, 0);
check('sum of feeBreakdown entries equals extraFee + perVisitFee', sumFees === result.extraFee + result.perVisitFee);

// 3. With no fee-bearing answers -- empty array, not undefined/null.
const resultNoFees = sandbox.computeUnifiedQuote({ svc, dynDef: null, activeTagIds: [], answers: {}, qty: 1 });
check('feeBreakdown is an empty array (not missing) when nothing applies', Array.isArray(resultNoFees.feeBreakdown) && resultNoFees.feeBreakdown.length === 0);

// 4. Multiple fee-bearing answers each get their own entry.
// T118: was `access` -- removed catalog-wide (explicit operator
// decision: not a meaningful, price-changing question for residential
// handyman work). disposal_request carries the identical $25 fee.
const dishwasherSvc = DB.services.find(s => s.id === 'dishwasher_repair');
const multiResult = sandbox.computeUnifiedQuote({
    svc: dishwasherSvc, dynDef: null, activeTagIds: [],
    answers: { disposal_request: 'Yes, please haul it away' },
    qty: 1
});
check('a real, separate service with its own fee-bearing answer also populates feeBreakdown correctly',
    multiResult.feeBreakdown.length === 1 && multiResult.feeBreakdown[0].fee === 25);

console.log(`\n[Fee breakdown] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
