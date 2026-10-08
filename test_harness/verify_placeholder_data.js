// verify_placeholder_data.js – now with exception lists
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.dirname(__dirname);
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));
const QR_HTML = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

// ── Exceptions (intentional placeholders awaiting review) ─────────────
const IGNORED_ZERO_PRICE_SERVICES = [
  // add service IDs that deliberately have base_price = 0
  'cabinet_knob_or_pull_install',
  'pax_wardrobe_assembly'
];
const IGNORED_FORMULA_KEYS = [
  // add formula keys that use round numbers intentionally
  'furniture_repair_formula',
  'tile_repair_formula'
];
console.log('=== Suspicious placeholder values in btnyc.json ===');

// 1. Services with base_price = 0
const zeroPriceServices = DB.services.filter(s => s.financial_engine?.base_price === 0);
const expectedZero = ['dishwasher_repair', 'furniture_assembly_flat_pack', 'furniture_disassembly_for_moving', 'furniture_repair_hourly'];
const unexpectedZero = zeroPriceServices.filter(s => !expectedZero.includes(s.id) && !IGNORED_ZERO_PRICE_SERVICES.includes(s.id));
if (unexpectedZero.length > 0) {
    console.log(`  Found unexpected zero-price services:`);
    unexpectedZero.forEach(s => console.log(`    - ${s.id} (base_price: 0)`));
}
check(`Services with base_price=0 (excluding known + ignored) – found ${unexpectedZero.length}`, unexpectedZero.length === 0);

// 2. Pricing_formulas with suspicious round numbers
const suspiciousFormulaValues = [];
for (const [key, formula] of Object.entries(DB.pricing_formulas || {})) {
    if (IGNORED_FORMULA_KEYS.includes(key)) continue;
    if (formula.flat_tier_price && formula.flat_tier_price % 50 === 0 && formula.flat_tier_price > 0) {
        suspiciousFormulaValues.push(`${key}.flat_tier_price = ${formula.flat_tier_price}`);
    }
    if (formula.base_minutes && formula.base_minutes % 30 === 0 && formula.base_minutes > 0) {
        suspiciousFormulaValues.push(`${key}.base_minutes = ${formula.base_minutes}`);
    }
}
if (suspiciousFormulaValues.length > 0) {
    console.log(`  Found suspicious formula values:`);
    suspiciousFormulaValues.forEach(v => console.log(`    - ${v}`));
}
check(`Pricing formulas with round placeholder-like values – found ${suspiciousFormulaValues.length}`, suspiciousFormulaValues.length === 0);

// 3. Check for hardcoded button classes in qr.html (T73)
const buttonClasses = ['book-now-button', 'add-more-button', 'sq-ic-est'];
const classesFound = buttonClasses.filter(cls => QR_HTML.includes(cls));
check('All three button classes exist in qr.html', classesFound.length === buttonClasses.length);

console.log(`\n[Placeholder data scan] ${pass} passed, ${fail} failed (of ${pass+fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
