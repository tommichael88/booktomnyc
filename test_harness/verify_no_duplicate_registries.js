#!/usr/bin/env node
/**
 * verify_no_duplicate_registries.js -- the class detector for "a registry of the project's own vocabulary is written once".
 *
 * @enforces R-INVARIANT-SINGLEDEF
 * @enforces R-INVARIANT-DUPLICATION-TICKET
 *
 * THE CLASS (R-INVARIANT-SINGLEDEF; the project's label is DEFECT-DUPLICATE-REGISTRY): "Every concept has one definition." A table that ranks the complexity tiers was written three times,
 * each a private copy inside the function that needed it -- {skilled: 1, specialized: 2} in applyLiveConfidenceEscalation and in computeUnifiedQuote, {routine: 0, skilled: 1, specialized: 2}
 * in deriveComplexityTier. They agreed, so nothing was red; a fourth tier, or a reordering, would have been edited in one place and not the others. T162 (item E) replaced them with one
 * frozen table, TIER_RANK. This file holds the class, not the three copies. It asserts five things.
 *
 *   1. THE TIER TABLE EXISTS ONCE   Any object literal keyed by two or more of the SSOT's tier names (global_rules.complexity_tiers, read from the SSOT, not written here) and any array
 *                                   holding two or more of them is a rank table. There is exactly one in the assembled page: the top-level `const TIER_RANK = Object.freeze({...})`.
 *   2. IT AGREES WITH THE SSOT      TIER_RANK has exactly the SSOT's tiers, ranks them in the order of their `min_minutes`, and gives the lowest tier 0 (the code's `(RANK[x] || 0)`
 *                                   idiom is only right because the lowest tier is 0). On a real boot it is frozen and holds those values.
 *   3. NO CONSTANT IS COPIED        No two constant object/array literals of three or more entries are structurally equal anywhere in the page (objects compare irrespective of key
 *                                   order, arrays in order). The ones that exist today are FILED, each with the ledger entry that names it; a new copy is red, and a filed copy that has gone
 *                                   is red too (delete the entry: the list only shrinks). This is the Charter-shaped catch-all for the tier table's cousins.
 *   4. NO BINDING IS DECLARED TWICE No top-level function, const, let, var or class name is declared twice across the page's script blocks (a second declaration silently replaces the
 *                                   first: it is a duplicate definition that no linter reports).
 *   5. NON-VACUITY                  Each leg is shown able to fail on synthetic source: a private tier table, a tier-name array, a structurally equal pair, a pair with the keys in another
 *                                   order, a redeclared function, and a TIER_RANK that disagrees with the SSOT.
 *
 * WHAT THIS DOES NOT COVER (named, so it is not mistaken for more): a SUBSET copy of a registry (a list that is part of a bigger list) other than tier names, a registry written as
 * prose, and constants that hold non-literal values. The two worst-tier LOOPS are not a registry; they are PENDING_DECISIONS #149 and are held by verify_single_escalation_path.js.
 *
 * RUN ON ANOTHER TREE (G-INVARIANT-PREFIX; this file is run against the tree as it was BEFORE the fix, and must fail there):
 *     BTNYC_QR_FILE=<tree>/qr.html BTNYC_PAGE_ROOT=<tree> node test_harness/verify_no_duplicate_registries.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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
const section = async (title, fn) => {
    console.log(`\n=== ${title} ===`);
    try { await fn(); } catch (e) { check(`${title}: ran to completion`, false, String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')); }
};
const fmt = o => JSON.stringify(o);

const TIER_TABLE = 'TIER_RANK';
const TIERS = Object.keys((SSOT.global_rules && SSOT.global_rules.complexity_tiers) || {});          // the SSOT's tier names; never written in this file

// ---- scanning --------------------------------------------------------------------------------------------------------------------------------------------------------------
const ownerOf = fns => { for (let i = fns.length - 1; i >= 0; i--) if (fns[i].type === 'FunctionDeclaration' && fns[i].id) return fns[i].id.name; return fns.length ? '(anonymous function)' : '(block top level)'; };
// The canonical form of a CONSTANT literal, or null when any part is not a constant. Objects: keys sorted (order does not make a different registry); arrays: in order.
const canon = n => {
    if (n.type === 'Literal') return JSON.stringify(n.value);
    if (n.type === 'TemplateLiteral' && n.expressions.length === 0) return JSON.stringify(n.quasis[0].value.cooked);
    if (n.type === 'UnaryExpression' && n.operator === '-' && n.argument.type === 'Literal' && typeof n.argument.value === 'number') return JSON.stringify(-n.argument.value);
    if (n.type === 'ArrayExpression') { const e = n.elements.map(x => x ? canon(x) : null); return e.includes(null) ? null : '[' + e.join(',') + ']'; }
    if (n.type === 'ObjectExpression') {
        const ps = [];
        for (const p of n.properties) {
            if (p.type !== 'Property' || p.computed) return null;
            const v = canon(p.value); if (v === null) return null;
            ps.push(JSON.stringify(p.key.name !== undefined ? p.key.name : String(p.key.value)) + ':' + v);
        }
        return '{' + ps.sort().join(',') + '}';
    }
    return null;
};
const entriesOf = n => n.type === 'ArrayExpression' ? n.elements.length : n.properties.length;
const hashOf = c => crypto.createHash('sha1').update(c).digest('hex').slice(0, 10);

function scanSource(src, startLine, tag) {
    const out = { tierObjs: [], tierArrs: [], consts: [], decls: [], tierRank: null, errors: [] };
    const p = Q.tryParseJs(src, startLine);
    if (p.error) { out.errors.push(p.error); return out; }
    Q.walkAst(p.ast, (n, parent, grand, fns) => {
        const at = { fn: ownerOf(fns), line: startLine + n.loc.start.line - 1, where: tag };
        if (n.type === 'ObjectExpression') {
            const keys = n.properties.filter(x => x.type === 'Property' && !x.computed).map(x => x.key.name !== undefined ? x.key.name : String(x.key.value));
            if (keys.filter(k => TIERS.includes(k)).length >= 2) out.tierObjs.push(Object.assign({ keys, name: parent && parent.type === 'VariableDeclarator' ? parent.id.name : (grand && grand.type === 'VariableDeclarator' ? grand.id.name : null) }, at));
        }
        if (n.type === 'ArrayExpression') {
            const strs = n.elements.filter(e => e && e.type === 'Literal' && typeof e.value === 'string').map(e => e.value);
            if (strs.filter(s => TIERS.includes(s)).length >= 2) out.tierArrs.push(Object.assign({ items: strs }, at));
        }
        if ((n.type === 'ObjectExpression' || n.type === 'ArrayExpression') && entriesOf(n) >= 3) {
            const c = canon(n);
            if (c !== null) out.consts.push(Object.assign({ c, kind: n.type === 'ArrayExpression' ? 'array' : 'object', n: entriesOf(n) }, at));
        }
    });
    for (const st of Q.moduleStatements(p.ast)) {
        const add = (name, kind) => out.decls.push({ name, kind, line: startLine + st.loc.start.line - 1, where: tag });
        if (st.type === 'FunctionDeclaration' && st.id) add(st.id.name, 'function');
        if (st.type === 'ClassDeclaration' && st.id) add(st.id.name, 'class');
        if (st.type === 'VariableDeclaration') for (const d of st.declarations) {
            const names = new Set(); Q.patternNames(d.id, names); names.forEach(nm => add(nm, st.kind));
            if (d.id.type === 'Identifier' && d.id.name === TIER_TABLE) out.tierRank = { kind: st.kind, init: d.init, line: startLine + st.loc.start.line - 1, where: tag };
        }
    }
    return out;
}
function scanPage(pageHtml) {
    const all = { tierObjs: [], tierArrs: [], consts: [], decls: [], tierRank: [], errors: [] };
    for (const b of Q.splitScriptBlocks(pageHtml)) {
        if (!b.src.trim()) continue;
        const r = scanSource(b.src, b.startLine, `block ${b.index}`);
        for (const k of ['tierObjs', 'tierArrs', 'consts', 'decls', 'errors']) all[k].push(...r[k]);
        if (r.tierRank) all.tierRank.push(r.tierRank);
    }
    return all;
}
// groups of structurally equal constants: [{ c, n, kind, sites[] }]
const duplicateGroups = consts => {
    const by = new Map();
    for (const x of consts) (by.get(x.kind + ':' + x.c) || by.set(x.kind + ':' + x.c, []).get(x.kind + ':' + x.c)).push(x);
    return [...by.entries()].filter(([, v]) => v.length > 1).map(([k, v]) => ({ key: hashOf(k), kind: v[0].kind, n: v[0].n, count: v.length, sites: v, c: v[0].c }));
};
const redeclared = decls => {
    const by = new Map();
    for (const d of decls) (by.get(d.name) || by.set(d.name, []).get(d.name)).push(d);
    return [...by.entries()].filter(([, v]) => v.length > 1).map(([name, v]) => ({ name, sites: v }));
};
// Does the TIER_RANK initialiser look like Object.freeze({ literal numbers })? -> { ok, table }
const readTierRank = init => {
    if (!init || init.type !== 'CallExpression' || init.callee.type !== 'MemberExpression' || init.callee.object.name !== 'Object' || init.callee.property.name !== 'freeze' || init.arguments.length !== 1) return { ok: false, why: 'not Object.freeze({...})' };
    const o = init.arguments[0];
    if (o.type !== 'ObjectExpression') return { ok: false, why: 'Object.freeze is not given an object literal' };
    const table = {};
    for (const p of o.properties) {
        if (p.type !== 'Property' || p.computed || p.value.type !== 'Literal' || typeof p.value.value !== 'number') return { ok: false, why: 'an entry is not a literal number' };
        table[p.key.name !== undefined ? p.key.name : String(p.key.value)] = p.value.value;
    }
    return { ok: true, table };
};

// Every duplicate that exists today, and where it is named. KEY = the first 10 hex digits of the sha1 of the canonical form; VALUE = [copies, ledger entry, what it is].
const FILED = {
    'dcda8890b3': [2, '#155', 'the cart\'s initial state, written in `State` and again as the store\'s initial `cart` slice (the store comment says it mirrors State)'],
    '643f4067c7': [2, 'D-C11-2', 'the thermostat words, in both keyword sets of resolveGroupFromIntent'],
    'eb6d80f430': [3, '#155', 'the empty estimate range {min: 0, max: 0, note: \'\'} written three times (a value, not a registry)'],
    'bd12c91780': [2, '#155', 'the "Notes (optional)" label attributes, in two renderers'],
    '2045130333': [2, 'D-C11-3', 'the condition-module list, twice inside bldGetConditionChoices'],
    'ed1d620910': [2, '#155', 'the guided builder\'s fresh BLD state, in sqToggleBuilder and sqRestart'],
};

// ===========================================================================================================================================================================
(async () => {
    const scan = scanPage(html);

    await section('1. the tier rank table exists once', async () => {
        check('the page parses (an unparsed block would hide a copy)', scan.errors.length === 0, fmt(scan.errors.slice(0, 2)));
        check('the SSOT names the tiers (complexity_tiers), so the leg has something to look for', TIERS.length >= 2, fmt(TIERS));
        const named = scan.tierObjs.map(x => `${x.name || '(unnamed)'} in ${x.fn} (${x.where} L${x.line})`);
        check(`exactly one object literal in the page ranks the tiers, and it is ${TIER_TABLE}`, scan.tierObjs.length === 1 && scan.tierObjs[0].name === TIER_TABLE && scan.tierObjs[0].fn === '(block top level)', `found ${scan.tierObjs.length}: ${fmt(named)}`);
        check('no array in the page lists the tier names in an order (an `indexOf` rank)', scan.tierArrs.length === 0, fmt(scan.tierArrs.map(x => `${x.fn} L${x.line} [${x.items}]`)));
    });

    await section('2. TIER_RANK agrees with the SSOT', async () => {
        check(`${TIER_TABLE} is declared once, at the top level of a block, with const`, scan.tierRank.length === 1 && scan.tierRank[0].kind === 'const', `${scan.tierRank.length} declarations`);
        const t = scan.tierRank[0] && readTierRank(scan.tierRank[0].init);
        check(`${TIER_TABLE} is Object.freeze of a literal table of numbers`, !!t && t.ok, t && t.why);
        if (t && t.ok) {
            const ssotOrder = TIERS.slice().sort((a, b) => SSOT.global_rules.complexity_tiers[a].min_minutes - SSOT.global_rules.complexity_tiers[b].min_minutes);
            check('it ranks exactly the SSOT\'s tiers (no more, no fewer)', fmt(Object.keys(t.table).sort()) === fmt(TIERS.slice().sort()), `table ${fmt(Object.keys(t.table))}, SSOT ${fmt(TIERS)}`);
            const byRank = Object.keys(t.table).sort((a, b) => t.table[a] - t.table[b]);
            check('its order is the order of the SSOT\'s min_minutes (a higher tier is a higher rank)', fmt(byRank) === fmt(ssotOrder) && new Set(Object.values(t.table)).size === TIERS.length, `table order ${fmt(byRank)}, min_minutes order ${fmt(ssotOrder)}`);
            check('the lowest tier is 0 (the `(TIER_RANK[x] || 0)` idiom, and an unknown tier, both read as the lowest)', t.table[ssotOrder[0]] === 0, `${ssotOrder[0]} = ${t.table[ssotOrder[0]]}`);
        }
        const w = await boot();
        const live = (() => { try { return { frozen: w.eval('Object.isFrozen(TIER_RANK)'), table: JSON.parse(w.eval('JSON.stringify(TIER_RANK)')) }; } catch (e) { return { error: String(e.message) }; } })();
        check('on a real boot TIER_RANK exists and is frozen', !live.error && live.frozen === true, live.error || `frozen ${live.frozen}`);
        const reads = (html.match(new RegExp('\\b' + TIER_TABLE + '\\b', 'g')) || []).length;
        check('it is read (a constant nothing reads is a dead number)', reads > 1, `${reads} mentions in the page`);
    });

    await section('3. no constant registry is copied', async () => {
        const groups = duplicateGroups(scan.consts);
        const filedKeys = Object.keys(FILED);
        const unfiled = groups.filter(g => !FILED[g.key]);
        const grown = groups.filter(g => FILED[g.key] && g.count > FILED[g.key][0]);
        const gone = filedKeys.filter(k => !groups.find(g => g.key === k) || groups.find(g => g.key === k).count < FILED[k][0]);
        console.log(`  (${scan.consts.length} constant literals of 3+ entries; ${groups.length} groups of structurally equal ones; ${filedKeys.length} filed)`);
        check('every group of structurally equal constants is filed with the ledger entry that names it', unfiled.length === 0,
            unfiled.map(g => `${g.key} x${g.count} (${g.kind}, ${g.n} entries) at ${g.sites.map(s => `${s.fn} L${s.line}`).join(', ')}: ${g.c.slice(0, 80)}`).join(' | '));
        const LEDGER = fs.readFileSync(path.join(REPO_ROOT, 'PENDING_DECISIONS.md'), 'utf8');
        const missing = filedKeys.filter(k => { const ref = FILED[k][1]; return !(ref.startsWith('#') ? new RegExp('^### ' + ref + ' ', 'm') : new RegExp('^\\*\\*' + ref + ' ', 'm')).test(LEDGER); });
        check('every filed group cites a ledger entry that exists in PENDING_DECISIONS.md (R-INVARIANT-DUPLICATION-TICKET: a second copy is ticketed)', missing.length === 0, fmt(missing.map(k => `${k} -> ${FILED[k][1]}`)));
        check('no filed group has gained a copy', grown.length === 0, fmt(grown.map(g => `${g.key}: ${g.count} copies, filed ${FILED[g.key][0]}`)));
        check('every filed group still exists at its filed size (the list only shrinks: delete the entry when the copies go)', gone.length === 0, fmt(gone.map(k => `${k}: ${FILED[k][2]}`)));
    });

    await section('4. no top-level binding is declared twice', async () => {
        const dup = redeclared(scan.decls);
        console.log(`  (${scan.decls.length} top-level declarations across the page's blocks)`);
        check('no function, const, let, var or class name is declared more than once', dup.length === 0, fmt(dup.map(d => `${d.name}: ${d.sites.map(s => `${s.kind} ${s.where} L${s.line}`).join(' & ')}`)));
    });

    await section('5. non-vacuity: each leg is shown able to fail', async () => {
        const priv = scanSource('function aPrivateCopy(t) { const RANK = { skilled: 1, specialized: 2 }; return RANK[t] || 0; }', 1, 'probe');
        check('leg 1 flags a private tier table of two entries (the shape that was in two functions)', priv.tierObjs.length === 1 && priv.tierObjs[0].fn === 'aPrivateCopy', fmt(priv.tierObjs));
        const arr = scanSource('function anIndexOfRank(t) { return [\'routine\', \'skilled\', \'specialized\'].indexOf(t); }', 1, 'probe');
        check('leg 1 flags a tier-name array', arr.tierArrs.length === 1, fmt(arr.tierArrs));
        const good = scanSource('const TIER_RANK = Object.freeze({ routine: 0, skilled: 1, specialized: 2 });', 1, 'probe');
        check('leg 1 sees the one legitimate table as a top-level TIER_RANK (so the check is "exactly one, and it is this one")', good.tierObjs.length === 1 && good.tierObjs[0].name === 'TIER_RANK' && good.tierObjs[0].fn === '(block top level)', fmt(good.tierObjs));
        const pair = scanSource('function a() { return { x: 1, y: "two", z: [3, 4] }; } function b() { return { z: [3, 4], y: "two", x: 1 }; }', 1, 'probe');
        check('leg 3 flags two structurally equal objects, whatever the order of their keys', duplicateGroups(pair.consts).length === 1 && duplicateGroups(pair.consts)[0].count === 2, fmt(duplicateGroups(pair.consts).map(g => g.count)));
        const diff = scanSource('function a() { return ["a", "b", "c"]; } function b() { return ["c", "b", "a"]; } function c() { return { x: 1, y: 2, z: 3 }; } function d() { return { x: 1, y: 2, z: 4 }; }', 1, 'probe');
        check('leg 3 does NOT flag arrays in a different order, or objects with a different value (not over-broad)', duplicateGroups(diff.consts).length === 0, fmt(duplicateGroups(diff.consts)));
        const small = scanSource('function a() { return { x: 1, y: 2 }; } function b() { return { x: 1, y: 2 }; }', 1, 'probe');
        check('leg 3 ignores literals of fewer than three entries (a pair is not a registry)', duplicateGroups(small.consts).length === 0);
        const redecl = scanSource('function f() { return 1; }\nfunction f() { return 2; }\nconst K = 1;', 1, 'probe');
        check('leg 4 flags a function declared twice', redeclared(redecl.decls).length === 1 && redeclared(redecl.decls)[0].name === 'f', fmt(redeclared(redecl.decls)));
        const wrong = scanSource('const TIER_RANK = Object.freeze({ routine: 0, skilled: 2, specialized: 1 });', 1, 'probe');
        const wt = readTierRank(wrong.tierRank.init);
        const ssotOrder = TIERS.slice().sort((a, b) => SSOT.global_rules.complexity_tiers[a].min_minutes - SSOT.global_rules.complexity_tiers[b].min_minutes);
        const byRank = Object.keys(wt.table).sort((a, b) => wt.table[a] - wt.table[b]);
        check('leg 2 flags a TIER_RANK whose order disagrees with the SSOT', wt.ok && fmt(byRank) !== fmt(ssotOrder), fmt(byRank));
        const notFrozen = scanSource('const TIER_RANK = { routine: 0, skilled: 1, specialized: 2 };', 1, 'probe');
        check('leg 2 flags a TIER_RANK that is not Object.freeze(...)', !readTierRank(notFrozen.tierRank.init).ok);
    });

    console.log(`\n[duplicate registries] ${pass} passed, ${fail} failed (of ${pass + fail} checks)`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FATAL:', e && e.stack || e); process.exit(1); });

// ---- the page, booted (leg 2) ----------------------------------------------------------------------------------------------------------------------------------------------
async function boot() {
    const dom = new JSDOM(html, {
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
