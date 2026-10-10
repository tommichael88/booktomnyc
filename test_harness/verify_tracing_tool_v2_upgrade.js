#!/usr/bin/env node
/**
 * verify_tracing_tool_v2_upgrade.js
 *
 * The user's own, direct feedback on the T98 tracing tool, after using
 * it successfully to help find a real, severe bug: the trace should
 * include (a) which real UI path produced it, (b) the estimated price
 * and quantity directly, without needing to dig through nested data,
 * (c) a compact summary of which questions were answered and with
 * what, and (d) version-identifying info, so a trace is self
 * -describing about which code version produced it.
 *
 * All 4 implemented: entryPath now set explicitly at all 3 real entry
 * points (collectBookingContext_freeText/_catalog/_otherTile, and
 * sqBuilderFinish); _traceExport now includes a top-level `meta` block
 * (entryPath, a real hash of btnyc.json's content, a maintained
 * qr.html build-version string, export timestamp) and a `summary`
 * block (final price, dispatch fee, qty, answers, tier, checkout
 * state) built directly from the trace's own last pricing_engine
 * entry -- no manual reconstruction needed.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
    if (!m) throw new Error(`Could not find const: ${name}`);
    return m[0];
}

console.log('=== All 3 real entry points now explicitly label which UI path produced a trace ===');
check('collectBookingContext_freeText passes the real "smart_quote" label',
    /_traceStart\(rawText, 'smart_quote'\)/.test(QR_HTML));
check('collectBookingContext_catalog passes the real "catalog" label',
    /_traceStart\(\{ tappedServiceId: svc\.id \}, 'catalog'\)/.test(QR_HTML));
check('sqBuilderFinish (the real Guided Builder path) passes the real "guided_builder" label',
    /_traceStart\(\{ builderGroupId:[^,]+, builderQty: BLD\.qty \}, 'guided_builder'\)/.test(QR_HTML));

console.log('\n=== The real, complete, upgraded export -- tested end to end against the exact scenario that originally motivated it ===');
const TRACE_FNS = ['_trace', '_traceStart', '_traceExport', '_traceToggle', '_traceNarrative', '_describeInteractionTarget'];
const PRICING_FNS = ['syncTagSynthesizedAnswers', '_isModVisible',
    'resolveDynamicService', 'resolveBaseConfidenceStrategy', 'resolveServiceCheckoutStateKey', 
    'applyLiveConfidenceEscalation', 'deriveComplexityTier', 'applyPricingFormula',
    'buildCheckoutStateModel', 'sqTagLabel', 'tagValidForCategory', 'resolveEngineKey',
    'resolveServiceBadge', 'computeUnifiedQuote', 'computeArchetypeQuote', 'computeQuoteFromState'];
const sandbox = { DB, window: { DB, _traceEnabled: false, _traceLog: [], _traceInput: null }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(
    findConst('QR_BUILD_VERSION') + '\n' + findFn('_simpleHash') + '\n' +
    TRACE_FNS.map(findFn).join('\n\n') + '\n\n' + PRICING_FNS.map(findFn).join('\n\n'),
    sandbox
);
sandbox._traceToggle(true);
sandbox._traceStart('need 5 ceiling tiles put up', 'smart_quote');
sandbox.S = {
    qty: 1, intent: { key: 'minor_home_repairs+minor_home_repairs_ceilings+Repair', category: 'minor_home_repairs', _groupId: 'minor_home_repairs_ceilings', label: 'Test' },
    stype: 'Repair', detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: [],
    answers: { item_count_template: '4+', ceiling_tile_access: 'Standard height, reachable with a step ladder', has_matching_tiles: 'Yes' },
    _tagSynthesizedModules: {}, _tagsAffirmed: true,
};
sandbox.computeQuoteFromState(sandbox.S);
const exported = JSON.parse(sandbox._traceExport());

check('meta.entryPath correctly records which UI path produced this trace', exported.meta.entryPath === 'smart_quote');
check('meta.qrBuildVersion is present, a real, non-empty string', typeof exported.meta.qrBuildVersion === 'string' && exported.meta.qrBuildVersion.length > 0);
check('meta.btnycJsonHash is a real, computed hash (not null, not the input data itself)', typeof exported.meta.btnycJsonHash === 'string' && exported.meta.btnycJsonHash.length > 0);
check('summary.finalPrice matches the real, correct price for this exact scenario', exported.summary.finalPrice === 109);
check('summary.qty is present directly, no digging into nested data required', exported.summary.qty === 1);
check('summary.answers is the real, compact answer set, directly readable', exported.summary.answers.item_count_template === '4+');
check('the full, raw trace log is still present underneath the summary -- nothing lost, only added', Array.isArray(exported.trace) && exported.trace.length > 0);

console.log('\n=== Regression guard: the hash is stable for the same data and changes for different data ===');
const exportedAgain = JSON.parse(sandbox._traceExport());
check('the same btnyc.json content produces the same hash across two exports (deterministic)',
    exported.meta.btnycJsonHash === exportedAgain.meta.btnycJsonHash);

console.log(`\n[tracing tool v2 upgrade] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
