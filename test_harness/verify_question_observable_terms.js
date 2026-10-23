#!/usr/bin/env node
/**
 * verify_question_observable_terms.js -- a question asks about the job in things the customer can SEE or DO, its answers do not overlap, and none of them is just a measurement.
 *
 * Principle served (not enforced by definition; the Rule below is what this test enforces): P-INTAKE-QTEST
 * @enforces R-INTAKE-WIREREMOVE
 *
 * THE CLASS. The Charter names no defect class for it (a proposed name, `DEFECT-UNOBSERVABLE-QUESTION`, is in PENDING_DECISIONS #179 for you to name or not; this file protects the rule it breaks and carries no `@detects` until the Charter has the class).
 * The Charter's frequency clause (Part VI, "The Question Test"): "Material divergence is common but expressed in technical units -> translate the question into customer-observable terms."
 * Its own worked example of the opposite is the intake asking "do you need a 50-ft ladder?" -- the intake being asinine. A customer does not carry a tape measure. T170 (the operator, 2026-10-11 04:57 NY,
 * reading the catalog) found three authoring defects of one kind in one afternoon:
 *   - `length` ("About how long is the cable run or area?") offered "Less than 20 feet" / "20 to 50 feet" / "50 to 100 feet": a measurement and nothing else, asked of a customer who is looking at a
 *     kitchen, with two answers that both contain 50 and an upper band (100 feet of under-cabinet light, 100 feet of baseboard) that no real job reaches;
 *   - `mounting_height` offered "Standard reach (under 8 ft) / High (8-16 ft, ladder needed) / Very high (over 16 ft)": the third names no way of reaching it at all, and the other two lean on a number the
 *     customer would have to measure; the observable form is the ladder they would fetch (the Charter's own risk tiers are written in ladders: R1 "ladder under sixteen feet", R2 "heights over sixteen feet");
 *   - `distance` ("About how far does the wiring or cable need to run?") was asked of a refrigerator WATER line, in feet.
 * Each passed every earlier check, because each earlier check asks "does the answer MOVE the price" and these did (or, for `length`, was a frozen member of the inert list). None asked "can the customer
 * answer it by looking?". The class is the question that only a tape measure can answer.
 *
 * MEASURED BY WHAT THE RULE CLAIMS (P-GOVERN-GOODHART): not a list of module names. Over EVERY module in `intake_modules`:
 *   1. NO TWO ANSWERS SHARE A VALUE   Parse each answer's numbers ("20 to 50 feet", "under 8 ft", "over 16 ft", "More than 1 item") into an interval; no two answers of one question may intersect.
 *                                     ("20 to 50" and "50 to 100" both hold a 50-foot run.)
 *   2. NO ANSWER IS ONLY A MEASUREMENT  An answer that names a length (feet, inches) must still say something with the number taken out: a thing, a place, a way of reaching it. "Less than 20 feet" is
 *                                     nothing once "less than" and "20 feet" are removed; "Yes - a little (under 1 inch)" is "Yes a little".
 *   3. A HEIGHT IS A REACH            Every question that sets a ceiling-height tag (`#high_ceiling`, `#very_high_ceiling`) carries no digit, and names the way the customer would reach the spot (the floor,
 *                                     a step stool, a stepladder, an extension ladder or scaffold): in EACH answer when the question grades height in three or more steps, in at least one (the baseline
 *                                     the others are "not") when it is a yes/no. The customer's answer to a height question is the ladder they would fetch.
 *   4. THE TAG KEEPS ITS ANSWER      Where a ceiling-height tag pre-answers a height question (`smart_tags[tag].answers[module]`), that answer is one of the module's current labels (a relabel that
 *                                     forgets the tag's pre-answer leaves the free-text route asking the question it just answered). Whether the two binary tile/ceiling questions SHOULD be pre-answered is
 *                                     a separate matter, filed in PENDING_DECISIONS (T170), not asserted here.
 * Non-vacuity: the parser reads the intervals the catalog really has (weight, distance bands, a "1 item / More than 1 item" pair), and each leg is shown red on a planted module (the old `length`,
 * the old `mounting_height`, a feet-only band) and green on a good one.
 *
 * RUN ON ANOTHER TREE (G-INVARIANT-PREFIX): copy this file into that tree's test_harness/ and run it there -- it reads that tree's btnyc.json.
 */
