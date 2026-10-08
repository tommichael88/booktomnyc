#!/usr/bin/env node
/**
 * @enforces R-INTAKE-QTYONCE
 * verify_quantity_question_ratchet.js
 *
 * PENDING_DECISIONS #76 item 2, #80 and #47 (operator rulings, T147). A quantity question is a claim: "the answer to this changes the job". This test holds the SSOT and
 * both entry paths to that claim, so it cannot silently rot the way it did (T147 measured: 12 count questions priced NOTHING, 25 services carried a quantity marker
 * that the T118 audit had only made explicit, and the wall-repair count question was asked and never charged).
 *
 *   A. ONE STANCE PER SERVICE. Every service is either SINGLE-UNIT (per_unit_answers_vary: its intake answers describe one unit, so two are two bookings) or BATCHED
 *      (its chain asks a quantity step) -- never both, never neither. A new service cannot be added without declaring which.
 *   B. A BATCHED Skilled/Specialized service must say WHY (_quantity_justification on the step): homogeneous units, or a billing model. (Charter: quantity "should
 *      generally not be asked at all" above Routine.)
 *   C. A BANDED count question must actually price: some band moves the price or the time. (The one deliberate binary gate, buy_the_hour_qty, is named.)
 *   C2. PRICE NEVER FALLS AS THE COUNT RISES, and an open-ended top band is wired to the owner's overflow formula and behaves as configured (DEFECT-NONMONOTONE-BANDS, proposed
 *      Charter class: T147 found "5 or more windows" at $55 beneath "4 or more windows" at $105 -- the formula dropped the band's own flat price).
 *   D. EVIDENCE PROMOTES, NEVER DEMOTES: across a banded count question, the complexity each band implies never falls as the count rises (job complexity evolves up
 *      with evidence).
 *   E. BEHAVIOUR AT BOTH PUBLIC BOUNDARIES (computeQuoteFromState and executeWorkflow): a single-unit service prices ONE unit whatever quantity is requested, and says what
 *      was requested; a batched stepper service scales; both paths agree.
 *   F. THE WALL DECISION (#80): n walls cost n x the base, on both paths.
 *   G. RATCHET: a question that DECLARES it affects price yet changes nothing (price, time, tier, branch) may not be added. The frozen list below is today's legacy
 *      (mostly preparation or identification questions with a wrong declaration); it may only shrink.
 * Measured at the boundaries, no helper named (R-GOVERN-GOODHART), with non-vacuity guards. Pure Logic: a Node VM over the extracted engine modules.
 */
'use strict';
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const { check, finish } = require('./_shared.js');
const ROOT = path.resolve(__dirname, '..');
const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
const sb = { DB, SERVICE_DATA: DB, window: { DB }, console }; sb.global = sb; vm.createContext(sb);
for (const f of ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });

const QTYPE = new Set(['item_count_template', 'hybrid_qty', 'global_quantity', 'buy_the_hour_qty', 'pax_cabinet_count', 'pax_hinge_count', 'pax_sliding_count', 'pax_interior_count', 'item_count', 'count']);
const mod = st => (typeof st === 'string' ? st : st.module);
const bandsOf = st => ((st.params && st.params.client_response) || (DB.intake_modules[mod(st)] || {}).client_response || []);
const catOf = s => s.ui_taxonomy.category_id;
const tierRank = { routine: 0, skilled: 1, specialized: 2 };
const batched = s => s.intake_chain.some(st => QTYPE.has(mod(st)));
const mkState = (x, over) => Object.assign({ qty: 1, intent: { key: x.id, category: catOf(x), label: x.ui_taxonomy.display_name, qtyLabel: 'item' }, stype: 'Repair', answers: {}, detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: [], userTagIds: [], _svc: x, _tagsAffirmed: false }, over || {});
const state = (x, over) => { const st = mkState(x, over); const q = sb.computeQuoteFromState(st); return { price: q.laborCalc, time: q.totalMin, qty: st.qty }; };
const orch = (x, o) => { const c = sb.collectBookingContext_catalog(x, catOf(x)); if (o && o.answers) c.answers = Object.assign({}, o.answers); if (o && o.qty) c.extractedQty = o.qty; const r = sb.executeWorkflow(c, DB); return { price: r.quote.laborEstimate, time: r.quote.totalMin, tier: r.quote.complexityTier, route: r }; };

