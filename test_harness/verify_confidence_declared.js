#!/usr/bin/env node
/**
 * verify_confidence_declared.js -- R-CONF-DECLARED: a confidence gate requires authored uncertainty (T180 6/n).
 *
 * @enforces R-CONF-DECLARED
 * @enforces R-TEST-CANFAIL
 * @detects DEFECT-TEST-CANTFAIL
 *
 * THE RULE (Charter, Part VII): "A service that uses a confidence gate must explicitly declare its applicable uncertainty classes and confidence policy ... A service may not obtain confidence from a missing
 * profile, an empty default, a question count, or a nominal confidence gain. ... Accomplishment: every confidence-gated service has a non-empty, valid uncertainty profile and explicit policy; every referenced
 * class, question, qualifying option, and retirement path resolves; non-retiring fallback options do not earn retirement; the compiler rejects unreachable thresholds and missing declarations; and removing a
 * required declaration causes validation to fail rather than returning 100% confidence."
 *
 * WHAT IS HELD, on the authored source (ssot/btnyc_source.json), by a reading that does NOT call the validator (so the validator and this test cannot be wrong the same way):
 *   1. Every service and every default composition declares a gate: weighted_uncertainty (a profile) or none (and says why, with no profile). None is missing.
 *   2. Every gated one has a non-empty profile; each class resolves; each weight is a positive finite number; no class is counted twice; the weight's basis is recorded on the class (never implied).
 *   3. Every one has an explicit policy on the 0-1 scale with 0 <= diagnostic_below <= range_at <= exact_at <= 1, and a record of where each threshold came from.
 *   4. Every class a profile counts resolves to a retirement path: a question that exists, qualifying options that exist in it, none of them an "unknown" answer ("not sure" never retires), and the service
 *      asks one of those questions; and the share of its profile weight that can be retired is at least exact_at (the threshold can be met).
 *   5. THE COMPILER SIDE. The validator rejects, with the Rule's own failure, each way of removing or breaking a declaration (no gate, an empty profile, no policy, an unreachable exact_at, a "not sure"
 *      answer that retires, a counted class nothing asks about), and the derivation refuses an invalid source: it does not produce a graph in which the service has full confidence.
 *   6. NON-VACUITY. Part 1-4's reader is run on mutants of the source and finds each break; Part 5 is the mutants themselves.
 *
 * WHAT THIS DOES NOT COVER (named; filed with the confidence engine, Prompt 3 / PENDING_DECISIONS #220, #231): the RUNTIME's confidence arithmetic. The Rule's second paragraph ("one canonical confidence
 * implementation") is held by verify_confidence_convergence.js (R-CONF-ONEFORMULA); that the runtime derives scope confidence from this ledger at all is the confidence engine, not built (the runtime scores
 * intent by entry type and escalates by tag: see verify_confidence_accounting.js, which pins it).
 *
 * Node only; no browser, no network.
 */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = process.env.BTNYC_ROOT ? path.resolve(process.env.BTNYC_ROOT) : path.resolve(__dirname, '..');
process.env.BTNYC_ROOT = ROOT;
const EF = path.join(__dirname, 'tools', 'entity_first');
const lib = require(path.join(EF, 'lib.js'));
const V = require(path.join(EF, 'validate_source.js'));
const { derive, InvalidSourceError } = require(path.join(EF, 'derive_graph.js'));

let passed = 0, failed = 0;
const check = (label, ok, detail) => { if (ok) { passed++; console.log('  ✓ ' + label); } else { failed++; console.log('  ✗ ' + label + (detail ? ' -- ' + detail : '')); } };
const clone = o => JSON.parse(JSON.stringify(o));
const SRC = lib.readJson(lib.PATHS.source);

