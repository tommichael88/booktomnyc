# Golden-master change, T166: the SSOT audit (PENDING_DECISIONS #163)

**Authority.** The operator's request of 2026-10-10 17:56 NY: "take a turn ... to focus on the btnyc.json ... the content ... especially the quality of the questions, the smart_tag #references to NLP ... Feel free to modify or grow the content (try not to remove anything) ... and subsequently 'fix' qr.html and components to read it/process it." The mandate's standing rule is that a golden-master move is declared, explained point by point, and filed. This is that file.

**Size.** 28 of the 2,988 points differ from the capture taken on `a6f1ddc` (the tree this audit started from; `archive/T166_golden_compare.txt` is the tool's output). 26 of the 28 move a labor or minutes field. `archive/golden_master_T166_extended.json` is the new capture. `archive/golden_master_T156_extended.json` is kept as the "before" (it is stale by the T164-G drift of 56 points, declared in the T164 entry; against it the T166 capture differs by 84 = 56 + 28).

**The 28, by cause.**

| entity (path) | points | what moved | cause |
|---|---|---|---|
| `plaster_wall_repair` | 8 | state-tags / state-det / orch-tags: labor 315 -> 205 (B,1) and 210 -> 170 min; the tag set `#two_person_required,#very_heavy,...` -> `#plaster_wall,...` | the **input** moved, not the engine: the golden picks the "B" tag set as the last three tags valid for the service's category by position. A new tag (`#plaster_wall`, added to the catalog because "plaster wall" had no tag and "plaster" was being read as `#drywall`) is appended last, so the B set changed from `{#very_heavy,#very_high_ceiling,#water_damage}` to `{#very_high_ceiling,#water_damage,#plaster_wall}`. `#very_heavy` carried the +$110 / +minutes. |
| `brick_or_concrete_crack_repair` | 6 | same shape, labor 305 -> 195 | same input drift |
| `wall_hole_or_crack_repair` | 6 | same shape | same input drift |
| `wood_paneling_repair` | 6 | same shape | same input drift |
| `plaster_wall_repair` (text path) | 2 | detected tag `#drywall` -> `#plaster_wall` for the typed phrase that names the service | **intended**: "plaster" no longer resolves to the drywall tag; `#drywall` synonyms are now drywall words only |
| `internal_hardware_replacement` (text path) | 2 | typed name now routes to the service named (labor $135, 60 min) instead of the generic `dynamic` entity (labor $80, 30 min) | **intended**: the intent mapping for "hard drive" had no synonym for "internal hardware replacement", so the service's own name could not reach the service. A data fix (`intent_mappings.objects`), found by `verify_confidence_convergence.js` |

**The proof that the 24 input-drift points are not the engine moving.** Same input on both trees: the OLD tree's "B" tag set (`#very_heavy,#very_high_ceiling,#water_damage`), fed to the old and the patched engine for the four services at quantities 1 and 2, through `computeQuoteFromState` (manual tags), `executeWorkflow` (orchestrator) and `computeQuoteFromState` (detected tags): **8 comparisons, 0 differ** (script: `gm2.js` in the session scratch; the numbers above reproduce with `price_golden_master.js capture` on each tree). So the 24 are the golden's selection rule meeting an additive tag, which is filed as a fragility of the golden (#163, "golden tag-set selection by position").

**What did not move.** The other 2,960 points: every price, every minute count, every confidence score, bar and checkout state, on all four paths. The `hasSel` change in `applySSOTRules` (a builder-only code path) moved none: the golden does not drive the builder. The render differential (`test_harness/tools/render_diff.js`) is the instrument for the builder and the page.

**What moved but is not a golden point.** Typed phrases: the engine now matches tags by whole word or phrase (not by substring), so "replacement" no longer carries `#brick_wall` (via "cement") and "dripping" no longer carries `#leaky_faucet` (via "drip") unless the word itself is there. 26 such hazards were present in the shipped catalog's own service names, descriptions, groups, questions and options (list: `archive/T166_within_word_hazards.txt`). On the end-to-end typed service names none of the 76 services changed price; on the direct state path, the 13 "... Replacement" services carried a `#brick_wall` charge they should not have had (+$25 each) and no longer do.
