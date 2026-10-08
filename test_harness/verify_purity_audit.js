#!/usr/bin/env node
/**
 * verify_purity_audit.js — call-graph-aware purity analysis of qr.html's functions.
 *
 * A function is DIRECTLY impure if its own body contains a DOM/storage marker.
 * A function is TRANSITIVELY impure if it calls (directly or indirectly) any
 * directly-impure function. Only functions that are neither are genuinely safe
 * to move into a pure PricingEngine module untouched.
 */
const fs = require('fs');

const path = require("path");
const REPO_ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(REPO_ROOT, "qr.html"), "utf-8");
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]);

function findBraceBlock(src, startIdx, openCloseIdx) {
    let depth = 0;
    for (let j = openCloseIdx; j < src.length; j++) {
        if (src[j] === "{") {
            depth += 1;
        } else if (src[j] === "}") {
            depth -= 1;
            if (depth === 0) {
                return src.substring(startIdx, j + 1);
            }
        }
    }
    return null;
}

function findAllFunctions(src) {
    const results = [];
    
    for (const m of src.matchAll(/function\s+(\w+)\s*\([^)]*\)\s*\{/g)) {
        const body = findBraceBlock(src, m.index, m.index + m[0].length - 1);
        if (body) results.push([m[1], body]);
    }
    
    for (const m of src.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*\([^)]*\)\s*=>\s*\{/g)) {
        const body = findBraceBlock(src, m.index, m.index + m[0].length - 1);
        if (body) results.push([m[1], body]);
    }

    for (const m of src.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*\([^)]*\)\s*=>\s*(?!\{)/g)) {
        const name = m[1];
        if (results.some(r => r[0] === name)) continue;
        
        let lineEnd = src.indexOf("\n", m.index + m[0].length);
        if (lineEnd === -1) lineEnd = src.length;
        
        const body = src.substring(m.index, lineEnd);
        results.push([name, body]);
    }
    
    return results;
}

const allFns = {};
for (const s of scripts) {
    for (const [name, body] of findAllFunctions(s)) {
        if (!(name in allFns)) {
            allFns[name] = body;
        }
    }
}

const DOM_MARKERS = new RegExp(
    "\\bdocument\\." +
    "|\\bwindow\\.(?!DB)" +
    "|\\balert\\(" +
    "|\\bconfirm\\(" +
    "|\\bprompt\\(" +
    "|getElementById" +
    "|querySelector" +
    "|addEventListener" +
    "|\\.innerHTML\\b" +
    "|\\.style\\." +
    "|createElement" +
    "|classList" +
    "|localStorage" +
    "|sessionStorage" +
    "|\\bS\\.\\w+\\s*=" +
    "|\\bS\\.\\w+\\.push\\(" +
    "|\\bS\\.\\w+\\[\\w*\\]\\s*=" +
    "|\\bState\\.\\w+\\s*=" +
    "|\\bState\\.\\w+\\.push\\(" +
    "|\\.textContent\\s*=" +
    "|\\.disabled\\s*=" +
    "|\\.checked\\s*=" +
    "|\\.value\\s*=(?!=)"
);

const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const nameCallRe = {};
for (const n of Object.keys(allFns)) {
    nameCallRe[n] = new RegExp("\\b" + escapeRegExp(n) + "\\s*\\(");
}

function directCalls(body, selfName) {
    const found = new Set();
    for (const [n, pat] of Object.entries(nameCallRe)) {
        if (n === selfName) continue;
        if (pat.test(body)) found.add(n);
    }
    return found;
}

const directImpure = {};
const callGraph = {};
for (const [name, body] of Object.entries(allFns)) {
    directImpure[name] = DOM_MARKERS.test(body);
    callGraph[name] = directCalls(body, name);
}

const _cache = {};
function isTransitivelyImpure(name, _visiting = new Set()) {
    if (name in _cache) return _cache[name];
    if (_visiting.has(name)) return false;
    
    _visiting.add(name);
    if (directImpure[name]) {
        _cache[name] = true;
        return true;
    }
    
    const callees = callGraph[name] || new Set();
    for (const callee of callees) {
        if (isTransitivelyImpure(callee, _visiting)) {
            _cache[name] = true;
            return true;
        }
    }
    
    _cache[name] = false;
    return false;
}

const results = [];
for (const name of Object.keys(allFns).sort()) {
    const body = allFns[name];
    const lines = (body.match(/\n/g) || []).length + 1;
    results.push({
        name: name,
        lines: lines,
        direct_impure: directImpure[name],
        transitively_impure: isTransitivelyImpure(name),
        calls: Array.from(callGraph[name]).sort(),
    });
}

fs.writeFileSync(path.join(__dirname, "purity_audit.json"), JSON.stringify(results, null, 2));

const trulyPure = results.filter(r => !r.transitively_impure);
console.log(`Total functions analyzed: ${results.length}`);
console.log(`Truly pure (no DOM, transitively): ${trulyPure.length}`);
console.log(`Transitively impure: ${results.length - trulyPure.length}\n`);

console.log("=== TRULY PURE, sorted by size ===");
trulyPure.sort((a, b) => b.lines - a.lines);
for (const r of trulyPure) {
    console.log(`${r.lines.toString().padStart(4)} lines | ${r.name}`);
}