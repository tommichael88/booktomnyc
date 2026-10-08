#!/usr/bin/env node
/**
 * verify_r-domain-finite_named_service_declaration.js
 *
 * @supports P-DOMAIN-FINITE   (T156: the 2026-10-07 Charter classes this statement as a Principle, which is not enforced by definition; this test measures only the
 *   mechanical subset below -- the DECLARATION -- and is the evidence if the operator promotes that subset to a Rule. It is not an @enforces tag because
 *   verify_charter_rules.js requires an @enforces tag to name a declared Rule.)
 * PENDING_DECISIONS #62 (operator ruling, T148). The architecture's primitive layer is finite on purpose; a capability gap closes as a NAMED service only when at least one of four
 * criteria applies, otherwise as a dynamic entry composed from the existing primitives:
 *   1. a distinct pricing shape a generic formula cannot express (the PAX wardrobe; the tile-repair formula);
 *   2. a distinct real intake requirement no sibling can share;
 *   3. a named client-facing vocabulary customers search for ("dishwasher repair", not "appliance repair involving a dishwasher");
 *   4. a regulatory, safety or warranty distinction that must be tracked separately.
 * The four criteria are a JUDGMENT rule -- no mechanical test can decide whether a pricing shape is genuinely distinct. The DECLARATION is mechanical, and is what this test enforces:
 * every new named service carries a `_note` that begins "Criterion <1-4>" and says why (>= 60 characters). A new named service without it fails.
 * The services that existed when the rule was ruled (T148) are GRANDFATHERED by name, frozen, and the list may only shrink: backfill a declaration, then delete the entry.
 */
'use strict';
const fs = require('fs'), path = require('path');
const { check, finish } = require('./_shared.js');
const DB = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'btnyc.json'), 'utf8'));
const GRANDFATHERED = [
  "angle_stop_replacement",
  "baseboard_install",
  "bathroom_exhaust_fan_replacement",
  "bidet_attachment_install_or_removal",
  "blinds_shades_curtains_buy_the_hour",
  "brick_or_concrete_crack_repair",
  "cabinet_door_or_drawer_adjustment",
  "cabinet_knob_or_pull_install",
  "cable_management",
  "ceiling_fan_install",
  "chandelier_or_pendant_install",
  "computer_diagnostic",
  "data_backup_or_transfer",
  "dimmer_switch_install",
  "dishwasher_install",
  "dishwasher_repair",
  "door_lock_or_handle_install",
  "door_repair_impact_damage",
  "door_weatherstripping",
  "dryer_repair",
  "faucet_repair_drip",
  "flatscreen_mounting_standard",
  "flatscreen_mounting_with_hidden_cables",
  "furniture_assembly_flat_pack",
  "furniture_disassembly_for_moving",
  "furniture_repair_hourly",
  "garbage_disposal_replacement",
  "generic_mounting_service",
  "gfci_outlet_replacement",
  "high_ceiling_bulb_replacement",
  "internal_hardware_replacement",
  "leak_under_sink_repair",
  "led_bulb_upgrade",
  "light_fixture_replacement",
  "loose_tile_replacement",
  "microwave_repair",
  "microwave_setup",
  "p_trap_cleaning",
  "pax_wardrobe_assembly",
  "plaster_wall_repair",
  "prehung_interior_door_install",
  "refrigerator_install",
  "refrigerator_water_line_install",
  "repair_appliances",
  "router_configuration",
  "scratch_or_water_ring_removal",
  "shelf_mortar_mounting_buy_the_hour",
  "shelf_mounting_standard_buy_the_hour",
  "shower_head_replacement",
  "slow_drain_clearing",
  "smart_plug_configuration",
  "smart_speaker_setup",
  "smart_switch_install",
  "software_or_driver_install",
  "squeaky_floor_repair",
  "stove_repair",
  "system_restore_or_reset",
  "thermostat_replacement",
  "toilet_flapper_or_fill_valve_replacement",
  "toilet_install",
  "toilet_seat_replacement",
  "toilet_wax_ring_replacement",
  "tub_spout_replacement",
  "under_cabinet_light_install",
  "usb_outlet_install",
  "virus_or_malware_removal",
  "wall_hole_or_crack_repair",
  "washer_install",
  "washer_repair",
  "wi_fi_extender_setup",
  "window_ac_repair",
  "window_ac_setup",
  "window_draft_sealing",
  "window_hardware_repair",
  "window_screen_repair",
  "wood_paneling_repair"
];
const declared = s => typeof s._note === 'string' && /^\s*criterion\s*[1-4]\b/i.test(s._note) && s._note.trim().length >= 60;

const byId = new Map(DB.services.map(s => [s.id, s]));
const undeclared = DB.services.filter(s => !GRANDFATHERED.includes(s.id) && !declared(s)).map(s => s.id);
check(`every service not grandfathered carries a "Criterion 1-4" declaration in its _note (${DB.services.length - GRANDFATHERED.filter(i => byId.has(i)).length} new, ${GRANDFATHERED.filter(i => byId.has(i)).length} grandfathered)`, undeclared.length === 0, { expected: 0, got: undeclared });
const gone = GRANDFATHERED.filter(i => !byId.has(i)), nowDeclared = GRANDFATHERED.filter(i => byId.has(i) && declared(byId.get(i)));
check('the grandfather list only shrinks: every entry is still a service that lacks a declaration (delete an entry the moment it is backfilled or the service is retired)', gone.length === 0 && nowDeclared.length === 0, { expected: 0, got: { retired: gone, nowDeclared } });
// the predicate itself, so a vacuous or over-lenient test cannot pass
const ok = n => declared({ _note: n });
check('the declaration predicate accepts a real declaration and rejects the empty, the vague and the wrong-numbered', ok('Criterion 3 (named vocabulary): customers search for and browse to "dishwasher repair" by that name, not as an appliance repair.') && !ok('') && !ok('new service') && !ok('Criterion 3') && !ok('Criterion 7: not one of the four criteria, even with plenty of explanation after it.') && !ok(undefined));
finish('a new named service declares which of the four criteria applied (R-DOMAIN-FINITE, #62)');
