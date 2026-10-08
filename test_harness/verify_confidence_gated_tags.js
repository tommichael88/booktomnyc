#!/usr/bin/env node
/**
 * verify_confidence_gated_tags.js
 *
 * Tests the core mechanism:
 *   - detTagIds only affect price if meetsConfidenceBar or _tagsAffirmed.
 *   - manTagIds and inherentTagIds always affect price.
 *   - Full tag set is used for display preview even when not chargeable.
 */
const fs = require('fs');
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

// Extract the computeQuoteFromState function and its dependencies.
// T143/T144: functions declared in the three engine modules are loaded WHOLE (the T136 `_engine.js` loader), so a helper added next to a
// function can no longer drop out of this sandbox ("X is not defined" -- noise unrelated to what this test asserts). Anything else is still
// extracted by name, below.
const { engineAwareFindFn } = require('./_engine.js');
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
const findFn = engineAwareFindFn(_cherryPickFn);

// Dependencies needed: computeQuoteFromState, computeUnifiedQuote, resolveDynamicService, etc.
const FNS = [
    'resolveDynamicService', 'resolveBaseConfidenceStrategy', 'resolveServiceCheckoutStateKey', 
    'applyLiveConfidenceEscalation', 'deriveComplexityTier', 'applyPricingFormula',
    'buildCheckoutStateModel', 'sqTagLabel', 'tagValidForCategory', 'resolveEngineKey',
    'resolveServiceBadge', 'computeUnifiedQuote', 'computeArchetypeQuote',
    'syncTagSynthesizedAnswers', 'computeQuoteFromState'
];
let code = FNS.map(findFn).filter(Boolean).join('\n\n');

// Add needed global stubs.
// NOTE: deliberately NOT embedding const DB/SERVICE_DATA/window/S declarations
// here. A vm-executed `const X = ...` creates a permanent, frozen lexical
// binding that the extracted functions close over -- reassigning sandbox.X
// from outside afterward does NOT reach it (this is a real, confirmed bug in
// an earlier version of this test: it silently always read an empty,
// placeholder S regardless of what was set on sandbox.S, making every check
// trivially pass against empty data rather than genuinely verifying
// anything). The sandbox object's own properties are what the vm context's
// global scope actually resolves bare identifiers against; set them there
// (via plain assignment, not `const`) so later reassignment genuinely works.

const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console, S: { qty: 1, intent: null, stype: null, detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: [], answers: {}, _tagsAffirmed: false } };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'computeQuoteFromState' });

// Pick a service with known tags and base price.
const svc = DB.services.find(s => s.id === 'under_cabinet_light_install');
if (!svc) throw new Error('Test service not found');

console.log('=== Confidence-gated tags: detTagIds are gated by confidence/affirmation ===');

// Setup a low-confidence scenario: set minimum_quote_confidence high.
// We'll force a low confidence by setting _matchConfidence low and no module gains.
// But we need to simulate a context where computeQuoteFromState will see a low confidence.
// Easiest: we can mock the confidence calculation by directly setting S.intent._matchConfidence = 0
// and ensure no other confidence sources are present.
// We'll also set a high minConf on the service's confidence_strategy for the test.

// We'll create a temporary modified service with a high minConf.
const testSvc = JSON.parse(JSON.stringify(svc));
testSvc.confidence_strategy = { minimum_quote_confidence: 99, base_confidence: 10 };

// Replace the service in DB for this test.
const origServices = DB.services;
DB.services = DB.services.map(s => s.id === testSvc.id ? testSvc : s);

// Test 1: detTagIds present, low confidence, not affirmed -> should NOT be chargeable.
sandbox.S = {
    qty: 1,
    intent: { key: 'test', category: 'electric_lighting', label: 'Test' },
    stype: 'Install',
    detTagIds: ['#brick_wall'],
    manTagIds: [],
    negatedTagIds: [],
    inherentTagIds: [],
    answers: {},
    _tagsAffirmed: false,
    _svc: testSvc,
    _fromBuilder: false,
    _curatedMode: false,
};
const q1 = sandbox.computeQuoteFromState(sandbox.S);
check('detTagIds not chargeable when low confidence and not affirmed',
    q1.detTagsChargeable === false && !q1.activeTagIds.includes('#brick_wall'));
check('the full tag set is still exposed for display preview even when not chargeable',
    q1.allTagIds.includes('#brick_wall'));

// Test 2: affirm -> detTagIds should become chargeable.
sandbox.S._tagsAffirmed = true;
const q2 = sandbox.computeQuoteFromState(sandbox.S);
check('after affirmation, detTagIds become chargeable',
    q2.detTagsChargeable === true && q2.activeTagIds.includes('#brick_wall'));

// Test 3: high confidence (meetsConfidenceBar true) charges detTagIds even without affirmation.
sandbox.S._tagsAffirmed = false;
sandbox.S.intent._matchConfidence = 100;
testSvc.confidence_strategy = { minimum_quote_confidence: 10, base_confidence: 50 };
const q3 = sandbox.computeQuoteFromState(sandbox.S);
check('high confidence (meetsConfidenceBar true) makes detTagIds chargeable even without affirmation',
    q3.meetsConfidenceBar === true && q3.detTagsChargeable === true && q3.activeTagIds.includes('#brick_wall'));

// Test 4: manual tags are always in the chargeable set, regardless of confidence/affirmation.
testSvc.confidence_strategy = { minimum_quote_confidence: 99, base_confidence: 10 };
sandbox.S.detTagIds = [];
sandbox.S.manTagIds = ['#brick_wall'];
sandbox.S._tagsAffirmed = false;
sandbox.S.intent._matchConfidence = 0;
const q4 = sandbox.computeQuoteFromState(sandbox.S);
check('manual tags are always chargeable regardless of confidence gating',
    q4.activeTagIds.includes('#brick_wall'));

// Restore DB.
DB.services = origServices;

console.log(`\n[Confidence-gated tags] ${pass} passed, ${fail} failed (of ${pass+fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
