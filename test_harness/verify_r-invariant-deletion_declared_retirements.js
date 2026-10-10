#!/usr/bin/env node
/**
 * verify_r-invariant-deletion_declared_retirements.js
 *
 * @enforces R-INVARIANT-DELETION
 *
 * THE RULE (PROJECT_CHARTER.html, R-INVARIANT-DELETION, status: Enforced):
 *   "A retirement is complete when the retired artifact is deleted from source
 *    control. Deprecated-but-present is not a state. Deprecated-but-still-called
 *    is a defect. Any declaration of completion for an architectural migration
 *    must cite the specific removal, or it does not use the word 'complete'."
 *   Enforcement named by the charter: "Source grep against declared-retirement
 *   list."
 *
 * WHAT THIS TEST DOES
 *   1. RETIREMENT GREP. For every name in retirements.json, greps the declared
 *      source files for the identifier (whole-word). ANY hit fails: a
 *      definition, a call, an inline HTML handler, or a COMMENT. The operator
 *      directive is literal -- "completion is ... a grep returns zero hits" --
 *      so a comment that names a retired artifact is a hit. Hits are
 *      classified (definition / call / reference / html / comment) only so the
 *      remediation is obvious; classification never downgrades a failure.
 *   2. DEAD-S-FIELD RESIDUE. The directive also requires that "every S.* field
 *      whose only consumer is one of those comes out." Deleting a function
 *      leaves its state fields behind unless someone goes looking (T119 deleted
 *      five functions and left write-only fields such as _pendingPivotInfo,
 *      _negationPivotAccepted and _affirmedTagSet). This detector needs no
 *      declaration: any field initialised in `S = { ... }` that nothing READS
 *      -- in qr.html or in the declared external consumer files -- is dead
 *      state and fails. That makes the requirement self-activating: the moment
 *      a retired function is deleted, every field only it consumed goes red
 *      until it is deleted too. (R-INVARIANT-DETECTOR: instances are patched;
 *      classes are instrumented.)
 *   3. PRECONDITION. The residue detector is only sound if S is never used as
 *      a whole object and never accessed by a computed key (either could read
 *      any field invisibly). That is asserted, not assumed: if it is ever
 *      violated the test fails loudly rather than silently going blind.
 *
 * SCOPE, STATED HONESTLY: this test proves names are absent from the listed
 * source files. It does not prove the canonical path is behaviourally
 * equivalent to what was deleted -- that is the job of the equivalence /
 * sweep tests (R-INVARIANT-NOPATCH, R-INVARIANT-SWEEP), which must be green
 * BEFORE a load-bearing retirement is executed (Battle 12).
 *
 * Exit: 0 = every declared retirement is gone and no dead S state remains.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { check, finish, envelope, RESULTS_DIR, REPO_ROOT } = require('./_shared.js');
const {
    loadQr, splitScriptBlocks, parseJs, tryParseJs, walkAst, keyName, isValueRef, isShadowedBy, isFn,
} = require('./_qr_blocks.js');

// ─── Retirement grep ────────────────────────────────────────────────────
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function lineIndex(text) {
    const starts = [0];
    for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
    return off => {
        let lo = 0, hi = starts.length - 1;
        while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= off) lo = mid; else hi = mid - 1; }
        return { line: lo + 1, col: off - starts[lo] + 1 };
    };
}

/**
 * Comment ranges (html coordinates) for every block that parses, plus the list of blocks that
 * do NOT parse. A block that does not parse cannot be classified, so hits inside it are
 * reported as 'unparsed-block' -- still hits, never silently dropped.
 */
function commentInfo(blocks) {
    const ranges = [], failures = [];
    for (const b of blocks) {
        if (!b.src.trim()) continue;
        const local = [];
        const r = tryParseJs(b.src, b.startLine, { onComment: (_blk, _txt, start, end) => local.push([b.offset + start, b.offset + end]) });
        if (r.error) failures.push({ startLine: b.startLine, offset: b.offset, length: b.src.length, error: r.error });
        else ranges.push(...local);
    }
    return { ranges, failures };
}

