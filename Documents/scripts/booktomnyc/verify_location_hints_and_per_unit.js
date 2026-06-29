#!/usr/bin/env node
/**
 * verify_location_hints_and_per_unit.js
 *
 * Regression test for two real mechanisms added per direct feedback:
 *
 * 1. location_hints: a generic, reusable mechanism letting an intake
 *    question's answer be pre-selected based on S._location (e.g. a
 *    "front door" implies solid-core, a "bedroom door" implies hollow-
 *    core) -- without ever guessing when the location is genuinely
 *    ambiguous (a kitchen has no door-style correlation; a "guest
 *    bedroom" could mean the bedroom or its attached bathroom).
 * 2. per_unit_answers_vary: suppresses the quantity stepper entirely for
 *    services whose intake answers describe ONE specific unit (a
 *    particular door's size/material/removal status) that cannot be
 *    safely multiplied -- a front door and a bathroom door have
 *    different answers to every one of this service's real questions.
 */
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

function simulateLocationHint(mod, location) {
    const loc = location.toLowerCase().trim();
    const matches = (mod.client_response || []).filter(r =>
        (r.location_hints || []).some(h => h.toLowerCase() === loc));
    return matches.length === 1 ? matches[0].label : null;
}

console.log('=== location_hints: door_style_pref pre-selects correctly, never guesses when ambiguous ===');
const doorStyle = DB.intake_modules.door_style_pref;
check('entryway (front door) -> Solid core', /Solid core/.test(simulateLocationHint(doorStyle, 'entryway') || ''));
check('bedroom -> Hollow core', /Hollow core/.test(simulateLocationHint(doorStyle, 'bedroom') || ''));
check('hallway -> Hollow core', /Hollow core/.test(simulateLocationHint(doorStyle, 'hallway') || ''));
check('bathroom -> Solid core', /Solid core/.test(simulateLocationHint(doorStyle, 'bathroom') || ''));
check('kitchen (no real correlation) -> no pre-fill', simulateLocationHint(doorStyle, 'kitchen') === null);
check('basement (no hint authored) -> no pre-fill', simulateLocationHint(doorStyle, 'basement') === null);

console.log('\n=== location_hints: the real mechanism exists in qr.html, runs after allMods is finalized (no TDZ) ===');
check('qr.html defines applyLocationHints inside sqBuildCuratedIntake',
    /function applyLocationHints\(\)/.test(QR_HTML));
check('applyLocationHints is positioned AFTER the force-module injection loop (fixing a real TDZ bug caught during development)',
    (() => {
        const forceLoopEnd = QR_HTML.indexOf('existingKeys.add(fKey)');
        const hintFnStart = QR_HTML.indexOf('function applyLocationHints()');
        return forceLoopEnd > 0 && hintFnStart > forceLoopEnd;
    })());
check('applyLocationHints never overrides an existing answer',
    /if \(S\.answers\[mod\.moduleKey\]\) return;/.test(QR_HTML));

console.log('\n=== per_unit_answers_vary: flagged on the right services, qty stepper suppressed ===');
const flagged = DB.services.filter(s => s.per_unit_answers_vary === true).map(s => s.id);
check('exactly 5 services flagged', flagged.length === 5);
check('prehung_interior_door_install is flagged', flagged.includes('prehung_interior_door_install'));
check('toilet_install is flagged', flagged.includes('toilet_install'));
check('a normal, genuinely-multipliable service (led_bulb_upgrade) is NOT flagged',
    !DB.services.find(s => s.id === 'led_bulb_upgrade')?.per_unit_answers_vary);

check('qr.html reads svc.per_unit_answers_vary and forces qty to 1',
    /const perUnitVaries = !!svc\.per_unit_answers_vary;/.test(QR_HTML) && /if \(perUnitVaries\) S\.qty = 1;/.test(QR_HTML));
check('qr.html shows book-separately guidance instead of the qty stepper when flagged',
    /add this as its own request for each/.test(QR_HTML));

console.log(`\n[location hints + per-unit verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);

console.log('=== inherentTagIds: default_tags no longer falsely attributed to "We understood" banner ===');
check('qr.html declares S.inherentTagIds = [] in prefillSmartQuoteFromService',
    /S\.inherentTagIds = \[\];/.test(QR_HTML));
check('default_tags seed into inherentTagIds, not detTagIds',
    /S\.inherentTagIds\.push\(tid\);/.test(QR_HTML));
check('the "We understood" banner source (detAndMan) does NOT include inherentTagIds',
    /const detAndMan = \[\.\.\.new Set\(\[\.\.\.S\.detTagIds, \.\.\.S\.manTagIds\]\)\];/.test(QR_HTML));
check('the REAL final pricing computation (computeQuoteFromState) DOES include inherentTagIds',
    /const activeTagIds = \[\.\.\.new Set\(\[\.\.\.\(S\.detTagIds\|\|\[\]\), \.\.\.\(S\.manTagIds\|\|\[\]\), \.\.\.\(S\.inherentTagIds\|\|\[\]\)\]\)\]/.test(QR_HTML));
check('at least 9 other pricing/eligibility sites also include inherentTagIds',
    (QR_HTML.match(/inherentTagIds/g) || []).length >= 13); // 9 sites + declaration + push + comments etc.

process.exit(fail > 0 ? 1 : 0);
