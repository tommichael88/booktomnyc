#!/usr/bin/env node
/**
 * verify_reported_ui_bugs_batch1.js
 *
 * Regression test for three real, independently-reported UI bugs, each
 * confirmed via full-document browser load (not function-level extraction,
 * which cannot exercise DOM rendering or catch this class of bug):
 *
 * 1. "Mixed groups and subgroups breaking flow" -- showGroupsForCategory
 *    filtered only by category_id, never excluding groups with a
 *    parent_group, so every subgroup (sharing its parent's category_id)
 *    rendered alongside the actual top-level groups in one flat list.
 *    A foundational navigation bug affecting every category with subgroups,
 *    not just the one reported instance (Appliances).
 *
 * 2. "Routing archetype not respected and irrelevant questions asked" --
 *    computer_diagnostic's intake_chain referenced the generic, shared
 *    "location"/"symptom" modules unmodified. Their default content is
 *    plumbing/washing-machine-oriented ("Kitchen/Bathroom/Shower or tub
 *    area/Floor", "Won't spin/Won't drain/Leaking water") -- every other
 *    service using these modules is a genuine appliance/plumbing repair;
 *    computer_diagnostic was the sole, clear mismatch. Fixed to use
 *    tech_problem_type (already correctly used by a sibling tech_trouble
 *    service) + access.
 *
 * 3. "Urgency makes no difference / Ad lib is a huge mess" --
 *    sqBuildCuratedIntake's own inline price-preview computation
 *    (intakeFee/intakeMin, the per-answer "+$X" impact labels, and the
 *    live complexity-tier escalation) still read the pre-migration
 *    effects.fee/effects.minutes/effects.complexity_override pattern,
 *    which is always undefined for any answer migrated to modifier_ref
 *    (confirmed: the core computeUnifiedQuote already correctly applied
 *    urgency's real $50 fee -- only this separate, duplicate preview
 *    logic inside sqBuildCuratedIntake had never been updated when the
 *    modifier_ref migration happened).
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require(path.join(__dirname, 'node_modules', 'jsdom'));

const REPO_ROOT = path.dirname(__dirname);
let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

const html = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
const btnycJson = fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8');

const dom = new JSDOM(html, {
    url: 'https://tommichael88.github.io/booktomnyc/qr.html',
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    beforeParse(window) {
        window.fetch = async (url) => String(url).includes('btnyc.json')
            ? { ok: true, json: async () => JSON.parse(btnycJson) } : { ok: false, status: 404 };
        window.HTMLElement.prototype.scrollIntoView = function () {};
    }
});

function run() { return new Promise((resolve) => setTimeout(() => resolve(dom.window), 3000)); }

(async () => {
    const w = await run();
    const doc = w.document;

    console.log('=== Bug 1: showGroupsForCategory no longer mixes subgroups into the top-level list ===');
    {
        w.showGroupsForCategory('minor_home_repairs');
        const tiles = [...doc.querySelectorAll('.group-tile .tile-name')].map(el => el.textContent);
        check('Appliances (a real top-level group) is present', tiles.includes('Appliances'));
        check('Washer/Dryer (its subgroups) are correctly absent from the top-level list',
            !tiles.includes('Washer') && !tiles.includes('Dryer'));

        const applianceGroup = w.DB.group.find(g => g.id === 'minor_home_repairs_appliances');
        w.showSubGroups(applianceGroup, 'minor_home_repairs');
        const subTiles = [...doc.querySelectorAll('.group-tile .tile-name')].map(el => el.textContent);
        check('tapping Appliances correctly reveals its real subgroups', subTiles.includes('Washer') && subTiles.includes('Dryer'));
    }
    console.log('\n=== Full catalog sweep: no category anywhere still mixes groups/subgroups ===');
    {
        let mixedFound = 0;
        for (const cat of w.DB.category) {
            w.showGroupsForCategory(cat.id, true);
            const shown = new Set([...doc.querySelectorAll('.group-tile .tile-name')].map(el => el.textContent));
            for (const g of w.DB.group.filter(gr => gr.category_id === cat.id)) {
                const isSubgroup = !!(g.parent_group || g.parent_id);
                if (isSubgroup && shown.has(g.display_name)) mixedFound++;
            }
        }
        check('zero real categories still mix a subgroup into the top-level list', mixedFound === 0);
    }

    console.log('\n=== Bug 2: computer_diagnostic uses relevant modules, not the generic appliance ones ===');
    {
        const svc = w.DB.services.find(s => s.id === 'computer_diagnostic');
        const mods = svc.intake_chain.map(s => s.module);
        check('no longer uses the generic, plumbing-oriented "location" module', !mods.includes('location'));
        check('no longer uses the generic, washing-machine-oriented "symptom" module', !mods.includes('symptom'));
        check('uses tech_problem_type instead (already correct for sibling tech_trouble services)', mods.includes('tech_problem_type'));

        w.sqRestart();
        w.prefillSmartQuoteFromService(svc, 'tech_trouble');
        const questionText = [...doc.querySelectorAll('.sq-ic-q-lbl')].map(el => el.textContent).join(' ');
        check('no longer asks about kitchen/bathroom/shower/floor location', !/Kitchen|Bathroom|Shower or tub/.test(questionText));
        check('no longer asks about spinning/draining/leaking (washing machine symptoms)', !/spin|drain|Leaking water/.test(questionText));
    }

    console.log('\n=== Bug 3: sqBuildCuratedIntake\'s live price preview correctly reflects modifier_ref-based fees ===');
    {
        // T118: was under_cabinet_light_install (electric_lighting) --
        // electric_lighting no longer includes urgency as a category
        // default (explicit operator direction: keep only on categories
        // with genuine emergency scenarios), and sqBuildCuratedIntake's
        // own price/label rendering is chain-derived, not a raw
        // computeUnifiedQuote call on arbitrary answers -- confirmed
        // directly that a service outside urgency's real chain no longer
        // shows either the price change or the impact label for it.
        // faucet_repair_drip (plumbing_help) still genuinely gets urgency.
        const svc = w.DB.services.find(s => s.id === 'faucet_repair_drip');
        w.sqRestart();
        w.prefillSmartQuoteFromService(svc, 'plumbing_help');
        w.S.answers = { faucet_type: 'Two\u2011handle (hot and cold separate)' };
        w.sqBuildCuratedIntake(svc, 'plumbing_help');
        const priceBefore = doc.querySelector('.sq-ic-hdr-foot .sq-ic-price')?.textContent || '';

        w.S.answers.urgency = 'Urgent — today or tomorrow';
        w.sqBuildCuratedIntake(svc, 'plumbing_help');
        const priceAfter = doc.querySelector('.sq-ic-hdr-foot .sq-ic-price')?.textContent || '';

        check('selecting "Urgent" genuinely changes the displayed live price', priceBefore !== priceAfter);
        check('the displayed price increases by exactly the real $50 urgency fee',
            /\$100/.test(priceAfter) && /\+\$50/.test(priceAfter));

        const impactLabels = [...doc.querySelectorAll('.sq-ic-fee')].map(el => el.textContent);
        check('the per-answer "+$X" impact label is shown for the urgency answer (was always blank before this fix)',
            impactLabels.some(t => t.includes('50')));
    }

    console.log(`\n[reported UI bugs batch 1 verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
    process.exit(fail > 0 ? 1 : 0);
})();
