# BASELINE_T154.md -- PHASE_PLAN.md A1 (captured, not fixed)

Captured on the tree at commit `phase-a/A1` (build `T153` + the T154 LED ruling). Every number below is a *starting state*; "must not add new reds" is measured against it.
The reds are preserved on purpose (PHASE_PLAN: "Baseline reds are preserved, not fixed").

| Baseline | Value | Artifact |
|---|---|---|
| Price golden master | **1,380 points, 0 errors** (`price_golden_master.js capture`) | `golden_master_T154_original.json` (the original; preserved as the diff reference after A1.6 extends the inputs) |
| Real-browser differential | **836 entries, 0 different, 0 render errors, 0 page errors** (base = head = this `qr.html`) | `render_diff_baseline_T154.txt` |
| Full suite | **178 suites run: 102 pass, 76 fail** (176 listed in MASTER + the two unlisted tests of #109) | `suite_baseline_T154.tsv` (name, exit code, seconds, last summary line) |
| Unified suite `verify_charter_rule_index_v10.js` | **277 passes, 21 failures** (all pre-existing, #104) | `unified_suite_baseline_T154.txt` |
| Boundary test `verify_r-invariant-boundary_ui_renderer_layer.js` | **52 / 52** | (in the suite baseline) |
| `verify_charter_rules.js` | **30 problems** = 4 markup slips (3 duplicate rule codes, 1 broken anchor) + 26 rules with no named test file | (in the suite baseline) |
| `tsc --noEmit` | **598 errors in 10 files** (TypeScript 5.9.3) | `types_baseline.txt` |

**A discrepancy to surface (R-GOVERN-SURFACE).** `PHASE_PLAN.md` and `COMPONENT_LAYER_MAP.md` give the `verify_charter_rules.js` baseline as **34 problems** ("4 markup, 30 pre-existing, 26 rules with no named test"). The tool reports **30** on this tree, and `PENDING_DECISIONS.md` #100's own title says "four markup slips ... and 26 rules with no named test" (4 + 26 = 30). The documents' 34 counts the four markup slips twice. The baseline used here is the measured 30.

## The 76 failing suites (the preserved baseline reds)

- `verify_appliance_keywords_and_confidence_cap.js`
- `verify_archetype_layer_phase1.js`
- `verify_base_materials_fix.js`
- `verify_btnyc_v10_compiler.py`
- `verify_btnyc_v5_compiler.js`
- `verify_btnyc_v8_compiler.py`
- `verify_category_icons_tabler_migration.js`
- `verify_ceiling_tile_dynamic_service.js`
- `verify_charter_rule_index_v10.js`
- `verify_cms_bridge.js`
- `verify_compiled_output_against_real_schema.js`
- `verify_compiled_output_against_real_schema.py`
- `verify_component_tracing_overlay.js`
- `verify_compute_quote_for_draft.js`
- `verify_compute_quote_for_draft.py`
- `verify_confidence_strategy_inheritance.js`
- `verify_contextual_override_word_order_fix.js`
- `verify_curated_card_chain_rewire.js`
- `verify_curated_card_live_behavior.js`
- `verify_curated_intake_confidence_agreement.js`
- `verify_data_backup_question_wording.js`
- `verify_delegated_vocabulary_batch_1.js`
- `verify_delegated_vocabulary_batch_2.js`
- `verify_delegated_vocabulary_batch_3.js`
- `verify_delegated_vocabulary_batch_4.js`
- `verify_description_matching_mechanism.js`
- `verify_dish_washer_cross_entry_fix.js`
- `verify_dumb_ui_html_self_sufficiency.js`
- `verify_dynamic_archetype_batch_2b.js`
- `verify_dynamic_archetype_batch_2e.js`
- `verify_file_integrity.js`
- `verify_furniture_flat_fee_pricing.js`
- `verify_input_sanitization.js`
- `verify_input_sanitization.py`
- `verify_intake_defaults_meaningfulness_review.js`
- `verify_microwave_stove_ordering_fix.js`
- `verify_mutual_exclusion_wired_into_main_render.js`
- `verify_natural_phrasing_corpus_fixes.js`
- `verify_nlp_analyze_mode.js`
- `verify_nlp_engine_module.js`
- `verify_nlp_incidental_keyword_fix.js`
- `verify_nlp_synonym_weights.js`
- `verify_no_module_drift.js`
- `verify_no_orphaned_data.js`
- `verify_object_based_resolver.js`
- `verify_object_extraction_location_skip.js`
- `verify_orchestrator_engine_module.js`
- `verify_orchestrator_phase2.js`
- `verify_pax_wardrobe_formula.js`
- `verify_phase6_self_quote_rewire.js`
- `verify_placeholder_data.js`
- `verify_plural_quantity_and_object_extraction_fixes.js`
- `verify_pricing_archetype_restoration.js`
- `verify_pricing_engine_module.js`
- `verify_r-invariant-deletion_declared_retirements.js`
- `verify_r-system-layers_full_matrix.js`
- `verify_raw_vs_compiled_reconciliation.js`
- `verify_reported_ui_bugs_batch1.js`
- `verify_routing_archetype_semantic_check.js`
- `verify_self_quote_bug_fixes.js`
- `verify_self_quote_ui_template_invariant.js`
- `verify_service_type_normalization_consolidation.js`
- `verify_shadow_mode_broad_sweep_phase5_5.js`
- `verify_smart_tag_reference_pathway.js`
- `verify_smoke_test_findings.js`
- `verify_sqanalyze_orchestrator_equivalence.js`
- `verify_substring_collision_fixes.js`
- `verify_t107_tracing_corrections.js`
- `verify_tile_drywall_formula_wiring.js`
- `verify_tracing_tool_v2_upgrade.js`
- `verify_tracing_v3_full_instrumentation.js`
- `verify_ui_surfaces.js`
- `verify_waterproof_area_formula_fix.js`
- `verify_xss_fixes.js`
- `verify_charter_rule_index_v2.js`
- `verify_charter_rules.js`
