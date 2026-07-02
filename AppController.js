/**
 * AppController.js
 *
 * PHASE 1 — AppController module (Logic / UI / Glue split, fourth and final
 * module). See pricing_engine.js, nlp_engine.js, and UIRenderer.js for the
 * other three, and architecture_audit/ for the full methodology.
 *
 * CLASSIFICATION METHOD: every function below was verified (AST-based
 * AssignmentExpression / mutator-method-call analysis rooted at the literal
 * identifiers S or State — see UIRenderer.js's header for the full method)
 * to genuinely WRITE to the app's global mutable session state, directly or
 * via an aliased reference obtained from it. This is the event-glue /
 * orchestration layer: event listeners, flow sequencing, cart mutation,
 * navigation state.
 *
 * THE ALIASED-MUTATION BLIND SPOT, found and closed systematically: a
 * literal-name check (does this body contain "S.foo =" or "State.foo =")
 * misses mutation through a local variable that ALIASES an element of
 * State/S — e.g. `const svc = State.serviceRequest.find(...); svc.x = y;`
 * mutates svc, not literally "State.x", but svc IS an element of that
 * shared array, so the mutation is real. Three functions were found this
 * way via a dedicated AST search across every function in qr.html (not
 * just pre-selected candidates): removeFurnitureEntry and addToCart (both
 * already correctly classified here by their OTHER, literal mutations) and
 * **_recomputeInstanceLabels** — which the original purity audit had
 * incorrectly marked fully pure, and which was only caught when wiring
 * addToCart actually failed at runtime with "_recomputeInstanceLabels is
 * not defined" during cross-module integration testing. Added here after
 * that failure, not before — documented plainly rather than glossed over.
 *
 * TWO MIXED WIDGETS kept here as self-contained units, not split further:
 * renderFurnitureSelection and renderPaxConfigurator each build a full
 * interactive DOM component AND mutate State.serviceRequest/
 * State.furnitureItems from within their own internal event handlers.
 * Verified (not assumed) they are NOT cleanly separable into a pure-render
 * half and a pure-mutation half without restructuring genuinely-working
 * code — the render and the mutation are interleaved through the same
 * local closures (e.g. a button's onclick handler that both updates a
 * DOM counter AND pushes to State in the same callback).
 *
 * A user-provided cross-check document independently arrived at
 * substantially the same Controller/Renderer split and correctly flagged
 * applySSOTRules, sqBuildStep2/sqBuildStep3, and the two mixed widgets as
 * belonging here — each independently re-verified against this file's own
 * AST analysis before being included, not simply taken on the document's
 * word (the same document also listed three functions —
 * showGroupsForCategory, showSubGroups, selectGroupForCategory — that do
 * not exist anywhere in this qr.html; excluded here after confirming zero
 * matches for any of the three).
 *
 * DEPENDENCIES: calls into pricing_engine.js (_isModVisible,
 * _resolveIntakeChain, mathFurnitureAssembly, resolveDynamicService,
 * tagValidForCategory and others) and nlp_engine.js (detectIntentNLP,
 * detectTagsNLP, extractObject/extractQty/extractLocation and others) —
 * load both before this file. Calls UIRenderer.js functions directly
 * (e.g. sqAnalyze calling sqBuildStep2/renderCategoryCards-family render
 * functions) — load UIRenderer.js before invoking any real user flow,
 * though function-declaration hoisting means load ORDER between this file
 * and UIRenderer.js doesn't matter for definitions themselves to exist.
 * Reads AND writes the global State/S session objects and the global DB
 * (loaded btnyc.json). Also reads (never writes) the DOM cache object
 * DECLARED in UIRenderer.js (populated by its cacheDOM()) — found missing
 * during cross-module integration testing (addToCart/finalizeBooking threw
 * "DOM is not defined" without it); UIRenderer.js's top-level code must run
 * before any function here that touches DOM.* is called.
 *
 * SECURITY FIX (v9.4): sqBuildCuratedIntake and sqBuildAdlib (the function
 * containing ctxBadge) both had confirmed XSS vulnerabilities — fixed in
 * qr.html itself and re-extracted here. builderDesc (sourced from S.desc,
 * the raw SmartQuote textarea value) and ctxBadge's `text` parameter
 * (S._location/S._sizeHint, NLP-extracted from that same raw text) were
 * interpolated into innerHTML assignments with zero escaping (CodeQL: "DOM
 * text reinterpreted as HTML"). Both now call escapeHtml() (declared in
 * UIRenderer.js) before interpolation — load UIRenderer.js before this file.
 *
 * Loaded as a plain global-scope <script>, same rationale as the other
 * three modules. qr.html itself was NOT modified — remains fully
 * self-contained, single-file deployment. This ships as a verified,
 * standalone reference module.
 */

function _sqRevertAutoSelect() {
                    const saved = S._autoSelectedFrom;
                    if (!saved) { sqRestart(); return; }

                    const bar = document.getElementById('sqTextBar');
                    if (bar) bar.style.display = 'none';
                    const grid = document.getElementById('category-card');
                    if (grid) grid.style.display = 'none';
                    if (DOM.serviceContainer) DOM.serviceContainer.style.display = 'none';
                    if (!document.getElementById('sqTextBar')) initSmartQuote();

                    S.desc = saved.desc;
                    S.intent = saved.intent;
                    S.stype = saved.intent?.stype || null;
                    S.qty = saved.qty || 1;
                    S._autoSelectedFrom = null; // clear — this is no longer an auto-selected state
                    S._svc = null;

                    const flow = document.getElementById('sqStepFlow');
                    if (flow) flow.style.display = 'flex';
                    const qout = document.getElementById('sqQuoteOut');
                    if (qout) qout.innerHTML = '';

                    sqPrepareFlow(true); // type/object already known from the saved intent
                }

function addToCart(entry) {
                    if (!entry?.id) return;
                    if (entry.furnitureItems?.length) {
                        const existing = State.serviceRequest.find(item => item.name === entry.name && item.category_id === entry.category_id);
                        if (existing) {
                            existing.furnitureItems = [...existing.furnitureItems, ...entry.furnitureItems];
                            const mins = existing.furnitureItems.map(f => f.minutes);
                            const charge = mathFurnitureAssembly(mins);
                            existing.estimatedHours = charge.hours;
                            existing.estimatedPrice = charge.price;
                            existing.price = `$${charge.price.toFixed(2)}`;
                            existing.notes = `Furniture Items: ${existing.furnitureItems.map(f => f.label).join(', ')} • Est: ${charge.hours.toFixed(2)} hr • $${charge.price.toFixed(2)}`;
                            renderCart();
                            toast('Merged with existing furniture request', 'success');
                            return;
                        }
                    }
                    // Duplicate detection: merge qty rather than showing a confirm()
                    // dialog — but ONLY when the requests are genuine repeats (same
                    // name/category/price AND same notes/context). Two requests that
                    // share a name+price but differ in notes (e.g. "Mount TV" in the
                    // living room vs. "Mount TV" in the bedroom) are NOT the same
                    // request — merging them silently into qty:2 loses the first
                    // location entirely (dupe.notes was being overwritten by the
                    // second entry's notes) and gives the user no visual way to tell
                    // two distinct, valid bookings apart in the cart. v9.1 fix:
                    // require notes to match (treating empty/undefined notes on
                    // both sides as a match) before merging into qty; otherwise
                    // fall through and add as its own distinct line item.
                    const notesMatch = (a, b) => (a || '') === (b || '');
                    const dupe = State.serviceRequest.find(item =>
                        item.name === entry.name &&
                        item.category_id === entry.category_id &&
                        item.price === entry.price &&
                        notesMatch(item.notes, entry.notes) &&
                        !item.furnitureItems // furniture has its own merge path above
                    );
                    if (dupe) {
                        dupe.qty = (dupe.qty || 1) + 1;
                        renderCart();
                        toast(`${entry.name} — qty updated to ${dupe.qty}`, 'success');
                        return;
                    }
                    // Same service+price but DIFFERENT notes/context: add as a
                    // distinct line item. _recomputeInstanceLabels (called via
                    // renderCart below) tags this and any sibling with a visible
                    // '#1'/'#2' badge so the cart UI shows they're different,
                    // instead of letting them look identical with no way to tell
                    // them apart.
                    entry.qty = entry.qty || 1;
                    State.serviceRequest.push(entry);
                    _recomputeInstanceLabels();
                    if (DOM.cartFab) {
                        DOM.cartFab.style.animation = 'none';
                        requestAnimationFrame(() => DOM.cartFab.style.animation = 'cartBounce .4s ease');
                    }
                    renderCart();
                }

function applySSOTRules() {
                    const tags = DB.smart_tags || {};
                    const cat = S.intent?.category || 'other';
                    const valid = Object.keys(tags).filter(tid => tagValidForCategory(tid, cat, S.intent?._groupId));

                    // Default-for-group — only for tags valid for this category
                    const groups = new Set(valid.map(tid => tags[tid].display_group || 'Additional Adjustments'));
                    groups.forEach(g => {
                        const gTids = valid.filter(tid => (tags[tid].display_group || 'Additional Adjustments') === g);
                        const hasSel = gTids.some(tid => S.detTagIds.includes(tid) || S.manTagIds.includes(tid));
                        if (!hasSel) {
                            // Skip auto-default in curated mode (e.g. don't auto-select #drywall for door installs)
                            if (S._curatedMode) return;
                            const def = gTids.find(tid => tags[tid].is_default_for_group && tagValidForCategory(tid, cat, S.intent?._groupId));
                            if (def && !S.negatedTagIds.includes(def) && !S.manTagIds.includes(def))
                                S.manTagIds.push(def);
                        }
                    });

                    // Mutual exclusion — reads fully from btnyc.json smart_tags[tid].mutually_exclusive
                    // manTagIds (user tap) take priority: remove their exclusive siblings everywhere
                    const rm = new Set();
                    S.manTagIds.forEach(tid => {
                        (tags[tid]?.mutually_exclusive || []).forEach(x => rm.add(x));
                    });
                    // detTagIds (NLP) also enforce exclusion — but only if not overridden by a manTag
                    S.detTagIds.forEach(tid => {
                        if (!rm.has(tid)) {
                            (tags[tid]?.mutually_exclusive || []).forEach(x => {
                                if (!S.manTagIds.includes(x)) rm.add(x); // NLP tag wins unless user picked the sibling
                            });
                        }
                    });
                    S.manTagIds = S.manTagIds.filter(x => !rm.has(x));
                    S.detTagIds = S.detTagIds.filter(x => !rm.has(x));
                    S.userTagIds = (S.userTagIds || []).filter(x => !rm.has(x));

                    // Clean negatedTagIds: if an exclusive sibling IS selected, the negation is no longer valid
                    // e.g. #heavy_item is selected → remove any negation of its sibling #very_heavy
                    const activeSet = new Set([...S.manTagIds, ...S.detTagIds]);
                    S.negatedTagIds = S.negatedTagIds.filter(tid => {
                        const t = tags[tid];
                        if (!t) return false;
                        // Keep the negation only if none of this tag's exclusive siblings are active
                        return !(t.mutually_exclusive || []).some(sib => activeSet.has(sib));
                    });
                }

function finalizeBooking() {
                    DOM.overlaybookNowBtn.disabled = true;
                    DOM.overlaybookNowBtn.textContent = 'Submitting…';
                    toast('Booking confirmed! (demo)', 'success');
                    State.serviceRequest = [];
                    persistCart();
                    renderCart();
                    closeCartOverlay();
                    restoreCategoryView();
                    setTimeout(() => toast('Thank you for your request!', 'success'), 1500);
                }

