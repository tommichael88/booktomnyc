<script>
const DATA_URL = "https://tommichael88.github.io/booktomnyc/services.json";

function getFirst(...vals) {
    for (const v of vals) if (v !== undefined && v !== null) return v;
    return undefined;
}

function arr(v) {
    if (!v) return [];
    return Array.isArray(v) ? v : [v];
}

function normalizePricing(raw) {
    const p = getFirst(raw.pricing, raw.pricing_v2, {}) || {};
    return {
        type: p.type || null,
        base: p.base_price ?? null,
        rate: p.rate_per_hour ?? null,
        minHours: p.min_hours ?? null,
        maxHours: p.max_hours ?? null,
        blockHours: p.flat_block_hours ?? null,
        modifiers: arr(p.modifier_questions),
        adjustments: p.global_adjustments || {},
        materials: p.materials_estimate || { range: [0, 0], note: "" },
        estimate: p.total_estimate_range || null,
        disclaimer: p.estimate_disclaimer || null
    };
}

function normalizeIntake(raw) {
    return arr(
        (raw.intake && raw.intake.questions) ||
        (raw.intake_v2 && raw.intake_v2.questions)
    );
}

function normalizeFurniture(raw) {
    return {
        required: !!raw.requires_furniture_selection,
        items: arr(raw.furniture_items),
        paxConfig: raw.pax_config || null
    };
}

function normalizeService(raw) {
    const pricing = normalizePricing(raw);
    const intake = normalizeIntake(raw);
    const furniture = normalizeFurniture(raw);
    const materialsIncluded =
        raw.materials_included === true ||
        (pricing.materials.range &&
         Array.isArray(pricing.materials.range) &&
         pricing.materials.range.some(v => v > 0));
    return {
        id: raw.id,
        name: raw.name,
        category: raw.category,
        group: raw.group,
        icon: raw.icon,
        description: raw.description || "",
        details: arr(raw.details),
        detailPrompt: raw.detail_prompt || "",
        materialsIncluded,
        pricing,
        intake,
        furniture,
        conditions: arr(raw.conditional_adjustments_v2),
        raw
    };
}

function estimateServicePrice(service) {
    const est = service.pricing.estimate;
    if (est && (est.min != null || est.max != null)) {
        if (est.min != null && est.max != null) return (est.min + est.max) / 2;
        if (est.min != null) return est.min;
        if (est.max != null) return est.max;
    }
    if (service.pricing.base != null) return service.pricing.base;
    return 0;
}

function createCartItem(service, selections) {
    return {
        id: crypto.randomUUID(),
        serviceId: service.id,
        name: service.name,
        category: service.category,
        group: service.group,
        pricing: service.pricing,
        materialsIncluded: service.materialsIncluded,
        intakeAnswers: selections.intake || {},
        modifierAnswers: selections.modifiers || {},
        furniture: selections.furniture || [],
        notes: selections.notes || "",
        estimate: estimateServicePrice(service)
    };
}

let RAW_DATA = null;
let CATEGORIES = [];
let GROUPS = [];
let SERVICES = [];
let SERVICES_BY_ID = new Map();

let selectedCategoryId = null;
let selectedGroupId = null;
let selectedServiceId = null;

let CART = [];

function renderMaterialsBadge(service) {
    if (!service.materialsIncluded) return "";
    return `<span class="badge badge-materials">Materials Included</span>`;
}

function renderEstimate(service) {
    const est = service.pricing.estimate;
    if (!est) return "";
    const min = est.min ?? null;
    const max = est.max ?? null;
    const note = est.note || "";
    if (min == null && max == null) return "";
    const label =
        min != null && max != null
            ? `$${min}–$${max}`
            : min != null
            ? `From $${min}`
            : `Up to $${max}`;
    return `<div class="estimate">
                <span class="estimate-label">${label}</span>
                ${note ? `<div class="estimate-note">${note}</div>` : ""}
            </div>`;
}

