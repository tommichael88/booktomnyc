# T198 F2 — a clogged or blocked sink is a drain job, not a faucet repair

**Before (main + F1).** "sink won't drain at all" resolved to Faucet Repair (the `faucet` object won on the word "sink" context); "clogged sink", "unclog my sink", "my kitchen sink is clogged" likewise priced a faucet repair.
**After.** The `faucet` object carries one `contextual_overrides` entry (`override_sku: slow_drain_clearing`) triggered by clog / blocked / won't-drain / draining-slowly words. Existing mechanism, authored data only, no resolver change.
**Quotes.** Blocked sink (completely): $105 / 110. Plain "clogged sink": $70 / 80 with the drain_speed question asked. Leak, dripping-faucet and faucet-replacement phrases keep their services.
**Measured.** Typed corpus default 357 phrases, 7 changed vs main; wide 7,803, 195 changed (all faucet/sink-clog phrases moving to Slow Drain Clearing); service tile states 1,316/1,316 identical; golden master vs main 136 differ across 40 pairs (same as F1); F2 vs F1 golden master 0 differ (`archive/golden_master_T198_F2_diff.txt`).
**Tests.** `verify_clog_degree_stated.js` now 32 checks (section 5: identity and price for seven sink phrases, four unchanged guards, a planted-removal non-vacuity check).
**Known, documented.** A clog quote where no service is reached has no drain_speed question.
