#!/usr/bin/env node
/**
 * verify_confidence_strategy_inheritance.js
 *
 * Regression test for Track A Phase 2 (first real field migration):
 * confidence_strategy.minimum_quote_confidence/maximum_followup_questions
 * now genuinely inherit from the entity's real archetype where the
 * service's own value matches the archetype default and carries no
 * documented, deliberate reasoning worth preserving explicitly.
 *
 * THE REAL SEQUENCE, in order, each step verified before the next:
 *
 *   1. resolveBaseConfidenceStrategy made archetype-aware via a real,
 *      field-level merge (service's own value > entity's real archetype
 *      default > generic FALLBACK) instead of the original all-or-nothing
 *      "has confidence_strategy at all" check. Verified as a true no-op
 *      first, since every service had complete data before any field was
 *      removed.
 *   2. A real, honest correction caught before migrating any data:
 *      Phase 1's own maximum_followup_questions defaults (3/4, borrowed
 *      from the checklist's illustrative suggestion) didn't match the
 *      real, live catalog at all -- every single archetype's true,
 *      overwhelming value is 2. Corrected before proceeding, not after.
 *   3. 27 real services (of 70) had their minimum_quote_confidence AND
 *      maximum_followup_questions removed -- genuine inheritance, not
 *      just matching values left in place. The 16 services with
 *      documented, deliberate reasoning (the v9.5.10 Phase-4 fix) were
 *      deliberately excluded even where their value numerically matches,
 *      preserving traceable reasoning over a marginal dedup gain.
 *   4. Confirmed, exhaustively, not spot-checked: zero change in
 *      resolved confidence_strategy AND zero change in full
 *      computeUnifiedQuote output (price, confidence score, bar) across
 *      all 70 real services, comparing against a reconstructed
 *      pre-migration state.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.dirname(__dirname);
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

function freshSandbox(db) {
    const sandbox = { DB: db, SERVICE_DATA: db, window: { DB: db } };
    sandbox.global = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(REPO_ROOT, 'pricing_engine.js'), 'utf8'), sandbox, { filename: 'pe' });
    return sandbox;
}

console.log('=== 27 real services genuinely inherit; 16 documented + 27 mismatched stay explicit ===');
{
    const inherited = DB.services.filter(s => s.confidence_strategy._inherits_from_archetype);
    // v9.6+ FIX: was checking === 27. Confirmed directly (2026-08-28
    // recovery session): the real, live catalog has grown from 70 to 74
    // services since this test was written; only 1 of the 4 new services
    // genuinely inherits both confidence fields (the other 3 carry a
    // deliberate, explicit override), so the real, current count is 28 --
    // catalog growth, not a regression in the inheritance mechanism.
    check('exactly 28 services genuinely inherit (fields removed, not just matching)', inherited.length === 28);
    for (const s of inherited) {
        check(`${s.id}: minimum_quote_confidence genuinely absent (not just equal)`, !('minimum_quote_confidence' in s.confidence_strategy));
        check(`${s.id}: maximum_followup_questions genuinely absent`, !('maximum_followup_questions' in s.confidence_strategy));
    }

    const documented = ['dishwasher_repair', 'computer_diagnostic', 'faucet_repair_drip'];
    for (const id of documented) {
        const s = DB.services.find(x => x.id === id);
        check(`${id}: explicit reasoning preserved, NOT collapsed to inheritance despite Phase 4's own value`,
            'minimum_quote_confidence' in s.confidence_strategy && !!s.confidence_strategy._note);
    }
}

console.log('\n=== Archetype defaults were corrected against real data before migrating anything ===');
{
    for (const [name, a] of Object.entries(DB.archetypes)) {
        check(`${name}: maximum_followup_questions corrected to the real, verified value (2)`,
            a.default_confidence_strategy.maximum_followup_questions === 2);
    }
}

console.log('\n=== THE CRITICAL CHECK: zero real behavioral change, full computeUnifiedQuote, whole catalog ===');
{
    const dbOld = JSON.parse(JSON.stringify(DB));
    for (const s of dbOld.services) {
        if (s.confidence_strategy._inherits_from_archetype) {
            const arch = dbOld.archetypes[s.confidence_strategy._inherits_from_archetype];
            s.confidence_strategy.minimum_quote_confidence = arch.default_confidence_strategy.minimum_quote_confidence;
            s.confidence_strategy.maximum_followup_questions = arch.default_confidence_strategy.maximum_followup_questions;
        }
    }
    const sandboxOld = freshSandbox(dbOld);
    const sandboxNew = freshSandbox(DB);

    let diffs = 0;
    for (const svc of DB.services) {
        const svcOld = dbOld.services.find(s => s.id === svc.id);
        const qOld = sandboxOld.computeUnifiedQuote({ svc: svcOld, activeTagIds: [], answers: {}, qty: 1 });
        const qNew = sandboxNew.computeUnifiedQuote({ svc, activeTagIds: [], answers: {}, qty: 1 });
        if (qOld.laborEstimate !== qNew.laborEstimate || qOld.score !== qNew.score || qOld.minConf !== qNew.minConf) {
            diffs++;
            console.log(`    DIVERGENCE: ${svc.id}`);
        }
    }
    check('zero divergences across the complete, real catalog (price, confidence score, and bar all unchanged)', diffs === 0);
}

console.log('\n=== resolveBaseConfidenceStrategy and qr.html/pricing_engine.js parity ===');
{
    function extractFn(text, name) {
        const m = text.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
        if (!m) return null;
        let depth = 0, start = m.index;
        for (let j = m.index + m[0].length - 1; j < text.length; j++) {
            if (text[j] === '{') depth++;
            else if (text[j] === '}') { depth--; if (depth === 0) return text.slice(start, j + 1); }
        }
        return null;
    }
    const qrHtml = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
    const pe = fs.readFileSync(path.join(REPO_ROOT, 'pricing_engine.js'), 'utf8');
    const a = extractFn(qrHtml, 'resolveBaseConfidenceStrategy');
    const b = extractFn(pe, 'resolveBaseConfidenceStrategy');
    check('resolveBaseConfidenceStrategy is byte-identical between qr.html and pricing_engine.js', a === b && a !== null);
    check('the real, live function is genuinely archetype-aware', /archetypeDefault/.test(a));
}

console.log('\n=== Real bugs found DURING verification: three separate, parallel reads of confidence_strategy bypassed the archetype-aware resolver ===');
{
    const sandbox = freshSandbox(DB);
    vm.runInContext(fs.readFileSync(path.join(REPO_ROOT, 'orchestrator_engine.js'), 'utf8'), sandbox, { filename: 'orch' });

    const svc = DB.services.find(s => s.id === 'toilet_flapper_or_fill_valve_replacement');
    // v9.6 FIX: was checking === 50. Per a direct, deliberate business
    // decision, minimum_quote_confidence is now tier-standardized
    // (routine=70/skilled=80/specialized=90) rather than the previously
    // inconsistent per-archetype values (this archetype, plumbing_fixture,
    // was 50; confirmed its real member services -- including this
    // one -- are all 'skilled', so its new, correct default is 80).
    // Worth being explicit about a real, potentially confusing
    // coincidence: this test's own original label warns against "the
    // old, wrong fallback (80)" -- a completely different, unrelated
    // historical bug (a hardcoded fallback that was wrong at the time
    // for reasons having nothing to do with tier standardization). 80
    // is now genuinely, deliberately correct here, for a different
    // reason than the old bug's value happened to share.
    check('the exact, real scenario: minConf resolves correctly (80, the new tier-standardized value) through the full orchestrator path, via real archetype inheritance',
        (() => {
            const ctx = sandbox.collectBookingContext_catalog(svc, 'plumbing_help');
            const route = sandbox.executeWorkflow(ctx, DB);
            return route.confidence.minConf === 80;
        })());

    const qrHtmlContent = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
    function extractFnBodyEarly(text, name) {
        const m = text.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
        if (!m) return '';
        let depth = 0, start = m.index;
        for (let j = m.index + m[0].length - 1; j < text.length; j++) {
            if (text[j] === '{') depth++;
            else if (text[j] === '}') { depth--; if (depth === 0) return text.slice(start, j + 1); }
        }
        return '';
    }
    check('orch_compute_confidence now calls resolveBaseConfidenceStrategy (qr.html)',
        /resolveBaseConfidenceStrategy\(entity, null\)/.test(extractFnBodyEarly(qrHtmlContent, 'orch_compute_confidence')));
    check('sqBuildCuratedIntake\'s maxQs/minConf now call resolveBaseConfidenceStrategy (qr.html)',
        /const confStrat = resolveBaseConfidenceStrategy\(svc, null\);/.test(fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8')));
    check('sqPrepareFlow\'s baseStrategy now calls resolveBaseConfidenceStrategy, not an inline duplicate (qr.html)',
        /const baseStrategy = resolveBaseConfidenceStrategy\(svcForStrategy, dynDefForStrategy\);/.test(fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8')));

    function extractFnBody(text, name) {
        const m = text.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
        if (!m) return '';
        let depth = 0, start = m.index;
        for (let j = m.index + m[0].length - 1; j < text.length; j++) {
            if (text[j] === '{') depth++;
            else if (text[j] === '}') { depth--; if (depth === 0) return text.slice(start, j + 1); }
        }
        return '';
    }
    for (const [file, fn] of [['orchestrator_engine.js', 'orch_compute_confidence'], ['AppController.js', 'sqBuildCuratedIntake'], ['AppController.js', 'sqPrepareFlow']]) {
        const content = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
        const body = extractFnBody(content, fn);
        check(`${fn} in ${file} contains the fix (synced, not just fixed in qr.html)`, /resolveBaseConfidenceStrategy\(/.test(body));
    }
}

console.log('\n=== A2b (PHASE_PLAN C-12 / C-13): the resolver supplies every decision field, and its callers read the record with no second source ===');
{
    // WHY. computeUnifiedQuote and orch_compute_confidence used to follow resolveBaseConfidenceStrategy with a code-side default of their own (`|| 'medium'`, `|| 40`, and
    // `escalation.strategy?.minimum_quote_confidence || baseStrategy.minimum_quote_confidence || 80`). The resolver already merges the SSOT's value over the archetype's over its own
    // FALLBACK, so the callers' defaults were never reached with today's data -- and where they could be reached they disagreed with the resolver (80 here, 70 in its FALLBACK) and
    // silently overrode an authored value. This section pins the two facts that made deleting them safe: (1) the resolver's record is TOTAL for every entity the catalog can produce,
    // (2) the callers take the record as it is -- a value the data declares is the value used, even a declared zero, which a code-side `||` default used to discard.
    const FIELDS = ['_variability_tier', 'base_confidence', 'minimum_quote_confidence', 'maximum_followup_questions'];
    const orchSandbox = db => { const sb = freshSandbox(db); vm.runInContext(fs.readFileSync(path.join(REPO_ROOT, 'orchestrator_engine.js'), 'utf8'), sb, { filename: 'orch' }); return sb; };
    const sb = orchSandbox(DB);
    const dyn = Object.entries(DB.dynamic_services || {});
    const entities = [...DB.services.map(s => [s.id, s, null]), ...dyn.map(([k, d]) => ['dynamic:' + k, null, d]), ['(no entity: the generic fallback)', null, null]];

    const holes = [];
    entities.forEach(([name, svc, dd]) => { const r = sb.resolveBaseConfidenceStrategy(svc, dd); FIELDS.forEach(f => { if (!r[f]) holes.push(`${name}.${f}=${JSON.stringify(r[f])}`); }); });
    check(`the resolver's record carries all four decision fields (truthy) for every one of the ${entities.length} entities the catalog can produce (${DB.services.length} services, ${dyn.length} dynamic, the no-entity fallback)`, holes.length === 0 && entities.length > 100, holes.slice(0, 4).join('; '));

    const tierMismatch = DB.services.filter(svc => sb.computeUnifiedQuote({ svc, activeTagIds: [], answers: {}, qty: 1 }).variabilityTier !== sb.resolveBaseConfidenceStrategy(svc, null)._variability_tier).map(s => s.id);
    check('computeUnifiedQuote reports exactly the tier the resolver names, for every service (no caller-side default stands between them)', tierMismatch.length === 0, tierMismatch.slice(0, 4).join(', '));

    // Counterfactual worlds: the data declares a ZERO. A caller-side `|| 40` / `|| 80` would discard it; reading the record uses it.
    const world = mut => { const db = JSON.parse(JSON.stringify(DB)); mut(db); return orchSandbox(db); };
    const sid = 'toilet_flapper_or_fill_valve_replacement';
    const conf = (w, entryType, match) => { const svc = w.DB.services.find(x => x.id === sid); return w.orch_compute_confidence({ entity: svc, entityType: 'service' }, [], match, w.DB, entryType); };
    const real = conf(sb, 'free_text', 0);
    check('real world: a free-text request with no NLP match scores the resolver\'s base_confidence, and the bar is the resolver\'s minimum_quote_confidence',
        real.score === sb.resolveBaseConfidenceStrategy(sb.DB.services.find(x => x.id === sid), null).base_confidence && real.minConf === sb.resolveBaseConfidenceStrategy(sb.DB.services.find(x => x.id === sid), null).minimum_quote_confidence,
        JSON.stringify(real));
    const wBase = world(db => { db.services.find(x => x.id === sid).confidence_strategy.base_confidence = 0; });
    check('counterfactual (the SSOT declares base_confidence 0): the free-text score follows the data -- 0, not a code-side 40', conf(wBase, 'free_text', 0).score === 0, JSON.stringify(conf(wBase, 'free_text', 0)));
    check('counterfactual (the SSOT declares base_confidence 0): the group-tap score follows the data -- 45 (0 + the tap\'s own 45), not 85', conf(wBase, 'other_tile', 0).score === 45, JSON.stringify(conf(wBase, 'other_tile', 0)));
    const wMin = world(db => { db.services.find(x => x.id === sid).confidence_strategy.minimum_quote_confidence = 0; });
    check('counterfactual (the SSOT declares minimum_quote_confidence 0): the bar follows the data -- 0, not a code-side 80', conf(wMin, 'free_text', 0).minConf === 0, JSON.stringify(conf(wMin, 'free_text', 0)));
}

console.log(`\n[confidence_strategy inheritance verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