function prefillSmartQuoteFromOtherTile(tile, category_id) {
                    Breadcrumbs.push({ type: 'serviceDetail', group: null, category_id });
                    enterFocusedMode();

                    const bar = document.getElementById('sqTextBar');
                    if (bar) bar.style.display = 'none';
                    const grid = document.getElementById('category-card');
                    if (grid) grid.style.display = 'none';
                    if (DOM.serviceContainer) DOM.serviceContainer.style.display = 'none';
                    if (DOM.intakeQuestionsContainer) DOM.intakeQuestionsContainer.style.display = 'none';
                    if (!document.getElementById('sqTextBar')) initSmartQuote();

                    const groupId = tile.ui_taxonomy.group_id;
                    const groupObj = groupMap.get(groupId);
                    const catObj = categoryMap.get(category_id);
                    // A collapsed "[Group] Other" tile can carry multiple possible
                    // types (Diagnostic + Repair + Install all uncovered is common).
                    // Only pre-seed the action step when exactly one type is possible —
                    // otherwise leave it genuinely open, since guessing would be wrong
                    // as often as it's right.
                    const uncoveredTypes = tile.uncovered_service_types || [tile.service_type];
                    const singleType = uncoveredTypes.length === 1 ? uncoveredTypes[0] : null;
                    const stype = singleType || tile.service_type; // best-guess label/pricing default
                    const dynDef = resolveDynamicService(category_id, stype, groupId);

                    // SSOT: dynamic_services is the pricing source for unnamed jobs —
                    // base price, confidence_strategy, intake_chain all come from there.
                    // Qty: use group's default_qty if defined (e.g. Windows default 2
                    // since 'I need my windows serviced' implies plurality), else 1.
                    const defaultQty = groupObj?.default_qty || 1;
                    S = {
                        qty: defaultQty,
                        intent: {
                            category: category_id,
                            label: (catObj?.display_name || category_id) + (singleType ? ' \u2014 ' + singleType : ''),
                            group: groupObj?.display_name || groupId,
                            base: dynDef?.financial_engine?.base_price ?? 70,
                            stype: singleType, // null when ambiguous — set for real once the builder's action step is answered
                            qtyLabel: 'item',
                            key: tile.id,
                            _groupId: groupId,
                            _pricingType: dynDef?.financial_engine?.pricing_type || 'flat_rate',
                            checkoutState: dynDef?.financial_engine?.checkout_state || null
                        },
                        stype: singleType,
                        // Carry NLP-seeded context when entering from sqAnalyze
                        // (the user typed something — we understood the category/group
                        // and now the wizard just needs the missing specifics).
                        desc: S._nlpSeedDesc || '',
                        _objectNoun: S._nlpSeedObject || null,
                        detTagIds: [],
                        manTagIds: [],
                        negatedTagIds: [],
                        adlibConfirmed: false,
                        _isOtherTileEntry: true,
                        _suggestedTagIds: []
                    };
                    // Clear the NLP seed after consuming it
                    S._nlpSeedDesc = null;
                    S._nlpSeedObject = null;

                    if (dynDef?.suggested_tags) {
                        dynDef.suggested_tags.forEach(tagObj => {
                            if (!tagObj || typeof tagObj !== 'object') return;
                            const segments = tagObj?.$ref ? tagObj.$ref.replace(/^#\//, '').split('/') : null;
                            const tagId = segments ? '#' + segments[segments.length - 1].replace('#', '') : null;
                            if (tagId && DB.smart_tags?.[tagId] && !S._suggestedTagIds.includes(tagId))
                                S._suggestedTagIds.push(tagId);
                        });
                    }

                    // Only mark step 2 (service type) done when it's actually known
                    // (exactly one uncovered type). With multiple possible types,
                    // step 2 stays open — the builder's action step is where it
                    // actually gets answered.
                    if (singleType) {
                        const sn2 = document.getElementById('sqSn2'), sc2 = document.getElementById('sqSc2'),
                            sb2 = document.getElementById('sqSb2'), sv2 = document.getElementById('sqSv2');
                        if (sn2) { sn2.className = 'snum d'; sn2.innerHTML = '<i class="ti ti-check" style="font-size:14px"></i>'; }
                        if (sc2) sc2.className = 'scard done';
                        if (sb2) sb2.style.display = 'none';
                        if (sv2) sv2.textContent = singleType;
                    }

                    const qout = document.getElementById('sqQuoteOut');
                    if (qout) qout.innerHTML = '';
                    const flow = document.getElementById('sqStepFlow');
                    if (flow) flow.style.display = 'flex';

                    // Launch the guided builder. Action is pre-seeded only when
                    // unambiguous (single uncovered type); otherwise null, so the
                    // builder's own action step asks it normally — group context
                    // (which IS always known) is still pre-seeded either way.
                    sqOpenBuilderPreseeded({
                        action: singleType ? stDefaultAction(singleType) : null,
                        groupId,
                        categoryLabel: groupObj?.display_name || catObj?.display_name || category_id,
                        allowedTypes: singleType ? null : uncoveredTypes
                    });

                    document.getElementById('smartQuoteEngine')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }

function prefillSmartQuoteFromService(svc, category_id) {
                    const prof = getServiceProfile(svc);

                    // Furniture selection and "Other/adhoc" keep the old intake flow
                    if (svc.requires_furniture_selection) {
                        showIntakeQuestions(svc, category_id);
                        return;
                    }
                    if (prof.isOther) {
                        // Show text bar for "Other" services so user can describe freely
                        const bar = document.getElementById('sqTextBar');
                        if (bar) bar.style.display = 'block';
                        showIntakeQuestions(svc, category_id);
                        return;
                    }

                    Breadcrumbs.push({
                        type: 'serviceDetail',
                        group: null,
                        category_id
                    });
                    enterFocusedMode();

                    // Hide the text bar during card-browse flow
                    const bar = document.getElementById('sqTextBar');
                    if (bar) bar.style.display = 'none';

                    const grid = document.getElementById('category-card');
                    if (grid) grid.style.display = 'none';
                    if (DOM.serviceContainer) DOM.serviceContainer.style.display = 'none';
                    if (DOM.intakeQuestionsContainer) DOM.intakeQuestionsContainer.style.display = 'none';

                    // Ensure SmartQuote UI exists
                    if (!document.getElementById('sqTextBar')) initSmartQuote();

                    // Seed S from the service
                    const catObj = categoryMap.get(category_id);
                    const catName = catObj ? (catObj.display_name || catObj.name || category_id) : category_id;
                    S = {
                        qty: 1,
                        intent: {
                            category: category_id,
                            label: svc.ui_taxonomy?.display_name || svc.display_name || catName,
                            group: svc.ui_taxonomy?.display_name || svc.id,
                            base: svc.financial_engine?.base_price ?? 70,
                            stype: (svc.service_type || 'Repair').replace('Install / Mount', 'Install').replace('Install/Mount', 'Install'),
                            qtyLabel: 'item',
                            key: svc.id,
                            _groupId: svc.ui_taxonomy?.group_id || null,
                            _pricingType: svc.financial_engine?.pricing_type || null
                        },
                        stype: (svc.service_type || 'Repair').replace('Install / Mount', 'Install').replace('Install/Mount', 'Install'),
                        desc: svc.ui_taxonomy?.display_name || svc.id,
                        detTagIds: [],
                        manTagIds: [],
                        negatedTagIds: [],
                        adlibConfirmed: false
                    };

                    // Seed default_tags from the service record
                    (svc.default_tags || []).forEach(tagRef => {
                        const tid = (typeof tagRef === 'object' && tagRef.$ref) ? tagRef.$ref : tagRef;
                        if (typeof tid === 'string' && tid.startsWith('#') && !S.negatedTagIds.includes(tid))
                            S.detTagIds.push(tid);
                    });

                    // SSOT: dynamic_services — enrich base price and suggested_tags if service lacks them
                    const normStPrefill = (svc.service_type || 'Repair').replace('Install / Mount', 'Install');
                    const dynDefPrefill = resolveDynamicService(category_id, normStPrefill, svc.ui_taxonomy?.group_id);
                    if (dynDefPrefill) {
                        // Use dynamic base price if service base price is 0 or missing
                        if (!S.intent.base && dynDefPrefill.financial_engine?.base_price) {
                            S.intent.base = dynDefPrefill.financial_engine.base_price;
                        }
                        // Also seed checkout state from dynamic_services operational_metrics
                        if (dynDefPrefill.operational_metrics?.checkout_state) {
                            S.intent.checkoutState = dynDefPrefill.operational_metrics.checkout_state;
                        }
                        // suggested_tags: store as hints only — NOT pre-selected
                        if (dynDefPrefill.suggested_tags) {
                            S._suggestedTagIds = S._suggestedTagIds || [];
                            dynDefPrefill.suggested_tags.forEach(tagObj => {
                                if (!tagObj || typeof tagObj !== 'object') return;
                                const segments = tagObj?.$ref ? tagObj.$ref.replace(/^#\//, '').split('/') : null;
                                const tagId = segments ? '#' + segments[segments.length - 1].replace('#', '') : null;
                                if (tagId && DB.smart_tags?.[tagId] && !S._suggestedTagIds.includes(tagId))
                                    S._suggestedTagIds.push(tagId);
                            });
                        }
                    }
                    // Pre-fill intake answers from default_tags (fixes lower-than-expected quotes)
                    S.detTagIds.forEach(tid => {
                        const tagDef = DB.smart_tags?.[tid];
                        if (tagDef?.answers) {
                            // Merge tag's pre-defined answer hints into S for pricing
                            // (these do not skip intake questions, they just ensure fees apply)
                        }
                    });

                    // Mark step 2 done (type is known from service card)
                    const sn2 = document.getElementById('sqSn2'),
                        sc2 = document.getElementById('sqSc2'),
                        sb2 = document.getElementById('sqSb2'),
                        sv2 = document.getElementById('sqSv2');
                    if (sn2) {
                        sn2.className = 'snum d';
                        sn2.innerHTML = '<i class="ti ti-check" style="font-size:14px"></i>';
                    }
                    if (sc2) sc2.className = 'scard done';
                    if (sb2) sb2.style.display = 'none';
                    if (sv2) sv2.textContent = S.stype;

                    // Clear previous quote output
                    const qout = document.getElementById('sqQuoteOut');
                    if (qout) qout.innerHTML = '';

                    // Show step flow
                    const flow = document.getElementById('sqStepFlow');
                    if (flow) flow.style.display = 'flex';

                    // ── Self-quoting check: services with full pricing data skip step 3 ──
                    // If service has base_price + expected_minutes + complexity_tier and
                    // its intake_chain only asks quantity, skip the chip grid and adlib entirely.
                    // Just render the adlib with a qty pill and auto-quote on confirm.
                    const om = svc.operational_metrics || {};
                    const de = svc.default_estimates || {};
                    const chain = svc.intake_chain || [];
                    const QTY_MODS = new Set(['item_count', 'count', 'hybrid_qty', 'global_quantity']);
                    const chainIsQtyOnly = chain.length === 0 || chain.every(m => QTY_MODS.has(m.module));
                    const hasPricingData = (om.expected_minutes > 0) && om.complexity_tier && (svc.financial_engine?.base_price > 0);
                    const isFlatCheckout = ['standard_flat_rate', 'database_summation'].includes(svc.financial_engine?.checkout_state);
                    const isSelfQuoting = hasPricingData && isFlatCheckout && chainIsQtyOnly;

                    if (isSelfQuoting) {
                        // Compute price directly from service data (no tags needed)
                        S._objectNoun = svc.ui_taxonomy?.display_name || svc.id;
                        S._location = null;
                        S._sizeHint = null;
                        S._notes = null;
                        // Store the exact service minutes on intent for computeSQQuote
                        S.intent._exactMinutes = om.expected_minutes;
                        S.intent._exactTier = om.complexity_tier;

                        // Mark step 3 done too — skip the chip view
                        const sn3 = document.getElementById('sqSn3'),
                            sc3 = document.getElementById('sqSc3'),
                            sb3 = document.getElementById('sqSb3'),
                            sv3 = document.getElementById('sqSv3');
                        if (sn3) {
                            sn3.className = 'snum d';
                            sn3.innerHTML = '<i class="ti ti-check" style="font-size:14px"></i>';
                        }
                        if (sc3) sc3.className = 'scard done';
                        if (sb3) sb3.style.display = 'none';
                        if (sv3) sv3.textContent = S.qty + '× item';

                        // Show focused adlib confirmation with just qty — no tag chips
                        sqRenderSelfQuoteAdlib(svc);
                    } else {
                        // ── VIEW TEMPLATE choice only — NOT a confidence/pricing decision ──
                        // Both branches below feed the SAME confidence engine
                        // (base_confidence + sum of confidence_gain per answered
                        // module, gating the estimate button — see sqBuildCuratedIntake).
                        // This only decides which UI template renders: the curated
                        // card (real questions to ask) or the bare chip grid
                        // (nothing to ask beyond quantity/tags). Renamed from the
                        // confusing "hasRealIntake" after an audit correctly flagged
                        // that name as reading like a confidence bypass.
                        const needsCuratedCardTemplate = chain.some(m => !QTY_MODS.has(m.module));
                        if (needsCuratedCardTemplate) {
                            S._svc = svc;
                            S.answers = {};
                            S._jobNotes = '';
                            S._curatedMode = true;
                            S.userTagIds = S.userTagIds || [];
                            sqBuildCuratedIntake(svc); // <- confidence accumulation lives here
                        } else {
                            // Simple service (no questions): seed _svc so curated adlib has service context,
                            // then run chip grid — this is the only step-3 chip path.
                            S._svc = svc;
                            S._curatedMode = false;
                            sqBuildStep3();
                        }
                    }
                    document.getElementById('smartQuoteEngine')?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }

function removeServiceFromCart(id) {
                    State.serviceRequest = State.serviceRequest.filter(s => s.id !== id);
                    _recomputeInstanceLabels();
                    renderCart();
                }

function setStep(step) {
                    State.currentStep = step;
                    const dots = [q('#step1dot'), q('#step2dot'), q('#step3dot'), q('#step4dot')];
                    const conns = [q('#conn1'), q('#conn2'), q('#conn3')];
                    dots.forEach((dot, i) => {
                        if (!dot) return;
                        dot.classList.remove('done', 'active');
                        if (i + 1 < step) dot.classList.add('done');
                        else if (i + 1 === step) dot.classList.add('active');
                    });
                    conns.forEach((conn, i) => {
                        if (!conn) return;
                        conn.classList.remove('done', 'active');
                        if (i + 1 < step) conn.classList.add('done');
                        else if (i + 1 === step) conn.classList.add('active');
                    });
                    // Wire tappable navigation on dot elements
                    bindStepDotNav();
                }

function sqAdjQty(d) {
                    S.qty = Math.max(1, Math.min(99, S.qty + d));
                    document.getElementById('sqQtyV').textContent = S.qty;
                    if (document.getElementById('sqAdlibBox')?.style.display === 'block') sqBuildAdlib();
                }

function sqAnalyze() {
                    if (!DB || !DB.intent_mappings) {
                        toast('Pricing data still loading — please wait a moment.', 'error');
                        return;
                    }
                    const desc = (document.getElementById('sqDescIn')?.value || '').trim();
                    if (!desc) {
                        toast('Please describe the job first.', 'error');
                        return;
                    }

                    S.desc = desc;
                    const intent = detectIntentNLP(desc);

                    // Extract richer NLP context
                    S._objectNoun = extractObject(desc, intent?.key);
                    S._location = extractLocation(desc);
                    S._sizeHint = extractSizeHint(desc, DB.smart_tags || {});

                    // Seed intent from NLP (dynamic_services base price enrichment happens in sqPrepareFlow)
                    const baseIntent = intent || {
                        category: 'other',
                        label: 'General',
                        base: 70,
                        stype: 'Repair',
                        qtyLabel: 'item',
                        key: 'other',
                        group: 'other'
                    };
                    const normSt = (baseIntent.stype || 'Repair').replace('Install / Mount', 'Install');
                    // v9.3 FIX: was building the lookup key with normSt.toLowerCase()
                    // ('minor_home_repairs+repair'), which never matches a real
                    // dynamic_services key (always capitalized service-type casing,
                    // e.g. 'minor_home_repairs+Repair' — see the casing note on
                    // resolveDynamicService above). dynDef was therefore always
                    // undefined here, silently skipping the base-price enrichment
                    // for every free-text SmartQuote query — the most common entry
                    // point in the app. Routes through the shared, already-fixed
                    // resolver instead of duplicating the broken inline lookup.
                    const dynDef = resolveDynamicService(baseIntent.category, normSt, baseIntent._groupId);
                    if (dynDef?.financial_engine?.base_price) baseIntent.base = dynDef.financial_engine.base_price;
                    S.intent = baseIntent;
                    S.manTagIds = [];
                    S.qty = extractQty(desc);
                    document.getElementById('sqQtyV').textContent = S.qty;

                    // SSOT: apply contextual_override injected tags as detected tags
                    if (S.intent._ctxTags?.length) {
                        const cat = S.intent.category || 'other';
                        S.intent._ctxTags.forEach(tid => {
                            if (tagValidForCategory(tid, cat, S.intent._groupId) &&
                                !S.detTagIds.includes(tid) && !S.negatedTagIds.includes(tid))
                                S.detTagIds.push(tid);
                        });
                    }
                    if (S.intent.resolver === 'object_based') {
    const object = extractObject(desc, S.intent.key);
    if (object) {
        const objects = (DB.intent_mappings?.objects || []);
        const objectMap = objects.find(o =>
            object.toLowerCase().includes(o.keyword.toLowerCase()) ||
            o.keyword.toLowerCase().includes(object.toLowerCase())
        );
        if (objectMap) {
            // Override with object-specific values if they exist
            if (objectMap.default_dynamic_category) {
                S.intent.default_dynamic_category = objectMap.default_dynamic_category;
            }
            if (objectMap.default_service_type) {
                S.intent.default_service_type = objectMap.default_service_type;
            }
            if (objectMap.default_service_sku) {
                S.intent.default_service_sku = objectMap.default_service_sku;
            }
            // Update the dynamic key if category changed
            if (objectMap.default_dynamic_category) {
                const newNormSt = (S.intent.default_service_type || 'Install').replace('Install / Mount', 'Install');
                // v9.3 FIX: same lowercase-key bug as the one fixed above in this
                // function — newDynDef was always undefined, so an object-specific
                // category override (e.g. recognizing "TV" -> wall_mounting) never
                // actually re-priced the job from the more specific dynamic_service,
                // even when the NLP correctly identified it.
                const newDynDef = resolveDynamicService(objectMap.default_dynamic_category, newNormSt, S.intent?._groupId);
                if (newDynDef?.financial_engine?.base_price) {
                    S.intent.base = newDynDef.financial_engine.base_price;
                }
            }
        } else {
            // ❌ Object found but not in our map → confidence drops
            S.intent.confidence_weight = 30; // below threshold
        }
    } else {
        // ❌ No object extracted at all → confidence drops significantly
        S.intent.confidence_weight = 10; // well below threshold
    }
}

                    // SSOT: apply contextual adjustment fee/minutes to intent base for computeSQQuote
                    if (S.intent._ctxFee) S.intent._ctxBaseAdjFee = S.intent._ctxFee;
                    if (S.intent._ctxMin) S.intent._ctxBaseAdjMin = S.intent._ctxMin;

                    // ── High-confidence catalog match: auto-select named service ──
                    const AUTO_SELECT_THRESHOLD = 70;
                    const recSku = S.intent?.recommendedSku;
                    const recSvc = recSku ? (DB.services || []).find(sv => sv.id === recSku) : null;
                    if (recSvc && (S.intent._matchConfidence || 0) >= AUTO_SELECT_THRESHOLD) {
                        const autoSelectSnapshot = { desc, intent: S.intent, qty: S.qty };
                        const catId = S.intent.category || recSvc.ui_taxonomy?.category_id || null;
                        prefillSmartQuoteFromService(recSvc, catId);
                        S._autoSelectedFrom = autoSelectSnapshot;
                        return;
                    }

                    // ── Category-matched but no specific service: route to the
                    // best-match group's Other tile. This is what makes
                    // "mount a neon sign" land in wall_mounting_frames_shelves
                    // rather than a generic $70 SmartQuote estimate — the
                    // wizard starts pre-seeded with action + extracted object,
                    // asking only what's still unknown (wall type, weight, etc.)
                    const hasCategory = S.intent?.category && S.intent.category !== 'other';
                    const hasMatchConf = (S.intent?._matchConfidence || 0) >= 50;
                    if (hasCategory && hasMatchConf) {
                        const targetGroupId = resolveGroupFromIntent(
                            S.intent.category,
                            S._objectNoun || '',
                            S.intent.stype || 'Repair',
                            desc
                        );
                        if (targetGroupId) {
                            const targetGroup = (DB.group || []).find(g => g.id === targetGroupId);
                            if (targetGroup) {
                                // Build a synthetic Other tile for this group
                                const normSt = (S.intent.stype || 'Repair').replace('Install / Mount','Install');
                                const dynDef = resolveDynamicService(S.intent.category, normSt, targetGroupId);
                                const synthTile = {
                                    _isOtherTile: true,
                                    id: '_other_' + targetGroupId,
                                    uncovered_service_types: [normSt],
                                    service_type: normSt,
                                    ui_taxonomy: {
                                        display_name: targetGroup.display_name + ' Other',
                                        icon: targetGroup.icon || '✏️',
                                        group_id: targetGroupId,
                                        description: desc // carry the user's original text
                                    },
                                    financial_engine: dynDef?.financial_engine || { pricing_type: 'flat_rate', base_price: 70 }
                                };
                                // Pre-seed S partially so the wizard starts knowing
                                // the description and extracted noun
                                S._nlpSeedDesc = desc;
                                S._nlpSeedObject = S._objectNoun;
                                prefillSmartQuoteFromOtherTile(synthTile, S.intent.category);
                                return;
                            }
                        }
                    }

                    // ── Final fallback: generic SmartQuote pipeline ─────────────
                    sqPrepareFlow(false);
                }

function sqBuildAdlib() {
                    const tags = DB.smart_tags || {};
                    const sent = document.getElementById('sqAdlibSentence');
                    if (!sent) return;
                    // Clear sentence AND any previous logistic note strip
                    sent.innerHTML = '';
                    const prevNote = document.getElementById('sqAdlibLogisticNote');
                    if (prevNote) prevNote.remove();

                    // SSOT: logistic flag from smart_tags[tid].is_logistic (set in v9 JSON)
                    // isLogisticTag() is defined globally above — no hardcoded set needed.

                    // SSOT: verb_natural on the service (set by Python script) or service_types fallback
                    const _stDef = DB.service_types?.[S.stype] || {};
                    const _ctx = (S._objectNoun || S.intent?.label || '').toLowerCase();
                    let verb = S._svc?.verb_natural || _stDef.verb_natural || 'installed';
                    if (_ctx.includes('adjustment')) verb = 'adjusted';
                    else if (_ctx.includes('replacement') || _ctx.includes('replace')) verb = 'replaced';
                    else if (_ctx.includes('repair') && S.stype !== 'Repair') verb = 'repaired';
                    else if (_ctx.includes('assembl')) verb = 'assembled';
                    else if (_ctx.includes('config') || _ctx.includes('setup')) verb = 'configured';
                    const verbOpts = ['installed', 'repaired', 'replaced', 'assembled', 'adjusted', 'set up', 'assessed'];

                    // ── Object noun ───────────────────────────────────────────────
                    const rawKw = (S.intent?.key || '').toLowerCase();
                    const lbl = S.intent?.label || '';
                    let noun = S._objectNoun ||
                        (lbl.toLowerCase() !== rawKw && lbl.length > 2 ? lbl : null) ||
                        'item';

                    // ── Classify scope tags by display_group ──────────────────────
                    const active = [...new Set([...S.detTagIds, ...S.manTagIds])];
                    const scope = active.filter(t => !isLogisticTag(t));
                    const logistic = active.filter(t => isLogisticTag(t));

                    const byGroup = {};
                    scope.forEach(tid => {
                        const t = tags[tid];
                        if (!t) return;
                        const g = t.display_group || 'Additional Adjustments';
                        (byGroup[g] = byGroup[g] || []).push(tid);
                    });

                    // ── DOM helpers ───────────────────────────────────────────────
                    // Plain connective word
                    const w = (text, style) => {
                        const s = document.createElement('span');
                        s.className = 'adlib-word';
                        if (style) s.style.cssText = style;
                        s.textContent = text;
                        sent.appendChild(s);
                        return s;
                    };

                    // Editable dropdown pill
                    const pill = (key, display, opts, current) => {
                        const p = document.createElement('span');
                        p.className = 'adlib-pill';
                        const lbl = document.createElement('span');
                        lbl.textContent = display;
                        const ico = document.createElement('i');
                        ico.className = 'ti ti-chevron-down';
                        const sel = document.createElement('select');
                        sel.style.cssText = 'position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;';
                        opts.forEach(o => {
                            const op = document.createElement('option');
                            op.value = o;
                            op.textContent = o;
                            if (o === current) op.selected = true;
                            sel.appendChild(op);
                        });
                        sel.addEventListener('change', function() {
                            lbl.textContent = this.value;
                            if (key === 'qty') {
                                S.qty = parseInt(this.value) || 1;
                                document.getElementById('sqQtyV').textContent = S.qty;
                                sqBuildAdlib();
                            }
                            if (key === 'verb') {
                                const rev = {
                                    installed: 'Install',
                                    repaired: 'Repair',
                                    replaced: 'Repair',
                                    assembled: 'Assembly',
                                    adjusted: 'Repair',
                                    'set up': 'Setup',
                                    assessed: 'Diagnostic'
                                };
                                S.stype = rev[this.value] || 'Install';
                                sqBuildAdlib();
                            }
                        });
                        p.appendChild(lbl);
                        p.appendChild(ico);
                        p.appendChild(sel);
                        sent.appendChild(p);
                    };

                    // Inline-editable object noun (the KEY interactive element —
                    // user corrects NLP extraction here; fee doesn't change, understanding does)
                    const editNoun = text => {
                        const s = document.createElement('span');
                        s.className = 'adlib-object';
                        s.contentEditable = 'true';
                        s.spellcheck = false;
                        s.textContent = text;
                        s.title = 'Tap to correct';
                        s.style.cssText = [
                            'display:inline-block', 'min-width:52px', 'padding:3px 10px',
                            'border-radius:8px', 'border:1.5px dashed rgba(222,0,0,.3)',
                            'color:var(--clr-red-dark,#8a0615)', 'font-weight:700', 'font-size:15px',
                            'cursor:text', 'outline:none', 'background:rgba(222,0,0,.05)',
                            'transition:border-color .15s,background .15s'
                        ].join(';');
                        s.addEventListener('focus', () => {
                            s.style.borderColor = 'var(--clr-red,#de0000)';
                            s.style.background = '#fff';
                        });
                        s.addEventListener('blur', () => {
                            s.style.borderColor = 'rgba(222,0,0,.3)';
                            s.style.background = 'rgba(222,0,0,.05)';
                            S._objectNoun = s.textContent.trim() || noun;
                        });
                        s.addEventListener('keydown', e => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                s.blur();
                            }
                        });
                        sent.appendChild(s);
                    };

                    // Removable condition pill — shows fee, removes tag on tap
                    // Matches curated card's ans-chip style: ✓ checkmark + phrase + fee badge
                    const condPill = (tid, phrase) => {
                        const pp = document.createElement('span');
                        pp.className = 'adlib-cond';
                        const t = tags[tid];
                        const fee = t?.fee ?? t?.effects?.fee ?? 0;
                        pp.innerHTML = '<i class="ti ti-check" style="font-size:.65rem;margin-right:3px;opacity:.75"></i>' +
                            phrase +
                            (fee > 0 ? ' <strong style="color:var(--clr-red-dark,#8a0615);font-size:.8em">+$' + fee + '</strong>' : '') +
                            ' <i class="ti ti-x" style="font-size:.6rem;margin-left:4px;opacity:.4"></i>';
                        pp.title = 'Tap to remove — price will update';
                        pp.addEventListener('click', () => {
                            S.manTagIds = S.manTagIds.filter(id => id !== tid);
                            S.detTagIds = S.detTagIds.filter(id => id !== tid);
                            S.userTagIds = (S.userTagIds || []).filter(id => id !== tid);
                            sqBuildStep3();
                        });
                        sent.appendChild(pp);
                    };

                    // Green negation badge — confirms a detail was understood as absent
                    // (e.g. "✓ not heavy" → tells user the system won't charge the heavy surcharge)
                    const negBadge = label => {
                        const pp = document.createElement('span');
                        pp.style.cssText = [
                            'display:inline-flex', 'align-items:center', 'gap:4px',
                            'padding:3px 9px', 'border-radius:8px',
                            'background:#f0fdf4', 'color:#166534', 'border:1px solid #bbf7d0',
                            'font-size:12px', 'font-weight:600', 'margin:2px'
                        ].join(';');
                        pp.innerHTML = '<i class="ti ti-check" style="font-size:11px"></i> ' + label;
                        pp.title = 'Confirmed: system understood this from your description';
                        sent.appendChild(pp);
                    };

                    // Grey context badge — non-removable context (location, size)
                    const ctxBadge = (text, icon) => {
                        const pp = document.createElement('span');
                        pp.style.cssText = [
                            'display:inline-flex', 'align-items:center', 'gap:4px',
                            'padding:3px 9px', 'border-radius:8px',
                            'background:rgba(0,0,0,.04)', 'color:#666', 'border:1px solid rgba(0,0,0,.1)',
                            'font-size:12px', 'font-weight:500', 'margin:2px'
                        ].join(';');
                        // v9.4 SECURITY FIX: `text` here is frequently S._location or
                        // S._sizeHint — both NLP-extracted from the raw SmartQuote
                        // textarea value — interpolated unescaped into innerHTML
                        // before this fix (CodeQL: "DOM text reinterpreted as HTML").
                        // The icon class itself is always an internal literal (never
                        // user-derived) so it's left unescaped, same as buildPreview's
                        // equivalent pattern.
                        pp.innerHTML = (icon ? '<i class="ti ' + icon + '" style="font-size:11px;opacity:.5"></i> ' : '') + escapeHtml(text);
                        sent.appendChild(pp);
                    };

                    // ── BUILD THE SENTENCE ────────────────────────────────────────
                    // Target natural English: 
                    //   "I need 2 neon signs installed on brick +$25 · heavy item +$40 · in my bedroom"

                    w(DB.ui_config?.adlib?.sentence_start || 'I need');

                    // Qty pill (number only — noun comes right after in the editable span)
                    pill('qty', String(S.qty), ['1', '2', '3', '4', '5', '6', '8', '10', '12'], String(S.qty));

                    // Object noun — NLP-extracted, inline editable, naturally follows the qty
                    // Pluralise naively when qty > 1
                    const displayNoun = (() => {
                        if (S.qty <= 1) return noun;
                        if (noun.endsWith('s')) return noun; // already plural
                        if (noun.endsWith('ey') || noun.endsWith('ay')) return noun + 's';
                        return noun + 's';
                    })();
                    editNoun(displayNoun);

                    // Verb pill — "installed ▾", "repaired ▾" etc.
                    pill('verb', verb, verbOpts, verb);

                    // ── INTAKE ANSWERS (curated-mode): show as answer badges ────────
                    // When called after sqBuildCuratedIntake confirms (sqConfirmAdlib),
                    // show answered intake questions inline — matches curated card adlib output.
                    if (S._svc && S.answers && Object.keys(S.answers).length > 0) {
                        const _QM = new Set(['item_count', 'count', 'hybrid_qty', 'global_quantity']);
                        const _allResolvedMods = _resolveIntakeChain(S._svc);
                        const _answeredMods = _allResolvedMods.filter(m =>
                            !_QM.has(m.moduleKey) && _isModVisible(m, S.answers, _allResolvedMods) && S.answers[m.moduleKey]
                        );
                        if (_answeredMods.length > 0) {
                            w('·', 'color:#bbb;margin:0 2px;font-weight:300;');
                            _answeredMods.forEach((mod, idx) => {
                                const label = S.answers[mod.moduleKey];
                                if (idx > 0) w('and', 'color:#bbb;margin:0 2px;');
                                const ans = document.createElement('span');
                                ans.className = 'adlib-cond';
                                ans.style.cssText = 'background:rgba(22,163,74,.08);border-color:rgba(22,163,74,.3);color:#15803d;cursor:default;';
                                ans.innerHTML = '<i class="ti ti-check" style="font-size:.65rem;margin-right:3px"></i>' +
                                    (label.length > 28 ? label.slice(0, 26) + '…' : label);
                                sent.appendChild(ans);
                            });
                        }
                    }

                    // ── SCOPE CONDITIONS (in sentence, each removable) ────────────
                    // A "·" separator appears before the first condition — keeps the sentence
                    // visually clear: "I need 1 neon sign installed · on brick · heavy item"
                    const _anyScope = scope.length > 0;
                    if (_anyScope) w(DB.ui_config?.adlib?.scope_separator || '·', 'color:#bbb;margin:0 2px;font-weight:300;');

                    // SSOT: phrase from tag.ui_phrase → adlib_phrase_overrides.group_templates → label
                    // Eliminates wallPhrases, plumbPhrases, constraintPhrases, scopeAdjPhrases, negPhrases
                    const _grpTpls = DB.adlib_phrase_overrides?.group_templates || {};
                    const _dfltTpl = DB.adlib_phrase_overrides?.default_template || '{label}';
                    const sqPhrase = tid => {
                        const t = tags[tid];
                        if (!t) return sqTagLabel(null, tid);
                        if (t.ui_phrase) return t.ui_phrase;
                        const tpl = _grpTpls[t.display_group || 'Additional Adjustments'] || _dfltTpl;
                        return tpl.replace('{label}', sqTagLabel(t, tid));
                    };
                    // Render all non-logistic scope tags using sqPhrase() — group loops removed
                    scope.forEach(tid => condPill(tid, sqPhrase(tid)));

                    // SSOT: negation confirmations from tag.negation_phrase → "✓ not {label}"
                    S.negatedTagIds.forEach(tid => {
                        if (!tags[tid]) return;
                        const np = tags[tid].negation_phrase;
                        negBadge(np ? '✓ ' + np : '✓ not ' + sqTagLabel(tags[tid], tid));
                    });

                    // ── CONTEXT BADGES ────────────────────────────────────────────
                    if (S._location) ctxBadge('in my ' + S._location, 'ti-map-pin');
                    if (S._sizeHint === 'standard')
                        ctxBadge('standard size', 'ti-ruler-2');
                    else if (S._sizeHint === 'large' || S._sizeHint === 'oversized')
                        ctxBadge(S._sizeHint, 'ti-arrows-maximize');

                    // ── LOGISTIC SURCHARGES STRIP ────────────────────────────────
                    // Below the sentence — fees the user should see but aren't part
                    // of describing the job (parking, pets, disposal, etc.)
                    if (logistic.length) {
                        const strip = document.createElement('div');
                        strip.id = 'sqAdlibLogisticNote';
                        strip.style.cssText = [
                            'margin-top:10px', 'padding:7px 12px',
                            'background:rgba(0,0,0,.03)', 'border-radius:8px',
                            'border:1px solid rgba(0,0,0,.07)',
                            'font-size:12px', 'color:#666',
                            'display:flex', 'flex-wrap:wrap', 'gap:6px', 'align-items:center'
                        ].join(';');
                        const lbl = document.createElement('span');
                        lbl.style.cssText = 'font-weight:700;color:#999;font-size:11px;text-transform:uppercase;letter-spacing:.05em;flex-shrink:0;';
                        lbl.textContent = 'Surcharges:';
                        strip.appendChild(lbl);
                        logistic.forEach(tid => {
                            const t = tags[tid];
                            if (!t) return;
                            const fee = t.fee ?? t.effects?.fee ?? 0;
                            const chip = document.createElement('span');
                            chip.style.cssText = 'display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:6px;background:#fff;border:1px solid rgba(0,0,0,.12);font-size:12px;cursor:pointer;';
                            chip.innerHTML = sqTagLabel(t, tid) +
                                (fee > 0 ? ' <strong style="color:var(--clr-red-dark,#8a0615)">+$' + fee + '</strong>' : '') +
                                ' <i class="ti ti-x" style="font-size:10px;opacity:.4;margin-left:2px"></i>';
                            chip.title = 'Tap to remove this surcharge';
                            chip.addEventListener('click', () => {
                                S.manTagIds = S.manTagIds.filter(id => id !== tid);
                                S.detTagIds = S.detTagIds.filter(id => id !== tid);
                                S.userTagIds = (S.userTagIds || []).filter(id => id !== tid);
                                sqBuildStep3();
                            });
                            strip.appendChild(chip);
                        });
                        // Insert strip after the adlib box
                        const box = document.getElementById('sqAdlibBox');
                        if (box?.parentNode) box.parentNode.insertBefore(strip, box.nextSibling);
                    }

                    const box = document.getElementById('sqAdlibBox');
                    if (box) box.style.display = 'block';
                    const bb = document.getElementById('sqS3build');
                    if (bb) bb.style.display = 'none';
                }

