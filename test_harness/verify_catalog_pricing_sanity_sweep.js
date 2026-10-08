/**
 * verify_catalog_pricing_sanity_sweep.js
 *
 * A complete, systematic pricing sanity sweep across the entire real
 * catalog (74 named services + 96 dynamic_services, every real answer
 * option to every question, a real quantity range) -- built directly in
 * response to T57's cabinet-knob overcharge (found from one screenshot,
 * a real, confirmed ~10x overcharge that had been live undiscovered) to
 * turn "check the one reported case" into "systematically check
 * everything for the same classes of bug, permanently."
 *
 * This is not a one-off script -- it's wired into run_all.sh's own
 * verify_*.js auto-discovery, the same permanent-regression-coverage
 * discipline applied everywhere else in this project.
 *
 * A real, honest limitation, stated plainly rather than hidden: this
 * sweep varies one question's answer at a time (holding all others at
 * their first/default option), not every full combination -- combinatorial
 * coverage across services with many multi-option questions would be
 * enormous. This exact methodology is what caught T57's actual bug
 * (which only manifested on install_type's second option), so it's a
 * real, meaningful bar, not a token check -- but a bug that only
 * manifests when TWO OR MORE non-default answers combine would not be
 * caught here. Recorded as real, remaining risk, not claimed as complete
 * coverage.
 *
 * First real run (this session) found a genuine, severe, previously-
 * undiscovered bug this way: 3 dynamic_services entries
 * (minor_home_repairs+Diagnostic, plumbing_help+Diagnostic,
 * tech_trouble+Diagnostic) had financial_engine.checkout_state
 * contradicting their own confidence_strategy._variability_tier,
 * meaning customers whose issue resolved to these entities saw a
 * "✅ Fixed price / Add to Cart" checkout experience when the real,
 * correct experience (per the entity's own data) should have been
 * "🔍 On-site quote / Request On-Site Quote" -- a real, severe,
 * customer-facing trust issue, not caught by any of this sweep's own
 * explicit numeric checks (NaN/negative/cliff/disproportionate-rate) --
 * caught instead because the application's own internal
 * diagnostic_governance check (a real, pre-existing v9.5 fix) fired a
 * console.warn during the sweep. This test locks in that governance
 * check's own silence as a real, checked assertion, not just something
 * to notice by accident in console output.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const REPO_ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
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
    const DB = w.DB;

    // Capture real console.warn calls during the sweep -- this is how
    // the diagnostic_governance bug was actually found; lock that
    // detection channel itself into a real, checked assertion.
    const capturedWarnings = [];
    const originalWarn = w.console.warn;
    w.console.warn = (...args) => { capturedWarnings.push(args.join(' ')); };

    const rates = Object.values(DB.global_rules.complexity_tiers).map(t => t.hourly_rate);
    const minRate = Math.min(...rates), maxRate = Math.max(...rates);
    const QTYS = [1, 2, 3, 5, 10, 20, 50, 100];
    const issues = [];
    let totalCombosTested = 0;

    function firstAnswers(entity) {
        const answers = {};
        for (const step of (entity.intake_chain || [])) {
            const mod = DB.intake_modules[step.module];
            const responses = mod?.client_response;
            if (Array.isArray(responses) && responses.length > 0) answers[step.module] = responses[0].label;
        }
        return answers;
    }

    function testCurve(entityLabel, callArgs, answers, label) {
        let prevPrice = null;
        const curve = [];
        for (const qty of QTYS) {
            totalCombosTested++;
            let result;
            try {
                result = w.computeUnifiedQuote({ ...callArgs, answers, qty });
            } catch (e) {
                issues.push({ entity: entityLabel, type: 'THROWS', detail: `${label}, qty=${qty}: ${e.message}` });
                continue;
            }
            const price = result?.laborEstimate;
            curve.push([qty, price]);
            if (price == null || Number.isNaN(price) || !Number.isFinite(price)) {
                issues.push({ entity: entityLabel, type: 'NON_FINITE_PRICE', detail: `${label}, qty=${qty}: laborEstimate=${price}` });
            } else if (price < 0) {
                issues.push({ entity: entityLabel, type: 'NEGATIVE_PRICE', detail: `${label}, qty=${qty}: laborEstimate=${price}` });
            } else if (prevPrice != null && price < prevPrice) {
                issues.push({ entity: entityLabel, type: 'DOWNWARD_CLIFF', detail: `${label}: curve: ${JSON.stringify(curve)}` });
            }
            if (price != null && Number.isFinite(price)) prevPrice = price;
        }
    }

    function sweepEntity(entityLabel, entity, callArgs, expMinForSanity) {
        const base = firstAnswers(entity);
        testCurve(entityLabel, callArgs, base, 'baseline (all first answers)');
        // Real fix for a real blind spot found while building this sweep:
        // testing only the first answer to every question would NOT have
        // caught T57's actual bug (only manifested on install_type's
        // SECOND option). Every non-first option to every real,
        // multi-option question gets its own full quantity curve.
        for (const step of (entity.intake_chain || [])) {
            const mod = DB.intake_modules[step.module];
            const responses = mod?.client_response;
            if (!Array.isArray(responses) || responses.length < 2) continue;
            for (let i = 1; i < responses.length; i++) {
                const variantAnswers = { ...base, [step.module]: responses[i].label };
                testCurve(entityLabel, callArgs, variantAnswers, `${step.module}="${responses[i].label}"`);
            }
        }
        if (expMinForSanity && expMinForSanity > 0) {
            try {
                const r1 = w.computeUnifiedQuote({ ...callArgs, answers: base, qty: 1 });
                const impliedRate = (r1.laborEstimate / expMinForSanity) * 60;
                // Generous bounds (6x the real max hourly rate) -- wide
                // enough to allow flat-rate floors and formula surcharges
                // without false-flagging legitimate pricing, tight enough
                // to catch a genuine order-of-magnitude problem like T57's.
                if (impliedRate > maxRate * 6) {
                    issues.push({ entity: entityLabel, type: 'DISPROPORTIONATE_RATE', detail: `qty=1: $${r1.laborEstimate} for ~${expMinForSanity}min expected = $${impliedRate.toFixed(0)}/hr implied (vs real range $${minRate}-${maxRate}/hr)` });
                }
            } catch (e) { /* not every entity has a comparable expected-minutes figure */ }
        }
    }

    for (const svc of DB.services) {
        sweepEntity(svc.id, svc, { svc, activeTagIds: [] }, svc.operational_metrics?.expected_minutes);
    }

    let dynTested = 0;
    for (const [key, dynDef] of Object.entries(DB.dynamic_services)) {
        const tm = dynDef.default_estimate?.total_minutes;
        const expMin = tm ? (tm.min + tm.max) / 2 : (dynDef.operational_metrics?.minimum_minutes || null);
        sweepEntity(key, dynDef, { svc: null, dynDef, activeTagIds: [] }, expMin);
        dynTested++;
    }

    w.console.warn = originalWarn;

    console.log(`=== Catalog pricing sanity sweep: ${DB.services.length} named services + ${dynTested} dynamic_services, ${totalCombosTested} total price computations ===\n`);

    check(`zero services/entities throw during any real answer/quantity combination (found ${issues.filter(i => i.type === 'THROWS').length})`,
        issues.filter(i => i.type === 'THROWS').length === 0);
    check(`zero non-finite (NaN/undefined) prices anywhere in the catalog (found ${issues.filter(i => i.type === 'NON_FINITE_PRICE').length})`,
        issues.filter(i => i.type === 'NON_FINITE_PRICE').length === 0);
    check(`zero negative prices anywhere in the catalog (found ${issues.filter(i => i.type === 'NEGATIVE_PRICE').length})`,
        issues.filter(i => i.type === 'NEGATIVE_PRICE').length === 0);
    check(`zero downward price cliffs (price decreasing as quantity increases) anywhere in the catalog (found ${issues.filter(i => i.type === 'DOWNWARD_CLIFF').length}) -- this is exactly T57's bug class`,
        issues.filter(i => i.type === 'DOWNWARD_CLIFF').length === 0);
    check(`zero wildly disproportionate implied hourly rates (>${maxRate * 6}/hr against a real $${minRate}-${maxRate}/hr range) anywhere (found ${issues.filter(i => i.type === 'DISPROPORTIONATE_RATE').length})`,
        issues.filter(i => i.type === 'DISPROPORTIONATE_RATE').length === 0);

    if (issues.length > 0) {
        console.log('\n--- Full issue detail (should be empty above; printed for diagnosis if not) ---');
        for (const i of issues) console.log(`  [${i.type}] ${i.entity}: ${i.detail}`);
    }

    // ─────────────────────────────────────────────────────────────
    // Pairwise multi-answer combination sweep (T63): T61/T62's own
    // stated limitation was "varies one question at a time" -- a bug
    // requiring two non-default answers to combine would not be
    // caught. Extended here directly.
    //
    // A real, honest lesson learned building this: a first version
    // compared "both non-default answers combined" against "each
    // answer alone" using each OTHER question's plain first/default
    // option as the baseline -- and found 15 apparent "combining made
    // it cheaper" cases. Manually traced two in full
    // (toilet_install's removal/toilet_style_pref,
    // bathroom_exhaust_fan_replacement's ducting/mounting_height) and
    // confirmed, with exact arithmetic, both were false positives: the
    // pricing was genuinely, correctly additive throughout. The flaw
    // was the comparison baseline itself -- several modules' FIRST
    // option happens to carry a real fee (modifier_ref), so using
    // "first" as a stand-in for "neutral" silently inflated the
    // "alone" price being compared against. Fixed here by using each
    // question's genuine no-fee option (the first one with no
    // modifier_ref, confirmed present on every question checked this
    // way) as the real neutral baseline, not just "first".
    console.log('\n=== Pairwise multi-answer combinations (T63) ===');
    let pairwiseCombos = 0, pairwiseEntities = 0;
    const pairwiseIssues = [];

    function neutralAnswers(entity) {
        const answers = {};
        for (const step of (entity.intake_chain || [])) {
            const mod = DB.intake_modules[step.module];
            const responses = mod?.client_response;
            if (!Array.isArray(responses) || responses.length === 0) continue;
            const noFee = responses.find(r => !r.modifier_ref);
            answers[step.module] = (noFee || responses[0]).label;
        }
        return answers;
    }

    function multiOptionQuestions(entity) {
        const qs = [];
        for (const step of (entity.intake_chain || [])) {
            const mod = DB.intake_modules[step.module];
            const responses = mod?.client_response;
            if (Array.isArray(responses) && responses.length > 1) qs.push({ moduleKey: step.module, options: responses.map(r => r.label) });
        }
        return qs;
    }

    function sweepPairwise(entityLabel, entity, callArgs) {
        const neutralBase = neutralAnswers(entity);
        const questions = multiOptionQuestions(entity);
        if (questions.length < 2) return;
        pairwiseEntities++;

        for (let a = 0; a < questions.length; a++) {
            for (let b = a + 1; b < questions.length; b++) {
                const qA = questions[a], qB = questions[b];
                for (let i = 0; i < qA.options.length; i++) {
                    for (let j = 0; j < qB.options.length; j++) {
                        pairwiseCombos++;
                        const answers = { ...neutralBase, [qA.moduleKey]: qA.options[i], [qB.moduleKey]: qB.options[j] };
                        let result;
                        try {
                            result = w.computeUnifiedQuote({ ...callArgs, answers, qty: 1 });
                        } catch (e) {
                            pairwiseIssues.push(`[THROWS] ${entityLabel}: ${qA.moduleKey}="${qA.options[i]}" + ${qB.moduleKey}="${qB.options[j]}": ${e.message}`);
                            continue;
                        }
                        const price = result?.laborEstimate;
                        if (price == null || !Number.isFinite(price) || price < 0) {
                            pairwiseIssues.push(`[BAD_PRICE] ${entityLabel}: ${qA.moduleKey}="${qA.options[i]}" + ${qB.moduleKey}="${qB.options[j]}": laborEstimate=${price}`);
                        }
                    }
                }
                // Correctly-baselined interaction check: with a genuine
                // neutral baseline for every OTHER question, does adding
                // BOTH A's and B's real, fee-bearing options ever price
                // lower than adding just the more expensive one alone?
                const feeOptA = qA.options.find((_, idx) => DB.intake_modules[qA.moduleKey].client_response[idx].modifier_ref);
                const feeOptB = qB.options.find((_, idx) => DB.intake_modules[qB.moduleKey].client_response[idx].modifier_ref);
                if (feeOptA && feeOptB) {
                    try {
                        const pA = w.computeUnifiedQuote({ ...callArgs, answers: { ...neutralBase, [qA.moduleKey]: feeOptA }, qty: 1 }).laborEstimate;
                        const pB = w.computeUnifiedQuote({ ...callArgs, answers: { ...neutralBase, [qB.moduleKey]: feeOptB }, qty: 1 }).laborEstimate;
                        const pBoth = w.computeUnifiedQuote({ ...callArgs, answers: { ...neutralBase, [qA.moduleKey]: feeOptA, [qB.moduleKey]: feeOptB }, qty: 1 }).laborEstimate;
                        if ([pA, pB, pBoth].every(Number.isFinite) && (pBoth < pA || pBoth < pB)) {
                            pairwiseIssues.push(`[COMBINATION_LOSES_FEE] ${entityLabel}: ${qA.moduleKey}="${feeOptA}" alone(neutral-baseline)=$${pA}, ${qB.moduleKey}="${feeOptB}" alone(neutral-baseline)=$${pB}, both combined=$${pBoth}`);
                        }
                    } catch (e) { /* already caught above */ }
                }
            }
        }
    }

    for (const svc of DB.services) sweepPairwise(svc.id, svc, { svc, activeTagIds: [] });
    for (const [key, dynDef] of Object.entries(DB.dynamic_services)) sweepPairwise(key, dynDef, { svc: null, dynDef, activeTagIds: [] });

    console.log(`Pairwise-tested ${pairwiseEntities} entities with 2+ multi-option questions, ${pairwiseCombos} total combinations, correctly-baselined this time.\n`);
    check(`zero bad prices (non-finite/negative) across every pairwise answer combination (found ${pairwiseIssues.filter(s => s.startsWith('[BAD_PRICE]') || s.startsWith('[THROWS]')).length})`,
        pairwiseIssues.filter(s => s.startsWith('[BAD_PRICE]') || s.startsWith('[THROWS]')).length === 0);
    check(`zero cases where combining two real, fee-bearing answers prices lower than either alone, using a genuine neutral baseline (found ${pairwiseIssues.filter(s => s.startsWith('[COMBINATION_LOSES_FEE]')).length})`,
        pairwiseIssues.filter(s => s.startsWith('[COMBINATION_LOSES_FEE]')).length === 0);
    if (pairwiseIssues.length > 0) {
        console.log('\n--- Pairwise issue detail ---');
        for (const i of pairwiseIssues) console.log(`  ${i}`);
    }

    // Locks in T-fix (diagnostic_governance): a fresh sweep across the
    // complete, real catalog must produce zero governance warnings.
    // Found via exactly this mechanism the first time this sweep ran --
    // 3 dynamic_services entries had checkout_state contradicting their
    // own variability_tier. Fixed at the data level; this assertion is
    // the permanent guard against it recurring.
    const govWarnings = capturedWarnings.filter(w => w.includes('diagnostic_governance violation'));
    const uniqueGovEntities = [...new Set(govWarnings.map(w => w.match(/violation\]\s*([^:]+):/)?.[1]).filter(Boolean))];
    check(`zero diagnostic_governance violations anywhere in the real catalog (found ${uniqueGovEntities.length} distinct entit${uniqueGovEntities.length === 1 ? 'y' : 'ies'}: ${uniqueGovEntities.join(', ') || 'none'})`,
        uniqueGovEntities.length === 0);

    console.log(`\n[catalog pricing sanity sweep] ${pass_count} passed, ${fail_count} failed (of ${pass_count + fail_count} checks)\n`);
    process.exit(fail_count > 0 ? 1 : 0);
}, 3000);
