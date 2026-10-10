#!/usr/bin/env node
/**
 * @enforces R-INVARIANT-CANONICAL
 * @enforces R-INTAKE-QTYONCE
 * verify_r-invariant-provenance_caller_composition.js
 *
 * @enforces R-INVARIANT-PROVENANCE
 * Detector for the named defect class DEFECT-ARBITRATION (Charter, Part X), owning invariants R-INVARIANT-PROVENANCE, R-INVARIANT-CANONICAL,
 * R-INVARIANT-DUPLICATION-TICKET, R-INVARIANT-NOPATCH.
 *
 * THE CLAIM (Charter): "A resolution's source travels on the return value. ... A caller that composes a resolver's return with a second source -- a `||` chain,
 * an `??` chain, a whitelist that selects between pre-computed candidates, or an inline re-derivation of the same concept -- has reintroduced arbitration outside
 * the resolver." A canonical resolver is only canonical if it is the last step.
 *
 * MEASURED BY WHAT THE RULE CLAIMS (R-GOVERN-GOODHART). The claim has two halves, so the test has two kinds of measurement:
 *   1. SOURCE SHAPE, because the defect IS a source shape: an AST walk of every function in qr.html finds each place a resolver's value (a direct call, or a
 *      variable assigned from one) is an operand of `||`, `??` or a `?:` that selects between it and another non-literal source.
 *        - STRICT resolvers (already migrated to a provenance record) may be composed NOWHERE. The retired arbiters of their concept may be referenced only inside them.
 *        - LEGACY resolvers are frozen at today's count: a NEW composition fails, and the frozen list may only shrink (the debt is visible, not hidden).
 *        - Non-vacuity: the three headline instances the operator's audit named MUST be found, or this detector is not seeing the class.
 *   2. BEHAVIOUR, because "source travels on the return value" is a runtime fact: every migrated resolver is called for EVERY service and dynamic service, and the
 *      record it returns must carry a source from the Charter's vocabulary that matches where the data says the value came from.
 * Scope limit, stated: variable tracing is within one function PLUS one hop through a direct call: a resolver's result passed as an argument to a named function taints that
 * function's parameter (T158: the operator extracted the guided builder's escalation block into a helper that took the strategy as a parameter -- since deleted, T161 -- and without the hop two
 * frozen compositions simply vanished from the count while still existing in the source -- relocation read as migration). A value passed further than that is not seen. Inline re-derivation of the same
 * concept with no resolver call (a second implementation) is DEFECT-DUPLICATE-REGISTRY / R-INVARIANT-DUPLICATION-TICKET territory and has its own detectors.
 */
'use strict';
const fs = require('fs'); const path = require('path'); const vm = require('vm');
const Q = require('./_qr_blocks.js'); const { check, finish } = require('./_shared.js');
const ROOT = path.resolve(__dirname, '..');
const VOCAB = ['service_override', 'archetype_default', 'dynamic_engine', 'fallback', 'answer_override']; // the Charter's vocabulary for a resolution's source (T151: + answer_override, per the operator's ruling on #107)

// ---- the registry of resolvers (explicit and auditable; a name pattern finds the rest) ------------------------------------------------------------------------------
const STRICT = new Set(['resolveQuantityUnits', 'resolveQuantityMultiplier', 'orch_max_followup_questions', 'resolveServiceCheckoutStateKey']); // migrated: return {.., source}; composed nowhere (T150: + the checkout-state resolver)
const EXTRA = ['resolveBaseConfidenceStrategy', 'applyLiveConfidenceEscalation', 'computeArchetypeQuote', 'applyPricingFormula']; // resolve a concept but are not named resolve*
const NAME_PATTERN = /^(orch_)?resolve[A-Z_]/;

const { html, blocks } = Q.loadQr(process.env.QR_HTML_UNDER_TEST);
const asts = []; for (const b of blocks) { const r = Q.tryParseJs(b.src, b.startLine); if (r.ast) asts.push({ ast: r.ast, startLine: b.startLine }); }
const declared = new Set(); asts.forEach(({ ast }) => Q.walkAst(ast, n => { if (n.type === 'FunctionDeclaration' && n.id) declared.add(n.id.name); }));
const RESOLVERS = new Set([...declared].filter(n => NAME_PATTERN.test(n) || STRICT.has(n) || EXTRA.includes(n)));
check(`the resolver registry is real: ${RESOLVERS.size} resolvers found in qr.html, and every STRICT one is declared`, RESOLVERS.size >= 10 && [...STRICT].every(n => declared.has(n)), { expected: '>= 10 and all STRICT declared', got: { n: RESOLVERS.size, missing: [...STRICT].filter(n => !declared.has(n)) } });