'use strict';
const fs = require('fs'), path = require('path');
const { check, finish } = require('./_shared.js');
const DB = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'btnyc.json'), 'utf8'));
const MODS = DB.intake_modules, TAGS = DB.smart_tags;
const refOf = r => (r && typeof r === 'object' && r.$ref) ? r.$ref : r;
const tagOf = t => String(refOf(t)).replace(/^#?/, '#');

// ---- the pure legs ------------------------------------------------------------------------------------------------------------------------------------------------------
const UNIT = '(ft|feet|foot|inch|inches|in|lbs?|pounds|minutes?|mins?|hours?|hrs?|items?|units?)';
const NUM = '(\\d+(?:\\.\\d+)?)';
/** One answer label -> {unit, lo, hi, loOpen, hiOpen} or null. A fraction ("1/3 HP") or a label with no number-and-unit is not a range. */
function parseRange(label) {
    const s = String(label).toLowerCase().replace(/[–—]/g, '-').replace(/″|"/g, ' inch ');
    let m;
    if ((m = s.match(new RegExp(`(?:less than|under|fewer than|below)\\s+${NUM}\\s*${UNIT}\\b`)))) return { unit: norm(m[2]), lo: 0, hi: +m[1], loOpen: false, hiOpen: true };
    if ((m = s.match(new RegExp(`(?:more than|over|above|greater than)\\s+${NUM}\\s*${UNIT}\\b`)))) return { unit: norm(m[2]), lo: +m[1], hi: Infinity, loOpen: true, hiOpen: true };
    if ((m = s.match(new RegExp(`${NUM}\\s*(?:\\+|or more)\\s*${UNIT}?`))) && m[2]) return { unit: norm(m[2]), lo: +m[1], hi: Infinity, loOpen: false, hiOpen: true };
    if ((m = s.match(new RegExp(`up to\\s+${NUM}\\s*${UNIT}\\b`)))) return { unit: norm(m[2]), lo: 0, hi: +m[1], loOpen: false, hiOpen: false };
    if ((m = s.match(new RegExp(`(?<![\\d/])${NUM}\\s*(?:to|-)\\s*${NUM}\\s*${UNIT}\\b`)))) return { unit: norm(m[3]), lo: +m[1], hi: +m[2], loOpen: false, hiOpen: false };
    if ((m = s.match(new RegExp(`(?<![\\d/.])${NUM}\\s*${UNIT}\\b(?!\\s*/)`)))) return { unit: norm(m[2]), lo: +m[1], hi: +m[1], loOpen: false, hiOpen: false };
    return null;
}
function norm(u) { return ({ ft: 'ft', feet: 'ft', foot: 'ft', in: 'in', inch: 'in', inches: 'in', lb: 'lb', lbs: 'lb', pounds: 'lb', min: 'min', mins: 'min', minute: 'min', minutes: 'min', hr: 'hr', hrs: 'hr', hour: 'hr', hours: 'hr', item: 'item', items: 'item', unit: 'unit', units: 'unit' })[u] || u; }
function intersects(a, b) {
    const lo = Math.max(a.lo, b.lo), hi = Math.min(a.hi, b.hi);
    if (lo > hi) return false;
    if (lo < hi) return true;
    // a single shared point: it is shared only if neither side leaves that endpoint out
    const open = (r, v, isHi) => isHi ? (r.hi === v && r.hiOpen) : (r.lo === v && r.loOpen);
    return !(open(a, lo, true) || open(b, lo, true) || open(a, lo, false) || open(b, lo, false)) && Number.isFinite(lo);
}
/** [labels] -> the pairs of answers that hold a value in common (same unit only). */
function overlaps(labels) {
    const rs = labels.map(l => ({ l, r: parseRange(l) })).filter(x => x.r), out = [];
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) if (rs[i].r.unit === rs[j].r.unit && intersects(rs[i].r, rs[j].r)) out.push([rs[i].l, rs[j].l]);
    return out;
}
const LENGTH_WORDS = /\b(\d+(?:\.\d+)?\s*(?:-|to)\s*)?\d+(?:\.\d+)?\s*(ft|feet|foot|inch|inches|in|"|″)(?![a-z])/i;
const FILLER = new Set(['less', 'than', 'more', 'over', 'under', 'about', 'around', 'up', 'to', 'or', 'the', 'a', 'an', 'of', 'and', 'yes', 'no', 'is', 'are', 'it', 'its', 'only', 'at', 'least', 'most', 'approximately', 'roughly', 'feet', 'foot', 'ft', 'inch', 'inches']);
/** Answers that name a length and have nothing left to say once the measurement is taken out. */
function bareMeasurements(labels) {
    return labels.filter(l => LENGTH_WORDS.test(l)).filter(l => {
        const rest = String(l).toLowerCase().replace(/[–—]/g, '-').replace(/\d+(?:\.\d+)?\s*(?:-|to)?\s*\d*(?:\.\d+)?\s*(?:ft|feet|foot|inch|inches|in|"|″)?/g, ' ').replace(/[^a-z\s']/g, ' ');
        return rest.split(/\s+/).filter(w => w && !FILLER.has(w)).length < 1;
    });
}
const REACH = /\b(ladder|stepladder|step ?stool|stool|scaffold|scaffolding|floor|reach(?:able)?|chair)\b/i;
const HEIGHT_TAGS = ['#high_ceiling', '#very_high_ceiling'];
/** A module that sets a ceiling-height tag: no digit anywhere; every answer names the reach when graded in 3+ steps, at least one when it is a yes/no. */
function heightProblems(mod) {
    const labels = (mod.client_response || []).map(o => o.label);
    const digits = labels.filter(l => /\d/.test(l));
    const unnamed = labels.length >= 3 ? labels.filter(l => !REACH.test(l)) : (labels.some(l => REACH.test(l)) ? [] : labels);
    return [...new Set([...digits, ...unnamed])];
}
const setsHeightTag = mod => (mod.client_response || []).some(o => (o.tags || []).map(tagOf).some(t => HEIGHT_TAGS.includes(t)));

// ---- on the catalog -------------------------------------------------------------------------------------------------------------------------------------------------------
const names = Object.keys(MODS);
const labelsOf = k => (MODS[k].client_response || []).map(o => o.label);

const parsedPairs = names.map(k => [k, labelsOf(k).map(parseRange).filter(Boolean)]).filter(([, rs]) => rs.length >= 2);
check(`non-vacuity: the parser reads real bands (${parsedPairs.length} questions have two or more numeric answers, e.g. ${parsedPairs.slice(0, 4).map(([k]) => k).join(', ')})`,
    parsedPairs.length >= 3 && parsedPairs.some(([k]) => k === 'weight'));   // 7 before T170 (length and distance were two of them); the planted cases below carry the rest of the proof

const overlapBad = names.flatMap(k => overlaps(labelsOf(k)).map(([a, b]) => `${k}: "${a}" and "${b}"`));
check('1. no two answers of one question hold a value in common', overlapBad.length === 0, { expected: 'none', got: overlapBad });

const bareBad = names.flatMap(k => bareMeasurements(labelsOf(k)).map(l => `${k}: "${l}"`));
check('2. no answer is only a measurement: what is left when the number and unit are taken out still says something the customer can see', bareBad.length === 0, { expected: 'none', got: bareBad });

const heightMods = names.filter(k => setsHeightTag(MODS[k]));
check(`non-vacuity: the catalog has a question that sets a ceiling-height tag (${heightMods.join(', ') || 'none'})`, heightMods.length >= 1);
const heightBad = heightMods.flatMap(k => heightProblems(MODS[k]).map(l => `${k}: "${l}"`));
check('3. every answer to a height question names how the customer would reach it (floor, stool, stepladder, extension ladder) and carries no number', heightBad.length === 0, { expected: 'none', got: heightBad });

const tagBad = [];
for (const k of heightMods) for (const t of HEIGHT_TAGS) {
    const a = (TAGS[t] && TAGS[t].answers) || {};
    if (a[k] !== undefined && !labelsOf(k).includes(a[k])) tagBad.push(`${t}.answers.${k} = "${a[k]}" is not an answer of ${k}`);
}
check('4. each ceiling-height tag pre-answers the height question with one of that question\'s current answers', tagBad.length === 0, { expected: 'none', got: tagBad });

// ---- non-vacuity: each leg is red on the thing it exists to catch, green on a good one --------------------------------------------------------------------------------
const OLD_LENGTH = ['Less than 20 feet', '20 to 50 feet', '50 to 100 feet'];
check('non-vacuity (1): the old `length` answers are flagged ("20 to 50 feet" and "50 to 100 feet" both hold 50)', overlaps(OLD_LENGTH).length === 1 && overlaps(OLD_LENGTH)[0][0] === '20 to 50 feet');
check('non-vacuity (1): disjoint bands are not flagged (the old `distance`, `weight`, `mounting_height`, and a "1 item / More than 1 item" pair)',
    overlaps(['Less than 10 feet', '10 to 25 feet', 'More than 25 feet']).length === 0
    && overlaps(['Less than 20 lbs (light)', '20 to 50 lbs (moderate)', 'Over 50 lbs (heavy)']).length === 0
    && overlaps(['Standard reach (under 8 ft)', 'High (8-16 ft, ladder needed)', 'Very high (over 16 ft)']).length === 0
    && overlaps(['1 item', 'More than 1 item']).length === 0 && overlaps(['1/3 HP and smaller', '3/4 HP or 1 HP']).length === 0);
check('non-vacuity (1): a repeated exact value is flagged', overlaps(['5 ft', '5 ft']).length === 1 && overlaps(['0 to 5 feet', 'Exactly 5 feet']).length === 1);
check('non-vacuity (2): a feet-only label is flagged and a described one is not', bareMeasurements(OLD_LENGTH).length === 3
    && bareMeasurements(['Yes - a little (under 1 inch)', 'High (8-16 ft, ladder needed)', 'One average room', 'Standard reach (under 8 ft)']).length === 0);
check('non-vacuity (3): the old `mounting_height` is flagged (its third answer names no way to reach, all carry a number), the ladder form is not',
    heightProblems({ client_response: [{ label: 'Standard reach (under 8 ft)' }, { label: 'High (8-16 ft, ladder needed)' }, { label: 'Very high (over 16 ft)' }] }).length === 3
    && heightProblems({ client_response: [{ label: 'Within reach from the floor or a step stool' }, { label: 'Needs a stepladder' }, { label: 'Needs an extension ladder or scaffold' }] }).length === 0
    && heightProblems({ client_response: [{ label: 'No, standard reach' }, { label: 'High ceiling' }] }).length === 0
    && heightProblems({ client_response: [{ label: 'No' }, { label: 'Yes, 12 ft' }] }).length === 2);
finish('questions asked in terms a customer can observe');
