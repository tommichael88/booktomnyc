#!/usr/bin/env node
/**
 * verify_confidence_accounting.js -- R-CONF-COMPLEXITY (enforced) and R-CONF-ACCOUNTING (its runtime half measured and pinned as a known gap) (T180 6/n).
 *
 * @enforces R-CONF-COMPLEXITY
 * @enforces R-TEST-CANFAIL
 * @detects DEFECT-TEST-CANTFAIL
 *
 * R-CONF-COMPLEXITY (Charter, Part VII): "Complexity must not directly add or subtract Cx. ... Accomplishment: Holding the uncertainty ledger and threshold policy fixed while changing only a complexity
 * label leaves scope confidence unchanged; a direct complexity-to-confidence adjustment fails verification."
 *   HELD, three ways:
 *   1. By construction: the functions that produce a confidence score and its bar (resolveConfidence, applyLiveConfidenceEscalation, orch_compute_confidence, intentKeywordWeight) name no complexity input
 *      (tier, risk, batch, minutes, complexity_profile).
 *   2. By behaviour: for every service, through the production workflow, the SAME evidence with the complexity tiers redrawn (every boundary moved, so the skill tier of many services changes) gives the SAME
 *      score, bar and verdict.
 *   3. By mutant: a one-line direct adjustment (specialized work loses 15 points of confidence) is found by the behavioural check.
 *
 * R-CONF-ACCOUNTING (same Part): "Cx must be derived from the active uncertainty ledger and evidence state, using SSOT weights, rather than from question count, module count, answer order, or a fixed
 * confidence_gain increment ... Recomputing scope confidence from the active uncertainty ledger yields the same result at every call site; adding or retiring a relevant uncertainty changes the result
 * according to its declared weight."
 *   HELD NOW (asserted): no runtime code reads confidence_gain (it is not an input); the call sites agree (verify_confidence_convergence.js holds that, R-CONF-ONEFORMULA).
 *   NOT HELD (KNOWN GAP, pinned below; the confidence engine, Prompt 3 / PENDING_DECISIONS #220, #231): the runtime has no uncertainty ledger. Confidence is scored by ENTRY TYPE (a catalog tap is 100: intent,
 *   not scope) and escalated by tags; no answer retires anything. Measured: of the answers the sweep applies, none moves the score; every catalog entry scores 100 while the source declares unretired
 *   uncertainty for it. The test is NOT tagged @enforces R-CONF-ACCOUNTING: it records the Rule's violation, it does not claim to enforce it. When the engine lands, replace the pins with the Rule's
 *   own two tests (equivalent evidence through several entry mechanisms; an answer that changes no outcome retires nothing).
 *
 * Node only; no browser, no network.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.BTNYC_ROOT ? path.resolve(process.env.BTNYC_ROOT) : path.resolve(__dirname, '..');
const MODULES = ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js'];
let passed = 0, failed = 0;
const check = (label, ok, detail) => { if (ok) { passed++; console.log('  ✓ ' + label); } else { failed++; console.log('  ✗ ' + label + (detail ? ' -- ' + detail : '')); } };
const clone = o => JSON.parse(JSON.stringify(o));
const DB0 = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
const TEXT = Object.fromEntries(MODULES.map(f => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')]));

function load(db, patch) {
  const sb = { DB: db, SERVICE_DATA: db, window: { DB: db }, console: { log() {}, warn() {}, error() {} } }; sb.global = sb; vm.createContext(sb);
  for (const f of MODULES) vm.runInContext(patch && patch[f] ? patch[f](TEXT[f]) : TEXT[f], sb, { filename: f });
  return sb;
}
const routeOf = (sb, svc) => sb.executeWorkflow(sb.collectBookingContext_catalog(svc, svc.ui_taxonomy.category_id), sb.DB);
const conf = r => ({ score: r.confidence && r.confidence.score, minConf: r.confidence && r.confidence.minConf, total: r.quote && r.quote.totalConfidence, meets: r.quote && r.quote.meetsConfidenceBar });
const sameConf = (a, b) => a.score === b.score && a.minConf === b.minConf && a.total === b.total && a.meets === b.meets;
const stripComments = t => t.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
const functionBody = (t, name) => { const i = t.indexOf('function ' + name + '('); if (i < 0) return null; let d = 0, j = t.indexOf('{', i); for (let k = j; k < t.length; k++) { if (t[k] === '{') d++; else if (t[k] === '}' && --d === 0) return t.slice(i, k + 1); } return null; };

console.log('verify_confidence_accounting.js');
console.log('\n1. R-CONF-COMPLEXITY, by construction: the confidence functions name no complexity input');
{
  const CODE = Object.fromEntries(MODULES.map(f => [f, stripComments(TEXT[f])]));
  const FUNCS = ['resolveConfidence', 'applyLiveConfidenceEscalation', 'orch_compute_confidence', 'intentKeywordWeight'];
  const COMPLEXITY = /\b(complexityTier|tierKey|tierRate|risk_tier|batch_risk|complexity_profile|complexity_tiers|totalMin|totalMinutes|minutes)\b/;
  const found = FUNCS.map(n => { const f = MODULES.find(m => functionBody(CODE[m], n)); return [n, f, f ? functionBody(CODE[f], n) : null]; });
  check('all four confidence functions are found in the engine modules: ' + found.map(x => x[0] + ' (' + x[1] + ')').join(', '), found.every(x => x[2]), found.filter(x => !x[2]).map(x => x[0]).join(', '));
  const bad = found.filter(x => x[2] && COMPLEXITY.test(x[2])).map(x => x[0] + ': ' + x[2].match(COMPLEXITY)[0]);
  check('and none of them reads a complexity input', bad.length === 0, bad.join('; '));
  // T182: deriveComplexityTier is gone (the tier is no longer read from minutes, #229); computeArchetypeQuote reads global_rules.complexity_tiers for its rate, so it is the function that has a complexity input.
  check('the detector can fail: the same pattern finds a complexity input in a function that has one (computeArchetypeQuote)', COMPLEXITY.test(functionBody(CODE['pricing_engine.js'], 'computeArchetypeQuote') || ''));
}

console.log('\n2-3. R-CONF-COMPLEXITY, by behaviour: same evidence, complexity tiers redrawn');
const redrawn = (() => { const db = clone(DB0);
  // T182: the skill tier is the tier an entity DECLARES (it used to be read from the minutes, and this check redrew the minute boundaries). Redrawn now means every declared tier is routine: the skill
  // tier of every service that declared another one changes, with the evidence the same.
  for (const s of db.services) if (s.operational_metrics) s.operational_metrics.complexity_tier = 'routine';
  for (const d of Object.values(db.dynamic_services || {})) if (d.operational_metrics) d.operational_metrics.complexity_tier = 'routine';
  return db; })();
function complexitySweep(patch) {
  const a = load(clone(DB0), patch), b = load(redrawn, patch);
  const o = { services: 0, tierMoved: 0, confMoved: [], errors: [] };
  for (const s of DB0.services) {
    try {
      const sa = a.DB.services.find(x => x.id === s.id), sb2 = b.DB.services.find(x => x.id === s.id);
      const ra = routeOf(a, sa), rb = routeOf(b, sb2); o.services++;
      if (ra.quote.complexityTier !== rb.quote.complexityTier) o.tierMoved++;
      if (!sameConf(conf(ra), conf(rb))) o.confMoved.push(s.id + ': ' + JSON.stringify(conf(ra)) + ' -> ' + JSON.stringify(conf(rb)));
    } catch (e) { o.errors.push(s.id + ': ' + e.message); }
  }
  return o;
}
const live = complexitySweep(null);
check(`the sweep ran for all ${DB0.services.length} services through the production workflow, no error`, live.services === DB0.services.length && live.errors.length === 0, live.errors.slice(0, 2).join('; '));
check(`with the tiers redrawn the skill tier of ${live.tierMoved} services changed (so the check has something to catch)`, live.tierMoved >= 10, String(live.tierMoved));
check('and for every one of them the score, the bar and the verdict are identical', live.confMoved.length === 0, live.confMoved.slice(0, 3).join(' | '));
{ // 3. a direct complexity-to-confidence adjustment is found
  const mutant = { 'pricing_engine.js': t => { const from = 'const totalConfidence = confidence.score;'; if (t.split(from).length !== 2) throw new Error('mutant site not found exactly once'); return t.split(from).join("const totalConfidence = confidence.score - (complexityTier === 'specialized' ? 15 : 0);"); } };
  const m = complexitySweep(mutant);
  check(`mutant "specialized work loses 15 points of confidence" is found: ${m.confMoved.length} service(s) differ when only the tier is redrawn`, m.confMoved.length >= 1 && m.errors.length === 0, m.errors.slice(0, 2).join('; '));
}

console.log('\n4. R-CONF-ACCOUNTING, what holds now');
{
  const RUNTIME = ['qr.html', ...MODULES, ...fs.readdirSync(path.join(ROOT, 'modules')).filter(f => f.endsWith('.js')).map(f => 'modules/' + f)].filter(f => fs.existsSync(path.join(ROOT, f)));
  const users = RUNTIME.filter(f => /confidence_gain/.test(stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'))));
  check('no runtime file reads confidence_gain outside a comment (' + RUNTIME.length + ' files): it is not an input to Cx', users.length === 0, users.join(', '));
  const withGain = DB0.intake_modules ? Object.values(DB0.intake_modules).filter(m => m && m.confidence_gain !== undefined).length : 0;
  console.log('     (' + withGain + ' of ' + Object.keys(DB0.intake_modules || {}).length + ' catalog modules still carry confidence_gain: legacy metadata, read by no code path)');
  check('the detector can fail: it finds confidence_gain in a file that reads it (a synthetic one)', /confidence_gain/.test(stripComments('var x = m.confidence_gain;\n// not this one: confidence_gain')) && !/confidence_gain/.test(stripComments('// only a comment: confidence_gain')));
}

console.log('\n5. R-CONF-ACCOUNTING, what does not: KNOWN GAP (pinned), the runtime has no uncertainty ledger');
{
  const sb = load(clone(DB0), null);
  let answers = 0, scoreMoved = 0, barMoved = 0, errors = 0, services = 0, catalog100 = 0, withLedger = 0;
  // the source's declared ledger, for the comparison: how many catalog entries have unretired declared uncertainty
  const SRC = JSON.parse(fs.readFileSync(path.join(ROOT, 'ssot', 'btnyc_source.json'), 'utf8'));
  const gated = new Set(SRC.entities.flatMap(e => e.services).filter(s => s.confidence_gate && s.confidence_gate.mode === 'weighted_uncertainty' && s.uncertainty_profile.length).map(s => s.id));
  for (const s of DB0.services) {
    let r0; try { r0 = routeOf(sb, sb.DB.services.find(x => x.id === s.id)); } catch (e) { errors++; continue; }
    services++;
    if (r0.confidence.score === 100) catalog100++;
    const legacyKey = 'svc.' + s.id; if (gated.has(legacyKey)) withLedger++;
    for (const m of (r0.visibleChain || []).filter(x => !(r0.answers || {})[x.moduleKey])) for (const o of (m.client_response || []).slice(0, 4)) {
      try {
        const r1 = sb.orch_apply_answer(r0, m.moduleKey, o.label, sb.DB);
        if (!r1.entity || r1.entity.id !== s.id) continue;                 // an answer that routes the job to another service is a different entity, not a retirement
        answers++;
        if (r1.confidence.score !== r0.confidence.score) scoreMoved++;
        if (r1.confidence.minConf !== r0.confidence.minConf) barMoved++;
      } catch (e) { errors++; }
    }
  }
  check(`the sweep applied ${answers} answers across ${services} services through the production workflow (no error: ${errors})`, answers > 400 && services === DB0.services.length && errors === 0, `${answers} answers, ${services} services, ${errors} errors`);
  check(`KNOWN GAP (pinned, #231 / confidence engine): ${scoreMoved} of ${answers} answers moved the confidence score. Retiring uncertainty does not raise Cx, because nothing in the runtime keeps a ledger to retire`, scoreMoved === 0, String(scoreMoved));
  console.log('     (' + barMoved + ' of those answers moved the BAR (minConf); a tag an answer implies could escalate it, and that is tag policy, not retirement)');
  check(`KNOWN GAP (pinned): ${catalog100} of ${services} catalog entries score 100 ("a direct tap is certain"), while the source declares a non-empty uncertainty profile for ${withLedger} of them. 100 here scores intent, not scope (Rule: "does not erase scope uncertainty")`, catalog100 === services && withLedger >= 70, `${catalog100}/${services}; ledger ${withLedger}`);
}

console.log(`\n[Confidence: complexity never moves it; the ledger is the engine's work] ${passed} passed, ${failed} failed (of ${passed + failed} checks)`);
process.exit(failed ? 1 : 0);
