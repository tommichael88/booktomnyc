# T198 B1 — a wall material is not the job (measured)

**Defect.** `brick`, `concrete`, `drywall`, `plaster` and `tile` objects default to a repair service, and their match outscored the `mount` object's weaker words ("hang", "put up", "attach"). The material the job happens ON decided what the job WAS.

**Change.** Authored data on each of the five objects: `yields_to: { object: "mount", unless_any: [crack(s/ed), hole(s), patch(ing), damage(d), chip(ped), crumbling, gap(s), peeling] }`. Engine: one step in `detectIntentNLP` (`modules/nlp_engine.js`) after the cross-entry check: if the winner carries `yields_to`, the named object also matched, and no damage word is present, the named object wins and its own contextual overrides pick the service (the A1 table). Carried by `ssot_patch.js` (10 operations), `migrate_legacy.js --write`, `carry_charter.js --write`, `publish.js`. `qr.html` is unchanged.

**Before → after (typed free text; engine labor $ / minutes)**

| Phrase | Before | After |
|---|---|---|
| Hang a picture on brick wall | Brick/Concrete Crack Repair 95 / 100 | Shelf Mortar Mounting 358 / 150 |
| Hang a heavy mirror on brick wall | Crack Repair 140 / 140 | Shelf Mortar Mounting 603 / 190 |
| Hang art on cinder block wall | Crack Repair 95 / 100 | Shelf Mortar Mounting 358 / 150 |
| Mount something on concrete wall | Crack Repair 95 / 100 | Generic Mounting 100 / 88 |
| Hang a picture on drywall | drywall-repair dynamic fallback 295 / 145 | Shelf Mounting (standard) 159 / 70 |
| Hang a picture on plaster wall | Plaster Wall Repair 80 / 90 | Shelf Mounting (standard) 159 / 70 |
| Hang a picture on tile wall | tile-repair dynamic fallback 247 / 125 | Shelf Mounting (standard) 159 / 70 |
| Mount a TV on plaster wall | Plaster Wall Repair 80 / 90 | Flatscreen Mounting 60 / 70 |

The service for each item is the one the A1 table already declares (shelf, mirror, frame, picture, art, sign on masonry = Shelf Mortar Mounting; elsewhere Shelf Mounting standard; TV = the TV service). Shelf Mortar Mounting is an hourly, skilled-tier job, so the visible amounts for a picture or heavy mirror on brick are high ("From $304" for a picture): that is that service's declared scope and price, not a new rate.

**Unchanged by design (tested).** Fix crack in brick wall, crack in my concrete wall, brick wall, repair hole in concrete wall, patch hole in drywall, plaster wall is cracked, cracked tile, replace broken tile, and a damage word beside a weak mounting word ("patch the hole in the brick wall where I hung a picture") keep their repair service.

**Corpora.** Default typed corpus (350 phrases): 6 change, all "... on plaster wall" TV mounts. Wide (7,399): 18 change, each a mounting phrase leaving a repair service. Golden master: 1 of 2,988 points, `text|corpus|05`, the master's own phrase "hang a very heavy mirror on a brick wall": Crack Repair 70 / 80 → Shelf Mortar Mounting 304 / 130 (the master had a crack repair baked in as the answer for a mirror). Files: `typed_corpus_{default,wide}_T198_B1_diff.txt`, `golden_master_T198_B1_diff.txt`.

**Found, not fixed.** "Install a towel bar on concrete wall" is still a crack repair: "install" is not a word of the mount object, so nothing yields. "Attach a bracket to brick" is now the generic fallback (dynamic 159 / 70, asks questions) instead of a confident crack repair; drywall gives the same figure. "Drywall repair" with no damage word is the dynamic drywall fallback ($295), unchanged.
