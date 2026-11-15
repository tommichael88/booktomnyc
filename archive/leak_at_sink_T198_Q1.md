# T198 Q1 — a leak at the sink is the under-sink leak job

**Defect.** "Water leak at the sink", "leak in the sink", "water leaking from sink" got no service (general intake): the generic `leak` object matches "water leak" at full weight, and the override O1 put on it knew only "under the sink". ("Leak at/from/near the sink" worked, by another object.)
**Change.** The O1 override on the generic leak object now lists at, in, from, near and beneath (as well as under) the sink / my sink / kitchen sink / bathroom sink (source `vocabulary.nlp_objects`, mirror `intent_mappings.objects`, graph/reports regenerated). Data only.
**After.** All of those → Under-Sink Leak Repair ($75). Unchanged: "faucet leaking at the sink" and "sink is leaking" (Faucet Drip Repair), toilet, washing machine, dishwasher leaks, "install a sink", a bare "water leak" (general intake).
**Measured.** Golden master 2,988 points vs P1: 0 differ. Typed corpora 357 / 7,803 / 275: no changes.
**Known, unchanged.** "Sink is leaking" is a Faucet Drip Repair (the sink may drip from the faucet; ambiguity left to the intake). "Water leak from the faucet", "leak at the shower" and "pipe leak" get the general intake.
**Test.** `verify_leak_at_sink_routes.js` (18; the planted original with only "under" fails).
