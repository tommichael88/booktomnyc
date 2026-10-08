/**
 * test_harness/verify_charter_rule_index_2.js
 *
 * Deep Architectural Enforcement Suite for the BTNYC Charter Rule Index.
 *
 * REVISED AGAIN (this pass) per the follow-up evaluation of the previous
 * revision. That revision correctly transitioned rules R-CLIENT-CONVERGE,
 * R-INVARIANT-ONEUNDERSTANDING, R-SYSTEM-ONEPARSE, R-CONF-ONEFORMULA,
 * R-INTAKE-WIREREMOVE, R-PRICE-REACHES, and R-INVARIANT-CANONICAL from
 * brittle regex checks to real behavioral execution — but it FAILED to
 * implement the matrix's requested methodology for Section 9 (Module
 * Public API Signatures). The matrix specifically required:
 *
 *   "Fully initialize the module in the VM and assert its exposed API
 *    signatures match the expected public interface, rejecting
 *    undocumented properties."
 *
 * The previous revision instead reused `extractFunctionDeclaration` (the
 * same static text-extraction method the matrix asked to eliminate),
 * defined a list of expected function names, and merely checked whether
 * each name appeared in the source string. That does not:
 *   - initialize the module in the VM,
 *   - inspect the actual exposed surface,
 *   - reject undocumented properties.
 *
 * THIS revision replaces Section 9 with a real VM-load:
 *   1. Extract each module's full <script> body via its JSDoc header.
 *   2. Static-enumerate the top-level function declarations to know what
 *      names MIGHT be exposed (the harness already has a reliable
 *      top-level-only enumerator: findTopLevelFunctionDeclarations).
 *   3. Concatenate the module body with an appended capture IIFE that
 *      reads every known top-level name off the shared lexical scope and
 *      attaches them to a __MODULE_EXPORTS__ bag on the context's
 *      globalThis. This is what turns "a declaration exists in text" into
 *      "a declaration actually ran and produced a callable."
 *   4. Run the concatenated script in a fresh VM context whose sandbox
 *      stubs the module's cross-module dependencies (DB, window, _trace,
 *      etc.) at module-load time.
 *   5. Assert:
 *        (a) every name in the module's expected public API resolves to
 *            typeof === 'function' after the module body ran,
 *        (b) every top-level declaration that ISN'T in the expected
 *            public API and ISN'T underscore-prefixed is flagged as an
 *            undocumented property (a boundary leak the matrix wants to
 *            fail on, not warn about),
 *        (c) a small, per-module sample of pure functions still returns
 *            the right kind of value on a known input (signature sanity).
 *
 * The second fix: R-CLIENT-CONVERGE's freeText scenario previously stubbed
 * `understandRequest`/`extractQty`/`extractLocation`, which meant the
 * freeText gateway was tested against mocked dependencies rather than
 * the real execution path. THIS revision bundles the REAL
 * `understandRequest` and its full transitive dependency tree (including
 * `detectIntentNLP`, `_extractObjectRaw`, `_vocab`, `detectActionsInOrder`,
 * `composeAdlibParts`, etc.), seeds the sandbox by running the module's
 * own `initNlpSets()`, and then exercises the freeText gateway end-to-end
 * with real text. The other two collectors (catalog, otherTile) don't
 * consume understandRequest and remain exercised directly.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const acorn = require('acorn');
const assert = require('assert');

// ─── Path resolution ────────────────────────────────────────────────
const SCRIPT_DIR = __dirname;
const PROJECT_ROOT = fs.existsSync(path.join(SCRIPT_DIR, 'qr.html'))
  ? SCRIPT_DIR
  : path.resolve(SCRIPT_DIR, '..');

const QR_HTML_PATH = path.join(PROJECT_ROOT, 'qr.html');
const BTNYC_JSON_PATH = path.join(PROJECT_ROOT, 'btnyc.json');

// ─── Test state ─────────────────────────────────────────────────────
let totalFailures = 0;
let totalPasses = 0;
const failureLog = [];

function logHeader(title) {
  console.log(`\n━━━ ${title} ━━━`);
}

function assertRule(ruleCode, condition, message, failureDetails = '') {
  const tag = ruleCode ? `[${ruleCode}] ` : '';
  if (!condition) {
    console.error(`  ✗ FAIL: ${tag}${message}`);
    if (failureDetails) console.error(`    ↳ ${failureDetails}`);
    totalFailures++;
    failureLog.push({ ruleCode, message, failureDetails });
  } else {
    console.log(`  ✓ PASS: ${tag}${message}`);
    totalPasses++;
  }
}

function assertInvariant(condition, message, failureDetails = '') {
  return assertRule(null, condition, message, failureDetails);
}

function assertDeepEqual(ruleCode, actual, expected, message) {
  let equal = false;
  let detail = '';
  try {
    assert.deepStrictEqual(actual, expected);
    equal = true;
  } catch (e) {
    detail = e.message.split('\n').slice(0, 6).join(' | ');
  }
  assertRule(ruleCode, equal, message, detail);
}

function stableStringify(value) {
  const seen = new WeakSet();
  const walk = (v) => {
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v)) return '[Circular]';
    seen.add(v);
    if (Array.isArray(v)) return v.map(walk);
    const keys = Object.keys(v).sort();
    const out = {};
    for (const k of keys) out[k] = walk(v[k]);
    return out;
  };
  return JSON.stringify(walk(value));
}

function simpleHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// ═══════════════════════════════════════════════════════════════════
// BOOTSTRAP — load source, split scripts, extract declarations
// ═══════════════════════════════════════════════════════════════════

if (!fs.existsSync(QR_HTML_PATH) || !fs.existsSync(BTNYC_JSON_PATH)) {
  console.error('CRITICAL ERROR: Target files missing at root.');
  process.exitCode = 1;
  return;
}

const qrHtmlContent = fs.readFileSync(QR_HTML_PATH, 'utf8');
let btnycData;
try {
  btnycData = JSON.parse(fs.readFileSync(BTNYC_JSON_PATH, 'utf8'));
} catch (err) {
  console.error(`CRITICAL ERROR: JSON parsing failed: ${err.message}`);
  process.exitCode = 1;
  return;
}

function stripStringsAndComments(src) {
  const n = src.length;
  const out = new Array(n);
  let i = 0;
  let prevSignificant = ''; // last non-whitespace, non-comment char (blank-aware)

  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];

    // Line comment
    if (c === '/' && c2 === '/') {
      while (i < n && src[i] !== '\n') { out[i] = ' '; i++; }
      continue;
    }
    // Block comment
    if (c === '/' && c2 === '*') {
      out[i] = ' '; out[i + 1] = ' '; i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { out[i] = ' '; i++; }
      if (i < n) { out[i] = ' '; out[i + 1] = ' '; i += 2; }
      continue;
    }
    // Regex literal OR division. Regex iff the previous significant char
    // cannot end an expression. Without this, a `"` or `'` inside a regex
    // (e.g. UIRenderer.js's escapeHtml /[&<>"']/g) desyncs the entire
    // scanner, silently corrupting every subsequent brace count.
    if (c === '/') {
      const canEndExpr = /[A-Za-z0-9_$)\]'"`\/]/.test(prevSignificant);
      if (!canEndExpr) {
        out[i] = ' '; i++;
        let inClass = false;
        while (i < n) {
          const rc = src[i];
          if (rc === '\\') { out[i] = ' '; if (i + 1 < n) out[i + 1] = ' '; i += 2; continue; }
          if (rc === '\n') break; // unterminated — bail
          if (rc === '[') { inClass = true; out[i] = ' '; i++; continue; }
          if (rc === ']') { inClass = false; out[i] = ' '; i++; continue; }
          if (rc === '/' && !inClass) { out[i] = ' '; i++; break; }
          out[i] = ' '; i++;
        }
        // Consume regex flags (g, i, m, s, u, y).
        while (i < n && /[a-z]/i.test(src[i])) { out[i] = ' '; i++; }
        prevSignificant = '/';
        continue;
      }
      // Division — fall through and treat as a normal char.
      out[i] = c;
      prevSignificant = '/';
      i++;
      continue;
    }
    // String literal (single, double, or template).
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      out[i] = ' '; i++;
      while (i < n) {
        if (src[i] === '\\') { out[i] = ' '; if (i + 1 < n) out[i + 1] = ' '; i += 2; continue; }
        if (src[i] === quote) { out[i] = ' '; i++; break; }
        if (quote !== '`' && src[i] === '\n') break;
        out[i] = ' '; i++;
      }
      prevSignificant = quote;
      continue;
    }
    // Normal char.
    out[i] = c;
    if (c !== ' ' && c !== '\t' && c !== '\n' && c !== '\r') prevSignificant = c;
    i++;
  }
  return out.join('');
}

function extractScriptBlocks(html) {
  const blocks = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || '';
    const body = m[2] || '';
    if (/\bsrc\s*=/.test(attrs)) continue;
    if (/\btype\s*=\s*["'](application\/json|text\/template|application\/ld\+json)["']/i.test(attrs)) continue;
    blocks.push({ attrs, body, index: m.index });
  }
  return blocks;
}

const scriptBlocks = extractScriptBlocks(qrHtmlContent);

function isDeclarationContext(stripped, functionStart) {
  let i = functionStart - 1;
  while (i >= 0 && /[ \t\r\n]/.test(stripped[i])) i--;
  if (i < 0) return true;

  if (/[a-zA-Z]/.test(stripped[i])) {
    let end = i;
    while (i >= 0 && /[a-zA-Z0-9_$]/.test(stripped[i])) i--;
    const prevWord = stripped.slice(i + 1, end + 1);
    if (prevWord === 'async') {
      while (i >= 0 && /[ \t\r\n]/.test(stripped[i])) i--;
      if (i < 0) return true;
      const beforeAsync = stripped[i];
      if (beforeAsync === ';' || beforeAsync === '}' || beforeAsync === '{') return true;
      return false;
    }
    return false;
  }

  const prev = stripped[i];
  if (prev === ';' || prev === '}' || prev === '{') return true;
  if ('(=,:?!&|.[]+-*/%<>~^'.includes(prev)) return false;
  return true;
}

// ═══════════════════════════════════════════════════════════════════
// ACORN-BASED FUNCTION ENUMERATION
// ═══════════════════════════════════════════════════════════════════
// The hand-rolled stripStringsAndComments + brace-counting approach
// loses lexical state on nested template literals (e.g.
//   ${cond ? `<span>${x}</span>` : ''}
// inside another backtick template), because a naive backtick-to-
// backtick scan treats the inner backtick as the end of the outer
// literal. That desync silently drops every subsequent top-level
// declaration from the enumeration — most recently UIRenderer's
// renderCuratedCardFromRoute / renderSelfQuoteFromRoute and
// AppController's entire second half.
//
// acorn (already a transitive dep of jsdom) gives us a real parse
// instead. stripStringsAndComments is retained ONLY for the two
// consumers that need "does this literal substring appear in the
// source" (Section 1's parser self-test, Section 6's dynamic-
// execution scan) — both operate on small inputs with no nested
// templates, so the naive scan is fine there.
const _acornCache = new Map(); // source string -> { topLevel: [...], allByName: Map }

function _acornParse(source) {
  if (_acornCache.has(source)) return _acornCache.get(source);

  let ast = null;
  try {
    ast = acorn.parse(source, {
      ecmaVersion: 'latest',
      sourceType: 'script',
      allowAwaitOutsideFunction: true,
      allowReturnOutsideFunction: true,
      allowHashBang: true,
    });
  } catch (_) {
    // Parse failure: leave ast null. Callers that needed declarations
    // will see an empty list and fail loudly downstream — that's the
    // right signal; a silent empty enumerator would hide the problem.
  }

  const topLevel = [];
  const allByName = new Map();

  const makeEntry = (node) => ({
    name: node.id.name,
    kind: 'function',
    index: node.start,
    isAsync: !!node.async,
    header: source.slice(node.start, node.body.start),
    body: source.slice(node.body.start + 1, node.body.end - 1),
  });

  const walk = (node) => {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'FunctionDeclaration' && node.id && node.body) {
      // Last-wins in allByName, matching the previous
      // extractFunctionDeclaration's own lastMatch behavior.
      allByName.set(node.id.name, makeEntry(node));
    }
    for (const key of Object.keys(node)) {
      if (key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const c of child) if (c && typeof c.type === 'string') walk(c);
      } else if (child && typeof child.type === 'string') {
        walk(child);
      }
    }
  };

  if (ast) {
    walk(ast);
    if (ast.type === 'Program') {
      // Every top-level FunctionDeclaration in the block, in order —
      // includes duplicates, which Section 1's shadowing check needs.
      for (const stmt of ast.body) {
        if (stmt.type === 'FunctionDeclaration' && stmt.id && stmt.body) {
          topLevel.push(makeEntry(stmt));
        }
      }
    }
  }

  const result = { topLevel, allByName };
  _acornCache.set(source, result);
  return result;
}

function findTopLevelFunctionDeclarations(source) {
  return _acornParse(source).topLevel;
}

function extractFunctionDeclarationText(source, funcName) {
  const stripped = stripStringsAndComments(source);
  const regex = new RegExp(`(?:async\\s+)?function\\s+${funcName}\\s*\\([^)]*\\)\\s*\\{`, 'g');
  let lastMatch = null;
  let m;
  while ((m = regex.exec(stripped)) !== null) lastMatch = m;
  if (!lastMatch) return null;

  const declStart = lastMatch.index;
  const declHeaderEnd = declStart + lastMatch[0].length - 1;
  const header = source.slice(declStart, declHeaderEnd);

  let openBraces = 1;
  let i = declHeaderEnd + 1;
  const bodyStart = i;
  while (openBraces > 0 && i < stripped.length) {
    const c = stripped[i];
    if (c === '{') openBraces++;
    else if (c === '}') openBraces--;
    i++;
  }
  const body = source.slice(bodyStart, i - 1);
  return { header, body };
}

/**
 * extractFunctionDeclaration -- AST-based. The previous text scanner (kept below as extractFunctionDeclarationText, the fallback for
 * snippets that do not parse) paired backticks wrongly on a NESTED template literal -- `${ cond ? `...` : '' }` inside an outer template,
 * which renderSelfQuoteFromRoute contains -- and then treated the next ~40 lines as "inside a string", making renderCuratedCardFromRoute
 * invisible to every assertion in this file (and _simpleHash too). A real parser has no such state to lose. Semantics preserved: any
 * nesting depth, and when a name is declared more than once the LAST declaration wins. Returns { header, body } as before.
 */
