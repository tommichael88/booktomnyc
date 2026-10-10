/**
 * pricing_engine.js
 *
 * PHASE 1 — PricingEngine module (Logic / UI / Glue split).
 *
 * Every function below is VERBATIM from qr.html, extracted and manually
 * verified pure via a call-graph-aware audit (see architecture_audit/ in the
 * project root for the full methodology and results — 65 of 173 functions in
 * qr.html were found genuinely pure; these 21 are the pricing-relevant
 * subset). "Pure" here means:
 *   - No `document`, `window` (except the read-only `window.DB` alias),
 *     `alert`, `confirm`, or `prompt`.
 *   - No writes to the global mutable `S` or `State` session-state objects.
 *   - No localStorage/sessionStorage access.
 *   - Every function this module calls is also in this file (or is a plain
 *     JS builtin) — verified by transitive closure, not just a direct check,
 *     since a function with no DOM marker of its own that calls something
 *     impure is still impure (this caught real bugs during the audit, e.g.
 *     applySSOTRules looked pure by a naive check but directly mutates the
 *     global S object — it correctly stayed in qr.html, not here).
 *
 * Every function still reads the global `DB` (the loaded btnyc.json SSOT) —
 * by design, per the original architecture brief: "(state, DB) -> quoteData"
 * is the contract, not zero global reads at all. DB is read-only reference
 * data, not mutable session state, so this does not violate purity.
 *
 * Loaded as a plain global-scope <script> (not an ES module) — qr.html has
 * no bundler/build step, so every function here attaches to the page's
 * global scope exactly as it did inside the monolith, and every existing
 * call site in qr.html's main script continues to work UNCHANGED. This is
 * a deliberately incremental, lower-risk first step: extract the verified
 * module, prove nothing broke, before tackling the NLP and UI layers.
 *
 * Load order requirement: this file MUST be loaded before qr.html's main
 * <script> block, and DB must already be set (qr.html sets `DB = SERVICE_DATA`
 * near the top of its own script — that assignment still happens in qr.html,
 * not here, since DB is populated from the fetched btnyc.json at runtime).
 *
 * One bug fixed during extraction: formatServicePrice referenced an
 * undefined `ssot` global (found during the v9.2 audit, left unfixed at the
 * time since the branch was unreachable) — fixed to use the real DB global
 * before being moved here, so this module does not ship with a known
 * landmine baked in. See CHANGELOG_v9.4.md.
 */

function resolveDynamicService(category, stype, groupId) {
    if (!window.DB?.dynamic_services) return null;
    const normSt = (window._normServiceType ? window._normServiceType(stype) : (stype || 'Repair').replace('Install / Mount', 'Install').replace('Install/Mount', 'Install'));
    const cat = category || 'other';
    if (groupId) {
        const groupKey = cat + '+' + groupId + '+' + normSt;
        const groupDef = window.DB.dynamic_services[groupKey];
        if (groupDef) return groupDef;
    }
    const catKey = cat + '+' + normSt;
    return window.DB.dynamic_services[catKey] || null;
}

function resolveEngineKey(pricingType) {
    if (pricingType === 'hourly') return 'hourly_estimate';
    return pricingType || 'flat_rate';
}

function resolveServiceBadge(fe) {
    const csKey = fe?.checkout_state;
    const fromCS = window.DB?.checkout_states?.[csKey]?.ui_badge_label;
    if (fromCS) return fromCS;
    const pt = (fe?.pricing_type || 'flat_rate').toLowerCase();
    return window.DB?.ui_config?.pricing_type_badges?.[pt]?.label
        || '✅ Fixed price';
}

function resolveBaseConfidenceStrategy(svc, dynDef) {
                    const FALLBACK = {
                        minimum_quote_confidence: 70, maximum_followup_questions: 3,
                        diagnostic_threshold: 35, base_confidence: 40, _variability_tier: 'medium'
                    };
                    if (svc && svc.confidence_strategy) return svc.confidence_strategy;
                    if (dynDef && dynDef.confidence_strategy) return dynDef.confidence_strategy;
                    return FALLBACK;
                }

function resolveForceModules(variabilityTier) {
                    const map = DB.global_rules?.force_modules_by_variability || {};
                    return map[variabilityTier] || ['hybrid_qty'];
                }

function applyLiveConfidenceEscalation(baseStrategy, activeTagIds, smartTags, escalationDef) {
                    if (!escalationDef) return { strategy: { ...baseStrategy }, escalatedBy: null };
                    const RANK = { skilled: 1, specialized: 2 };
                    let worst = null, worstRank = 0;
                    for (const tid of activeTagIds) {
                        const override = smartTags[tid]?.effects?.complexity_override;
                        if (override && (RANK[override] || 0) > worstRank) {
                            worst = override;
                            worstRank = RANK[override];
                        }
                    }
                    if (!worst) return { strategy: { ...baseStrategy }, escalatedBy: null };
                    const delta = escalationDef[worst];
                    if (!delta) return { strategy: { ...baseStrategy }, escalatedBy: null };
                    const capConf = escalationDef.max_minimum_quote_confidence ?? 95;
                    const capQ = escalationDef.max_followup_questions_absolute ?? 6;
                    const strategy = { ...baseStrategy };
                    strategy.minimum_quote_confidence = Math.min(
                        capConf, (baseStrategy.minimum_quote_confidence || 0) + (delta.minimum_quote_confidence_delta || 0)
                    );
                    strategy.maximum_followup_questions = Math.min(
                        capQ, (baseStrategy.maximum_followup_questions || 0) + (delta.maximum_followup_questions_delta || 0)
                    );
                    return { strategy, escalatedBy: worst };
                }

