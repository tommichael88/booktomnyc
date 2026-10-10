/**
 * verify_confidence_convergence.js -- the class detector for "one confidence formula, everywhere".
 *
 * @enforces R-CONF-ONEFORMULA
 * @enforces R-CLIENT-CONVERGE
 * @enforces R-INVARIANT-CANONICAL
 *
 * THE CLASS (R-CONF-ONEFORMULA): "There is one canonical confidence implementation, not one formula per gateway. Entry paths may contribute different facts
 * and therefore produce different inputs, but they do not get separate confidence arithmetic. Any path-specific confidence calculation is a second
 * implementation and a defect." Three calculators used to exist side by side: the state path (computeQuoteFromState -> computeUnifiedQuote), the orchestrator
 * (executeWorkflow -> orch_compute_confidence) and the guided builder (sqPrepareFlow). This test is the Charter's own test shape for the rule (R-CONF-ACCOUNTING:
 * "construct equivalent evidence through multiple supported entry mechanisms and assert identical ..."): it builds the SAME request through each real gateway and
 * reads what that gateway actually computed. It does not read source text, and it freezes no expected number: the assertion is agreement, so a future
 * recalibration of the one formula does not turn it red, and a fourth calculator does.
 *
 * WHAT EQUIVALENT EVIDENCE MEANS HERE. The entry type is a CONTRIBUTION to the one formula (a catalog tap is evidence of intent; a typed sentence is evidence of
 * a keyword match), so two different entry types are not compared on score. Within one entry type the same facts must give the same {score, minConf,
 * escalatedBy} in every gateway that can reach them; and {minConf, escalatedBy} depend on the entity and the active tags only, so they must agree across every
 * gateway AND every entry type.
 *
 *   Part 1  catalog tap, every named service x 4 tag sets   : orchestrator (executeWorkflow) vs state path (prefillSmartQuoteFromService -> computeQuoteFromState)
 *   Part 2  group "Other" tile, every group that has one x 4 tag sets : orchestrator vs state path vs guided builder (sqPrepareFlow)
 *   Part 3  free text, every service's own name + tagged sentences    : the route sqAnalyze really produced vs the state path afterwards
 *   Part 4  inside the orchestrator: the quote it prices from (route.quote) and the confidence it reports (route.confidence) come from one formula
 *   Part 5  one resolver: resolveConfidence exists, and each gateway reaches it
 *
 * WHAT IS NOT COMPARED, AND WHERE IT IS FILED (named, counted and printed; never silently skipped):
 *   - services whose OWN default tags escalate (the orchestrator does not apply inherent tags yet: PENDING_DECISIONS #93), asserted equal to a filed list;
 *   - the four sentences for which the input bar produces no route at all (PENDING_DECISIONS #139, L2), asserted equal to a filed list;
 *   - an "Other" tile whose action is still ambiguous (the orchestrator guesses the primary type, the state path assumes Repair: a different entity, not a
 *     different formula) and a sentence the route resolves to one entity while the state path prices another (the same: R-CLIENT-CONVERGE, filed);
 *   Equivalent evidence needs the same entity; where two gateways price different entities, comparing their confidence would test the entity resolver.
 *
 * Observation seams are the gateways' own outputs: route.confidence (orchestrator), computeUnifiedQuote's return as computeQuoteFromState received it (state
 * path), and for the guided builder the record resolveConfidence returned to it plus what it stored (S._confidenceStrategy / S._escalatedBy). The only wrappers are
 * pass-through spies on computeUnifiedQuote and resolveConfidence; nothing is stubbed except the network (btnyc.json is served from the repo).
 *
 * WHY THIS IS NOT A GOLDEN OR AN EQUIVALENCE TEST (PHASE_PLAN's standing rule: no new golden / parity / equivalence tests): it keeps no reference output and no copy
 * of any implementation; it asserts agreement between live gateways, so recalibrating the one formula cannot turn it red and a fourth calculator can. It is a class
 * detector (R-INVARIANT-DISEASE), accepted as such in SESSION_PLAN.md v-a 6.
 *
 * RUN ON ANOTHER TREE: BTNYC_QR_FILE=<tree>/qr.html BTNYC_PAGE_ROOT=<tree> node test_harness/verify_confidence_convergence.js   (G-INVARIANT-PREFIX: this
 * file is run against the tree as it was BEFORE the fix, and must fail there.)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const REPO_ROOT = process.env.BTNYC_PAGE_ROOT ? path.resolve(process.env.BTNYC_PAGE_ROOT) : path.join(__dirname, '..');
const html = require('./_page.js').readPage();
const btnycJson = fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8');

let pass = 0, fail = 0;
const check = (label, ok, detail) => {
    if (ok) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); if (detail) console.log(`      ${detail}`); }
};
const same = (a, b) => (typeof a === 'number' && typeof b === 'number') ? Math.abs(a - b) < 1e-9 : a === b;
const fmt = o => JSON.stringify(o, (k, v) => v === undefined ? 'undefined' : v);

const TAG_SETS = [[], ['#brick_wall'], ['#fragile_item'], ['#brick_wall', '#fragile_item']];

async function boot() {
    const dom = new JSDOM(html, {
        url: 'https://tommichael88.github.io/booktomnyc/qr.html',
        runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
        beforeParse(w) {
            w.fetch = async u => String(u).includes('btnyc.json') ? { ok: true, json: async () => JSON.parse(btnycJson) } : { ok: false, status: 404 };
            w.HTMLElement.prototype.scrollIntoView = function () {};
        },
    });
    const w = dom.window;
    for (let i = 0; i < 200 && !(w.DB && w.DB.services && w.document.getElementById('sqDescIn')); i++) await new Promise(r => setTimeout(r, 100));
    await new Promise(r => setTimeout(r, 300));
    return w;
}

(async () => {
    const realLog = console.log;
    const w = await boot();
    const DB = w.DB;
    if (!DB || !DB.services) { console.log('FATAL: the page did not boot'); process.exit(1); }

    // ---- seams (observation only; each wrapper calls straight through) ----
    const uq = { calls: [] };
    const origUQ = w.computeUnifiedQuote;
    w.computeUnifiedQuote = function (ctx) { const r = origUQ.apply(this, arguments); uq.calls.push({ ctx, r }); return r; };
    const resolverCalls = { n: 0, last: null };
    if (typeof w.resolveConfidence === 'function') {
        const origRC = w.resolveConfidence;
        w.resolveConfidence = function () { resolverCalls.n++; const r = origRC.apply(this, arguments); resolverCalls.last = r; return r; };
    }
    const S = () => w.eval('S');
    const resetS = () => {
        const s = S();
        s.detTagIds = []; s.negatedTagIds = []; s.manTagIds = []; s.inherentTagIds = []; s.answers = {};
        s._tagsAffirmed = false; s._affirmedTagSet = []; s._negationPivotAccepted = false; s._pendingPivotInfo = null;
        s._svc = null; s._otherTile = null; s.intent = null; s._autoSelectedFrom = null; s._confidenceStrategy = null; s._escalatedBy = null;
    };

    // ---- gateways: each returns what that gateway really computed ----
    const orchestrate = (ctx, tags) => {
        ctx.manuallyToggledTagIds = tags.slice();
        const route = w.executeWorkflow(ctx, DB);
        const c = route && route.confidence;
        if (!c) return null;
        const q = route.quote;
        return {
            score: c.score, minConf: c.minConf, escalatedBy: c.escalatedBy, meets: c.score >= c.minConf, entity: route.entity,
            quoteView: q && q.liveStrategy ? { score: q.totalConfidence, minConf: q.liveStrategy.minimum_quote_confidence, escalatedBy: q.escalatedBy, meets: q.meetsConfidenceBar } : null,
        };
    };
    const quoteDiffs = [];   // Part 4: the orchestrator's quote vs the orchestrator's confidence, any entry
    const notPriced = [];    // routes that resolved no entity (a "which action?" tile, an unmatched sentence): nothing was priced, so there is no quote to compare
    const quoteVsConfidence = (at, o) => {
        if (o && !o.quoteView && !o.entity) { notPriced.push(at); return; }   // counted and printed in Part 4; a priced entity with no quote confidence is still a failure below
        if (!o || !o.quoteView) { quoteDiffs.push(`${at}: the route priced an entity but carries no quote confidence to compare`); return; }
        const v = o.quoteView;
        if (!same(v.score, o.score) || !same(v.minConf, o.minConf) || !same(v.escalatedBy, o.escalatedBy) || v.meets !== o.meets)
            quoteDiffs.push(`${at}: confidence ${fmt({ s: o.score, m: o.minConf, e: o.escalatedBy })}, quote ${fmt({ s: v.score, m: v.minConf, e: v.escalatedBy })}`);
    };
    const fromState = () => {
        const s = S();
        uq.calls.length = 0;
        const q = w.computeQuoteFromState(s);
        const first = uq.calls[0];
        if (!first) return null;
        const r = first.r;
        return { score: r.totalConfidence, minConf: r.liveStrategy && r.liveStrategy.minimum_quote_confidence, escalatedBy: r.escalatedBy, meets: q.meetsConfidenceBar, entity: first.ctx.svc || first.ctx.dynDef };
    };
    const fromBuilder = (cat, groupId, stype, tags) => {
        resetS();
        const s = S();
        s.desc = 'fix my ' + (groupId || 'item'); s.stype = stype; s.qty = 1; s._fromBuilder = true;
        s.intent = { category: cat, label: 'x', group: 'x', base: 0, stype, qtyLabel: 'item', key: 'x', _groupId: groupId };
        s.manTagIds = tags.slice();
        resolverCalls.last = null;
        w.sqPrepareFlow(true);
        const strat = s._confidenceStrategy;
        const c = resolverCalls.last;   // the record the builder got from the resolver (the builder keeps only the strategy and escalatedBy on S, as it always did)
        return { minConf: strat && strat.minimum_quote_confidence, escalatedBy: s._escalatedBy, score: c ? c.score : undefined, resolved: c, scoreObservable: !!c };
    };

    // ---- the filed exclusions (R-INVARIANT-DUPLICATION-TICKET): each is asserted equal to what the data says today, so a new one cannot hide ----
    // Inherent (service-default) tags escalate in the state path and not in the orchestrator: PENDING_DECISIONS #93. A service whose own default tags escalate
    // therefore cannot have equivalent evidence in the two gateways yet.
    const FILED_93_SERVICES = ['brick_or_concrete_crack_repair'];
    const escalators = new Set(Object.entries(DB.smart_tags || {}).filter(([, t]) => t && t.escalate_complexity).map(([id]) => id));
    const refOf = r => (r && typeof r === 'object' && r.$ref) ? r.$ref : r;
    const inheritsEscalator = svc => (svc.default_tags || []).some(r => escalators.has(refOf(r)));
    const excluded93 = DB.services.filter(inheritsEscalator).map(s => s.id);

    // ---- Part 1: catalog taps ----
    const p1 = { score: [], minConf: [], escalatedBy: [], verdict: [] };
    let p1cells = 0;
    for (const svc of DB.services) {
        if (excluded93.includes(svc.id)) continue;
        const cat = svc.ui_taxonomy && svc.ui_taxonomy.category_id;
        for (const tags of TAG_SETS) {
            const o = orchestrate(w.collectBookingContext_catalog(svc, cat), tags);
            resetS();
            w.prefillSmartQuoteFromService(svc, cat);
            S().manTagIds = tags.slice();
            const st = fromState();
            p1cells++;
            const at = `${svc.id} ${fmt(tags)}`;
            quoteVsConfidence(`catalog ${at}`, o);
            if (!o || !st) { p1.score.push(`${at}: gateway returned nothing (orch ${!!o}, state ${!!st})`); continue; }
            if (!same(o.score, st.score)) p1.score.push(`${at}: orchestrator ${o.score}, state ${st.score}`);
            if (!same(o.minConf, st.minConf)) p1.minConf.push(`${at}: orchestrator ${o.minConf}, state ${st.minConf}`);
            if (!same(o.escalatedBy, st.escalatedBy)) p1.escalatedBy.push(`${at}: orchestrator ${o.escalatedBy}, state ${st.escalatedBy}`);
            if (o.meets !== st.meets) p1.verdict.push(`${at}: orchestrator ${o.meets}, state ${st.meets}`);
        }
    }
    const show = (list, n) => `${list.length} of ${n} cells differ; first: ${list.slice(0, 2).join(' | ')}`;
    console.log(`\n=== Part 1. Catalog tap: ${DB.services.length - excluded93.length} named services x ${TAG_SETS.length} tag sets, orchestrator vs state path ===`);
    check('the services excluded for escalating inherent tags (#93) are exactly the filed list', fmt(excluded93) === fmt(FILED_93_SERVICES),
        `data says ${fmt(excluded93)}, filed ${fmt(FILED_93_SERVICES)}`);
    check('score is the same in both gateways', p1.score.length === 0, show(p1.score, p1cells));
    check('minimum confidence (after escalation) is the same', p1.minConf.length === 0, show(p1.minConf, p1cells));
    check('escalatedBy is the same', p1.escalatedBy.length === 0, show(p1.escalatedBy, p1cells));
    check('the bar verdict (meets / does not meet) is the same', p1.verdict.length === 0, show(p1.verdict, p1cells));

    // ---- Part 2: "Other" tiles -> orchestrator, state path, guided builder ----
    const groupMap = w.eval('groupMap');
    const tiles = [];
    for (const g of (DB.group || [])) {
        const real = DB.services.filter(s => s.ui_taxonomy && s.ui_taxonomy.group_id === g.id);
        for (const t of w.buildOtherTilesForGroup(real, g.id, groupMap, DB)) tiles.push({ tile: t, cat: g.category_id, groupId: g.id });
    }
    const p2 = { score: [], minConf: [], escalatedBy: [], verdict: [], entity: [], bMin: [], bEsc: [], bSelf: [], bState: [] };
    let p2cells = 0, builderScoreSeen = 0, ambiguousTiles = 0;
    for (const { tile, cat, groupId } of tiles) {
        const types = tile.uncovered_service_types || [tile.service_type];
        const singleType = types.length === 1 ? types[0] : null;
        if (!singleType) ambiguousTiles++;
        for (const tags of TAG_SETS) {
            const o = orchestrate(w.collectBookingContext_otherTile(tile, cat), tags);
            quoteVsConfidence(`other tile ${groupId} ${fmt(tags)}`, o);
            if (!singleType) continue;   // counted and printed below; a different entity, not a different formula
            resetS();
            w.prefillSmartQuoteFromOtherTile(tile, cat);
            S().manTagIds = tags.slice();
            const st = fromState();
            p2cells++;
            const at = `${groupId} ${fmt(tags)}`;
            if (!o || !st) { p2.score.push(`${at}: gateway returned nothing (orch ${!!o}, state ${!!st})`); continue; }
            if (o.entity !== st.entity) { p2.entity.push(`${at}: orchestrator prices ${o.entity && o.entity.id}, state path ${st.entity && st.entity.id}`); continue; }
            if (!same(o.score, st.score)) p2.score.push(`${at}: orchestrator ${o.score}, state ${st.score}`);
            if (!same(o.minConf, st.minConf)) p2.minConf.push(`${at}: orchestrator ${o.minConf}, state ${st.minConf}`);
            if (!same(o.escalatedBy, st.escalatedBy)) p2.escalatedBy.push(`${at}: orchestrator ${o.escalatedBy}, state ${st.escalatedBy}`);
            if (o.meets !== st.meets) p2.verdict.push(`${at}: orchestrator ${o.meets}, state ${st.meets}`);
            const b = fromBuilder(cat, groupId, singleType, tags);
            if (b.scoreObservable) builderScoreSeen++;
            if (!same(o.minConf, b.minConf)) p2.bMin.push(`${at}: orchestrator ${o.minConf}, builder ${b.minConf}`);
            if (!same(o.escalatedBy, b.escalatedBy)) p2.bEsc.push(`${at}: orchestrator ${o.escalatedBy}, builder ${b.escalatedBy}`);
            const bc = b.resolved;
            if (bc && !(same(bc.minConf, b.minConf) && same(bc.escalatedBy, b.escalatedBy))) p2.bSelf.push(`${at}: the resolver answered ${fmt({ m: bc.minConf, e: bc.escalatedBy })}, the builder stored ${fmt({ m: b.minConf, e: b.escalatedBy })}`);
            // the same session, priced afterwards by the state path: one session, one confidence
            const stB = fromState();
            if (!stB || !bc) p2.bState.push(`${at}: no state-path answer for the builder's session (state ${!!stB}, builder ${!!bc})`);
            else if (!(same(bc.score, stB.score) && same(bc.minConf, stB.minConf) && same(bc.escalatedBy, stB.escalatedBy) && (bc.score >= bc.minConf) === stB.meets))
                p2.bState.push(`${at}: builder ${fmt({ s: bc.score, m: bc.minConf, e: bc.escalatedBy })}, state path on the same session ${fmt({ s: stB.score, m: stB.minConf, e: stB.escalatedBy })}`);
        }
    }
    console.log(`\n=== Part 2. "Other" tile: ${tiles.length - ambiguousTiles} single-action groups x ${TAG_SETS.length} tag sets (${ambiguousTiles} groups still ask which action: reported, not compared) ===`);
    check('the orchestrator and the state path price the same entity for a known action', p2.entity.length === 0, show(p2.entity, p2cells));
    check('orchestrator and state path: same score', p2.score.length === 0, show(p2.score, p2cells));
    check('orchestrator and state path: same minimum confidence', p2.minConf.length === 0, show(p2.minConf, p2cells));
    check('orchestrator and state path: same escalatedBy', p2.escalatedBy.length === 0, show(p2.escalatedBy, p2cells));
    check('orchestrator and state path: same bar verdict', p2.verdict.length === 0, show(p2.verdict, p2cells));
    check('guided builder: same minimum confidence as the orchestrator', p2.bMin.length === 0, show(p2.bMin, p2cells));
    check('guided builder: same escalatedBy as the orchestrator', p2.bEsc.length === 0, show(p2.bEsc, p2cells));
    check('guided builder asks the one resolver (resolveConfidence) for its confidence, as the other two gateways do', p2cells > 0 && builderScoreSeen === p2cells,
        `${builderScoreSeen} of ${p2cells} builder runs consulted the resolver`);
    check('what the builder stores is what the resolver answered', p2.bSelf.length === 0, show(p2.bSelf, p2cells));
    check('guided builder and state path: the same session gets the same score, bar, escalation and verdict', p2.bState.length === 0, show(p2.bState, p2cells));

    // ---- Part 3: free text -> the route sqAnalyze really produced vs the state path afterwards ----
    const texts = DB.services.map(s => (s.ui_taxonomy && s.ui_taxonomy.display_name) || s.id)
        .concat(['hang a heavy mirror on my brick wall', 'move my fragile antique cabinet', 'repair a hole in the wall near the fireplace']);
    const FILED_NO_ROUTE = ['LED Bulb Upgrade', 'System Restore or Reset', 'Wall Hole or Crack Repair', 'Wi\u2011Fi Extender Setup'];
    const p3 = { score: [], minConf: [], escalatedBy: [], verdict: [] };
    let p3compared = 0, p3noRoute = [], p3entity = 0;
    for (const text of texts) {
        resetS();
        w._currentRoute = null; w._currentContext = null;
        w.document.getElementById('sqDescIn').value = text;
        w.document.getElementById('sqUnifiedActionBtn').click();
        const route = w._currentRoute;
        const c = route && route.confidence;
        if (!c) { p3noRoute.push(text); continue; }
        quoteVsConfidence(`free text "${text}"`, { score: c.score, minConf: c.minConf, escalatedBy: c.escalatedBy, meets: c.score >= c.minConf, entity: route.entity,
            quoteView: route.quote && route.quote.liveStrategy ? { score: route.quote.totalConfidence, minConf: route.quote.liveStrategy.minimum_quote_confidence, escalatedBy: route.quote.escalatedBy, meets: route.quote.meetsConfidenceBar } : null });
        const o = { score: c.score, minConf: c.minConf, escalatedBy: c.escalatedBy, meets: c.score >= c.minConf };
        if (route.entityType === 'service') S()._svc = route.entity;   // what continuing into a named service does (prefill sets S._svc = svc); a dynamic route has no such step
        const st = fromState();
        if (!st || st.entity !== route.entity) { p3entity++; continue; }   // the state path prices another entity than the route: counted and printed below
        p3compared++;
        const at = `"${text}"`;
        if (!same(o.score, st.score)) p3.score.push(`${at}: orchestrator ${o.score}, state ${st.score}`);
        if (!same(o.minConf, st.minConf)) p3.minConf.push(`${at}: orchestrator ${o.minConf}, state ${st.minConf}`);
        if (!same(o.escalatedBy, st.escalatedBy)) p3.escalatedBy.push(`${at}: orchestrator ${o.escalatedBy}, state ${st.escalatedBy}`);
        if (o.meets !== st.meets) p3.verdict.push(`${at}: orchestrator ${o.meets}, state ${st.meets}`);
    }
    console.log(`\n=== Part 3. Free text: ${texts.length} sentences through the real input bar; ${p3compared} where route and state path price the same entity, ${p3entity} where they price different ones (reported, not compared) ===`);
    check('the sentences that produce no route at all are exactly the filed list (PENDING_DECISIONS #139, L2: sqAnalyze finds nothing for these four services)',
        fmt(p3noRoute.slice().sort()) === fmt(FILED_NO_ROUTE.slice().sort()), `no route for ${fmt(p3noRoute)}, filed ${fmt(FILED_NO_ROUTE)}`);
    check('at least one sentence is compared (an all-excluded sweep proves nothing)', p3compared > 0);
    check('route and state path: same score', p3.score.length === 0, show(p3.score, p3compared));
    check('route and state path: same minimum confidence', p3.minConf.length === 0, show(p3.minConf, p3compared));
    check('route and state path: same escalatedBy', p3.escalatedBy.length === 0, show(p3.escalatedBy, p3compared));
    check('route and state path: same bar verdict', p3.verdict.length === 0, show(p3.verdict, p3compared));

    // ---- Part 4: inside the orchestrator, one formula ----
    console.log(`\n=== Part 4. Inside the orchestrator: the quote it prices from and the confidence it reports (${notPriced.length} routes priced no entity: reported, not compared) ===`);
    check('route.quote and route.confidence agree on score, minimum confidence, escalatedBy and verdict, on every entry', quoteDiffs.length === 0,
        `${quoteDiffs.length} differ; first: ${quoteDiffs.slice(0, 2).join(' | ')}`);

    // ---- Part 5: one resolver ----
    console.log('\n=== Part 5. One resolver ===');
    check('resolveConfidence exists as the one confidence function', typeof w.resolveConfidence === 'function');
    check('the gateways above reached it (it was called while they ran)', resolverCalls.n > 0, `resolveConfidence was called ${resolverCalls.n} times`);

    realLog(`\n[confidence convergence] ${pass} passed, ${fail} failed (of ${pass + fail} checks)`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FATAL:', e && e.stack || e); process.exit(1); });
