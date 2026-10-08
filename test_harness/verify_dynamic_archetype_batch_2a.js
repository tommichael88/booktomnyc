#!/usr/bin/env node
/**
 * verify_dynamic_archetype_batch_2a.js
 *
 * Verifies Issue 2a of the operator-directed external catalog audit:
 * component_first groups' Mount/Install/Setup/Assembly dynamic_service
 * fallbacks asked only global_quantity -- "how many?" with no question
 * at all about what's being mounted/installed. Per §6E.6's own
 * wire-or-remove test, a bare quantity question on an unidentified
 * object fails every one of the four tests (Price/Time/Branch/Prep) on
 * its own -- the object itself must be identified first.
 *
 * 26 dynamic_services entries fixed, each given a real "what
 * specifically" component question as its new first step. Four reused
 * the catalog's own existing, well-fitting vocabulary modules
 * (mounting_item, plumbing_fixture, electrical_item, tech_device).
 * Two new modules were authored where the existing vocabulary
 * genuinely didn't fit: `appliance_item` (no module asked which
 * appliance) and `cable_install_item` (tech_device's own options don't
 * describe cable work at all, and cable_symptom is a diagnostic
 * question authored for a different fallback entirely).
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.dirname(__dirname);
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(desc, cond) {
    if (cond) { pass++; console.log(`  \u2713 ${desc}`); }
    else { fail++; console.log(`  \u2717 ${desc}`); }
}

function chain(key) {
    return DB.dynamic_services[key].intake_chain.map(s => s.module);
}

console.log('=== Reused existing vocabulary: mounting_item on all 5 wall_mounting +Mount fallbacks ===');
for (const grp of ['wall_mounting_drywall_or_plaster', 'wall_mounting_blinds_curtain', 'wall_mounting_frames_shelves', 'wall_mounting_tv_flatscreen', 'wall_mounting_brick_or_concrete']) {
    const key = `wall_mounting+${grp}+Mount`;
    check(`${key} now leads with mounting_item, keeps global_quantity`, JSON.stringify(chain(key)) === JSON.stringify(['mounting_item', 'global_quantity']));
}

console.log('\n=== Reused existing vocabulary: electrical_item on all 6 electric_lighting +Install fallbacks ===');
for (const grp of ['electric_lighting_bulbs', 'electric_lighting_fans', 'electric_lighting_light_fixtures', 'electric_lighting_outlets', 'electric_lighting_switches', 'electric_lighting_thermostats']) {
    const key = `electric_lighting+${grp}+Install`;
    check(`${key} now leads with electrical_item`, chain(key)[0] === 'electrical_item');
}

console.log('\n=== Reused existing vocabulary: plumbing_fixture on all 5 plumbing_help fallbacks (4 Install + 1 Mount) ===');
for (const key of ['plumbing_help+plumbing_help_garbage_disposals+Mount', 'plumbing_help+plumbing_help_sinks+Install', 'plumbing_help+plumbing_help_showers_tubs+Install', 'plumbing_help+plumbing_help_toilets+Install', 'plumbing_help+plumbing_help_water_lines+Install']) {
    check(`${key} now leads with plumbing_fixture`, chain(key)[0] === 'plumbing_fixture');
}

console.log('\n=== Reused existing vocabulary: tech_device on the 3 sub-groups it genuinely fits (computer_repair, networking, smart_home) ===');
for (const grp of ['tech_trouble_computer_repair', 'tech_trouble_networking', 'tech_trouble_smart_home']) {
    for (const action of ['Install', 'Setup']) {
        const key = `tech_trouble+${grp}+${action}`;
        check(`${key} now leads with tech_device`, chain(key)[0] === 'tech_device');
    }
}

console.log('\n=== New module authored: appliance_item (no existing module asked "which appliance") ===');
{
    const mod = DB.intake_modules.appliance_item;
    check('appliance_item exists with real, matching options (Washer/Dryer/Stove/Refrigerator/Dishwasher/Microwave/Window AC/Other)',
        mod && ['Washer', 'Dryer', 'Stove/Range', 'Refrigerator', 'Dishwasher', 'Microwave', 'Window AC'].every(l => mod.client_response.some(r => r.label === l)));
    const key = 'minor_home_repairs+minor_home_repairs_appliances+Mount';
    check(`${key} now leads with appliance_item`, chain(key)[0] === 'appliance_item');
}

console.log('\n=== New module authored: cable_install_item (tech_device doesn\'t fit cable work; cable_symptom is a different, diagnostic-only question) ===');
{
    const mod = DB.intake_modules.cable_install_item;
    const realLabels = (m) => m.client_response.map(r => r.label).filter(l => !l.startsWith('Other'));
    check('cable_install_item exists, genuinely distinct from cable_symptom (no overlapping real option labels, excluding the generic "Other" fallback both share)',
        mod && !realLabels(mod).some(l => realLabels(DB.intake_modules.cable_symptom).includes(l)));
    for (const action of ['Install', 'Setup']) {
        const key = `tech_trouble+tech_trouble_cable_management+${action}`;
        check(`${key} now leads with cable_install_item, not tech_device`, chain(key)[0] === 'cable_install_item');
    }
}

console.log('\n=== The one genuine, multi-category catch-all: install_target correctly wired into the bare minor_home_repairs+Install fallback ===');
{
    check('minor_home_repairs+Install now leads with install_target', chain('minor_home_repairs+Install')[0] === 'install_target');
    check('install_target is no longer orphaned', !('_orphan_backlog_note' in DB.intake_modules.install_target));
}

console.log('\n=== Regression: no service or dynamic_service still has a bare, qty-only Mount/Install/Setup/Assembly chain among the 26 named targets ===');
{
    const QTY_MODS = new Set(['item_count', 'count', 'hybrid_qty', 'global_quantity']);
    const targets = ['minor_home_repairs+Install', 'minor_home_repairs+minor_home_repairs_appliances+Mount',
        'wall_mounting+wall_mounting_drywall_or_plaster+Mount', 'wall_mounting+wall_mounting_blinds_curtain+Mount',
        'wall_mounting+wall_mounting_frames_shelves+Mount', 'wall_mounting+wall_mounting_tv_flatscreen+Mount',
        'wall_mounting+wall_mounting_brick_or_concrete+Mount',
        'electric_lighting+electric_lighting_bulbs+Install', 'electric_lighting+electric_lighting_fans+Install',
        'electric_lighting+electric_lighting_light_fixtures+Install', 'electric_lighting+electric_lighting_outlets+Install',
        'electric_lighting+electric_lighting_switches+Install', 'electric_lighting+electric_lighting_thermostats+Install',
        'plumbing_help+plumbing_help_garbage_disposals+Mount', 'plumbing_help+plumbing_help_sinks+Install',
        'plumbing_help+plumbing_help_showers_tubs+Install', 'plumbing_help+plumbing_help_toilets+Install',
        'plumbing_help+plumbing_help_water_lines+Install',
        'tech_trouble+tech_trouble_computer_repair+Install', 'tech_trouble+tech_trouble_computer_repair+Setup',
        'tech_trouble+tech_trouble_networking+Install', 'tech_trouble+tech_trouble_networking+Setup',
        'tech_trouble+tech_trouble_smart_home+Install', 'tech_trouble+tech_trouble_smart_home+Setup',
        'tech_trouble+tech_trouble_cable_management+Install', 'tech_trouble+tech_trouble_cable_management+Setup'];
    const stillBare = targets.filter(k => {
        const c = chain(k);
        return c.length > 0 && c.every(m => QTY_MODS.has(m));
    });
    check(`zero of the 26 named targets are still a bare, qty-only chain (found: ${stillBare.join(', ') || 'none'})`, stillBare.length === 0);
}

console.log(`\n[dynamic archetype alignment, Issue 2a] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
