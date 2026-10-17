# T182: the time model (#229, #234) -- answers add time, and the time prices a flat-rate job; measured before and after

Operator direction, 2026-10-16 23:34 NY (the model) and 2026-10-17 02:30 NY (confirmed): "As for the pricing time model seems correct but most services that are realistic use your judgement, prehung door pricing needs to be raised to $250 baseline though. As for the #230 just leave them all on there for now."

## What changed

**The model.** A flat-rate service shows its authored baseline. The minutes the customer's answers add (an answer's `minutes`, the minutes of the context overrides, and the minutes of the priced formula `item_count_overflow_formula`) are priced at `global_rules.pricing_engines.flat_rate.time_pricing.rate_per_hour` ($70) and rounded to `round_to` ($5). A per-visit modifier (disposal, urgency) is still a fee and is added once. When the added time reaches `project_after_minutes` (30) the quote is a project estimate ("From $X"), its checkout state becomes `project_based` with source `added_time` (only if that is more restrictive than the service's own state), and its time is shown. An hourly service keeps the rate of its tier.

**The tier is never read from minutes** (R-COMPLEX-VOLUME). `deriveComplexityTier(totalMin, answerOverrideTier, exactTier)` is deleted and replaced by `resolveSkillTier(declaredTier, answerOverrideTier)`: the tier a service declares (a service that declares none is `skilled`), raised by an answer's own override. A dynamic service's declared routine/skilled is read; its declared `specialized` is held back (see "Held" below, PENDING_DECISIONS #239). The six `min_minutes` / `max_minutes` tier bands are no longer read by any code (#240).

**Code**: `qr.html` (`computeUnifiedQuote`, `computeArchetypeQuote`, `buildCheckoutStateModel`, the new `resolvePriceStatement`, `priceAddedTime`, `splitAddedTimeDollars`, `sqTagFeeImpact`, the quote panel and curated card). **Data**: `btnyc.json` and `ssot/btnyc_source.json` (same edits through `ssot_patch.js`), `schema/btnyc_schema.json` (`time_pricing` is required).

## Golden master: 526 of 2,988 points move, every one declared

Tools: `test_harness/tools/price_golden_master.js` capture on the working tree, compared with `archive/golden_master_T180_8n.json` (the baseline before this change). The new baseline is `archive/golden_master_T182.json`.

```
compared 2988 price points: 526 differ across 183 (path|entity) pairs
  of those 526: 515 differ in a labor or minutes field
  fields that differ (count of records): dyn-tags.laborEstimate 6, dyn.laborEstimate 6, orch-tags.laborEstimate 146, orch-tags.totalMin 8, orch.laborEstimate 44, orch.totalMin 20, state-det.checkoutStateKey 16, state-det.laborCalc 32, state-det.totalMin 8, state-dyn.checkoutStateKey 36, state-dyn.laborCalc 47, state-tags.checkoutStateKey 128, state-tags.laborCalc 146, state-tags.totalMin 8, state.laborCalc 44, state.totalMin 20, text.laborEstimate 10, text.totalMin 4
```

The 526 points are 95 entities (named and dynamic). By the kind of pricing the entity has:

| kind | entities | points that move | rise | fall | same price (time or state moved) |
|---|---|---|---|---|---|
| flat_rate (named) | 56 | 387 | 132 | 216 | 33 |
| flat_rate (dynamic) | 24 | 37 | 14 | 13 | 10 |
| hourly (named) | 2 | 26 | 0 | 24 | 0 |
| hourly (dynamic) | 5 | 14 | 0 | 14 | 0 |
| assembly_formula (named) | 2 | 42 | 0 | 40 | 0 |
| assembly_formula (dynamic) | 1 | 6 | 0 | 6 | 0 |
| diagnostic (dynamic) | 4 | 12 | 0 | 12 | 0 |
| free-text corpus entry | 1 | 2 | 0 | 2 | 0 |

**No price rises outside flat-rate services.** Everything that is not flat-rate can only fall, and it falls for one reason: the tier is now the one the service declares, not one read from its minutes, so a long job (or a quantity of 5) no longer climbs into a higher hourly rate. The largest: `shelf_mortar_mounting_buy_the_hour` at quantity 5, $1,792 -> $1,521 (declared skilled $85/h, not the minutes-derived specialized $110/h); `tech_trouble` diagnostic at quantity 3, $905 -> $768.

**Flat-rate services** move in both directions, by design: an answer that used to carry a fee ($25, $36, $54...) now carries the minutes it takes, and the minutes price at $70/h. Where the old fee was above the time's price the quote falls; where below, it rises. The per-entity extremes: prehung door +$100 (the Operator's $250 baseline), `software_or_driver_install` +$40 (first answer), the six plumbing dynamic services +$30 at quantity 3; and on the tag-synthesized answers, drops of up to $190 on a dynamic flat-rate service at quantity 3 (three answers whose old fees were far above their time).

The points that move only in `totalMin` or `checkoutStateKey` keep their price: the time shown is now the time that prices the job, and a job whose added work reaches 30 minutes states that it is a project estimate.

## Services and modifiers whose authored time or price I changed on judgement (the Operator asked for a list)

| what | was | now | why |
|---|---|---|---|
| `prehung_interior_door_install` base price | $150 | **$250** | the Operator's direction |
| ...its `expected_minutes` / `high_case_minutes` | 60 / 120 | 210 / 300 | 3 to 4 hours to hang and trim a prehung door; the old figures read as a knob swap |
| ...its labor range `default_estimates.total_minutes` | 475-925 (labor + materials, in minutes) | 180-240 | labor only; the door and hardware are the materials range |
| `toilet_install` `expected_minutes` and range | 60; 200-525 | 75; 60-90 | labor only, 60-90 minutes to set a toilet; the toilet is the materials range. Base price stays $100 |
| `mod.mount_sourcing_bring_bracket` | $54 fee, 10 min | $54 fee, 45 min | the errand to source and bring the right bracket; 45 min prices at $55, what the fee was. On a time-priced flat-rate service the minutes are the price and the fee is not charged; the fee still applies on a service the time model does not price |
| `mod.existing_toilet_type_commercial_flushometer_no_tank` and its context override (`adjustment_minutes`) | $75 fee, 45 min | $75 fee, 65 min | a flushometer toilet is a longer job than a tank toilet; 65 min prices at $75, what the fee was |
| `mod.ducting_yes_it_vents_outside` / `mod.ducting_no_it_s_recirculating_no_duct` / `mod.water_line_run_another_room_or_through_a_wall` | $25 / $50 / $50 fee, 0 min | same fees, 21 / 43 / 43 min | fee-only answers get the minutes their fee implies ($25 = 21 min, $50 = 43 min at $70/h), and `affects` gains `minutes` |
| the three answers above as authored on their options (the exhaust fan's ducting yes/no, the shared water-line-run answer) | `affects: [price, complexity]` | `[price, minutes, complexity]` | the declaration now says the answer adds time |
| `plaster_wall_repair` count answers (2, 3, 4, 5+ walls) and the overflow rate | 60 / 120 / 180 / 240 / 60 min | 69 / 137 / 206 / 274 / 69 min | the Operator's rule #80, "n walls cost n x the base price", must keep holding: the plaster base is $80, and 60 minutes would price a wall at $70. 69 min = $80 per wall at $70/h, so 2, 3, 4 and 5+ walls stay $80, $160, $240, $320 |
| the nine uniform-10%-rule overflow rates: `dimmer_switch_install`, `gfci_outlet_replacement`, `smart_plug_configuration`, `smart_switch_install`, `usb_outlet_install`, `window_draft_sealing`, `window_hardware_repair`, `window_screen_repair`, `wi_fi_extender_setup` (`mod.<service>_item_count_overflow`) | 12 min each (20 for the screen); fees $2.50-$5.50 | 4 / 3 / 2 / 4 / 4 / 4 / 5 / 3 / 3 min; fees unchanged | the owner decided (v9.6, section 6B) that each unit beyond the anchor costs 10% of the service's flat rate, and marked these minutes an inert placeholder. Priced as time, 12 minutes would have charged $14 a unit instead of $4.50, so the minutes now carry the decided price. Each modifier's note records it. The golden master does not reach these (it varies the first answer and the quantity); `verify_quantity_question_ratchet` pins all 15 overflow bands against the SSOT's minutes |
| `squeaky_floor_repair` count answers (2, 3, 4, 5+ areas) and its overflow rate | 60 / 120 / 180 / 240 / 60 min | 43 / 86 / 129 / 171 / 43 min | rule #80 ("each area beyond the anchor is a full repair": n x base, $50 an area). 60 minutes would price an area at $70. 43 minutes = $50, so 2, 3, 4 and 5+ areas stay $100, $150, $200, $250 |
| `meta.estimate_disclaimers.flat_fee`, `chk.standard_flat_rate` `ui_message` | "...Materials (if any) are extra..." | "...covers the described labor and the standard materials..." | a card that says "materials included" cannot sit beside a disclaimer saying materials are extra |

Not changed: the heavy answers (`weight_over_50_lbs_heavy`, the `mounting_height` ladder rows) keep their minutes, and their price now follows the minutes. Raising `weight_over_50_lbs_heavy` to 95 minutes would raise hourly and dynamic quotes by about $101 at 58 points; it stays at its authored minutes. #230 (the 20 licensed-trade candidates) is untouched and open.

## Held (so that the change stays inside what the Operator asked)

A dynamic service that DECLARES `specialized` is still priced at its band's old tier ceiling; reading the declared tier raised about 270 points by up to $100 and the Operator did not ask for that. The lever is one clause in `exactTier` in `computeUnifiedQuote` (PENDING_DECISIONS #239).

## The tests that hold it

`test_harness/verify_time_model.js` (27 checks; `@enforces R-COMPLEX-VOLUME`, `R-PRICE-SCOPE`, `R-PRICE-PRECISION`): the rounding table, the 30-minute boundary, counterfactuals that change the SSOT's rate, step and threshold and require the quotes to move, per-visit fees untouched, the time-priced lines add up to the time fee, an hourly service is not time-priced, ten times the minutes bills at the same tier, no code reads a tier's minute band, and every fee-bearing per-unit modifier a flat-rate service can reach carries minutes. Five deliberate engine mutations (floor for round, `>` for `>=`, a hard-coded rate, a dropped per-visit fee, an unbalanced split) are each caught.

Tests that pinned the old behavior were rewritten to the new arithmetic (not loosened): `verify_checkout_state_convergence`, `verify_chips_not_fees`, `verify_complexity_axes`, `verify_confidence_accounting`, `verify_dmg_size_wiring_fix`, `verify_formula_override_no_longer_suppresses_other_answers`, `verify_per_unit_per_visit_scope`, `verify_price_precision`, `verify_project_based_hide_time`, `verify_qty_multiplier_formula_fixes` ($245 -> $235), `verify_quantity_question_ratchet` (the overflow expectation is restated from the SSOT's minutes), `verify_reported_ui_bugs_batch2`, `verify_pricing_engine_module` (two vectors), and the money checks of `verify_charter_rule_index_v2` / `_v10`.

## Every moved entity

| entity | kind | points moved | rises | falls | price same |
|---|---|---|---|---|---|
| `furniture_assembly_flat_pack` | assembly_formula | 22 | - | -$17..-$83 (20) | - |
| `furniture_disassembly_for_moving` | assembly_formula | 20 | - | -$17..-$83 (20) | - |
| `corpus` | dyn-entity | 2 | - | - | - |
| `furniture_fixes_assembly+Assembly` | dyn:assembly_formula | 6 | - | -$17..-$50 (6) | - |
| `minor_home_repairs+minor_home_repairs_cabinets_drawers+Diagnostic` | dyn:diagnostic | 2 | - | -$46..-$137 (2) | - |
| `minor_home_repairs+minor_home_repairs_floors_trim+Diagnostic` | dyn:diagnostic | 2 | - | -$68..-$72 (2) | - |
| `minor_home_repairs+minor_home_repairs_furniture+Diagnostic` | dyn:diagnostic | 2 | - | -$46..-$137 (2) | - |
| `tech_trouble+Diagnostic` | dyn:diagnostic | 6 | - | -$46..-$137 (6) | - |
| `furniture_fixes_assembly+furniture_fixes_assembly_assembly+Assembly` | dyn:flat_rate | 2 | +$5..+$10 (2) | - | - |
| `furniture_fixes_assembly+furniture_fixes_assembly_disassembly+Assembly` | dyn:flat_rate | 2 | - | -$65..-$190 (2) | - |
| `minor_home_repairs+Install` | dyn:flat_rate | 2 | - | -$65..-$190 (2) | - |
| `minor_home_repairs+minor_home_repairs_appliances+Mount` | dyn:flat_rate | 2 | - | -$65..-$190 (2) | - |
| `plumbing_help+Install` | dyn:flat_rate | 2 | +$10..+$30 (2) | - | - |
| `plumbing_help+plumbing_help_garbage_disposals+Mount` | dyn:flat_rate | 2 | +$10..+$30 (2) | - | - |
| `plumbing_help+plumbing_help_showers_tubs+Install` | dyn:flat_rate | 2 | +$10..+$30 (2) | - | - |
| `plumbing_help+plumbing_help_sinks+Install` | dyn:flat_rate | 2 | +$10..+$30 (2) | - | - |
| `plumbing_help+plumbing_help_toilets+Install` | dyn:flat_rate | 2 | +$10..+$30 (2) | - | - |
| `plumbing_help+plumbing_help_water_lines+Install` | dyn:flat_rate | 2 | +$10..+$30 (2) | - | - |
| `tech_trouble+Install` | dyn:flat_rate | 1 | - | - | 1 |
| `tech_trouble+Setup` | dyn:flat_rate | 1 | - | - | 1 |
| `tech_trouble+tech_trouble_cable_management+Install` | dyn:flat_rate | 1 | - | - | 1 |
| `tech_trouble+tech_trouble_cable_management+Setup` | dyn:flat_rate | 1 | - | - | 1 |
| `tech_trouble+tech_trouble_computer_repair+Install` | dyn:flat_rate | 1 | - | - | 1 |
| `tech_trouble+tech_trouble_computer_repair+Setup` | dyn:flat_rate | 1 | - | - | 1 |
| `tech_trouble+tech_trouble_networking+Install` | dyn:flat_rate | 1 | - | - | 1 |
| `tech_trouble+tech_trouble_networking+Setup` | dyn:flat_rate | 1 | - | - | 1 |
| `tech_trouble+tech_trouble_smart_home+Install` | dyn:flat_rate | 1 | - | - | 1 |
| `tech_trouble+tech_trouble_smart_home+Setup` | dyn:flat_rate | 1 | - | - | 1 |
| `wall_mounting+wall_mounting_blinds_curtain+Mount` | dyn:flat_rate | 2 | - | -$65..-$190 (2) | - |
| `wall_mounting+wall_mounting_brick_or_concrete+Mount` | dyn:flat_rate | 1 | - | -$5..-$5 (1) | - |
| `wall_mounting+wall_mounting_frames_shelves+Mount` | dyn:flat_rate | 2 | - | -$65..-$190 (2) | - |
| `wall_mounting+wall_mounting_tv_flatscreen+Mount` | dyn:flat_rate | 2 | - | -$65..-$190 (2) | - |
| `furniture_fixes_assembly+furniture_fixes_assembly_assembly+Repair` | dyn:hourly | 2 | - | -$46..-$137 (2) | - |
| `furniture_fixes_assembly+Repair` | dyn:hourly | 6 | - | -$22..-$65 (6) | - |
| `minor_home_repairs+minor_home_repairs_cabinets_drawers+Repair` | dyn:hourly | 2 | - | -$46..-$137 (2) | - |
| `minor_home_repairs+minor_home_repairs_floors_trim+Repair` | dyn:hourly | 2 | - | -$68..-$72 (2) | - |
| `minor_home_repairs+minor_home_repairs_furniture+Repair` | dyn:hourly | 2 | - | -$46..-$137 (2) | - |
| `angle_stop_replacement` | flat_rate | 4 | +$10..+$10 (4) | - | - |
| `baseboard_install` | flat_rate | 4 | - | -$65..-$65 (4) | - |
| `bathroom_exhaust_fan_replacement` | flat_rate | 12 | - | -$95..-$95 (4) | 8 |
| `bidet_attachment_install_or_removal` | flat_rate | 4 | +$10..+$10 (4) | - | - |
| `brick_or_concrete_crack_repair` | flat_rate | 4 | - | -$30..-$30 (4) | - |
| `cabinet_door_or_drawer_adjustment` | flat_rate | 16 | +$5..+$10 (12) | -$65..-$65 (4) | - |
| `cable_management` | flat_rate | 8 | - | -$30..-$65 (8) | - |
| `ceiling_fan_install` | flat_rate | 4 | - | -$95..-$95 (4) | - |
| `chandelier_or_pendant_install` | flat_rate | 4 | - | -$95..-$95 (4) | - |
| `dimmer_switch_install` | flat_rate | 4 | - | -$65..-$65 (4) | - |
| `dishwasher_install` | flat_rate | 12 | - | -$65..-$65 (12) | - |
| `door_lock_or_handle_install` | flat_rate | 8 | - | -$65..-$65 (8) | - |
| `door_repair_impact_damage` | flat_rate | 8 | - | -$65..-$65 (8) | - |
| `door_weatherstripping` | flat_rate | 8 | - | -$65..-$65 (8) | - |
| `faucet_repair_drip` | flat_rate | 4 | +$10..+$10 (4) | - | - |
| `flatscreen_mounting_standard` | flat_rate | 8 | - | -$30..-$65 (8) | - |
| `flatscreen_mounting_with_hidden_cables` | flat_rate | 8 | - | -$30..-$65 (8) | - |
| `garbage_disposal_replacement` | flat_rate | 4 | +$10..+$10 (4) | - | - |
| `generic_mounting_service` | flat_rate | 8 | - | -$30..-$125 (8) | - |
| `gfci_outlet_replacement` | flat_rate | 4 | - | -$65..-$65 (4) | - |
| `high_ceiling_bulb_replacement` | flat_rate | 4 | - | -$95..-$95 (4) | - |
| `leak_under_sink_repair` | flat_rate | 4 | +$10..+$10 (4) | - | - |
| `led_bulb_upgrade` | flat_rate | 4 | - | -$95..-$95 (4) | - |
| `light_fixture_replacement` | flat_rate | 4 | - | -$95..-$95 (4) | - |
| `microwave_setup` | flat_rate | 12 | - | -$65..-$65 (12) | - |
| `p_trap_cleaning` | flat_rate | 4 | +$10..+$10 (4) | - | - |
| `plaster_wall_repair` | flat_rate | 4 | - | -$30..-$30 (4) | - |
| `prehung_interior_door_install` | flat_rate | 30 | +$35..+$100 (28) | - | - |
| `refrigerator_install` | flat_rate | 12 | - | -$65..-$65 (12) | - |
| `refrigerator_water_line_install` | flat_rate | 4 | +$10..+$10 (4) | - | - |
| `router_configuration` | flat_rate | 4 | +$5..+$5 (4) | - | - |
| `scratch_or_water_ring_removal` | flat_rate | 8 | +$5..+$5 (4) | -$65..-$130 (4) | - |
| `shower_head_replacement` | flat_rate | 4 | +$10..+$10 (4) | - | - |
| `slow_drain_clearing` | flat_rate | 4 | +$10..+$10 (4) | - | - |
| `smart_plug_configuration` | flat_rate | 4 | +$5..+$5 (4) | - | - |
| `smart_speaker_setup` | flat_rate | 5 | +$5..+$5 (4) | - | 1 |
| `smart_switch_install` | flat_rate | 4 | - | -$65..-$65 (4) | - |
| `software_or_driver_install` | flat_rate | 8 | +$40..+$40 (8) | - | - |
| `squeaky_floor_repair` | flat_rate | 4 | - | -$65..-$65 (4) | - |
| `thermostat_replacement` | flat_rate | 4 | - | -$65..-$65 (4) | - |
| `toilet_flapper_or_fill_valve_replacement` | flat_rate | 4 | +$10..+$10 (4) | - | - |
| `toilet_install` | flat_rate | 30 | +$10..+$10 (4) | - | 24 |
| `toilet_seat_replacement` | flat_rate | 4 | +$10..+$10 (4) | - | - |
| `toilet_wax_ring_replacement` | flat_rate | 4 | +$10..+$10 (4) | - | - |
| `tub_spout_replacement` | flat_rate | 4 | +$10..+$10 (4) | - | - |
| `under_cabinet_light_install` | flat_rate | 4 | - | -$95..-$95 (4) | - |
| `usb_outlet_install` | flat_rate | 4 | - | -$65..-$65 (4) | - |
| `virus_or_malware_removal` | flat_rate | 8 | +$5..+$5 (8) | - | - |
| `wall_hole_or_crack_repair` | flat_rate | 6 | - | -$30..-$30 (4) | - |
| `washer_install` | flat_rate | 12 | - | -$65..-$65 (12) | - |
| `wi_fi_extender_setup` | flat_rate | 4 | +$5..+$5 (4) | - | - |
| `window_ac_setup` | flat_rate | 8 | - | -$65..-$65 (8) | - |
| `window_draft_sealing` | flat_rate | 8 | - | -$65..-$65 (8) | - |
| `window_hardware_repair` | flat_rate | 8 | - | -$65..-$65 (8) | - |
| `window_screen_repair` | flat_rate | 8 | - | -$65..-$65 (8) | - |
| `wood_paneling_repair` | flat_rate | 4 | - | -$30..-$30 (4) | - |
| `loose_tile_replacement` | hourly | 2 | - | - | - |
| `shelf_mortar_mounting_buy_the_hour` | hourly | 24 | - | -$54..-$271 (24) | - |
