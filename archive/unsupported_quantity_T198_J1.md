# T198 J1 — a count the request cannot price is asked about, never quoted as one unit

**Defect.** "Mount 120 shelves": `extractQty` answers 1 (H1: an invented 99 is worse than a 1), so the card showed $159, the stepper at 1 and "Add to Request". The requested scope (120) and the priced scope (1) disagreed and the one-unit figure read as the price of the job. Same for "replace 150 outlets" / "patch 300 plaster holes", which land on the tag-affirmation card showing "From $65" / "From $80".

**Change (owning layers).**
- NLP (`modules/nlp_engine.js`): `extractUnsupportedCount(text)` keeps the stated count (100–99,999, a thousands-comma form, or a 4-digit non-year) as *evidence* when a plural noun follows it; it reads the same masked text as `extractQty`/`extractStatedCounts` (`maskIncidentalNumbers(text, keepLarge)`), so model, serial, room, year, date, time, price and dimension numbers never qualify. `extractQty` is unchanged.
- Logic (`qr.html`): `orch_scope_state` puts `route.scope` ({stated, noun, phrase, resolution, pending, review}) on the route; `orch_resolve_scope` (twin of `orch_apply_quantity`) takes the customer's answer; `orch_apply_quantity` resolves a priced number. `cartTotalLabel` states what is priced and what is not.
- Renderers: the curated card and the tag-affirmation card hold the price while the scope is pending; the curated card asks three honest questions in place (no retyping): *Yes, N things — quote it after a review* / *Fewer? Enter a number up to 99* (priced exactly as typing it) / *That number isn't how many* (the earlier one-unit behaviour). A confirmed large job is a line with no online price (`Quote after review`, `reviewRequired`, the stated scope in its name, notes and intake answers); the cart total reads "To be quoted" or "$N + K to be quoted". The scope buttons carry `scope-action` so the generic chip-answer handler does not also fire.

**Customer, before → after** (real page):
| Input | Before | After |
|---|---|---|
| mount 3 / 12 / 99 shelves | $478 / $1910 / $15758, stepper | unchanged |
| mount 100 / 120 / 150 shelves | $159, stepper 1, Add | "You asked for 120 shelves. We price up to 99 of one thing online, so we haven't put a price on this yet. Which is right?" three actions; no price, no stepper, no Add |
| replace 150 outlets, patch 300 plaster holes | "From $65", "From $80" on the affirm card | "You asked for 150 outlets. We'll confirm that number with you next, before we show a price."; then the curated question |
| yes, 120 shelves | — | "Quote after review", no stepper; Add → cart line "Shelf Mounting — 120 shelves", "Quote after review", total "To be quoted"; nothing charged |
| fewer: 40 | — | $6367, priced exactly as typing "mount 40 shelves" |
| that number isn't how many | — | $159, stepper 1 (the prior one-unit quote, by the customer's say) |
| model 4500, "furniture assembly 4500/120", "mount shelf 120", "12 bulbs in room 120" | one unit | unchanged: no warning (an ambiguous trailing number is not a count) |

**Measured.** Golden master 2,988 points, 0 differ against the I1 capture. Typed corpora 357 / 7,803 / 275 phrases: 0 changed (none state a count past 99). Only inputs that state 100+ of a plural thing change, on the page.

**Not done / honest limits.** "mount shelf 120" (number after the noun, no plural) is still one shelf: it cannot be told from a model number. Booking is a demo that clears the cart; the review line carries its stated scope in the cart entry for whoever reads the request. No service has an authored project-estimate path for a counted job, so "quote after review" is the one existing conditional route used.

**Test.** `verify_unsupported_quantity_asks.js` (39 checks; the planted original fails). `verify_incidental_numbers_not_quantity.js` plant retargeted to the new signature, nothing weakened.
