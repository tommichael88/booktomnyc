# #250 -- typing a published service name (T197)

Input = the service's `ui_taxonomy.display_name`, typed through `collectBookingContext_freeText` -> `executeWorkflow` (tags affirmed). Expected = the service itself and the quote the same service gives from its own tile (nothing answered). Before = tree at e83dc963 (T196); after = the T197 tree. `[...]` = questions still open.

Before: 58 of 76 reach their own service. After: 76 of 76.

## The 18 that did not (before -> after)

| Input | Before: route, quote [open] | After: route, quote [open] | Service tile quote |
|---|---|---|---|
| Dryer Repair | dynamic(dryer) $198/90m standard_flat_rate [dryer_symptom] | dryer_repair $422/230m diagnostic [dryer_symptom] | $422/230m diagnostic |
| Stove or Range Repair | dynamic(stove) $198/90m standard_flat_rate [stove_symptom] | stove_repair $422/230m diagnostic [stove_symptom] | $422/230m diagnostic |
| Door Lock or Handle Install | dynamic(install) $70/80m standard_flat_rate [install_target,global_quantity] | door_lock_or_handle_install $50/60m standard_flat_rate [hardware_type] | $50/60m standard_flat_rate |
| Door Weatherstripping | dynamic(door) $198/90m standard_flat_rate [door_issue] | door_weatherstripping $55/65m standard_flat_rate [door_type] | $55/65m standard_flat_rate |
| Flatscreen Mounting with Hidden Cables | flatscreen_mounting_standard $60/70m standard_flat_rate [wall_type,mounting_height,mount_sourcing] | flatscreen_mounting_with_hidden_cables $150/160m standard_flat_rate [wall_type,mounting_height,inwall_power_for_tv,mount_sourcing] | $150/160m standard_flat_rate |
| Furniture Disassembly for Moving | dynamic(furniture) $210/120m standard_flat_rate [furniture_issue] | furniture_disassembly_for_moving $93/80m standard_flat_rate [item_type,hybrid_qty] | $54/50m standard_flat_rate |
| Furniture Repair ⏰ Buy-the-Hour | dynamic(furniture) $210/120m standard_flat_rate [furniture_issue] | furniture_repair_hourly $128/110m standard_flat_rate [furn_item,issue,hybrid_qty] | $128/110m standard_flat_rate |
| LED Bulb Upgrade | dynamic(light bulb) $45/55m standard_flat_rate [electrical_item] | led_bulb_upgrade $20/30m standard_flat_rate [item_count_template::light bulbs] | $20/30m standard_flat_rate |
| Loose Tile Replacement | dynamic(tile) $247/125m standard_flat_rate [floor_issue,disposal_request] | loose_tile_replacement $85/35m standard_flat_rate [tile_condition,waterproof_area,has_matching_tiles,hybrid_qty,disposal_request] | $85/35m standard_flat_rate |
| Scratch or Water Ring Removal from Furniture | dynamic(furniture) $222/130m standard_flat_rate [furniture_issue] | scratch_or_water_ring_removal $45/95m standard_flat_rate [damage_type,hybrid_qty] | $45/55m standard_flat_rate |
| Shelf Mortar Mounting ⏰ Buy-the-Hour | shelf_mounting_standard_buy_the_hour $159/70m standard_flat_rate [global_quantity] | shelf_mortar_mounting_buy_the_hour $304/130m standard_flat_rate [wall_mount_items,mounting_height,hybrid_qty] | $304/130m standard_flat_rate |
| System Restore or Reset | dynamic(other) $183/80m standard_flat_rate [surface_type] | system_restore_or_reset $125/135m standard_flat_rate [device_state] | $125/135m standard_flat_rate |
| Under-Cabinet Light Install | dynamic(install) $45/55m standard_flat_rate [electrical_item] | under_cabinet_light_install $70/80m standard_flat_rate [under_cabinet_length] | $70/80m standard_flat_rate |
| Wall Hole or Crack Repair | dynamic(drywall) $281/135m standard_flat_rate [surface_type] | wall_hole_or_crack_repair $90/135m standard_flat_rate [wall_type,item_count_template::walls,mounting_height,disposal_request] | $70/80m standard_flat_rate |
| Wall Mounting for Any Item | dynamic(mount) $65/60m standard_flat_rate [mounting_item,global_quantity] | generic_mounting_service $75/68m standard_flat_rate [mounting_item,wall_type,weight,global_quantity,mounting_height] | $75/68m standard_flat_rate |
| Window Draft Sealing | dynamic(window) $198/90m standard_flat_rate [window_issue] | window_draft_sealing $45/55m standard_flat_rate [item_count_template::windows] | $45/55m standard_flat_rate |
| Window Hardware Repair | dynamic(window) $198/90m standard_flat_rate [window_issue] | window_hardware_repair $55/65m standard_flat_rate [window_type,item_count_template::windows] | $55/65m standard_flat_rate |
| Wi-Fi Extender Setup | dynamic(install) $70/80m standard_flat_rate [install_target,global_quantity] | wi_fi_extender_setup $40/50m standard_flat_rate [item_count_template::Wi-Fi extenders] | $40/50m standard_flat_rate |

