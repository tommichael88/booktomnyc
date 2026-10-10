#!/usr/bin/env node
/**
 * verify_curated_intake_confidence_agreement.js
 *
 * Regression test for the Session 4 fix (T115 / Charter §11 item 3,
 * Operator Brief "BTNYC Consolidation Arc"):
 *
 * `sqBuildCuratedIntake` (the legacy curated-card renderer) computed its
 * own, third, hand-rolled confidence formula (base_confidence + module
 * gains + NLP match + tag complexity) that disagreed with the canonical
 * `orch_compute_confidence` already used everywhere else. Customer-visible
 * symptom: on `minimum_quote_confidence: 90` services, the hand-rolled
 * formula could stay under 90 even with every question answered
 * (base_confidence is typically 30-40, and each bonus is individually
 * capped), permanently disabling the Estimate button for a customer who
 * had answered everything asked of them.
 *
 * Fixed with a single call-site swap: `sqBuildCuratedIntake` now calls
 * `orch_compute_confidence({ entity: svc }, activeTagIds, matchConfidence,
 * DB, 'catalog')` directly, matching the resolution shape this same
 * function already passes to `orch_compose_intake_chain`. `entryType:
 * 'catalog'` is correct because this renderer is reached only via catalog
 * taps and the divergence-path return -- both mean "customer chose this
 * exact service by name," which `orch_compute_confidence`'s own 'catalog'
 * case already scores at 100 unconditionally (see that function's own
 * v9.5 FIX comment). `computeUnifiedQuote` was already fixed in a prior
 * session to compute the identical number for the same scenario (no
 * `intentKeyword` -> 100) -- this fix is what makes the THIRD, remaining
 * formula agree with the other two, not the first fix of its kind.
 *
 * Verification uses a full browser-engine load (JSDOM, not function-level
 * extraction), since `sqBuildCuratedIntake` renders real DOM and the bug
 * itself was only externally visible through the rendered Estimate
 * button's disabled state.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require(path.join(__dirname, 'node_modules', 'jsdom'));
const vm = require('vm');

const REPO_ROOT = path.dirname(__dirname);
let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  \u2713 ${label}`); }
    else { fail++; console.log(`  \u2717 ${label}`); }
}

const html = require('./_page.js').readPage(path.join(REPO_ROOT, 'qr.html'));
const btnycJson = fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8');
const DB = JSON.parse(btnycJson);

const dom = new JSDOM(html, {
    url: 'https://tommichael88.github.io/booktomnyc/qr.html',
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    beforeParse(window) {
        window.fetch = async (url) => String(url).includes('btnyc.json')
            ? { ok: true, json: async () => JSON.parse(btnycJson) } : { ok: false, status: 404 };
        window.HTMLElement.prototype.scrollIntoView = function () {};
    }
});

function boot() { return new Promise((resolve) => setTimeout(() => resolve(dom.window), 3000)); }

// Drives a service to "every real question answered" by repeatedly
// resolving the live intake chain and answering whatever is newly
// visible, until nothing changes -- robust to branching chains without
// hand-enumerating each service's own module set.
function answerEverything(w, svc, categoryId) {
    w.sqRestart();
    w.prefillSmartQuoteFromService(svc, categoryId);
    w.S.answers = w.S.answers || {};
    for (let i = 0; i < 10; i++) {
        const allMods = w._resolveIntakeChain({ intake_chain: svc.intake_chain, ...svc });
        const visible = allMods.filter(m => w._isModVisible(m, w.S.answers, allMods));
        const unanswered = visible.filter(m => !w.S.answers[m.moduleKey] && Array.isArray(m.client_response) && m.client_response.length);
        if (!unanswered.length) break;
        for (const m of unanswered) {
            w.S.answers[m.moduleKey] = m.client_response[0].label;
        }
    }
}

(async () => {
    const w = await boot();
    const doc = w.document;

    const targetServices = DB.services.filter(s => (s.confidence_strategy?.minimum_quote_confidence || 0) >= 90);
    check('sanity: at least 15 real services carry minimum_quote_confidence >= 90 (this is the exact scenario the bug required)', targetServices.length >= 15);

    console.log(`\n=== For every real service with minimum_quote_confidence >= 90 (${targetServices.length} total): sqBuildCuratedIntake's Estimate button agrees with computeUnifiedQuote's meetsConfidenceBar, once every question is answered ===`);
    for (const svc of targetServices) {
        const categoryId = svc.ui_taxonomy?.category_id;
        answerEverything(w, svc, categoryId);

        w.sqBuildCuratedIntake(svc, categoryId);
        const estBtn = doc.querySelector('#sqCurEstBtn');
        const rendererReady = !!estBtn && !estBtn.disabled && estBtn.className.includes('ready');

        const liveQuote = w.computeUnifiedQuote({ svc, activeTagIds: [], answers: w.S.answers, qty: w.S.qty || 1 });

        check(`${svc.id}: renderer's Estimate button state (${rendererReady ? 'enabled' : 'disabled'}) agrees with quote.meetsConfidenceBar (${liveQuote.meetsConfidenceBar})`,
            rendererReady === liveQuote.meetsConfidenceBar);
        check(`${svc.id}: specifically, the button is ENABLED once every question is answered (the real, reported symptom -- not just "agrees, both wrong")`,
            rendererReady === true);
    }
})().then(() => {
    console.log('\n=== AppController.js (the extracted standalone module) stays in sync with qr.html ===');
    {
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
        const appController = fs.readFileSync(path.join(REPO_ROOT, 'AppController.js'), 'utf8');
        const body = extractFnBody(appController, 'sqBuildCuratedIntake');
        check('sqBuildCuratedIntake in AppController.js contains the fix (synced via extract_modules.js, not just fixed in qr.html)',
            /orch_compute_confidence\(\{ entity: svc \}, activeTagIds,.*'catalog'\)/.test(body));
        check('the old hand-rolled formula (_baseConf2) is genuinely gone from AppController.js too, not just qr.html',
            !/_baseConf2/.test(body));
    }

    console.log('\n=== Boundary respected: only the one call-site swap, nothing else touched ===');
    {
        const qrHtmlContent = require('./_page.js').readPage(path.join(REPO_ROOT, 'qr.html'));
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
        check('sqBuildCuratedIntake\'s minConf line (already correct, pre-existing) is untouched',
            /const confStrat = resolveBaseConfidenceStrategy\(svc, null\);/.test(extractFnBody(qrHtmlContent, 'sqBuildCuratedIntake')));
        check('orch_compute_confidence itself is untouched -- still contains its own original v9.5 catalog-scoring logic, not modified as a side effect of this fix',
            /entryType === 'catalog'[\s\S]*score = 100;/.test(extractFnBody(qrHtmlContent, 'orch_compute_confidence')));
    }

    console.log(`\n[curated intake confidence agreement] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
    process.exit(fail > 0 ? 1 : 0);
}).catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
});
