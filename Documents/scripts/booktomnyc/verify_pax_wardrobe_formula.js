#!/usr/bin/env node
/**
 * verify_pax_wardrobe_formula.js
 *
 * Regression test closing backlog item A's last open piece:
 * pax_wardrobe_formula was completely unreachable (zero references
 * anywhere outside its own definition). Content was delegated and
 * authored by a separate team, then reviewed here.
 *
 * REAL FLAW FOUND DURING REVIEW (the team caught half of it
 * themselves): the original design used open-ended banded labels
 * ("4+", "2-3") read via parseInt(label) directly. Confirmed via direct
 * test this silently truncated "4+" to 4 (the flaw the team reported)
 * AND "2-3" to 2 (a second, equally real undercounting bug on every
 * multi-unit band, not just the open-ended top one). Fixed at the
 * actual root cause: labels are display text, never meant to be
 * machine-parsed — added an explicit, real effects.qty_value to every
 * band, and fixed applyPricingFormula to read that instead.
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

console.log('=== PAX is now reachable: real service, real intent_mappings entry ===');
const svc = DB.services.find(s => s.id === 'pax_wardrobe_assembly');
check('the real pax_wardrobe_assembly service exists', !!svc);
check('it correctly references pax_wardrobe_formula', svc?.pricing_engine === 'pax_wardrobe_formula');
const intentEntry = DB.intent_mappings.objects.find(o => o.keyword === 'pax');
check('a real "pax" intent_mappings entry exists', !!intentEntry);
check('it correctly carries dynamic_rule: pax_wardrobe_formula', intentEntry?.dynamic_rule === 'pax_wardrobe_formula');

console.log('\n=== The real flaw found during review: parseInt(label) replaced with explicit qty_value ===');
check('applyPricingFormula no longer calls parseInt on the PAX answer labels',
    !findFn('applyPricingFormula').includes("parseInt(answers.pax_cabinet_count)"));
check('applyPricingFormula now reads the real, explicit effects.qty_value via resolveQtyValue', /resolveQtyValue\('pax_cabinet_count'\)/.test(QR_HTML));

console.log('\n=== Every PAX intake module band carries a real, correct, explicit qty_value (no silent truncation) ===');
for (const modKey of ['pax_cabinet_count', 'pax_hinge_count', 'pax_sliding_count']) {
    const mod = DB.intake_modules[modKey];
    check(`${modKey}: every band has a real, defined qty_value`, mod.client_response.every(r => typeof r.effects?.qty_value === 'number'));
}
// Specifically confirm the "2-3" undercounting flaw (not caught by the
// original report, found during review) is genuinely fixed: there is no
// band in the corrected design whose label implies a range, only exact
// numbers (or an explicit "N or more, specify in notes" top band).
check('pax_cabinet_count has no open-ended range label like "2-3" left in the corrected design',
    !DB.intake_modules.pax_cabinet_count.client_response.some(r => /^\d+-\d+$/.test(r.label)));

console.log('\n=== Hand-verified, real end-to-end math for the exact case the team flagged (6 cabinet frames) ===');
{
    const FNS = ['resolveDynamicService', 'resolveBaseConfidenceStrategy', 'resolveForceModules',
        'applyLiveConfidenceEscalation', 'deriveComplexityTier', 'applyPricingFormula',
        'resolveCheckoutState', 'sqTagLabel', 'tagValidForCategory', 'resolveEngineKey',
        'resolveServiceBadge', 'computeUnifiedQuote'];
    const code = FNS.map(findFn).join('\n\n');
    const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
    sandbox.global = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox, { filename: 'pax_e2e' });

    const answers = {
        pax_cabinet_count: '6 or more (specify exact count in notes)',
        pax_hinge_count: '0 (None)', pax_sliding_count: '0 (None)', pax_interior_count: '0 (None)',
    };
    const result = sandbox.computeUnifiedQuote({ svc, activeTagIds: [], answers, qty: 1, formulaId: 'pax_wardrobe_formula' });
    // baseMinutes midpoint (80+120)/2=100 + formula extraMin (6*1.3*60=468) = 568 totalMin
    // laborEstimate = (568/60)*85 ≈ 805 (overrideHourlyRate from price_per_hour)
    check('totalMin matches the hand-verified real calculation (568)', result.totalMin === 568);
    check('laborEstimate correctly reflects the real 6-frame count (≈$805), not the old, truncated 4-frame result (≈$567)',
        result.laborEstimate >= 800 && result.laborEstimate <= 810);
}

console.log('\n=== End-to-end: the real, exact customer phrase resolves correctly ===');
{
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pax_check_'));
    const payloadPath = path.join(tmpDir, 'payload.json');
    fs.writeFileSync(payloadPath, JSON.stringify({ mode: 'analyze', text: 'I need help assembling my PAX wardrobe' }));
    const stdout = execFileSync('node', [path.join(REPO_ROOT, 'cms_bridge.js'), payloadPath, path.join(REPO_ROOT, 'btnyc.json'), path.join(REPO_ROOT, 'qr.html')], { encoding: 'utf8' });
    fs.rmSync(tmpDir, { recursive: true, force: true });
    const result = JSON.parse(stdout);
    check('the real customer phrase resolves recommendedSku: pax_wardrobe_assembly', result.intent.recommendedSku === 'pax_wardrobe_assembly');
    check('the real customer phrase resolves dynamic_rule: pax_wardrobe_formula', result.intent.dynamic_rule === 'pax_wardrobe_formula');
}

console.log(`\n[PAX wardrobe formula verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
