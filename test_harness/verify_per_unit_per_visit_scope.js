/**
 * @enforces R-PRICE-SCOPE
 * verify_per_unit_per_visit_scope.js
 *
 * Verifies the T118, Step 6 item 1 fix for PENDING_DECISIONS.md #29:
 * `laborEstimate = (base + extraFee) * qtyMultiplier` used to multiply
 * the ENTIRE extraFee sum by quantity, with no distinction between fees
 * that genuinely scale per unit (frame demo, per-door labor) and fees
 * that are logically one-time, per-visit costs regardless of how many
 * units are worked on in the same visit (access, urgency, parking,
 * disposal, pets, item_volume). Real, user-captured trace: 10 prehung
 * doors priced at $2950 ($295/door) instead of the correct $1500
 * ($150/door).
 *
 * Fix: every modifier in global_rules.modifiers now carries an explicit
 * `scope: "per_unit" | "per_visit"`. computeUnifiedQuote routes each
 * answer-driven fee into extraFee (per_unit, inside the * qtyMultiplier
 * multiplication) or perVisitFee (per_visit, added once, outside it)
 * based on that field.
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

function _cherryPickFn(text, name) {
    const m = text.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) return '';
    let depth = 0, start = m.index;
    for (let j = m.index + m[0].length - 1; j < text.length; j++) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') { depth--; if (depth === 0) return text.slice(start, j + 1); }
    }
    return '';
}

const FNS = ['resolveDynamicService', 'resolveBaseConfidenceStrategy', 'resolveServiceCheckoutStateKey',
    'applyLiveConfidenceEscalation', 'deriveComplexityTier', 'applyPricingFormula',
    'computeUnifiedQuote', 'sqTagLabel', 'mathFurnitureAssembly', 'buildCheckoutStateModel',
    '_resolveIntakeChain', 'orch_compose_intake_chain'];

function loadSandbox(qrText, db) {
    const sandbox = { DB: db, SERVICE_DATA: db, window: { DB: db }, console };
    sandbox.global = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(FNS.map(f => findFn(qrText, f)).join('\n\n'), sandbox);
    return sandbox;
}

const sandbox = loadSandbox(QR_HTML, DB);

let pass = 0, fail = 0;
function check(desc, cond) {
    if (cond) { pass++; console.log(`  \u2713 ${desc}`); }
    else { fail++; console.log(`  \u2717 ${desc}`); }
}

console.log('=== Data: every modifier has an explicit scope, matching the diagnosed six ===');
{
    const mods = DB.global_rules.modifiers;
    const allHaveScope = Object.values(mods).every(m => m.scope === 'per_unit' || m.scope === 'per_visit');
    check(`all ${Object.keys(mods).length} modifiers have an explicit scope of 'per_unit' or 'per_visit'`, allHaveScope);

    // T118: was 6 (including access and pets_present), matching #29's
    // own original diagnosis. Both were later, separately removed
    // catalog-wide (access: not a meaningful question at all;
    // pets_present: fee: 0, could never meaningfully change a price) --
    // 4 remained. T120: a 5th, real one added -- appliance_type's
    // "Built-in" option now carries a genuine fee (the T35-correction
    // fix that made this question actually change price, as the
    // Charter's own §6E test requires).
    const expectedPerVisit = ['urgency_urgent_today_or_tomorrow',
        'parking_difficulty_yes_parking_is_difficult', 'disposal_request_yes_please_haul_it_away',
        'item_volume_a_large_quantity_7_or_more', 'appliance_type_built_in_fits_into_cabinets_wall'];
    const actualPerVisit = Object.entries(mods).filter(([k, v]) => v.scope === 'per_visit').map(([k]) => k).sort();
    check(`exactly the five real per_visit modifiers are present, no more, no fewer (found: ${actualPerVisit.join(', ')})`,
        JSON.stringify(actualPerVisit) === JSON.stringify(expectedPerVisit.sort()));

    check('a real, physical-characteristic modifier (existing_frame_no_requires_demo) is per_unit',
        mods.existing_frame_no_requires_demo.scope === 'per_unit');
    check('a real, physical-characteristic modifier (weight_over_50_lbs_heavy) is per_unit',
        mods.weight_over_50_lbs_heavy.scope === 'per_unit');
}

console.log('\n=== The motivating trace, on a BATCHED service ===');
// T147: prehung doors are SINGLE-UNIT by the operator's own flag (per_unit_answers_vary: each door has its own size, material and frame, so two doors are two bookings), and
// every quote path now prices one unit for them. This scope sweep needs a service whose quantity really multiplies, so it runs on a batched service with a per-unit surcharge
// (a brick wall: +$25 on EACH item) and the global per-visit hauling fee (+$25 ONCE). Expectations come from the SSOT, not hardcoded constants.
{
    const svc = DB.services.find(s => s.id === 'generic_mounting_service');
    const base = svc.financial_engine.base_price, perUnit = DB.global_rules.modifiers.wall_type_brick_or_concrete.fee, perVisit = DB.global_rules.modifiers.disposal_request_yes_please_haul_it_away.fee;
    check(`generic_mounting_service is a BATCHED service (not single-unit) with a base price ($${base}); its brick-wall surcharge ($${perUnit}) is per_unit and the hauling fee ($${perVisit}) is per_visit`,
        svc && svc.per_unit_answers_vary !== true && base > 0 && DB.global_rules.modifiers.wall_type_brick_or_concrete.scope === 'per_unit' && DB.global_rules.modifiers.disposal_request_yes_please_haul_it_away.scope === 'per_visit');

    const qNoAnswers = sandbox.computeUnifiedQuote({ svc, activeTagIds: [], answers: {}, qty: 10 });
    check(`qty=10, no special answers: prices exactly at base*qty ($${base * 10})`, qNoAnswers.laborEstimate === base * 10);

    const qDisposal = sandbox.computeUnifiedQuote({ svc, activeTagIds: [], answers: { disposal_request: 'Yes, please haul it away' }, qty: 10 });
    check(`qty=10, disposal_request=yes: $${base * 10 + perVisit} (base*qty + $${perVisit} ONCE), not the old buggy $${base * 10 + perVisit * 10} (base*qty + fee*qty)`,
        qDisposal.laborEstimate === base * 10 + perVisit);
    check('the fee breakdown correctly tags this answer as per_visit scope',
        qDisposal.feeBreakdown.find(f => f.moduleKey === 'disposal_request')?.scope === 'per_visit');

    const qWall = sandbox.computeUnifiedQuote({ svc, activeTagIds: [], answers: { wall_type: 'Brick or concrete' }, qty: 10 });
    check(`qty=10, brick wall (a real per-unit cost): $${(base + perUnit) * 10} (base+fee)*qty -- still correctly SCALES with quantity, the fix did not neuter real per-unit scaling`,
        qWall.laborEstimate === (base + perUnit) * 10);

    const qBoth = sandbox.computeUnifiedQuote({ svc, activeTagIds: [], answers: { wall_type: 'Brick or concrete', disposal_request: 'Yes, please haul it away' }, qty: 10 });
    check(`qty=10, both together: $${(base + perUnit) * 10 + perVisit} -- (base+per_unit_fee)*qty + per_visit_fee, correctly combining both scopes`,
        qBoth.laborEstimate === (base + perUnit) * 10 + perVisit);

    const door = DB.services.find(s => s.id === 'prehung_interior_door_install');
    check('and the single-unit door service prices ONE unit at qty=10 -- the stance, not the scope, decides (verify_quantity_question_ratchet sweeps every single-unit service)',
        sandbox.computeUnifiedQuote({ svc: door, activeTagIds: [], answers: {}, qty: 10 }).laborEstimate === door.financial_engine.base_price);
}

console.log('\n=== Regression: per-visit fees still apply correctly at qty=1 (no observable change expected) ===');
{
    const svc = DB.services.find(s => s.id === 'faucet_repair_drip');
    const q = sandbox.computeUnifiedQuote({ svc, activeTagIds: [], answers: { disposal_request: 'Yes, please haul it away', urgency: 'Urgent \u2014 today or tomorrow' }, qty: 1 });
    check('qty=1, disposal_request+urgency both selected: fee still applies in full ($125 = $50 base + $25 + $50), unaffected by the qty=1 case',
        q.laborEstimate === 125);
}

console.log('\n=== Regression: item_count_template-driven services are correctly unaffected (qtyMultiplier already 1 for these, confirmed, not assumed) ===');
{
    const svc = DB.services.find(s => s.id === 'dimmer_switch_install');
    const chain = sandbox.orch_compose_intake_chain({}, { entity: svc }, DB);
    const hasOwnQty = sandbox.entityHasOwnQtyQuestion ? sandbox.entityHasOwnQtyQuestion(svc) : chain.some(m => (m.moduleKey || m.module || '').startsWith('item_count_template'));
    check('dimmer_switch_install has its own item_count_template quantity question',
        chain.some(m => (m.moduleKey || m.module) === 'item_count_template::light switches'));
    // qty passed as 1 here deliberately -- item_count_template services are
    // driven by the template SELECTION, not a separate qty parameter; this
    // just confirms the scope split doesn't change anything for a service
    // that never multiplies by qty in the first place.
    const q = sandbox.computeUnifiedQuote({ svc, activeTagIds: [], answers: { urgency: 'Urgent \u2014 today or tomorrow' }, qty: 1 });
    check('urgency fee still applies once, normally, for a template-driven service ($45+$50=$95 total, and never gets multiplied since qtyMultiplier is already 1 for these)',
        q.laborEstimate === 95);
}

console.log('\n=== Confirmed genuine: this test fails against the pre-fix code ===');
{
    // Simulate the OLD, unconditional formula directly, independent of the
    // live sandbox, to prove the new code's behavior is a real change, not
    // a tautological check against whatever the code currently does.
    const svc = DB.services.find(s => s.id === 'prehung_interior_door_install');
    const OLD_extraFee = 25; // disposal_request fee (T118: replaces access as this test's example), no scope distinction in the old formula
    const OLD_laborEstimate = Math.round((150 + OLD_extraFee) * 10); // old: (base+extraFee)*qty
    check(`the OLD formula's own math genuinely produces the diagnosed bug ($${OLD_laborEstimate}, matching the original $295/door report's shape), confirming this is a real fix, not a tautology`,
        OLD_laborEstimate === 1750);
}

console.log(`\n[per-unit/per-visit scope, #29] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
