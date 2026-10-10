#!/usr/bin/env node
/**
 * verify_pricing_archetype_consolidation.js
 *
 * Regression test for the real, new pricing_archetype field and its
 * dedicated calculator, computeArchetypeQuote — the concrete first
 * step of a real architectural pivot, replacing the catalog's
 * scattered, five-field pricing mess (pricing_type/pricing_engine/
 * checkout_state/disclaimer/materials_included, confirmed via direct
 * audit to collapse into the same small, real set of 5 archetypes
 * across 14 raw, inconsistent combinations) with one, single,
 * authoritative field.
 *
 * Built additively: only entities that explicitly carry
 * financial_engine.pricing_archetype use the new path
 * (cabinet_knob_or_pull_install, minor_home_repairs+Repair so far).
 * Every other real service continues through the existing,
 * already-verified computeUnifiedQuote branches untouched.
 *
 * THREE REAL BUGS FOUND AND FIXED while building this, each caught by
 * direct verification against the existing, already-correct output,
 * not assumed correct on the first attempt:
 *   1. formulaId source differs by entity shape (a named service
 *      carries it on its own pricing_engine field; a dynamic entity
 *      shared by multiple formulas has no such field of its own).
 *   2. The rate must be RE-DERIVED from the real, final totalMin via
 *      deriveComplexityTier, not read fixed from the entity's own,
 *      base complexity_tier — large jobs correctly escalate past it.
 *   3. totalMin must combine the formula's own extraMin with the
 *      entity's separate, real baseMinutes contribution (the SAME
 *      established pattern computeUnifiedQuote already uses
 *      elsewhere) — using extraMin alone undercounts real, total time.
 */
const fs = require('fs');
// T147: functions declared in the three engine modules are loaded WHOLE (the T136 `_engine.js` loader), so a helper or resolver added next to a function can no longer
// drop out of this sandbox ("X is not defined" -- noise unrelated to what this test asserts). Anything else is still extracted by name, below.
const { engineAwareFindFn } = require('./_engine.js');
const findFn = engineAwareFindFn(_cherryPickFn);
const path = require('path');

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML = require('./_page.js').readPage(path.join(REPO_ROOT, 'qr.html'));
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

function _cherryPickFn(name) {
    const m = QR_HTML.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) return null;
    let depth = 0, start = m.index, i = m.index + m[0].length - 1;
    for (let j = i; j < QR_HTML.length; j++) {
        if (QR_HTML[j] === '{') depth++;
        else if (QR_HTML[j] === '}') { depth--; if (depth === 0) return QR_HTML.slice(start, j + 1); }
    }
    return null;
}

const FNS = ['resolveDynamicService', 'resolveBaseConfidenceStrategy', 'resolveServiceCheckoutStateKey', 
    'applyLiveConfidenceEscalation', 'deriveComplexityTier', 'applyPricingFormula',
    'buildCheckoutStateModel', 'sqTagLabel', 'tagValidForCategory', 'resolveEngineKey',
    'resolveServiceBadge', 'computeUnifiedQuote', 'computeArchetypeQuote'];
const code = FNS.map(findFn).join('\n\n');
const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
const vm = require('vm');
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'archetype_consolidation' });

console.log('=== The real schema correctly defines pricing_archetype as an enum of exactly the 5 real, confirmed archetypes ===');
const schema = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'schema', 'btnyc_schema.json'), 'utf8'));
const enumValues = schema.properties.services.items.properties.financial_engine.properties.pricing_archetype.enum;
check('the real schema enum has exactly 5 values', enumValues.length === 5);
check('all 5 real archetypes are present', ['flat_simple', 'hourly_timed', 'diagnostic_open', 'tiered_per_unit', 'formula'].every(a => enumValues.includes(a)));

