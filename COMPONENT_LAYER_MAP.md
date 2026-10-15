# BTNYC Component / Layer Map

**Status:** Target responsibility map, not a claim that decomposition is complete.  
**Authority:** The Project Charter / Playbook defines durable rules and direction. This map defines the target component boundaries and records only implementation facts needed to migrate safely. If a current-state note conflicts with the target contract, it describes migration debt—not an exception to the Charter.  
**North Star:** One canonical domain understanding; one owner per concern; Glue sequences responsibilities without absorbing them.

## 1. Governing architecture

The platform must turn every entry path—catalog/picker, guided intake, and free text—into the same canonical `BookingContext`, resolve it through one authoritative pipeline, and produce one defensible customer outcome. Different gateways may gather evidence differently; they must not maintain competing interpretations, confidence calculations, routes, or prices.

The target domain model is **Entity + Action + Modifiers → Service**:

- **Entity:** the customer-named thing or component being worked on.
- **Action:** the work verb, such as repair, install, mount, or replace.
- **Modifiers:** reusable conditions that affect scope, risk, preparation, time, or price.
- **Service:** the resolved or curated combination, with service-specific policy and pricing/intake overrides where needed.
- **Behavioral class/family:** descriptive or handling metadata, not a mandatory intermediate identity layer.

Operational concepts such as strategy, capability, or routing mode may exist where they have an independently defined execution purpose. They must not become mandatory stages of authored domain identity merely because legacy code uses them.

The authored SSOT is `btnyc.json` in the current migration contract. The existing file is legacy service-first data and, per the supplied handoff, includes compiler-owned `compiled.*` sections; it must not be mistaken for an already-clean source/artifact separation. The migration must preserve its curated business knowledge while establishing one authoritative entity-first authored representation and a separate reproducible derived runtime artifact. Runtime modules must consume the published derived artifact—not independently read authored source, fall back to it, or treat the legacy hybrid as the final target. If implementation evidence requires the entity-first source to live in a separate file during migration, the design must name that file and define the transition explicitly; it must not create two competing authorities.

## 2. Target modules and concern ownership

