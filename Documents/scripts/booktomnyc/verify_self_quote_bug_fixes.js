#!/usr/bin/env node
/**
 * verify_self_quote_bug_fixes.js
 *
 * Regression test for two real, severe, previously-undiscovered production
 * bugs in the live sqBuildCuratedIntake function, found while building a
 * faithful test replication of its isSelfQuoting decision (the work was
 * motivated by closing a real gap: the Phase 5.5 broad sweep diffed pricing
 * fields but had NO comparison at all for which UI template each engine
 * would select for a given service).
 *
 * BUG 1 — wrong field name: chainIsQtyOnly checked `m.module` on RESOLVED
 * intake-chain objects (from _resolveIntakeChain), but those objects only
 * ever carry `.moduleKey` (often parameterized, e.g.
 * "item_count_template::items") — `.module` was undefined on every single
 * resolved module, for every service, always. This meant chainIsQtyOnly
 * could never evaluate true via its first two branches for ANY real
 * service.
 *
 * BUG 2 — exact-match against a value that's always parameterized: the
 * remaining fallback branch compared `chain[0].moduleKey ===
 * 'item_count_template'` exactly, but EVERY real use of item_count_template
 * carries a params.item_noun, producing a moduleKey like
 * "item_count_template::items" — never the bare key. This was the only
 * check meant to catch cabinet_knob_or_pull_install/led_bulb_upgrade
 * specifically, and could never succeed for either.
 *
 * Combined effect: the self-quote fast-path (skipping the chip-grid step
 * for genuinely simple, bypass_intake-flagged services) had likely never
 * actually activated in production, for any service, ever.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
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

console.log('=== Bug 1 fix: chainIsQtyOnly checks .moduleKey, not the non-existent .module field ===');
// Note: QTY_MODS.has(m.module) genuinely, correctly appears elsewhere in the
// file too (e.g. needsCuratedCardTemplate inside prefillSmartQuoteFromService,
// where `chain = svc.intake_chain` is the RAW, unresolved chain — .module IS
// the real, correct field there). The bug was specifically about checking
// m.module on RESOLVED chain objects (from _resolveIntakeChain) inside
// sqBuildCuratedIntake/legacyDetermineSelfQuoting — confirmed fixed by
// checking those two functions no longer contain the buggy pattern, not by
// asserting the pattern is absent from the whole file.
const sqBuildCuratedIntakeStart = QR_HTML.indexOf('function sqBuildCuratedIntake');
const sqBuildCuratedIntakeWindow = QR_HTML.slice(sqBuildCuratedIntakeStart, sqBuildCuratedIntakeStart + 6000);
check('sqBuildCuratedIntake no longer reads m.module (the always-undefined field on resolved chain objects)',
    !sqBuildCuratedIntakeWindow.includes('QTY_MODS.has(m.module)'));
check('sqBuildCuratedIntake reads m.moduleKey (the real, resolved field) instead',
    sqBuildCuratedIntakeWindow.includes('QTY_MODS.has(m.moduleKey)'));
const legacyDetermineSelfQuotingSrc = findFn('legacyDetermineSelfQuoting');
check('legacyDetermineSelfQuoting (the test replication) also reads m.moduleKey correctly',
    legacyDetermineSelfQuotingSrc && legacyDetermineSelfQuotingSrc.includes('QTY_MODS.has(m.moduleKey)'));

console.log('\n=== Bug 2 fix: the item_count_template fallback check uses startsWith, not exact equality ===');
// Note: the bug-description comments themselves correctly mention the OLD,
// buggy text verbatim (to document what was wrong) -- checking for the
// pattern as a real, executable expression specifically (preceded by `&&`,
// the real code shape), not just any textual occurrence anywhere in the file.
check('no real, executable code still uses exact equality against the always-parameterized key',
    !/&&\s*chain\[0\]\.moduleKey === 'item_count_template'/.test(QR_HTML));
const startsWithOccurrences = (QR_HTML.match(/chain\[0\]\.moduleKey\?\.startsWith\('item_count_template'\)/g) || []).length;
check('the real, parameterized-prefix check exists in exactly 2 places (sqBuildCuratedIntake + legacyDetermineSelfQuoting)',
    startsWithOccurrences === 2);

console.log('\n=== Confirmed root cause: item_count_template is ALWAYS parameterized in the real catalog ===');
const itemCountServices = DB.services.filter(s => (s.intake_chain || []).some(step => step.module === 'item_count_template'));
check('at least one real service uses item_count_template (sanity check)', itemCountServices.length > 0);
check('EVERY real usage carries params.item_noun (confirming the exact-match bug would have affected all of them)',
    itemCountServices.every(s => s.intake_chain.find(step => step.module === 'item_count_template')?.params?.item_noun));

console.log('\n=== End-to-end: legacyDetermineSelfQuoting (the verified-correct replication) produces the real, correct result ===');
const FNS = ['_resolveIntakeChain', '_isModVisible', 'legacyDetermineSelfQuoting'];
const code = FNS.map(findFn).join('\n\n');
const sandbox = { DB, SERVICE_DATA: DB, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'self_quote_bugfix' });

const EXPECTED = {
    cabinet_knob_or_pull_install: true,   // parameterized item_count_template, bypass_intake -- BUG 2's exact target
    door_lock_or_handle_install: true,    // unparameterized global_quantity -- BUG 1's exact target
    led_bulb_upgrade: true,               // parameterized item_count_template, bypass_intake -- BUG 2's exact target
    high_ceiling_bulb_replacement: false, // qty + a real height question -- must NOT self-quote (would drop a real question)
    shower_head_replacement: false,       // one real, non-quantity connection-type question
    tub_spout_replacement: false,         // one real, non-quantity connection-type question
    toilet_install: false,                // ordinary control, not bypass-flagged at all
};
for (const [sid, expected] of Object.entries(EXPECTED)) {
    const svc = DB.services.find(s => s.id === sid);
    const actual = sandbox.legacyDetermineSelfQuoting(svc);
    check(`${sid} -> isSelfQuoting: ${actual} (expected ${expected})`, actual === expected);
}

console.log('\n=== The broad sweep now diffs uiTemplate self-quote eligibility, not just price ===');
const sweepSrc = fs.readFileSync(path.join(__dirname, 'verify_shadow_mode_broad_sweep_phase5_5.js'), 'utf8');
check('the broad sweep calls legacyDetermineSelfQuoting and compares it against route.uiTemplate',
    sweepSrc.includes('legacyDetermineSelfQuoting') && sweepSrc.includes("orchIsSelfQuote = route.uiTemplate === 'self_quote'"));

console.log(`\n[Self-quote bug fix verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
