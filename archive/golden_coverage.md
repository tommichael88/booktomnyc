# golden_coverage.md -- PHASE_PLAN.md A1.6 (recorded before A2 begins)

> **Rule (PHASE_PLAN A1.6):** before A2, verify the golden master's coverage against the three entry paths and all pricing archetypes. Any collapse whose blast radius is outside that coverage stops and extends the golden's **inputs** before proceeding. The extended golden becomes the baseline for A2 onward; the original is preserved in `archive/` as a diff reference, not a live baseline. Extending inputs is not creating a second golden.

**Outcome.** The original golden covered every entity and every pricing archetype, but only one entry path's inputs (a catalog tap, quantity and first answer). Four dimensions that Phase A's collapses reach were outside it: **tag state, the chargeability gate, free-text entry, and the guided builder's dynamic-entity state** (plus the Other tile). They are now inside it. The golden went from **1,380 to 2,988 points** and the browser differential from **836 to 1,146 entries**, by adding new key families only: no original key or input changed (the original keys compare **0 differ** against the original capture). The original is kept as `golden_master_T154_original.json`; the extended capture, which is the A2 baseline, is `golden_master_T154_extended.json`.

## 1. What the original golden enumerated (1,380 points)

| Dimension | Original coverage |
|---|---|
| Entities | **all 76 services** and **all 82 dynamic entries** |
| Paths | `computeQuoteFromState` (state), `executeWorkflow` on a catalog context (orch), `computeUnifiedQuote` for dynamic entries |
| Quantity | 1, 2, 3, 5 for services; 1, 3 for dynamic |
| Answers | none, and the first answer of every non-quantity module |
| Tags | **none** |
| Entry paths | catalog tap only |
| Recorded | labor and minutes only |

## 2. Entity and archetype coverage (unchanged: every entity was already in)

| Pricing archetype (`financial_engine.pricing_archetype`) | Services | Original points | Added points (tags, gate, text) |
|---|---|---|---|
| `flat_simple` | 59 | 944 | 826 |
| `formula` | 4 | 64 | 56 |
| `hourly_timed` | 10 | 160 | 140 |
| `diagnostic_open` | 3 | 48 | 42 |