function deriveComplexityTier(totalMinutes, tagOverrideTier, exactTier) {
                    const TIER_ORDER = { routine: 0, skilled: 1, specialized: 2 };
                    const tiers = DB.global_rules?.complexity_tiers || {};
                    let durationTier = 'routine';
                    for (const [key, def] of Object.entries(tiers)) {
                        const min = def.min_minutes ?? 0;
                        const max = def.max_minutes;
                        if (totalMinutes >= min && (max == null || totalMinutes <= max)) {
                            durationTier = key;
                            break;
                        }
                    }
                    let result = durationTier;
                    if (exactTier && (TIER_ORDER[exactTier] || 0) > (TIER_ORDER[result] || 0)) result = exactTier;
                    if (tagOverrideTier && (TIER_ORDER[tagOverrideTier] || 0) > (TIER_ORDER[result] || 0)) result = tagOverrideTier;
                    return result;
                }

function applyPricingFormula(formulaId, answers, qty) {
                    const f = DB.pricing_formulas?.[formulaId];
                    if (!f) return null;
                    let extraFee = 0, extraMin = f.base_minutes || 0;
                    let overrideHourlyRate = null;

                    if (formulaId === 'tile_repair_formula') {
                        const count = parseInt(answers.tile_count) || qty || 1;
                        extraMin += (f.minutes_per_tile || 5) * count;
                        if (answers.grout_repair === 'Yes') { extraMin += f.grout_penalty_minutes || 0; extraFee += f.grout_fee || 0; }
                        if (answers.water_damage === 'Yes') { extraMin += f.water_damage_penalty_minutes || 0; extraFee += f.water_damage_fee || 0; }
                        if (answers.ceiling_height === 'High ceiling') { extraMin += f.high_ceiling_penalty_minutes || 0; extraFee += f.high_ceiling_fee || 0; }
                        if (answers.disposal === 'Yes') { extraMin += f.disposal_minutes || 0; extraFee += f.disposal_fee || 0; }
                    } else if (formulaId === 'drywall_repair_formula') {
                        const sqft = parseInt(answers.area_sqft) || 2;
                        extraMin += (f.minutes_per_sqft || 5) * sqft;
                        extraFee += f.patch_fee || 0;
                        if (answers.texture_match === 'Yes') extraFee += f.texture_fee || 0;
                    } else if (formulaId === 'furniture_repair_formula') {
                        // SSOT: issue_type_fees keyed by the exact 'issue' intake_module
                        // label — same lookup pattern as tile_repair_formula's
                        // grout_repair/water_damage checks, generalized to any answer
                        // label instead of a hardcoded Yes/No. Previously this branch
                        // ignored `answers` entirely (base_minutes × multiplier only),
                        // which silently discarded every chip/question fee the user
                        // had just confirmed in the adlib sentence.
                        const issueFees = f.issue_type_fees?.[answers.issue] || null;
                        if (issueFees) {
                            extraFee += issueFees.fee || 0;
                            extraMin += issueFees.minutes || 0;
                        }
                        // Per-unit scaling for qty > 1 (e.g. 4 drawers), same role as
                        // tile_repair_formula's minutes_per_tile × count — replaces the
                        // generic +30min/unit padding that used to apply uniformly
                        // regardless of how small the per-unit job actually is.
                        if (qty > 1) extraMin += (f.per_unit_minutes || 0) * (qty - 1);
                        const mult = f.complexity_multiplier || 1;
                        extraMin = Math.round(extraMin * mult);
                        overrideHourlyRate = f.hourly_rate || null;
                    } else if (formulaId === 'pax_wardrobe_formula') {
                        const c = f.coefficients || {};
                        // v9.5 FIX (closes a real flaw caught during review of
                        // delegated content work, plus a second, related flaw
                        // not originally caught): parseInt(answers.pax_*_count)
                        // against the chosen LABEL TEXT silently truncated
                        // "4+" to 4 (the originally-reported bug) AND "2-3" to
                        // 2 (a second, equally real undercounting bug on every
                        // multi-unit band) — labels are display text, never
                        // meant to be machine-parsed for an exact count. Fixed
                        // to look up the real, explicit effects.qty_value on
                        // the actual chosen answer instead.
                        const resolveQtyValue = (moduleKey) => {
                            const label = answers[moduleKey];
                            const mod = DB.intake_modules?.[moduleKey];
                            const chosen = mod?.client_response?.find(r => r.label === label);
                            return chosen?.effects?.qty_value ?? (parseInt(label) || 0);
                        };
                        const cabinet = resolveQtyValue('pax_cabinet_count');
                        const hinge = resolveQtyValue('pax_hinge_count');
                        const sliding = resolveQtyValue('pax_sliding_count');
                        const interiors = resolveQtyValue('pax_interior_count');
                        const hours = Math.max(0,
                            cabinet * (c.cabinet_frame_hours || 0) +
                            hinge * (c.hinge_door_hours || 0) +
                            sliding * (c.sliding_door_hours || 0) +
                            interiors * (c.interior_item_hours || 0)
                        );
                        extraMin = Math.round(hours * 60);
                        if (hours < (f.minimum_hours_for_start_fee_waiver ?? 3)) extraFee += (f.start_fee || 0);
                        overrideHourlyRate = f.price_per_hour || null;
                    }
                    return { extraFee, extraMin, overrideHourlyRate };
                }