| Module / responsibility | Layer | Current source / status | Owns | Must not absorb |
|---|---|---|---|---|
| `btnyc.json` — authored SSOT | Knowledge / source | **Current file at repo root.** Legacy service-first shape; the supplied handoff describes authored catalog data mixed with compiler-owned `compiled.*` sections. Do not hand-edit; use the prescribed patch/splice workflow for the legacy shape. The migration must establish one authoritative entity-first authored representation. | Canonical authored business knowledge: entities, shared actions/modifiers, services, stable IDs, questions, scopes, dependencies, option effects, uncertainty/retirement relations, confidence and recovery policies, pricing declarations, curated vocabulary and aliases. | Runtime execution, hidden business logic, generated indexes acting as a second source of truth, label-keyed relationships. |
| Schema and independent validator | Knowledge / validation | `schema/btnyc_schema.json` and `test_harness/btnyc_v10_compiler.py` are the recorded legacy locations; inspect before changing. The entity-first schema/validator are deliverables of the SSOT migration. | Validate authored shape, IDs, references, scopes, dependencies, effects, uncertainty paths, policy thresholds, and composition constraints without deriving output. | Mutating authored data, generating expected values for behavioral tests, silently accepting missing knowledge. |
| Compiler / derivation | Build / publish | `test_harness/btnyc_v10_compiler.py` plus `test_harness/tools/splice_compiled.py` are the recorded legacy path for the current shape. The final entity-first derivation contract must be explicitly versioned and independently tested. | Deterministically derive the runtime graph/artifact from valid authored source; preserve curated knowledge; report reproducibility/freshness. | Human-authored business decisions, independent validation responsibilities, hidden runtime fallbacks. |
| Derived runtime artifact | Published knowledge artifact | **Must be a separate generated output in the target architecture.** Exact filename/location is to be established by the migration design; do not invent a path or assume today's hybrid `btnyc.json` already satisfies the boundary. | Reproducible machine-oriented projection of validated authored source, with schema/derivation/runtime compatibility and provenance. | Hand-authored competing business facts, source fallback, hybrid authored/generated authority. |
| `qr.html` — deployment shell / current inline-module host | Deployment / UI shell | **Current app/deployment file.** Per Prompt 2 and the supplied handoff, it contains five inline JavaScript blocks: `pricing_engine`, `orchestrator_engine`, `UIRenderer`, `cart_logic`, and `AppController`; four other modules are loaded from `modules/`. Verify the actual checkout and script order before edits. | Host the deployed interface, markup/templates, and script loading/bootstrap boundaries required by the current packaging model. Its inline placement is a packaging fact, not ownership of the business concerns implemented inside those blocks. | Becoming a catch-all business-logic owner; maintaining duplicated inline and external implementations; reading authoring source as a runtime fallback. |
| `nlp_engine.js` | Logic / Engine | External module: `modules/nlp_engine` in the supplied current-state handoff; verify the checkout and exact filename. | Parse customer language into candidate entities, actions, modifiers, quantities, locations, negations, and evidence with provenance. | Final domain resolution, pricing, confidence arithmetic, UI rendering. |
| `resolver.js` | Logic / Engine | **Target module; not yet a standalone file per Prompt 2.** Its current responsibility is embedded in existing runtime code, including inline blocks in `qr.html`; inspect `HANDOFF_CURRENT_STATE.md` §3 and actual call sites. | Resolve `BookingContext` plus evidence against the domain graph into the canonical interpretation; own resolution decisions, branch/state consequences, and provenance. | Confidence arithmetic, question-chain composition, route policy, pricing policy, UI behavior. |
| `confidence_engine.js` | Logic / Engine | **Target module; not yet a standalone file per Prompt 2.** Current confidence logic is recorded as partly inside `pricing_engine` and gateway paths; verify before moving it. | Calculate `Cᵢ` / `Cₓ`, account for open and retired uncertainty against the applicable authored profile, and apply the declared confidence policy. | Choosing the next question, resolving facts, composing recovery, price calculation. |
| `composer.js` | Logic / Engine | **Target module; not yet a standalone file per Prompt 2.** Locate current question-chain logic in the actual checkout before extraction. | Compose valid question chains from entity scope, first-class dependencies, current evidence, and eligible questions. | Confidence measurement, selecting the final quote route, price calculation, DOM rendering. |
| `recovery_engine.js` *(target responsibility; proposed file)* | Logic / Engine | **Target module; not yet a standalone file.** Recovery selection must be separated from the adjacent current responsibilities during later runtime work. | Select the next useful evidence path from current open uncertainty and declared recovery affordances. | Confidence measurement, question-chain mechanics, fact resolution, UI decisions. |
| `route_builder.js` | Logic / Engine | **Target module; not yet a standalone file per Prompt 2.** Route construction/validation currently exists in the runtime flow; verify the exact owner and callers. | Build an honest supported route—exact, range, conditional, or diagnostic—from canonical resolved state and confidence output. | Re-resolving facts, duplicating confidence arithmetic, calculating price, rendering. |
| `pricing_engine.js` | Logic / Engine | Inline block in `qr.html` per the supplied current-state handoff; verify against the checkout before editing. | Calculate price from resolved work and explicit pricing rules, including modifiers and per-unit/per-visit semantics. | Confidence calculation, recovery composition, route arbitration, caller-side pricing fallbacks. |
| `cart_logic.js` | Logic / Engine | Inline block in `qr.html` per the supplied current-state handoff; verify against the checkout before editing. | Own cart-line identity, merge/transition rules, quantities, and cart totals under a declared contract. | Re-resolving domain facts, recalculating confidence, redefining quote/pricing policy, rendering totals. |
| `orchestrator_engine.js` | Logic coordination / Glue role | Inline block in `qr.html` per the supplied current-state handoff; verify against the checkout before editing. | Sequence canonical operations, manage workflow transitions, assemble the returned route/trace, and pass authoritative outputs between owners. | Absorbing any engine’s calculations or introducing competing business rules. |
| `store.js` | State boundary | External module: `modules/store` in the supplied current-state handoff; verify the checkout and exact filename. | Provide the canonical state access API and subscriptions under its declared contract. | Shadow state, domain interpretation, business decisions, presentation. |
| `appReducer.js` | State transition / Logic | External module: `modules/appReducer` in the supplied current-state handoff; verify the checkout and exact filename. | Apply deterministic transitions for declared actions. | I/O, DOM rendering, pricing, confidence, hidden orchestration. |
| `UIRenderer.js` | UI / Renderer | Inline block in `qr.html` per the supplied current-state handoff; verify against the checkout before editing. | Purely render supplied view/resolved state into DOM; clear/re-render containers predictably; present supplied price, confidence, route, questions, chips, and messages. | Business decisions, inference, SSOT interpretation, pricing/confidence/recovery calls, state mutation, parsing. |
| `AppController.js` | Controller / Glue | Inline block in `qr.html` per the supplied current-state handoff; verify against the checkout before editing. | Bind DOM events to application commands; dispatch actions; manage interaction lifecycle and bootstrap. | Domain calculations, policy, duplicated resolution, business logic in handlers. |
| `trace.js` | Observation / diagnostics | External module: `modules/trace` in the supplied current-state handoff; verify the checkout and exact filename. | Capture and format workflow events, spans, provenance, and diagnostic payloads. | Business decisions, pricing, confidence arithmetic, resolution authority. |

