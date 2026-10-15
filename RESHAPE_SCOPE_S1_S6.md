# Scope: reshaping `btnyc.json` into a flat graph (S1 to S6)

Filed 2026-10-10 NY (T167) on your ruling of 2026-10-10 19:45 NY (PENDING_DECISIONS #165): "Leave the shape ... file a short scope for it as the next session's work after the content pass closes ... a written plan for S1 to S6 with a migration path for each, so it doesn't sit unread. Default if unanswered: hold."

**Status: filed, not started. Nothing in this document is done, and nothing starts without your go.** The numbers below were measured on the T167 tree (`t167-question-pass`) with the commands in the last section, so a later session can re-measure them before it trusts them.

**Status update (T176, PENDING_DECISIONS #212, #165).** The shape work this file scoped was done differently: the T175 migration authored the entity-first source (`ssot/btnyc_source.json`) and the Charter's end state names it, not `btnyc.json`, as the authority. Consequences for each step, so a later session does not follow the plan below as written:

- **S1 to S3 and S5: the data halves are realized in the source** (an id on every option, 593 of them; one reference spelling, `tag.x`; `{question_id, option_id}` instead of label keys; no `compiled` or other compiler-owned key). They are **not** to be applied as patches to `btnyc.json`: the legacy file is now a mirror that `project_legacy.js --check` holds equal to the projection of the source, so a patch that moves it toward the new shape fails that check by design. Their **code halves** (the one parse helper, option-id reads in the page and engines) are runtime changes that belong to the adapter that will read the published artifact (`ssot/TRANSITION_DUALSOURCE.md`, #212); T176 does not authorize them and none was made.
- **The correct workflow before the cutover** is in `ssot/TRANSITION_DUALSOURCE.md`: edit the source; carry what the legacy shape can express to the mirror with `ssot_patch.js` then `splice_compiled.py`, which are intact for the legacy shape and never edit the new source. After the cutover the mirror is replaced by the derived artifact and those tools are retired with it. The cutover point is the one commit that adds the publish command, the runtime adapter and the regenerated `btnyc.json` together (design note section 3.1.5).
- **S4 is measured, not resolved.** The validator reports the 6 disagreements (5 services in no group's list, 1 in two) as `group_membership_disagreement` residuals; a ratchet lets the set shrink and not grow. The step-2 ruling per service is still the Operator's, and the compiler still reads `explicit_services` (so the field is kept as authored). Nothing was derived or deleted.
- **S6 (one schema).** The source schema `schema/btnyc-source.schema.json` is the one authority for authored shape (the Charter's "one versioned schema validates source shape"). `schema/btnyc_schema.json` is the interface contract of today's legacy-shaped file and ends with the mirror; after the cutover the artifact's shape is governed by the derivation version and the publish step's output checks, not by a second hand-authored schema. The 2.0 to 3.0 migration this section scoped is the T175 migration plus the interface-version decision filed in #212; the stale copies (`schema/btnyc-v10.schema.json`, `schema/btnyc_v3_schema.json`, the root `btnyc_schema.json`) are still unretired and still S6's. Design note section 3.1.5 has the full account.
- **Frozen ids** are now checked: `ssot/migration/id_register.json`, `id_register.js`, `verify_entity_first_id_freeze.js` (the ratchet S1 asked for: a recorded id list that can grow and cannot shrink without a written retirement).

## What the reshape is for (R-GOVERN-TRANSITION: the workaround the shape forces)

Today a reader of `btnyc.json` has to know seven things that are not in the data: that an answer is identified by its label text, that a tag can be spelled four ways, that a group's service list repeats a service's own `group_id`, that derived data sits in the file humans edit, and so on. Each one has already cost something. A non-breaking hyphen in 11 labels silently killed the `electrical_item` branch for months (T166, `DEFECT-DANGLING-REFERENCE`); eight places in the page and the engine each parse a tag reference by hand. The endpoint is a catalog where every thing that is pointed at has an id, every pointer has one spelling, every fact is written once, and derived data is not in the source of truth's file.

The Charter already allows this (`R-SYSTEM-SHAPE`: "shape is a design decision"; `R-GOVERN-TRANSITION`: rationale, endpoint, ledger entry; `P-SYSTEM-VERSIONS`: additive changes do not bump the schema version, structural ones do). The reason it waits is yours: it touches every reader, and a content pass should not also change the container it is editing.

## Order and dependencies

| Step | What | Behaviour-neutral? | Needs | Bumps schema version? |
|---|---|---|---|---|
| S1 | an `id` on every option | yes (nothing reads it) | nothing | no (optional field) |
| S3 | one reference spelling and one parse helper | yes (code half), yes (data half) | nothing | the data half is not additive |
| S5 | `compiled` out of the editing file (parity first) | yes for the page | nothing | the move is not additive |
| S4 | derive the group's service list | **no** (see S4) | your ruling per service | removal of a key |
| S2 | read `then`, tag `answers` and fee maps through option ids | yes if the dual-read holds | S1 | the data rewrite is not additive |
| S6 | schema 2.0 to 3.0, one migration, one schema file | n/a | S2 to S5 landed | **yes** |

Proposed sessions, if you give the go: **session A** = S1, S3, S5 (all three are provable behaviour-neutral by the golden master and the render differential, and S1 is what S2 needs). **Session B** = S4's measurement and your ruling, then S2. **Session C** = S6. Each session keeps the B to H bar: a detector that fails first, no pass to fail in the suite, no unexplained price movement, golden-master differences attributed field by field, `tsc` count recorded, a ledger entry with a "Default if unanswered".

---

## S1. Give every option an id

**Today.** 461 `client_response` options across 122 modules, none with an id (keys present: `label` 461, `tags` 332, `complexity_override` 240, `modifier_ref` 143, `checkout_state_override` 31, `qty_value` 24, and a few more). Labels are unique within a module (0 duplicates), so a label works as a key, and that is exactly how it is used.

**Migration path.**
1. Schema: add optional `id` (string, `^[a-z0-9_]+$`) to the option definition. An optional field is additive: no version bump (`P-SYSTEM-VERSIONS`).
2. A one-time script, `tools/assign_option_ids.js`, writes the ids with `ssot_patch.js` (byte-preserving). Rule: slug of the label, lower case, non-alphanumerics to `_`, a numeric suffix on a collision inside the module. **The id is frozen once written: editing a label later must not change it.** That is the whole point, and it is the one thing a reviewer should check.
3. `splice_compiled.py` regenerates `compiled.*`; the fixed point is confirmed.

**Detector first.** Extend `verify_ssot_reference_integrity.js` with an ids leg: every option has an id, ids are unique within the module, ids match the pattern. Red on the current tree (461 missing). A second leg guards the freeze: `fixtures/option_ids_frozen.json` lists every `module.option_id` ever assigned; an id that disappears or changes fails unless a ledger entry names it (same shape as the ratchets in `verify_non_retiring_answers.js`: it can grow, it cannot silently shrink).

**Gates.** Golden master: 0 differ expected (nothing reads `id`). Render differential: any route payload that serialises an option will now carry `id`; expect those entries, and attribute each (the T166 differential did exactly this for the option-tag spelling). Full suite, ship gate, `tsc`.

**Reversal.** Delete the field. **Needs from you:** nothing. **Size:** one patch, one schema line, two detector legs.

## S2. Read `then`, tag `answers` and fee maps through option ids

**Today (label-keyed readers and data).**
- Data keyed by label: 40 `then` keys (services' and modules' chains), 33 tag `answers` entries (module to label), and `issue_type_fees` in the pricing formulas (keyed by the issue label; a second scan found it in the furniture repair formula and one other).
- Code that finds an option by label: `qr.html` L1391, L1521, L2351, L2539, L2674, L2869 (six `.find(r => r.label === answerLabel)`), the chain resolver (`resolveOne`, `step.then[parentAnswer]` at L2098 and L2246), tag synthesis (`synthesizeAnswersFromTags`, L2161 to L2200, L2350), and the chip `value: r.label.toLowerCase()` at L8997 and L9027.
- State: `S.answers[moduleKey]` and the orchestrator's `context.answers` hold the label text. The cart (`sessionStorage` `booktom_cart_v2`, lives as long as the tab) was checked: its entries carry the notes text and totals, not the answers map. So the label-keyed state that can outlive a deploy is a tab that was open across it.

**Migration path (the reason it is last of the code steps: it needs S1).**
1. **One lookup.** A pure Logic function `optionFor(module, answer)` that takes an id **or** a label (legacy) and returns the option. Switch the six `.find` sites and the chip builder to it. Behaviour-neutral by construction; a source-shape detector (like `verify_no_duplicate_registries.js`) fails on a remaining `r.label ===` lookup outside the function.
2. **Dual-read in `then`, tag `answers` and fee maps:** the resolvers accept an id or a label key. Still no data change.
3. **Rewrite the data** (40 + 33 + the fee maps) to ids in one `ssot_patch.js` patch. Golden master and render differential must show 0 price movement; the dual-read is what proves the old label inputs still work (the golden master drives the first option of every chain module by label today, `price_golden_master.js` L20 to L22; it keeps passing unchanged).
4. **State stores ids.** The label path stays in `optionFor` for one release (an old tab) and is then removed under a ledger entry (`R-INVARIANT-DELETION`).
5. Typography stops being a key: the lookalike-character lint (T168) remains as a cosmetic guard, not a correctness one.

**Detector first.** The ids leg of S1 plus a mutation test: rename a label in a copy of the SSOT and show that a `then` branch, a tag answer and a fee map still resolve (today they do not, which is the red). **Reversal:** step 3 is one patch to revert. **Needs from you:** how long the label fallback lives (default: one release). **Size:** the largest step; one function, nine call sites, three data shapes.

## S3. One reference spelling, one parse helper

**Today.** 255 `{"$ref":"#tag"}` objects outside `compiled` (181 `dynamic_services.*.suggested_tags[]`, 69 `services[].default_tags[]`, 2 `smart_tags.*.derived_from[]`, 2 `smart_tags.*.requires[]`, 1 `intent_mappings.objects[].contextual_overrides[].smart_tag`), every one of the form `"#tag_id"`; **0 use the path form** (`#/smart_tags/#x`) that most of the parsing code is written for. Plain `"#tag"` strings are the spelling everything else uses (option tags were normalised to it in T166). Eight places parse it by hand: `qr.html` L1841, L1947, L1966, L3567, L4339, L4516, L10661 and `modules/nlp_engine.js` L1190. A ninth, `resolveRefs` (`qr.html` L8683), expands path references and **has no caller** at all.

**Migration path.**
1. **Code half (safe in either data state).** One pure helper `tagIdOf(ref)` accepting a string or an object, in `nlp_engine.js` (the page already depends on that module; PENDING_DECISIONS #145 records the deploy order). Switch the eight sites. Delete `resolveRefs` under `R-INVARIANT-DELETION`, with the ledger line saying it had no caller.
2. **Data half.** Rewrite the 255 objects to `"#tag"` strings (one patch; golden master 0 differ expected). The schema's tag-reference definition then accepts strings only; the compiler's `_validate_smart_tag_refs` reports the object spelling as an error.

**Detector first.** A source-shape check that `.$ref` is read in exactly one function; the integrity detector's existing "ONE SPELLING" leg extended from option tags to all 255 (red today). **Reversal:** step 1 is neutral, step 2 is one patch. **Needs from you:** nothing. **Size:** eight sites, one helper, one patch.

## S4. Derive `group.explicit_services`

**Today.** Each group lists its services; each service also names its group (`ui_taxonomy.group_id`). They disagree: 5 services are in no group's list (`dryer_repair`, `stove_repair`, `generic_mounting_service`, `pax_wardrobe_assembly`, `toilet_seat_replacement`) and 1 is in two (`furniture_repair_hourly`). **Correction to the T166 statement "nothing reads the field":** the page and engines do not, but **the compiler does** (`test_harness/btnyc_v10_compiler.py` L576 derives each group's set of actions from it; L1123 validates it), so the listed services shape `compiled.routing_archetypes`, which the page reads live (`qr.html` L4090, L5066, L7797). Two tests also read it (`verify_no_orphaned_data.js`, `verify_ssot_consultation.js`).

**This is the one step that is not behaviour-neutral.** Deriving the list changes what the compiler sees for six groups, so their derived archetypes (actions, components, symptoms) can change, and with them the semantic route check.

**Migration path.**
1. **Measure only, no change:** run the compiler with the list derived from `ui_taxonomy.group_id` into a scratch file and diff `routing_archetypes` group by group, field by field. This is the evidence for the ruling.
2. **Your ruling**, per service: is the omission from the list a mistake (derive it) or deliberate (the service's `group_id` is wrong)? The same for `furniture_repair_hourly`'s double entry.
3. The compiler derives the list; `ssot_patch.js delete` removes the field; two tests are retargeted (a loader-level change: the SSOT is the right side). Golden master, render differential and the route-validation tests re-run; any `routing_archetypes` movement is listed field by field in a golden-change record.

**Detector first.** The membership leg in `verify_ssot_reference_integrity.js` already checks resolution; add completeness (every service is in exactly one group) with the current 6 as the red, and carry them as a ratchet that only shrinks until step 3. **Reversal:** step 3 is one commit. **Needs from you:** the ruling in step 2. **Size:** compiler change plus six services plus the measurement.

## S5. Move `compiled` out of the file humans edit

**Today.** `compiled` is 420,894 bytes of the 1,019,916-byte minified file (41.3%), and the minified file is 1,452,513 bytes on disk. Without it: 598,864 minified, and **gzip 148,719 down to 104,705 bytes (-30%)** on every first page load (the page preloads `btnyc.json`). **The page never reads any of its ten indexes** (`pricing_index`, `component_index`, `action_index`, `symptom_index`, `service_index`, `candidate_matrix`, `module_index`, `smart_tag_index`, `material_index`, `formula_index`: 0 references in `qr.html` and `modules/`). Nine test files reference the `compiled` namespace or one of its index names (`verify_btnyc_v10_compiler.py`, `verify_btnyc_v5_compiler.js`, `verify_btnyc_v8_compiler.py`, `verify_charter_rule_index_v10.js`, `verify_charter_rule_index_v2.js`, `verify_knob_pull_tiered_pricing.js`, `verify_non_retiring_answers.js`, `verify_raw_vs_compiled_reconciliation.js`, `verify_ssot_consultation.js`). Other compiler-owned keys: `pricing_archetypes`, `_compiler_metadata`, `_additive_diff`, `_schema_validation`, `_archetype_mismatch_report` (the page reads none), and `routing_archetypes` (**the page reads it live: it stays in the SSOT's reach**). `P-SYSTEM-NOEDIT` says either placement is compliant, so this is a payload and review-noise decision, not a governance one.

**Migration path.**
1. **Parity first.** `splice_compiled.py` gains `--derived-out btnyc.compiled.json` and writes the derived keys there as well; the SSOT keeps them. A test asserts the sibling file equals the compiler's output on the current SSOT (the fixed point already proven for `compiled`).
2. **Retarget the nine tests** to the sibling file where they read the derived keys from `btnyc.json` (loader-only; no assertion changes, the T166 precedent for `verify_infer_tags_from_context_groupid_fix.js`).
3. **Remove the derived keys that nothing live reads from `btnyc.json`** (everything above except `routing_archetypes`), in the S6 patch. Deploy: `btnyc.compiled.json` is published beside the SSOT and nothing fetches it.

**Detector first.** The parity test (red until the sibling exists) and a "page reads no key that is not in the SSOT's served file" source-shape check. **Reversal:** steps 1 and 2 are additive and reversible; step 3 is one patch. **Needs from you:** whether `routing_archetypes` should stay where it is (default: yes). **Size:** one tool flag, nine loader changes.

## S6. Schema 2.0 to 3.0, with one migration and one schema file

**Today.** `meta.schema_version` is `2.0` and `meta.version` is `9.6.0` (read by one test, `verify_charter_rule_index_v10.js` L1823, and by no code). The schema's own description says "btnyc.py's MIGRATIONS dict keys off this field", **and no such mechanism is in the repository.** There are **two schema files that differ** (`schema/btnyc_schema.json`, 88,175 bytes, is the current one the SSOT's `$schema` names; the root `btnyc_schema.json`, 63,656 bytes, is the stale copy the T157 comment in `orch_resolve_schema_location` already records as "a stale copy from another generation", and it is still the page's default path when the SSOT names none).

**Migration path.**
1. After S2 to S5 have landed: write `tools/migrate_schema_2_to_3.js` that turns a 2.0 document into a 3.0 one (the inverse of S2 to S5: label keys to ids, `$ref` objects to strings, no `explicit_services`, no `compiled`), and run it against a copy of the SSOT on every test run so the migration is exercised, not just written. The compiler's `_additive_diff` records what changed.
2. One schema (`schema/btnyc_schema.json`); retire the root copy and change the page default so it names the same file (today's default path is the stale one).
3. Bump `meta.schema_version` to `3.0`; `meta.version` to the content version at that point (`P-SYSTEM-VERSIONS`: the two counters answer different questions). A page that finds a 2.0 file reports it instead of misreading it (the boot gate already shows a visible failure).

**Detector first.** The migration round-trip (2.0 fixture to 3.0 equals the checked-in 3.0, and the 3.0 validates), red until the tool exists. **Reversal:** git, one commit; the 2.0 fixture stays in `fixtures/`. **Needs from you:** the go for the version bump, and agreement to retire the root schema copy. **Size:** one tool, one schema, one number.

---

## A related reshape that is not S1 to S6: the Charter's scripts (#200)

Filed at T173 on the operator's 01:43 NY ruling on #198 ("Extracting the scripts (B) is a reshape: file it as its own proposal, cross-referenced from #165's scope doc"). It is listed here so that anyone planning the reshape sees it, and it is **not part of S1 to S6 and not started**.

The Charter (`PROJECT_CHARTER.html`) carries three `<script>` blocks: the status band's code, and, inside the appendix `<template>`, the builder demo's data and code. Option B of #198 would move them into `.js` files beside the Charter so they are linted, type-checked and scanned by CodeQL as JavaScript, and a Charter edit never touches them. #198 A (the one-block-per-line re-flow, done at T173) already removed the cost that mattered (a revision-log row no longer shares a line with the scripts); B would remove the remaining one at the price of the Charter being a document that opens as one file from `file://`.

It has the same shape as **S5** (`compiled` moved out of the file humans edit): if the single-file property is to be kept, a build step emits the single-file Charter from the sources, and the file people read is generated. The two should be decided together, because they choose the same build step: whichever of S5 or #200 lands first fixes how "edit the sources, publish one file" is done in this repository.

Options, detector and reversal are in `PENDING_DECISIONS.md` #200 (B1: the status band only; B2: all three with a build; B3: leave as it is, the default). The detectors that already exist for it: `tools/charter_reflow_proof.js`, `tools/charter_dom_proof.js` (`verify_charter_line_shape.js` was retired at T176, `test_harness/retired/README.md`: the merged Charter edition keeps no revision log and is synced byte-for-byte).

---

## What this plan does not touch

The content (questions, labels, tags, prices), the confidence values (#168, held under #140), the tag-gate bypass (#161, its own session), and the cart. A step that would change what a customer is asked or charged is not in this plan; it would be filed and ruled first, as every content change is.

## How to re-measure these numbers

```
node -e 'const D=require("./btnyc.json"); /* options: Object.values(D.intake_modules).flatMap(m=>m.client_response||[]).length */'
grep -n '\.\$ref\|\$ref' qr.html modules/*.js                       # S3 sites
grep -n 'r.label ===' qr.html                                          # S2 sites
grep -n 'explicit_services' test_harness/btnyc_v10_compiler.py        # S4 compiler reads
grep -c 'pricing_index\|candidate_matrix' qr.html modules/*.js        # S5: expect 0
node test_harness/verify_ssot_reference_integrity.js                  # the detector the steps extend
```