// ---- A. one stance per service -------------------------------------------------------------------------------------------------------------------------------------
const stanceBad = DB.services.filter(s => batched(s) === (s.per_unit_answers_vary === true)).map(s => `${s.id}: ${batched(s) ? 'asks a quantity step AND is flagged single-unit' : 'declares neither stance'}`);
check(`every service holds exactly ONE quantity stance, single-unit or batched (${DB.services.length} services)`, stanceBad.length === 0, { expected: 0, got: stanceBad.slice(0, 5) });
const singles = DB.services.filter(s => s.per_unit_answers_vary === true), batches = DB.services.filter(batched);
check(`non-vacuity: both stances are really in use (${singles.length} single-unit, ${batches.length} batched)`, singles.length >= 20 && batches.length >= 15, { expected: '>= 20 and >= 15', got: [singles.length, batches.length] });

// ---- B. a batched Skilled/Specialized service says why -------------------------------------------------------------------------------------------------------------
let steps = 0; const unjust = [];
for (const s of DB.services) { if (s.operational_metrics.complexity_tier === 'routine') continue;
    for (const st of s.intake_chain) if (QTYPE.has(mod(st))) { steps++; const j = st._quantity_justification; if (!(typeof j === 'string' && j.trim().length >= 40)) unjust.push(`${s.id}:${mod(st)}`); } }
check(`every quantity step on a Skilled/Specialized service carries a stated justification (${steps} steps)`, unjust.length === 0 && steps >= 20, { expected: '0 unjustified, >= 20 steps', got: { steps, unjust: unjust.slice(0, 5) } });

// ---- C. a banded count question prices; D. evidence promotes, never demotes ---------------------------------------------------------------------------------------
const GATE = new Set(['buy_the_hour_qty']); // T118: a deliberate binary gate (flat for one item, hourly for more), documented in the module's own _note
let banded = 0, inert = [], falling = [];
for (const s of DB.services) for (const st of s.intake_chain) {
    if (!QTYPE.has(mod(st))) continue; const bands = bandsOf(st); if (!bands.length) continue; banded++;
    const rs = bands.map(b => orch(s, { answers: { [mod(st)]: b.label } }));
    const moves = new Set(rs.map(r => r.price)).size > 1 || new Set(rs.map(r => r.time)).size > 1;
    if (!moves && !GATE.has(mod(st))) inert.push(`${s.id}:${mod(st)}`);
    const ranks = bands.map(b => b.complexity_override).filter(Boolean).map(t => tierRank[t]);
    for (let i = 1; i < ranks.length; i++) if (ranks[i] < ranks[i - 1]) { falling.push(`${s.id}:${mod(st)}`); break; }
}
check(`every banded count question moves the price or the time (${banded} banded steps; a question that charges nothing is not a question)`, inert.length === 0 && banded >= 15, { expected: '0 inert, >= 15 banded', got: { banded, inert } });
// C2. price never falls as the count rises; the open-ended top band is overflow-wired and behaves as configured
const OF = 'item_count_overflow_formula', CFG = DB.pricing_formulas[OF].anchor_and_overflow_ref_by_service, MODS = DB.global_rules.modifiers;
const UNWIRED_OPEN_ENDED = new Set(['router_configuration']); // "16+ devices": tiers of devices, not units; the cliff is acknowledged (PENDING_DECISIONS #98) -- this list may only shrink
const inversions = [], openUnwired = [], overflowBad = []; let overflowChecked = 0;
for (const s of DB.services) for (const st of s.intake_chain) {
    if (mod(st) !== 'item_count_template') continue; const bands = bandsOf(st); if (!bands.length) continue;
    const price = (label, extra) => orch(s, { answers: Object.assign({ item_count_template: label }, extra || {}) }).price;
    const prices = bands.map(b => price(b.label));
    for (let i = 1; i < prices.length; i++) if (prices[i] < prices[i - 1]) { inversions.push(`${s.id}: "${bands[i].label}" $${prices[i]} is below "${bands[i - 1].label}" $${prices[i - 1]}`); break; }
    const last = bands[bands.length - 1];
    if (/or more|\+/i.test(last.label) && last.formula_override !== OF && !UNWIRED_OPEN_ENDED.has(s.id)) openUnwired.push(`${s.id}: "${last.label}"`);
    for (const b of bands) if (b.formula_override === OF) { overflowChecked++; const cfg = CFG[s.id], rate = cfg && MODS[cfg.overflow_rate_ref];
        if (!cfg || !rate || !Number.isInteger(cfg.anchor)) { overflowBad.push(`${s.id}: overflow configuration missing`); continue; }
        const flat = price(b.label), atAnchor = price(b.label, { __exact_count: cfg.anchor }), over = price(b.label, { __exact_count: cfg.anchor + 3 });
        // the anchor is the count the band's own flat price is FOR: the leading number of the first band that carries the same modifier (the dormant sibling band shares its predecessor's)
        const priced = b.modifier_ref ? bands.find(x => x.modifier_ref === b.modifier_ref) : null, lead = priced ? parseInt((priced.label.match(/\d+/) || [])[0], 10) : NaN;
        if (!b.modifier_ref || lead !== cfg.anchor) overflowBad.push(`${s.id}: anchor ${cfg.anchor} but the flat price is for ${lead} ("${priced && priced.label}")`);
        if (atAnchor !== flat) overflowBad.push(`${s.id}: at the anchor (${cfg.anchor}) the price moved from $${flat} to $${atAnchor}`);
        if (Math.abs((over - flat) - 3 * rate.fee) > 1) overflowBad.push(`${s.id}: 3 units beyond the anchor added $${over - flat}, the rate says $${3 * rate.fee}`); } }
