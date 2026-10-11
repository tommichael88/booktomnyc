#!/usr/bin/env node
/**
 * fold_ssot_typography.js -- the mechanical sweep behind PENDING_DECISIONS #167 item 5 (T168): no invisible lookalike character anywhere in btnyc.json, and no dash but the
 * ASCII hyphen in an option label.
 *
 *   node test_harness/tools/fold_ssot_typography.js [btnyc.json] [--write]
 *
 * WHY A TOOL AND NOT AN EDITOR REPLACE. A label is a key: `then`, a tag's `answers` and `issue_type_fees` point at an option by its exact text, so renaming a label means renaming
 * every string that points at it, in the same pass, and nothing else. This tool changes a string only when the WHOLE string equals a label that needs folding (so a sentence that
 * merely contains a label's words is never touched), applies the same fold to every such string wherever it sits (the label itself, `then` keys, tag answers, `compiled`), and then
 * proves the text it wrote parses to exactly the document the same fold gives on the parsed object. It is byte-preserving everywhere else (no re-indenting, no key reordering).
 *
 * THE RULES (what the operator ruled mechanical, 2026-10-10 19:45 NY, and the one extension, both stated in the ledger entry):
 *   1. INVISIBLE lookalikes (U+2010, U+2011, U+2012, U+2212, U+FE58, U+FE63, U+FF0D) -> "-" in EVERY string and key of the file. They render as a hyphen, so nothing visible changes (a line
 *      may now wrap at it). The extension to the ruling: the ruling named labels; the same character in a service name or a sentence fails the same way when anything compares it.
 *   2. In an OPTION LABEL (module options and chain-embedded options) the visible dashes U+2013 / U+2014 / U+2015 -> ASCII: between two digits "2–3" -> "2-3"; with a space on each
 *      side " — " -> " - ". Any other position is an error (the tool refuses and says where), none exists today. Prose keeps its typography: it is not pointed at.
 *   3. Anything else (NBSP, soft hyphen, zero-width) is an error, not a fold: a human decides what those were meant to be.
 * Curly apostrophes are NOT folded: not ruled, filed (#167 item 5), and ratcheted by verify_ssot_reference_integrity.js.
 *
 * Without --write it prints what it would do and exits 0 (1 if it would refuse); with --write it also writes the file. After a write, run splice_compiled.py --write so `compiled.*` is
 * regenerated from the folded source (P-SYSTEM-NOEDIT) -- the global rule above already folds it textually, and splice must then find nothing to change (the fixed point).
 */
'use strict';
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2), WRITE = args.includes('--write');
const FILE = path.resolve(args.find(a => !a.startsWith('--')) || path.join(__dirname, '..', '..', 'btnyc.json'));
const INVIS_HYPHEN = /[‐‑‒−﹘﹣－]/gu;
const OTHER_INVIS = /[ ­​-‍⁠﻿]/u;
const VISIBLE = /[–—―]/u;

const text = fs.readFileSync(FILE, 'utf8'), D = JSON.parse(text);
const problems = [];

function optionLabels(db) {
    const out = [];
    Object.entries(db.intake_modules).forEach(([id, m]) => (m.client_response || []).forEach((o, i) => out.push({ at: `intake_modules[${id}].client_response[${i}]`, label: String(o.label) })));
    const emb = (owner, ch) => (ch || []).forEach((c, i) => ((c && c.params && c.params.client_response) || []).forEach((o, j) => out.push({ at: `${owner}.intake_chain[${i}].params.client_response[${j}]`, label: String(o.label) })));
    db.services.forEach(s => emb(`services[${s.id}]`, s.intake_chain));
    Object.entries(db.dynamic_services).forEach(([k, d]) => emb(`dynamic_services[${k}]`, d.intake_chain));
    return out;
}
function foldLabel(l, at) {
    let r = l.replace(INVIS_HYPHEN, '-').replace(/(?<=\d)[–—―](?=\d)/gu, '-').replace(/(?<=\S) [–—―] (?=\S)/gu, ' - ');
    if (VISIBLE.test(r)) problems.push(`${at}: "${l}" has a visible dash in a position the rules do not cover`);
    return r;
}

// 1. the label fold map: old label -> new label, for every label that needs one
const folds = new Map();
for (const x of optionLabels(D)) {
    if (OTHER_INVIS.test(x.label)) problems.push(`${x.at}: "${x.label}" holds a space-like or zero-width character; decide by hand`);
    if (VISIBLE.test(x.label) || INVIS_HYPHEN.test(x.label)) { INVIS_HYPHEN.lastIndex = 0; const n = foldLabel(x.label, x.at); if (n !== x.label) folds.set(x.label, n); }
    INVIS_HYPHEN.lastIndex = 0;
}
// a fold may not make two options of one module the same label
for (const [id, m] of Object.entries(D.intake_modules)) {
    const seen = new Map();
    (m.client_response || []).forEach(o => { const n = folds.get(String(o.label)) || String(o.label); if (seen.has(n)) problems.push(`intake_modules[${id}]: "${o.label}" and "${seen.get(n)}" would become the same label "${n}"`); seen.set(n, String(o.label)); });
}

// 2. the same fold on the parsed document: this is the model the text edit must reproduce
const sweep = (v, inLabelKeys) => {
    if (typeof v === 'string') return folds.get(v) || v.replace(INVIS_HYPHEN, '-');
    if (Array.isArray(v)) return v.map(x => sweep(x));
    if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[folds.get(k) || k.replace(INVIS_HYPHEN, '-')] = sweep(v[k]); return o; }
    return v;
};
const model = sweep(D);

// 3. the text edit: whole string literals only
let out = text; const report = [];
const lit = s => JSON.stringify(s);
for (const [oldL, newL] of folds) {
    const a = lit(oldL), b = lit(newL);
    const n = out.split(a).length - 1;
    if (n === 0) { problems.push(`label "${oldL}" is not in the text as a whole string literal (escaped in the file?)`); continue; }
    out = out.split(a).join(b);
    report.push({ oldL, newL, n });
}
let hyphens = 0; out = out.replace(INVIS_HYPHEN, () => { hyphens++; return '-'; });

// 4. the proof
let parsed = null;
try { parsed = JSON.parse(out); } catch (e) { problems.push('the edited text is not JSON: ' + e.message); }
if (parsed && JSON.stringify(parsed) !== JSON.stringify(model)) problems.push('the edited text does not parse to the folded document (the textual edit and the model fold disagree)');

console.log(`[fold_ssot_typography] ${path.basename(FILE)}: ${folds.size} distinct labels folded (${report.reduce((n, r) => n + r.n, 0)} whole-string occurrences: the label and everything that points at it), ${hyphens} further invisible hyphens folded to "-"`);
for (const r of report) console.log(`  ${String(r.n).padStart(2)}x ${JSON.stringify(r.oldL)}  ->  ${JSON.stringify(r.newL)}`);
if (problems.length) { console.log('REFUSED:'); problems.forEach(p => console.log('  - ' + p)); process.exit(1); }
if (WRITE) { fs.writeFileSync(FILE, out); console.log('written. Now: python3 test_harness/tools/splice_compiled.py ' + path.basename(FILE) + ' --write  (regenerates compiled.*; it must find nothing further to change)'); }
else console.log('(dry run; --write to write)');
