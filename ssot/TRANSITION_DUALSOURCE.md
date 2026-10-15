# Dual-source transition: `btnyc.json` → `ssot/btnyc_source.json`

Rule: **R-SYSTEM-DUALSOURCE** ("Two Live Sources Are a Bounded Migration, Never a Steady State"). Opened by T175; **reconciled T176** against the Charter and the corrected Layer Map (`ssot/ENTITY_FIRST_DESIGN_NOTE.md` section 3.1 quotes the passages and classifies them). This is the transition ledger for it: the six fields the rule requires, the one fact a reader needs about which side is authoritative, and how an edit is made while both exist. The detector reads this file; the fields below are parsed, so keep their labels.

**What is being retired is a role, not a file name.** The Charter names `btnyc.json` as the derived runtime artifact ("`btnyc.json` is the derived runtime artifact the engine consumes; it carries a provenance reference to the source"). The retired thing is the hybrid `btnyc.json`: a file that is both hand-maintained authored knowledge and the runtime's input, with the compiler's generated keys mixed in. T175 wrote the completion as "`btnyc.json` is removed from the repository root"; that contradicted the Charter on the name and is replaced below.

## Ledger

- **Start:** 2026-10-14 (T175: the commit that adds `ssot/btnyc_source.json`; `btnyc.json` was until then the only source.)
- **Owner:** the Operator (`tommichael88`). The migration tooling is `test_harness/tools/entity_first/`; the Operator decides when the runtime moves (PENDING_DECISIONS #212).
- **Completion condition:** the retired role is gone, and the detector can show it. (1) `btnyc.json` is the published derived artifact: it carries a `$source` provenance reference (source path, source schema version, source sha256, derivation version) whose hash is the hash of the source as it now is, and it holds none of the hybrid's compiler-owned keys; (2) the publish command exists and `--check` passes (validate the source, derive, verify freshness and reproducibility, refuse otherwise); (3) the tools that exist only because there are two sources are deleted (listed under "Retired with it"); (4) no runtime consumer reads the authored source; (5) a runtime consumer reads the artifact. The legacy hybrid is archived under `archive/` at that commit.
- **Detector:** `node test_harness/tools/entity_first/transition_status.js` prints `COMPLETE` or `NOT COMPLETE` (and `OVERDUE` after the end date with no reauthorization), exit 0 / 1 / 3 (2 for a malformed ledger). It checks the five conditions above and names each one that is not met. Its own ability to say each of those is held by `test_harness/verify_entity_first_transition.js`.
- **Expected cost:** while both exist, a content change costs one extra edit and one parity run: the change is made in the source (by direct JSON edit, judged by `validate_source.js`; no tool or CMS edits the source yet), the id register is appended if an id was added (`id_register.js --write`), and what the legacy shape can express is carried to the mirror `btnyc.json` with `ssot_patch.js` and `splice_compiled.py` in the same commit; `project_legacy.js --check` proves the pair agree. The migration, projection and parity tools and the `verify_entity_first_*` tests are carried only for the period. The larger cost is not done or estimated by T176 and is the substance of the remaining work (#212): the publish command, the runtime adapter that reads the published artifact (the target modules named in `COMPONENT_LAYER_MAP.md`: resolver, confidence engine, composer, recovery engine, route builder), the `$source` provenance and interface-version work, and the CMS.
- **Target end date:** 2027-06-30. Set by the Operator on 2026-10-14 (PENDING_DECISIONS #212); it replaced the default of 2027-01-15 that T175 chose when nothing in the repository fixed a date. After this date, with the detector not `COMPLETE`, the transition must be closed, explicitly reauthorized below with a reason and a new end date, or rolled back. Silent extension is prohibited, and `verify_entity_first_transition.js` fails the suite until one of those is done.

Reauthorizations (none yet; each is a line `- **Reauthorized YYYY-MM-DD:** <reason>; new end date YYYY-MM-DD`):

## Consumers, artifact and retired tools

The detector parses the backticked paths on the lines below; `*` matches within one directory. **Consumers** are the runtime files that must read only the artifact and never the authored source. **Artifact** is the file the publish step writes. **Publish command** is the one place a derived file is written; it does not exist yet, which is one of the things the detector reports. **Retired with it** are the tools that exist only because there are two sources; the detector requires them gone at completion. (The legacy compiler `btnyc_v10_compiler.py` is not on that list: what happens to the legacy deriver once the publish step exists is a cutover-design decision, #212.)

**Consumers:** `qr.html`, `modules/*.js`

**Artifact:** `btnyc.json`

**Publish command:** `test_harness/tools/entity_first/publish.js`

**Retired with it:** `test_harness/tools/ssot_patch.js`, `test_harness/tools/splice_compiled.py`, `test_harness/tools/entity_first/migrate_legacy.js`, `test_harness/tools/entity_first/project_legacy.js`, `test_harness/tools/entity_first/declared_normalizations.js`, `test_harness/tools/entity_first/compiler_roundtrip.js`

Today the runtime in `qr.html` fetches `btnyc.json` and the modules under `modules/` (generated into the repository root by `extract_modules.js`) read the loaded global. The legacy compiler reads the authored sections and writes the eight compiler-owned keys back. None of them changes in T175 or T176: the runtime, and so the price golden master, cannot move in these changes (the golden master compares byte-identical before and after). Nothing that ships reads `ssot/btnyc_source.json` or the candidate graph, which is what condition (4) will keep true.

## Where the transition stands

| Phase | Source | `btnyc.json` | Runtime reads |
|---|---|---|---|
| P0, before T175 | did not exist | the hybrid, the only source | `btnyc.json` |
| **P1, now** | `ssot/btnyc_source.json`, authoritative | a hand-carried **mirror**: not an authority, held to the source by parity | `btnyc.json` (unchanged) |
| P2, completion | authoritative; edited through the CMS | the **derived artifact**, written only by the publish step, carrying `$source` | `btnyc.json` |

The derived graph (`ssot/derived/btnyc_graph.json`) is the pre-publication candidate. It has no runtime consumer yet; it is read by the freshness, reference and report tests and by the adapter that has not been written. That is a bounded exception to R-SYSTEM-INDEXPROXY, not a steady state (#212).

## What is authoritative, and how an edit is made while both exist

- **The source (`ssot/btnyc_source.json`) is authoritative.** It holds everything `btnyc.json` authors, plus what `btnyc.json` could not say: entity ownership, `entity_scope`, uncertainty classes and weights, confidence gates and policies, retirement relations, recovery affordances, decompositions. `btnyc.json` is no longer where a decision is made.
- **No tool edits the source.** Until the CMS or a source-editing tool exists, the source is edited as JSON by hand and judged by the validator; this is the temporary direct-edit path that R-SYSTEM-CMS permits as a bounded dual-source transition. It is the only human edit path to the knowledge; the mirror is not a second one.
- **A change that `btnyc.json` can express** (an answer, a fee, a prompt, a branch, a picker tile, a tag) is made in the source first, then carried into the mirror `btnyc.json` by `test_harness/tools/ssot_patch.js … --write` followed by `python3 test_harness/tools/splice_compiled.py btnyc.json --write`, in the same commit. `node test_harness/tools/entity_first/project_legacy.js --check` and `verify_entity_first_migration.js` fail on a pair that disagrees. A change made only in `btnyc.json` fails the same check; a change made only in the source that `btnyc.json` can express fails it too.
- **S1 to S5 of `RESHAPE_SCOPE_S1_S6.md` are not applied as patches to the mirror.** Their data halves are realized in the source (ids on every option, one reference spelling, ids not labels, no compiler-owned keys). A patch that moves the mirror toward that shape makes it differ from the projection of the source, and `project_legacy.js --check` fails it by design. The legacy `ssot_patch.js` and `splice_compiled.py` stay intact for the legacy shape; they edit the mirror and never the new source. After completion they are retired with the mirror.
- **A change `btnyc.json` cannot express** (a weight, a scope, a retirement, a decomposition, a recovery question) is made in the source only. It is checked by the validator (`validate_source.js`) and re-derived (`derive_graph.js`); the parity check does not see it, by design.
- **A new id is registered, a removed or renamed id is retired.** `node test_harness/tools/entity_first/id_register.js --write` appends new ids; removing or renaming one needs a written retirement in `ssot/migration/id_register.json` (reason, replacement, ledger ticket), or `verify_entity_first_id_freeze.js` fails.
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

1. Build the publish command (`test_harness/tools/entity_first/publish.js`): it runs validation, derivation, freshness and reproducibility, output validation, the id check and the compatibility check in order and writes exactly one file, `btnyc.json`, carrying `$source`. Decide the artifact's interface version (a separate R-INVARIANT-FROZEN decision, #212) and write the runtime adapter that reads it, so that `qr.html` and the modules read the artifact and never the source.
2. In one commit: publish `btnyc.json` from the source, archive the legacy hybrid under `archive/`, delete the tools listed under "Retired with it", and update this file and the TIMELINE. Run the detector; it must print `COMPLETE`.
3. If the end date passes first, add a `Reauthorized` line above with a reason and a new date, or roll back (delete `ssot/btnyc_source.json` and the tools; `btnyc.json` is untouched and still works, which is why the rollback is cheap).

Rollback condition: `btnyc.json` was not changed by T175 or T176, so deleting `ssot/`, `schema/btnyc-source.schema.json` and `test_harness/tools/entity_first/` and the `verify_entity_first_*` tests restores the prior state exactly.
