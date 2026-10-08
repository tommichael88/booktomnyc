# COMPONENT_LAYER_MAP.md

Authored `T135`. Referenced by name since `T60` but never actually present
in this project's tracked files before now — `verify_file_integrity.js`
and `verify_tag_affirmation_route.js` both reference it defensively (the
former skips it gracefully if absent; the latter only mentions it in a
comment), so its absence broke nothing, but the charter's own `#ecosystem`
table (Zone 4) names it as the authoritative owner of "canonical
vs. legacy module map · BookingContext field contract · layer
assignments" -- confirmed directly against the operator's `T135`+ charter
rewrite, which restructured the charter into 5 Zones and moved this kind
of current-state content out of the charter itself and into exactly this
file. This is that record,
built by direct inspection of the current `qr.html` (line numbers current
as of `T135`; re-verify before trusting them in a much later session —
this file drifts the same way any other derived-from-code document does).

## How to use this file

Per the charter's own `#pre-change-checklist` (Zone 4): **before touching anything that looks like legacy
code, read this file.** It exists specifically because a "clearly safe"
legacy function once turned out to be the only real implementation of a
charter-level feature (`T59`). Before extending, fixing, or deleting
anything below, confirm its status here is still accurate — a status
recorded once can go stale exactly like any other claim in this project.

## The four layers, and where they actually live

`qr.html` is one file with 7 named `<script>` blocks, each corresponding
to one of the charter's module names, plus `<script>` blocks that carry no module header (the `inline` row). Verified boundaries, `T144`:

| Module | Layer | `qr.html` block starts | Ends (next block) |
|---|---|---|---|
| `pricing_engine.js` | Logic/Engine | line 907 | 3335 |
| `nlp_engine.js` | Logic/Engine | line 3335 | 5605 |
| `orchestrator_engine.js` | Logic/Engine | line 5605 | 7108 |
| `UIRenderer.js` | UI/Renderer | line 7108 | 11756 |
| `AppController.js` | Controller/Glue | line 11756 | 14049 |
| `appReducer.js` | Logic/Engine | line 14049 | 14807 |
| `store.js` | Logic/Engine | line 14807 | 15034 |
| `inline` | Controller/Glue | -- | -- |
| `btnyc.json` | Knowledge (SSOT) | -- | -- |

**How the structural tests read this table (`T144`).** `verify_r-system-layers_full_matrix.js`,
`verify_r-invariant-comply_ship_gate.js` and `verify_r-invariant-boundary_ui_renderer_layer.js` read the
**Layer** column: every function in a module belongs to that module's layer (`Logic/Engine`, `UI/Renderer`,
`Controller/Glue`; `Knowledge (SSOT)` for `btnyc.json`). `inline` covers the `<script>` blocks with no module
header (the bootstrap IIFE, the route dispatcher, service-worker registration). **The assignments here are the
authority**: a test never reclassifies a module to improve its own number (`R-GOVERN-GOODHART`) -- `store.js`
stays `Logic/Engine`, so its legacy-globals bridge is counted as Logic debt (see violation 6) until it is
ported away or the operator reassigns the module.

The standalone `.js` files of the same names (at the project root, beside
`qr.html`) are **generated, not hand-maintained** — `test_harness/extract_modules.js`
regenerates all 7 from `qr.html`'s own script blocks by header-anchored
matching. Run it after any `qr.html` edit, before trusting the standalone
copies; `check_module_parity.js` (wired into `verify_pricing_engine_module.js`,
`verify_orchestrator_engine_module.js`, and `verify_extracted_engine_module.js`;
`verify_nlp_engine_module.js` was retired in `T136` -- see `test_harness/retired/README.md`) catches drift if this is
forgotten, but only on the next full suite run — a real, easy-to-repeat
mistake this session made once (edited `qr.html`, ran the suite, got a
confusing "stale module" failure before remembering to re-extract).

## The `BookingContext` field contract

The rewritten charter (Zone 4, Document Ecosystem table) assigns this
contract's authoritative copy to this file specifically — the charter
"commits to the *concept* — one canonical convergence point between
resolution and rendering — not to the specific field names or shapes,
which will evolve." This is the current shape, verified directly against
`qr.html`, `T135`.

