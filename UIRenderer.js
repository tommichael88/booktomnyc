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
 * (showGroupsForCategory, showSubGroups, selectGroupForCategory) that do
 * NOT exist anywhere in this qr.html (confirmed: zero matches), and
 * misclassified three genuinely pure utility functions
 * (buildOtherTilesForGroup, onSmartQuoteReady, _buildNavCrumbs — all
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
// sqBuildCuratedIntake (AppController.js) and ctxBadge (used by sqBuildAdlib,
// AppController.js). escapeHtml() itself lives here in UIRenderer.js since
// most of ITS OWN functions also build HTML strings, but AppController.js's
// fixed functions call it too — load UIRenderer.js before AppController.js
// for this reason (consistent with the existing DOM-declaration dependency
// note above). Escapes &, <, >, ", and ' — the five characters that matter
// for breaking out of both HTML text content and quoted attribute values.
const escapeHtml = (str) => {
    if (str == null) return '';
    return String(str).replace(/[&<>"\']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
};

// ───────────────────────── Pure utilities (misclassified by an earlier ─────
// ───────────────────────── cross-check document as impure — verified pure  ─
// ───────────────────────── here; shipped alongside UIRenderer for cohesion ─

function buildOtherTilesForGroup(realServices, groupId) {
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
                    const primaryStDef = DB.service_types?.[normalize(primaryType)] || {};

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
                        financial_engine: { pricing_type: 'flat_rate', base_price: primaryStDef.base_price || 0 }
                    }];
                }

function onSmartQuoteReady(fn) {
                    if (smartQuoteReady) {
                        fn();
                    } else {
                        smartQuoteCallbacks.push(fn);
                    }
                }

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
                    exitFocusedMode();
                    container.style.display = 'none';
                    if (DOM.serviceRequestSummary) DOM.serviceRequestSummary.style.display = 'block';
                    DOM.serviceRequestSummary.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
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

function _makePanelShell(svc, category_id, livePriceText) {
                    const displayName = svc.ui_taxonomy?.display_name || svc.display_name || 'Service';
                    const navCrumbs = _buildNavCrumbs(category_id);
                    const startP = svc.financial_engine?.base_price || svc.base_price;
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
                    const basePrice = svc.financial_engine?.base_price || 85;
                    const {
                        panel,
                        navCrumbs,
                        displayName
                    } = _makePanelShell(svc, category_id, `$${basePrice}+`);
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
                    const basePrice = svc.financial_engine?.base_price || 85;
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
                    } = _makePanelShell(svc, category_id, `$${basePrice}+`);
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
                    const startP = svc.financial_engine?.base_price || svc.base_price || 0;
                    const {
                        panel,
                        livePriceEl,
                        navCrumbs,
                        displayName
                    } = _makePanelShell(svc, category_id, startP ? `$${startP}` : '—');
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
                    const discKey = svc.default_estimates?.disclaimer || svc.estimate_disclaimer;
                    const discText = (SERVICE_DATA.meta?.estimate_disclaimers || {})[discKey];
                    const mMin = svc.default_estimates?.materials?.min || 0;
                    const mMax = svc.default_estimates?.materials?.max || 0;
                    const startP = svc.financial_engine?.base_price || svc.base_price;
                    const initPrice = startP ? `$${startP}` : '—';
                    const {
                        panel,
                        livePriceEl,
                        navCrumbs,
                        displayName
                    } = _makePanelShell(svc, category_id, initPrice);
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

function _sqSwitchToRecommended(sku, categoryId) {
                    const svc = (DB.services || []).find(sv => sv.id === sku);
                    if (!svc) return;
                    const catId = categoryId || svc.ui_taxonomy?.category_id || S.intent?.category || null;
                    prefillSmartQuoteFromService(svc, catId);
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
                                        loadGroupView(grp.groups || grp.group);
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
                            /* already at final step, no-op */ }
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
                        const parent = s.ui_taxonomy?.group_id || s.group_id || s.group;
                        if (!parent) return;
                        if (!servicesByGroup.has(parent)) servicesByGroup.set(parent, []);
                        servicesByGroup.get(parent).push(s);
                    });

                    const furnitureSource = data.furniture_catalog || data.furniture_items || [];
                    furnitureSource.forEach(f => {
                        const key = f.article || f.code || f.id;
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
                    const iconEl = create('div', { class: 'service-item-icon', text: groupIcon });
                    const info = document.createElement('div');
                    info.style.cssText = 'width:100%; display:flex; flex-direction:column; align-items:flex-start; gap:3px;';
                    info.appendChild(create('h4', { text: tile.ui_taxonomy?.display_name || 'Other' }));
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
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
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
                    const fe = svc.financial_engine || {};
                    const chain = svc.intake_chain || [];
                    const defaultTags = svc.default_tags || [];
                    const isOtherSvc = defaultTags.some(t => t === '#adhoc' || t === '#manual_review');
                    const requiresSiteVisit = defaultTags.some(t => t === '#site_visit_required');
                    const isDiagSvc = isDiagnosticService(fe); // SSOT: checkout_state drives this, not service_type
                    const isProjectSvc = (fe.base_price || 0) >= 150 || svc.default_estimates?.disclaimer === 'project_based';
                    const isHourlySvc = fe.pricing_type === 'hourly';
                    let complexityBadge = null;
                    if (requiresSiteVisit) {
                        complexityBadge = {
                            text: '🔍 Quote on site',
                            bg: '#374151',
                            color: '#e5e7eb'
                        };
                    } else if (isOtherSvc) {
                        complexityBadge = {
                            text: '⚡ Smart Quote',
                            bg: '#1e40af',
                            color: '#dbeafe'
                        };
                    } else if (isDiagSvc) {
                        // SSOT: badge text from checkout_states[cs].ui_badge_label
                        complexityBadge = {
                            text: resolveServiceBadge(fe),
                            bg: '#374151', color: '#e5e7eb'
                        };
                    } else if (isProjectSvc) {
                        complexityBadge = {
                            text: DB.ui_config?.badge_labels?.['project_based'] || '📐 Project est.',
                            bg: '#7c2d12', color: '#fed7aa'
                        };
                    } else if (isHourlySvc) {
                        complexityBadge = {
                            text: DB.ui_config?.badge_labels?.['hourly'] || '⏰ Hourly',
                            bg: '#000', color: '#d1fae5'
                        };
                    } else if (chain.length === 0) {
                        complexityBadge = {
                            text: resolveServiceBadge(fe),
                            bg: '#166534', color: '#dcfce7'
                        };
                    }
                    let iconText;
                    if (isOtherSvc) {
                        const groupId = svc.ui_taxonomy?.group_id || svc.group_id;
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
                    info.appendChild(titleRow);
                    if (complexityBadge) {
                        const badge = create('span', {
                            text: complexityBadge.text,
                            style: `font-size:.68rem;font-weight:700;padding:2px 8px;border-radius:20px;background:${complexityBadge.bg};color:${complexityBadge.color};display:inline-block;margin-bottom:3px;`
                        });
                        info.appendChild(badge);
                    }
                    info.appendChild(create('div', {
                        class: 'service-price',
                        html: formatServicePrice(svc)
                    }));
                    if (svc.default_estimates?.materials && !svc.materials_included) {
                        const matMin = svc.default_estimates.materials.min || 0;
                        const matMax = svc.default_estimates.materials.max || 0;
                        if (matMax > 0) {
                            info.appendChild(create('div', {
                                class: 'materials-badge',
                                text: `+ Materials $${matMin}‑$${matMax}`,
                                style: 'background: linear-gradient(135deg, #f97316, #ea580c); font-size: 0.7rem; margin-top: 4px;'
                            }));
                        }
                    }
                    let desc = svc.ui_taxonomy?.description || svc.description || 'Tap to customise.';
                    if (svc.materials_included) desc += ' ✓ Materials included.';
                    info.appendChild(create('div', {
                        class: 'service-tile-expanded',
                        text: desc,
                        style: 'display:block;'
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
        else { const t = textBar.firstElementChild; if (t) t.insertAdjacentElement('afterend', previewDiv); else textBar.prepend(previewDiv); }
    }

    // All word-lists from DB.negation_library via window._NLP (initNlpSets called at load)
    const { STOP: STOP_WORDS, PREPS: STOP_PREPS, VERBS: SERVICE_VERBS,
            ROOMS, CONDS: CONDITIONS, VMAP: VERB_PAST_MAP, ACTIONS } = window._NLP || {};

    // Shared spelled-out-number word list — used by extractQty (to detect the
    // count) AND extractObject (to make sure that same word doesn't ALSO get
    // collected into the object-noun text). Without sharing this, "Replace
    // four glass panes" extracted qty=4 correctly but the object noun still
    // included the literal word "four", producing a duplicated, confusing
    // preview: "I need to replace my 4 four glass panes".
    const QTY_WORDS = new Set(['one','two','three','four','five','six','seven','eight','nine','ten']);

    function extractQty(text) {
        const UNITS = 'items?|pieces?|tvs?|signs?|lights?|doors?|shelves?|outlets?|switches?|fixtures?|tiles?|panels?|fans?';
        let m = text.match(new RegExp('\\b(\\d+)\\s*(?:' + UNITS + ')', 'i'));
        if (m) return Math.min(parseInt(m[1]), 99);
        // SSOT: same dimension/measurement guard as the canonical extractQty —
        // a hyphenated word-number followed by a hyphen is part of a compound
        // adjective ("four-poster", "six-foot-tall"), not a standalone count.
        // (?!-) rejects exactly that case while still matching a genuine
        // standalone count word ("I need four doors fixed").
        const wmap = {one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
        for (const [w,n] of Object.entries(wmap)) {
            if (new RegExp('\\b' + w + '\\b(?!-)', 'i').test(text)) return n;
        }
        // Bare-digit fallback: strip dimension/measurement phrases first, so a
        // leftover number ("4-foot", "7-foot-long") isn't misread as a count —
        // a real, live pricing bug (qty multiplies the final price) found by
        // stress-testing real job descriptions containing measurements.
        const DIMENSION_PATTERN = /\b\d+\s*-?\s*(?:foot|feet|ft|inch|inches|in|cm|centimeters?|meters?|yards?|lbs?|pounds?|kg)\b/gi;
        const stripped = text.replace(DIMENSION_PATTERN, ' ');
        m = stripped.match(/\b(\d+)\b/);
        return m ? Math.min(parseInt(m[1]),99) : 1;
    }

    // serviceTypeKey -> legacy lowercase action vocabulary, so existing
    // call sites (buildPreview, extractObject, etc.) that expect 'install'/
    // 'repair'/'assemble'/'service' keep working unchanged.
    const SVC_TYPE_TO_LEGACY_ACTION = {
        'Install': 'install', 'Install / Mount': 'install',
        'Repair': 'repair', 'Diagnostic': 'repair',
        'Assembly': 'assemble', 'Setup': 'assemble'
    };

    function detectAction(text) {
        const l = text.toLowerCase().replace(/\u2019/g,"'");
        // SSOT match first: action_conjugations covers ALL conjugated forms
        // (fixed/fixing/repairs/mounted/etc), not just bare infinitives —
        // this is what fixes "window fixed" being misdetected as 'service'.
        if (ACTIONS && ACTIONS.length) {
            for (const a of ACTIONS) {
                if (a.pattern.test(l)) {
                    if (a.serviceTypeKey) return SVC_TYPE_TO_LEGACY_ACTION[a.serviceTypeKey] || 'service';
                    if (a._extraKey) return a._extraKey; // 'remove' / 'replace'
                }
            }
        }
        // Negation phrasing ("can't", "won't") still implies something's broken -> repair
        if (/\b(can't|cant|won't|wont|doesn't|doesnt)\b/.test(l)) return 'repair';
        if (/\b(unclog|unclogging|unblock|drain)\b/.test(l))      return 'repair';
        // SSOT fallback: any condition phrase already in the JSON (broken,
        // clogged, stuck, cracked, etc. — see negation_library.nlp_condition_phrases)
        // describes a malfunction, which by definition implies repair intent.
        // Fixes "door handle broken" / "sink is clogged" falling through to
        // the generic 'service' bucket even though detectCondition() already
        // recognizes these exact words for the parenthetical condition display.
        if (CONDITIONS && CONDITIONS.some(([pattern]) => l.includes(pattern))) return 'repair';
        return 'service';
    }

    /** detectActionInfinitive — the natural infinitive for "I need to ___"
     *  ad-lib phrasing (e.g. "fix", not "repair" / "repaired"; "mount", not
     *  "install", when the user literally said "mount"). Falls back to a
     *  generic phrase if nothing in the SSOT table matched. */
    function detectActionInfinitive(text) {
        const l = text.toLowerCase().replace(/\u2019/g,"'");
        if (ACTIONS && ACTIONS.length) {
            for (const a of ACTIONS) {
                const m = a.pattern.exec(l);
                if (m) {
                    const matchedWord = m[1].toLowerCase();
                    // Echo back the literal word's own infinitive if the
                    // table defines one (e.g. "mount" -> "mount"), else
                    // fall back to the action's single default infinitive.
                    return (a.wordInfinitiveMap && a.wordInfinitiveMap[matchedWord]) || a.infinitive;
                }
            }
        }
        if (/\b(can't|cant|won't|wont|doesn't|doesnt)\b/.test(l)) return 'fix';
        if (/\b(unclog|unclogging|unblock|drain)\b/.test(l))      return 'fix';
        // SSOT fallback, mirrors detectAction() — see comment there.
        if (CONDITIONS && CONDITIONS.some(([pattern]) => l.includes(pattern))) return 'fix';
        return 'have serviced';
    }

    function extractObject(text) {
        const l = text.toLowerCase().replace(/\u2019/g,"'").replace(/[.,!?;:]/g,' ');
        const words = l.split(/\s+/).filter(Boolean);
        const n = words.length;
        const collect = (start) => {
            const obj = [];
            for (let i = start; i < n && i < start+4; i++) {
                const w = words[i];
                if (STOP_PREPS.has(w)) break;
                if (STOP_WORDS.has(w) || QTY_WORDS.has(w) || /^\d/.test(w)) continue;
                obj.push(w);
            }
            return obj;
        };
        // Pattern 0: <noun> [aux chain] <verb-past> ... — common passive
        // phrasing ("tv mounted on brick wall", "sink is clogged",
        // "ac unit needs to be installed"). The object comes BEFORE the
        // verb here, which none of patterns 1-4 handle (they all assume
        // verb-then-object or "my "-prefixed object), so this phrasing
        // previously fell through to the weak single-word fallback, which
        // could pick the wrong word entirely (e.g. "brick" instead of "tv",
        // or "needs" itself instead of the actual object before it).
        if (ACTIONS && ACTIONS.length) {
            const actionWordIdx = words.findIndex(w => ACTIONS.some(a => a.pattern.test(w)));
            if (actionWordIdx > 0) {
                // Skip back over an entire auxiliary/modal chain, not just
                // one word — "needs to be", "is going to be", "has been"
                // can all precede the actual verb. Without this, "needs"
                // (a modal, not the object) gets collected as if it WERE
                // the object once "to"/"be" are filtered as stop words.
                const AUX_CHAIN = new Set(['is','are','was','were','has','have','had',
                    'be','been','being','to','needs','need','going','will','should','must']);
                let end = actionWordIdx;
                while (end > 0 && AUX_CHAIN.has(words[end - 1])) end--;
                const obj = [];
                for (let i = Math.max(0, end - 3); i < end; i++) {
                    const w = words[i];
                    if (STOP_WORDS.has(w) || STOP_PREPS.has(w) || /^\d/.test(w)) continue;
                    obj.push(w);
                }
                if (obj.length) return obj.join(' ');
            }
        }
        // Pattern 1: <verb> [art] [qty] <noun>
        // SSOT: isServiceVerb (defined in the main script block) also matches
        // hyphenated "re-" forms (re-glue -> reglue) that a raw .has() lookup
        // misses entirely, since tokenization never strips hyphens. Falls back
        // to a plain .has() if isServiceVerb isn't yet defined (defensive only
        // — in practice this module is invoked well after the main script
        // block has run, so the real helper is always available by then).
        const _isVerb = (typeof isServiceVerb === 'function')
            ? (w) => isServiceVerb(w, SERVICE_VERBS)
            : (w) => SERVICE_VERBS.has(w);
        const vi = words.findIndex(w => _isVerb(w));
        if (vi !== -1) {
            let s = vi + 1;
            if (s < n && /^(my|the|a|an|one|your)$/.test(words[s])) s++;
            if (s < n && (QTY_WORDS.has(words[s]) || /^\d/.test(words[s]))) s++;
            const o = collect(s); if (o.length) return o.join(' ');
        }
        // Pattern 2: need [art] [qty] <noun> [done/fixed…]
        const ni = words.findIndex(w => w === 'need');
        if (ni !== -1) {
            let s = ni + 1;
            if (s < n && /^(my|the|a|an|your|this)$/.test(words[s])) s++;
            if (s < n && (QTY_WORDS.has(words[s]) || /^\d/.test(words[s]))) s++;
            // END boundary markers derived from the SAME SSOT action_conjugations
            // table detectAction() uses — was a separately hand-maintained list
            // that could (and did) drift out of sync with the action matcher.
            const END = new Set(['done', 'working', 'cleaned', 'checked']);
            if (ACTIONS && ACTIONS.length) {
                ACTIONS.forEach(a => {
                    const m = a.pattern.source.match(/\(([^)]+)\)/);
                    if (m) m[1].split('|').forEach(f => END.add(f));
                });
            }
            const obj = [];
            for (let i = s; i < n && i < s+4; i++) {
                const w = words[i];
                if (STOP_PREPS.has(w) || END.has(w)) break;
                if (STOP_WORDS.has(w) || QTY_WORDS.has(w) || /^\d/.test(w)) continue;
                obj.push(w);
            }
            if (obj.length) return obj.join(' ');
        }
        // Pattern 3: can't/cant <verb> [art] <noun>
        const ci = words.findIndex(w => /^(cant|can't|cannot)$/.test(w));
        if (ci !== -1) {
            let s = ci + 2;
            if (s < n && /^(my|the|a|an|your)$/.test(words[s])) s++;
            const o = collect(s); if (o.length) return o.join(' ');
        }
        // Pattern 4: my <noun> is <cond>
        const mi = words.findIndex(w => w === 'my');
        if (mi !== -1) {
            let s = mi + 1;
            const obj = [];
            for (let i = s; i < n && i < s+3; i++) {
                const w = words[i];
                if (/^(is|are|was|has|have|will|does)$/.test(w) || STOP_PREPS.has(w)) break;
                if (!STOP_WORDS.has(w) && !/^\d/.test(w)) obj.push(w);
            }
            if (obj.length) return obj.join(' ');
        }
        // Fallback: first content word. length > 2 filters out noise like
        // "a", "in", "to" that slip past STOP_WORDS — but it also wrongly
        // excludes legitimate short nouns like "tv" (2 chars). Allowlist a
        // small set of real short object-words rather than lowering the
        // general threshold, which would let real noise back in.
        const SHORT_OBJECT_ALLOWLIST = new Set(['tv', 'ac']);
        for (const w of words) {
            if (STOP_WORDS.has(w) || STOP_PREPS.has(w) || QTY_WORDS.has(w) || _isVerb(w) || /^\d/.test(w)) continue;
            if (w.length > 2 || SHORT_OBJECT_ALLOWLIST.has(w)) return w;
        }
        return '';
    }

    function extractLocation(text) {
        const l = text.toLowerCase();
        for (const room of ROOMS) { if (l.includes(room)) return room; }
        const m = l.match(/\b(?:in|inside|at)\s+(?:my|the|our|a)?\s*([a-z][a-z]{2,}(?:\s+[a-z]+)?)\b/);
        if (m) { const c = m[1].trim(); if (!STOP_WORDS.has(c) && !SERVICE_VERBS.has(c) && c.length > 2) return c; }
        return null;
    }

    function extractCondition(text) {
        const l = text.toLowerCase().replace(/\u2019/g,"'");
        for (const [pattern, display] of CONDITIONS) { if (l.includes(pattern)) return display; }
        return null;
    }

    // VERB_PAST_MAP sourced from window._NLP.VMAP (DB.negation_library.nlp_verb_past_map)

    function buildPreview(text) {
        const t = text.trim();
        if (!t) return '<span class="preview-empty">✨ Describe your job — we\'ll build a clear request for you</span>';
        const qty  = extractQty(t);
        const infinitive = detectActionInfinitive(t);   // "fix", not "fixed"/"repaired" — grammatically correct after "to"
        const obj  = extractObject(t);
        const loc  = extractLocation(t);
        const cond = extractCondition(t);
        // v9.4 SECURITY FIX (CodeQL: "Incomplete string escaping or encoding"):
        // previously only escaped &, <, > — missing the quote characters needed
        // to safely escape content that might ever land inside an HTML attribute
        // value. Not exploitable today (every esc() call site below lands in
        // plain text content between tags, never inside an attribute), but
        // incomplete escaping is exactly the kind of latent gap that becomes
        // exploitable the moment a future edit moves one of these into an
        // attribute context (e.g. a title="${s}" tooltip). Widened to the same
        // complete 5-character escape set as the shared escapeHtml() utility
        // in block 1 (this is block 0, a separate script-block scope, so it
        // can't reference that one directly — kept self-contained here,
        // consistent with how this block already manages its own utilities).
        const esc  = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

        // SSOT: sentence_start moved to adlib_phrase_overrides.adlib in the
        // JSON consolidation (was ui_config.adlib) — read from new location.
        const adlibCfg = window.DB?.adlib_phrase_overrides?.adlib || {};
        const start = adlibCfg.sentence_start || 'I need';
        const locPrefix = adlibCfg.location_prefix || 'in my';

        // "I need to fix my window" — infinitive-first frame (matches the
        // "I need to ___ my ___" pattern), not "I need window serviced".
        let s = start + ' to ' + infinitive;
        if (obj) {
            s += ' my ';
            if (qty > 1) s += qty + ' ';
            s += esc(obj);
        }
        // Condition phrases come in two grammatical shapes:
        //  - adjective/gerund style ("leaking", "broken", "clogged") fits
        //    "because it is ___" naturally.
        //  - clause style ("can't open", "won't close") is already a full
        //    clause and reads wrong with "because it is" in front of it
        //    ("because it is can't open" is not valid English).
        // Detect clause-style by its leading word and use "because it"
        // (no "is") for those instead.
        if (cond) {
            const isClauseStyle = /^(can't|cant|won't|wont|doesn't|doesnt|cannot)\b/.test(cond);
            s += isClauseStyle ? ' because it ' + esc(cond) : ' because it is ' + esc(cond);
        }
        if (loc)  s += ' ' + locPrefix + ' ' + esc(loc);
        return `<i class="ti ti-sparkles"></i><span class="preview-phrase">${s.trim()}</span><span class="preview-tag">live</span>`;
    }

    /** estimateLiveConfidence — cheap, read-only confidence estimate for the
     *  live-typing strip. NOT the same computation as sqPrepareFlow's full
     *  confidence_strategy pipeline (that needs S state that doesn't exist
     *  until intent is actually set) — this only reads intent_mappings
     *  confidence_weight directly from DB, consistent with "dumb cashier":
     *  reads JSON fields, makes no pricing/routing decisions itself. */
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

    /** renderGotItStrip — the merged Analyze+Builder confirmation UI. Per
     *  spec: confident input shows a brief "Got it: [summary]" strip rather
     *  than re-showing the full chip grid (the user already typed the
     *  details; re-asking via chips would be the nagging this is designed
     *  to avoid). Unconfident input opens the guided builder pre-seeded with
     *  whatever WAS understood, so the user corrects rather than restarts. */
    /** renderUnifiedSqButton — the single button that replaces what used to
     *  be three separate, competing affordances (Analyze, Write it for me,
     *  Got It strip's confirm/edit pair). Confidence alone decides what the
     *  one button does: below threshold, it opens the guided builder (the
     *  builder is the right tool when NLP isn't sure); at or above
     *  threshold, it proceeds with the understood request (no need to make
     *  the user re-confirm via a second control once confidence is high).
     *  A small secondary link covers manually overriding a high-confidence
     *  read that's actually wrong. */
    function renderUnifiedSqButton(confidence, previewText) {
        const btn = document.getElementById('sqUnifiedActionBtn');
        const label = document.getElementById('sqUnifiedActionLabel');
        const overrideLink = document.getElementById('sqManualOverrideLink');
        if (!btn || !label) return;
        const CONFIDENT_THRESHOLD = 55;
        const hasText = !!(previewText && previewText.trim());
        const isConfident = hasText && confidence >= CONFIDENT_THRESHOLD;

        window._sqUnifiedMode = isConfident ? 'confirm' : 'build';
        if (isConfident) {
            label.textContent = 'Looks right — get an estimate';
            btn.classList.add('sq-unified-confident');
            if (overrideLink) overrideLink.style.display = 'block';
        } else {
            label.textContent = hasText ? 'Get an estimate' : 'Describe your job step by step';
            btn.classList.remove('sq-unified-confident');
            if (overrideLink) overrideLink.style.display = 'none';
        }
    }

    let _tid;
    function update() {
        clearTimeout(_tid);
        _tid = setTimeout(() => {
            const text = textarea.value;
            previewDiv.innerHTML = buildPreview(text);
            const conf = estimateLiveConfidence(text);
            const phraseMatch = previewDiv.innerHTML.match(/preview-phrase">([^<]+)</);
            renderUnifiedSqButton(conf, phraseMatch ? phraseMatch[1] : null);
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

function enterFocusedMode() {
                    const card = document.querySelector('.main-card-schedule-service');
                    if (!card) return;
                    card.classList.add('focused-mode');
                    document.body.classList.add('modal-active');
                    ensureFocusedModeInner(card);
                    const inner = card.querySelector('.focused-mode-inner');
                    if (inner) inner.scrollTop = 0;
                    // Explicitly hide viewport-wasting elements (CSS covers them too,
                    // but JS inline display overrides CSS so we set important here)
                    ['sqTextBar', 'serviceRequestSummary'].forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.style.setProperty('display', 'none', 'important');
                    });
                }

function exitFocusedMode() {
                    const card = document.querySelector('.main-card-schedule-service');
                    if (!card) return;
                    card.classList.remove('focused-mode');
                    const inner = card.querySelector('.focused-mode-inner');
                    if (inner) {
                        Array.from(inner.children).forEach(c => card.insertBefore(c, inner));
                        inner.remove();
                    }
                    document.body.classList.remove('modal-active');
                    // Restore elements hidden during focused mode
                    const sqTB = document.getElementById('sqTextBar');
                    if (sqTB) sqTB.style.removeProperty('display');
                    // serviceRequestSummary visibility is managed by cart state — handled by restoreCategoryView
                    const srs = document.getElementById('serviceRequestSummary');
                    if (srs) srs.style.removeProperty('display');
                }

async function init() {
                    cacheDOM();
                    try {
                        const res = await fetch('https://tommichael88.github.io/booktomnyc/btnyc.json');
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        SERVICE_DATA = await res.json();
                        // resolveRefs DISABLED: it was expanding $ref objects
                        // (e.g. {"$ref":"#plumbing"}) to the full tag object, but
                        // every consumer in the JS (prefillSmartQuoteFromService,
                        // prefillSmartQuoteFromOtherTile, detectIntentNLP, etc.)
                        // extracts the tag ID by reading tagRef.$ref as a string.
                        // After expansion, tagRef.$ref is undefined → tag is
                        // silently dropped → default_tags and suggested_tags never
                        // populate S.detTagIds. All other $ref contexts (synonyms,
                        // derived_from, requires) are also never read in expanded
                        // form by any JS code, so resolveRefs provided no benefit
                        // while actively breaking the most critical data paths.
                        // SERVICE_DATA = resolveRefs(SERVICE_DATA); // ← broken, do not re-enable
                        DB = SERVICE_DATA; // for SmartQuote engine
                        window.DB = DB;    // expose globally for SSOT helpers
                        initNlpSets();     // build NLP sets from DB.negation_library
                    } catch (err) {
                        console.error('Service data load error:', err);
                        toast('Could not load services. Please refresh.', 'error');
                        SERVICE_DATA = {
                            meta: {},
                            category: [],
                            group: [],
                            services: [],
                            intake_modules: {}
                        };
                        DB = SERVICE_DATA;
                    }
                    buildDataMaps(SERVICE_DATA);
                    renderCategoryCards();
                    wireGlobalEvents();
                    renderCart();
                    if (DOM.serviceRequestSummary) DOM.serviceRequestSummary.style.display = State.serviceRequest.length ? 'block' : 'none';
                    setViewportHeight();
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

function persistCart() {
                    try {
                        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(State.serviceRequest));
                    } catch (_) {}
                }

const q = (sel, ctx = document) => (ctx || document).querySelector(sel);

const qAll = (sel, ctx = document) => Array.from((ctx || document).querySelectorAll(sel));

function renderCart() {
                    updateFabVisibility();
                    updateCartSummary();
                    updateCartOverlayTotal();
                    if (DOM.cartOverlay && DOM.cartOverlay.style.display === 'flex') updateCartOverlayIfOpen();
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
                        card.appendChild(create('div', {
                            class: 'category-icon',
                            text: cat.icon
                        }));
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
                    const otherTiles = buildOtherTilesForGroup(services || [], group_id);
                    const allTiles = [...(services || []), ...otherTiles];
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

function renderUnifiedSqButton(confidence, previewText) {
        const btn = document.getElementById('sqUnifiedActionBtn');
        const label = document.getElementById('sqUnifiedActionLabel');
        const overrideLink = document.getElementById('sqManualOverrideLink');
        if (!btn || !label) return;
        const CONFIDENT_THRESHOLD = 55;
        const hasText = !!(previewText && previewText.trim());
        const isConfident = hasText && confidence >= CONFIDENT_THRESHOLD;

        window._sqUnifiedMode = isConfident ? 'confirm' : 'build';
        if (isConfident) {
            label.textContent = 'Looks right — get an estimate';
            btn.classList.add('sq-unified-confident');
            if (overrideLink) overrideLink.style.display = 'block';
        } else {
            label.textContent = hasText ? 'Get an estimate' : 'Describe your job step by step';
            btn.classList.remove('sq-unified-confident');
            if (overrideLink) overrideLink.style.display = 'none';
        }
    }

function restoreCategoryView() {
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
                    // check works (live style.display, not the unused __sqActive
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
                    if (DOM.serviceRequestSummary) DOM.serviceRequestSummary.style.display = State.serviceRequest.length ? 'block' : 'none';
                    updateFabVisibility();
                    const stepFlow = document.getElementById('stepFlow');
                    if (stepFlow) stepFlow.style.display = 'none';
                    const quoteOut = document.getElementById('quoteOut');
                    if (quoteOut) quoteOut.innerHTML = '';
                }

const setText = (el, text) => {
                    if (el) el.textContent = text;
                }

function setViewportHeight() {
                    const vh = window.innerHeight * 0.01;
                    document.documentElement.style.setProperty('--vh', `${vh}px`);
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

function sqAddToCart() {
                    if (!cartLimiter.isAllowed('add')) {
                        toast('Adding too fast.', 'error');
                        return;
                    }
                    const q = computeQuoteFromState();
                    addToCart({
                        id: 'sq-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
                        serviceId: S.intent?.key || 'smartquote',
                        category_id: S.intent?.category || 'other',
                        name: (S.intent?.label || 'Service') + (S.intent?.group && S.intent.group !== S.intent.label ? ' – ' + S.intent.group : ''),
                        price: '$' + q.laborCalc,
                        icon: '⚡',
                        detail: S.desc?.substring(0, 80) || 'SmartQuote estimate',
                        notes: 'SmartQuote · ' + (S.desc || '') + (q.activeLabels.length ? '\nConditions: ' + q.activeLabels.join(', ') : '') +
                            (S._location ? '\nLocation: ' + S._location : '') + (S._objectNoun ? '\nItem: ' + S._objectNoun : ''),
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
                    sqBuilderRender();
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

function sqHandleStep2() {
                    if (!S.stype) return;
                    sqMarkDone(2, S.stype);
                    sqBuildStep3();
                    sqMarkDone(3, S.stype);

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

function sqOpenBuilderPreseeded({ action, groupId, categoryLabel, allowedTypes }) {
                    const builder = document.getElementById('sqBuilder');
                    const inlineRow = document.querySelector('#sqTextBar .sq-inline-row');
                    if (builder) builder.style.display = 'block';
                    if (inlineRow) inlineRow.style.display = 'none';

                    const groupObj = groupId ? groupMap.get(groupId) : null;

                    BLD = {
                        step: 0,
                        action,
                        // Group is already known from navigation — seed it directly
                        // as the object value, skipping the redundant "what is it?"
                        // step (we already know the category AND the group; only
                        // the specific item/condition/location remain unknown).
                        object: groupId || null,
                        specific: null,
                        condition: null,
                        location: null,
                        qty: 1,
                        _stype: S.stype || null,
                        _cat: S.intent?.category || null,
                        // _groupId/_keyword normally only get set inside
                        // sqBuilderChoose() when a chip is tapped — since this
                        // pre-seed bypasses that tap, set them directly here so
                        // sqBuilderFinish() resolves the same way a real chip-tap
                        // on this group would have.
                        _groupId: groupId || null,
                        _keyword: groupId ? bldGroupToKeyword(groupId, S.intent?.category) : null,
                        _fromOtherTile: true,
                        _contextLabel: categoryLabel || null,
                        _objectLabel: groupObj?.display_name || null,
                        // Narrows the action step's chips when the tile carried
                        // multiple possible types (see buildOtherTilesForGroup) —
                        // null/empty means "no narrowing, show everything" (fresh
                        // or free-text-seeded sessions).
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

function sqOpenStep(n) {
                    // Allow tapping a done step header to re-expand it
                    [2, 3].forEach(i => {
                        const b = document.getElementById('sqSb' + i);
                        if (b && i !== n) b.style.display = 'none';
                    });
                    const b = document.getElementById('sqSb' + n);
                    if (b) b.style.display = b.style.display === 'none' ? 'block' : 'none';
                }

function sqRenderQuote() {
                    const q = computeQuoteFromState();
                    const out = document.getElementById('sqQuoteOut');
                    if (!out) return;

                    // SSOT: badge from checkout_states (single source — see resolveServiceBadge)
                    const badge = resolveServiceBadge({ checkout_state: q.checkoutStateKey, pricing_type: S.intent?._pricingType });

                    const svcLabel = S.intent?.label || 'Service';
                    const qtyLabel = S.intent?.qtyLabel || 'item';

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
                    if (S._autoSelectedFrom) {
                        _recBanner =
                            '<div style="margin-bottom:14px;padding:12px 16px;background:rgba(45,138,45,.08);border-radius:10px;border:1.5px solid rgba(45,138,45,.3);font-size:13.5px;display:flex;align-items:center;gap:10px;">' +
                            '<i class="ti ti-circle-check-filled" style="color:#2d8a2d;font-size:19px;flex-shrink:0"></i>' +
                            '<div style="flex:1;min-width:0;"><strong style="color:#1a3d1a;">Matched to an exact service</strong> — this gives a more precise quote than a general estimate.' +
                            '<button type="button" onclick="window._sqRevertAutoSelect()" style="background:none;border:none;color:#888;font-size:12px;text-decoration:underline;cursor:pointer;padding:0;margin-left:8px;">Not this? Use general estimate</button></div>' +
                            '</div>';
                    } else {
                        // SSOT: if NLP matched a specific service SKU but confidence
                        // didn't clear the auto-select bar, still offer to switch —
                        // same underlying action (_sqSwitchToRecommended), just framed
                        // as a suggestion rather than something already done for them.
                        const _recSku = S.intent?.recommendedSku;
                        const _recSvc = _recSku ? (DB.services || []).find(sv => sv.id === _recSku) : null;
                        const _recCatId = S.intent?.category || _recSvc?.ui_taxonomy?.category_id || null;
                        _recBanner = _recSvc ?
                            '<div style="margin-bottom:12px;padding:10px 14px;background:rgba(222,0,0,.06);border-radius:10px;border:1px solid rgba(222,0,0,.2);font-size:13px;display:flex;align-items:center;gap:10px;">' +
                            '<i class="ti ti-star" style="color:var(--clr-red,#de0000);font-size:15px;flex-shrink:0"></i>' +
                            '<div style="flex:1;min-width:0;"><strong>Possible match:</strong> ' + (_recSvc.ui_taxonomy?.display_name || _recSku) +
                            ' <span style="color:#888;font-size:12px;">— may give a more precise quote</span></div>' +
                            '<button type="button" onclick="window._sqSwitchToRecommended(\'' + _recSku.replace(/'/g, "\\'") + '\',\'' + (_recCatId || '').replace(/'/g, "\\'") + '\')" ' +
                            'style="flex-shrink:0;background:var(--clr-red-dark,#8a0615);color:#fff;border:none;border-radius:7px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">Use this</button>' +
                            '</div>' :
                            '';
                    }

                    const extraFeeRow = q.extraFee ?
                        '<div class="ql"><span class="qll"><i class="ti ti-adjustments-alt"></i> Condition adjustments</span>' +
                        '<span class="qlv ' + (q.extraFee < 0 ? 'g' : '') + '">' + (q.extraFee >= 0 ? '+' : '') + '$' + q.extraFee + '</span></div>' :
                        '';

                    const tagsRow = q.activeLabels.length ?
                        '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:16px">' +
                        q.activeLabels.map(l => '<span class="chip gtag" style="cursor:default;font-size:12px;padding:4px 12px"><i class="ti ti-check"></i> ' + l + '</span>').join('') +
                        '</div>' :
                        '';

                    out.innerHTML = _recBanner +
                        '<div class="qpanel">' +
                        '<div class="qhero">' +
                        '<div class="qitag">' + badge + '</div>' +
                        '<div class="' + (q.isProject ? 'qpranger' : 'qprice') + '">' + q.priceDisplay + '</div>' +
                        '<div class="qpsub">' + q.priceSub + '</div>' +
                        '<div class="qmeta"><i class="ti ti-tool"></i> ' + svcLabel + ' &middot; ' + S.stype + '</div>' +
                        '</div>' +
                        '<div class="qbody">' +
                        '<div class="qlines">' +
                        '<div class="ql"><span class="qll"><i class="ti ti-receipt"></i> Base ' + (S.stype || 'service').toLowerCase() + '</span><span class="qlv">$' + q.base + '</span></div>' +
                        extraFeeRow +
                        timeLine +
                        '<div class="ql"><span class="qll"><i class="ti ti-stack-2"></i> Quantity</span><span class="qlv">' + S.qty + ' ' + qtyLabel + '</span></div>' +
                        '<div class="ql"><span class="qll"><i class="ti ti-car"></i> ' + (DB.global_rules?.surcharges?.dispatch_label||'Dispatch fee') + '</span><span class="qlv m">+$' + q.dispatch + ' &middot; ' + (DB.global_rules?.surcharges?.dispatch_scope_note||'once per visit') + '</span></div>' +
                        '<div class="ql" style="margin-top:8px;border-bottom:none">' +
                        '<span class="qll" style="font-weight:600;font-size:15px">Total labor</span>' +
                        '<span class="qlv" style="font-size:20px;font-weight:700;color:var(--clr-red-dark,#8a0615)">$' + q.laborCalc + (q.isDiag || q.isProject ? ' (est.)' : '') + '</span>' +
                        '</div>' +
                        '</div>' +
                        tagsRow +
                        '<div class="disc"><i class="ti ti-info-circle"></i><div>' + q.disclaimerText + '</div></div>' +
                        '</div>' +
                        '<div class="ctarow">' +
                        '<button class="ctap" onclick="sqAddToCart()"><i class="ti ti-shopping-cart" style="font-size:18px"></i> ' + btnLabel + '</button>' +
                        '<button class="ctag" onclick="sqRestart()"><i class="ti ti-refresh"></i> Start Over</button>' +
                        '</div>' +
                        '</div>';

                    out.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
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
                    document.getElementById('sqDynGroups').innerHTML = '';
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
                    const isOpen = builder.style.display !== 'none';

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
                            let synth = obj ? `I need to ${act} my ${obj}` : act ? `I need to ${act}` : '';
                            if (synth && cond) synth += ` because it is ${cond}`;
                            if (synth && loc) synth += ` in my ${loc}`;
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
                            const intent = detectIntentNLP(existingText);
                            const objNoun = extractObject(existingText, intent?.key);
                            const loc = extractLocation(existingText);

                            // Map intent stype → builder action value
                            const stypeToAction = {
                                Install: 'install',
                                'Install / Mount': 'mount',
                                Repair: 'fix',
                                Diagnostic: 'look at',
                                Assembly: 'assemble',
                                Setup: 'set up'
                            };
                            const detectedAction = stypeToAction[intent?.stype] || null;

                            // Reset BLD and seed from NLP
                            BLD = {
                                step: 0,
                                action: detectedAction,
                                object: objNoun || null,
                                specific: null,
                                condition: null,
                                location: loc || null,
                                qty: extractQty(existingText),
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
                    // Any text goes through sqAnalyze, which routes to:
                    // 1. Named service auto-select (high confidence + recommendedSku)
                    // 2. Best-match group Other tile (category known, no specific match)
                    // 3. Generic SmartQuote wizard (low confidence / unknown category)
                    // The user never needs to know which path ran — it just works.
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

function update() {
        clearTimeout(_tid);
        _tid = setTimeout(() => {
            const text = textarea.value;
            previewDiv.innerHTML = buildPreview(text);
            const conf = estimateLiveConfidence(text);
            const phraseMatch = previewDiv.innerHTML.match(/preview-phrase">([^<]+)</);
            renderUnifiedSqButton(conf, phraseMatch ? phraseMatch[1] : null);
        }, 80);
    }

function updateCartOverlayIfOpen() {
                    if (!DOM.cartOverlay || DOM.cartOverlay.style.display !== 'flex') return;
                    const list = DOM.cartServiceList;
                    if (!list) return;
                    const totalItems = State.serviceRequest.length;
                    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
                    if (cartCurrentPage > totalPages && totalPages > 0) cartCurrentPage = totalPages;
                    if (totalPages === 0) cartCurrentPage = 1;
                    const start = (cartCurrentPage - 1) * ITEMS_PER_PAGE;
                    const pageItems = State.serviceRequest.slice(start, start + ITEMS_PER_PAGE);
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
                        // v9.1: same instance-label badge as updateCartSummary —
                        // see addToCart() for why this exists.
                        const ovNameNode = svc._instanceLabel
                            ? create('span', {}, [
                                document.createTextNode(svc.name + ' '),
                                create('span', { class: 'cart-instance-badge', text: svc._instanceLabel })
                            ])
                            : document.createTextNode(svc.name);
                        tw.appendChild(create('h4', {}, [ovNameNode]));
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
                    const hasProjectBased = State.serviceRequest.some(s => {
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
                            if (!State.serviceRequest.length) {
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

function updateCartOverlayTotal() {
                    const total = State.serviceRequest.reduce((sum, svc) => sum + parsePriceToInt(svc.price), 0);
                    if (DOM.cartTotal) setText(DOM.cartTotal, `$${total}`);
                    if (DOM.serviceCount) setText(DOM.serviceCount, String(State.serviceRequest.length));
                }

function updateCartSummary() {
                    if (!DOM.serviceRequestList) return;
                    DOM.serviceRequestList.replaceChildren();
                    let total = 0;
                    State.serviceRequest.forEach(svc => {
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
                        // v9.1: when two cart entries share name+category+price but
                        // have different notes/context (e.g. "Mount TV" in the
                        // living room vs. the bedroom), addToCart() tags each with
                        // an _instanceLabel ('#1', '#2'...) instead of silently
                        // merging them into one qty count and losing the first
                        // entry's location. Render that label as a small badge so
                        // the distinction is actually visible, not just tracked
                        // internally — this is the fix for the reported bug where
                        // two genuinely different requests looked identical in cart.
                        const nameNode = svc._instanceLabel
                            ? create('span', {}, [
                                document.createTextNode(svc.name + ' '),
                                create('span', { class: 'cart-instance-badge', text: svc._instanceLabel })
                            ])
                            : document.createTextNode(svc.name);
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
                    const hasItems = State.serviceRequest.length > 0;
                    if (DOM.estimateTotalSummary) DOM.estimateTotalSummary.style.display = hasItems ? 'flex' : 'none';
                    if (DOM.totalAmount) setText(DOM.totalAmount, `$${total}`);
                    if (DOM.serviceRequestSummary) DOM.serviceRequestSummary.style.display = hasItems ? 'block' : 'none';
                    if (DOM.serviceCount) setText(DOM.serviceCount, String(State.serviceRequest.length));
                    if (DOM.fabCount) setText(DOM.fabCount, String(State.serviceRequest.length));
                    persistCart();
                }

function updateFabVisibility() {
                    if (!DOM.cartFab || !DOM.fabCount) return;
                    const show = State.serviceRequest.length > 0;
                    DOM.cartFab.style.display = show ? 'flex' : 'none';
                    setText(DOM.fabCount, String(State.serviceRequest.length));
                    const manageBtn = q("#manageVisitBtn");
                    if (manageBtn) manageBtn.style.display = show ? 'none' : '';
                }

function updateSmartQuoteBarVisibility() {
                    const bar = document.getElementById('sqTextBar');
                    if (!bar) return;
                    const isFocused = document.querySelector('.main-card-schedule-service.focused-mode') !== null;
                    // Visible when: (not in focused mode) OR (focused mode AND __sqActive === true)
                    const shouldShow = !isFocused || (isFocused && __sqActive);
                    bar.style.display = shouldShow ? 'block' : 'none';
                }
