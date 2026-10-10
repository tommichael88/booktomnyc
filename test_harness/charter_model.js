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
 * T158: THE CHARTER'S SHAPE CHANGED AGAIN (the 2026-10-08 revision), and this file follows it. What changed, in the Charter's own words (R-GOVERN-INDEX):
 *   "The index below is a directory, not a status ledger ... The Charter does not author enforcement status."  A Rule is just a Rule (no Enforced / Partial);
 *   how completely a mechanism covers it is recorded by the PROJECTION layer (the harness), where it may be active, partial, incomplete or absent without changing
 *   the Rule's normative force.  Its 2026-10-09 amendment also "removed mandatory Rule/Principle pairing", so the directory's SERVES / SERVED BY columns are read (pairing()) and
 *   REPORTED, never asserted -- even though R-GOVERN-INDEX still carries a stale "Pairing invariant" paragraph (see pairing() for the contradiction, filed with the operator).
 *   So this model has no enforcement status and no pairing check.
 *
 * THE MODEL.
 *   definitions : every <span class="rule-code"> that DEFINES a code -- one that carries an id ("rule-R-X" / "principle-P-X") or has a <span class="rule-status"> beside it.
 *                 The category is the code's prefix (R- Rule, G- Governance Process, P- Principle); `status` holds that category. A rule-code span that does neither is a
 *                 REFERENCE written as a definition (the markup slip behind PENDING_DECISIONS #100) and is reported in `referenceSpans`, not counted.
 *   index       : the DIRECTORY tables (`table.directory`, three of them: Rules -> Serves, Principles -> Served by, Governance Processes -> Home):
 *                 code, section (title), category (the prefix), table (which directory the row is in), serves[] (Rules table) / servedBy[] (Principles table) -- the codes
 *                 linked in the third column -- futureRule, note.
 *   ids/anchors : every id in the document, every in-page href="#...".
 *   defectClasses : every <span class="defect-class"> name.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require(path.join(__dirname, 'node_modules', 'jsdom'));

const CODE_RE = /^([RGP])-([A-Z]+)-([A-Z0-9-]+)$/;
// The domains the Charter's codes use. Adding a domain is a deliberate Charter change, so the meta-test lists them.
const DOMAINS = ['GOVERN', 'CLIENT', 'DOMAIN', 'CONF', 'FRICTION', 'INTAKE', 'WHITEFLAG', 'PRICE', 'SYSTEM', 'INVARIANT', 'COMPLEX', 'RESOLUTION'];
const CATEGORY_BY_PREFIX = { R: 'rule', G: 'governance', P: 'principle' };
const STATUSES = ['rule', 'governance', 'principle'];

// The category a <span class="rule-status"> names (its second class), or null when `el` is not a status span.
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
    const siblingStatus = statusOf(sib);
    if (span.id || siblingStatus) {
      const holder = span.closest('h1,h2,h3,.callout,li,p,div') || span.parentElement;
      definitions.push({ code, status: CATEGORY_BY_PREFIX[code[0]] || 'unknown', siblingStatus, id: span.id || null, text: (holder ? holder.textContent : '').replace(/\s+/g, ' ').trim() });
    } else {
      referenceSpans.push({ code, context: (span.parentElement ? span.parentElement.textContent : '').replace(/\s+/g, ' ').trim().slice(0, 140) });
    }
  }

  // The directories: code | title | Serves (Rules) / Served by (Principles) / Home (Governance Processes).
  const index = new Map();
  const indexDuplicates = [];
  const directoryTables = [...doc.querySelectorAll('table.directory')];
  for (const table of directoryTables) {
    // Which directory this is, from its third column's header: Serves (Rules), Served by (Principles), Home (Governance Processes).
    const third3 = ([...table.querySelectorAll('th')][2] || { textContent: '' }).textContent.trim().toLowerCase();
    const kind = third3 === 'serves' ? 'rule' : third3 === 'served by' ? 'principle' : third3 === 'home' ? 'governance' : 'unknown';
    for (const tr of table.querySelectorAll('tr')) {
      const tds = [...tr.querySelectorAll('td')];
      const codeEl = tds[0] && tds[0].querySelector('code');
      if (!codeEl) continue;
      const code = codeEl.textContent.trim();
      if (!CODE_RE.test(code)) continue;
      const third = tds[2] ? tds[2] : null;
      const linked = third ? [...third.querySelectorAll('a code')].map(c => c.textContent.trim()).filter(c => CODE_RE.test(c)) : [];
      const thirdText = third ? third.textContent.replace(/\s+/g, ' ').trim() : '';
      const row = {
        code, section: tds[1] ? tds[1].textContent.replace(/\s+/g, ' ').trim() : '', status: CATEGORY_BY_PREFIX[code[0]], table: kind,
        serves: kind === 'rule' ? linked : [], servedBy: kind === 'principle' ? linked : [], futureRule: /future rule/i.test(thirdText), note: thirdText,
      };
      if (index.has(code)) indexDuplicates.push(code); else index.set(code, row);
    }
  }

  const ids = new Set([...doc.querySelectorAll('[id]')].map(e => e.id));
  const anchors = new Set([...doc.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href').slice(1)).filter(Boolean));
  const defectClasses = new Set([...doc.querySelectorAll('span.defect-class')].map(e => e.textContent.trim()));

  // A rule's own words: the definition's holder text (heading + callout), for the "does the text claim a universal" heuristics.
  const ruleTexts = new Map();
  for (const d of definitions) if (!ruleTexts.has(d.code)) ruleTexts.set(d.code, d.text);

  return { raw, html, doc, definitions, referenceSpans, index, indexDuplicates, directoryTables: directoryTables.length, ids, anchors, defectClasses, ruleTexts };
}

function categoryOf(code) { const m = CODE_RE.exec(code); return m ? CATEGORY_BY_PREFIX[m[1]] : null; }
// The category a code's prefix names: R- Rule, G- Governance Process, P- Principle. (T158: there is no Enforced / Partial status any more.)
function prefixPermits(code, status) { return categoryOf(code) !== null && categoryOf(code) === status; }


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
  if (model.index.size < FLOORS.indexRows) E('vacuity', `NON-VACUITY: only ${model.index.size} directory rows found (floor ${FLOORS.indexRows}): the document is not being read`);
  if (model.ids.size < FLOORS.ids) E('vacuity', `NON-VACUITY: only ${model.ids.size} ids found (floor ${FLOORS.ids}): the document is not being read`);
  if (model.anchors.size < FLOORS.anchors) E('vacuity', `NON-VACUITY: only ${model.anchors.size} in-page anchors found (floor ${FLOORS.anchors}): the document is not being read`);
  if (model.directoryTables !== undefined && model.directoryTables !== 3) E('vacuity', `NON-VACUITY: ${model.directoryTables} directory tables found (the Charter has three: Rules, Principles, Governance Processes): the document shape changed or is not being read`);

  const seen = new Map();
  for (const d of model.definitions) {
    const m = CODE_RE.exec(d.code);
    if (!m) E('format', `Code out of format: ${d.code} (expected <R|G|P>-<DOMAIN>-<NAME>)`);
    else if (!DOMAINS.includes(m[2])) E('format', `Code ${d.code} uses a domain the Charter does not list (${m[2]}; known: ${DOMAINS.join(', ')})`);
    seen.set(d.code, (seen.get(d.code) || 0) + 1);
    // The status span beside a definition (when there is one) names the category; it must be the one the prefix says.
    if (d.siblingStatus && !prefixPermits(d.code, d.siblingStatus)) E('prefix', `Prefix does not match category: ${d.code} is marked "${d.siblingStatus}" (R- = rule, G- = governance, P- = principle)`);
    if (d.id && !d.id.endsWith(d.code)) E('format', `Definition id does not name its code: ${d.code} carries id="${d.id}"`);
  }
  for (const [c, n] of seen) if (n > 1) E('duplicate', `Rule defined more than once: ${c} (${n} definitions; every other mention is a reference, not a rule-code span)`);
  for (const r of model.referenceSpans) E('reference', `Reference written as a definition: <span class="rule-code">${r.code}</span> has no id and no status beside it ("${r.context.slice(0, 70)}..."): use a link or <code>`);

  // The directory and the definitions agree: same codes, no duplicate rows, each row in the directory for its own category.
  for (const c of model.indexDuplicates) E('index', `Directory lists ${c} twice`);
  const defined = new Set(model.definitions.map(d => d.code));
  const CAT_WORD = { rule: 'Rule', principle: 'Principle', governance: 'Governance Process' };
  for (const [c, row] of model.index) {
    if (!defined.has(c)) E('index', `Directory lists ${c} but no section defines it`);
    if (row.table !== 'unknown' && row.table !== row.status) E('index', `${c} is a ${CAT_WORD[row.status]} (prefix ${c[0]}-) but is listed in the ${CAT_WORD[row.table]}s directory`);
  }
  for (const c of defined) if (!model.index.has(c)) E('index', `${c} is defined but missing from the directory`);

  // Test-side evidence. The Charter does not author enforcement status (it is the projection's), so there is no "every Rule has a test" check here --
  // only that what the harness CLAIMS names something the Charter declares.
  const declared = new Set([...defined, ...model.index.keys()]);
  const declaredRules = new Set([...declared].filter(c => categoryOf(c) === 'rule'));
  for (const [c, files] of enf.tagged) {
    if (declaredRules.has(c)) continue;
    const why = declared.has(c) ? `${c} is a ${categoryOf(c) === 'principle' ? 'Principle' : 'Governance Process'}, which is not enforced by definition` : `${c} is not declared in the Charter (renamed or retired?)`;
    E('orphan', `@enforces ${c} in ${files.join(', ')}: ${why}`);
  }
  for (const [c, files] of enf.asserted) {
    if (!declared.has(c)) E('orphan', `assertion tagged ${c} in ${files.join(', ')}: ${c} is not declared in the Charter (renamed or retired?)`);
  }
  for (const [c, files] of (enf.detects || new Map())) {
    if (!model.defectClasses.has(c)) E('orphan', `@detects ${c} in ${files.join(', ')}: ${c} is not a named defect class in the Charter (a detector for an unnamed class, or a class that was renamed or retired)`);
  }
  for (const a of model.anchors) if (!model.ids.has(a)) E('anchor', `Broken internal anchor: href="#${a}" has no matching id in the Charter.`);
  return out;
}

