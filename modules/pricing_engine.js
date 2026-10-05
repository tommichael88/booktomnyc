
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
      * 
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

     // v9.6 ADDITION: shared by every entry path (free-text, Guided Builder,
     // and any future one) that needs to decide whether an outer, raw
     // extracted/stepper-set quantity should apply as a price multiplier, or
     // whether the resolved entity already, separately captures "how many"
     // via its own, dedicated intake question (item_count_template), which
     // independently drives complexity-tier escalation. Applying both at
     // once double-counts quantity -- confirmed as a real, severe,
     // user-reported bug on two entirely separate code paths (Guided
     // Builder's sqBuilderFinish, T102; free-text's own S.qty assignment,
     // T103) before this was extracted into one, single, shared source of
     // truth instead of two, separately-maintained copies of the same
     // logic.
     const _GENERIC_QTY_MODULE_KEYS = new Set(['item_count', 'count', 'hybrid_qty', 'global_quantity']);

     function entityHasOwnQtyQuestion(entity) {
         return !!(entity?.intake_chain || []).some(step => {
             const key = step.module || '';
             return !_GENERIC_QTY_MODULE_KEYS.has(key) && (key === 'item_count_template' || key.startsWith('item_count_template::'));
         });
     }

     // resolveQuantityUnits -- LOGIC. THE one place the number of units a quote prices is decided (R-INVARIANT-PROVENANCE, R-INVARIANT-CANONICAL). It returns a record, never a
     // bare number, and callers read it as-is: nothing composes it with a second source. T147 retired the arbiters that used to decide this at ten call sites (a `? 1 : qty`
     // here, an `|| 1` there, a per-service flag honoured by one builder and ignored by the orchestrator).
     //   stance  'single_unit'  the service declares per_unit_answers_vary: its intake answers describe ONE unit, so two are two bookings -> units = 1, whatever was asked
     //           'batched'      the quantity is the customer's -> units = what was requested, unless the service carries the count in its own banded question (units = 1:
     //                          the bands price the count)
     //   source  'service_override' the service's own declaration or own question decided | 'dynamic_engine' a dynamic fallback entity (its own definition or the request) | 'fallback' nothing declared; the request stands
     function resolveQuantityUnits({ entity, entityType, requestedQty }) {
         const requested = Number(requestedQty) >= 1 ? Number(requestedQty) : 1;
         const decidedBy = entityType === 'dynamic' ? 'dynamic_engine' : 'service_override'; // whose own declaration decided: a service's, or a dynamic fallback's
         if (entity && entity.per_unit_answers_vary === true) return { units: 1, requestedQty: requested, stance: 'single_unit', source: decidedBy };
         if (entityHasOwnQtyQuestion(entity)) return { units: 1, requestedQty: requested, stance: 'batched', source: decidedBy };
         return { units: requested, requestedQty: requested, stance: 'batched', source: entityType === 'dynamic' ? 'dynamic_engine' : 'fallback' };
     }

     // resolveQuantityMultiplier -- LOGIC. How the units enter the arithmetic: as an outer multiplier on (base + per-unit fees), or not at all because a quantity-aware formula already
     // scales its own minutes (applying it again would count the quantity twice -- T102, T103, T135). One decision, one record: { multiplier, source }.
     function resolveQuantityMultiplier({ units, unitsSource, formulaId, entityType }) {
         if (QTY_AWARE_FORMULAS.has(formulaId)) return { multiplier: 1, source: entityType === 'dynamic' ? 'dynamic_engine' : 'archetype_default' };
         return { multiplier: units, source: unitsSource };
     }

     // resolveBuilderQuantity -- LOGIC. The guided builder's quantity: the dynamic entity its raw choices resolve to decides it, through the one quantity resolver. Glue hands over the choices
     // and reads the record; it neither looks the entity up in the pricing SSOT nor arbitrates (T148: the binary ship gate rejected sqBuilderFinish for calling the lookup itself).
     function resolveBuilderQuantity({ category, stype, groupId, requestedQty }) {
         return resolveQuantityUnits({ entity: resolveDynamicService(category, stype, groupId), entityType: 'dynamic', requestedQty });
     }

     function resolveServiceBadge(fe, csKey) {
         // T150: takes the RESOLVED checkout-state key, not the entity. It used to take an optional svc and fall back to a raw read of fe.checkout_state, so one signature had two
         // modes (an entity to resolve, or an already-resolved key smuggled in as a fake financial_engine). Callers now resolve first -- resolveServiceCheckoutStateKey for an entity,
         // the quote's own checkoutStateKey for a quote -- and pass the key; fe supplies only the pricing-type fallback label.
         const fromCS = window.DB?.checkout_states?.[csKey]?.ui_badge_label;
         if (fromCS) return fromCS;
         const pt = (fe?.type || fe?.pricing_type || 'flat_rate').toLowerCase();
         return window.DB?.ui_config?.pricing_type_badges?.[pt]?.label ||
             '✅ Fixed price';
     }

     function resolveServiceBadgeKey(csKey) {
         // v9.6: wires in checkout_states.*.quote_badge_key -- the machine-friendly counterpart to ui_badge_label, used as a stable data-attribute on the badge element.
         // T150: takes the RESOLVED checkout-state key (same change as resolveServiceBadge).
         return window.DB?.checkout_states?.[csKey]?.quote_badge_key || '';
     }

     function resolveBaseConfidenceStrategy(svc, dynDef) {
         const FALLBACK = {
             minimum_quote_confidence: 70,
             maximum_followup_questions: 3,
             diagnostic_threshold: 35,
             base_confidence: 40,
             _variability_tier: 'medium'
         };
         // v9.6 Track A Phase 2: archetype-aware resolution, field-by-field
         // merge instead of all-or-nothing. Real, existing per-service data
         // always wins for any field it explicitly sets; unset fields now
         // fall through to the entity's real archetype default (found via
         // its real group_id, matching Phase 1's already-verified
         // archetypes.*.member_group_ids data) before ever reaching the
         // generic, non-archetype-aware FALLBACK, which is now a true last
         // resort rather than the only fallback that existed before this.
         // This function's OWN contract is unchanged for any entity whose
         // confidence_strategy already sets every field (confirmed: true for
         // all 70 real services today) -- this is a real, verified no-op
         // until real data is migrated to omit archetype-matching fields.
         const groupId = svc?.ui_taxonomy?.group_id;
         let archetypeDefault = null;
         if (groupId && window.DB?.archetypes) {
             for (const arch of Object.values(window.DB.archetypes)) {
                 if (arch.member_group_ids?.includes(groupId)) {
                     archetypeDefault = arch.default_confidence_strategy;
                     break;
                 }
             }
         }
         const base = archetypeDefault ? {
             ...FALLBACK,
             ...archetypeDefault
         } : FALLBACK;
         // R-INVARIANT-PROVENANCE: the record says where it came from, on the record itself, so a caller never has to re-derive -- or re-choose -- where a number came from.
         // `source` is the most specific branch that supplied ANY field; `fieldSources` names the branch for EACH field. Levels: 'fallback' < 'archetype_default' < 'service_override' | 'dynamic_engine'.
         const fieldSources = {};
         Object.keys(FALLBACK).forEach(k => { fieldSources[k] = 'fallback'; });
         if (archetypeDefault) Object.keys(archetypeDefault).forEach(k => { fieldSources[k] = 'archetype_default'; });
         if (svc && svc.confidence_strategy) {
             Object.keys(svc.confidence_strategy).forEach(k => { fieldSources[k] = 'service_override'; });
             return { ...base, ...svc.confidence_strategy, source: 'service_override', fieldSources };
         }
         if (dynDef && dynDef.confidence_strategy) {
             Object.keys(dynDef.confidence_strategy).forEach(k => { fieldSources[k] = 'dynamic_engine'; });
             return { ...base, ...dynDef.confidence_strategy, source: 'dynamic_engine', fieldSources };
         }
         return { ...base, source: archetypeDefault ? 'archetype_default' : 'fallback', fieldSources };
     }

     function resolveForceModules(variabilityTier) {
         // T118: kept as a real, callable function -- deleting it outright
         // broke extract_engine.py's own hardcoded function list AND
         // automated_path_sweep.js's real, active call site, on top of the
         // ~30 test files that defensively reference it in their own FNS
         // extraction lists (confirmed the hard way: deleting it caused
         // MORE failures than leaving it, not fewer). Returns [] honestly
         // rather than guessing: this function's only argument is a
         // variability tier, and the new intake_defaults mechanism is
         // organized by category/group, not tier -- there is no longer a
         // tier-only answer to give. Real, load-bearing resolution happens
         // via the inlined category/group-aware logic in
         // orch_compose_intake_chain and sqPrepareFlow; callers that need
         // the real answer and have a category/group available should
         // resolve it the same way those two do, not call this function.
         return [];
     }

     function applyLiveConfidenceEscalation(baseStrategy, activeTagIds, smartTags, escalationDef) {
         if (!escalationDef) return {
             strategy: {
                 ...baseStrategy
             },
             escalatedBy: null
         };
         const RANK = {
             skilled: 1,
             specialized: 2
         };
         let worst = null,
             worstRank = 0;
         for (const tid of activeTagIds) {
             const tagDef = smartTags[tid];
             const override = tagDef?.escalate_complexity;
             if (override && (RANK[override] || 0) > worstRank) {
                 worst = override;
                 worstRank = RANK[override];
             }
         }
         if (!worst) return {
             strategy: {
                 ...baseStrategy
             },
             escalatedBy: null
         };
         const delta = escalationDef[worst];
         if (!delta) return {
             strategy: {
                 ...baseStrategy
             },
             escalatedBy: null
         };
         const capConf = escalationDef.max_minimum_quote_confidence ?? 95;
         const capQ = escalationDef.max_followup_questions_absolute ?? 6;
         const strategy = {
             ...baseStrategy
         };
         strategy.minimum_quote_confidence = Math.min(
             capConf, (baseStrategy.minimum_quote_confidence || 0) + (delta.minimum_quote_confidence_delta || 0)
         );
         strategy.maximum_followup_questions = Math.min(
             capQ, (baseStrategy.maximum_followup_questions || 0) + (delta.maximum_followup_questions_delta || 0)
         );
         return {
             strategy,
             escalatedBy: worst
         };
     }

     function deriveComplexityTier(totalMinutes, tagOverrideTier, exactTier) {
         const TIER_ORDER = {
             routine: 0,
             skilled: 1,
             specialized: 2
         };
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

     function applyPricingFormula(formulaId, answers, qty, svc = null) {
         const f = DB.pricing_formulas?.[formulaId];
         if (!f) return null;
         let extraFee = 0,
             extraMin = f.base_minutes || 0;
         let overrideHourlyRate = null;

         if (formulaId === 'hardware_install_formula') {
             // T135+ REWRITTEN (PRICING_GUIDE section 4.2/10.2 P3, direct
             // business input; fixes confirmed live bug B3): the prior
             // flat_tier_price two-tier model never activated its own
             // Tier 2 for swap jobs below 96 units -- every real job from
             // 1 to 95 units priced identically at $140 regardless of
             // actual size. New model: a single, continuous piecewise
             // function per install type -- included units at a flat
             // rate, then linear overflow -- with no flat-vs-per-unit
             // comparison to get wrong, so there's no cliff to create.
             const installType = answers.install_type || '';
             const isNewHoles = /new hole/i.test(installType) || /drilling/i.test(installType);
             const unitsNum = parseInt(answers.unit_count) || qty || 1;
             const rate = isNewHoles ? (f.new_holes || {}) : (f.swap || {});
             const included = rate.included_units ?? (isNewHoles ? 10 : 20);
             const flatRate = rate.flat_rate ?? (isNewHoles ? 35 : 20);
             const overflowPerUnit = rate.overflow_per_unit ?? (isNewHoles ? 3.5 : 1.0);
             const minsPerUnit = rate.minutes_per_unit ?? (isNewHoles ? 6 : 3);
             const overflowUnits = Math.max(0, unitsNum - included);
             const price = flatRate + overflowUnits * overflowPerUnit;
             return {
                 extraFee: price,
                 extraMin: minsPerUnit * unitsNum,
                 overrideHourlyRate: 0
             };
        } else if (formulaId === 'item_count_overflow_formula') {
             const svcId = svc?.id;
             const cfg = f.anchor_and_overflow_ref_by_service?.[svcId];
             if (!cfg) return {
                 extraFee: 0,
                 extraMin: 0,
                 overrideHourlyRate: null
             };
             const _mods = DB.global_rules?.modifiers || {};
             // T147 (PENDING_DECISIONS #80): the engine skips the module whose answer triggered a formula (the formula "owns" that module's pricing), so this formula must
             // carry the triggering band's OWN modifier as its flat top-band price. It used to return only the overflow beyond the anchor -- so the open-ended band priced at the
             // 1-unit base, BELOW the band under it ("4 or more windows" $105, then "5 or more windows" $55), while the v9.6 note promised "never charge less than the flat price".
             let flat = { fee: 0, minutes: 0 };
             let exactQty = null;
             for (const [moduleKey, answerLabel] of Object.entries(answers)) {
                 const step = (svc?.intake_chain || []).find(s => s.module === moduleKey);
                 const resp = step?.params?.client_response?.find(r => r.label === answerLabel);
                 if (resp?.formula_override === 'item_count_overflow_formula' && resp.modifier_ref && _mods[resp.modifier_ref]) flat = _mods[resp.modifier_ref];
                 if (exactQty == null && resp?.qty_value != null) exactQty = resp.qty_value;
             }
             if (exactQty == null && answers.__exact_count != null) {
                 const n = parseInt(answers.__exact_count, 10);
                 if (Number.isFinite(n) && n > 0) exactQty = n;
             }
             if (exactQty == null || exactQty <= cfg.anchor) {
                 return {
                     extraFee: flat.fee,
                     extraMin: flat.minutes,
                     overrideHourlyRate: null
                 };
             }
             const rate = _mods[cfg.overflow_rate_ref] || {
                 fee: 0,
                 minutes: 0
             };
             const overUnits = exactQty - cfg.anchor;
             return {
                 extraFee: flat.fee + rate.fee * overUnits,
                 extraMin: flat.minutes + rate.minutes * overUnits,
                 overrideHourlyRate: null
             };
        } else if (formulaId === 'tile_repair_formula') {
             // Resolve modifier_refs from global_rules.modifiers (new SSOT schema)
             // or fall back to direct values (old schema) for backward compat.
             const _mods = DB.global_rules?.modifiers || {};
             const _mod = (ref) => (ref && _mods[ref]) ? _mods[ref] : {};
             const count = parseInt(answers.tile_count) || qty || 1;
             extraMin += (f.minutes_per_tile || 5) * count;
             if (answers.grout_repair === 'Yes') {
                 const m = _mod(f.grout_modifier_ref);
                 extraMin += m.minutes ?? (f.grout_penalty_minutes || 0);
                 extraFee += m.fee ?? (f.grout_fee || 0);
             }
             // v9.6 FIX: a real, confirmed undercharging bug (found via
             // §6E's own question audit), but not the bug initially
             // assumed -- waterproof_area already has a real, authored
             // modifier (waterproof_area_yes_requires_membrane, $30/
             // 45min), consumed correctly by the generic per-answer
             // modifier_ref loop elsewhere in this function -- but
             // that loop only runs `if (!formulaResult)`, so it's
             // silently skipped whenever a formula (like this one) is
             // active. Confirmed directly: the dynamic-services "Tile"
             // branch (minor_home_repairs+Repair) activates
             // tile_repair_formula via surface_type's own
             // formula_override, so waterproof_area's real modifier
             // was never actually reaching this specific path, even
             // though it correctly does for named services using the
             // generic mechanism (e.g. loose_tile_replacement, which
             // has no formula_override and was never affected).
             // References the SAME real modifier, not a new one --
             // an earlier draft of this fix mistakenly authored a
             // brand-new, different-valued modifier before this real
             // one was found; corrected before trusting it.
             if (answers.waterproof_area === 'Yes (Requires membrane)') {
                 const m = _mod(f.membrane_modifier_ref);
                 extraMin += m.minutes ?? (f.membrane_penalty_minutes || 0);
                 extraFee += m.fee ?? (f.membrane_fee || 0);
             }
             if (answers.water_damage === 'Yes') {
                 const m = _mod(f.water_damage_modifier_ref);
                 extraMin += m.minutes ?? (f.water_damage_penalty_minutes || 0);
                 extraFee += m.fee ?? (f.water_damage_fee || 0);
             }
             if (answers.ceiling_height === 'High ceiling') {
                 const m = _mod(f.high_ceiling_modifier_ref);
                 extraMin += m.minutes ?? (f.high_ceiling_penalty_minutes || 0);
                 extraFee += m.fee ?? (f.high_ceiling_fee || 0);
             }
             if (answers.disposal === 'Yes') {
                 const m = _mod(f.disposal_modifier_ref);
                 extraMin += m.minutes ?? (f.disposal_minutes || 0);
                 extraFee += m.fee ?? (f.disposal_fee || 0);
             }
         } else if (formulaId === 'drywall_repair_formula') {
             const _mods = DB.global_rules?.modifiers || {};
             const _mod = (ref) => (ref && _mods[ref]) ? _mods[ref] : {};
             const sqft = parseInt(answers.area_sqft) || 2;
             extraMin += (f.minutes_per_sqft || 5) * sqft;
             const patchMod = _mod(f.patch_modifier_ref);
             extraFee += patchMod.fee ?? (f.patch_fee || 0);
             extraMin += patchMod.minutes || 0;
             if (answers.texture_match === 'Yes') {
                 const texMod = _mod(f.texture_modifier_ref);
                 extraFee += texMod.fee ?? (f.texture_fee || 0);
                 extraMin += texMod.minutes || 0;
             }
         } else if (formulaId === 'furniture_repair_formula') {
             // SSOT: issue_type_fees keyed by the exact 'issue' intake_module
             // label — same lookup pattern as tile_repair_formula's
             // grout_repair/water_damage checks, generalized to any answer
             // label instead of a hardcoded Yes/No. Previously this branch
             // ignored `answers` entirely (base_minutes × multiplier only),
             // which silently discarded every chip/question fee the user
             // had just confirmed in the adlib sentence.
             // v9.5: issue_type_fees entries now carry modifier_ref instead
             // of inline fee/minutes -- resolve via global_rules.modifiers.
             const _mods = DB.global_rules?.modifiers || {};
             const issueEntry = f.issue_type_fees?.[answers.issue] || null;
             if (issueEntry) {
                 const m = issueEntry.modifier_ref ? (_mods[issueEntry.modifier_ref] || {}) : issueEntry;
                 extraFee += m.fee || 0;
                 extraMin += m.minutes || 0;
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
                 return chosen?.qty_value ?? (parseInt(label) || 0);
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
         } else if (formulaId === 'buy_the_hour_qty_gate_formula') {
             // T118 (operator-directed, real user trace,
             // 2026-09-12): a "buy the hour" service should price
             // as a flat fee for exactly 1 item, or as real hourly
             // billing (with a 1-hour minimum) for more than 1 --
             // both at the SAME dollar rate, so a 1-item customer
             // and a >1-item customer whose job happens to take
             // exactly 1 hour pay the same amount either way.
             //
             // The 1-item case is simple: overrideHourlyRate: 0
             // makes isFlatRate true elsewhere, so laborEstimate
             // = base_price + extraFee (extraFee left 0) exactly.
             //
             // The >1-item case is the real subtlety, confirmed
             // directly by reading computeUnifiedQuote's own
             // formula, not assumed: the non-flat branch computes
             // base + extraFee + (totalMin/60)*effectiveHourlyRate
             // -- base_price would be added ONCE for being the
             // service's base, and the hourly component would be
             // added AGAIN on top, double-counting the same
             // dollar amount at exactly the 1-hour floor (e.g.
             // $50 base + $50/hr*1hr = $100, not the intended
             // $50). extraFee: -basePrice cancels that specific
             // double-count so the 1-hour-minimum charge lands at
             // exactly basePrice, matching the flat branch, not a
             // guess -- confirmed empirically in this fix's own
             // verification test, not just derived on paper.
             //
             // minimum_billable_hours is real, structured data in
             // global_rules.pricing_engines.hourly_estimate that
             // had zero consuming code anywhere in qr.html before
             // this fix (confirmed via an exhaustive grep, not
             // assumed) -- explicitly read and respected here,
             // via extraMin topping totalMin up to the real
             // minimum, rather than relying on this service's
             // own default_estimates.total_minutes happening to
             // already average to the same 60-minute figure. Both
             // numbers agree today, but this makes the guarantee
             // explicit and data-driven rather than coincidental.
             const basePrice = svc?.financial_engine?.base_price || 0;
             const minHours = f.minimum_billable_hours ?? DB.global_rules?.pricing_engines?.hourly_estimate?.minimum_billable_hours ?? 1;
             const tm = svc?.default_estimates?.total_minutes;
             const baseMinutesEstimate = (tm && tm.min != null && tm.max != null) ? Math.round((tm.min + tm.max) / 2) : (svc?.operational_metrics?.expected_minutes ?? 60);
             const minFloorMinutes = minHours * 60;
             if (answers.buy_the_hour_qty === '1 item') {
                 overrideHourlyRate = 0;
             } else {
                 extraFee = -basePrice;
                 extraMin = Math.max(0, minFloorMinutes - baseMinutesEstimate);
                 overrideHourlyRate = basePrice;
             }
         }
         return {
             extraFee,
             extraMin,
             overrideHourlyRate
         };
     }

     function getServiceProfile(svc) {
         const fe = svc.financial_engine || {};
         const om = svc.operational_metrics || {};
         const pricingType = fe.type || fe.pricing_type || svc.service_type || 'Repair';
         const basePrice = fe.base_price || 0;
          // Resolved display facts for renderers (renderers consume `prof`, never svc.financial_engine / the SSOT):
          //  startingPrice   -- the service's listed starting price, 0 when it has none.
          //  diagnosticPrice -- same, but a service with no listed price falls back to the SSOT-owned diagnostic rate
          //                     (service_types.Diagnostic.base_price). This replaces a hardcoded 85 that two renderers carried (R-SYSTEM-NODATA).
          const startingPrice = fe.base_price || 0;
          const diagnosticPrice = fe.base_price || DB.service_types?.Diagnostic?.base_price || 0;
          //  badge             -- the resolved display badge label (SSOT checkout_states / ui_config), so a card never has to read `fe`.
          //  isHourlyPricingType -- literally `fe.pricing_type === 'hourly'` (narrower than isHourly, which also accepts fe.type);
          //                       kept distinct because the card's historical behavior depended on that exact check.
          const csKey = resolveServiceCheckoutStateKey(svc, null).key; // the one resolution of this entity's checkout state; the badge and the diagnostic flag are read from it
          const badge = resolveServiceBadge(fe, csKey);
          const isHourlyPricingType = fe.pricing_type === 'hourly';
         const chain = svc.intake_chain || [];
         const defaultTags = svc.default_tags || [];
         const requiresSiteVisit = defaultTags.some(t => t === '#site_visit_required');
         const isOther = defaultTags.some(t => t === '#adhoc' || t === '#manual_review');
         const isDiagnostic = isDiagnosticService(fe, csKey); // SSOT: checkout_state is badge authority
         const isProject = basePrice >= 150 || (svc.default_estimates?.disclaimer === 'project_based');
         const isHourly = fe.type === 'hourly' || fe.pricing_type === 'hourly';
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
             startingPrice,
             diagnosticPrice,
             badge,
             isHourlyPricingType,
             isDiagnostic,
             isProject,
             isHourly,
             isOther,
             requiresSiteVisit,
             chainLen,
             tier
         };
     }

     // classifyServiceIntake -- LOGIC. Two facts the SmartQuote wiring needs about a named service, decided here and not in
     // the controller:  isSelfQuoting = full pricing data + flat checkout + an intake that asks nothing but quantity (skip the
     // chip grid);  needsCuratedCardTemplate = the intake chain asks at least one real, non-quantity question.
     // NOTE: isSelfQuoting restates the orchestrator's self-quote decision (orch_select_ui_template) -- the controller's own
     // comment called it "match orchestrator's logic". That is a second implementation (R-INVARIANT-CANONICAL). It is moved
     // here unchanged so it sits in the right layer; delete it when prefill consumes route.uiTemplate instead.
     function classifyServiceIntake(svc) {
         const om = svc.operational_metrics || {};
         const chain = svc.intake_chain || [];
         // Match orchestrator's logic: item_count_template needs bypass_intake to be self-quote
         const _bypassIntake = !!svc.behavior?.bypass_intake;
         const _isQtyMod = (m) => ['item_count', 'count', 'hybrid_qty', 'global_quantity'].includes(m.module) || (m.module === 'item_count_template' && _bypassIntake);
         const chainIsQtyOnly = chain.length === 0 || chain.every(_isQtyMod);
         const hasPricingData = (om.expected_minutes > 0) && om.complexity_tier && (svc.financial_engine?.base_price > 0);
         const isFlatCheckout = ['standard_flat_rate', 'database_summation'].includes(resolveServiceCheckoutStateKey(svc, null).key);
         // T150: the card-tap path may only self-quote a service whose price the self-quote card can EXPRESS. The card shows ONE price for ONE unit and has no quantity control, so a service whose
         // quantity moves its price (it has a quantity question and is not single-unit) keeps the guided builder, which captures the count. Before this rule that outcome was an accident of
         // reading the raw checkout_state field (blind to archetype inheritance); making the classification inheritance-aware without it would have shown a one-bulb price to a customer with five
         // bulbs. The orchestrator route does NOT apply this rule today (see PENDING_DECISIONS #108), so for such services the route and the card tap disagree by design until that is decided.
         const _hasQtyQuestion = chain.some(m => ['item_count', 'count', 'hybrid_qty', 'global_quantity', 'item_count_template'].includes(m.module));
         let _quantityIsFixed = true; // no quantity question: nothing the card cannot express
         if (_hasQtyQuestion) _quantityIsFixed = resolveQuantityUnits({ entity: svc, entityType: 'service', requestedQty: 2 }).stance === 'single_unit'; // the resolver alone decides when there is one
         return {
             isSelfQuoting: !!(hasPricingData && isFlatCheckout && chainIsQtyOnly && _quantityIsFixed),
             needsCuratedCardTemplate: chain.some(m => !_isQtyMod(m)),
             exactMinutes: om.expected_minutes,
             exactTier: om.complexity_tier
         };
     }

     // buildQuotePanelModel -- LOGIC. Everything the quote panel needs, decided from (session state, SSOT) and returned as a plain
     // view-model: whether to offer the divergence fork, the resolved quote (with its checkout state merged in), the badge,
     // the price copy, which banner accompanies it, and the customer's conditions ordered by real fee impact. No markup, no DOM.
     // Split out of the former sqRenderQuote (R-SYSTEM-LAYERS: that function computed, resolved, built markup and wrote the DOM).
     // mode 'fork'  -> { mode, q };   mode 'quote' -> { mode, q, badge, badgeKey, svcLabel, qtyLabel, stype, qty, dispatchLabel, banner, conditions }.
     function buildQuotePanelModel(state, DB) {
         const q = computeQuoteFromState(state);

         // Divergence Resolution ("Fork in the Road"): when the route has
         // genuinely hit the diagnostic dead end AND the entity has real,
         // authored remote_deep_dive_modules, show the two-path choice
         // INSTEAD of the normal price panel -- there is no real price
         // to show yet, on either path, until the customer picks one.
         // Once S._divergencePath is set (by the legacy divergence handler),
         // this branch is skipped and rendering falls through to the
         // normal panel below -- unchanged, existing behavior for the
         // On-Site path, and a normal re-render (now possibly with a
         // real price, if the deep-dive answers raised confidence
         // enough) for the Remote path.
         //
         // v9.5.4: additionally requires S._svc. Path A (Remote Deep
         // Dive) only actually works today for the curated-card intake
         // path (the legacy curated-intake builder, used when S._svc is a real named
         // service) -- traced directly: dynamic-service / builder-
         // originated routes (S._svc unset, resolved via dynDef instead)
         // render their intake through sqBuildStep3, a structurally
         // different tag-chip grid, not intake_modules questions at all,
         // and the legacy divergence handler has no integration with it yet.
         // Without this guard the fork would offer a "Remote Deep Dive"
         // button that silently did nothing for those routes. The 24
         // dynamic_services entries' remote_deep_dive_modules data is
         // real, authored, and schema-valid regardless -- this is a UI
         // reach limitation, not a data gap -- and computeUnifiedQuote
         // still correctly reports divergenceEligible for them, so this
         // is the one place, not the pure layer, that needs the extra
         // condition. Dynamic-service diagnostic routes keep today's
         // exact, existing, correct single-path (On-Site Pro only)
         // behavior until sqBuildStep3 gets the same treatment.
                  // Offered only where BOTH paths actually work: Path B needs nothing, Path A re-renders the route the customer is on
         // (orchChooseDivergencePath's own precondition is state._lastRoute.entity). This replaces the old `S._svc` test, which
         // existed because only the legacy curated builder could do Path A; that builder is retired.
         if (q.isDiagnostic && q.divergenceEligible && !state._divergencePath && state._lastRoute && state._lastRoute.entity) {
             return { mode: 'fork', q };
         }

         // v9.6 FIX: resolveCheckoutState is the real, existing, correct
         // source for disclaimerText/isDiag/btnText/btnClass/hideTime --
         // sqRenderQuote read all of these directly off q (which never
         // had them; computeQuoteFromState doesn't call this function)
         // and had been showing them as literal "undefined" in the real,
         // customer-facing quote. Confirmed via direct browser trace.
         const cs = buildCheckoutStateModel(q.checkoutStateKey, q.laborCalc, state._svc);
         Object.assign(q, cs);

         // SSOT: badge from checkout_states (single source — see resolveServiceBadge)
         const badge = resolveServiceBadge({ pricing_type: state.intent?._pricingType }, q.checkoutStateKey);
         const badgeKey = resolveServiceBadgeKey(q.checkoutStateKey);

         const svcLabel = state.intent?.label || 'Service';
         const qtyLabel = state.intent?.qtyLabel || 'item';

         // v9.6 FIX: priceDisplay/priceSub were read (q.priceDisplay,
         // q.priceSub) but never computed anywhere in the whole file --
         // confirmed via exhaustive search. Matches the same "From $X"
         // convention already used elsewhere (e.g. the affirmation
         // card's own priceDisplay) for the not-yet-fully-confident
         // case, and a plain "$X" once confident.
         q.priceDisplay = (q.isDiag || q.isProject) ? ('From $' + q.laborCalc) : ('$' + q.laborCalc);
         q.priceSub = q.isDiag ? 'Final price confirmed on-site' :
             q.isProject ? 'Estimate — final price may vary with scope' :
             (q.hideMaterials ? 'Fixed price' : 'Materials estimated separately');


         // Which banner (if any) accompanies the quote -- decided here; the renderer only draws it.
         //  auto    -- state._autoSelectedFrom is set: NLP matched the exact service, offer a clear way to revert.
         //  suggest -- a recommendedSku exists but confidence did not clear the auto-select bar: a softer "you could also try X".
         let banner = null;
         if (state._autoSelectedFrom) {
             banner = { kind: 'auto' };
         } else {
             // SSOT: if NLP matched a specific service SKU but confidence didn't clear the auto-select bar, still offer to switch --
             // same underlying action (_sqSwitchToRecommended), just framed as a suggestion rather than something already done for them.
             const _recSku = state.intent?.recommendedSku;
             const _recSvc = _recSku ? (DB.services || []).find(sv => sv.id === _recSku) : null;
             const _recCatId = state.intent?.category || _recSvc?.ui_taxonomy?.category_id || null;
             if (_recSvc) banner = { kind: 'suggest', sku: _recSku, name: (_recSvc.ui_taxonomy?.display_name || _recSku), catId: _recCatId };
         }

         // T118 (Step 6 item 10, per PENDING_DECISIONS.md #26,
         // explicit operator direction): was a single, flat row of
         // q.activeLabels in whatever order they happened to
         // accumulate -- confirmed directly, not a guess, that this
         // is the real "Special Conditions" chip row the operator's
         // own testing found unordered and cluttered relative to
         // the "We understood" summary above it. Reordered by real
         // fee impact (sqTagFeeImpact, traced from each tag's own
         // authored answers -- not the mostly-retired effects.fee
         // field) so the conditions actually affecting price are
         // what a customer sees first; zero-fee conditions
         // (display-only, informational) collapse into a single,
         // small toggle instead of taking the same visual weight
         // as fee-bearing ones.
         // The conditions shown are the conditions priced: the same closure (SSOT `requires` applied, explicit negations winning).
         const _activeTids = closeTagsOverRequires([...(state.detTagIds || []), ...(state.manTagIds || [])], state.negatedTagIds, DB);
         const _tidInfo = _activeTids.map(tid => ({
             tid,
             label: sqTagLabel(DB.smart_tags?.[tid], tid),
             fee: sqTagFeeImpact(tid),
         }));
         const _feeBearing = _tidInfo.filter(ti => ti.fee > 0).sort((a, b) => b.fee - a.fee);
         const _zeroFee = _tidInfo.filter(ti => ti.fee <= 0);
         return {
             mode: 'quote', q, badge, badgeKey, svcLabel, qtyLabel,
             stype: state.stype, qty: state.qty,
             dispatchLabel: DB.global_rules?.surcharges?.dispatch_label || 'Dispatch fee',
             dispatchScopeNote: DB.global_rules?.surcharges?.dispatch_scope_note || 'once per visit',
             banner,
             conditions: { count: _tidInfo.length, feeBearing: _feeBearing, zeroFee: _zeroFee }
         };
     }

     // requiredTagIdsFor -- LOGIC. The tag ids that selecting `tid` additionally requires, from the SSOT (smart_tags[tid].requires),
     // as '#id' strings that actually exist in the catalog. Authored entries are { "$ref": "#two_person_required" } objects or bare strings.
     // (Two tags carry a non-empty `requires` today: #very_heavy -> #two_person_required, #virus -> #tech_device_computer.)
     function requiredTagIdsFor(tid, DB) {
         const tags = DB.smart_tags || {};
         return (tags[tid]?.requires || [])
             .map(r => typeof r === 'string' ? r : (r?.$ref ? '#' + r.$ref.split('/').pop().replace(/^#/, '') : null))
             .filter(req => req && tags[req]);
     }

     // closeTagsOverRequires -- LOGIC. The tag ids in force once the SSOT's `requires` relations are honoured: every id given, then --
     // transitively, in discovery order -- every tag the SSOT says one of them requires, minus anything the CUSTOMER explicitly negated
     // (their own words beat an implication). Provenance is the caller's job: pass only the tags chargeable on that path (a tag derived from
     // a detected-but-unaffirmed tag is itself detected-but-unaffirmed). With no `requires` in play it returns exactly
     // `[...new Set(tagIds)].filter(not negated)`, the expression every caller used before, so behaviour is unchanged for every other tag.
     // This is the ONE place the rule lives (R-INVARIANT-NOPATCH: a fix that exists on one entry path is a symptom fix): the state path
     // (computeQuoteFromState), the orchestrator (executeWorkflow) and the conditions the quote panel displays all call it, so no entry path
     // prices a requirement another does not.
     function closeTagsOverRequires(tagIds, negatedTagIds, DB) {
         const negated = new Set(negatedTagIds || []);
         const base = [...new Set(tagIds || [])].filter(t => !negated.has(t));
         const inForce = new Set(base);
         const queue = [...base];
         for (let i = 0; i < queue.length; i++) {
             for (const req of requiredTagIdsFor(queue[i], DB)) {
                 if (negated.has(req) || inForce.has(req)) continue;
                 inForce.add(req);
                 queue.push(req);
             }
         }
         return [...inForce];
     }

     // toggleTagState -- LOGIC. The state transition when a customer taps a tag chip: de-select removes it from every active set;
     // select clears any negation, removes mutually-exclusive siblings from ALL sets (and their negation -- you cannot show "not heavy"
     // after "very heavy"), adds the tag as an explicit user choice, and then pulls in the tags the SSOT says it REQUIRES.
     // Pure with respect to everything but the state object it is handed. Moved out of sqToggleTag (Glue, R-SYSTEM-LAYERS: a
     // controller must not own selection rules); the `requires` step restores a rule the retired curated-intake builder enforced
     // and nothing live did (found when verify_ssot_consultation reported smart_tags.*.requires consulted by no live code).
     function toggleTagState(state, tid, wasSelected, DB) {
         const tag = (DB.smart_tags || {})[tid] || {};
         const mutuallyExclusive = tag.mutually_exclusive || [];
         if (wasSelected) {
             // DE-SELECT: remove from all active sets; the user removed it -> neutral state (no negation) -- EXCEPT a tag that another active tag
             // REQUIRES: it cannot go neutral (closeTagsOverRequires would derive it straight back), so the customer's deselect is recorded as an
             // explicit negation, which beats the implication.
             const stillRequired = closeTagsOverRequires([...state.manTagIds, ...state.detTagIds].filter(x => x !== tid), [], DB).includes(tid);
             state.manTagIds = state.manTagIds.filter(x => x !== tid);
             state.detTagIds = state.detTagIds.filter(x => x !== tid);
             state.userTagIds = (state.userTagIds || []).filter(x => x !== tid);
             if (stillRequired && !state.negatedTagIds.includes(tid)) state.negatedTagIds.push(tid);
             return;
         }
         // SELECT: the user is explicitly choosing this tag.
         state.negatedTagIds = state.negatedTagIds.filter(x => x !== tid);
         mutuallyExclusive.forEach(sibId => {
             state.manTagIds = state.manTagIds.filter(x => x !== sibId);
             state.detTagIds = state.detTagIds.filter(x => x !== sibId);
             state.userTagIds = (state.userTagIds || []).filter(x => x !== sibId);
             state.negatedTagIds = state.negatedTagIds.filter(x => x !== sibId);
         });
         if (!state.manTagIds.includes(tid)) state.manTagIds.push(tid);
         if (!(state.userTagIds || []).includes(tid)) {
             state.userTagIds = state.userTagIds || [];
             state.userTagIds.push(tid); // explicit user tap -> 100% confidence
         }
         requiredTagIdsFor(tid, DB).forEach(req => {
             if (state.manTagIds.includes(req) || state.detTagIds.includes(req)) return;
             state.manTagIds.push(req);
             if (!(state.userTagIds || []).includes(req)) state.userTagIds.push(req);
         });
     }

     // buildServiceSessionSeed -- LOGIC. The initial session state for a service the customer chose by name:
     // intent, service type, description, the service's own default tags (as inherent facts) and the dynamic-service
     // enrichment (fallback base price, checkout state, suggested-tag hints). Pure: everything arrives as an argument and
     // the new state is RETURNED; the controller installs it (S = ...). Moved out of prefillSmartQuoteFromService (Glue,
     // R-SYSTEM-LAYERS: a controller must not derive pricing/resolution), text preserved. A dead no-op block that iterated
     // the always-empty detTagIds was dropped rather than moved.
     function buildServiceSessionSeed(svc, category_id, preservedDynamicRule, categoryMap, DB) {
         const catObj = categoryMap.get(category_id);
         const catName = catObj ? (catObj.display_name || catObj.name || category_id) : category_id;
         const seed = {
             qty: 1,
             intent: {
                 category: category_id,
                 label: svc.ui_taxonomy?.display_name || catName,
                 group: svc.ui_taxonomy?.display_name || svc.id,
                 base: svc.financial_engine?.base_price ?? 70, // NOTE: hard-coded default carried over unchanged -- a business number in code (R-SYSTEM-NODATA); the SSOT should own it
                 stype: (svc.service_type || 'Repair').replace('Install / Mount', 'Install').replace('Install/Mount', 'Install'),
                 qtyLabel: 'item',
                 key: svc.id,
                 _groupId: svc.ui_taxonomy?.group_id || null,
                 _pricingType: svc.financial_engine?.pricing_type || null,
                 dynamic_rule: preservedDynamicRule
             },
             stype: (svc.service_type || 'Repair').replace('Install / Mount', 'Install').replace('Install/Mount', 'Install'),
             desc: svc.ui_taxonomy?.display_name || svc.id,
             detTagIds: [],
             manTagIds: [],
             negatedTagIds: [],
             // inherentTagIds: default_tags from the service definition.
             // These are SERVICE FACTS, not user-detected context -- they must
             // NOT go into detTagIds which drives the "We understood from your
             // text" banner. Kept separate so pricing still applies them.
             inherentTagIds: [],
             adlibConfirmed: false
         };

         // Seed default_tags into inherentTagIds (not detTagIds)
         (svc.default_tags || []).forEach(tagRef => {
             const tid = (typeof tagRef === 'object' && tagRef.$ref) ? tagRef.$ref : tagRef;
             if (typeof tid === 'string' && tid.startsWith('#') && !seed.negatedTagIds.includes(tid))
                 seed.inherentTagIds.push(tid);
         });

         // SSOT: dynamic_services — enrich base price and suggested_tags if service lacks them
         const normStPrefill = (svc.service_type || 'Repair').replace('Install / Mount', 'Install');
         const dynDefPrefill = resolveDynamicService(category_id, normStPrefill, svc.ui_taxonomy?.group_id);
         if (dynDefPrefill) {
             // Use dynamic base price if service base price is 0 or missing
             if (!seed.intent.base && dynDefPrefill.financial_engine?.base_price) {
                 seed.intent.base = dynDefPrefill.financial_engine.base_price;
             }
             // T150: the checkout-state seed that lived here wrote a field nothing read (see resolveServiceCheckoutStateKey); deleted.
             // suggested_tags: store as hints only — NOT pre-selected
             if (dynDefPrefill.suggested_tags) {
                 seed._suggestedTagIds = seed._suggestedTagIds || [];
                 dynDefPrefill.suggested_tags.forEach(tagObj => {
                     if (!tagObj || typeof tagObj !== 'object') return;
                     const segments = tagObj?.$ref ? tagObj.$ref.replace(/^#\//, '').split('/') : null;
                     const tagId = segments ? '#' + segments[segments.length - 1].replace('#', '') : null;
                     if (tagId && DB.smart_tags?.[tagId] && !seed._suggestedTagIds.includes(tagId))
                         seed._suggestedTagIds.push(tagId);
                 });
             }
         }
         return seed;
     }

     function legacyDetermineSelfQuoting(svc) {
         // Matches orchestrator's orch_compute_variability_flags exactly:
         // item_count_template WITHOUT bypass_intake goes to curated_card, not self_quote.
         const om = svc.operational_metrics || {};
         const chain = svc.intake_chain || [];
         const QTY_MODS_UNCONDITIONAL = (typeof _GENERIC_QTY_MODULE_KEYS !== 'undefined') ? _GENERIC_QTY_MODULE_KEYS : new Set(['item_count', 'count', 'hybrid_qty', 'global_quantity']);
         const bypassIntake = !!svc.behavior?.bypass_intake;
         const isQtyMod = (m) => QTY_MODS_UNCONDITIONAL.has(m.module) ||
             (m.module === 'item_count_template' && bypassIntake);
         const chainIsQtyOnly = chain.length === 0 || chain.every(isQtyMod);
         const hasPricingData = (om.expected_minutes > 0) && om.complexity_tier && (svc.financial_engine?.base_price > 0);
         // v9.6 FIX: was a direct read (`.includes(svc.financial_engine?.checkout_state)`)
         // -- would incorrectly return false for an archetype-inheriting service
         // (real value standard_flat_rate, but undefined on the raw field), wrongly
         // disqualifying it from self-quote eligibility.
         const isFlatCheckout = ['standard_flat_rate', 'database_summation'].includes(resolveServiceCheckoutStateKey(svc, null).key);
         return hasPricingData && isFlatCheckout && chainIsQtyOnly;
     }

     // v9.6 FIX: getServicePriceRange removed. Re-confirmed today (not
     // assumed from the old backlog note alone) that both original deletion
     // criteria still hold: zero real call sites anywhere (qr.html, every
     // test_harness file, both standalone modules), and it referenced
     // schema fields that don't exist on any of the 74 real services
     // (default_estimates.total, a top-level svc.base_price -- the real
     // field is financial_engine.base_price) -- meaning it would have
     // returned {min:0, max:0} unconditionally for every service, always,
     // had anything ever called it. The original deletion (BACKLOG_CONSOLIDATED.md,
     // Section H) apparently didn't stick, or was reverted by a later,
     // uncoordinated change (e.g. a stale qr.html snapshot re-syncing over
     // the deletion) -- re-deleted here per the same, independently
     // re-verified reasoning, not just trusting the old record.

     function formatServicePrice(svc) {
         // 1. Look inside ui_taxonomy for the presentation rules
         const strategy = svc.ui_taxonomy?.presentation_strategy || {
             display_enabled: true,
             buffer_label: "Average",
             calculation_basis: "base_plus_tags"
         };

         if (strategy.display_enabled === false) return 'Call for Quote';

         // 2. Extract base price safely
         let displayTotal = svc.financial_engine?.base_price || 0;

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
             // Charter ("Chips Are Not Pricing Factors"): a chip never adds to a displayed total.
         }

         // 4. Render exact string
         const isHourly = svc.pricing_engine === 'hourly_estimate' || svc.financial_engine?.type === 'hourly' || svc.financial_engine?.pricing_type === 'hourly' || svc.pricing?.type === 'hourly';
         const isAssembly = svc.pricing_engine === 'assembly_formula';
         if (displayTotal > 0) {
             let suffix = (isHourly || isAssembly) ? '/hr' : '';
             let prefixHtml = strategy.buffer_label ? `<span class="price-prefix">${strategy.buffer_label}</span> ` : '';
             return `${prefixHtml}$${displayTotal}${suffix}`;
         }

         // Hourly/assembly services with base_price=0: show tier rate instead of 'Call'
         if (isHourly || isAssembly) {
             const tiers = DB?.global_rules?.complexity_tiers || {};
             const tier = svc.operational_metrics?.complexity_tier || 'skilled';
             const rate = tiers[tier]?.hourly_rate;
             if (rate) return `from $${rate}/hr`;
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
             let merged = {
                 moduleKey,
                 then: thenMap || {},
                 ...mod
             };
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
             // T136: a raw "{item_noun}" must never reach a client. Services that
             // don't supply params.item_noun (dynamic entities) get the SSOT's
             // neutral noun, not the template token.
             if (typeof merged.question === 'string' && merged.question.includes('{item_noun}')) {
                 merged.question = merged.question.split('{item_noun}').join(SERVICE_DATA.ui_config?.default_item_noun || 'items');
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

     // v9.6: passive tag -> intake answer merge/skip. Confirmed via direct
     // design intent from the project owner: smart_tags are a passive,
     // real-time NLP confirmation layer (the "adlib" sentence) that were
     // never meant to require interaction -- but leaving the corresponding
     // intake question to be asked anyway, when a tag has already, clearly
     // identified the answer, is needless friction. This closes that gap.
     //
     // Mutates S.answers DIRECTLY (not a local, temporary merged view):
     // confirmed directly that computeQuoteFromState -- which feeds the
     // real, charged sqAddToCart price -- reads S.answers directly, bypassing
     // any merge kept local to the preview-only render() function. A
     // local-only merge would create exactly the "preview shows one price,
     // real charge shows another" class of bug this file has a documented
     // history of finding and fixing (see the v9.5.8 FIX comment above
     // computeUnifiedQuote's call site in the intake card's render()).
     //
     // Tracks exactly which S.answers[moduleKey] entries it set, in
     // S._tagSynthesizedModules ({moduleKey: tagId}), so:
     //   - a real, explicit customer answer is NEVER overwritten (only a
     //     module key that is either unset, or was itself tag-synthesized,
     //     is touched)
     //   - removing or negating the responsible tag cleanly REVERSES the
     //     synthesis (deletes the answer, so the question reappears,
     //     un-answered) -- since every tag-removal handler in this file
     //     already calls render() right after mutating the tag arrays,
     //     this reversal happens automatically on the next call, with zero
     //     new bookkeeping needed in those handlers
     //   - two different active tags conflicting on the same module (e.g.
     //     one implying "Drywall", another "Brick or concrete") is resolved
     //     safely: neither wins, the module falls back to being asked
     //     normally, rather than guessing which tag is "more right"
     function syncTagSynthesizedAnswers(state) {
         state.answers = state.answers || {};
         state._tagSynthesizedModules = state._tagSynthesizedModules || {};
         // v9.6 FIX: real, confirmed, money-affecting bug -- this previously
         // omitted state.inherentTagIds (a service's own default_tags, seeded as
         // "service facts" per this file's own design comment at
         // state.inherentTagIds's seeding site: "pricing still applies them").
         // Confirmed directly: brick_or_concrete_crack_repair's inherent
         // #brick_wall tag carries a real $25 wall_type_brick_or_concrete
         // modifier fee via its own answers field, but since this service's
         // intake_chain never asks wall_type directly, and this function
         // never considered inherentTagIds, that fee silently never applied
         // -- every real booking of this service was undercharged by $25.
         // Included unconditionally (not gated), matching how
         // computeQuoteFromState already, correctly treats inherentTagIds
         // as always-chargeable, never negatable the way detTagIds are.
         // The tags in force include what the SSOT's `requires` relations imply (closeTagsOverRequires), so a derived tag synthesizes its answer
         // too (a virus implies a computer: the device question is retired, not asked). The customer's explicit negations still win.
         const active = closeTagsOverRequires([...(state.detTagIds || []), ...(state.manTagIds || []), ...(state.inherentTagIds || [])], state.negatedTagIds, DB);
         // The rules above live in ONE pure function (synthesizeAnswersFromTags), shared with the orchestrator, so a tag is worth the same on every entry path
         // (R-CLIENT-CONVERGE). This adapter applies its result to the session state IN PLACE, because other code holds these two objects.
         const r = synthesizeAnswersFromTags(active, state.answers, state._tagSynthesizedModules, DB);
         for (const k of Object.keys(state.answers)) if (!(k in r.answers)) delete state.answers[k];
         Object.assign(state.answers, r.answers);
         for (const k of Object.keys(state._tagSynthesizedModules)) if (!(k in r.synthesized)) delete state._tagSynthesizedModules[k];
         Object.assign(state._tagSynthesizedModules, r.synthesized);
     }

     // synthesizeAnswersFromTags -- LOGIC. The pure core of tag-to-answer synthesis (the rules are documented above syncTagSynthesizedAnswers): given the tags in
     // force, the answers so far and the record of which module each tag synthesized ({moduleKey: tagId}), returns { answers, synthesized } as NEW objects --
     // nothing it is handed is mutated. A real customer answer is never overwritten; removing or negating the responsible tag reverses its synthesis (the question
     // reappears); two active tags that disagree on a module leave it unanswered; a tag naming a module that does not exist is skipped silently.
     function synthesizeAnswersFromTags(activeTagIds, answers, synthesized, DB) {
         const out = Object.assign({}, answers || {}), syn = Object.assign({}, synthesized || {});
         const smartTags = DB.smart_tags || {};
         // What every currently-active tag wants to synthesize this pass.
         const wants = {}; // moduleKey -> [{tid, label}, ...]
         (activeTagIds || []).forEach(tid => {
             const tagAnswers = smartTags[tid]?.answers;
             if (!tagAnswers) return;
             for (const [moduleKey, label] of Object.entries(tagAnswers)) {
                 if (!DB.intake_modules?.[moduleKey]) continue; // no real module -- skip silently, not a guess
                 (wants[moduleKey] = wants[moduleKey] || []).push({ tid, label });
             }
         });
         // Reverse a synthesis whose tag is no longer active -- but ONLY while the answer is still the tag's own: if the customer has since overridden it, the
         // value no longer matches what the tag authored, so it is theirs now (never deleted) and the module simply stops being recorded as synthesized.
         for (const moduleKey of Object.keys(syn)) {
             const tid = syn[moduleKey];
             const stillWanted = (wants[moduleKey] || []).some(w => w.tid === tid);
             const stillTheTagsOwn = out[moduleKey] === smartTags[tid]?.answers?.[moduleKey];
             if (!stillWanted || !stillTheTagsOwn) {
                 if (!stillWanted && stillTheTagsOwn) delete out[moduleKey];
                 delete syn[moduleKey];
             }
         }
         for (const [moduleKey, wanters] of Object.entries(wants)) {
             const uniqueLabels = new Set(wanters.map(w => w.label));
             const currentlySynthesizedBy = syn[moduleKey];
             const alreadyExplicit = moduleKey in out && !currentlySynthesizedBy;
             if (alreadyExplicit) continue; // real customer answer -- never touch it
             if (uniqueLabels.size > 1) { // conflicting tags: neither wins, the module falls back to being asked
                 if (currentlySynthesizedBy) { delete out[moduleKey]; delete syn[moduleKey]; }
                 continue;
             }
             const { tid, label } = wanters[0];
             out[moduleKey] = label;
             syn[moduleKey] = tid;
         }
         return { answers: out, synthesized: syn };
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

     function tagValidForCategory(tid, cat, groupId, serviceId = null) {
         // SSOT: reads applicable_categories + applicable_group_ids from btnyc.json
         //
         // Three-tier scoping, all read from the tag's own data:
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
         //   3. excluded_service_ids — the most specific, optional layer:
         //      an EXCLUSION (not an inclusion) list of individual service
         //      IDs this tag should never match, even though the service's
         //      own category/group would otherwise make it eligible. Real
         //      groups often mix services that genuinely differ in scale
         //      (a group's Other tile or a specific named service like a
         //      simple under-cabinet light install vs. a large chandelier,
         //      both in the same Light Fixtures group) -- most services in
         //      a matching group should still naturally inherit that
         //      group's applicability, so this is deliberately an
         //      exclusion list, not a per-service inclusion list that would
         //      require enumerating every service that should match.
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
             if (!groupId || !gids.includes(groupId)) return false;
         }
         // Most specific layer: a real, individually-verified exclusion
         // for this exact service, regardless of category/group match.
         const excluded = tag.excluded_service_ids;
         if (excluded && excluded.length > 0 && serviceId && excluded.includes(serviceId)) {
             return false;
         }
         return true;
     }

     function isDiagnosticService(fe, csKey) {
         // T150: takes the RESOLVED checkout-state key (resolveServiceCheckoutStateKey for an entity, the quote's own key for a quote), not the entity. It used to take an
         // optional svc and fall back to a raw read of fe.checkout_state: two modes in one signature, one of which could not see archetype inheritance.
         return (csKey === 'diagnostic') || (fe?.pricing_type === 'Diagnostic');
     }

     function isLogisticTag(tid) {
         return !!(window.DB?.smart_tags?.[tid]?.is_logistic);
     }

     function sqTagLabel(t, tid) {
         // SSOT: ui_phrase is the intended human-readable chip label —
         // all 44 smart_tags have it (e.g. 'on a drywall wall', 'that is
         // clogged') while label/display_name are never populated (0/44).
         // Without this check every chip showed the raw slug fallback.
         if (!t) return tid ? tid.replace('#', '').replace(/_/g, ' ') : '';
         return t.ui_phrase || t.label || t.display_name || tid.replace('#', '').replace(/_/g, ' ');
     }

     function sqTagFeeImpact(tid) {
         // T118 (Step 6 item 10, per PENDING_DECISIONS.md #26): a
         // tag's real fee impact can no longer be read from its own
         // `effects.fee` for most tags -- confirmed directly, not
         // assumed: the v9.5 migration retired fee/minutes from
         // individual smart_tags in favor of applying them through
         // the module-answer mechanism instead (each tag's own
         // `answers` field names which module/label it synthesizes,
         // e.g. #access_obstructed -> { access: 'Very cramped or
         // hard to reach' }). Traces from the tag's own source
         // definition through to the real modifier fee, rather than
         // trying to correlate an already-computed feeBreakdown
         // entry back to a specific tag id after the fact (multiple
         // tags can point at the same module/answer, and a
         // feeBreakdown entry doesn't retain which tag, if any,
         // produced it once merged with directly-answered
         // questions).
         const tag = DB.smart_tags?.[tid];
         if (!tag || !tag.answers) return 0;
         let total = 0;
         for (const [moduleKey, label] of Object.entries(tag.answers)) {
             const resp = (DB.intake_modules?.[moduleKey]?.client_response || []).find(r => r.label === label);
             const mod = resp?.modifier_ref ? DB.global_rules?.modifiers?.[resp.modifier_ref] : null;
             total += mod?.fee || 0;
         }
         return total;
     }

     function mathFurnitureAssembly(items) {
         if (!items.length) return {
             hours: 0,
             price: 0,
             minutes: 0
         };
         // T135+ REWRITTEN (PRICING_GUIDE section 5.4/10.2 B1/B2/P1/P2,
         // direct business input; fixes confirmed live bugs B1 and B2).
         // B1: meta.global_rates.standard_labor was missing (removed in
         // the v9.4 restructuring, never removed from this reference),
         // silently falling through to a hardcoded $65/hr -- fixed by
         // re-adding the rate (see meta.global_rates._note).
         // B2: this function used to ADD flatFeeTotal on top of
         // hours × rate. But furniture_catalog[].flat_fee already IS
         // the labor cost at the correct rate -- a 60-minute Bed Frame's
         // authored flat_fee: 40 is exactly 1hr × $40/hr, not a separate
         // charge. Adding both double-counted labor on every item
         // (confirmed live: a single 60-min Bed Frame priced at $105
         // against its own catalog's authored $40). Fixed by using only
         // the minutes-based calculation, with a $40 minimum -- flat_fee
         // itself is no longer summed into the price at all.
         const minutesArr = items.map(it => (typeof it === 'number') ? it : (it.minutes || 0));
         const totalMinutes = minutesArr.reduce((a, b) => a + b, 0);
         const rate = SERVICE_DATA?.meta?.global_rates?.standard_labor || 40;
         const rawPrice = (totalMinutes / 60) * rate;
         const price = Math.max(rate, rawPrice); // $40 minimum, matching the 1-hour-minimum job floor
         const hours = totalMinutes / 60;
         const rounded = Math.round(hours * 100) / 100;
         return {
             hours: rounded,
             price: Math.round(price * 100) / 100,
             minutes: totalMinutes
         };
     }
function resolveServiceCheckoutStateKey(svc, dynDef) {
    // v9.6 Track A Phase 2 (financial_engine): the canonical, single
    // place to determine which real checkout_state key an entity
    // uses -- mirrors resolveBaseConfidenceStrategy's own precedence
    // (real, explicit value > entity's real archetype default >
    // generic fallback), built BEFORE any data migration, exactly
    // matching the confidence_strategy discipline (verify the
    // resolution logic is a true no-op first, migrate data second).
    // Built only after finding 6 real, distinct call sites reading
    // svc.financial_engine.checkout_state directly, several with
    // fallback logic that would have broken silently for a
    // migrated, archetype-inheriting service (e.g. an exact
    // `=== 'standard_flat_rate'` filter would incorrectly exclude
    // an inherited value it can no longer see).
    // T150 (R-INVARIANT-PROVENANCE): returns { key, source } -- the key AND the rung of the precedence that supplied it:
    //   service_override > archetype_default > dynamic_engine (the dynamic entry's own state, or its operational_metrics') > fallback  -- the Charter's R-INVARIANT-PROVENANCE vocabulary.
    // EVERY reader of an entity's checkout state asks here. None re-derives the precedence or reads financial_engine.checkout_state itself (the
    // direct reads were exactly the "broken silently for an archetype-inheriting service" failure described above: 69 of 76 services inherit).
    const groupId = svc?.ui_taxonomy?.group_id;
    let archetypeDefault = null;
    if (groupId && window.DB?.archetypes) {
        for (const arch of Object.values(window.DB.archetypes)) {
            if (arch.member_group_ids?.includes(groupId)) {
                archetypeDefault = arch.default_checkout_state;
                break;
            }
        }
    }
    if (svc && svc.financial_engine?.checkout_state) return { key: svc.financial_engine.checkout_state, source: 'service_override' };
    if (archetypeDefault) return { key: archetypeDefault, source: 'archetype_default' };
    if (dynDef && dynDef.financial_engine?.checkout_state) return { key: dynDef.financial_engine.checkout_state, source: 'dynamic_engine' };
    if (dynDef && dynDef.operational_metrics?.checkout_state) return { key: dynDef.operational_metrics.checkout_state, source: 'dynamic_engine' };
    return { key: 'standard_flat_rate', source: 'fallback' };
}

// T150: renamed from resolveCheckoutState. It never decided WHICH state applies (resolveServiceCheckoutStateKey does that); it turns an already-resolved key into the presentation
// model (button text, disclaimer, flags): a view-model builder, named like buildQuotePanelModel.
function buildCheckoutStateModel(checkoutStateKey, laborTotal, svc) {
    const cs = DB.checkout_states?.[checkoutStateKey] || {};
    const discs = DB.meta?.estimate_disclaimers || {};
    const isDiag = checkoutStateKey === 'diagnostic';
    const isProject = checkoutStateKey === 'project_based';
    const btnKey = cs.hide_materials ? 'button_text_no_mat' : 'button_text_with_mat';
    let btnText = cs[btnKey] || cs.button_text || 'Add to Request';

    // Guard against a missing/NaN laborTotal -- without this, the
    // ${labor_total} placeholder below renders literally as
    // "$undefined" in the button text. The `|| 'Add to Request'`
    // fallback above only protects against a missing *template*,
    // not a missing *value*.
    const laborStr = (laborTotal == null || isNaN(laborTotal)) ? '' : '$' + laborTotal;
    // Global regex, not a string pattern -- String.replace with a
    // string only replaces the FIRST occurrence, so a template with
    // two ${labor_total} placeholders would leave the second literal.
    btnText = btnText.replace(/\$\{labor_total\}/g, laborStr);

    // An explicit param with NO default: a Logic function must not read the global session state (R-SYSTEM-LAYERS).
    // The caller (the quote view-model builder) passes state._svc; two calls with identical args now always agree.
    const svcDiscKey = svc?.default_estimates?.disclaimer || null;

    // Note: the original ternary here was `isDiag ? 'flat_fee' : isProject ? 'project_based' : 'flat_fee'`,
    // which collapses -- both the isDiag branch and the else return
    // 'flat_fee'. Simplified below, but if diagnostic was SUPPOSED to
    // map to a distinct disclaimer key, that intent is being silently
    // lost and this line is the place to fix it.
    const discKey = svcDiscKey || (isProject ? 'project_based' : 'flat_fee');

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

// T135: hoisted to module scope (was previously declared inside
// computeUnifiedQuote alone) so computeArchetypeQuote can reference the
// exact same set, rather than maintaining its own separate, hardcoded
// copy that had already drifted out of sync -- see the T135 comment at
// computeArchetypeQuote's own qty-multiplier line for the full story of
// what that drift caused.
const QTY_AWARE_FORMULAS = new Set(['furniture_repair_formula', 'tile_repair_formula', 'hardware_install_formula', 'buy_the_hour_qty_gate_formula']);

function computeUnifiedQuote(ctx) {
    const {
        svc,
        dynDef,
        activeTagIds: _rawActiveTagIds = [],
        answers = {},
        qty: requestedQty = 1,
        intentKeyword = null,
        formulaId = null,
        ctxAdjFee = 0,
        ctxAdjMin = 0,
        enrichment = null
    } = ctx;
    // Quantity stance (PENDING_DECISIONS #76 item 2): a SINGLE-UNIT service prices ONE unit whatever quantity the customer's words or a stepper imply -- two of them are two
    // bookings, and the card says so. Defined here, once, so the state path and the orchestrator cannot disagree about it (R-CLIENT-CONVERGE).
    const _qtyUnits = resolveQuantityUnits({ entity: svc || dynDef, entityType: svc ? 'service' : 'dynamic', requestedQty });
    const qty = _qtyUnits.units;
         // v9.6 FIX: an explicit intake answer should supersede an earlier,
         // NLP-detected tag that contradicts it (e.g. NLP detecting
         // #emergency from free-text like "urgent, need this asap", then
         // the customer explicitly answering the urgency question with
         // "Whenever works -- no rush"). Confirmed via direct trace: the
         // contradictory "urgent / same-day" label kept showing to the
         // customer even after they explicitly said no rush -- the tag
         // was never cleared, just silently accumulated. For every
         // answered module, remove any currently-active tag that belongs
         // to that module's own concept space (i.e. some OTHER answer of
         // this same module could have produced it) but isn't part of the
         // answer actually chosen. A pure computation, not a mutation of S.
         const activeTagIds = (() => {
             const mods = DB.intake_modules || {};
             let cleaned = _rawActiveTagIds;
             for (const [moduleKey, answerLabel] of Object.entries(answers)) {
                 const mod = mods[moduleKey];
                 if (!mod || !Array.isArray(mod.client_response)) continue;
                 const moduleOwnedTags = new Set();
                 mod.client_response.forEach(r => (r.tags || []).forEach(t => moduleOwnedTags.add(t)));
                 if (moduleOwnedTags.size === 0) continue;
                 const chosen = mod.client_response.find(r => r.label === answerLabel);
                 const chosenTags = new Set(chosen?.tags || []);
                 cleaned = cleaned.filter(tid => !moduleOwnedTags.has(tid) || chosenTags.has(tid));
             }
             return cleaned;
         })();
         const smartTags = DB.smart_tags || {};
         const surcharges = DB.global_rules?.surcharges || {};
         // v9.5: dispatch_fee_enabled toggle in global_rules.surcharges.
         // When false: dispatch fee is $0 globally.
         // dispatch_fee_apply_min_labor: if set, dispatch fee only applies
         // when labor < this threshold (e.g. "only for small jobs under $50").
         // This allows the fee to function as a minimum-visit charge without
         // burdening larger jobs with a visible surcharge line.
         // Business decision on threshold deferred -- toggle is live now.
         const dispatchEnabled = surcharges.dispatch_fee_enabled !== false; // default true
         const dispatchFeeRaw = surcharges.dispatch_fee || 45;
         const dispatchFee = dispatchEnabled ? dispatchFeeRaw : 0;

         // v9.5 GAP 2 FIX: route entities with financial_engine.pricing_archetype
         // through computeArchetypeQuote. Previously this field was authored on
         // entities (cabinet_knob_or_pull_install: tiered_per_unit, etc.) but
         // computeUnifiedQuote ignored it completely and ran its own parallel
         // logic. This wires the compiler's pricing_archetype concept into the
         // actual runtime: if an entity carries the field, the dedicated
         // calculator handles the core labor/time computation, and the result
         // flows into the existing downstream logic unchanged (tag fees,
         // checkout_state, dispatchFee, materials). Falls through to the
         // original logic for entities without the field -- zero regression risk.
         const _entity = svc || dynDef;
         const _pricingArchetype = _entity?.financial_engine?.pricing_archetype;
         let _archetypeResult = null;
         if (_pricingArchetype && typeof computeArchetypeQuote === 'function') {
             const _fId = formulaId || _entity?.pricing_engine || null;
             _archetypeResult = computeArchetypeQuote(_entity, _pricingArchetype, answers, qty, DB, _fId);
         }

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
         const pricingType = (fe.type || fe.pricing_type || '').toLowerCase();

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
         // v9.6 FIX: this resolution chain already correctly falls
         // back to a per-answer formula_override (below), but never
         // consulted the entity's own, static, always-true
         // pricing_engine declaration -- exactly mirroring the SAME
         // fallback _fId already, correctly uses at this function's
         // own line ~57 to feed computeArchetypeQuote. That earlier
         // fallback only benefits archetypes 'tiered_per_unit'/
         // 'formula' (the only two whose archetype result is ever
         // used downstream -- see "GAP 2 FIX completion" below).
         // For a service classified under a GENERIC archetype
         // (hourly_timed/flat_simple/diagnostic_open) that ALSO
         // carries a real, bespoke pricing_engine (confirmed via a
         // complete catalog sweep: exactly 2 services --
         // cabinet_knob_or_pull_install, pax_wardrobe_assembly),
         // this outer resolution is the one that's actually
         // authoritative -- and it silently never found the
         // formula, since neither an NLP-derived formulaId nor a
         // per-answer override applies to a directly-tapped
         // catalog service. Confirmed via direct, empirical test:
         // this is the exact, complete root cause of a real,
         // severe, live overcharge (cabinet_knob_or_pull_install,
         // qty 5: $1375 shown, $140 correct per the formula's own
         // documented Tier-1 flat price -- nearly 10x) and of the
         // install_type answer (swap vs. new-holes) producing zero
         // price difference, since the formula that actually reads
         // that answer never ran at all.
         let effectiveFormulaId = formulaId || _entity?.pricing_engine || null;
         let formulaTriggeredByModuleKey = null;
         if (!effectiveFormulaId || !DB.pricing_formulas?.[effectiveFormulaId]) {
             for (const [moduleKey, answerLabel] of Object.entries(answers)) {
                 // Check the per-service override first (e.g. item_count_template's
                 // params.client_response, which is what the customer actually
                 // saw and answered) -- falls back to the generic, shared
                 // intake_modules[moduleKey] definition if no per-service
                 // override exists for this module.
                 const step = (svc?.intake_chain || []).find(s => s.module === moduleKey);
                 const overrideResponses = step?.params?.client_response;
                 const mod = DB.intake_modules?.[moduleKey];
                 const chosen = (overrideResponses || mod?.client_response || []).find(r => r.label === answerLabel);
                 const fov = chosen?.formula_override;
                 if (fov && DB.pricing_formulas?.[fov]) {
                     effectiveFormulaId = fov;
                     formulaTriggeredByModuleKey = moduleKey;
                     break;
                 }
             }
         }
         // SSOT: formulaId is now passed in explicitly via ctx (caller resolves
         // it from S.intent.dynamic_rule — the only place a pricing_formula_id
         // actually lives in real data; no services[] entry has ever carried a
         // pricing_formula_id or an .intent sub-object, so the previous
         // svc?.pricing_formula_id || svc?.intent?.dynamic_rule lookup could
         // never resolve to anything and this branch was silently dead).
         const formulaResult = effectiveFormulaId ? applyPricingFormula(effectiveFormulaId, answers, qty, svc) : null;


         let extraFee = 0,
             extraMin = 0;
         // T118 #29 FIX: extraFee (above) is now specifically the PER-UNIT
         // fee bucket -- everything that should scale with quantity (frame
         // demo, per-door labor, material-condition modifiers). perVisitFee
         // is the NEW, separate bucket for costs that are logically one-time
         // regardless of how many units are worked on in the same visit
         // (access, urgency, parking, disposal, pets, item_volume -- exactly
         // the six modules PENDING_DECISIONS.md #29 named). Populated below,
         // in the one place these six are ever actually priced (the generic
         // answer -> modifier_ref loop; confirmed directly via
         // FORCE_INJECTION_AUDIT.md's own code trace that no other extraFee
         // += site anywhere in this function can produce one of these six).
         // Added to the final laborEstimate OUTSIDE the qtyMultiplier
         // instead of inside it -- see that formula, below, for the fix
         // itself.
         let perVisitFee = 0;
         const activeLabels = [];
         const feeBreakdown = [];

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
         if (ctxAdjFee) feeBreakdown.push({
             source: 'contextual_override',
             label: 'Context-specific adjustment',
             fee: ctxAdjFee
         });

         if (formulaResult) {
             extraFee += formulaResult.extraFee;
             extraMin += formulaResult.extraMin;
             if (formulaResult.extraFee) feeBreakdown.push({
                 source: 'formula',
                 label: 'Pricing formula adjustment',
                 fee: formulaResult.extraFee
             });
         } else {
             for (const tid of activeTagIds) {
                 const t = smartTags[tid];
                 if (!t) continue;
                 // Charter ("Chips Are Not Pricing Factors"): a chip contributes its LABEL -- what the
                 // client affirmed -- and nothing else. Fees and minutes come from ANSWERS (a tag's own
                 // `answers` map is synthesized into real answers upstream), never from the chip.
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
         const RANK = {
             skilled: 1,
             specialized: 2
         };
         let answerOverrideTier = null;
         // v9.3 architecture (backlog — see CHANGELOG_v9.3.md): same
         // ratchet pattern as answerOverrideTier above, for
         // checkout_state_override instead of complexity_override. Lets a
         // SPECIFIC answer (e.g. an appliance symptom that's genuinely
         // ambiguous, like "turns on, spins briefly, then shuts off") force
         // checkoutStateKey to 'diagnostic' independently of the service's
         // static financial_engine.checkout_state — instead of today's
         // all-or-nothing service-level flag that applies regardless of
         // which answer was actually chosen. v9.5.4 CORRECTION: the "16 of
         // 69 named services" figure above was stale and has been for some
         // time -- confirmed directly against computeUnifiedQuote (not
         // just the raw financial_engine.checkout_state field) that only 1
         // named service (dishwasher_repair) plus 24 dynamic_services
         // "Diagnostic" entries are currently unconditionally 'diagnostic'
         // as of v9.5 (25 total, not 16 -- see CHANGELOG_v9_5 for the
         // verified count). No client_response anywhere sets this field
         // yet — authoring real per-answer overrides for those 25 entities,
         // and giving the appliance/plumbing/tech-specific ones
         // category-appropriate (not generically shared) symptom options
         // in the first place, remains the deferred detailed work -- see
         // CHANGELOG_v9_5's "checkout_state_override" section for why this
         // is deliberately not done blind.
         let answerCheckoutOverride = null;
         const CS_RESTRICTIVENESS = {
             standard_flat_rate: 0,
             project_based: 1,
             database_summation: 1,
             diagnostic: 2
         };
         // v9.6 FIX: a real, confirmed, severe bug found via direct,
         // empirical testing prompted by a real screenshot (T98/T99) --
         // this guard was `if (!formulaResult)`, which is correct in
         // INTENT (per the comment above: don't double-count the ONE
         // answer a formula already consumed directly, e.g.
         // furniture_repair_formula reading answers.issue itself) but
         // wrong in SCOPE -- it silently skipped this ENTIRE loop for
         // EVERY answer whenever ANY formula was active, not just the
         // one answer that actually triggered it. Confirmed directly:
         // wall_hole_or_crack_repair with "4 or more areas" selected
         // (which carries item_count_overflow_formula's own
         // formula_override) silently dropped all 5 of its OTHER, real,
         // unrelated answers' modifiers (wall_type, dmg_size,
         // mounting_height, access, urgency -- $175 of real, confirmed
         // fee alone) versus selecting "1 area" (no formula_override),
         // which correctly applies all 5. This affects every service in
         // the catalog where a formula-override answer can be combined
         // with other, real modifier-driving answers -- not isolated to
         // this one case. Fixed narrowly, preserving the original,
         // correct intent: skip only the SPECIFIC moduleKey that
         // actually triggered the active formula (tracked above as
         // formulaTriggeredByModuleKey), not every answer.
         // v9.6 FIX (continued): a single triggering moduleKey isn't
         // enough to exclude -- some formulas (tile_repair_formula)
         // directly consume SEVERAL answers beyond the one that
         // carries their own formula_override (confirmed directly by
         // extracting each real formula's own code block and finding
         // every literal `answers.X` reference, not guessed). Without
         // this, fixing the original bug would have introduced a new,
         // real double-counting bug for exactly these formulas --
         // caught directly by this session's own existing regression
         // test for tile_repair_formula's earlier fix (T93), not
         // discovered by luck.
         const FORMULA_CONSUMED_KEYS = {
             drywall_repair_formula: ['area_sqft', 'texture_match'],
             furniture_repair_formula: ['issue'],
             tile_repair_formula: ['ceiling_height', 'disposal', 'grout_repair', 'tile_count', 'water_damage', 'waterproof_area'],
             hardware_install_formula: ['install_type', 'unit_count'],
             item_count_overflow_formula: ['__exact_count'],
         };
         const formulaConsumedKeys = new Set([
             formulaTriggeredByModuleKey,
             ...(effectiveFormulaId && FORMULA_CONSUMED_KEYS[effectiveFormulaId] || []),
         ].filter(Boolean));
         if (true) {
             const _mods = DB.global_rules?.modifiers || {};
             for (const [moduleKey, answerLabel] of Object.entries(answers)) {
                 const mod = DB.intake_modules?.[moduleKey];
                 if (!mod) continue;
                 // T135+ FIX (PRICING_GUIDE B4, confirmed systemic root
                 // cause across all 5 affected item_count_overflow
                 // services): this loop is what actually computes fees --
                 // it only ever read the generic, shared
                 // intake_modules[moduleKey].client_response, never the
                 // per-service step.params.client_response override the
                 // sibling formula-detection loop above already checks
                 // correctly. Any service customizing a parameterized
                 // module's own bands (item_count_template's documented
                 // mechanism) had its real, authored fees silently never
                 // applied -- confirmed live: cabinet_door_or_drawer_adjustment
                 // priced flat at $35 regardless of item count, its real
                 // $15/$30 per-band fees never reachable. Fixed by
                 // checking the per-service override first, matching the
                 // same pattern already correct elsewhere in this function.
                 const step = (svc?.intake_chain || []).find(s => s.module === moduleKey);
                 const overrideResponses = step?.params?.client_response;
                 const chosen = (overrideResponses || mod.client_response || []).find(r => r.label === answerLabel);
                 if (!chosen) continue;
                 // v9.6: fee/minutes resolve exclusively via modifier_ref ->
                 // global_rules.modifiers. complexity_override/checkout_state_override
                 // are top-level on the response object. This is the single,
                 // consistent shape across the entire SSOT (verified: zero
                 // remaining client_response entries anywhere use the old
                 // nested effects.{fee,minutes,complexity_override,
                 // checkout_state_override} pattern).
                 const m = chosen.modifier_ref ? (_mods[chosen.modifier_ref] || {}) : {};
                 // T135+ FIX (found via a direct test-validity audit, not
                 // assumed): fee accumulation and the complexity_override/
                 // checkout_state_override ratchet are orthogonal concerns.
                 // B4's fix correctly skips fee accumulation for
                 // formula-consumed keys (avoiding double-counting a fee
                 // the formula itself already prices in) -- but the
                 // original `continue` skipped BOTH, silently losing the
                 // override ratchet too. Confirmed live: once B11 bound
                 // furniture_repair_hourly to furniture_repair_formula
                 // (making 'issue' formula-consumed), its "Broken piece"
                 // answer's real, authored checkout_state_override:
                 // 'diagnostic' stopped firing entirely -- a real
                 // regression, not a stale test. Fee accumulation alone is
                 // now what's guarded; the ratchet below always runs.
                 if (!formulaConsumedKeys.has(moduleKey)) {
                     // T118 #29 FIX: was unconditionally `extraFee += m.fee || 0`
                     // -- every answer-driven fee, including access/urgency/
                     // parking/disposal/pets/item_volume, fed the SAME bucket
                     // that later gets multiplied by qty. Routes by the
                     // modifier's own new `scope` field instead. Defaults to
                     // 'per_unit' (extraFee) when scope is absent -- confirmed
                     // directly that every modifier in the current catalog now
                     // has an explicit scope (see the classification pass in
                     // TIMELINE.md's T118 Step 6 item 1 entry), so this default
                     // is a safety net for future data, not a live behavior for
                     // any modifier today.
                     if (m.scope === 'per_visit') {
                         perVisitFee += m.fee || 0;
                     } else {
                         extraFee += m.fee || 0;
                     }
                     extraMin += m.minutes || 0;
                     if (m.fee) feeBreakdown.push({
                         source: 'answer',
                         moduleKey,
                         label: (mod.question ? mod.question + ': ' : '') + answerLabel,
                         fee: m.fee,
                         scope: m.scope || 'per_unit'
                     });
                 }
                 const ov = chosen.complexity_override;
                 if (ov && (RANK[ov] || 0) > (RANK[answerOverrideTier] || 0)) {
                     answerOverrideTier = ov;
                 }
                 const cso = chosen.checkout_state_override;
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
         const baseMinutes = tm && tm.min != null && tm.max != null ?
             Math.round((tm.min + tm.max) / 2) :
             (svc?.operational_metrics?.expected_minutes ?? dynDef?.operational_metrics?.minimum_minutes ?? 45);
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
         // v9.6 FIX: a second, real, separate bug in the same family as
         // the formula_override fix above -- found via the same direct,
         // empirical process (reconciling this session's own test
         // against a real screenshot's real, displayed price). This was
         // `!!formulaResult`, correct in intent (per the comment below:
         // don't double-multiply a formula that already scales its own
         // minutes by qty internally) but wrong in scope -- true for ANY
         // active formula, not just the one formula that's actually
         // qty-aware. Confirmed directly by reading each real formula's
         // own code: only furniture_repair_formula genuinely, internally
         // accounts for qty>1 (`(qty - 1) * per_unit_minutes`); the other
         // 5, including item_count_overflow_formula, do not. This was
         // silently suppressing the real, outer qty multiplier (`(base +
         // extraFee) * qty` below) whenever ANY OTHER formula was active
         // -- e.g. wall_hole_or_crack_repair with qty=5 and "4 or more
         // areas" selected (item_count_overflow_formula active) priced
         // identically to qty=1, when it should scale like every other
         // qty-bearing answer on this same service correctly already
         // does.
         // v9.6 FIX: broadened beyond furniture_repair_formula alone --
         // confirmed directly (not guessed) that tile_repair_formula
         // (`parseInt(answers.tile_count) || qty || 1`) and
         // hardware_install_formula (`parseInt(answers.unit_count) ||
         // qty || 1`) both use the exact same "count answer, falling
         // back to the outer qty" pattern internally -- genuinely
         // qty-aware in the same sense furniture_repair_formula is,
         // just via a differently-named answer key rather than a
         // literal `qty` reference, which is why an earlier, narrower
         // version of this same fix missed them.
         // T135: falls back to an inline copy ONLY when the module-level
         // QTY_AWARE_FORMULAS (declared once, above computeUnifiedQuote)
         // isn't present -- i.e. only when this function's body has been
         // extracted in isolation by a test harness, never in the real,
         // full qr.html, where the module-level declaration always runs
         // first. verify_qty_tier_double_compounding_fix.js asserts this
         // fallback and the real module-level Set never drift apart.
         // v9.6 FIX: this totalMin padding step has the exact same
         // "does the resolved entity already, independently capture
         // qty via its own dedicated question" concern as the later
         // qtyMultiplier guard below -- found together, by the same
         // automated_path_sweep.js run (T104), since padding minutes
         // here still inflated the price even after the later guard
         // correctly suppressed the final multiplier. Computed once,
         // here, and reused below so both guards can never drift out
         // of sync with each other.
         // T135 FIX (PENDING_DECISIONS.md #42): the totalMin padding step
         // that used to live here (padding totalMin by 30 minutes per
         // extra unit, guarded the same way qtyMultiplier below is)
         // is deleted, not merely reconditioned. Its own firing condition
         // was byte-identical to the condition under which qtyMultiplier
         // (below) independently multiplies the ENTIRE estimate by qty --
         // so every service that ever hit this line got quantity applied
         // twice: once via inflated minutes (which could also cross a
         // deriveComplexityTier threshold and silently raise the hourly
         // rate), once via the outer multiplication of that already-
         // inflated result. Confirmed empirically before removing this:
         // blinds_shades_curtains_buy_the_hour priced at $750 for qty=5
         // against a genuine $50 base (15x, not the intended ~5x). Without
         // this step, totalMin correctly reflects ONE unit's time (so the
         // tier and hourly rate are derived correctly), and qtyMultiplier
         // alone scales the whole per-unit estimate linearly -- matching
         // the Charter's own §6A formula shape and the already-correct
         // per-unit-rate precedent (§6B's overflow rule, T20's decision).
         // See verify_qty_tier_double_compounding_fix.js for the full,
         // catalog-wide before/after verification.

         // v9.2: tag-level AND answer-level overrides both feed the same
         // ratchet — take whichever of the two is higher-ranked, never
         // downgrade. A heavy item detected via NLP tag should escalate
         // exactly as much as the same fact confirmed via an intake
         // question answer.
         let tagOverrideTier = answerOverrideTier,
             tagOverrideRank = RANK[answerOverrideTier] || 0;
         for (const tid of activeTagIds) {
             const tagDef = smartTags[tid];
             const override = tagDef?.escalate_complexity;
             if (override && (RANK[override] || 0) > tagOverrideRank) {
                 tagOverrideTier = override;
                 tagOverrideRank = RANK[override];
             }
         }
         const exactTier = svc?.operational_metrics?.complexity_tier || null;
         const complexityTier = deriveComplexityTier(totalMin, tagOverrideTier, exactTier);
         const tierRate = DB.global_rules?.complexity_tiers?.[complexityTier]?.hourly_rate || 85;
         const effectiveHourlyRate = (formulaResult && formulaResult.overrideHourlyRate != null) ? formulaResult.overrideHourlyRate : tierRate;

         // isFlatRate: either the service's own financial_engine.type says so,
         // OR the fired formula explicitly signaled overrideHourlyRate: 0
         // (its extraFee IS the complete flat price -- e.g. hardware_install_formula's
         // Tier 1 flat_tier_price -- adding hourly time on top would double-count it).
         const isFlatRate = pricingType === 'flat_rate' || (formulaResult && formulaResult.overrideHourlyRate === 0);
         // SSOT: qty-aware formulas (currently furniture_repair_formula, via
         // per_unit_minutes) already scale totalMin for the requested
         // quantity internally — multiplying the resulting labor estimate
         // by qty AGAIN here would double-count it (4 drawers' worth of
         // minutes, billed as if it were 4 SEPARATE full 4-drawer jobs).
         // Same "this path already knows its own qty" principle as the
         // totalMin padding suppression above; qty is folded into the
         // formula math itself, not applied as an outer multiplier.
         // v9.6 FIX: reuses qtyAlreadyAppliedByOwnQuestion, computed
         // once above alongside the totalMin padding guard, so both
         // checks always agree with each other by construction.
         const _qtyMult = resolveQuantityMultiplier({ units: qty, unitsSource: _qtyUnits.source, formulaId: effectiveFormulaId, entityType: svc ? 'service' : 'dynamic' });
         const qtyMultiplier = _qtyMult.multiplier;
         let laborEstimate;
         // T118 #29 FIX: perVisitFee is added OUTSIDE the * qtyMultiplier
         // multiplication, on both branches -- applied exactly once
         // regardless of quantity, whether qtyMultiplier is 1 (already
         // handled elsewhere) or the real qty (the actual bug case this
         // fixes). This is the complete fix: `(base + extraFee) *
         // qtyMultiplier` was the entire formula PENDING_DECISIONS.md #29
         // diagnosed -- multiplying access/urgency/parking/disposal/pets/
         // item_volume fees by quantity when they're logically one-time.
         if (isFlatRate) {
             laborEstimate = Math.round((base + extraFee) * qtyMultiplier) + perVisitFee;
         } else {
             laborEstimate = Math.round((base + extraFee + (totalMin / 60) * effectiveHourlyRate) * qtyMultiplier) + perVisitFee;
         }

         // GAP 2 FIX completion: if computeArchetypeQuote produced a result
         // for this entity, use it only when it's the authoritative source.
         // CRITICAL: only override for archetypes where computeArchetypeQuote
         // IS the correct calculator:
         //   - tiered_per_unit: the hardware_install_formula delegate
         //   - formula: explicitly named formula (already handled above too, but
         //     archetype result is consistent)
         // Do NOT override for flat_simple or hourly_timed when the entity
         // has a real formula path -- those services (dishwasher_repair, 
         // shelf_mortar_mounting, etc.) correctly use intake answers and
         // complexity multipliers that computeArchetypeQuote's simplified
         // branches don't replicate. The archetype classifies WHAT they are,
         // not HOW to compute them when a richer formula exists.
         if (_archetypeResult && (_pricingArchetype === 'tiered_per_unit' || _pricingArchetype === 'formula')) {
             laborEstimate = _archetypeResult.laborEstimate ?? laborEstimate;
             if (_archetypeResult.totalMin != null) totalMin = _archetypeResult.totalMin;
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
         // T150 (R-INVARIANT-PROVENANCE): ONE question, ONE resolver. resolveServiceCheckoutStateKey always answers (its last rung is the fallback), so the alternates that used to be
         // chained after it (`|| enrichment?.checkoutState || <pricingType / variability-tier guess>`) could never run: dead composition, deleted. The answer-level override below is the
         // only other rung, and the quote names the rung that won in checkoutStateSource.
         const _checkoutState = resolveServiceCheckoutStateKey(svc, dynDef);
         const staticCheckoutStateKey = _checkoutState.key;
         if ((_checkoutState.source === 'service_override' || _checkoutState.source === 'dynamic_engine') && variabilityTierIsDiag !== (staticCheckoutStateKey === 'diagnostic')) {
             console.warn(
                 `[diagnostic_governance violation] ${svc?.id || dynDef?.id || '(unnamed)'}: ` +
                 `checkout_state="${staticCheckoutStateKey}" contradicts confidence_strategy._variability_tier="${variabilityTier}". ` +
                 `Per global_rules.diagnostic_governance, variability_tier is the single source of truth ? this is a data error to fix in btnyc.json, not a runtime override.`
             );
         }
         const _answerOverrideWins = !!(answerCheckoutOverride &&
             (CS_RESTRICTIVENESS[answerCheckoutOverride] || 0) > (CS_RESTRICTIVENESS[staticCheckoutStateKey] || 0));
         const checkoutStateKey = _answerOverrideWins ? answerCheckoutOverride : staticCheckoutStateKey;
         const checkoutStateSource = _answerOverrideWins ? 'answer_override' : _checkoutState.source;
         const cs = DB.checkout_states?.[checkoutStateKey] || {};
         const btnKey = cs.hide_materials ? 'button_text_no_mat' : 'button_text_with_mat';
         let btnText = (cs[btnKey] || cs.button_text || 'Add to Request').replace('${labor_total}', '$' + laborEstimate);
         const btnClassKey = cs.hide_materials ? 'button_class_no_mat' : 'button_class_with_mat';
         const btnClass = cs[btnClassKey] || cs.button_class || 'btn-primary';

         const escalation = applyLiveConfidenceEscalation(
             baseStrategy, activeTagIds, smartTags, DB.global_rules?.confidence_escalation
         );
         const liveStrategy = escalation.strategy;

         // v9.6 FIX (T65): was `keywordConfidence + base_confidence`, uncapped --
         // a structurally different, more permissive formula than
         // orch_compute_confidence's own (base_confidence + a scaled,
         // capped contribution from match strength). Confirmed empirically:
         // disagreed on ~40% of a representative catalog sweep, always in
         // the same direction (this formula more permissive) -- any
         // service with minimum_quote_confidence above ~60 could
         // structurally never fail this check regardless of match
         // quality, since raw confidence_weight values run 55-100.
         // Fixed to match orch_compute_confidence's real logic exactly:
         // no intentKeyword means the customer already explicitly chose
         // this service (a catalog tap, or a chip-answer recompute on an
         // already-selected service) -- maximally confident, matching
         // orch_compute_confidence's own catalog=100 case. With an
         // intentKeyword (free-text/NLP-driven), the raw keyword weight
         // is scaled and capped identically to orch_compute_confidence's
         // free-text formula. Both pipelines now compute the literally
         // same number from the same inputs -- not just aligned, unified.
         // Known, minor, deliberately-accepted imprecision: this collapses
         // orch_compute_confidence's distinct 'other_tile' case (a
         // group-level tap, no intentKeyword either) into the same
         // maximal-confidence bucket as true catalog taps, rather than
         // its own, slightly more conservative blended formula --
         // threading an explicit entry-type signal through every real
         // call site of this function would be a substantially larger,
         // riskier change than this fix's real, confirmed scope justified
         // this round.
         const totalConfidence = intentKeyword ?
             (liveStrategy.base_confidence || 0) + Math.min(20, keywordConfidence * 0.2) :
             100;
         const meetsConfidenceBar = totalConfidence >= liveStrategy.minimum_quote_confidence;
         // T118 FIX: was resolveForceModules(variabilityTier) ->
         // force_modules_by_variability[tier], unconditional. Purely
         // informational (this field is only ever read for the trace
         // export below, nothing in this function's own pricing math
         // depends on it) -- inlined and gracefully degrades to [] when
         // only dynDef (no ui_taxonomy) is available, rather than
         // guessing a category/group for a dynamic-service entity this
         // function has no reliable way to resolve one for.
         const _idefs = DB.global_rules?.intake_defaults || {};
         const forceModules = [...new Set([
             ...(_idefs.universal || []),
             ...(_idefs.category_defaults?.[svc?.ui_taxonomy?.category_id] || []),
             ...(_idefs.group_defaults?.[svc?.ui_taxonomy?.group_id] || []),
         ])];

         // Divergence Resolution ("Fork in the Road" -- PROJECT_GOALS §9/10):
         // when a route has genuinely hit the diagnostic dead end
         // (checkoutStateKey === 'diagnostic') AND the resolved entity carries
         // real, authored remote_deep_dive_modules, the customer gets a real
         // choice -- answer more, specific questions remotely to try to unlock
         // a real price (Path A), or book the on-site diagnostic visit now,
         // with its fee credited back if they proceed with the repair (Path B)
         // -- instead of today's single, dead-end "on-site only" outcome.
         // Reads global_rules.divergence_resolution for the shared business
         // terms (fee, credit policy) and the resolved entity's own
         // remote_deep_dive_modules for which questions Path A actually asks.
         // Additive only: any entity without remote_deep_dive_modules authored
         // keeps today's exact, unchanged single-path diagnostic behavior --
         // confirmed today this is every real entity except dishwasher_repair.
         // Deliberately NOT gated on meetsConfidenceBar: checkoutStateKey===
         // 'diagnostic' is already the system's real, existing "no firm price
         // is possible" signal (a structural property of the entity, not a
         // confidence shortfall) -- see global_rules.diagnostic_governance.
         const divergenceCfg = DB.global_rules?.divergence_resolution || {};
         const remoteDeepDiveModules = (_entity?.remote_deep_dive_modules || [])
             .filter(mk => !!DB.intake_modules?.[mk]);
         const divergenceEligible = checkoutStateKey === 'diagnostic' &&
             divergenceCfg.enabled !== false &&
             remoteDeepDiveModules.length > 0;

         // v9.6 ADDITION (T106): Friction, computed exactly per the
         // Charter's own §7 formula (Friction = max(0, τₓ − Cₓ)),
         // rather than leaving the reader to derive it by hand from
         // separate totalConfidence/threshold numbers. Directly
         // responds to a pointed, well-founded question: is this
         // hard-fought metric actually being surfaced anywhere
         // meaningful, or just computed and left inert. A real,
         // honest, separate finding from the same investigation,
         // recorded here rather than silently fixed: the customer
         // -facing question COUNT is capped by a static number
         // (confidence_strategy.maximum_followup_questions),
         // checked against how many questions are still unanswered
         // -- not by live-checking whether frictionThreshold has
         // already, mathematically been reached. The two usually
         // agree by tuning, but nothing here structurally guarantees
         // it — this trace field makes that gap directly, honestly
         // observable per real quote, not asserted away.
         const frictionThreshold = liveStrategy.minimum_quote_confidence || 0;
         const friction = Math.max(0, frictionThreshold - totalConfidence);

         if (typeof _trace === 'function') _trace('pricing_engine', 'computeUnifiedQuote: final quote computed', {
             base,
             extraFee,
             perVisitFee,
             extraMin,
             totalMin,
             complexityTier,
             tierRate: effectiveHourlyRate,
             laborEstimate,
             dispatchFee,
             checkoutStateKey,
             checkoutStateSource,
             activeLabels,
             feeBreakdown,
             meetsConfidenceBar,
             totalConfidence,
             // v9.6 ADDITION: qty and answers weren't previously
             // captured in the trace itself, forcing anyone reading a
             // trace export to separately, manually track these --
             // exactly the friction the user directly reported after
             // using this tool to find a real bug. Both are already,
             // directly available in this scope.
             qty,
             answers,
             // v9.6 ADDITION (T106): the Charter's own named metrics,
             // explicit and computed, not left for the reader to derive.
             friction,
             frictionThreshold,
         });
         return {
             base,
             extraFee,
             perVisitFee,
             extraMin,
             totalMin,
             complexityTier,
             tierRate: effectiveHourlyRate,
             laborEstimate,
             qty,
             quantity: { units: qty, requestedQty: _qtyUnits.requestedQty, stance: _qtyUnits.stance, source: _qtyUnits.source, multiplier: qtyMultiplier, multiplierSource: _qtyMult.source },
             divergenceTerms: DB.global_rules?.divergence_resolution || {}, // SSOT copy and terms for the diagnostic fork: handed to the renderer, which never reads the SSOT itself (R-INVARIANT-BOUNDARY)
             activeLabels,
             feeBreakdown,
             dispatchFee,
             checkoutStateKey,
             checkoutStateSource,
             badgeLabel: cs.ui_badge_label || '',
             badgeIcon: cs.ui_badge_icon || '',
             btnText,
             btnClass,
             uiMessage: cs.ui_message || '',
             hideMaterials: !!cs.hide_materials,
             hideTime: !!cs.hide_time,
             isDiagnostic: checkoutStateKey === 'diagnostic',
             isProject: checkoutStateKey === 'project_based' || base >= 150,
             isAssembly: checkoutStateKey === 'database_summation',
             variabilityTier,
             baseStrategy,
             liveStrategy,
             escalatedBy: escalation.escalatedBy,
             keywordConfidence,
             totalConfidence,
             meetsConfidenceBar,
             forceModules,
             divergenceEligible,
             remoteDeepDiveModules,
             divergenceFee: divergenceCfg.diagnostic_fee || 0,
             // v9.5.1 FIX: was `divergenceCfg.credit_policy_note || ''` only.
             // credit_policy_note was this field's original, dedicated
             // customer-copy field; the real, current authored data
             // instead puts that same customer-facing sentence directly
             // on credit_policy itself (credit_policy_note isn't present
             // at all anymore). Falls back through both so this works
             // with either shape rather than silently returning '' the
             // moment one specific field name isn't the one in use --
             // confirmed via direct trace: this was returning '' against
             // the current real btnyc.json, not because the feature was
             // unimplemented (it was, and was fully tested), but because
             // of exactly this single-field-name assumption.
             divergenceCreditNote: divergenceCfg.credit_policy_note || divergenceCfg.credit_policy || '',
         };
     }

     const parsePriceToInt = (str) => {
         if (!str || typeof str !== 'string') return 0;
         const m = str.match(/(\d+(?:\.\d+)?)/);
         return m ? Math.round(parseFloat(m[1])) : 0;
     }



     function computeArchetypeQuote(entity, archetype, answers, qty, db, formulaId) {
         const fe = entity.financial_engine || {};
         const om = entity.operational_metrics || {};
         const rate = (db.global_rules?.complexity_tiers?.[om.complexity_tier || 'skilled']?.hourly_rate) || 85;

         if (archetype === 'flat_simple') {
             return {
                 laborEstimate: Math.round((fe.base_price || 0) * (qty || 1)),
                 totalMin: om.expected_minutes || 30
             };
         }
         if (archetype === 'hourly_timed') {
             const mins = om.expected_minutes || 30;
             return {
                 laborEstimate: Math.round((fe.base_price || 0) + (mins / 60) * rate),
                 totalMin: mins
             };
         }
         if (archetype === 'diagnostic_open') {
             // Real, deliberate non-commitment: a diagnostic-priced
             // entity's real, honest price is the dispatch/diagnostic
             // fee alone -- the actual repair cost is genuinely
             // unknown until the technician is on-site. Returning
             // base_price here (the diagnostic visit fee) rather
             // than fabricating a labor estimate this archetype, by
             // its own real nature, cannot honestly produce.
             return {
                 laborEstimate: Math.round(fe.base_price || 0),
                 totalMin: null,
                 isDiagnostic: true
             };
         }
         if (archetype === 'formula' || archetype === 'tiered_per_unit') {
             // v9.5 FIX (real bug caught by direct verification): the
             // real, correct formulaId source differs by entity
             // shape -- a NAMED service carries it on its own
             // entity.pricing_engine, but a DYNAMIC entity (e.g.
             // minor_home_repairs+Repair, shared by 3 real,
             // distinct formulas selected by whichever real keyword
             // resolved to it) has no such field of its own at all.
             // The caller must supply the real, correct id for
             // either shape explicitly; this function never guesses.
             const realFormulaId = formulaId || entity.pricing_engine;
             const f = db.pricing_formulas?.[realFormulaId];
             if (!f) return {
                 laborEstimate: Math.round(fe.base_price || 0),
                 totalMin: om.expected_minutes || 30
             };
             const formulaResult = typeof applyPricingFormula === 'function' ? applyPricingFormula(realFormulaId, answers || {}, qty || 1) : null;
             // v9.5 FIX (third real gap, caught by direct, isolated
             // debugging): totalMin previously used
             // formulaResult.extraMin ALONE, never combining it with
             // the entity's own, real, separate baseMinutes
             // contribution (the SAME, established pattern
             // computeUnifiedQuote already correctly uses
             // elsewhere: the real midpoint of
             // default_estimate.total_minutes, or an
             // operational_metrics fallback) -- confirmed via direct
             // trace this is exactly why the real, dynamic-entity
             // tile case used 55 real minutes instead of the
             // correct 135 (80 real baseMinutes + 55 real formula
             // extraMin).
             const tm = entity.default_estimates?.total_minutes || entity.default_estimate?.total_minutes;
             const hasRealTm = tm && tm.min != null && tm.max != null && (tm.min + tm.max) > 0;
             // Only fall back to the generic entity-level expected_minutes when
             // there's no real curated total_minutes AND no formula fired to
             // supply its own self-contained time model. A fired formula's
             // extraMin (which already includes its own base_minutes, e.g.
             // hardware_install_formula's 10-minute setup) is the complete
             // time model for that formula -- adding a second, generic
             // baseMinutes on top would double-count setup time.
             const baseMinutes = hasRealTm ?
                 Math.round((tm.min + tm.max) / 2) :
                 (formulaResult ? 0 : (om.expected_minutes ?? om.minimum_minutes ?? 45));
             const totalMin = baseMinutes + (formulaResult ? formulaResult.extraMin : 0);
             const extraFee = formulaResult ? formulaResult.extraFee : 0;
             const realTier = typeof deriveComplexityTier === 'function' ?
                 deriveComplexityTier(totalMin, null, om.complexity_tier || null) :
                 (om.complexity_tier || 'skilled');
             const realRate = (formulaResult && formulaResult.overrideHourlyRate != null) ? formulaResult.overrideHourlyRate : ((db.global_rules?.complexity_tiers?.[realTier]?.hourly_rate) || rate);
             // v9.6 FIX: a third, real bug in the same family as
             // computeUnifiedQuote's own two fixes above (found the same
             // way -- reconciling this session's own tests against a
             // real screenshot's real, displayed price) -- this branch
             // never multiplied by qty at all, always computing a
             // single-unit price regardless of how many units were
             // requested. Matches computeUnifiedQuote's own, now-correct
             // qtyMultiplier logic: qty applies except for the one real
             // formula (furniture_repair_formula) that already,
             // genuinely scales its own minutes internally.
             // T135 FIX (PENDING_DECISIONS.md #42, second instance of the
             // same bug): this used to be a separate, hardcoded array
             // literal here, independent from computeUnifiedQuote's own
             // QTY_AWARE_FORMULAS -- confirmed directly this was silently
             // missing buy_the_hour_qty_gate_formula, so a service using
             // that formula still got double-multiplied by this function's
             // own, then-unguarded qty multiplication, even after
             // computeUnifiedQuote's copy was fixed, because THIS
             // function's result is what actually wins for any
             // 'formula'/'tiered_per_unit' archetype entity (see the
             // override block in computeUnifiedQuote). Now references the
             // real, module-level QTY_AWARE_FORMULAS Set when present
             // (always true in the real, full qr.html), falling back to
             // an identical inline copy only for isolated test extraction
             // -- see computeUnifiedQuote's own matching fallback and
             // verify_qty_tier_double_compounding_fix.js, which asserts
             // both fallbacks and the real Set all agree.
             const archQtyMultiplier = resolveQuantityMultiplier({ units: qty || 1, unitsSource: 'fallback', formulaId: realFormulaId, entityType: 'service' }).multiplier;
             return {
                 laborEstimate: Math.round(((fe.base_price || 0) + extraFee + (totalMin / 60) * realRate) * archQtyMultiplier),
                 totalMin
             };
         }
         return null; // genuinely unrecognized archetype -- caller must fall back to the legacy path
     }

     function _computePrice(svc, answers, qty) {
         // Thin wrapper around computeUnifiedQuote for call sites using the
         // legacy _computePrice(svc, answers, qty) signature.
         return computeUnifiedQuote({
             svc,
             dynDef: null,
             activeTagIds: [],
             answers: answers || {},
             qty: qty || 1
         });
     }

     function computeQuoteFromState(state) {
         // Safety net: ensures state.answers reflects currently-active tags
         // even if this is called without render() having just run
         // (e.g. called directly). render() already calls this too,
         // but the real, charged price computed here must not depend
         // on that incidental ordering.
         syncTagSynthesizedAnswers(state);
         // Full display set -- every tag the customer sees (chips etc.)
         // The SSOT's `requires` relations are applied here (closeTagsOverRequires), once, for every path; the customer's explicit negations win.
         const allTagIds = closeTagsOverRequires([...(state.detTagIds || []), ...(state.manTagIds || []), ...(state.inherentTagIds || [])], state.negatedTagIds, DB);

         // Chargeable set -- what actually drives price.
         // detTagIds are gated: only included if the customer has
         // explicitly affirmed them (state._tagsAffirmed) OR if
         // meetsConfidenceBar is already true for the current quote.
         // manTagIds and inherentTagIds are never gated (manual tap
         // IS affirmation; inherent tags are service facts, not claims).
         const detAndMan = [...new Set([...state.detTagIds, ...state.manTagIds])];
         const svc = state._svc || (state.intent?.key ? DB.services.find(s => s.id === state.intent.key) : null);
         const dynDef = svc ? null : resolveDynamicService(state.intent?.category, state.stype || 'Repair', state.intent?._groupId);
         // The session's own quantity is what the resolver says is priced, so nothing downstream shows or sums a number that was not (T147).
         state.qty = resolveQuantityUnits({ entity: svc || dynDef, entityType: svc ? 'service' : 'dynamic', requestedQty: state.qty }).units;

         // Compute a preliminary quote with the full tag set to check meetsConfidenceBar
         const fullQuote = computeUnifiedQuote({
             svc,
             dynDef,
             activeTagIds: allTagIds,
             answers: state.answers || {},
             qty: state.qty || 1,
             intentKeyword: state.intent?.key || null,
             formulaId: state.intent?.dynamic_rule || null,
             ctxAdjFee: state.intent?._ctxBaseAdjFee || 0,
             ctxAdjMin: state.intent?._ctxBaseAdjMin || 0,
         });

         // Gate: if not affirmed and not already confident, exclude detTagIds from price
         const detTagsChargeable = state._tagsAffirmed || fullQuote.meetsConfidenceBar;
         const activeTagIds = detTagsChargeable ?
             allTagIds : closeTagsOverRequires([...(state.manTagIds || []), ...(state.inherentTagIds || [])], state.negatedTagIds, DB);

         // Final quote with correctly gated tag set
         const u = detTagsChargeable ? fullQuote : computeUnifiedQuote({
             svc,
             dynDef,
             activeTagIds,
             answers: state.answers || {},
             qty: state.qty || 1,
             intentKeyword: state.intent?.key || null,
             formulaId: state.intent?.dynamic_rule || null,
             ctxAdjFee: state.intent?._ctxBaseAdjFee || 0,
             ctxAdjMin: state.intent?._ctxBaseAdjMin || 0,
         });

         return {
             laborCalc: u.laborEstimate,
             dispatchFee: u.dispatchFee,
             divergenceTerms: u.divergenceTerms,
             checkoutStateKey: u.checkoutStateKey,
             checkoutStateSource: u.checkoutStateSource,
             activeLabels: u.activeLabels || [],
             feeBreakdown: u.feeBreakdown || [],
             isDiagnostic: u.isDiagnostic,
             activeTagIds,
             allTagIds,
             detAndMan,
             meetsConfidenceBar: fullQuote.meetsConfidenceBar,
             detTagsChargeable,
             // Full-set price for affirmation card preview ("price with these tags")
             laborWithTags: fullQuote.laborEstimate,
             // v9.6 FIX: these were never forwarded at all, even though
             // computeUnifiedQuote always correctly computed them --
             // sqRenderQuote reads them directly and was showing literal
             // "$undefined"/"undefined min" in the real, customer-facing
             // quote. Confirmed via real browser trace before fixing.
             base: u.base,
             totalMin: u.totalMin,
             tierKey: u.complexityTier,
             tierRate: u.tierRate,
             hideTime: u.hideTime,
             isProject: u.isProject,
             // Divergence Resolution: same class of bug as the v9.6 FIX
             // immediately above (computeUnifiedQuote computes it, this
             // function's own narrow return contract has to explicitly
             // forward it or every caller silently sees undefined) --
             // caught by verify_divergence_resolution.js's real,
             // end-to-end scenario check, not by static inspection alone.
             divergenceEligible: u.divergenceEligible,
             remoteDeepDiveModules: u.remoteDeepDiveModules || [],
             divergenceFee: u.divergenceFee || 0,
             divergenceCreditNote: u.divergenceCreditNote || '',
         };
     }

     // Path B of the Fork in the Road (Charter: "switch to a FLAT-RATE diagnostic fee ... a bookable,
     // priced service -- not a white flag ... we credit the fee back if we do the work"). What the client
     // pays and is promised for that path, from the SSOT, in one place. Pure.
     function onsiteDiagnosticTerms(q) {
         const dr = DB.global_rules?.divergence_resolution || {};
         const fee = (q && q.divergenceFee) || dr.diagnostic_fee || 0;
         return {
             fee,
             label: dr.onsite_price_label || 'On-site diagnostic (flat rate):',
             creditNote: (q && q.divergenceCreditNote) || dr.credit_policy_note || dr.credit_policy || '',
             bookingNote: 'On-site diagnostic booked via Fork-in-the-Road: $' + fee + ' diagnostic fee. ' +
                 (dr.credit_policy || 'No credit policy on file.')
         };
     }
 