check('PRICE NEVER FALLS as the count rises across a banded count question (the open-ended band is never cheaper than the band below it)', inversions.length === 0, { expected: 0, got: inversions });
check('every open-ended top band ("... or more") is wired to the overflow formula, so the price keeps rising beyond it (the "9 or 400 cost the same" cliff)', openUnwired.length === 0, { expected: 0, got: openUnwired });
check(`the overflow behaves as configured on all ${overflowChecked} overflow bands: flat at and below the anchor, the configured rate for every unit beyond it`, overflowBad.length === 0 && overflowChecked >= 14, { expected: '0 bad, >= 14 checked', got: { overflowChecked, overflowBad } });
check('across a banded count question the implied complexity never FALLS as the count rises (evidence promotes, never demotes)', falling.length === 0, { expected: 0, got: falling });

// ---- E. behaviour at both public boundaries ------------------------------------------------------------------------------------------------------------------------
const badSingle = [], badPolicy = []; let nSingle = 0;
for (const x of singles) { try {
    const s1 = state(x, { qty: 1 }), s3 = state(x, { qty: 3 }), o1 = orch(x), o3 = orch(x, { qty: 3 }); nSingle++;
    if (s3.price !== s1.price || s3.qty !== 1) badSingle.push(`${x.id}: state qty3 -> $${s3.price} (qty ${s3.qty}) vs $${s1.price}`);
    if (o3.price !== o1.price) badSingle.push(`${x.id}: orchestrator qty3 -> $${o3.price} vs $${o1.price}`);
    const p = o3.route.quantity; if (!p || p.stance !== 'single_unit' || p.units !== 1 || p.requestedQty !== 3 || p.source !== 'service_override') badPolicy.push(`${x.id}: ${JSON.stringify(p)}`);
} catch (e) { badSingle.push(`${x.id}: threw ${e.message}`); } }
check(`a SINGLE-UNIT service prices ONE unit whatever quantity is requested, on both paths (${nSingle} services; the session's own quantity is normalised too)`, badSingle.length === 0 && nSingle >= 20, { expected: '0 differences', got: badSingle.slice(0, 4) });
check('...and the route says what was requested and why one unit was priced (stance, units, source), so the card can say "book each separately"', badPolicy.length === 0, { expected: 0, got: badPolicy.slice(0, 3) });
const steppers = batches.filter(x => !x.intake_chain.some(st => mod(st) === 'item_count_template' || bandsOf(st).length && QTYPE.has(mod(st))));
const flat = [], mism = []; let scaled = 0;
for (const x of steppers) { try {
    const s1 = state(x, { qty: 1 }), s3 = state(x, { qty: 3 }), o1 = orch(x), o3 = orch(x, { qty: 3 });
    if (s3.price > s1.price || s3.time > s1.time) scaled++; else flat.push(x.id);
    if (o3.price !== s3.price) mism.push(`${x.id}: orchestrator $${o3.price} vs state $${s3.price}`);
} catch (e) { flat.push(`${x.id}: threw ${e.message}`); } }
check(`a BATCHED stepper service really scales with the quantity (${scaled} of ${steppers.length}), and both paths agree on the result`, flat.length === 0 && mism.length === 0 && steppers.length >= 8, { expected: 'all scale, 0 mismatches', got: { flat, mism: mism.slice(0, 3) } });