// PAIRING -- REPORTED, NOT ASSERTED (T158). R-GOVERN-INDEX's text still carries a "Pairing invariant" paragraph ("Every Rule cites at least one Principle. Every Principle is cited by at
// least one Rule ..."), but the Charter's own amendment log for 2026-10-09 says "Removed mandatory Rule/Principle pairing and enforcement-status semantics from the Charter", and its
// Structural Layers section says "Rules and Principles are not mechanically paired ... Neither becomes more valid by acquiring a reciprocal reference." The most recent, most specific
// statement is the removal, so the audit does NOT fail on pairing; this reports the directory's Serves / Served-by columns for whoever tends them, and the contradiction is filed
// with the operator (PENDING_DECISIONS). `oneWay` = a citation one directory makes and the other does not repeat; `uncited` / `citesNone` = the old invariant's two halves.
function pairing(model) {
  const proper = x => x.table === x.status;
  const rows = [...model.index.values()].filter(proper);
  const rules = rows.filter(x => x.status === 'rule'), principles = rows.filter(x => x.status === 'principle');
  const oneWay = [];
  for (const r of rules) for (const p of r.serves) { const prow = model.index.get(p); if (prow && proper(prow) && prow.status === 'principle' && !prow.servedBy.includes(r.code)) oneWay.push(`${r.code} -> ${p} (the Rule lists the Principle; the Principle does not list the Rule)`); }
  for (const pr of principles) for (const r of pr.servedBy) { const rrow = model.index.get(r); if (rrow && proper(rrow) && rrow.status === 'rule' && !rrow.serves.includes(pr.code)) oneWay.push(`${pr.code} <- ${r} (the Principle lists the Rule; the Rule does not list the Principle)`); }
  return {
    oneWay,
    citesNone: rules.filter(r => !r.serves.some(p => categoryOf(p) === 'principle')).map(r => r.code),
    uncited: principles.filter(p => !p.servedBy.length && !p.futureRule).map(p => p.code),
  };
}

