# T198 A1 -- masonry mounting: before / after

Trees: **T196** = `75cd22e` (before #250); **T197 main** = `4c7f229` (the starting tree); **T198** = this change. Engine columns are the typed free-text path (`collectBookingContext_freeText` -> `executeWorkflow`, tags affirmed): service reached and the engine's internal `laborEstimate`. Page columns are the real page in headless Chrome (the text bar `#sqDescIn` typed, the first dollar figure on the card, and the sentence "WE UNDERSTOOD: ...").

## 1. The phrase sets (engine)

| phrase | T196 | T197 main | T198 | verdict |
|---|---|---|---|---|
| wall mounting for any item on brick wall | dynamic fallback $90 | shelf_mortar_mounting_buy_the_hour $358 | generic_mounting_service $100 | **moved by T198** |
| mount something on a brick wall | dynamic fallback $90 | shelf_mortar_mounting_buy_the_hour $358 | generic_mounting_service $100 | **moved by T198** |
| mount something on concrete wall | brick_or_concrete_crack_repair $95 | brick_or_concrete_crack_repair $95 | brick_or_concrete_crack_repair $95 | unchanged by T198 |
| mount stuff on a concrete wall | brick_or_concrete_crack_repair $95 | brick_or_concrete_crack_repair $95 | brick_or_concrete_crack_repair $95 | unchanged by T198 |
| mount a shelf on brick wall | shelf_mounting_standard_buy_the_hour $213 | shelf_mortar_mounting_buy_the_hour $358 | shelf_mortar_mounting_buy_the_hour $358 | unchanged by T198 |
| hang a floating shelf on brick | generic_mounting_service $75 | shelf_mortar_mounting_buy_the_hour $304 | shelf_mortar_mounting_buy_the_hour $304 | unchanged by T198 |
| mount a mirror on brick wall | shelf_mounting_standard_buy_the_hour $213 | shelf_mortar_mounting_buy_the_hour $358 | shelf_mortar_mounting_buy_the_hour $358 | unchanged by T198 |
| hang a heavy mirror on brick wall | brick_or_concrete_crack_repair $140 | brick_or_concrete_crack_repair $140 | brick_or_concrete_crack_repair $140 | unchanged by T198 |
| mount a tv on brick wall | flatscreen_mounting_standard $85 | flatscreen_mounting_standard $85 | flatscreen_mounting_standard $85 | unchanged by T198 |
| hang a picture on brick wall | brick_or_concrete_crack_repair $95 | brick_or_concrete_crack_repair $95 | brick_or_concrete_crack_repair $95 | unchanged by T198 |
| hang a picture on concrete wall | brick_or_concrete_crack_repair $95 | brick_or_concrete_crack_repair $95 | brick_or_concrete_crack_repair $95 | unchanged by T198 |
| I need a bracket mounted on a brick wall | dynamic fallback $90 | shelf_mortar_mounting_buy_the_hour $358 | generic_mounting_service $100 | **moved by T198** |
| mount a shelf and a tv on brick | flatscreen_mounting_standard $60 | flatscreen_mounting_standard $60 | flatscreen_mounting_standard $60 | unchanged by T198 |
| mount a shelf on drywall | shelf_mounting_standard_buy_the_hour $159 | shelf_mounting_standard_buy_the_hour $159 | shelf_mounting_standard_buy_the_hour $159 | unchanged by T198 |
| mount a mirror on drywall | shelf_mounting_standard_buy_the_hour $159 | shelf_mounting_standard_buy_the_hour $159 | shelf_mounting_standard_buy_the_hour $159 | unchanged by T198 |
| mount items on plaster wall | plaster_wall_repair $80 | plaster_wall_repair $80 | plaster_wall_repair $80 | unchanged by T198 |
| install a shelf in brick | shelf_mounting_standard_buy_the_hour $159 | shelf_mortar_mounting_buy_the_hour $304 | shelf_mortar_mounting_buy_the_hour $304 | unchanged by T198 |
| mortar mounting | dynamic fallback $65 | shelf_mortar_mounting_buy_the_hour $304 | shelf_mortar_mounting_buy_the_hour $304 | unchanged by T198 |
| hang art on masonry wall | shelf_mounting_standard_buy_the_hour $213 | shelf_mortar_mounting_buy_the_hour $358 | shelf_mortar_mounting_buy_the_hour $358 | unchanged by T198 |
| mount a sign on brick wall | shelf_mounting_standard_buy_the_hour $213 | shelf_mortar_mounting_buy_the_hour $358 | shelf_mortar_mounting_buy_the_hour $358 | unchanged by T198 |

## 2. What the customer is shown (real page)

| typed | T197 main: told | amount | T198: told | amount |
|---|---|---|---|---|
| wall mounting for any item on brick wall | a shelf mortar mounting job on brick or concrete | From $304 | a wall mounting for any item job on brick or concrete | From $75 |
| wall mounting for any item on drywall | a wall mounting for any item job on a drywall wall | From $75 | a wall mounting for any item job on a drywall wall | From $75 |
| mount something on a brick wall | a shelf mortar mounting job on brick or concrete | From $304 | a wall mounting for any item job on brick or concrete | From $75 |
| I need a bracket mounted on a brick wall | a shelf mortar mounting job on brick or concrete | From $304 | a wall mounting for any item job on brick or concrete | From $75 |
| mount a shelf on brick wall | a shelf mortar mounting job on brick or concrete | From $304 | a shelf mortar mounting job on brick or concrete | From $304 |
| mount a mirror on brick wall | a shelf mortar mounting job on brick or concrete | From $304 | a shelf mortar mounting job on brick or concrete | From $304 |
| mount a tv on brick wall | a flatscreen mounting job on brick or concrete | From $60 | a flatscreen mounting job on brick or concrete | From $60 |
| mount a shelf on drywall | a shelf mounting job on a drywall wall | From $159 | a shelf mounting job on a drywall wall | From $159 |
| Shelf Mortar Mounting ⏰ Buy-the-Hour | (question card) | $304 | (question card) | $304 |
| Wall Mounting for Any Item | a wall mounting for any item job wall mount required | From $75 | a wall mounting for any item job wall mount required | From $75 |

## 3. Measures (same phrases, both trees; `QR_ROOT` = the tree measured)

| measure | result |
|---|---|
| typed corpus, default (347 phrases) | 4 change; `archive/typed_corpus_default_T198_diff.txt` |
| typed corpus, wide (7,350 phrases) | 44 change; `archive/typed_corpus_wide_T198_diff.txt` |
| what moved | only a masonry word with no named item: Shelf Mortar Mounting -> Wall Mounting for Any Item (41 of the 44 are the corpus's own "mount a brick ..." frames) |
| what did not move | every phrase naming a shelf, mirror, frame, art, sign or TV; the mortar service's own name; drywall and plaster mounting |
| price golden master | 0 of 2,988 points differ |
| render differential (headless Chrome, 76 services) | 0 of 1,146 entries different; 0 render errors; 0 page errors |
| `verify_masonry_mount_identity.js` | 30 of 30 on this tree; 8 red on the untouched T197 `main` tree |

## 4. Reading the money

For the reported sentence the customer-visible figure is **"From $304" -> "From $75"**; the engine's internal labor estimate is **$358 / 150 min -> $100 / 88 min** ($75 flat + the $25 brick-or-concrete answer, exactly what the generic service's own tile quotes when the wall is answered "Brick or concrete"). The card's "From" figure is the starting price; the $25 brick fee is applied as the wall answer and shows in the quote. A named shelf, mirror, frame, art or sign on masonry is still Shelf Mortar Mounting (hourly, skilled tier): "From $304" / $358 labor.

## 5. Found, not fixed (identical on the T196 and T197 trees)

A mounting request with no `mount` keyword in it is taken by the `brick` or `concrete` NLP object (weight 75; default service Brick or Concrete Crack Repair): "hang a picture on brick wall" $95, "hang a picture on concrete wall" $95, "hang a heavy mirror on brick wall" $140, "mount something on concrete wall" $95, "mount stuff on a concrete wall" $95. That is a repair service quoted for a mounting job. It is a different object and mechanism from the one fixed here; it is the next smallest customer fix, not part of this one.
