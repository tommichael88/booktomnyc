#!/usr/bin/env node
/**
 * verify_inherent_tag_pricing_fix.js
 *
 * A real, severe, money-affecting bug, found while re-investigating an
 * area a prior, historical backlog document had assessed as "confirmed
 * zero current financial impact" -- re-checking that conclusion against
 * this session's own, later T77 work (the tag -> answer merge/skip
 * feature) found it no longer held: T77's syncTagSynthesizedAnswers
 * only ever considered S.detTagIds/S.manTagIds, never S.inherentTagIds
 * (a service's own default_tags, seeded as real "service facts" --
 * this file's own design comment at the seeding site explicitly says
 * "pricing still applies them"). Confirmed directly:
 * brick_or_concrete_crack_repair's inherent #brick_wall tag carries a
 * real $25 wall_type_brick_or_concrete modifier fee via its own
 * answers field, but since this service's intake_chain never asks
 * wall_type directly, that fee silently never applied -- every real
 * booking of this service was undercharged by $25.
 *
 * Fixed by including S.inherentTagIds, unconditionally, in
 * syncTagSynthesizedAnswers' active-tag set -- matching how
 * computeQuoteFromState already, correctly treats inherentTagIds as
 * always-chargeable and never negatable, the same way detTagIds is
 * gated by confidence/affirmation but manTagIds and inherentTagIds
 * are not.
 *
 * This test covers the complete, real sweep (all real (service,
 * inherent tag) pairs where the tag carries a real answers field) --
 * not just the one example that surfaced the bug -- since a narrower,
 * sample-based check is exactly the kind of thing that could miss a
 * different, real instance of the same class of gap.
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

// T143/T144: functions declared in the three engine modules are loaded WHOLE (the T136 `_engine.js` loader), so a helper added next to a
// function can no longer drop out of this sandbox ("X is not defined" -- noise unrelated to what this test asserts). Anything else is still
// extracted by name, below.
const { engineAwareFindFn } = require('./_engine.js');
function _cherryPickFn(name) {
    const m = QR_HTML.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) throw new Error(`Could not find function: ${name}`);
    let depth = 0, start = m.index, i = m.index + m[0].length - 1;
    for (let j = i; j < QR_HTML.length; j++) {
        if (QR_HTML[j] === '{') depth++;
        else if (QR_HTML[j] === '}') { depth--; if (depth === 0) return QR_HTML.slice(start, j + 1); }
    }
}
const findFn = engineAwareFindFn(_cherryPickFn);

const FNS = ['syncTagSynthesizedAnswers', '_isModVisible',
    'resolveDynamicService', 'resolveBaseConfidenceStrategy', 'resolveServiceCheckoutStateKey', 
    'applyLiveConfidenceEscalation', 'deriveComplexityTier', 'applyPricingFormula',
    'buildCheckoutStateModel', 'sqTagLabel', 'tagValidForCategory', 'resolveEngineKey',
    'resolveServiceBadge', 'computeUnifiedQuote', 'computeArchetypeQuote', 'computeQuoteFromState'];
const code = FNS.map(findFn).join('\n\n');
const sandbox = { DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

function extractTagId(item) {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object' && item.$ref) return item.$ref;
    return null;
}

function quoteFor(svc, inherentTagIds) {
    sandbox.S = {
        qty: 1, intent: { key: svc.id, category: svc.ui_taxonomy?.category, label: 'Test' },
        stype: svc.service_type || 'Repair', detTagIds: [], manTagIds: [], negatedTagIds: [],
        inherentTagIds, answers: {}, _tagSynthesizedModules: {}, _tagsAffirmed: true, _svc: svc,
    };
    return sandbox.computeQuoteFromState(sandbox.S);
}

console.log('=== The original, confirmed bug case ===');
const brickSvc = DB.services.find(s => s.id === 'brick_or_concrete_crack_repair');
const withTag = quoteFor(brickSvc, ['#brick_wall']);
const withTagAnswers = { ...sandbox.S.answers }; // capture before the next call reassigns sandbox.S
const withoutTag = quoteFor(brickSvc, []);
check(`brick_or_concrete_crack_repair with its real inherent #brick_wall tag correctly charges the real $25 modifier fee ($${withoutTag.laborCalc} -> $${withTag.laborCalc})`,
    withTag.laborCalc === withoutTag.laborCalc + 25);
check('the synthesized answer is the real, correct wall_type value',
    withTagAnswers.wall_type === 'Brick or concrete');

console.log('\n=== Complete, real sweep: every (service, inherent tag) pair where the tag carries a real answers field ===');
const smartTags = DB.smart_tags;
let sweepChecked = 0, sweepPassed = 0;
for (const svc of DB.services) {
    const dtags = svc.default_tags || [];
    for (const raw of dtags) {
        const tid = extractTagId(raw);
        if (!tid) continue;
        const t = smartTags[tid];
        if (!t || !t.answers || Object.keys(t.answers).length === 0) continue;
        sweepChecked++;

        // For each module this tag would synthesize, confirm it's
        // either genuinely visible in this service's own real,
        // resolved intake_chain (so a real customer could also
        // provide it explicitly, and the synthesized value correctly,
        // safely defers to that -- not a bug), or, if not visible at
        // all in this service's chain, confirm the synthesis still
        // lands in S.answers so its real pricing effect (if any)
        // applies -- the exact class of gap this whole fix closes.
        const withInherent = quoteFor(svc, [tid]);
        const synthesizedCorrectly = Object.entries(t.answers).every(
            ([moduleKey, label]) => sandbox.S.answers[moduleKey] === label
        );
        if (synthesizedCorrectly) sweepPassed++;
        else console.log(`    MISS: ${svc.id} / ${tid} -> expected ${JSON.stringify(t.answers)}, got ${JSON.stringify(sandbox.S.answers)}`);
    }
}
check(`complete sweep: all ${sweepChecked} real (service, inherent tag) pairs with a real answers field synthesize correctly (not a sample)`,
    sweepChecked > 0 && sweepPassed === sweepChecked);
console.log(`    (${sweepChecked} real pairs checked)`);

console.log('\n=== Regression guards ===');
const toiletSvc = DB.services.find(s => s.id === 'toilet_install');
const controlQuote = quoteFor(toiletSvc, []);
check('a service with no inherent tags is completely unaffected by this fix',
    typeof controlQuote.laborCalc === 'number' && Object.keys(sandbox.S.answers).length === 0);

// Explicit customer answers must still always win over an inherent tag's synthesis.
const withExplicit = (() => {
    sandbox.S = {
        qty: 1, intent: { key: brickSvc.id, category: brickSvc.ui_taxonomy?.category, label: 'Test' },
        stype: 'Repair', detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: ['#brick_wall'],
        answers: { wall_type: 'Drywall (standard)' }, _tagSynthesizedModules: {}, _tagsAffirmed: true, _svc: brickSvc,
    };
    return sandbox.computeQuoteFromState(sandbox.S);
})();
check('a real, explicit customer answer is never overwritten by an inherent tag\'s synthesis',
    sandbox.S.answers.wall_type === 'Drywall (standard)');

console.log(`\n[inherent tag pricing fix] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
