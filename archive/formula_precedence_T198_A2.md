# T198 A2 — #251: a curated service is priced by its own contract (measured)

**Change.** `qr.html`, the `orch` block's `formulaId`: for `entityType === 'service'` the order is `financial_engine.formula_ref` → `pricing_engine` → the object's `dynamic_rule` (last resort); the dynamic fallback keeps `dynamic_rule` first. One expression, then `extract_modules.js`. `QR_BUILD_VERSION` stays `T198` (same build number as A1).

**Why it is safe.** Services whose own contract names an object formula carry it as `pricing_engine`: `furniture_repair_hourly` (furniture_repair_formula), `loose_tile_replacement` (tile_repair_formula), `pax_wardrobe_assembly` (pax_wardrobe_formula), `cabinet_knob_or_pull_install` (hardware_install_formula). Nothing relied on the object's formula without saying so. `used_by` is not populated in the catalog, so the contracts were read from the services directly.

**Before → after (typed free text; engine labor $ / minutes; after equals the service's own tile quote in every row, checked for the five names)**

| Phrase | Before | After |
|---|---|---|
| Cabinet Door or Drawer Adjustment | 35 / 75 | 35 / 45 |
| Furniture Disassembly for Moving | 93 / 80 | 54 / 50 |
| Wall Hole or Crack Repair | 90 / 135 | 70 / 80 |
| Scratch or Water Ring Removal | 45 / 95 | 45 / 55 |
| Cabinet knob / pull ("cabinet a knob") | 35 / 30 | 95 / 3 |

**Corpora.** Default 350 phrases: 33 change. Wide 7,399: 446 change, all in the five services above (by service: cabinet_door_or_drawer_adjustment 117; cabinet_knob_or_pull_install 64; furniture_disassembly_for_moving 81; scratch_or_water_ring_removal 90; wall_hole_or_crack_repair 94). No dynamic-fallback phrase moved. Golden master 2,988 points: 10 differ, all `text|`, all those five services. Files: `typed_corpus_default_T198_A2_diff.txt`, `typed_corpus_wide_T198_A2_diff.txt`, `golden_master_T198_A2_diff.txt`.

**Customer reading.** Four of five quotes fall (the typed price carried an area assumption the customer never gave). The knob rises $60 to the tile's own $95.

**Found, not fixed.** `cabinet_knob_or_pull_install` quotes $95 / 3 min at quantity 1 from its own tile (hardware_install_formula): $95 for a three-minute job is the authored tile figure, not a routing fault, but it looks odd and now every route shows it. Technician/pricing review; not bundled.

**Counterfactuals** (`verify_typed_service_names.js` §5): deleting `drywall_repair_formula` moves nothing for Wall Hole or Crack Repair; deleting `tile_repair_formula` moves "fix tile" (dynamic) and Loose Tile Replacement (own contract). On the pre-change `qr.html`, 1.3, 1.4, 5.1, 5.4 fail.
