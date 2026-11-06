# BTNYC — Agent Instructions

Read this file, then the five documents below in order, before editing.

## Read first (in this order)
1. `PROJECT_CHARTER.html` — durable product direction and architectural law (`R-`, `P-`, `G-`). When sources conflict, apply `G-GOVERN-PRECEDENCE` and surface the specific disagreement; the Charter is not a substitute for observing code or consulting the owning specification.
2. `COMPONENT_LAYER_MAP.md` — which module owns which concern. A change goes in the owning layer.
3. `TIMELINE.md` — append-only historical evidence. Read the newest five entries plus any directly relevant older entry; do not treat the whole history as a current task list.
4. `PENDING_DECISIONS.md` — current engineering/content ledger. Standing delegation makes documented defaults active; decide and record within that delegation, and raise only facts genuinely reserved to the operator.
5. `HANDOFF_CURRENT_STATE.md` — last recorded checkpoint, not live truth. Start with its newest update and verify dates, branch head, test baseline, and relevant behavior against the current repository.

## Fresh-session starting assignment — customer-facing routing, not another migration
**First objective: close `PENDING_DECISIONS.md` #250 (exact published service names misroute when typed).** This is the next bounded delivery, not an invitation to restart the S1–S6 migration, convert all consumers to the new artifact, rebuild the CMS, or clear every old test failure. The T195 ledger measured **58/76** exact names reaching their own service and identified **18** mismatches; that is a recorded baseline, **not** a substitute for reproducing today's behavior.

1. **Verify the starting state.** Work from the current `main` and read the #250 entry, the newest `HANDOFF_CURRENT_STATE.md` update, the relevant `COMPONENT_LAYER_MAP.md` ownership, and T195/T196 history. Capture each of the 76 published `ui_taxonomy.display_name` strings through the real typed-entry workflow. Save an explicit before table (input → service/route → questions/quote), including the 18 historical mismatches and any newly observed differences. Do not make the expected answer a copy of the implementation being tested.
2. **Fix the owned source, not a symptom.** Inspect `ssot/btnyc_source.json` `intent_mappings.objects`, aliases/synonyms, `default_service_sku`, and the T188 `ui_taxonomy.naming` source. Prefer authored mappings that the existing orchestrator/resolver consumes. Never add another parallel exact-name routing table, magic string matcher, or fallback branch to the page just to turn this test green. If the current model cannot represent a required relationship, name the specific broken premise and follow `G-GOVERN-RAISE`/`G-GOVERN-TRANSITION`; do not launch an unbounded reshape.
3. **Prove the outcome.** All **76/76** exact catalog names should reach the matching curated service through the *customer's actual text-entry path*, with its correct chain and justified quote. Compare the default and wide typed-phrase corpora for accidental reroutes, and attribute every golden-master price/route movement. Test representative ambiguous/near-match inputs so a safer fallback is not accidentally turned into an incorrect confident match. Run targeted tests plus the suite regression comparison against the newest committed baseline; record existing reds separately from new failures.
4. **Publish a bounded result.** Follow the documented SSOT → legacy mirror/overlay → derived graph process, including T195's commit-before-coverage-report ordering. Record observed before/after and the relevant rationale/endpoint in `TIMELINE.md` and the existing ledger. Commit a focused fix with its evidence; do not sneak in cleanup of #248, #249, compiler tests, CSS, or the parked CMS. Close the task when the stated behavior and gates are demonstrated, then summarize any still-open issue without beginning a new migration.

**Success = a customer who types a listed service gets that service's actual bookable scope and price, with no unaccounted regressions.** Report blockers only when genuine, with the exact reproduction and smallest viable next action; otherwise use the delegated default and complete the slice.

## The tree in one look
- `qr.html` — deployed page; some engine/controller/rendering blocks remain inline and are their canonical source until explicitly changed. Check the current `COMPONENT_LAYER_MAP.md` before editing.
- `modules/` — externally loaded modules and module reference copies, depending on the module. Do not assume a module file is the deployed source. The root extracted module files are generated references; verify load paths and edit the actual owner.
- `btnyc.json` — runtime catalog (~1.9 MB). **Never `Read` it.** Query with `jq` or the `ssot/` tools.
- `ssot/` — entity-first authored source (`btnyc_source.json`), the derived candidate, the migration.
- `schema/` — the source schema, the artifact schema, the interface contract. **The canonical schema is here.**
- `test_harness/` — `MASTER_TEST_SUITE.json` governs test membership; `./run_all.sh` executes the suite. Use `tools/suite_snapshot.js --compare` against the latest committed baseline to classify changes, not an all-green assumption.
- `api/` — the chat-completions handler.
- `legacy/`, `archive/`, `deprecated/`, `ssot_t147_scripts/`, `page_template/` — historical. Do not edit; do not read by default.

## Hazards (things that will fool you)
- `qrqrqr.html` is an **older snapshot** of `qr.html`. Do not edit it, do not read it, do not compare against it.
- `btnyc_schema.json` at the root is **stale**. The canonical one is `schema/btnyc_schema.json`.
- `Privacy Policy.html` and `PrivacyPolicy.html` are two similar files. Neither is the page's privacy link target.
- `GIT_HEAD.txt`, `innerhtml_audit.json` are build artifacts.

## Non-negotiables
- **The gate is evidence, not a vanity green count.** Run relevant behavior checks and the full suite when the environment permits; compare using `node test_harness/tools/suite_snapshot.js --out <new.tsv> --compare archive/suite_T196.tsv --jobs 6` (replace the baseline with the latest committed one). As of T196: **226 pass, 7 pre-existing fail, 2 environment gaps**. No new pass→fail, red→worse, silent removal, or unacknowledged environment gap. Do not describe the whole suite as passing; do not treat a pre-existing red as a newly introduced defect. A completed change also needs evidence of the intended customer-facing behavior.
- **`btnyc.json` is not hand-edited.** Written by `ssot/` tools (`carry_charter.js`, `migrate_legacy.js`, `splice_compiled.py`). Direct edits fail the parity and golden-master checks.
- **`TIMELINE.md` is append-only.** Never rewrite, never delete. Add a new entry.
- **The Charter is amended through `G-GOVERN-OVERRIDE`**, old text preserved. Never edit it silently.
- **A price or label change is a behavior change.** Record the measurement, then claim the work done.

## When a rule and the code disagree
Report what the current code does, what the owning specification requires, what the Charter protects, and the verification evidence (`G-GOVERN-PRECEDENCE`). Correct the responsible source or surface an actual governance conflict; do not silently prefer a test, a stale handoff, or a workaround.

## Work toward a customer outcome
Prefer one reproducible customer-facing failure and a bounded fix in its authoritative layer. State the before/after behavior first; identify the existing owner and a counterexample that would fail without the fix. Do not start a new migration, registry, refactor, or test-retirement sweep just to make unrelated progress indicators prettier. If structural change is genuinely necessary, use the already-authorized transition/governance path, with a measurable closure condition. Preserve price/routing diffs, document only evidence-backed findings in the existing ledgers, and stop when the customer outcome and applicable regression gates are demonstrated.

## Model
Sonnet by default. `/model opus` for: the Charter, `ssot/` migration, `btnyc.json` authoring, and any change that alters a customer-facing price or label.
