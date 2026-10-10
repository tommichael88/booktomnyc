#!/usr/bin/env node
/**
 * verify_single_escalation_path.js -- the class detector for "the tag-driven escalation of the confidence bar exists once, and reads the field the SSOT really has".
 *
 * @enforces R-CONF-ONEFORMULA
 * @enforces R-INVARIANT-CANONICAL
 * @enforces R-INVARIANT-DELETION
 * @enforces R-INVARIANT-DUPLICATION-TICKET
 *
 * THE CLASS (R-CONF-ONEFORMULA, R-INVARIANT-CANONICAL): "Any path-specific confidence calculation is a second implementation and a defect." The guided builder kept a second copy of the
 * escalation that applyLiveConfidenceEscalation performs (a tag in force raises the bar and the question cap). The copy had DRIFTED: it read smart_tags.*.effects.complexity_override, a
 * field no tag has (0 of 43), while the engine reads smart_tags.*.escalate_complexity. So the copy never escalated and the engine did, and nothing was red, because nothing compared
 * them. T159 (item B) stopped sqPrepareFlow calling it; T161 (item D) deleted it. The pair of facts that made it possible -- a second implementation of the arithmetic, and a read of a
 * tag field the SSOT does not carry -- are what this file holds, not the name of the function it removes. It asserts six things.
 *
 *   1. THE ARITHMETIC EXISTS ONCE   The escalation's own terms (`minimum_quote_confidence_delta`, `maximum_followup_questions_delta`) are read in exactly one function of the assembled
 *                                   page. A third copy that reads any tag field at all is red here, because it has to read these two to do the work.
 *   2. WHO READS A TAG'S TIER       `escalate_complexity` is read by exactly the functions filed in READERS (a ratchet: a new reader is red, a filed one that is gone is red; the list
 *                                   only shrinks). It has two today, for two purposes (the confidence bar, and the pricing tier); the shared selection loop is PENDING_DECISIONS #149.
 *   3. NO READ OF A FIELD NO TAG HAS  Nothing reads `<x>.effects.complexity_override`. (`complexity_override` itself is live and is read: it is the field on an intake ANSWER, 327 of them,
 *                                   which the pricing path ratchets on. Only the nested tag/answer `effects` shape is retired, v9.6.) The SSOT carries no `effects.complexity_override`
 *                                   anywhere, so nothing is authored into a field that nothing reads.
 *   4. THE SSOT AGREES WITH ITSELF  At least one tag declares `escalate_complexity`; every tier a tag declares is a tier `global_rules.confidence_escalation` defines (an undefined tier makes
 *                                   the engine return "no escalation", silently); both deltas and both caps are numbers.
 *   5. THE RETIRED THING IS GONE    The assembled page holds no `_sqPrepareFlowLegacyEscalation` and no "PHASE_B_FOLLOWUP ... C-05" held note (the note that kept it, released by D).
 *   6. THE REAL BUILDER ESCALATES   Boot the real page and drive the real guided builder (sqPrepareFlow) over every single-action "Other" group with: no tag, each tag that declares
 *                                   `escalate_complexity`, all of them together, and one tag that declares none. The expectation is DERIVED from the SSOT in the file's own terms --
 *                                   worst tier among the active tags (ranked by the SSOT's complexity_tiers.min_minutes), bar = min(cap, bar without tags + that tier's delta), question cap likewise --
 *                                   so no number is frozen here and a recalibrated delta cannot turn it red.
 *
 * NON-VACUITY (the scanner and the behaviour are each shown able to fail; nothing here passes by finding nothing):
 *   - an injected third copy of the arithmetic, an injected `.effects.complexity_override` read, and the live `chosen.complexity_override` read (which must NOT be flagged);
 *   - SSOT mutants: a tag carrying `effects.complexity_override`; a tag declaring a tier the escalation block does not define;
 *   - a PAGE mutant: the engine's read of `escalate_complexity` is renamed in the booted page, and leg 6 must go red (a builder that cannot escalate is seen).
 *
 * WHY THIS IS NOT A GOLDEN OR AN EQUIVALENCE TEST (PHASE_PLAN's standing rule): it keeps no reference output and no copy of any implementation. Legs 1-5 read the page's syntax tree and
 * the SSOT; leg 6 asserts that the real builder agrees with the SSOT's own numbers. B's verify_confidence_convergence.js is the agreement between the three gateways; this is the
 * agreement between the builder and the data, plus the structural guard that a second copy cannot come back.
 *
 * RUN ON ANOTHER TREE (G-INVARIANT-PREFIX; this file is run against the tree as it was BEFORE the fix, and must fail there):
 *     BTNYC_QR_FILE=<tree>/qr.html BTNYC_PAGE_ROOT=<tree> node test_harness/verify_single_escalation_path.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const Q = require('./_qr_blocks.js');
const Page = require('./_page.js');

const REPO_ROOT = process.env.BTNYC_PAGE_ROOT ? path.resolve(process.env.BTNYC_PAGE_ROOT) : path.join(__dirname, '..');
const html = Page.readPage();
const readJson = rel => JSON.parse(fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'));
const SSOT = readJson('btnyc.json');
const SCHEMA = readJson('schema/btnyc_schema.json');
const clone = o => JSON.parse(JSON.stringify(o));

let pass = 0, fail = 0;
const check = (label, ok, detail) => {
    if (ok) { pass++; console.log(`  ✓ ${label}`); }
    else { fail++; console.log(`  ✗ ${label}`); if (detail) console.log(`      ${detail}`); }
};
// A section that throws is a red check naming the exception, never a crash that hides every later section.
const section = async (title, fn) => {
    console.log(`\n=== ${title} ===`);
    try { await fn(); } catch (e) { check(`${title}: ran to completion`, false, String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')); }
};
const fmt = o => JSON.stringify(o, (k, v) => v === undefined ? 'undefined' : v);

// ---- the terms of the class -----------------------------------------------------------------------------------------------------------------------------------------------
const THE_ONE = 'applyLiveConfidenceEscalation';                       // the single implementation (public signature, kept)
const DELTA_KEYS = new Set(['minimum_quote_confidence_delta', 'maximum_followup_questions_delta']);
const TIER_FIELD = 'escalate_complexity';                              // the tag field the SSOT really has
const RETIRED_NESTED = 'complexity_override';                          // read through `.effects.` it is the retired shape; read off an intake answer it is live

// Every function that reads a tag's tier, and why (leg 2). A ratchet: it can shrink, not grow.
const READERS = {
    applyLiveConfidenceEscalation: 'the confidence bar and the follow-up question cap',
    computeUnifiedQuote: 'the pricing tier: the same worst-tier-among-active-tags loop, seeded with the answers\' tier (PENDING_DECISIONS #149)',
};

// ---- the scanner ------------------------------------------------------------------------------------------------------------------------------------------------------------
// Owner = the nearest enclosing function DECLARATION; a read inside an arrow or callback belongs to the function that contains it.
const ownerOf = fns => { for (let i = fns.length - 1; i >= 0; i--) if (fns[i].type === 'FunctionDeclaration' && fns[i].id) return fns[i].id.name; return fns.length ? '(anonymous function)' : '(block top level)'; };
const unwrap = n => (n && n.type === 'ChainExpression') ? n.expression : n;
function scanSource(src, startLine, tag) {
    const out = { delta: [], tier: [], retired: [], live: [], errors: [] };
    const p = Q.tryParseJs(src, startLine);
    if (p.error) { out.errors.push(p.error); return out; }
    Q.walkAst(p.ast, (n, parent, grand, fns) => {
        const isMember = n.type === 'MemberExpression';
        const isPattern = n.type === 'Property' && parent && parent.type === 'ObjectPattern';   // `const { minimum_quote_confidence_delta } = d` is a read
        if (!isMember && !isPattern) return;
        const k = Q.keyName(n);
        if (!k) return;
        const at = { fn: ownerOf(fns), line: startLine + n.loc.start.line - 1, where: tag };
        if (DELTA_KEYS.has(k)) out.delta.push(Object.assign({ key: k }, at));
        if (k === TIER_FIELD) out.tier.push(at);
        if (isMember && k === RETIRED_NESTED) {
            const obj = unwrap(n.object);
            if (obj && obj.type === 'MemberExpression' && Q.keyName(obj) === 'effects') out.retired.push(at);
            else out.live.push(at);
        }
    });
    return out;
}
function scanPage(pageHtml) {
    const all = { delta: [], tier: [], retired: [], live: [], errors: [] };
    for (const b of Q.splitScriptBlocks(pageHtml)) {
        if (!b.src.trim()) continue;
        const r = scanSource(b.src, b.startLine, b.external || `block ${b.index}`);
        for (const k of ['delta', 'tier', 'retired', 'live', 'errors']) all[k].push(...r[k]);
    }
    return all;
}
const owners = list => [...new Set(list.map(x => x.fn))].sort();

// ---- the SSOT side (leg 3 data half, leg 4) ----------------------------------------------------------------------------------------------------------------------------------
function ssotProblems(d) {
    const bad = [];
    // no `effects.complexity_override` anywhere (the retired nested shape)
    (function walk(o, p, parentKey) {
        if (!o || typeof o !== 'object') return;
        for (const k of Object.keys(o)) {
            if (k === RETIRED_NESTED && parentKey === 'effects') bad.push(`effects.complexity_override authored at ${p}/${k}: nothing reads it`);
            walk(o[k], p + '/' + k, k);
        }
    })(d, '', '');
    const esc = d.global_rules && d.global_rules.confidence_escalation;
    const tags = d.smart_tags || {};
    const declared = Object.entries(tags).filter(([, t]) => t && typeof t === 'object' && t[TIER_FIELD] != null);
    if (!declared.length) bad.push('no smart tag declares escalate_complexity: the escalation has nothing to act on');
    if (!esc || typeof esc !== 'object') { bad.push('global_rules.confidence_escalation is missing'); return bad; }
    for (const [id, t] of declared) {
        const def = esc[t[TIER_FIELD]];
        if (!def || typeof def !== 'object') { bad.push(`${id} declares escalate_complexity "${t[TIER_FIELD]}", which confidence_escalation does not define (the engine would silently not escalate)`); continue; }
        for (const dk of DELTA_KEYS) if (typeof def[dk] !== 'number') bad.push(`confidence_escalation.${t[TIER_FIELD]}.${dk} is not a number`);
    }
    for (const ck of ['max_minimum_quote_confidence', 'max_followup_questions_absolute']) if (typeof esc[ck] !== 'number') bad.push(`confidence_escalation.${ck} is not a number`);
    const tiers = d.global_rules && d.global_rules.complexity_tiers;
    if (!tiers || !Object.values(tiers).every(t => typeof t.min_minutes === 'number')) bad.push('global_rules.complexity_tiers does not give every tier a min_minutes to rank by');
    return bad;
}

// ---- the real page, booted -------------------------------------------------------------------------------------------------------------------------------------------------
async function boot(mutateHtml) {
    const dom = new JSDOM(mutateHtml ? mutateHtml(html) : html, {
        url: 'https://tommichael88.github.io/booktomnyc/qr.html',
        runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
        beforeParse(w) {
            const ok = body => ({ ok: true, status: 200, json: async () => clone(body) });
            w.fetch = async u => { const s = String(u); return s.includes('btnyc_schema.json') ? ok(SCHEMA) : s.includes('btnyc.json') ? ok(SSOT) : { ok: false, status: 404 }; };
            w.HTMLElement.prototype.scrollIntoView = function () {};
        },
    });
    const w = dom.window;
    for (let i = 0; i < 200 && !(w.DB && w.DB.services && w.document.getElementById('sqDescIn')); i++) await new Promise(r => setTimeout(r, 100));
    await new Promise(r => setTimeout(r, 300));
    return w;
}

// Leg 6: the builder's stored bar, question cap and escalatedBy, against what the SSOT says they must be. Returns { cells, problems, escalatedCells }.
function builderProblems(w) {
    const DB = w.DB, S = () => w.eval('S');
    const esc = DB.global_rules.confidence_escalation, tiers = DB.global_rules.complexity_tiers;
    const rank = t => (tiers[t] ? tiers[t].min_minutes : -1);                                    // the SSOT's own ordering of tiers
    const tagTier = id => (DB.smart_tags[id] && DB.smart_tags[id][TIER_FIELD]) || null;
    const escalators = Object.keys(DB.smart_tags).filter(id => tagTier(id));
    const neutral = Object.keys(DB.smart_tags).find(id => !tagTier(id));
    const TAG_SETS = [[]].concat(escalators.map(e => [e]), escalators.length > 1 ? [escalators.slice()] : [], neutral ? [[neutral]] : []);
    const groupMap = w.eval('groupMap');
    const cell = (g, stype, tags) => {
        const s = S();
        s.detTagIds = []; s.negatedTagIds = []; s.manTagIds = []; s.inherentTagIds = []; s.answers = {}; s._tagsAffirmed = false; s._affirmedTagSet = [];
        s._negationPivotAccepted = false; s._pendingPivotInfo = null; s._svc = null; s._otherTile = null; s.intent = null; s._autoSelectedFrom = null; s._confidenceStrategy = null; s._escalatedBy = null;
        s.desc = 'fix my ' + g.id; s.stype = stype; s.qty = 1; s._fromBuilder = true;
        s.intent = { category: g.category_id, label: 'x', group: 'x', base: 0, stype, qtyLabel: 'item', key: 'x', _groupId: g.id };
        s.manTagIds = tags.slice();
        w.sqPrepareFlow(true);
        const st = s._confidenceStrategy || {};
        return { minConf: st.minimum_quote_confidence, maxQ: st.maximum_followup_questions, esc: s._escalatedBy || null };
    };
    const problems = []; let cells = 0, escalatedCells = 0;
    for (const g of (DB.group || [])) {
        const real = DB.services.filter(s => s.ui_taxonomy && s.ui_taxonomy.group_id === g.id);
        for (const t of w.buildOtherTilesForGroup(real, g.id, groupMap, DB)) {
            const types = t.uncovered_service_types || [t.service_type];
            if (types.length !== 1) continue;
            const base = cell(g, types[0], []);
            for (const tags of TAG_SETS) {
                const got = tags.length ? cell(g, types[0], tags) : base;
                cells++;
                const worst = tags.map(tagTier).filter(Boolean).sort((a, b) => rank(b) - rank(a))[0] || null;
                const delta = worst && esc[worst];
                const wantMin = delta ? Math.min(esc.max_minimum_quote_confidence, base.minConf + delta.minimum_quote_confidence_delta) : base.minConf;
                const wantQ = delta ? Math.min(esc.max_followup_questions_absolute, base.maxQ + delta.maximum_followup_questions_delta) : base.maxQ;
                if (worst) escalatedCells++;
                const at = `${g.id} ${fmt(tags)}`;
                if (got.esc !== worst) problems.push(`${at}: escalatedBy ${got.esc}, the SSOT says ${worst}`);
                else if (got.minConf !== wantMin) problems.push(`${at}: bar ${got.minConf}, the SSOT says ${wantMin} (base ${base.minConf} + ${delta ? delta.minimum_quote_confidence_delta : 0}, cap ${esc.max_minimum_quote_confidence})`);
                else if (got.maxQ !== wantQ) problems.push(`${at}: question cap ${got.maxQ}, the SSOT says ${wantQ}`);
            }
        }
    }
    return { cells, problems, escalatedCells, escalators, neutral };
}

// ===========================================================================================================================================================================
(async () => {
    const scan = scanPage(html);

    await section('1. the escalation arithmetic exists once', async () => {
        check('the page parses (an unparsed block would hide a copy)', scan.errors.length === 0, fmt(scan.errors.slice(0, 2)));
        for (const key of DELTA_KEYS) {
            const hits = scan.delta.filter(h => h.key === key);
            check(`\`${key}\` is read in exactly one function, ${THE_ONE}`, fmt(owners(hits)) === fmt([THE_ONE]), `read in: ${fmt(hits.map(h => `${h.fn} (${h.where} L${h.line})`))}`);
        }
    });

    await section('2. who reads a tag\'s tier (a filed ratchet)', async () => {
        const got = owners(scan.tier), filed = Object.keys(READERS).sort();
        const added = got.filter(f => !filed.includes(f)), gone = filed.filter(f => !got.includes(f));
        check('every reader of `escalate_complexity` is filed (a new one is a new copy of the selection loop)', added.length === 0, `not filed: ${fmt(added)} -- file it with a ledger entry, or read the tier through the existing function`);
        check('every filed reader still reads it (the list only shrinks: delete the entry when the reader goes)', gone.length === 0, `filed but gone: ${fmt(gone)}`);
    });

    await section('3. nothing reads a field no tag has', async () => {
        check('no read of `<x>.effects.complexity_override` (the retired nested shape) anywhere in the page', scan.retired.length === 0, `read in: ${fmt(scan.retired.map(h => `${h.fn} (${h.where} L${h.line})`))}`);
        check('the scanner SEES the live `complexity_override` read of an intake answer and does not count it as the retired shape', scan.live.length > 0, `${scan.live.length} live reads (${fmt(owners(scan.live))}), ${scan.retired.length} retired`);
    });

    await section('4. the SSOT agrees with itself', async () => {
        const bad = ssotProblems(SSOT);
        check('the SSOT: no authored field that nothing reads, every declared tier defined, deltas and caps are numbers', bad.length === 0, fmt(bad));
        const n = Object.values(SSOT.smart_tags).filter(t => t && t[TIER_FIELD] != null).length;
        console.log(`  (${n} of ${Object.keys(SSOT.smart_tags).length} tags declare escalate_complexity)`);
    });

    await section('5. the retired thing is gone', async () => {
        check('the page has no `_sqPrepareFlowLegacyEscalation` (R-INVARIANT-DELETION: deleted, not deprecated)', !/_sqPrepareFlowLegacyEscalation/.test(html), `${(html.match(/_sqPrepareFlowLegacyEscalation/g) || []).length} occurrences`);
        const held = html.split('\n').filter(l => /PHASE_B_FOLLOWUP/.test(l) && /C-05/.test(l));
        check('the page has no "PHASE_B_FOLLOWUP ... C-05" held note (the note that kept it was released by D)', held.length === 0, `${held.length} lines`);
    });

    await section('6. the real guided builder escalates exactly as the SSOT says', async () => {
        const w = await boot();
        check('the page booted', !!(w.DB && w.DB.services));
        const r = builderProblems(w);
        console.log(`  (${r.cells} cells: single-action "Other" groups x [none, ${r.escalators.map(e => `${e}`).join(', ')}${r.escalators.length > 1 ? ', all together' : ''}, neutral ${r.neutral}]; ${r.escalatedCells} of them carry an escalating tag)`);
        check('at least one escalating cell was driven (a sweep with no escalating tag proves nothing)', r.escalatedCells > 0 && r.escalators.length > 0, `${r.escalatedCells} cells, tags ${fmt(r.escalators)}`);
        check('escalatedBy, the bar and the question cap match the SSOT in every cell', r.problems.length === 0, `${r.problems.length} of ${r.cells} differ; first: ${r.problems.slice(0, 2).join(' | ')}`);
    });

    await section('7. non-vacuity: each leg is shown able to fail', async () => {
        const third = scanSource('function aThirdCopy(d, b) { return b + d.minimum_quote_confidence_delta; }', 1, 'probe');
        check('leg 1 flags an injected third copy of the arithmetic', fmt(owners(third.delta)) === fmt(['aThirdCopy']), fmt(third.delta));
        const destructured = scanSource('function aFourthCopy(d) { const { maximum_followup_questions_delta } = d; return maximum_followup_questions_delta; }', 1, 'probe');
        check('leg 1 flags the arithmetic read through a destructuring pattern', fmt(owners(destructured.delta)) === fmt(['aFourthCopy']), fmt(destructured.delta));
        const retired = scanSource('function aDriftedCopy(tid) { return DB.smart_tags?.[tid]?.effects?.complexity_override; }', 1, 'probe');
        check('leg 3 flags an injected `.effects?.complexity_override` read (the exact shape the deleted copy had)', fmt(owners(retired.retired)) === fmt(['aDriftedCopy']), fmt(retired.retired));
        const live = scanSource('function pricing(chosen) { const ov = chosen.complexity_override; return ov; }', 1, 'probe');
        check('leg 3 does NOT flag the live `chosen.complexity_override` read of an intake answer (not over-broad)', live.retired.length === 0, fmt(live.retired));
        const tier = scanSource('function aSecondLoop(t) { return t?.escalate_complexity; }', 1, 'probe');
        check('leg 2 sees an injected reader of `escalate_complexity`', fmt(owners(tier.tier)) === fmt(['aSecondLoop']), fmt(tier.tier));

        const firstTag = Object.keys(SSOT.smart_tags).find(id => SSOT.smart_tags[id] && !SSOT.smart_tags[id][TIER_FIELD]);
        const m1 = clone(SSOT); m1.smart_tags[firstTag].effects = { complexity_override: 'skilled' };
        check('leg 3 / 4 flag an SSOT whose tag carries `effects.complexity_override`', ssotProblems(m1).some(p => /effects\.complexity_override/.test(p)), fmt(ssotProblems(m1)));
        const escTag = Object.keys(SSOT.smart_tags).find(id => SSOT.smart_tags[id] && SSOT.smart_tags[id][TIER_FIELD]);
        const m2 = clone(SSOT); m2.smart_tags[escTag][TIER_FIELD] = 'critical';
        check('leg 4 flags a tag declaring a tier the escalation block does not define', ssotProblems(m2).some(p => /does not define/.test(p)), fmt(ssotProblems(m2)));
        const m3 = clone(SSOT); delete m3.global_rules.confidence_escalation.max_followup_questions_absolute;
        check('leg 4 flags a missing cap', ssotProblems(m3).some(p => /max_followup_questions_absolute/.test(p)), fmt(ssotProblems(m3)));

        // the page mutant: the engine's read of the tag's tier is renamed, so the engine can no longer escalate; leg 6 must see a builder that does not
        const needle = 'const override = tagDef?.escalate_complexity;';
        let changed = 0;
        const w = await boot(h => {
            const start = h.indexOf('function ' + THE_ONE + '(');
            const i = start < 0 ? -1 : h.indexOf(needle, start);
            if (i < 0 || i - start > 1500) return h;   // the first reader after the engine's own header, and nowhere else
            changed++;
            return h.slice(0, i) + 'const override = tagDef?.escalate_complexity_RENAMED_BY_MUTANT;' + h.slice(i + needle.length);
        });
        check('the mutant edit applied exactly once, inside the engine\'s function', changed === 1, `${changed} edits`);
        const r = builderProblems(w);
        check('leg 6 goes red when the engine can no longer escalate (the behavioural leg can see a builder that does not)', r.problems.length > 0, `${r.problems.length} of ${r.cells} cells differ`);
        check('...and only the cells that carry an escalating tag are red, not the plain ones', r.problems.length > 0 && r.problems.every(p => !p.includes(' []:')), `first: ${r.problems.slice(0, 2).join(' | ')}`);
    });

    console.log(`\n[single escalation path] ${pass} passed, ${fail} failed (of ${pass + fail} checks)`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FATAL:', e && e.stack || e); process.exit(1); });
