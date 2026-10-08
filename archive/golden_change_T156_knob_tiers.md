# Golden-master change, T156: `cabinet_knob_or_pull_install` is priced by tiers (PENDING_DECISIONS #112)

**Authority.** Operator ruling of 2026-10-07, option (A): "Tiers: 1-5 knobs $20 each, 6-15 $15 each, 16+ $10 each, $95 visit minimum, using the higher of tier price vs. current flat."
This is the first change since the T154 baseline that moves a price on purpose. Every other collapse in Phase A held the golden at 2,988 points with 0 differences.

**What moved.** 30 of the 2,988 points, all on one service, on both pricing paths (`state` = `computeQuoteFromState`, `orch` = `orch_apply_quantity`), and on every answer strategy that reaches it.
`archive/golden_master_T154_extended.json` is kept as the "before"; `archive/golden_master_T156_extended.json` is the new baseline that `verify_collapse.sh` compares against.

| knobs | before | after | why |
|---|---|---|---|
| 1 | $20 | $95 | tier total $20, below the $95 visit minimum |
| 2 | $20 | $95 | $40, below the minimum |
| 3 | $20 | $95 | $60, below the minimum |
| 5 | $20 | $100 | $100 (5 x $20) is above the minimum |

Not captured by the golden's inputs, held by `test_harness/verify_knob_pull_tiered_pricing.js`: 4 knobs $95 (tier total $80), 6 $115, 10 $175, 15 $250, 16 $260, 20 $300, 50 $600 (swap and new-holes give the same price today, because the old flat price is the lowest of the three at every count).

**What did not move.** Minutes (3 per knob, unchanged), confidence, the checkout state, the tag set, every other service (2,958 points identical), the differential's 1,138 other probes (cards, panels, routes, quotes, prefills, adlibs, builders).
The differential (`render_diff.js`, vs HEAD) shows exactly 8 different entries, all for this service: `route`, `routeJson`, `prefill`, and five `quote:` probes.

**The reading chosen, and the one rejected.** Graduated (marginal): knobs 1-5 cost $20 each, 6-15 cost $15 each, 16 and up cost $10 each. The alternative (the whole order at the rate its count falls in) makes the price FALL as the count rises (5 knobs $100, 6 knobs $90; 15 knobs $225, 16 knobs $160), which the Charter forbids ("The Three Components": per-unit labor "scales continuously. Never stepped"). The test holds the first reading and proves the second fails it (a mutant). A different reading is a data edit to `pricing_formulas.hardware_install_formula.tiers` plus the test's pinned vectors, not a code change.

**A consequence worth seeing.** For 1 to 4 knobs the price is the same ($95): the customer who taps "+" from one to four sees the quantity move and the price hold. That is what a visit minimum is. `verify_quantity_control_curated_card.js` used to carry a hard-coded "declared flat" exception for this service; it is retired, and the one legitimate flat stretch is now derived from the data (a price may be flat only while it sits on the visit minimum its formula declares, and must leave it within five). Whether the card should say "includes the $95 visit minimum" is a design question filed as an open item in the ledger.

**Where it lives.** `btnyc.json`: `pricing_formulas.hardware_install_formula.tiers` and `.visit_minimum` (four mirrored copies of the formula parameters: the live one, and the derived copies under `compiled.*`, hand-edited because the compiler that generated them is absent, see #111). `qr.html`: one branch of `applyPricingFormula`, `Math.max(visit_minimum, graduated tier total, old flat price)`, with the tier helper local to it. `btnyc_schema.json`: the new fields are guarded (the page refuses to boot on a malformed tier table).