// ── the independent reader: returns the list of problems with the source's confidence declarations ─────────────────────────────────────────────────────────────────────────
function declarationProblems(src) {
  const P = [], stats = { gated: 0, none: 0, owners: 0, classes: 0, retirements: 0 };
  const questions = new Map(), classes = new Map();
  for (const q of [...src.shared_questions, ...src.entities.flatMap(e => e.questions)]) questions.set(q.id, q);
  for (const c of [...src.shared_uncertainty_classes, ...src.entities.flatMap(e => e.uncertainty_classes)]) classes.set(c.id, c);
  const optionsOf = q => q.options || (q.instance_of && questions.get(q.instance_of) && questions.get(q.instance_of).options) || null;
  const retirable = (c, chain) => (c.retired_by || []).some(r => {
    const q = questions.get(r.question_id); if (!q || !chain.has(r.question_id)) return false;
    if (r.any_value) return !optionsOf(q);
    const opts = optionsOf(q) || []; return (r.option_ids || []).some(id => { const o = opts.find(x => x.id === id); return o && o.evidence !== 'unknown'; });
  });
  for (const e of src.entities) for (const n of [...e.services, ...e.default_compositions]) {
    stats.owners++;
    const g = n.confidence_gate, prof = n.uncertainty_profile, pol = n.confidence_policy;
    if (!g || !['weighted_uncertainty', 'none'].includes(g.mode)) { P.push(n.id + ': no confidence_gate'); continue; }
    if (!pol || typeof pol !== 'object') P.push(n.id + ': no confidence_policy');
    else {
      const num = k => typeof pol[k] === 'number' && Number.isFinite(pol[k]);
      if (!(num('exact_at') && num('range_at') && num('diagnostic_below'))) P.push(n.id + ': a threshold is not a number');
      else if (!(pol.scale === '0-1' && pol.diagnostic_below >= 0 && pol.diagnostic_below <= pol.range_at && pol.range_at <= pol.exact_at && pol.exact_at <= 1 && pol.exact_at > 0)) P.push(n.id + ': thresholds are not ordered on the 0-1 scale');
      if (!pol.policy_sources || typeof pol.policy_sources !== 'object') P.push(n.id + ': no record of where the thresholds came from');
    }
    if (g.mode === 'none') {
      stats.none++;
      if (typeof g.reason !== 'string' || !g.reason) P.push(n.id + ': gate none without a reason');
      if (Array.isArray(prof) && prof.length) P.push(n.id + ': gate none but a profile');
      continue;
    }
    stats.gated++;
    if (!Array.isArray(prof) || !prof.length) { P.push(n.id + ': gated with an empty profile'); continue; }
    const chain = new Set((n.intake && n.intake.steps || []).map(s => s.question_id));
    const seen = new Set(); let total = 0, reach = 0;
    for (const p of prof) {
      const c = classes.get(p.class_id);
      if (!c) { P.push(n.id + ': ' + p.class_id + ' does not resolve to a class'); continue; }
      if (seen.has(p.class_id)) P.push(n.id + ': ' + p.class_id + ' counted twice'); seen.add(p.class_id);
      if (!(typeof p.weight === 'number' && Number.isFinite(p.weight) && p.weight > 0)) { P.push(n.id + ': ' + p.class_id + ' has no positive weight'); continue; }
      if (typeof c.weight_basis !== 'string' || !c.weight_basis) P.push(c.id + ': weight basis not recorded');
      total += p.weight;
      if (retirable(c, chain)) reach += p.weight; else P.push(n.id + ': ' + p.class_id + ' cannot be retired by anything the service asks');
    }
    if (total > 0 && pol && typeof pol.exact_at === 'number' && reach / total + 1e-9 < pol.exact_at) P.push(n.id + ': exact_at ' + pol.exact_at + ' exceeds the retirable share ' + (reach / total).toFixed(3));
  }
  for (const c of classes.values()) {
    stats.classes++;
    if (!Array.isArray(c.retired_by) || !c.retired_by.length) P.push(c.id + ': retired by nothing');
    for (const r of c.retired_by || []) {
      stats.retirements++;
      const q = questions.get(r.question_id); if (!q) { P.push(c.id + ': retirement names a question that does not exist (' + r.question_id + ')'); continue; }
      const opts = optionsOf(q) || [];
      for (const id of r.option_ids || []) { const o = opts.find(x => x.id === id); if (!o) P.push(c.id + ': qualifying option ' + id + ' does not exist in ' + q.id); else if (o.evidence === 'unknown') P.push(c.id + ': "' + id + '" is a not-sure answer and retires nothing'); }
    }
  }
  return { P, stats };
}

console.log('verify_confidence_declared.js');
console.log('\n1-4. The authored source, read without the validator');
const live = declarationProblems(SRC);
const st = live.stats;
check(`all ${st.owners} confidence owners (services and default compositions) declare a gate: ${st.gated} weighted_uncertainty, ${st.none} none (each with a reason); none is missing`, live.P.filter(p => /no confidence_gate|gate none/.test(p)).length === 0 && st.gated + st.none === st.owners && st.owners >= 150, live.P.slice(0, 3).join('; '));
check(`every gated owner has a non-empty profile whose classes resolve, with positive weights, each class's weight basis recorded (${st.classes} classes)`, !live.P.some(p => /empty profile|does not resolve to a class|counted twice|no positive weight|weight basis/.test(p)), live.P.slice(0, 3).join('; '));
check('every owner has an explicit policy on the 0-1 scale, thresholds ordered, with a record of where they came from', !live.P.some(p => /confidence_policy|threshold|thresholds|came from/.test(p)), live.P.filter(p => /polic|threshold/.test(p)).slice(0, 3).join('; '));
check(`every one of the ${st.retirements} retirement paths resolves: the question exists, the qualifying options exist in it, and none is a not-sure answer`, !live.P.some(p => /retirement names|qualifying option|not-sure|retired by nothing/.test(p)), live.P.filter(p => /retire|qualifying/.test(p)).slice(0, 3).join('; '));
check('every counted class can be retired by something the owner asks, and every exact_at can be met by the retirable share of its profile', !live.P.some(p => /cannot be retired|exceeds the retirable/.test(p)), live.P.filter(p => /cannot be retired|exceeds/.test(p)).slice(0, 3).join('; '));
check('and the whole reading is clean (zero problems)', live.P.length === 0, live.P.slice(0, 5).join('; '));

