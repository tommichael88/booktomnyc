#!/usr/bin/env node
/**
 * verify_per_service_tag_exclusion.js
 *
 * Regression test for the per-service tag-exclusion mechanism (T72's
 * flagged limitation, closed here): a genuine, new, third layer of
 * scoping on tagValidForCategory, distinct from both mutually_exclusive
 * (two real, positive tags that can't coexist) and per-service
 * applicability's earlier group-level narrowing (T72). This addresses
 * the specific, honestly-documented limitation from T72: a group can
 * genuinely contain both matching and non-matching services (e.g.
 * Light Fixtures has both large chandeliers, where heavy-lifting tags
 * are real, and a small, simple Under-Cabinet Light Install, where they
 * aren't) that group-level scoping alone cannot separate.
 *
 * Implemented as an EXCLUSION list (excluded_service_ids), not an
 * inclusion list -- most services in an already-matching group should
 * naturally inherit that group's applicability (the whole point of
 * group-level scoping); only specific, individually-verified exceptions
 * opt out. Backward compatible: tagValidForCategory's new serviceId
 * parameter defaults to null, and the exclusion check only fires when a
 * real serviceId is actually passed.
 *
 * Authored real exclusion data for the exact, originally-reported case
 * (under_cabinet_light_install), each with individually-verified
 * reasoning, not guessed: heavy_lifting/part_order_likely/
 * two_trip_minimum (the specific tags named in the original report),
 * plus very_heavy/high_ceiling/very_high_ceiling (physically impossible
 * for this specific service -- under-cabinet fixtures are light, small
 * items installed at counter-top height) and fan_box_missing (genuinely
 * relevant to the broader Light Fixtures group for fixture-replacement
 * services, but not to this new-install service).
 *
 * v9.5.1: added an 8th exclusion, #two_person_required, under the exact
 * same physically-impossible-for-this-service reasoning already
 * established above for very_heavy/high_ceiling/very_high_ceiling --
 * #two_person_required's own data (see its `note`) ties it specifically
 * to weight ("the direct, self-evident consequence of an item being
 * very heavy", applied via the weight module's "Over 50 lbs" answer). A
 * service already established as never physically heavy enough to
 * trigger #very_heavy is, by that same fact, never heavy enough to need
 * a second person to lift it either -- this doesn't introduce new
 * reasoning, it completes reasoning this file already applied and
 * simply hadn't been extended to this one additional, same-category tag.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML = require('./_page.js').readPage(path.join(REPO_ROOT, 'qr.html'));
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
const vm = require('vm');
const sandbox = { DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(findFn('tagValidForCategory'), sandbox, { filename: 'tag_exclusion' });

const CAT = 'electric_lighting';
const GROUP = 'electric_lighting_light_fixtures';
const SVC = 'under_cabinet_light_install';
const OTHER_SVC = 'chandelier_or_pendant_install'; // a real, different service in the same group

console.log('=== The exact, originally-reported case: 3 named tags now correctly excluded ===');
{
    const reported = ['#heavy_lifting', '#part_order_likely', '#two_trip_minimum'];
    let allExcluded = true;
    for (const tid of reported) {
        if (sandbox.tagValidForCategory(tid, CAT, GROUP, SVC)) { allExcluded = false; console.log(`    ${tid} still matches -- should be excluded`); }
    }
    check('all 3 originally-reported tags are now correctly excluded for this specific service', allExcluded);
}

console.log('\n=== The additional, individually-verified exclusions also correctly apply ===');
{
    const additional = ['#very_heavy', '#high_ceiling', '#very_high_ceiling', '#fan_box_missing'];
    let allExcluded = true;
    for (const tid of additional) {
        if (sandbox.tagValidForCategory(tid, CAT, GROUP, SVC)) { allExcluded = false; console.log(`    ${tid} still matches`); }
    }
    check('all 4 additional, individually-verified exclusions correctly apply', allExcluded);
}

console.log('\n=== The exclusion is genuinely per-service, not accidentally group-wide ===');
{
    // A different, real service in the SAME group should NOT be affected --
    // this is the whole point of the mechanism (a group can genuinely mix
    // matching and non-matching services).
    check(`a different, real service in the same group (${OTHER_SVC}) still correctly matches #heavy_lifting`,
        sandbox.tagValidForCategory('#heavy_lifting', CAT, GROUP, OTHER_SVC));
}

console.log('\n=== Backward compatibility: omitting serviceId behaves exactly as before ===');
{
    check('calling without a serviceId (the old 3-argument form) is unaffected by the new exclusion data',
        sandbox.tagValidForCategory('#heavy_lifting', CAT, GROUP));
    check('passing serviceId=null explicitly also behaves exactly as the old 3-argument form',
        sandbox.tagValidForCategory('#heavy_lifting', CAT, GROUP, null));
}

console.log('\n=== A tag with no exclusion data at all is completely unaffected ===');
{
    // T118: was #access_obstructed -- deleted along with the access
    // module it synthesized an answer for (access removed catalog-wide,
    // explicit operator decision). #no_parking still exists and, like
    // #access_obstructed did, has no excluded_service_ids of its own.
    check('a tag that never declared excluded_service_ids works exactly as before, with or without a serviceId',
        sandbox.tagValidForCategory('#no_parking', CAT, GROUP, SVC) &&
        sandbox.tagValidForCategory('#no_parking', CAT, GROUP));
}

console.log('\n=== Real, end-to-end verification: the actual chip list for the reported service ===');
{
    const NOISE_LIKE = new Set(); // matches getCuratedTids's own exclusions loosely for this check
    const allTagIds = Object.keys(DB.smart_tags);
    const chips = allTagIds.filter(tid => sandbox.tagValidForCategory(tid, CAT, GROUP, SVC));
    // v9.5.1: 10 -> 9. #two_person_required joined the exclusion list (see the
    // file header docstring for the reasoning) -- one additional, real,
    // same-category exclusion, not a drift/regression.
    // T118: 9 -> 8. #access_obstructed (previously one of these 9 valid
    // chips) was deleted catalog-wide along with the access module --
    // one fewer real chip, not a new exclusion or a regression.
    // T118: 8 -> 7. #pets_on_site (previously one of these 8 valid chips,
    // applicable_categories: ['all']) was deleted alongside pets_present
    // itself (fee: 0, could never meaningfully change a price) -- one
    // fewer real chip, not a new exclusion or a regression.
    check('the real chip count for this service dropped from 17 (T72) to 7, real and correct (was 8 post-access-removal, 9 pre-T118, 10 pre-v9.5.1)', chips.length === 7);
    check('none of the 8 excluded tags appear in the real, final chip list',
        !chips.some(t => ['#heavy_lifting', '#part_order_likely', '#two_trip_minimum', '#very_heavy', '#high_ceiling', '#very_high_ceiling', '#fan_box_missing', '#two_person_required'].includes(t)));
}

console.log(`\n[Per-service tag exclusion verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
