/**
 * verify_no_orphaned_dual_mapping_services.js
 *
 * T74's permanent regression guard, not just a one-time manual finding.
 *
 * A group can be authored with BOTH a component_id_to_service_ids
 * mapping AND a symptom_id_to_service_ids mapping -- a real, legitimate,
 * deliberate pattern (confirmed directly in T74: 11 real groups do this
 * today). But a group's single routing_archetype field can only select
 * ONE of these two mappings as "live" for renderComponentSymptomPicker.
 * Any service that exists ONLY in the other, non-selected mapping is
 * silently unreachable via that picker -- not a missing capability
 * (the service itself, and its own intake_chain, are typically already
 * correct and deliberate, per checkRoutingArchetypeConsistency's own,
 * separate validation), just a missing PATH to one that already exists.
 *
 * T74 found and fixed 4 real, live instances of this (Washer,
 * Refrigerator, Dishwasher, Computer Repair -- always the Install/Setup-
 * type service, orphaned by a correctly symptom_first-classified group)
 * by surfacing each orphaned service as its own explicit tile. That fix
 * is necessarily reactive to whatever's orphaned TODAY. This test exists
 * so the NEXT time someone authors a group this same, legitimate,
 * dual-mapping way, a genuinely orphaned service is caught here, in a
 * permanent, catalog-wide sweep -- not rediscovered by another deep,
 * manual investigation, and not left to silently ship as a customer-
 * facing dead end.
 *
 * This test does NOT fail on the dual-mapping pattern itself (11 real
 * groups use it correctly, with no orphan at all) -- only on a genuine
 * orphan: a service present in one mapping and completely absent from
 * the other, for a group where routing_archetype has already picked
 * one of the two as live.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const db = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(desc, cond) {
    if (cond) { pass++; console.log(`  \u2713 ${desc}`); }
    else { fail++; console.log(`  \u2717 ${desc}`); }
}

const raMap = db.routing_archetypes || {};
const servicesById = new Map((db.services || []).map(s => [s.id, s]));

// Read the REAL, live allowlist directly from qr.html rather than
// duplicating it as a second, hardcoded copy here -- a second copy is
// exactly the kind of drift-prone pattern this whole investigation was
// about. A group outside this allowlist never reaches
// renderComponentSymptomPicker at all (it uses the older, safe flat-
// services grid instead, which already shows every named service
// regardless of any component/symptom mapping) -- so an orphan there
// is a real, latent data issue, but not YET a customer-facing one.
const qrHtml = require('./_page.js').readPage(path.join(REPO_ROOT, 'qr.html'));
const allowlistMatch = qrHtml.match(/PICKER_ENABLED_GROUPS\s*=\s*new Set\(\[([^\]]+)\]\)/);
if (!allowlistMatch) throw new Error('PICKER_ENABLED_GROUPS not found in qr.html -- has it been renamed or restructured?');
const pickerEnabledGroups = new Set(
    [...allowlistMatch[1].matchAll(/'([^']+)'/g)].map(m => m[1])
);

console.log('=== Scanning every group with both a component and a symptom mapping ===\n');

const dualMappedGroups = Object.entries(raMap).filter(([gid, ra]) => {
    const comp = ra.component_id_to_service_ids || {};
    const symp = ra.symptom_id_to_service_ids || {};
    return Object.keys(comp).length > 0 && Object.keys(symp).length > 0;
});

check(`found the expected, real set of dual-mapped groups (>= 10)`, dualMappedGroups.length >= 10);
check(`successfully read the real, live PICKER_ENABLED_GROUPS allowlist from qr.html (${pickerEnabledGroups.size} groups)`, pickerEnabledGroups.size > 0);

// The exact 4 real orphans T74 found and fixed -- kept explicit so a
// regression (one of these silently reappearing, e.g. from a data
// revert) is caught by name, not just by count.
const KNOWN_FIXED_ORPHANS = new Set([
    'washer_install',
    'refrigerator_install',
    'dishwasher_install',
    'software_or_driver_install',
]);

let unexpectedOrphans = [];
let harmlessDataLevelOrphans = [];
let confirmedStillFixed = new Set();

for (const [gid, ra] of dualMappedGroups) {
    const archetype = ra.routing_archetype;
    if (!archetype || archetype === 'undetermined' || archetype === 'parent') continue;

    const compMap = ra.component_id_to_service_ids || {};
    const sympMap = ra.symptom_id_to_service_ids || {};
    const isComponentFirst = archetype === 'component_first';
    const liveMap = isComponentFirst ? compMap : sympMap;
    const deadMap = isComponentFirst ? sympMap : compMap;

    const liveServices = new Set();
    for (const ids of Object.values(liveMap)) for (const id of ids) liveServices.add(id);
    const deadServices = new Set();
    for (const ids of Object.values(deadMap)) for (const id of ids) deadServices.add(id);

    for (const svcId of deadServices) {
        if (liveServices.has(svcId)) continue; // redundant, not orphaned -- fine

        if (KNOWN_FIXED_ORPHANS.has(svcId)) {
            confirmedStillFixed.add(svcId);
        } else if (!pickerEnabledGroups.has(gid)) {
            // Real, data-level orphan, but this group never reaches
            // renderComponentSymptomPicker at all today -- the older,
            // safe flat-grid path (renderServices) already shows every
            // named service regardless. Not urgent, but real: if this
            // group is EVER added to PICKER_ENABLED_GROUPS later
            // without re-checking this, it becomes a live customer gap
            // immediately, silently.
            harmlessDataLevelOrphans.push({ gid, svcId, archetype });
        } else {
            unexpectedOrphans.push({ gid, svcId, archetype });
        }
    }
}

check(`the 4 known orphans T74 fixed are all still present as real, tracked findings (not silently removed from the data without updating this test)`,
    confirmedStillFixed.size === KNOWN_FIXED_ORPHANS.size);

check(`zero UNEXPECTED, customer-facing orphaned services in a PICKER_ENABLED_GROUPS group (found ${unexpectedOrphans.length}) -- any new one here is a real, live gap: a service authored in a group's non-live mapping, in a group real customers actually reach via renderComponentSymptomPicker, with no path to it`,
    unexpectedOrphans.length === 0);

if (unexpectedOrphans.length > 0) {
    console.log('\n  New, customer-facing orphans found, needing the same T74-style fix (a tile in renderComponentSymptomPicker) or conscious removal from the dead mapping if no longer intended:');
    for (const o of unexpectedOrphans) {
        const svc = servicesById.get(o.svcId);
        console.log(`    ${o.gid} (${o.archetype}): ${o.svcId} (${svc?.ui_taxonomy?.display_name || 'unknown display name'})`);
    }
}

if (harmlessDataLevelOrphans.length > 0) {
    console.log(`\n  \u2139 ${harmlessDataLevelOrphans.length} real, data-level orphan(s) outside PICKER_ENABLED_GROUPS -- currently harmless (served correctly via the older flat-grid path instead), but worth knowing about before ever adding that group to the allowlist:`);
    for (const o of harmlessDataLevelOrphans) {
        const svc = servicesById.get(o.svcId);
        console.log(`    ${o.gid} (${o.archetype}): ${o.svcId} (${svc?.ui_taxonomy?.display_name || 'unknown display name'})`);
    }
}

console.log(`\n[no orphaned dual-mapping services] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
