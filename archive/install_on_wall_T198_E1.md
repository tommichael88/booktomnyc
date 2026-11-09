# T198 E1 — "install a towel bar on concrete wall" is a mounting job (measured)

**Defect.** "install" is not a word of the `mount` object, so nothing yielded to it (B1): concrete decided the job (Brick/Concrete Crack Repair 95 / 100), and on brick, drywall, tile and plaster the install verb's own object won (a dynamic fallback, or Plaster Wall Repair).

**Change (authored data plus one step beside B1's in `detectIntentNLP`; no new parser or table).** Data: `yields_to.placed_by_any` (install, installing, installed) on the five surface objects, `wall_optional` on drywall and plaster (walls by nature), `yields_to.via_surfaces` on the `install` object (so the same rule runs when the install verb, not the surface, was the best match), and `mounts_items_any` on the `mount` object (the items it mounts: towel bar/rack/ring/holder/hook, robe hook, coat rack, hook(s), grab bar, handrail, shelf/shelves, mirror, picture, frame, art/artwork, sign, tv/television/flatscreen/monitor, bracket, toilet paper holder). Engine: when a placing verb, a mountable item and the surface after on/onto/to/against ("wall" required unless the surface is a wall by nature) are all present, and no damage word, the mount object wins and its own overrides pick the service. "install" alone is not a mounting word.

| Phrase | Before | After (service, labor $ / min) |
|---|---|---|
| install a towel bar on concrete wall | Brick/Concrete Crack Repair 95 / 100 | Wall Mounting for Any Item 100 / 88 (= "mount a towel bar on concrete wall") |
| install a towel bar on brick wall | dynamic fallback 95 / 100 | Wall Mounting for Any Item 100 / 88 |
| install a towel bar on drywall | dynamic fallback 70 / 80 | Wall Mounting for Any Item 75 / 68 |
| install a towel bar on tile wall | dynamic fallback 70 / 80 | Wall Mounting for Any Item 75 / 68 |
| install a towel bar on plaster wall | Plaster Wall Repair 80 / 90 | Wall Mounting for Any Item 75 / 68 |
| install a towel rack / ring / grab bar on concrete wall | Crack Repair 95 / 100 | Wall Mounting for Any Item 100 / 88 |
| install a shelf on concrete wall | Crack Repair 95 / 100 | Shelf Mortar Mounting 358 / 150 |
| install a mirror on brick wall | dynamic, no quote | Shelf Mortar Mounting 358 / 150 |
| install a mirror on drywall | dynamic, no quote | Shelf Mounting (standard) 159 / 70 |
| install a tv on concrete wall | Crack Repair 95 / 100 | Flatscreen Mounting 85 / 90 |

Questions (towel bar, concrete wall): before the crack-repair intake (item count, mounting height, disposal); after the mounting service's (item, wall, weight, quantity, mounting height), the wall typed as "Brick or concrete" already carried.

**Unchanged by design (tested).** install a dishwasher, ceiling fan, light fixture (on brick wall), faucet, shower curtain rod; install tile / tile backsplash / drywall on the wall; install a towel bar on tile floor; install a toilet on tile floor; install a towel bar with no wall; damage beside the phrase (crack, hole): repair routing as before; repair a crack in concrete wall, patch a hole in drywall.

**Corpora.** Default typed corpus (350) and wide (7,399): 0 change (the corpus builder names no wall-mounted item with an install verb). A first version without `mounts_items_any` moved 23 wide phrases to Wall Mounting for appliances, doors and locks ("dishwasher install on plaster wall"); that is why the item list is authored on the mount object. Golden master 2,988: 0 differ.

**Found, not fixed.** "install a toilet paper holder on tile wall" stays a toilet install (the word "toilet" wins, as it does for "mount ..."); "install a towel bar on the bathroom tile" (no word "wall") is unchanged.
