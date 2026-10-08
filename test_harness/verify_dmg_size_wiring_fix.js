#!/usr/bin/env node
/**
 * verify_dmg_size_wiring_fix.js
 *
 * Real bug found via continued root-node review of pricing_formulas
 * (PENDING_DECISIONS.md item #12): `dmg_size` ("How large is the damaged
 * area?") was asked by 2 real, named services (`door_repair_impact_damage`,
 * `wall_hole_or_crack_repair`) but never affected price anywhere --
 * confirmed via direct search (zero references in any live pricing code
 * path), despite the question's own `affects_price: true` declaration
 * and all 3 options sharing an identical, uninformative
 * `complexity_override: "routine"`. Both real services are `flat_simple`
 * archetype with no other size-scaling question (unlike
 * `drywall_repair_formula`'s dynamic-service path, which has a separate,
 * precise `area_sqft` question that already, correctly drives pricing --
 * this was an initial, incorrect hypothesis for THIS bug, ruled out by
 * checking both real services' actual intake_chains directly before
 * acting).
 *
 * Fixed by wiring real `modifier_ref`s onto dmg_size's own "Medium"/
 * "Large" client_response options (values anchored to the existing
 * tile_* modifier range), verified to work via the existing, generic
 * per-answer modifier_ref mechanism in computeUnifiedQuote (confirmed
 * directly this mechanism reaches flat_simple-archetype services before
 * trusting it).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.join(__dirname, '..');
const QR_HTML = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

// T143/T144: functions declared in the three engine modules are loaded WHOLE (the T136 `_engine.js` loader), so a helper added next to a
// function can no longer drop out of this sandbox ("X is not defined" -- noise unrelated to what this test asserts). Anything else is still
// extracted by name, below.
const { engineAwareFindFn } = require('./_engine.js');
function _cherryPickFn(name) {
    const m = QR_HTML.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) throw new Error(`Could not find function: ${name}`);
    let depth = 0, start = m.index, i = m.index + m[0].length - 1;
    for (let j = i; j < QR_HTML.length; j++) {
        if (QR_HTML[j] === '{') depth++;
        else if (QR_HTML[j] === '}') { depth--; if (depth === 0) return QR_HTML.slice(start, j + 1); }
    }
}
const findFn = engineAwareFindFn(_cherryPickFn);

const FNS = ['syncTagSynthesizedAnswers', '_isModVisible',
    'resolveDynamicService', 'resolveBaseConfidenceStrategy', 'resolveServiceCheckoutStateKey', 
    'applyLiveConfidenceEscalation', 'deriveComplexityTier', 'applyPricingFormula',
    'buildCheckoutStateModel', 'sqTagLabel', 'tagValidForCategory', 'resolveEngineKey',
    'resolveServiceBadge', 'computeUnifiedQuote', 'computeArchetypeQuote', 'computeQuoteFromState'];
const code = FNS.map(findFn).join('\n\n');
const sandbox = { DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

console.log('=== Real data wiring, checked directly ===');
const dmg = DB.intake_modules.dmg_size;
const small = dmg.client_response.find(r => r.label.startsWith('Small'));
const medium = dmg.client_response.find(r => r.label.startsWith('Medium'));
const large = dmg.client_response.find(r => r.label.startsWith('Large'));
check('Small correctly stays the baseline (no modifier_ref -- already covered by base_price)',
    !small.modifier_ref);
check('Medium has a real modifier_ref wired', medium.modifier_ref === 'dmg_size_medium');
check('Large has a real modifier_ref wired', large.modifier_ref === 'dmg_size_large');
check('the real dmg_size_medium modifier exists with a sensible, real value',
    DB.global_rules.modifiers.dmg_size_medium?.fee === 15);
check('the real dmg_size_large modifier exists with a sensible, real value',
    DB.global_rules.modifiers.dmg_size_large?.fee === 35);

function testService(svcId, extraAnswers) {
    const svc = DB.services.find(s => s.id === svcId);
    function run(dmgVal) {
        sandbox.S = {
            qty: 1, intent: { key: svc.id, category: svc.ui_taxonomy?.category, label: 'Test' },
            stype: 'Repair', detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: [],
            answers: { item_count_template: '1 area', dmg_size: dmgVal, ...extraAnswers },
            _tagSynthesizedModules: {}, _tagsAffirmed: true, _svc: svc,
        };
        return sandbox.computeQuoteFromState(sandbox.S);
    }
    return {
        small: run('Small (fits in your hand)').laborCalc,
        medium: run('Medium (about the size of a sheet of paper)').laborCalc,
        large: run('Large (bigger than a sheet of paper)').laborCalc,
    };
}

console.log('\n=== The real, previously-broken bug: both real services now correctly price by damage size ===');
const door = testService('door_repair_impact_damage', {
    door_type: DB.intake_modules.door_type.client_response[0].label,
    project_scale: DB.intake_modules.project_scale.client_response[0].label,
});
check(`door_repair_impact_damage: Small ($${door.small}) < Medium ($${door.medium}) < Large ($${door.large}) -- was previously flat regardless of answer`,
    door.small < door.medium && door.medium < door.large);
check('door_repair_impact_damage: exact, expected values',
    door.small === 115 && door.medium === 130 && door.large === 150);

const wall = testService('wall_hole_or_crack_repair', {
    wall_type: 'Drywall (standard)',
    mounting_height: DB.intake_modules.mounting_height.client_response[0].label,
    project_scale: DB.intake_modules.project_scale.client_response[0].label,
});
check(`wall_hole_or_crack_repair: Small ($${wall.small}) < Medium ($${wall.medium}) < Large ($${wall.large}) -- was previously flat regardless of answer`,
    wall.small < wall.medium && wall.medium < wall.large);
check('wall_hole_or_crack_repair: exact, expected values',
    wall.small === 70 && wall.medium === 85 && wall.large === 105);

console.log(`\n[dmg_size wiring fix] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
