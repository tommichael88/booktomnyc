# T174 (PENDING_DECISIONS #199): the appliance symptom questions, measured before and after

Method: the tree at `8c524a0` (before: #202, #161 and #204 landed, #199 not) against the working tree with #199 (after). Tools: `test_harness/tools/price_golden_master.js` (2,988 points), the engine read directly for the per-option quotes, the real page in jsdom for the tiles and chips, and the typed-phrase corpus through the orchestrator.

## 1. Golden master: 24 of 2,988 points move, all declared

```
compared 2988 price points: 24 differ across 6 (path|entity) pairs
  of those 24: 24 differ in a labor or minutes field
  fields that differ (count of records): orch.laborEstimate 12, orch.totalMin 12, state.laborCalc 12, state.totalMin 12
   state|microwave_repair|first|1 [356,145] -> [493,220]
   orch|microwave_repair|first|1 [356,145] -> [493,220]
   state|microwave_repair|first|2 [356,145] -> [493,220]
   orch|microwave_repair|first|2 [356,145] -> [493,220]
   state|microwave_repair|first|3 [356,145] -> [493,220]
   orch|microwave_repair|first|3 [356,145] -> [493,220]
   state|microwave_repair|first|5 [356,145] -> [493,220]
   orch|microwave_repair|first|5 [356,145] -> [493,220]
   state|repair_appliances|first|1 [356,145] -> [493,220]
   orch|repair_appliances|first|1 [356,145] -> [493,220]
   state|repair_appliances|first|2 [356,145] -> [493,220]
   orch|repair_appliances|first|2 [356,145] -> [493,220]
```

The 24 points are the `first` probe (the first answer of each service's chain, answered at quantities 1, 2, 3, 5) of the three services whose question changed, on both entry paths (state and orchestrator). The first answer is now a different option, so the quote is a different option's: `microwave_repair` and `repair_appliances` $356 / 145 min to $493 / 220 min (a diagnostic answer), `window_ac_repair` $299 / 125 min to $437 / 200 min (a diagnostic answer). No `none` probe and no dynamic-fallback probe moves; the other 2,964 points are identical.

## 2. Picker tiles

| group | tiles before (humanised ids) | tiles after (the module's own options) | module |
|---|---|---|---|
| washer | 4: Leaking water, Strange noises, Wont drain, Wont spin | 7: Won’t spin / no movement, Won’t drain (water stays inside), Leaking water, Making strange noises, Burning smell, Works intermittently, Trips breaker immediately | `symptom` |
| dryer | 5: Bad smell, Overheating, Runs constantly, Strange noises, Wont power on | 5: Won't power on, Overheating / getting too hot, Runs constantly / won't shut off, Making strange noises, Burning smell | `dryer_symptom` |
| stove_range | 3: Bad smell, Overheating, Wont power on | 3: Won't power on / no burners work, Overheating / burners too hot, Burning or gas smell | `stove_symptom` |
| refrigerator | 4: Leaking water, Strange noises, Wont drain, Wont spin | 6: Not cooling / food is warm, Freezer frosting up / ice build-up, Leaking water, Making strange noises, Ice maker or water dispenser not working, Burning smell | `refrigerator_symptom` |
| dishwasher | 4: Leaking water, Strange noises, Wont drain, Wont spin | 7: Won't fill with water, Won't drain / standing water inside, Won't clean dishes properly, Leaking water, Won't start / no lights on the panel, Making strange noises, Leaving residue or film on dishes | `dishwasher_symptom` |
| microwave | 4: Leaking water, Strange noises, Wont drain, Wont spin | 6: Runs but won't heat, Won't turn on / display is dead, Turntable won't turn, Sparks, arcing or burning smell, Making strange noises, Keypad or door latch not working | `microwave_symptom` |

The humanised ids ("Wont spin", "Bad smell") are gone: a tile is an option, in the option's own words, in the module's order. A tap carries the option as the answer to the question the group's repair service asks.

## 3. Guided builder chips (`bldGetConditionChoices('fix', group)`)

| group | chips before | chips after |
|---|---|---|
| appliances | 7: "Won’t spin / no movement","Won’t drain (water stays inside)","Leaking water","Making strange noises","Burning smell","Works intermittently","Trips br | 5: "Leaking water","Making strange noises","Burning smell","Works intermittently","Trips breaker immediately" |
| appliances_washer | 7: "Won’t spin / no movement","Won’t drain (water stays inside)","Leaking water","Making strange noises","Burning smell","Works intermittently","Trips br | 7: "Won’t spin / no movement","Won’t drain (water stays inside)","Leaking water","Making strange noises","Burning smell","Works intermittently","Trips breaker immediately" |
| appliances_dryer | 7: "Won’t spin / no movement","Won’t drain (water stays inside)","Leaking water","Making strange noises","Burning smell","Works intermittently","Trips br | 5: "Won't power on","Overheating / getting too hot","Runs constantly / won't shut off","Making strange noises","Burning smell" |
| appliances_stove_range | 7: "Won’t spin / no movement","Won’t drain (water stays inside)","Leaking water","Making strange noises","Burning smell","Works intermittently","Trips br | 3: "Won't power on / no burners work","Overheating / burners too hot","Burning or gas smell" |
| appliances_refrigerator | 7: "Won’t spin / no movement","Won’t drain (water stays inside)","Leaking water","Making strange noises","Burning smell","Works intermittently","Trips br | 6: "Not cooling / food is warm","Freezer frosting up / ice build-up","Leaking water","Making strange noises","Ice maker or water dispenser not working","Burning smell" |
| appliances_dishwasher | 7: "Won’t spin / no movement","Won’t drain (water stays inside)","Leaking water","Making strange noises","Burning smell","Works intermittently","Trips br | 7: "Won't fill with water","Won't drain / standing water inside","Won't clean dishes properly","Leaking water","Won't start / no lights on the panel","Making strange noises","Leaving residue or film on d |
| appliances_microwave | 7: "Won’t spin / no movement","Won’t drain (water stays inside)","Leaking water","Making strange noises","Burning smell","Works intermittently","Trips br | 6: "Runs but won't heat","Won't turn on / display is dead","Turntable won't turn","Sparks, arcing or burning smell","Making strange noises","Keypad or door latch not working" |
| appliances_window_ac | 7: "Won’t spin / no movement","Won’t drain (water stays inside)","Leaking water","Making strange noises","Burning smell","Works intermittently","Trips br | 8: "Not cooling properly","Won’t turn on / fan won’t spin","Leaking water","Freezing up / ice on the coil","Making strange noises","Burning smell","Works intermittently","Trips breaker immediately" |
| appliances_other | 7: "Won’t spin / no movement","Won’t drain (water stays inside)","Leaking water","Making strange noises","Burning smell","Works intermittently","Trips br | 5: "Leaking water","Making strange noises","Burning smell","Works intermittently","Trips breaker immediately" |

Before the declaration every appliance group offered the washer's seven options; the data repoint alone would have turned five of them into the 22 generic chips (`archive/T173_fallback_rendered_state_probe.txt`, section B); with the declaration none does.

## 4. Typed phrases (35 phrases through `collectBookingContext_freeText` and `executeWorkflow`)

The entity, the default price and the checkout state are the same before and after for every phrase (yes); what changes is the question the card asks. 18 of the phrases ask a different question:

| typed phrase | entity (same before and after) | questions asked before | questions asked after |
|---|---|---|---|
| my fridge is not cooling | service:repair_appliances | appliance_type,location,symptom | appliance_type,location,refrigerator_symptom |
| refrigerator leaking water | service:repair_appliances | appliance_type,location,symptom | appliance_type,location,refrigerator_symptom |
| fridge making a weird noise | service:repair_appliances | appliance_type,location,symptom | appliance_type,location,refrigerator_symptom |
| microwave not heating | dynamic:? | symptom | microwave_symptom |
| microwave sparking | service:microwave_repair | appliance_type,location,symptom | appliance_type,location,microwave_symptom |
| microwave turntable stuck | dynamic:? | symptom | microwave_symptom |
| microwave door will not close | service:microwave_repair | appliance_type,location,symptom | appliance_type,location,microwave_symptom |
| microwave wont turn on | dynamic:? | symptom | microwave_symptom |
| window ac not cooling | service:window_ac_repair | location,symptom | location,window_ac_issue |
| window ac wont turn on | service:window_ac_repair | location,symptom | location,window_ac_issue |
| dishwasher not draining | dynamic:? | symptom | dishwasher_symptom |
| dryer not heating | dynamic:? | symptom | dryer_symptom |
| dryer wont turn on | dynamic:? | symptom | dryer_symptom |
| oven not heating | dynamic:? | symptom | stove_symptom |
| fix my microwave | service:microwave_repair | appliance_type,location,symptom | appliance_type,location,microwave_symptom |
| fix my fridge | service:repair_appliances | appliance_type,location,symptom | appliance_type,location,refrigerator_symptom |
| fix my dryer | dynamic:? | symptom | dryer_symptom |
| fix my stove | dynamic:? | symptom | stove_symptom |

## A. The three services whose question changed: every option, quoted (other questions answered with their first option)

### repair_appliances: `symptom` -> `refrigerator_symptom`  ("What's the issue with the refrigerator?")

| option (after) | after | the same words before |
|---|---|---|
| Not cooling / food is warm | $493 / 220 min [diagnostic] | not offered before |
| Freezer frosting up / ice build-up | $438 / 190 min | not offered before |
| Leaking water | $493 / 220 min [diagnostic] | $493 / 220 min [diagnostic] |
| Making strange noises | $356 / 145 min | $356 / 145 min |
| Ice maker or water dispenser not working | $356 / 145 min | not offered before |
| Burning smell | $493 / 220 min [diagnostic] | $493 / 220 min [diagnostic] |
| Other (describe in notes) (no tile) | $273 / 100 min | not offered before |

Options the service no longer asks (washer-shaped), and what they quoted: "Won’t spin / no movement" $356 / 145 min; "Won’t drain (water stays inside)" $438 / 190 min [diagnostic]; "Works intermittently" $493 / 220 min [diagnostic]; "Trips breaker immediately" $493 / 220 min [diagnostic]

### microwave_repair: `symptom` -> `microwave_symptom`  ("What's the issue with the microwave?")

| option (after) | after | the same words before |
|---|---|---|
| Runs but won't heat | $493 / 220 min [diagnostic] | not offered before |
| Won't turn on / display is dead | $493 / 220 min [diagnostic] | not offered before |
| Turntable won't turn | $356 / 145 min | not offered before |
| Sparks, arcing or burning smell | $493 / 220 min [diagnostic] | not offered before |
| Making strange noises | $356 / 145 min | $356 / 145 min |
| Keypad or door latch not working | $356 / 145 min | not offered before |
| Other (describe in notes) (no tile) | $273 / 100 min | not offered before |

Options the service no longer asks (washer-shaped), and what they quoted: "Won’t spin / no movement" $356 / 145 min; "Won’t drain (water stays inside)" $438 / 190 min [diagnostic]; "Leaking water" $493 / 220 min [diagnostic]; "Burning smell" $493 / 220 min [diagnostic]; "Works intermittently" $493 / 220 min [diagnostic]; "Trips breaker immediately" $493 / 220 min [diagnostic]

### window_ac_repair: `symptom` -> `window_ac_issue`  ("What’s the issue with the window AC?")

| option (after) | after | the same words before |
|---|---|---|
| Not cooling properly | $437 / 200 min [diagnostic] | not offered before |
| Won’t turn on / fan won’t spin | $299 / 125 min | not offered before |
| Leaking water | $437 / 200 min [diagnostic] | $437 / 200 min [diagnostic] |
| Freezing up / ice on the coil | $382 / 170 min | not offered before |
| Making strange noises | $299 / 125 min | $299 / 125 min |
| Burning smell | $437 / 200 min [diagnostic] | $437 / 200 min [diagnostic] |
| Works intermittently | $437 / 200 min [diagnostic] | $437 / 200 min [diagnostic] |
| Trips breaker immediately | $437 / 200 min [diagnostic] | $437 / 200 min [diagnostic] |
| Other (describe in notes) (no tile) | $217 / 80 min | not offered before |

Options the service no longer asks (washer-shaped), and what they quoted: "Won’t spin / no movement" $299 / 125 min; "Won’t drain (water stays inside)" $382 / 170 min [diagnostic]

## B. The fallbacks whose question changed: the same words must quote the same (a repoint is not a price change)

36 (fallback, option) pairs whose words exist in both modules: 36 quote the same, 0 move.

- `Diagnostic`: `symptom` -> `general_symptom`
- `minor_home_repairs_appliances+Diagnostic`: `symptom` -> `general_symptom`
- `minor_home_repairs_appliances+Repair`: `symptom` -> `general_symptom`
- `minor_home_repairs_appliances_dryer+Diagnostic`: `symptom` -> `dryer_symptom`
- `minor_home_repairs_appliances_dryer+Repair`: `symptom` -> `dryer_symptom`
- `minor_home_repairs_appliances_stove_range+Diagnostic`: `symptom` -> `stove_symptom`
- `minor_home_repairs_appliances_stove_range+Repair`: `symptom` -> `stove_symptom`
- `minor_home_repairs_appliances_refrigerator+Diagnostic`: `symptom` -> `refrigerator_symptom`
- `minor_home_repairs_appliances_refrigerator+Repair`: `symptom` -> `refrigerator_symptom`
- `minor_home_repairs_appliances_dishwasher+Diagnostic`: `symptom` -> `dishwasher_symptom`
- `minor_home_repairs_appliances_dishwasher+Repair`: `symptom` -> `dishwasher_symptom`
- `minor_home_repairs_appliances_microwave+Diagnostic`: `symptom` -> `microwave_symptom`
- `minor_home_repairs_appliances_microwave+Repair`: `symptom` -> `microwave_symptom`
- `minor_home_repairs_appliances_other+Diagnostic`: `symptom` -> `general_symptom`

