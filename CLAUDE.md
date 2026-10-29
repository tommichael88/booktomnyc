# BTNYC — Agent Instructions

Read this file, then the five documents below in order, before editing.

## Read first (in this order)
1. `PROJECT_CHARTER.html` — the Constitution. `R-` Rules, `P-` Principles, `G-` Governance. It wins any conflict.
2. `COMPONENT_LAYER_MAP.md` — which module owns which concern. A change goes in the owning layer.
3. `TIMELINE.md` — append-only, 190+ entries. Read the newest five, not the whole file.
4. `PENDING_DECISIONS.md` — open items with their defaults. Do not silently resolve one.
5. `HANDOFF_CURRENT_STATE.md` — the state at the last closeout (currently T187/T188).

## The tree in one look
- `qr.html` — the page. Logic lives in `modules/`, not inline.
- `modules/` — the engine: `pricing_engine`, `nlp_engine`, `orchestrator_engine`, `UIRenderer`, `AppController`, `resolver`, `artifact_compat`, `store`, `appReducer`, `cart_logic`, `trace`.
- `btnyc.json` — runtime catalog (~1.9 MB). **Never `Read` it.** Query with `jq` or the `ssot/` tools.
- `ssot/` — entity-first authored source (`btnyc_source.json`), the derived candidate, the migration.
- `schema/` — the source schema, the artifact schema, the interface contract. **The canonical schema is here.**
- `test_harness/` — `./run_all.sh` is the gate. `MASTER_TEST_SUITE.json` lists every test.
- `api/` — the chat-completions handler.
- `legacy/`, `archive/`, `deprecated/`, `ssot_t147_scripts/`, `page_template/` — historical. Do not edit; do not read by default.

## Hazards (things that will fool you)
- `qrqrqr.html` is an **older snapshot** of `qr.html`. Do not edit it, do not read it, do not compare against it.
- `btnyc_schema.json` at the root is **stale**. The canonical one is `schema/btnyc_schema.json`.
- `Privacy Policy.html` and `PrivacyPolicy.html` are two similar files. Neither is the page's privacy link target.
- `GIT_HEAD.txt`, `innerhtml_audit.json` are build artifacts.

## Non-negotiables
- **The suite is the gate.** `cd test_harness && ./run_all.sh`. Done = suite passes.
- **`btnyc.json` is not hand-edited.** Written by `ssot/` tools (`carry_charter.js`, `migrate_legacy.js`, `splice_compiled.py`). Direct edits fail the parity and golden-master checks.
- **`TIMELINE.md` is append-only.** Never rewrite, never delete. Add a new entry.
- **The Charter is amended through `G-GOVERN-OVERRIDE`**, old text preserved. Never edit it silently.
- **A price or label change is a behavior change.** Record the measurement, then claim the work done.

## When a rule and the code disagree
The Charter wins. A code violation is a defect for `PENDING_DECISIONS.md`, not a precedent.

## Model
Sonnet by default. `/model opus` for: the Charter, `ssot/` migration, `btnyc.json` authoring, and any change that alters a customer-facing price or label.
