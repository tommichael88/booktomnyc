/**
 * verify_buy_the_hour_question_set.js
 *
 * Verifies the T118, Step 6 item 7 fix for PENDING_DECISIONS.md #22:
 * mounting a "standard mirror" recommended
 * shelf_mounting_standard_buy_the_hour and asked mounting_height (its
 * own question) plus the then-universally-forced access -- both
 * unnecessary for a low-complexity, hourly-billed job.
 *
 * Fix, two distinct mechanisms for two distinct problems: (1)
 * mounting_height removed directly from shelf_mounting_standard_buy_the_hour's
 * own authored intake_chain -- hourly work naturally reflects real
 * difficulty (including height) in the hours billed, unlike a flat-fee
 * service where height determines a fixed pre-quote charge.
 * shelf_mortar_mounting_buy_the_hour (masonry, not a "standard" SKU)
 * correctly keeps its own mounting_height question. (2) a new,
 * targeted excluded_services mechanism in global_rules.intake_defaults
 * removes access specifically for the two low-complexity SKUs named/
 * matching #22's own diagnosed shape, without touching wall_mounting's
 * own category default for every other, genuinely higher-complexity
 * service in that category (TVs, drywall, and masonry mounting all
 * correctly keep it).
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

const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(['_resolveIntakeChain', 'orch_compose_intake_chain'].map(findFn).join('\n\n'), sandbox);

let pass = 0, fail = 0;
function check(desc, cond) {
    if (cond) { pass++; console.log(`  \u2713 ${desc}`); }
    else { fail++; console.log(`  \u2717 ${desc}`); }
}

function chainFor(id) {
    const svc = DB.services.find(s => s.id === id);
    return sandbox.orch_compose_intake_chain({}, { entity: svc }, DB).map(m => m.moduleKey || m.module);
}

console.log('=== The exact, real, motivating case: shelf_mounting_standard_buy_the_hour (a "standard mirror") ===');
{
    const chain = chainFor('shelf_mounting_standard_buy_the_hour');
    check('mounting_height is gone -- hourly billing naturally reflects real height/difficulty in hours worked',
        !chain.includes('mounting_height'));
    check('access is gone -- low-complexity, hourly-billed work, not the same reachability concern as TV/drywall mounting',
        !chain.includes('access'));
    check('global_quantity (the service\'s own real question) is untouched', chain.includes('global_quantity'));
}

console.log('\n=== The other named SKU sharing this exact shape ===');
{
    const chain = chainFor('blinds_shades_curtains_buy_the_hour');
    check('access is gone for blinds/curtains too (same low-complexity, hourly-billed reasoning)', !chain.includes('access'));
}

console.log('\n=== Regression: a genuinely different buy-the-hour SKU is correctly untouched for mounting_height ("unless scoped" means some can keep it) ===');
{
    const chain = chainFor('shelf_mortar_mounting_buy_the_hour');
    check('mounting_height is KEPT -- masonry work, not a "standard" SKU, genuinely more variable',
        chain.includes('mounting_height'));
    // T118 (operator-directed, explicit removal): access was removed
    // catalog-wide after this fix originally shipped -- it was never a
    // question with a meaningful answer distribution in residential
    // handyman work. This service's own #22-era "kept, scoped exception"
    // status is now moot along with every other access reference; the
    // real, still-relevant regression this item's own fix protects
    // (mounting_height staying correctly present) is checked above.
    check('access is gone here too, along with everywhere else in the catalog (T118, explicit operator removal)',
        !chain.includes('access'));
}

console.log('\n=== Regression: access\'s catalog-wide removal (T118) reaches every service, not just the two originally-excluded SKUs ===');
{
    const flatscreen = DB.services.find(s => s.id === 'flatscreen_mounting_standard');
    const chain = chainFor('flatscreen_mounting_standard');
    check('flatscreen_mounting_standard no longer gets access either -- the #22-era "kept for other wall_mounting services" distinction is moot now that access is gone entirely',
        !chain.includes('access'));
}

console.log(`\n[buy-the-hour question set, #22] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
