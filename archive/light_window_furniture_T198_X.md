# T198 X — lighting, window-treatment and furniture requests (2026-11-23)

Customer problem family: the 65 generated phrases (of 3,240: every catalog object x 8 frames) that the W sweep left on a vetoed or empty route, checked on the real page, with the free-text, guided-builder and catalog paths compared.

## What the customer saw, and why

| Request (examples) | Before | Cause (owner) | After |
|---|---|---|---|
| "furniture assembly" (a catalog service name), "assemble furniture", "assemble an ikea dresser" | **"Legacy flow – please use the new UI."**; "assemble ..." got the furniture *repair* questions | the `legacy_flow` template (authored for a service the catalog sends to its older intake panel: furniture selection, "Other") had a placeholder renderer; no assembly words on the furniture object | the furniture selection the catalog tap shows (same function, `prefillSmartQuoteFromService`); assembly words name Flat-Pack Furniture Assembly (take-apart and repair unchanged) |
| "fix curtains", "my blind is broken", "replace shades", "drapes making noise" | "Legacy flow" (vetoed: the synonym scored at half weight, then wall_mounting has no Install definition, only Mount) | object synonym weights (catalog); `resolveDynamicService` | Blinds, Shades or Curtains (hourly, $50) |
| "fix sconce", "sconce not working", "replace sconce" | "Legacy flow" | half-weight synonym | Light Fixture Replacement, as "fix light fixture" already was |
| "install furniture", "install a cupboard shelf", "fix rod", "organize cables" frames | blank after "Looks right" (a group looked up under the object's category, not its own) / "Legacy flow" | `resolveDynamicService` | a priced, asked route (the group's own category; Install = Mount where only one is authored) |
| "light wont turn on", "flickering light", "fix light", "fix fixture" (ambiguous: bulb, fixture, switch, or a plumbing fixture) | "Legacy flow" | vetoed fallback rendered as a placeholder | **not guessed**: "We need one more detail to price this. Which of these is it?" with the lighting groups (Bulbs, Light Fixtures, Switches ...) and "Something else: browse all services"; a choice opens that catalog group |

Also from the resolver change, measured: the "Other" tile of the Dryer, Stove/Range and Other-appliance groups (action Mount), which priced nothing (blank), now uses the Appliances group's own authored Mount definition ($65, 60 min, asks the appliance). A sub-group without its own definition is its parent group's before the category's.

## Evidence
- Null-route sweep: 65 -> 12 (main had 65 after W). The 12 left are "light" / "fixture" frames, which now ask (above), by design. Every other route that changed is listed in the TIMELINE entry (curtains/drapes/shades/blind -> blinds service 24, rod/organize -> mounting 12+, furniture install 11, sconce 6, assembly 6); nothing else moved.
- Price golden master (fresh module extraction on both sides, 2,988 points): 6 differ, all the appliance "Other" tiles above (formerly no labor). Note: the W measurements were taken with root module copies that `extract_modules.js` had not refreshed; this run regenerated them first.
- `verify_light_window_furniture_routes.js` (33: engine, real page, two non-vacuity plants). `verify_typed_fact_reaches_chain.js` 5.2 accounting extended by identity and answer: four corpus phrases ("furniture a assemble on pax wardrobe" ...) now reach the assembly service, which asks the complexity the typed "pax wardrobe"/"ikea" answers (the same class as its other entries). The S1/W4 plants retargeted to the resolver's new text.

## Entry paths compared (real page)
- Free text and catalog now agree for furniture assembly (same panel) and for curtains/blinds and sconces (same services).
- Guided builder, "fix light" -> issue chip -> room -> "Calculate Estimate": the older scope panel prices a generic "light repaired" at **$64** (45 min skilled + $45 dispatch), while free text for the same job asks which lighting job. Not changed here (it is the builder's own estimate path); recorded as the next inconsistency to resolve.

## Left as is (with a fallback)
- "paint the walls light gray" and other painting requests: the catalog has no painting service; "light" makes them a lighting request, which now asks (lighting groups + browse all) instead of "Legacy flow". An unsupported-trade answer (painting) is the next family.
- The builder sentence keeps the object's default verb ("I need to install my curtains" for "fix curtains") and says "because it is won't turn on": wording.

## Preflight correction (same day, before any CI run)
The full local run caught three things the focused checks did not: (1) `verify_synonym_promotion_safety.js` holds "sconce" ("candle sconce"), "blind" ("blind spot"), "shades" (sunglasses) and "rod" as polysemous; promoting them quoted "paint in shades of gray" as blinds. Only "curtains", "drapes", "blinds", "window blinds", "ceiling light", "wall light" are promoted (curtains/drapes removed from the HELD list with the reason: the object's own service is the covering service). (2) Install = Mount at the bare category level turned weak words into a generic $60 mounting quote; it now applies only to a named group. (3) Two pinned expectations moved for the right reason, recorded in each test: "I need a bed assembled" now recommends Flat-Pack Furniture Assembly (was: none), and the Blinds/Curtains old title typed alone, blank before, is a priced card.
Result: 23 of the 65 reach the right service; the other 42 are held, ambiguous words (light, fixture, sconce, rod, blind, shades, a cable phrase) and are asked about (the page's lighting/mounting groups, or the builder's questions), never "Legacy flow".
