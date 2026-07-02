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

const ORCH_QTY_MODS = new Set(['item_count', 'count', 'hybrid_qty', 'global_quantity']);
const KNOWN_UI_TEMPLATES = new Set(['self_quote', 'curated_card', 'chip_grid', 'legacy_flow']);

function _resolveIntakeChain(svc) {
                    if (!SERVICE_DATA.intake_modules) return [];
                    const resolved = [];
                    const seen = new Set();
                    // v9.1: params support. A step can carry params:{item_noun,
                    // client_response, question_override} to specialize a shared
                    // template module (item_count_template) per-service without
                    // duplicating the module definition in intake_modules.
                    //
                    // Every consumer of a resolved module (_isModVisible, answer
                    // storage, rendering) treats `.moduleKey` as an opaque string
                    // key — none of them look it up back into intake_modules
                    // directly (only this function does, using the ORIGINAL
                    // lookupKey below). So when params are present we mint a
                    // unique moduleKey (e.g. "item_count_template::windows")
                    // for the resolved object's .moduleKey field, which keeps
                    // answers for two different parameterized instances of the
                    // same template from colliding in the same chain, while
                    // still resolving the underlying module definition from
                    // intake_modules under its real, unparameterized name.
                    const resolveOne = (lookupKey, thenMap, params) => {
                        const moduleKey = params?.item_noun ? `${lookupKey}::${params.item_noun}` : lookupKey;
                        if (seen.has(moduleKey)) return; // avoid duplicates/cycles
                        seen.add(moduleKey);
                        const mod = SERVICE_DATA.intake_modules[lookupKey];
                        if (!mod) return;
                        let merged = { moduleKey, then: thenMap || {}, ...mod };
                        if (params) {
                            if (params.question_override) {
                                // Preferred: the exact original authored question
                                // text, preserved verbatim during the v9.1
                                // template consolidation (see CHANGELOG_v9.1.md).
                                merged.question = params.question_override;
                            } else if (params.item_noun && typeof merged.question === 'string') {
                                merged.question = merged.question.replace('{item_noun}', params.item_noun);
                            }
                            if (Array.isArray(params.client_response) && params.client_response.length) {
                                merged.client_response = params.client_response;
                            }
                            merged._params = params;
                        }
                        resolved.push(merged);
                    };
                    (svc.intake_chain || []).forEach(step => {
                        resolveOne(step.module, step.then, step.params);
                        // Inject every branch-target module named by ANY answer
                        // in this step's `then` map, so they exist in the
                        // resolved list for _isModVisible to gate on. They get
                        // their own `then` (usually {}) from intake_modules
                        // itself unless they branch further. Branch targets
                        // never carry params (schema: array of strings), so
                        // they always resolve under their own plain key.
                        const then = step.then || {};
                        Object.values(then).forEach(targets => {
                            (targets || []).forEach(targetKey => {
                                if (targetKey === step.module) return; // safety: no self-reference
                                resolveOne(targetKey, undefined, undefined);
                            });
                        });
                    });
                    return resolved;
                }

