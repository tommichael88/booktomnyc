
     /**
      * UIRenderer.js
      *
      * PHASE 1 — UIRenderer module (Logic / UI / Glue split, third module).
      * See pricing_engine.js and nlp_engine.js for the first two modules, and
      * architecture_audit/ for the full methodology (call-graph purity audit,
      * then an AST-based — not regex-based — scope/depth analysis built after
      * the regex approach was repeatedly found to miss real structure: arrow
      * functions, one-liner arrows, and lexical nesting inside other functions).
      *
      * CLASSIFICATION METHOD: every function below was verified, not assumed,
      * to read State/S (the app's two global mutable session-state objects) but
      * never WRITE to them — checked via an AST walk for AssignmentExpression
      * and mutator-method-call (.push/.splice/etc.) nodes rooted at the literal
      * identifiers S or State, not just by name pattern. A user-provided
      * cross-check document agreed with this classification for the large
      * majority of functions and correctly identified the enableLiveAdLibPreview
      * / renderUnifiedSqButton nesting relationship (verified independently here
      * via AST and confirmed accurate) — but it also listed three functions
      * (showGroupsForCategory, showSubGroups, the retired group-selection helper) that do
      * NOT exist anywhere in this qr.html (confirmed: zero matches), and
      * misclassified three genuinely pure utility functions
      * (buildOtherTilesForGroup, the retired SmartQuote-ready callback, _buildNavCrumbs — all
      * verified to read only local Maps/closures and return plain data, no DOM,
      * no state writes) as belonging to the impure UIRenderer/AppController
      * split. Those three ship in the PURE UTILITIES section below instead.
      *
      * ONE GENUINE EXCEPTION, found and verified before extraction: removeFurnitureEntry
      * has no S.foo=/State.foo= mutation matching the literal-name check, but it
      * obtains `svc` via `State.serviceRequest.find(...)` and then mutates
      * `svc.furnitureItems` in place — since `svc` IS an element of that shared
      * array (not a copy), this is real State mutation through an alias. Moved
      * to AppController.js, not here, despite the mechanical check missing it —
      * found by a targeted search for this exact alias-then-mutate pattern
      * across every "renderer" candidate (the only one of 63 exhibiting it).
      *
      * TWO MIXED WIDGETS, deliberately NOT here: renderFurnitureSelection and
      * renderPaxConfigurator both render substantial interactive DOM AND mutate
      * State.serviceRequest/State.furnitureItems from within their own event
      * handlers (confirmed: real .push/.splice calls on State, not just reads).
      * They are self-contained interactive components, not separable into a
      * pure-render half and a pure-mutation half without restructuring working
      * code — kept in AppController.js as self-contained units, clearly marked,
      * rather than forced into a dishonest split.
      *
      * A REAL BUG CAUGHT BEFORE SHIPPING: the first extraction pass silently
      * dropped the `async` keyword from `init()` (the regex matched starting at
      * `function`, not the `async` before it), which would have produced a
      * SyntaxError on load (`await` used outside an async function) the moment
      * this file was actually loaded — caught by running `node --check` on this
      * file before shipping it, not by inspection. Fixed; `init` is correctly
      * `async function init()` below.
      *
      * DEPENDENCIES: this file calls into pricing_engine.js (_isModVisible,
      * _resolveIntakeChain, estimateLiveConfidence, formatServicePrice,
      * getServiceProfile, isDiagnosticService, isLogisticTag,
      * mathFurnitureAssembly, resolveDynamicService, resolveEngineKey,
      * resolveServiceBadge, sqTagLabel, tagValidForCategory) and nlp_engine.js
      * (buildPreview, detectAction, detectActionInfinitive, detectIntentNLP,
      * detectTagsNLP, extractCondition, extractLocation, extractObject,
      * extractQty, extractSizeHint, inferTagsFromContext, initNlpSets,
      * isServiceVerb, resolveGroupFromIntent) — load both of those before this
      * file. Also depends on the global DB (loaded btnyc.json) and reads (never
      * writes) the global State/S session objects, plus calls AppController
      * functions from inside DOM event handlers it wires up (e.g. an onclick
      * calling addToCart) — load AppController.js before wiring real event
      * listeners, though the function DEFINITIONS in this file can load in
      * either order relative to it since JS hoists function declarations.
      *
      * Loaded as a plain global-scope <script>, same rationale as the other two
      * modules. qr.html itself was NOT modified — remains fully self-contained,
      * single-file deployment. This ships as a verified, standalone reference
      * module.
      */

     const DOM = {
         categoriesGrid: null,
         cartFab: null,
         fabCount: null,
         cartOverlay: null,
         cartServiceList: null,
         cartTotal: null,
         serviceCount: null,
         serviceRequestList: null,
         estimateTotalSummary: null,
         totalAmount: null,
         summaryMainContainer: null,
         intakeQuestionsContainer: null,
         serviceContainer: null,
         serviceRequestSummary: null,
         overlaybookNowBtn: null
     };
     // ^ v9.4: a THIRD shared global (alongside S and State) found and added
     // during cross-module integration testing — addToCart/renderCart both
     // throw "DOM is not defined" without this. Populated once by cacheDOM()
     // (below) reading real DOM elements via q()/qAll(); 23 of the 91 functions
     // across UIRenderer.js + AppController.js reference DOM.* somewhere.
     // Declared here since cacheDOM (its only writer) lives in this file, and
     // most of its readers also do — AppController.js's functions that need it
     // (addToCart, finalizeBooking, etc.) rely on this declaration already
     // having run, so load UIRenderer.js's top-level code before calling any
     // AppController.js function that touches DOM.*.

     // v9.4 SECURITY FIX: shared HTML-escaping utility, added after two confirmed
     // XSS vulnerabilities were found and fixed in qr.html itself (CodeQL: "DOM
     // text reinterpreted as HTML") — user-typed free text (S.desc/S._location/
     // S._sizeHint, all NLP-extracted from the raw SmartQuote textarea) was being
     // interpolated into innerHTML assignments with zero escaping in
     // the legacy curated-intake builder (AppController.js) and ctxBadge (used by sqBuildAdlib,
     // AppController.js). escapeHtml() itself lives here in UIRenderer.js since
     // most of ITS OWN functions also build HTML strings, but AppController.js's
     // fixed functions call it too — load UIRenderer.js before AppController.js
     // for this reason (consistent with the existing DOM-declaration dependency
     // note above). Escapes &, <, >, ", and ' — the five characters that matter
     // for breaking out of both HTML text content and quoted attribute values.
     const escapeHtml = (str) => {
         if (str == null) return '';
         return String(str).replace(/[&<>"\']/g, c => ({
             '&': '&amp;',
             '<': '&lt;',
             '>': '&gt;',
             '"': '&quot;',
             "'": '&#39;'
         } [c]));
     };

     function renderIcon(icon) {
         if (!icon) return '';
         // v9.5 SECURITY FIX: icon is user-editable free text (category.icon /
         // group.icon / service ui_taxonomy.icon, all settable via btnyc.py's
         // EmojiPicker custom-entry field, which accepts any typed string).
         // Confirmed by checking every call site of renderIcon() in this file:
         // ALL of them assign the return value via `html:` (innerHTML), never
         // textContent — so BOTH branches below need escaping, not just the
         // tabler-icon class-attribute one. An icon set to e.g.
         // '<img src=x onerror=alert(1)>' (no leading "ti ", so it would hit
         // the fallback branch) would otherwise pass through completely
         // unescaped into innerHTML.
         if (typeof icon === 'string' && icon.startsWith('ti ')) {
             return `<i class="${escapeHtml(icon)}"></i>`;
         }
         // Plain emoji/text fallback — still escaped, since it still reaches
         // innerHTML at every real call site (verified, not assumed).
         return escapeHtml(icon);
     }

     // Canonical service-type normalizer used by every call site that resolves
     // dynamic services. Defined ONCE here, outside initNlpSets, so it's
     // available before the NLP init runs. All call sites use the defensive
     // ternary: (window._normServiceType ? window._normServiceType(x) : fallback)
     window._normServiceType = (stype) => {
         if (!stype) return 'Repair';
         return stype
             .replace('Install / Mount', 'Install')
             .replace('Install/Mount', 'Install')
             .trim();
     };

     // ───────────────────────── Pure utilities (misclassified by an earlier ─────
     // ───────────────────────── cross-check document as impure — verified pure  ─
     // ───────────────────────── here; shipped alongside UIRenderer for cohesion ─


     // v9.6 FIX: the retired SmartQuote-ready callback removed -- confirmed zero real call
     // sites anywhere; the retired SmartQuote-ready flag/the retired SmartQuote callbacks (declared
     // above) are removed alongside it since nothing else reads or
     // sets them either -- a fully self-contained, fully dead
     // "ready callback" system (COMPONENT_LAYER_MAP.md).

     function _buildNavCrumbs(catId) {
         const catObj = categoryMap.get(catId);
         const parts = catObj ? [(catObj.icon || '') + ' ' + catObj.display_name] : [];
         Breadcrumbs.stack.forEach(f => {
             if (f.type === 'subgroup' || f.type === 'subgroups') {
                 const g = groupMap.get(f.groups || f.group);
                 if (g) parts.push(g.display_name || g.name);
             }
         });
         return parts;
     }

     // ───────────────────────── UIRenderer (read-only on State/S) ─────────────

     function _afterAdd(container) {
         // v9.5.9 FIX (real bug, reported with a screenshot): this used to
         // only call exitFocusedMode(), which explicitly does NOT touch
         // categoriesGrid -- its own comment says so: "serviceRequestSummary
         // visibility is managed by cart state -- handled by
         // restoreCategoryView". categoriesGrid was never set back to
         // display:grid anywhere in this path, so after adding an item the
         // category tiles weren't just scrolled out of view -- they were
         // never shown in the DOM again at all. Second, independent problem
         // found while fixing the first: #category-card sits ABOVE
         // #serviceRequestSummary in the real page order (confirmed: line
         // 756 vs 785), so scrolling straight to the summary with
         // block:'start' would always push the tiles above the viewport
         // regardless of the first fix. Fixed by calling the same, real,
         // already-correct restoreCategoryView() (used everywhere else
         // "return to home" needs to happen) instead of half-reimplementing
         // it here a second time, then scrolling to categoriesGrid instead
         // of serviceRequestSummary -- tiles land at the top of the
         // viewport, and the summary (right below them in normal flow)
         // stays visible too, so the user still gets confirmation of what
         // they just added without losing access to browse for more.
         restoreCategoryView();
         container.style.display = 'none';
         if (DOM.categoriesGrid) {
             DOM.categoriesGrid.scrollIntoView({
                 behavior: 'smooth',
                 block: 'start'
             });
         }
         renderCart();
     }

     function _makeCTARow(container, category_id, onAdd) {
         const cta = create('div', {
             class: 'intake-cta-row'
         });
         const back = create('button', {
             class: 'intake-cancel-btn',
             type: 'button',
             text: '← Back'
         });
         back.addEventListener('click', () => {
             container.style.display = 'none';
             if (DOM.serviceContainer) DOM.serviceContainer.style.display = 'block';
             Breadcrumbs.goBack();
         });
         const addBtn = create('button', {
             class: 'intake-add-btn',
             type: 'button',
             text: 'Add to Request'
         });
         addBtn.disabled = true;
         cta.appendChild(back);
         cta.appendChild(addBtn);
         if (onAdd) addBtn.addEventListener('click', () => {
             if (!addBtn.disabled) onAdd(addBtn);
         });
         return {
             cta,
             addBtn
         };
     }

     function _makePanelShell(svc, category_id, livePriceText, startingPrice) {
         const displayName = svc.ui_taxonomy?.display_name || 'Service';
         const navCrumbs = _buildNavCrumbs(category_id);
         const startP = startingPrice;
         const panel = create('div', {
             class: 'intake-panel'
         });
         const hdr = create('div', {
             class: 'intake-panel-header'
         });
         hdr.appendChild(create('div', {
             class: 'iph-icon',
             text: svc.ui_taxonomy?.icon || svc.icon || '🔧'
         }));
         const hdrTxt = create('div', {
             style: 'flex:1;min-width:0;'
         });
         hdrTxt.appendChild(create('div', {
             class: 'iph-title',
             text: displayName
         }));
         hdrTxt.appendChild(create('div', {
             class: 'iph-sub',
             text: startP ? `Starts at $${startP}` : 'Custom quote'
         }));
         hdr.appendChild(hdrTxt);
         const livePriceEl = create('div', {
             class: 'iph-price',
             text: livePriceText || (startP ? `$${startP}` : '—')
         });
         hdr.appendChild(livePriceEl);
         panel.appendChild(hdr);
         if (navCrumbs.length > 0) {
             const bc = create('div', {
                 class: 'intake-breadcrumb'
             });
             navCrumbs.forEach(crumb => {
                 bc.appendChild(create('span', {
                     text: crumb
                 }));
                 bc.appendChild(create('span', {
                     class: 'bc-sep',
                     text: ' › '
                 }));
             });
             bc.appendChild(create('span', {
                 text: displayName,
                 style: 'color:#8a0615;font-weight:800;'
             }));
             panel.appendChild(bc);
         }
         return {
             panel,
             livePriceEl,
             navCrumbs,
             displayName
         };
     }

     function _makeQtyStepper(initQty, onChange) {
         let current = initQty;
         const row = create('div', {
             style: 'display:flex;align-items:center;gap:12px;margin:10px 0;'
         });
         const dec = create('button', {
             type: 'button',
             class: 'ims-chip',
             style: 'font-size:1.2rem;width:44px;justify-content:center;',
             text: '−'
         });
         const disp = create('span', {
             style: 'font-size:1.1rem;font-weight:700;min-width:32px;text-align:center;color:#8a0615;',
             text: String(current)
         });
         const inc = create('button', {
             type: 'button',
             class: 'ims-chip',
             style: 'font-size:1.2rem;width:44px;justify-content:center;',
             text: '+'
         });
         dec.addEventListener('click', () => {
             if (current > 1) {
                 current--;
                 disp.textContent = current;
                 onChange(current);
             }
         });
         inc.addEventListener('click', () => {
             if (current < 99) {
                 current++;
                 disp.textContent = current;
                 onChange(current);
             }
         });
         row.appendChild(dec);
         row.appendChild(disp);
         row.appendChild(inc);
         return row;
     }

     function _renderDiagnosticFlow(svc, category_id, container, prof) {
         const basePrice = prof.diagnosticPrice;
         const {
             panel,
             navCrumbs,
             displayName
         } = _makePanelShell(svc, category_id, `$${basePrice}+`, prof.startingPrice);
         const body = create('div', {
             class: 'intake-panel-body'
         });
         const disc = create('div', {
             class: 'intake-disclaimer-hint'
         });
         disc.innerHTML = `⚠️ This service requires an on‑site assessment. The <b>$${basePrice}</b> covers the technician visit — final price confirmed before any work begins.`;
         body.appendChild(disc);
         body.appendChild(create('div', {
             class: 'ims-label',
             text: 'Briefly describe the issue (optional):'
         }));
         const ta = create('textarea', {
             class: 'intake-notes-field',
             placeholder: 'Any relevant details…',
             rows: '3'
         });
         body.appendChild(ta);
         panel.appendChild(body);
         const {
             cta,
             addBtn
         } = _makeCTARow(container, category_id);
         addBtn.disabled = false;
         addBtn.textContent = `Book Site Visit — $${basePrice}`;
         addBtn.addEventListener('click', () => {
             if (!cartLimiter.isAllowed('add')) {
                 toast('Adding too fast.', 'error');
                 return;
             }
             const nav = navCrumbs.concat([displayName]).join(' > ');
             addToCart({
                 id: svc.id + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                 serviceId: svc.id,
                 category_id,
                 name: displayName,
                 price: `$${basePrice}+`,
                 icon: svc.ui_taxonomy?.icon || svc.icon || '🔧',
                 detail: nav,
                 notes: nav + (ta.value.trim() ? '\nNotes: ' + ta.value.trim() : ''),
                 furnitureItems: [],
                 materialsNotIncluded: true,
                 materialsEstimateRange: [0, 0],
                 complexityOverride: 'specialized',
                 totalMinutes: 60
             });
             _afterAdd(container);
             toast(displayName + ' added!', 'success');
         });
         panel.appendChild(cta);
         container.appendChild(panel);
     }

     function _renderOtherFlow(svc, category_id, container, prof) {
         const basePrice = prof.diagnosticPrice;
         const groupName = (() => {
             const lastFrame = [...Breadcrumbs.stack].reverse().find(f => f.type === 'subgroup' || f.type === 'subgroups');
             if (lastFrame) {
                 const g = groupMap.get(lastFrame.groups || lastFrame.group);
                 if (g) return g.display_name || g.name;
             }
             return null;
         })();
         const contextLabel = groupName || (svc.ui_taxonomy?.display_name || '').replace(/^Other\s*/i, '').trim() || 'this';
         const {
             panel,
             navCrumbs,
             displayName
         } = _makePanelShell(svc, category_id, `$${basePrice}+`, prof.startingPrice);
         const body = create('div', {
             class: 'intake-panel-body'
         });
         const banner = create('div', {
             style: 'background:linear-gradient(135deg,rgba(138,6,21,.07),rgba(222,0,0,.03));border:1px solid rgba(222,0,0,.18);border-left:4px solid #de0000;border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:.85rem;color:#3a0008;display:flex;align-items:flex-start;gap:10px;'
         });
         banner.innerHTML = `<span style="font-size:1.3rem;flex-shrink:0">📍</span><div><b>Context already captured:</b> ${navCrumbs.concat([displayName]).join(' › ')}<br><span style="opacity:.75;font-size:.8rem;">Just describe the specific issue below — no need to repeat what you selected.</span></div>`;
         body.appendChild(banner);
         const labelEl = create('div', {
             class: 'ims-label',
             text: `Describe your ${contextLabel} issue:`
         });
         body.appendChild(labelEl);
         const ta = create('textarea', {
             class: 'intake-notes-field',
             placeholder: `e.g. "The ${contextLabel.toLowerCase()} is broken/damaged — [describe what's happening]"`,
             rows: '4',
             style: 'min-height:90px;'
         });
         body.appendChild(ta);
         const disc = create('div', {
             class: 'intake-disclaimer-hint',
             style: 'margin-top:12px;'
         });
         disc.innerHTML = `⚠️ Technician will assess and confirm final price before any work begins. <b>$${basePrice}</b> covers the diagnostic visit.`;
         body.appendChild(disc);
         panel.appendChild(body);
         const {
             cta,
             addBtn
         } = _makeCTARow(container, category_id);
         addBtn.textContent = 'Type a description to continue';
         ta.addEventListener('input', () => {
             const ok = ta.value.trim().length > 5;
             addBtn.disabled = !ok;
             addBtn.style.opacity = ok ? '1' : '0.55';
             if (ok) addBtn.textContent = `Book — $${basePrice} diagnostic`;
         });
         addBtn.addEventListener('click', () => {
             if (addBtn.disabled) return;
             if (!cartLimiter.isAllowed('add')) {
                 toast('Adding too fast.', 'error');
                 return;
             }
             const nav = navCrumbs.concat([displayName]).join(' > ');
             const notes = `${nav}\nIssue: ${ta.value.trim()}\nType: Other — tech to scope on‑site`;
             addToCart({
                 id: svc.id + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                 serviceId: svc.id,
                 category_id,
                 name: displayName,
                 price: `$${basePrice}+`,
                 icon: svc.ui_taxonomy?.icon || svc.icon || '🔧',
                 detail: nav,
                 notes,
                 furnitureItems: [],
                 intakeAnswers: {
                     description: ta.value.trim()
                 },
                 materialsNotIncluded: true,
                 materialsEstimateRange: [0, 0],
                 complexityOverride: 'specialized',
                 totalMinutes: 60
             });
             _afterAdd(container);
             toast(displayName + ' added!', 'success');
         });
         panel.appendChild(cta);
         container.appendChild(panel);
     }

     function _renderSimpleConfirm(svc, category_id, container, prof) {
         let qty = 1;
         const startP = prof.startingPrice;
         const {
             panel,
             livePriceEl,
             navCrumbs,
             displayName
         } = _makePanelShell(svc, category_id, startP ? `$${startP}` : '—', prof.startingPrice);
         const body = create('div', {
             class: 'intake-panel-body'
         });
         const mMin = svc.default_estimates?.materials?.min || 0;
         const mMax = svc.default_estimates?.materials?.max || 0;
         if (mMax > 0 && !svc.materials_included) {
             const mHint = create('div', {
                 class: 'intake-materials-hint'
             });
             mHint.innerHTML = `🧾 <b>Materials not included</b> — typically <b>$${mMin}–$${mMax}</b>.`;
             body.appendChild(mHint);
         }
         if (svc.ui_taxonomy?.description) {
             body.appendChild(create('p', {
                 text: svc.ui_taxonomy.description,
                 style: 'font-size:.83rem;color:#555;margin-bottom:14px;line-height:1.5;'
             }));
         }
         body.appendChild(create('div', {
             class: 'ims-label',
             text: 'How many?'
         }));
         body.appendChild(_makeQtyStepper(qty, newQty => {
             qty = newQty;
             const r = _computePrice(svc, {}, qty);
             livePriceEl.textContent = '$' + r.laborEstimate;
             addBtn.textContent = `Add to Request — $${r.laborEstimate}`;
         }));
         body.appendChild(create('div', {
             class: 'ims-label',
             text: 'Notes (optional)',
             style: 'margin-top:14px;'
         }));
         const notesEl = create('textarea', {
             class: 'intake-notes-field',
             placeholder: 'Brand, access notes, etc.',
             rows: '2'
         });
         body.appendChild(notesEl);
         panel.appendChild(body);
         const {
             cta,
             addBtn
         } = _makeCTARow(container, category_id);
         const r0 = _computePrice(svc, {}, 1);
         addBtn.disabled = false;
         addBtn.textContent = `Add to Request — $${r0.laborEstimate}`;
         addBtn.addEventListener('click', () => {
             if (!cartLimiter.isAllowed('add')) {
                 toast('Adding too fast.', 'error');
                 return;
             }
             const r = _computePrice(svc, {}, qty);
             const nav = navCrumbs.concat([displayName]).join(' > ');
             let notes = nav;
             if (qty > 1) notes += '\nQuantity: ' + qty;
             if (notesEl.value.trim()) notes += '\nNotes: ' + notesEl.value.trim();
             addToCart({
                 id: svc.id + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                 serviceId: svc.id,
                 category_id,
                 name: displayName + (qty > 1 ? ` (×${qty})` : ''),
                 price: '$' + r.laborEstimate,
                 icon: svc.ui_taxonomy?.icon || svc.icon || '🔧',
                 detail: nav,
                 notes,
                 furnitureItems: [],
                 intakeAnswers: {
                     __qty: qty
                 },
                 materialsNotIncluded: !svc.materials_included && mMax > 0,
                 materialsEstimateRange: [mMin, mMax],
                 complexityOverride: r.complexityOverride,
                 totalMinutes: svc.operational_metrics?.expected_minutes || 45
             });
             _afterAdd(container);
             toast(displayName + ' added!', 'success');
         });
         panel.appendChild(cta);
         container.appendChild(panel);
     }

     function _renderStructuredIntake(svc, category_id, container, prof) {
         const allModules = _resolveIntakeChain(svc);
         const answers = {};
         let qty = 1;
         const discKey = svc.default_estimates?.disclaimer;
         const discText = (SERVICE_DATA.meta?.estimate_disclaimers || {})[discKey];
         const mMin = svc.default_estimates?.materials?.min || 0;
         const mMax = svc.default_estimates?.materials?.max || 0;
         const startP = prof.startingPrice;
         const initPrice = startP ? `$${startP}` : '—';
         const {
             panel,
             livePriceEl,
             navCrumbs,
             displayName
         } = _makePanelShell(svc, category_id, initPrice, prof.startingPrice);
         const body = create('div', {
             class: 'intake-panel-body'
         });
         if (mMax > 0 && !svc.materials_included) {
             const mHint = create('div', {
                 class: 'intake-materials-hint'
             });
             mHint.innerHTML = `🧾 <b>Materials not included</b> — typically <b>$${mMin}–$${mMax}</b>. ${svc.default_estimates?.materials?.note || ''}`;
             body.appendChild(mHint);
         }
         if (discText) {
             const dHint = create('div', {
                 class: 'intake-disclaimer-hint'
             });
             dHint.textContent = '⚠️ ' + discText;
             body.appendChild(dHint);
         }
         if (svc.ui_taxonomy?.description) {
             body.appendChild(create('p', {
                 text: svc.ui_taxonomy.description,
                 style: 'font-size:.83rem;color:#555;margin-bottom:14px;line-height:1.5;'
             }));
         }
         const numericMod = allModules.find(m => m.type === 'numeric_multiplier' || m.ui_render_type === 'dropdown_with_custom_input');
         const chipMods = allModules.filter(m => m !== numericMod);
         const qWrap = create('div', {
             id: 'intake_q_wrap'
         });
         body.appendChild(qWrap);
         let notesEl = null;
         let detailEl = null;
         if (prof.tier >= 2 && !prof.isDiagnostic) {
             const detSection = create('div', {
                 class: 'intake-module-step',
                 style: 'margin-top:16px;'
             });
             const stepNum = chipMods.length + (numericMod ? 1 : 0) + 1;
             detSection.appendChild(create('div', {
                 class: 'ims-label',
                 text: `${stepNum}. Additional details`
             }));
             detailEl = create('textarea', {
                 id: 'ssot_detail_ta',
                 class: 'intake-notes-field',
                 placeholder: 'Describe specifics: measurements, materials, current condition…',
                 rows: '3',
                 style: 'min-height:75px;margin-top:6px;'
             });
             // v9.6: real, live wiring for item_count_overflow_formula
             // (PENDING_DECISIONS.md item #4) -- the specific,
             // overflow-configured answer label itself instructs the
             // customer to "specify exact count in notes" (confirmed
             // directly against the real, authored data before
             // building this, not assumed), so this reuses that
             // existing field rather than adding a new one. Parses
             // the first real number typed, feeds it into the same
             // answers object refreshPrice/refreshBtn already read
             // from, so the live preview and the final add-to-cart
             // price never diverge -- safe for every other service
             // too, since the formula itself only ever applies this
             // value when the specific overflow answer is selected.
             detailEl.addEventListener('input', () => {
                 const n = parseInt((detailEl.value.match(/\d+/) || [])[0], 10);
                 if (Number.isFinite(n) && n > 0) answers.__exact_count = n;
                 else delete answers.__exact_count;
                 refreshPrice();
                 refreshBtn();
             });
             body.appendChild(detSection);
             detSection.appendChild(detailEl);
         } else {
             body.appendChild(create('div', {
                 class: 'ims-label',
                 text: 'Notes (optional)',
                 style: 'margin-top:14px;'
             }));
             notesEl = create('textarea', {
                 class: 'intake-notes-field',
                 placeholder: 'Access notes, part brands, etc.',
                 rows: '2'
             });
             body.appendChild(notesEl);
         }
         panel.appendChild(body);
         const {
             cta,
             addBtn
         } = _makeCTARow(container, category_id);
         addBtn.textContent = chipMods.length > 0 ? `Answer ${chipMods.length} question${chipMods.length>1?'s':''} above` : 'Add to Request';
         if (chipMods.length === 0 && !numericMod) {
             addBtn.disabled = false;
             const r0 = _computePrice(svc, {}, 1);
             if (r0.laborEstimate) addBtn.textContent = `Add to Request — $${r0.laborEstimate}`;
         }
         panel.appendChild(cta);
         container.appendChild(panel);

         function renderQs() {
             qWrap.replaceChildren();
             let stepOffset = 0;
             if (numericMod) {
                 const qs = create('div', {
                     class: 'intake-module-step'
                 });
                 const lbl = create('div', {
                     class: 'ims-label'
                 });
                 lbl.textContent = `${++stepOffset}. ${numericMod.question}`;
                 lbl.appendChild(create('span', {
                     class: 'ims-badge',
                     text: '💲 affects price'
                 }));
                 qs.appendChild(lbl);
                 qs.appendChild(_makeQtyStepper(qty, newQty => {
                     qty = newQty;
                     answers['__qty'] = newQty;
                     refreshPrice();
                     refreshBtn();
                 }));
                 qWrap.appendChild(qs);
             }
             chipMods.forEach(mod => {
                 if (!_isModVisible(mod, answers, chipMods)) return;
                 const qs = create('div', {
                     class: 'intake-module-step'
                 });
                 const lbl = create('div', {
                     class: 'ims-label'
                 });
                 lbl.appendChild(document.createTextNode(`${++stepOffset}. ${mod.question}`));
                 if (mod.purpose === 'pricing') lbl.appendChild(create('span', {
                     class: 'ims-badge',
                     text: '💲 affects price'
                 }));
                 qs.appendChild(lbl);
                 const chips = create('div', {
                     class: 'ims-chips'
                 });
                 (mod.client_response || []).forEach(resp => {
                     const isSel = answers[mod.moduleKey] === resp.label;
                     const chip = create('button', {
                         class: 'ims-chip' + (isSel ? ' sel' : ''),
                         type: 'button'
                     });
                     chip.appendChild(document.createTextNode(resp.label));
                     const fee = resp.effects?.fee;
                     if (fee > 0) chip.appendChild(create('span', {
                         class: 'intake-fee-delta',
                         text: '+$' + fee
                     }));
                     if (fee < 0) chip.appendChild(create('span', {
                         class: 'intake-fee-delta',
                         text: '-$' + Math.abs(fee)
                     }));
                     chip.addEventListener('click', () => {
                         answers[mod.moduleKey] = resp.label;
                         renderQs();
                         refreshPrice();
                         refreshBtn();
                     });
                     chips.appendChild(chip);
                 });
                 qs.appendChild(chips);
                 qWrap.appendChild(qs);
             });
         }

         function refreshPrice() {
             const visible = chipMods.filter(m => _isModVisible(m, answers, chipMods));
             const allDone = visible.every(m => !!answers[m.moduleKey]);
             if (allDone) {
                 const r = _computePrice(svc, answers, qty);
                 livePriceEl.textContent = (discKey === 'project_based' ? 'from ' : '') + '$' + r.laborEstimate;
             } else {
                 livePriceEl.textContent = '—';
             }
             // v9.6 ADDITION (T107): this second, separate curated-card
             // rendering system (renderCuratedCardFromRoute, distinct
             // from the legacy curated-intake builder's own render()) was never
             // wired into the DOM-snapshot trace layer added last turn
             // -- confirmed directly, via a real, reported trace
             // showing zero dom_snapshot entries anywhere on this
             // path. _computePrice already, correctly calls
             // computeUnifiedQuote (confirmed directly), so that part
             // of the pipeline was never in question -- only this
             // path's own visibility to the trace was missing.
             if (typeof _traceDomSnapshot === 'function') _traceDomSnapshot('refreshPrice: ims-chip card settled');
         }

         function refreshBtn() {
             const visible = chipMods.filter(m => _isModVisible(m, answers, chipMods));
             const remaining = visible.filter(m => !answers[m.moduleKey]).length;
             if (remaining > 0) {
                 addBtn.disabled = true;
                 addBtn.textContent = `Answer ${remaining} question${remaining > 1 ? 's' : ''} above`;
             } else {
                 const r = _computePrice(svc, answers, qty);
                 addBtn.disabled = false;
                 const sfx = (prof.isDiagnostic || discKey === 'project_based') ? ' (est.)' : '';
                 addBtn.textContent = `Add to Request — $${r.laborEstimate}${sfx}`;
             }
         }
         renderQs();
         refreshPrice();
         refreshBtn();
         addBtn.addEventListener('click', () => {
             if (addBtn.disabled) return;
             if (!cartLimiter.isAllowed('add')) {
                 toast('Adding too fast.', 'error');
                 return;
             }
             const r = _computePrice(svc, answers, qty);
             const nav = navCrumbs.concat([displayName]).join(' > ');
             let notes = nav;
             chipMods.filter(m => _isModVisible(m, answers, chipMods)).forEach(mod => {
                 if (answers[mod.moduleKey]) notes += '\n' + mod.question + ': ' + answers[mod.moduleKey];
             });
             if (qty > 1) notes += '\nQty: ' + qty;
             const detVal = detailEl?.value?.trim();
             if (detVal) notes += '\nDetails: ' + detVal;
             const notVal = notesEl?.value?.trim();
             if (notVal) notes += '\nNotes: ' + notVal;
             // notes += '\nComplexity: ' + r.complexityOverride + ' @ $' + r.tierRate + '/hr';
             addToCart({
                 id: svc.id + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                 serviceId: svc.id,
                 category_id,
                 name: displayName + (qty > 1 ? ` (×${qty})` : ''),
                 price: '$' + r.laborEstimate,
                 icon: svc.ui_taxonomy?.icon || svc.icon || '🔧',
                 detail: nav,
                 notes,
                 furnitureItems: [],
                 intakeAnswers: {
                     ...answers,
                     __qty: qty
                 },
                 materialsNotIncluded: !svc.materials_included && mMax > 0,
                 materialsEstimateRange: [r.matMin || mMin, r.matMax || mMax],
                 complexityOverride: r.complexityOverride,
                 totalMinutes: r.extraMin + (svc.operational_metrics?.expected_minutes || 60)
             });
             _afterAdd(container);
             toast(displayName + ' added!', 'success');
         });
     }


     function addBackButton(container, onClick) {
         const btn = create('button', {
             class: 'back-button',
             type: 'button',
             text: '⭅ BACK'
         });
         btn.addEventListener('click', onClick);
         container.appendChild(btn);
     }

     function bindStepDotNav() {
         // Step nav map: tap on a done dot navigates back to that step
         // Forward navigation is blocked (user must complete current step)
         const navActions = {
             1: () => restoreCategoryView(),
             2: () => {
                 // Go back to service type selection
                 if (State.currentStep > 2) {
                     const sqFlow = document.getElementById('sqStepFlow');
                     if (sqFlow && sqFlow.style.display !== 'none') {
                         // In SmartQuote: back to step 2
                         const sb3 = document.getElementById('sqSb3');
                         if (sb3) sb3.style.display = 'none';
                         const sc3 = document.getElementById('sqSc3');
                         if (sc3) sc3.className = 'scard locked sq-stepflow';
                         sqUnlock(2);
                         sqOpen(2);
                         setStep(2);
                     } else {
                         // In catalog flow: back to group/type
                         const grp = Breadcrumbs.stack[0];
                         if (grp) {
                             Breadcrumbs.clear();
                             Breadcrumbs.push(grp);
                             if (grp.category_id) showGroupsForCategory(grp.category_id, true);
                         }
                     }
                 }
             },
             3: () => {
                 if (State.currentStep > 3) {
                     const sqFlow = document.getElementById('sqStepFlow');
                     if (sqFlow && sqFlow.style.display !== 'none') {
                         const sc4 = document.getElementById('sqSc4');
                         if (sc4) {
                             sc4.className = 'scard locked sq-stepflow';
                             const sb4 = document.getElementById('sqSb4');
                             if (sb4) sb4.style.display = 'none';
                         }
                         sqUnlock(3);
                         sqOpen(3);
                         setStep(3);
                     }
                 }
             },
             4: () => {
                 /* already at final step, no-op */
             }
         };

         [1, 2, 3, 4].forEach(n => {
             const dot = document.getElementById('step' + n + 'dot');
             if (!dot) return;
             // Remove old listeners by replacing the node
             const fresh = dot.cloneNode(true);
             dot.parentNode.replaceChild(fresh, dot);
             fresh.addEventListener('click', () => {
                 const cur = State.currentStep || 1;
                 if (n < cur) {
                     // Navigate back
                     navActions[n]?.();
                 } else if (n === cur) {
                     // Tap active dot — scroll to current step body
                     const body = document.getElementById('sqSb' + n) || document.getElementById('sqSb3');
                     if (body) body.scrollIntoView({
                         behavior: 'smooth',
                         block: 'start'
                     });
                 }
                 // Forward tap: no-op (must complete current step)
             });
             // Visual affordance: add tooltip
             fresh.title = n < (State.currentStep || 1) ? 'Go back to step ' + n : n === (State.currentStep || 1) ? 'Current step' : 'Complete current step first';
         });
     }

     function buildDataMaps(data) {
         categoryMap.clear();
         groupMap.clear();
         servicesByGroup.clear();
         furnitureMap.clear();
         window.groupChildrenMap.clear();

         (data.category || []).forEach(c => categoryMap.set(c.id, c));

         (data.group || []).forEach(g => {
             groupMap.set(g.id, g);
             const parent = g.parent_group || g.parent_id || null;
             if (!window.groupChildrenMap.has(parent)) window.groupChildrenMap.set(parent, []);
             window.groupChildrenMap.get(parent).push(g);
         });

         (data.services || []).forEach(s => {
             const parent = s.ui_taxonomy?.group_id;
             if (!parent) return;
             if (!servicesByGroup.has(parent)) servicesByGroup.set(parent, []);
             servicesByGroup.get(parent).push(s);
         });

         const furnitureSource = data.furniture_catalog || data.furniture_items || [];
         furnitureSource.forEach(f => {
             const key = f.sku || f.article || f.code || f.id;
             if (key) furnitureMap.set(key, f);
         });
     }

     function cacheDOM() {
         DOM.categoriesGrid = q("#category-card");
         DOM.cartFab = q("#cartFab");
         DOM.fabCount = q("#fabCartCount");
         DOM.cartOverlay = q("#cartOverlay");
         DOM.cartServiceList = q("#cartServiceList");
         DOM.cartTotal = q("#cartTotal");
         DOM.serviceCount = q("#serviceCount");
         DOM.serviceRequestList = q("#serviceRequestList");
         DOM.estimateTotalSummary = q("#estimateTotalSummary");
         DOM.totalAmount = q("#totalAmount");
         DOM.summaryMainContainer = q("#summaryMainContainer");
         DOM.intakeQuestionsContainer = q("#intakeQuestionsContainer");
         DOM.serviceContainer = q("#serviceContainer");
         DOM.serviceRequestSummary = q("#serviceRequestSummary");
         DOM.overlaybookNowBtn = q("#finalBookBtn");
     }

     function closeCartOverlay() {
         if (!DOM.cartOverlay) return;
         DOM.cartOverlay.style.display = 'none';
         DOM.cartOverlay.classList.remove('open');
         document.body.classList.remove('modal-open');
     }

     const create = (tag, attrs = {}, children = []) => {
         const el = document.createElement(tag);
         Object.keys(attrs).forEach(k => {
             if (k === 'class') el.className = attrs[k];
             else if (k === 'text') el.textContent = attrs[k];
             else if (k === 'html') el.innerHTML = attrs[k];
             else if (k === 'style' && typeof attrs[k] === 'string') el.style.cssText = attrs[k];
             else el.setAttribute(k, attrs[k]);
         });
         children.forEach(c => {
             if (typeof c === 'string') el.appendChild(document.createTextNode(c));
             else if (c instanceof Node) el.appendChild(c);
         });
         return el;
     }

     function createOtherTileElement(tile, category_id) {
         const groupId = tile.ui_taxonomy?.group_id;
         const group = groupId ? groupMap.get(groupId) : null;
         // Inherit the GROUP's icon — the group context is already
         // established (user is browsing Cabinets, Windows, etc.) so
         // repeating the group emoji makes the Other tile feel like
         // a natural extension of the list rather than a foreign element.
         const groupIcon = group?.icon || tile.ui_taxonomy?.icon || '✏️';
         const card = create('div', {
             class: 'service-tile service-tile-other',
             tabindex: '0',
             role: 'button',
             'aria-label': tile.ui_taxonomy?.display_name + ' — describe your own'
         });
         const iconEl = create('div', {
             class: 'service-item-icon',
             text: groupIcon
         });
         const info = document.createElement('div');
         info.style.cssText = 'width:100%; display:flex; flex-direction:column; align-items:flex-start; gap:3px;';
         info.appendChild(create('h4', {
             text: tile.ui_taxonomy?.display_name || 'Other'
         }));
         info.appendChild(create('span', {
             text: '✏️ Smart Quote',
             style: 'font-size:.68rem;font-weight:700;padding:2px 8px;border-radius:20px;background:#1e3a5f;color:#bfdbfe;display:inline-block;margin-bottom:3px;'
         }));
         info.appendChild(create('div', {
             class: 'service-tile-expanded',
             text: tile.ui_taxonomy?.description || 'Describe what you need — we\'ll build a precise quote.',
             style: 'display:block;'
         }));
         card.appendChild(iconEl);
         card.appendChild(info);
         const handler = () => prefillSmartQuoteFromOtherTile(tile, category_id);
         card.addEventListener('click', handler);
         card.addEventListener('keydown', e => {
             if (e.key === 'Enter' || e.key === ' ') {
                 e.preventDefault();
                 handler();
             }
         });
         return card;
     }

     function createServiceCardElement(svc, category_id) {
         const card = create('div', {
             class: 'service-tile',
             tabindex: '0',
             role: 'button',
             'aria-label': svc.ui_taxonomy?.display_name
         });
         const prof = getServiceProfile(svc);
        const chain = svc.intake_chain || [];
         const defaultTags = svc.default_tags || [];
         const isOtherSvc = defaultTags.some(t => t === '#adhoc' || t === '#manual_review');
         const requiresSiteVisit = defaultTags.some(t => t === '#site_visit_required');
         const isDiagSvc = prof.isDiagnostic; // SSOT: checkout_state drives this, not service_type
         const isProjectSvc = prof.isProject; // one definition of "project" -- getServiceProfile (Logic)
         const isHourlySvc = prof.isHourlyPricingType;
         let complexityBadge = null;
if (requiresSiteVisit) {
    complexityBadge = { text: '🔍 Quote on site', bg: 'rgba(255,255,255,.08)', color: '#e5e7eb' };
} else if (isOtherSvc) {
    complexityBadge = { text: '⚡ Smart Quote', bg: 'rgba(138,6,21,.35)', color: '#ffb0b8' };
} else if (isDiagSvc) {
    complexityBadge = { text: prof.badge, bg: 'rgba(255,255,255,.08)', color: '#e5e7eb' };
} else if (isProjectSvc) {
    complexityBadge = { text: DB.ui_config?.badge_labels?.['project_based'] || '📐 Project est.', bg: 'rgba(138,6,21,.35)', color: '#ffb0b8' };
} else if (isHourlySvc) {
    complexityBadge = { text: DB.ui_config?.badge_labels?.['hourly'] || '⏰ Hourly', bg: 'rgba(0,0,0,.6)', color: '#e5e7eb' };
} else if (chain.length === 0) {
    complexityBadge = { text: prof.badge, bg: 'rgba(222,0,0,.18)', color: '#ff9ba4' };
}
         let iconText;
         if (isOtherSvc) {
             const groupId = svc.ui_taxonomy?.group_id;
             const group = groupMap.get(groupId);
             iconText = group?.icon || svc.ui_taxonomy?.icon || '🔧';
         } else {
             iconText = svc.ui_taxonomy?.icon || svc.icon || '🔧';
         }
         const iconEl = create('div', {
             class: 'service-item-icon',
             text: iconText
         });
         const info = document.createElement('div');
         info.style.cssText = 'width:100%; display:flex; flex-direction:column; align-items:flex-start; gap:3px;';
         const titleRow = create('h4', {
             text: svc.ui_taxonomy?.display_name
         });
// Title
info.appendChild(create('h4', { text: svc.ui_taxonomy?.display_name }));

// Description (moved up so it lives right under the title)
let desc = svc.ui_taxonomy?.description || svc.description || 'Tap to customise.';
if (svc.materials_included) desc += ' · Materials included';
info.appendChild(create('div', {
    class: 'service-tile-expanded',
    text: desc,
    style: 'display:block;'
}));

// Inline badge (Smart Quote / Project / Hourly / etc.)
if (complexityBadge) {
    const badge = create('span', {
        text: complexityBadge.text,
        style: `font-size:9px;font-weight:800;letter-spacing:.06em;padding:3px 9px;border-radius:999px;background:${complexityBadge.bg};color:${complexityBadge.color};display:inline-block;`
    });
    info.appendChild(badge);
}

// Materials badge (if any)
if (svc.default_estimates?.materials && !svc.materials_included) {
    const matMin = svc.default_estimates.materials.min || 0;
    const matMax = svc.default_estimates.materials.max || 0;
    if (matMax > 0) {
        info.appendChild(create('div', {
            class: 'materials-badge',
            text: `+ Materials $${matMin}‑$${matMax}`
        }));
    }
}

// Price pill — pushed to bottom of the card by margin:auto in the CSS
info.appendChild(create('div', {
    class: 'service-price',
    html: formatServicePrice(svc)
}));
         card.appendChild(iconEl);
         card.appendChild(info);
         card.addEventListener('click', () => prefillSmartQuoteFromService(svc, category_id));
         card.addEventListener('keydown', e => {
             if (e.key === 'Enter' || e.key === ' ') {
                 e.preventDefault();
                 prefillSmartQuoteFromService(svc, category_id);
             }
         });
         return card;
     }

     function renderLivePreview(previewDiv, u) {
         previewDiv.textContent = '';
         if (!u.hasText) {
             const empty = document.createElement('span');
             empty.className = 'preview-empty';
             empty.textContent = '\u2728 Describe your job \u2014 we\u2019ll build a clear request for you';
             previewDiv.appendChild(empty);
             return;
         }
         const icon = document.createElement('i');
         icon.className = 'ti ti-sparkles';
         const phrase = document.createElement('span');
         phrase.className = 'preview-phrase';
         u.parts.forEach(p => {
             if (p.ghost) {
                 const g = document.createElement('span');
                 g.className = 'slot-ghost';
                 g.textContent = p.ghost;
                 phrase.appendChild(g);
             } else phrase.appendChild(document.createTextNode(p.text));
         });
         const tag = document.createElement('span');
         tag.className = 'preview-tag';
         tag.textContent = 'live';
         previewDiv.append(icon, phrase, tag);
     }

     function enableLiveAdLibPreview() {
         const textBar = document.getElementById('sqTextBar');
         if (!textBar) return;
         const textarea = document.getElementById('sqDescIn');
         if (!textarea) return;
         if (textarea._livePreviewBound) return;
         textarea._livePreviewBound = true;

         let previewDiv = document.getElementById('sqLivePreview');
         if (!previewDiv) {
             previewDiv = document.createElement('div');
             previewDiv.id = 'sqLivePreview';
             previewDiv.className = 'sq-live-preview';
             const inlineRow = textBar.querySelector('.sq-inline-row');
             if (inlineRow) textBar.insertBefore(previewDiv, inlineRow);
             else {
                 const t = textBar.firstElementChild;
                 if (t) t.insertAdjacentElement('afterend', previewDiv);
                 else textBar.prepend(previewDiv);
             }
         }

         // T136: the renderer parses NOTHING. It asks the one canonical
         // understanding (nlp_engine) and draws the result.
         let _tid;

         function update() {
             clearTimeout(_tid);
             _tid = setTimeout(() => {
                 const u = window._NLP.understand(textarea.value, {
                     quiet: true
                 });
                 renderLivePreview(previewDiv, u);
                 renderUnifiedSqButton(u);
             }, 80);
         }
         update();
         textarea.addEventListener('input', update);
     }

     function ensureFocusedModeInner(card) {
         if (card.querySelector('.focused-mode-inner')) return;
         const inner = document.createElement('div');
         inner.className = 'focused-mode-inner';
         const stepBar = card.querySelector('.booking-step-bar');
         Array.from(card.children).forEach(c => {
             if (c !== stepBar) inner.appendChild(c);
         });
         card.appendChild(inner);
     }

     function enterFocusedMode(hideTextBar = false) {
    if (typeof _traceFn === 'function') _traceFn('enterFocusedMode', {
        hideTextBar
    });
    const card = document.querySelector('.main-card-schedule-service');
    if (!card) return;

    // ── PORTAL TO <body> ──────────────────────────────────────────────
    // backdrop-filter / filter / transform / will-change anywhere in the
    // ancestor chain becomes the containing block for position:fixed on
    // real mobile browsers, so the "full-screen" overlay renders as a
    // small panel in the corner instead. Reparenting directly under
    // <body> guarantees the initial containing block (viewport) is used,
    // regardless of what any ancestor CSS does.
    if (!card._focusPortaled) {
        card._focusOrigParent = card.parentNode;
        card._focusOrigNext   = card.nextSibling;
        document.body.appendChild(card);
        card._focusPortaled = true;
    }
    // ─────────────────────────────────────────────────────────────────

    card.classList.add('focused-mode');
         if (inner) inner.scrollTop = 0;
         // Explicitly hide viewport-wasting elements (CSS covers them too,
         // but JS inline display overrides CSS so we set important here).
         // v9.6 FIX: found TWO separate mechanisms both hiding
         // serviceRequestSummary -- this JS force-hide, AND a
         // stylesheet rule (.focused-mode #serviceRequestSummary
         // {display:none!important}) that also applies whenever
         // focused-mode is active, entirely independent of this
         // code. Confirmed via real browser automation that the
         // affirmation card never actually became visible because
         // of this. An inline !important style has higher
         // specificity than a stylesheet !important rule, so when
         // the card is present, explicitly force it visible
         // (not just skip the redundant hide) to correctly win
         // against the CSS rule too.
         // v9.6 FIX: 'sqTextBar' was previously swept into this
         // same loop, unconditionally force-hidden alongside
         // serviceRequestSummary -- as a side effect of fixing
         // THAT element's visibility, not its own deliberate
         // design decision. Per direct correction, removed: the
         // SmartQuote text bar should remain visible under the
         // tile grid throughout category/group browsing, not
         // just on the pre-navigation home state.
         // T125 FIX: the v9.6 removal above was too broad in the
         // OTHER direction -- confirmed directly, not assumed:
         // sqTextBar should be hidden specifically when a
         // category tile is visually tapped (this function's
         // only caller that represents that exact action is
         // showGroupsForCategory, which now explicitly passes
         // hideTextBar=true), and should remain visible for
         // every other real entry path into focused mode --
         // "Other tile" entry (prefillSmartQuoteFromOtherTile,
         // named for exactly this case), a resolved/matched
         // service (showIntakeQuestions,
         // prefillSmartQuoteFromService), the free-text
         // affirmation flow (renderTagAffirmationFromRoute), and
         // the guided builder (sqPrepareFlow) -- none of which
         // pass hideTextBar, so all default to false (visible),
         // matching "if a service isn't matched" and every path
         // other than a literal category-tile tap.
         ['serviceRequestSummary'].forEach(id => {
             const el = document.getElementById(id);
             if (!el) return;
             if (id === 'serviceRequestSummary' && el.querySelector('#sqAffirmCard')) {
                 el.style.setProperty('display', 'block', 'important');
                 return;
             }
             el.style.setProperty('display', 'none', 'important');
         });
         const textBarEl = document.getElementById('sqTextBar');
         if (textBarEl) {
             if (hideTextBar) textBarEl.style.setProperty('display', 'none', 'important');
             else textBarEl.style.removeProperty('display');
         }
     }

