# T180 (8/n): the time model, measured (PENDING_DECISIONS #229 / #234)

Measured on the production quote path (`computeQuoteFromState`) on the catalog at `ecaa28a1` plus the T180 8/n tag change, which does not touch these numbers. Nothing here changed a price. Sweep: the 59 flat-rate services, each answer of each question in the service's intake chain applied alone. "Rate" figures are dollars per hour of the time an answer adds.

## 1. The authored baseline of the 59 flat-rate services

| service | authored minutes | flat price | implied $/h at the midpoint |
|---|---|---|---|
| `prehung_interior_door_install` | 475-925 | $150 | $13 |
| `toilet_install` | 200-525 | $100 | $17 |
| `flatscreen_mounting_with_hidden_cables` | 150-170 | $150 | $56 |
| `internal_hardware_replacement` | 125-145 | $125 | $56 |
| `system_restore_or_reset` | 125-145 | $125 | $56 |
| `virus_or_malware_removal` | 125-145 | $125 | $56 |
| `door_repair_impact_damage` | 115-135 | $115 | $55 |
| `data_backup_or_transfer` | 99-119 | $99 | $54 |
| `chandelier_or_pendant_install` | 90-110 | $90 | $54 |
| `ceiling_fan_install` | 85-105 | $85 | $54 |
| `bathroom_exhaust_fan_replacement` | 80-100 | $80 | $53 |
| `plaster_wall_repair` | 80-100 | $80 | $53 |
| `leak_under_sink_repair` | 75-95 | $75 | $53 |
| `refrigerator_water_line_install` | 75-95 | $75 | $53 |
| `bidet_attachment_install_or_removal` | 70-90 | $70 | $53 |
| `brick_or_concrete_crack_repair` | 70-90 | $70 | $53 |
| `window_ac_setup` | 70-90 | $70 | $53 |
| `garbage_disposal_replacement` | 70-90 | $70 | $53 |
| `microwave_setup` | 70-90 | $70 | $53 |
| `slow_drain_clearing` | 70-90 | $70 | $53 |
| `under_cabinet_light_install` | 70-90 | $70 | $53 |
| `wall_hole_or_crack_repair` | 70-90 | $70 | $53 |
| `washer_install` | 70-90 | $70 | $53 |
| `wood_paneling_repair` | 70-90 | $70 | $53 |
| `dishwasher_install` | 70-90 | $70 | $53 |
| `refrigerator_install` | 70-90 | $70 | $53 |
| `toilet_wax_ring_replacement` | 65-85 | $65 | $52 |
| `angle_stop_replacement` | 60-80 | $60 | $51 |
| `flatscreen_mounting_standard` | 60-80 | $60 | $51 |
| `light_fixture_replacement` | 60-80 | $60 | $51 |
| `generic_mounting_service` | 45-90 | $75 | $67 |
| `door_weatherstripping` | 55-75 | $55 | $51 |
| `window_hardware_repair` | 55-75 | $55 | $51 |
| `door_lock_or_handle_install` | 50-70 | $50 | $50 |
| `faucet_repair_drip` | 50-70 | $50 | $50 |
| `p_trap_cleaning` | 50-70 | $50 | $50 |
| `smart_switch_install` | 50-70 | $50 | $50 |
| `software_or_driver_install` | 50-70 | $50 | $50 |
| `squeaky_floor_repair` | 50-70 | $50 | $50 |
| `dimmer_switch_install` | 45-65 | $45 | $49 |
| `scratch_or_water_ring_removal` | 45-65 | $45 | $49 |
| `thermostat_replacement` | 45-65 | $45 | $49 |
| `toilet_flapper_or_fill_valve_replacement` | 45-65 | $45 | $49 |
| `usb_outlet_install` | 45-65 | $45 | $49 |
| `window_draft_sealing` | 45-65 | $45 | $49 |
| `baseboard_install` | 40-60 | $40 | $48 |
| `gfci_outlet_replacement` | 40-60 | $40 | $48 |
| `wi_fi_extender_setup` | 40-60 | $40 | $48 |
| `cabinet_door_or_drawer_adjustment` | 35-55 | $35 | $47 |
| `cable_management` | 35-55 | $35 | $47 |
| `router_configuration` | 35-55 | $35 | $47 |
| `tub_spout_replacement` | 35-55 | $35 | $47 |
| `window_screen_repair` | 35-55 | $35 | $47 |
| `shower_head_replacement` | 30-50 | $30 | $45 |
| `smart_speaker_setup` | 30-50 | $30 | $45 |
| `high_ceiling_bulb_replacement` | 25-45 | $25 | $43 |
| `smart_plug_configuration` | 25-45 | $25 | $43 |
| `led_bulb_upgrade` | 20-40 | $20 | $40 |
| `toilet_seat_replacement` | 20-30 | $35 | $84 |

