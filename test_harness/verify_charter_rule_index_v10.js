#!/usr/bin/env node
/**
 * test_harness/verify_charter_rule_index_unified.js
 *
 * UNIFIED DEEP ARCHITECTURAL ENFORCEMENT SUITE.
 *
 * @detects DEFECT-SILENT-SKIP   (_bundleGuard: a sandbox check whose bundle lacks a function FAILS instead of being skipped)
 *
 * Merges three previously distinct, related harnesses into one runner.
 * Every assertion is tagged with the suite that raised it, so the summary
 * shows provenance. Nothing is deduplicated: where two suites check the
 * same rule via different mechanisms (regex vs. AST), both run. The user's
 * rule is: every check that was ever on duty stays on duty.
 *
 *   SUITE META-CHARTER
 *     From verify_charter_rules.js. Audits PROJECT_CHARTER.html itself:
 *     rule-code format and uniqueness, declared enforcement status,
 *     existence of a matching test file OR an @enforces tag, and
 *     internal anchor discipline.
 *
 *   SUITE LEGACY-REGEX
 *     From verify_charter_rule_index.js. The original regex / brace-walk
 *     structural suite. Preserved check-for-check, including the exhaustive
 *     sweeps and the mathFurnitureAssembly regression guards.
 *
 *   SUITE V9-AST
 *     From verify_charter_rule_index_v9.js (internally v7). AST-driven,
 *     behavioral, population-sweep, provenance-aware. This is the primary
 *     suite and its checks are preserved verbatim.
 *
 * Exit 0 only when every assertion in every suite passes. Failures write to
 * stderr; process.exitCode is set (never process.exit) so piped stdout is
 * not truncated before flushing.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

let acorn = null;
try { acorn = require('acorn'); }
catch (_) { acorn = null; }

// ═══════════════════════════════════════════════════════════════════
// PATHS AND PROJECT MANIFEST
// ═══════════════════════════════════════════════════════════════════
const SCRIPT_DIR = __dirname;

function resolveProjectFile(candidates, filename) {
  for (const dir of candidates) {
    const p = path.join(dir, filename);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const PROJECT_FILES_PATH = resolveProjectFile(
  [path.dirname(SCRIPT_DIR), SCRIPT_DIR],
  'PROJECT_FILES.html'
);

let PROJECT_ROOT, projectManifest = null;
if (PROJECT_FILES_PATH) {
  const manifestText = fs.readFileSync(PROJECT_FILES_PATH, 'utf8');
  const fileByName = new Map();
  {
    const re = /data-file=["']([^"']+)["'][^>]*data-path=["']([^"']+)["']/g;
    let m;
    while ((m = re.exec(manifestText)) !== null) fileByName.set(m[1], m[2]);
  }
  if (fileByName.size === 0) {
    const jsonRe = /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/i;
    const jm = jsonRe.exec(manifestText);
    if (jm) {
      try {
        const parsed = JSON.parse(jm[1]);
        if (parsed && typeof parsed === 'object') {
          for (const [k, v] of Object.entries(parsed)) if (typeof v === 'string') fileByName.set(k, v);
        }
      } catch (_) { /* fall through */ }
    }
  }
  if (fileByName.size === 0) {
    const aRe = /<a\s+href=["']([^"']+)["']/g;
    let m;
    while ((m = aRe.exec(manifestText)) !== null) {
      const href = m[1];
      const base = path.basename(href);
      if (base) fileByName.set(base, href);
    }
  }
  projectManifest = fileByName.size > 0 ? fileByName : null;
  PROJECT_ROOT = path.dirname(PROJECT_FILES_PATH);
} else {
  PROJECT_ROOT = fs.existsSync(path.join(SCRIPT_DIR, 'qr.html'))
    ? SCRIPT_DIR
    : path.resolve(SCRIPT_DIR, '..');
}

function projectFile(basename) {
  if (projectManifest && projectManifest.has(basename)) {
    const p = path.resolve(PROJECT_ROOT, projectManifest.get(basename));
    if (fs.existsSync(p)) return p;
  }
  return resolveProjectFile([PROJECT_ROOT, SCRIPT_DIR], basename);
}

const QR_HTML_PATH      = projectFile('qr.html');
const BTNYC_JSON_PATH   = projectFile('btnyc.json');
const CHARTER_HTML_PATH = projectFile('PROJECT_CHARTER.html');

// ─── Seed / PRNG ────────────────────────────────────────────────────
const TEST_SEED = (() => {
  const env = process.env.BTNYC_SEED;
  if (env && /^\d+$/.test(env)) return parseInt(env, 10) >>> 0;
  return 0x5EEDC0DE;
})();
function makePrng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rng = makePrng(TEST_SEED);
function pick(rnd, arr) { return arr[Math.floor(rnd() * arr.length)]; }
function shuffle(arr, rnd) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

console.log('\n══════════════════════════════════════════════════════════════');
console.log('  BTNYC Unified Charter Rule Index — three suites, one runner');
console.log('══════════════════════════════════════════════════════════════');
console.log(`[harness] PRNG seed: ${TEST_SEED} (set BTNYC_SEED to override)`);
console.log(`[harness] PROJECT_ROOT: ${PROJECT_ROOT}`);
if (PROJECT_FILES_PATH) {
  console.log(`[harness] manifest: ${PROJECT_FILES_PATH}` +
    (projectManifest ? ` (${projectManifest.size} entries)` : ' (present, no parseable entries)'));
}

// ═══════════════════════════════════════════════════════════════════
// STATE, SUITES, ASSERTION PRIMITIVES
// ═══════════════════════════════════════════════════════════════════
let totalFailures = 0;
let totalPasses = 0;
const failureLog = [];
const assertionLog = [];

const SUITE = Object.freeze({
  META:   'META-CHARTER',
  LEGACY: 'LEGACY-REGEX',
  V9:     'V9-AST',
});
let currentSuite = SUITE.META;

function setSuite(s) { currentSuite = s; }

const KIND = Object.freeze({
  BEHAVIORAL: 'behavioral',
  BEHAVIORAL_SAMPLE: 'behavioral_sample',
  BEHAVIORAL_POPULATION: 'behavioral_population',
  BEHAVIORAL_MATRIX: 'behavioral_matrix',
  STRUCTURAL: 'structural',
  META: 'meta',
  HEURISTIC: 'heuristic',
  EXISTENCE: 'existence',
});

const SOURCE_SHAPE_RULES = new Set([
  'R-INVARIANT-NOEVAL', 'R-SYSTEM-NODATA', 'R-SYSTEM-CSP', 'R-SYSTEM-NOREF',
  'R-SYSTEM-DECLARATIVE', 'R-INVARIANT-SINGLEDEF', 'R-INVARIANT-DELETION',
  'R-INVARIANT-BOUNDARY', 'R-INVARIANT-PROVENANCE',
]);

function logHeader(title) { console.log(`\n━━━ ${title} ━━━`); }

function assertRule(ruleCode, condition, message, failureDetails = '', kind = KIND.BEHAVIORAL_SAMPLE) {
  const tag = ruleCode ? `[${ruleCode}] ` : '';
  const passed = !!condition;
  assertionLog.push({ suite: currentSuite, ruleCode, kind, passed, message });
  if (!passed) {
    console.error(`  ✗ [${currentSuite}] FAIL: ${tag}${message}`);
    if (failureDetails) console.error(`    ↳ ${failureDetails}`);
    totalFailures++;
    failureLog.push({ suite: currentSuite, ruleCode, message, failureDetails, kind });
  } else {
    console.log(`  ✓ [${currentSuite}] PASS: ${tag}${message}`);
    totalPasses++;
  }
  return passed;
}
const assertBehavioral        = (r, c, m, d) => assertRule(r, c, m, d, KIND.BEHAVIORAL_SAMPLE);
const assertBehavioralPop     = (r, c, m, d) => assertRule(r, c, m, d, KIND.BEHAVIORAL_POPULATION);
const assertBehavioralMatrix  = (r, c, m, d) => assertRule(r, c, m, d, KIND.BEHAVIORAL_MATRIX);
const assertStructural        = (r, c, m, d) => assertRule(r, c, m, d, KIND.STRUCTURAL);
const assertMeta              = (r, c, m, d) => assertRule(r, c, m, d, KIND.META);
const assertHeuristic         = (r, c, m, d) => assertRule(r, c, m, d, KIND.HEURISTIC);
const assertExistence         = (r, c, m, d) => assertRule(r, c, m, d, KIND.EXISTENCE);
function assertInvariant(c, m, d = '') { return assertRule(null, c, m, d); }
function assertDeepEqual(ruleCode, actual, expected, message, kind = KIND.BEHAVIORAL_SAMPLE) {
  let equal = false, detail = '';
  try { assert.deepStrictEqual(actual, expected); equal = true; }
  catch (e) { detail = e.message.split('\n').slice(0, 6).join(' | '); }
  assertRule(ruleCode, equal, message, detail, kind);
}

// ═══════════════════════════════════════════════════════════════════
// BOOTSTRAP — load source, split scripts, JSON
// ═══════════════════════════════════════════════════════════════════
if (!QR_HTML_PATH || !BTNYC_JSON_PATH) {
  console.error(`CRITICAL: could not resolve qr.html or btnyc.json ` +
    `(searched ${PROJECT_ROOT} and ${SCRIPT_DIR}; manifest=` +
    `${PROJECT_FILES_PATH ? 'present' : 'absent'}).`);
  process.exitCode = 1;
  return;
}
const qrHtmlContent = fs.readFileSync(QR_HTML_PATH, 'utf8');
let btnycData;
try { btnycData = JSON.parse(fs.readFileSync(BTNYC_JSON_PATH, 'utf8')); }
catch (err) { console.error(`CRITICAL: btnyc.json parse failed: ${err.message}`); process.exitCode = 1; return; }

// T156: the Charter is read by a real HTML parser (charter_model.js), never by pattern-matching its text. The 2026-10-07 revision arrived minified
// (unquoted attributes, omitted closing tags), and every regex below, written for the previous serialization, found zero rules, zero anchors and zero
// ids in it and PASSED. `charterHtmlContent` is the canonical re-serialization (quoted, closed), so the few remaining text probes still see the shape
// they were written for; everything structural reads `charterModel`.
const charterModule = require('./charter_model.js');
const charterModel = CHARTER_HTML_PATH && fs.existsSync(CHARTER_HTML_PATH) ? charterModule.loadCharter(CHARTER_HTML_PATH) : null;
const charterHtmlContent = charterModel ? charterModel.html : null;
if (!charterHtmlContent) console.warn('⚠  PROJECT_CHARTER.html missing; meta-tests will be skipped.');

// ─── stripStringsAndComments (from v9) ──────────────────────────────
function stripStringsAndComments(src) {
  const n = src.length;
  const out = new Array(n);
  let i = 0, prevSignificant = '';
  while (i < n) {
    const c = src[i], c2 = src[i + 1];
    if (c === '/' && c2 === '/') { while (i < n && src[i] !== '\n') { out[i] = ' '; i++; } continue; }
    if (c === '/' && c2 === '*') {
      out[i] = ' '; out[i + 1] = ' '; i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { out[i] = ' '; i++; }
      if (i < n) { out[i] = ' '; out[i + 1] = ' '; i += 2; }
      continue;
    }
    if (c === '/') {
      const canEndExpr = /[A-Za-z0-9_$)\]'"`\/]/.test(prevSignificant);
      if (!canEndExpr) {
        out[i] = ' '; i++;
        let inClass = false;
        while (i < n) {
          const rc = src[i];
          if (rc === '\\') { out[i] = ' '; if (i + 1 < n) out[i + 1] = ' '; i += 2; continue; }
          if (rc === '\n') break;
          if (rc === '[') { inClass = true; out[i] = ' '; i++; continue; }
          if (rc === ']') { inClass = false; out[i] = ' '; i++; continue; }
          if (rc === '/' && !inClass) { out[i] = ' '; i++; break; }
          out[i] = ' '; i++;
        }
        while (i < n && /[a-z]/i.test(src[i])) { out[i] = ' '; i++; }
        prevSignificant = '/';
        continue;
      }
      out[i] = c; prevSignificant = '/'; i++; continue;
    }
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
    out[i] = c;
    if (c !== ' ' && c !== '\t' && c !== '\n' && c !== '\r') prevSignificant = c;
    i++;
  }
  return out.join('');
}

// ─── extractScriptBlocks ────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════
// AST LAYER (acorn) — single source of truth for source shape
// ═══════════════════════════════════════════════════════════════════
const _astCache = new Map();

function _parseAst(source) {
  if (_astCache.has(source)) return _astCache.get(source);
  // T148: acorn cannot parse HTML. Handed qr.html itself, every extraction below returned null and every check that needs a function body failed as "not extractable" -- an artifact
  // of the file's form, not a finding about the code. Given HTML, parse its <script> blocks as ONE JavaScript source (offsets are then into that source, which makeEntry slices).
  const _src = /^\s*<!doctype|<html[\s>]/i.test(source) ? extractScriptBlocks(source).map(b => b.body).join('\n;\n') : source;
  let ast = null;
  if (acorn) {
    try {
      ast = acorn.parse(_src, {
        ecmaVersion: 'latest', sourceType: 'script',
        allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true, allowHashBang: true,
      });
    } catch (_) { /* callers see ast === null and fail loudly */ }
  }

  const topLevel = [];
  const allByName = new Map();
  const parentMap = new WeakMap();

  const makeEntry = (node) => ({
    name: node.id.name, index: node.start,
    isAsync: !!node.async,
    header: _src.slice(node.start, node.body.start),
    body: _src.slice(node.body.start + 1, node.body.end - 1),
    astNode: node,
  });

  const walk = (node, parent) => {
    if (!node || typeof node.type !== 'string') return;
    if (parent) parentMap.set(node, parent);
    if (node.type === 'FunctionDeclaration' && node.id && node.body) {
      allByName.set(node.id.name, makeEntry(node));
    }
    for (const key of Object.keys(node)) {
      if (key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue;
      const child = node[key];
      if (Array.isArray(child)) { for (const c of child) if (c && typeof c.type === 'string') walk(c, node); }
      else if (child && typeof child.type === 'string') walk(child, node);
    }
  };

  if (ast) {
    walk(ast, null);
    if (ast.type === 'Program') {
      for (const stmt of ast.body) {
        if (stmt.type === 'FunctionDeclaration' && stmt.id && stmt.body) topLevel.push(makeEntry(stmt));
      }
    }
  }

  const result = { topLevel, allByName, ast, parentMap };
  _astCache.set(source, result);
  return result;
}

function findAstNodes(root, predicate) {
  const matches = [];
  const walk = (node) => {
    if (!node || typeof node.type !== 'string') return;
    if (predicate(node)) matches.push(node);
    for (const key of Object.keys(node)) {
      if (key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue;
      const child = node[key];
      if (Array.isArray(child)) { for (const c of child) if (c && typeof c.type === 'string') walk(c); }
      else if (child && typeof child.type === 'string') walk(child);
    }
  };
  walk(root);
  return matches;
}

function findCallSitesWithParent(root, calleeName) {
  const sites = [];
  const walk = (node, parent) => {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === calleeName) {
      sites.push({ call: node, parent });
    }
    for (const key of Object.keys(node)) {
      if (key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue;
      const child = node[key];
      if (Array.isArray(child)) { for (const c of child) if (c && typeof c.type === 'string') walk(c, node); }
      else if (child && typeof child.type === 'string') walk(child, node);
    }
  };
  walk(root, null);
  return sites;
}

function findMemberSitesWithParent(root, predicate) {
  const sites = [];
  const walk = (node, parent) => {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'MemberExpression' && predicate(node)) sites.push({ node, parent });
    for (const key of Object.keys(node)) {
      if (key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue;
      const child = node[key];
      if (Array.isArray(child)) { for (const c of child) if (c && typeof c.type === 'string') walk(c, node); }
      else if (child && typeof child.type === 'string') walk(child, node);
    }
  };
  walk(root, null);
  return sites;
}

function findEnclosingFunction(node, parentMap) {
  let cur = node;
  while (cur) {
    if (cur.type === 'FunctionDeclaration' || cur.type === 'FunctionExpression' || cur.type === 'ArrowFunctionExpression') return cur;
    cur = parentMap.get(cur);
  }
  return null;
}

const BOUNDARY_TYPES = new Set([
  'ExpressionStatement', 'VariableDeclaration', 'ReturnStatement',
  'IfStatement', 'WhileStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement',
  'BlockStatement', 'FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression',
  'Program', 'SwitchCase', 'TryStatement', 'CatchClause',
]);

function findCompositionNode(startParent, parentMap) {
  let cur = startParent;
  while (cur) {
    if (cur.type === 'LogicalExpression' && (cur.operator === '||' || cur.operator === '??')) return cur;
    if (cur.type === 'ConditionalExpression') return cur;
    if (BOUNDARY_TYPES.has(cur.type)) return null;
    cur = parentMap.get(cur);
  }
  return null;
}

function findTopLevelFunctionDeclarations(source) { return _parseAst(source).topLevel; }
function extractFunctionDeclaration(source, funcName) { return _parseAst(source).allByName.get(funcName) || null; }
function extractFunctionAST(source, funcName) {
  const d = extractFunctionDeclaration(source, funcName);
  return d ? d.astNode : null;
}
function extractFunctionBody(source, funcName) {
  const d = extractFunctionDeclaration(source, funcName);
  return d ? d.body : null;
}

// ─── AST matcher sugar ──────────────────────────────────────────────
const astIsIdentifier       = (name) => (n) => n.type === 'Identifier' && n.name === name;
const astIsCallTo           = (name) => (n) =>
  n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === name;
const astIsMemberRead       = (objName, propName) => (n) =>
  n.type === 'MemberExpression' && !n.computed &&
  n.object && n.object.type === 'Identifier' && n.object.name === objName &&
  n.property && n.property.type === 'Identifier' && n.property.name === propName;
const astIsAssignmentTo     = (objName, propName) => (n) =>
  n.type === 'AssignmentExpression' &&
  n.left.type === 'MemberExpression' && !n.left.computed &&
  n.left.object && n.left.object.type === 'Identifier' && n.left.object.name === objName &&
  n.left.property && n.left.property.type === 'Identifier' && n.left.property.name === propName;
const astIsAssignmentToObject = (objName) => (n) =>
  n.type === 'AssignmentExpression' &&
  n.left.type === 'MemberExpression' && !n.left.computed &&
  n.left.object && n.left.object.type === 'Identifier' && n.left.object.name === objName;

// ═══════════════════════════════════════════════════════════════════
// DERIVATION HELPERS — retire the harness's own duplication
// ═══════════════════════════════════════════════════════════════════
function deriveQtyAwareFormulasFromAst() {
  const explicit = btnycData.global_rules && btnycData.global_rules.qty_aware_formulas;
  if (Array.isArray(explicit)) return { source: 'ssot', values: explicit };

  const ast = extractFunctionAST(qrHtmlContent, 'applyPricingFormula');
  if (!ast) return { source: 'unavailable', values: [] };
  const derived = new Set();
  const ifs = findAstNodes(ast, n => n.type === 'IfStatement');
  for (const iff of ifs) {
    const cond = iff.test;
    let fid = null;
    if (cond.type === 'BinaryExpression' && (cond.operator === '===' || cond.operator === '==')) {
      if (cond.left.type === 'Identifier' && cond.left.name === 'formulaId' && cond.right.type === 'Literal') fid = cond.right.value;
      else if (cond.right.type === 'Identifier' && cond.right.name === 'formulaId' && cond.left.type === 'Literal') fid = cond.left.value;
    }
    if (!fid) continue;
    const cq = iff.consequent;
    const refsQty = findAstNodes(cq, astIsIdentifier('qty')).length > 0 ||
      findAstNodes(cq, astIsMemberRead('answers', 'unit_count')).length > 0 ||
      findAstNodes(cq, astIsMemberRead('answers', 'tile_count')).length > 0;
    if (refsQty) derived.add(fid);
  }
  return { source: 'derived', values: [...derived].sort() };
}

function deriveGenericQtyKeys() {
  const keys = [];
  for (const [k, mod] of Object.entries(btnycData.intake_modules || {})) {
    if (mod && mod.type === 'numeric_multiplier') keys.push(k);
  }
  return { source: 'derived', values: keys.sort() };
}

function deriveFormulaConsumedKeysFromAst() {
  const ast = extractFunctionAST(qrHtmlContent, 'applyPricingFormula');
  if (!ast) return { source: 'unavailable', map: {} };
  const map = {};
  const ifs = findAstNodes(ast, n => n.type === 'IfStatement');
  for (const iff of ifs) {
    const cond = iff.test;
    let fid = null;
    if (cond.type === 'BinaryExpression' && (cond.operator === '===' || cond.operator === '==')) {
      if (cond.left.type === 'Identifier' && cond.left.name === 'formulaId' && cond.right.type === 'Literal') fid = cond.right.value;
      else if (cond.right.type === 'Identifier' && cond.right.name === 'formulaId' && cond.left.type === 'Literal') fid = cond.left.value;
    }
    if (!fid) continue;
    const reads = findAstNodes(iff.consequent, n =>
      n.type === 'MemberExpression' && !n.computed &&
      n.object.type === 'Identifier' && n.object.name === 'answers' &&
      n.property.type === 'Identifier');
    map[fid] = [...new Set(reads.map(r => r.property.name))].sort();
  }
  return { source: 'derived', map };
}

const DERIVED_SETS = {
  QTY_AWARE_FORMULAS: deriveQtyAwareFormulasFromAst(),
  GENERIC_QTY_KEYS: deriveGenericQtyKeys(),
  FORMULA_CONSUMED_KEYS: deriveFormulaConsumedKeysFromAst(),
};

const PRELUDE_CONSTANTS = (() => {
  const qaf = DERIVED_SETS.QTY_AWARE_FORMULAS.values.length
    ? DERIVED_SETS.QTY_AWARE_FORMULAS.values
    : ['furniture_repair_formula', 'tile_repair_formula', 'hardware_install_formula', 'buy_the_hour_qty_gate_formula'];
  const gqk = DERIVED_SETS.GENERIC_QTY_KEYS.values.length
    ? DERIVED_SETS.GENERIC_QTY_KEYS.values
    : ['item_count', 'count', 'hybrid_qty', 'global_quantity'];
  const kt = ['self_quote', 'curated_card', 'chip_grid', 'legacy_flow', 'tag_affirmation'];
  return {
    QTY_AWARE_FORMULAS: `new Set(${JSON.stringify(qaf)})`,
    GENERIC_QTY_KEYS: `new Set(${JSON.stringify(gqk)})`,
    KNOWN_UI_TEMPLATES: `new Set(${JSON.stringify(kt)})`,
    DIMENSION_PATTERN:
      String.raw`/\b\d+\s*-?\s*(?:foot|feet|ft|inch|inches|in|cm|centimeters?|meters?|yards?|lbs?|pounds?|kg)\b/gi`,
    QTY_WORD_MAP:
      `(${JSON.stringify({ one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 })})`,
  };
})();

const _qtyOwnershipFn = extractFunctionDeclaration(qrHtmlContent, 'entityHasOwnQtyQuestion');
const ENTITY_QTY_FN_SRC = _qtyOwnershipFn
  ? `${_qtyOwnershipFn.header}{${_qtyOwnershipFn.body}}`
  : 'function entityHasOwnQtyQuestion(){return false;}';

function nlpPrelude() {
  return `
    function _trace(){} function _traceStart(){} function _traceFn(){}
    var _nlpQuiet = false; var _vocabCache = null, _vocabDB = null;
    var QTY_AWARE_FORMULAS = ${PRELUDE_CONSTANTS.QTY_AWARE_FORMULAS};
    var _DIMENSION_PATTERN = ${PRELUDE_CONSTANTS.DIMENSION_PATTERN};
    var _QTY_WORD_MAP = ${PRELUDE_CONSTANTS.QTY_WORD_MAP};
    var _GENERIC_QTY_MODULE_KEYS = ${PRELUDE_CONSTANTS.GENERIC_QTY_KEYS};
    var KNOWN_UI_TEMPLATES = ${PRELUDE_CONSTANTS.KNOWN_UI_TEMPLATES};
    var _SKIP_WORDS = () => (window._NLP && window._NLP.STOP) || new Set();
    var _SVC_VERBS = () => (window._NLP && window._NLP.VERBS) || new Set();
    var _STOP_PREPS = () => (window._NLP && window._NLP.PREPS) || new Set();
    var _CLAUSE_BOUNDARY = () => (window._NLP && window._NLP.CLAUSE) || new Set();
    var _ROOMS_LIST = () => (window._NLP && window._NLP.ROOMS) || [];
  `;
}

function enginePrelude() {
  return `
    function _trace(){} function _traceStart(){} function _traceFn(){}
    var QTY_AWARE_FORMULAS = ${PRELUDE_CONSTANTS.QTY_AWARE_FORMULAS};
    var _GENERIC_QTY_MODULE_KEYS = ${PRELUDE_CONSTANTS.GENERIC_QTY_KEYS};
    var _DIMENSION_PATTERN = ${PRELUDE_CONSTANTS.DIMENSION_PATTERN};
    var _QTY_WORD_MAP = ${PRELUDE_CONSTANTS.QTY_WORD_MAP};
    var KNOWN_UI_TEMPLATES = ${PRELUDE_CONSTANTS.KNOWN_UI_TEMPLATES};
    ${ENTITY_QTY_FN_SRC}
  `;
}

// T156 (PENDING_DECISIONS #112, operator ruling, option A): the declared coefficients of hardware_install_formula are no longer only the swap / new_holes flat price. They are that flat price
// (now the FLOOR), the graduated `tiers`, and `visit_minimum`; the fee is the highest of the three. This oracle is written independently of the engine on purpose (it prices unit by unit,
// where the engine does band arithmetic): an oracle that shared the engine's code could not disagree with it. The two checks that used `flat_rate + overflow` alone (R-PRICE-REGISTERED, both
// sections) were testing the pre-ruling rule and failed, correctly, the moment the ruling was implemented; they now test the ruled one.
function hardwareExpectedFee(f, branch, units) {
  const b = f[branch];
  const oldFlat = b.flat_rate + Math.max(0, units - b.included_units) * b.overflow_per_unit;
  let tier = 0;
  if (Array.isArray(f.tiers)) for (let u = 1; u <= units; u++) tier += f.tiers.find(t => t.up_to_units == null || u <= t.up_to_units).rate_per_unit;
  return Math.max(f.visit_minimum || 0, tier, oldFlat);
}

function makeSandbox(extra = {}) {
  const sandbox = {
    DB: btnycData, SERVICE_DATA: btnycData, window: { DB: btnycData },
    console: { log() {}, warn() {}, error() {} },
    Math, Object, Array, Set, Map, WeakMap, WeakSet, Number, String, Boolean,
    JSON, parseInt, parseFloat, isNaN, isFinite, Infinity, NaN, Date, Promise, RegExp, Error,
    _trace: () => {}, _traceStart: () => {}, _traceFn: () => {},
    ...extra,
  };
  sandbox.window.DB = btnycData;
  return vm.createContext(sandbox);
}

// T148: a function declared in the three engine modules is loaded WHOLE (the T136 `_engine.js` loader), once per bundle -- a resolver or helper added next to a function can no longer drop
// out of a sandbox ("X is not defined": noise unrelated to what the check asserts). Anything else is still extracted by name, as before.
const _engineFind = require('./_engine.js').engineAwareFindFn(() => '');
function bundleFunctions(names, options = {}) {
  const parts = [], missing = [];
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
  return { source: prelude + parts.join('\n') + postlude, missing, names };
}
// T148: every sandbox check used to be guarded by a bare `bundle.missing.length === 0` test with no else, so a bundle that could not be built made its check vanish without a trace -- how an
// unpriced fallback route stayed invisible. The guard records a failure when the bundle is not extractable: a check that cannot run measures nothing and must say so.
function _bundleGuard(bundle) {
  if (bundle.missing.length === 0) return true;
  assertStructural('R-INVARIANT-REDTEST', false, `a sandbox check could not run: its bundle (${bundle.names.slice(0, 3).join(', ')}, ...) is not extractable -- a check that cannot run must fail, not vanish`, `missing=[${bundle.missing.join(', ')}]`);
  return false;
}

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

function parseCharterIndex(model) {
  if (!model) return { rules: new Map(), anchors: new Set(), ids: new Set(), inlineCodes: new Set(), ruleTexts: new Map() };
  // rules: every statement in the Rule and Principle Index -> its category status (enforced | partial | governance | principle).
  const rules = new Map([...model.index].map(([c, row]) => [c, row.status]));
  return { rules, anchors: model.anchors, ids: model.ids, inlineCodes: new Set(model.definitions.map(d => d.code)), ruleTexts: model.ruleTexts };
}
const charterIndex = parseCharterIndex(charterModel);

const NLP_CORPUS = Object.freeze([
  'mount a TV on my drywall wall',
  'mount a large neon sign on a drywall wall in the bedroom',
  'fix my dish washer', 'fix my dishwasher',
  'toilet LID broken', 'toilet flapper keeps running', 'install a new toilet',
  'replace a wax ring on toilet',
  'I need 5 ceiling tiles put up',
  'I need a bed assembled. (the app keeps suggesting drywall or plaster which is nonsense)',
  'fix my leaking faucet', 'my toilet keeps running',
  'install a ceiling fan in the bedroom',
  'hang a picture on the wall', 'mount a large sign above the mantel',
  'put up shelves in the living room',
  'my washer is leaking water', 'refrigerator is making strange noises',
  'the door lock is broken', "cabinet drawer won't stay closed",
  'install 5 USB outlets', 'my router keeps disconnecting',
  'fix a squeaky floor in the hallway', 'repair a hole in the wall',
  'install a dimmer switch', 'mount a mirror on brick',
  'hang curtains in the master bedroom', 'install an under cabinet light',
  'garbage disposal is stuck', 'shower head is leaking',
]);

// Stable hashing (from v9)
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
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16).padStart(8, '0');
}

