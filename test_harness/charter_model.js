/**
 * charter_model.js -- the ONE reader of PROJECT_CHARTER.html for the test harness.
 *
 * WHY THIS EXISTS (T156). The Charter is edited and re-exported by the operator's own tooling, and the 2026-10-07 revision
 * arrived minified: unquoted attributes (`class=rule-code`), optional tags omitted (`<td>` with no `</td>`, `<tr>` with no `</tr>`),
 * and `<!doctypehtml>`. Every harness reader of the Charter was a regular expression written against the previous serialization
 * (`<span class="rule-code">`), so against the new file each of them found ZERO rules, ZERO anchors, ZERO ids and ZERO defect classes,
 * and reported PASS: six checks that had been red turned green because the document had become invisible to them. A check that
 * cannot fail proves nothing (R-INVARIANT-PREFIX); a reader that silently sees nothing is DEFECT-SILENT-SKIP.
 *
 * So the reading is done by a real HTML parser (jsdom, already a harness dependency), never by pattern-matching the text, and every
 * consumer gets the same model (R-INVARIANT-SINGLEDEF). `html` is the document re-serialized in the canonical, fully-quoted,
 * fully-closed form, so a consumer that still needs raw HTML for a legacy regex gets the shape it was written for.
 *
 * THE MODEL.
 *   definitions : every <span class="rule-code"> that is followed by a sibling <span class="rule-status ...">  (that pair is how the
 *                 Charter DEFINES a rule: heading or callout). A rule-code span with no status sibling is a REFERENCE written as a
 *                 definition (the markup slip behind PENDING_DECISIONS #100) and is reported in `referenceSpans`, not counted.
 *   index       : the rows of the Rule and Principle Index table (`#rule-index`): code, section, category status, note.
 *   category    : by prefix. R- Rule (Enforced | Partial), G- Governance Process, P- Principle (the three categories of R-GOVERN-INDEX).
 *   ids/anchors : every id in the document, every in-page href="#...".
 *   defectClasses : every <span class="defect-class"> name.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require(path.join(__dirname, 'node_modules', 'jsdom'));

const CODE_RE = /^([RGP])-([A-Z]+)-([A-Z0-9-]+)$/;
// The domains the Charter's codes use. Adding a domain is a deliberate Charter change, so the meta-test lists them.
const DOMAINS = ['GOVERN', 'CLIENT', 'DOMAIN', 'CONF', 'FRICTION', 'INTAKE', 'WHITEFLAG', 'PRICE', 'SYSTEM', 'INVARIANT'];
const CATEGORY_BY_PREFIX = { R: 'rule', G: 'governance', P: 'principle' };
const STATUSES = ['enforced', 'partial', 'governance', 'principle'];

function statusOf(el) {
  if (!el || !el.classList || !el.classList.contains('rule-status')) return null;
  for (const c of el.classList) if (STATUSES.includes(c)) return c;
  return 'unknown';
}

function loadCharter(charterPath) {
  const raw = fs.readFileSync(charterPath, 'utf8');
  const doc = new JSDOM(raw).window.document;
  const html = '<!DOCTYPE html>' + doc.documentElement.outerHTML;

  const definitions = [];
  const referenceSpans = [];
  for (const span of doc.querySelectorAll('span.rule-code')) {
    const code = span.textContent.trim();
    const sib = span.nextElementSibling;
    const status = statusOf(sib);
    if (status) {
      const holder = span.closest('h1,h2,h3,.callout') || span.parentElement;
      definitions.push({ code, status, text: (holder ? holder.textContent : '').replace(/\s+/g, ' ').trim() });
    } else {
      referenceSpans.push({ code, context: (span.parentElement ? span.parentElement.textContent : '').replace(/\s+/g, ' ').trim().slice(0, 140) });
    }
  }

  const index = new Map();
  const indexDuplicates = [];
  const indexRoot = doc.getElementById('rule-index') || doc;
  for (const tr of indexRoot.querySelectorAll('tr')) {
    const codeEl = tr.querySelector('td code');
    const st = tr.querySelector('td .rule-status');
    if (!codeEl || !st) continue;
    const code = codeEl.textContent.trim();
    if (!CODE_RE.test(code)) continue;
    const cells = [...tr.querySelectorAll('td')].map(td => td.textContent.replace(/\s+/g, ' ').trim());
    const row = { code, section: cells[1] || '', status: statusOf(st), note: cells[3] || '' };
    if (index.has(code)) indexDuplicates.push(code); else index.set(code, row);
  }

  const ids = new Set([...doc.querySelectorAll('[id]')].map(e => e.id));
  const anchors = new Set([...doc.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href').slice(1)).filter(Boolean));
  const defectClasses = new Set([...doc.querySelectorAll('span.defect-class')].map(e => e.textContent.trim()));

  // A rule's own words: the definition's holder text (heading + callout), for the "does the text claim a universal" heuristics.
  const ruleTexts = new Map();
  for (const d of definitions) if (!ruleTexts.has(d.code)) ruleTexts.set(d.code, d.text);

  return { raw, html, doc, definitions, referenceSpans, index, indexDuplicates, ids, anchors, defectClasses, ruleTexts };
}

function categoryOf(code) { const m = CODE_RE.exec(code); return m ? CATEGORY_BY_PREFIX[m[1]] : null; }
// The status a code's prefix permits: R- is Enforced or Partial, G- is Governance Process, P- is Principle.
function prefixPermits(code, status) {
  const cat = categoryOf(code);
  if (cat === 'rule') return status === 'enforced' || status === 'partial';
  if (cat === 'governance') return status === 'governance';
  if (cat === 'principle') return status === 'principle';
  return false;
}


// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// THE AUDIT. One definition, used by verify_charter_rules.js and by the unified suite's META-CHARTER section (R-INVARIANT-SINGLEDEF).
// A pure function of the model and the enforcement map, so it can be run on deliberately broken copies (see selfTest).
// Each problem is {kind, msg}; kinds: vacuity | format | duplicate | reference | prefix | index | enforcement | orphan | anchor.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const FLOORS = { definitions: 60, indexRows: 60, ids: 40, anchors: 10 };

// Which tests claim to enforce which codes: `@enforces <codes>` in a test's header, and assertions tagged with a code (assertRule('<code>', ...)),
// which is how the unified suite certifies a rule and how its own META-CHARTER has always counted coverage.
function readEnforcements(testDir) {
  const files = fs.readdirSync(testDir).filter(f => f.startsWith('verify_'));
  const tagged = new Map(), asserted = new Map(), detects = new Map();
  const add = (m, code, f) => { if (!m.has(code)) m.set(code, []); if (!m.get(code).includes(f)) m.get(code).push(f); };
  for (const f of files) {
    const content = fs.readFileSync(path.join(testDir, f), 'utf8');
    // `@detects DEFECT-X[, DEFECT-Y]` -- the file is a DETECTOR for a named defect class (a different claim from `@enforces`, which names a Rule).
    for (const m of content.matchAll(/@detects[ \t]+([^\n]*)/g)) {
      for (const tok of m[1].split(/[\s,]+/).filter(Boolean)) {
        if (!/^DEFECT-[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(tok)) break;
        add(detects, tok, f);
      }
    }
    for (const m of content.matchAll(/@enforces[ \t]+([^\n]*)/g)) {
      for (const tok of m[1].split(/[\s,]+/).filter(Boolean)) {
        if (!CODE_RE.test(tok)) break; // the tag's code list ends at the first non-code word
        add(tagged, tok, f);
      }
    }
    for (const m of content.matchAll(/assert(?:Rule|Behavioral|BehavioralPop|BehavioralMatrix|Structural|Meta|Heuristic|Existence|Invariant|DeepEqual)\s*\(\s*['"]([RGP]-[A-Z0-9-]+)['"]/g)) add(asserted, m[1], f);
  }
  return { files, tagged, asserted, detects };
}

function audit(model, enf) {
  const out = [];
  const E = (kind, msg) => out.push({ kind, msg });
  const size = x => (x.length !== undefined ? x.length : x.size);
  if (size(model.definitions) < FLOORS.definitions) E('vacuity', `NON-VACUITY: only ${size(model.definitions)} rule definitions found (floor ${FLOORS.definitions}): the document is not being read`);
  if (model.index.size < FLOORS.indexRows) E('vacuity', `NON-VACUITY: only ${model.index.size} index rows found (floor ${FLOORS.indexRows}): the document is not being read`);
  if (model.ids.size < FLOORS.ids) E('vacuity', `NON-VACUITY: only ${model.ids.size} ids found (floor ${FLOORS.ids}): the document is not being read`);
  if (model.anchors.size < FLOORS.anchors) E('vacuity', `NON-VACUITY: only ${model.anchors.size} in-page anchors found (floor ${FLOORS.anchors}): the document is not being read`);

  const seen = new Map();
  for (const d of model.definitions) {
    const m = CODE_RE.exec(d.code);
    if (!m) E('format', `Code out of format: ${d.code} (expected <R|G|P>-<DOMAIN>-<NAME>)`);
    else if (!DOMAINS.includes(m[2])) E('format', `Code ${d.code} uses a domain the Charter does not list (${m[2]}; known: ${DOMAINS.join(', ')})`);
    seen.set(d.code, (seen.get(d.code) || 0) + 1);
    if (!prefixPermits(d.code, d.status)) E('prefix', `Prefix does not match category: ${d.code} is marked "${d.status}" (R- = enforced|partial, G- = governance, P- = principle)`);
  }
  for (const [c, n] of seen) if (n > 1) E('duplicate', `Rule defined more than once: ${c} (${n} definitions; every other mention is a reference, not a rule-code span)`);
  for (const r of model.referenceSpans) E('reference', `Reference written as a definition: <span class="rule-code">${r.code}</span> has no status beside it ("${r.context.slice(0, 70)}..."): use a link or <code>`);

  for (const c of model.indexDuplicates) E('index', `Index lists ${c} twice`);
  const defStatus = new Map(model.definitions.map(d => [d.code, d.status]));
  for (const [c, row] of model.index) {
    if (!prefixPermits(c, row.status)) E('prefix', `Index prefix does not match category: ${c} is listed as "${row.status}"`);
    if (!defStatus.has(c)) E('index', `Index lists ${c} but no section defines it`);
    else if (defStatus.get(c) !== row.status) E('index', `Index and definition disagree on ${c}: index says "${row.status}", the section says "${defStatus.get(c)}"`);
  }
  for (const c of defStatus.keys()) if (!model.index.has(c)) E('index', `${c} is defined but missing from the index`);

  const declaredRules = new Set([...model.index.keys()].filter(c => categoryOf(c) === 'rule'));
  for (const [c, row] of model.index) {
    if (categoryOf(c) !== 'rule' || (row.status !== 'enforced' && row.status !== 'partial')) continue;
    const slug = c.toLowerCase();
    if (!enf.files.some(f => f.toLowerCase().includes(slug)) && !enf.tagged.has(c) && !enf.asserted.has(c)) {
      E('enforcement', `NO ENFORCEMENT: ${c} (${row.status}) -- no test file named for it, no "@enforces ${c}", no assertion tagged ${c}`);
    }
  }
  for (const [c, files] of enf.tagged) {
    if (declaredRules.has(c)) continue;
    const why = model.index.has(c) ? `${c} is a ${categoryOf(c) === 'principle' ? 'Principle' : 'Governance Process'}, which is not enforced by definition` : `${c} is not declared in the Charter (renamed or retired?)`;
    E('orphan', `@enforces ${c} in ${files.join(', ')}: ${why}`);
  }
  for (const [c, files] of enf.asserted) {
    if (!model.index.has(c)) E('orphan', `assertion tagged ${c} in ${files.join(', ')}: ${c} is not declared in the Charter (renamed or retired?)`);
  }
  for (const [c, files] of (enf.detects || new Map())) {
    if (!model.defectClasses.has(c)) E('orphan', `@detects ${c} in ${files.join(', ')}: ${c} is not a named defect class in the Charter (a detector for an unnamed class, or a class that was renamed or retired)`);
  }
  for (const a of model.anchors) if (!model.ids.has(a)) E('anchor', `Broken internal anchor: href="#${a}" has no matching id in the Charter.`);
  return out;
}

// A check that cannot fail proves nothing: run the audit on deliberately broken copies of the real model and require that each one is caught
// by a problem the real model does not already have. Returns the list of mutants the audit FAILED to catch (empty = the audit has teeth).
function selfTest(model, enf, charterPath) {
  const misses = [];
  const tmp = path.join(__dirname, 'RESULTS', '_charter_canonical.html');
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  fs.writeFileSync(tmp, model.html);
  try {
    const again = loadCharter(tmp);
    const a = [...model.index.keys()].sort().join(','), b = [...again.index.keys()].sort().join(',');
    if (a !== b || model.definitions.length !== again.definitions.length) misses.push('the model differs between the original and the canonical serialization of the Charter');
  } finally { try { fs.unlinkSync(tmp); } catch (_) {} }

  const clone = (m) => ({ ...m, definitions: m.definitions.map(d => ({ ...d })), referenceSpans: [...m.referenceSpans], index: new Map(m.index), indexDuplicates: [...m.indexDuplicates], ids: new Set(m.ids), anchors: new Set(m.anchors) });
  const baseline = new Set(audit(model, enf).map(e => e.msg));
  const mutants = {
    'a wrong prefix (R- on a Principle)': [m => { const d = m.definitions.find(x => x.status === 'principle'); d.code = 'R-' + d.code.slice(2); return m; }, /Prefix does not match category/],
    'a duplicated definition': [m => { m.definitions.push({ ...m.definitions[0] }); return m; }, /defined more than once/],
    'a reference dressed as a definition': [m => { m.referenceSpans.push({ code: m.definitions[0].code, context: 'mutant' }); return m; }, /has no status beside it \("mutant/],
    'an unreadable document (nothing found)': [m => { m.definitions = []; m.index = new Map(); m.ids = new Set(); m.anchors = new Set(); return m; }, /NON-VACUITY/],
    'a dangling anchor': [m => { m.anchors.add('no-such-id-anywhere'); return m; }, /no-such-id-anywhere/],
    'a Rule declared Enforced with no test': [m => { m.index.set('R-GOVERN-MUTANT', { code: 'R-GOVERN-MUTANT', section: '', status: 'enforced', note: '' }); m.definitions.push({ code: 'R-GOVERN-MUTANT', status: 'enforced', text: '' }); return m; }, /NO ENFORCEMENT: R-GOVERN-MUTANT/],
  };
  // A mutant may also break the TEST-SIDE evidence: [modelFn, expect, enfFn]. enfFn gets a copy of the evidence and returns the broken one.
  const cloneEnf = (e) => ({ ...e, tagged: new Map(e.tagged), asserted: new Map(e.asserted), detects: new Map(e.detects || []) });
  mutants['a detector tag naming a class the Charter does not declare'] = [m => m, /is not a named defect class/, e => { e.detects.set('DEFECT-NO-SUCH-CLASS', ['verify_mutant.js']); return e; }];
  for (const [label, [fn, expect, enfFn]] of Object.entries(mutants)) {
    const fresh = audit(fn(clone(model)), enfFn ? enfFn(cloneEnf(enf)) : enf).filter(e => !baseline.has(e.msg));
    if (!fresh.some(e => expect.test(e.msg))) misses.push(`the audit does not fail on ${label}`);
  }
  return { misses, mutantCount: Object.keys(mutants).length };
}

module.exports = { loadCharter, categoryOf, prefixPermits, CODE_RE, DOMAINS, STATUSES, FLOORS, readEnforcements, audit, selfTest };
