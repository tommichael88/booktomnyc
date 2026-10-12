# Golden-master change, T174: an unaffirmed detected tag no longer prices through the answers it synthesizes (PENDING_DECISIONS #161)

**Authority.** The ledger's default for #161 was option (A2) "as its own ticket, first in the next session" (T164); the operator ordered it as the priority after #202 (2026-10-12 01:43 NY: "#161 ... still my first priority after T173 closes") and, on 2026-10-12 09:25 NY, handed the remaining landings to the session ("act entirely with my authority AND obey the Charter Playbook"). It is a rule the project already decided and states in its own comment (a detected tag is chargeable only once affirmed, or when the quote is confident without asking); this change makes the code obey it. It is the one change in the landing branch that moves quoted prices for services that have no other change.

**What the rule is now.** `resolveChargeableAnswers(answers, synthesizedModules, chargeableTagIds, DB)` (`qr.html`, a pure LOGIC function beside `synthesizeAnswersFromTags`): the answers as they would stand if only the chargeable tags (chosen and inherent, never merely detected) had spoken. `computeQuoteFromState` prices its gated quote from it; `orch_compute_quote` does the same on the orchestrator path (the record of what was synthesized is the one `executeWorkflow` made, the same pure function over the same inputs). The answer stays on the session: the question stays retired (`P-INTAKE-INFER`), and the moment the tag is affirmed (or the bar is met) the answer prices exactly as before.

**What moved.** 275 of the 2,988 golden points, in two families and nowhere else (`archive/T174_161_golden_compare.txt`):
- `state-det` (three detected tags, unaffirmed, the state path): 260 records on 71 services. Labor falls on 258 (median $100, maximum $483, because a set of three compounds) and is unchanged on 2 (minutes fall); no labor rises. 8 records change checkout state from `diagnostic` to `standard_flat_rate` (cabinet door or drawer adjustment, cabinet knob or pull install, furniture repair hourly, scratch or water ring removal): a detected tag's answer carried the diagnostic override, and it no longer applies until the tag is affirmed.
- `text` (typed requests that land on the tag-affirmation card): 15 records, the card's "From $" and minutes. These are the 15 of 34 the ledger predicted ("on 15 of the 34 the From $ differs once the gate holds").

| typed | lands on | tag(s) | "From $" before | after | minutes before | after |
|---|---|---|---|---|---|---|
| "high ceiling bulb replacement" (service name) | high_ceiling_bulb_replacement | #high_ceiling | $65 | $25 | 65 | 35 |
| "I need 3 high ceiling bulb replacement" (service name) | high_ceiling_bulb_replacement | #high_ceiling | $65 | $25 | 65 | 35 |
| "leak under sink repair" (service name) | leak_under_sink_repair | #emergency | $125 | $75 | 85 | 85 |
| "I need 3 leak under sink repair" (service name) | leak_under_sink_repair | #emergency | $125 | $75 | 85 | 85 |
| "slow drain clearing" (service name) | slow_drain_clearing | #clogged_drain | $95 | $70 | 110 | 80 |
| "I need 3 slow drain clearing" (service name) | slow_drain_clearing | #clogged_drain | $95 | $70 | 110 | 80 |
| "virus or malware removal" (service name) | virus_or_malware_removal | #tech_device_computer,#virus | $140 | $125 | 150 | 135 |
| "I need 3 virus or malware removal" (service name) | virus_or_malware_removal | #tech_device_computer,#virus | $140 | $125 | 150 | 135 |
| "my dishwasher is leaking" | dishwasher_repair | #emergency | $472 | $422 | 230 | 230 |
| "toilet keeps running" | toilet_flapper_or_fill_valve_replacement | #toilet_running | $55 | $45 | 65 | 55 |
| "hang a very heavy mirror on a brick wall" | brick_or_concrete_crack_repair | #brick_wall,#heavy_item,#two_person_required | $205 | $70 | 140 | 80 |
| "urgent leak under the sink tonight" | leak_under_sink_repair | #emergency | $125 | $75 | 85 | 85 |
| "unclog the bathtub drain" | dynamic | #clogged_drain | $90 | $65 | 105 | 75 |
| "repair a loose tile in the kitchen" | dynamic | #cracked_tile | $352 | $299 | 143 | 125 |
| "fix cabinet door hinge, not heavy" | cabinet_door_or_drawer_adjustment | #heavy_item | $145 | $35 | 115 | 75 |

**What did not move.** The other 2,713 points: every catalog price, every chosen-tag price (`state-tags`, `orch-tags`), every dynamic fallback, every guided-builder state, every other typed request.

**Measured against the whole catalog** (`archive/T174_161_detector_pre_fix.txt`, `archive/T174_161_detector_post_fix.txt`): of 1,108 (service, one detected tag valid for its category) pairs on the state path, 1,060 are unaffirmed with the bar unmet; **566 priced differently from the same session with no detected tag** before this change and **0** after. On the orchestrator path (typed entries, whose gate closes; a catalog tap is confident by construction and its gate never closes) 557 of 1,049 before, 0 after. These counts differ from the ledger's 526 of 1,014 because this measurement seeds the service's own default tags as inherent tags, as the page does, and counts one more valid tag per service; the shape of the result is the same.

**What this did not decide** (and why it is not folded in). The affirmation card still shows one number ("From $X"); `laborWithTags` (the price with the tag) is still produced and still read by nothing. Showing "with this tag" next to "without" is a design question the ledger filed in #161's last bullet; the price on the card is now the price of what the customer has said.

**Held by.** `test_harness/verify_unaffirmed_tag_cannot_price.js` (19 checks): the property over every pair on both paths and over 176 typed phrases (34 land on the card), affirmation prices what choosing the tag would on both paths, the answer stays on the session (821 answers), one definition with two call sites, five mutants of the page's own source (each fails the check that guards it), and the T173 tree red. The ledger's own count (526) was the ratchet; it is zero and a nonzero count fails.

**Reversible.** One function and two call sites. Reverting them restores the T173 prices exactly (the capture this change was measured against is the merged tree, `91c8958`; the T174 baseline is recorded after the last landing of the branch).