**One owner means one owner of meaning and canonical computation.** Other modules may call that owner and consume its result. A concern is still misplaced if another module computes it, even when there is only one implementation and no duplicate formula.

### Recovery is a distinct responsibility

The confidence engine answers **what uncertainty remains and how much has been retired**. The composer answers **which valid question chain can be composed from scoped questions and dependencies**. The recovery engine answers **which available evidence path is useful next, given current open uncertainty**. The resolver answers **what the resulting evidence means**. The route builder answers **what quote route the evidence supports**. The orchestrator sequences these responsibilities.

Do not place recovery selection inside `composer.js`, `confidence_engine.js`, a UI event handler, or a static service list merely because those are adjacent in the call path.

## 3. Layer contracts and pure DOM boundary

### Knowledge

- Authored knowledge is declarative; no JavaScript execution in the SSOT.
- Every independently referenceable entity, action, modifier, service, question, option, and tag has stable identity. Labels are presentation, not keys.
- Relationships are explicit: entity scope, question dependencies, option effects, uncertainty classes and retirement paths, service applicability, confidence policy, recovery affordances, and pricing rules.
- Source schema validation and derivation are separate responsibilities. Behavioral tests must be able to validate without invoking the production derivation process to manufacture expected values.
- The runtime consumes only the compatible, validated, purely derived artifact. It must not fall back to authored source or read a hybrid artifact as a second authority. Publishing validates, derives, verifies freshness/reproducibility and compatibility, and refuses invalid or stale output.

### Logic / Engine

- Owns domain interpretation, calculations, selection, composition, and deterministic business rules.
- Consumes explicit state and declarative knowledge; returns structured results with enough provenance to explain the decision.
- Does not read or mutate the DOM, render markup, or use UI state as a hidden business input.
- Does not rely on caller-side `||`, `??`, or inline re-derivation to arbitrate among competing sources after an authoritative resolver has returned.
- Missing authored knowledge must be visible as a validation/resolution problem or an honest conditional/diagnostic route—not silently treated as zero uncertainty or a fabricated default.

### UI / Renderer: pure DOM

- A renderer is a pure function of supplied view/resolved state for a given render target: it does not infer business meaning, query the SSOT, read pricing/session globals, invoke business engines, or mutate application state.
- The renderer may create, update, and clear DOM nodes; it must use safe DOM construction and text APIs for untrusted/customer-provided values. Do not insert untrusted input through `innerHTML`.
- Rendering must not parse customer language, calculate price/confidence, select recovery questions, decide applicability, or create a second sentence generator. Those results are supplied by the appropriate Logic owner.
- Event listeners may be attached or wired through the Controller, but event handlers must not contain business logic. User actions become commands/actions dispatched through the canonical state path.
- A UI change must not change business outcomes. Given the same canonical state and view model, alternate renderers must display the same underlying route, price, confidence state, and scope.

### Controller / Glue

- Owns event wiring, command dispatch, lifecycle, bootstrap, and sequencing—not domain meaning.
- Calls the appropriate Logic owner and forwards its output. It does not make business decisions merely because it receives an event or already has relevant values in scope.
- The orchestrator is sequencing Glue: it coordinates the stages but does not absorb their internal computations.
- State changes flow through the canonical dispatch/reducer/store contract. Renderers do not mutate application state directly.

### Observation

- Trace captures what occurred and why, with useful provenance.
- Trace may observe decisions but must not make, override, or silently repair them.

## 4. Canonical flow

```text
Catalog / Picker ─────┐
Guided Intake ────────┼──> canonical BookingContext + evidence
Free Text ──> NLP ────┘                 |
                                        v
                              orchestrator_engine.js
                               (sequence only / Glue)
                                        |
                                        v
                                    resolver.js
                                        |
                      +-----------------+------------------+
                      |                                    |
                      v                                    v
             confidence_engine.js                      composer.js
                      |                                    |
                      +-----------------+------------------+
                                        |
                                        v
                                recovery_engine.js
                          (when more evidence is needed)
                                        |
                                        v
                                 resolver.js again
                         (resolve newly supplied evidence)
                                        |
                                        v
                                 route_builder.js
                                        |
                        +---------------+----------------+
                        |                                |
                        v                                v
                pricing_engine.js                    view state
                        |                                |
                        v                                v
                  cart_logic.js                      UIRenderer.js
                        |                                ^
                        v                                |
                store.js / appReducer.js <── AppController.js
                        |
                        └── state changes trigger a new canonical workflow/render

trace.js observes the workflow without owning its decisions.
Authored SSOT → schema validation → derivation/publish gate → derived runtime artifact
                                      ↑
                         all Logic modules consume this same knowledge contract
```

