# SESSION_PLAN.md — operator mandate of 2026-10-10 (items B–H)

Status: **approved ("go") with three amendments and four notes; amended below. Item B landed (T159), waiting at the check-in; C–H not started.** Repo `btnyc_repo_T156`, branch `t158-adopt-operator-qr`, HEAD `3f27e83`. Charter `PROJECT_CHARTER.html` (2026-10-09) read in full.

Rule codes below are the Charter's own. Where a message cites a code that does not exist I say so in (v-b) instead of guessing.

**Amendment log (this revision).** Amendment 1: red-test classification added as section (0). Amendment 2: B's satisfaction boundary stated in (iii) B, feasibility unchanged. Amendment 3: the two big findings moved to "Findings surfaced" below. Notes A–D answered in (iii) B, C, F and D respectively. All v-a defaults accepted as written.

**Progress log.** B — landed as T159 (see `TIMELINE.md`), not committed. Deviation from the plan as written: the `confidence_gain` loop was deleted rather than kept as a labelled term (dead code: `sqPrepareFlow` is only ever called with `skipStep2 = true`); the reasons and every other difference are in the T159 entry, section 5. Foundational remainder: `PENDING_DECISIONS.md` #140; sweep findings: #141.

**C — landed as T160** (see `TIMELINE.md`), not committed. The nine `FALLBACKS` values live in `global_rules.fallbacks`; `FALLBACKS` is a read-only, guarded view of them; the one live `?? 60` reads `FALLBACKS.default_minutes`. Differences from the plan as written: (1) two literal `base_price || 70` copies in `modules/nlp_engine.js` now read `FALLBACKS.base_price` (a same-class sweep finding, G-INVARIANT-SWEEP); (2) `verify_ssot_boot_validation.js` went red when the catalog's key order changed (a latent defect in the checker's error paths, unescaped `/` in a key): fixed at the source and a directed mutation added; (3) the class detector also files every remaining numeric `??` / `||` default (20). Ledger: #142 (five SSOT duplicates), #143 (the minutes conflict, with what `default_minutes` means), #144 (the remaining defaults), #145 (deploy order and the new `nlp_engine.js` -> `qr.html` deploy-graph edge), #146 (resolved: `DEFECT-CHECKER-ESCAPING`, a sub-item of T160), #147 (what the 290 golden-master fallback reads are). Not touched: the three `|| 30` defaults and `?? 45` (they are #143).

**D — landed as T161** (see `TIMELINE.md`), not committed. `_sqPrepareFlowLegacyEscalation` and the `PHASE_B_FOLLOWUP C-05` held note are deleted; #116 and C-05 are closed, both items. Differences from the plan as written: (1) the plan said "exactly one reader of `escalate_complexity`"; it is **two** (`computeUnifiedQuote` reads it for the pricing tier), so the class detector holds the escalation *arithmetic* to one function and the readers to a filed list of two (#149); (2) `complexity_override` is a live field on intake answers (327), so the detector flags only the retired `effects.complexity_override` shape and is shown not to flag the live read; (3) one SSOT string is corrected: `confidence_escalation._note` named `complexity_override` as the tag field, the probable root of the drift. Ledger: #148 (resolved: the three cases, before `3f27e83` and after), #149 (the worst-tier loop exists twice), #150 (the schema still permits `effects` and a renderer reads it: retire or restore, 152 answers carry a fee no chip shows), #151 (two functions with no caller), #152 (the consultation audit matches comments; 5 more paths when stripped), #153 (the decided $50 dispatch-fee threshold is implemented nowhere; 58 of 76 catalog taps would lose the $45 fee). D changes nothing observable: golden master 0 of 2,988, render differential 0 of 1,146, the 40 guided-builder cells identical to the T160 tree.

---

## Findings surfaced

**F1. Non-retiring answers are a catalog-wide class, not two modules.** The Charter's delta check (price, time, branch, tier, risk tier, batch risk) run behaviorally against the pre-fix SSOT finds **25 fallback/confident-option pairs in 20 modules**. The Charter names two (`door_size`, `space_ready`); this session retires those two. The other **18 modules** are filed in `PENDING_DECISIONS.md` as one entry (over the 2–3 limit), and the shipped detector carries them as a filed list that can shrink but not grow. The SSOT has no "prep" channel, so the Charter's tuple cannot be checked on that axis at all; that is a finding too.

