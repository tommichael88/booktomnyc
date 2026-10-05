
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
      * showGroupsForCategory, showSubGroups, the retired group-selection helper — that do
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
      * SECURITY FIX (v9.4): the legacy curated-intake builder and sqBuildAdlib (the function
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
         if (!saved) {
             sqRestart();
             return;
         }

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

         // Get current cart from the store (not State)
         const currentCart = window.__store.getState().cart.serviceRequest;
         let newCart;

         // ---- Furniture merge ----
         if (entry.furnitureItems?.length) {
             const existingIndex = currentCart.findIndex(
                 item => item.name === entry.name && item.category_id === entry.category_id
             );
             if (existingIndex !== -1) {
                 const existing = currentCart[existingIndex];
                 const newFurnitureItems = [...existing.furnitureItems, ...entry.furnitureItems];
                 const mins = newFurnitureItems.map(f => f.minutes);
                 const charge = mathFurnitureAssembly(mins);
                 const updatedEntry = {
                     ...existing,
                     furnitureItems: newFurnitureItems,
                     estimatedHours: charge.hours,
                     estimatedPrice: charge.price,
                     price: `$${charge.price.toFixed(2)}`,
                     notes: `Furniture Items: ${newFurnitureItems.map(f => f.label).join(', ')} • Est: ${charge.hours.toFixed(2)} hr • $${charge.price.toFixed(2)}`
                 };
                 newCart = currentCart.map((item, i) => i === existingIndex ? updatedEntry : item);
                 window.__store.dispatch({
                     type: 'cart/SET',
                     payload: {
                         serviceRequest: newCart
                     }
                 });
                 _recomputeInstanceLabels();
                 toast('Merged with existing furniture request', 'success');
                 return;
             }
         }

         // ---- Duplicate detection (same name, category, price, and notes) ----
         const notesMatch = (a, b) => (a || '') === (b || '');
         const dupeIndex = currentCart.findIndex(item =>
             item.name === entry.name &&
             item.category_id === entry.category_id &&
             item.price === entry.price &&
             notesMatch(item.notes, entry.notes) &&
             !item.furnitureItems
         );
         if (dupeIndex !== -1) {
             const dupe = currentCart[dupeIndex];
             const newQty = (dupe.qty || 1) + 1;
             const updatedEntry = {
                 ...dupe,
                 qty: newQty
             };
             newCart = currentCart.map((item, i) => i === dupeIndex ? updatedEntry : item);
             window.__store.dispatch({
                 type: 'cart/SET',
                 payload: {
                     serviceRequest: newCart
                 }
             });
             _recomputeInstanceLabels();
             toast(`${entry.name} — qty updated to ${newQty}`, 'success');
             return;
         }

         // ---- Append new entry ----
         entry.qty = entry.qty || 1;
         newCart = [...currentCart, entry];
         window.__store.dispatch({
             type: 'cart/SET',
             payload: {
                 serviceRequest: newCart
             }
         });
         _recomputeInstanceLabels();


         if (DOM.cartFab) {
             DOM.cartFab.style.animation = 'none';
             requestAnimationFrame(() => DOM.cartFab.style.animation = 'cartBounce .4s ease');
         }
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
         window.__store.dispatch({
             type: 'cart/SET',
             payload: {
                 serviceRequest: []
             }
         });
         renderCart();
         closeCartOverlay();
         restoreCategoryView();
         setTimeout(() => toast('Thank you for your request!', 'success'), 1500);
     }

     function prefillSmartQuoteFromOtherTile(tile, category_id) {
         Breadcrumbs.push({
             type: 'serviceDetail',
             group: null,
             category_id
         });
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
         // Plurality gate: only use default_qty when the head noun is actually
         // plural -- prevents "my window" from getting qty=2 just because the
         // windows group has default_qty:2.
         function isPluralNoun(word) {
             if (!word) return false;
             const w = word.toLowerCase().trim();
             const SINGULAR_EXCEPTIONS = new Set(['glass', 'gas', 'class']);
             if (SINGULAR_EXCEPTIONS.has(w)) return false;
             if (w.endsWith('ss')) return false;
             if (w.endsWith('es') && w.length > 3) return true;
             if (w.endsWith('s') && !w.endsWith('us') && w.length > 2) return true;
             return false;
         }
         const headNoun = (S._nlpSeedObject || '').trim().split(/\s+/).pop();
         const defaultQtyRaw = groupObj?.default_qty || 1;
         const defaultQty = (defaultQtyRaw > 1 && headNoun && !isPluralNoun(headNoun)) ? 1 : defaultQtyRaw;
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
                 _pricingType: dynDef?.financial_engine?.pricing_type || 'flat_rate'
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

         document.getElementById('smartQuoteEngine')?.scrollIntoView({
             behavior: 'smooth',
             block: 'start'
         });
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

         // Seed S from the service. Logic derives the seed (buildServiceSessionSeed); this controller installs it.
         // v9.5 FIX: capture dynamic_rule before S reset -- it carries the
         // pricing formula (e.g. tile_repair_formula) from the NLP intent and
         // would be lost when S is reassigned below.
         const preservedDynamicRule = S.intent?.dynamic_rule || null;
         S = buildServiceSessionSeed(svc, category_id, preservedDynamicRule, categoryMap, DB);

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

         // per_unit_answers_vary: each unit may have different specs
         // (e.g. each door has its own size/style/frame condition).
         // Force qty=1 so the intake chain's answers genuinely apply
         // to a single unit. The user books each separately.
         S.qty = resolveQuantityUnits({ entity: svc, entityType: 'service', requestedQty: S.qty }).units;

         // ── Self-quoting check: services with full pricing data skip step 3 ──
         // If service has base_price + expected_minutes + complexity_tier and
         // its intake_chain only asks quantity, skip the chip grid and adlib entirely.
         // Just render the adlib with a qty pill and auto-quote on confirm.
         const intakeClass = classifyServiceIntake(svc);
         const isSelfQuoting = intakeClass.isSelfQuoting;

         if (isSelfQuoting) {
             // Compute price directly from service data (no tags needed)
             S._objectNoun = svc.ui_taxonomy?.display_name || svc.id;
             S._location = null;
             S._sizeHint = null;
             S._notes = null;
             // Store the exact service minutes on intent for computeSQQuote
             S.intent._exactMinutes = intakeClass.exactMinutes;
             S.intent._exactTier = intakeClass.exactTier;

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

             // Phase 6 rewire: route through the orchestrator instead of
             // sqRenderSelfQuoteAdlib directly. Ensures consistent pricing
             // (pricing_archetype dispatch), activeTags, and confidence.
             if (typeof collectBookingContext_catalog === 'function' &&
                 typeof executeWorkflow === 'function' &&
                 typeof renderSelfQuoteFromRoute === 'function' &&
                 DB?.workflow) {
                 const _selfQuoteCtx = collectBookingContext_catalog(svc, category_id);
                 const _selfQuoteRoute = executeWorkflow(_selfQuoteCtx, DB);
                 // T64: store so any future re-invocation (handleIntakeAnswer,
                 // orchAffirmYes/orchAffirmNo) has a real context to work
                 // with -- confirmed via direct check this was a real, pre-
                 // existing gap: no confirmed-live path to executeWorkflow
                 // set this before, so both handleIntakeAnswer and the new
                 // tag-affirmation handlers would have silently hit their
                 // own "context lost" fallback.
                 window._currentContext = _selfQuoteCtx;
                 window._currentRoute = _selfQuoteRoute;
                 renderSelfQuoteFromRoute(_selfQuoteRoute, svc);
             } else {
                 sqRenderSelfQuoteAdlib(svc);
             }
         } else {
             // ── VIEW TEMPLATE choice only — NOT a confidence/pricing decision ──
             // Both branches below feed the SAME confidence engine
             // (base_confidence + sum of confidence_gain per answered
             // module, gating the estimate button — see the legacy curated-intake builder).
             // This only decides which UI template renders: the curated
             // card (real questions to ask) or the bare chip grid
             // (nothing to ask beyond quantity/tags). Renamed from the
             // confusing "hasRealIntake" after an audit correctly flagged
             // that name as reading like a confidence bypass.
             const needsCuratedCardTemplate = intakeClass.needsCuratedCardTemplate;
             if (needsCuratedCardTemplate) {
                 S._svc = svc;
                 S.answers = {};
                 S._jobNotes = '';
                 S._curatedMode = true;
                 S.userTagIds = S.userTagIds || [];
                 // Curated card via the orchestrator -- the one canonical path. A full 74-service parity sweep found and fixed the two gaps
                 // renderCuratedCardFromRoute had (ceiling enforcement, branch visibility) and showed 74/74 agreement. The legacy curated-intake
                 // builder and its "orchestrator unavailable" fallback are retired: the orchestrator is part of this same file, so that
                 // branch could never be the one that ran.
                 const _curatedCtx = collectBookingContext_catalog(svc, category_id);
                 const _curatedRoute = executeWorkflow(_curatedCtx, DB);
                 sqRenderCuratedCard(_curatedRoute, 'sqSb3'); // records S._lastRoute / S._lastContainerId, then renders
                 const sb3 = document.getElementById('sqSb3');
                 if (sb3) sb3.style.display = 'block';
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
         const currentCart = window.__store.getState().cart.serviceRequest;
         const newCart = currentCart.filter(s => s.id !== id);
         window.__store.dispatch({
             type: 'cart/SET',
             payload: {
                 serviceRequest: newCart
             }
         });
         _recomputeInstanceLabels();
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
         S.qty = resolveQuantityUnits({ entity: S._svc || null, entityType: 'service', requestedQty: Math.max(1, Math.min(99, S.qty + d)) }).units;
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

         // T70: real strangler-fig retirement. sqAnalyze is now a
         // thin dispatcher: collectBookingContext_freeText ->
         // executeWorkflow -> renderRoute, the exact chain the
         // orchestrator pipeline was always meant to be the real
         // entry point for. Every branch this function used to
         // implement itself (object_based override,
         // high-confidence auto-select, category-matched Other
         // tile, negation-pivot, plain tag-affirmation, generic
         // fallback) is now handled by executeWorkflow/renderRoute
         // directly -- confirmed equivalent or better via T66's
         // branch-by-branch check and T68's comprehensive,
         // permanent equivalence sweep (verify_sqanalyze_
         // orchestrator_equivalence.js), with the one real,
         // confirmed gap that sweep found already closed at the
         // source in T69.
         //
         // Before dispatching, seeds the global S. state exactly
         // as the full, original implementation always did --
         // this is NOT dead legacy plumbing kept out of caution.
         // Confirmed via direct trace before writing this: every
         // field below has real, widespread external consumers
         // (S.intent: 74 references, S.detTagIds: 52,
         // S.manTagIds: 50, S.qty: 43, S.negatedTagIds: 33,
         // S.desc: 12 -- including the cart/checkout order notes)
         // spanning the cart, checkout, materials display, and
         // tag UI, none of which read the new route/context
         // objects. Skipping this seeding would have silently
         // broken all of that, not just the resolution logic
         // this function used to also implement itself.
         //
         // Deliberately NOT set here, confirmed rather than
         // assumed: S._autoSelectedFrom and S._affirmedTagSet.
         // Both are real fields, but confirmed via direct check
         // that neither is ever read by the new renderer family
         // (renderSelfQuoteFromRoute/renderCuratedCardFromRoute/
         // renderTagAffirmationFromRoute) -- both remain
         // correctly relevant only to sqRenderQuote, which this
         // new flow never calls (sqRenderQuote's own real,
         // remaining callers -- the divergence "Path B" flow and
         // the guided-builder path -- are unrelated to this
         // change and continue setting these fields themselves).
         const ctx = collectBookingContext_freeText(desc);

         S.desc = desc;
         S._nlpSeedDesc = desc;
         S._sizeHint = extractSizeHint(desc, DB.smart_tags || {});
         S._location = ctx.extractedLocation;
         S._objectNoun = ctx.extractedObject;
         S._nlpSeedObject = S._objectNoun;
         S._pendingPivotInfo = ctx._negationOverride;
         S.detTagIds = [...(ctx.detectedTagIds || [])];
         S.manTagIds = [];
         S.negatedTagIds = [...(ctx.negatedTagIds || [])];
         S._tagsAffirmed = false;

         // S.intent: matches the exact fallback default the full
         // legacy implementation always used when NLP found
         // nothing, and the same real base-price enrichment step
         // -- sourced from the orchestrator's own resolution
         // (route.entity) rather than duplicating the older,
         // separate category+stype lookup, since T66 confirmed
         // the orchestrator's own resolution is at least as
         // accurate.
         const baseIntent = ctx.nlpIntent || {
             category: 'other',
             label: 'General',
             base: 70,
             stype: 'Repair',
             qtyLabel: 'item',
             key: 'other',
             group: 'other'
         };
         S.intent = baseIntent;

         const route = executeWorkflow(ctx, DB);
         if (route?.basePrice) {
             S.intent.base = route.basePrice;
         }
         // v9.6 FIX (T103): a real, confirmed bug -- the EXACT bug the
         // user reported via a real, captured trace ("need 5 ceiling
         // tiles put up" -> $1738), traced precisely to THIS free-text
         // path, not the Guided Builder path fixed in T102 (that fix
         // was real and correct for its own path, but this is a
         // separate code location and was not, in fact, covered by
         // it -- confirmed by directly re-testing this exact scenario
         // before writing this fix, not assumed). ctx.extractedQty is
         // the raw number parsed straight out of the customer's own
         // sentence (extractQty("need 5 ceiling tiles put up") = 5) --
         // applying it unconditionally as S.qty, the OUTER price
         // multiplier, double-counts quantity when the resolved
         // entity already has its own, dedicated quantity question
         // (item_count_template) that independently captures the same
         // "how many" via its own answer and complexity-tier
         // escalation. Needed route.entity to be resolved first (this
         // line, not the earlier one this replaced), since
         // entityHasOwnQtyQuestion needs the real, resolved entity to
         // check against.
         S.qty = route.quantity.units;
         window._currentContext = ctx;
         renderRoute(route);
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
         const _stDef = DB?.service_types?.[S.stype] || {};
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
         // T118 (Step 6 item 12, per PENDING_DECISIONS.md #28,
         // definitively confirmed via a real, full jsdom render
         // rather than static code reading alone -- see this
         // item's own verification test): falling back to the
         // full service label when S._objectNoun is unset is the
         // right general idea (confirmed correct, kept as-is),
         // but for a label ending in a nominalized action word
         // (e.g. "Cabinet Door or Drawer Adjustment"), using the
         // WHOLE label as the noun produces a real, confirmed,
         // awkward redundancy once the verb is appended: "I need
         // 1 Cabinet Door or Drawer Adjustment adjusted". Strips
         // exactly one trailing action-suffix word, a small,
         // static, low-risk list rather than a general rewrite of
         // this fallback's own broader logic (deliberately not
         // touched otherwise -- it's correct for the common case,
         // confirmed directly against several other real service
         // names during this fix).
         const _actionSuffixes = /\s+(Adjustment|Replacement|Repair|Installation|Install|Assembly|Configuration|Setup|Diagnostic)$/i;
         const _cleanedLbl = lbl.replace(_actionSuffixes, '').trim();
         let noun = S._objectNoun ||
             (lbl.toLowerCase() !== rawKw && _cleanedLbl.length > 2 ? _cleanedLbl : null) ||
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
             pp.innerHTML = '<i class="ti ti-check" style="font-size:.65rem;margin-right:3px;opacity:.75"></i>' +
                 phrase +
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
         // When called after the legacy curated-intake builder confirms (sqConfirmAdlib),
         // show answered intake questions inline — matches curated card adlib output.
         if (S._svc && S.answers && Object.keys(S.answers).length > 0) {
             const _QM = new Set([...((typeof _GENERIC_QTY_MODULE_KEYS !== 'undefined') ? _GENERIC_QTY_MODULE_KEYS : ['item_count', 'count', 'hybrid_qty', 'global_quantity']), 'item_count_template']);
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
                 const chip = document.createElement('span');
                 chip.style.cssText = 'display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:6px;background:#fff;border:1px solid rgba(0,0,0,.12);font-size:12px;cursor:pointer;';
                 chip.innerHTML = sqTagLabel(t, tid) +
                     ' <i class="ti ti-x" style="font-size:10px;opacity:.4;margin-left:2px"></i>';
                 chip.title = 'Tap to remove this condition';
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
             const icon = DB?.service_types?.[t]?.icon || 'ti-circle-check';
             const ico = icon.startsWith('ti-') ? `<i class="ti ${icon}"></i>` : `<span>${icon}</span>`;
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
             det += `<span class="chip gtag sel" data-tid="${tid}" onclick="sqToggleTag(this,'${tid}')"><i class="ti ti-check"></i> ${sqTagLabel(t,tid)}</span>`;
         });
         if (!det) det = '<span style="font-size:13px;color:#999;font-style:italic">None auto-detected from text</span>';
         const _sqDetTagsEl = document.getElementById('sqDetTags');
         if (_sqDetTagsEl) _sqDetTagsEl.innerHTML = det;

         const _sqQtyLblEl = document.getElementById('sqQtyLbl');
         if (_sqQtyLblEl) _sqQtyLblEl.textContent = S.intent?.qtyLabel || 'item';
         const _sqQtyVEl = document.getElementById('sqQtyV');
         if (_sqQtyVEl) _sqQtyVEl.textContent = S.qty;

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
                 const _feeSfx = ''; // Charter: a chip never shows a fee
                 chips += sel ?
                     `<span class="chip sel gtag" data-tid="${tid}" onclick="sqToggleTag(this,'${tid}')"><i class="ti ti-check"></i> ${sqTagLabel(t,tid)}${_feeSfx}</span>` :
                     `<span class="chip${locked?' locked':''}${chipExtra}" data-tid="${tid}" onclick="sqToggleTag(this,'${tid}')"><i class="ti ti-${isHint?'bulb':'plus'}"></i> ${sqTagLabel(t,tid)}${_feeSfx}</span>`;
             });
             if (chips) html += `<div class="group-label">${gName}</div><div class="chips">${chips}</div>`;
         }
         const _sqDynGroupsEl2 = document.getElementById('sqDynGroups');
         if (_sqDynGroupsEl2) _sqDynGroupsEl2.innerHTML = html;

         // Auto-build adlib immediately
         sqBuildAdlib();
     }

     function sqBuilderFinish() {
         if (typeof _traceStart === 'function') _traceStart({
             builderGroupId: BLD._groupId || null,
             builderQty: BLD.qty
         }, 'guided_builder');
         // Resolve human label from group ID (BLD.object/specific are now group IDs)
         const _rawBldObj = BLD.specific || BLD.object;
         const _bldGrp = _rawBldObj && DB ? (DB.group || []).find(g => g.id === _rawBldObj) : null;
         const obj = _bldGrp?.display_name || _rawBldObj || 'item';
         const action = BLD.action || 'fix';
         const cond = BLD.condition;
         const loc = BLD.location;

         // ── Synthesize description for NLP tag detection & notes ──────
         const desc = composeAdlibSentence({
             actions: [action],
             object: obj,
             location: loc || null,
             condition: cond || null
         });

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
         // v9.6 FIX (T102): a real, severe, confirmed bug (found via a
         // real, user-provided trace showing a $1738 quote for 5
         // ceiling tiles that should have priced closer to $150-250).
         // See entityHasOwnQtyQuestion's own definition for the full,
         // shared rationale (now also used by the free-text path,
         // T103, once the identical bug was found to exist there too
         // via a separate code location).
         S.qty = resolveBuilderQuantity({ category: BLD._cat, stype: normStype, groupId: BLD._groupId, requestedQty: BLD.qty }).units;
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
         const _svcChain = (S._svc?.intake_chain || []);
         const _normStype2 = (S.stype || 'Repair').replace('Install / Mount', 'Install');
         const _dynChain2 = (resolveDynamicService(S.intent?.category, _normStype2, S.intent?._groupId)?.intake_chain || []);
         const _chainSteps = (_svcChain.length ? _svcChain : _dynChain2.length ? _dynChain2 : []);
         const _chainMods = _chainSteps
             .map(s2 => {
                 const m2 = (DB.intake_modules || {})[s2.module];
                 return m2 ? {
                     moduleKey: s2.module,
                     ...m2
                 } : null;
             })
             .filter(Boolean);
         const _modsArr = _chainMods.length > 0 ?
             _chainMods :
             Object.entries(DB.intake_modules || {}).map(([k, mv]) => ({
                 moduleKey: k,
                 ...mv
             }));
         const mods = Object.fromEntries(_modsArr.map(m3 => [m3.moduleKey, m3]));
         for (const [modKey, mod] of Object.entries(mods)) {
             if (!mod.confidence_gain) continue;
             // (A) Explicit curated-intake answer = full gain
             if (S.answers?.[modKey]) {
                 accumulatedConf += mod.confidence_gain;
                 continue;
             }
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
         // v9.6 FIX: was an inline, hand-duplicated reimplementation of
         // resolveBaseConfidenceStrategy's own precedence logic
         // (svc -> dynDef -> hardcoded fallback), not a call to the real
         // function -- the exact "duplicate logic instead of calling the
         // canonical one" pattern this project has repeatedly found
         // elsewhere (T40, T42). Meant this legacy path never picked up
         // Track A's archetype-aware inheritance at all. Replaced with a
         // real call; behavior is identical for every non-archetype-
         // inheriting entity (confirmed via the full, comprehensive
         // catalog re-verification after this fix).
         const baseStrategy = resolveBaseConfidenceStrategy(svcForStrategy, dynDefForStrategy);

         const allActiveTagIds = [...new Set([...S.detTagIds, ...S.manTagIds])];
         const escDef = DB.global_rules?.confidence_escalation;
         let liveStrategy = baseStrategy;
         let escalatedBy = null;
         if (escDef) {
             const RANK = {
                 skilled: 1,
                 specialized: 2
             };
             let worst = null,
                 worstRank = 0;
             for (const tid of allActiveTagIds) {
                 const ov = DB.smart_tags?.[tid]?.effects?.complexity_override;
                 if (ov && (RANK[ov] || 0) > worstRank) {
                     worst = ov;
                     worstRank = RANK[ov];
                 }
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
         // T118 FIX: was force_modules_by_variability[tier], unconditional.
         // Legacy equivalent of orch_compose_intake_chain's own T118 fix,
         // inlined the same way and for the same reason (FNS-list
         // extraction safety -- see that function's own comment).
         // S.intent.category/S.intent._groupId are populated for every real
         // entry path this function runs under (catalog taps synthesize an
         // intent-shaped object via prefillSmartQuoteFromService/
         // prefillSmartQuoteFromOtherTile; free-text populates it directly
         // from detectIntentNLP).
         {
             const _defs = DB.global_rules?.intake_defaults || {};
             S._forceModules = [...new Set([
                 ...(_defs.universal || []),
                 ...(_defs.category_defaults?.[S.intent?.category] || []),
                 ...(_defs.group_defaults?.[S.intent?._groupId] || []),
             ])];
         }

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
         const verb = svc.verb_natural ||
             DB?.service_types?.[svcType]?.verb_natural ||
             'done';

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
         // T118 (operator-directed, real user trace,
         // 2026-09-12): was `fe.pricing_type` -- confirmed
         // directly this field does not exist anywhere in the
         // real data (grepped every service's financial_engine);
         // the real field is `fe.type`. This meant isHourly and
         // isFormula below were structurally unreachable --
         // pricingType always fell back to 'flat_rate' --
         // regardless of a service's real, configured type,
         // silently masking the double-counting bug this same
         // fix corrects just below (shelf_mounting_standard_buy_the_hour
         // was accidentally landing on a closer-to-correct price
         // via the flat_rate branch it should never have reached,
         // not because either bug was actually fixed). Confirmed
         // the real blast radius before fixing, not assumed
         // narrow: exactly one currently self-quoting service
         // has type: "hourly" today.
         const pricingType = fe.type || 'flat_rate';
         const basePrice = fe.base_price || 70;

         // Read pricing engine formula_components from SSOT
         const engineDef = DB.global_rules?.pricing_engines?.[resolveEngineKey(pricingType)] || {};
         const components = engineDef.formula_components || ['base_price'];
         const isHourly = components.includes('calculated_labor') || pricingType === 'hourly';
         const isFormula = pricingType === 'assembly_formula';

         let perItemLabor;
         if (isHourly) {
             // T118 (operator-directed, real user trace,
             // 2026-09-12): was `basePrice + (mins/60)*tierRate`
             // -- adding the service's own base_price AND a
             // separately-computed hourly-time cost together,
             // double-counting the same dollar amount. Confirmed
             // this is a real, live, CURRENT bug, not just a risk
             // in new code: shelf_mounting_standard_buy_the_hour
             // (the original #22 complaint service, still
             // self-quoting today, unchanged by that earlier fix
             // since #22 only removed extra QUESTIONS, never
             // touched this calculation) has been pricing at
             // base_price+tierRate ($145 for a $60 base at the
             // skilled tier's $85/hr) instead of the intended,
             // correct rate this whole session confirms directly:
             // $60 for a 1-hour job at a $60/hr rate.
             //
             // basePrice IS the hourly rate here (matching the
             // flat_rate branch below, where basePrice IS the
             // whole labor total -- the same number means the
             // same thing in both branches, deliberately, so a
             // 1-hour hourly job and an equivalent flat job cost
             // the same). global_rules.pricing_engines.hourly_estimate's
             // own minimum_billable_hours (real, structured data
             // that existed with zero consuming code anywhere in
             // qr.html before this fix -- confirmed via an
             // exhaustive grep, not assumed) now actually
             // determines the real minimum, rather than an
             // accidental floor from expected_minutes happening
             // to equal 60.
             const minHours = DB.global_rules?.pricing_engines?.hourly_estimate?.minimum_billable_hours || 1;
             const mins = om.expected_minutes || 60;
             const billableHours = Math.max(mins / 60, minHours);
             perItemLabor = Math.round(basePrice * billableHours);
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
             // v9.6 FIX: was `svc.financial_engine?.checkout_state || (isHourly ?
             // 'diagnostic' : 'standard_flat_rate')` -- for an archetype-inheriting
             // service that is also hourly-priced (checkout_state and pricing type
             // are separate concerns, confirmed throughout this project), this
             // would have incorrectly defaulted to 'diagnostic' the moment the raw
             // field was genuinely absent, even though the real, correct, resolved
             // value is standard_flat_rate.
             const _csKey = resolveServiceCheckoutStateKey(svc, null).key;
             const _csDef = DB.checkout_states?.[_csKey] || {};
             let estLabel, dispatchNote;
             if (isHourly) {
                 estLabel = 'Est. $' + (totalLabor + dispatch);
                 dispatchNote = '';
             } else {
                 estLabel = S.qty > 1 ?
                     S.qty + '× $' + perItemLabor + ' = $' + totalLabor :
                     '$' + perItemLabor;
                 dispatchNote = ' <span style="font-size:11px;opacity:.6">+ $' + (DB.global_rules?.surcharges?.dispatch_fee || 45) + ' ' + (DB.global_rules?.surcharges?.dispatch_label || 'dispatch') + '</span>';
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
         // The selection rules (mutual exclusion, SSOT `requires`) are Logic -- toggleTagState; this handler only wires the tap to it.
         toggleTagState(S, tid, el.classList.contains('sel'), DB);
         sqBuildStep3();
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
                 group.forEach((s, i) => {
                     s._instanceLabel = `#${i + 1}`;
                 });
             }
         });
     }

     function removeFurnitureEntry(serviceId, idx) {
         const currentCart = window.__store.getState().cart.serviceRequest;
         const svcIndex = currentCart.findIndex(s => s.id === serviceId);
         if (svcIndex === -1) return;
         const svc = currentCart[svcIndex];
         if (!svc?.furnitureItems) return;

         const newFurnitureItems = [...svc.furnitureItems];
         newFurnitureItems.splice(idx, 1);

         if (svc.name?.toLowerCase().includes('assembly') && newFurnitureItems.length === 0) {
             // Remove the whole service
             const newCart = currentCart.filter((_, i) => i !== svcIndex);
             window.__store.dispatch({
                 type: 'cart/SET',
                 payload: {
                     serviceRequest: newCart
                 }
             });
             _recomputeInstanceLabels();
             return;
         }

         const mins = newFurnitureItems.map(f => f.minutes);
         const charge = mathFurnitureAssembly(mins);
         const updatedSvc = {
             ...svc,
             furnitureItems: newFurnitureItems,
             estimatedHours: charge.hours,
             estimatedPrice: charge.price,
             price: `$${charge.price.toFixed(2)}`,
             notes: `Furniture Items: ${newFurnitureItems.map(f => f.label).join(', ')} • Est: ${charge.hours.toFixed(2)} hr • $${charge.price.toFixed(2)}`
         };
         const newCart = currentCart.map((s, i) => i === svcIndex ? updatedSvc : s);
         window.__store.dispatch({
             type: 'cart/SET',
             payload: {
                 serviceRequest: newCart
             }
         });
         _recomputeInstanceLabels();
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
             const currentCart = window.__store.getState().cart.serviceRequest;
             if (currentCart.length && confirm('Remove all services?')) {
                 window.__store.dispatch({
                     type: 'cart/SET',
                     payload: {
                         serviceRequest: []
                     }
                 });
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
             const items = window.__store.getState().cart.serviceRequest;
             if (!items.length) toast('Add at least one service.', 'error');
             else openCartOverlay();
         });
         if (finalBookBtn) finalBookBtn.addEventListener('click', () => {
             const items = window.__store.getState().cart.serviceRequest;
             if (!items.length) toast('Add at least one service.', 'error');
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
         // Category card clicks are wired by renderCategoryCards() which runs
         // before wireGlobalEvents(). No re-wiring needed here -- the cards
         // created by renderCategoryCards() already have correct click listeners
         // (click → showGroupsForCategory). The old clone+re-attach block that
         // was here was stripping those listeners and replacing them with an
         // empty handler, which is why tiles appeared dead.

         // 7. v9.6 FIX: was a second, redundant listener attached here via a
         // clone-and-rebind pattern, on top of sqUnifiedActionBtn's own,
         // pre-existing inline onclick="window.sqUnifiedAction()" (which
         // already, correctly calls sqAnalyze() -- the real, complete
         // dispatcher: high-confidence match, category-matched "Other tile"
         // flow, negation-pivot, and the full Phase 7 tag-affirmation gate,
         // per T29/T33/T36, falling back to sqPrepareFlow only when none of
         // those apply). cloneNode(true) copies the inline onclick rather
         // than removing it, so both fired on every real click -- confirmed
         // empirically, not assumed (T56). Removing this mirrors the exact,
         // already-documented fix two items above for category cards ("the
         // old clone+re-attach block... was stripping those listeners...
         // which is why tiles appeared dead") -- the same bug class, caught
         // once already in this same function, recurring here uncaught.
         //
         // This was not just redundant, it was actively harmful: confirmed
         // directly that when sqAnalyze's dispatch correctly shows the tag-
         // affirmation card (a deliberate, blocking "are we sure we
         // understood you" gate into #serviceRequestSummary) and this
         // second listener's independent executeWorkflow/renderRoute
         // resolution came back uiTemplate:'self_quote', renderSelfQuoteFromRoute
         // silently overwrote the same #serviceRequestSummary container --
         // destroying the confirmation gate before the customer ever saw
         // it, exactly the "psychological keystone" trust mechanism the
         // charter and Phase 7's own design documents describe. sqAnalyze
         // via the inline onclick is now the one, real handler.

         // 8. Answer handler (called from the curated-card chips). The route on screen carries the context that produced it, so ONE route-in /
         // route-out Logic function (orch_apply_answer) answers on every gateway, and the card is re-rendered where it lives (S._lastContainerId).
         // Before T145 this read window._currentRoute / window._currentContext, which only the free-text path ever set: on a catalog tap the chips
         // selected nothing and recorded nothing. (The affirmation handlers below still use those globals -- PENDING_DECISIONS #92.)
         window.handleIntakeAnswer = function(moduleKey, label) {
             const prev = S._lastRoute;
             if (!prev || !prev.context) {
                 toast('Cannot update answers - context lost.', 'error');
                 return;
             }
             const next = orch_apply_answer(prev, moduleKey, label, DB);
             if (next.uiTemplate === 'curated_card') sqRenderCuratedCard(next, S._lastContainerId);
             else renderRoute(next); // the dispatcher owns a change of template
         };

         // T64: orchestrator-native tag-affirmation handlers, following
         // handleIntakeAnswer's exact, established re-invocation pattern
         // immediately above. Real port of a legacy affirm handlers's core
         // behavior -- the negation-pivot branch (a legacy affirm handler's other real
         // case) is deliberately not included here, matching this
         // mechanism's own documented, narrower scope (see the
         // has_unaffirmed_detected_tags rule's own _note in btnyc.json).
         window.orchAffirmYes = function() {
             if (!window._currentContext) {
                 toast('Cannot confirm – context lost.', 'error');
                 return;
             }
             const ctx = window._currentContext;
             // T64 follow-up: real port of a legacy affirm handler's own pivot branch --
             // when a negation pivot is pending, confirming it accepts the
             // pivot specifically, distinct from affirming a plain detected-tag
             // set. Matches a legacy affirm handler's exact real behavior: only one of the
             // two fields is set per click, whichever this specific card was
             // actually confirming.
             if (window._currentRoute?.negationOverride) {
                 ctx.negationPivotAccepted = true;
             } else {
                 ctx.tagsAffirmed = true;
             }
             const newRoute = executeWorkflow(ctx, DB);
             window._currentRoute = newRoute;
             window._currentContext = ctx;
             renderRoute(newRoute);
         };

         window.orchAffirmNo = function() {
             // Real port of a legacy affirm handler's actual behavior: let the customer
             // retype rather than force a specific correction. Clears the
             // stored route/context so the next free-text submission starts
             // genuinely fresh, not layered on a rejected prior resolution.
             window._currentRoute = null;
             window._currentContext = null;
             const container = document.getElementById('serviceRequestSummary');
             if (container) {
                 container.innerHTML = '';
                 container.style.display = 'none';
             }
             if (typeof exitFocusedMode === 'function') exitFocusedMode();
             const sqEl = document.getElementById('smartQuoteEngine');
             if (sqEl) sqEl.style.display = 'block';
             const textarea = document.getElementById('sqDescIn');
             if (textarea) {
                 textarea.focus();
                 textarea.select();
             }
         };

         // T66 follow-up: real port of a legacy affirm handler. The legacy version
         // does an in-place DOM patch (remove the chip element, update the
         // price text directly) rather than a full re-render -- deliberately
         // not replicated here; this reuses the same full re-render pattern
         // every other handler in this family already uses
         // (orchAffirmYes/orchAffirmNo), which is simpler and more consistent,
         // at the cost of a visible re-render instead of an in-place patch.
         // The end-user-visible outcome is equivalent: the tag is gone, the
         // price reflects it. Removal is treated as explicit negation
         // (matching the legacy version exactly, not just "forgotten"), and
         // the "all tags removed" case needs no special-casing here: once
         // detectedTagIds is empty, has_unaffirmed_detected_tags naturally
         // evaluates false, so the existing rule matrix correctly falls
         // through to whatever template is genuinely next on its own.
         window.orchAffirmRemoveTag = function(tid) {
             if (!window._currentContext) {
                 toast('Cannot update – context lost.', 'error');
                 return;
             }
             const ctx = window._currentContext;
             ctx.detectedTagIds = (ctx.detectedTagIds || []).filter(t => t !== tid);
             ctx.negatedTagIds = [...(ctx.negatedTagIds || []), tid];
             ctx.tagsAffirmed = false; // re-check the remaining set, don't inherit prior affirmation
             const newRoute = executeWorkflow(ctx, DB);
             window._currentRoute = newRoute;
             window._currentContext = ctx;
             renderRoute(newRoute);
         };

         // T66 follow-up: real port of a legacy affirm handler, for the new
         // sibling-service recommendation cards. Deliberately reuses
         // prefillSmartQuoteFromService directly rather than building a new,
         // orchestrator-native re-selection path -- that function already,
         // correctly sets up S.intent from the service object itself (confirmed
         // directly), sidestepping the broader S-bridging question this
         // specific piece doesn't need to solve.
         window.orchAffirmSelectService = function(svcId) {
             if (window._currentContext) window._currentContext.tagsAffirmed = true;
             const svc = DB.services.find(s => s.id === svcId);
             if (svc) {
                 const catId = svc.ui_taxonomy?.category_id || window._currentRoute?.intentCategory || 'other';
                 prefillSmartQuoteFromService(svc, catId);
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

     function orchChooseDivergencePath(path) {
         // T135+ (PHASE_PLAN.md Phase 2, Stage C, call site 2). Orchestrator
         // equivalent of the legacy divergence handler -- same two paths, same
         // shared S._divergencePath flag (this one piece of transient
         // UI-interaction state, "has the customer already answered this
         // specific fork," is reused across both renderers deliberately;
         // it is not a pricing or routing decision, so sharing it here
         // does not reintroduce the business-logic-in-renderers problem
         // Stage C exists to remove). Requires S._lastRoute to have been
         // set by the caller (renderCuratedCardFromRoute already does
         // this on every render) so this function knows which entity/
         // category to re-resolve against.
         if (path !== 'remote' && path !== 'onsite') return; // defensive: unknown path, no-op
         S._divergencePath = path;
         const prevRoute = S._lastRoute;
         if (!prevRoute || !prevRoute.entity) return; // defensive: nothing to re-render against

         if (path === 'remote') {
               // Logic owns the composition (orch_apply_remote_divergence, orchestrator).
               // This handler records the choice, keeps the route, and hands it to the renderer.
               const newRoute = orch_apply_remote_divergence(prevRoute, DB);
             sqRenderCuratedCard(newRoute, S._lastContainerId);
             return;
         }
         // Path B (On-Site Pro): nothing new to build -- re-render the
         // same route; the divergence-choice branch below is skipped
         // now that S._divergencePath is set, falling through to the
         // normal, existing diagnostic quote panel.
         sqRenderCuratedCard(prevRoute, S._lastContainerId);
     }

     // sqRenderCuratedCard -- GLUE. The one place that records "the route currently on screen" (S._lastRoute /
     // S._lastContainerId, which the divergence handler reads) and hands the renderer the resolved state it needs.
     // renderCuratedCardFromRoute itself is a renderer: it reads and writes no session state.
     function sqRenderCuratedCard(route, containerId) {
         S._lastRoute = route;
         S._lastContainerId = containerId || 'intakeQuestionsContainer';
         // ui_config.affects_price_icon is authored as a bare Tabler suffix ("ti-currency-dollar"); normalise to the "ti ti-..." form _iconContent takes.
         const _ap = DB.ui_config?.affects_price_icon;
         const affectsPriceIcon = _ap ? (_ap.startsWith('ti ') ? _ap : 'ti ' + _ap) : null;
         renderCuratedCardFromRoute(route, containerId, { divergencePath: S._divergencePath, affectsPriceIcon });
     }

     function _sqSwitchToRecommended(sku, categoryId) {
         const svc = (DB.services || []).find(sv => sv.id === sku);
         if (!svc) return;
         const catId = categoryId || svc.ui_taxonomy?.category_id || S.intent?.category || null;
         prefillSmartQuoteFromService(svc, catId);
     }

     function sqHandleStep2() {
         if (!S.stype) return;
         sqMarkDone(2, S.stype);
         sqBuildStep3();
         sqMarkDone(3, S.stype);

     }

     function sqAddToCart() {
         if (typeof _trace === 'function') _trace('ui_renderer', 'sqAddToCart: invoked', {
             serviceId: S.intent?.key || null,
             qty: S.qty,
             answersCount: Object.keys(S.answers || {}).length
         });
         if (!cartLimiter.isAllowed('add')) {
             toast('Adding too fast.', 'error');
             return;
         }
         const q = computeQuoteFromState(S);
         // Divergence Resolution: when the customer booked via the
         // On-Site Pro path (the legacy divergence handler('onsite')), record
         // the real credit policy + fee on the cart entry itself -- this
         // is currently disclosure/ops record-keeping, not an automated
         // credit-at-invoicing mechanism (see global_rules.
         // divergence_resolution.credit_policy's own schema
         // description), but it's a real, genuine consumer of the
         // field, not just business copy nobody reads. v9.5.1: credit_policy
         // is now authored as a full, real sentence rather than a short
         // machine key -- appended as its own sentence rather than after
         // a "credit policy: " label, so this reads correctly either way.
         const _divergenceNote = (S._divergencePath === 'onsite' && q.isDiagnostic) ?
             '\n' + onsiteDiagnosticTerms(q).bookingNote :
             '';
         addToCart({
             id: 'sq-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
             serviceId: S.intent?.key || 'smartquote',
             category_id: S.intent?.category || 'other',
             name: (S.intent?.label || 'Service') + (S.intent?.group && S.intent.group !== S.intent.label ? ' – ' + S.intent.group : ''),
             price: '$' + q.laborCalc,
             icon: '⚡',
             detail: S.desc?.substring(0, 80) || 'SmartQuote estimate',
             notes: 'SmartQuote · ' + (S.desc || '') + (q.activeLabels.length ? '\nConditions: ' + q.activeLabels.join(', ') : '') +
                 (S._location ? '\nLocation: ' + S._location : '') + (S._objectNoun ? '\nItem: ' + S._objectNoun : '') +
                 _divergenceNote,
             materialsNotIncluded: true,
             materialsEstimateRange: [0, 0]
         });
         toast((S.intent?.label || 'Service') + ' added to request!', 'success');
         sqRestart();
         if (DOM.serviceRequestSummary) DOM.serviceRequestSummary.style.display = 'block';
         DOM.serviceRequestSummary?.scrollIntoView({
             behavior: 'smooth',
             block: 'start'
         });
         renderCart();
     }

     function sqRestart() {
         // Full reset — EVERY field either S or BLD can ever carry must be
         // listed here explicitly. This is the root fix for the cart-collision
         // bug: several fields (_confidenceStrategy, _escalatedBy, _forceModules,
         // _fromBuilder, _selfQuoteSvc on S; _groupId, _keyword, _fromOtherTile,
         // _contextLabel, _objectLabel on BLD) were being SET by various entry
         // points (Other-tile prefill, builder, free text) but never CLEARED
         // here, so they silently carried over into the next SmartQuote session
         // and could leak into a new cart entry's notes/pricing/routing.
         S = {
             qty: 1,
             intent: null,
             stype: null,
             detTagIds: [],
             manTagIds: [],
             negatedTagIds: [],
             userTagIds: [],
             desc: '',
             adlibConfirmed: false,
             _suggestedTagIds: [],
             _svc: null,
             answers: {},
             _curatedMode: false,
             _tagsAffirmed: false,
             _affirmedTagSet: null,
             _divergencePath: null,
             _negationPivotAccepted: false,
             _pendingPivotInfo: null,
             _jobNotes: '',
             _objectNoun: null,
             _location: null,
             _sizeHint: null,
             _notes: null,
             _confidenceStrategy: null,
             _escalatedBy: null,
             _forceModules: null,
             _fromBuilder: false,
             _selfQuoteSvc: null,
             _isOtherTileEntry: false,
             _autoSelectedFrom: null,
             _nlpSeedDesc: null,
             _nlpSeedObject: null
         };
         BLD = {
             step: 0,
             action: null,
             object: null,
             specific: null,
             condition: null,
             location: null,
             qty: 1,
             _stype: null,
             _cat: null,
             _groupId: null,
             _keyword: null,
             _fromOtherTile: false,
             _contextLabel: null,
             _objectLabel: null,
             _allowedTypes: null
         };
         // Everything below touches only the DOM -- the view reset is a renderer (UIRenderer.sqResetView).
         sqResetView();
     }

     function sqOpenBuilderPreseeded({
         action,
         groupId,
         categoryLabel,
         allowedTypes
     }) {
         sqShowBuilderView();
const groupObj = groupId ? groupMap.get(groupId) : null;
         // Charter (Structural availability): a fact that is structural to the
         // job -- a stove is always in the kitchen -- is never asked. Groups
         // declare typical_location in the SSOT; the builder's skip-forward
         // logic passes any pre-seeded (non-null) step. [v9.5 fix -- same
         // lost-duplicate story as above.]
         const typicalLocation = groupObj?.typical_location || null;

         BLD = {
             step: 0,
             action,
             // Group is already known from navigation -- seed it directly as the
             // object, skipping the redundant "what is it?" step.
             object: groupId || null,
             specific: null,
             condition: null,
             location: typicalLocation,
             // qty MUST be null (not 1): the skip-forward logic treats any
             // non-null field as answered, which silently skipped the qty step
             // (PENDING_DECISIONS #21, T118). sqBuilderFinish defaults it to 1.
             qty: null,
             _stype: S.stype || null,
             _cat: S.intent?.category || null,
             // set directly: this pre-seed bypasses the chip tap that normally
             // sets them (see sqBuilderChoose)
             _groupId: groupId || null,
             _keyword: groupId ? bldGroupToKeyword(groupId, S.intent?.category) : null,
             _fromOtherTile: true,
             _contextLabel: categoryLabel || null,
             _objectLabel: groupObj?.display_name || null,
             // narrows the action step when the tile carried several types
             _allowedTypes: allowedTypes || null
         };

         const allSteps = sqBuilderGetSteps();
         for (let i = 0; i < allSteps.length; i++) {
             const sid = allSteps[i];
             if (BLD[sid] !== null && BLD[sid] !== undefined) BLD.step = i + 1;
             else break;
         }
         if (BLD.step >= allSteps.length) BLD.step = allSteps.length - 1;

         sqBuilderRender();
     }

     // sqRenderQuote -- GLUE. Builds the quote view-model (Logic) for the current session and hands it to the renderer.
     function sqRenderQuote() {
         const model = buildQuotePanelModel(S, DB);
         const out = document.getElementById('sqQuoteOut');
         if (!out) return;
         renderQuotePanel(out, model);
     }
 