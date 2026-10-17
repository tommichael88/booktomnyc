'use strict';
/**
 * span_splice.js -- change a JSON text at many places in ONE pass without moving any other byte (T181).
 *
 * ssot_patch.js (T166) does this one operation at a time and re-parses the whole file after each; that is right for a handful of edits and far too slow for the thousands a carry makes.
 * This reads the text once into a tree of spans (no regexes over content), lets the caller ask for members to be added to, replaced in, or removed from objects named by a path, and
 * returns the new text. Everything that is not named is left byte-for-byte alone: hand layout, inline objects, `50.0`, comments in strings.
 *
 *   const T = scan(text);
 *   const sp = [];                                     // splices
 *   setMembers(T, text, ['intake_modules','x'], { head: [['id','q.x']], after: { question: [[...]] }, tail: [['entity_scope', [...]]] }, sp);
 *   const out = applySplices(text, sp);
 *
 * Placement of an ADDED member: `head` (before the first member), `after:<key>` (right after an existing member), `tail` (after the last member). A member that already exists is REPLACED
 * (its value span only) when its value differs, and left alone when it is deep-equal, so running the same plan twice changes nothing. `remove` lists keys to delete.
 */

function scan(text) {
  let i = 0; const n = text.length;
  const ws = () => { while (i < n) { const c = text.charCodeAt(i); if (c === 32 || c === 10 || c === 13 || c === 9) i++; else break; } };
  const str = () => { const s = i; i++; while (text.charCodeAt(i) !== 34) { if (text.charCodeAt(i) === 92) i++; i++; } i++; return { k: 's', s, e: i }; };
  function val() {
    ws(); const c = text[i];
    if (c === '"') return str();
    if (c === '{') {
      const node = { k: 'o', s: i, e: 0, m: [] }; i++; ws();
      if (text[i] === '}') { i++; node.e = i; return node; }
      for (;;) {
        ws(); const k = str(); const key = JSON.parse(text.slice(k.s, k.e)); ws(); i++ /* : */; const v = val();
        node.m.push({ key, ks: k.s, ke: k.e, v }); ws();
        if (text[i] === ',') { i++; continue; }
        i++; node.e = i; return node;
      }
    }
    if (c === '[') {
      const node = { k: 'a', s: i, e: 0, i: [] }; i++; ws();
      if (text[i] === ']') { i++; node.e = i; return node; }
      for (;;) {
        node.i.push(val()); ws();
        if (text[i] === ',') { i++; continue; }
        i++; node.e = i; return node;
      }
    }
    const s = i; while (i < n && !/[,\]}\s]/.test(text[i])) i++; return { k: 'l', s, e: i };
  }
  const root = val(); ws();
  if (i !== n) throw new Error('trailing text after the JSON value at ' + i);
  return root;
}

function resolve(root, path) {
  let node = root;
  for (const seg of path) {
    if (node.k === 'o') { const m = node.m.find(x => x.key === seg); if (!m) throw new Error('no key ' + JSON.stringify(seg) + ' in ' + JSON.stringify(path)); node = m.v; }
    else if (node.k === 'a') { const v = node.i[seg]; if (!v) throw new Error('no index ' + seg + ' in ' + JSON.stringify(path)); node = v; }
    else throw new Error('cannot descend into a scalar at ' + JSON.stringify(seg) + ' in ' + JSON.stringify(path));
  }
  return node;
}

const isPrim = v => v === null || typeof v !== 'object';
// A compact, deterministic rendering: short flat arrays and objects stay on one line; everything else is indented two spaces from `ind`.
function fmt(v, ind) {
  if (isPrim(v)) return JSON.stringify(v);
  const inline = () => (Array.isArray(v) ? '[' + v.map(x => fmt(x, 0)).join(', ') + ']' : '{' + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ': ' + fmt(x, 0)).join(', ') + '}');
  const flat = Array.isArray(v) ? v.every(isPrim) : Object.values(v).every(isPrim);
  if (Array.isArray(v) ? v.length === 0 : Object.keys(v).length === 0) return Array.isArray(v) ? '[]' : '{}';
  if (flat) { const s = inline(); if (s.length + ind <= 110) return s; }
  const pad = ' '.repeat(ind + 2), end = ' '.repeat(ind);
  if (Array.isArray(v)) return '[\n' + v.map(x => pad + fmt(x, ind + 2)).join(',\n') + '\n' + end + ']';
  return '{\n' + Object.entries(v).map(([k, x]) => pad + JSON.stringify(k) + ': ' + fmt(x, ind + 2)).join(',\n') + '\n' + end + '}';
}
const fmtInline = v => (isPrim(v) ? JSON.stringify(v) : Array.isArray(v) ? '[' + v.map(fmtInline).join(', ') + ']' : '{' + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ': ' + fmtInline(x)).join(', ') + '}');
const indentAt = (text, pos) => { const ls = text.lastIndexOf('\n', pos - 1) + 1; let j = ls; while (text[j] === ' ') j++; return j - ls; };
const sameJson = (a, b) => JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
function sortKeys(v) { if (isPrim(v)) return v; if (Array.isArray(v)) return v.map(sortKeys); const o = {}; for (const k of Object.keys(v).sort()) o[k] = sortKeys(v[k]); return o; }