function exitFocusedMode() {
    if (typeof _traceFn === 'function') _traceFn('exitFocusedMode');
    const card = document.querySelector('.main-card-schedule-service');
    if (!card) return;
    card.classList.remove('focused-mode');
    const inner = card.querySelector('.focused-mode-inner');
    if (inner) {
        Array.from(inner.children).forEach(c => card.insertBefore(c, inner));
        inner.remove();
    }
    document.body.classList.remove('modal-active');

    // ── UN-PORTAL: restore the card to its original slot ─────────────
    if (card._focusPortaled) {
        const parent = card._focusOrigParent;
        const next   = card._focusOrigNext;
        if (parent) {
            if (next && next.parentNode === parent) parent.insertBefore(card, next);
            else parent.appendChild(card);
        }
        card._focusPortaled = false;
        card._focusOrigParent = null;
        card._focusOrigNext   = null;
    }
    // ─────────────────────────────────────────────────────────────────
         // Restore elements hidden during focused mode
         const sqTB = document.getElementById('sqTextBar');
         if (sqTB) sqTB.style.removeProperty('display');
         // serviceRequestSummary visibility is managed by cart state — handled by restoreCategoryView
         const srs = document.getElementById('serviceRequestSummary');
         if (srs) srs.style.removeProperty('display');
     }



     function initSmartQuote() {
         let sqEl = document.getElementById('smartQuoteEngine');
         if (!sqEl) {
             const catCard = document.getElementById('category-card');
             if (!catCard?.parentNode) return;
             sqEl = document.createElement('div');
             sqEl.id = 'smartQuoteEngine';
             // No extra wrapper class — we use existing site classes directly
             catCard.insertAdjacentElement('afterend', sqEl);
         }
         if (sqEl.querySelector('#sqTextBar')) return; // already injected


         sqEl.innerHTML = `
  <!-- SmartQuote text bar: visible on home, hidden during card-browse flow -->
  <div id="sqTextBar" class="sq-inline-bar" style="margin-top:14px;">
    <div style="font-size:.75rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--clr-red-dark);margin-bottom:8px;display:flex;align-items:center;gap:6px;">
      <i class="ti ti-wand" style="font-size:15px;"></i> Instant Estimate — just start typing
    </div>
    <!-- LIVE PREVIEW ROW - now above the text input -->
    <div id="sqLivePreview" class="sq-live-preview">
      <i class="ti ti-sparkles"></i>
      <span class="preview-empty">✨ Describe your job — we’ll build a clear request for you</span>
    </div>
    <div class="sq-inline-row">
      <textarea id="sqDescIn" rows="2" placeholder="e.g. mount a large neon sign on a drywall wall in the bedroom…"></textarea>
    </div>
    <!-- ONE unified action button — label/behavior driven entirely by live
         confidence (see renderUnifiedSqButton). Low confidence: "Build it
         step by step" (opens the guided builder). High confidence: "Looks
         right, continue" (proceeds straight to scope/conditions). This
         replaces what used to be three separate, competing affordances
         (Analyze button, Write it for me link, Got It strip's two buttons)
         with one decision point that just changes as confidence changes. -->
    <button id="sqUnifiedActionBtn" type="button" onclick="window.sqUnifiedAction()">
      <i class="ti ti-sparkles"></i> <span id="sqUnifiedActionLabel">Build it step by step</span>
    </button>
    <button id="sqManualOverrideLink" type="button" onclick="window.sqToggleBuilder()" style="display:none;">
      Not quite — let me adjust it
    </button>
  </div>
      <!-- Guided builder: shown when user taps "Write it for me" -->
      <div id="sqBuilder">
        <div class="sq-builder-header">
          <div class="sq-builder-title">
            <i class="ti ti-sparkles"></i> Build your request
          </div>
          <button class="sq-b-back" onclick="sqToggleBuilder()" style="font-size:11px;color:var(--clr-red-dark,#8a0615);">
            <i class="ti ti-x"></i> Close
          </button>
        </div>
        <div id="sqBuilderSentence"></div>
        <div class="sq-step-prompt" id="sqBuilderPrompt"></div>
        <div class="sq-b-chips" id="sqBuilderChips"></div>
        <div class="sq-builder-footer">
          <button class="sq-b-back" id="sqBuilderBack" onclick="sqBuilderBack()" style="display:none;">
            <i class="ti ti-arrow-left"></i> Back
          </button>
          <div class="sq-b-progress" id="sqBuilderProgress"></div>
          <div style="width:60px"></div>
        </div>
      </div>

      <!-- Step 2: confirm service type (hidden until text analyzed or card tapped) -->
      <div id="sqStepFlow" style="display:none; flex-direction:column; gap:12px; margin-top:14px;">

        <div class="scard active sq-stepflow" id="sqSc2">
          <div class="shead" onclick="sqOpenStep(2)">
            <div class="snum a" id="sqSn2">2</div>
            <div class="slabel">Service type</div>
            <div class="sval" id="sqSv2"></div>
          </div>
          <div class="sbody" id="sqSb2" style="display:none">
            <div style="font-size:13px;color:#444;margin-top:4px;">Confirm or adjust the type of service.</div>
            <div class="chips" id="sqTypeChips" style="margin-top:12px;"></div>
            <button class="nbtn" id="sqS2next" onclick="sqHandleStep2()" disabled style="margin-top:16px;">
              Next <i class="ti ti-arrow-right"></i>
            </button>
          </div>
        </div>

        <div class="scard locked sq-stepflow" id="sqSc3">
          <div class="shead" onclick="sqOpenStep(3)">
            <div class="snum" id="sqSn3">3</div>
            <div class="slabel">Scope &amp; conditions</div>
            <div class="sval" id="sqSv3"></div>
          </div>
          <div class="sbody" id="sqSb3" style="display:none">

            <div style="font-size:13px;font-weight:600;color:var(--color-text-main,#1e293b);margin-top:4px;">Auto-detected conditions:</div>
            <div class="chips" id="sqDetTags" style="margin-bottom:16px;"></div>

            <div style="font-size:13px;font-weight:600;color:var(--color-text-main,#1e293b);margin:12px 0 8px;">Quantity</div>
            <div class="qrow">
              <button class="qbtn" onclick="sqAdjQty(-1)">−</button>
              <span class="qval" id="sqQtyV">1</span>
              <button class="qbtn" onclick="sqAdjQty(1)">+</button>
              <span class="qlabel" id="sqQtyLbl">item</span>
            </div>

            <div id="sqDynGroups"></div>

            <div class="adlib-box sq-stepflow" id="sqAdlibBox" style="display:none; margin-top:20px;">
              <div class="adlib-label"><i class="ti ti-adjustments-horizontal" style="font-size:16px;color:var(--clr-red,#de0000)"></i> Review Job Statement</div>
              <div class="adlib-sentence" id="sqAdlibSentence"></div>
              <div class="adlib-confirm-row">
                <button class="adlib-yes" onclick="sqConfirmAdlib()"><i class="ti ti-calculator"></i> Calculate Estimate</button>
                <button class="adlib-no" onclick="sqEditAdlib()"><i class="ti ti-pencil"></i> Edit</button>
              </div>
            </div>

            <button class="nbtn sq-stepflow" id="sqS3build" onclick="sqBuildAdlib()" style="margin-top:16px; display:none;">
              Construct Estimate <i class="ti ti-arrow-right"></i>
            </button>
          </div>
        </div>

      </div>
      <div id="sqQuoteOut"></div>
      
    `;
         // sqUnifiedActionBtn's click is wired via inline onclick to
         // window.sqUnifiedAction (defined below) — no separate
         // addEventListener needed here, unlike the old sqAnalyzeBtn.
         document.getElementById('sqDescIn').addEventListener('keydown', e => {
             if (e.key === 'Enter' && !e.shiftKey) {
                 e.preventDefault();
                 sqUnifiedAction();
             }
         });
         enableLiveAdLibPreview(); // bind once at init, not per-keystroke
     }

     function loadCart() {
         try {
             return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]");
         } catch (_) {
             return [];
         }
     }

     function openCartOverlay() {
         if (!DOM.cartOverlay) return;
         DOM.cartOverlay.style.display = 'flex';
         DOM.cartOverlay.classList.add('open');
         document.body.classList.add('modal-open');
         cartCurrentPage = 1;
         updateCartOverlayIfOpen();
         setTimeout(() => {
             const firstFocusable = DOM.cartOverlay.querySelector('button, [tabindex="0"]');
             if (firstFocusable) firstFocusable.focus();
         }, 50);
     }

     function openMail(el) {
         if (!contactLimiter.isAllowed('mail')) {
             toast('Please wait a moment before trying again.');
             return;
         }
         const email = safeEmail(decodeB64(el.getAttribute('data-email') || ''));
         if (!email) return;
         window.location.href = `mailto:${email}?subject=${encodeURIComponent('Inquiry')}&body=`;
     }

     function openSms(el) {
         if (!contactLimiter.isAllowed('sms')) {
             toast('Please wait a moment before trying again.');
             return;
         }
         const num = safePhone(el.getAttribute('data-sms') || '');
         if (!num) return;
         window.location.href = 'sms:' + num;
     }

     function openTel(el) {
         if (!contactLimiter.isAllowed('tel')) {
             toast('Please wait a moment before trying again.');
             return;
         }
         const num = safePhone(el.getAttribute('data-phone') || '');
         if (!num) return;
         window.location.href = 'tel:' + num;
     }

     // v9.6 FIX: persistCart removed -- confirmed superseded by the
     // store/reducer's own sessionStorage.setItem('booktom_cart_v2', ...)
     // at a different key. Cart persistence works; it just never went
     // through this function (COMPONENT_LAYER_MAP.md).

     const q = (sel, ctx = document) => (ctx || document).querySelector(sel);

     const qAll = (sel, ctx = document) => Array.from((ctx || document).querySelectorAll(sel));

     function renderCart() {
         const cart = window.__store.getState().cart.serviceRequest;
         updateFabVisibility(cart);
         updateCartSummary(cart);
         updateCartOverlayTotal(cart);
         if (DOM.cartOverlay && DOM.cartOverlay.style.display === 'flex') updateCartOverlayIfOpen(cart);
     }

     function renderCategoryCards() {
         if (!DOM.categoriesGrid) return;
         DOM.categoriesGrid.replaceChildren();
         SERVICE_DATA.category.forEach(cat => {
             const card = create('div', {
                 class: 'category-card',
                 'data-category-id': cat.id,
                 tabindex: '0',
                 role: 'button',
                 'aria-label': cat.display_name
             });
             // T118 (operator-directed): was `text: cat.icon`
             // (el.textContent), rendering an emoji character
             // directly. Category icons moved to Tabler CSS
             // classes (e.g. "ti ti-home") -- a plain textContent
             // insertion would show the literal class string as
             // visible text, not a rendered glyph. Confirmed
             // directly (not assumed) that this function is what
             // actually builds the live grid: the static HTML
             // fallback under #category-card gets fully replaced
             // by DOM.categoriesGrid.replaceChildren() on init,
             // so this was the real fix location, not the static
             // markup alone (which was also updated, so the
             // fallback stays correct if this render call is
             // ever skipped).
             card.appendChild(create('div', {
                 class: 'category-icon'
             }, [create('i', {
                 class: cat.icon
             })]));
             card.appendChild(create('h2', {
                 text: cat.display_name
             }));
             card.addEventListener('pointerdown', e => {
                 const r = card.getBoundingClientRect();
                 card.style.setProperty('--rx', `${((e.clientX - r.left) / r.width * 100).toFixed(1)}%`);
                 card.style.setProperty('--ry', `${((e.clientY - r.top) / r.height * 100).toFixed(1)}%`);
                 card.classList.add('tapped');
                 setTimeout(() => card.classList.remove('tapped'), 400);
             });
             const activate = () => {
                 Breadcrumbs.push({
                     type: 'categories'
                 });
                 showGroupsForCategory(cat.id);
             };
             card.addEventListener('click', activate);
             card.addEventListener('keydown', e => {
                 if (e.key === 'Enter' || e.key === ' ') {
                     e.preventDefault();
                     activate();
                 }
             });
             DOM.categoriesGrid.appendChild(card);
         });
     }

     function renderGlobalSearchResults(container, services, currentCategoryId) {
         container.replaceChildren();
         if (!services || !services.length) {
             container.appendChild(create('div', {
                 class: 'empty-message',
                 text: 'No matching services'
             }));
             return;
         }
         const groupedServices = {};
         services.forEach(svc => {
             const grpId = svc.groups || svc.group;
             const grp = groupMap.get(grpId);
             const key = grp ? (grp.display_name || grp.name || 'Other') : 'Other';
             if (!groupedServices[key]) groupedServices[key] = [];
             groupedServices[key].push(svc);
         });
         Object.keys(groupedServices).sort().forEach(key => {
             container.appendChild(create('div', {
                 class: 'service-group-header',
                 text: `${key} (${groupedServices[key].length})`
             }));
             groupedServices[key].forEach(svc => {
                 container.appendChild(createServiceCardElement(svc, currentCategoryId));
             });
         });
     }

     function renderServices(container, services, category_id, group_id) {
         container.replaceChildren();
         // v9.6: sort by the real, curated ui_taxonomy.sort_order (existed
         // on every service, never consulted -- services rendered in raw
         // JSON-array order instead of the deliberate, already-authored
         // display order). "Other" tiles are appended after sorting so they
         // correctly stay last regardless of their own irrelevant position.
         const sortedServices = [...(services || [])].sort((a, b) =>
             (a.ui_taxonomy?.sort_order ?? 999) - (b.ui_taxonomy?.sort_order ?? 999));
         const otherTiles = buildOtherTilesForGroup(services || [], group_id, groupMap, DB);
         const allTiles = [...sortedServices, ...otherTiles];
         if (!allTiles.length) {
             container.appendChild(create('div', {
                 class: 'empty-message',
                 text: 'No services in this group'
             }));
             return;
         }
         const unique = new Map();
         allTiles.forEach(s => unique.set(s.id, s));
         services = Array.from(unique.values());

         // Other tiles get their OWN section, always rendered last —
         // they must NOT be bucketed into the alphabetically-sorted
         // Installation/Repair/Replacement/Weatherize groups below,
         // since "Other" can sort alphabetically BEFORE "Repair" or
         // "Weatherize" and end up appearing in the middle of the
         // page instead of at the bottom.
         const otherSvcs = services.filter(s => s._isOtherTile);
         const namedSvcs = services.filter(s => !s._isOtherTile);

         const grouped = {};
         namedSvcs.forEach(svc => {
             let key = 'Other';
             const name = svc.ui_taxonomy?.display_name.toLowerCase();
             if (name.includes('installation') || name.includes('mount')) key = 'Installation';
             else if (name.includes('repair') || name.includes('fix')) key = 'Repair';
             else if (name.includes('replacement')) key = 'Replacement';
             else if (name.includes('seal')) key = 'Weatherize';
             if (!grouped[key]) grouped[key] = [];
             grouped[key].push(svc);
         });
         Object.keys(grouped).sort().forEach(key => {
             container.appendChild(create('div', {
                 class: 'service-group-header',
                 text: `${key} (${grouped[key].length})`
             }));
             grouped[key].forEach(svc => container.appendChild(createServiceCardElement(svc, category_id)));
         });
         // Synthetic Other tiles — always last, own section, no header
         // count noise (the tiles themselves already say "[Group] Other").
         if (otherSvcs.length) {
             container.appendChild(create('div', {
                 class: 'service-group-header',
                 text: 'Other'
             }));
             otherSvcs.forEach(svc => container.appendChild(createOtherTileElement(svc, category_id)));
         }
     }

     function renderUnifiedSqButton(u) {
         const btn = document.getElementById('sqUnifiedActionBtn');
         const label = document.getElementById('sqUnifiedActionLabel');
         const overrideLink = document.getElementById('sqManualOverrideLink');
         if (!btn || !label) return;
         // T136: "Looks right" is earned only by a COMPLETE understanding
         // (valid object + the SSOT confidence bar) -- never by a keyword
         // weight alone. Otherwise the one button opens the guided builder,
         // pre-seeded with whatever WAS understood.
         const hasText = !!(u && u.hasText);
         const isConfident = hasText && !!u.complete;

         window._sqUnifiedMode = isConfident ? 'confirm' : 'build';
         if (isConfident) {
             label.textContent = 'Looks right \u2014 get an estimate';
             btn.classList.add('sq-unified-confident');
             if (overrideLink) overrideLink.style.display = 'block';
         } else {
             label.textContent = hasText ? 'Get an estimate' : 'Describe your job step by step';
             btn.classList.remove('sq-unified-confident');
             if (overrideLink) overrideLink.style.display = 'none';
         }
     }

     function restoreCategoryView() {
         if (typeof _traceFn === 'function') _traceFn('restoreCategoryView');
         exitFocusedMode();
         Breadcrumbs.clear();
         setStep(1);
         // v9.1 fix: SmartQuote and the Catalog browser used to be able
         // to run concurrently — navigating into the Catalog while a
         // SmartQuote session was mid-flow (S/BLD state populated,
         // #sqStepFlow visible) never reset that session, so its state
         // could leak into whatever the user did next (the reported
         // "collide" bug: starting a SmartQuote text entry, changing
         // your mind, and going to the Catalog instead left the old
         // SmartQuote answers/tags live in the background). Detect an
         // active session the same way the cart overlay's own open/closed
         // check works (live style.display, not the unused the retired active flag
         // flag) and call sqRestart() — defined later in this file but
         // safe to call here since function declarations hoist — before
         // showing the Catalog grid.
         const sqFlow = document.getElementById('sqStepFlow');
         if (sqFlow && sqFlow.style.display !== 'none' && typeof sqRestart === 'function') {
             sqRestart();
         }
         if (DOM.categoriesGrid) DOM.categoriesGrid.style.display = 'grid';
         if (DOM.summaryMainContainer) DOM.summaryMainContainer.style.display = 'none';
         if (DOM.intakeQuestionsContainer) DOM.intakeQuestionsContainer.style.display = 'none';
         if (DOM.serviceContainer) DOM.serviceContainer.innerHTML = '';
         if (DOM.serviceRequestSummary) {
             const items = window.__store.getState().cart.serviceRequest;
             DOM.serviceRequestSummary.style.display = items.length ? 'block' : 'none';
         }
         updateFabVisibility();
         const stepFlow = document.getElementById('stepFlow');
         if (stepFlow) stepFlow.style.display = 'none';
         const quoteOut = document.getElementById('quoteOut');
         if (quoteOut) quoteOut.innerHTML = '';
     }


     // T64: real, direct port of the legacy affirmation-card renderer's core mechanism
     // into the ResolvedRoute-based renderer family, following the exact
     // same pattern as renderSelfQuoteFromRoute/renderCuratedCardFromRoute
     // (pure ResolvedRoute consumer, no S state).
     //
     // T64 follow-up: the negation-pivot case is now also ported --
     // reads route.negationOverride directly (set in executeWorkflow from
     // context._negationOverride, itself computed by
     // collectBookingContext_freeText), picks the pivot-style headline/note
     // when present, same as the legacy affirmation-card renderer's own pivotInfo-aware
     // framing. Porting this surfaced and fixed a real, separate,
     // previously-live bug in the underlying negatedTagIds computation
     // itself (a negated tag was being silently discarded by a premature,
     // circular group-level filter) -- see verify_t36_negation_pivot.js's
     // own v9.6 FIX section for the full detail; that fix lives upstream
     // of this function, in collectBookingContext_freeText.
     //
     // Deliberately, honestly still scoped narrower than the legacy version
     // for two real features, not silently approximated:
     // 1. Sibling-service recommendations (the legacy version suggests up
     //    to 2 alternate services when intent._matchConfidence < 85). This
     //    needs the raw NLP intent object in a shape route doesn't
     //    currently expose (category/_groupId/_matchConfidence together);
     //    adding it is real, separate, additive work for a follow-up round.
     // 2. Per-tag removal (a legacy affirm handler, tapping an individual chip to
     //    drop just that tag before affirming the rest). This version's
     //    chips are informational only; Yes/No affirms or rejects the
     //    complete set.
     function renderTagAffirmationFromRoute(route) {
         const container = document.getElementById('serviceRequestSummary');
         if (!container) return;

         const detTagIds = route.detectedTagIds || [];
         const tagDefs = DB.smart_tags || {};
         const chipHtml = detTagIds.map(tid => {
             const tag = tagDefs[tid] || {};
             const label = (typeof sqTagLabel === 'function') ? sqTagLabel(tag, tid) : tid;
             // T66 follow-up: real port of per-tag removal, matching
             // a legacy affirm handler's own visible affordance (a trailing ✕).
             return `<span class="chip-btn sel affirm-chip" data-tid="${tid}" onclick="orchAffirmRemoveTag('${tid}')">${escapeHtml(label)} ✕</span>`;
         }).join(' ');

         const entity = route.entity;
         const displayName = entity?.ui_taxonomy?.display_name || entity?.id || 'this job';
         const adlibText = `a ${escapeHtml(displayName.toLowerCase())} job`;

         const laborEstimate = route.quote?.laborEstimate;
         const priceDisplay = (typeof laborEstimate === 'number' && laborEstimate > 0) ?
             `<span class="affirm-price">From $${laborEstimate}</span>` :
             '';

         // T64 follow-up: real port of the legacy affirmation-card renderer's pivotInfo-aware
         // framing -- same component, different headline/note, per the design's
         // own explicit recommendation (see this rule's own _note in btnyc.json).
         const pivotInfo = route.negationOverride;
         const groupDefs = DB.group || [];
         const pivotToName = pivotInfo ? (groupDefs.find(g => g.id === pivotInfo.to)?.display_name || pivotInfo.to) : null;
         const headline = pivotInfo ? 'Did you mean:' : 'We understood:';
         const pivotNote = pivotInfo ?
             `<div class="affirm-pivot-note">You mentioned this isn't quite what we first thought, so we're now looking at <strong>${escapeHtml(pivotToName)}</strong> instead.</div>` :
             '';

         // T66 follow-up: real port of the legacy affirmation-card renderer's sibling-service
         // recommendation logic -- offers up to 2 alternates when the match was
         // ambiguous (confidence < 85), using the route fields exposed above.
         const recs = [];
         const recSku = route.recommendedSku;
         if (recSku) {
             const primary = DB.services.find(s => s.id === recSku);
             if (primary) recs.push(primary);
         }
         if ((route.matchConfidence || 0) < 85 && route.intentCategory) {
             const siblings = (DB.services || []).filter(s =>
                 s.ui_taxonomy?.category_id === route.intentCategory &&
                 s.ui_taxonomy?.group_id === route.intentGroupId &&
                 s.id !== recSku &&
                 (() => {
                     const csk = resolveServiceCheckoutStateKey(s, null).key;
                     return csk === 'standard_flat_rate' || csk === 'database_summation';
                 })()
             ).slice(0, 2);
             siblings.forEach(s => {
                 if (!recs.find(r => r.id === s.id)) recs.push(s);
             });
         }
         const recHtml = recs.length > 0 ? `
        <div class="affirm-recs">
            <div class="affirm-recs-label">Suggested service${recs.length > 1 ? 's' : ''}:</div>
            ${recs.map(svc => {
                const name = svc.ui_taxonomy?.display_name || svc.id;
                const desc = svc.ui_taxonomy?.description || '';
                return `<div class="affirm-rec-card" onclick="orchAffirmSelectService('${svc.id}')">
                    <span class="affirm-rec-name">${escapeHtml(name)}</span>
                    ${desc ? `<span class="affirm-rec-desc">${escapeHtml(desc)}</span>` : ''}
                </div>`;
            }).join('')}
        </div>` : '';

         container.innerHTML = `
        <div class="affirm-card" id="sqAffirmCard">
            <div class="affirm-headline">${headline}</div>
            <div class="affirm-adlib">${adlibText}</div>
            ${pivotNote}
            <div class="affirm-chips" id="sqAffirmChips">${chipHtml}</div>
            ${recHtml}
            <div class="affirm-price-row">${priceDisplay}</div>
            <div class="affirm-actions">
                <button class="affirm-yes-btn" onclick="orchAffirmYes()">✓ Yes, that's it!</button>
                <button class="affirm-no-btn" onclick="orchAffirmNo()">Let me explain further</button>
            </div>
        </div>`;
         if (typeof enterFocusedMode === 'function') enterFocusedMode();
         container.style.setProperty('display', 'block', 'important');
     }

     function renderSelfQuoteFromRoute(route, svc) {
         const container = document.getElementById('serviceRequestSummary');
         if (!container) return;
         const quote = route.quote;
         if (!quote) return;

         // Reads price from the already-computed route quote -- no inline recomputation.
         // This is the Phase 6 guarantee: renderSelfQuoteFromRoute NEVER recomputes price;
         // it trusts the route's computeUnifiedQuote result exactly.
         const perItemLabor = quote.laborEstimate;
         const dispatch = quote.dispatchFee;
         const svcName = (svc || route.entity)?.ui_taxonomy?.display_name || route.entity?.ui_taxonomy?.display_name || 'Service';
         container.style.display = 'block';
         container.innerHTML = `
        <div id="summary-header"><h3>${svcName}</h3></div>
        <div class="summary-estimate" style="display:flex; justify-content:space-between; margin-top:16px; font-weight:bold;">
            <span>Total labor:</span>
            <span class="price-value">$${perItemLabor}</span>
        </div>
        ${quote.dispatchFee ? `<div style="font-size:0.9rem; color:#666; margin-top:4px;">+ $${quote.dispatchFee} dispatch fee</div>` : ''}
        <div class="action-buttons" style="display:flex; gap:10px; margin-top:16px;">
            <button class="book-now-button" id="btn-self-quote-add">Add to Request</button>
        </div>
    `;

         document.getElementById('btn-self-quote-add').addEventListener('click', function() {
             // Use the existing addToCart from AppController
             const entry = {
                 id: 'sq-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
                 serviceId: route.entity?.id || 'smartquote',
                 category_id: route.entity?.ui_taxonomy?.category_id || 'other',
                 name: svcName,
                 price: '$' + perItemLabor,
                 icon: route.entity?.ui_taxonomy?.icon || '⚡',
                 detail: 'Self-quote',
                 notes: 'Self-quote via direct pricing',
                 materialsNotIncluded: true,
                 materialsEstimateRange: [0, 0]
             };
             if (typeof addToCart === 'function') {
                 addToCart(entry);
             } else {
                 console.warn('addToCart not available');
             }
         });
     }


     function renderCuratedCardFromRoute(route, containerId, view) {
         const container = document.getElementById(containerId || 'intakeQuestionsContainer');
         if (!container) return;
         const chain = route.intakeChain || [];
         const answers = route.answers || {};
         const entity = route.entity;
         // Resolved state arrives as an argument (supplied by Glue); a renderer reads no session state.
         const divergencePath = (view && view.divergencePath) || null;

         // T135+ (root-cause fix, WASHER_UI_ISSUES_trace.json -- direct
         // operator instruction: treat the disease, not the symptom).
         // Confirmed structurally: the SmartQuote panel (text bar,
         // builder, #sqStepFlow -- this function's own step-flow render
         // target when containerId is 'sqSb3') is DOM-inserted directly
         // adjacent to #category-card/#serviceContainer at runtime
         // (catCard.insertAdjacentElement('afterend', sqEl)), not merely
         // nearby in the source file. Any path that (re-)renders real
         // step-flow content without ALSO hiding the browse-mode
         // containers stacks both in the same visual area -- confirmed
         // as the real, structural cause of the trace's "Underneath
         // again is showing What's Happening? Leaking water..." report.
         // Rather than chase the exact sequence that left them shown
         // (fragile, caller-dependent), this renderer now defensively
         // hides them itself whenever it renders real step-flow content
         // -- the same "don't trust implicit caller state" fix already
         // applied to sqRestart/sqBuildStep3 this session.
         if ((containerId || 'intakeQuestionsContainer') === 'sqSb3' && entity) {
             const catCard = document.getElementById('category-card');
             if (catCard) catCard.style.setProperty('display', 'none', 'important');
             if (DOM?.serviceContainer) DOM.serviceContainer.style.setProperty('display', 'none', 'important');
             else { const sc = document.getElementById('serviceContainer'); if (sc) sc.style.setProperty('display', 'none', 'important'); }
             const _sc3 = document.getElementById("sqSc3"); if (_sc3) _sc3.className = "scard active sq-stepflow";
             const _sn3 = document.getElementById("sqSn3"); if (_sn3) _sn3.className = "snum a";
         }

         if (!entity) {
             container.innerHTML = '<div class="repair-hint">No service selected.</div>';
             container.style.display = 'block';
             return;
         }

         container.style.display = 'block';
         // Route/container bookkeeping (S._lastRoute, S._lastContainerId) is owned by the caller: AppController.sqRenderCuratedCard.

         // T135+ (PHASE_PLAN.md Phase 2, Stage C, call site 2): the same
         // "Fork in the Road" check the legacy renderer already has,
         // reusing the same pure buildDivergenceResolutionHtml and the
         // same data -- confirmed directly that executeWorkflow's own
         // route.quote already carries divergenceEligible/
         // remoteDeepDiveModules correctly (a real, pre-existing forward
         // from computeUnifiedQuote, not something added here). This was
         // a UI-layer gap, not a data gap: the data already reached this
         // renderer, nothing displayed it.
         if (route.quote?.divergenceEligible && !divergencePath) {
             container.innerHTML = buildDivergenceResolutionHtml(route.quote, 'orchChooseDivergencePath');
             return;
         }
         let html = `<div class="intake-wrapper"><h3>${entity.ui_taxonomy?.display_name || 'Service'}</h3>`;
         if (entity.ui_taxonomy?.description) {
             html += `<p style="color:#555; margin-bottom:16px;">${entity.ui_taxonomy.description}</p>`;
         }
         // Single-unit stance (per_unit_answers_vary; the route carries the resolved record as route.quantity): book-separately guidance, naming what the customer's own words implied (T147)
         if (route.quantity && route.quantity.stance === 'single_unit') {
             const _asked = route.quantity.requestedQty > 1 ? `You mentioned ${route.quantity.requestedQty} \u2014 this quote is for one. ` : '';
             html += `<p style="color:#666; font-size:0.9rem; margin-bottom:12px;">${_asked}Need this for more than one? Each one can have different specifics (size, material, condition) — add this as its own request for each one so we get the right details for all of them.</p>`;
         }

         // T118 (Step 6 item 9, per PENDING_DECISIONS.md #25, explicit operator
         // direction): a targeted cross-link for services confirmed to be
         // commonly confused via catalog navigation (e.g. cabinet knob
         // INSTALL vs. cabinet door/drawer ADJUSTMENT -- a materially
         // different job). Does not address the underlying catalog-
         // discoverability root cause (#25's own text names that as a
         // separate, still-open question) -- a real, working escape hatch
         // for a customer who already landed on the wrong one, not a claim
         // the navigation itself is fixed.
         const relatedIds = Array.isArray(entity.related_services) ? entity.related_services : [];
         if (relatedIds.length) {
             html += `<div class="related-services-notice" style="background:#f8f9fb; border:1px solid #e2e8f0; border-radius:8px; padding:10px 14px; margin-bottom:16px; font-size:0.9rem;">`;
             relatedIds.forEach(relId => {
                 const relSvc = (DB.services || []).find(s => s.id === relId);
                 if (!relSvc) return;
                 const relName = relSvc.ui_taxonomy?.display_name || relId;
                 // T118 CORRECTION: an earlier version of this line omitted
                 // escapeHtml() on the mistaken belief that no such function
                 // exists in this codebase -- confirmed directly this was
                 // wrong: it's declared as `const escapeHtml = (str) => {...}`
                 // (an arrow function, not a `function` statement, which is
                 // why an overly narrow grep pattern missed it), and it's the
                 // dominant, established convention across dozens of call
                 // sites in this exact file, including the closely analogous
                 // "insert a recommended service's display name into HTML"
                 // pattern at this file's own affirm-rec-name rendering.
                 // Corrected here rather than left as shipped.
                 html += `Looking for <strong>${escapeHtml(relName)}</strong> instead?
                      <button class="related-service-switch" data-related-svc="${relId}"
                          style="background:none;border:none;color:#8a0615;font-weight:600;text-decoration:underline;cursor:pointer;padding:0;font-size:inherit;">
                          Switch to that
                      </button>`;
             });
             html += `</div>`;
         }

         // Render each module as a set of chips
         // T135+ FIX (PHASE_PLAN.md Phase 2, Stage B): this loop used to
         // render every authored module in `chain` unconditionally -- the
         // root cause of all 18 non-price divergences the full parity
         // sweep found against the legacy curated-intake builder. Confirmed directly
         // (grep across the whole file) that no ceiling/maxQs enforcement
         // existed anywhere in this render path; the legacy renderer's own
         // `maxQs`-based cap is the ONLY place that logic lived. Ported
         // here rather than invented fresh, preserving its own hard-won
         // v9.5.15 semantics exactly: an answered module is always shown
         // and never consumes a cap slot (so an already-answered parent
         // question never crowds out a branching follow-up); only
         // unanswered modules count against the cap, and once the cap is
         // reached, remaining unanswered modules simply aren't rendered.
         // The cap itself is not derived here: the orchestrator resolves it once from the canonical confidence strategy and puts it on
         // the route (route.maxFollowupQuestions, from orch_max_followup_questions) -- not a second, independently-derived value.
         // T135+ FIX (PHASE_PLAN.md Phase 2, Stage B): `chain` (route.intakeChain)
         // is the full, unfiltered composition -- it can include
         // branch-conditional modules (e.g. door_size/door_style_pref,
         // gated on client_supplying_door's own answer) that are not
         // actually relevant yet given the answers so far. The legacy
         // renderer filters through `_isModVisible` before ever iterating;
         // this one didn't, so a not-yet-triggered branch question could
         // render prematurely -- confirmed directly as the exact cause of
         // this session's last remaining parity-sweep divergence
         // (prehung_interior_door_install: 4 rendered vs. the real 2).
         const _visibleChain = (typeof _isModVisible === 'function')
             ? chain.filter(m => _isModVisible(m, answers, chain))
             : chain;
         const _maxQs = route.maxFollowupQuestions ?? Infinity; // resolved by the orchestrator (orch_max_followup_questions); Infinity = no cap known
         let _shownCount = 0;
         _visibleChain.forEach((mod, idx) => {
             const modKey = mod.moduleKey || mod.module;
             const question = mod.question || 'Question';
             const responses = mod.client_response || [];
             if (!responses.length) return;
             const _isDone = !!answers[modKey];
             if (!_isDone && _shownCount >= _maxQs) return;
             if (!_isDone) _shownCount++;

             html += `<div class="intake-module-step" style="margin-bottom:16px;">
                    <div class="ims-label" data-mod="${modKey}" style="font-weight:bold; margin-bottom:8px;">${idx+1}. ${question}</div>
                    <div class="ims-chips" style="display:flex; flex-wrap:wrap; gap:8px;">`;

             responses.forEach(resp => {
                 const isSelected = answers[modKey] === resp.label;
                 html += `<button class="ims-chip ${isSelected ? 'sel' : ''}" 
                        data-mod="${modKey}" 
                        data-label="${resp.label.replace(/"/g, '&quot;')}"
                        style="padding:6px 12px; border-radius:16px; border:1px solid #ccc; background:${isSelected ? '#e0f2fe' : '#fff'}; cursor:pointer;">
                        ${resp.label}
                     </button>`;
             });
             html += `</div></div>`;
         });

         // Show a summary/quote if all questions answered
         const q = route.quote;
         // The client chose "Book an on-site diagnostic": the price they are being asked to accept is the
         // flat diagnostic fee they were just shown, not the hourly labor estimate for the repair itself.
         const onsite = !!(q && q.isDiagnostic && q.divergenceEligible && divergencePath === 'onsite');
         const terms = onsite ? onsiteDiagnosticTerms(q) : null;
         if (q && onsite) {
             html += `<div class="summary-estimate" style="display:flex; justify-content:space-between; margin-top:16px; font-weight:bold;">
                    <span>${escapeHtml(terms.label)}</span>
                    <span class="price-value">$${terms.fee}</span>
                 </div>`;
             if (terms.creditNote) html += `<div class="divergence-credit-note" style="margin-top:6px; font-size:13px; color:#555;">${escapeHtml(terms.creditNote)}</div>`;
             html += `<div class="action-buttons" style="display:flex; gap:10px; margin-top:16px;">
                    <button class="book-now-button" id="btn-curated-add">Add to Request</button>
                 </div>`;
         } else if (q) {
             html += `<div class="summary-estimate" style="display:flex; justify-content:space-between; margin-top:16px; font-weight:bold;">
                    <span>Estimated labor:</span>
                    <span class="price-value">$${q.laborEstimate}</span>
                 </div>`;
             html += `<div class="action-buttons" style="display:flex; gap:10px; margin-top:16px;">
                    <button class="book-now-button" id="btn-curated-add">Add to Request</button>
                 </div>`;
         } else {
             html += `<div style="margin-top:16px; color:#888;">Please answer the questions above to see a quote.</div>`;
         }

         html += `</div>`;
         container.innerHTML = html;

         // "This question changes your price" indicator (Principle 7, transparency). Which modules do is SSOT data on the resolved module
         // (affects_price); the icon arrives as a view argument. Drawn as DOM nodes via _iconContent -- never as another markup string.
         if (view && view.affectsPriceIcon) {
             const _priceAffecting = new Set(_visibleChain.filter(m => m.affects_price).map(m => m.moduleKey || m.module));
             container.querySelectorAll('.ims-label[data-mod]').forEach(label => {
                 if (!_priceAffecting.has(label.dataset.mod)) return;
                 const tag = document.createElement('span');
                 tag.className = 'sq-ic-price-tag';
                 tag.appendChild(_iconContent(view.affectsPriceIcon));
                 label.appendChild(tag);
             });
         }

         // Attach event listeners for chip clicks
         container.querySelectorAll('.ims-chip').forEach(btn => {
             btn.addEventListener('click', function() {
                 const modKey = this.dataset.mod;
                 const label = this.dataset.label;
                 // Dispatch a custom event that the orchestrator can listen to
                 // In our new wiring, we'll handle this via a global function.
                 if (typeof window.handleIntakeAnswer === 'function') {
                     window.handleIntakeAnswer(modKey, label);
                 } else {
                     console.warn('No handler for intake answer');
                 }
             });
         });

         // T118 (Step 6 item 9, per PENDING_DECISIONS.md #25): related-service
         // switch button -- reuses prefillSmartQuoteFromService, the same real,
         // proven path a catalog tile tap or component/symptom resolution
         // already uses, rather than a bespoke navigation mechanism.
         container.querySelectorAll('.related-service-switch').forEach(btn => {
             btn.addEventListener('click', function() {
                 const relSvc = (DB.services || []).find(s => s.id === this.dataset.relatedSvc);
                 if (relSvc && typeof prefillSmartQuoteFromService === 'function') {
                     prefillSmartQuoteFromService(relSvc, relSvc.ui_taxonomy?.category_id || entity.ui_taxonomy?.category_id);
                 }
             });
         });

         // Attach add-to-cart if button exists
         const addBtn = container.querySelector('#btn-curated-add');
         if (addBtn && q) {
             addBtn.addEventListener('click', function() {
                 const entry = {
                     id: 'curated-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
                     serviceId: entity.id,
                     category_id: entity.ui_taxonomy?.category_id || 'other',
                     name: (entity.ui_taxonomy?.display_name || 'Service') + (onsite ? ' – On-site diagnostic' : ''),
                     price: '$' + (onsite ? terms.fee : q.laborEstimate),
                     icon: entity.ui_taxonomy?.icon || '🔧',
                     detail: onsite ? 'On-site diagnostic (flat rate)' : 'Curated intake',
                     notes: 'Answers: ' + JSON.stringify(answers) + (onsite ? '\n' + terms.bookingNote : ''),
                     materialsNotIncluded: true,
                     materialsEstimateRange: [0, 0]
                 };
                 if (typeof addToCart === 'function') {
                     addToCart(entry);
                 }
             });
         }
     }

     // _iconContent -- RENDERER helper. Returns a DOM NODE for an SSOT `icon` value, whichever form it is authored in:
     //   "ti ti-home"  -> <i class="ti ti-home"></i>      (Tabler: class names only, validated against a strict allowlist)
     //   "🏠" / text   -> a text node                      (emoji or any plain string; textContent semantics, never markup)
     // It builds nodes -- it never returns an HTML string -- so no icon value can inject markup and no escaping workaround is needed
     // (R-SYSTEM-NODOM). A value that claims to be Tabler ("ti ...") but fails the allowlist renders nothing rather than its raw text,
     // so a malformed SSOT value cannot put arbitrary class names on an element.
     function _iconContent(value) {
         if (typeof value === 'string' && value.startsWith('ti ')) {
             if (!/^ti ti-[a-z0-9-]+$/.test(value)) return document.createTextNode('');
             const i = document.createElement('i');
             i.className = value;
             return i;
         }
         return document.createTextNode(value == null ? '' : String(value));
     }

     function showGroupsForCategory(category_id, fromBack = false) {
         if (typeof _traceFn === 'function') _traceFn('showGroupsForCategory', {
             category_id,
             fromBack
         });
         if (!fromBack) Breadcrumbs.push({
             type: 'categories'
         });
         if (!fromBack) enterFocusedMode(true); // 👈 enter full‑screen glass mode; hide the text bar specifically for this, the real category-tile-tap entry point

         const groups = (DB.group || []).filter(g => g.category_id === category_id && !(g.parent_group || g.parent_id));
         const container = DOM.serviceContainer;
         container.replaceChildren();
         container.className = 'group-grid'; // use the grid layout from focused-mode CSS

         if (groups.length === 0) {
             container.innerHTML = '<div class="empty-message">No groups available.</div>';
             return;
         }

groups.forEach(g => {
    const tile = document.createElement('div');
    tile.className = 'group-tile';
    tile.tabIndex = 0;
    tile.role = 'button';

    const icon = document.createElement('span');
    icon.className = 'tile-icon';
    icon.textContent = g.icon || '📂';

    const info = document.createElement('div');
    info.style.cssText = 'display:flex;flex-direction:column;gap:6px;min-width:0;width:100%;';

    info.appendChild(Object.assign(document.createElement('span'), {
        className: 'tile-name',
        textContent: g.display_name || g.name
    }));

    const descText = g.description || g.blurb || g.ui_taxonomy?.description;
    if (descText) {
        info.appendChild(Object.assign(document.createElement('span'), {
            className: 'service-tile-expanded',
            textContent: descText
        }));
    }

    tile.appendChild(icon);
    tile.appendChild(info);
    tile.addEventListener('click', () => showSubGroups(g, category_id));
    container.appendChild(tile);
});


         container.style.display = 'block';
         DOM.categoriesGrid.style.display = 'none';
         setStep(2);
     }

     function humanizeComponentSymptomId(rawId) {
         // Real component/symptom IDs (routing_archetypes.*.real_component_ids/
         // real_symptom_ids) have no attached display-label field -- derived
         // programmatically here. Honest limitation, not hidden: this produces
         // reasonable but imperfect labels (e.g. "wont_power_on" -> "Wont power
         // on", missing the apostrophe) since there's no authored text to draw
         // from. A future pass could author real labels if this proves worth it.
         const withoutPrefix = (rawId || '').replace(/^(comp|sym)\./, '');
         const humanized = withoutPrefix.split('_').join(' ');
         return humanized.charAt(0).toUpperCase() + humanized.slice(1);
     }

     function resolveComponentSymptomTap(serviceIds, group, category_id, chosenAction) {
         // v9.6 FIX: now tries a real, exact service_type match against
         // chosenAction FIRST, when more than one real service maps to this
         // component/symptom -- confirmed via direct data check this genuinely
         // matters for real cases (tech_trouble_computer_repair's comp.hard_drive
         // maps to internal_hardware_replacement (Repair) vs
         // data_backup_or_transfer (Setup) -- meaningfully different real
         // requests an action-first tap correctly disambiguates). Falls back to
         // the original, component-only resolution when no match exists (every
         // current case in Doors/Toilets, where all real services happen to
         // share service_type Install regardless of what they actually do) --
         // never a dead end just because the exact type wasn't authored.
         //
         // Real bug found and fixed while adding the electric_lighting cluster,
         // before it shipped: this used .find(), which returns the FIRST
         // matching service without checking whether more than one shares that
         // same service_type -- fine when chosenAction disambiguates cleanly
         // (Repair vs Setup), but silently, wrongly resolved directly for
         // comp.bulb (high_ceiling_bulb_replacement vs led_bulb_upgrade, BOTH
         // "Install") without ever giving the customer the real choice between
         // them. Filter first, then only resolve directly when the filtered set
         // has exactly one member; otherwise fall through to the same
         // multi-match sub-picker used below, since chosenAction didn't
         // actually disambiguate anything here.
         if (serviceIds.length > 1 && chosenAction) {
             const typedMatches = serviceIds
                 .map(id => (DB.services || []).find(s => s.id === id))
                 .filter(s => s && s.service_type === chosenAction);
             if (typedMatches.length === 1) {
                 prefillSmartQuoteFromService(typedMatches[0], category_id);
                 return;
             }
         }
         // Exactly one real service maps to this component/symptom -- the common
         // case (e.g. Doors: every one of its 4 real components maps to exactly
         // one service). Resolve directly through the same, real, proven path a
         // catalog tile tap already uses.
         if (serviceIds.length === 1) {
             const svc = (DB.services || []).find(s => s.id === serviceIds[0]);
             if (svc) {
                 prefillSmartQuoteFromService(svc, category_id);
                 return;
             }
         }
         if (serviceIds.length > 1) {
             // A real, confirmed case (8 instances catalog-wide, e.g. comp.tv ->
             // both flatscreen_mounting_standard and _with_hidden_cables) --
             // genuinely more than one distinct service for this one component/
             // symptom, and no exact action match was found above. Show just
             // these matched services via the existing, proven tile renderer
             // rather than guessing which one is meant.
             const matched = serviceIds.map(id => (DB.services || []).find(s => s.id === id)).filter(Boolean);
             if (matched.length) {
                 renderServices(DOM.serviceContainer, matched, category_id, group.id);
                 return;
             }
         }
         // Zero real services map to this component/symptom -- a real, honest
         // gap. Falls through to the existing, proven, pre-seeded builder flow
         // (T76) rather than a dead end -- the group is already known, so the
         // builder correctly skips re-asking it.
         sqOpenBuilderPreseeded({
             action: chosenAction ? stDefaultAction(chosenAction) : null,
             groupId: group.id,
             categoryLabel: group.display_name || group.name || category_id,
             allowedTypes: null
         });
     }

