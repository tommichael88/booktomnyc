#!/usr/bin/env node
/**
 * tools/charter_reflow.js -- put the Charter on more than one line, changing nothing but line breaks.
 *
 *   node test_harness/tools/charter_reflow.js <in.html> [<out.html>]      re-flow (default: rewrite <in.html> in place)
 *   node test_harness/tools/charter_reflow.js --check <file.html>         exit 1 if re-flowing the file would change it (it is not in shape)
 *
 * Written for #198 (T173; the operator's 01:43 NY ruling "do A now"): the Charter was one 414,261-character document in 133 lines, eleven of them over 1,500
 * characters (the longest 87,693), and the LAST line held the revision-log table, the appendix template and all three scripts. A revision-log row therefore changed
 * the same line the scripts live on, which is what made CodeQL report the scripts' findings as new on every Charter edit (#196), and made every Charter diff unreadable.
 *
 * WHAT IT DOES. It inserts the newline character "\n" at chosen offsets of the source text and does nothing else: no character is removed, replaced or reordered. That
 * is a property the proof tool checks byte by byte (the old file is the new file with some "\n" deleted), so "no content change" is a fact about the bytes, not a claim.
 * The offsets are:
 *   HTML   before the start tag of each block-level element (section, div, p, h1-h6, ul/ol/li, table/thead/tbody/tr, pre, blockquote, details/summary, hr, nav, header,
 *          footer, ...), and before the end tag of each container whose last child is such an element -- one block per line. A table row is one line (its cells stay
 *          together). Only where the break lies between two block boundaries (the start of a container, the end of a block element, or existing whitespace), so no break
 *          is ever put between inline content and what follows it; never inside <pre>, <textarea>, <svg>, <title>, an attribute, or a tag.
 *   CSS    after each "}" (a rule per line) in <style>, found with css-tree's tokenizer, so a "}" inside a string or a comment is not a break.
 *   JS     before each statement that is an element of a body (the program, a block, a switch case) in <script>, found with acorn's AST, so a break is never inside a
 *          string, a regular expression, a template literal's text or a comment.
 * Existing line breaks are kept and never doubled (no blank line is created). Running it again changes nothing (idempotent), which --check relies on.
 *
 * WHY NOT RE-SERIALISE. The Charter is a document the operator owns; a serialiser would also rewrite entities, attribute quotes and void-element syntax. This tool
 * edits the source text and nothing else, so what a parser reads is unchanged and the proof (tools/charter_reflow_proof.js) can show it.
 *
 * The scripts' and style's own text is split only at the points above; a data literal that is one statement stays one line (it is code, alone on its line).
 */
'use strict';
const fs = require('fs'), path = require('path');
const NM = path.join(__dirname, '..', 'node_modules');
const req = n => { try { return require(path.join(NM, n)); } catch { return require(n); } };

// -- which elements are "block" for line-breaking. Deliberately conservative: an element whose default display is inline or inline-block (a, span, code, strong,
//    em, button, input, iframe, svg, img, label, br ...) is never a break point, so a break never lands where a renderer would show a space.
const BLOCK = new Set(['html', 'head', 'body', 'header', 'footer', 'main', 'nav', 'section', 'article', 'aside', 'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'pre', 'blockquote', 'hr', 'details', 'summary', 'figure', 'figcaption', 'form', 'fieldset',
  'meta', 'link', 'title', 'style', 'script', 'template']);
// containers: a break before their END tag is allowed when their last child is a block element (so the closer is not glued to the last line of the last child)
const CONTAINER = new Set(['html', 'head', 'body', 'header', 'footer', 'main', 'nav', 'section', 'article', 'aside', 'div', 'ul', 'ol', 'dl', 'table', 'thead', 'tbody', 'tfoot',
  'details', 'blockquote', 'figure', 'form', 'fieldset', 'template']);
const NO_ENTER = new Set(['pre', 'textarea', 'svg', 'title', 'script', 'style', 'math']);   // the tool does not descend into these (script/style are split by their own rule)
const isWs = s => /^[\t\n\f\r ]*$/.test(s);

