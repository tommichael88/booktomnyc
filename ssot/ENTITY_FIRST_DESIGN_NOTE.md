# Entity-first SSOT: design note (T175)

Status: written before any data was migrated, from inspection of the tree at `afc972d` (`t174-landing`; PR #21 not merged).
Authority: the Playbook (`PROJECT_CHARTER.html`, not edited by this work) and `COMPONENT_LAYER_MAP.md`. **Amended T176:** the Layer Map in force is the Operator's corrected 29,388-byte edition (sha256 `dcf1a415…`, installed alone at `ed76673`); the 22,515-byte and 7,417-byte editions are superseded. The reconciliation of what the Charter, the map and the ledger say about the source and the artifact is §3.1; the amendments to earlier sections are marked "Amended T176".
If the migration has to depart from this note, the departure is recorded in `ssot/MIGRATION_REPORT.md` as a deviation; the note is not silently rewritten.

## 1. What exists now (counted from `btnyc.json`, not from the audit)

| Thing | Count | Note |
|---|---|---|
| Services | 76 | service-first; each carries its own `intake_chain`, `confidence_strategy`, pricing blocks |
| Dynamic services | 82 | 12 keyed `category+Type`, 70 keyed `category+group+Type`; the Playbook says 96 |
| Intake modules (questions) | 135 | shared by many services; 119 used by a chain, 16 never used |
| Module options | 516 | **0 have an id**; the Playbook says 461 lack one (see section 11) |
| Chain steps | 163 service + 115 dynamic | 18 carry `params` (a per-service instance of a template question) |
| Chain steps with a non-empty `then` | 14 | keyed by **answer label**; 45 label to module-list entries |
| Modules with `depends_on` | 6 | keyed by module key and **answer label** |
| Modifiers | 189 | `global_rules.modifiers`, keyed by a slug of `<module>_<label>`; 227 option references, 158 distinct |
| Smart tags | 59 | `answers` keyed by module key and answer label |
| Groups / categories | 39 / 6 | |
| `routing_archetypes` | 39 | hybrid: compiler-derived plus curated `comp.*`/`sym.*` ids, tiles, prompts, `real_gaps` |
| Distinct `comp.*` | 74 | 3 (`comp.dryer`, `comp.stove`, `comp.ceiling_tile`) map to no service; 16 services map to no component |
| Behavioral classes | 9 | `archetypes` |
| `intent_mappings.objects` | 81 | NLP vocabulary: keyword, synonyms, category, overrides to service ids |

How the runtime keys things today: answers are stored **by module key, valued by the answer label** (`answers[moduleKey] === label`). A parameterised step is keyed `module::item_noun`. Branching is `then[label] -> [module keys]`. The runtime is not changed by this task.

Confidence today: a service resolves its strategy field-by-field from its own `confidence_strategy`, then its behavioral class `default_confidence_strategy`, then a **constant held in `qr.html`** (`minimum_quote_confidence 70, maximum_followup_questions 3, diagnostic_threshold 35, base_confidence 40`). 28 of 76 services declare no `minimum_quote_confidence`; 27 declare no `maximum_followup_questions`. `confidence_gain` (130 of 135 modules) is an additive score term with no uncertainty class behind it. `diagnostic_threshold` is read by no live path.

## 2. The one decision: nested authoring vs normalized relationships

The Playbook asks for both an entity-first authored shape (entities own their questions, uncertainty classes and services) and ID-based, typed relationships. They are reconciled like this.

**The authored source is nested by ownership and flat by reference.** An entity physically contains what is true of that entity alone (its questions, uncertainty classes, curated services, default compositions). Anything that must be shared or referenced from several places (actions, modifiers, tags, categories, groups, materials, and questions that apply to more than one entity) lives once in a top-level registry. Every cross-node relationship is a bare ID string; the ID prefix names the target type. There is no second spelling of any reference.

**The derived graph may flatten.** `derive_graph.js` builds a flat, indexed graph (every node keyed by id, every edge a typed pair) from the validated source. It is a generated fixture: it carries no business knowledge that is not in the source, and nothing reads it as a source.

**One authoritative representation of each fact.** A question exists in exactly one place: nested under its entity when its scope is that one entity; in the top-level `shared_questions` when its scope is several entities or a declared context. A service exists once, under its primary entity. A dependency exists once, on the question or intake step it gates.

## 3. Files, owners and the transition

| Artifact | Role | Owner |
|---|---|---|
| `ssot/btnyc_source.json` | **Authored source** (entity-first). Edited by humans/CMS. | the Operator |
| `schema/btnyc-source.schema.json` | Source schema, `source_schema_version` 1.1.0 (1.0.0 until T177; see section 14) | structure |
| `test_harness/tools/entity_first/validate_source.js` | Independent validator. Callable without derivation. Exit non-zero on any violation. | structure |
| `test_harness/tools/entity_first/derive_graph.js` | Derives `ssot/derived/btnyc_graph.json`. **Refuses invalid source** (runs the validator first). | structure |
| `test_harness/tools/entity_first/migrate_legacy.js` | One-time, reproducible migration of `btnyc.json` to the source, with a leaf-level provenance ledger | transition |
| `test_harness/tools/entity_first/project_legacy.js` | Projects the source back to the legacy authored sections; `--check` diffs against `btnyc.json` | transition |
| `btnyc.json` | Runtime file, **unchanged by this task**. Its authored sections are, from now on, a *projection* of the source. | transition |

`btnyc.json` is not edited by hand or by this task. The runtime, and therefore the price golden master, cannot move. The dual-source period this creates is explicit (R-SYSTEM-DUALSOURCE): `ssot/TRANSITION_DUALSOURCE.md` records what is duplicated, which side is authoritative (the source), how drift is detected (the parity check in the suite), and the closure condition. **Amended T176:** the closure condition was written in T175 as "`btnyc.json` is removed from the repository root"; that conflicts with the Charter's own statement of the end state and is corrected in §3.1 (the file name `btnyc.json` survives as the derived artifact; the legacy hybrid content does not). Until the cutover a legacy `ssot_patch.js` edit to `btnyc.json` fails the parity check until the equivalent source edit is made (§3.1.5).


### 3.1 Authority, lifecycle and the publishing boundary (amended T176; PENDING_DECISIONS #212)

The task was to reconcile three documents' descriptions of the source and the artifact before fixing the migration's final file arrangement. The passages below are quoted exactly. Each is classified as a **binding rule** (the Charter, in force whatever the file layout), the **final state** (what the Charter says the system is when the migration is complete), the **legacy migration state** (true of today's files, to be superseded) or **deferred** (the document leaves the choice to this design).

**3.1.1 What each document says.**

| # | Passage (exact) | Source | Class |
|---|---|---|---|
| 1 | "The authored source is for authoring and governance; the derived artifact is the runtime contract. The engine fetches or loads only the purely derived artifact, never the authored source as a fallback and never a hybrid file containing both curated source content and generated indexes." | Charter, `R-SYSTEM-DEPLOY-CONTRACT` | binding rule |
| 2 | "The publish flow validates the source, derives the artifact, verifies freshness and reproducibility, and refuses publication if the artifact is missing, invalid, stale, incompatible, or not reproducible from the source." | same | binding rule |
| 3 | "...business knowledge is read through the artifact by following the provenance reference the artifact carries — source identity, source version and hash, and derivation version" | same | binding rule |
| 4 | "Authored business knowledge lives in btnyc_source.json and is edited through the CMS. btnyc.json is the derived runtime artifact the engine consumes; it carries a provenance reference to the source. Field contracts live in btnyc_schema.json; module ownership lives in COMPONENT_LAYER_MAP.md." | Charter, "Where everything else lives" (and the Document Relationship Map: `btnyc_source.json` + `btnyc_schema.json` + the map → "Derivation / CMS" → "btnyc.json derived runtime artifact (carries $source reference)") | **final state**, with the names |
| 5 | "This section defines the target contract; it does not claim the current btnyc.json has already been migrated." / "It is a target architecture, not a claim that the migration has already happened." | Charter, entity-first and flat-graph sections | says 4 is the target, not today |
| 6 | "Direct hand-editing of source or published JSON is not a supported steady-state workflow... During migration, any temporary direct-edit path is a bounded dual-source transition under R-SYSTEM-DUALSOURCE." | Charter, `R-SYSTEM-CMS` | binding rule; permits today's direct edit of the source as a bounded period |
| 7 | "'Both are authoritative' is not a steady state... completion disconnects or deletes the retired source." | Charter, `R-SYSTEM-DUALSOURCE` | binding rule |
| 8 | `btnyc.json`: "**Current file at repo root.** Legacy service-first shape... Do not hand-edit; use the prescribed patch/splice workflow for the legacy shape. The migration must establish one authoritative entity-first authored representation." | Layer Map, row `btnyc.json` (Knowledge / source) | **legacy migration state**, plus the obligation in its last sentence |
| 9 | Derived runtime artifact: "**Must be a separate generated output in the target architecture.** Exact filename/location is to be established by the migration design; do not invent a path or assume today's hybrid `btnyc.json` already satisfies the boundary." | Layer Map, row "Derived runtime artifact" (Published knowledge artifact) | **deferred to this design**; consistent with 1 and 4 |
| 10 | "`btnyc.json` is then removed from the repository root (archived under `archive/`, not left live)" (the completion condition) | `ssot/TRANSITION_DUALSOURCE.md`, T175 | legacy migration state; **conflicts with 4** on the file name; corrected below |
| 11 | "`btnyc.json` | Runtime file, unchanged by this task. Its authored sections are, from now on, a *projection* of the source." | this note, §3 (T175) | legacy migration state; accurate for today |

**3.1.2 Is the Charter ambiguous? No, and why.** Rows 1 to 7 agree: the source is authored; the artifact is purely derived, named `btnyc.json`, and carries a provenance reference; the runtime reads only the artifact; two live sources are bounded. The Charter does not name a different artifact path anywhere. Row 9 does not contradict row 4: it declines to assume that *today's* `btnyc.json` is already that artifact, and leaves the path to this design; the Charter fixes the name. The only conflict is row 10 against row 4, and row 10 is a ledger entry this work wrote, a subordinate document. It read R-SYSTEM-DUALSOURCE's "retired source" as the file; the rule means the retired *role* (an authored source that is also read at run time). The path `btnyc.json` ends the transition as a different kind of file. Row 10 is therefore corrected; no Charter passage is read beyond its words.

**3.1.3 The lifecycle.** One authoritative authored source, one derived runtime artifact, one publishing boundary, in three phases:

| Phase | `ssot/btnyc_source.json` | `btnyc.json` | What the runtime reads | How an edit is made |
|---|---|---|---|---|
| P0, before T175 | did not exist | the hybrid: authored sections plus the eight compiler-owned keys; the only source | `btnyc.json` | `ssot_patch.js` then `splice_compiled.py` (legacy shape) |
| **P1, now (T175 to cutover)** | **authoritative** | a hand-carried **mirror** of the source's authored sections plus the compiler's keys; held to the source by `project_legacy.js --check`; not an authority and not to be hand-edited | `btnyc.json` (unchanged; the price golden master cannot move) | the source is edited directly as JSON and judged by `validate_source.js` (no tool or CMS edits it yet, R-SYSTEM-CMS row 6); what the legacy shape can express is then carried to the mirror with the legacy tools in the same commit (§3.1.5) |
| P2, completion | authoritative; edited through the CMS | **the derived artifact**: written only by the publish step, carrying a `$source` provenance reference; hybrid content gone | `btnyc.json` | the CMS; the publish step validates, derives, verifies and writes |

The derived graph (`ssot/derived/btnyc_graph.json`) is the **pre-publication candidate**: it is what the publish step will derive. It has no runtime consumer yet. R-SYSTEM-INDEXPROXY requires every generated structure to name a real consumer; today it is consumed by the freshness, reference and report tests, and by the runtime adapter that has not been written. This is a bounded exception recorded in #212, not a steady state: if the adapter is not scheduled by the transition end date, the candidate is part of what the transition ledger must close, reauthorize or roll back.

**3.1.4 The publishing boundary** is the one place a derived file may be written and the one place the Charter's checks are applied in order. It is **not built as a command yet**; its parts exist as checks in the suite:

| Step (Charter, row 2 and 3) | Mechanism today | State |
|---|---|---|
| validate the source | `validate_source.js` (`validateFull`: schema, then semantic; 34 rule codes, 86 mutants) | exists, in the suite |
| derive | `derive_graph.js`; refuses an invalid source and writes nothing | exists, in the suite |
| freshness and reproducibility | `derive_graph.js --check`: the committed candidate is what the committed source derives, byte for byte; the candidate carries `derivation.source_sha256` | exists, in the suite |
| output is valid | `verify_entity_first_references.js` section 4: every edge, retirement, composition point and picker entry names something that exists in the graph | exists, in the suite |
| identities preserved | `id_register.js --check` (§4): no published id lost, renamed or reused | exists (T176), in the suite |
| provenance | the candidate's `derivation` block carries source path, `source_schema_version`, `source_sha256` and the derivation version. It has no key named `$source` and no runtime/interface version | **partial**: both are cutover work |
| compatible with the runtime | `R-SYSTEM-DEPLOYORDER`: the runtime refuses a known incompatible combination before customer work | **not built**: the runtime does not read the candidate |
| publish | one command that runs the steps above in order and writes exactly one file, `btnyc.json` | **not built**; today nothing writes `btnyc.json` from the source |

In the Layer Map the publishing boundary is the "Compiler / derivation" row (Build / publish): not page code, but accounted for in the source/artifact checks (`verify_r-system-layers_full_matrix.js`, `verify_module_deployment_shape.js`) and not a place for business decisions. The legacy compiler (`btnyc_v10_compiler.py`) and `splice_compiled.py` are the P1 path for the mirror; `derive_graph.js` is the P2 path.

**3.1.5 Source versus runtime contract, and patch compatibility.** Two contracts exist and they are not two authorities.

- *The source contract* is `schema/btnyc-source.schema.json` (`source_schema_version` 1.0.0), applied by the validator. This is the Charter's "one versioned schema validates source shape" and is the only schema that says what may be authored.
- *The runtime contract* of today's page is `schema/btnyc_schema.json` (`meta.schema_version` 2.0): the page validates the `btnyc.json` it fetches at boot against the schema its `$schema` names (this one). It describes the legacy-shaped mirror and goes away with the mirror. After the cutover the runtime contract is the derivation's output shape, versioned by the derivation version and checked by the publish step's output checks (the table above); it is not a second hand-authored schema. Whether the published `btnyc.json` is the flat graph under a new interface version (the Charter's flat graph says yes) or something else is a separate R-INVARIANT-FROZEN decision, filed in #212.
- *Why they cannot drift apart:* the publish step is the only thing that turns one into the other, and it refuses to write unless the source validates, the output validates, the result reproduces, and the ids are preserved. Until the cutover the mirror is held to the source by the parity check, and the candidate by `--check`.
- The other schema files in `schema/` (`btnyc-v10.schema.json`, `btnyc_v3_schema.json`) and the root `btnyc_schema.json` are stale copies that name no authority. Their retirement is S6's job and is not done here.

*Patch compatibility.* S1 to S5 in `RESHAPE_SCOPE_S1_S6.md` were written as patches to `btnyc.json` through `ssot_patch.js` and `splice_compiled.py`. Their data halves are already realized in the source (an id on every option; one reference spelling; ids not labels; no compiler-owned keys). **They cannot be applied as patches to the legacy `btnyc.json`.** The parity check compares the mirror with the projection of the source, so a patch that moves the mirror toward the new shape fails it by design. The correct workflow before the cutover is the one in `ssot/TRANSITION_DUALSOURCE.md`: edit the source; carry what the legacy shape can express to the mirror with the legacy tools, which stay intact for the legacy shape and do not edit the new source. After the cutover the mirror is replaced by the derived artifact, `ssot_patch.js` and `splice_compiled.py` have nothing to edit and are retired with it. The **cutover point** is the single commit that adds the publish command, the runtime adapter and the regenerated `btnyc.json` together and retires the legacy authoring tools; it is not before the Operator schedules it (#212).

**3.1.6 Ownership.** The source owns business knowledge: what a thing is, what is asked, what each answer changes, what is certain enough, how recovery proceeds. The runtime owns the mechanisms that interpret it. The renderer owns presentation. This note, the coverage report, the ledger and every other document explain the contract and are not read by the engine; a fact that only a document states is not a business rule. Nothing in this reconciliation moves a business decision into page code: the three headerless inline blocks in `qr.html` (global state and the PAX constants, boot, service worker) are recorded as unowned, shell-hosted code and held to the shell contract in the matrix test; the PAX table is business data in code and is migration debt, listed in #214, not endorsed.

## 4. Identity and reference grammar

Every referenceable node has a stable id of the form `<type>.<slug>`:

`ent.` entity, `act.` action, `mod.` modifier, `svc.` service, `cmp.` default composition (the decomposed dynamic service), `q.` question, `u.` uncertainty class, `tag.` smart tag, `mat.` material, `fml.` pricing formula, `chk.` checkout state, `cat.` category, `grp.` group, `cls.` behavioral class, `ctx.` context scope.

An **option** id is unique within its question; an option is only ever referenced as the pair `{question_id, option_id}` (never as a bare string, never by label). Symptom options keep the curated `sym.<slug>` ids that `routing_archetypes` already carries, so no curated id changes.

IDs are generated **once**, by the migration, from the legacy key or label (`slug`: lowercase, non-alphanumerics to `_`, collapsed, trimmed, 60 characters, collision-suffixed in document order), then frozen in the source. A label change never changes an id. Labels and aliases are never keys. **Amended T176 ("frozen" is now a detector):** the validator checks that an id exists, is unique and has a legal shape, but it cannot see a *consistent* rename (the id changed in its definition and in every reference), which leaves the source valid. The id register (`ssot/migration/id_register.json`, `test_harness/tools/entity_first/id_register.js`, detector `verify_entity_first_id_freeze.js`) closes that. **Frozen means:** every typed id the validator declares (17 kinds), every option as the pair `question_id#option_id`, and every group-picker symptom and symptom tile as `group_id#id`: 1,088 typed ids, 593 option pairs, 25 symptoms and 7 tiles at the T176 baseline (the validator's 1,681 ids are the typed ids plus the option ids). **Not frozen:** labels, display names, aliases, descriptions, order, numbers, and the content of any node. **An intentional change** is a written retirement in `retired[]` (id, type, reason, `replaced_by` or null, ledger ticket, the change that made it); a rename is a retirement plus an addition. The register is append-only through `--write`, which refuses while any registered id is lost or reused, and the detector proves it can fail with counterfactuals (a consistent rename that the validator passes; deletion; reuse; each malformed retirement; the loss rule switched off). It is a guard and not an authority: the source owns what an id means. It cannot see an id that was never registered; the baseline is the set the T175 migration produced.

Legacy spellings normalised at the migration boundary: `{"$ref":"#tag"}` and `"#tag"` -> `tag.x`; `comp.x` -> `ent.x`; bare service ids -> `svc.x`; module keys -> `q.x`; `module::noun` -> an instance question id; label-keyed `then`/`depends_on`/`answers` -> `{question_id, option_id}` pairs; modifier slug keys -> `mod.x`; SKUs -> `mat.x`. Nothing reads a label as a key after this boundary.

## 5. Source layout (`source_schema_version` 1.1.0; the 1.0.0 layout plus the additions of section 14)

```
meta, source_schema_version, provenance
registries:  categories[], groups[], actions[], modifiers[], tags[], materials[], furniture[], checkout_states[],
             pricing_formulas[], behavioral_classes[], contexts[]
entities[]:  { id, label, kind, family(->cls.), parent_id, group_ids[], aliases[],
               questions[], uncertainty_classes[], services[], default_compositions[],
               offers_service_ids[], picker{...} }
shared_questions[], shared_uncertainty_classes[]
policy:      workflow, invariants, global_rules (minus modifiers), ui_config, ...
vocabulary:  negation_library, adlib_phrase_overrides, nlp_objects[] (was intent_mappings.objects), ...
```

Compiler-owned keys (`compiled`, `routing_archetypes` derived fields, `pricing_archetypes`, `_compiler_metadata`, `_validation`, `_additive_diff`, `_schema_validation`, `_archetype_mismatch_report`) are **not** in the source. `routing_archetypes` is hybrid: its curated parts (symptom prompt/tiles, known-need prompt/tiles, `ask_action_first`, entry mode, `real_gaps`, the symptom and component to service links) move to authored homes first (section 9); only then is the remainder purely derived.

## 6. Entities

Entity set = every curated `comp.*` (74) + entities that the 16 component-less services need (section 6.2) + one **generic** entity per group that has no single head entity, + one per category for the 12 category-level dynamic services. `kind` is `component | generic_group | generic_category`.

**6.1 Primary entity of a service.** One field, `entity_id`. Rules, in order: the single component the service is mapped to; else, for a service mapped to several components, the first mapped component (a decision-table entry with a `_note` where a different one reads better); else the single component of its group; else a decision-table entry. The other components a service is mapped to keep the curated link as `entity.offers_service_ids` (the many-to-many that `component_id_to_service_ids` already holds), so no `component_id`/`entity_id` pair exists on a service.

**6.2 Entities the migration has to name** (not in `comp.*`): for the component-less services, e.g. `angle_stop_replacement`, `computer_diagnostic`/`virus_or_malware_removal` (a `computer` whose `laptop`/`desktop` children carry `parent_id`), `door_repair_impact_damage`/`door_weatherstripping` (`door`), `squeaky_floor_repair` (`floor`), `generic_mounting_service` (`wall_mounted_object`, the Playbook's own example), `window_draft_sealing` (`window`), `wood_paneling_repair` (`wall_paneling`). Each is a taxonomy decision made under G-GOVERN-AUTONOMY with a `_note` and listed in `PENDING_DECISIONS.md` with a default.

**6.3 Behavioral class** is `entity.family -> cls.x`, derived from `archetypes[].member_group_ids` through the entity's group. Metadata only: no id, scope or reference depends on it.

## 7. Questions, scope, options, effects, dependencies

**7.1 Placement and scope.** Every question declares `entity_scope`: an array of entity ids, or `{"context": "ctx.x"}` for a question that genuinely applies beyond an entity (quantity, access, urgency, parking). Scope is computed from *authored use*: the entities of the services and default compositions whose chains ask the question. A scope can therefore never contain an entity that does not ask it. A question asked by exactly one entity is nested under it; otherwise it is a `shared_question`. A question asked from at least three entities in at least two categories whose text names no entity noun is given a `ctx.` scope instead; the threshold and the resulting list are a recorded taxonomy decision. The validator rejects both directions of mismatch (a chain asking a question whose scope excludes its entity; a scope naming an entity that never asks it).

**7.2 Parameterised steps** (`item_count_template` with `params`) become **instance questions** owned by the asking entity: `q.<module>.<service>`, with `instance_of` naming the template question. Their options and per-instance modifiers are the `params.client_response` values.

**7.3 Option ids and `affects`.** Option id = the label slug, unique within its question and never prefixed with the question (symptom options keep the curated `sym.<slug>` ids; 51 of 593 options). `affects` is computed, per option, from fields the option actually carries:

| Option carries | `affects` gains |
|---|---|
| `modifier_ref` -> modifier with `fee != 0` / `minutes != 0` | `price` / `minutes` |
| `complexity_override` | `complexity` |
| `checkout_state_override` | `checkout_state` |
| `route_to` | `branch` |
| appears in a step's branch map or a `depends_on` | `branch` |
| `qty_value` | `quantity` |
| `mat_min` / `mat_max` | `materials` |
| `formula_override` | `price` |
| `tags` non-empty | `tags` |
| `location_hints` | `prep` |

No option gets a free-standing promise. A module with `affects_price: true` whose options declare no price effect is reported (it is the `affects_price` flag with nothing behind it), not silently kept or cleared. An option that carries no effect field has `affects: []`.

**7.4 Non-retiring options.** An option is `evidence: "unknown"` when its label states that the customer does not know / is deferring to notes (a documented pattern list, printed in the report with the options it matched) or when it routes to the diagnostic. An `unknown` option is never in any class's `retired_by.option_ids`.

**7.5 Dependencies.** The legacy gating is **per chain**, not per question: `wall_type`, `weight`, `dmg_size`, `location`, `symptom` are plain steps in some services and branch targets in others. A single question-level `depends_on` would either gate the plain uses (breaking them) or lose the gate. So:

- `question.depends_on` holds prerequisites that hold wherever the question is asked (the 6 module-level `depends_on`, converted to `{question_id, option_id}`).
- `service.intake.steps[].depends_on` holds prerequisites that are true for that service's use (every branch `then` target, converted).
- Both use one grammar: an array, all terms required; a term is `{question_id, option_id}` or `{any_of: [{question_id, option_id}, ...]}` (a target named by several answers/parents). The runtime's "visible if some parent's chosen answer names it; ungated if no parent is in the chain" is reproduced by emitting a term only for parents present in that chain.
- `then` is not stored. `project_legacy.js` rebuilds `then` from the steps' `depends_on` (labels via option ids). Step order is stored as the resolved order. The one normalisation: the list order of branch targets in a `then` value may differ from resolved order where a later list names an already-injected module; the runtime ignores that order, and the original maps are preserved verbatim in `ssot/migration/legacy_encodings.json`.

## 8. Uncertainty, confidence, recovery

**8.1 Classes.** Each question is the evidence for one uncertainty class `u.<question slug>`, owned where the question is owned. `retired_by = [{question_id, option_ids}]` with the evidence options only (never `unknown`); a numeric question retires on `{question_id, any_value: true}`. Retirement is by answer, never by having asked.

**8.2 Service profile.** `uncertainty_profile = [{class_id, weight}]` for every question the service asks that carries an authored `confidence_gain`. **Weight := the module's legacy `confidence_gain`**, declared here as the weight (so it stops being a non-authoritative legacy number) and marked `weight_basis: "seeded_from_confidence_gain"`. The 5 modules with no gain contribute no weight and are listed. This is a business-number seeding under G-GOVERN-AUTONOMY: documented, defaulted, filed for the Operator.

**8.3 Policy, scale 0-1.** `exact_at = minimum_quote_confidence / 100`, `diagnostic_below = range_at = diagnostic_threshold / 100`. Where the service declared nothing, the **effective** value (behavioral-class default, else the `qr.html` constant) is written explicitly, with `policy_sources` naming which level supplied each field. This removes the hidden constant: a service with no declaration cannot silently be 100%, and the validator fails any service with a gate and no declaration. `base_confidence`, `_variability_*`, `_confidence_cap_*` and `maximum_followup_questions` have no home in the Playbook model; they are kept verbatim as `legacy_runtime_compat.confidence_strategy`, non-authoritative, consumed only by the unchanged runtime, with a retire-when condition. The projection reproduces the legacy `minimum_quote_confidence`/`diagnostic_threshold` from the policy (exact rescale), only for fields the service originally declared.

Cx = sum of weights of retired classes / sum of weights of active classes. A threshold above 1, a profile whose weights sum to 0, a class whose every retiring option is `unknown`, or a class whose question the service never asks is a validation failure. 21 services declare a legacy bar that no answer sequence could clear (`min - base > sum(gain)`); under the proportional model every bar is reachable by construction, and those services are listed as a business decision, not hidden.

**8.4 Recovery affordances.** Each gated service declares `recovery_affordances = { source: "current_open_uncertainty", deep_dive_question_ids: [...], when_no_path: { route: "diagnostic", service_id|checkout_state } }`. `deep_dive_question_ids` is the legacy `remote_deep_dive_modules` (10 services, 36 default compositions) converted to question ids. The validator checks that for every class in the profile either a retiring question is reachable from the service's steps or the class is listed under an explicit `when_no_path`; it does not accept a replay of the default question list.

## 9. Dynamic services and the picker

**9.1 Decomposition.** Each of the 82 dynamic services becomes a `default_composition` on an entity: `{id: cmp.<entity>.<action>, entity_id, action_id, modifier_ids: [], pricing: {...}, intake: {steps: [...]}, uncertainty_profile, confidence_policy, recovery_affordances, suggested_tag_ids}`. The entity is the group's head entity when the group has one, otherwise the group's generic entity; category-level keys go to the category generic entity. The legacy compound key is kept only as `provenance.legacy_key`. `merge_strategy` is `"extend"` in all 82 and is read by no code; it is recorded under `legacy_runtime_compat` and listed as a retirement candidate with that evidence, not deleted.

**9.2 Curated picker content** gets an authored home on the entity/group before `routing_archetypes` becomes derived: `group.picker = { entry_mode (was routing_archetype), symptom_question_id (was symptom_module), symptom_prompt, symptom_tiles[], known_need_prompt, known_need_tiles[], ask_action_first, real_gaps }`. The symptom to service links become `option.service_ids` on the entity's symptom question (the symptom option declares which services it routes to). The component to service links are `entity.services` plus `entity.offers_service_ids`. `entry_mode`, a group's `entry_mode`, is orthogonal operational policy; capability and strategy are not stages (section 10).

## 10. The Playbook's legacy chain, and how this migration treats it

The Playbook's glossary, routing section and appendix still describe the chain Entity -> Behavioral Class -> Capability -> Strategy -> Action -> Derived Service, with "routing mode", "capability" and "strategy" as stages. Its entity-first authoring section and `COMPONENT_LAYER_MAP.md` say the opposite (entity + action + modifiers is the identity; classes are metadata; workflow is a view). This is a documentation inconsistency in the Playbook. **It is not fixed inline.** It is recorded in `PENDING_DECISIONS.md` with the passages listed, and the migration report lists every passage and every data field that uses the old chain and how each is mapped:

- *Behavioral class*: retained as `entity.family` metadata.
- *Capability*: there is no `capability` key in the data (the word appears only in prose); the set of actions an entity supports is the set of its services' and compositions' `action_id`s. Retired as a stage.
- *Strategy*: the confidence part becomes `confidence_policy`; `default_routing_strategy` on a class stays class metadata.
- *Routing mode* (`routing_archetype`): retained as `group.picker.entry_mode`, orthogonal operational policy (an entry path, not identity).

## 11. Discrepancies found and how they are handled

- Playbook: 461 options lack ids. Repo: **516** module options, 0 ids. The audit's 461 counts a different population (not reproducible from the repo); the migration assigns ids to all 516 plus the options inside 18 parameterised steps, and the report gives the real number.
- Playbook: 96 dynamic services. Repo: **82**. All 82 are decomposed.
- The task text says `price_golden_master.js capture --out <path>`; the tool takes the path positionally (`capture <path>`), and `--out X` would write a file named `--out`. Used positionally.
- The task text says `t174-landing` is 7 commits ahead of `main`; it is 8.
- The superseding Layer Map was first read as 7,417 bytes (replacing 26,751), then as 22,515; **amended T176:** the Operator's corrected edition is 29,388 bytes and is the one in force (it restores the `btnyc.json` row that the shorter editions lacked).
- **S4 (#165): group membership is written on both sides and the sides disagree.** 5 services are listed by no group's `explicit_services` (`svc.dryer_repair`, `svc.stove_repair`, `svc.generic_mounting_service`, `svc.pax_wardrobe_assembly`, `svc.toilet_seat_replacement`) and 1 by two (`svc.furniture_repair_hourly`). The migration carried both sides as authored and resolved nothing. The validator now reports each as a `group_membership_disagreement` residual (counted in the coverage report; a ratchet in `verify_entity_first_validator.js` lets the set shrink and not grow). Which side is right is an Operator ruling per service (`RESHAPE_SCOPE_S1_S6.md` S4 step 2); until then the field stays as authored.

## 12. Verification design

1. **Content preservation (lossless proof).** `project_legacy.js` reads **only** `ssot/btnyc_source.json` and rebuilds the legacy authored sections; `--check` deep-compares them to `btnyc.json` minus the compiler-owned keys. Information cannot reach the projection except through the source, so a field the migration drops, or an id it mislabels, fails.
2. **Provenance.** The migration emits a leaf-level ledger (legacy path -> source path); a test asserts every leaf of the legacy authored sections is accounted for.
3. **Determinism and idempotence.** Migration run twice, byte-equal; validator and derivation run twice, byte-equal; derive(validate-clean source) twice.
4. **Reference integrity.** Every reference resolves to a node of the type its prefix names; no label is used as a key; no duplicate ids; IDs on every referenceable node (counts printed).
5. **Counterfactuals (class detectors).** Mutated copies of the source must each be rejected for the right reason: missing id, duplicate id, dangling reference, label-keyed reference, scope naming an unrelated entity, dependency on a missing option, dependency cycle, threshold above 1, empty profile, profile class never asked, class whose every retiring option is `unknown`, option claiming an effect it does not carry, a service with a gate and no policy, a dropped curated field (projection parity), an edited derived graph.
6. **Price safety.** The golden master (2,988 points) is captured before and compared after; because `btnyc.json` is not modified, zero movement is expected and checked.

## 13. What this task will not claim

Weights and thresholds are seeded from legacy numbers and are not validated business truth. Entity taxonomy for services without a component is a recorded decision. Scope classification for shared questions is rule-derived and listed. Anything the migration cannot map is reported with counts rather than defaulted.

## 14. T177 amendment: pricing rules, condition modifiers, customer vocabulary, the published artifact (source schema 1.0.0 -> 1.1.0)

The operator's directive of 2026-10-15 lifted the audit pause and asked for the domain model to be authored, not re-audited: business knowledge that the legacy runtime applies in code or implies in a name is to be stated in the source, with its evidence, and checked by the independent validator. This section records what changed and where each part is held. Nothing here edits `btnyc.json`, `qr.html`, the Charter or the Layer Map.

### 14.1 Three version numbers, three meanings (P-SYSTEM-VERSIONS)

| Version | Where | Value | Moves when |
|---|---|---|---|
| source schema | `source_schema_version`, `$source.source_schema_version` | 1.1.0 (was 1.0.0) | the shape of the authored source changes |
| derivation | `lib.DERIVATION_VERSION`, `$source.derivation_version` | 1.1.0 (was 1.0.0) | the shape of the generated artifact changes |
| interface | `lib.INTERFACE_VERSION`, artifact `interface_version` | 1.0.0 (new) | a consuming module would break (major) or an index is added (minor) |

A consumer states which of each it accepts in `schema/btnyc-interface-contract.json` and runs `artifact_compat.js` (it requires nothing) before it reads an index. No runtime module does this yet (PENDING_DECISIONS #218).

### 14.2 What the source gained

| Addition | Where in the source | Evidence and how it is held |
|---|---|---|
| Formula `inputs` | `registries.pricing_formulas[].inputs[]`: `trigger_modifier`, `select_branch`, `quantity` (`booking`, `answer_values`, `option_qty_value`), `constant_modifier` | `ssot/migration/recovered_rules.json`: each rule cites `qr.html` code by quoted line. `validate_source.js` V-FML-*; `verify_entity_first_pricing_rules.js` holds each input to `applyPricingFormula` by sensitivity |
| `qty_aware` | formula flag (4 formulas) | replaces `QTY_AWARE_FORMULAS`; held equal to it by the pricing-rules test |
| Option effects completed from the inputs | `option.affects` | a quantity option with `qty_value` 0 carries only `quantity`; V-OPT-EFFECT accepts a formula input or a fee row as a cause |
| Condition modifiers | `registries.modifiers[]` with `role: "condition"`, `basis`; carried by `service.modifier_ids` | three inferred from service names (PENDING_DECISIONS #209). They carry no fee and no minutes, are not projected into `global_rules.modifiers`, and are refused on an option (V-MOD-*) |
| Entity aliases | `entity.aliases[]` (285 on 65 entities) | seeded from the 81 NLP objects: the keyword is an entity id (43), else the default service's entity (33), else unresolved (5). Each object records `resolves_to {entity_id, basis}`. One rule moves a word off its object's entity: a word that IS the name of a service (slug words or display name) belongs to the entity that owns the service (T166's "internal hardware replacement"; V-VOC-ALIAS-SERVICE-OWNER, PENDING_DECISIONS #220). V-VOC-ALIAS-*, V-VOC-OBJECT-RESOLVE |
| Action vocabulary | `vocabulary.action_vocabulary {actions[], unmapped_verbs[]}` | replaces `negation_library.action_conjugations` keyed by service-type label; the projector rebuilds the legacy shape exactly. `remove` and `replace` name no action and are listed as unmapped; `act.mount` has no vocabulary |
| Pricing archetype definitions | `registries.pricing_archetypes[{id, definition}]` | copied from the legacy compiled block; equal to the compiler constant `PRICING_ARCHETYPE_DEFINITIONS`. Four declared archetypes disagree with the formula they name (#219) |

The migration is a pure function of `(btnyc.json, ssot/migration/recovered_rules.json)`; `last_migration.json` records the rules file's hash. All enrichment is source-only and stripped by the projector, so the projection parity with `btnyc.json` stays exact with no new declared normalization.

### 14.3 The price claim

The source makes no price claim of its own. A question prices the quote iff some option declares the `price` effect; the legacy `affects_price` flag survives under `runtime_compat` for the UI badge only. Against the 124 legacy claims: 69 backed by an option's price effect, 50 indirect (the question routes or selects, and the price follows), 5 unwired (the claim has no effect behind it), and 2 priced questions that the legacy file does not claim. These are residuals, not errors, and the badge semantics are an Operator decision (#215).

### 14.4 The published artifact

`ssot/derived/btnyc_graph.json` is the candidate published artifact. Its top-level key set is closed (`schema/btnyc-artifact.schema.json`): `$source`, `interface_version`, `derivation`, `counts`, `manifest` and 14 indexes. Every index names a consumer in `manifest.indexes[k].consumers`, a module of the Layer Map (`resolver.js`, `composer.js`, `confidence_engine.js`, `recovery_engine.js`, `pricing_engine.js`, `nlp_engine.js`, `UIRenderer.js`) or the CMS; the manifest says plainly that those modules are targets, not yet extracted from the runtime (R-SYSTEM-INDEXPROXY). `publish.js` is the only writer and runs eight gates (G-SOURCE, G-DERIVE, G-REPRODUCIBLE, G-ARTIFACT, G-CONSUMERS, G-COMPAT, G-FRESH, and G-COMMITTED under `--check`). It writes the candidate artifact and nothing else; it does not write `btnyc.json`. Moving the artifact path to `btnyc.json` and stamping `$source` into it is the P2 step of the transition, which stays open until 2027-06-30.

**How a customer word is matched (T166, stated in the contract at 1.1.0).** The artifact carries words to look for in free text (the keys of `alias_index`, the synonyms of a smart tag), and the vocabulary keeps terms that are fragments of other words ("cement" in "replacement", "desk" in "desktop", "screen" in "flatscreen", "range" in "strange": 162 occurrences over 26 alias terms in the catalog's own text). The matching rule, not the vocabulary, keeps them from firing: `schema/btnyc-interface-contract.json` `matching` says a term matches as a whole word or a whole phrase, names `modules/nlp_engine.js` `wordBoundaryMatch` as the one matcher (R-INVARIANT-CANONICAL), lists its inflections, and names its one documented exception (doubled-consonant forms such as drip -> dripping are covered by listing the word). The label of a placeholder entity ("Fans (unspecified item)") is a display label, not a customer word, and is not indexed. `verify_entity_first_vocabulary.js` section 8 holds all of it against the real matcher and plants a substring matcher to show the check can fail.

### 14.5 What this amendment does not claim

- It does not claim the recovered pricing rules are the Operator's intent, only that they are what the legacy code does, with a citation each. Where the code is plainly a defect it is not reproduced: label parsing, the `parseInt` fallback for a PAX count, and the stale `tile_count`, `unit_count` and `__exact_count` keys are recorded as dropped, with why.
- "50 sq ft or more" prices as exactly 50 in the legacy code, so a larger area is under-estimated. The source states the value the engine uses.
- Seven services at three composition points remain open: computer repair (2), furniture repair (3), os setup (2). They differ by verb or entity, not by a modifier, and need an Operator ruling (#209).
- No runtime module is written or wired. The PAX coefficient constant that `qr.html` still holds is guarded against drift by a test, not replaced (#217).

