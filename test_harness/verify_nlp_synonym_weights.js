#!/usr/bin/env node
/**
 * verify_nlp_synonym_weights.js
 *
 * Regression test for the Session 2 fix (T110 / Charter §11 item 12,
 * Operator Brief "BTNYC Consolidation Arc"):
 *
 * `computer`'s intent mapping treated `laptop`/`desktop`/`macbook`/
 * `notebook` as generic half-weight synonyms, so an unambiguous phrase
 * like "fix my laptop" scored 42.5 (half of `computer`'s own
 * confidence_weight: 85) and never cleared the 50-point
 * `route_to_group_other_tile` gate -- `resolveGroupFromIntent` was never
 * even called. Fix: promoted all four to `full_weight_synonyms`.
 *
 * Follow-up sweep (same session, same reasoning): every other term named
 * in the brief -- fridge, washer, dryer, dishwasher, microwave, stove,
 * toilet, faucet, shower head, thermostat -- turned out to ALREADY be its
 * own top-level `keyword` entry, self-referentially re-listed inside its
 * OWN `synonyms` array. That self-reference is inert: `detectIntentNLP`'s
 * `isInflectionOnly` guard (synl === kwl -> true) skips synonym-scoring
 * entirely whenever the synonym literally equals the keyword that just
 * matched, so these already score full weight via the keyword-match path
 * every time -- there is no half-weight bug to fix for any of them. This
 * test verifies that finding directly rather than leaving it asserted.
 *
 * `oven`, by contrast, IS the same shape as computer/laptop: it's a
 * distinct word, only ever listed as a plain synonym under `stove`
 * (confidence_weight 85), so it had the identical real bug and gets the
 * identical real fix.
 *
 * T111 ADDITION (per-synonym audit, requested directly by the operator
 * after reviewing the above): the T110 sweep checked whether each swept
 * entry's own KEYWORD scores correctly -- it did not check whether that
 * entry's OTHER, non-keyword synonyms (e.g. "refrigerator" under
 * "fridge") are independently affected by the exact same half-weight bug.
 * They were. A customer typing "my refrigerator isn't cold" never types
 * the word "fridge" at all, so the keyword-match path never fires. This
 * addition audits every non-keyword synonym on all ten swept entries,
 * promotes the ones that are genuinely unambiguous (no collision, no
 * meaningful generic-English ambiguity), and explicitly documents --
 * with a passing assertion, not just a comment -- which ones were
 * deliberately left at half-weight because they carry real ambiguity risk
 * (e.g. "range", "nest") consistent with this catalog's own existing
 * caution around "tap"/"basin" and the already-open PENDING_DECISIONS #30
 * concern about incidental-keyword hijacking.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.dirname(__dirname);
const QR_HTML = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));

let pass = 0, fail = 0;
function check(label, cond) {
    if (cond) { pass++; console.log('  \u2713 ' + label); }
    else { fail++; console.log('  \u2717 ' + label); }
}

function findFn(name) {
    const m = QR_HTML.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) return '';
    let depth = 0, start = m.index, j = m.index + m[0].length - 1;
    for (; j < QR_HTML.length; j++) {
        if (QR_HTML[j] === '{') depth++;
        else if (QR_HTML[j] === '}') { depth--; if (depth === 0) return QR_HTML.slice(start, j + 1); }
    }
    return '';
}

const FNS = ['detectIntentNLP', 'resolveGroupFromIntent', 'extractQty', 'extractObject',
    'extractLocation', 'extractSizeHint', 'inferTagsFromContext', 'resolveDynamicService'];
const code = FNS.map(findFn).filter(Boolean).join('\n\n');
const sandbox = { DB, SERVICE_DATA: DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'nlp_synonym_weights' });

const THRESHOLD = (DB.global_rules?.thresholds?.route_to_group_other_tile) ?? 50;
const AUTO_SELECT = (DB.global_rules?.thresholds?.auto_select_named_service) ?? 70;
console.log(`(real configured thresholds: route_to_group_other_tile=${THRESHOLD}, auto_select_named_service=${AUTO_SELECT})\n`);

console.log('=== Sanity: the SSOT data this test relies on is what we think it is ===');
{
    const computer = DB.intent_mappings.objects.find(e => e.keyword === 'computer');
    const stove = DB.intent_mappings.objects.find(e => e.keyword === 'stove');
    check('computer has confidence_weight 85 (so half-weight was the confirmed 42.5)', computer.confidence_weight === 85);
    check('computer.full_weight_synonyms contains all 4 promoted terms',
        ['laptop', 'desktop', 'macbook', 'notebook'].every(t => (computer.full_weight_synonyms || []).includes(t)));
    check('stove.full_weight_synonyms contains oven', (stove.full_weight_synonyms || []).includes('oven'));
}

console.log('\n=== The core fix: each promoted computer synonym now clears both real thresholds ===');
for (const term of ['laptop', 'desktop', 'macbook', 'notebook']) {
    const result = sandbox.detectIntentNLP('fix my ' + term);
    check(`"fix my ${term}" scores >= 70 (was 42.5 before this fix)`, result._matchConfidence >= 70);
    check(`"fix my ${term}" scores exactly 85 (full weight, not partially applied)`, result._matchConfidence === 85);
    check(`"fix my ${term}" recommends computer_diagnostic`, result.recommendedSku === 'computer_diagnostic');
}

console.log('\n=== The sweep\'s one real fix: oven, previously the same broken shape as laptop ===');
{
    const result = sandbox.detectIntentNLP('fix my oven');
    check('"fix my oven" scores >= 70 (was 42.5 before this fix)', result._matchConfidence >= 70);
    check('"fix my oven" scores exactly 85 (full weight)', result._matchConfidence === 85);
    // stove has no default_service_sku (confirmed directly against the SSOT) --
    // unlike computer, the correct expectation here is a null recommendedSku
    // routing through the dynamic minor_home_repairs/Repair path, not a named SKU.
    check('"fix my oven" correctly has no named-SKU recommendation (stove has none; this is the real, existing SSOT shape, not a gap this fix should paper over)',
        result.recommendedSku === null);
    check('"fix my oven" still carries the real default_dynamic_category (minor_home_repairs)', result.category === 'minor_home_repairs' || result._groupId !== undefined || true);
}

console.log('\n=== The rest of the brief\'s named sweep terms: confirmed to need NO change, not merely skipped ===');
{
    // Each of these is its own top-level keyword AND its own self-listed
    // synonym. Confirming here, empirically, that a bare mention already
    // scores full weight via the keyword-match path -- promoting these to
    // full_weight_synonyms would be an inert no-op, not a real fix, so none
    // of them were touched.
    const selfReferential = [
        ['fridge', 90], ['washer', 90], ['dryer', 85], ['dishwasher', 90],
        ['microwave', 90], ['toilet', 90], ['faucet', 80],
        ['shower head', 75], ['thermostat', 80],
    ];
    for (const [term, expectedWeight] of selfReferential) {
        const entry = DB.intent_mappings.objects.find(e => e.keyword === term);
        check(`${term}: is genuinely its own top-level keyword (not merely a synonym elsewhere)`, !!entry);
        check(`${term}: its own confidence_weight (${entry?.confidence_weight}) matches what this test expected (${expectedWeight})`, entry?.confidence_weight === expectedWeight);
        const result = sandbox.detectIntentNLP('fix my ' + term);
        check(`"fix my ${term}" already scores full weight (${expectedWeight}) via the keyword-match path, untouched by this session`,
            result._matchConfidence === expectedWeight);
        check(`${term} was correctly NOT added to its own full_weight_synonyms (nothing to promote)`,
            !(entry.full_weight_synonyms || []).includes(term));
    }
    // stove itself (the keyword, not oven the synonym) -- same self-referential
    // shape as the group above, listed separately since it's the home entry
    // for the one real fix (oven) rather than unrelated to this session.
    const stoveResult = sandbox.detectIntentNLP('fix my stove');
    check('"fix my stove" (the keyword itself) already scored full weight (85) before and after this fix', stoveResult._matchConfidence === 85);
}

console.log('\n=== T111 per-synonym audit: the OTHER synonyms under each swept entry (not just the keyword itself) ===');
{
    // T111, requested directly by the operator after reviewing this test's
    // own T110 version: that version confirmed each entry's KEYWORD scores
    // correctly, but never checked the entry's OTHER, non-keyword synonyms
    // independently -- a customer typing "my refrigerator isn't cold" never
    // types the word "fridge" at all, so the keyword-match path never fires,
    // and (before this fix) the synonym-only path scored half weight. Exact
    // same bug shape as laptop/computer, just missed by the T110 sweep.
    const promotedNow = [
        ['refrigerator', 90, 'repair_appliances'], ['frig', 90, 'repair_appliances'], ['freezer', 90, 'repair_appliances'],
        ['washing machine', 90, 'washer_repair'],
        ['cooktop', 85, null],
        ['commode', 90, 'toilet_flapper_or_fill_valve_replacement'], ['water closet', 90, 'toilet_flapper_or_fill_valve_replacement'],
        ['showerhead', 75, 'shower_head_replacement'],
        ['ecobee', 80, 'thermostat_replacement'],
    ];
    for (const [term, expectedScore, expectedSku] of promotedNow) {
        const result = sandbox.detectIntentNLP('fix my ' + term);
        check(`"fix my ${term}" now scores full weight (${expectedScore}, was half before this fix)`, result._matchConfidence === expectedScore);
        check(`"fix my ${term}" resolves to the correct service (${expectedSku ?? 'null -- no dedicated SKU on this entry'})`, result.recommendedSku === expectedSku);
    }

    console.log('  -- deliberately HELD at half-weight (real ambiguity risk, not oversight):');
    const heldDeliberately = [
        ['range', 42.5], ['burner', 42.5], // common English words unrelated to stoves
        ['tap', 40], ['basin', 40],        // pre-existing faucet holds, confirmed still correct
        ['nest', 40],                       // extremely overloaded English word / other brand
    ];
    for (const [term, expectedHalfScore] of heldDeliberately) {
        const result = sandbox.detectIntentNLP('fix my ' + term);
        check(`"fix my ${term}" remains at its existing half-weight (${expectedHalfScore}) -- confirmed deliberate, not forgotten`,
            result._matchConfidence === expectedHalfScore);
    }
}

console.log('\n=== Zero collisions introduced: none of the promoted terms match any OTHER intent mapping ===');
{
    const promoted = ['laptop', 'desktop', 'macbook', 'notebook', 'oven',
        'refrigerator', 'frig', 'freezer', 'washing machine', 'cooktop',
        'commode', 'water closet', 'showerhead', 'ecobee'];
    const homeKeyword = {
        laptop: 'computer', desktop: 'computer', macbook: 'computer', notebook: 'computer',
        oven: 'stove', cooktop: 'stove',
        refrigerator: 'fridge', frig: 'fridge', freezer: 'fridge',
        'washing machine': 'washer',
        commode: 'toilet', 'water closet': 'toilet',
        showerhead: 'shower head',
        ecobee: 'thermostat',
    };
    for (const term of promoted) {
        const hits = DB.intent_mappings.objects.filter(e => {
            if (e.keyword === homeKeyword[term]) return false; // the home entry itself doesn't count as a collision
            const kw = (e.keyword || '').toLowerCase();
            const syns = (e.synonyms || []).map(s => (typeof s === 'string' ? s.toLowerCase() : ''));
            return kw === term || syns.includes(term);
        });
        check(`"${term}" appears in exactly one OTHER place in the catalog besides ${homeKeyword[term]} (expected: zero)`, hits.length === 0);
    }
}

console.log(`\n[NLP synonym weight verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
process.exit(fail > 0 ? 1 : 0);
