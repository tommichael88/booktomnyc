
     /**
      * orchestrator_engine.js
      *
      * PHASE 1 — Orchestrator module (Logic/UI/Glue split, third module,
      * alongside pricing_engine.js and nlp_engine.js).
      *
      * This module contains executeWorkflow and every real orch_* function,
      * plus the BookingContext collectors and RouteValidator/invariant
      * machinery — the complete, real "Boss" pipeline:
      * resolve entity -> enrich -> compute variability -> compose intake
      * chain -> apply location hints -> compute confidence -> select UI
      * template -> compute quote -> validate -> (fallback if invalid).
      *
      * Extracted directly from the live qr.html using the same, proven
      * brace-counting method already trusted for pricing_engine.js and
      * nlp_engine.js. Built specifically to support a new, separate, real
      * "dumb UI" prototype that consumes ONLY this module's real,
      * structured ResolvedRoute output -- never qr.html's own legacy
      * rendering functions -- so that what the orchestrator can and cannot
      * yet produce becomes directly, observably testable, rather than
      * inferred from static code reading.
      *
      * Re-extract whenever check_module_parity.js flags drift (the same
      * real, proven drift-detection mechanism already wired for the other
      * two modules) -- see verify_orchestrator_engine_module.js.
      */

     const ORCH_QTY_MODS = (typeof _GENERIC_QTY_MODULE_KEYS !== 'undefined') ? _GENERIC_QTY_MODULE_KEYS : new Set(['item_count', 'count', 'hybrid_qty', 'global_quantity']);
     const KNOWN_UI_TEMPLATES = new Set(['self_quote', 'curated_card', 'chip_grid', 'legacy_flow', 'tag_affirmation']);


     function executeWorkflow(context, db) {
         const workflow = db.workflow;
         if (!workflow || !Array.isArray(workflow.steps)) {
             throw new Error('OrchestratorError: db.workflow.steps is missing or not an array.');
         }
         const trace = [];
         // T108 FIX (Operator Brief, Session 1 / Charter §5A.5, §11 item 1):
         // executeWorkflow previously hardcoded answers = {} and never read
         // context.answers, so every chip click on the orchestrator's curated
         // card (renderCuratedCardFromRoute, via free-text/other-tile entries)
         // was silently discarded on the next workflow pass -- handleIntakeAnswer
         // writes to ctx.answers and re-dispatches executeWorkflow(ctx, DB), but
         // the re-run always started from empty. Seeding from context.answers
         // here (defensively defaulting to {} when absent, e.g. for the legacy
         // catalog collector, which intentionally does not set this field yet --
         // see PENDING_DECISIONS.md #33) makes the read side finally honor the
         // write side of the documented BookingContext contract.
         let resolution = null,
             flags = null,
             intakeChain = [],
             answers = Object.assign({}, context.answers || {}),
             confidenceState = null,
             uiTemplate = null,
             materialsEstimate = null,
             quote = null;
         // The tags in force for this request: detected + manually toggled, the SSOT's `requires` relations applied (closeTagsOverRequires --
         // the same single definition the state path uses), the customer's explicit negations winning.
         const activeTagIds = closeTagsOverRequires(
             [...(context.detectedTagIds || []), ...(context.manuallyToggledTagIds || [])],
             context.negatedTagIds, db);
         // Tag-to-answer synthesis (operator brief section 2.8): the tags the customer chose or the NLP detected answer the questions their authored `answers`
         // name, so the customer is not asked them and those answers' own modifiers price -- the SAME pure function the state path uses, so a tag is worth the
         // same on every entry path (R-CLIENT-CONVERGE). Inherent (service-default) tags are not applied here yet: PENDING_DECISIONS #93.
         answers = synthesizeAnswersFromTags(activeTagIds, answers, {}, db).answers;

         for (const step of workflow.steps) {
             let outputSummary;
             switch (step.operation) {
                 case 'lookup':
                     resolution = orch_resolve_entity(context, db);
                     outputSummary = {
                         entityType: resolution.entityType,
                         entityId: resolution.entity?.id || null
                     };
                     break;
                 case 'modify':
                     if (step.id === 'compute_variability_flags') {
                         flags = orch_compute_variability_flags(context, resolution, db);
                         // v9.6 FIX (T64): real signal for the tag-affirmation gate,
                         // mirroring sqAnalyze's own, real trigger condition
                         // (newDetTags.length > 0 && !S._tagsAffirmed) exactly --
                         // context.detectedTagIds is specifically the NLP-detected
                         // set (not manuallyToggledTagIds, which the customer
                         // already explicitly chose and needs no confirmation for).
                         // context.tagsAffirmed is a new, optional field a caller
                         // sets after the customer confirms -- absent/false by
                         // default, matching S._tagsAffirmed's own default.
                         flags.has_unaffirmed_detected_tags =
                             (context.detectedTagIds || []).length > 0 && !context.tagsAffirmed;
                         // v9.6 FIX (T64 follow-up): the negation-pivot gate,
                         // mirroring sqAnalyze's own real trigger condition
                         // (ctx._negationOverride && !S._negationPivotAccepted)
                         // exactly. context._negationOverride is already computed
                         // by collectBookingContext_freeText itself (real,
                         // orchestrator-native detection) -- only the routing
                         // consequence was missing until now, the same shape of
                         // gap has_unaffirmed_detected_tags closed for the plain
                         // affirmation case.
                         flags.has_unconfirmed_negation_pivot = !!context._negationOverride && !context.negationPivotAccepted;
                         outputSummary = flags;
                     } else if (step.id === 'apply_location_hints') {
                         answers = orch_apply_location_hints(context, intakeChain, answers);
                         outputSummary = {
                             answersKeyCount: Object.keys(answers).length
                         };
                     }
                     break;
                 case 'compose':
                     intakeChain = orch_compose_intake_chain(context, resolution, db);
                     outputSummary = {
                         moduleCount: intakeChain.length
                     };
                     break;
                 case 'merge':
                     if (step.id === 'compute_confidence') {
                         confidenceState = orch_compute_confidence(resolution, activeTagIds, context.nlpIntent?._matchConfidence, db, context.entry);
                         outputSummary = confidenceState;
                     } else if (step.id === 'merge_materials_estimate') {
                         materialsEstimate = orch_merge_materials_estimate(resolution, db, context.extractedQty);
                         outputSummary = materialsEstimate;
                     }
                     break;
                 case 'condition_map':
                     uiTemplate = orch_select_ui_template(flags, resolution, confidenceState, db);
                     outputSummary = uiTemplate;
                     break;
                 case 'calculate':
                     quote = orch_compute_quote(resolution, context, answers, activeTagIds, db);
                     outputSummary = quote ? {
                         laborEstimate: quote.laborEstimate,
                         dispatchFee: quote.dispatchFee
                     } : null;
                     break;
                 default:
                     throw new Error(`OrchestratorError: Step [${step.id}] — unknown operation [${step.operation}].`);
             }
             trace.push({
                 step_id: step.id,
                 operation: step.operation,
                 output_summary: outputSummary
             });
         }

         // intake_bypass_rules is a separate, standalone rule set (not
         // one of workflow.steps' 8 sequential entries) — only
         // meaningful for entry='other_tile', where
         // context.uncoveredServiceTypes carries the real data this
         // rule set needs. Called directly here, after the main step
         // loop, with its own trace entry for Phase 7 consistency.
         const intakeBypass = orch_apply_intake_bypass_rules(context, db);
         trace.push({
             step_id: 'intake_bypass_rules',
             operation: 'condition_map',
             output_summary: intakeBypass
         });

         // The ceiling is one resolution with its source on the record (T147, #47); the route carries the value for renderers and the record for anyone asking where it came from.
    const _followupCeiling = orch_max_followup_questions(resolution?.entity, resolution?.entityType);
    const builtRoute = {
             entityType: resolution?.entityType || 'fallback',
             entity: resolution?.entity || null,
             intakeChain,
             answers,
             flags,
             confidence: confidenceState,
             maxFollowupQuestions: _followupCeiling.value,
             followupCeiling: _followupCeiling,
             quantity: resolveQuantityUnits({ entity: resolution?.entity, entityType: resolution?.entityType === 'dynamic' ? 'dynamic' : 'service', requestedQty: context.extractedQty || 1 }),
             basePrice: resolution?.entity?.financial_engine?.base_price, // T148: Glue seeds S.intent.base from this (undefined when the entity has none); it no longer reaches into the pricing SSOT itself
             uiTemplate: uiTemplate?.ui_template || 'curated_card',
             bypassIntake: !!uiTemplate?.bypass_intake,
             skipTypeSelection: !!intakeBypass.skip_type_selection,
             preseededAction: intakeBypass.preseededAction || null,
             materialsEstimate,
             quote,
             // v9.5: expose activeTagIds on the route so downstream
             // renderers (renderCuratedCardFromRoute, renderSelfQuoteFromRoute)
             // can pass the same tags to computeUnifiedQuote for live
             // recompute. Without this, route.activeTags was always undefined
             // and recompute calls got [] -- tags had no effect on pricing
             // in any path that went through the UI renderer.
             activeTags: activeTagIds,
             // T145: the route carries the context that produced it (a copy -- its answers are an own object), so ANY entry path can answer a question
             // on it: orch_apply_answer is route in, route out, and nothing has to hold "the current context" in a window global.
             context: Object.assign({}, context, { answers: Object.assign({}, context.answers || {}) }),
             // T64: the raw, NLP-detected set specifically (not merged with
             // manuallyToggledTagIds like activeTags is) -- renderTagAffirmationFromRoute
             // needs exactly this set, matching sqAnalyze's own real use of
             // S.detTagIds for the same purpose.
             detectedTagIds: context.detectedTagIds || [],
             // T64 follow-up: real port of sqAnalyze's S._pendingPivotInfo --
             // {from, to, negatedTagIds} or null, computed by
             // collectBookingContext_freeText itself.
             negationOverride: context._negationOverride || null,
             // T66 follow-up: real port of the legacy affirmation-card renderer's
             // sibling-service recommendation logic -- needs these
             // specific NLP-intent fields, not exposed on route before now.
             recommendedSku: context.nlpIntent?.recommendedSku || null,
             matchConfidence: context.nlpIntent?._matchConfidence || 0,
             intentCategory: context.nlpIntent?.category || null,
             intentGroupId: context.nlpIntent?._groupId || null,
             enrichment: resolution?.enrichment || null,
             trace,
         };

         // The Veto (Master Blueprint Phase 4): never hand a broken route
         // to whatever consumes it next. Validate, and if genuinely
         // broken, replace with the safe catastrophic fallback —
         // logging WHY, so this is visible in trace/diff logs rather
         // than silently swapped.
         // v9.5 GAP 1 FIX: pass routing_archetypes so the semantic
         // check inside validateRoute actually runs. The compiled
         // artifact (btnyc_v8_compiled.json) carries this; if only
         // the SSOT is loaded, the check silently skips -- that is
         // the correct, safe fallback per the original design.
         const validation = validateRoute(builtRoute, db, db.routing_archetypes || null);
         if (!validation.valid) {
             trace.push({
                 step_id: 'route_validator_veto',
                 operation: 'condition_map',
                 output_summary: {
                     violations: validation.violations
                 }
             });
             return catastrophicFallbackRoute(builtRoute, validation.violations);
         }
         return builtRoute;
     }

     function orch_resolve_entity(context, db) {
         // Run object_based re-resolution FIRST, exactly matching the
         // legacy code's real ordering -- it can change which
         // category/SKU the rest of resolution targets.
         const resolvedIntent = orch_apply_object_based_resolution(context, db);
         const effectiveContext = (resolvedIntent !== context.nlpIntent) ?
             Object.assign({}, context, {
                 nlpIntent: resolvedIntent,
                 selectedCategoryId: resolvedIntent.default_dynamic_category || context.selectedCategoryId,
                 selectedServiceId: resolvedIntent.default_service_sku || context.selectedServiceId,
             }) :
             context;
         // v9.5.12 FIX: orch_apply_object_based_resolution's
         // _matchConfidence boost (v9.5.11) landed on
         // resolvedIntent -- a local copy used to build
         // effectiveContext above, itself also local to this
         // function. executeWorkflow's confidence step
         // (step.id === 'compute_confidence') reads
         // context.nlpIntent._matchConfidence directly from the
         // OUTER context object passed into this function, which
         // never saw either local copy -- confirmed directly by
         // tracing the real call, not assumed: a genuine trigger
         // phrase for this resolver produced no change at all in
         // the final confidence score before this fix. Bridge
         // just the one field the confidence step actually
         // needs back onto the real, outer, shared object,
         // without changing orch_apply_object_based_resolution's
         // own "return a new object, don't mutate the input"
         // contract -- this is the one, minimal mutation needed
         // to make the boost actually reach where it's read.
         if (resolvedIntent !== context.nlpIntent && context.nlpIntent &&
             resolvedIntent._matchConfidence > (context.nlpIntent._matchConfidence || 0)) {
             context.nlpIntent._matchConfidence = resolvedIntent._matchConfidence;
         }

         if (effectiveContext.selectedServiceId) {
             const svc = (db.services || []).find(s => s.id === effectiveContext.selectedServiceId);
             if (svc) {
                 // v9.6 FIX (T69): a real, confirmed gap found via a
                 // comprehensive equivalence sweep against sqAnalyze's
                 // real behavior. sqAnalyze structurally cannot
                 // auto-select a named service without a real
                 // recommendedSku FROM THE PRIMARY, keyword-based
                 // intent_mappings match -- a genuine safety net.
                 // This path CAN set effectiveContext.selectedServiceId
                 // purely from orch_apply_object_based_resolution's own
                 // object-keyword map (objectMap.default_service_sku),
                 // a real but structurally weaker signal (a single
                 // word like "handle" or "under-cabinet", ambiguous
                 // across multiple real groups) that was being
                 // committed to with the exact same confidence as a
                 // real keyword match. Confirmed via direct trace on
                 // both real failing cases: the object-override's own
                 // chosen service belonged to a genuinely different
                 // group than the one already, independently,
                 // confidently resolved from the query as a whole
                 // (cabinet_knob_or_pull_install's own group vs. the
                 // correctly-resolved minor_home_repairs_doors, for
                 // "Door Lock or Handle Install"; similarly for
                 // "Under-Cabinet Light Install"). That mismatch is
                 // real, direct evidence the object-keyword override
                 // is a false, coincidental partial match, not a
                 // confident, specific resolution -- exactly the kind
                 // of "equivalent direct evidence" sqAnalyze's own
                 // recommendedSku requirement provides. Only blocks
                 // when there IS a real, independently-resolved group
                 // to contradict against -- if the primary resolution
                 // found no group of its own, the object-based
                 // override remains the best available signal and is
                 // still trusted, unchanged from before.
                 const cameFromObjectOverride = effectiveContext.selectedServiceId !== context.selectedServiceId;
                 const conflictsWithIndependentGroup = cameFromObjectOverride &&
                     context.selectedGroupId &&
                     svc.ui_taxonomy?.group_id &&
                     svc.ui_taxonomy.group_id !== context.selectedGroupId;
                 if (!conflictsWithIndependentGroup) {
                     return {
                         entityType: 'service',
                         entity: svc,
                         enrichment: orch_enrich_from_dynamic_service(svc, resolveDynamicService(svc.ui_taxonomy?.category_id, (window._normServiceType ? window._normServiceType(svc.service_type) : (svc.service_type || 'Repair').replace('Install / Mount', 'Install').replace('Install/Mount', 'Install')), svc.ui_taxonomy?.group_id))
                     };
                 }
                 // Falls through to group-based resolution below,
                 // using context.selectedGroupId -- the independently-
                 // resolved, non-conflicting group -- instead.
             }
         }
         if (effectiveContext.selectedGroupId) {
             const group = (db.group || []).find(g => g.id === effectiveContext.selectedGroupId);
             const dynDef = resolveDynamicService(effectiveContext.selectedCategoryId, effectiveContext.nlpIntent?.stype || 'Repair', effectiveContext.selectedGroupId);

             // v9.5 GAP 3 FIX: use routing_archetypes to resolve a specific
             // named service from group-level context. Previously, a phrase
             // like "door lock is broken" resolved the group correctly
             // (minor_home_repairs_doors) but then fell through to the generic
             // dynamic service -- ignoring the group's own component/symptom
             // map that clearly points to door_lock_or_handle_install.
             // This is the core purpose of routing_archetypes: group-level
             // resolution that goes beyond category-only dynamic fallback.
             const ra = db.routing_archetypes?.[effectiveContext.selectedGroupId];
             if (ra && !effectiveContext.selectedServiceId) {
                 const rawText = (effectiveContext.rawText || '').toLowerCase();
                 const extractedObj = (effectiveContext.resolutionObject ?? effectiveContext.extractedObject ?? '').toLowerCase();

                 // Try component_id_to_service_ids first (for component-first groups)
                 // then symptom_id_to_service_ids (for symptom-first groups)
                 let candidateSvcId = null;
                 // v9.6 FIX: real, significant, pre-existing bug found while
                 // investigating an unrelated NLP issue -- this read
                 // ra.component_to_service_ids/symptom_to_service_ids (no
                 // "id"), but the real, live routing_archetypes data has
                 // only ever used component_id_to_service_ids/
                 // symptom_id_to_service_ids (with "id") -- confirmed
                 // directly, catalog-wide: the no-id field name has never
                 // existed in the real data. This meant the entire "Gap 3"
                 // group-level resolution this function documents (a phrase
                 // like "door lock is broken" correctly finding the group,
                 // then using its real component map to reach
                 // door_lock_or_handle_install specifically) has silently
                 // never fired for any real group -- c2s/s2s always
                 // resolved to {}, and every free-text submission fell
                 // through to whatever less-specific resolution came next.
                 const c2s = ra.component_id_to_service_ids || {};
                 const s2s = ra.symptom_id_to_service_ids || {};

                 // Check component map: does the raw text or extracted object
                 // contain any component keyword from this group's map?
                 for (const [component, svcIds] of Object.entries(c2s)) {
                     const comp = component.toLowerCase();
                     if (rawText.includes(comp) || extractedObj.includes(comp)) {
                         // Take the first (highest-priority) match
                         if (svcIds.length === 1) {
                             candidateSvcId = svcIds[0];
                             break;
                         }
                         // Multiple candidates: prefer the one whose name
                         // also appears in the text
                         const textMatch = svcIds.find(sid =>
                             rawText.includes(sid.replace(/_/g, ' ')) ||
                             rawText.includes(sid.replace(/_/g, '-'))
                         );
                         candidateSvcId = textMatch || svcIds[0];
                         break;
                     }
                 }

                 // Fall back to symptom map if no component matched
                 if (!candidateSvcId) {
                     for (const [symptom, svcIds] of Object.entries(s2s)) {
                         const sym = symptom.toLowerCase();
                         if (rawText.includes(sym)) {
                             candidateSvcId = svcIds.length === 1 ? svcIds[0] : svcIds[0];
                             break;
                         }
                     }
                 }

                 // If routing_archetypes resolved a specific service,
                 // use it instead of the generic dynamic entity
                 if (candidateSvcId) {
                     const resolvedSvc = (db.services || []).find(s => s.id === candidateSvcId);
                     if (resolvedSvc) {
                         const enrichDyn = resolveDynamicService(
                             resolvedSvc.ui_taxonomy?.category_id,
                             (window._normServiceType ? window._normServiceType(resolvedSvc.service_type) : (resolvedSvc.service_type || 'Repair').replace('Install / Mount', 'Install').replace('Install/Mount', 'Install')),
                             resolvedSvc.ui_taxonomy?.group_id
                         );
                         return {
                             entityType: 'service',
                             entity: resolvedSvc,
                             enrichment: orch_enrich_from_dynamic_service(resolvedSvc, enrichDyn),
                             _resolvedFromRoutingArchetype: true
                         };
                     }
                 }
             }

             if (group || dynDef) return {
                 entityType: 'dynamic',
                 entity: dynDef,
                 group,
                 enrichment: orch_enrich_from_dynamic_service(null, dynDef)
             };
         }
         if (effectiveContext.selectedCategoryId) {
             const dynDef = resolveDynamicService(effectiveContext.selectedCategoryId, effectiveContext.nlpIntent?.stype || 'Repair', null);
             if (dynDef) return {
                 entityType: 'dynamic',
                 entity: dynDef,
                 group: null,
                 enrichment: orch_enrich_from_dynamic_service(null, dynDef)
             };
         }
         // Fallback per workflow.steps[0].fallback — route to
         // intent_mappings.default_fallback. v9.5 archaeology note:
         // default_fallback.service_id (generic_handyman_service) is
         // real, designed data but references a service that doesn't
         // exist in the catalog and was never actually read by any
         // legacy code — confirmed during the architecture audit.
         // Until that's resolved (a real content/data decision, not an
         // orchestrator-code decision), this correctly falls through to
         // the category+price fallback fields only, exactly matching
         // the legacy sqAnalyze behavior this replaces.
         const fb = db.intent_mappings?.default_fallback;
         return {
             entityType: 'fallback',
             entity: null,
             fallback: fb || null
         };
     }

     function orch_apply_object_based_resolution(context, db) {
         const intent = context.nlpIntent;
         if (!intent || intent.resolver !== 'object_based') return intent;
         const resolved = Object.assign({}, intent);
         const object = context.resolutionObject ?? context.extractedObject;
         if (!object) {
             resolved.confidence_weight = 10; // matches legacy: no object extracted -> confidence well below threshold
             return resolved;
         }
         const objects = db.intent_mappings?.objects || [];
         // v9.6 FIX (T69 follow-up): was objects.find(...), taking
         // whichever entry happened to appear first in the array
         // that matched at all -- a real, confirmed bug, not
         // hypothetical: "under-cabinet" (or "under‑cabinet" with
         // a typographic hyphen) contains "cabinet" as a plain
         // substring, so a generic "cabinet" -> cabinet_door_or_
         // drawer_adjustment entry could win over the correct,
         // more specific "under cabinet" -> under_cabinet_light_
         // install entry purely by array order -- and a plain
         // hyphen never equals a plain space in a substring
         // check, so even ranking by length alone wouldn't have
         // been enough without also normalizing the text.
         // Confirmed shared with sqAnalyze's own legacy resolver
         // (byte-identical matching logic) -- sqAnalyze happens
         // to stay safe here only because it separately requires
         // a recommendedSku tied to a matching group before
         // auto-selecting, not because its own object-matching is
         // any more correct. Fixed at the real source instead:
         // normalize hyphens to spaces on both sides before
         // comparing, and among every real, matching entry,
         // prefer the one whose own keyword is longest (most
         // specific), not just the first one found.
         // v9.6 FIX (T69 follow-up, corrected): a first version of
         // this fix sorted ALL matches by longest keyword,
         // regardless of match direction -- this correctly fixed
         // "under-cabinet" (a long, specific object where a short,
         // generic "cabinet" keyword was wrongly winning by array
         // order), but broke "door" (a short, generic object that
         // should exact/closely match a short "door" keyword, not
         // get "upgraded" to an unrelated, longer keyword like
         // "door weatherstripping" that merely happens to contain
         // it as a substring via the OTHER match direction).
         // Confirmed via direct regression: "I need a new door
         // installed" broke from prehung_interior_door_install to
         // door_weatherstripping. Real fix: the two match
         // directions have different reliability and need
         // different tie-breaking. object.includes(keyword) means
         // the keyword is a specific sub-phrase genuinely present
         // within what the customer said -- prefer the longest
         // (most specific) such keyword, exactly as intended.
         // keyword.includes(object) means the object is just a
         // short fragment of a longer keyword -- inherently
         // weaker evidence, so among these, prefer the SHORTEST
         // (closest to an exact match), not the longest
         // coincidental superstring.
         const normalizeForMatch = s => s.toLowerCase().replace(/[\u2010-\u2015-]/g, ' ').replace(/\s+/g, ' ').trim();
         const normalizedObject = normalizeForMatch(object);
         const exactMatches = [],
             objectContainsKeyword = [],
             keywordContainsObject = [];
         for (const o of objects) {
             const nk = normalizeForMatch(o.keyword || '');
             if (!nk) continue;
             if (nk === normalizedObject) exactMatches.push(o);
             else if (normalizedObject.includes(nk)) objectContainsKeyword.push(o);
             else if (nk.includes(normalizedObject)) keywordContainsObject.push(o);
         }
         objectContainsKeyword.sort((a, b) => normalizeForMatch(b.keyword).length - normalizeForMatch(a.keyword).length);
         keywordContainsObject.sort((a, b) => normalizeForMatch(a.keyword).length - normalizeForMatch(b.keyword).length);
         const objectMap = exactMatches[0] || objectContainsKeyword[0] || keywordContainsObject[0];
         if (!objectMap) {
             resolved.confidence_weight = 30; // matches legacy: object found but unmapped -> confidence drops below threshold
             return resolved;
         }
         if (objectMap.default_dynamic_category) resolved.default_dynamic_category = objectMap.default_dynamic_category;
         if (objectMap.default_service_type) resolved.default_service_type = objectMap.default_service_type;
         if (objectMap.default_service_sku) {
             resolved.default_service_sku = objectMap.default_service_sku;
             if (!resolved.recommendedSku) resolved.recommendedSku = objectMap.default_service_sku;
         }
         // v9.5 FIX (matches the legacy fix above): re-check the
         // matched object's own contextual_overrides against the
         // real, original free text, the same way the PRIMARY
         // keyword-matching path already does -- previously this
         // resolver only ever read the object's bare defaults.
         if (Array.isArray(objectMap.contextual_overrides)) {
             const lowerDesc = (context.rawText || '').toLowerCase();
             const ctxMatch = objectMap.contextual_overrides.find(ov =>
                 Array.isArray(ov.keywords) && ov.keywords.some(k => lowerDesc.includes(k.toLowerCase()))
             );
             if (ctxMatch?.override_sku) {
                 resolved.default_service_sku = ctxMatch.override_sku;
                 resolved.recommendedSku = ctxMatch.override_sku;
                 if (ctxMatch.override_base_price != null) resolved.base = ctxMatch.override_base_price;
             }
         }
         if (objectMap.default_dynamic_category) {
             const newNormSt = (window._normServiceType ? window._normServiceType(resolved.default_service_type || 'Install') : (resolved.default_service_type || 'Install').replace('Install / Mount', 'Install'));
             const newDynDef = resolveDynamicService(objectMap.default_dynamic_category, newNormSt, intent._groupId);
             if (newDynDef?.financial_engine?.base_price) resolved.base = newDynDef.financial_engine.base_price;
         }
         // v9.5.11 FIX: same real gap as detectIntentNLP's
         // _hadContextualOverride/_descriptionOverride boosts --
         // a genuinely mapped, specific object (objectMap found
         // above) is real, explicit evidence of correct
         // resolution, arguably even more specific than a
         // secondary contextual phrase (it resolves the literal
         // object of the request, not just a qualifying detail)
         // -- yet this success path set no confidence signal at
         // all. The two FAILURE branches above already,
         // correctly, set confidence_weight to 10/30 -- but that
         // field, confirmed via direct trace, is never read by
         // anything (a real, separate, same-named-but-unrelated
         // static per-keyword field shadows it at every actual
         // consumer). Boost the real, live field instead
         // (_matchConfidence), floored at the same 90 as
         // _hadContextualOverride -- both represent an explicit,
         // specific, successfully-matched secondary signal, not
         // just a marginally-higher keyword score. Math.max so
         // an already-strong raw score is never reduced.
         resolved._matchConfidence = Math.max(resolved._matchConfidence || 0, 90);
         return resolved;
     }

     function orch_enrich_from_dynamic_service(entity, dynDef) {
         const enrichment = {
             suggestedTagIds: [],
             enrichedBase: null
         };
         if (!dynDef) return enrichment;
         if (dynDef.financial_engine?.base_price && !(entity?.financial_engine?.base_price)) {
             enrichment.enrichedBase = dynDef.financial_engine.base_price;
         }
         // T150: enrichment.checkoutState (and the archetype re-derivation that guarded it) is gone. Nothing read it except an operand chained after the resolver, which always answers,
         // so it could never run; and no dynamic entry carries operational_metrics.checkout_state. One question, one resolver: resolveServiceCheckoutStateKey.
         (dynDef.suggested_tags || []).forEach(tagObj => {
             if (!tagObj || typeof tagObj !== 'object') return;
             const segments = tagObj?.$ref ? tagObj.$ref.replace(/^#\//, '').split('/') : null;
             const tagId = segments ? '#' + segments[segments.length - 1].replace('#', '') : null;
             if (tagId && !enrichment.suggestedTagIds.includes(tagId)) enrichment.suggestedTagIds.push(tagId);
         });
         return enrichment;
     }

     function orch_compute_variability_flags(context, resolution, db) {
         const entity = resolution.entity;
         const chain = (entity && entity.intake_chain) || [];
         const bypassIntake = !!entity?.behavior?.bypass_intake;
         // v9.5 FIX (CORRECTED, found by a complete catalog sweep
         // against the legacy code's real logic — a first attempt
         // at this fix was too restrictive): legacyDetermineSelfQuoting
         // has TWO genuinely separate clauses, only one of which
         // requires bypass_intake. Modules like global_quantity/
         // item_count/count/hybrid_qty are self-quote-eligible
         // UNCONDITIONALLY (confirmed real case:
         // blinds_shades_curtains_buy_the_hour — global_quantity,
         // no bypass_intake, genuinely self-quote eligible).
         // item_count_template specifically requires bypass_intake,
         // since its unparameterized form would otherwise be
         // ambiguous (confirmed real case: the 10 services like
         // dimmer_switch_install — item_count_template, no
         // bypass_intake, genuinely NOT self-quote eligible,
         // correctly need curated_card instead). Two, precisely-
         // scoped flags matching the legacy code's real two-clause
         // structure exactly, rather than one over-broad flag.
         const isUnconditionalQtyMod = (m) => ORCH_QTY_MODS.has(m.module);
         const isQtyTemplateMod = (m) => m.module === 'item_count_template';
         const isQtyMod = (m) => isUnconditionalQtyMod(m) || isQtyTemplateMod(m);
         const chain_is_pure_quantity_unconditional = chain.length === 0 || chain.every(isUnconditionalQtyMod);
         const chain_is_pure_quantity_via_template = bypassIntake && chain.length === 1 && isQtyTemplateMod(chain[0]);
         const chain_is_pure_quantity = chain_is_pure_quantity_unconditional || chain_is_pure_quantity_via_template;
         const chain_is_single_simple_question = bypassIntake && chain.length === 1 && chain[0].module === 'item_count_template';
         const chain_has_real_non_quantity_question = chain.some(m => !isQtyMod(m));
         return {
             chain_is_pure_quantity,
             chain_is_single_simple_question,
             chain_has_real_non_quantity_question,
             all_visible_real_questions_answered: false, // computed live once answers exist; see compute_confidence
         };
     }

     function orch_compose_intake_chain(context, resolution, db) {
         const entity = resolution.entity;
         if (!entity) return [];
         const allMods = typeof _resolveIntakeChain === 'function' ? _resolveIntakeChain(entity) : (entity.intake_chain || []);
         // T118 FIX: was force_modules_by_variability[tier] -- unconditional,
         // ignored category/group entirely. Now resolves the real
         // categoryId/groupId for whichever entity kind this is (a real
         // service carries it on ui_taxonomy directly; the BookingContext
         // itself already carries the customer's selected category/group
         // for every entry path, including dynamic-service resolutions,
         // since resolveDynamicService needed them to do the lookup in the
         // first place -- context is the more reliable source for dynamic
         // entities specifically, since dynDef-shaped objects carry no
         // category/group fields of their own; confirmed directly, not
         // assumed, by checking a real dynamic_services entry's own keys).
         // Resolution logic is inlined (not a separately-called helper)
         // deliberately: many existing tests extract this exact function in
         // isolation via their own FNS lists for VM sandboxing, and a
         // separate helper function would silently ReferenceError in every
         // one of them unless each test's own list were individually
         // updated -- confirmed the hard way (18 real test failures) before
         // this fix. Precedence: group_defaults > category_defaults >
         // universal, deduplicated.
         const categoryId = context.selectedCategoryId || entity.ui_taxonomy?.category_id || null;
         const groupId = context.selectedGroupId || entity.ui_taxonomy?.group_id || null;
         const defs = db.global_rules?.intake_defaults || {};
         // T118 (PENDING_DECISIONS.md #22): excluded_services is a
         // targeted opt-out for a specific service within an
         // otherwise-correct category/group default (e.g.
         // wall_mounting's own access default is right for TV/
         // frame/drywall work, but not for two specific,
         // low-complexity, hourly-billed SKUs) -- checked here,
         // after the normal precedence resolves candidates, so it
         // can only ever remove, never add, a module.
         const excludedForThisService = new Set(defs.excluded_services?.[entity.id] || []);
         const forceMods = [...new Set([
             ...(defs.universal || []),
             ...(defs.category_defaults?.[categoryId] || []),
             ...(defs.group_defaults?.[groupId] || []),
         ])].filter(m => !excludedForThisService.has(m));
         const existingKeys = new Set(allMods.map(m => m.moduleKey || m.module));
         const composed = allMods.slice();
         const ownModuleKeys = allMods.map(m => m.moduleKey || m.module);
         const forcedAdded = [];
         forceMods.forEach(fKey => {
             if (!existingKeys.has(fKey) && db.intake_modules?.[fKey]) {
                 composed.push({
                     moduleKey: fKey,
                     module: fKey,
                     then: {},
                     ...db.intake_modules[fKey],
                     _forced: true
                 });
                 existingKeys.add(fKey);
                 forcedAdded.push(fKey);
             }
         });
         if (typeof _trace === 'function') _trace('orchestrator_engine', 'orch_compose_intake_chain: chain composed', {
             categoryId,
             groupId,
             ownAuthoredModules: ownModuleKeys,
             intakeDefaultCandidates: forceMods,
             actuallyAddedFromDefaults: forcedAdded,
             finalComposedModules: composed.map(m => m.moduleKey || m.module),
         });
         return composed;
     }

     function orch_apply_location_hints(context, composedChain, answers) {
         const loc = (context.extractedLocation || '').toLowerCase().trim();
         const newAnswers = Object.assign({}, answers);
         if (!loc) return newAnswers;
         composedChain.forEach(mod => {
             const key = mod.moduleKey || mod.module;
             if (newAnswers[key]) return; // never override a real answer
             const responses = mod.client_response || [];
             const matches = responses.filter(r => (r.location_hints || []).some(h => h.toLowerCase() === loc));
             if (matches.length === 1) newAnswers[key] = matches[0].label;
         });
         return newAnswers;
     }

     function orch_compute_confidence(resolution, activeTagIds, matchConfidence, db, entryType) {
         const entity = resolution.entity;
         // v9.6 FIX: was `entity?.confidence_strategy || {}` -- a direct,
         // raw field read that completely bypassed
         // resolveBaseConfidenceStrategy (and therefore Track A's real,
         // archetype-aware inheritance). Found via direct, comprehensive
         // testing, not assumed clean: toilet_flapper_or_fill_valve_replacement
         // (migrated to genuinely inherit minimum_quote_confidence:50 from
         // plumbing_fixture) resolved minConf as 80 through this exact path
         // -- the field's real absence fell through to this function's OWN,
         // separate, non-archetype-aware `|| 80` fallback below instead of
         // the correct, resolved value. This was a real, second, parallel
         // path to the same concept, not previously covered by the "one
         // central function" assumption -- exactly the bug class this
         // session has repeatedly found elsewhere. Passing entity as both
         // possible argument shapes is safe: resolveBaseConfidenceStrategy's
         // own logic already checks .confidence_strategy on whichever one
         // has it, and a dynamic-service entity (no real ui_taxonomy.group_id)
         // correctly falls through to the same generic FALLBACK it always did.
         const baseStrategy = resolveBaseConfidenceStrategy(entity, null);
         const smartTags = db.smart_tags || {};
         const escalation = (typeof applyLiveConfidenceEscalation === 'function') ?
             applyLiveConfidenceEscalation(baseStrategy, activeTagIds || [], smartTags, db.global_rules?.confidence_escalation) : {
                 strategy: baseStrategy,
                 escalatedBy: null
             };
         const minConf = escalation.strategy?.minimum_quote_confidence || baseStrategy.minimum_quote_confidence || 80;

         // v9.5 FIX: entry-type-aware confidence scoring.
         // The original formula (base_confidence + 0.2 * matchConfidence) is an NLP
         // metric — it measures how certain free-text detection was. Applying it to a
         // direct catalog tap is wrong: when a customer taps a specific service card,
         // intent is 100% certain regardless of NLP. Score 40 with minConf 50–95
         // meant catalog taps ALWAYS failed the confidence bar, gating the estimate
         // button on every named service. Confirmed by direct trace: every named service
         // with confidence_strategy.minimum_quote_confidence > 40 was unreachable.
         let score;
         if (entryType === 'catalog') {
             // Direct tap: customer chose this exact service. Intent is certain.
             score = 100;
         } else if (entryType === 'other_tile') {
             // Group-level tap: category + group are known, specific service type
             // may not be. Start high but not perfect.
             score = Math.min(100, (baseStrategy.base_confidence || 40) + 45 + Math.min(15, (matchConfidence || 0) * 0.15));
         } else {
             // free_text: NLP-derived — use the original formula
             score = Math.min(100, (baseStrategy.base_confidence || 40) + Math.min(20, (matchConfidence || 0) * 0.2));
         }

         return {
             score,
             minConf,
             escalatedBy: escalation.escalatedBy
         };
     }

     // orch_max_followup_questions -- LOGIC. How many unanswered follow-up questions the curated card may show at
     // once, from the entity's resolved confidence strategy. Exposed on the route (route.maxFollowupQuestions) as a
     // resolved fact so the renderer never derives it -- it used to call resolveBaseConfidenceStrategy itself.
     // NOTE: the `|| 5` default is carried over unchanged from the renderer. It is a business number living in code
     // (R-SYSTEM-NODATA); the SSOT should own it. Tracked as a follow-up, deliberately not changed in this move.
     function orch_max_followup_questions(entity, entityType) {
         if (!entity) return { value: null, source: 'fallback' };
         const isDynamic = entityType === 'dynamic'; // picks the SLOT the entity goes in -- not a second source for the resolved value
         const strat = resolveBaseConfidenceStrategy(isDynamic ? null : entity, isDynamic ? entity : null);
         return { value: strat.maximum_followup_questions, source: strat.fieldSources.maximum_followup_questions };
     }

     function orch_select_ui_template(flags, resolution, confidenceState, db) {
         const entity = resolution?.entity;
         const behavior = entity?.behavior;
         // Archaeology Audit finding: requires_furniture_selection and the
         // isOther condition (default_tags includes #adhoc or
         // #manual_review) BOTH completely bypass the curated-card/
         // self-quote matrix in the legacy code, diverting to
         // showIntakeQuestions — a categorically different UI. Computed
         // here as real, checkable booleans the matrix rules below can
         // reference by name, matching ui_template_matrix's first two
         // rules exactly.
         const requiresFurnitureSelection = !!entity?.requires_furniture_selection;
         const defaultTagIds = (entity?.default_tags || []).map(t =>
             (typeof t === 'object' && t.$ref) ? t.$ref : t);
         const isOtherAdhocService = defaultTagIds.includes('#adhoc') || defaultTagIds.includes('#manual_review');

         const rules = db.workflow?.ui_template_matrix?.rules || [];
         for (const rule of rules) {
             const cond = rule.if || {};
             let matches = true;
             if ('requires_furniture_selection' in cond && cond.requires_furniture_selection !== requiresFurnitureSelection) matches = false;
             if ('is_other_adhoc_service' in cond && cond.is_other_adhoc_service !== isOtherAdhocService) matches = false;
             if ('chain_is_pure_quantity' in cond && cond.chain_is_pure_quantity !== flags.chain_is_pure_quantity) matches = false;
             if ('chain_is_single_simple_question' in cond && cond.chain_is_single_simple_question !== flags.chain_is_single_simple_question) matches = false;
             if ('behavior.bypass_intake' in cond && cond['behavior.bypass_intake'] !== !!behavior?.bypass_intake) matches = false;
             if ('chain_has_real_non_quantity_question' in cond && cond.chain_has_real_non_quantity_question !== flags.chain_has_real_non_quantity_question) matches = false;
             if ('has_unaffirmed_detected_tags' in cond && cond.has_unaffirmed_detected_tags !== !!flags.has_unaffirmed_detected_tags) matches = false;
             if ('has_unconfirmed_negation_pivot' in cond && cond.has_unconfirmed_negation_pivot !== !!flags.has_unconfirmed_negation_pivot) matches = false;
             if ('confidence_score' in cond) {
                 const m = String(cond.confidence_score).match(/^<\s*(\d+)$/);
                 if (m && !(confidenceState.score < parseInt(m[1]))) matches = false;
             }
             if (matches) return Object.assign({}, rule.then, {
                 _matchedRule: rule
             });
         }
         return Object.assign({}, db.workflow?.ui_template_matrix?.fallback || {
             ui_template: 'curated_card'
         });
     }

     function orch_merge_materials_estimate(resolution, db) {
         const entity = resolution.entity;
         if (!entity) return {
             min: 0,
             max: 0,
             note: ''
         };
         const markupPct = (db.global_rules?.surcharges?.materials_markup_percent || 0) / 100;
         const catalog = db.materials_catalog || {};
         const sumSkus = (skus) => (skus || []).reduce((sum, sku) => {
             const item = catalog[sku];
             return sum + (item ? item.price * (1 + markupPct) : 0);
         }, 0);
         const reqTotal = sumSkus(entity.required_materials);
         const optTotal = sumSkus(entity.optional_materials);
         const hasCatalogLink = (entity.required_materials || []).length > 0 || (entity.optional_materials || []).length > 0;
         const legacy = entity.default_estimates?.materials || {
             min: 0,
             max: 0,
             note: ''
         };
         return {
             min: hasCatalogLink ? Math.round(reqTotal * 100) / 100 : legacy.min || 0,
             max: hasCatalogLink ? Math.round((reqTotal + optTotal) * 100) / 100 : legacy.max || 0,
             // Per workflow.steps.merge_materials_estimate's _note: ALWAYS
             // carry forward the legacy note text verbatim, regardless of
             // which range won — it frequently carries real,
             // business-meaningful customer-facing explanation the
             // catalog data has no equivalent for.
             note: legacy.note || '',
         };
     }

     function orch_compute_quote(resolution, context, answers, activeTagIds, db) {
         const entity = resolution.entity;
         if (!entity) return null;
         if (typeof computeUnifiedQuote !== 'function') return null;
         // v9.5 archaeology note (Blueprint Phase 2 review): confirmed
         // via direct read that computeUnifiedQuote has ZERO materials-
         // pricing logic at all — only a display toggle
         // (cs.hide_materials) for whether to SHOW a materials line.
         // Materials have always been a separate, additive line shown
         // alongside labor, never folded into one combined total.
         // v9.5 correction: confirmed via direct check that
         // base_materials is NOT always 0.0 — loose_tile_replacement
         // genuinely has base_materials: 15.0 (see backlog item I.3 /
         // the base_materials investigation for the full finding: this
         // field is real, designed, intentional data on exactly 1
         // service, but never actually read/applied anywhere in
         // pricing — a real, confirmed gap, not dead/duplicate data).
         // materialsEstimate is correctly NOT passed in
         // here — it's already a distinct, correctly-labeled top-level
         // field on ResolvedRoute (see executeWorkflow's return value),
         // matching the legacy UI's own display convention exactly.
         const common = {
             svc: resolution.entityType === 'service' ? entity : null,
             dynDef: resolution.entityType === 'dynamic' ? entity : null,
             answers: answers || {},
             qty: context.extractedQty || 1,
             intentKeyword: context.nlpIntent?.key || null,
             enrichment: resolution.enrichment || null,
             formulaId: context.nlpIntent?.dynamic_rule || entity?.financial_engine?.formula_ref || entity?.pricing_engine || null,
             ctxAdjFee: context.nlpIntent?._ctxFee || 0,
             ctxAdjMin: context.nlpIntent?._ctxMin || 0,
         };
         const full = computeUnifiedQuote(Object.assign({}, common, { activeTagIds: activeTagIds || [] }));
         // Detected tags are CHARGEABLE only once the customer affirmed them or the quote is confident without asking -- the state path's own rule
         // (computeQuoteFromState: `_tagsAffirmed || meetsConfidenceBar`), applied here so a detected tag's direct effect is gated identically on every entry
         // path (R-CLIENT-CONVERGE). Customer-chosen tags are always chargeable.
         if (!(context.detectedTagIds || []).length || context.tagsAffirmed || full.meetsConfidenceBar) return full;
         return computeUnifiedQuote(Object.assign({}, common, { activeTagIds: closeTagsOverRequires(context.manuallyToggledTagIds || [], context.negatedTagIds, db) }));
     }

     function orch_apply_intake_bypass_rules(context, db) {
         const rules = db.workflow?.intake_bypass_rules?.rules || [];
         const count = (context.uncoveredServiceTypes || []).length;
         for (const rule of rules) {
             const cond = rule.if || {};
             if ('uncovered_service_types_count' in cond && cond.uncovered_service_types_count === count) {
                 return Object.assign({}, rule.then, {
                     preseededAction: count === 1 ? context.uncoveredServiceTypes[0] : null,
                 });
             }
         }
         return Object.assign({}, db.workflow?.intake_bypass_rules?.fallback || {
             skip_type_selection: false
         });
     }

     // ---------------------------------------------------------------------
     // orch_apply_remote_divergence -- LOGIC ("Fork in the Road", Path A: Remote Deep Dive).
     // Pure: (previous route, SSOT) -> new route. No session state, no DOM. The handler
     // that owns the customer's choice (orchChooseDivergencePath, AppController) sets the
     // flag, calls this, and hands the result to the renderer. Split out of the former
     // UIRenderer function of the same name, text preserved (R-SYSTEM-LAYERS: one role per function).
     // ---------------------------------------------------------------------
     // orch_splice_remote_deep_dive -- LOGIC. Appends the entity's own authored remote_deep_dive_modules to a route's intake chain and marks the
     // route as diverged ('remote'). Confirmed directly (computeUnifiedQuote's own remoteDeepDiveModules, already filtered to real, existing
     // intake_modules) rather than re-deriving the filter logic a second time. A post-processing step, not a change to orch_compose_intake_chain
     // itself, so every existing caller/test of that shared function is unaffected. Shared by the fork (orch_apply_remote_divergence) and by
     // answering a question afterwards (orch_apply_answer), so the extra questions are never silently dropped by a re-run.
     function orch_splice_remote_deep_dive(route, DB) {
         const extraModuleKeys = (route.quote?.remoteDeepDiveModules || []);
         const existingKeys = new Set((route.intakeChain || []).map(m => m.moduleKey || m.module));
         extraModuleKeys.forEach(mk => {
             if (!existingKeys.has(mk) && DB.intake_modules?.[mk]) {
                 // Full module definition, not a bare reference -- confirmed directly that real intakeChain entries carry
                 // question/client_response/type inline (this is how orch_compose_intake_chain's own output is shaped), and the
                 // renderer's own responses.length check silently (and correctly, given a bare stub) skips anything without them.
                 route.intakeChain = [...(route.intakeChain || []), { ...DB.intake_modules[mk], moduleKey: mk, then: {} }];
             }
         });
         route.divergenceApplied = 'remote';
         return route;
     }

     function orch_apply_remote_divergence(prevRoute, DB) {
         // Re-run the real, canonical composition, then splice the entity's own authored remote_deep_dive_modules onto the resulting chain
         // (orch_splice_remote_deep_dive).
         const svc = prevRoute.entity;
         const category_id = prevRoute.context?.category_id || svc.ui_taxonomy?.category_id;
         const ctx = collectBookingContext_catalog(svc, category_id);
         // Carry the customer's already-given answers forward -- these are exactly what got them to the diagnostic dead-end that triggered
         // this fork in the first place. Without this, the newly-appended remote_deep_dive module re-competes with already-answered
         // questions for the same ceiling slot instead of being the one, new, unanswered question it should be (confirmed directly: this
         // was a real bug, not a hypothetical -- attempted_fix silently never rendered until this fix).
         ctx.answers = { ...(prevRoute.answers || {}) };
         return orch_splice_remote_deep_dive(executeWorkflow(ctx, DB), DB);
     }

     // orch_apply_answer -- LOGIC. The customer answered one question on a route: route in, route out. The route carries the context that produced
     // it (route.context), so this serves EVERY entry path -- catalog tap, other tile, free text -- with one function and no global holding "the
     // current context". The answer is carried with everything already given; a route that was diverged to the remote deep-dive keeps its extra
     // questions (orch_splice_remote_deep_dive), so answering one never makes the next disappear. The previous route is never mutated.
     // A route that does not carry its context (the catastrophic fallback) cannot be answered: it is returned unchanged.
     function orch_apply_answer(prevRoute, moduleKey, label, DB) {
         if (!prevRoute || !prevRoute.context) return prevRoute;
         const ctx = Object.assign({}, prevRoute.context, { answers: Object.assign({}, prevRoute.context.answers || {}, { [moduleKey]: label }) });
         const next = executeWorkflow(ctx, DB);
         return prevRoute.divergenceApplied === 'remote' ? orch_splice_remote_deep_dive(next, DB) : next;
     }

     function buildOtherTilesForGroup(realServices, groupId, groupMap, DB) {
         if (!groupId) return [];
         const group = groupMap.get(groupId);
         if (!group) return [];
         const dynTypes = group.dynamic_service_types || [];
         if (!dynTypes.length) return [];

         const normalize = t => (t || 'Repair').replace('Install / Mount', 'Install').replace('Install/Mount', 'Install');
         const coveredTypes = new Set(realServices.map(s => normalize(s.service_type)));
         const uncoveredTypes = dynTypes.filter(t => !coveredTypes.has(normalize(t)));
         if (!uncoveredTypes.length) return [];

         // icon preference order: Repair > Install > Diagnostic > Assembly > Setup
         // (whichever uncovered type is most likely to be tapped first)
         const iconPriority = ['Repair', 'Install', 'Install / Mount', 'Diagnostic', 'Assembly', 'Setup'];
         const primaryType = uncoveredTypes.slice().sort((a, b) =>
             iconPriority.indexOf(normalize(a)) - iconPriority.indexOf(normalize(b)))[0];
         const primaryStDef = DB?.service_types?.[normalize(primaryType)] || {};

         return [{
             _isOtherTile: true,
             id: '_other_' + groupId,
             // Carries EVERY uncovered type (normalized), not just one —
             // prefillSmartQuoteFromOtherTile uses this to decide whether
             // the action step can be pre-seeded (exactly one type) or must
             // still be asked (multiple types possible for this group).
             uncovered_service_types: uncoveredTypes.map(normalize),
             service_type: normalize(primaryType), // fallback/default if only one
             ui_taxonomy: {
                 // "[Group] Other" (e.g. "Doors Other") — the user already
                 // knows what group they're in; which specific action
                 // applies is asked inside the builder, not pre-guessed
                 // from a tile label.
                 display_name: (group.display_name || 'Other') + ' Other',
                 icon: primaryStDef.icon || 'ti-help-circle',
                 group_id: groupId,
                 description: 'Describe your ' + (group.display_name || 'job') + ' need — we\u2019ll ask only what\u2019s necessary.'
             },
             financial_engine: {
                 pricing_type: 'flat_rate',
                 base_price: primaryStDef.base_price || 0
             }
         }];
     }

     function readRoutePath(route, path) {
         if (path === '$root') return route;
         return path.split('.').reduce((cur, key) => (cur == null ? undefined : cur[key]), route);
     }

     function evaluateInvariant(route, invariant) {
         const c = invariant.check;
         switch (c.type) {
             case 'exists':
                 return readRoutePath(route, c.field) != null;
             case 'enum':
                 return c.allowed.includes(readRoutePath(route, c.field));
             case 'conditional_exists': {
                 const ifVal = readRoutePath(route, c.if_field);
                 if (ifVal !== c.if_value) return true; // condition doesn't apply
                 return readRoutePath(route, c.then_field) != null;
             }
             case 'conditional_not_equal': {
                 const ifVal = readRoutePath(route, c.if_field);
                 if (!c.if_values.includes(ifVal)) return true; // condition doesn't apply
                 return readRoutePath(route, c.then_field) !== c.forbidden_value;
             }
             case 'non_negative': {
                 const v = readRoutePath(route, c.field);
                 return v == null || typeof v !== 'number' || v >= 0;
             }
             case 'lte': {
                 const a = readRoutePath(route, c.field_a),
                     b = readRoutePath(route, c.field_b);
                 if (a == null || b == null) return true; // nothing to compare
                 return a <= b;
             }
             case 'non_empty_array': {
                 const v = readRoutePath(route, c.field);
                 return Array.isArray(v) && v.length > 0;
             }
             default:
                 return true; // an unrecognized check type fails OPEN, not closed — a malformed invariant definition should never itself become a false veto
         }
     }

     function describeInvariantFailure(route, invariant) {
         const c = invariant.check;
         // Append the actual failing value(s), generically, so a
         // violation message stays as specific as the old hardcoded
         // checks were — the rule TEXT is SSOT-driven and static, but
         // the ACTUAL bad value is real, per-run data that belongs in
         // the message too, not just in the Historian dump.
         switch (c.type) {
             case 'enum':
             case 'exists':
             case 'non_empty_array':
             case 'non_negative':
                 return `[${invariant.id}] ${invariant.rule} (actual: ${JSON.stringify(readRoutePath(route, c.field))})`;
             case 'conditional_exists':
             case 'conditional_not_equal':
                 return `[${invariant.id}] ${invariant.rule} (${c.if_field || c.if_field}=${JSON.stringify(readRoutePath(route, c.if_field))}, ${c.then_field}=${JSON.stringify(readRoutePath(route, c.then_field))})`;
             case 'lte':
                 return `[${invariant.id}] ${invariant.rule} (${c.field_a}=${JSON.stringify(readRoutePath(route, c.field_a))}, ${c.field_b}=${JSON.stringify(readRoutePath(route, c.field_b))})`;
             default:
                 return `[${invariant.id}] ${invariant.rule}`;
         }
     }

     function validateRoute(route, db, routingArchetypes) {
         const violations = [];
         const notices = [];

         if (!route || typeof route !== 'object') {
             violations.push('route is not a real object at all');
             return {
                 valid: false,
                 violations,
                 notices
             };
         }

         // The Judicial Rulebook: consult the real, declared
         // db.invariants array (per direct request) instead of
         // hardcoded JS conditionals — every law a ResolvedRoute must
         // satisfy lives in the SSOT, auditable without reading code.
         const invariants = db?.invariants;
         if (Array.isArray(invariants) && invariants.length > 0) {
             invariants.forEach(inv => {
                 if (!evaluateInvariant(route, inv)) {
                     violations.push(describeInvariantFailure(route, inv));
                 }
             });
         } else {
             // Fallback ONLY if db.invariants is genuinely missing
             if (!KNOWN_UI_TEMPLATES.has(route.uiTemplate)) {
                 violations.push(`uiTemplate "${route.uiTemplate}" is not one of the known real templates: ${[...KNOWN_UI_TEMPLATES].join(', ')}`);
             }
             if (route.uiTemplate === 'legacy_flow' && !route.entity) {
                 violations.push('uiTemplate is legacy_flow but no real entity was resolved');
             }
             if ((route.uiTemplate === 'self_quote' || route.uiTemplate === 'curated_card') && route.entityType === 'fallback') {
                 violations.push(`uiTemplate is "${route.uiTemplate}" but entityType is "fallback"`);
             }
             if (route.quote && typeof route.quote.laborEstimate === 'number' && route.quote.laborEstimate < 0) {
                 violations.push(`quote.laborEstimate is negative (${route.quote.laborEstimate})`);
             }
             if (route.materialsEstimate && route.materialsEstimate.min > route.materialsEstimate.max) {
                 violations.push(`materialsEstimate.min exceeds materialsEstimate.max`);
             }
             if (!Array.isArray(route.trace) || route.trace.length === 0) {
                 violations.push('trace is missing or empty');
             }
         }

         // GAP 1 FIX completion: semantic consistency check via routing_archetypes.
         // Uses the supplied routingArchetypes (from db.routing_archetypes or the
         // compiled artifact) -- if absent, skips gracefully (correct fallback).
         const raSource = routingArchetypes || db?.routing_archetypes || null;
         const archetypeNotice = checkRoutingArchetypeConsistency(route, raSource);
         if (archetypeNotice) notices.push(archetypeNotice);

         return {
             valid: violations.length === 0,
             violations,
             notices
         };
     }

     function catastrophicFallbackRoute(originalRoute, violations) {
         return {
             entityType: 'fallback',
             entity: null,
             intakeChain: [],
             answers: {},
             flags: null,
             confidence: null,
             uiTemplate: 'legacy_flow',
             bypassIntake: false,
             skipTypeSelection: false,
             preseededAction: null,
             materialsEstimate: {
                 min: 0,
                 max: 0,
                 note: ''
             },
             quote: null,
             trace: (originalRoute && Array.isArray(originalRoute.trace)) ? originalRoute.trace : [],
             _vetoed: true,
             _vetoReasons: violations,
         };
     }

     function collectBookingContext_catalog(svc, category_id) {
         if (typeof _traceStart === 'function') _traceStart({
             tappedServiceId: svc.id
         }, 'catalog');
         return makeBookingContext('catalog', {
             selectedServiceId: svc.id,
             selectedCategoryId: category_id || svc.ui_taxonomy?.category_id || null,
             selectedGroupId: svc.ui_taxonomy?.group_id || null,
             // No rawText, no nlpIntent — a directly-tapped service has no
             // typed text behind it. See booking_context's documented
             // contract: never synthesize rawText for this entry type.
         });
     }

     function collectBookingContext_otherTile(tile, category_id) {
         if (typeof _traceStart === 'function') _traceStart({
             tappedOtherTileGroupId: tile?.ui_taxonomy?.group_id || null
         }, 'catalog');
         // v9.5 FIX (caught during this function's own verification):
         // guessed at tile.groupId/tile._groupId — the real, confirmed
         // field (from buildOtherTilesForGroup's actual return shape) is
         // tile.ui_taxonomy.group_id.
         const uncoveredServiceTypes = tile?.uncovered_service_types || (tile?.service_type ? [tile.service_type] : []);
         // v9.5 FIX (found while scoping the prefillSmartQuoteFromOtherTile
         // rewire): orch_resolve_entity's real, exact code reads
         // context.nlpIntent?.stype to resolve the dynamic service's
         // type — this collector never set nlpIntent at all, meaning
         // the orchestrator would always fall back to the hardcoded
         // 'Repair' default for ANY other_tile entry, even when the
         // real tile's service_type is genuinely Mount/Diagnostic/etc.
         // Checked the real, exact scope before extending the contract
         // (confirmed exactly 2 real orchestrator call sites need this,
         // not a sprawling, untraceable set). Matches the legacy code's
         // own exact logic: a single, unambiguous uncovered type wins;
         // otherwise fall back to the tile's own service_type.
         const singleType = uncoveredServiceTypes.length === 1 ? uncoveredServiceTypes[0] : null;
         const bestGuessStype = singleType || tile?.service_type || null;
         return makeBookingContext('other_tile', {
             selectedCategoryId: category_id || null,
             selectedGroupId: tile?.ui_taxonomy?.group_id || null,
             // Phase 3: carried forward so workflow.intake_bypass_rules
             // can determine whether the type-selection step is
             // unambiguous (exactly one uncovered type) and skippable —
             // matches the real, already-correct legacy logic in
             // prefillSmartQuoteFromOtherTile/sqOpenBuilderPreseeded.
             uncoveredServiceTypes,
             nlpIntent: bestGuessStype ? {
                 stype: bestGuessStype
             } : null,
         });
     }

     function collectBookingContext_freeText(rawText) {
         if (typeof _traceStart === 'function') _traceStart(rawText, 'smart_quote');
         // T136: the ONE parse -- identical to what the live preview showed.
         const understanding = understandRequest(rawText);
         const nlpIntent = understanding.intent;
         const extractedObject = understanding.object; // strict: what a client may read
         const resolutionObject = understanding.resolutionObject; // lenient: for group/service matching only
         // v9.5 FIX: thresholds now read from the real, single SSOT
         // source (workflow.resolution_thresholds) instead of each
         // carrying its own duplicate hardcoded literal — closes
         // Archaeology Audit finding #2.
         const thresholds = _resolutionThresholds(); // T136: SSOT only, fails closed
         let selectedGroupId = null;
         const hasCategory = nlpIntent?.category && nlpIntent.category !== 'other';
         const hasMatchConf = (nlpIntent?._matchConfidence || 0) >= thresholds.route_to_group_other_tile;
         // v9.5.12: a single, shared matchMeta object reused across
         // both resolution passes below -- resolveGroupFromIntent
         // resets it at the top of every call, so whichever pass
         // actually determines the FINAL selectedGroupId (pass 2
         // only overwrites pass 1's result when negation genuinely
         // changes the outcome) is correctly what this reflects,
         // not stale metadata from a superseded earlier pass.
         const groupMatchMeta = {};
         // T36 pass 1: preliminary group resolution (no negation hints yet --
         // needed only to validate which tags apply before we know what's negated).
         if (hasCategory && hasMatchConf) {
             selectedGroupId = resolveGroupFromIntent(
                 nlpIntent.category, resolutionObject || extractedObject || '', nlpIntent.stype || 'Repair', rawText, null, groupMatchMeta
             );
         }
         const preliminaryGroupId = selectedGroupId;
         if (typeof _trace === 'function') _trace('orchestrator_engine', 'resolveGroupFromIntent: group resolved', {
             category: nlpIntent.category,
             objectNoun: resolutionObject || extractedObject || '',
             stype: nlpIntent.stype || 'Repair',
             resolvedGroupId: preliminaryGroupId,
             isCatchAll: !!groupMatchMeta.isCatchAll,
         });

         // v9.5 FIX: run full tag detection so the orchestrator path gets
         // the same #brick_wall / #heavy_item / contextual-tag signals that
         // sqPrepareFlow (legacy S-state path) was computing at lines 7663-7674.
         // Without this, the orchestrator route always got detectedTagIds:[]
         // meaning "mantel" never triggered #brick_wall, "large sign" never
         // triggered #heavy_item, etc. This was confirmed as the root cause
         // of the screenshot regression.
         const detCat = nlpIntent?.category || 'other';
         const detGroup = selectedGroupId || nlpIntent?._groupId || null;
         const nlpTagResult = (typeof detectTagsNLP === 'function') ?
             detectTagsNLP(rawText) : {
                 found: [],
                 negated: []
             };
         const detectedTagIds = nlpTagResult.found.filter(tid =>
             typeof tagValidForCategory === 'function' ?
             tagValidForCategory(tid, detCat, detGroup) :
             true
         );
         const negatedTagIds = nlpTagResult.negated.filter(tid => {
             // v9.6 FIX: was tagValidForCategory(tid, detCat, detGroup) --
             // same call as detectedTagIds, but a negated tag's whole
             // purpose is to potentially change WHICH group is correct,
             // and detGroup at this point reflects the preliminary
             // (possibly wrong, about to be reconsidered) resolution.
             // A first attempt at this fix passed groupId:null instead --
             // also wrong, confirmed by direct trace: tagValidForCategory's
             // own logic treats a missing groupId as automatic FAILURE for
             // any tag with applicable_group_ids set (`!groupId` is true),
             // not "skip the group check" as intended. #brick_wall has
             // applicable_group_ids set, so that attempt silently failed
             // the same way, just via a different path. Confirmed live via
             // the real sqAnalyze button-click flow both times.
             //
             // Real, correct fix: a genuinely separate, minimal,
             // category-only check for negated tags specifically --
             // tagValidForCategory itself is untouched, still correct for
             // detectedTagIds and every other real caller (group-level
             // scoping is exactly right when validating what something
             // IS, just not when validating what a customer said it
             // ISN'T, before that negation has had any chance to
             // reconsider which group is even correct).
             const tag = (DB.smart_tags || {})[tid];
             if (!tag) return false;
             const cats = tag.applicable_categories;
             const universal = !cats || cats.length === 0 || cats.includes('all');
             return universal || cats.includes(detCat);
         });

         // Contextual tags: "mantel" -> #brick_wall, "urgent" -> #emergency etc.
         if (typeof inferTagsFromContext === 'function') {
             const ctxTags = inferTagsFromContext(rawText, detCat, detGroup);
             ctxTags.forEach(({
                 tid
             }) => {
                 if (!detectedTagIds.includes(tid) && !negatedTagIds.includes(tid))
                     detectedTagIds.push(tid);
             });
         }

         // v9.5 FIX: size hint -> tag injection.
         // extractSizeHint was only used to NEGATE heavy tags (standard size),
         // never to POSITIVELY inject them (large/oversized). Added positive
         // v9.5 update: size-hint injection now distinguishes between
         // fragile/high-value large items (neon signs, art, glass) vs
         // genuinely heavy items (stone slabs, large mirrors, equipment).
         // Large fragile items get #fragile_item, not #heavy_item.
         const sizeHint = (typeof extractSizeHint === 'function') ?
             extractSizeHint(rawText, DB.smart_tags || {}) : null;
         const isFragileItem = /(neon|glass|canvas|painting|art|fragile|delicate|stained)/i.test(rawText);
         if (sizeHint === 'oversized') {
             if (isFragileItem) {
                 if (!detectedTagIds.includes('#fragile_item') && !negatedTagIds.includes('#fragile_item'))
                     detectedTagIds.push('#fragile_item');
             } else {
                 if (!detectedTagIds.includes('#very_heavy') && !negatedTagIds.includes('#very_heavy'))
                     detectedTagIds.push('#very_heavy');
             }
         } else if (sizeHint === 'large') {
             if (isFragileItem) {
                 if (!detectedTagIds.includes('#fragile_item') && !negatedTagIds.includes('#fragile_item'))
                     detectedTagIds.push('#fragile_item');
             } else {
                 if (!detectedTagIds.includes('#heavy_item') && !negatedTagIds.includes('#heavy_item'))
                     detectedTagIds.push('#heavy_item');
             }
         } else if (sizeHint === 'standard') {
             // Standard size: suppress heavy tags if not already detected
             ['#heavy_item', '#very_heavy'].forEach(tid => {
                 if (!detectedTagIds.includes(tid) && !negatedTagIds.includes(tid))
                     negatedTagIds.push(tid);
             });
         }

         // NLP _ctxTags (from contextual_overrides) -- same path sqAnalyze uses
         if (nlpIntent?._ctxTags?.length) {
             nlpIntent._ctxTags.forEach(tid => {
                 if ((typeof tagValidForCategory !== 'function' || tagValidForCategory(tid, detCat, detGroup)) &&
                     !detectedTagIds.includes(tid) && !negatedTagIds.includes(tid))
                     detectedTagIds.push(tid);
             });
         }

         // T36 pass 2: now that negation is fully known, re-resolve the
         // group with negatedGroupHints included -- this is "re-run the
         // same resolution pass with one more real input," per the design
         // doc's own stated architecture, not a separate pivot mode.
         let negationOverride = null;
         if (negatedTagIds.length > 0 && hasCategory && hasMatchConf) {
             const negatedGroupHints = computeNegatedGroupHints(negatedTagIds, DB.smart_tags || {});
             if (negatedGroupHints.groups.size > 0 || negatedGroupHints.categories.size > 0) {
                 const reResolved = resolveGroupFromIntent(
                     nlpIntent.category, resolutionObject || extractedObject || '', nlpIntent.stype || 'Repair', rawText, negatedGroupHints, groupMatchMeta
                 );
                 if (reResolved && reResolved !== preliminaryGroupId) {
                     selectedGroupId = reResolved;
                     negationOverride = {
                         from: preliminaryGroupId,
                         to: reResolved,
                         negatedTagIds: [...negatedTagIds]
                     };
                 }
             }
         }

         // v9.5.12 FIX: raised directly -- resolveGroupFromIntent
         // may unambiguously place the request in a specific,
         // narrow group (not a catchAll, not a deferred-negation
         // fallback), which is genuine, positive evidence the
         // resolution is correct -- confirmed via direct trace
         // this was previously invisible to confidence entirely,
         // the same real gap as the two override mechanisms
         // fixed in v9.5.11. A more modest floor than the 90
         // used there (category+group precision is real
         // evidence, but less specific than an explicit,
         // named secondary phrase or a directly-matched object)
         // -- anchored at the existing auto_select threshold
         // itself (confidence a clean group match should clear
         // the same bar a strong plain keyword would). Math.max,
         // never lowers an already-higher raw score. Genuinely
         // NOT boosted (left exactly as the raw keyword score
         // computed it) when the match came from a catchAll or
         // deferred-negation fallback -- that's real, remaining
         // ambiguity, not evidence to reward.
         if (selectedGroupId && !groupMatchMeta.isCatchAll && !groupMatchMeta.isDeferredNegationFallback && nlpIntent) {
             nlpIntent._matchConfidence = Math.max(nlpIntent._matchConfidence || 0, thresholds.auto_select_named_service || 70);
         }

         return makeBookingContext('free_text', {
             rawText,
             nlpIntent,
             extractedQty: extractQty(rawText),
             extractedObject,
             resolutionObject,
             extractedLocation: extractLocation(rawText),
             selectedServiceId: (nlpIntent?._matchConfidence >= thresholds.auto_select_named_service) ? (nlpIntent?.recommendedSku || null) : null,
             selectedCategoryId: nlpIntent?.category || null,
             selectedGroupId,
             detectedTagIds,
             negatedTagIds,
             _negationOverride: negationOverride,
         });
     }

     function makeBookingContext(entry, overrides) {
         // T118 FIX (PENDING_DECISIONS.md #33): makeBookingContext's own
         // defaults never included `answers` at all -- confirmed
         // directly, not assumed -- so a fresh context (from ANY entry
         // path: catalog, other_tile, free_text) had no `.answers` field
         // until something explicitly set one after the fact. Harmless
         // for executeWorkflow's own T108 fix specifically
         // (`context.answers || {}` already degrades safely), but a real
         // gap in the object's own contract -- any other consumer
         // reading `context.answers` directly, without the `|| {}`
         // guard, would see undefined rather than an empty object.
         // Fixed here, once, at the single shared default rather than
         // in collectBookingContext_catalog specifically (or any other
         // individual collector) -- every real entry path already
         // flows through this one function's Object.assign, so this is
         // the one place that actually needs it.
         return Object.assign({
             entry,
             selectedServiceId: null,
             selectedCategoryId: null,
             selectedGroupId: null,
             rawText: null,
             nlpIntent: null,
             extractedQty: null,
             extractedObject: null,
             resolutionObject: null,
             extractedLocation: null,
             manuallyToggledTagIds: [],
             negatedTagIds: [],
            detectedTagIds: [],
             _negationOverride: null,
             uncoveredServiceTypes: null,
             answers: {},
         }, overrides || {});
     }

     const COMPONENT_MODULE_NAMES = new Set([
         "wall_type", "surface_type", "door_type", "door_style_pref", "door_size",
         "client_supplying_door", "existing_frame", "faucet_type", "sink_type",
         "toilet_style_pref", "existing_toilet_type", "window_type", "removal",
         "install_type", "existing_type", "furn_item", "mounting_item",
         "wall_mount_items", "item_type", "fixture_type", "electrical_item",
         "plumbing_fixture", "tech_device", "computer_component", "device_type",
         "laptop_or_desktop", "existing_box", "ducting", "length", "distance",
         "weight", "mounting_height", "tile_condition", "waterproof_area",
         "has_matching_tiles", "thermostat_type", "customer_supplied_part",
         "software_install_type", "brand", "router_owned", "mesh_network",
         "pax_cabinet_count", "pax_hinge_count", "pax_interior_count",
         "pax_sliding_count",
     ]);
     const SYMPTOM_MODULE_NAMES = new Set([
         "symptom", "toilet_symptom", "tech_problem_type", "leak_type",
         "drain_speed", "issue", "damage_type", "device_state",
         "internet_active", "tech_issue_source",
     ]);

     function checkRoutingArchetypeConsistency(route, routingArchetypes) {
         // v9.5: the first genuine SEMANTIC check in validateRoute,
         // directly responding to a real, agreed-valuable critique
         // (T19): every existing invariant checks structure ("is
         // this field shaped correctly"), none check "does this
         // route's content actually make sense." This compares a
         // resolved, named service's REAL, complete, authored
         // intake_chain (component vs. symptom module mix) against
         // its own group's routing_archetype (computed by
         // btnyc_v8_compiler.py, the real, single source of truth
         // for this classification -- never duplicated into
         // qr.html itself, to avoid two, real, parallel
         // implementations drifting apart).
         //
         // DELIBERATELY INFORMATIONAL, NOT A HARD VIOLATION: direct,
         // individual review of every real, current disagreement
         // (internal_hardware_replacement leading with a component
         // question inside a symptom-first group; router_configuration
         // the same) confirmed BOTH are sensible, deliberate
         // authoring choices -- a customer replacing RAM already
         // knows the part; there's no real "symptom" to ask about
         // when setting up a new router. Treating either as a real
         // violation would have been actively wrong. This returns a
         // real, soft notice for a human to consider, never fails
         // the route.
         if (!routingArchetypes || route.entityType !== 'service' || !route.entity) return null;
         const gid = route.entity.ui_taxonomy?.group_id;
         const groupData = gid ? routingArchetypes[gid] : null;
         const archetype = groupData?.routing_archetype;
         if (!archetype || archetype === 'undetermined') return null;

         const chain = route.intakeChain || [];
         let c = 0,
             s = 0;
         chain.forEach(step => {
             const mod = step.moduleKey || step.module;
             if (COMPONENT_MODULE_NAMES.has(mod)) c++;
             else if (SYMPTOM_MODULE_NAMES.has(mod)) s++;
         });
         if (c + s < 2) return null; // genuinely not enough real signal in this service's own chain to compare

         const realLean = (s / (c + s)) >= 0.4 ? 'symptom_first' : 'component_first';
         if (realLean === archetype) return null;
         return `Real, soft notice (not a violation): "${route.entity.id}"'s authored intake_chain leans ${realLean} (${s} symptom vs ${c} component module(s)), but its group "${gid}" is classified ${archetype}. Confirmed via direct review this is sometimes a genuinely correct, deliberate choice (e.g. a part-replacement service inside a symptom-first group) -- review, don't assume a bug.`;
     }

     function legacyComposeIntakeChain(svc) {
         // Adapter: wraps orch_compose_intake_chain with (svc)-style call
         // used by test harnesses that call it with just a service object.
         return orch_compose_intake_chain({}, {
             entity: svc
         }, DB);
     }
 