### Input side — `makeBookingContext(entry, overrides)`, `orchestrator_engine.js`

The one, shared constructor every real entry path (`collectBookingContext_catalog`,
`collectBookingContext_otherTile`, `collectBookingContext_freeText`) funnels
through via `Object.assign`. Confirmed fields and their defaults:

| Field | Default | Notes |
|---|---|---|
| `entry` | *(required)* | `'catalog'` \| `'other_tile'` \| `'free_text'` |
| `selectedServiceId` | `null` | Set by catalog/self-quote taps |
| `selectedCategoryId` | `null` | |
| `selectedGroupId` | `null` | |
| `rawText` | `null` | Free-text entry only |
| `nlpIntent` | `null` | NLP extraction result, free-text entry |
| `extractedQty` | `null` | |
| `extractedObject` | `null` | |
| `extractedLocation` | `null` | |
| `manuallyToggledTagIds` | `[]` | Customer-chosen, needs no affirmation |
| `negatedTagIds` | `[]` | |
| `_negationOverride` | `null` | `{from, to, negatedTagIds}` shape when set |
| `uncoveredServiceTypes` | `null` | Only meaningful for `entry='other_tile'` |
| `answers` | `{}` | Fixed at `T118` (`PENDING_DECISIONS.md #33`) — previously absent from the defaults entirely; every consumer that reads `context.answers` without an `|| {}` guard depends on this default actually being present |

### Output side — the built `ResolvedRoute`, `executeWorkflow`'s return, `orchestrator_engine.js`

| Field | Source | Notes |
|---|---|---|
| `entityType` | `resolution?.entityType \|\| 'fallback'` | |
| `entity` | `resolution?.entity \|\| null` | |
| `intakeChain` | workflow step output | |
| `answers` | carried from context, plus the answers the tags in force synthesize (`T146`, `synthesizeAnswersFromTags`, shared with the state path) | |
| `flags` | `orch_compute_variability_flags` | Includes `has_unaffirmed_detected_tags`, `has_unconfirmed_negation_pivot` (`T64`) |
| `confidence` | `confidenceState` | Built by `orch_compute_confidence` — the one, canonical confidence function, `T115` |
| `uiTemplate` | `uiTemplate?.ui_template \|\| 'curated_card'` | |
| `bypassIntake` | `!!uiTemplate?.bypass_intake` | |
| `skipTypeSelection` | `!!intakeBypass.skip_type_selection` | `other_tile` entry only |
| `preseededAction` | `intakeBypass.preseededAction \|\| null` | |
| `materialsEstimate` | pricing step output | |
| `quote` | pricing step output | |
| `activeTags` | merged detected + manual, minus negated | `v9.5` — without this, `route.activeTags` was always `undefined` and recompute calls silently got `[]`; tags had no pricing effect through any UI-renderer path; `T144` — closed over the SSOT's `requires` relations by `closeTagsOverRequires` (one definition, used by every path that assembles a tag set; the customer's explicit negations win) |
| `detectedTagIds` | `context.detectedTagIds \|\| []` | NLP-detected only, not merged with manual — `renderTagAffirmationFromRoute`'s specific need |
| `negationOverride` | `context._negationOverride \|\| null` | |
| `recommendedSku`, `matchConfidence`, `intentCategory`, `intentGroupId` | `context.nlpIntent?.*` | `T66` follow-up |
| `context` | the `BookingContext` the route was built from (a copy) | `T145` — the route says what produced it, so `orch_apply_answer` can answer a question on any gateway's route; `divergenceApplied: 'remote'` marks a route the fork extended with deep-dive questions |
| `maxFollowupQuestions` | `orch_max_followup_questions(entity, entityType)` | `T143`/`T147` — the follow-up-question window, the `value` of the ceiling record below (a progressive-disclosure window: answered questions plus up to this many unanswered ones); renderers read this |
| `followupCeiling` | `orch_max_followup_questions(entity, entityType)` | `T147` — the ceiling's record `{ value, source }`, `source` in the Charter's vocabulary (`service_override` / `archetype_default` / `dynamic_engine` / `fallback`), read from `resolveBaseConfidenceStrategy`'s per-field `fieldSources` (its record also carries a scalar `source`: the most specific branch that supplied any field) |
| `quantity` | `resolveQuantityUnits` | `T147` — the quantity record `{ units, requestedQty, stance, source }`: `stance` `single_unit` (the service declares `per_unit_answers_vary`) or `batched`; the card reads it for the book-each-separately guidance; the quote that reaches pricing carries the same record plus `multiplier` and `multiplierSource` |
| `basePrice` | `executeWorkflow` | `T148` — the entity's base price (or null): Glue seeds `S.intent.base` from it instead of reading `financial_engine` itself |
| `quote.divergenceTerms` | `computeUnifiedQuote` | `T148` — the diagnostic-fork copy and terms from the SSOT, handed to the renderer (carried by the unified quote and the state-path quote) so `buildDivergenceResolutionHtml` never reads the SSOT; `renderQuotePanel` likewise reads `dispatchScopeNote` from the panel model |
| `enrichment` | `resolution?.enrichment \|\| null` | |
| `trace` | step-by-step execution log | Consumed by the tracing tool, not customer-facing |