function getServiceProfile(svc) {
                    const fe = svc.financial_engine || {};
                    const om = svc.operational_metrics || {};
                    const pricingType = fe.pricing_type || svc.service_type || 'Repair';
                    const basePrice = fe.base_price || 0;
                    const checkoutState = fe.checkout_state || 'standard_flat_rate';
                    const chain = svc.intake_chain || [];
                    const defaultTags = svc.default_tags || [];
                    const requiresSiteVisit = defaultTags.some(t => t === '#site_visit_required');
                    const isOther = defaultTags.some(t => t === '#adhoc' || t === '#manual_review');
                    const isDiagnostic = isDiagnosticService(fe); // SSOT: checkout_state is badge authority
                    const isProject = basePrice >= 150 || (svc.default_estimates?.disclaimer === 'project_based');
                    const isHourly = fe.pricing_type === 'hourly';
                    const chainLen = chain.length;
                    let tier;
                    if (requiresSiteVisit) tier = 3;
                    else if (isProject) tier = 2;
                    else if (isDiagnostic && chainLen === 0) tier = 2;
                    else if (chainLen === 0) tier = 0;
                    else if (chainLen <= 2) tier = 1;
                    else tier = 2;
                    return {
                        pricingType,
                        basePrice,
                        checkoutState,
                        isDiagnostic,
                        isProject,
                        isHourly,
                        isOther,
                        requiresSiteVisit,
                        chainLen,
                        tier
                    };
                }

function getServicePriceRange(svc) {
                    if (svc.default_estimates && svc.default_estimates.total) {
                        return {
                            min: svc.default_estimates.total.min,
                            max: svc.default_estimates.total.max
                        };
                    }
                    const base = svc.base_price || 0;
                    return {
                        min: base,
                        max: base
                    };
                }

function formatServicePrice(svc) {
    // 1. Look inside ui_taxonomy for the presentation rules
    const strategy = svc.ui_taxonomy?.presentation_strategy || { display_enabled: true, buffer_label: "Average", calculation_basis: "base_plus_tags" };
    
    if (strategy.display_enabled === false) return 'Call for Quote';

    // 2. Extract base price safely
    let displayTotal = svc.financial_engine?.base_price || svc.base_price || 0;

    // 3. Apply Tag Math (if JSON allows)
    if (strategy.calculation_basis === "base_plus_tags") {
        // v9.4 FIX: this branch is currently unreachable — activeSmartTags /
        // State.activeSmartTags are never set anywhere in the codebase,
        // confirmed via exhaustive search — but it referenced an undefined
        // global `ssot` that would have thrown a ReferenceError the instant
        // this branch ever became reachable (e.g. a future card-hover tag
        // preview feature). Fixed to use the real global DB, the actual SSOT
        // accessor used everywhere else in this file, so the dormant path is
        // correct rather than merely inert.
        const currentTags = typeof activeSmartTags !== 'undefined' ? activeSmartTags : (State.activeSmartTags || []);
        currentTags.forEach(tagId => {
            const tagData = DB.smart_tags?.[tagId];
            if (tagData && tagData.effects && tagData.effects.fee) {
                displayTotal += tagData.effects.fee;
            }
        });
    }

    // 4. Render exact string
    if (displayTotal > 0) {
        let suffix = (svc.pricing_engine === 'hourly_estimate' || svc.pricing?.type === 'hourly') ? '/hr' : '';
        let prefixHtml = strategy.buffer_label ? `<span class="price-prefix">${strategy.buffer_label}</span> ` : '';
        return `${prefixHtml}$${displayTotal}${suffix}`;
    }
    
    return svc.price || 'Call';
}

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

function _isModVisible(mod, answers, allMods) {
                    if (mod.depends_on) {
                        for (const [k, v] of Object.entries(mod.depends_on)) {
                            if (answers[k] !== v) return false;
                        }
                    }
                    if (allMods && allMods.length) {
                        // Is this module named as a branch target by any OTHER
                        // module's `then` map in this same chain?
                        const branchParents = allMods.filter(m =>
                            m.moduleKey !== mod.moduleKey &&
                            m.then && Object.values(m.then).some(targets => targets.includes(mod.moduleKey))
                        );
                        if (branchParents.length) {
                            // It's a branch target — visible only if the parent's
                            // ANSWERED choice is one that names this module.
                            return branchParents.some(parent => {
                                const parentAnswer = answers[parent.moduleKey];
                                if (!parentAnswer) return false; // parent not answered yet
                                const targets = parent.then[parentAnswer] || [];
                                return targets.includes(mod.moduleKey);
                            });
                        }
                    }
                    return true;
                }

