#!/usr/bin/env node
/**
 * verify_charter_rules.js -- the meta-test for the Charter's own code system (R-GOVERN-INDEX).
 *
 * @enforces R-GOVERN-INDEX, R-INVARIANT-ANCHOR
 *
 * Reads PROJECT_CHARTER.html through charter_model.js (a real HTML parser; see that file for why a pattern match is not allowed here)
 * and runs its `audit`, against the Charter as the 2026-10-08 revision shaped it: three categories by prefix (Rule R-, Governance Process G-, Principle P-), NO enforcement status
 * ("The Charter does not author enforcement status"), and a directory that pairs Rules with the Principles they serve.
 *
 *   0. NON-VACUITY. The document is visible (floors on definitions, directory rows, ids, anchors, and the three directory tables); it reads the same from the original and
 *      from the canonical serialization; and the audit provably FAILS on ten deliberately broken copies of the model. A check that cannot fail proves nothing.
 *   1. Every code matches <R|G|P>-<DOMAIN>-<NAME>, DOMAIN in the Charter's list; a definition's id names its code.
 *   2. Every code is DEFINED once (a rule-code span with an id, or with its status span beside it). A rule-code span with neither is a reference dressed as a definition
 *      (the markup slip behind PENDING_DECISIONS #100) and fails.
 *   3. The prefix matches the category the status span names.
 *   4. The directory and the definitions agree: same codes, each row in the directory for its own category, no duplicate rows.
 *   5. Every `@enforces` tag and every tagged assertion names a declared code, and `@enforces` names a Rule: a Principle or a Governance Process is not enforced by definition,
 *      and an undeclared code is an orphan (what a renamed or retired code looks like). Every `@detects` names a defect class the Charter declares.
 *   6. Every in-page anchor resolves to an id.
 *
 * PAIRING IS REPORTED, NOT ASSERTED (T158). The Charter's 2026-10-09 amendment "removed mandatory Rule/Principle pairing", and its Structural Layers section says Rules and Principles "are not
 * mechanically paired" -- while R-GOVERN-INDEX still carries a "Pairing invariant" paragraph that requires it. The Charter contradicts itself; the harness follows the latest, most specific
 * statement (the removal), prints the directory's one-way citations for whoever tends them, and the contradiction is filed with the operator (PENDING_DECISIONS).
 *
 * WHAT THIS NO LONGER CHECKS (T158). "Every Enforced or Partial Rule has a mechanical enforcement" belonged to R-GOVERN-STOPTHELINE, which the Charter no longer contains, and the
 * Charter no longer says which Rules are Enforced. Whether a mechanism covers a Rule is the PROJECTION's to record (active / partial / incomplete / absent, with no change to the
 * Rule's normative force); this test prints that projection (charter_model.coverage) and does not fail on an absent mechanism. PENDING_DECISIONS holds the question of whether it should.
 *
 * Exit: 0 = all checks pass; 1 = any violation. Runs under run_all.sh's verify_*.js glob.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { loadCharter, readEnforcements, audit, pairing, coverage, selfTest } = require('./charter_model.js');

const TEST_DIR = __dirname;
const CHARTER_PATH = path.join(path.resolve(TEST_DIR, '..'), 'PROJECT_CHARTER.html');
if (!fs.existsSync(CHARTER_PATH)) { console.error(`✗ Charter not found: ${CHARTER_PATH}`); process.exit(1); }

const model = loadCharter(CHARTER_PATH);
const enf = readEnforcements(TEST_DIR);
const problems = audit(model, enf);
const self = selfTest(model, enf, CHARTER_PATH);

const byCategory = { rule: 0, governance: 0, principle: 0 };
for (const row of model.index.values()) byCategory[row.status] = (byCategory[row.status] || 0) + 1;
const projection = coverage(model, enf);
const pairingReport = pairing(model);
console.log('');
console.log(`Charter statements in the directory: ${model.index.size}  (Rules ${byCategory.rule}; Governance Processes ${byCategory.governance}; Principles ${byCategory.principle})`);
console.log(`Definitions found: ${model.definitions.length}; reference spans: ${model.referenceSpans.length}; ids: ${model.ids.size}; in-page anchors: ${model.anchors.size}; defect classes: ${model.defectClasses.size}`);
console.log(`Projection (not an assertion): ${projection.rows.length - projection.absent.length} of ${projection.rows.length} Rules name a mechanism in test_harness/ (an @enforces tag, a tagged assertion, or a file named for the code); ABSENT: ${projection.absent.join(', ') || 'none'}`);
console.log(`Pairing (reported, not asserted): ${pairingReport.oneWay.length} one-way directory citation(s); ${pairingReport.citesNone.length} Rule(s) cite no Principle; ${pairingReport.uncited.length} Principle(s) are cited by no Rule`);
console.log(`Evidence read: ${enf.tagged.size} rule codes carry @enforces, ${enf.asserted.size} are asserted by tagged assertions, across ${enf.files.length} verify_ files`);

if (self.misses.length) {
  console.log('');
  console.log(`✗ The meta-test failed its own non-vacuity checks (${self.misses.length}):`);
  self.misses.forEach(e => console.log('  ✗ ' + e));
} else {
  console.log(`✓ Non-vacuity: the document reads the same from both serializations, and the audit fails on ${self.mutantCount} deliberately broken copies.`);
}
if (problems.length === 0 && self.misses.length === 0) {
  console.log('✓ Every statement has a well-formed code, one definition, a prefix that matches its category, and a directory row that agrees.');
  console.log('✓ Every @enforces / assertion / @detects tag names something the Charter declares.');
  console.log('✓ Every internal anchor resolves.');
  process.exit(0);
}
console.log('');
console.log(`Problems (${problems.length}):`);
problems.forEach((p, i) => console.log(`  ${i + 1}. [${p.kind}] ${p.msg}`));
console.log('');
process.exit(1);
