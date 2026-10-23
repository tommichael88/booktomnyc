# T188: service naming (a service's name is composed from the scope it authors) -- golden master measured before and after

Operator direction, 2026-10-22 23:03 NY: "Consider a canonical naming mechanism for the btnyc.json "services" that are hardcoded/named so they can follow the entity-noun building explanation of the Charter... it should still be a clear name of what the service is in the Client's language and not jargon so there may be some exceptions to the presentation of the service."

## What changed

Every curated service now authors its scope (`ui_taxonomy.naming`: object, qualifier, actions, tail) and the title, the name and the sentence's verb are derived from it (`ssot/SERVICE_NAMING.md`). 15 titles and 18 verbs changed; the confirmation sentence and the confirmation card now read the authored scope instead of cleaning the title. No price, time, intake, tag, modifier, route or id changed.

## Golden master: 8 of 2,988 points move, every one a title typed as input

Tool: `test_harness/tools/price_golden_master.js` capture on the working tree, compared with `archive/golden_master_T182.json` (the last baseline). The new baseline is `archive/golden_master_T188.json`.

```
compared 2988 price points: 8 differ across 4 (path|entity) pairs
  of those 8: 4 differ in a labor or minutes field
  fields that differ (count of records): text.activeTags 2, text.confidenceScore 6, text.entity 2, text.laborEstimate 4, text.totalMin 4, text.uiTemplate 4
```

All 8 are in the `text|` family, which types each service's **display name** as the customer's words ("`<title>`" and "I need 3 `<title>`"). Renaming a title therefore changes the *input* of that fixture point, not the behaviour for the words a customer would have typed. The four services:

| service | the new title, typed | before (old title typed) | after (new title typed) |
|---|---|---|---|
| `blinds_shades_curtains_buy_the_hour` | "blinds, shades or curtains install ⏰ buy-the-hour" | dynamic self-quote, no price | its own curated card, $50 / 60 min |
| `high_ceiling_bulb_replacement` | "light bulb replacement in high ceilings" | confidence 55 | confidence 60; same entity, card, price and time |
| `router_configuration` | "router setup" | confidence 57 | confidence 60; same entity, card, price and time |
| `scratch_or_water_ring_removal` | "scratch or water ring removal from furniture" | dynamic card, $183 / 80 min | tag affirmation with `#scratched_surface`, $210 / 140 min |

In each, the fixture typed a different sentence, so a different parse is expected. The scratch row is the one to watch: the added words "from furniture" move that typed sentence from a dynamic card to the surface-tag route. A customer typing the old words is unaffected (next section).

## What a customer typed before: unchanged (measured)

The fixture moves because the input moved. The question that matters is whether the **old** phrases route differently now. So the 15 old titles were typed again, alone and with a count (30 phrases), on today's data and engine, and compared point for point with what `golden_master_T182.json` recorded for them:

```
differ: 0
```

This is held permanently by `test_harness/verify_service_naming.js` section 3b (it fails if any of the 30 moves).

## The runtime sentence (not in the golden master: it is wording, not price)

Held by `verify_service_naming.js` in real Chrome for all 76 services (noun, verb and job phrase come from the authored scope; no parenthetical, emoji or repeated word) and by `verify_affirmation_sentence_grammar.js`. Measured on the real page, the committed build against this one (ad-lib sentence "I need 1 [noun] [verb]" and the card's "a ... job"):

| service | before | after |
|---|---|---|
| `faucet_repair_drip` | "I need 1 Faucet Repair (Drip) repaired" | "I need 1 Faucet repaired" (card: "a faucet drip repair job") |
| `shelf_mounting_standard_buy_the_hour` | "I need 1 Shelf Mounting Standard ⏰Buy-the-Hour installed"; card "a shelf mounting standard job" | "I need 1 Shelf mounted"; card "a shelf mounting job" |
| `furniture_disassembly_for_moving` | "I need 1 Furniture Disassembly for Moving assembled" | "I need 1 Furniture disassembled" |
| `slow_drain_clearing` | "I need 1 Slow Drain Clearing cleaned" | "I need 1 Slow Drain cleared" |
| `led_bulb_upgrade` | "I need 1 LED Bulb Upgrade installed"; card "a led bulb upgrade job" | "I need 1 LED Bulb upgraded"; card "an LED bulb upgrade job" |
| `flatscreen_mounting_standard` | "I need 1 Flatscreen Mounting (Standard) installed" | "I need 1 Flatscreen mounted" |
| `furniture_assembly_flat_pack` | "I need 1 Furniture Assembly Flat-Pack assembled" | "I need 1 Flat-Pack Furniture assembled" |
| `gfci_outlet_replacement` | card "a gfci outlet replacement job" | card "a GFCI outlet replacement job" |
| `router_configuration` | "I need 1 Router configured" | "I need 1 Router set up" |
