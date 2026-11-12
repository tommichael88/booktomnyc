# T198 K1 — a request that cannot be sent is not presented as sent; a lone trailing number is asked about

**Finding (real page).** `finalizeBooking()` had no submission: it toasted "Booking confirmed! (demo)", emptied the cart, and thanked the customer. The repository has no submission channel at all (no endpoint, form, or backend; `api/` is the chat handler). So, for any cart, a request that went nowhere read as sent; for J1's "Request a review quote" it read as a request someone would answer. In the mixed cart, asking for the same 120 shelves twice merged to "× 2" (240 shelves to a reader), and the stated quantity and review status were discarded with the cart.

**Change.**
- `finalizeBooking` now opens a "Not sent yet" state: "This page can't send requests yet. Nothing has been sent to BookTOM, and no one has been notified or will reply to this." It lists every line (a review line: "… 120 × shelf — needs a review quote (not priced)"; a priced line with its quantity and price), "Priced online: $1910 + 2 to be quoted … no price has been given for them", and offers the customer's own channels with the request written out: Text / Email (the page's existing contact numbers; they open the customer's own messaging app, sent only when the customer presses send), Copy request, Back to my list. The cart is kept, review status and stated quantity intact.
- Before the button the overlay says the same ("This page can't send requests yet…"); the button is "★ PREPARE MY REQUEST ★" (it was "★ BOOK NOW ★").
- `resolveCartTransition`: a line awaiting a review quote does not stack (`no-op`, source `review-line-held`): the same stated scope asked twice is one line; 120 and 150 stay apart (their answers differ). `cartRequestText` (Logic) writes the cart as a request and never prices a review line.
- Trailing number: `extractAmbiguousNumber` (NLP, same masked text as `extractQty`) is evidence when exactly one number is left, it is the last word, it follows a word that is not a preposition, and it is not 0, 1 or a year. It rides the J1 `statedBeyondRange` / `route.scope` mechanism as `kind: 'ambiguous'`: the card holds the price and asks "Is 120 how many you want? … could be how many, or a model or label number." Answers: *Yes, 120 of them* (`count`: up to 99 is set as the quantity exactly as typing it; more is the J1 review request), *A different number, up to 99*, *No, it's a model or label — just one* (the one-unit quote of the same words). The original words stay; nothing is retyped.

**Customer, before → after.**
| Input | Before | After |
|---|---|---|
| mount shelf 120 | $159, Add | "Is 120 how many you want?" three answers, no price, no Add |
| mount shelf model 120 · mount a 120-inch shelf · install shelves in room 120 | one unit | unchanged (From $65 · $159 · From $70) |
| mount 120 shelves | J1 notice | unchanged |
| mount 12 shelves | $1910 | unchanged |
| mount shelf 12 / 4 | one unit | asks; "Yes" prices 12 ($1910) / the typed count; "model or label" $159 |
| BOOK NOW with review lines | "Booking confirmed! (demo)", cart emptied | "Not sent yet" (above); cart kept |

**Measured.** Golden master 2,988 points, 0 differ (no price changed). Typed corpora (357 / 7,803 / 275): the new question would fire on 1 phrase ("light bulbs 3"); none of the 8,000+ others. Real-page checks in `verify_review_request_honest.js` (26 checks); evidence/route checks added to `verify_unsupported_quantity_asks.js` (66 checks); each plants the original and fails.

**Limits.** A trailing number followed by more words ("mount shelf 120 and paint the wall") is not asked about (it is not at the end; unchanged). Furniture assembly's own flow is outside this card. "Due Today:" on the summary still reads as a charge and is unchanged here. **Genuine submission needs an external integration** (a form/email endpoint or backend and its credentials); none is available in the repository, so none was invented — recorded in `PENDING_DECISIONS.md`.