function findRetirementHits(text, blocks, name) {
    const re = new RegExp(`(?<![A-Za-z0-9_$])${escapeRe(name)}(?![A-Za-z0-9_$])`, 'g');
    const where = lineIndex(text);
    const info = commentInfo(blocks);
    const inComment = off => info.ranges.some(([s, e]) => off >= s && off < e);
    const inUnparsed = off => info.failures.some(f => off >= f.offset && off < f.offset + f.length);
    const inScript = off => blocks.some(b => off >= b.offset && off < b.offset + b.src.length);
    const lines = text.split('\n');
    const hits = [];
    let m;
    while ((m = re.exec(text)) !== null) {
        const off = m.index;
        const { line, col } = where(off);
        let cls;
        if (!inScript(off)) cls = 'html';
        else if (inUnparsed(off)) cls = 'unparsed-block';
        else if (inComment(off)) cls = 'comment';
        else if (/function\s+$/.test(text.slice(Math.max(0, off - 12), off))) cls = 'definition';
        else if (/^\s*\(/.test(text.slice(off + name.length, off + name.length + 6))) cls = 'call';
        else cls = 'reference';
        hits.push({ line, col, cls, text: (lines[line - 1] || '').trim().slice(0, 100) });
    }
    return hits;
}

// ─── Dead S-field residue ───────────────────────────────────────────────
/**
 * analyzeS(blocks) -> { initKeys:Set, reads:Map<key,[line]>, writes:Map<key,[line]>,
 *                       bare:[line], dynamic:[line] }
 * A field is READ by `S.k`, `S['k']`, `S.k++`, `S.k += 1` (anything that observes it).
 * It is only WRITTEN by `S.k = v` and `delete S.k`. `S = { k: … }` initialises it.
 */
function analyzeS(blocks) {
    const initKeys = new Set();
    const reads = new Map(), writes = new Map();
    const bare = [], dynamic = [], unparsed = [];
    const push = (m, k, line) => { if (!m.has(k)) m.set(k, []); m.get(k).push(line); };

    // Passing S as an ARGUMENT is the architecture this project is moving to (Logic receives state, it does not reach for the
    // global). The detector therefore follows S into the callee's parameter and counts the fields read there. Anything it cannot
    // follow (unknown callee, returned/stored/spread/compared, computed key) stays a whole-object use, which fails the precondition.
    const fnIndex = new Map(); // name -> function node (null when the name is declared more than once: ambiguous)
    for (const b of blocks) {
        if (!b.src.trim()) continue;
        const pr = tryParseJs(b.src, b.startLine);
        if (pr.error) continue;
        walkAst(pr.ast, n => { if (n.type === 'FunctionDeclaration' && n.id) { n._blockStart = b.startLine; fnIndex.set(n.id.name, fnIndex.has(n.id.name) ? null : n); } });
    }
    // `S = factory(...)` installs a whole new state object. Its keys are the keys of the object literal the factory returns
    // (plus later `obj.key = ...` assignments to it); they count as initialised fields. null = cannot tell (stays a whole-object use).
    function factoryKeys(fname) {
        const fn = fnIndex.get(fname);
        if (!fn) return null;
        const keys = new Set(); let retName = null, found = false;
        walkAst(fn.body, (n, p, g, fns) => {
            if (fns.length) return; // the factory's own body only, not nested functions
            if (n.type === 'ReturnStatement' && n.argument) {
                if (n.argument.type === 'ObjectExpression') { found = true; n.argument.properties.forEach(pr => { const k = keyName(pr); if (k) keys.add(k); }); }
                else if (n.argument.type === 'Identifier') retName = n.argument.name;
            }
        });
        if (retName) {
            walkAst(fn.body, (n, p, g, fns) => {
                if (fns.length) return;
                if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.id.name === retName && n.init && n.init.type === 'ObjectExpression') { found = true; n.init.properties.forEach(pr => { const k = keyName(pr); if (k) keys.add(k); }); }
                if (n.type === 'AssignmentExpression' && n.operator === '=' && n.left.type === 'MemberExpression' && n.left.object.type === 'Identifier' && n.left.object.name === retName) { const k = keyName(n.left); if (k) keys.add(k); }
            });
        }
        return found ? keys : null;
    }
    function paramReads(fname, idx, depth, seen) {
        const key = fname + '#' + idx;
        if (seen.has(key)) return { reads: new Set(), unsound: false };
        seen.add(key);
        const fn = fnIndex.get(fname);
        if (!fn || depth > 6) return { reads: new Set(), unsound: true, why: `${fname}: ${!fn ? 'callee not found or declared more than once' : 'call chain deeper than 6'}` };
        const prm = fn.params[idx];
        const b0 = { startLine: fn._blockStart };
        if (!prm) return { reads: new Set(), unsound: false }; // argument ignored by the callee
        const reads = new Set(); let unsound = false, why = '';
        const bad = (n, what) => { unsound = true; if (!why) why = `${fname}: ${what} @L${b0.startLine + n.loc.start.line - 1}`; };
        if (prm.type === 'ObjectPattern') {
            for (const pr of prm.properties) { if (pr.type === 'RestElement') unsound = true; else { const k = keyName(pr); if (k) reads.add(k); else unsound = true; } }
            return { reads, unsound, why: unsound ? `${fname}: rest/computed key in a destructured parameter` : '' };
        }
        if (prm.type !== 'Identifier') return { reads, unsound: true, why: `${fname}: parameter is not a plain identifier` };
        walkAst(fn.body, (n, p, g, fns) => {
            if (n.type !== 'Identifier' || n.name !== prm.name || !isValueRef(n, p) || isShadowedBy(prm.name, fns)) return;
            if (p && p.type === 'MemberExpression' && p.object === n) {
                const k = keyName(p);
                if (k === null) { bad(n, 'computed key on the state parameter'); return; }
                const writeOnly = (g && g.type === 'AssignmentExpression' && g.left === p && g.operator === '=') ||
                    (g && g.type === 'UnaryExpression' && g.operator === 'delete' && g.argument === p);
                if (!writeOnly) reads.add(k);
                return;
            }
            if (p && p.type === 'CallExpression' && p.arguments.includes(n) && p.callee.type === 'Identifier') {
                const r = paramReads(p.callee.name, p.arguments.indexOf(n), depth + 1, seen);
                r.reads.forEach(k => reads.add(k)); if (r.unsound) { unsound = true; if (!why) why = r.why; }
                return;
            }
            bad(n, `state parameter used as a whole value (${p ? p.type : '?'})`);
        });
        return { reads, unsound, why };
    }
    for (const b of blocks) {
        if (!b.src.trim()) continue;
        const pr = tryParseJs(b.src, b.startLine);
        if (pr.error) { unparsed.push({ startLine: b.startLine, error: pr.error }); continue; }
        const ast = pr.ast;
        const L = n => b.startLine + n.loc.start.line - 1;
        walkAst(ast, (n, parent, grand, fns) => {
            if (n.type !== 'Identifier' || n.name !== 'S' || !isValueRef(n, parent) || isShadowedBy('S', fns)) return;
            if (parent && parent.type === 'AssignmentExpression' && parent.left === n) {
                if (parent.operator === '=' && parent.right.type === 'ObjectExpression') {
                    parent.right.properties.forEach(pr => { const k = keyName(pr); if (k) initKeys.add(k); });
                } else if (parent.operator === '=' && parent.right.type === 'CallExpression' && parent.right.callee.type === 'Identifier' && factoryKeys(parent.right.callee.name)) {
                    factoryKeys(parent.right.callee.name).forEach(k => initKeys.add(k));
                } else bare.push(L(n));
                return;
            }
            if (parent && parent.type === 'MemberExpression' && parent.object === n) {
                const k = keyName(parent);
                if (k === null) { dynamic.push(L(n)); return; }
                const writeOnly = (grand && grand.type === 'AssignmentExpression' && grand.left === parent && grand.operator === '=') ||
                    (grand && grand.type === 'UnaryExpression' && grand.operator === 'delete' && grand.argument === parent);
                push(writeOnly ? writes : reads, k, L(n));
                return;
            }
            if (parent && parent.type === 'CallExpression' && parent.arguments.includes(n) && parent.callee.type === 'Identifier') {
                const r = paramReads(parent.callee.name, parent.arguments.indexOf(n), 0, new Set());
                if (!r.unsound) { r.reads.forEach(k => push(reads, k, L(n))); return; }
                bare.push(`L${L(n)} -> ${r.why || 'callee not followable'}`); return;
            }
            bare.push(L(n)); // S returned/stored/spread/passed somewhere the detector cannot follow
        });
        // window.S / globalThis.S are whole-object uses too
        walkAst(ast, (n) => {
            if (n.type === 'MemberExpression' && n.object.type === 'Identifier' && /^(window|globalThis|self)$/.test(n.object.name) && keyName(n) === 'S') bare.push(L(n));
        });
    }
    return { initKeys, reads, writes, bare, dynamic, unparsed };
}