This is a responsibility guide, not a mandatory literal call graph. The orchestrator sequences the calls; the precise ordering and repetition depend on the workflow state. The important invariant is ownership and authority: a result is produced by its owner, consumed by callers, and never independently re-derived by a downstream layer.

## 5. Authored SSOT, compiler, and runtime artifact boundary

These are separate responsibilities, even if the legacy implementation currently combines some of them:

1. **Authoring source — `btnyc.json` under the migration contract:** the authoritative business knowledge, transformed to the entity-first model. It is not hand-edited. For the current legacy shape, use `test_harness/tools/ssot_patch.js` and then `test_harness/tools/splice_compiled.py` according to their inspected invocation conventions. Do not assume those legacy tools already support the new shape.
2. **Schema and validation:** reject invalid source independently of derivation. Validation must be callable without generating output.
3. **Compiler/derivation:** derive runtime structures deterministically from valid authored knowledge; test this implementation directly for correctness, preservation, determinism, and idempotence.
4. **Published runtime artifact:** a separate generated output with explicit version/provenance. Runtime code consumes this compatible artifact only. The exact output path/name must be established from repository evidence and the migration design, not guessed in this map.
5. **Runtime consumers:** all Logic modules use the same published knowledge contract. No module may invent a local copy of the catalog, read the authoring source as an alternative authority, or silently fall back to legacy/hybrid data.

The current `btnyc.json` is therefore both **the file being migrated** and **the legacy shape that must be disentangled**; it is not permission to preserve generated `compiled.*` data as part of the steady-state human-authored source. Preserve curated values before removing or regenerating any hybrid section.

## 6. Entity-first SSOT contract consumed by the modules

The modules consume projections of one canonical graph; they do not each define their own data model.

- **Entity:** owns applicable questions, reusable uncertainty-class definitions, and curated service combinations.
- **Action and modifier:** canonical shared definitions with stable IDs; entities/services reference them rather than copying definitions.
- **Service:** declares its entity/action/modifier combination, applicable uncertainty profile and weights, confidence policy, recovery affordances, pricing shape/rules, and service-specific intake/pricing overrides.
- **Question:** declares stable identity, `entity_scope` (or a genuinely applicable global/context scope), and first-class `depends_on` relationships.
- **Option:** declares stable identity and actual downstream `affects` such as price, minutes, branch, preparation, checkout state, complexity, risk, or batch-risk. A claimed effect must match resolved behavior.
- **Uncertainty class:** names a material unknown and the evidence/question paths that can retire it. Confidence must not be earned from question count or an answer that changes no meaningful downstream outcome.
- **Recovery policy:** states whether remote recovery is available and how evidence paths are selected from current open uncertainty.
- **Provenance:** preserves which authored facts and evidence produced the resolved result and price.

Complexity is not a universal scalar. Skill tier, risk tier, and batch-risk compounding are independent concepts. Complexity may affect the uncertainty landscape and policy threshold; it must not be used as a substitute for explicitly modeled uncertainty.

## 7. Current implementation facts needed for migration

These notes are retained from the supplied legacy map only where they help locate responsibilities or protect the transition. They are not the target architecture and must be re-verified against the actual repository before a change. The supplied map describes a `T163` snapshot; its line numbers, counts, and tracked violations are historical, not current guarantees.

