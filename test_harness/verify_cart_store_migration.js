#!/usr/bin/env node
/**
 * verify_cart_store_migration.js
 *
 * Regression test for the cart mutation -> store dispatch migration
 * (closes the gap analysis: "Controller mutates legacy state directly, not
 * via the store"). addToCart / removeServiceFromCart / removeFurnitureEntry
 * now dispatch through window.__store instead of mutating State.serviceRequest
 * directly; rendering is now purely reactive (store.subscribe(() =>
 * renderCart()) in init(), not a redundant explicit call in each mutation
 * function).
 *
 * This also guards against a real, subtle, independently-found bug in the
 * migration bridge itself: bindLegacyGlobals's cart-mirroring checked
 * `win.State`, but State is declared with `const State = {...}` in qr.html's
 * main script -- in classic (non-module) scripts, top-level const/let never
 * becomes a window property (unlike var), so that check silently never
 * passed. The store was being correctly updated on every dispatch, but the
 * real, bare State object every render function actually reads stayed
 * permanently stale. This never mattered before the migration (the old
 * code mutated bare State directly) but is a real, user-visible bug now
 * that cart mutations rely on this mirror -- confirmed via a full-document
 * browser load test that failed silently on every function-level test
 * (which all check the bare State object directly, matching how the code
 * itself works, not how a real page load exposes it).
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require(path.join(__dirname, 'node_modules', 'jsdom'));

const REPO_ROOT = path.dirname(__dirname);
let pass = 0, fail = 0;
function check(label, condition) {
    if (condition) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); }
}

const html = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
const btnycJson = fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8');

const dom = new JSDOM(html, {
    url: 'https://tommichael88.github.io/booktomnyc/qr.html',
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
    beforeParse(window) {
        window.fetch = async (url) => String(url).includes('btnyc.json')
            ? { ok: true, json: async () => JSON.parse(btnycJson) } : { ok: false, status: 404 };
        window.HTMLElement.prototype.scrollIntoView = function () {};
    }
});

function run() { return new Promise((resolve) => setTimeout(() => resolve(dom.window), 3000)); }

(async () => {
    const w = await run();

    console.log('=== Cart mutations dispatch through the store, not direct State mutation ===');
    check('addToCart source dispatches to window.__store', /addToCart\(entry\)[\s\S]{0,2000}window\.__store\.dispatch/.test(html));
    check('removeServiceFromCart source dispatches to window.__store', /removeServiceFromCart\(id\)[\s\S]{0,500}window\.__store\.dispatch/.test(html));
    check('removeFurnitureEntry source dispatches to window.__store', /removeFurnitureEntry\(serviceId, idx\)[\s\S]{0,2000}window\.__store\.dispatch/.test(html));

    console.log('\n=== Rendering is purely reactive (no redundant explicit renderCart() in mutation functions) ===');
    check('init() wires a store.subscribe that calls renderCart()', /store\.subscribe\(\(\) => \{\s*renderCart\(\);\s*\}\)/.test(html));

    console.log('\n=== The real, critical bug: bindLegacyGlobals cart-mirroring must reach the bare State object a real page actually renders from ===');
    {
        w.sqRestart();
        w.addToCart({ id: 'realtest1', name: 'Real Test', category_id: 'test', price: '$40', qty: 1 });
        const script = w.document.createElement('script');
        script.textContent = `window.__DEBUG_bareState = JSON.stringify(State.serviceRequest);`;
        w.document.body.appendChild(script);
        const bareState = JSON.parse(w.__DEBUG_bareState);
        check('the real, bare State.serviceRequest (what renderCart actually reads) reflects the dispatched item',
            bareState.length === 1 && bareState[0].id === 'realtest1');
        check('the store and the bare State stay in sync',
            JSON.stringify(bareState) === JSON.stringify(w.__store.getState().cart.serviceRequest));
    }

    console.log('\n=== Full add / add-merge / remove flow works correctly end-to-end ===');
    {
        w.sqRestart();
        // sqRestart() resets the session (S), not the cart (which lives in
        // the store and correctly persists across a session restart) --
        // clear it explicitly so this scenario starts from a known state.
        w.__store.dispatch({ type: 'cart/SET', payload: { serviceRequest: [] } });
        w.addToCart({ id: 'a', name: 'Svc', category_id: 'x', price: '$10', qty: 1 });
        w.addToCart({ id: 'a-dup', name: 'Svc', category_id: 'x', price: '$10', qty: 1 }); // should merge to qty:2
        w.addToCart({ id: 'b', name: 'Other', category_id: 'x', price: '$20', qty: 1 });
        w.removeServiceFromCart('b');
        const script2 = w.document.createElement('script');
        script2.textContent = `window.__DEBUG_final = JSON.stringify(State.serviceRequest);`;
        w.document.body.appendChild(script2);
        const final = JSON.parse(w.__DEBUG_final);
        check('final cart has exactly 1 entry (the merged one, after the other was removed)', final.length === 1);
        check('the merged entry correctly shows qty:2', final[0]?.qty === 2);
    }

    console.log(`\n[cart store migration verification] ${pass} passed, ${fail} failed (of ${pass + fail} checks)\n`);
    process.exit(fail > 0 ? 1 : 0);
})();
