#!/usr/bin/env node
/**
 * verify_mutual_exclusion_wired_into_main_render.js
 *
 * A real, confirmed bug in the "We understood" mechanism, found by
 * investigating a user-provided screenshot directly (an apparent tag
 * contradiction that couldn't be fully confirmed from the static image
 * alone -- confirmed instead via direct, empirical code testing).
 *
 * The real bug: detectTagsNLP has no mutual-exclusion awareness at all
 * -- it returns every tag whose synonyms match the customer's text,
 * including tags explicitly declared mutually_exclusive of each other
 * in the data (e.g. #brick_wall and #drywall). A real, correct
 * enforcement mechanism (applySSOTRules) already existed elsewhere in
 * this codebase, already correctly written (manTagIds/user taps
 * correctly win over detTagIds/NLP detection when they conflict) --
 * but was only ever wired into sqBuildStep3, a separate, legacy
 * step-by-step builder flow. It was never called from the main,
 * curated-card render path every named service (including
 * wall_hole_or_crack_repair, the service in the user's own screenshot)
 * actually uses -- confirmed via direct search this was the only real
 * call site before this fix.
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

const { engineAwareFindFn } = require('./_engine.js');   // T166: applySSOTRules (glue) hands its rules to the Logic function resolveTagRules; a cherry-picked glue function would lose it (the T136 reason for the shared loader)
function findFnLocal(name) {
    const m = QR_HTML.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) throw new Error(`Could not find function: ${name}`);
    let depth = 0, start = m.index, i = m.index + m[0].length - 1;
    for (let j = i; j < QR_HTML.length; j++) {
        if (QR_HTML[j] === '{') depth++;
        else if (QR_HTML[j] === '}') { depth--; if (depth === 0) return QR_HTML.slice(start, j + 1); }
    }
}

const findFn = engineAwareFindFn(findFnLocal);

console.log('=== The real, structural fix: applySSOTRules is now wired into the main render path, not just the legacy builder ===');
const syncIdx = QR_HTML.indexOf('const render = () => {\n                        syncTagSynthesizedAnswers(S);');
const nearbyText = syncIdx >= 0 ? QR_HTML.slice(syncIdx, syncIdx + 1500) : '';
check('the main curated-card render path now calls applySSOTRules right after syncTagSynthesizedAnswers',
    syncIdx >= 0 && nearbyText.includes('applySSOTRules()'));

console.log('\n=== The real, underlying bug this closes, confirmed directly ===');
const HELPER_CONSTS = `
const _SKIP_WORDS  = () => window._NLP?.STOP   || new Set();
const _SVC_VERBS   = () => window._NLP?.VERBS  || new Set();
const _STOP_PREPS  = () => window._NLP?.PREPS  || new Set();
const _CLAUSE_BOUNDARY = () => window._NLP?.CLAUSE || new Set();
const _ROOMS_LIST  = () => window._NLP?.ROOMS  || [];
const _DIMENSION_PATTERN = /\\b\\d+\\s*-?\\s*(?:foot|feet|ft|inch|inches|in|cm|centimeters?|meters?|yards?|lbs?|pounds?|kg)\\b/gi;
const _QTY_WORD_MAP = {one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
`;
const nlpSandbox = { DB, window: { DB }, console };
nlpSandbox.global = nlpSandbox;
vm.createContext(nlpSandbox);
vm.runInContext(HELPER_CONSTS + '\n' + [...new Set(['initNlpSets', 'isServiceVerb', 'extractObject', 'extractQty', 'extractLocation', 'detectTagsNLP'].map(findFn))].join('\n\n'), nlpSandbox);
nlpSandbox.initNlpSets();
const detected = nlpSandbox.detectTagsNLP('I have a crack in my brick wall near the drywall trim, high up, hard to reach, need it urgent').found;
check('confirmed: detectTagsNLP itself genuinely returns both mutually-exclusive tags with no awareness of the conflict (the real root cause -- not fixed here, since this is the correct, existing behavior applySSOTRules is designed to clean up downstream)',
    detected.includes('#brick_wall') && detected.includes('#drywall'));

console.log('\n=== applySSOTRules itself correctly resolves the conflict when actually called (already-correct logic, now reachable from the real path) ===');
const ssotSandbox = { DB, window: { DB }, console };
ssotSandbox.global = ssotSandbox;
vm.createContext(ssotSandbox);
vm.runInContext(findFn('resolveTagRules') + '\n' + findFn('applySSOTRules'), ssotSandbox);   // T166: the whole engine (it holds resolveTagRules and tagValidForCategory) + the glue function
ssotSandbox.S = {
    intent: { _groupId: 'minor_home_repairs_walls' },
    detTagIds: ['#brick_wall', '#drywall'], manTagIds: [], negatedTagIds: [], userTagIds: [],
};
// T166: the stub `tagValidForCategory = () => true` that stood here isolated the mutual-exclusion logic from the category check. The engine now loads whole and resolveTagRules binds the real
// function, so the stub could no longer take effect; neither case below depends on category validity (both hold their tags, so no group default is considered).
ssotSandbox.applySSOTRules();
check('after applySSOTRules runs: only one of the two mutually-exclusive tags remains active',
    ssotSandbox.S.detTagIds.includes('#brick_wall') !== ssotSandbox.S.detTagIds.includes('#drywall'));
check('a real, explicit user tap (manTagIds) correctly wins over NLP detection when they conflict',
    (() => {
        ssotSandbox.S = { intent: { _groupId: 'minor_home_repairs_walls' }, detTagIds: ['#drywall'], manTagIds: ['#brick_wall'], negatedTagIds: [], userTagIds: [] };
        ssotSandbox.applySSOTRules();
        return ssotSandbox.S.manTagIds.includes('#brick_wall') && !ssotSandbox.S.detTagIds.includes('#drywall');
    })());

console.log(`\n[mutual exclusion wired into main render] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