// ---- E2. PROVENANCE (R-INVARIANT-PROVENANCE): the quantity every service prices names its source on its own record -- on the route, and on the quote that reaches pricing -------------
const VOCAB = ['service_override', 'archetype_default', 'dynamic_engine', 'fallback']; // the Charter's vocabulary for a resolution's source
const badProv = []; let awareSeen = 0;
for (const x of DB.services) {
    const r = orch(x, { qty: 3 }).route, q = r.quantity, qq = r.quote && r.quote.quantity;
    const hasOwn = x.intake_chain.some(st => mod(st) === 'item_count_template');
    const want = x.per_unit_answers_vary === true ? ['single_unit', 'service_override'] : hasOwn ? ['batched', 'service_override'] : ['batched', 'fallback'];
    if (!q || q.stance !== want[0] || q.source !== want[1] || !VOCAB.includes(q.source)) badProv.push(`${x.id}: route.quantity ${JSON.stringify(q)}, expected ${want}`);
    else if (!qq || qq.units !== q.units || !VOCAB.includes(qq.source) || !VOCAB.includes(qq.multiplierSource)) badProv.push(`${x.id}: quote.quantity ${JSON.stringify(qq)}`);
    else if (qq.multiplierSource === 'archetype_default') { awareSeen++; if (qq.multiplier !== 1 || qq.units !== 3) badProv.push(`${x.id}: a formula that applies quantity itself must not also multiply (multiplier ${qq.multiplier}, units ${qq.units})`); }
}
check(`every service's quantity names its source on its own record, on the route AND on the quote that reaches pricing (${DB.services.length} services; ${awareSeen} where a formula applies the quantity itself)`, badProv.length === 0 && awareSeen >= 1, { expected: '0 untraceable, >= 1 formula-applied', got: badProv.slice(0, 3) });

// ---- F. the wall decision (#80): n walls cost n x the base ---------------------------------------------------------------------------------------------------------
const WALLS = ['wall_hole_or_crack_repair', 'brick_or_concrete_crack_repair', 'plaster_wall_repair', 'wood_paneling_repair'];
const wallBad = []; let wallRows = 0;
for (const id of WALLS) { const x = DB.services.find(s => s.id === id); const st = x.intake_chain.find(t => mod(t) === 'item_count_template'); const labels = bandsOf(st).map(b => b.label); const base = x.financial_engine.base_price;
    const one = orch(x, { answers: { item_count_template: labels[0] } }).price;
    for (let n = 2; n <= 4; n++) { const o = orch(x, { answers: { item_count_template: labels[n - 1] } }).price, s = state(x, { answers: { item_count_template: labels[n - 1] } }).price, s1 = state(x, { answers: { item_count_template: labels[0] } }).price; wallRows++;
        if (o - one !== (n - 1) * base || s - s1 !== (n - 1) * base) wallBad.push(`${id} x${n}: orchestrator +${o - one}, state +${s - s1}, expected +${(n - 1) * base}`); }
    // ...and the rule CONTINUES past the top band: with an exact count of 8 (through the owner's overflow formula) it is still n x base
    const top = labels[labels.length - 1], ex = { item_count_template: top, __exact_count: 8 }, o8 = orch(x, { answers: ex }).price, s8 = state(x, { answers: ex }).price, s1b = state(x, { answers: { item_count_template: labels[0] } }).price; wallRows++;
    if (o8 - one !== 7 * base || s8 - s1b !== 7 * base) wallBad.push(`${id} x8 (exact count): orchestrator +${o8 - one}, state +${s8 - s1b}, expected +${7 * base}`); }