## Typed quote differs from the tile quote (after)

| Input | Typed | Tile | Why |
|---|---|---|---|
| Cabinet Door or Drawer Adjustment | $35/75m | $35/45m | the object's pricing formula (dynamic_rule) applied on top of the service's own price -- #251 |
| Furniture Disassembly for Moving | $93/80m | $54/50m | the object's pricing formula (dynamic_rule) applied on top of the service's own price -- #251 |
| Light Bulb Replacement in High Ceilings | $60/65m | $25/35m | the name says it: mounting_height = Needs a stepladder (high or vaulted ceiling) (#high_ceiling) |
| Under-Sink Leak Repair | $125/85m | $75/85m | the name says it: urgency = Urgent - today or tomorrow (#emergency) |
| Scratch or Water Ring Removal from Furniture | $45/95m | $45/55m | the name says it: issue = Surface damage (scratches, stains) (#scratched_surface) |
| Slow Drain Clearing | $105/110m | $70/80m | the name says it: drain_speed = Standing water - completely blocked (#clogged_drain) |
| Virus or Malware Removal | $145/150m | $125/135m | the name says it: tech_problem_type = Virus or pop-ups; tech_device = Computer (desktop or laptop) (#virus,#tech_device_computer) |
| Wall Hole or Crack Repair | $90/135m | $70/80m | the object's pricing formula (dynamic_rule) applied on top of the service's own price -- #251 |

## All 76 (after)

| Input | Reaches | Quote | Open questions |
|---|---|---|---|
| Angle Stop Replacement | itself | $60/70m standard_flat_rate | plumbing_fixture,angle_stop_condition |
| Baseboard Install | itself | $40/50m standard_flat_rate | baseboard_scope,baseboard_length,removal,disposal_request |
| Bathroom Exhaust Fan Replacement | itself | $80/90m standard_flat_rate | ducting,mounting_height |
| Bidet Attachment Install or Removal | itself | $70/80m standard_flat_rate | action,existing_toilet_type |
| Blinds, Shades or Curtains Install ⏰ Buy-the-Hour | itself | $50/60m standard_flat_rate | blind_curtain_shade_items,buy_the_hour_qty,wall_type,mounting_height |
| Brick or Concrete Crack Repair | itself | $70/80m standard_flat_rate | item_count_template::walls,mounting_height,disposal_request |
| Cabinet Door or Drawer Adjustment | itself | $35/75m standard_flat_rate | cabinet_issue,item_count_template::cabinet doors/drawers |
| Cabinet Knob or Pull Install | itself | $95/3m standard_flat_rate | install_type,hybrid_qty |
| Cable Management | itself | $35/45m standard_flat_rate | cable_install_item,mounting_height |
| Ceiling Fan Install | itself | $85/95m standard_flat_rate | existing_box,mounting_height |
| Chandelier or Pendant Install | itself | $90/100m standard_flat_rate | weight,mounting_height |
| Computer Diagnostic | itself | $156/85m diagnostic | device_type,computer_symptom |
| Data Backup or Transfer | itself | $99/109m standard_flat_rate | tech_issue_source,backup_source_device |
| Dimmer Switch Install | itself | $45/55m standard_flat_rate | item_count_template::light switches,switch_wiring |
| Dishwasher Repair | itself | $422/230m diagnostic | dishwasher_symptom |
| Dryer Repair | itself | $422/230m diagnostic | dryer_symptom |
| Stove or Range Repair | itself | $422/230m diagnostic | stove_symptom |
| Door Lock or Handle Install | itself | $50/60m standard_flat_rate | hardware_type |
| Door Impact-Damage Repair | itself | $115/125m standard_flat_rate | dmg_size |
| Door Weatherstripping | itself | $55/65m standard_flat_rate | door_type |
| Window AC Setup | itself | $70/80m standard_flat_rate | window_type,window_ac_support |
| Faucet Drip Repair | itself | $50/60m standard_flat_rate | faucet_type,faucet_part_available |
| Flatscreen Mounting | itself | $60/70m standard_flat_rate | wall_type,mounting_height,mount_sourcing |
| Flatscreen Mounting with Hidden Cables | itself | $150/160m standard_flat_rate | wall_type,mounting_height,inwall_power_for_tv,mount_sourcing |
| Flat-Pack Furniture Assembly | itself | $54/50m standard_flat_rate | assembly_complexity,global_quantity |
| Furniture Disassembly for Moving | itself | $93/80m standard_flat_rate | item_type,hybrid_qty |
| Furniture Repair ⏰ Buy-the-Hour | itself | $128/110m standard_flat_rate | furn_item,issue,hybrid_qty |
| Garbage Disposal Replacement | itself | $70/80m standard_flat_rate | disposal_size,wiring |
| GFCI Outlet Replacement | itself | $40/50m standard_flat_rate | gfci_location,item_count_template::GFCI outlets |
| Light Bulb Replacement in High Ceilings | itself | $60/65m project_based | item_count_template::light bulbs |
| Computer Part Replacement | itself | $125/135m standard_flat_rate | computer_component,device_type,customer_supplied_part |
| Under-Sink Leak Repair | itself | $125/85m standard_flat_rate | leak_loc,location,leak_type |
| LED Bulb Upgrade | itself | $20/30m standard_flat_rate | item_count_template::light bulbs |
| Light Fixture Replacement | itself | $60/70m standard_flat_rate | mounting_height |
| Loose Tile Replacement | itself | $85/35m standard_flat_rate | tile_condition,waterproof_area,has_matching_tiles,hybrid_qty,disposal_request |
| Microwave Repair | itself | $217/80m standard_flat_rate | appliance_type,location,microwave_symptom |
| Microwave Setup | itself | $70/80m standard_flat_rate | - |
| Plaster Wall Repair | itself | $80/90m standard_flat_rate | item_count_template::walls,mounting_height,project_scale,disposal_request |
| Prehung Interior Door Install | itself | $250/210m project_based | client_supplying_door,door_style_pref,existing_frame,door_wall_type,door_trim_scope,door_hardware_prep,door_finish |
| P-Trap Cleaning | itself | $50/60m standard_flat_rate | sink_type |
| Refrigerator Repair | itself | $217/80m standard_flat_rate | appliance_type,location,refrigerator_symptom |
| Refrigerator Water Line Install | itself | $75/85m standard_flat_rate | water_line_run |
| Router Setup | itself | $35/45m standard_flat_rate | router_owned,internet_active,mesh_network,item_count_template::devices |
| Scratch or Water Ring Removal from Furniture | itself | $45/95m standard_flat_rate | damage_type,hybrid_qty |
| Shelf Mortar Mounting ⏰ Buy-the-Hour | itself | $304/130m standard_flat_rate | wall_mount_items,mounting_height,hybrid_qty |
| Shelf Mounting ⏰ Buy-the-Hour | itself | $159/70m standard_flat_rate | global_quantity |
| Shower Head Replacement | itself | $30/40m standard_flat_rate | existing_type |
| Slow Drain Clearing | itself | $105/110m project_based | location,standing_water,attempted_fix,single_fixture_or_multiple |
| Smart Plug Setup | itself | $25/35m standard_flat_rate | item_count_template::smart plugs |
| Smart Speaker Setup | itself | $30/40m standard_flat_rate | brand,hybrid_qty |
| Smart Switch Install | itself | $50/60m standard_flat_rate | item_count_template::light switches |
| Software or Driver Install | itself | $50/60m standard_flat_rate | software_install_type |
| Squeaky Floor Repair | itself | $50/60m standard_flat_rate | floor_type,item_count_template::areas of floor,project_scale,disposal_request |
| System Restore or Reset | itself | $125/135m standard_flat_rate | device_state |
| Thermostat Replacement | itself | $45/55m standard_flat_rate | thermostat_type |
| Toilet Flapper or Fill Valve Replacement | itself | $45/55m standard_flat_rate | toilet_symptom |
| Toilet Install | itself | $100/75m project_based | removal,toilet_style_pref |
| Toilet Wax Ring Replacement | itself | $65/75m standard_flat_rate | leak_type |
| Tub Spout Replacement | itself | $35/45m standard_flat_rate | existing_type |
| Under-Cabinet Light Install | itself | $70/80m standard_flat_rate | under_cabinet_length |
| USB Outlet Install | itself | $45/55m standard_flat_rate | item_count_template::USB outlets |
| Virus or Malware Removal | itself | $145/150m standard_flat_rate | - |
| Wall Hole or Crack Repair | itself | $90/135m standard_flat_rate | wall_type,item_count_template::walls,mounting_height,disposal_request |
| Wall Mounting for Any Item | itself | $75/68m standard_flat_rate | mounting_item,wall_type,weight,global_quantity,mounting_height |
| Washer Install | itself | $70/80m standard_flat_rate | - |
| Washer Repair | itself | $217/80m standard_flat_rate | washer_type,location,symptom |
| Window Draft Sealing | itself | $45/55m standard_flat_rate | item_count_template::windows |
| Window Hardware Repair | itself | $55/65m standard_flat_rate | window_type,item_count_template::windows |
| Window Screen Repair | itself | $35/45m standard_flat_rate | item_count_template::window screens |
| Wi-Fi Extender Setup | itself | $40/50m standard_flat_rate | item_count_template::Wi-Fi extenders |
| Wood Paneling Repair | itself | $70/80m standard_flat_rate | item_count_template::walls,mounting_height,project_scale,disposal_request |
| PAX Wardrobe Assembly | itself | $142/100m standard_flat_rate | pax_cabinet_count,pax_hinge_count,pax_sliding_count,pax_interior_count,hybrid_qty |
| Toilet Seat Replacement | itself | $35/30m standard_flat_rate | existing_toilet_type |
| Dishwasher Install | itself | $70/80m standard_flat_rate | - |
| Refrigerator Install | itself | $70/80m standard_flat_rate | - |
| Window AC Repair | itself | $217/80m standard_flat_rate | location,window_ac_issue |