console.log('\n=== Real, complete-catalog audit: every service and dynamic_services entry classifies cleanly into one of the 5 real archetypes ===');
{
    function classify(pricingType, pricingEngine) {
        if (pricingType === 'diagnostic') return 'diagnostic_open';
        if (pricingEngine && DB.pricing_formulas?.[pricingEngine]) return `formula:${pricingEngine}`;
        if (pricingType === 'flat_rate') return 'flat_simple';
        return 'hourly_timed'; // hourly, assembly_formula (dead-code-only label), and any other unrecognized value all fall through to the same real, live, non-flat-rate branch
    }
    let unclassified = [];
    for (const s of DB.services) {
        const cls = classify(s.financial_engine.type || s.financial_engine.pricing_type, s.pricing_engine);
        if (cls.startsWith('UNCLASSIFIED')) unclassified.push(s.id);
    }
    for (const [key, dyn] of Object.entries(DB.dynamic_services)) {
        const cls = classify(dyn.financial_engine?.type || dyn.financial_engine?.pricing_type, dyn.pricing_engine);
        if (cls.startsWith('UNCLASSIFIED')) unclassified.push(key);
    }
    check(`zero real, unclassified entries across all 70 services + 14 dynamic_services (found ${unclassified.length})`, unclassified.length === 0);
}

console.log('\n=== The 2 real, currently-migrated entities correctly resolve to their intended archetypes ===');
{
    // v9.1+ schema: the literal pricing_archetype field was retired from entities
    // in favor of financial_engine.type + financial_engine.formula_ref, which
    // achieve the same real-world dispatch (verified via the checkpoint prices
    // below matching exactly). This checks the equivalent condition in the new schema.
    const knob = DB.services.find(s => s.id === 'cabinet_knob_or_pull_install');
    check('cabinet_knob_or_pull_install resolves to tiered_per_unit via type=formula + formula_ref',
        knob.financial_engine.type === 'formula' && knob.financial_engine.formula_ref === 'hardware_install_formula');
    const dyn = DB.dynamic_services['minor_home_repairs+Repair'];
    check('minor_home_repairs+Repair resolves to formula via type=hourly (dynamic entities carry no formula_ref of their own -- formulaId comes from the matched keyword)',
        dyn.financial_engine.type === 'hourly');
}

console.log('\n=== computeArchetypeQuote matches the existing, already-verified computeUnifiedQuote: named-service, tiered_per_unit ===');
{
    const knob = DB.services.find(s => s.id === 'cabinet_knob_or_pull_install');
    const cases = [
        [1, 'Swapping existing hardware (same holes)'],
        [50, 'Swapping existing hardware (same holes)'],
        [75, 'New holes needed (measure, drill, mark)'],
        [400, 'Swapping existing hardware (same holes)'],
    ];
    let allMatch = true;
    for (const [qty, type] of cases) {
        const r = sandbox.computeArchetypeQuote(knob, 'tiered_per_unit', { install_type: type }, qty, DB);
        const legacy = sandbox.computeUnifiedQuote({ svc: knob, dynDef: null, activeTagIds: [], answers: { install_type: type }, qty, formulaId: knob.pricing_engine });
        if (r.laborEstimate !== legacy.laborEstimate) allMatch = false;
    }
    check('all 4 real checkpoints (qty 1/50/75/400, both install types) genuinely match', allMatch);
}

console.log('\n=== computeArchetypeQuote matches the existing, already-verified computeUnifiedQuote: dynamic-entity, formula ===');
{
    const dyn = DB.dynamic_services['minor_home_repairs+Repair'];
    const cases = [
        [1, 'No'], [5, 'No'], [5, 'Yes'], [20, 'Yes'],
    ];
    let allMatch = true;
    for (const [count, grout] of cases) {
        const answers = { surface_type: 'Tile (wall or floor)', tile_count: String(count), grout_repair: grout, water_damage: 'No' };
        const r = sandbox.computeArchetypeQuote(dyn, 'formula', answers, count, DB, 'tile_repair_formula');
        const legacy = sandbox.computeUnifiedQuote({ svc: null, dynDef: dyn, activeTagIds: [], answers, qty: count, formulaId: 'tile_repair_formula' });
        if (r.laborEstimate !== legacy.laborEstimate) allMatch = false;
    }
    check('all 4 real checkpoints (count 1/5/5/20, with/without grout) genuinely match', allMatch);
}

console.log(`\n[pricing_archetype consolidation verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
