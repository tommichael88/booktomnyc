# T198 C1 — a tag is inferred only from words that say it (measured)

**Defects (reproduced 2026-11-09).**
1. "Under-Sink Leak Repair", typed with no word about timing, carried `#emergency` and the answer "Urgent - today or tomorrow" and was quoted the urgent price: engine labor $125 / 85 min against its tile's $75 / 85. Cause: the authored `context_hints` of `#emergency` listed "leak", "leaky", "leakage" (T166 moved the words from code to data and had noted the bare "leak" as a known problem).
2. "Slow Drain Clearing" / "slow drain" carried `#clogged_drain`, whose one answer is drain_speed "Standing water - completely blocked", and was quoted $105 / 110 against its tile's $70 / 80. Cause: "slow drain" was listed among the tag's synonyms, so the words "slow drain" inferred their own opposite.

**Change (authored data only; no engine code).** `smart_tags['#emergency'].context_hints`: "leak", "leaky", "leakage" removed. `smart_tags['#clogged_drain'].synonyms`: "slow drain" removed. Carried by `ssot_patch.js` (5 operations), `migrate_legacy.js --write`, `carry_charter.js --write`, `splice_compiled.py --write`, `publish.js`, `report.js --write`.

**Protected (tested).** Every word that says urgent still infers it: urgent, asap, today, emergency, flooding, same day, right now ("urgent leak under the sink tonight" is still $125 and still #emergency); every word that says blocked still infers a blocked drain (clogged drain, water backing up, blocked pipe, unclog).

**Before → after (typed free text, engine labor $ / minutes)**

| Phrase | Before | After |
|---|---|---|
| Under-Sink Leak Repair (and 3 phrasings) | #emergency, 125 / 85 | no tag, 75 / 85 (= its tile) |
| Slow Drain Clearing / slow drain | #clogged_drain "completely blocked", 105 / 110 | no tag, 70 / 80 (= its tile) |
| urgent leak under the sink tonight | #emergency, 125 / 85 | unchanged |
| my dishwasher is leaking (golden master corpus 00) | pre-tagged #emergency (tag card shown), $422 diagnostic | no tag card, same $422 |

**Corpora.** Catalog-tile states of both services: 1,300 of 1,300 identical (the tile route did not move). Default typed corpus 350: 7 change (4 under-sink leak $125 -> $75, slow drain $105 -> $70, 2 "faucet a pipe leak" with no price, tag only). Wide 7,399: 188 change: 76 leak 125 -> 75, 34 slow drain 105 -> 70, 46 with no price (tag or answer only), the rest are other phrases that carried the word "leak" and lose the same urgency charge ($50: PAX 192 -> 142, toilet 105 -> 55, Wi-Fi 90 -> 40, plaster 130 -> 80). Golden master: 5 of 2,988 points differ, none in labor or minutes (fields: `activeTags`, `uiTemplate`): the plain leak/drain requests no longer arrive with a tag card asking the customer to confirm "urgent / same-day" or "clogged" they never said. Files: `typed_corpus_{default,wide}_T198_C1_diff.txt`, `golden_master_T198_C1_diff.txt`.

**Fixture.** `fixtures/tag_detection_corpus.json`: "slow drain in the tub" moves from must-find `#clogged_drain` to must-not-find (its answer contradicts the words); "leak under the kitchen sink" must-not-find `#emergency` added.

**Found, not fixed.** "clogged drain" still infers "Standing water - completely blocked" (clogged is not necessarily fully blocked); a tag-level answer cannot be graded by which synonym fired. The drain tag would need a "partially clogged" tag or per-synonym answers: a design question, left as it is.
