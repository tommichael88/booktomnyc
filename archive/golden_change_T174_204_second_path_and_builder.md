# Golden-master change record, T174 (#204): the second path, Path A's question, and the guided builder's condition

**What changed (three things, one cause: an answer the catalog says "needs a look first" did not reach the customer as such).**

1. *Data (`btnyc.json`, `dynamic_services` and `compiled.service_index`).* Twelve diagnostic-capable dynamic entities had no second path (`remote_deep_dive_modules`), so the Fork in the Road could not be offered: nine "Repair" fallbacks whose answers carry `checkout_state_override: diagnostic` (the general appliance, washer, dryer, stove/range, refrigerator, dishwasher, microwave, window AC and the furniture fallback) and the three category-level "Diagnostic" entries (`minor_home_repairs`, `plumbing_help`, `tech_trouble`). Each now authors the second path its siblings already carry: `attempted_fix` (the project's universal one), plus `appliance_type` on the two general-appliance entries (as `minor_home_repairs_appliances+Diagnostic` has). No new wording, no new modifier, no figure.
2. *Code, Path A (`qr.html`).* "Answer a few more questions" drew nothing new on **any** service (nine of nine, measured on the T173 tree): the route's `visibleChain` is resolved before the second-path question is spliced onto the intake chain, and the card draws `visibleChain`. `orch_splice_remote_deep_dive` now re-resolves it with the filter `executeWorkflow` uses. And `orch_apply_remote_divergence` re-ran on a CATALOG context rebuilt from the entity, which only a named service has; it now re-runs on the context the route carries (T145), as `orch_apply_answer` does, so a dynamic fallback's card gets its question too.
3. *Code, the guided builder (`qr.html`).* The chip the customer picks ("Leaking water") reached the price only as words in the ad-lib description. `resolveBuilderConditionAnswer` (LOGIC) finds the question the priced entity asks that the chip answers, and `sqBuilderFinish` records it as `S.answers[module]`, so the option's modifier and its checkout state price as they do on every other path.

## The price golden master (2,988 points): 0 differ

`archive/T174_204_golden_compare.txt`. The golden master prices sessions whose answers are set explicitly (state-det) and typed phrases (text); neither routes through the builder's chip, and the engine's quote for a given answer was always right. The data change adds a second path (not a price); the Path A change is a render change.

## What does move: the builder's quotes for eight appliance groups (not in the golden master)

Measured on the page, every group's every condition chip, before and after (`archive/T174_204_builder_before.json`, `_after.json`; 247 cases over 70 groups): **54 move, 193 do not.** All 54 are on the eight appliance groups whose chips come from the `symptom` / `window_ac_issue` module the fallback asks; **all 54 rise, none fall; 39 become the diagnostic ("On-site quote") state.** The seven groups (Appliances, Washer, Dryer, Stove/Range, Refrigerator, Dishwasher, Microwave) are identical to each other:

| Chip the customer picks | Before (words only) | After (the answer it is) |
|---|---|---|
| Won't spin / no movement | Fixed price $198 | Fixed price $318 |
| Won't drain (water stays inside) | Fixed price $198 | On-site quote $400 |
| Leaking water | Fixed price $198 | On-site quote $455 |
| Making strange noises | Fixed price $198 | Fixed price $318 |
| Burning smell | Fixed price $198 | On-site quote $455 |
| Works intermittently | Fixed price $198 | On-site quote $455 |
| Trips breaker immediately | Fixed price $198 | On-site quote $455 |

Window AC: the builder offers it the generic `symptom` list (D-C11-3 below), and five of those seven chips are options of the Window AC's own question (`window_ac_issue`): Leaking water, Burning smell, Works intermittently and Trips breaker immediately $198 -> On-site quote $455; Making strange noises $198 -> $318. "Won't spin / no movement" and "Won't drain" are not options of that question (it relabels the first and drops the second), so they answer nothing there and are exactly what they were, words.

These are the numbers the typed card gives for the same answer on the same entity (the detector checks state and labor equal for all 16 of its cases): the builder was quoting $198 for a dishwasher whose owner had just said it smells of burning, where the catalog's rule says an on-site look and its own price for a "won't spin" is $318. A customer who used the builder and saw $198 would now see the larger number the card gives; that is the catalog's number (the price a customer who typed the same words has always been shown), reached by a path that had not applied it.

The other 62 groups do not move because their condition chips are not yet drawn from the module the fallback asks (the builder looks for `symptom`, `issue`, `damage_type` and `state` by name: D-C11-3), so a chip answers nothing there and is exactly what it was, words. #199's shared derivation closes that disagreement; this change will reach those groups with it.

## What a customer sees on a typed or tapped fallback (render, not price)

For the twelve entities the card now draws the Fork ("On-site quote ... Answer a few more questions / Book an on-site diagnostic") where it drew "Estimated labor: $455" and "Add to Request". The engine's state for the answer was `diagnostic` before and is `diagnostic` now; the price number is unchanged ($455 on the dishwasher). Path A now draws its question on all 45 diagnostic-capable entities (36 dynamic, 9 services); before, on none. Held by `verify_diagnostic_answer_reaches_fork.js` (22 checks; four mutants; red on the T173 tree: 12 entities without a second path, 33 entities whose Path A drew no question, 16 of 16 builder cases).

## Reversal

Data: remove the twelve `remote_deep_dive_modules` arrays (two places each). Code: three small edits in `qr.html` (the splice's visible-chain re-resolution, `orch_apply_remote_divergence`'s context, `resolveBuilderConditionAnswer` and its one call in `sqBuilderFinish`).
