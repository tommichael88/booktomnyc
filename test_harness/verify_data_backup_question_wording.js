/**
 * verify_data_backup_question_wording.js
 *
 * Verifies the T118, Step 6 item 8 fix for PENDING_DECISIONS.md #23:
 * data_backup_or_transfer's intake read as confusing -- tech_issue_source
 * mixed two unrelated dimensions (working-state vs device-type) as
 * sibling options in one question, and tech_problem_type (shared with
 * computer_diagnostic and virus_or_malware_removal) asked about
 * "Virus or pop-ups" / "Running slow", neither relevant to a backup or
 * transfer request.
 *
 * Fix: tech_issue_source rewritten (confirmed used exclusively by this
 * service, so the rewrite cannot affect anything else) into a single,
 * clear, situation-focused question, folding in the "lost or corrupted
 * files" scenario with its original modifier_ref preserved rather than
 * dropped. A new, dedicated backup_source_device module replaces the
 * shared, off-topic tech_problem_type for this service specifically.
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

console.log('=== data_backup_or_transfer\'s own chain no longer includes the shared, off-topic module ===');
{
    const svc = DB.services.find(s => s.id === 'data_backup_or_transfer');
    const modules = svc.intake_chain.map(s => s.module);
    check('tech_problem_type ("Virus or pop-ups"/"Running slow") is gone from this service\'s chain', !modules.includes('tech_problem_type'));
    check('the rewritten tech_issue_source is still present', modules.includes('tech_issue_source'));
    check('the new, dedicated backup_source_device module is present', modules.includes('backup_source_device'));
    // T193 (#137 S3): this pinned `hybrid_qty` in the chain. The chain already lacked it at the earliest history the repository holds (`b7fff909`, the T156 baseline) and has been exactly these two
    // modules since; the service is priced by its situation and device, not a count. What the pin guarded (the rewrite did not leave a module the catalog cannot resolve) is held here instead.
    check('every module in the service\'s chain exists in the catalog (the rewrite left nothing dangling)', modules.length > 0 && modules.every(m => !!DB.intake_modules[m]));
}

console.log('\n=== tech_issue_source: rewritten into one coherent question, not a working-state/device-type mashup ===');
{
    const mod = DB.intake_modules.tech_issue_source;
    check('the question itself changed from the confusing original', mod.question !== 'What is the source of the problem?');
    check('no option is a bare device-type label mixed in as a sibling to a situation option (the original\'s exact confusion)',
        !mod.client_response.some(r => /^(hard drive|phone\s*\/\s*mobile device)$/i.test(r.label.trim())));
    check('the "lost or corrupted files" scenario is preserved as a real option, not dropped',
        mod.client_response.some(r => /lost|corrupted/i.test(r.label)));
    check('that option still carries its original, real $30/25min modifier_ref -- the pricing signal was not lost in the rewrite',
        mod.client_response.find(r => /lost|corrupted/i.test(r.label))?.modifier_ref === 'tech_problem_type_lost_or_corrupted_files');
}

console.log('\n=== backup_source_device: a real, dedicated, on-topic question ===');
{
    const mod = DB.intake_modules.backup_source_device;
    check('backup_source_device exists with a real question about the device, not the problem', !!mod && /device/i.test(mod.question));
    check('has a real, non-trivial option set', mod.client_response.length >= 3);
    check('no option references viruses, pop-ups, or slowness (the exact off-topic content this replaces)',
        !mod.client_response.some(r => /virus|pop-up|slow/i.test(r.label)));
}

console.log('\n=== Regression: tech_problem_type itself is completely untouched -- computer_diagnostic and virus_or_malware_removal still work exactly as before ===');
{
    const mod = DB.intake_modules.tech_problem_type;
    check('tech_problem_type still has its original 3 options, unmodified', mod.client_response.length === 3);
    check('"Virus or pop-ups" is still there for the services that actually need it', mod.client_response.some(r => /virus/i.test(r.label)));

    const diag = DB.services.find(s => s.id === 'computer_diagnostic');
    // T193 (#137 S3): T174 (#201) gave Computer Diagnostic its own symptom-first chain (`computer_symptom` first); it no longer asks the shared `tech_problem_type`, which is what this block
    // protects for the services that still need it. Pinned as it is now, so a return of the shared module to the diagnostic's chain is seen.
    check('computer_diagnostic has its own symptom-first chain and does not use the shared tech_problem_type', diag.intake_chain.map(s => s.module).includes('computer_symptom') && !diag.intake_chain.map(s => s.module).includes('tech_problem_type'));

    const virus = DB.services.find(s => s.id === 'virus_or_malware_removal');
    check('virus_or_malware_removal still uses tech_problem_type', virus.intake_chain.map(s => s.module).includes('tech_problem_type'));
}

console.log(`\n[data backup question wording, #23] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