function renderServiceCard(service) {
    return `
        <div class="service-card" data-service-id="${service.id}">
            <div class="service-header">
                <span class="service-icon">${service.icon || ""}</span>
                <h3 class="service-name">${service.name}</h3>
            </div>
            <p class="service-description">${service.description}</p>
            <div class="service-meta">
                ${renderMaterialsBadge(service)}
                ${renderEstimate(service)}
            </div>
        </div>
    `;
}

function renderCategoryCard(cat) {
    return `
        <div class="category-card" data-category-id="${cat.id}">
            <span class="category-icon">${cat.icon || ""}</span>
            <span class="category-name">${cat.name}</span>
        </div>
    `;
}

function renderGroupCard(group) {
    return `
        <div class="group-card" data-group-id="${group.id}">
            <span class="group-icon">${group.icon || ""}</span>
            <span class="group-name">${group.name}</span>
        </div>
    `;
}

function renderIntake(service) {
    if (!service.intake.length) return "";
    return service.intake
        .map(q => {
            const id = q.id || q.question_id || Math.random().toString(36).slice(2);
            const label = q.label || id;
            return `
                <div class="intake-question">
                    <label for="intake-${id}">${label}</label>
                    <input id="intake-${id}" data-intake-id="${id}" type="text" />
                </div>
            `;
        })
        .join("");
}

function renderModifierQuestions(service) {
    const mods = service.pricing.modifiers;
    if (!mods.length) return "";
    return mods
        .map(mq => {
            const id = mq.question_id || Math.random().toString(36).slice(2);
            const label = mq.label || id;
            return `
                <div class="modifier-question">
                    <label for="mod-${id}">${label}</label>
                    <select id="mod-${id}" data-mod-id="${id}">
                        ${(mq.options || [])
                            .map(opt => {
                                const val = typeof opt === "string" ? opt : opt.value || opt.label;
                                const text = typeof opt === "string" ? opt : opt.label || opt.value;
                                return `<option value="${val}">${text}</option>`;
                            })
                            .join("")}
                    </select>
                </div>
            `;
        })
        .join("");
}

function renderFurnitureSection(service) {
    if (!service.furniture.required && !service.furniture.items.length) return "";
    const itemsHtml = service.furniture.items
        .map((it, idx) => {
            const name = it.name || `Item ${idx + 1}`;
            return `
                <div class="furniture-item">
                    <label>
                        <input type="checkbox" data-furniture-index="${idx}" />
                        ${name}
                    </label>
                </div>
            `;
        })
        .join("");
    return `
        <div class="furniture-section">
            <h4>Furniture</h4>
            ${itemsHtml}
        </div>
    `;
}

function buildCategoryView() {
    const container = document.getElementById("category-card");
    if (!container) return;
    container.innerHTML = CATEGORIES.map(renderCategoryCard).join("");
    container.querySelectorAll(".category-card").forEach(el => {
        el.addEventListener("click", () => {
            selectedCategoryId = el.getAttribute("data-category-id");
            selectedGroupId = null;
            selectedServiceId = null;
            updateStepDots(1);
            buildGroupView();
            document.getElementById("serviceContainer").innerHTML = "";
            document.getElementById("intakeQuestionsContainer").style.display = "none";
        });
    });
}

function buildGroupView() {
    const container = document.getElementById("serviceContainer");
    if (!container) return;
    const groupsForCat = GROUPS.filter(g => g.category === selectedCategoryId);
    container.innerHTML = groupsForCat.map(renderGroupCard).join("");
    container.querySelectorAll(".group-card").forEach(el => {
        el.addEventListener("click", () => {
            selectedGroupId = el.getAttribute("data-group-id");
            selectedServiceId = null;
            updateStepDots(2);
            buildServiceView();
            document.getElementById("intakeQuestionsContainer").style.display = "none";
        });
    });
}

function buildServiceView() {
    const container = document.getElementById("serviceContainer");
    if (!container) return;
    const servicesForGroup = SERVICES.filter(s => s.group === selectedGroupId);
    container.innerHTML = servicesForGroup.map(renderServiceCard).join("");
    container.querySelectorAll(".service-card").forEach(el => {
        el.addEventListener("click", () => {
            const id = el.getAttribute("data-service-id");
            selectedServiceId = id;
            updateStepDots(3);
            buildIntakeView();
        });
    });
}