function deadFields(sInfo, consumerTexts) {
    const dead = [];
    for (const k of [...sInfo.initKeys].sort()) {
        if (sInfo.reads.has(k)) continue;
        const re = new RegExp(`(?<![A-Za-z0-9_$])${escapeRe(k)}(?![A-Za-z0-9_$])`);
        const consumer = consumerTexts.find(c => re.test(c.text));
        if (consumer) continue; // read by a declared external consumer: not dead
        dead.push({ field: k, writes: sInfo.writes.get(k) || [] });
    }
    return dead;
}

// ═════════════════════════════════════════════════════════════════════════
// PART 1 -- self-tests: the detectors detect, and leave innocent code alone
// ═════════════════════════════════════════════════════════════════════════
console.log('\n=== Detector self-test ===');
{
    const html = [
        '<button onclick="sqGone()">x</button>',
        '<script>',
        '/** header */',
        'function keepMe() { return 1; }',
        '// historical note: sqGone was replaced',
        'function sqGone() {}',
        'sqGone();',
        'const alias = sqGone;',
        "const other = 'sqGoneX' + sqGoneAlso + xsqGone;",
        '</script>',
    ].join('\n');
    const blocks = splitScriptBlocks(html);
    const hits = findRetirementHits(html, blocks, 'sqGone');
    const by = c => hits.filter(h => h.cls === c).length;
    check('grep classifies an inline HTML handler', by('html') === 1, { got: hits });
    check('grep classifies a comment (and still counts it as a hit)', by('comment') === 1, { got: hits });
    check('grep classifies a definition', by('definition') === 1, { got: hits });
    check('grep classifies a call', by('call') === 1, { got: hits });
    check('grep classifies a bare reference', by('reference') === 1, { got: hits });
    check('grep is whole-word: sqGoneX / sqGoneAlso / xsqGone are NOT hits', hits.length === 5, { expected: 5, got: hits.length });
    check('grep reports correct absolute line numbers', hits.map(h => h.line).join() === '1,5,6,7,8', { expected: '1,5,6,7,8', got: hits.map(h => h.line).join() });
    check('a name that appears nowhere yields zero hits', findRetirementHits(html, blocks, 'neverExisted').length === 0);
}
{
    // a block that does not compile must NOT crash the test, and hits inside it must not be dropped
    const broken = '<script>\nfunction ok(){}\nsqGone();\n}}} not javascript\n</script>';
    const bb = splitScriptBlocks(broken);
    let threw = false, hits = [];
    try { hits = findRetirementHits(broken, bb, 'sqGone'); } catch (e) { threw = true; }
    check('unparseable block: grep does not crash', !threw);
    check('unparseable block: the hit inside it is still reported (as unparsed-block), never silently dropped',
        hits.length === 1 && hits[0].cls === 'unparsed-block', { got: hits });
    const sb = analyzeS(bb);
    check('unparseable block: analyzeS reports it instead of throwing', sb.unparsed.length === 1 && sb.unparsed[0].error.absLine >= 1, { got: sb.unparsed });
}
{
    const mk = code => splitScriptBlocks(`<script>\n${code}\n</script>`);
    const s1 = analyzeS(mk(`function reset(){ S = { a:1, b:2, c:3, d:4 }; }\nfunction f(){ return S.a; }\nfunction g(){ S.b = 5; S.c++; delete S.d; }`));
    check('S init keys are collected from `S = { ... }`', [...s1.initKeys].sort().join() === 'a,b,c,d', { got: [...s1.initKeys] });
    check('a read is a read (S.a)', s1.reads.has('a'));
    check('S.k = v is a write only (b stays unread)', !s1.reads.has('b') && s1.writes.has('b'));
    check('S.k++ counts as a read (c is observed)', s1.reads.has('c'));
    check('delete S.k is a write only (d stays unread)', !s1.reads.has('d') && s1.writes.has('d'));
    check('dead = initialised but never read: b and d', deadFields(s1, []).map(d => d.field).join() === 'b,d', { got: deadFields(s1, []) });
    check('a field read by a declared external consumer is not dead',
        deadFields(s1, [{ file: 'trace.js', text: 'snap.b' }]).map(d => d.field).join() === 'd', { got: deadFields(s1, [{ file: 'trace.js', text: 'snap.b' }]) });
    check('a field that merely SHARES a prefix with a consumer word is still dead',
        deadFields(s1, [{ file: 'trace.js', text: 'bb bravo' }]).map(d => d.field).join() === 'b,d');
    const df = analyzeS(mk(`function reset(){ S = { a:1, b:2, c:3 }; }\nfunction f(){ return g(S); }\nfunction g(st){ return st.a + h(st); }\nfunction h(x){ return x.b; }`));
    check('data-flow: S passed to a Logic function counts the fields read there (a, and b through a second call)', df.reads.has('a') && df.reads.has('b') && !df.reads.has('c') && df.bare.length === 0, { got: { reads: [...df.reads.keys()], bare: df.bare } });
    check('data-flow: a field the callee never reads stays dead (c)', deadFields(df, []).map(d => d.field).join() === 'c', { got: deadFields(df, []) });
    check('data-flow: a callee that RETURNS the state is unfollowable -> whole-object use', analyzeS(mk(`function reset(){ S = { a:1 }; }\nfunction g(st){ return st; }\nfunction f(){ return g(S); }`)).bare.length === 1);
    check('data-flow: an unknown callee (Object.keys) is unfollowable -> whole-object use', analyzeS(mk(`function reset(){ S = { a:1 }; }\nfunction f(){ return Object.keys(S); }`)).bare.length === 1);
    check('data-flow: a computed key inside the callee is unfollowable', analyzeS(mk(`function reset(){ S = { a:1 }; }\nfunction g(st,k){ return st[k]; }\nfunction f(){ return g(S,'a'); }`)).bare.length === 1);
    check('data-flow: a destructured parameter reads exactly its keys', (() => { const r = analyzeS(mk(`function reset(){ S = { a:1, b:2 }; }\nfunction g({ a }){ return a; }\nfunction f(){ return g(S); }`)); return r.reads.has('a') && !r.reads.has('b') && r.bare.length === 0; })());
    const fk = analyzeS(mk(`function mkSeed(){ const seed = { a:1, b:2 }; seed.c = 3; return seed; }\nfunction reset(){ S = mkSeed(); }\nfunction f(){ return S.a; }`));
    check('factory install: `S = factory()` adds the returned object\'s keys as initialised fields and is not a whole-object read',
        [...fk.initKeys].sort().join() === 'a,b,c' && fk.bare.length === 0 && deadFields(fk, []).map(d => d.field).join() === 'b,c', { got: { keys: [...fk.initKeys], bare: fk.bare } });
    check('factory install: an unknown factory is unfollowable -> whole-object use', analyzeS(mk(`function reset(){ S = JSON.parse(x); }`)).bare.length === 1);
    const s2 = analyzeS(mk(`function reset(){ S = { a:1 }; }\nfunction f(){ return Object.keys(S); }`));
    check('precondition: S used as a whole object is detected', s2.bare.length === 1, { got: s2.bare });
    const s3 = analyzeS(mk(`function reset(){ S = { a:1 }; }\nfunction f(k){ return S[k]; }`));
    check('precondition: S[dynamicKey] is detected', s3.dynamic.length === 1, { got: s3.dynamic });
    const s4 = analyzeS(mk(`function reset(){ S = { a:1 }; }\nfunction f(S){ return S.zzz; }`));
    check('a parameter named S shadows the global (no read recorded)', !s4.reads.has('zzz'));
    const s5 = analyzeS(mk(`function reset(){ S = { a:1 }; }\nfunction f(){ return S['a']; }`));
    check("S['a'] (computed string literal) counts as a read of a", s5.reads.has('a'));
}