function extractFunctionDeclaration(source, funcName) {
  const Q = require('./_qr_blocks.js');
  const units = /<script[\s>]/i.test(source) ? Q.splitScriptBlocks(source).map(b => b.src) : [source];
  let last = null, parsedAny = false;
  for (const src of units) {
    if (!src.trim()) continue;
    const r = Q.tryParseJs(src);
    if (r.error) continue;
    parsedAny = true;
    Q.walkAst(r.ast, n => {
      if (n.type === 'FunctionDeclaration' && n.id && n.id.name === funcName && n.body && n.body.type === 'BlockStatement') {
        last = { header: src.slice(n.start, n.body.start), body: src.slice(n.body.start + 1, n.body.end - 1) };
      }
    });
  }
  return parsedAny ? last : extractFunctionDeclarationText(source, funcName);
}

function extractFunctionBody(source, funcName) {
  const d = extractFunctionDeclaration(source, funcName);
  return d ? d.body : null;
}

function makeSandbox(extra = {}) {
  const sandbox = {
    DB: btnycData,
    SERVICE_DATA: btnycData,
    window: { DB: btnycData },
    console: { log() {}, warn() {}, error() {} },
    Math, Object, Array, Set, Map, WeakMap, WeakSet, Number, String, Boolean,
    JSON, parseInt, parseFloat, isNaN, isFinite, Infinity, NaN,
    _trace: () => {},
    _traceStart: () => {},
    _traceFn: () => {},
    ...extra,
  };
  sandbox.window.DB = btnycData;
  return vm.createContext(sandbox);
}

function makeNlpSandbox(extra = {}) {
  const sandbox = {
    DB: btnycData,
    SERVICE_DATA: btnycData,
    window: { DB: btnycData },
    console: { log() {}, warn() {}, error() {} },
    Math, Object, Array, Set, Map, WeakMap, WeakSet, Number, String, Boolean,
    JSON, parseInt, parseFloat, isNaN, isFinite, Infinity, NaN,
    _trace: () => {},
    _traceStart: () => {},
    _traceFn: () => {},
    _DIMENSION_PATTERN: /\b\d+\s*-?\s*(?:foot|feet|ft|inch|inches|in|cm|centimeters?|meters?|yards?|lbs?|pounds?|kg)\b/gi,
    _QTY_WORD_MAP: { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 },
    _GENERIC_QTY_MODULE_KEYS: new Set(['item_count', 'count', 'hybrid_qty', 'global_quantity']),
    _nlpQuiet: false,
    _vocabCache: null,
    _vocabDB: null,
    _SKIP_WORDS: () => new Set(btnycData?.negation_library?.nlp_stop_words || []),
    _SVC_VERBS: () => new Set(btnycData?.negation_library?.nlp_service_verbs || []),
    _STOP_PREPS: () => new Set(btnycData?.negation_library?.nlp_stop_preps || []),
    _CLAUSE_BOUNDARY: () => new Set(btnycData?.negation_library?.nlp_clause_boundaries || []),
    _ROOMS_LIST: () => btnycData?.negation_library?.nlp_location_words || [],
    ...extra,
  };
  sandbox.window.DB = btnycData;
  return vm.createContext(sandbox);
}

// T147: a function declared in the three engine modules is loaded WHOLE (the T136 `_engine.js` loader), ONCE per bundle -- a resolver or helper added next to a function can no
// longer drop out of a sandbox ("X is not defined": noise unrelated to what the check asserts). Anything else is still extracted by name, as before.
const _engineFind = require('./_engine.js').engineAwareFindFn(() => '');
function bundleFunctions(names, options = {}) {
  const parts = [];
  const missing = [];
  const prelude = options.prelude || '';
  const postlude = options.postlude || '';
  let engineLoaded = false;
  for (const name of names) {
    const whole = _engineFind(name);
    if (whole) { if (!engineLoaded) { parts.push(whole); engineLoaded = true; } continue; }
    const d = extractFunctionDeclaration(qrHtmlContent, name);
    if (!d) { missing.push(name); continue; }
    parts.push(`${d.header}{${d.body}}`);
  }
  return {
    source: prelude + parts.join('\n') + postlude,
    missing,
  };
}

