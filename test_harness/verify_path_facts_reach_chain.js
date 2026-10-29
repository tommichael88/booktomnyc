#!/usr/bin/env node
/**
 * verify_path_facts_reach_chain.js -- PENDING_DECISIONS #194 (T191), P-CLIENT-NAVFACT and P-INTAKE-INFER: what the path a customer WALKED declares is a fact, and the chain does not ask for it again.
 *
 * Before: the BookingContext of a catalog tap kept the last group and none of the tiles, so "Wall Mounting > Drywall or Plaster > TV Flatscreen > Tv" asked "what kind of wall are we drilling into?" with
 * "Brick or concrete" among the answers -- the customer had just chosen Drywall or Plaster (#189, four instances of DEFECT-REDUNDANT-TRAVERSAL).
 *
 * After: the picker's taps pass the groups walked (resolvePathGroupIds: a group's own parent chain), the context carries them (pathGroupIds), and orch_apply_path_facts -- run right after the chain is composed --
 * drops from each question the options the path rules out (resolvePathRuledOutAnswers: a group offers some members of an exclusive tag family and not others, read through tagValidForCategory) and answers a
 * question that has one option left. A typed request walked nothing and is untouched.
 *
 *   1. THE PATH       resolvePathGroupIds: a child group's chain is its parent's, root first; a root is itself; an unknown group is nothing; a cycle in the data ends.
 *   2. WHAT IT RULES OUT   resolvePathRuledOutAnswers on the real wall_type question: Drywall or Plaster rules out Brick or concrete; Brick or Concrete rules out the other two; a group that offers no member of the
 *                     family rules out nothing; an empty path rules out nothing; it never rules out every option.
 *   3. THE CHAIN      orch_apply_path_facts: no path is the identity; a path returns copies (the catalog's own module is never written); one option left answers the question; a customer's answer is never overridden.
 *   4. THE PAGE       the real picker, tapped: the TV Flatscreen cards offer the two walls the path leaves and the context holds the groups walked; a service reached any other way (a typed request, a direct
 *                     open) carries no path and asks all three walls; the price of an answer is the price with or without the path.
 *   5. NON-VACUITY    a resolver that rules nothing out, a context that drops the path, and a path that is only the last group each turn the real-page check red.
 *
 * STAGE B (T191, #194; the tile carrier -- Brick or Concrete Mirror / Frame / Shelf, Cabinets & Drawers Cabinet door / Drawer / Hinge, Doors Deadbolt): a COMPONENT TILE authors what tapping it rules out
 * (source: group.picker.component_links[].rules_out; btnyc.json: routing_archetypes[group].component_id_to_ruled_out_answers = {comp: {module: [option labels]}}). Only what is plainly incompatible is listed (a
 * Mirror is not a "Single shelf"); an answer that could still be true stays, so a question that is still real stays.
 *   6. THE TILE       resolveTileRuledOutAnswers and the chain step read the list; the real picker, tapped, offers what the tile leaves; a tile that authors nothing (Door lock, Door handle) and a service opened
 *                     directly offer everything; the catalog's own lists are well-formed (a real component, a question its service asks, labels that exist, never every option).
 *   7. NON-VACUITY    a picker that drops the list, and a context that drops it, each turn the real-tile check red.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..');
const { check, finish } = require('./_shared.js');
const { engine } = require('./_engine.js');
const { readPage } = require('./_page.js');
const { boot, wait, clean } = require('./_catalog_walk.js');

const DB0 = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
const HTML = readPage(path.join(ROOT, 'qr.html'), ROOT);
const clone = o => JSON.parse(JSON.stringify(o));
const WALLS = ['Drywall (standard)', 'Plaster (older homes)', 'Brick or concrete'];

function load(db, transform) {
    const sb = { DB: db, SERVICE_DATA: db, window: { DB: db }, console };
    sb.global = sb;
    vm.createContext(sb);
    vm.runInContext(transform ? transform(engine().wrapper) : engine().wrapper, sb);
    return sb;
}

(async () => {
    const E = load(DB0);
    const labels = m => (m.client_response || []).map(o => o.label);
    const wallType = DB0.intake_modules.wall_type;

    // ===== 1. the path =====================================================================================================================================================================
    check('1.1 a child group\'s path is its parent\'s, root first (TV Flatscreen is reached through Drywall or Plaster)',
        JSON.stringify(E.resolvePathGroupIds('wall_mounting_tv_flatscreen', DB0)) === JSON.stringify(['wall_mounting_drywall_or_plaster', 'wall_mounting_tv_flatscreen']), { got: E.resolvePathGroupIds('wall_mounting_tv_flatscreen', DB0) });
    check('1.2 a root group\'s path is itself', JSON.stringify(E.resolvePathGroupIds('wall_mounting_brick_or_concrete', DB0)) === JSON.stringify(['wall_mounting_brick_or_concrete']));
    check('1.3 a group the catalog does not hold, or none, walked nothing', E.resolvePathGroupIds('no_such_group', DB0).length === 0 && E.resolvePathGroupIds(null, DB0).length === 0 && E.resolvePathGroupIds(undefined, DB0).length === 0);
    {
        const db = clone(DB0);
        db.group.find(g => g.id === 'wall_mounting_drywall_or_plaster').parent_group = 'wall_mounting_tv_flatscreen';   // a cycle: A under B under A
        const out = E.resolvePathGroupIds('wall_mounting_tv_flatscreen', db);
        check('1.4 a cycle in the data ends (each group once)', out.length === 2 && new Set(out).size === 2, { got: out });
    }

    // ===== 2. what the path rules out ======================================================================================================================================================
    const ruled = (p, cat = 'wall_mounting', mod = wallType, key = 'wall_type') => E.resolvePathRuledOutAnswers(key, mod, p, cat, DB0);
    check('2.1 Drywall or Plaster (and TV Flatscreen under it) rules out "Brick or concrete" and nothing else',
        JSON.stringify(ruled(['wall_mounting_drywall_or_plaster', 'wall_mounting_tv_flatscreen'])) === JSON.stringify(['Brick or concrete']), { got: ruled(['wall_mounting_drywall_or_plaster', 'wall_mounting_tv_flatscreen']) });
    check('2.2 Brick or Concrete rules out the two other walls', JSON.stringify(ruled(['wall_mounting_brick_or_concrete'])) === JSON.stringify(['Drywall (standard)', 'Plaster (older homes)']), { got: ruled(['wall_mounting_brick_or_concrete']) });
    check('2.3 a group that offers no member of the family (TV Flatscreen alone) rules out nothing', ruled(['wall_mounting_tv_flatscreen']).length === 0);
    check('2.4 an empty path rules out nothing', ruled([]).length === 0 && ruled(undefined).length === 0);
    check('2.5 a question whose options no tag links to is untouched by any path', E.resolvePathRuledOutAnswers('weight', DB0.intake_modules.weight, ['wall_mounting_drywall_or_plaster'], 'wall_mounting', DB0).length === 0);
    {
        const mod = clone(wallType);   // every option ruled out would leave no question: the options stay as authored
        mod.client_response = mod.client_response.filter(o => o.label === 'Brick or concrete');
        const two = clone(wallType); two.client_response = [two.client_response.find(o => o.label === 'Brick or concrete'), Object.assign(clone(two.client_response[2]), { label: 'Masonry (other)' })];
        check('2.6 it never rules out every option (a question with none left is no question)', E.resolvePathRuledOutAnswers('wall_type', two, ['wall_mounting_drywall_or_plaster'], 'wall_mounting', DB0).length === 0);
    }

    // ===== 3. the chain ====================================================================================================================================================================
    const chainOf = svcId => E._resolveIntakeChain(DB0.services.find(s => s.id === svcId));
    const ctx = (p, extra) => Object.assign({ selectedCategoryId: 'wall_mounting', pathGroupIds: p }, extra || {});
    {
        const chain = chainOf('flatscreen_mounting_standard'), answers = { x: 'y' };
        const same = E.orch_apply_path_facts(ctx(undefined), chain, answers, DB0), none = E.orch_apply_path_facts(ctx([]), chain, answers, DB0);
        check('3.1 no path is the identity: the same chain and the same answers come back', same.chain === chain && same.answers === answers && none.chain === chain && none.answers === answers);
        const out = E.orch_apply_path_facts(ctx(['wall_mounting_drywall_or_plaster', 'wall_mounting_tv_flatscreen']), chain, {}, DB0);
        const q = out.chain.find(m => (m.moduleKey || m.module) === 'wall_type');
        check('3.2 a path returns the wall question without "Brick or concrete" and the other modules as they were', JSON.stringify(labels(q)) === JSON.stringify(WALLS.slice(0, 2)) && out.chain.filter(m => m !== q).every((m, i) => chain.includes(m)), { got: labels(q) });
        check('3.3 the catalog\'s own module is never written (three options still, in the catalog and in the chain it was composed from)', labels(DB0.intake_modules.wall_type).length === 3 && labels(chain.find(m => (m.moduleKey || m.module) === 'wall_type')).length === 3);
        check('3.4 two options left is still a question: nothing is answered for the customer', Object.keys(out.answers).length === 0, { got: out.answers });
        const one = E.orch_apply_path_facts(ctx(['wall_mounting_brick_or_concrete']), chain, {}, DB0);
        check('3.5 one option left answers the question ("Brick or concrete" for a walked Brick or Concrete path)', one.answers.wall_type === 'Brick or concrete' && labels(one.chain.find(m => (m.moduleKey || m.module) === 'wall_type')).join() === 'Brick or concrete', { got: one.answers });
        const mine = E.orch_apply_path_facts(ctx(['wall_mounting_brick_or_concrete']), chain, { wall_type: 'Plaster (older homes)' }, DB0);
        check('3.6 the customer\'s own answer is never overridden by the path', mine.answers.wall_type === 'Plaster (older homes)', { got: mine.answers });
    }

    // ===== 4. the real page ===============================================================================================================================================================
    const GROUP = 'wall_mounting_drywall_or_plaster', CAT = 'wall_mounting';
    async function tapTv(page, serviceLabel) {
        const { w, doc } = page, DB = w.DB;
        const tap = el => el.dispatchEvent(new w.Event('click', { bubbles: true }));
        const tiles = () => [...doc.getElementById('serviceContainer').querySelectorAll('.group-tile, .service-tile, .svc-tile')];
        const nm = t => clean((t.querySelector('.tile-name') || t).textContent).replace(/^[^A-Za-z]+/, '');
        const pick = async label => { const t = tiles().find(x => nm(x) === label) || tiles().find(x => nm(x).startsWith(label)); if (!t) return false; tap(t); await wait(150); return true; };
        w.S._lastRoute = null;
        w.showSubGroups(DB.group.find(g => g.id === GROUP), CAT); await wait(60);
        const ok = (await pick('TV Flatscreen')) && (await pick('Tv')) && (await pick(serviceLabel));
        const r = w.S._lastRoute;
        const q = r && (r.visibleChain || []).find(m => (m.moduleKey || m.module) === 'wall_type');
        return { ok, route: r, walls: q ? labels(q) : null, path: r && r.context && r.context.pathGroupIds };
    }
    const real = await boot({ db: DB0, html: HTML });
    const std = await tapTv(real, 'Flatscreen MountingAverage'), hid = await tapTv(real, 'Flatscreen Mounting with Hidden Cables');
    check('4.1 Drywall or Plaster > TV Flatscreen > Tv > Flatscreen Mounting asks the wall type with the two walls the path leaves',
        std.ok && std.route.entity.id === 'flatscreen_mounting_standard' && JSON.stringify(std.walls) === JSON.stringify(WALLS.slice(0, 2)), { got: std.walls });
    check('4.2 ... and so does Flatscreen Mounting with Hidden Cables', hid.ok && hid.route.entity.id === 'flatscreen_mounting_with_hidden_cables' && JSON.stringify(hid.walls) === JSON.stringify(WALLS.slice(0, 2)), { got: hid.walls });
    check('4.3 the context records the groups walked, root first', JSON.stringify(std.path) === JSON.stringify([GROUP, 'wall_mounting_tv_flatscreen']), { got: std.path });
    {   // a service reached any other way walked nothing: opened directly, or typed
        const w = real.w, svc = real.DB.services.find(s => s.id === 'flatscreen_mounting_standard');
        w.S._lastRoute = null;
        w.prefillSmartQuoteFromService(svc, CAT); await wait(150);
        const r = w.S._lastRoute, q = r && (r.visibleChain || []).find(m => (m.moduleKey || m.module) === 'wall_type');
        check('4.4 the same service opened directly (no picker walked) carries no path and asks all three walls', r && (r.context.pathGroupIds || []).length === 0 && q && JSON.stringify(labels(q)) === JSON.stringify(WALLS), { got: q && labels(q) });
        const typed = w.collectBookingContext_freeText('mount a tv'), tr = w.executeWorkflow(typed, w.DB), tq = (tr.visibleChain || []).find(m => (m.moduleKey || m.module) === 'wall_type');
        check('4.5 a typed request walked nothing: no path, and the wall question keeps all three walls', (typed.pathGroupIds || []).length === 0 && tr.entity && tq && JSON.stringify(labels(tq)) === JSON.stringify(WALLS), { got: tq && labels(tq), entity: tr.entity && tr.entity.id });
        const priced = (c, a) => { const rr = w.executeWorkflow(Object.assign(w.makeBookingContext('catalog', { selectedServiceId: svc.id, selectedCategoryId: CAT, selectedGroupId: svc.ui_taxonomy.group_id, answers: a }), c), w.DB); return rr.quote && [rr.quote.laborEstimate, rr.quote.dispatchFee]; };
        const answers = { wall_type: 'Plaster (older homes)' };
        check('4.6 the price of an answer is the price with or without the path (the path removes an option, it does not move a price)', JSON.stringify(priced({ pathGroupIds: [GROUP, 'wall_mounting_tv_flatscreen'] }, answers)) === JSON.stringify(priced({}, answers)) && priced({}, answers) !== null, { with: priced({ pathGroupIds: [GROUP, 'wall_mounting_tv_flatscreen'] }, answers), without: priced({}, answers) });
    }

    // ===== 5. each defect turns a check red ===============================================================================================================================================
    const mutate = (re, to) => HTML.replace(re, to);
    {
        const m1 = mutate(/function resolvePathRuledOutAnswers\(moduleKey, mod, pathGroupIds, categoryId, db\) \{/, s => s + '\n return [];');
        const m2 = mutate(/pathGroupIds: \(tapped && Array\.isArray\(tapped\.pathGroupIds\)\) \? tapped\.pathGroupIds\.slice\(\) : \[\],/, 'pathGroupIds: [],');
        const m3 = mutate(/function resolvePathGroupIds\(groupId, db\) \{/, s => s + '\n return groupId ? [groupId] : [];');
        check('5.0 the three planted copies differ from the page (each pattern matched)', m1 !== HTML && m2 !== HTML && m3 !== HTML);
        for (const [name, html] of [['a resolver that rules nothing out', m1], ['a context that drops the path', m2], ['a path that is only the last group', m3]]) {
            const p = await boot({ db: DB0, html }), r = await tapTv(p, 'Flatscreen MountingAverage');
            check(`5.x ${name}: the TV Flatscreen card offers all three walls again`, r.ok && JSON.stringify(r.walls) === JSON.stringify(WALLS), { got: r.walls });
            p.w.close();
        }
    }
    // ===== 6. the tile (stage B) ===========================================================================================================================================================
    const MODS = DB0.intake_modules;
    {
        const items = MODS.wall_mount_items, rules = { wall_mount_items: ['Single shelf', 'Multiple shelves', 'No such option'] };
        check('6.1 a tile\'s list drops the options the question has, ignores a label it has not, and says nothing about a question it does not list',
            JSON.stringify(E.resolveTileRuledOutAnswers('wall_mount_items', items, rules)) === JSON.stringify(['Single shelf', 'Multiple shelves']) && E.resolveTileRuledOutAnswers('weight', MODS.weight, rules).length === 0 && E.resolveTileRuledOutAnswers('wall_mount_items', items, undefined).length === 0, { got: E.resolveTileRuledOutAnswers('wall_mount_items', items, rules) });
        check('6.2 a tile never rules out every option', E.resolveTileRuledOutAnswers('wall_mount_items', items, { wall_mount_items: labels(items) }).length === 0);
        const chain = chainOf('shelf_mortar_mounting_buy_the_hour');
        const out = E.orch_apply_path_facts({ selectedCategoryId: 'wall_mounting', tileRulesOut: { wall_mount_items: ['Single shelf', 'Multiple shelves'] } }, chain, {}, DB0);
        const q = out.chain.find(m => (m.moduleKey || m.module) === 'wall_mount_items');
        check('6.3 the chain step offers what the tile leaves (three options: a real question) and answers nothing', JSON.stringify(labels(q)) === JSON.stringify(['Picture frames or art', 'Heavy mirror (over 50 lbs)', 'Mixed items (shelves, frames, etc.)']) && Object.keys(out.answers).length === 0, { got: labels(q) });
        const two = E.orch_apply_path_facts({ selectedCategoryId: 'wall_mounting', tileRulesOut: { wall_mount_items: ['Single shelf', 'Multiple shelves', 'Picture frames or art', 'Heavy mirror (over 50 lbs)'] } }, chain, {}, DB0);
        check('6.4 a tile that leaves one option answers the question (and the catalog\'s own module is untouched)', two.answers.wall_mount_items === 'Mixed items (shelves, frames, etc.)' && labels(MODS.wall_mount_items).length === 5, { got: two.answers });
        const both = E.orch_apply_path_facts({ selectedCategoryId: 'wall_mounting', pathGroupIds: ['wall_mounting_brick_or_concrete'], tileRulesOut: { wall_mount_items: ['Single shelf'] } }, chainOf('flatscreen_mounting_standard'), {}, DB0);
        check('6.5 the groups and the tile are unioned: a Brick or Concrete path and a tile list drop what each rules out', labels(both.chain.find(m => (m.moduleKey || m.module) === 'wall_type')).join() === 'Brick or concrete' && both.answers.wall_type === 'Brick or concrete');
    }
    async function routeTo(page, groupId, labs, mod) {
        const { w, doc } = page, DB = w.DB;
        const tap = el => el.dispatchEvent(new w.Event('click', { bubbles: true }));
        const tiles = () => [...doc.getElementById('serviceContainer').querySelectorAll('.group-tile, .service-tile, .svc-tile')];
        const nm = t => clean((t.querySelector('.tile-name') || t).textContent).replace(/^[^A-Za-z]+/, '');
        const g = DB.group.find(x => x.id === groupId);
        w.S._lastRoute = null;
        w.showSubGroups(g, g.category_id); await wait(60);
        for (const l of labs) { const t = tiles().find(x => nm(x) === l) || tiles().find(x => nm(x).startsWith(l)); if (!t) return { ok: false }; tap(t); await wait(150); }
        const r = w.S._lastRoute, q = r && (r.visibleChain || []).find(m => (m.moduleKey || m.module) === mod);
        return { ok: !!r, route: r, options: q ? labels(q) : null, tile: r && r.context && r.context.tileRulesOut };
    }
    const ROUTES = [
        ['wall_mounting_brick_or_concrete', ['Mirror'], 'wall_mount_items', ['Picture frames or art', 'Heavy mirror (over 50 lbs)', 'Mixed items (shelves, frames, etc.)']],
        ['wall_mounting_brick_or_concrete', ['Frame'], 'wall_mount_items', ['Picture frames or art', 'Mixed items (shelves, frames, etc.)']],
        ['wall_mounting_brick_or_concrete', ['Shelf'], 'wall_mount_items', ['Single shelf', 'Multiple shelves', 'Mixed items (shelves, frames, etc.)']],
        ['minor_home_repairs_cabinets_drawers', ['Cabinet door'], 'cabinet_issue', ['Hinge is loose or squeaky', 'Cabinet face or door is scratched or scuffed', 'Cabinet door won\'t stay closed', 'Other (describe in notes)']],
        ['minor_home_repairs_cabinets_drawers', ['Drawer'], 'cabinet_issue', ['Drawer sticks or doesn\'t slide smoothly', 'Other (describe in notes)']],
        ['minor_home_repairs_cabinets_drawers', ['Hinge'], 'cabinet_issue', ['Hinge is loose or squeaky', 'Cabinet door won\'t stay closed', 'Other (describe in notes)']],
        ['minor_home_repairs_doors', ['Fix / Repair', 'Deadbolt'], 'hardware_type', ['Deadbolt lock', 'Keypad (electronic keyless entry)', 'Smart lock (WiFi/Bluetooth-enabled)']],
        ['minor_home_repairs_doors', ['Install', 'Deadbolt'], 'hardware_type', ['Deadbolt lock', 'Keypad (electronic keyless entry)', 'Smart lock (WiFi/Bluetooth-enabled)']],
    ];
    for (const [g, labs, mod, want] of ROUTES) {
        const r = await routeTo(real, g, labs, mod);
        check(`6.6 ${g.replace(/^(wall_mounting|minor_home_repairs)_/, '')} > ${labs.join(' > ')}: ${mod} offers what the tile leaves`, r.ok && JSON.stringify(r.options) === JSON.stringify(want), { got: r.options });
    }
    {
        const lock = await routeTo(real, 'minor_home_repairs_doors', ['Fix / Repair', 'Door lock'], 'hardware_type'), handle = await routeTo(real, 'minor_home_repairs_doors', ['Fix / Repair', 'Door handle'], 'hardware_type');
        check('6.7 a tile that authors nothing (Door lock, Door handle) offers every hardware type', lock.ok && handle.ok && lock.options.length === 7 && handle.options.length === 7, { lock: lock.options && lock.options.length, handle: handle.options && handle.options.length });
        const svc = real.DB.services.find(x => x.id === 'shelf_mortar_mounting_buy_the_hour');
        real.w.S._lastRoute = null; real.w.prefillSmartQuoteFromService(svc, 'wall_mounting'); await wait(150);
        const r = real.w.S._lastRoute, q = r && (r.visibleChain || []).find(m => (m.moduleKey || m.module) === 'wall_mount_items');
        check('6.8 the same service opened directly (no tile tapped) offers all five items', r && Object.keys(r.context.tileRulesOut || {}).length === 0 && q && labels(q).length === 5, { got: q && labels(q) });
        const priceOf = (rules, ans) => { const rr = real.w.executeWorkflow(Object.assign(real.w.makeBookingContext('catalog', { selectedServiceId: svc.id, selectedCategoryId: 'wall_mounting', selectedGroupId: svc.ui_taxonomy.group_id, answers: ans }), { tileRulesOut: rules }), real.w.DB); return rr.quote && [rr.quote.laborEstimate, rr.quote.dispatchFee]; };
        const ans = { wall_mount_items: 'Heavy mirror (over 50 lbs)' };
        check('6.9 the price of an answer is the price with or without the tile\'s list', JSON.stringify(priceOf({ wall_mount_items: ['Single shelf', 'Multiple shelves'] }, ans)) === JSON.stringify(priceOf({}, ans)) && priceOf({}, ans) !== null, { with: priceOf({ wall_mount_items: ['Single shelf', 'Multiple shelves'] }, ans), without: priceOf({}, ans) });
    }
    {   // the catalog's own lists are well-formed (the source validator holds the source; this holds what the page reads)
        const bad = [];
        for (const [gid, ra] of Object.entries(DB0.routing_archetypes)) for (const [comp, byMod] of Object.entries(ra.component_id_to_ruled_out_answers || {})) {
            if (!(ra.real_component_ids || []).includes(comp)) bad.push(`${gid}: ${comp} is not a component of the group`);
            const svcs = (ra.component_id_to_service_ids || {})[comp] || [];
            for (const [mod, labs] of Object.entries(byMod)) {
                const m = MODS[mod];
                if (!m) { bad.push(`${gid}/${comp}: no module ${mod}`); continue; }
                const have = labels(m);
                for (const l of labs) if (!have.includes(l)) bad.push(`${gid}/${comp}/${mod}: "${l}" is not an option`);
                if (new Set(labs).size >= have.length) bad.push(`${gid}/${comp}/${mod}: rules out every option`);
                if (!svcs.some(sid => (DB0.services.find(x => x.id === sid).intake_chain || []).some(st => (st.module || st) === mod || Object.values(st.then || {}).flat().includes(mod)))) bad.push(`${gid}/${comp}/${mod}: no service of the component asks it`);
            }
        }
        const total = Object.values(DB0.routing_archetypes).reduce((n, ra) => n + Object.keys(ra.component_id_to_ruled_out_answers || {}).length, 0);
        check('6.10 every authored list is well-formed: a real component, a question its service asks, labels that exist, never every option (and there are seven)', bad.length === 0 && total === 7, { bad, total });
    }

    // ===== 7. each defect turns the tile check red =======================================================================================================================================
    {
        const t1 = mutate(/rulesOut: \(isComponentFirst && ra\.component_id_to_ruled_out_answers\) \? ra\.component_id_to_ruled_out_answers\[rawId\] : undefined/, 'rulesOut: undefined');
        const t2 = mutate(/tileRulesOut: \(tapped && tapped\.rulesOut && typeof tapped\.rulesOut === 'object'\) \? JSON\.parse\(JSON\.stringify\(tapped\.rulesOut\)\) : \{\},/, 'tileRulesOut: {},');
        check('7.0 the two planted copies differ from the page (each pattern matched)', t1 !== HTML && t2 !== HTML);
        for (const [name, html] of [['a picker that drops the tile\'s list', t1], ['a context that drops the tile\'s list', t2]]) {
            const p = await boot({ db: DB0, html }), r = await routeTo(p, 'wall_mounting_brick_or_concrete', ['Mirror'], 'wall_mount_items');
            check(`7.x ${name}: the Mirror card offers all five items again`, r.ok && r.options.length === 5, { got: r.options });
            p.w.close();
        }
    }
    real.w.close();
    finish();
    process.exit(0);
})().catch(e => { console.error(e); process.exit(2); });