| Concern | Recorded implementation shape in supplied map | Migration implication |
|---|---|---|
| Deployment packaging | `qr.html` is the deployment unit for inline script blocks; `modules/` contains externally loaded modules. Root-level extracted copies are generated references, not hand-maintained sources. | Preserve one authoritative source per module. Before moving an inline block, add its external file and script reference, then remove the inline block; do not maintain two homes. Re-check actual deployment and extraction scripts first. |
| Recorded module locations | Inline in `qr.html`: `pricing_engine`, `orchestrator_engine`, `UIRenderer`, `cart_logic`, `AppController`. External in `modules/`: `trace`, `nlp_engine`, `appReducer`, `store`. | This is a snapshot, not a claim about the current checkout. Verify source locations and load order before editing. |
| Canonical context | The recorded implementation funnels catalog, other-tile, and free-text entry through a shared `makeBookingContext(entry, overrides)` and returns a resolved route/context used by renderers. | Preserve convergence to one canonical context and one renderable route. Evolve field names/shapes deliberately; this map does not freeze legacy field names as permanent contracts. |
| Route validation | The recorded flow validates a built route before rendering and uses a logged catastrophic fallback for a genuinely broken route. | Keep route validation as an explicit boundary. A fallback must be honest and observable, never a second hidden interpretation. |
| Cart | The recorded implementation assigns cart identity, transitions, quantity, and totals to `cart_logic.js`; Glue dispatches and Renderer formats/displays. | Preserve this split: no renderer-owned summation or caller-side merge policy. Re-verify actual live functions before migration. |
| Confidence | The recorded implementation had confidence calculation concentrated in `pricing_engine.js` and gateway functions. | This is legacy placement, not target ownership. Move confidence arithmetic to `confidence_engine.js` without preserving pricing as a shadow authority. Do not introduce a second formula during migration. |
| Parsing | The supplied map records all natural-language parsing in `nlp_engine` and no parsing in `UIRenderer`. | Preserve single-parse ownership; verify current call sites and tests before changes. |
| Known renderer-shaped path | The supplied map records `sqBuildStep3` as a live chip-grid path at that snapshot and says it requires a compliant Logic selector, DOM Renderer, and thin Glue before retirement. | Re-check whether it still exists. If live, port its behavior through the proper layers before removal; do not delete a load-bearing path solely to improve a structural score. |
| Legacy state bridge | The supplied map records a `store.js` bridge mirroring state into a legacy global, counted as Logic-layer debt. | Do not reclassify a module to improve metrics. Remove the bridge through an explicit migration or document an operator-approved boundary change. |

Do not carry forward the old map's line numbers, historical task labels, closed violation narratives, prototype status, mutation counts, or temporary pending-decision numbers as durable architecture. Those belong in the engineering history/ledger if still relevant and current.

## 8. Ownership and migration tests

A test is useful when it can fail for the defect it claims to detect. Test the actual boundary and behavior, not merely the presence of a name, a green count, or a copied implementation.

For every concern change, answer:

1. What concern is changing?
2. Which module owns its meaning and canonical computation?
3. Which authored SSOT relationship supplies its business facts?
4. Which modules consume the owner's output without re-deriving it?
5. What observable behavior proves the owner made the decision?
6. What counterfactual fixture would fail if the decision moved into the wrong layer?
7. Does the test exercise the real path where the defect can occur?

Required boundary outcomes:

- The same facts through catalog, guided intake, and free text converge on the same canonical scope, confidence state, route, pricing, and customer-facing outcome.
- A renderer can render supplied state without reading session/pricing globals, querying SSOT, invoking business engines, or changing business state.
- An unsafe insertion of untrusted input is detected by the relevant DOM-safety check.
- A duplicated parser, confidence formula, pricing calculation, resolver decision, or recovery selector is detected at the appropriate ownership boundary.
- A question that retires no uncertainty and changes no meaningful downstream state cannot manufacture confidence.
- Recovery offers only paths that can retire currently open uncertainty or reveal a justified dependency; if none exists, the system gives an honest conditional/diagnostic route rather than a dead end.
- The compiler/derivation process is tested directly for correctness and reproducibility; behavioral/source-validation tests do not use it to generate their own expected values.
- Tests that preserve deprecated architecture without detecting a real defect are rewritten or retired. A one-off bug does not automatically justify a permanent bespoke test; recurring defect classes need a detector that demonstrably fails on a counterexample.

Do not optimize architecture to satisfy vanity counts. Layer assignments are authoritative until deliberately changed; a metric must not be improved by relabeling the code that violates the boundary.

## 9. Change protocol

Before changing a component:

1. Read the applicable Playbook rules and this map.
2. Inspect the current repository and verify this map's current-state notes; do not trust old line numbers or task labels.
3. Identify the concern owner and the SSOT relationships involved.
4. Define the canonical input/output boundary and the counterfactual that proves ownership.
5. Change one responsibility at a time; preserve unrelated user changes and load-bearing behavior.
6. Run relevant tests and classify failures by whether they are caused by the change, pre-existing, stale, or infrastructural. Do not perform unrelated cleanup as a prerequisite.
7. Update this map only when a durable responsibility or verified implementation location changes. Record chronological evidence in the engineering history, not as permanent law in this map.

## 10. Ownership test

If a proposed change cannot identify its concern owner, authored source relationship, consumers, and observable proof of ownership, do not add another branch or fallback. Correct the source model or responsibility boundary first.

The architecture succeeds when each concern has one canonical home, every gateway converges on one resolved outcome, the DOM presents that outcome without reinterpreting it, and the customer receives the most precise honest quote the available evidence supports—with no invented certainty and no dead end.
