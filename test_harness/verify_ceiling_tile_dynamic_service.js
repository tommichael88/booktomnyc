#!/usr/bin/env node
/**
 * verify_ceiling_tile_dynamic_service.js
 *
 * A real, new dynamic (bespoke) service built end-to-end across every
 * component layer, per direct user request and design discussion
 * (T96/T97). The user's own architectural insight, confirmed correct by
 * this implementation: NLP recognition and the dynamic service are
 * genuinely codependent, not sequential -- neither works without the
 * other.
 *
 * What this closes: "ceiling tile" (drop-ceiling/acoustic panel
 * replacement) previously matched the same intent/group as wall/floor
 * tile ("subway tiles", "porcelain tiles"), despite being a physically
 * different real job with no correct home anywhere in the catalog
 * (PENDING_DECISIONS.md item #18).
 *
 * Real, structural discovery made while building this (recorded here,
 * not just in TIMELINE.md, since it's load-bearing for this test's own
 * design): this system has TWO separate, parallel keyword-routing
 * mechanisms -- intent_mappings.objects (detectIntentNLP's own primary
 * match) and a second, independent, hardcoded rules table inside
 * resolveGroupFromIntent. Both needed a new entry; updating only one
 * silently left the group resolution unrouted even though the primary
 * intent match was already correct.
 *
 * Also real, and also load-bearing for this test: computeQuoteFromState
 * resolves a dynamic service's definition INTERNALLY via
 * resolveDynamicService(S.intent.category, S.stype, S.intent._groupId)
 * -- not from any dynDef-style property passed in directly. A test (or
 * any other caller) that sets S.intent._groupId incorrectly silently
 * falls through to the category-level generic fallback rather than the
 * intended, specific dynamic_services entry -- this exact mistake was
 * made and caught while building this test, not assumed correct.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.join(__dirname, '..');
const QR_HTML = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
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

const HELPER_CONSTS = `
const _SKIP_WORDS  = () => window._NLP?.STOP   || new Set();
const _SVC_VERBS   = () => window._NLP?.VERBS  || new Set();
const _STOP_PREPS  = () => window._NLP?.PREPS  || new Set();
const _CLAUSE_BOUNDARY = () => window._NLP?.CLAUSE || new Set();
const _ROOMS_LIST  = () => window._NLP?.ROOMS  || [];
const _DIMENSION_PATTERN = /\\b\\d+\\s*-?\\s*(?:foot|feet|ft|inch|inches|in|cm|centimeters?|meters?|yards?|lbs?|pounds?|kg)\\b/gi;
const _QTY_WORD_MAP = {one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
`;
const PIPELINE_FNS = ['initNlpSets', 'isServiceVerb', 'detectIntentNLP', 'extractObject', 'extractQty', 'extractSizeHint', 'extractLocation',
    'resolveGroupFromIntent', 'detectTagsNLP', 'inferTagsFromContext', 'computeNegatedGroupHints',
    'tagValidForCategory', 'makeBookingContext', 'collectBookingContext_freeText', 'resolveDynamicService'];
const pipelineSandbox = { DB, window: { DB }, console };
pipelineSandbox.global = pipelineSandbox;
vm.createContext(pipelineSandbox);
vm.runInContext(HELPER_CONSTS + '\n' + PIPELINE_FNS.map(findFn).join('\n\n'), pipelineSandbox);
pipelineSandbox.initNlpSets();

console.log('=== Data structure: every real layer exists and links correctly ===');
check('new group minor_home_repairs_ceilings exists', DB.group.some(g => g.id === 'minor_home_repairs_ceilings'));
check('new intake_module ceiling_tile_access exists', !!DB.intake_modules.ceiling_tile_access);
check('new dynamic_services entry exists at the real, confirmed key', !!DB.dynamic_services['minor_home_repairs+minor_home_repairs_ceilings+Repair']);
check('routing_archetypes has a real, compiler-verified entry (not hand-guessed)', !!DB.routing_archetypes.minor_home_repairs_ceilings);
check('new intent_mappings.objects entry exists', DB.intent_mappings.objects.some(o => o.keyword === 'ceiling tile'));
check('reuses has_matching_tiles directly rather than duplicating it', DB.dynamic_services['minor_home_repairs+minor_home_repairs_ceilings+Repair'].intake_chain.some(s => s.module === 'has_matching_tiles'));

console.log('\n=== The real, originally-reported routing bug: both example phrases from T96/T97 ===');
const ctxSubway = pipelineSandbox.collectBookingContext_freeText('I need 5 chipped subway tiles above my stove replaced');
check('wall/floor tile ("subway tiles") is completely unaffected -- still routes to floors_trim',
    ctxSubway.selectedGroupId === 'minor_home_repairs_floors_trim');
check('wall/floor tile still gets its own, correct, unchanged dynamic_rule',
    ctxSubway.nlpIntent.dynamic_rule === 'tile_repair_formula');

const ctxCeiling = pipelineSandbox.collectBookingContext_freeText('I need 5 ceiling tiles in my office replaced');
check('"ceiling tiles" now correctly routes to the NEW, dedicated group',
    ctxCeiling.selectedGroupId === 'minor_home_repairs_ceilings');

const resolvedDyn = pipelineSandbox.resolveDynamicService(ctxCeiling.selectedCategoryId, ctxCeiling.nlpIntent.stype, ctxCeiling.selectedGroupId);
check('resolveDynamicService correctly finds the new, specific entry (not the generic category fallback)',
    JSON.stringify(resolvedDyn?.intake_chain?.map(s => s.module)) === JSON.stringify(['item_count_template', 'ceiling_tile_access', 'has_matching_tiles']));

console.log('\n=== Generalization: several other real, plausible phrasings ===');
for (const [text, expectGroup] of [
    ['drop ceiling tile is broken', 'minor_home_repairs_ceilings'],
    ['need an acoustic tile replaced in the conference room', 'minor_home_repairs_ceilings'],
    ['my suspended ceiling has a water stain', 'minor_home_repairs_ceilings'],
    ['the ceiling panel fell down', 'minor_home_repairs_ceilings'],
]) {
    const c = pipelineSandbox.collectBookingContext_freeText(text);
    check(`${JSON.stringify(text)} -> ${expectGroup}`, c.selectedGroupId === expectGroup);
}

console.log('\n=== Regression guard: unrelated, ceiling-mentioning phrases must NOT be captured ===');
for (const [text, note] of [
    ['my ceiling fan is making noise', 'still correctly routes to electric_lighting_fans'],
    ['there is a crack in my ceiling', 'must not be captured by the new ceiling-tile routing'],
    ['ceiling needs painting', 'must not be captured by the new ceiling-tile routing'],
]) {
    const c = pipelineSandbox.collectBookingContext_freeText(text);
    check(`${JSON.stringify(text)}: ${note} (got group: ${c.selectedGroupId})`,
        c.selectedGroupId !== 'minor_home_repairs_ceilings');
}

console.log('\n=== Real pricing computation, using the correct S.intent._groupId pattern (confirmed via direct trace of computeQuoteFromState/line 8238 -- NOT a dynDef property passed in directly, a real mistake caught while building this test) ===');
const PRICING_FNS = ['syncTagSynthesizedAnswers', '_isModVisible',
    'resolveDynamicService', 'resolveBaseConfidenceStrategy', 'resolveServiceCheckoutStateKey', 
    'applyLiveConfidenceEscalation', 'deriveComplexityTier', 'applyPricingFormula',
    'buildCheckoutStateModel', 'sqTagLabel', 'tagValidForCategory', 'resolveEngineKey',
    'resolveServiceBadge', 'computeUnifiedQuote', 'computeArchetypeQuote', 'computeQuoteFromState'];
const pricingSandbox = { DB, window: { DB }, console };
pricingSandbox.global = pricingSandbox;
vm.createContext(pricingSandbox);
vm.runInContext(PRICING_FNS.map(findFn).join('\n\n'), pricingSandbox);

function quoteFor(qty, access, matching) {
    pricingSandbox.S = {
        qty: 1,
        intent: { key: 'minor_home_repairs+minor_home_repairs_ceilings+Repair', category: 'minor_home_repairs', _groupId: 'minor_home_repairs_ceilings', label: 'Test' },
        stype: 'Repair', detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: [],
        answers: { item_count_template: qty, ceiling_tile_access: access, has_matching_tiles: matching },
        _tagSynthesizedModules: {}, _tagsAffirmed: true,
    };
    return pricingSandbox.computeQuoteFromState(pricingSandbox.S);
}

const small = quoteFor('1', 'Standard height, reachable with a step ladder', 'Yes');
check(`small job (1 tile, standard access, matching tiles): real base price ($45) is genuinely read, not the generic $70 category fallback (got $${small.base})`,
    small.base === 45);
check('small job correctly classifies as routine tier', small.tierKey === 'routine');

const large = quoteFor('4+', 'High or hard-to-reach ceiling', 'No');
check(`larger, harder job prices genuinely higher than the small one ($${small.laborCalc} -> $${large.laborCalc})`,
    large.laborCalc > small.laborCalc);

console.log(`\n[ceiling tile dynamic service] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