Midpoint 60 minutes or less: 26; 61 to 120: 26; over 120: 7. The two with an implied rate under $20 an hour (`prehung_interior_door_install`, `toilet_install`) look like errors in the minutes or the price.

## 2. Answers that change the minutes or the fee (108 answers, 40 services)

| service | question | answer | + minutes | + fee (authored) | minutes at $70/h | difference |
|---|---|---|---|---|---|---|
| `angle_stop_replacement` | `angle_stop_condition` | Stuck or corroded (may need extra work) | 30 | $25 | $35 | +10 |
| `baseboard_install` | `baseboard_length` | About one average room (a bedroom or living room) | 45 | $55 | $53 | -2 |
| `baseboard_install` | `baseboard_length` | Two or more rooms | 100 | $125 | $117 | -8 |
| `baseboard_install` | `removal` | Yes, remove and haul away | 20 | $25 | $23 | -2 |
| `bathroom_exhaust_fan_replacement` | `ducting` | Yes - it vents outside | 0 | $25 | $0 | -25 |
| `bathroom_exhaust_fan_replacement` | `ducting` | No - it’s recirculating (no duct) | 0 | $50 | $0 | -50 |
| `bathroom_exhaust_fan_replacement` | `mounting_height` | Needs a stepladder (high or vaulted ceiling) | 30 | $40 | $35 | -5 |
| `bathroom_exhaust_fan_replacement` | `mounting_height` | Needs an extension ladder or scaffold (stairwell, two-story or cathedral ceiling) | 60 | $100 | $70 | -30 |
| `bidet_attachment_install_or_removal` | `existing_toilet_type` | Commercial flushometer (no tank, flush valve) | 45 | $75 | $53 | -22 |
| `brick_or_concrete_crack_repair` | `mounting_height` | Needs a stepladder (high or vaulted ceiling) | 30 | $40 | $35 | -5 |
| `brick_or_concrete_crack_repair` | `mounting_height` | Needs an extension ladder or scaffold (stairwell, two-story or cathedral ceiling) | 60 | $100 | $70 | -30 |
| `cabinet_door_or_drawer_adjustment` | `cabinet_issue` | Hinge is loose or squeaky | 10 | $0 | $12 | +12 |
| `cabinet_door_or_drawer_adjustment` | `cabinet_issue` | Drawer sticks or doesn't slide smoothly | 15 | $0 | $18 | +18 |
| `cabinet_door_or_drawer_adjustment` | `cabinet_issue` | Cabinet face or door is scratched or scuffed | 15 | $0 | $18 | +18 |
| `cabinet_door_or_drawer_adjustment` | `cabinet_issue` | Cabinet door won't stay closed | 15 | $15 | $18 | +3 |
| `cable_management` | `mounting_height` | Needs a stepladder (high or vaulted ceiling) | 30 | $40 | $35 | -5 |
| `cable_management` | `mounting_height` | Needs an extension ladder or scaffold (stairwell, two-story or cathedral ceiling) | 60 | $100 | $70 | -30 |
| `ceiling_fan_install` | `existing_box` | No / I’m not sure (may need a new box) | 32 | $40 | $37 | -3 |
| `ceiling_fan_install` | `mounting_height` | Needs a stepladder (high or vaulted ceiling) | 30 | $40 | $35 | -5 |
| `ceiling_fan_install` | `mounting_height` | Needs an extension ladder or scaffold (stairwell, two-story or cathedral ceiling) | 60 | $100 | $70 | -30 |
| `chandelier_or_pendant_install` | `weight` | 20 to 50 lbs (moderate) | 20 | $25 | $23 | -2 |
| `chandelier_or_pendant_install` | `weight` | Over 50 lbs (heavy) | 40 | $110 | $47 | -63 |
| `chandelier_or_pendant_install` | `mounting_height` | Needs a stepladder (high or vaulted ceiling) | 30 | $40 | $35 | -5 |
| `chandelier_or_pendant_install` | `mounting_height` | Needs an extension ladder or scaffold (stairwell, two-story or cathedral ceiling) | 60 | $100 | $70 | -30 |
| `data_backup_or_transfer` | `tech_issue_source` | Files may already be lost or corrupted - need recovery | 25 | $30 | $29 | -1 |
| `dimmer_switch_install` | `switch_wiring` | 3-way or multi-location (two or more switches control the same light) | 15 | $20 | $18 | -2 |
| `door_repair_impact_damage` | `dmg_size` | Medium (about the size of a sheet of paper) | 15 | $15 | $18 | +3 |
| `door_repair_impact_damage` | `dmg_size` | Large (bigger than a sheet of paper) | 25 | $35 | $29 | -6 |
| `window_ac_setup` | `window_ac_support` | Yes - upper floor or needs bracket/support | 20 | $25 | $23 | -2 |
| `faucet_repair_drip` | `faucet_type` | Ceramic disc (modern cartridge) | 15 | $10 | $18 | +8 |
| `faucet_repair_drip` | `faucet_part_available` | No - I don't have it yet | 20 | $20 | $23 | +3 |
| `faucet_repair_drip` | `faucet_part_available` | Not sure what part I need | 20 | $20 | $23 | +3 |
| `flatscreen_mounting_standard` | `wall_type` | Brick or concrete | 20 | $25 | $23 | -2 |
| `flatscreen_mounting_standard` | `weight` | 20 to 50 lbs (moderate) | 20 | $25 | $23 | -2 |
| `flatscreen_mounting_standard` | `weight` | Over 50 lbs (heavy) | 40 | $110 | $47 | -63 |
| `flatscreen_mounting_standard` | `mounting_height` | Needs a stepladder (high or vaulted ceiling) | 30 | $40 | $35 | -5 |
| `flatscreen_mounting_standard` | `mounting_height` | Needs an extension ladder or scaffold (stairwell, two-story or cathedral ceiling) | 60 | $100 | $70 | -30 |
| `flatscreen_mounting_standard` | `mount_sourcing` | Please bring one to install | 10 | $54 | $12 | -42 |
| `flatscreen_mounting_with_hidden_cables` | `wall_type` | Brick or concrete | 20 | $25 | $23 | -2 |
| `flatscreen_mounting_with_hidden_cables` | `weight` | 20 to 50 lbs (moderate) | 20 | $25 | $23 | -2 |
| `flatscreen_mounting_with_hidden_cables` | `weight` | Over 50 lbs (heavy) | 40 | $110 | $47 | -63 |
| `flatscreen_mounting_with_hidden_cables` | `mounting_height` | Needs a stepladder (high or vaulted ceiling) | 30 | $40 | $35 | -5 |
| `flatscreen_mounting_with_hidden_cables` | `mounting_height` | Needs an extension ladder or scaffold (stairwell, two-story or cathedral ceiling) | 60 | $100 | $70 | -30 |
| `flatscreen_mounting_with_hidden_cables` | `inwall_power_for_tv` | No - need to add a new outlet or relocate one | 75 | $95 | $88 | -7 |
| `flatscreen_mounting_with_hidden_cables` | `mount_sourcing` | Please bring one to install | 10 | $54 | $12 | -42 |
| `garbage_disposal_replacement` | `disposal_size` | 3/4 HP or 1 HP (heavy-duty) | 20 | $0 | $23 | +23 |
| `garbage_disposal_replacement` | `wiring` | Hardwired (connected to house wiring) | 16 | $20 | $19 | -1 |
| `garbage_disposal_replacement` | `wiring` | Not sure - describe in notes (may add time) | 16 | $20 | $19 | -1 |
| `gfci_outlet_replacement` | `gfci_location` | Outdoor or exposed to weather | 20 | $15 | $23 | +8 |
| `high_ceiling_bulb_replacement` | `mounting_height` | Needs a stepladder (high or vaulted ceiling) | 30 | $40 | $35 | -5 |
| `high_ceiling_bulb_replacement` | `mounting_height` | Needs an extension ladder or scaffold (stairwell, two-story or cathedral ceiling) | 60 | $100 | $70 | -30 |
| `internal_hardware_replacement` | `device_type` | All-in-one | 15 | $15 | $18 | +3 |
| `internal_hardware_replacement` | `customer_supplied_part` | No - I need you to source it | 20 | $20 | $23 | +3 |
| `light_fixture_replacement` | `mounting_height` | Needs a stepladder (high or vaulted ceiling) | 30 | $40 | $35 | -5 |
| `light_fixture_replacement` | `mounting_height` | Needs an extension ladder or scaffold (stairwell, two-story or cathedral ceiling) | 60 | $100 | $70 | -30 |
| `plaster_wall_repair` | `mounting_height` | Needs a stepladder (high or vaulted ceiling) | 30 | $40 | $35 | -5 |
| `plaster_wall_repair` | `mounting_height` | Needs an extension ladder or scaffold (stairwell, two-story or cathedral ceiling) | 60 | $100 | $70 | -30 |
| `plaster_wall_repair` | `project_scale` | Moderate - standard repair, a few items | 45 | $0 | $53 | +53 |
| `plaster_wall_repair` | `project_scale` | Major - extensive damage or large area | 120 | $0 | $140 | +140 |
| `prehung_interior_door_install` | `client_supplying_door` | No, I need you to procure it | 45 | $0 | $53 | +53 |
| `prehung_interior_door_install` | `door_style_pref` | Solid core - medium (~60 lbs), better sound insulation | 15 | $0 | $18 | +18 |
| `prehung_interior_door_install` | `door_style_pref` | Solid wood - heavy (~90 lbs), premium | 30 | $0 | $35 | +35 |
| `prehung_interior_door_install` | `existing_frame` | No (Requires demo) | 40 | $50 | $47 | -3 |
| `prehung_interior_door_install` | `door_wall_type` | Plaster (older homes) | 40 | $35 | $47 | +12 |
| `prehung_interior_door_install` | `door_trim_scope` | Replace with new trim | 60 | $45 | $70 | +25 |
| `prehung_interior_door_install` | `door_hardware_prep` | New lock or deadbolt needed | 45 | $30 | $53 | +23 |
| `prehung_interior_door_install` | `door_finish` | Pro should prime/paint | 60 | $40 | $70 | +30 |
| `refrigerator_water_line_install` | `water_line_run` | Across the kitchen (a few cabinets or an open stretch of floor away) | 20 | $25 | $23 | -2 |
| `refrigerator_water_line_install` | `water_line_run` | In another room, or the line has to go through a wall or floor | 0 | $50 | $0 | -50 |
| `router_configuration` | `router_owned` | No - I need help buying one | 15 | $0 | $18 | +18 |
| `router_configuration` | `internet_active` | No - but I have an active account | 10 | $10 | $12 | +2 |
| `router_configuration` | `internet_active` | I'm not sure - might be a provider issue | 5 | $0 | $6 | +6 |
| `router_configuration` | `mesh_network` | Mesh network (2+ nodes) | 20 | $20 | $23 | +3 |
| `scratch_or_water_ring_removal` | `damage_type` | Water ring / moisture stain | 20 | $25 | $23 | -2 |
| `shower_head_replacement` | `existing_type` | Not sure - the tech can check (may add time) | 15 | $10 | $18 | +8 |
| `slow_drain_clearing` | `drain_speed` | Very slow - water pools for over 10 minutes | 15 | $10 | $18 | +8 |
| `slow_drain_clearing` | `drain_speed` | Standing water - completely blocked | 30 | $25 | $35 | +10 |
| `slow_drain_clearing` | `standing_water` | Yes - a little (under 1 inch) | 5 | $5 | $6 | +1 |
| `slow_drain_clearing` | `standing_water` | Yes - a lot (over 1 inch) | 10 | $15 | $12 | -3 |
| `slow_drain_clearing` | `attempted_fix` | Yes - used chemical drain cleaner | 5 | $0 | $6 | +6 |
| `slow_drain_clearing` | `attempted_fix` | Yes - snaked it myself | 10 | $0 | $12 | +12 |
| `slow_drain_clearing` | `single_fixture_or_multiple` | Multiple fixtures | 15 | $20 | $18 | -2 |
| `software_or_driver_install` | `software_install_type` | Operating system (Windows/macOS reinstall) | 60 | $30 | $70 | +40 |
| `squeaky_floor_repair` | `project_scale` | Moderate - standard repair, a few items | 45 | $0 | $53 | +53 |
| `squeaky_floor_repair` | `project_scale` | Major - extensive damage or large area | 120 | $0 | $140 | +140 |
| `thermostat_replacement` | `thermostat_type` | Smart thermostat (Wi-Fi, app controlled) | 15 | $15 | $18 | +3 |
| `toilet_flapper_or_fill_valve_replacement` | `toilet_symptom` | Runs constantly / won't stop | 10 | $10 | $12 | +2 |
| `toilet_install` | `removal` | Yes, remove and haul away | 20 | $25 | $23 | -2 |
| `tub_spout_replacement` | `existing_type` | Not sure - the tech can check (may add time) | 15 | $10 | $18 | +8 |
| `under_cabinet_light_install` | `under_cabinet_length` | One wall of cabinets (a typical kitchen run) | 30 | $40 | $35 | -5 |
| `under_cabinet_light_install` | `under_cabinet_length` | Cabinets on two or more walls (an L- or U-shaped kitchen) | 75 | $95 | $88 | -7 |
| `virus_or_malware_removal` | `tech_problem_type` | Virus or pop-ups | 15 | $15 | $18 | +3 |
| `virus_or_malware_removal` | `tech_problem_type` | Lost or corrupted files | 25 | $30 | $29 | -1 |
| `wall_hole_or_crack_repair` | `wall_type` | Brick or concrete | 20 | $25 | $23 | -2 |
| `wall_hole_or_crack_repair` | `dmg_size` | Medium (about the size of a sheet of paper) | 15 | $15 | $18 | +3 |
| `wall_hole_or_crack_repair` | `dmg_size` | Large (bigger than a sheet of paper) | 25 | $35 | $29 | -6 |
| `wall_hole_or_crack_repair` | `mounting_height` | Needs a stepladder (high or vaulted ceiling) | 30 | $40 | $35 | -5 |
| `wall_hole_or_crack_repair` | `mounting_height` | Needs an extension ladder or scaffold (stairwell, two-story or cathedral ceiling) | 60 | $100 | $70 | -30 |
| `generic_mounting_service` | `wall_type` | Brick or concrete | 20 | $25 | $23 | -2 |
| `generic_mounting_service` | `weight` | 20 to 50 lbs (moderate) | 20 | $25 | $23 | -2 |
| `generic_mounting_service` | `weight` | Over 50 lbs (heavy) | 40 | $110 | $47 | -63 |
| `generic_mounting_service` | `mounting_height` | Needs a stepladder (high or vaulted ceiling) | 30 | $40 | $35 | -5 |
| `generic_mounting_service` | `mounting_height` | Needs an extension ladder or scaffold (stairwell, two-story or cathedral ceiling) | 60 | $100 | $70 | -30 |
| `wood_paneling_repair` | `mounting_height` | Needs a stepladder (high or vaulted ceiling) | 30 | $40 | $35 | -5 |
| `wood_paneling_repair` | `mounting_height` | Needs an extension ladder or scaffold (stairwell, two-story or cathedral ceiling) | 60 | $100 | $70 | -30 |
| `wood_paneling_repair` | `project_scale` | Moderate - standard repair, a few items | 45 | $0 | $53 | +53 |
| `wood_paneling_repair` | `project_scale` | Major - extensive damage or large area | 120 | $0 | $140 | +140 |
| `toilet_seat_replacement` | `existing_toilet_type` | Commercial flushometer (no tank, flush valve) | 40 | $75 | $47 | -28 |

