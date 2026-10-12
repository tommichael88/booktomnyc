# T174 (PENDING_DECISIONS #201 and #205): the Computer Diagnostic as the registered diagnostic, measured before and after

Method: the tree at `6a85537` (#202, #161, #204 and #199 landed; #201 not) against the working tree with #205 and #201. Tools: `test_harness/tools/price_golden_master.js` (2,988 points), the real page in jsdom driven through every answer of the Computer Repair group's own triage (117 end states), the typed-phrase corpus through the orchestrator, and the new contract test `verify_computer_diagnostic_gateway.js` (red on the `6a85537` tree: `archive/T174_201_gateway_pre_fix.txt`; green after: `archive/T174_201_gateway_post_fix.txt`).

## 1. Golden master: 30 of 2,988 points move, all declared

```
compared 2988 price points: 30 differ across 7 (path|entity) pairs
  of those 30: 30 differ in a labor or minutes field
  fields that differ (count of records): orch-tags.laborEstimate 4, orch.laborEstimate 8, state-det.checkoutStateKey 4, state-det.laborCalc 4, state-tags.checkoutStateKey 4, state-tags.laborCalc 4, state.laborCalc 8, text.laborEstimate 2
```

Every point is `computer_diagnostic`, or `system_restore_or_reset` whose first-answer probe is routed (`route_to`) to the Computer Diagnostic. Each moves from a firm `standard_flat_rate` $231 (or $307 with the tags `#board_level`, `#data_recovery`, `#disposal_needed`) to the registered `diagnostic` state's hidden estimate $156 (or $232). The number a customer is charged is not that estimate: it is the $85 gateway fee of Path B, credited toward the repair (`global_rules.divergence_resolution`); the estimate is what Path A's price card shows after the second-path question. The other 2,958 points do not move. All 30:

```
state|computer_diagnostic|none|1  [231, 85] -> [156, 85]
orch|computer_diagnostic|none|1  [231, 85] -> [156, 85]
state|computer_diagnostic|none|2  [231, 85] -> [156, 85]
orch|computer_diagnostic|none|2  [231, 85] -> [156, 85]
state|computer_diagnostic|none|3  [231, 85] -> [156, 85]
orch|computer_diagnostic|none|3  [231, 85] -> [156, 85]
state|computer_diagnostic|none|5  [231, 85] -> [156, 85]
orch|computer_diagnostic|none|5  [231, 85] -> [156, 85]
state|computer_diagnostic|first|1  [231, 85] -> [156, 85]
state|computer_diagnostic|first|2  [231, 85] -> [156, 85]
state|computer_diagnostic|first|3  [231, 85] -> [156, 85]
state|computer_diagnostic|first|5  [231, 85] -> [156, 85]
orch|system_restore_or_reset|first|1  [231, 85] -> [156, 85]
orch|system_restore_or_reset|first|2  [231, 85] -> [156, 85]
orch|system_restore_or_reset|first|3  [231, 85] -> [156, 85]
orch|system_restore_or_reset|first|5  [231, 85] -> [156, 85]
state-tags|computer_diagnostic|A|1  [307, 110, false, false, "standard_flat_rate", "#board_level,#data_recovery,#disposal_needed"] -> [232, 110, false, false, "diagnostic", "#board_level,#data_recovery,#disposal_needed"]
orch-tags|computer_diagnostic|A|1  [307, 110, 100, 90, null, "#board_level,#data_recovery,#disposal_needed"] -> [232, 110, 100, 90, null, "#board_level,#data_recovery,#disposal_needed"]
state-det|computer_diagnostic|A|1  [231, 85, false, false, "standard_flat_rate", ""] -> [156, 85, false, false, "diagnostic", ""]
state-tags|computer_diagnostic|A|2  [307, 110, false, false, "standard_flat_rate", "#board_level,#data_recovery,#disposal_needed"] -> [232, 110, false, false, "diagnostic", "#board_level,#data_recovery,#disposal_needed"]
orch-tags|computer_diagnostic|A|2  [307, 110, 100, 90, null, "#board_level,#data_recovery,#disposal_needed"] -> [232, 110, 100, 90, null, "#board_level,#data_recovery,#disposal_needed"]
state-det|computer_diagnostic|A|2  [231, 85, false, false, "standard_flat_rate", ""] -> [156, 85, false, false, "diagnostic", ""]
state-tags|computer_diagnostic|B|1  [231, 85, false, false, "standard_flat_rate", "#new_charger,#new_fan,#power_supply"] -> [156, 85, false, false, "diagnostic", "#new_charger,#new_fan,#power_supply"]
orch-tags|computer_diagnostic|B|1  [231, 85, 100, 90, null, "#new_charger,#new_fan,#power_supply"] -> [156, 85, 100, 90, null, "#new_charger,#new_fan,#power_supply"]
state-det|computer_diagnostic|B|1  [231, 85, false, false, "standard_flat_rate", ""] -> [156, 85, false, false, "diagnostic", ""]
state-tags|computer_diagnostic|B|2  [231, 85, false, false, "standard_flat_rate", "#new_charger,#new_fan,#power_supply"] -> [156, 85, false, false, "diagnostic", "#new_charger,#new_fan,#power_supply"]
orch-tags|computer_diagnostic|B|2  [231, 85, 100, 90, null, "#new_charger,#new_fan,#power_supply"] -> [156, 85, 100, 90, null, "#new_charger,#new_fan,#power_supply"]
state-det|computer_diagnostic|B|2  [231, 85, false, false, "standard_flat_rate", ""] -> [156, 85, false, false, "diagnostic", ""]
text|computer_diagnostic|name  ["computer_diagnostic", "curated_card", 231, 85, 57, 1, ""] -> ["computer_diagnostic", "curated_card", 156, 85, 57, 1, ""]
text|computer_diagnostic|count  ["computer_diagnostic", "curated_card", 231, 85, 57, 1, ""] -> ["computer_diagnostic", "curated_card", 156, 85, 57, 1, ""]
```

## 2. The Computer Repair group's own triage on the real page (117 end states)

Every symptom tile x every device x the first unanswered question's every option, as a customer drives it (`archive/T174_201_walk_before.json`, `archive/T174_201_walk_after.json`).

| where the path ends | before | after |
|---|---|---|
| a part service (Computer Part Replacement), restore, malware removal or backup | 75 states, firm | the same 75 states, the same service at the same price, no Fork |
| the Computer Diagnostic, the triage finished | 23 states: firm **$231** ($273 for an all-in-one), no Fork, no credit | the **Fork in the Road**: "Answer a few more questions" / "Book an on-site diagnostic", **$85**, "fully credited toward any subsequent repair work" |
| the Computer Diagnostic, a question still open that could name the part | 19 states: firm $231 / $273 with the questions above it | the same questions, no Fork, no hourly estimate, the line "Please answer the questions above to see a quote." |

- **Path B** at every one of the 23 dead ends: "On-site diagnostic (flat rate): $85"; "Add to Request" puts $85 due today in the cart (every one of the 23 adds exactly $85).
- **Path A** at every dead end draws the new question, unanswered, and nothing that was already answered: "Have you or anyone else already tried to fix it?" (No / restarted, reset or reinstalled / opened up or a part replaced). The price card after it: $156 (the all-in-one $198), and $174 ($217) for "opened up or a part replaced" (the modifier's 10 minutes at the specialized rate; the same 10 minutes as `attempted_fix`'s "snaked it myself").
- The order matters and was chosen: with the Computer Diagnostic registered and nothing else changed, the Fork came **first** (before the Laptop/Desktop question), and the targeted questions of #180 were reachable only behind "Answer a few more questions" (18 checks of `verify_computer_repair_intake.js` went red). `orch_route_still_possible` keeps the Fork back while a question the customer has not yet been asked could name the part, and offers it when none can. It is read from the chain and the answers; it names no module and no service.

## 3. The 14 answers the ledger named

The ledger said the correction changes the price at the end of 14 of the 27 answers of the eight observation questions. Those 14 are the dead ends above; each now ends at the Fork, $85, with Path A drawing the new question where before it would have drawn nothing (the gap you named).

## 4. Typed phrases (16 phrases through `collectBookingContext_freeText` and `executeWorkflow`)

| typed phrase | before | after |
|---|---|---|
| my laptop wont turn on | dynamic fallback: the Fork ($85 credited) | dynamic fallback: the Fork ($85 credited) |
| laptop dead | computer_diagnostic: firm $231, asks laptop_power_signs | computer_diagnostic: asks laptop_power_signs first, then the Fork ($85 credited) |
| computer wont start | dynamic fallback: the Fork ($85 credited) | dynamic fallback: the Fork ($85 credited) |
| my computer is slow | computer_diagnostic: firm $231, asks device_type,slow_pattern | computer_diagnostic: asks device_type,slow_pattern first, then the Fork ($85 credited) |
| computer diagnostic | computer_diagnostic: firm $231, asks device_type,computer_symptom | computer_diagnostic: asks device_type,computer_symptom first, then the Fork ($85 credited) |
| laptop screen black but lights on | computer_diagnostic: firm $231, asks computer_symptom | computer_diagnostic: asks computer_symptom first, then the Fork ($85 credited) |
| desktop makes a loud noise and gets hot | computer_diagnostic: firm $231, asks heat_signs | computer_diagnostic: asks heat_signs first, then the Fork ($85 credited) |
| laptop battery drains fast | internal_hardware_replacement: firm $125 | internal_hardware_replacement: firm $125 |
| computer keeps crashing blue screen | computer_diagnostic: firm $231, asks device_type,computer_symptom | computer_diagnostic: asks device_type,computer_symptom first, then the Fork ($85 credited) |
| diagnose my computer | computer_diagnostic: firm $231, asks device_type,computer_symptom | computer_diagnostic: asks device_type,computer_symptom first, then the Fork ($85 credited) |
| fix my computer | computer_diagnostic: firm $231, asks device_type,computer_symptom | computer_diagnostic: asks device_type,computer_symptom first, then the Fork ($85 credited) |
| new power supply for my desktop | internal_hardware_replacement: firm $125 | internal_hardware_replacement: firm $125 |
| need more ram in my laptop | internal_hardware_replacement: firm $125 | internal_hardware_replacement: firm $125 |
| laptop stuck on loading screen | dynamic fallback: the Fork ($85 credited) | dynamic fallback: the Fork ($85 credited) |
| my pc smells like burning | computer_diagnostic: firm $231, asks device_type,computer_symptom | computer_diagnostic: asks device_type,computer_symptom first, then the Fork ($85 credited) |
| computer freezes at random | computer_diagnostic: firm $231, asks device_type,slow_pattern | computer_diagnostic: asks device_type,slow_pattern first, then the Fork ($85 credited) |

The three that reach the dynamic fallback (`tech_trouble+tech_trouble_computer_repair+Diagnostic`, base $85, diagnostic) were already the Fork, and are unchanged except for Path A's question: its `attempted_fix` (plumbing words) is now `computer_attempted_fix`. The part-service phrases are unchanged.

## 5. What this does not do (found, not fixed)

- The Fork's "N more questions" is the number of second-path modules (here one), not the number of questions Path A shows. Unchanged for the other 33 entities.
- After Path A the price card shows the hourly estimate ($156) with "Add to Request", as it does for the dishwasher ($422): the customer can book the estimate instead of the credited $85. That is the Fork's existing design for every registered diagnostic.
