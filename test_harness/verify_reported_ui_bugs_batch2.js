#!/usr/bin/env node
/**
 * verify_reported_ui_bugs_batch2.js
 *
 * Regression test for three real, distinct bugs found from two annotated
 * screenshots (prehung_interior_door_install, cabinet_knob_or_pull_install).
 *
 * NOTE (stop-the-line pass): BUG 1's and BUG 2's original fixes lived only in the legacy curated-intake builder, which is retired. Their
 * UI intent is now verified against the live rendered card in verify_curated_card_live_behavior.js; this file keeps the parts that are
 * not about that builder (the pricing fact behind BUG 1, and BUG 3's SSOT data).
 *
 * BUG 1 — misleading "+Xmin" per-answer label. Shown for ANY mins > 0,
 * regardless of whether minutes actually translate to price for that
 * service's pricing_archetype. Confirmed directly: client_supplying_door's
 * "No, I need you to procure it" (+45min) has ZERO effect on
 * prehung_interior_door_install's real laborEstimate ($150 either way) --
 * a flat_simple service, where minutes are purely informational. The
 * customer reasonably reads "+45min" as implying "+some $", which was
 * false. Fixed to gate the minutes-only display on pricing_archetype
 * (hourly_timed/formula/tiered_per_unit only).
 *
 * BUG 2 — broken question-number badges. The `shown` counter was reused
 * for two incompatible purposes: internal maxQs capping (only increments
 * for UNANSWERED modules) and the customer-facing question number
 * (displayed for every module, answered or not). This produced exactly
 * the reported "0, 1, 1, 2, 2, 2" pattern instead of a real 1-6 sequence
 * -- and very plausibly explains the separate "why won't the button
 * activate" confusion, since a customer reading that broken sequence has
 * no reliable way to tell which questions are still genuinely unanswered.
 * Fixed with a separate, dedicated `questionIndex` counter for display
 * only -- `shown`'s own, correct capping behavior is untouched.
 *
 * BUG 3 — cabinet_knob_or_pull_install showed 5 group-scoped tags
 * (#heavy_lifting, #part_order_likely, #two_trip_minimum, #heavy_item,
 * #complex_assembly) that make sense for other real services in
 * minor_home_repairs_cabinets_drawers (e.g. a full cabinet install) but
 * not for swapping a single knob. Same shape as T77's
 * under_cabinet_light_install fix -- extended the same, already-built
 * excluded_service_ids mechanism rather than inventing a new one.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML = require('./_page.js').readPage(path.join(REPO_ROOT, 'qr.html'));
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

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

console.log('=== Bug 1: the misleading +Xmin label now respects pricing_archetype ===');
{
    const sandbox = { DB, SERVICE_DATA: DB, window: { DB } };
    sandbox.global = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(REPO_ROOT, 'pricing_engine.js'), 'utf8'), sandbox, { filename: 'pe' });

    const svc = DB.services.find(s => s.id === 'prehung_interior_door_install');
    check('prehung_interior_door_install is confirmed flat_simple (the exact reported case)',
        svc.financial_engine.pricing_archetype === 'flat_simple');
    const withoutAnswer = sandbox.computeUnifiedQuote({ svc, activeTagIds: [], answers: { existing_frame: 'Yes' }, qty: 1 });
    const withAnswer = sandbox.computeUnifiedQuote({ svc, activeTagIds: [], answers: { existing_frame: 'Yes', client_supplying_door: 'No, I need you to procure it' }, qty: 1 });
    check('confirms the real bug: this answer genuinely has zero price effect for this service',
        withoutAnswer.laborEstimate === withAnswer.laborEstimate);

    // (Two source-shape checks on the retired legacy curated-intake builder -- `minsAffectPrice` and its archetype gate -- were
    // removed with that builder. The customer-facing intent, "no misleading +Xmin label", is verified on the LIVE card, in a real
    // browser, for every service, in verify_curated_card_live_behavior.js. R-INVARIANT-NOLEGACY: the bug is gone because the code is gone.)

    const svcHourly = DB.services.find(s => s.id === 'dishwasher_repair');
    check('sanity: an hourly_timed-adjacent service is unaffected by this gate (different archetype, diagnostic_open)',
        svcHourly.financial_engine.pricing_archetype !== 'flat_simple');
}

console.log('\n=== Bug 2: question numbering -- now verified on the live card (see verify_curated_card_live_behavior.js) ===');
{
    // (Four source-shape checks on the retired legacy builder's `questionIndex`/`shown` counters were removed with it. The live card numbers
    // questions by their position in the visible chain; that numbering is verified on the real rendered card in
    // verify_curated_card_live_behavior.js, which FAILS if the capping counter is ever reused for display again -- proven by mutation.)
}

console.log('\n=== Bug 3: cabinet_knob_or_pull_install\'s irrelevant chips are now excluded ===');
{
    const html = QR_HTML;
    const m = extractFn(html, 'tagValidForCategory');
    const sandbox = { DB, console };
    sandbox.global = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(m, sandbox, { filename: 'tvfc' });

    const excludedTags = ['#heavy_lifting', '#part_order_likely', '#two_trip_minimum', '#heavy_item', '#complex_assembly'];
    for (const tid of excludedTags) {
        check(`${tid} is correctly excluded for cabinet_knob_or_pull_install specifically`,
            !sandbox.tagValidForCategory(tid, 'minor_home_repairs', 'minor_home_repairs_cabinets_drawers', 'cabinet_knob_or_pull_install'));
        check(`${tid} still correctly applies to OTHER services in the same group (group-level scoping intact)`,
            sandbox.tagValidForCategory(tid, 'minor_home_repairs', 'minor_home_repairs_cabinets_drawers', 'some_other_cabinet_service'));
    }

    let after = 0;
    for (const tidKey of Object.keys(DB.smart_tags)) {
        if (sandbox.tagValidForCategory(tidKey, 'minor_home_repairs', 'minor_home_repairs_cabinets_drawers', 'cabinet_knob_or_pull_install')) after++;
    }
    // T118: 14 -> 13. #access_obstructed (previously one of these 14 valid
    // chips, applicable_categories: ['all']) was deleted catalog-wide
    // along with the access module -- one fewer real chip, not a new
    // exclusion or a regression.
    // T118: 13 -> 12. #pets_on_site (previously one of these 13 valid
    // chips, applicable_categories: ['all']) was deleted alongside
    // pets_present itself (fee: 0, could never meaningfully change a
    // price) -- one fewer real chip, not a new exclusion or regression.
    check('total chip count for this service dropped from 19 to 12 (real, verified reduction)', after === 12);
}

console.log(`\n[UI bugs batch 2 verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
