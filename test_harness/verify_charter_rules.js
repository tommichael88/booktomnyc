#!/usr/bin/env node
/**
 * verify_charter_rules.js -- the meta-test for the Charter's own code system (R-GOVERN-INDEX, R-GOVERN-STOPTHELINE).
 *
 * @enforces R-GOVERN-INDEX, R-GOVERN-STOPTHELINE, R-INVARIANT-ANCHOR
 * @detects DEFECT-SILENT-SKIP
 *
 * Reads PROJECT_CHARTER.html through charter_model.js (a real HTML parser; see that file for why a pattern match is not allowed here)
 * and runs its `audit`, against the three-category taxonomy the 2026-10-07 revision introduced (Rule R-, Governance Process G-, Principle P-):
 *
 *   0. NON-VACUITY. The document is visible (floors on definitions, index rows, ids, anchors); it reads the same from the original and
 *      from the canonical serialization; and the audit provably FAILS on six deliberately broken copies of the model. A check that cannot
 *      fail proves nothing.
 *   1. Every code matches <R|G|P>-<DOMAIN>-<NAME>, DOMAIN in the Charter's list.
 *   2. Every rule is DEFINED once (a rule-code span followed by its status span). A rule-code span with no status beside it is a
 *      reference dressed as a definition (the markup slip behind PENDING_DECISIONS #100) and fails.
 *   3. The prefix matches the category: R- is Enforced or Partial, G- is a Governance Process, P- is a Principle.
 *   4. The Rule and Principle Index and the definitions agree: same codes, same category, no duplicate rows.
 *   5. Every Enforced or Partial Rule has a mechanical enforcement in test_harness/: a file whose name contains the lowercased code,
 *      a test carrying `@enforces <code>`, or an assertion tagged with the code (assertRule('<code>', ...), which is how the unified
 *      suite certifies a rule). R-GOVERN-STOPTHELINE: a rule declared Enforced lands with its test.
 *   6. Every `@enforces` tag and every tagged assertion names a declared code, and `@enforces` names a Rule: a Principle or a Governance
 *      Process is not enforced by definition, and an undeclared code is an orphan (what a renamed or retired code looks like).
 *   7. Every in-page anchor resolves to an id.
 *
 * Exit: 0 = all checks pass; 1 = any violation. Runs under run_all.sh's verify_*.js glob.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { loadCharter, readEnforcements, audit, selfTest } = require('./charter_model.js');

const TEST_DIR = __dirname;
const CHARTER_PATH = path.join(path.resolve(TEST_DIR, '..'), 'PROJECT_CHARTER.html');
if (!fs.existsSync(CHARTER_PATH)) { console.error(`✗ Charter not found: ${CHARTER_PATH}`); process.exit(1); }

const model = loadCharter(CHARTER_PATH);
const enf = readEnforcements(TEST_DIR);
const problems = audit(model, enf);
const self = selfTest(model, enf, CHARTER_PATH);

const byStatus = { enforced: 0, partial: 0, governance: 0, principle: 0 };
for (const row of model.index.values()) byStatus[row.status] = (byStatus[row.status] || 0) + 1;
console.log('');
console.log(`Charter statements indexed: ${model.index.size}  (Rules: enforced ${byStatus.enforced}, partial ${byStatus.partial}; Governance Processes: ${byStatus.governance}; Principles: ${byStatus.principle})`);
console.log(`Definitions found: ${model.definitions.length}; reference spans: ${model.referenceSpans.length}; ids: ${model.ids.size}; in-page anchors: ${model.anchors.size}; defect classes: ${model.defectClasses.size}`);
console.log(`Enforcement evidence: ${enf.tagged.size} rule codes carry @enforces, ${enf.asserted.size} are asserted by tagged assertions, across ${enf.files.length} verify_ files`);

if (self.misses.length) {
  console.log('');
  console.log(`✗ The meta-test failed its own non-vacuity checks (${self.misses.length}):`);
  self.misses.forEach(e => console.log('  ✗ ' + e));
} else {
  console.log(`✓ Non-vacuity: the document reads the same from both serializations, and the audit fails on ${self.mutantCount} deliberately broken copies.`);
}
if (problems.length === 0 && self.misses.length === 0) {
  console.log('✓ Every statement has a well-formed code, one definition, a prefix that matches its category, and an index row that agrees.');
  console.log('✓ Every Enforced or Partial Rule has an enforcement in test_harness/; every tag names a declared code.');
  console.log('✓ Every internal anchor resolves.');
  process.exit(0);
}
console.log('');
console.log(`Problems (${problems.length}):`);
problems.forEach((p, i) => console.log(`  ${i + 1}. [${p.kind}] ${p.msg}`));
console.log('');
process.exit(1);