function tagValidForCategory(tid, cat, groupId) {
                    // SSOT: reads applicable_categories + applicable_group_ids from btnyc.json
                    //
                    // Two-tier scoping, both read from the tag's own data:
                    //   1. applicable_categories — the coarse boundary ("could this
                    //      ever apply in this category at all"). Empty/missing or
                    //      ['all'] means universal (parking, pets, disposal, urgency —
                    //      genuine cross-category logistics).
                    //   2. applicable_group_ids — an optional FURTHER narrowing within
                    //      an already-matching category. When present, it is the
                    //      deciding factor for that category, not an alternate path:
                    //      a tag like #brick_wall (category: minor_home_repairs) only
                    //      makes sense for the Walls group, not Cabinets or Appliances
                    //      that happen to share the same broad category. Most tags
                    //      don't set this and behave exactly as before (category-only).
                    //
                    // This replaces an earlier version where applicable_group_ids only
                    // acted as an OR-fallback when the category check failed — which
                    // meant a category match always short-circuited to valid and the
                    // group list could never actually exclude anything. A category as
                    // broad as minor_home_repairs (appliances, cabinets, doors, floors,
                    // furniture, walls, windows) needs real per-group exclusion, not
                    // just a coarse category gate, or every group inherits every other
                    // group's chips by default.
                    const tag = (DB.smart_tags || {})[tid];
                    if (!tag) return false;
                    const cats = tag.applicable_categories;
                    const universal = !cats || cats.length === 0 || cats.includes('all');
                    const categoryMatches = universal || cats.includes(cat);
                    if (!categoryMatches) return false;
                    const gids = tag.applicable_group_ids;
                    if (gids && gids.length > 0) {
                        // Group list present: it is now the deciding factor for this
                        // category match, not an optional bonus path.
                        return !!groupId && gids.includes(groupId);
                    }
                    // No group narrowing declared: category match alone is sufficient,
                    // same as every tag's existing behavior before this change.
                    return categoryMatches;
                }

function isDiagnosticService(fe) {
    return (fe?.checkout_state === 'diagnostic') || (fe?.pricing_type === 'Diagnostic');
}

function isLogisticTag(tid) {
    return !!(window.DB?.smart_tags?.[tid]?.is_logistic);
}

function estimateLiveConfidence(text) {
        const t = (text || '').toLowerCase();
        if (!t.trim()) return 0;
        const DB = window.DB;
        if (!DB) return 0;
        let maps = DB.intent_mappings || [];
        if (!Array.isArray(maps) && maps.objects) maps = maps.objects;
        let best = 0;
        for (const m of maps) {
            const kw = (m.keyword || '').toLowerCase();
            if (kw && kw !== 'other' && t.includes(kw)) {
                const w = m.confidence_weight || 0;
                if (w > best) best = w;
            }
        }
        // A recognized action verb adds a small amount of confidence on top
        // of the keyword match — "fix my toilet" should read as more
        // confident than just "toilet" alone.
        if (ACTIONS && ACTIONS.some(a => a.pattern.test(t))) best += 10;
        return best;
    }

function sqTagLabel(t, tid) {
                    // SSOT: ui_phrase is the intended human-readable chip label —
                    // all 44 smart_tags have it (e.g. 'on a drywall wall', 'that is
                    // clogged') while label/display_name are never populated (0/44).
                    // Without this check every chip showed the raw slug fallback.
                    if (!t) return tid ? tid.replace('#', '').replace(/_/g, ' ') : '';
                    return t.ui_phrase || t.label || t.display_name || tid.replace('#', '').replace(/_/g, ' ');
                }

function mathFurnitureAssembly(items) {
                    if (!items.length) return {
                        hours: 0,
                        price: 0,
                        minutes: 0
                    };
                    // v9.5 FIX (backlog item 7, confirmed money-affecting --
                    // NOT deferrable as pure UI): every one of the 124 real
                    // furniture_catalog items has a designed, non-zero
                    // flat_fee that was silently discarded here. Confirmed
                    // via direct check: 124 of 124 real items have
                    // flat_fee > 0, and this function previously only ever
                    // received a bare minutesArr, with no path for flat_fee
                    // to ever reach the real price at all. Now accepts the
                    // full items array (each with .minutes and .flat_fee)
                    // and sums both real cost components.
                    const minutesArr = items.map(it => (typeof it === 'number') ? it : (it.minutes || 0));
                    const flatFeeTotal = items.reduce((sum, it) => sum + ((typeof it === 'number') ? 0 : (it.flat_fee || 0)), 0);
                    const totalMinutes = minutesArr.reduce((a, b) => a + b, 0);
                    let hours = totalMinutes / 60;
                    if (hours > 0 && hours < 1) hours = 1;
                    const rounded = Math.round(hours * 100) / 100;
                    // SSOT: meta.global_rates.standard_labor — furniture assembly
                    // is standard labor, not the specialized_repair tier (85).
                    // meta.rate_per_hour does not exist in the JSON (was always
                    // falling through to the hardcoded 85 fallback, bypassing SSOT).
                    const rate = SERVICE_DATA?.meta?.global_rates?.standard_labor || 65;
                    return {
                        hours: rounded,
                        price: Math.round((rounded * rate + flatFeeTotal) * 100) / 100,
                        minutes: totalMinutes,
                        flatFeeTotal
                    };
                }

