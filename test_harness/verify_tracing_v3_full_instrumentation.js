#!/usr/bin/env node
/**
 * verify_tracing_v3_full_instrumentation.js
 *
 * A direct, serious response to a pointed challenge: prior tracing
 * (T98, T104) logged internal pipeline state but never (a) what the
 * customer actually did, tap by tap and input by input, or (b) what
 * actually rendered on their screen as a result -- distinct from the
 * internal data that produced it. Built as this turn's entire focus,
 * per explicit instruction, before any further bug-by-bug patching.
 *
 * Tested functionally with a real jsdom DOM wherever the claim is
 * about real interaction/rendering behavior, not just that
 * right-shaped code exists near the right place.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const REPO_ROOT = path.join(__dirname, '..');
const QR_HTML = require('./_page.js').readPage(path.join(REPO_ROOT, 'qr.html'));
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

function findFn(name) {
    const m = QR_HTML.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) throw new Error(`Could not find function: ${name}`);
    let depth = 0, start = m.index, i = m.index + m[0].length - 1;
    for (let j = i; j < QR_HTML.length; j++) {
        if (QR_HTML[j] === '{') depth++;
        else if (QR_HTML[j] === '}') { depth--; if (depth === 0) return QR_HTML.slice(start, j + 1); }
    }
}
function findConst(name) {
    const m = QR_HTML.match(new RegExp('const ' + name + ' = [^;]+;'));
    return m ? m[0] : '';
}

console.log('=== 1. Global interaction capture: a real click and a real settled text input, in a real DOM ===');
const dom = new JSDOM(`<!DOCTYPE html><div id="root"><button data-mod="install_type" data-label="New holes required">New holes required</button><textarea class="sq-ic-notes"></textarea></div>`);
const { document, window: jsdomWindow } = dom.window ? dom : { document: dom.window.document, window: dom.window };
const TRACE_FNS = ['_trace', '_traceStart', '_traceExport', '_traceToggle', '_traceNarrative', '_describeInteractionTarget', '_initGlobalInteractionTracing', '_traceDomSnapshot'];
const sandbox = {
    DB, console,
    window: dom.window, document: dom.window.document,
};
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(findConst('QR_BUILD_VERSION') + '\n' + findFn('_simpleHash') + '\n' + TRACE_FNS.map(findFn).join('\n\n'), sandbox);
sandbox.window._traceEnabled = true;
sandbox.window._traceLog = [];
sandbox.window._traceInput = null;
sandbox._initGlobalInteractionTracing();

const btn = sandbox.document.querySelector('button');
btn.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
check('a real click on a real button was captured, with zero hand-instrumentation of this specific button',
    sandbox.window._traceLog.some(e => e.layer === 'user_interaction' && e.label === 'click' && e.data.data?.mod === 'install_type'));

const ta = sandbox.document.querySelector('.sq-ic-notes');
ta.value = '100 knobs, all new holes, apartment building';
ta.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
check('a real, settled textarea value was captured on change (not per-keystroke)',
    sandbox.window._traceLog.some(e => e.layer === 'user_interaction' && e.label === 'input_settled' && e.data.value.includes('100 knobs')));

console.log('\n=== 2. DOM snapshot: real, visible content extracted from a real, constructed card ===');
const cardHtml = `
<div class="sq-ic-card">
  <div class="sq-ic-nlp-chip">Brick or concrete</div>
  <div class="sq-ic-q"><div class="sq-ic-q-lbl">What kind of wall?</div>
    <div class="sq-ic-grid"><button class="sq-ic-btn sel"><span>Brick or concrete</span></button><button class="sq-ic-btn"><span>Drywall</span></button></div>
  </div>
  <div class="ql"><span class="qll">Base repair</span><span class="qlv">$70</span></div>
  <button class="ctap">Add to Cart – $245</button>
</div>
<div id="sqAdlibSentence">I need to repair my wall because it is cracked</div>`;
sandbox.document.body.innerHTML = cardHtml;
sandbox.window._traceLog = [];
sandbox._traceDomSnapshot('test snapshot');
const snap = sandbox.window._traceLog.find(e => e.layer === 'dom_snapshot');
check('DOM snapshot captured the real "We Understood" chip text', !!snap && snap.data.weUnderstoodChips.includes('Brick or concrete'));
check('DOM snapshot captured the real question label and which option is actually selected',
    !!snap && snap.data.questions[0].label.includes('What kind of wall') && snap.data.questions[0].selectedOption === 'Brick or concrete');
check('DOM snapshot captured the real, visible price line as displayed', !!snap && snap.data.priceLines.some(l => l.label === 'Base repair' && l.value === '$70'));
check('DOM snapshot captured the real, visible adlib sentence text', !!snap && snap.data.adlibText.includes('repair my wall'));
check('DOM snapshot captured the real, visible add-to-cart button label', !!snap && snap.data.addToCartLabel.includes('Add to Cart'));

console.log('\n=== 3. Friction: computed exactly per the Charter\'s own formula (Friction = max(0, threshold - confidence)) ===');
const PRICING_FNS = ['syncTagSynthesizedAnswers', '_isModVisible',
    'resolveDynamicService', 'entityHasOwnQtyQuestion', 'resolveBaseConfidenceStrategy', 'resolveServiceCheckoutStateKey', 
    'applyLiveConfidenceEscalation', 'deriveComplexityTier', 'applyPricingFormula',
    'buildCheckoutStateModel', 'sqTagLabel', 'tagValidForCategory', 'resolveEngineKey',
    'resolveServiceBadge', 'computeUnifiedQuote', 'computeArchetypeQuote', 'computeQuoteFromState'];
const pricingSandbox = { DB, window: { DB, _traceEnabled: true, _traceLog: [], _traceInput: null }, console };
pricingSandbox.global = pricingSandbox;
vm.createContext(pricingSandbox);
vm.runInContext(findConst('QR_BUILD_VERSION') + '\n' + findFn('_simpleHash') + '\n' + TRACE_FNS.map(findFn).join('\n\n') + '\nconst _GENERIC_QTY_MODULE_KEYS = new Set([\'item_count\', \'count\', \'hybrid_qty\', \'global_quantity\']);\n' + PRICING_FNS.map(findFn).join('\n\n'), pricingSandbox);
const svc = DB.services.find(s => s.id === 'cabinet_door_or_drawer_adjustment');
pricingSandbox.S = {
    qty: 1, intent: { key: svc.id, category: svc.ui_taxonomy?.category, label: 'Test' },
    stype: 'Repair', detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: [],
    answers: {}, _tagSynthesizedModules: {}, _tagsAffirmed: true, _svc: svc,
};
const q = pricingSandbox.computeQuoteFromState(pricingSandbox.S);
const pricingEntry = pricingSandbox.window._traceLog.find(e => e.layer === 'pricing_engine');
check('friction and frictionThreshold are both present as real, explicit trace fields',
    pricingEntry && typeof pricingEntry.data.friction === 'number' && typeof pricingEntry.data.frictionThreshold === 'number');
check('friction genuinely equals max(0, threshold - confidence), not an arbitrary or inverted number',
    pricingEntry.data.friction === Math.max(0, pricingEntry.data.frictionThreshold - pricingEntry.data.totalConfidence));

console.log('\n=== 4. Export: friction surfaced in the compact summary, not just buried in the raw log ===');
const exported = JSON.parse(pricingSandbox._traceExport());
check('summary.friction is present at the top level', typeof exported.summary.friction === 'number');
check('summary.frictionThreshold is present at the top level', typeof exported.summary.frictionThreshold === 'number');
check('a narrative array is present, giving a plain-English account without requiring the reader to parse the raw log',
    Array.isArray(exported.narrative) && exported.narrative.some(l => l.includes('Price computed')));

console.log(`\n[tracing v3 full instrumentation] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
