#!/usr/bin/env node
/**
 * verify_typed_fact_reaches_chain.js -- PENDING_DECISIONS #195 (T192), P-INTAKE-INFER and P-CLIENT-NAVFACT: a fact the customer TYPED answers the question the service asks, whatever group their words resolved to.
 *
 * Before: the words "mount a tv on brick wall" resolve to the TV Flatscreen group; #brick_wall lists the walls groups in `applicable_group_ids` and not that one, so the free-text gateway judged the tag out of
 * scope, the detected tags were not the customer's, and Flatscreen Mounting asked "what kind of wall are we drilling into?" (12 typed instances of DEFECT-REASKED-QUESTION: #191 x6, #193 x1, #195 x5).
 *
 * After: tagInScopeForRequest -- the group test (tagValidForCategory, unchanged) OR the service the words reached ASKS the question the tag answers (tagAnswersAskedByService: the tag's authored `answers`
 * against the modules of the chain the engine composes from), with the category match as before and the tag's own `excluded_service_ids` honoured. The gateway names the service once
 * (resolveTagScopeService, beside resolveTagScopeGroup) and hands it to the three places a typed tag enters (detected, contextual, the intent's own).
 *
 *   1. THE QUESTION   tagAnswersAskedByService: a tag about a question the service asks (directly, or as a branch); not another service's; no service, no answers, an unknown service.
 *   2. THE SCOPE      tagInScopeForRequest: the group path is exactly as it was; the service stands in for the group; the category still bounds; an authored exclusion holds; the REACH over the whole catalog
 *                     (every tag x every service) is the declared 17 pairs and no others.
 *   3. THE TYPING     the twelve phrases on the engine: the wall / ceiling / PAX fact answers its question and is not open; "drywall" asks nothing, "brick" prices the brick wall.
 *   4. CONVERGENCE    the typed price is the price of the same service with the answer given (R-CLIENT-CONVERGE): what a customer says is worth what a tap is worth.
 *   5. NOT OVER-REACHED   a tag typed about a service that does not ask its question is as it was; the 245 phrases of the catalog's own corpus change exactly where a service asks the tag's question.
 *   6. NON-VACUITY    a scope that is the group test alone, a scope that ignores the question (a tag answers anything), a scope that ignores the exclusion, and a gateway that does not name the service
 *                     each turn a check red.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..');
const { check } = require('./_shared.js');
const { engine } = require('./_engine.js');

const DB0 = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
const clone = o => JSON.parse(JSON.stringify(o));

function load(db, transform) {
    const sb = { DB: db, SERVICE_DATA: db, window: { DB: db }, console: { log() {}, warn() {}, error() {}, info() {}, debug() {} } };
    sb.global = sb;
    vm.createContext(sb);
    vm.runInContext(transform ? transform(engine().wrapper) : engine().wrapper, sb);
    if (typeof sb.initNlpSets === 'function') { sb.initNlpSets(); if (typeof sb.refreshNlpPreviewBindings === 'function') sb.refreshNlpPreviewBindings(); }
    return sb;
}
const E = load(DB0);
const typed = (sb, text) => { const c = sb.collectBookingContext_freeText(text); return { c, r: sb.executeWorkflow(Object.assign({}, c, { tagsAffirmed: true }), sb.DB) }; };
const openOf = r => (r.visibleChain || []).filter(m => !(r.answers || {})[m.moduleKey || m.module]).map(m => m.moduleKey || m.module);
const svcOf = id => DB0.services.find(s => s.id === id);
const asked = (sb, id) => new Set(sb._resolveIntakeChain(sb.DB.services.find(s => s.id === id)).map(m => String(m.moduleKey).split('::')[0]));

// the twelve instances the detector held (verify_state_ignorance baseline, until T192): phrase -> the question and the answer the customer said
const PHRASES = [
    ['mount a tv on brick wall', 'flatscreen_mounting_standard', 'wall_type', 'Brick or concrete'],
    ['mount a tv on drywall', 'flatscreen_mounting_standard', 'wall_type', 'Drywall (standard)'],
    ['mount a television on brick wall', 'flatscreen_mounting_standard', 'wall_type', 'Brick or concrete'],
    ['mount a television on drywall', 'flatscreen_mounting_standard', 'wall_type', 'Drywall (standard)'],
    ['flatscreen mounting with hidden cables on brick wall', 'flatscreen_mounting_standard', 'wall_type', 'Brick or concrete'],
    ['flatscreen mounting with hidden cables on drywall', 'flatscreen_mounting_standard', 'wall_type', 'Drywall (standard)'],
    ['flat-pack furniture assembly on pax wardrobe', 'furniture_assembly_flat_pack', 'assembly_complexity', 'Complex (e.g. PAX wardrobe, sectional sofa)'],
    ['blinds shades or curtains install buy-the-hour on brick wall', 'blinds_shades_curtains_buy_the_hour', 'wall_type', 'Brick or concrete'],
    ['blinds shades or curtains install buy-the-hour on drywall', 'blinds_shades_curtains_buy_the_hour', 'wall_type', 'Drywall (standard)'],
    ['blinds shades or curtains install buy-the-hour on plaster wall', 'blinds_shades_curtains_buy_the_hour', 'wall_type', 'Plaster (older homes)'],
    ['blinds shades or curtains install buy-the-hour on vaulted ceiling', 'blinds_shades_curtains_buy_the_hour', 'mounting_height', 'Needs a stepladder (high or vaulted ceiling)'],
    ['blinds shades or curtains install buy-the-hour on very high ceiling', 'blinds_shades_curtains_buy_the_hour', 'mounting_height', 'Needs an extension ladder or scaffold (stairwell, two-story or cathedral ceiling)'],
];

(async () => {
    // ===== 1. the question a service asks ===================================================================================================================================================
    const brick = DB0.smart_tags['#brick_wall'];
    check('1.1 #brick_wall answers wall_type, which Flatscreen Mounting asks', E.tagAnswersAskedByService(brick, 'flatscreen_mounting_standard') === true);
    check('1.2 ... and a service that never asks the wall type (a ceiling fan) is not one it is about', E.tagAnswersAskedByService(brick, 'ceiling_fan_installation') === false || !svcOf('ceiling_fan_installation'), { got: E.tagAnswersAskedByService(brick, 'ceiling_fan_installation') });
    check('1.3 no service, an unknown service, a tag that answers nothing: false', E.tagAnswersAskedByService(brick, null) === false && E.tagAnswersAskedByService(brick, 'no_such_service') === false && E.tagAnswersAskedByService({ synonyms: ['x'] }, 'flatscreen_mounting_standard') === false && E.tagAnswersAskedByService(null, 'flatscreen_mounting_standard') === false);
    {   // a module reached only as the branch of another answer is still asked by the service
        const db = clone(DB0), s = db.services.find(x => x.id === 'cable_management'); s.intake_chain = [{ module: 'weight', then: { 'Under 25 lbs': ['wall_type'] } }];
        const P = load(db);
        check('1.4 a question the service asks only as the branch of another answer still counts as asked', asked(P, 'cable_management').has('wall_type') && P.tagAnswersAskedByService(db.smart_tags['#brick_wall'], 'cable_management') === true, { got: [...asked(P, 'cable_management')] });
    }

    // ===== 2. the scope ======================================================================================================================================================================
    const TV = 'wall_mounting_tv_flatscreen', WALLS = 'minor_home_repairs_walls', CAT = 'wall_mounting';
    check('2.1 the group path is exactly as it was: #brick_wall is in scope in the Brick or Concrete group with no service, and out of the TV Flatscreen group with none', E.tagInScopeForRequest('#brick_wall', CAT, 'wall_mounting_brick_or_concrete', null) === true && E.tagValidForCategory('#brick_wall', CAT, TV) === false && E.tagInScopeForRequest('#brick_wall', CAT, TV, null) === false);
    check('2.2 the service stands in for the group: the TV Flatscreen group with Flatscreen Mounting reached', E.tagInScopeForRequest('#brick_wall', CAT, TV, 'flatscreen_mounting_standard') === true);
    check('2.3 the category still bounds: the same service judged in another category is out', E.tagInScopeForRequest('#brick_wall', 'electric_lighting', TV, 'flatscreen_mounting_standard') === false);
    {
        const db = clone(DB0); db.smart_tags['#brick_wall'].excluded_service_ids = ['flatscreen_mounting_standard'];
        const P = load(db);
        check('2.4 an authored exclusion holds: a tag excluded for the service is out even though the service asks its question', P.tagInScopeForRequest('#brick_wall', CAT, TV, 'flatscreen_mounting_standard') === false && P.tagInScopeForRequest('#brick_wall', CAT, TV, 'flatscreen_mounting_with_hidden_cables') === true);
    }
    const reach = {};
    for (const [tid, t] of Object.entries(DB0.smart_tags)) {
        if (!t.answers || !(t.applicable_group_ids || []).length) continue;
        for (const s of DB0.services) {
            const ui = s.ui_taxonomy || {};
            if (E.tagValidForCategory(tid, ui.category_id, ui.group_id)) continue;                 // already in scope by its own group
            if (E.tagInScopeForRequest(tid, ui.category_id, ui.group_id, s.id)) (reach[tid] = reach[tid] || []).push(s.id);
        }
    }
    const counts = Object.fromEntries(Object.entries(reach).map(([k, v]) => [k, v.length]).sort((a, b) => a[0] < b[0] ? -1 : 1));
    check('2.5 THE REACH, over every tag x every service: 17 pairs, in 5 tags, all of them wall-mounting services that ask the wall type or the ceiling height (the declared reach; a change to the catalog that moves it is read, not absorbed)',
        JSON.stringify(counts) === JSON.stringify({ '#brick_wall': 5, '#drywall': 5, '#high_ceiling': 1, '#plaster_wall': 5, '#very_high_ceiling': 1 }) && [].concat(...Object.values(reach)).every(id => (svcOf(id).ui_taxonomy.category_id) === 'wall_mounting'), { got: reach });

    // ===== 3. the typing ====================================================================================================================================================================
    for (const [text, svc, mod, label] of PHRASES) {
        const { r } = typed(E, text);
        check(`3 "${text}" -> ${svc}: ${mod} is answered "${label.slice(0, 28)}" and is not open`, r.entity && r.entity.id === svc && (r.answers || {})[mod] === label && !openOf(r).includes(mod), { entity: r.entity && r.entity.id, answers: r.answers, open: openOf(r) });
    }

    // ===== 4. convergence: what a customer says is worth what a tap is worth ===============================================================================================================================
    for (const [text, svc, mod, label] of PHRASES) {
        const { c, r } = typed(E, text);
        const tapped = E.executeWorkflow(Object.assign({}, c, { detectedTagIds: [], manuallyToggledTagIds: [], answers: { [mod]: label }, tagsAffirmed: true }), E.DB);
        const a = r.quote || {}, b = tapped.quote || {};
        check(`4 "${text.slice(0, 58)}": typed labor ${a.laborEstimate} / ${a.totalMin} min = the same service with "${label.slice(0, 20)}" given (${b.laborEstimate} / ${b.totalMin})`,
            a.laborEstimate === b.laborEstimate && a.totalMin === b.totalMin && a.checkoutStateKey === b.checkoutStateKey, { typed: [a.laborEstimate, a.totalMin, a.checkoutStateKey], given: [b.laborEstimate, b.totalMin, b.checkoutStateKey] });
    }
    {
        const brickQ = typed(E, 'mount a tv on brick wall').r.quote.laborEstimate, dryQ = typed(E, 'mount a tv on drywall').r.quote.laborEstimate, plain = typed(E, 'mount a tv').r.quote.laborEstimate;
        check('4b the brick wall prices (it is not free), the drywall does not (it is the standard wall), and a customer who said neither is quoted as before', brickQ > dryQ && dryQ === plain, { brickQ, dryQ, plain });
    }

    // ===== 5. not over-reached ===============================================================================================================================================================
    const groupOnly = load(DB0, w => w.replace(/function tagInScopeForRequest\(tid, cat, groupId, serviceId\) \{/, m => m + '\n return tagValidForCategory(tid, cat, groupId);'));
    {
        const samples = ['install a ceiling fan on brick wall', 'replace a faucet on drywall', 'assemble a bookshelf on plaster wall', 'fix a leaking toilet on plaster wall', 'hang a mirror on vaulted ceiling'];
        const same = samples.filter(t => { const a = typed(E, t).r, b = typed(groupOnly, t).r; return JSON.stringify([a.entity && a.entity.id, a.answers, a.quote && a.quote.laborEstimate]) === JSON.stringify([b.entity && b.entity.id, b.answers, b.quote && b.quote.laborEstimate]); });
        check('5.1 a tag typed about a service that does not ask its question is as it was (the fan, the faucet, the bookshelf, the toilet, the mirror)', same.length === samples.length, { changed: samples.filter(t => !same.includes(t)) });
    }
    {   // the catalog's own corpus of 245 phrases (tools/typed_phrases.js): every change is a phrase whose service asks the tag's question
        const lines = require('child_process').execFileSync('node', [path.join(__dirname, 'tools', 'typed_phrases.js')], { env: Object.assign({}, process.env, { QR_ROOT: ROOT }), maxBuffer: 1 << 24 }).toString().split('\n').filter(Boolean);
        const changed = [];
        for (const t of lines) { const a = typed(E, t).r, b = typed(groupOnly, t).r; if (JSON.stringify([a.entity && a.entity.id, a.answers]) !== JSON.stringify([b.entity && b.entity.id, b.answers])) changed.push(t); }
        check(`5.2 over the catalog's own ${lines.length} typed phrases exactly the twelve instances change (a service that asks the tag's question), and nothing else`,
            changed.length === 12 && PHRASES.every(p => changed.includes(p[0])), { count: changed.length, others: changed.filter(t => !PHRASES.some(p => p[0] === t)) });
    }

    // ===== 6. each defect turns a check red ====================================================================================================================================================
    const target = ['mount a tv on brick wall', 'flatscreen_mounting_standard', 'wall_type', 'Brick or concrete'];
    const answersIt = sb => { const { r } = typed(sb, target[0]); return (r.answers || {})[target[2]] === target[3] && !openOf(r).includes(target[2]); };
    check('6.0 the real engine answers the typed wall (the check the planted copies are held to)', answersIt(E));
    check('6.1 a scope that is the group test alone: the typed wall is asked again', answersIt(groupOnly) === false);
    {
        const loose = load(DB0, w => w.replace(/function tagAnswersAskedByService\(tag, serviceId\) \{/, m => m + '\n return !!tag && !!tag.answers && !!serviceId;'));
        const lreach = [].concat(...DB0.services.map(s => { const ui = s.ui_taxonomy || {}; return Object.keys(DB0.smart_tags).filter(tid => (DB0.smart_tags[tid].applicable_group_ids || []).length && DB0.smart_tags[tid].answers && !E.tagValidForCategory(tid, ui.category_id, ui.group_id) && loose.tagInScopeForRequest(tid, ui.category_id, ui.group_id, s.id)); }));
        check('6.2 a scope that ignores the question (a tag answers anything): the reach is far more than the declared 17 pairs, and the check on the reach finds it', lreach.length > 17, { pairs: lreach.length });
    }
    {
        const noExcl = load((() => { const d = clone(DB0); d.smart_tags['#brick_wall'].excluded_service_ids = ['flatscreen_mounting_standard']; return d; })(), w => w.replace("return !(tag.excluded_service_ids || []).includes(serviceId);", 'return true;'));
        check('6.3 a scope that ignores the exclusion: a tag authored as excluded for the service answers its question anyway, and the exclusion check finds it', noExcl.tagInScopeForRequest('#brick_wall', CAT, TV, 'flatscreen_mounting_standard') === true);
    }
    {
        const html = engine().wrapper;
        const noService = load(DB0, w => w.replace(/const detService = resolveTagScopeService\(nlpIntent, thresholds\.auto_select_named_service\);/, 'const detService = null;'));
        check('6.4 a gateway that does not name the service (the scope is handed none): the typed wall is asked again', /const detService = resolveTagScopeService\(nlpIntent, thresholds\.auto_select_named_service\);/.test(html) && answersIt(noService) === false);
    }
    require('./_shared.js').finish('verify_typed_fact_reaches_chain.js');
})().catch(e => { console.error(e); process.exit(1); });