By `financial_engine.type`: {'flat_rate': 59, 'hourly': 13, 'formula': 2, 'assembly_formula': 2} (services); {'flat_rate': 32, 'hourly': 22, 'diagnostic': 27, 'assembly_formula': 1} (dynamic entries). By `pricing_engine`: {'algorithmic_flat_rate': 61, 'buy_the_hour_qty_gate_formula': 1, 'hardware_install_formula': 1, 'hourly_estimate': 8, 'assembly_formula': 2, 'furniture_repair_formula': 1, 'tile_repair_formula': 1, 'pax_wardrobe_formula': 1}. The archetype table counts every service, so a collapse touching "a `formula`-archetype entity" or "a `bypass_intake` service" is inside the golden **as an entity**; what was missing was the input dimensions below.
The six `bypass_intake` services and the one `requires_furniture_selection` service are among the 76. After T154, none of them self-quotes on a catalog tap (#113), so the self-quote *path* is exercised in the golden only through the free-text family's fallback route and counterfactual tests, not through a live service.

## 3. Entry paths (the plan's "three entry paths")

| Entry path | Original golden | Extended golden | Differential |
|---|---|---|---|
| **Catalog browser** (tile tap; Other tile) | catalog context: yes; Other tile: no | + `orch-other|` (28 points: every group with an uncovered service type) | card, panel, route, restart, 5 quote variants, prefill: yes |
| **Free-text bar** (`sqAnalyze` -> `collectBookingContext_freeText`) | **no** | + `text|` (176 points: each service's display name, a stated count, and a 24-phrase corpus; the parser is booted with `initNlpSets()` as `init` does) | not probed (the typed-text parse is Logic; covered by the golden's `text|` family) |
| **Guided builder** ("Write it for me": BLD -> `sqBuilderFinish` -> `sqPrepareFlow(true)` -> step 3) | **no** (state path always had a named service) | + `state-dyn|` (328: builder-shaped state, no named service, a dynamic entity resolved by category + type + group) and `dyn-tags|` (164) | + `builder:` (82: every dynamic entity, end to end, fresh page) |

## 4. Input dimensions added

| Family (key prefix) | Points | What it varies | Why Phase A needs it |
|---|---|---|---|
| `state-tags|`, `orch-tags|` | 304 + 304 | 3 smart tags valid for the service's category and group (two sets, first-3 and last-3), qty 1 and 2, on **both** public paths; records labor, minutes, confidence bar, active tags, checkout state | tag closure (`requires`), C-04; the original had no tags at all |
| `state-det|` | 304 | the same tags as *detected but unaffirmed* | the chargeability gate (`detTagsChargeable`): every row differs from the manual one, so the gate is observable |
| `state-dyn|`, `dyn-tags|` | 328 + 164 | builder state with no named service, tags none / A, qty 1 and 3 | C-05, C-09 and C-10 act on the builder / legacy path |
| `text|` | 176 | free text -> route: entity, template, labor, minutes, confidence, units, active tags | free-text entry path; C-02/C-03's callers; routing |
| `orch-other|` | 28 | the Other tile for every group with an uncovered type | the third catalog sub-path |
| differential `adlib:` | 228 | `sqBuildAdlib()` on a seeded session, default / 3 tags + location / qty 3 | C-09 (AC-27) |
| differential `builder:` | 82 | the guided builder end to end for every dynamic entity | C-05 (AC-13), C-09 |

## 5. Non-vacuity (each new family was tested against a mutant; a probe that cannot fail proves nothing)

* **Tag closure dropped** (`closeTagsOverRequires` loses its `requires` step): **178 points differ** in the extended golden (`state-tags` 88, `orch-tags` 88, `text` 2) and **0 of the original 1,380**. The original golden could not see this defect; the extended one does.
* **Ad-lib pluralisation** (qty 3 shown singular): `adlib:` family **75 of 76 differ**.
* **Builder seed changed** (`base` 0 -> 1, and `S.qty` +1): `builder:` family **82 of 82 differ**, both mutants.
* **A defect found by the first attempt.** My first `adlib:` probe seeded state with `prefillSmartQuoteFromService`; the mutant showed it was **vacuous** (0 differ). Cause: a catalog tap renders the curated card into `#sqSb3` and destroys the step-3 skeleton (`#sqAdlibSentence`, `#sqQtyV`, ...), so `sqBuildAdlib()` returned early and the family recorded empty strings. The probe was rebuilt on a fresh page with a seeded session. The same cause is a **customer-facing defect**, recorded as PENDING_DECISIONS #114 (after any tile tap, the guided builder throws).

## 6. Blast radius of each collapse against the extended coverage

| Collapse | What it touches | Inside the extended golden / differential? | Disposition |
|---|---|---|---|
| C-01 PE-21 `legacyDetermineSelfQuoting` | nothing live (no production caller) | n/a (dead) | land: delete |
| C-02 / C-03 NLP-19, NLP-20 | preview-only helpers | to be confirmed at A2 (callers) | see A2 |
| C-04 AR-02 `computeActiveTagIds` | the reducer's tag actions (never dispatched by live code) | tag families (state and orch) | see A2 |
| C-05 AC-13 inline confidence | the legacy builder / free-text path: step-2 skip and `S._confidenceStrategy` | `builder:` (end to end, no tags) and `state-dyn|` | see A2 |
| C-06 UI-46/71/77 | renderers' checkout-state reads | differential card / panel / prefill | see A2 |
| C-07 PE-10 | nothing (returns `[]`) | n/a (dead) | land: delete |
| C-08 ORCH-29 | tests only | n/a | land: delete |
| C-09 AC-27 | the ad-lib sentence DOM | differential `adlib:` and `builder:` | see A2 |
| C-10 AC-30 | self-quote ad-lib price | **no live service reaches it** (#113) | see A2 |
| C-11 constants | module-level constants | whole suite | see A2 |

## 7. Still outside (stated, not hidden)

* **Answers beyond the first** for each module, stype variation on the state path (it uses `'Repair'`), location hints and urgency phrasing beyond the corpus: none of the Phase A collapses reads these on a path the new families miss; each is covered by its own existing suite where it matters (`verify_location_hints_and_per_unit.js`, the answer-supersede and confidence suites).
* **Real clicks through the DOM** (as opposed to calling the handlers): `verify_customer_journey_visible.js` and the strict-visibility tests remain the evidence for that and are part of the suite baseline.
* The differential's `route:` entry renders through `renderCuratedCardFromRoute` for every service whatever the route's template; the other renderers are covered by their own tests (`verify_affirmation_card_ui.js`, the boundary test).
