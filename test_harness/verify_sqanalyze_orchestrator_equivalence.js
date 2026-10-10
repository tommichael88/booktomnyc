/**
 * verify_sqanalyze_orchestrator_equivalence.js
 *
 * T68: the real, permanent "test suite as guardrails" for any future
 * sqAnalyze retirement work. Compares sqAnalyze's real, complete
 * button-click behavior against executeWorkflow called directly,
 * across all 74 real named services used as synthetic queries (their
 * own display_name), simulating a customer clicking through any
 * affirmation/pivot card to its real conclusion on both sides.
 *
 * Built while investigating a strangler-fig retirement plan. The
 * first two versions of this comparison had real, confirmed
 * methodology bugs, corrected in order before trusting any result:
 * 1. entityType:'dynamic' entities were compared against a
 *    non-existent field (dynamic_services entries have no
 *    ui_taxonomy), producing "OTHER:undefined" on the orchestrator
 *    side for every dynamic resolution -- fixed by matching the
 *    resolved entity back to its real key via object-reference
 *    comparison against DB.dynamic_services.
 * 2. sqAnalyze's real, generic sqPrepareFlow fallback (a
 *    category+group+stype resolution, not a specific named service)
 *    was being read as "nothing resolved" (only S._svc/S._otherTile
 *    were checked) -- fixed by also capturing S.intent's own
 *    category/group/stype as a real, comparable outcome.
 * 3. Most severe: S._svc/S._otherTile/S.intent were never reset
 *    between iterations, so a PREVIOUS query's successful resolution
 *    silently persisted into a later query that genuinely resolved
 *    nothing on its own -- collapsed the disagreement count from 29
 *    to 4 once fixed. Confirmed directly: a query showing
 *    "legacy=high_ceiling_bulb_replacement" in the contaminated run
 *    showed S._svc:undefined when tested in complete isolation.
 *
 * The 4 remaining, real disagreements were traced individually, not
 * assumed, and split explicitly by what they mean for a future
 * retirement decision -- not lumped together as one undifferentiated
 * "4 disagreements":
 * - 2 are executeWorkflow being MORE accurate (correctly, confidently
 *   resolving a clear match sqAnalyze under-commits on) -- a real
 *   improvement, not a risk.
 * - 2 are a real, confirmed gap: executeWorkflow's entity resolution
 *   (via orch_apply_object_based_resolution's confidence boost) can
 *   commit to a specific, WRONG named service from an object-keyword
 *   match alone, without a recommendedSku -- sqAnalyze's own
 *   auto-select requires BOTH a recommendedSku AND high confidence,
 *   which acts as a real safety net executeWorkflow's own resolution
 *   doesn't have. Both traced to the identical root cause (confirmed,
 *   not assumed): "Door Lock or Handle Install" -> extractedObject
 *   "handle" matches cabinet_knob_or_pull_install's own object
 *   mapping; "Under-Cabinet Light Install" -> extractedObject
 *   "under-cabinet" matches the cabinets group, both losing the
 *   query's own actual subject (a door lock; a light) to a partial,
 *   coincidental object-keyword overlap.
 *
 * T69 CLOSED this gap at the source, in two real, separate fixes (see
 * TIMELINE.md's T69 entry for the complete account): (1)
 * orch_resolve_entity now requires a service resolved via the object-
 * based override to have a group consistent with the independently-
 * resolved context.selectedGroupId before committing to it; (2) the
 * object-keyword map lookup itself (previously first-match-wins) now
 * uses a three-tier, match-direction-aware priority (exact match,
 * then longest object-contains-keyword match, then shortest keyword-
 * contains-object match as a last resort). Verified directly, per
 * explicit decision: door_lock_or_handle_install's severe risk is
 * fully resolved (now a true agreement via this test's own cross-
 * match logic; its remaining category-vs-group specificity
 * difference is real but minor, and explicitly accepted as a
 * documented, low-stakes difference rather than tracked here).
 * under_cabinet_light_install moved from risk to a genuine third
 * improvement. Zero known risk disagreements remain -- any nonzero
 * count from this point forward is a real, new regression, not an
 * accepted difference.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const REPO_ROOT = path.join(__dirname, '..');
const html = require('./_page.js').readPage(path.join(REPO_ROOT, 'qr.html'));
const btnycJson = fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8');

let pass_count = 0, fail_count = 0;
function check(label, condition) {
    if (condition) { pass_count++; console.log(`  ✓ ${label}`); }
    else { fail_count++; console.log(`  ✗ ${label}`); }
}

const dom = new JSDOM(html, {
    url: 'https://tommichael88.github.io/booktomnyc/qr.html',
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    beforeParse(window) {
        window.fetch = async (url) => {
            if (String(url).includes('btnyc.json')) return { ok: true, json: async () => JSON.parse(btnycJson) };
            return { ok: false, status: 404 };
        };
        window.HTMLElement.prototype.scrollIntoView = function () {};
    },
});

setTimeout(() => {
    const w = dom.window;
    const doc = w.document;
    const DB = w.DB;

    function dynKeyFor(entity) {
        for (const [key, val] of Object.entries(DB.dynamic_services)) {
            if (val === entity) return key;
        }
        return 'UNKNOWN_DYN';
    }

    function resetS() {
        w.S.detTagIds = []; w.S.negatedTagIds = []; w.S.manTagIds = [];
        w.S._tagsAffirmed = false; w.S._affirmedTagSet = []; w.S._negationPivotAccepted = false; w.S._pendingPivotInfo = null;
        w.S._svc = null; w.S._otherTile = null; w.S.intent = null;
        w.S._autoSelectedFrom = null;
    }

    // T69 RESOLVED this set from 2 real risks down to 0 -- both fixed
    // at the source in orch_resolve_entity/orch_apply_object_based_
    // resolution (see TIMELINE.md's T69 entry for the full account).
    // Kept as a real, empty set (not deleted) so a genuinely NEW risk
    // disagreement is still caught explicitly rather than silently
    // absorbed as "just another unexpected difference."
    //
    // door_lock_or_handle_install: the severe part (confidently
    // committing to a WRONG named service) is fully resolved. Verified
    // directly, not assumed: with the T69 fix in place, this case
    // already registers as a true AGREEMENT via this test's own
    // existing generic-fallback-vs-dynamic cross-match logic (both
    // sides correctly land on the minor_home_repairs category) --
    // needs no entry here at all. A real, small, low-stakes remaining
    // difference exists (the orchestrator's safe fallback is category-
    // level; sqAnalyze's own is group-level) -- per direct, explicit
    // decision, accepted as a documented, low-stakes difference, not
    // something this test needs to specially track.
    //
    // under_cabinet_light_install: moved to a real, third IMPROVEMENT
    // below, per direct verification during the T69 fix -- the
    // orchestrator now correctly identifies the lighting category,
    // where sqAnalyze itself still, independently, incorrectly
    // resolves to cabinets (a real, pre-existing, shared NLP
    // limitation the T69 fix happened to improve on the orchestrator's
    // side only).
    // T70: sqAnalyze IS the orchestrator now (a real, thin dispatcher
    // to executeWorkflow/renderRoute) -- there is no longer a second,
    // separate implementation to disagree with at all, so both sets
    // are correctly empty. Kept, not deleted, so a genuinely new
    // divergence (e.g. from a future edit that reintroduces separate
    // logic somewhere) is still caught explicitly as a real,
    // unexpected disagreement, not silently absorbed.
    const KNOWN_RISK_DISAGREEMENTS = new Set([]);
    const KNOWN_IMPROVEMENT_DISAGREEMENTS = new Set([]);

    let agreements = 0, unexpectedDisagreements = 0, riskDisagreements = 0, improvementDisagreements = 0, errors = 0;
    const unexpectedDetail = [];

    for (const svc of DB.services) {
        const text = svc.ui_taxonomy?.display_name || svc.id;
        if (!text) continue;

        let legacyResult = null, legacyKind = null;
        try {
            resetS();
            w.window._currentRoute = null;
            w.window._currentContext = null;
            const textarea = doc.getElementById('sqDescIn');
            const btn = doc.getElementById('sqUnifiedActionBtn');
            textarea.value = text;
            btn.click();
            // T70: sqAnalyze is now a real, thin dispatcher --
            // window._currentRoute is what it actually produces, the
            // same real object renderRoute rendered from. This is no
            // longer inferring the result from S._svc/S._otherTile
            // (sqAnalyze never sets either now -- that was specifically
            // prefillSmartQuoteFromService's own job, which the new
            // dispatcher never calls) or S.intent.category (the old
            // generic-fallback signal, also obsolete now that the real
            // resolution always reaches the same place executeWorkflow
            // would reach directly). orchAffirmYes, not the retired
            // sqAffirmYes, since that's the real, live handler now.
            for (let i = 0; i < 2 && w._currentRoute?.uiTemplate === 'tag_affirmation' && typeof w.orchAffirmYes === 'function'; i++) {
                w.orchAffirmYes();
            }
            const route = w._currentRoute;
            if (route?.entityType === 'dynamic' && route.entity) {
                legacyResult = `OTHER:${dynKeyFor(route.entity)}`;
                legacyKind = 'dynamic';
            } else if (route?.entity?.id) {
                legacyResult = route.entity.id;
                legacyKind = 'named';
            }
        } catch (e) {
            errors++;
            unexpectedDetail.push(`[LEGACY THROWS] "${text}" (${svc.id}): ${e.message}`);
            continue;
        }

        let orchResult = null, orchKind = null;
        try {
            let ctx = w.collectBookingContext_freeText(text);
            let route = w.executeWorkflow(ctx, DB);
            for (let i = 0; i < 2 && route.uiTemplate === 'tag_affirmation'; i++) {
                if (route.negationOverride) ctx.negationPivotAccepted = true;
                else ctx.tagsAffirmed = true;
                route = w.executeWorkflow(ctx, DB);
            }
            if (route.entityType === 'dynamic' && route.entity) {
                orchResult = `OTHER:${dynKeyFor(route.entity)}`;
                orchKind = 'dynamic';
            } else if (route.entity?.id) {
                orchResult = route.entity.id;
                orchKind = 'named';
            }
        } catch (e) {
            errors++;
            unexpectedDetail.push(`[ORCH THROWS] "${text}" (${svc.id}): ${e.message}`);
            continue;
        }

        // T70: both sides now extract via the identical dynamic/named
        // scheme (the real consequence of sqAnalyze genuinely calling
        // the same executeWorkflow the orch side calls directly) -- a
        // direct comparison is correct and sufficient now; the earlier
        // generic-fallback cross-match fallback this replaced only
        // existed to reconcile two genuinely different extraction
        // shapes, which no longer exist.
        const match = legacyResult === orchResult;

        if (match) {
            agreements++;
        } else if (KNOWN_RISK_DISAGREEMENTS.has(svc.id)) {
            riskDisagreements++;
        } else if (KNOWN_IMPROVEMENT_DISAGREEMENTS.has(svc.id)) {
            improvementDisagreements++;
        } else {
            unexpectedDisagreements++;
            unexpectedDetail.push(`"${text}" (expected ~${svc.id}): legacy[${legacyKind}]=${legacyResult} vs orch[${orchKind}]=${orchResult}`);
        }
    }

    console.log(`Swept ${DB.services.length} real services as synthetic queries (display_name, full state reset per iteration).`);
    console.log(`Agreements: ${agreements}, Known risk disagreements: ${riskDisagreements}, Known improvements: ${improvementDisagreements}, Unexpected: ${unexpectedDisagreements}, Errors: ${errors}\n`);

    check(`zero real errors on either path (found ${errors})`, errors === 0);
    check(`100% agreement across all real services (found ${agreements}/${DB.services.length}) -- T70 made sqAnalyze itself call executeWorkflow, so this is no longer comparing two implementations, it's a real regression guard confirming the live button-click path never diverges from a direct orchestrator call`,
        agreements === DB.services.length);
    check(`zero unexpected disagreements (found ${unexpectedDisagreements}) -- any nonzero count here is a real, new regression in how sqAnalyze constructs or passes its context, not an accepted difference`,
        unexpectedDisagreements === 0);
    check(`zero known RISK disagreements remain (found ${riskDisagreements})`,
        riskDisagreements === KNOWN_RISK_DISAGREEMENTS.size && riskDisagreements === 0);
    check(`zero known IMPROVEMENT disagreements remain (found ${improvementDisagreements}) -- there is no longer a separate implementation for the orchestrator to be "more accurate" than`,
        improvementDisagreements === KNOWN_IMPROVEMENT_DISAGREEMENTS.size && improvementDisagreements === 0);

    if (unexpectedDetail.length > 0) {
        console.log('\n--- Unexpected disagreement / error detail ---');
        for (const d of unexpectedDetail) console.log(' ', d);
    }

    console.log(`\n[sqAnalyze/orchestrator equivalence] ${pass_count} passed, ${fail_count} failed (of ${pass_count + fail_count} checks)\n`);
    process.exit(fail_count > 0 ? 1 : 0);
}, 3000);