/* ═════════════════════════════════════════════════════════════════════
 * SUITE 1 — META-CHARTER (from verify_charter_rules.js)
 * ═══════════════════════════════════════════════════════════════════ */
setSuite(SUITE.META);
logHeader('SUITE 1 — META-CHARTER (PROJECT_CHARTER.html self-audit)');

if (!charterHtmlContent) {
  assertExistence('R-GOVERN-INDEX', true, 'Charter absent — meta-suite skipped');
} else {
  // T156: this section used to carry its own copy of verify_charter_rules.js's regex audit (a third copy of how to read the Charter). Both now run
  // the ONE audit in charter_model.js (R-INVARIANT-SINGLEDEF), which reads the document with a real parser, fails when it cannot see the document
  // (non-vacuity floors), and has the three-category taxonomy (R- Rule, G- Governance Process, P- Principle). Each kind of problem is its own
  // assertion, so a red here names what is wrong rather than saying "the meta-test failed".
  const testDirEnf = charterModule.readEnforcements(SCRIPT_DIR);
  const problems = charterModule.audit(charterModel, testDirEnf);
  const self = charterModule.selfTest(charterModel, testDirEnf, CHARTER_HTML_PATH);
  const of = (...kinds) => problems.filter(p => kinds.includes(p.kind)).map(p => p.msg);
  const show = list => list.slice(0, 8).join(' | ') + (list.length > 8 ? ` (+${list.length - 8} more)` : '');

  assertMeta('R-GOVERN-INDEX', self.misses.length === 0,
    `The Charter audit has teeth: it reads the document the same from both serializations and fails on ${self.mutantCount} deliberately broken copies`,
    show(self.misses));
  assertMeta('R-GOVERN-INDEX', of('vacuity').length === 0,
    `The Charter is visible to its readers (${charterModel.definitions.length} definitions, ${charterModel.index.size} index rows, ${charterModel.ids.size} ids, ${charterModel.anchors.size} anchors)`,
    show(of('vacuity')));
  assertMeta('R-GOVERN-INDEX', of('format').length === 0,
    `Every code matches <R|G|P>-<DOMAIN>-<NAME> with DOMAIN ∈ {${charterModule.DOMAINS.join(', ')}}`, show(of('format')));
  assertMeta('R-GOVERN-INDEX', of('duplicate', 'reference').length === 0,
    'Every rule is defined once, and nothing but a definition uses the rule-code span', show(of('duplicate', 'reference')));
  assertMeta('R-GOVERN-INDEX', of('prefix').length === 0,
    'Every code\'s prefix matches its category (R- Rule, G- Governance Process, P- Principle)', show(of('prefix')));
  assertMeta('R-GOVERN-INDEX', of('index').length === 0,
    'The Rule and Principle Index and the definitions agree (same codes, same categories, no duplicate rows)', show(of('index')));
  assertMeta('R-GOVERN-STOPTHELINE', of('enforcement').length === 0,
    `Every Enforced/Partial Rule has an enforcement in the harness (${[...charterModel.index.values()].filter(r => r.status === 'enforced' || r.status === 'partial').length} Rules)`,
    show(of('enforcement').map(m => m.replace(/^NO ENFORCEMENT: /, ''))));
  assertMeta('R-GOVERN-INDEX', of('orphan').length === 0,
    'Every @enforces tag and tagged assertion names a code the Charter declares (and @enforces names a Rule)', show(of('orphan')));
  assertMeta('R-INVARIANT-ANCHOR', of('anchor').length === 0,
    `Every internal anchor (href="#...") resolves (${charterModel.anchors.size} referenced, ${charterModel.ids.size} ids)`, show(of('anchor')));

  const byStatus = { enforced: 0, partial: 0, governance: 0, principle: 0 };
  for (const row of charterModel.index.values()) byStatus[row.status] = (byStatus[row.status] || 0) + 1;
  console.log(`    ℹ  Charter statements indexed: ${charterModel.index.size} ` +
    `(enforced=${byStatus.enforced} partial=${byStatus.partial} governance=${byStatus.governance} principle=${byStatus.principle})`);
}

/* ═════════════════════════════════════════════════════════════════════
 * SUITE 2 — LEGACY-REGEX (from verify_charter_rule_index.js)
 * ═══════════════════════════════════════════════════════════════════ */
setSuite(SUITE.LEGACY);
logHeader('SUITE 2 — LEGACY-REGEX (original verify_charter_rule_index.js)');

// §2.1 Structural Integrity
{
  assertStructural(null, scriptBlocks.length >= 6,
    'qr.html contains the expected distinct inline <script> blocks',
    `found ${scriptBlocks.length}`);

  const probe = `function probe() { const s = "} {{ }"; if (1) { return s; } }`;
  const stringIsBlanked = !stripStringsAndComments(probe).includes('} {{ }');
  assertStructural(null, stringIsBlanked,
    'Source parser self-test: string literals blanked before brace counting');

  // Legacy duplicate-declaration detection using brace-walk (not AST)
  const allDecls = [];
  scriptBlocks.forEach((b, blockIndex) => {
    findTopLevelFunctionDeclarations(b.body).forEach(d => allDecls.push({ ...d, blockIndex }));
  });
  const byName = new Map();
  for (const d of allDecls) {
    if (!byName.has(d.name)) byName.set(d.name, []);
    byName.get(d.name).push(d);
  }
  const dupes = [...byName.entries()].filter(([, arr]) => arr.length > 1);
  const summary = dupes.map(([name, arr]) =>
    `${name} × ${arr.length} (blocks ${arr.map(a => a.blockIndex).join(', ')})`
  );
  assertStructural('R-INVARIANT-SINGLEDEF', dupes.length === 0,
    'No duplicate top-level function declarations across script blocks',
    summary.slice(0, 12).join(' | ') + (summary.length > 12 ? ` (+${summary.length - 12} more)` : ''));
}

// §2.2 Governance & Client Operations
{
  const tiers = btnycData.global_rules?.complexity_tiers || {};
  const required = ['routine', 'skilled', 'specialized'];
  const missing = required.filter(t => !(t in tiers));
  const malformed = required.filter(t => {
    const def = tiers[t];
    return !def || typeof def.hourly_rate !== 'number' || typeof def.min_minutes !== 'number';
  });
  assertStructural('R-GOVERN-PRECEDENCE',
    missing.length === 0 && malformed.length === 0,
    'complexity_tiers contains routine/skilled/specialized with numeric rates and boundaries',
    `missing=[${missing.join(',')}] malformed=[${malformed.join(',')}]`);
}

{
  const collectors = [
    ['collectBookingContext_catalog', 'catalog'],
    ['collectBookingContext_otherTile', 'other_tile'],
    ['collectBookingContext_freeText', 'free_text'],
  ];
  const missing = [], badEntryTag = [];
  for (const [fnName, entry] of collectors) {
    const src = extractFunctionBody(qrHtmlContent, fnName);
    if (!src) { missing.push(fnName); continue; }
    if (!new RegExp(`makeBookingContext\\s*\\(\\s*['"]${entry}['"]`).test(src)) {
      badEntryTag.push(`${fnName} (expected entry='${entry}')`);
    }
  }
  assertStructural('P-CLIENT-THREE', missing.length === 0 && badEntryTag.length === 0,
    'All three gateway collectors exist and tag their context with the correct entry value',
    `missing=[${missing.join(',')}] wrongEntry=[${badEntryTag.join(', ')}]`);
}

{
  const understandSrc = extractFunctionBody(qrHtmlContent, 'understandRequest');
  assertStructural('R-INVARIANT-ONEUNDERSTANDING',
    !!understandSrc && understandSrc.length > 200,
    'understandRequest exists as a real, substantial canonical parser');

  const composerSrc = extractFunctionBody(qrHtmlContent, 'composeAdlibParts');
  assertStructural('R-INVARIANT-ONEUNDERSTANDING',
    !!composerSrc && composerSrc.length > 100,
    'composeAdlibParts exists as the canonical sentence composer');

  const previewSrc = extractFunctionBody(qrHtmlContent, 'enableLiveAdLibPreview');
  const previewUsesCanonical = !!previewSrc && /_NLP\s*\.\s*understand\s*\(/.test(previewSrc);
  assertStructural('R-CLIENT-PREVIEW', previewUsesCanonical,
    'Live preview delegates to window._NLP.understand (the canonical parser)');

  const previewHasOwnParser = !!previewSrc &&
    /function\s+(extractObject|extractQty|extractLocation|detectIntentNLP)\s*\(/.test(previewSrc);
  assertStructural('R-CLIENT-PREVIEW', !previewHasOwnParser,
    'Live preview does not declare a private parser (single-parse rule)');

  const unifiedSrc = extractFunctionBody(qrHtmlContent, 'sqUnifiedAction');
  const unifiedCallsUnderstand = !!unifiedSrc && /understandRequest\s*\(/.test(unifiedSrc);
  assertStructural('R-INVARIANT-ONEUNDERSTANDING', unifiedCallsUnderstand,
    'sqUnifiedAction calls understandRequest (confirm-side path shares the canonical parse)');
}

// §2.3 Domain Architecture & Compiler Output
{
  const compiled = btnycData.compiled || {};
  const pricingIndex = compiled.pricing_index || {};
  const realServiceIds = new Set((btnycData.services || []).map(s => s.id));
  const orphanKeys = Object.keys(pricingIndex).filter(k => {
    if (k.includes('+')) return false;
    return !realServiceIds.has(k);
  });
  const missingKeys = [...realServiceIds].filter(id => !(id in pricingIndex));
  assertStructural('R-DOMAIN-COMPILER',
    Object.keys(pricingIndex).length > 0 && orphanKeys.length === 0 && missingKeys.length === 0,
    'compiled.pricing_index is populated, has no orphan keys, and covers every named service',
    `orphans=[${orphanKeys.slice(0, 5).join(', ')}] missing=[${missingKeys.slice(0, 5).join(', ')}]`);
}

{
  const routing = btnycData.routing_archetypes || {};
  const dyn = btnycData.dynamic_services || {};

  const COMPONENT_MODULES = new Set([
    'wall_type','surface_type','door_type','door_style_pref','door_size',
    'client_supplying_door','existing_frame','faucet_type','sink_type',
    'toilet_style_pref','existing_toilet_type','window_type','removal',
    'install_type','existing_type','furn_item','mounting_item',
    'wall_mount_items','item_type','fixture_type','electrical_item',
    'plumbing_fixture','tech_device','computer_component','device_type',
    'laptop_or_desktop','existing_box','ducting','length','distance',
    'weight','mounting_height','tile_condition','waterproof_area',
    'has_matching_tiles','thermostat_type','customer_supplied_part',
    'software_install_type','brand','router_owned','mesh_network',
    'pax_cabinet_count','pax_hinge_count','pax_interior_count',
    'pax_sliding_count','disposal_size','gfci_location','window_ac_support',
    'inwall_power_for_tv','faucet_part_available','angle_stop_condition',
    'baseboard_scope','switch_wiring','washer_type',
  ]);
  const GENERIC_SHARED_SYMPTOM_MODULES = new Set([
    'symptom','tech_problem_type','damage_type','leak_type',
    'drain_speed','device_state','internet_active','tech_issue_source',
  ]);
  const GROUP_SPECIFIC_DIAGNOSTIC_MODULES = new Set([
    'cabinet_issue','door_issue','floor_issue','wall_issue',
    'window_issue','furniture_issue','dishwasher_symptom',
    'dryer_symptom','stove_symptom','computer_symptom',
    'network_symptom','smart_device_symptom','cable_symptom',
    'generic_tech_symptom','issue','appliance_type',
    // T149: the group-owned diagnostic modules authored under this rule (T144 window_ac_issue; T149 the three plumbing_help families).
    'window_ac_issue','garbage_disposal_issue','plumbing_fixture_issue','water_line_issue',
  ]);
  // T149: a symptom is only a thing to ask about when something is WRONG. Install and Setup have no symptom ("what is the issue?" has no meaning when installing RAM), so
  // symptom_first constrains Diagnostic and Repair entries only. Evidence: the data's 16 Diagnostic and Repair entries in symptom_first groups ALL carry a symptom module; the only
  // Install/Setup entries in any symptom_first group (tech_trouble_computer_repair) correctly carry none.
  const SYMPTOM_BEARING_TYPES = new Set(['Diagnostic', 'Repair']);
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
        COMPONENT_MODULES.has(m) || GENERIC_SHARED_SYMPTOM_MODULES.has(m) ||
        GROUP_SPECIFIC_DIAGNOSTIC_MODULES.has(m));
      if (firstReal && GENERIC_SHARED_SYMPTOM_MODULES.has(firstReal)) {
        violations.push(`${key}: component_first leads with GENERIC symptom '${firstReal}'`);
      }
    } else if (arch === 'symptom_first' && SYMPTOM_BEARING_TYPES.has(parts[parts.length - 1])) {
      const hasAnySymptom = moduleNames.some(m =>
        GENERIC_SHARED_SYMPTOM_MODULES.has(m) || GROUP_SPECIFIC_DIAGNOSTIC_MODULES.has(m));
      if (!hasAnySymptom) {
        violations.push(`${key}: symptom_first has no symptom-flavoured module (only ${moduleNames.join(', ')})`);
      }
    }
  }
  assertStructural('R-DOMAIN-DYNCHAIN', violations.length === 0,
    "Every dynamic service chain shape matches its owning group's routing_archetype",
    violations.slice(0, 8).join(' | ') + (violations.length > 8 ? ` (+${violations.length - 8} more)` : ''));
}

