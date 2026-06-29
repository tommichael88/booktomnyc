#!/usr/bin/env node
/**
 * verify_dispatch_fee_consistency.js
 *
 * Regression test for a real, severe pricing inconsistency confirmed via
 * an independent architectural review document and direct code trace:
 * _computePrice (the Catalog browser / legacy intake pricing path) never
 * included a dispatch fee at all, while computeUnifiedQuote (the
 * SmartQuote path) always adds DB.global_rules.surcharges.dispatch_fee.
 * The exact same service quoted through the two different entry points
 * would diverge by the full dispatch fee amount (typically $45).
 */
const fs = require('fs');
const path = require('path');
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

const code = [findFn('getServiceProfile'), findFn('isDiagnosticService'), findFn('_resolveIntakeChain'), findFn('_isModVisible'), findFn('_computePrice')].join('\n\n');
const sandbox = { SERVICE_DATA: DB, DB, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: '_computePrice' });

console.log('=== _computePrice now includes a real dispatch fee, matching computeUnifiedQuote\'s source exactly ===');
const realDispatchFee = DB.global_rules?.surcharges?.dispatch_fee;
check('global_rules.surcharges.dispatch_fee exists in the real SSOT', typeof realDispatchFee === 'number');

const svc = DB.services.find(s => s.id === 'toilet_install');
const r = sandbox._computePrice(svc, {}, 1);
check('_computePrice returns a dispatchFee field at all', typeof r.dispatchFee === 'number');
check('_computePrice\'s dispatchFee matches the real SSOT value exactly', r.dispatchFee === realDispatchFee);
check('dispatchFee is NOT folded into laborEstimate (kept as a separate field, matching the real quote card\'s display convention)',
    r.laborEstimate !== r.dispatchFee && r.laborEstimate === Math.round((svc.financial_engine.base_price) * 1));

console.log('\n=== Display sites in _renderStructuredIntake/_renderSimpleConfirm actually surface the dispatch fee ===');
check('qr.html shows a "+ $X dispatch" note in the legacy intake Add-to-Request button',
    /\+\s*\$\$\{r\.dispatchFee\}\s*dispatch/.test(QR_HTML) || /dispatch fee/i.test(QR_HTML.match(/function _renderStructuredIntake[\s\S]{0,3000}/)?.[0] || ''));
check('qr.html\'s cart price string includes the dispatch fee for the standard case',
    /price: '\$' \+ r\.laborEstimate \+ dispatchSuffix/.test(QR_HTML) || /price: '\$' \+ r\.laborEstimate \+ ' \+ \$' \+ r\.dispatchFee/.test(QR_HTML));

console.log(`\n[dispatch fee consistency verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
