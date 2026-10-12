#!/usr/bin/env node
/**
 * ssot_patch.js -- change values in btnyc.json at JSON paths WITHOUT moving any other byte (T166).
 *
 * Why this exists. btnyc.json is hand-formatted and is not a fixed point under JSON.stringify(indent=2): inline objects and the operator's own layout would be
 * reflowed by a load-modify-dump. splice_compiled.py solved that for the compiler-owned keys; this does it for the hand-owned ones. Every operation is located by a path
 * through the real JSON text (a small scanner, no regexes over content), replaced by a span, and checked: the edited text must parse, and must equal the same edit made on the
 * parsed object. Nothing is written unless every operation applied.
 *
 *   node test_harness/tools/ssot_patch.js <patch.json> [btnyc.json] [--write]
 *
 * patch.json is a list of operations; a path is a list of segments (strings for object keys, integers for array indexes), NOT a JSON Pointer, so keys that contain "/" are safe:
 *   { "op": "set",       "path": [...], "value": <json> }       replace the value at the path (it must exist)
 *   { "op": "add",       "path": [...], "value": <json> }       add a new member to the object at the path (the key must not exist yet): path ends at the OBJECT, value is {key: value}
 *   { "op": "rename",    "path": [...], "to": "<key>" }          rename the object key at the path (its value is untouched)
 *   { "op": "append",    "path": [...], "value": <json> }       append an element to the array at the path
 *   { "op": "delete",    "path": [...] }                         remove the array element or object member at the path
 *   { "op": "expect",    "path": [...], "value": <json> }       fail unless the value at the path is deep-equal to `value` (a guard; changes nothing)
 */
'use strict';
const fs = require('fs'), path = require('path');

function skipWs(t, i) { while (i < t.length && /\s/.test(t[i])) i++; return i; }
function endOfString(t, i) { // t[i] === '"'
    i++; while (t[i] !== '"') { if (t[i] === '\\') i++; i++; } return i + 1;
}
function endOfValue(t, i) {
    i = skipWs(t, i); const c = t[i];
    if (c === '"') return endOfString(t, i);
    if (c === '{' || c === '[') {
        const close = c === '{' ? '}' : ']'; i = skipWs(t, i + 1);
        if (t[i] === close) return i + 1;
        for (;;) {
            if (c === '{') { i = endOfString(t, skipWs(t, i)); i = skipWs(t, i); i++; /* : */ }
            i = endOfValue(t, i); i = skipWs(t, i);
            if (t[i] === ',') { i = skipWs(t, i + 1); continue; }
            return i + 1;
        }
    }
    while (i < t.length && !/[,\]}\s]/.test(t[i])) i++; return i;
}
/** Locate the value at `segs`. Returns { vs, ve, ks, ke, parent: {kind, open, close, members:[{ks,ke,vs,ve}]}, index } -- ks/ke are the key span (objects only). */
function locate(t, segs) {
    let i = skipWs(t, 0), parent = null, hit = { vs: i, ve: endOfValue(t, i), ks: null, ke: null, parent: null, index: null };
    for (const seg of segs) {
        i = hit.vs; const c = t[i]; const members = [];
        const open = i;
        if (c === '{') {
            i = skipWs(t, i + 1);
            while (t[i] !== '}') {
                const ks = i, ke = endOfString(t, i); const key = JSON.parse(t.slice(ks, ke));
                i = skipWs(t, ke); i++; i = skipWs(t, i); const vs = i, ve = endOfValue(t, i);
                members.push({ key, ks, ke, vs, ve }); i = skipWs(t, ve); if (t[i] === ',') i = skipWs(t, i + 1);
            }
            const m = members.find(x => x.key === seg); if (!m) throw new Error('no key ' + JSON.stringify(seg));
            hit = { vs: m.vs, ve: m.ve, ks: m.ks, ke: m.ke, parent: { kind: 'object', open, close: i, members }, index: members.indexOf(m) };
        } else if (c === '[') {
            i = skipWs(t, i + 1);
            while (t[i] !== ']') { const vs = i, ve = endOfValue(t, i); members.push({ vs, ve }); i = skipWs(t, ve); if (t[i] === ',') i = skipWs(t, i + 1); }
            const m = members[seg]; if (!m) throw new Error('no index ' + seg);
            hit = { vs: m.vs, ve: m.ve, ks: null, ke: null, parent: { kind: 'array', open, close: i, members }, index: seg };
        } else throw new Error('cannot descend into a scalar at ' + JSON.stringify(seg));
    }
    return hit;
}
function indentOf(t, pos) { const ls = t.lastIndexOf('\n', pos - 1) + 1; return /^\s*/.exec(t.slice(ls, pos))[0].length === pos - ls ? pos - ls : /^\s*/.exec(t.slice(ls))[0].length; }
function render(v, baseIndent) { // JSON.stringify with 2-space indentation, nested lines indented from baseIndent
    return JSON.stringify(v, null, 2).split('\n').map((l, k) => (k ? ' '.repeat(baseIndent) + l : l)).join('\n');
}
function getAt(o, segs) { return segs.reduce((x, s) => x[s], o); }

