# T198 M1 — an object keyword matches whole words

**Defect (real page).** "Install a doorbell camera" opened *Prehung Interior Door Install* (a door job, with a door price) because `orch_apply_object_based_resolution` matched the extracted object by raw substring: "doorbell camera" contains the keyword "door". "Put together a bed frame" landed on the same service by the same mechanism (a substring keyword).
**Change.** Containment (object-contains-keyword and keyword-contains-object) is by whole words, a plural s/es allowed (`qr.html`, Logic, same function). Exact matches are untouched.
**After.** Both phrases go to the general intake ("What are we installing or replacing?"), no wrong service, no door price. "Install a door", "replace two doors", "door repair" resolve exactly as before.
**Measured.** Golden master 2,988: 0 differ. Typed corpora 357 / 7,803 / 275: 0 changed. A 25-phrase page sweep: only the two phrases above changed.
**Test.** `verify_object_match_whole_words.js` (6; the planted raw-substring original fails). 
**Seen, not fixed (next):** "fix squeaky door" → Squeaky Floor Repair (no door-squeak service; the floor service claims "squeaky"); "fix a leaking pipe under the sink" → Angle Stop Replacement rather than Under-Sink Leak Repair.
