# T198 P1 — installing a sink is not the leak job

**Defect.** "Install a sink" / "install a new sink" were quoted as *Under-Sink Leak Repair* ($75). The install resolver (`orch_apply_object_based_resolution`) found the object "sink leak" because "sink" is a fragment of that keyword (the weak keyword-contains-object match), and that object's default service is the leak job. No service installs a sink.
**Change.** Owner: the resolver in `qr.html` (inline) reads a new authored flag, `fragment_match: false`, and skips the fragment direction for that object; the flag is authored on "sink leak" (source `vocabulary.nlp_objects`, mirror `intent_mappings.objects`, graph/reports regenerated). A whole-keyword or containing phrase still matches.
**After.** "Install a sink" gets the general intake ($70 generic install, as "install a tap" does) instead of a leak price. Leak phrasing, "install a faucet", toilet, disposal, dishwasher and fan installs unchanged.
**Measured.** Golden master 2,988 points vs O2: 0 differ. Typed corpora 357 / 7,803 / 275: no changes.
**Known, unchanged.** "Replace the sink" / "replace a kitchen sink" still reach Faucet Drip Repair / Under-Sink Leak Repair (a different path: the faucet object plus description scoring; no sink-replacement service exists). "Water leak at the sink" gets no service (same on `main` before this change).
**Test.** `verify_install_sink_not_leak.js` (15; the planted original fails).
