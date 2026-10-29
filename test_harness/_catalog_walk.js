/**
 * _catalog_walk.js -- boot the real page in jsdom and walk its catalog picker, the way a customer taps (T191, #194; lifted out of verify_state_ignorance.js so the class detector and the card differential read ONE walk).
 *
 *   boot({ db, html })          the page (html = what a browser runs, see _page.js) with db served as btnyc.json; returns { w, doc, errors, DB }
 *   walk(page, { onlyGroups })  every group of the catalog, every picker level, every tile: one leaf per card a tap opens, carrying the tap path, the group path, the questions the customer sees (their options and the
 *                               selected chip) and the route/context the page recorded
 *   wait, clean                 the two helpers both readers share
 *
 * It decides nothing: it taps and reads. What a leaf means is the reader's (verify_state_ignorance.js judges it; tools/path_card_diff.js compares two builds of it).
 */
'use strict';
const path = require('path');
const { JSDOM } = require(path.join(__dirname, 'node_modules', 'jsdom'));

const wait = ms => new Promise(r => setTimeout(r, ms));
const clean = s => String(s || '').replace(/\s+/g, ' ').trim();

// ---- the page --------------------------------------------------------------------------------------------------------------------------------------------------------------
async function boot({ db, html }) {
    const errors = [];
    const dom = new JSDOM(html, {
        url: 'https://tommichael88.github.io/booktomnyc/qr.html', runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
        beforeParse(w) {
            w.fetch = async u => String(u).includes('btnyc.json') ? { ok: true, json: async () => JSON.parse(JSON.stringify(db)) } : { ok: false, status: 404 };
            w.HTMLElement.prototype.scrollIntoView = function () {};
            w.console.error = (...a) => errors.push(a.join(' ')); w.console.log = () => {}; w.console.warn = () => {};
            w.addEventListener('error', e => errors.push(e.message));
        },
    });
    await wait(3000);
    return { w: dom.window, doc: dom.window.document, errors, DB: dom.window.DB };
}

// ---- 1. the walk -----------------------------------------------------------------------------------------------------------------------------------------------------------
async function walk(page, { onlyGroups } = {}) {
    const { w, doc, DB } = page, leaves = [];
    const tap = el => el.dispatchEvent(new w.Event('click', { bubbles: true }));
    const cont = () => doc.getElementById('serviceContainer');
    const tiles = () => [...(cont() ? cont().querySelectorAll('.group-tile, .service-tile, .svc-tile') : [])];
    const nm = t => clean((t.querySelector('.tile-name') || t).textContent);
    const host = () => doc.getElementById('sqCardHost');
    const shown = () => [...(host() ? host().querySelectorAll('.intake-module-step') : [])].filter(s => s.querySelector('.ims-label[data-mod]')).map(s => {
        const lab = s.querySelector('.ims-label'), chips = [...s.querySelectorAll('.ims-chip')], sel = chips.find(c => c.classList.contains('sel'));
        return { mod: lab.dataset.mod, answered: sel ? sel.dataset.label : null, options: chips.map(c => c.dataset.label) };
    });
    const tidy = l => { const sv = (DB.services || []).filter(x => clean((x.ui_taxonomy || {}).display_name) && l.length > clean(x.ui_taxonomy.display_name).length + 4 && l.includes(clean(x.ui_taxonomy.display_name))).sort((a, b) => clean(b.ui_taxonomy.display_name).length - clean(a.ui_taxonomy.display_name).length)[0]; return sv ? `service ${sv.id}` : l; };   // the most specific title that the tile's text contains (T188 (2/n): "Flatscreen Mounting" is now the start of another service's title)
    const groupByName = (cat, label) => (DB.group || []).find(g => g.category_id === cat && clean(g.display_name) === label);
    for (const group of (DB.group || []).filter(g => !(g.parent_group || g.parent_id))) {         // the groups showGroupsForCategory lists; a child group is reached through its parent
        if (onlyGroups && !onlyGroups.includes(group.id)) continue;
        const cat = group.category_id;
        const replay = async p => { w.S._lastRoute = null; w.showSubGroups(group, cat); await wait(25); const labs = []; for (const i of p) { const t = tiles()[i]; if (!t) return null; labs.push(nm(t)); tap(t); await wait(70); } return labs; };
        const visit = async (p, depth) => {
            const before = await replay(p); if (before === null) return;
            const here = tiles().map(nm), sibs = [];
            for (let i = 0; i < here.length; i++) {
                const labs = await replay(p.concat([i])); if (labs === null) continue;
                const r = w.S._lastRoute, after = tiles().map(nm);
                if (r && r.entity) {
                    const pathGroups = [group.id, ...labs.map(l => (groupByName(cat, l) || {}).id).filter(Boolean)];
                    const snap = { entity: r.entity.id, answers: JSON.stringify(r.answers || {}), tags: JSON.stringify((r.activeTags || []).slice().sort()), svc: r.context && r.context.selectedServiceId, grp: r.context && r.context.selectedGroupId };
                    sibs.push({ label: labs[labs.length - 1], snap: JSON.stringify(snap), idx: leaves.length });
                    leaves.push({
                        entry: 'catalog', where: `${((DB.category || []).find(c => c.id === cat) || {}).display_name || cat} > ${clean(group.display_name)} > ${labs.map(tidy).join(' > ')}`,
                        entity: r.entity.id, cat, ownGroup: (DB.services.find(s => s.id === r.entity.id) || { ui_taxonomy: {} }).ui_taxonomy.group_id || (r.context && r.context.selectedGroupId) || null,
                        pathGroups, tile: { label: labs[labs.length - 1], dropped: false }, tags: r.activeTags || [], answers: r.answers || {},
                        open: shown().filter(q => !q.answered).map(q => ({ mod: q.mod, options: q.options })),
                        mods: shown().map(q => q.mod),
                        reveal: { ctx: JSON.parse(JSON.stringify(r.context || {})), answers: JSON.parse(JSON.stringify((r.context && r.context.answers) || {})) },
                    });
                } else if (JSON.stringify(after) !== JSON.stringify(here) && depth < 4) await visit(p.concat([i]), depth + 1);
            }
            // a tile "changed nothing" when a sibling with a different label opened the identical card
            for (const a of sibs) if (sibs.some(b => b !== a && b.label !== a.label && b.snap === a.snap)) { leaves[a.idx].tile.dropped = true; leaves[a.idx].tile.siblings = [...new Set(sibs.filter(b => b !== a && b.label !== a.label && b.snap === a.snap).map(b => b.label))]; }
        };
        await visit([], 0);
    }
    return leaves;
}

module.exports = { boot, walk, wait, clean };
