#!/usr/bin/env node
/**
 * verify_checkout_state_inheritance.js
 *
 * Regression test for Track A Phase 2's second field migration:
 * financial_engine.checkout_state now genuinely inherits from the
 * entity's real archetype where the value matches and no documented
 * reasoning exists to preserve explicitly.
 *
 * Found and fixed 10 real, distinct call sites reading
 * financial_engine.checkout_state directly before touching any data --
 * more than confidence_strategy had, several genuinely dangerous:
 *   - orch_enrich_from_dynamic_service would have overwritten a correct,
 *     inherited value with an unrelated dynamic-service one
 *   - sqRenderSelfQuoteAdlib's `isHourly ? 'diagnostic' : 'standard_flat_rate'`
 *     fallback would have wrongly defaulted a migrated hourly service to
 *     diagnostic checkout
 *   - resolveServiceBadge/resolveServiceBadgeKey/isDiagnosticService only
 *     ever received the financial_engine sub-object, never the parent
 *     service -- structurally unable to do an archetype lookup without
 *     a signature change, found via a broader search for `fe.checkout_state`
 *     (an already-destructured variable) after the first, narrower search
 *     for `.financial_engine?.checkout_state` came back clean
 *
 * 65 of the original 70 real services migrated at the time this was
 * written; 69 of 74 as of the 2026-08-28 recovery session's catalog
 * count (4 new services added since, all correctly inheriting). 3 kept
 * fully explicit as genuine,
 * documented exceptions (dishwasher_repair: diagnostic;
 * prehung_interior_door_install/toilet_install: project_based). 2 more
 * excluded out of extra caution despite matching the default
 * (cabinet_knob_or_pull_install, pax_wardrobe_assembly) -- both already
 * carry a documented _archetype_note for a different, earlier
 * correction, and collapsing a second field alongside that felt like
 * more risk than the dedup was worth.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.dirname(__dirname);
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

function freshSandbox(db) {
    const sandbox = { DB: db, SERVICE_DATA: db, window: { DB: db } };
    sandbox.global = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(REPO_ROOT, 'pricing_engine.js'), 'utf8'), sandbox, { filename: 'pe' });
    vm.runInContext(fs.readFileSync(path.join(REPO_ROOT, 'orchestrator_engine.js'), 'utf8'), sandbox, { filename: 'orch' });
    return sandbox;
}

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

console.log('=== 65 services genuinely inherit; 3 documented exceptions + 2 extra-caution exclusions stay explicit ===');
{
    const inherited = DB.services.filter(s => s.financial_engine._inherits_checkout_state_from_archetype);
    // v9.6+ FIX: was checking === 65. Confirmed directly (2026-08-28
    // recovery session): the real, live catalog has grown from 70 to 74
    // services since this test was written; all 4 new services correctly
    // inherit checkout_state from their archetype (none needed an explicit
    // override), so the real, current count is 69 -- catalog growth, not
    // a regression in the inheritance mechanism itself.
    check('exactly 69 services genuinely inherit (field removed, not just matching)', inherited.length === 69);
    for (const s of inherited) {
        check(`${s.id}: checkout_state genuinely absent`, !('checkout_state' in s.financial_engine));
    }

    const documented = { dishwasher_repair: 'diagnostic', prehung_interior_door_install: 'project_based', toilet_install: 'project_based' };
    for (const [id, expected] of Object.entries(documented)) {
        const s = DB.services.find(x => x.id === id);
        check(`${id}: kept explicit at its real, documented value (${expected})`, s.financial_engine.checkout_state === expected);
    }

    for (const id of ['cabinet_knob_or_pull_install', 'pax_wardrobe_assembly']) {
        const s = DB.services.find(x => x.id === id);
        check(`${id}: kept explicit out of extra caution (already carries a different, documented _archetype_note)`,
            s.financial_engine.checkout_state === 'standard_flat_rate' && !s.financial_engine._inherits_checkout_state_from_archetype);
    }
}

console.log('\n=== THE CRITICAL CHECK: zero real behavioral change, across everything the migration could touch ===');
{
    const dbOld = JSON.parse(JSON.stringify(DB));
    for (const s of dbOld.services) {
        if (s.financial_engine._inherits_checkout_state_from_archetype) {
            const arch = dbOld.archetypes[s.financial_engine._inherits_checkout_state_from_archetype];
            s.financial_engine.checkout_state = arch.default_checkout_state;
        }
    }
    const sandboxOld = freshSandbox(dbOld);
    const sandboxNew = freshSandbox(DB);

    let diffs = 0;
    for (const svc of DB.services) {
        const svcOld = dbOld.services.find(s => s.id === svc.id);
        const qOld = sandboxOld.computeUnifiedQuote({ svc: svcOld, activeTagIds: [], answers: {}, qty: 1 });
        const qNew = sandboxNew.computeUnifiedQuote({ svc, activeTagIds: [], answers: {}, qty: 1 });
        // T150: the helpers take the RESOLVED key (callers resolve first), so the equivalence is asked of the resolver's answer on each dataset too.
        const csOld = sandboxOld.resolveServiceCheckoutStateKey(svcOld, null), csNew = sandboxNew.resolveServiceCheckoutStateKey(svc, null);
        const badgeOld = sandboxOld.resolveServiceBadge(svcOld.financial_engine, csOld.key);
        const badgeNew = sandboxNew.resolveServiceBadge(svc.financial_engine, csNew.key);
        const isDiagOld = sandboxOld.isDiagnosticService(svcOld.financial_engine, csOld.key);
        const isDiagNew = sandboxNew.isDiagnosticService(svc.financial_engine, csNew.key);
        // The intake classification is the reader that WAS broken for inheriting services (it read financial_engine.checkout_state directly), so it is part of the equivalence.
        const clsOld = sandboxOld.classifyServiceIntake(svcOld).isSelfQuoting, clsNew = sandboxNew.classifyServiceIntake(svc).isSelfQuoting;
        if (csOld.key !== csNew.key || clsOld !== clsNew) { diffs++; console.log(`    DIVERGENCE (resolver/classification): ${svc.id}`); continue; }
        if (qOld.laborEstimate !== qNew.laborEstimate || qOld.checkoutStateKey !== qNew.checkoutStateKey
            || badgeOld !== badgeNew || isDiagOld !== isDiagNew) {
            diffs++;
            console.log(`    DIVERGENCE: ${svc.id}`);
        }
    }
    check('zero divergences across the complete, real catalog (price, checkout state, badge, and diagnostic flag all unchanged)', diffs === 0);
}

console.log('\n=== The 10 real call sites found and fixed are all present and synced ===');
{
    const qrHtml = require('./_page.js').readPage(path.join(REPO_ROOT, 'qr.html'));
    check('resolveServiceCheckoutStateKey exists as the canonical resolver', /function resolveServiceCheckoutStateKey/.test(qrHtml));
    check('the resolver returns { key, source } (R-INVARIANT-PROVENANCE)', /source: 'service_override'/.test(qrHtml) && /source: 'archetype_default'/.test(qrHtml) && /source: 'fallback'/.test(qrHtml));
    // T150: the helpers are handed the RESOLVED key rather than an entity, so there is no raw-read mode left that could be blind to archetype inheritance.
    check('resolveServiceBadge is handed the resolved key (it cannot read the raw field)', /function resolveServiceBadge\(fe, csKey\)/.test(qrHtml));
    check('resolveServiceBadgeKey is handed the resolved key (it cannot read the raw field)', /function resolveServiceBadgeKey\(csKey\)/.test(qrHtml));
    check('isDiagnosticService is handed the resolved key (it cannot read the raw field)', /function isDiagnosticService\(fe, csKey\)/.test(qrHtml));

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
    const peContent = fs.readFileSync(path.join(REPO_ROOT, 'pricing_engine.js'), 'utf8');
    const orchContent = fs.readFileSync(path.join(REPO_ROOT, 'orchestrator_engine.js'), 'utf8');
    const appContent = fs.readFileSync(path.join(REPO_ROOT, 'AppController.js'), 'utf8');
    const uiContent = fs.readFileSync(path.join(REPO_ROOT, 'UIRenderer.js'), 'utf8');

    for (const [file, content, fns] of [
        ['pricing_engine.js', peContent, ['resolveServiceCheckoutStateKey', 'computeUnifiedQuote', 'classifyServiceIntake', 'resolveServiceBadge', 'resolveServiceBadgeKey', 'isDiagnosticService']],
        ['orchestrator_engine.js', orchContent, ['orch_enrich_from_dynamic_service']],
        // sqBuildCuratedIntake was retired (R-INVARIANT-DELETION); the curated card is drawn from the orchestrator's route, which carries the resolved checkout state.
        ['AppController.js', appContent, ['sqRenderSelfQuoteAdlib']],
        // T119: renderTagAffirmationCard deleted -- confirmed genuinely
        // unreachable since T70 (see PENDING_DECISIONS.md, T119 cleanup).
        // Nothing left in either file to check sync against.
    ]) {
        for (const fn of fns) {
            const body = extractFnBody(content, fn);
            // T150: the old assertion ("references the resolver or accepts svc") certified a SHAPE. The property that matters is behavioural: nothing but the resolver reads an
            // entity's checkout_state field, because every direct read was blind to archetype inheritance (69 of 76 services inherit). A function either asks the resolver or is
            // handed the resolved key.
            const readsRaw = fn !== 'resolveServiceCheckoutStateKey' && /\.checkout_state\b/.test(body.replace(/\/\/[^\n]*/g, ''));
            check(`${fn} in ${file} does not read an entity's checkout_state itself (it asks the resolver, or is handed the resolved key)`, !readsRaw);
        }
    }
}

console.log(`\n[checkout_state inheritance verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