// ---- the AST detector ---------------------------------------------------------------------------------------------------------------------------------------------
const isFnNode = n => n && (n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression');
const calleeName = n => (n && n.type === 'CallExpression' && n.callee.type === 'Identifier') ? n.callee.name : null;
function root(e) { // peel a value expression down to the thing it ultimately reads
    for (;;) { if (!e) return {}; if (e.type === 'AwaitExpression') e = e.argument; else if (e.type === 'ChainExpression') e = e.expression; else if (e.type === 'MemberExpression') e = e.object;
        else if (e.type === 'CallExpression' && e.callee.type === 'MemberExpression') e = e.callee.object; else break; }
    if (e.type === 'CallExpression') return { call: calleeName(e) }; if (e.type === 'Identifier') return { name: e.name }; return {};
}
const compositions = []; // { fn, resolver, op, line }
const SEEDS = new Map(); // T158 one-hop: callee name -> Map(parameter index -> resolver whose result the caller passes in)
let FINAL = false, SEEDS_GREW = false; // pass 1 only discovers the seeds; pass 2 records the compositions
function analyze(fnNode, fnName, startLine) {
    const traced = new Map(); // variable -> resolver it was assigned from, within this function (and, via SEEDS, its parameters)
    const bind = (pat, resolver) => { if (!pat) return; if (pat.type === 'Identifier') traced.set(pat.name, resolver); else if (pat.type === 'ObjectPattern') pat.properties.forEach(p => bind(p.value || p.argument, resolver)); else if (pat.type === 'ArrayPattern') pat.elements.forEach(el => bind(el, resolver)); };
    if (SEEDS.has(fnName)) SEEDS.get(fnName).forEach((res, i) => bind(fnNode.params[i], res));
    Q.walkAst(fnNode.body, (n, _p, _g, fns) => { if (fns.length) return;
        if (n.type === 'VariableDeclarator' && n.init) { const r = root(n.init); if (r.call && RESOLVERS.has(r.call)) bind(n.id, r.call); }
        if (n.type === 'AssignmentExpression' && n.operator === '=') { const r = root(n.right); if (r.call && RESOLVERS.has(r.call)) bind(n.left, r.call); } });
    const derived = e => { const r = root(e); if (r.call && RESOLVERS.has(r.call)) return r.call; if (r.name && traced.has(r.name)) return traced.get(r.name); return null; };
    Q.walkAst(fnNode.body, (n, _p, _g, fns) => { if (fns.length || n.type !== 'CallExpression' || n.callee.type !== 'Identifier' || RESOLVERS.has(n.callee.name)) return;
        n.arguments.forEach((a, i) => { const res = derived(a); if (!res) return; const m = SEEDS.get(n.callee.name) || new Map(); if (m.get(i) !== res) { m.set(i, res); SEEDS.set(n.callee.name, m); SEEDS_GREW = true; } }); });
    const isLit = e => e && (e.type === 'Literal' || (e.type === 'TemplateLiteral' && !e.expressions.length));
    const flatten = (e, op) => (e.type === 'LogicalExpression' && e.operator === op) ? [...flatten(e.left, op), ...flatten(e.right, op)] : [e];
    Q.walkAst(fnNode.body, (n, parent, _g, fns) => { if (fns.length) return; const line = startLine + n.loc.start.line - 1;
        if (n.type === 'LogicalExpression' && (n.operator === '||' || n.operator === '??') && !(parent && parent.type === 'LogicalExpression' && parent.operator === n.operator)) {
            const ops = flatten(n, n.operator), hit = ops.map(derived).find(Boolean); if (FINAL && hit && ops.length >= 2) compositions.push({ fn: fnName, resolver: hit, op: n.operator, line }); }
        if (n.type === 'ConditionalExpression') { const a = derived(n.consequent), b = derived(n.alternate); if (a && a === b) return; const hit = a || b; const other = a ? n.alternate : n.consequent; if (FINAL && hit && !isLit(other)) compositions.push({ fn: fnName, resolver: hit, op: '?:', line }); } });
}
const refs = []; // references to retired arbiters: { name, fn, line }
const ARBITERS = { entityHasOwnQtyQuestion: new Set(['resolveQuantityUnits']), QTY_AWARE_FORMULAS: new Set(['resolveQuantityMultiplier']) }; // may be read only inside these
function runPass() { asts.forEach(({ ast, startLine }) => {
    Q.walkAst(ast, (n, parent, _g, fns) => {
        const named = fns.filter(f => f.type === 'FunctionDeclaration' && f.id).map(f => f.id.name);
        if (isFnNode(n) && n.body && n.body.type === 'BlockStatement') { const nm = n.type === 'FunctionDeclaration' && n.id ? n.id.name : (named[named.length - 1] || '(anonymous)'); if (n.type === 'FunctionDeclaration' || !named.length) analyze(n, nm, startLine); }
        if (n.type === 'Identifier' && Object.prototype.hasOwnProperty.call(ARBITERS, n.name) && !(parent && ((parent.type === 'FunctionDeclaration' && parent.id === n) || (parent.type === 'VariableDeclarator' && parent.id === n) || (parent.type === 'MemberExpression' && parent.property === n && !parent.computed) || (parent.type === 'Property' && parent.key === n && !parent.computed))))
            FINAL && refs.push({ name: n.name, fn: named[0] || '(module)', line: startLine + n.loc.start.line - 1 });
    });
});}
for (let i = 0; i < 4; i++) { SEEDS_GREW = false; runPass(); if (!SEEDS_GREW) break; }   // discovery passes until no new parameter is tainted (bounded: one hop is the stated scope)
FINAL = true; runPass();
const keyOf = c => `${c.fn} | ${c.resolver} | ${c.op}`; const counts = {}; compositions.forEach(c => { counts[keyOf(c)] = (counts[keyOf(c)] || 0) + 1; });

// 1a. STRICT resolvers are composed nowhere
const strictHits = compositions.filter(c => STRICT.has(c.resolver));
check('no caller composes a MIGRATED resolver\'s return with a second source (`||`, `??`, or a `?:` between sources) -- the resolver is the last step', strictHits.length === 0, { expected: 0, got: strictHits.map(c => `${c.fn} L${c.line} ${c.resolver} ${c.op}`) });
// 1b. the retired arbiters are read only inside their resolver
const stray = refs.filter(r => !ARBITERS[r.name].has(r.fn));
check('the retired quantity arbiters (entityHasOwnQtyQuestion, QTY_AWARE_FORMULAS) are referenced ONLY inside the resolver that owns the decision', stray.length === 0, { expected: 0, got: stray.map(r => `${r.name} in ${r.fn} L${r.line}`) });
// 1c. canaries: the detector must still SEE the shapes the operator's audit named. Two of the original headline instances remain in the source and are seen as they are; the other
// two (the minimum-quote-confidence chain in orch_compute_confidence, the archetype-result `??` in computeUnifiedQuote) were deleted in T155 (A2b: their second sources were
// unreachable), so "the detector saw them once" no longer proves it still CAN. For each deleted one, inject a composition of exactly that kind into a synthetic function and
// require the detector to flag it, then discard it so the frozen counts are untouched (the T150 method).
// T159 (item B) / T161 (item D): the guided builder's strategy chain (a resolveBaseConfidenceStrategy result composed with `||`) is no longer a headline instance the detector can see:
// sqPrepareFlow stopped calling its private escalation helper in T159 (the builder now asks resolveSessionConfidence) and T161 deleted the helper. The shape it carried is covered by
// the INJECTED probe below, the same way T155 A2b handled the sites it deleted.
const CANARY = ['executeWorkflow | orch_resolve_entity | ||'];
check('non-vacuity: the detector SEES the headline instance that remains in the source (the entity chain in executeWorkflow)', CANARY.every(k => counts[k] >= 1), { expected: 'present', got: CANARY.filter(k => !counts[k]) });
{ const probes = [
    ['probeConfidenceChain', 'function probeConfidenceChain(e) { const s = resolveBaseConfidenceStrategy(e, null); const m = s.minimum_quote_confidence || 80; return m; }', 'resolveBaseConfidenceStrategy', '||'],
    ['probeArchetypeResult', 'function probeArchetypeResult(e) { const r = computeArchetypeQuote(e, "formula", {}, 1, DB, null); let l = 0; l = r.laborEstimate ?? l; return l; }', 'computeArchetypeQuote', '??'],
    ['probeCheckoutChain', 'function probeCheckoutChain(svc) { const k = resolveServiceCheckoutStateKey(svc, null).key || "standard_flat_rate"; return k; }', 'resolveServiceCheckoutStateKey', '||'],
  ];
  for (const [fnName, src, resolver, op] of probes) { const probe = Q.tryParseJs(src, 1); const fnNode = probe.ast && probe.ast.body.find(n => n.type === 'FunctionDeclaration'); const before = compositions.length;
    if (fnNode) analyze(fnNode, fnName, 1); const injected = compositions.slice(before); compositions.length = before;
    check(`non-vacuity: an INJECTED ${resolver} \`${op}\` composition (a kind that has been deleted from the source) is flagged by the detector`, injected.some(c => c.resolver === resolver && c.op === op), { expected: 'one flagged composition', got: injected }); } }
// 1d. LEGACY resolvers: frozen; may only shrink
const LEGACY = {
    "executeWorkflow | orch_resolve_entity | ||": 4,
    "orch_resolve_entity | resolveDynamicService | ||": 1,
    "prefillSmartQuoteFromOtherTile | resolveDynamicService | ??": 1,
    "prefillSmartQuoteFromOtherTile | resolveDynamicService | ||": 1,
    "orch_enrich_from_dynamic_service | resolveDynamicService | ||": 1, // T158: first SEEN by the one-hop trace (the entity arrives as a parameter); present in the source before it, frozen at the count found
    "orch_compute_quote | orch_resolve_entity | ||": 1  // T158: same
}; // T159 (item B) / T161 (item D): two entries left. "sqPrepareFlow | resolveDynamicService | ||" (1) was in the confidence_gain loop (`...?.intake_chain || []`), deleted with the loop (T159). The guided
// builder's private escalation helper held two `|| 0` compositions of resolveBaseConfidenceStrategy; sqPrepareFlow stopped calling it in T159 (the trace could no longer reach them) and the function
// was deleted in T161, so the two sites no longer exist. They were NOT migrated: they were removed with the second implementation they belonged to (verify_single_escalation_path.js holds that class).
// FROZEN T147 (T150: the four checkout-state entries are gone -- that resolver is STRICT now; T155 A2b: the six computeUnifiedQuote / orch_compute_confidence entries and the collectBookingContext_freeText entry are gone -- their second sources were unreachable and are deleted) -- the unmigrated arbitration the Charter's audit named; lower or delete an entry as each resolver is migrated
const cur = Object.keys(counts).filter(k => !STRICT.has(k.split(' | ')[1]));
const grew = cur.filter(k => counts[k] > (LEGACY[k] || 0)).map(k => `${k}: ${counts[k]} (frozen ${LEGACY[k] || 0})`);
const shrunk = Object.keys(LEGACY).filter(k => (counts[k] || 0) < LEGACY[k]).map(k => `${k}: ${counts[k] || 0} (frozen ${LEGACY[k]})`);
check(`no NEW composition of an unmigrated resolver (${cur.reduce((a, k) => a + counts[k], 0)} legacy sites frozen across ${cur.length} places; new arbitration cannot be added)`, grew.length === 0, { expected: 0, got: grew });
check('the frozen legacy list only shrinks: every entry is still present (lower the number, or delete the entry, as each is migrated)', shrunk.length === 0, { expected: 0, got: shrunk });

// ---- 2. behaviour: the record carries its source ------------------------------------------------------------------------------------------------------------------
const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
const sb = { DB, SERVICE_DATA: DB, window: { DB }, console }; sb.global = sb; vm.createContext(sb);
for (const f of ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
const dyn = Object.entries(DB.dynamic_services);
const badQ = []; let nQ = 0;
for (const s of DB.services) for (const q of [1, 2, 5]) { const r = sb.resolveQuantityUnits({ entity: s, entityType: 'service', requestedQty: q }); nQ++;
    const own = s.intake_chain.some(st => (st.module || st) === 'item_count_template');
    const want = s.per_unit_answers_vary === true ? ['single_unit', 'service_override', 1] : own ? ['batched', 'service_override', 1] : ['batched', 'fallback', q];
    if (!VOCAB.includes(r.source) || r.stance !== want[0] || r.source !== want[1] || r.units !== want[2] || r.requestedQty !== q) badQ.push(`${s.id} x${q}: ${JSON.stringify(r)}`); }
for (const [k, d] of dyn) { const r = sb.resolveQuantityUnits({ entity: d, entityType: 'dynamic', requestedQty: 3 }); nQ++; const ownQ = (d.intake_chain || []).some(st => (st.module || st) === 'item_count_template'); if (r.source !== 'dynamic_engine' || r.units !== (ownQ ? 1 : 3)) badQ.push(`${k}: ${JSON.stringify(r)}`); }
check(`resolveQuantityUnits returns {units, stance, source} with the right source for every service and dynamic service (${nQ} calls; the source matches where the DATA says the decision came from)`, badQ.length === 0 && nQ > 250, { expected: 0, got: badQ.slice(0, 3) });
const badM = []; let nM = 0; const formulas = new Set([...Object.keys(DB.pricing_formulas || {}), 'furniture_repair_formula', 'tile_repair_formula', 'hardware_install_formula', 'buy_the_hour_qty_gate_formula', null]);
for (const f of formulas) for (const et of ['service', 'dynamic']) { const r = sb.resolveQuantityMultiplier({ units: 4, unitsSource: 'fallback', formulaId: f, entityType: et }); nM++;
    const aware = ['furniture_repair_formula', 'tile_repair_formula', 'hardware_install_formula', 'buy_the_hour_qty_gate_formula'].includes(f);
    if (!VOCAB.includes(r.source) || r.multiplier !== (aware ? 1 : 4) || (aware && r.source !== (et === 'dynamic' ? 'dynamic_engine' : 'archetype_default'))) badM.push(`${f}/${et}: ${JSON.stringify(r)}`); }
check(`resolveQuantityMultiplier returns {multiplier, source}: a quantity-aware formula applies the quantity itself (multiplier 1, source names the formula's owner), anything else passes the units through (${nM} calls)`, badM.length === 0, { expected: 0, got: badM.slice(0, 3) });
const badC = []; let nC = 0;
for (const s of DB.services) { const c = sb.orch_max_followup_questions(s, 'service'); nC++; const own = s.confidence_strategy && s.confidence_strategy.maximum_followup_questions != null;
    const hasArch = Object.values(DB.archetypes).some(a => (a.member_group_ids || []).includes(s.ui_taxonomy.group_id) && a.default_confidence_strategy && a.default_confidence_strategy.maximum_followup_questions != null);
    const want = own ? 'service_override' : hasArch ? 'archetype_default' : 'fallback';
    if (!VOCAB.includes(c.source) || c.source !== want || typeof c.value !== 'number') badC.push(`${s.id}: ${JSON.stringify(c)} expected source ${want}`); }
for (const [k, d] of dyn) { const c = sb.orch_max_followup_questions(d, 'dynamic'); nC++; if (c.source !== 'dynamic_engine' || typeof c.value !== 'number') badC.push(`${k}: ${JSON.stringify(c)}`); }
check(`the follow-up ceiling is a record {value, source} whose source is where the data supplied it, for every service and dynamic service (${nC} entities; #47)`, badC.length === 0, { expected: 0, got: badC.slice(0, 3) });
const badS = []; let nS = 0;
for (const s of DB.services) { const st = sb.resolveBaseConfidenceStrategy(s, null); nS++; const keys = Object.keys(st).filter(k => k !== 'source' && k !== 'fieldSources'); const own = s.confidence_strategy || {};
    const hasArch = Object.values(DB.archetypes).some(a => (a.member_group_ids || []).includes(s.ui_taxonomy.group_id) && a.default_confidence_strategy);
    const wantRecord = Object.keys(own).length ? 'service_override' : hasArch ? 'archetype_default' : 'fallback';
    if (st.source !== wantRecord || !VOCAB.includes(st.source)) badS.push(`${s.id}: record source ${st.source}, expected ${wantRecord}`);
    for (const k of keys) { if (!st.fieldSources || !VOCAB.includes(st.fieldSources[k])) { badS.push(`${s.id}.${k}: no valid source`); break; } if ((k in own) !== (st.fieldSources[k] === 'service_override')) { badS.push(`${s.id}.${k}: source ${st.fieldSources[k]} but the service ${k in own ? 'does' : 'does not'} set it`); break; } } }
check(`the strategy resolver returns a literal \`source\` (the most specific branch that supplied any field) and a per-field \`fieldSources\`; the service's own settings are exactly the 'service_override' fields (${nS} services)`, badS.length === 0, { expected: 0, got: badS.slice(0, 3) });
finish('resolution provenance and caller composition (DEFECT-ARBITRATION detector)');
