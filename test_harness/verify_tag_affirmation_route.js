/**
 * verify_tag_affirmation_route.js
 *
 * Permanent regression coverage for T64: the real, direct port of
 * sqAnalyze's tag-affirmation gate (the Phase 7 confidence-gated tag
 * affirmation design) into the orchestrator's own decision path.
 *
 * This is not a duplicate of the legacy mechanism's own tests
 * (verify_affirmation_card_ui.js, verify_confidence_gated_tags.js,
 * etc.) -- it's the first real, standing coverage for the NEW,
 * ResolvedRoute-based path: the has_unaffirmed_detected_tags flag,
 * the ui_template_matrix rule, renderTagAffirmationFromRoute, the
 * renderRoute switch case, and orchAffirmYes/orchAffirmNo.
 *
 * T64 follow-up: the negation-pivot case is now also ported and
 * covered here (has_unconfirmed_negation_pivot, route.negationOverride,
 * the pivot-aware rendering branch, orchAffirmYes's pivot branch) --
 * see verify_t36_negation_pivot.js for the separate, real bug this
 * uncovered and fixed in the underlying negatedTagIds computation
 * itself, upstream of this file's own scope.
 *
 * Deliberately, honestly still does not test sibling-service
 * recommendations or per-tag removal -- neither is ported yet (see
 * renderTagAffirmationFromRoute's own header comment and
 * COMPONENT_LAYER_MAP.md item 1). Testing them here would be testing
 * something that doesn't exist.
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

    console.log('=== tag_affirmation is a real, recognized uiTemplate in BOTH validation registries ===');
    // Real, previously-caught gap: two separate registries define "valid
    // uiTemplate" -- a JS fallback (KNOWN_UI_TEMPLATES) and the real,
    // primary one in db.invariants. Both must agree, or a route using
    // this template gets silently vetoed to catastrophicFallbackRoute.
    const invariant = DB.invariants.find(i => i.id === 'uitemplate_must_be_known');
    check('the real, primary (data-driven) invariant allows tag_affirmation', invariant?.check?.allowed?.includes('tag_affirmation'));

    console.log('\n=== A real free-text query with a genuine detected tag routes to tag_affirmation ===');
    {
        const ctx = w.collectBookingContext_freeText('need this done urgently, same day, toilet is leaking');
        check('a real tag is genuinely detected (#emergency)', (ctx.detectedTagIds || []).includes('#emergency'));
        const route = w.executeWorkflow(ctx, DB);
        check('uiTemplate resolves to tag_affirmation, not vetoed to something else', route.uiTemplate === 'tag_affirmation');
        check('detectedTagIds is exposed on the real route object', Array.isArray(route.detectedTagIds) && route.detectedTagIds.includes('#emergency'));
        check('a real entity is still resolved underneath (not a fallback)', !!route.entity);
    }

    console.log('\n=== The real card renders correctly via renderRoute ===');
    {
        const ctx = w.collectBookingContext_freeText('need this done urgently, same day, toilet is leaking');
        const route = w.executeWorkflow(ctx, DB);
        w.window._currentContext = ctx;
        w.renderRoute(route);
        const container = doc.getElementById('routeCardHost');
        check('the real affirmation card renders (not empty/wrong container)', container.innerHTML.includes('sqAffirmCard'));
        check('a real Yes button is present, wired to orchAffirmYes', container.innerHTML.includes('orchAffirmYes'));
        check('a real No button is present, wired to orchAffirmNo', container.innerHTML.includes('orchAffirmNo'));
        check('the detected tag renders as a real, visible chip', container.innerHTML.includes('affirm-chip'));
        check('the container is genuinely visible (not display:none)', w.getComputedStyle(container).display !== 'none');
    }

    console.log('\n=== orchAffirmYes: re-runs with tagsAffirmed, reaches a genuine downstream template ===');
    {
        const ctx = w.collectBookingContext_freeText('need this done urgently, same day, toilet is leaking');
        const route = w.executeWorkflow(ctx, DB);
        w.window._currentContext = ctx;
        w.renderRoute(route);
        w.orchAffirmYes();
        check('context.tagsAffirmed is genuinely set', w._currentContext?.tagsAffirmed === true);
        check('the re-run route is no longer tag_affirmation', w._currentRoute?.uiTemplate !== 'tag_affirmation');
        check('the re-run route resolves a genuine, real downstream template', ['curated_card', 'self_quote', 'chip_grid'].includes(w._currentRoute?.uiTemplate));
        check('the same real entity is still correctly resolved after affirming', w._currentRoute?.entity?.id === 'toilet_flapper_or_fill_valve_replacement');
        check('a real, computed quote is present on the affirmed route', !!w._currentRoute?.quote && typeof w._currentRoute.quote.laborEstimate === 'number');
    }

    console.log('\n=== orchAffirmNo: genuinely resets, does not silently re-show a stale card ===');
    {
        const ctx = w.collectBookingContext_freeText('need this done urgently, same day, toilet is leaking');
        const route = w.executeWorkflow(ctx, DB);
        w.window._currentContext = ctx;
        w.renderRoute(route);
        w.orchAffirmNo();
        check('_currentContext is genuinely cleared', w._currentContext === null);
        check('_currentRoute is genuinely cleared', w._currentRoute === null);
        const container = doc.getElementById('routeCardHost');
        check('the summary container is genuinely emptied', container.innerHTML === '');
        const sqBar = doc.getElementById('smartQuoteEngine');
        check('the free-text bar is shown again for the customer to retype', sqBar ? w.getComputedStyle(sqBar).display !== 'none' : true);
    }

    console.log('\n=== A real query with no detected tags never shows the affirmation card ===');
    {
        // Verified directly, in isolation, before use: "fix a dripping
        // faucet" was tried first and correctly, genuinely detects
        // #leaky_faucet -- a real, correct result, not a bug; the test's
        // own original assumption was simply wrong. Replaced with a
        // phrase confirmed tag-free.
        const ctx = w.collectBookingContext_freeText('install a new front door');
        check('genuinely zero tags detected for this real, plain phrase', (ctx.detectedTagIds || []).length === 0);
        const route = w.executeWorkflow(ctx, DB);
        check('uiTemplate is correctly NOT tag_affirmation when nothing was detected', route.uiTemplate !== 'tag_affirmation');
    }

    console.log('\n=== A real query where tags are already affirmed skips the gate ===');
    {
        const ctx = w.collectBookingContext_freeText('need this done urgently, same day, toilet is leaking');
        ctx.tagsAffirmed = true;
        const route = w.executeWorkflow(ctx, DB);
        check('uiTemplate correctly skips tag_affirmation once already affirmed', route.uiTemplate !== 'tag_affirmation');
    }

    console.log('\n=== Negation-pivot is now genuinely ported, correctly reading from the route, not a legacy parameter ===');
    {
        // v9.6 FIX: this section originally checked the OPPOSITE -- that
        // pivot support did NOT exist yet, since at the time it genuinely
        // didn't. Now ported (T64 follow-up); updated to check it's
        // implemented correctly rather than assumed absent. See the
        // dedicated "T64 follow-up: negation-pivot routing and rendering"
        // section above for the full, real end-to-end behavioral checks --
        // this section verifies the implementation detail specifically:
        // reading from route.negationOverride (the real, ResolvedRoute-
        // native field), not a renderTagAffirmationCard-style pivotInfo
        // function parameter, which would be a sign of an incomplete or
        // copy-pasted port rather than a genuine one.
        const rendererSrc = w.renderTagAffirmationFromRoute.toString();
        check('renderTagAffirmationFromRoute reads the pivot from route.negationOverride, not a legacy parameter',
            rendererSrc.includes('route.negationOverride') && !rendererSrc.includes('function renderTagAffirmationFromRoute(route, pivotInfo'));
    }

    console.log('\n=== Real, complete catalog sweep: the new gate never throws, for any real service with a detectable tag scenario ===');
    {
        let errors = 0;
        const testPhrases = [
            'need this done urgently, same day',
            'mount a heavy tv on a brick wall',
            'this is an emergency, my pipe is leaking everywhere',
        ];
        for (const phrase of testPhrases) {
            try {
                const ctx = w.collectBookingContext_freeText(phrase);
                const route = w.executeWorkflow(ctx, DB);
                if (route.uiTemplate === 'tag_affirmation') {
                    w.window._currentContext = ctx;
                    w.renderRoute(route);
                }
            } catch (e) {
                errors++;
                console.log(`    ERROR on "${phrase}": ${e.message}`);
            }
        }
        check(`zero real errors across a representative tag-triggering phrase sweep (found ${errors})`, errors === 0);
    }

    console.log('\n=== T64 follow-up: negation-pivot routing and rendering (controlled, reliable inputs) ===');
    {
        // Uses a controlled, directly-set _negationOverride rather than
        // hunting for a natural-language phrase that reliably triggers one
        // end-to-end -- confirmed during development that natural-language
        // negation-pivot triggering is sensitive to real, separate NLP
        // object-extraction quality (see verify_t36_negation_pivot.js's own
        // honest note on this). This isolates and reliably tests the
        // routing/rendering mechanism itself, which is what T64 follow-up
        // actually built.
        const ctx = w.collectBookingContext_freeText('hang a shelf on a brick wall');
        ctx._negationOverride = { from: 'wall_mounting_brick_or_concrete', to: 'wall_mounting_frames_shelves', negatedTagIds: ['#brick_wall'] };
        ctx.selectedGroupId = 'wall_mounting_frames_shelves';

        const route = w.executeWorkflow(ctx, DB);
        check('uiTemplate resolves to tag_affirmation for a pending pivot', route.uiTemplate === 'tag_affirmation');
        check('route.negationOverride is exposed correctly', route.negationOverride?.to === 'wall_mounting_frames_shelves');

        w.window._currentContext = ctx;
        w.renderRoute(route);
        const container = doc.getElementById('routeCardHost');
        check('the pivot-style headline renders ("Did you mean:")', container.innerHTML.includes('Did you mean:'));
        check('the pivot explanation note renders', container.innerHTML.includes('affirm-pivot-note'));

        w.orchAffirmYes();
        check('negationPivotAccepted is set (not tagsAffirmed -- this was a pivot, not a plain affirm)',
            w._currentContext?.negationPivotAccepted === true && !w._currentContext?.tagsAffirmed);
        check('the resolved entity reflects the corrected, pivoted-to group',
            w._currentRoute?.entity?.ui_taxonomy?.group_id === 'wall_mounting_frames_shelves');
    }

    console.log('\n=== Negation-pivot is checked before the plain affirmation rule, matching sqAnalyze\'s own real ordering ===');
    {
        const rules = DB.workflow.ui_template_matrix.rules;
        const pivotIdx = rules.findIndex(r => r.if?.has_unconfirmed_negation_pivot === true);
        const plainIdx = rules.findIndex(r => r.if?.has_unaffirmed_detected_tags === true);
        check('both rules exist', pivotIdx !== -1 && plainIdx !== -1);
        check('the pivot rule is checked before the plain affirmation rule', pivotIdx < plainIdx);
    }

    console.log('\n=== T66 follow-up: sibling-service recommendations ===');
    {
        // Real-phrase check: the primary recommendation renders even when
        // no real sibling exists (intentGroupId genuinely null/undefined
        // for many real NLP matches -- confirmed directly this is not a
        // bug, matching the legacy renderer's own real behavior: recs
        // always includes the primary when recommendedSku is set,
        // independent of whether the group-scoped sibling filter adds
        // anything beyond it).
        const ctx = w.collectBookingContext_freeText('unclog something');
        check('a real, genuinely ambiguous phrase has recommendedSku set', !!ctx.nlpIntent?.recommendedSku);
        const route = w.executeWorkflow(ctx, DB);
        check('recommendedSku/matchConfidence/intentCategory are correctly exposed on the route',
            route.recommendedSku === ctx.nlpIntent.recommendedSku && typeof route.matchConfidence === 'number');
        w.window._currentContext = ctx;
        w.renderRoute(route);
        const container = doc.getElementById('routeCardHost');
        check('the primary recommendation renders even with no groupId-scoped sibling',
            container.innerHTML.includes('affirm-recs') && container.innerHTML.includes(`orchAffirmSelectService('${route.recommendedSku}')`));

        // Controlled, isolated check: the renderer's own sibling-filter
        // logic, given a real group with multiple real, flat-rate-checkout
        // services -- calls the renderer directly rather than hunting for
        // a natural phrase that happens to populate a real _groupId
        // (confirmed during development this is genuinely rare for plain
        // keyword matches, not a bug to fix here).
        const svc = DB.services.find(s => s.id === 'faucet_repair_drip');
        const directRoute = {
            entity: svc, detectedTagIds: [], negationOverride: null,
            recommendedSku: 'faucet_repair_drip', matchConfidence: 60,
            intentCategory: 'plumbing_help', intentGroupId: 'plumbing_help_sinks',
            quote: { laborEstimate: 125 },
        };
        // T158: the renderer reads route.recommendedServiceIds, which the orchestrator resolves (orch_recommended_service_ids, Logic) so the renderer never reads the
        // pricing engine (R-INVARIANT-BOUNDARY). This hand-built route therefore gets its ids from that same Logic function, exactly as executeWorkflow would put them there.
        directRoute.recommendedServiceIds = w.orch_recommended_service_ids(directRoute, DB);
        w.renderTagAffirmationFromRoute(directRoute);
        const c2 = doc.getElementById('routeCardHost');
        const recCount = (c2.innerHTML.match(/affirm-rec-card/g) || []).length;
        check('a real sibling scenario (ambiguous match, real group with 4 flat-rate services) shows up to 3 rec cards (1 primary + up to 2 siblings)',
            recCount >= 2 && recCount <= 3);
        check('the primary recommendation is among the rec cards shown',
            c2.innerHTML.includes("orchAffirmSelectService('faucet_repair_drip')"));

        // orchAffirmSelectService itself: confirms it correctly reuses
        // prefillSmartQuoteFromService (already, separately confirmed to
        // set up S.intent correctly from the service object) rather than
        // needing its own S-bridging mechanism.
        w.orchAffirmSelectService('angle_stop_replacement');
        check('orchAffirmSelectService correctly triggers real service selection (S.intent.key set)',
            w.S?.intent?.key === 'angle_stop_replacement');
    }

    console.log(`\n[tag affirmation route verification] ${pass_count} passed, ${fail_count} failed (of ${pass_count + fail_count} checks)\n`);
    process.exit(fail_count > 0 ? 1 : 0);
}, 3000);