function executeWorkflow(context, db) {
                    const workflow = db.workflow;
                    if (!workflow || !Array.isArray(workflow.steps)) {
                        throw new Error('OrchestratorError: db.workflow.steps is missing or not an array.');
                    }
                    const trace = [];
                    let resolution = null, flags = null, intakeChain = [], answers = {},
                        confidenceState = null, uiTemplate = null, materialsEstimate = null, quote = null;
                    const activeTagIds = [...new Set([
                        ...(context.detectedTagIds || []),
                        ...(context.manuallyToggledTagIds || [])
                    ])].filter(tid => !(context.negatedTagIds || []).includes(tid));

                    for (const step of workflow.steps) {
                        let outputSummary;
                        switch (step.operation) {
                            case 'lookup':
                                resolution = orch_resolve_entity(context, db);
                                outputSummary = { entityType: resolution.entityType, entityId: resolution.entity?.id || null };
                                break;
                            case 'modify':
                                if (step.id === 'compute_variability_flags') {
                                    flags = orch_compute_variability_flags(context, resolution, db);
                                    outputSummary = flags;
                                } else if (step.id === 'apply_location_hints') {
                                    answers = orch_apply_location_hints(context, intakeChain, answers);
                                    outputSummary = { answersKeyCount: Object.keys(answers).length };
                                }
                                break;
                            case 'compose':
                                intakeChain = orch_compose_intake_chain(context, resolution, db);
                                outputSummary = { moduleCount: intakeChain.length };
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
                                outputSummary = quote ? { laborEstimate: quote.laborEstimate, dispatchFee: quote.dispatchFee } : null;
                                break;
                            default:
                                throw new Error(`OrchestratorError: Step [${step.id}] — unknown operation [${step.operation}].`);
                        }
                        trace.push({ step_id: step.id, operation: step.operation, output_summary: outputSummary });
                    }

                    // intake_bypass_rules is a separate, standalone rule set (not
                    // one of workflow.steps' 8 sequential entries) — only
                    // meaningful for entry='other_tile', where
                    // context.uncoveredServiceTypes carries the real data this
                    // rule set needs. Called directly here, after the main step
                    // loop, with its own trace entry for Phase 7 consistency.
                    const intakeBypass = orch_apply_intake_bypass_rules(context, db);
                    trace.push({ step_id: 'intake_bypass_rules', operation: 'condition_map', output_summary: intakeBypass });

                    const builtRoute = {
                        entityType: resolution?.entityType || 'fallback',
                        entity: resolution?.entity || null,
                        intakeChain,
                        answers,
                        flags,
                        confidence: confidenceState,
                        uiTemplate: uiTemplate?.ui_template || 'curated_card',
                        bypassIntake: !!uiTemplate?.bypass_intake,
                        skipTypeSelection: !!intakeBypass.skip_type_selection,
                        preseededAction: intakeBypass.preseededAction || null,
                        materialsEstimate,
                        quote,
                        // v9.5 FIX (closes Archaeology Audit findings #3/#5):
                        // resolution.enrichment was computed by orch_resolve_entity
                        // but never actually read by anything downstream — exactly
                        // the "looks wired, isn't" pattern this project exists to
                        // catch. Now a real, accessible field on the route.
                        enrichment: resolution?.enrichment || null,
                        trace,
                    };

                    // The Veto (Master Blueprint Phase 4): never hand a broken route
                    // to whatever consumes it next. Validate, and if genuinely
                    // broken, replace with the safe catastrophic fallback —
                    // logging WHY, so this is visible in trace/diff logs rather
                    // than silently swapped.
                    const validation = validateRoute(builtRoute, db);
                    if (!validation.valid) {
                        trace.push({ step_id: 'route_validator_veto', operation: 'condition_map', output_summary: { violations: validation.violations } });
                        return catastrophicFallbackRoute(builtRoute, validation.violations);
                    }
                    return builtRoute;
                }

