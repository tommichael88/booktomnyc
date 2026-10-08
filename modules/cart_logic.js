/**
 * cart_logic.js — LOGIC. The one canonical cart-line identity and merge
 * rule. Pure: no DOM, no store, no session state. addToCart (Glue) calls
 * resolveCartTransition and dispatches the record it returns.
 *
 * Why this module exists (R-DOMAIN-SHAPE, R-SYSTEM-SHAPE):
 * The previous merge key was composed from presentation strings
 *   (name + formatted price + 'Answers: ' + JSON.stringify(answers)).
 * JSON key order is not stable across re-renders, formatted prices differ
 * by whitespace, and the name field carries a presentation suffix. Two
 * identical taps landed as two lines. A cart line's identity is a
 * business fact, not a formatted string; it belongs in Logic, derived
 * from the entry's own structured fields, in exactly one place
 * (R-INVARIANT-CANONICAL).
 *
 * Ledger entry: TIMELINE §T158.
 * Named defect class: DEFECT-PRESENTATION-IDENTITY.
 */

// canonicalAnswerKey -- LOGIC. Order-independent signature of an answers
// object. Two objects with the same key/value pairs in any order produce
// the same string. Nested plain objects are sorted too. Never throws.
function canonicalAnswerKey(answers) {
    if (!answers || typeof answers !== 'object') return '';
    return Object.keys(answers).sort().map(k => {
        const v = answers[k];
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            return k + '=' + canonicalAnswerKey(v);
        }
        return k + '=' + String(v);
    }).join('|');
}

// cartLineKey -- LOGIC. Stable identity of a cart line, from the entry's
// own business facts. Never from entry.id (a UI-instance artefact), never
// from entry.name (presentation), never from entry.price (display string).
//
// Components, in order:
//   serviceId  -- strongest identity signal (a service id, not a name).
//   category_id -- kept explicit for parity with the historical furniture
//                  rule and for ad-hoc entries whose serviceId is synthetic.
//   _variant   -- a discriminator for named variants of the same service
//                  (e.g. 'onsite' for the Fork-in-the-Road diagnostic path,
//                  which is a different line item from the standard repair
//                  quote even though both resolve through the same service).
//   answersPart -- the intake answers, canonically serialized when present
//                  (intakeAnswers / _answers); otherwise the renderer's own
//                  opaque notes string, preserving historical behaviour for
//                  renderers that disambiguate by free text.
function cartLineKey(entry) {
    if (!entry || typeof entry !== 'object') return '';
    const answers = entry.intakeAnswers || entry._answers || null;
    const answersPart = answers ? canonicalAnswerKey(answers) : (entry.notes || '');
    return [
        entry.serviceId || entry.serviceKey || '',
        entry.category_id || '',
        entry._variant || '',
        answersPart,
    ].join('::');
}

// resolveCartTransition -- LOGIC. The one canonical cart-merge rule.
// Given a proposed entry and the current cart, returns:
//   { action, cart, targetId, source }
// action  -- 'append' | 'merge-furniture' | 'increment-qty' | 'no-op'
// cart    -- the resulting cart (a new array; inputs are never mutated)
// source  -- which branch decided ('furniture-match' | 'line-key-match' |
//            'new-furniture-line' | 'new-line' | 'invalid-entry'),
//            consistent with the provenance vocabulary of
//            R-INVARIANT-PROVENANCE so callers never re-derive why.
//
// Furniture lines are keyed by name+category, matching the historical,
// deliberate rule (two furniture assemblies under different categories
// are different jobs). Non-furniture lines are keyed by cartLineKey.
function resolveCartTransition(entry, currentCart) {
    const cart = Array.isArray(currentCart) ? currentCart : [];
    if (!entry || !entry.id) {
        return { action: 'no-op', cart, targetId: null, source: 'invalid-entry' };
    }

    // ---- Furniture merge (keyed by name + category) ----
    if (Array.isArray(entry.furnitureItems) && entry.furnitureItems.length) {
        const idx = cart.findIndex(it =>
            it.furnitureItems &&
            it.name === entry.name &&
            it.category_id === entry.category_id
        );
        if (idx !== -1) {
            const existing = cart[idx];
            const merged = [...existing.furnitureItems, ...entry.furnitureItems];
            const charge = (typeof mathFurnitureAssembly === 'function')
                ? mathFurnitureAssembly(merged.map(f => f.minutes))
                : { hours: 0, price: 0 };
            const price = Number(charge.price).toFixed(2);
            const hours = Number(charge.hours).toFixed(2);
            const updated = {
                ...existing,
                furnitureItems: merged,
                estimatedHours: charge.hours,
                estimatedPrice: charge.price,
                price: '$' + price,
                notes: 'Furniture Items: ' + merged.map(f => f.label).join(', ') +
                       ' • Est: ' + hours + ' hr • $' + price,
            };
            const next = cart.map((it, i) => i === idx ? updated : it);
            return { action: 'merge-furniture', cart: next, targetId: existing.id, source: 'furniture-match' };
        }
        return { action: 'append', cart: [...cart, { ...entry, qty: entry.qty || 1 }], targetId: entry.id, source: 'new-furniture-line' };
    }

    // ---- Non-furniture: match by the entry's own business identity ----
    const key = cartLineKey(entry);
    // Guard against an empty key (a degenerate entry with no identity at
    // all) — never match on '' because that would merge every anonymous
    // entry into one line.
    if (key && key !== '::') {
        const idx = cart.findIndex(it => !it.furnitureItems && cartLineKey(it) === key);
        if (idx !== -1) {
            const existing = cart[idx];
            const updated = { ...existing, qty: (existing.qty || 1) + 1 };
            const next = cart.map((it, i) => i === idx ? updated : it);
            return { action: 'increment-qty', cart: next, targetId: existing.id, source: 'line-key-match' };
        }
    }

    return { action: 'append', cart: [...cart, { ...entry, qty: entry.qty || 1 }], targetId: entry.id, source: 'new-line' };
}
