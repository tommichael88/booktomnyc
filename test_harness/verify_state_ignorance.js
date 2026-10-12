#!/usr/bin/env node
/**
 * verify_state_ignorance.js -- the class detector for DEFECT-STATE-IGNORANCE: the system holds a fact and asks the customer for it anyway.
 *
 * @detects DEFECT-STATE-IGNORANCE
 * (Owning principles, named here and not tagged: a Principle is not enforced by definition, see verify_charter_rules.js -- P-INTAKE-INFER (free-text, navigation-path, redundancy and
 *  structural inferability), P-CLIENT-NAVFACT, and R-INTAKE-WIREREMOVE's counterpart: that Rule is the question whose answers move nothing, this class is the question the system can already answer.)
 *
 * THE CLASS (operator, 2026-10-11 11:52 NY, PENDING_DECISIONS #187, broadening the T170 proposal DEFECT-REASKED-QUESTION): the system fails to use information it already has, so the
 * customer supplies it again. One mechanism, three sub-shapes, named by WHERE the fact the question ignores came from:
 *
 *   DEFECT-REASKED-QUESTION      the fact is in the request's own state: an answer already given, or a tag in force (the customer typed it, tapped it, or the system set it).
 *                                A typed "mount a flatscreen on brick" that still asks "what kind of wall?".
 *   DEFECT-REDUNDANT-TRAVERSAL   the customer walked a path that declared the fact (a group they chose, a tile they tapped) and the intake asks for it anyway.
 *                                Drywall or Plaster > TV Flatscreen > Tv asks "what kind of wall are we drilling into?" with "Brick or concrete" among the answers;
 *                                Brick or Concrete > Mirror asks "what kind of items are we mounting?" with the mirror the customer tapped as one of five answers.
 *   DEFECT-UNPRUNED-FLOW         the fact is structural to the job itself (the service's own group, its default tags), so in this branch an answer could not be true,
 *                                and the question is presented as if it could.
 *
 * WHAT "ALREADY PRESENT" MEANS HERE, AND WHY IT IS MORE THAN BookingContext. The BookingContext of a catalog tap carries the answers, the tags and the LAST group
 * (`selectedGroupId`); it does not carry the parent group the customer chose on the way (Drywall or Plaster) or the tile they tapped (Mirror). That omission is the cause of the
 * traversal shape, so a detector that read the context alone could never see it. This one reads what the customer DID (the gestures the harness performs on the real page) next
 * to what the system RECORDED, and fails when a rendered question ignores either. Every fact is read from the SSOT's own links, never from a list written here:
 *   - an option is linked to a tag by the option's own `tags` or by the tag's `answers` (a tag that answers a module with that option's label);
 *   - a group declares a fact through the tags scoped to it (`applicable_group_ids`): where it offers some members of an exclusive family (`mutually_exclusive`) and not others,
 *     the others are ruled out ("Drywall or Plaster" offers #drywall and #plaster_wall, so #brick_wall -- "Brick or concrete" -- is ruled out), via the engine's own tagValidForCategory;
 *   - a held tag declares its option, and rules out the rest of that question.
 * The one text rule: a picker tile whose tap changed nothing (the sibling tiles open the identical card) and whose label names EXACTLY ONE answer of a question the card asks, as
 * whole words ("Mirror" -> "Heavy mirror (over 50 lbs)"). It is bounded that tightly because it is the only place a name is matched against a label. Second form (T171, the operator's
 * Brick or Concrete > Shelf): a tile that names TWO or more answers ("Shelf" -> "Single shelf", "Multiple shelves") rules out the answers a SIBLING tile names ("Frame" -> "Picture
 * frames or art", "Mirror" -> "Heavy mirror"), and no other: an answer that no tile names ("Mixed items") stays, and a tile that names nothing ("Door lock", a kind of which is "Deadbolt")
 * rules out nothing, because a tile's name can be broader than the answers beside it.
 *
 * QUESTIONS SHOWN LATER (T171). A card is not only the questions on it when it opens: answering one can reveal the next (a `then` branch, a `depends_on`). Each card, catalog and
 * typed, is therefore also read one answer deep: every answer to every open question is given to the engine (executeWorkflow, the renderer's own gateway), and a question that
 * becomes visible and is still unanswered AFTER the engine has applied the facts it holds (tags, defaults) is judged with that answer added. "TV Flatscreen > Cables" asks no wall type
 * when it opens and asks "What kind of wall are we drilling into?" the moment the cable question is answered. A revealed question whose job moved to another service (route_to) is not
 * judged here: it belongs to the service the job moved to.
 *
 * MEASURED BY WHAT THE RULES CLAIM (P-GOVERN-GOODHART): the REAL page (jsdom), driven the way a customer drives it, and read where the customer reads it.
 *   1. THE WALK     every group of the catalog, every picker level, every tile: the card each tap opens is read from the DOM (the questions the customer sees, answered or not).
 *   2. THE TYPING   for every service, its own name, and its name with each tag phrase that answers one of its questions: the real free-text route, and the questions it leaves open.
 *   3. THE CLASS    every open question is judged by one function (judge) against what is known; each violation is one instance: shape, entry, path or phrase, entity, question, the
 *                   answers the system already ruled out.
 *   4. THE RATCHET  the instances found today are the baseline (fixtures/state_ignorance_baseline.json), each filed in PENDING_DECISIONS. A NEW instance fails (a fixed one must be removed from
 *                   the baseline: the list only shrinks). The sweep that fixes the instances is a separate item; this file is the class's search key, not the fix.
 *   5. NON-VACUOUS  the three instances the operator named are found by it (not by a list of them); and each shape is shown to fail on a planted copy of the page or catalog.
 *
 * WHAT THIS DOES NOT COVER (named, not hidden): (a) the guided builder ("Write it for me") and the Other tile, whose cards are built from chips, not from a service's chain;
 * (b) an answer that is only IMPLIED in words the tag vocabulary does not know ("a brick fireplace" with no tag for it) -- that is a vocabulary gap (DEFECT-WITHIN-WORD-MATCH's mirror), not this
 * class; (c) the half of "no answer could change anything" that needs no known fact -- a question every one of whose answers prices the same -- is DEFECT-NON-RETIRING-ANSWER's
 * (verify_non_retiring_answers.js); (d) the typed corpus is the catalog's own phrases (each service's name plus each tag phrase that answers one of its questions), not every sentence a customer can write;
 * (e) a question revealed two answers deep (the reveal is read one answer deep; no chain on today's catalog is deeper than that for a fact a path declares); (f) a module named in a chain
 * twice is NOT an instance: the resolver keeps one of them (`_resolveIntakeChain`'s `seen`), the card shows it once, and check 5.1 holds that for every service and every card.
 *
 * RUN ON ANOTHER TREE (G-INVARIANT-PREFIX): BTNYC_ROOT=<tree> node test_harness/verify_state_ignorance.js
 * LIST WHAT IT FINDS:                       STATE_IGNORANCE_LIST=1 node test_harness/verify_state_ignorance.js     (add STATE_IGNORANCE_JSON=<file> to write the instances as JSON)
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = process.env.BTNYC_ROOT ? path.resolve(process.env.BTNYC_ROOT) : path.resolve(__dirname, '..');
const { JSDOM } = require(path.join(__dirname, 'node_modules', 'jsdom'));
const { check, finish } = require('./_shared.js');

const HTML = require('./_page.js').readPage(path.join(ROOT, 'qr.html'), ROOT);
const DB0 = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
const BASELINE_PATH = path.join(__dirname, 'fixtures', 'state_ignorance_baseline.json');
const wait = ms => new Promise(r => setTimeout(r, ms));
const SHAPES = { said: 'DEFECT-REASKED-QUESTION', path: 'DEFECT-REDUNDANT-TRAVERSAL', job: 'DEFECT-UNPRUNED-FLOW' };
const PRIORITY = { said: 3, path: 2, job: 1 };
const clean = s => String(s || '').replace(/\s+/g, ' ').trim();

// ---- the page --------------------------------------------------------------------------------------------------------------------------------------------------------------
async function boot({ db = DB0, html = HTML } = {}) {
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

// ---- the one judgement -----------------------------------------------------------------------------------------------------------------------------------------------------
// leaf = { entry, entity, cat, ownGroup, pathGroups[], tile:{label, dropped}|null, tags[], answers{}, open:[{ mod, options:[label] }] }
function makeJudge(DB, tagValid) {
    const TAGS = DB.smart_tags || {}, MODS = DB.intake_modules || {};
    const family = {};                                                                  // tag -> the tags it is exclusive with (its family), itself included
    for (const t of Object.keys(TAGS)) {
        const seen = new Set([t]), todo = [t];
        while (todo.length) { const x = todo.pop(); for (const y of [...((TAGS[x] || {}).mutually_exclusive || [])]) if (TAGS[y] && !seen.has(y)) { seen.add(y); todo.push(y); } }
        for (const x of Object.keys(TAGS)) if (!seen.has(x) && ((TAGS[x] || {}).mutually_exclusive || []).includes(t)) seen.add(x);
        family[t] = seen;
    }
    const optsOf = mod => ((MODS[mod] || {}).client_response || []).filter(o => o && o.label);
    const linkOf = (mod, o) => new Set([...(o.tags || []), ...Object.keys(TAGS).filter(t => TAGS[t].answers && TAGS[t].answers[mod] === o.label)]);
    const words = s => String(s || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[\u2019'`]/g, '').split(/[^a-z0-9]+/).filter(Boolean).map(x => x.replace(/ves$/, 'f').replace(/(?<=[a-z]{3})s$/, ''));
    const names = (label, option) => {                                                 // the tile label, as whole words, is inside the option's label, as whole words
        const a = words(label), b = words(option); if (!a.length || !b.length) return false;
        for (let i = 0; i + a.length <= b.length; i++) if (a.every((x, j) => b[i + j] === x)) return true;
        return false;
    };
    return function judge(leaf) {
        const out = [], svc = (DB.services || []).find(s => s.id === leaf.entity);
        const inherent = new Set(((svc && svc.default_tags) || []).map(r => (r && r.$ref) || r));
        const held = new Set([...(leaf.tags || []), ...(leaf.said || [])]);                 // `said`: the tag whose own synonym the customer typed, whether or not the engine kept it
        const ownGroup = leaf.ownGroup || (svc && svc.ui_taxonomy && svc.ui_taxonomy.group_id) || null;
        for (const q of leaf.open || []) {
            const opts = optsOf(q.mod); if (opts.length < 2) continue;
            const ruledOut = new Map();                                                // option label -> { source, why }
            const rule = (label, source, why) => { const cur = ruledOut.get(label); if (!cur || PRIORITY[source] > PRIORITY[cur.source]) ruledOut.set(label, { source, why }); };
            // (1) a tag in force declares its option, which rules out the others (two tags declaring different options leave it open: the engine's own rule)
            const declared = new Map();
            for (const o of opts) for (const t of linkOf(q.mod, o)) if (held.has(t)) declared.set(o.label, { tag: t, source: inherent.has(t) ? 'job' : 'said' });
            if (declared.size === 1) { const [lab, d] = [...declared.entries()][0]; for (const o of opts) if (o.label !== lab) rule(o.label, d.source, `${d.tag} is in force, which answers "${lab}"`); }
            if (leaf.answers && leaf.answers[q.mod]) for (const o of opts) if (o.label !== leaf.answers[q.mod]) rule(o.label, 'said', `the answer "${leaf.answers[q.mod]}" is already recorded`);
            // (2) a group on the way declares its family: it offers some members of an exclusive family and not others
            const groups = [...new Set([...(leaf.pathGroups || []), ownGroup].filter(Boolean))];
            for (const g of groups) {
                const src = (leaf.pathGroups || []).includes(g) ? 'path' : 'job';
                for (const o of opts) for (const t of linkOf(q.mod, o)) {
                    const fam = family[t]; if (!fam || fam.size < 2) continue;
                    const offered = [...fam].filter(x => tagValid(x, leaf.cat, g));
                    if (offered.length && !offered.includes(t)) rule(o.label, src, `group ${g} offers ${offered.join(', ')} and not ${t}`);
                }
            }
            // (3) a tile whose tap changed nothing, and whose label names exactly one answer
            if (leaf.tile && leaf.tile.dropped) {
                const named = opts.filter(o => names(leaf.tile.label, o.label));
                if (named.length === 1) { for (const o of opts) if (o !== named[0]) rule(o.label, 'path', `the tapped tile "${leaf.tile.label}" names "${named[0].label}" and the tap changed nothing`); }
                else if (named.length > 1) for (const sib of leaf.tile.siblings || []) for (const o of opts) if (!named.includes(o) && names(sib, o.label)) rule(o.label, 'path', `the tapped tile "${leaf.tile.label}" names ${named.map(n => `"${n.label}"`).join(' and ')}, and the tile "${sib}" beside it names "${o.label}", so the tap did not choose it`);
            }
            if (!ruledOut.size) continue;
            const top = [...ruledOut.values()].reduce((a, b) => (PRIORITY[b.source] > PRIORITY[a.source] ? b : a));
            out.push({
                shape: SHAPES[top.source], entry: leaf.entry, where: leaf.where, entity: leaf.entity, question: q.mod,
                ruled_out: [...ruledOut.keys()], remaining: opts.map(o => o.label).filter(l => !ruledOut.has(l)),
                determined: opts.length - ruledOut.size === 1, why: top.why,
            });
        }
        return out;
    };
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
    const tidy = l => { const sv = (DB.services || []).find(x => clean((x.ui_taxonomy || {}).display_name) && l.length > clean(x.ui_taxonomy.display_name).length + 4 && l.includes(clean(x.ui_taxonomy.display_name))); return sv ? `service ${sv.id}` : l; };
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

// ---- 2. the typing ---------------------------------------------------------------------------------------------------------------------------------------------------------
function typedCorpus(DB) {
    const TAGS = DB.smart_tags || {}, phrases = new Map(), services = new Map((DB.services || []).map(s => [s.id, s]));
    const plain = s => clean(String(s || '').toLowerCase().replace(/[^a-z0-9 '\-/]+/g, ' ').replace(/\//g, ' '));
    const direct = s => (s.intake_chain || []).map(st => (st && (st.module || st))).filter(Boolean);
    const branch = s => [].concat(...(s.intake_chain || []).map(st => st && st.then && typeof st.then === 'object' ? [].concat(...Object.values(st.then).map(v => (Array.isArray(v) ? v : [v]))) : []));
    // how a customer says it: the service's own name, and the SSOT's own verb + noun links (intent_mappings.objects[].contextual_overrides: "mount" + "tv" -> flatscreen_mounting_standard)
    const frames = new Map();                                                   // service id -> [phrase, ...]
    const addFrame = (id, t) => { if (!services.has(id)) return; if (!frames.has(id)) frames.set(id, []); if (!frames.get(id).includes(t)) frames.get(id).push(t); };
    for (const s of services.values()) addFrame(s.id, plain((s.ui_taxonomy || {}).display_name || s.id));
    for (const o of (DB.intent_mappings || {}).objects || [])
        for (const c of o.contextual_overrides || []) for (const noun of (c.keywords || []).slice(0, 2)) addFrame(c.override_sku, plain(`${o.keyword} a ${noun}`));
    for (const [id, list] of frames) {
        const s = services.get(id), mods = new Set([...direct(s), ...branch(s)].map(m => (m && m.module) || m));
        for (const f of list) {
            phrases.set(f, { svc: id, said: [] });
            // a tag that answers a question this service asks, by one of its own synonyms: said in a sentence about this service. NOT filtered by the tag's group scope: a customer
            // does not know the scope, and a question the service asks is a question its answers can be typed for.
            for (const t of Object.keys(TAGS)) {
                const d = TAGS[t]; if (!d.answers || !(d.synonyms || []).length || !Object.keys(d.answers).some(m => mods.has(m))) continue;
                const syn = plain(d.synonyms[0]); if (syn) phrases.set(`${f} on ${syn}`, { svc: id, said: [t] });
            }
        }
    }
    return [...phrases.entries()].map(([text, m]) => ({ text, ...m }));
}
function typedLeaf(page, text, said) {
    const { w, DB } = page;
    const c = w.collectBookingContext_freeText(text), r = w.executeWorkflow(Object.assign({}, c, { tagsAffirmed: true }), w.DB);
    const entity = r.entity && r.entity.id; if (!entity || !(DB.services || []).find(s => s.id === entity)) return null;
    const svc = DB.services.find(s => s.id === entity);
    const open = (r.visibleChain || []).filter(m => !(r.answers || {})[m.moduleKey || m.module]).map(m => ({ mod: m.moduleKey || m.module }));
    return { entry: 'typed', where: `"${text}"`, entity, cat: svc.ui_taxonomy.category_id, ownGroup: svc.ui_taxonomy.group_id, pathGroups: [], tile: null, tags: r.activeTags || [], said: said || [], answers: r.answers || {}, open,
        mods: (r.visibleChain || []).map(m => m.moduleKey || m.module), reveal: { ctx: Object.assign({}, c, { tagsAffirmed: true }), answers: r.answers || {} } };
}

// ---- 3. the questions shown later ------------------------------------------------------------------------------------------------------------------------------------------
// Give the engine each answer to each open question, one at a time, and read what becomes visible. A question counts only if it is STILL UNANSWERED after the engine has applied
// what it holds (r2.answers carries the tag-synthesized answers), and only if the job stayed with the same service. Returns one pseudo-leaf per revealed question.
function revealed(page, leaf) {
    const { w, DB } = page, MODS = DB.intake_modules || {}, rv = leaf.reveal; if (!rv) return [];
    const optsOf = k => ((MODS[String(k).split('::')[0]] || {}).client_response || []).filter(o => o && o.label).map(o => o.label);
    const run = answers => w.executeWorkflow(Object.assign({}, rv.ctx, { answers: Object.assign({}, rv.answers, answers) }), w.DB);
    const keys = r => (r.visibleChain || []).map(m => m.moduleKey || m.module);
    const base = run({}), bs = new Set(keys(base)), seen = new Map(), eid = r => r.entity && r.entity.id;
    for (const k of keys(base)) {
        if (rv.answers[k] || (base.answers || {})[k]) continue;
        for (const o of optsOf(k).slice(0, 8)) {
            const r2 = run({ [k]: o });
            if (eid(r2) !== eid(base)) continue;
            for (const m of keys(r2)) if (!bs.has(m) && !seen.has(m) && !(r2.answers || {})[m]) seen.set(m, { via: k, option: o });
        }
    }
    return [...seen].map(([m, v]) => Object.assign({}, leaf, { answers: Object.assign({}, leaf.answers, { [v.via]: v.option }), open: [{ mod: m, options: optsOf(m) }], where: `${leaf.where} (shown after ${v.via})` }));
}

// ---- the instances today ---------------------------------------------------------------------------------------------------------------------------------------------------
const keyOf = i => [i.shape, i.entry, i.where, i.entity, i.question].join(' | ');
async function findAll(page, opts = {}) {
    const judge = makeJudge(page.DB, (t, cat, g) => { try { return !!page.w.tagValidForCategory(t, cat, g); } catch (e) { return false; } });
    const found = new Map(); let leaves = 0, typed = 0, corpusSize = 0;
    const dupCards = [];
    if (!opts.skipWalk) for (const l of await walk(page, opts)) {
        leaves++; for (const i of judge(l)) found.set(keyOf(i), i);
        if (new Set(l.mods).size !== l.mods.length) dupCards.push(l.where);
        if (!opts.skipReveal) for (const rl of revealed(page, l)) for (const i of judge(rl)) found.set(keyOf(i), i);
    }
    if (!opts.skipTyping) {
        const corpus = opts.phrases || typedCorpus(page.DB);
        corpusSize = corpus.length;
        for (const p of corpus) {
            let l = null; try { l = typedLeaf(page, p.text, p.said); } catch (e) { continue; } if (!l) continue; typed++;
            for (const i of judge(l)) found.set(keyOf(i), i);
            if (!opts.skipReveal) { let rs = []; try { rs = revealed(page, l); } catch (e) { rs = []; } for (const rl of rs) for (const i of judge(rl)) found.set(keyOf(i), i); }
        }
    }
    return { found, leaves, typed, corpusSize, judge, dupCards };
}

(async () => {
    const page = await boot();
    check('the page starts with no error', page.errors.length === 0, { expected: 'none', got: page.errors.slice(0, 3) });
    const all = await findAll(page);
    const list = [...all.found.values()].sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
    if (process.env.STATE_IGNORANCE_JSON) fs.writeFileSync(process.env.STATE_IGNORANCE_JSON, JSON.stringify(list, null, 1));
    if (process.env.STATE_IGNORANCE_LIST) {
        console.log(`walked ${all.leaves} cards, typed ${all.typed} of ${all.corpusSize} phrases: ${list.length} instances`);
        for (const i of list) console.log(`  ${i.shape.replace('DEFECT-', '')} | ${i.entry} | ${i.where} | ${i.entity} | ${i.question} | ruled out: ${i.ruled_out.join('; ')}${i.determined ? ' (answer determined)' : ''} | ${i.why}`);
    }

    // ===== 1. the search is real =====================================================================================================================================================
    check('1.1 the walk reached the catalog\'s cards (a walk that opens nothing finds nothing)', all.leaves >= 80, { expected: '>= 80 cards', got: all.leaves });
    check('1.2 the typing reached the catalog\'s services: a phrase for every service, and three in four of them routed to a service (the rest reach no service, so there is no chain to judge) (the corpus is the catalog\'s own phrases)', all.corpusSize >= (page.DB.services || []).length && all.typed >= 0.75 * all.corpusSize, { expected: '>= one phrase per service, 75% routed', got: `${all.typed} routed of ${all.corpusSize}` });

    // ===== 2. the ratchet ============================================================================================================================================================
    const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
    const known = new Map((baseline.instances || []).map(i => [i.key, i]));
    const fresh = list.filter(i => !known.has(keyOf(i))), stale = [...known.keys()].filter(k => !all.found.has(k));
    check('2.1 no NEW instance of the class: every question the customer sees is asked only for what the system does not already know', fresh.length === 0, { expected: 'none beyond the baseline', got: fresh.slice(0, 6).map(i => `${i.shape} ${i.where} ${i.question}`) });
    check('2.2 the baseline lists only instances that still exist (a fixed one is removed from it: the list only shrinks)', stale.length === 0, { expected: 'none', got: stale.slice(0, 6) });
    check('2.3 every baseline instance is filed: a ledger entry, a shape, and a note', (baseline.instances || []).every(i => /^#\d+$/.test(i.ledger || '') && Object.values(SHAPES).includes(i.shape) && clean(i.note).length > 20), { expected: 'ledger/shape/note on each', got: (baseline.instances || []).filter(i => !/^#\d+$/.test(i.ledger || '')).length + ' without a ledger entry' });
    const ledger = fs.readFileSync(path.join(ROOT, 'PENDING_DECISIONS.md'), 'utf8');
    const filed = [...new Set((baseline.instances || []).map(i => i.ledger))];
    check('2.4 every ledger entry the baseline points at exists in PENDING_DECISIONS.md (DEFECT-DANGLING-REFERENCE)', filed.every(l => new RegExp('^### ' + l + ' ', 'm').test(ledger)), { expected: 'all exist', got: filed.filter(l => !new RegExp('^### ' + l + ' ', 'm').test(ledger)) });

    // ===== 3. it finds the operator's named instances, by the class, not by a list =================================================================================================
    const has = (shape, re, mod, ent) => list.some(i => i.shape === shape && re.test(i.where) && (!mod || i.question === mod) && (!ent || i.entity === ent));
    check('3.1 NAMED: Drywall or Plaster > TV Flatscreen > Tv asks the wall type, with Brick or concrete among the answers, though the customer chose Drywall or Plaster', has(SHAPES.path, /Drywall or Plaster > TV Flatscreen/, 'wall_type', 'flatscreen_mounting_standard'), { expected: 'REDUNDANT-TRAVERSAL on wall_type', got: list.filter(i => i.question === 'wall_type').map(i => i.shape + ' ' + i.where).slice(0, 4) });
    check('3.2 NAMED: Brick or Concrete > Mirror asks what kind of item is being mounted, though the customer tapped Mirror', has(SHAPES.path, /Brick or Concrete > Mirror/, 'wall_mount_items', 'shelf_mortar_mounting_buy_the_hour'), { expected: 'REDUNDANT-TRAVERSAL on wall_mount_items', got: list.filter(i => i.question === 'wall_mount_items').map(i => i.shape + ' ' + i.where).slice(0, 4) });

    check('3.3 NAMED: the same wall typed ("mount a tv on drywall", "... on brick wall") is asked again though the customer said it', has(SHAPES.said, /mount a tv on drywall/, 'wall_type', 'flatscreen_mounting_standard') && has(SHAPES.said, /mount a tv on brick wall/, 'wall_type', 'flatscreen_mounting_standard'), { expected: 'REASKED-QUESTION on both typed walls', got: list.filter(i => i.entry === 'typed' && i.question === 'wall_type').map(i => i.where).slice(0, 4) });
    check('3.4 it is a CLASS detector: it finds instances in groups the operator did not name (Cabinets & Drawers, Doors, Furniture Assembly; the Appliances ones were found here and fixed by #199)', ['Cabinets & Drawers', 'Doors'].every(g => list.some(i => i.entry === 'catalog' && i.where.includes('> ' + g))) && list.some(i => i.entity === 'furniture_assembly_flat_pack'), { expected: 'one in each', got: [...new Set(list.map(i => i.where.split(' > ').slice(0, 2).join(' > ')))] });
    // T174 (#199): the Washer and Refrigerator instances of #192 (a symptom tile names the answer, the card asks the question again) are gone because a tile now IS the answer; the class still finds the rest
    check('3.9 FIXED, #199: no appliance card asks the symptom question a tapped symptom tile already answered (the eight #192 instances left the baseline)', !list.some(i => i.entry === 'catalog' && i.where.includes('> Appliances') && i.shape === SHAPES.path), { expected: 'none in Appliances', got: list.filter(i => i.where.includes('> Appliances')).map(i => i.where).slice(0, 4) });
    {   // the ratchet is live: take one instance out of the baseline and it is reported new; invent one and it is reported stale
        const k0 = keyOf(list[0]), without = new Map([...known].filter(([k]) => k !== k0)), withGhost = new Map([...known, ['DEFECT-REASKED-QUESTION | typed | "ghost" | nothing | nothing', {}]]);
        const freshWithout = list.filter(i => !without.has(keyOf(i))), staleWithGhost = [...withGhost.keys()].filter(k => !all.found.has(k));
        check('3.5 the ratchet is live: an instance missing from the baseline is reported as new, and an invented one as stale', freshWithout.length === 1 && keyOf(freshWithout[0]) === k0 && staleWithGhost.length === 1, { expected: '1 new, 1 stale', got: { fresh: freshWithout.length, stale: staleWithGhost.length } });
    }

    // ===== 3b. the second pass: examples the operator gave that the first pass could not see (2026-10-11 14:35 NY) ===============================================================
    check('3.6 NAMED, second pass: Brick or Concrete > Shelf (the tile names two answers, the tiles beside it name the others) and Drywall or Plaster > TV Flatscreen > Cables (the wall type is asked once the cable question is answered) are found',
        has(SHAPES.path, /Brick or Concrete > Shelf$/, 'wall_mount_items', 'shelf_mortar_mounting_buy_the_hour') && has(SHAPES.path, /TV Flatscreen > Cables \(shown after cable_install_item\)/, 'wall_type', 'cable_management'),
        { expected: 'both', got: list.filter(i => /Shelf|Cables/.test(i.where)).map(i => i.where) });
    {   // the one-answer-deep read is what finds Cables: the walk of the same group without it finds none there
        const g = ['wall_mounting_drywall_or_plaster'], without = await findAll(page, { skipTyping: true, skipReveal: true, onlyGroups: g }), withIt = await findAll(page, { skipTyping: true, onlyGroups: g });
        const cables = r => [...r.found.values()].filter(i => /> Cables/.test(i.where));
        check('3.7 the question shown LATER is found only by reading a card one answer deep (the first view of the Cables card asks no wall type)', cables(without).length === 0 && cables(withIt).length === 1, { expected: '0 without the reveal pass, 1 with it', got: { without: cables(without).length, with: cables(withIt).length } });
    }

    check('3.8 the tile rule does not over-reach: "Door lock" and "Door handle" (tiles that name no answer, and a Deadbolt tile beside them naming "Deadbolt lock") rule out nothing, because a tile\'s name can be broader than the answers beside it',
        !list.some(i => /Doors > .*> Door (lock|handle)/.test(i.where)) && list.some(i => /Doors > .*> Deadbolt/.test(i.where)), { expected: 'Deadbolt found, Door lock / Door handle not', got: list.filter(i => /Doors >/.test(i.where)).map(i => i.where) });

    // ===== 4. each shape fails on a planted defect ==================================================================================================================================
    const mutants = [];
    {   // REASKED -- the engine stops turning a tag into its answer: a customer who typed "drywall" is asked what kind of wall
        const html = HTML.replace(/function synthesizeAnswersFromTags\(activeTagIds, answers, synthesized, DB\) \{/, m => m + '\n return { answers: Object.assign({}, answers || {}), synthesized: Object.assign({}, synthesized || {}) };');
        const phrase = [{ text: 'flatscreen mounting with hidden cables drywall', svc: 'flatscreen_mounting_with_hidden_cables', said: ['#drywall'] }];
        const real = await findAll(page, { skipWalk: true, phrases: phrase }), planted = await findAll(await boot({ html }), { skipWalk: true, phrases: phrase });
        mutants.push(['4.1 REASKED: when the engine stops turning a typed tag into its answer, a typed "drywall" is asked again and the class finds it (the real page finds none)',
            real.found.size === 0 && [...planted.found.values()].some(i => i.shape === SHAPES.said && i.question === 'wall_type'), { real: [...real.found.values()].map(i => i.question), planted: [...planted.found.values()].map(i => i.shape + ' ' + i.question) }]);
    }
    {   // REDUNDANT-TRAVERSAL -- a service in the Brick or Concrete group is given the wall-type question: the group the customer chose already said brick
        const db = JSON.parse(JSON.stringify(DB0)), s = db.services.find(x => x.id === 'shelf_mortar_mounting_buy_the_hour');
        s.intake_chain = [{ module: 'wall_type', then: {} }].concat(s.intake_chain);
        const real = await findAll(page, { skipTyping: true, onlyGroups: ['wall_mounting_brick_or_concrete'] }), planted = await findAll(await boot({ db }), { skipTyping: true, onlyGroups: ['wall_mounting_brick_or_concrete'] });
        const hit = [...planted.found.values()].find(i => i.question === 'wall_type');
        mutants.push(['4.2 TRAVERSAL: a Brick or Concrete service that asks the wall type is found as a path fact with the answer determined (the real page asks it nowhere in that group)',
            !!hit && hit.shape === SHAPES.path && hit.determined && ![...real.found.values()].some(i => i.question === 'wall_type'), { planted: hit && [hit.shape, hit.determined, hit.why], real: [...real.found.values()].map(i => i.question) }]);
    }
    {   // UNPRUNED-FLOW -- typed, so no path was walked; the service itself lives in the Brick or Concrete group and still asks the wall type: the fact is the job's own
        const db = JSON.parse(JSON.stringify(DB0)), s = db.services.find(x => x.id === 'flatscreen_mounting_standard');
        s.ui_taxonomy.group_id = 'wall_mounting_brick_or_concrete';
        const phrase = [{ text: 'mount a tv', svc: s.id, said: [] }];
        const real = await findAll(page, { skipWalk: true, phrases: phrase }), planted = await findAll(await boot({ db }), { skipWalk: true, phrases: phrase });
        const hit = [...planted.found.values()].find(i => i.question === 'wall_type');
        mutants.push(['4.3 UNPRUNED: typed "mount a tv", a service that lives in the Brick or Concrete group and asks the wall type is found as a fact of the job itself (the real page finds none)',
            !!hit && hit.shape === SHAPES.job && hit.determined && real.found.size === 0, { planted: hit && [hit.shape, hit.determined, hit.why], real: [...real.found.values()].map(i => i.question) }]);
    }
    {   // the reveal pass -- a service in the Brick or Concrete group names the wall type as the branch of one of its answers: nothing asks it when the card opens, and the class finds it once "Single shelf" is answered
        const db = JSON.parse(JSON.stringify(DB0)), s = db.services.find(x => x.id === 'shelf_mortar_mounting_buy_the_hour');
        s.intake_chain[0].then = { 'Single shelf': ['wall_type'] };
        const g = ['wall_mounting_brick_or_concrete'], real = await findAll(page, { skipTyping: true, onlyGroups: g }), planted = await findAll(await boot({ db }), { skipTyping: true, onlyGroups: g });
        const hit = [...planted.found.values()].find(i => i.question === 'wall_type'), noReveal = await findAll(await boot({ db }), { skipTyping: true, skipReveal: true, onlyGroups: g });
        mutants.push(['4.4 REVEAL: a wall-type question that opens only after an answer, in the Brick or Concrete group, is found by the one-answer-deep read (and not by the first view; the real page asks it nowhere in that group)',
            !!hit && hit.shape === SHAPES.path && /shown after wall_mount_items/.test(hit.where) && ![...noReveal.found.values()].some(i => i.question === 'wall_type') && ![...real.found.values()].some(i => i.question === 'wall_type'),
            { planted: hit && [hit.shape, hit.where], withoutReveal: [...noReveal.found.values()].map(i => i.question), real: [...real.found.values()].map(i => i.question) }]);
    }
    for (const [name, ok, got] of mutants) check(name, ok, { expected: 'found on the planted copy only', got });

    // ===== 5. a question is shown once (the operator's "weight is named in a `then` and at the top of the chain") ================================================================
    {   // The resolver keeps one of a module named twice (`_resolveIntakeChain`'s `seen`), so a module listed both as another step's branch target and as a step of its own is shown once, after the
        // answer that opens it. This holds that for every service's resolved chain and for every card the walk opened (the card's DOM, not the data).
        const dupChains = (page.DB.services || []).filter(s => { const k = (page.w._resolveIntakeChain(s) || []).map(m => m.moduleKey || m.module); return new Set(k).size !== k.length; }).map(s => s.id);
        check('5.1 no question is shown twice: no service\'s resolved chain repeats a module, and no card the walk opened shows one twice (a module named in a branch and again as a step is one question)', dupChains.length === 0 && all.dupCards.length === 0, { expected: 'none', got: { chains: dupChains.slice(0, 5), cards: all.dupCards.slice(0, 5) } });
    }

    finish();
    process.exit(0);
})().catch(e => { console.error(e); process.exit(2); });
