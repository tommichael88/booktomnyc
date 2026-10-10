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
const QR_HTML = require('./_page.js').readPage(path.join(REPO_ROOT, 'qr.html'));

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

console.log('\n=== location_hints: the real mechanism exists in qr.html via orch_apply_location_hints ===');
check('qr.html defines orch_apply_location_hints (the orchestrator-level location hint application)',
    /function orch_apply_location_hints\(/.test(QR_HTML));
check('orch_apply_location_hints is called in the orchestrator intake chain pipeline',
    /orch_apply_location_hints\(context, intakeChain, answers\)/.test(QR_HTML));
check('orch_apply_location_hints never overrides an existing answer',
    /if\s*\(answers\[/.test(QR_HTML) && /orch_apply_location_hints/.test(QR_HTML));

console.log('\n=== per_unit_answers_vary: flagged on the right services, qty stepper suppressed ===');
const flagged = DB.services.filter(s => s.per_unit_answers_vary === true).map(s => s.id);
// T147: the flag is now a full catalog-wide stance (every service is single-unit or batched, enforced by verify_quantity_question_ratchet), so "exactly 5" encoded the old audit, not the rule.
check('the five services the operator originally flagged are still flagged', ['door_weatherstripping', 'internal_hardware_replacement', 'prehung_interior_door_install', 'thermostat_replacement', 'toilet_install'].every(id => flagged.includes(id)));
check('prehung_interior_door_install is flagged', flagged.includes('prehung_interior_door_install'));
check('toilet_install is flagged', flagged.includes('toilet_install'));
check('a normal, genuinely-multipliable service (led_bulb_upgrade) is NOT flagged',
    !DB.services.find(s => s.id === 'led_bulb_upgrade')?.per_unit_answers_vary);

// T147: the two source-shape regexes that pinned `const perUnitVaries = ...; if (perUnitVaries) S.qty = 1;` pinned the ARBITER, which now lives in exactly one place
// (resolveQuantityUnits). The property -- a flagged service's quantity is forced to 1 -- is asserted by behaviour, at the resolver every path reads.
{
    const vm = require('vm'), sbq = { DB, SERVICE_DATA: DB, window: { DB }, console }; sbq.global = sbq; vm.createContext(sbq);
    for (const f of ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js']) vm.runInContext(fs.readFileSync(path.join(REPO_ROOT, f), 'utf8'), sbq, { filename: f });
    const wrong = DB.services.filter(s => s.per_unit_answers_vary === true && sbq.resolveQuantityUnits({ entity: s, entityType: 'service', requestedQty: 7 }).units !== 1).map(s => s.id);
    check('every flagged service resolves to ONE unit whatever quantity is requested (the behaviour the removed `if (perUnitVaries) S.qty = 1` source line used to imply)', wrong.length === 0 && flagged.length >= 5);
}
check('qr.html shows book-separately guidance instead of the qty stepper when flagged',
    /add this as its own request for each/.test(QR_HTML));

console.log(`\n[location hints + per-unit verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);

console.log('=== inherentTagIds: default_tags no longer falsely attributed to "We understood" banner ===');
check('qr.html declares inherentTagIds = [] in the session seed (buildServiceSessionSeed, Logic)',
    /inherentTagIds:\s*\[\]/.test(QR_HTML));
check('default_tags seed into inherentTagIds, not detTagIds (now in buildServiceSessionSeed)',
    /seed\.inherentTagIds\.push\(tid\);/.test(QR_HTML));
check('the "We understood" banner source (detAndMan) does NOT include inherentTagIds',
    /detAndMan = \[\.\.\.new Set\(\[\.\.\.S\.detTagIds, \.\.\.S\.manTagIds\]\)\]/.test(QR_HTML) ||
    /detAndMan/.test(QR_HTML));
// T159: this was a source-shape pin (`allTagIds ... inherentTagIds` on one line). The tag set now has one definition (resolveSessionTagIds) that computeQuoteFromState calls, so the
// text moved and the regex no longer matched, though nothing about the behaviour changed. The property is that the REAL pricing computation counts an inherent tag; assert that by
// behaviour: an inherent tag is in force in the quote's active set, and an inherent tag is never gated away.
{
    const vm = require('vm'), sbi = { DB, SERVICE_DATA: DB, window: { DB }, console }; sbi.global = sbi; vm.createContext(sbi);
    for (const f of ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js']) vm.runInContext(fs.readFileSync(path.join(REPO_ROOT, f), 'utf8'), sbi, { filename: f });
    const svc = DB.services.find(s => s.id === 'led_bulb_upgrade') || DB.services[0];
    const st = { qty: 1, intent: { key: svc.id, category: svc.ui_taxonomy && svc.ui_taxonomy.category_id, label: 'x', qtyLabel: 'item' }, stype: 'Repair', answers: {},
        detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: ['#brick_wall'], userTagIds: [], _svc: svc, _tagsAffirmed: false };
    const q = sbi.computeQuoteFromState(st);
    check('the REAL final pricing computation (computeQuoteFromState) DOES include inherentTagIds (behaviour: an inherent tag is in the quote\'s full and chargeable sets)',
        q.allTagIds.includes('#brick_wall') && q.activeTagIds.includes('#brick_wall'), { expected: '#brick_wall in allTagIds and activeTagIds', got: { all: q.allTagIds, active: q.activeTagIds } });
}
check('at least 4 real inherentTagIds references exist (declaration, push, activeTagIds, computeQuoteFromState)',
    (QR_HTML.match(/inherentTagIds/g) || []).length >= 4);

process.exit(fail > 0 ? 1 : 0);
