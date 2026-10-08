#!/usr/bin/env node
/**
 * verify_description_matching_mechanism.js
 *
 * Regression test for the description-text weighted-signal mechanism:
 * after the primary keyword match resolves a winner, checks whether the
 * genuine LEFTOVER words in the customer's text (after removing every
 * real, matched synonym of the winning keyword, not just the bare
 * keyword string) match a SIBLING service's real description more
 * specifically than the default winner's own description.
 *
 * Built in direct response to a real architecture proposal recommending
 * a structural rewrite (Semantic Parser / Orchestrator separation,
 * universal verb_relevance flags, UI template reordering) -- after
 * verifying that proposal's central worked example was itself built on
 * a false premise (the dimmer service does NOT bypass its intake
 * question the way the proposal's diagram claimed), the decision was to
 * extend the EXISTING, already-verified signals (keyword/synonym
 * matching + description text) rather than introduce a new structural
 * layer, per direct instruction.
 *
 * 5 REAL BUGS found and fixed during construction, each via direct
 * testing, not assumed correct on first build:
 *   1. Wrong gating proxy (_ctxTags.length instead of a real, direct
 *      "did a contextual_override fire" flag) let the mechanism
 *      silently re-override an already-correct contextual_override
 *      result (hard_drive's real "back up" override).
 *   2. Naive word comparison didn't normalize plurals/word-forms
 *      ("wall" vs "walls"), causing real wrong overrides
 *      (brick_or_concrete_crack_repair -> wall_hole_or_crack_repair).
 *   3. (same root cause as #2, different case) door_sweep ->
 *      door_lock_or_handle_install.
 *   4. Stripping only the bare keyword (not every matched synonym) left
 *      "window" un-stripped from "window screen", spuriously matching
 *      an unrelated sibling (window_screen_repair -> window_draft_sealing).
 *   5. "set up" (the real, common two-word phrasing) was missing from
 *      the verb filter entirely -- nlp_service_verbs only had the
 *      unspaced "setup" -- causing a spurious match (smart_speaker_setup
 *      -> smart_plug_configuration).
 *
 * After all 5 fixes: a full systematic sweep across every one of the 21
 * real multi-service groups in the catalog (28 real plain-phrase test
 * cases) confirms ZERO spurious overrides.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

function analyze(text) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'descmatch_check_'));
    const payloadPath = path.join(tmpDir, 'payload.json');
    fs.writeFileSync(payloadPath, JSON.stringify({ mode: 'analyze', text }));
    const stdout = execFileSync('node', [path.join(REPO_ROOT, 'cms_bridge.js'), payloadPath, path.join(REPO_ROOT, 'btnyc.json'), path.join(REPO_ROOT, 'qr.html')], { encoding: 'utf8' });
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return JSON.parse(stdout);
}

console.log('=== The mechanism correctly fires for its intended, real target case ===');
{
    const result = analyze('swap the hallway dimmer for a smart version');
    check('"swap the hallway dimmer for a smart version" correctly overrides to smart_switch_install',
        result.intent.recommendedSku === 'smart_switch_install');
    check('the override flag is genuinely set', result.intent._descriptionOverride === true);
}

console.log('\n=== Bug 1 fix: a real contextual_override is never re-overridden by this mechanism ===');
{
    const result = analyze('back up my hard drive');
    check('"back up my hard drive" still correctly resolves to data_backup_or_transfer (the real contextual_override), not re-overridden',
        result.intent.recommendedSku === 'data_backup_or_transfer');
    check('the _hadContextualOverride flag correctly gated the mechanism off', result.intent._hadContextualOverride === true);
}

console.log('\n=== Bugs 2+3 fix: plural/word-form normalization in the leftover-word comparison ===');
{
    const result = analyze('I have a crack in my brick wall');
    check('"crack in my brick wall" correctly stays on brick_or_concrete_crack_repair, not wall_hole_or_crack_repair',
        result.intent.recommendedSku === 'brick_or_concrete_crack_repair');
}
{
    const result = analyze('door sweep is letting in draft');
    check('"door sweep is letting in draft" correctly resolves to door_weatherstripping, not door_lock_or_handle_install',
        result.intent.recommendedSku === 'door_weatherstripping');
}

console.log('\n=== Bug 4 fix: every matched synonym (not just the bare keyword) is stripped from leftover words ===');
{
    const result = analyze('my window screen is torn');
    check('"my window screen is torn" correctly resolves to window_screen_repair, not window_draft_sealing',
        result.intent.recommendedSku === 'window_screen_repair');
}

console.log('\n=== Bug 5 fix: multi-word verb phrases ("set up") are correctly filtered ===');
{
    const result = analyze('set up my smart speaker');
    check('"set up my smart speaker" correctly resolves to smart_speaker_setup, not smart_plug_configuration',
        result.intent.recommendedSku === 'smart_speaker_setup');
}

console.log('\n=== Complete, systematic sweep: zero spurious overrides across all 21 real multi-service groups ===');
const plainPhrases = [
    "my angle stop valve is leaking", "I need my baseboards fixed", "my bathroom fan is broken",
    "I need a new bidet installed", "my brick wall has a crack", "I need a new cabinet knob",
    "I need cable management for my tv", "I need a chandelier installed", "my computer is broken",
    "I need a dimmer installed", "I need a new door knob", "I need furniture assembled",
    "I need a gfci outlet", "I need a new light bulb", "my microwave is broken",
    "I need my router configured", "I need a shelf mounted", "my showerhead needs replacing",
    "I need a smart plug configured", "my washer is broken", "my window screen is torn",
    "I need a usb outlet", "I need a flatscreen tv mounted", "my toilet needs a wax ring",
    "my plaster wall is cracked", "my tub spout needs replacing", "I need my door weatherstripped",
    "set up my smart speaker",
];
let spuriousCount = 0;
for (const phrase of plainPhrases) {
    const result = analyze(phrase);
    if (result.intent._descriptionOverride) {
        spuriousCount++;
        console.log(`    SPURIOUS: "${phrase}" -> ${result.intent.recommendedSku}`);
    }
}
check(`zero spurious overrides across all ${plainPhrases.length} real, plain-phrase test cases (found ${spuriousCount})`, spuriousCount === 0);

console.log(`\n[Description-matching mechanism verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
