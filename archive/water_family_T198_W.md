# T198 W — the water / leak / hazard family (2026-11-22)

Customer problem family: what a customer who describes a water, gas or fire problem is told. One branch, four small commits, one integrated gate run.

| | Before | After |
|---|---|---|
| W1 "I smell gas", "carbon monoxide alarm going off", "smoke coming from the outlet" | a quote or the "what item?" builder | a stop panel: leave, call 911 / the utility; no price, no Add. Lookalikes ("install a gas leak detector", "hook up a gas stove", "mount a smoke detector") unchanged |
| W2 "burst pipe", "flooding my basement", "sewer backup in basement" | $70 plumbing quote; sewer backup was **Data Backup $99** | what-to-do panel (shut off water / licensed plumber); no online quote |
| W3 "roof leak" | plumbing diagnostic | roofer stop (we do not work on roofs); "ceiling leak"/"water through the ceiling" stay the on-site diagnostic (cause unknown) |
| W4 "dripping tap" | Faucet Drip Repair **$165** (while "tap leaking" was $50) | $50, same as a leaking tap |
| W4 "leaking pipe" + "Yes, that's it", "shower leaking" | **blank** (group with no Repair definition gave a route with no service) | on-site diagnostic quote panel |

Owner of each: `global_rules.safety_stops` (catalog, authored; `orch_safety_stop` reads it, `renderRoute` shows it, `sqUnifiedAction` sends a hazard straight to it); faucet override keywords (R1 override); `resolveDynamicService(lastResort)` now also used by the group branch.

Measured: price golden master vs the S1 capture, 2,988 points: 0 price/minute differences; 2 `confidenceScore` 56->58 (faucet_repair_drip, "drip" now counted). Generated null-route sweep (3,240 phrases: every object x 8 frames): 84 -> 65 vetoed/null routes, 19 fixed, none newly broken. Tests: `verify_gas_safety_stop.js` (44), `verify_tap_shower_pipe_routes.js` (19); `verify_bare_leak_not_blank.js` retargeted (roof leak is now the roofer stop, the S1 test had pinned a plumbing quote for it).

Remaining (not this family): 65 phrases still reach "Legacy flow - please use the new UI.": a light, sconce, fixture, rod, curtains, drapes, blind, shades (with broken/fix/replace/loose/noise frames), and "install furniture" is a null route. Next workstream.

Gate rework (run 44982446005 failed 9 pass->fail; see TIMELINE): the Repair->Diagnostic rule is the resolver's own, so the orchestrator, state path and guided builder agree; the toilets group's "Other" tile, which priced nothing, now quotes the on-site diagnostic (golden master: 2 of 2,988 points differ, both formerly blank). The drip rule applies only when the customer says "tap" (so "dripping faucet" scoring is untouched).