function orch_resolve_entity(context, db) {
                    // Run object_based re-resolution FIRST, exactly matching the
                    // legacy code's real ordering -- it can change which
                    // category/SKU the rest of resolution targets.
                    const resolvedIntent = orch_apply_object_based_resolution(context, db);
                    const effectiveContext = (resolvedIntent !== context.nlpIntent)
                        ? Object.assign({}, context, {
                            nlpIntent: resolvedIntent,
                            selectedCategoryId: resolvedIntent.default_dynamic_category || context.selectedCategoryId,
                            selectedServiceId: resolvedIntent.default_service_sku || context.selectedServiceId,
                        })
                        : context;

                    if (effectiveContext.selectedServiceId) {
                        const svc = (db.services || []).find(s => s.id === effectiveContext.selectedServiceId);
                        if (svc) return { entityType: 'service', entity: svc, enrichment: orch_enrich_from_dynamic_service(svc, resolveDynamicService(svc.ui_taxonomy?.category_id, (window._normServiceType ? window._normServiceType(svc.service_type) : (svc.service_type || 'Repair').replace('Install / Mount', 'Install').replace('Install/Mount', 'Install')), svc.ui_taxonomy?.group_id)) };
                    }
                    if (effectiveContext.selectedGroupId) {
                        const group = (db.group || []).find(g => g.id === effectiveContext.selectedGroupId);
                        const dynDef = resolveDynamicService(effectiveContext.selectedCategoryId, effectiveContext.nlpIntent?.stype || 'Repair', effectiveContext.selectedGroupId);
                        if (group || dynDef) return { entityType: 'dynamic', entity: dynDef, group, enrichment: orch_enrich_from_dynamic_service(null, dynDef) };
                    }
                    if (effectiveContext.selectedCategoryId) {
                        const dynDef = resolveDynamicService(effectiveContext.selectedCategoryId, effectiveContext.nlpIntent?.stype || 'Repair', null);
                        if (dynDef) return { entityType: 'dynamic', entity: dynDef, group: null, enrichment: orch_enrich_from_dynamic_service(null, dynDef) };
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
                    return { entityType: 'fallback', entity: null, fallback: fb || null };
                }

function orch_apply_object_based_resolution(context, db) {
                    const intent = context.nlpIntent;
                    if (!intent || intent.resolver !== 'object_based') return intent;
                    const resolved = Object.assign({}, intent);
                    const object = context.extractedObject;
                    if (!object) {
                        resolved.confidence_weight = 10; // matches legacy: no object extracted -> confidence well below threshold
                        return resolved;
                    }
                    const objects = db.intent_mappings?.objects || [];
                    const objectMap = objects.find(o =>
                        object.toLowerCase().includes(o.keyword.toLowerCase()) ||
                        o.keyword.toLowerCase().includes(object.toLowerCase())
                    );
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
                    return resolved;
                }

function orch_enrich_from_dynamic_service(entity, dynDef) {
                    const enrichment = { suggestedTagIds: [], checkoutState: null, enrichedBase: null };
                    if (!dynDef) return enrichment;
                    if (dynDef.financial_engine?.base_price && !(entity?.financial_engine?.base_price)) {
                        enrichment.enrichedBase = dynDef.financial_engine.base_price;
                    }
                    if (dynDef.operational_metrics?.checkout_state && !(entity?.financial_engine?.checkout_state)) {
                        enrichment.checkoutState = dynDef.operational_metrics.checkout_state;
                    }
                    // v9.5 FIX (real, severe, customer-visible bug found via direct
                    // screenshot review): this only ever read dynDef.suggested_tags,
                    // with no way for a real, named service to provide its own, more
                    // specific tags. Confirmed via direct trace this caused 10 real,
                    // completely different services sharing one dynamic entity
                    // (minor_home_repairs+Install: a cabinet knob, a washer install,
                    // a microwave setup, a full interior door, etc.) to all show the
                    // identical #drywall/#brick_wall/#high_ceiling hints — genuinely
                    // confusing/wrong for most of them, and genuinely consequential
                    // since S._suggestedTagIds feeds a real, live tag-hint UI, not
                    // cosmetic data. Prefer the named service's own real
                    // suggested_tags when it defines one; fall back to the dynamic
                    // entity's only when the service doesn't.
                    // v9.5 FIX (real mistake caught immediately by testing, not
                    // assumed correct): entity?.suggested_tags?.length is falsy
                    // for a deliberately-empty array, so a service correctly
                    // wanting ZERO hints (suggested_tags: []) fell through to the
                    // dynamic entity's generic tags anyway — the exact opposite
                    // of this fix's intent. Check real PRESENCE (the key exists
                    // on the object), not length, so an explicit empty array is
                    // honored as a real, deliberate "no hints for this service,"
                    // not silently treated as "this service has no opinion."
                    const tagSource = (entity && 'suggested_tags' in entity ? entity.suggested_tags : dynDef.suggested_tags) || [];
                    tagSource.forEach(tagObj => {
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
                    const tier = entity.confidence_strategy?._variability_tier || 'medium';
                    // v9.5 FIX (found while building the intake-chain diff
                    // comparison): the legacy code's equivalent computation
                    // (S._forceModules, set in sqPrepareFlow) has a defensive
                    // fallback -- force in 'hybrid_qty' if the tier doesn't
                    // resolve to a real key in force_modules_by_variability.
                    // This orchestrator function had no equivalent fallback,
                    // defaulting to an empty array instead. Confirmed
                    // theoretical for all current real data (every service's
                    // tier genuinely exists in force_modules_by_variability),
                    // but a future malformed/unrecognized tier would cause the
                    // two engines to silently diverge. Fixed to match the
                    // legacy's more defensive, battle-tested behavior.
                    const forceMods = db.global_rules?.force_modules_by_variability?.[tier] || ['hybrid_qty'];
                    const existingKeys = new Set(allMods.map(m => m.moduleKey || m.module));
                    const composed = allMods.slice();
                    forceMods.forEach(fKey => {
                        if (!existingKeys.has(fKey) && db.intake_modules?.[fKey]) {
                            composed.push({ moduleKey: fKey, module: fKey, then: {}, ...db.intake_modules[fKey], _forced: true });
                            existingKeys.add(fKey);
                        }
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
                    const baseStrategy = entity?.confidence_strategy || {};
                    const smartTags = db.smart_tags || {};
                    const escalation = (typeof applyLiveConfidenceEscalation === 'function')
                        ? applyLiveConfidenceEscalation(baseStrategy, activeTagIds || [], smartTags, db.global_rules?.confidence_escalation)
                        : { strategy: baseStrategy, escalatedBy: null };
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

                    return { score, minConf, escalatedBy: escalation.escalatedBy };
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
                        if ('confidence_score' in cond) {
                            const m = String(cond.confidence_score).match(/^<\s*(\d+)$/);
                            if (m && !(confidenceState.score < parseInt(m[1]))) matches = false;
                        }
                        if (matches) return Object.assign({}, rule.then, { _matchedRule: rule });
                    }
                    return Object.assign({}, db.workflow?.ui_template_matrix?.fallback || { ui_template: 'curated_card' });
                }

function orch_merge_materials_estimate(resolution, db, qty) {
                    const entity = resolution.entity;
                    if (!entity) return { min: 0, max: 0, note: '' };
                    const realQty = qty || 1;
                    const markupPct = (db.global_rules?.surcharges?.materials_markup_percent || 0) / 100;
                    const catalog = db.materials_catalog || {};
                    const sumSkus = (skus) => (skus || []).reduce((sum, sku) => {
                        const item = catalog[sku];
                        return sum + (item ? item.price * (1 + markupPct) : 0);
                    }, 0);
                    const reqTotal = sumSkus(entity.required_materials);
                    const optTotal = sumSkus(entity.optional_materials);
                    const hasCatalogLink = (entity.required_materials || []).length > 0 || (entity.optional_materials || []).length > 0;
                    const legacy = entity.default_estimates?.materials || { min: 0, max: 0, note: '' };
                    // v9.5 FIX (real, severe bug found via direct screenshot review):
                    // this function never accounted for quantity at all, anywhere —
                    // confirmed via direct trace this affects 49 real services that
                    // are both flat_rate-priced (qty genuinely multiplies the labor
                    // estimate) and have real, catalog-linked materials. A customer
                    // ordering 10 real door locks would see a materials estimate for
                    // 1 lock's hardware, displayed right beside a correctly-scaled,
                    // 10x labor estimate — a real, severe, internally-inconsistent
                    // display with no indication the materials figure doesn't
                    // reflect the real quantity. The catalog-derived figure now
                    // genuinely scales with qty; the legacy, pre-catalog fallback
                    // range is intentionally left UNSCALED, since it was authored
                    // as a real, already-complete per-job range (e.g. a door
                    // install's $200-600 already describes the one, whole job),
                    // not a per-unit figure meant to be multiplied.
                    return {
                        min: hasCatalogLink ? Math.round(reqTotal * realQty * 100) / 100 : legacy.min || 0,
                        max: hasCatalogLink ? Math.round((reqTotal + optTotal) * realQty * 100) / 100 : legacy.max || 0,
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
                    return computeUnifiedQuote({
                        svc: resolution.entityType === 'service' ? entity : null,
                        dynDef: resolution.entityType === 'dynamic' ? entity : null,
                        activeTagIds: activeTagIds || [],
                        answers: answers || {},
                        qty: context.extractedQty || 1,
                        intentKeyword: context.nlpIntent?.key || null,
                        enrichment: resolution.enrichment || null,
                        // v9.5 FIX (real, severe, pre-existing bug found while
                        // wiring a new formula): entity?.pricing_engine?.dynamic_rule
                        // was structurally dead for every real service —
                        // pricing_engine is always a real, plain string (e.g.
                        // 'pax_wardrobe_formula'), never an object with its own
                        // .dynamic_rule property. Confirmed via direct test this
                        // meant EVERY real, formula-priced, named service never
                        // actually fired its formula through the live orchestrator
                        // path — a real answer produced zero change in totalMin.
                        formulaId: context.nlpIntent?.dynamic_rule || entity?.pricing_engine || null,
                        ctxAdjFee: context.nlpIntent?._ctxFee || 0,
                        ctxAdjMin: context.nlpIntent?._ctxMin || 0,
                    });
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
                    return Object.assign({}, db.workflow?.intake_bypass_rules?.fallback || { skip_type_selection: false });
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
                            const a = readRoutePath(route, c.field_a), b = readRoutePath(route, c.field_b);
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
                    let c = 0, s = 0;
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

function validateRoute(route, db, routingArchetypes) {
                    const violations = [];
                    const notices = [];

                    if (!route || typeof route !== 'object') {
                        violations.push('route is not a real object at all');
                        return { valid: false, violations, notices };
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
                        // (e.g. an older btnyc.json captured before this node
                        // existed, such as a historian replay of a pre-invariants
                        // trace) — keeps validateRoute safe even against
                        // historical data that predates the Judicial Rulebook.
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

                    // v9.5: the first genuine semantic check, deliberately
                    // soft -- see checkRoutingArchetypeConsistency's own,
                    // complete rationale above. Only runs when the caller
                    // explicitly supplies routingArchetypes (the compiler's
                    // real output); silently skipped otherwise, never a hard
                    // dependency for existing, structural validation to work.
                    const archetypeNotice = checkRoutingArchetypeConsistency(route, routingArchetypes);
                    if (archetypeNotice) notices.push(archetypeNotice);

                    return { valid: violations.length === 0, violations, notices };
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
                        materialsEstimate: { min: 0, max: 0, note: '' },
                        quote: null,
                        trace: (originalRoute && Array.isArray(originalRoute.trace)) ? originalRoute.trace : [],
                        _vetoed: true,
                        _vetoReasons: violations,
                    };
                }

function collectBookingContext_catalog(svc, category_id) {
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
                        nlpIntent: bestGuessStype ? { stype: bestGuessStype } : null,
                    });
                }

function collectBookingContext_freeText(rawText) {
                    const nlpIntent = detectIntentNLP(rawText);
                    const extractedObject = extractObject(rawText, nlpIntent?.key || null);
                    // v9.5 FIX: thresholds now read from the real, single SSOT
                    // source (workflow.resolution_thresholds) instead of each
                    // carrying its own duplicate hardcoded literal — closes
                    // Archaeology Audit finding #2.
                    const thresholds = DB.workflow?.resolution_thresholds || { auto_select_named_service: 70, route_to_group_other_tile: 50 };
                    let selectedGroupId = null;
                    const hasCategory = nlpIntent?.category && nlpIntent.category !== 'other';
                    const hasMatchConf = (nlpIntent?._matchConfidence || 0) >= thresholds.route_to_group_other_tile;
                    if (hasCategory && hasMatchConf) {
                        selectedGroupId = resolveGroupFromIntent(
                            nlpIntent.category, extractedObject || '', nlpIntent.stype || 'Repair', rawText
                        );
                    }

                    // v9.5 FIX: run full tag detection so the orchestrator path gets
                    // the same #brick_wall / #heavy_item / contextual-tag signals that
                    // sqPrepareFlow (legacy S-state path) was computing at lines 7663-7674.
                    // Without this, the orchestrator route always got detectedTagIds:[]
                    // meaning "mantel" never triggered #brick_wall, "large sign" never
                    // triggered #heavy_item, etc. This was confirmed as the root cause
                    // of the screenshot regression.
                    const detCat = nlpIntent?.category || 'other';
                    const detGroup = selectedGroupId || nlpIntent?._groupId || null;
                    const nlpTagResult = (typeof detectTagsNLP === 'function')
                        ? detectTagsNLP(rawText) : { found: [], negated: [] };
                    const detectedTagIds = nlpTagResult.found.filter(tid =>
                        typeof tagValidForCategory === 'function'
                            ? tagValidForCategory(tid, detCat, detGroup)
                            : true
                    );
                    const negatedTagIds = nlpTagResult.negated.filter(tid =>
                        typeof tagValidForCategory === 'function'
                            ? tagValidForCategory(tid, detCat, detGroup)
                            : true
                    );

                    // Contextual tags: "mantel" -> #brick_wall, "urgent" -> #emergency etc.
                    if (typeof inferTagsFromContext === 'function') {
                        const ctxTags = inferTagsFromContext(rawText, detCat, detGroup);
                        ctxTags.forEach(({ tid }) => {
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
                    const sizeHint = (typeof extractSizeHint === 'function')
                        ? extractSizeHint(rawText, DB.smart_tags || {}) : null;
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
                            if ((typeof tagValidForCategory !== 'function' || tagValidForCategory(tid, detCat, detGroup))
                                && !detectedTagIds.includes(tid) && !negatedTagIds.includes(tid))
                                detectedTagIds.push(tid);
                        });
                    }

                    return makeBookingContext('free_text', {
                        rawText,
                        nlpIntent,
                        extractedQty: extractQty(rawText),
                        extractedObject,
                        extractedLocation: extractLocation(rawText),
                        selectedServiceId: (nlpIntent?._matchConfidence >= thresholds.auto_select_named_service) ? (nlpIntent?.recommendedSku || null) : null,
                        selectedCategoryId: nlpIntent?.category || null,
                        selectedGroupId,
                        detectedTagIds,
                        negatedTagIds,
                    });
                }

function makeBookingContext(entry, overrides) {
                    return Object.assign({
                        entry,
                        selectedServiceId: null,
                        selectedCategoryId: null,
                        selectedGroupId: null,
                        rawText: null,
                        nlpIntent: null,
                        extractedQty: null,
                        extractedObject: null,
                        extractedLocation: null,
                        manuallyToggledTagIds: [],
                        negatedTagIds: [],
                        uncoveredServiceTypes: null,
                    }, overrides || {});
                }
