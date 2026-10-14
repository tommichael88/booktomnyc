# Entity-first SSOT: design note (T175)

Status: written before any data was migrated, from inspection of the tree at `afc972d` (`t174-landing`; PR #21 not merged).
Authority: the Playbook (`PROJECT_CHARTER.html`) and `COMPONENT_LAYER_MAP.md`, installed byte-for-byte at `6a0ad6f` and not edited by this work.
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
| `schema/btnyc-source.schema.json` | Source schema, `source_schema_version` 1.0.0 | structure |
| `test_harness/tools/entity_first/validate_source.js` | Independent validator. Callable without derivation. Exit non-zero on any violation. | structure |
| `test_harness/tools/entity_first/derive_graph.js` | Derives `ssot/derived/btnyc_graph.json`. **Refuses invalid source** (runs the validator first). | structure |
| `test_harness/tools/entity_first/migrate_legacy.js` | One-time, reproducible migration of `btnyc.json` to the source, with a leaf-level provenance ledger | transition |
| `test_harness/tools/entity_first/project_legacy.js` | Projects the source back to the legacy authored sections; `--check` diffs against `btnyc.json` | transition |
| `btnyc.json` | Runtime file, **unchanged by this task**. Its authored sections are, from now on, a *projection* of the source. | transition |

`btnyc.json` is not edited by hand or by this task. The runtime, and therefore the price golden master, cannot move. The dual-source period this creates is explicit (R-SYSTEM-DUALSOURCE): `ssot/TRANSITION_DUALSOURCE.md` records what is duplicated, which side is authoritative (the source), how drift is detected (the parity check in the suite), and the closure condition (the runtime consumes the derived graph and `btnyc.json` stops being a file anyone edits). Until then a legacy `ssot_patch.js` edit to `btnyc.json` fails the parity check until the equivalent source edit is made.

## 4. Identity and reference grammar

Every referenceable node has a stable id of the form `<type>.<slug>`:

`ent.` entity, `act.` action, `mod.` modifier, `svc.` service, `cmp.` default composition (the decomposed dynamic service), `q.` question, `u.` uncertainty class, `tag.` smart tag, `mat.` material, `fml.` pricing formula, `chk.` checkout state, `cat.` category, `grp.` group, `cls.` behavioral class, `ctx.` context scope.

An **option** id is unique within its question; an option is only ever referenced as the pair `{question_id, option_id}` (never as a bare string, never by label). Symptom options keep the curated `sym.<slug>` ids that `routing_archetypes` already carries, so no curated id changes.

IDs are generated **once**, by the migration, from the legacy key or label (`slug`: lowercase, non-alphanumerics to `_`, collapsed, trimmed, 60 characters, collision-suffixed in document order), then frozen in the source. A label change never changes an id. Labels and aliases are never keys.

Legacy spellings normalised at the migration boundary: `{"$ref":"#tag"}` and `"#tag"` -> `tag.x`; `comp.x` -> `ent.x`; bare service ids -> `svc.x`; module keys -> `q.x`; `module::noun` -> an instance question id; label-keyed `then`/`depends_on`/`answers` -> `{question_id, option_id}` pairs; modifier slug keys -> `mod.x`; SKUs -> `mat.x`. Nothing reads a label as a key after this boundary.

## 5. Source layout (`source_schema_version` 1.0.0)

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

**7.3 Option ids and `affects`.** Option id = `<question slug>.<label slug>` (symptom options `sym.<slug>`). `affects` is computed, per option, from fields the option actually carries:

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
- The superseding Layer Map is 7,417 bytes; the one it replaces was 26,751.

## 12. Verification design

1. **Content preservation (lossless proof).** `project_legacy.js` reads **only** `ssot/btnyc_source.json` and rebuilds the legacy authored sections; `--check` deep-compares them to `btnyc.json` minus the compiler-owned keys. Information cannot reach the projection except through the source, so a field the migration drops, or an id it mislabels, fails.
2. **Provenance.** The migration emits a leaf-level ledger (legacy path -> source path); a test asserts every leaf of the legacy authored sections is accounted for.
3. **Determinism and idempotence.** Migration run twice, byte-equal; validator and derivation run twice, byte-equal; derive(validate-clean source) twice.
4. **Reference integrity.** Every reference resolves to a node of the type its prefix names; no label is used as a key; no duplicate ids; IDs on every referenceable node (counts printed).
5. **Counterfactuals (class detectors).** Mutated copies of the source must each be rejected for the right reason: missing id, duplicate id, dangling reference, label-keyed reference, scope naming an unrelated entity, dependency on a missing option, dependency cycle, threshold above 1, empty profile, profile class never asked, class whose every retiring option is `unknown`, option claiming an effect it does not carry, a service with a gate and no policy, a dropped curated field (projection parity), an edited derived graph.
6. **Price safety.** The golden master (2,988 points) is captured before and compared after; because `btnyc.json` is not modified, zero movement is expected and checked.

## 13. What this task will not claim

Weights and thresholds are seeded from legacy numbers and are not validated business truth. Entity taxonomy for services without a component is a recorded decision. Scope classification for shared questions is rule-derived and listed. Anything the migration cannot map is reported with counts rather than defaulted.
