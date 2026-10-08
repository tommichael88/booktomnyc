# Differential change, T156: the curated card has its own host, `#sqCardHost` (PENDING_DECISIONS #114)

**Authority.** Operator ruling of 2026-10-07 on #114: option (B), "disjoint host (`#sqCardHost` inside `#sqSb3`). Not (A) or (C). Behavioral test required."
This is the second change since the T154 baseline that alters what a customer can see (the first is the knob tiers, `golden_change_T156_knob_tiers.md`). The price golden does not move (2,988 points, 0 differ against `golden_master_T156_extended.json`).

**What changed in `qr.html`.**
- Markup: `#sqSb3` now holds `#sqCardHost` (empty) and then `#sqStep3Skeleton`, a wrapper around the step-3 markup that was there before (the detected-tags row, the quantity stepper, the chip groups, the job statement, the Construct button). Every skeleton id is unchanged.
- CSS: `#smartQuoteEngine #sqCardHost:not(:empty) + #sqStep3Skeleton { display: none }`. While the host holds a card the skeleton is hidden by that one rule; emptying the host gives it back. No script has to remember to hide or restore it.
- `sqRenderCuratedCard(route, 'sqCardHost')` in `prefillSmartQuoteFromService` (was `'sqSb3'`), and the renderer's "hide the browse containers" test follows the new id. `S._lastContainerId` is therefore `'sqCardHost'` after a catalog tap (the re-render on every answer, quantity step and divergence choice reads it, so they follow without a change).
- One new renderer, `sqClearCardHost()`, called from four places: the top of `prefillSmartQuoteFromService` (every catalog tap starts clean, including the taps routed to the older intake panel), `sqResetView` (restart), `sqShowBuilderView` (a card left from a previous service is removed, not hidden), and `sqOpen(3)` (opening the chip step). `sqBuildStep3` itself is not touched: it has a layer violation of its own (#83), the R-INVARIANT-COMPLY ship gate counts any edit to it as a touch, and the first attempt failed the gate for exactly that reason. The gate-held functions (`sqPrepareFlow`, `sqRenderSelfQuoteAdlib`, `prefillSmartQuoteFromOtherTile`) are untouched.

**The differential (`render_diff.js`, base = the previous commit, 1,146 entries).** Without allowances 158 entries differ, in exactly two families: `prefill:` (76) and `builder:` (82), because both snapshot `#sqSb3.innerHTML`, which now carries the two added elements. The allowances name exactly what was added and are scoped to those two families:

```
--rename '"_lastContainerId":"sqCardHost"="_lastContainerId":"sqSb3"@prefill:'
--drop '(?<=\|\|)\s*<div id="sqCardHost"[^>]*></div> <div id="sqStep3Skeleton">@prefill:'
--drop '(?<=\|\|)\s*<div id="sqCardHost"[^>]*>(?!</div> <div id="sqStep3Skeleton">)@prefill:'
--drop '</div> <div id="sqStep3Skeleton">[\s\S]*?(?=\|\|)@prefill:'
--drop '(?<=</button>) </div>(?= \|\|)@prefill:'
--drop '(?<=\|\|)\s*<div id="sqCardHost"[^>]*></div> <div id="sqStep3Skeleton">@builder:'
--drop '(?<=</button>) </div>(?= \|\|)@builder:'
```
(`/home/claude/collapse114.sh` in the working copy wraps them.) With them, **all 82 `builder:` entries and 73 of the 76 `prefill:` entries are identical**; the other 3 still differ, and they are not markup:

| entry | what the previous build showed in step 3 | what this build shows |
|---|---|---|
| `prefill:led_bulb_upgrade` (tapped after `leak_under_sink_repair`) | the Leak Under Sink Repair card | its own chip step |
| `prefill:shelf_mounting_standard_buy_the_hour` (after `shelf_mortar_mounting_buy_the_hour`) | the Shelf Mortar Mounting card | its own chip step |
| `prefill:furniture_assembly_flat_pack` (after `flatscreen_mounting_with_hidden_cables`) | the Flatscreen Mounting card | the (empty) step-3 skeleton; see the observation below |

These are the same defect seen from the other side. The probe taps every service in catalog order with a restart between, and a service that draws no card (the quantity moves its price, or it is routed to the older intake panel) was shown **the previous service's card**, because the card had replaced the skeleton and nothing cleared it. The new build clears the host on every tap. The 3 are therefore a customer-visible fix, listed here so that "3 different" is not read as 3 regressions.

**What a customer sees now, that they did not.** (1) Tap a service, go back, choose "Build it step by step", finish: the sentence and the quote appear (before: a page error, no sentence, step 3 never shown). Reproduced on the previous build with the real customer path, 1 error `Cannot set properties of null (setting 'textContent')`, and gone on this one, for all 73 card services. (2) A service that draws no card no longer shows the previous service's card.

**Observation, not fixed (filed in the ledger).** A tap routed to the older intake panel (furniture selection, the "Other" tiles) does not hide `#sqStepFlow`, so after a card tap the step flow stays on screen under that panel. The previous build showed the stale card there; this one shows the empty skeleton. Neither is right; the cause is the panel path not hiding the flow, which is a separate defect.

**Evidence.** `test_harness/verify_step3_card_host_disjoint.js` (17 checks, registered in MASTER): structure; the card in its own host for all 73 card services; tap -> back -> Build it step by step -> finish -> sentence naming the choice -> Calculate Estimate -> a quote with a price, in a real browser, for every one of them; a no-card service tapped after a card service inherits nothing; the chip step opened over a card gets its skeleton back; four mutants of the page (the card rendered back into `#sqSb3`; the host not emptied on restart; not emptied on a catalog tap; step 3 not removing a card) each fail the check built for them. `verify_curated_card_live_behavior.js` no longer wipes `#sqSb3` by hand between taps: the app does it.
