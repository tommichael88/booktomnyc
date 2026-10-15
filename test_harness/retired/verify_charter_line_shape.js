#!/usr/bin/env node
/**
 * verify_charter_line_shape.js -- the Charter's lines are shaped so that one edit is one line (PENDING_DECISIONS #198, T173).
 *
 * THE DEFECT-SHAPE (R-DOMAIN-SHAPE: a workaround is evidence the shape is wrong). The Charter was 133 lines, eleven of them over 1,500 characters (the longest 87,693), and the LAST line
 * held the revision-log table, the appendix template and all three scripts. So appending a revision-log row changed the line the scripts live on: a diff could not be read, and CodeQL
 * (which reports "new alerts in code changed by this pull request" by changed line) marked every finding in the scripts as new (#196). The fix in #196 was to repair the scripts so a log
 * row could pass; this is the shape fix (tools/charter_reflow.js: one block per line, nothing else changed; proof: tools/charter_reflow_proof.js).
 *
 * WHAT IS HELD (a property of the document's lines, not of its words):
 *   1. No line is longer than the ceiling. The ceiling is set above the longest legitimate single-block line (a revision-log or defect-class table row of prose, 4,297 characters as measured
 *      at T173) and far below what the old file had, so a document folded back onto a few lines fails.
 *   2. <script>, <style> and <template> each begin a line and end a line: code and the appendix never share a line with prose, so an edit to one is not an edit to the other.
 *   3. Every table row <tr> begins a line and no line holds two: a revision-log row (or any row) is a one-line diff.
 *   4. The file is in shape: tools/charter_reflow.js finds nothing left to break (idempotent). If this fails after you edited the Charter, run
 *        node test_harness/tools/charter_reflow.js PROJECT_CHARTER.html
 *      and commit the result; it changes line breaks and nothing else.
 *   The checks are not vacuous: each is run on the pre-T173 shape (reconstructed by joining the lines back together) and must FAIL there.
 *
 * Node, no browser, no network.
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = process.env.BTNYC_ROOT ? path.resolve(process.env.BTNYC_ROOT) : path.resolve(__dirname, '..');
const { reflow } = require('./tools/charter_reflow.js');
const CEILING = 6000;

let passed = 0, failed = 0;
const check = (label, ok, detail) => { if (ok) { passed++; console.log(`  ✓ ${label}`); } else { failed++; console.log(`  ✗ ${label}${detail ? ' -- ' + detail : ''}`); } };

const src = fs.readFileSync(path.join(ROOT, 'PROJECT_CHARTER.html'), 'utf8');

// the four properties, as functions of a text, so the same code judges the real file and the folded-back one
const longest = t => { let best = { n: 0, line: 0 }; t.split('\n').forEach((l, i) => { if (l.length > best.n) best = { n: l.length, line: i + 1 }; }); return best; };
const shareLine = (t, tag) => {                      // a start/end tag of `tag` that is not at the start/end of its line
  const bad = [];
  t.split('\n').forEach((l, i) => {
    if (new RegExp(`<${tag}[\\s>]`).test(l) && !new RegExp(`^<${tag}[\\s>]`).test(l)) bad.push(i + 1);
    if (new RegExp(`</${tag}>`).test(l) && !new RegExp(`</${tag}>(</head>|<body[^>]*>)*$`).test(l)) bad.push(i + 1);     // the template's own </head><body> are ignored by the parser and carry no content
  });
  return [...new Set(bad)];
};
const rowsSharing = t => { const bad = []; t.split('\n').forEach((l, i) => { const n = (l.match(/<tr[\s>]/g) || []).length; if (n > 1 || (n === 1 && !/^<tr[\s>]/.test(l))) bad.push(i + 1); }); return bad; };
const slack = t => reflow(t).inserted;

console.log('\n  -- the Charter as it is --');
const L = longest(src);
check(`no line is longer than ${CEILING} characters (the longest is ${L.n}, line ${L.line}; the pre-T173 file had 87,693)`, L.n <= CEILING);
for (const tag of ['script', 'style', 'template']) { const bad = shareLine(src, tag); check(`<${tag}> begins a line and ends a line (code and the appendix never share a line with prose)`, bad.length === 0, `shares a line at ${bad.slice(0, 5).join(', ')}`); }
{ const bad = rowsSharing(src); check('every table row <tr> begins a line and no line holds two (a revision-log row is a one-line diff)', bad.length === 0, `lines ${bad.slice(0, 5).join(', ')}`); }
{ const n = slack(src); check('the file is in shape: tools/charter_reflow.js has nothing left to break', n === 0, `${n} break(s) would be inserted; run: node test_harness/tools/charter_reflow.js PROJECT_CHARTER.html`); }
{
  // the revision log: <section id="changelog"> ... </section>; one header row and one row per revision, each alone on its line
  const lines = src.split('\n'), from = lines.findIndex(l => /^<section id="changelog">/.test(l)), to = lines.findIndex((l, i) => i > from && /^<\/section>/.test(l));
  const block = lines.slice(from, to + 1), trLines = block.filter(l => /<tr[\s>]/.test(l)), rows = block.filter(l => /^<tr><td>20\d\d-\d\d-\d\d<\/td>/.test(l));
  check(`the revision log (<section id="changelog">) is found, with ${rows.length} dated rows and one header row, each <tr> alone on its line`, from >= 0 && to > from && rows.length >= 10 && trLines.length === rows.length + 1 && trLines.every(l => (l.match(/<tr[\s>]/g) || []).length === 1));
  const scriptLines = new Set(lines.map((l, i) => /<script[\s>]/.test(l) ? i : -1).filter(n => n >= 0));
  check('no revision-log row is on a line that holds a script, a style or the template', block.every((l, k) => !scriptLines.has(from + k) && !/<(style|template)[\s>]/.test(l)));
}

console.log('\n  -- not vacuous: a folded Charter (every line outside a <pre> joined: the pre-T173 shape, and worse) fails every property --');
{
  // fold the file back the way it was: join every line that is not inside a <pre> onto the previous one (the pre-T173 file had its newlines only inside <pre> blocks and at a few seams)
  const folded = (() => {
    const out = []; let inPre = false;
    for (const l of src.split('\n')) {
      if (inPre || !out.length) out.push(l); else out[out.length - 1] += l;
      const o = l.lastIndexOf('<pre'), c = l.lastIndexOf('</pre>');
      if (o > c) inPre = true; else if (c > o) inPre = false;
    }
    return out.join('\n');
  })();
  const F = longest(folded);
  check(`ceiling: the folded file has a ${F.n}-character line and fails (> ${CEILING})`, F.n > CEILING);
  check('script/style/template: the folded file has them sharing lines', ['script', 'style', 'template'].some(t => shareLine(folded, t).length > 0));
  check('table rows: the folded file has rows sharing lines', rowsSharing(folded).length > 0);
  check('in shape: the folded file has many breaks left to insert', slack(folded) > 100, `${slack(folded)}`);
}

console.log(`\n[Charter line shape] ${passed} passed, ${failed} failed (of ${passed + failed} checks)`);
process.exit(failed ? 1 : 0);
