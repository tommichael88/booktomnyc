#!/usr/bin/env node
/**
 * automated_path_sweep.js -- a diagnostic tool, not a pass/fail test.
 *
 * Systematically exercises all 3 real UI paths (catalog navigation,
 * Guided Builder, Smart Quote free text) across every real service,
 * group, and NLP keyword actually in the catalog, and reports
 * anomalies worth a human look -- not a CI gate (run_all.sh does not
 * discover this file; it does not use the verify_*.js naming pattern
 * on purpose).
 *
 * Deliberately NOT randomized text. Genuinely random word salad mostly
 * fails to match any real NLP keyword at all and produces noise, not
 * signal -- exactly the outcome flagged as worth avoiding. Instead:
 * every free-text phrase is built from a real, current
 * intent_mappings.objects keyword using a realistic template, and
 * every catalog/builder answer is a real, current client_response
 * option -- deterministic and reproducible, run to run, so a future
 * sweep's diff is meaningful.
 *
 * Two deterministic answer strategies per service/group ("min": always
 * the first real option, "max": always the last) give a real spread
 * without any genuine randomness. Guided Builder and Smart Quote are
 * each additionally run at qty=5 with an explicit quantity word/
 * stepper value, specifically targeting the exact class of
 * double-counting bug found and fixed twice this session (T102, T103)
 * -- this sweep exists in real part to check that fix generalizes
 * across the whole catalog, not just the one case that surfaced it.
 *
 * Usage: node automated_path_sweep.js [--full]
 * Default prints only flagged anomalies. --full prints every run.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.dirname(__dirname);
// T116 FIX (operator flagged that this tool has apparently never been run):
// was `__dirname` (test_harness/ itself) -- every other script in this
// project resolves REPO_ROOT as the PARENT of test_harness/, where
// qr.html/btnyc.json actually live. Confirmed directly: this line alone
// made every invocation of this script fail with ENOENT before producing
// a single line of real output, regardless of run_all.sh's own, separate,
// deliberate decision not to auto-discover it.
const QR_HTML = fs.readFileSync(path.join(REPO_ROOT, 'qr.html'), 'utf8');
const DB = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'btnyc.json'), 'utf8'));
const FULL = process.argv.includes('--full');

function findFn(name) {
    const m = QR_HTML.match(new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{'));
    if (!m) throw new Error(`Could not find function: ${name}`);
    let depth = 0, start = m.index, i = m.index + m[0].length - 1;
    for (let j = i; j < QR_HTML.length; j++) {
        if (QR_HTML[j] === '{') depth++;
        else if (QR_HTML[j] === '}') { depth--; if (depth === 0) return QR_HTML.slice(start, j + 1); }
    }
}
function findConst(name) {
    const m = QR_HTML.match(new RegExp('const ' + name + ' = [^;]+;'));
    return m ? m[0] : '';
}

const HELPER_CONSTS = `
const _SKIP_WORDS  = () => window._NLP?.STOP   || new Set();
const _SVC_VERBS   = () => window._NLP?.VERBS  || new Set();
const _STOP_PREPS  = () => window._NLP?.PREPS  || new Set();
const _CLAUSE_BOUNDARY = () => window._NLP?.CLAUSE || new Set();
const _ROOMS_LIST  = () => window._NLP?.ROOMS  || [];
const _DIMENSION_PATTERN = /\\b\\d+\\s*-?\\s*(?:foot|feet|ft|inch|inches|in|cm|centimeters?|meters?|yards?|lbs?|pounds?|kg)\\b/gi;
const _QTY_WORD_MAP = {one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
`;
const FNS = ['initNlpSets', 'isServiceVerb', 'extractObject', 'extractQty', 'extractLocation',
    'detectIntentNLP', 'detectTagsNLP', 'resolveGroupFromIntent', 
    'resolveDynamicService', 'entityHasOwnQtyQuestion', 'resolveEngineKey',
    'syncTagSynthesizedAnswers', '_isModVisible', 'resolveBaseConfidenceStrategy',
    'resolveServiceCheckoutStateKey', 'applyLiveConfidenceEscalation', 'deriveComplexityTier',
    'applyPricingFormula', 'buildCheckoutStateModel', 'sqTagLabel', 'tagValidForCategory',
    'resolveServiceBadge', 'computeUnifiedQuote', 'computeArchetypeQuote', 'computeQuoteFromState'];
const sandbox = { DB, window: { DB }, console };
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(HELPER_CONSTS + '\n' + findConst('QR_BUILD_VERSION') + '\nconst _GENERIC_QTY_MODULE_KEYS = new Set([\'item_count\', \'count\', \'hybrid_qty\', \'global_quantity\']);\n' + FNS.map(findFn).join('\n\n'), sandbox);
sandbox.initNlpSets();

const KNOWN_QTY_AWARE_FORMULAS = new Set(['furniture_repair_formula', 'tile_repair_formula', 'hardware_install_formula']);

const results = [];
function record(path_, id, variant, qty, answers, priceOrError, basePrice, formulaId) {
    const isError = priceOrError instanceof Error;
    const price = isError ? null : priceOrError;
    // Ratio is normalized by qty: a genuinely correct "5 real units at
    // roughly base-price-each" should read close to 1x, not 5x+ -- an
    // un-normalized ratio would falsely flag every qty=5 run as
    // anomalous regardless of correctness.
    const normalizedBase = basePrice * (qty || 1);
    const ratio = (!isError && normalizedBase > 0) ? +(price / normalizedBase).toFixed(1) : null;
    const flags = [];
    if (isError) flags.push('CRASHED: ' + priceOrError.message);
    else {
        if (price === 0) flags.push('ZERO_PRICE');
        if (price < 0) flags.push('NEGATIVE_PRICE');
        if (Number.isNaN(price)) flags.push('NAN_PRICE');
        if (ratio !== null && ratio > 6) flags.push(`HIGH_RATIO (${ratio}x qty-normalized base)`);
    }
    results.push({ path: path_, id, variant, qty, price, basePrice, ratio, formulaId: formulaId || null, flags });
}

function answerChain(chain, pick) {
    // pick: 'min' (first real option) or 'max' (last real option)
    const answers = {};
    for (const step of (chain || [])) {
        const key = step.module;
        if (!key || key.startsWith('item_count_template')) continue; // handled separately by the qty variants below
        const responses = step.params?.client_response || DB.intake_modules?.[key]?.client_response;
        if (!responses || !responses.length) continue;
        const chosen = pick === 'max' ? responses[responses.length - 1] : responses[0];
        answers[key] = chosen.label;
    }
    return answers;
}

function composedChain(entity, categoryId, groupId) {
    // T118 FIX: was sandbox.resolveForceModules(entity?.variability_tier ||
    // 'low') -- that function is now an honest stub returning [] (tier
    // alone can't answer this anymore; see its own comment in qr.html).
    // Real resolution needs category/group, which every call site below
    // already has as a local variable -- passed through explicitly rather
    // than guessed at here.
    const own = (entity?.intake_chain || []).map(s => s.module);
    const defs = DB.global_rules?.intake_defaults || {};
    const forced = [...new Set([
        ...(defs.universal || []),
        ...(defs.category_defaults?.[categoryId] || []),
        ...(defs.group_defaults?.[groupId] || []),
    ])];
    const seen = new Set(own);
    const finalModules = [...own];
    for (const f of forced) if (!seen.has(f)) { finalModules.push(f); seen.add(f); }
    return finalModules.map(m => (entity.intake_chain || []).find(s => s.module === m) || { module: m });
}

function priceFor(entity, intentKey, category, groupId, stype, answers, qty) {
    try {
        sandbox.S = {
            qty, intent: { key: intentKey, category, _groupId: groupId || null, label: 'sweep' },
            stype, detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: [],
            answers, _tagSynthesizedModules: {}, _tagsAffirmed: true,
            ...(entity && DB.services.includes(entity) ? { _svc: entity } : {}),
        };
        const q = sandbox.computeQuoteFromState(sandbox.S);
        return q.laborCalc;
    } catch (e) { return e; }
}

console.log('=== Sweep 1: catalog navigation -- every real named service + dynamic entity ===');
for (const svc of DB.services) {
    const chain = composedChain(svc, svc.ui_taxonomy?.category_id, svc.ui_taxonomy?.group_id);
    const base = svc.financial_engine?.base_price || 0;
    for (const pick of ['min', 'max']) {
        const answers = answerChain(chain, pick);
        const price = priceFor(svc, svc.id, svc.ui_taxonomy?.category, svc.ui_taxonomy?.group_id, svc.stype || 'Repair', answers, 1);
        record('catalog:named', svc.id, pick, 1, answers, price, base);
    }
}
for (const [key, dynDef] of Object.entries(DB.dynamic_services || {})) {
    const [category, groupOrStype, maybeStype] = key.split('+');
    const stype = maybeStype || groupOrStype;
    const groupId = maybeStype ? groupOrStype : null;
    const chain = composedChain(dynDef, category, groupId);
    const base = dynDef.financial_engine?.base_price || 0;
    for (const pick of ['min', 'max']) {
        const answers = answerChain(chain, pick);
        const price = priceFor(dynDef, key, category, groupId, stype, answers, 1);
        record('catalog:dynamic', key, pick, 1, answers, price, base);
    }
}

console.log('=== Sweep 2: Guided Builder -- every real group x real service type, including the qty double-count regression check ===');
for (const grp of DB.group || []) {
    for (const stype of (grp.dynamic_service_types && grp.dynamic_service_types.length ? grp.dynamic_service_types : ['Repair'])) {
        const dynDef = sandbox.resolveDynamicService(grp.category_id || 'other', stype, grp.id);
        if (!dynDef) continue;
        const chain = composedChain(dynDef, grp.category_id || 'other', grp.id);
        const base = dynDef.financial_engine?.base_price || 0;
        const hasOwnQty = sandbox.entityHasOwnQtyQuestion(dynDef);
        const answers = answerChain(chain, 'min');
        const label = grp.id + '+' + stype;
        const p1 = priceFor(dynDef, label, grp.category_id, grp.id, stype, answers, 1);
        record('guided_builder', label, 'min@qty1', 1, answers, p1, base);
        // Regression check: qty=5 via the builder's own generic stepper should
        // NOT multiply the price by ~5x when the entity has its own quantity
        // question -- exactly the bug class fixed in T102/T103.
        const p5 = priceFor(dynDef, label, grp.category_id, grp.id, stype, answers, 5);
        record('guided_builder', label, 'min@qty5(stepper)', 5, answers, p5, base, dynDef.pricing_engine);
        const usesKnownQtyAwareFormula = KNOWN_QTY_AWARE_FORMULAS.has(dynDef.pricing_engine);
        if (hasOwnQty && !usesKnownQtyAwareFormula && typeof p1 === 'number' && typeof p5 === 'number' && p1 > 0) {
            const qtyRatio = +(p5 / p1).toFixed(1);
            if (qtyRatio >= 4) {
                results[results.length - 1].flags.push(`POSSIBLE_QTY_DOUBLE_COUNT (qty5/qty1 = ${qtyRatio}x, has own qty question)`);
            }
        }
    }
}

console.log('=== Sweep 3: Smart Quote free text -- every real NLP keyword, plus the same qty regression check ===');
const keywords = (DB.intent_mappings?.objects || []).map(o => o.keyword).filter(Boolean);
for (const kw of keywords) {
    const phrase = `I need my ${kw} fixed`;
    let intent;
    try { intent = sandbox.detectIntentNLP(phrase); } catch (e) { record('smart_quote', kw, 'plain', 1, {}, e, 0); continue; }
    if (!intent) continue;
    const groupInfo = sandbox.resolveGroupFromIntent(intent.category, '', 'Repair');
    const dynDef = sandbox.resolveDynamicService(intent.category, 'Repair', groupInfo?.resolvedGroupId);
    const svc = DB.services.find(s => s.id === intent.recommendedSku);
    const entity = svc || dynDef;
    if (!entity) continue;
    const chain = composedChain(entity, intent.category, groupInfo?.resolvedGroupId);
    const base = entity.financial_engine?.base_price || 0;
    const answers = answerChain(chain, 'min');
    const p1 = priceFor(entity, intent.key, intent.category, groupInfo?.resolvedGroupId, 'Repair', answers, 1);
    record('smart_quote', kw, 'plain', 1, answers, p1, base);

    const qtyPhrase = `I need 5 ${kw} fixed`;
    const qty = sandbox.extractQty(qtyPhrase) || 1;
    const p5 = priceFor(entity, intent.key, intent.category, groupInfo?.resolvedGroupId, 'Repair', answers, qty);
    const rec = record('smart_quote', kw, `qty-phrase(${qty})`, qty, answers, p5, base, entity.pricing_engine);
    const hasOwnQty = sandbox.entityHasOwnQtyQuestion(entity);
    const usesKnownQtyAwareFormula = KNOWN_QTY_AWARE_FORMULAS.has(entity.pricing_engine);
    if (hasOwnQty && !usesKnownQtyAwareFormula && typeof p1 === 'number' && typeof p5 === 'number' && p1 > 0 && qty > 1) {
        const qtyRatio = +(p5 / p1).toFixed(1);
        if (qtyRatio >= qty - 1) {
            results[results.length - 1].flags.push(`POSSIBLE_QTY_DOUBLE_COUNT (qty${qty}/qty1 = ${qtyRatio}x, has own qty question)`);
        }
    }
}

const flagged = results.filter(r => r.flags.length > 0);
console.log(`\n${'='.repeat(70)}\nSWEEP COMPLETE: ${results.length} total runs across 3 paths, ${flagged.length} flagged for review\n${'='.repeat(70)}\n`);

if (FULL) {
    for (const r of results) console.log(JSON.stringify(r));
} else {
    for (const r of flagged) {
        console.log(`[${r.path}] ${r.id} (${r.variant}, qty=${r.qty}): $${r.price} (base $${r.basePrice}, ${r.ratio}x)`);
        for (const f of r.flags) console.log(`    -> ${f}`);
    }
    if (!flagged.length) console.log('No anomalies flagged.');
}

fs.writeFileSync(path.join(REPO_ROOT, 'SWEEP_RESULTS.json'), JSON.stringify({ generatedAt: new Date().toISOString(), qrBuildVersion: sandbox.QR_BUILD_VERSION, totalRuns: results.length, flaggedCount: flagged.length, results }, null, 2));
console.log('\nFull results written to SWEEP_RESULTS.json');