function offsetsFor(src) {
  const parse5 = req('parse5');
  const doc = parse5.parse(src, { sourceCodeLocationInfo: true });
  const at = new Set();
  const add = o => { if (o > 0 && src[o - 1] !== '\n' && src[o] !== '\n') at.add(o); };
  const kidsOf = n => (n.content ? n.content.childNodes : n.childNodes) || [];
  const isElem = n => !!n.tagName;
  // is the thing just before `node` a block boundary (or nothing, or whitespace/comment)? That is the only place a break is safe.
  const prevIsBoundary = (parent, i) => {
    const sibs = kidsOf(parent);
    if (i === 0) return BLOCK.has(parent.tagName) || parent.nodeName === '#document-fragment' || parent.nodeName === '#document';
    const p = sibs[i - 1];
    if (p.nodeName === '#comment') return true;
    if (p.nodeName === '#text') return isWs(p.value);
    return isElem(p) && BLOCK.has(p.tagName);
  };
  (function walk(parent, inTpl) {
    const kids = kidsOf(parent);
    kids.forEach((n, i) => {
      if (!isElem(n)) return;
      const loc = n.sourceCodeLocation; if (!loc || !loc.startTag) return;
      if (BLOCK.has(n.tagName) && prevIsBoundary(parent, i)) add(loc.startTag.startOffset);
      if (n.tagName === 'script') splitScript(src, n, add, req);
      else if (n.tagName === 'style') splitStyle(src, n, add, req);
      if (NO_ENTER.has(n.tagName)) return;
      // a break before the END tag of a container whose last child is a block element
      if (CONTAINER.has(n.tagName) && loc.endTag) {
        const k = kidsOf(n); let j = k.length - 1;
        while (j >= 0 && ((k[j].nodeName === '#text' && isWs(k[j].value)) || k[j].nodeName === '#comment')) j--;
        if (j >= 0 && isElem(k[j]) && BLOCK.has(k[j].tagName) && k[j].tagName !== 'pre') add(loc.endTag.startOffset);
      }
      walk(n);
    });
  })(doc);
  return at;
}

function textOffsetOf(n) { const t = (n.childNodes || [])[0]; return t && t.nodeName === '#text' ? { text: t.value, start: t.sourceCodeLocation.startOffset } : null; }

function splitStyle(src, n, add, req) {
  const t = textOffsetOf(n); if (!t) return;
  const csstree = req('css-tree');
  let depth = 0;
  csstree.tokenize(t.text, (type, start, end) => {
    const name = csstree.tokenTypes ? Object.keys(csstree.tokenTypes).find(k => csstree.tokenTypes[k] === type) : null;
    if (name === 'LeftCurlyBracket') depth++;
    else if (name === 'RightCurlyBracket') { depth = Math.max(0, depth - 1); if (end < t.text.length) add(t.start + end); }
  });
  if (t.text.length && t.text[0] !== '\n') add(t.start);                      // the first rule begins its own line, below <style>
  if (t.text.length && t.text[t.text.length - 1] !== '\n') add(t.start + t.text.length);   // and </style> sits on its own line
}

function splitScript(src, n, add, req) {
  if (n.attrs.some(a => a.name === 'src')) return;
  const type = (n.attrs.find(a => a.name === 'type') || {}).value;
  if (type && !/^(text|application)\/(javascript|ecmascript)$|^module$/i.test(type)) return;      // JSON and other data blocks are not touched
  const t = textOffsetOf(n); if (!t) return;
  const acorn = req('acorn');
  let ast; try { ast = acorn.parse(t.text, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true }); } catch { return; }   // unparseable: leave the script as it is
  const lists = [];
  (function visit(node) {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'Program' || node.type === 'BlockStatement' || node.type === 'StaticBlock') lists.push(node.body);
    if (node.type === 'SwitchCase') lists.push(node.consequent);
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v.type === 'string') visit(v);
    }
  })(ast);
  for (const body of lists) for (const s of body) add(t.start + s.start);
  if (t.text.length && t.text[t.text.length - 1] !== '\n') add(t.start + t.text.length);       // </script> on its own line
}

function reflow(src) {
  const at = [...offsetsFor(src)].sort((a, b) => a - b);
  let out = '', last = 0;
  for (const o of at) { out += src.slice(last, o) + '\n'; last = o; }
  out += src.slice(last);
  return { out, inserted: at.length };
}

module.exports = { reflow, offsetsFor };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === '--check') {
    const f = args[1]; const src = fs.readFileSync(f, 'utf8'); const r = reflow(src);
    if (r.inserted) { console.error(`${f}: not in shape -- re-flowing would insert ${r.inserted} line break(s)`); process.exit(1); }
    console.log(`${f}: in shape (re-flowing changes nothing)`); process.exit(0);
  }
  const [inp, outp] = args; if (!inp) { console.error('usage: charter_reflow.js <in.html> [<out.html>] | --check <file>'); process.exit(2); }
  const src = fs.readFileSync(inp, 'utf8'); const r = reflow(src);
  fs.writeFileSync(outp || inp, r.out);
  console.log(`re-flowed ${inp}${outp ? ' -> ' + outp : ''}: ${r.inserted} line break(s) inserted; ${src.split('\n').length} -> ${r.out.split('\n').length} lines`);
}