**The veto**: before this is returned, `validateRoute(builtRoute, db, db.routing_archetypes)`
runs; a genuinely broken route is replaced with `catastrophicFallbackRoute`
rather than handed to a renderer, with the reason logged to `trace` — "The
Veto," per the code's own inline naming.

**Convergence, confirmed**: this is the *one* object `renderCuratedCardFromRoute` and `renderSelfQuoteFromRoute` render from (the legacy builder that used to be a second consumer was retired at `T144`) —
the charter's own invariant ("different entry paths... must ultimately
resolve to the same underlying scope, the same confidence state, the same
pricing logic, and the same customer-facing outcome") is a direct,
checkable claim about this contract specifically.



## Known, tracked violations

### 1. `sqBuildCuratedIntake` — **retired, `T144`** (kept here as a closed item, per this project's own "don't erase the history of what was wrong" discipline)

Deleted from `AppController.js` (672 lines, 40,262 bytes) together with its only remaining callers
(`sqChooseDivergencePath` and the "orchestrator unavailable" fallback in `prefillSmartQuoteFromService`).
Before removal, the curated-card parity sweep was run against the original file, which still had both
renderers: 74 services, 73 agree, 1 differs (`dishwasher_repair`, `T136`'s documented Path B change). It had
mutated the legacy `S.*` global from inside a renderer-shaped function and called the engine directly; its
*correctness* was never the problem (it delegated to `orch_compose_intake_chain` and, from `T115`, to
`orch_compute_confidence`). What it carried that the live path lacked was **restored through the canonical
architecture, not copied**: the SSOT `requires` relation (`closeTagsOverRequires`) and the price-affecting
indicator (`_iconContent`). Full account: `TIMELINE.md` `T144`; decisions `PENDING_DECISIONS.md` #78-#79.

### 2. Two more curated-card-shaped renderers, same family

- **`renderSelfQuoteFromRoute`** — `UIRenderer.js`, `qr.html` line 8960,
  ~48 lines. Self-quote catalog taps (qty-only chains). Clean, short,
  matches `renderCuratedCardFromRoute`'s own style.
- **`sqBuildStep3`** — `AppController.js`, `qr.html` line 12808. The "uncommon chip-grid" step-3 path. **Still live and
  load-bearing** after `T144`: it is the only step-3 chip renderer, so it may not simply be deleted
  (`R-INVARIANT-DELETION`, *compliance before deletion*). It needs a compliant port first -- a Logic chip selector, a DOM
  renderer, thin Glue -- then deletion. `PENDING_DECISIONS.md` #83.

### 3. Third confidence formula — genuinely closed, `T115` (the function it lived in was retired at `T144`)

No longer a live violation. Verified directly this session:
`sqBuildCuratedIntake` calls `orch_compute_confidence({ entity: svc },
activeTagIds, matchConfidence, DB, 'catalog')` — the real, canonical
function, not a local reimplementation. `verify_curated_intake_confidence_agreement.js`
(39 checks) is the permanent regression guard. Left in this file as a
closed item, not removed, matching this project's own "don't erase the
history of what was wrong" discipline (`TIMELINE.md`'s own stated
convention).

