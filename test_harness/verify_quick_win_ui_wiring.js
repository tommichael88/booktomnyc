#!/usr/bin/env node
/**
 * verify_quick_win_ui_wiring.js
 *
 * Regression test for 3 backlog items (BACKLOG_CONSOLIDATED.md section I,
 * items 1/2/5): real, fully-authored data that existed in the SSOT but was
 * never consumed anywhere. All 3 are pure UI/display -- zero pricing or
 * business-logic risk.
 *
 * 1. ui_taxonomy.sort_order -- services now render in the real, curated
 *    display order instead of raw JSON-array order.
 * 2. checkout_states.*.quote_badge_key -- wired as a stable data-badge-key
 *    attribute on the quote badge element.
 * 3. checkout_states.*.button_class_no_mat/with_mat -- 3 previously-
 *    unauthored states given evidence-based placeholder values (matching
 *    each state's own existing ui_badge_label tone), wired onto the real
 *    Add to Cart button. Currently zero visual effect (no CSS defines
 *    these classes yet, confirmed) but the data-to-DOM connection is
 *    complete for whenever a real design system adds them.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

console.log('=== sort_order is now consulted by renderServices ===');
check('renderServices sorts by ui_taxonomy.sort_order', /renderServices\(container, services[\s\S]{0,600}sort_order/.test(QR_HTML));

console.log('\n=== quote_badge_key is now consulted ===');
check('resolveServiceBadgeKey exists and reads quote_badge_key', /function resolveServiceBadgeKey[\s\S]{0,300}quote_badge_key/.test(QR_HTML));
check('the badge element carries data-badge-key', /data-badge-key="' \+ badgeKey/.test(QR_HTML));

console.log('\n=== button_class_no_mat/with_mat: all 4 checkout states now have real values ===');
{
    let allHaveClasses = true;
    for (const [key, cs] of Object.entries(DB.checkout_states)) {
        if (!cs.button_class_no_mat || !cs.button_class_with_mat) allHaveClasses = false;
    }
    check('all 4 real checkout states have both button_class_no_mat and button_class_with_mat', allHaveClasses);
    check('database_summation matches standard_flat_rate (same "✅ Fixed price" badge, same confidence)',
        DB.checkout_states.database_summation.button_class_no_mat === DB.checkout_states.standard_flat_rate.button_class_no_mat);
    check('diagnostic and project_based are each distinct from the confident "fixed price" green',
        DB.checkout_states.diagnostic.button_class_no_mat !== DB.checkout_states.standard_flat_rate.button_class_no_mat &&
        DB.checkout_states.project_based.button_class_no_mat !== DB.checkout_states.standard_flat_rate.button_class_no_mat);
}
check('btnClass is wired into computeUnifiedQuote\'s returned quote object', /btnText,\s*\n\s*btnClass,/.test(QR_HTML));
check('the real Add to Cart button element carries the dynamic class', /class="ctap ' \+ \(q\.btnClass/.test(QR_HTML));

console.log(`\n[quick-win UI wiring verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
