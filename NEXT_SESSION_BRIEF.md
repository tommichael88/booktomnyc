# NEXT_SESSION_BRIEF.md — T198: customer correctness, preserved history, and owner-only decisions

**Approved working direction (2026-11-06):** one measurable customer defect at a time; preservation before branch cleanup; do not make the operator re-approve technical defaults. This brief is an instruction/handoff, **not** a new Charter or SSOT. The Charter, COMPONENT_LAYER_MAP.md, current code, and existing PENDING_DECISIONS.md remain governing. Do not silently override them.

**Starting tree:** latest `main`, which was `5096ec1c` when this brief was written. Recheck the head; do not blindly trust these dates. T197 closed #250 (all 76 exact published service names now resolve to themselves). `archive/suite_T197.tsv` is the latest recorded suite baseline: 234 tests, 228 pass, 6 known fail, 2 environment gaps. The saved gate used `--timeout 700` because `verify_draft_survives_navigation.js` exceeds 300 seconds under parallel load. GitHub Pages and CodeQL being green **does not** mean this application suite ran in CI.

## Track A — FIRST, one customer-facing defect at a time

### A1. Confirm or refute T197's generic-mounting-on-masonry misroute

**Evidence to reproduce:** `archive/typed_corpus_default_T197_diff.txt` reports `"wall mounting for any item on brick wall": undefined 90/80 -> shelf_mortar_mounting_buy_the_hour 358/150`. The historical pre-T197 price is evidence, **not** a required final price. The potential defect is *identity*: a generic mounting request was silently classified as a **shelf** solely from masonry words.

- Reproduce through the real customer free-text page route and the engine's direct equivalent. Read the T197 `mount` object in `ssot/btnyc_source.json` and the resulting authored `intent_mappings.objects`; identify which contextual override wins and why.
- Use independent expected **service identity and justified scope**, not self-generated route output: generic unspecified item on brick/concrete; a clearly named shelf on brick; a mirror on brick; TV on brick; general mounting on drywall; and confusing compound requests. Do not force a named shelf service when no shelf was supplied. An uncertain object may justifiably get a conditional/clarification route instead of a false precise quote.
- Fix the smallest owning authored relationship; do not add a second routing engine or a hard-coded special-case table. Keep real shelf-on-masonry coverage and the T197 76/76 exact-name guarantee. Test before/after quotes, visible customer amount **separately** from internal labor estimate, and the default/wide corpus. Explain every material route or price movement.
- Run targeted checks plus `node test_harness/tools/suite_snapshot.js --out <snapshot.tsv> --compare archive/suite_T197.tsv --jobs 6 --timeout 700` (or latest committed baseline). No newly introduced pass→fail or unexplained red→worse. **Deliverable A1:** a committed bounded fix if confirmed, with new counterfactual regression, before/after table, TIMELINE entry and a short operator summary. If disproved, record the exact reproduction and why the corpus was misleading, then move on.

### A2. Next separate slice: #251 pricing ownership

Only after A1 is closed: read `PENDING_DECISIONS.md` #251. A free-text named curated service should not inherit an object's dynamic fallback formula unless the service's **own authored pricing contract** requires it. Historical mismatches: Cabinet Door/Drawer Adjustment 35/75m typed vs 35/45m tile; Furniture Disassembly 93/80m vs 54/50m; Wall Hole/Crack Repair 90/135m vs 70/80m. Inspect the orchestrator `formulaId` precedence, the source's actual intended formula relationships, and all other curated consumers before changing the condition. No hand-waving away legitimate service-specific formula behavior.

Acceptance: equivalent scope and answers converge across catalog, builder and typed routes; the #251 declared exception list shrinks to zero only if genuinely correct; every changed price/route/time is attributed; preserve all known safe fallbacks. Commit and stop before starting the next unrelated issue.

### A3. Prioritized later issues (do **not** silently bundle them into A1/A2)

- Two independent evidence-precision questions to **investigate**: an exact `Under-Sink Leak Repair` title inferred `#emergency` (typed $125 vs tile $75), and `Slow Drain Clearing` inferred 'Standing water - completely blocked' (typed $105 vs tile $70). A quoted change is not proof of a defect unless its inferred answer is unsupported; protect against both false urgency and real urgent cases. Extend tests so “any answer exists” cannot by itself justify a quote difference.
- #248: service-specific `excluded_service_ids` aren't reliably applied; can affect inappropriate fee modifiers.
- #252: furniture `#water_damage` fact discarded by an object category even after a curated service resolves; constrain the data or ownership without raising unrelated assembly prices.
- #249: a typed count fails to answer the matching count question; lower priority because the ledger measured repeated friction, not an immediate price delta.

Each is a **new bounded slice**, not a new migration program. Do not alter the Charter, resume the parked CMS, or refactor the entire compiler as a prerequisite.

## Track B — SEPARATE preservation-first old-branch audit (non-blocking for A)

**The operator wants historical code retained, even if not active.** On 2026-11-06, GitHub returned **6 remote branches total, including `main`**, not “23 old remote branches”: `main`, `master`, `fix/charter-compliance-qr`, `legacy-archive`, `review/product-first-claude-guidance-20261105`, and `dependabot/npm_and_yarn/test_harness/npm_and_yarn-571e357d2d`. If a local checkout reports 23, inventory **local** branches separately from **remote**; never assume a stale branch count is current.