function buildIntakeView() {
    const container = document.getElementById("intakeQuestionsContainer");
    if (!container || !selectedServiceId) return;
    const service = SERVICES_BY_ID.get(selectedServiceId);
    if (!service) return;
    const html = `
        <div class="intake-wrapper">
            <h4>Details for: ${service.name}</h4>
            ${renderIntake(service)}
            ${renderModifierQuestions(service)}
            ${renderFurnitureSection(service)}
            <button id="addToCartBtn" class="book-now-button">Add to Request</button>
        </div>
    `;
    container.innerHTML = html;
    container.style.display = "block";
    updateStepDots(4);
    const btn = document.getElementById("addToCartBtn");
    if (btn) {
        btn.addEventListener("click", () => {
            addCurrentServiceToCart();
        });
    }
}

function collectSelectionsForService(service) {
    const intakeAnswers = {};
    service.intake.forEach(q => {
        const id = q.id || q.question_id || "";
        if (!id) return;
        const el = document.querySelector(`[data-intake-id="${id}"]`);
        if (el) intakeAnswers[id] = el.value;
    });
    const modifierAnswers = {};
    service.pricing.modifiers.forEach(mq => {
        const id = mq.question_id || "";
        if (!id) return;
        const el = document.querySelector(`[data-mod-id="${id}"]`);
        if (el) modifierAnswers[id] = el.value;
    });
    const furnitureSelections = [];
    const container = document.getElementById("intakeQuestionsContainer");
    if (container) {
        container.querySelectorAll("[data-furniture-index]").forEach(el => {
            if (el.checked) {
                const idx = parseInt(el.getAttribute("data-furniture-index"), 10);
                const item = service.furniture.items[idx];
                if (item) furnitureSelections.push(item);
            }
        });
    }
    return {
        intake: intakeAnswers,
        modifiers: modifierAnswers,
        furniture: furnitureSelections,
        notes: ""
    };
}

function addCurrentServiceToCart() {
    if (!selectedServiceId) return;
    const service = SERVICES_BY_ID.get(selectedServiceId);
    if (!service) return;
    const selections = collectSelectionsForService(service);
    const item = createCartItem(service, selections);
    CART.push(item);
    persistCart();
    updateCartUI();
    updateSummaryUI();
    showFabIfNeeded();
}

function renderCartItem(item, index) {
    return `
        <div class="cart-item" data-cart-index="${index}">
            <div class="cart-item-main">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-estimate">$${item.estimate.toFixed(2)}</div>
            </div>
            <button class="cart-item-remove">Remove</button>
        </div>
    `;
}

function updateCartUI() {
    const list = document.getElementById("cartServiceList");
    const totalEl = document.getElementById("cartTotal");
    const countEl = document.getElementById("serviceCount");
    const fabCount = document.getElementById("fabCartCount");
    if (!list || !totalEl || !countEl || !fabCount) return;
    list.innerHTML = CART.map(renderCartItem).join("");
    let total = 0;
    CART.forEach(i => total += i.estimate);
    totalEl.textContent = `$${total.toFixed(2)}`;
    countEl.textContent = CART.length.toString();
    fabCount.textContent = CART.length.toString();
    list.querySelectorAll(".cart-item-remove").forEach(btn => {
        btn.addEventListener("click", () => {
            const parent = btn.closest(".cart-item");
            if (!parent) return;
            const idx = parseInt(parent.getAttribute("data-cart-index"), 10);
            if (!isNaN(idx)) {
                CART.splice(idx, 1);
                persistCart();
                updateCartUI();
                updateSummaryUI();
                showFabIfNeeded();
            }
        });
    });
    const finalBookBtn = document.getElementById("finalBookBtn");
    if (finalBookBtn) finalBookBtn.disabled = CART.length === 0;
}

function renderSummaryItem(item) {
    return `
        <div class="summary-item">
            <div class="summary-title">${item.name}</div>
            <div class="summary-estimate">$${item.estimate.toFixed(2)}</div>
        </div>
    `;
}