function sqBuildCuratedIntake(svc) {
                    S._svc = svc;
                    S.answers = S.answers || {};
                    S._jobNotes = S._jobNotes || '';
                    S._curatedMode = true;
                    S.userTagIds = S.userTagIds || [];

                    // ── JSON-sourced constants ────────────────────────────────────
                    const QTY_MODS = new Set(['item_count', 'count', 'hybrid_qty', 'global_quantity', 'Install / Mount', 'Install']);
                    const allMods = _resolveIntakeChain(svc);

                    // SSOT: S._forceModules (set in sqPrepareFlow from
                    // global_rules.force_modules_by_variability) lists modules
                    // that MUST be present for this variability tier — was set
                    // but never consumed here until now. Inject any forced
                    // module not already in the resolved chain (skip if the
                    // module doesn't exist in DB.intake_modules, since a bad
                    // ref shouldn't break the whole intake card).
                    const forceMods = S._forceModules || [];
                    const existingKeys = new Set(allMods.map(m => m.moduleKey));
                    for (const fKey of forceMods) {
                        if (!existingKeys.has(fKey) && DB.intake_modules?.[fKey]) {
                            allMods.push({
                                moduleKey: fKey,
                                then: {},
                                ...DB.intake_modules[fKey],
                                _forced: true  // flag: injected by variability tier, not service chain
                            });
                            existingKeys.add(fKey);
                        }
                    }

                    const realMods = allMods.filter(m => !QTY_MODS.has(m.moduleKey));

                    // confidence_strategy from service JSON (or defaults)
                    const confStrat = svc.confidence_strategy || {};
                    const minConf = confStrat.minimum_quote_confidence || 80;
                    const maxQs = confStrat.maximum_followup_questions || 5;

                    // checkout_states message for this service
                    const csKey = svc.financial_engine?.checkout_state || 'standard_flat_rate';
                    const csObj = DB.checkout_states?.[csKey] || {};

                    // meta.estimate_disclaimers
                    const discKey = svc.default_estimates?.disclaimer || 'flat_fee';
                    const disclaimer = DB.meta?.estimate_disclaimers?.[discKey] || csObj.ui_message || '';

                    // service_types base price fallback
                    const stNorm = (svc.service_type || 'Install').replace('Install / Mount', 'Install');
                    const stDef = DB.service_types?.[stNorm] || {};
                    const basePrice = svc.financial_engine?.base_price || stDef.base_price || 0;

                    // v9.2: removed a dead tierKey/hourlyRate calculation here —
                    // confirmed via exhaustive search that neither variable was ever
                    // read anywhere in this file. om (operational_metrics) is still
                    // used below for the live complexity-escalation tracking that
                    // DOES feed the real price (see _exactTier wiring further down).

                    const om = svc.operational_metrics || {};

                    const tags = DB.smart_tags || {};
                    const catId = S.intent?.category || svc.ui_taxonomy?.category_id || '';
                    const groupId = svc.ui_taxonomy?.group_id || S.intent?._groupId || '';
                    const svcName = svc.ui_taxonomy?.display_name || svc.id;
                    const catObj = categoryMap.get(catId);
                    const grpObj = groupMap.get(groupId);
                    const catName = catObj?.display_name || '';
                    const grpName = grpObj?.display_name || '';

                    const svcVerb = (() => {
                        const n = svcName.toLowerCase();
                        if (n.includes('install') || n.includes('mount')) return 'installed';
                        if (n.includes('repair') || n.includes('fix')) return 'repaired';
                        if (n.includes('assembl')) return 'assembled';
                        if (n.includes('replace')) return 'replaced';
                        return 'done';
                    })();
                    const isDoorLike = groupId.includes('door') || svcName.toLowerCase().includes('door');
                    const qtyNoun = isDoorLike ? 'door' : 'item';

                    // ── Seed suggested_tags from dynamic_services ─────────────────
                    if (!S._suggestedTagIds?.length) {
                        S._suggestedTagIds = [];
                        const dynDef = resolveDynamicService(catId, stNorm, groupId);
                        (dynDef?.suggested_tags || []).forEach(tagObj => {
                            if (!tagObj?.$ref) return;
                            const tagId = '#' + tagObj.$ref.split('/').pop().replace(/^#/, '');
                            if (tags[tagId] && !S._suggestedTagIds.includes(tagId)) S._suggestedTagIds.push(tagId);
                        });
                    }

                    // ── Constraint chips: suggested_tags + universal tags, no noise ─
                    const NOISE = new Set(['#plumbing', '#electrical', '#wall_mount', '#flushometer',
                        '#bidet_attachment', '#flushometer_bidet', '#virus', '#wifi_dead_zone',
                        '#data_recovery', '#cracked_tile', '#broken_leg', '#scratched_surface',
                        '#wobbly', '#furniture_assembly_ikea', '#leaky_faucet', '#clogged_drain',
                        '#toilet_running', '#fan_box_missing'
                    ]);
                    const getCuratedTids = () => {
                        const suggested = new Set(S._suggestedTagIds || []);
                        return Object.keys(tags).filter(tid => {
                            if (NOISE.has(tid)) return false;
                            return tagValidForCategory(tid, catId, groupId);
                        }).sort((a, b) => (suggested.has(a) ? 0 : 1) - (suggested.has(b) ? 0 : 1));
                    };

                    // ── requires enforcement ──────────────────────────────────────
                    const enforceRequires = (tid) => {
                        (tags[tid]?.requires || []).forEach(r => {
                            const req = typeof r === 'string' ? r : (r?.$ref ? '#' + r.$ref.split('/').pop().replace(/^#/, '') : null);
                            if (req && tags[req] && !S.manTagIds.includes(req) && !S.detTagIds.includes(req)) {
                                S.manTagIds.push(req);
                                if (!S.userTagIds.includes(req)) S.userTagIds.push(req);
                            }
                        });
                    };

                    // Open step 3
                    sqUnlock(3);
                    sqOpen(3);
                    const sb3 = document.getElementById('sqSb3');
                    if (!sb3) return;

                    // ── RENDER ────────────────────────────────────────────────────
                    const render = () => {
                        const answers = S.answers;
                        const exist = new Set([...S.manTagIds, ...S.detTagIds]);
                        const suggested = new Set(S._suggestedTagIds || []);
                        const curTids = getCuratedTids();

                        // Compute pricing from intake answers (reads intake_modules.effects via _resolveIntakeChain)
                        let intakeFee = 0,
                            intakeMin = 0;
                        realMods.forEach(mod => {
                            if (!_isModVisible(mod, answers, allMods)) return;
                            const chosen = (mod.client_response || []).find(r => r.label === answers[mod.moduleKey]);
                            if (!chosen) return;
                            intakeFee += chosen.effects?.fee || 0;
                            intakeMin += chosen.effects?.minutes || 0;
                        });

                        // ── CONFIDENCE CALCULATION ───────────────────────────────────
                        // SSOT: confidence = base + module gains + NLP match + tag complexity.
                        // This is an INTERNAL metric — drives the estimate button gate only.
                        // Not shown to the user: the adlib sentence + answered dot indicators
                        // communicate progress better than a % bar would.
                        const _baseConf2 = svc.confidence_strategy?.base_confidence ?? 40;
                        let conf = _baseConf2;
                        // Module gains (already answered, visible)
                        realMods.forEach(mod => {
                            if (_isModVisible(mod, answers, allMods) && answers[mod.moduleKey])
                                conf += (mod.confidence_gain || 15);
                        });
                        // NLP match contribution — if the user's typed text already
                        // identified this service with high confidence, that should
                        // count toward the estimate bar (avoids requiring unnecessary
                        // questions when NLP is already 85% sure of the intent).
                        const nlpBonus = Math.min(20, (S.intent?._matchConfidence || 0) * 0.2);
                        conf += nlpBonus;
                        // Active tag complexity contribution — a user who has explicitly
                        // confirmed a complexity tag (#heavy_item, #high_ceiling) has
                        // provided real, pricing-relevant information that raises confidence.
                        const activeTagIds = [...new Set([...S.detTagIds, ...S.manTagIds])].filter(tid => !S.negatedTagIds.includes(tid));
                        const tagBonus = Math.min(15, activeTagIds.reduce((sum, tid) => {
                            const co = tags[tid]?.effects?.complexity_override;
                            return sum + (co === 'specialized' ? 10 : co === 'skilled' ? 5 : 0);
                        }, 0));
                        conf += tagBonus;
                        conf = Math.min(conf, 100);
                        const ready = conf >= minConf;

                        // Total tag fee from currently-active tags (detTagIds + manTagIds)
                        // Tags are already in S at this point — include them in the
                        // preview so "from $X" doesn't understate once surcharges apply.
                        const detAndManEarly = [...new Set([...S.detTagIds, ...S.manTagIds])].filter(tid => !S.negatedTagIds.includes(tid));
                        const tagFeeTotal = detAndManEarly.reduce((sum, tid) => {
                            const t = tags[tid];
                            return sum + (t?.fee ?? t?.effects?.fee ?? 0);
                        }, 0);
                        const livePrice = basePrice + intakeFee + tagFeeTotal;
                        // "from" is only accurate when the price can still go up due
                        // to unanswered modules. Once all questions are answered (or
                        // there are none), show the exact current total instead.
                        const pricePrefix = (remaining > 0 && tagFeeTotal === 0) ? 'from ' : '';
                        const visibleMods = realMods.filter(m => _isModVisible(m, answers, allMods));
                        const answered = visibleMods.filter(m => answers[m.moduleKey]).length;
                        const total = visibleMods.length;
                        const remaining = total - answered;
                        const allQsDone = answered === total;

                        // ── Preserve hidden anchor elements for engine compatibility ─
                        sb3.innerHTML = `
        <div id="sqDetTags"  style="display:none"></div>
        <div id="sqDynGroups" style="display:none"></div>
        <span id="sqQtyV"    style="display:none">${S.qty}</span>
        <span id="sqQtyLbl"  style="display:none"></span>
        <div  id="sqAdlibBox" style="display:none"><div id="sqAdlibSentence"></div></div>`;

                        const card = document.createElement('div');
                        card.className = 'sq-ic';

                        // ─── SERVICE HEADER ─────────────────────────────────────────
                        // From: ui_taxonomy, financial_engine, operational_metrics, checkout_states
                        // v9.4 SECURITY FIX: builderDesc is sourced from S.desc, which
                        // is set directly from the raw SmartQuote textarea value
                        // elsewhere (sqAnalyze) — escaped here before interpolation
                        // into the innerHTML template literal below. See the
                        // escapeHtml() definition's comment for the full vulnerability
                        // this closes (CodeQL: "DOM text reinterpreted as HTML").
                        const builderDesc = (S._fromBuilder && S.desc && S.desc !== svcName) ? escapeHtml(S.desc) : null;
                        const dots = realMods.map(m =>
                            `<span class="sq-ic-dot ${answers[m.moduleKey]?'done':''}"></span>`).join('');
                        card.innerHTML += `
        <div class="sq-ic-hdr">
          <div class="sq-ic-hdr-icon">${svc.ui_taxonomy?.icon || '🔧'}</div>
          <div class="sq-ic-hdr-body">
            <h2 class="sq-ic-hdr-name">${svcName}</h2>
            <p class="sq-ic-hdr-desc">${svc.ui_taxonomy?.description || ''}</p>
            ${builderDesc ? `<div class="sq-ic-builder-note"><i class="ti ti-sparkles" style="font-size:.85em;margin-right:4px;opacity:.6"></i><em>"${builderDesc}"</em></div>` : ''}
            <div class="sq-ic-hdr-foot">
              <span class="sq-ic-price"><i style="font-style:italic;font-size:.72em">${pricePrefix}</i>$${livePrice}${(intakeFee+tagFeeTotal)>0?`<span style="font-size:.72em;opacity:.75;margin-left:2px">(+$${intakeFee+tagFeeTotal})</span>`:''}</span>
              <span class="sq-ic-prog">${dots}<span>${answered} of ${total} answered</span></span>
            </div>
          </div>
        </div>`;

                        // ─── BREADCRUMB (category › group › service) ────────────────
                        if (catName || grpName) {
                            const parts = [];
                            if (catName) parts.push(`<span>${catName}</span>`);
                            if (grpName) parts.push(`<span>${grpName}</span>`);
                            parts.push(`<span class="cur">${svcName}</span>`);
                            card.innerHTML += `<div class="sq-ic-crumb">${parts.join('<span class="arr">›</span>')}</div>`;
                        }

                        // ─── NLP DETECTED TAGS ROW ────────────────────────────────────
                        // Shows detected tags (and negations) from description/notes above
                        // the intake questions — bridges old chip-grid UX and curated card.
                        // These are read-only confirmations ("we understood this from your text").
                        const detAndMan = [...new Set([...S.detTagIds, ...S.manTagIds])];
                        if (detAndMan.length > 0 || S.negatedTagIds.length > 0) {
                            let nlpRow = `<div class="sq-ic-nlp-row">
              <span class="sq-ic-nlp-lbl">We understood:</span>`;
                            S.negatedTagIds.forEach(tid => {
                                if (!tags[tid]) return;
                                nlpRow += `<span class="sq-ic-nlp-chip neg" title="Confirmed absent — no surcharge"><i class="ti ti-check"></i> ✓ not ${sqTagLabel(tags[tid],tid)}</span>`;
                            });
                            detAndMan.forEach(tid => {
                                if (!tags[tid]) return;
                                const fee = tags[tid].fee ?? tags[tid].effects?.fee ?? 0;
                                nlpRow += `<span class="sq-ic-nlp-chip pos" data-tid="${tid}" title="Tap to remove">
                  ${sqTagLabel(tags[tid],tid)}${fee>0?` <strong>+$${fee}</strong>`:''}
                  <i class="ti ti-x" style="font-size:.6rem;margin-left:3px;opacity:.55"></i>
                </span>`;
                            });
                            nlpRow += `</div>`;
                            card.innerHTML += nlpRow;
                        }

                        // ─── INTAKE QUESTIONS ─────────────────────────────────────────
                        // Sourced from intake_modules via _resolveIntakeChain
                        // Only show maximum_followup_questions at a time (from confidence_strategy)
                        if (realMods.length > 0) {
                            let qHtml = `<div class="sq-ic-qs">
          <div class="sq-ic-qs-hdr">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
            Job specifics
          </div>`;
                            let shown = 0;
                            visibleMods.forEach(mod => {
                                const isDone = !!answers[mod.moduleKey];
                                // FIXED: cap counts only UNANSWERED questions, not total
                                // visible modules. An answered module doesn't consume a cap
                                // slot — this was hiding branching follow-up modules when
                                // the parent question (already answered) had already used
                                // up a slot (e.g. wall_type answered → masonry_anchor
                                // appeared but maxQs=2 was already reached by counting
                                // the answered wall_type itself as slot 1).
                                if (!isDone && shown >= maxQs) return;
                                if (!isDone) shown++;
                                qHtml += `
          <div class="sq-ic-q">
            <div class="sq-ic-q-lbl">
              <span><span class="sq-ic-q-num ${isDone?'done':''}">${shown}</span>${mod.question}</span>
              ${mod.affects_price ? `<span class="sq-ic-price-tag"><i class="ti ${DB.ui_config?.affects_price_icon||'ti-currency-dollar'}"></i></span>` : ''}
            </div>
            <div class="sq-ic-grid">`;
                                (mod.client_response || []).forEach(resp => {
                                    const isSel = answers[mod.moduleKey] === resp.label;
                                    const fee = resp.effects?.fee || 0;
                                    const mins = resp.effects?.minutes || 0;
                                    // Show time impact too if significant (from intake_modules.effects.minutes)
                                    const impact = fee > 0 ? `+$${fee}` : (mins > 0 ? `+${mins}min` : '');
                                    qHtml += `<button type="button" class="sq-ic-btn${isSel?' sel':''}"
              data-mod="${mod.moduleKey}" data-label="${resp.label.replace(/"/g,'&quot;')}">
              <span>${resp.label}</span>${impact ? `<span class="sq-ic-fee">${impact}</span>` : ''}
            </button>`;
                                });
                                qHtml += `</div></div>`;
                            });
                            qHtml += '</div>';
                            card.innerHTML += qHtml;
                        }

                        // ─── CONSTRAINT CHIPS + NOTES (only after all questions answered) ─
                        // Shows suggested_tags prominently, then other valid tags
                        // Avoids cluttering the Q-focused screen
                        if (allQsDone) {
                            const curTids = getCuratedTids();
                            let extHtml = `<div class="sq-ic-extra">
          <div class="sq-ic-extra-title">Any special conditions?
            <span style="font-weight:400;font-size:.72rem;color:#9ca3af;margin-left:6px">optional — tap to add</span>
          </div>
          <div class="sq-ic-chips-row">`;
                            curTids.forEach(tid => {
                                const t = tags[tid];
                                const sel = exist.has(tid) && !S.negatedTagIds.includes(tid);
                                const isSug = suggested.has(tid);
                                const fee = t.fee ?? t.effects?.fee ?? 0;
                                const lbl = sqTagLabel(t, tid);
                                extHtml += `<span class="sq-ic-chip${sel?' sel':isSug&&!sel?' hint':''}" data-tid="${tid}">
            ${sel ? '' : isSug ? '✦ ' : '+ '}${lbl}${fee>0?`<span class="sq-ic-chip-fee"> +$${fee}</span>`:''}
          </span>`;
                            });
                            extHtml += `</div>
          <textarea class="sq-ic-notes" placeholder="Add details (e.g. rough opening is 30×80, door swings left)…">${S._jobNotes||''}</textarea>
        </div>`;
                            card.innerHTML += extHtml;
                        }

                        // ─── ADLIB SUMMARY SENTENCE ──────────────────────────────────
                        // "In [Category] › [Group] I need [qty▾] [ServiceName] [verb▾]
                        //  · [✓ AnswerA] and [✓ AnswerB] · [tag ×]"
                        const answeredMods = visibleMods.filter(m => answers[m.moduleKey]);
                        const activeCons = [...exist].filter(tid => tags[tid] && getCuratedTids().includes(tid));

                        let adlibHtml = `<div class="sq-ic-adlib" id="sqCuratedAdlib">`;
                        if (catName) adlibHtml += `<span class="aw">In</span><span class="ab">${catName}</span>`;
                        if (grpName) adlibHtml += `<span class="aw">›</span><span class="ab">${grpName}</span>`;
                        adlibHtml += `<span class="aw"> I need </span>
        <span class="ap"><span>${S.qty}</span><i class="ti ti-chevron-down"></i>
          <select id="sqCurQtySel">${['1','2','3','4','5','6','8','10'].map(v=>`<option${v==S.qty?' selected':''}>${v}</option>`).join('')}</select>
        </span>
        <span style="font-weight:800;color:var(--clr-red-dark,#8a0615)">${svcName}</span>
        <span class="ap"><span>${svcVerb}</span><i class="ti ti-chevron-down"></i>
          <select id="sqCurVerbSel">${['installed','repaired','replaced','assembled','adjusted','set up'].map(v=>`<option${v===svcVerb?' selected':''}>${v}</option>`).join('')}</select>
        </span>`;
                        if (answeredMods.length > 0) {
                            adlibHtml += `<span class="aw"> · </span>`;
                            answeredMods.forEach((mod, i) => {
                                const label = answers[mod.moduleKey];
                                if (i > 0) adlibHtml += `<span class="aw"> and </span>`;
                                adlibHtml += `<span class="ans"><i class="ti ti-check" style="font-size:.62rem"></i>${label.length>26?label.slice(0,24)+'…':label}</span>`;
                            });
                        }
                        if (activeCons.length > 0) {
                            adlibHtml += `<span class="aw"> · </span>`;
                            activeCons.slice(0, 3).forEach(tid => {
                                adlibHtml += `<span class="cond" data-tid="${tid}">${sqTagLabel(tags[tid],tid)}<i class="ti ti-x" style="font-size:.6rem;margin-left:3px;opacity:.55"></i></span>`;
                            });
                        }
                        adlibHtml += `</div>`;

                        const sumHtml = `<div class="sq-ic-summary">
        <div class="sq-ic-sum-hdr">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 11l3 3L22 4"/></svg>
          Summary of request
        </div>
        <div class="sq-ic-qty">
          <button class="sq-ic-qty-btn" id="sqCurQtyDec">−</button>
          <span class="sq-ic-qty-val" id="sqCurQtyVal">${S.qty}</span>
          <button class="sq-ic-qty-btn" id="sqCurQtyInc">+</button>
          <span class="sq-ic-qty-lbl">${qtyNoun}${S.qty!==1?'s':''}</span>
        </div>
        ${adlibHtml}
        <div class="sq-ic-cta">
          <button class="sq-ic-est ${ready?'ready':'locked'}" id="sqCurEstBtn" ${ready?'':'disabled'}>
            ${ready
              ? `<i class="ti ti-calculator"></i> Review Estimate — $${livePrice * S.qty}`
              : remaining > 0
                ? `<span style="font-size:.82rem">Answer ${remaining} more question${remaining!==1?'s':''} to continue</span>`
                : `<span style="font-size:.82rem">Add more detail in the notes to continue</span>`}
          </button>
          <button class="sq-ic-back" id="sqCurBackBtn">← Back</button>
        </div>
        ${disclaimer ? `<p style="font-size:.68rem;color:#9ca3af;margin-top:10px;line-height:1.4">${disclaimer}</p>` : ''}
      </div>`;
                        card.innerHTML += sumHtml;
                        sb3.appendChild(card);

                        // ── WIRE EVENTS ──────────────────────────────────────────────

                        // Question buttons — feed S.answers + apply tag effects
                        card.querySelectorAll('.sq-ic-btn[data-mod]').forEach(btn => {
                            btn.addEventListener('click', () => {
                                S.answers[btn.dataset.mod] = btn.dataset.label;
                                const mod = realMods.find(m => m.moduleKey === btn.dataset.mod);
                                const resp = (mod?.client_response || []).find(r => r.label === btn.dataset.label);
                                // complexity_override: update session if response escalates/de-escalates
                                if (resp?.effects?.complexity_override && S.intent) {
                                    const TIER = {
                                        routine: 0,
                                        skilled: 1,
                                        specialized: 2
                                    };
                                    const cur = TIER[S.intent._exactTier || 'skilled'] || 1;
                                    const nxt = TIER[resp.effects.complexity_override] || 1;
                                    if (nxt > cur) S.intent._exactTier = resp.effects.complexity_override;
                                }
                                // Apply response tags to detTagIds
                                (resp?.tags || []).forEach(tagRef => {
                                    const tid = typeof tagRef === 'string' ? tagRef :
                                        (tagRef?.$ref ? '#' + tagRef.$ref.split('/').pop().replace(/^#/, '') : null);
                                    if (tid && tags[tid] && !S.detTagIds.includes(tid) && !S.manTagIds.includes(tid))
                                        S.detTagIds.push(tid);
                                });
                                render();
                            });
                        });

                        // Constraint chips
                        card.querySelectorAll('.sq-ic-chip[data-tid]').forEach(chip => {
                            chip.addEventListener('click', () => {
                                const tid = chip.dataset.tid;
                                if (chip.classList.contains('sel')) {
                                    S.manTagIds = S.manTagIds.filter(x => x !== tid);
                                    S.detTagIds = S.detTagIds.filter(x => x !== tid);
                                    S.userTagIds = S.userTagIds.filter(x => x !== tid);
                                } else {
                                    S.negatedTagIds = S.negatedTagIds.filter(x => x !== tid);
                                    (tags[tid]?.mutually_exclusive || []).forEach(sib => {
                                        S.manTagIds = S.manTagIds.filter(x => x !== sib);
                                        S.detTagIds = S.detTagIds.filter(x => x !== sib);
                                        S.userTagIds = S.userTagIds.filter(x => x !== sib);
                                    });
                                    if (!S.manTagIds.includes(tid)) S.manTagIds.push(tid);
                                    if (!S.userTagIds.includes(tid)) S.userTagIds.push(tid);
                                    enforceRequires(tid);
                                }
                                render();
                            });
                        });

                        // NLP row chip removal — user removes a detected tag
                        card.querySelectorAll('.sq-ic-nlp-chip.pos[data-tid]').forEach(el => {
                            el.addEventListener('click', () => {
                                const tid = el.dataset.tid;
                                S.manTagIds = S.manTagIds.filter(x => x !== tid);
                                S.detTagIds = S.detTagIds.filter(x => x !== tid);
                                S.userTagIds = (S.userTagIds || []).filter(x => x !== tid);
                                render();
                            });
                        });

                        // Adlib cond chip removal
                        card.querySelectorAll('.sq-ic-adlib .cond[data-tid]').forEach(el => {
                            el.addEventListener('click', () => {
                                const tid = el.dataset.tid;
                                S.manTagIds = S.manTagIds.filter(x => x !== tid);
                                S.detTagIds = S.detTagIds.filter(x => x !== tid);
                                S.userTagIds = S.userTagIds.filter(x => x !== tid);
                                render();
                            });
                        });

                        // Notes: immediate state update, debounced NLP + re-render.
                        // The slowness came from calling render() on every keystroke —
                        // re-rendering the full intake card (questions, confidence,
                        // adlib, price) is expensive. Now: S._jobNotes updates
                        // immediately (user sees their text at native speed), NLP
                        // suggestion detection + card re-render are debounced 400ms
                        // (fires only after typing pauses, not during every character).
                        const ta = card.querySelector('.sq-ic-notes');
                        let _notesTid;
                        if (ta) ta.addEventListener('input', () => {
                            S._jobNotes = ta.value; // immediate — no lag on text entry
                            clearTimeout(_notesTid);
                            _notesTid = setTimeout(() => {
                                if (ta.value.length > 5) {
                                    const nlp = detectTagsNLP(ta.value);
                                    nlp.found.forEach(tid => {
                                        if (tagValidForCategory(tid, catId, groupId) &&
                                            !S.detTagIds.includes(tid) &&
                                            !S.manTagIds.includes(tid) &&
                                            !S.negatedTagIds.includes(tid) &&
                                            !(S._suggestedTagIds || []).includes(tid))
                                            (S._suggestedTagIds = S._suggestedTagIds || []).push(tid);
                                    });
                                }
                                render(); // full re-render only after 400ms pause
                            }, 400);
                        });

                        // Qty stepper
                        card.querySelector('#sqCurQtyDec')?.addEventListener('click', () => {
                            S.qty = Math.max(1, S.qty - 1);
                            render();
                        });
                        card.querySelector('#sqCurQtyInc')?.addEventListener('click', () => {
                            S.qty = Math.min(99, S.qty + 1);
                            render();
                        });
                        card.querySelector('#sqCurQtySel')?.addEventListener('change', e => {
                            S.qty = parseInt(e.target.value) || 1;
                            render();
                        });

                        // Estimate CTA — uses checkout_states to determine button label
                        const estBtn = card.querySelector('#sqCurEstBtn');
                        if (estBtn && ready) {
                            estBtn.addEventListener('click', () => {
                                S._objectNoun = svcName;
                                S.adlibConfirmed = false;
                                // Sync hidden elements
                                const hs = document.getElementById('sqAdlibSentence');
                                if (hs) hs.innerHTML = card.querySelector('#sqCuratedAdlib')?.innerHTML || '';
                                document.getElementById('sqQtyV').textContent = S.qty;
                                sqConfirmAdlib();
                            });
                        }

                        // Back button
                        card.querySelector('#sqCurBackBtn')?.addEventListener('click', sqRestart);
                    };

                    window._sqCuratedRender = render;
                    render();
                }

function sqBuildStep2() {
                    const flow = document.getElementById('sqStepFlow');
                    if (flow) flow.style.display = 'flex';
                    sqUnlock(2);
                    sqOpen(2);
                    // SSOT: type list from ui_config.step2_types; icons from service_types[t].icon
                    const types = DB.ui_config?.step2_types || ['Install', 'Repair', 'Diagnostic', 'Assembly', 'Setup'];
                    const raw = S.intent?.stype || 'Repair';
                    const guess = raw.replace('Install / Mount', 'Install').replace('Install/Mount', 'Install');
                    S.stype = guess;
                    document.getElementById('sqTypeChips').innerHTML = types.map(t => {
                        const icon = DB.service_types?.[t]?.icon || 'ti-circle-check';
                        const ico  = icon.startsWith('ti-') ? `<i class="ti ${icon}"></i>` : `<span>${icon}</span>`;
                        return `<span class="chip${t===guess?' sel':''}" onclick="sqPickType('${t}')" data-type="${t}">${ico} ${t}</span>`;
                    }).join('');
                    const btn = document.getElementById('sqS2next');
                    if (btn) btn.disabled = false;
                }

function sqBuildStep3() {
                    S.manTagIds = [...new Set(S.manTagIds)];
                    applySSOTRules();
                    sqUnlock(3);
                    sqOpen(3);


                    const tags = DB.smart_tags || {};

                    // Detected row
                    let det = '';
                    S.negatedTagIds.forEach(tid => {
                        if (!tags[tid]) return;
                        det += `<span class="chip negated" title="Excluded"><i class="ti ti-x"></i> ${sqTagLabel(tags[tid],tid)}</span>`;
                    });
                    S.detTagIds.forEach(tid => {
                        if (!tags[tid]) return;
                        const t = tags[tid];
                        const _chipFee = t.fee ?? t.effects?.fee ?? 0;
                        det += `<span class="chip gtag sel" data-tid="${tid}" onclick="sqToggleTag(this,'${tid}')"><i class="ti ti-check"></i> ${sqTagLabel(t,tid)}${_chipFee>0?' +$'+_chipFee:''}</span>`;
                    });
                    if (!det) det = '<span style="font-size:13px;color:#999;font-style:italic">None auto-detected from text</span>';
                    document.getElementById('sqDetTags').innerHTML = det;

                    document.getElementById('sqQtyLbl').textContent = S.intent?.qtyLabel || 'item';
                    document.getElementById('sqQtyV').textContent = S.qty;

                    // Grouped chips from SSOT smart_tags
                    const cat = S.intent?.category || 'other';
                    const valid = Object.keys(tags).filter(tid => tagValidForCategory(tid, cat, S.intent?._groupId));
                    const exist = new Set([...S.detTagIds, ...S.negatedTagIds, ...S.manTagIds]);
                    const grouped = {};
                    valid.forEach(tid => {
                        const g = tags[tid].display_group || 'Additional Adjustments';
                        (grouped[g] = grouped[g] || []).push(tid);
                    });

                    let html = '';
                    for (const [gName, gTids] of Object.entries(grouped)) {
                        let chips = '';
                        gTids.forEach(tid => {
                            const t = tags[tid];
                            const sel = exist.has(tid) && !S.negatedTagIds.includes(tid);
                            const locked = !sel && gTids.some(o => exist.has(o) && tags[o]?.mutually_exclusive?.includes(tid));
                            const isHint = (S._suggestedTagIds || []).includes(tid) && !sel;
                            const chipExtra = isHint ? ' sq-hint' : '';
                            const _chipTagFee = t?.fee ?? t?.effects?.fee ?? 0;
                            const _feeSfx = _chipTagFee > 0 ? ` <span class="intake-fee-delta">+$${_chipTagFee}</span>` : '';
                            chips += sel ?
                                `<span class="chip sel gtag" data-tid="${tid}" onclick="sqToggleTag(this,'${tid}')"><i class="ti ti-check"></i> ${sqTagLabel(t,tid)}${_feeSfx}</span>` :
                                `<span class="chip${locked?' locked':''}${chipExtra}" data-tid="${tid}" onclick="sqToggleTag(this,'${tid}')"><i class="ti ti-${isHint?'bulb':'plus'}"></i> ${sqTagLabel(t,tid)}${_feeSfx}</span>`;
                        });
                        if (chips) html += `<div class="group-label">${gName}</div><div class="chips">${chips}</div>`;
                    }
                    document.getElementById('sqDynGroups').innerHTML = html;

                    // Auto-build adlib immediately
                    sqBuildAdlib();
                }

function sqBuilderFinish() {
                    // Resolve human label from group ID (BLD.object/specific are now group IDs)
                    const _rawBldObj = BLD.specific || BLD.object;
                    const _bldGrp = _rawBldObj && DB ? (DB.group || []).find(g => g.id === _rawBldObj) : null;
                    const obj = _bldGrp?.display_name || _rawBldObj || 'item';
                    const action = BLD.action || 'fix';
                    const cond = BLD.condition;
                    const loc = BLD.location;

                    // ── Synthesize description for NLP tag detection & notes ──────
                    let desc = `I need to ${action} my ${obj}`;
                    if (cond) desc += ` because it is ${cond}`;
                    if (loc) desc += ` in my ${loc}`;

                    // ── Update textarea so it reflects the built sentence ─────────
                    const textarea = document.getElementById('sqDescIn');
                    if (textarea) textarea.value = desc;

                    // ── Hide builder ──────────────────────────────────────────────
                    const builder = document.getElementById('sqBuilder');
                    if (builder) builder.style.display = 'none';
                    document.getElementById('sqUnifiedActionBtn')?.classList.remove('active');

                    // ── Seed S entirely from builder choices (no NLP re-detection) ─
                    const normStype = (BLD._stype || 'Repair').replace('Install / Mount', 'Install');
                    S.desc = desc;
                    S._objectNoun = obj;
                    S._location = loc || null;
                    S._sizeHint = null;
                    S._notes = null;
                    S.manTagIds = [];
                    S.detTagIds = [];
                    S.negatedTagIds = [];
                    S.qty = BLD.qty || 1;
                    S.stype = normStype;
                    // Resolve display label from group if we have a groupId
                    const _grpObj = BLD._groupId ? (DB.group || []).find(g => g.id === BLD._groupId) : null;
                    const _label = _grpObj?.display_name || obj;

                    S.intent = {
                        category: BLD._cat || 'other',
                        label: _label,
                        group: BLD._keyword || _label,
                        base: 0,
                        stype: normStype,
                        qtyLabel: 'item',
                        key: BLD._keyword || _label,
                        _groupId: BLD._groupId || null,
                    };

                    document.getElementById('sqQtyV').textContent = S.qty;

                    // ── Go directly to pipeline — stype is certain, skip step 2 ──
                    // sqPrepareFlow(true) = skipStep2, goes straight to step 3 chips
                    S._fromBuilder = true; // flag so curated card can show builder description as context
                    sqPrepareFlow(true);
                }

function sqConfirmAdlib() {
                    S.adlibConfirmed = true;
                    if (S._svc && !S._objectNoun) S._objectNoun = S._svc.ui_taxonomy?.display_name || S._svc.id;
                    // Capture any inline edits the user made to the object noun
                    const objEl = document.querySelector('#sqAdlibSentence .adlib-object');
                    if (objEl) S._objectNoun = objEl.textContent.trim() || S._objectNoun;

                    // Build the summary label for the step 3 header
                    const active = [...new Set([...S.detTagIds, ...S.manTagIds])];
                    const labels = active.map(tid => DB.smart_tags?.[tid] ? sqTagLabel(DB.smart_tags[tid], tid) : null).filter(Boolean);
                    const objLabel = S._objectNoun || S.intent?.label || 'item';
                    const locNote = S._location ? ' · ' + S._location : '';
                    sqMarkDone(3, S.qty + '× ' + objLabel + (labels.length ? ' · ' + labels.join(', ') : '') + locNote);

                    // Append all context to handyman notes
                    const noteParts = [];
                    if (S._location) noteParts.push('Location: ' + S._location);
                    if (S._objectNoun) noteParts.push('Item: ' + S._objectNoun);
                    if (S._sizeHint) noteParts.push('Size: ' + S._sizeHint);
                    if (S.negatedTagIds.length) {
                        const negLabels = S.negatedTagIds.map(tid => DB.smart_tags?.[tid] ? sqTagLabel(DB.smart_tags[tid], tid) : tid);
                        noteParts.push('Confirmed NOT: ' + negLabels.join(', '));
                    }
                    if (noteParts.length) S._notes = noteParts.join(' | ');

                    sqRenderQuote();
                }

function sqPickType(t) {
                    document.querySelectorAll('#sqTypeChips .chip').forEach(c => c.classList.toggle('sel', c.dataset.type === t));
                    S.stype = t;
                    const btn = document.getElementById('sqS2next');
                    if (btn) btn.disabled = false;
                }

function sqPrepareFlow(skipStep2) {
                    const desc = S.desc || '';
                    const detCat = S.intent?.category || 'other';

                    // ── NLP tag detection on the description ──────────────────────
                    // (even builder path runs this — description is now synthesized)
                    const nlp = detectTagsNLP(desc);
                    S.detTagIds = nlp.found.filter(tid => tagValidForCategory(tid, detCat, S.intent?._groupId));
                    S.negatedTagIds = nlp.negated.filter(tid => tagValidForCategory(tid, detCat, S.intent?._groupId));

                    // Contextual tags (fireplace → #brick_wall, urgent → #emergency)
                    const ctxTags = inferTagsFromContext(desc, detCat);
                    ctxTags.forEach(({
                        tid
                    }) => {
                        if (!S.detTagIds.includes(tid) && !S.negatedTagIds.includes(tid))
                            S.detTagIds.push(tid);
                    });

                    // Size hint → negate heavy/oversized tags when size is standard
                    // Only negate if the user hasn't explicitly selected the tag
                    if (S._sizeHint === 'standard') {
                        ['#heavy_item', '#very_heavy'].forEach(tid => {
                            const userSelected = S.manTagIds.includes(tid) || (S.userTagIds || []).includes(tid);
                            if (!S.detTagIds.includes(tid) && !S.negatedTagIds.includes(tid) && !userSelected)
                                S.negatedTagIds.push(tid);
                        });
                    }

                    // ── SSOT: dynamic_services base price + suggested tags ────────
                    const normSt = (S.intent?.stype || 'Repair').replace('Install / Mount', 'Install');
                    const dynDef = resolveDynamicService(detCat, normSt, S.intent?._groupId);
                    if (dynDef) {
                        if (!S.intent.base && dynDef.financial_engine?.base_price)
                            S.intent.base = dynDef.financial_engine.base_price;
                        // Note: suggested_tags are NOT pre-selected — they just make chips available in the grid.
                        // Only NLP-detected tags (S.detTagIds) and service.default_tags are pre-selected.
                        // Storing hint IDs so sqBuildStep3 can show them prominently.
                        if (dynDef.suggested_tags) {
                            const tagEntries = Object.entries(DB.smart_tags || {});
                            S._suggestedTagIds = S._suggestedTagIds || [];
                            dynDef.suggested_tags.forEach(tagObj => {
                                if (!tagObj || typeof tagObj !== 'object') return;
                                const segments = tagObj?.$ref ? tagObj.$ref.replace(/^#\//, '').split('/') : null;
                                const tagId = segments ? '#' + segments[segments.length - 1].replace('#', '') : null;
                                if (tagId && DB.smart_tags?.[tagId] && !S._suggestedTagIds.includes(tagId))
                                    S._suggestedTagIds.push(tagId);
                            });
                        }
                    }

                    // ── Hide text bar, enter focused mode ─────────────────────────
                    const bar = document.getElementById('sqTextBar');
                    if (bar) bar.style.display = 'none';
                    enterFocusedMode();

                    // SSOT: accumulate confidence from intake_modules.confidence_gain
                    // Positive tags (detected/manual) = we know something → +gain
                    // Negated tags = we also know something (it's NOT that thing) → +gain * 0.75
                    let accumulatedConf = 0;
                    const detectedTagSet = new Set([...S.detTagIds, ...S.manTagIds]);
                    const negatedTagSet = new Set(S.negatedTagIds);
                    // SSOT: scope confidence to THIS service's own intake_chain modules
                    const _svcChain   = (S._svc?.intake_chain || []);
                    const _normStype2 = (S.stype||'Repair').replace('Install / Mount','Install');
                    const _dynChain2  = (resolveDynamicService(S.intent?.category, _normStype2, S.intent?._groupId)?.intake_chain || []);
                    const _chainSteps = (_svcChain.length ? _svcChain : _dynChain2.length ? _dynChain2 : []);
                    const _chainMods  = _chainSteps
                      .map(s2 => { const m2=(DB.intake_modules||{})[s2.module]; return m2?{moduleKey:s2.module,...m2}:null; })
                      .filter(Boolean);
                    const _modsArr = _chainMods.length > 0
                      ? _chainMods
                      : Object.entries(DB.intake_modules||{}).map(([k,mv])=>({moduleKey:k,...mv}));
                    const mods = Object.fromEntries(_modsArr.map(m3=>[m3.moduleKey,m3]));
                    for (const [modKey, mod] of Object.entries(mods)) {
                        if (!mod.confidence_gain) continue;
                        // (A) Explicit curated-intake answer = full gain
                        if (S.answers?.[modKey]) { accumulatedConf += mod.confidence_gain; continue; }
                        const allResponses = mod.client_response || [];
                        // Positive: tag detected matching a module response
                        const positiveAnswer = allResponses.some(resp => {
                            const respTags = resp.tags || [];
                            return respTags.some(rt => {
                                const tid = typeof rt === 'string' ? rt : rt?.$ref?.split('/').pop();
                                return tid && detectedTagSet.has('#' + tid.replace('#', ''));
                            });
                        });
                        // Negative: a negated tag that matches a module response — we know it's ruled out
                        const negativeAnswer = !positiveAnswer && allResponses.some(resp => {
                            const respTags = resp.tags || [];
                            return respTags.some(rt => {
                                const tid = typeof rt === 'string' ? rt : rt?.$ref?.split('/').pop();
                                return tid && negatedTagSet.has('#' + tid.replace('#', ''));
                            });
                        });
                        // Description-based implicit answers
                        const qLower = (mod.question || '').toLowerCase();
                        const descLower = (S.desc || '').toLowerCase();
                        const descAnswers = qLower && descLower && (
                            (qLower.includes('how many') && /\b\d+\b/.test(descLower)) ||
                            (qLower.includes('wall') && /drywall|brick|concrete|plaster/.test(descLower)) ||
                            (qLower.includes('weight') && /heavy|light|lbs|pounds/.test(descLower)) ||
                            (qLower.includes('location') && /bedroom|kitchen|bathroom|living|office/.test(descLower))
                        );
                        // User-tapped chips = 100% certainty → full gain + bonus
                        const userConfirmed = allResponses.some(resp => {
                            const respTags = resp.tags || [];
                            return respTags.some(rt => {
                                const tid = typeof rt === 'string' ? rt : rt?.$ref?.split('/').pop();
                                return tid && S.userTagIds && S.userTagIds.includes('#' + tid.replace('#', ''));
                            });
                        });
                        if (userConfirmed) accumulatedConf += mod.confidence_gain; // explicit tap = full gain
                        else if (positiveAnswer || descAnswers) accumulatedConf += Math.round(mod.confidence_gain * 0.8);
                        else if (negativeAnswer) accumulatedConf += Math.round(mod.confidence_gain * 0.6);
                    }

                    // ── Route to step 2 or straight to step 3 ─────────────────────
                    // SSOT: confidence_strategy (per-service or per-dynamic_services-
                    // bucket) replaces the old hardcoded 75/45 thresholds. A doorknob
                    // and a door install no longer share the same bar — each carries
                    // its own minimum_quote_confidence/maximum_followup_questions
                    // derived from real price variability (see confidence_strategy
                    // in btnyc.json). Live tag-based escalation (confidence_escalation)
                    // is applied on top, so an unnamed job that turns out to involve
                    // e.g. #brick_wall tightens up for THIS session specifically.
                    const svcForStrategy = S._svc || null;
                    const dynDefForStrategy = resolveDynamicService(S.intent?.category, S.stype, S.intent?._groupId);
                    const baseStrategy = svcForStrategy?.confidence_strategy
                        || dynDefForStrategy?.confidence_strategy
                        || { minimum_quote_confidence: 70, maximum_followup_questions: 3, base_confidence: 40, _variability_tier: 'medium' };

                    const allActiveTagIds = [...new Set([...S.detTagIds, ...S.manTagIds])];
                    const escDef = DB.global_rules?.confidence_escalation;
                    let liveStrategy = baseStrategy;
                    let escalatedBy = null;
                    if (escDef) {
                        const RANK = { skilled: 1, specialized: 2 };
                        let worst = null, worstRank = 0;
                        for (const tid of allActiveTagIds) {
                            const ov = DB.smart_tags?.[tid]?.effects?.complexity_override;
                            if (ov && (RANK[ov] || 0) > worstRank) { worst = ov; worstRank = RANK[ov]; }
                        }
                        if (worst && escDef[worst]) {
                            const capConf = escDef.max_minimum_quote_confidence ?? 95;
                            const capQ = escDef.max_followup_questions_absolute ?? 6;
                            liveStrategy = {
                                ...baseStrategy,
                                minimum_quote_confidence: Math.min(capConf, (baseStrategy.minimum_quote_confidence || 0) + (escDef[worst].minimum_quote_confidence_delta || 0)),
                                maximum_followup_questions: Math.min(capQ, (baseStrategy.maximum_followup_questions || 0) + (escDef[worst].maximum_followup_questions_delta || 0)),
                            };
                            escalatedBy = worst;
                        }
                    }
                    S._confidenceStrategy = liveStrategy;
                    S._escalatedBy = escalatedBy;
                    // SSOT: force_modules_by_variability — which intake modules MUST
                    // be present in this job's chain, keyed by variability tier
                    // (not the separate NLP-confidence-tier vocabulary in
                    // confidence_tiers, which describes a different axis — see
                    // global_rules.force_modules_by_variability for why these are
                    // two distinct concepts that shouldn't be conflated).
                    S._forceModules = DB.global_rules?.force_modules_by_variability?.[liveStrategy._variability_tier] || ['hybrid_qty'];

                    if (skipStep2) {
                        sqBuildStep2();
                        sqMarkDone(2, S.stype);
                        sqBuildStep3();
                    } else {
                        let maps = DB.intent_mappings || [];
                        if (!Array.isArray(maps) && maps.objects) maps = maps.objects;
                        const kw = (S.intent?.key || '').toLowerCase();
                        const m = maps.find(x => (x.keyword || '').toLowerCase() === kw);
                        // Total confidence = NLP keyword weight + accumulated module
                        // confidence_gain + this service/bucket's own base_confidence —
                        // checked against the SAME service/bucket's OWN bar, not a
                        // one-size-fits-all global threshold.
                        const intentConf = (m?.confidence_weight || 0) + accumulatedConf + (liveStrategy.base_confidence || 0);
                        const meetsBarToBypass = intentConf >= liveStrategy.minimum_quote_confidence;

                        sqBuildStep2();
                        if (meetsBarToBypass && S.intent?.stype) {
                            sqMarkDone(2, S.stype);
                            sqBuildStep3();
                        }
                    }
                }

function sqRenderSelfQuoteAdlib(svc) {
                    const flow = document.getElementById('sqStepFlow');
                    if (flow) flow.style.display = 'flex';

                    // Scroll to show the panel
                    const sqEl = document.getElementById('smartQuoteEngine');

                    // Get the adlib box and show it directly inside sqSb3
                    const sb3 = document.getElementById('sqSb3');
                    if (!sb3) return;
                    sb3.style.display = 'block';
                    const sc3 = document.getElementById('sqSc3');
                    if (sc3) sc3.className = 'scard active';
                    const sn3 = document.getElementById('sqSn3');
                    if (sn3) {
                        sn3.className = 'snum a';
                        sn3.innerHTML = '3';
                    }

                    // SSOT: verb_natural set on every service by Python amendment script
                    const svcType = svc.service_type || '';
                    const svcName = svc.ui_taxonomy?.display_name || svc.id;
                    const verb = svc.verb_natural
                        || DB.service_types?.[svcType]?.verb_natural
                        || 'done';

                    // Detect whether this service charges per item or is a fixed visit
                    const chain = svc.intake_chain || [];
                    const hasQtyChain = chain.some(m => ['item_count', 'count', 'hybrid_qty', 'global_quantity'].includes(m.module));

                    // Compute the price using the correct pricing_type from the JSON
                    // flat_rate: formula_components = ['base_price','intake_fees'] → no hourly multiplication
                    // hourly:    formula_components = ['calculated_labor','intake_fees'] → base + (mins/60)*rate
                    const om = svc.operational_metrics || {};
                    const fe = svc.financial_engine || {};
                    const tiers = DB.global_rules?.complexity_tiers || {
                        routine: {
                            hourly_rate: 65
                        },
                        skilled: {
                            hourly_rate: 85
                        },
                        specialized: {
                            hourly_rate: 110
                        }
                    };
                    const dispatch = DB.global_rules?.surcharges?.dispatch_fee || 45;
                    const pricingType = fe.pricing_type || 'flat_rate';
                    const basePrice = fe.base_price || 70;

                    // Read pricing engine formula_components from SSOT
                    const engineDef = DB.global_rules?.pricing_engines?.[resolveEngineKey(pricingType)] || {};
                    const components = engineDef.formula_components || ['base_price'];
                    const isHourly = components.includes('calculated_labor') || pricingType === 'hourly';
                    const isFormula = pricingType === 'assembly_formula';

                    let perItemLabor;
                    if (isHourly) {
                        const tierRate = tiers[om.complexity_tier || 'skilled']?.hourly_rate || 85;
                        const mins = om.expected_minutes || 60;
                        perItemLabor = Math.round(basePrice + (mins / 60) * tierRate);
                    } else if (isFormula) {
                        // v9.2 FIX: this previously fell back to a flat `basePrice`
                        // (the dead-code comment referenced the now-removed
                        // applyFormula — see CHANGELOG_v9.2.md). basePrice is 0 for
                        // furniture_assembly_flat_pack, the only assembly_formula
                        // service today, which would have quoted $0 labor for any
                        // assembly_formula service that reached this branch. It
                        // doesn't currently — requires_furniture_selection:true on
                        // that service correctly routes it to showIntakeQuestions/
                        // _computePrice before this function ever runs — but a
                        // future assembly_formula service WITHOUT that flag would
                        // hit this exact $0 landmine. Use mathFurnitureAssembly with
                        // this service's own curated expected_minutes as a single
                        // "item" (the correct degenerate case of the real assembly
                        // formula — sum-of-items-then-1hr-minimum — when there's
                        // only one item and no furniture-item list available in
                        // this scope) rather than silently zeroing the price.
                        const mins = om.expected_minutes || 60;
                        perItemLabor = mathFurnitureAssembly([mins]).price || basePrice;
                    } else {
                        // flat_rate: base_price IS the labor total — no hourly on top
                        perItemLabor = basePrice;
                    }
                    const totalLabor = Math.round(perItemLabor * S.qty);

                    // Build minimal adlib inside sqAdlibBox
                    const box = document.getElementById('sqAdlibBox');
                    if (!box) return;

                    // Replace sqDynGroups with empty (no chips for self-quoting)
                    const dyn = document.getElementById('sqDynGroups');
                    if (dyn) dyn.innerHTML = '';
                    const det = document.getElementById('sqDetTags');
                    if (det) det.innerHTML = '';

                    // Hide the auto-detected and qty labels (qty is in the adlib pill)
                    const detLabel = sb3.querySelector('div[style*="Auto-detected"]');
                    if (detLabel) detLabel.style.display = 'none';

                    box.style.display = 'block';
                    const sent = document.getElementById('sqAdlibSentence');
                    if (!sent) return;
                    sent.innerHTML = '';

                    const w = txt => {
                        const s = document.createElement('span');
                        s.className = 'adlib-word';
                        s.textContent = txt;
                        sent.appendChild(s);
                    };
                    const pill = (key, displayText, opts, currentVal) => {
                        const p = document.createElement('span');
                        p.className = 'adlib-pill';
                        const lbl = document.createElement('span');
                        lbl.textContent = displayText;
                        const ico = document.createElement('i');
                        ico.className = 'ti ti-chevron-down';
                        const sel = document.createElement('select');
                        sel.style.cssText = 'position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;';
                        opts.forEach(o => {
                            const op = document.createElement('option');
                            op.value = o;
                            op.textContent = o;
                            if (o === currentVal || o === String(S.qty)) op.selected = true;
                            sel.appendChild(op);
                        });
                        sel.addEventListener('change', function() {
                            lbl.textContent = this.value + (key === 'qty' ? ' item' + (this.value !== '1' ? 's' : '') : '');
                            S.qty = parseInt(this.value) || 1;
                            document.getElementById('sqQtyV').textContent = S.qty;
                            // Update price in confirm button — flat_rate shows labor only; hourly shows labor+dispatch
                            const newTotal = Math.round(perItemLabor * S.qty);
                            const confirmBtn = document.querySelector('#sqAdlibBox .adlib-yes');
                            if (confirmBtn) {
                                if (isHourly) {
                                    confirmBtn.innerHTML = `<i class="ti ti-calculator"></i> Confirm · Est. $${newTotal + dispatch}`;
                                } else {
                                    const qLabel = S.qty > 1 ? S.qty + '× $' + perItemLabor + ' = $' + newTotal : '$' + perItemLabor;
                                    confirmBtn.innerHTML = `<i class="ti ti-calculator"></i> Confirm · ${qLabel} <span style="font-size:11px;opacity:.6">+ $${dispatch} dispatch</span>`;
                                }
                            }
                        });
                        p.appendChild(lbl);
                        p.appendChild(ico);
                        p.appendChild(sel);
                        sent.appendChild(p);
                    };

                    // Grammatically correct structure:
                    // "I need [service name] [verb]"  (qty=1, fixed)
                    // "I need [service name] × [qty pill]" (qty variable)
                    // The service name is the object — it already implies what's being done.
                    // Verb is only added when it adds meaning (e.g. "adjusted", "installed").
                    w('I need');

                    // Service name — the confirmed thing being worked on
                    const nameSpan = document.createElement('span');
                    nameSpan.style.cssText = 'font-weight:700;color:var(--clr-red-dark,#8a0615);padding:0 4px;font-size:15px;';
                    nameSpan.textContent = svcName;
                    sent.appendChild(nameSpan);

                    // Qty: only show pill if the service has a qty intake chain
                    if (hasQtyChain) {
                        const timesSpan = document.createElement('span');
                        timesSpan.className = 'adlib-word';
                        timesSpan.style.color = '#999';
                        timesSpan.textContent = '×';
                        sent.appendChild(timesSpan);
                        pill('qty', String(S.qty), ['1', '2', '3', '4', '5', '6', '8', '10', '12'], String(S.qty));
                    }

                    // Verb — only when it adds meaning beyond the service name
                    // e.g. "Cabinet Door Adjustment" → skip verb (name is self-explaining)
                    // e.g. "Shower Head" → add "replaced"
                    const nameImpliesAction = ['adjustment', 'replacement', 'install', 'removal', 'repair',
                        'clearing', 'cleaning', 'restore', 'setup', 'configuration', 'management'
                    ].some(w => svcName.toLowerCase().includes(w));
                    if (!nameImpliesAction) {
                        w(verb);
                    }

                    // Price display: for flat_rate show labor only in confirm button (dispatch always separate)
                    // For hourly, include dispatch in button total since it's part of the predictable total.
                    // This prevents the double-count: button says $120, quote shows $120 + $45 dispatch.
                    const confirmRow = document.getElementById('sqAdlibBox').querySelector('.adlib-confirm-row');
                    if (confirmRow) {
                        // SSOT: button text from checkout_states[cs].button_text_labor_only
                        const _csKey = svc.financial_engine?.checkout_state || (isHourly ? 'diagnostic' : 'standard_flat_rate');
                        const _csDef = DB.checkout_states?.[_csKey] || {};
                        let estLabel, dispatchNote;
                        if (isHourly) {
                            estLabel = 'Est. $' + (totalLabor + dispatch);
                            dispatchNote = '';
                        } else {
                            estLabel = S.qty > 1
                                ? S.qty + '× $' + perItemLabor + ' = $' + totalLabor
                                : '$' + perItemLabor;
                            dispatchNote = ' <span style="font-size:11px;opacity:.6">+ $' + (DB.global_rules?.surcharges?.dispatch_fee||45) + ' ' + (DB.global_rules?.surcharges?.dispatch_label||'dispatch') + '</span>';
                        }
                        confirmRow.innerHTML =
                            '<button class="adlib-yes" onclick="sqConfirmAdlib()"><i class="ti ti-calculator"></i> Confirm · ' + estLabel + dispatchNote + '</button>' +
                            '<button class="adlib-no" onclick="sqRestart()"><i class="ti ti-arrow-left"></i> Back</button>';
                    }

                    // Store for computeSQQuote
                    S._selfQuoteSvc = svc;
                }

function sqToggleTag(el, tid) {
                    if (el.classList.contains('locked')) return;
                    const tag = (DB.smart_tags || {})[tid] || {};
                    const mutuallyExclusive = tag.mutually_exclusive || [];

                    if (el.classList.contains('sel')) {
                        // ── DE-SELECT: remove from all active sets ─────────────────
                        S.manTagIds = S.manTagIds.filter(x => x !== tid);
                        S.detTagIds = S.detTagIds.filter(x => x !== tid);
                        S.userTagIds = (S.userTagIds || []).filter(x => x !== tid);
                        // Do NOT re-add to negatedTagIds — user explicitly removed it → neutral state
                    } else {
                        // ── SELECT: user is explicitly choosing this tag ────────────

                        // 1. Remove from negatedTagIds — user is overriding any NLP negation
                        S.negatedTagIds = S.negatedTagIds.filter(x => x !== tid);

                        // 2. Remove mutually exclusive siblings from ALL state arrays
                        //    and also clear their negation (can't show "not heavy" if user picked "very heavy")
                        mutuallyExclusive.forEach(sibId => {
                            S.manTagIds = S.manTagIds.filter(x => x !== sibId);
                            S.detTagIds = S.detTagIds.filter(x => x !== sibId);
                            S.userTagIds = (S.userTagIds || []).filter(x => x !== sibId);
                            S.negatedTagIds = S.negatedTagIds.filter(x => x !== sibId);
                        });

                        // 3. Add to active sets
                        if (!S.manTagIds.includes(tid)) S.manTagIds.push(tid);
                        if (!(S.userTagIds || []).includes(tid)) {
                            S.userTagIds = S.userTagIds || [];
                            S.userTagIds.push(tid); // explicit user tap → 100% confidence
                        }
                    }
                    sqBuildStep3();
                }

function wireGlobalEvents() {
    // 1. Contact button (unchanged)
    const contactBtn = document.querySelector('#contact-button');
    const contactToolbar = document.querySelector('#contactToolbar');
    if (contactBtn && contactToolbar) {
        contactBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const expanded = contactToolbar.classList.toggle('active');
            contactBtn.setAttribute('aria-expanded', String(expanded));
        });
        document.addEventListener('click', (e) => {
            if (!contactBtn.contains(e.target) && !contactToolbar.contains(e.target)) {
                contactToolbar.classList.remove('active');
                contactBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // 2. Cart FAB (unchanged)
    const cartFab = document.querySelector('#cartFab');
    if (cartFab) cartFab.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openCartOverlay();
    });

    // 3. Clear all, add more, book now (unchanged – they call renderCart etc.)
    const clearAllBtn = document.querySelector('#clearAllServicesBtn');
    if (clearAllBtn) clearAllBtn.addEventListener('click', () => {
        if (State.serviceRequest.length && confirm('Remove all services?')) {
            State.serviceRequest = [];
            persistCart();
            renderCart();
            restoreCategoryView();
            toast('Cart cleared');
        }
    });
    const addMoreBtn = document.querySelector('#addMoreBtn');
    if (addMoreBtn) addMoreBtn.addEventListener('click', () => {
        closeCartOverlay();
        restoreCategoryView();
    });
    const bookNowBtn = document.querySelector('#bookNowBtn');
    const finalBookBtn = document.querySelector('#finalBookBtn');
    if (bookNowBtn) bookNowBtn.addEventListener('click', () => {
        if (!State.serviceRequest.length) toast('Add at least one service.', 'error');
        else openCartOverlay();
    });
    if (finalBookBtn) finalBookBtn.addEventListener('click', () => {
        if (!State.serviceRequest.length) toast('Add at least one service.', 'error');
        else openCartOverlay();
    });
    const manageBtn = document.querySelector('#manageVisitBtn');
    if (manageBtn) manageBtn.addEventListener('click', () => toast('Redirecting to Manage Your Visit…'));
    const clientLogin = document.querySelector('#clientLoginBtn');
    if (clientLogin) clientLogin.addEventListener('click', () => toast('Redirecting to Client Portal…'));

    // 4. Contact email/phone/SMS (unchanged – they use openMail etc.)
    document.querySelectorAll('.contact-mail').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            openMail(el);
        });
    });
    document.querySelectorAll('.contact-phone').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            openTel(el);
        });
    });
    document.querySelectorAll('.contact-sms').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            openSms(el);
        });
    });

    // 5. Escape key (unchanged)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (DOM.cartOverlay && DOM.cartOverlay.style.display === 'flex') {
                closeCartOverlay();
                restoreCategoryView();
            } else if (document.querySelector('.main-card-schedule-service.focused-mode')) {
                Breadcrumbs.goBack();
            }
        }
    });

    // 6. ✨ NEW: Category card clicks – use the orchestrator ✨
    document.querySelectorAll('.category-card').forEach(card => {
        // Remove any existing listeners to avoid duplicates (we'll attach fresh)
        card.replaceWith(card.cloneNode(true));
    });
    // Re-fetch and attach
    document.querySelectorAll('.category-card').forEach(card => {
        const catId = card.dataset.categoryId;
        card.addEventListener('click', function() {
            // For category-level entry, we treat it as free-text with the category name.
            // Alternatively, you can use a more specific collector if you have a service.
            // For now, we'll route to a free-text context with the category name.
            const ctx = collectBookingContext_freeText(catId);
            const route = executeWorkflow(ctx, DB);
            renderRoute(route);
        });
    });

    // 7. ✨ NEW: SmartQuote “Get estimate” button (sqUnifiedActionBtn) ✨
    const sqBtn = document.getElementById('sqUnifiedActionBtn');
    if (sqBtn) {
        // Remove old listeners by cloning
        const newBtn = sqBtn.cloneNode(true);
        sqBtn.parentNode.replaceChild(newBtn, sqBtn);
        newBtn.addEventListener('click', function() {
            const textarea = document.getElementById('sqDescIn');
            const rawText = textarea ? textarea.value.trim() : '';
            if (!rawText) {
                toast('Please describe your job first.', 'error');
                return;
            }
            const ctx = collectBookingContext_freeText(rawText);
            const route = executeWorkflow(ctx, DB);
            renderRoute(route);
        });
    }

    // 8. ✨ NEW: Global handler for intake answers (called from curated card chips) ✨
    window.handleIntakeAnswer = function(moduleKey, label) {
        // We need to update the current route's answers and re-run the orchestrator.
        // We'll store the current route in a global variable for simplicity.
        if (window._currentRoute) {
            const route = window._currentRoute;
            route.answers[moduleKey] = label;
            // Re-run execution with updated answers? Actually the orchestrator's workflow
            // is designed to be run once. For dynamic updates, we need to re-collect.
            // Easiest: rebuild context from the route and re-run.
            // But since we have the original context, we can store it.
            // For simplicity, we'll assume we stored the original context in a global.
            if (window._currentContext) {
                const ctx = window._currentContext;
                // Update answers in context
                ctx.answers = ctx.answers || {};
                ctx.answers[moduleKey] = label;
                const newRoute = executeWorkflow(ctx, DB);
                window._currentRoute = newRoute;
                window._currentContext = ctx;
                renderRoute(newRoute);
            } else {
                toast('Cannot update answers – context lost.', 'error');
            }
        }
    };

    // 9. ✨ NEW: Handle service card taps (if using the catalog browser) ✨
    // The service cards are rendered dynamically by UIRenderer, so we need to use event delegation.
    document.addEventListener('click', function(e) {
        const tile = e.target.closest('.service-tile');
        if (!tile) return;
        // Service tiles have data attributes or we can get service id from the tile.
        // In the new rendering, we would set data-service-id. For now, we'll use the existing
        // click handler that calls prefillSmartQuoteFromService – we'll replace that.
        // We'll modify the card creation in UIRenderer to use the orchestrator instead.
        // For now, we'll just override the default behavior if the tile has a data-service-id.
        const svcId = tile.dataset.serviceId || tile.dataset.id;
        if (svcId) {
            e.preventDefault();
            const svc = DB.services.find(s => s.id === svcId);
            if (svc) {
                const catId = svc.ui_taxonomy?.category_id || 'other';
                const ctx = collectBookingContext_catalog(svc, catId);
                const route = executeWorkflow(ctx, DB);
                window._currentContext = ctx;
                window._currentRoute = route;
                renderRoute(route);
            }
        }
    });
}