**F2. Most confidence bars cannot be cleared by answering questions.** I reported "27 of 76" earlier; that counted only the 48 services that author their own bar. Recomputed with the real `resolveBaseConfidenceStrategy` over all 76: **47 services have a `minimum_quote_confidence` above `base_confidence` plus every `confidence_gain` in their chain (52 when `maximum_followup_questions` is respected).** The Charter says a threshold the real questions cannot clear is a wrong threshold. Today catalog = 100 hides this (every catalog tap clears every bar), which is exactly the intent/scope conflation in B's "Remains". Not fixed this session; it is part of the foundational filing in B. The four appliance services in G were already below their bar before `space_ready` goes (40 + 20 < 80).

**F3. Red tests: 75 classified, none blocks B–H.** 33 infrastructure, 29 stale, 12 live defect, 1 now green. See section (0). Two interact with this session: the `angle_stop_replacement` raw/compiled drift (G regenerates `compiled.*`) and the ship-gate test's `@enforces` tags, which cite two codes the Charter does not declare.

**F4. Smaller items found on the way (G-INVARIANT-SWEEP, filed, not fixed):** `sqAnalyze` and the orchestrator disagree on routing for 4 of 76 named services; the 2026-10-09 Charter has no `R-INVARIANT-COMPLY` (see v-b 1).

---

## (0) Red-test classification (done before B; time-boxed)

Method: each of the 75 tests red in `archive/suite_T158.tsv` was run once, its first failures read, and the cause checked against the code or SSOT. Buckets use `G-INVARIANT-RETIRE-TEST`'s wording. Nothing here was fixed; filings are `PENDING_DECISIONS.md` #137 (stale batch), #138 (infrastructure), #139 (live defects).

**Infrastructure — 33.** The tool or loader cannot run, so the test says nothing about the code under test. Retarget, do not retire, where the behavior is still live.
- *I1, 14.* `cms_bridge.js` cannot find `_QTY_WORD_MAP` and `resolveCheckoutState` in `qr.html` and stops: `appliance_keywords_and_confidence_cap`, `cms_bridge`, `contextual_override_word_order_fix`, `delegated_vocabulary_batch_1`–`4`, `description_matching_mechanism`, `microwave_stove_ordering_fix`, `natural_phrasing_corpus_fixes`, `nlp_analyze_mode`, `plural_quantity_and_object_extraction_fixes`, `substring_collision_fixes`, `tile_drywall_formula_wiring`.
- *I2, 5.* Tests look for `btnyc_v10_compiler.py` at the repo root; it lives in `test_harness/`, and it looks for its schema at `test_harness/btnyc_schema.json` (now `schema/`): `archetype_layer_phase1`, `btnyc_v10_compiler.py`, `compiled_output_against_real_schema` (.js and .py), `routing_archetype_semantic_check`.
- *I3, 12.* The test sandbox does not define a function it calls (`DEFECT-STALE-SANDBOX`): `base_materials_fix` and `pax_wardrobe_formula` (`resolveQuantityUnits`), `ceiling_tile_dynamic_service` (`understandRequest`), `dish_washer_cross_entry_fix`, `nlp_incidental_keyword_fix`, `nlp_synonym_weights`, `object_based_resolver`, `smoke_test_findings` (`_nlpQuiet`), `object_extraction_location_skip` (`extractObjectDetailed`), `orchestrator_phase2`, `phase6_self_quote_rewire`, `waterproof_area_formula_fix` (`closeTagsOverRequires`).
- *I4, 2.* Browser tests whose selectors predate the T158 page (`#sqBuilder`, `.service-tile`, the four hosts): `ui_surfaces`, `customer_journey_visible`. A live defect behind them is not excluded: "replace 3 light bulbs" shows the intake screen where the test expects a self-quote screen.