function apply(text, ops) {
    let t = text;
    for (const op of ops) {
        const before = JSON.parse(t);
        if (op.op === 'expect') { const got = getAt(before, op.path); if (JSON.stringify(got) !== JSON.stringify(op.value)) throw new Error('expect failed at ' + JSON.stringify(op.path) + ': ' + JSON.stringify(got).slice(0, 200)); continue; }
        const h = locate(t, op.path);
        const lineIndent = pos => { const ls = t.lastIndexOf('\n', pos - 1) + 1; return /^ */.exec(t.slice(ls))[0].length; };
        const expected = JSON.parse(JSON.stringify(before));
        if (op.op === 'set') {
            t = t.slice(0, h.vs) + render(op.value, lineIndent(h.vs)) + t.slice(h.ve);
            const par = op.path.length > 1 ? getAt(expected, op.path.slice(0, -1)) : expected; par[op.path[op.path.length - 1]] = op.value;
        } else if (op.op === 'rename') {
            if (h.ks === null) throw new Error('rename needs an object key'); const parObj = getAt(expected, op.path.slice(0, -1));
            if (Object.prototype.hasOwnProperty.call(parObj, op.to)) throw new Error('key exists: ' + op.to);
            t = t.slice(0, h.ks) + JSON.stringify(op.to) + t.slice(h.ke);
            const old = op.path[op.path.length - 1]; const rebuilt = {}; for (const k of Object.keys(parObj)) rebuilt[k === old ? op.to : k] = parObj[k];
            for (const k of Object.keys(parObj)) delete parObj[k]; Object.assign(parObj, rebuilt);
        } else if (op.op === 'append') {
            const arr = getAt(expected, op.path); if (!Array.isArray(arr)) throw new Error('append needs an array');
            if (arr.length) { const last = h.parent && false; const lastEnd = (() => { const hh = locate(t, op.path.concat([arr.length - 1])); return hh; })(); const ind = lineIndent(lastEnd.vs);
                t = t.slice(0, lastEnd.ve) + ',\n' + ' '.repeat(ind) + render(op.value, ind) + t.slice(lastEnd.ve); }
            else { const ind = lineIndent(h.vs) + 2; t = t.slice(0, h.vs) + '[\n' + ' '.repeat(ind) + render(op.value, ind) + '\n' + ' '.repeat(ind - 2) + ']' + t.slice(h.ve); }
            arr.push(op.value);
        } else if (op.op === 'add') {
            const obj = getAt(expected, op.path); const [[k, v]] = Object.entries(op.value); if (Object.prototype.hasOwnProperty.call(obj, k)) throw new Error('key exists: ' + k);
            const members = Object.keys(obj); if (!members.length) throw new Error('add to an empty object is not supported');
            const lastEnd = locate(t, op.path.concat([members[members.length - 1]])); const ind = lineIndent(lastEnd.ks);
            t = t.slice(0, lastEnd.ve) + ',\n' + ' '.repeat(ind) + JSON.stringify(k) + ': ' + render(v, ind) + t.slice(lastEnd.ve);
            obj[k] = v;
        } else if (op.op === 'delete') {
            const p = h.parent; if (!p) throw new Error('cannot delete the root'); const ms = p.members, k = h.index; const idx = p.kind === 'array' ? k : k;
            const m = ms[idx]; const start = p.kind === 'object' ? m.ks : m.vs, end = m.ve;
            if (ms.length === 1) { t = t.slice(0, p.open + 1) + (p.kind === 'object' ? '}' : ']') + t.slice(p.close + 1); }
            else if (idx < ms.length - 1) { const nextStart = p.kind === 'object' ? ms[idx + 1].ks : ms[idx + 1].vs; t = t.slice(0, start) + t.slice(nextStart); }
            else { const prevEnd = ms[idx - 1].ve; t = t.slice(0, prevEnd) + t.slice(end); }
            const par = getAt(expected, op.path.slice(0, -1)); const last = op.path[op.path.length - 1]; if (Array.isArray(par)) par.splice(last, 1); else delete par[last];
        } else throw new Error('unknown op ' + op.op);
        let parsed; try { parsed = JSON.parse(t); } catch (e) { throw new Error('edit produced invalid JSON (' + op.op + ' ' + JSON.stringify(op.path) + '): ' + e.message); }
        if (JSON.stringify(parsed) !== JSON.stringify(expected)) throw new Error('edit does not equal the same edit made on the parsed object (' + op.op + ' ' + JSON.stringify(op.path) + ')');
    }
    return t;
}
module.exports = { apply, locate };
if (require.main === module) {
    const args = process.argv.slice(2).filter(a => a !== '--write'), write = process.argv.includes('--write');
    if (!args[0]) { console.log('usage: ssot_patch.js <patch.json> [btnyc.json] [--write]'); process.exit(2); }
    const file = path.resolve(args[1] || path.join(__dirname, '..', '..', 'btnyc.json'));
    const ops = JSON.parse(fs.readFileSync(args[0], 'utf8')), before = fs.readFileSync(file, 'utf8');
    const after = apply(before, ops);
    console.log(`${ops.length} operations applied; ${before.length} -> ${after.length} bytes; ${write ? 'writing' : 'dry run (add --write)'}`);
    if (write) fs.writeFileSync(file, after);
}
