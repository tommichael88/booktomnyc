#!/usr/bin/env node
/**
 * verify_tag_group_scoping_precision.js
 *
 * Regression test for T72's flagged "bigger item": full, per-group
 * precision for #heavy_lifting/#part_order_likely/#two_trip_minimum,
 * narrowed from category-level to specific applicable_group_ids with
 * documented, evidence-based reasoning per group.
 *
 * Honest limitation, not fully resolved and not claimed to be: group-level
 * scoping cannot achieve full per-service precision when a group genuinely
 * contains both matching and non-matching services (e.g. electric_lighting_
 * light_fixtures has both large chandeliers, where "heavy lifting" is real,
 * and small under-cabinet LED strips, where it isn't) -- that would need a
 * new per-service tag-exclusion mechanism, a genuinely separate, larger
 * architectural question, not a data-scoping fix. This test verifies the
 * real, achievable improvement (clear group-level exclusions now correctly
 * exclude), not a false claim of total precision.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.dirname(__dirname);
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

function tagValidForCategory(tid, cat, groupId) {
    const tag = (DB.smart_tags || {})[tid];
    if (!tag) return false;
    const cats = tag.applicable_categories;
    const universal = !cats || cats.length === 0 || cats.includes('all');
    const categoryMatches = universal || cats.includes(cat);
    if (!categoryMatches) return false;
    const gids = tag.applicable_group_ids;
    if (gids && gids.length > 0) return !!groupId && gids.includes(groupId);
    return categoryMatches;
}

console.log('=== Clear, high-confidence exclusions are now correctly excluded ===');
{
    const clearExclusions = [
        ['#heavy_lifting', 'electric_lighting', 'electric_lighting_switches', 'Dimmer/smart switches -- tiny hardware'],
        ['#heavy_lifting', 'electric_lighting', 'electric_lighting_outlets', 'Outlets -- tiny hardware'],
        ['#heavy_lifting', 'electric_lighting', 'electric_lighting_bulbs', 'Bulbs -- always light'],
        ['#heavy_lifting', 'minor_home_repairs', 'minor_home_repairs_walls', 'Drywall patching -- no heavy components'],
        ['#part_order_likely', 'electric_lighting', 'electric_lighting_bulbs', 'Bulbs -- universally stocked'],
        ['#part_order_likely', 'electric_lighting', 'electric_lighting_switches', 'Switches -- standardized, stocked'],
        ['#part_order_likely', 'minor_home_repairs', 'minor_home_repairs_walls', 'Generic, always-stocked patch materials'],
        ['#part_order_likely', 'tech_trouble', 'tech_trouble_cable_management', 'Generic cable ties/raceways'],
        ['#two_trip_minimum', 'electric_lighting', 'electric_lighting_bulbs', 'Bulbs -- universally stocked'],
    ];
    let allCorrect = true;
    for (const [tid, cat, groupId, reason] of clearExclusions) {
        const matches = tagValidForCategory(tid, cat, groupId);
        if (matches) { allCorrect = false; console.log(`    UNEXPECTED MATCH: ${tid} / ${groupId} (${reason})`); }
    }
    check(`all ${clearExclusions.length} clear, high-confidence exclusions are correctly excluded`, allCorrect);
}

console.log('\n=== Clear, high-confidence inclusions are still correctly included ===');
{
    const clearInclusions = [
        ['#heavy_lifting', 'minor_home_repairs', 'minor_home_repairs_appliances_refrigerator', 'Refrigerators are heavy'],
        ['#part_order_likely', 'minor_home_repairs', 'minor_home_repairs_appliances_dishwasher', 'Matches dishwasher_repair\'s own documented reasoning'],
        ['#part_order_likely', 'plumbing_help', 'plumbing_help_toilets', 'Toilet parts vary by model'],
        ['#two_trip_minimum', 'minor_home_repairs', 'minor_home_repairs_doors', 'Matches the real hardware_type "Deadbolt lock" case'],
    ];
    let allCorrect = true;
    for (const [tid, cat, groupId, reason] of clearInclusions) {
        const matches = tagValidForCategory(tid, cat, groupId);
        if (!matches) { allCorrect = false; console.log(`    UNEXPECTED EXCLUSION: ${tid} / ${groupId} (${reason})`); }
    }
    check(`all ${clearInclusions.length} clear, high-confidence inclusions are still correctly included`, allCorrect);
}

console.log('\n=== Honest limitation, verified not silently overclaimed ===');
{
    // Light Fixtures genuinely contains both large chandeliers (heavy_lifting
    // is real) and small LED strips (it isn't) -- group-level scoping cannot
    // separate these; per-service precision would need a different mechanism.
    const stillMatches = tagValidForCategory('#heavy_lifting', 'electric_lighting', 'electric_lighting_light_fixtures');
    check('Light Fixtures still matches #heavy_lifting (honest limitation: group contains both heavy and light services, not fully separable at group level)', stillMatches);
}

console.log(`\n[tag group-scoping precision verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
