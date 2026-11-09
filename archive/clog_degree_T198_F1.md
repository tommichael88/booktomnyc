# T198 F1 — "clogged drain" does not say "completely blocked" (measured)

**Defect.** `#clogged_drain` answered `drain_speed` = "Standing water - completely blocked" for every clog word, so "clogged drain", "drain clog", "unclog the drain", even "drain is partially clogged" and "clogged drain but water still goes down slowly", were charged the blocked-drain modifier ($35 / 30 min) for a degree nobody stated, and Slow Drain Clearing showed the question already answered.

**Change (authored data only; existing tag, `requires` and answer-synthesis mechanisms; no engine code).** `#clogged_drain` now says only that something is clogged (`answers: {}`). Two tags carry the stated degrees and `require` it: `#drain_blocked_completely` (completely/totally/fully clogged or blocked, standing water, water backing up, backed up drain, blocked pipe, won't drain at all) answers the question's "Standing water - completely blocked"; `#drain_partially_clogged` (partially/partly clogged or blocked, draining slowly, goes down slowly) answers its own "Slow - takes a few minutes to empty" (no fee). Where the degree is not stated the question stays unanswered, so Slow Drain Clearing asks it (`q.drain_speed` is in its visible chain). Carried by `ssot_patch.js` on `btnyc.json`, then `migrate_legacy.js --write`, `carry_charter.js --write`, `publish.js`, `report.js --write`; validators pass.

| Phrase | Before (service, labor $ / min) | After |
|---|---|---|
| clogged drain / unclog the drain / clogged shower drain | dynamic 100 / 105, "completely blocked" | dynamic 65 / 75, no degree claimed |
| drain clog / bathtub drain clog | Slow Drain Clearing 105 / 110, answered "completely blocked" | Slow Drain Clearing 70 / 80, drain_speed asked |
| drain is partially clogged; clogged drain but water still goes down slowly | dynamic 100 / 105 | dynamic 65 / 75, answer "Slow" |
| completely clogged drain / totally clogged sink | 100 / 105, 85 / 90 | unchanged (the words say so) |
| sink won't drain at all | Faucet Repair (Drip) 50 / 60, no tag | 85 / 90, "completely blocked" (the words say so) |
| slow drain (the service) | Slow Drain Clearing 70 / 80 | unchanged |

**Measured.** Service tile states 1,316 / 1,316 identical. Default typed corpus 351 phrases (one new phrase from the added vocabulary), 1 change; wide 7,701, 107 change, all clog words appended to a service ("... on clogged sink": the $35 / 30 charge gone, e.g. 85 / 90 -> 50 / 60) or the new degree words ("... on completely clogged": the charge, e.g. 60 / 70 -> 95 / 100). Golden master: 136 of 2,988 points differ across 40 (path | entity) pairs, all in plumbing_help tag walks and none outside them: 80 are the walk's first-three set (`#bidet_attachment,#clogged_drain,#disposal_needed`) losing the clog charge (95 / 100 -> 60 / 70), 56 are the last-three set whose members changed because the two new tags join the valid list. No other category moves.

**Found, not fixed.** The sink-clog phrases are routed to unrelated services ("clogged sink" and "unclog my sink" reach Faucet Repair (Drip); "my kitchen sink is clogged" reaches Under-Sink Leak Repair), so the degree charge can land on a faucet service; and "completely blocked drain" / "water backing up in the shower" resolve to a category with no tag scope (dynamic 183 / 80, no tags), as before. A dynamic clog quote has no drain_speed question to ask.
