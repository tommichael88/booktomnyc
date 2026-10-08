# Retired tests

A retired test is MOVED here, never deleted: each file is recoverable, and every entry says why it was retired and what covers the behaviour now. A retired test no
longer runs and is not in `MASTER_TEST_SUITE.json` (G-INVARIANT-RETIRE-TEST: retirement is an affirmative act with a reason, not a quiet deletion).

## Retired in this repo

| file | retired | why | what covers the behaviour now |
|---|---|---|---|
| `verify_component_tracing_overlay.js` | T156, PENDING_DECISIONS D-A4-1 (operator: default) | It extracts the tracer out of `qr.html` (`Could not find function: _trace`), but the tracer lives in `trace.js`; and its "disabled by default: zero trace entries captured" check asserts the optional-tracer behaviour Phase A4 removed (the tracer is now always on and observation-only). It crashed before its first check at the T154 baseline. | `verify_trace_observation_only.js` (the live tracer: always on, bounded, observation-only) and `verify_tracer_real_dom.js` (the real `trace.js` in the real page through a real typed request). |
| `verify_purity_audit.py` | before T156 | The reason is not recorded in this repo (a live `verify_purity_audit.py` also remains in `test_harness/` and in `MASTER_TEST_SUITE.json`; whether the retired copy is a stale duplicate is an open question for #111). | not determined |

## Retired by the operator at T136, NOT yet retired in this repo

The operator's project copy of this README (T136, "rewrite it or 86 it") lists the files below as moved here. In this repo they are still live in `test_harness/`, still
in `MASTER_TEST_SUITE.json`, and still red at the T154/T156 baseline. They were not moved at T156 because the operator's ruling covered only the overlay test (D-A4-1);
the remainder is PENDING_DECISIONS #111 (retire or restore the legacy compiler tests).

| file | the operator's T136 reason |
|---|---|
| `verify_t107_tracing_corrections.js`, `verify_tracing_tool_v2_upgrade.js`, `verify_tracing_v3_full_instrumentation.js` | Ran `trace.js` in a bare `vm` sandbox with no real `window`/DOM, so they failed on jsdom limits, never for a reason related to the tracer. Covered by `verify_tracer_real_dom.js`. |
| `verify_nlp_engine_module.js` | Compared a hand-cherry-picked copy of the NLP functions with the extracted `nlp_engine.js`: a weaker copy of `check_module_parity.js`; it broke on every NLP refactor. |
| `verify_no_module_drift.js` | Its only assertions concerned a known duplicate `_resolveIntakeChain` that T136 deleted. `verify_single_parse_pipeline.js` asserts no module-level function is declared twice. |
