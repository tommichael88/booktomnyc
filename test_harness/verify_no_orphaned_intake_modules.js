/**
 * verify_no_orphaned_intake_modules.js
 *
 * A permanent, catalog-wide guard against intake_modules being authored
 * and then never referenced by any real service's intake_chain -- built
 * directly in response to a fair, pointed criticism: verify_no_orphaned_
 * dual_mapping_services.js (T74) checks ONE narrow kind of orphaning
 * (component/symptom service mappings); it was never a general-purpose
 * sweep, and nothing else was checking THIS kind of orphaning at all.
 * The 16 real, previously-unflagged orphans this test starts from were
 * found by hand, with no permanent coverage behind the finding -- exactly
 * the gap this file exists to close.
 *
 * A module counts as referenced if any real service OR dynamic_services
 * entry's intake_chain uses it, OR if it appears in either's
 * remote_deep_dive_modules (a real, separate mechanism confirmed during
 * this same investigation -- an earlier, narrower check that only looked
 * at intake_chain would have produced false positives here).
 *
 * This test does NOT fail on every orphan. A prior, real audit (v9.1,
 * v9.5 -- see each module's own _orphan_backlog_note) already reviewed
 * a set of modules, found no genuinely matching service for them, and
 * deliberately left them unwired rather than guess -- correct, sound
 * reasoning this test respects by treating any module with its own
 * _orphan_backlog_note as an expected, reviewed orphan, not a failure.
 * It fails ONLY on a module that is BOTH orphaned AND not yet carrying
 * that same, explicit sign of review -- the honest, current state of
 * "found, not yet decided," not silently accepted as fine.
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

const im = db.intake_modules || {};
const allModules = new Set(Object.keys(im));

console.log('=== Scanning every real intake_chain (including then-branch targets) and remote_deep_dive_modules entry ===\n');

const referenced = new Set();
function scanChain(chain) {
    for (const step of chain || []) {
        if (step.module) referenced.add(step.module);
        // v9.6 FIX: was step.module only -- a real, confirmed false
        // positive this missed entirely: prehung_interior_door_install's
        // own intake_chain branches conditionally
        // (then: {"No, I need you to procure it": ["door_size",
        // "door_style_pref"]}) -- door_size/door_style_pref are
        // genuinely, already asked, just conditionally on a specific
        // answer, not as an unconditional top-level step. Verified
        // directly against the real data before trusting this, not
        // assumed from the suggestion alone.
        for (const targets of Object.values(step.then || {})) {
            if (Array.isArray(targets)) {
                for (const t of targets) if (t) referenced.add(t);
            }
        }
    }
}
for (const s of db.services || []) {
    scanChain(s.intake_chain);
    for (const m of s.remote_deep_dive_modules || []) referenced.add(m);
}
for (const v of Object.values(db.dynamic_services || {})) {
    scanChain(v.intake_chain);
    for (const m of v.remote_deep_dive_modules || []) referenced.add(m);
}

console.log(`\nTotal modules: ${allModules.size}, referenced via intake_chain/remote_deep_dive_modules: ${referenced.size}`);

// T118: a fourth, real, direct reference mechanism -- global_rules.
// intake_defaults (universal / category_defaults / group_defaults),
// replacing the old force_modules_by_variability this check used to
// detect only indirectly (via fallback-pattern/QTY_MODS-set matching
// below). Checked directly against the actual data structure, not a
// text-pattern guess, since intake_defaults is real, structured JSON.
for (const m of (db.global_rules?.intake_defaults?.universal || [])) referenced.add(m);
for (const arr of Object.values(db.global_rules?.intake_defaults?.category_defaults || {})) {
    for (const m of arr) referenced.add(m);
}
for (const arr of Object.values(db.global_rules?.intake_defaults?.group_defaults || {})) {
    for (const m of arr) referenced.add(m);
}

// A real, confirmed false-positive risk in this exact check, caught by
// direct verification, not assumed clean: some modules are referenced
// directly by qr.html's OWN code, as hardcoded fallback defaults (e.g.
// force_modules_by_variability's default when no tier-specific mapping
// exists) -- a fifth, real reference mechanism beyond intake_chain and
// remote_deep_dive_modules. Confirmed directly: hybrid_qty appears
// nowhere in any intake_chain, but is genuinely, extensively referenced
// this way.
//
// A first version of this check searched for the module name as ANY
// quoted string anywhere in qr.html -- too broad, confirmed directly to
// produce real false positives: door_size/door_style_pref only appear
// inside COMPONENT_MODULE_NAMES (a classification taxonomy used to
// categorize a module IF it's ever used, not itself evidence of use),
// and disposal matched an unrelated NLP keyword for a different group
// entirely. Narrowed to the actual, specific shape that made hybrid_qty
// a genuine positive: appearing as a fallback default
// (`|| ['module_name']`) or inside one of the small, specific,
// hardcoded quantity-module sets it's known to live in.
const qrHtml = require('./_page.js').readPage(path.join(REPO_ROOT, 'qr.html'));
const codeReferenced = new Set();
for (const mod of allModules) {
    if (referenced.has(mod)) continue; // already confirmed live, no need to re-check
    const escaped = mod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const isFallbackDefault = new RegExp(`\\|\\|\\s*\\[['"]${escaped}['"]\\]`).test(qrHtml);
    const isInKnownModuleSet = new RegExp(`(?:QTY_MODS|ORCH_QTY_MODS)[^\\]]*['"]${escaped}['"]`).test(qrHtml);
    if (isFallbackDefault || isInKnownModuleSet) codeReferenced.add(mod);
}
if (codeReferenced.size > 0) {
    console.log(`Also referenced directly by qr.html's own code (hardcoded fallback/default, not intake_chain): ${[...codeReferenced].sort().join(', ')}`);
    for (const m of codeReferenced) referenced.add(m);
}

// T118: a block that used to read global_rules.force_modules_by_variability's
// own per-tier data directly was removed here -- that key is now
// force_modules_by_variability_DEPRECATED (empty of active meaning by
// design), and everything this block used to catch (urgency, plus
// confirming disposal_request/parking_difficulty/pets_present/item_volume
// are NOT force-injected) is already covered, more correctly, by the
// intake_defaults scan earlier in this file.

check(`found a real, substantial set of referenced modules (>= 60)`, referenced.size >= 60);

// Computed only now, AFTER codeReferenced has been folded in -- doing
// this before would have wrongly counted hybrid_qty (and any future
// module referenced the same, code-level way) as orphaned.
const orphaned = [...allModules].filter(m => !referenced.has(m));
const reviewedOrphans = orphaned.filter(m => '_orphan_backlog_note' in im[m]);
const unreviewedOrphans = orphaned.filter(m => !('_orphan_backlog_note' in im[m]));

console.log(`Orphaned after accounting for all three reference mechanisms: ${orphaned.length}`);
console.log(`  Already reviewed (carries its own _orphan_backlog_note): ${reviewedOrphans.length}`);
console.log(`  NOT yet reviewed: ${unreviewedOrphans.length}`);

// v9.6 FIX: was a hardcoded `reviewedOrphans.length >= 4` threshold.
// Confirmed directly, not assumed, that this was doubly wrong: (1) it's
// brittle in the direction of real progress -- wiring up a genuine gap
// among the reviewed orphans (a GOOD change) would drop the count and
// fail this check as if it were a regression; (2) a suggested fix
// (filtering reviewedOrphans, itself already derived as a subset of
// "not referenced", for "is referenced") was checked directly and found
// logically vacuous -- always empty by construction, providing no real
// protection at all, regardless of any actual data change. The correct
// check: scan EVERY module carrying the note (not pre-filtered to only
// currently-orphaned ones) and confirm none of them have quietly become
// referenced without the note being removed. This is also, concretely,
// the exact check that would have automatically caught the
// appliance_type/floor_type stale-note bug found by hand earlier in
// this same investigation, instead of requiring another manual
// discovery next time it happens.
const modulesWithNote = [...allModules].filter(m => '_orphan_backlog_note' in im[m]);
const staleNotes = modulesWithNote.filter(m => referenced.has(m));
check(`no _orphan_backlog_note is stale (found ${staleNotes.length} module(s) marked orphaned that are now genuinely referenced -- confirmed real earlier this session for appliance_type/floor_type)`,
    staleNotes.length === 0);
if (staleNotes.length > 0) {
    console.log(`  Stale notes needing removal: ${staleNotes.sort().join(', ')}`);
}

check(`zero UNREVIEWED orphaned modules (found ${unreviewedOrphans.length}) -- each of these is either a genuine gap (a real service should reference it and doesn't) or a genuine dead end (no real service should) that hasn't been decided and documented yet either way`,
    unreviewedOrphans.length === 0);

if (unreviewedOrphans.length > 0) {
    console.log('\n  Unreviewed orphans, needing either real wiring into a matching service\'s intake_chain or an explicit _orphan_backlog_note documenting why not:');
    for (const m of unreviewedOrphans.sort()) {
        console.log(`    ${m}: ${JSON.stringify(im[m].question || im[m].config || '(no question field)')}`);
    }
}

console.log(`\n[no orphaned intake_modules] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
