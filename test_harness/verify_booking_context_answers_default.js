/**
 * verify_booking_context_answers_default.js
 *
 * Verifies the T118, Step 6 item 3 fix for PENDING_DECISIONS.md #33:
 * makeBookingContext's own defaults never included `answers` at all,
 * so a fresh context from ANY entry path (catalog, other_tile,
 * free_text) had no `.answers` field until something explicitly set
 * one after the fact. Fixed once, at the shared default in
 * makeBookingContext, since every real entry path already flows
 * through it.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML = require('./_page.js').readPage(path.join(REPO_ROOT, 'qr.html'));
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

function findFn(name) {
    const m = QR_HTML.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) return '';
    let depth = 0, start = m.index;
    for (let j = m.index + m[0].length - 1; j < QR_HTML.length; j++) {
        if (QR_HTML[j] === '{') depth++;
        else if (QR_HTML[j] === '}') { depth--; if (depth === 0) return QR_HTML.slice(start, j + 1); }
    }
    return '';
}

const FNS = ['makeBookingContext', 'collectBookingContext_catalog'];
const sandbox = { DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(FNS.map(findFn).join('\n\n'), sandbox);

let pass = 0, fail = 0;
function check(desc, cond) {
    if (cond) { pass++; console.log(`  \u2713 ${desc}`); }
    else { fail++; console.log(`  \u2717 ${desc}`); }
}

console.log('=== makeBookingContext itself ===');
{
    const ctx = sandbox.makeBookingContext('free_text', {});
    check('a fresh context has an answers field', 'answers' in ctx);
    check('answers defaults to a real, empty object, not undefined or null', typeof ctx.answers === 'object' && ctx.answers !== null && Object.keys(ctx.answers).length === 0);
}

console.log('\n=== collectBookingContext_catalog, named directly in #33 ===');
{
    const svc = DB.services.find(s => s.id === 'faucet_repair_drip');
    const ctx = sandbox.collectBookingContext_catalog(svc, svc.ui_taxonomy.category_id);
    check('a catalog-tap context has an answers field', 'answers' in ctx);
    check('it defaults to an empty object', typeof ctx.answers === 'object' && ctx.answers !== null && Object.keys(ctx.answers).length === 0);
    check('other real fields are still correctly set (this fix did not disturb them)',
        ctx.selectedServiceId === svc.id && ctx.selectedCategoryId === svc.ui_taxonomy.category_id);
}

console.log('\n=== An explicit override still wins (Object.assign order is unaffected) ===');
{
    const ctx = sandbox.makeBookingContext('free_text', { answers: { access: 'Very cramped or hard to reach' } });
    check('an explicitly-passed answers object is not clobbered by the new default',
        ctx.answers.access === 'Very cramped or hard to reach');
}

console.log(`\n[booking context answers default, #33] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
