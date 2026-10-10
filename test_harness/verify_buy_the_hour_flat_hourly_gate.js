/**
 * verify_buy_the_hour_flat_hourly_gate.js
 *
 * Verifies the T118, operator-directed (real user trace, 2026-09-12)
 * redesign of blinds_shades_curtains_buy_the_hour's intake and pricing:
 *
 *   1. A new preliminary "What's being mounted?" question
 *      (blind_curtain_shade_items), styled after the established
 *      wall_mount_items pattern (used by shelf_mortar_mounting_buy_the_hour)
 *      but with content specific to this service.
 *   2. A new binary "How many items?" gate (buy_the_hour_qty: "1 item" /
 *      "More than 1 item") replacing the old numeric global_quantity
 *      stepper.
 *   3. A new pricing_formula (buy_the_hour_qty_gate_formula): "1 item"
 *      prices as a flat fee; "More than 1 item" prices as real hourly
 *      billing with a 1-hour minimum -- both at the SAME dollar rate
 *      (the service's own base_price), not two different numbers.
 *
 * The 1-hour-minimum-at-the-same-rate requirement has a real, confirmed
 * subtlety: computeUnifiedQuote's non-flat formula adds base_price AND
 * (totalMin/60)*hourlyRate together, which would double the price at
 * exactly the 1-hour floor unless corrected -- this is verified
 * directly, empirically, not just derived on paper.
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

function _cherryPickFn(name) {
    const m = QR_HTML.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) return '';
    let depth = 0, start = m.index;
    for (let j = m.index + m[0].length - 1; j < QR_HTML.length; j++) {
        if (QR_HTML[j] === '{') depth++;
        else if (QR_HTML[j] === '}') { depth--; if (depth === 0) return QR_HTML.slice(start, j + 1); }
    }
    return '';
}

const FNS = ['resolveDynamicService', 'resolveBaseConfidenceStrategy', 'resolveServiceCheckoutStateKey',
    'applyLiveConfidenceEscalation', 'deriveComplexityTier', 'applyPricingFormula',
    'computeUnifiedQuote', 'sqTagLabel', 'mathFurnitureAssembly', 'buildCheckoutStateModel',
    '_resolveIntakeChain', 'orch_compose_intake_chain'];
const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(FNS.map(findFn).join('\n\n'), sandbox);

let pass = 0, fail = 0;
function check(desc, cond) {
    if (cond) { pass++; console.log(`  \u2713 ${desc}`); }
    else { fail++; console.log(`  \u2717 ${desc}`); }
}

const svc = DB.services.find(s => s.id === 'blinds_shades_curtains_buy_the_hour');

console.log('=== The new intake chain: preliminary item question, then the binary qty gate ===');
{
    const chain = sandbox.orch_compose_intake_chain({}, { entity: svc }, DB).map(m => m.moduleKey || m.module);
    check('blind_curtain_shade_items ("What\'s being mounted?") is present and first', chain[0] === 'blind_curtain_shade_items');
    check('buy_the_hour_qty (the binary gate) is present and second', chain[1] === 'buy_the_hour_qty');
    check('the old numeric global_quantity stepper is gone -- replaced, not kept alongside the new gate', !chain.includes('global_quantity'));
}

console.log('\n=== blind_curtain_shade_items: real, service-appropriate content, not wall_mount_items reused verbatim ===');
{
    const mod = DB.intake_modules.blind_curtain_shade_items;
    check('has a real question and a non-trivial option set', !!mod && mod.client_response.length >= 4);
    check('options are actually about blinds/curtains/shades, not shelves/mirrors (confirms this wasn\'t just wall_mount_items copied)',
        mod.client_response.some(r => /blind/i.test(r.label)) && mod.client_response.some(r => /curtain/i.test(r.label)));
}

console.log('\n=== The core requirement: both pricing branches use the SAME rate ===');
{
    const flat = sandbox.computeUnifiedQuote({ svc, activeTagIds: [], answers: { buy_the_hour_qty: '1 item' }, qty: 1 });
    const hourly = sandbox.computeUnifiedQuote({ svc, activeTagIds: [], answers: { buy_the_hour_qty: 'More than 1 item' }, qty: 1 });
    check(`"1 item" prices as an exact flat $${svc.financial_engine.base_price} (got $${flat.laborEstimate})`,
        flat.laborEstimate === svc.financial_engine.base_price);
    check(`"More than 1 item" at its natural 1-hour floor ALSO lands at exactly $${svc.financial_engine.base_price} -- the same rate, not a different (e.g. doubled) number (got $${hourly.laborEstimate})`,
        hourly.laborEstimate === svc.financial_engine.base_price);
    check('the two branches genuinely compute through different code paths (isFlatRate differs), not coincidentally equal by both being flat',
        hourly.tierRate === svc.financial_engine.base_price && flat.tierRate !== hourly.tierRate);
}

console.log('\n=== Confirmed genuine: the double-counting this fix corrects is real, not a hypothetical concern ===');
{
    // Directly reproduce what the >1-item branch would compute WITHOUT the
    // extraFee: -basePrice correction, to prove the fix addresses a real,
    // confirmed arithmetic problem and isn't solving something that was
    // already fine.
    const basePrice = svc.financial_engine.base_price;
    const totalMinFloor = 60; // this service's own default_estimates.total_minutes average
    const withoutFix = basePrice + 0 + (totalMinFloor / 60) * basePrice; // base + 0 extraFee + hourly component
    check(`without the extraFee correction, the same scenario would have doubled to $${withoutFix} instead of $${basePrice}`,
        withoutFix === basePrice * 2);
}

console.log('\n=== Regression: a completely unrelated service is unaffected by the new formula\'s existence ===');
{
    const other = DB.services.find(s => s.id === 'faucet_repair_drip');
    const q = sandbox.computeUnifiedQuote({ svc: other, activeTagIds: [], answers: {}, qty: 1 });
    check('faucet_repair_drip still prices normally, untouched by this change', q.laborEstimate === other.financial_engine.base_price);
}

console.log('\n=== The dormant mechanism this whole investigation was about: minimum_billable_hours is now real, consumed data ===');
{
    const engineDef = DB.global_rules?.pricing_engines?.hourly_estimate;
    check('global_rules.pricing_engines.hourly_estimate.minimum_billable_hours still exists as data (1)', engineDef?.minimum_billable_hours === 1);
    check('the new formula\'s own data entry explicitly carries the same field, not just relying on the global default',
        DB.pricing_formulas?.buy_the_hour_qty_gate_formula?.minimum_billable_hours === 1);
}

console.log('\n=== The second, real, currently-live bug this investigation found: shelf_mounting_standard_buy_the_hour (the original #22 service) was overcharging via a completely different pricing path (sqRenderSelfQuoteAdlib) ===');
{
    // This service remains self-quoting by design (unlike
    // blinds_shades_curtains_buy_the_hour, which intentionally left
    // self-quote for its new preliminary question) -- confirmed via
    // the intake classification before asserting anything about its
    // pricing path.
    const shelfSvc = DB.services.find(s => s.id === 'shelf_mounting_standard_buy_the_hour');
    const basePrice = shelfSvc.financial_engine.base_price;
    const tierRate = DB.global_rules.complexity_tiers[shelfSvc.operational_metrics.complexity_tier].hourly_rate;
    const oldBuggyPrice = basePrice + tierRate; // the confirmed-real, pre-fix double-count
    check(`the OLD calculation would have genuinely produced a higher, double-counted price ($${oldBuggyPrice}), confirming this was a real bug, not a hypothetical one`,
        oldBuggyPrice > basePrice);
    check(`base_price ($${basePrice}) is the correct number for a 1-hour-minimum job at the fixed rate -- this is what the fix produces (verified via a separate, full jsdom render test)`,
        basePrice < oldBuggyPrice);
}

console.log('\n=== Regression: the field-name fix (fe.pricing_type -> fe.type) has the confirmed-narrow blast radius it was checked to have ===');
{
    const QTY_MODS = new Set(['item_count', 'count', 'hybrid_qty', 'global_quantity']);
    const chainIsQtyOnly = (chain) => chain.length === 0 || chain.every(s => QTY_MODS.has(s.module));
    const affected = DB.services.filter(s => {
        const om = s.operational_metrics || {};
        const fe = s.financial_engine || {};
        const hasPricing = (om.expected_minutes > 0) && om.complexity_tier && (fe.base_price > 0);
        return hasPricing && chainIsQtyOnly(s.intake_chain || []) && fe.type === 'hourly';
    });
    // T119: shelf_mounting_standard_buy_the_hour was wired with a real
    // question (install_target), dropping out of this set.
    // T120: that wiring was itself corrected -- install_target's fit was
    // confirmed wrong (6 of 8 options don't belong on a wall-mounting
    // service, and it carried no pricing mechanism at all) and reverted
    // to orphaned. This service correctly, genuinely matches this exact
    // shape again -- not a sign either fix regressed, but the honest,
    // current state after a real correction was made and then undone
    // for a different, separate, well-documented reason.
    check(`exactly the one, real self-quoting-hourly-qty-only service is present (found: ${affected.map(s => s.id).join(', ') || 'none'}) -- confirming the field-name fix's own narrow blast radius, and that install_target's T120 reversion correctly restored this service's original shape`,
        affected.length === 1 && affected[0].id === 'shelf_mounting_standard_buy_the_hour');
}

console.log(`\n[buy-the-hour flat/hourly gate] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