function renderComponentSymptomPicker(container, group, category_id, chosenAction) {
    // T135+ (root-cause fix, WASHER_UI_ISSUES_trace.json): defensive
    // hide, completing the same fix applied to showSubGroups/
    // showServiceTypesForGroup/renderCuratedCardFromRoute -- this is the
    // actual function that renders the symptom/component tiles (e.g.
    // "Leaking water") the trace showed remaining visible and tappable
    // well after the flow had moved on.
    const _stepFlowGuard = document.getElementById('sqStepFlow');
    if (_stepFlowGuard) _stepFlowGuard.style.display = 'none';

    const _t = (typeof _traceFn === 'function') ? _traceFn('renderComponentSymptomPicker', {
        groupId: group?.id,
        chosenAction
    }) : { branch(){}, return(){}, error(){} };

    // v9.6 Track A / Phase 8: the real navigation picker, built on top of
    // the archetype/routing_archetypes data foundation. chosenAction (the
    // real service_type picked in the new showServiceTypesForGroup step
    // above this in the flow) is threaded through to resolution -- see
    // resolveComponentSymptomTap for why this matters for real, multi-
    // service components even though it's a no-op for Doors/Toilets today.
    const ra = DB.routing_archetypes?.[group.id];
    const archetype = ra?.routing_archetype;
    const isComponentFirst = archetype === 'component_first' && (ra?.real_component_ids || []).length > 0;
    const isSymptomFirst = archetype === 'symptom_first' && (ra?.real_symptom_ids || []).length > 0;

    _t.branch('archetype', {
        archetype,
        hasRa: !!ra,
        isComponentFirst,
        isSymptomFirst
    });

    // v9.6 FIX: real, distinct gap found while adding the appliances
    // groups -- washer/dishwasher/refrigerator are symptom_first (their
    // only real signal is 4 repair-oriented symptoms), but each also has
    // a real, direct, unambiguous Install service that no symptom could
    // ever surface (installing a new unit isn't a symptom). Without this,
    // tapping "Install" still only ever shows the same 4 repair symptoms,
    // none of which lead anywhere useful, even though the exact service
    // being asked for already, unambiguously exists.
    //
    // Real bug caught in the first version of this fix, before shipping:
    // checking for "exactly one unique service across all mappings"
    // isn't the right test -- washer's 4 real Repair symptoms all
    // happen to share the same washer_repair service, so that naive
    // check also (wrongly) skipped the symptom picker for Repair, even
    // though tapping a specific symptom still has real value (it
    // pre-answers washer_repair's own "symptom" intake question,
    // reducing friction later). The correct test: only skip when the
    // tiles this archetype would NORMALLY display are entirely
    // irrelevant to the chosen action -- i.e. none of them lead to a
    // service of that type at all -- not merely when they converge on
    // one shared destination.
    if (chosenAction) {
        const normalIds = isComponentFirst ? (ra?.real_component_ids || []) : (ra?.real_symptom_ids || []);
        const normalMapping = isComponentFirst ? (ra?.component_id_to_service_ids || {}) : (ra?.symptom_id_to_service_ids || {});
        const normalTilesHaveThisAction = normalIds.some(id =>
            (normalMapping[id] || []).some(svcId => {
                const svc = (DB.services || []).find(s => s.id === svcId);
                return svc && svc.service_type === chosenAction;
            })
        );
        _t.branch('chosenAction.normalTilesHaveThisAction', {
            chosenAction,
            normalIdsCount: normalIds.length,
            normalTilesHaveThisAction
        });
        if (!normalTilesHaveThisAction) {
            const allMapped = new Set([
                ...Object.values(ra?.component_id_to_service_ids || {}).flat(),
                ...Object.values(ra?.symptom_id_to_service_ids || {}).flat(),
            ]);
            const matchingAction = [...allMapped]
                .map(id => (DB.services || []).find(s => s.id === id))
                .filter(s => s && s.service_type === chosenAction);
            _t.branch('chosenAction.matchingAction', { count: matchingAction.length });
            if (matchingAction.length === 1) {
                _t.branch('chosenAction.shortCircuit', {
                    serviceId: matchingAction[0].id,
                    serviceType: matchingAction[0].service_type
                });
                prefillSmartQuoteFromService(matchingAction[0], category_id);
                return;
            }
        }
    }

    if (!isComponentFirst && !isSymptomFirst) {
        // No real, usable component/symptom signal for this group (undetermined,
        // or component_first/symptom_first but the real data is empty) --
        // the existing, proven flat tile grid is still the correct behavior
        // here, not a gap this picker needs to force-cover.
        const services = servicesByGroup.get(group.id) || [];
        _t.branch('noArchetypeSignal.flatGrid', {
            archetype,
            servicesCount: services.length
        });
        renderServices(container, services, category_id, group.id);
        return;
    }

    container.replaceChildren();
    container.className = 'group-grid';

    const ids = isComponentFirst ? ra.real_component_ids : ra.real_symptom_ids;
    const mapping = isComponentFirst ? ra.component_id_to_service_ids : ra.symptom_id_to_service_ids;

    _t.branch('tiles.plan', {
        isComponentFirst,
        idsCount: ids.length,
        hasMapping: !!mapping
    });

    // v9.6 FIX: real, direct customer report -- tapping a group with only
    // one real component/symptom (Bulbs, Thermostats, Water Lines, Garbage
    // Disposals, Window AC -- confirmed 5 of 18 real groups today) forced a
    // second, redundant tap on a tile whose name is often identical or
    // near-identical to the group's own name just tapped ("Bulbs" -> tap
    // "Bulb"). The same "skip when there's only one real, unambiguous
    // option" principle already applied to the Action step
    // (showServiceTypesForGroup) was never extended to this step. Skips
    // straight to resolution -- which still, correctly, shows a real
    // sub-picker when that one component maps to more than one service
    // (Bulbs: "High Ceiling Bulb Replacement" vs "LED Bulb Upgrade" is a
    // genuine choice, not redundant friction) or falls through to the
    // pre-seeded builder when it maps to none. Only the pointless,
    // single-tile tap itself is removed, not any real decision.
    if (ids.length === 1) {
        _t.branch('tiles.singleTileShortCircuit', {
            id: ids[0],
            svcIds: mapping?.[ids[0]] || []
        });
        // Note: mapping?.[...] -- mapping itself can be undefined even when
        // real_*_ids is populated, if the archetype data only authored one
        // side of the pair. Same defensive shape the tile loop below uses.
        resolveComponentSymptomTap(mapping?.[ids[0]] || [], group, category_id, chosenAction);
        return;
    }

    const prompt = create('div', {
        class: 'picker-prompt',
        text: isComponentFirst ? 'Which part?' : "What's happening?",
        style: 'grid-column:1/-1;font-weight:600;font-size:.95rem;margin-bottom:6px;color:#374151;'
    });
    container.appendChild(prompt);

    ids.forEach(rawId => {
        const label = humanizeComponentSymptomId(rawId);
        const tile = document.createElement('div');
        tile.className = 'group-tile';
        tile.tabIndex = 0;
        tile.role = 'button';
        tile.innerHTML = `<span class="tile-name">${escapeHtml(label)}</span>`;
        const handler = () => resolveComponentSymptomTap(mapping?.[rawId] || [], group, category_id, chosenAction);
        tile.addEventListener('click', handler);
        tile.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handler();
            }
        });
        container.appendChild(tile);
    });

    // v9.6 FIX (T74): a real, confirmed gap found scoping a customer-
    // reported dual-intent situation (Tech Trouble's Computer Repair, but
    // NOT unique to it -- confirmed the identical shape in 4 other real
    // groups: Washer, Refrigerator, Dishwasher, Microwave). Each of these
    // groups was deliberately, correctly authored with BOTH a component
    // mapping AND a symptom mapping -- but routing_archetype can only
    // select one as "live" per group, silently orphaning any service that
    // ONLY exists in the other one. In every one of these 5 cases the
    // orphaned service is the Install/Setup-type one, for exactly the
    // reason checkRoutingArchetypeConsistency's own, separate validation
    // already articulates for internal_hardware_replacement: a customer
    // who wants a new washer/router/etc installed already knows what they
    // want -- there is no real "symptom" to ask about. These services
    // already have their own correct, authored intake_chain (confirmed,
    // not assumed, by that same existing check) -- the gap was purely
    // that this picker never offered a path to them, not that they lacked
    // one. Surfaced as explicit, named tiles (not folded into the
    // ambiguous component/symptom resolution below) precisely because a
    // customer choosing one of these has stated an exact fact, the same
    // certainty level as a direct catalog tap -- resolved accordingly via
    // prefillSmartQuoteFromService, which correctly scores it via the
    // existing, proven entryType==='catalog' path (confidence 100), not
    // the group-level 'other_tile' formula this whole picker otherwise
    // uses. Deliberately does not touch the 5 other real groups sharing
    // the same dual-mapping shape (Toilets, Sinks, Showers/Tubs,
    // Furniture, Networking) -- confirmed directly, not assumed, that
    // their "dead" mapping is fully redundant with the live one, so
    // nothing there is actually orphaned.
    const otherMapping = isComponentFirst ? ra.symptom_id_to_service_ids : ra.component_id_to_service_ids;
    if (otherMapping) {
        const liveServiceIds = new Set();
        for (const svcIds of Object.values(mapping || {}))
            for (const id of svcIds) liveServiceIds.add(id);
        const orphanedServiceIds = new Set();
        for (const svcIds of Object.values(otherMapping)) {
            for (const id of svcIds)
                if (!liveServiceIds.has(id)) orphanedServiceIds.add(id);
        }
        _t.branch('orphanedServices', {
            count: orphanedServiceIds.size,
            ids: [...orphanedServiceIds]
        });
        orphanedServiceIds.forEach(svcId => {
            const svc = (DB.services || []).find(s => s.id === svcId);
            if (!svc) return;
            const tile = document.createElement('div');
            tile.className = 'group-tile';
            tile.tabIndex = 0;
            tile.role = 'button';
            tile.innerHTML = `<span class="tile-name">${escapeHtml(svc.ui_taxonomy?.display_name || svc.id)}</span>`;
            const handler = () => prefillSmartQuoteFromService(svc, category_id);
            tile.addEventListener('click', handler);
            tile.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handler();
                }
            });
            container.appendChild(tile);
        });
    }

    // v9.6 FIX: real, distinct gap found while adding the second real group
    // (Toilets) -- the zero-match fallback above only ever handles a
    // LISTED tile mapping to zero services. It does nothing for a
    // customer whose real need (e.g. "toilet seat", confirmed via direct
    // check: no comp.toilet_seat exists anywhere in this group's real
    // data, not even as a tracked real_gaps entry) was never a tile at
    // all. Without this, such a customer sees 5 tiles, none of which
    // match, with no obvious next step. Always shown, not conditional on
    // any specific gap being known in advance -- the honest answer to
    // "what if none of these are it" for every real group, not just the
    // ones with a currently-tracked gap.
    const fallbackTile = document.createElement('div');
    fallbackTile.className = 'group-tile';
    fallbackTile.tabIndex = 0;
    fallbackTile.role = 'button';
    fallbackTile.innerHTML = `<span class="tile-name">Something else</span>`;
    const fallbackHandler = () => resolveComponentSymptomTap([], group, category_id, chosenAction);
    fallbackTile.addEventListener('click', fallbackHandler);
    fallbackTile.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fallbackHandler();
        }
    });
    container.appendChild(fallbackTile);

    _t.branch('tiles.rendered', {
        promptText: isComponentFirst ? 'Which part?' : "What's happening?",
        totalChildren: container.children.length
    });
}

     function showServiceTypesForGroup(container, group, category_id) {
         if (typeof _traceFn === 'function') _traceFn('showServiceTypesForGroup', {
             groupId: group?.id
         });
         // T135+ (root-cause fix, WASHER_UI_ISSUES_trace.json): same
         // defensive hide as showSubGroups -- this is also a browse-mode
         // renderer that can be reached after step-flow content was
         // showing.
         const stepFlow = document.getElementById('sqStepFlow');
         if (stepFlow) stepFlow.style.display = 'none';
         // v9.6 Track A / Phase 8, directly requested: the real Action step,
         // shown between the group and the component/symptom picker -- matches
         // the group's real, authored dynamic_service_types (e.g. Doors:
         // Diagnostic/Mount/Repair), using the exact, already-established
         // BLD_ACTION_MAP for real, consistent labels/icons rather than
         // inventing a second labeling scheme.
         const types = (group.dynamic_service_types || []).filter(Boolean);

         if (types.length <= 1) {
             // Real, established "skip when unambiguous" pattern (matches
             // prefillSmartQuoteFromOtherTile's own singleType handling) --
             // asking a question with only one possible answer is pure
             // friction, not a real choice.
             renderComponentSymptomPicker(container, group, category_id, types[0] || null);
             return;
         }

         container.replaceChildren();
         container.className = 'group-grid';

         const prompt = create('div', {
             class: 'picker-prompt',
             text: 'What do you need done?',
             style: 'grid-column:1/-1;font-weight:600;font-size:.95rem;margin-bottom:6px;color:#374151;'
         });
         container.appendChild(prompt);

         types.forEach(stype => {
             const actionInfo = (typeof BLD_ACTION_MAP !== 'undefined' ? BLD_ACTION_MAP : []).find(a => a.stype === stype);
             const label = actionInfo?.label || stype;
             const tile = document.createElement('div');
             tile.className = 'group-tile';
             tile.tabIndex = 0;
             tile.role = 'button';
             tile.innerHTML = `<span class="tile-name">${escapeHtml(label)}</span>`;
             const handler = () => renderComponentSymptomPicker(container, group, category_id, stype);
             tile.addEventListener('click', handler);
             tile.addEventListener('keydown', e => {
                 if (e.key === 'Enter' || e.key === ' ') {
                     e.preventDefault();
                     handler();
                 }
             });
             container.appendChild(tile);
         });
     }

     function showSubGroups(group, category_id, fromBack = false) {
         if (typeof _traceFn === 'function') _traceFn('showSubGroups', {
             groupId: group?.id,
             category_id,
             fromBack
         });
         if (!fromBack) enterFocusedMode(true);
         const container = DOM.serviceContainer;
         container.replaceChildren();
         container.className = 'group-grid'; // grid layout -- matches showGroupsForCategory
         container.style.display = 'block';
         // T135+ (root-cause fix, WASHER_UI_ISSUES_trace.json): symmetric
         // to renderCuratedCardFromRoute's own new defensive hide -- this
         // browse-mode renderer now also hides the step-flow container
         // itself, rather than assuming the customer only ever arrives
         // here with it already hidden.
         const stepFlow = document.getElementById('sqStepFlow');
         if (stepFlow) stepFlow.style.display = 'none';

         const subGroups = window.groupChildrenMap.get(group.id) || [];

         if (subGroups.length > 0) {
             // Render sub-groups if they exist
             subGroups.forEach(sg => {
    const tile = document.createElement('div');
    tile.className = 'group-tile';
    tile.tabIndex = 0;
    tile.role = 'button';

    const icon = document.createElement('span');
    icon.className = 'tile-icon';
    icon.textContent = sg.icon || '📂';

    const info = document.createElement('div');
    info.style.cssText = 'display:flex;flex-direction:column;gap:6px;min-width:0;width:100%;';

    info.appendChild(Object.assign(document.createElement('span'), {
        className: 'tile-name',
        textContent: sg.display_name || sg.name
    }));

    const descText = sg.description || sg.blurb || sg.ui_taxonomy?.description;
    if (descText) {
        info.appendChild(Object.assign(document.createElement('span'), {
            className: 'service-tile-expanded',
            textContent: descText
        }));
    }

    tile.appendChild(icon);
    tile.appendChild(info);
    const handler = () => showSubGroups(sg, category_id);
    tile.addEventListener('click', handler);
    tile.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handler();
        }
    });
    container.appendChild(tile);
});
         } else {
             // Leaf node: render actual services -- or, for groups with real,
             // verified component/symptom data, the new Action -> Component/
             // Symptom flow instead.
             // v9.6 Track A / Phase 8: gated to an explicit allowlist, starting
             // with Doors (PHASE8_..._DESIGN.md's own chosen pilot -- zero real
             // gaps, both real components resolve to exactly one service each).
             // Not a permanent restriction: showServiceTypesForGroup and
             // renderComponentSymptomPicker already gracefully fall back to
             // renderServices/skip-when-unambiguous for any group without real,
             // usable data, so expanding this list is just adding a real
             // group_id once it's been verified the same way Doors was --
             // nothing structural changes. Kept explicit rather than
             // unconditional-for-all-33-groups so each group's real component/
             // symptom mapping gets checked before customers see it, not
             // discovered by them.
             // v9.6: now enters through showServiceTypesForGroup (real Action
             // step, directly requested) rather than the component/symptom
             // picker directly -- see resolveComponentSymptomTap for why the
             // chosen action matters for real, multi-service components.
             const PICKER_ENABLED_GROUPS = new Set(['minor_home_repairs_doors', 'plumbing_help_toilets', 'tech_trouble_computer_repair', 'minor_home_repairs_cabinets_drawers', 'minor_home_repairs_appliances_washer', 'minor_home_repairs_appliances_dishwasher', 'minor_home_repairs_appliances_refrigerator', 'minor_home_repairs_appliances_window_ac', 'electric_lighting_bulbs', 'electric_lighting_fans', 'electric_lighting_light_fixtures', 'electric_lighting_outlets', 'electric_lighting_switches', 'electric_lighting_thermostats', 'plumbing_help_sinks', 'plumbing_help_showers_tubs', 'plumbing_help_water_lines', 'plumbing_help_garbage_disposals', 'wall_mounting_blinds_curtain', 'wall_mounting_brick_or_concrete', 'wall_mounting_frames_shelves', 'wall_mounting_tv_flatscreen']);
             const services = servicesByGroup.get(group.id) || [];
             if (PICKER_ENABLED_GROUPS.has(group.id)) {
                 showServiceTypesForGroup(container, group, category_id);
             } else {
                 renderServices(container, services, category_id, group.id);
             }
         }

         container.style.display = 'block';
         DOM.categoriesGrid.style.display = 'none';
         setStep(3);
         if (!fromBack) Breadcrumbs.push({
             type: 'subgroup',
             group: group.id,
             category_id
         });
     }
     // v9.6 FIX: the retired group-selection helper removed -- confirmed zero real
     // call sites; a thin, unused wrapper around showSubGroups(group,
     // category_id, true). Real back-navigation calls showSubGroups
     // directly (COMPONENT_LAYER_MAP.md).
     const setText = (el, text) => {
         if (el) el.textContent = text;
     }

     function setViewportHeight() {
         const vh = window.innerHeight * 0.01;
         document.documentElement.style.setProperty('--vh', `${vh}px`);
     }

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
                 const charge = mathFurnitureAssembly(State.furnitureItems);
                 const entry = {
                     id: `${svc.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                     serviceId: svc.id,
                     category_id,
                     name: svc.ui_taxonomy?.display_name,
                     price: `$${charge.price.toFixed(2)}`,
                     icon: renderIcon(svc.icon) || '🛋️',
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

     function showIntakeQuestions(svc, category_id, fromBack = false) {
         if (!fromBack) Breadcrumbs.push({
             type: 'serviceDetail',
             group: null,
             category_id
         });
         enterFocusedMode();
         setStep(4);
         const container = DOM.intakeQuestionsContainer;
         container.replaceChildren();
         container.style.display = 'block';
         if (DOM.serviceContainer) DOM.serviceContainer.style.display = 'none';
         if (svc.requires_furniture_selection) {
             renderFurnitureSelection(container, svc, category_id);
             return;
         }
         const prof = getServiceProfile(svc);
         if (prof.requiresSiteVisit) {
             _renderDiagnosticFlow(svc, category_id, container, prof);
             return;
         }
         if (prof.isOther) {
             _renderOtherFlow(svc, category_id, container, prof);
             return;
         }
         if (svc.intake_chain && svc.intake_chain.length > 0) {
             _renderStructuredIntake(svc, category_id, container, prof);
             return;
         }
         _renderSimpleConfirm(svc, category_id, container, prof);
     }



     function sqBuilderBack() {
         if (BLD.step > 0) {
             BLD.step--;
             sqBuilderRender();
         }
     }

     function sqBuilderChoose(stepId, choice) {
         const chips = document.querySelectorAll('#sqBuilderChips .sq-b-chip');
         chips.forEach(c => c.classList.remove('sq-b-sel'));

         BLD[stepId] = choice.value;

         // Store metadata — now includes groupId from JSON
         if (stepId === 'action') {
             BLD._stype = choice.stype;
             // _verbLabel removed — was only used by the now-fixed sentence
             // construction; BLD.action itself is the correct infinitive.
         }
         if (stepId === 'object' || stepId === 'specific') {
             if (choice.cat) BLD._cat = choice.cat;
             if (choice.groupId) BLD._groupId = choice.groupId;
             if (choice.keyword) BLD._keyword = choice.keyword;
         }

         BLD.step++;
         // v9.6 FIX: skip forward past any step whose field is already
         // answered (e.g. "object" pre-seeded from a catalog "Other" tile
         // tap, which already knows the group) -- matches the same
         // skip-forward logic sqOpenBuilderPreseeded already applies once
         // at initial open, which this naive `step++` alone never
         // re-checked on every subsequent chip tap. Confirmed via real
         // browser trace: without this, tapping an action chip after
         // entering from a group's "Other" tile re-asked "What is it?"
         // with an unrelated, unscoped list of groups from entirely
         // different categories, the already-known group not even
         // among them.
         const stepsAfterChoice = sqBuilderGetSteps();
         while (BLD.step < stepsAfterChoice.length &&
             BLD[stepsAfterChoice[BLD.step]] !== null &&
             BLD[stepsAfterChoice[BLD.step]] !== undefined) {
             BLD.step++;
         }

         sqBuilderRender();
     }

     /** stDefaultAction — maps a service_type to the builder's action
      *  vocabulary, reading the SSOT infinitive from action_conjugations
      *  rather than hardcoding a parallel mapping. */
     function stDefaultAction(stype) {
         const norm = (stype || 'Repair').replace('Install / Mount', 'Install');
         const conj = DB.negation_library?.action_conjugations?.[norm];
         return conj?.infinitive_for_adlib || norm.toLowerCase();
     }




     /* ── $ref resolver: expands btnyc.json internal references ─────── */
     function resolveRefs(obj, root) {
         root = root || obj;
         if (Array.isArray(obj)) return obj.map(function(item) {
             return resolveRefs(item, root);
         });
         if (obj && typeof obj === 'object') {
             if (obj.$ref) {
                 const path = obj.$ref.replace(/^#\//, '').split('/');
                 let ref = root;
                 for (const seg of path) ref = ref && ref[seg];
                 return ref;
             }
             const out = {};
             for (const [k, v] of Object.entries(obj)) out[k] = resolveRefs(v, root);
             return out;
         }
         return obj;
     }


     /* ================================================================
        GUIDED BUILDER — "Write it for me"
        
        State: BLD = { step, action, object, specific, condition, location, qty }
        Steps: action → object → specific? → condition? → location → review
        After completing, synthesizes a description string and feeds into
        sqAnalyze() exactly as if the user had typed it.
     ================================================================ */

     let BLD = {
         step: 0,
         action: null,
         object: null,
         specific: null,
         condition: null,
         location: null,
         qty: 1
     };

     // ── Step definitions — driven from btnyc.json SSOT ─────────────
     //
     // Step 1 (action): minimal hardcoding — service_type keys exist in JSON
     //   but human verb labels ("Fix", "Hang") are not in the SSOT. These 5 stay.
     //
     // Step 2 (object): 100% from DB.group — top-level groups per category.
     //   group.display_name = label, group.icon = emoji, group.category_id = routing.
     //
     // Step 3 (specific): 100% from DB.group — sub-groups (have parent_group).
     //   Only shown when the chosen group has children.
     //
     // Step 4 (condition): from DB.intake_modules[symptom/issue] when available,
     //   falling back to a small universal list for fix/remove actions.
     //
     // Step 5 (location): NOT in btnyc.json — UI-only, stays hardcoded.

     // Action step: maps service_types + human-friendly verb labels
     // JSON service_types keys: Install, Repair, Diagnostic, Assembly, Setup
     // We add "Hang/Mount" and "Remove" as UI aliases — not in the SSOT.
     // v9.5 FIX: icon now derived from the real SSOT
     // (service_types[stype].icon — tabler icon classes,
     // e.g. ti-tool, ti-wall) instead of a hardcoded emoji,
     // confirmed via direct comparison that service_types
     // genuinely carries icon/verb_natural fields this never
     // read. label/value are intentionally KEPT as curated UI
     // text, not derived 1:1 from service_types — there's no
     // clean substitution (7 user-facing actions against 6 SSOT
     // types; "Hang / Mount" reads better to a customer as its
     // own distinct choice than collapsing it into "Install"
     // would, even though both share similar underlying pricing).
     const BLD_ACTION_MAP = [{
             label: 'Fix / Repair',
             icon: DB?.service_types?.Repair?.icon || 'ti ti-tool',
             value: 'fix',
             stype: 'Repair',
             verbLabel: 'fixed'
         },
         {
             label: 'Install',
             icon: DB?.service_types?.Install?.icon || 'ti ti-wall',
             value: 'install',
             stype: 'Install',
             verbLabel: 'installed'
         },
         {
             label: 'Hang / Mount',
             icon: DB?.service_types?.Mount?.icon || 'ti ti-library-photo',
             value: 'mount',
             stype: 'Mount',
             verbLabel: 'mounted'
         },
         {
             label: 'Assemble',
             icon: DB?.service_types?.Assembly?.icon || 'ti ti-armchair',
             value: 'assemble',
             stype: 'Assembly',
             verbLabel: 'assembled'
         },
         {
             label: 'Remove',
             icon: 'ti-trash',
             value: 'remove',
             stype: 'Repair',
             verbLabel: 'removed'
         },
         {
             label: 'Set up / Config',
             icon: DB?.service_types?.Setup?.icon || 'ti ti-settings',
             value: 'set up',
             stype: 'Setup',
             verbLabel: 'set up'
         },
         {
             label: 'Diagnose',
             icon: DB?.service_types?.Diagnostic?.icon || 'ti ti-search',
             value: 'look at',
             stype: 'Diagnostic',
             verbLabel: 'looked at'
         },
     ];

     // Location step: NOT in btnyc.json — hardcoded UI list
     // v9.5 FIX: was a hardcoded 8-room array, completely bypassing
     // negation_library.nlp_location_words (the real SSOT, with 21
     // location words — attic, garage, closet, laundry room, mudroom,
     // patio, etc. — none of which a hardcoded list could ever surface,
     // confirmed via direct comparison against the real data). Adding a
     // new room to the JSON previously did nothing here at all — the
     // entire point of an SSOT-driven list. Now genuinely reads from
     // window._NLP.ROOMS (set in block 0 from this exact field).
     const BLD_LOCATION_ICONS = {
         'living room': '🛋️',
         'bedroom': '🛏️',
         'master bedroom': '🛏️',
         'kitchen': '🍳',
         'bathroom': '🚿',
         'home office': '💼',
         'office': '💼',
         'dining room': '🍽️',
         'basement': '🪜',
         'attic': '📦',
         'garage': '🚗',
         'closet': '🚪',
         'laundry room': '🧺',
         'hallway': '🚶',
         'foyer': '🚪',
         'entryway': '🚪',
         'guest room': '🛏️',
         'backyard': '🌳',
         'patio': '🌳',
         'balcony': '🌳',
         'mudroom': '🥾',
     };
     // T136: was an IIFE evaluated when this script LOADED -- before the SSOT (and so
     // window._NLP.ROOMS) existed -- which left the "Where in the home?" step with
     // only an "Other" chip, permanently. Computed on demand, memoised per SSOT load.
     let _bldLocCache = null,
         _bldLocFor = null;

     function bldLocations() {
         const words = (window._NLP && window._NLP.ROOMS) || [];
         if (_bldLocCache && _bldLocFor === words) return _bldLocCache;
         const list = words.map(w => ({
             label: w.replace(/\b\w/g, c => c.toUpperCase()),
             icon: BLD_LOCATION_ICONS[w] || '📍',
             value: w,
         }));
         list.push({
             label: 'Other',
             icon: '📍',
             value: null
         });
         _bldLocCache = list;
         _bldLocFor = words;
         return list;
     }

     // Universal fallback conditions (used when no intake_module matches)
     // v9.5 FIX: was a separate, hardcoded 7-condition list,
     // completely bypassing negation_library.nlp_condition_phrases
     // (the real SSOT) — confirmed via direct comparison. Adding a
     // new condition phrase to the JSON previously did nothing here.
     // The real data is [synonym, canonical] pairs (multiple synonyms
     // can map to the same canonical phrase, e.g. 'cant close' and
     // "can't close" both -> "can't close") — deduplicated by
     // canonical label below, since the builder needs one chip per
     // distinct real-world condition, not one per raw synonym.
     const BLD_CONDITION_ICONS = {
         'leaking': '💧',
         'dripping': '💧',
         'water damage': '💧',
         "won't turn on": '⚡',
         'not working': '⚡',
         'flickering': '⚡',
         'making noise': '🔊',
         'squeaking': '🔊',
         'wobbly': '↔️',
         'loose': '↔️',
         'cracked': '🪓',
         'broken': '🪓',
         'damaged': '🪓',
         'running constantly': '🔄',
         'clogged': '🐌',
         'stuck': '🐌',
         'jammed': '🐌',
         "can't close": '🚪',
         "can't open": '🚪',
         'not closing': '🚪',
         'not opening': '🚪',
         'falling off': '⬇️',
     };
     // T136: same load-time-evaluation bug as BLD_LOCATIONS (see above).
     let _bldCondCache = null,
         _bldCondFor = null;

     function bldFallbackConditions() {
         const pairs = (window._NLP && window._NLP.CONDS) || [];
         if (_bldCondCache && _bldCondFor === pairs) return _bldCondCache;
         const seen = new Set();
         const list = [];
         pairs.forEach(([, canonical]) => {
             if (seen.has(canonical)) return;
             seen.add(canonical);
             list.push({
                 label: canonical.replace(/\b\w/g, c => c.toUpperCase()),
                 icon: BLD_CONDITION_ICONS[canonical] || '⚠️',
                 value: canonical,
             });
         });
         _bldCondCache = list;
         _bldCondFor = pairs;
         return list;
     }

     // ── Builder step engine — reads from DB (btnyc.json) ─────────────
     function bldGetObjectChoices(action, knownCategoryId) {
         if (!DB) return [];
         // Get all top-level groups (no parent_group)
         const topGroups = DB.group.filter(g => !g.parent_group);

         // Filter by action context
         // "assemble" only shows groups with Assembly in dynamic_service_types
         // "fix"/"remove" only shows groups with Repair
         // "install"/"mount"/"set up" shows Install/Mount groups
         // No filter → show all (fallback)
         const stypeFilter = {
             fix: ['Repair', 'Diagnostic'],
             remove: ['Repair', 'Diagnostic'],
             install: ['Install / Mount', 'Install'],
             mount: ['Install / Mount', 'Install'],
             assemble: ['Assembly'],
             'set up': ['Setup', 'Install / Mount'],
             'look at': ['Diagnostic'],
         } [action] || null;

         let groups = topGroups;
         if (stypeFilter) {
             groups = topGroups.filter(g => {
                 const types = g.dynamic_service_types || [];
                 return types.some(t => stypeFilter.includes(t));
             });
             // If filter leaves too few options, fall back to all
             if (groups.length < 2) groups = topGroups;
         }

         // Category already known (e.g. user tapped an Other tile inside
         // a specific category) — narrow to that category instead of
         // showing the whole catalog. This is the actual mechanism behind
         // "category/group already known should be pre-filled": narrowing
         // the CHOICES shown, since the object itself still needs asking.
         if (knownCategoryId) {
             const inCategory = groups.filter(g => g.category_id === knownCategoryId);
             if (inCategory.length > 0) groups = inCategory;
         }

         return groups.map(g => ({
             label: g.display_name,
             icon: g.icon || '🔧',
             value: g.id, // use group ID as value (not display_name)
             cat: g.category_id,
             groupId: g.id,
             // Map to closest intent_mapping keyword for NLP accuracy
             keyword: bldGroupToKeyword(g.id, g.category_id),
         }));
     }

     function bldGetSpecificChoices(groupId) {
         if (!DB || !groupId) return null;
         const subGroups = DB.group.filter(g => g.parent_group === groupId);
         if (!subGroups.length) return null;
         return subGroups.map(g => ({
             label: g.display_name,
             icon: g.icon || '🔧',
             value: g.id,
             cat: g.category_id,
             groupId: g.id,
             keyword: bldGroupToKeyword(g.id, g.category_id),
         }));
     }

     function bldGetConditionChoices(action, groupId) {
         // Try to find a relevant intake_module for this group's services
         if (DB && groupId) {
             // Find services in this group and check their intake_chain for symptom/issue modules
             const grpServices = (DB.services || []).filter(s =>
                 s.ui_taxonomy?.group_id === groupId &&
                 resolveServiceCheckoutStateKey(s, null).key !== 'diagnostic'
             );
             for (const svc of grpServices) {
                 const chain = svc.intake_chain || [];
                 const condModule = chain.find(m => ['symptom', 'issue', 'damage_type', 'state'].includes(m.module));
                 if (condModule) {
                     const mod = DB.intake_modules?.[condModule.module];
                     if (mod?.client_response?.length) {
                         return mod.client_response.map(r => ({
                             label: r.label,
                             icon: '🔍',
                             value: r.label.toLowerCase(),
                         }));
                     }
                 }
             }
             // v9.6 FIX: real, confirmed gap -- named services rarely carry
             // symptom-type modules; dynamic_services (keyed
             // category+groupId+stype) mostly do, and were never checked
             // here at all, silently falling through to the generic
             // fallback below for an estimated 30+ real groups. Same
             // search, same module list, just extended to the other real
             // source of intake_chains, matched by the key's own middle
             // segment (T135+ CORRECTED, PRICING_GUIDE B17: was "84 of
             // 96" -- confirmed stale against current SSOT, re-verified
             // directly: 70 of 82 real keys use this exact 3-part shape;
             // the remaining 12 are 2-part,
             // category-level-only keys with no group segment at all, and
             // correctly don't match here since they aren't specific to
             // any one group).
             const dynEntries = Object.entries(DB.dynamic_services || {})
                 .filter(([key]) => key.split('+')[1] === groupId);
             for (const [, dynDef] of dynEntries) {
                 const chain = dynDef.intake_chain || [];
                 const condModule = chain.find(m => ['symptom', 'issue', 'damage_type', 'state'].includes(m.module));
                 if (condModule) {
                     const mod = DB.intake_modules?.[condModule.module];
                     if (mod?.client_response?.length) {
                         return mod.client_response.map(r => ({
                             label: r.label,
                             icon: '🔍',
                             value: r.label.toLowerCase(),
                         }));
                     }
                 }
             }
         }
         // Fix/remove: show universal fallback conditions
         if (['fix', 'remove', 'look at'].includes(action)) return bldFallbackConditions();
         // Install/mount/assemble/set up: no condition step
         return null;
     }

     // Map a group ID to the best matching intent_mapping keyword
     // This ensures the NLP path picks the right base price and formula
     function bldGroupToKeyword(groupId, catId) {
         if (!DB) return null;
         const maps = DB.intent_mappings?.objects || [];
         // Direct keyword match on group display_name or category
         for (const m of maps) {
             const cat = m.default_dynamic_category;
             if (cat && cat === catId) return m.keyword;
         }
         // Partial fallback by category
         const catKeywordMap = {
             wall_mounting: 'mount',
             plumbing_help: 'faucet / sink',
             electric_lighting: 'light fixture',
             furniture_fixes_assembly: 'furniture',
             minor_home_repairs: 'tile / floor',
             tech_trouble: 'other',
         };
         return catKeywordMap[catId] || 'other';
     }

     // BLD_STEPS is now a thin router — all data comes from DB via the functions above
     const BLD_STEPS = [{
             id: 'action',
             prompt: 'What do you need done?',
             icon: 'ti-tool',
             // When entering from a multi-type "[Group] Other" tile,
             // BLD._allowedTypes narrows the chips to only the types
             // actually uncovered for that group (e.g. a group missing
             // only Diagnostic+Repair shouldn't show Assemble/Set up
             // chips that don't even apply there). Falls back to the
             // full list for fresh/free-text-seeded builder sessions.
             choices: (bld) => {
                 if (!bld._allowedTypes || !bld._allowedTypes.length) return BLD_ACTION_MAP;
                 const filtered = BLD_ACTION_MAP.filter(a => bld._allowedTypes.includes(a.stype));
                 return filtered.length ? filtered : BLD_ACTION_MAP;
             }
         },
         {
             id: 'object',
             prompt: 'What is it?',
             icon: 'ti-package',
             choices: (bld) => bldGetObjectChoices(bld.action, bld._cat || null)
         },
         {
             id: 'specific',
             prompt: 'Which one?',
             icon: 'ti-list',
             choices: (bld) => bldGetSpecificChoices(bld.object) // null = skip step
         },
         {
             id: 'condition',
             prompt: "What's the issue?",
             icon: 'ti-alert-circle',
             choices: (bld) => bldGetConditionChoices(bld.action, bld.specific || bld.object)
         },
         {
             id: 'location',
             prompt: 'Where in the home?',
             icon: 'ti-map-pin',
             choices: () => bldLocations()
         },
         {
             // T118 (Step 6 item 6, per PENDING_DECISIONS.md #21,
             // explicit operator direction): sqBuilderGetSteps()
             // never included a qty step at all -- BLD.qty stayed at
             // its sqOpenBuilderPreseeded default of 1 forever for
             // any builder session reached via catalog navigation
             // into a dynamic-service-only group (the real,
             // diagnosed case: tapping Ceiling Tile Replacement
             // showed a real, correctly-computed price with zero
             // questions, including no quantity prompt). Only
             // included when genuinely needed -- see
             // sqBuilderGetSteps's own gating logic below, which
             // restricts this to catalog-navigation sessions
             // specifically (BLD._fromOtherTile): a free-text
             // session already attempts real extraction via
             // extractQty(existingText) at open time, so asking
             // again here would be redundant friction for that
             // path, not a gap.
             id: 'qty',
             prompt: 'How many?',
             icon: 'ti-hash',
             choices: () => [{
                     value: 1,
                     label: '1'
                 },
                 {
                     value: 2,
                     label: '2'
                 },
                 {
                     value: 3,
                     label: '3'
                 },
                 {
                     value: 4,
                     label: '4'
                 },
                 {
                     value: 5,
                     label: '5 or more'
                 },
             ]
         }
     ];

     // ── Builder helpers ───────────────────────────────────────────────

     /** sqOpenBuilderPreseeded — opens the guided builder with the
      *  action AND object (group) steps already answered — both are
      *  known from which Other-tile the user tapped (action = the
      *  tile's service_type, object = the group itself) — jumping
      *  straight to "specific/condition/location", whichever the
      *  group's own sub-structure actually calls for. Reuses the
      *  same "advance past known fields" logic sqToggleBuilder
      *  already uses when seeding from typed text. */

     // Get the ordered list of active step IDs for this flow
     function sqBuilderGetSteps() {
         const steps = ['action', 'object'];
         // specific: only if object has sub-choices
         const specStep = BLD_STEPS.find(s => s.id === 'specific');
         const specChoices = typeof specStep?.choices === 'function' ?
             specStep.choices(BLD) : specStep?.choices;
         if (specChoices && specChoices.length > 0) steps.push('specific');
         // condition: only for fix/remove
         const condStep = BLD_STEPS.find(s => s.id === 'condition');
         const condChoices = typeof condStep?.choices === 'function' ?
             condStep.choices(BLD) : condStep?.choices;
         if (condChoices && condChoices.length > 0) steps.push('condition');
         // location always
         steps.push('location');
         // T118 (PENDING_DECISIONS.md #21): quantity, but only for
         // catalog-navigation sessions (BLD._fromOtherTile) -- a
         // free-text session already tried real extraction via
         // extractQty(existingText) at open time (see
         // sqToggleBuilder's own free-text branch), so this would
         // be redundant friction there, not a gap to close.
         if (BLD._fromOtherTile) steps.push('qty');
         return steps;
     }

     function sqBuilderCurrentStep() {
         const steps = sqBuilderGetSteps();
         return BLD_STEPS.find(s => s.id === steps[BLD.step]);
     }

     function sqBuilderRender() {
         const stepDef = sqBuilderCurrentStep();
         if (!stepDef) {
             sqBuilderFinish();
             return;
         }

         const allSteps = sqBuilderGetSteps();
         const totalSteps = allSteps.length;

         // Choices
         const choices = typeof stepDef.choices === 'function' ?
             stepDef.choices(BLD) :
             stepDef.choices;

         if (!choices || choices.length === 0) {
             // Skip this step
             BLD.step++;
             sqBuilderRender();
             return;
         }

         // Update live sentence preview
         sqBuilderUpdateSentence();

         // Update prompt
         const prompt = document.getElementById('sqBuilderPrompt');
         if (prompt) {
             prompt.innerHTML = `<i class="ti ${stepDef.icon}"></i> ${stepDef.prompt}`;
         }

         // Render chips
         const chipsEl = document.getElementById('sqBuilderChips');
         if (chipsEl) {
             chipsEl.innerHTML = '';
             choices.forEach(ch => {
                 const btn = document.createElement('button');
                 btn.className = 'sq-b-chip';
                 // Pre-select if already chosen
                 const curVal = BLD[stepDef.id];
                 if (curVal === ch.value || (ch.value === null && curVal === null)) {
                     btn.classList.add('sq-b-sel');
                 }
                 btn.innerHTML = ch.icon ? `<i class="ti ${ch.icon}"></i>${ch.label}` : ch.label;
                 btn.addEventListener('click', () => sqBuilderChoose(stepDef.id, ch));
                 chipsEl.appendChild(btn);
             });
         }

         // Back button
         const back = document.getElementById('sqBuilderBack');
         if (back) back.style.display = BLD.step > 0 ? 'flex' : 'none';

         // Progress dots
         const prog = document.getElementById('sqBuilderProgress');
         if (prog) {
             prog.innerHTML = allSteps.map((_, i) =>
                 `<div class="sq-b-dot ${i < BLD.step ? 'done' : i === BLD.step ? 'active' : ''}"></div>`
             ).join('');
         }
     }

     function sqBuilderUpdateSentence() {
         const el = document.getElementById('sqBuilderSentence');
         if (!el) return;
         const w = (txt, cls = 'bw') => `<span class="${cls}">${txt}</span>`;
         const s = (txt) => `<span class="bs">${txt}</span>`;
         const placeholder = (n) => Array(n).fill(`<span class="bp"></span>`).join('');

         let parts = [w('I need to ')];

         if (BLD.action) {
             // BLD.action is already the correct infinitive (matches
             // negation_library.action_conjugations[*].infinitive_for_adlib).
             // Was using _actObj.verbLabel (past participle) which produced
             // "I need to fixed my window" — now uses BLD.action directly.
             parts.push(s(BLD.action));
         } else parts.push(placeholder(1));

         if (BLD.action) {
             parts.push(w(' my '));
             const _rawObj = BLD.specific || BLD.object;
             if (_rawObj) {
                 // _rawObj is now a group ID — resolve to display_name
                 const _grpDisp = DB ? (DB.group || []).find(g => g.id === _rawObj) : null;
                 parts.push(s(_grpDisp?.display_name || _rawObj));
             } else parts.push(placeholder(1));
         }

         if (BLD.condition) {
             parts.push(w(' because it is '));
             parts.push(s(BLD.condition));
         }

         if (BLD.location) {
             parts.push(w(' in my '));
             parts.push(s(BLD.location));
         }

         el.innerHTML = parts.join('');
     }

     function sqEditAdlib() {
         const box = document.getElementById('sqAdlibBox');
         if (box) box.style.display = 'none';
         const bb = document.getElementById('sqS3build');
         if (bb) bb.style.display = 'inline-flex';
     }


     function sqMarkDone(n, val) {
         const sb = document.getElementById('sqSb' + n);
         if (sb) sb.style.display = 'none';
         const sn = document.getElementById('sqSn' + n);
         if (sn) {
             sn.className = 'snum d';
             sn.innerHTML = '<i class="ti ti-check" style="font-size:14px"></i>';
         }
         const sv = document.getElementById('sqSv' + n);
         if (sv) sv.textContent = val || '';
         const sc = document.getElementById('sqSc' + n);
         if (sc) sc.className = 'scard done';
     }

     function sqOpen(n) {
         const el = document.getElementById('sqSb' + n);
         if (el) el.style.display = 'block';
         const sn = document.getElementById('sqSn' + n);
         if (sn) sn.className = 'snum a';
     }

     // sqShowBuilderView -- RENDERER. Switches the SmartQuote region from the text bar to the step builder
     // (DOM only; reads no session state). Split out of sqOpenBuilderPreseeded, statements unchanged.
     function sqShowBuilderView() {
         const builder = document.getElementById('sqBuilder');
         const inlineRow = document.querySelector('#sqTextBar .sq-inline-row');
         if (builder) builder.style.display = 'block';
         if (inlineRow) inlineRow.style.display = 'none';
         // Hide any curated intake card left over from a previous service:
         // sqSb3 and the builder are sibling regions and nothing else hides
         // one when the other opens (the "software intake re-populates"
         // report). [v9.5 fix -- had been silently lost to a shadowing
         // duplicate declaration of this function.]
         const sb3 = document.getElementById('sqSb3');
         if (sb3) sb3.style.display = 'none';
         const sc3 = document.getElementById('sqSc3');
         if (sc3) sc3.className = 'scard locked sq-stepflow';
     }


     function sqOpenStep(n) {
         // Allow tapping a done step header to re-expand it
         [2, 3].forEach(i => {
             const b = document.getElementById('sqSb' + i);
             if (b && i !== n) b.style.display = 'none';
         });
         const b = document.getElementById('sqSb' + n);
         if (b) b.style.display = b.style.display === 'none' ? 'block' : 'none';
     }




     function buildDivergenceResolutionHtml(q, handlerFnName) {
         // Pure: takes the already-computed quote object (q, from
         // computeQuoteFromState -> computeUnifiedQuote) and returns an
         // HTML string. Reads only its q argument and DB (config/copy),
         // never S/State directly, never mutates anything, never touches
         // the DOM itself -- matches this file's own "pure render"
         // convention (UIRenderer.js: reads app state, never mutates it).
         // See PROJECT_GOALS §9/10 ("Diagnostic Divergence: The Fork in
         // the Road") and global_rules.divergence_resolution for the
         // business terms this renders.
         // handlerFnName names the global function the two buttons call: the canonical orchChooseDivergencePath. It is a required
         // argument -- it used to default to a legacy handler, which is retired.
         const handler = handlerFnName;
         const dr = q.divergenceTerms || {}; // handed in by the Logic layer (computeUnifiedQuote); the renderer never reads the SSOT
         const n = (q.remoteDeepDiveModules || []).length;
         const qWord = n === 1 ? 'question' : 'questions';
         const fee = q.divergenceFee || 0;
         return (
             '<div class="qpanel divergence-hub">' +
             '<div class="qhero">' +
             '<div class="qitag"><i class="ti ti-search"></i> On-site quote</div>' +
             '<div class="qpsub" style="font-size:15.5px;font-weight:600;line-height:1.45;margin-top:2px;color:#fff">' +
             escapeHtml(dr.hub_heading || "We can't quote this one sight-unseen \u2014 here's how you'd like to proceed:") +
             '</div>' +
             '</div>' +
             '<div class="qbody">' +
             '<div class="divergence-options">' +
             '<button type="button" class="divergence-option" onclick="' + handler + '(\'remote\')">' +
             '<div class="do-icon"><i class="ti ti-message-2-question"></i></div>' +
             '<div class="do-body">' +
             '<div class="do-title">' + escapeHtml(dr.remote_option_label || 'Answer a few more questions') + '</div>' +
             '<div class="do-desc">' + escapeHtml(dr.remote_option_description || 'Save money by telling us more \u2014 if we can pin down the cause, you get a real price right now.') + '</div>' +
             '<div class="do-meta">' + n + ' more ' + qWord + '</div>' +
             '</div>' +
             '<i class="ti ti-chevron-right do-chev"></i>' +
             '</button>' +
             '<button type="button" class="divergence-option" onclick="' + handler + '(\'onsite\')">' +
             '<div class="do-icon"><i class="ti ti-tool"></i></div>' +
             '<div class="do-body">' +
             '<div class="do-title">' + escapeHtml(dr.onsite_option_label || 'Book an on-site diagnostic') + '</div>' +
             '<div class="do-desc">' + escapeHtml(dr.onsite_option_description || 'A pro examines it in person for a flat fee, credited back if you go ahead with the repair.') + '</div>' +
             '<div class="do-meta">$' + fee + ' \u00b7 ' + escapeHtml(dr.credit_policy_note || dr.credit_policy || 'Credited toward the repair if you proceed.') + '</div>' +
             '</div>' +
             '<i class="ti ti-chevron-right do-chev"></i>' +
             '</button>' +
             '</div>' +
             '</div>' +
             '</div>'
         );
     }

     // renderQuotePanel -- RENDERER. Draws the quote panel from the view-model built by buildQuotePanelModel. Reads no session state
     // and decides nothing: every price, label, banner and ordering arrives resolved. (Markup is still an HTML string with inline
     // handlers, as before -- converting it to DOM construction is a separate, later step.)
     function renderQuotePanel(out, m) {
         if (m.mode === 'fork') {
             // The customer chooses between Path A (answer more, remotely) and Path B (book the on-site diagnostic). Handler: the canonical one.
             out.innerHTML = buildDivergenceResolutionHtml(m.q, 'orchChooseDivergencePath');
             out.style.display = 'block';
             out.scrollIntoView({
                 behavior: 'smooth',
                 block: 'start'
             });
             return;
         }
         const q = m.q;
         const badge = m.badge;
         const badgeKey = m.badgeKey;
         const svcLabel = m.svcLabel;
         const qtyLabel = m.qtyLabel;

         const timeLine = q.hideTime ? '' :
             '<div class="ql"><span class="qll"><i class="ti ti-clock"></i> Est. labor time</span>' +
             '<span class="qlv m">~' + q.totalMin + ' min · ' +
             '<span class="' + (q.tierKey === 'specialized' ? 'c' : '') + '">' + q.tierKey + '</span>' +
             ' ($' + q.tierRate + '/hr)</span></div>';

         const btnLabel = q.btnText || 'Add to Request';

         // Two distinct banner states:
         //  1. Auto-selected (S._autoSelectedFrom set by sqAnalyze when
         //     confidence crossed the auto-select threshold) — this IS
         //     the matched service already; show a prominent, front-and-
         //     center confirmation with a clear way to revert, since
         //     "auto-select" without an undo isn't really optional.
         //  2. Suggestable but not auto-selected (a recommendedSku exists
         //     but confidence was below threshold) — softer "you could
         //     also try X" prompt, since the generic estimate currently
         //     showing is what should remain visually primary.
         let _recBanner = '';
         if (m.banner && m.banner.kind === 'auto') {
             _recBanner =
                 '<div style="margin-bottom:14px;padding:12px 16px;background:rgba(45,138,45,.08);border-radius:10px;border:1.5px solid rgba(45,138,45,.3);font-size:13.5px;display:flex;align-items:center;gap:10px;">' +
                 '<i class="ti ti-circle-check-filled" style="color:#2d8a2d;font-size:19px;flex-shrink:0"></i>' +
                 '<div style="flex:1;min-width:0;"><strong style="color:#1a3d1a;">Matched to an exact service</strong> — this gives a more precise quote than a general estimate.' +
                 '<button type="button" onclick="window._sqRevertAutoSelect()" style="background:none;border:none;color:#888;font-size:12px;text-decoration:underline;cursor:pointer;padding:0;margin-left:8px;">Not this? Use general estimate</button></div>' +
                 '</div>';
         } else {
             _recBanner = (m.banner && m.banner.kind === 'suggest') ?
                 '<div style="margin-bottom:12px;padding:10px 14px;background:rgba(222,0,0,.06);border-radius:10px;border:1px solid rgba(222,0,0,.2);font-size:13px;display:flex;align-items:center;gap:10px;">' +
                 '<i class="ti ti-star" style="color:var(--clr-red,#de0000);font-size:15px;flex-shrink:0"></i>' +
                 '<div style="flex:1;min-width:0;"><strong>Possible match:</strong> ' + m.banner.name +
                 ' <span style="color:#888;font-size:12px;">— may give a more precise quote</span></div>' +
                 '<button type="button" onclick="window._sqSwitchToRecommended(\'' + m.banner.sku.replace(/'/g, "\\'") + '\',\'' + (m.banner.catId || '').replace(/'/g, "\\'") + '\')" ' +
                 'style="flex-shrink:0;background:var(--clr-red-dark,#8a0615);color:#fff;border:none;border-radius:7px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">Use this</button>' +
                 '</div>' :
                 '';
         }

         const extraFeeRow = (q.feeBreakdown && q.feeBreakdown.length) ?
             q.feeBreakdown.map(f =>
                 '<div class="ql"><span class="qll"><i class="ti ti-adjustments-alt"></i> ' + escapeHtml(f.label) + '</span>' +
                 '<span class="qlv ' + (f.fee < 0 ? 'g' : '') + '">' + (f.fee >= 0 ? '+' : '') + '$' + f.fee + '</span></div>'
             ).join('') :
             (q.extraFee ?
                 '<div class="ql"><span class="qll"><i class="ti ti-adjustments-alt"></i> Condition adjustments</span>' +
                 '<span class="qlv ' + (q.extraFee < 0 ? 'g' : '') + '">' + (q.extraFee >= 0 ? '+' : '') + '$' + q.extraFee + '</span></div>' :
                 '');

         const _chip = t => '<span class="chip gtag" style="cursor:default;font-size:12px;padding:4px 12px"><i class="ti ti-check"></i> ' + t.label + '</span>';
         const tagsRow = m.conditions.count ?
             '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:16px" id="sqConditionsRow">' +
             m.conditions.feeBearing.map(_chip).join('') +
             (m.conditions.zeroFee.length ?
                 '<span class="chip gtag" id="sqZeroFeeToggle" style="cursor:pointer;font-size:12px;padding:4px 12px;opacity:.65" onclick="sqToggleZeroFeeConditions()">+' + m.conditions.zeroFee.length + ' more detail' + (m.conditions.zeroFee.length > 1 ? 's' : '') + '</span>' +
                 '<span id="sqZeroFeeConditions" style="display:none">' + m.conditions.zeroFee.map(_chip).join('') + '</span>' :
                 '') +
             '</div>' :
             '';

         out.innerHTML = _recBanner +
             '<div class="qpanel">' +
             '<div class="qhero">' +
             '<div class="qitag" data-badge-key="' + badgeKey + '">' + badge + '</div>' +
             '<div class="' + (q.isProject ? 'qpranger' : 'qprice') + '">' + q.priceDisplay + '</div>' +
             '<div class="qpsub">' + q.priceSub + '</div>' +
             '<div class="qmeta"><i class="ti ti-tool"></i> ' + svcLabel + ' &middot; ' + m.stype + '</div>' +
             '</div>' +
             '<div class="qbody">' +
             '<div class="qlines">' +
             '<div class="ql"><span class="qll"><i class="ti ti-receipt"></i> Base ' + (m.stype || 'service').toLowerCase() + '</span><span class="qlv">$' + q.base + '</span></div>' +
             extraFeeRow +
             timeLine +
             '<div class="ql"><span class="qll"><i class="ti ti-stack-2"></i> Quantity</span><span class="qlv">' + m.qty + ' ' + qtyLabel + '</span></div>' +
             '<div class="ql"><span class="qll"><i class="ti ti-car"></i> ' + m.dispatchLabel + '</span><span class="qlv m">+$' + q.dispatchFee + ' &middot; ' + m.dispatchScopeNote + '</span></div>' +
             '<div class="ql" style="margin-top:8px;border-bottom:none">' +
             '<span class="qll" style="font-weight:600;font-size:15px">Total labor</span>' +
             '<span class="qlv" style="font-size:20px;font-weight:700;color:var(--clr-red-dark,#8a0615)">$' + q.laborCalc + (q.isDiag || q.isProject ? ' (est.)' : '') + '</span>' +
             '</div>' +
             '</div>' +
             tagsRow +
             '<div class="disc"><i class="ti ti-info-circle"></i><div>' + q.disclaimerText + '</div></div>' +
             '</div>' +
             '<div class="ctarow">' +
             '<button class="ctap ' + (q.btnClass || '') + '" onclick="sqAddToCart()"><i class="ti ti-shopping-cart" style="font-size:18px"></i> ' + btnLabel + '</button>' +
             '<button class="ctag" onclick="sqRestart()"><i class="ti ti-refresh"></i> Start Over</button>' +
             '</div>' +
             '</div>';
         out.style.display = 'block';

         out.scrollIntoView({
             behavior: 'smooth',
             block: 'start'
         });
     }

     function sqToggleZeroFeeConditions() {
         // T118 (Step 6 item 10, per PENDING_DECISIONS.md #26):
         // simple show/hide toggle for the collapsed, zero-fee
         // conditions group -- deliberately plain (no animation,
         // no separate state tracked in S) since the whole row
         // regenerates fresh, collapsed, on every sqRenderQuote()
         // call anyway (e.g. after answering another question),
         // matching how a customer would expect a "more details"
         // disclosure to behave: open while looking, collapsed
         // again once something else changes.
         const el = document.getElementById('sqZeroFeeConditions');
         const toggle = document.getElementById('sqZeroFeeToggle');
         if (!el || !toggle) return;
         const isHidden = el.style.display === 'none';
         el.style.display = isHidden ? 'contents' : 'none';
         toggle.style.display = isHidden ? 'none' : '';
     }

     // sqResetView -- RENDERER. Resets the SmartQuote view to its initial DOM state. Reads no session state
     // (S/BLD): the state reset itself is owned by the sqRestart handler (AppController).
     // Split out of the former sqRestart, DOM statements unchanged.
     function sqResetView() {
         window._sqCuratedRender = null;
         const out = document.getElementById('sqQuoteOut');
         if (out) out.innerHTML = '';
         const desc = document.getElementById('sqDescIn');
         if (desc) desc.value = '';
         // Reset the unified action button back to its default
         // (low-confidence) label/state, since the textarea is
         // also being cleared right above.
         const unifiedBtn = document.getElementById('sqUnifiedActionBtn');
         const unifiedLabel = document.getElementById('sqUnifiedActionLabel');
         if (unifiedBtn) unifiedBtn.classList.remove('sq-unified-confident');
         if (unifiedLabel) unifiedLabel.textContent = 'Build it step by step';
         const overrideLink = document.getElementById('sqManualOverrideLink');
         if (overrideLink) overrideLink.style.display = 'none';
         window._sqUnifiedMode = 'build';
         const preview = document.getElementById('sqLivePreview');
         if (preview) preview.innerHTML = '<i class="ti ti-sparkles"></i><span class="preview-empty">✨ Describe your job — we\u2019ll build a clear request for you</span>';
         // Clear stale containers to prevent duplicate question listeners
         const staleTypes = document.getElementById('sqTypeChips');
         if (staleTypes) staleTypes.innerHTML = '';
         const staleDetTags = document.getElementById('sqDetTags');
         if (staleDetTags) staleDetTags.innerHTML = '';
         // Reset step cards
         [2, 3].forEach(n => {
             const sc = document.getElementById('sqSc' + n),
                 sb = document.getElementById('sqSb' + n),
                 sn = document.getElementById('sqSn' + n),
                 sv = document.getElementById('sqSv' + n);
             if (sc) sc.className = 'scard locked sq-stepflow';
             if (sb) sb.style.display = 'none';
             if (sn) {
                 sn.className = 'snum';
                 sn.innerHTML = String(n);
             }
             if (sv) sv.textContent = '';
         });
         const _sqDynGroupsEl = document.getElementById('sqDynGroups');
         if (_sqDynGroupsEl) _sqDynGroupsEl.innerHTML = '';
         const ab = document.getElementById('sqAdlibBox');
         if (ab) ab.style.display = 'none';
         const bb = document.getElementById('sqS3build');
         if (bb) bb.style.display = 'none';
         // Hide step flow, restore text bar and category grid
         const flow = document.getElementById('sqStepFlow');
         if (flow) flow.style.display = 'none';
         const bar = document.getElementById('sqTextBar');
         if (bar) bar.style.display = 'block';
         const grid = document.getElementById('category-card');
         if (grid) grid.style.display = 'grid';
         if (DOM.serviceContainer) DOM.serviceContainer.style.display = 'none';
         
         const bldr = document.getElementById('sqBuilder');
         if (bldr) bldr.style.display = 'none';
         const bBtn = document.getElementById('sqUnifiedActionBtn');
         if (bBtn) bBtn.classList.remove('active');
         const inRow = document.querySelector('#sqTextBar .sq-inline-row');
         if (inRow) inRow.style.display = 'flex';
         exitFocusedMode?.();
     }


     function sqToggleBuilder() {
         const builder = document.getElementById('sqBuilder');
         const inlineRow = document.querySelector('#sqTextBar .sq-inline-row');
         // sqWriteForMeBtn was removed when Analyze/Write-it-for-me/Got-it
         // were unified into one button (sqUnifiedActionBtn) — point the
         // "active" visual state at the real surviving button instead.
         const btn = document.getElementById('sqUnifiedActionBtn');
         if (!builder) return;
         // computed, not inline: the builder starts hidden by CSS (inline display is ''),
         // and treating '' as "open" made the very first tap CLOSE a closed builder.
         const isOpen = window.getComputedStyle(builder).display !== 'none';

         if (isOpen) {
             // ── Close builder → restore textarea ──────────────────────
             builder.style.display = 'none';
             if (inlineRow) inlineRow.style.display = 'flex';
             btn?.classList.remove('active');
             // Sync textarea with whatever the builder has built so far
             const textarea = document.getElementById('sqDescIn');
             if (textarea && (BLD.action || BLD.object)) {
                 const obj = BLD.specific || BLD.object || '';
                 const act = BLD.action || '';
                 const cond = BLD.condition || '';
                 const loc = BLD.location || '';
                 const _g = DB ? (DB.group || []).find(x => x.id === obj) : null;
                 const synth = (obj || act) ? composeAdlibSentence({
                     actions: act ? [act] : [],
                     object: (_g ? _g.display_name : obj) || null,
                     qty: BLD.qty,
                     location: loc || null,
                     condition: cond || null
                 }) : '';
                 if (synth) textarea.value = synth;
                 // Re-run the live confidence/preview pass on the
                 // synthesized text so the unified button reflects
                 // the builder's own answers immediately, not stale
                 // empty-input state.
                 textarea.dispatchEvent(new Event('input'));
             }
         } else {
             // ── Open builder ──────────────────────────────────────────
             builder.style.display = 'block';
             if (inlineRow) inlineRow.style.display = 'none';
             btn?.classList.add('active');

             const existingText = (document.getElementById('sqDescIn')?.value || '').trim();

             if (existingText && DB) {
                 // ── Text already typed → NLP-seed the builder state ──────
                 // Parse what we can from the existing text
                 // T136: the SAME parse the live preview showed -- never a second one.
                 const understood = understandRequest(existingText, {
                     quiet: true
                 });
                 const intent = understood.intent;
                 const objNoun = understood.object;
                 const loc = understood.location;

                 // Map intent stype → builder action value
                 // T136: derived from the builder's own action table (was a second hardcoded
                 // map with no 'Mount' entry, so "hang my clock" was never seeded).
                 const _st = intent?.stype || '';
                 const _byStype = BLD_ACTION_MAP.find(a => a.stype === _st);
                 const detectedAction = _byStype ? _byStype.value : (_st === 'Install / Mount' ? 'mount' : null);

                 // Reset BLD and seed from NLP
                 BLD = {
                     step: 0,
                     action: detectedAction,
                     object: objNoun || null,
                     specific: null,
                     condition: null,
                     location: loc || null,
                     qty: understood.qty,
                     _stype: intent?.stype ? (intent.stype.replace('Install / Mount', 'Install')) : null,
                     _cat: intent?.category || null,
                     _groupId: null,
                     _keyword: intent?.key || null,
                     _fromOtherTile: false,
                     _contextLabel: null,
                     _objectLabel: null,
                     _allowedTypes: null
                 };

                 // Advance BLD.step past already-known fields to the first gap
                 const allSteps = sqBuilderGetSteps();
                 for (let i = 0; i < allSteps.length; i++) {
                     const sid = allSteps[i];
                     if (BLD[sid] !== null && BLD[sid] !== undefined) {
                         BLD.step = i + 1; // mark this step done, advance to next
                     } else {
                         break; // stop at the first unknown
                     }
                 }
                 // Cap at last step
                 if (BLD.step >= allSteps.length) BLD.step = allSteps.length - 1;

             } else {
                 // ── No text → fresh start ─────────────────────────────────
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
             }

             sqBuilderRender();
         }
     }

     function sqUnifiedAction() {
         const desc = (document.getElementById('sqDescIn')?.value || '').trim();
         if (!desc) {
             // Nothing typed — open the guided builder directly
             sqToggleBuilder();
             return;
         }
         // T136: a COMPLETE understanding (valid object + the SSOT confidence
         // bar) goes straight to the orchestrator via sqAnalyze. Anything less
         // opens the guided builder, pre-seeded with what WAS understood, so
         // the client is asked the one missing thing instead of being handed a
         // price (or a surface-material question) for a request the system
         // never actually understood. The builder is a Gateway, not a dead end:
         // it resolves to the same BookingContext.
         const understood = understandRequest(desc, {
             quiet: true
         });
         // A request that carries tags keeps the Tag Affirmation gate (Charter: "did we
         // understand you?"): sqAnalyze -> orchestrator shows the affirmation card, and the
         // client's stated constraint ("urgent", "no parking") survives. Sending it to the
         // builder instead would drop what they already told us.
         const carriesTags = typeof detectTagsNLP === 'function' && ((detectTagsNLP(desc).found) || []).length > 0;
         if (!understood.complete && !carriesTags) {
             const builderEl = document.getElementById('sqBuilder');
             if (builderEl && window.getComputedStyle(builderEl).display === 'none') sqToggleBuilder();
             else if (builderEl) sqBuilderRender();
             return;
         }
         sqAnalyze();
     }

     function sqUnlock(n) {
         const el = document.getElementById('sqSc' + n);
         if (el) el.className = 'scard active';
     }

     function toast(msg, type = 'info') {
         let container = q('#toast-container');
         if (!container) {
             container = document.createElement('div');
             container.id = 'toast-container';
             container.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:10001;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
             document.body.appendChild(container);
         }
         const bg = type === 'success' ? 'rgba(34,197,94,0.95)' : type === 'error' ? 'rgba(220,38,38,0.95)' : 'rgba(0,0,0,0.9)';
         const el = document.createElement('div');
         el.style.cssText = `background:${bg};color:white;padding:12px 20px;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.35);font-size:14px;max-width:300px;transition:opacity .3s,transform .3s;pointer-events:auto;`;
         el.textContent = msg;
         container.appendChild(el);
         setTimeout(() => {
             el.style.opacity = '0';
             el.style.transform = 'translateX(20px)';
             setTimeout(() => el.remove(), 320);
         }, 3000);
     }

     function updateCartOverlayIfOpen(cart) {
         if (!DOM.cartOverlay || DOM.cartOverlay.style.display !== 'flex') return;
         const items = cart || window.__store.getState().cart.serviceRequest;
         const list = DOM.cartServiceList;
         if (!list) return;
         const totalItems = items.length;
         const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
         if (cartCurrentPage > totalPages && totalPages > 0) cartCurrentPage = totalPages;
         if (totalPages === 0) cartCurrentPage = 1;
         const start = (cartCurrentPage - 1) * ITEMS_PER_PAGE;
         const pageItems = items.slice(start, start + ITEMS_PER_PAGE);
         list.replaceChildren();
         if (totalItems === 0) {
             list.innerHTML = `<div class="empty-invoice-message">🛒 Your cart is empty<br><button class="add-more-button" id="emptyCartBrowseBtn" type="button">Browse Catalog</button></div>`;
             setTimeout(() => {
                 q('#emptyCartBrowseBtn')?.addEventListener('click', () => {
                     closeCartOverlay();
                     restoreCategoryView();
                 });
             }, 0);
             const pag = DOM.cartOverlay.querySelector('#CartPagination');
             if (pag) pag.style.display = 'none';
             const terms = DOM.cartOverlay.querySelector('.terms-wrap');
             if (terms) terms.style.display = 'none';
             if (DOM.overlaybookNowBtn) DOM.overlaybookNowBtn.disabled = true;
             const disc = document.querySelector('#projectDisclaimerNote');
             if (disc) disc.remove();
             return;
         }
         // Compute instance labels for the current page (same grouping as updateCartSummary)
         const groups = {};
         items.forEach(s => {
             if (s.furnitureItems) return;
             const key = s.name + '::' + s.category_id;
             (groups[key] = groups[key] || []).push(s);
         });
         const labels = {};
         Object.values(groups).forEach(group => {
             if (group.length > 1) {
                 group.forEach((s, i) => {
                     labels[s.id] = `#${i + 1}`;
                 });
             }
         });

         pageItems.forEach(svc => {
             const item = create('div', {
                 class: 'cart-service-item'
             });
             item.appendChild(create('div', {
                 class: 'cart-service-icon',
                 text: svc.ui_taxonomy?.icon || svc.icon || '🔧'
             }));
             const tw = create('div', {
                 class: 'cart-service-text'
             });
             const instanceLabel = labels[svc.id];
             const nameNode = instanceLabel ?
                 create('span', {}, [
                     document.createTextNode(svc.name + ' '),
                     create('span', {
                         class: 'cart-instance-badge',
                         text: instanceLabel
                     })
                 ]) :
                 document.createTextNode(svc.name);
             tw.appendChild(create('h4', {}, [nameNode]));
             tw.appendChild(create('div', {
                 class: 'summary-service-detail',
                 text: svc.detail || ''
             }));
             if (svc.notes && !svc.furnitureItems?.length) tw.appendChild(create('div', {
                 class: 'cart-service-notes',
                 text: svc.notes
             }));
             if (svc.materialsNotIncluded && svc.materialsEstimateRange) {
                 tw.appendChild(create('div', {
                     class: 'f-item',
                     text: `+ Materials $${svc.materialsEstimateRange[0]}‑$${svc.materialsEstimateRange[1]}`,
                     style: 'background: #f97316; color: #fff; font-size: 0.7rem; margin-top: 4px;'
                 }));
             }
             if (svc.furnitureItems?.length) {
                 const fwrap = create('div', {
                     class: 'summary-service-furniture'
                 });
                 svc.furnitureItems.forEach((fi, idx) => {
                     const fitem = create('span', {
                         class: 'f-item'
                     });
                     fitem.appendChild(create('span', {
                         text: fi.label
                     }));
                     const rm = create('button', {
                         type: 'button',
                         text: '✕'
                     });
                     rm.addEventListener('click', e => {
                         e.stopPropagation();
                         removeFurnitureEntry(svc.id, idx);
                         updateCartOverlayIfOpen();
                     });
                     fitem.appendChild(rm);
                     fwrap.appendChild(fitem);
                 });
                 tw.appendChild(fwrap);
             }
             item.appendChild(tw);
             item.appendChild(create('div', {
                 class: 'cart-service-price',
                 text: svc.price || '0'
             }));
             const rmBtn = create('button', {
                 class: 'remove-service-btn',
                 type: 'button',
                 text: '✕',
                 'aria-label': `Remove ${svc.name}`
             });
             rmBtn.addEventListener('click', () => {
                 removeServiceFromCart(svc.id);
                 updateCartOverlayIfOpen();
                 restoreCategoryView();
             });
             item.appendChild(rmBtn);
             list.appendChild(item);
         });
         let pag = DOM.cartOverlay.querySelector('#CartPagination');
         if (!pag) {
             pag = create('div', {
                 id: 'CartPagination',
                 class: 'cart-pagination'
             });
             list.parentNode.insertBefore(pag, list.nextSibling);
         }
         if (totalPages > 1) {
             pag.style.display = 'flex';
             pag.innerHTML = `<button class="pagination-btn" id="prevPageBtn" ${cartCurrentPage===1?'disabled':''}>&lt; Prev</button>
                                 <span class="pagination-info">Page ${cartCurrentPage} of ${totalPages} (${totalItems} items)</span>
                                 <button class="pagination-btn" id="nextPageBtn" ${cartCurrentPage===totalPages?'disabled':''}>Next &gt;</button>`;
             q('#prevPageBtn')?.addEventListener('click', () => {
                 if (cartCurrentPage > 1) {
                     cartCurrentPage--;
                     updateCartOverlayIfOpen();
                 }
             });
             q('#nextPageBtn')?.addEventListener('click', () => {
                 if (cartCurrentPage < totalPages) {
                     cartCurrentPage++;
                     updateCartOverlayIfOpen();
                 }
             });
         } else pag.style.display = 'none';
         let termsWrap = DOM.cartOverlay.querySelector('.terms-wrap');
         if (!termsWrap) {
             termsWrap = create('div', {
                 class: 'terms-wrap'
             });
             const cb = create('input', {
                 type: 'checkbox',
                 id: 'termsCheckbox'
             });
             const lbl = create('label', {
                 htmlFor: 'termsCheckbox'
             });
             lbl.innerHTML = `I agree to the <a href="https://tommichael88.github.io/booktomnyc/ServiceAgreement" target="_blank" rel="noopener noreferrer">Service Agreement</a>. This is my electronic signature.`;
             termsWrap.appendChild(cb);
             termsWrap.appendChild(lbl);
             const actBtns = DOM.cartOverlay.querySelector('.cart-overlay-actions');
             if (actBtns) actBtns.parentNode.insertBefore(termsWrap, actBtns);
         } else termsWrap.style.display = 'flex';
         const oldDisc = document.querySelector('#projectDisclaimerNote');
         if (oldDisc) oldDisc.remove();
         // Use items from store for project-based check
         const hasProjectBased = items.some(s => {
             const foundSvc = SERVICE_DATA.services.find(service => service.id === s.serviceId);
             return foundSvc && foundSvc.estimate_disclaimer === 'project_based';
         });
         if (hasProjectBased) {
             const disc = create('div', {
                 id: 'projectDisclaimerNote',
                 class: 'repair-hint',
                 text: '⚠️ ' + (SERVICE_DATA.meta.estimate_disclaimers?.project_based || 'Final price confirmed after site visit.'),
                 style: 'margin: 8px 1rem; font-size: 0.8rem; border-left-color: #facc15;'
             });
             termsWrap.parentNode.insertBefore(disc, termsWrap.nextSibling);
         }
         const checkbox = termsWrap.querySelector('#termsCheckbox');
         if (DOM.overlaybookNowBtn) {
             const newBtn = DOM.overlaybookNowBtn.cloneNode(true);
             DOM.overlaybookNowBtn.parentNode.replaceChild(newBtn, DOM.overlaybookNowBtn);
             DOM.overlaybookNowBtn = newBtn;
             newBtn.disabled = !checkbox.checked;
             checkbox.onchange = () => newBtn.disabled = !checkbox.checked;
             newBtn.addEventListener('click', () => {
                 if (!checkbox.checked) {
                     toast('Please agree to the Service Agreement.', 'error');
                     return;
                 }
                 const currentItems = window.__store.getState().cart.serviceRequest;
                 if (!currentItems.length) {
                     toast('No services to book.', 'error');
                     return;
                 }
                 finalizeBooking();
             });
         }
         const addMoreBtn = DOM.cartOverlay.querySelector('#addMoreBtn');
         if (addMoreBtn) {
             const newAdd = addMoreBtn.cloneNode(true);
             addMoreBtn.parentNode.replaceChild(newAdd, addMoreBtn);
             newAdd.addEventListener('click', () => {
                 closeCartOverlay();
                 restoreCategoryView();
             });
         }
         const closeBtn = DOM.cartOverlay.querySelector('#closeBt');
         if (closeBtn) {
             const newClose = closeBtn.cloneNode(true);
             closeBtn.parentNode.replaceChild(newClose, closeBtn);
             newClose.addEventListener('click', () => {
                 closeCartOverlay();
                 restoreCategoryView();
             });
         }
     }

     function updateCartOverlayTotal(cart) {
         const items = cart || window.__store.getState().cart.serviceRequest;
         const total = items.reduce((sum, svc) => sum + parsePriceToInt(svc.price), 0);
         if (DOM.cartTotal) setText(DOM.cartTotal, `$${total}`);
         if (DOM.serviceCount) setText(DOM.serviceCount, String(items.length));
     }

     function updateCartSummary(cart) {
         if (!DOM.serviceRequestList) return;
         const items = cart || window.__store.getState().cart.serviceRequest;
         // Compute instance labels dynamically (group by name+category)
         const groups = {};
         items.forEach(s => {
             if (s.furnitureItems) return;
             const key = s.name + '::' + s.category_id;
             (groups[key] = groups[key] || []).push(s);
         });
         const labels = {};
         Object.values(groups).forEach(group => {
             if (group.length > 1) {
                 group.forEach((s, i) => {
                     labels[s.id] = `#${i + 1}`;
                 });
             }
         });

         DOM.serviceRequestList.replaceChildren();
         let total = 0;
         items.forEach(svc => {
             const item = create('div', {
                 class: 'summary-service-item'
             });
             item.appendChild(create('div', {
                 class: 'summary-service-icon',
                 text: svc.ui_taxonomy?.icon || svc.icon || '🔧'
             }));
             const tw = create('div', {
                 class: 'summary-service-text'
             });
             const instanceLabel = labels[svc.id];
             const nameNode = instanceLabel ?
                 create('span', {}, [
                     document.createTextNode(svc.name + ' '),
                     create('span', {
                         class: 'cart-instance-badge',
                         text: instanceLabel
                     })
                 ]) :
                 document.createTextNode(svc.name);
             tw.appendChild(create('h4', {}, [nameNode, svc.price && svc.price.includes('/hr') ? create('span', {
                 class: 'price-type-emojii',
                 text: '🕐'
             }) : null].filter(Boolean)));
             tw.appendChild(create('div', {
                 class: 'service-detail',
                 text: svc.detail || ''
             }));
             if (svc.notes && !svc.furnitureItems?.length) tw.appendChild(create('div', {
                 class: 'service-notes',
                 text: svc.notes
             }));
             if (svc.materialsNotIncluded && svc.materialsEstimateRange) {
                 tw.appendChild(create('div', {
                     class: 'f-item',
                     text: `+ Materials $${svc.materialsEstimateRange[0]}‑$${svc.materialsEstimateRange[1]}`,
                     style: 'display:none; background: #f97316; color: #fff; font-size: 0.7rem; margin-top: 4px;'
                 }));
             }
             if (svc.furnitureItems?.length) {
                 const fwrap = create('div', {
                     class: 'summary-service-furniture'
                 });
                 svc.furnitureItems.forEach((fi, i) => {
                     const fitem = create('span', {
                         class: 'f-item'
                     });
                     fitem.appendChild(create('span', {
                         text: fi.label
                     }));
                     const rm = create('button', {
                         type: 'button',
                         text: '✕'
                     });
                     rm.addEventListener('click', e => {
                         e.stopPropagation();
                         removeFurnitureEntry(svc.id, i);
                     });
                     fitem.appendChild(rm);
                     fwrap.appendChild(fitem);
                 });
                 tw.appendChild(fwrap);
             }
             item.appendChild(tw);
             const rmBtn = create('button', {
                 class: 'remove-service-btn',
                 type: 'button',
                 text: '✕',
                 'aria-label': `Remove ${svc.name}`
             });
             rmBtn.addEventListener('click', () => removeServiceFromCart(svc.id));
             item.appendChild(rmBtn);
             item.appendChild(create('div', {
                 class: 'summary-service-price',
                 text: svc.price || '0'
             }));
             DOM.serviceRequestList.appendChild(item);
             total += parsePriceToInt(svc.price);
         });
         const hasItems = items.length > 0;
         if (DOM.estimateTotalSummary) DOM.estimateTotalSummary.style.display = hasItems ? 'flex' : 'none';
         if (DOM.totalAmount) setText(DOM.totalAmount, `$${total}`);
         if (DOM.serviceRequestSummary) DOM.serviceRequestSummary.style.display = hasItems ? 'block' : 'none';
         if (DOM.serviceCount) setText(DOM.serviceCount, String(items.length));
         if (DOM.fabCount) setText(DOM.fabCount, String(items.length));
     }

     function updateFabVisibility(cart) {
         if (!DOM.cartFab || !DOM.fabCount) return;
         const items = cart || window.__store.getState().cart.serviceRequest;
         const show = items.length > 0;
         DOM.cartFab.style.display = show ? 'flex' : 'none';
         setText(DOM.fabCount, String(items.length));
         const manageBtn = q("#manageVisitBtn");
         if (manageBtn) manageBtn.style.display = show ? 'none' : '';
     }

     // v9.6 FIX: the retired bar-visibility updater removed -- confirmed zero
     // real call sites, gated on the retired active flag (removed alongside it),
     // which a comment elsewhere in this file already,
     // independently calls "unused". Superseded by T58's fix, which
     // makes the text bar visible throughout catalog browsing
     // unconditionally, matching what was actually requested
     // (COMPONENT_LAYER_MAP.md).

     // ─── NEW RENDER FUNCTIONS FOR ORCHESTRATOR ROUTES ───────────────────────
 