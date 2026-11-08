#!/usr/bin/env node
/**
 * verify_typed_service_names.js -- PENDING_DECISIONS #250 (T197): a customer who types a published service's own name reaches that service.
 *
 * Before: 58 of the 76 names reached their own service (T195). The other 18 fell to a dynamic fallback or to a sibling service whose price is not the job's: "Dryer Repair" quoted $198 as
 * an anonymous repair where the dryer service quotes $422 as a diagnostic; "Flatscreen Mounting with Hidden Cables" quoted the plain TV mount ($60, not $150); "Wall Hole or Crack Repair"
 * quoted $281 for a patch the service sells at $70. The cause was in the authored vocabulary (intent_mappings.objects), not in the page: an object with no service of its own, a hyphen
 * the keyword does not match, a generic verb ("install") that outweighs the noun, three services behind one object ("furniture"), two services with no object at all.
 *
 *   1. THE NAMES     all 76: the typed display_name reaches the service (the real text-entry path: collectBookingContext_freeText -> executeWorkflow, tags affirmed), the chain it asks is the chain
 *                    the service asks from its own tile, and its quote is the tile's quote -- or the difference is explained by what the NAME says (a detected tag's answer: "High Ceilings",
 *                    "Urgent", "Scratch") or, for three names, by the object's pricing formula applied on top of the service's own price: a declared list that may only shrink (#251).
 *   2. NEAR MATCHES  the words next to a name that must NOT become a confident match stay where they were (an install, a vent cleaning, a price range, a phone, a wi-fi password), and the
 *                    neighbours of the changed objects still reach the service they reached (a TV on brick, a door knob on a back door, LED bulbs in a hallway, a new front door).
 *   3. NON-VACUITY   each kind of authored relationship, removed from a copy of the catalog, turns the check on its name red: a contextual override (window), a default service (under cabinet),
 *                    a full-weight synonym (door lock), an object (system restore).
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..');
const { check, finish } = require('./_shared.js');
const { engine } = require('./_engine.js');

const DB0 = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
const clone = o => JSON.parse(JSON.stringify(o));
function load(db) {
    const sb = { DB: db, SERVICE_DATA: db, window: { DB: db }, console: { log() {}, warn() {}, error() {}, info() {}, debug() {} } };
    sb.global = sb;
    vm.createContext(sb);
    vm.runInContext(engine().wrapper, sb);
    if (typeof sb.initNlpSets === 'function') { sb.initNlpSets(); if (typeof sb.refreshNlpPreviewBindings === 'function') sb.refreshNlpPreviewBindings(); }
    return sb;
}
const E = load(DB0);
const typed = (sb, text) => { const c = sb.collectBookingContext_freeText(text); return sb.executeWorkflow(Object.assign({}, c, { tagsAffirmed: true }), sb.DB); };
const entityOf = (sb, text) => { const r = typed(sb, text); return (r.entity && r.entity.id) || 'dynamic'; };
const chainKeys = r => (r.visibleChain || []).map(m => m.moduleKey || m.module).sort().join(',');

// the quotes that differ from the tile for a reason other than a tag the name says: the object's pricing formula applied on top of the service's own price (#251).
// T198 (A2) closed it: a curated service is priced by its own contract, so the declared list is empty and stays empty.
const KNOWN_FORMULA_ON_CURATED = [];

// ===== 1. the names ==========================================================================================================================================================================
const services = DB0.services;
const missed = [], chainDiffers = [], unexplained = [], formulaOn = [];
for (const s of services) {
    const name = s.ui_taxonomy.display_name;
    const r = typed(E, name);
    if (!(r.entity && r.entity.id === s.id)) { missed.push(`${s.id} -> ${(r.entity && r.entity.id) || 'dynamic'}`); continue; }
    const c0 = E.collectBookingContext_catalog(s, s.ui_taxonomy.category_id); c0.answers = {};
    const t = E.executeWorkflow(c0, E.DB);
    if (chainKeys(r) !== chainKeys(t)) chainDiffers.push(s.id);
    const same = r.quote.laborEstimate === t.quote.laborEstimate && r.quote.totalMin === t.quote.totalMin && r.quote.checkoutStateKey === t.quote.checkoutStateKey;
    if (!same) {
        const byAnswer = Object.keys(r.answers || {}).length > 0;
        if (!byAnswer) formulaOn.push(s.id);   // no answer from the name explains it: the object's pricing formula (dynamic_rule) was applied on top of the service's own price
        if (!byAnswer && !KNOWN_FORMULA_ON_CURATED.includes(s.id)) unexplained.push(`${s.id}: typed $${r.quote.laborEstimate}/${r.quote.totalMin} vs tile $${t.quote.laborEstimate}/${t.quote.totalMin}`);
    }
}
check(`1.1 all ${services.length} published names, typed, reach their own service (the T195 measure was 58)`, missed.length === 0, { missed });
check('1.2 the chain a typed name asks is the chain the service asks from its own tile', chainDiffers.length === 0, { chainDiffers });
check('1.3 the typed quote is the tile quote, unless the name itself says something that prices (a tag\'s answer)', unexplained.length === 0, { unexplained });
check('1.4 no curated service is priced with its object\'s formula on top of its own price (#251 closed, T198: the declared list is empty)', JSON.stringify(formulaOn.sort()) === JSON.stringify(KNOWN_FORMULA_ON_CURATED.slice().sort()), { formulaOn });

// ===== 2. near matches =======================================================================================================================================================================
const NOT = [   // words beside a changed object that are NOT the job of the service next to them: they keep the fallback they had
    ['install a dryer', 'dryer_repair'], ['dryer vent cleaning', 'dryer_repair'], ['install gas stove', 'stove_repair'], ['price range for repairs', 'stove_repair'],
    ['burner phone setup', 'stove_repair'], ['range hood install', 'stove_repair'], ['wi-fi password', 'wi_fi_extender_setup'], ['reset my password', 'system_restore_or_reset'],
    ['led strip lights', 'led_bulb_upgrade'], ['hide the cables behind my desk', 'flatscreen_mounting_with_hidden_cables'],
];
for (const [text, wrong] of NOT) check(`2.1 "${text}" is not a ${wrong}`, entityOf(E, text) !== wrong, { reached: entityOf(E, text) });
const STAYS = [ // the neighbours: what they reached before the change and still reach (or reach better, said in the comment)
    ['mount a tv on brick wall', 'flatscreen_mounting_standard'],            // a TV is not a shelf: the TV rule comes before the masonry rule
    ['mount a tv', 'flatscreen_mounting_standard'],
    ['replace led bulbs in hallway', 'led_bulb_upgrade'],                       // an LED synonym that consumed "led" moved this to the high-ceiling service in a first draft
    ['install a new front door', 'prehung_interior_door_install'],
    ['fix door handle on bathroom door', 'door_lock_or_handle_install'],       // a full-weight door handle sent this to the prehung door by description overlap in a first draft
    ['install a door lock on the back door', 'door_lock_or_handle_install'],
    ['install a door knob on the back door', 'door_lock_or_handle_install'],   // was the prehung door ($250) -- fixed by the same override that carries the name
    ['install a washer', 'washer_install'], ['install a dishwasher', 'dishwasher_install'], ['clean my washer', 'washer_repair'],
    ['replace the bulb in my chandelier', 'chandelier_or_pendant_install'],
    ['fix my dryer', 'dryer_repair'], ['fix my oven', 'stove_repair'], ['mount a shelf on brick wall', 'shelf_mortar_mounting_buy_the_hour'],
];
for (const [text, want] of STAYS) check(`2.2 "${text}" -> ${want}`, entityOf(E, text) === want, { reached: entityOf(E, text) });

// ===== 3. each kind of authored relationship, removed, turns its name red ===================================================================================================================
const objOf = (db, kw) => db.intent_mappings.objects.find(o => o.keyword === kw);
const without = (mut) => { const db = clone(DB0); mut(db); return load(db); };
const NAMES = { window_draft_sealing: 'Window Draft Sealing', under_cabinet_light_install: 'Under-Cabinet Light Install', door_lock_or_handle_install: 'Door Lock or Handle Install', system_restore_or_reset: 'System Restore or Reset' };
check('3.0 the real catalog reaches the four names the planted copies are held to', Object.entries(NAMES).every(([id, n]) => entityOf(E, n) === id));
check('3.1 without the window contextual override ("draft"): Window Draft Sealing no longer reaches its service',
    entityOf(without(db => { objOf(db, 'window').contextual_overrides = []; }), NAMES.window_draft_sealing) !== 'window_draft_sealing');
check('3.2 without the hyphen as a full-weight synonym: Under-Cabinet Light Install falls back to the install verb',
    entityOf(without(db => { objOf(db, 'under cabinet').full_weight_synonyms = ['undercabinet']; }), NAMES.under_cabinet_light_install) !== 'under_cabinet_light_install');
check('3.3 without "door lock" as a full-weight synonym of the door knob: Door Lock or Handle Install is outweighed by the install verb',
    entityOf(without(db => { const o = objOf(db, 'door knob'); o.full_weight_synonyms = (o.full_weight_synonyms || []).filter(x => x !== 'door lock'); }), NAMES.door_lock_or_handle_install) !== 'door_lock_or_handle_install');
check('3.4 without the system-restore object: System Restore or Reset reaches no service',
    entityOf(without(db => { db.intent_mappings.objects = db.intent_mappings.objects.filter(o => o.keyword !== 'system restore'); }), NAMES.system_restore_or_reset) !== 'system_restore_or_reset');

// ===== 5. pricing ownership (#251, T198 A2): a curated service is priced by its own contract; the object's formula belongs to the dynamic fallback ===================================================
const labor = (sb, text) => { const r = typed(sb, text); return [(r.entity && r.entity.id) || 'dynamic', r.quote.laborEstimate, r.quote.totalMin].join('/'); };
const noFormula = id => without(db => { delete db.pricing_formulas[id]; });
check('5.1 a curated service reached through an object does not read that object\'s formula (deleting drywall_repair_formula moves nothing for Wall Hole or Crack Repair)',
    labor(noFormula('drywall_repair_formula'), 'Wall Hole or Crack Repair') === labor(E, 'Wall Hole or Crack Repair'), { with: labor(E, 'Wall Hole or Crack Repair'), without: labor(noFormula('drywall_repair_formula'), 'Wall Hole or Crack Repair') });
check('5.2 ...and the dynamic fallback of the same object still does (deleting tile_repair_formula moves "fix tile")',
    labor(E, 'fix tile').startsWith('dynamic/') && labor(noFormula('tile_repair_formula'), 'fix tile') !== labor(E, 'fix tile'), { with: labor(E, 'fix tile'), without: labor(noFormula('tile_repair_formula'), 'fix tile') });
check('5.3 a curated service whose OWN contract names the object formula keeps it (Loose Tile Replacement: deleting tile_repair_formula moves it)',
    labor(noFormula('tile_repair_formula'), 'Loose Tile Replacement') !== labor(E, 'Loose Tile Replacement'), { with: labor(E, 'Loose Tile Replacement') });
check('5.4 the orchestrator asks the service\'s own contract first (source)', /entityType === 'service'\s*\?\s*\(entity\?\.financial_engine\?\.formula_ref \|\| entity\?\.pricing_engine \|\| context\.nlpIntent\?\.dynamic_rule/.test(require('./_page.js').readPage(path.join(ROOT, 'qr.html'), ROOT)));

finish();
