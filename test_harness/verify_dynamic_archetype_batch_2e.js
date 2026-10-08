#!/usr/bin/env node
/**
 * verify_dynamic_archetype_batch_2e.js
 *
 * Verifies Issue 2e of the operator-directed external catalog audit --
 * the final batch of Issue 2. The Setup module ("What type of setup
 * are we working on? Desktop computer setup / TV / media center /
 * Both") is a tech_trouble-specific question, but was also present on
 * two non-tech_trouble NAMED services: cable_management and
 * flatscreen_mounting_standard. Neither is a computer/TV "setup type"
 * decision -- both already know what they are from their own name.
 *
 * Resolution: removed Setup from both, no replacement needed (per
 * explicit operator guidance -- unlike 2a-2d, this wasn't a wrong-
 * vocabulary problem needing a substitute, just a genuinely
 * mis-attached question to remove outright).
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

console.log('=== Setup removed from both named services, nothing else touched ===');
{
    const cm = DB.services.find(s => s.id === 'cable_management');
    check('cable_management no longer has Setup in its intake_chain',
        !cm.intake_chain.some(s => s.module === 'Setup'));
    check('cable_management: mounting_height and hybrid_qty are both still present (only Setup removed)',
        JSON.stringify(cm.intake_chain.map(s => s.module)) === JSON.stringify(['mounting_height', 'hybrid_qty']));

    const fm = DB.services.find(s => s.id === 'flatscreen_mounting_standard');
    check('flatscreen_mounting_standard no longer has Setup in its intake_chain',
        !fm.intake_chain.some(s => s.module === 'Setup'));
    check('flatscreen_mounting_standard: all 4 other real questions still present, in order',
        JSON.stringify(fm.intake_chain.map(s => s.module)) === JSON.stringify(['wall_type', 'weight', 'global_quantity', 'mounting_height']));
}

console.log('\n=== Setup remains correctly referenced where it genuinely belongs (real tech_trouble dynamic_services) ===');
{
    let stillReferenced = false;
    for (const dyn of Object.values(DB.dynamic_services)) {
        if (dyn.intake_chain.some(s => s.module === 'Setup')) { stillReferenced = true; break; }
    }
    check('Setup still has at least one real, genuinely-fitting referrer (tech_trouble+Install / tech_trouble+Setup)', stillReferenced);
}

console.log('\n=== Neither service ended up with an empty chain ===');
{
    const cm = DB.services.find(s => s.id === 'cable_management');
    const fm = DB.services.find(s => s.id === 'flatscreen_mounting_standard');
    check('cable_management still has real questions left', cm.intake_chain.length > 0);
    check('flatscreen_mounting_standard still has real questions left', fm.intake_chain.length > 0);
}

console.log(`\n[dynamic archetype alignment, Issue 2e -- final batch] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