**Stale, retireable — 29.** Guards retired behavior, or is over-fit to an instance.
- *S1, 13.* Guards a file, tool or function that no longer exists: `btnyc_v5_compiler`, `btnyc_v8_compiler.py`, `compute_quote_for_draft` (.js and .py), `dumb_ui_html_self_sufficiency`, `input_sanitization` (.js and .py), `nlp_engine_module` (retired in T136 per `retired/README.md`; still in the harness), `no_module_drift`, `smart_tag_reference_pathway`, `t107_tracing_corrections`, `tracing_tool_v2_upgrade`, `tracing_v3_full_instrumentation`.
- *S2, 6.* Source-shape checks on `sqBuildCuratedIntake`, which has zero hits in `qr.html`: `curated_card_chain_rewire`, `curated_intake_confidence_agreement` (crashes at baseline; the nearest precursor of B's detector), `mutual_exclusion_wired_into_main_render`, `reported_ui_bugs_batch1`, `confidence_strategy_inheritance`, `xss_fixes` (whose `escapeHtml` regex also misses the arrow-function form, although the function escapes all five characters).
- *S3, 9.* Pins an instance the code or SSOT has deliberately moved past: `category_icons_tabler_migration` (a `wall_mounting` icon string), `data_backup_question_wording`, `dynamic_archetype_batch_2b` and `2e`, `intake_defaults_meaningfulness_review`, `pricing_archetype_restoration` (counts 74/60/12/1 against 76 services), `furniture_flat_fee_pricing` and `pricing_engine_module` (the T135+ B2 fix deliberately stopped adding `flat_fee` to the price), `service_type_normalization_consolidation`.
- *S4, 1.* `file_integrity`: the manifest lists six files that no longer exist.

**Live defect — 12.** The current tree, or its data, is wrong.
- *L1, 4.* `angle_stop_replacement`: the raw chain is `[plumbing_fixture, angle_stop_condition]`, the compiled chain adds `hybrid_qty`. One cause, four tests: `raw_vs_compiled_reconciliation`, `self_quote_bug_fixes`, `self_quote_ui_template_invariant`, `orchestrator_engine_module` (which also has stale parts). `R-INVARIANT-RERUN`.
- *L2, 1.* `sqanalyze_orchestrator_equivalence`: 4 of 76 named services route differently (sqAnalyze finds nothing, the orchestrator picks a dynamic service). `R-CLIENT-CONVERGE`; routing, not confidence.
- *L3, 2.* SSOT hygiene: `no_orphaned_data`, `placeholder_data` (two services at `base_price` 0, one is `stove_repair`).
- *L4, 1.* `charter_rule_index_v2`: `tech_trouble_computer_repair` Install/Setup chains lack the symptom module their group requires; `hardware_install_formula` returns 95/100 where its own coefficients say 20/35 (38 quantities); `pricing_engine` and `orchestrator_engine` expose functions their declared API lists omit.
- *L5, 2.* The Charter document (operator-owned, not edited): `charter_rule_index_v10`, `charter_rules` (`R-GOVERN-INDEX` defined twice; `G-INVARIANT-DETECTOR` listed but undefined; `R-INVARIANT-DONE` listed among Principles). The ship-gate test also tags `@enforces R-INVARIANT-COMPLY` and `R-INVARIANT-NOLEGACY`, which the Charter does not declare.
- *L6, 1.* `r-invariant-deletion_declared_retirements`: retired names are still in comments (`sqBuildStep3` 13 hits, `sqRenderQuote` 9, `sqRenderSelfQuoteAdlib` 5). `R-INVARIANT-DELETION`.
- *L7, 1.* `r-system-layers_full_matrix`: AppController (30 functions) and `store.js`; known layer debt, Phase B.

**Now green — 1.** `r-invariant-comply_ship_gate` was red in the T158 baseline row and passes 13 of 13 today on the clean tree.

**Does anything block B–H?** No. Two interactions: L1 with G (a regeneration of `compiled.*` also rewrites the `angle_stop_replacement` entry, so G diffs the compiler's output on the pre-fix SSOT first and attributes every difference); L5's orphan tags with H (new detectors carry `@enforces` tags for real Charter codes only; that also gives `R-INTAKE-NONRETIRING` and `R-SYSTEM-SHAPE`, which `verify_charter_rules` lists as having no mechanism, their first one).

---

## (i) Understanding of the current state

Confidence is computed three times, and the three do not agree. `computeUnifiedQuote` scores by `base + min(20, keyword × 0.2)` whenever an intent key is present (a catalog tap seeds one) and by 100 only when there is none; `orch_compute_confidence` gives a catalog tap 100 (a deliberate v9.5 fix, because catalog taps "ALWAYS failed the confidence bar" under the keyword formula), a blended score for a group tile, and the keyword formula for free text; `sqPrepareFlow` adds the matched intent's weight, the sum of `confidence_gain` over answered modules, and the base. I measured it: the state path and the orchestrator disagree on the bar verdict for 76 of 76 catalog taps. The guided builder also calls `_sqPrepareFlowLegacyEscalation`, which reads `effects.complexity_override` (no tag has it) instead of `escalate_complexity` (`#brick_wall`, `#fragile_item` have it), so it never raises the bar for those two tags and the orchestrator does. The SSOT has no uncertainty ledger, no class weights and no Cᵢ/Cₓ split, so `confidence_gain` is a nominal increment, which `R-CONF-ACCOUNTING` calls non-authoritative legacy metadata.

Around that: nine business numbers and strings sit in a frozen `FALLBACKS` object in `pricing_engine` (12 read sites; `default_minutes` has none); the tier ranking is declared three times live plus once in the held duplicate; `cart_logic` exists inline and as `modules/cart_logic.js`; and `door_size` / `space_ready` are the two modules the Charter names as non-retiring. The ship gate (`verify_r-invariant-comply_ship_gate.js`; the Charter's rule behind it is `R-SYSTEM-LAYERS`) is green at HEAD but turns red the moment `sqPrepareFlow` is touched, because that function already violates its layer. The boot gate validates shape only; it does not check thresholds. Baselines I will hold to: price golden master 0 differ of 2,988; render differential 0 of 1,146; suite 114 pass / 75 fail of 189 (`archive/suite_T158.tsv`); tsc baseline.

---

## (ii) Files I will edit, in order

| # | File | Item |
|---|---|---|
| 1 | `test_harness/verify_confidence_convergence.js` (new) — **run on the pre-fix tree first** | B |
| 2 | `qr.html`, pricing_engine block: `resolveConfidence`, `computeUnifiedQuote`, `buildServiceSessionSeed` (entry term), plus the Logic function(s) `sqPrepareFlow` needs | B |
| 3 | `qr.html`, orchestrator block: `orch_compute_confidence` becomes a delegate (same signature) | B |
| 4 | `qr.html`, AppController block: `sqPrepareFlow` delegates; then delete `_sqPrepareFlowLegacyEscalation` and the held-note comments above and inside `sqPrepareFlow` | B, D |
| 5 | `btnyc.json` `global_rules.fallbacks`; `schema/btnyc_schema.json` (required + typed); `qr.html` `FALLBACKS` becomes a Proxy; regenerate `test_harness/_extracted_engine.js`; fixtures with hand-built DBs | C |
| 6 | `qr.html`, pricing_engine block: one frozen `TIER_RANK` | E |
| 7 | delete `modules/cart_logic.js`; five inline block headers (and `nlp_engine.js` only if its header is wrong); `verify_cart_logic.js`; `COMPONENT_LAYER_MAP.md` (module row, §6 note); `_qr_blocks.js` comment | F |
| 8 | `test_harness/verify_intake_delta_check.js` (new, **run pre-fix first**); `btnyc.json` (delete `door_size`, `space_ready`, their chain/`then` references, thresholds of the 4 appliance services); regenerate `compiled.*` with `btnyc_v10_compiler.py`; `qr.html` `COMPONENT_MODULE_NAMES`; the 11 test files that name the two modules | G |
| 9 | `test_harness/verify_architectural_conformance.js` (new; before/after outputs captured); `TIMELINE.md` (T159–T165); `PENDING_DECISIONS.md` (#137 onward); `MASTER_TEST_SUITE.json`; file-integrity manifest | H |
| 10 | After every `qr.html` edit: `extract_modules.js` (root copies are generated, gitignored) | all |

---

## (iii) Per item: rules, mechanism, feasibility

**Protocol for every item** (Pre-Change Checklist, `G-INVARIANT-PREFIX`, `R-GOVERN-TRANSITION`): write or extend the class detector → run it on the current (pre-fix) tree and keep the output → run the affected suites for a before state → make the smallest change → run them again → compare golden master, render differential, suite snapshot and ship gate → TIMELINE entry → **stop and check in**. New detectors read the tree root from an environment variable (I add the override to `test_harness/_page.js` if it lacks one), so the final combined pre-fix run is made against a worktree of `3f27e83`, an unmodified tree, and not just reasoned about.

### B — one confidence resolver · feasibility: medium (~60%)

- **Rules:** `R-CONF-ONEFORMULA`, `R-CLIENT-CONVERGE`, `R-INVARIANT-CANONICAL`; `R-CONF-ACCOUNTING` and `P-CONF-NOQUESTIONMATH` are **flagged, not satisfied** (see v-a 1). Adjacent class: `DEFECT-DUPLICATE-PARSER`.
- **Mechanism:** `resolveConfidence(evidence, DB)` beside `applyLiveConfidenceEscalation` in pricing_engine (Logic, same layer as the orchestrator, no layer crossing). Evidence = entry, match confidence, resolved strategy, active tags, answered modules. Entry is a term (catalog / group tile / free text / guided), not a formula. `minConf` and `escalatedBy` always come from `applyLiveConfidenceEscalation`. Returns `{score, minConf, escalatedBy, source}`; `source` names the terms that produced the score. `computeUnifiedQuote`, `orch_compute_confidence` (signature kept) and `sqPrepareFlow` delegate; the inline `totalConfidence` (3103–3105) and the gain loop (11492–11563) are deleted.
- **Canonical:** the orchestrator's entry-type scoring (executable reality, documented v9.5 fix). Where the state path or the guided builder differs, the canonical wins and the change is ledgered with before/after numbers. If the sweep shows the canonical is wrong for a cell, I amend it and say why.
- **Detector:** `verify_confidence_convergence.js` drives the real gateways (state path, orchestrator, guided builder in an assembled page) over a matrix of service × tag set (none / `#brick_wall` / `#fragile_item` / both) × answers × entry, and asserts identical `{score, minConf, escalatedBy}` for equivalent evidence. Expected to fail pre-fix on catalog taps, on the two tags in the guided builder, and on gain counting.
- **Landing:** two commits (orchestrator + state path first; `sqPrepareFlow` second).
- **Lands:** one function, three implementations retired, cross-gateway convergence on the current model. **Remains:** `R-CONF-ACCOUNTING`, the Cᵢ / Cₓ split, and resolution of `DEFECT-AXIS-CONFLATION` (with F2's unreachable bars) — filed as one foundational `PENDING_DECISIONS.md` entry with a migration plan. B's success claim covers only what lands.
- **Note A (ship-gate reshaping):** if making the ship gate pass reshapes `sqPrepareFlow` more than expected, that reshaping gets its own ledger line (with its own before/after) and is not merged into B's success claim.
- **Risks:** (a) `sqPrepareFlow` already violates its layer, so touching it turns the ship gate red unless the remaining non-Glue statements move to Logic in the same change (default, see v-a 2; reported under Note A); (b) entry markers written in AppController `prefill*` / `sqAnalyze` are also touches, so I will derive the entry in Logic where I can; (c) if the builder's gain sum cannot be expressed as the same evidence the other two gateways receive, I surface it (`G-GOVERN-RAISE`) instead of forcing equality.

### C — `FALLBACKS` into the SSOT · feasibility: high (~85%)

- **Rules:** `R-SYSTEM-NODATA`, `R-SYSTEM-DECLARATIVE`, `R-SYSTEM-SHAPE`.
- **Mechanism:** all nine keys to `global_rules.fallbacks` (values copied literally); schema adds the property, lists all nine as required and types them; `FALLBACKS` becomes a Proxy that reads `DB.global_rules.fallbacks` on every access and **throws naming the key** if it is missing (no in-code default, which would put the number back). Set/delete traps throw. The 12 read sites and the two AppController sites keep their text. `default_minutes` has no reader, so I wire the one live literal that carries its meaning (`?? 60` at qr.html 1504) to it, otherwise the migration would move an unread number. Boot gate re-run on the real SSOT; schema negative test (drop one key → gate fails).
- **Note B (when the Proxy can throw):** I checked. Every read is inside a function, but `DB` is `let DB = null` (qr.html 808), assigned only at 12281, after the fetch (12246) and the boot gate (12262); the code reads `window.DB?.…` with optional chaining in places, so a read before assignment cannot be ruled out by inspection. So the Proxy carries a **DB-not-loaded guard**: before assignment it throws "FALLBACKS.<key> read before the SSOT loaded" (distinct from "key missing from global_rules.fallbacks"), and it never returns a default. A real-page boot test counts reads before `DB` is set and asserts zero.
- **Detector:** AST class detector over Logic blocks: no module-level object literal of bare business numbers/strings assigned to a `FALLBACK*` name; numeric literals as `??`/`||` defaults in Logic functions checked against a filed ratchet list (it can shrink, not grow); behavioral: remove each of the nine keys from a DB copy and the engine names it.
- **Does not land:** "zero numeric literals of these nine values in pricing_engine.js" as a literal grep (see v-b 3).

### D — retire `_sqPrepareFlowLegacyEscalation` · feasibility: high (~90%, given B)

- **Rules:** `R-INVARIANT-CANONICAL`, `R-INVARIANT-DELETION`, `R-CLIENT-CONVERGE`, `R-INVARIANT-DUPLICATION-TICKET`. Releases the held note `#116` / `PHASE_B_FOLLOWUP C-05`.
- **Mechanism:** B's delegation already routes the builder through `applyLiveConfidenceEscalation`, so D is: delete the function and both held-note comments; completion = grep for the name returns zero. Ledger the three cases (`#brick_wall`, `#fragile_item`, neither) with before (`3f27e83`) and after score / minConf / skip-step-2 verdict. The B check-in will already carry these numbers; D's entry cites them.
- **Note D (the held note records two items):** the `C-05` / #116 note names (1) the inline confidence accumulation in `sqPrepareFlow` (AC-13) and (2) the duplicated escalation block. Item (1) is resolved in B (the loop moves into `resolveConfidence`), item (2) here. The D ledger entry cites both, and the T161 entry closes `C-05` and #116 explicitly.
- **Detector:** retired artifact → assert absence (`P-GOVERN-GOODHART`); class: exactly one reader of `escalate_complexity`, none of `effects.complexity_override`; behavioral: builder escalates for both tags.

### E — one `TIER_RANK` · feasibility: high (~95%)

- **Rules:** `R-INVARIANT-SINGLEDEF`; class `DEFECT-DUPLICATE-REGISTRY`.
- **Mechanism:** `Object.freeze({routine:0, skilled:1, specialized:2})` at module level in pricing_engine; readers at 1177 `RANK`, 1222 `TIER_ORDER`, 2700 `RANK` switch to it (the fourth copy, 11414, goes with D). `(RANK[x]||0)` semantics are unchanged because routine is 0.
- **The four siblings:** `QTY_AWARE_FORMULAS`, `FORMULA_CONSUMED_KEYS`, `CS_RESTRICTIVENESS`, `PICKER_ENABLED_GROUPS` are each declared once in my read; I re-check with an AST scan of same-valued literals at the start of E and extract only a real duplicate. Expected: none. Wrong-layer cases (for example `PICKER_ENABLED_GROUPS` in the renderer; `COMPONENT_MODULE_NAMES` in the renderer mirroring SSOT module keys) are named as separate findings and not fixed.
- **Detector:** no two structurally equal constant object/array literals (≥3 entries) across the assembled page, with a filed allowlist.

### F — one `cart_logic`, honest headers · feasibility: high (~90%)

- **Rules:** `R-INVARIANT-SINGLEDEF`, `R-SYSTEM-SCRIPT`.
- **Direction:** delete `modules/cart_logic.js`, keep the inline block (it is what runs; nothing loads the file). The Layer Map says "not yet loaded from it", so extraction is the evident later direction; that is v-a 3.
- **Headers (Note C):** each of the five inline blocks (`pricing_engine`, `orchestrator_engine`, `UIRenderer`, `cart_logic`, `AppController`) gets an explicit deployment statement in place of any `<script src>` claim: *"Deployment: single-file `qr.html` is the deployment unit. This block runs inline from qr.html; any standalone `<name>.js` (repo root or `modules/`) is a reference artifact generated by `test_harness/extract_modules.js`. Edit qr.html."* Header markers stay (`_qr_blocks.js` finds blocks by them). Scope caveat: that statement is true of the five inline blocks only. `nlp_engine.js`, `appReducer.js`, `store.js` and `trace.js` are loaded by `<script src>` from `modules/` in production, so for those the `modules/` file **is** the deployed artifact; I leave their headers alone unless one is wrong, and the check-in will list what I checked.
- **Detector:** no module exists both inline and as `modules/X.js`; every header's claimed load shape equals the page's real one.

### G — retire `door_size` and `space_ready` · feasibility: medium (~65%)

- **Rules:** `R-INTAKE-NONRETIRING`, `R-INTAKE-WIREREMOVE`, `P-CONF-NOQUESTIONMATH`; class `DEFECT-NON-RETIRING-ANSWER`; `R-INVARIANT-DELETION`, `R-SYSTEM-SHAPE`, `R-INVARIANT-RERUN` (regenerate `compiled.*`, never hand-edit).
- **Detector first:** the Charter's delta check, behavioral (drives `executeWorkflow` for each option, compares the tuple price / time / branch / tier / risk tier / batch risk). The SSOT has no "prep" channel, so the tuple is checked without it and the missing channel is a finding. The 25-pair / 20-module result and what happens to the other 18 modules are in **Findings surfaced, F1**; the detector carries them as a filed list that can shrink but not grow.
- **Compiled-data attribution:** `compiled.*` is regenerated with `btnyc_v10_compiler.py`, never hand-edited (`R-INVARIANT-RERUN`). Because the committed `compiled.*` already disagrees with the raw chain for `angle_stop_replacement` (section 0, L1), I first diff the compiler's output on the unmodified SSOT against the committed `compiled.*` and attribute every difference, so the G diff shows only G's changes and L1's drift is ledgered separately.
- **Change:** delete both module definitions; remove the `then` entry `"No, I need you to procure it": ["door_size"]` from `client_supplying_door`; remove `space_ready` from the four services that own it (microwave, washer, dishwasher, refrigerator install); remove `door_size` from `COMPONENT_MODULE_NAMES`; update the stale `_confidence_cap_reason` text on `prehung_interior_door_install`; retarget the 11 tests to assert absence.
- **Thresholds:** `prehung_interior_door_install` is not at risk (remaining modules sum to 120 + base 40, against a bar of 80). The four appliance services become the first services with an **empty** `intake_chain` (none today); their bar of 80 against a base of 40 is unreachable (and was already unreachable with `space_ready`: 40 + 20 < 80; see F2). Default: lower `minimum_quote_confidence` to the confidence their remaining evidence can reach (their base, 40) and `maximum_followup_questions` to 0, with a `_note` giving the derivation (`G-GOVERN-AUTONOMY`: catalog data, `_variability_tier: low`). I drive those four services in a real browser; if an empty chain breaks any path, I surface it (`R-GOVERN-TRANSITION`) and do not work around it. That is the main risk to the estimate.

### H — conformance detector and ledger · feasibility: high (~90%)

- **Rules:** `R-INVARIANT-DISEASE`, `R-GOVERN-TRANSITION`, `R-GOVERN-ANTISTALE`, `P-GOVERN-GOODHART`.
- **Tags:** each detector carries `@enforces` tags for real Charter codes only (an orphan tag fails `verify_charter_rules`).
- **Mechanism:** `verify_architectural_conformance.js` holds one class detector per rule landed: one confidence resolver (runs the B sweep), no Logic-layer business-number carriers (C), one escalation path and absence of the retired function (D), no duplicate registry (E), no duplicate module source and truthful headers (F), the delta check (G). Behavioral where the rule is behavioral; source-shape only for E and F, where the rule is about source. Pre-fix and post-fix outputs both captured in the check-in; every detector must fail on `3f27e83`.
- **Ledger:** one `TIMELINE.md` entry per landed item (T159 B, T160 C, T161 D, T162 E, T163 F, T164 G, T165 H): rule codes, the workaround the old shape forced, the endpoint, the defect class, the detector. Anything I file goes to `PENDING_DECISIONS.md` with "Default if unanswered".

---

## (iv) Proposed for a future session

| Item | Why not now |
|---|---|
| `R-CONF-ACCOUNTING` migration: uncertainty classes, SSOT weights, Cᵢ / Cₓ split, τₓ policy, retiring `confidence_gain` | Needs data the SSOT does not have (foundational, `R-GOVERN-TRANSITION`). B flags it and files the migration plan. |
| `deriveComplexityTier` (`f(minutes)` → `complexity_profile`) | Out of scope as you set it. I file the entry with a migration plan. |
| Renderer boundary sweep (the 11 `R-INVARIANT-BOUNDARY` violations) | Out of scope. I enumerate them from the boundary test's own output and land at most one, only if small and safe. |
| `resolveGroupFromIntent` routing tables → SSOT | Out of scope. I file which tables and which consumers. |
| Provenance migration; anything in `trace.js`, CSP, schema auth, service worker | Out of scope. |
| 18 other non-retiring modules, and a "prep" channel | Over your 2–3 limit. Filed, with the detector's ratchet holding the line. |
| 47 of 76 services whose bar exceeds what their chain can reach (F2; I earlier said 27) | Policy question (lower the bar or add evidence); part of the foundational filing in B. |
| The 75 red tests: 29 stale to retire (#137), 33 infrastructure to retarget (#138), 12 live defects (#139) | Classified only; fixing is separate unless one blocks B–H (none does). |
| Four `FALLBACKS` values that duplicate existing SSOT facts (70, 85, 45, 40); the generic fallback in `resolveBaseConfidenceStrategy` (70/3/35/40); three conflicting default-minutes (30, 45, 60); entry-term coefficients (45, 15, 0.15, 20, 0.2) and the orchestrator's `|| 70`, `|| 5` | Moving them changes behavior or needs a pointer mechanism. Filed. |
| `COMPONENT_MODULE_NAMES` / `PICKER_ENABLED_GROUPS` wrong-layer registries; the instance-list `SINGLEDEF` check in `verify_charter_rule_index_v10.js` | Named in E; not fixed. |

Spare time, in your order and only after H: (1) AST sweep for more `DEFECT-DUPLICATE-REGISTRY` (small fixed, large filed); (2) sweep for caller-side `||`/`??` composition of a resolver return (`DEFECT-ARBITRATION`; small fixed, large filed); (3) next-session write-up appended below. Nothing outside the mandate.

---

## (v) Questions

### (v-a) Decisions needed — each has a default, so "go" accepts all of them

1. **`confidence_gain` and catalog = 100 (`G-GOVERN-SURFACE`).** Your item B says the gain loop's semantics must survive; `R-CONF-ACCOUNTING` says `confidence_gain` must never be consumed as a direct Cₓ increment. Also, catalog = 100 is an intent score that swallows scope uncertainty, which `R-CONF-ONEFORMULA` says a catalog tap must not do (`DEFECT-AXIS-CONFLATION`). **Default:** keep both, but inside `resolveConfidence` as named, labelled legacy terms (`source` shows them), flag them under `R-CONF-ACCOUNTING`, and file the ledger migration. Nothing is silently preserved and nothing new is invented.
2. **Ship gate vs `sqPrepareFlow`.** Touching it turns the ship gate red. **Default:** move its remaining non-Glue statements to a Logic function in the same change (more work, gate stays green). The alternative is to stop and ask you; I do not intend to edit the gate or pass it with a comment trick.
3. **(F) direction.** **Default:** delete the standalone, keep inline. Say so if you want the reverse (inline block replaced by `<script src>` to the hosted `modules/cart_logic.js`); that is a deployment change on your side.
4. **(C) values that duplicate SSOT facts.** `base_price` 70, `tier_rate` 85, `dispatch_fee` 45, `standard_labor` 40 already exist elsewhere in `btnyc.json`. "All nine or none" means four facts will briefly live in two SSOT places. **Default:** migrate all nine literally and file the collapse.
5. **`default_minutes`.** **Default:** wire the one live `?? 60` literal to it; leave the three `|| 30` defaults and `?? 45` for the filed conflict.
6. **Equivalence sweep vs the standing "no new golden / parity / equivalence tests" rule** (PHASE_PLAN, Layer Map §6). **Default:** the sweep is a class detector (no frozen outputs, drives the real gateways), allowed by `R-INVARIANT-DISEASE`; I add a one-line §6 note saying so.
7. **Appliance thresholds** (G). **Default:** bar 40, questions 0, `_note` with the derivation. This is a pricing-precision call; tell me if you want a different number.
8. **B and D order.** **Default:** your order; B's delegation carries the escalation change, D deletes the dead function and ledgers the three cases.

### (v-b) Corrections to the mandate's premises — no decision needed

1. `R-INVARIANT-PREFIX` does not exist; the Pre-Change Checklist and prefix rule are `G-INVARIANT-PREFIX`. `R-INVARIANT-ANCHOR` is "adjacent" at best; the header fix is cited under `R-SYSTEM-SCRIPT` and `R-INVARIANT-SINGLEDEF`. Likewise `R-INVARIANT-COMPLY` and `R-INVARIANT-NOLEGACY`, which the ship-gate test tags with `@enforces`, are not declared in the 2026-10-09 Charter (it has `R-SYSTEM-LAYERS` and `P-INVARIANT-NOLEGACY`); I cite the Charter's codes and leave the test's tags to #139.
2. The tier ranking is `RANK` in two live functions, `TIER_ORDER` in `deriveComplexityTier`, and `RANK` in the held duplicate. `FALLBACKS` has 12 read sites, not about 20.
3. "Zero numeric literals of these nine values in pricing_engine.js" cannot hold as a grep: 60 is also minutes per hour, and 70 / 40 also appear in the generic confidence fallback inside `resolveBaseConfidenceStrategy`, which means something else. I replace it with the class detector in C and say so in the entry.
4. `nlp_engine.js` is external (loaded by `<script src>`), unlike the other five listed modules.
5. `space_ready` is owned by **four** services, and removing it leaves their chains empty. `door_size` is reachable only through a `then` branch, and is also named in the renderer's `COMPONENT_MODULE_NAMES`.
6. `prehung_interior_door_install` will not fail its threshold after `door_size` goes (see G). The boot gate does not check thresholds in any case.
7. The held note (`PHASE_B_FOLLOWUP C-05`, #116) is a comment block at qr.html 11393–11411 plus a tag at 11589. Both are removed with the function in D.

---

## Next-session priorities

*(appended after the work lands; empty until then)*
