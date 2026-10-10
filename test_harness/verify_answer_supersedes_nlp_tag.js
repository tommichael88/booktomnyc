#!/usr/bin/env node
/**
 * verify_answer_supersedes_nlp_tag.js
 *
 * Regression test for a real, confirmed gap raised directly by a user
 * (distinguishing it precisely from two existing, different mechanisms):
 * "mutually_exclusive" handles two real, positive TAGS that can't coexist
 * (e.g. #brick_wall vs #drywall); per-service tag applicability (T72)
 * handles whether a tag should be OFFERED for a given service at all.
 * Neither covers this: an explicit intake answer should supersede an
 * earlier, NLP-detected tag that contradicts it -- e.g. free text like
 * "urgent, need this asap" correctly detects #emergency, but if the
 * customer then explicitly answers the urgency question with "Whenever
 * works -- no rush", the contradictory "urgent / same-day" label kept
 * displaying to the customer, confirmed via direct trace before any fix
 * (the tag was never cleared, just silently accumulated).
 *
 * Confirmed this generalizes across every module sharing the same binary
 * "no tag" vs "one specific tag" answer shape, not just urgency:
 * parking_difficulty, disposal_request, and item_volume all
 * have the identical structure. Fixed once, centrally, in
 * computeUnifiedQuote (the single, authoritative point where tags and
 * answers already come together) rather than patched per-module.
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
    'resolveServiceBadge', 'computeUnifiedQuote', 'computeArchetypeQuote'];
const code = FNS.map(findFn).filter(Boolean).join('\n\n');
const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'tag_conflict' });

const svc = DB.services.find(s => s.id === 'under_cabinet_light_install');

console.log('=== This pattern is confirmed to generalize, not just apply to urgency ===');
{
    const binaryModules = ['urgency', 'parking_difficulty', 'disposal_request', 'item_volume'];
    let allMatch = true;
    for (const mkey of binaryModules) {
        const mod = DB.intake_modules[mkey];
        const withTag = mod.client_response.filter(r => (r.tags || []).length > 0);
        const withoutTag = mod.client_response.filter(r => (r.tags || []).length === 0);
        if (withTag.length !== 1 || withoutTag.length !== 1) allMatch = false;
    }
    check(`all ${binaryModules.length} modules confirmed to share the same binary "no tag" vs "one tag" shape`, allMatch);
}

console.log('\n=== The core fix: an explicit contradictory answer clears the earlier NLP-detected tag ===');
{
    const q = sandbox.computeUnifiedQuote({
        svc, dynDef: null, activeTagIds: ['#emergency'],
        answers: { urgency: 'Whenever works — no rush' },
        qty: 1
    });
    check('the contradictory "urgent / same-day" label no longer displays after an explicit "no rush" answer', q.activeLabels.length === 0);
}

console.log('\n=== A matching (non-contradictory) answer correctly preserves the tag ===');
{
    const q = sandbox.computeUnifiedQuote({
        svc, dynDef: null, activeTagIds: ['#emergency'],
        answers: { urgency: 'Urgent — today or tomorrow' },
        qty: 1
    });
    check('the tag is correctly preserved when the explicit answer matches it', q.activeLabels.includes('urgent / same-day'));
}

console.log('\n=== An unrelated tag (not owned by the answered module) is never touched ===');
{
    const q = sandbox.computeUnifiedQuote({
        svc, dynDef: null, activeTagIds: ['#brick_wall'],
        answers: { urgency: 'Whenever works — no rush' },
        qty: 1
    });
    check('an unrelated tag from a different concept space is unaffected', q.activeLabels.includes('on brick or concrete'));
}

console.log('\n=== The fix generalizes correctly to a second module (parking_difficulty), not just urgency ===');
// T118: was pets_present -- deleted (fee: 0, could never meaningfully
// change a price, per the operator's own explicit removal principle).
// parking_difficulty has the same real, binary shape and a real fee.
{
    const q = sandbox.computeUnifiedQuote({
        svc, dynDef: null, activeTagIds: ['#no_parking'],
        answers: { parking_difficulty: 'No, parking is easy' },
        qty: 1
    });
    check('a contradicted parking_difficulty tag is also correctly cleared (confirms the fix is general, not urgency-specific)',
        !q.activeLabels.some(l => l.toLowerCase().includes('parking')));
}

console.log('\n=== No answered module at all -- tags are correctly left completely untouched ===');
{
    const q = sandbox.computeUnifiedQuote({ svc, dynDef: null, activeTagIds: ['#emergency'], answers: {}, qty: 1 });
    check('with no answers at all, a real tag is never incorrectly stripped', q.activeLabels.includes('urgent / same-day'));
}

console.log(`\n[Answer supersedes NLP tag verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