// The PROJECTION the Charter delegates enforcement status to (R-GOVERN-INDEX: "the implementation/projection layer records the enforcement mechanism for each Rule and its
// current state ... active, partial, incomplete, or absent"). Here: for every declared Rule, which harness mechanisms name it. A Rule with none is recorded as ABSENT -- a state,
// reported by every run, not a failure of the Charter audit.
function coverage(model, enf) {
  const rules = [...new Set([...model.definitions.map(d => d.code), ...model.index.keys()])].filter(c => categoryOf(c) === 'rule').sort();
  const rows = rules.map(code => {
    const slug = code.toLowerCase();
    const tests = new Set([...(enf.tagged.get(code) || []), ...(enf.asserted.get(code) || []), ...enf.files.filter(f => f.toLowerCase().includes(slug))]);
    return { code, mechanisms: [...tests].sort() };
  });
  return { rows, absent: rows.filter(r => !r.mechanisms.length).map(r => r.code) };
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

  const cloneRow = r => ({ ...r, serves: [...r.serves], servedBy: [...r.servedBy] });
  const clone = (m) => ({ ...m, definitions: m.definitions.map(d => ({ ...d })), referenceSpans: [...m.referenceSpans], index: new Map([...m.index].map(([c, r]) => [c, cloneRow(r)])), indexDuplicates: [...m.indexDuplicates], ids: new Set(m.ids), anchors: new Set(m.anchors), defectClasses: new Set(m.defectClasses) });
  const baseline = new Set(audit(model, enf).map(e => e.msg));
  const firstRule = m => [...m.index.values()].find(r => r.status === 'rule' && r.table === 'rule' && r.serves.length && m.index.get(r.serves[0]) && m.index.get(r.serves[0]).table === 'principle' && m.index.get(r.serves[0]).servedBy.includes(r.code));
  const mutants = {
    'a wrong prefix (R- on a Principle)': [m => { const d = m.definitions.find(x => x.siblingStatus === 'principle'); d.code = 'R-' + d.code.slice(2); return m; }, /Prefix does not match category/],
    'a duplicated definition': [m => { m.definitions.push({ ...m.definitions[0] }); return m; }, /defined more than once/],
    'a reference dressed as a definition': [m => { m.referenceSpans.push({ code: m.definitions[0].code, context: 'mutant' }); return m; }, /has no id and no status beside it \("mutant/],
    'an unreadable document (nothing found)': [m => { m.definitions = []; m.index = new Map(); m.ids = new Set(); m.anchors = new Set(); return m; }, /NON-VACUITY/],
    'a dangling anchor': [m => { m.anchors.add('no-such-id-anywhere'); return m; }, /no-such-id-anywhere/],
    'a directory row nothing defines': [m => { m.index.set('R-GOVERN-MUTANT', { code: 'R-GOVERN-MUTANT', section: '', status: 'rule', table: 'rule', serves: [], servedBy: [], futureRule: false, note: '' }); return m; }, /Directory lists R-GOVERN-MUTANT but no section defines it/],
    'a definition missing from the directory': [m => { const c = firstRule(m).code; m.index.delete(c); return m; }, /is defined but missing from the directory/],
    'a Rule filed in the Principles directory': [m => { firstRule(m).table = 'principle'; return m; }, /is listed in the Principles directory/],
  };
  // A mutant may also break the TEST-SIDE evidence: [modelFn, expect, enfFn]. enfFn gets a copy of the evidence and returns the broken one.
  const cloneEnf = (e) => ({ ...e, tagged: new Map(e.tagged), asserted: new Map(e.asserted), detects: new Map(e.detects || []) });
  mutants['a detector tag naming a class the Charter does not declare'] = [m => m, /is not a named defect class/, e => { e.detects.set('DEFECT-NO-SUCH-CLASS', ['verify_mutant.js']); return e; }];
  mutants['an @enforces tag naming a code the Charter does not declare'] = [m => m, /R-GOVERN-NO-SUCH-RULE is not declared in the Charter/, e => { e.tagged.set('R-GOVERN-NO-SUCH-RULE', ['verify_mutant.js']); return e; }];
  for (const [label, [fn, expect, enfFn]] of Object.entries(mutants)) {
    const fresh = audit(fn(clone(model)), enfFn ? enfFn(cloneEnf(enf)) : enf).filter(e => !baseline.has(e.msg));
    if (!fresh.some(e => expect.test(e.msg))) misses.push(`the audit does not fail on ${label}`);
  }
  return { misses, mutantCount: Object.keys(mutants).length };
}

module.exports = { loadCharter, categoryOf, prefixPermits, CODE_RE, DOMAINS, STATUSES, FLOORS, readEnforcements, audit, pairing, coverage, selfTest };