function updateSummaryUI() {
    const container = document.getElementById("serviceRequestList");
    const totalEl = document.getElementById("totalAmount");
    const wrapper = document.getElementById("serviceRequestSummary");
    const estWrap = document.getElementById("estimateTotalSummary");
    if (!container || !totalEl || !wrapper || !estWrap) return;
    if (!CART.length) {
        wrapper.style.display = "none";
        estWrap.style.display = "none";
        return;
    }
    wrapper.style.display = "block";
    estWrap.style.display = "block";
    container.innerHTML = CART.map(renderSummaryItem).join("");
    let total = 0;
    CART.forEach(i => total += i.estimate);
    totalEl.textContent = `$${total.toFixed(2)}`;
}

function showFabIfNeeded() {
    const fab = document.getElementById("cartFab");
    if (!fab) return;
    fab.style.display = CART.length ? "flex" : "none";
}

function updateStepDots(step) {
    const steps = [
        document.getElementById("step1dot"),
        document.getElementById("step2dot"),
        document.getElementById("step3dot"),
        document.getElementById("step4dot")
    ];
    const conns = [
        document.getElementById("conn1"),
        document.getElementById("conn2"),
        document.getElementById("conn3")
    ];
    steps.forEach((dot, idx) => {
        if (!dot) return;
        dot.classList.remove("active", "completed");
        if (idx + 1 < step) dot.classList.add("completed");
        if (idx + 1 === step) dot.classList.add("active");
    });
    conns.forEach((c, idx) => {
        if (!c) return;
        c.classList.remove("completed");
        if (idx + 1 < step) c.classList.add("completed");
    });
}

function openCartOverlay() {
    const overlay = document.getElementById("cartOverlay");
    if (!overlay) return;
    overlay.style.display = "flex";
}

function closeCartOverlay() {
    const overlay = document.getElementById("cartOverlay");
    if (!overlay) return;
    overlay.style.display = "none";
}

function persistCart() {
    try {
        sessionStorage.setItem("tht_cart", JSON.stringify(CART));
    } catch (e) {}
}

function restoreCart() {
    try {
        const raw = sessionStorage.getItem("tht_cart");
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) CART = parsed;
    } catch (e) {}
}

async function initApp() {
    const res = await fetch(DATA_URL);
    RAW_DATA = await res.json();
    CATEGORIES = RAW_DATA.categories || [];
    GROUPS = RAW_DATA.groups || [];
    SERVICES = (RAW_DATA.services || []).map(normalizeService);
    SERVICES_BY_ID = new Map(SERVICES.map(s => [s.id, s]));
    restoreCart();
    buildCategoryView();
    updateCartUI();
    updateSummaryUI();
    showFabIfNeeded();
    updateStepDots(1);
    wireGlobalEvents();
}

function wireGlobalEvents() {
    const fab = document.getElementById("cartFab");
    if (fab) {
        fab.addEventListener("click", openCartOverlay);
        fab.addEventListener("keypress", e => {
            if (e.key === "Enter" || e.key === " ") openCartOverlay();
        });
    }
    const closeBt = document.getElementById("closeBt");
    if (closeBt) closeBt.addEventListener("click", closeCartOverlay);
    const clearAllBtns = document.querySelectorAll("#clearAllServicesBtn");
    clearAllBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            CART = [];
            persistCart();
            updateCartUI();
            updateSummaryUI();
            showFabIfNeeded();
        });
    });
    const addMoreBtns = document.querySelectorAll("#addMoreBtn");
    addMoreBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            closeCartOverlay();
            const summary = document.getElementById("serviceRequestSummary");
            if (summary) summary.style.display = "none";
        });
    });
    const bookNowBtn = document.getElementById("bookNowBtn");
    if (bookNowBtn) {
        bookNowBtn.addEventListener("click", () => {
            openCartOverlay();
        });
    }
    const finalBookBtn = document.getElementById("finalBookBtn");
    if (finalBookBtn) {
        finalBookBtn.addEventListener("click", () => {
            if (!CART.length) return;
            alert("Booking flow would continue here with collected cart data.");
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initApp().catch(err => console.error("Init error", err));
});</script>
