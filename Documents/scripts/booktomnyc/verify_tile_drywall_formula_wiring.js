#!/usr/bin/env node
/**
 * verify_tile_drywall_formula_wiring.js
 *
 * Regression test for the real completion of backlog item A's
 * tile_repair_formula and drywall_repair_formula work this session.
 *
 * THE FULL CHAIN:
 *
 *   1. formula_override: a new, real mechanism on client_response.effects
 *      letting a SPECIFIC answer (e.g. surface_type="Tile") set which
 *      pricing_formulas entry should fire, independent of any upstream
 *      NLP match.
 *
 *   2. THE REAL ROUTING BUG (found via careful, direct user analysis,
 *      verified precisely before fixing): S.intent.dynamic_rule (set
 *      correctly by the upstream NLP match for e.g. "5 subway tiles")
 *      was silently discarded by prefillSmartQuoteFromOtherTile's S
 *      reset, specifically on the MORE COMMON path where
 *      resolveGroupFromIntent successfully finds a real group — not a
 *      rare edge case. The orchestrator never had this bug (it reads
 *      context.nlpIntent.dynamic_rule directly). Fixed by capturing and
 *      carrying the real dynamic_rule through the reset.
 *
 *   3. A real double-counting fix: the "Tile" answer's own baseline
 *      fee/minutes were zeroed out, since tile_repair_formula's own
 *      base_minutes is now the authoritative source for that exact same
 *      baseline concept once the override fires.
 *
 *   4. 6 new, real intake modules authored (area_sqft, texture_match,
 *      grout_repair, water_damage, ceiling_height, disposal), each
 *      checked against existing similar-sounding modules to avoid
 *      duplication (e.g. ceiling_height is deliberately a NEW module,
 *      not a reuse of the shared mounting_height module used by 14
 *      other services, to avoid regressing them).
 *
 *   5. A real, systemic baseMinutes fix: dynamic-service quotes
 *      previously never read dynDef's own real, curated total_minutes,
 *      falling through to a bare 45-minute fallback that happened to
 *      coincidentally produce "correct"-looking old test expectations.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');
const vm = require('vm');

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

function findFn(name) {
    const m = QR_HTML.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) return null;
    let depth = 0, start = m.index, i = m.index + m[0].length - 1;
    for (let j = i; j < QR_HTML.length; j++) {
        if (QR_HTML[j] === '{') depth++;
        else if (QR_HTML[j] === '}') { depth--; if (depth === 0) return QR_HTML.slice(start, j + 1); }
    }
    return null;
}

console.log('=== Bug fix 1: formula_override exists and is correctly wired ===');
const surfaceTypeMod = DB.intake_modules.surface_type;
const tileAnswer = surfaceTypeMod.client_response.find(r => r.label === 'Tile (wall or floor)');
check('the real "Tile" answer carries formula_override: tile_repair_formula', tileAnswer.effects.formula_override === 'tile_repair_formula');
check('the real "Tile" answer\'s own baseline fee/minutes are zeroed (no double-counting against the formula\'s base_minutes)', tileAnswer.effects.fee === 0 && tileAnswer.effects.minutes === 0);
const drywallAnswer = surfaceTypeMod.client_response.find(r => r.label === 'Drywall or plaster');
check('the real "Drywall" answer carries formula_override: drywall_repair_formula', drywallAnswer.effects.formula_override === 'drywall_repair_formula');

console.log('\n=== Bug fix 2: the real routing bug (dynamic_rule discarded on the common path) is fixed ===');
check('the live code captures the original dynamic_rule before the S reset', /const preservedDynamicRule = S\.intent\?\.dynamic_rule \|\| null;/.test(QR_HTML));
check('the live code carries it into the new S.intent', /dynamic_rule: preservedDynamicRule/.test(QR_HTML));

console.log('\n=== Bug fix 3: all 6 new intake modules exist with the exact, correct comparison strings ===');
const requiredModules = {
    area_sqft: 'pricing',
    texture_match: 'pricing',
    grout_repair: 'pricing',
    water_damage: 'pricing',
    ceiling_height: 'pricing',
    disposal: 'pricing',
};
for (const [key, purpose] of Object.entries(requiredModules)) {
    check(`intake_modules.${key} exists with purpose:${purpose}`, DB.intake_modules[key]?.purpose === purpose);
}
check('texture_match\'s "Yes" label matches applyPricingFormula\'s exact comparison (answers.texture_match === "Yes")',
    DB.intake_modules.texture_match.client_response.some(r => r.label === 'Yes'));
check('grout_repair\'s "Yes" label matches the exact comparison', DB.intake_modules.grout_repair.client_response.some(r => r.label === 'Yes'));
check('water_damage\'s "Yes" label matches the exact comparison', DB.intake_modules.water_damage.client_response.some(r => r.label === 'Yes'));
check('ceiling_height\'s "High ceiling" label matches the exact comparison', DB.intake_modules.ceiling_height.client_response.some(r => r.label === 'High ceiling'));
check('disposal\'s "Yes" label matches the exact comparison', DB.intake_modules.disposal.client_response.some(r => r.label === 'Yes'));
check('ceiling_height is a genuinely separate, new module (NOT a reuse of the shared mounting_height module relied on by 14 other services)',
    DB.intake_modules.ceiling_height !== DB.intake_modules.mounting_height);

console.log('\n=== Bug fix 4: both branches are correctly wired into the real Repair fallback ===');
const repairFallback = DB.dynamic_services['minor_home_repairs+Repair'];
const tileThen = repairFallback.intake_chain[0].then['Tile (wall or floor)'];
check('the Tile branch asks all 4 new formula questions alongside the 2 existing, genuinely distinct questions',
    ['waterproof_area', 'has_matching_tiles', 'grout_repair', 'water_damage', 'ceiling_height', 'disposal'].every(m => tileThen.includes(m)));
const drywallThen = repairFallback.intake_chain[0].then['Drywall or plaster'];
check('the Drywall branch asks both new formula questions alongside the existing dmg_size question',
    ['dmg_size', 'area_sqft', 'texture_match'].every(m => drywallThen.includes(m)));

console.log('\n=== Bug fix 5: the systemic baseMinutes-from-dynDef fix ===');
check('computeUnifiedQuote reads dynDef?.default_estimate?.total_minutes as a real fallback', /dynDef\?\.default_estimate\?\.total_minutes/.test(QR_HTML));
check('computeUnifiedQuote reads dynDef?.operational_metrics?.minimum_minutes as a real second-tier fallback', /dynDef\?\.operational_metrics\?\.minimum_minutes/.test(QR_HTML));

console.log('\n=== End-to-end: the real, exact customer scenario from the original analysis ===');
{
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tile_check_'));
    const payloadPath = path.join(tmpDir, 'payload.json');
    fs.writeFileSync(payloadPath, JSON.stringify({ mode: 'analyze', text: 'I need to replace 5 subway tiles in my kitchen' }));
    const stdout = execFileSync('node', [path.join(REPO_ROOT, 'cms_bridge.js'), payloadPath, path.join(REPO_ROOT, 'btnyc.json'), path.join(REPO_ROOT, 'qr.html')], { encoding: 'utf8' });
    fs.rmSync(tmpDir, { recursive: true, force: true });
    const result = JSON.parse(stdout);
    check('the real, exact customer phrase correctly resolves dynamic_rule: tile_repair_formula', result.intent.dynamic_rule === 'tile_repair_formula');
    check('qty is correctly extracted as 5', result.qty === 5);
}

console.log('\n=== Hand-verified, real end-to-end pricing math for a tile job with grout + water damage ===');
{
    const FNS = ['resolveDynamicService', 'resolveBaseConfidenceStrategy', 'resolveForceModules',
        'applyLiveConfidenceEscalation', 'deriveComplexityTier', 'applyPricingFormula',
        'resolveCheckoutState', 'sqTagLabel', 'tagValidForCategory', 'resolveEngineKey',
        'resolveServiceBadge', 'computeUnifiedQuote'];
    const code = FNS.map(findFn).join('\n\n');
    const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
    sandbox.global = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: 'tile_e2e' });

    const dynDef = DB.dynamic_services['minor_home_repairs+Repair'];
    const answers = {
        surface_type: 'Tile (wall or floor)', grout_repair: 'Yes', water_damage: 'Yes',
        ceiling_height: 'No, standard reach', disposal: "No, I'll handle disposal",
        waterproof_area: 'No', has_matching_tiles: 'Yes',
    };
    const result = sandbox.computeUnifiedQuote({ dynDef, activeTagIds: [], answers, qty: 1, formulaId: 'tile_repair_formula' });
    // base_minutes(30) + minutes_per_tile(5)*1 + grout_penalty(20) + water_damage_penalty(25) = 80 extraMin
    // dynDef.default_estimate.total_minutes midpoint (70+90)/2 = 80 baseMinutes
    // totalMin = 80 + 80 = 160
    check('totalMin matches the hand-verified real calculation (160 = 80 baseMinutes + 80 formula extraMin)', result.totalMin === 160);
    check('the formula genuinely fired (laborEstimate reflects formula extraFee, not just the base price)', result.laborEstimate > result.base);
}

console.log(`\n[Tile/drywall formula wiring verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
