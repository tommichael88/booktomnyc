# T189 (2/n): the thin-laptop question (#184) -- golden master, answer-space and typed-corpus differentials measured before and after

Direction: PENDING_DECISIONS #184, ruled direction A with observable wording ("Is this a very thin laptop (under about an inch thick, like a MacBook Air or an ultrabook)?"), landed under the standing delegation.

## What changed

A RAM or SSD swap can no longer be quoted on a laptop that may have the part soldered on. One new routing question, `thin_laptop`, is asked on a Laptop before any of the five entry points settles on the part service:

| entry point | how the question is reached |
|---|---|
| "Fine at first, then slow once I open many tabs or programs" (`slow_pattern`, RAM) | `then` -> `thin_laptop`, in the Computer Diagnostic's chain |
| "It takes several minutes to start up (an older computer)" (`slow_pattern`, SSD) | `then` -> `thin_laptop`, in the Computer Diagnostic's chain |
| "A message that the operating system or drive was not found" (`startup_screen`, SSD) | `then` -> `thin_laptop`, in the Computer Diagnostic's chain |
| typed words ("I need more RAM", "I need a new SSD") and the part question itself (RAM, SSD) | `computer_component` = RAM or SSD, `then` -> `thin_laptop`, in the part service's chain |

The three answers are "Yes, it's very thin", "No, it's thicker" and "I'm not sure". "Yes" and "I'm not sure" send the job to the Computer Diagnostic (an existing priced path; with #201 it is the credited $85 gateway). "No, it's thicker" leaves the job where it is, with the part service's price exactly as before. An all-in-one or a desktop is not asked (the question `depends_on` a Laptop).

Mechanism: one new key on `route_to`, `ask_first` (the key of a question the move waits for), on the three diagnostic routes that name RAM or SSD. The move waits while that question can still be asked and is unanswered, and is cancelled when the answer's own route names the service the job is already in. While a route waits, the price is held (`route.guardPending`; the card says "Please answer the questions above to see a quote.") instead of showing the part service's flat price.

## Golden master: 0 of 2,988 price points move

Tool: `test_harness/tools/price_golden_master.js` capture on the working tree, compared with `archive/golden_master_T188.json`.

```
compared 2988 price points: 0 differ
```

The baseline stays `archive/golden_master_T188.json` (unchanged). This is expected and is the reason the differentials below exist: the golden master drives each service from its own tile and from typed words with the questions answered, and it never stops at a question. A held price is not a price point.

## Answer-space differential (new tool: `test_harness/tools/answer_space_diff.js`)

Every state a customer can reach from the two services' own tiles (`computer_diagnostic`, `internal_hardware_replacement`), one tap at a time, before and after:

```
states before 546, after 942 (408 of them carry an answer to thin_laptop)
  identical: 498
  present in both, different: 12
      12  triage: false -> true
      12  guard: false -> true
       2  open: "customer_supplied_part" -> "thin_laptop,customer_supplied_part"
       4  open: "" -> "thin_laptop"
  only before (the job is elsewhere, or waits, after the change): 36
      of which continue after the change as states that carry thin_laptop: 18; reachable no other way: 18
  only after (not carrying thin_laptop): 24
```

- **498 of 546 states are identical** (labor, minutes, checkout state, open questions).
- **12 differ only in that the price is held.** They are the part service with RAM or SSD chosen (6 each): three states where the device is not yet known and three where it is a Laptop with the new question open. A laptop is still possible in all twelve, so the part service's flat price waits. Labor and minutes are the same numbers as before; they are not shown until the question is answered. (A Desktop or an All-in-one is not in the list: those states are identical to before.)
- **36 states exist only before.** 18 of them continue after the change as states that also carry a `thin_laptop` answer (the same job, one question further on). The other 18 are one decision, taken below: a customer who has answered the symptom (RAM: "Fine at first, then slow...", SSD: "It takes several minutes to start up...", or "A message that the operating system or drive was not found") **but not yet said what kind of computer it is** was moved to the part service and quoted $125 / 135 min (or $150 / 155 when we source the part) with the device question still open on the card. After the change the same answers stay at the diagnostic, price held, until the device is known (the 24 waiting states that exist only after). Nothing a customer could be quoted is lost: with the device answered, each of the 18 is reached again as a state that carries the answer, or is quoted as before (Desktop, All-in-one, or "No, it's thicker").

## Typed corpus (30 phrases written to hit the five entry points and their neighbours)

```
typed phrases: 30, changed: 6
    "upgrade the RAM on my laptop"          internal_hardware_replacement 125/135 -> same, price held
    "upgrade RAM on my MacBook Air"         internal_hardware_replacement 125/135 -> same, price held
    "I need a new SSD"                      internal_hardware_replacement 125/135 -> same, price held
    "upgrade my hard drive to an SSD"       internal_hardware_replacement 125/135 -> same, price held
    "install more RAM"                      internal_hardware_replacement 125/135 -> same, price held
    "need more storage on my computer"      internal_hardware_replacement 125/135 -> same, price held
```

24 of 30 are unchanged (desktops, batteries, screens, "my pc is slow", "computer repair", and so on). The 6 that change are the typed ways in to a RAM or SSD swap: the engine, the entity and the number are unchanged; the price waits for the question.

## No dead end (`verify_thin_laptop_question.js` claim 2.12)

A walk of every reachable state of the two services (934 nodes): 36 are held, and every held state has a question on the card that, once answered, releases the hold. 0 dead ends (a held price with nothing left to answer). The test has 12 mutants of the data, the engine and the page; each is caught by the claim it targets, including "the guard is always true" in two forms.

## Decisions taken (recorded as Autonomy Decisions in PENDING_DECISIONS #184)

1. **Device unanswered: the price waits.** The question applies to a Laptop; a customer who has not said what the computer is has not been asked yet. The alternative (quote now, ask later) reproduces #184 for the 18 states above.
2. **The guard also holds at the diagnostic**, not only at the part service: while the move to the part service waits on the question, the diagnostic's own price ($156 / 85 min on a laptop) is not shown either, because "No, it's thicker" moves the job away from it.
3. **"Yes" and "Not sure" both go to the diagnostic.** A customer who cannot tell is the customer for whom the technician's look is the honest answer (no price promise either way).
4. **All-in-one machines are not asked.** Your wording is about laptops; an all-in-one with soldered parts stays found-not-fixed, as filed.

## Reversal

`git revert` of the T189 (2/n) commit restores the previous catalog, engine and tests; no stored data depends on `thin_laptop`.