console.log('\n5. The compiler side: each way of removing or breaking a declaration is rejected, and the derivation refuses');
const ownersOf = s => s.entities.flatMap(e => [...e.services, ...e.default_compositions]);
const gatedOf = s => ownersOf(s).filter(o => o.confidence_gate && o.confidence_gate.mode === 'weighted_uncertainty' && o.uncertainty_profile.length >= 2);
const questionsOf = s => [...s.entities.flatMap(e => e.questions), ...s.shared_questions];
const classesOf = s => [...s.entities.flatMap(e => e.uncertainty_classes), ...s.shared_uncertainty_classes];
const optsOf = (s, q) => q.options || (q.instance_of ? questionsOf(s).find(x => x.id === q.instance_of).options : undefined);
const MUT = [
  ['the gate removed (absent is never certainty)', 'V-CONF-GATE-MISSING', s => { delete gatedOf(s)[0].confidence_gate; }],
  ['the profile emptied on a gated service', 'V-CONF-GATE-MISSING', s => { gatedOf(s)[0].uncertainty_profile = []; }],
  ['the policy removed', 'V-CONF-POLICY', s => { delete gatedOf(s)[0].confidence_policy; }],
  ['thresholds on another scale', 'V-CONF-THRESHOLD', s => { gatedOf(s)[0].confidence_policy.scale = '0-100'; }],
  ['a "not sure" answer made to retire a class', 'V-UNC-RETIRE-UNKNOWN', s => {
    const q = questionsOf(s).find(x => (optsOf(s, x) || []).some(o => o.evidence === 'unknown')); if (!q) throw new Error('no question with a not-sure answer');
    const o = optsOf(s, q).find(x => x.evidence === 'unknown'); const c = classesOf(s).find(x => (x.retired_by || []).some(r => r.option_ids)); c.retired_by.push({ question_id: q.id, option_ids: [o.id] }); }],
  ['a counted class nothing the service asks can retire', 'V-UNC-PROFILE-UNASKED', s => {
    const o = gatedOf(s)[0], inProfile = new Set(o.uncertainty_profile.map(p => p.class_id)); const askedQ = new Set(o.intake.steps.map(x => x.question_id));
    const c = classesOf(s).find(x => !inProfile.has(x.id) && (x.retired_by || []).length && !(x.retired_by || []).some(r => askedQ.has(r.question_id))); if (!c) throw new Error('no class to add'); o.uncertainty_profile.push({ class_id: c.id, weight: 10 }); }],
  ['an exact_at no answer set can reach', 'V-CONF-IMPOSSIBLE', s => {
    const o = gatedOf(s)[0]; const askedQ = new Set(o.intake.steps.map(x => x.question_id)); const inProfile = new Set(o.uncertainty_profile.map(p => p.class_id));
    // a heavy class the service does not ask about makes the retirable share small; exact_at stays where it was
    const c = classesOf(s).find(x => !inProfile.has(x.id) && !(x.retired_by || []).some(r => askedQ.has(r.question_id))); if (!c) throw new Error('no class to add');
    o.uncertainty_profile.push({ class_id: c.id, weight: 100000 }); o.confidence_policy.exact_at = 0.9; o.confidence_policy.range_at = Math.min(o.confidence_policy.range_at, 0.9); }],
];
check('the unmutated source has no validator errors (so a mutant fails because of its mutation)', V.validate(clone(SRC)).errors.length === 0, V.validate(clone(SRC)).errors.slice(0, 2).map(e => e.code + ' ' + e.message).join('; '));
for (const [name, code, run] of MUT) {
  const s = clone(SRC); let threw = null; try { run(s); } catch (e) { threw = e; }
  if (threw) { check('mutant "' + name + '" could be built', false, threw.message); continue; }
  const r = V.validate(s); const codes = new Set(r.errors.map(e => e.code));
  const mine = declarationProblems(s).P.length;
  check('"' + name + '": the validator rejects it with ' + code + ' (' + [...codes].join(', ') + '); the independent reader also finds ' + mine + ' problem(s)', codes.has(code) && mine > 0, [...codes].join(',') + ' / reader ' + mine);
}
{ // the derivation refuses an invalid source rather than producing a graph in which the missing declaration reads as full confidence
  const s = clone(SRC); delete gatedOf(s)[0].confidence_gate; let refused = false, other = null;
  try { derive(s); } catch (e) { if (e instanceof InvalidSourceError) refused = true; else other = e; }
  check('derive() refuses a source whose gate was removed (InvalidSourceError), instead of returning a graph', refused && !other, other ? String(other) : 'derive() returned a graph');
  const ok = (() => { try { return !!derive(clone(SRC)); } catch (e) { return String(e); } })();
  check('and derive() accepts the unmutated source (the refusal is the mutation\'s doing)', ok === true, String(ok));
}

console.log(`\n[Confidence is declared, never defaulted] ${passed} passed, ${failed} failed (of ${passed + failed} checks)`);
process.exit(failed ? 1 : 0);