// ═════════════════════════════════════════════════════════════════════════
// PART 2 -- the real source
// ═════════════════════════════════════════════════════════════════════════
const cfgPath = path.join(__dirname, 'retirements.json');
check('retirements.json (the declared-retirement list) exists and parses', (() => { try { JSON.parse(fs.readFileSync(cfgPath, 'utf8')); return true; } catch (e) { return false; } })());
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
check('every declared retirement names an artifact, a kind, a date and an authority',
    cfg.declared_retirements.every(r => r.name && r.kind && r.declared && r.authority));

const allHits = [];
for (const rel of cfg.source_files) {
    const abs = path.join(REPO_ROOT, rel);
    check(`declared source file exists: ${rel}`, fs.existsSync(abs));
    if (!fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, 'utf8');
    const blocks = splitScriptBlocks(text);

    console.log(`\n=== R-INVARIANT-DELETION: declared retirements are absent from ${rel} ===`);
    for (const r of cfg.declared_retirements) {
        const hits = findRetirementHits(text, blocks, r.name);
        hits.forEach(h => allHits.push(Object.assign({ file: rel, name: r.name }, h)));
        const summary = Object.entries(hits.reduce((a, h) => (a[h.cls] = (a[h.cls] || 0) + 1, a), {})).map(([c, n]) => `${n} ${c}`).join(', ');
        check(`${r.name} is deleted from ${rel} (zero hits)${hits.length ? `  [${hits.length}: ${summary}]` : ''}`, hits.length === 0,
            { expected: 0, got: hits.map(h => `L${h.line} ${h.cls}`) });
        hits.forEach(h => console.log(`      L${h.line}:${h.col} [${h.cls}] ${h.text}`));
    }

    // retired S fields declared by name
    for (const f of cfg.retired_s_fields || []) {
        const hits = findRetirementHits(text, blocks, f);
        check(`retired S field ${f} is deleted from ${rel} (zero hits)`, hits.length === 0, { expected: 0, got: hits.map(h => `L${h.line} ${h.cls}`) });
        hits.forEach(h => console.log(`      L${h.line}:${h.col} [${h.cls}] ${h.text}`));
    }

    // dead-S-field residue
    console.log(`\n=== Dead-S-field residue: every field initialised in S has a reader ===`);
    const sInfo = analyzeS(blocks);
    sInfo.unparsed.forEach(u => console.log(`      script block at qr.html line ${u.startLine} does not compile: ${u.error.message} (qr.html line ${u.error.absLine})`));
    check(`precondition: every script block in ${rel} compiles (${sInfo.unparsed.length} do not) -- a block that cannot be read could hide readers, so no dead-field verdict is sound without this`,
        sInfo.unparsed.length === 0, { expected: 0, got: sInfo.unparsed.map(u => `block @L${u.startLine}: ${u.error.message} @L${u.error.absLine}`) });
    check(`precondition: S is never used as a whole object (${sInfo.bare.length} such uses) -- the residue detector is sound only if this holds`,
        sInfo.bare.length === 0, { expected: 0, got: sInfo.bare });
    check(`precondition: S is never accessed by a computed key (${sInfo.dynamic.length} such uses)`, sInfo.dynamic.length === 0, { expected: 0, got: sInfo.dynamic });
    check(`S initialisation found (${sInfo.initKeys.size} fields)`, sInfo.initKeys.size > 0);

    const consumers = (cfg.s_field_consumer_files || []).map(f => {
        const p = path.join(REPO_ROOT, f);
        return fs.existsSync(p) ? { file: f, text: fs.readFileSync(p, 'utf8') } : null;
    }).filter(Boolean);
    const missingConsumers = (cfg.s_field_consumer_files || []).filter(f => !fs.existsSync(path.join(REPO_ROOT, f)));
    if (missingConsumers.length) console.log(`  note: declared external consumer file(s) not present, treated as reading nothing: ${missingConsumers.join(', ')}`);

    const testFiles = fs.readdirSync(__dirname).filter(f => /^verify_.*\.js$/.test(f) && f !== path.basename(__filename));
    if (sInfo.unparsed.length) {
        console.log('  dead-field verdict NOT EVALUATED: at least one script block does not compile (see the failed precondition above).');
        console.log('  Reporting fields as dead from a partial read of the source would produce false positives, so none are reported.');
    }
    const dead = sInfo.unparsed.length ? [] : deadFields(sInfo, consumers);
    for (const d of dead) {
        const re = new RegExp(`(?<![A-Za-z0-9_$])${escapeRe(d.field)}(?![A-Za-z0-9_$])`);
        const tests = testFiles.filter(f => re.test(fs.readFileSync(path.join(__dirname, f), 'utf8')));
        check(`S.${d.field} has a reader (write-only state is dead state)`, false,
            { expected: 'at least one reader', got: { writes: d.writes, tests_referencing: tests } });
        console.log(`      written at ${d.writes.length ? d.writes.map(l => 'L' + l).join(', ') : '(initialiser only)'}; referenced by ${tests.length} test file(s)${tests.length ? ': ' + tests.join(', ') : ''}`);
    }
    if (!sInfo.unparsed.length) check(`no dead S fields (${sInfo.initKeys.size} fields examined, ${dead.length} dead)`, dead.length === 0, { expected: 0, got: dead.map(d => d.field) });

    try {
        fs.mkdirSync(RESULTS_DIR, { recursive: true });
        fs.writeFileSync(path.join(RESULTS_DIR, 'RETIREMENT_HITS.json'), JSON.stringify(envelope('verify_r-invariant-deletion_declared_retirements',
            { retirement_hits: allHits.length, dead_s_fields: dead.length }, { hits: allHits, dead_s_fields: dead }), null, 2));
    } catch (e) { /* non-fatal */ }
}

finish('R-INVARIANT-DELETION: declared retirements');
