# Dual-source transition: `btnyc.json` → `ssot/btnyc_source.json`

Rule: **R-SYSTEM-DUALSOURCE** ("Two Live Sources Are a Bounded Migration, Never a Steady State"). Opened by T175. This is the transition ledger for it: the six fields the rule requires, the one fact a reader needs about which side is authoritative, and how an edit is made while both exist. The detector reads this file; the fields below are parsed, so keep their labels.

## Ledger

- **Start:** 2026-10-14 (T175: the commit that adds `ssot/btnyc_source.json`; `btnyc.json` was until then the only source.)
- **Owner:** the Operator (`tommichael88`). The migration tooling is `test_harness/tools/entity_first/`; the Operator decides when the runtime moves (PENDING_DECISIONS #212).
- **Completion condition:** every consumer listed under "Consumers of the retired source" reads the derived graph (`ssot/derived/btnyc_graph.json`) or a CMS publication of the source, and none reads `btnyc.json`; `btnyc.json` is then removed from the repository root (archived under `archive/`, not left live); `migrate_legacy.js`, `project_legacy.js`, `declared_normalizations.js`, `compiler_roundtrip.js` and the parity tests are deleted with it, because there is no second source left to be in parity with.
- **Detector:** `node test_harness/tools/entity_first/transition_status.js` prints `COMPLETE` or `NOT COMPLETE` (and `OVERDUE` after the end date with no reauthorization), exit 0 / 1 / 3. It scans the consumers below for `btnyc.json` and for the derived graph, and checks that `btnyc.json` is gone. Its own ability to say each of those is held by `test_harness/verify_entity_first_transition.js`.
- **Expected cost:** while both exist, a content change costs one extra edit and one parity run: the change is made in the source, then carried to `btnyc.json` with `ssot_patch.js` and `splice_compiled.py` in the same commit, and `project_legacy.js --check` proves the pair agree. The migration and projection tools and the `verify_entity_first_*` tests are carried only for the period. The larger cost is the runtime adapter that makes the consumers read the derived graph (the target modules named in `COMPONENT_LAYER_MAP.md`: resolver, confidence engine, composer, recovery engine, route builder); it is **not** done or estimated by T175 and is the substance of the remaining work (#212).
- **Target end date:** 2027-01-15. This is a **default**, not a decision: nothing in the repository fixes a date, the rule requires one, and the Operator is asked (#212). After this date, with the detector not `COMPLETE`, the transition must be closed, explicitly reauthorized below with a reason and a new end date, or rolled back. Silent extension is prohibited, and `verify_entity_first_transition.js` fails the suite until one of those is done.

Reauthorizations (none yet; each is a line `- **Reauthorized YYYY-MM-DD:** <reason>; new end date YYYY-MM-DD`):

## Consumers of the retired source

These are the files that read `btnyc.json` today (counts from the detector at T175). The detector parses the backticked paths on the line below; `*` matches within one directory.

**Consumers:** `qr.html`, `modules/*.js`, `test_harness/btnyc_v10_compiler.py`, `test_harness/tools/ssot_patch.js`, `test_harness/tools/splice_compiled.py`

The runtime in `qr.html` fetches `btnyc.json` and the modules under `modules/` (generated into the repository root by `extract_modules.js`) read the loaded global. The compiler reads the authored sections and writes the eight compiler-owned keys back. None of them changes in T175: the runtime, and so the price golden master, cannot move in this change (the golden master compares byte-identical before and after).

## What is authoritative, and how an edit is made while both exist

- **The source (`ssot/btnyc_source.json`) is authoritative.** It holds everything `btnyc.json` authors, plus what `btnyc.json` could not say: entity ownership, `entity_scope`, uncertainty classes and weights, confidence gates and policies, retirement relations, recovery affordances, decompositions. `btnyc.json` is no longer where a decision is made.
- **A change that `btnyc.json` can express** (an answer, a fee, a prompt, a branch, a picker tile, a tag) is made in the source first, then carried into `btnyc.json` by `test_harness/tools/ssot_patch.js … --write` followed by `python3 test_harness/tools/splice_compiled.py btnyc.json --write`, in the same commit. `node test_harness/tools/entity_first/project_legacy.js --check` and `verify_entity_first_migration.js` fail on a pair that disagrees. A change made only in `btnyc.json` fails the same check; a change made only in the source that `btnyc.json` can express fails it too.
- **A change `btnyc.json` cannot express** (a weight, a scope, a retirement, a decomposition, a recovery question) is made in the source only. It is checked by the validator (`validate_source.js`) and re-derived (`derive_graph.js`); the parity check does not see it, by design.
- **After a derived artifact changes**, regenerate it: `node test_harness/tools/entity_first/derive_graph.js` and `node test_harness/tools/entity_first/report.js --write`. `--check` on each is in the suite, so a stale graph or report cannot land.
- **`migrate_legacy.js --write` does not overwrite an edited source.** It replaces the source only if the source is exactly what the last migration wrote (`ssot/migration/last_migration.json`), and refuses otherwise (exit 3) unless `--overwrite-authored` is passed. The migration is the one-time carry of `btnyc.json`; it is not a way to edit the source.

## What is duplicated, and what is not

| Fact | In `btnyc.json` | In the source | Drift detected by |
|---|---|---|---|
| Answers, prompts, fees, branches, pricing, tags, picker content, vocabulary, policy | yes (labels as keys, `then` maps) | yes (ids, `{question_id, option_id}` terms) | `project_legacy.js --check`: the projection of the source equals every authored section of `btnyc.json`, except the pinned normalizations |
| The eight compiler-owned keys (`compiled`, `routing_archetypes`, …) | yes (derived) | **no** (not authored) | `compiler_roundtrip.js`: the unchanged compiler, run on the source alone, reproduces all eight |
| Entity ownership, scope, uncertainty, confidence, retirement, recovery, decompositions | **no** | yes (source only) | `validate_source.js` (no parity needed: there is no second copy) |
| The derived graph | no | derived from the source | `derive_graph.js --check`: the committed graph is what the source derives |

The differences the parity check tolerates are pinned, in both directions, in `test_harness/tools/entity_first/declared_normalizations.js`. A difference that is not pinned fails; a pinned one that no longer occurs fails.

## Closing it

1. Repoint the consumers above to the derived graph (the runtime adapter; PENDING_DECISIONS #212 asks the Operator to schedule it).
2. Run the detector. When it prints `COMPLETE`, move `btnyc.json` to `archive/`, delete the transition tools and parity tests listed in the completion condition, and delete this file with a TIMELINE entry that says so.
3. If the end date passes first, add a `Reauthorized` line above with a reason and a new date, or roll back (delete `ssot/btnyc_source.json` and the tools; `btnyc.json` is untouched and still works, which is why the rollback is cheap).

Rollback condition: `btnyc.json` was not changed by T175, so deleting `ssot/`, `schema/btnyc-source.schema.json` and `test_harness/tools/entity_first/` and the four `verify_entity_first_*` tests restores the prior state exactly.