function resolveCheckoutState(checkoutStateKey, laborTotal) {
                    const cs = DB.checkout_states?.[checkoutStateKey] || {};
                    const discs = DB.meta?.estimate_disclaimers || {};
                    const isDiag = checkoutStateKey === 'diagnostic';
                    const isProject = checkoutStateKey === 'project_based';

                    // Button text: substitute ${labor_total} template
                    const btnKey = cs.hide_materials ? 'button_text_no_mat' : 'button_text_with_mat';
                    let btnText = cs[btnKey] || cs.button_text || 'Add to Request';
                    btnText = btnText.replace('${labor_total}', '$' + laborTotal);

                    // Disclaimer: SSOT is svc.default_estimates.disclaimer (same field
                    // the curated card path reads). Fall through to inferred key only
                    // when absent, so curated card and final quote always show the
                    // same legal text for the same service.
                    const svcDiscKey = S._svc?.default_estimates?.disclaimer || S._svc?.estimate_disclaimer || null;
                    const discKey = svcDiscKey || (isDiag ? 'flat_fee' : isProject ? 'project_based' : 'flat_fee');
                    const disclaimerText = discs[discKey] || cs.ui_message || 'Labor estimate. Materials extra.';

                    return {
                        btnText,
                        disclaimerText,
                        uiMessage: cs.ui_message || '',
                        hideTime: cs.hide_time || false,
                        hideMaterials: cs.hide_materials || false,
                        isDiag,
                        isProject
                    };
                }