Facts worth protecting before deciding anything:
- `master` has **no common ancestor** with `main` and its root contains `Documents`. This is unrelated historical content, not a safe redundant branch. **Preserve; do not delete or force-merge.**
- `fix/charter-compliance-qr` diverges from `main` (one ahead / 66 behind when checked) and has a **large unmerged `qr.html` change**. It may contain valuable edits. **Preserve and compare carefully; never cherry-pick or overwrite production blindly.**
- `legacy-archive` is an older ancestor snapshot (0 ahead / 92 behind when checked). **Keep as a readable historical checkpoint**; do not overwrite its tip or merge unrelated history into it.
- `review/product-first-claude-guidance-20261105` was the doc-only PR #24 branch, merged by squash. Confirm final file parity against `main` and any references before considering it redundant.
- The Dependabot branch belongs to **open PR #23** (fast-uri update in `test_harness`). It is active until the PR is explicitly dealt with. Do not delete it first.

**Deliverable B1 — inventory, before cleanup:** create a concise `archive/BRANCH_PRESERVATION_REVIEW_T198.md` with, for *each* local and remote branch, tip SHA, last date, common ancestor or 'unrelated', ahead/behind, unique commits, diff summary, file paths worth retaining, whether any open PR / workflow / deployment / code references use it, and one disposition: KEEP ACTIVE, PRESERVE HISTORICAL, ARCHIVED REDUNDANT, or REVIEW WITH OPERATOR. Inspect actual content, not just branch names. Include the old `master` Documents and the big `fix/...` page diff. Compare tags and any local unpushed changes as well.

**Deliverable B2 — non-destructive preservation:** where historical unique commits or files need preservation, create durable named archive refs/tags pointing to **exact original tip SHAs** (e.g. `archive/precleanup/<slug>`), or dedicated archive branches. Verify the refs are fetchable and content is retrievable. If physical file organization matters, propose a *separate* archival copy under `legacy/`, without mixing unrelated histories into the existing `legacy-archive` branch. Keep source history accessible; snapshots without provenance are not enough. Do not assume a tagged-but-unpushed local object is safe. Don't discard uncommitted edits.

**Deletion policy:** no blind “delete 23 branches.” Do not remove `master`, `fix/charter-compliance-qr`, `legacy-archive`, or any open-PR branch without a separate explicit operator ruling. If a doc-only branch is proven redundant, permanently preserved by a fetchable archive ref, and unused by any PR/workflow/deployment, it may be cleaned up under the standing delegation **after listing the exact branch and preserved SHA in the report**. Do not prune remote-tracking refs before inventory. Leave ambiguous cases untouched.

**Deliverable B3 — report:** tell the operator exactly which branches are retained, which content is unique, which refs preserve history, and any **specific** deletion approvals genuinely required. No branch cleanup is needed to complete Track A.

## Track C — eliminate approval churn; summarize, do not multiply the ledger

`PENDING_DECISIONS.md` is an **evidence/history ledger**, not 86+ questions waiting for the operator. Its current top policy states:
- **🔧 SCHEDULED**: engineering/content work delegated to Claude, with default already decided.
- **🟡 OPEN (yours)**: a genuinely external business, technical-expert, legal, or Charter-authoring fact; none presently blocks the default.
- **✅**: closed history, not a task to revisit.

**Top table: 10 operator-owned entries**, grouped here without altering their status:
1. **Technician/external evidence:** #185 (six per-part fees/minutes, flat $125/135m retained as known-wrong pending technician), #183 (16 computer observation→part mappings for technician review), #203 (credible source/meaning of 55 flat-rate service duration ranges).
2. **Policy/regulatory scope, explicitly deferred by operator:** #230 (which services need permit/licensed-trade handling and hence should become non-quoted R3; current catalog is left as authorized). **Do not invent legal classifications** or treat “default remains” as permission to ignore known legal/safety requirements. Ask when actual legal/business evidence is supplied or a live compliance danger is discovered.
3. **Charter-owned wording/governance:** #241 (remaining Charter references-as-definitions), and #105(4), #120, #131, #132, #162 (other Charter-text/coverage proposals). Charter is not edited by Claude absent an operator-provided amendment.

**All other engineering findings**, including #248, #249, #251, #252, and branch audit work, stay Claude-owned; use the active defaults without filing questions to stall work. The open PR #23 is a dependency-update review, *not* an operator-required business ruling; Claude may verify it against its tests and report a recommendation. GitHub issue #22 remains open but past handoffs say fixed: verify before asking the operator to re-triage it.

**Deliverable C1 — short operator digest** in the final session report (and optionally a small section in the existing ledger, not a second backlog): “Need operator **now**”, “Await technician or regulatory evidence”, “Charter amendments for operator at leisure”, “Autonomous next slices”, “Resolved/history”. If **none** needs operator now, say “No approval required to continue.” Give each real question one recommended default and the source evidence. Avoid adding a new numbered backlog ticket for every observation or metadata discrepancy. If ledger status summaries are stale, make a minimal correction with evidence; do not rewrite the historical items.

## Session exit format

A short outcome report, not another grand plan:
1. **Customer outcome:** before → after behavior; actual user-facing price versus internal labor; fixed, disproved, or blocked.
2. **Evidence:** commit/PR link, tests and saved diffs; disclose environment gaps.
3. **Branch preservation:** count local vs remote; what is protected/archived; precise deletion approvals if any.
4. **Operator action:** genuinely required now, or explicitly “none”; technician/Charter/legal items can remain nonblocking defaults.
5. **Next smallest bounded customer fix**, not a new migration.

**No deletion of irreplaceable historical work. No broad migration. No automatic interpretation of all 🔧 items as waiting for approval.**