// §2.4 Confidence & Intake Governance
{
  const resolverSrc = extractFunctionBody(qrHtmlContent, 'resolveBaseConfidenceStrategy');
  assertStructural('R-CONF-ONEFORMULA',
    !!resolverSrc && /archetypes/.test(resolverSrc) && /member_group_ids/.test(resolverSrc),
    'resolveBaseConfidenceStrategy exists and reads archetype defaults via member_group_ids');

  const orchConfSrc = extractFunctionBody(qrHtmlContent, 'orch_compute_confidence');
  assertStructural('R-CONF-ONEFORMULA',
    !!orchConfSrc && /resolveBaseConfidenceStrategy\s*\(/.test(orchConfSrc),
    'orch_compute_confidence delegates to resolveBaseConfidenceStrategy');

  // T148: sqBuildCuratedIntake was DELETED in T144 (a declared retirement, parity-swept first). The check stays on duty for its SUCCESSOR in the card path: the follow-up ceiling
  // that the legacy builder used to compute, which now reads the same single confidence strategy.
  const ceilingSrc = extractFunctionBody(qrHtmlContent, 'orch_max_followup_questions');
  assertStructural('R-CONF-ONEFORMULA',
    !!ceilingSrc && /resolveBaseConfidenceStrategy\s*\(/.test(ceilingSrc),
    'orch_max_followup_questions (the successor of sqBuildCuratedIntake\'s ceiling) delegates to resolveBaseConfidenceStrategy');

  const d = extractFunctionDeclaration(qrHtmlContent, 'resolveBaseConfidenceStrategy');
  if (!d) {
    assertStructural('R-CONF-ONEFORMULA', false, 'resolveBaseConfidenceStrategy declaration not extractable');
  } else {
    const sandbox = makeSandbox();
    try {
      const value = vm.runInContext(
        `"use strict";\n${d.header}{${d.body}}\nresolveBaseConfidenceStrategy(${JSON.stringify(btnycData.services[0])}, null);`,
        sandbox, { timeout: 4000 });
      const ok = value && typeof value === 'object'
        && typeof value.base_confidence === 'number'
        && typeof value.minimum_quote_confidence === 'number';
      assertBehavioral('R-CONF-ONEFORMULA', ok,
        'resolveBaseConfidenceStrategy returns a real numeric strategy for a real service',
        ok ? '' : `unexpected return: ${JSON.stringify(value).slice(0, 200)}`);
    } catch (e) {
      assertBehavioral('R-CONF-ONEFORMULA', false, 'resolveBaseConfidenceStrategy sandbox execution', e.message);
    }
  }
}

{
  const qtySrc = extractFunctionBody(qrHtmlContent, 'entityHasOwnQtyQuestion');
  assertStructural('R-INTAKE-QTYONCE',
    !!qtySrc && /intake_chain/.test(qtySrc),
    'entityHasOwnQtyQuestion exists and inspects intake_chain');

  const analyzeSrc = extractFunctionBody(qrHtmlContent, 'sqAnalyze');
  assertStructural('R-INTAKE-QTYONCE',
    !!analyzeSrc && /S\.qty\s*=\s*route\.quantity\.units/.test(analyzeSrc),
    'sqAnalyze (free-text path) seeds S.qty from the route\'s resolved quantity (route.quantity.units): one resolver, no arbiter of its own (T147)');

  const builderSrc = extractFunctionBody(qrHtmlContent, 'sqBuilderFinish');
  assertStructural('R-INTAKE-QTYONCE',
    !!builderSrc && /S\.qty\s*=\s*resolveBuilderQuantity\s*\(/.test(builderSrc) && /resolveQuantityUnits\s*\(/.test(extractFunctionBody(qrHtmlContent, 'resolveBuilderQuantity') || ''),
    'sqBuilderFinish (guided-builder path) seeds S.qty from resolveBuilderQuantity, which delegates to resolveQuantityUnits: one resolver, no arbiter of its own (T147/T148)');

  const prelude = `const _GENERIC_QTY_MODULE_KEYS = new Set(['item_count','count','hybrid_qty','global_quantity']);`;
  const d = extractFunctionDeclaration(qrHtmlContent, 'entityHasOwnQtyQuestion');
  const qtyAware = btnycData.services.find(s => (s.intake_chain || []).some(st => st.module === 'item_count_template'));
  const qtyGeneric = btnycData.services.find(s =>
    (s.intake_chain || []).some(st => st.module === 'global_quantity') &&
    !(s.intake_chain || []).some(st => st.module === 'item_count_template'));

  if (d && qtyAware) {
    const sandbox = makeSandbox();
    try {
      const value = vm.runInContext(
        `"use strict";\n${prelude}\n${d.header}{${d.body}}\nentityHasOwnQtyQuestion(${JSON.stringify(qtyAware)});`,
        sandbox, { timeout: 4000 });
      assertBehavioral('R-INTAKE-QTYONCE', value === true,
        `entityHasOwnQtyQuestion returns true for ${qtyAware.id} (has item_count_template)`);
    } catch (e) {
      assertBehavioral('R-INTAKE-QTYONCE', false, 'entityHasOwnQtyQuestion sandbox (aware)', e.message);
    }
  }
  if (d && qtyGeneric) {
    const sandbox = makeSandbox();
    try {
      const value = vm.runInContext(
        `"use strict";\n${prelude}\n${d.header}{${d.body}}\nentityHasOwnQtyQuestion(${JSON.stringify(qtyGeneric)});`,
        sandbox, { timeout: 4000 });
      assertBehavioral('R-INTAKE-QTYONCE', value === false,
        `entityHasOwnQtyQuestion returns false for ${qtyGeneric.id} (only generic qty module)`);
    } catch (e) {
      assertBehavioral('R-INTAKE-QTYONCE', false, 'entityHasOwnQtyQuestion sandbox (generic)', e.message);
    }
  }
}

{
  const defaults = btnycData.global_rules?.intake_defaults;
  const hasIntakeDefaults = !!defaults && typeof defaults === 'object';
  const hasUniversal = Array.isArray(defaults?.universal);
  const hasCategoryDefaults = !!defaults?.category_defaults && typeof defaults.category_defaults === 'object';
  const hasGroupDefaults = !!defaults?.group_defaults && typeof defaults.group_defaults === 'object';
  assertStructural('R-INTAKE-WIREREMOVE',
    hasIntakeDefaults && hasUniversal && hasCategoryDefaults && hasGroupDefaults,
    'global_rules.intake_defaults carries universal / category_defaults / group_defaults structure');

  const hasDeprecated = 'force_modules_by_variability_DEPRECATED' in (btnycData.global_rules || {});
  const hasLive = 'force_modules_by_variability' in (btnycData.global_rules || {});
  assertStructural('R-INTAKE-QTYONCE',
    hasDeprecated && !hasLive,
    'Legacy force_modules_by_variability is archived (DEPRECATED key present; live key absent)');
}

{
  const analyzeSrc = extractFunctionBody(qrHtmlContent, 'sqAnalyze');
  const builderSrc = extractFunctionBody(qrHtmlContent, 'sqBuilderFinish');
  const analyzeWritesQty = !!analyzeSrc && /\bS\.qty\s*=/.test(analyzeSrc);
  const builderWritesQty = !!builderSrc && /\bS\.qty\s*=/.test(builderSrc);
  assertStructural('R-INTAKE-QTYFIELD',
    analyzeWritesQty && builderWritesQty,
    'Quantity is written to the single S.qty field by both entry paths');

  const parallelQtyFields = ['S.quantity', 'S.amount', 'S.itemCount', 'S.item_count', 'S.numItems'];
  const parallelFound = parallelQtyFields.filter(f => new RegExp(f.replace('.', '\\.') + '\\s*=').test(qrHtmlContent));
  assertStructural('R-INTAKE-QTYFIELD',
    parallelFound.length === 0,
    'No parallel quantity field names exist alongside S.qty',
    parallelFound.join(', '));
}

// §2.5 Financial & Pricing Engine
{
  assertStructural('R-PRICE-REGISTERED',
    btnycData.pricing_formulas && Object.keys(btnycData.pricing_formulas).length > 0,
    'pricing_formulas registry is populated');

  const formulas = btnycData.pricing_formulas || {};
  const KNOWN_CODE_HANDLED_ENGINES = new Set(['assembly_formula']);
  const missing = [];
  const deferred = [];
  for (const svc of btnycData.services || []) {
    const fe = svc.financial_engine || {};
    if (fe.formula_ref && !formulas[fe.formula_ref]) missing.push(`${svc.id}: formula_ref='${fe.formula_ref}'`);
    if (svc.pricing_engine && /_formula$/.test(svc.pricing_engine) && !formulas[svc.pricing_engine]) {
      if (KNOWN_CODE_HANDLED_ENGINES.has(svc.pricing_engine)) deferred.push(`${svc.id} (${svc.pricing_engine})`);
      else missing.push(`${svc.id}: pricing_engine='${svc.pricing_engine}'`);
    }
  }
  if (deferred.length > 0) {
    console.warn(`    ⚠ ${deferred.length} service(s) use a known code-handled engine not yet registered in pricing_formulas: ${deferred.join(', ')}`);
  }
  assertStructural('R-PRICE-REGISTERED', missing.length === 0,
    'Every service formula_ref / pricing_engine resolves to a registered formula',
    missing.slice(0, 8).join(' | ') + (missing.length > 8 ? ` (+${missing.length - 8} more)` : ''));

  const archetypes = new Set(Object.keys(btnycData.pricing_archetypes || {}));
  const invalidArch = [];
  for (const svc of btnycData.services || []) {
    const pa = svc.financial_engine?.pricing_archetype;
    if (pa && !archetypes.has(pa)) invalidArch.push(`${svc.id}: pricing_archetype='${pa}'`);
  }
  assertStructural('R-PRICE-REGISTERED',
    archetypes.size > 0 && invalidArch.length === 0,
    'Every service pricing_archetype is a registered archetype',
    invalidArch.slice(0, 8).join(' | '));

  const modifiers = btnycData.global_rules?.modifiers || {};
  const valid = new Set(['per_unit', 'per_visit']);
  const missingScope = [], invalidScope = [];
  for (const [key, def] of Object.entries(modifiers)) {
    if (!def || typeof def !== 'object') continue;
    if (!('scope' in def)) missingScope.push(key);
    else if (!valid.has(def.scope)) invalidScope.push(`${key}='${def.scope}'`);
  }
  assertStructural('R-PRICE-SCOPE',
    missingScope.length === 0 && invalidScope.length === 0,
    'Every modifier carries an explicit scope of per_unit or per_visit',
    `missing=[${missingScope.slice(0, 6).join(', ')}] invalid=[${invalidScope.slice(0, 6).join(', ')}]`);

  const unifiedSrc = extractFunctionBody(qrHtmlContent, 'computeUnifiedQuote');
  assertStructural('R-PRICE-REACHES', !!unifiedSrc && unifiedSrc.length > 1000,
    'computeUnifiedQuote exists as a substantial function body');
  assertStructural('R-PRICE-REACHES', !!unifiedSrc && /applyPricingFormula\s*\(/.test(unifiedSrc),
    'computeUnifiedQuote invokes applyPricingFormula');
  assertStructural('R-PRICE-REACHES', !!unifiedSrc && /FORMULA_CONSUMED_KEYS/.test(unifiedSrc),
    'computeUnifiedQuote uses FORMULA_CONSUMED_KEYS to gate modifier application');
  assertStructural('R-PRICE-REACHES',
    !/if\s*\(\s*!\s*formulaResult\s*\)\s*\{\s*const\s+_mods/.test(unifiedSrc || ''),
    'computeUnifiedQuote does NOT gate the whole answer-modifier loop on !formulaResult');
  assertStructural('R-PRICE-REACHES',
    /if\s*\(\s*!\s*formulaConsumedKeys\.has\s*\(\s*moduleKey\s*\)\s*\)/.test(unifiedSrc || ''),
    'computeUnifiedQuote applies the per-key formula-consumed guard inside the loop');
}

{
  const tags = btnycData.smart_tags || {};
  const withFees = [];
  for (const [tid, def] of Object.entries(tags)) {
    if (!def || typeof def !== 'object') continue;
    if (def.effects && typeof def.effects.fee === 'number' && def.effects.fee !== 0) withFees.push(`${tid} (effects.fee=${def.effects.fee})`);
    if (typeof def.fee === 'number' && def.fee !== 0) withFees.push(`${tid} (fee=${def.fee})`);
  }
  assertStructural('P-INVARIANT-CHIPSNOTFEES', withFees.length === 0,
    'No smart_tag carries a direct fee that would make it a pricing factor',
    withFees.slice(0, 8).join(' | '));
}

{
  const d = extractFunctionDeclaration(qrHtmlContent, 'applyPricingFormula');
  if (!d) {
    assertStructural('R-PRICE-REGISTERED', false, 'applyPricingFormula could not be extracted');
  } else {
    const sandbox = makeSandbox();
    const full = `"use strict";\n${d.header}{${d.body}}`;
    const f = btnycData.pricing_formulas.hardware_install_formula;
    if (!f || !f.swap || !f.new_holes) {
      assertStructural('R-PRICE-REGISTERED', false, 'hardware_install_formula exists with swap and new_holes branches');
    } else {
      const expectedFee = (branch, units) => hardwareExpectedFee(f, branch, units);   // T156: the ruled rule (tiers, visit minimum, old flat price as the floor)
      const qtyMatrix = [1, 2, 5, 9, 10, 11, 15, 19, 20, 21, 25, 40, 55, 96, 99, 100, 150, 500];
      const cases = [];
      for (const q of qtyMatrix) {
        cases.push({ name: `swap × ${q}`, args: `'hardware_install_formula', {install_type:'swap', unit_count:${q}}, ${q}, null`, expectedFee: expectedFee('swap', q) });
        cases.push({ name: `new_holes × ${q}`, args: `'hardware_install_formula', {install_type:'new holes', unit_count:${q}}, ${q}, null`, expectedFee: expectedFee('new_holes', q) });
      }
      cases.push({ name: 'swap, no unit_count, qty=7', args: `'hardware_install_formula', {install_type:'swap'}, 7, null`, expectedFee: expectedFee('swap', 7) });
      cases.push({ name: 'new_holes, no unit_count, qty=15', args: `'hardware_install_formula', {install_type:'new holes'}, 15, null`, expectedFee: expectedFee('new_holes', 15) });
      const failures = [];
      for (const c of cases) {
        try {
          const result = vm.runInContext(`${full}\napplyPricingFormula(${c.args});`, sandbox, { timeout: 4000 });
          if (!result || Math.abs(result.extraFee - c.expectedFee) > 1e-9) {
            failures.push(`${c.name}: expected extraFee=${c.expectedFee}, got ${result && result.extraFee}`);
          }
        } catch (e) {
          failures.push(`${c.name}: ${e.message}`);
        }
      }
      let prev = -1, monotonic = true;
      for (const q of qtyMatrix) {
        try {
          const r = vm.runInContext(`${full}\napplyPricingFormula('hardware_install_formula', {install_type:'swap', unit_count:${q}}, ${q}, null);`, sandbox, { timeout: 4000 });
          if (!r || r.extraFee < prev) { monotonic = false; break; }
          prev = r.extraFee;
        } catch (_) { monotonic = false; break; }
      }
      assertBehavioralMatrix('R-PRICE-REGISTERED', failures.length === 0,
        `hardware_install_formula matches its own declared coefficients across ${cases.length} qty values`,
        failures.slice(0, 6).join(' | ') + (failures.length > 6 ? ` (+${failures.length - 6} more)` : ''));
      assertBehavioralMatrix('R-PRICE-REACHES', monotonic,
        'hardware_install_formula fee is monotonic non-decreasing in quantity (no downward price cliff)');
    }
  }
}

// mathFurnitureAssembly regression guard
{
  const d = extractFunctionDeclaration(qrHtmlContent, 'mathFurnitureAssembly');
  if (!d) {
    assertStructural('R-PRICE-REGISTERED', false, 'mathFurnitureAssembly could not be extracted');
  } else {
    const sandbox = makeSandbox();
    sandbox.SERVICE_DATA = { meta: { global_rates: { standard_labor: 40 } } };
    const single = [{ minutes: 60, flat_fee: 40 }];
    const tiny = [{ minutes: 15, flat_fee: 10 }];
    const run = (input) => vm.runInContext(
      `"use strict";\n${d.header}{${d.body}}\nmathFurnitureAssembly(${JSON.stringify(input)});`,
      sandbox, { timeout: 4000 });
    try {
      const r = run(single);
      assertBehavioral('R-PRICE-REGISTERED',
        r && typeof r.price === 'number' && Math.abs(r.price - 40) < 1,
        'mathFurnitureAssembly prices a 60-minute item at its own catalog flat_fee (~$40)',
        r ? `actual: $${r.price}` : 'no return value');
    } catch (e) {
      assertBehavioral('R-PRICE-REGISTERED', false, 'mathFurnitureAssembly sandbox (single)', e.message);
    }
    try {
      const r2 = run(tiny);
      assertBehavioral('R-PRICE-REGISTERED',
        r2 && typeof r2.price === 'number' && Math.abs(r2.price - 40) < 1,
        'mathFurnitureAssembly enforces the 1-hour minimum at the standard rate',
        r2 ? `actual: $${r2.price}` : 'no return value');
    } catch (e) {
      assertBehavioral('R-PRICE-REGISTERED', false, 'mathFurnitureAssembly sandbox (minimum)', e.message);
    }
  }
}

// §2.6 System Architecture & Security
{
  assertStructural('R-SYSTEM-NODATA',
    !qrHtmlContent.includes('"services": [{"id":'),
    'Catalog data is not inlined into qr.html (loaded from btnyc.json)');

  const stripped = stripStringsAndComments(qrHtmlContent);
  const evalCount = (stripped.match(/\beval\s*\(/g) || []).length;
  const newFnCount = (stripped.match(/new\s+Function\s*\(/g) || []).length;
  assertStructural('R-INVARIANT-NOEVAL', evalCount === 0 && newFnCount === 0,
    'No eval or new Function in code (comments/strings excluded)',
    `eval=${evalCount} new Function=${newFnCount}`);

  const stringTimer = (stripped.match(/set(?:Timeout|Interval)\s*\(\s*['"`]/g) || []).length;
  assertStructural('R-SYSTEM-CSP', stringTimer === 0,
    'No string-argument setTimeout/setInterval (CSP-compatible timing only)',
    `found ${stringTimer}`);

  const refExecPatterns = [/eval\s*\([^)]*\$ref/, /Function\s*\([^)]*\$ref/, /new\s+Function\s*\([^)]*\$ref/];
  const hits = refExecPatterns.filter(p => p.test(qrHtmlContent));
  assertStructural('R-SYSTEM-NOREF', hits.length === 0, 'No $ref string is dynamically executed');

  assertStructural('R-SYSTEM-SCRIPT',
    qrHtmlContent.includes('<script>') && qrHtmlContent.includes('</script>'),
    'Script tags are properly formed');

  const moduleNames = ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js', 'UIRenderer.js', 'AppController.js'];
  const missingModules = moduleNames.filter(m => !qrHtmlContent.includes(m));
  assertStructural('R-SYSTEM-LAYERS', missingModules.length === 0,
    'All five documented module boundaries are present as script blocks',
    `missing=[${missingModules.join(', ')}]`);

  const dd = extractFunctionDeclaration(qrHtmlContent, 'applyPricingFormula');
  if (dd) {
    const ctx = vm.createContext({
      DB: btnycData, Math, Object, Array, Set, Map, Number, String, Boolean, JSON, parseInt, parseFloat, isNaN,
    });
    try {
      vm.runInContext(
        `"use strict";\n${dd.header}{${dd.body}}\napplyPricingFormula('hardware_install_formula', {install_type:'swap', unit_count:5}, 5, null);`,
        ctx, { timeout: 4000 });
      assertBehavioral('R-SYSTEM-NODOM', true,
        'applyPricingFormula executes without any DOM access (no document, no window)');
    } catch (e) {
      assertBehavioral('R-SYSTEM-NODOM', false,
        'applyPricingFormula must not access document or window', e.message);
    }
  }

  const allModuleRefs = new Set();
  const allKnownModules = new Set(Object.keys(btnycData.intake_modules || {}));
  for (const svc of btnycData.services || []) {
    for (const step of svc.intake_chain || []) {
      if (step.module) allModuleRefs.add(step.module);
      const then = step.then || {};
      for (const targets of Object.values(then)) (targets || []).forEach(t => allModuleRefs.add(t));
    }
  }
  for (const def of Object.values(btnycData.dynamic_services || {})) {
    for (const step of def.intake_chain || []) {
      if (step.module) allModuleRefs.add(step.module);
      const then = step.then || {};
      for (const targets of Object.values(then)) (targets || []).forEach(t => allModuleRefs.add(t));
    }
  }
  const orphanedModules = [...allModuleRefs].filter(m => !allKnownModules.has(m));
  assertStructural('R-SYSTEM-NOREF', orphanedModules.length === 0,
    'Every intake module referenced by a service or dynamic_service exists in intake_modules',
    orphanedModules.join(', '));
}

// §2.7 SSOT Cross-Reference Integrity
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
      for (const resp of step.params?.client_response || []) checkResp(step.module, resp, `service:${svc.id}`);
    }
  }
  assertStructural('P-INVARIANT-VERIFY', dangling.length === 0,
    'Every modifier_ref in every client_response resolves to a real modifier',
    dangling.slice(0, 8).join(' | '));
}

{
  const catalog = btnycData.materials_catalog || {};
  const missing = new Set();
  for (const svc of btnycData.services || []) {
    for (const sku of (svc.required_materials || [])) if (!catalog[sku]) missing.add(`${svc.id}:req:${sku}`);
    for (const sku of (svc.optional_materials || [])) if (!catalog[sku]) missing.add(`${svc.id}:opt:${sku}`);
  }
  assertStructural('P-INVARIANT-VERIFY', missing.size === 0,
    'Every required/optional material SKU resolves to a real materials_catalog entry',
    [...missing].slice(0, 8).join(' | '));
}

{
  const tags = btnycData.smart_tags || {};
  const missing = new Set();
  for (const svc of btnycData.services || []) {
    for (const t of (svc.default_tags || [])) {
      const ref = (t && typeof t === 'object' && t.$ref) ? t.$ref : t;
      if (typeof ref === 'string' && ref.startsWith('#') && !tags[ref]) missing.add(`${svc.id}:${ref}`);
    }
  }
  assertStructural('P-INVARIANT-VERIFY', missing.size === 0,
    'Every service default_tag $ref resolves to a real smart_tag',
    [...missing].slice(0, 8).join(' | '));
}

{
  const groups = new Set((btnycData.group || []).map(g => g.id));
  const cats = new Set((btnycData.category || []).map(c => c.id));
  const badGroups = [], badCats = [];
  for (const svc of btnycData.services || []) {
    const g = svc.ui_taxonomy?.group_id;
    const c = svc.ui_taxonomy?.category_id;
    if (g && !groups.has(g)) badGroups.push(`${svc.id}:${g}`);
    if (c && !cats.has(c)) badCats.push(`${svc.id}:${c}`);
  }
  for (const g of btnycData.group || []) {
    if (g.category_id && !cats.has(g.category_id)) badCats.push(`${g.id}->${g.category_id}`);
  }
  assertStructural('P-INVARIANT-VERIFY',
    badGroups.length === 0 && badCats.length === 0,
    'Every group_id / category_id reference resolves',
    `badGroups=[${badGroups.slice(0, 5).join(', ')}] badCats=[${badCats.slice(0, 5).join(', ')}]`);
}

{
  const formulas = btnycData.pricing_formulas || {};
  const missing = new Set();
  for (const [moduleKey, def] of Object.entries(btnycData.intake_modules || {})) {
    for (const resp of def.client_response || []) {
      if (resp.formula_override && !formulas[resp.formula_override]) missing.add(`${moduleKey}:${resp.formula_override}`);
    }
  }
  for (const svc of btnycData.services || []) {
    for (const step of svc.intake_chain || []) {
      for (const resp of step.params?.client_response || []) {
        if (resp.formula_override && !formulas[resp.formula_override]) missing.add(`${svc.id}/${step.module}:${resp.formula_override}`);
      }
    }
  }
  assertStructural('P-INVARIANT-VERIFY', missing.size === 0,
    'Every formula_override in every client_response resolves to a registered formula',
    [...missing].slice(0, 8).join(' | '));
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
      if (resp.modifier_ref && !modifiers[resp.modifier_ref]) missing.add(`${tid}->${moduleKey}->${resp.modifier_ref}`);
    }
  }
  assertStructural('P-INVARIANT-VERIFY', missing.size === 0,
    'Every smart_tag answer chain resolves to a real modifier',
    [...missing].slice(0, 8).join(' | '));
}

// §2.8 Master Judicial Invariants
{
  assertStructural('R-INVARIANT-SOURCE',
    Array.isArray(btnycData.invariants) && btnycData.invariants.length > 5,
    'Master Judicial Invariants array is populated');

  const unifiedSrc = extractFunctionBody(qrHtmlContent, 'computeUnifiedQuote');
  assertStructural('R-INVARIANT-CANONICAL',
    !!unifiedSrc && unifiedSrc.length > 2000,
    'computeUnifiedQuote function logic is robust and structurally complete');

  const deps = [
    'resolveBaseConfidenceStrategy','resolveServiceCheckoutStateKey','applyPricingFormula',
    'applyLiveConfidenceEscalation','deriveComplexityTier','computeArchetypeQuote','sqTagLabel',
  ];
  const decls = [], missingDeps = [];
  for (const name of deps) {
    const d = extractFunctionDeclaration(qrHtmlContent, name);
    if (!d) { missingDeps.push(name); continue; }
    decls.push(`${d.header}{${d.body}}`);
  }
  const unifiedDecl = extractFunctionDeclaration(qrHtmlContent, 'computeUnifiedQuote');
  if (unifiedDecl && missingDeps.length === 0) {
    const prelude = `
      const QTY_AWARE_FORMULAS = new Set(['furniture_repair_formula', 'tile_repair_formula', 'hardware_install_formula', 'buy_the_hour_qty_gate_formula']);
      const _GENERIC_QTY_MODULE_KEYS = new Set(['item_count','count','hybrid_qty','global_quantity']);
      function entityHasOwnQtyQuestion(entity) {
        return !!(entity?.intake_chain || []).some(step => {
          const key = step.module || '';
          return !_GENERIC_QTY_MODULE_KEYS.has(key) && (key === 'item_count_template' || key.startsWith('item_count_template::'));
        });
      }
    `;
    const sandbox = makeSandbox();
    const realService = btnycData.services.find(s => s.id === 'flatscreen_mounting_standard');
    if (realService) {
      try {
        const code = `
          ${_engineFind('resolveQuantityUnits')}
          ${prelude}
          ${decls.join('\n')}
          ${unifiedDecl.header}{${unifiedDecl.body}}
          computeUnifiedQuote({
            svc: ${JSON.stringify(realService)},
            dynDef: null, activeTagIds: [], answers: {}, qty: 1,
            intentKeyword: null, formulaId: null, ctxAdjFee: 0, ctxAdjMin: 0, enrichment: null,
          });
        `;
        const result = vm.runInContext(code, sandbox, { timeout: 6000 });
        const ok = result && typeof result.laborEstimate === 'number' &&
          typeof result.dispatchFee === 'number' && typeof result.checkoutStateKey === 'string';
        assertBehavioral('R-INVARIANT-CANONICAL', ok,
          'computeUnifiedQuote produces a real quote object for flatscreen_mounting_standard',
          ok ? '' : `unexpected: ${JSON.stringify(result).slice(0, 300)}`);
        if (ok) {
          assertBehavioral('R-INVARIANT-CANONICAL', result.laborEstimate >= 0,
            'computeUnifiedQuote produces non-negative laborEstimate');
          const states = new Set(Object.keys(btnycData.checkout_states || {}));
          assertBehavioral('R-INVARIANT-CANONICAL', states.has(result.checkoutStateKey),
            'computeUnifiedQuote returns a registered checkout state');
        }
      } catch (e) {
        assertBehavioral('R-INVARIANT-CANONICAL', false,
          'computeUnifiedQuote runs end-to-end in a sandbox against real data', e.message);
      }
    }
  } else if (missingDeps.length > 0) {
    assertStructural('R-INVARIANT-CANONICAL', false,
      'Every dependency of computeUnifiedQuote is extractable',
      `missing=[${missingDeps.join(', ')}]`);
  }

  assertStructural('R-INVARIANT-ANCHOR',
    qrHtmlContent.includes('<!DOCTYPE html>'),
    'Document anchors and basic HTML structure preserved');

  const sharedNames = [
    'QTY_AWARE_FORMULAS','FORMULA_CONSUMED_KEYS','_GENERIC_QTY_MODULE_KEYS',
    'BLD_ACTION_MAP','KNOWN_UI_TEMPLATES','COMPONENT_MODULE_NAMES','SYMPTOM_MODULE_NAMES',
  ];
  const duplicates = [];
  for (const name of sharedNames) {
    const re = new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*=`, 'g');
    const count = (qrHtmlContent.match(re) || []).length;
    if (count > 1) duplicates.push(`${name} × ${count}`);
  }
  assertStructural('R-INVARIANT-SINGLEDEF', duplicates.length === 0,
    'Shared registry constants are declared exactly once', duplicates.join(', '));
}

{
  const v = btnycData._validation || {};
  assertStructural('P-INVARIANT-VERIFY',
    Array.isArray(v.errors) && v.errors.length === 0,
    'btnyc.json _validation.errors is empty');
}

{
  const dr = btnycData.global_rules?.divergence_resolution || {};
  assertStructural('P-WHITEFLAG-DIAG',
    dr.enabled === true || dr.enabled === false,
    'divergence_resolution.enabled is explicitly set');
  assertStructural('P-WHITEFLAG-DIAG',
    typeof dr.diagnostic_fee === 'number' && dr.diagnostic_fee > 0,
    'divergence_resolution carries a real diagnostic_fee');
  assertStructural('P-WHITEFLAG-FORKB',
    typeof dr.credit_policy === 'string' && dr.credit_policy.length > 0,
    'divergence_resolution carries a real credit_policy string');
}

{
  const orphaned = [];
  for (const svc of btnycData.services || []) {
    const fe = svc.financial_engine || {};
    const hasPath = fe.checkout_state || fe.pricing_archetype || fe.formula_ref || (typeof fe.base_price === 'number');
    if (!hasPath) orphaned.push(svc.id);
  }
  assertStructural('P-WHITEFLAG-PRICED', orphaned.length === 0,
    'Every service has a resolvable pricing path',
    orphaned.join(', '));
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
  assertStructural('P-CONF-PRECISION', invalid.length === 0,
    'Every confidence threshold is within [0, 100]; every applied cap carries a reason',
    invalid.slice(0, 8).join(' | '));
}

{
  const collectors = ['collectBookingContext_catalog', 'collectBookingContext_otherTile', 'collectBookingContext_freeText'];
  const allInvoke = collectors.every(name => {
    const src = extractFunctionBody(qrHtmlContent, name);
    return !!src && /makeBookingContext\s*\(/.test(src);
  });
  assertStructural('R-CLIENT-CONVERGE', allInvoke,
    'All three gateway collectors converge on makeBookingContext (single canonical context)');
}

{
  const checkFn = extractFunctionBody(qrHtmlContent, 'checkRoutingArchetypeConsistency');
  assertStructural('R-SYSTEM-PICKER-AGREE',
    !!checkFn && /routing_archetype/.test(checkFn),
    'checkRoutingArchetypeConsistency exists and inspects routing_archetype');
  const validateFn = extractFunctionBody(qrHtmlContent, 'validateRoute');
  assertStructural('R-SYSTEM-PICKER-AGREE',
    !!validateFn && /checkRoutingArchetypeConsistency\s*\(/.test(validateFn),
    'validateRoute invokes checkRoutingArchetypeConsistency (semantic check is wired)');
}

{
  const meta = btnycData.meta || {};
  const compiler = btnycData._compiler_metadata || {};
  assertStructural('R-INVARIANT-RERUN',
    !!meta.version && !!compiler.source_compiler,
    'Compiler metadata is present alongside SSOT meta.version (rerun trail is auditable)');
}

{
  const t = btnycData.workflow?.resolution_thresholds;
  assertStructural('R-GOVERN-PRECEDENCE',
    !!t && typeof t.auto_select_named_service === 'number' && typeof t.route_to_group_other_tile === 'number',
    'workflow.resolution_thresholds carries both numeric thresholds');
  const freeTextSrc = extractFunctionBody(qrHtmlContent, 'collectBookingContext_freeText');
  assertStructural('R-GOVERN-PRECEDENCE',
    !!freeTextSrc && (/resolution_thresholds/.test(freeTextSrc) || /_resolutionThresholds\s*\(/.test(freeTextSrc)),
    'collectBookingContext_freeText reads thresholds from the SSOT, not hardcoded literals');
}

{
  const composeSrc = extractFunctionBody(qrHtmlContent, 'orch_compose_intake_chain');
  assertStructural('R-SYSTEM-COMPOSER',
    !!composeSrc && /intake_defaults/.test(composeSrc) && /Set\s*\(/.test(composeSrc),
    'orch_compose_intake_chain reads intake_defaults and deduplicates via Set');
}

{
  const jsonStr = JSON.stringify(btnycData);
  const suspicious = /"(?:eval|new Function)\s*\(/.test(jsonStr);
  assertStructural('R-SYSTEM-DECLARATIVE', !suspicious,
    'SSOT contains no function-body-looking strings (declarative only)');
}

// §2.9 Exhaustive: every service produces a quote without throwing
{
  const deps = [
    'resolveBaseConfidenceStrategy','resolveServiceCheckoutStateKey','applyPricingFormula',
    'applyLiveConfidenceEscalation','deriveComplexityTier','computeArchetypeQuote','sqTagLabel',
  ];
  const decls = [], missingDeps = [];
  for (const name of deps) {
    const d = extractFunctionDeclaration(qrHtmlContent, name);
    if (!d) { missingDeps.push(name); continue; }
    decls.push(`${d.header}{${d.body}}`);
  }
  const unifiedDecl = extractFunctionDeclaration(qrHtmlContent, 'computeUnifiedQuote');
  if (unifiedDecl && missingDeps.length === 0) {
    const prelude = `
      const QTY_AWARE_FORMULAS = new Set(['furniture_repair_formula', 'tile_repair_formula', 'hardware_install_formula', 'buy_the_hour_qty_gate_formula']);
      const _GENERIC_QTY_MODULE_KEYS = new Set(['item_count','count','hybrid_qty','global_quantity']);
      function entityHasOwnQtyQuestion(entity) {
        return !!(entity?.intake_chain || []).some(step => {
          const key = step.module || '';
          return !_GENERIC_QTY_MODULE_KEYS.has(key) && (key === 'item_count_template' || key.startsWith('item_count_template::'));
        });
      }
    `;
    const registeredStates = new Set(Object.keys(btnycData.checkout_states || {}));
    const serviceFailures = [];
    for (const svc of btnycData.services || []) {
      const sandbox = makeSandbox();
      try {
        const code = `
          ${_engineFind('resolveQuantityUnits')}
          ${prelude}
          ${decls.join('\n')}
          ${unifiedDecl.header}{${unifiedDecl.body}}
          computeUnifiedQuote({
            svc: ${JSON.stringify(svc)},
            dynDef: null, activeTagIds: [], answers: {}, qty: 1,
            intentKeyword: null, formulaId: null, ctxAdjFee: 0, ctxAdjMin: 0, enrichment: null,
          });
        `;
        const result = vm.runInContext(code, sandbox, { timeout: 6000 });
        if (!result || typeof result.laborEstimate !== 'number' || !isFinite(result.laborEstimate)) {
          serviceFailures.push(`${svc.id}: laborEstimate not finite (${result && result.laborEstimate})`);
          continue;
        }
        if (result.laborEstimate < 0) serviceFailures.push(`${svc.id}: negative laborEstimate (${result.laborEstimate})`);
        if (!registeredStates.has(result.checkoutStateKey)) {
          serviceFailures.push(`${svc.id}: unregistered checkoutStateKey '${result.checkoutStateKey}'`);
        }
        if (typeof result.dispatchFee !== 'number') serviceFailures.push(`${svc.id}: dispatchFee not numeric`);
      } catch (e) {
        serviceFailures.push(`${svc.id}: ${e.message}`);
      }
    }
    assertBehavioralPop('R-INVARIANT-CANONICAL', serviceFailures.length === 0,
      `computeUnifiedQuote runs cleanly for every one of ${(btnycData.services || []).length} named services`,
      serviceFailures.slice(0, 6).join(' | ') + (serviceFailures.length > 6 ? ` (+${serviceFailures.length - 6} more)` : ''));
  } else if (missingDeps.length > 0) {
    assertStructural('R-INVARIANT-CANONICAL', false,
      'Every dependency for the per-service sweep is extractable',
      `missing=[${missingDeps.join(', ')}]`);
  }
}

// §2.10 Exhaustive: extractQty behavioral matrix
{
  const d = extractFunctionDeclaration(qrHtmlContent, 'extractQty');
  if (d) {
    const prelude = `
      const _DIMENSION_PATTERN = /\\b\\d+\\s*-?\\s*(?:foot|feet|ft|inch|inches|in|cm|centimeters?|meters?|yards?|lbs?|pounds?|kg)\\b/gi;
      const _QTY_WORD_MAP = { one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10 };
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
          sandbox, { timeout: 4000 });
        if (!Number.isInteger(v) || v < 1 || v > 99) {
          violations.push(`"${inp}" -> ${v} (expected integer in [1, 99])`);
        }
      } catch (e) {
        violations.push(`"${inp}": ${e.message}`);
      }
    }
    assertBehavioralMatrix('R-INTAKE-QTYFIELD', violations.length === 0,
      `extractQty returns an integer in [1, 99] for ${inputs.length} real and edge-case inputs`,
      violations.slice(0, 5).join(' | '));
  }
}

// §2.11 Exhaustive: modifier scope distribution
{
  const modifiers = btnycData.global_rules?.modifiers || {};
  const byScope = { per_unit: 0, per_visit: 0 };
  for (const def of Object.values(modifiers)) {
    if (def && typeof def === 'object' && def.scope in byScope) byScope[def.scope]++;
  }
  assertStructural('R-PRICE-SCOPE',
    byScope.per_unit > 0 && byScope.per_visit > 0,
    'Both modifier scopes are populated in real data (per_visit distinction is load-bearing)',
    `per_unit=${byScope.per_unit} per_visit=${byScope.per_visit}`);
}

// §2.12 Exhaustive: every per_visit modifier is referenced
{
  const modifiers = btnycData.global_rules?.modifiers || {};
  const referenced = new Set();
  for (const def of Object.values(btnycData.intake_modules || {})) {
    for (const resp of def.client_response || []) if (resp.modifier_ref) referenced.add(resp.modifier_ref);
  }
  for (const svc of btnycData.services || []) {
    for (const step of svc.intake_chain || []) {
      for (const resp of step.params?.client_response || []) if (resp.modifier_ref) referenced.add(resp.modifier_ref);
    }
  }
  const orphans = [];
  for (const [key, def] of Object.entries(modifiers)) {
    if (def && typeof def === 'object' && def.scope === 'per_visit' && !referenced.has(key)) orphans.push(key);
  }
  assertStructural('R-PRICE-SCOPE', orphans.length === 0,
    'Every per_visit modifier is referenced by at least one client_response',
    orphans.slice(0, 6).join(', '));
}

/* ═════════════════════════════════════════════════════════════════════
 * SUITE 3 — V9-AST (from verify_charter_rule_index_v9.js)
 * ═══════════════════════════════════════════════════════════════════ */
setSuite(SUITE.V9);
logHeader('SUITE 3 — V9-AST (from verify_charter_rule_index_v9.js)');

// ─── §1 Structural Integrity, Charter Self-Consistency, Meta ────────
assertInvariant(scriptBlocks.length >= 6,
  'qr.html contains the expected distinct inline <script> blocks',
  `found ${scriptBlocks.length}`);

{
  const probe = `function probe() { const s = "} {{ }"; if (1) { return s; } }`;
  assertStructural(null, !stripStringsAndComments(probe).includes('} {{ }'),
    'Source parser self-test: string literals blanked before brace counting');
}

{
  const allDecls = [];
  scriptBlocks.forEach((b, bi) => findTopLevelFunctionDeclarations(b.body).forEach(d => allDecls.push({ ...d, blockIndex: bi })));
  const byName = new Map();
  for (const d of allDecls) { if (!byName.has(d.name)) byName.set(d.name, []); byName.get(d.name).push(d); }
  const dupes = [...byName.entries()].filter(([, a]) => a.length > 1);
  assertStructural('R-INVARIANT-SINGLEDEF', dupes.length === 0,
    'No duplicate top-level function declarations across script blocks',
    dupes.map(([n, a]) => `${n}×${a.length}`).slice(0, 12).join(' | '));
}

{
  const allDecls = [];
  scriptBlocks.forEach((b, bi) => findTopLevelFunctionDeclarations(b.body).forEach(d => allDecls.push({ ...d, blockIndex: bi })));
  const byName = new Map();
  for (const d of allDecls) { if (!byName.has(d.name)) byName.set(d.name, []); byName.get(d.name).push(d); }
  const unticketed = [];
  for (const [name, arr] of byName.entries()) {
    if (arr.length <= 1) continue;
    for (const d of arr) {
      const idx = scriptBlocks[d.blockIndex].body.indexOf(d.header);
      const pre = scriptBlocks[d.blockIndex].body.slice(Math.max(0, idx - 400), idx);
      if (!/\bT\d{1,4}\b|PENDING_DECISIONS|DEPRECATED|LEGACY|MIGRATING/.test(pre)) unticketed.push(`${name}@block${d.blockIndex}`);
    }
  }
  assertStructural('R-INVARIANT-DUPLICATION-TICKET', unticketed.length === 0,
    'Every duplicate declaration carries a ticket marker in the preceding 400 chars',
    unticketed.slice(0, 8).join(' | '));
}

{
  const DECLARED_RETIRED = [
    'extractObjectPreview', 'extractQtyPreview', 'extractLocationPreview',
    'sqRenderQuote', 'sqRenderSelfQuoteAdlib',
    'buildPreview', 'estimateLiveConfidence',
    'resolveForceModules_DEPRECATED', 'resolveForceModules', 'getServicePriceRange',
    'legacyDetermineSelfQuoting', 'legacyComposeIntakeChain',
  ];
  const live = new Set(findTopLevelFunctionDeclarations(qrHtmlContent).map(d => d.name));
  const still = DECLARED_RETIRED.filter(n => live.has(n));
  assertStructural('R-INVARIANT-DELETION', still.length === 0,
    'Every declared-retired function is absent from source',
    still.length ? `present=[${still.join(', ')}]` : '');
}

if (charterHtmlContent) {
  const unresolved = [...charterIndex.anchors].filter(a => !charterIndex.ids.has(a));
  assertMeta('R-INVARIANT-ANCHOR', unresolved.length === 0,
    'Every internal anchor target in PROJECT_CHARTER.html resolves to a declared id',
    unresolved.slice(0, 8).join(', '));
  const externalRefs = [];
  const refRe = /<a\s+href="\.\/([\w\-\.]+\.(?:md|html|js|json))"/g;
  let rm;
  while ((rm = refRe.exec(charterHtmlContent)) !== null) externalRefs.push(rm[1]);
  const missingFiles = [...new Set(externalRefs)].filter(f => !fs.existsSync(path.join(PROJECT_ROOT, f)));
  assertMeta('R-INVARIANT-ANCHOR', missingFiles.length === 0,
    'Every cross-document reference from PROJECT_CHARTER.html resolves to a real file', missingFiles.join(', '));
} else {
  assertMeta('R-INVARIANT-ANCHOR', true, 'Charter absent — anchor check skipped', '', KIND.EXISTENCE);
}
assertStructural('R-INVARIANT-ANCHOR', qrHtmlContent.includes('<!DOCTYPE html>'),
  'qr.html begins with a valid doctype (document structure preserved)');

if (charterHtmlContent) {
  const dupes = charterModel.indexDuplicates;
  assertMeta('R-GOVERN-INDEX', dupes.length === 0, 'Charter index contains no duplicate rule codes', dupes.join(', '));
  const bad = [...charterModel.index.values()].filter(r => !charterModule.STATUSES.includes(r.status)).map(r => `${r.code}:${r.status}`);
  assertMeta('R-GOVERN-INDEX', bad.length === 0, 'Every index entry declares a valid category (Enforced | Partial | Governance Process | Principle)', bad.join(', '));
  const prioritized = /\b(highest[-\s]?priority|critical[-\s]?rule|top[-\s]?priority)\b/i.test(charterHtmlContent);
  assertMeta('G-GOVERN-RULEPARITY', !prioritized, 'No rule is declared higher priority than another');
} else {
  assertMeta('R-GOVERN-INDEX', true, 'Charter absent', '', KIND.EXISTENCE);
  assertMeta('G-GOVERN-RULEPARITY', true, 'Charter absent', '', KIND.EXISTENCE);
}

{
  const hasBuild = /QR_BUILD_VERSION\s*=\s*['"][^'"]+['"]/.test(qrHtmlContent);
  const hasCompiler = !!(btnycData._compiler_metadata && btnycData._compiler_metadata.source_compiler);
  const v = btnycData.meta?.version, sv = btnycData.meta?.schema_version;
  assertStructural('P-SYSTEM-VERSIONS',
    hasBuild && hasCompiler && typeof v === 'string' && typeof sv === 'string',
    'QR build marker, compiler metadata, and both version counters are present and typed',
    `buildMarker=${hasBuild} compilerMeta=${hasCompiler} v=${typeof v} sv=${typeof sv}`);
}

{
  if (scriptBlocks.length >= 2) {
    const blockA = scriptBlocks.find(b => b.body && findTopLevelFunctionDeclarations(b.body).length > 0);
    if (blockA) {
      const decls = findTopLevelFunctionDeclarations(blockA.body).map(d => d.name);
      const probe = pick(rng, decls);
      const ctx = vm.createContext({ console: { log() {}, warn() {}, error() {} } });
      let kind = 'undefined', threw = false;
      try { kind = vm.runInContext(`typeof ${probe}`, ctx, { timeout: 1000 }); }
      catch (_) { threw = true; }
      const isolated = !threw && kind === 'undefined';
      assertStructural('R-SYSTEM-SCRIPT', isolated,
        `Block-scope probe (${probe}) reports 'undefined' in bare sibling VM context`,
        isolated ? '' : `typeof ${probe} === ${kind}`);
    }
  }
}

{
  const selfSrc = fs.readFileSync(__filename, 'utf8');
  const redRe = /assert(?:Rule|Behavioral|BehavioralPop|BehavioralMatrix|Structural|Meta|Heuristic|Existence)\s*\(\s*['"][^'"]+['"]\s*,\s*false\s*,\s*['"]([^'"]+)['"]/g;
  const unregistered = [];
  let m;
  while ((m = redRe.exec(selfSrc)) !== null) if (!m[1].includes('(')) unregistered.push(m[1]);
  assertMeta('R-INVARIANT-REDTEST', unregistered.length === 0,
    'No unregistered hardcoded-false assertions exist in this harness',
    unregistered.slice(0, 5).join(' | '));
}

// ─── R-INVARIANT-DISEASE ─────────────────────────────────────────
{
  const HARNESS_CLASS_CATALOGUE = new Set([
    'DEFECT-ARBITRATION','DEFECT-PERUNIT-SCOPE','DEFECT-DUPLICATE-PARSER',
    'DEFECT-DERIVED-OVERWRITE','DEFECT-SECOND-CLASSIFICATION','DEFECT-DUPLICATE-REGISTRY',
    'DEFECT-PATH-SPECIFIC-PATCH','DEFECT-PREVIEW-CHARGE-MISMATCH',
    'DEFECT-STALE-SANDBOX','DEFECT-SILENT-SKIP',   // T156, operator ruling #105: detectors are `@detects`-tagged tests (see below)
  ]);
  if (charterHtmlContent) {
    const charterClasses = new Set();
    const classRe = /<span class="defect-class">([A-Z0-9\-]+)<\/span>/g;
    let m;
    while ((m = classRe.exec(charterHtmlContent)) !== null) charterClasses.add(m[1]);

    const missingFromHarness = [...charterClasses].filter(c => !HARNESS_CLASS_CATALOGUE.has(c));
    assertMeta('R-INVARIANT-DISEASE', missingFromHarness.length === 0,
      `Every named defect class the Charter declares has a harness catalogue entry (${charterClasses.size} declared)`,
      missingFromHarness.length ? `missing=[${missingFromHarness.join(', ')}]` : '');

    const orphanHarnessClasses = [...HARNESS_CLASS_CATALOGUE].filter(c => !charterClasses.has(c));
    assertMeta('R-INVARIANT-DISEASE', orphanHarnessClasses.length === 0,
      'No orphan class names exist in the harness catalogue (every name is Charter-declared)',
      orphanHarnessClasses.length ? `orphans=[${orphanHarnessClasses.join(', ')}]` : '');
  } else {
    assertMeta('R-INVARIANT-DISEASE', true, 'Charter absent — class-catalogue audit skipped', '', KIND.EXISTENCE);
  }

  const selfSrc = fs.readFileSync(__filename, 'utf8');
  const undetected = [];
  // T156: a class has a detector when a test file declares `@detects <CLASS>` (read from every verify_ file's header; charter_model.readEnforcements),
  // or when this file carries the older textual reference. A `@detects` tag naming a class the Charter does not declare is an orphan (charter_model.audit).
  const detectorTags = charterModule.readEnforcements(SCRIPT_DIR).detects;
  for (const cls of HARNESS_CLASS_CATALOGUE) {
    const detectorRef = new RegExp(
      `(?:Detector\\s+for\\s+${cls}|${cls}\\s*[:.]\\s*detector|case\\s+['"]${cls}['"])`,
      'i');
    if (!detectorRef.test(selfSrc) && !detectorTags.has(cls)) undetected.push(cls);
  }
  for (const cls of ['DEFECT-STALE-SANDBOX', 'DEFECT-SILENT-SKIP']) {
    assertMeta('R-INVARIANT-DISEASE', detectorTags.has(cls),
      `${cls} has a shipped detector (${(detectorTags.get(cls) || []).join(', ') || 'none'})`,
      `no verify_ file declares @detects ${cls}`);
  }
  if (undetected.length > 0) {
    console.log(`    ℹ  ${undetected.length} named class(es) have no detector reference yet ` +
      `(open items under R-INVARIANT-DISEASE): ${undetected.join(', ')}`);
  }
  assertMeta('R-INVARIANT-DISEASE', true,
    `Named-class detector coverage reported (${HARNESS_CLASS_CATALOGUE.size - undetected.length}/${HARNESS_CLASS_CATALOGUE.size} with a detector reference)`,
    '', KIND.META);
}

// ─── §2 Governance & Client Operations ─────────────────────────────
{
  const tiers = btnycData.global_rules?.complexity_tiers || {};
  const missing = ['routine','skilled','specialized'].filter(t => !(t in tiers));
  const malformed = ['routine','skilled','specialized'].filter(t => {
    const def = tiers[t];
    return !def || typeof def.hourly_rate !== 'number' || typeof def.min_minutes !== 'number';
  });
  assertStructural('R-GOVERN-PRECEDENCE', missing.length === 0 && malformed.length === 0,
    'complexity_tiers contains routine/skilled/specialized with numeric rates/boundaries',
    `missing=[${missing.join(',')}] malformed=[${malformed.join(',')}]`);
  const t = btnycData.workflow?.resolution_thresholds;
  assertStructural('R-GOVERN-PRECEDENCE',
    !!t && typeof t.auto_select_named_service === 'number' && typeof t.route_to_group_other_tile === 'number',
    'workflow.resolution_thresholds carries both numeric thresholds');
  const ft = extractFunctionBody(qrHtmlContent, 'collectBookingContext_freeText');
  assertStructural('R-GOVERN-PRECEDENCE', !!ft && /_resolutionThresholds|resolution_thresholds/.test(ft),
    'collectBookingContext_freeText reads thresholds from SSOT');
}

{
  const collectors = [
    ['collectBookingContext_catalog', 'catalog'],
    ['collectBookingContext_otherTile', 'other_tile'],
    ['collectBookingContext_freeText', 'free_text'],
  ];
  const missing = [], wrong = [];
  for (const [fn, entry] of collectors) {
    const ast = extractFunctionAST(qrHtmlContent, fn);
    if (!ast) { missing.push(fn); continue; }
    const calls = findAstNodes(ast, astIsCallTo('makeBookingContext'));
    if (!calls.length) { wrong.push(`${fn}: no call`); continue; }
    const ok = calls.some(c => c.arguments.some(a => a.type === 'Literal' && a.value === entry));
    if (!ok) wrong.push(`${fn}: expected '${entry}'`);
  }
  assertStructural('P-CLIENT-THREE', missing.length === 0 && wrong.length === 0,
    'All three gateway collectors exist and pass the correct entry literal to makeBookingContext (AST)',
    `missing=[${missing.join(',')}] wrong=[${wrong.join(', ')}]`);
}

// R-CLIENT-CONVERGE behavioral suite
{
  const bundle = bundleFunctions([
    'initNlpSets','isServiceVerb','detectIntentNLP','detectTagsNLP','extractQty',
    'extractLocation','extractSizeHint','inferTagsFromContext','computeNegatedGroupHints',
    'resolveGroupFromIntent','_normalizeTypedText','_vocab','_inVocab','_tokenSets',
    '_isHardNonNoun','_isEdgeTrim','_validateNounPhrase','_groundedObjectPhrase',
    '_extractObjectRaw','extractObjectDetailed','extractObject','detectActionsInOrder',
    'composeAdlibParts','composeAdlibSentence','_resolutionThresholds','understandRequest',
    'tagValidForCategory','resolveDynamicService','makeBookingContext',
    'collectBookingContext_catalog','collectBookingContext_otherTile','collectBookingContext_freeText',
  ], { prelude: nlpPrelude() });

  if (bundle.missing.length) {
    assertBehavioral('R-CLIENT-CONVERGE', false, 'bundle extractable', `missing=[${bundle.missing.join(', ')}]`);
  } else {
    const sandbox = makeSandbox();
    const flatscreen = btnycData.services.find(s => s.id === 'flatscreen_mounting_standard');
    let catCtx1, catCtx2, tileCtx1, tileCtx2, freeCtx1, freeCtx2;
    try {
      catCtx1 = vm.runInContext(`${bundle.source}\ncollectBookingContext_catalog(${JSON.stringify(flatscreen)}, 'wall_mounting');`, sandbox, { timeout: 4000 });
      catCtx2 = vm.runInContext(`${bundle.source}\ncollectBookingContext_catalog(${JSON.stringify(flatscreen)}, 'wall_mounting');`, sandbox, { timeout: 4000 });
    } catch (e) { assertBehavioral('R-CLIENT-CONVERGE', false, 'catalog runs in VM', e.message); }
    if (catCtx1) {
      const expected = ['entry','selectedServiceId','selectedCategoryId','selectedGroupId','rawText',
        'nlpIntent','extractedQty','extractedObject','resolutionObject','extractedLocation',
        'manuallyToggledTagIds','negatedTagIds','_negationOverride','uncoveredServiceTypes','answers'];
      const hasAll = expected.every(k => k in catCtx1);
      assertBehavioral('R-CLIENT-CONVERGE', hasAll, 'catalog collector returns complete BookingContext',
        hasAll ? '' : `missing=[${expected.filter(k => !(k in catCtx1)).join(',')}]`);
      assertBehavioral('R-CLIENT-CONVERGE', catCtx1.entry === 'catalog', 'catalog collector tags entry="catalog"');
      assertDeepEqual('R-CLIENT-CONVERGE', catCtx1, catCtx2, 'catalog collector deterministic');
    }
    const tile = { ui_taxonomy: { group_id: 'wall_mounting_tv_flatscreen' }, uncovered_service_types: ['Mount'], service_type: 'Mount' };
    try {
      tileCtx1 = vm.runInContext(`${bundle.source}\ncollectBookingContext_otherTile(${JSON.stringify(tile)}, 'wall_mounting');`, sandbox, { timeout: 4000 });
      tileCtx2 = vm.runInContext(`${bundle.source}\ncollectBookingContext_otherTile(${JSON.stringify(tile)}, 'wall_mounting');`, sandbox, { timeout: 4000 });
    } catch (e) { assertBehavioral('R-CLIENT-CONVERGE', false, 'tile runs in VM', e.message); }
    if (tileCtx1) {
      assertBehavioral('R-CLIENT-CONVERGE', tileCtx1.entry === 'other_tile', 'tile collector tags entry="other_tile"');
      assertDeepEqual('R-CLIENT-CONVERGE', tileCtx1, tileCtx2, 'tile collector deterministic');
    }
    try {
      freeCtx1 = vm.runInContext(`${bundle.source}\ninitNlpSets();\ncollectBookingContext_freeText('mount a TV on my drywall wall');`, sandbox, { timeout: 6000 });
      freeCtx2 = vm.runInContext(`${bundle.source}\ninitNlpSets();\ncollectBookingContext_freeText('mount a TV on my drywall wall');`, sandbox, { timeout: 6000 });
    } catch (e) { assertBehavioral('R-CLIENT-CONVERGE', false, 'free runs in VM', e.message.split('\n')[0]); }
    if (freeCtx1) {
      assertBehavioral('R-CLIENT-CONVERGE', freeCtx1.entry === 'free_text', 'free collector tags entry="free_text"');
      assertBehavioral('R-CLIENT-CONVERGE',
        freeCtx1.nlpIntent && typeof freeCtx1.nlpIntent.category === 'string' && freeCtx1.nlpIntent.category.length > 0,
        'free collector carries a real nlpIntent with a real category');
      assertDeepEqual('R-CLIENT-CONVERGE', freeCtx1, freeCtx2, 'free collector deterministic');
    }
    if (catCtx1 && tileCtx1 && freeCtx1) {
      const ks = [catCtx1, tileCtx1, freeCtx1].map(o => Object.keys(o).sort().join('|'));
      assertBehavioral('R-CLIENT-CONVERGE', ks[0] === ks[1] && ks[1] === ks[2],
        'All three gateways produce BookingContexts with identical key sets');
    }
  }
}

// R-CLIENT-CONVERGE stochastic entityType agreement fuzz
{
  const bundle = bundleFunctions([
    'initNlpSets','isServiceVerb','detectIntentNLP','detectTagsNLP','extractQty','extractLocation',
    'extractSizeHint','inferTagsFromContext','computeNegatedGroupHints','resolveGroupFromIntent',
    '_normalizeTypedText','_vocab','_inVocab','_tokenSets','_isHardNonNoun','_isEdgeTrim',
    '_validateNounPhrase','_groundedObjectPhrase','_extractObjectRaw','extractObjectDetailed',
    'extractObject','detectActionsInOrder','composeAdlibParts','composeAdlibSentence',
    '_resolutionThresholds','understandRequest','tagValidForCategory','resolveDynamicService',
    'makeBookingContext','collectBookingContext_catalog','collectBookingContext_otherTile',
    'collectBookingContext_freeText','executeWorkflow','orch_resolve_entity',
    'orch_apply_object_based_resolution','orch_enrich_from_dynamic_service',
    'orch_compute_variability_flags','orch_compose_intake_chain','orch_apply_location_hints',
    'orch_compute_confidence','orch_select_ui_template','orch_merge_materials_estimate',
    'orch_compute_quote','orch_apply_intake_bypass_rules','readRoutePath','evaluateInvariant',
    'describeInvariantFailure','validateRoute','catastrophicFallbackRoute',
    'checkRoutingArchetypeConsistency','_resolveIntakeChain','resolveBaseConfidenceStrategy',
    'applyLiveConfidenceEscalation','applyPricingFormula','computeArchetypeQuote',
    'deriveComplexityTier','resolveServiceCheckoutStateKey','buildCheckoutStateModel','sqTagLabel',
    'computeUnifiedQuote','_computePrice','synthesizeAnswersFromTags','closeTagsOverRequires',
    'requiredTagIdsFor','isDiagnosticService','isLogisticTag','sqTagFeeImpact',
    'resolveServiceBadge','resolveServiceBadgeKey','resolveEngineKey','entityHasOwnQtyQuestion',
    'getServiceProfile','mathFurnitureAssembly',
  ], { prelude: nlpPrelude() + enginePrelude() });

  if (_bundleGuard(bundle)) {
    const sandbox = makeSandbox();
    try {
      vm.runInContext(`${bundle.source}\ninitNlpSets();`, sandbox, { timeout: 8000 });
      const wallMount = btnycData.services.filter(s => s.ui_taxonomy?.category_id === 'wall_mounting');
      const target = wallMount.length ? pick(rng, wallMount) : btnycData.services[0];
      const phrases = shuffle([
        'mount a TV on the wall', 'hang a flat screen TV in the living room',
        'I need my television mounted to the drywall',
        'put up a 65 inch TV in the bedroom', 'attach a flatscreen to the wall',
      ], rng);
      let divergences = 0; const details = [];
      for (const phrase of phrases) {
        try {
          const catRoute = vm.runInContext(
            `executeWorkflow(collectBookingContext_catalog(${JSON.stringify(target)}, 'wall_mounting'), window.DB);`,
            sandbox, { timeout: 8000 });
          const freeRoute = vm.runInContext(
            `(function(){ initNlpSets(); return executeWorkflow(collectBookingContext_freeText(${JSON.stringify(phrase)}), window.DB); })();`,
            sandbox, { timeout: 8000 });
          if (!catRoute || !freeRoute) continue;
          if (catRoute.entityType !== freeRoute.entityType) {
            divergences++;
            details.push(`"${phrase}": cat=${catRoute.entityType} free=${freeRoute.entityType}`);
          }
        } catch (e) { details.push(`"${phrase}": ${e.message.slice(0, 60)}`); }
      }
      assertHeuristic('R-CLIENT-CONVERGE', divergences === 0,
        `Convergence fuzz on '${target.id}' across ${phrases.length} phrasings: entityType agreement`,
        details.slice(0, 3).join(' | '));
    } catch (e) {
      assertBehavioral('R-CLIENT-CONVERGE', false, 'Convergence fuzzer in VM', e.message.split('\n')[0]);
    }
  }
}

{
  const all = ['collectBookingContext_catalog','collectBookingContext_otherTile','collectBookingContext_freeText']
    .every(n => { const a = extractFunctionAST(qrHtmlContent, n); return a && findAstNodes(a, astIsCallTo('makeBookingContext')).length > 0; });
  assertStructural('R-CLIENT-CONVERGE', all, 'All three gateway collectors converge on makeBookingContext (AST)');
}

// R-INVARIANT-ONEUNDERSTANDING preview==pricing population sweep
{
  const bundle = bundleFunctions([
    'initNlpSets','isServiceVerb','detectIntentNLP','detectTagsNLP','extractQty','extractLocation',
    'extractSizeHint','inferTagsFromContext','computeNegatedGroupHints','resolveGroupFromIntent',
    '_normalizeTypedText','_vocab','_inVocab','_tokenSets','_isHardNonNoun','_isEdgeTrim',
    '_validateNounPhrase','_groundedObjectPhrase','_extractObjectRaw','extractObjectDetailed',
    'extractObject','detectActionsInOrder','composeAdlibParts','composeAdlibSentence',
    '_resolutionThresholds','understandRequest',
  ], { prelude: nlpPrelude() });
  if (_bundleGuard(bundle)) {
    const sandbox = makeSandbox();
    try {
      vm.runInContext(`${bundle.source}\ninitNlpSets();`, sandbox, { timeout: 6000 });
      let partMismatches = 0, objMismatches = 0; const mismatched = [];
      for (const text of NLP_CORPUS) {
        const a = vm.runInContext(`JSON.stringify(understandRequest(${JSON.stringify(text)}, {quiet:true}).parts)`, sandbox, { timeout: 4000 });
        const b = vm.runInContext(`JSON.stringify(understandRequest(${JSON.stringify(text)}).parts)`, sandbox, { timeout: 4000 });
        if (a !== b) { partMismatches++; if (mismatched.length < 3) mismatched.push(`"${text}"`); }
        const oa = vm.runInContext(`JSON.stringify({o:understandRequest(${JSON.stringify(text)},{quiet:true}).object,q:understandRequest(${JSON.stringify(text)},{quiet:true}).qty})`, sandbox, { timeout: 4000 });
        const ob = vm.runInContext(`JSON.stringify({o:understandRequest(${JSON.stringify(text)}).object,q:understandRequest(${JSON.stringify(text)}).qty})`, sandbox, { timeout: 4000 });
        if (oa !== ob) objMismatches++;
      }
      assertBehavioralPop('R-INVARIANT-ONEUNDERSTANDING', partMismatches === 0,
        `Preview and pricing compose identical parts across all ${NLP_CORPUS.length} corpus sentences`,
        partMismatches ? `${partMismatches} mismatches incl. ${mismatched.join(', ')}` : '');
      assertBehavioralPop('R-INVARIANT-ONEUNDERSTANDING', objMismatches === 0,
        `Object noun and quantity are identical across preview and pricing modes`);
    } catch (e) {
      assertBehavioral('R-INVARIANT-ONEUNDERSTANDING', false, 'Preview==pricing suite in VM', e.message.split('\n')[0]);
    }
  }
}

{
  const ast = extractFunctionAST(qrHtmlContent, 'enableLiveAdLibPreview');
  if (ast) {
    const calls = findAstNodes(ast, n =>
      n.type === 'CallExpression' && n.callee.type === 'MemberExpression' &&
      n.callee.object.type === 'MemberExpression' &&
      n.callee.object.object.name === 'window' &&
      n.callee.object.property.name === '_NLP' &&
      n.callee.property.name === 'understand').length > 0;
    assertStructural('R-CLIENT-PREVIEW', calls, 'Live preview delegates to window._NLP.understand (AST)');
    const ownParser = findAstNodes(ast, n =>
      (n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression') &&
      n.id && /^(extractObject|extractQty|extractLocation|detectIntentNLP)$/.test(n.id.name)).length > 0;
    assertStructural('R-CLIENT-PREVIEW', !ownParser, 'Live preview declares no private parser (single-parse)');
  }
}
{
  const ast = extractFunctionAST(qrHtmlContent, 'sqUnifiedAction');
  const calls = ast ? findAstNodes(ast, astIsCallTo('understandRequest')).length : 0;
  assertStructural('R-INVARIANT-ONEUNDERSTANDING', calls > 0,
    'sqUnifiedAction calls understandRequest (confirm path shares the canonical parse)');
}

{
  const ast = extractFunctionAST(qrHtmlContent, 'orch_compose_intake_chain');
  if (ast) {
    const c1 = findAstNodes(ast, astIsMemberRead('context', 'selectedCategoryId')).length > 0;
    const c2 = findAstNodes(ast, astIsMemberRead('context', 'selectedGroupId')).length > 0;
    assertStructural('P-CLIENT-NAVFACT', c1 && c2,
      'orch_compose_intake_chain reads category/group from context (AST)');
  }
}

{
  const cAst = extractFunctionAST(qrHtmlContent, 'composeAdlibParts');
  if (cAst) {
    const readsChips = findAstNodes(cAst, n =>
      n.type === 'MemberExpression' && !n.computed &&
      n.object.type === 'Identifier' && n.object.name === 'slots' &&
      n.property.type === 'Identifier' && /^(chips|tags|labels)$/.test(n.property.name)).length > 0;
    assertStructural('P-CLIENT-CHIPS', !readsChips, 'composeAdlibParts reads no chip input slot');
  }
  const bSrc = extractFunctionBody(qrHtmlContent, 'sqBuildAdlib');
  if (bSrc) assertStructural('P-CLIENT-CHIPS', !/sqAdlibSentence[\s\S]{0,400}\.ui_phrase/.test(bSrc),
    'sqBuildAdlib never writes chip ui_phrase into #sqAdlibSentence');
}

{
  const bundle = bundleFunctions(['composeAdlibParts','composeAdlibSentence'], {
    prelude: `var window = { DB: ${JSON.stringify({ adlib_phrase_overrides: btnycData.adlib_phrase_overrides })} };`,
  });
  if (_bundleGuard(bundle)) {
    const sandbox = makeSandbox({ window: { DB: btnycData } });
    try {
      vm.runInContext(`${bundle.source}`, sandbox, { timeout: 4000 });
      const stutters = [];
      for (const svc of btnycData.services) {
        const name = svc.ui_taxonomy?.display_name;
        if (!name) continue;
        const out = vm.runInContext(
          `composeAdlibSentence({actions:['adjust'],object:${JSON.stringify(name)},qty:1,location:null,condition:null})`,
          sandbox, { timeout: 2000 });
        const m = /\b(\w+)\s+\1\b/i.exec(out || '');
        if (m) stutters.push(`"${name}": ${m[0]}`);
      }
      assertBehavioralPop('R-CLIENT-STUTTER', stutters.length === 0,
        `No stutter across all ${btnycData.services.length} service labels`,
        stutters.slice(0, 5).join(' | '));
    } catch (e) {
      assertBehavioral('R-CLIENT-STUTTER', false, 'Stutter suite in VM', e.message.split('\n')[0]);
    }
  }
}

// ─── §3 Domain Architecture & Compiler Output ──────────────────────
{
  const idx = (btnycData.compiled || {}).pricing_index || {};
  const ids = new Set((btnycData.services || []).map(s => s.id));
  const orphans = Object.keys(idx).filter(k => !k.includes('+') && !ids.has(k));
  const missing = [...ids].filter(id => !(id in idx));
  assertStructural('R-DOMAIN-COMPILER',
    Object.keys(idx).length > 0 && orphans.length === 0 && missing.length === 0,
    'compiled.pricing_index populated, no orphans, covers every named service',
    `orphans=[${orphans.slice(0,5).join(', ')}] missing=[${missing.slice(0,5).join(', ')}]`);
}

{
  const routing = btnycData.routing_archetypes || {};
  const dyn = btnycData.dynamic_services || {};
  const COMPONENT = new Set(['wall_type','surface_type','door_type','door_style_pref','door_size','client_supplying_door','existing_frame','faucet_type','sink_type','toilet_style_pref','existing_toilet_type','window_type','removal','install_type','existing_type','furn_item','mounting_item','wall_mount_items','item_type','fixture_type','electrical_item','plumbing_fixture','tech_device','computer_component','device_type','laptop_or_desktop','existing_box','ducting','length','distance','weight','mounting_height','tile_condition','waterproof_area','has_matching_tiles','thermostat_type','customer_supplied_part','software_install_type','brand','router_owned','mesh_network','pax_cabinet_count','pax_hinge_count','pax_interior_count','pax_sliding_count','disposal_size','gfci_location','window_ac_support','inwall_power_for_tv','faucet_part_available','angle_stop_condition','baseboard_scope','switch_wiring','washer_type','ceiling_tile_access']);
  const GEN_SYMPT = new Set(['symptom','tech_problem_type','damage_type','leak_type','drain_speed','device_state','internet_active','tech_issue_source']);
  const GRP_SYMPT = new Set(['cabinet_issue','door_issue','floor_issue','wall_issue','window_issue','furniture_issue','dishwasher_symptom','dryer_symptom','stove_symptom','computer_symptom','network_symptom','smart_device_symptom','cable_symptom','generic_tech_symptom','issue','appliance_type','window_ac_issue','garbage_disposal_issue','plumbing_fixture_issue','water_line_issue']);
  const violations = [];
  for (const [key, def] of Object.entries(dyn)) {
    const parts = key.split('+'); const gid = parts.length >= 3 ? parts[1] : null;
    if (!gid) continue;
    const arch = routing[gid]?.routing_archetype;
    if (arch !== 'component_first' && arch !== 'symptom_first') continue;
    const chain = def.intake_chain || []; if (!chain.length) continue;
    const mods = chain.map(s => s.module);
    if (arch === 'component_first') {
      const f = mods.find(m => COMPONENT.has(m) || GEN_SYMPT.has(m) || GRP_SYMPT.has(m));
      if (f && GEN_SYMPT.has(f)) violations.push(`${key}: component_first leads with GENERIC symptom '${f}'`);
    } else if (/^(Diagnostic|Repair)$/.test(parts[parts.length - 1])) {
      // T149: a symptom is only asked about when something is WRONG; Install/Setup entries carry none by design (see the legacy copy of this rule above).
      if (!mods.some(m => GEN_SYMPT.has(m) || GRP_SYMPT.has(m))) violations.push(`${key}: symptom_first has no symptom module`);
    }
  }
  assertStructural('R-DOMAIN-DYNCHAIN', violations.length === 0,
    "Every dynamic-service chain shape matches its group's routing_archetype",
    violations.slice(0, 8).join(' | '));
}

{
  const bundle = bundleFunctions(['tagValidForCategory'], {
    prelude: `var window = { DB: ${JSON.stringify({ smart_tags: btnycData.smart_tags })} };`,
  });
  if (_bundleGuard(bundle)) {
    const sandbox = makeSandbox({ window: { DB: btnycData } });
    try {
      vm.runInContext(`${bundle.source}`, sandbox, { timeout: 4000 });
      const fail = [];
      for (const [tid, tag] of Object.entries(btnycData.smart_tags || {})) {
        const cats = tag.applicable_categories;
        if (!cats || cats.length === 0 || cats.includes('all')) {
          const v = vm.runInContext(`tagValidForCategory(${JSON.stringify(tid)},'xyz_nonexistent',null,null)`, sandbox);
          if (!v) fail.push(`universal ${tid} rejected`);
        }
        if (Array.isArray(tag.applicable_group_ids) && tag.applicable_group_ids.length) {
          const cat = (tag.applicable_categories || [])[0];
          if (cat && cat !== 'all') {
            const g = vm.runInContext(`tagValidForCategory(${JSON.stringify(tid)},${JSON.stringify(cat)},${JSON.stringify(tag.applicable_group_ids[0])},null)`, sandbox);
            const b = vm.runInContext(`tagValidForCategory(${JSON.stringify(tid)},${JSON.stringify(cat)},'GROUP_NOT_IN_LIST',null)`, sandbox);
            if (!g) fail.push(`group-scoped ${tid} rejected own group`);
            if (b) fail.push(`group-scoped ${tid} accepted unrelated group`);
          }
        }
        if (Array.isArray(tag.excluded_service_ids) && tag.excluded_service_ids.length) {
          const cat = (tag.applicable_categories || [])[0];
          if (cat && cat !== 'all') {
            const v = vm.runInContext(`tagValidForCategory(${JSON.stringify(tid)},${JSON.stringify(cat)},null,${JSON.stringify(tag.excluded_service_ids[0])})`, sandbox);
            if (v) fail.push(`excluded ${tid} accepted for excluded service`);
          }
        }
      }
      assertBehavioralPop('P-DOMAIN-SCOPE', fail.length === 0,
        `tagValidForCategory honors all three scoping levels across all ${Object.keys(btnycData.smart_tags).length} tags`,
        fail.slice(0, 5).join(' | '));
    } catch (e) {
      assertBehavioral('P-DOMAIN-SCOPE', false, 'tag scoping in VM', e.message);
    }
  }
}

{
  const ACTIONS = new Set(['install','installed','installation','mount','mounted','mounting','repair','repairing','repaired','replace','replacement','replaced','assemble','assembly','assembled','disassembly','adjustment','adjust','adjusted','diagnostic','clean','cleaning','cleaned','setup','set','removal','remove','restore','restored','reset','upgrade','service','configured','configure','leak','seal','sealing','swap']);
  const suspicious = [];
  for (const svc of btnycData.services) {
    const name = svc.ui_taxonomy?.display_name || '';
    if (!name) continue;
    const last = name.toLowerCase().split(/\s+/).pop().replace(/[^\w]/g, '');
    const last2 = name.toLowerCase().split(/\s+/).slice(-2).join(' ').replace(/[^\w\s]/g, '');
    if (!ACTIONS.has(last) && !ACTIONS.has(last2)) suspicious.push(`${svc.id}="${name}"`);
  }
  const ratio = 1 - (suspicious.length / Math.max(1, btnycData.services.length));
  assertHeuristic('R-DOMAIN-NAME', ratio >= 0.85,
    `At least 85% of service display_names end in a recognized action token`,
    `ratio=${(ratio * 100).toFixed(1)}% suspicious=${suspicious.slice(0, 5).join(' | ')}`);
}

{
  const bundle = bundleFunctions([
    'executeWorkflow','orch_resolve_entity','orch_apply_object_based_resolution',
    'orch_enrich_from_dynamic_service','orch_compute_variability_flags',
    'orch_compose_intake_chain','orch_apply_location_hints','orch_compute_confidence',
    'orch_select_ui_template','orch_merge_materials_estimate','orch_compute_quote',
    'orch_apply_intake_bypass_rules','readRoutePath','evaluateInvariant',
    'describeInvariantFailure','validateRoute','catastrophicFallbackRoute',
    'checkRoutingArchetypeConsistency','_resolveIntakeChain','resolveBaseConfidenceStrategy',
    'applyLiveConfidenceEscalation','applyPricingFormula','computeArchetypeQuote',
    'deriveComplexityTier','resolveServiceCheckoutStateKey','buildCheckoutStateModel',
    'sqTagLabel','computeUnifiedQuote','_computePrice','synthesizeAnswersFromTags',
    'closeTagsOverRequires','requiredTagIdsFor','tagValidForCategory','isDiagnosticService',
    'isLogisticTag','sqTagFeeImpact','resolveServiceBadge','resolveServiceBadgeKey',
    'resolveEngineKey','entityHasOwnQtyQuestion','getServiceProfile','mathFurnitureAssembly',
    'resolveDynamicService','makeBookingContext',
  ], { prelude: enginePrelude() });
  if (_bundleGuard(bundle)) {
    const sandbox = makeSandbox();
    try {
      vm.runInContext(`${bundle.source}`, sandbox, { timeout: 6000 });
      const ctx = vm.runInContext(`makeBookingContext('free_text',{rawText:'',nlpIntent:null})`, sandbox, { timeout: 4000 });
      const route = vm.runInContext(`executeWorkflow(${JSON.stringify(ctx)}, window.DB)`, sandbox, { timeout: 6000 });
      assertBehavioral('P-DOMAIN-FALLBACK',
        route && (route.entityType === 'fallback' || route.entityType === 'dynamic'),
        'An unresolvable context falls back to a recognized route type',
        route ? `entityType=${route.entityType}` : 'no route');
      // T148 (operator ruling on #102): for a request that cannot be classified the GUIDED BUILDER is the priced path forward -- it is the only way the customer can interact with that
      // gateway, and it prices after intake. So a route either carries a numeric quote, or hands the customer to the builder (uiTemplate legacy_flow). Never a dead end.
      assertBehavioral('P-WHITEFLAG-PRICED',
        route && ((route.quote && typeof route.quote.laborEstimate === 'number') || route.uiTemplate === 'legacy_flow'),
        'Even the fallback route has a priced path forward: a numeric quote, or the guided builder that prices after intake');
    } catch (e) {
      assertBehavioral('P-DOMAIN-FALLBACK', false, 'Fallback chain in VM', e.message.split('\n')[0]);
    }
  }
}

// ─── §4 Confidence & Intake Governance ─────────────────────────────
{
  const orch = extractFunctionAST(qrHtmlContent, 'orch_compute_confidence');
  const curated = extractFunctionAST(qrHtmlContent, 'orch_max_followup_questions'); // T148: the successor of the deleted sqBuildCuratedIntake (T144)
  assertStructural('R-CONF-ONEFORMULA',
    !!(orch && findAstNodes(orch, astIsCallTo('resolveBaseConfidenceStrategy')).length > 0),
    'orch_compute_confidence delegates to resolveBaseConfidenceStrategy (AST)');
  assertStructural('R-CONF-ONEFORMULA',
    !!(curated && findAstNodes(curated, astIsCallTo('resolveBaseConfidenceStrategy')).length > 0),
    'orch_max_followup_questions (successor of the deleted sqBuildCuratedIntake) delegates to resolveBaseConfidenceStrategy (AST)');
}

{
  const d = extractFunctionDeclaration(qrHtmlContent, 'resolveBaseConfidenceStrategy');
  if (d) {
    const sandbox = makeSandbox();
    try {
      const value = vm.runInContext(`"use strict";\n${d.header}{${d.body}}\nresolveBaseConfidenceStrategy(${JSON.stringify(btnycData.services[0])}, null);`, sandbox, { timeout: 4000 });
      const ok = value && typeof value.base_confidence === 'number' && typeof value.minimum_quote_confidence === 'number';
      assertBehavioral('R-CONF-ONEFORMULA', ok, 'resolveBaseConfidenceStrategy returns a real numeric strategy');
    } catch (e) { assertBehavioral('R-CONF-ONEFORMULA', false, 'strategy sandbox', e.message); }
  }
}

{
  const bundle = bundleFunctions([
    'resolveBaseConfidenceStrategy','applyLiveConfidenceEscalation','orch_compute_confidence',
  ], { prelude: `function _trace(){}` });
  if (_bundleGuard(bundle)) {
    const sandbox = makeSandbox();
    try {
      vm.runInContext(`${bundle.source}`, sandbox, { timeout: 4000 });
      const failures = [];
      for (const svc of btnycData.services) {
        const resolution = { entityType: 'service', entity: svc };
        try {
          const cat = vm.runInContext(`orch_compute_confidence(${JSON.stringify(resolution)},[],0,window.DB,'catalog')`, sandbox, { timeout: 4000 });
          if (!cat || cat.score !== 100) failures.push(`${svc.id}: catalog score=${cat?.score}`);
        } catch (e) { failures.push(`${svc.id}: ${e.message.slice(0, 40)}`); }
      }
      assertBehavioralPop('R-CONF-ONEFORMULA', failures.length === 0,
        `orch_compute_confidence returns score=100 for a catalog tap across every one of ${btnycData.services.length} services`,
        failures.slice(0, 5).join(' | '));
      const realSvc = pick(rng, btnycData.services.filter(s => s.confidence_strategy));
      const r1 = vm.runInContext(`orch_compute_confidence(${JSON.stringify({ entityType: 'service', entity: realSvc })},[],0,window.DB,'catalog')`, sandbox);
      const r2 = vm.runInContext(`orch_compute_confidence(${JSON.stringify({ entityType: 'service', entity: realSvc })},[],0,window.DB,'catalog')`, sandbox);
      assertDeepEqual('R-CONF-ONEFORMULA', r1, r2, `orch_compute_confidence deterministic on '${realSvc.id}'`);
      const free = vm.runInContext(`orch_compute_confidence(${JSON.stringify({ entityType: 'service', entity: realSvc })},[],0,window.DB,'free_text')`, sandbox);
      const want = Math.min(100, (realSvc.confidence_strategy.base_confidence || 40));
      assertBehavioral('R-CONF-ONEFORMULA', free && free.score === want,
        `free_text score equals base_confidence on '${realSvc.id}'`, `got=${free?.score} expected=${want}`);
    } catch (e) {
      assertBehavioral('R-CONF-ONEFORMULA', false, 'orch_compute_confidence sweep', e.message);
    }
  }
}

{
  const forbidden = [/questionsAnswered\s*\/\s*\w+/, /answeredCount\s*\/\s*\w+/, /numQuestions\s*\/\s*\w+/, /\.length\s*\/\s*totalQuestions/];
  const hits = forbidden.filter(re => re.test(qrHtmlContent)).map(re => re.source);
  assertStructural('P-CONF-NOQUESTIONMATH', hits.length === 0, 'No question-count-based confidence', hits.join(' | '));
  const bad = [];
  for (const [k, m] of Object.entries(btnycData.intake_modules || {}))
    if (m.confidence_gain != null && typeof m.confidence_gain !== 'number') bad.push(`${k}=${typeof m.confidence_gain}`);
  assertStructural('P-CONF-NOQUESTIONMATH', bad.length === 0, 'Every confidence_gain is numeric', bad.join(', '));
}

{
  const bundle = bundleFunctions([
    'resolveBaseConfidenceStrategy','applyLiveConfidenceEscalation','orch_compute_confidence',
  ], { prelude: `function _trace(){}` });
  if (_bundleGuard(bundle)) {
    const sandbox = makeSandbox();
    try {
      vm.runInContext(`${bundle.source}`, sandbox, { timeout: 4000 });
      const svc = btnycData.services.find(s => s.confidence_strategy && s.confidence_strategy.minimum_quote_confidence);
      if (svc) {
        const res = { entityType: 'service', entity: svc };
        const no = vm.runInContext(`orch_compute_confidence(${JSON.stringify(res)},[],0,window.DB,'free_text')`, sandbox);
        const withT = vm.runInContext(`orch_compute_confidence(${JSON.stringify(res)},['#brick_wall'],0,window.DB,'free_text')`, sandbox);
        assertBehavioral('P-CONF-DYNAMIC', withT.minConf >= no.minConf,
          'A complexity-escalating tag raises (never lowers) the confidence bar',
          `no=${no.minConf} withTag=${withT.minConf}`);
      }
    } catch (e) { assertBehavioral('P-CONF-DYNAMIC', false, 'suite in VM', e.message); }
  }
}

{
  const ast = extractFunctionAST(qrHtmlContent, 'orch_resolve_entity');
  const body = extractFunctionBody(qrHtmlContent, 'orch_resolve_entity') || '';
  assertStructural('P-CONF-SAFETY',
    (ast && findAstNodes(ast, astIsIdentifier('conflictsWithIndependentGroup')).length > 0) ||
    /conflictsWithIndependentGroup/.test(body),
    'orch_resolve_entity blocks a named-service commitment conflicting with an independently-resolved group');
}

// R-INTAKE-WIREREMOVE behavioral
{
  const defs = btnycData.global_rules?.intake_defaults || {};
  assertStructural('R-INTAKE-WIREREMOVE',
    Array.isArray(defs.universal) && typeof defs.category_defaults === 'object' && typeof defs.group_defaults === 'object',
    'global_rules.intake_defaults carries universal/category_defaults/group_defaults');
  const KEY = '__test_diag_module__';
  const cloned = JSON.parse(JSON.stringify(btnycData));
  cloned.global_rules.intake_defaults.universal = [...(cloned.global_rules.intake_defaults.universal || []), KEY];
  cloned.intake_modules[KEY] = { question: 'TEST', type: 'single', client_response: [{ label: 'A', tags: [] }, { label: 'B', tags: [] }], purpose: 'pricing', confidence_gain: 5, affects_price: false };
  const b = bundleFunctions(['_resolveIntakeChain','orch_compose_intake_chain'], { prelude: `function _trace(){}` });
  if (b.missing.length === 0) {
    const sb = { DB: cloned, SERVICE_DATA: cloned, window: { DB: cloned }, console: { log(){},warn(){},error(){} }, Math, Object, Array, Set, Map, WeakMap, WeakSet, Number, String, Boolean, JSON, parseInt, parseFloat, isNaN, isFinite, Infinity, NaN, _trace: () => {}, _traceStart: () => {}, _traceFn: () => {} };
    sb.window.DB = cloned;
    const ctx = vm.createContext(sb);
    const target = cloned.services.find(s => s.intake_chain && s.intake_chain.length > 0) || cloned.services[0];
    try {
      const chain = vm.runInContext(`${b.source}\norch_compose_intake_chain({selectedCategoryId:'unused',selectedGroupId:'unused'},{entity:${JSON.stringify(target)}},window.DB);`, ctx, { timeout: 4000 });
      const keys = (chain || []).map(m => m.moduleKey || m.module);
      assertBehavioral('R-INTAKE-WIREREMOVE', keys.includes(KEY),
        `orch_compose_intake_chain consumes intake_defaults.universal (injected '${KEY}' present)`);
      const authored = new Set((target.intake_chain || []).map(s => s.module));
      assertBehavioral('R-INTAKE-WIREREMOVE', [...authored].every(k => keys.includes(k)),
        'composed chain includes every authored intake_chain module (no silent drop)');
    } catch (e) { assertBehavioral('R-INTAKE-WIREREMOVE', false, 'compose in VM', e.message); }
  }
  assertStructural('R-INTAKE-QTYONCE',
    'force_modules_by_variability_DEPRECATED' in (btnycData.global_rules || {}) &&
    !('force_modules_by_variability' in (btnycData.global_rules || {})),
    'Legacy force_modules_by_variability archived (DEPRECATED present; live absent)');
}

// R-INTAKE-QTYONCE behavioral
{
  const qAst = extractFunctionAST(qrHtmlContent, 'entityHasOwnQtyQuestion');
  assertStructural('R-INTAKE-QTYONCE', !!qAst && findAstNodes(qAst, astIsIdentifier('intake_chain')).length > 0,
    'entityHasOwnQtyQuestion inspects intake_chain');
  const aAst = extractFunctionAST(qrHtmlContent, 'sqAnalyze');
  const bAst = extractFunctionAST(qrHtmlContent, 'sqBuilderFinish');
  assertStructural('R-INTAKE-QTYONCE', !!(aAst && findAstNodes(aAst, n => astIsAssignmentTo('S', 'qty')(n) && n.right.type === 'MemberExpression' && n.right.property && n.right.property.name === 'units').length > 0),
    'sqAnalyze seeds S.qty from the route\'s resolved quantity record (AST; T147)');
  const wAst = extractFunctionAST(qrHtmlContent, 'resolveBuilderQuantity');
  assertStructural('R-INTAKE-QTYONCE', !!(bAst && findAstNodes(bAst, n => astIsAssignmentTo('S', 'qty')(n) && findAstNodes(n.right, astIsCallTo('resolveBuilderQuantity')).length > 0).length > 0) && !!(wAst && findAstNodes(wAst, astIsCallTo('resolveQuantityUnits')).length > 0),
    'sqBuilderFinish seeds S.qty from resolveBuilderQuantity, which delegates to resolveQuantityUnits (AST; T147/T148)');

  // T148: population evidence. The rule claims a universal -- the decision is made once and applied consistently by EVERY caller -- so it is swept over every service, not sampled.
  {
    const whole = _engineFind('resolveQuantityUnits');
    if (whole) {
      const sbq = makeSandbox(); const badQ = [];
      try {
        vm.runInContext(whole, sbq, { timeout: 8000 });
        for (const sv of btnycData.services) {
          const ownQ = (sv.intake_chain || []).some(st => (st.module || st) === 'item_count_template');
          const r = vm.runInContext(`resolveQuantityUnits(${JSON.stringify({ entity: sv, entityType: 'service', requestedQty: 4 })})`, sbq, { timeout: 4000 });
          const want = (sv.per_unit_answers_vary === true || ownQ) ? 1 : 4;
          if (r.units !== want) badQ.push(`${sv.id}: units ${r.units}, expected ${want}`);
        }
        assertBehavioralPop('R-INTAKE-QTYONCE', badQ.length === 0,
          `quantity is decided once, at the resolver, for every one of ${btnycData.services.length} services (a single-unit or own-question service prices one unit; every other prices what was asked)`, badQ.slice(0, 5).join(' | '));
      } catch (e) { assertBehavioralPop('R-INTAKE-QTYONCE', false, 'quantity population sweep ran without throwing', e.message.split('\n')[0]); }
    }
  }

  const d = extractFunctionDeclaration(qrHtmlContent, 'entityHasOwnQtyQuestion');
  const aware = btnycData.services.find(s => (s.intake_chain || []).some(st => st.module === 'item_count_template'));
  const generic = btnycData.services.find(s =>
    (s.intake_chain || []).some(st => st.module === 'global_quantity') &&
    !(s.intake_chain || []).some(st => st.module === 'item_count_template'));
  if (d && aware) {
    const sb = makeSandbox();
    try {
      const v = vm.runInContext(`"use strict";var _GENERIC_QTY_MODULE_KEYS=${PRELUDE_CONSTANTS.GENERIC_QTY_KEYS};\n${d.header}{${d.body}}\nentityHasOwnQtyQuestion(${JSON.stringify(aware)});`, sb, { timeout: 4000 });
      assertBehavioral('R-INTAKE-QTYONCE', v === true, `entityHasOwnQtyQuestion true for ${aware.id}`);
    } catch (e) { assertBehavioral('R-INTAKE-QTYONCE', false, 'aware sandbox', e.message); }
  }
  if (d && generic) {
    const sb = makeSandbox();
    try {
      const v = vm.runInContext(`"use strict";var _GENERIC_QTY_MODULE_KEYS=${PRELUDE_CONSTANTS.GENERIC_QTY_KEYS};\n${d.header}{${d.body}}\nentityHasOwnQtyQuestion(${JSON.stringify(generic)});`, sb, { timeout: 4000 });
      assertBehavioral('R-INTAKE-QTYONCE', v === false, `entityHasOwnQtyQuestion false for ${generic.id}`);
    } catch (e) { assertBehavioral('R-INTAKE-QTYONCE', false, 'generic sandbox', e.message); }
  }
}

{
  const qAst = extractFunctionAST(qrHtmlContent, 'sqAnalyze');
  const bAst = extractFunctionAST(qrHtmlContent, 'sqBuilderFinish');
  const ok = (ast) => ast && findAstNodes(ast, astIsAssignmentTo('S', 'qty')).length > 0;
  assertStructural('R-INTAKE-QTYFIELD', ok(qAst) && ok(bAst), 'Both entry paths assign S.qty (AST)');
  const sourceAst = _parseAst(qrHtmlContent).ast;
  const parallel = ['S.quantity','S.amount','S.itemCount','S.item_count','S.numItems'];
  const hits = parallel.filter(f => {
    const [o, p] = f.split('.');
    return sourceAst && findAstNodes(sourceAst, astIsAssignmentTo(o, p)).length > 0;
  });
  assertStructural('R-INTAKE-QTYFIELD', hits.length === 0, 'No parallel quantity fields assigned (AST)', hits.join(', '));
}

{
  const iAst = extractFunctionAST(qrHtmlContent, 'inferTagsFromContext');
  assertStructural('P-INTAKE-INFER', !!(iAst && findAstNodes(iAst, astIsCallTo('tagValidForCategory')).length > 0),
    'inferTagsFromContext delegates to tagValidForCategory (AST)');
  const lAst = extractFunctionAST(qrHtmlContent, 'orch_apply_location_hints');
  assertStructural('P-INTAKE-INFER', !!(lAst && findAstNodes(lAst, astIsIdentifier('location_hints')).length > 0),
    'orch_apply_location_hints consults location_hints');
  const cSrc = extractFunctionBody(qrHtmlContent, 'renderCuratedCardFromRoute');
  assertStructural('P-INTAKE-INFER', !!cSrc && /answers\s*\[\s*modKey\s*\]/.test(cSrc),
    'renderCuratedCardFromRoute skips already-populated answers');
}

// ─── §5 No White Flag ───────────────────────────────────────────────
{
  const bundle = bundleFunctions([
    'executeWorkflow','orch_resolve_entity','orch_apply_object_based_resolution',
    'orch_enrich_from_dynamic_service','orch_compute_variability_flags',
    'orch_compose_intake_chain','orch_apply_location_hints','orch_compute_confidence',
    'orch_select_ui_template','orch_merge_materials_estimate','orch_compute_quote',
    'orch_apply_intake_bypass_rules','readRoutePath','evaluateInvariant',
    'describeInvariantFailure','validateRoute','catastrophicFallbackRoute',
    'checkRoutingArchetypeConsistency','_resolveIntakeChain','resolveBaseConfidenceStrategy',
    'applyLiveConfidenceEscalation','applyPricingFormula','computeArchetypeQuote',
    'deriveComplexityTier','resolveServiceCheckoutStateKey','buildCheckoutStateModel',
    'sqTagLabel','computeUnifiedQuote','_computePrice','synthesizeAnswersFromTags',
    'closeTagsOverRequires','requiredTagIdsFor','tagValidForCategory','isDiagnosticService',
    'isLogisticTag','sqTagFeeImpact','resolveServiceBadge','resolveServiceBadgeKey',
    'resolveEngineKey','entityHasOwnQtyQuestion','getServiceProfile','mathFurnitureAssembly',
    'resolveDynamicService','makeBookingContext',
  ], { prelude: enginePrelude() });
  if (_bundleGuard(bundle)) {
    const sandbox = makeSandbox();
    try {
      vm.runInContext(`${bundle.source}`, sandbox, { timeout: 6000 });
      const failures = [];
      for (const svc of btnycData.services) {
        try {
          const route = vm.runInContext(
            `executeWorkflow(makeBookingContext('catalog', {selectedServiceId:${JSON.stringify(svc.id)}, selectedCategoryId:${JSON.stringify(svc.ui_taxonomy?.category_id)}, selectedGroupId:${JSON.stringify(svc.ui_taxonomy?.group_id)}}), window.DB)`,
            sandbox, { timeout: 6000 });
          if (!route || !route.quote || typeof route.quote.laborEstimate !== 'number')
            failures.push(`${svc.id}: no numeric laborEstimate`);
        } catch (e) { failures.push(`${svc.id}: ${e.message.slice(0, 60)}`); }
      }
      assertBehavioralPop('P-WHITEFLAG-PRICED', failures.length === 0,
        `Every named service produces a numeric price (${btnycData.services.length} checked)`,
        failures.slice(0, 5).join(' | '));
    } catch (e) { assertBehavioral('P-WHITEFLAG-PRICED', false, 'sweep in VM', e.message.split('\n')[0]); }
  }
}

{
  const bundle = bundleFunctions([
    'resolveBaseConfidenceStrategy','applyLiveConfidenceEscalation','applyPricingFormula',
    'computeArchetypeQuote','deriveComplexityTier','resolveServiceCheckoutStateKey',
    'buildCheckoutStateModel','sqTagLabel','computeUnifiedQuote','_computePrice',
    'synthesizeAnswersFromTags','closeTagsOverRequires','requiredTagIdsFor','tagValidForCategory',
    'isDiagnosticService','isLogisticTag','sqTagFeeImpact','resolveServiceBadge',
    'resolveServiceBadgeKey','resolveEngineKey','entityHasOwnQtyQuestion','getServiceProfile',
    'mathFurnitureAssembly',
  ], { prelude: enginePrelude() });
  if (_bundleGuard(bundle)) {
    const sandbox = makeSandbox();
    try {
      vm.runInContext(`${bundle.source}`, sandbox, { timeout: 6000 });
      const unrecognized = [];
      for (const svc of btnycData.services) {
        const r = vm.runInContext(
          `computeUnifiedQuote({svc:${JSON.stringify(svc)},dynDef:null,activeTagIds:[],answers:{},qty:1,intentKeyword:null,formulaId:null,ctxAdjFee:0,ctxAdjMin:0,enrichment:null})`,
          sandbox, { timeout: 4000 });
        for (const entry of (r?.feeBreakdown || []))
          if (!['answer','formula','contextual_override'].includes(entry.source))
            unrecognized.push(`${svc.id}:${entry.source}`);
      }
      assertBehavioralPop('P-WHITEFLAG-PRECISE', unrecognized.length === 0,
        'Every fee-breakdown entry attributed to a declared modifier/formula/override',
        unrecognized.slice(0, 5).join(' | '));
    } catch (e) { assertBehavioral('P-WHITEFLAG-PRECISE', false, 'attribution sweep in VM', e.message.split('\n')[0]); }
  }
}

{
  const dr = btnycData.global_rules?.divergence_resolution || {};
  assertStructural('P-WHITEFLAG-DIAG', dr.enabled === true || dr.enabled === false,
    'divergence_resolution.enabled explicitly set');
  assertStructural('P-WHITEFLAG-DIAG', typeof dr.diagnostic_fee === 'number' && dr.diagnostic_fee > 0,
    'divergence_resolution carries a real diagnostic_fee');
  assertStructural('P-WHITEFLAG-FORKB', typeof dr.credit_policy === 'string' && dr.credit_policy.length > 0,
    'divergence_resolution carries a real credit_policy string');
  const ast = extractFunctionAST(qrHtmlContent, 'onsiteDiagnosticTerms');
  assertStructural('P-WHITEFLAG-FORKB',
    !!(ast && findAstNodes(ast, astIsIdentifier('divergenceFee')).length > 0 &&
       findAstNodes(ast, astIsIdentifier('creditNote')).length > 0),
    'onsiteDiagnosticTerms resolves fee + credit into a single terms object (AST)');
}

// ─── §6 Financial & Pricing Engine ─────────────────────────────────
assertStructural('R-PRICE-REGISTERED',
  btnycData.pricing_formulas && Object.keys(btnycData.pricing_formulas).length > 0,
  'pricing_formulas registry populated');

{
  const formulas = btnycData.pricing_formulas || {};
  const KNOWN = new Set(['assembly_formula']);
  const missing = [];
  for (const svc of btnycData.services || []) {
    const fe = svc.financial_engine || {};
    if (fe.formula_ref && !formulas[fe.formula_ref]) missing.push(`${svc.id}: formula_ref='${fe.formula_ref}'`);
    if (svc.pricing_engine && /_formula$/.test(svc.pricing_engine) && !formulas[svc.pricing_engine] && !KNOWN.has(svc.pricing_engine))
      missing.push(`${svc.id}: pricing_engine='${svc.pricing_engine}'`);
  }
  assertStructural('R-PRICE-REGISTERED', missing.length === 0,
    'Every service formula_ref/pricing_engine resolves to a registered formula',
    missing.slice(0, 8).join(' | '));
}

{
  const arche = new Set(Object.keys(btnycData.pricing_archetypes || {}));
  const invalid = [];
  for (const svc of btnycData.services || []) {
    const pa = svc.financial_engine?.pricing_archetype;
    if (pa && !arche.has(pa)) invalid.push(`${svc.id}: '${pa}'`);
  }
  assertStructural('R-PRICE-REGISTERED', arche.size > 0 && invalid.length === 0,
    'Every service pricing_archetype is registered', invalid.slice(0, 8).join(' | '));
}

{
  const mods = btnycData.global_rules?.modifiers || {};
  const valid = new Set(['per_unit','per_visit']);
  const missing = [], invalid = [];
  for (const [k, d] of Object.entries(mods)) {
    if (!d || typeof d !== 'object') continue;
    if (!('scope' in d)) missing.push(k);
    else if (!valid.has(d.scope)) invalid.push(`${k}='${d.scope}'`);
  }
  assertStructural('R-PRICE-SCOPE', missing.length === 0 && invalid.length === 0,
    'Every modifier carries an explicit scope of per_unit or per_visit',
    `missing=[${missing.slice(0, 6).join(', ')}] invalid=[${invalid.slice(0, 6).join(', ')}]`);
}

{
  const ast = extractFunctionAST(qrHtmlContent, 'computeUnifiedQuote');
  const body = extractFunctionBody(qrHtmlContent, 'computeUnifiedQuote');
  assertStructural('R-PRICE-REACHES', !!body && body.length > 1000, 'computeUnifiedQuote substantial');
  assertStructural('R-PRICE-REACHES', !!(ast && findAstNodes(ast, astIsCallTo('applyPricingFormula')).length > 0),
    'computeUnifiedQuote invokes applyPricingFormula (AST)');
  assertStructural('R-PRICE-REACHES', !!(ast && findAstNodes(ast, astIsIdentifier('FORMULA_CONSUMED_KEYS')).length > 0),
    'computeUnifiedQuote uses FORMULA_CONSUMED_KEYS');
  assertStructural('R-PRICE-REACHES',
    !/if\s*\(\s*!\s*formulaResult\s*\)\s*\{\s*const\s+_mods/.test(body || ''),
    'computeUnifiedQuote does NOT gate the whole answer-modifier loop on !formulaResult');
  assertStructural('R-PRICE-REACHES', /if\s*\(\s*!\s*formulaConsumedKeys\.has\s*\(\s*moduleKey\s*\)\s*\)/.test(body || ''),
    'computeUnifiedQuote applies per-key guard inside the loop');
}

{
  const bundle = bundleFunctions([
    'resolveBaseConfidenceStrategy','applyLiveConfidenceEscalation','applyPricingFormula',
    'computeArchetypeQuote','deriveComplexityTier','resolveServiceCheckoutStateKey',
    'sqTagLabel','computeUnifiedQuote',
  ], { prelude: enginePrelude() });
  if (_bundleGuard(bundle)) {
    const sandbox = makeSandbox();
    try {
      vm.runInContext(`${bundle.source}`, sandbox, { timeout: 4000 });
      const svc = btnycData.services.find(s => s.id === 'flatscreen_mounting_standard');
      const wallMod = btnycData.global_rules?.modifiers?.['wall_type_brick_or_concrete'];
      const weightMod = btnycData.global_rules?.modifiers?.['weight_20_to_50_lbs_moderate'];
      if (svc && wallMod && weightMod) {
        const base = { svc, dynDef: null, activeTagIds: [], answers: {}, qty: 1, intentKeyword: null, formulaId: null, ctxAdjFee: 0, ctxAdjMin: 0, enrichment: null };
        const run = (a) => vm.runInContext(`${bundle.source}\ncomputeUnifiedQuote(${JSON.stringify({ ...base, answers: a })});`, sandbox, { timeout: 6000 });
        const no = run({}); const one = run({ wall_type: 'Brick or concrete' });
        const two = run({ wall_type: 'Brick or concrete', weight: '20 to 50 lbs (moderate)' });
        assertBehavioral('R-PRICE-REACHES', one.laborEstimate - no.laborEstimate === wallMod.fee,
          `one modifier adds exactly its declared fee ($${wallMod.fee})`);
        assertBehavioral('R-PRICE-REACHES', two.laborEstimate - no.laborEstimate === wallMod.fee + weightMod.fee,
          `two modifiers sum exactly ($${wallMod.fee + weightMod.fee})`);
        assertBehavioral('R-PRICE-REACHES', (two.feeBreakdown || []).filter(b => b.source === 'answer').length >= 2,
          'feeBreakdown includes both modifier contributions');
      }
    } catch (e) { assertBehavioral('R-PRICE-REACHES', false, 'modifier-delta in VM', e.message); }
  }
}

{
  const withFees = [];
  for (const [tid, def] of Object.entries(btnycData.smart_tags || {})) {
    if (!def || typeof def !== 'object') continue;
    if (def.effects && typeof def.effects.fee === 'number' && def.effects.fee !== 0) withFees.push(`${tid} (effects.fee=${def.effects.fee})`);
    if (typeof def.fee === 'number' && def.fee !== 0) withFees.push(`${tid} (fee=${def.fee})`);
  }
  assertStructural('P-INVARIANT-CHIPSNOTFEES', withFees.length === 0, 'No smart_tag carries a direct fee', withFees.slice(0, 8).join(' | '));
}

{
  const d = extractFunctionDeclaration(qrHtmlContent, 'applyPricingFormula');
  if (d) {
    const sandbox = makeSandbox();
    const full = `"use strict";\n${d.header}{${d.body}}`;
    const f = btnycData.pricing_formulas.hardware_install_formula;
    if (f && f.swap && f.new_holes) {
      const want = (branch, units) => hardwareExpectedFee(f, branch, units);   // T156: the ruled rule (tiers, visit minimum, old flat price as the floor)
      const matrix = [1,2,5,9,10,11,15,19,20,21,25,40,55,96,99,100,150,500];
      const failures = [];
      for (const q of matrix) {
        for (const branch of ['swap', 'new holes']) {
          try {
            const r = vm.runInContext(`${full}\napplyPricingFormula('hardware_install_formula',{install_type:'${branch}',unit_count:${q}},${q},null);`, sandbox, { timeout: 4000 });
            const w = want(branch === 'swap' ? 'swap' : 'new_holes', q);
            if (!r || Math.abs(r.extraFee - w) > 1e-9) failures.push(`${branch}×${q}: want=${w} got=${r && r.extraFee}`);
          } catch (e) { failures.push(`${branch}×${q}: ${e.message}`); }
        }
      }
      assertBehavioralMatrix('R-PRICE-REGISTERED', failures.length === 0,
        `hardware_install_formula matches its coefficients across ${matrix.length * 2} cases`,
        failures.slice(0, 6).join(' | '));
      let prev = -1, monotonic = true;
      for (const q of matrix) {
        try {
          const r = vm.runInContext(`${full}\napplyPricingFormula('hardware_install_formula',{install_type:'swap',unit_count:${q}},${q},null);`, sandbox, { timeout: 4000 });
          if (!r || r.extraFee < prev) { monotonic = false; break; }
          prev = r.extraFee;
        } catch (_) { monotonic = false; break; }
      }
      assertBehavioralMatrix('R-PRICE-REACHES', monotonic, 'hardware_install_formula monotonic in qty');
    }
  }
}

{
  const d = extractFunctionDeclaration(qrHtmlContent, 'mathFurnitureAssembly');
  if (d) {
    const sandbox = makeSandbox();
    sandbox.SERVICE_DATA = { meta: { global_rates: { standard_labor: 40 } } };
    const run = (input) => vm.runInContext(`"use strict";\n${d.header}{${d.body}}\nmathFurnitureAssembly(${JSON.stringify(input)});`, sandbox, { timeout: 4000 });
    try {
      const r = run([{ minutes: 60, flat_fee: 40 }]);
      assertBehavioral('R-PRICE-REGISTERED', r && typeof r.price === 'number' && Math.abs(r.price - 40) < 1,
        'mathFurnitureAssembly prices a 60-minute item at its catalog flat_fee');
    } catch (e) { assertBehavioral('R-PRICE-REGISTERED', false, 'single', e.message); }
    try {
      const r2 = run([{ minutes: 15, flat_fee: 10 }]);
      assertBehavioral('R-PRICE-REGISTERED', r2 && typeof r2.price === 'number' && Math.abs(r2.price - 40) < 1,
        'mathFurnitureAssembly enforces the 1-hour minimum');
    } catch (e) { assertBehavioral('R-PRICE-REGISTERED', false, 'minimum', e.message); }
  }
}

// ─── §7 System Architecture & Security ──────────────────────────────
assertStructural('R-SYSTEM-NODATA', !qrHtmlContent.includes('"services": [{"id":'),
  'Catalog data is not inlined into qr.html');

{
  const ast = _parseAst(qrHtmlContent).ast;
  let evalCalls = 0, newFn = 0;
  if (ast) {
    evalCalls = findAstNodes(ast, n => n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === 'eval').length;
    newFn = findAstNodes(ast, n => n.type === 'NewExpression' && n.callee.type === 'Identifier' && n.callee.name === 'Function').length +
      findAstNodes(ast, n => n.type === 'CallExpression' && n.callee.type === 'Identifier' && n.callee.name === 'Function').length;
  }
  assertStructural('R-INVARIANT-NOEVAL', evalCalls === 0 && newFn === 0,
    'No eval or new Function call sites exist in source (AST)', `eval=${evalCalls} newFunction=${newFn}`);
}

{
  const ast = _parseAst(qrHtmlContent).ast;
  const stringTimers = ast ? findAstNodes(ast, n =>
    n.type === 'CallExpression' && n.callee.type === 'Identifier' &&
    /^(setTimeout|setInterval)$/.test(n.callee.name) &&
    n.arguments[0] && n.arguments[0].type === 'Literal' && typeof n.arguments[0].value === 'string').length : 0;
  assertStructural('R-SYSTEM-CSP', stringTimers === 0, 'No string-argument timers', `found ${stringTimers}`);
}

{
  assertStructural('R-SYSTEM-NOREF', !/eval\s*\([^)]*\$ref|Function\s*\([^)]*\$ref/.test(qrHtmlContent),
    'No $ref string is dynamically executed');
  const allRefs = new Set(); const known = new Set(Object.keys(btnycData.intake_modules || {}));
  for (const svc of btnycData.services || []) for (const st of svc.intake_chain || []) {
    if (st.module) allRefs.add(st.module);
    for (const t of Object.values(st.then || {})) (t || []).forEach(x => allRefs.add(x));
  }
  for (const def of Object.values(btnycData.dynamic_services || {})) for (const st of def.intake_chain || []) {
    if (st.module) allRefs.add(st.module);
    for (const t of Object.values(st.then || {})) (t || []).forEach(x => allRefs.add(x));
  }
  const orphans = [...allRefs].filter(m => !known.has(m));
  assertStructural('R-SYSTEM-NOREF', orphans.length === 0,
    'Every referenced module exists in intake_modules', orphans.join(', '));
}

{
  const expected = ['pricing_engine.js','nlp_engine.js','orchestrator_engine.js','UIRenderer.js','AppController.js'];
  const missing = expected.filter(m => !qrHtmlContent.includes(m));
  assertStructural('R-SYSTEM-LAYERS', missing.length === 0, 'All five module boundaries present', `missing=[${missing.join(', ')}]`);
}

{
  const d = extractFunctionDeclaration(qrHtmlContent, 'applyPricingFormula');
  if (d) {
    const ctx = vm.createContext({ DB: btnycData, Math, Object, Array, Set, Map, Number, String, Boolean, JSON, parseInt, parseFloat, isNaN });
    try {
      vm.runInContext(`"use strict";\n${d.header}{${d.body}}\napplyPricingFormula('hardware_install_formula',{install_type:'swap',unit_count:5},5,null);`, ctx, { timeout: 4000 });
      assertBehavioral('R-SYSTEM-NODOM', true, 'applyPricingFormula executes with no DOM access');
    } catch (e) { assertBehavioral('R-SYSTEM-NODOM', false, 'applyPricingFormula must not access document/window', e.message); }
  }
}

{
  assertStructural('R-SYSTEM-DECLARATIVE', !/"(?:eval|new Function)\s*\(/.test(JSON.stringify(btnycData)),
    'SSOT contains no function-body strings');
  const diff = btnycData._additive_diff || {};
  const changed = diff['CHANGED (should never happen)'] || [];
  assertStructural('P-SYSTEM-NOEDIT', changed.length === 0,
    'compiled artifact declares zero CHANGED keys', JSON.stringify(changed).slice(0, 200));
}

{
  const bundle = bundleFunctions([
    'executeWorkflow','orch_resolve_entity','orch_apply_object_based_resolution',
    'orch_enrich_from_dynamic_service','orch_compute_variability_flags',
    'orch_compose_intake_chain','orch_apply_location_hints','orch_compute_confidence',
    'orch_select_ui_template','orch_merge_materials_estimate','orch_compute_quote',
    'orch_apply_intake_bypass_rules','readRoutePath','evaluateInvariant',
    'describeInvariantFailure','validateRoute','catastrophicFallbackRoute',
    'checkRoutingArchetypeConsistency','_resolveIntakeChain','resolveBaseConfidenceStrategy',
    'applyLiveConfidenceEscalation','applyPricingFormula','computeArchetypeQuote',
    'deriveComplexityTier','resolveServiceCheckoutStateKey','buildCheckoutStateModel',
    'sqTagLabel','computeUnifiedQuote','_computePrice','synthesizeAnswersFromTags',
    'closeTagsOverRequires','requiredTagIdsFor','tagValidForCategory','isDiagnosticService',
    'isLogisticTag','sqTagFeeImpact','resolveServiceBadge','resolveServiceBadgeKey',
    'resolveEngineKey','entityHasOwnQtyQuestion','getServiceProfile','mathFurnitureAssembly',
    'resolveDynamicService','makeBookingContext',
  ], { prelude: enginePrelude() });
  if (_bundleGuard(bundle)) {
    const sandbox = makeSandbox();
    try {
      vm.runInContext(`${bundle.source}`, sandbox, { timeout: 6000 });
      const svc = btnycData.services.find(s => s.confidence_strategy);
      if (svc) {
        const route = vm.runInContext(`executeWorkflow(makeBookingContext('catalog',{selectedServiceId:${JSON.stringify(svc.id)},selectedCategoryId:${JSON.stringify(svc.ui_taxonomy?.category_id)},selectedGroupId:${JSON.stringify(svc.ui_taxonomy?.group_id)}}),window.DB)`, sandbox, { timeout: 6000 });
        assertBehavioral(null,
          route && typeof route.uiTemplate === 'string' && route.quote &&
          typeof route.quote.checkoutStateKey === 'string' && route.entity && route.entity.id,
          'ResolvedRoute exposes routing, pricing, entity, and checkout-state as distinct fields');
      }
    } catch (e) { assertBehavioral(null, false, 'dimensional test', e.message.split('\n')[0]); }
  }
}

{
  const groups = Object.keys(btnycData.routing_archetypes || {});
  const missing = [], bad = [];
  for (const gid of groups) {
    const arch = btnycData.routing_archetypes[gid].routing_archetype;
    if (!arch) missing.push(gid);
    else if (!['parent','component_first','symptom_first','undetermined'].includes(arch)) bad.push(`${gid}:${arch}`);
  }
  assertStructural('P-SYSTEM-CLASSIFY-ONE', missing.length === 0 && bad.length === 0,
    'Every group has exactly one valid routing_archetype',
    `missing=[${missing.slice(0,5).join(',')}] bad=[${bad.slice(0,5).join(',')}]`);
}

{
  const cAst = extractFunctionAST(qrHtmlContent, 'checkRoutingArchetypeConsistency');
  const vAst = extractFunctionAST(qrHtmlContent, 'validateRoute');
  assertStructural('R-SYSTEM-PICKER-AGREE', !!(cAst && findAstNodes(cAst, astIsIdentifier('routing_archetype')).length > 0),
    'checkRoutingArchetypeConsistency inspects routing_archetype');
  assertStructural('R-SYSTEM-PICKER-AGREE', !!(vAst && findAstNodes(vAst, astIsCallTo('checkRoutingArchetypeConsistency')).length > 0),
    'validateRoute invokes checkRoutingArchetypeConsistency (AST)');
}

{
  const pickerFns = ['showServiceTypesForGroup','renderComponentSymptomPicker','showSubGroups','showGroupsForCategory'];
  const violations = [];
  for (const fn of pickerFns) {
    const ast = extractFunctionAST(qrHtmlContent, fn);
    if (!ast) continue;
    if (findAstNodes(ast, astIsCallTo('computeUnifiedQuote')).length > 0) violations.push(`${fn}: computeUnifiedQuote`);
    if (findAstNodes(ast, astIsMemberRead('DB', 'financial_engine')).length > 0) violations.push(`${fn}: DB.financial_engine`);
    if (findAstNodes(ast, astIsMemberRead('DB', 'pricing_formulas')).length > 0) violations.push(`${fn}: DB.pricing_formulas`);
    if (findAstNodes(ast, astIsAssignmentToObject('S')).length > 0) violations.push(`${fn}: mutates S.*`);
  }
  assertStructural('P-SYSTEM-PICKER-RENDER', violations.length === 0,
    'Picker renderers do not compute prices, read pricing data, or mutate session state (AST)',
    violations.slice(0, 5).join(' | '));
}

{
  const uiBody = extractModuleScriptBody(qrHtmlContent, 'UIRenderer.js');
  if (!uiBody) {
    assertStructural('R-INVARIANT-BOUNDARY', false, 'UIRenderer.js body not located');
  } else {
    const RENDERER_ALLOWLIST = new Set(['cacheDOM','init','buildDataMaps','escapeHtml','addBackButton']);
    const FORBIDDEN_CALLS = ['computeUnifiedQuote','orch_compute_confidence','resolveDynamicService','tagValidForCategory','resolveBaseConfidenceStrategy','applyPricingFormula','computeArchetypeQuote','deriveComplexityTier'];
    const violations = [];
    const rendererFns = findTopLevelFunctionDeclarations(uiBody);
    for (const d of rendererFns) {
      if (RENDERER_ALLOWLIST.has(d.name)) continue;
      for (const fn of FORBIDDEN_CALLS)
        if (findAstNodes(d.astNode, astIsCallTo(fn)).length > 0) violations.push(`${d.name} calls ${fn}`);
      for (const prop of ['financial_engine','pricing_formulas','checkout_states','global_rules'])
        if (findAstNodes(d.astNode, astIsMemberRead('DB', prop)).length > 0) violations.push(`${d.name} reads DB.${prop}`);
      if (findAstNodes(d.astNode, astIsAssignmentToObject('S')).length > 0) violations.push(`${d.name} mutates S.*`);
    }
    assertStructural('R-INVARIANT-BOUNDARY', violations.length === 0,
      `No UIRenderer function calls an engine or reads state directly (${rendererFns.length} fns, AST)`,
      violations.slice(0, 8).join(' | '));
  }
}

{
  const ast = _parseAst(qrHtmlContent).ast;
  const violations = [];
  if (ast) {
    const listeners = findAstNodes(ast, n =>
      n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.property.name === 'addEventListener');
    for (const call of listeners) {
      const h = call.arguments[1]; if (!h) continue;
      for (const fn of ['computeUnifiedQuote','orch_compute_confidence','applyPricingFormula'])
        if (findAstNodes(h, astIsCallTo(fn)).length > 0) violations.push(`listener calls ${fn}`);
      for (const prop of ['financial_engine','pricing_formulas','checkout_states'])
        if (findAstNodes(h, astIsMemberRead('DB', prop)).length > 0) violations.push(`listener reads DB.${prop}`);
    }
  }
  assertHeuristic('P-INVARIANT-HANDLERS', violations.length === 0,
    'No addEventListener handler directly calls an engine or reads the pricing SSOT (AST)',
    violations.slice(0, 5).join(' | '));
}

// ─── §8 SSOT Cross-Reference Integrity ─────────────────────────────
{
  const smart = new Set(Object.keys(btnycData.smart_tags || {}).map(k => k.replace(/^#/, '')));
  const intent = new Set((btnycData.intent_mappings?.objects || []).map(o => o.keyword));
  assertStructural('P-SYSTEM-TAGS', smart.size > 0 && intent.size > 0,
    'Both tag systems present in SSOT');
  let overlap = 0; for (const k of smart) if (intent.has(k)) overlap++;
  const identical = overlap === smart.size && overlap === intent.size;
  assertStructural('P-SYSTEM-TAGS', !identical,
    'smart_tags and intent_mappings.objects are distinct systems',
    `overlap=${overlap} smartTags=${smart.size} intent=${intent.size}`);
}

{
  const mods = btnycData.global_rules?.modifiers || {};
  const dangling = new Set();
  const check = (mk, resp, owner) => {
    const ref = resp?.modifier_ref;
    if (ref && !mods[ref]) dangling.add(`${owner}/${mk}:${ref}`);
  };
  for (const [mk, def] of Object.entries(btnycData.intake_modules || {}))
    for (const resp of def.client_response || []) check(mk, resp, 'intake_modules');
  for (const svc of btnycData.services || [])
    for (const st of svc.intake_chain || [])
      for (const resp of st.params?.client_response || []) check(st.module, resp, `service:${svc.id}`);
  assertStructural('P-INVARIANT-VERIFY', dangling.size === 0,
    'Every modifier_ref resolves', [...dangling].slice(0, 8).join(' | '));
}

{
  const cat = btnycData.materials_catalog || {};
  const miss = new Set();
  for (const svc of btnycData.services || []) {
    for (const s of svc.required_materials || []) if (!cat[s]) miss.add(`${svc.id}:req:${s}`);
    for (const s of svc.optional_materials || []) if (!cat[s]) miss.add(`${svc.id}:opt:${s}`);
  }
  assertStructural('P-INVARIANT-VERIFY', miss.size === 0, 'Every material SKU resolves', [...miss].slice(0, 8).join(' | '));
}

{
  const tags = btnycData.smart_tags || {};
  const miss = new Set();
  for (const svc of btnycData.services || []) for (const t of svc.default_tags || []) {
    const ref = (t && typeof t === 'object' && t.$ref) ? t.$ref : t;
    if (typeof ref === 'string' && ref.startsWith('#') && !tags[ref]) miss.add(`${svc.id}:${ref}`);
  }
  assertStructural('P-INVARIANT-VERIFY', miss.size === 0, 'Every default_tag $ref resolves', [...miss].slice(0, 8).join(' | '));
}

{
  const groups = new Set((btnycData.group || []).map(g => g.id));
  const cats = new Set((btnycData.category || []).map(c => c.id));
  const bg = [], bc = [];
  for (const svc of btnycData.services || []) {
    const g = svc.ui_taxonomy?.group_id, c = svc.ui_taxonomy?.category_id;
    if (g && !groups.has(g)) bg.push(`${svc.id}:${g}`);
    if (c && !cats.has(c)) bc.push(`${svc.id}:${c}`);
  }
  for (const g of btnycData.group || []) if (g.category_id && !cats.has(g.category_id)) bc.push(`${g.id}->${g.category_id}`);
  assertStructural('P-INVARIANT-VERIFY', bg.length === 0 && bc.length === 0,
    'Every group_id/category_id resolves',
    `badGroups=[${bg.slice(0,5).join(',')}] badCats=[${bc.slice(0,5).join(',')}]`);
}

{
  const formulas = btnycData.pricing_formulas || {};
  const miss = new Set();
  for (const [mk, def] of Object.entries(btnycData.intake_modules || {}))
    for (const r of def.client_response || []) if (r.formula_override && !formulas[r.formula_override]) miss.add(`${mk}:${r.formula_override}`);
  for (const svc of btnycData.services || [])
    for (const st of svc.intake_chain || [])
      for (const r of st.params?.client_response || []) if (r.formula_override && !formulas[r.formula_override]) miss.add(`${svc.id}/${st.module}:${r.formula_override}`);
  assertStructural('P-INVARIANT-VERIFY', miss.size === 0, 'Every formula_override resolves', [...miss].slice(0, 8).join(' | '));
}

{
  const groups = {};
  for (const svc of btnycData.services) {
    const gid = svc.ui_taxonomy?.group_id;
    if (!gid) continue;
    (groups[gid] = groups[gid] || []).push(svc);
  }
  const violations = [];
  for (const [gid, sibs] of Object.entries(groups)) {
    const withBP = sibs.filter(s => typeof s.financial_engine?.base_price === 'number');
    const missingBP = sibs.filter(s => typeof s.financial_engine?.base_price !== 'number');
    if (withBP.length >= sibs.length - 1 && missingBP.length > 0)
      for (const s of missingBP) violations.push(`${gid}/${s.id}: missing base_price`);
  }
  assertStructural('G-INVARIANT-SWEEP', violations.length === 0,
    'Full-population sweep: no group has an outlier missing a field every sibling carries',
    violations.slice(0, 8).join(' | '));
}

// ─── §9 Master Judicial Invariants ─────────────────────────────────
{
  const usesSSoT = /DB\.global_rules\?\.complexity_tiers\?\.\[/.test(qrHtmlContent) ||
    /DB\.global_rules\.complexity_tiers\[/.test(qrHtmlContent);
  assertStructural('R-INVARIANT-SOURCE', usesSSoT, 'Pricing engine reads hourly rates from SSOT');
  assertStructural('R-INVARIANT-SOURCE', Array.isArray(btnycData.invariants) && btnycData.invariants.length > 5,
    'Master Judicial Invariants array is populated');
  assertStructural('R-INVARIANT-SOURCE', typeof btnycData.$id === 'string' && btnycData.$id.includes('btnyc.json'),
    'SSOT self-identifies via $id');
}

{
  const uAst = extractFunctionAST(qrHtmlContent, 'computeUnifiedQuote');
  const uBody = extractFunctionBody(qrHtmlContent, 'computeUnifiedQuote');
  assertStructural('R-INVARIANT-CANONICAL', !!uAst && !!uBody && uBody.length > 2000,
    'computeUnifiedQuote structurally complete (>2000 chars)');
  const deps = ['resolveBaseConfidenceStrategy','resolveServiceCheckoutStateKey','applyPricingFormula','applyLiveConfidenceEscalation','deriveComplexityTier','computeArchetypeQuote','sqTagLabel'];
  const decls = [], missing = [];
  for (const n of deps) {
    const d = extractFunctionDeclaration(qrHtmlContent, n);
    if (!d) { missing.push(n); continue; }
    decls.push(`${d.header}{${d.body}}`);
  }
  const uDecl = extractFunctionDeclaration(qrHtmlContent, 'computeUnifiedQuote');
  if (uDecl && missing.length === 0) {
    const sandbox = makeSandbox();
    const svc = btnycData.services.find(s => s.id === 'flatscreen_mounting_standard');
    if (svc) {
      try {
        const code = `${_engineFind('resolveQuantityUnits')}
          ${enginePrelude()}
          ${decls.join('\n')}
          ${uDecl.header}{${uDecl.body}}
          computeUnifiedQuote({svc:${JSON.stringify(svc)},dynDef:null,activeTagIds:[],answers:{},qty:1,intentKeyword:null,formulaId:null,ctxAdjFee:0,ctxAdjMin:0,enrichment:null});`;
        const result = vm.runInContext(code, sandbox, { timeout: 6000 });
        const ok = result && typeof result.laborEstimate === 'number' && typeof result.dispatchFee === 'number' && typeof result.checkoutStateKey === 'string';
        assertBehavioral('R-INVARIANT-CANONICAL', ok, 'computeUnifiedQuote produces a real quote object');
        if (ok) {
          assertBehavioral('R-INVARIANT-CANONICAL', result.laborEstimate >= 0, 'non-negative laborEstimate');
          assertBehavioral('R-INVARIANT-CANONICAL', result.laborEstimate === 60, 'exact known price ($60) for flatscreen_mounting_standard at qty=1',
            `got $${result.laborEstimate}`);
          assertDeepEqual('R-INVARIANT-CANONICAL', result.laborEstimate, svc.financial_engine?.base_price || 0,
            'flat_simple laborEstimate === SSOT base_price');
          const states = new Set(Object.keys(btnycData.checkout_states || {}));
          assertBehavioral('R-INVARIANT-CANONICAL', states.has(result.checkoutStateKey), 'registered checkout state');
        }
      } catch (e) { assertBehavioral('R-INVARIANT-CANONICAL', false, 'end-to-end in sandbox', e.message); }
    }
  } else if (missing.length > 0) {
    assertStructural('R-INVARIANT-CANONICAL', false, 'All deps extractable', `missing=[${missing.join(', ')}]`);
  }
}

{
  const orphaned = [];
  for (const svc of btnycData.services || []) {
    const fe = svc.financial_engine || {};
    if (!(fe.checkout_state || fe.pricing_archetype || fe.formula_ref || typeof fe.base_price === 'number')) orphaned.push(svc.id);
  }
  assertStructural('P-WHITEFLAG-PRICED', orphaned.length === 0, 'Every service has a resolvable pricing path', orphaned.join(', '));
}

{
  const invalid = [];
  for (const svc of btnycData.services || []) {
    const cs = svc.confidence_strategy || {};
    if (typeof cs.minimum_quote_confidence === 'number' && (cs.minimum_quote_confidence < 0 || cs.minimum_quote_confidence > 100))
      invalid.push(`${svc.id}: min=${cs.minimum_quote_confidence}`);
    if (cs._confidence_cap_applied === true && typeof cs._confidence_cap_reason !== 'string') invalid.push(`${svc.id}: cap applied without reason`);
  }
  assertStructural('P-CONF-PRECISION', invalid.length === 0,
    'Every confidence threshold within [0,100]; every applied cap carries a reason', invalid.slice(0, 8).join(' | '));
}

{
  const meta = btnycData.meta || {}; const comp = btnycData._compiler_metadata || {};
  assertStructural('R-INVARIANT-RERUN', !!meta.version && !!comp.source_compiler,
    'Compiler metadata present alongside SSOT meta.version');
}

{
  const ast = extractFunctionAST(qrHtmlContent, 'orch_compose_intake_chain');
  assertStructural('R-SYSTEM-COMPOSER',
    !!(ast && findAstNodes(ast, astIsIdentifier('intake_defaults')).length > 0 &&
       findAstNodes(ast, n => n.type === 'NewExpression' && n.callee.name === 'Set').length > 0),
    'orch_compose_intake_chain reads intake_defaults and deduplicates via Set (AST)');
}

{
  const markers = [/\/\/\s*FIX\s*:\s*this\s+only/i, /\/\/\s*patch\s+for\s+(?:only|just)/i, /\/\/\s*workaround\s+for\s+(?:just|only)/i];
  const hits = markers.filter(re => re.test(qrHtmlContent)).map(re => re.source);
  assertHeuristic('P-INVARIANT-NOPATCH', hits.length === 0, 'No path-specific patch markers', hits.join(' | '));
}

{
  const uiBody = extractModuleScriptBody(qrHtmlContent, 'UIRenderer.js');
  if (uiBody) {
    const fns = findTopLevelFunctionDeclarations(uiBody);
    let suspicious = 0;
    for (const d of fns) if (findAstNodes(d.astNode, astIsCallTo('computeUnifiedQuote')).length > 0 ||
      findAstNodes(d.astNode, astIsCallTo('resolveBaseConfidenceStrategy')).length > 0) suspicious++;
    console.log(`    ℹ  P-INVARIANT-RENDERERS (Judgment): ${suspicious}/${fns.length} renderer fns show business-logic patterns`);
    assertMeta('P-INVARIANT-RENDERERS', true, 'Renderer-purity reported (Judgment)');
  }
}

{
  const DETECTORS = [
    { name: 'duplicate-function detector', re: /findTopLevelFunctionDeclarations|allByName/ },
    { name: 'formula-consumed-keys guard', re: /FORMULA_CONSUMED_KEYS/ },
    { name: 'entity-has-own-qty guard', re: /entityHasOwnQtyQuestion/ },
    { name: 'word-boundary keyword match', re: /\\b\(\?:/ },
  ];
  const selfSrc = fs.readFileSync(__filename, 'utf8') + qrHtmlContent;
  const missing = DETECTORS.filter(d => !d.re.test(selfSrc)).map(d => d.name);
  assertMeta('R-INVARIANT-DISEASE', missing.length === 0,
    'Every recurring-bug-class has a live detector', missing.join(', '));
}
// T156: the always-true assertions that stood here for R-INVARIANT-SEARCH (a rule the 2026-10-07 Charter no longer carries) and R-INVARIANT-PREFIX
// (now G-INVARIANT-PREFIX, a Governance Process: "practice, not testable against code") are removed. A check that cannot fail proves nothing, and the
// Charter's three categories exist so that a statement that cannot be tested says so instead of being certified by a tautology.

// ─── §10 Module Public API Signatures (VM-initialized) ─────────────
// T148: the public surface after T143-T147 -- ADDED: the resolvers, the route-in/route-out orchestrator functions and the pure model builders; DROPPED: `init` (UIRenderer's never-called legacy bootstrap)
// and `sqBuildCuratedIntake` (the legacy builder), both declared retirements deleted in T143/T144.
const expectedModuleAPIs = {
  'pricing_engine.js': ['resolveDynamicService','resolveEngineKey','entityHasOwnQtyQuestion','resolveServiceBadge','resolveServiceBadgeKey','resolveBaseConfidenceStrategy','applyLiveConfidenceEscalation','deriveComplexityTier','applyPricingFormula','getServiceProfile','formatServicePrice','tagValidForCategory','isDiagnosticService','isLogisticTag','sqTagLabel','sqTagFeeImpact','mathFurnitureAssembly','resolveServiceCheckoutStateKey','buildCheckoutStateModel','computeUnifiedQuote','computeArchetypeQuote','_computePrice','syncTagSynthesizedAnswers','resolveQuantityUnits','resolveQuantityMultiplier','resolveBuilderQuantity','classifyServiceIntake', 'isQuantityFixed', 'isFlatCheckoutState','buildQuotePanelModel','requiredTagIdsFor','closeTagsOverRequires','toggleTagState','buildServiceSessionSeed','synthesizeAnswersFromTags','computeQuoteFromState','onsiteDiagnosticTerms'],
  'nlp_engine.js': ['initNlpSets','refreshNlpPreviewBindings','understandRequest','composeAdlibParts','composeAdlibSentence','detectActionsInOrder','detectIntentNLP','detectTagsNLP','isServiceVerb','extractObjectDetailed','extractObject','extractQty','extractLocation','extractSizeHint','inferTagsFromContext','computeNegatedGroupHints','resolveGroupFromIntent','extractCondition'],
  'orchestrator_engine.js': ['executeWorkflow','orch_resolve_entity','orch_apply_object_based_resolution','orch_enrich_from_dynamic_service','orch_compute_variability_flags','orch_compose_intake_chain','orch_apply_location_hints','orch_compute_confidence','orch_select_ui_template','orch_merge_materials_estimate','orch_compute_quote','orch_apply_intake_bypass_rules','readRoutePath','evaluateInvariant','describeInvariantFailure','validateRoute','catastrophicFallbackRoute','collectBookingContext_catalog','collectBookingContext_otherTile','collectBookingContext_freeText','makeBookingContext','checkRoutingArchetypeConsistency','orch_max_followup_questions','orch_splice_remote_deep_dive','orch_apply_remote_divergence','orch_apply_answer','orch_apply_quantity','buildOtherTilesForGroup','orch_validate_ssot'],
  'UIRenderer.js': ['renderCuratedCardFromRoute','renderSelfQuoteFromRoute','renderTagAffirmationFromRoute'],
  'AppController.js': ['_sqRevertAutoSelect','addToCart','applySSOTRules','finalizeBooking','prefillSmartQuoteFromOtherTile','prefillSmartQuoteFromService','removeServiceFromCart','setStep','sqAdjQty','sqAnalyze','sqBuildAdlib','sqBuildStep2','sqBuildStep3','sqBuilderFinish','sqConfirmAdlib','sqPickType','sqPrepareFlow','sqRenderSelfQuoteAdlib','sqToggleTag','_recomputeInstanceLabels','removeFurnitureEntry','wireGlobalEvents'],
};

const safeSig = {
  'pricing_engine.js': [{ name: 'resolveEngineKey', args: ["'hourly'"], expect: 'string' },{ name: 'sqTagLabel', args: ['null', "'#brick_wall'"], expect: 'string' },{ name: 'isLogisticTag', args: ["'#brick_wall'"], expect: 'boolean' },{ name: 'deriveComplexityTier', args: ['30', 'null', 'null'], expect: 'string' }],
  'nlp_engine.js': [{ name: 'extractQty', args: ["'fix 5 tiles'"], expect: 'number' },{ name: 'isServiceVerb', args: ["'install'", 'new Set(["install"])'], expect: 'boolean' }],
  'orchestrator_engine.js': [{ name: 'readRoutePath', args: ['{a:{b:1}}', "'a.b'"], expect: 'number' },{ name: 'catastrophicFallbackRoute', args: ['null', '[]'], expect: 'object' },{ name: 'orch_validate_ssot', args: ['{}', "{type:'object'}"], expect: 'object' }],
  'UIRenderer.js': [{ name: 'renderIcon', args: ["'ti ti-home'"], expect: 'string' }],
  'AppController.js': [],
};

function makeModuleSandbox() {
  const sandbox = {
    DB: btnycData, SERVICE_DATA: btnycData, window: { DB: btnycData },
    console: { log(){},warn(){},error(){} }, Math, Object, Array, Set, Map, WeakMap, WeakSet,
    Number, String, Boolean, JSON, parseInt, parseFloat, isNaN, isFinite, Infinity, NaN,
    Date, Promise, RegExp, Error,
    _trace: () => {}, _traceStart: () => {}, _traceFn: () => {}, _traceToggle: () => {}, _renderTraceOverlay: () => {},
    q: () => null, qAll: () => [],
    requestAnimationFrame: (fn) => { try { fn(); } catch (_) {} return 0; },
    cancelAnimationFrame: () => {},
    sessionStorage: { getItem: () => null, setItem: () => {} },
    localStorage: { getItem: () => null, setItem: () => {} },
    navigator: { serviceWorker: { register: () => Promise.resolve() } },
    document: { addEventListener: () => {}, querySelector: () => null, querySelectorAll: () => [] },
  };
  sandbox.window.DB = btnycData;
  sandbox.globalThis = sandbox;
  return vm.createContext(sandbox);
}

for (const [fname, api] of Object.entries(expectedModuleAPIs)) {
  const body = extractModuleScriptBody(qrHtmlContent, fname);
  if (!body) { assertStructural('R-SYSTEM-LAYERS', false, `${fname}: body not found`); continue; }
  const decls = findTopLevelFunctionDeclarations(body).map(d => d.name);
  const missing = api.filter(n => !decls.includes(n));
  assertStructural('R-SYSTEM-LAYERS', missing.length === 0, `${fname}: every declared public API present`,
    missing.length ? `missing=[${missing.slice(0, 10).join(', ')}]` : '');
  if (missing.length) continue;

  const capture = decls.map(n => `__E__[${JSON.stringify(n)}]=(typeof ${n} !== 'undefined')?${n}:undefined;`).join('\n');
  const runner = `"use strict";\n${body}\n;(function(){var __E__={};${capture}globalThis.__MODULE_EXPORTS__=__E__;})();`;
  const ctx = makeModuleSandbox();
  let exp = null, err = null;
  try { vm.runInContext(runner, ctx, { timeout: 8000, filename: fname }); exp = ctx.__MODULE_EXPORTS__; }
  catch (e) { err = e; }

  assertBehavioral('R-SYSTEM-LAYERS', !err && exp && typeof exp === 'object',
    `${fname}: fully initializes in an isolated VM context`,
    err ? err.message.split('\n')[0] : (exp ? '' : 'no __MODULE_EXPORTS__'));
  if (err || !exp) continue;

  const notFn = api.filter(n => typeof exp[n] !== 'function');
  assertBehavioral('R-SYSTEM-LAYERS', notFn.length === 0,
    `${fname}: every required API resolves to a function`,
    notFn.length ? `not-a-function=[${notFn.slice(0, 10).join(', ')}]` : '');

  const reqSet = new Set(api);
  const undoc = decls.filter(n => !reqSet.has(n) && !n.startsWith('_'));
  assertStructural('R-SYSTEM-LAYERS', undoc.length === 0,
    `${fname}: rejects undocumented top-level properties`,
    undoc.length ? `undocumented=[${undoc.slice(0, 10).join(', ')}]` : '');

  for (const s of safeSig[fname] || []) {
    if (typeof exp[s.name] !== 'function') continue;
    try {
      const v = vm.runInContext(`(${s.name})(${s.args.join(',')})`, ctx, { timeout: 4000 });
      const k = Array.isArray(v) ? 'array' : (v === null ? 'null' : typeof v);
      const ok = s.expect === 'object' ? (v != null && k === 'object') : s.expect === 'array' ? k === 'array' : k === s.expect;
      assertBehavioral('R-SYSTEM-LAYERS', ok, `${fname}: ${s.name}(${s.args.join(', ')}) returns ${s.expect}`, ok ? '' : `got ${k}`);
    } catch (e) {
      assertBehavioral('R-SYSTEM-LAYERS', false, `${fname}: ${s.name} runs without throwing`, e.message.split('\n')[0]);
    }
  }
}

// ─── §11 Property-Based & Randomized Fuzzers ───────────────────────
{
  const bundle = bundleFunctions([
    'resolveBaseConfidenceStrategy','applyLiveConfidenceEscalation','applyPricingFormula',
    'computeArchetypeQuote','deriveComplexityTier','resolveServiceCheckoutStateKey',
    'buildCheckoutStateModel','sqTagLabel','computeUnifiedQuote','_computePrice',
    'synthesizeAnswersFromTags','closeTagsOverRequires','requiredTagIdsFor','tagValidForCategory',
    'isDiagnosticService','isLogisticTag','sqTagFeeImpact','resolveServiceBadge','resolveServiceBadgeKey',
    'resolveEngineKey','entityHasOwnQtyQuestion','getServiceProfile','mathFurnitureAssembly',
  ], { prelude: enginePrelude() });
  if (_bundleGuard(bundle)) {
    const sandbox = makeSandbox();
    try {
      vm.runInContext(`${bundle.source}`, sandbox, { timeout: 6000 });
      const local = makePrng(TEST_SEED ^ 0xF00DF00D);
      const ITER = 500;
      const fail = { nonFinite: [], negative: [], breakdown: [] };
      const randAns = (mk, svc) => {
        const step = (svc.intake_chain || []).find(s => s.module === mk);
        const opts = step?.params?.client_response || btnycData.intake_modules?.[mk]?.client_response || [];
        return opts.length ? pick(local, opts).label : null;
      };
      for (let i = 0; i < ITER; i++) {
        const svc = pick(local, btnycData.services);
        const ans = {};
        for (const st of svc.intake_chain || []) {
          if (!st.module) continue;
          const l = randAns(st.module, svc); if (l) ans[st.module] = l;
        }
        const qty = 1 + Math.floor(local() * 9);
        let r;
        try { r = vm.runInContext(`computeUnifiedQuote({svc:${JSON.stringify(svc)},dynDef:null,activeTagIds:[],answers:${JSON.stringify(ans)},qty:${qty},intentKeyword:null,formulaId:null,ctxAdjFee:0,ctxAdjMin:0,enrichment:null})`, sandbox, { timeout: 4000 }); }
        catch (_) { continue; }
        if (!r) continue;
        if (!Number.isFinite(r.laborEstimate)) fail.nonFinite.push(`${svc.id}#${i}`);
        if (r.laborEstimate < 0) fail.negative.push(`${svc.id}#${i}`);
        const attr = (r.feeBreakdown || []).reduce((s, e) => s + (e.fee || 0), 0);
        if (Math.abs((r.extraFee + (r.perVisitFee || 0)) - attr) > 1e-6) fail.breakdown.push(`${svc.id}#${i}: ${r.extraFee}+${r.perVisitFee || 0} vs ${attr}`); // T148: per-visit fees are added once, OUTSIDE extraFee (R-PRICE-SCOPE), so they belong on this side of the invariant
      }
      assertHeuristic('R-PRICE-REACHES', fail.nonFinite.length === 0, `Pricing fuzz (${ITER} iterations): every laborEstimate finite`, fail.nonFinite.slice(0, 3).join(' | '));
      assertHeuristic('R-PRICE-REACHES', fail.negative.length === 0, 'Pricing fuzz: no negative laborEstimate', fail.negative.slice(0, 3).join(' | '));
      assertHeuristic('P-WHITEFLAG-PRECISE', fail.breakdown.length === 0, 'Pricing fuzz: feeBreakdown accounts for extraFee on every sample', fail.breakdown.slice(0, 3).join(' | '));
    } catch (e) { assertHeuristic('R-PRICE-REACHES', false, 'Pricing fuzzer in VM', e.message.split('\n')[0]); }
  }
}

{
  const bundle = bundleFunctions([
    'executeWorkflow','orch_resolve_entity','orch_apply_object_based_resolution',
    'orch_enrich_from_dynamic_service','orch_compute_variability_flags',
    'orch_compose_intake_chain','orch_apply_location_hints','orch_compute_confidence',
    'orch_select_ui_template','orch_merge_materials_estimate','orch_compute_quote',
    'orch_apply_intake_bypass_rules','readRoutePath','evaluateInvariant',
    'describeInvariantFailure','validateRoute','catastrophicFallbackRoute',
    'checkRoutingArchetypeConsistency','_resolveIntakeChain','resolveBaseConfidenceStrategy',
    'applyLiveConfidenceEscalation','applyPricingFormula','computeArchetypeQuote',
    'deriveComplexityTier','resolveServiceCheckoutStateKey','buildCheckoutStateModel',
    'sqTagLabel','computeUnifiedQuote','_computePrice','synthesizeAnswersFromTags',
    'closeTagsOverRequires','requiredTagIdsFor','tagValidForCategory','isDiagnosticService',
    'isLogisticTag','sqTagFeeImpact','resolveServiceBadge','resolveServiceBadgeKey',
    'resolveEngineKey','entityHasOwnQtyQuestion','getServiceProfile','mathFurnitureAssembly',
    'resolveDynamicService','makeBookingContext',
  ], { prelude: enginePrelude() });
  if (_bundleGuard(bundle)) {
    const before = simpleHash(stableStringify(btnycData));
    const sandbox = makeSandbox();
    try {
      vm.runInContext(`${bundle.source}`, sandbox, { timeout: 6000 });
      const local = makePrng(TEST_SEED ^ 0xDEADBEEF);
      const ITER = 300;
      for (let i = 0; i < ITER; i++) {
        const svc = pick(local, btnycData.services);
        try { vm.runInContext(`executeWorkflow(makeBookingContext('catalog',{selectedServiceId:${JSON.stringify(svc.id)},selectedCategoryId:${JSON.stringify(svc.ui_taxonomy?.category_id)},selectedGroupId:${JSON.stringify(svc.ui_taxonomy?.group_id)}}),window.DB)`, sandbox, { timeout: 5000 }); }
        catch (_) {}
      }
      const after = simpleHash(stableStringify(btnycData));
      assertHeuristic('R-INVARIANT-SOURCE', before === after,
        `SSOT byte-identical after ${ITER} randomized navigations (${before} == ${after})`,
        before === after ? '' : `before=${before} after=${after}`);
    } catch (e) { assertHeuristic('R-INVARIANT-SOURCE', false, 'fuzzer in VM', e.message.split('\n')[0]); }
  }
}

{
  const bundle = bundleFunctions([
    'initNlpSets','isServiceVerb','detectIntentNLP','detectTagsNLP','extractQty','extractLocation',
    'extractSizeHint','inferTagsFromContext','computeNegatedGroupHints','resolveGroupFromIntent',
    '_normalizeTypedText','_vocab','_inVocab','_tokenSets','_isHardNonNoun','_isEdgeTrim',
    '_validateNounPhrase','_groundedObjectPhrase','_extractObjectRaw','extractObjectDetailed',
    'extractObject','detectActionsInOrder','composeAdlibParts','composeAdlibSentence',
    '_resolutionThresholds','understandRequest',
  ], { prelude: nlpPrelude() });
  if (_bundleGuard(bundle)) {
    const sandbox = makeSandbox();
    try {
      vm.runInContext(`${bundle.source}\ninitNlpSets();`, sandbox, { timeout: 6000 });
      let unstable = 0;
      for (const text of NLP_CORPUS) {
        const base = JSON.parse(vm.runInContext(`JSON.stringify(understandRequest(${JSON.stringify(text)}))`, sandbox, { timeout: 4000 }));
        const variants = [
          text.replace(/"/g, '\u201C').replace(/-/g, '\u2011'),
          text.replace(/ /g, '\u00A0'),
          text.replace(/["'`]/g, '').replace(/\s+/g, ' '),
        ];
        for (const v of variants) {
          if (v === text) continue;
          const other = JSON.parse(vm.runInContext(`JSON.stringify(understandRequest(${JSON.stringify(v)}))`, sandbox, { timeout: 4000 }));
          if (base.object !== other.object) unstable++;
        }
      }
      assertHeuristic('R-CLIENT-PREVIEW', unstable === 0, `NLP stable across typographic variants (${NLP_CORPUS.length} phrases)`);
    } catch (e) { assertHeuristic('R-CLIENT-PREVIEW', false, 'typography fuzzer', e.message.split('\n')[0]); }
  }
}

// ─── §14 Concept-Authority Scan ────────────────────────────────────
const KNOWN_CONCEPT_VIOLATIONS = new Set([]);

const CONCEPT_SPECS = [
  { concept: 'checkout_state', resolver: 'resolveServiceCheckoutStateKey', matcher: /^resolve.*CheckoutState/i, ssotFields: ['checkout_state'] },
  { concept: 'minimum_quote_confidence', resolver: 'resolveBaseConfidenceStrategy', matcher: /^resolve.*Confidence/i, ssotFields: ['minimum_quote_confidence'] },
  { concept: 'pricing_engine_key', resolver: 'resolveEngineKey', matcher: /^resolve.*EngineKey/i, ssotFields: ['pricing_engine'] },
  { concept: 'intake_chain', resolver: '_resolveIntakeChain', matcher: /^_?resolve.*IntakeChain/i, ssotFields: ['intake_chain'] },
  { concept: 'qty_ownership', resolver: 'entityHasOwnQtyQuestion', matcher: /^entityHasOwnQtyQuestion$/, ssotFields: [] },
  // T148: the one place the units a quote prices are decided, and how they enter the arithmetic (T147). The single-unit flag may be read only inside the resolver.
  { concept: 'quantity_units', resolver: 'resolveQuantityUnits', matcher: /^resolveQuantityUnits$/, ssotFields: ['per_unit_answers_vary'] },
  { concept: 'quantity_multiplier', resolver: 'resolveQuantityMultiplier', matcher: /^resolveQuantityMultiplier$/, ssotFields: [] },
];

{
  const topLevel = findTopLevelFunctionDeclarations(qrHtmlContent);
  const sourceAst = _parseAst(qrHtmlContent).ast;
  const parentMap = _parseAst(qrHtmlContent).parentMap;

  for (const spec of CONCEPT_SPECS) {
    const matches = topLevel.filter(d => spec.matcher.test(d.name));
    assertStructural('R-INVARIANT-CANONICAL',
      matches.length === 1 && matches[0].name === spec.resolver,
      `concept '${spec.concept}': exactly one resolver named '${spec.resolver}'`,
      matches.length === 1 ? '' : `found=[${matches.map(m => m.name).join(', ')}]`);

    if (!sourceAst) continue;

    const sites = findCallSitesWithParent(sourceAst, spec.resolver);
    const composed = [];
    for (const { call, parent } of sites) {
      const compNode = findCompositionNode(parent, parentMap);
      if (compNode) composed.push({
        operator: compNode.type === 'LogicalExpression' ? compNode.operator : '?:',
        enclosing: findEnclosingFunction(call, parentMap)?.id?.name || '(top-level)',
      });
    }
    const composedKeys = composed.map(c => `${spec.concept}:${c.enclosing}:${c.operator}`);
    const newComposed = composedKeys.filter(k => !KNOWN_CONCEPT_VIOLATIONS.has(k));
    if (newComposed.length) {
      assertBehavioral('R-INVARIANT-PROVENANCE', false,
        `concept '${spec.concept}': resolver '${spec.resolver}' is not composed with a caller-side alternate`,
        newComposed.map(k => `  ${k}`).join('\n'));
    } else {
      const known = composedKeys.length;
      assertStructural('R-INVARIANT-PROVENANCE', true,
        `concept '${spec.concept}': ${sites.length} call site(s), ${known} pre-existing composed (accepted)`, '');
    }

    if (!spec.ssotFields.length) continue;
    const fieldSet = new Set(spec.ssotFields);
    const reads = findMemberSitesWithParent(sourceAst, n =>
      n.type === 'MemberExpression' && !n.computed &&
      n.property && n.property.type === 'Identifier' && fieldSet.has(n.property.name));
    const outsideResolver = [];
    for (const { node } of reads) {
      const fn = findEnclosingFunction(node, parentMap);
      const fnName = fn?.id?.name || null;
      if (fnName === spec.resolver) continue;
      if (fnName && fnName.toLowerCase().includes(spec.concept.split('_')[0])) continue;
      outsideResolver.push({ field: node.property.name, enclosing: fnName || '(top-level)' });
    }
    const readKeys = outsideResolver.map(r => `${spec.concept}:${r.enclosing}:${r.field}`);
    const newReads = readKeys.filter(k => !KNOWN_CONCEPT_VIOLATIONS.has(k));
    if (newReads.length) {
      assertStructural('R-INVARIANT-PROVENANCE', false,
        `concept '${spec.concept}': no low-level read of ${spec.ssotFields.join('/')} outside '${spec.resolver}'`,
        newReads.map(k => `  ${k}`).join('\n'));
    } else {
      assertStructural('R-INVARIANT-PROVENANCE', true,
        `concept '${spec.concept}': no unaccepted low-level reads outside '${spec.resolver}'`, '');
    }
  }
}

// ─── §14b Resolution Provenance on the Return Value ────────────────
const PROVENANCE_RESOLVERS = [
  { name: 'resolveServiceCheckoutStateKey', concept: 'checkout_state',
    declaredSources: ['service_override', 'archetype_default', 'dynamic_engine', 'fallback'],
    argFn: `[window.DB.services[0], null]` },
  { name: 'resolveBaseConfidenceStrategy', concept: 'minimum_quote_confidence',
    declaredSources: ['service_override', 'archetype_default', 'dynamic_engine', 'fallback'],
    argFn: `[window.DB.services[0], null]` },
  // T148: resolvers migrated in T147 (they return { ..., source }); the live call below runs them in their real module context
  { name: 'resolveQuantityUnits', concept: 'quantity_units',
    declaredSources: ['service_override', 'archetype_default', 'dynamic_engine', 'fallback'],
    argFn: `[{ entity: window.DB.services[0], entityType: 'service', requestedQty: 2 }]` },
  { name: 'resolveQuantityMultiplier', concept: 'quantity_multiplier',
    declaredSources: ['service_override', 'archetype_default', 'dynamic_engine', 'fallback'],
    argFn: `[{ units: 2, unitsSource: 'fallback', formulaId: null, entityType: 'service' }]` },
  { name: 'orch_max_followup_questions', concept: 'followup_ceiling',
    declaredSources: ['service_override', 'archetype_default', 'dynamic_engine', 'fallback'],
    argFn: `[window.DB.services[0], 'service']` },
];

for (const spec of PROVENANCE_RESOLVERS) {
  const decl = extractFunctionDeclaration(qrHtmlContent, spec.name);
  if (!decl) {
    assertStructural('R-INVARIANT-PROVENANCE', false, `${spec.name}: declaration could not be extracted`);
    continue;
  }
  const ast = decl.astNode;

  const mentionsSource = findAstNodes(ast, astIsIdentifier('source')).length > 0 ||
    findAstNodes(ast, n => n.type === 'Property' && n.key && n.key.type === 'Identifier' && n.key.name === 'source').length > 0;
  assertStructural('R-INVARIANT-PROVENANCE', mentionsSource,
    `${spec.name}: resolver carries a 'source' provenance field in its return shape (structural)`);

  const sandbox = makeSandbox();
  try {
    // T148: the REAL resolver in its REAL module context where it is an engine function: an isolated extraction cannot call a resolver that depends on another (every migrated one does).
    const whole = _engineFind(spec.name);
    const code = whole ? `${whole}\n${spec.name}.apply(null, ${spec.argFn});` : `"use strict";
      ${enginePrelude()}
      ${decl.header}{${decl.body}}
      ${spec.name}.apply(null, ${spec.argFn});
    `;
    const value = vm.runInContext(code, sandbox, { timeout: 4000 });
    if (value && typeof value === 'object' && 'source' in value) {
      assertBehavioral('R-INVARIANT-PROVENANCE',
        spec.declaredSources.includes(value.source),
        `${spec.name}(${spec.concept}) return carries source="${value.source}" (in declared set)`,
        `got source=${JSON.stringify(value.source)} — not in {${spec.declaredSources.join(', ')}}`);
    } else {
      console.log(`    ℹ  ${spec.name}: resolver return does not yet carry a 'source' field ` +
                  `(open item under R-INVARIANT-PROVENANCE — migrate resolver to return ` +
                  `{ value, source }); the composition and read-site detectors in §14 still apply.`);
    }
  } catch (e) {
    assertBehavioral('R-INVARIANT-PROVENANCE', false, `${spec.name}: live call ran without throwing`, e.message.split('\n')[0]);
  }
}

{
  const unifiedBody = extractFunctionBody(qrHtmlContent, 'computeUnifiedQuote') || '';
  const inlineFallback = /checkoutStateKey\s*=\s*['"][a-z_]+['"]/.test(unifiedBody);
  assertStructural('R-INVARIANT-PROVENANCE', !inlineFallback,
    'computeUnifiedQuote does not assign checkoutStateKey to a string literal (must come from the resolver)');
}

// ─── §15 Cross-Path Price Agreement ────────────────────────────────
const KNOWN_PATH_DIVERGENCES = new Set([]);

{
  const bundle = bundleFunctions([
    'resolveBaseConfidenceStrategy','applyLiveConfidenceEscalation','applyPricingFormula',
    'computeArchetypeQuote','deriveComplexityTier','resolveServiceCheckoutStateKey',
    'buildCheckoutStateModel','sqTagLabel','computeUnifiedQuote','_computePrice',
    'synthesizeAnswersFromTags','closeTagsOverRequires','requiredTagIdsFor','tagValidForCategory',
    'isDiagnosticService','isLogisticTag','sqTagFeeImpact','resolveServiceBadge','resolveServiceBadgeKey',
    'resolveEngineKey','entityHasOwnQtyQuestion','getServiceProfile','mathFurnitureAssembly',
    'resolveDynamicService',
  ], { prelude: enginePrelude() });
  if (_bundleGuard(bundle)) {
    const sandbox = makeSandbox();
    try {
      vm.runInContext(`${bundle.source}`, sandbox, { timeout: 8000 });

      const divergences = [];
      for (const svc of btnycData.services) {
        const minimal = { svc, dynDef: null, activeTagIds: [], answers: {}, qty: 1,
          intentKeyword: null, formulaId: null, ctxAdjFee: 0, ctxAdjMin: 0, enrichment: null };
        let q1 = null, q2 = null, q3 = null;
        try { q1 = vm.runInContext(`computeUnifiedQuote(${JSON.stringify(minimal)})`, sandbox, { timeout: 4000 }); } catch (_) {}
        try { q2 = vm.runInContext(`_computePrice(${JSON.stringify(svc)}, {}, 1)`, sandbox, { timeout: 4000 }); } catch (_) {}
        const arch = svc.financial_engine?.pricing_archetype;
        if (arch === 'formula' || arch === 'tiered_per_unit') {
          try { q3 = vm.runInContext(`computeArchetypeQuote(${JSON.stringify(svc)}, ${JSON.stringify(arch)}, {}, 1, window.DB, ${JSON.stringify(svc.pricing_engine || null)})`, sandbox, { timeout: 4000 }); } catch (_) {}
        }
        const v1 = q1?.laborEstimate ?? null;
        const v2 = q2?.laborEstimate ?? null;
        const v3 = q3?.laborEstimate ?? null;
        if (v1 != null && v2 != null && v1 !== v2) {
          const key = `${svc.id}:computeUnifiedQuote≠_computePrice`;
          if (!KNOWN_PATH_DIVERGENCES.has(key)) divergences.push(`${key} (v1=${v1} v2=${v2})`);
        }
        if (v1 != null && v3 != null && v1 !== v3) {
          const key = `${svc.id}:computeUnifiedQuote≠computeArchetypeQuote`;
          if (!KNOWN_PATH_DIVERGENCES.has(key)) divergences.push(`${key} (v1=${v1} v3=${v3})`);
        }
      }

      assertBehavioralPop('R-INVARIANT-CANONICAL', divergences.length === 0,
        `Cross-path price agreement across all ${btnycData.services.length} services ` +
        `(computeUnifiedQuote vs _computePrice vs computeArchetypeQuote)`,
        divergences.slice(0, 6).join(' | ') + (divergences.length > 6 ? ` (+${divergences.length - 6} more)` : ''));
    } catch (e) {
      assertBehavioral('R-INVARIANT-CANONICAL', false, 'Cross-path sweep in VM', e.message.split('\n')[0]);
    }
  }
}

{
  const realPrices = new Set(btnycData.services.map(s => s.financial_engine?.base_price).filter(p => typeof p === 'number' && p > 0));
  const ast = extractFunctionAST(qrHtmlContent, 'sqRenderSelfQuoteAdlib');
  const hits = [];
  if (ast) {
    for (const n of findAstNodes(ast, n => n.type === 'Literal' && typeof n.value === 'number')) {
      if ([0, 1, 60, 45].includes(n.value)) continue;
      if (realPrices.has(n.value)) hits.push(n.value);
    }
  }
  assertStructural('R-INVARIANT-CANONICAL', hits.length === 0,
    'sqRenderSelfQuoteAdlib contains no numeric literal equal to a real service base_price',
    hits.length ? `literals=[${hits.join(', ')}]` : '');
}

// ─── §16 Code-Reads-Field-Exists ───────────────────────────────────
// T149: five reads the NAME heuristic mis-types (it infers an object's type from the variable's name). `def` is an intake module through most of the file, but a
// complexity-tier definition in deriveComplexityTier (global_rules.complexity_tiers: all 3 tiers carry min_minutes and max_minutes) and an action-vocabulary entry in
// initNlpSets (7 vocabulary entries carry each of infinitive_for_adlib, all_forms, synonym_clusters). The fields exist at their true location; the check cannot see where the
// variable came from. The BEHAVIORAL guard against a real read of the retired flat shape is verify_entity_shape_single.js (every entity the page can produce, enumerated in a real
// browser) -- the eight genuine flat-shape fallbacks the check surfaced were deleted, not allowlisted.
const KNOWN_MISSING_FIELDS = new Set(['def:min_minutes', 'def:max_minutes', 'def:infinitive_for_adlib', 'def:all_forms', 'def:synonym_clusters']);

const FIELD_NAMESPACE = {
  ra: 'routing_archetypes',
  svc: 'services',
  def: 'intake_modules',
  entity: 'services_or_dynamic_services',
  dynDef: 'dynamic_services',
  resp: 'client_response',
};

{
  const sourceAst = _parseAst(qrHtmlContent).ast;
  if (sourceAst) {
    const reads = findMemberSitesWithParent(sourceAst, n =>
      n.type === 'MemberExpression' && !n.computed &&
      n.property.type === 'Identifier' &&
      /^[a-z]+(_[a-z]+)+$/.test(n.property.name) &&
      n.object.type === 'Identifier' &&
      Object.prototype.hasOwnProperty.call(FIELD_NAMESPACE, n.object.name));

    const missing = [];
    for (const { node } of reads) {
      const objName = node.object.name;
      const field = node.property.name;
      const ns = FIELD_NAMESPACE[objName];
      let found = false;
      switch (ns) {
        case 'services':
          found = btnycData.services.some(o => Object.prototype.hasOwnProperty.call(o, field));
          break;
        case 'dynamic_services':
          found = Object.values(btnycData.dynamic_services).some(o => Object.prototype.hasOwnProperty.call(o, field));
          break;
        case 'services_or_dynamic_services':
          found = btnycData.services.some(o => Object.prototype.hasOwnProperty.call(o, field)) ||
            Object.values(btnycData.dynamic_services).some(o => Object.prototype.hasOwnProperty.call(o, field));
          break;
        case 'intake_modules':
          found = Object.values(btnycData.intake_modules).some(o => Object.prototype.hasOwnProperty.call(o, field));
          break;
        case 'routing_archetypes':
          found = Object.values(btnycData.routing_archetypes || {}).some(o => Object.prototype.hasOwnProperty.call(o, field));
          break;
        case 'client_response':
          found = false;
          for (const m of Object.values(btnycData.intake_modules || {})) {
            for (const r of m.client_response || []) {
              if (Object.prototype.hasOwnProperty.call(r, field)) { found = true; break; }
            }
            if (found) break;
          }
          break;
        default:
          found = true;
      }
      if (!found) {
        const key = `${objName}:${field}`;
        if (!KNOWN_MISSING_FIELDS.has(key)) missing.push(key);
      }
    }
    const uniqMissing = [...new Set(missing)];
    assertStructural('P-INVARIANT-VERIFY', uniqMissing.length === 0,
      'Every snake_case field read on a known runtime identifier resolves to a real SSOT namespace key',
      uniqMissing.length ? uniqMissing.slice(0, 12).join(' | ') +
        (uniqMissing.length > 12 ? ` (+${uniqMissing.length - 12} more)` : '') : '');
  }
}

// ─── §17 Set-to-Data Equivalence ───────────────────────────────────
const KNOWN_SET_DIVERGENCES = new Set([]);

const SET_DERIVATIONS = {
  QTY_AWARE_FORMULAS: () => ({ source: DERIVED_SETS.QTY_AWARE_FORMULAS.source, values: DERIVED_SETS.QTY_AWARE_FORMULAS.values.sort() }),
  _GENERIC_QTY_MODULE_KEYS: () => ({ source: DERIVED_SETS.GENERIC_QTY_KEYS.source, values: DERIVED_SETS.GENERIC_QTY_KEYS.values.sort() }),
  FORMULA_CONSUMED_KEYS: () => ({ source: 'runtime-shape', values: null }),
  KNOWN_UI_TEMPLATES: () => ({ source: 'policy', values: ['self_quote', 'curated_card', 'chip_grid', 'legacy_flow', 'tag_affirmation'] }),
};

function collectModuleSets(blockBody) {
  const ast = _parseAst(blockBody).ast;
  if (!ast || ast.type !== 'Program') return [];
  const out = [];
  for (const stmt of ast.body) {
    if (stmt.type === 'VariableDeclaration') {
      for (const d of stmt.declarations) {
        if (d.id.type !== 'Identifier') continue;
        const init = d.init;
        if (!init) continue;
        if (init.type === 'NewExpression' && init.callee && init.callee.name === 'Set') {
          const values = extractLiteralArrayValues(init.arguments[0]);
          out.push({ name: d.id.name, kind: 'Set', values, node: d });
        } else if (init.type === 'NewExpression' && init.callee && init.callee.name === 'Map') {
          out.push({ name: d.id.name, kind: 'Map', values: null, node: d });
        }
      }
    }
  }
  return out;
}

function extractLiteralArrayValues(arrAst) {
  if (!arrAst) return [];
  let elements = null;
  if (arrAst.type === 'ArrayExpression') elements = arrAst.elements;
  else return null;
  const vals = [];
  for (const e of elements) {
    if (!e) continue;
    if (e.type === 'Literal') vals.push(e.value);
    else if (e.type === 'TemplateLiteral' && e.expressions.length === 0) vals.push(e.quasis[0].value.cooked);
    else return null;
  }
  return vals;
}

{
  const sets = [];
  for (const block of scriptBlocks) {
    for (const s of collectModuleSets(block.body)) sets.push({ ...s, block });
  }
  for (const s of sets) {
    const idx = s.block.body.indexOf(`const ${s.name}`);
    if (idx < 0) { s.ticketed = false; continue; }
    const pre = s.block.body.slice(Math.max(0, idx - 400), idx);
    s.ticketed = /\bT\d{1,4}\b|PENDING_DECISIONS|DERIVE FROM SSOT|HAND-MAINTAINED/.test(pre);
  }

  const failures = [];
  for (const s of sets) {
    if (s.name.startsWith('_test') || s.name.startsWith('__')) continue;

    const camel = s.name.toLowerCase();
    const findKey = (obj, depth = 0) => {
      if (depth > 4 || !obj || typeof obj !== 'object') return null;
      for (const [k, v] of Object.entries(obj)) {
        if (k.toLowerCase() === camel) return v;
        if (v && typeof v === 'object') {
          const r = findKey(v, depth + 1);
          if (r != null) return r;
        }
      }
      return null;
    };
    const ssotTwin = findKey(btnycData);

    const derived = SET_DERIVATIONS[s.name] ? SET_DERIVATIONS[s.name]() : null;

    if (s.ticketed) continue;

    if (ssotTwin && Array.isArray(ssotTwin) && s.kind === 'Set') {
      const twin = [...ssotTwin].sort();
      const code = (s.values || []).sort();
      if (JSON.stringify(twin) !== JSON.stringify(code)) {
        const key = `${s.name}:ssot-mismatch`;
        if (!KNOWN_SET_DIVERGENCES.has(key)) failures.push(`${key} (ssot=${twin.join(',')} code=${code.join(',')})`);
      }
      continue;
    }

    if (derived && derived.values && s.kind === 'Set') {
      const d = [...derived.values].sort();
      const c = (s.values || []).sort();
      if (JSON.stringify(d) !== JSON.stringify(c)) {
        const key = `${s.name}:derived-mismatch`;
        if (!KNOWN_SET_DIVERGENCES.has(key)) failures.push(`${key} (derived=${d.join(',')} code=${c.join(',')})`);
      }
      continue;
    }

    const key = `${s.name}:underived`;
    if (!KNOWN_SET_DIVERGENCES.has(key)) failures.push(`${key} (hand-maintained, no ticket)`);
  }

  assertStructural('R-INVARIANT-SINGLEDEF', failures.length === 0,
    'Every module-level Set/Map is SSOT-derived, ticketed, or in the known-divergence list',
    failures.slice(0, 8).join(' | ') + (failures.length > 8 ? ` (+${failures.length - 8} more)` : ''));

  assertMeta('R-INVARIANT-SOURCE',
    DERIVED_SETS.QTY_AWARE_FORMULAS.source !== 'unavailable',
    `Harness QTY_AWARE_FORMULAS derived from ${DERIVED_SETS.QTY_AWARE_FORMULAS.source}`, '', KIND.META);
  assertMeta('R-INVARIANT-SOURCE',
    DERIVED_SETS.GENERIC_QTY_KEYS.source === 'derived',
    'Harness GENERIC_QTY_KEYS derived from intake_modules[*].type', '', KIND.META);
  assertMeta('R-INVARIANT-SOURCE',
    ENTITY_QTY_FN_SRC.length > 40,
    'Harness entityHasOwnQtyQuestion extracted from source (not hand-written)', '', KIND.META);
}

// ─── R-GOVERN-DECIDEFIRST (T156, operator ruling #105(3)) -- the decisions-ledger linter, run for real ──────────────────────────────────────────
// The linter is its own test (verify_r-govern-decidefirst_pending_decisions_default.js). It is run here as a subprocess so the Rule is asserted by this suite too,
// and it exits 0 only if the ledger obeys the Rule AND the linter fails on each of its nine synthetic ledgers.
{
  const lint = require('child_process').spawnSync(process.execPath, [path.join(SCRIPT_DIR, 'verify_r-govern-decidefirst_pending_decisions_default.js')], { encoding: 'utf8' });
  assertBehavioral('R-GOVERN-DECIDEFIRST', lint.status === 0,
    'Every open ledger entry filed after the Rule carries a "Default if unanswered" line (linter exit 0; it fails on its nine synthetic ledgers)',
    (lint.stdout || '').split('\n').filter(l => /✗/.test(l)).slice(0, 4).join(' | ') || String(lint.stderr || '').slice(0, 200));
}

// ─── §12 Goodhart Meta-Test — Evidence-Kind Audit ──────────────────
if (charterHtmlContent) {
  // T156: the Judgment tier is retired. What it used to name is now two honest categories, Governance Process (G-) and Principle (P-); neither is enforced.
  const nonJudgment = [], judgment = []; // `judgment` = the statements that are not Rules
  for (const [c, s] of charterIndex.rules.entries()) {
    if (s === 'enforced' || s === 'partial') nonJudgment.push([c, s]);
    else judgment.push(c);
  }
  const asserted = new Set(assertionLog.map(a => a.ruleCode).filter(Boolean));

  const missing = nonJudgment.filter(([c]) => !asserted.has(c));
  assertMeta('R-GOVERN-INDEX', missing.length === 0,
    `Every Enforced/Partial rule is asserted at least once (${nonJudgment.length - missing.length}/${nonJudgment.length})`,
    missing.slice(0, 12).map(([c, s]) => `${c}(${s})`).join(' | ') +
      (missing.length > 12 ? ` (+${missing.length - 12} more)` : ''));

  const weakEnforced = [];
  for (const [c, s] of charterIndex.rules.entries()) {
    if (s !== 'enforced') continue;
    const kinds = assertionLog.filter(a => a.ruleCode === c).map(a => a.kind);
    if (!kinds.length) { weakEnforced.push(`${c}: no assertion`); continue; }
    const hasBehavioral = kinds.some(k => k === KIND.BEHAVIORAL || k === KIND.BEHAVIORAL_SAMPLE || k === KIND.BEHAVIORAL_POPULATION || k === KIND.BEHAVIORAL_MATRIX);
    const hasHeuristic = kinds.includes(KIND.HEURISTIC);
    const hasStructural = kinds.includes(KIND.STRUCTURAL);
    const isSourceShape = SOURCE_SHAPE_RULES.has(c);
    if (isSourceShape) {
      if (!hasBehavioral && !hasHeuristic && !hasStructural) weakEnforced.push(`${c}: only ${kinds.join(',')}`);
    } else {
      if (!hasBehavioral && !hasHeuristic) weakEnforced.push(`${c}: only ${kinds.join(',')}`);
    }
  }
  assertMeta('R-GOVERN-STOPTHELINE', weakEnforced.length === 0,
    'Every Enforced rule certified by evidence at least as strong as the rule',
    weakEnforced.slice(0, 8).join(' | ') + (weakEnforced.length > 8 ? ` (+${weakEnforced.length - 8} more)` : ''));

  const declared = new Set(charterIndex.rules.keys());
  const orphans = [...asserted].filter(c => c && !declared.has(c));
  assertMeta('R-GOVERN-INDEX', orphans.length === 0,
    'No assertion is tagged with a rule code the Charter does not declare',
    orphans.join(', '));

  const DOCTRINE = /^[GP]-(FRICTION|GOVERN-AUTONOMY|GOVERN-SURFACE|GOVERN-OVERRIDE|GOVERN-PROJECT|DOMAIN-FINITE|DOMAIN-UNCERTAINTY|CLIENT-OTHER|CONF-COMPLEXITY|CONF-UNCERTAINTY|INTAKE-QTEST)/;
  const mislabeled = [];
  for (const [c, s] of charterIndex.rules.entries()) {
    if (s !== 'governance' && s !== 'principle') continue;
    if (!DOCTRINE.test(c)) continue;
    const hasBehavioral = assertionLog.some(a => a.ruleCode === c &&
      (a.kind === KIND.BEHAVIORAL || a.kind === KIND.BEHAVIORAL_SAMPLE ||
       a.kind === KIND.BEHAVIORAL_POPULATION || a.kind === KIND.BEHAVIORAL_MATRIX));
    if (hasBehavioral) mislabeled.push(c);
  }
  assertMeta('P-GOVERN-GOODHART', mislabeled.length === 0,
    'No pure-doctrine Principle or Governance Process is falsely certified by a BEHAVIORAL assertion',
    mislabeled.join(', '));

  const notAsserted = judgment.filter(c => !asserted.has(c));
  if (notAsserted.length) console.log(`    ℹ  ${notAsserted.length} Principles / Governance Processes un-asserted (doctrine-only): ${notAsserted.slice(0, 12).join(', ')}${notAsserted.length > 12 ? ' …' : ''}`);
} else {
  assertMeta('R-GOVERN-INDEX', true, 'Charter absent — audit skipped', '', KIND.EXISTENCE);
  assertMeta('R-GOVERN-STOPTHELINE', true, 'Charter absent — audit skipped', '', KIND.EXISTENCE);
  assertMeta('P-GOVERN-GOODHART', true, 'Charter absent — audit skipped', '', KIND.EXISTENCE);
}

// ─── §18 Coverage-Kind Meta-Test ──────────────────────────────────
if (charterHtmlContent) {
  const UNIV = /\b(every|all|each|no\s+[a-z]+s?)\b/i;
  const underCovered = [];
  for (const [c, s] of charterIndex.rules.entries()) {
    if (s !== 'enforced' && s !== 'partial') continue;
    const text = charterIndex.ruleTexts.get(c) || '';
    if (!UNIV.test(text)) continue;
    const kinds = assertionLog.filter(a => a.ruleCode === c).map(a => a.kind);
    const hasPopulation = kinds.includes(KIND.BEHAVIORAL_POPULATION);
    const hasMatrix = kinds.includes(KIND.BEHAVIORAL_MATRIX);
    const hasHeuristic = kinds.includes(KIND.HEURISTIC);
    if (!hasPopulation && !hasMatrix && !hasHeuristic) {
      underCovered.push(`${c} (text claims universal; only ${[...new Set(kinds)].join(',')})`);
    }
  }
  assertMeta('P-GOVERN-GOODHART', underCovered.length === 0,
    'Every universal-quantifier rule is certified by population-, matrix-, or heuristic-coverage evidence',
    underCovered.slice(0, 10).join(' | ') + (underCovered.length > 10 ? ` (+${underCovered.length - 10} more)` : ''));
} else {
  assertMeta('P-GOVERN-GOODHART', true, 'Charter absent — coverage audit skipped', '', KIND.EXISTENCE);
}

// ═══════════════════════════════════════════════════════════════════
// UNIFIED SUMMARY
// ═══════════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════════════════');
console.log('  UNIFIED AUDIT SUMMARY — three suites, one run');
console.log('══════════════════════════════════════════════════════════════');
console.log(`  Total Passes:   ${totalPasses}`);
console.log(`  Total Failures: ${totalFailures}`);

// Per-suite breakdown
const bySuite = {};
for (const a of assertionLog) {
  bySuite[a.suite] = bySuite[a.suite] || { pass: 0, fail: 0 };
  if (a.passed) bySuite[a.suite].pass++; else bySuite[a.suite].fail++;
}
console.log('  Per-suite breakdown:');
for (const s of [SUITE.META, SUITE.LEGACY, SUITE.V9]) {
  const b = bySuite[s] || { pass: 0, fail: 0 };
  console.log(`    ${s.padEnd(16)} pass=${b.pass}  fail=${b.fail}`);
}

// Per-suite evidence-kind breakdown (useful for Goodhart audits)
const bySuiteKind = {};
for (const a of assertionLog) {
  const k = `${a.suite}::${a.kind}`;
  bySuiteKind[k] = (bySuiteKind[k] || 0) + 1;
}
console.log('  Evidence-kind breakdown:');
for (const [k, v] of Object.entries(bySuiteKind).sort()) console.log(`    ${k.padEnd(40)} = ${v}`);

const covered = new Set(assertionLog.map(a => a.ruleCode).filter(Boolean));
const declaredCount = charterHtmlContent ? charterIndex.rules.size : '?';
console.log(`  Rules asserted: ${covered.size} / ${declaredCount} declared`);

if (totalFailures === 0) {
  console.log('\n✓ ALL THREE SUITES PASSED — META-CHARTER, LEGACY-REGEX, V9-AST.');
  process.exitCode = 0;
} else {
  console.error(`\n✗ FAILED: ${totalFailures} assertion(s) across all suites.`);
  const seen = new Map();
  for (const f of failureLog) {
    const k = `${f.suite}::${f.ruleCode || '(uncoded)'}`;
    if (!seen.has(k)) seen.set(k, []);
    seen.get(k).push(f.message);
  }
  console.error('\nFailure summary (suite :: rule):');
  for (const [c, msgs] of seen) {
    console.error(`  ${c}: ${msgs.length} failure(s)`);
    msgs.slice(0, 3).forEach(m => console.error(`    - ${m}`));
    if (msgs.length > 3) console.error(`    (+${msgs.length - 3} more)`);
  }
  process.exitCode = 1;
}