Added minutes at $70 an hour against the authored fee: higher 42, lower 66, equal 0; median absolute difference $7; within $10: 64. Add time and no fee today (free time): 17. Add a fee and no time: 3.

## 3. The "how many" questions on flat-rate services: 21 (CORRECTED in T182: the claim below that none changes the price or the minutes was wrong)

> **Correction (T182, #229 / #234).** The original heading said none of these 21 questions changes the price or the minutes. That is wrong. Every band after the first (one unit, which carries no modifier) carries a per-unit fee AND per-unit minutes, for example `plaster_wall_repair`, "2 walls": $80 and 60 minutes; "5 or more walls": $320 and 240 minutes, plus the overflow rate beyond the anchor. The sweep missed them. Under the time model the count answers are priced by their authored minutes at the flat-rate time price, as written: there is no separate "the baseline again for each extra unit" rule. For the four wall services that is the Operator's "n walls cost n x the base" (#80) exactly, because 60 minutes at $70/h is $70, their base; `plaster_wall_repair` has an $80 base, so its count minutes were set to 69 / 137 / 206 / 274 to keep $80 a wall (`archive/golden_change_T182_time_model.md`). Where the authored count minutes disagreed with a price the owner had already decided, the minutes were set to carry the decided price rather than the other way round: the nine uniform-10%-rule overflow rates (a dimmer switch beyond the anchor is $4.50, and its 12 placeholder minutes would have charged $14; it is now 4 minutes) and `squeaky_floor_repair` (rule #80, "n x base": $50 an area, so 43 minutes an area, not 60). Every other count band's minutes already price within $5 of its fee (measured over all 18 flat-rate services that ask a count). The levers are the minutes on those 14 modifiers.

- `brick_or_concrete_crack_repair` / item_count_template: "How many {item_noun} need service?"
- `cabinet_door_or_drawer_adjustment` / item_count_template: "How many {item_noun} need service?"
- `dimmer_switch_install` / item_count_template: "How many {item_noun} need service?"
- `gfci_outlet_replacement` / item_count_template: "How many {item_noun} need service?"
- `high_ceiling_bulb_replacement` / item_count_template: "How many {item_noun} need service?"
- `led_bulb_upgrade` / item_count_template: "How many {item_noun} need service?"
- `plaster_wall_repair` / item_count_template: "How many {item_noun} need service?"
- `router_configuration` / item_count_template: "How many {item_noun} need service?"
- `scratch_or_water_ring_removal` / hybrid_qty: "How many units/items require service?"
- `smart_plug_configuration` / item_count_template: "How many {item_noun} need service?"
- `smart_speaker_setup` / hybrid_qty: "How many units/items require service?"
- `smart_switch_install` / item_count_template: "How many {item_noun} need service?"
- `squeaky_floor_repair` / item_count_template: "How many {item_noun} need service?"
- `usb_outlet_install` / item_count_template: "How many {item_noun} need service?"
- `wall_hole_or_crack_repair` / item_count_template: "How many {item_noun} need service?"
- `generic_mounting_service` / global_quantity: "How many units/items?"
- `window_draft_sealing` / item_count_template: "How many {item_noun} need service?"
- `window_hardware_repair` / item_count_template: "How many {item_noun} need service?"
- `window_screen_repair` / item_count_template: "How many {item_noun} need service?"
- `wi_fi_extender_setup` / item_count_template: "How many {item_noun} need service?"
- `wood_paneling_repair` / item_count_template: "How many {item_noun} need service?"
