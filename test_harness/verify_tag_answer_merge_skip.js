#!/usr/bin/env node
/**
 * verify_tag_answer_merge_skip.js
 *
 * Tests the v9.6 passive tag -> intake answer merge/skip feature
 * (syncTagSynthesizedAnswers), built per explicit design intent: a
 * passively-detected smart_tag that clearly identifies an intake
 * answer should skip asking that question again, without becoming a
 * silent pricing risk if the NLP got it wrong.
 *
 * Follows this project's established, hard-won VM extraction pattern:
 * S/DB are set as plain sandbox PROPERTIES, never `const`-declared
 * inside the extracted code -- a real, previously-confirmed bug in an
 * earlier test silently always read an empty, frozen S regardless of
 * what was reassigned on sandbox.S afterward, making every check
 * trivially pass against empty data.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML = require('./_page.js').readPage(path.join(REPO_ROOT, 'qr.html'));
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

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

const FNS = [
    'syncTagSynthesizedAnswers', '_isModVisible',
    'resolveDynamicService', 'resolveBaseConfidenceStrategy', 'resolveServiceCheckoutStateKey', 
    'applyLiveConfidenceEscalation', 'deriveComplexityTier', 'applyPricingFormula',
    'buildCheckoutStateModel', 'sqTagLabel', 'tagValidForCategory', 'resolveEngineKey',
    'resolveServiceBadge', 'computeUnifiedQuote', 'computeArchetypeQuote', 'computeQuoteFromState'
];
const code = FNS.map(fn => {
    const found = findFn(fn);
    if (!found) throw new Error(`Could not extract function: ${fn}`);
    return found;
}).join('\n\n');

const sandbox = { DB, window: { DB }, console, S: {} };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'syncTagSynthesizedAnswers' });

function freshS(overrides) {
    return Object.assign({
        detTagIds: [], manTagIds: [], negatedTagIds: [], answers: {}, _tagSynthesizedModules: {}
    }, overrides);
}

console.log('=== syncTagSynthesizedAnswers: basic synthesis ===');
sandbox.S = freshS({ detTagIds: ['#brick_wall'] });
sandbox.syncTagSynthesizedAnswers(sandbox.S);
check('#brick_wall synthesizes wall_type = "Brick or concrete"',
    sandbox.S.answers.wall_type === 'Brick or concrete');
check('tracked as tag-synthesized, not explicit',
    sandbox.S._tagSynthesizedModules.wall_type === '#brick_wall');

console.log('\n=== A real, explicit customer answer is never overwritten ===');
sandbox.S = freshS({ detTagIds: ['#brick_wall'], answers: { wall_type: 'Drywall (standard)' } });
sandbox.syncTagSynthesizedAnswers(sandbox.S);
check('explicit customer answer (Drywall) untouched despite #brick_wall being active',
    sandbox.S.answers.wall_type === 'Drywall (standard)');
check('not tracked as tag-synthesized, since it was never touched',
    !sandbox.S._tagSynthesizedModules.wall_type);

console.log('\n=== Removing/negating the responsible tag reverses the synthesis ===');
sandbox.S = freshS({ detTagIds: ['#brick_wall'] });
sandbox.syncTagSynthesizedAnswers(sandbox.S);
check('sanity: synthesized first', sandbox.S.answers.wall_type === 'Brick or concrete');
sandbox.S.detTagIds = []; // simulates the tap-to-remove handler's mutation
sandbox.syncTagSynthesizedAnswers(sandbox.S);
check('answer reversed (deleted) once the tag is gone', !('wall_type' in sandbox.S.answers));
check('tracking entry cleaned up too', !sandbox.S._tagSynthesizedModules.wall_type);

sandbox.S = freshS({ detTagIds: ['#brick_wall'] });
sandbox.syncTagSynthesizedAnswers(sandbox.S);
sandbox.S.negatedTagIds = ['#brick_wall']; // simulates NLP later negating it
sandbox.syncTagSynthesizedAnswers(sandbox.S);
check('negating (not just removing) the tag also reverses the synthesis',
    !('wall_type' in sandbox.S.answers));

console.log('\n=== Conflicting tags on the same module: fall back to asking, never guess ===');
// #drywall and #brick_wall both target wall_type with different labels.
sandbox.S = freshS({ detTagIds: ['#drywall', '#brick_wall'] });
sandbox.syncTagSynthesizedAnswers(sandbox.S);
check('conflicting tags leave wall_type unanswered rather than picking one',
    !('wall_type' in sandbox.S.answers));
check('no tracking entry for the conflicted module',
    !sandbox.S._tagSynthesizedModules.wall_type);

console.log('\n=== A module with no real intake_modules entry is skipped silently, not guessed ===');
sandbox.S = freshS({ detTagIds: ['#fan_box_missing'] }); // references fan_box_present, confirmed nonexistent
sandbox.syncTagSynthesizedAnswers(sandbox.S);
check('no answer synthesized for a tag referencing a nonexistent module',
    Object.keys(sandbox.S.answers).length === 0);

console.log('\n=== then-branch children still correctly appear after a synthesized parent answer ===');
const flatscreenSvc = DB.services.find(s => s.id === 'flatscreen_mounting_standard');
if (!flatscreenSvc) throw new Error('Reference service not found for then-branch check');
const wallTypeStep = flatscreenSvc.intake_chain.find(s => s.module === 'wall_type');
const allModsForSvc = flatscreenSvc.intake_chain.map(s => ({ moduleKey: s.module, then: s.then }));
sandbox.S = freshS({ detTagIds: ['#brick_wall'] });
sandbox.syncTagSynthesizedAnswers(sandbox.S);
const masonryVisible = sandbox._isModVisible({ moduleKey: 'masonry_anchor' }, sandbox.S.answers, allModsForSvc);
check('masonry_anchor (a real then-branch child of wall_type="Brick or concrete") becomes visible from a synthesized parent, not just an explicit one',
    masonryVisible === true);

console.log('\n=== End-to-end: the synthesized answer actually changes the real, charged price ===');
const wallSvc = DB.services.find(s => s.id === 'flatscreen_mounting_standard');
if (!wallSvc) throw new Error('Reference service not found for price check');

sandbox.S = {
    qty: 1, intent: { key: wallSvc.id, category: wallSvc.ui_taxonomy?.category || 'wall_mounting', label: 'Test' },
    stype: 'Install', detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: [],
    answers: {}, _tagSynthesizedModules: {}, _tagsAffirmed: false, _svc: wallSvc
};
const baseline = sandbox.computeQuoteFromState(sandbox.S);

sandbox.S = {
    qty: 1, intent: { key: wallSvc.id, category: wallSvc.ui_taxonomy?.category || 'wall_mounting', label: 'Test' },
    stype: 'Install', detTagIds: ['#brick_wall'], manTagIds: [], negatedTagIds: [], inherentTagIds: [],
    answers: {}, _tagSynthesizedModules: {}, _tagsAffirmed: true, _svc: wallSvc
};
const withBrickTag = sandbox.computeQuoteFromState(sandbox.S);

check(`a passively-detected #brick_wall actually raises the real, charged price (baseline $${baseline.laborCalc} -> with tag $${withBrickTag.laborCalc})`,
    withBrickTag.laborCalc > baseline.laborCalc);
check('the price increase happened via the real wall_type answer path (S.answers), not a separate/duplicate mechanism',
    sandbox.S.answers.wall_type === 'Brick or concrete');

console.log(`\n[tag-answer merge/skip] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
