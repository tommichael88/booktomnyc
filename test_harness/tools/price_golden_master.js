#!/usr/bin/env node
/**
 * price_golden_master.js -- capture (or compare) the price and time of EVERY service and dynamic service across a quantity sweep, on both public entry paths
 * (computeQuoteFromState and executeWorkflow) and straight through computeUnifiedQuote for the dynamic fallbacks. A refactor of how quantity is resolved
 * (T147) must change NOTHING except what it is declared to change; this proves it (R-INVARIANT-SWEEP: the full quantity range, every entity, every path).
 *   node price_golden_master.js capture <out.json>      node price_golden_master.js compare <a.json> <b.json>
 *
 * A1.6 (PHASE_PLAN.md, Phase A): the ORIGINAL 1,380 points above enumerate every entity but vary only quantity and the first answer, on the catalog entry path. The collapses of Phase A
 * reach further (tag state, the chargeability gate, free-text entry, the guided builder's dynamic-entity state), so the INPUTS are extended -- new key families only; no original key,
 * and no original input, is changed, so the original capture (archive/golden_master_T154_original.json) remains an exact diff reference on the shared keys. This is one golden with more
 * inputs, not a second golden (the plan's top-level rule). Families added (prefixes): state-tags|, orch-tags|, state-det|, state-dyn|, dyn-tags|, text|. Coverage is recorded in archive/golden_coverage.md.
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.env.QR_ROOT || path.resolve(__dirname, '..', '..');
function snapshot() {
  const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'btnyc.json'), 'utf8'));
  const sb = { DB, SERVICE_DATA: DB, window: { DB }, console }; sb.global = sb; vm.createContext(sb);
  for (const f of ['pricing_engine.js', 'nlp_engine.js', 'orchestrator_engine.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f });
  const out = {}, QTYS = [1, 2, 3, 5];
  const firstAnswers = svc => { const a = {}; for (const st of svc.intake_chain) { const k = st.module || st; const m = DB.intake_modules[k]; const resp = (st.params && st.params.client_response) || (m && m.client_response) || []; if (resp[0] && !/count|qty|quantity/.test(k)) a[k] = resp[0].label; } return a; };
  for (const s of DB.services) { const cat = s.ui_taxonomy.category_id;
    for (const variant of ['none', 'first']) { const ans = variant === 'first' ? firstAnswers(s) : {};
      for (const q of QTYS) {
        try { const st = { qty: q, intent: { key: s.id, category: cat, label: 'x', qtyLabel: 'item' }, stype: 'Repair', answers: Object.assign({}, ans), detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: [], userTagIds: [], _svc: s, _tagsAffirmed: false };
          const r = sb.computeQuoteFromState(st); out[`state|${s.id}|${variant}|${q}`] = [r.laborCalc, r.totalMin]; } catch (e) { out[`state|${s.id}|${variant}|${q}`] = 'ERR ' + e.message; }
        try { const c = sb.collectBookingContext_catalog(s, cat); c.answers = Object.assign({}, ans); c.extractedQty = q; const r = sb.executeWorkflow(c, DB); out[`orch|${s.id}|${variant}|${q}`] = [r.quote.laborEstimate, r.quote.totalMin]; } catch (e) { out[`orch|${s.id}|${variant}|${q}`] = 'ERR ' + e.message; }
      } } }
  for (const [k, d] of Object.entries(DB.dynamic_services || {})) for (const q of [1, 3]) {
    try { const r = sb.computeUnifiedQuote({ svc: null, dynDef: d, activeTagIds: [], answers: {}, qty: q }); out[`dyn|${k}|none|${q}`] = [r.laborEstimate, r.totalMin]; } catch (e) { out[`dyn|${k}|none|${q}`] = 'ERR ' + e.message; } }
  // ---- A1.6 extension: new input dimensions, new key families (the original keys above are untouched) -------------------------------------------------------------------
  const smart = Object.keys(DB.smart_tags || {});
  const validFor = (cat, grp) => smart.filter(t => { try { return sb.tagValidForCategory(t, cat, grp); } catch (e) { return false; } });
  const tagSets = (cat, grp) => { const v = validFor(cat, grp); return { A: v.slice(0, 3), B: v.slice(-3) }; };
  const stateRec = r => [r.laborCalc, r.totalMin, r.meetsConfidenceBar, r.detTagsChargeable, r.checkoutStateKey, (r.activeTagIds || []).slice().sort().join(',')];
  const mk = (s, cat, q, extra) => Object.assign({ qty: q, intent: { key: s.id, category: cat, label: 'x', qtyLabel: 'item' }, stype: 'Repair', answers: {}, detTagIds: [], manTagIds: [], negatedTagIds: [], inherentTagIds: [], userTagIds: [], _svc: s, _tagsAffirmed: false }, extra || {});
  for (const s of DB.services) { const cat = s.ui_taxonomy.category_id, grp = s.ui_taxonomy.group_id, sets = tagSets(cat, grp);
    for (const [sn, tags] of Object.entries(sets)) for (const q of [1, 2]) {
      // tag state, chosen by the customer (manual) -- both public paths
      try { out[`state-tags|${s.id}|${sn}|${q}`] = stateRec(sb.computeQuoteFromState(mk(s, cat, q, { manTagIds: tags.slice() }))); } catch (e) { out[`state-tags|${s.id}|${sn}|${q}`] = 'ERR ' + e.message; }
      try { const c = sb.collectBookingContext_catalog(s, cat); c.manuallyToggledTagIds = tags.slice(); c.extractedQty = q; const r = sb.executeWorkflow(c, DB); out[`orch-tags|${s.id}|${sn}|${q}`] = [r.quote.laborEstimate, r.quote.totalMin, r.confidence && r.confidence.score, r.confidence && r.confidence.minConf, r.confidence && r.confidence.escalatedBy || null, (r.activeTags || []).slice().sort().join(',')]; } catch (e) { out[`orch-tags|${s.id}|${sn}|${q}`] = 'ERR ' + e.message; }
      // tags the NLP DETECTED but the customer has not affirmed: the chargeability gate (state path only; the gate lives there)
      try { out[`state-det|${s.id}|${sn}|${q}`] = stateRec(sb.computeQuoteFromState(mk(s, cat, q, { detTagIds: tags.slice() }))); } catch (e) { out[`state-det|${s.id}|${sn}|${q}`] = 'ERR ' + e.message; }
    } }
  // the guided builder's pricing state: no named service (_svc null), a dynamic entity resolved by category + stype + group, as sqBuilderFinish -> sqPrepareFlow seeds it
  for (const [k, d] of Object.entries(DB.dynamic_services || {})) { const parts = k.split('+'), cat = parts[0], stype = parts[parts.length - 1], grp = parts.length === 3 ? parts[1] : null, sets = tagSets(cat, grp);
    for (const [sn, tags] of [['none', []], ['A', sets.A]]) for (const q of [1, 3]) {
      try { out[`state-dyn|${k}|${sn}|${q}`] = stateRec(sb.computeQuoteFromState({ qty: q, intent: { key: 'builder:' + (grp || cat), category: cat, label: 'x', group: 'x', base: (d.financial_engine && d.financial_engine.base_price) || 0, stype, qtyLabel: 'item', _groupId: grp }, stype, answers: {}, detTagIds: [], manTagIds: tags.slice(), negatedTagIds: [], inherentTagIds: [], userTagIds: [], _svc: null, _tagsAffirmed: false })); } catch (e) { out[`state-dyn|${k}|${sn}|${q}`] = 'ERR ' + e.message; } }
    for (const q of [1, 3]) { try { const r = sb.computeUnifiedQuote({ svc: null, dynDef: d, activeTagIds: sets.A.slice(), answers: {}, qty: q }); out[`dyn-tags|${k}|A|${q}`] = [r.laborEstimate, r.totalMin]; } catch (e) { out[`dyn-tags|${k}|A|${q}`] = 'ERR ' + e.message; } } }
  // the boot sequence initialises the NLP sets from the SSOT before any request is parsed (qr.html init: initNlpSets(); refreshNlpPreviewBindings()); the free-text family must do the same or it measures an un-booted parser
  sb.initNlpSets(); if (typeof sb.refreshNlpPreviewBindings === 'function') sb.refreshNlpPreviewBindings();
  // free-text entry: what a customer types. One phrasing per service from its own display name, one with a stated count, and a fixed corpus of ordinary requests
  const route = text => { const c = sb.collectBookingContext_freeText(text), r = sb.executeWorkflow(c, DB); return [(r.entity && r.entity.id) || r.entityType || null, r.uiTemplate, r.quote && r.quote.laborEstimate, r.quote && r.quote.totalMin, r.confidence && r.confidence.score, r.quantity && r.quantity.units, (r.activeTags || []).slice().sort().join(',')]; };
  for (const s of DB.services) { const nm = (s.ui_taxonomy.display_name || s.id).toLowerCase();
    for (const [vn, text] of [['name', nm], ['count', `I need 3 ${nm}`]]) { try { out[`text|${s.id}|${vn}`] = route(text); } catch (e) { out[`text|${s.id}|${vn}`] = 'ERR ' + e.message; } } }
  // the Other tile: a group-level tap with no named service (collectBookingContext_otherTile), one entry per group that has an uncovered service type
  { const groupMap = new Map((DB.group || []).map(g => [g.id, g]));
    for (const g of DB.group || []) { const cat = g.category_id || g.category || g.category_ref || null; let tiles = []; try { tiles = sb.buildOtherTilesForGroup(DB.services.filter(x => x.ui_taxonomy.group_id === g.id), g.id, groupMap, DB); } catch (e) { out[`orch-other|${g.id}|ERR`] = 'ERR ' + e.message; }
      for (const tile of tiles) for (const q of [1, 3]) { try { const c = sb.collectBookingContext_otherTile(tile, cat); c.extractedQty = q; const r = sb.executeWorkflow(c, DB); out[`orch-other|${g.id}|${q}`] = [r.entityType, r.uiTemplate, r.quote && r.quote.laborEstimate, r.quote && r.quote.totalMin, r.confidence && r.confidence.score, !!r.skipTypeSelection]; } catch (e) { out[`orch-other|${g.id}|${q}`] = 'ERR ' + e.message; } } } }
  const CORPUS = ['my dishwasher is leaking', 'mount a tv', 'toilet keeps running', 'install 3 shelves', 'replace a light bulb', 'hang a very heavy mirror on a brick wall', 'urgent leak under the sink tonight', 'fix a squeaky door', 'assemble an ikea wardrobe',
    'patch a hole in the drywall', 'replace 5 ceiling tiles', 'install a ceiling fan', 'unclog the bathtub drain', 'repair a loose tile in the kitchen', 'put up curtain rods in two rooms', 'change the lock on the front door', 'install a smart thermostat',
    'my washing machine will not spin', 'hang pictures', 'caulk the shower', 'something is wrong with the window ac', 'not sure what is wrong with my stove', 'move a couch and a bookshelf', 'fix cabinet door hinge, not heavy'];
  CORPUS.forEach((t, i) => { try { out[`text|corpus|${String(i).padStart(2, '0')}`] = route(t); } catch (e) { out[`text|corpus|${String(i).padStart(2, '0')}`] = 'ERR ' + e.message; } });
  return out;
}
const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'capture') { const o = snapshot(); fs.writeFileSync(a, JSON.stringify(o)); const errs = Object.values(o).filter(v => typeof v === 'string').length; console.log(`captured ${Object.keys(o).length} price points (${errs} errors) -> ${a}`); }
else if (cmd === 'compare') { const A = JSON.parse(fs.readFileSync(a)), B = JSON.parse(fs.readFileSync(b)); const diffs = []; for (const k of Object.keys(A)) if (JSON.stringify(A[k]) !== JSON.stringify(B[k])) diffs.push([k, A[k], B[k]]);
  const by = {}; diffs.forEach(([k]) => { const p = k.split('|'); by[p[0] + '|' + p[1]] = (by[p[0] + '|' + p[1]] || 0) + 1; });
  console.log(`compared ${Object.keys(A).length} price points: ${diffs.length} differ across ${Object.keys(by).length} (path|entity) pairs`);
  // Which FIELD of each record moved. "N differ" alone does not say whether a price moved; this does (T164: a golden that moves
  // for a non-price reason must say so in the same line that reports the count). The field order of each family is the order
  // its record is built in snapshot() above; a family not listed here is reported by position.
  const FIELDS = { state: ['laborCalc', 'totalMin'], orch: ['laborEstimate', 'totalMin'], dyn: ['laborEstimate', 'totalMin'], 'dyn-tags': ['laborEstimate', 'totalMin'],
    'state-tags': ['laborCalc', 'totalMin', 'meetsConfidenceBar', 'detTagsChargeable', 'checkoutStateKey', 'activeTagIds'], 'state-det': ['laborCalc', 'totalMin', 'meetsConfidenceBar', 'detTagsChargeable', 'checkoutStateKey', 'activeTagIds'], 'state-dyn': ['laborCalc', 'totalMin', 'meetsConfidenceBar', 'detTagsChargeable', 'checkoutStateKey', 'activeTagIds'],
    'orch-tags': ['laborEstimate', 'totalMin', 'confidenceScore', 'minConf', 'escalatedBy', 'activeTags'], 'orch-other': ['entityType', 'uiTemplate', 'laborEstimate', 'totalMin', 'confidenceScore', 'skipTypeSelection'],
    text: ['entity', 'uiTemplate', 'laborEstimate', 'totalMin', 'confidenceScore', 'units', 'activeTags'] };
  const PRICE = /^(laborCalc|laborEstimate|totalMin)$/, moved = {}; let priceRecs = 0, errRecs = 0;
  for (const [k, x, y] of diffs) { const fam = k.split('|')[0], names = FIELDS[fam] || [];
    if (typeof x === 'string' || typeof y === 'string' || !Array.isArray(x) || !Array.isArray(y)) { errRecs++; continue; }
    let hit = false; for (let i = 0; i < Math.max(x.length, y.length); i++) if (JSON.stringify(x[i]) !== JSON.stringify(y[i])) { const f = `${fam}.${names[i] || '#' + i}`; moved[f] = (moved[f] || 0) + 1; if (PRICE.test(names[i] || '')) hit = true; }
    if (hit) priceRecs++; }
  if (diffs.length) { console.log(`  of those ${diffs.length}: ${priceRecs} differ in a labor or minutes field${errRecs ? `; ${errRecs} are an error on one side` : ''}`);
    console.log('  fields that differ (count of records): ' + Object.entries(moved).sort().map(([f, n]) => `${f} ${n}`).join(', ')); }
  diffs.slice(0, +process.env.SHOW || 12).forEach(d => console.log('  ', d[0], JSON.stringify(d[1]), '->', JSON.stringify(d[2]))); process.exit(diffs.length ? 1 : 0); }
else { console.log('usage: capture <out> | compare <a> <b>'); process.exit(2); }
