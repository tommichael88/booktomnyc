# BTNYC — Agent Instructions

Read this file, then the five documents below in order, before editing.

## Read first (in this order)
1. `PROJECT_CHARTER.html` — durable product direction and architectural law (`R-`, `P-`, `G-`). When sources conflict, apply `G-GOVERN-PRECEDENCE` and surface the specific disagreement; the Charter is not a substitute for observing code or consulting the owning specification.
2. `COMPONENT_LAYER_MAP.md` — which module owns which concern. A change goes in the owning layer.
3. `TIMELINE.md` — append-only historical evidence. Read the newest five entries plus any directly relevant older entry; do not treat the whole history as a current task list.
4. `PENDING_DECISIONS.md` — current engineering/content ledger. Standing delegation makes documented defaults active; decide and record within that delegation, and raise only facts genuinely reserved to the operator.
5. `HANDOFF_CURRENT_STATE.md` — last recorded checkpoint, not live truth. Start with its newest update and verify dates, branch head, test baseline, and relevant behavior against the current repository.

## Current handoff (2026-11-09; supersedes the T198 brief's Track A/B/C, which are done)
**Done and on `main`:** A1 (masonry mounting identity), A2 (#251, a curated service is priced by its own contract), B (`BRANCH_PRESERVATION_REVIEW_T198.md`; the five historical branches are preserved as `archive/precleanup/*` and `master`, `legacy-archive`, `fix/charter-compliance-qr` are never deleted without an explicit operator ruling), C (operator digest). Do not restart them. `NEXT_SESSION_BRIEF.md` is history now; this section is the live queue, and no other task document is created.

**Queue, one bounded customer-facing slice at a time, each its own commit:**
1. The application suite runs on every push to `main` and on demand: `.github/workflows/application-suite.yml` (`npm ci`: jsdom, ajv-formats, puppeteer-core; Chrome; full history), compared with `archive/suite_T198.tsv`. The job prints the snapshot, and a dispatch input `only` runs a single test. Read that result before claiming a change is verified; GitHub Pages and CodeQL green say nothing about this suite. A tool-less local checkout cannot run the jsdom tests: use the workflow, do not edit tests to fit.
2. Wall material is not the job (B1, T198): the `yields_to` surface objects; the install-verb variant ("install a towel bar on concrete wall") is done in E1 (gate pending).
3. Done in T198 (D2+D3: #248 excluded_service_ids honoured on every path; resolved: gate run 42647321821, no pass->fail): Under-Sink Leak Repair no longer inferred `#emergency` and Slow Drain Clearing no longer "completely blocked" (C1). Cabinet Knob $95 / 3 min is the operator-ruled visit minimum (#112), working as designed. #252 resolved in D4 (gate run 42657553699, no pass->fail). Still open, in this order: #249; "clogged drain" inferring "completely blocked".

## Authority (the operator restated it on 2026-11-09)
`G-GOVERN-AUTONOMY`, `G-GOVERN-TRANSITION`, `G-GOVERN-PRECEDENCE`, `R-INVARIANT-DONE`, `R-CLIENT-PRESENTATION-ONLY` and `R-PRICE-PRECISION` already delegate ordinary engineering decisions to the agent: investigate, decide the correct behavior, make the smallest correction in the owning layer, verify the customer outcome, record the evidence, commit, move on. Do not ask the operator to approve implementation choices. Ask only for what the Charter reserves to the operator, a conflict with an explicit prior instruction, or a technician/regulatory fact; those stay identified in `PENDING_DECISIONS.md` and never block ordinary work. `PENDING_DECISIONS.md` is an evidence ledger, not an approval queue.

**End every session with this summary** (and nothing longer): 1. what improved for the customer; 2. what was verified and what remains unverified; 3. which commit holds the change; 4. whether anything actually requires the operator's decision (if not, say exactly "No operator approval required."); 5. the next smallest worthwhile customer-facing improvement.

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
- **The gate is evidence, not a vanity green count.** Run relevant behavior checks and the full suite when the environment permits; compare using `node test_harness/tools/suite_snapshot.js --out <new.tsv> --compare archive/suite_T198.tsv --jobs 6 --timeout 700` (replace the baseline with the latest committed one). As of T198 (a CI run with every declared dependency and Chrome, on `main` at `715bda5`): **230 pass, 6 known fail, 2 environment gaps**, recorded in `archive/suite_T198.tsv`; the six reds are the same as T197's. No new pass→fail, red→worse, silent removal, or unacknowledged environment gap. Do not describe the whole suite as passing; do not treat a pre-existing red as a newly introduced defect. A completed change also needs evidence of the intended customer-facing behavior.
- **`btnyc.json` is not hand-edited.** Written by `ssot/` tools (`carry_charter.js`, `migrate_legacy.js`, `splice_compiled.py`). Direct edits fail the parity and golden-master checks.
- **`TIMELINE.md` is append-only.** Never rewrite, never delete. Add a new entry.
- **The Charter is amended through `G-GOVERN-OVERRIDE`**, old text preserved. Never edit it silently.
- **A price or label change is a behavior change.** Record the measurement, then claim the work done.

## When a rule and the code disagree
Report what the current code does, what the owning specification requires, what the Charter protects, and the verification evidence (`G-GOVERN-PRECEDENCE`). Correct the responsible source or surface an actual governance conflict; do not silently prefer a test, a stale handoff, or a workaround.

## Work toward a customer outcome
Prefer one reproducible customer-facing failure and a bounded fix in its authoritative layer. State the before/after behavior first; identify the existing owner and a counterexample that would fail without the fix. Do not start a new migration, registry, refactor, or test-retirement sweep just to make unrelated progress indicators prettier. If structural change is genuinely necessary, use the already-authorized transition/governance path, with a measurable closure condition. Preserve price/routing diffs, document only evidence-backed findings in the existing ledgers, and stop when the customer outcome and applicable regression gates are demonstrated.

## Model
Sonnet 5.5, for everything. Where a document or tool names another model for a task (the Charter, `ssot/` migration, `btnyc.json` authoring, a customer-facing price or label change), keep the care that instruction asks for and do the work with Sonnet 5.5; do not report it as a decision for the operator.