check(`n walls cost n x the base price on both paths, for the four wall services, including beyond the top band through the overflow (${wallRows} cases; "4 walls x $70 = $280", 8 walls = $560)`, wallBad.length === 0 && wallRows === 16, { expected: 0, got: wallBad.slice(0, 4) });

// ---- G. ratchet: a question that declares it affects price must change something -------------------------------------------------------------------------------------
const LEGACY = [
        "angle_stop_replacement:plumbing_fixture",
    "baseboard_install:length",
    "bidet_attachment_install_or_removal:action",
    "blinds_shades_curtains_buy_the_hour:wall_type",
    "computer_diagnostic:computer_symptom",
    "dishwasher_install:space_ready",
    "door_weatherstripping:door_type",
    "furniture_disassembly_for_moving:item_type",
    "furniture_repair_hourly:furn_item",
    "generic_mounting_service:mounting_item",
    "internal_hardware_replacement:computer_component",
    "internal_hardware_replacement:laptop_or_desktop",
    "leak_under_sink_repair:leak_loc",
    "leak_under_sink_repair:leak_type",
    "leak_under_sink_repair:location",
    "light_fixture_replacement:fixture_type",
    "loose_tile_replacement:has_matching_tiles",
    "loose_tile_replacement:tile_condition",
    "microwave_repair:location",
    "microwave_setup:space_ready",
    "p_trap_cleaning:sink_type",
    "refrigerator_install:space_ready",
    "repair_appliances:location",
    "slow_drain_clearing:location",
    "smart_speaker_setup:brand",
    "squeaky_floor_repair:floor_type",
    "stove_repair:stove_symptom",
    "system_restore_or_reset:device_state",
    "toilet_install:toilet_style_pref",
    "under_cabinet_light_install:length",
    "washer_install:space_ready",
    "washer_repair:location",
    "washer_repair:washer_type",
    "window_ac_repair:location",
    "window_ac_setup:window_type",
    "window_hardware_repair:window_type"
];
const found = [];
for (const s of DB.services) for (const st of s.intake_chain) {
    const k = mod(st); if (QTYPE.has(k)) continue; const m = DB.intake_modules[k]; if (!m) continue; if (!(m.affects_price === true || m.purpose === 'pricing')) continue;
    const labels = bandsOf(st).map(b => b.label); if (labels.length < 2) continue;
    const rs = labels.map(l => { try { return orch(s, { answers: { [k]: l } }); } catch (e) { return null; } }).filter(Boolean);
    const u = f => new Set(rs.map(f)).size > 1; const chains = new Set(rs.map(r => (r.route.intakeChain || []).map(q => q.moduleKey || q.module).join(',')));
    const branch = st.then && Object.keys(st.then).some(b => (st.then[b] || []).length);
    if (!(u(r => r.price) || u(r => r.time) || u(r => r.tier) || chains.size > 1 || branch)) found.push(`${s.id}:${k}`);
}
const fresh = found.filter(x => !LEGACY.includes(x)), stale = LEGACY.filter(x => !found.includes(x));
check(`no NEW question declares it affects price yet changes nothing (${found.length} legacy pairs frozen; a padded or mis-declared question cannot be added)`, fresh.length === 0, { expected: 0, got: fresh });
check('the frozen legacy list only shrinks: every entry still earns its place on it (remove entries as they are fixed)', stale.length === 0, { expected: 0, got: stale });
finish('quantity questions and the one-stance rule (Logic)');
