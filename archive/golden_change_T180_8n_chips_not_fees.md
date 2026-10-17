# T180 (8/n): a chip never raises a price (P-INVARIANT-CHIPSNOTFEES), measured before and after

Operator ruling, 2026-10-16 23:34 NY: "by 'chips' I assumed it was understood to be the #smart_tags that appear in the adlib under the text input box ... those SHOULD NEVER be used to increase pricing. The client responses are 'responses' or 'answers'."

## What changed

`computeUnifiedQuote` (qr.html, the tier ratchet before `deriveComplexityTier`) no longer takes the worst `escalate_complexity` among the active smart tags. The hourly-rate tier comes from the client's ANSWERS alone (`answerOverrideTier`), the service's own tier and the duration. `escalate_complexity` on a tag is still read by `applyLiveConfidenceEscalation` for the confidence bar and the question cap (a bar, not a price). A fact the NLP detects still reaches the price the proper way: the tag's `answers` map is synthesized into answers, and the answer carries the fee / minutes / tier (and is held back until the client affirms the tags or the bar is met, #161).

Two tags declared a tier: `#brick_wall` -> specialized and `#fragile_item` -> skilled.

## Golden master: 8 of 2,988 points move, all declared, all lower

Tools: `test_harness/tools/price_golden_master.js` capture on the working tree, compared with `archive/golden_master_T179.json` (the baseline before this change). The new baseline is `archive/golden_master_T180_8n.json`; the full compare output is `archive/T180_8n_chips_not_fees_gm_compare.txt`.

```
compared 2988 price points: 8 differ across 4 (path|entity) pairs
  fields that differ (count of records): dyn-tags.laborEstimate 4, state-dyn.laborCalc 4

minor_home_repairs+minor_home_repairs_walls+Repair      tags #brick_wall,#disposal_needed,#drywall   qty 1:  235 -> 198   (both paths)   qty 3:  705 -> 593   (both paths)
minor_home_repairs+minor_home_repairs_walls+Diagnostic  tags #brick_wall,#disposal_needed,#drywall   qty 1:  250 -> 213   (both paths)   qty 3:  750 -> 638   (both paths)
```

Every moving point is the dynamic "walls" service (no named service) with `#brick_wall` active and no answers. The chip alone had put the job in the specialized tier ($110/h); it is now priced at the tier its minutes and answers give (a request that says "brick or concrete" in the wall-type question still escalates to skilled, because that ANSWER carries `complexity_override: skilled`). No named service changes: 0 of the 2,980 other points move.

## The test that holds it

`test_harness/verify_chips_not_fees.js` (17 checks, `@enforces P-INVARIANT-CHIPSNOTFEES`): for every smart tag (59) x every named and dynamic service (158) = 9,322 points, the quote with the tag active equals the quote with no tag, on `computeUnifiedQuote` and on the production path `computeQuoteFromState` with the tag answers closed; the tags' fields are a short non-price vocabulary. Mutant M1 puts the deleted loop back and the sweep goes red on exactly `#brick_wall` and `#fragile_item`; mutant M2 reads a tag `fee` and goes red on exactly that tag.

Also changed to follow the ruling: `verify_active_tags_route_flow.js` (it asserted the opposite: that `#fragile_item` raised the price; it now asserts it does not) and `verify_single_escalation_path.js` (the filed readers of `escalate_complexity` shrink from two to one, the confidence bar).
