#!/usr/bin/env node
/**
 * verify_sqanalyze_freetext_collector_wiring.js
 *
 * Regression test for T40 (see TIMELINE.md / PHASE7_READINESS_OVERVIEW.md):
 * sqAnalyze previously duplicated collectBookingContext_freeText's NLP/tag
 * detection inline instead of calling the real, already-built, already-
 * tested collector. This was not just redundant code -- it was a genuine,
 * confirmed accuracy gap: sqAnalyze never called detectTagsNLP/
 * inferTagsFromContext/the size-hint tag injection at all, so free-text
 * queries silently got worse tag detection than the catalog/other-tile
 * paths for the identical request.
 *
 * CONFIRMED BEFORE THE FIX (via direct test): these 3 phrases detected
 * ZERO tags through sqAnalyze's old inline logic, despite the real
 * collector correctly detecting real, fee-affecting tags for all 3:
 *   "mount a large mirror above the mantel"  -> should detect #heavy_item
 *   "hang a heavy tv on a brick wall"          -> should detect #brick_wall, #heavy_item, #two_person_required
 *   "install a big neon sign in my bedroom"    -> should detect #fragile_item
 *
 * This test verifies sqAnalyze now genuinely calls collectBookingContext_freeText
 * (not a re-implementation) and that S.detTagIds/S.negatedTagIds are
 * correctly populated from its real return value.
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

console.log('=== sqAnalyze genuinely calls collectBookingContext_freeText, not a re-implementation ===');
check('sqAnalyze source calls collectBookingContext_freeText(desc)',
    /const ctx = collectBookingContext_freeText\(desc\);/.test(QR_HTML));
check('sqAnalyze no longer calls detectIntentNLP(desc) directly (reads ctx.nlpIntent instead)',
    !/function sqAnalyze\(\)[\s\S]{0,500}const intent = detectIntentNLP\(desc\)/.test(QR_HTML));
check('S.detTagIds is sourced from ctx.detectedTagIds, not a separate _ctxTags-only derivation',
    /S\.detTagIds = \[\.\.\.\(ctx\.detectedTagIds \|\| \[\]\)\];/.test(QR_HTML));
check('S.negatedTagIds is now populated at all (previously never set in sqAnalyze)',
    /S\.negatedTagIds = \[\.\.\.\(ctx\.negatedTagIds \|\| \[\]\)\];/.test(QR_HTML));

function findFn(name) {
    const m = QR_HTML.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) return null;
    let depth = 0, start = m.index, i = m.index + m[0].length - 1;
    for (let j = i; j < QR_HTML.length; j++) {
        if (QR_HTML[j] === '{') depth++;
        else if (QR_HTML[j] === '}') { depth--; if (depth === 0) return QR_HTML.slice(start, j + 1); }
    }
    return null;
}

// Load the complete standalone module files rather than extracting individual
// functions -- nlp_engine.js has many small internal helper dependencies
// (isServiceVerb, _CLAUSE_BOUNDARY, etc.) that piecemeal extraction misses.
const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
const NLP_SRC = fs.readFileSync(path.join(REPO_ROOT, 'nlp_engine.js'), 'utf8');
const PRICING_SRC = fs.readFileSync(path.join(REPO_ROOT, 'pricing_engine.js'), 'utf8');
const ORCH_SRC = fs.readFileSync(path.join(REPO_ROOT, 'orchestrator_engine.js'), 'utf8');
vm.runInContext(NLP_SRC + '\n' + PRICING_SRC + '\n' + ORCH_SRC, sandbox, { filename: 'sqanalyze_wiring_check' });

console.log('\n=== The real collector (now the single source of truth for both paths) detects the confirmed-missing tags ===');
{
    const ctx1 = sandbox.collectBookingContext_freeText('mount a large mirror above the mantel');
    check('"large mirror above the mantel" detects #heavy_item', ctx1.detectedTagIds.includes('#heavy_item'));

    const ctx2 = sandbox.collectBookingContext_freeText('hang a heavy tv on a brick wall');
    check('"heavy tv on a brick wall" detects #brick_wall', ctx2.detectedTagIds.includes('#brick_wall'));
    check('"heavy tv on a brick wall" detects #heavy_item', ctx2.detectedTagIds.includes('#heavy_item'));

    const ctx3 = sandbox.collectBookingContext_freeText('install a big neon sign in my bedroom');
    check('"big neon sign" detects #fragile_item', ctx3.detectedTagIds.includes('#fragile_item'));
}

console.log('\n=== No duplicate extractObject call in the object_based resolver ===');
// T70: sqAnalyze is now a thin dispatcher to executeWorkflow -- the
// object_based branch this originally checked no longer exists within
// sqAnalyze's own body at all. Object-based resolution now lives
// entirely within orch_apply_object_based_resolution (which
// executeWorkflow calls), so that's the real, correct place to verify
// this concern now -- confirmed it reads context.extractedObject
// directly, with zero calls to extractObject( within its own body.
{
    const fnMatch = QR_HTML.match(/function orch_apply_object_based_resolution\s*\([^)]*\)\s*\{/);
    check('orch_apply_object_based_resolution exists (the real, current home for object-based resolution)', !!fnMatch);
    if (fnMatch) {
        const start = fnMatch.index;
        let depth = 0, i = QR_HTML.indexOf('{', start), end = -1;
        for (let j = i; j < QR_HTML.length; j++) {
            if (QR_HTML[j] === '{') depth++;
            else if (QR_HTML[j] === '}') { depth--; if (depth === 0) { end = j + 1; break; } }
        }
        const body = QR_HTML.slice(start, end);
        check('reads context.extractedObject directly, not a re-derivation', body.includes('context.extractedObject'));
        check('zero duplicate extractObject( calls within its own body', !body.includes('extractObject('));
    }
}

console.log('\n=== A2b (PHASE_PLAN C-18): the free-text collector scopes tags by the group resolver\'s answer alone ===');
{
    // WHY. The collector used to scope tag detection by `selectedGroupId || nlpIntent?._groupId || null`. Nothing writes `_groupId` on an NLP intent (not the NLP engine, not
    // understandRequest, not the SSOT), so the second source was always empty -- but if anything ever did populate it, it would have quietly widened which tags apply for a
    // request the group resolver had declined to place. Two facts pin the deletion: the source IS empty today, and supplying it changes nothing.
    const phrases = new Set();
    DB.services.forEach(s => { phrases.add(s.ui_taxonomy.display_name); (s.aliases || []).forEach(a => phrases.add(a)); });
    (Array.isArray(DB.intent_mappings) ? DB.intent_mappings : (DB.intent_mappings.objects || [])).forEach(m => m.keyword && phrases.add(m.keyword));
    let carrying = 0; phrases.forEach(p => { const u = sandbox.understandRequest(p); if (u && u.intent && u.intent._groupId !== undefined) carrying++; });
    check(`no understood request carries a \`_groupId\` on its intent (${phrases.size} phrases: every service name, alias and intent keyword)`, phrases.size > 100 && carrying === 0, `${carrying} carried one`);

    const realUnderstand = sandbox.understandRequest;
    const tagsFor = (text, supplyGroup) => {
        if (supplyGroup) sandbox.understandRequest = (t, o) => { const u = realUnderstand(t, o); return Object.assign({}, u, { intent: Object.assign({}, u.intent, { _groupId: supplyGroup }) }); };
        try { return sandbox.collectBookingContext_freeText(text).detectedTagIds.slice().sort(); } finally { sandbox.understandRequest = realUnderstand; }
    };
    // "mantel": the group resolver places it nowhere, so a brick-only tag is not valid for it. A group handed in by the intent must not make it valid.
    const plain = tagsFor('mantel', null);
    const supplied = tagsFor('mantel', 'minor_home_repairs_walls');
    check('counterfactual (the NLP intent hands the collector a wall group for "mantel"): the detected tags are exactly what they are without it', JSON.stringify(plain) === JSON.stringify(supplied), `without ${JSON.stringify(plain)}, with ${JSON.stringify(supplied)}`);
}

console.log(`\n[sqAnalyze free-text collector wiring verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