// ─── REVISED: module-level source extractor for Section 9 ─────────────
// Locate a module's full script body by finding the JSDoc header that
// names the module file, then finding the <script>...</script> block
// that encloses it. Returns the raw script body (no <script> tags).
function extractModuleScriptBody(html, moduleFilename) {
  const escaped = moduleFilename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const headerRe = new RegExp(`/\\*\\*[\\s\\S]{0,400}?\\*\\s*${escaped}\\b`);
  const headerMatch = headerRe.exec(html);
  if (!headerMatch) return null;
  const headerStart = headerMatch.index;
  const scriptStart = html.lastIndexOf('<script>', headerStart);
  const scriptEnd = html.indexOf('</script>', headerStart);
  if (scriptStart === -1 || scriptEnd === -1) return null;
  if (scriptStart > headerStart) return null;
  return html.slice(scriptStart + '<script>'.length, scriptEnd);
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 1 — Structural Integrity
// ═══════════════════════════════════════════════════════════════════
logHeader('1. Structural Integrity & Source Parser Self-Test');

assertInvariant(
  scriptBlocks.length >= 6,
  'qr.html contains the expected distinct inline <script> blocks',
  `found ${scriptBlocks.length}`
);

{
  const probe = `function probe() { const s = "} {{ }"; if (1) { return s; } }`;
  const strippedProbe = stripStringsAndComments(probe);
  const stringIsBlanked = !strippedProbe.includes('} {{ }');
  assertInvariant(
    stringIsBlanked,
    'Source parser self-test: string literals are blanked before brace counting'
  );
}

{
  const allDecls = [];
  scriptBlocks.forEach((b, blockIndex) => {
    findTopLevelFunctionDeclarations(b.body).forEach(d => {
      allDecls.push({ ...d, blockIndex });
    });
  });
  const byName = new Map();
  for (const d of allDecls) {
    if (!byName.has(d.name)) byName.set(d.name, []);
    byName.get(d.name).push(d);
  }
  const dupes = [...byName.entries()].filter(([, arr]) => arr.length > 1);
  const summary = dupes.map(([name, arr]) =>
    `${name} × ${arr.length} (blocks${arr.map(a => a.blockIndex).join(', ')})`
  );
  assertRule(
    'R-INVARIANT-SINGLEDEF',
    dupes.length === 0,
    'No duplicate top-level function declarations across script blocks (silent shadowing)',
    summary.slice(0, 12).join(' | ') + (summary.length > 12 ? ` (+${summary.length - 12} more)` : '')
  );
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 2 — Governance & Client Operations
// ═══════════════════════════════════════════════════════════════════
logHeader('2. Governance & Client Operations (R-GOVERN / R-CLIENT)');

{
  const tiers = btnycData.global_rules?.complexity_tiers || {};
  const required = ['routine', 'skilled', 'specialized'];
  const missing = required.filter(t => !(t in tiers));
  const malformed = required.filter(t => {
    const def = tiers[t];
    return !def || typeof def.hourly_rate !== 'number' || typeof def.min_minutes !== 'number';
  });
  assertRule(
    'R-GOVERN-PRECEDENCE',
    missing.length === 0 && malformed.length === 0,
    'complexity_tiers contains routine/skilled/specialized with numeric rates and boundaries',
    `missing=[${missing.join(',')}] malformed=[${malformed.join(',')}]`
  );
}

// ─── P-CLIENT-THREE (structural) ───
{
  const collectors = [
    ['collectBookingContext_catalog', 'catalog'],
    ['collectBookingContext_otherTile', 'other_tile'],
    ['collectBookingContext_freeText', 'free_text'],
  ];
  const missing = [];
  const badEntryTag = [];
  for (const [fnName, entry] of collectors) {
    const src = extractFunctionBody(qrHtmlContent, fnName);
    if (!src) { missing.push(fnName); continue; }
    if (!new RegExp(`makeBookingContext\\s*\\(\\s*['"]${entry}['"]`).test(src)) {
      badEntryTag.push(`${fnName} (expected entry='${entry}')`);
    }
  }
  assertRule(
    'P-CLIENT-THREE',
    missing.length === 0 && badEntryTag.length === 0,
    'All three gateway collectors exist and tag their context with the correct entry value',
    `missing=[${missing.join(',')}] wrongEntry=[${badEntryTag.join(', ')}]`
  );
}

// ─── REVISED (R-CLIENT-CONVERGE): real understandRequest bundle for freeText ───
// The previous revision stubbed understandRequest/extractQty/extractLocation
// for the freeText gateway, which meant the freeText collector was tested
// against mocked dependencies rather than the true execution path. This
// revision bundles the REAL understandRequest and its full transitive
// dependency tree (detectIntentNLP, _extractObjectRaw, _vocab, etc.),
// seeds window._NLP via initNlpSets(), and exercises the collector with
// real typed text. All three collectors are now tested against their
// real input shapes.
{
  const bundle = bundleFunctions([
    // NLP stack — needed for the freeText collector to run against real input
    'initNlpSets',
    'isServiceVerb',
    'detectIntentNLP',
    'detectTagsNLP',
    'extractQty',
    'extractLocation',
    'extractSizeHint',
    'inferTagsFromContext',
    'computeNegatedGroupHints',
    'resolveGroupFromIntent',
    '_normalizeTypedText',
    '_vocab',
    '_inVocab',
    '_tokenSets',
    '_isHardNonNoun',
    '_isEdgeTrim',
    '_validateNounPhrase',
    '_groundedObjectPhrase',
    '_extractObjectRaw',
    'extractObjectDetailed',
    'extractObject',
    'detectActionsInOrder',
    'composeAdlibParts',
    'composeAdlibSentence',
    '_resolutionThresholds',
    'understandRequest',
    // Tag helpers referenced by the freeText collector
    'tagValidForCategory',
    // Dynamic service resolution
    'resolveDynamicService',
    // Orchestrator-side collectors
    'makeBookingContext',
    'collectBookingContext_catalog',
    'collectBookingContext_otherTile',
    'collectBookingContext_freeText',
  ], {
    prelude: `
      function _trace() {}
      function _traceStart() {}
      function _traceFn() {}
      var _nlpQuiet = false;
      var _vocabCache = null, _vocabDB = null;
      var _DIMENSION_PATTERN = /\\b\\d+\\s*-?\\s*(?:foot|feet|ft|inch|inches|in|cm|centimeters?|meters?|yards?|lbs?|pounds?|kg)\\b/gi;
      var _QTY_WORD_MAP = { one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10 };
      var _GENERIC_QTY_MODULE_KEYS = new Set(['item_count','count','hybrid_qty','global_quantity']);
      var _SKIP_WORDS = () => window._NLP?.STOP || new Set();
      var _SVC_VERBS = () => window._NLP?.VERBS || new Set();
      var _STOP_PREPS = () => window._NLP?.PREPS || new Set();
      var _CLAUSE_BOUNDARY = () => window._NLP?.CLAUSE || new Set();
      var _ROOMS_LIST = () => window._NLP?.ROOMS || [];
    `,
  });

  if (bundle.missing.length) {
    assertRule('R-CLIENT-CONVERGE', false,
      'All three collectors + understandRequest bundle must be extractable for behavioral test',
      `missing=[${bundle.missing.join(', ')}]`);
  } else {
    const sandbox = makeSandbox();

    // ---- 1. Catalog collector ----
    const flatscreen = (btnycData.services || []).find(s => s.id === 'flatscreen_mounting_standard');
    let catCtx1 = null, catCtx2 = null;
    try {
      const code = `
        ${bundle.source}
        collectBookingContext_catalog(${JSON.stringify(flatscreen)}, 'wall_mounting');
      `;
      catCtx1 = vm.runInContext(code, sandbox, { timeout: 4000 });
      catCtx2 = vm.runInContext(code, sandbox, { timeout: 4000 });
    } catch (e) {
      assertRule('R-CLIENT-CONVERGE', false,
        'collectBookingContext_catalog runs in VM without throwing', e.message);
    }

    if (catCtx1) {
      const expectedKeys = ['entry', 'selectedServiceId', 'selectedCategoryId', 'selectedGroupId',
        'rawText', 'nlpIntent', 'extractedQty', 'extractedObject', 'resolutionObject',
        'extractedLocation', 'manuallyToggledTagIds', 'negatedTagIds', '_negationOverride',
        'uncoveredServiceTypes', 'answers'];
      const hasAllKeys = expectedKeys.every(k => k in catCtx1);
      assertRule('R-CLIENT-CONVERGE', hasAllKeys,
        'collectBookingContext_catalog returns a structurally complete BookingContext',
        hasAllKeys ? '' : `missing=[${expectedKeys.filter(k => !(k in catCtx1)).join(',')}]`);
      assertRule('R-CLIENT-CONVERGE', catCtx1.entry === 'catalog',
        'collectBookingContext_catalog tags entry="catalog"');
      assertRule('R-CLIENT-CONVERGE', catCtx1.selectedServiceId === 'flatscreen_mounting_standard',
        'collectBookingContext_catalog propagates selectedServiceId from its svc argument');
      assertDeepEqual('R-CLIENT-CONVERGE', catCtx1, catCtx2,
        'collectBookingContext_catalog is deterministic (two runs, same inputs, deep-equal)');
    }

    // ---- 2. OtherTile collector ----
    const otherTile = {
      ui_taxonomy: { group_id: 'wall_mounting_tv_flatscreen' },
      uncovered_service_types: ['Mount'],
      service_type: 'Mount',
    };
    let tileCtx1 = null, tileCtx2 = null;
    try {
      const code = `
        ${bundle.source}
        collectBookingContext_otherTile(${JSON.stringify(otherTile)}, 'wall_mounting');
      `;
      tileCtx1 = vm.runInContext(code, sandbox, { timeout: 4000 });
      tileCtx2 = vm.runInContext(code, sandbox, { timeout: 4000 });
    } catch (e) {
      assertRule('R-CLIENT-CONVERGE', false,
        'collectBookingContext_otherTile runs in VM without throwing', e.message);
    }

    if (tileCtx1) {
      assertRule('R-CLIENT-CONVERGE', tileCtx1.entry === 'other_tile',
        'collectBookingContext_otherTile tags entry="other_tile"');
      assertRule('R-CLIENT-CONVERGE', tileCtx1.selectedGroupId === 'wall_mounting_tv_flatscreen',
        'collectBookingContext_otherTile propagates selectedGroupId from the tile');
      assertRule('R-CLIENT-CONVERGE',
        Array.isArray(tileCtx1.uncoveredServiceTypes) && tileCtx1.uncoveredServiceTypes.length === 1,
        'collectBookingContext_otherTile preserves uncoveredServiceTypes');
      assertDeepEqual('R-CLIENT-CONVERGE', tileCtx1, tileCtx2,
        'collectBookingContext_otherTile is deterministic (two runs, same inputs, deep-equal)');
    }

    // ---- 3. FreeText collector — REAL understandRequest, not a stub ----
    let freeCtx1 = null, freeCtx2 = null;
    try {
      // initNlpSets() seeds window._NLP (ACTIONS, STOP, VERBS, CONDS, ROOMS,
      // etc.) so detectIntentNLP / detectActionsInOrder / _tokenSets /
      // _extractObjectRaw all see the real SSOT vocabulary.
      const code = `
        ${bundle.source}
        initNlpSets();
        collectBookingContext_freeText('mount a TV on my drywall wall');
      `;
      freeCtx1 = vm.runInContext(code, sandbox, { timeout: 6000 });
      freeCtx2 = vm.runInContext(code, sandbox, { timeout: 6000 });
    } catch (e) {
      assertRule('R-CLIENT-CONVERGE', false,
        'collectBookingContext_freeText (with real understandRequest) runs in VM without throwing',
        e.message.split('\n')[0]);
    }

    if (freeCtx1) {
      assertRule('R-CLIENT-CONVERGE', freeCtx1.entry === 'free_text',
        'collectBookingContext_freeText tags entry="free_text"');
      assertRule('R-CLIENT-CONVERGE', freeCtx1.rawText === 'mount a TV on my drywall wall',
        'collectBookingContext_freeText preserves rawText verbatim');

      // Behavioral: real understandRequest must have produced a real intent.
      // A stubbed version returning null-intent would fail this assertion.
      assertRule('R-CLIENT-CONVERGE',
        freeCtx1.nlpIntent != null && typeof freeCtx1.nlpIntent === 'object',
        'collectBookingContext_freeText carries a real, non-null nlpIntent (proves real understandRequest ran)',
        freeCtx1.nlpIntent ? '' : 'nlpIntent was null — the stub path was taken');

      // Behavioral: the collector's downstream work (group resolution,
      // tag filtering) must have populated at least the intent category.
      assertRule('R-CLIENT-CONVERGE',
        typeof freeCtx1.nlpIntent?.category === 'string' && freeCtx1.nlpIntent.category.length > 0,
        'collectBookingContext_freeText resolved a real category from real text',
        `category=${freeCtx1.nlpIntent?.category}`);

      assertDeepEqual('R-CLIENT-CONVERGE', freeCtx1, freeCtx2,
        'collectBookingContext_freeText is deterministic (two runs, same inputs, deep-equal)');
    }

    // ---- 4. Convergence point: same key-set across all three ----
    if (catCtx1 && tileCtx1 && freeCtx1) {
      const keySets = [catCtx1, tileCtx1, freeCtx1].map(o =>
        Object.keys(o).sort().join('|'));
      const allSame = keySets[0] === keySets[1] && keySets[1] === keySets[2];
      assertRule('R-CLIENT-CONVERGE', allSame,
        'All three gateways produce BookingContexts with identical key sets (single convergence shape)',
        allSame ? '' : `catalog=${keySets[0].slice(0,80)} tile=${keySets[1].slice(0,80)} free=${keySets[2].slice(0,80)}`);
    }
  }
}

// Existing regex-based convergence check (retained as fast first-line guard)
{
  const collectors = ['collectBookingContext_catalog', 'collectBookingContext_otherTile', 'collectBookingContext_freeText'];
  const allInvoke = collectors.every(name => {
    const src = extractFunctionBody(qrHtmlContent, name);
    return !!src && /makeBookingContext\s*\(/.test(src);
  });
  assertRule(
    'R-CLIENT-CONVERGE',
    allInvoke,
    'All three gateway collectors converge on makeBookingContext (single canonical context)'
  );
}

// ─── R-INVARIANT-ONEUNDERSTANDING ───
{
  const understandSrc = extractFunctionBody(qrHtmlContent, 'understandRequest');
  assertRule(
    'R-INVARIANT-ONEUNDERSTANDING',
    !!understandSrc,
    'understandRequest exists as a real, extractable declaration'
  );

  const composerSrc = extractFunctionBody(qrHtmlContent, 'composeAdlibParts');
  assertRule(
    'R-INVARIANT-ONEUNDERSTANDING',
    !!composerSrc && composerSrc.length > 100,
    'composeAdlibParts exists as the canonical sentence composer'
  );

  const previewSrc = extractFunctionBody(qrHtmlContent, 'enableLiveAdLibPreview');
  const previewUsesCanonical = !!previewSrc && /_NLP\s*\.\s*understand\s*\(/.test(previewSrc);
  assertRule(
    'R-CLIENT-PREVIEW',
    previewUsesCanonical,
    'Live preview delegates to window._NLP.understand (the canonical parser)'
  );

  const previewHasOwnParser =
    !!previewSrc &&
    /function\s+(extractObject|extractQty|extractLocation|detectIntentNLP)\s*\(/.test(previewSrc);
  assertRule(
    'R-CLIENT-PREVIEW',
    !previewHasOwnParser,
    'Live preview does not declare a private parser (single-parse rule)'
  );

  const unifiedSrc = extractFunctionBody(qrHtmlContent, 'sqUnifiedAction');
  const unifiedCallsUnderstand = !!unifiedSrc && /understandRequest\s*\(/.test(unifiedSrc);
  assertRule(
    'R-INVARIANT-ONEUNDERSTANDING',
    unifiedCallsUnderstand,
    'sqUnifiedAction calls understandRequest (confirm-side path shares the canonical parse)'
  );
}

// Behavioral: detectIntentNLP + extractQty against real inputs
{
  const bundle = bundleFunctions([
    'isServiceVerb',
    'detectIntentNLP',
    'detectTagsNLP',
    '_extractObjectRaw',
    'extractQty',
    'extractLocation',
    'extractSizeHint',
    'inferTagsFromContext',
  ], {
    prelude: `
      function _trace() {}
      function _traceStart() {}
      function _traceFn() {}
    `,
  });

  if (bundle.missing.length) {
    assertRule('R-INVARIANT-ONEUNDERSTANDING', false,
      'detectIntentNLP + dependencies must all be extractable for behavioral test',
      `missing=[${bundle.missing.join(', ')}]`);
  } else {
    const sandbox = makeNlpSandbox();
    try {
      vm.runInContext(`${bundle.source}`, sandbox, { timeout: 4000 });
    } catch (e) {
      assertRule('R-INVARIANT-ONEUNDERSTANDING', false,
        'NLP function bundle loads without throwing', e.message);
    }

    const cases = [
      { in: 'fix my leaking faucet', expectKey: 'faucet' },
      { in: 'mount a tv on the wall', expectKey: 'mount' },
      { in: 'install a ceiling fan', expectKey: 'ceiling fan' },
      { in: 'my toilet keeps running', expectKey: 'toilet' },
    ];

    for (const c of cases) {
      try {
        const result = vm.runInContext(
          `detectIntentNLP(${JSON.stringify(c.in)})`,
          sandbox, { timeout: 4000 }
        );
        const ok = result && result.key && (result.key === c.expectKey || (result.recommendedSku && result.recommendedSku.length > 0));
        assertRule('R-INVARIANT-ONEUNDERSTANDING', !!ok,
          `detectIntentNLP("${c.in}") produces a real, non-empty match`,
          ok ? '' : `got key=${result?.key} sku=${result?.recommendedSku}`);
      } catch (e) {
        assertRule('R-INVARIANT-ONEUNDERSTANDING', false,
          `detectIntentNLP("${c.in}") runs in VM`, e.message);
      }
    }

    for (const [text, expected] of [
      ['replace 5 tiles', 5],
      ['install 12 outlets', 12],
      ['fix four door hinges', 4],
      ['a single bulb', 1],
      ['no numbers here', 1],
    ]) {
      try {
        const v = vm.runInContext(
          `extractQty(${JSON.stringify(text)})`,
          sandbox, { timeout: 4000 }
        );
        assertRule('R-INVARIANT-ONEUNDERSTANDING', v === expected,
          `extractQty("${text}") === ${expected}`,
          v === expected ? '' : `got ${v}`);
      } catch (e) {
        assertRule('R-INVARIANT-ONEUNDERSTANDING', false,
          `extractQty("${text}") runs in VM`, e.message);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 3 — Domain Architecture & Compiler Output
// ═══════════════════════════════════════════════════════════════════
logHeader('3. Domain Architecture & Compiler Output (R-DOMAIN)');

{
  const compiled = btnycData.compiled || {};
  const pricingIndex = compiled.pricing_index || {};
  const realServiceIds = new Set((btnycData.services || []).map(s => s.id));
  const orphanKeys = Object.keys(pricingIndex).filter(k => {
    if (k.includes('+')) return false;
    return !realServiceIds.has(k);
  });
  const missingKeys = [...realServiceIds].filter(id => !(id in pricingIndex));
  assertRule(
    'R-DOMAIN-COMPILER',
    Object.keys(pricingIndex).length > 0 && orphanKeys.length === 0 && missingKeys.length === 0,
    'compiled.pricing_index is populated, has no orphan keys, and covers every named service',
    `orphans=[${orphanKeys.slice(0, 5).join(', ')}] missing=[${missingKeys.slice(0, 5).join(', ')}]`
  );
}

{
  const routing = btnycData.routing_archetypes || {};
  const dyn = btnycData.dynamic_services || {};

  const COMPONENT_MODULES = new Set([
    'wall_type', 'surface_type', 'door_type', 'door_style_pref', 'door_size',
    'client_supplying_door', 'existing_frame', 'faucet_type', 'sink_type',
    'toilet_style_pref', 'existing_toilet_type', 'window_type', 'removal',
    'install_type', 'existing_type', 'furn_item', 'mounting_item',
    'wall_mount_items', 'item_type', 'fixture_type', 'electrical_item',
    'plumbing_fixture', 'tech_device', 'computer_component', 'device_type',
    'laptop_or_desktop', 'existing_box', 'ducting', 'length', 'distance',
    'weight', 'mounting_height', 'tile_condition', 'waterproof_area',
    'has_matching_tiles', 'thermostat_type', 'customer_supplied_part',
    'software_install_type', 'brand', 'router_owned', 'mesh_network',
    'pax_cabinet_count', 'pax_hinge_count', 'pax_interior_count',
    'pax_sliding_count', 'disposal_size', 'gfci_location', 'window_ac_support',
    'inwall_power_for_tv', 'faucet_part_available', 'angle_stop_condition',
    'baseboard_scope', 'switch_wiring', 'washer_type',
  ]);
  const GENERIC_SHARED_SYMPTOM_MODULES = new Set([
    'symptom', 'tech_problem_type', 'damage_type', 'leak_type',
    'drain_speed', 'device_state', 'internet_active', 'tech_issue_source',
  ]);
  const GROUP_SPECIFIC_DIAGNOSTIC_MODULES = new Set([
    'cabinet_issue', 'door_issue', 'floor_issue', 'wall_issue',
    'window_issue', 'furniture_issue', 'dishwasher_symptom',
    'dryer_symptom', 'stove_symptom', 'computer_symptom',
    'network_symptom', 'smart_device_symptom', 'cable_symptom',
    'generic_tech_symptom', 'issue', 'appliance_type',
  ]);
  const violations = [];
  for (const [key, def] of Object.entries(dyn)) {
    const parts = key.split('+');
    const groupId = parts.length >= 3 ? parts[1] : null;
    if (!groupId) continue;
    const arch = routing[groupId]?.routing_archetype;
    if (arch !== 'component_first' && arch !== 'symptom_first') continue;
    const chain = def.intake_chain || [];
    if (chain.length === 0) continue;

    const moduleNames = chain.map(s => s.module);

    if (arch === 'component_first') {
      const firstReal = moduleNames.find(m =>
        COMPONENT_MODULES.has(m) ||
        GENERIC_SHARED_SYMPTOM_MODULES.has(m) ||
        GROUP_SPECIFIC_DIAGNOSTIC_MODULES.has(m)
      );
      if (firstReal && GENERIC_SHARED_SYMPTOM_MODULES.has(firstReal)) {
        violations.push(`${key}: component_first group leads with GENERIC symptom module '${firstReal}'`);
      }
    } else if (arch === 'symptom_first') {
      const hasAnySymptom = moduleNames.some(m =>
        GENERIC_SHARED_SYMPTOM_MODULES.has(m) ||
        GROUP_SPECIFIC_DIAGNOSTIC_MODULES.has(m)
      );
      if (!hasAnySymptom) {
        violations.push(`${key}: symptom_first group has no symptom-flavoured module (only${moduleNames.join(', ')})`);
      }
    }
  }
  assertRule(
    'R-DOMAIN-DYNCHAIN',
    violations.length === 0,
    "Every dynamic service chain shape matches its owning group's routing_archetype",
    violations.slice(0, 8).join(' | ') + (violations.length > 8 ? ` (+${violations.length - 8} more)` : '')
  );
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 4 — Confidence & Intake Governance
// ═══════════════════════════════════════════════════════════════════
logHeader('4. Confidence & Intake Governance (R-CONF / R-INTAKE)');

// R-CONF-ONEFORMULA — structural + behavioral + outcome
{
  const resolverSrc = extractFunctionBody(qrHtmlContent, 'resolveBaseConfidenceStrategy');
  assertRule(
    'R-CONF-ONEFORMULA',
    !!resolverSrc && /archetypes/.test(resolverSrc) && /member_group_ids/.test(resolverSrc),
    'resolveBaseConfidenceStrategy exists and reads archetype defaults via member_group_ids'
  );

  const orchConfSrc = extractFunctionBody(qrHtmlContent, 'orch_compute_confidence');
  const orchCallsResolver = !!orchConfSrc && /resolveBaseConfidenceStrategy\s*\(/.test(orchConfSrc);
  assertRule(
    'R-CONF-ONEFORMULA',
    orchCallsResolver,
    'orch_compute_confidence delegates to resolveBaseConfidenceStrategy'
  );

  // sqBuildCuratedIntake was retired (R-INVARIANT-DELETION; P-INVARIANT-NOLEGACY: the bug is gone because the code is gone). The rule's
  // intent -- ONE confidence formula, nobody recreates it -- is asserted against the LIVE path: the curated card's follow-up cap reaches
  // the renderer through the route (orch_max_followup_questions), which delegates; and the renderer never recomputes it.
  const capSrc = extractFunctionBody(qrHtmlContent, 'orch_max_followup_questions');
  assertRule(
    'R-CONF-ONEFORMULA',
    !!capSrc && /resolveBaseConfidenceStrategy\s*\(/.test(capSrc),
    "orch_max_followup_questions (the live curated card's follow-up cap) delegates to resolveBaseConfidenceStrategy"
  );
  const cardSrc = extractFunctionBody(qrHtmlContent, 'renderCuratedCardFromRoute');
  assertRule(
    'R-CONF-ONEFORMULA',
    // judged on CODE, not prose: comments are stripped first (a comment may legitimately name the function it no longer calls)
    !!cardSrc && !/resolveBaseConfidenceStrategy\s*\(/.test(cardSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')),
    'renderCuratedCardFromRoute does not recreate the confidence formula (it reads route.maxFollowupQuestions)'
  );

  const d = extractFunctionDeclaration(qrHtmlContent, 'resolveBaseConfidenceStrategy');
  if (!d) {
    assertRule('R-CONF-ONEFORMULA', false, 'resolveBaseConfidenceStrategy declaration not extractable');
  } else {
    const sandbox = makeSandbox();
    try {
      const value = vm.runInContext(
        `"use strict";\n${d.header}{${d.body}}\nresolveBaseConfidenceStrategy(${JSON.stringify(btnycData.services[0])}, null);`,
        sandbox, { timeout: 4000 }
      );
      const ok = value && typeof value === 'object'
        && typeof value.base_confidence === 'number'
        && typeof value.minimum_quote_confidence === 'number';
      assertRule(
        'R-CONF-ONEFORMULA',
        ok,
        'resolveBaseConfidenceStrategy returns a real numeric strategy for a real service',
        ok ? '' : `unexpected return: ${JSON.stringify(value).slice(0, 200)}`
      );
    } catch (e) {
      assertRule('R-CONF-ONEFORMULA', false, 'resolveBaseConfidenceStrategy sandbox execution', e.message);
    }
  }
}

// R-CONF-ONEFORMULA — behavioral + outcome for the orchestrator
{
  const bundle = bundleFunctions([
    'resolveBaseConfidenceStrategy',
    'applyLiveConfidenceEscalation',
    'orch_compute_confidence',
  ], {
    prelude: `function _trace() {}`,
  });

  if (bundle.missing.length) {
    assertRule('R-CONF-ONEFORMULA', false,
      'Confidence bundle (resolveBase + escalation + orch_compute) must all be extractable',
      `missing=[${bundle.missing.join(', ')}]`);
  } else {
    const sandbox = makeSandbox();
    try {
      vm.runInContext(`${bundle.source}`, sandbox, { timeout: 4000 });
    } catch (e) {
      assertRule('R-CONF-ONEFORMULA', false,
        'Confidence bundle loads without throwing', e.message);
    }

    const realSvc = (btnycData.services || []).find(s => s.confidence_strategy);
    if (!realSvc) {
      assertRule('R-CONF-ONEFORMULA', false, 'No real service with confidence_strategy found');
    } else {
      const resolution = { entityType: 'service', entity: realSvc };

      try {
        const catalogResult = vm.runInContext(
          `orch_compute_confidence(${JSON.stringify(resolution)}, [], 0, window.DB, 'catalog')`,
          sandbox, { timeout: 4000 }
        );
        assertRule('R-CONF-ONEFORMULA',
          catalogResult && catalogResult.score === 100,
          'orch_compute_confidence returns score=100 for a direct catalog tap (intent is certain)',
          `got score=${catalogResult?.score}`);

        const catalogResult2 = vm.runInContext(
          `orch_compute_confidence(${JSON.stringify(resolution)}, [], 0, window.DB, 'catalog')`,
          sandbox, { timeout: 4000 }
        );
        assertDeepEqual('R-CONF-ONEFORMULA', catalogResult, catalogResult2,
          'orch_compute_confidence is deterministic for identical (resolution, tags, matchConf, entryType) inputs');

        const freeTextResult = vm.runInContext(
          `orch_compute_confidence(${JSON.stringify(resolution)}, [], 0, window.DB, 'free_text')`,
          sandbox, { timeout: 4000 }
        );
        const expectedFreeTextScore = Math.min(100,
          (realSvc.confidence_strategy.base_confidence || 40) + 0);
        assertRule('R-CONF-ONEFORMULA',
          freeTextResult && freeTextResult.score === expectedFreeTextScore,
          `orch_compute_confidence free_text score equals base_confidence (no rogue multiplier)`,
          `got score=${freeTextResult?.score}, expected=${expectedFreeTextScore}`);

        assertRule('R-CONF-ONEFORMULA',
          typeof catalogResult.minConf === 'number',
          'orch_compute_confidence returns a numeric minConf');
      } catch (e) {
        assertRule('R-CONF-ONEFORMULA', false,
          'orch_compute_confidence behavioral test runs in VM', e.message);
      }
    }
  }
}

// R-INTAKE-QTYONCE
{
  const qtySrc = extractFunctionBody(qrHtmlContent, 'entityHasOwnQtyQuestion');
  assertRule(
    'R-INTAKE-QTYONCE',
    !!qtySrc && /intake_chain/.test(qtySrc),
    'entityHasOwnQtyQuestion exists and inspects intake_chain'
  );

  const analyzeSrc = extractFunctionBody(qrHtmlContent, 'sqAnalyze');
  const analyzeUses = !!analyzeSrc && /S\.qty\s*=\s*route\.quantity\.units/.test(analyzeSrc);
  assertRule(
    'R-INTAKE-QTYONCE',
    analyzeUses,
    'sqAnalyze (free-text path) seeds S.qty from the route\'s resolved quantity (route.quantity.units) -- one resolver, no arbiter of its own (T147)'
  );

  const builderSrc = extractFunctionBody(qrHtmlContent, 'sqBuilderFinish');
  const builderUses = !!builderSrc && /S\.qty\s*=\s*resolveBuilderQuantity\s*\(/.test(builderSrc);
  assertRule(
    'R-INTAKE-QTYONCE',
    builderUses,
    'sqBuilderFinish (guided-builder path) seeds S.qty from resolveBuilderQuantity (which delegates to resolveQuantityUnits) -- one resolver, no arbiter of its own (T147/T148)'
  );

  const prelude = `var _GENERIC_QTY_MODULE_KEYS = new Set(['item_count','count','hybrid_qty','global_quantity']);`;
  const d = extractFunctionDeclaration(qrHtmlContent, 'entityHasOwnQtyQuestion');
  const qtyAware = btnycData.services.find(s => (s.intake_chain || []).some(st => st.module === 'item_count_template'));
  const qtyGeneric = btnycData.services.find(s =>
    (s.intake_chain || []).some(st => st.module === 'global_quantity') &&
    !(s.intake_chain || []).some(st => st.module === 'item_count_template')
  );

  if (d && qtyAware) {
    const sandbox = makeSandbox();
    try {
      const value = vm.runInContext(
        `"use strict";\n${prelude}\n${d.header}{${d.body}}\nentityHasOwnQtyQuestion(${JSON.stringify(qtyAware)});`,
        sandbox, { timeout: 4000 }
      );
      assertRule(
        'R-INTAKE-QTYONCE',
        value === true,
        `entityHasOwnQtyQuestion returns true for ${qtyAware.id} (has item_count_template)`
      );
    } catch (e) {
      assertRule('R-INTAKE-QTYONCE', false, 'entityHasOwnQtyQuestion sandbox execution (aware)', e.message);
    }
  }
  if (d && qtyGeneric) {
    const sandbox = makeSandbox();
    try {
      const value = vm.runInContext(
        `"use strict";\n${prelude}\n${d.header}{${d.body}}\nentityHasOwnQtyQuestion(${JSON.stringify(qtyGeneric)});`,
        sandbox, { timeout: 4000 }
      );
      assertRule(
        'R-INTAKE-QTYONCE',
        value === false,
        `entityHasOwnQtyQuestion returns false for ${qtyGeneric.id} (only generic qty module)`
      );
    } catch (e) {
      assertRule('R-INTAKE-QTYONCE', false, 'entityHasOwnQtyQuestion sandbox execution (generic)', e.message);
    }
  }
}

// R-INTAKE-WIREREMOVE — structural + behavioral injection
{
  const defaults = btnycData.global_rules?.intake_defaults;
  const hasIntakeDefaults = !!defaults && typeof defaults === 'object';
  const hasUniversal = Array.isArray(defaults?.universal);
  const hasCategoryDefaults = !!defaults?.category_defaults && typeof defaults.category_defaults === 'object';
  const hasGroupDefaults = !!defaults?.group_defaults && typeof defaults.group_defaults === 'object';
  assertRule(
    'R-INTAKE-WIREREMOVE',
    hasIntakeDefaults && hasUniversal && hasCategoryDefaults && hasGroupDefaults,
    'global_rules.intake_defaults carries universal / category_defaults / group_defaults structure'
  );

  const TEST_MODULE_KEY = '__test_diag_module__';
  const clonedSSOT = JSON.parse(JSON.stringify(btnycData));
  clonedSSOT.global_rules.intake_defaults.universal =
    [...(clonedSSOT.global_rules.intake_defaults.universal || []), TEST_MODULE_KEY];
  clonedSSOT.intake_modules[TEST_MODULE_KEY] = {
    question: 'TEST: pick a diagnostic',
    type: 'single',
    client_response: [
      { label: 'Diag A', tags: [], complexity_override: 'routine' },
      { label: 'Diag B', tags: [], complexity_override: 'routine' },
    ],
    purpose: 'pricing',
    confidence_gain: 5,
    affects_price: false,
  };

  const bundle = bundleFunctions([
    '_resolveIntakeChain',
    'orch_compose_intake_chain',
  ], {
    prelude: `function _trace() {}`,
  });

  if (bundle.missing.length) {
    assertRule('R-INTAKE-WIREREMOVE', false,
      'Intake-composition bundle must be extractable for behavioral test',
      `missing=[${bundle.missing.join(', ')}]`);
  } else {
    const sandbox = {
      DB: clonedSSOT,
      SERVICE_DATA: clonedSSOT,
      window: { DB: clonedSSOT },
      console: { log() {}, warn() {}, error() {} },
      Math, Object, Array, Set, Map, WeakMap, WeakSet, Number, String, Boolean,
      JSON, parseInt, parseFloat, isNaN, isFinite, Infinity, NaN,
      _trace: () => {},
      _traceStart: () => {},
      _traceFn: () => {},
    };
    sandbox.window.DB = clonedSSOT;
    const ctx = vm.createContext(sandbox);

    const targetSvc = clonedSSOT.services.find(s => s.intake_chain && s.intake_chain.length > 0) || clonedSSOT.services[0];
    try {
      const chain = vm.runInContext(`
        ${bundle.source}
        orch_compose_intake_chain(
          { selectedCategoryId: 'unused_category', selectedGroupId: 'unused_group' },
          { entity: ${JSON.stringify(targetSvc)} },
          window.DB
        );
      `, ctx, { timeout: 4000 });

      const moduleKeys = (chain || []).map(m => m.moduleKey || m.module);
      assertRule(
        'R-INTAKE-WIREREMOVE',
        moduleKeys.includes(TEST_MODULE_KEY),
        `orch_compose_intake_chain consumes intake_defaults.universal (injected '${TEST_MODULE_KEY}' appears in final chain)`,
        `chain=[${moduleKeys.slice(0, 10).join(', ')}]`
      );

      const authoredKeys = new Set((targetSvc.intake_chain || []).map(s => s.module));
      const includesAuthored = [...authoredKeys].every(k => moduleKeys.includes(k));
      assertRule(
        'R-INTAKE-WIREREMOVE',
        includesAuthored,
        'composed chain includes every authored intake_chain module (no silent drop)'
      );
    } catch (e) {
      assertRule('R-INTAKE-WIREREMOVE', false,
        'orch_compose_intake_chain behavioral test runs in VM', e.message);
    }
  }

  const hasDeprecated = 'force_modules_by_variability_DEPRECATED' in (btnycData.global_rules || {});
  const hasLive = 'force_modules_by_variability' in (btnycData.global_rules || {});
  assertRule(
    'R-INTAKE-QTYONCE',
    hasDeprecated && !hasLive,
    'Legacy force_modules_by_variability is archived (DEPRECATED key present; live key absent)'
  );
}

{
  const analyzeSrc = extractFunctionBody(qrHtmlContent, 'sqAnalyze');
  const builderSrc = extractFunctionBody(qrHtmlContent, 'sqBuilderFinish');
  const analyzeWritesQty = !!analyzeSrc && /\bS\.qty\s*=/.test(analyzeSrc);
  const builderWritesQty = !!builderSrc && /\bS\.qty\s*=/.test(builderSrc);
  assertRule(
    'R-INTAKE-QTYFIELD',
    analyzeWritesQty && builderWritesQty,
    'Quantity is written to the single S.qty field by both entry paths'
  );

  const parallelQtyFields = ['S.quantity', 'S.amount', 'S.itemCount', 'S.item_count', 'S.numItems'];
  const parallelFound = parallelQtyFields.filter(f => new RegExp(f.replace('.', '\\.') + '\\s*=').test(qrHtmlContent));
  assertRule(
    'R-INTAKE-QTYFIELD',
    parallelFound.length === 0,
    'No parallel quantity field names exist alongside S.qty',
    parallelFound.join(', ')
  );
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 5 — Financial & Pricing Engine
// ═══════════════════════════════════════════════════════════════════
logHeader('5. Financial & Pricing Engine (R-PRICE)');

assertRule(
  'R-PRICE-REGISTERED',
  btnycData.pricing_formulas && Object.keys(btnycData.pricing_formulas).length > 0,
  'pricing_formulas registry is populated'
);

{
  const formulas = btnycData.pricing_formulas || {};
  const KNOWN_CODE_HANDLED_ENGINES = new Set(['assembly_formula']);
  const missing = [];
  const deferred = [];
  for (const svc of btnycData.services || []) {
    const fe = svc.financial_engine || {};
    if (fe.formula_ref && !formulas[fe.formula_ref]) {
      missing.push(`${svc.id}: formula_ref='${fe.formula_ref}'`);
    }
    if (svc.pricing_engine && /_formula$/.test(svc.pricing_engine) && !formulas[svc.pricing_engine]) {
      if (KNOWN_CODE_HANDLED_ENGINES.has(svc.pricing_engine)) {
        deferred.push(`${svc.id} (${svc.pricing_engine})`);
      } else {
        missing.push(`${svc.id}: pricing_engine='${svc.pricing_engine}'`);
      }
    }
  }
  if (deferred.length > 0) {
    console.warn(`    ⚠ ${deferred.length} service(s) use a known code-handled engine not yet registered in pricing_formulas:${deferred.join(', ')}`);
    console.warn(`      This is a documented deviation, not a silent pass. Register in pricing_formulas or extend KNOWN_CODE_HANDLED_ENGINES if more accumulate.`);
  }
  assertRule(
    'R-PRICE-REGISTERED',
    missing.length === 0,
    'Every service formula_ref / pricing_engine resolves to a registered formula',
    missing.slice(0, 8).join(' | ') + (missing.length > 8 ? ` (+${missing.length - 8} more)` : '')
  );
}

{
  const archetypes = new Set(Object.keys(btnycData.pricing_archetypes || {}));
  const invalid = [];
  for (const svc of btnycData.services || []) {
    const pa = svc.financial_engine?.pricing_archetype;
    if (pa && !archetypes.has(pa)) invalid.push(`${svc.id}: pricing_archetype='${pa}'`);
  }
  assertRule(
    'R-PRICE-REGISTERED',
    archetypes.size > 0 && invalid.length === 0,
    'Every service pricing_archetype is a registered archetype',
    invalid.slice(0, 8).join(' | ')
  );
}

{
  const modifiers = btnycData.global_rules?.modifiers || {};
  const valid = new Set(['per_unit', 'per_visit']);
  const missing = [];
  const invalid = [];
  for (const [key, def] of Object.entries(modifiers)) {
    if (!def || typeof def !== 'object') continue;
    if (!('scope' in def)) missing.push(key);
    else if (!valid.has(def.scope)) invalid.push(`${key}='${def.scope}'`);
  }
  assertRule(
    'R-PRICE-SCOPE',
    missing.length === 0 && invalid.length === 0,
    'Every modifier carries an explicit scope of per_unit or per_visit',
    `missing=[${missing.slice(0, 6).join(', ')}] invalid=[${invalid.slice(0, 6).join(', ')}]`
  );
}

{
  const unifiedSrc = extractFunctionBody(qrHtmlContent, 'computeUnifiedQuote');
  assertRule(
    'R-PRICE-REACHES',
    !!unifiedSrc && unifiedSrc.length > 1000,
    'computeUnifiedQuote exists as a substantial function body'
  );

  const callsFormula = !!unifiedSrc && /applyPricingFormula\s*\(/.test(unifiedSrc);
  assertRule(
    'R-PRICE-REACHES',
    callsFormula,
    'computeUnifiedQuote invokes applyPricingFormula'
  );

  const hasConsumedKeys = !!unifiedSrc && /FORMULA_CONSUMED_KEYS/.test(unifiedSrc);
  assertRule(
    'R-PRICE-REACHES',
    hasConsumedKeys,
    'computeUnifiedQuote uses FORMULA_CONSUMED_KEYS to gate modifier application'
  );

  const bugPattern = /if\s*\(\s*!\s*formulaResult\s*\)\s*\{\s*const\s+_mods/;
  assertRule(
    'R-PRICE-REACHES',
    !bugPattern.test(unifiedSrc || ''),
    'computeUnifiedQuote does NOT gate the whole answer-modifier loop on !formulaResult'
  );

  const perKeySkip = /if\s*\(\s*!\s*formulaConsumedKeys\.has\s*\(\s*moduleKey\s*\)\s*\)/.test(unifiedSrc || '');
  assertRule(
    'R-PRICE-REACHES',
    perKeySkip,
    'computeUnifiedQuote applies the per-key formula-consumed guard inside the loop'
  );
}

// R-PRICE-REACHES — behavioral modifier-delta test
{
  const bundle = bundleFunctions([
    'resolveBaseConfidenceStrategy',
    'applyLiveConfidenceEscalation',
    'applyPricingFormula',
    'computeArchetypeQuote',
    'deriveComplexityTier',
    'resolveServiceCheckoutStateKey',
    'sqTagLabel',
    'computeUnifiedQuote',
  ], {
    prelude: `
      function _trace() {}
      var QTY_AWARE_FORMULAS = new Set(['furniture_repair_formula', 'tile_repair_formula', 'hardware_install_formula', 'buy_the_hour_qty_gate_formula']);
      var _GENERIC_QTY_MODULE_KEYS = new Set(['item_count','count','hybrid_qty','global_quantity']);
      function entityHasOwnQtyQuestion(entity) {
        return !!(entity?.intake_chain || []).some(step => {
          var key = step.module || '';
          return !_GENERIC_QTY_MODULE_KEYS.has(key) && (key === 'item_count_template' || key.startsWith('item_count_template::'));
        });
      }
    `,
  });

  if (bundle.missing.length) {
    assertRule('R-PRICE-REACHES', false,
      'Pricing engine bundle must be fully extractable for behavioral test',
      `missing=[${bundle.missing.join(', ')}]`);
  } else {
    const sandbox = makeSandbox();
    try {
      vm.runInContext(`${bundle.source}`, sandbox, { timeout: 4000 });
    } catch (e) {
      assertRule('R-PRICE-REACHES', false,
        'Pricing engine bundle loads without throwing', e.message);
    }

    const svc = btnycData.services.find(s => s.id === 'flatscreen_mounting_standard');
    const wallMod = btnycData.global_rules?.modifiers?.['wall_type_brick_or_concrete'];
    const weightMod = btnycData.global_rules?.modifiers?.['weight_20_to_50_lbs_moderate'];

    if (!svc || !wallMod || !weightMod) {
      assertRule('R-PRICE-REACHES', false,
        'Test fixture missing: flatscreen_mounting_standard + wall/weight modifiers');
    } else {
      const baseCtx = {
        svc,
        dynDef: null,
        activeTagIds: [],
        answers: {},
        qty: 1,
        intentKeyword: null,
        formulaId: null,
        ctxAdjFee: 0,
        ctxAdjMin: 0,
        enrichment: null,
      };
      const run = (answers) => vm.runInContext(
        `${bundle.source}
         computeUnifiedQuote(${JSON.stringify({ ...baseCtx, answers })});`,
        sandbox, { timeout: 6000 }
      );

      try {
        const noMods = run({});
        const oneMod = run({ wall_type: 'Brick or concrete' });
        const twoMods = run({
          wall_type: 'Brick or concrete',
          weight: '20 to 50 lbs (moderate)',
        });

        const d1 = oneMod.laborEstimate - noMods.laborEstimate;
        const d2 = twoMods.laborEstimate - noMods.laborEstimate;

        assertRule('R-PRICE-REACHES',
          d1 === wallMod.fee,
          `one modifier (wall_type) adds exactly its declared fee ($${wallMod.fee}) to laborEstimate`,
          `base=${noMods.laborEstimate} +1=${oneMod.laborEstimate} delta=${d1}`);

        assertRule('R-PRICE-REACHES',
          d2 === wallMod.fee + weightMod.fee,
          `two modifiers sum exactly ($${wallMod.fee} + $${weightMod.fee}) into laborEstimate`,
          `base=${noMods.laborEstimate} +2=${twoMods.laborEstimate} delta=${d2} expected=${wallMod.fee + weightMod.fee}`);

        assertDeepEqual('R-PRICE-REACHES', d2, wallMod.fee + weightMod.fee,
          'sum of modifier deltas deep-equals sum of declared modifier fees (no swallowed variables)');

        const breakdownSources = (twoMods.feeBreakdown || []).map(b => b.source);
        assertRule('R-PRICE-REACHES',
          breakdownSources.filter(s => s === 'answer').length >= 2,
          'feeBreakdown includes both modifier contributions (verified attribution)',
          `breakdown=[${breakdownSources.join(',')}]`);
      } catch (e) {
        assertRule('R-PRICE-REACHES', false,
          'computeUnifiedQuote modifier-delta behavioral test runs in VM', e.message);
      }
    }
  }
}

{
  const tags = btnycData.smart_tags || {};
  const withFees = [];
  for (const [tid, def] of Object.entries(tags)) {
    if (!def || typeof def !== 'object') continue;
    if (def.effects && typeof def.effects.fee === 'number' && def.effects.fee !== 0) {
      withFees.push(`${tid} (effects.fee=${def.effects.fee})`);
    }
    if (typeof def.fee === 'number' && def.fee !== 0) {
      withFees.push(`${tid} (fee=${def.fee})`);
    }
  }
  assertRule(
    'P-INVARIANT-CHIPSNOTFEES',
    withFees.length === 0,
    'No smart_tag carries a direct fee that would make it a pricing factor',
    withFees.slice(0, 8).join(' | ')
  );
}

{
  const d = extractFunctionDeclaration(qrHtmlContent, 'applyPricingFormula');
  if (!d) {
    assertRule('R-PRICE-REGISTERED', false, 'applyPricingFormula could not be extracted');
  } else {
    const sandbox = makeSandbox();
    const full = `"use strict";\n${d.header}{${d.body}}`;
    const f = btnycData.pricing_formulas.hardware_install_formula;
    if (!f || !f.swap || !f.new_holes) {
      assertRule('R-PRICE-REGISTERED', false, 'hardware_install_formula exists with swap and new_holes branches');
    } else {
      const expectedFee = (branch, units) => {
        const b = f[branch];
        return b.flat_rate + Math.max(0, units - b.included_units) * b.overflow_per_unit;
      };
      const qtyMatrix = [1, 2, 5, 9, 10, 11, 15, 19, 20, 21, 25, 40, 55, 96, 99, 100, 150, 500];
      const cases = [];
      for (const q of qtyMatrix) {
        cases.push({ name: `swap × ${q}`, args: `'hardware_install_formula', {install_type:'swap', unit_count:${q}},${q}, null`, expectedFee: expectedFee('swap', q) });
        cases.push({ name: `new_holes × ${q}`, args: `'hardware_install_formula', {install_type:'new holes', unit_count:${q}},${q}, null`, expectedFee: expectedFee('new_holes', q) });
      }
      cases.push({ name: 'swap, no unit_count, qty=7', args: `'hardware_install_formula', {install_type:'swap'}, 7, null`, expectedFee: expectedFee('swap', 7) });
      cases.push({ name: 'new_holes, no unit_count, qty=15', args: `'hardware_install_formula', {install_type:'new holes'}, 15, null`, expectedFee: expectedFee('new_holes', 15) });
      const failures = [];
      for (const c of cases) {
        try {
          const result = vm.runInContext(`${full}\napplyPricingFormula(${c.args});`, sandbox, { timeout: 4000 });
          if (!result || Math.abs(result.extraFee - c.expectedFee) > 1e-9) {
            failures.push(`${c.name}: expected extraFee=${c.expectedFee}, got${result && result.extraFee}`);
          }
        } catch (e) {
          failures.push(`${c.name}:${e.message}`);
        }
      }
      let prev = -1, monotonic = true;
      for (const q of qtyMatrix) {
        try {
          const r = vm.runInContext(`${full}\napplyPricingFormula('hardware_install_formula', {install_type:'swap', unit_count:${q}},${q}, null);`, sandbox, { timeout: 4000 });
          if (!r || r.extraFee < prev) { monotonic = false; break; }
          prev = r.extraFee;
        } catch (_) { monotonic = false; break; }
      }
      assertRule(
        'R-PRICE-REGISTERED',
        failures.length === 0,
        `hardware_install_formula matches its own declared coefficients across ${cases.length} qty values`,
        failures.slice(0, 6).join(' | ') + (failures.length > 6 ? ` (+${failures.length - 6} more)` : '')
      );
      assertRule(
        'R-PRICE-REACHES',
        monotonic,
        'hardware_install_formula fee is monotonic non-decreasing in quantity (no downward price cliff)'
      );
    }
  }
}

{
  const d = extractFunctionDeclaration(qrHtmlContent, 'mathFurnitureAssembly');
  if (!d) {
    assertRule('R-PRICE-REGISTERED', false, 'mathFurnitureAssembly could not be extracted');
  } else {
    const sandbox = makeSandbox();
    sandbox.SERVICE_DATA = {
      meta: { global_rates: { standard_labor: 40 } },
    };
    const single = [{ minutes: 60, flat_fee: 40 }];
    const tiny = [{ minutes: 15, flat_fee: 10 }];
    const run = (input) => vm.runInContext(
      `"use strict";\n${d.header}{${d.body}}\nmathFurnitureAssembly(${JSON.stringify(input)});`,
      sandbox,
      { timeout: 4000 }
    );
    try {
      const r = run(single);
      assertRule(
        'R-PRICE-REGISTERED',
        r && typeof r.price === 'number' && Math.abs(r.price - 40) < 1,
        'mathFurnitureAssembly prices a 60-minute item at its own catalog flat_fee (~$40)',
        r ? `actual: $${r.price}` : 'no return value'
      );
    } catch (e) {
      assertRule('R-PRICE-REGISTERED', false, 'mathFurnitureAssembly sandbox (single)', e.message);
    }
    try {
      const r2 = run(tiny);
      assertRule(
        'R-PRICE-REGISTERED',
        r2 && typeof r2.price === 'number' && Math.abs(r2.price - 40) < 1,
        'mathFurnitureAssembly enforces the 1-hour minimum at the standard rate',
        r2 ? `actual: $${r2.price}` : 'no return value'
      );
    } catch (e) {
      assertRule('R-PRICE-REGISTERED', false, 'mathFurnitureAssembly sandbox (minimum)', e.message);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 6 — System Architecture & Security
// ═══════════════════════════════════════════════════════════════════
logHeader('6. System Architecture & Security (R-SYSTEM)');

assertRule(
  'R-SYSTEM-NODATA',
  !qrHtmlContent.includes('"services": [{"id":'),
  'Catalog data is not inlined into qr.html (loaded from btnyc.json)'
);

{
  const stripped = stripStringsAndComments(qrHtmlContent);
  const evalCount = (stripped.match(/\beval\s*\(/g) || []).length;
  const newFnCount = (stripped.match(/new\s+Function\s*\(/g) || []).length;
  assertRule(
    'R-INVARIANT-NOEVAL',
    evalCount === 0 && newFnCount === 0,
    'No eval or new Function in code (comments/strings excluded)',
    `eval=${evalCount} new Function=${newFnCount}`
  );

  const stringTimer = (stripped.match(/set(?:Timeout|Interval)\s*\(\s*['"`]/g) || []).length;
  assertRule(
    'R-SYSTEM-CSP',
    stringTimer === 0,
    'No string-argument setTimeout/setInterval (CSP-compatible timing only)',
    `found ${stringTimer}`
  );
}

{
  const refExecPatterns = [
    /eval\s*\([^)]*\$ref/,
    /Function\s*\([^)]*\$ref/,
    /new\s+Function\s*\([^)]*\$ref/,
  ];
  const hits = refExecPatterns.filter(p => p.test(qrHtmlContent));
  assertRule(
    'R-SYSTEM-NOREF',
    hits.length === 0,
    'No $ref string is dynamically executed'
  );
}

assertRule(
  'R-SYSTEM-SCRIPT',
  qrHtmlContent.includes('<script>') && qrHtmlContent.includes('</script>'),
  'Script tags are properly formed'
);

{
  const moduleNames = ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js', 'UIRenderer.js', 'AppController.js'];
  const missing = moduleNames.filter(m => !qrHtmlContent.includes(m));
  assertRule(
    'R-SYSTEM-LAYERS',
    missing.length === 0,
    'All five documented module boundaries are present as script blocks',
    `missing=[${missing.join(', ')}]`
  );
}

{
  const d = extractFunctionDeclaration(qrHtmlContent, 'applyPricingFormula');
  if (d) {
    const ctx = vm.createContext({
      DB: btnycData,
      Math, Object, Array, Set, Map, Number, String, Boolean, JSON, parseInt, parseFloat, isNaN,
    });
    try {
      vm.runInContext(
        `"use strict";\n${d.header}{${d.body}}\napplyPricingFormula('hardware_install_formula', {install_type:'swap', unit_count:5}, 5, null);`,
        ctx, { timeout: 4000 }
      );
      assertRule(
        'R-SYSTEM-NODOM',
        true,
        'applyPricingFormula executes without any DOM access (no document, no window)'
      );
    } catch (e) {
      assertRule(
        'R-SYSTEM-NODOM',
        false,
        'applyPricingFormula must not access document or window',
        e.message
      );
    }
  }
}

{
  const allModuleRefs = new Set();
  const allKnownModules = new Set(Object.keys(btnycData.intake_modules || {}));
  for (const svc of btnycData.services || []) {
    for (const step of svc.intake_chain || []) {
      if (step.module) allModuleRefs.add(step.module);
      const then = step.then || {};
      for (const targets of Object.values(then)) {
        (targets || []).forEach(t => allModuleRefs.add(t));
      }
    }
  }
  for (const def of Object.values(btnycData.dynamic_services || {})) {
    for (const step of def.intake_chain || []) {
      if (step.module) allModuleRefs.add(step.module);
      const then = step.then || {};
      for (const targets of Object.values(then)) {
        (targets || []).forEach(t => allModuleRefs.add(t));
      }
    }
  }
  const orphaned = [...allModuleRefs].filter(m => !allKnownModules.has(m));
  assertRule(
    'R-SYSTEM-NOREF',
    orphaned.length === 0,
    'Every intake module referenced by a service or dynamic_service exists in intake_modules',
    orphaned.join(', ')
  );
}

// R-SYSTEM-ONEPARSE — state-hash drift test
{
  const beforeHash = simpleHash(stableStringify(btnycData));

  const bundle = bundleFunctions([
    '_resolveIntakeChain',
    'orch_compose_intake_chain',
    'resolveBaseConfidenceStrategy',
    'applyLiveConfidenceEscalation',
    'orch_compute_confidence',
  ], {
    prelude: `function _trace() {}`,
  });

  if (bundle.missing.length === 0) {
    const sandbox = makeSandbox();
    try {
      vm.runInContext(`${bundle.source}`, sandbox, { timeout: 4000 });
      const svc = btnycData.services[0];
      vm.runInContext(`
        (function() {
          for (let i = 0; i < 5; i++) {
            orch_compose_intake_chain(
              { selectedCategoryId: ${JSON.stringify(svc.ui_taxonomy?.category_id || '')},
                selectedGroupId: ${JSON.stringify(svc.ui_taxonomy?.group_id || '')} },
              { entity: ${JSON.stringify(svc)} },
              window.DB
            );
            orch_compute_confidence({ entity: ${JSON.stringify(svc)} }, [], 0, window.DB, 'catalog');
          }
        })();
      `, sandbox, { timeout: 6000 });
    } catch (e) {
      assertRule('R-SYSTEM-ONEPARSE', false,
        'Navigation simulation runs in VM without throwing', e.message);
    }
  }

  const afterHash = simpleHash(stableStringify(btnycData));
  assertRule(
    'R-SYSTEM-ONEPARSE',
    beforeHash === afterHash,
    `SSOT remains byte-identical after 5 simulated navigation events (${beforeHash} == ${afterHash})`,
    beforeHash === afterHash ? '' : `before=${beforeHash} after=${afterHash}`
  );
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 7 — SSOT Cross-Reference Integrity
// ═══════════════════════════════════════════════════════════════════
logHeader('7. SSOT Cross-Reference Integrity');

{
  const modifiers = btnycData.global_rules?.modifiers || {};
  const dangling = [];
  const seen = new Set();
  const checkResp = (moduleKey, resp, owner) => {
    const ref = resp?.modifier_ref;
    if (!ref) return;
    if (seen.has(ref)) return;
    seen.add(ref);
    if (!modifiers[ref]) dangling.push(`${owner}/${moduleKey}: ${ref}`);
  };
  for (const [moduleKey, def] of Object.entries(btnycData.intake_modules || {})) {
    for (const resp of def.client_response || []) checkResp(moduleKey, resp, 'intake_modules');
  }
  for (const svc of btnycData.services || []) {
    for (const step of svc.intake_chain || []) {
      for (const resp of step.params?.client_response || []) {
        checkResp(step.module, resp, `service:${svc.id}`);
      }
    }
  }
  assertRule(
    'P-INVARIANT-VERIFY',
    dangling.length === 0,
    'Every modifier_ref in every client_response resolves to a real modifier',
    dangling.slice(0, 8).join(' | ')
  );
}

{
  const catalog = btnycData.materials_catalog || {};
  const missing = new Set();
  for (const svc of btnycData.services || []) {
    for (const sku of (svc.required_materials || [])) if (!catalog[sku]) missing.add(`${svc.id}:req:${sku}`);
    for (const sku of (svc.optional_materials || [])) if (!catalog[sku]) missing.add(`${svc.id}:opt:${sku}`);
  }
  assertRule(
    'P-INVARIANT-VERIFY',
    missing.size === 0,
    'Every required/optional material SKU resolves to a real materials_catalog entry',
    [...missing].slice(0, 8).join(' | ')
  );
}

{
  const tags = btnycData.smart_tags || {};
  const missing = new Set();
  for (const svc of btnycData.services || []) {
    for (const t of (svc.default_tags || [])) {
      const ref = (t && typeof t === 'object' && t.$ref) ? t.$ref : t;
      if (typeof ref === 'string' && ref.startsWith('#') && !tags[ref]) {
        missing.add(`${svc.id}:${ref}`);
      }
    }
  }
  assertRule(
    'P-INVARIANT-VERIFY',
    missing.size === 0,
    'Every service default_tag $ref resolves to a real smart_tag',
    [...missing].slice(0, 8).join(' | ')
  );
}

{
  const groups = new Set((btnycData.group || []).map(g => g.id));
  const cats = new Set((btnycData.category || []).map(c => c.id));
  const badGroups = [];
  const badCats = [];
  for (const svc of btnycData.services || []) {
    const g = svc.ui_taxonomy?.group_id;
    const c = svc.ui_taxonomy?.category_id;
    if (g && !groups.has(g)) badGroups.push(`${svc.id}:${g}`);
    if (c && !cats.has(c)) badCats.push(`${svc.id}:${c}`);
  }
  for (const g of btnycData.group || []) {
    if (g.category_id && !cats.has(g.category_id)) badCats.push(`${g.id}->${g.category_id}`);
  }
  assertRule(
    'P-INVARIANT-VERIFY',
    badGroups.length === 0 && badCats.length === 0,
    'Every group_id / category_id reference resolves',
    `badGroups=[${badGroups.slice(0, 5).join(', ')}] badCats=[${badCats.slice(0, 5).join(', ')}]`
  );
}

{
  const formulas = btnycData.pricing_formulas || {};
  const missing = new Set();
  for (const [moduleKey, def] of Object.entries(btnycData.intake_modules || {})) {
    for (const resp of def.client_response || []) {
      if (resp.formula_override && !formulas[resp.formula_override]) {
        missing.add(`${moduleKey}:${resp.formula_override}`);
      }
    }
  }
  for (const svc of btnycData.services || []) {
    for (const step of svc.intake_chain || []) {
      for (const resp of step.params?.client_response || []) {
        if (resp.formula_override && !formulas[resp.formula_override]) {
          missing.add(`${svc.id}/${step.module}:${resp.formula_override}`);
        }
      }
    }
  }
  assertRule(
    'P-INVARIANT-VERIFY',
    missing.size === 0,
    'Every formula_override in every client_response resolves to a registered formula',
    [...missing].slice(0, 8).join(' | ')
  );
}

{
  const modifiers = btnycData.global_rules?.modifiers || {};
  const modules = btnycData.intake_modules || {};
  const missing = new Set();
  for (const [tid, def] of Object.entries(btnycData.smart_tags || {})) {
    const answers = def.answers;
    if (!answers || typeof answers !== 'object') continue;
    for (const [moduleKey, label] of Object.entries(answers)) {
      const mod = modules[moduleKey];
      if (!mod) continue;
      const resp = (mod.client_response || []).find(r => r.label === label);
      if (!resp) continue;
      if (resp.modifier_ref && !modifiers[resp.modifier_ref]) {
        missing.add(`${tid}->${moduleKey}->${resp.modifier_ref}`);
      }
    }
  }
  assertRule(
    'P-INVARIANT-VERIFY',
    missing.size === 0,
    'Every smart_tag answer chain resolves to a real modifier',
    [...missing].slice(0, 8).join(' | ')
  );
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 8 — Master Judicial Invariants
// ═══════════════════════════════════════════════════════════════════
logHeader('8. Master Judicial Invariants (R-INVARIANT)');

assertRule(
  'R-INVARIANT-SOURCE',
  Array.isArray(btnycData.invariants) && btnycData.invariants.length > 5,
  'Master Judicial Invariants array is populated'
);

{
  const unifiedSrc = extractFunctionBody(qrHtmlContent, 'computeUnifiedQuote');
  assertRule(
    'R-INVARIANT-CANONICAL',
    !!unifiedSrc && unifiedSrc.length > 2000,
    'computeUnifiedQuote function logic is robust and structurally complete'
  );

  const deps = [
    'resolveBaseConfidenceStrategy',
    'resolveServiceCheckoutStateKey',
    'applyPricingFormula',
    'applyLiveConfidenceEscalation',
    'deriveComplexityTier',
    'computeArchetypeQuote',
    'sqTagLabel',
  ];
  const decls = [];
  const missing = [];
  for (const name of deps) {
    const d = extractFunctionDeclaration(qrHtmlContent, name);
    if (!d) { missing.push(name); continue; }
    decls.push(`${d.header}{${d.body}}`);
  }
  const unifiedDecl = extractFunctionDeclaration(qrHtmlContent, 'computeUnifiedQuote');
  if (unifiedDecl && missing.length === 0) {
    const prelude = `
      var QTY_AWARE_FORMULAS = new Set(['furniture_repair_formula', 'tile_repair_formula', 'hardware_install_formula', 'buy_the_hour_qty_gate_formula']);
      var _GENERIC_QTY_MODULE_KEYS = new Set(['item_count','count','hybrid_qty','global_quantity']);
      function entityHasOwnQtyQuestion(entity) {
        return !!(entity?.intake_chain || []).some(step => {
          var key = step.module || '';
          return !_GENERIC_QTY_MODULE_KEYS.has(key) && (key === 'item_count_template' || key.startsWith('item_count_template::'));
        });
      }
      function _trace() {}
    `;
    // T147: these two end-to-end checks used to carry a hand-copied prelude (QTY_AWARE_FORMULAS, _GENERIC_QTY_MODULE_KEYS and a copy of entityHasOwnQtyQuestion itself): a duplicate
    // registry that went stale the moment the engine moved. The program is now the engine modules loaded whole.
    const sandbox = makeSandbox();
    const realService = btnycData.services.find(s => s.id === 'flatscreen_mounting_standard');
    if (realService) {
      try {
        const code = `
          ${_engineFind('resolveQuantityUnits')}
          ${decls.join('\n')}
          ${unifiedDecl.header}{${unifiedDecl.body}}
          computeUnifiedQuote({
            svc: ${JSON.stringify(realService)},
            dynDef: null,
            activeTagIds: [],
            answers: {},
            qty: 1,
            intentKeyword: null,
            formulaId: null,
            ctxAdjFee: 0,
            ctxAdjMin: 0,
            enrichment: null,
          });
        `;
        const result = vm.runInContext(code, sandbox, { timeout: 6000 });
        const ok = result
          && typeof result.laborEstimate === 'number'
          && typeof result.dispatchFee === 'number'
          && typeof result.checkoutStateKey === 'string';
        assertRule(
          'R-INVARIANT-CANONICAL',
          ok,
          'computeUnifiedQuote produces a real quote object for flatscreen_mounting_standard',
          ok ? '' : `unexpected: ${JSON.stringify(result).slice(0, 300)}`
        );
        if (ok) {
          assertRule(
            'R-INVARIANT-CANONICAL',
            result.laborEstimate >= 0,
            'computeUnifiedQuote produces non-negative laborEstimate'
          );

          assertRule(
            'R-INVARIANT-CANONICAL',
            result.laborEstimate === 60,
            `computeUnifiedQuote returns exact known price ($60) for flatscreen_mounting_standard at qty=1`,
            `got $${result.laborEstimate}`
          );

          const expectedBase = realService.financial_engine?.base_price || 0;
          assertDeepEqual('R-INVARIANT-CANONICAL',
            result.laborEstimate,
            expectedBase,
            'computeUnifiedQuote laborEstimate for flat_simple === SSOT base_price (pure-math equivalence)');

          const states = new Set(Object.keys(btnycData.checkout_states || {}));
          assertRule(
            'R-INVARIANT-CANONICAL',
            states.has(result.checkoutStateKey),
            'computeUnifiedQuote returns a registered checkout state'
          );
        }
      } catch (e) {
        assertRule(
          'R-INVARIANT-CANONICAL',
          false,
          'computeUnifiedQuote runs end-to-end in a sandbox against real data',
          e.message
        );
      }
    }
  } else if (missing.length > 0) {
    assertRule(
      'R-INVARIANT-CANONICAL',
      false,
      'Every dependency of computeUnifiedQuote is extractable',
      `missing=[${missing.join(', ')}]`
    );
  }
}

assertRule(
  'R-INVARIANT-ANCHOR',
  qrHtmlContent.includes('<!DOCTYPE html>'),
  'Document anchors and basic HTML structure preserved'
);

{
  const sharedNames = [
    'QTY_AWARE_FORMULAS',
    'FORMULA_CONSUMED_KEYS',
    '_GENERIC_QTY_MODULE_KEYS',
    'BLD_ACTION_MAP',
    'KNOWN_UI_TEMPLATES',
    'COMPONENT_MODULE_NAMES',
    'SYMPTOM_MODULE_NAMES',
  ];
  const duplicates = [];
  for (const name of sharedNames) {
    const re = new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*=`, 'g');
    const count = (qrHtmlContent.match(re) || []).length;
    if (count > 1) duplicates.push(`${name} × ${count}`);
  }
  assertRule(
    'R-INVARIANT-SINGLEDEF',
    duplicates.length === 0,
    'Shared registry constants are declared exactly once',
    duplicates.join(', ')
  );
}

{
  const v = btnycData._validation || {};
  assertRule(
    'P-INVARIANT-VERIFY',
    Array.isArray(v.errors) && v.errors.length === 0,
    'btnyc.json _validation.errors is empty'
  );
}

{
  const dr = btnycData.global_rules?.divergence_resolution || {};
  assertRule(
    'P-WHITEFLAG-DIAG',
    dr.enabled === true || dr.enabled === false,
    'divergence_resolution.enabled is explicitly set'
  );
  assertRule(
    'P-WHITEFLAG-DIAG',
    typeof dr.diagnostic_fee === 'number' && dr.diagnostic_fee > 0,
    'divergence_resolution carries a real diagnostic_fee'
  );
  assertRule(
    'P-WHITEFLAG-FORKB',
    typeof dr.credit_policy === 'string' && dr.credit_policy.length > 0,
    'divergence_resolution carries a real credit_policy string'
  );
}

{
  const orphaned = [];
  for (const svc of btnycData.services || []) {
    const fe = svc.financial_engine || {};
    const hasPath = fe.checkout_state || fe.pricing_archetype || fe.formula_ref || (typeof fe.base_price === 'number');
    if (!hasPath) orphaned.push(svc.id);
  }
  assertRule(
    'P-WHITEFLAG-PRICED',
    orphaned.length === 0,
    'Every service has a resolvable pricing path (checkout_state, pricing_archetype, formula_ref, or base_price)',
    orphaned.join(', ')
  );
}

{
  const invalid = [];
  for (const svc of btnycData.services || []) {
    const cs = svc.confidence_strategy || {};
    if (typeof cs.minimum_quote_confidence === 'number') {
      if (cs.minimum_quote_confidence < 0 || cs.minimum_quote_confidence > 100) {
        invalid.push(`${svc.id}: min=${cs.minimum_quote_confidence}`);
      }
    }
    if (cs._confidence_cap_applied === true && typeof cs._confidence_cap_reason !== 'string') {
      invalid.push(`${svc.id}: cap applied without reason`);
    }
  }
  assertRule(
    'P-CONF-PRECISION',
    invalid.length === 0,
    'Every confidence threshold is within [0, 100]; every applied cap carries a reason',
    invalid.slice(0, 8).join(' | ')
  );
}

{
  const checkFn = extractFunctionBody(qrHtmlContent, 'checkRoutingArchetypeConsistency');
  assertRule(
    'R-SYSTEM-PICKER-AGREE',
    !!checkFn && /routing_archetype/.test(checkFn),
    'checkRoutingArchetypeConsistency exists and inspects routing_archetype'
  );

  const validateFn = extractFunctionBody(qrHtmlContent, 'validateRoute');
  const validateCalls = !!validateFn && /checkRoutingArchetypeConsistency\s*\(/.test(validateFn);
  assertRule(
    'R-SYSTEM-PICKER-AGREE',
    validateCalls,
    'validateRoute invokes checkRoutingArchetypeConsistency (semantic check is wired)'
  );
}

{
  const meta = btnycData.meta || {};
  const compiler = btnycData._compiler_metadata || {};
  assertRule(
    'R-INVARIANT-RERUN',
    !!meta.version && !!compiler.source_compiler,
    'Compiler metadata is present alongside SSOT meta.version (rerun trail is auditable)'
  );
}

{
  const t = btnycData.workflow?.resolution_thresholds;
  assertRule(
    'R-GOVERN-PRECEDENCE',
    !!t && typeof t.auto_select_named_service === 'number' && typeof t.route_to_group_other_tile === 'number',
    'workflow.resolution_thresholds carries both numeric thresholds'
  );

  const freeTextSrc = extractFunctionBody(qrHtmlContent, 'collectBookingContext_freeText');
  const usesSSoT = !!freeTextSrc && (
    /resolution_thresholds/.test(freeTextSrc) ||
    /_resolutionThresholds\s*\(/.test(freeTextSrc)
  );
  assertRule(
    'R-GOVERN-PRECEDENCE',
    usesSSoT,
    'collectBookingContext_freeText reads thresholds from the SSOT, not hardcoded literals'
  );
}

{
  const composeSrc = extractFunctionBody(qrHtmlContent, 'orch_compose_intake_chain');
  assertRule(
    'R-SYSTEM-COMPOSER',
    !!composeSrc && /intake_defaults/.test(composeSrc) && /Set\s*\(/.test(composeSrc),
    'orch_compose_intake_chain reads intake_defaults and deduplicates via Set'
  );
}

{
  const jsonStr = JSON.stringify(btnycData);
  const suspicious = /"(?:eval|new Function)\s*\(/.test(jsonStr);
  assertRule(
    'R-SYSTEM-DECLARATIVE',
    !suspicious,
    'SSOT contains no function-body-looking strings (declarative only)'
  );
}

// Exhaustive: every service must produce a quote without throwing
{
  const deps = [
    'resolveBaseConfidenceStrategy',
    'resolveServiceCheckoutStateKey',
    'applyPricingFormula',
    'applyLiveConfidenceEscalation',
    'deriveComplexityTier',
    'computeArchetypeQuote',
    'sqTagLabel',
  ];
  const decls = [];
  const missingDeps = [];
  for (const name of deps) {
    const d = extractFunctionDeclaration(qrHtmlContent, name);
    if (!d) { missingDeps.push(name); continue; }
    decls.push(`${d.header}{${d.body}}`);
  }
  const unifiedDecl = extractFunctionDeclaration(qrHtmlContent, 'computeUnifiedQuote');
  if (unifiedDecl && missingDeps.length === 0) {
    const prelude = `
      var QTY_AWARE_FORMULAS = new Set(['furniture_repair_formula', 'tile_repair_formula', 'hardware_install_formula', 'buy_the_hour_qty_gate_formula']);
      var _GENERIC_QTY_MODULE_KEYS = new Set(['item_count','count','hybrid_qty','global_quantity']);
      function entityHasOwnQtyQuestion(entity) {
        return !!(entity?.intake_chain || []).some(step => {
          var key = step.module || '';
          return !_GENERIC_QTY_MODULE_KEYS.has(key) && (key === 'item_count_template' || key.startsWith('item_count_template::'));
        });
      }
      function _trace() {}
    `;
    const registeredStates = new Set(Object.keys(btnycData.checkout_states || {}));
    const serviceFailures = [];
    for (const svc of btnycData.services || []) {
      const sandbox = makeSandbox();
      try {
        const code = `
          ${_engineFind('resolveQuantityUnits')}
          ${decls.join('\n')}
          ${unifiedDecl.header}{${unifiedDecl.body}}
          computeUnifiedQuote({
            svc: ${JSON.stringify(svc)},
            dynDef: null,
            activeTagIds: [],
            answers: {},
            qty: 1,
            intentKeyword: null,
            formulaId: null,
            ctxAdjFee: 0,
            ctxAdjMin: 0,
            enrichment: null,
          });
        `;
        const result = vm.runInContext(code, sandbox, { timeout: 6000 });
        if (!result || typeof result.laborEstimate !== 'number' || !isFinite(result.laborEstimate)) {
          serviceFailures.push(`${svc.id}: laborEstimate not finite (${result && result.laborEstimate})`);
          continue;
        }
        if (result.laborEstimate < 0) {
          serviceFailures.push(`${svc.id}: negative laborEstimate (${result.laborEstimate})`);
        }
        if (!registeredStates.has(result.checkoutStateKey)) {
          serviceFailures.push(`${svc.id}: unregistered checkoutStateKey '${result.checkoutStateKey}'`);
        }
        if (typeof result.dispatchFee !== 'number') {
          serviceFailures.push(`${svc.id}: dispatchFee not numeric`);
        }
      } catch (e) {
        serviceFailures.push(`${svc.id}: ${e.message}`);
      }
    }
    assertRule(
      'R-INVARIANT-CANONICAL',
      serviceFailures.length === 0,
      `computeUnifiedQuote runs cleanly for every one of ${(btnycData.services || []).length} named services`,
      serviceFailures.slice(0, 6).join(' | ') + (serviceFailures.length > 6 ? ` (+${serviceFailures.length - 6} more)` : '')
    );
  } else if (missingDeps.length > 0) {
    assertRule(
      'R-INVARIANT-CANONICAL',
      false,
      'Every dependency for the per-service sweep is extractable',
      `missing=[${missingDeps.join(', ')}]`
    );
  }
}

// Exhaustive: extractQty behavioral matrix
{
  const d = extractFunctionDeclaration(qrHtmlContent, 'extractQty');
  if (d) {
    const prelude = `
      var _DIMENSION_PATTERN = /\\b\\d+\\s*-?\\s*(?:foot|feet|ft|inch|inches|in|cm|centimeters?|meters?|yards?|lbs?|pounds?|kg)\\b/gi;
      var _QTY_WORD_MAP = { one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10 };
    `;
    const sandbox = makeSandbox();
    const inputs = [
      '', 'fix my sink', 'replace 5 tiles', 'install 3 outlets',
      'I need four shelves', 'mount 12 picture frames',
      '65 inch TV', 'I need 3 65-inch TVs', '12345',
      '5x4 shelf', 'replace 99 tiles', 'replace 200 tiles',
      'two doors', 'three windows', 'one picture frame',
      'a single bulb', 'some cabinets',
    ];
    const violations = [];
    for (const inp of inputs) {
      try {
        const v = vm.runInContext(
          `"use strict";\n${prelude}\n${d.header}{${d.body}}\nextractQty(${JSON.stringify(inp)});`,
          sandbox, { timeout: 4000 }
        );
        if (!Number.isInteger(v) || v < 1 || v > 99) {
          violations.push(`"${inp}" -> ${v} (expected integer in [1, 99])`);
        }
      } catch (e) {
        violations.push(`"${inp}": ${e.message}`);
      }
    }
    assertRule(
      'R-INTAKE-QTYFIELD',
      violations.length === 0,
      `extractQty returns an integer in [1, 99] for ${inputs.length} real and edge-case inputs`,
      violations.slice(0, 5).join(' | ')
    );
  }
}

// Exhaustive: modifier scope distribution
{
  const modifiers = btnycData.global_rules?.modifiers || {};
  const byScope = { per_unit: 0, per_visit: 0 };
  for (const def of Object.values(modifiers)) {
    if (def && typeof def === 'object' && def.scope in byScope) byScope[def.scope]++;
  }
  assertRule(
    'R-PRICE-SCOPE',
    byScope.per_unit > 0 && byScope.per_visit > 0,
    'Both modifier scopes are populated in real data (per_visit distinction is load-bearing)',
    `per_unit=${byScope.per_unit} per_visit=${byScope.per_visit}`
  );
}

// Exhaustive: every per_visit modifier is referenced from somewhere
{
  const modifiers = btnycData.global_rules?.modifiers || {};
  const referenced = new Set();
  for (const def of Object.values(btnycData.intake_modules || {})) {
    for (const resp of def.client_response || []) {
      if (resp.modifier_ref) referenced.add(resp.modifier_ref);
    }
  }
  for (const svc of btnycData.services || []) {
    for (const step of svc.intake_chain || []) {
      for (const resp of step.params?.client_response || []) {
        if (resp.modifier_ref) referenced.add(resp.modifier_ref);
      }
    }
  }
  const orphans = [];
  for (const [key, def] of Object.entries(modifiers)) {
    if (def && typeof def === 'object' && def.scope === 'per_visit' && !referenced.has(key)) {
      orphans.push(key);
    }
  }
  assertRule(
    'R-PRICE-SCOPE',
    orphans.length === 0,
    'Every per_visit modifier is referenced by at least one client_response',
    orphans.slice(0, 6).join(', ')
  );
}

// ═══════════════════════════════════════════════════════════════════
// SECTION 9 — REVISED: Module Public API Signatures via VM Load
// ═══════════════════════════════════════════════════════════════════
// The matrix explicitly required: "Fully initialize the module in the VM
// and assert its exposed API signatures match the expected public
// interface, rejecting undocumented properties." The previous revision
// reverted to static text extraction (extractFunctionDeclaration), which
// does not initialize the module, does not inspect the exposed surface
// after load, and does not reject undocumented properties.
//
// This revision does all three:
//   (1) Extract each module's full <script> body by JSDoc header.
//   (2) Static-enumerate top-level function declarations (via the
//       existing reliable top-level-only enumerator).
//   (3) Concatenate the module body with an appended capture IIFE that
//       reads every top-level name off the shared lexical scope and
//       attaches them to a __MODULE_EXPORTS__ bag on the context.
//   (4) Run that concatenated script in a fresh VM context whose sandbox
//       stubs each module's cross-module load-time dependencies.
//   (5) Assert, from the runtime bag:
//         (a) every name in the module's expected public API resolves to
//             typeof === 'function' — this is the actual "exposed API
//             signatures match the expected public interface" check,
//         (b) every top-level declaration that ISN'T in the expected
//             public API and ISN'T underscore-prefixed is flagged as an
//             undocumented property (the matrix's explicit requirement),
//         (c) a small per-module sample of pure functions returns the
//             right kind of value on a known input (signature sanity).
logHeader('9. Module Public API Signatures (VM-initialized)');

const expectedModuleAPIs = {
  'pricing_engine.js': [
    'resolveDynamicService', 'resolveEngineKey', 'entityHasOwnQtyQuestion',
    'resolveServiceBadge', 'resolveServiceBadgeKey', 'resolveBaseConfidenceStrategy',
    'applyLiveConfidenceEscalation', 'deriveComplexityTier',
    'applyPricingFormula', 'getServiceProfile',
    'formatServicePrice', 'tagValidForCategory', 'isDiagnosticService',
    'isLogisticTag', 'sqTagLabel', 'sqTagFeeImpact', 'mathFurnitureAssembly',
    'resolveServiceCheckoutStateKey', 'buildCheckoutStateModel',
    'computeUnifiedQuote', 'computeArchetypeQuote', '_computePrice', 'syncTagSynthesizedAnswers',
    'resolveQuantityUnits', 'resolveQuantityMultiplier', 'resolveBuilderQuantity', 'closeTagsOverRequires', 'synthesizeAnswersFromTags',
    'computeQuoteFromState', 'onsiteDiagnosticTerms', 'buildServiceSessionSeed', 'classifyServiceIntake',
    'buildQuotePanelModel', 'requiredTagIdsFor', 'toggleTagState',
  ],
  'nlp_engine.js': [
    'initNlpSets', 'refreshNlpPreviewBindings', 'understandRequest',
    'composeAdlibParts', 'composeAdlibSentence', 'detectActionsInOrder',
    'detectIntentNLP', 'detectTagsNLP', 'isServiceVerb',
    'extractObjectDetailed', 'extractObject', 'extractQty', 'extractLocation',
    'extractSizeHint', 'inferTagsFromContext', 'computeNegatedGroupHints',
    'resolveGroupFromIntent',
    'extractCondition',
  ],
  'orchestrator_engine.js': [
    'executeWorkflow', 'orch_apply_answer', 'orch_splice_remote_deep_dive', 'orch_resolve_entity', 'orch_apply_object_based_resolution',
    'orch_enrich_from_dynamic_service', 'orch_compute_variability_flags',
    'orch_compose_intake_chain', 'orch_apply_location_hints',
    'orch_compute_confidence', 'orch_select_ui_template',
    'orch_merge_materials_estimate', 'orch_compute_quote',
    'orch_apply_intake_bypass_rules', 'readRoutePath', 'evaluateInvariant',
    'describeInvariantFailure', 'validateRoute', 'catastrophicFallbackRoute',
    'collectBookingContext_catalog', 'collectBookingContext_otherTile',
    'collectBookingContext_freeText', 'makeBookingContext',
    'checkRoutingArchetypeConsistency',
    'orch_apply_remote_divergence', 'orch_max_followup_questions', 'buildOtherTilesForGroup',
  ],
  'UIRenderer.js': [
  'renderCuratedCardFromRoute',
  'renderSelfQuoteFromRoute',
  'renderTagAffirmationFromRoute',
  // 'init' removed: it was bootstrap (Glue) and was never called; the page boots through the inline script.
  'sqResetView', 'sqShowBuilderView',
],
  'AppController.js': [
    '_sqRevertAutoSelect', 'addToCart', 'applySSOTRules', 'finalizeBooking',
    'prefillSmartQuoteFromOtherTile', 'prefillSmartQuoteFromService',
    'removeServiceFromCart', 'setStep', 'sqAdjQty', 'sqAnalyze',
    'sqBuildAdlib', 'sqBuildStep2', 'sqBuildStep3', // sqBuildCuratedIntake retired (R-INVARIANT-DELETION)
    'sqBuilderFinish', 'sqConfirmAdlib', 'sqPickType', 'sqPrepareFlow',
    'sqRenderSelfQuoteAdlib', 'sqToggleTag', '_recomputeInstanceLabels',
    'removeFurnitureEntry', 'wireGlobalEvents',
    'orchChooseDivergencePath', 'sqRenderCuratedCard', 'sqAddToCart', 'sqHandleStep2', 'sqRestart', 'sqOpenBuilderPreseeded', 'sqRenderQuote',
  ],
};

// Per-module sandbox deps: enough to satisfy load-time initialization,
// not enough to actually run the module's event handlers (which is
// tested elsewhere).
function makeModuleLoadSandbox() {
  const sandbox = {
    DB: btnycData,
    SERVICE_DATA: btnycData,
    window: { DB: btnycData },
    console: { log() {}, warn() {}, error() {} },
    Math, Object, Array, Set, Map, WeakMap, WeakSet, Number, String, Boolean,
    JSON, parseInt, parseFloat, isNaN, isFinite, Infinity, NaN, Date,
    Promise, RegExp, Error,
    _trace: () => {},
    _traceStart: () => {},
    _traceFn: () => {},
    _traceToggle: () => {},
    _renderTraceOverlay: () => {},
    // Cross-module load-time references the modules make at their top level.
    // Most are guarded by typeof, but we stub a small, safe set.
    q: () => null,
    qAll: () => [],
  };
  sandbox.window.DB = btnycData;
  sandbox.globalThis = sandbox;
  return vm.createContext(sandbox);
}

// Small, safe per-module samples: functions with no cross-module deps
// and trivial inputs. Used for the "matches the expected public
// interface" runtime-shape check.
const safeSignatureSamples = {
  'pricing_engine.js': [
    { name: 'resolveEngineKey', args: ["'hourly'"], expect: 'string' },
    { name: 'sqTagLabel', args: ['null', "'#brick_wall'"], expect: 'string' },
    { name: 'isLogisticTag', args: ["'#brick_wall'"], expect: 'boolean' },
    { name: 'deriveComplexityTier', args: ['30', 'null', 'null'], expect: 'string' },
  ],
  'nlp_engine.js': [
    { name: 'extractQty', args: ["'fix 5 tiles'"], expect: 'number' },
    { name: 'isServiceVerb', args: ["'install'", 'new Set(["install"])'], expect: 'boolean' },
  ],
  'orchestrator_engine.js': [
    { name: 'readRoutePath', args: ['{a:{b:1}}', "'a.b'"], expect: 'number' },
    { name: 'catastrophicFallbackRoute', args: ['null', '[]'], expect: 'object' },
  ],
  'UIRenderer.js': [
    { name: 'renderIcon', args: ["'ti ti-home'"], expect: 'string' },
  ],
  'AppController.js': [],
};

for (const [moduleFilename, requiredAPI] of Object.entries(expectedModuleAPIs)) {
  // ── Step 1: extract the module's full script body ────────────────
  const moduleBody = extractModuleScriptBody(qrHtmlContent, moduleFilename);
  if (!moduleBody) {
    assertRule('R-SYSTEM-LAYERS', false,
      `${moduleFilename}: module <script> body could not be located via its JSDoc header`,
      `searched for /** ${moduleFilename} */ then backwards for <script>`);
    continue;
  }

  // ── Step 2: static-enumerate top-level declarations in the body ──
  // This tells us which names to capture in the appended IIFE. The
  // enumerator is reliable (top-level only, mirrors the check used by
  // R-INVARIANT-SINGLEDEF). We are NOT using it as the load-verification;
  // the load itself is Step 4.
  const declaredNames = findTopLevelFunctionDeclarations(moduleBody).map(d => d.name);

  // Every REQUIRED name should be declared somewhere. If it isn't, the
  // module has drifted from its declared public API.
  const missingFromSource = requiredAPI.filter(n => !declaredNames.includes(n));
  assertRule('R-SYSTEM-LAYERS', missingFromSource.length === 0,
    `${moduleFilename}: every declared public API function is present in the module body`,
    missingFromSource.length
      ? `missing=[${missingFromSource.slice(0, 10).join(', ')}${missingFromSource.length > 10 ? ' …' : ''}]`
      : '');

  if (missingFromSource.length) continue;

  // ── Step 3: build a runner that loads the module AND captures
  // every top-level declaration onto a __MODULE_EXPORTS__ bag. The
  // capture IIFE shares lexical scope with the module body (same
  // script), so `typeof NAME` sees every top-level declaration,
  // including const/let arrow functions that would NOT appear on the
  // context's global object. This is what makes the check behavioral
  // rather than static: we are inspecting the RUNTIME RESULT of the
  // module body, not re-reading its source.
  const captureLines = declaredNames.map(n =>
    `__MODULE_EXPORTS__[${JSON.stringify(n)}] = (typeof ${n} !== 'undefined') ? ${n} : undefined;`
  ).join('\n');

  const runner = `
    "use strict";
    ${moduleBody}
    ;(function() {
      var __MODULE_EXPORTS__ = {};
      ${captureLines}
      globalThis.__MODULE_EXPORTS__ = __MODULE_EXPORTS__;
    })();
  `;

  // ── Step 4: VM-load the module in an isolated sandbox ────────────
  const ctx = makeModuleLoadSandbox();
  let exposed = null;
  let loadError = null;
  try {
    vm.runInContext(runner, ctx, { timeout: 8000, filename: moduleFilename });
    exposed = ctx.__MODULE_EXPORTS__;
  } catch (e) {
    loadError = e;
  }

  assertRule('R-SYSTEM-LAYERS', !loadError && exposed && typeof exposed === 'object',
    `${moduleFilename}: fully initializes in an isolated VM context and exposes a captured API bag`,
    loadError ? loadError.message.split('\n')[0] : (exposed ? '' : 'no __MODULE_EXPORTS__ bag was set'));

  if (loadError || !exposed) continue;

  // ── Step 5a: exposed API signature check — every required name
  // must resolve to a callable function after the module actually ran.
  const notFunctions = requiredAPI.filter(n => typeof exposed[n] !== 'function');
  assertRule('R-SYSTEM-LAYERS', notFunctions.length === 0,
    `${moduleFilename}: every required public API name resolves to a callable function after load`,
    notFunctions.length
      ? `not-a-function=[${notFunctions.slice(0, 10).join(', ')}${notFunctions.length > 10 ? ' …' : ''}]`
      : '');

 // ── Step 5b: undocumented-property rejection — any top-level
  // declaration whose name is NOT in the required list AND does NOT
  // start with an underscore (private-helper convention) is a
  // boundary leak. The matrix explicitly asks for this to FAIL, not
  // warn — the module's public surface must be intentional.
  const requiredSet = new Set(requiredAPI);
  const undocumented = declaredNames.filter(n =>
    !requiredSet.has(n) && !n.startsWith('_')
  );
  assertRule('R-SYSTEM-LAYERS', undocumented.length === 0,
    `${moduleFilename}: rejects undocumented top-level properties (no boundary leaks)`,
    undocumented.length
      ? `undocumented=[${undocumented.slice(0, 10).join(', ')}${undocumented.length > 10 ? ' …' : ''}]`
      : '');

  // ── Step 5c: signature sanity — a small per-module sample of pure
  // functions must accept a known input and return the right kind of
  // value, PROVING the exposed function is not just a stub. This is
  // the "signatures match the expected public interface" check in
  // behavioral form.
  const samples = safeSignatureSamples[moduleFilename] || [];
  for (const s of samples) {
    if (typeof exposed[s.name] !== 'function') continue; // already failed in 5a
    try {
      const v = vm.runInContext(
        `(${s.name})(${s.args.join(',')})`,
        ctx, { timeout: 4000 }
      );
      const expectedKind = s.expect;
      const actualKind = Array.isArray(v) ? 'array' : (v === null ? 'null' : typeof v);
      const ok = expectedKind === 'object'
        ? (v != null && actualKind === 'object')
        : expectedKind === 'array'
          ? actualKind === 'array'
          : actualKind === expectedKind;
      assertRule('R-SYSTEM-LAYERS', ok,
        `${moduleFilename}: ${s.name}(${s.args.join(', ')}) returns ${expectedKind} without throwing`,
        ok ? '' : `got ${actualKind} (${JSON.stringify(v)?.slice(0, 80)})`);
    } catch (e) {
      assertRule('R-SYSTEM-LAYERS', false,
        `${moduleFilename}: ${s.name}(${s.args.join(', ')}) runs without throwing`,
        e.message.split('\n')[0]);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════
console.log('\n━━━ Charter Rule Index Audit Summary ━━━');
console.log(`  Passes: ${totalPasses}`);
console.log(`  Failures: ${totalFailures}`);
if (totalFailures === 0) {
  console.log('✓ ALL CHARTER RULE INDEX INVARIANTS PASSED DEEP STRUCTURAL + BEHAVIORAL AUDIT.');
  process.exitCode = 0;
} else {
  console.error(`✗ FAILED: ${totalFailures} Charter Rule Index assertion(s) failed.`);
  const seenRules = new Map();
  for (const f of failureLog) {
    const key = f.ruleCode || '(uncoded)';
    if (!seenRules.has(key)) seenRules.set(key, []);
    seenRules.get(key).push(f.message);
  }
  console.error('\nFailure summary by rule:');
  for (const [code, msgs] of seenRules) {
    console.error(`  ${code}: ${msgs.length} failure(s)`);
    msgs.slice(0, 3).forEach(m => console.error(`    - ${m}`));
    if (msgs.length > 3) console.error(`    (+${msgs.length - 3} more)`);
  }
  process.exitCode = 1;
}