/** Plan changes to the object at `path`. spec = { head:[[k,v]], after:{key:[[k,v]]}, tail:[[k,v]], remove:[k] }. Pushes { start, end, text, seq } onto `out`. */
function setMembers(root, text, path, spec, out) {
  const node = resolve(root, path);
  if (node.k !== 'o') throw new Error('not an object: ' + JSON.stringify(path));
  const multiline = text.slice(node.s, node.e).includes('\n');
  const byKey = new Map(node.m.map(m => [m.key, m]));
  const seq = () => out.length;
  const add = { head: [], tail: [], after: new Map() };
  const consider = (placement, key, v, afterKey) => {
    const m = byKey.get(key);
    if (m) { const cur = JSON.parse(text.slice(m.v.s, m.v.e)); if (!sameJson(cur, v)) out.push({ start: m.v.s, end: m.v.e, text: fmt(v, indentAt(text, m.ks)), seq: seq() }); return; }
    if (placement === 'head') add.head.push([key, v]); else if (placement === 'tail') add.tail.push([key, v]); else { if (!add.after.has(afterKey)) add.after.set(afterKey, []); add.after.get(afterKey).push([key, v]); }
  };
  for (const [k, v] of spec.head || []) consider('head', k, v);
  for (const [a, list] of Object.entries(spec.after || {})) { for (const [k, v] of list) consider(byKey.has(a) ? 'after' : 'tail', k, v, a); }
  for (const [k, v] of spec.tail || []) consider('tail', k, v);
  const ind = node.m.length ? indentAt(text, node.m[0].ks) : indentAt(text, node.s) + 2;
  const lines = list => list.map(([k, v]) => JSON.stringify(k) + ': ' + (multiline ? fmt(v, ind) : fmtInline(v)));
  if (!node.m.length) {
    const all = [].concat(add.head, [...add.after.values()].flat(), add.tail);
    if (all.length) out.push({ start: node.s, end: node.e, text: multiline ? '{\n' + ' '.repeat(ind) + lines(all).join(',\n' + ' '.repeat(ind)) + '\n' + ' '.repeat(ind - 2) + '}' : '{' + lines(all).join(', ') + '}', seq: seq() });
    return;
  }
  if (add.head.length) out.push({ start: node.m[0].ks, end: node.m[0].ks, text: multiline ? lines(add.head).join(',\n' + ' '.repeat(ind)) + ',\n' + ' '.repeat(ind) : lines(add.head).join(', ') + ', ', seq: seq() });
  for (const [a, list] of add.after) { const m = byKey.get(a); out.push({ start: m.v.e, end: m.v.e, text: (multiline ? ',\n' + ' '.repeat(ind) : ', ') + lines(list).join(multiline ? ',\n' + ' '.repeat(ind) : ', '), seq: seq() }); }
  if (add.tail.length) { const last = node.m[node.m.length - 1]; out.push({ start: last.v.e, end: last.v.e, text: (multiline ? ',\n' + ' '.repeat(ind) : ', ') + lines(add.tail).join(multiline ? ',\n' + ' '.repeat(ind) : ', '), seq: seq() }); }
  for (const k of spec.remove || []) {
    const m = byKey.get(k); if (!m) continue; const idx = node.m.indexOf(m);
    if (node.m.length === 1) out.push({ start: node.s + 1, end: node.e - 1, text: '', seq: seq() });
    else if (idx < node.m.length - 1) out.push({ start: m.ks, end: node.m[idx + 1].ks, text: '', seq: seq() });
    else out.push({ start: node.m[idx - 1].v.e, end: m.v.e, text: '', seq: seq() });
  }
}

/** Add elements to the END of the array at `path` (used for the new top-level registries only through setMembers; kept for completeness). */
function applySplices(text, splices) {
  const s = splices.slice().sort((a, b) => a.start - b.start || a.seq - b.seq);
  const parts = []; let cur = 0;
  for (const sp of s) {
    if (sp.start < cur) throw new Error(`overlapping splices at ${sp.start} (cursor ${cur})`);
    parts.push(text.slice(cur, sp.start), sp.text); cur = sp.end;
  }
  parts.push(text.slice(cur));
  return parts.join('');
}

module.exports = { scan, resolve, setMembers, applySplices, fmt, fmtInline, sameJson };
