#!/usr/bin/env node
/**
 * verify_incidental_numbers_not_quantity.js -- T198 (H1): a number that is not a count of things is not a job quantity.
 *
 * Before: extractQty read ANY number in the sentence as the quantity, clamped to 99: "install ceiling fan serial 123456" priced 99 fans ($6,435), "install shelf 36 x 12" 36 shelves ($13,380),
 * "repair 4500" $18,150, "install a 20 amp outlet" 20 outlets, "hang picture frame 14 x 18" 14 frames, "fix door 5" 5 doors. After: the words that mark a number as a model, serial, room,
 * date, time, price, size or age mask it (maskIncidentalNumbers, the one definition, shared with extractStatedCounts), and a number that cannot be placed is quantity 1, which the dynamic
 * services then ask about (global_quantity) -- the existing clarification, no invented count.
 *   1. INCIDENTAL   each kind of incidental number, typed through the real workflow: quantity 1, units 1, and the quote of the same words without the number.
 *   2. EVERY SERVICE  every service name x every incidental suffix (2,356 phrases): extractQty is 1.
 *   3. LEGITIMATE   explicit quantities still count: "replace 12 bulbs", "install 3 shelves", "replace four doors", "install two shelves", "tighten 6 loose chairs", "2 hours of furniture repair"; the quote
 *                   scales for services that price per unit and does not for services that price their own count question (units 1: no double count).
 *   4. NOT PLACED   a bare number with nothing after it ("wall mounting for any item 12") and a count past 99 ("replace 150 outlets") default to 1; the dynamic service asks how many.
 *   5. #249         "replace 3 light bulbs" still answers "2-3 bulbs"; "replace light bulb model 4500" answers nothing and prices one unit; extractStatedCounts reads the same masked text.
 *   6. NON-VACUITY  plant the original reader (dimension words only): the incidental numbers become quantities again; plant the designator rule away: "model 52" does.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..');
const { check, finish } = require('./_shared.js');
const { engine } = require('./_engine.js');
const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
function load(patch) {
    const sb = { DB, SERVICE_DATA: DB, window: { DB }, console: { log() {}, warn() {}, error() {}, info() {}, debug() {} } };
    sb.global = sb; vm.createContext(sb);
    let wrapper = engine().wrapper; if (patch) { const w2 = patch(wrapper); if (w2 === wrapper) throw new Error('the planted change did not apply'); wrapper = w2; }
    vm.runInContext(wrapper, sb);
    if (typeof sb.initNlpSets === 'function') { sb.initNlpSets(); if (typeof sb.refreshNlpPreviewBindings === 'function') sb.refreshNlpPreviewBindings(); }
    return sb;
}
const typed = (sb, t, forceQty) => {
    const c = sb.collectBookingContext_freeText(t); if (forceQty !== undefined) c.extractedQty = forceQty;
    const r = sb.executeWorkflow(Object.assign({}, c, { tagsAffirmed: true }), sb.DB), q = r.quote || {};
    return { id: (r.entity && r.entity.id) || r.entityType, qty: c.extractedQty, units: r.quantity && r.quantity.units, labor: q.laborEstimate, mins: q.totalMin,
        open: (r.visibleChain || []).filter(m => !(r.answers || {})[m.moduleKey]).map(m => m.moduleKey), ans: r.answers || {} };
};
const E = load();

// 1. incidental numbers, end to end ---------------------------------------------------------------------------------------------------------------------------------------------------
const incidental = [
    ['replace light bulb model 4500', 'replace light bulb'], ['install ceiling fan model 52', 'install ceiling fan'], ['install ceiling fan serial 123456', 'install ceiling fan'],
    ['install ceiling fan KD-4500', 'install ceiling fan'], ['install ceiling fan rtx3080', 'install ceiling fan'], ['mount tv in 2024 apartment', 'mount tv in apartment'], ['mount a tv for 2024', 'mount a tv'],
    ['mount tv on 2nd floor wall', 'mount tv on floor wall'], ['install shelf 36 x 12', 'install shelf'], ['install shelf 36x12 inches', 'install shelf'], ['install shelf 3/4 inch thick', 'install shelf thick'],
    ['install a 20 amp outlet', 'install a outlet'], ['hang picture frame 14 x 18', 'hang picture frame'], ['fix leaky faucet by 11/12', 'fix leaky faucet by'], ['fix leaky faucet at 3 pm', 'fix leaky faucet at'],
    ['fix leaky faucet at 3:30', 'fix leaky faucet at'], ['fix leaky faucet it is 10 years old', 'fix leaky faucet it is old'], ['fix leaky faucet 10001', 'fix leaky faucet'], ['repair 4500', 'repair'],
    ['assemble ikea pax wardrobe model 100', 'assemble ikea pax wardrobe'], ['fix the door in apartment 4B', 'fix the door in apartment'], ['replace bulb in room 4', 'replace bulb in room'],
    ['mount a 55" tv on brick wall', 'mount a tv on brick wall'], ['mount tv 12 feet up', 'mount tv up']];
for (const [p] of incidental) {
    const x = typed(E, p), y = typed(E, p, 1);   // the same words, the same service, priced as one unit
    check(`1 "${p}": quantity 1, one unit, the one-unit quote (${x.labor}/${x.mins})`, x.qty === 1 && x.units === 1 && x.id === y.id && x.labor === y.labor && x.mins === y.mins, { x, y });
}
check('1.1 the reported cases: no 99-fan, 36-shelf or 4,500-job quote any more', ['install ceiling fan serial 123456', 'install shelf 36 x 12', 'repair 4500', 'install a 20 amp outlet', 'hang picture frame 14 x 18', 'fix door 5'].every(p => { const x = typed(E, p); return x.units === 1 && x.labor < 1000; }));

// 2. every service name x every incidental suffix -------------------------------------------------------------------------------------------------------------------------------------
{
    const suffixes = ['model 4500', 'serial 123456', 'part 52', 'sku 7781', 'room 4', 'apartment 4B', 'unit 12', '2nd floor', 'on 3rd floor', 'in 2024', 'march 15', 'by 11/12', 'at 3 pm', 'at 3:30', '10 years old', 'under $100', 'zip 10001',
        'call 555-1234', '24 x 36', '36x12 inches', '3/4 inch', '20 amp', '60 watt', '55 inch', '55"', '12 feet up', 'KD-4500', 'rtx3080', '4500', '100', '12v'];
    const names = DB.services.map(s => s.ui_taxonomy.display_name.toLowerCase()); let n = 0; const bad = [];
    for (const nm of names) for (const s of suffixes) { n++; const q = E.extractQty(nm + ' ' + s); if (q !== 1) bad.push([nm + ' ' + s, q]); }
    check(`2 every service name x every incidental suffix (${n}): extractQty is 1`, bad.length === 0, bad.slice(0, 4));
    check('2.1 no service name\'s own words read as a quantity', names.every(nm => E.extractQty(nm) === 1));
}

// 3. legitimate quantities ------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
    const one = typed(E, 'install a shelf'), three = typed(E, 'install 3 shelves'), two = typed(E, 'install two shelves');
    check('3 "install 3 shelves": 3 units, and the quote scales with them (a per-unit service)', three.qty === 3 && three.units === 3 && three.labor > one.labor, { one, three });
    check('3.1 "install two shelves": 2 units (a number word), priced per unit like the 3 (2 x 70 = 140, 3 x 70 = 210)', two.qty === 2 && two.units === 2 && two.labor * 3 === three.labor * 2, { two, three });
    check('3.2 "paint 2 walls", "hang 5 pictures", "tighten 6 loose chairs": counted', typed(E, 'paint 2 walls').qty === 2 && typed(E, 'hang 5 pictures').qty === 5 && typed(E, 'tighten 6 loose chairs').qty === 6);
    check('3.3 "replace 2 doors and 4 windows": the first stated count, as before', typed(E, 'replace 2 doors and 4 windows').qty === 2);
    const h1 = typed(E, 'furniture repair 2 hours');
    check('3.4 hours are a quantity the hourly service prices: "furniture repair 2 hours" / "2 hours of furniture repair" -> 2', h1.id === 'furniture_repair_hourly' && h1.qty === 2 && typed(E, 'I need help with 2 hours of furniture repair').qty === 2, h1);
    for (const [p, q, label] of [['replace 12 bulbs', 12, null], ['replace four doors', 4, null], ['fix 4 cabinet doors', 4, '4-8 items'], ['install 3 3-way switches', 3, null], ['mount 2 tvs', 2, null]]) {
        const x = typed(E, p);
        check(`3.5 "${p}": quantity ${q}; a service that asks its own count question prices one unit (${x.units}), no double count`, x.qty === q && (x.id === 'dynamic' ? x.units === q : x.units === 1) && (!label || Object.values(x.ans).includes(label)), x);
    }
    const plain = typed(E, 'replace 3 light bulbs'), lone = typed(E, 'replace light bulb');
    check('3.6 a service that prices its own count question: "replace 3 light bulbs" quotes what "replace light bulb" quotes (no double count)', plain.units === 1 && plain.labor === lone.labor && plain.mins === lone.mins, { plain, lone });
}

// 4. a number that cannot be placed ----------------------------------------------------------------------------------------------------------------------------------------------------------
{
    for (const p of ['wall mounting for any item 12', 'flat-pack furniture assembly 3', 'fix door 5']) { const x = typed(E, p); check(`4 "${p}": a bare number with nothing after it is not a quantity -> 1`, x.qty === 1 && x.units === 1, x); }
    const x = typed(E, 'replace 150 outlets');
    check('4.1 "replace 150 outlets": not clamped to 99 (no 99-outlet quote); one unit, and the dynamic service asks how many (global_quantity)', x.qty === 1 && x.units === 1 && x.open.includes('global_quantity'), x);
    check('4.2 "replace 100 bulbs": not clamped to 99; the bulb service still asks its count question', (() => { const y = typed(E, 'replace 100 bulbs'); return y.qty === 1 && y.open.includes('item_count_template::light bulbs'); })());
    check('4.3 a number with a thing after it still counts: "3 light bulbs", "5 of them"', E.extractQty('3 light bulbs') === 3 && E.extractQty('fix these, 5 of them') === 5);
}

// 5. #249 -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
{
    const KEY = 'item_count_template::light bulbs';
    check('5 "replace 3 light bulbs" still answers "2-3 bulbs" (#249)', typed(E, 'replace 3 light bulbs').ans[KEY] === '2-3 bulbs');
    const m = typed(E, 'replace light bulb model 4500');
    check('5.1 "replace light bulb model 4500": answers no count question and prices one unit (was 99 units, $6,435)', m.units === 1 && !Object.keys(m.ans).some(k => /item_count/.test(k)) && m.labor < 1000, m);
    check('5.2 extractStatedCounts reads the same masked text: the incidental numbers are not counts', ['replace light bulb model 4500', 'replace 3 light bulbs 12 feet up model 52 zip 10001 at 3 pm'].map(t => JSON.stringify(E.extractStatedCounts(t).map(c => c.value))).join('|') === '[]|[3]');
}

// 6. non-vacuity: the original reader brings the defect back -----------------------------------------------------------------------------------------------------------------------------------
{
    // the original reader: dimension words masked only, and any bare number counts (no "followed by a word" rule)
    const P = load(w => w.replace('function maskIncidentalNumbers(text) {', 'function maskIncidentalNumbers(text) { return String(text || \'\').replace(_DIMENSION_PATTERN, \' \'); /*planted: dimension words only*/').replace('const m = t.match(/\\b(\\d+)\\b(?=\\s+[a-z])/);', 'const m = t.match(/\\b(\\d+)\\b/);'));
    const back = ['install ceiling fan serial 123456', 'install shelf 36 x 12', 'repair 4500', 'install a 20 amp outlet', 'fix leaky faucet by 11/12'].map(p => typed(P, p));
    check('6 planted (dimension words only, the original): the incidental numbers are quantities again', back.every(x => x.qty > 1) && back[0].units === 99, back.map(x => x.qty));
    check('6.1 planted: the test\'s own incidental table fails (it detects the original defect)', incidental.filter(([p]) => typed(P, p).qty !== 1).length >= 12);
    const D = load(w => w.replace("'(?:model|mdl|number|part|sku|series|version|serial|s\\\\/n|id|type|size|order|invoice|ref|reference|confirmation|code|zip|pin|(?:bed|bath)?room|rm|apt|apartment|suite|ste|floor|level|unit|building|bldg|lot|no\\\\.|nr\\\\.?)'", "'(?:zzzz)'"));
    check('6.2 planted without the designator rule: "install model 52 ceiling fan" reads 52 again (and 1 with the rule)', typed(D, 'install model 52 ceiling fan').qty === 52 && typed(E, 'install model 52 ceiling fan').qty === 1, [typed(D, 'install model 52 ceiling fan').qty, typed(E, 'install model 52 ceiling fan').qty]);
}

finish();