### 4. `resolveForceModules` — a deliberate, documented stub, not a violation

`pricing_engine.js` block, `qr.html` line 1067. Kept as a real, callable
function returning `[]` after `T118`'s force-injection removal, *not*
deleted, because deleting it broke `extract_engine.py`'s own hardcoded
function list, `automated_path_sweep.js`'s real call site, and ~30 test
files that defensively reference it. This is intentional, documented
reversibility (a Zone 4 governance principle), not dead code left by accident —
confirmed by reading its own inline comment before recording it here.

### 5. Smart Quote Adlib Builder prototype — not a violation, tracked for completeness

Rendered live in `PROJECT_CHARTER.html`'s Appendix A. Real, working,
**entirely unwired** to `detectIntentNLP`/`executeWorkflow`/any pricing
path. See the charter's Zone 3 "Path B" section and Appendix A for the
full account of what it does and doesn't demonstrate.

### 6. `store.js` legacy-globals bridge — Logic debt, counted, `T144`

This map assigns `store.js` to `Logic/Engine`. `bindLegacyGlobals` (the migration bridge) mirrors store state into the
legacy `State` global, which the Logic role may not touch: six `logic-global-ui-state` violations, all inside that
one function. They are **counted, not reassigned away** -- moving the module to `Controller/Glue` would improve the
number without changing the code (`R-GOVERN-GOODHART`). The honest exits are to port the bridge away (the migration
it exists for) or for the operator to reassign the module deliberately. `PENDING_DECISIONS.md` #84.

## Zero `// DEPRECATED` markers currently in `qr.html`

Confirmed by direct grep, `T135`: none. The last tracked deprecated
functions (`renderTagAffirmationCard` and its 4 siblings) were physically
deleted at `T119`, not just marked. `global_rules.force_modules_by_variability`
was renamed with a `_DEPRECATED` suffix in the *data* (not code) at
`T118` — see `D-force-injection-deprecated` in `test_harness/decisions.json`
for the current, honest state of whether anything still reads it (flagged
`needs_review`, not resolved, as of `T135`).

## Maintenance

Re-verify this file's line numbers and mutation counts whenever a
`qr.html` edit touches any of the functions named above — they will drift,
the same way every other line-number reference in this project's own
documents does. When in doubt, `grep -n "function <name>"` directly rather
than trusting this file's numbers past a few real sessions old.

`T144` refresh: the module table's line ranges were re-measured and the `inline` and `btnyc.json` rows added; the contract's output table gained `maxFollowupQuestions`; the violations section was brought current (violation 1 closed, 2 updated, 6 added). Zero `// DEPRECATED` markers remain in `qr.html` (re-confirmed by grep).

## Where natural-language parsing lives (`T136`)

All parsing of a client's typed words lives in the `nlp_engine` block and nowhere else:
`understandRequest()` is the ONE parse (intent, grounded item noun, quantity, location, completeness,
confidence) and `composeAdlibParts()` / `composeAdlibSentence()` are the ONE composer of the
"I need to ___ my ___" sentence. The live preview, the confirm button, the guided builder's close-sync and
`sqBuilderFinish()` all call them. `UIRenderer.js` contains **zero** parsing functions (a renderer only renders
what the engine returns). `verify_single_parse_pipeline.js` enforces this structurally: it fails if any
module-level function is declared twice (the later copy silently shadows the earlier), if `UIRenderer.js` gains
a parsing function, or if a module-level IIFE reads SSOT state at script-load time (the SSOT does not exist
yet then). Tests load the engine modules whole through `test_harness/_engine.js` rather than cherry-picking
functions by name out of `qr.html`, so adding a helper next to a function can no longer break unrelated tests.