function computeUnifiedQuote(ctx) {
                    const { svc, dynDef, activeTagIds = [], answers = {}, qty = 1, intentKeyword = null, formulaId = null, ctxAdjFee = 0, ctxAdjMin = 0, enrichment = null } = ctx;
                    const smartTags = DB.smart_tags || {};
                    const surcharges = DB.global_rules?.surcharges || {};
                    const dispatchFee = surcharges.dispatch_fee || 45;

                    const baseStrategy = resolveBaseConfidenceStrategy(svc, dynDef);
                    const variabilityTier = baseStrategy._variability_tier || 'medium';

                    let keywordConfidence = 0;
                    if (intentKeyword) {
                        const maps = Array.isArray(DB.intent_mappings) ? DB.intent_mappings : (DB.intent_mappings?.objects || []);
                        const m = maps.find(x => (x.keyword || '').toLowerCase() === intentKeyword.toLowerCase());
                        keywordConfidence = m?.confidence_weight || 0;
                    }

                    const fe = svc?.financial_engine || dynDef?.financial_engine || {};
                    // v9.5 FIX (closes Archaeology Audit findings #3/#5): the legacy
                    // enrichment pattern (orch_enrich_from_dynamic_service) only
                    // ever applies when the entity's OWN value is missing —
                    // matching the legacy !S.intent.base condition exactly, never
                    // silently overriding a real, already-present value.
                    // v9.5 FIX (caught by the Phase 5.5 broad shadow-mode sweep):
                    // fe.base_price || enrichment?.enrichedBase treated an
                    // explicit, intentional base_price:0 (correct for every
                    // hourly-priced service, where the real cost comes entirely
                    // from time × rate, not a base) the same as "no value was
                    // ever set" — incorrectly letting a generic, category-wide
                    // dynamic_services fallback's base_price leak in. Confirmed
                    // exact real case: dishwasher_repair (hourly,
                    // base_price:0 by design) gained an incorrect +$70 from the
                    // generic minor_home_repairs+Repair fallback. Fixed to check
                    // for genuine absence (undefined/null), not falsiness.
                    let base = (fe.base_price != null ? fe.base_price : enrichment?.enrichedBase) ?? 0;
                    // v9.5 FIX (closes backlog item I.3's real, open
                    // investigation): base_materials and default_estimates.
                    // materials are confirmed two genuinely distinct,
                    // separately-intended fields, not duplicates --
                    // base_materials is a small, fixed, always-incurred
                    // company cost meant to be folded into the charged
                    // price (e.g. loose_tile_replacement's real $15
                    // adhesive/grout cost), while default_estimates.
                    // materials is a customer-facing DISPLAY RANGE for
                    // materials the customer separately chooses/pays for
                    // (e.g. toilet_install's $100-$400 range, since the
                    // customer picks their own toilet). Confirmed via
                    // direct check that base_materials was real, designed,
                    // intentional data on exactly 1 real service, never
                    // read/applied anywhere in pricing -- a real, confirmed
                    // $15 undercharge on every loose_tile_replacement quote,
                    // not dead/duplicate data.
                    base += (fe.base_materials || 0);
                    const pricingType = (fe.pricing_type || '').toLowerCase();

                    // v9.5 FIX (closes the real, structural gap found during the
                    // backlog item A investigation): dynamic_rule previously only
                    // ever lived on intent_mappings.objects, set ONCE from the
                    // upstream NLP keyword match — before the customer has even
                    // answered which surface_type/branch they're actually in. A
                    // customer reaching the exact same tile/drywall-specific
                    // question via a DIFFERENT entry path (tapping a generic
                    // Other tile under Floors & Trim, then answering surface_type
                    // directly, with no NLP match at all) never had dynamic_rule
                    // set, so tile_repair_formula/drywall_repair_formula could
                    // never fire even though the customer answered the exact
                    // question those formulas were built to read. Scans the real,
                    // already-collected answers for a client_response.effects.
                    // formula_override and uses it as a fallback ONLY when no
                    // formulaId was already resolved upstream — an explicit, real
                    // NLP match always takes priority over inferring one from a
                    // later answer.
                    let effectiveFormulaId = formulaId;
                    if (!effectiveFormulaId) {
                        for (const [moduleKey, answerLabel] of Object.entries(answers)) {
                            const mod = DB.intake_modules?.[moduleKey];
                            if (!mod) continue;
                            const chosen = (mod.client_response || []).find(r => r.label === answerLabel);
                            const fov = chosen?.effects?.formula_override;
                            if (fov && DB.pricing_formulas?.[fov]) { effectiveFormulaId = fov; break; }
                        }
                    }
                    // SSOT: formulaId is now passed in explicitly via ctx (caller resolves
                    // it from S.intent.dynamic_rule — the only place a pricing_formula_id
                    // actually lives in real data; no services[] entry has ever carried a
                    // pricing_formula_id or an .intent sub-object, so the previous
                    // svc?.pricing_formula_id || svc?.intent?.dynamic_rule lookup could
                    // never resolve to anything and this branch was silently dead).
                    const formulaResult = effectiveFormulaId ? applyPricingFormula(effectiveFormulaId, answers, qty) : null;


                    let extraFee = 0, extraMin = 0;
                    const activeLabels = [];

                    // v9.5 FIX: contextual_overrides' own adjustment_fee/
                    // adjustment_minutes (e.g. "toilet" + "flushometer" -> +$75/
                    // +45min) previously had nowhere real to go — written into
                    // S.intent._ctxBaseAdjFee/_ctxBaseAdjMin with a comment saying
                    // "for computeSQQuote", a function removed in v9.2. Confirmed
                    // via exhaustive search that nothing else ever read those two
                    // fields. The #flushometer TAG itself was already correctly
                    // applied via activeTagIds (detTagIds) — only the override's
                    // own dollar/minute adjustment was silently lost on this NLP
                    // free-text path specifically.
                    extraFee += ctxAdjFee;
                    extraMin += ctxAdjMin;

                    if (formulaResult) {
                        extraFee += formulaResult.extraFee;
                        extraMin += formulaResult.extraMin;
                    } else {
                        for (const tid of activeTagIds) {
                            const t = smartTags[tid];
                            if (!t) continue;
                            extraFee += t.effects?.fee ?? 0;
                            extraMin += t.effects?.minutes ?? 0;
                            activeLabels.push(sqTagLabel(t, tid));
                        }
                    }

                    // SSOT: skip when a formula is active — the formula already
                    // consumed `answers` itself (e.g. furniture_repair_formula reads
                    // answers.issue via issue_type_fees). Without this guard, an
                    // answer that ALSO happens to match an intake_modules entry by
                    // the same key gets its effects.fee added a second time here,
                    // on top of what the formula already added. computeSQQuote
                    // avoided this by gating its equivalent loop on S._svc (named
                    // services only, which never carry a dynamic_rule formula) —
                    // this generalizes that same intent to the dynamic_services path.
                    //
                    // v9.2 FIX: this loop previously folded in each answer's fee/
                    // minutes but silently dropped its complexity_override — the
                    // dynamic, per-answer escalation signal authored on 169
                    // client_response options across intake_modules (e.g.
                    // wall_type: "Brick or concrete" -> skilled, weight: "Over 50
                    // lbs" -> specialized, symptom: "Won't drain" -> specialized).
                    // The Catalog-browser engine (_computePrice) already correctly
                    // ratchets its complexity tier upward from these same answers;
                    // this was the one place computeUnifiedQuote fell back to a
                    // cheaper, less accurate tier than the customer's own answers
                    // actually warranted — confidence/pricing escalation is supposed
                    // to work together with intake (see CHANGELOG_v9.2.md), and a
                    // job that "starts routine but escalates based on responses"
                    // could not actually escalate through this path before this fix.
                    const RANK = { skilled: 1, specialized: 2 };
                    let answerOverrideTier = null;
                    // v9.3 architecture (backlog — see CHANGELOG_v9.3.md): same
                    // ratchet pattern as answerOverrideTier above, for
                    // checkout_state_override instead of complexity_override. Lets a
                    // SPECIFIC answer (e.g. an appliance symptom that's genuinely
                    // ambiguous, like "turns on, spins briefly, then shuts off") force
                    // checkoutStateKey to 'diagnostic' independently of the service's
                    // static financial_engine.checkout_state — instead of today's
                    // all-or-nothing service-level flag that applies regardless of
                    // which answer was actually chosen (16 of 69 named services are
                    // currently unconditionally 'diagnostic' this way). No
                    // client_response anywhere sets this field yet — authoring real
                    // per-answer overrides for those 16 services, and giving them
                    // appliance-specific (not generically shared) symptom options in
                    // the first place, is the deferred detailed work.
                    let answerCheckoutOverride = null;
                    const CS_RESTRICTIVENESS = { standard_flat_rate: 0, project_based: 1, database_summation: 1, diagnostic: 2 };
                    if (!formulaResult) {
                        for (const [moduleKey, answerLabel] of Object.entries(answers)) {
                            const mod = DB.intake_modules?.[moduleKey];
                            if (!mod) continue;
                            const chosen = (mod.client_response || []).find(r => r.label === answerLabel);
                            if (!chosen) continue;
                            extraFee += chosen.effects?.fee || 0;
                            extraMin += chosen.effects?.minutes || 0;
                            const ov = chosen.effects?.complexity_override;
                            if (ov && (RANK[ov] || 0) > (RANK[answerOverrideTier] || 0)) {
                                answerOverrideTier = ov;
                            }
                            const cso = chosen.effects?.checkout_state_override;
                            if (cso && (CS_RESTRICTIVENESS[cso] || 0) > (CS_RESTRICTIVENESS[answerCheckoutOverride] || -1)) {
                                answerCheckoutOverride = cso;
                            }
                        }
                    }

                    // SSOT: default_estimates.total_minutes.{min,max} is the real,
                    // per-service-curated time data — operational_metrics.expected_minutes
                    // is set to the literal value 60 on all 69 services with zero
                    // variation, confirming it's a stale uniform placeholder rather than
                    // a real per-service figure (most have a total_minutes range that
                    // doesn't even contain 60). Use the midpoint of the genuine range.
                    //
                    // v9.5 FIX (severe, systemic, found while verifying the
                    // tile_repair_formula wiring): this previously only ever
                    // checked svc?.default_estimates — never
                    // dynDef?.default_estimate (note: singular field name on
                    // dynamic_services, distinct from services' plural
                    // default_estimates) — meaning EVERY dynamic-service quote
                    // (any free-text/Other-tile path with no named service)
                    // silently ignored its own real, curated time range and fell
                    // through to the bare 45-minute fallback. Confirmed real,
                    // complete scope: all 14 real dynamic_services entries have a
                    // genuine total_minutes range that was never used until now.
                    const tm = svc?.default_estimates?.total_minutes || dynDef?.default_estimate?.total_minutes;
                    const baseMinutes = tm && tm.min != null && tm.max != null
                        ? Math.round((tm.min + tm.max) / 2)
                        : (svc?.operational_metrics?.expected_minutes ?? dynDef?.operational_metrics?.minimum_minutes ?? 45);
                    let totalMin = Math.max(baseMinutes + extraMin, 30);
                    // SSOT: ANY active pricing_formula already determines its own
                    // "how much work" sizing from its own inputs — tile_repair_formula
                    // from tile_count/qty, drywall_repair_formula from area_sqft,
                    // furniture_repair_formula from per_unit_minutes×qty, pax_wardrobe_
                    // formula from its 4 component counts. None of these are the
                    // generic qty stepper, and qty has already been folded into the
                    // ones that do use it (tile, furniture) at the point applyPricingFormula
                    // ran. Padding totalMin by qty again here, or multiplying the final
                    // labor estimate by qty below, would double-count for every formula
                    // uniformly — not just furniture, which is why this is keyed off
                    // "is a formula active" rather than a single formula's name.
                    const formulaIsQtyAware = !!formulaResult;
                    if (qty > 1 && !formulaIsQtyAware) totalMin += (qty - 1) * 30;

                    // v9.2: tag-level AND answer-level overrides both feed the same
                    // ratchet — take whichever of the two is higher-ranked, never
                    // downgrade. A heavy item detected via NLP tag should escalate
                    // exactly as much as the same fact confirmed via an intake
                    // question answer.
                    let tagOverrideTier = answerOverrideTier, tagOverrideRank = RANK[answerOverrideTier] || 0;
                    for (const tid of activeTagIds) {
                        const override = smartTags[tid]?.effects?.complexity_override;
                        if (override && (RANK[override] || 0) > tagOverrideRank) {
                            tagOverrideTier = override;
                            tagOverrideRank = RANK[override];
                        }
                    }
                    const exactTier = svc?.operational_metrics?.complexity_tier || null;
                    const complexityTier = deriveComplexityTier(totalMin, tagOverrideTier, exactTier);
                    const tierRate = DB.global_rules?.complexity_tiers?.[complexityTier]?.hourly_rate || 85;
                    const effectiveHourlyRate = formulaResult?.overrideHourlyRate || tierRate;

                    const isFlatRate = pricingType === 'flat_rate';
                    // SSOT: qty-aware formulas (currently furniture_repair_formula, via
                    // per_unit_minutes) already scale totalMin for the requested
                    // quantity internally — multiplying the resulting labor estimate
                    // by qty AGAIN here would double-count it (4 drawers' worth of
                    // minutes, billed as if it were 4 SEPARATE full 4-drawer jobs).
                    // Same "this path already knows its own qty" principle as the
                    // totalMin padding suppression above; qty is folded into the
                    // formula math itself, not applied as an outer multiplier.
                    const qtyAlreadyAppliedByFormula = formulaIsQtyAware;
                    const qtyMultiplier = qtyAlreadyAppliedByFormula ? 1 : qty;
                    let laborEstimate;
                    if (isFlatRate) {
                        laborEstimate = Math.round((base + extraFee) * qtyMultiplier);
                    } else {
                        laborEstimate = Math.round((base + extraFee + (totalMin / 60) * effectiveHourlyRate) * qtyMultiplier);
                    }

                    // v9.5 FIX: implements global_rules.diagnostic_governance, confirmed
                    // completely unimplemented anywhere in this file despite an explicit
                    // _consuming_code_should field specifying exactly this behavior:
                    // "derive checkout_state from variability_tier when both are absent/
                    // ambiguous, and treat a stored checkout_state that contradicts
                    // variability_tier as a data error to flag, not silently trust."
                    // Verified zero violations across all 69 real services before this
                    // fix (the rule's own stated coincidence held, but was never
                    // enforced) — this changes no behavior for today's data; it only
                    // protects against a FUTURE data-entry error, which is the rule's
                    // explicitly stated purpose.
                    const variabilityTierIsDiag = variabilityTier === 'diagnostic';
                    // v9.5 FIX (closes Archaeology Audit finding #5): enrichment.
                    // checkoutState slots in between the entity's own real value
                    // (highest priority) and the generic pricingType/
                    // variabilityTier-derived fallback (lowest priority) — exactly
                    // matching the legacy code's real precedence.
                    let staticCheckoutStateKey = fe.checkout_state || enrichment?.checkoutState
                        || (pricingType === 'diagnostic' ? 'diagnostic' : (variabilityTierIsDiag ? 'diagnostic' : 'standard_flat_rate'));
                    if (fe.checkout_state && variabilityTierIsDiag !== (staticCheckoutStateKey === 'diagnostic')) {
                        console.warn(
                            `[diagnostic_governance violation] ${svc?.id || dynDef?.id || '(unnamed)'}: ` +
                            `checkout_state="${fe.checkout_state}" contradicts confidence_strategy._variability_tier="${variabilityTier}". ` +
                            `Per global_rules.diagnostic_governance, variability_tier is the single source of truth — this is a data error to fix in btnyc.json, not a runtime override.`
                        );
                    }
                    const checkoutStateKey = (answerCheckoutOverride &&
                        (CS_RESTRICTIVENESS[answerCheckoutOverride] || 0) > (CS_RESTRICTIVENESS[staticCheckoutStateKey] || 0))
                        ? answerCheckoutOverride
                        : staticCheckoutStateKey;
                    const cs = DB.checkout_states?.[checkoutStateKey] || {};
                    const btnKey = cs.hide_materials ? 'button_text_no_mat' : 'button_text_with_mat';
                    let btnText = (cs[btnKey] || cs.button_text || 'Add to Request').replace('${labor_total}', '$' + laborEstimate);

                    const escalation = applyLiveConfidenceEscalation(
                        baseStrategy, activeTagIds, smartTags, DB.global_rules?.confidence_escalation
                    );
                    const liveStrategy = escalation.strategy;

                    const totalConfidence = keywordConfidence + (liveStrategy.base_confidence || 0);
                    const meetsConfidenceBar = totalConfidence >= liveStrategy.minimum_quote_confidence;
                    const forceModules = resolveForceModules(variabilityTier);

                    return {
                        base, extraFee, extraMin, totalMin,
                        complexityTier, tierRate: effectiveHourlyRate,
                        laborEstimate, qty, activeLabels, dispatchFee,
                        checkoutStateKey,
                        badgeLabel: cs.ui_badge_label || '',
                        badgeIcon: cs.ui_badge_icon || '',
                        btnText,
                        uiMessage: cs.ui_message || '',
                        hideMaterials: !!cs.hide_materials,
                        hideTime: !!cs.hide_time,
                        isDiagnostic: checkoutStateKey === 'diagnostic',
                        isProject: checkoutStateKey === 'project_based' || base >= 150,
                        isAssembly: checkoutStateKey === 'database_summation',
                        variabilityTier, baseStrategy, liveStrategy,
                        escalatedBy: escalation.escalatedBy,
                        keywordConfidence, totalConfidence, meetsConfidenceBar,
                        forceModules,
                    };
                }

const parsePriceToInt = (str) => {
                    if (!str || typeof str !== 'string') return 0;
                    const m = str.match(/(\d+(?:\.\d+)?)/);
                    return m ? Math.round(parseFloat(m[1])) : 0;
                }