function removeFurnitureEntry(serviceId, idx) {
                    const svc = State.serviceRequest.find(s => s.id === serviceId);
                    if (!svc?.furnitureItems) return;
                    svc.furnitureItems.splice(idx, 1);
                    if (svc.name?.toLowerCase().includes('assembly') && svc.furnitureItems.length === 0) {
                        removeServiceFromCart(serviceId);
                        return;
                    }
                    const mins = svc.furnitureItems.map(f => f.minutes);
                    const charge = mathFurnitureAssembly(mins);
                    svc.estimatedHours = charge.hours;
                    svc.estimatedPrice = charge.price;
                    svc.price = `$${charge.price.toFixed(2)}`;
                    svc.notes = `Furniture Items: ${svc.furnitureItems.map(f => f.label).join(', ')} • Est: ${charge.hours.toFixed(2)} hr • $${charge.price.toFixed(2)}`;
                    persistCart();
                    renderCart();
                }

function _recomputeInstanceLabels() {
                    const groups = {};
                    State.serviceRequest.forEach(s => {
                        if (s.furnitureItems) return;
                        const key = s.name + '::' + s.category_id;
                        (groups[key] = groups[key] || []).push(s);
                    });
                    Object.values(groups).forEach(group => {
                        if (group.length <= 1) {
                            group.forEach(s => delete s._instanceLabel);
                        } else {
                            group.forEach((s, i) => { s._instanceLabel = `#${i + 1}`; });
                        }
                    });
                }

