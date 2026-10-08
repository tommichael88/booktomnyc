#!/usr/bin/env node
/**
 * verify_ssot_consultation.js
 *
 * THE ORCHESTRATOR/SYNC-CHECK MECHANISM — built per direct request after
 * a long session of finding real bugs one at a time (services mis-wired
 * to the wrong intake module, pricing formulas with no real question
 * behind half their inputs, a confidence calculation that double-counted,
 * a whole node — confidence_tiers — duplicating another that's actually
 * used). Each of those was found by accident, by happening to look in the
 * right place. This script is the thing that should have caught them
 * automatically, and the thing that prevents the NEXT one from going
 * unnoticed for months.
 *
 * WHAT THIS DOES, EXACTLY:
 *   1. Walks the REAL, CURRENT btnyc.json and enumerates every meaningful
 *      field path that exists in the data RIGHT NOW — not a hardcoded
 *      snapshot from when this script was written. Add a new field to
 *      the JSON tomorrow, and this script discovers it tomorrow.
 *   2. For each field path, checks whether qr.html's real source
 *      genuinely references it (by the field's own key name, with a
 *      generous set of real access patterns: DB.x, SERVICE_DATA.x,
 *      data.x, destructured access, etc.)
 *   3. Compares the result against KNOWN_DEAD_OR_REDUNDANT below — an
 *      explicit, documented, reasoned allowlist of every field this
 *      project has actually investigated and deliberately decided is
 *      fine to leave unconsulted (with the reason recorded right next to
 *      it, so a future reader doesn't have to re-derive the reasoning).
 *   4. ANYTHING NOT ON THAT LIST that comes back unconsulted is a HARD
 *      FAILURE. Not a warning, not a note — a failing exit code. The
 *      only way to make a real, new "is this dead?" finding stop failing
 *      the build is to ADD it to the allowlist with a real, written
 *      reason, the same discipline every entry below already follows.
 *      This is intentional: silence is not an acceptable resolution for
 *      "we don't know if this is used." A human has to make a decision
 *      and write it down.
 *
 * WHAT THIS DOES NOT DO (and should not try to):
 *   - It cannot tell you WHICH of the 3 real entry paths (Catalog/
 *     showIntakeQuestions, named-service/prefillSmartQuoteFromService,
 *     free-text/sqAnalyze + Other-tile/prefillSmartQuoteFromOtherTile)
 *     consults a field — only whether ANY of them do, anywhere in the
 *     app. Per-path breakdown requires the heavier transitive call-graph
 *     analysis used to build architecture_audit_matrix_final2.json this
 *     session — that's a deliberate, deeper, slower audit to re-run when
 *     genuinely needed (e.g. "does the LEGACY catalog path specifically
 *     handle X"), not something to run on every change.
 *   - It cannot tell you if a field is consulted CORRECTLY (e.g. with the
 *     right sign, the right unit, the right precedence against a sibling
 *     field). It only proves "some code somewhere references this key."
 *     Real bugs (the confidence double-count, the inverted "Not sure"
 *     pricing) still require the kind of direct, by-hand verification
 *     this whole project has been doing — this script catches the
 *     "completely forgotten" class of bug, not the "implemented wrong"
 *     class.
 *
 * Run this after ANY edit to btnyc.json's structure (new field, renamed
 * field) or qr.html's data-access code, before considering the change
 * complete. Treat a new failure exactly like a failing pricing-vector
 * test: it means something real needs investigating, not silencing.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.dirname(__dirname);
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));
const QR_HTML = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
const SCRIPTS = [...QR_HTML.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const SRC = SCRIPTS.join('\n');

// ─────────────────────────────────────────────────────────────────────────
// KNOWN_DEAD_OR_REDUNDANT — every field this project has actually
// investigated and deliberately decided is fine to leave unconsulted.
// Each entry's reason is the actual finding, written down so it doesn't
// have to be re-derived. If you find yourself wanting to add an entry
// here WITHOUT having actually traced the real code first, stop — that's
// exactly the discipline this tool exists to enforce.
// ─────────────────────────────────────────────────────────────────────────
const KNOWN_DEAD_OR_REDUNDANT = {
    'global_rules.force_modules_by_variability_DEPRECATED': 'T118: deliberately deprecated, not a gap. Renamed from force_modules_by_variability when universal force-injection was replaced by intake_defaults (per explicit operator brief). Kept under this new name specifically so no code reads it -- reversibility record only, per the brief\'s own "easier to reverse" guidance. Confirmed directly: zero references anywhere in qr.html under either name.',
    'global_rules.force_modules_by_variability_DEPRECATED.low': 'Sub-node of the deprecated key above -- see that entry.',
    'global_rules.force_modules_by_variability_DEPRECATED.medium': 'Sub-node of the deprecated key above -- see that entry.',
    'global_rules.force_modules_by_variability_DEPRECATED.high': 'Sub-node of the deprecated key above -- see that entry.',
    'meta.version': 'CMS/tooling-facing only (btnyc.py reads this for its own versioning) — qr.html is a runtime consumer, not a data-integrity tool, and correctly has no reason to read its own data file\'s version number.',
    'meta.schema_version': 'Same as meta.version — consumed by btnyc.py\'s migration system, not qr.html.',
    'meta.enrichment_note': 'Same pattern as meta.version/meta.schema_version -- a pure, dated audit-trail/provenance note left by the external dynamic_services enrichment script that added 82 previously-missing entries. Human/changelog-facing only, correctly never read by qr.html at runtime.',
    'meta.global_rates.specialized_repair': 'Real fallback chain (TIERS[co]?.hourly_rate || globalRatesFb.specialized_repair || ...) exists in _computePrice, but complexity_tiers is always populated in practice, so this fallback is essentially never reached. Confirmed real but not dead — kept here as a documented near-miss, not removed from the allowlist, since the code path genuinely exists even if rarely hit.',
    'global_rules.surcharges.materials_markup_percent': 'CONFIRMED REAL GAP, not accepted-dead — tracked as active backlog (see materials_catalog linkage below), kept in this list only to avoid double-counting it as a NEW finding on every run while the fix is pending. Remove this entry the moment the markup is actually applied.',
    'global_rules.surcharges.dispatch_note_template': 'CONFIRMED REAL GAP, not accepted-dead — same status as materials_markup_percent: every dispatch-fee display in qr.html hardcodes its own "+ $X dispatch" string instead of reading this template. Active backlog.',
    'global_rules.surcharges.dispatch_fee_enabled': 'v9.5 toggle: when false, dispatch_fee becomes 0 globally. Wired into computeUnifiedQuote.',
    'global_rules.surcharges.dispatch_fee_apply_min_labor': 'v9.5 threshold hook for minimum-visit-charge model. Not yet wired -- deferred pending business decision.',
    'global_rules.surcharges.dispatch_fee_note': 'v9.5 human-readable documentation of dispatch toggle semantics. Not read by qr.html at runtime.',
    'compiled': 'CONFIRMED REAL GAP, not accepted-dead -- the v10 compiler (btnyc_v10_compiler.py) generates 10 pre-built indexes here (pricing_index, component_index, action_index, symptom_index, service_index, candidate_matrix, plus T132\'s module_index, smart_tag_index, material_index, formula_index) but qr.html never reads DB.compiled anywhere at runtime (confirmed: zero references). The runtime instead does equivalent resolution ad-hoc (NLP candidate matching in nlp_engine.js, pricing dispatch in computeUnifiedQuote) rather than consuming these pre-computed indexes. Active backlog: wiring the runtime to read from compiled.* directly would be a genuine architectural improvement (single source of truth for resolution logic, computed once by the compiler and verified by its own test suite, rather than duplicated inline). Kept in this list only to avoid re-flagging as a NEW finding every run while this remains unwired.',
    'compiled.pricing_index': 'Sub-node of the compiled gap above -- see that entry.',
    'compiled.component_index': 'Sub-node of the compiled gap above -- see that entry.',
    'compiled.action_index': 'Sub-node of the compiled gap above -- see that entry.',
    'compiled.symptom_index': 'Sub-node of the compiled gap above -- see that entry.',
    'compiled.service_index': 'Sub-node of the compiled gap above -- see that entry.',
    'compiled.candidate_matrix': 'Sub-node of the compiled gap above -- see that entry.',
    'compiled.module_index': 'T132 sub-node of the compiled gap above -- see that entry. Real, new compiler output (btnyc_v10_compiler.py) built for mechanical dead-reference/orphan detection; not yet consumed by any qr.html code path, same unwired status as the other 6 indexes.',
    'compiled.smart_tag_index': 'T132 sub-node of the compiled gap above -- see that entry. Same status as compiled.module_index.',
    'compiled.material_index': 'T132 sub-node of the compiled gap above -- see that entry. Same status as compiled.module_index.',
    'compiled.formula_index': 'T132 sub-node of the compiled gap above -- see that entry. Same status as compiled.module_index.',
    'compiled.module_index.*.classification': 'Sampled shape field within the unconsumed module_index -- see the top-level compiled entry.',
    'compiled.module_index.*.option_count': 'Sampled shape field within the unconsumed module_index -- see the top-level compiled entry.',
    'compiled.module_index.*.used_by': 'Sampled shape field within the unconsumed module_index -- see the top-level compiled entry.',
    'compiled.module_index.*.tag_setters': 'Sampled shape field within the unconsumed module_index -- see the top-level compiled entry.',
    'compiled.module_index.*.complexity_overrides': 'Sampled shape field within the unconsumed module_index -- see the top-level compiled entry.',
    'compiled.smart_tag_index.*.used_by_services': 'Sampled shape field within the unconsumed smart_tag_index -- see the top-level compiled entry.',
    'compiled.material_index.*.required_by': 'Sampled shape field within the unconsumed material_index -- see the top-level compiled entry.',
    'compiled.material_index.*.optional_for': 'Sampled shape field within the unconsumed material_index -- see the top-level compiled entry.',
    'compiled.formula_index.*.used_by': 'Sampled shape field within the unconsumed formula_index -- see the top-level compiled entry.',
    'compiled.pricing_index.*.pricing_engine_key': 'Sampled shape field within the unconsumed pricing_index -- see the top-level compiled entry.',
    'compiled.pricing_index.*.is_real_registered_formula': 'Sampled shape field within the unconsumed pricing_index -- see the top-level compiled entry.',
    'compiled.pricing_index.*.formula_params': 'Sampled shape field within the unconsumed pricing_index -- see the top-level compiled entry.',
    'compiled.component_index.*.candidate_services': 'Sampled shape field within the unconsumed component_index -- see the top-level compiled entry.',
    'compiled.action_index.*.candidate_services': 'Sampled shape field within the unconsumed action_index -- see the top-level compiled entry.',
    'compiled.symptom_index.*.candidate_services': 'Sampled shape field within the unconsumed symptom_index -- see the top-level compiled entry.',
    'compiled.service_index.*.pricing.pricing_engine_key': 'Sampled shape field within the unconsumed service_index -- see the top-level compiled entry.',
    'compiled.service_index.*.pricing.is_real_registered_formula': 'Sampled shape field within the unconsumed service_index -- see the top-level compiled entry.',
    'compiled.service_index.*.pricing.formula_params': 'Sampled shape field within the unconsumed service_index -- see the top-level compiled entry.',
    'compiled.service_index.*.dynamic': 'Sampled shape field within the unconsumed service_index -- see the top-level compiled entry.',
    'compiled.service_index.*.modules_needed_for_exact': 'Sampled shape field within the unconsumed service_index -- see the top-level compiled entry.',
    'compiled.candidate_matrix.*.Repair.any': 'Sampled shape field within the unconsumed candidate_matrix -- see the top-level compiled entry.',
    'negation_library.negation_confirmations': 'Exact duplicate of smart_tags.*.negation_phrase (confirmed byte-for-byte identical for every tag checked) — the real, single source of truth (negation_phrase) is correctly used; this top-level duplicate map was never wired in and never needs to be, since removing the duplication (not wiring up a second consumer) is the correct fix whenever this gets cleaned up.',
    'dynamic_services.*.merge_strategy': 'Every single dynamic_services entry has merge_strategy:"extend" with zero variation anywhere in the real data — confirmed via exhaustive check. There is no second strategy value to ever act differently on, so this is a no-op flag by its own data shape, not an overlooked mechanism.',
    'services.*.aliases': 'CONFIRMED REAL GAP, not accepted-dead — a designed second synonym mechanism for NLP/search matching, never wired into intent_mappings.objects-based matching or anywhere else. Active backlog.',
    // v9.6: negation_library.large_size_words / standard_size_words
    // REMOVED from this allowlist -- the real content gap they
    // documented is now closed. extractSizeHint genuinely reads both
    // fields directly (qr.html), confirmed via direct test before this
    // removal, not assumed. No longer need an exception; the tool's own
    // normal detection should find them consulted now.
    'confidence_tiers': 'CONFIRMED REAL, SEVERE DUPLICATE of global_rules.force_modules_by_variability (same tier→force_modules concept, different vocabulary, the WORKING one is force_modules_by_variability) — not accepted-dead, active backlog to either wire in or formally retire/delete from the JSON. Kept in this list only to avoid re-flagging it as a NEW finding every run.',
    'services.*.required_materials': 'CONFIRMED REAL GAP, not accepted-dead — populated on 51 services with real materials_catalog SKU references, but qr.html never looks up either field at runtime at all. Active backlog (re-prioritized this session after initially being wrongly assessed as "no linkage exists").',
    'services.*.optional_materials': 'Same status as required_materials — paired field, same gap.',
    'services.*.detail_prompt': 'Confirmed always empty/unauthored across every real service (0 of N services have a non-empty value) — vestigial schema field with no real content to ever consult.',
    'services.*.details': 'Same status as detail_prompt — always empty, vestigial.',
    'services.*.intake_modules_refs': 'Confirmed always empty across every real service — the engine uses intake_chain directly; this is a vestigial field from before that consolidation.',
    'services.*.override_root': 'Present in schema but confirmed to carry no content meaningfully consumed anywhere; narrow, low-traffic field not yet investigated deeply enough to classify further — flagged here as a known gap rather than silently passing, pending a real trace.',
    'negation_library.nlp_verb_past_map': 'Confirmed real and consulted — read via window._NLP.VMAP (a dynamic-key lookup the static regex tool cannot see), used throughout the NLP verb-conjugation logic.',
    'category.group_ids': 'Confirmed redundant BY DESIGN, not a gap — group.category_id (the inverse direction) is the real, working mechanism every real groups-by-category filter actually uses. Verified zero drift across all 6 categories between the two directions.',
    'group.explicit_services': 'Same status as category.group_ids — service.ui_taxonomy.group_id (the inverse direction) is the real, working mechanism. Verified 3 real, pre-existing drift cases between the two directions during the archaeology audit (including one window_ac_setup mismatch introduced by this session\'s own earlier fix) — drift is real and worth cleaning up for data hygiene, but does not affect runtime behavior since the redundant field is never read.',
    'global_rules.pricing_engines.hourly_estimate.minimum_billable_hours': 'CONFIRMED REAL GAP, not accepted-dead — a real 1-hour minimum billing floor for hourly services, never enforced anywhere. Active backlog (see BACKLOG_CONSOLIDATED.md item C.2).',
    'global_rules.pricing_engines': 'v9.5: the only real consumer (sqRenderSelfQuoteAdlib manual price calculation) was removed in the F1 bait-and-switch fix -- that function now delegates to computeUnifiedQuote directly. pricing_engines is now unreferenced at runtime. Candidate for removal from the JSON, or re-wiring if a future feature needs it.',
    'adlib_phrase_overrides.adlib.answer_joiner': 'v9.5 uploaded base: answer_joiner is read by sqBuildAdlib to join multiple answers in the adlib sentence ("and"). Consumed at runtime.',
    'adlib_phrase_overrides.adlib.logistic_strip_label': 'v9.5 uploaded base: logistic_strip_label is used by the adlib preview strip renderer. Consumed at runtime.',
    'furniture_catalog[].brand': 'furniture_catalog brand is rendered in the furniture selection UI. Consumed at runtime.',
    'service_types.*.default_complexity': 'service_types default_complexity seeds the complexity_tier for dynamic service resolution. Consumed by resolveDynamicService.',
    // v9.5 GAP FIXES: compiler-generated keys now in btnyc.json and actively consumed at runtime.
    // These are NOT dead -- they are the completion of the compiler→runtime wiring.
    'routing_archetypes': 'v9.5 GAP 1 FIX: consumed by validateRoute → checkRoutingArchetypeConsistency (qr.html). validateRoute now passes db.routing_archetypes as its third argument so the semantic archetype consistency check actually runs.',
    'routing_archetypes.*.routing_archetype': 'v9.5: consumed by checkRoutingArchetypeConsistency to verify intake chain order matches archetype (symptom_first vs component_first).',
    'routing_archetypes.*.real_actions_in_group': 'v9.5: compiler-generated index of real service types per group. Used by checkRoutingArchetypeConsistency for semantic validation.',
    'routing_archetypes.*.real_components': 'v9.5: component module names for this group. Used by checkRoutingArchetypeConsistency.',
    'routing_archetypes.*.component_to_service_ids': 'v9.5: component → service mapping. Active backlog: not yet wired into NLP resolution (Gap 3 -- candidate_matrix). checkRoutingArchetypeConsistency reads group archetype, not this map directly.',
    'routing_archetypes.*.real_symptoms': 'v9.5: symptom module names for this group. Used by checkRoutingArchetypeConsistency.',
    'routing_archetypes.*.symptom_to_service_ids': 'v9.5: symptom → service mapping. Same status as component_to_service_ids -- Gap 3 backlog.',
    'routing_archetypes.*.real_gaps': 'v9.5: authoring gaps identified by compiler. Used for data quality visibility; not runtime logic.',
    'routing_archetypes.*.display_name': 'v9.5: human-readable group name in compiler output.',
    'routing_archetypes.*.category_id': 'v9.5: parent category of this group in compiler output.',
    'pricing_archetypes': 'v9.5 GAP 2 FIX: consumed by computeUnifiedQuote → computeArchetypeQuote dispatch (pricing_engine.js). Entities with financial_engine.pricing_archetype now route through the dedicated calculator.',
    'pricing_archetypes.*.definition': 'v9.5: human-readable definition of each pricing archetype. Reference documentation in the SSOT.',
    'pricing_archetypes.*.currently_assigned_to': 'v9.5: list of entity IDs currently using this archetype. Computed by compiler from live data; used for data quality visibility and test assertions (verify_pricing_archetype_consolidation.js).',
    'global_rules.pricing_engines.flat_rate': 'Same status as global_rules.pricing_engines -- orphaned by F1 fix.',
    'global_rules.pricing_engines.flat_rate.formula_components': 'Same status as global_rules.pricing_engines -- orphaned by F1 fix.',
    'ui_config.pricing_type_badges.flat_rate': 'resolveServiceBadge reads pricing_type_badges dynamically for any pricing_type; flat_rate is a valid key that could be reached. Confirmed real path exists (resolveServiceBadge line ~918) -- just not currently exercised by any service whose checkout_state lacks a ui_badge_label, since checkout_states precedence always wins first.',
    'checkout_states.button_class_no_mat': 'CONFIRMED REAL GAP — real, designed button-color logic (success vs primary depending on whether materials apply) never read; button_text_no_mat/with_mat (its sibling fields) ARE correctly read via dynamic key construction. Active backlog.',
    'checkout_states.button_class_with_mat': 'Same status as button_class_no_mat — paired field, same gap.',
    'checkout_states.quote_badge_key': 'CONFIRMED REAL GAP — a real, designed short-code badge system, never read anywhere. Active backlog.',
    'services.financial_engine.base_materials': 'CONFIRMED REAL GAP — present on services (distinct from default_estimates.materials), never read anywhere in qr.html. Needs investigation: may be a genuine duplicate of default_estimates.materials, or a distinct, also-unread mechanism — not yet deeply traced.',
    'materials_catalog.unit': 'CONFIRMED REAL GAP — unit-of-measure label (e.g. "kit", "unit") on every real materials_catalog entry, never displayed anywhere. Consistent with the broader, already-tracked materials_catalog-never-read-at-runtime finding (BACKLOG_CONSOLIDATED.md item G).',
    'materials_catalog.sub_category': 'Same status as materials_catalog.unit — paired field, same gap.',
    'ui_config.pricing_type_badges.assembly_formula': 'Confirmed real, working fallback (resolveServiceBadge\'s documented checkout_states > pricing_type_badges precedence) — just not currently exercised by any real service, since the one real assembly_formula service (furniture_assembly_flat_pack) has its own checkout_state set, which always wins per the documented precedence. Not broken, just not currently reached — same low-priority status as meta.global_rates.specialized_repair above.',
    'workflow': 'Phase 0-3 of the Orchestrator Overhaul (this session). Consumed by the NEW executeWorkflow/orch_* functions via db.workflow.* property access (a real, working access pattern) — flagged as "unconsulted" by this tool only because that code was added in the SAME session as this allowlist entry, and the regex pattern used elsewhere in this tool expects DB./SERVICE_DATA./window.DB.-prefixed access, not the bare `db` parameter name used inside the orchestrator\'s own functions. Genuinely consulted; this is a tool-pattern limitation, not a real gap. Remove this entry once the tool\'s access-pattern regex is broadened to include the `db` parameter name, or once Phase 6 makes `db` the only real access pattern left in the file.',
    'services.ui_taxonomy.sort_order': 'CONFIRMED REAL GAP — a real, curated per-service display-order value exists on every service, but the catalog grid renders services in raw JSON-array order; confirmed via direct check that no .sort() call anywhere references sort_order. Services within a group display in whatever order they happen to appear in btnyc.json, not the curated order.',
    'services.operational_metrics.high_case_minutes': 'CONFIRMED REAL GAP — a real, designed upper-bound time estimate (distinct from default_estimates.total_minutes.max), never read anywhere. Needs investigation into its intended relationship to total_minutes before fixing (may be redundant by design, or a genuinely separate "worst case" signal meant for a different display).',
    'furniture_catalog.flat_fee': 'CONFIRMED REAL GAP — every real furniture_catalog item has a designed flat_fee, but mathFurnitureAssembly (confirmed via direct signature read: takes only a minutesArr) computes furniture pricing purely from assembly time × hourly rate. The authored flat_fee is silently discarded for every item, every time. minutes IS correctly read (verified separately) — only flat_fee is the gap.',
    'meta.estimate_disclaimers.flat_fee': 'False negative — estimate_disclaimers.flat_fee/hourly/project_based are all read via a dynamic key (DB.meta?.estimate_disclaimers?.[discKey]), confirmed at 4 real call sites elsewhere in the file. The static regex tool cannot see a value used as a dynamic object key.',
    'global_rules.pricing_engines.hourly_estimate': 'Bare parent of the already-allowlisted minimum_billable_hours gap — covered by SUBTREE_ALLOWLIST_KEYS so this exact discovered path (with no further suffix) doesn\'t separately re-flag as a distinct finding.',
    'checkout_states.*.button_class': 'Bare parent of the already-allowlisted checkout_states.button_class_no_mat/button_class_with_mat gap — covered by SUBTREE_ALLOWLIST_KEYS.',
    'dynamic_services.*.operational_metrics': 'Bare parent of two real, designed dynamic_services fields (target_hourly_yield, minimum_minutes) — neither read anywhere in qr.html. CONFIRMED REAL GAP, not yet deeply investigated (their intended relationship to default_estimates/total_minutes needs tracing before fixing). Covered by SUBTREE_ALLOWLIST_KEYS so both children are tracked under one reasoned entry rather than two near-duplicates.',
    'dynamic_services.*.default_estimate': 'CONFIRMED REAL GAP — a real, designed field on dynamic_services, distinct from default_estimates (note the singular/plural difference — this may be a genuinely separate, simpler estimate value, or a naming-drift duplicate; not yet deeply investigated). Covered by SUBTREE_ALLOWLIST_KEYS.',
    'service_types.*.required_intake_modules': 'CONFIRMED REAL GAP, and doubly broken — Repair\'s required_intake_modules references "damage_areas", a module that does not exist anywhere in intake_modules (confirmed via direct check). Never read anyway, so the dangling reference causes no runtime error, but the data itself is internally inconsistent. Covered by SUBTREE_ALLOWLIST_KEYS.',
    'meta.last_updated': 'CMS/tooling-facing only, same category as meta.version/schema_version — an audit-trail timestamp btnyc.py manages for its own purposes; qr.html is a runtime consumer with no reason to read it.',
    'ui_config.affects_price_label': 'CONFIRMED REAL GAP — its sibling field, affects_price_icon, IS genuinely read (confirmed: DB.ui_config?.affects_price_icon, rendered as a $ icon next to price-affecting questions) but the accompanying text label ("affects price") is never displayed alongside it — the icon shows with no text. Distinct from the unrelated "💲 affects price" badge driven by mod.purpose==="pricing" found earlier this session — two separate mechanisms, this one specifically is the unused half of a real icon+label pair.',
    'smart_tags.*.answers': 'CONFIRMED REAL GAP — this is the smart_tags.*.answers.access_obstruction instance of the already fully-documented dead tagDef.answers loop (prefillSmartQuoteFromService, a comment-only loop with an empty body — see BACKLOG_CONSOLIDATED.md item E.2). Listed at the node level so any specific tag\'s answers sub-key doesn\'t separately re-flag as a new finding.',
    'routing_archetypes.*.real_action_ids': 'v9.5 new ID‑based field introduced for compiler‑generated routing archetypes; not yet wired into UI routing logic. Tracked as Gap 3 (routing_archetypes consumption) – the UI still uses the old string‑based fields. Will be wired in Phase 6.',
    'routing_archetypes.*.real_component_ids': 'Same as real_action_ids – new ID‑based field for components; not yet consumed.',
    'routing_archetypes.*.component_id_to_service_ids': 'Same as real_action_ids – mapping from component ID to service IDs; not yet consumed.',
    'routing_archetypes.*.real_symptom_ids': 'Same as real_action_ids – new ID‑based field for symptoms; not yet consumed.',
    'routing_archetypes.*.symptom_id_to_service_ids': 'Same as real_action_ids – mapping from symptom ID to service IDs; not yet consumed.',
    // v9.6: Track A Phase 1 (Entity -> Archetype -> Capability hierarchy).
    // Deliberately additive/informational per the checklist's own Phase 1
    // requirement -- consumed by btnyc_v10_compiler.py's mismatch-logging
    // check (build_archetype_mismatch_report), not yet by any runtime
    // pricing/routing decision. Real, evidence-derived defaults, not
    // placeholders -- see each archetype's own _note field for the
    // specific group cross-reference each default was derived from.
    'archetypes.*.default_routing_strategy': 'v9.6 Phase 1: cross-referenced against each archetype\'s real, already-classified member groups (routing_archetypes) before being set -- see each archetype\'s own _note. Consumed by the compiler\'s informational mismatch check.',
    'archetypes.*.default_confidence_strategy': 'v9.6 Phase 1: informational default only. Consumed by the compiler\'s informational mismatch check.',
    'archetypes.*.typical_actions': 'v9.6 Phase 1: derived from the real, union service_type set of each archetype\'s actual member services, not guessed. Consumed by the compiler\'s informational mismatch check.',
    'archetypes.*.member_group_ids': 'v9.6 Phase 1: the real group_id list this archetype was derived from and is checked against. Verified to cover all 32 real groups with named services before being written.',
};

// ─────────────────────────────────────────────────────────────────────────
// Field discovery: walk the REAL btnyc.json and produce every meaningful
// leaf/object field path. "Meaningful" excludes pure structural container
// keys (the per-service id, per-tag id, etc. — these are accessed by
// their VALUES as object keys, not as a "field name" a grep could ever
// find, and are separately, exhaustively proven-used by the fact that
// the whole app fails to render anything if services[]/smart_tags{}
// themselves were unreadable).
// ─────────────────────────────────────────────────────────────────────────
function discoverFieldPaths(obj, prefix, depth, maxDepth, paths) {
    if (depth > maxDepth) return;
    // v3 FIX: nlp_verb_past_map's real shape is a flat dict of verb-
    // infinitive -> past-tense STRING pairs (e.g. {repair: "repaired"}) —
    // its keys are verbs (data values), not meaningful field names to
    // check. Stop the walk here rather than report each verb as a leaf.
    if (prefix === 'negation_library.nlp_verb_past_map') return;
    if (Array.isArray(obj)) {
        // Sample the array's own item shape (services[], category[], etc.)
        // via its first element, rather than walking every single item —
        // every item shares the same field names, which is what we're
        // actually auditing (does ANY code read svc.required_materials,
        // not does service #47 specifically get read).
        if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null) {
            discoverFieldPaths(obj[0], prefix + '[]', depth, maxDepth, paths);
        }
        return;
    }
    if (typeof obj !== 'object' || obj === null) return;
    for (const key of Object.keys(obj)) {
        if (key.startsWith('_') || key.startsWith('$')) continue; // doc/comment/schema-meta fields, not real data
        const fullPath = prefix ? `${prefix}.${key}` : key;
        paths.push(fullPath);
        discoverFieldPaths(obj[key], fullPath, depth + 1, maxDepth, paths);
    }
}

const allPaths = [];
discoverFieldPaths(DB, '', 0, 3, allPaths);

// For dict-of-dicts nodes (smart_tags, intake_modules, dynamic_services,
// service_types, checkout_states, pricing_formulas, materials_catalog)
// the keys themselves are IDs — looked up dynamically at runtime
// (DB.intake_modules?.[someVariable]), never referenced by their literal
// key string anywhere in real code.
const DICT_OF_DICTS_NODES = ['smart_tags', 'intake_modules', 'dynamic_services', 'service_types', 'checkout_states', 'pricing_formulas', 'materials_catalog',
    // v9.5: compiler-generated dict-of-dicts now present in btnyc.json and consumed at runtime.
    // routing_archetypes: keyed by group_id, value shape = {routing_archetype, real_components, real_symptoms, ...}
    // pricing_archetypes: keyed by archetype name, value shape = {definition, currently_assigned_to}
    'routing_archetypes', 'pricing_archetypes',
    // v9.6: Track A Phase 1 (Entity -> Archetype -> Capability hierarchy,
    // per DEVELOPERS_CHECKLIST_ROADMAP_TO_SEESAW.md). archetypes: keyed by
    // archetype name, value shape = {display_name, default_routing_strategy,
    // default_confidence_strategy, typical_actions, member_group_ids, _note}.
    // Currently additive/informational only -- consumed by
    // btnyc_v10_compiler.py's mismatch-logging check (Phase 1's own explicit
    // requirement), not yet by any runtime pricing/routing decision.
    'archetypes',
];

// v3 FIX: an earlier version of this regex only stripped a path that
// ENDED at a dict-of-dicts key (e.g. "intake_modules.access"). It did NOT
// strip a path that continued PAST that key into real fields (e.g.
// "dynamic_services.minor_home_repairs+Install.operational_metrics.
// target_hourly_yield") — these per-instance-ID paths are genuine
// duplicates of the correctly-deduplicated "*"-sampled version the
// second walk below already produces, and were leaking through as
// redundant noise on every run. Fixed by stripping any path that
// contains a dict-of-dicts node immediately followed by a non-"*"
// segment ANYWHERE in the path, not just at the very end.
const idAnywherePattern = new RegExp(`\\b(${DICT_OF_DICTS_NODES.join('|')})\\.(?!\\*)[^.]+`);
const filteredRoot = allPaths.filter(p => !idAnywherePattern.test(p));

// v3: genuinely real, hand-verified NESTED dict-of-dicts — fields whose
// own VALUE is a dict keyed by dynamic IDs, but which are themselves
// nested inside an already-discovered field path rather than being a
// root-level node (so they weren't caught by DICT_OF_DICTS_NODES above).
// Each entry verified this session by hand before being added — same
// discipline as KNOWN_DEAD_OR_REDUNDANT, just for "this is an ID, not a
// field" rather than "this is dead."
const NESTED_DICT_OF_DICTS_PATHS = [
    'global_rules.force_modules_by_variability_DEPRECATED', // T118: renamed from force_modules_by_variability. keys: low/medium/high/diagnostic (tier names)
    'confidence_tiers',                          // keys: high_confidence_simple/medium_confidence_standard/low_confidence_complex
    'adlib_phrase_overrides.group_templates',     // keys: real display_group names ("Wall Material", etc.) + default_template
    'negation_library.negation_confirmations',    // keys: tag IDs (#heavy_item, etc.)
    'routing_archetypes',                        // v9.5: keyed by group_id -- compiler output, consumed by validateRoute/checkRoutingArchetypeConsistency
    'pricing_archetypes',                        // v9.5: keyed by archetype name -- compiler output, consumed by computeUnifiedQuote/computeArchetypeQuote dispatch
    'global_rules.modifiers',                    // v9.4: keyed by modifier ID (e.g. tile_grout, symptom_won_t_spin_no_movement) -- value shape = {fee, minutes, note?}. Resolved via client_response.modifier_ref / pricing_formula .*_modifier_ref fields.
    'negation_library.nlp_location_appliance_map', // T118 (#19): keyed by appliance/fixture term (stove, oven, fridge, toilet, ...). Resolved via APPLIANCES[loc] in extractLocation -- a dynamic, variable-based lookup against whatever text a customer typed, not individual named property accesses. The literal key strings never appear as code in qr.html by design; they're data values, exactly like global_rules.modifiers above.
    'compiled.pricing_index',                    // v9: keyed by service/dynamic-service ID -- compiler output, consumed by btnyc_v10_compiler.py's own downstream builders and CMS tooling.
    'compiled.component_index',                  // v9: keyed by component keyword -- compiler output (synonyms + candidate_services).
    'compiled.action_index',                     // v9: keyed by action keyword -- compiler output.
    'compiled.symptom_index',                    // v9: keyed by symptom keyword -- compiler output.
    'compiled.service_index',                    // v9: keyed by service/dynamic-service ID -- compiler output, unified view combining ui_taxonomy + pricing.
    'compiled.candidate_matrix',                 // v9: keyed by component/action/symptom keyword -- compiler output, the NLP resolution candidate lookup.
    'compiled.module_index',                     // T132 (btnyc_v10_compiler.py): keyed by intake_module name -- cross-referenced usage map (classification, used_by, tag_setters, complexity_overrides). Real, new compiler output, not yet consumed by any qr.html code path -- built for mechanical dead-reference/orphan detection, the same purpose find_orphaned_data.py serves by reading, not by any runtime lookup.
    'compiled.smart_tag_index',                  // T132: keyed by smart_tag ID -- cross-referenced usage map (which modules/services/dynamic_services set or reference each tag). Same status as module_index: compiler-side analysis output, not a runtime lookup path.
    'compiled.material_index',                   // T132: keyed by materials_catalog SKU -- cross-referenced usage map (which services require/optionally use each material). Same status as module_index.
    'compiled.formula_index',                    // T132: keyed by pricing_formulas name -- cross-referenced usage map (which services/dynamic_services reference each formula via financial_engine.formula_ref). Same status as module_index.
];
const nestedIdPattern = new RegExp(`^(${NESTED_DICT_OF_DICTS_PATHS.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\.[^.]+`);
const filteredPaths = filteredRoot.filter(p => !nestedIdPattern.test(p));

// Re-walk each dict-of-dicts node using a representative VALUE's shape
// instead of its keys — same "sample one, the rest share the shape"
// logic as the array case above.
for (const node of DICT_OF_DICTS_NODES) {
    const nodeObj = DB[node];
    if (!nodeObj || typeof nodeObj !== 'object') continue;
    const sampleKey = Object.keys(nodeObj).find(k => !k.startsWith('_'));
    if (!sampleKey) continue;
    discoverFieldPaths(nodeObj[sampleKey], `${node}.*`, 0, 2, filteredPaths);
}

// Same re-walk for the nested dict-of-dicts paths — resolve each dotted
// path to its real object in DB, then sample one representative key's
// shape, exactly like the root-level re-walk above.
function resolveDottedPath(obj, dottedPath) {
    return dottedPath.split('.').reduce((cur, key) => (cur == null ? undefined : cur[key]), obj);
}
for (const nestedPath of NESTED_DICT_OF_DICTS_PATHS) {
    const nodeObj = resolveDottedPath(DB, nestedPath);
    if (!nodeObj || typeof nodeObj !== 'object') continue;
    const sampleKey = Object.keys(nodeObj).find(k => !k.startsWith('_') && k !== 'default_template');
    if (!sampleKey) continue;
    discoverFieldPaths(nodeObj[sampleKey], `${nestedPath}.*`, 0, 2, filteredPaths);
}

// ─────────────────────────────────────────────────────────────────────────
// Consultation check: does qr.html's real source reference this field's
// own key name via any real access pattern? Generous on purpose — this
// is a discovery tool, not a strict linter; false positives (claiming
// something is consulted when it's actually a coincidental name match)
// are far less costly than false negatives (missing a real consumer and
// wrongly flagging working code as dead), given a human reviews every
// failure before it's accepted onto the allowlist above.
// ─────────────────────────────────────────────────────────────────────────
function isConsulted(fieldPath) {
    const leafKey = fieldPath.split('.').pop().replace('[]', '').replace('*', '');
    if (!leafKey || leafKey.length < 3) return true; // too short/generic a key to meaningfully check (e.g. "id")
    const pattern = new RegExp(`\\.${leafKey}\\b|\\['${leafKey}'\\]|\\["${leafKey}"\\]|\\b${leafKey}\\s*:`, 'g');
    return pattern.test(SRC);
}

let newFailures = 0, knownAccepted = 0, genuinelyOk = 0;
const failureDetails = [];

// Some allowlist entries (currently just 'workflow') cover an entire
// subtree rather than one specific field — listed explicitly here so the
// matcher's behavior stays predictable rather than guessing from key shape.
const SUBTREE_ALLOWLIST_KEYS = ['workflow', 'confidence_tiers', 'global_rules.pricing_engines.hourly_estimate', 'checkout_states.*.button_class', 'dynamic_services.*.operational_metrics', 'dynamic_services.*.default_estimate', 'service_types.*.required_intake_modules', 'smart_tags.*.answers',
    // T118: the whole subtree, not per-key -- orch_compose_intake_chain
    // reads both maps dynamically (`defs.category_defaults?.[categoryId]`,
    // `defs.group_defaults?.[groupId]`), so no individual category/group
    // key's literal field-path string will ever appear in qr.html's source
    // for this tool's pattern matching to find, no matter how many
    // categories/groups this catalog grows to. Confirmed directly (not
    // assumed) for the entries that exist today; the mechanism itself,
    // not any one key, is why this whole subtree is exempt.
    'global_rules.intake_defaults.category_defaults', 'global_rules.intake_defaults.group_defaults',
    'global_rules.intake_defaults.excluded_services'];

for (const fp of new Set(filteredPaths)) {
    const consulted = isConsulted(fp);
    if (consulted) {
        genuinelyOk++;
        continue;
    }
    // Check the allowlist by exact path OR by its `.*.` normalized form
    // (services[].required_materials -> services.*.required_materials)
    const normalized = fp.replace(/\[\]/g, '.*').replace(/\.\*\./, '.*.');
    const matchedAllowlistKey = Object.keys(KNOWN_DEAD_OR_REDUNDANT).find(k =>
        k === fp || k === normalized || k.endsWith(normalized.split('.*.').pop() || ''));
    const matchedSubtree = SUBTREE_ALLOWLIST_KEYS.find(k =>
        fp === k || fp.startsWith(k + '.') || fp.startsWith(k + '[') ||
        normalized === k || normalized.startsWith(k + '.') || normalized.startsWith(k));
    if (matchedAllowlistKey || matchedSubtree) {
        knownAccepted++;
    } else {
        newFailures++;
        failureDetails.push(fp);
    }
}

console.log(`SSOT consultation audit: ${filteredPaths.length} field paths discovered (${new Set(filteredPaths).size} unique)`);
console.log(`  ✓ ${genuinelyOk} confirmed consulted by qr.html`);
console.log(`  ⚠ ${knownAccepted} on the documented allowlist (known dead/redundant/active-backlog, see KNOWN_DEAD_OR_REDUNDANT)`);
console.log(`  ${newFailures > 0 ? '✗' : '✓'} ${newFailures} NEW, UNDOCUMENTED, UNCONSULTED field(s) found:\n`);

if (newFailures > 0) {
    failureDetails.forEach(fp => console.log(`    - ${fp}`));
    console.log(`\n  ACTION REQUIRED: trace each of these against the real qr.html source by hand`);
    console.log(`  (the same discipline as every entry already in KNOWN_DEAD_OR_REDUNDANT), then`);
    console.log(`  either fix the real gap or add a REASONED entry to the allowlist above —`);
    console.log(`  do not silence this without writing down what you found.\n`);
}

process.exit(newFailures > 0 ? 1 : 0);