// ───────────────────────── Mixed widgets (render + mutate, kept whole) ───

function renderFurnitureSelection(container, svc, category_id) {
                    container.replaceChildren();
                    State.furnitureItems = [];
                    const masterList = [];
                    for (const [key, item] of furnitureMap.entries()) {
                        if (key === 'PAX_CUSTOM') continue;
                        masterList.push({
                            key,
                            label: item.display_name,
                            brand: item.brand === 'IKEA' ? 'IKEA' : 'Generic',
                            type: item.type || 'Other',
                            article: item.article,
                            minutes: item.minutes,
                            isIkea: item.brand === 'IKEA'
                        });
                    }
                    const distinctBrands = [...new Set(masterList.map(i => i.brand))].sort();
                    let selectedBrand = null;
                    if (svc.requires_furniture_selection) {
                        const serviceName = svc.ui_taxonomy?.display_name.toLowerCase();
                        selectedBrand = serviceName.includes('ikea') ? 'IKEA' : 'Generic';
                    }
                    const brandPreselected = selectedBrand !== null;
                    let selectedType = null;
                    const selectionWrapper = create('div', {
                        id: 'furniture-selection-wrapper'
                    });
                    selectionWrapper.style.display = 'none';
                    const stepContent = create('div', {
                        id: 'furniture-step-content'
                    });
                    container.appendChild(stepContent);
                    container.appendChild(selectionWrapper);
                    const showBrandGrid = () => {
                        stepContent.replaceChildren();
                        selectedBrand = null;
                        selectedType = null;
                        const hdr = create('h4', {
                            text: 'Select Furniture Brand',
                            style: 'color:#fff;margin-bottom:12px;'
                        });
                        const grid = create('div', {
                            class: 'group-grid'
                        });
                        distinctBrands.forEach(brand => {
                            const card = create('div', {
                                class: 'group-tile',
                                tabindex: '0',
                                role: 'button',
                                'aria-label': brand
                            });
                            if (brand === 'IKEA') {
                                card.style.background = '#0057AD';
                                card.style.color = '#FBDA0C';
                                card.style.fontWeight = '800';
                                card.style.fontSize = '1.2rem';
                                card.style.border = '6px solid #FBDA0C';
                            }
                            card.appendChild(create('span', {
                                class: 'tile-name',
                                text: brand
                            }));
                            card.addEventListener('click', () => {
                                selectedBrand = brand;
                                showTypeGrid(brand);
                            });
                            card.addEventListener('keydown', e => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    selectedBrand = brand;
                                    showTypeGrid(brand);
                                }
                            });
                            grid.appendChild(card);
                        });
                        stepContent.appendChild(hdr);
                        stepContent.appendChild(grid);
                    };
                    const showTypeGrid = (brand) => {
                        stepContent.replaceChildren();
                        selectedType = null;
                        const types = [...new Set(masterList.filter(i => i.brand === brand).map(i => i.type))].sort();
                        const hdr = create('h4', {
                            text: `Select Furniture Type (${brand})`,
                            style: 'color:#fff;margin-bottom:12px;'
                        });
                        const grid = create('div', {
                            class: 'group-grid'
                        });
                        const iconMap = {
                            'Shelving': '📚',
                            'Seating': '💺',
                            'Wardrobe/Closet': '🚪',
                            'Bed': '🛏️',
                            'Table': '𓊯',
                            'Sofa': '🛋️',
                            'Dresser': '🗄',
                            'TV/Media': '📺',
                            'Desk': '▛▀▜'
                        };
                        types.forEach(type => {
                            const card = create('div', {
                                class: 'group-tile',
                                tabindex: '0',
                                role: 'button',
                                'aria-label': type
                            });
                            card.appendChild(create('span', {
                                class: 'tile-icon',
                                text: iconMap[type] || '📦'
                            }));
                            card.appendChild(create('span', {
                                class: 'tile-name',
                                text: type
                            }));
                            card.addEventListener('click', () => {
                                selectedType = type;
                                showSearchAndList(brand, type);
                            });
                            grid.appendChild(card);
                        });
                        stepContent.appendChild(hdr);
                        stepContent.appendChild(grid);
                        addBackButton(stepContent, brandPreselected ? () => Breadcrumbs.goBack() : showBrandGrid);
                    };
                    const showSearchAndList = (brand, type) => {
                        stepContent.replaceChildren();
                        const chipsRow = create('div', {
                            style: 'display:flex;gap:8px;margin-bottom:12px;align-items:center;'
                        });
                        const brandChip = create('button', {
                            class: 'chip-btn selected',
                            type: 'button',
                            text: `${brand} ✕`
                        });
                        if (brand === 'IKEA') {
                            brandChip.style.background = '#0057AD';
                            brandChip.style.color = '#FBDA0C';
                            brandChip.style.border = '2px solid #FBDA0C';
                            brandChip.style.fontWeight = '800';
                            brandChip.style.backgroundImage = 'none';
                        }
                        brandChip.addEventListener('click', showBrandGrid);
                        chipsRow.appendChild(brandChip);
                        const typeChip = create('button', {
                            class: 'chip-btn selected',
                            type: 'button',
                            text: `${type} ✕`
                        });
                        typeChip.addEventListener('click', () => showTypeGrid(brand));
                        chipsRow.appendChild(typeChip);
                        stepContent.appendChild(chipsRow);
                        const searchInput = create('input', {
                            type: 'text',
                            class: 'furniture-search-input',
                            placeholder: 'Search by name or article number',
                            autocomplete: 'off'
                        });
                        stepContent.appendChild(searchInput);
                        const resultsList = create('div', {
                            class: 'furniture-results-list'
                        });
                        stepContent.appendChild(resultsList);
                        const updateList = (term = '') => {
                            const filtered = masterList.filter(item => item.brand === brand && item.type === type && (item.label.toLowerCase().includes(term) || (item.article && String(item.article).includes(term))));
                            resultsList.replaceChildren();
                            if (!filtered.length) {
                                resultsList.appendChild(create('div', {
                                    class: 'empty-message',
                                    text: 'No matching items'
                                }));
                                return;
                            }
                            filtered.forEach(item => {
                                const row = create('div', {
                                    class: 'furniture-result-item'
                                });
                                const textWrap = create('div', {
                                    style: 'flex:1;min-width:0;'
                                });
                                textWrap.appendChild(create('div', {
                                    class: 'furniture-result-name',
                                    text: item.label
                                }));
                                if (item.article) textWrap.appendChild(create('div', {
                                    class: 'furniture-result-meta',
                                    text: `Art. ${item.article} · ${item.brand}`
                                }));
                                row.appendChild(textWrap);
                                const addBtn = create('button', {
                                    class: 'furniture-add-btn',
                                    type: 'button',
                                    text: '+ Add'
                                });
                                addBtn.addEventListener('click', () => {
                                    State.furnitureItems.push({
                                        key: item.key,
                                        label: item.label,
                                        articleNumber: item.article,
                                        minutes: item.minutes,
                                        isIkea: item.isIkea
                                    });
                                    updateSelectedFurnitureUI();
                                    toast(`${item.label} added`, 'success');
                                });
                                row.appendChild(addBtn);
                                if (brand === 'IKEA' && item.label.toUpperCase().includes('PAX')) {
                                    const paxCfgBtn = create('button', {
                                        class: 'furniture-add-btn',
                                        style: 'background:rgba(222,160,0,0.7); margin-left:4px;',
                                        type: 'button',
                                        text: '⚙️'
                                    });
                                    paxCfgBtn.addEventListener('click', (e) => {
                                        e.stopPropagation();
                                        renderPaxConfigurator(paxCfgBtn, stepContent, svc, category_id);
                                    });
                                    row.appendChild(paxCfgBtn);
                                }
                                resultsList.appendChild(row);
                            });
                        };
                        updateList('');
                        searchInput.addEventListener('input', debounce((e) => updateList(e.target.value.trim().toLowerCase()), 200));
                        addBackButton(stepContent, () => showTypeGrid(brand));
                    };

                    function updateSelectedFurnitureUI() {
                        selectionWrapper.replaceChildren();
                        if (!State.furnitureItems.length) {
                            selectionWrapper.style.display = 'none';
                            return;
                        }
                        selectionWrapper.style.display = 'block';
                        selectionWrapper.appendChild(create('h5', {
                            text: 'Furniture Selected:',
                            style: 'margin-top:15px;color:#fff;margin-bottom:8px;'
                        }));
                        const ul = create('ul', {
                            class: 'furniture-added-list'
                        });
                        State.furnitureItems.forEach((item, idx) => {
                            let label = item.label;
                            if (item.articleNumber) label += ` (${item.articleNumber})`;
                            const li = create('li');
                            const checkMark = create('span', {
                                text: '✓',
                                style: 'color: #22c55e; font-weight: 900; font-size: 1.1rem; margin-right: 8px; display: inline-block;'
                            });
                            li.appendChild(checkMark);
                            li.appendChild(create('span', {
                                text: label
                            }));
                            const rmBtn = create('button', {
                                text: '✕',
                                class: 'remove-item',
                                type: 'button'
                            });
                            rmBtn.addEventListener('click', () => {
                                State.furnitureItems.splice(idx, 1);
                                updateSelectedFurnitureUI();
                            });
                            li.appendChild(rmBtn);
                            ul.appendChild(li);
                        });
                        selectionWrapper.appendChild(ul);
                        const addBtn = create('button', {
                            class: 'add-more-button',
                            type: 'button',
                            text: '🛒 Add Selection to Cart',
                            style: 'width:100%;margin-top:12px;'
                        });
                        addBtn.addEventListener('click', () => {
                            const minutes = State.furnitureItems.map(f => f.minutes);
                            const charge = mathFurnitureAssembly(minutes);
                            const entry = {
                                id: `${svc.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                serviceId: svc.id,
                                category_id,
                                name: svc.ui_taxonomy?.display_name,
                                price: `$${charge.price.toFixed(2)}`,
                                icon: svc.icon || '🛋️',
                                detail: 'Furniture Service',
                                notes: `Items: ${State.furnitureItems.map(f => f.label).join(', ')}`,
                                furnitureItems: [...State.furnitureItems],
                                estimatedHours: charge.hours,
                                estimatedPrice: charge.price
                            };
                            addToCart(entry);
                            State.furnitureItems = [];
                            updateSelectedFurnitureUI();
                            container.style.display = 'none';
                            exitFocusedMode();
                            if (DOM.serviceRequestSummary) DOM.serviceRequestSummary.style.display = 'block';
                            DOM.serviceRequestSummary.scrollIntoView({
                                behavior: 'smooth',
                                block: 'start'
                            });
                            renderCart();
                            toast('Furniture added to cart!', 'success');
                        });
                        selectionWrapper.appendChild(addBtn);
                    }
                    if (selectedBrand) showTypeGrid(selectedBrand);
                    else showBrandGrid();
                }

function renderPaxConfigurator(anchorElement, container, svc, category_id) {
                    const existing = document.querySelector('.pax-calc-module');
                    if (existing) existing.remove();
                    const mod = create('div', {
                        class: 'pax-calc-module'
                    });
                    mod.innerHTML = `
                    <div class="total-panel">
                      <div class="price-main"><span class="price-label">Estimate</span><span class="price-value" id="paxTotalPrice">$0.00</span></div>
                      <div style="display:flex;justify-content:space-between;margin-top:8px;">
                        <div class="hours-badge"><i>🕒</i> <span id="paxTotalHours">0.0</span> hours</div>
                        <div style="font-size:0.9rem;color:#4a5f6e;">+ start fee*</div>
                      </div>
                    </div>
                    <div class="items-list">
                      <div class="calc-row"><div class="item-info"><span class="item-name">Wardrobe frames</span><button class="info-btn" data-tooltip="frames" type="button">ⓘ</button></div><div class="item-controls"><button class="ctrl-btn pax-sub" data-target="frames" type="button">−</button><span class="count-display" id="pax-frames-count">0</span><button class="ctrl-btn pax-add" data-target="frames" type="button">+</button></div></div>
                      <div class="calc-row"><div class="item-info"><span class="item-name">Hinge doors</span><button class="info-btn" data-tooltip="hinge" type="button">ⓘ</button></div><div class="item-controls"><button class="ctrl-btn pax-sub" data-target="hinge" type="button">−</button><span class="count-display" id="pax-hinge-count">0</span><button class="ctrl-btn pax-add" data-target="hinge" type="button">+</button></div></div>
                      <div class="calc-row"><div class="item-info"><span class="item-name">Sliding doors</span><button class="info-btn" data-tooltip="sliding" type="button">ⓘ</button></div><div class="item-controls"><button class="ctrl-btn pax-sub" data-target="sliding" type="button">−</button><span class="count-display" id="pax-sliding-count">0</span><button class="ctrl-btn pax-add" data-target="sliding" type="button">+</button></div></div>
                      <div class="calc-row"><div class="item-info"><span class="item-name">Interiors</span><button class="info-btn" data-tooltip="interiors" type="button">ⓘ</button></div><div class="item-controls"><button class="ctrl-btn pax-sub" data-target="interiors" type="button">−</button><span class="count-display" id="pax-interiors-count">0</span><button class="ctrl-btn pax-add" data-target="interiors" type="button">+</button></div></div>
                    </div>
                    <div class="pax-action-buttons">
                      <button class="pax-cancel-btn" id="paxCancelBtn" type="button">Cancel</button>
                      <button class="pax-add-btn" id="paxAddToCartBtn" type="button">Complete</button>
                    </div>`;
                    anchorElement.parentNode.insertBefore(mod, anchorElement.nextSibling);
                    const counts = {
                        frames: mod.querySelector('#pax-frames-count'),
                        hinge: mod.querySelector('#pax-hinge-count'),
                        sliding: mod.querySelector('#pax-sliding-count'),
                        interiors: mod.querySelector('#pax-interiors-count')
                    };
                    const priceEl = mod.querySelector('#paxTotalPrice');
                    const hoursEl = mod.querySelector('#paxTotalHours');
                    const update = () => {
                        const c = {
                            cabinet: parseInt(counts.frames.textContent) || 0,
                            standardDoor: parseInt(counts.hinge.textContent) || 0,
                            slidingDoor: parseInt(counts.sliding.textContent) || 0,
                            insideItem: parseInt(counts.interiors.textContent) || 0
                        };
                        const raw = c.cabinet * COEFF.cabinet + c.standardDoor * COEFF.standardDoor + c.slidingDoor * COEFF.slidingDoor + c.insideItem * COEFF.insideItem;
                        const hours = Math.max(0, raw);
                        const price = hours * PRICE_PER_HOUR + (hours < 3 ? START_FEE : 0);
                        hoursEl.textContent = hours.toFixed(1);
                        priceEl.textContent = `$${price.toFixed(2)}`;
                    };
                    mod.addEventListener('click', e => {
                        const btn = e.target.closest('.pax-add, .pax-sub');
                        if (!btn) return;
                        e.stopPropagation();
                        const isAdd = btn.classList.contains('pax-add');
                        const target = btn.dataset.target;
                        const el = counts[target];
                        if (!el) return;
                        let val = parseInt(el.textContent) || 0;
                        val = Math.max(0, val + (isAdd ? 1 : -1));
                        el.textContent = val;
                        update();
                    });
                    mod.querySelector('#paxCancelBtn').addEventListener('click', () => mod.remove());
                    mod.querySelector('#paxAddToCartBtn').addEventListener('click', (e) => {
                        e.stopPropagation();
                        const frames = parseInt(counts.frames.textContent) || 0;
                        const hinge = parseInt(counts.hinge.textContent) || 0;
                        const sliding = parseInt(counts.sliding.textContent) || 0;
                        const interiors = parseInt(counts.interiors.textContent) || 0;
                        if (!frames && !hinge && !sliding && !interiors) {
                            toast('Add at least one component.', 'error');
                            return;
                        }
                        const totalHours = frames * COEFF.cabinet + hinge * COEFF.standardDoor + sliding * COEFF.slidingDoor + interiors * COEFF.insideItem;
                        const minutes = Math.round(totalHours * 60);
                        const label = `PAX: ${frames} frames, ${hinge} hinge, ${sliding} sliding, ${interiors} interiors`;
                        State.furnitureItems.push({
                            key: 'PAX_CUSTOM',
                            label,
                            minutes,
                            isIkea: true,
                            articleNumber: null
                        });
                        setTimeout(() => {
                            const wrapper = document.getElementById('furniture-selection-wrapper');
                            if (wrapper) wrapper.querySelector('.add-more-button')?.click();
                        }, 0);
                        toast(`Added ${label}`, 'success');
                        mod.remove();
                    });
                    update();
                }
